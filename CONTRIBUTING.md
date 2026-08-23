# Contributing

anti-slop-swift is opinionated by design. The bar for a new rule is not "this style is better" — it is "this pattern discards evidence or signal that the type system already had." Read [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) for the philosophy.

## Ground rules

- `Sources/AntiSlopCore/` is canonical. `Sources/AntiSlop/` (the CLI) stays a thin wrapper.
- Rules are AST-level via SwiftSyntax visitors. No regex matching, no new parsers.
- Keep rules generic. No application-specific names, paths, or exceptions.
- Every semantic rule change ships with focused tests: at minimum one violating case and one clean case in `Tests/AntiSlopTests/`.
- Binary-operator expressions arrive as folded infix nodes; lint against the tree produced by `OperatorTable.standardOperators.foldAll` (handled centrally in `AntiSlop.lint`).

## Before opening a PR

```bash
swift build          # zero warnings
swift test           # all green
swift run anti-slop Sources Tests --disable=no-shape-in-symbol-names
node scripts/sync-skill-assets.mjs --check
```

The dogfood step must be clean; the shape rule is the only permitted self-reference. CI enforces all four on macOS and Linux.

## Porting rules from upstream

If a rule exists in dmmulroy/anti-slop, port its implementation, not just its description, and record the mapping — including deliberate divergences — in the parity table in the README. See `no-known-value-widening` and `no-widen-then-assert` for the expected fidelity level.
