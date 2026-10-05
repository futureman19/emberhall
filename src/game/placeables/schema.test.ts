import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyCreatorFields,
  isBlueprint,
  isPlacedObject,
  isStructure,
  parseCreatorFields,
} from "./schema.ts";

const object = {
  id: "o1",
  definitionId: "wall_straight",
  definitionVersion: 1,
  tx: 10,
  ty: 20,
  level: 0,
  rotation: 1 as const,
  materialSlots: { timber: "timber" },
  ownerId: "you",
  structureId: "s1",
  name: null,
  state: {},
};

const structure = {
  id: "s1",
  name: "Lodge",
  ownerId: "you",
  objectIds: ["o1"],
  anchor: { tx: 10, ty: 20 },
  permissions: { visit: "private", use: "owner", build: "owner" },
  revision: 1,
};

const blueprint = {
  id: "bp1",
  version: 1,
  name: "Lean-to",
  author: "Ada",
  bounds: { w: 4, d: 4, h: 2 },
  objects: [
    {
      definitionId: "wall_straight",
      definitionVersion: 1,
      dx: 0,
      dy: 0,
      level: 0,
      rotation: 0 as const,
      materialSlots: {},
      state: {},
    },
  ],
  billOfMaterials: [{ id: "board", n: 8 }],
  tags: ["lodge"],
};

test("empty creator fields are valid and empty", () => {
  const empty = emptyCreatorFields();
  assert.deepEqual(empty, { placedObjects: [], structures: [], blueprints: [] });
  assert.deepEqual(parseCreatorFields(empty), empty);
});

test("a furnished lodge round-trips through the creator schema", () => {
  const parsed = parseCreatorFields({
    placedObjects: [object],
    structures: [structure],
    blueprints: [blueprint],
  });
  assert.ok(parsed);
  assert.equal(parsed.placedObjects[0]?.id, "o1");
  assert.equal(parsed.structures[0]?.name, "Lodge");
  assert.equal(parsed.blueprints[0]?.billOfMaterials[0]?.n, 8);
});

test("placed object rotation is 0..3 and state is a known function map", () => {
  assert.equal(isPlacedObject(object), true);
  assert.equal(isPlacedObject({ ...object, rotation: 4 }), false);
  assert.equal(isPlacedObject({ ...object, state: { door: { open: true } } }), true);
  assert.equal(isPlacedObject({ ...object, state: { door: { open: "yes" } } }), false);
  assert.equal(isPlacedObject({ ...object, state: { script: { code: "alert(1)" } } }), false);
  assert.equal(isPlacedObject({ ...object, level: -1 }), false);
  assert.equal(isPlacedObject({ ...object, definitionId: "" }), false);
});

test("structure permissions are closed enums", () => {
  assert.equal(isStructure(structure), true);
  assert.equal(isStructure({ ...structure, permissions: { ...structure.permissions, visit: "everyone" } }), false);
  assert.equal(isStructure({ ...structure, permissions: { ...structure.permissions, build: "visitors" } }), false);
});

test("blueprints reject executable payloads and negative bills", () => {
  assert.equal(isBlueprint(blueprint), true);
  assert.equal(isBlueprint({ ...blueprint, billOfMaterials: [{ id: "board", n: -1 }] }), false);
  assert.equal(isBlueprint({ ...blueprint, objects: [{ ...blueprint.objects[0], state: { eval: true } }] }), false);
});

test("parseCreatorFields fails closed on missing or corrupt arrays", () => {
  assert.equal(parseCreatorFields({}), null);
  assert.equal(parseCreatorFields({ placedObjects: [], structures: [], blueprints: "no" }), null);
  assert.equal(parseCreatorFields({ placedObjects: [{ ...object, id: 1 }], structures: [], blueprints: [] }), null);
});
