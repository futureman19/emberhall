import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/components/game/terrain.tsx',import.meta.url),'utf8').replaceAll('\r\n','\n');
const palette=source.slice(source.indexOf('const KIND_COLOR'),source.indexOf('const getKindPalette'));
test('pit floor uses a legible stone midtone without changing other terrain colors',()=>{
 assert.match(palette,/pit: "#75654f"/);
 assert.equal(palette.replace('pit: "#75654f"','pit: "#1a1612"'),'const KIND_COLOR: Record<TileKind, string> = {\n  grass: "#4a5a32",\n  dirt: "#6a5438",\n  cobble: "#6e685c",\n  road: "#8a7050",\n  tree: "#3f5230",\n  rock: "#5a584c",\n  water: "#3a4a58",\n  sand: "#c4b48a",\n  floor: "#5a4a3a",\n  wall: "#4a4640",\n  step: "#7a6a58",\n  pit: "#1a1612",\n  snow: "#d8d2c6",\n  marsh: "#3a4a36",\n};\n\n');
});
