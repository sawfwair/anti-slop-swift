# anti-slop-swift

Opinionated SwiftSyntax rules that reject low-evidence and low-signal Swift patterns. A Swift port of [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop).

This project is meant to be vendored, not treated as a fixed dependency. Copy the rules into your repository, read them, and change them to match your team's standards. After that, the vendored files are yours to maintain and make your own.

## Install

Copy the package into your repository, for example at `tools/anti-slop-swift/`, then run:

```bash
cd tools/anti-slop-swift
swift run anti-slop ../../Sources
```

Exit code is `0` when clean and `1` when any rule fires. Wire that into CI, or import `AntiSlopCore` from your own tooling:

```swift
import AntiSlopCore

let violations = AntiSlop.lint(
    source: sourceText,
    fileName: path,
    rules: SlopRule.allRules
)
```

Skip rules you disagree with:

```bash
swift run anti-slop --disable=no-force-unwrap,no-key-value-coding Sources
```

List everything the package ships with:

```bash
swift run anti-slop --list-rules
```

When linting a repository that vendors this tool, ignore the vendored copy itself — the same way upstream ignores `tools/oxlint/anti-slop/**`:

```bash
swift run anti-slop Sources --disable=no-shape-in-symbol-names
```

## Rules

### Generic rules

- `no-chained-type-casts` — rejects nested type casts (`x as! A as! B`) that fabricate evidence. Port of upstream `no-chained-type-assertions`.
- `require-safety-comment-for-forced-cast` — requires every `as!` to document its checked invariant in a preceding `// SAFETY:` comment. Port of upstream `require-safety-comment-for-type-assertion`.
- `no-force-try` — requires every `try!` to document its checked invariant in a preceding `// SAFETY:` comment. Swift-specific.
- `no-force-unwrap` — requires every force unwrap (`x!`) to document why the optional is known non-nil in a preceding `// SAFETY:` comment. Swift-specific.
- `no-fatal-error` — requires every `fatalError`/`preconditionFailure` to document its invariant in a preceding `// SAFETY:` comment. Swift-specific.
- `no-implicitly-unwrapped-optionals` — rejects implicitly unwrapped optionals (`Int!`), which are deferred force unwraps; `@IBOutlet`/`@IBInspectable` declarations are exempt. Swift-specific.
- `no-as-any-cast` — requires casts to `Any`/`AnyObject` to justify discarding type information in a preceding `// SAFETY:` comment. Spirit of upstream `no-known-value-widening`.
- `no-swallowed-errors` — rejects empty `catch` blocks that discard the error without logging, recovering, or rethrowing. Swift-specific.
- `no-any-parameters` — rejects `Any` and `AnyObject` function inputs. `any Error` (optionally optional) is the accepted error-channel convention and is exempt. Port of upstream `no-object-parameters`.
- `no-any-returns` — rejects function contracts that return `Any` or `AnyObject`. Port of upstream `no-unknown-returns`.
- `no-any-typealiases` — rejects aliases that merely conceal `Any`: `typealias Payload = Any`. Port of upstream `no-unknown-type-aliases`.
- `no-any-dictionary-value` — rejects dictionary value contracts based on `Any`/`AnyObject`, such as `[String: Any]`. Port of upstream `no-unsafe-dictionary-type`.
- `no-known-value-widening` — rejects explicit broad annotations that discard known evidence: `let payload: Any = ["a": 1]`, or `let handlers: [String: Handler] = ["start": h]` erasing known keys. Direct port.
- `no-widen-then-assert` — rejects bindings that widen a known value to `Any` and later cast it back (`let stored: Any = load(); let u = stored as! User`). Port of upstream `no-widen-then-assert`.
- `no-shape-in-symbol-names` — rejects the case-insensitive substring "shape" in declaration names. Direct port.
- `no-key-value-coding` — rejects `value(forKey:)`, `value(forKeyPath:)`, `setValue(_:forKey:)`, and `perform(_:)` in favor of typed property access or boundary parsing. Port of upstream `no-reflect-get`.
- `no-runtime-type-sniffing` — rejects `String(describing: type(of: x))` branching on dynamic type; model variants in the type system or decode at the boundary. Port of upstream `no-runtime-typeof`.
- `no-bool-literal-comparisons` — rejects `flag == true`, `flag != false`, and `cond ? true : false`; use the condition directly. Swift-specific.
- `no-hardcoded-secrets` — rejects credentials assigned string literals; read them from the environment or a secrets store. Swift-specific.

### The SAFETY convention

Force casts, force tries, and force unwraps are sometimes genuinely necessary. The escape hatch is always the same: state the invariant you checked by hand.

