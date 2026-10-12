// =============================================================================
// CREAR con IA sin una vacía antes: el ORDEN de las cosas (lib/flujo-ia-crear-core.ts), EJECUTADO
// =============================================================================
// Décima tanda (11/10/2026, NUEVA AUTOMATIZACIÓN 6 y 8; docs/diseno-automations-galeria-v2.md §2 y §4). «Pídeselo a
// MaKo» vive en el modal «Nueva automatización» y en la API de MaKo (`crear_automatizacion_con_ia`): las dos llaman a
// `crearFlujoConIA`, que enchufa las dependencias de verdad a `crearConIA`. Hasta hoy crear exigía una automatización
// vacía (`crear_vacia` primero), así que un «Cancelar» o un fallo de la IA dejaba una vacía HUÉRFANA en la lista.
//
// Lo que fija (con dependencias de mentira que anotan cada escritura):
//   1. si la IA falla, o se cancela mientras escribe, NO se escribe NADA (ni etiquetas, ni la fila, ni los pasos);
//   2. sin id, la fila nace recién DESPUÉS de la revisión, con el nombre, y en ese orden: etiquetas → fila → pasos → CRON;
//   3. si los pasos no se guardan, la fila nueva se BORRA y el motivo sube;
//   4. con id: tiene que seguir vacía, se PAUSA antes de escribir y se renombra con lo propuesto;
//   5. un CRON que no se pudo poner es un aviso (no tumba lo creado); uno sin elegir, «Elige qué la dispara»;
//   6. la ruta y la API llaman a la MISMA función, la API sin http, con el link escrito por el código, y un flujo no la corre.
//
// PROBADO ROMPIÉNDOLO: ver las roturas al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearConIA, AVISO_SIN_CRON, type DepsCrearIA, type FaseCrearIA } from '../lib/flujo-ia-crear-core';
import type { CtxIA, ResultadoIA } from '../lib/flujo-ia';
import type { PasoGrafo } from '../lib/flujo-grafo';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const CTX: CtxIA = {
  etiquetas: [], productos: [], audios: [], archivos: [], acciones: [], links: {},
  disparadores: [{ value: 'venta:3:nuevo', label: 'Llega a «Nuevo»' }],
};

