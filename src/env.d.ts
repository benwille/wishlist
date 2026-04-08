declare global {
  interface CloudflareEnv {
    DB: D1Database;
    EMAIL_WORKER: Fetcher;
  }
}

export {};
