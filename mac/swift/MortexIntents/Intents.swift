// mORTEX : actions pour l'app Raccourcis, Siri et Spotlight (extension App Intents intégrée à
// mORTEX.app). Chaque action ouvre un lien mortex://<action> que mORTEX exécute sans montrer sa
// fenêtre (main/src/macos/protocol.ts, extension mac_activity).
import AppIntents
import AppKit
import ExtensionFoundation

@main
struct MortexIntentsExtension: AppIntentsExtension {}

enum Mortex {
    static func run(_ action: String, _ query: [URLQueryItem] = []) async throws {
        var components = URLComponents()
        components.scheme = "mortex"
        components.host = action
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else { return }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = false
        _ = try await NSWorkspace.shared.open(url, configuration: configuration)
    }
}

struct LaunchGameIntent: AppIntent {
    static let title: LocalizedStringResource = "Launch the game"
    static let description = IntentDescription("Launches the game managed by mORTEX, as its Launch button does.")
    func perform() async throws -> some IntentResult {
        try await Mortex.run("launch")
        return .result()
    }
}

struct DeployIntent: AppIntent {
    static let title: LocalizedStringResource = "Deploy mods"
    static let description = IntentDescription("Deploys the enabled mods into the game.")
    func perform() async throws -> some IntentResult {
        try await Mortex.run("deploy")
        return .result()
    }
}

struct SortPluginsIntent: AppIntent {
    static let title: LocalizedStringResource = "Sort plugins with LOOT"
    static let description = IntentDescription("Sorts the load order with LOOT.")
    func perform() async throws -> some IntentResult {
        try await Mortex.run("sort")
        return .result()
    }
}

struct TakeSnapshotIntent: AppIntent {
    static let title: LocalizedStringResource = "Take a Time Machine snapshot"
    static let description = IntentDescription("Takes a Time Machine snapshot of Data, the mods, the load order and the INI files.")
    func perform() async throws -> some IntentResult {
        try await Mortex.run("snapshot")
        return .result()
    }
}

struct SwitchProfileIntent: AppIntent {
    static let title: LocalizedStringResource = "Switch profile"
    static let description = IntentDescription("Switches to the mORTEX profile with this name.")

    @Parameter(title: "Profile")
    var profile: String

    static var parameterSummary: some ParameterSummary {
        Summary("Switch to profile \(\.$profile)")
    }

    func perform() async throws -> some IntentResult {
        try await Mortex.run("profile", [URLQueryItem(name: "name", value: profile)])
        return .result()
    }
}

struct MortexShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LaunchGameIntent(),
            phrases: ["Launch the game with \(.applicationName)", "Play with \(.applicationName)"],
            shortTitle: "Launch the game",
            systemImageName: "play.fill"
        )
        AppShortcut(
            intent: DeployIntent(),
            phrases: ["Deploy mods with \(.applicationName)"],
            shortTitle: "Deploy mods",
            systemImageName: "arrow.down.to.line"
        )
        AppShortcut(
            intent: SortPluginsIntent(),
            phrases: ["Sort plugins with \(.applicationName)"],
            shortTitle: "Sort plugins",
            systemImageName: "list.number"
        )
        AppShortcut(
            intent: TakeSnapshotIntent(),
            phrases: ["Take a snapshot with \(.applicationName)"],
            shortTitle: "Take a snapshot",
            systemImageName: "clock.arrow.circlepath"
        )
    }
}