```swift
// SAFETY: parseUserID validated the string before branding it.
let userID = Int(raw) as! UserID
```

A comment counts only when it sits in the contiguous comment block directly above the offending line; a blank line breaks the chain.

## Violation examples

### `no-chained-type-casts`

```swift
let user = payload as! NSObject as! User
```

### `require-safety-comment-for-forced-cast`

```swift
let userID = value as! UserID
```

Add a specific justification immediately before a necessary cast:

```swift
// SAFETY: parseUserID validated the identifier before branding it.
let userID = value as! UserID
```

### `no-force-try`

```swift
let config = try! JSONDecoder().decode(Config.self, from: bundledData)
```

### `no-force-unwrap`

```swift
let first = results.first!
```

### `no-fatal-error`

```swift
fatalError("unreachable")
```

### `no-implicitly-unwrapped-optionals`

```swift
var cache: [String: Data]!
```

### `no-as-any-cast`

```swift
let boxed = value as Any
```

### `no-swallowed-errors`

```swift
do {
    try run()
} catch {}
```

### `no-bool-literal-comparisons`

```swift
if flag == true {}
let enabled = cond ? true : false
```

### `no-hardcoded-secrets`

```swift
let apiKey = "sk-live-abc123"
```

### `no-any-parameters`

```swift
func handle(input: Any) {}
```

### `no-any-returns`

```swift
func loadUser() -> Any {}
```

### `no-any-typealiases`

```swift
typealias ExternalValue = Any
```

### `no-any-dictionary-value`

```swift
let metadata: [String: Any] = [:]
```

### `no-shape-in-symbol-names`

```swift
struct UserShape {
    let id: String
}
```

### `no-known-value-widening`

```swift
let handlers: [String: Handler] = ["start": startHandler]
```

This discards the known `start` key. Keep inference, or key the dictionary by an enum or struct.

### `no-widen-then-assert`

```swift
let stored: Any = loadUser()
let user = stored as! User
```

### `no-key-value-coding`

```swift
let name = owner.value(forKey: "name")
```

### `no-runtime-type-sniffing`

```swift
let kind = String(describing: type(of: value))
```

## Parity with upstream

| upstream rule | status here |
| --- | --- |
| `no-chained-type-assertions` | ✅ `no-chained-type-casts` |
| `no-conditional-empty-object-spread` | ❌ no Swift spread syntax |
| `no-known-value-widening` | ✅ direct port (call expressions not treated as evidence) |
| `no-module-mocking` | ❌ no Vitest/Jest-style module mocking in Swift |
| `no-object-parameters` | ✅ `no-any-parameters` |
| `no-reflect-apply` | ❌ no dynamic apply in Swift |
| `no-reflect-get` | ✅ `no-key-value-coding` |
| `no-runtime-typeof` | ◑ `no-runtime-type-sniffing`: string sniffing and `type(of:) == T.self` comparisons are rejected; plain `is`/`as?` checks are allowed because they are idiomatic error and protocol handling in Swift |
| `no-shape-in-symbol-names` | ✅ direct port |
| `no-unknown-parameters` | ✅ `no-any-parameters` (`any Error` exempt, mirroring the `cause` convention) |
| `no-unknown-returns` | ✅ `no-any-returns` |
| `no-unknown-type-aliases` | ✅ `no-any-typealiases` |
| `no-unsafe-dictionary-type` | ◑ `no-any-dictionary-value`: checks `Any`/`AnyObject` values directly; does not resolve aliases like upstream's type environment |
| `no-widen-then-assert` | ✅ ported; source-order scoped instead of function-boundary scoped |
| `require-safety-comment-for-type-assertion` | ✅ `require-safety-comment-for-forced-cast` |
| Effect group | ❌ no Effect ecosystem; Swift dependency seams differ |

Everything marked ✅ is a semantic port read from upstream's implementation, not just its README. Everything else is either impossible in Swift or deliberately narrower, as noted.

## Divergence from upstream

Swift has no spread syntax, module mocking, or Effect ecosystem, so `no-conditional-empty-object-spread`, `no-module-mocking`, and the Effect rules have no port. `no-reflect-apply` has no Swift analog worth a rule. In exchange, Swift's crash-on-unexpected-value operators (`try!`, `x!`, IUOs, `fatalError`) get the same SAFETY-comment treatment upstream applies to type assertions.

## Development

```bash
swift build
swift test
.build/debug/anti-slop Sources Tests
```

`Sources/AntiSlopCore/` is canonical. See `AGENTS.md` for contribution guidance.

## License

MIT
