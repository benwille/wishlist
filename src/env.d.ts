declare global {
  interface CloudflareEnv {
    DB: D1Database;
    SEND_EMAIL: SendEmail;
  }
}

export {};
