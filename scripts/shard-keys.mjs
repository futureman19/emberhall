import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function mintKeys(names) {
  if (!names.length || names.some(n => !/^[a-z][a-z0-9_-]{0,47}$/.test(n)) || new Set(names).size !== names.length) {
    throw new Error("Provide unique lowercase character names (1-48 letters/digits/_/-)");
  }
  return names.map(name => `${name}:${randomBytes(32).toString("hex")}`).join(",");
}
export function writeKeys(output, names) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const rel = relative(root, resolve(output));
  if (!rel.startsWith("..") && !isAbsolute(rel)) throw new Error("Key file must be outside the repository");
  writeFileSync(output, mintKeys(names) + "\n", { flag: "wx", mode: 0o600 });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [output, ...names] = process.argv.slice(2);
  if (!output) throw new Error("Usage: node scripts/shard-keys.mjs ABSOLUTE_PRIVATE_FILE kett bran");
  writeKeys(output, names);
  console.log(`Created private key file for: ${names.join(", ")} (values not printed)`);
}
