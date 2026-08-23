#!/usr/bin/env node
// Copies the bundled anti-slop-swift package into the current repository.
// Usage (from the target repository root):
//   node <skill-directory>/scripts/install.mjs [destination] [--force]
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(skillRoot, "assets/anti-slop-swift");
const arguments_ = process.argv.slice(2);
const targetArgument = arguments_.find((argument) => !argument.startsWith("--"));
const target = resolve(process.cwd(), targetArgument ?? "tools/anti-slop-swift");
const force = arguments_.includes("--force");

// Build caches embed absolute paths (module cache, index store) and break at
// the destination; never copy them.
const excludedNames = new Set([".build", ".git", ".swiftpm", "DerivedData"]);

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (excludedNames.has(entry.name)) continue;
    const sourceEntry = join(from, entry.name);
    const targetEntry = join(to, entry.name);
    if (entry.isDirectory()) {
      copyTree(sourceEntry, targetEntry);
    } else {
      cpSync(sourceEntry, targetEntry);
    }
  }
}

if (!existsSync(source)) {
  console.error(`Bundled assets missing at ${source}; reinstall the skill.`);
  process.exit(1);
}

if (existsSync(target) && !force) {
  console.error(`Refusing to overwrite ${target}. Re-run with --force only after reviewing the existing files.`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
copyTree(source, target);
console.log(`Copied the anti-slop-swift package to ${target}`);
console.log(`Lint with: cd ${target} && swift run anti-slop <path-to-swift-sources>`);
