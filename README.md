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
- **Separate push Worker** using web-push for Web Push notifications (service binding, not HTTP)
- **Google Analytics 4** for minimal event tracking (notification clicks and variants)

## Features

- Magic link authentication (passwordless email login)
- Add, edit, and remove wishlist items with name, description, link, and price
- Browse other users' lists and claim/mark items as purchased
- Group-based visibility — users only see members of shared exchange groups
- Gift exchange with random assignments and exclusion rules
- Public share links (read-only, no auth required)
- PWA with offline fallback and install prompts
- **Web Push notifications** with per-device subscriptions, in-app opt-in toggle, and admin broadcast tool
- Automatic notifications for: item claimed (7 randomly-selected playful variants), exchange assignments (giver + receiver), new group member
- Admin panel for user and group management
- **Admin user management** — invite new users, resend pending invites, deactivate, or delete (with safety checks that block delete when the user has exchange history or claimed items)
- Invite system with tokenized links (7-day expiry, resendable)
- Back navigation on list and exchange pages
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

Pushes to `main` trigger GitHub Actions CI/CD, which builds and deploys the main app, the email worker, and the push worker. Manual deploy:

```bash
npm run deploy                              # main app
cd email-worker && npx wrangler deploy      # email worker
cd push-worker && npx wrangler deploy       # push worker
```

Secrets needed in GitHub Actions: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

Worker secrets (set via `wrangler secret put`):
- Email worker: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- Push worker: `VAPID_PRIVATE_KEY` (public key is a plain var in `push-worker/wrangler.toml`)

### Push Notifications

- VAPID keys identify the app to browser push services. Generated once via `npx web-push generate-vapid-keys`.
- `push_subscriptions` table stores per-user, per-device subscriptions. One user can have many (phone + laptop).
- Notification URLs are tagged with `?n_type=...&n_variant=...` params so click events can be attributed in GA4. `NotificationClickTracker` strips the params after firing the event.
- Copy lives in `src/lib/push/copy.ts` — that file is the single source of truth for all notification text. Variant slugs (`admirer`, `scheming`, etc.) are reported in GA4.
- The service worker uses `postMessage` to tell the running app to navigate via Next.js router — `client.navigate()` is unreliable on backgrounded PWAs.

### Analytics

Minimal GA4 setup (measurement ID `G-W2PJW4MVEX`). Currently tracked:
- `notification_clicked` — push opened. Params: `type`, `variant`.
- `login` — successful password login. Params: `method` (`password`).
- `magic_link_requested` — user submitted the email-me-a-link form.
- `invite_accepted` — new user set a password and landed in the app.
- `logout` — user clicked Log out (fires on form submit).
- `item_added` / `item_edited` — list CRUD. Params: `has_link`, `has_price`.
- `item_deleted` — item removed from a list.
- `item_claimed` / `item_unclaimed` / `item_purchased` — claim state changes.

Future: page views, exchange run, magic-link login completion (needs server-side tracking).

## Future Ideas

- **Push Phase 2b (cron-based triggers)** — exchange reminders (1-week and 2-day nudges), low-list alerts ("only 2 unclaimed items left"), weekly link checker
- **Deep linking + auto-edit** — notification URLs that open a specific item in edit mode (needed by the link checker flow). Currently edit is client-side state with no URL, so we'd add `?highlight=123` support on My List.
- **GA4 — remaining coverage** — page views, exchange_run, and magic-link login completion (server-side)
- **Expiring share tokens** — e.g. 7-day TTL, regenerate each time, to limit exposure
- **Price checker** — flag items missing a price (deferred; scraping is unreliable)
- **View tracking on share links** — deferred as potentially surveillance-y in a family gift context
