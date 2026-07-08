import SwiftUI
import UIKit

/// Gather — Netflix-inspired theme with dark & light palettes.
/// Every color is a dynamic UIColor resolving per interface style, so the whole
/// app follows the selected theme (system / light / dark) automatically.
/// Mirrors expo/constants/theme.ts.
nonisolated enum PaletteUI {
    private static func dyn(dark: UInt, light: UInt, darkAlpha: CGFloat = 1, lightAlpha: CGFloat = 1) -> UIColor {
        UIColor { trait in
            trait.userInterfaceStyle == .light
                ? UIColor(hex: light, alpha: lightAlpha)
                : UIColor(hex: dark, alpha: darkAlpha)
        }
    }

    // Canvas
    static let bg = dyn(dark: 0x141416, light: 0xF4F4F6)
    static let bgDeep = dyn(dark: 0x0B0B0C, light: 0xEAEAEE)
    static let bgElevated = dyn(dark: 0x1B1B1E, light: 0xFFFFFF)

    // Surfaces
    static let card = dyn(dark: 0x1C1C1F, light: 0xFFFFFF)
    static let cardElevated = dyn(dark: 0x242428, light: 0xFFFFFF)
    static let surface = dyn(dark: 0x2A2A2E, light: 0xEBEBEF)

    // Lines
    static let border = dyn(dark: 0x303034, light: 0xE2E2E8)
    static let borderStrong = dyn(dark: 0x3D3D42, light: 0xCFCFD7)

    // Text
    static let text = dyn(dark: 0xF7F7F7, light: 0x1B1B1F)
    static let textMuted = dyn(dark: 0x9B9BA2, light: 0x6E6E77)
    static let textFaint = dyn(dark: 0x67676E, light: 0x9B9BA3)

    // Brand
    static let primary = dyn(dark: 0xEF233C, light: 0xE11D33)
    static let primaryDark = dyn(dark: 0xC2182C, light: 0xB9152A)
    static let primarySoft = dyn(dark: 0xEF233C, light: 0xE11D33, darkAlpha: 0.14, lightAlpha: 0.10)

    // Highlights
    static let accent = dyn(dark: 0xCDBE57, light: 0xA8912E)
    static let accentSoft = dyn(dark: 0xCDBE57, light: 0xA8912E, darkAlpha: 0.16, lightAlpha: 0.14)

    // Status
    static let success = dyn(dark: 0x3DD27E, light: 0x1FA85D)
    static let successSoft = dyn(dark: 0x3DD27E, light: 0x1FA85D, darkAlpha: 0.14, lightAlpha: 0.12)
    static let warning = dyn(dark: 0xE8A13A, light: 0xC97F16)
    static let destructive = dyn(dark: 0xE63946, light: 0xD62839)
    static let destructiveSoft = dyn(dark: 0xE63946, light: 0xD62839, darkAlpha: 0.16, lightAlpha: 0.10)

    // Shadows — soften automatically on the light theme.
    static let shadowPoster = dyn(dark: 0x000000, light: 0x000000, darkAlpha: 0.55, lightAlpha: 0.16)
    static let shadowCard = dyn(dark: 0x000000, light: 0x000000, darkAlpha: 0.4, lightAlpha: 0.08)
    static let glow = dyn(dark: 0xEF233C, light: 0xE11D33, darkAlpha: 0.45, lightAlpha: 0.3)
}

nonisolated enum Palette {
    // Canvas
    static let bg = Color(uiColor: PaletteUI.bg)
    static let bgDeep = Color(uiColor: PaletteUI.bgDeep)
    static let bgElevated = Color(uiColor: PaletteUI.bgElevated)

    // Surfaces
    static let card = Color(uiColor: PaletteUI.card)
    static let cardElevated = Color(uiColor: PaletteUI.cardElevated)
    static let surface = Color(uiColor: PaletteUI.surface)

    // Lines
    static let border = Color(uiColor: PaletteUI.border)
    static let borderStrong = Color(uiColor: PaletteUI.borderStrong)

    // Text
    static let text = Color(uiColor: PaletteUI.text)
    static let textMuted = Color(uiColor: PaletteUI.textMuted)
    static let textFaint = Color(uiColor: PaletteUI.textFaint)

    // Brand
    static let primary = Color(uiColor: PaletteUI.primary)
    static let primaryDark = Color(uiColor: PaletteUI.primaryDark)
    static let primarySoft = Color(uiColor: PaletteUI.primarySoft)
    static let primaryFg = Color.white

    // Highlights
    static let accent = Color(uiColor: PaletteUI.accent)
    static let accentSoft = Color(uiColor: PaletteUI.accentSoft)
    static let goldFg = Color(hex: 0x1A1607)

    // Status
    static let success = Color(uiColor: PaletteUI.success)
    static let successSoft = Color(uiColor: PaletteUI.successSoft)
    static let warning = Color(uiColor: PaletteUI.warning)
    static let destructive = Color(uiColor: PaletteUI.destructive)
    static let destructiveSoft = Color(uiColor: PaletteUI.destructiveSoft)
}

nonisolated enum Radius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 10
    static let lg: CGFloat = 12
    static let xl: CGFloat = 16
    static let xxl: CGFloat = 22
    static let pill: CGFloat = 999
}

nonisolated enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 28
    static let xxxl: CGFloat = 40
}

// MARK: - Typography

nonisolated enum TypeStyle {
    case display, title, h2, h3, body, bodyMuted, label, caption, overline

    var size: CGFloat {
        switch self {
        case .display: return 33
        case .title: return 26
        case .h2: return 20
        case .h3: return 17
        case .body, .bodyMuted: return 15
        case .label: return 13
        case .caption: return 12
        case .overline: return 11
        }
    }

    var weight: Font.Weight {
        switch self {
        case .display, .title: return .heavy
        case .h2, .h3, .overline: return .bold
        case .label, .caption: return .semibold
        case .body, .bodyMuted: return .medium
        }
    }

    var tracking: CGFloat {
        switch self {
        case .display: return -0.8
        case .title: return -0.6
        case .h2: return -0.3
        case .h3: return -0.2
        case .overline: return 1.4
        case .caption: return 0.2
        default: return 0
        }
    }

    var color: Color {
        switch self {
        case .bodyMuted, .label: return Palette.textMuted
        case .caption, .overline: return Palette.textFaint
        default: return Palette.text
        }
    }

    var uppercased: Bool { self == .overline }
}

private struct TypeModifier: ViewModifier {
    let style: TypeStyle
    func body(content: Content) -> some View {
        content
            .font(.system(size: style.size, weight: style.weight))
            .tracking(style.tracking)
            .textCase(style.uppercased ? .uppercase : nil)
            .foregroundStyle(style.color)
    }
}

extension View {
    func gType(_ style: TypeStyle) -> some View { modifier(TypeModifier(style: style)) }
}

// MARK: - Shadows

extension View {
    func posterShadow() -> some View {
        shadow(color: Color(uiColor: PaletteUI.shadowPoster), radius: 22, x: 0, y: 16)
    }
    func cardShadow() -> some View {
        shadow(color: Color(uiColor: PaletteUI.shadowCard), radius: 13, x: 0, y: 8)
    }
    func glowShadow(_ active: Bool = true) -> some View {
        shadow(color: active ? Color(uiColor: PaletteUI.glow) : .clear, radius: active ? 18 : 0)
    }
}

// MARK: - Color hex

extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

extension UIColor {
    convenience init(hex: UInt, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}