/** Lo que «contesta el modelo»: un flujo de una tarjeta, que pasa por `traducir` (deIA + validarIA + validarGrafo). */
const DEL_MODELO = { nombre: 'Bienvenida a nuevos', disparador: 'd1', inicio: 't1', tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Hola, gracias por escribirnos.' }] };

type Llamada = { op: string; args: unknown[] };
function deps(o: {
  falla?: { error: string; link?: string }; alGenerar?: () => void; guardarTira?: Error; triggerTira?: Error;
  filaPrevia?: { pasos: PasoGrafo[]; nombre: string } | null; etiquetasNuevas?: ResultadoIA['etiquetasNuevas'];
} = {}) {
  const ll: Llamada[] = [];
  const anota = (op: string, ...args: unknown[]) => { ll.push({ op, args }); };
  let guardados: PasoGrafo[] | null = null;
  const d: DepsCrearIA = {
    contexto: async () => ({ ctx: CTX, perfil: 'Vendo cursos.', voz: null }),
    system: async () => 'system',
    generar: async (p) => {
      anota('generar');
      o.alGenerar?.();
      if (o.falla) return o.falla;
      const tr = p.traducir(DEL_MODELO);
      assert.deepEqual(tr.errores, [], 'el flujo de mentira no pasa la revisión');
      return { r: { ...tr.r, etiquetasNuevas: o.etiquetasNuevas ?? tr.r.etiquetasNuevas } };
    },
    crearEtiquetas: async (nuevas) => { anota('etiquetas', nuevas.length); return { ids: new Map(nuevas.map((n) => [n.ref, 90])), creadas: nuevas.map((n) => ({ id: 90, nombre: n.nombre })) }; },
    filaDe: async (id) => { anota('leer', id); if (guardados) return { pasos: guardados, nombre: 'x' }; return o.filaPrevia === undefined ? { pasos: [], nombre: 'Nueva automatización' } : o.filaPrevia; },
    insertar: async (nombre) => { anota('insertar', nombre); return { id: 500, nombre: String(nombre) }; },
    borrar: async (id) => { anota('borrar', id); },
    pausar: async (id) => { anota('pausar', id); },
    guardarPasos: async (id, pasos) => { anota('guardar', id); if (o.guardarTira) throw o.guardarTira; guardados = pasos; },
    motivoDePasos: (e) => (e instanceof MotivoPasos ? e.message : null),
    ponerDisparador: async (id, valor) => { anota('cron', id, valor); if (o.triggerTira) throw o.triggerTira; },
    motivoDeDisparador: (e) => (e instanceof MotivoCron ? e.message : null),
    renombrar: async (id, nombre) => { anota('renombrar', id, nombre); return nombre || null; },
    guardarChat: async (id, mensajes) => { anota('chat', id, mensajes.length); },
  };
  return { d, ll, ops: () => ll.map((x) => x.op) };
}
class MotivoPasos extends Error {}
class MotivoCron extends Error {}
const ESCRITURAS = new Set(['etiquetas', 'insertar', 'borrar', 'pausar', 'guardar', 'cron', 'renombrar', 'chat']);
const escribio = (ops: string[]) => ops.filter((x) => ESCRITURAS.has(x));

// ── 1. Lo que falla no escribe ───────────────────────────────────────────────────

// Rotura sugerida por el diseño (§7): insertar ANTES de generar.
test('si la IA falla, no se escribe NADA: ni etiquetas, ni la fila, ni los pasos (y el error sube con su link)', async () => {
  const { d, ops } = deps({ falla: { error: 'No tienes ninguna IA gratis conectada.', link: '/integraciones?abrir=gemini' } });
  const r = await crearConIA({ ws: 3, pedido: 'Dar la bienvenida' }, d);
  assert.deepEqual(r, { ok: false, error: 'No tienes ninguna IA gratis conectada.', link: '/integraciones?abrir=gemini' });
  assert.deepEqual(escribio(ops()), [], `escribió: ${ops().join(', ')}`);
});

test('cancelado MIENTRAS el modelo escribe: no se escribe NADA y vuelve `cancelado` (la ruta no contesta)', async () => {
  const c = new AbortController();
  const { d, ops } = deps({ alGenerar: () => c.abort() });
  const r = await crearConIA({ ws: 3, pedido: 'Dar la bienvenida', signal: c.signal }, d);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && 'cancelado' in r && r.cancelado, true);
  assert.deepEqual(escribio(ops()), [], `escribió: ${ops().join(', ')}`);
});

// ── 2. Sin id: la fila nace al guardar ───────────────────────────────────────────

// DUODÉCIMA TANDA (§2.5): al NACER la fila se vuelca el chat con MaKo, DESPUÉS del CRON (con id lo escribe la ruta).
test('sin id: etiquetas → fila (con el nombre) → pasos → CRON → chat, en ese orden; sin pausar ni renombrar (nace así)', async () => {
  const fases: string[] = [];
  const { d, ll, ops } = deps({ etiquetasNuevas: [{ ref: -1, nombre: 'Interesado' }] });
  const r = await crearConIA({ ws: 3, pedido: 'Dar la bienvenida', alFase: (f: FaseCrearIA) => { fases.push(f.fase); } }, d);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(fases, ['contexto', 'modelo', 'revision']);
  assert.deepEqual(escribio(ops()), ['etiquetas', 'insertar', 'guardar', 'cron', 'chat']);
  assert.ok(ops().indexOf('generar') < ops().indexOf('etiquetas'), 'escribió antes de que el modelo contestara');
  assert.deepEqual(ll.find((x) => x.op === 'insertar')!.args, ['Bienvenida a nuevos'], 'la fila no nace con el nombre propuesto');
  assert.deepEqual(ll.find((x) => x.op === 'cron')!.args, [500, 'venta:3:nuevo']);
  assert.equal(r.ok && r.secuenciaId, 500);
  assert.equal(r.ok && r.nombre, 'Bienvenida a nuevos');
  assert.equal(r.ok && r.disparador, 'venta:3:nuevo');
  assert.deepEqual(r.ok && r.etiquetasNuevas, [{ id: 90, nombre: 'Interesado' }]);
  // Lo que vuelve es lo GUARDADO (lo que lee el motor), con el orden de revelado.
  assert.ok(r.ok && r.pasos.length > 0 && r.orden.length > 0);
});

