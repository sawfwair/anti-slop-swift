#!/usr/bin/env node
// Syncs Sources/, Tests/, Package.swift, Package.resolved, and LICENSE into the install skill's
// bundled assets. Run after changing production source:
//   node scripts/sync-skill-assets.mjs            # sync
//   node scripts/sync-skill-assets.mjs --check    # verify (used by CI)
//
// Tests are bundled on purpose: a vendored package must satisfy SwiftPM
// validation (its manifest declares a test target) and let adopters run the
// suite themselves. LICENSE travels with it so attribution survives vendoring.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "Sources");
const tests = join(root, "Tests");
const packageManifest = join(root, "Package.swift");
const packageResolution = join(root, "Package.resolved");
const license = join(root, "LICENSE");
const destination = join(root, "skills/install-anti-slop-swift/assets/anti-slop-swift/Sources");
const destinationTests = join(root, "skills/install-anti-slop-swift/assets/anti-slop-swift/Tests");
const destinationManifest = join(root, "skills/install-anti-slop-swift/assets/anti-slop-swift/Package.swift");
const destinationResolution = join(root, "skills/install-anti-slop-swift/assets/anti-slop-swift/Package.resolved");
const destinationLicense = join(root, "skills/install-anti-slop-swift/assets/anti-slop-swift/LICENSE");
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

function assertIdentical(from, to, label) {
  if (!existsSync(to) || readFileSync(from, "utf8") !== readFileSync(to, "utf8")) {
    throw new Error(`${label} differs from source; run \`node scripts/sync-skill-assets.mjs\`.`);
  }
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
  const expectedTests = relativePaths(tests);
  const actualTests = existsSync(destinationTests) ? relativePaths(destinationTests) : [];
  if (JSON.stringify(expectedTests) !== JSON.stringify(actualTests)) {
    throw new Error("Skill asset tests differ from Tests; run `node scripts/sync-skill-assets.mjs`.");
  }
  for (const path of expectedTests) {
    if (
      !existsSync(join(destinationTests, path)) ||
      readFileSync(join(tests, path), "utf8") !== readFileSync(join(destinationTests, path), "utf8")
    ) {
      throw new Error(`${path} differs in skill asset tests; run \`node scripts/sync-skill-assets.mjs\`.`);
    }
  }
  assertIdentical(packageManifest, destinationManifest, "Package.swift asset");
  assertIdentical(packageResolution, destinationResolution, "Package.resolved asset");
  assertIdentical(license, destinationLicense, "LICENSE asset");
  console.log("Skill assets match Sources, Tests, Package.swift, Package.resolved, and LICENSE.");
} else {
  rmSync(destination, { recursive: true, force: true });
  rmSync(destinationTests, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  mkdirSync(destinationTests, { recursive: true });
  cpSync(packageManifest, destinationManifest);
  cpSync(packageResolution, destinationResolution);
  cpSync(license, destinationLicense);
  for (const path of relativePaths(source)) {
    cpSync(join(source, path), join(destination, path));
  }
  for (const path of relativePaths(tests)) {
    const to = join(destinationTests, path);
    mkdirSync(join(to, ".."), { recursive: true });
    cpSync(join(tests, path), to);
  }
  console.log(`Synced ${relative(root, destination)}.`);
}
