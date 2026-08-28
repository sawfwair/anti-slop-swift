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
  console.error(`Bundled assets missing at ${JSON.stringify(source)}; reinstall the skill.`);
  process.exit(1);
}

if (existsSync(target) && !force) {
  console.error(`Refusing to overwrite ${JSON.stringify(target)}. Re-run with --force only after reviewing the existing files.`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
copyTree(source, target);
// JSON-quote paths to escape newlines and ASCII control characters.
console.log(`Copied the anti-slop-swift package to ${JSON.stringify(target)}`);
console.log("Review Package.swift and Package.resolved, then build with: test -f Package.resolved && swift build --force-resolved-versions");
console.log("Run the built .build/debug/anti-slop executable on the repository's owned source paths.");
