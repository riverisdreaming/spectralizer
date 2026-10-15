# New Dawn

A living, screen-printed landscape for two songs. It opens in a rainstorm: grey sky,
dry grass, dull stone. The music heals it. Colour spreads outward from where you
stand, the rain stops, the clouds part into streaks fanning out of a low sun, and a
faint rainbow comes through. Returning visitors find the world partly healed.

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

## The music drives the page

- The twelve cloud streaks fanning out of the sun are a spectrum, from low on
  the left to high on the right. Each swells and warms as its band gets loud.
- The sun's rays pulse with the bass. Kicks flash the whole print warmer and send
  a gust and petals through the meadow. The ponds shimmer with the highs.
- Pointer movement pushes wind through the grass and leaves.

## Hidden in the world

- A delivery bag sits on the gate's doorstep.
- When its song is quiet, the gate's doorway blinks D O O R in Morse code.
- A stone war dog guards the foot of the tower. Its eyes kindle while its song plays.
- Paw prints press into the path, one by one, as `wardoggin` plays.
- Tap the sun.

## Run it

Module scripts need a server:

```sh
cd site && python3 -m http.server 8765
# open http://localhost:8765/new-dawn/
```

Three.js 0.160.0 is vendored in `vendor/`, so nothing loads from a CDN.
The engraved typeface comes from Google Fonts and falls back to Georgia.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Page shell, player strip and entry styles |
| `main.js` | The world: sky, storm, meadow, wind, audio, player strip, visualizer, print pass |
| `assets.js` | Every 3D model, built in code: gate, tower, dog, parcel, paw prints, clouds, sun, grass, poppies, leaves, rainbow |
| `music/` | `doordash.mp3`, `wardoggin.mp3` |
| `models/` | The models exported as `.glb` for use in Blender or elsewhere |
| `imagery/` | Poster stills at 1920x1080, 1080x1920 and a 1200x630 share card |
| `tools/` | `export.html` + `export-models.js` regenerate `models/`; `posters.js` regenerates `imagery/` |

The `.glb` files carry flat colours. The toon shading and the print pass
(ink edges, stipple, blue-leaning shadows) are shaders and only exist on the page.
