// OSR — "Oil Strategic Reserve" gameplay trailer.
// Six scenes played through window.SceneStage. Every visual is lifted from the
// real game: exact tokens (globals.css / tailwind.config.ts), the real chrome
// (TopRibbon/Header/NavBar), the authored HD rig renders (masked into the
// compound exactly as the app does), the crate-open cinematic phases, the
// rarity system, and the real economy numbers.

const { useScene, Easing, clamp } = window;
const R = window.React;

/* ---- design tokens (from the OSR codebase) ------------------------------ */
const FD = "'Space Grotesk', system-ui, sans-serif";
const FM = "'JetBrains Mono', ui-monospace, monospace";
const C = {
  ink950: '#060606', ink900: '#0b0b0b', ink850: '#101010', ink800: '#171717',
  ink750: '#1d1d1d', ink700: '#242424', ink600: '#333333',
  s100: '#f4f4f4', s200: '#dedede', s300: '#b5b5b5', s400: '#8e8e8e', s500: '#6b6b6b', s600: '#4a4a4a',
  a100: '#ffe0a3', a300: '#ffc656', a400: '#f5a623', a600: '#c9761a', a700: '#9b5513',
  green: '#00c805', purple: '#b34dff',
  line: 'rgba(255,255,255,.10)',
};
const GOLD = 'linear-gradient(135deg,#ffe0a3 0%,#f5a623 42%,#c9761a 100%)';
const PANEL_BG = 'linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,0) 60%), #131313';
const PANEL_SH = '0 1px 0 rgba(255,255,255,.045) inset, 0 16px 40px -24px rgba(0,0,0,.95)';
const APP_BG = 'radial-gradient(1200px 640px at 78% 112%, rgba(245,166,35,.12), transparent 60%),'
  + 'radial-gradient(900px 520px at 12% -8%, rgba(0,200,5,.07), transparent 55%),'
  + 'linear-gradient(180deg,#080808 0%,#0b0b0b 42%,#0e0e0e 100%)';
const VIEW_BG = 'radial-gradient(120% 90% at 50% 8%,#20364d 0%,#16283c 34%,#0d1826 68%,#0a121d 100%)';
const SKY_BG = 'linear-gradient(180deg,#0a0a1e 0%,#241338 26%,#5b2a3f 54%,#9a4d34 76%,#c8763a 100%)';
const RARITY = {
  common: '#b0b0b0', uncommon: '#4dd94d', rare: '#4d80ff', epic: '#b34dff',
  legendary: '#ffd900', mythic: '#ff3333', divine: '#ffffff',
};
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'divine'];
const RARITY_LABEL = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic',
  legendary: 'Legendary', mythic: 'Mythic', divine: 'Divine',
};

/* ---- tiny animation helpers --------------------------------------------- */
function seg(p, a, b, from, to, ease) {
  const e = ease || Easing.easeInOutCubic;
  if (p <= a) return from;
  if (p >= b) return to;
  return from + (to - from) * e((p - a) / (b - a));
}
const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
function fmtK(n, d = 1) {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(d) + 'M';
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(d) + 'K';
  return n.toFixed(d);
}

