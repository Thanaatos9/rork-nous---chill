import SwiftUI

/// User preference: follow the phone, or force light/dark.
/// Mirrors providers/theme.tsx (persisted, defaults to system).
enum ThemeMode: String, CaseIterable {
    case system, light, dark

    var label: String {
        switch self {
        case .system: return "Système"
        case .light: return "Clair"
        case .dark: return "Sombre"
        }
    }

    var systemIcon: String {
        switch self {
        case .system: return "iphone"
        case .light: return "sun.max.fill"
        case .dark: return "moon.fill"
        }
    }

    /// nil lets SwiftUI follow the phone's appearance.
    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

@Observable
final class ThemeStore {
    private static let storageKey = "gather.themeMode.v1"

    var mode: ThemeMode {
        didSet { UserDefaults.standard.set(mode.rawValue, forKey: Self.storageKey) }
    }

    init() {
        let raw = UserDefaults.standard.string(forKey: Self.storageKey)
        mode = raw.flatMap(ThemeMode.init(rawValue:)) ?? .system
    }
}
