# ON AIR — The TBPN Tier Room

A responsive, public community app for ranking livestream moments. Built with React, Vinext, Cloudflare Workers, D1, and R2 through Sites.

## Source and live app

- Source: https://github.com/moonshineaitech/onair-tbpn-tier-room
- Live app: https://onair-tbpn-tier-room.vercel.app/tier-list

The repository contains the UI, Worker API, database schema and migrations, upload handling, test scripts, and Vercel gateway with its episode collector. Hosted app updates publish through Sites; the Vercel gateway forwards to that publication. Pushing to GitHub alone does not deploy the app. Runtime secrets, user data, uploaded images, and local tool state are excluded.

## Using the app

Anyone can browse. Open /tier-list to join a shared S–F board instantly. A free browser computation check runs automatically in the background. Dragging saves changes to the live room; My board autosaves separate personal scores from 0–100. Visitors may submit up to three new moments per room. Images (PNG, JPEG, WebP, up to 2 MB) and episode timestamps are supported. All new moments wait for moderator approval. Live changes reach connected visitors through server-sent events in about one second. Community scores average each visitor’s latest saved personal score once per moment, with a 15-second fallback refresh when needed.

Anonymous boards are bound to an HttpOnly visitor cookie for seven days. Sign in with ChatGPT for account-based boards across devices. Anonymous and signed-in identities are separate; save again after signing in to associate a board with your account. Visitors sharing an IP address share submission limits. The warm-up room contains clearly labeled sample moments, not claims about an actual episode.

## Admin

Select Admin in the footer and sign in with ChatGPT as ryan@moonshineai.com. Server-side email authorization protects all moderation routes. Admins can:

- Approve, reject, hide, or restore moments; review uploaded images and reports.
- Manage blocked words and phrases, with normalized matching for common obfuscations.
- Change the per-room submission limit (1–10).
- Create episode rooms with a YouTube livestream or video URL, enabling inline video, timestamp playback, and live chat.
- Close or reopen rooms and review the moderation activity log.

YouTube live chat works for eligible live broadcasts; embedding remains subject to YouTube’s video/channel settings. This app does not import or scrape YouTube chat.

## Verification

The deployed app works without visitor API keys. Default abuse controls are an expiring, single-use computational browser check, HttpOnly sessions, network request limits, submission quotas, and moderator approval. This browser check is not a proof that a visitor is human and is not Cloudflare Turnstile.

Optional production Turnstile support is implemented with server-side Siteverify validation and hostname checks. Setting both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY in Sites runtime settings switches verification to Turnstile. Real widget keys are required; no testing keys or pretend verification are used.

Runtime environment names are documented in .env.example. SESSION_PEPPER and ADMIN_EMAILS are configured in hosted runtime settings. Keep secrets outside source. The untracked .dev.vars file used for local QA is never included in deployment or source archives.

## Development

Node 22.13+ is required. Use the Sites project setup/install/build/publish helpers where available. npm run dev serves on port 5173. npm run build produces the Worker and client assets. The hosting manifest declares D1 as DB and R2 as BUCKET.

Drizzle migrations in drizzle/ are schema-only and applied by Sites during publication. Local preview migrations use the generated dist/server/wrangler.json configuration and .wrangler/state.

The local end-to-end test script scripts/test-room.mjs exercises 26 checks against a disposable local database and creates a QA room. It requires the starter’s local mock sign-in and a local ADMIN_EMAILS value including seedy@sites.test. This local identity is not a production admin.

## Data and safety controls

Votes and boards are stored in D1; approved and pending images are stored in R2. Pending images are accessible only to an admin. Public API responses omit visitor identifiers and network hashes. Mutations validate same-origin requests, inputs, room status, roles, and quotas. Word filtering supplements manual review and cannot guarantee detection of all harmful text or image content.

This is an independent fan app and is not affiliated with TBPN, YouTube, or a16z. The TBPN preview graphic is sourced from the official TBPN website; the official show links are https://www.tbpn.com/ and https://youtube.com/@tbpnlive.

