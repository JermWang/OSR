import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// <osr-world-3d> — live three.js diorama of the OSR compound, built from the
// authored runtime GLBs, lit by the project's cape_hill HDRI.
class OsrWorld3D extends HTMLElement {
  connectedCallback() {
    if (this._init) return;
    this._init = true;
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.filter = 'blur(1.6px)';
    this.appendChild(canvas);
    this._canvas = canvas;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer = renderer;

    const scene = new THREE.Scene();
    this._scene = scene;

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
    camera.position.set(0, 9, 30);
    this._camera = camera;
    this._camTarget = new THREE.Vector3(0, 2.4, 0);

    // ── HDRI environment + background ──
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    new RGBELoader().load('assets/env/cape_hill_2k.hdr', (hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = pmrem.fromEquirectangular(hdr).texture;
      scene.background = hdr;
      scene.backgroundBlurriness = 0.16;
      scene.backgroundIntensity = 1.0;
    });

    // ── Lighting: warm dusk (HDRI provides ambient IBL) ──
    const hemi = new THREE.HemisphereLight(0xffd9a8, 0x2a1626, 0.55);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffcf94, 2.4);
    sun.position.set(-8, 15, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xff7a3c, 0.8);
    rim.position.set(9, 4, -9);
    scene.add(rim);

    this._group = new THREE.Group();
    scene.add(this._group);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const dress = (obj, receive, cast) => {
      obj.traverse((n) => {
        if (n.isMesh) {
          n.castShadow = !!cast;
          n.receiveShadow = !!receive;
          if (n.material) n.material.envMapIntensity = 1.05;
        }
      });
    };
    const fit = (obj, targetH, x, z, ry, sink) => {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3(); box.getSize(size);
      obj.scale.setScalar(targetH / (size.y || 1));
      const b2 = new THREE.Box3().setFromObject(obj);
      const c = new THREE.Vector3(); b2.getCenter(c);
      obj.position.x += x - c.x;
      obj.position.z += z - c.z;
      obj.position.y += -b2.min.y - (sink || 0);
      obj.rotation.y = ry;
    };

    let pending = 0, done = 0;
    const tick = () => { done++; if (done >= pending) this._reveal(); };
    const load = (url, cb) => {
      pending++;
      loader.load(url, (g) => { cb(g.scene); tick(); }, undefined, () => tick());
    };

    // Terrain — stretched huge so its edges never enter frame
    load('assets/models/sand.glb', (o) => {
      const box = new THREE.Box3().setFromObject(o);
      const size = new THREE.Vector3(); box.getSize(size);
      o.scale.setScalar(240 / (size.x || 1));
      const b2 = new THREE.Box3().setFromObject(o);
      const c = new THREE.Vector3(); b2.getCenter(c);
      o.position.y -= c.y; // sit the mean sand surface at y=0
      dress(o, true, false);
      this._group.add(o);
    });
    // Oil rig — pushed left, base embedded into the sand
    load('assets/models/oil_rig.glb', (o) => {
      fit(o, 7.4, -10.5, 1.5, 0.5, 0.55); dress(o, true, true); this._group.add(o);
    });
    // Mining shaft — pushed right, base embedded into the sand
    load('assets/models/mining_shaft.glb', (o) => {
      fit(o, 6.2, 11, 0, -0.6, 0.75); dress(o, true, true); this._group.add(o);
    });
    // Legendary crate — low, off to the side
    load('assets/models/crate_legendary.glb', (o) => {
      fit(o, 1.2, -4.8, 6.8, 0.4, 0.2); dress(o, true, true); this._group.add(o); this._crate = o;
    });

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this);
    this._resize();

    this._mx = 0; this._my = 0;
    this._onMove = (e) => {
      const r = this.getBoundingClientRect();
      this._mx = (e.clientX - r.left) / r.width - 0.5;
      this._my = (e.clientY - r.top) / r.height - 0.5;
    };
    window.addEventListener('pointermove', this._onMove);

    this._t0 = performance.now();
    this._loop();
  }

  _reveal() {
    this._loaded = true;
    this._group.traverse((n) => {
      if (n.isMesh && n.material) { n.material.transparent = true; n.material.opacity = 0; }
    });
    this._fadeStart = performance.now();
    this.dispatchEvent(new CustomEvent('worldready', { bubbles: true }));
  }

  _resize() {
    if (!this._renderer) return;
    const w = this.clientWidth || 1, h = this.clientHeight || 1;
    this._renderer.setSize(w, h, false);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    if (!document.contains(this)) return;
    const t = (performance.now() - this._t0) / 1000;

    const az = Math.sin(t * 0.08) * 0.08 + this._mx * 0.18;
    const el = 10 - this._my * 1.4;
    const rad = 35;
    this._camera.position.x = Math.sin(az) * rad;
    this._camera.position.z = Math.cos(az) * rad;
    this._camera.position.y = el;
    this._camera.lookAt(this._camTarget);

    if (this._crate) this._crate.rotation.y += 0.006;

    if (this._fadeStart) {
      const k = Math.min(1, (performance.now() - this._fadeStart) / 900);
      this._group.traverse((n) => { if (n.isMesh && n.material) n.material.opacity = k; });
      if (k >= 1) { this._group.traverse((n) => { if (n.isMesh && n.material) n.material.transparent = false; }); this._fadeStart = null; }
    }

    this._renderer.render(this._scene, this._camera);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this._onMove) window.removeEventListener('pointermove', this._onMove);
    if (this._renderer) this._renderer.dispose();
    this._init = false;
  }
}

if (!customElements.get('osr-world-3d')) customElements.define('osr-world-3d', OsrWorld3D);
