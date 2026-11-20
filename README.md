# ios-webview-lab

A minimal iOS app (SwiftUI + WKWebView) that loads a mobile web page, injects a script, and
prints counts from it. Built and run in an iPhone simulator on a GitHub-hosted macOS runner,
so it needs no Mac.

- `project.yml`: XcodeGen spec (the Xcode project is generated in CI).
- `Sources/LabApp.swift`: the shell.
- `bridge/holmes-bridge.ts`: in the default mode, CI fetches a private site adapter with a
  read-only token, bundles it with this bridge into `Resources/inject.js` and deletes the
  checkout. Neither the private code nor the bundle is committed or uploaded.
- `probe/inject-probe.js`: standalone probe (mode `probe`).
- `fixtures/reddit-feed.html`: synthetic feed with invented posts, served on the runner.
- `.github/workflows/ios-sim.yml`: build, boot a simulator, run, print results.

Run it from the Actions tab ("ios-sim", Run workflow) with a page URL.
