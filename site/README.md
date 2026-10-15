# Music site mockups

Four playable concepts for a black-and-chrome music site with no header, footer or name.
Open `index.html` for the overview, the research notes and the open questions.

| File | Concept | How you change songs |
| --- | --- | --- |
| `mercury.html` | One liquid-chrome object, a new form per song | Flick it away |
| `prism.html` | Glass keycap, one face per song | Spin it until a face rests toward you |
| `frequency.html` | A chrome wire buried in radio static | Tune a hidden dial |
| `darkroom.html` | Chrome spheres in a black room, cursor is the light | Find one and touch it |

No build step and no dependencies. Serve the folder with any static server
(for example `python3 -m http.server` inside `site/`), or open the files directly.

## Adding real songs

Edit `shared/audio.js` and give each track a `src`:

```js
{ src: "music/01.mp3", root: 43.65, chord: [0, 7, 10, 15], bpm: 70, cutoff: 520 },
```

Tracks without a `src` play a synthesized placeholder.

## New direction: New Dawn

`new-dawn/` replaces the black-and-chrome concepts above: a screen-printed meadow
that heals from a storm as the two songs play, steered by a compass dial.
See `new-dawn/README.md`.
