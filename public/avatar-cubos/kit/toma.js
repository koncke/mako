/* COPIA DE LA APP (public/avatar-cubos/, 19/11/2026): es C:/dev/artefactos-animaciones/reels/kit/toma.js con el personaje
 * como DATOS (`window.CUBOS.personaje`, lo arma lib/ai-avatar/cubos-personaje.ts → resolverPersonaje): colores, peinado,
 * anteojos y barba. Sin datos es el Martín en cubos de la galería, igual cubo por cubo (cambios marcados «APP»).
 *
 * KIT.toma — la «toma» falsa para los formatos que van ENCIMA de un video (subtítulos, rótulos, flechas…):
 * un cuarto desenfocado con bokeh y MARTÍN EN CUBOS (el voxel de morrow.html) hablando con la voz.
 *   const toma = KIT.toma(K.$('toma'), { tono:'verde'|'azul'|'calido'|'gris'|'noche', cabeza:.5, ancho:1000, desenfoque:16 });
 *   en cuadro(T, K):  toma.pinta(T, K, { mira, cejas, calla, sonrie, brazos, x, y, escala })
 * Martín solo, sin fondo: KIT.martin(el, { ancho, encuadre:'busto'|'cuerpo' }) → { svg (el canvas), lienzo, listo, three, pinta(T, K, opts) }
 * 18/11: el Martín plano de rulos (SVG) se sacó entero por pedido de Martín («parece una coliflor»); la copia vieja quedó en
 * investigacion/toma-plano-descartado.js sólo como registro. Nunca volver a usarlo.
 */
