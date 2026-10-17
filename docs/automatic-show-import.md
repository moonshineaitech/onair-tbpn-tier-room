# Automatic TBPN show import

The existing Vercel Queue collector calls the public `GET /api/lifecycle` on the Sites backend every 2–4 minutes on weekdays, 12:50 PM–8 PM America/Chicago. Open players also call the same lifecycle through `/api/stream`. The collector runs without a signed-in browser, uses only public sources, and needs no newsletter, YouTube, or image API key. Routine collection changes D1/R2 records and does not redeploy code.

## Data flow

1. The official TBPN channel resolver confirms a fresh live broadcast and creates its standardized episode board from the YouTube video ID.
2. The importer reads `https://tbpn.substack.com/feed`, parses up to 40 issues, and prefers the issue linking to that exact video ID. It never imports an issue pointing to a different stream. A date fallback is allowed only for a single issue with no YouTube link, published near the episode start on the same Pacific calendar date.
3. The guest lineup, main run-of-show heading, and headlines become approved Unranked moments, capped at 30 topics and 300 approved moments per board. The configured blocked-word rules apply. The issue URL and original title form a stable source hash shared with the manual importer. Hidden or renamed source matches are preserved.
4. Images fill in over batches of at most 12. The resolver tries topic-specific newsletter art, a linked article's Open Graph image, an identified guest or brand's free Wikipedia image with attribution, a brand icon, and finally the verified episode thumbnail. Fallback thumbnails are not presented as portraits or event photos. All remote requests use bounded HTTPS host allowlists, revalidate redirects, enforce byte limits, and validate raster dimensions before storage.
5. R2 stores the actual image bytes. D1 stores provenance, import progress, per-episode pause state, and a diagnostic heartbeat. Room revisions publish new topics and images through the existing live event stream. Source credits are available from a moment's Scores & details view.

An atomic per-episode D1 lease prevents concurrent imports. The job and source keys survive interruptions. Missing or unavailable newsletters retry with at least a minute between attempts; the background collector supplies the actual cadence. Image batches retry independently of topic creation, including after the 100-image daily allowance resets at midnight UTC. Automatic images and manual uploads share that allowance, the 2 MB size limit, 4096-pixel side limit, and 16 MP limit. Failed or superseded writes release their quota reservation.

Automatic image updates use a conditional version check. An admin edit, image change, removal, hide, or concurrent update wins. Finished imports are snapshots: later feed changes do not silently rewrite the board. A job started while live can finish after the show. Replays without an existing job do not trigger retroactive imports into curated boards.

## Admin controls

Sign in with the configured admin account, then open **Newsletter** on an episode board to see the matched issue, saved topic/image counts, retries, and last background check. **Pause for this show**, **Resume for this show**, and **Check now** operate on that episode. A retry cannot bypass the daily image limit or overwrite edited moments. Manual newsletter review and pasted notes remain available as a backup.

Use **Add moment** or the plus in a tier to publish spontaneous moments with an optional image and timestamp. Click any card as admin to edit it; changes are saved and broadcast to other viewers.

## Verification

- `node scripts/test-show-import.mjs`: source matching, late publication, concurrent collectors, hidden/renamed items, moderation, resumable image storage, attribution, daily quota/reset, in-flight admin edits, stale stream protection, and thumbnail fallback.
- `node scripts/test-episode-lifecycle.mjs`: per-show boards and lifecycle finalization.
- With local dev running, `node scripts/test-chat-newsletter.mjs` checks the authenticated manual fallback and chat/moderation regression.
- The local unattended `/api/lifecycle` path was exercised against the real public feed and image sources, creating 19 topics and 19 persisted images in two bounded passes. A fresh visitor read all 19 from D1/R2; browser admin editing and spontaneous additions were separately verified.
- After publishing, call the public production `/api/lifecycle` without a session and read the persisted heartbeat through the admin Newsletter panel. Do not fabricate a live production broadcast or duplicate a finished episode merely to test the next-show trigger.
