export const log = {
  // biome-ignore lint/suspicious/noConsole: server-side logging
  info: (...args: unknown[]) => console.info(...args),
  // biome-ignore lint/suspicious/noConsole: server-side logging
  warn: (...args: unknown[]) => console.warn(...args),
  // biome-ignore lint/suspicious/noConsole: server-side logging
  error: (...args: unknown[]) => console.error(...args),
}
