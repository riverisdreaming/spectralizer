# New Dawn

A living, screen-printed landscape for two songs. It opens in a rainstorm: grey sky,
dry grass, dull stone. The music heals it. Colour spreads outward from where you
stand, the rain stops, the clouds part into streaks fanning out of a low sun, and a
faint rainbow comes through. Returning visitors find the world partly healed.

The only control is a compass dial at the bottom of the screen. No song names
appear anywhere.

- Each song lives in a place: the stone gate over the path (`doordash`) and the
  tower on the far hill (`wardoggin`). Orange notches on the dial's rim mark them.
- Drag or flick the needle. When it comes to rest pointing at a place, that
  place's doorway fills with light and its song plays. Pointing at nothing lets
  the music rest.
- Tap the centre of the dial to pause or resume. Arrow keys swing the needle and
  Space pauses.
- While a song plays you slowly walk the path toward its place. The orange arc
  on the rim shows how far through the song you are.
- Kicks send gusts and scattered petals through the meadow. Moving the pointer
  pushes wind through the grass and leaves.

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
| `index.html` | Page shell, dial and entry styles |
| `main.js` | The world: sky, storm, meadow, wind, audio, compass, print pass |
| `assets.js` | Every 3D model, built in code: gate, tower, clouds, sun, grass, poppies, leaves, butterflies, rainbow |
| `music/` | `doordash.mp3`, `wardoggin.mp3` |
| `models/` | The models exported as `.glb` for use in Blender or elsewhere |
| `imagery/` | Poster stills at 1920x1080, 1080x1920 and a 1200x630 share card |
| `tools/` | `export.html` + `export-models.js` regenerate `models/`; `posters.js` regenerates `imagery/` |

The `.glb` files carry flat colours. The toon shading and the print pass
(ink edges, stipple, blue-leaning shadows) are shaders and only exist on the page.
