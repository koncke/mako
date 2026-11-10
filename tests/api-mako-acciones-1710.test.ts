// =============================================================================
// Cinco cosas que la API de MaKo no podía y ahora puede (17/10/2026)
// =============================================================================
// «Implemente todos los pendientes al 100%» (Martín, 17/10/2026). Cada una con el hueco que cerraba:
//   1. SACAR a un lead de una secuencia (`sacar_lead_de_secuencia`): lo que se inscribía por la API no se podía deshacer.
//   2. Los PRODUCTOS de una landing (`guardar_landing` con `productos`): la pantalla los asigna (paso 2 del Pixel) y MaKo no.
//   3. DUPLICAR una automatización (`duplicar_automatizacion`) y COPIAR / PEGAR un dashboard con su código
//      (`copiar_dashboard`, `pegar_dashboard`): estaban sólo en la pantalla. «Crear desde una plantilla» y «el botón que
//      cobra un producto» YA estaban (`crear_automatizacion_desde_plantilla`, `cobrar_producto_landing`): se midió contra el
//      registro, no contra los docs, y se fija acá para que nadie los vuelva a dar por faltantes.
//   4. `ficha_lead` con una ficha larga NO corta los formularios (`compactarFicha`), y el ingreso estimado de un ganado
//      sigue oculto con LA regla de la ficha (`ingresoNoAplica`), no con una copia.
//
// Las dos primeras se prueban EJECUTANDO los runners de verdad contra una base de mentira con dos negocios
// (tests/_api-acciones-hijo.ts): lo que se mira es lo que QUEDA ESCRITO y que lo de otro negocio no existe.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez con un arnés que restaura byte a byte. Con el código como está: 16 / 0.
// Rota (pases / fallos):
//   · sacarDeSecuencia deja `proximo_envio_at` en la fila cancelada                           → 15 / 1
//   · la inscripción se lee sin filtrar por secuencia                                          → 0 / 1  (el hijo se cae: el lead tiene dos)
//   · un handoff deja de salir                                                                 → 14 / 2
//   · lo terminado deja de ser «ya terminó»                                                    → 13 / 3
//   · un producto de otro negocio pasa en guardar_landing                                      → 0 / 1  (el hijo se cae al nombrarlo)
//   · guardar sin `productos` los saca (`{ funnelIds: productos ?? [] }`)                     → 15 / 1
//   · `productos` sin vaciaEsValor                                                             → 15 / 1
//   · un flujo puede duplicar una automatización                                               → 15 / 1
//   · el código del dashboard pasa por el resumen (el modelo)                                  → 15 / 1
//   · compactarFicha no hace nada                                                              → 14 / 2
//   · compactarFicha sin la marca `ficha_acortada`                                             → 15 / 1
//   · el contexto de MaKo Analyst no acorta la ficha antes de recortarla                       → 15 / 1
//   · el estimado de un ganado se muestra                                                      → 15 / 1
//   · el estimado oculto sin decir por qué                                                     → 15 / 1
// Correr: MAKO_TESTS_SIN_ESPERA=1 node --test --import tsx tests/api-mako-acciones-1710.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decidirSalidaDeSecuencia, ESTADOS_QUE_SALEN, motivoNoSale } from '../lib/nutricion-inscripcion-manual';
import { compactarFicha, contextoDelLead, LECTURAS_DEL_LEAD } from '../lib/mako-analyst-lead-reglas';
import { datosDeLaFicha } from '../lib/mako-ficha-lead';
import { porId, visible, type Vista } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import { RUTAS_REST } from '../lib/api-mako/rest';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de UN runner: desde su clave hasta la clave del siguiente. */
function runner(src: string, id: string): string {
  const ini = src.indexOf(`\n  ${id}: {`);
  assert.ok(ini > 0, `no encontré el runner ${id}`);
  const sig = src.slice(ini + 4).search(/\n {2}[a-z][a-z0-9_]*: \{/);
  return sig < 0 ? src.slice(ini) : src.slice(ini, ini + 4 + sig);
}

// ── 1 · Sacar a un lead de una secuencia ───────────────────────────────────────────────────────

test('la decisión de salir: sólo se corta lo que está vivo, y lo terminado o cancelado no se toca', () => {
  const v = (estado: string, desenlace: string | null = null) => decidirSalidaDeSecuencia({ estado, desenlace });
  for (const e of ['activa', 'pendiente', 'pausada', 'respondio', 'handoff']) assert.equal(v(e).sale, true, e);
  assert.deepEqual(v('completada'), { sale: false, porque: 'ya_termino' });
  assert.deepEqual(v('no_responde'), { sale: false, porque: 'ya_termino' });
  assert.deepEqual(v('cancelada'), { sale: false, porque: 'ya_cancelada' });
  assert.deepEqual(v('activa', 'cancelado'), { sale: false, porque: 'ya_cancelada' }, 'un desenlace cancelado gana al estado');
  assert.deepEqual(v('cuarentena'), { sale: false, porque: 'estado_desconocido' }, 'en POSITIVO: un estado nuevo no se corta');
  assert.deepEqual(decidirSalidaDeSecuencia(null), { sale: false, porque: 'no_estaba' });
  assert.deepEqual([...ESTADOS_QUE_SALEN].sort(), ['activa', 'handoff', 'pausada', 'pendiente', 'respondio']);
  assert.match(motivoNoSale('ya_termino', { secuenciaId: 4, secuencia: 'Bienvenida', leadId: 7, lead: 'Ana' }), /Ana ya terminó «Bienvenida»/);
});

test('la operación existe, es del área chatbot, por chat, sólo para el admin y SIN http (como inscribir)', () => {
  const d = porId('sacar_lead_de_secuencia');
  assert.ok(d && esAccion(d));
  assert.equal(d.area, 'chatbot');
  assert.equal(d.confirmacion, 'chat');
  assert.equal(d.reversible, false, 'queda cancelada: no se vuelve a abrir');
  assert.deepEqual([...d.canales].sort(), ['app', 'whatsapp']);
  assert.deepEqual(d.gating, { tab: 'setting', rolMinimo: 'admin' });
  const miembro: Vista = { canal: 'app', alcance: 'ejecutar', ws: 9, rol: 'miembro', tabs: null };
  assert.equal(visible(d, miembro), false);
  assert.ok(!RUTAS_REST.some(([, , id]) => id === 'sacar_lead_de_secuencia'), 'sin http no hay ruta REST');
  assert.match(d.descripcion, /NO se vuelve a abrir/);
});

// ── 2 · Los runners de verdad ──────────────────────────────────────────────────────────────────

type Fila = Record<string, unknown> | null;
type Hijo = {
  sacarActiva: { prep: { resumen: string }; ejec: { ok: boolean; datos: Record<string, unknown> }; suya: Fila; otroLead: Fila; otraSecuencia: Fila; historial: string[] };
  sacarRespondioYHandoff: { a: { ok: boolean }; b: { ok: boolean }; filaA: Fila; filaB: Fila };
  sacarYaEstaba: { completada: { error: string; yaEstaba?: boolean }; cancelada: { error: string; yaEstaba?: boolean }; noEstaba: { error: string; yaEstaba?: boolean }; desconocido: { error: string; yaEstaba?: boolean }; filas: Fila[] };
  sacarAjeno: { leadAjeno: { error: string }; secuenciaAjena: { error: string }; ambosAjenos: { error: string }; deB: Fila };
  sacarCambioEnElMedio: { ejec: { ok: boolean; resumen: string }; fila: Fila; historial: string[] };
  listarSinNada: { landings: unknown[]; productosDisponibles: Array<{ embudoId: number; nombre: string }> };
  landingConProductos: { prep: { payload: Record<string, unknown>; resumen: string }; ejec: { ok: boolean }; config: Array<{ url: string; funnelIds?: number[] }> };
  landingSinProductos: { config: Array<{ url: string; funnelIds?: number[] }>; resumen: string };
  listarDespues: { landings: Array<{ url: string; productos: number[] }> };
  landingVaciaProductos: { prep: { payload: Record<string, unknown>; resumen: string }; config: Array<{ url: string; funnelIds?: number[] }> };
  landingProductosMalos: { ajeno: { error: string }; archivado: { error: string }; basura: { error: string }; config: unknown };
  landingGracias: {
    resumen: string; conGracias: unknown; otraCosa: boolean; sigue: unknown; desmarcadoResumen: string; final: unknown;
    sinProductos: string; basura: { error?: string };
  };
  ia: string[];
};
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_api-acciones-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 280_000,
});
const H = JSON.parse(salida.slice(salida.indexOf('@@JSON@@') + 8, salida.indexOf('@@FIN@@'))) as Hijo;

