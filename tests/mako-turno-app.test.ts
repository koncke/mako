// =============================================================================
// El chat de MaKo en el teléfono (lib/mako-turno-app.ts): lo que tiene que ser cierto
// =============================================================================
// 1. Qué herramientas viajan: el MISMO camino que el doer de WhatsApp (clasificarIntencion
//    → herramientasDelTurno) con dos cortes — confirmar_accion NUNCA (confirma una persona
//    tocando la tarjeta) y nunca una LECTURA de la agenda de Google; y lo que la persona no
//    puede usar (un closer) tampoco.
// 2. La clave de scope es `app:<sesión>` y las sesiones son por PERSONA.
// 3. La tarjeta y los links los arma el CÓDIGO.
// 4. Los adjuntos se validan por sus bytes, y el doer de WhatsApp usa las mismas piezas.
// 5. El cableado del turno: cada corrida con nuevoIntento(), el contrato al ejecutar, el
//    Ctx con `proponer`, la ruta con maxDuration 300 y el 'use server' sólo con async.
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez, con la base en 0 fallos — el
// resultado de cada una está al lado del test que la caza.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { REGISTRO, type Vista } from '../lib/api-mako/registro';
import { canalDeClave } from '../lib/api-mako/canal';
import { esAccion } from '../lib/api-mako/tipos';
import {
  chartKeyDePersona, canalKeyDeSesion, herramientasDelChat, fueraDelChat, tarjetaDePendiente, linksDeUnaAccion,
  propuestaDePantalla, sinLinksDeRevision, historialParaModelo, rutaDeEscritorio, PREFIJO_CHART_MOVIL,
  errorCortoDeTarjeta, ERRORES_DE_TARJETA, conInstruccionDeTarjeta, INSTRUCCION_TARJETA,
} from '../lib/mako-turno-app-reglas';
import { consecuenciaDeshacer } from '../lib/inbox-movil-reglas';
import {
  tipoPorFirma, validarAdjuntos, mimeImagenWhatsApp, bloquesDeAdjuntos, placeholderDeAdjunto, ERROR_ADJUNTO, TOPE_TOTAL_BYTES,
} from '../lib/mako-adjuntos';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Los NOMBRES de las de siempre: viven en módulos con `server-only`, así que se los pide a
 *  un node aparte con la condición del server (el molde de tests/agenda-whatsapp.test.ts). */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));

const vistaApp = (rol: 'admin' | 'miembro'): Vista => ({ canal: 'app', alcance: 'proponer', ws: 9, rol, tabs: null });
const vistaWa: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 9, rol: 'admin', tabs: null };

type CtxIntencion = { hayPendientes?: boolean; makoPregunto?: boolean };
function turnoApp(mensaje: string, rol: 'admin' | 'miembro' = 'admin', ctx: CtxIntencion = {}) {
  const veredicto = clasificarIntencion(mensaje, ctx);
  const t = herramientasDelChat({ veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaApp(rol), hayPendientes: !!ctx.hayPendientes });
  return { veredicto, nombres: t.tools.map((x) => x.name) };
}
function turnoWa(mensaje: string, ctx: CtxIntencion = {}) {
  const veredicto = clasificarIntencion(mensaje, ctx);
  return herramientasDelTurno({ veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaWa, hayPendientes: !!ctx.hayPendientes }).tools.map((x) => x.name);
}

const TURNO = sinComentarios(leer('lib/mako-turno-app.ts'));

const LECTURAS_AGENDA = REGISTRO.filter((d) => d.tipo === 'lectura' && d.datosDeGoogle).map((d) => d.id);

// --- 1. Qué herramientas viajan ------------------------------------------------------

// Rotura: sacar `CONFIRMAR.has(nombre)` de fueraDelChat → 1 fallo (este). Con la vara de
// alcance `proponer` sola NO alcanza: confirmar_accion entra por MAKO_ACCION_TOOLS, que no
// pasa por `visible()` del registro sin el filtro de `entraAlChat`.
test('el «sí» con una acción esperando: WhatsApp trae confirmar_accion, el teléfono NUNCA', () => {
  const wa = turnoWa('sí, dale', { hayPendientes: true });
  assert.ok(wa.includes('confirmar_accion'), `en WhatsApp el «sí» confirma (llegaron: ${wa.join(', ')}): si esto cambia, el test de abajo ya no prueba nada`);
  const app = turnoApp('sí, dale', 'admin', { hayPendientes: true });
  assert.ok(!app.nombres.includes('confirmar_accion'), 'confirmar_accion viajó en el chat del teléfono');
  assert.ok(app.nombres.includes('cancelar_accion'), `cancelar lo propio sí viaja («no, mejor no»): llegaron ${app.nombres.join(', ')}`);
});