test('sin id: si los pasos no se guardan, la fila nueva se BORRA y el motivo sube; un error de la base, también borra y tira', async () => {
  const a = deps({ guardarTira: new MotivoPasos('un mensaje sin texto') });
  const r = await crearConIA({ ws: 3, pedido: 'x' }, a.d);
  assert.deepEqual(r, { ok: false, error: 'No pude guardar el flujo: un mensaje sin texto' });
  assert.deepEqual(escribio(a.ops()), ['etiquetas', 'insertar', 'guardar', 'borrar']);
  const b = deps({ guardarTira: new Error('se cayó la base') });
  await assert.rejects(crearConIA({ ws: 3, pedido: 'x' }, b.d), /se cayó la base/);
  assert.ok(b.ops().includes('borrar'), 'una fila a medias quedó viva');
});

test('el CRON: uno que el negocio no tiene es un AVISO (la automatización queda); uno sin elegir, «Elige qué la dispara»', async () => {
  const a = deps({ triggerTira: new MotivoCron('esa etapa no existe') });
  const r = await crearConIA({ ws: 3, pedido: 'x' }, a.d);
  assert.ok(r.ok);
  assert.equal(r.ok && r.disparador, null);
  assert.ok(r.ok && r.avisos.some((x) => x.includes('esa etapa no existe')), r.ok ? r.avisos.join(' | ') : '');
  // Un error que no es de la persona (la base) no se traga.
  const b = deps({ triggerTira: new Error('timeout') });
  await assert.rejects(crearConIA({ ws: 3, pedido: 'x' }, b.d), /timeout/);
  // Sin disparador elegido por el modelo.
  const c = deps();
  const sinCron = { ...c.d, generar: async (p: Parameters<DepsCrearIA['generar']>[0]) => ({ r: p.traducir({ ...DEL_MODELO, disparador: null }).r }) };
  const rc = await crearConIA({ ws: 3, pedido: 'x' }, sinCron);
  assert.ok(rc.ok && rc.avisos.includes(AVISO_SIN_CRON));
  assert.ok(!c.ops().includes('cron'));
});

// DUODÉCIMA TANDA (12/10/2026, docs/diseno-duodecima-tanda.md §2.1 y §2.3): la revisión de crear (`traducir`) lleva el
// PERFIL —«Ya procesamos tu pago en Stripe» en un negocio sin Stripe es una herramienta inventada— y el CRON que eligió el
// modelo (`validarIA(…, r.disparador)`): un DM con un CRON de etapa no sale nunca, Meta no deja escribir primero.
// Roturas (romper.mjs del scratchpad wf-duodecima/ia-crear, base de este archivo 9 / 0): `traducir` sin `perfil` → 8 / 1
// (éste); `traducir` sin `r.disparador` → 8 / 1 (éste).
test('la revisión de crear conoce el PERFIL y el CRON que eligió el modelo', async () => {
  const errores: string[][] = [];
  const con = (obj: Record<string, unknown>, perfil = 'Vendo cursos.') => ({
    ...deps().d,
    contexto: async () => ({ ctx: CTX, perfil, voz: null }),
    generar: async (p: Parameters<DepsCrearIA['generar']>[0]) => { const tr = p.traducir(obj); errores.push(tr.errores); return { r: tr.r }; },
  });
  const stripe = { ...DEL_MODELO, tarjetas: [{ id: 't1', tipo: 'mensaje', texto: 'Ya procesamos tu pago en Stripe.' }] };
  await crearConIA({ ws: 3, pedido: 'Bienvenida' }, con(stripe));
  assert.ok(errores[0].some((e) => e.includes('«Stripe»')), errores[0].join(' | '));
  await crearConIA({ ws: 3, pedido: 'Bienvenida' }, con(stripe, 'Vendo cursos y cobro con Stripe.'));
  assert.deepEqual(errores[1], [], 'nombrada en el perfil, vale');
  // Un DM con el CRON de etapa del modelo (`venta:3:nuevo`).
  await crearConIA({ ws: 3, pedido: 'Bienvenida' }, con({ ...DEL_MODELO, tarjetas: [{ id: 't1', tipo: 'mensaje', canal: 'instagram', texto: 'Hola' }] }));
  assert.ok(errores[2].some((e) => /disparador de Instagram/.test(e)), errores[2].join(' | '));
});

