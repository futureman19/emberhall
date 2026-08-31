import assert from "node:assert/strict";
import test from "node:test";
import {
  BOW_FORM,
  GEM_CLARITIES,
  ITEM_FORM_CATALOG,
  ITEM_FORM_IDENTITY,
  MATERIAL_GRADES,
  buildItemFormCatalog,
} from "./forms.ts";
import { resolveItemStats } from "./resolve.ts";
import type { CraftedComponent, ItemBuild, ItemFormDefinition } from "./types.ts";

const OAK_BODY: CraftedComponent = {
  role: "body",
  resourceId: "oak",
  form: "board",
  grade: "sound",
  amount: 5,
};
const CLOTH_BINDING: CraftedComponent = {
  role: "binding",
  resourceId: "common_cloth",
  form: "cloth",
  grade: "sound",
  amount: 1,
};

function bowBuild(overrides: Partial<ItemBuild> = {}): ItemBuild {
  return {
    workmanship: "ordinary",
    components: [structuredClone(OAK_BODY), structuredClone(CLOTH_BINDING)],
    inlays: [],
    ...overrides,
  };
}

function deepMutable<T>(value: T): T {
  return structuredClone(value);
}

function assertDeepFrozen(value: unknown, path = "root"): void {
  if (typeof value !== "object" || value === null) return;
  assert.equal(Object.isFrozen(value), true, `${path} is frozen`);
  for (const [key, nested] of Object.entries(value)) assertDeepFrozen(nested, `${path}.${key}`);
}

function unsafeResolve(form: ItemFormDefinition, build: unknown): unknown {
  return resolveItemStats(form, build as ItemBuild);
}

function withObjectPrototypeField(field: string, value: unknown, assertion: () => void): void {
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, field);
  Object.defineProperty(Object.prototype, field, {
    configurable: true,
    value,
    writable: true,
  });
  try {
    assertion();
  } finally {
    if (previous) Object.defineProperty(Object.prototype, field, previous);
    else Reflect.deleteProperty(Object.prototype, field);
  }
}

test("ordinary sound oak and common cloth resolve to the exact bow baseline", () => {
  assert.deepEqual(resolveItemStats(BOW_FORM, bowBuild()), {
    stats: { damage: 8, hitBonus: 0, armor: 0, skillBonuses: {}, slayerMultipliers: {} },
    local: { fortune: 0 },
    contributions: [],
  });
});

test("choice redwood contributes exactly two hit bonus as a primary bow body", () => {
  const result = resolveItemStats(
    BOW_FORM,
    bowBuild({
      components: [
        { ...OAK_BODY, resourceId: "redwood", grade: "choice" },
        structuredClone(CLOTH_BINDING),
      ],
    }),
  );
  assert.deepEqual(result.stats, {
    damage: 8,
    hitBonus: 2,
    armor: 0,
    skillBonuses: {},
    slayerMultipliers: {},
  });
  assert.deepEqual(
    result.contributions.map(({ source, traitId, stats }) => ({ source, traitId, stats })),
    [{ source: "material", traitId: "accuracy", stats: { hitBonus: 2 } }],
  );
});

test("a secondary hilt-sized choice redwood contribution is 0.5 rather than 2", () => {
  const secondaryForm: ItemFormDefinition = {
    ...deepMutable(BOW_FORM),
    roles: [
      {
        role: "hilt",
        amount: 1,
        accepts: { qualityType: "grade", kinds: ["timber"], forms: ["board"] },
        contribution: "secondary",
      },
    ],
  };
  const result = resolveItemStats(secondaryForm, {
    workmanship: "ordinary",
    components: [
      { role: "hilt", resourceId: "redwood", form: "board", grade: "choice", amount: 1 },
    ],
    inlays: [],
  });
  assert.equal(result.stats.hitBonus, 0.5);
});

