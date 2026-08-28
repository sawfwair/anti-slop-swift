import SwiftParser
import XCTest

@testable import AntiSlopCore

final class DiagnosticTextTests: XCTestCase {
    func testCredentialValuesAreRedactedWithoutLosingTheFinding() throws {
        let values = ["audit-value-123", "different-value-456"]
        var messages: [String] = []
        for value in values {
            let violations = AntiSlop.lint(
                source: "let password = \"\(value)\"",
                fileName: "test.swift",
                rules: [NoHardcodedSecretsRule.self]
            )
            XCTAssertEqual(violations.count, 1)
            let violation = try XCTUnwrap(violations.first)
            XCTAssertEqual(violation.ruleID, NoHardcodedSecretsRule.id)
            XCTAssertEqual(violation.line, 1)
            XCTAssertEqual(violation.column, 16)
            XCTAssertFalse(violation.message.contains(value))
            XCTAssertFalse(violation.diagnosticLine.contains(value))
            XCTAssertTrue(violation.message.contains("value redacted"))
            messages.append(violation.message)
        }
        XCTAssertEqual(messages.first, messages.last)
    }

    func testMultilineCredentialContentsNeverReachDiagnostics() throws {
        let source = #"""
            let password = """
            AUDIT_LITERAL_MARKER
            AUDIT_UNTRUSTED_OUTPUT_MARKER
            """
            """#
        let violations = AntiSlop.lint(
            source: source, fileName: "test.swift", rules: [NoHardcodedSecretsRule.self]
        )
        XCTAssertEqual(violations.count, 1)
        let violation = try XCTUnwrap(violations.first)
        XCTAssertFalse(violation.message.contains("AUDIT_"))
        XCTAssertFalse(violation.message.contains("\n"))
    }

    func testNonCredentialValuesAndEnvironmentLookupsRemainClean() {
        let source = #"""
            let greeting = "hello"
            let password = ProcessInfo.processInfo.environment["PASSWORD"]
            """#
        XCTAssertTrue(AntiSlop.lint(
            source: source, fileName: "test.swift", rules: [NoHardcodedSecretsRule.self]
        ).isEmpty)
    }

    func testEveryDisplayedTypeOmitsEmbeddedComments() throws {
        let cases: [(String, SlopRule.Type)] = [
            ("let value = raw as! First as! (/* AUDIT_COMMENT */ Second)", NoChainedTypeCastsRule.self),
            ("let value = raw as! (\n /* AUDIT_COMMENT */ String\n)", RequireSafetyCommentForForcedCastRule.self),
            ("func consume(value: (/* AUDIT_COMMENT */ Any)) {}", NoAnyParametersRule.self),
            ("func make() -> (/* AUDIT_COMMENT */ Any) { 1 }", NoAnyReturnsRule.self),
            ("let items: [String: (/* AUDIT_COMMENT */ Any)] = [:]", NoAnyDictionaryValueRule.self),
            ("let value: (/* AUDIT_COMMENT */ Any) = 1", NoKnownValueWideningRule.self),
            ("let value = raw as (/* AUDIT_COMMENT */ Any)", NoAsAnyCastRule.self),
        ]
        for (source, rule) in cases {
            let violations = AntiSlop.lint(source: source, fileName: "test.swift", rules: [rule])
            XCTAssertEqual(violations.count, 1, rule.id)
            let violation = try XCTUnwrap(violations.first)
            XCTAssertFalse(violation.message.contains("AUDIT_COMMENT"), rule.id)
            XCTAssertFalse(violation.message.contains("/*"), rule.id)
            XCTAssertFalse(violation.message.contains("\n"), rule.id)
        }
    }

    func testOrdinaryTypeDisplayRemainsReadable() throws {
        let violation = try XCTUnwrap(AntiSlop.lint(
            source: "let value = raw as! [String: User]",
            fileName: "test.swift",
            rules: [RequireSafetyCommentForForcedCastRule.self]
        ).first)
        XCTAssertTrue(violation.message.hasPrefix("Forced cast to [String: User] has no documented invariant."))
    }

    func testCleanSourceWithCommentsRemainsClean() {
        XCTAssertTrue(AntiSlop.lint(
            source: "// AUDIT_COMMENT\nlet count: Int = 1",
            fileName: "test.swift",
            rules: SlopRule.allRules
        ).isEmpty)
    }

    func testSyntaxDisplayRedactsStringTokensAndDropsTrivia() {
        let tree = Parser.parse(source: "/* AUDIT_COMMENT */ let label = \"AUDIT_LITERAL\"")
        XCTAssertEqual(DiagnosticText.syntax(tree), "let label = \"<redacted>\"")
    }

    func testSingleLineEscapesControlsAndInvisibleFormatting() {
        let input = "line\r\n\t\u{0}\u{1b}[31m\u{85}\u{2028}\u{2029}\u{202e}\u{200b}"
        let expected = "line\\r\\n\\t\\u{0}\\u{1b}[31m\\u{85}\\u{2028}\\u{2029}\\u{202e}\\u{200b}"
        XCTAssertEqual(DiagnosticText.singleLine(input), expected)
        XCTAssertEqual(DiagnosticText.singleLine(expected), expected)
    }

    func testSingleLinePreservesOrdinaryUnicode() {
        let text = "Sources/Café.swift:1:1 – 消息 🧪"
        XCTAssertEqual(DiagnosticText.singleLine(text), text)
    }

    func testDiagnosticLineEscapesPathsAndMutableFields() {
        let path = "Sources/line\n\u{1b}[31m.swift"
        var violation = Violation(
            fileName: path, ruleID: "rule", message: "message", line: 2, column: 3
        )
        violation.ruleID = "rule\nother"
        violation.message = "message\r\u{202e}"
        XCTAssertEqual(violation.fileName, path)
        XCTAssertEqual(
            violation.diagnosticLine,
            "Sources/line\\n\\u{1b}[31m.swift:2:3: error: [rule\\nother] message\\r\\u{202e}"
        )
    }

    func testConfigErrorsEscapeUntrustedPaths() {
        let error = ConfigError(message: "bad\npath\u{1b}.json: malformed JSON")
        XCTAssertEqual(error.message, "bad\\npath\\u{1b}.json: malformed JSON")
        XCTAssertEqual(error.description, error.message)
    }
}
