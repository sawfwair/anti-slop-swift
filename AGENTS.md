# Repository guidance

- `Sources/AntiSlopCore/` is the canonical implementation; `Sources/AntiSlop/` is only a thin CLI over it.
- Keep rules generic and suitable for reuse across repositories. Do not add application-specific names, paths, or exceptions.
- Use SwiftSyntax's visitor API; do not add another parser or regex-based matching.
- Binary-operator expressions arrive as `SequenceExprSyntax`; always lint against the tree produced by `OperatorTable.standardOperators.foldAll` (already handled centrally in `AntiSlop.lint`).
- Add focused test coverage in `Tests/AntiSlopTests/` for semantic rule changes — one violating case and one clean case minimum.
- Dogfood before committing: `.build/debug/anti-slop Sources Tests`. Only self-referential hits (rule names containing their own subject) are acceptable.
