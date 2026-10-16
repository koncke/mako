// =============================================================================
// Los pedidos sueltos en los chats de MaKo (lib/mako-pedidos.ts) — con los ejemplos de Martín TAL CUAL
// =============================================================================
// Martín, 16/10/2026 (docs/diseno-mako-pedidos.md): el chat tiene que saber a qué automatización se refiere «la
// otra» sin que la nombre, separar «lo actual» de «créame otra landing» y proponer el orden, y dejar el link
// cuando el mensaje es de otra tab. Estos tests corren SIN red y SIN IA: las reglas, y la IA con un doble que
// devuelve un JSON armado. Las operaciones salen del REGISTRO real (lib/api-mako/registro.ts), filtradas con
// `visible()` como en la ruta: ningún id se inventa acá.
//
// Cada test se probó ROMPIÉNDOLO (arnés que restaura de memoria y verifica el hash), con la base en verde. Los
// números de cada rotura están en el comentario de su test: R1–R13 se midieron con 12 tests, R14 con 13.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FEATURE_PEDIDOS, dudaDeLasReglas, interpretarCon, leerRespuestaIA, llevaDatosPersonales, partirPedidos,
  resolverPedidos, type ContextoPedidos, type ObjetoChat, type OperacionChat, type PedirEtiquetas,
} from '../lib/mako-pedidos';
import { REGISTRO, ordenarPorRelevancia, porId, visible, type Vista } from '../lib/api-mako/registro';
import { AREA_INFO, esAccion, esLectura, type OperacionDef } from '../lib/api-mako/tipos';
import { CATALOGO_MODELOS, PROVEEDORES_PAGOS } from '../lib/model-catalogo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

// ── Los textos de Martín, tal cual ───────────────────────────────────────────
const E1 = 'Quiero eliminar la otra automatización que tengo porque podría unificarla...';
const E2 = 'Feedback sobre lo actual... Y luego y también quiero que me crees otra landing para mi otro producto...';
/** E2 como quedó en el pedido escrito, con los signos con que Martín marcó la segunda parte. */
const E2_CON_SIGNOS = 'Feedback sobre lo actual... Y luego <y también quiero que me crees otra landing para mi otro producto...>';
const E3 = 'Agéndame una reunión con Juan el viernes';
const NEGATIVO = 'Cambia el título del hero por algo más corto';

// ── Las operaciones, del registro real, como las arma la ruta ────────────────
const WS = 3;
const VISTA_ADMIN: Vista = { canal: 'app', alcance: 'proponer', ws: WS, rol: 'admin', tabs: null };
const VISTA_MIEMBRO: Vista = { ...VISTA_ADMIN, rol: 'miembro' };
const opsDe = (v: Vista): OperacionChat[] => REGISTRO
  .filter((d) => (esAccion(d) || esLectura(d)) && visible(d, v))
  .map((d) => ({ id: d.id, area: d.area, tipo: esLectura(d) ? 'lectura' : 'accion', titulo: d.titulo, descripcion: d.descripcion }));
/** El mismo adaptador que la ruta: la relevancia del registro sobre las operaciones como datos. */
const ordenar = (ops: readonly OperacionChat[], texto: string): OperacionChat[] => {
  const m = new Map(ops.map((o) => [o.id, o]));
  return ordenarPorRelevancia(ops.map((o) => porId(o.id)).filter((d): d is OperacionDef => !!d), texto).map((d) => m.get(d.id)!);
};

const A: ObjetoChat = { id: 'A', nombre: 'Bienvenida', tocadoAt: '2026-10-16T10:00:00Z' };
const B: ObjetoChat = { id: 'B', nombre: 'Seguimiento de agendados', tocadoAt: '2026-10-14T10:00:00Z' };
const C: ObjetoChat = { id: 'C', nombre: 'Reactivar leads fríos', tocadoAt: '2026-10-15T10:00:00Z' };
const D: ObjetoChat = { id: 'D', nombre: 'Promo de verano', tocadoAt: '2026-09-01T10:00:00Z' };
const L: ObjetoChat = { id: '41', nombre: 'Curso de inversión', tocadoAt: '2026-10-16T09:00:00Z' };