test('⚠️ sacar a un lead cancela SU inscripción en ESA secuencia, sin tocar a otro lead ni a otra secuencia, y deja historial', () => {
  const r = H.sacarActiva;
  assert.equal(r.ejec.ok, true);
  assert.equal(r.suya?.estado, 'cancelada');
  assert.equal(r.suya?.proximo_envio_at, null, 'una fila cancelada con fecha de envío miente');
  assert.equal(r.otroLead?.estado, 'activa', 'se llevó a otro lead de la misma secuencia');
  assert.equal(r.otraSecuencia?.estado, 'activa', 'se llevó al mismo lead de otra secuencia');
  assert.equal(r.otroLead?.proximo_envio_at, '2026-10-18T10:00:00Z');
  assert.match(r.prep.resumen, /no se vuelve a abrir/, 'la persona tiene que saber que no se deshace antes del «sí»');
  assert.deepEqual(r.historial, ['Sale de «Bienvenida»']);
  // Con el lead hablando o con una persona atendiéndolo también se corta.
  assert.equal(H.sacarRespondioYHandoff.a.ok && H.sacarRespondioYHandoff.b.ok, true);
  assert.equal(H.sacarRespondioYHandoff.filaA?.estado, 'cancelada');
  assert.equal(H.sacarRespondioYHandoff.filaB?.estado, 'cancelada');
});

