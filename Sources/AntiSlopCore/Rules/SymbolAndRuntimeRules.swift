import SwiftSyntax

/// Direct port of upstream `no-shape-in-symbol-names`.
///
/// Bans the case-insensitive substring "shape" in declaration names. "Shape"
/// describes structure rather than ownership; name symbols for their domain
/// role.
public final class NoShapeInSymbolNamesRule: SlopRule {
    override public class var id: String { "no-shape-in-symbol-names" }
    override public class var summary: String {
        "Rejects \"shape\" in declaration names; name symbols for their domain role."
    }

    public required init(
        fileName: String,
        sourceText: String,
        converter: SourceLocationConverter
    ) {
        super.init(fileName: fileName, sourceText: sourceText, converter: converter)
    }

    private func check(_ name: TokenSyntax) {
        guard name.text.lowercased().contains("shape") else { return }
        report(
            name,
            message:
                "Rename \"\(name.text)\" for its domain role; \"shape\" describes structure rather than ownership."
        )
    }

    override public func visitPost(_ node: ClassDeclSyntax) { check(node.name) }
    override public func visitPost(_ node: ActorDeclSyntax) { check(node.name) }
    override public func visitPost(_ node: StructDeclSyntax) { check(node.name) }
    override public func visitPost(_ node: EnumDeclSyntax) { check(node.name) }
    override public func visitPost(_ node: ProtocolDeclSyntax) { check(node.name) }
    override public func visitPost(_ node: TypeAliasDeclSyntax) { check(node.name) }
    override public func visitPost(_ node: AssociatedTypeDeclSyntax) { check(node.name) }
    override public func visitPost(_ node: FunctionDeclSyntax) { check(node.name) }
    override public func visitPost(_ node: MacroDeclSyntax) { check(node.name) }

    override public func visitPost(_ node: VariableDeclSyntax) {
        for binding in node.bindings {
            if let pattern = binding.pattern.as(IdentifierPatternSyntax.self) {
                check(pattern.identifier)
            }
        }
    }

    override public func visitPost(_ node: EnumCaseDeclSyntax) {
        for element in node.elements {
            check(element.name)
        }
    }
}

/// Port of upstream `no-reflect-get`.
///
/// Rejects key-value coding and selector dispatch in favor of typed property
/// access: `value(forKey:)`, `value(forKeyPath:)`, `setValue(_:forKey:)`,
/// `setValue(_:forKeyPath:)`, and `perform(_:)`.
public final class NoKeyValueCodingRule: SlopRule {
    override public class var id: String { "no-key-value-coding" }
    override public class var summary: String {
        "Rejects key-value coding and selector dispatch in favor of typed property access."
    }

    public required init(
        fileName: String,
        sourceText: String,
        converter: SourceLocationConverter
    ) {
        super.init(fileName: fileName, sourceText: sourceText, converter: converter)
    }

    public override func visitPost(_ node: FunctionCallExprSyntax) {
        guard let member = node.calledExpression.as(MemberAccessExprSyntax.self) else { return }
        let name = member.declName.baseName.text
        let labels = Set(node.arguments.compactMap { $0.label?.text })

        switch name {
        case "value" where labels == ["forKey"] || labels == ["forKeyPath"]:
            break
        case "setValue", "setNilValueForKey"
            where labels.contains("forKey") || labels.contains("forKeyPath"):
            break
        case "perform" where labels.isEmpty:
            break
        default:
            return
        }

        report(
            member.declName.baseName,
            message:
                "Key-value coding and selector dispatch bypass the type system; a typo or rename compiles and crashes at runtime. Call the typed accessor, or parse untrusted input at the boundary."
        )
    }
}

/// Port of upstream `no-runtime-typeof`.
///
/// Rejects runtime type sniffing such as `String(describing: type(of: x))`
/// used to branch on dynamic type. Model variants in the type system or decode
/// at the boundary.
public final class NoRuntimeTypeSniffingRule: SlopRule {
    override public class var id: String { "no-runtime-type-sniffing" }
    override public class var summary: String {
        "Rejects `String(describing: type(of:))` style runtime type sniffing."
    }

    public required init(
        fileName: String,
        sourceText: String,
        converter: SourceLocationConverter
    ) {
        super.init(fileName: fileName, sourceText: sourceText, converter: converter)
    }

    public override func visitPost(_ node: FunctionCallExprSyntax) {
        guard let called = node.calledExpression.as(DeclReferenceExprSyntax.self),
            called.baseName.text == "String"
        else { return }
        for argument in node.arguments {
            guard argument.label?.text == "describing" || argument.label?.text == "reflecting",
                let inner = argument.expression.as(FunctionCallExprSyntax.self),
                let innerCalled = inner.calledExpression.as(DeclReferenceExprSyntax.self),
                innerCalled.baseName.text == "type"
            else { continue }
            report(
                argument.expression,
                message:
                    "Runtime type sniffing turns dynamic type into a string contract. Model variants as an enum or protocol, or decode the real shape at the boundary."
            )
        }
    }
}
