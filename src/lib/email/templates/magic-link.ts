export function magicLinkEmailHtml(firstName: string, loginUrl: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
      <h2 style="color: #059669; margin: 0 0 16px;">Your login link</h2>
      <p>Hey ${firstName},</p>
      <p>Click the button below to sign in to Wishlist.</p>
      <a href="${loginUrl}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
        Sign in
      </a>
      <p style="color: #78716c; font-size: 14px;">Or copy this link: ${loginUrl}</p>
      <p style="color: #78716c; font-size: 14px;">This link expires in 15 minutes. If you didn't request this, you can ignore it.</p>
    </div>
  `;
}