test('lo terminado, lo ya cancelado o lo que no existe: «ya está así» (para un flujo no es una alarma) y no se escribe nada', () => {
  const y = H.sacarYaEstaba;
  for (const k of ['completada', 'cancelada', 'noEstaba'] as const) assert.equal(y[k].yaEstaba, true, k);
  assert.equal(y.desconocido.yaEstaba, undefined, 'un estado desconocido NO es «ya está así»: se dice y se deja');
  assert.equal(y.filas[0]?.estado, 'completada');
  assert.equal(y.filas[0]?.desenlace, 'logrado', 'la historia de lo terminado se conserva');
  assert.equal(y.filas[2]?.estado, 'cuarentena');
});

test('⚠️ un lead o una secuencia de OTRO negocio no existen, y su inscripción queda como estaba', () => {
  const a = H.sacarAjeno;
  assert.match(a.leadAjeno.error, /No existe el lead #202/);
  assert.match(a.secuenciaAjena.error, /No existe la secuencia #21/);
  assert.match(a.ambosAjenos.error, /No existe/);
  assert.equal(a.deB?.estado, 'activa');
  assert.equal(a.deB?.proximo_envio_at, '2026-10-18T10:00:00Z');
});

test('si entre el «proponer» y el «sí» la inscripción terminó sola, no se toca ni se deja historial', () => {
  const r = H.sacarCambioEnElMedio;
  assert.equal(r.ejec.ok, false);
  assert.match(r.ejec.resumen, /ya terminó/);
  assert.equal(r.fila?.estado, 'completada');
  assert.deepEqual(r.historial, []);
});

// ── 3 · Los productos de una landing ───────────────────────────────────────────────────────────

test('⚠️ guardar_landing asigna productos, listar_landings dice cuáles se pueden, y guardar sin `productos` NO los saca', () => {
  assert.deepEqual(H.listarSinNada.productosDisponibles.map((p) => p.embudoId), [1, 2], 'sólo los ACTIVOS de este negocio');
  const c = H.landingConProductos;
  assert.equal(c.ejec.ok, true);
  assert.deepEqual(c.config, [{ url: 'https://mi-sitio.com/oferta', funnelIds: [2] }]);
  assert.match(c.prep.resumen, /«Mentoría»/, 'el resumen nombra el producto');
  // La trampa del mapper campo por campo: corregir/actualizar la página sin decir productos no los borra.
  assert.deepEqual(H.landingSinProductos.config, [{ url: 'https://mi-sitio.com/oferta', funnelIds: [2] }]);
  // (Desde el 24/10/2026 cada una dice también si es la de gracias y qué hace la gente ahí: null = lo decide MaKo.)
  assert.deepEqual(H.listarDespues.landings, [{ url: 'https://mi-sitio.com/oferta', productos: [2], gracias: false, conversion: null }]);
  // Lo que los SACA es la lista vacía.
  assert.deepEqual(H.landingVaciaProductos.prep.payload.productos, []);
  assert.deepEqual(H.landingVaciaProductos.config, [{ url: 'https://mi-sitio.com/oferta' }]);
  assert.match(H.landingVaciaProductos.prep.resumen, /sin productos asignados/);
});

test('⚠️ un producto de otro negocio, archivado o que no es un número se rechaza ANTES de escribir', () => {
  const m = H.landingProductosMalos;
  assert.match(m.ajeno.error, /No hay un producto con embudoId 77/);
  assert.match(m.archivado.error, /No hay un producto con embudoId 3/);
  assert.match(m.basura.error, /embudoId \(un número\)/);
  assert.equal(m.config, null, 'se escribió la lista de landings a pesar del rechazo');
  assert.deepEqual(H.ia, [], 'salió algo a la red');
});

test('guardar_landing declara `productos` como lista que puede ir vacía, y listar_landings lo dice', () => {
  const d = porId('guardar_landing');
  assert.ok(d && esAccion(d));
  const p = d.parametros.find((x) => x.nombre === 'productos');
  assert.ok(p, 'falta el parámetro');
  assert.equal(p.tipo, 'string[]');
  assert.equal(p.vaciaEsValor, true, 'sin esto `[]` se descarta y no hay forma de sacar los productos');
  assert.ok(!p.obligatorio);
  assert.match(porId('listar_landings')!.descripcion, /productosDisponibles/);
});

// ── 4 · Duplicar una automatización, copiar y pegar un dashboard ───────────────────────────────

test('duplicar_automatizacion: la MISMA función que «Duplicar», con la base del negocio, pausada, y un flujo no la corre', () => {
  const d = porId('duplicar_automatizacion');
  assert.ok(d && esAccion(d));
  assert.equal(d.area, 'chatbot');
  assert.equal(d.confirmacion, 'chat');
  assert.equal(d.reversible, true);
  // Sale por HTTP desde el 10/11/2026 (Martín, 9/11: «todo tiene que estar documentado en la API»): crea una copia PAUSADA y no
  // le escribe a nadie. El 17/10 se había dejado sin HTTP sin una decisión de por medio.
  assert.deepEqual([...d.canales].sort(), ['app', 'http', 'whatsapp'], 'duplicar sale por la app, WhatsApp y la API');
  assert.deepEqual(d.gating, { tab: 'setting', rolMinimo: 'admin' });
  assert.match(d.descripcion, /PAUSADA/);
  const r = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  const cuerpo = runner(r, 'duplicar_automatizacion');
  assert.match(cuerpo, /desdeUnFlujo\(ctx\)/, 'un flujo correría una copia por cada lead');
  assert.match(cuerpo, /duplicarSecuencia\(Number\(payload\.secuenciaId\), \{ db: \(await getTenantDb\(\)\)/, 'la base del negocio, no una global');
  assert.match(cuerpo, /setPasos: setSecuenciaPasos, setCron: setCronSecuencia/, 'los pasos y el horario entran por SUS puertas');
  assert.doesNotMatch(cuerpo, /\.insert\(|\.update\(|\.delete\(/, 'el runner no escribe por su cuenta: la escritura es la de la ficha');
  assert.match(cuerpo, /secuenciaVigente\(id\)/, 'una archivada o de otro negocio no se duplica');
  assert.match(cuerpo, /paraLaPersona/, 'el link lo escribe el código');
});

test('copiar_dashboard y pegar_dashboard: SIN http, sólo admin, no corren en un flujo, y el código no pasa por el modelo', () => {
  for (const id of ['copiar_dashboard', 'pegar_dashboard']) {
    const d = porId(id);
    assert.ok(d && esAccion(d), id);
    assert.equal(d.area, 'metricas');
    assert.equal(d.confirmacion, 'chat');
    assert.deepEqual([...d.canales].sort(), ['app', 'whatsapp'], `${id}: el código se lee desde cualquier negocio; un token de afuera no lo publica`);
    assert.deepEqual(d.gating, { tab: 'graphics', rolMinimo: 'admin' }, id);
    assert.ok(!RUTAS_REST.some(([, , rid]) => rid === id), `${id}: sin http no hay ruta REST`);
  }
  const copiarDef = porId('copiar_dashboard');
  assert.ok(copiarDef && esAccion(copiarDef) && copiarDef.reversible === false, 'copiar guarda un código que ya no se retira');
  const r = sinComentarios(leer('lib/api-mako/areas/dashboard.run.ts'));
  const copiar = runner(r, 'copiar_dashboard');
  assert.match(copiar, /noEnFlujo\('Copiar un dashboard'\)/);
  assert.match(copiar, /hojaParaCopiar\(h\)/, 'sin los filtros sobre personas, como la pantalla');
  assert.match(copiar, /guardarCopiaDash\(hoja, \{ ws: ctx\.ws, vaciados \}\)/, 'el negocio de origen sale del contexto, nunca del input');
  const dentroDelResumen = copiar.slice(copiar.indexOf('resumen: `Listo'), copiar.indexOf('datos: { token'));
  assert.doesNotMatch(dentroDelResumen, /\$\{token\}/, 'el código en el resumen pasaría por el modelo (que lo transcribe mal)');
  assert.match(copiar.slice(copiar.indexOf('paraLaPersona')), /\$\{token\}/);
  const pegar = runner(r, 'pegar_dashboard');
  assert.match(pegar, /noEnFlujo: 'Pegar un dashboard'/);
  assert.match(pegar, /hojaParaOtroNegocio\(copia\.hoja\)/, 'de otro negocio, los filtros ajenos llegan vacíos');
  assert.match(pegar, /hojaConIdsNuevos\(llega\.hoja\)/, 'ids nuevos: pegarla dos veces no puede chocar');
  assert.match(pegar, /op: 'crear_hoja'/, 'es una hoja nueva por la vara de siempre (tope, saneo, compare-and-set)');
  assert.match(pegar, /ejecutar: aplicar/);
});

test('lo que se dio por faltante YA estaba: crear desde plantilla y el botón que cobra un producto', () => {
  for (const id of ['crear_automatizacion_desde_plantilla', 'cobrar_producto_landing', 'quitar_cobro_landing', 'duplicar_hoja_dashboard', 'duplicar_landing']) {
    assert.ok(porId(id), `«${id}» salió del registro`);
  }
});

// ── 5 · MaKo Analyst: la ficha larga no corta los formularios ──────────────────────────────────

test('⚠️ una ficha larga se ACORTA y sigue siendo un JSON con los dos formularios; una corta no se toca', () => {
  const largo = (n: number) => 'x'.repeat(n);
  const fila = (i: number, ancho: number) => ({ pregunta: `Pregunta ${i} ${largo(ancho)}`, respuesta: `Respuesta ${i} ${largo(ancho)}` });
  const ficha = {
    lead: { id: 7, nombre: 'Ana', etapa: 'agendado', etapa_nombre: 'Agendado', monto_cierre_usd: null },
    respuestas: { R1: [{ q: '¿Cuánto factura?', a: largo(300) }], R2: [] },
    formulario_meta: Array.from({ length: 12 }, (_, i) => fila(i, 150)),
    formulario_landing: Array.from({ length: 12 }, (_, i) => fila(i, 150)),
  };
  const crudo = JSON.stringify(ficha);
  assert.ok(crudo.length > 5000, 'la ficha de la prueba tiene que ser más larga que el tope');
  const corta = compactarFicha(crudo, 5000);
  assert.ok(corta.length <= 5000, `no entró: ${corta.length}`);
  const j = JSON.parse(corta) as typeof ficha & { ficha_acortada?: string };
  assert.deepEqual(j.lead, ficha.lead, 'lo de arriba (el lead, su etapa) queda intacto');
  assert.ok(j.formulario_meta.length > 0 && j.formulario_landing.length > 0, 'los dos formularios sobreviven (antes se cortaba el último)');
  assert.ok(j.formulario_meta[0].pregunta.startsWith('Pregunta 0'), 'se acorta el final de la respuesta, no se pierde la pregunta');
  assert.match(String(j.ficha_acortada), /acortaron/, 'el modelo tiene que saber que hay respuestas más cortas que las reales');
  // Una ficha que ya entra, o algo que no es una ficha, vuelve tal cual.
  const chica = JSON.stringify({ lead: { id: 1 }, formulario_meta: [{ pregunta: 'a', respuesta: 'b' }] });
  assert.equal(compactarFicha(chica, 5000), chica);
  assert.equal(compactarFicha('no es json', 5), 'no es json');
  // Si hay que dejar menos filas, se dice cuántas se omitieron (se suma a lo que la lectura ya omitía).
  const monstruosa = { lead: ficha.lead, formulario_meta: Array.from({ length: 12 }, (_, i) => fila(i, 400)), formulario_meta_omitidas: 3 };
  const m = JSON.parse(compactarFicha(JSON.stringify(monstruosa), 1500)) as { formulario_meta: unknown[]; formulario_meta_omitidas?: number };
  assert.equal(m.formulario_meta.length + (m.formulario_meta_omitidas ?? 0), 15, 'las filas dejadas más las omitidas tienen que dar las 15 originales');
});

test('⚠️ el contexto de MaKo Analyst acorta la ficha ANTES de recortarla: el bloque trae los formularios y un JSON entero', () => {
  const fila = (i: number) => ({ pregunta: `Pregunta ${i}`, respuesta: 'r'.repeat(280) });
  const salida = JSON.stringify({
    lead: { id: 7, nombre: 'Ana', etapa: 'agendado' }, respuestas: { R1: [], R2: [] },
    formulario_meta: Array.from({ length: 12 }, (_, i) => fila(i)), formulario_landing: Array.from({ length: 12 }, (_, i) => fila(i)),
  });
  assert.ok(salida.length > 5000);
  const texto = contextoDelLead({ leadId: 7, nombre: 'Ana', lecturas: [{ id: 'ficha_lead', ok: true, salida }] });
  const ini = texto.indexOf('{"lead"');
  const fin = texto.indexOf('\n\n', ini);
  const bloque = texto.slice(ini, fin > 0 ? fin : undefined);
  const j = JSON.parse(bloque) as { formulario_meta: unknown[]; formulario_landing: unknown[] };
  assert.ok(j.formulario_meta.length > 0 && j.formulario_landing.length > 0, 'los formularios se cortaron del contexto');
  assert.doesNotMatch(texto, /se cortó aquí por largo/, 'se recortó el texto en vez de acortar la ficha');
  // …y la ficha_lead de arriba sigue siendo la primera lectura, con su tope.
  assert.equal(LECTURAS_DEL_LEAD[0].id, 'ficha_lead');
});

test('el ingreso estimado de un ganado sigue oculto con LA regla de la ficha, y en un lead abierto se ve', () => {
  const ganado = datosDeLaFicha({ estado_lead: 'ganado', ingreso_estimado: 5000 });
  assert.equal(ganado.ingreso_estimado_usd, undefined);
  assert.match(String(ganado.ingreso_estimado_oculto), /ganado/, 'oculto NO es «no tiene»: tiene que decir por qué falta');
  assert.equal(datosDeLaFicha({ estado_lead: 'ganado' }).ingreso_estimado_oculto, undefined, 'sin estimado no hay nada que explicar');
  assert.equal(datosDeLaFicha({ estado_lead: 'activo', ingreso_estimado: 5000 }).ingreso_estimado_usd, 5000);
  assert.equal(datosDeLaFicha({ estado_lead: 'perdido', ingreso_estimado: '1200' }).ingreso_estimado_usd, 1200);
  const fuente = sinComentarios(leer('lib/mako-ficha-lead.ts'));
  assert.match(fuente, /ingresoNoAplica\(l\.estado_lead\)/, 'una sola regla: la de la ficha');
  assert.doesNotMatch(fuente, /!== 'ganado'/, 'la copia de la regla volvió');
});

test('MaKo sabe lo que ahora traen la ficha y la cobranza', () => {
  const ficha = porId('ficha_lead')!.descripcion;
  for (const k of ['etapa_nombre', 'formulario_landing', 'ingreso_estimado_usd', 'pagina_registro', 'entrada_social', 'email_dado_de_baja', 'ficha_acortada']) assert.match(ficha, new RegExp(k), `ficha_lead no dice «${k}»`);
  assert.match(porId('buscar_leads')!.descripcion, /etapa_nombre/);
  const cobranza = porId('cobranza_lead')!.descripcion;
  for (const k of ['cobrado', 'semáforo', 'renovación rechazada', 'editar_cuota', 'crear_link_cuota', 'cortar_recordatorio_cuota']) assert.match(cobranza, new RegExp(k), `cobranza_lead no dice «${k}»`);
});

// ── 4 · La página de gracias por la API (6/11/2026, docs/relevo/api-mako.md «Sin hacer») ──────────────────────────────────
// La pantalla la marca en el paso 2 del Pixel y la API no podía. Probado rompiéndolo: el runner sin pasar `gracias` a
// `conLanding` → 1 fallo; el resumen sin la advertencia de lo que hace → 1 fallo.
test('guardar_landing marca y desmarca la página de gracias, y guardar otra cosa no la desmarca', () => {
  const g = H.landingGracias;
  assert.deepEqual(g.conGracias, [{ url: 'https://mi-sitio.com/oferta', funnelIds: [2], gracias: true }]);
  assert.match(g.resumen, /página de GRACIAS: quien llegue ahí pasa a Ganado/, 'el «sí» se da leyendo lo que hace');
  assert.ok(g.otraCosa);
  assert.deepEqual(g.sigue, [{ url: 'https://mi-sitio.com/oferta', funnelIds: [2], gracias: true, conversion: 'agenda' }], 'sin `gracias`, queda como está');
  assert.match(g.desmarcadoResumen, /deja de ser la página de gracias/);
  assert.deepEqual(g.final, [{ url: 'https://mi-sitio.com/oferta', funnelIds: [2], conversion: 'agenda' }]);
  assert.match(g.sinProductos, /Todavía no tiene productos: no gana a nadie/);
  assert.match(g.basura.error ?? '', /gracias va como true o false/);
});
