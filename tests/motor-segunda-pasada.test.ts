// =============================================================================
// Sexta tanda, segunda pasada, parte «motor» (09/10/2026): lo que quedó SIN ENCHUFAR
// =============================================================================
// Ocho partes implementaron la sexta tanda en paralelo y cada una dejó salidas sin call site. Esto fija
// los enchufes del motor, los webhooks y la API. Lo que vive en módulos `server-only` (el motor, los
// webhooks, la API) se fija sobre el FUENTE recortado a su función; lo puro, EJECUTÁNDOLO.
//
//   · una respuesta por Instagram o Messenger se ANOTA sin contestar por WhatsApp (desde el 14/10/2026 la
//     contesta el AI Step de ese medio, por ese canal), y va ANTES del disparo (el mismo DM puede arrancar
//     una automatización);
//   · el webhook pregunta «¿alguien escucha ESTE evento?» y dispara con el subtipo traducido;
//   · el email que llega: sin casts, el fallo de ruteo anotado, y el webhook de siempre de Resend;
//   · el Recurrente al grupo de MaKo sale con los dos canales del negocio apagados, sin inscribir a nadie;
//   · la tarjeta MAKO EN WHATSAPP y «Probar» resuelven el catálogo entero del «{ }»;
//   · los textos de la API sin «de 9 a 21».
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { huellaRuteoPrevia, sumarFalloRuteo } from '../lib/webhook-ruteo-huella';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';
import { datosDeEjemplo, textoDeEjemplo, correoDeEjemplo } from '../lib/simulador-grafo';
import { valoresDeEjemplo } from '../lib/variables-aviso';
import { REGISTRO } from '../lib/api-mako/registro';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas ANTES que los bloques (AGENTS.md).
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** De `ini` hasta el primer `fin` que viene después; afirma que existen. */
const bloque = (src: string, ini: string, fin: string): string => {
  const i = src.indexOf(ini);
  assert.ok(i >= 0, `no encontré «${ini}»`);
  const j = src.indexOf(fin, i + ini.length);
  assert.ok(j > i, `no encontré el cierre «${fin}» después de «${ini}»`);
  return src.slice(i, j);
};
const NUTRI = sinComentarios(leer('lib/nutricion.ts'));

// ── Instagram y Messenger ─────────────────────────────────────────────────────

