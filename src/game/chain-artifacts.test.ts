import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAIN_ARTIFACT_APP,
  CHAIN_ARTIFACT_VERSION,
  applyCharacterLook,
  applyMintPart,
  applyRedeemPart,
  applyTogglePart,
  artifactBase64,
  decodeChainArtifact,
  decodeCharacterLookInscription,
  decodePartInscription,
  encodeCharacterLookInscription,
  encodePartInscription,
  latestCharacterLook,
  localPartIdFromOrigin,
  previewRedeemPart,
} from "./chain-artifacts.ts";
import { LOOK_SCHEMA } from "./look/types.ts";
import { listParts, partRarity, partsById, removePart, savePart, type VoxelPartV1 } from "./look/parts.ts";
import { resolveLook } from "./look/resolve.ts";
import { createWorld } from "./world.ts";

const OUTPOINT = `${"a".repeat(64)}_0`;

function personFixture() {
  const world = createWorld();
  const person = world.people.find(({ isPlayer }) => isPlayer)!;
  person.name = "Ada Vale";
  person.cls = "mage";
  person.look = {
    schema: LOOK_SCHEMA,
    cls: "mage",
    skin: "#8b5f42",
    hairStyle: "tail",
    hairColor: "#d7c6a5",
    garb: "#3d526e",
    parts: ["part-crown"],
  };
  return { world, person };
}

function partFixture(id = "part-chain-crown"): VoxelPartV1 {
  const part: VoxelPartV1 = {
    schema: "emberhall.part/1",
    id,
    name: "Chain Crown",
    slot: "hair",
    voxels: [
      { x: 1, y: 0, z: 1, c: "#e8b96a" },
      { x: 2, y: 0, z: 1, c: "#a85a42" },
    ],
    createdAt: 42,
    author: "Ada Vale",
    rarity: "common",
  };
  part.rarity = partRarity(part);
  return part;
}

test("chain look - versioned inscription round-trips name, calling, recipe, and successor", () => {
  const { world, person } = personFixture();
  const first = encodeCharacterLookInscription(world, person)!;
  assert.equal(first.app, CHAIN_ARTIFACT_APP);
  assert.equal(first.v, CHAIN_ARTIFACT_VERSION);
  assert.equal(first.type, "look");
  assert.equal(first.revision, 1);
  assert.equal(first.predecessor, undefined);
  assert.deepEqual(decodeCharacterLookInscription(first), first);

  person.name = "Ada Ash";
  const second = encodeCharacterLookInscription(world, person, { revision: first.revision, outpoint: OUTPOINT })!;
  assert.equal(second.revision, 2);
  assert.equal(second.predecessor, OUTPOINT);
  assert.equal(latestCharacterLook([
    { id: OUTPOINT, inscription: first },
    { id: `${"b".repeat(64)}_0`, inscription: second },
  ])?.inscription.name, "Ada Ash");
});

test("chain look - malformed payloads are absent and rejected getters never run", () => {
  const { world, person } = personFixture();
  const sound = encodeCharacterLookInscription(world, person)!;
  const malformed = [
    null,
    { ...sound, app: "other" },
    { ...sound, v: 5 },
    { ...sound, name: "" },
    { ...sound, calling: "bard" },
    { ...sound, revision: 2 },
    { ...sound, look: { ...sound.look, skin: "red" } },
    { ...sound, look: { ...sound.look, parts: Array.from({ length: 17 }, (_, index) => `part-${index}`) } },
  ];
  for (const value of malformed) assert.equal(decodeCharacterLookInscription(value), null);
  let getterCalls = 0;
  const accessor = { ...sound } as Record<string, unknown>;
  Object.defineProperty(accessor, "name", { enumerable: true, get: () => { getterCalls += 1; return "No"; } });
  assert.equal(decodeCharacterLookInscription(accessor), null);
  assert.equal(getterCalls, 0);
});

test("chain look - restore uses the same resolveLook seam bit-for-bit", () => {
  const { world, person } = personFixture();
  const inscription = encodeCharacterLookInscription(world, person)!;
  const expected = resolveLook(person.look);
  person.name = "Lost";
  person.cls = "ranger";
  person.look = { schema: LOOK_SCHEMA };
  assert.equal(applyCharacterLook(world, inscription), "Ada Vale returns to the looking glass.");
  assert.equal(person.name, "Ada Vale");
  assert.equal(person.cls, "mage");
  assert.deepEqual(resolveLook(person.look), expected);
  const b64 = artifactBase64(inscription);
  assert.ok(b64.length > 10);
  assert.deepEqual(decodeChainArtifact(inscription), inscription);
});

test("chain part - inscription preserves exact sculpted identity, author, and rarity", () => {
  const { world } = personFixture();
  const part = partFixture();
  const inscription = encodePartInscription(world, part)!;
  assert.equal(inscription.type, "part");
  assert.equal(inscription.part.author, "Ada Vale");
  assert.equal(inscription.part.rarity, partRarity(part));
  assert.deepEqual(decodePartInscription(inscription), inscription);
  assert.deepEqual(decodeChainArtifact(inscription), inscription);

  const forged = structuredClone(inscription) as any;
  forged.part.voxels[1].x = forged.part.voxels[0].x;
  forged.part.voxels[1].y = forged.part.voxels[0].y;
  forged.part.voxels[1].z = forged.part.voxels[0].z;
  assert.equal(decodePartInscription(forged), null);
  const forgedRarity = structuredClone(inscription) as any;
  forgedRarity.part.rarity = "masterwork";
  assert.equal(decodePartInscription(forgedRarity), null);
});

test("chain part - confirmed mint leaves the bench and redeem restores wearability", () => {
  const { world, person } = personFixture();
  const part = partFixture(`part-cycle-${Date.now()}`);
  savePart(part);
  person.look = { ...person.look!, parts: [...(person.look?.parts ?? []), part.id] };
  const inscription = encodePartInscription(world, part)!;

  assert.equal(applyMintPart(world, part.id), `${part.name} passes into the chain. Its shape is yours — truly.`);
  assert.equal(listParts().some(({ id }) => id === part.id), false);
  assert.equal(person.look.parts?.includes(part.id), false);

  assert.equal(previewRedeemPart(inscription, OUTPOINT), null);
  assert.equal(applyRedeemPart(world, inscription, OUTPOINT), `${part.name} returns to the sculptor's bench.`);
  const restoredId = localPartIdFromOrigin(OUTPOINT)!;
  assert.equal(listParts().some(({ id }) => id === restoredId), true);
  assert.equal(applyTogglePart(world, restoredId), `${person.name} wears ${part.name}.`);
  assert.deepEqual(partsById(person.look.parts), [{ ...part, id: restoredId }]);
  assert.equal(applyTogglePart(world, restoredId), `${part.name} returns to the bench.`);
  assert.deepEqual(partsById(person.look.parts), []);
  removePart(restoredId);
});
