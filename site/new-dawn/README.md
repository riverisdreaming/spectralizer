# New Dawn

A living, screen-printed landscape for two songs, and the music rebuilds it.

It opens on fire: flames across the meadow, a blood-orange sky under low smoke,
burnt stubble, and both buildings lying in crushed rubble with smoke rising off
them. Every visit starts this way.

- **The first song (`doordash`)** rebuilds the stone gate block by block from its
  rubble, lowest courses first. The flames go out from where you stand outward,
  the grass grows back green, and the sky settles into a smoky dusk. You walk the
  path as it plays and pass through the finished gate as it ends.
- **The second song (`wardoggin`)** rebuilds the tower on the far hill, with the
  stone war dog set in place last. The smoke lifts, the sky clears to ultramarine,
  the sun rises, cloud streaks fan out of it, poppies open, and a faint rainbow
  comes through. When it ends, the whole scene is restored.

Rebuilding follows how far each song has played and never goes backwards.

The only interface is one printed strip at the foot of the page. No song names
appear anywhere.

- Each song lives in a place: the stone gate over the path (`doordash`) and the
  tower on the far hill (`wardoggin`). Pick one with its silhouette in the strip,
  or click the place itself in the world. Its doorway fills with light.
- The scrubber is a horizon line with the sun as its handle. Drag it to move
  through the song. Volume sits beside it and is remembered.
- Keys: Space plays or pauses, Left/Right skip 5 seconds, Up/Down change the
  volume, 1 and 2 pick a place.
- While a song plays you walk the path toward its place. By the end of
  `doordash` you have walked through the gate.

## The music breathes through it

The rebuild tells the story; the music only moves the world gently. The flames,
and later the cloud streaks fanning out of the sun, sway a little with their
slice of the spectrum. The sun's rays and the lit doorway breathe with the bass,
and kicks send a soft gust through the meadow. Moving the pointer pushes wind
through the grass and leaves.

## Hidden in the world

- A delivery bag sits on the gate's doorstep.
- When its song is quiet, the gate's doorway blinks D O O R in Morse code.
- A stone war dog guards the foot of the tower. Its eyes kindle while its song plays.
- The delivery only arrives once the gate is standing again.
- Tap the sun.

## Run it

Module scripts need a server, and seeking needs one that supports range requests
(Python's `http.server` does not, so the scrubber would snap back to the start):

```sh
npx serve site
# open http://localhost:3000/new-dawn/
```

Song files are gitignored. Copy `doordash.mp3` and `wardoggin.mp3` into `music/` first.

Three.js 0.160.0 is vendored in `vendor/`, so nothing loads from a CDN.
The engraved typeface comes from Google Fonts and falls back to Georgia.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Page shell, player strip and entry styles |
| `main.js` | The world: fire, smoke, sky, meadow, rebuild, wind, audio, player strip, visualizer, print pass |
| `assets.js` | Every 3D model, built in code: gate and tower (as rebuildable stone pieces), dog, parcel, clouds, sun, grass, poppies, leaves, rainbow |
| `music/` | `doordash.mp3`, `wardoggin.mp3` |
| `models/` | The models exported as `.glb` for use in Blender or elsewhere |
| `imagery/` | Poster stills (on fire, gate rebuilt, restored) at 1920x1080 and 1080x1920, plus a 1200x630 share card |
| `tools/` | `export.html` + `export-models.js` regenerate `models/`; `posters.js` regenerates `imagery/` |

The `.glb` files carry flat colours. The toon shading and the print pass
(ink edges, stipple, blue-leaning shadows) are shaders and only exist on the page.