test("fine and exceptional workmanship apply once with one contribution each", () => {
  const fine = resolveItemStats(BOW_FORM, bowBuild({ workmanship: "fine" }));
  assert.deepEqual(fine.stats, {
    damage: 8,
    hitBonus: 1,
    armor: 0,
    skillBonuses: {},
    slayerMultipliers: {},
  });
  assert.equal(fine.contributions.length, 1);
  assert.deepEqual(fine.contributions[0], {
    source: "workmanship",
    sourceId: "fine",
    stats: { hitBonus: 1 },
    local: {},
  });

  const exceptional = resolveItemStats(BOW_FORM, bowBuild({ workmanship: "exceptional" }));
  assert.deepEqual(exceptional.stats, {
    damage: 9,
    hitBonus: 2,
    armor: 0,
    skillBonuses: {},
    slayerMultipliers: {},
  });
  assert.equal(exceptional.contributions.length, 1);
  assert.deepEqual(exceptional.contributions[0], {
    source: "workmanship",
    sourceId: "exceptional",
    stats: { damage: 1, hitBonus: 2 },
    local: {},
  });
});

test("flawed Ruby adds two damage and duplicate Power-family inlays are rejected", () => {
  const ruby = resolveItemStats(
    BOW_FORM,
    bowBuild({ inlays: [{ resourceId: "ruby", clarity: "flawed" }] }),
  );
  assert.equal(ruby.stats.damage, 10);
  assert.equal(ruby.contributions.filter(({ source }) => source === "gem").length, 1);

  const twoSlotForm: ItemFormDefinition = { ...deepMutable(BOW_FORM), maxInlays: 2 };
  assert.throws(
    () =>
      resolveItemStats(
        twoSlotForm,
        bowBuild({
          inlays: [
            { resourceId: "ruby", clarity: "flawed" },
            { resourceId: "ruby", clarity: "flawless" },
          ],
        }),
      ),
    /duplicate gem family: power/,
  );
});

test("flawless Sapphire derives Fortune four locally without entering canonical stats", () => {
  const plain = resolveItemStats(BOW_FORM, bowBuild());
  const sapphire = resolveItemStats(
    BOW_FORM,
    bowBuild({ inlays: [{ resourceId: "sapphire", clarity: "flawless" }] }),
  );
  assert.deepEqual(sapphire.stats, plain.stats);
  assert.equal(sapphire.local.fortune, 4);
  assert.equal("fortune" in sapphire.stats, false);
  assert.equal(JSON.stringify(sapphire.stats).includes("fortune"), false);
});

test("canonical stats and defensive maps are capped by the item form", () => {
  const cappedForm: ItemFormDefinition = {
    ...deepMutable(BOW_FORM),
    roles: [],
    baseStats: {
      damage: 99,
      hitBonus: 99,
      armor: 99,
      skillBonuses: { archery: 99 },
      slayerMultipliers: { wolf: 99 },
    },
  };
  const result = resolveItemStats(cappedForm, {
    workmanship: "ordinary",
    components: [],
    inlays: [],
  });
  assert.deepEqual(result.stats, {
    damage: 15,
    hitBonus: 10,
    armor: 0,
    skillBonuses: { archery: 5 },
    slayerMultipliers: { wolf: 1.5 },
  });
});

test("resolution is deterministic, pure, and leaves form and build unchanged", () => {
  const form = deepMutable(BOW_FORM);
  const build = bowBuild({
    workmanship: "exceptional",
    components: [
      { ...OAK_BODY, resourceId: "redwood", grade: "choice" },
      structuredClone(CLOTH_BINDING),
    ],
    inlays: [{ resourceId: "ruby", clarity: "flawed" }],
  });
  const formBefore = structuredClone(form);
  const buildBefore = structuredClone(build);
  const first = resolveItemStats(form, build);
  const second = resolveItemStats(form, build);
  assert.deepEqual(first, second);
  assert.deepEqual(form, formBefore);
  assert.deepEqual(build, buildBefore);
});

