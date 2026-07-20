// osr-3d.js — live three.js render of the REAL authored OSR GLB assets.
// <osr-3d layout="compound|rig|crate" prog="0..1" deploy="0..1"> — deterministic:
// every visible transform is derived from the `prog` attribute the trailer sets
// each frame, so scrubbing / export land on the right frame. preserveDrawingBuffer
// keeps canvas.toDataURL() valid for screenshot + video capture.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const CACHE = new Map();
function loadGLB(loader, url) {
  if (!CACHE.has(url)) {
    CACHE.set(url, new Promise((res, rej) => loader.load(url, (g) => res(g.scene), undefined, rej)));
  }
  return CACHE.get(url).then((s) => s.clone(true));
}
const LEG = new THREE.Color('#ffd900');

class OSR3D extends HTMLElement {
  static get observedAttributes() { return ['prog', 'deploy']; }
  attributeChangedCallback(n, _o, v) {
    if (n === 'prog') this._prog = parseFloat(v) || 0;
    if (n === 'deploy') this._deploy = parseFloat(v) || 0;
    // Render synchronously on attribute change so deterministic export/scrub —
    // which sets prog then captures the canvas immediately, before the next
    // rAF — reads the correct frame instead of a stale/blank buffer.
    if (this._init && this._renderer) { try { this._apply(); this._renderer.render(this._scene, this._camera); } catch (e) {} }
  }
  connectedCallback() {
    if (this._init) return;
    this._init = true;
    this._prog = parseFloat(this.getAttribute('prog')) || 0;
    this._deploy = parseFloat(this.getAttribute('deploy')) || 0;
    this._layout = this.getAttribute('layout') || 'compound';
    Object.assign(this.style, { display: 'block', width: '100%', height: '100%' });

    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block' });
    this.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer = renderer;
    // Guard against context loss (e.g. too many live GL contexts): prevent the
    // default permanent-loss behaviour and re-init on restore, so the panel
    // never gets stuck as a blank white canvas.
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }, false);
    canvas.addEventListener('webglcontextrestored', () => { this._init = false; while (this.firstChild) this.removeChild(this.firstChild); this.connectedCallback(); }, false);

    const scene = new THREE.Scene();
    this._scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this._camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);
    this._target = new THREE.Vector3(0, 2.4, 0);

    // warm dusk lighting (HDRI-free)
    scene.add(new THREE.HemisphereLight(0xffd9a8, 0x241626, 0.5));
    const sun = new THREE.DirectionalLight(0xffcf94, 2.6);
    sun.position.set(-8, 15, 9); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 }); sun.shadow.bias = -0.0004;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xff7a3c, 0.9); rim.position.set(9, 5, -9); scene.add(rim);

    this._group = new THREE.Group();
    scene.add(this._group);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    this._build(loader);

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this);
    this._resize();
    this._loop();
  }

  _dress(o, receive, cast) {
    o.traverse((n) => { if (n.isMesh) { n.castShadow = !!cast; n.receiveShadow = !!receive; if (n.material) n.material.envMapIntensity = 1.05; } });
  }
  _fit(o, targetH, x, z, ry, sink) {
    const s = new THREE.Vector3(); new THREE.Box3().setFromObject(o).getSize(s);
    o.scale.setScalar(targetH / (s.y || 1));
    const b2 = new THREE.Box3().setFromObject(o); const c = new THREE.Vector3(); b2.getCenter(c);
    o.position.x += x - c.x; o.position.z += z - c.z; o.position.y += -b2.min.y - (sink || 0);
    o.rotation.y = ry;
  }

  async _build(loader) {
    const L = this._layout;
    try {
      if (L === 'compound') {
        const sand = await loadGLB(loader, 'assets/models/sand.glb');
        const ss = new THREE.Vector3(); new THREE.Box3().setFromObject(sand).getSize(ss);
        sand.scale.setScalar(240 / (ss.x || 1));
        const c = new THREE.Vector3(); new THREE.Box3().setFromObject(sand).getCenter(c);
        sand.position.y -= c.y; this._dress(sand, true, false); this._group.add(sand);
        const rig = await loadGLB(loader, 'assets/models/oil_rig.glb');
        this._fit(rig, 7.4, -10.5, 1.5, 0.5, 0.55); this._dress(rig, true, true); this._group.add(rig);
        const shaft = await loadGLB(loader, 'assets/models/mining_shaft.glb');
        this._fit(shaft, 6.2, 11, 0, -0.6, 0.75); this._dress(shaft, true, true); this._group.add(shaft);
        // extra rig that rises when `deploy` ramps
        const extra = await loadGLB(loader, 'assets/models/oil_rig.glb');
        this._fit(extra, 6.2, 1, 9, -0.3, 0.55); this._dress(extra, true, true);
        this._extra = extra; extra.visible = false; this._group.add(extra);
        this._target.set(0, 2.8, 2);
      } else if (L === 'rig') {
        const rig = await loadGLB(loader, 'assets/models/oil_rig.glb');
        this._fit(rig, 6, 0, 0, 0.4, 0); this._dress(rig, true, true);
        this._rig = rig; this._group.add(rig);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.3, 48), new THREE.MeshStandardMaterial({ color: 0x1a1206, roughness: 0.85 }));
        disc.position.y = -0.15; disc.receiveShadow = true; this._group.add(disc);
        this._target.set(0, 2.6, 0);
      } else if (L === 'crate') {
        // High-quality legendary crate, built procedurally in the OSR art
        // language (gunmetal panels, brass frame + hex bolts, glowing legendary
        // seams). Centred on the origin, no handle. 4-petal lid bursts on open.
        const grp = new THREE.Group();
        const steel = new THREE.MeshStandardMaterial({ color: 0x3a3b42, metalness: 0.72, roughness: 0.34 });
        const steelDark = new THREE.MeshStandardMaterial({ color: 0x22232a, metalness: 0.6, roughness: 0.56 });
        const brass = new THREE.MeshStandardMaterial({ color: 0xc79a2e, metalness: 0.96, roughness: 0.26 });
        const brassLite = new THREE.MeshStandardMaterial({ color: 0xe1bb50, metalness: 0.96, roughness: 0.22 });
        const seamMat = new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: LEG.clone(), emissiveIntensity: 0, metalness: 0.4, roughness: 0.35, toneMapped: false });
        this._seams = [seamMat];
        this._lids = [];
        const B = 2.2, H = 2.0, HB = B / 2, HH = H / 2, bw = 0.14;
        const box = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = true; o.receiveShadow = true; return o; };
        grp.add(box(B, H, B, steel));
        // recessed dark panels on the 4 vertical faces
        [[0, HB], [0, -HB], [HB, 0], [-HB, 0]].forEach(([x, z]) => {
          const pn = box(x ? 0.05 : B * 0.64, H * 0.62, x ? B * 0.64 : 0.05, steelDark);
          pn.position.set(x ? (x > 0 ? HB - 0.02 : -HB + 0.02) : 0, -0.05, z ? (z > 0 ? HB - 0.02 : -HB + 0.02) : 0);
          pn.castShadow = false; grp.add(pn);
        });
        // brass frame — 4 vertical + top & bottom rims
        [[HB, HB], [HB, -HB], [-HB, HB], [-HB, -HB]].forEach(([x, z]) => { const b = box(bw, H, bw, brass); b.position.set(x, 0, z); grp.add(b); });
        [-HH, HH].forEach((y) => {
          [HB, -HB].forEach((z) => { const b = box(B + bw, bw, bw, brass); b.position.set(0, y, z); grp.add(b); });
          [HB, -HB].forEach((x) => { const b = box(bw, bw, B + bw, brass); b.position.set(x, y, 0); grp.add(b); });
        });
        // corner caps
        [HH, -HH].forEach((y) => [[HB, HB], [HB, -HB], [-HB, HB], [-HB, -HB]].forEach(([x, z]) => { const c = box(bw * 1.7, bw * 1.7, bw * 1.7, brassLite); c.position.set(x, y, z); grp.add(c); }));
        // hex bolts on the 4 vertical faces
        const boltGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.06, 6);
        [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]].forEach(([nx, ny, nz]) => {
          [[0.66, 0.62], [-0.66, 0.62], [0.66, -0.62], [-0.66, -0.62]].forEach(([a, b]) => {
            const bolt = new THREE.Mesh(boltGeo, brassLite); bolt.castShadow = true;
            if (nz) { bolt.position.set(a, b, nz * (HB + 0.02)); bolt.rotation.x = Math.PI / 2; }
            else { bolt.position.set(nx * (HB + 0.02), b, a); bolt.rotation.z = Math.PI / 2; }
            grp.add(bolt);
          });
        });
        // glowing legendary seam ring just under the lid line
        [[B, 0.05, 0.07, 0, HH - 0.06, HB], [B, 0.05, 0.07, 0, HH - 0.06, -HB], [0.07, 0.05, B, HB, HH - 0.06, 0], [0.07, 0.05, B, -HB, HH - 0.06, 0]].forEach(([w, h, d, x, y, z]) => { const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), seamMat); s.position.set(x, y, z); grp.add(s); });
        // 4-petal lid seated on top
        const q = B / 2, plate = q * 0.94, lidH = 0.18;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
          const petal = new THREE.Group();
          petal.add(box(plate, lidH, plate, steel));
          const tx = box(plate + bw, bw, bw, brass); tx.position.set(0, lidH / 2, sz * plate / 2); petal.add(tx);
          const tz = box(bw, bw, plate + bw, brass); tz.position.set(sx * plate / 2, lidH / 2, 0); petal.add(tz);
          const cap = box(bw * 1.7, bw * 1.7, bw * 1.7, brassLite); cap.position.set(sx * plate / 2, lidH / 2, sz * plate / 2); petal.add(cap);
          const si = new THREE.Mesh(new THREE.BoxGeometry(plate, 0.05, 0.06), seamMat); si.position.set(0, lidH / 2 + 0.005, -sz * plate / 2 + 0.05); petal.add(si);
          petal.position.set(sx * q / 2, HH + lidH / 2, sz * q / 2);
          grp.add(petal);
          this._lids.push({ o: petal, home: petal.position.clone(), rot: petal.rotation.clone(), dir: new THREE.Vector3(sx, 1.35, sz).normalize() });
        });
        grp.scale.setScalar(1.15);
        this._crate = grp; this._group.add(grp);
        // legendary key light inside
        this._crateLight = new THREE.PointLight(0xffd900, 0, 16, 2); this._crateLight.position.set(0, 0, 0); grp.add(this._crateLight);
        this._contact = null;
        this._target.set(0, 0, 0);
      }
    } catch (e) { /* keep lights-only scene on failure */ }
    // fade-in
    this._group.traverse((n) => { if (n.isMesh && n.material) { const ms = Array.isArray(n.material) ? n.material : [n.material]; ms.forEach((m) => { if (m.userData.soft) return; m.transparent = true; m.opacity = 0; }); } });
    this._fadeStart = performance.now();
    this._ready = true;
  }

  _resize() {
    if (!this._renderer) return;
    const w = this.clientWidth || 1, h = this.clientHeight || 1;
    this._renderer.setSize(w, h, false);
    this._camera.aspect = w / h; this._camera.updateProjectionMatrix();
  }

  _apply() {
    const p = this._prog, cam = this._camera, L = this._layout;
    if (L === 'compound') {
      // slow cinematic push-in + gentle pan
      const az = -0.28 + p * 0.34;
      const rad = 40 - p * 9;
      cam.position.set(Math.sin(az) * rad, 9.5 - p * 1.4, Math.cos(az) * rad);
      if (this._extra) {
        const d = this._deploy;
        this._extra.visible = d > 0.001;
        this._extra.position.y = this._extra.userData.baseY != null ? this._extra.userData.baseY : (this._extra.userData.baseY = this._extra.position.y);
        this._extra.scale.setScalar((this._extra.userData.s || (this._extra.userData.s = this._extra.scale.x)) * (0.2 + 0.8 * d));
        this._extra.position.y = (this._extra.userData.baseY || 0) - (1 - d) * 3;
      }
    } else if (L === 'rig') {
      const az = Math.sin(p * Math.PI * 2) * 0.5 + 0.3;
      cam.position.set(Math.sin(az) * 12, 5.2, Math.cos(az) * 12);
      if (this._rig) this._rig.rotation.y = 0.4 + p * 0.6;
    } else if (L === 'crate') {
      // Fixed, far framing so the crate + bursting lids stay fully in view with
      // headroom in EVERY frame (used for baking the sprite sheet). No camera
      // push, shake, or drop — those made frames grow/drift and clip.
      cam.position.set(0, 1.2, 10.8);
      this._target.set(0, 0.4, 0);
      if (this._crate) {
        const s0 = this._crate.userData.s0 || (this._crate.userData.s0 = this._crate.scale.x);
        this._crate.position.set(0, 0, 0);
        this._crate.scale.setScalar(s0);
        this._crate.rotation.y = 0.5 + p * 0.8;
        const explode = p < 0.5 ? 0 : Math.min(1, (p - 0.5) / 0.14);
        this._lids.forEach((l) => {
          l.o.position.set(l.home.x + l.dir.x * explode * 0.9, l.home.y + l.dir.y * explode * 1.5, l.home.z + l.dir.z * explode * 0.9);
          l.o.rotation.set(l.rot.x + l.dir.z * explode * 1.2, l.rot.y, l.rot.z - l.dir.x * explode * 1.2);
        });
        const glow = p < 0.1 ? 2 : p < 0.5 ? 2 + (p - 0.1) / 0.4 * 14 : 20;
        this._seams.forEach((m) => { m.emissiveIntensity = glow; });
        if (this._crateLight) {
          const flare = p < 0.5 ? 0.4 + (p / 0.5) * 1.6 : (6 * Math.max(0, 1 - (p - 0.5) / 0.16));
          this._crateLight.intensity = flare;
        }
      }
    }
    cam.lookAt(this._target);
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    if (!document.contains(this) || !this._renderer) return;
    if (this._fadeStart) {
      const k = Math.min(1, (performance.now() - this._fadeStart) / 700);
      this._group.traverse((n) => { if (n.isMesh && n.material) { const ms = Array.isArray(n.material) ? n.material : [n.material]; ms.forEach((m) => { if (m.userData.soft) return; m.opacity = k; }); } });
      if (k >= 1) { this._group.traverse((n) => { if (n.isMesh && n.material) { const ms = Array.isArray(n.material) ? n.material : [n.material]; ms.forEach((m) => { if (m.userData.soft) return; m.transparent = false; }); } }); this._fadeStart = null; }
    }
    this._apply();
    this._renderer.render(this._scene, this._camera);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this._renderer) this._renderer.dispose();
    this._init = false;
  }
}
if (!customElements.get('osr-3d')) customElements.define('osr-3d', OSR3D);
