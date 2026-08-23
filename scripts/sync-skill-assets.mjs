#!/usr/bin/env node
// Syncs Sources/ (production code only) and Package.swift into the install
// skill's bundled assets. Run after changing production source:
//   node scripts/sync-skill-assets.mjs            # sync
//   node scripts/sync-skill-assets.mjs --check    # verify (used by CI)
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "Sources");
const packageManifest = join(root, "Package.swift");
const destination = join(root, "skills/install-anti-slop-swift/assets/anti-slop-swift/Sources");
const destinationManifest = join(root, "skills/install-anti-slop-swift/assets/anti-slop-swift/Package.swift");
const check = process.argv.includes("--check");

function swiftFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return swiftFiles(path);
    return path.endsWith(".swift") ? [path] : [];
  });
}

function relativePaths(base) {
  return swiftFiles(base).map((path) => relative(base, path)).sort();
}

if (check) {
  const expected = relativePaths(source);
  const actual = existsSync(destination) ? relativePaths(destination) : [];
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error("Skill assets differ from Sources; run `node scripts/sync-skill-assets.mjs`.");
  }
  for (const path of expected) {
    if (readFileSync(join(source, path), "utf8") !== readFileSync(join(destination, path), "utf8")) {
      throw new Error(`${path} differs from its skill asset; run \`node scripts/sync-skill-assets.mjs\`.`);
    }
  }
  if (existsSync(destinationManifest)) {
    if (readFileSync(packageManifest, "utf8") !== readFileSync(destinationManifest, "utf8")) {
      throw new Error("Package.swift differs from its skill asset; run `node scripts/sync-skill-assets.mjs`.");
    }
  } else {
    throw new Error("Skill assets are missing Package.swift; run `node scripts/sync-skill-assets.mjs`.");
  }
  console.log("Skill assets match Sources.");
} else {
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  cpSync(packageManifest, destinationManifest);
  for (const path of relativePaths(source)) {
    const from = join(source, path);
    const to = join(destination, path);
    mkdirSync(join(to, ".."), { recursive: true });
    cpSync(from, to);
  }
  console.log(`Synced ${relative(root, destination)}.`);
}
