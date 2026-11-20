import SwiftUI
import WebKit

// A minimal shell: loads one mobile web page in a WKWebView and injects Resources/inject.js.
// - "lab": the script reports counts; the app prints them to stdout, which
//   `xcrun simctl launch --console-pty` captures in CI.
// - "holmes": the script's messages to its worker (config, classify). The app plays the
//   extension's background worker: one HTTP call per message to the API given with -api,
//   the answer goes back as the message's reply. Logs carry counts and status codes only.

@main
struct LabApp: App {
    var body: some Scene {
        WindowGroup { WebView().ignoresSafeArea() }
    }
}

func arg(_ name: String, _ fallback: String) -> String {
    let args = ProcessInfo.processInfo.arguments
    if let i = args.firstIndex(of: name), args.indices.contains(i + 1) { return args[i + 1] }
    return fallback
}

func log(_ line: String) {
    print(line)
    fflush(stdout)
}

final class Coordinator: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    let api = arg("-api", "http://127.0.0.1:8791")
    let token = arg("-token", "holmes-dev-local")

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        log("LAB_RESULT \(message.body)")
    }

    func userContentController(
        _ controller: WKUserContentController, didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        guard let text = message.body as? String, let data = text.data(using: .utf8),
              let msg = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let type = msg["type"] as? String
        else { return replyHandler(#"{"ok":false,"error":"network"}"#, nil) }
        Task {
            let reply: [String: Any]
            switch type {
            case "holmes/config": reply = await config()
            case "holmes/classify": reply = await classify(msg)
            default: reply = ["ok": true]
            }
            let out = (try? JSONSerialization.data(withJSONObject: reply)).flatMap { String(data: $0, encoding: .utf8) }
            await MainActor.run { replyHandler(out ?? #"{"ok":false,"error":"network"}"#, nil) }
        }
    }

    private func call(_ path: String, body: [String: Any]?) async -> (Int, Any?) {
        guard let url = URL(string: api + path) else { return (0, nil) }
        var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 4)
        if let body {
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        do {
            let (data, res) = try await URLSession.shared.data(for: req)
            let status = (res as? HTTPURLResponse)?.statusCode ?? 0
            return (status, try? JSONSerialization.jsonObject(with: data))
        } catch {
            return (0, nil)
        }
    }

    private func errorOf(_ status: Int) -> String {
        switch status {
        case 0: return "network"
        case 401: return "http_401"
        case 429: return "http_429"
        default: return "http_5xx"
        }
    }

    private func config() async -> [String: Any] {
        let (status, json) = await call("/v1/config", body: nil)
        log("LAB_NET config status=\(status)")
        if status == 200, let json { return ["ok": true, "config": json] }
        return ["ok": false, "error": errorOf(status)]
    }

    private func classify(_ msg: [String: Any]) async -> [String: Any] {
        // As the extension's worker: local-only fields (`_img`) never reach the server.
        let posts = (msg["posts"] as? [[String: Any]] ?? []).map { p -> [String: Any] in
            var q = p
            q.removeValue(forKey: "_img")
            return q
        }
        var body: [String: Any] = ["client": ["version": "0.1.0"], "posts": posts]
        if let c = msg["categories"] { body["categories"] = c }
        if let t = msg["spoiler_topics"] { body["spoiler_topics"] = t }
        let (status, json) = await call("/v1/classify", body: body)
        var sources: [String: Int] = [:]
        for r in ((json as? [String: Any])?["results"] as? [[String: Any]]) ?? [] {
            sources[r["source"] as? String ?? "?", default: 0] += 1
        }
        let tally = sources.keys.sorted().map { "\($0):\(sources[$0]!)" }.joined(separator: ",")
        log("LAB_NET classify status=\(status) posts=\(posts.count) sources=\(tally)")
        if status == 200, let json { return ["ok": true, "response": json] }
        return ["ok": false, "error": errorOf(status)]
    }
}

struct WebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "lab")
        controller.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "holmes")
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
        if let url = URL(string: arg("-url", "https://www.reddit.com/r/popular/")) { view.load(URLRequest(url: url)) }
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}
}
