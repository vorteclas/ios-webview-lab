import SwiftUI
import WebKit

// A minimal shell: loads one mobile web page in a WKWebView and injects Resources/inject.js.
// The script reports counts through the "lab" message handler; the app prints them to stdout,
// which `xcrun simctl launch --console-pty` captures in CI.

@main
struct LabApp: App {
    var body: some Scene {
        WindowGroup { WebView().ignoresSafeArea() }
    }
}

final class Coordinator: NSObject, WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        print("LAB_RESULT \(message.body)")
        fflush(stdout)
    }
}

struct WebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "lab")
        if let url = Bundle.main.url(forResource: "inject", withExtension: "js"),
           let source = try? String(contentsOf: url, encoding: .utf8) {
            controller.addUserScript(
                WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        let config = WKWebViewConfiguration()
        config.userContentController = controller
        let view = WKWebView(frame: .zero, configuration: config)
        // WKWebView's default user agent has no "Version/... Safari/..." token, and some sites
        // serve a different page to it. Present as iPhone Safari.
        view.customUserAgent =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"

        let args = ProcessInfo.processInfo.arguments
        var target = "https://www.reddit.com/r/popular/"
        if let i = args.firstIndex(of: "-url"), args.indices.contains(i + 1) { target = args[i + 1] }
        if let url = URL(string: target) { view.load(URLRequest(url: url)) }
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}
}
