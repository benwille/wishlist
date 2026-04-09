# The Holiday Wishlist

A family wishlist app where members can add items they want, browse each other's lists, and claim/purchase items as gifts — keeping it a surprise.

**Live at** [theholidaywishlist.com](https://theholidaywishlist.com)

## Stack

- **Next.js 16** (App Router) with React 19
- **Cloudflare Workers** via [@opennextjs/cloudflare](https://github.com/opennextjs/opennextjs-cloudflare)
- **D1** (SQLite) for the database
- **Drizzle ORM** for queries and migrations
- **Tailwind CSS 4** for styling
- **Separate email Worker** using Gmail SMTP via nodemailer (service binding, not HTTP)

## Features

- Magic link authentication (passwordless email login)
- Add, edit, and remove wishlist items with name, description, link, and price
- Browse other users' lists and claim/mark items as purchased
- Group-based visibility — users only see members of shared exchange groups
- Gift exchange with random assignments and exclusion rules
- Public share links (read-only, no auth required)
- PWA with offline fallback and install prompts
- Admin panel for user and group management
- Invite system with tokenized links
- Auto-formatted price display (prepends $, rounds to nearest dollar)

## Development

```bash
npm install
npm run dev           # local Next.js dev server
npm run preview       # local Cloudflare Workers preview
```

### Database

```bash
npm run db:generate        # generate migrations from schema changes
npm run db:migrate:local   # apply migrations locally
npm run db:migrate:remote  # apply migrations to production D1
```

### Deploy

Pushes to `main` trigger GitHub Actions CI/CD, which builds and deploys both the main app and the email worker. Manual deploy:

```bash
npm run deploy   # builds Next.js + deploys to Cloudflare Workers
```

Secrets needed in GitHub Actions: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

Worker secrets (set via `wrangler secret put`): `GMAIL_USER`, `GMAIL_APP_PASSWORD`

## Future Ideas

- **Weekly link checker** — Cron Trigger on a Cloudflare Worker that HEAD-requests all item links, flags 404s/5xx, and notifies the item owner
- **Push notifications** (Web Push API) — notify users when:
  - Someone claims or purchases an item on their list
  - They receive a gift exchange invite
  - A link on their list is broken
- **Admin delete user** — needs cascade deletes for sessions/magic_links (FK constraint issue)
- **Expiring share tokens** — e.g. 7-day TTL, regenerate each time, to limit exposure