test("invalid components and inlays reject deterministically without mutation", () => {
  const base = bowBuild();
  const cases: ReadonlyArray<readonly [RegExp, unknown, ItemFormDefinition?]> = [
    [/missing required role: binding/, { ...base, components: [OAK_BODY] }],
    [
      /duplicate component role: body/,
      { ...base, components: [OAK_BODY, OAK_BODY, CLOTH_BINDING] },
    ],
    [
      /unexpected component role: hilt/,
      { ...base, components: [OAK_BODY, CLOTH_BINDING, { ...OAK_BODY, role: "hilt", amount: 1 }] },
    ],
    [
      /role body requires amount 5/,
      { ...base, components: [{ ...OAK_BODY, amount: 4 }, CLOTH_BINDING] },
    ],
    [
      /resource iron_ore kind ore is not accepted by role body/,
      {
        ...base,
        components: [{ ...OAK_BODY, resourceId: "iron_ore", form: "ore" }, CLOTH_BINDING],
      },
    ],
    [
      /resource oak form ingot is invalid/,
      { ...base, components: [{ ...OAK_BODY, form: "ingot" }, CLOTH_BINDING] },
    ],
    [
      /item build component 0 has invalid grade: flawless/,
      { ...base, components: [{ ...OAK_BODY, grade: "flawless" }, CLOTH_BINDING] },
    ],
    [
      /unknown resource id: bogus/,
      { ...base, components: [{ ...OAK_BODY, resourceId: "bogus" }, CLOTH_BINDING] },
    ],
    [
      /gem family fortune is not allowed by form bow/,
      { ...base, inlays: [{ resourceId: "sapphire", clarity: "flawless" }] },
      { ...deepMutable(BOW_FORM), allowedGemFamilies: ["power"] },
    ],
    [
      /form bow allows at most 1 inlay/,
      {
        ...base,
        inlays: [
          { resourceId: "ruby", clarity: "flawed" },
          { resourceId: "sapphire", clarity: "flawless" },
        ],
      },
    ],
  ];

  for (const [expected, candidate, form = BOW_FORM] of cases) {
    const before = structuredClone(candidate);
    assert.throws(() => unsafeResolve(form, candidate), expected);
    assert.deepEqual(candidate, before);
  }
});

test("bow form and item-form catalog are deeply frozen at runtime", () => {
  assertDeepFrozen(BOW_FORM);
  assertDeepFrozen(ITEM_FORM_CATALOG);
  assertDeepFrozen(ITEM_FORM_IDENTITY);
  assert.equal(ITEM_FORM_CATALOG.bow, BOW_FORM);
  assert.throws(() => {
    (BOW_FORM.roles[0].accepts.forms as string[])[0] = "ingot";
  }, TypeError);
});

test("item-form catalog boundary rejects unknown, duplicate, and missing form ids", () => {
  assert.throws(
    () => buildItemFormCatalog([{ ...deepMutable(BOW_FORM), id: "bogus" } as never]),
    /unknown item form id: bogus/,
  );
  assert.throws(
    () => buildItemFormCatalog([deepMutable(BOW_FORM), deepMutable(BOW_FORM)]),
    /duplicate item form id: bow/,
  );
  assert.throws(() => buildItemFormCatalog([]), /missing item form id: bow/);
});

test("inherited item-form fields are rejected by catalog and resolver boundaries", () => {
  const inherited = Object.create(BOW_FORM) as ItemFormDefinition;
  assert.throws(
    () => buildItemFormCatalog([inherited]),
    /item form definition must be an object with a plain prototype/,
  );
  assert.throws(
    () => resolveItemStats(inherited, bowBuild()),
    /item form definition must be an object with a plain prototype/,
  );
});

