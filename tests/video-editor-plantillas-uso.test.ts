// =============================================================================
// Plantillas de anuncio: la pestaña «Plantillas» y «Utilizar plantilla» (tanda 3)
// =============================================================================
// Plan: docs/editor-video/plan-plantillas-anuncio.md §1.4 y §3.
//   1–4  lo puro del uso (_opencut/plantillas/uso.ts): qué muestras pide cada
//        plantilla (y que alcanzan para armarla), cuándo la línea de tiempo está
//        vacía, qué fuentes se cargan enteras y qué letras pide cada miniatura, y
//        los medios que llenan un hueco.
//   5–6  el dibujo (_opencut/plantillas/dibujo.ts) con un canvas de mentira: la
//        muestra de un clip y la miniatura, con la «Máquina de escribir» cortando.
//   7–11 lo que se fija leyendo el fuente: la pestaña registrada, `usarPlantilla`
//        en UN paso de deshacer, la biblioteca sin familias enteras al montar,
//        dónde se arma (vacío → ahí; con algo → proyecto nuevo) y el aviso de
//        Exportar.
// Lo que se ve (la miniatura, el armado medido con la fuente de verdad, el proyecto
// nuevo) no tiene test: hay que mirarlo en el navegador.
//
// Probado rompiéndolo (15/10/2026): el resultado de cada rotura está al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLANTILLAS, plantillaPorId, type Plantilla } from '../lib/editor-video/plantillas';
import {
  familiasDe, lineaVacia, mediosDeHuecos, muestrasDeFuente, nombreMuestra, rotulosDe, textoVisible,
} from '../app/video-editor/_opencut/plantillas/uso';
import { COLOR_CIERRE, dibujarMiniatura, dibujarMuestraClip, type Contexto2D } from '../app/video-editor/_opencut/plantillas/dibujo';
import { armarLinea, type Medir } from '../app/video-editor/_opencut/plantillas/armar';
import { ANIM } from '../app/video-editor/_opencut/params/extra/animaciones';
import type { SceneTracks, TimelineElement } from '../app/video-editor/_opencut/timeline';

const porId = (id: string) => plantillaPorId(id) as Plantilla;
const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const fuente = (r: string) => sinComentarios(leer(r));
const PL = 'app/video-editor/_opencut/plantillas';

// ── Lo puro del uso ──────────────────────────────────────────────────────────

/** Los params por defecto que importan al armado (como en tests/video-editor-plantillas.test.ts). */
const base = (tipo: string) => ({
  'transform.scaleX': 1, 'transform.scaleY': 1, 'transform.positionX': 0, 'transform.positionY': 0, opacity: 1,
  [ANIM.entrada.id]: 'ninguno', [ANIM.entrada.duracion]: 0.5, [ANIM.salida.id]: 'ninguno', [ANIM.salida.duracion]: 0.5,
  ...(tipo === 'video' || tipo === 'image' ? { [ANIM.combo.id]: 'ninguno', [ANIM.combo.duracion]: 0.5 } : { [ANIM.bucle.id]: 'ninguno', [ANIM.bucle.duracion]: 0.5 }),
});
const medir: Medir = ({ params }) => ({ content: params.content, 'transform.positionX': 0, 'transform.positionY': 0 });

