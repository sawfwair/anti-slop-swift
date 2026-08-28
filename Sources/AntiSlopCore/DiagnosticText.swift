import SwiftSyntax

/// Rendering for untrusted source text and paths. Escaping keeps diagnostics
/// on one line; it does not make their contents trusted agent instructions.
public enum DiagnosticText {
    public static func singleLine(_ text: String) -> String {
        var result = ""
        for scalar in text.unicodeScalars {
            switch scalar {
            case "\n": result += "\\n"
            case "\r": result += "\\r"
            case "\t": result += "\\t"
            default:
                switch scalar.properties.generalCategory {
                case .control, .format, .lineSeparator, .paragraphSeparator:
                    result += "\\u{\(String(scalar.value, radix: 16))}"
                default:
                    result.unicodeScalars.append(scalar)
                }
            }
        }
        return result
    }

    /// Display syntax tokens, never comment trivia or parser-recovery text.
    static func syntax(_ node: some SyntaxProtocol) -> String {
        let visitor = DiagnosticTokenVisitor(viewMode: .sourceAccurate)
        visitor.walk(node)
        return singleLine(visitor.text)
    }
}

private final class DiagnosticTokenVisitor: SyntaxVisitor {
    private(set) var text = ""
    private var needsSeparator = false

    override func visit(_ node: UnexpectedNodesSyntax) -> SyntaxVisitorContinueKind {
        .skipChildren
    }

    override func visit(_ token: TokenSyntax) -> SyntaxVisitorContinueKind {
        guard !token.text.isEmpty else { return .skipChildren }
        if !text.isEmpty && (needsSeparator || !token.leadingTrivia.isEmpty) {
            text += " "
        }
        // Attribute arguments can contain string tokens even within a type.
        if case .stringSegment = token.tokenKind {
            text += "<redacted>"
        } else {
            text += token.text
        }
        needsSeparator = !token.trailingTrivia.isEmpty
        return .skipChildren
    }
}
