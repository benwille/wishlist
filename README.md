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
- Mark items as received once a gift is in hand — kept as history in a collapsed section on My List, hidden from other users' views of your list
- Browse other users' lists and claim/mark items as purchased
- Group-based visibility — users only see members of shared exchange groups
- Gift exchange with random assignments and exclusion rules
- Public share links with guest claiming: no account or email required; browser recognition, optional emailed or copied private recovery links
- Claim history saved atomically by database triggers, including member/guest changes, received status, and deletion of claimed items
- Durable limits on rapid guest claims and recovery-email requests; owners can replace or disable shared links
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
npm test              # claim and public-list regressions (Node.js 22.16+)
```

### Database

```bash
npm run db:generate        # generate migrations from schema changes
npm run db:migrate:local   # apply migrations locally
npm run db:migrate:remote  # apply migrations to production D1
```

### Public gift claims

- Shared wishlist links remain reusable. Existing links continue working until the owner replaces or disables them. Newly generated links contain 256 random bits.
- Guest cookies last up to one year. Private recovery links last 90 days and can be reused across devices; they grant access only to that guest's claims on one wishlist.
- Email is optional. Opening the emailed link and continuing confirms the address for later recovery. Entering an address alone never grants access. Guests on different devices can combine their own claims by verifying the same email. No recovery emails are sent without a request.
- Email limits: one request per address per 60 seconds, three per address per hour, and ten per network per hour. These apply across public lists.
- New public claims: twelve per guest/member per ten-minute window and sixty per network per ten-minute window. Other public changes have a sixty-per-actor window; releasing a gift does not consume the new-claim allowance. Creating new guest identities is limited to twenty per network per wishlist per hour.
- Limits use atomic D1 counters with hashed keys; expired counters are removed during requests. Browser and recovery secrets are stored only as SHA-256 hashes. Shared pages are not indexed or cached, and private recovery pages include no third-party assets or analytics.
- SQL triggers in `0005_public_guest_claims.sql` record actual claim changes with before/after state in `claim_history`. Retries and rejected requests don't add history. History survives deletion of an item or user; it is not a full item-content backup. Claim state and its history commit or roll back together.
- Signed-in owners don't see claim status on their own shared page. Anonymous viewers can see availability, so this is surprise protection rather than a guarantee against deliberate peeking.

### Deploy

Pushes to `main` trigger GitHub Actions CI/CD, which tests, builds, applies pending D1 migrations, and deploys the main app, plus the email, push, and cron workers. Manual deploy:

```bash
npm run build:worker                        # build the main app
npm run db:migrate:remote                   # apply pending D1 migrations
npx wrangler deploy                        # publish the main app
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
- `item_received` / `item_unreceived` — owner marked a gift as received (or undid it). Received items are stamped with `received_at` and hidden from other users' views.

Future: page views, exchange run, magic-link login completion (needs server-side tracking).

## Future Ideas

- **Push Phase 2b (cron-based triggers)** — exchange reminders (1-week and 2-day nudges), low-list alerts ("only 2 unclaimed items left"), weekly link checker
- **Deep linking + auto-edit** — notification URLs that open a specific item in edit mode (needed by the link checker flow). Currently edit is client-side state with no URL, so we'd add `?highlight=123` support on My List.
- **GA4 — remaining coverage** — page views, exchange_run, and magic-link login completion (server-side)
- **Expiring share tokens** — e.g. 7-day TTL, regenerate each time, to limit exposure
- **Price checker** — flag items missing a price (deferred; scraping is unreliable)
- **View tracking on share links** — deferred as potentially surveillance-y in a family gift context

### Shared people, child profiles and exchanges

**Admin → People** is the permanent roster. Choose **Adult** or **Child** when creating a person. Child creation requires one or more linked adults and creates neither a login account nor group membership. Profiles are selected independently into each family/friend group's exchanges. Adults may be invited by email when created; existing login/email controls remain under **Adult Accounts**. The old `/admin/users` address redirects to People.

