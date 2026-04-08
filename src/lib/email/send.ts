const INTERNAL_SECRET = "wishlist-email-internal-2026";

export async function sendEmail(
  emailWorker: Fetcher,
  to: string,
  subject: string,
  html: string
) {
  const res = await emailWorker.fetch("https://email-worker/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Auth": INTERNAL_SECRET,
    },
    body: JSON.stringify({ to, subject, html }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`Email send failed: ${data.error || res.statusText}`);
  }
}
