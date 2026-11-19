# ios-webview-lab

A minimal iOS app (SwiftUI + WKWebView) that loads a mobile web page, injects a script, and
prints counts from it. Built and run in an iPhone simulator on a GitHub-hosted macOS runner,
so it needs no Mac.

- `project.yml`: XcodeGen spec (the Xcode project is generated in CI).
- `Sources/LabApp.swift`: the shell.
- `Resources/inject.js`: the injected probe (counts only).
- `.github/workflows/ios-sim.yml`: build, boot a simulator, run, print results.

Run it from the Actions tab ("ios-sim", Run workflow) with a page URL.
