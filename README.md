# ios-webview-lab

A minimal iOS app (SwiftUI + WKWebView) that loads a mobile web page, injects a script, and
prints counts from it. Built and run in an iPhone simulator on a GitHub-hosted macOS runner,
so it needs no Mac.

- `project.yml`: XcodeGen spec (the Xcode project is generated in CI).
- `Sources/LabApp.swift`: the shell.
- `bridge/holmes-pipeline.ts`: in the default mode, CI fetches a private site adapter, client
  pipeline and API with a read-only token, bundles the first two with this bridge into
  `Resources/inject.js`, runs the API on the runner (fake model, no key) and deletes the
  checkout. Neither the private code nor the bundle is committed or uploaded.
- `Sources/LabApp.swift` also plays the extension's worker: the page's config and classify
  messages become HTTP calls from the app (`-api`), logged as counts and status codes.
- `probe/inject-probe.js`: standalone probe (mode `probe`).
- `fixtures/reddit-feed.html`: synthetic feed with invented posts, served on the runner.
- `.github/workflows/ios-sim.yml`: build, boot a simulator, run, print results.

Run it from the Actions tab ("ios-sim", Run workflow) with a page URL.