const ctxChatbot = (objetos: ObjetoChat[], vista = VISTA_ADMIN): ContextoPedidos =>
  ({ tab: 'chatbot', actual: A, objetos, operaciones: opsDe(vista), ordenar, ws: WS });
const ctxLanding = (): ContextoPedidos => ({ tab: 'landing', actual: L, objetos: [L], operaciones: opsDe(VISTA_ADMIN), ordenar, ws: WS });

/** Un doble de la IA que cuenta cuántas veces lo llamaron y devuelve lo que se le arma. */
function doble(raw: string | null): PedirEtiquetas & { llamadas: number } {
  const f: PedirEtiquetas & { llamadas: number } = Object.assign(async () => { f.llamadas++; return raw; }, { llamadas: 0 });
  return f;
}

// Rotura R1 (contar el abierto entre «los otros»: `o.id !== actual?.id` → `true || …`): 8 de 12 (caen éste, el de
// los dos candidatos, el de las operaciones filtradas y el de «nunca decide el objeto»). Rotura R8 (`confirmar =
// false`): 9 de 12 (caen éste, el de los dos candidatos y el de las operaciones filtradas).
test('E1: «la otra automatización» con UN solo otro → ése, archivar del registro, y confirma', async () => {
  const r = await interpretarCon(E1, ctxChatbot([A, B]), null);
  assert.equal(r.pedidos.length, 1);
  const p = r.pedidos[0];
  assert.equal(p.sobre, 'otro');
  if (p.sobre !== 'otro') return;
  assert.deepEqual(p.objeto, B);
  assert.deepEqual(p.candidatos, []);
  // La operación es la REVERSIBLE del área (memoria «Cerrar no es borrar»), y es del registro real.
  assert.equal(p.operacion, 'archivar_secuencia');
  const def = porId(p.operacion!);
  assert.ok(def && def.area === 'chatbot' && esAccion(def), 'archivar_secuencia tiene que ser una acción del área chatbot del registro');
  assert.equal(p.confirmar, true);
  assert.match(p.pregunta ?? '', /Seguimiento de agendados/);
  assert.equal(r.propuesta, null);
  assert.equal(r.origen, 'reglas');
});

// Rotura R2 (con varios, elegir el primero: `orden.length === 1` → `>= 1`): 10 de 12 (caen éste y el de «nunca
// decide el objeto»).
test('E1 con DOS otros o más → los dos más recientes y una pregunta con los dos; nunca elige', async () => {
  const r = await interpretarCon(E1, ctxChatbot([A, B, C]), null);
  const p = r.pedidos[0];
  assert.equal(p.sobre, 'otro');
  if (p.sobre !== 'otro') return;
  assert.equal(p.objeto, null);
  assert.deepEqual(p.candidatos.map((o) => o.id), ['C', 'B'], 'la última tocada primero');
  assert.match(p.pregunta ?? '', /Reactivar leads fríos/);
  assert.match(p.pregunta ?? '', /Seguimiento de agendados/);
  assert.equal(p.confirmar, true, 'borrar confirma aunque falte elegir');
  // Con uno más viejo, sigue mostrando los DOS más recientes.
  const r2 = await interpretarCon(E1, ctxChatbot([A, D, B, C]), null);
  const p2 = r2.pedidos[0];
  assert.ok(p2.sobre === 'otro' && p2.objeto === null);
  assert.deepEqual(p2.sobre === 'otro' ? p2.candidatos.map((o) => o.id) : [], ['C', 'B']);
});

