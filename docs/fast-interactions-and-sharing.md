# Live board, chat, and sharing

Cards offer a quick S–F / Unranked picker and a direct segment discussion action. Existing drag moves, conflict checks, moderation, and keyboard ranking remain in place. Drag rendering is scheduled once per animation frame; repeated catalog and distribution lookups use maps. Desktop chat docks beside the board at widths of 1200px and above.

Room chat shows delivery state before the request completes. Successful posts return the canonical saved message without requiring another GET first. Failed submissions retain their original identifier for retry. Acknowledgements preserve newer composer text. Draft text is stored under the current opaque visitor identity and episode, and messages can be composed while a post is pending. Incoming messages preserve the scroll position of someone reading older chat; an unread button returns to the latest messages. IME composition does not trigger Enter-to-send.

Chat GETs coalesce while a request is in flight. Gallery and reaction subscriptions ignore unchanged board revisions, including chat-only events. Gallery search is debounced while keeping the input mounted. Reactions update immediately and roll back if the server rejects the write. Full-state refreshes triggered by the event stream do not overlap each other.

Publishing or updating a personal board opens a sharing dialog. Previously published boards can be shared directly from My board or the gallery. The dialog reads the public saved snapshot, offers a permanent link, native sharing where supported, a caption, an X compose link, and a PNG download. The image module loads only when requested. Images that cannot be loaded with CORS fall back to a title initial. Export includes all six tiers, approved ranked segments, and the actual ranked count; unranked segments are not scored as F. Draft edits do not alter a shared snapshot until republished. Withdrawn and moderator-hidden posts stay unavailable to public readers.

## Verification

- `scripts/test-fast-sharing.mjs`: 20 checks for message acknowledgements and idempotence, private-field exclusion, room scoping, hidden-message retry rejection, saved snapshot sharing, stable links, and withdrawal/moderation.
- Existing chat/newsletter (24), live-board (18), community (38), and personal-recovery (15) checks passed.
- Browser: quick live and personal ranking; segment discussion; publishing and link copying; PNG download and visual inspection; draft persistence after reload; a simulated chat failure followed by retry with a newer draft preserved; a second viewer seeing one saved message; unread position preservation and jump-to-latest; mobile sharing and desktop docking; uninterrupted gallery search.
- TypeScript check and production build passed.

All mutation checks use the local preview and disposable rooms. Production audience rankings and chat are not test fixtures.