**Manage Group** has adult and kids sections for members and exclusions, optional exchange settings, and separate preview/save actions. Disabling an exchange preserves participants, exclusions and history while blocking new draws on the server. Each exclusion is bidirectional and belongs to one group. Adult draws avoid the previous two years; kids draws avoid only the immediately previous year. Saved replacements require confirmation and are atomic. Gift Exchange groups only your own and your explicitly linked children’s assignments by year. View all assignments opens the full group's adult/kids history. A saved draw shows its saved-year status and an explicit Redraw action; replacement still requires confirmation. Assignment history shows both draws within each year. The old nested kids-management address redirects to the unified group page.

**My Profiles** exposes only the signed-in adult's profile and children explicitly linked to that adult. Linked adults may edit names, but only global administrators can create profiles or change guardian links in this release. Sharing an exchange group grants no profile-management rights. Ordinary users receive no global adult directory or other people's guardian links. Parent-created children, guardian invitations, delegated group organizers and child-to-adult conversion remain future work. The permanent person identity and existing history support that future conversion, but changing type is deliberately unavailable now.

Migration `0007_shared_person_profiles.sql` backfills canonical `people`, `person_guardians`, and `group_people` records. Accounts stay in `users`; historical account/child identifiers remain compatibility references for existing links, claims and draws. Database bridges synchronize legacy name, membership and guardian mutations with permanent profiles. Wishlist rows are linked to their permanent person. Existing children are mapped without colliding with adult IDs. No logins, claims or saved assignments are recreated. Migration assertions abort an inconsistent backfill. Preserve these bridge triggers during future schema changes; remove legacy adapters only after their historical references have a separately validated migration.

`npm test` covers populated migration preservation, identity reuse, guardian access/revocation, directory privacy, settings, draw replacement isolation, claims and public recovery. The optional `tests/kids.browser.mjs` checks Child creation, four guardian links, profile reuse across two groups, independent kids draw save and scoped parent access against local synthetic fixtures. It accepts `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, and `KIDS_PREVIEW_ORIGIN` and requires an existing Playwright Chromium runtime. Seed a fresh isolated local database with `tests/fixtures/kids-preview.sql`; never seed production with these records. `scripts/verify-person-profiles.sql` reports aggregate mapping checks after migration in CI without printing names, email addresses, credentials or draw contents.


### Group membership and exchange participation

**Manage Group → Group members** has separate **Adults** and **Kids** sections, each with its own add picker and compact cards. Cards use one column below 480 CSS pixels and two columns from 480 pixels, including narrow portrait layouts. Select an existing profile and click **Add adult** or **Add child**. New members start with **In the exchange** unchecked. The current admin Kids picker lists all active child profiles; creating/linking a child does not enroll them in a group or draw automatically. Check it to enter that adult or child in their corresponding draw; uncheck it to leave them in the group without entering future draws. Adult members continue sharing wishlists either way. **Remove** is a separate confirmed action that removes group access and participation while preserving the person's profile, guardian links and saved draw history. Participation changes do not redraw or change saved assignments.

Migration `0009_group_roster.sql` preserves current participants and wishlist-only family members in a persistent roster. Existing profile bridges remain, and compatibility triggers keep older membership endpoints working. The checkbox handler changes participation and retains membership atomically. Member counts include everyone, while exclusions and draw counts use participants only.

`tests/family-members.browser.mjs` checks responsive columns, checkbox persistence, reciprocal list access, unrelated-family privacy, removal and revoked direct links. `tests/kids.browser.mjs` retains coverage of child profiles, exclusions and independent draws through the new roster. Both use local synthetic fixtures and the documented browser environment variables.

The current site admin role can see all active wishlists across groups. Future work includes invitations with acceptance, adult group creation, group-scoped organizers and an explicit super-admin mode. Those permissions changes are not included in this UI rebuild.