// Rotura R3 (crear algo de esta tab no es «nuevo»: `c.verbo === 'crear' && …` → `false && …`): 11 de 12, cae
// éste. Rotura R4 (sin propuesta: `actuales.length && resto.length` → `false`): 10 de 12 (caen éste y el de E2 en
// Automations).
test('E2 en el Web Generator → lo actual y una landing NUEVA, con la propuesta Sí / Después', async () => {
  const r = await interpretarCon(E2, ctxLanding(), null);
  assert.deepEqual(r.pedidos.map((p) => p.sobre), ['actual', 'nuevo']);
  const actual = r.pedidos[0];
  assert.ok(actual.sobre === 'actual' && /^Feedback sobre lo actual/.test(actual.texto));
  const nuevo = r.pedidos[1];
  assert.equal(nuevo.sobre, 'nuevo');
  if (nuevo.sobre !== 'nuevo') return;
  const def = nuevo.operacion ? porId(nuevo.operacion) : undefined;
  assert.ok(def && def.area === 'landing' && esAccion(def) && /^(?:crear|generar)_/.test(def.id), `la operación tiene que ser crear_* o generar_* del área landing, no ${nuevo.operacion}`);
  assert.ok(r.propuesta);
  assert.match(r.propuesta!.texto, /^¿Terminamos esto y después .+\?$/);
  assert.match(r.propuesta!.texto, /otra landing/);
  assert.deepEqual([...r.propuesta!.botones], ['Sí', 'Después']);
  // Con los signos con que quedó escrito en el pedido, igual son dos.
  const r2 = await interpretarCon(E2_CON_SIGNOS, ctxLanding(), null);
  assert.deepEqual(r2.pedidos.map((p) => p.sobre), ['actual', 'nuevo']);
});

// Rotura R5 (el link sin el workspace: `conWs(info.ruta, …)` → `info.ruta`): 10 de 12 (caen éste y E3).
test('E2 en Automations → la landing es de OTRA tab: el link al Web Generator y la operación', async () => {
  const r = await interpretarCon(E2, ctxChatbot([A, B]), null);
  assert.deepEqual(r.pedidos.map((p) => p.sobre), ['actual', 'otra-tab']);
  const p = r.pedidos[1];
  assert.equal(p.sobre, 'otra-tab');
  if (p.sobre !== 'otra-tab') return;
  assert.equal(p.area, 'landing');
  assert.equal(p.titulo, AREA_INFO.landing.tab);
  assert.equal(p.link, `${AREA_INFO.landing.ruta}?ws=${WS}`);
  const def = p.operacion ? porId(p.operacion) : undefined;
  assert.ok(def && def.area === 'landing' && /^(?:crear|generar)_/.test(def.id), `operación: ${p.operacion}`);
  assert.ok(r.propuesta, 'hay algo de lo actual, así que lo otro se propone');
});

// Rotura R6 (sacar «agend…» de los verbos de crear): 11 de 12, cae éste.
test('E3 en el Web Generator → otra tab: el CRM, con su link', async () => {
  const r = await interpretarCon(E3, ctxLanding(), null);
  assert.equal(r.pedidos.length, 1);
  const p = r.pedidos[0];
  assert.equal(p.sobre, 'otra-tab');
  if (p.sobre !== 'otra-tab') return;
  assert.equal(p.area, 'crm');
  assert.equal(p.link, `${AREA_INFO.crm.ruta}?ws=${WS}`);
  if (p.operacion) assert.equal(porId(p.operacion)?.area, 'crm', 'si hay operación, es del CRM');
  assert.equal(r.propuesta, null, 'sin nada de lo actual no hay propuesta: va directo');
});

// Rotura R7 (sin área nombrada no es la de la tab: `c.area ?? tab` → `c.area ?? 'crm'`): 11 de 12, cae éste.
// Rotura R12 (las reglas dudan siempre: el `return null` del final → `return 'x'`): 11 de 12, cae éste.
test('negativo: un cambio de lo abierto es UN pedido actual, sin propuesta y sin gastar la IA', async () => {
  const ia = doble('{"pedidos":[]}');
  const r = await interpretarCon(NEGATIVO, ctxLanding(), ia);
  assert.deepEqual(r.pedidos, [{ sobre: 'actual', texto: NEGATIVO }]);
  assert.equal(r.propuesta, null);
  assert.equal(ia.llamadas, 0, 'las reglas no dudan: no se llama a la IA');
  assert.equal(dudaDeLasReglas(partirPedidos(NEGATIVO), ctxLanding()), null);
});