// ── 3. Con id (la caja del lienzo vacío, que hoy no se dibuja) ────────────────────

test('con id: tiene que seguir VACÍA (si no, no se pisa), se PAUSA antes de escribir y se renombra con lo propuesto', async () => {
  const llena = deps({ filaPrevia: { pasos: [{ id: 'm1' } as PasoGrafo], nombre: 'Otra' } });
  const r = await crearConIA({ ws: 3, pedido: 'x', secuenciaId: 77 }, llena.d);
  assert.deepEqual(r, { ok: false, error: 'Alguien le puso tarjetas mientras tanto: no la pisé.' });
  assert.ok(!llena.ops().some((x) => x === 'pausar' || x === 'guardar' || x === 'insertar'));
  const vacia = deps();
  const ok = await crearConIA({ ws: 3, pedido: 'x', secuenciaId: 77 }, vacia.d);
  assert.ok(ok.ok);
  assert.deepEqual(escribio(vacia.ops()), ['etiquetas', 'pausar', 'guardar', 'cron', 'renombrar']);
  assert.equal(ok.ok && ok.secuenciaId, 77);
  assert.equal(ok.ok && ok.nombre, 'Bienvenida a nuevos');
  const borrada = deps({ filaPrevia: null });
  assert.deepEqual(await crearConIA({ ws: 3, pedido: 'x', secuenciaId: 77 }, borrada.d), { ok: false, error: 'Esa automatización ya no existe.' });
});

// ── 4. Las dos puertas ──────────────────────────────────────────────────────────

test('la ruta y la API llaman a la MISMA función (`crearFlujoConIA`), y la API va sin http, por chat y sólo para un admin', () => {
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts'));
  assert.match(ruta, /const r = await crearFlujoConIA\(\{ ws, pedido, secuenciaId, inicio, plazoMs: PLAZO_MODELO_MS, signal: req\.signal, alFase: send, respuestas, historial, via: 'app' \}\);/);
  assert.doesNotMatch(ruta, /crearSecuenciaVacia|setSecuenciaPasos|setTriggerSecuencia/, 'la ruta volvió a crear por su cuenta');
  const lib = sinComentarios(leer('lib/flujo-ia-crear.ts'));
  assert.match(lib, /^import 'server-only';/m);
  assert.match(lib, /return runWithWorkspace\(o\.ws, \(\) => crearConIA\(o, depsReales\(o\.ws\)\)\);/, 'el workspace no es lo primero');
  const def = porId('crear_automatizacion_con_ia');
  assert.ok(def && esAccion(def));
  assert.equal(def.confirmacion, 'chat');
  assert.deepEqual([...def.canales].sort(), ['app', 'whatsapp'], 'sale por HTTP: tarda minutos y /api/v1 corta a 60 s');
  assert.equal(def.costo, 'gratis');
  assert.equal(def.gating?.rolMinimo, 'admin');
  // Duodécima tanda (§2.4): las respuestas a las preguntas de MaKo, opcionales.
  assert.deepEqual(def.parametros.map((p) => [p.nombre, !!p.obligatorio]), [['pedido', true], ['canal', false], ['producto', false], ['evento', false]]);
  // La vieja se retiró: con las dos, el doer podía crear el esqueleto lineal de antes.
  assert.equal(porId('crear_secuencia_mensajes') ?? null, null);
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  const op = run.slice(run.indexOf('crear_automatizacion_con_ia: {'), run.indexOf('cambiar_espera_paso: {'));
  // Duodécima tanda: `preparar` suma las preguntas (§2.4), y el recorte llega a ~4.600.
  assert.ok(op.length > 200 && op.length < 6000, `el recorte mide ${op.length}`);
  assert.match(op, /const r = await crearFlujoConIA\(\{ ws: ctx\.ws, pedido: String\(payload\.pedido \?\? ''\), plazoMs: 170_000, respuestas: sanearRespuestas\(payload\.respuestas\), via \}\);/);
});