test('1: cada plantilla pide UNA muestra por rótulo, y con ésas se arma entera', () => {
  assert.deepEqual(rotulosDe(porId('gancho')), ['Tu clip', '']);
  assert.deepEqual(rotulosDe(porId('antes-despues')), ['Antes', 'Después', '']);
  assert.deepEqual(rotulosDe(porId('oferta-glitch')), ['Tu producto', '']);
  assert.equal(nombreMuestra(''), 'Muestra · Cierre.png');
  assert.equal(nombreMuestra('Tu clip'), 'Muestra · Tu clip.png');
  for (const p of PLANTILLAS) {
    const rotulos = rotulosDe(p);
    assert.equal(new Set(rotulos.map(nombreMuestra)).size, rotulos.length, `${p.id}: dos rótulos con el mismo medio`);
    let n = 0;
    const muestras = Object.fromEntries(rotulos.map((r) => [r, { mediaId: `m-${r}`, width: 1080, height: 1920 }]));
    // armarLinea tira si falta la muestra de un rótulo.
    const { tracks } = armarLinea({
      plantilla: p, lienzo: { width: 1080, height: 1920 }, fps: 30, tps: 1000,
      principal: { id: 'principal', name: 'Principal', type: 'video', elements: [], muted: false, hidden: false },
      muestras, base, medir, nuevoId: () => `e${++n}`,
    });
    const usados = new Set([...tracks.overlay, tracks.main].flatMap((t) => t.elements as TimelineElement[]).flatMap((e) => ('mediaId' in e ? [e.mediaId] : [])));
    assert.deepEqual([...usados].sort(), Object.values(muestras).map((m) => m.mediaId).sort(), `${p.id}: una muestra que no se usa`);
  }
});

const pista = (id: string, elements: unknown[] = []) => ({ id, name: id, type: 'video', elements, muted: false, hidden: false });
const vacia = (): SceneTracks =>
  ({ overlay: [{ ...pista('t1'), type: 'text' }], main: pista('principal'), audio: [{ ...pista('a1'), type: 'audio' }] }) as unknown as SceneTracks;

test('2: la línea de tiempo está vacía sólo si NINGUNA pista tiene algo (las pistas vacías no cuentan)', () => {
  assert.equal(lineaVacia(vacia()), true);
  const un = { id: 'x', startTime: 0, duration: 1 };
  for (const donde of ['overlay', 'main', 'audio'] as const) {
    const t = vacia() as unknown as Record<string, unknown>;
    if (donde === 'main') t.main = pista('principal', [un]);
    else t[donde] = [{ ...pista(donde), elements: [un] }];
    assert.equal(lineaVacia(t as unknown as SceneTracks), false, donde);
  }
});

/** El gancho con su frase en minúscula (el catálogo las trae ya en mayúscula: así no se ve si se aplica). */
const enMinuscula: Plantilla = {
  ...porId('gancho'),
  piezas: porId('gancho').piezas.map((x) => (x.tipo === 'texto' && x.hueco?.nombre === 'gancho' ? { ...x, muestra: 'esto sí' } : x)),
};

test('3: se cargan ENTERAS sólo las familias de la plantilla; la miniatura pide sus letras por familia y peso', () => {
  assert.deepEqual(familiasDe(porId('gancho')), ['Montserrat', 'Anton']);
  assert.deepEqual(familiasDe(porId('testimonio')), ['Montserrat', 'Playfair Display']);
  const testimonio = muestrasDeFuente(porId('testimonio'));
  assert.deepEqual(testimonio.map((m) => `${m.familia} ${m.peso}`), ['Montserrat 700', 'Playfair Display 400', 'Montserrat 400']);
  // Con «Mayúsculas», lo que se dibuja (y se pide) es la mayúscula, aunque el texto venga en minúscula.
  assert.ok(muestrasDeFuente(porId('gancho')).find((m) => m.familia === 'Anton')?.texto.includes('ESTO LO CAMBIA TODO'));
  assert.equal(muestrasDeFuente(enMinuscula).find((m) => m.familia === 'Anton')?.texto, 'ESTO SÍ');
  // Cada letra que dibuja una tarjeta está en el pedido de su fuente y su peso.
  for (const p of PLANTILLAS) {
    const pedidos = muestrasDeFuente(p);
    for (const x of p.piezas) {
      if (x.tipo !== 'texto') continue;
      const pedido = pedidos.find((m) => m.familia === x.estilo.fuente && m.peso === (x.estilo.negrita ? 700 : 400));
      for (const letra of textoVisible(x).replace(/\s+/g, '')) assert.ok(pedido?.texto.includes(letra), `${p.id}: «${letra}» de «${x.muestra}»`);
    }
  }
});