test("inherited nested item-form records are rejected at every boundary", () => {
  const cases: ReadonlyArray<readonly [RegExp, (form: Record<string, unknown>) => void]> = [
    [/item form bow role 0 must be an object with a plain prototype/, (form) => {
      const roles = form.roles as Array<Record<string, unknown>>;
      roles[0] = Object.create(roles[0]) as Record<string, unknown>;
    }],
    [/item form bow role 0 accepts must be an object with a plain prototype/, (form) => {
      const role = (form.roles as Array<Record<string, unknown>>)[0];
      role.accepts = Object.create(role.accepts as object);
    }],
    [/item form bow baseStats must be an object with a plain prototype/, (form) => {
      form.baseStats = Object.create(form.baseStats as object);
    }],
    [/item form bow caps must be an object with a plain prototype/, (form) => {
      form.caps = Object.create(form.caps as object);
    }],
    [/item form bow skill bonus map must be an object with a plain prototype/, (form) => {
      const baseStats = form.baseStats as Record<string, unknown>;
      baseStats.skillBonuses = Object.create({ archery: 1 });
    }],
    [/item form bow slayer multiplier map must be an object with a plain prototype/, (form) => {
      const baseStats = form.baseStats as Record<string, unknown>;
      baseStats.slayerMultipliers = Object.create({ wolf: 1 });
    }],
  ];

  for (const [expected, mutate] of cases) {
    for (const boundary of ["catalog", "resolver"] as const) {
      const form = deepMutable(BOW_FORM) as unknown as Record<string, unknown>;
      mutate(form);
      const candidate = form as unknown as ItemFormDefinition;
      assert.throws(
        () => boundary === "catalog"
          ? buildItemFormCatalog([candidate])
          : resolveItemStats(candidate, bowBuild()),
        expected,
      );
    }
  }
});

test("null-prototype forms are accepted only when all required fields are own properties", () => {
  const nullPrototypeForm = Object.assign(
    Object.create(null) as Record<string, unknown>,
    deepMutable(BOW_FORM),
  ) as unknown as ItemFormDefinition;

  const catalog = buildItemFormCatalog([nullPrototypeForm]);
  assert.deepEqual(catalog.bow, BOW_FORM);
  assert.deepEqual(resolveItemStats(nullPrototypeForm, bowBuild()), resolveItemStats(BOW_FORM, bowBuild()));

  const missingLabel = Object.assign(
    Object.create(null) as Record<string, unknown>,
    deepMutable(BOW_FORM),
  );
  assert.equal(Reflect.deleteProperty(missingLabel, "label"), true);
  assert.throws(
    () => buildItemFormCatalog([missingLabel as unknown as ItemFormDefinition]),
    /item form definition is missing required field: label/,
  );
  assert.throws(
    () => resolveItemStats(missingLabel as unknown as ItemFormDefinition, bowBuild()),
    /item form definition is missing required field: label/,
  );
});

test("resolver rejects malformed synthetic forms with deterministic domain errors", () => {
  const malformed: ReadonlyArray<readonly [RegExp, (form: Record<string, unknown>) => void]> = [
    [/item form bow roles must be an array/, (form) => { form.roles = null; }],
    [/duplicate item form role: body/, (form) => {
      form.roles = [structuredClone(BOW_FORM.roles[0]), structuredClone(BOW_FORM.roles[0])];
    }],
    [/item form bow role 0 accepts must be an object/, (form) => {
      (form.roles as Array<Record<string, unknown>>)[0].accepts = "timber";
    }],
    [/item form bow role body has invalid contribution: bogus/, (form) => {
      (form.roles as Array<Record<string, unknown>>)[0].contribution = "bogus";
    }],
    [/item form bow role body amount must be a positive integer/, (form) => {
      (form.roles as Array<Record<string, unknown>>)[0].amount = 0.5;
    }],
    [/item form bow cap damage must be finite and nonnegative/, (form) => {
      (form.caps as Record<string, unknown>).damage = Number.NaN;
    }],
    [/item form bow base stat damage must be finite and nonnegative/, (form) => {
      (form.baseStats as Record<string, unknown>).damage = -1;
    }],
    [/item form bow maxInlays must be a nonnegative integer/, (form) => { form.maxInlays = -1; }],
    [/item form bow has invalid gem family: accuracy/, (form) => {
      form.allowedGemFamilies = ["accuracy"];
    }],
    [/duplicate gem family on item form bow: power/, (form) => {
      form.allowedGemFamilies = ["power", "power"];
    }],
  ];

  for (const [expected, mutate] of malformed) {
    const form = deepMutable(BOW_FORM) as unknown as Record<string, unknown>;
    mutate(form);
    assert.throws(() => resolveItemStats(form as unknown as ItemFormDefinition, bowBuild()), expected);
  }
});

