# Side-by-side comparisons

Open **Compare** on the episode, or **Compare with my board** on a posted board. Each segment has aligned personal / published / community tier cells, a maximum tier gap, image, and category. Search, show order, disagreement-only, and unranked filters operate on the approved catalog for that episode. On phones, only the table scrolls horizontally. Headers stay visible while its rows scroll.

## Method

- Tier distance uses S, A, B, C, D, F in that order, regardless of independent numeric scores.
- Community is the most selected personal tier per segment. Every tied leader is shown; no middle tier is invented. A tie has no single community tier and contributes no community gap, though the two boards can still disagree.
- Maximum gap is the widest distance between the available tier columns. Unranked and no-ratings cells contribute no vote or gap.
- Board agreement is exact-tier agreement over only jointly ranked segments. Zero overlap displays a dash, never a fabricated percentage.
- Counts measure saved personal voting identities, not verified unique humans. Below five ratings is labeled a small sample. Counts include the visitor's saved votes. This method intentionally differs from Community pulse's mean numeric score.

## Public sharing

Draft comparisons are private to the current browser. **Share comparison** explains that publishing will make the display name and saved rankings public. **Publish my board & share comparison** uses the existing protected publish endpoint after autosave completes. It never publishes unsent local changes or overwrites someone else's board. Comparing a draft to its own published post is readable, but sharing requires another viewer's post.

A public URL pins `room`, `view=compare`, `board` (right public post), and `against` (left public post). It never means the recipient's private board. Readers can explicitly switch to **Compare with my board** and edit or create their own for the same episode. Public views show both published bylines. Sharing offers copy, native share where supported, PNG download, and X intent; it never posts to X automatically.

`GET /api/comparison` reads only visible public posts and approved moments. The public response contains neither visitor IDs, emails, draft keys, nor drafts. `GET|HEAD /api/comparison-preview` renders a real 1200×630 PNG showing up to five largest gaps with actual tier cells, counts, and agreement. Page metadata is server rendered for crawlers. Both data and image routes validate both post IDs and the episode; withdrawn, hidden, mismatched, malformed, or identical post pairs return 404. Visibility is rechecked before conditional 304 responses. No new schema or paid service is needed.

Published posts may be explicitly updated or withdrawn, and community counts update live through existing room revisions. This is disclosed in the UI and image. Versioned share and image URLs reflect both public board revisions and distribution counts; third-party social caches can lag. Images are generated without an unbounded R2 object for each possible pair.

## Verification

`node scripts/test-board-comparison.mjs` covers tier math, scores independent from tiers, ties, missing ratings, agreement denominators, live counts, snapshot isolation, public metadata/PNG/HEAD/ETag, cross-episode rejection, and moderation/withdrawal. It uses disposable local data only. Also run `test-fast-sharing.mjs`, `test-social-cards.mjs`, `test-admin-live.mjs`, TypeScript, and the production build. Browser checks cover public-to-personal comparison, publishing, copying, search, responsive overflow, and live consensus refresh.