// Rotura: sacar el filtro de la SALIDA de herramientasDelChat (dejar `tools: turno.tools`)
// → 1 fallo (este): las lecturas de agenda vuelven por el registro.
test('en ninguna frase viaja confirmar_accion ni una LECTURA de la agenda de Google', () => {
  assert.ok(LECTURAS_AGENDA.length >= 3, `leí ${LECTURAS_AGENDA.length} lecturas de agenda: cambió el registro y este test ya no mira nada`);
  const frases = [
    '¿qué tengo hoy en la agenda?', '¿qué horarios libres tengo mañana?', '¿qué reuniones tiene Juan?',
    'agéndame una reunión con Juan mañana a las 10', 'mueve la reunión de Ana al viernes a las 11',
    'sí, confírmalo', 'dale, hazlo', 'pasa a Rosana a Agendado', '¿cuántos leads tengo?',
    'anota esto: llamar al contador, revisar la landing', 'hola mako',
  ];
  for (const f of frases) for (const ctx of [{}, { hayPendientes: true }, { hayPendientes: true, makoPregunto: true }]) {
    for (const rol of ['admin', 'miembro'] as const) {
      const { nombres, veredicto } = turnoApp(f, rol, ctx);
      assert.ok(!nombres.includes('confirmar_accion'), `«${f}» (${veredicto.intencion}, ${rol}) trajo confirmar_accion`);
      for (const l of LECTURAS_AGENDA) assert.ok(!nombres.includes(l), `«${f}» (${veredicto.intencion}, ${rol}) trajo ${l}, que lee la agenda de Google`);
    }
  }
});

// Rotura: agregar `|| !!d.datosDeGoogle` a fueraDelChat (sacar TODO lo de Google) → 1 fallo.
test('las ACCIONES de agenda sí viajan: proponen y la persona confirma en la tarjeta', () => {
  const { nombres, veredicto } = turnoApp('agéndame una reunión con Juan mañana a las 10');
  assert.equal(veredicto.intencion, 'actuar');
  assert.ok(nombres.includes('proponer_agendar_agenda'), `no viajó proponer_agendar_agenda: ${nombres.join(', ')}`);
  assert.ok(fueraDelChat('agenda_del_dia') && fueraDelChat('horarios_libres_dia') && !fueraDelChat('proponer_mover_reunion'));
});

// Rotura: cambiar entraAlChat a `return !!d` (sin `visible`) → 1 fallo (este).
test('un closer no recibe lo que es de admin; el admin sí', () => {
  const soloAdmin = REGISTRO.filter((d) => d.gating?.rolMinimo === 'admin').map((d) => d.id);
  // ⚠️ En voseo a propósito: medido el 11/10/2026, «pausa la campaña» (tú) clasifica como
  // `capturar` dudosa y no trae ninguna acción — ACCION_CUENTA_RE (lib/mako-intencion.ts)
  // sólo conoce los imperativos voseantes. Es un agujero del clasificador, no de este turno.
  const admin = turnoApp('pausá la campaña de verano', 'admin');
  const closer = turnoApp('pausá la campaña de verano', 'miembro');
  const deAdmin = admin.nombres.filter((n) => soloAdmin.includes(n));
  assert.ok(deAdmin.length > 0, `al admin no le llegó ninguna de admin (${admin.nombres.join(', ')}): la frase ya no prueba nada`);
  assert.deepEqual(closer.nombres.filter((n) => soloAdmin.includes(n)), [], 'al closer le llegó una operación con rolMinimo admin');
  const metricasAdmin = turnoApp('¿cuánto invertimos y vendimos este mes?', 'admin').nombres;
  const metricasCloser = turnoApp('¿cuánto invertimos y vendimos este mes?', 'miembro').nombres;
  assert.ok(metricasAdmin.includes('metricas_negocio'), `al admin no le llegó metricas_negocio: ${metricasAdmin.join(', ')}`);
  assert.ok(!metricasCloser.includes('metricas_negocio'), 'al closer le llegó metricas_negocio (admin), que el chat de escritorio sí le pasa');
});