test('4: los medios que llenan un hueco: sólo videos y fotos de Multimedia con tamaño, en huecos de clip', () => {
  const assets = [
    { id: 'v1', type: 'video' as const, name: 'toma.mp4', width: 1080, height: 1920, duration: 14 },
    { id: 'f1', type: 'image' as const, name: 'foto.jpg', width: 1200, height: 800 },
    { id: 'a1', type: 'audio' as const, name: 'voz.mp3' },
    { id: 's1', type: 'image' as const, name: 'rara.png' },
  ];
  const r = mediosDeHuecos(porId('antes-despues'), assets, { antes: 'v1', despues: 'f1', final: 'a1', rotulo: 'f1', 'rotulo-antes': 'f1', nada: 'zz' });
  assert.deepEqual(r.medios, {
    antes: { mediaId: 'v1', type: 'video', width: 1080, height: 1920, duracion: 14, nombre: 'toma.mp4' },
    despues: { mediaId: 'f1', type: 'image', width: 1200, height: 800, duracion: undefined, nombre: 'foto.jpg' },
  });
  assert.equal(r.descartes.length, 4);
  assert.match(r.descartes.join('\n'), /"final": el medio no es un video ni una foto/);
  assert.match(r.descartes.join('\n'), /"rotulo-antes" no es un hueco de clip/);
  assert.deepEqual(mediosDeHuecos(porId('gancho'), assets, { clip: 's1' }).descartes, ['"clip": no se sabe el tamaño de «rara.png»']);
});

// ── El dibujo, con un canvas de mentira ──────────────────────────────────────

/** Lo que el canvas de mentira lee de sí mismo; el resto son métodos que no hacen nada. */
type Falso = { font: string; globalAlpha: number; fillStyle: unknown; [clave: string]: unknown };

/** Un canvas 2D que anota lo que se escribe y con qué letra; cada carácter mide medio em. */
function canvasDeMentira() {
  const textos: Array<{ texto: string; font: string; alfa: number }> = [];
  const rellenos: string[] = [];
  const pila: Array<{ font: string; alfa: number; fill: unknown }> = [];
  const ctx: Falso = {
    font: '10px sans-serif', globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    lineJoin: 'miter', textAlign: 'start', textBaseline: 'alphabetic', shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    save() { pila.push({ font: ctx.font, alfa: ctx.globalAlpha, fill: ctx.fillStyle }); },
    restore() { const s = pila.pop(); if (s) { ctx.font = s.font; ctx.globalAlpha = s.alfa; ctx.fillStyle = s.fill; } },
    translate() {}, rotate() {}, scale() {}, beginPath() {}, rect() {}, clip() {}, fill() {}, stroke() {}, moveTo() {}, arcTo() {}, closePath() {}, setLineDash() {},
    fillRect() { rellenos.push(String(ctx.fillStyle)); },
    strokeText() {},
    fillText(texto: string) { textos.push({ texto, font: ctx.font, alfa: ctx.globalAlpha }); },
    measureText(s: string) { const px = Number(/([\d.]+)px/.exec(ctx.font)?.[1] ?? 10); return { width: [...s].length * px * 0.5 }; },
  };
  return { ctx: ctx as unknown as Contexto2D, textos, rellenos };
}
const familia = (f: string, peso: number) => `"${f} · muestra ${peso}", sans-serif`;
const dibujar = (id: string, t: number) => {
  const c = canvasDeMentira();
  dibujarMiniatura(c.ctx, { plantilla: porId(id), t, ancho: 216, familia });
  return c;
};

test('5: la muestra de un clip es el rótulo al centro; la del cierre, lisa y sin nada escrito', () => {
  const clip = canvasDeMentira();
  dibujarMuestraClip(clip.ctx, 'Antes', { x: 0, y: 0, ancho: 1080, alto: 1920 });
  assert.deepEqual(clip.textos.map((x) => x.texto), ['Antes']);
  assert.deepEqual(clip.rellenos, ['#2b2b2b']);
  const cierre = canvasDeMentira();
  dibujarMuestraClip(cierre.ctx, '', { x: 0, y: 0, ancho: 1080, alto: 1920 });
  assert.deepEqual(cierre.textos, []);
  assert.deepEqual(cierre.rellenos, [COLOR_CIERRE]);
});

