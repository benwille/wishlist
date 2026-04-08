import { createMimeMessage } from "mimetext";

const FROM_ADDR = "noreply@theholidaywishlist.com";
const FROM_NAME = "Wishlist";

export async function sendEmail(
  sendEmailBinding: SendEmail,
  to: string,
  subject: string,
  html: string
) {
  const { EmailMessage } = await import("cloudflare:email");

  const msg = createMimeMessage();
  msg.setSender({ name: FROM_NAME, addr: FROM_ADDR });
  msg.setRecipient(to);
  msg.setSubject(subject);
  msg.addMessage({ contentType: "text/html", data: html });

  const raw = msg.asRaw();
  const message = new EmailMessage(FROM_ADDR, to, raw);
  await sendEmailBinding.send(message);
}