// En el Web Generator un sitio tiene PÁGINAS («Añadir página»): «otra página» es una página más de la landing
// abierta, no otra landing (`AREA_KEYWORDS.landing` incluye «página»). Fuera de su tab sí es una landing.
// Rotura R14 (`esParteDeLoAbierto` → `false`): 12 de 13, cae éste.
test('«crea otra página» en el Web Generator es de lo abierto; en Automations, una landing de otra tab', async () => {
  const M: ObjetoChat = { id: '42', nombre: 'Taller de ventas', tocadoAt: '2026-10-15T09:00:00Z' };
  const ctx: ContextoPedidos = { ...ctxLanding(), objetos: [L, M] };
  for (const t of ['Crea otra página con los testimonios', 'Borra la otra página', 'Elimina esta página']) {
    const r = await interpretarCon(t, ctx, null);
    assert.deepEqual(r.pedidos, [{ sobre: 'actual', texto: t }], t);
    assert.equal(r.propuesta, null, t);
  }
  // «Otra landing» sigue siendo una nueva, y «la otra landing» sigue siendo M.
  assert.equal((await interpretarCon('Créame otra landing', ctx, null)).pedidos[0].sobre, 'nuevo');
  const o = (await interpretarCon('Borra la otra landing', ctx, null)).pedidos[0];
  assert.ok(o.sobre === 'otro' && o.objeto?.id === M.id && o.confirmar);
  const fuera = (await interpretarCon('Créame otra página para mi producto', ctxChatbot([A, B]), null)).pedidos[0];
  assert.ok(fuera.sobre === 'otra-tab' && fuera.area === 'landing', JSON.stringify(fuera));
});

// Rotura R8 (`confirmar = false`): ver el de E1. Rotura R9 (la ruta sin `visible()`): 11 de 12, cae éste.
test('borrar con el objeto claro igual confirma, y una operación que la persona no ve no se ofrece', async () => {
  // Un closer: archivar_secuencia es `rolMinimo: 'admin'`, así que no está entre sus operaciones.
  assert.equal(opsDe(VISTA_MIEMBRO).some((o) => o.id === 'archivar_secuencia'), false);
  const r = await interpretarCon(E1, ctxChatbot([A, B], VISTA_MIEMBRO), null);
  const p = r.pedidos[0];
  assert.ok(p.sobre === 'otro');
  if (p.sobre !== 'otro') return;
  assert.deepEqual(p.objeto, B);
  assert.equal(p.operacion, null, 'no se le ofrece lo que su pantalla le esconde');
  assert.equal(p.confirmar, true);
  // Y «elimina esta landing» con el objeto ABIERTO también confirma (y nunca va al camino de siempre del editor).
  const r2 = await interpretarCon('Elimina esta landing', ctxLanding(), null);
  const p2 = r2.pedidos[0];
  assert.ok(p2.sobre === 'otro' && p2.confirmar === true && p2.objeto?.id === L.id);
  assert.equal(p2.sobre === 'otro' ? p2.operacion : null, 'mandar_landing_a_papelera', 'lo reversible primero');
  // La ruta arma las operaciones con `visible()` de la vista de la persona, y de ningún otro lado.
  const ruta = leer('app/api/mako/pedidos/route.ts');
  assert.match(ruta, /REGISTRO\.filter\(\(d\) => \(esAccion\(d\) \|\| esLectura\(d\)\) && visible\(d, vista\)\)/);
  assert.match(ruta, /const vista = await vistaDe\(ctxApi\)/);
});