test("selector validation requires arrays, legal values, and quality correlation", () => {
  const cases: ReadonlyArray<readonly [RegExp, string, unknown]> = [
    [/selector kinds must be an array/, "kinds", "timber"],
    [/selector has invalid resource id: ruby/, "resourceIds", ["ruby"]],
    [/selector has invalid kind: gem/, "kinds", ["gem"]],
    [/selector has invalid form: gem/, "forms", ["gem"]],
    [/selector has invalid quality: flawless/, "qualities", ["flawless"]],
  ];
  for (const [expected, field, value] of cases) {
    const form = deepMutable(BOW_FORM) as unknown as Record<string, unknown>;
    const role = (form.roles as Array<Record<string, unknown>>)[0];
    (role.accepts as Record<string, unknown>)[field] = value;
    assert.throws(() => resolveItemStats(form as unknown as ItemFormDefinition, bowBuild()), expected);
  }
});

test("malformed component elements fail with stable shape errors before dereferencing", () => {
  for (const malformed of [null, undefined, [], "oak", 7] as const) {
    const candidate = bowBuild({ components: [malformed as never, structuredClone(CLOTH_BINDING)] });
    const before = structuredClone(candidate);
    assert.throws(
      () => unsafeResolve(BOW_FORM, candidate),
      /item build component 0 must be a plain object/,
    );
    assert.deepEqual(candidate, before);
  }
});

test("malformed inlay elements fail with stable shape errors before dereferencing", () => {
  for (const malformed of [null, undefined, [], "ruby", 7] as const) {
    const candidate = bowBuild({ inlays: [malformed as never] });
    const before = structuredClone(candidate);
    assert.throws(
      () => unsafeResolve(BOW_FORM, candidate),
      /item build inlay 0 must be a plain object/,
    );
    assert.deepEqual(candidate, before);
  }
});

test("build, component, and inlay records reject unknown fields and invalid domains", () => {
  const cases: ReadonlyArray<readonly [RegExp, unknown]> = [
    [/item build has unknown field: surprise/, { ...bowBuild(), surprise: true }],
    [/unknown workmanship: masterwork/, { ...bowBuild(), workmanship: "masterwork" }],
    [
      /item build component 0 has unknown field: surprise/,
      bowBuild({ components: [{ ...OAK_BODY, surprise: true } as never, CLOTH_BINDING] }),
    ],
    [
      /item build component 0 has invalid role: bogus/,
      bowBuild({ components: [{ ...OAK_BODY, role: "bogus" } as never, CLOTH_BINDING] }),
    ],
    [
      /item build component 0 resourceId must be a string/,
      bowBuild({ components: [{ ...OAK_BODY, resourceId: 7 } as never, CLOTH_BINDING] }),
    ],
    [
      /item build component 0 has invalid form: gem/,
      bowBuild({ components: [{ ...OAK_BODY, form: "gem" } as never, CLOTH_BINDING] }),
    ],
    [
      /item build component 0 has invalid grade: flawless/,
      bowBuild({ components: [{ ...OAK_BODY, grade: "flawless" } as never, CLOTH_BINDING] }),
    ],
    [
      /item build component 0 amount must be a positive integer/,
      bowBuild({ components: [{ ...OAK_BODY, amount: 0.5 }, CLOTH_BINDING] }),
    ],
    [
      /item build inlay 0 has unknown field: surprise/,
      bowBuild({ inlays: [{ resourceId: "ruby", clarity: "cut", surprise: true } as never] }),
    ],
    [
      /item build inlay 0 resourceId must be a string/,
      bowBuild({ inlays: [{ resourceId: 7, clarity: "cut" } as never] }),
    ],
    [
      /item build inlay 0 has invalid clarity: sound/,
      bowBuild({ inlays: [{ resourceId: "ruby", clarity: "sound" } as never] }),
    ],
    [
      /resource oak is not a gem/,
      bowBuild({ inlays: [{ resourceId: "oak", clarity: "cut" } as never] }),
    ],
  ];

  for (const [expected, candidate] of cases) assert.throws(() => unsafeResolve(BOW_FORM, candidate), expected);
});

