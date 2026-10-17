# Moment timing and daily conversation

The existing unattended `/api/lifecycle` collector also synchronizes the selected official TBPN episode's timestamps. This uses public sources and the existing D1 database; no new account or paid transcription service is configured.

## Timing sources and precedence

- **Official chapter:** The bounded YouTube watch-page reader checks both the exact video ID and TBPN's channel ID, then reads the video's published description chapters. Distinctive, unambiguous topic/name matches attach a chapter start to the corresponding board moment.
- **Public captions, approximate:** If the same public player response exposes an English caption track, its exact YouTube timed-text URL can be read. No credentials, authentication bypass, alternate client, or private caption API is used. At least four matching cues spanning thirty seconds are required; opening roll calls are excluded. These approximate starts have an eight-second lead-in.
- **Community, approximate:** Three recently active, verified browser/account identities on distinct network hashes discussing the same selected topic within a ninety-second playback window can establish an untimed moment's start. A repeated message or browser cannot supply three votes. This is a heuristic, not proof of three humans or that the topic began at that exact second. Hiding/muting supporting comments retracts a community time if it no longer has sufficient evidence.
- **Author/admin:** New moments can capture the actual embedded player clock, including valid 00:00. Admins can enter a time, Mark now from the player, clear uncertain timing, or return a moment to automatic timing. Manual times and manual clears are protected. An official chapter takes precedence over an unlocked approximate match.

Missing captions, source errors, ambiguous topics, and unmentioned newsletter items remain pending. Newsletter publication time, planned guest slots, ranking activity, and scheduled show start are not treated as evidence of a segment's actual start. Current TBPN video `pgTXX-BI1_Q` exposes six official description chapters and no public caption track at verification time; all six curated matching moments can be timestamped from those chapters. This does not claim continuous speech recognition for every live topic.

`moment_timings` stores timing separately from content/image versions. Timestamp edits have their own optimistic version and cannot silently overwrite a newer timestamp. Automatic timing does not interfere with the image importer. An indexed nullable `seconds` field distinguishes pending timing from an explicit 00:00. Room revisions broadcast timestamp changes through the existing event stream.

The background queue still checks every 2–4 minutes during weekday show hours. Timing-source retries are at least a minute apart while live and ten minutes apart for full replays. Reads are bounded by the lifecycle request's seventeen-second budget. A source failure preserves all known timings. Ephemeral caption URLs stay in request memory.

## Viewing and commenting

Timestamp pills play the exact moment. For viewers, clicking a timed card also jumps playback; the separate ••• button opens scoring/reactions. Admin card clicks open editing, while timestamp pills still jump directly. The clock icon opens a chronological show guide. Shared moment links include the episode and moment IDs and use the latest saved start when opened. The floating player honors these explicit seeks rather than forcing live-edge playback.

Room chat can automatically attach a fresh player position from the same episode, with a visible opt-out checkbox. It never stamps from a different video or an expired player sample. Comments link back to their positions, can be associated with a selected moment, and can be filtered on the server to that moment. Quick takes fill the composer before sending. Nominate moment opens a draft with the comment text, author context, and original comment timestamp; ordinary members retain the submission quota and moderation queue.

Admin Insights now joins voluntary ratings/reactions to segment timestamps, direct YouTube watch links, tagged topic-comment counts, and commenting identities. The CSV includes these fields, and Most discussed sorting surfaces conversational interest. These counts measure activity inside this site's room chat, not YouTube chat volume, retention, advertising conversions, or representative audience preferences.

## Validation

- `node scripts/test-moment-timing.mjs` covers source/channel binding, caption URL limits, zero/missing times, ambiguity, repeated-cue matching, durable source timing, edit conflicts, locks/clears, shared clock validity, community evidence, and moderation retraction.
- With local dev running, `node scripts/test-timing-api.mjs` covers admin authorization, persisted corrections, timestamped chat, cross-video rejection, community matching, server topic filters, moderation, and CSV readback.
- Existing newsletter, chat/moderation, episode lifecycle, and image-import regression suites remain applicable.
- Browser checks cover an actual jump to Walter Isaacson's chapter, an admin correction, a deep link loading with the saved start, timestamped chat and nomination drafts, drag/undo, and laptop/mobile geometry without page overflow.
- After publishing, invoke the public production lifecycle once and read the persisted six chapter matches from the normal state endpoint. Preserve existing moments, images, placements, and manual timestamps.
