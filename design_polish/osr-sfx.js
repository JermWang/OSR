// osr-sfx.js — self-contained procedural WebAudio SFX for the OSR trailer.
// No samples, no network: every sound is synthesised. window.OSRSfx.fire(name,arg)
// plays a sound immediately; the trailer schedules fires from the scene clock so
// hits land on the real visual beats. Tempo reference for a backing track: 120
// BPM (one beat = 0.5s); scene cuts fall on the grid at 0/12/25/39/51/64s.
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ac = null, master = null, comp = null, delay = null, delayGain = null, verb = null;

  function ensure() {
    if (!ac && AC) {
      try {
        ac = new AC();
        master = ac.createGain(); master.gain.value = 0.85;
        comp = ac.createDynamicsCompressor();
        comp.threshold.value = -10; comp.knee.value = 24; comp.ratio.value = 8;
        comp.attack.value = 0.003; comp.release.value = 0.18;
        master.connect(comp); comp.connect(ac.destination);
        // simple feedback-delay "space" send for tails
        delay = ac.createDelay(1.0); delay.delayTime.value = 0.16;
        delayGain = ac.createGain(); delayGain.gain.value = 0.28;
        verb = ac.createGain(); verb.gain.value = 0.5;
        delay.connect(delayGain); delayGain.connect(delay); delay.connect(verb); verb.connect(master);
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
    return ac;
  }
  // resume on the first user gesture (browsers block audio before one)
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, ensure, { passive: true });
  });

  function now() { return ac.currentTime; }
  function tail(node) { node.connect(master); node.connect(delay); }

  // --- primitives -----------------------------------------------------------
  function osc(type, f0, f1, t0, dur, peak, atk, sendTail) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    var a = atk == null ? 0.004 : atk;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); if (sendTail) tail(g); else g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, t0, peak, filtType, f0, f1, q, sendTail) {
    var n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var src = ac.createBufferSource(); src.buffer = buf;
    var flt = ac.createBiquadFilter(); flt.type = filtType || 'bandpass';
    flt.frequency.setValueAtTime(f0, t0);
    if (f1 != null) flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    if (q != null) flt.Q.value = q;
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(g); if (sendTail) tail(g); else g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
  function bell(freq, dur, peak, t0, sendTail) {
    osc('sine', freq, freq, t0, dur, peak, 0.003, sendTail);
    osc('sine', freq * 2.01, freq * 2.01, t0, dur * 0.6, peak * 0.35, 0.003, sendTail);
    osc('triangle', freq * 3.0, freq * 3.0, t0, dur * 0.4, peak * 0.15, 0.003, sendTail);
  }

  // --- named sounds ---------------------------------------------------------
  var SFX = {
    uiTick: function (t) { osc('square', 1500, 1300, t, 0.03, 0.05); },
    click: function (t) { noise(0.02, t, 0.18, 'highpass', 2000, 2400, 0.7); osc('square', 720, 340, t, 0.05, 0.09); },
    thud: function (t) { osc('sine', 150, 52, t, 0.22, 0.5); noise(0.06, t, 0.14, 'lowpass', 400, 180, 1); },
    whoosh: function (t, dur) {
      dur = dur || 0.5;
      noise(dur, t, 0.16, 'bandpass', 260, 2200, 0.8, true);
      noise(dur, t + dur * 0.45, 0.10, 'bandpass', 2200, 320, 0.8, true);
    },
    rumble: function (t, dur) {
      dur = dur || 4;
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(44, t);
      o.frequency.linearRampToValueAtTime(70, t + dur);
      var flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 120; flt.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.3, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
      o.connect(flt); flt.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.15);
      noise(dur, t, 0.06, 'lowpass', 90, 130, 1);
    },
    crack: function (t) {
      noise(0.14, t, 0.5, 'highpass', 1200, 600, 0.5, true);
      osc('sine', 110, 38, t, 0.34, 0.55);
      osc('triangle', 540, 520, t, 0.26, 0.18, 0.002, true);
      noise(0.5, t + 0.02, 0.12, 'lowpass', 300, 90, 1);
    },
    coin: function (t, i) {
      var base = 880 * Math.pow(2, ((i || 0) % 8) / 12);
      bell(base, 0.32, 0.16, t, true);
    },
    sparkle: function (t) {
      var f = [1046, 1318, 1568, 2093, 2637];
      for (var i = 0; i < f.length; i++) bell(f[i], 0.5, 0.09, t + i * 0.04, true);
    },
    chime: function (t, freq) { bell(freq || 660, 0.6, 0.2, t, true); },
    equip: function (t, freq) {
      noise(0.05, t, 0.18, 'lowpass', 900, 400, 1); // thock
      bell(freq || 587, 0.4, 0.16, t + 0.01, true);
    },
    levelup: function (t) {
      var f = [523, 659, 880];
      for (var i = 0; i < f.length; i++) bell(f[i], 0.55, 0.17, t + i * 0.09, true);
      osc('sine', 130, 65, t, 0.4, 0.35);
      SFX.sparkle(t + 0.24);
    },
    rankup: function (t, freq) { bell(freq || 880, 0.5, 0.2, t, true); bell((freq || 880) * 1.5, 0.5, 0.12, t + 0.06, true); },
    riser: function (t, dur) {
      dur = dur || 1.5;
      noise(dur, t, 0.14, 'bandpass', 300, 4000, 1.2, true);
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(900, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.12);
    },
    impact: function (t) {
      osc('sine', 130, 34, t, 0.55, 0.6);
      osc('sine', 30, 30, t, 0.5, 0.3);
      noise(0.18, t, 0.35, 'lowpass', 1200, 200, 0.7, true);
      osc('triangle', 320, 300, t, 0.4, 0.14, 0.002, true);
    },
  };

  window.OSRSfx = {
    enabled: true,
    bpm: 120,
    arm: function () { var c = ensure(); if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} } return !!c; },
    isRunning: function () { return !!ac && ac.state === 'running'; },
    fire: function (name, arg) {
      if (!this.enabled) return;
      var c = ensure();
      if (!c || c.state !== 'running') return; // no gesture yet / suspended
      var fn = SFX[name];
      if (fn) { try { fn(now() + 0.001, arg); } catch (e) {} }
    },
    test: function () { var c = ensure(); if (c) SFX.levelup(now() + 0.05); },
  };
})();