## Live board update

The dedicated /tier-list route now opens a full-width shared board with S, A, B, C, D, F, and Unranked rows. Legacy root links retain their room parameter. Browser checks run automatically in the background. Pointer-based dragging supports mouse and touch, with lift previews, highlighted drop targets, insertion markers, animated card movement, and keyboard alternatives. Shared moves persist immediately; My board autosaves personal votes separately.

Server-sent events watch persisted room revisions at one-second intervals, with reconnection and a 15-second fallback refresh. Every editor uses the same durable D1 placements. Per-moment versions reject stale simultaneous edits with HTTP 409 rather than silently overwriting them. Moves of different moments remain independent. Active verified sessions send presence heartbeats; no invented viewer counts are displayed. The live stream is in an optional drawer so the tier list uses the entire available page width.

scripts/test-live-board.mjs adds 18 local checks for F/Unranked behavior, two-visitor synchronization, event delivery, conflict protection, sorting, presence, private/public board separation, closed rooms, and route compatibility. The original 26 moderation and persistence checks remain applicable.

## Compact board styling

The board uses classic red-to-green tier labels on a dark background. Each card is a horizontal panel with a square thumbnail at its left. The app sizes all seven rows to the viewport, with a maximum board height of 560px. Crowded rows can scroll horizontally while every tier stays visible. Layout checks at 1280x720, 1280x600, and a 480x844 narrow viewport confirmed no page overflow and square thumbnails. Compact-card dragging was verified in the browser.


## Newsletter and chat

Admin → Newsletter loads the latest official TBPN Substack RSS issue or parses pasted run-of-show notes. Review and edit up to 30 topic titles and categories before publishing to Unranked. Reimports skip duplicate titles and source identifiers. Images and spontaneous moments remain editable directly on the board.

Chat opens separate Room chat and YouTube tabs. Room messages persist in D1 and update through the room event stream. The existing blocked-word rules apply; messages are limited to 500 characters and rate-limited. Admin → Chat assigns moderators by their verified account email and reverses active mutes. Moderators can hide messages and mute participants for 5 minutes, 1 hour, or 24 hours. YouTube chat uses the official live-chat embed and YouTube's own account and moderation permissions. Mobile web users open YouTube chat through a link because its embedded chat is not supported on mobile web.

Automatic stream discovery prefers the current official live broadcast, otherwise the most recent full replay. It checks every 15 seconds around the weekday 11 AM Pacific / 1 PM Central start window, with daylight-saving-aware time zones, and every minute outside the window. The click-open volume popover stays open until an outside click or Escape.

## Vercel production entry point

The public entry point is https://onair-tbpn-tier-room.vercel.app/tier-list. `vercel-gateway/` is a Node.js Vercel gateway; the existing Sites Worker continues to serve the application, D1 data, R2 images, and event streams. Deploy app changes through Sites; deploy gateway changes from its own folder through Vercel. The stable Vercel alias proxies the latest deployed application without copying user data.

Configure ONAIR_BACKEND_ORIGIN, ONAIR_PUBLIC_ORIGIN, and the secret ONAIR_GATEWAY_SECRET on Vercel. Configure the same secret and the fixed ONAIR_GATEWAY_ORIGIN callback on the backend. Keep all secret values in the platforms' runtime settings. Gateway requests are HMAC-signed; it strips untrusted identity headers. ChatGPT sign-in stays managed by Sites and hands off through a short-lived, single-use PKCE code into a Secure, HttpOnly session cookie. Account emails come only from verified managed identity.

`scripts/test-chat-newsletter.mjs` exercises 24 newsletter, persistence, chat, and moderation checks locally. `scripts/test-gateway-auth.mjs` exercises nine local authentication and signature checks. These local scripts require the ignored test env configuration and do not grant production access.


## Personal publishing and audience feedback