// Rotura sugerida por el diseño (§7): sacar el chequeo del flujo.
test('la API: un flujo no la corre (preparar lo rechaza y el lienzo no la ofrece), y el link a la nueva lo escribe el código', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  const op = run.slice(run.indexOf('crear_automatizacion_con_ia: {'), run.indexOf('cambiar_espera_paso: {'));
  const preparar = op.slice(op.indexOf('preparar:'), op.indexOf('ejecutar:'));
  const flujo = preparar.indexOf('if (desdeUnFlujo(ctx)) return { error:');
  assert.ok(flujo > 0 && flujo < preparar.indexOf('hayIAParaCrear()'), 'desde un flujo no se rechaza antes de mirar la IA');
  assert.match(preparar, /if \(!\(await hayIAParaCrear\(\)\)\) \{/, 'no mira si hay IA ANTES de proponer');
  const flujoTs = sinComentarios(leer('lib/api-mako/flujo.ts'));
  assert.match(flujoTs, /export const NO_EN_FLUJOS: ReadonlySet<string> = new Set\(\['crear_automatizacion_con_ia'\]\);/);
  assert.match(flujoTs, /visible\(d, vista\) && !NO_EN_FLUJOS\.has\(d\.id\)/);
  // El link: `linkApp` con `?sec=` y `&mako=1` (abre el chat de MaKo; lleva el `?ws=`), por `paraLaPersona` — nunca por
  // el modelo (el `resumen`).
  const ejecutar = op.slice(op.indexOf('ejecutar:'));
  assert.match(ejecutar, /const link = linkApp\(`\/automations\?sec=\$\{r\.secuenciaId\}&mako=1`, ctx\.ws\);/);
  assert.match(ejecutar, /paraLaPersona: `[^`]*\$\{link\}`/);
  assert.doesNotMatch(ejecutar.slice(ejecutar.indexOf('resumen:'), ejecutar.indexOf('paraLaPersona:')), /\$\{link\}/, 'el link viaja en el resumen (lo lee el modelo)');
  assert.match(ejecutar, /datos: \{ secuenciaId: r\.secuenciaId \}/);
});

// ROTURAS (11/10/2026), una por vez y restaurada DE MEMORIA con sha1 igual (arnés `galeria10-roturas.mjs` del
// scratchpad). Base: 8 / 0. Restaurado: 8 / 0.
//   R1. crear sin id INSERTA la fila antes de que el modelo conteste (lib/flujo-ia-crear-core.ts)       → 4 / 4 (la IA que
//       falla, el cancelado, el orden sin id y el borrado de la fila nueva)
//   R2. sin `if (desdeUnFlujo(ctx)) return { error: … }` en `preparar` (lib/api-mako/areas/chatbot.run.ts) → 7 / 1 (un flujo
//       no la corre)
// DUODÉCIMA TANDA (12/10/2026; arnés scratchpad/wf-duodecima/ia-preguntas-ruta/romper.mjs, junto con crear-ia-preguntas y
// flujo-ia-ruta: base 34 / 0). El chat del core también con id → 32 / 2 («con id» cae acá); el chat ANTES del CRON →
// 31 / 3 (los dos órdenes de acá); la ruta sin `respuestas, historial, via` → 31 / 3 (la MISMA función cae acá); el link
// de la API sin `&mako=1` → 33 / 1 (el link, acá).