// --- 2. La clave y las sesiones ------------------------------------------------------

// Rotura: canalKeyDeSesion devolviendo `canalKeyDe('app', \`ws${sessionId}\`)` → 1 fallo.
test('la clave de scope es app:<sesión>: dos sesiones no comparten cola', () => {
  assert.equal(canalKeyDeSesion(123), 'app:123');
  assert.notEqual(canalKeyDeSesion(1), canalKeyDeSesion(2));
  assert.equal(canalDeClave(canalKeyDeSesion(7)), 'app');
  for (const malo of [0, -1, 1.5, Number.NaN]) assert.throws(() => canalKeyDeSesion(malo), `aceptó ${malo}`);
});

// Rotura: chartKeyDePersona ignorando la persona (`return PREFIJO_CHART_MOVIL + 'x'`) → 1 fallo.
test('las sesiones son por PERSONA: dos personas, dos claves; sin nadie, null', () => {
  const a = chartKeyDePersona({ sub: '1', email: 'martin@x.com' });
  const b = chartKeyDePersona({ sub: '22', email: 'closer@x.com' });
  assert.equal(a, `${PREFIJO_CHART_MOVIL}u1`);
  assert.notEqual(a, b);
  assert.equal(chartKeyDePersona({ sub: 'password', email: 'Dueno@X.com' }), `${PREFIJO_CHART_MOVIL}dueno@x.com`);
  assert.equal(chartKeyDePersona({ sub: 'dev', email: '' }), `${PREFIJO_CHART_MOVIL}dev`);
  assert.equal(chartKeyDePersona({ sub: '', email: '' }), null);
  assert.ok(!String(a).startsWith('mako-doer'), 'la clave colisiona con la del chat de escritorio');
});

// --- 3. La tarjeta y los links -------------------------------------------------------

// La tarjeta sale de la FILA de la bandeja (`aFila`, lib/bandeja-filas.ts, server-only): lo
// que se prueba acá es que la tarjeta no re-decide nada que la fila ya resolvió, y que dice
// lo mismo que la fila del Inbox del teléfono.
// Rotura: `consecuencia: f.escribe` (la frase técnica de escritorio) → 1 fallo (este).
test('la tarjeta: la fila de la bandeja + la consecuencia y el detalle del Inbox del teléfono', () => {
  const fila = { resumen: 'Agregar nota a Ana: llamar el lunes', operacion: 'Agregar una nota', escribe: 'lead_eventos (nota)', reversible: true, vence: '11 oct, 20:00 (en 2 h)', payload: { lead_id: 7, texto: 'llamar el lunes' } };
  const t = tarjetaDePendiente({ id: 5, tipo: 'agregar_nota_lead', venceAt: '2026-10-11T20:00:00Z' }, fila);
  assert.deepEqual(
    [t.pendienteId, t.titulo, t.resumen, t.escribe, t.deshacer, t.venceAt, t.vence],
    [5, 'Agregar una nota', 'Agregar nota a Ana: llamar el lunes', 'lead_eventos (nota)', true, '2026-10-11T20:00:00Z', '11 oct, 20:00 (en 2 h)'],
  );
  assert.equal(t.consecuencia, consecuenciaDeshacer(true), 'la consecuencia de la tarjeta no es la del Inbox');
  assert.equal(tarjetaDePendiente({ id: 6, tipo: 'x', venceAt: 'y' }, { ...fila, reversible: false }).consecuencia, 'No se puede deshacer');
  assert.equal(tarjetaDePendiente({ id: 7, tipo: 'ya_no_existe', venceAt: 'y' }, { ...fila, reversible: null }).consecuencia, null);
  assert.ok(t.detalle.length >= 1 && t.detalle.some((l) => l.valor.includes('llamar el lunes')), `el detalle no trae lo que se va a ejecutar: ${JSON.stringify(t.detalle)}`);
});

// Rotura: `tarjetaDePendiente(p, { ...p, operacion: p.tipo, escribe: null, … })` sin aFila → 1 fallo (este).
test('el turno arma la tarjeta con aFila (la fila de /mako/pendientes y de Inbox), no con una copia', () => {
  assert.match(TURNO, /tarjetaDePendiente\(p, aFila\(p, tz\)\)/);
  assert.match(TURNO, /import \{ aFila \} from '@\/lib\/bandeja-filas';/);
});

