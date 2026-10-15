# Void

A black page with one object in it: a knurled chrome wheel, and inside it a pool
of black ferrofluid that the music magnetizes. No names, no text.

- **Pick a song** by turning the wheel (drag or flick it). Each song is a mark
  raised on the rim, one bead or two. Whichever mark comes to rest under the
  pointer at the top plays.
- **Pause** by tapping the fluid in the middle.
- **Move through the song** by dragging along the hairline arc inside the wheel;
  it fills clockwise from the top as the song plays.
- **Volume:** scroll. Two faint digits surface in the corner for a moment.
- Keys: Space pauses, Left/Right skip 5 seconds, Up/Down volume, 1/2 or Tab turn
  the wheel.

The visualizer is the ferrofluid: it grows spikes like a magnetized liquid, and
each direction around it answers a different part of the spectrum. Between
songs it settles back into a slow, breathing pool.

Everything is one raymarched fragment shader in `void.js` (no libraries). The
songs are fetched, decoded and played as Web Audio buffers, so they play
wherever the page is hosted. Copy `doordash.mp3` and `wardoggin.mp3` into
`music/` (gitignored), then serve the folder:

```sh
npx serve site
# open http://localhost:3000/void/
```
