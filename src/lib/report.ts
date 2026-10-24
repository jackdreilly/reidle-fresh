// First-load stub: the reporter itself (errors.ts) loads only when something actually breaks.
export const report = (e: unknown, info?: Record<string, unknown>) =>
  void import("./errors").then((m) => m.reportError(e, info), () => {});

addEventListener("error", (e) => report(e.error ?? e.message, { src: e.filename, line: e.lineno }));
addEventListener("unhandledrejection", (e) => report(e.reason));
