# Handoff: New Dawn music website

For: Astra (or anyone picking this up)
Written: 2026-10-15

## Where the code is

| What | Value |
| --- | --- |
| Repository | https://github.com/riverisdreaming/spectralizer |
| Branch | `claude/mysterious-music-website-4ra53b` |
| Latest commit | `3c18a34` New Dawn: quieter music reactions, no paw prints, bushes off the path |
| Pull request | https://github.com/riverisdreaming/spectralizer/pull/1 (draft, into `master`, no CI checks, no conflicts) |
| Site folder | `site/new-dawn/` (everything else in the repo is the original OBS plugin; leave it alone) |
| Live private preview | https://claude.ai/artifact/GWgmbupCSNAmAenCGzxjgH (owner-only until shared) |

Get it running:

```sh
git clone https://github.com/riverisdreaming/spectralizer
cd spectralizer
git checkout claude/mysterious-music-website-4ra53b
# copy the two songs in (they are gitignored, see below)
cp /path/to/doordash.mp3 /path/to/wardoggin.mp3 site/new-dawn/music/
npx serve site
# open http://localhost:3000/new-dawn/
```

Use a server that supports HTTP range requests (`npx serve` does). Python's
`http.server` does not, and the seek bar snaps back to 0:00 with it.

## The songs are NOT in git

`site/new-dawn/music/*.mp3` is gitignored on purpose so the unreleased masters
don't land in a repo that may be public. You need the two files from the artist:
`doordash.mp3` (about 3:30) and `wardoggin.mp3` (about 3:01). The live preview
above has its own copy.

## What the site is (city version, latest)

A rainy grey city street (Dumbo-style brick warehouses, fire escapes, parked
cars, a suspension bridge at the end) that the two songs bring back to life with
colour. Song 1 (`doordash`): colour returns down the street, the rain stops,
bold murals spread across the brick, paint splashes hit the road, Mardi Gras
beads and bunting go up, coloured leaves gust through; its place is a brownstone
front door. Song 2 (`wardoggin`): the bridge towers are painted, confetti fills
the air, the sky becomes a purple-and-gold sunset; its place is the bridge arch.

The artist wants colour itself to carry it: Mardi Gras purple/gold/green plus
crimson, burnt orange, teal, electric blue, describing a vibrant personality,
and kept masculine (bold, graphic). No flowers or cute smiling characters any
more. Music reactions stay subtle.

Earlier versions (black-and-chrome mockups, the meadow that heals from a storm,
then from fire) are in git history; the artist has moved on from them.

## Controls

One printed strip at the bottom: gate and tower buttons (pick a song), a sun
play/pause button, a horizon-line seek bar with the sun as its handle, and a
volume slider (remembered between visits). Keys: Space play/pause, Left/Right
skip 5s, Up/Down volume, 1/2 pick a song.

## Files

| Path | What it is |
| --- | --- |
| `site/new-dawn/index.html` | Page shell, player strip and "wake up" entry screen |
| `site/new-dawn/main.js` | The world: fire, smoke, sky, meadow, rebuild logic, wind, audio, player, print post-process |
| `site/new-dawn/assets.js` | Every 3D model built in code: gate and tower as rebuildable stone pieces, dog, parcel, clouds, sun, grass, poppies, leaves, rainbow, toon shader |
| `site/new-dawn/models/*.glb` | Models exported for Blender (flat colours; the toon look is a shader) |
| `site/new-dawn/imagery/*.png` | Poster stills: on fire, gate rebuilt, restored (wide and portrait), share card |
| `site/new-dawn/tools/` | `export-models.js` regenerates `models/`, `posters.js` regenerates `imagery/` (Playwright; set `BASE` if your server isn't on :3000) |
| `site/*.html`, `site/shared/` | Earlier black-and-chrome mockups, kept only for reference |

Key places in `main.js`:
- `A`, `B` (and smoothed `As`, `Bs`): rebuild progress for song 1 and song 2.
  Everything about the world's state is derived from these each frame.
- `landmarks[i].rebuild(t)`: moves the building's stone pieces from rubble to built.
- `window.NEW_DAWN.setLife(v)`: test hook; 0 = on fire, 0.5 = gate rebuilt,
  1 = fully restored. Handy for screenshots.

## State of things / not yet verified

- The last commit (`3c18a34`: quieter music reactions, paw prints removed,
  bushes pushed off the path) passed a JavaScript syntax check but was **not
  visually re-tested**. First job: load the page, step through
  `NEW_DAWN.setLife(0)`, `(0.5)`, `(1)`, and play both songs to confirm the
  bushes no longer block the path and the reactions feel right.
- `imagery/` and `models/` were last regenerated before that commit; the posters
  may still show bushes on the path. Rerun `tools/posters.js` after checking.
- Not yet tried on a real phone (only headless Chrome at 390×844).
- Where the site will be hosted, its domain, and the browser tab title / link
  preview are still open questions for the artist.
- The PR is a draft. Mark it ready when the artist is happy.
