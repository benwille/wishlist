import nodemailer from "nodemailer";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const authHeader = request.headers.get("X-Internal-Auth");
    if (authHeader !== env.INTERNAL_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const { to, subject, html } = await request.json();

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: env.GMAIL_USER,
          pass: env.GMAIL_APP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: `"Wishlist" <${env.GMAIL_USER}>`,
        to,
        subject,
        html,
      });

      return Response.json({ ok: true });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
};