// Rotura: el patrón de «ya no existe en MaKo» cambiado a «no existe más» (lo mismo que si el
// texto cambia en lib/api-mako/acciones.ts) → 1 fallo (este: si no, el rechazo vuelve largo al
// toast sin que nadie se entere).
test('los rechazos de la tarjeta vuelven cortos, y cada patrón sigue existiendo en el origen', () => {
  const origen = leer('lib/api-mako/acciones.ts');
  const literales = [...origen.matchAll(/return \{ error: (['`])((?:(?!\1).)*)\1/g)].map((m) => m[2].replace(/\$\{[^}]*\}/g, (x) => (x.includes('id') ? '12' : x.includes('verbo') ? 'confirmar' : 'x')));
  for (const [re, corto] of ERRORES_DE_TARJETA) {
    assert.ok(literales.some((l) => re.test(l)), `el patrón ${re} ya no reconoce ningún rechazo de lib/api-mako/acciones.ts (cambió el texto)`);
    assert.ok(corto.split(/\s+/).length <= 5, `«${corto}» es largo para un toast`);
  }
  assert.equal(errorCortoDeTarjeta('No encuentro la acción #42 vigente.'), 'Ya no está vigente');
  assert.equal(errorCortoDeTarjeta('Esa acción ya se estaba ejecutando o ya venció.'), 'Ya se resolvió');
  assert.equal(errorCortoDeTarjeta('Algo raro pasó'), 'Algo raro pasó', 'lo que no se reconoce pasa tal cual');
  assert.equal(errorCortoDeTarjeta(undefined), 'No se pudo');
});

// Medido el 11/10/2026 contra el ws 9: con la instrucción de WhatsApp en la salida, el modelo
// pidió «Confirma con un «sí»» aunque el system decía «tocando la tarjeta».
// Rotura: `conInstruccionDeTarjeta` devolviendo `out` sin tocar → 1 fallo (este).
test('la pendiente le dice al modelo que se confirma en la TARJETA, no con un «sí»', () => {
  const deWa = JSON.stringify({ ok: true, pendiente_id: 149, resumen: 'Anotar en Juanfran', vence_en_min: 120, instruccion: 'Di qué vas a hacer y pide que confirmen con un «sí» para ejecutarlo.' });
  const j = JSON.parse(conInstruccionDeTarjeta(deWa));
  assert.equal(j.instruccion, INSTRUCCION_TARJETA);
  assert.deepEqual([j.pendiente_id, j.resumen, j.vence_en_min], [149, 'Anotar en Juanfran', 120], 'se perdió lo demás de la salida');
  const lectura = JSON.stringify({ encontrados: 1, leads: [] });
  assert.equal(conInstruccionDeTarjeta(lectura), lectura);
  const objeto = { content: 'x', isError: true };
  assert.equal(conInstruccionDeTarjeta(objeto), objeto);
  assert.match(TURNO, /const out = conInstruccionDeTarjeta\(await \(NOMBRES_DE_SIEMPRE\.has\(name\)/, 'el turno no la aplica a la salida antes del memo');
});

// Rotura: sacar la guarda `porId(nombre)?.tipo === 'lectura'` de linksDeUnaAccion → 1 fallo.
test('los links los toma el código de la salida de una ACCIÓN; una lectura no cuenta', () => {
  const borrador = linksDeUnaAccion('proponer_tareas_plan', { tareas: [{ titulo: 'a' }, { titulo: 'b' }] }, JSON.stringify({ ok: true, link: 'https://hola-mako.com/plan/revisar/propabc123?ws=9' }));
  assert.deepEqual(borrador.map((l) => [l.clase, l.tareas]), [['borrador', 2]]);
  const lead = linksDeUnaAccion('proponer_lead', { nombre: ' Ana Pérez ' }, JSON.stringify({ ok: true, url: 'https://hola-mako.com/crm/revisar/abc?ws=9' }));
  assert.deepEqual(lead.map((l) => [l.clase, l.nombre]), [['lead', 'Ana Pérez']]);
  const generica = linksDeUnaAccion('proponer_estado_campana', {}, JSON.stringify({ ok: true, url: 'https://hola-mako.com/mako/revisar/zz9?ws=9', link: 'https://hola-mako.com/mako/revisar/zz9?ws=9' }));
  assert.deepEqual(generica.map((l) => l.clase), ['accion']);
  assert.deepEqual(linksDeUnaAccion('ver_plan', {}, JSON.stringify({ link: 'https://hola-mako.com/plan/revisar/viejo' })), [], 'una LECTURA que devuelve un link no crea un borrador');
  assert.deepEqual(linksDeUnaAccion('proponer_tareas_plan', {}, 'no es json /plan/revisar/x'), []);
});

// Rotura: rutaDeEscritorio devolviendo la url tal cual → 2 fallos (este y el de propuestaDePantalla).
test('la propuesta de pantalla va a /m/inbox y la ruta de escritorio sin dominio ni ?ws=', () => {
  assert.equal(rutaDeEscritorio('https://hola-mako.com/plan/revisar/abc?ws=9'), '/plan/revisar/abc');
  assert.equal(rutaDeEscritorio('/crm/revisar/x?ws=3#y'), '/crm/revisar/x');
  const p = propuestaDePantalla({ clase: 'lead', url: 'https://hola-mako.com/crm/revisar/abc?ws=9', operacion: 'proponer_lead', nombre: 'Ana' });
  assert.deepEqual(p, { clase: 'lead', titulo: 'Ficha de Ana', href: '/m/inbox', escritorio: '/crm/revisar/abc' });
});

// Rotura: sinLinksDeRevision devolviendo el texto tal cual → 1 fallo.
test('el texto del modelo sale sin links a pantallas de revisión (los pone el código)', () => {
  const t = sinLinksDeRevision('Listo, Ana queda propuesta.\nRevísalo aquí: https://hola-mako.com/crm/revisar/abc?ws=9\nTambién en /mako/pendientes y /plan/revisar/propx.\nNada más.');
  assert.doesNotMatch(t, /revisar|pendientes|https?:/);
  assert.match(t, /^Listo, Ana queda propuesta\.\nRevísalo\n/);
  assert.match(t, /Nada más\.$/);
  assert.equal(sinLinksDeRevision('Sin links: el CRM está en orden.'), 'Sin links: el CRM está en orden.');
});

// Rotura: historialParaModelo sin el `continue` del primer assistant → 1 fallo.
test('el historial que vuelve al modelo arranca en user y no repite rol', () => {
  const h = historialParaModelo([
    { role: 'assistant', content: 'hola' }, { role: 'user', content: 'a' }, { role: 'user', content: 'b' },
    { role: 'assistant', content: 'Hecho: x' }, { role: 'user', content: 'c' },
  ]);
  assert.deepEqual(h, [{ role: 'user', content: 'a\nb' }, { role: 'assistant', content: 'Hecho: x' }, { role: 'user', content: 'c' }]);
  assert.equal(historialParaModelo(Array.from({ length: 30 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: String(i) })), 12).length <= 12, true);
});

// --- 4. Adjuntos ---------------------------------------------------------------------

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const HEIC = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);

// Rotura: tipoPorFirma aceptando cualquier cosa como jpeg → 2 fallos (este y el de validar).
test('un archivo es lo que dicen sus bytes: JPG, PNG, GIF, WEBP y PDF sí; HEIC no', () => {
  assert.deepEqual(tipoPorFirma(JPEG), { tipo: 'image', mime: 'image/jpeg' });
  assert.deepEqual(tipoPorFirma(PNG), { tipo: 'image', mime: 'image/png' });
  assert.deepEqual(tipoPorFirma(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), { tipo: 'image', mime: 'image/gif' });
  assert.deepEqual(tipoPorFirma(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])), { tipo: 'image', mime: 'image/webp' });
  assert.deepEqual(tipoPorFirma(PDF), { tipo: 'document', mime: 'application/pdf' });
  assert.equal(tipoPorFirma(HEIC), null);
  assert.equal(tipoPorFirma(new Uint8Array([])), null);
});

// Rotura: validarAdjuntos sin el chequeo `coincide` → 1 fallo (este).
test('validar: la familia declarada y los bytes tienen que coincidir, con topes de cantidad y peso', () => {
  const ok = validarAdjuntos([{ nombre: 'foto.png', mime: 'image/png', bytes: JPEG }, { nombre: 'blob', mime: 'application/pdf', bytes: PDF }]);
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.adjuntos.map((a) => [a.tipo, a.mime]), [['image', 'image/jpeg'], ['document', 'application/pdf']], 'el mime sale de los bytes, no del nombre');
  assert.deepEqual(validarAdjuntos([{ nombre: 'contrato.pdf', mime: 'application/pdf', bytes: JPEG }]), { ok: false, error: ERROR_ADJUNTO.formato });
  assert.deepEqual(validarAdjuntos([{ nombre: 'IMG_1.heic', mime: 'image/heic', bytes: HEIC }]), { ok: false, error: ERROR_ADJUNTO.formato });
  assert.deepEqual(validarAdjuntos([{ nombre: 'notas.txt', mime: 'text/plain', bytes: new Uint8Array([0x68, 0x6f]) }]), { ok: false, error: ERROR_ADJUNTO.formato });
  assert.deepEqual(validarAdjuntos(Array.from({ length: 5 }, () => ({ nombre: 'a.jpg', mime: 'image/jpeg', bytes: JPEG }))), { ok: false, error: ERROR_ADJUNTO.muchos });
  const grande = new Uint8Array(TOPE_TOTAL_BYTES + 1); grande.set(JPEG);
  assert.deepEqual(validarAdjuntos([{ nombre: 'a.jpg', mime: 'image/jpeg', bytes: grande }]), { ok: false, error: ERROR_ADJUNTO.pesado });
  assert.deepEqual(validarAdjuntos([{ nombre: 'a.jpg', mime: 'image/jpeg', bytes: new Uint8Array([]) }]), { ok: false, error: ERROR_ADJUNTO.vacio });
});

// Rotura: mimeImagenWhatsApp con `.toLowerCase()` → 1 fallo (este): cambiaría lo que hacía el doer.
test('el doer de WhatsApp usa las piezas compartidas SIN cambiar lo que hacía', () => {
  assert.equal(mimeImagenWhatsApp('image/png'), 'image/png');
  assert.equal(mimeImagenWhatsApp('image/webp; charset=x'), 'image/webp');
  assert.equal(mimeImagenWhatsApp('image/heic'), 'image/jpeg');
  assert.equal(mimeImagenWhatsApp(undefined), 'image/jpeg');
  assert.equal(mimeImagenWhatsApp('IMAGE/PNG'), 'image/jpeg', 'antes de la mudanza no se pasaba a minúsculas');
  assert.deepEqual(bloquesDeAdjuntos([{ tipo: 'image', mime: 'image/png', base64: 'AAA' }], ''), [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } },
    { type: 'text', text: 'Mira esta imagen y dime qué ves y qué hago.' },
  ]);
  assert.deepEqual(bloquesDeAdjuntos([{ tipo: 'document', mime: 'x', base64: 'B' }], 'resúmelo')[0], { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'B' } });
  assert.equal(placeholderDeAdjunto('image', 'menú', 'cárgalo'), '(envió una imagen: menú) — cárgalo');
  assert.equal(placeholderDeAdjunto('document', '', ''), '(envió un PDF)');
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(doer, /mediaBlocks = bloquesDeAdjuntos\(\[\{ tipo: adjunto\.tipo, mime: adjunto\.mime, base64: b64 \}\], textoDirecto \|\| adjunto\.caption\);/);
  assert.match(doer, /mime: mimeImagenWhatsApp\(img\.mimetype\)/);
  assert.doesNotMatch(doer, /Mira esta imagen|image\\\/\(jpeg\|png/, 'quedó una segunda copia en el doer');
});