// Rotura R10 (aceptar cualquier área de la IA aunque el texto no la nombre): 11 de 12. Rotura R11 (aceptar un
// texto que NO está en el mensaje): 11 de 12. Rotura R13 (no llamar nunca a la IA): 11 de 12. Falla éste.
test('la IA: un área que no existe o un verbo raro caen a las reglas; un texto reescrito la descarta entera', async () => {
  const ctx = ctxChatbot([A, B]);
  assert.ok(dudaDeLasReglas(partirPedidos(E2), ctx), 'E2 nombra landing y negocio en un pedido: las reglas dudan');
  const reglas = await interpretarCon(E2, ctx, null);

  // Área inexistente y verbos raros: cada campo cae a las reglas, y el resultado es el de las reglas.
  const [t1, t2] = partirPedidos(E2).map((c) => c.texto);
  const raro = doble(JSON.stringify({ pedidos: [
    { texto: t1, verbo: 'fusionar', area: 'marte', referencia: null },
    { texto: t2, verbo: 'clonar', area: 'marte', referencia: null },
  ] }));
  const r = await interpretarCon(E2, ctx, raro);
  assert.equal(raro.llamadas, 1);
  assert.equal(r.origen, 'ia');
  assert.deepEqual(r.pedidos, reglas.pedidos);

  // Un texto que no está en el mensaje (la IA reescribió): no sirve entera, quedan las reglas.
  const reescrito = doble(JSON.stringify({ pedidos: [{ texto: 'Haz una landing nueva para el producto B', verbo: 'crear', area: 'landing', referencia: null }] }));
  const r2 = await interpretarCon(E2, ctx, reescrito);
  assert.equal(reescrito.llamadas, 1);
  assert.equal(r2.origen, 'reglas');
  assert.deepEqual(r2.pedidos, reglas.pedidos);
  // Y JSON roto, igual.
  assert.equal(leerRespuestaIA('no es json', E2, 'chatbot'), null);

  // Un área que el texto NO nombra (ni es la de la tab) no se acepta: «cambia el precio» no es de Ads.
  const PRECIO = 'Cambia el precio a 97 dólares';
  const lCtx = ctxLanding();
  assert.ok(dudaDeLasReglas(partirPedidos(PRECIO), lCtx), '«precio» nombra negocio: puede ser un cambio de lo abierto');
  const ads = doble(JSON.stringify({ pedidos: [{ texto: PRECIO, verbo: 'editar', area: 'ads', referencia: null }] }));
  assert.deepEqual((await interpretarCon(PRECIO, lCtx, ads)).pedidos, [{ sobre: 'actual', texto: PRECIO }]);
  // Con la etiqueta válida, la IA desempata lo que las reglas no: la de la tab → lo actual; la que nombra → otra tab.
  const deLaTab = doble(JSON.stringify({ pedidos: [{ texto: PRECIO, verbo: 'editar', area: 'landing', referencia: null }] }));
  assert.deepEqual((await interpretarCon(PRECIO, lCtx, deLaTab)).pedidos, [{ sobre: 'actual', texto: PRECIO }]);
  const negocio = doble(JSON.stringify({ pedidos: [{ texto: PRECIO, verbo: 'editar', area: 'negocio', referencia: null }] }));
  const r3 = await interpretarCon(PRECIO, lCtx, negocio);
  assert.equal(r3.pedidos[0].sobre, 'otra-tab');
  assert.equal(r3.pedidos[0].sobre === 'otra-tab' ? r3.pedidos[0].area : null, 'negocio');
});

// Rotura R14 (aceptar la `referencia` de la IA aunque no esté en el pedido): 11 de 12, cae éste. R1 y R2 también.
test('la IA nunca decide el objeto: un id que mande se ignora, y una referencia inventada no entra', () => {
  const raw = JSON.stringify({ pedidos: [{ texto: E1, verbo: 'borrar', area: 'chatbot', referencia: 'la de Pedro', objeto: 'C', objetoId: 'C', id: 'C' }] });
  const crudos = leerRespuestaIA(raw, E1, 'chatbot');
  assert.ok(crudos);
  assert.equal(crudos![0].referencia, 'la otra automatización', 'la referencia que no está en el pedido cae a la de las reglas');
  assert.deepEqual(Object.keys(crudos![0]).sort(), ['area', 'etiqueta', 'referencia', 'texto', 'verbo']);
  // Con dos candidatos sigue preguntando, aunque la IA haya «elegido» C.
  const r = resolverPedidos(crudos!, ctxChatbot([A, B, C]), { origen: 'ia', texto: E1 });
  const p = r.pedidos[0];
  assert.ok(p.sobre === 'otro' && p.objeto === null);
  assert.deepEqual(p.sobre === 'otro' ? p.candidatos.map((o) => o.id) : [], ['C', 'B']);
  // Con uno solo, el código elige el único, no lo que dijo la IA.
  const r2 = resolverPedidos(crudos!, ctxChatbot([A, B]), { origen: 'ia', texto: E1 });
  assert.ok(r2.pedidos[0].sobre === 'otro' && r2.pedidos[0].objeto?.id === 'B');
});

