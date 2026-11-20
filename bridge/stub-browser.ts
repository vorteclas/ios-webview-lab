// Stands in for "wxt/browser" in the iOS shell: there is no extension storage there. Anything
// that reaches it fails loudly instead of silently doing nothing.
const missing = (): never => {
  throw new Error("extension API not available in the iOS shell");
};
export const browser = new Proxy({}, { get: missing });
