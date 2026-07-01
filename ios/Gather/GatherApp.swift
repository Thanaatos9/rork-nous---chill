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

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .environment(toasts)
                .preferredColorScheme(.dark)
                .tint(Palette.primary)
                .onOpenURL { url in
                    PushCoordinator.shared.handleDeepLink(url)
                }
        }
    }
}
