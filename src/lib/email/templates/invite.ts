export function inviteEmailHtml(firstName: string, inviteUrl: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
      <h2 style="color: #059669; margin: 0 0 16px;">You're invited to Wishlist</h2>
      <p>Hey ${firstName},</p>
      <p>You've been invited to join the family wishlist. Click the button below to set up your account.</p>
      <a href="${inviteUrl}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
        Set up my account
      </a>
      <p style="color: #78716c; font-size: 14px;">Or copy this link: ${inviteUrl}</p>
      <p style="color: #78716c; font-size: 14px;">This link expires in 7 days.</p>
    </div>
  `;
}
