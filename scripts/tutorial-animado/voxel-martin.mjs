// The Martín in cubes (the voxel character of the gallery, C:/dev/artefactos-animaciones/reels/morrow.html — `makeBoy`, approved
// by Martín) as a layer of the tutorials: rendered in its own WebGL canvas (#vox, transparent) and drawn by engine3.js into the
// frame wherever the moment asks (big and centered, small on the right, or not at all).
//   window.__vox.render(T, { talk, pose, prevPose, since, jump, turn })  → draws one pose into #vox
// Poses are angles of the two shoulders (sx, sz) and elbows (ex). arms[0] is his right arm: on the LEFT of the screen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PIEZAS } from './vox-piezas.mjs';

const { makeBoy } = new Function('THREE', 'RoundedBoxGeometry', PIEZAS + '\nreturn { makeBoy };')(THREE, RoundedBoxGeometry);

const canvas = document.getElementById('vox');
const W = canvas.width, H = canvas.height;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xfffaf0, 0xd8ccb8, 1.5));
const key = new THREE.DirectionalLight(0xfff1e2, 2.4); key.position.set(-4, 8, 8); scene.add(key);
const rim = new THREE.DirectionalLight(0xffe2c4, 1.2); rim.position.set(5, 5, -6); scene.add(rim);
// the whole body in frame, with air above for a raised arm and a jump
const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100); cam.position.set(0, 2.05, 10.4); cam.lookAt(0, 1.95, 0);
const b = makeBoy(); scene.add(b.root);

// objects in his right hand (arms[0], the forearm group; the hand sits at y ≈ -0.6): a microphone and a phone, in cubes too
const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.5, metalness: 0.1 }, o || {}));
const OBJ = {};
{
  const mic = new THREE.Group(); mic.position.set(0, -0.72, 0.1); b.arms[0].el.add(mic);
  const cuerpo = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.42, 0.13, 3, 0.04), mat(0x1d1d24)); cuerpo.position.y = 0.05; mic.add(cuerpo);
  const cab = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.24, 0.24, 4, 0.1), mat(0xb9bcc6, { metalness: 0.6, roughness: 0.3 })); cab.position.y = 0.34; mic.add(cab);
  OBJ.mic = mic;
  const tel = new THREE.Group(); tel.position.set(0, -0.68, 0.16); b.arms[0].el.add(tel);
  const caja = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.52, 0.05, 3, 0.04), mat(0x1d1d24)); tel.add(caja);
  const pant = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.44), new THREE.MeshBasicMaterial({ color: 0x8fb3ff })); pant.position.z = 0.027; tel.add(pant);
  OBJ.tel = tel;
  Object.values(OBJ).forEach((o) => { o.visible = false; });
}
const R = { sx: 0, sz: -0.06, ex: 0 }, R1 = { sx: 0, sz: 0.06, ex: 0 };
const POSES = {
  reposo: [R, R1],
  saludo: [{ sx: 0, sz: -2.75, ex: -0.2 }, R1],                        // right hand up, waving
  abre: [{ sx: -1.0, sz: -0.45, ex: -0.7 }, { sx: -1.0, sz: 0.45, ex: -0.7 }],   // both arms open, presenting
  senala: [{ sx: -0.25, sz: -1.45, ex: -0.05 }, R1],                   // right arm out to the left: points at the text
  festeja: [{ sx: 0, sz: -2.6, ex: -0.35 }, { sx: 0, sz: 2.6, ex: -0.35 }],      // both arms up
  explica: [R, { sx: -1.25, sz: 0.25, ex: -1.1 }],                      // left hand forward, as if counting
  sostiene: [{ sx: -1.25, sz: -0.15, ex: -1.25 }, R1],                  // right hand up in front of him, holding the object
};
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

window.__vox = {
  W, H,
  render(T, st) {
    const k = ease(Math.min(1, (st.since || 0) / 0.38));
    const A = POSES[st.prevPose] || POSES.reposo, B = POSES[st.pose] || POSES.reposo;
    for (let a = 0; a < 2; a++) {
      const L = (p) => A[a][p] + (B[a][p] - A[a][p]) * k;
      const wave = st.pose === 'saludo' && a === 0 ? Math.sin(T * 7) * 0.22 * k : Math.sin(T * 2.4 + a) * 0.05;
      b.arms[a].sh.rotation.set(L('sx'), 0, L('sz') + wave);
      b.arms[a].el.rotation.set(L('ex'), 0, 0);
    }
    Object.entries(OBJ).forEach(([n, o]) => { o.visible = st.objeto === n; });
    const br = Math.sin(T * 2.1) * 0.012; b.torso.scale.y = 1 + br;
    b.root.position.y = st.jump || 0;
    b.root.rotation.y = st.turn || 0;
    b.head.position.y = 3.1 + br * 1.2;
    b.head.rotation.set(Math.sin(T * 1.7) * 0.03 + (st.talk ? 0.03 : 0), Math.sin(T * 0.9) * 0.08 + (st.turn || 0) * 0.4, Math.sin(T * 1.3) * 0.04);
    const f = b.face; f.brows.forEach((m) => { m.rotation.z = 0; m.position.y = 0.19 + (st.talk ? 0.025 : 0.01) + (st.pose === 'festeja' ? 0.03 : 0); });
    const bt = T % 3.4, blink = bt < 0.16 ? Math.sin((bt / 0.16) * Math.PI) : 0, lid = Math.min(1, 0.08 + blink * 0.92);
    f.lids.forEach((l) => { const h = 0.235 * lid; l.scale.y = Math.max(0.001, h); l.position.y = 0.115 - h / 2; l.visible = h > 0.004; });
    const open = st.talk ? (0.5 + 0.5 * Math.sin(T * 19)) * 0.7 : 0, op = open > 0.12, m = b.mouth;
    m.ml.visible = !op; m.mc.forEach((c, i) => { const s = i === 0 ? -1 : 1; c.visible = !op; c.rotation.z = s * 0.55; c.position.y = 0.022; c.position.x = s * 0.14; });
    m.mo.visible = op; m.teeth.visible = op && open > 0.3; m.mo.scale.y = Math.max(0.2, open); m.mo.position.y = -0.12 * Math.max(0.2, open) + 0.06; m.mo.scale.x = 0.8 + 0.2 * open; m.teeth.position.y = 0.052;
    renderer.render(scene, cam);
  },
};
window.__voxListo = true;