test("item builds require own fields despite Object.prototype pollution", () => {
  const inheritedValues: Readonly<Record<keyof ItemBuild, unknown>> = {
    workmanship: "ordinary",
    components: [structuredClone(OAK_BODY), structuredClone(CLOTH_BINDING)],
    inlays: [],
  };

  for (const field of ["workmanship", "components", "inlays"] as const) {
    const candidate = bowBuild() as unknown as Record<string, unknown>;
    assert.equal(Reflect.deleteProperty(candidate, field), true);
    withObjectPrototypeField(field, inheritedValues[field], () => {
      assert.throws(
        () => unsafeResolve(BOW_FORM, candidate),
        new RegExp(`item build is missing required field: ${field}`),
      );
    });
  }
});

test("crafted components require own fields despite Object.prototype pollution", () => {
  for (const field of ["role", "resourceId", "form", "grade", "amount"] as const) {
    const candidate = structuredClone(OAK_BODY) as unknown as Record<string, unknown>;
    const inheritedValue = candidate[field];
    assert.equal(Reflect.deleteProperty(candidate, field), true);
    withObjectPrototypeField(field, inheritedValue, () => {
      assert.throws(
        () => unsafeResolve(BOW_FORM, bowBuild({ components: [candidate as never, CLOTH_BINDING] })),
        new RegExp(`item build component 0 is missing required field: ${field}`),
      );
    });
  }
});

test("gem inlays require own fields despite Object.prototype pollution", () => {
  for (const field of ["resourceId", "clarity"] as const) {
    const candidate = { resourceId: "ruby", clarity: "cut" } as Record<string, unknown>;
    const inheritedValue = candidate[field];
    assert.equal(Reflect.deleteProperty(candidate, field), true);
    withObjectPrototypeField(field, inheritedValue, () => {
      assert.throws(
        () => unsafeResolve(BOW_FORM, bowBuild({ inlays: [candidate as never] })),
        new RegExp(`item build inlay 0 is missing required field: ${field}`),
      );
    });
  }
});

test("form selectors reject empty arrays and impossible grade-resource intersections", () => {
  for (const field of ["resourceIds", "kinds", "forms", "qualities"] as const) {
    const form = deepMutable(BOW_FORM) as unknown as Record<string, unknown>;
    const role = (form.roles as Array<Record<string, unknown>>)[0];
    (role.accepts as Record<string, unknown>)[field] = [];
    assert.throws(
      () => resolveItemStats(form as unknown as ItemFormDefinition, bowBuild()),
      new RegExp(`selector ${field} must not be empty`),
    );
  }

  const impossibleSelectors = [
    { qualityType: "grade", resourceIds: ["oak"], kinds: ["ore"] },
    { qualityType: "grade", kinds: ["timber"], forms: ["cloth"] },
  ] as const;
  for (const accepts of impossibleSelectors) {
    const form = deepMutable(BOW_FORM) as unknown as Record<string, unknown>;
    (form.roles as Array<Record<string, unknown>>)[0].accepts = accepts;
    assert.throws(
      () => resolveItemStats(form as unknown as ItemFormDefinition, bowBuild()),
      /item form bow role 0 selector matches no grade resources/,
    );
  }
});

test("form identity contract binds bow to bow base item and weapon class", () => {
  assert.deepEqual(ITEM_FORM_IDENTITY, { bow: { baseItem: "bow", itemClass: "weapon" } });
  assert.throws(
    () => resolveItemStats({ ...deepMutable(BOW_FORM), baseItem: "sword" }, bowBuild()),
    /item form bow must use base item bow/,
  );
  assert.throws(
    () => resolveItemStats({ ...deepMutable(BOW_FORM), itemClass: "jewelry" }, bowBuild()),
    /item form bow must use item class weapon/,
  );
});

