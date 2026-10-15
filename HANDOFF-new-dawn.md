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

## What the site is

A screen-printed 3D landscape (Three.js 0.160.0, vendored in `vendor/`, no CDN).
The story is a redemption: the music rebuilds a burnt world.

- **Start (every visit):** the meadow is on fire, the sky is blood-orange under
  low smoke, the grass is burnt stubble, and both buildings lie in rubble with
  smoke rising from them.
- **Song 1, `doordash`:** the stone gate over the path rebuilds block by block
  as the song progresses. The flames go out outward from the viewer, the grass
  grows back, the sky settles to a smoky dusk. The camera walks the path and
  passes through the finished gate at the end.
- **Song 2, `wardoggin`:** the camera turns to the far hill and the tower
  rebuilds from its ruins (the stone dog is placed last). The smoke lifts, the
  sky clears to ultramarine, the sun rises, cloud streaks fan out of it,
  poppies open, and a faint rainbow appears.
- Rebuild is driven by each song's playback progress and only moves forward.

## Direction from the artist (keep to this)

- The **rebuilding tells the story**. Music reactions are deliberately subtle
  (flames and cloud streaks sway slightly with the spectrum, sun and doorway
  breathe with the bass, soft gusts on kicks). Don't make them louder.
- **No song names anywhere on the page.** Songs are chosen with the gate and
  tower silhouettes in the player strip, or by clicking the buildings.
- Art style: screen print / woodblock. Deep ultramarine sky, white cumulus with
  blue shading, rich greens, red poppies, pale winding path, ink outlines,
  stipple grain. References were Kawase Hasui-like landscape prints.
- Previously rejected, don't bring back: black-and-chrome look, Murakami
  flowers, butterflies, the compass dial, paw prints, pastel/Easter colours.
- Hidden references to the song titles are wanted. Current ones: a delivery
  bag on the gate's doorstep (appears once the gate stands), the gate doorway
  blinking D-O-O-R in Morse when its song is quiet, the stone war dog at the
  tower whose eyes glow while its song plays, and a sun that bursts when tapped.
  The artist may send lyric lines to hide more; none received yet.

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
