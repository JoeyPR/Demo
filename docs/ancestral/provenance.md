# Research Provenance Log

What was inspected while researching the Ancestral artifacts, what each
source contributed, and where the gaps are. The goal was to find any
available code or data describing how Ancestrals render — private servers,
archives, GitHub repos, and "every other available code and information".

## Sources inspected

Below, "inspected" means the source was actually opened/read during this
research; "surfaced" means it appeared in search results but was not
examined in depth.

### Primary: Growtopia Set Planner — setplannergt.com
- Item pages (e.g. https://setplannergt.com/item/ancestral-tesseract-of-dimensions-level-4)
  and the avatar preview app itself.
- Finding: among the sources inspected, the planner is the only publicly
  available implementation of the ancestral auras. Its fx data is served
  through an encrypted API
  (POST /api/keys with a session token → AES-GCM-encrypted /d/*.bin → gzip →
  JSON) keyed by item id (`i:5132`) and left variant (`f:5132-left`). All 60
  records (30 items x right/left) were decrypted in-page and exported
  losslessly — this is `data/ancestrals.json`.
- The planner's client bundle (app.js) was deobfuscated to read the
  render pipeline: keyframe sampling, tinting, blend modes, the facing
  branch. Where the deobfuscation was ambiguous (the facing/world-transform
  block), the behavior was settled by live capture instead (see
  docs/rendering-spec.md §5, §10).
- Item ID cross-reference came from the planner's own item database
  (16k+ items with atlas coordinates).

### GitHub — private server emulators (GTPS) and community projects
Searched github.com topics/repos for Growtopia.

Inspected (page/file reads or clone established in the research history):
- https://github.com/NetroIndonesia/Growtopia — server emulator;
  docs/07-item-database.md and docs/08-game-systems.md were fetched and
  read. No client-side aura rendering.
- https://github.com/araeys/growtopia-explorer — community world planner,
  cloned; its 16,304-item database (atlas coordinates) and 859 tilesheet
  PNGs were used. Static item metadata; no animation data.

Surfaced in search; inspection not established:
- https://github.com/LucarioGamer/GrowtopiaServer,
  https://github.com/RebillionXX/GTServer,
  https://github.com/StileDevs/GrowServer,
  https://github.com/SweGTPS/GrowtopiaServer-1,
  https://github.com/1Emin/Growtopia-Proxy — server emulators/proxies
  (from their descriptions; not individually examined in depth).
- https://github.com/badewen/Growtopia-Things (item_id_list.txt),
  https://github.com/H-pun/growtopia-api,
  https://github.com/IniEyyy/Growlauncher-Documentation — item ID lists and
  documentation; useful for cross-referencing IDs, no fx data.
- https://github-wiki-see.page/m/growtopiadev/growtopia-internal/wiki/Internal-Docs
  — internal docs wiki; general client internals, nothing ancestral-specific.

### Wiki / archives
- Growtopia Wiki (fandom) — family pages, Ancestral Power / Hidden Riches
  update pages, Guide:Combining, Ancient Altar, Royal Winter Seal
  (URLs in docs/system.md). System facts source.
- Community archives: growtopiawiki.com, gamepedia.id, namu wiki,
  scribd ancestral guides, growtopiaexpertguide.blogspot.com (recipes) —
  corroborated system facts; no rendering data.

## Findings summary

1. None of the *inspected* repositories implement the ancestral aura
   *rendering* — Growtopia's client is closed-source, and the GTPS
   projects inspected emulate the server protocol (inventory, worlds),
   not the renderer. Among the sources actually checked, the Set Planner
   is the only public implementation, and therefore became the extraction
   source. (Searches also surfaced many other Growtopia repos and
   archives that were not individually inspected — no claim is made
   about them.)
2. The wiki fully documents the *system* (mods, levels, altar, updates);
   the planner fully contains the *animation data* (fx tracks). Between
   the two, everything needed to rebuild the render exists.
3. 17 other items share the Ancestral slot in item databases (auras, pets,
   event items like Ancient Shards) — surveyed and excluded as unrelated to
   the five artifact families.

## Gaps (not covered by any inspected source)

- In-game client rendering beyond the planner's reconstruction (exact
  in-game draw order vs other auras, device-specific differences).
- The planner's walking-mode world-anchor behavior (`fxWorld` birth
  positions) — data exported, not reproduced (see rendering-spec.md §10).
- Anything about server-side mod calculation internals beyond wiki
  descriptions.