test("base stat maps reject unknown skills, fauna, and invalid values", () => {
  const cases: ReadonlyArray<readonly [RegExp, "skillBonuses" | "slayerMultipliers", string, unknown]> = [
    [/item form bow has unknown skill bonus key: bogus/, "skillBonuses", "bogus", 1],
    [/item form bow has unknown slayer multiplier key: dragon/, "slayerMultipliers", "dragon", 1],
    [/item form bow skill bonus archery must be finite and nonnegative/, "skillBonuses", "archery", Number.NaN],
    [/item form bow slayer multiplier wolf must be finite and nonnegative/, "slayerMultipliers", "wolf", -1],
  ];
  for (const [expected, mapName, key, value] of cases) {
    const form = deepMutable(BOW_FORM);
    (form.baseStats[mapName] as Record<string, unknown>)[key] = value;
    assert.throws(() => resolveItemStats(form, bowBuild()), expected);
  }
});

test("contributions report only applied post-cap deltas and reconcile to final stats", () => {
  const form: ItemFormDefinition = {
    ...deepMutable(BOW_FORM),
    caps: { ...BOW_FORM.caps, damage: 10, hitBonus: 0 },
  };
  const result = resolveItemStats(
    form,
    bowBuild({ workmanship: "exceptional", inlays: [{ resourceId: "ruby", clarity: "flawed" }] }),
  );
  assert.deepEqual(result.contributions, [
    { source: "workmanship", sourceId: "exceptional", stats: { damage: 1 }, local: {} },
    {
      source: "gem",
      sourceId: "ruby",
      traitId: "power",
      family: "power",
      stats: { damage: 1 },
      local: {},
    },
  ]);
  const appliedDamage = result.contributions.reduce((sum, contribution) => sum + (contribution.stats.damage ?? 0), 0);
  const appliedHit = result.contributions.reduce((sum, contribution) => sum + (contribution.stats.hitBonus ?? 0), 0);
  assert.equal(appliedDamage, result.stats.damage - 8);
  assert.equal(appliedHit, result.stats.hitBonus);

  const fullyCapped = resolveItemStats(
    { ...deepMutable(form), caps: { ...form.caps, damage: 9 } },
    bowBuild({ workmanship: "exceptional", inlays: [{ resourceId: "ruby", clarity: "perfect" }] }),
  );
  assert.equal(fullyCapped.contributions.some(({ source }) => source === "gem"), false);
});

test("component permutations resolve deeply equal in canonical form-role order", () => {
  const build = bowBuild({
    components: [
      { ...OAK_BODY, resourceId: "redwood", grade: "choice" },
      { ...CLOTH_BINDING, resourceId: "fine_linen", grade: "choice" },
    ],
  });
  assert.deepEqual(
    resolveItemStats(BOW_FORM, build),
    resolveItemStats(BOW_FORM, { ...build, components: [...build.components].reverse() }),
  );
});

test("two-slot inlays resolve stably by allowed family then resource id and clarity", () => {
  const form: ItemFormDefinition = {
    ...deepMutable(BOW_FORM),
    allowedGemFamilies: ["fortune", "power"],
    maxInlays: 2,
  };
  const inlays = [
    { resourceId: "ruby", clarity: "flawed" },
    { resourceId: "sapphire", clarity: "cut" },
  ] as const;
  const first = resolveItemStats(form, bowBuild({ inlays }));
  const second = resolveItemStats(form, bowBuild({ inlays: [...inlays].reverse() }));
  assert.deepEqual(first, second);
  assert.deepEqual(first.contributions.filter(({ source }) => source === "gem").map(({ family }) => family), [
    "fortune",
    "power",
  ]);
});

test("crafting quality guards use explicit complete grade and clarity sets", () => {
  assert.deepEqual(MATERIAL_GRADES, ["rough", "sound", "choice", "pristine"]);
  assert.deepEqual(GEM_CLARITIES, ["cracked", "flawed", "cut", "flawless", "perfect"]);
  for (const grade of MATERIAL_GRADES) {
    assert.doesNotThrow(() => resolveItemStats(BOW_FORM, bowBuild({ components: [{ ...OAK_BODY, grade }, CLOTH_BINDING] })));
  }
  for (const clarity of GEM_CLARITIES) {
    assert.doesNotThrow(() => resolveItemStats(BOW_FORM, bowBuild({ inlays: [{ resourceId: "ruby", clarity }] })));
  }
});