test('6: la miniatura dibuja lo que se ve en el segundo t, con la fuente de su muestra y la máquina de escribir', () => {
  // En la portada del gancho (1 s): la muestra «Tu clip» y el gancho entero, en Anton (la muestra).
  const portada = dibujar('gancho', 1);
  assert.deepEqual(portada.textos.map((x) => x.texto), ['Tu clip', 'ESTO LO CAMBIA', 'TODO']);
  assert.ok(portada.textos[1].font.includes('"Anton · muestra 400"'), portada.textos[1].font);
  const minuscula = canvasDeMentira();
  dibujarMiniatura(minuscula.ctx, { plantilla: enMinuscula, t: 1, ancho: 216, familia });
  assert.deepEqual(minuscula.textos.map((x) => x.texto), ['Tu clip', 'ESTO SÍ'], '«Mayúsculas» también en la miniatura');
  // En t = 0 el «Rebote» arranca transparente: no se escribe nada encima del clip.
  assert.deepEqual(dibujar('gancho', 0).textos.map((x) => x.texto), ['Tu clip']);
  // El cierre (13 s): fondo liso sin rótulo, el título y el botón (negrita: la muestra de 700).
  const cierre = dibujar('gancho', 13);
  assert.deepEqual(cierre.textos.map((x) => x.texto).sort(), ['Escríbenos hoy', '¿Listo para empezar?'].sort());
  assert.ok(cierre.textos.every((x) => x.font.startsWith('700 ') && x.font.includes('Montserrat · muestra 700')));
  // «Gancho escrito»: a la mitad de su 1,5 s se ve la mitad de las letras (9 de 18).
  assert.deepEqual(dibujar('gancho-escrito', 0.75).textos.map((x) => x.texto), ['Tu clip', 'ESTO LO C']);
  assert.deepEqual(dibujar('gancho-escrito', 1.6).textos.map((x) => x.texto), ['Tu clip', 'ESTO LO CAMBIA', 'TODO']);
  // La opacidad de la plantilla (el detalle del testimonio, 0,8) llega al dibujo.
  const detalle = dibujar('testimonio', 3).textos.find((x) => x.texto.startsWith('Clienta'));
  assert.equal(detalle?.alfa, 0.8);
});

// ── Lo que se fija leyendo el fuente ─────────────────────────────────────────

test('7: la pestaña «Plantillas» está registrada entre Ajuste y Avatar, sin subir la versión del persist', () => {
  assert.ok(fuente('app/video-editor/ce/ranuras.ts').includes("| 'ajuste' | 'plantillas' | 'avatar';"));
  const store = fuente('app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store.tsx');
  assert.ok(/"ajuste",\s*"plantillas",\s*"avatar",\s*\];/.test(store), 'el orden de CapCut');
  assert.ok(store.includes('version: 2,'), 'subir la versión borra lo guardado');
  assert.ok(fuente('app/video-editor/_opencut/components/editor/panels/assets/tabbar.tsx').includes('plantillas: { etiqueta: "Plantillas", Icono: icono(DashboardSquare01Icon) }'));
  assert.ok(fuente('app/video-editor/ce/extensiones.ts').includes("import '../_opencut/plantillas/registro';"));
  const registro = fuente(`${PL}/registro.ts`);
  assert.ok(/categoria: "plantillas",[\s\S]*etiqueta: "Anuncios",[\s\S]*Contenido: BibliotecaPlantillas/.test(registro));
});