Every episode has standardized Live board, My board, Community pulse, and Posted boards views. Viewers rank the shared approved segment catalog on their personal board. Those saves feed live per-segment tier distributions and mean scores without changing the manually shared live placements. The seven rows stay visible; reaction and S/F summaries fit on compact cards.

Open a moment to like it, add emoji reactions, or up/down vote. Live placements also have separate reactions. Posted boards and individual rankings inside them can receive reactions. Up/down votes are mutually exclusive, all writes are idempotent, and verified visitor/account identities are counted once per reaction. Anonymous identities use the existing seven-day cookie; this does not establish unique human identity.

New personal boards default to the visibly disclosed auto-post setting. Existing boards retain auto-post off on migration. Board settings let visitors choose a public display name and title, disable auto-post, or withdraw a post. The last saved nonempty board is snapshotted when a show ends, even if the browser is closed. A manual post/update works during or after the show. Later draft edits leave published snapshots unchanged until updated. Public posts omit account emails and visitor IDs. Owners cannot bypass a moderator-hidden post.

The official stream resolver creates a separate episode tab for each detected broadcast ID. Fresh offline observations at least two minutes apart finalize an active episode. Stale/failed upstream checks never finalize it. A confirmed full replay can create an already-ended episode on first visit; discovery time is not claimed as the broadcast date. The public `/api/lifecycle` endpoint performs only this bounded, source-verified update, and returns check status. Open players call the same operation through `/api/stream`; a Vercel queue collector calls it every two to four minutes on weekdays from 12:50 PM to 8 PM Central while viewers are away. Admin Insights provides a confirmed manual finish control if YouTube metadata is delayed. Closing a manual room also finalizes its opted-in boards. Shared moves close with the room; personal ranking and posting remain available after closure.

Admin → Insights (also the desktop Insights button) provides per-segment tier counts, S/A and D/F percentages, mean scores, rating coverage, polarization, and reaction totals. CSV exports contain aggregate metrics and escape spreadsheet formula prefixes. Suggestions require at least five ratings and are labeled as next tests; they do not claim measured conversions, retention, or representative audience sentiment. Unranked segments are excluded from scores, with coverage shown separately.

`scripts/test-community.mjs` covers personal isolation, reaction semantics, snapshots, end-of-show posting, opt-outs, moderation, and insights against local D1. `scripts/test-episode-lifecycle.mjs` exercises the production lifecycle logic against an in-memory SQLite fixture, including a closed browser, stale upstream data, duplicate checks, and separate episodes.


The background collector uses `@vercel/queue` in `vercel-gateway/`, with a durable, delayed message for the next check. Idempotency keys prevent duplicate chains; failed source reads leave episode state unchanged and the next check still runs. `nextCollectorTick` accounts for weekends and Central daylight saving time. The collector was bootstrapped through the official SDK using the project's production runtime identity in the Vercel CLI. Each successful check queues the next one, including across weekends; the initial chain does not depend on visitors. No operator credential needs to be sent to a public initializer. The hourly-only Sites task scheduler is not used. Queue logs report check timestamps and counts without visitor data.


Live broadcasts open at the live edge rather than requesting a zero-second DVR offset. Once playback metadata is ready, the player seeks to the current end with a three-second buffer. Go live returns a rewound or paused viewer to the current broadcast; explicit moment timestamps and replay playback keep their requested positions. Today’s episode topics are stored as board data, separate from source code.


## Image cards and Unranked tray

The Unranked catalog wraps into a responsive grid with a visible available count and independent vertical scrolling. All six ranking tiers stay on screen. A 1280 by 720 browser shows the twenty-card catalog at once; a 480 by 844 viewport shows ten cards before scrolling. The tray supports mouse dragging, keyboard scrolling, and a separate touch drag grip so swiping the cards can scroll the catalog. Source and license credits for the episode images are recorded in each moment’s context and in docs/episode-image-credits.md. Uploaded image records remain editable through Admin.
