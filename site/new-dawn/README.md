# New Dawn

A city street that two songs bring back to life.

It opens in the rain: a long street of grey brick warehouses with fire escapes,
parked cars and lamps glowing in the gloom, and a steel bridge closing the far
end. A few soggy leaves lie in the gutter. Every visit starts this way.

- **The first song (`doordash`)** brings colour back down the street from where
  you stand. The rain stops, paint spreads across the brick in bold murals,
  paint splashes hit the street, Mardi Gras beads drape from the fire escapes
  and lamps, bunting goes up across the street, and coloured leaves gust through.
  You walk the street as it plays.
- **The second song (`wardoggin`)** carries the colour to the bridge and the sky.
  The bridge towers get painted, confetti fills the air, and the sky turns into
  a purple-and-gold sunset as the lamps come on.

The palette leads with Mardi Gras purple, gold and green, backed by crimson,
burnt orange, teal and electric blue: one person's colourful personality, kept
bold and graphic rather than cute.
Progress follows how far each song has played and never goes backwards.

The only interface is one printed strip at the foot of the page. No song names
appear anywhere.

- Each song lives in a place: the brownstone front door (`doordash`) and the
  bridge (`wardoggin`). Pick one with its icon in the strip, or click the place
  itself. The doorway or the bridge arch fills with light.
- The scrubber is a horizon line with the sun as its handle. Drag it to move
  through the song. Volume sits beside it and is remembered.
- Keys: Space plays or pauses, Left/Right skip 5 seconds, Up/Down change the
  volume, 1 and 2 pick a place.
- While a song plays you walk down the street toward the bridge.

## The music breathes through it

The city coming back tells the story; the music only moves it gently. The beads
sway a little with the bass and the lit doorway breathes.

## Hidden in the world

- A delivery bag waits on the stoop once the street has its colour.
- When its song is quiet, the front door blinks D O O R in Morse code.
- A spray-paint stencil of a dog in a gold helmet appears on a wall near the bridge.
- Tap the sunset sun and the wind picks up.

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
| `main.js` | The scene: rain, colour returning, murals, beads, leaves, confetti, walk, audio, player strip, finishing pass |
| `city.js` | Buildings, fire escapes, street, cars, lamps, stoop, bridge, skyline |
| `color.js` | Murals, paint splashes, the dog stencil, the spreading-paint shader, bead strands, bunting |
| `assets.js` | Shared pieces (toon shader, clouds, parcel); also the earlier meadow models |
| `music/` | `doordash.mp3`, `wardoggin.mp3` |
| `imagery/`, `models/` | Stills and `.glb` files from the earlier meadow version; not yet redone for the city |
| `tools/` | `export.html` + `export-models.js` regenerate `models/`; `posters.js` regenerates `imagery/` |

The `.glb` files carry flat colours. The toon shading and the print pass
(ink edges, stipple, blue-leaning shadows) are shaders and only exist on the page.
