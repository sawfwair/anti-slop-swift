import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const binary = join(root, ".build/debug/anti-slop");

function workspace(t) {
  const directory = mkdtempSync(join(tmpdir(), "anti-slop-security-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: 30_000 });
  assert.ifError(result.error);
  return result;
}

test("CLI redacts literals, omits comments, and escapes filenames", (t) => {
  const directory = workspace(t);
  const source = join(directory, "line\n\u001b[31m.swift");
  writeFileSync(source, [
    'let password = """',
    "AUDIT_LITERAL_MARKER",
    "AUDIT_OUTPUT_MARKER",
    '"""',
    "",
    "let value = raw as! (",
    "    /* AUDIT_COMMENT_MARKER */",
    "    String",
    ")",
  ].join("\n"));
  const result = run(binary, [source], directory);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.includes("AUDIT_"), false);
  assert.equal(result.stdout.includes("\u001b"), false);
  assert.equal(result.stdout.includes("line\\n\\u{1b}[31m.swift"), true);
  const lines = result.stdout.trim().split("\n").filter(Boolean);
  assert.equal(lines.length, 3);
  assert.equal(lines[0].includes("[no-hardcoded-secrets]"), true);
  assert.equal(lines[0].includes("value redacted"), true);
  assert.equal(lines[1].includes("[require-safety-comment-for-forced-cast]"), true);
});

test("CLI leaves clean sources clean", (t) => {
  const directory = workspace(t);
  const source = join(directory, "Clean.swift");
  writeFileSync(source, "let count: Int = 1\n");
  const result = run(binary, [source], directory);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("CLI keeps invalid options and missing paths on one error line", (t) => {
  const directory = workspace(t);
  for (const argument of ["--unknown\n\u001b[31m", "missing\n\u001b[31m.swift"]) {
    const result = run(binary, [argument], directory);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.trim().split("\n").length, 1);
    assert.equal(result.stderr.includes("\\n\\u{1b}[31m"), true);
    assert.equal(result.stderr.includes("\u001b"), false);
  }
});

test("CLI escapes config paths without exposing config contents", (t) => {
  const directory = workspace(t);
  const config = join(directory, "bad\n\u001b.json");
  writeFileSync(config, '{"disabled": "AUDIT_CONFIG_MARKER"}');
  const result = run(binary, [`--config=${config}`, directory], directory);
  assert.equal(result.status, 2);
  assert.equal(result.stderr.trim().split("\n").length, 1);
  assert.equal(result.stderr.includes("AUDIT_CONFIG_MARKER"), false);
  assert.equal(result.stderr.includes("bad\\n\\u{1b}.json"), true);
});

test("asset sync copies the lockfile and rejects missing or changed pins", (t) => {
  const directory = workspace(t);
  for (const path of ["Sources", "Tests", "Package.swift", "Package.resolved", "LICENSE"]) {
    cpSync(join(root, path), join(directory, path), { recursive: true });
  }
  mkdirSync(join(directory, "scripts"));
  const script = join(directory, "scripts/sync-skill-assets.mjs");
  cpSync(join(root, "scripts/sync-skill-assets.mjs"), script);
  assert.equal(run(process.execPath, [script], directory).status, 0);
  assert.equal(run(process.execPath, [script, "--check"], directory).status, 0);
  const bundledLockfile = join(directory, "skills/install-anti-slop-swift/assets/anti-slop-swift/Package.resolved");
  const pins = JSON.parse(readFileSync(bundledLockfile, "utf8"));
  pins.pins[0].state.revision = "0".repeat(40);
  writeFileSync(bundledLockfile, JSON.stringify(pins));
  const changed = run(process.execPath, [script, "--check"], directory);
  assert.equal(changed.status, 1);
  assert.equal(changed.stderr.includes("Package.resolved asset differs"), true);
  rmSync(bundledLockfile);
  const missing = run(process.execPath, [script, "--check"], directory);
  assert.equal(missing.status, 1);
  assert.equal(missing.stderr.includes("Package.resolved asset differs"), true);
  assert.equal(run(process.execPath, [script], directory).status, 0);
  assert.equal(run(process.execPath, [script, "--check"], directory).status, 0);
});

test("installer preserves the locked dependency and refuses to overwrite it", (t) => {
  const directory = workspace(t);
  const destination = "tools/lint\n\u001b";
  const installer = join(root, "skills/install-anti-slop-swift/scripts/install.mjs");
  const copied = run(process.execPath, [installer, destination], directory);
  assert.equal(copied.status, 0, copied.stderr);
  assert.equal(copied.stdout.trim().split("\n").length, 3);
  assert.equal(copied.stdout.includes("\u001b"), false);
  const installed = join(directory, destination);
  assert.equal(readFileSync(join(installed, "Package.resolved"), "utf8"), readFileSync(join(root, "Package.resolved"), "utf8"));
  assert.equal(existsSync(join(installed, ".build")), false);
  const refused = run(process.execPath, [installer, destination], directory);
  assert.equal(refused.status, 1);
  assert.equal(refused.stderr.trim().split("\n").length, 1);
  assert.equal(refused.stderr.includes("\u001b"), false);
  assert.equal(readFileSync(join(installed, "Package.resolved"), "utf8"), readFileSync(join(root, "Package.resolved"), "utf8"));
});