// --- 5. El cableado ------------------------------------------------------------------


// Rotura: pasar `runTool` en vez de `nuevoIntento()` a chatClaudeTools → 1 fallo (este).
test('cada corrida del turno abre un intento nuevo del memo', () => {
  const corridas = [...TURNO.matchAll(/chatClaudeTools\(system, msgs, tools, ([^,]+),/g)].map((m) => m[1].trim());
  assert.ok(corridas.length >= 1, 'no encontré la corrida: cambió la forma y este test ya no mira nada');
  assert.deepEqual(corridas.filter((c) => c !== 'nuevoIntento()'), []);
  assert.match(TURNO, /const nuevoIntento = \(\) => \{ memo\.nuevoIntento\(\); return runTool; \};/);
  assert.match(TURNO, /feature: FEATURE,/);
  assert.match(TURNO, /const FEATURE = 'mako-doer';/);
});

// Rotura: mover `if (!permitidas.has(name))` debajo de la ejecución → 1 fallo (este).
test('runTool: el contrato antes que nada, el memo antes de ejecutar y la anotación después', () => {
  const ini = TURNO.indexOf('const runTool = async (name: string, input: Record<string, unknown>) => {');
  const fin = TURNO.indexOf('const nuevoIntento', ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré runTool');
  const cuerpo = TURNO.slice(ini, fin);
  const iContrato = cuerpo.indexOf('if (!permitidas.has(name))');
  const iPrevio = cuerpo.indexOf('const previo = memo.previo(name);');
  const iCorre = cuerpo.indexOf('runMakoTool(name, input) : runRegistro(name, input)');
  const iAnota = cuerpo.indexOf('memo.anotar(name, out);');
  assert.ok(iContrato > 0 && iPrevio > iContrato && iCorre > iPrevio && iAnota > iCorre, `orden: contrato ${iContrato}, memo ${iPrevio}, corre ${iCorre}, anota ${iAnota}`);
  assert.doesNotMatch(cuerpo, /crearRunnerAcciones|confirmarPendiente/, 'una acción por un camino que no pasa por el gating del registro');
});

// Rotura: `alcance: 'ejecutar'` en el Ctx del turno → 1 fallo (este).
test('el Ctx del turno: clave del chat, `proponer`, rol real y turnStart; nada de la bandeja', () => {
  assert.match(TURNO, /alcance: 'proponer', rol: persona\.rol, turnStart,/);
  assert.match(TURNO, /const canalKey = canalKeyDeSesion\(s\.id\);/);
  assert.doesNotMatch(TURNO, /app:ws|ctxDeBandeja|bandeja: true/);
  assert.match(TURNO, /chartKeyDePersona\(sesion\)/);
  assert.match(TURNO, /s\.chart_key === persona\.chartKey/, 'una sesión por id sin comparar la clave abre el chat de otro');
});

// Rotura: `await appendMessage(s.id, 'assistant', [respuesta, ...paraLaPersona].join('\n'))` → 1 fallo.
test('lo de la agenda (paraLaPersona) y los carteles de la plataforma NO se guardan en el hilo', () => {
  const guardas = [...TURNO.matchAll(/appendMessage\(([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(guardas.length >= 3, `leí ${guardas.length} appendMessage: cambió la forma`);
  for (const g of guardas) assert.doesNotMatch(g, /paraLaPersona|aviso|AVISO_|detalle/, `se guarda algo que no es conversación: appendMessage(${g})`);
});

test('la ruta: maxDuration 300, multipart con el largo ANTES de parsear, y nada de server action para archivos', () => {
  const ruta = sinComentarios(leer('app/api/m/mako/route.ts'));
  assert.match(ruta, /export const maxDuration = 300;/);
  const iLargo = ruta.indexOf("req.headers.get('content-length')");
  const iForm = ruta.indexOf('await req.formData()');
  assert.ok(iLargo > 0 && iForm > iLargo, 'el content-length se mira antes del formData()');
  assert.match(ruta, /validarAdjuntos\(/);
  assert.match(ruta, /personaDelRequest\(\)/);
});

// Rotura: agregar `export const X = 1;` a app/m/mako/acciones.ts → 1 fallo (este).
test("app/m/mako/acciones.ts es 'use server' y sólo exporta funciones async, con la persona adentro", () => {
  const src = leer('app/m/mako/acciones.ts');
  assert.match(src, /^'use server';/);
  const exports = [...sinComentarios(src).matchAll(/^export\s+(.*)$/gm)].map((m) => m[1]);
  assert.ok(exports.length === 2, `exporta ${exports.length} cosas`);
  for (const e of exports) assert.match(e, /^async function (confirmarEnChatAction|cancelarEnChatAction)\(pendienteId: number, sessionId: number\)/);
  assert.equal((src.match(/await personaDelRequest\(\)/g) ?? []).length, 2, 'cada acción exige la persona ADENTRO');
  assert.doesNotMatch(sinComentarios(src), /ctxDeBandeja/);
});