/* ---- reusable UI primitives (match the real components) ----------------- */
function Panel({ style, children, bd }) {
  return R.createElement('div', {
    style: {
      borderRadius: 14, background: PANEL_BG,
      border: '1px solid ' + (bd || C.line), boxShadow: PANEL_SH,
      backdropFilter: 'blur(8px)', ...style,
    },
  }, children);
}
function Label({ children, style }) {
  return R.createElement('div', {
    style: { fontFamily: FM, fontSize: 10.5, letterSpacing: '.22em', textTransform: 'uppercase', color: C.s400, whiteSpace: 'nowrap', ...style },
  }, children);
}
function GoldText({ children, style }) {
  return R.createElement('span', {
    style: { background: GOLD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', ...style },
  }, children);
}
function GoldBtn({ children, style, sweepT }) {
  const sweep = sweepT != null;
  const off = sweep ? ((sweepT % 3.2) / 3.2) : 0;
  return R.createElement('div', {
    style: {
      position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 8, borderRadius: 11, background: GOLD, color: '#2a1705',
      fontFamily: FD, fontWeight: 700, boxShadow: '0 10px 26px -12px rgba(245,166,35,.7),0 1px 0 rgba(255,255,255,.25) inset',
      boxSizing: 'border-box',
      ...style,
    },
  },
    sweep && R.createElement('div', {
      style: {
        position: 'absolute', top: 0, bottom: 0, width: '42%',
        left: (-40 + off * 180) + '%',
        background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent)',
        transform: 'skewX(-18deg)',
      },
    }),
    R.createElement('span', { style: { position: 'relative' } }, children),
  );
}
function Cursor({ x, y, press = 0 }) {
  return R.createElement('div', {
    style: {
      position: 'absolute', left: x, top: y, zIndex: 90, pointerEvents: 'none',
      transform: `translate(-3px,-2px) scale(${1 - press * 0.16})`, transformOrigin: '3px 3px',
      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.55))', transition: 'none',
    },
  },
    R.createElement('svg', { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none' },
      R.createElement('path', { d: 'M4 2l6.5 16 2.3-6.4 6.4-2.3L4 2z', fill: '#fff', stroke: '#111', strokeWidth: 1.2, strokeLinejoin: 'round' }),
    ),
    press > 0.3 && R.createElement('div', {
      style: {
        position: 'absolute', left: 2, top: 2, width: 34, height: 34, marginLeft: -17, marginTop: -17,
        borderRadius: '50%', border: '2px solid rgba(245,166,35,.8)',
        transform: `scale(${0.4 + press * 1.2})`, opacity: (1 - press) * 0.9,
      },
    }),
  );
}
// Authored HD rig render, seated into the scene with the radial mask the app uses.
function MaskedRig({ src, style, mask }) {
  const m = mask || 'radial-gradient(ellipse 74% 82% at 50% 47%,#000 55%,transparent 82%)';
  return R.createElement('img', {
    src, alt: '',
    style: {
      position: 'absolute', objectFit: 'contain',
      WebkitMaskImage: m, maskImage: m,
      filter: 'drop-shadow(0 30px 44px rgba(0,0,0,.6)) saturate(1.05)', ...style,
    },
  });
}
// Live three.js render of the REAL authored GLB (osr-3d web component).
function Rig3D({ layout, prog, deploy, style }) {
  const props = { layout, prog: (prog || 0).toFixed(4), style: { position: 'absolute', inset: 0, ...style } };
  if (deploy != null) props.deploy = deploy.toFixed(3);
  return R.createElement('osr-3d', props);
}
// Fires scene SFX on the real visual beats. events: [[localTime, name, arg?], …].
// Only fires on forward playback (small positive dt) so scrubbing/paused frames
// stay silent; each scene mounts fresh so the schedule resets per pass.
function useSfx(events) {
  const { localTime } = useScene();
  const S = R.useRef({ last: 0, fired: {} });
  R.useEffect(() => {
    const st = S.current, lt = localTime, dt = lt - st.last;
    const Sfx = window.OSRSfx;
    if (Sfx && Sfx.enabled && dt > 0 && dt < 0.34) {
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (!st.fired[i] && e[0] > st.last && e[0] <= lt) { Sfx.fire(e[1], e[2]); st.fired[i] = 1; }
      }
    }
    st.last = lt;
  }, [localTime]);
}
function StatusPill({ children, color, style }) {
  return R.createElement('div', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 999,
      border: `1px solid ${color}55`, background: 'rgba(10,10,10,.6)', backdropFilter: 'blur(8px)',
      fontFamily: FM, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color, ...style,
    },
  },
    R.createElement('span', { style: { width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 7px ${color}` } }),
    children,
  );
}

/* ---- app chrome (TopRibbon + Header + NavBar) --------------------------- */
const NAV = ['Command', 'Inventory', 'Vault', 'Ops', 'Market', 'Tokenomics', 'Leaderboard', 'Profile', 'Guide'];
function Chrome({ active = 'Command', balance = '1,000', wallet = '0x7A…4c2f', y = 0 }) {
  return R.createElement(R.Fragment, null,
    // mainnet ribbon
    R.createElement('div', {
      style: {
        position: 'absolute', top: y, left: 0, right: 0, height: 24, display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 8, background: 'linear-gradient(90deg,transparent,rgba(0,200,5,.09),transparent)',
        borderBottom: '1px solid rgba(0,200,5,.18)', fontFamily: FM, fontSize: 10, letterSpacing: '.24em',
        textTransform: 'uppercase', color: C.green,
      },
    },
      R.createElement('span', { style: { width: 6, height: 6, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}` } }),
      'Robinhood Chain — Mainnet · chain 4663 · gas ETH',
    ),
    // header
    R.createElement('div', {
      style: {
        position: 'absolute', top: y + 24, left: 0, right: 0, height: 52, display: 'flex', alignItems: 'center',
        gap: 12, padding: '0 22px', background: 'rgba(8,8,8,.82)', borderBottom: '1px solid ' + C.line,
      },
    },
      R.createElement('img', { src: 'assets/logo.jpg', alt: '', style: { width: 32, height: 32, borderRadius: 9, boxShadow: '0 0 0 1px rgba(245,166,35,.4),0 6px 18px -6px rgba(245,166,35,.5)' } }),
      R.createElement('div', { style: { lineHeight: 1 } },
        R.createElement(GoldText, { style: { fontFamily: FM, fontWeight: 700, fontSize: 17, letterSpacing: '.28em' } }, 'OSR'),
        R.createElement('div', { style: { fontFamily: FM, fontSize: 8, letterSpacing: '.32em', textTransform: 'uppercase', color: C.s500, marginTop: 3 } }, 'Oil Strategic Reserve'),
      ),
      R.createElement('div', { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 } },
        R.createElement('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 10,
            background: C.ink800, border: '1px solid rgba(245,166,35,.32)', fontFamily: FM, fontSize: 12.5, color: C.a300,
          },
        },
          R.createElement('span', { style: { width: 15, height: 15, borderRadius: '50%', background: GOLD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#3a1e05' } }, '◆'),
          balance, R.createElement('span', { style: { color: C.s500, fontSize: 10.5 } }, 'OSR'),
        ),
        R.createElement('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10,
            border: '1px solid ' + C.line, background: C.ink800, fontFamily: FM, fontSize: 12, fontWeight: 600, color: C.s200,
          },
        },
          R.createElement('span', { style: { width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 7px ${C.green}` } }), wallet,
        ),
      ),
    ),
    // nav
    R.createElement('div', {
      style: {
        position: 'absolute', top: y + 76, left: 0, right: 0, height: 40, display: 'flex', gap: 3, alignItems: 'center',
        padding: '0 18px', background: 'rgba(8,8,8,.6)', borderBottom: '1px solid ' + C.line, overflow: 'hidden',
      },
    },
      NAV.map((n) => {
        const on = n === active;
        return R.createElement('div', {
          key: n,
          style: {
            display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, padding: '7px 12px', borderRadius: 9,
            border: '1px solid ' + (on ? 'rgba(245,166,35,.4)' : 'transparent'), background: on ? 'rgba(245,166,35,.15)' : 'transparent',
            color: on ? C.a300 : C.s300, fontFamily: FM, fontSize: 10.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase',
          },
        }, n);
      }),
    ),
  );
}

/* cinematic vignette overlay for the in-app scenes */
function Vignette({ z = 55 }) {
  return R.createElement('div', {
    style: {
      position: 'absolute', inset: 0, zIndex: z, pointerEvents: 'none',
      background: 'radial-gradient(125% 105% at 50% 42%, transparent 52%, rgba(0,0,0,.42) 100%)',
      boxShadow: 'inset 0 0 200px 30px rgba(0,0,0,.5)',
    },
  });
}
/* slow-drifting embers */
function Embers({ t, count = 22, color = 'rgba(255,206,90,' }) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    const seed = i * 53.13;
    const dur = 6 + (i % 5);
    const ph = ((t / dur) + (i / count)) % 1;
    const x = 90 + ((seed * 7) % 1100);
    const y = 700 - ph * 760;
    const o = Math.sin(ph * Math.PI) * (0.5 + 0.4 * ((i % 3) / 3));
    const s = 1.5 + (i % 4) * 0.9;
    arr.push(R.createElement('div', { key: i, style: { position: 'absolute', left: x + Math.sin(ph * 6 + seed) * 18, top: y, width: s, height: s, borderRadius: '50%', background: color + o + ')', boxShadow: `0 0 ${s * 3}px ${color}${o * 0.8})`, pointerEvents: 'none' } }));
  }
  return R.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' } }, arr);
}

/* trailer lower-third caption */
function Caption({ p, text, sub, a = 0.06, b = 0.9, x = 64, bottom = 54 }) {
  const inn = seg(p, a, a + 0.08, 0, 1, Easing.easeOutCubic);
  const out = seg(p, b - 0.08, b, 0, 1, Easing.easeInCubic);
  const op = inn * (1 - out);
  const y = (1 - inn) * 22 + out * -14;
  return R.createElement('div', {
    style: {
      position: 'absolute', left: x, bottom, zIndex: 60, opacity: op, transform: `translateY(${y}px)`,
    },
  },
    R.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
      R.createElement('div', { style: { width: seg(p, a, a + 0.12, 0, 48, Easing.easeOutCubic), height: 3, background: GOLD, borderRadius: 2 } }),
      sub && R.createElement('div', { style: { fontFamily: FM, fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', color: C.a300 } }, sub),
    ),
    R.createElement('div', {
      style: {
        marginTop: 8, fontFamily: FD, fontWeight: 700, fontSize: 40, letterSpacing: '-.01em', color: '#fff',
        textShadow: '0 4px 24px rgba(0,0,0,.6)',
      },
    }, text),
  );
}

/* =========================================================================
   SCENE 1 — THE RESERVE (landing)
   ========================================================================= */
function SceneReserve() {
  const { progress: p, localTime: t } = useScene();
  useSfx([[0.06, 'whoosh', 0.6], [1.2, 'impact'], [3.0, 'chime', 700], [5.2, 'sparkle']]);
  const zoom = seg(p, 0, 1, 1.04, 1.12, Easing.linear);
  const rise = (d) => seg(p, 0.02 + d, 0.16 + d, 40, 0, Easing.easeOutCubic);
  const fade = (d) => seg(p, 0.02 + d, 0.16 + d, 0, 1, Easing.easeOutCubic);
  // Every figure here has to be true at launch. '229M supply' was the old
  // tokenomics (it is 1B now), and '12,847 nodes deployed' was invented — the
  // live network has none, and a made-up usage count in the official trailer
  // reads as a real metric to anyone watching.
  const stats = [
    ['1B', 'OSR supply'], ['100M', 'mining reserve'], ['7', 'rarity tiers'], ['30%', 'share cap'],
  ];
  const bob = (a, s) => Math.sin(t * s) * a;
  return R.createElement('div', { style: { position: 'absolute', inset: 0, overflow: 'hidden', background: SKY_BG } },
    // zoom wrapper
    R.createElement('div', { style: { position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: '50% 58%' } },
      // stars
      R.createElement('div', { style: { position: 'absolute', inset: '0 0 55% 0', background: 'radial-gradient(1px 1px at 20% 30%,rgba(255,255,255,.5),transparent),radial-gradient(1px 1px at 70% 20%,rgba(255,255,255,.4),transparent),radial-gradient(1px 1px at 45% 12%,rgba(255,255,255,.35),transparent),radial-gradient(1px 1px at 85% 40%,rgba(255,255,255,.3),transparent)' } }),
      // sun
      R.createElement('div', { style: { position: 'absolute', left: 'calc(50% - 150px)', top: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,#ffe6a8 0%,#ffb04d 32%,rgba(255,140,60,.35) 55%,transparent 72%)', filter: 'blur(2px)', opacity: 0.85 + 0.1 * Math.sin(t) } }),
      // horizon haze
      R.createElement('div', { style: { position: 'absolute', left: 0, right: 0, top: '46%', height: '16%', background: 'linear-gradient(180deg,transparent,rgba(255,180,110,.55),transparent)', filter: 'blur(8px)' } }),
      // ground wash
      R.createElement('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '52%', background: 'radial-gradient(60% 92% at 50% 122%,rgba(245,166,35,.34),transparent 62%)' } }),
      // real authored compound (oil rig + mining shaft + sand GLBs)
      R.createElement('div', { style: { position: 'absolute', inset: 0, opacity: seg(p, 0.04, 0.32, 0, 1, Easing.easeOutCubic) } },
        R.createElement(Rig3D, { layout: 'compound', prog: p }),
      ),
      // floating OSR tokens
      [['16%', '40%', 44], ['82%', '32%', 32], ['73%', '66%', 24]].map(([l, tp, s], i) =>
        R.createElement('div', {
          key: i, style: {
            position: 'absolute', left: l, top: tp, width: s, height: s, borderRadius: '50%', background: GOLD,
            boxShadow: '0 0 22px rgba(245,166,35,.7),inset 0 0 0 2px rgba(255,255,255,.35)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: s * 0.44, color: '#3a1e05',
            transform: `translateY(${bob(10, 0.5 + i * 0.15)}px)`, opacity: fade(0.2),
          },
        }, '◆')),
      // vignette
      R.createElement('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(85% 70% at 50% 44%,rgba(6,8,13,.5),transparent 60%),radial-gradient(130% 95% at 50% 42%,transparent 46%,rgba(6,8,13,.72) 100%)' } }),
    ),
    // header
    R.createElement('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '20px 26px', opacity: fade(0), transform: `translateY(${seg(p, 0.02, 0.16, -24, 0, Easing.easeOutCubic)}px)` } },
      R.createElement('img', { src: 'assets/logo.jpg', alt: '', style: { width: 40, height: 40, borderRadius: 11, boxShadow: '0 0 0 1px rgba(245,166,35,.5),0 8px 22px -6px rgba(245,166,35,.6)' } }),
      R.createElement('div', { style: { lineHeight: 1.1 } },
        R.createElement(GoldText, { style: { fontFamily: FM, fontWeight: 700, fontSize: 19, letterSpacing: '.3em' } }, 'OSR'),
        R.createElement('div', { style: { fontFamily: FM, fontSize: 8.5, letterSpacing: '.32em', textTransform: 'uppercase', color: 'rgba(255,224,170,.7)' } }, 'Oil Strategic Reserve'),
      ),
      R.createElement('div', { style: { marginLeft: 'auto', display: 'flex', gap: 10 } },
        R.createElement(StatusPill, { color: C.green }, 'Season 1 · Halving Live'),
        R.createElement(StatusPill, { color: C.a400 }, 'Connect Wallet'),
      ),
    ),
    // hero lockup
    R.createElement('div', { style: { position: 'absolute', left: '50%', top: '44%', transform: 'translate(-50%,-50%)', textAlign: 'center', width: 'min(92%,820px)' } },
      R.createElement('div', { style: { display: 'inline-flex', padding: '6px 15px', borderRadius: 999, border: '1px solid rgba(245,166,35,.35)', background: 'rgba(10,10,10,.4)', backdropFilter: 'blur(6px)', fontFamily: FM, fontSize: 10.5, letterSpacing: '.24em', textTransform: 'uppercase', color: 'rgba(255,224,170,.85)', opacity: fade(0.12), transform: `translateY(${rise(0.12)}px)` } }, 'Build · Mine · Compound'),
      R.createElement('h1', { style: { margin: '16px 0 0', fontFamily: FD, fontSize: 84, lineHeight: 0.98, fontWeight: 700, letterSpacing: '-.02em', color: '#fff' } },
        R.createElement('span', { style: { display: 'inline-block', opacity: fade(0.18), transform: `translateY(${rise(0.18)}px)` } }, 'The on-chain'),
        R.createElement('br'),
        R.createElement('span', { style: { display: 'inline-block', background: 'linear-gradient(135deg,#ffe0a3,#f5a623 46%,#ff7a29)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', opacity: fade(0.26), transform: `translateY(${rise(0.26)}px)` } }, 'oil empire.'),
      ),
      R.createElement('p', { style: { margin: '18px auto 0', maxWidth: 520, fontFamily: FD, fontSize: 16, lineHeight: 1.6, color: 'rgba(255,240,225,.85)', textShadow: '0 2px 12px rgba(0,0,0,.5)', opacity: fade(0.34) } }, 'Deploy rigs and mining shafts across your 3D compound. Open crates, equip rarity gear, and climb the reserve on Robinhood Chain.'),
      R.createElement('div', { style: { marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15, opacity: fade(0.42), transform: `translateY(${rise(0.42)}px)` } },
        R.createElement(GoldBtn, { sweepT: t, style: { width: 390, padding: '17px 40px', fontSize: 19, borderRadius: 14 } }, '▶  Enter the Reserve'),
        R.createElement('div', { style: { fontFamily: FM, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(255,224,170,.75)', opacity: 0.5 + 0.5 * Math.abs(Math.sin(t * 1.6)) } }, 'Deploy your first rig to begin'),
      ),
    ),
    // stat strip
    R.createElement('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', gap: 10, padding: '20px 26px 26px', background: 'linear-gradient(180deg,transparent,rgba(6,6,6,.55))' } },
      stats.map(([v, l], i) => R.createElement('div', {
        key: l, style: {
          display: 'flex', alignItems: 'center', gap: 9, padding: '9px 18px', borderRadius: 12,
          border: '1px solid rgba(245,166,35,.22)', background: 'rgba(10,10,10,.5)', backdropFilter: 'blur(8px)',
          opacity: fade(0.5 + i * 0.05), transform: `translateY(${rise(0.5 + i * 0.05)}px)`,
        },
      },
        R.createElement('span', { style: { fontFamily: FM, fontSize: 19, fontWeight: 700, color: C.a300 } }, v),
        R.createElement('span', { style: { fontFamily: FM, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,224,170,.65)' } }, l),
      )),
    ),
  );
}

/* =========================================================================
   SCENE 2 — DEPLOY
   ========================================================================= */
function SidebarDeploy({ nodeCount, capPct, cursorInNodes }) {
  return R.createElement('div', { style: { position: 'absolute', left: 16, top: 128, width: 322, display: 'flex', flexDirection: 'column', gap: 12 } },
    // compound header
    R.createElement(Panel, { style: { padding: 16 } },
      R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
        R.createElement('div', null,
          R.createElement(Label, null, 'Compound Level'),
          R.createElement('div', { style: { fontFamily: FD, fontSize: 34, fontWeight: 700, lineHeight: 1, marginTop: 5, color: '#fff' } }, 'L', R.createElement(GoldText, null, '1')),
        ),
        R.createElement('div', { style: { textAlign: 'right', minWidth: 152 } },
          R.createElement(Label, null, 'Capacity'),
          R.createElement('div', { style: { fontSize: 11.5, color: C.s300, marginTop: 5, whiteSpace: 'nowrap' } }, nodeCount >= 3 ? '2/2 rigs · 1/2 shafts' : '1/2 rigs · 1/2 shafts'),
          R.createElement('div', { style: { fontSize: 10, color: C.s500, marginTop: 3, whiteSpace: 'nowrap' } }, '3 crates / family / day'),
        ),
      ),
      R.createElement('div', { style: { marginTop: 12, height: 6, borderRadius: 99, background: C.ink700, overflow: 'hidden' } },
        R.createElement('div', { style: { height: '100%', borderRadius: 99, background: GOLD, width: capPct + '%', boxShadow: '0 0 12px rgba(245,166,35,.5)' } }),
      ),
      R.createElement('div', { style: { marginTop: 6, display: 'flex', justifyContent: 'space-between', fontFamily: FM, fontSize: 10, color: C.s500 } },
        R.createElement('span', null, nodeCount + ' / 4 nodes online'), R.createElement('span', null, 'Next: L2'),
      ),
    ),
    // earnings (compact)
    R.createElement(Panel, { style: { padding: 16 } },
      R.createElement(Label, null, 'Estimated Daily Earnings'),
      R.createElement('div', { style: { marginTop: 6, fontFamily: FD, fontSize: 26, fontWeight: 700, color: C.a300, lineHeight: 1 } }, nodeCount >= 3 ? '4.8K ' : '2.9K ', R.createElement('span', { style: { fontSize: 13, color: C.s400, fontWeight: 500 } }, 'OSR / day')),
      R.createElement('div', { style: { marginTop: 10, display: 'flex', justifyContent: 'space-between', fontFamily: FM, fontSize: 10.5 } },
        R.createElement('span', { style: { letterSpacing: '.16em', textTransform: 'uppercase', color: C.s400 } }, 'Network Share'),
        R.createElement('span', { style: { color: C.a400 } }, 'Halving Active'),
      ),
      R.createElement('div', { style: { marginTop: 6, height: 6, borderRadius: 99, background: C.ink700, overflow: 'hidden' } },
        R.createElement('div', { style: { height: '100%', borderRadius: 99, background: GOLD, width: '38%' } }),
      ),
    ),
    // nodes panel with Deploy
    R.createElement(Panel, { style: { padding: 16 } },
      R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 } },
        R.createElement(Label, null, 'Your Nodes'),
        R.createElement('span', { style: { fontFamily: FM, fontSize: 11, color: C.s400 } }, nodeCount + ' / 4'),
      ),
      R.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 7 } },
        R.createElement(NodeRow, { glyph: '⛽', name: 'Oil Rig · L2', pending: '312', on: false }),
        R.createElement(NodeRow, { glyph: '⛏', name: 'Mining Shaft · L1', pending: '146', on: false }),
        nodeCount >= 3 && R.createElement(NodeRow, { glyph: '⛽', name: 'Oil Rig · L1', pending: '0', on: true }),
      ),
      R.createElement('div', { style: { marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 } },
        R.createElement('div', {
          style: {
            padding: 11, borderRadius: 11, background: GOLD, color: '#2a1705', fontFamily: FD, fontSize: 13, fontWeight: 700,
            textAlign: 'center', boxShadow: cursorInNodes ? '0 0 0 2px rgba(255,255,255,.5),0 10px 26px -12px rgba(245,166,35,.9)' : '0 10px 26px -12px rgba(245,166,35,.7)',
          },
        }, 'Deploy Node'),
        R.createElement('div', { style: { padding: 11, borderRadius: 11, border: '1px solid ' + C.line, background: C.ink800, color: C.s200, fontFamily: FD, fontSize: 13, fontWeight: 600, textAlign: 'center' } }, 'Open Crate'),
      ),
    ),
  );
}
function NodeRow({ glyph, name, pending, on }) {
  return R.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 11,
      border: '1px solid ' + (on ? 'rgba(245,166,35,.5)' : C.ink600), background: on ? 'rgba(245,166,35,.1)' : C.ink800,
    },
  },
    R.createElement('span', { style: { width: 30, height: 30, flexShrink: 0, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, background: C.ink750, border: '1px solid ' + C.ink600 } }, glyph),
    R.createElement('span', { style: { minWidth: 0 } },
      R.createElement('span', { style: { display: 'block', fontSize: 12.5, fontWeight: 600, color: C.s100 } }, name),
    ),
    R.createElement('span', { style: { marginLeft: 'auto', fontFamily: FM, fontSize: 12, color: C.a300, textAlign: 'right' } }, pending, R.createElement('span', { style: { display: 'block', fontSize: 8, color: C.s500, letterSpacing: '.1em' } }, 'OSR')),
  );
}
function Viewport({ p, showNew, flash, children }) {
  return R.createElement('div', {
    style: {
      position: 'absolute', left: 352, top: 128, right: 16, bottom: 20, borderRadius: 18, overflow: 'hidden',
      border: '1px solid ' + C.line, boxShadow: PANEL_SH, background: VIEW_BG,
    },
  },
    R.createElement('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(70% 55% at 50% 108%,rgba(245,166,35,.3),transparent 60%)' } }),
    R.createElement('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%', background: 'linear-gradient(180deg,transparent,rgba(196,120,52,.32) 55%,rgba(150,88,40,.5) 100%)' } }),
    children,
    // flash on deploy
    flash > 0 && R.createElement('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(40% 50% at 62% 62%,rgba(255,214,150,' + flash + '),transparent 70%)', pointerEvents: 'none' } }),
  );
}
function SceneDeploy() {
  const { progress: p, localTime: t } = useScene();
  useSfx([[0.06, 'whoosh', 0.55], [3.1, 'click'], [6.2, 'click'], [6.45, 'thud'], [6.7, 'chime', 660], [8.0, 'sparkle']]);
  // timeline: 0-.18 move to Deploy Node | .2-.24 click (opens modal) | .28-.4 move to
  // modal button | .44-.48 click (deploys) | .52-.7 drift to the new rig
  const modalOn = p > 0.24 && p < 0.5;
  const modalScale = p < 0.4 ? seg(p, 0.24, 0.34, 0.9, 1, Easing.easeOutBack) : seg(p, 0.46, 0.5, 1, 0.94, Easing.easeInCubic);
  const modalOp = p < 0.4 ? seg(p, 0.24, 0.32, 0, 1) : seg(p, 0.46, 0.5, 1, 0);
  const deployed = p > 0.48;
  const flash = seg(p, 0.48, 0.53, 0, 0.9) * (1 - seg(p, 0.53, 0.66, 0, 1));
  const newRig = seg(p, 0.48, 0.66, 0, 1, Easing.easeOutBack);
  // cursor path — targets measured button centres: Deploy Node (103,573), modal
  // Deploy button (640,503)
  let cx = 103, cy = 573, press = 0;
  if (p < 0.18) { cx = seg(p, 0, 0.18, 900, 103, Easing.easeInOutCubic); cy = seg(p, 0, 0.18, 360, 573, Easing.easeInOutCubic); }
  else if (p < 0.28) { cx = 103; cy = 573; press = seg(p, 0.2, 0.24, 0, 1) * (1 - seg(p, 0.24, 0.28, 0, 1)); }
  else if (p < 0.4) { cx = seg(p, 0.28, 0.4, 103, 640, Easing.easeInOutCubic); cy = seg(p, 0.28, 0.4, 573, 503, Easing.easeInOutCubic); }
  else if (p < 0.52) { cx = 640; cy = 503; press = seg(p, 0.44, 0.48, 0, 1) * (1 - seg(p, 0.48, 0.52, 0, 1)); }
  else { cx = seg(p, 0.52, 0.7, 640, 820, Easing.easeInOutCubic); cy = seg(p, 0.52, 0.7, 503, 300, Easing.easeInOutCubic); }
  const cursorInNodes = p > 0.14 && p < 0.28;
  const settle = seg(p, 0, 0.12, 0, 1, Easing.easeOutCubic);
  return R.createElement('div', { style: { position: 'absolute', inset: 0, background: APP_BG } },
    R.createElement('div', { style: { opacity: settle } }, R.createElement(Chrome, { active: 'Command', balance: '1,000' })),
    R.createElement('div', { style: { position: 'absolute', inset: 0, opacity: settle, transform: `translateX(${(1 - settle) * -24}px)` } },
      R.createElement(SidebarDeploy, { nodeCount: deployed ? 3 : 2, capPct: deployed ? 50 : 33, cursorInNodes }),
    ),
    R.createElement('div', { style: { position: 'absolute', inset: 0, opacity: settle, transform: `translateX(${(1 - settle) * 24}px)` } },
      R.createElement(Viewport, { p, flash },
        R.createElement(Rig3D, { layout: 'compound', prog: p, deploy: deployed ? newRig : 0 }),
        // showroom badge
        R.createElement('div', { style: { position: 'absolute', left: 16, top: 16, maxWidth: 280, padding: '10px 13px', borderRadius: 12, border: '1px solid rgba(245,166,35,.4)', background: 'rgba(10,10,10,.8)', backdropFilter: 'blur(8px)' } },
          R.createElement('div', { style: { fontFamily: FM, fontSize: 10, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: C.a400 } }, 'Live compound · ' + (deployed ? 3 : 2) + ' nodes online'),
          R.createElement('div', { style: { fontSize: 11.5, color: C.s300, marginTop: 4 } }, 'Full Blender-authored rigs · sunset preset'),
        ),
        // camera dock
        R.createElement('div', { style: { position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 4, padding: 5, borderRadius: 999, border: '1px solid ' + C.line, background: 'rgba(10,10,10,.86)', backdropFilter: 'blur(10px)' } },
          R.createElement('span', { style: { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.s200, fontSize: 18 } }, '←'),
          R.createElement('span', { style: { minWidth: 168, textAlign: 'center', fontFamily: FM, fontSize: 10.5, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: C.a400 } }, 'Compound Overview'),
          R.createElement('span', { style: { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.s200, fontSize: 18 } }, '→'),
        ),
      ),
    ),
    // deploy toast
    deployed && R.createElement('div', { style: { position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 70, padding: '9px 18px', borderRadius: 999, border: '1px solid ' + C.ink600, background: C.ink800, color: C.s200, fontSize: 13.5, opacity: seg(p, 0.6, 0.68, 0, 1) * (1 - seg(p, 0.9, 1, 0, 1)) } }, 'Node deployed — production started'),
    // deploy modal
    modalOn && R.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(6,6,6,.72)', opacity: modalOp, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      R.createElement(Panel, { bd: C.ink600, style: { width: 420, padding: 18, background: C.ink800, transform: `scale(${modalScale})` } },
        R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 } },
          R.createElement('div', { style: { fontFamily: FM, fontSize: 13, letterSpacing: '.2em', textTransform: 'uppercase', color: C.a400 } }, 'Deploy Node'),
          R.createElement('div', { style: { color: C.s400 } }, '✕'),
        ),
        R.createElement(DeployOption, { src: 'assets/oil-rig-hd.png', name: 'Oil Rig', cost: '1,000', desc: 'Offshore platform. Earns OSR · unlocks xStock dividends at L5+.', cap: '1/2', sel: true }),
        R.createElement('div', { style: { height: 10 } }),
        R.createElement(DeployOption, { src: 'assets/mining-shaft-hd.png', name: 'Mining Shaft', cost: '750', desc: 'Underground op. Compoundable at 0.75% · bonus slots at L5/7/9.', cap: '1/2', sel: false }),
        R.createElement('div', { style: { marginTop: 14 } }, R.createElement(GoldBtn, { style: { width: '100%', padding: 13, fontSize: 14 } }, 'Deploy · Starting level L1')),
      ),
    ),
    R.createElement(Vignette, null),
    R.createElement(Caption, { p, sub: 'Chapter I', text: 'DEPLOY YOUR RIGS', a: 0.62, b: 0.98, x: 388 }),
    R.createElement(Cursor, { x: cx, y: cy, press }),
  );
}
function DeployOption({ src, name, cost, desc, cap, sel }) {
  return R.createElement('div', {
    style: {
      padding: 12, borderRadius: 12, border: '1px solid ' + (sel ? C.a400 : C.ink600), background: sel ? 'rgba(245,166,35,.1)' : C.ink850,
    },
  },
    R.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
      R.createElement('div', { style: { width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#000' } },
        R.createElement('img', { src, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover' } })),
      R.createElement('span', { style: { fontFamily: FD, fontWeight: 700, fontSize: 15, color: '#fff' } }, name),
      R.createElement('span', { style: { marginLeft: 'auto', fontFamily: FM, fontSize: 14, color: C.a300 } }, cost + ' OSR'),
    ),
    R.createElement('div', { style: { marginTop: 6, fontFamily: FM, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: C.s500 } }, 'Capacity ' + cap),
    R.createElement('p', { style: { margin: '5px 0 0', fontSize: 11.5, color: C.s400, lineHeight: 1.5 } }, desc),
  );
}

/* =========================================================================
   SCENE 3 — OPEN CRATE (cinematic)
   ========================================================================= */
function SceneCrate() {
  const { progress: p, localTime: t } = useScene();
  useSfx([[0.06, 'whoosh', 0.6], [1.8, 'rumble', 5.2], [3.5, 'uiTick'], [4.5, 'uiTick'], [5.4, 'uiTick'], [6.2, 'uiTick'], [7.0, 'crack'], [7.08, 'sparkle'], [8.4, 'levelup']]);
  // phases: intro 0-.1 | rumble .1-.4 | peak .4-.5 | detonate .5-.6 | reveal .6-1
  const rarity = 'legendary';
  const col = RARITY[rarity];
  const introOp = seg(p, 0.02, 0.12, 0, 1);
  // crate scale ramps then pops
  let crateScale = seg(p, 0.02, 0.4, 0.7, 1.15, Easing.easeInOutCubic);
  if (p >= 0.4 && p < 0.5) crateScale = 1.15;
  const detonate = p >= 0.5 && p < 0.62;
  const crateOp = p < 0.5 ? 1 : seg(p, 0.5, 0.58, 1, 0);
  const shake = (p > 0.12 && p < 0.5) ? (0.4 + (p - 0.12) * 6) : 0;
  const jx = Math.sin(t * 61) * shake * 3, jy = Math.sin(t * 53) * shake * 3;
  const seamGlow = seg(p, 0.1, 0.5, 6, 26, Easing.easeInQuad);
  // detonation flash + ring
  const flash = detonate ? seg(p, 0.5, 0.54, 1, 0, Easing.easeOutQuad) : 0;
  const ring = seg(p, 0.5, 0.66, 0, 1, Easing.easeOutCubic);
  const showCard = p > 0.6;
  const cardY = seg(p, 0.6, 0.72, 60, 0, Easing.easeOutBack);
  const cardOp = seg(p, 0.6, 0.7, 0, 1);
  // slot-machine ticker during intro/rumble
  const tickRarity = p < 0.5 ? RARITY_ORDER[Math.floor((t * 12) % 7)] : rarity;
  // glow pool follows the action from crate (top) down toward the reveal card
  const glowTop = seg(p, 0.5, 0.72, 50, 62);
  // sparkles: radial burst on detonate, then a gentle twinkle field under reveal
  const sparkles = [];
  if (p > 0.5) {
    for (let i = 0; i < 44; i++) {
      const ang = (i / 44) * Math.PI * 2;
      const rr = 40 + ((i * 37) % 300) * ring;
      const drift = Math.sin(t * 1.4 + i) * 7;
      const o = p < 0.66 ? (1 - ring) * 0.9 : 0.22 + 0.22 * Math.abs(Math.sin(t * 2 + i));
      sparkles.push({ x: Math.cos(ang) * rr, y: Math.sin(ang) * rr * 0.8 - 20 + (p >= 0.66 ? drift : 0), s: 2 + (i % 3), o });
    }
  }
  const zoom = seg(p, 0, 0.5, 1, 1.15, Easing.easeInCubic);
  return R.createElement('div', { style: { position: 'absolute', inset: 0, overflow: 'hidden', background: 'radial-gradient(circle at 50% 46%,#0c1018 0%,#05060a 70%)' } },
    // soft rotating beams (subtle, behind everything)
    R.createElement('div', { style: { position: 'absolute', inset: 0, opacity: seg(p, 0.3, 0.5, 0, 0.32) * (showCard ? 0.7 : 1), background: `conic-gradient(from 0deg at 50% ${glowTop}%, transparent 0deg, ${col}12 14deg, transparent 30deg, ${col}12 46deg, transparent 60deg)`, mixBlendMode: 'screen', transform: `rotate(${t * 6}deg)`, transformOrigin: `50% ${glowTop}%`, filter: 'blur(2px)' } }),
    R.createElement('div', { style: { position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: '50% 50%' } },
      // glow pool (tracks toward the reveal card)
      R.createElement('div', { style: { position: 'absolute', left: '50%', top: glowTop + '%', width: 560, height: 560, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: `radial-gradient(circle, ${col}${detonate || showCard ? '4d' : '22'} 0%, transparent 62%)`, filter: 'blur(10px)', opacity: introOp } }),
      // shock ring
      p > 0.5 && R.createElement('div', { style: { position: 'absolute', left: '50%', top: '50%', width: 120, height: 120, marginLeft: -60, marginTop: -60, borderRadius: '50%', border: `3px solid ${col}`, transform: `scale(${0.4 + ring * 5})`, opacity: (1 - ring) * 0.85 } }),
      // real authored legendary crate GLB (full-frame so lids never clip)
      R.createElement('div', { style: { position: 'absolute', inset: 0, opacity: introOp } },
        R.createElement(Rig3D, { layout: 'crate', prog: p }),
      ),
      // detonation flash
      flash > 0 && R.createElement('div', { style: { position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 44%, rgba(255,255,255,${flash}) 0%, ${col}${Math.round(flash * 90).toString(16).padStart(2, '0')} 20%, transparent 55%)` } }),
      // sparkles
      R.createElement('div', { style: { position: 'absolute', left: '50%', top: glowTop + '%' } },
        sparkles.map((s, i) => R.createElement('div', { key: i, style: { position: 'absolute', left: s.x, top: s.y, width: s.s, height: s.s, borderRadius: '50%', background: col, boxShadow: `0 0 6px ${col}`, opacity: s.o } })),
      ),
    ),
    // pity badge
    R.createElement('div', { style: { position: 'absolute', left: '50%', top: 46, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: seg(p, 0.05, 0.15, 0, 1) * (showCard ? seg(p, 0.66, 0.78, 1, 0) : 1) } },
      R.createElement('div', { style: { padding: '5px 12px', borderRadius: 6, border: '1px solid ' + C.a400, background: 'rgba(10,10,10,.8)', fontFamily: FM, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: C.a400 } }, 'Legendary+ Guaranteed'),
      !showCard && R.createElement('div', { style: { fontFamily: FM, fontSize: 26, fontWeight: 700, letterSpacing: '.3em', textTransform: 'uppercase', color: RARITY[tickRarity] } }, RARITY_LABEL[tickRarity]),
    ),
    // reward item — the real Derrick Tower render with a legendary aura
    showCard && R.createElement('div', { style: { position: 'absolute', left: '50%', top: '40%', transform: `translate(-50%,-50%) translateY(${cardY * 0.5}px)`, opacity: cardOp, zIndex: 6 } },
      R.createElement('div', { style: { position: 'absolute', left: '50%', top: '50%', width: 400, height: 400, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: `radial-gradient(circle, ${col}55 0%, ${col}1c 42%, transparent 68%)`, filter: 'blur(6px)' } }),
      R.createElement('div', { style: { position: 'absolute', left: '50%', top: '50%', width: 320, height: 320, marginLeft: -160, marginTop: -160, borderRadius: '50%', background: `conic-gradient(from ${t * 40}deg, transparent, ${col}, transparent 38%, ${col}bb, transparent 72%, ${col})`, WebkitMaskImage: 'radial-gradient(circle, transparent 61%, #000 63%, #000 69%, transparent 71%)', maskImage: 'radial-gradient(circle, transparent 61%, #000 63%, #000 69%, transparent 71%)', opacity: 0.9 } }),
      R.createElement('img', { src: 'assets/derrick.png', alt: '', style: { position: 'relative', height: 300, display: 'block', WebkitMaskImage: 'radial-gradient(ellipse 56% 74% at 50% 48%,#000 50%,transparent 78%)', maskImage: 'radial-gradient(ellipse 56% 74% at 50% 48%,#000 50%,transparent 78%)', filter: `drop-shadow(0 0 26px ${col}) drop-shadow(0 12px 24px rgba(0,0,0,.6))` } }),
    ),
    // reveal card
    showCard && R.createElement('div', { style: { position: 'absolute', left: '50%', bottom: 48, transform: `translate(-50%, ${cardY}px)`, opacity: cardOp, zIndex: 8 } },
      R.createElement(Panel, { style: { width: 340, padding: 22, textAlign: 'center', border: `2px solid ${col}`, boxShadow: `0 0 44px ${col}66` } },
        R.createElement('div', { style: { fontFamily: FM, fontSize: 12, letterSpacing: '.3em', textTransform: 'uppercase', color: col } }, 'Legendary'),
        R.createElement('div', { style: { marginTop: 4, fontFamily: FD, fontSize: 24, fontWeight: 700, color: '#fff' } }, 'Derrick Tower'),
        R.createElement('div', { style: { marginTop: 4, fontSize: 14, color: C.s300 } }, '50× multiplier'),
        R.createElement('div', { style: { marginTop: 10, fontSize: 11.5, color: C.s400 } }, '✓ Added to Inventory · equip from your rig'),
      ),
    ),
    R.createElement(Caption, { p, sub: 'Chapter II', text: 'CRACK THE CRATES', a: 0.14, b: 0.5 }),
  );
}

