import { createMimeMessage } from "mimetext";

const FROM_ADDR = "noreply@theholidaywishlist.com";
const FROM_NAME = "Wishlist";

// Dynamic import that bypasses esbuild bundling
async function getEmailMessage() {
  // eslint-disable-next-line no-eval
  const mod = await eval('import("cloudflare:email")');
  return mod.EmailMessage;
}

export async function sendEmail(
  sendEmailBinding: SendEmail,
  to: string,
  subject: string,
  html: string
) {
  const msg = createMimeMessage();
  msg.setSender({ name: FROM_NAME, addr: FROM_ADDR });
  msg.setRecipient(to);
  msg.setSubject(subject);
  msg.addMessage({ contentType: "text/html", data: html });

  const raw = msg.asRaw();

  const EmailMessage = await getEmailMessage();
  const message = new EmailMessage(FROM_ADDR, to, raw);
  await sendEmailBinding.send(message);
}