test('8: usarPlantilla aplica en UN paso de deshacer (relación 9:16 + pistas), con las fuentes cargadas antes de medir', () => {
  const f = fuente(`${PL}/instanciar.ts`);
  assert.equal((f.match(/\.command\.execute\(/g) ?? []).length, 1, 'un solo comando');
  const lote = f.slice(f.indexOf('editor.command.execute('));
  assert.ok(lote.includes('new BatchCommand(['));
  assert.ok(lote.includes('new UpdateProjectSettingsCommand({ relacion: "9:16", canvasSize'));
  assert.ok(lote.includes('new TracksSnapshotCommand({ before: escena.tracks, after: armada.tracks })'));
  for (const otro of ['updateSettings(', 'updateTracks(', 'insertElement(', 'command.push(']) assert.ok(!f.includes(otro), `nada por fuera del lote: ${otro}`);
  const i = (s: string) => f.indexOf(s);
  assert.ok(i('cargarFuentes(familiasDe(plantilla))') > 0 && i('cargarFuentes(familiasDe(plantilla))') < i('armarLinea({'), 'las fuentes antes de medir');
  assert.ok(f.includes('medir: partirYUbicar'));
  assert.ok(f.includes('canvasSize = tamanoDeRelacion({ id: "9:16", settings })') && f.includes('lienzo: canvasSize'), 'se mide en el lienzo que va a quedar');
  // Después del último await, la línea de tiempo se vuelve a mirar (pudo llenarse mientras cargaba).
  assert.ok(f.lastIndexOf('await ') < i('lineaVacia(escena.tracks)'));
});

test('9: la pestaña no carga familias enteras al montar: cada miniatura pide sus letras al entrar en pantalla', () => {
  const b = fuente(`${PL}/components/biblioteca-plantillas.tsx`);
  const m = fuente(`${PL}/components/miniatura-plantilla.tsx`);
  for (const [nombre, f] of [['biblioteca', b], ['miniatura', m]]) {
    for (const entera of ['loadFonts(', 'loadFullFont(', 'cargarFuentes(']) assert.ok(!f.includes(entera), `${nombre}: ${entera}`);
  }
  assert.ok(!b.includes('useEffect('), 'la biblioteca no hace nada al montar');
  assert.equal((m.match(/cargarMuestra\(/g) ?? []).length, 1);
  const pedir = m.indexOf('const pedir = () =>');
  assert.ok(pedir > 0 && m.indexOf('cargarMuestra(') > pedir && m.indexOf('new IntersectionObserver(') > m.indexOf('cargarMuestra('), 'adentro de pedir, que corre desde el observador');
  assert.ok(m.includes('cssFamilia(nombres['), 'dibuja con la muestra, no con el nombre de la familia entera');
});

test('10: vacío → se arma ahí; con algo → proyecto nuevo, armado ANTES de abrir el editor', () => {
  const b = fuente(`${PL}/components/biblioteca-plantillas.tsx`);
  const i = (s: string) => b.indexOf(s);
  assert.ok(i('lineaVacia(escena.tracks)') > 0 && i('usarPlantilla(editor, plantilla)') > i('lineaVacia(escena.tracks)'));
  // Se guarda y se cierra ANTES de navegar: si no, la salida del editor correría sobre el proyecto nuevo.
  assert.ok(i('prepareExit()') < i('save.flush()') && i('save.flush()') < i('closeProject()') && i('closeProject()') < i('router.push(rutaEditor(rutaPlantillaNueva('));
  assert.ok(b.includes('`/video-editor/nuevo?plantilla=${encodeURIComponent(id)}`'));
  assert.ok(/>\s*Utilizar plantilla\s*</.test(b), 'el rótulo de CapCut (use_template_pc)');
  const page = fuente('app/video-editor/[proyecto]/page.tsx');
  assert.ok(page.includes('plantillaPorId(plantilla)?.id ?? null'), 'el id se valida en el server');
  assert.ok(page.includes('plantilla={idPlantilla}'));
  assert.ok(fuente('app/video-editor/VideoEditorCliente.tsx').includes('plantilla !== undefined ? <ArmarPlantilla id={plantilla} />'));
  const a = fuente('app/video-editor/plantilla/ArmarPlantilla.tsx');
  const j = (s: string) => a.indexOf(s);
  assert.ok(a.includes('const enVuelo = new Map<string, Promise<string>>()'), 'la promesa en vuelo sobrevive a un remontaje');
  assert.ok(a.includes('if (arrancado.current === intento) return;'), 'el pestillo por ref (StrictMode)');
  const efecto = a.slice(j('useEffect(() => {'), j('}, [plantilla, intento, router]);'));
  assert.ok(!efecto.includes('return () =>'), 'el efecto NO cancela en su cleanup');
  // Crear recién después de que corra la «salida» del editor de antes (una microtarea después de desmontarse).
  assert.ok(j('setTimeout(listo, 0)') > 0 && j('setTimeout(listo, 0)') < j('createNewProject('), 'una vuelta del bucle antes de crear');
  assert.ok(j('createNewProject(') < j('usarPlantilla(editor, plantilla)') && j('usarPlantilla(editor, plantilla)') < j('command.clear()') && j('command.clear()') < j('saveCurrentProject()'));
  assert.ok(j('saveCurrentProject()') < j('router.replace(`/video-editor/${proyecto}`)'), 'la URL, sin el ?plantilla=, recién al final');
  assert.ok(a.includes('deleteProjects({ ids: [id] })'), 'si falla, no queda un proyecto vacío');
});

test('11: Exportar avisa «Quedan clips de muestra» y no bloquea', () => {
  const f = fuente('app/video-editor/_opencut/export/dialogo-exportar.tsx');
  assert.ok(f.includes('useState(() => quedanMuestras(editor.scenes.getActiveScene().tracks))'));
  assert.ok(f.includes('Quedan clips de muestra'));
  const puede = f.slice(f.indexOf('const puedeExportar'), f.indexOf(';', f.indexOf('const puedeExportar')));
  assert.ok(!puede.includes('conMuestras'), 'no bloquea');
});

// Roturas (15/10/2026), base 11 de 11; cada una restaurada (11/0 al final). Las corrió un script que
// rompe, corre este archivo y devuelve el original:
// · 1: rotulosDe sin quitar repetidos → 10/1. · sin el cierre ("") → 10/1 (armarLinea tira).
// · 2: lineaVacia sin mirar el audio → 10/1.
// · 3: muestrasDeFuente sin el peso en la clave → 10/1. · textoVisible sin «Mayúsculas» → 9/2 (3, 6). (Antes
//   de sumar `enMinuscula`, romper sólo la mayúscula daba 11/0: el catálogo trae las muestras ya en mayúscula.)
// · 4: mediosDeHuecos acepta un audio → 10/1.
// · 5: el cierre con rótulo → 9/2 (5, 6).
// · 6: sin revelado → 10/1. · sin la opacidad del estilo → 10/1. · la familia entera en vez de la muestra → 10/1.
//   · dibuja lo transparente → 10/1.
// · 7: el persist en la versión 3 → 10/1. · sin el import en extensiones → 10/1. · «Templates» → 10/1.
// · 8: la relación por updateSettings aparte (dos pasos) → 10/1. · sin cargar las fuentes → 10/1. · medir en el
//   lienzo de antes → 10/1. · no volver a mirar si la línea sigue vacía → 10/1.
// · 9: la biblioteca carga una familia al montar → 10/1. · la miniatura pide una muestra al montar → 10/1.
//   · la miniatura dibuja con el nombre de la familia entera → 10/1.
// · 10: navega sin cerrar el proyecto → 10/1. · usa la plantilla aunque haya algo → 10/1. · el efecto de
//   ArmarPlantilla cancela en su cleanup → 10/1. · sin vaciar el historial → 10/1. · crea el proyecto sin
//   esperar la «salida» del editor de antes → 10/1. · la page no valida el id → 10/1
//   (y 7/1 en tests/video-editor-integracion.test.ts, 2b).
// · 11: Exportar bloquea con muestras → 10/1.