/* =========================================================================
   SCENE 4 — EQUIP
   ========================================================================= */
const OIL_SLOTS = [
  { key: 'derrick', glyph: '⛰', label: 'Derrick Tower' },
  { key: 'pump', glyph: '⚡', label: 'Pump Jack' },
  { key: 'pipe', glyph: '⛓', label: 'Pipeline' },
  { key: 'flare', glyph: '🔥', label: 'Flare Stack' },
];
function EquipSlot({ slot, rarity, mult, glowP }) {
  const col = rarity ? RARITY[rarity] : null;
  return R.createElement('div', {
    style: {
      borderRadius: 10, border: '1px solid ' + (col ? col + '99' : C.ink600), background: col ? col + '14' : C.ink800,
      padding: '11px 12px', boxShadow: col ? `0 0 ${glowP * 24}px ${col}66` : 'none', position: 'relative', overflow: 'hidden',
    },
  },
    R.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.s300 } },
      R.createElement('span', null, slot.glyph), slot.label),
    rarity
      ? R.createElement('div', { style: { marginTop: 4, fontFamily: FM, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: col } }, RARITY_LABEL[rarity] + ' · ' + mult + '×')
      : R.createElement('div', { style: { marginTop: 4, fontSize: 12, color: C.s500 } }, '— empty —'),
  );
}
function SceneEquip() {
  const { progress: p, localTime: t } = useScene();
  useSfx([[0.06, 'whoosh', 0.5], [5.04, 'equip', 523], [6.72, 'equip', 587], [7.44, 'equip', 659], [8.16, 'equip', 784], [9.2, 'sparkle']]);
  const settle = seg(p, 0, 0.1, 0, 1, Easing.easeOutCubic);
  // flying legendary card into derrick slot: .16-.42
  const flyOn = p > 0.14 && p < 0.44;
  const fly = seg(p, 0.16, 0.42, 0, 1, Easing.easeInOutCubic);
  const startX = 150, startY = 120, endX = 792, endY = 300; // approx derrick slot pos
  const fx = startX + (endX - startX) * fly, fy = startY + (endY - startY) * fly;
  const derrickFilled = p > 0.42;
  const derrickGlow = derrickFilled ? seg(p, 0.42, 0.5, 1, 0.35, Easing.easeOutQuad) + (Math.sin(t * 6) * 0.1) : 0;
  // other slots fill staggered
  const pumpFilled = p > 0.56, pipeFilled = p > 0.62, flareFilled = p > 0.68;
  // GP multiplier count up
  let gp = 1.0;
  if (derrickFilled) gp = seg(p, 0.42, 0.54, 1.0, 2.66, Easing.easeOutCubic);
  if (pumpFilled) gp = seg(p, 0.56, 0.62, 2.66, 3.4);
  if (pipeFilled) gp = seg(p, 0.62, 0.68, 3.4, 4.1);
  if (flareFilled) gp = seg(p, 0.68, 0.76, 4.1, 5.2);
  const daily = 2900 * (gp / 2.66);
  return R.createElement('div', { style: { position: 'absolute', inset: 0, background: APP_BG } },
    R.createElement('div', { style: { opacity: settle } }, R.createElement(Chrome, { active: 'Inventory', balance: '4,210' })),
    // left: rig in mini viewport
    R.createElement('div', { style: { position: 'absolute', left: 16, top: 128, width: 470, bottom: 20, borderRadius: 18, overflow: 'hidden', border: '1px solid ' + C.line, boxShadow: PANEL_SH, background: VIEW_BG, opacity: settle } },
      R.createElement('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(70% 55% at 50% 108%,rgba(245,166,35,.3),transparent 60%)' } }),
      R.createElement(Rig3D, { layout: 'rig', prog: p }),
      derrickGlow > 0 && R.createElement('div', { style: { position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 58%, ${RARITY.legendary}22, transparent 60%)`, opacity: derrickGlow, pointerEvents: 'none' } }),
      R.createElement('div', { style: { position: 'absolute', left: 16, top: 16, padding: '9px 13px', borderRadius: 12, border: '1px solid rgba(245,166,35,.4)', background: 'rgba(10,10,10,.8)', fontFamily: FM, fontSize: 10, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: C.a400 } }, 'Oil Rig · L1'),
    ),
    // right: node detail panel
    R.createElement('div', { style: { position: 'absolute', right: 16, top: 128, width: 720, opacity: settle } },
      R.createElement(Panel, { bd: 'rgba(245,166,35,.28)', style: { padding: 20 } },
        R.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 } },
          R.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
            R.createElement('span', { style: { width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: 'rgba(245,166,35,.12)', border: '1px solid rgba(245,166,35,.35)' } }, '⛽'),
            R.createElement('div', null,
              R.createElement('div', { style: { fontFamily: FD, fontSize: 17, fontWeight: 600, color: C.s100 } }, 'Oil Rig · L1'),
              R.createElement('div', { style: { fontFamily: FM, fontSize: 12, color: C.a300 } }, gp.toFixed(2) + '× grow-power'),
            ),
          ),
          R.createElement('div', { style: { textAlign: 'right' } },
            R.createElement(Label, null, 'Est. daily'),
            R.createElement('div', { style: { fontFamily: FD, fontSize: 20, fontWeight: 700, color: C.a300, marginTop: 3 } }, fmtK(daily) + ' OSR'),
          ),
        ),
        // storage bar
        R.createElement('div', { style: { marginBottom: 14 } },
          R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontFamily: FM, fontSize: 11, color: C.s400 } }, R.createElement('span', null, 'Storage'), R.createElement('span', null, fmtK(daily * 0.5 / 24) + ' / ' + fmtK(daily * 0.5) + ' OSR')),
          R.createElement('div', { style: { marginTop: 5, height: 6, borderRadius: 99, background: C.ink700, overflow: 'hidden' } },
            R.createElement('div', { style: { height: '100%', borderRadius: 99, background: C.a400, width: '42%' } })),
        ),
        // slots grid
        R.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
          R.createElement(EquipSlot, { slot: OIL_SLOTS[0], rarity: derrickFilled ? 'legendary' : null, mult: 50, glowP: derrickGlow }),
          R.createElement(EquipSlot, { slot: OIL_SLOTS[1], rarity: pumpFilled ? 'epic' : null, mult: 10, glowP: pumpFilled ? 0.6 : 0 }),
          R.createElement(EquipSlot, { slot: OIL_SLOTS[2], rarity: pipeFilled ? 'rare' : null, mult: 3, glowP: pipeFilled ? 0.5 : 0 }),
          R.createElement(EquipSlot, { slot: OIL_SLOTS[3], rarity: flareFilled ? 'epic' : null, mult: 10, glowP: flareFilled ? 0.6 : 0 }),
        ),
      ),
    ),
    // flying legendary gear card
    flyOn && R.createElement('div', { style: { position: 'absolute', left: fx, top: fy, transform: `translate(-50%,-50%) scale(${1 - fly * 0.55}) rotate(${(1 - fly) * -8}deg)`, zIndex: 70, opacity: seg(p, 0.16, 0.2, 0, 1) } },
      R.createElement(Panel, { style: { width: 150, padding: 12, textAlign: 'center', border: `2px solid ${RARITY.legendary}`, boxShadow: `0 0 32px ${RARITY.legendary}88` } },
        R.createElement('div', { style: { fontFamily: FM, fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: RARITY.legendary } }, 'Legendary'),
        R.createElement('div', { style: { marginTop: 3, fontFamily: FD, fontSize: 14, fontWeight: 700, color: '#fff' } }, 'Derrick Tower'),
        R.createElement('div', { style: { marginTop: 2, fontSize: 11, color: C.s300 } }, '50×'),
      ),
    ),
    R.createElement(Vignette, null),
    R.createElement(Caption, { p, sub: 'Chapter III', text: 'EQUIP RARITY GEAR', a: 0.06, b: 0.9 }),
  );
}

/* =========================================================================
   SCENE 5 — CLAIM & COMPOUND
   ========================================================================= */
function SceneClaim() {
  const { progress: p, localTime: t } = useScene();
  useSfx([[0.06, 'whoosh', 0.5], [6.3, 'click'], [6.58, 'coin', 0], [6.66, 'coin', 1], [6.74, 'coin', 2], [6.82, 'coin', 3], [6.9, 'coin', 4], [6.98, 'coin', 5], [7.06, 'coin', 6], [7.14, 'coin', 7], [7.4, 'chime', 880]]);
  const settle = seg(p, 0, 0.1, 0, 1, Easing.easeOutCubic);
  // pending accrues then claim at .5
  const claimed = p > 0.5;
  const pending = claimed ? seg(p, 0.5, 0.56, 4820, 0, Easing.easeInCubic) : seg(p, 0.1, 0.5, 3600, 4820);
  const daily = seg(p, 0.05, 0.35, 8000, 14200, Easing.easeOutCubic);
  const sharePct = seg(p, 0.1, 0.4, 12, 27, Easing.easeOutCubic);
  const balance = claimed ? seg(p, 0.5, 0.62, 4210, 8935, Easing.easeOutCubic) : 4210;
  // cursor travels to the claim button inside the sidebar earnings card
  const BTN_X = 177, BTN_Y = 343;
  let cx = 260, cy = 300, press = 0;
  if (p < 0.34) { cx = 820; cy = 300; }
  else if (p < 0.48) { cx = seg(p, 0.34, 0.48, 820, BTN_X, Easing.easeInOutCubic); cy = seg(p, 0.34, 0.48, 300, BTN_Y, Easing.easeInOutCubic); }
  else if (p < 0.56) { cx = BTN_X; cy = BTN_Y; press = seg(p, 0.48, 0.51, 0, 1) * (1 - seg(p, 0.52, 0.56, 0, 1)); }
  else { cx = seg(p, 0.56, 0.72, BTN_X, 720, Easing.easeInOutCubic); cy = seg(p, 0.56, 0.72, BTN_Y, 300, Easing.easeInOutCubic); }
  // coins burst from claim button up to the header balance
  const coins = [];
  if (claimed) {
    for (let i = 0; i < 16; i++) {
      const cp = clamp((p - 0.5 - i * 0.01) / 0.16, 0, 1);
      if (cp <= 0 || cp >= 1) continue;
      const sx = BTN_X + ((i * 53) % 40) - 20, sy = BTN_Y - 10, ex = 1060, ey = 50;
      const arc = Math.sin(cp * Math.PI) * -150;
      coins.push({ x: sx + (ex - sx) * cp, y: sy + (ey - sy) * cp + arc, o: 1 - cp * cp, s: 26 - cp * 12 });
    }
  }
  const totalPending = pending * 1.0;
  return R.createElement('div', { style: { position: 'absolute', inset: 0, background: APP_BG } },
    R.createElement('div', { style: { opacity: settle } }, R.createElement(Chrome, { active: 'Command', balance: fmtInt(balance) })),
    // sidebar: earnings + claim card, then nodes
    R.createElement('div', { style: { position: 'absolute', left: 16, top: 128, width: 322, display: 'flex', flexDirection: 'column', gap: 12, opacity: settle, transform: `translateX(${(1 - settle) * -20}px)` } },
      R.createElement(Panel, { style: { padding: 16 } },
        R.createElement(Label, null, 'Estimated Daily Earnings'),
        R.createElement('div', { style: { marginTop: 6, fontFamily: FD, fontSize: 30, fontWeight: 700, color: C.a300, lineHeight: 1 } }, fmtK(daily), R.createElement('span', { style: { fontSize: 13, color: C.s400, fontWeight: 500 } }, ' OSR / day')),
        R.createElement('div', { style: { marginTop: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: FM, fontSize: 10.5 } },
          R.createElement('span', { style: { letterSpacing: '.16em', textTransform: 'uppercase', color: C.s400 } }, 'Network Share'),
          R.createElement('span', { style: { color: C.a400, display: 'flex', alignItems: 'center', gap: 5 } }, R.createElement('span', { style: { width: 5, height: 5, borderRadius: '50%', background: C.a400, opacity: 0.5 + 0.5 * Math.sin(t * 3) } }), 'Halving Active'),
        ),
        R.createElement('div', { style: { marginTop: 6, height: 6, borderRadius: 99, background: C.ink700, overflow: 'hidden' } }, R.createElement('div', { style: { height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#c9761a,#ffc656)', width: sharePct + '%' } })),
        R.createElement('div', { style: { marginTop: 4, display: 'flex', justifyContent: 'space-between', fontFamily: FM, fontSize: 10.5, color: C.s400 } }, R.createElement('span', null, 'Halving #2 in'), R.createElement('span', { style: { color: C.a400 } }, '4d 11h · ' + sharePct.toFixed(1) + '%')),
        R.createElement('div', { style: { marginTop: 12, padding: 10, borderRadius: 11, border: '1px solid rgba(179,77,255,.36)', background: 'rgba(179,77,255,.08)' } },
          R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontFamily: FM, fontSize: 10.5 } }, R.createElement('span', { style: { letterSpacing: '.14em', textTransform: 'uppercase', color: '#d9b3ff' } }, 'Welcome Boost 6.4×'), R.createElement('span', { style: { color: C.s400 } }, '72h')),
          R.createElement('div', { style: { marginTop: 6, height: 5, borderRadius: 99, background: C.ink700, overflow: 'hidden' } }, R.createElement('div', { style: { height: '100%', borderRadius: 99, background: C.purple, width: '77%', boxShadow: '0 0 10px rgba(179,77,255,.6)' } })),
        ),
        R.createElement('div', { style: { marginTop: 12 } },
          R.createElement(GoldBtn, { sweepT: t, style: { width: '100%', padding: 13, fontSize: 14, boxShadow: (p > 0.46 && p < 0.56) ? '0 0 0 2px rgba(255,255,255,.5),0 10px 26px -12px rgba(245,166,35,.9)' : '0 10px 26px -12px rgba(245,166,35,.7)' } }, claimed ? 'Claim ready in 60m' : 'Claim Rewards · ' + fmtInt(pending) + ' OSR'),
        ),
      ),
      R.createElement(Panel, { style: { padding: 16 } },
        R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 } }, R.createElement(Label, null, 'Your Nodes'), R.createElement('span', { style: { fontFamily: FM, fontSize: 11, color: C.s400 } }, '3 / 4')),
        R.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 7 } },
          R.createElement(NodeRow, { glyph: '⛽', name: 'Oil Rig · L1', pending: fmtInt(pending * 0.5), on: false }),
          R.createElement(NodeRow, { glyph: '⛽', name: 'Oil Rig · L2', pending: fmtInt(pending * 0.32), on: false }),
          R.createElement(NodeRow, { glyph: '⛏', name: 'Mining Shaft · L1', pending: fmtInt(pending * 0.18), on: false }),
        ),
      ),
    ),
    // right: live 3D compound viewport fills the space
    R.createElement('div', { style: { position: 'absolute', left: 352, top: 128, right: 16, bottom: 20, borderRadius: 18, overflow: 'hidden', border: '1px solid ' + C.line, boxShadow: PANEL_SH, background: VIEW_BG, opacity: settle, transform: `translateX(${(1 - settle) * 20}px)` } },
      R.createElement('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(70% 55% at 50% 108%,rgba(245,166,35,.3),transparent 60%)' } }),
      R.createElement(Rig3D, { layout: 'compound', prog: 0.35 + p * 0.3 }),
      // pending rewards chip
      R.createElement('div', { style: { position: 'absolute', left: 16, top: 16, padding: '11px 15px', borderRadius: 13, border: '1px solid rgba(245,166,35,.4)', background: 'rgba(10,10,10,.82)', backdropFilter: 'blur(8px)' } },
        R.createElement(Label, null, 'Pending rewards'),
        R.createElement('div', { style: { marginTop: 5, fontFamily: FD, fontSize: 26, fontWeight: 700, color: claimed ? C.green : C.a300, lineHeight: 1 } }, claimed && p > 0.56 ? '0' : fmtInt(totalPending), R.createElement('span', { style: { fontSize: 12, color: C.s400, fontWeight: 500 } }, ' OSR')),
      ),
    ),
    // coins
    coins.map((c, i) => R.createElement('div', { key: i, style: { position: 'absolute', left: c.x, top: c.y, width: c.s, height: c.s, borderRadius: '50%', background: GOLD, boxShadow: '0 0 12px rgba(245,166,35,.7),inset 0 0 0 2px rgba(255,255,255,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: c.s * 0.5, color: '#3a1e05', opacity: c.o, zIndex: 75 } }, '◆')),
    // toast (top of the viewport so it never collides with the caption)
    claimed && R.createElement('div', { style: { position: 'absolute', top: 140, right: 40, zIndex: 70, padding: '9px 18px', borderRadius: 999, border: '1px solid rgba(0,200,5,.4)', background: 'rgba(10,10,10,.9)', color: C.s200, fontSize: 13.5, opacity: seg(p, 0.56, 0.64, 0, 1) * (1 - seg(p, 0.92, 1, 0, 1)) } },
      R.createElement('span', { style: { color: C.green, marginRight: 8 } }, '✓'), 'Rewards claimed (3) · ' + fmtInt(4820 * 0.98) + ' OSR'),
    R.createElement(Vignette, null),
    R.createElement(Caption, { p, sub: 'Chapter IV', text: 'CLAIM. COMPOUND. REPEAT.', a: 0.6, b: 0.98, x: 372, bottom: 40 }),
    R.createElement(Cursor, { x: cx, y: cy, press }),
  );
}

/* =========================================================================
   SCENE 6 — ASCEND (compound upgrade → leaderboard → end card)
   ========================================================================= */
function LbRow({ rank, wallet, lvl, prod, you, y, hi }) {
  return R.createElement('div', {
    style: {
      position: 'absolute', left: 0, right: 0, top: y, height: 46, display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 16px', borderRadius: 11, border: '1px solid ' + (you ? 'rgba(245,166,35,.5)' : C.ink600),
      background: you ? 'rgba(245,166,35,.12)' : C.ink850, boxShadow: you && hi ? '0 0 26px rgba(245,166,35,.4)' : 'none',
      transition: 'none',
    },
  },
    R.createElement('div', { style: { width: 30, fontFamily: FM, fontSize: 15, fontWeight: 700, color: rank <= 3 ? C.a300 : C.s400 } }, '#' + rank),
    R.createElement('div', { style: { width: 24, height: 24, borderRadius: '50%', background: you ? GOLD : C.ink600 } }),
    R.createElement('div', { style: { flex: 1, fontFamily: FM, fontSize: 13, color: you ? C.a300 : C.s200 } }, wallet, you && R.createElement('span', { style: { marginLeft: 8, fontSize: 10, letterSpacing: '.2em', color: C.a400 } }, 'YOU')),
    R.createElement('div', { style: { width: 80, textAlign: 'right', fontFamily: FM, fontSize: 13, color: C.s300 } }, 'L' + lvl),
    R.createElement('div', { style: { width: 120, textAlign: 'right', fontFamily: FM, fontSize: 13, color: C.a300 } }, prod + ' /day'),
  );
}
function SceneAscend() {
  const { progress: p, localTime: t } = useScene();
  useSfx([[0.06, 'whoosh', 0.55], [1.5, 'riser', 1.8], [3.3, 'levelup'], [5.1, 'whoosh', 0.4], [7.2, 'uiTick'], [7.9, 'uiTick'], [8.6, 'uiTick'], [9.3, 'uiTick'], [9.6, 'rankup'], [11.0, 'riser', 1.2], [11.7, 'impact'], [11.85, 'sparkle']]);
  // Beat A compound upgrade 0-.34 | Beat B leaderboard .34-.74 | Beat C endcard .74-1
  const aOp = seg(p, 0.02, 0.1, 0, 1) * (1 - seg(p, 0.3, 0.38, 0, 1));
  const bOp = seg(p, 0.34, 0.42, 0, 1) * (1 - seg(p, 0.7, 0.78, 0, 1));
  const cOp = seg(p, 0.76, 0.86, 0, 1);
  // Beat A: upgrade bar fill + level flourish
  const upFill = seg(p, 0.1, 0.24, 0, 100, Easing.easeInOutCubic);
  const leveled = p > 0.22;
  const flourish = seg(p, 0.22, 0.3, 0, 1) * (1 - seg(p, 0.3, 0.36, 0, 1));
  // Beat B: your row climbs from rank 7 to 2
  const climb = seg(p, 0.46, 0.64, 0, 1, Easing.easeInOutCubic);
  const rowH = 54;
  const others = [
    { r: 1, w: '0x91…8fae', lvl: 9, prod: '48.2K' },
    { r: 2, w: '0x3c…21bd', lvl: 8, prod: '39.1K' },
    { r: 3, w: '0xa7…0e42', lvl: 8, prod: '31.7K' },
    { r: 4, w: '0x55…9c10', lvl: 7, prod: '24.4K' },
    { r: 5, w: '0x08…4d77', lvl: 6, prod: '18.9K' },
    { r: 6, w: '0xf2…7a19', lvl: 6, prod: '15.2K' },
  ];
  const youStart = 6, youEnd = 1; // index positions (0-based, after climb inserts at rank2)
  const youIdx = youStart + (youEnd - youStart) * climb;
  return R.createElement('div', { style: { position: 'absolute', inset: 0, background: APP_BG, overflow: 'hidden' } },
    // Beat A — compound upgrade card
    aOp > 0 && R.createElement('div', { style: { position: 'absolute', inset: 0, opacity: aOp, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      R.createElement(Panel, { bd: 'rgba(245,166,35,.3)', style: { width: 460, padding: 26, position: 'relative', overflow: 'hidden' } },
        R.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
          R.createElement(Label, null, 'Compound Upgrade'), R.createElement('span', { style: { fontFamily: FM, fontSize: 12, color: C.s400 } }, 'L4 → L' + (leveled ? 5 : 4))),
        R.createElement('div', { style: { fontSize: 14, color: C.s300 } }, '4,000 OSR ', R.createElement('span', { style: { fontSize: 11, color: C.s500 } }, '· 50/30/20 split · +0.00001 ETH')),
        R.createElement('div', { style: { marginTop: 16, height: 10, borderRadius: 99, background: C.ink700, overflow: 'hidden' } }, R.createElement('div', { style: { height: '100%', borderRadius: 99, background: GOLD, width: upFill + '%', boxShadow: '0 0 12px rgba(245,166,35,.6)' } })),
        R.createElement('div', { style: { marginTop: 8, display: 'flex', justifyContent: 'space-between', fontFamily: FM, fontSize: 11, color: C.s400 } }, R.createElement('span', null, leveled ? '4 → 4 rigs · 8 crates/day' : 'Upgrading…'), R.createElement('span', { style: { color: C.a400 } }, upFill.toFixed(0) + '%')),
        // flourish
        flourish > 0 && R.createElement('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(circle,rgba(245,166,35,${flourish * 0.25}),transparent 70%)` } },
          R.createElement('div', { style: { fontFamily: FD, fontSize: 46, fontWeight: 700, transform: `scale(${0.8 + flourish * 0.2})`, opacity: flourish } }, R.createElement(GoldText, null, 'COMPOUND L5'))),
      ),
    ),
    // Beat B — leaderboard
    bOp > 0 && R.createElement('div', { style: { position: 'absolute', inset: 0, opacity: bOp } },
      R.createElement('div', { style: { position: 'absolute', left: '50%', top: 54, transform: 'translateX(-50%)', textAlign: 'center' } },
        R.createElement(Label, { style: { fontSize: 12 } }, 'Season 1 · Reserve Leaderboard'),
        R.createElement('div', { style: { fontFamily: FD, fontSize: 30, fontWeight: 700, color: C.s100, marginTop: 6 } }, 'Climb the Reserve'),
      ),
      R.createElement('div', { style: { position: 'absolute', left: '50%', top: 150, width: 720, height: 420, transform: 'translateX(-50%)' } },
        // header
        R.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px 8px', fontFamily: FM, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: C.s500 } },
          R.createElement('div', { style: { width: 30 } }, 'Rank'), R.createElement('div', { style: { width: 24 } }), R.createElement('div', { style: { flex: 1 } }, 'Operator'), R.createElement('div', { style: { width: 80, textAlign: 'right' } }, 'Level'), R.createElement('div', { style: { width: 120, textAlign: 'right' } }, 'Production')),
        R.createElement('div', { style: { position: 'relative', height: 380 } },
          others.map((o, i) => {
            // rows shift down by one below the climbing 'you' insertion point
            const youRank = 7 - Math.round(climb * 5); // 7 -> 2
            const displayRank = o.r < youRank ? o.r : o.r + (o.r >= youRank ? 1 : 0);
            const slot = displayRank - 1;
            return R.createElement(LbRow, { key: i, rank: displayRank, wallet: o.w, lvl: o.lvl, prod: o.prod, you: false, y: slot * rowH });
          }),
          R.createElement(LbRow, { rank: Math.round(7 - climb * 5), wallet: '0x7A…4c2f', lvl: 5, prod: '22.6K', you: true, y: youIdx * rowH, hi: climb > 0.15 }),
        ),
      ),
    ),
    // Beat C — end card
    cOp > 0 && R.createElement('div', { style: { position: 'absolute', inset: 0, opacity: cOp, background: 'radial-gradient(1200px 640px at 50% 60%,rgba(245,166,35,.14),transparent 60%),linear-gradient(180deg,#060606,#0b0b0b)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 } },
      R.createElement(Embers, { t }),
      R.createElement('img', { src: 'assets/logo.jpg', alt: '', style: { width: 84, height: 84, borderRadius: 20, boxShadow: '0 0 0 1px rgba(245,166,35,.5),0 12px 40px -8px rgba(245,166,35,.7)', transform: `scale(${seg(p, 0.78, 0.9, 0.85, 1, Easing.easeOutBack)})` } }),
      R.createElement('div', { style: { textAlign: 'center' } },
        R.createElement(GoldText, { style: { fontFamily: FM, fontWeight: 700, fontSize: 44, letterSpacing: '.34em' } }, 'OSR'),
        R.createElement('div', { style: { fontFamily: FM, fontSize: 12, letterSpacing: '.4em', textTransform: 'uppercase', color: C.s400, marginTop: 10 } }, 'Oil Strategic Reserve'),
      ),
      R.createElement('div', { style: { fontFamily: FM, fontSize: 13, letterSpacing: '.3em', textTransform: 'uppercase', color: C.a300 } }, 'Build · Mine · Compound'),
      R.createElement(GoldBtn, { sweepT: t, style: { padding: '15px 44px', fontSize: 17, borderRadius: 13 } }, '▶  Enter the Reserve'),
      R.createElement(StatusPill, { color: C.green, style: { marginTop: 4 } }, 'Robinhood Chain · Season 1 · Halving Live'),
    ),
    p < 0.76 && R.createElement(Caption, { p, sub: 'Chapter V', text: p < 0.34 ? 'COMPOUND YOUR EMPIRE' : 'CLIMB THE RESERVE', a: 0.08, b: 0.72 }),
  );
}

