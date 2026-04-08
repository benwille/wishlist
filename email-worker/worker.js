import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Simple auth check — only accept requests from our service binding
    const authHeader = request.headers.get("X-Internal-Auth");
    if (authHeader !== env.INTERNAL_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const { to, subject, html, from } = await request.json();

      const fromAddr = from || "noreply@theholidaywishlist.com";
      const fromName = "Wishlist";

      const msg = createMimeMessage();
      msg.setSender({ name: fromName, addr: fromAddr });
      msg.setRecipient(to);
      msg.setSubject(subject);
      msg.addMessage({ contentType: "text/html", data: html });

      const raw = msg.asRaw();
      const message = new EmailMessage(fromAddr, to, raw);
      await env.SEND_EMAIL.send(message);

      return Response.json({ ok: true });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
};
