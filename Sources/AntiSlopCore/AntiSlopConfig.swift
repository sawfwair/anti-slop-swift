import Foundation

/// Persistent per-repository configuration.
///
/// The linter auto-discovers `.anti-slop.json` by walking up from the current
/// working directory, so teams can commit one config instead of repeating
/// `--disable` flags:
///
/// ```json
/// { "disabled": ["no-shape-in-symbol-names", "no-key-value-coding"] }
/// ```
///
/// Unknown keys are ignored; malformed JSON is reported as an error rather
/// than silently ignored. CLI `--disable` flags are additive on top of this.
public enum AntiSlopConfig {
    public static let fileName = ".anti-slop.json"

    /// Walk up from `directory` (inclusive) to the filesystem root looking for
    /// a config file. Returns the first match, or nil.
    public static func findConfigFile(startingAt directory: String) -> String? {
        var current = URL(fileURLWithPath: directory).standardizedFileURL
        while true {
            let candidate = current.appendingPathComponent(fileName).path
            if FileManager.default.fileExists(atPath: candidate) {
                return candidate
            }
            if current.path == "/" {
                return nil
            }
            current.deleteLastPathComponent()
        }
    }

    /// Parse a config file into its disabled-rule set.
    public static func loadDisabledRules(from configFile: String) throws -> Set<String> {
        let data = try Data(contentsOf: URL(fileURLWithPath: configFile))
        let decoded = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        guard let object = decoded as? [String: Any] else {
            throw ConfigError(
                message:
                    "\(configFile): expected top-level object with a \"disabled\" array of rule ids."
            )
        }
        // Absent key means nothing disabled; present-but-wrong-type is an error.
        if let disabled = object["disabled"] {
            guard let ruleIDs = disabled as? [String] else {
                throw ConfigError(
                    message:
                        "\(configFile): \"disabled\" must be an array of rule id strings."
                )
            }
            return Set(ruleIDs)
        }
        return []
    }

    /// Convenience: resolve the disabled set for a run — explicit
    /// `--config=` file, otherwise auto-discovery from `directory`, otherwise
    /// empty.
    public static func resolve(
        explicitConfigPath: String?,
        startingAt directory: String
    ) throws -> Set<String> {
        let path: String?
        if let explicitConfigPath {
            path = explicitConfigPath
        } else {
            path = findConfigFile(startingAt: directory)
        }
        guard let path else { return [] }
        do {
            return try loadDisabledRules(from: path)
        } catch let error as ConfigError {
            throw error
        } catch {
            throw ConfigError(message: "\(path): unreadable (\(error.localizedDescription)).")
        }
    }
}

public struct ConfigError: Error, CustomStringConvertible {
    public let message: String
    public init(message: String) {
        self.message = message
    }
    public var description: String { message }
}
