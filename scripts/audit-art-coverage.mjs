#!/usr/bin/env node
/** Phase 0: source inventory, NOT an authored-art or runtime acceptance gate. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const normalize = (value) => value.replaceAll("\\", "/");
const sorted = (values) => [...new Set(values)].sort();
const STATUS = new Set([
  "inventoried",
  "authored",
  "integrated",
  "verified",
  "approved",
  "retained-by-decision",
  "blocked",
]);
const TYPE_FAMILY = {
  BuildingKind: "building",
  FaunaKind: "fauna",
  ItemId: "item",
  ClassId: "class",
  NpcRole: "npc",
  ResourceId: "resource",
  CropId: "crop",
  HerbKind: "herb",
  TileKind: "tile",
  BiomeId: "biome",
  ItemFormId: "craft-form",
  ExactRecipeId: "exact-recipe",
  HairStyleId: "look-style",
  WeatherKind: "weather",
};
const CATALOG_FAMILY = {
  BUILD_SIZE: "building",
  BUILDING_META: "building",
  FAUNA_META: "fauna",
  ITEM_META: "item",
  CLASS_META: "class",
  NPC_META: "npc",
  RESOURCE_CATALOG: "resource",
  RESOURCE_DEFINITIONS: "resource",
  RESOURCE_IDS: "resource",
  CROP_META: "crop",
  HERB_META: "herb",
  ITEM_FORM_CATALOG: "craft-form",
  EXACT_RECIPE_CATALOG: "exact-recipe",
  EXACT_RECIPE_DEFINITIONS: "exact-recipe",
  SKIN_TONES: "look-skin",
  HAIR_COLORS: "look-hair",
  GARB_TINTS: "look-garb",
  HAIR_STYLES: "look-style",
  WEATHER_META: "weather",
  RECIPES: "recipe",
};
const CONSUMERS = {
  building: ["building-meshes.tsx", "lanternwood-dressing.tsx", "house-gump.tsx", "hud.tsx"],
  fauna: ["fauna-meshes.tsx", "pets-gump.tsx"],
  item: [
    "people-meshes.tsx",
    "pile-meshes.tsx",
    "paperdoll.tsx",
    "item-tip.tsx",
    "craft-gump.tsx",
    "npc-gump.tsx",
    "vault-gump.tsx",
  ],
  class: ["people-meshes.tsx", "look-gump.tsx", "look-preview.tsx"],
  npc: ["people-meshes.tsx", "npc-gump.tsx"],
  resource: [
    "terrain.tsx",
    "resource-visuals.ts",
    "oak-stumps.tsx",
    "crop-meshes.tsx",
    "paperdoll.tsx",
  ],
  crop: ["crop-meshes.tsx"],
  herb: ["herb-meshes.tsx"],
  tile: ["terrain.tsx", "vale-map.tsx"],
  biome: ["terrain.tsx", "sky.tsx", "vale-map.tsx"],
  "craft-form": [
    "crafting/workmanship-preview.tsx",
    "crafting/material-selector.tsx",
    "crafting/inlay-panel.tsx",
    "people-meshes.tsx",
    "paperdoll.tsx",
  ],
  "exact-recipe": ["craft-gump.tsx"],
  recipe: ["craft-gump.tsx", "world-scene.tsx"],
  "look-skin": ["look-gump.tsx", "look-preview.tsx", "people-meshes.tsx"],
  "look-hair": ["look-gump.tsx", "look-preview.tsx", "people-meshes.tsx"],
  "look-garb": ["look-gump.tsx", "look-preview.tsx", "people-meshes.tsx"],
  "look-style": [
    "look-gump.tsx",
    "look-preview.tsx",
    "authored-character.tsx",
    "people-meshes.tsx",
  ],
  weather: ["sky.tsx", "weather-fx.tsx", "screen-rain.tsx", "lighting.tsx", "hud.tsx"],
};
const FAMILY_STATES = {
  building: ["exterior", "interior-cutaway", "placement-valid", "placement-invalid"],
  fauna: ["wander", "flee", "fight", "follow", "dead", "idle"],
  item: ["inventory-presentation", "world-or-equipped-applicability-unreviewed"],
  crop: ["stage:0", "stage:1", "stage:2", "stage:3", "marked"],
  herb: ["ready", "picked-regrowing"],
  resource: ["catalog-presentation", "node-or-processing-applicability-unreviewed"],
  "craft-form": ["preview", "equipped", "material-variation", "inlay-applicability-unreviewed"],
  recipe: ["selection", "success", "failure"],
  "exact-recipe": ["selection", "success", "failure"],
};

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory()
      ? walkFiles(file)
      : (file.endsWith(".ts") || file.endsWith(".tsx")) && !file.includes(".test.")
        ? [file]
        : [];
  });
}
function visit(node, fn) {
  fn(node);
  ts.forEachChild(node, (child) => visit(child, fn));
}
function unwrap(node) {
  while (
    node &&
    (ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isTypeAssertionExpression(node))
  )
    node = node.expression;
  return node;
}
function literalValues(type) {
  const parts = type.isUnion() ? type.types : [type];
  if (parts.length > 500) return [];
  const meaningful = parts.filter(
    (part) => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Never)),
  );
  if (
    !meaningful.length ||
    meaningful.some(
      (part) =>
        !(
          part.flags &
          (ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.BooleanLiteral)
        ),
    )
  )
    return [];
  return sorted(meaningful.map((part) => String(part.value ?? part.intrinsicName)));
}
function isUI(file) {
  return [
    "gump",
    "hud",
    "paperdoll",
    "item-tip",
    "context-menu",
    "minimap",
    "vale-map",
    "look-preview",
    "part-sculptor",
    "intro-cinematic",
  ].some((name) => file.includes(name));
}

export function collectInventory({ root = ROOT, overrides = {} } = {}) {
  const absolute = normalize(path.resolve(root));
  const virtual = new Map(
    Object.entries(overrides).map(([file, text]) => [normalize(path.resolve(root, file)), text]),
  );
  const files = sorted(
    [
      ...walkFiles(path.join(root, "src/game")),
      ...walkFiles(path.join(root, "src/components/game")),
      ...virtual.keys(),
    ].map((file) => normalize(path.resolve(file))),
  );
  const configFile = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
  const options = { ...config.options, noEmit: true, incremental: false };
  const host = ts.createCompilerHost(options);
  const originalRead = host.readFile.bind(host);
  host.readFile = (file) => virtual.get(normalize(path.resolve(file))) ?? originalRead(file);
  const originalExists = host.fileExists.bind(host);
  host.fileExists = (file) => virtual.has(normalize(path.resolve(file))) || originalExists(file);
  const program = ts.createProgram(files, options, host);
  const checker = program.getTypeChecker();
  const sources = files.map((file) => program.getSourceFile(file)).filter(Boolean);
  const relative = (file) => normalize(path.relative(absolute, file));
  const location = (node) =>
    `${relative(node.getSourceFile().fileName)}:${node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
  const rows = new Map();
  const catalogs = {};
  const diagnostics = [];
  const add = (family, canonicalId, node, sourceName, states = []) => {
    const id = `${family}:${canonicalId}`;
    let row = rows.get(id);
    if (!row) {
      row = {
        id,
        family,
        canonicalId,
        sources: [],
        sourceNames: [],
        rendererLocations: [],
        surfaces: [],
        states: [],
      };
      rows.set(id, row);
    }
    row.sources.push(location(node));
    row.sourceNames.push(sourceName);
    row.states.push(...states);
    return row;
  };
  // Resolve arrays through identifiers/freeze/spreads without executing game modules.
  const resolve = (node, seen = new Set()) => {
    node = unwrap(node);
    if (!node || seen.has(node)) return node;
    seen.add(node);
    if (ts.isIdentifier(node)) {
      let symbol = checker.getSymbolAtLocation(node);
      if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      const declaration = symbol?.valueDeclaration;
      if (declaration && ts.isVariableDeclaration(declaration))
        return resolve(declaration.initializer, seen);
    }
    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      node.expression.getText() === "Object.freeze"
    )
      return resolve(node.arguments[0], seen);
    return node;
  };
  const arrayIds = (node) => {
    node = resolve(node);
    if (!node || !ts.isArrayLiteralExpression(node)) return [];
    return node.elements.flatMap((element) => {
      if (ts.isSpreadElement(element)) return arrayIds(element.expression);
      const entry = resolve(element);
      if (entry && ts.isStringLiteralLike(entry)) return [{ id: entry.text, node: entry }];
      if (entry && ts.isObjectLiteralExpression(entry)) {
        const prop = entry.properties.find(
          (prop) =>
            ts.isPropertyAssignment(prop) &&
            prop.name.getText().replaceAll('"', "").replaceAll("'", "") === "id",
        );
        const value = prop && resolve(prop.initializer);
        if (value && ts.isStringLiteralLike(value)) return [{ id: value.text, node: value }];
      }
      return [];
    });
  };
  for (const source of sources) {
    if (source.parseDiagnostics.length)
      diagnostics.push(`parse errors in ${relative(source.fileName)}`);
    if (!relative(source.fileName).startsWith("src/game/")) continue;
    for (const statement of source.statements) {
      if (ts.isTypeAliasDeclaration(statement)) {
        const name = statement.name.text;
        const values = literalValues(checker.getTypeAtLocation(statement));
        // Indexed/template resource stacks are combinations, not additional assets.
        if (name === "ResourceStackKey") continue;
        const family = TYPE_FAMILY[name] ?? `vocabulary/${relative(source.fileName)}#${name}`;
        for (const value of values) add(family, value, statement, name);
        if (TYPE_FAMILY[name]) catalogs[name] = values;
      }
      if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
        const type = checker.getTypeAtLocation(statement);
        for (const prop of checker.getPropertiesOfType(type)) {
          const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
          if (!declaration) continue;
          const values = literalValues(checker.getTypeOfSymbolAtLocation(prop, declaration));
          if (!values.length || values.length > 100) continue;
          for (const value of values)
            add(
              "state-vocabulary",
              `${relative(source.fileName)}#${statement.name.text}.${prop.name}=${value}`,
              declaration,
              `${statement.name.text}.${prop.name}`,
            );
        }
      }
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const name = declaration.name.text;
        const selected =
          name in CATALOG_FAMILY ||
          name.endsWith("_META") ||
          name.endsWith("_CATALOG") ||
          name.endsWith("_DEFINITIONS") ||
          (relative(source.fileName).includes("/look/") &&
            ["FIGURE", "HAIR", "SLOT_ANCHOR", "PART_SLOTS"].includes(name));
        if (!selected) continue;
        const family = CATALOG_FAMILY[name] ?? `catalog/${relative(source.fileName)}#${name}`;
        let entries = arrayIds(declaration.initializer);
        if (!entries.length) {
          const initializer = resolve(declaration.initializer);
          // Initializer type preserves actual keys instead of trusting a Record annotation.
          const type = checker.getTypeAtLocation(initializer ?? declaration.initializer);
          if (
            type.flags & ts.TypeFlags.Object &&
            !checker.isArrayType(type) &&
            !checker.isTupleType(type)
          ) {
            entries = checker
              .getPropertiesOfType(type)
              .map((prop) => ({ id: prop.name, node: prop.valueDeclaration ?? declaration }));
          }
        }
        if (entries.length) {
          catalogs[name] = sorted(entries.map((entry) => entry.id));
          for (const entry of entries) add(family, entry.id, entry.node, name);
        }
      }
    }
  }
  // Components, procedural builders and literal JSX scene names: no hand-maintained renderer allowlist.
  for (const source of sources) {
    const file = relative(source.fileName);
    if (!file.startsWith("src/components/game/")) continue;
    for (const statement of source.statements) {
      const declarations = ts.isVariableStatement(statement)
        ? statement.declarationList.declarations
        : [statement];
      for (const declaration of declarations) {
        const name =
          declaration.name && ts.isIdentifier(declaration.name) ? declaration.name.text : "default";
        if (!(
          ts.isFunctionDeclaration(declaration) ||
          ts.isVariableDeclaration(declaration) ||
          ts.isClassDeclaration(declaration)
        ))
          continue;
        let visual = false;
        const sceneNames = [],
          branches = [],
          tags = [];
        visit(declaration, (node) => {
          if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            visual = true;
            tags.push(node.tagName.getText(source));
            for (const attr of node.attributes.properties) {
              if (
                ts.isJsxAttribute(attr) &&
                attr.name.getText(source) === "name" &&
                attr.initializer
              ) {
                const value = ts.isJsxExpression(attr.initializer)
                  ? unwrap(attr.initializer.expression)
                  : attr.initializer;
                if (value && ts.isStringLiteralLike(value))
                  sceneNames.push({ value: value.text, node: attr });
              }
            }
          }
          if (ts.isNewExpression(node) && node.expression.getText(source).startsWith("THREE."))
            visual = true;
          if (ts.isCallExpression(node) && node.expression.getText(source) === "useFrame")
            visual = true;
          if (ts.isConditionalExpression(node) || ts.isIfStatement(node)) {
            const condition = ts.isConditionalExpression(node) ? node.condition : node.expression;
            branches.push(`predicate:${condition.getText(source)}`);
          }
        });
        const callable =
          ts.isFunctionDeclaration(declaration) ||
          (ts.isVariableDeclaration(declaration) &&
            declaration.initializer &&
            (ts.isArrowFunction(unwrap(declaration.initializer)) ||
              ts.isFunctionExpression(unwrap(declaration.initializer))));
        if (!visual && !callable) continue;
        const row = add(
          !visual ? "renderer-helper" : isUI(file) ? "ui" : "renderer",
          `${file}#${name}`,
          declaration,
          name,
          ["present", ...branches],
        );
        row.rendererLocations.push(location(declaration));
        row.surfaces.push(file);
        row.jsxTags = sorted(tags);
        for (const entry of sceneNames) {
          const named = add("renderer-name", `${file}#${entry.value}`, entry.node, name, [
            "present",
          ]);
          named.rendererLocations.push(location(entry.node));
          named.surfaces.push(file);
        }
      }
    }
  }
  for (const [typeName, catalogName] of [
    ["BuildingKind", "BUILD_SIZE"],
    ["BuildingKind", "BUILDING_META"],
    ["FaunaKind", "FAUNA_META"],
    ["ItemId", "ITEM_META"],
    ["ClassId", "CLASS_META"],
    ["NpcRole", "NPC_META"],
    ["ResourceId", "RESOURCE_CATALOG"],
    ["CropId", "CROP_META"],
    ["HerbKind", "HERB_META"],
    ["ItemFormId", "ITEM_FORM_CATALOG"],
    ["ExactRecipeId", "EXACT_RECIPE_CATALOG"],
  ]) {
    if (!catalogs[typeName]?.length || !catalogs[catalogName]?.length)
      diagnostics.push(`unresolved required catalog ${typeName}/${catalogName}`);
    else if (JSON.stringify(catalogs[typeName]) !== JSON.stringify(catalogs[catalogName]))
      diagnostics.push(`catalog mismatch ${typeName}/${catalogName}`);
  }
  const symbolConsumers = new Map();
  for (const source of sources.filter((source) =>
    relative(source.fileName).startsWith("src/components/game/"),
  )) {
    visit(source, (node) => {
      if (!ts.isIdentifier(node)) return;
      let symbol = checker.getSymbolAtLocation(node);
      if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      if (
        !symbol?.declarations?.some((decl) =>
          relative(decl.getSourceFile().fileName).startsWith("src/game/"),
        )
      )
        return;
      const name = symbol.getName();
      if (!symbolConsumers.has(name)) symbolConsumers.set(name, new Map());
      const uses = symbolConsumers.get(name);
      if (!uses.has(relative(source.fileName))) uses.set(relative(source.fileName), location(node));
    });
  }
  for (const row of rows.values()) {
    for (const name of row.sourceNames)
      for (const [file, loc] of symbolConsumers.get(name) ?? []) {
        row.surfaces.push(file);
        row.rendererLocations.push(loc);
      }
    for (const consumer of CONSUMERS[row.family] ?? []) {
      const source = sources.find(
        (source) => relative(source.fileName) === `src/components/game/${consumer}`,
      );
      if (!source) continue;
      row.surfaces.push(relative(source.fileName));
      row.rendererLocations.push(`${relative(source.fileName)}:1`);
    }
    row.states.push(...(FAMILY_STATES[row.family] ?? ["catalog-or-current-presentation"]));
    if (
      row.family === "resource" &&
      [
        "oak",
        "pine",
        "willow",
        "birch",
        "ash",
        "redwood",
        "yew",
        "ghostwood",
        "iron_ore",
        "highland_ore",
      ].includes(row.canonicalId)
    )
      row.states.push("mature-node", "depleted", "regrown");
    if (row.family === "resource" && row.canonicalId === "oak")
      row.states.push(
        "local-authored",
        "outside-local-primitive",
        "sapling:1",
        "sapling:2",
        "authoritative-local-stump",
        "load-fallback",
      );
    for (const key of ["sources", "sourceNames", "rendererLocations", "surfaces", "states"])
      row[key] = sorted(row[key]);
  }
  const result = [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
  return {
    schemaVersion: 1,
    extractor: "typescript-ast-checker/1",
    files: files.map(relative),
    catalogs,
    diagnostics,
    rows: result,
  };
}

function priorSource(row) {
  const empty = {
    blend: null,
    script: null,
    export: null,
    parts: null,
    materials: null,
    attachments: null,
    lods: null,
  };
  if (row.id === "building:hall")
    return {
      ...empty,
      blend: "art/blender/lanternwood-kit.blend",
      script: "art/blender/build_lanternwood.py",
      export: "public/art/lanternwood/hall.glb",
      reference: "BLENDER-PREVIEW.md",
      scope:
        "Previously accepted exterior only; indoor voxels and load fallback retained. Not reverified by this inventory.",
    };
  if (row.id === "resource:oak")
    return {
      ...empty,
      blend: "art/blender/oaks.blend",
      script: "art/blender/build_oaks.py",
      export: "public/art/lanternwood/oak.glb",
      reference: "OAK-PREVIEW.md",
      scope:
        "Previously accepted canonical/planted local COURT slice only, not all oaks or resources. Not reverified here.",
    };
  if (row.id.startsWith("renderer:src/components/game/authored-character.tsx#"))
    return {
      ...empty,
      blend: "art/blender/character.blend",
      script: "art/blender/build_character.py",
      export: "public/art/lanternwood/character.glb",
      reference: "CHARACTER-PREVIEW.md",
      scope:
        "Player and Looking Glass; procedural details and NPCs are not authored replacements. Not reverified here.",
    };
  return empty;
}

export function makeLedger(inventory) {
  return {
    schemaVersion: 1,
    inventoryVersion: "phase-0-first-pass/1",
    extractor: inventory.extractor,
    scope:
      "Source inventory only; no new modeling, integration, runtime verification or approval. Bank/forge is the only next pilot.",
    sourceFiles: inventory.files,
    catalogCounts: Object.fromEntries(
      Object.entries(inventory.catalogs)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, ids]) => [name, ids.length]),
    ),
    omissions: [
      "Per-ID runtime dispatch is not proven by family consumer links.",
      "Continuous values, arbitrary user-authored voxel parts and dynamic scene names are not finitely enumerated.",
      "State predicates are source inventory, not exhaustive truth-table or animation/permutation verification.",
      "Imported non-game UI libraries, audio-only effects, runtime-generated object names and shader-internal primitives are outside this bounded scan.",
      "Authored geometry budgets and source/GLB correspondence are unmeasured here; null is not zero or approval.",
    ],
    assets: inventory.rows.map((row) => ({
      id: row.id,
      canonicalId: row.canonicalId,
      family: row.family,
      catalogSources: row.sources,
      sourceNames: row.sourceNames,
      rendererLocations: row.rendererLocations,
      rendererMapping:
        row.family === "renderer" ||
        row.family === "renderer-helper" ||
        row.family === "ui" ||
        row.family === "renderer-name"
          ? "direct AST declaration/name"
          : row.rendererLocations.length
            ? "family consumer; per-ID dispatch unverified"
            : "unresolved; vocabulary/catalog inventory only",
      surfaces: row.surfaces,
      jsxTags: row.jsxTags ?? null,
      states: row.states.map((id) => ({
        id,
        status: "inventoried",
        evidence: row.sources,
        applicability: id.includes("unreviewed")
          ? "unreviewed"
          : "source contract; runtime unverified",
      })),
      source: priorSource(row),
      metrics: { bounds: null, bytes: null, triangles: null, materialSlots: null },
      status: "inventoried",
      evidence: row.sources,
      batchOwner:
        row.family === "building" && ["bank", "forge"].includes(row.canonicalId)
          ? "bank-forge-pilot-after-phase-0"
          : "phase-0-inventory; future-authoring-unassigned",
      notes:
        "Not an authored replacement, runtime verification, or approval. Existing procedural/fallback presentation is not labeled complete.",
    })),
  };
}

// Refresh machine-discovered routing without resetting human evidence or dispositions.
export function refreshLedger(inventory, previous) {
  const next = makeLedger(inventory);
  const prior = new Map(previous.assets.map((row) => [row.id, row]));
  const ids = new Set(next.assets.map((row) => row.id));
  const reviewed = (row) => row.status !== "inventoried" || row.reviewEvidence?.length ||
    row.states?.some((state) => state.status !== "inventoried" || state.reviewEvidence?.length);
  for (const row of previous.assets)
    if (!ids.has(row.id) && reviewed(row))
      throw new Error(`Refusing to remove reviewed stale asset ${row.id}`);
  next.assets = next.assets.map((row) => {
    const old = prior.get(row.id);
    if (!old) return row;
    const states = new Map(old.states.map((state) => [state.id, state]));
    const currentStates = new Set(row.states.map((state) => state.id));
    for (const state of old.states)
      if (!currentStates.has(state.id) &&
          (state.status !== "inventoried" || state.reviewEvidence?.length))
        throw new Error(`Refusing to remove reviewed stale state ${row.id}/${state.id}`);
    return { ...old, ...row, source: old.source, metrics: old.metrics,
      status: old.status, evidence: old.evidence, batchOwner: old.batchOwner,
      notes: old.notes,
      states: row.states.map((state) => ({ ...state, ...states.get(state.id) })) };
  });
  return { ...previous, ...next };
}

export function auditLedger(ledger, inventory) {
  const errors = [...inventory.diagnostics];
  if (ledger.schemaVersion !== 1) errors.push("unsupported schemaVersion");
  if (!Array.isArray(ledger.assets)) return [...errors, "assets must be an array"];
  const byId = new Map();
  for (const row of ledger.assets) {
    if (byId.has(row.id)) errors.push(`duplicate ${row.id}`);
    byId.set(row.id, row);
    if (!STATUS.has(row.status)) errors.push(`invalid status ${row.id}`);
    for (const key of ["bounds", "bytes", "triangles", "materialSlots"])
      if (!row.metrics || !(key in row.metrics)) errors.push(`missing metrics.${key} ${row.id}`);
    for (const key of ["blend", "script", "export", "parts", "materials", "attachments", "lods"])
      if (!row.source || !(key in row.source)) errors.push(`missing source.${key} ${row.id}`);
    for (const key of [
      "canonicalId",
      "family",
      "rendererLocations",
      "surfaces",
      "evidence",
      "batchOwner",
    ])
      if (!(key in row)) errors.push(`missing ${key} ${row.id}`);
    if (!row.evidence?.length) errors.push(`missing evidence ${row.id}`);
    const stateIds = new Set();
    for (const state of row.states ?? []) {
      if (stateIds.has(state.id)) errors.push(`duplicate state ${row.id}/${state.id}`);
      stateIds.add(state.id);
      if (!STATUS.has(state.status)) errors.push(`invalid state status ${row.id}/${state.id}`);
      if (!state.evidence?.length) errors.push(`missing state evidence ${row.id}/${state.id}`);
      if (
        ["verified", "approved", "retained-by-decision"].includes(state.status) &&
        !state.reviewEvidence?.length
      )
        errors.push(`missing state review evidence ${row.id}/${state.id}`);
    }
    if (
      ["verified", "approved", "retained-by-decision"].includes(row.status) &&
      !row.reviewEvidence?.length
    )
      errors.push(`missing independent review evidence ${row.id}`);
  }
  const expectedIds = new Set(inventory.rows.map((row) => row.id));
  for (const row of inventory.rows) {
    const actual = byId.get(row.id);
    if (!actual) {
      errors.push(`unmapped ${row.id}`);
      continue;
    }
    if (actual.canonicalId !== row.canonicalId || actual.family !== row.family)
      errors.push(`identity mismatch ${row.id}`);
    for (const state of row.states)
      if (!actual.states?.some((entry) => entry.id === state))
        errors.push(`unmapped state ${row.id}/${state}`);
    for (const [key, values] of [["catalogSources", row.sources], ["rendererLocations", row.rendererLocations]])
      for (const value of values)
        if (!actual[key]?.includes(value)) errors.push(`unmapped ${key} ${row.id}/${value}`);
    for (const source of row.sourceNames)
      if (!actual.sourceNames?.includes(source)) errors.push(`unmapped source ${row.id}/${source}`);
    for (const tag of row.jsxTags ?? [])
      if (!actual.jsxTags?.includes(tag)) errors.push(`unmapped JSX renderer ${row.id}/${tag}`);
    for (const surface of row.surfaces)
      if (!actual.surfaces?.includes(surface)) errors.push(`unmapped surface ${row.id}/${surface}`);
  }
  for (const row of ledger.assets) if (!expectedIds.has(row.id)) errors.push(`stale ${row.id}`);
  return errors;
}

export function summarize(inventory, ledger) {
  return {
    inventoryVersion: ledger.inventoryVersion,
    assets: ledger.assets.length,
    uniqueIds: new Set(ledger.assets.map((row) => row.id)).size,
    states: ledger.assets.reduce((sum, row) => sum + row.states.length, 0),
    sourceFiles: inventory.files.length,
    families: Object.fromEntries(
      sorted(ledger.assets.map((row) => row.family)).map((family) => [
        family,
        ledger.assets.filter((row) => row.family === family).length,
      ]),
    ),
    catalogCounts: ledger.catalogCounts,
  };
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const inventory = collectInventory();
  const ledgerPath = path.join(ROOT, "art/asset-ledger.json");
  if (process.argv.includes("--refresh")) {
    if (inventory.diagnostics.length) throw new Error(inventory.diagnostics.join("\n"));
    const previous = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    const refreshed = refreshLedger(inventory, previous);
    const errors = auditLedger(refreshed, inventory);
    if (errors.length) throw new Error(errors.join("\n"));
    fs.writeFileSync(ledgerPath, `${JSON.stringify(refreshed, null, 2)}\n`);
  }
  if (process.argv.includes("--write")) {
    if (inventory.diagnostics.length) throw new Error(inventory.diagnostics.join("\n"));
    if (fs.existsSync(ledgerPath) && !process.argv.includes("--reset-inventory"))
      throw new Error(
        "Refusing to overwrite reviewed ledger. Use --reset-inventory only after preserving manual evidence; it resets all statuses.",
      );
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    fs.writeFileSync(ledgerPath, `${JSON.stringify(makeLedger(inventory), null, 2)}\n`);
  }
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  const errors = auditLedger(ledger, inventory);
  console.log(JSON.stringify({ ...summarize(inventory, ledger), errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}