// ⚠️ CAMBIÓ EL 14/10/2026 (TikTok fase 0): una respuesta social ya no SÓLO pausa. La contesta el AI Step de ese
// medio, por ese canal; lo que contestaría por WhatsApp (el destrabe lineal, el modo asistido) sigue sin correr.
// El detalle se fija en tests/ai-step-redes.test.ts.
test('una RESPUESTA social se anota y la atiende el AI Step de SU medio, nunca lo del WhatsApp', () => {
  const p = bloque(NUTRI, 'export async function pausarPorRespuesta(', '\n}\n');
  assert.match(p, /origen\?: 'no_oficial' \| 'oficial' \| CanalSocial; cuenta\?: string \| null/);
  assert.match(p, /const medio: MedioAIStep = social \?\? 'whatsapp';/);
  assert.doesNotMatch(p, /if \(social\) return/, 'volvió el corte: una respuesta por Instagram no la contesta nadie');
  // El destrabe lineal (del WhatsApp) no corre con lo social.
  assert.match(p, /if \(pausadas\.length && !social\) \{/);
  // Anota lo activo y lo terminado ANTES de contestar (las dos cosas cuentan como «respondió»).
  const iTardias = p.indexOf('tardias = (upd ?? [])');
  assert.ok(iTardias > 0 && iTardias < p.indexOf('asistirRespuesta(leadId'), 'contesta antes de anotar lo terminado: doce horas después «no contestó»');
  assert.match(p, /charlaDelLead\(leadId, medio\)/);
  assert.match(p, /asistirRespuesta\(leadId, atendibles\.map\(\(i\) => i\.secuencia_id\), opts\?\.texto, opts\?\.linea \?\? null, \{ medio, cuenta: opts\?\.cuenta \?\? null \}\)/);
  assert.match(p, /seguirCharla\(leadId, charla, opts\?\.texto, opts\?\.linea \?\? null, social \?\? /);
});

test('el webhook: una respuesta de un lead PAUSA y después dispara, en el mismo `after`', () => {
  const ent = sinComentarios(leer('lib/zernio-entrante.ts'));
  const proc = bloque(ent, 'export async function procesarEventoSocial(', '\n}\n');
  assert.match(proc, /const pausar = yaEraLead != null && ES_RESPUESTA\.has\(e\.subtipo\);/);
  assert.match(ent, /const ES_RESPUESTA: ReadonlySet<EventoSocial\['subtipo'\]> = new Set\(\['mensaje', 'historia'\]\);/);
  // Un lead NUEVO no tiene nada que pausar.
  assert.match(proc, /return \{ accion: `\$\{accion\}_sin_automatizacion`, leadId: null, disparar: false, pausar: false \};/);
  assert.match(ent, /return pausarPorRespuesta\(leadId, \{ origen: canal, texto: extra\.texto \?\? undefined, cuenta: extra\.cuenta \?\? null \}\);/);
  const ruta = sinComentarios(leer('app/api/webhooks/zernio/route.ts'));
  const despues = bloque(ruta, 'after(async () => {', '\n        });');
  const iPausa = despues.indexOf('pausarRespuestaSocial(leadId, canal, { texto: ev.evento.texto, cuenta: ev.evento.cuentaId })');
  const iDisparo = despues.indexOf('dispararEventoSocial(leadId, canal, subtipo)');
  assert.ok(iPausa > 0 && iDisparo > iPausa, 'pausar después de disparar pausa la automatización que este mismo DM acaba de arrancar');
});

test('el webhook pregunta por ESTE evento, con el subtipo en las palabras del CRON, y sin casts', () => {
  const ent = sinComentarios(leer('lib/zernio-entrante.ts'));
  const hay = bloque(ent, 'export async function hayQuienEscuche(', '\n}\n');
  assert.match(hay, /const sub = subtipoDelEvento\(canal, subtipo\);/);
  assert.match(hay, /return escuchaElEvento\(await getSecuenciasActivas\(\), canal, \{ subtipo: sub \}\);/);
  assert.doesNotMatch(hay, /trigger_tipo/, 'volvió a preguntar por el PRIMER CRON y por cualquier evento del canal');
  const disp = bloque(ent, 'export async function dispararEventoSocial(', '\n}\n');
  assert.match(disp, /return enrolarPorEvento\(leadId, canal, \{ subtipo: sub \}\);/);
  assert.doesNotMatch(ent, /as unknown as/, 'volvió un cast: un evento que el motor no conoce compila y no inscribe a nadie');
  assert.match(sinComentarios(leer('lib/zernio-entrante.ts')), /if \(!\(await hayQuienEscuche\(e\.canal, e\.subtipo\)\)\)/);
});

// ── El email que llega ────────────────────────────────────────────────────────

test('el email: el servicio de ruteo existe, la tabla se vacía con el inquilino', () => {
  const f = { cuando: '2026-10-09T20:00:00Z', servicio: 'email' as const, identificador: 'hola@inbox.negocio.com', transitorio: true, mensaje: 'fetch failed' };
  assert.deepEqual(sumarFalloRuteo([], f), [f], 'un fallo de ruteo del email se descartaba al anotarlo');
  assert.deepEqual(huellaRuteoPrevia(JSON.stringify([f])), [f]);
  assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes('email_entrantes'), 'el reset y el borrado de un cliente dejaban sus emails');
});

// ── El Recurrente al grupo, con los canales apagados ──────────────────────────

test('sin canales, el Recurrente al grupo sale igual, y no inscribe a la cohorte', () => {
  const ruta = sinComentarios(leer('app/api/cron/nutricion/route.ts'));
  const off = bloque(ruta, 'if (!waOn && !emailOn) {', '\n          }\n');
  assert.match(off, /const conGrupo = activas\.some\(tieneRecurrenteAlGrupo\);/);
  assert.match(off, /if \(conGrupo\) await comprometerInscripciones\(\{ soloGrupo: true \}\);/);
  assert.doesNotMatch(off, /comprometerInscripciones\(\)/, 'con los canales apagados no se inscribe a nadie por cohorte');
  const c = bloque(NUTRI, 'export async function comprometerInscripciones(', '\n}\n');
  assert.match(c, /if \(opts\?\.soloGrupo && !sec\.disparador\.grupo\) continue;/);
  // El corte de la cohorte va DESPUÉS de mandarle al grupo, y ANTES de leer la cohorte.
  const grupo = c.indexOf('await mandarRecurrenteAlGrupo(base, sec.disparador, sec.cron_proxima_at)');
  const corte = c.indexOf('if (opts?.soloGrupo) continue;');
  assert.ok(grupo > 0 && corte > grupo && corte < c.indexOf('leadsDeCohorte('), 'soloGrupo inscribe a la cohorte, o corta antes del grupo');
});

// ── Los datos «{ }» ───────────────────────────────────────────────────────────

test('la tarjeta MAKO EN WHATSAPP resuelve el catálogo entero, para el EQUIPO y en el workspace del ctx', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  const t = bloque(run, 'async function textoDelAviso(', '\n}\n');
  // Undécima tanda (§5): los valores del catálogo y la MISMA función de todo envío (`textoConDatos`, el renglón opcional).
  assert.match(t, /await valoresDeVariables\(\{ ws, leadId: lead\?\.id \?\? null, leadNombre: lead\?\.nombreCrudo \?\? null, destino: 'equipo' \}, t, base\)/);
  assert.match(t, /textoConDatos\(t, /);
  assert.doesNotMatch(t, /getWorkspaceActual|wsEnContexto/, 'el workspace del aviso sale del ctx: un flujo corre en un cron');
});

test('«Probar» resuelve los datos nuevos con sus ejemplos; el nombre del negocio, el real o crudo', () => {
  const ej = valoresDeEjemplo();
  // Un dato del catálogo nuevo (la etapa) sale con su ejemplo, no crudo.
  assert.ok(ej.lead_etapa, 'el catálogo dejó de tener la etapa: elegir otro dato para este test');
  assert.equal(textoDeEjemplo('Vas en {{lead_etapa}}', null), `Vas en ${ej.lead_etapa}`, 'la etapa salía cruda en el simulador');
  // El lead de la prueba gana sobre el ejemplo del catálogo.
  assert.equal(textoDeEjemplo('Hola {{nombre}}', null), 'Hola Luis');
  // El negocio: el real, o crudo (nunca el del ejemplo).
  assert.equal(textoDeEjemplo('De {{negocio}}', 'Valle Sur'), 'De Valle Sur');
  // Undécima tanda: «Probar» resuelve con `textoConDatos`, la misma función del envío. Sin nombre de negocio el
  // renglón se va entero (el renglón opcional); nunca sale uno inventado.
  assert.equal(textoDeEjemplo('De {{negocio}}', null), '', 'un nombre de negocio inventado se leería como el del cliente');
  assert.equal(datosDeEjemplo({ nombre: 'Ana' }).negocio, undefined);
  assert.equal(correoDeEjemplo({ asunto: 'Tu etapa: {{lead_etapa}}', cuerpo: 'x' }).asunto, `Tu etapa: ${ej.lead_etapa}`);
  // Y la prueba REAL usa la misma función.
  const prueba = bloque(sinComentarios(leer('lib/setting-secuencias.ts')), 'export async function probarSecuencia(', '\n}\n');
  assert.match(prueba, /const vars = datosDeEjemplo\(\{ nombre: contacto\.nombre \|\| 'Prueba' \}\);/);
});

// ── El catálogo de los disparadores ───────────────────────────────────────────

test('los seis tipos del CRON tienen NOMBRE en `TRIGGERS`, y las puertas de /email rechazan los que piden el evento o el horario', () => {
  // `TRIGGERS` vive en un módulo que arrastra lib/workspace: se lee el fuente del array.
  const em = sinComentarios(leer('lib/email-marketing.ts'));
  const lista = bloque(em, 'export const TRIGGERS: Opcion[] = [', '\n];');
  for (const t of ['etiqueta_agregada', 'etiqueta_quitada', 'instagram', 'messenger', 'email_recibido', 'grupo_mako']) {
    assert.match(lista, new RegExp(`\\{ value: '${t}', label: '[^']{3,40}' \\}`), `«${t}» sin nombre: la API y la tarjeta dicen el slug crudo`);
  }
  for (const f of ['export async function crearEmailSecuencia(', 'export async function actualizarMetaEmailSecuencia(']) {
    const cuerpo = bloque(em, f, '\n}\n');
    assert.match(cuerpo, /SOLO_DESDE_EL_CRON\.has\(/, `${f}: guarda un Instagram sin evento, que no arranca nunca`);
    assert.ok(cuerpo.indexOf('SOLO_DESDE_EL_CRON.has(') < cuerpo.indexOf('getTenantDb()'), `${f}: rechaza DESPUÉS de empezar a escribir`);
  }
  const run = sinComentarios(leer('lib/api-mako/areas/email.run.ts'));
  assert.match(bloque(run, 'function errorEtapaTrigger(', '\n}\n'), /if \(trigger !== undefined && SOLO_DESDE_EL_CRON\.has\(trigger\)\) \{/);
});

// ── TAG 1: «Agregar» y «Eliminar», también en la API ──────────────────────────

test('ninguna operación de la API dice «poner» / «sacar» una etiqueta (TAG 1)', () => {
  // El verbo (no el id de una operación: `poner_etiqueta_lead` es un nombre, y no se ve), y a menos de
  // 30 letras de «etiqueta». Los límites por Unicode: `\b` no corta después de una «ó» (AGENTS.md).
  const RX = /(?<![\p{L}_])(?:[Pp]oner(?:le|la)?|[Ss]acar(?:le|la)?|[Pp]uesta|[Ss]acada)(?![\p{L}_])[^.]{0,30}etiqueta|etiqueta (?:puesta|sacada)(?!\p{L})/u;
  for (const d of REGISTRO) {
    if (!/etiqueta/i.test(`${d.titulo} ${d.descripcion}`)) continue;
    assert.doesNotMatch(d.titulo, RX, `${d.id}: el título dice Poner / Sacar`);
    // La del WhatsApp del celular (whatsapp.def.ts, protegida por la rama wip/api-acciones-0910) queda afuera.
    if (d.area === 'whatsapp') continue;
    assert.doesNotMatch(d.descripcion, RX, `${d.id}: la descripción dice Poner / Sacar`);
  }
  const crm = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  for (const op of ['poner_etiqueta_lead', 'sacar_etiqueta_lead']) {
    const r = bloque(crm, `  ${op}: {`, '\n  },\n');
    assert.doesNotMatch(r, /No se pudo (poner|sacar)|etiqueta (puesta|sacada)|Ponerle|Sacarle|'(poner|sacar) la etiqueta'/, `${op}: el resumen dice Poner / Sacar`);
  }
});

// ── Los textos de la API ──────────────────────────────────────────────────────

test('la API no promete «de 9 a 21» ni «cada hora»: el horario es el del negocio, si puso uno', () => {
  for (const d of REGISTRO) {
    assert.doesNotMatch(d.descripcion, /9 a 21|de 9 a|15 a 23|cada hora/, `${d.id}: describe la ventana de antes`);
  }
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  assert.doesNotMatch(run, /9 a 21|cada hora, en horario de envío/);
  const cuando = bloque(run, 'async function cuandoSale(', '\n}\n');
  assert.match(cuando, /el primer mensaje sale en el próximo minuto \(o al abrir el horario de envío, si el negocio puso uno\)/);
});

// ── ROTURAS (09/10/2026) ───────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo, restaura DE MEMORIA con md5; nunca git).
// Base: 10 / 0. Cada una dio 9 / 1 (las que corrieron con otro archivo, dicen cuál):
//   · `hayQuienEscuche` vuelto a `trigger_tipo.includes(canal)` · la pausa también para un comentario ·
//     la respuesta social sin el corte (contesta por WhatsApp) · la huella sin 'email' · `email_entrantes`
//     fuera de las tablas · `cuandoSale` con «cada hora» · `TRIGGERS` sin el nombre de Instagram ·
//     /email guardando un Instagram sin evento · la API de email sin la guarda · el título «Ponerle» ·
//     el resumen «Listo: etiqueta puesta».
//   · disparar ANTES de pausar en el `after` (con tests/canal-social.test.ts, base 25/0)    → 24 / 1
//   · `soloGrupo` inscribiendo a la cohorte (con tests/disparadores-motor.test.ts, 17/0)   → 16 / 1
//   · el cron sin canales llamando `comprometerInscripciones()` (con flujo-acciones-bordes, 26/0) → 25 / 1
//   · «Probar» con los cinco de antes, y «Probar» inventando el negocio (con los dos de simulador, 46/0) → 45 / 1
//   · la tarjeta MAKO resolviendo para el LEAD (con tests/lienzo-tercera-tanda.test.ts, 20/0) → 18 / 2
// Restaurado: 10 / 0.
