//
//  GatherApp.swift
//  Gather
//
//  The cooperative memory-keeping app — native iOS client for the Gather backend.
//

import SwiftUI

@main
struct GatherApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var appState = AppState()
    @State private var toasts = ToastCenter()
    @State private var theme = ThemeStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .environment(toasts)
                .environment(theme)
                .preferredColorScheme(theme.mode.colorScheme)
                .tint(Palette.primary)
                .onOpenURL { url in
                    PushCoordinator.shared.handleDeepLink(url)
                }
        }
    }
}
