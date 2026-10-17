# Daily workflow audit — October 17, 2026

The app uses the existing Sites Worker/D1/R2 deployment and Vercel gateway/queue. No new service, API key, or paid integration was introduced. QA writes below are confined to disposable local rooms, not audience production records.

| Requirement | Implementation and evidence |
| --- | --- |
| Detect official shows and create episode boards | Official-channel binding and full-video filtering in `lib/tbpn-stream.ts`; standardized video-ID rooms in `lib/episode-lifecycle.ts`. Lifecycle fixtures cover distinct shows, stale-source protection, and delayed offline confirmation. The public production lifecycle writer returned a fresh, successful check of `pgTXX-BI1_Q`. |
| Import the matching newsletter and images without visitors | Durable source-matched jobs, leases, image batches, source credits and shared 100/day quota. `test-show-import.mjs` passes 22 cases, including missing/late issues, actual object-storage writes in its fixture, concurrent workers, quotas, and admin edits during image fetch. The real public RSS/image path was also exercised through local D1/R2 in the prior import release; existing curated production content is preserved. |
| Run unattended | Current Vercel Queue metrics show 97 messages sent and 96 received/deleted in the audited 24-hour window. The final queued message was sent at 01:00–02:00 UTC October 17 and has no receive/deletion event. The saved schedule resumes Monday at 12:50 America/Chicago, checks every 2–4 minutes during weekday coverage, and stays within seven-day retention. This proves a queued successor and previous cloud execution; it does not promise future platform availability. |
| Source-based timestamps and reliable jumps | Six production moments have official chapter times, with the other fourteen pending. The current public watch source exposes no usable English caption track to the collector. Tests cover source identity, ambiguous matches, repeated caption evidence, exact zero, community evidence, and moderation retraction. Browser checks verified playback jumps, timestamped share links, and admin Mark now using the actual player clock. |
| Protected admin editing and moderation | Server authorization uses managed identity and the configured admin email, ryan@moonshineai.com. Independent content and timing versions reject stale changes. Source refresh preserves content/image edits and locked timing corrections. Local API/browser checks cover edits, uploads, hides, blocked words, moderators and timed mutes. Public callers cannot access protected insights or moderation. |
| Daily chat and moment participation | Room chat stores episode-bound timestamps and approved topic tags, with idempotent send retries. Quick takes prefill the composer; nominations prefill a reviewable moment draft. YouTube chat remains its official separate embed, with YouTube's own account/moderation rules. It is not silently scraped into local analytics. |
| Reliable personal boards and shared rankings | Shared placements use per-moment compare-and-swap plus room events. Personal patches preserve unrelated edits; unsent browser drafts survive a fresh tab and automatically sync after a local injected 503 is removed. Fifteen recovery checks cover scope, expiry, invalid data, acknowledgements, concurrent saves and database readback. Shared SSE delivery was measured at about one second in a two-visitor local test. |
| End-of-show publishing | Server-saved opted-in rankings snapshot even after the browser closes. Opt-outs, withdrawals, moderation and stable share links are tested. Every finalization statement checks the durable end marker inside its atomic batch, so simultaneous finalizers cannot replace the frozen snapshot with later votes. Unsent offline device edits cannot join the snapshot until synchronized. |
| Useful, honest feedback | Segment distributions, score means, rating coverage, topic comments, commenting identities, likes and votes remain separate metrics. Insights refreshes from room events. Timed highlight candidates require a playable timestamp, at least five ratings and at least 60% S/A feedback. Browser QA confirms a qualifying candidate, small-sample labels, and a comment count updating without manual refresh. CSV exports aggregate counts, source timestamps, playback links and an explicit small-sample flag, with formula-prefix escaping. These are voluntary identity-level signals and editorial hypotheses, not representative sentiment or measured retention/conversion. |
| Compact, accessible daily UI | S/A/B/C/D/F plus a separate Unranked tray; left-square images, keyboard moves, touch grips, labeled playback/detail controls, actual loading feedback and unsent-save status. Desktop/mobile viewport checks and dragging are included in browser QA. |
| Publish and source delivery | Source is packaged through the Sites workflow and synchronized to the existing public GitHub repository; the Vercel proxy forwards the current publication. Verify exact deployment success and matching source-tree hashes in the release handoff. |

## Verification commands

With local preview on port 5173 and the ignored local test identity configured:

```text
node node_modules/typescript/bin/tsc --noEmit
node scripts/test-personal-recovery.mjs
node scripts/test-community.mjs
node scripts/test-live-board.mjs
node scripts/test-timing-api.mjs
node scripts/test-chat-newsletter.mjs
node scripts/test-show-import.mjs
node scripts/test-moment-timing.mjs
node scripts/test-episode-lifecycle.mjs
node scripts/run-framework.mjs build
```

## Operational limits

- The production queue also has repeated callback notifications for an older missing message. Those callbacks fail before the app handler, separately from the successful collection chain and its queued successor. No replacement chain was blindly seeded. Inspect Vercel queue metrics and runtime logs if collection stops; preserve the pending successor when changing deployments because messages are pinned to their publishing deployment.
- Sources can lag, omit topics or disable captions/embedding. Missing or ambiguous information stays pending; there is no paid speech-recognition fallback.
- The free browser computation check is not proof of a unique human and is not Cloudflare Turnstile. Existing network limits, moderation and image validation apply; audience counts must be read with that limitation.
- Anonymous saved boards depend on the existing seven-day visitor cookie; account sign-in enables cross-device access. Local unsent drafts cannot recover if browser storage is cleared or unavailable. Concurrent edits to the same moment use the latest successful save.
