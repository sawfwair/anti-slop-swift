// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "anti-slop-swift",
    platforms: [.macOS(.v13)],
    products: [
        .executable(
            name: "anti-slop",
            targets: ["AntiSlop"]
        ),
        .library(
            name: "AntiSlopCore",
            targets: ["AntiSlopCore"]
        ),
    ],
    dependencies: [
        .package(
            url: "https://github.com/swiftlang/swift-syntax.git",
            // SwiftSyntax 600.0.1. Update deliberately after reviewing the new revision.
            revision: "0687f71944021d616d34d922343dcef086855920"
        ),
    ],
    targets: [
        .target(
            name: "AntiSlopCore",
            dependencies: [
                .product(name: "SwiftOperators", package: "swift-syntax"),
                .product(name: "SwiftParser", package: "swift-syntax"),
                .product(name: "SwiftSyntax", package: "swift-syntax"),
            ]
        ),
        .executableTarget(
            name: "AntiSlop",
            dependencies: ["AntiSlopCore"]
        ),
        .testTarget(
            name: "AntiSlopTests",
            dependencies: ["AntiSlopCore"]
        ),
    ]
)
