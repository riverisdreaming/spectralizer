// Shared audio engine for every mockup.
//
// Real songs: set `src` on a track to an mp3/ogg/wav path (e.g. "music/01.mp3").
// Until then each track is a synthesized placeholder so the mockups are playable.
(function () {
  const TRACKS = [
    { src: null, root: 43.65, chord: [0, 7, 10, 15], bpm: 70, cutoff: 520 },
    { src: null, root: 49.0, chord: [0, 3, 7, 14], bpm: 84, cutoff: 760 },
    { src: null, root: 36.71, chord: [0, 5, 10, 12, 17], bpm: 62, cutoff: 420 },
    { src: null, root: 55.0, chord: [0, 3, 10, 14], bpm: 92, cutoff: 980 },
    { src: null, root: 41.2, chord: [0, 7, 12, 15, 22], bpm: 76, cutoff: 640 },
  ];

  class Player {
    constructor(tracks) {
      this.tracks = tracks;
      this.voices = new Map();
      this.current = -1;
      this.ctx = null;
    }

    start() {
      if (this.ctx) return this.ctx.resume();
      const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.82;
      this.master.connect(this.analyser);
      this.analyser.connect(ctx.destination);
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.wave = new Float32Array(this.analyser.fftSize);

      // One shared reverb tail gives the placeholders their room.
      this.reverb = ctx.createConvolver();
      const len = ctx.sampleRate * 4.5;
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      this.reverb.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.55;
      this.reverb.connect(wet).connect(this.master);
      return ctx.resume();
    }

    // Create (or reuse) the voice for track i. Gain starts at 0.
    ensure(i) {
      if (this.voices.has(i)) return this.voices.get(i);
      const t = this.tracks[i];
      const v = t.src ? this._fileVoice(t) : this._synthVoice(t);
      this.voices.set(i, v);
      return v;
    }

    gain(i, value, ramp = 0.08) {
      const v = this.ensure(i);
      const now = this.ctx.currentTime;
      v.out.gain.cancelScheduledValues(now);
      v.out.gain.setTargetAtTime(value, now, ramp);
    }

    release(i, after = 0) {
      const v = this.voices.get(i);
      if (!v) return;
      this.voices.delete(i);
      setTimeout(() => v.stop(), after * 1000);
    }

    // Crossfade to track i.
    play(i, fade = 1.4) {
      i = ((i % this.tracks.length) + this.tracks.length) % this.tracks.length;
      if (i === this.current) return i;
      const prev = this.current;
      this.current = i;
      if (prev >= 0 && this.voices.has(prev)) {
        this.gain(prev, 0, fade / 4);
        this.release(prev, fade * 1.6);
      }
      this.gain(i, 1, fade / 4);
      return i;
    }

    // Normalised energy bands for driving visuals.
    levels() {
      if (!this.analyser) return { bass: 0, mid: 0, high: 0, wave: null };
      this.analyser.getByteFrequencyData(this.freq);
      this.analyser.getFloatTimeDomainData(this.wave);
      const band = (a, b) => {
        let s = 0;
        for (let k = a; k < b; k++) s += this.freq[k];
        return s / ((b - a) * 255);
      };
      return { bass: band(1, 8), mid: band(8, 80), high: band(80, 400), wave: this.wave };
    }

    noise() {
      if (this._noise) return this._noise;
      const ctx = this.ctx;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2400;
      bp.Q.value = 0.6;
      const out = ctx.createGain();
      out.gain.value = 0;
      src.connect(bp).connect(out).connect(this.master);
      src.start();
      this._noise = { out, bp };
      return this._noise;
    }

    _fileVoice(t) {
      const el = new Audio(t.src);
      el.loop = true;
      el.crossOrigin = "anonymous";
      const src = this.ctx.createMediaElementSource(el);
      const out = this.ctx.createGain();
      out.gain.value = 0;
      src.connect(out).connect(this.master);
      el.play();
      return { out, stop: () => { el.pause(); out.disconnect(); } };
    }

    _synthVoice(t) {
      const ctx = this.ctx;
      const out = ctx.createGain();
      out.gain.value = 0;
      out.connect(this.master);
      out.connect(this.reverb);
      const nodes = [];

      // Pad: detuned saws through a slowly breathing lowpass.
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = t.cutoff;
      lp.Q.value = 4;
      const lfo = ctx.createOscillator();
      const lfoAmt = ctx.createGain();
      lfo.frequency.value = 0.06;
      lfoAmt.gain.value = t.cutoff * 0.6;
      lfo.connect(lfoAmt).connect(lp.frequency);
      lfo.start();
      nodes.push(lfo);
      const pad = ctx.createGain();
      pad.gain.value = 0.05;
      lp.connect(pad).connect(out);
      t.chord.forEach((n) => {
        const f = t.root * 2 * Math.pow(2, n / 12);
        [-7, 7].forEach((cents) => {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = f;
          o.detune.value = cents;
          o.connect(lp);
          o.start();
          nodes.push(o);
        });
      });

      // Sub drone.
      const sub = ctx.createOscillator();
      const subG = ctx.createGain();
      sub.frequency.value = t.root;
      subG.gain.value = 0.18;
      sub.connect(subG).connect(out);
      sub.start();
      nodes.push(sub);

      // Heartbeat kick + ticks, scheduled ahead.
      const beat = 60 / t.bpm;
      let next = ctx.currentTime + 0.1;
      let step = 0;
      const timer = setInterval(() => {
        while (next < ctx.currentTime + 0.3) {
          if (step % 4 === 0 || step % 16 === 10) this._kick(out, next, t.root);
          if (step % 2 === 1) this._tick(out, next, step % 8 === 7 ? 0.05 : 0.018);
          next += beat / 2;
          step++;
        }
      }, 60);

      return {
        out,
        stop: () => {
          clearInterval(timer);
          nodes.forEach((n) => { try { n.stop(); } catch (e) {} });
          setTimeout(() => out.disconnect(), 200);
        },
      };
    }

    _kick(dest, at, root) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(root * 3, at);
      o.frequency.exponentialRampToValueAtTime(root, at + 0.18);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.7, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
      o.connect(g).connect(dest);
      o.start(at);
      o.stop(at + 0.65);
    }

    _tick(dest, at, level) {
      const ctx = this.ctx;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 4;
      const s = ctx.createBufferSource();
      const hp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      s.buffer = buf;
      hp.type = "highpass";
      hp.frequency.value = 7000;
      g.gain.value = level;
      s.connect(hp).connect(g).connect(dest);
      g.connect(this.reverb);
      s.start(at);
    }
  }

  window.VOID = window.VOID || {};
  window.VOID.TRACKS = TRACKS;
  window.VOID.player = new Player(TRACKS);
})();
