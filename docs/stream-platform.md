# ON AIR: rooms for any stream

The public entry is `/streams` (also the home-page destination). It searches the complete room archive and links to a dedicated room. **Create a room** opens `/tier-list?create=1`; a verified visitor supplies a title, stream URL, description, and up to 20 starting topics. The server saves the room, its private host record, and approved starting moments atomically in D1. Share the resulting room URL to bring viewers to its independent board, chat, personal rankings, comparisons, and post-show sharing.

## Sources

- YouTube watch, short-share, live-video, channel-ID, and handle URLs are recognized. Known video IDs use the existing controllable player, volume, playhead capture, and timestamp seeking. Channel IDs use YouTube's channel embed. Handle lookup is confined to YouTube, times out after 5 seconds, and falls back to an honest external watch link if channel metadata cannot be resolved.
- Twitch channels and full broadcasts embed using the actual host in `parent`. Full-broadcast moment links carry the VOD time. Live channels do not claim DVR seeking. Below the player's minimum width, the source opens externally while the room stays usable. Twitch platform chat is separate from room chat.
- Public Vimeo video IDs embed using the Vimeo player. Its own playback permissions still apply. Timestamps can seek via the embedded URL; playhead capture is not advertised without an actual controllable clock.
- Direct HTTPS MP4/WebM sources use native video controls and a real media playhead. Other HTTPS stream URLs open at their source. A room without a source has no player. Custom rooms never fall back to an unrelated TBPN video or chat.
- Credentials, non-HTTPS URLs, malformed known-provider links, and private/local destinations are rejected. Arbitrary URLs are never fetched server-side for embedding or media previews.

Provider contracts: [Twitch video embeds](https://dev.twitch.tv/docs/embed/video-and-clips/), [Twitch chat](https://dev.twitch.tv/docs/embed/chat/), [YouTube player parameters](https://developers.google.com/youtube/player_parameters).

## Host access and moderation

Migration `0007_stream_room_hosts` adds a private host/settings table. Ownership uses the existing verified user identity, never a client-supplied owner or email. Public room records contain no owner ID. Anonymous ownership belongs to the verified browser session for 7 days. On managed sign-in from that browser, its hosted rooms transfer to the authenticated account; subsequent devices use that account identity. No new authentication provider or paid API is required.

`canManage` is separate from global `admin`. Hosts can edit their room and moments, adjust timestamps, publish images, review nominations, moderate that room's posts and chat, apply additional word filters, unmute its viewers, and read its aggregate insights. Every mutation resolves and checks the room on the server. Hosts cannot edit another room, change global filters or roles, or obtain site-wide admin access. Global admins retain existing powers.

Verified non-admins can create 3 rooms per UTC day, with a 5-room network cap. All rooms retain the 300-approved-moment ceiling, visitor nomination limits, text filtering, and the existing shared site upload allowance: 100 uploads per UTC day, PNG/JPEG/WebP up to 2MB, 4096px per side and 16MP. Pending images are visible only to their room's host or site admin.

For custom streams, **End show & close live ranking** freezes opted-in saved personal boards using the existing finalization service. Personal rankings and explicit re-publication stay available afterwards. Custom streams do not claim automatic end detection. TBPN retains its existing official discovery, newsletter, image, and timing collection; collectors continue through the existing lifecycle path.

## Fetch recovery and compatibility

The reported localhost tab pointed to a stopped preview server. Production API reads and all 20 current images were healthy when checked. Keep the user on the deployed app after development; temporary local previews are not a durable public URL.

`requestJSON` retries only transient reads, with bounded timeouts and cancellation. Permanent errors do not loop; writes do not automatically replay. Main board, room directory, archive, gallery, comparison, share lookup, room chat, and reaction reads use it. The initial board displays a useful error, retry control, and published-directory link instead of spinning forever. A failed room switch rolls back its pending target; stream changes clear old playback requests. SSE refresh queues a newer revision while a fetch is in flight.

Initial room reads serve saved data without waiting for upstream newsletters, images, or caption collection. `/api/stream` performs broadcast discovery and episode synchronization; `/api/lifecycle` retains full collection. The image route supports HEAD as well as GET, with the same visibility checks.

Automatic board posts already use 32-character hexadecimal IDs. The public board/preview reader now accepts these alongside manually published UUIDs, so automatic posts can receive social previews and comparisons. Hidden/withdrawn boards still fail visibility checks before images or conditional responses are returned. General sharing copy and image cards use ON AIR / Live Tier Room branding and the actual selected room.

## Validation

`node scripts/test-stream-platform.mjs` exercises supported-source parsing, safe URLs, provider parameters, read retries and write safety, verified room creation, host boundaries, local word filtering, uploads, nominations, timestamps, agenda imports, chat moderation, show ending, automatic-post preview compatibility, and persistence. It creates disposable local fixtures and requires the local server and applied migrations. Existing board, chat, timing, recovery, social-card, comparison, gateway-auth, and episode suites remain relevant. Browser verification covers directory → create → D1-backed room → scoped host controls, provider-specific player/chat, source switching, and responsive/error states. Production build and compiled Worker checks are required before publishing.