/* ---- exported root ------------------------------------------------------- */
const SCENE_MAP = {
  Reserve: SceneReserve,
  Deploy: SceneDeploy,
  Crate: SceneCrate,
  Equip: SceneEquip,
  Claim: SceneClaim,
  Ascend: SceneAscend,
};

function OSRTrailer() {
  const T = window.useTweaks ? window.useTweaks(window.OSR_TWEAKS || { motionEditor: true }) : null;
  const [tw, setTweak] = T || [{ motionEditor: true }, () => {}];
  const Panel2 = window.TweaksPanel;
  R.useEffect(() => { if (window.OSRSfx) window.OSRSfx.enabled = tw.sound !== false; }, [tw.sound]);
  return R.createElement(R.Fragment, null,
    R.createElement(window.SceneStage, {
      width: 1280, height: 720, scenes: window.OM_SCENES, playback: window.OM_PLAYBACK, bg: '#060606',
    }, SCENE_MAP),
    Panel2 && R.createElement(Panel2, null,
      window.TweakSection && R.createElement(window.TweakSection, { label: 'Trailer' }),
      window.TweakToggle && R.createElement(window.TweakToggle, { label: 'Motion editor', value: tw.motionEditor, onChange: (v) => setTweak('motionEditor', v) }),
      window.TweakToggle && R.createElement(window.TweakToggle, { label: 'Sound FX', value: tw.sound !== false, onChange: (v) => { setTweak('sound', v); if (window.OSRSfx) { window.OSRSfx.enabled = v; if (v) window.OSRSfx.test(); } } }),
    ),
  );
}

window.OSRTrailer = OSRTrailer;
window.SceneReserve = SceneReserve;
