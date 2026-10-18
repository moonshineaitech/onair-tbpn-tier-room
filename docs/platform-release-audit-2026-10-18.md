# Platform release audit — October 18, 2026

Scope: a reliable platform for shared live ranking, personal boards, public sharing and comparison, honest aggregate feedback, admin operations, and accessible daily use across stream rooms and Nashville predictions. Existing Sites Worker/D1/R2 and the Vercel gateway remain in place. QA writes belong only to disposable local rooms.

## Findings and release changes

- Ordinary community boards assigned tiers from independent mean scores. An even S/F split could appear as a middle tier. All rooms now show actual per-tier counts, tied leaders, S/A support, division, and differences from the viewer's explicit personal tiers. Mean scores remain separate.
- Chat retried uncertain sends with the same ID only while the tab remained open. A reload lost that ID. A bounded, seven-day outbox now preserves unconfirmed payloads per opaque identity and room. Reload never sends automatically; a saved own-message echo acknowledges the entry, and explicit retry retains the original ID.
- Guided personal ranking was limited to Nashville predictions. Every room now offers the same keyboard and touch workflow, resume/review, autosave/retry states, and publish/share completion.
- Comparison selector changes hardcoded the ordinary tier-list route. They now retain the canonical room route, including the dedicated Nashville page.

## Completion evidence

Current local run: 506 checks passed across 22 suites (`node scripts/test-release.mjs`). Per-suite logs and JSON are under ignored `.sites-runtime/release-qa/`. Browser checks below used disposable local records; production was inspected read-only. Publication is the final gate, with the exact native deployment result and matching source hashes recorded in the release handoff.

| Requirement | Evidence required | Current status |
| --- | --- | --- |
| Shared ranking, fast sync and conflicts | 18 live-board checks; persisted D1 versions, conflict and closed-room protection; SSE delivery measured at 1,015 ms. Browser pointer drag Unranked → S, keyboard Unranked → F, cross-tab rendering, and Undo passed. | Verified |
| Chat and failed-request recovery | 17 recovery and 24 chat/newsletter checks. Browser failures before commit and after commit both survived reload. The lost-ack retry sent the same ID twice; D1 contained exactly one message. Hidden-message retries remain rejected. | Verified |
| Personal ranking across rooms | 15 scoped draft checks and browser guided completion/share. A failed D-tier save recovered in a fresh tab, blocked publishing while unsent, then synchronized automatically. Shared placements stayed independent. | Verified |
| Post-show publishing, X previews, comparison sharing | 38 community, 25 social-card, 30 comparison, 20 fast-sharing and 65 platform checks include finalization, opt-out, withdrawal, privacy and metadata. Browser loaded an actual 1200 × 630 snapshot and created a public comparison link. Nashville selector and My board changes retained its canonical path. | Verified |
| Honest community insights | 20 ranking checks and community/insights suites. Browser displayed a true S/F tie as two leaders with 50% S/A and 100/100 division despite independent numeric scores. No-data rooms give explicit guidance. Anonymous production insights returned 403. | Verified |
| Admin topics, images, timing and moderation | 24 admin/upload, 22 timing API, 23 timing logic, 22 show-import and 26 room checks. Browser image upload and context edits persisted; timestamp controls require player evidence for Mark now. Host/moderator boundaries, stale edits, limits, blocked words and mutes passed. | Verified |
| Stream discovery and honest live state | 34 metadata, 13 stream selection, 18 directory, 11 archive API and 65 platform checks. Directory/provider fixtures cover freshness, outages, source changes, live-first ordering and non-TBPN rooms. Production routes returned 200. | Verified |
| Compact accessible design | At 1280 × 800 the community panel ended at y=704 with no horizontal overflow. Generic and Nashville guided dialogs fit 480 × 844; tier buttons measured about 131 × 72 px, with correct focus and keyboard selection. Empty catalogs and filters have separate guidance. | Verified; final public screenshot in handoff |
| Preserve data, permissions and limits | No migration, auth, quota, gateway or binding changes. All test mutations stayed local. Before publication, TBPN retained 20 image moments with 6 source timestamps; Nashville retained 16 images and no invented timestamps. Production moderation returned 403 to an anonymous request. | Verified; post-publication readback required |
| Ship and synchronize | Final typecheck, production build, native Sites deployment, public browser/data readback and matching GitHub/source trees are checked during the release handoff. | Publication gate |

## Known operational limits

External providers can lag, omit captions, or disable embeds. Missing source evidence remains pending. Platform chat stays in the provider's official embed and is not scraped into local analytics. Anonymous identities and unsent drafts depend on browser storage and the existing session lifetime; they are not proof of unique humans. Social platforms may cache previews. These limits must stay visible in the relevant product flows and release handoff.

## Existing collector observation

The Vercel CLI resolved the existing gateway project in its configured team. Current queue metrics over October 15–18 show 97 sent messages and 96 received/deleted messages, consistent with the outstanding weekend-delayed successor recorded in the earlier audit. There were no background collection logs in the current 30-minute Sunday window. The collector source and gateway deployment were unchanged. These observations do not prove future delivery, and the older unmatched callback notifications remain an operational limit; no duplicate collection chain was started.

One pre-existing admin test assumed the official fallback would always appear among the latest 100 rooms. It now reads the fallback room directly, matching the actual archive contract without weakening source/channel assertions.