(function () {
  const IMAP = { imports: { three: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', 'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/' } };
  if (!document.querySelector('script[type="importmap"]')) {
    const s = document.createElement('script'); s.type = 'importmap'; s.textContent = JSON.stringify(IMAP); document.currentScript.after(s);
  }
  let libs = null;
  const cargar = () => libs || (libs = Promise.all([import('three'), import('three/addons/geometries/RoundedBoxGeometry.js'), import('three/addons/environments/RoomEnvironment.js')])
    .then(([THREE, rb, re]) => ({ THREE, RoundedBoxGeometry: rb.RoundedBoxGeometry, RoomEnvironment: re.RoomEnvironment })));
  window.KIT = window.KIT || {}; KIT._esperas = KIT._esperas || [];

  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function armarChico(L, busto) {
    const { THREE, RoundedBoxGeometry } = L;
    // APP: la paleta y el peinado de la persona; lo que falte, el de Martín
    const P = (window.CUBOS && window.CUBOS.personaje) || {};
    const hx = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? parseInt(v.slice(1), 16) : d);
    const C = { skin: hx(P.skin, 0xe8a682), skinD: hx(P.skinD, 0xd08a66), hair: hx(P.hair, 0xb4471a), hair2: hx(P.hair2, 0xd0622a), hairD: hx(P.hairD, 0x8a3212), tee: hx(P.tee, 0x1c1c23), teeL: hx(P.teeL, 0x2d2d36), jean: 0x272b44, shoe: 0xf1f0f4, sole: 0xc9c7d2, white: 0xeceaee, black: 0x060608, brow: hx(P.brow, 0x3a1d10), iris: hx(P.iris, 0x4a2a14) };
    const PEINADO = ['rulos', 'corto', 'largo', 'rapado'].includes(P.peinado) ? P.peinado : 'rulos';
    const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .62, metalness: 0, envMapIntensity: .35 }, o));
    const RB = (w, h, d, r = .06, s = 4) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001));
    const mesh = (g, m, x = 0, y = 0, z = 0, p) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); if (p) p.add(o); return o; };
    const root = new THREE.Group();
    const mSkin = M(C.skin, { roughness: .55 }), mTee = M(C.tee, { roughness: .85 }), mTeeL = M(C.teeL, { roughness: .8 });
    const mH = [M(C.hair, { roughness: .7 }), M(C.hair2, { roughness: .65 }), M(C.hairD, { roughness: .75 })];
    const mJean = M(C.jean, { roughness: .8 }), mBlack = M(C.black, { roughness: .25 }), mWhite = M(C.white, { roughness: .4 });
    if (!busto) for (const sx of [-1, 1]) {
      mesh(RB(.47, .2, .6, .07), M(C.shoe, { roughness: .45 }), sx * .25, .12, .06, root);
      mesh(RB(.48, .07, .61, .03), M(C.sole), sx * .25, .035, .06, root);
      mesh(RB(.44, 1.2, .46, .07), mJean, sx * .24, .8, 0, root);
    }
    const torso = new THREE.Group(); torso.position.y = 1.32; root.add(torso);
    mesh(RB(1.06, 1.16, .6, .1), mTee, 0, .6, 0, torso);
    if (busto) mesh(RB(1.06, 4, .6, .1), mTee, 0, -1.6, 0, torso);   // la remera sigue: plano de busto, sin piernas
    mesh(RB(.5, .07, .4, .03), mTeeL, 0, 1.17, .03, torso);
    mesh(RB(.32, .22, .3, .06), mSkin, 0, 1.25, .02, torso);
    { const mc = M(0xdfe1e8, { metalness: .9, roughness: .25 }); for (let k = -3; k <= 3; k++) { const x = k * .055, y = 1.13 - (3 - Math.abs(k)) * .035; mesh(new THREE.BoxGeometry(.035, .02, .02), mc, x, y, .305, torso); } }
    const arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * .68, 2.42, 0); root.add(sh);
      mesh(RB(.34, .42, .37, .08), mTee, 0, -.19, 0, sh);
      mesh(RB(.25, .22, .27, .07), mSkin, 0, -.46, 0, sh);
      const el = new THREE.Group(); el.position.y = -.56; sh.add(el);
      mesh(RB(.24, .48, .27, .08), mSkin, 0, -.24, 0, el);
      const mano = mesh(RB(.23, .22, .27, .07), mSkin, 0, -.58, 0, el);
      arms.push({ sh, el, mano });
    }
    // un celular en la mano derecha (sólo se ve con brazos:'telefono')
    const tel = new THREE.Group(); arms[1].el.add(tel); tel.position.set(-.02, -.78, .12);
    mesh(RB(.36, .62, .05, .05), M(0x16161b, { roughness: .3, metalness: .3 }), 0, 0, 0, tel);
    const telLuz = mesh(new THREE.PlaneGeometry(.31, .55), new THREE.MeshBasicMaterial({ color: 0x8fb3ff }), 0, 0, .027, tel); telLuz.name = 'pantalla';
    tel.visible = false;
    const head = new THREE.Group(); head.position.y = 3.1; root.add(head);
    mesh(RB(1, 1, .95, .1, 5), mSkin, 0, 0, 0, head);
    for (const sx of [-1, 1]) mesh(RB(.1, .21, .17, .04), M(C.skinD), sx * .535, -.06, 0, head);
    mesh(RB(.11, .14, .1, .04), M(C.skinD), 0, -.14, .5, head);
    if (PEINADO === 'rulos') {   // APP: el peinado de Martín, sin tocar un cubo
    mesh(RB(1.14, .34, 1.08, .12), mH[0], 0, .46, -.02, head);
    mesh(RB(1.1, .8, .18, .08), mH[2], 0, .16, -.5, head);
    for (const sx of [-1, 1]) mesh(RB(.14, .46, .9, .06), mH[0], sx * .55, .26, -.05, head);
    { const r = rng(5);
      [-.44, -.27, -.1, .07, .24, .41].forEach((x, k) => { const m = mesh(RB(.26, .22, .28, .1), mH[k % 2], x, .4 - (k % 3) * .025, .42, head); m.rotation.set(-.3 + (r() - .5) * .3, (r() - .5) * .5, (r() - .5) * .9); });
      [[-.2, .31], [.12, .3], [.32, .32]].forEach(([x, y], k) => { const m = mesh(RB(.18, .2, .18, .08), mH[(k + 1) % 2], x, y, .47, head); m.rotation.set(-.4, (r() - .5) * .6, (r() - .5) * 1.2); });
      for (let k = 0; k < 13; k++) { const a = r() * Math.PI * 2, d = .1 + r() * .42; const m = mesh(RB(.24 + r() * .08, .26 + r() * .1, .24 + r() * .08, .1), mH[k % 3 === 2 ? 2 : k % 2], Math.cos(a) * d, .64 + r() * .12, Math.sin(a) * d * .8 - .02, head); m.rotation.set((r() - .5) * .9, r() * 1.5, (r() - .5) * 1.1); }
      for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const m = mesh(RB(.2, .22, .22, .08), mH[k % 2], sx * (.5 + r() * .06), .42 + k * .1, -.25 + k * .22, head); m.rotation.set(r(), r(), r()); } }
    } else if (PEINADO === 'corto') {   // APP: pelo corto, una gorra de cubos con flequillo
      mesh(RB(1.1, .26, 1.04, .1), mH[0], 0, .5, -.02, head);
      mesh(RB(1.08, .62, .16, .07), mH[2], 0, .22, -.49, head);
      for (const sx of [-1, 1]) mesh(RB(.12, .34, .86, .05), mH[0], sx * .54, .3, -.04, head);
      [-.36, -.18, 0, .18, .36].forEach((x, k) => { const m = mesh(RB(.22, .14, .2, .06), mH[k % 2], x, .43 - (k % 2) * .02, .44, head); m.rotation.set(-.2, 0, (k - 2) * .06); });
    } else if (PEINADO === 'largo') {   // APP: pelo largo, hasta los hombros
      mesh(RB(1.16, .32, 1.1, .12), mH[0], 0, .48, -.02, head);
      mesh(RB(1.16, 1.5, .2, .08), mH[2], 0, -.2, -.52, head);
      for (const sx of [-1, 1]) mesh(RB(.16, 1.1, .8, .07), mH[0], sx * .57, -.05, -.06, head);
      for (const sx of [-1, 1]) { const m = mesh(RB(.52, .2, .18, .08), mH[1], sx * .24, .4, .45, head); m.rotation.z = -sx * .22; }
    } else {   // APP: rapado, una sombra de pelo
      mesh(RB(1.03, .1, .98, .05), mH[2], 0, .47, -.01, head);
    }
    if (P.barba) {   // APP: barba del color oscuro del pelo; la boca queda adelante
      mesh(RB(.84, .2, .24, .08), mH[2], 0, -.43, .38, head);
      for (const sx of [-1, 1]) mesh(RB(.14, .42, .7, .06), mH[2], sx * .47, -.22, .08, head);
      mesh(RB(.36, .06, .06, .03), mH[2], 0, -.235, .495, head);
    }
    if (P.anteojos) {   // APP: anteojos de marco negro
      const mf = M(0x16161a, { roughness: .35 });
      for (const sx of [-1, 1]) {
        const x = sx * .205;
        mesh(RB(.33, .045, .03, .012), mf, x, .135, .505, head); mesh(RB(.33, .045, .03, .012), mf, x, -.125, .505, head);
        mesh(RB(.045, .3, .03, .012), mf, x - .165, .005, .505, head); mesh(RB(.045, .3, .03, .012), mf, x + .165, .005, .505, head);
        mesh(RB(.03, .04, .55, .012), mf, sx * .52, .05, .25, head);
      }
      mesh(RB(.1, .04, .03, .012), mf, 0, .05, .505, head);
    }
    const face = { brows: [], lids: [], pupils: [] };
    for (const sx of [-1, 1]) {
      face.brows.push(mesh(RB(.3, .075, .07, .03), M(C.brow, { roughness: .8 }), sx * .215, .19, .49, head));
      const eye = new THREE.Group(); eye.position.set(sx * .205, 0, .478); head.add(eye);
      mesh(RB(.25, .22, .03, .012), M(0xeeecef, { roughness: .35 }), 0, 0, 0, eye);
      const pu = new THREE.Group(); pu.position.set(sx * .015 + .025, -.01, .018); eye.add(pu);
      mesh(RB(.125, .155, .02, .01), M(C.iris, { roughness: .2 }), 0, 0, 0, pu);
      mesh(RB(.07, .09, .012, .006), mBlack, 0, -.005, .012, pu);
      mesh(new THREE.BoxGeometry(.04, .04, .01), new THREE.MeshBasicMaterial({ color: 0xffffff }), .03, .045, .02, pu);
      face.lids.push(mesh(new THREE.BoxGeometry(.27, 1, .04), mSkin, 0, 0, .02, eye)); face.pupils.push(pu);
    }
    const mouth = new THREE.Group(); mouth.position.set(0, -.3, .48); head.add(mouth);
    const mm = M(0x3a0f0c, { roughness: .4 });
    const ml = mesh(RB(.24, .038, .02, .012), mm, 0, 0, 0, mouth);
    const mc = [-1, 1].map((sx) => mesh(RB(.09, .038, .02, .012), mm, sx * .15, 0, 0, mouth));
    const mo = mesh(RB(.22, .24, .02, .02), mm, 0, -.06, 0, mouth);
    const teeth = mesh(new THREE.BoxGeometry(.2, .045, .012), mWhite, 0, .03, .012, mouth);
    return { root, torso, head, arms, face, mouth: { ml, mc, mo, teeth }, tel };
  }

  function martin(el, o = {}) {
    const ancho = o.ancho || 1000, alto = Math.round(ancho * 1000 / 600), busto = (o.encuadre || 'busto') === 'busto';
    const cv = document.createElement('canvas'); cv.width = ancho; cv.height = alto;
    cv.style.cssText = 'display:block;width:' + ancho + 'px;height:' + alto + 'px'; el.appendChild(cv);
    const api = { svg: cv, lienzo: cv, three: null, pinta: () => {} };
    api.listo = cargar().then((L) => {
      const { THREE, RoomEnvironment } = L;
      const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(ancho, alto, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .98; renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.add(new THREE.HemisphereLight(0xfff4e8, 0x2a2238, 1.05));
      const key = new THREE.DirectionalLight(0xfff0de, 2.5); key.position.set(-5, 8, 10); scene.add(key);
      const fill = new THREE.DirectionalLight(0xffe2c8, .7); fill.position.set(6, 2, 8); scene.add(fill);
      const rim = new THREE.DirectionalLight(o.borde || 0xffc98a, 1.7); rim.position.set(5, 6, -8); scene.add(rim);
      const chico = armarChico(L, busto); scene.add(chico.root);
      // cámara: la cabeza (y=3,1) en (0,5, 0,33) del lienzo y ~42 % del ancho; en 'cuerpo', el chico entero
      const cam = new THREE.PerspectiveCamera(busto ? 22 : 30, ancho / alto, .1, 100);
      if (busto) { cam.position.set(0, 3.0, 10.4); cam.lookAt(0, 2.47, 0); }
      else { cam.position.set(0, 2.2, 11.5); cam.lookAt(0, 1.9, 0); }
      cam.updateMatrixWorld();
      api.three = { THREE, escena: scene, camara: cam, chico, renderer };
      api.pinta = (T, K, op = {}) => {
        const h = op.calla ? 0 : K.habla(T); const c = chico; const b = Math.sin(T * 2.1) * .012;
        c.torso.scale.y = 1 + b * .5; c.head.position.y = 3.1 + b;
        c.root.rotation.y = op.giro || 0;
        c.head.rotation.set(-.03 + Math.sin(T * 1.3) * .02 - h * .035 + (op.cabeceo || 0), (op.mira || 0) * .38 + Math.sin(T * .9) * .05, Math.sin(T * .7) * .035);
        // brazos: quietos al costado; 'telefono' levanta el derecho con el celular; 'arriba' festeja
        const A = c.arms; const br = op.brazos;
        A[0].sh.rotation.set(br === 'arriba' ? -.2 : 0, 0, br === 'arriba' ? -2.5 : -.06); A[0].el.rotation.set(br === 'arriba' ? -.4 : 0, 0, 0);
        if (br === 'telefono') { A[1].sh.rotation.set(-.55, 0, .12); A[1].el.rotation.set(-1.45, 0, 0); }
        else if (br === 'arriba') { A[1].sh.rotation.set(-.2, 0, 2.5); A[1].el.rotation.set(-.4, 0, 0); }
        else { A[1].sh.rotation.set(0, 0, .06); A[1].el.rotation.set(0, 0, 0); }
        c.tel.visible = br === 'telefono';
        // cara
        c.face.brows.forEach((m, i) => { const s = i === 0 ? 1 : -1; m.rotation.z = -s * (op.cejas || 0) * .12; m.position.y = .19 + (op.cejas || 0) * .06 + h * .012; });
        let blink = 0; for (const per of [3.7, 5.3]) { const d = (T + (per === 5.3 ? 1.6 : 0)) % per; if (d < .16) blink = Math.max(blink, Math.sin(d / .16 * Math.PI)); }
        c.face.lids.forEach((l) => { const hh = .235 * blink; l.scale.y = Math.max(.001, hh); l.position.y = .115 - hh / 2; l.visible = hh > .004; });
        c.face.pupils.forEach((p, i) => { p.position.x = (i === 0 ? -1 : 1) * .015 + .025 + (op.mira || 0) * .03; });
        const open = Math.min(1, h * .95), m = c.mouth, abierta = open > .12, curva = op.sonrie == null ? .45 : op.sonrie;
        m.ml.visible = !abierta; m.mc.forEach((cc, i) => { const s = i === 0 ? -1 : 1; cc.visible = !abierta; cc.rotation.z = s * curva * .7; cc.position.y = curva * .03; cc.position.x = s * (.15 - curva * .012); });
        m.mo.visible = abierta; m.teeth.visible = abierta && open > .3; m.mo.scale.y = Math.max(.2, open); m.mo.position.y = -.12 * Math.max(.2, open) + .06; m.mo.scale.x = .8 + .2 * open; m.teeth.position.y = .052;
        renderer.render(scene, cam);
      };
      return api;
    });
    KIT._esperas.push(api.listo);
    return api;
  }
  KIT.martin = martin;

  const TONOS = {
    verde: ['#2c4a3f', '#0e1c17', '#f3d68f'], azul: ['#3a4656', '#11161d', '#a9c8ff'], calido: ['#5e4733', '#1c140d', '#ffc983'],
    gris: ['#5b6168', '#1c1f23', '#fff0c4'], noche: ['#1d2236', '#090b14', '#8fb4ff'],
  };
  function toma(el, o = {}) {
    const [a, b, luz] = TONOS[o.tono || 'verde'];
    el.style.background = `radial-gradient(70% 45% at 50% 38%, ${a} 0%, ${b} 100%)`; el.style.overflow = 'hidden';
    const fondo = document.createElement('div'); fondo.className = 'capa'; fondo.style.filter = 'blur(' + (o.desenfoque || 16) + 'px)'; el.appendChild(fondo);
    // el cuarto: una ventana, un estante, una lámpara, todo fuera de foco
    fondo.innerHTML = `<div style="position:absolute;left:90px;top:300px;width:300px;height:520px;border-radius:14px;background:${luz};opacity:.18"></div>
      <div style="position:absolute;left:700px;top:520px;width:330px;height:46px;border-radius:8px;background:#000;opacity:.25"></div>
      <div style="position:absolute;left:720px;top:420px;width:70px;height:100px;border-radius:8px;background:${luz};opacity:.25"></div>
      <div style="position:absolute;left:820px;top:440px;width:50px;height:80px;border-radius:8px;background:#fff;opacity:.12"></div>
      <div style="position:absolute;left:-60px;top:1100px;width:1200px;height:900px;background:#000;opacity:.25;border-radius:50%"></div>`;
    const R = KIT.rnd(o.semilla || 11); const bok = [];
    for (let i = 0; i < 16; i++) { const d = document.createElement('div'); const s = 24 + R() * 70;
      d.style.cssText = `position:absolute;width:${s}px;height:${s}px;border-radius:50%;background:${luz};opacity:${(.18 + R() * .45).toFixed(2)};filter:blur(${(3 + R() * 9).toFixed(1)}px)`;
      el.appendChild(d); bok.push({ d, x: R() * 1080, y: 120 + R() * 1100, v: 4 + R() * 10, f: R() * 6 }); }
    const box = document.createElement('div'); box.style.cssText = 'position:absolute;left:0;top:0;transform-origin:50% 100%'; el.appendChild(box);
    const m = KIT.martin(box, { ancho: o.ancho || 1000, encuadre: 'busto' });
    const ancho = o.ancho || 1000, cabeza = o.cabeza == null ? 0.52 : o.cabeza;
    function pinta(T, K, op = {}) {
      for (const b2 of bok) b2.d.style.transform = `translate(${(b2.x + Math.sin(T * .3 + b2.f) * b2.v * 2).toFixed(1)}px, ${(b2.y + Math.cos(T * .25 + b2.f) * b2.v).toFixed(1)}px)`;
      fondo.style.transform = `translateX(${(Math.sin(T * .2) * 12).toFixed(1)}px) scale(1.06)`;
      const s = op.escala || 1; const cx = 540 - ancho / 2 + (op.x || 0); const cy = 1920 * cabeza - (330 / 600) * ancho + (op.y || 0);
      box.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) scale(${s})`;
      m.pinta(T, K, op);
    }
    return { pinta, martin: m, caja: box };
  }
  KIT.toma = toma;
})();