// Rotura R15 (sin las tabs de leads: `TABS_DE_LEADS` → `[]`): 11 de 12. Rotura R18 (la red propia sin el corte
// `if (pii) return null;`): 11 de 12. Cae éste.
test('con datos de clientes (un email, un teléfono, una tab de leads), la IA nunca va a un gratis que entrena', () => {
  assert.equal(llevaDatosPersonales('Agéndame una reunión con juan@correo.com', 'landing'), true);
  assert.equal(llevaDatosPersonales('Llama al +52 55 1234 5678 mañana', 'landing'), true);
  assert.equal(llevaDatosPersonales('Mueve a Juan a la etapa de cierre', 'crm'), true);
  assert.equal(llevaDatosPersonales(E2, 'landing'), false);
  // La IA real lo pasa a la cascada y lo aplica en su red propia (AGENTS.md: «un camino con su PROPIA red aplica la
  // misma regla él mismo»), sin nada que la corte antes.
  const ia = leer('lib/mako-pedidos-ia.ts').replace(/^\s*\/\/.*$/gm, '');
  assert.match(ia, /const pii = llevaDatosPersonales\(texto, ctx\.tab\)/);
  assert.match(ia, /hastaMs: [^\n]*, pii,/);
  assert.match(ia, /if \(pii\) return null;\s*\n\s*const \[wsSA, wsActual\]/);
  assert.doesNotMatch(ia, /docsIADisponible|cheapDisponible|hayIAPara/);
});

// Rotura R16 (el default de la feature a Sonnet): 11 de 12, cae éste; y tests/model-registry.test.ts, 5 de 9.
test('la feature de la IA está en el catálogo, con default GRATIS', () => {
  const f = CATALOGO_MODELOS.find((x) => x.feature === FEATURE_PEDIDOS);
  assert.ok(f, `falta «${FEATURE_PEDIDOS}» en lib/model-catalogo.ts`);
  assert.ok(!PROVEEDORES_PAGOS.includes(f!.def.provider), `el default cobra: ${f!.def.provider}`);
  assert.equal(f!.pagoPorque, undefined);
});

// Rotura R17 (pedirle `redDePlataforma: true` a la cascada, que prueba primero el crédito de Claude): 11 de 12.
// Y el guard del voseo SÍ barre estos archivos nuevos (están con `git add -N`): con «Decime su nombre» en
// lib/mako-pedidos.ts, tests/puente-panel-copy.test.ts da 8 de 9 (R19).
test('NUNCA Claude: ni la red de la cascada (que arranca por el crédito de Claude) ni chatClaude; el núcleo es puro', () => {
  const ia = leer('lib/mako-pedidos-ia.ts').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(ia, /redDePlataforma/);
  assert.doesNotMatch(ia, /conCreditoDeLaPlataforma|chatClaude|from '\.\/anthropic'/);
  assert.match(ia, /provsGratisDePlataforma\(\)/);
  assert.match(ia, /PROVS_PEDIDOS: readonly ProvName\[\] = \['gemini', 'groq', 'openrouter', 'mistral'\]/);
  assert.match(ia, /^import 'server-only';/m);
  const nucleo = leer('lib/mako-pedidos.ts');
  assert.doesNotMatch(nucleo, /^import 'server-only'/m);
  assert.doesNotMatch(nucleo, /from '\.\/api-mako\/registro'|from '@\/lib\/api-mako\/registro'/);
  // No es pública.
  assert.doesNotMatch(leer('lib/rutas-publicas.ts'), /mako\/pedidos/);
});
