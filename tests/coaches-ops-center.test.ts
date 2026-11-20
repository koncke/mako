// Los de arriba del Ops Center (Martín, 1/11/2026: «primero el chat principal de Ops Center, que ya no se llama cerebro... segundo
// funnel coach y ahí adentro la calculadora») y los referentes. UN SOLO COACH desde el 4/11/2026 (Martín: «Junta a "Offer coach" con
// "Funnel Coach", que se quede solo "Funnel coach" y que tenga ambas funcionalidades dentro... Por defecto, que esté la cara de hormozi»).
// Probado rompiéndolo:
//   · el jefe con `titulo: JEFE_SECOND_BRAIN`                    → 1
//   · sacar el filtro del Funnel Coach de `antes`                → 2 (dos filas)
//   · sacar `funnel-coach` de TABS_CON_CHAT_PROPIO               → 3 (su hilo no se crea)
//   · sacar la regla «no eres» de reglasDe                       → 5
//   · una ficha vacía o de más de 5.000 caracteres               → 7
//   · sanearPlan aceptando un funnel cualquiera                  → 8
//   · el camino con archivos con CONTEXTO_SECOND_BRAIN fijo       → 10
// Y lo del coach único (4/11/2026), con el archivo en 17 / 0, una rotura por vez y restaurada: cada una dio 16 / 1 en el test que la
// nombra su cabecera (11, 11b y 12-16); sumar una herramienta de 3.835 caracteres dio 14 / 3 (11, 11b y 13).
// Y LOS DOS COACHES DEL ONBOARDING V2 (18/11/2026, 17-21): el Offer Coach y el Funnel Coach separados, SÓLO detrás del interruptor
// (lib/onboarding-v2/revision.ts). Las roturas, en la cabecera de la 17.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  JEFE_SECOND_BRAIN, NOMBRE_JEFE, ORIGEN_FUNNEL_COACH, ORIGEN_OFFER_COACH, TABS_CON_CHAT_PROPIO, TAB_FUNNEL_COACH, TAB_OFFER_COACH, esCoachDelOps,
  listaDelCliente, origenDeClave,
} from '../lib/chat-mako-reglas';
import { ASESORES, REFERENTE_DE_FABRICA, conReferenteElegido, inspiradoEn, referenteDelCoach, referentePedido } from '../lib/asesores/catalogo';
import { FICHAS } from '../lib/asesores/fichas';
import {
  HERRAMIENTAS_DEL_COACH, HERRAMIENTAS_DEL_FUNNEL_COACH_V2, HERRAMIENTAS_DEL_OFFER_COACH, contextoDeReferente, contextoDelFunnelCoach, contextoDelFunnelCoachV2,
  contextoDelOfferCoach,
} from '../lib/asesores/contexto';
import {
  PREVIA_DEL_FUNNEL_COACH_V2, lineasDelPlan, ofertaDelCoach, ofertaParaElContexto, ofertaParaElContextoV2, previaDelCoach, previaDelOfferCoach,
  saludoDelFunnelCoach, saludoDelFunnelCoachV2, saludoDelOfferCoach, sanearOfertaDelCoach, sanearPlan, type OfertaDelCoach,
} from '../lib/funnel-plan';
import { ofertaArmadaDe } from '../lib/offer-marco';
import { aspectoDe, aspectoDeReferente, esCriaturaDeMako, sanearAspecto } from '../lib/centro-munecos';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
/** Los archivos de app/ y lib/ (los del índice y los nuevos sin commitear), sin las bitácoras de app/admin/dev/. */
const delRepo = () => execFileSync('git', ['ls-files', '-c', '-o', '--exclude-standard', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').filter((f) => /\.(tsx?|mts)$/.test(f) && !f.startsWith('app/admin/dev/'));
/** El código sin comentarios: la historia se cuenta ahí, y está bien. Primero las líneas, después los bloques. */
const sinComentarios = (src: string) => src.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el chat principal se lee «Ops Center» y sigue siendo la estrella', () => {
  const [jefe] = listaDelCliente({ sesiones: [], offer: [], antes: [], busca: '' });
  assert.equal(jefe.titulo, NOMBRE_JEFE);
  assert.equal(NOMBRE_JEFE, 'Ops Center');
  assert.ok(esCriaturaDeMako(jefe.criatura), 'el jefe perdió la estrella');
  assert.equal(jefe.criatura, JEFE_SECOND_BRAIN);
});

test('2. el hilo del Funnel Coach no se repite en el resto de la lista: su fila está fija', () => {
  const clave = `mako-movil:p:${TAB_FUNNEL_COACH}`;
  assert.equal(origenDeClave(clave), ORIGEN_FUNNEL_COACH);
  const lista = listaDelCliente({ sesiones: [], offer: [], busca: '', antes: [
    { id: 7, titulo: 'x', updatedAt: '2026-11-01T00:00:00Z', clave },
    { id: 8, titulo: 'y', updatedAt: '2026-11-01T00:00:00Z', clave: 'mako-movil:p:crm:4' },
  ] });
  assert.deepEqual(lista.map((f) => f.clave), ['jefe', 'a8']);
});

test('3. tiene su hilo propio, y la pantalla lo abre debajo del Ops Center, con las conversaciones de oferta colgando de él', () => {
  assert.ok(TABS_CON_CHAT_PROPIO.includes(TAB_FUNNEL_COACH));
  const p = leer('app/second-brain/ChatSecondBrain.tsx');
  // Sin el onboarding V2, debajo del Ops Center; con el V2 (20/11, OD-08), después del chat «Onboarding» y del Reto (la maqueta).
  assert.match(p, /<div className="co-cuenta co-cuenta--cerebro">\{fila\(cerebroFila\)\}<\/div>\n\s*\{!retoV2 && coaches\}/, 'el coach va debajo del Ops Center');
  assert.match(p, /onElegir=\{abrirReto\} \/>\n\s*<\/div>\n\s*\)\}\n\s*\{retoV2 && coaches\}/, 'con el V2, después del Reto');
  // Sus herramientas son del admin, y un closer no ve Offer: lo cerraría la puerta de la tab.
  assert.match(p, /const verCoach = ops \|\| veMapa \|\| puedeElegir;/);
  assert.match(p, /\{verCoach && !dosCoaches && \(\n\s*<div className="co-jefe">\n\s*<FilaDeChat titulo=\{ORIGEN_FUNNEL_COACH\}/);
  assert.match(p, /onElegir=\{\(\) => elegir\(\{ coach: 'funnel' \}\)\} \/>\n(\s*\{\/\*[^\n]*\*\/\}\n)?\s*\{filasOffer\.length > 0 && <div className="co-jefe__subs">\{filasOffer\.map\(\(f\) => fila\(f, true\)\)\}<\/div>\}/,
    'las conversaciones de oferta cuelgan del Funnel Coach');
  // Un turno no se corta por tocar otro chat: queda montado, escondido.
  assert.match(p, /\{funnelAbierto && \(\n\s*<div style=\{\{ display: verFunnel \? 'contents' : 'none' \}\}>/);
  assert.match(p, /const hrefVolver = conCoach \? `\$\{base\}\?coach=\$\{coachElegido\}`/, 'ir al Mapa y volver no pierde el coach');
});

test('4. el coach abre con Hormozi (Martín, 4/11/2026: «Por defecto, que esté la cara de hormozi»)', () => {
  assert.equal(REFERENTE_DE_FABRICA, 'hormozi');
  assert.equal(referenteDelCoach(null), 'hormozi', 'quien nunca eligió');
  assert.equal(referenteDelCoach({}), 'hormozi');
});

test('5. el contexto de un referente nunca finge ser él y siempre atribuye', () => {
  for (const a of ASESORES) {
    const c = contextoDeReferente(a.id);
    assert.match(c, new RegExp(`no eres ${a.completo}`), a.id);
    assert.match(c, /no participa ni respalda/, a.id);
    assert.match(c, /Nunca le inventes una cita/, a.id);
    assert.match(c, /ATRIBUYE SIEMPRE/, a.id);
    assert.match(c, /escasez o cupos inventados, reseñas, testimonios o seguidores falsos, promesas de ingresos/, `${a.id}: los cursos enseñan esas tácticas, y el chat no las aconseja`);
    assert.ok(c.includes(a.curso), `${a.id}: no dice de qué curso sale`);
    assert.equal(inspiradoEn(a), `Inspirado en ${a.completo}`);
  }
  assert.equal(contextoDeReferente(null), '');
  const sinFrente = contextoDelFunnelCoach(null);
  assert.match(sinFrente, /calcular_presupuesto_anuncios/, 'la calculadora es su herramienta');
  assert.match(sinFrente, /guardar_plan_funnel/, 'un plan sólo escrito en el chat no existe');
  assert.match(sinFrente, /No eres ninguno de ellos/);
  // Sin referente al frente (eligió «MaKo»): una ficha por tema que trabaja, la oferta incluida (4/11/2026).
  assert.ok(sinFrente.includes(FICHAS.hormozi) && sinFrente.includes(FICHAS['juan-ads']) && sinFrente.includes(FICHAS['julian-otalora']));
  assert.ok(sinFrente.length < 18_500, 'cada ficha son 5.000 caracteres en el system: sumar a todas lo infla');
  // EL TERCER ESTADO (14/11/2026, lib/asesores/candado.ts): el coach de un Essential. NO es lo mismo que elegir «MaKo» —elegir MaKo
  // paga Pro y conserva los marcos—: con el candado no viaja la metodología de NADIE, y se le dice que no nombre ni atribuya a
  // nadie, porque el modelo los conoce de antes y si no atribuye de memoria (una cita inventada Y la función de Pro, regalada).
  const conCandado = contextoDelFunnelCoach('hormozi', true);
  for (const id of ['hormozi', 'juan-ads', 'julian-otalora'] as const) assert.ok(!conCandado.includes(FICHAS[id]), `${id}: su ficha no viaja`);
  assert.doesNotMatch(conCandado, /ATRIBUYE SIEMPRE|EL REFERENTE DE ESTE CHAT|MARCOS DE /, 'ni su bloque de atribución');
  assert.match(conCandado, /NO nombras a ninguno/, 'y se le dice que no los nombre de memoria');
  assert.match(conCandado, /el chat con los referentes y su método está en MaKo Pro/, 'si se lo piden, lo dice sin fingir que lo tiene');
  assert.ok(conCandado.includes('calcular_presupuesto_anuncios') && conCandado.includes('guardar_plan_funnel') && /manda sobre la voz del teléfono/.test(conCandado),
    'y el coach queda ENTERO: se vende en los tres planes («Tu oferta y tu funnel, revisados con IA»)');
  assert.ok(conCandado.length < sinFrente.length, 'soltar al elegido sin esto daba MÁS método: tres fichas en vez de una');
  assert.ok(ASESORES.length >= 14, 'Martín: «Haz de muchos, no solo de hormozi»');
  for (const a of ['sofia-contreras', 'marcos-razzetti', 'victor-heras']) assert.ok(ASESORES.some((x) => x.id === a), `${a}: lo pidió por nombre`);
  assert.match(sinFrente, /manda sobre la voz del teléfono/, 'sin esto el turno responde en cinco líneas');
});

test('6. lo elegido se sanea: un id que no existe vuelve al de fábrica; elegir MaKo se respeta', () => {
  assert.equal(referenteDelCoach({ coach: 'andrew-tate' }), 'hormozi');
  assert.equal(referenteDelCoach({ offer: 'andrew-tate', funnel: 'nadie' }), 'hormozi');
  assert.equal(referenteDelCoach({ coach: null }), null, 'eligió MaKo');
  assert.equal(referenteDelCoach({ coach: 'juan-ads' }), 'juan-ads');
});

test('7. cada referente tiene su ficha de verdad, sin nada que rompa un template', () => {
  for (const a of ASESORES) {
    const f = FICHAS[a.id];
    assert.ok(f.length > 2_000 && f.length <= 5_200, `${a.id}: ${f.length} caracteres`);
    assert.match(f, /clase:/, `${a.id}: cada marco dice de qué clase sale`);
  }
});

test('8. el plan: sin funnel válido no hay plan, y lo que no se dijo no ocupa una línea', () => {
  assert.equal(sanearPlan({ funnel: 'tiktok' }), null);
  assert.equal(sanearPlan('nada'), null);
  const p = sanearPlan({ funnel: 'anuncios', presupuestoMensual: '1000', creativos: -3, pasos: ['uno', '', 2] }, '2026-11-01');
  assert.ok(p);
  assert.equal(p.presupuestoMensual, 1000);
  assert.equal(p.creativos, null, 'un número negativo no es un dato');
  assert.deepEqual(p.pasos, ['uno']);
  assert.deepEqual(lineasDelPlan(p).map((l) => l.rotulo), ['Funnel', 'Inversión por mes']);
});

test('9. cada referente tiene su imagen aprobada, y el estado del chat sale de afuera de la foto', () => {
  const a = aspectoDeReferente('hormozi');
  assert.equal(aspectoDe('Funnel Coach', a).retrato, 'hormozi');
  assert.equal(sanearAspecto(a)?.retrato, undefined, 'lo guardado no puede pedir un retrato');
  assert.equal(aspectoDe(JEFE_SECOND_BRAIN, a).retrato, undefined, 'el jefe es siempre la estrella');
  for (const r of ASESORES) {
    const f = resolve(RAIZ, 'public/asesores', `${r.id}.png`);
    assert.ok(existsSync(f), `${r.id} no tiene imagen: su fila saldría como un disco vacío`);
    assert.ok(statSync(f).size < 150_000, `${r.id}: una imagen pesada se baja en cada lista de chats`);
  }
  const retratos = leer('app/admin/operaciones/Retratos.tsx');
  // Un PNG no parpadea: si se saca esto, se pierde la señal de que el chat trabaja.
  assert.match(retratos, /animo === 'trabajando' && <circle className="mun-anillo"/);
  assert.match(retratos, /if \(animo === 'dormido'\) return \{ filter:/);
  assert.match(readFileSync(resolve(RAIZ, 'app/admin/operaciones/centro.css'), 'utf8'), /\.mun-anillo \{ animation:/);
  // Las caras que rechazó no quedan en ningún lado.
  assert.doesNotMatch(retratos, /function Ojos|<path/);
});

// docs/funnel-coach.md §8.2: cada herramienta de un coach le compite los 12.000 caracteres a las demás. Hasta el 4/11/2026 entraban por
// relevancia (con una pista delante de cada mensaje); al juntar los dos coaches, `guardar_oferta` no llegaba ni con «guarda esta oferta».
// Desde ese día son FIJAS (`propias`, lib/doer-herramientas.ts): entran primero y DENTRO del presupuesto. Se mide con el turno REAL de la
// app (`clasificarIntencion` + `herramientasDelChat`), con frases de las dos mitades del coach.
// Probado rompiéndolo (4/11/2026), con el archivo en verde, una rotura por vez y restaurada:
//   · `propias` sin descontar su peso del presupuesto (`presupuesto = PRESUPUESTO_REGISTRO_CHARS`)  → cae «nunca pasan de 12.000»
//   · `herramientasDelChat` sin pasar `propias` (el turno las ignora)                                → cae «llegan en cada turno»
//   · en una pregunta, las que escriben sin ir a `ofrecibles`                                        → cae «se ofrecen»
//   · sumar `generar_landing_con_ia` (3.835) a HERRAMIENTAS_DEL_COACH                                → cae el margen
test('11. las herramientas del coach (la oferta y el funnel) llegan en cada turno, dentro del presupuesto y con margen', async (t) => {
  const { charsDeTools } = await import('../lib/api-mako/registro');
  const { PRESUPUESTO_REGISTRO_CHARS, propiasDelChat, escribe } = await import('../lib/doer-herramientas');
  const { clasificarIntencion } = await import('../lib/mako-intencion');
  const { herramientasDelChat } = await import('../lib/mako-turno-app-reglas');
  const vista = { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null } as const;
  // Las seis existen y la vista de un admin las puede pedir: una que desaparece del registro falla acá, no en silencio.
  const todas = propiasDelChat(HERRAMIENTAS_DEL_COACH, vista);
  assert.deepEqual(todas.map((x) => x.name), [...HERRAMIENTAS_DEL_COACH]);
  const pesoTodas = charsDeTools(todas);
  t.diagnostic(`las seis pesan ${pesoTodas}; quedan ${PRESUPUESTO_REGISTRO_CHARS - pesoTodas} para lo demás`);
  assert.ok(PRESUPUESTO_REGISTRO_CHARS - pesoTodas >= 4_000, `quedan ${PRESUPUESTO_REGISTRO_CHARS - pesoTodas}: el coach no podría hacer nada más que lo suyo`);
  const frases = [
    'Tengo 1000 dólares por mes para anuncios', '¿qué funnel me conviene?', 'guarda el plan', 'quiero mejorar mi oferta',
    'vendo una mentoría de 3 meses a 1500 dólares para coaches', '¿qué le falta a mi oferta?', 'guarda esta oferta',
    'ayúdame a armar mi oferta', '1000 dólares', 'crea una landing para mi oferta',
  ];
  for (const texto of frases) {
    const veredicto = clasificarIntencion(texto, { canal: 'app' });
    const r = herramientasDelChat({ veredicto, texto, agendaAbierta: false, deSiempre: [], vista, hayPendientes: false, propias: HERRAMIENTAS_DEL_COACH });
    const nombres = r.tools.map((x) => x.name);
    const ofrece = veredicto.intencion === 'consultar' || veredicto.intencion === 'pensar';
    for (const id of HERRAMIENTAS_DEL_COACH) {
      if (ofrece && escribe(id)) assert.ok(r.ofrecibles?.includes(id), `«${texto}» (${veredicto.intencion}): ${id} no se ofrece`);
      else assert.ok(nombres.includes(id), `«${texto}» (${veredicto.intencion}): ${id} no llegó`);
    }
  }
});

// Lo que nunca pasa de 12.000, medido donde se decide (herramientasDelTurno), sin las lecturas que agrega el chat de la app.
test('11b. las propias más lo que elige el registro nunca pasan de 12.000', async () => {
  const { charsDeTools } = await import('../lib/api-mako/registro');
  const { PRESUPUESTO_REGISTRO_CHARS, herramientasDelTurno } = await import('../lib/doer-herramientas');
  const { clasificarIntencion } = await import('../lib/mako-intencion');
  const vista = { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null } as const;
  for (const texto of ['guarda esta oferta', 'crea una landing para mi oferta', 'crea la campaña en Meta con ese presupuesto', '¿qué funnel me conviene?']) {
    const veredicto = clasificarIntencion(texto, { canal: 'app' });
    const r = herramientasDelTurno({ veredicto, texto, agendaAbierta: false, deSiempre: [], vista, hayPendientes: false, propias: HERRAMIENTAS_DEL_COACH });
    const propias = r.tools.filter((x) => HERRAMIENTAS_DEL_COACH.includes(x.name));
    const total = charsDeTools(propias as Parameters<typeof charsDeTools>[0]) + charsDeTools(r.delRegistro);
    assert.ok(total <= PRESUPUESTO_REGISTRO_CHARS, `«${texto}»: ${total} caracteres`);
    assert.ok(!r.delRegistro.some((d) => HERRAMIENTAS_DEL_COACH.includes(d.name)), 'ninguna viaja dos veces');
  }
  // Sin `propias`, el turno de siempre: nada cambia para los demás chats.
  const v = clasificarIntencion('guarda esta oferta', { canal: 'app' });
  const sin = herramientasDelTurno({ veredicto: v, texto: 'guarda esta oferta', agendaAbierta: false, deSiempre: [], vista, hayPendientes: false });
  assert.ok(charsDeTools(sin.delRegistro) <= PRESUPUESTO_REGISTRO_CHARS);
});

test('10. la ruta usa el contexto del coach sólo desde su chat, y sólo el admin cambia quién lo aconseja', () => {
  const r = leer('app/api/mako/chat/route.ts');
  assert.match(r, /const tab = desde\?\.tab;\n\s*if \(tab !== ORIGEN_FUNNEL_COACH && tab !== ORIGEN_OFFER_COACH\) return \{ contexto: CONTEXTO_SECOND_BRAIN \}/);
  // Los dos caminos de la ruta, JSON y con archivos: un adjunto no le saca el contexto ni sus herramientas.
  assert.equal((r.match(/contexto: delChat\.contexto, referente: delChat\.referente, propias: delChat\.propias/g) ?? []).length, 2);
  // `sinReferentes` desde el 14/11/2026 (lib/asesores/candado.ts): con el candado, el coach corre sin la metodología de nadie.
  assert.match(r, /return \{ contexto: `\$\{contextoDelFunnelCoach\(referente, sinReferentes\)\}\\n\\n\$\{ofertaParaElContexto\(oferta\)\}`, referente, propias: HERRAMIENTAS_DEL_COACH \};/);
  assert.match(r, /const sinReferentes = \(await candadoDeReferentesDe\(quien\.ws\)\) != null;\s*\n\s*const referente = sinReferentes \? null : elegido;/, 'y el referente no viaja: el Second Brain colgaría su curso');
  assert.doesNotMatch(r, /contexto: CONTEXTO_SECOND_BRAIN, guardarAdjuntos/);
  assert.match(r, /if \(persona\.rol !== 'admin'\) return json\(\{ ok: false, error: 'Lo cambia quien administra el negocio\.' \}, 403\);/);
});

// ── El coach único (4/11/2026) ────────────────────────────────────────────────────────────────────────────────────────────────
// Probado rompiéndolo, una rotura por vez y restaurada:
//   · `referenteDelCoach` sin la rama de `funnel` (el Offer Coach gana siempre)          → cae 12 «gana el del Funnel Coach»
//   · `referenteDelCoach` que trata `offer: null` como «no eligió»                      → cae 12 «eligió MaKo en el Offer Coach»
//   · `conReferenteElegido` que guarda sólo `{ coach }`                                   → cae 12 «lo de antes queda»
//   · `ofertaDelCoach` con `armada` ignorada                                             → cae 13
//   Ticket #57 (4/11/2026, base 17 / 0, Node 24; restaurado y comprobado con sha256), cada uno 16 / 1:
//   · «no pude leer» cuenta como «no hay» · la del perfil como guardada · el saludo de antes («ya está cargada»)
//   · la armada leída de la PRIMERA versión · la ruta con `.catch(() => [])` · saluda antes de saber      → cae 13
//   · el contexto del coach sin `ofertaParaElContexto`                                                     → cae 10
//   · una cadena «Offer Coach» en un texto de app/                                       → cae 14
//   · `ChatClienteM` sin la fila del coach                                               → cae 15
//   · la ruta de Offer leyendo `.offer` de lo guardado                                   → cae 16

test('12. quien ya eligió no pierde su elección: gana el del Funnel Coach, si no el del Offer Coach, si no Hormozi', () => {
  // Lo que guardaba cada elección hasta el 4/11: los DOS coaches, el otro con su fábrica (funnel: null, offer: 'hormozi').
  assert.equal(referenteDelCoach({ funnel: 'juan-ads', offer: 'hormozi' }), 'juan-ads', 'eligió en el Funnel Coach: gana esa');
  assert.equal(referenteDelCoach({ funnel: 'juan-ads', offer: 'agustin-nievas' }), 'juan-ads', 'eligió en los dos: gana el del Funnel Coach');
  assert.equal(referenteDelCoach({ funnel: null, offer: 'agustin-nievas' }), 'agustin-nievas', 'sólo eligió en el Offer Coach: se usa esa');
  assert.equal(referenteDelCoach({ funnel: null, offer: null }), null, 'eligió MaKo en el Offer Coach (su fábrica era Hormozi)');
  assert.equal(referenteDelCoach({ funnel: 'juan-ads', offer: null }), 'juan-ads');
  assert.equal(referenteDelCoach({ funnel: null }), null, 'sólo `funnel: null`: eligió MaKo en el Funnel Coach');
  // El caso que no se puede distinguir (lib/asesores/catalogo.ts): sale Hormozi, que no pisa una elección de Hormozi.
  assert.equal(referenteDelCoach({ funnel: null, offer: 'hormozi' }), 'hormozi');
  // Lo nuevo manda sobre lo de antes, y lo de antes queda al lado (un deploy vuelto atrás sigue con lo suyo).
  const guardado = conReferenteElegido({ funnel: 'juan-ads', offer: 'hormozi' }, 'tino-mossu');
  assert.deepEqual(guardado, { funnel: 'juan-ads', offer: 'hormozi', coach: 'tino-mossu' }, 'lo de antes queda');
  assert.equal(referenteDelCoach(guardado), 'tino-mossu');
  assert.equal(referenteDelCoach(conReferenteElegido({ funnel: 'juan-ads' }, null)), null, 'elegir MaKo se respeta');
  assert.deepEqual(conReferenteElegido(null, 'nadie' as never), { coach: null });
  // Lo que pide el navegador: lo nuevo y lo de una pestaña abierta antes del cambio; un id que no existe no se guarda.
  assert.deepEqual(referentePedido({ referente: 'hormozi' }), { id: 'hormozi' });
  assert.deepEqual(referentePedido({ referente: null }), { id: null });
  assert.deepEqual(referentePedido({ referentes: { offer: 'tino-mossu' } }), { id: 'tino-mossu' });
  assert.deepEqual(referentePedido({ referentes: { funnel: null } }), { id: null });
  assert.equal(referentePedido({ referente: 'andrew-tate' }), null);
  assert.equal(referentePedido({}), null);
  // Guarda leyendo ESTRICTO: escribe la fila entera, y una lectura tolerante con la base caída borraría lo de antes.
  const db = leer('lib/funnel-plan-db.ts');
  assert.match(db, /conReferenteElegido\(json\(await getSettingEstricto\(CLAVE_REFERENTES\)\), id\)/);
});

test('13. quien armó la oferta en una conversación de oferta no vuelve a empezar, y el saludo dice CUÁL usa (ticket #57)', () => {
  // Martín, en el ws 9, leyó «Tu oferta ya está cargada» y lo reportó: hasta el 4/11 «no pude leer» contaba como «hay», y el saludo
  // no decía cuál. Ahora: tres estados, y con una oferta, un renglón con su nombre y de dónde salió, para corregirla antes de seguir.
  const PRESUPUESTO = /¿Cuánto puedes invertir por mes para conseguir clientes\?$/;
  const CAMBIAR = /Si no es esa, dime cuál\./;
  // Sin oferta: se empieza por armarla, ahí mismo.
  const ninguna = ofertaDelCoach([], null);
  assert.deepEqual(ninguna, { estado: 'no-hay' });
  assert.equal(saludoDelFunnelCoach(ninguna), 'Empecemos por tu oferta: ¿qué vendes, a quién y a qué precio?');
  assert.doesNotMatch(saludoDelFunnelCoach(ninguna), /Coach|vuelve con ella/, 'la oferta se trabaja ahí mismo, sin mandar a otro chat');
  // La base no contestó: no se afirma ni que hay ni que falta (lo que pasó en el ws 9 si la lectura falló).
  for (const [g, a] of [['no-se', null], [[], 'no-se'], ['no-se', 'no-se']] as const) {
    const o = ofertaDelCoach(g, a);
    assert.deepEqual(o, { estado: 'no-se' }, `${JSON.stringify(g)} / ${JSON.stringify(a)}`);
    assert.doesNotMatch(saludoDelFunnelCoach(o), /cargada|Voy a usar/, 'sin leerla no se dice que hay una');
    assert.match(saludoDelFunnelCoach(o), /^Empecemos por tu oferta: .*Si ya tienes una guardada, dime cuál/);
  }
  // Una guardada: su nombre; lo que sí se leyó manda aunque lo otro fallara.
  const guardada = ofertaDelCoach([{ nombre: 'Mentoría 1:1', desde_brief: false }, { nombre: 'Taller', desde_brief: false }], 'no-se');
  assert.deepEqual(guardada, { estado: 'hay', nombre: 'Mentoría 1:1', de: 'guardada', conversacion: null }, 'la primera: la principal');
  assert.match(saludoDelFunnelCoach(guardada), /^Voy a usar tu oferta «Mentoría 1:1»\. Si no es esa, dime cuál\.\n\n/);
  assert.match(saludoDelFunnelCoach(guardada), PRESUPUESTO);
  // La sembrada con el nombre del onboarding: se dice que sale del perfil, no que «está cargada».
  const perfil = ofertaDelCoach([{ nombre: 'MaKo', desde_brief: true }], null);
  assert.equal(perfil.estado === 'hay' && perfil.de, 'perfil');
  assert.match(saludoDelFunnelCoach(perfil), /^Voy a usar «MaKo», la oferta de tu perfil del negocio\./);
  assert.match(saludoDelFunnelCoach(perfil), CAMBIAR);
  // Una sin nombre no sirve para nombrarla: se sigue buscando.
  assert.deepEqual(ofertaDelCoach([{ nombre: '  ', desde_brief: false }], null), { estado: 'no-hay' });
  // La armada en una conversación de oferta y sin guardar: su nombre y el de la conversación.
  const armada = ofertaDelCoach([], { nombre: 'Sprint de ventas', conversacion: 'Mi oferta' });
  assert.deepEqual(armada, { estado: 'hay', nombre: 'Sprint de ventas', de: 'conversacion', conversacion: 'Mi oferta' });
  assert.match(saludoDelFunnelCoach(armada), /^Voy a usar «Sprint de ventas», la oferta que armaste en la conversación «Mi oferta» y todavía no guardaste\./);
  assert.match(saludoDelFunnelCoach(armada), PRESUPUESTO);
  // Sin nombre en la propuesta, la conversación la nombra; y la lectura de la armada (la última versión, con su cálculo).
  assert.match(saludoDelFunnelCoach(ofertaDelCoach([], { nombre: '', conversacion: 'Mi programa' })), /^Voy a usar «Mi programa», la oferta que armaste y todavía no guardaste\./);
  const version = (v: number, total: unknown, nombre: unknown) => ({ diagnostico: {}, calculo: { total }, propuesta: { nombre }, version: v });
  assert.equal(ofertaArmadaDe([]), null);
  assert.deepEqual(ofertaArmadaDe([version(1, 30, 'Vieja'), version(2, 41, ' Sprint ')]), { nombre: 'Sprint' }, 'la última versión');
  assert.equal(ofertaArmadaDe([version(1, null, 'Sin cálculo')]), null, 'sin cálculo no se armó');
  assert.equal(ofertaArmadaDe('nada'), null);
  // Lo que llega a la pantalla se lee sin confiar en la forma, y el renglón de la fila no afirma lo que no se sabe.
  assert.deepEqual(sanearOfertaDelCoach(JSON.parse(JSON.stringify(armada))), armada);
  assert.deepEqual(sanearOfertaDelCoach({ estado: 'hay', nombre: '', de: 'guardada' }), { estado: 'no-se' });
  assert.deepEqual(sanearOfertaDelCoach(undefined), { estado: 'no-se' }, 'si el pedido falló');
  assert.equal(previaDelCoach({ estado: 'no-hay' }), 'Empieza por tu oferta');
  assert.equal(previaDelCoach({ estado: 'no-se' }), 'Tu oferta y cómo conseguir clientes');
  assert.equal(previaDelCoach(null), 'Tu oferta y cómo conseguir clientes');
  // El modelo sabe con qué oferta abrió (el saludo no se guarda en el hilo): a «no, es la otra» sabe de cuál le hablan.
  assert.ok(ofertaParaElContexto(guardada).includes('«Voy a usar tu oferta «Mentoría 1:1». Si no es esa, dime cuál.»'));
  assert.match(ofertaParaElContexto({ estado: 'no-se' }), /Antes de dar una por cargada, míralas con listar_ofertas/);
  // La ruta: la MISMA lectura para el saludo y el contexto, y una lectura que falla es «no se sabe».
  const r = leer('app/api/mako/chat/route.ts');
  assert.match(r, /listarOfertas\(true\)\.catch\(\(\) => 'no-se' as const\)/);
  assert.match(r, /ofertaArmada\(\)\.catch\(\(\) => 'no-se' as const\)/);
  assert.match(r, /return ofertaDelCoach\(guardadas, armada\);/);
  assert.match(r, /return json\(\{ ok: true, referente, oferta, puedeElegir: persona\.rol === 'admin', dosCoaches \}\);/);
  assert.match(r, /Promise\.all\(\[leerReferente\(\), laOfertaDelCoach\(\)\]\)/);
  // Y la pantalla espera a saber antes de saludar: abría diciendo que no había y medio segundo después que sí.
  const motor = leer('app/second-brain/useChatDelCoach.ts');
  assert.match(motor, /const vacio = !motorOffer && elegido != null && oferta != null && k\.cargado/);
  // Y el contexto: primero la oferta, mirando lo guardado y lo armado, y después el funnel.
  const c = contextoDelFunnelCoach('hormozi');
  assert.ok(c.indexOf('1. LA OFERTA') >= 0 && c.indexOf('1. LA OFERTA') < c.indexOf('2. ELEGIR EL FUNNEL'), 'la oferta va primero');
  for (const h of HERRAMIENTAS_DEL_COACH) assert.ok(c.includes(h), `el contexto no nombra ${h}`);
  assert.doesNotMatch(c, /Offer Coach/, 'no manda a un chat que ya no existe');
  assert.ok(c.includes(FICHAS.hormozi), 'con Hormozi al frente, su ficha');
});

// Hasta el 18/11/2026 este test frenaba «Offer Coach» en TODO app/ y lib/ (el coach único del 4/11). Desde que Martín los separó
// (15/11: «Oferta y Funnel Coach en DOS chats separados»), vuelve SÓLO detrás del interruptor del onboarding V2: en el texto, nada más
// que en los archivos de abajo (cada uno sólo del V2 o con su puerta), y en las pantallas, nombrado con ORIGEN_OFFER_COACH y sólo con
// `dosCoaches`. Quien no ve el V2 sigue con el coach único: sus textos no lo nombran (abajo) ni le abren su chat (la 19).
test('14. «Offer Coach» sólo detrás del interruptor del onboarding V2', () => {
  const lista = delRepo();
  assert.ok(lista.length > 500, `miró ${lista.length} archivos`);
  const con: string[] = [];
  const nombran: string[] = [];
  for (const f of lista) {
    let src: string;
    try { src = readFileSync(resolve(RAIZ, f), 'utf8'); } catch { continue; }
    const sin = sinComentarios(src);
    if (/offer coach/i.test(sin)) con.push(f);
    if (f.startsWith('app/') && /ORIGEN_OFFER_COACH|TAB_OFFER_COACH|cual="offer"|'offer-coach'|"offer-coach"/.test(sin)) nombran.push(f);
  }
  // El texto: su nombre (lib/chat-mako-reglas.ts), los contextos y los saludos del V2, y el reto (que es del V2).
  assert.deepEqual(con.sort(), ['lib/asesores/contexto.ts', 'lib/chat-mako-reglas.ts', 'lib/funnel-plan.ts', 'lib/reto/dias.ts'],
    'un «Offer Coach» escrito en otro lado es una segunda puerta: va con ORIGEN_OFFER_COACH y detrás de `dosCoaches`');
  // Las pantallas y la ruta que lo nombran: cada una con su puerta, medida abajo y en la 19. Una nueva falla acá: hay que decidirla.
  assert.deepEqual(nombran.sort(), [
    'app/api/mako/chat/route.ts', 'app/m/operaciones/ChatsMovil.tsx', 'app/m/second-brain/ChatClienteM.tsx', 'app/second-brain/ChatSecondBrain.tsx',
    'app/second-brain/VideoDelCoach.tsx', 'app/second-brain/useChatDelCoach.ts',
  ]);
  assert.doesNotMatch(leer('lib/chat-mako-reglas.ts'), /queAbreElOfferCoach/, 'la fila que abría un gurú o una conversación de Offer no vuelve');
  // Lo del coach único NO lo nombra: ni su contexto (con cualquier referente y con el candado), ni su saludo, ni su renglón.
  const ofertas: OfertaDelCoach[] = [
    { estado: 'no-hay' }, { estado: 'no-se' }, { estado: 'hay', nombre: 'Mentoría', de: 'guardada', conversacion: null },
    { estado: 'hay', nombre: 'MaKo', de: 'perfil', conversacion: null }, { estado: 'hay', nombre: 'Sprint', de: 'conversacion', conversacion: 'Mi oferta' },
  ];
  for (const id of [null, ...ASESORES.map((a) => a.id)]) for (const candado of [false, true]) assert.doesNotMatch(contextoDelFunnelCoach(id, candado), /Offer Coach/i, `${id} ${candado}`);
  for (const o of ofertas) {
    for (const t of [saludoDelFunnelCoach(o), previaDelCoach(o), ofertaParaElContexto(o)]) assert.doesNotMatch(t, /Offer Coach/i, JSON.stringify(o));
  }
  // Las puertas de las pantallas (la ruta, en la 19).
  const sb = leer('app/second-brain/ChatSecondBrain.tsx');
  assert.match(sb, /\{verCoach && dosCoaches && \(\n\s*<>\n\s*<div className="co-jefe">\n\s*<FilaDeChat titulo=\{ORIGEN_OFFER_COACH\}/, 'la fila del Offer Coach, sólo con los dos');
  assert.match(sb, /\{offerAbierto && dosCoaches && \(\n\s*<div style=\{\{ display: verOffer \? 'contents' : 'none' \}\}>\n\s*<ChatDelCoach cual="offer"/, 'su chat, sólo con los dos');
  assert.match(sb, /const verOffer = verCoachElegido && coachElegido === 'offer' && dosCoaches;/);
  assert.match(sb, /const coachDeEntrada: CoachDelOps \| null = coachInicial === 'offer' && !dosCoaches \? 'funnel' : coachInicial;/, '?coach=offer sin los dos es el coach único');
  assert.equal((sb.match(/ORIGEN_OFFER_COACH/g) ?? []).length, 3, 'el import, su fila y el título de elegir quién aconseja (`dosCoaches ?`)');
  assert.match(sb, /<ElegirReferente titulo=\{dosCoaches \? ORIGEN_OFFER_COACH : ORIGEN_FUNNEL_COACH\}/);
  for (const f of ['app/m/second-brain/ChatClienteM.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    const m = leer(f);
    assert.match(m, /<HojaDelCoach key=\{conCoach\} cual=\{dosCoaches \? conCoach : 'funnel'\} dosCoaches=\{!!dosCoaches\}/, `${f}: la hoja del Offer Coach, sólo con los dos`);
    // Cada ORIGEN_OFFER_COACH (salvo el import) va adentro del bloque `dosCoaches && (` … `)}`, y el bloque del coach único con `!dosCoaches`.
    const bloque = /\{(?:verCoach|!parte) && dosCoaches && \(\n[\s\S]*?\n\s{10,12}\)\}/.exec(m)?.[0] ?? '';
    assert.ok(bloque.includes('ORIGEN_OFFER_COACH'), `${f}: el bloque de los dos coaches`);
    assert.equal((m.match(/ORIGEN_OFFER_COACH/g) ?? []).length - 1, (bloque.match(/ORIGEN_OFFER_COACH/g) ?? []).length, `${f}: un Offer Coach fuera de su puerta`);
    assert.match(m, /\{(?:verCoach|!parte) && !dosCoaches && /, `${f}: el coach único, sin los dos`);
  }
});

test('15. en el teléfono, el mismo coach que en la computadora (o los dos, con el V2), para el cliente y el super admin', () => {
  const m = leer('app/m/second-brain/ChatClienteM.tsx');
  assert.match(m, /const verCoach = hrefMapa != null \|\| puedeElegir;/);
  assert.match(m, /titulo=\{<span className="m-operaciones-texto1">\{ORIGEN_FUNNEL_COACH\}<\/span>\}/);
  assert.match(m, /\{filasOffer\.map\(\(f\) => fila\(f, true\)\)\}/, 'las conversaciones de oferta cuelgan del coach');
  assert.match(m, /const resto = verCoach \? todasLasFilas\.filter\(\(f\) => f\.origen !== 'offer'\) : todasLasFilas;/, 'sin la fila del coach, siguen en la lista');
  assert.match(m, /<HojaDelCoach key=\{conCoach\} cual=\{dosCoaches \? conCoach : 'funnel'\} dosCoaches=\{!!dosCoaches\} referente=\{referente\}/);
  const sa = leer('app/m/operaciones/ChatsMovil.tsx');
  assert.match(sa, /titulo=\{<span className="m-operaciones-texto1">\{ORIGEN_FUNNEL_COACH\}<\/span>\}/);
  assert.match(sa, /<HojaDelCoach key=\{conCoach\} cual=\{dosCoaches \? conCoach : 'funnel'\} dosCoaches=\{!!dosCoaches\} referente=\{referente\}/);
  const h = leer('app/m/second-brain/HojaDelCoach.tsx');
  assert.match(h, /useChatDelCoach\(\{ referente, oferta, caja, cual, dosCoaches \}\)/, 'el motor de la computadora');
  assert.match(h, /onClick=\{\(\) => \{ onReferente\(id\); setVista\(null\); \}\}/, 'se elige quién aconseja adentro de la hoja');
  assert.match(leer('app/second-brain/ChatDelCoach.tsx'), /useChatDelCoach\(\{ referente, oferta, caja, cual, dosCoaches \}\)/);
});

test('16. las conversaciones de oferta aconsejan con el MISMO referente que el coach del que cuelgan', () => {
  const o = leer('app/api/offer/route.ts');
  // Con el onboarding V2 (19/11/2026), el del OFFER COACH (el de oferta, o Hormozi): la misma cara que su chat.
  assert.match(o, /const elegido = await leerReferente\(\);/);
  assert.match(o, /const id = wsV2 != null && \(await conDosCoaches\(wsV2\)\) \? referenteDelOfferCoachV2\(elegido\) : elegido;/);
  assert.doesNotMatch(o, /leerReferentes\(\)\)\.offer/);
  const sb = leer('app/second-brain/ChatSecondBrain.tsx');
  assert.match(sb, /aspectoOffer: delCoach \? aspectoDeReferente\(delCoach\.id\) : null/, 'su cara en la lista y en el hilo');
});

// ── LOS DOS COACHES DEL ONBOARDING V2 (18/11/2026) ────────────────────────────────────────────────────────────────────────────────
// Martín, 15/11 (DESPUÉS de juntarlos el 4/11): «al terminar el onboarding, Oferta y Funnel Coach en DOS chats separados». El Offer
// Coach arma la oferta y le deja el diagnóstico; el Funnel Coach viene después, con la oferta hecha. SÓLO con el interruptor
// (lib/onboarding-v2/revision.ts); quien no lo ve, el coach único de arriba (1-16), sin un carácter cambiado (su contexto, medido con
// sha256 antes y después de separar las piezas).
// Probado rompiéndolo (18/11/2026), con el archivo en 22 / 0, una rotura por vez y restaurada (comprobado con sha256), cada una 21 / 1
// salvo la de la hoja (20 / 2):
//   · el Funnel Coach del V2 con `guardar_oferta` (sin el filtro)                     → cae 18
//   · el contexto del Funnel Coach del V2 con la fase «1. LA OFERTA» del coach único   → cae 17
//   · la ruta sin `if (await veDosCoaches(quien.ws))` (los dos contextos para todos)  → cae 19
//   · la fila del Offer Coach sin `dosCoaches &&` (ChatSecondBrain.tsx)               → cae 14
//   · la hoja del teléfono con `cual={conCoach}` (sin la puerta)                      → caen 14 y 15
//   · `listaDelCliente` sin sacar la conversación del Offer Coach                     → cae 21
//   · el saludo del Offer Coach que da por armada la oferta del perfil                → cae 20

test('17. cada coach del V2 hace lo suyo y manda al otro sin armarlo', () => {
  const offer = contextoDelOfferCoach('hormozi');
  const funnel = contextoDelFunnelCoachV2();
  for (const c of [offer, funnel, contextoDelOfferCoach(null), contextoDelOfferCoach('hormozi', true), contextoDelFunnelCoachV2(true)]) {
    assert.match(c, /manda sobre la voz del teléfono/, 'sin esto el turno responde en cinco líneas');
  }
  // El Offer Coach: la oferta, con su diagnóstico y guardada; el funnel no es suyo, y lo manda al Funnel Coach, que está debajo.
  assert.match(offer, /^EN ESTE CHAT \(el Offer Coach de MaKo/);
  assert.match(offer, /EL DIAGNÓSTICO: .*una nota de 0 a 100/);
  for (const d of ['cliente ideal', 'promesa', 'certeza', 'precio y cobro', 'foco']) assert.ok(offer.includes(d), `el diagnóstico mira ${d}, como la rúbrica de Offer`);
  assert.match(offer, /guardar_oferta/);
  assert.match(offer, /el Funnel Coach, el chat que está debajo de éste en su lista/);
  assert.doesNotMatch(offer, /calcular_presupuesto_anuncios|guardar_plan_funnel|ELEGIR EL FUNNEL/, 'el funnel no se arma en el Offer Coach');
  assert.ok(offer.includes(FICHAS.hormozi), 'con Hormozi al frente, su ficha');
  // Sin referente al frente (eligió MaKo): los marcos de la oferta, no los del funnel.
  const offerMaKo = contextoDelOfferCoach(null);
  assert.ok(offerMaKo.includes(FICHAS.hormozi) && !offerMaKo.includes(FICHAS['juan-ads']) && !offerMaKo.includes(FICHAS['julian-otalora']));
  // El Funnel Coach del V2: el funnel con la oferta hecha, sin la fase de la oferta, y sin armarla: la manda al Offer Coach.
  assert.match(funnel, /^EN ESTE CHAT \(el Funnel Coach de MaKo/);
  assert.doesNotMatch(funnel, /1\. LA OFERTA|guardar_oferta/, 'la oferta no se arma en el Funnel Coach del V2');
  assert.match(funnel, /La oferta NO se arma ni se cambia aquí/);
  assert.match(funnel, /el Offer Coach, el chat que está arriba de éste en su lista/);
  for (const h of ['calcular_presupuesto_anuncios', 'guardar_plan_funnel', 'ver_plan_funnel', 'listar_ofertas']) assert.ok(funnel.includes(h), h);
  assert.ok(funnel.indexOf('1. ELEGIR EL FUNNEL') < funnel.indexOf('2. PLANEAR') && funnel.indexOf('2. PLANEAR') < funnel.indexOf('3. GUARDAR'));
  // Sin referente al frente (su propia criatura): los marcos de anuncios y orgánico, atribuidos.
  assert.ok(funnel.includes(FICHAS['juan-ads']) && funnel.includes(FICHAS['julian-otalora']) && !funnel.includes(FICHAS.hormozi));
  assert.match(funnel, /No eres ninguno de ellos/);
  // El candado (Essential): la metodología de nadie, en los dos.
  for (const c of [contextoDelOfferCoach('hormozi', true), contextoDelFunnelCoachV2(true)]) {
    for (const id of ['hormozi', 'juan-ads', 'julian-otalora'] as const) assert.ok(!c.includes(FICHAS[id]), `${id}: su ficha no viaja`);
    assert.match(c, /NO nombras a ninguno/);
  }
  // Y pesan menos que el coach único con los tres marcos.
  assert.ok(funnel.length < contextoDelFunnelCoach(null).length && offerMaKo.length < contextoDelFunnelCoach(null).length);
});

test('18. las herramientas de cada coach del V2 salen de las seis, llegan en cada turno y el Funnel Coach no guarda ofertas', async () => {
  assert.deepEqual([...HERRAMIENTAS_DEL_OFFER_COACH], ['listar_ofertas', 'ver_analisis_oferta', 'guardar_oferta']);
  // 18/11, el Cerebro: «queda en tu CRM, con sus etapas» tiene que ser verdad. El Funnel Coach del V2 suma tipos_de_crm y crear_crm.
  assert.deepEqual([...HERRAMIENTAS_DEL_FUNNEL_COACH_V2], ['listar_ofertas', 'ver_analisis_oferta', 'calcular_presupuesto_anuncios', 'ver_plan_funnel', 'guardar_plan_funnel', 'tipos_de_crm', 'crear_crm']);
  for (const h of HERRAMIENTAS_DEL_OFFER_COACH) assert.ok(HERRAMIENTAS_DEL_COACH.includes(h), `${h}: fuera de las seis, el margen de la 11 no lo cubre`);
  // Las dos del CRM no están en las seis: su peso se mide acá, con el mismo margen que la 11 (al menos 4.000 para lo demás).
  {
    const { charsDeTools } = await import('../lib/api-mako/registro');
    const { PRESUPUESTO_REGISTRO_CHARS, propiasDelChat } = await import('../lib/doer-herramientas');
    const v = { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null } as const;
    const del = propiasDelChat(HERRAMIENTAS_DEL_FUNNEL_COACH_V2, v);
    assert.deepEqual(del.map((x) => x.name), [...HERRAMIENTAS_DEL_FUNNEL_COACH_V2], 'todas existen y un admin las puede pedir');
    const peso = charsDeTools(del);
    assert.ok(PRESUPUESTO_REGISTRO_CHARS - peso >= 4_000, `el Funnel Coach del V2 pesa ${peso}: quedan ${PRESUPUESTO_REGISTRO_CHARS - peso} para lo demás`);
  }
  const { herramientasDelChat } = await import('../lib/mako-turno-app-reglas');
  const { clasificarIntencion } = await import('../lib/mako-intencion');
  const { escribe } = await import('../lib/doer-herramientas');
  const vista = { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null } as const;
  const casos: Array<[readonly string[], string[]]> = [
    [HERRAMIENTAS_DEL_OFFER_COACH, ['guarda esta oferta', 'ayúdame a armar mi oferta', '¿qué le falta a mi oferta?', 'vendo una mentoría de 3 meses a 1500 dólares para coaches']],
    [HERRAMIENTAS_DEL_FUNNEL_COACH_V2, ['Tengo 1000 dólares por mes para anuncios', '¿qué funnel me conviene?', 'guarda el plan', '1000 dólares', 'crea una landing para mi oferta']],
  ];
  for (const [propias, frases] of casos) {
    for (const texto of frases) {
      const veredicto = clasificarIntencion(texto, { canal: 'app' });
      const r = herramientasDelChat({ veredicto, texto, agendaAbierta: false, deSiempre: [], vista, hayPendientes: false, propias });
      const ofrece = veredicto.intencion === 'consultar' || veredicto.intencion === 'pensar';
      for (const id of propias) {
        if (ofrece && escribe(id)) assert.ok(r.ofrecibles?.includes(id), `«${texto}»: ${id} no se ofrece`);
        else assert.ok(r.tools.some((x) => x.name === id), `«${texto}» (${veredicto.intencion}): ${id} no llegó`);
      }
    }
  }
});

test('19. el interruptor decide en el servidor: el contexto, la ruta y las pantallas de la computadora', () => {
  const r = leer('app/api/mako/chat/route.ts');
  // El mismo de la página: el email de la sesión y el negocio del chat. Si la sesión no se lee, el coach único.
  assert.match(r, /async function veDosCoaches\(ws: number\): Promise<boolean> \{\n\s*const sesion = await getUsuarioActual\(\)\.catch\(\(\) => null\);\n\s*return !!sesion && veOnboardingV2\(\{ email: sesion\.email, ws \}\);/);
  // Los dos contextos, sólo con el interruptor; sin él, el del coach único, aunque escriba desde una pestaña del Offer Coach.
  assert.match(r, /if \(await veDosCoaches\(quien\.ws\)\) \{\n[^\n]*\n\s*if \(tab === ORIGEN_OFFER_COACH\) \{\n\s*const delOffer = referenteDelOfferCoachV2\(referente\);\n\s*return \{ contexto: `\$\{contextoDelOfferCoach\(delOffer, sinReferentes\)\}\\n\\n\$\{ofertaParaElContextoV2\(oferta, 'offer'\)\}`, referente: delOffer, propias: HERRAMIENTAS_DEL_OFFER_COACH \};/);
  // 18/11, el Cerebro: cada coach del V2 con el referente de SU área (el de adquisición al Funnel Coach, el de oferta al Offer Coach).
  assert.match(r, /return \{ contexto: `\$\{contextoDelFunnelCoachV2\(sinReferentes, delFunnel\)\}\\n\\n\$\{ofertaParaElContextoV2\(oferta, 'funnel'\)\}`, referente: delFunnel, propias: HERRAMIENTAS_DEL_FUNNEL_COACH_V2 \};/);
  assert.equal((r.match(/contextoDelOfferCoach\(|contextoDelFunnelCoachV2\(/g) ?? []).length, 2, 'en ningún otro lado de la ruta');
  // El teléfono lo sabe por la ruta (`dosCoaches`); la computadora, por la página, con la MISMA función.
  assert.match(r, /veDosCoaches\(persona\.ws\),\n\s*\]\);/);
  assert.match(leer('app/second-brain/page.tsx'), /retoV2=\{retoV2\} dosCoaches=\{retoV2\}/, 'el cliente: el mismo interruptor que el reto');
  const ops = leer('app/admin/operaciones/page.tsx');
  assert.match(ops, /const dosCoaches = !!sesion && veOnboardingV2\(\{ email: sesion\.email, ws \}\);/, 'Martín revisa desde su Ops Center: sin esto, su barra y el servidor no decían lo mismo');
  assert.match(ops, /<PantallaSecondBrain [^>]*dosCoaches=\{dosCoaches\} \/>/);
  assert.doesNotMatch(ops, /retoV2/, 'el reto es del cliente: el Ops Center del super admin no lo prende');
  assert.match(leer('app/second-brain/pagina.tsx'), /coachInicial=\{esCoachDelOps\(q\.coach\) \? q\.coach : null\}/);
  // El teléfono: hasta que la ruta contesta, el coach único (null); sólo `true` prende los dos.
  const uc = leer('app/second-brain/useCoaches.ts');
  assert.match(uc, /useState<boolean \| null>\(null\)/);
  assert.match(uc, /setDosCoaches\(j\.dosCoaches === true\);/);
  // El interruptor sigue apagado para todos (lo prende Martín, con UN cambio).
  assert.match(readFileSync(resolve(RAIZ, 'lib/onboarding-v2/revision.ts'), 'utf8'), /export const PARA_TODOS = false;/);
});

test('20. el saludo de cada coach del V2 dice con qué oferta abre, y el que no la tiene la manda a armar al otro', () => {
  const guardada: OfertaDelCoach = { estado: 'hay', nombre: 'Mentoría 1:1', de: 'guardada', conversacion: null };
  const perfil: OfertaDelCoach = { estado: 'hay', nombre: 'MaKo', de: 'perfil', conversacion: null };
  // El Offer Coach: quién aconseja, la oferta que hay (para revisarla) o lo que pide para armarla. La del perfil no la armó nadie.
  assert.match(saludoDelOfferCoach({ estado: 'no-hay' }, 'Alex Hormozi'), /^Soy Offer Coach, inspirado en Alex Hormozi\. .*\n\n¿Tienes un documento de tu oferta, tu guion de ventas o el link de tu web\?/);
  assert.match(saludoDelOfferCoach({ estado: 'no-hay' }, null), /^Soy Offer Coach\. Vamos a armar/, 'sin referente (o con el candado), sin «inspirado en»');
  assert.match(saludoDelOfferCoach(guardada, null), /Voy a usar tu oferta «Mentoría 1:1»\. Si no es esa, dime cuál\.\n\n¿La revisamos juntos\?$/);
  assert.match(saludoDelOfferCoach(perfil, null), /¿Tienes un documento de tu oferta/, 'la del perfil se arma desde el principio');
  assert.match(saludoDelOfferCoach({ estado: 'no-se' }, null), /ahora no pude ver tus ofertas\.$/);
  assert.match(saludoDelOfferCoach({ estado: 'no-hay' }, null), /te dejo su diagnóstico/);
  // El Funnel Coach del V2: con la oferta, cuál y el presupuesto; sin ella, al Offer Coach, por DÓNDE está (nunca un botón).
  assert.match(saludoDelFunnelCoachV2(guardada), /con tu oferta ya hecha\. Voy a usar tu oferta «Mentoría 1:1»\. Si no es esa, dime cuál\.\n\n¿Qué funnel te interesa: anuncios, orgánico, YouTube, .*\? Si no sabes cuál, te ayudo a elegir\.$/);
  // Sin el presupuesto, que el onboarding ya preguntó (docs/hallazgos-ops-center.md, 15/11: «preguntada dos veces»).
  for (const o of [guardada, perfil, { estado: 'no-hay' } as const, { estado: 'no-se' } as const]) assert.doesNotMatch(saludoDelFunnelCoachV2(o), /invertir/);
  assert.match(saludoDelFunnelCoachV2(perfil), /Voy a usar «MaKo», la oferta de tu perfil del negocio\./, 'como el coach único: dice de dónde salió');
  assert.match(saludoDelFunnelCoachV2({ estado: 'no-hay' }), /ármala primero con Offer Coach, el chat que está arriba de éste en tu lista/);
  assert.doesNotMatch(saludoDelFunnelCoachV2({ estado: 'no-hay' }), /qué vendes, a quién/, 'el Funnel Coach del V2 no la arma');
  assert.match(saludoDelFunnelCoachV2({ estado: 'no-se' }), /Si ya armaste una con Offer Coach, dime cuál/);
  // Lo mismo, para el modelo.
  assert.match(ofertaParaElContextoV2({ estado: 'no-hay' }, 'funnel'), /No la armes aquí: .*Offer Coach/);
  assert.match(ofertaParaElContextoV2({ estado: 'no-hay' }, 'offer'), /Empieza por armarla con la persona \(el paso 2\)/);
  assert.match(ofertaParaElContextoV2(perfil, 'offer'), /todavía no tiene una armada/);
  assert.match(ofertaParaElContextoV2(guardada, 'funnel'), /^LA OFERTA CON LA QUE ABRISTE: .*no la vuelvas a armar aquí; si quiere cambiarla, eso es en el Offer Coach\.$/);
  assert.equal(ofertaParaElContextoV2(guardada, 'offer'), ofertaParaElContexto(guardada));
  // Los renglones de las filas.
  assert.equal(previaDelOfferCoach({ estado: 'no-hay' }), 'Empieza por tu oferta');
  assert.equal(previaDelOfferCoach(null), 'Tu oferta, con su diagnóstico');
  assert.equal(PREVIA_DEL_FUNNEL_COACH_V2, 'Tu sistema para conseguir clientes');
  // El motor: el saludo de cada uno, y el plan sólo para el Funnel Coach.
  const motor = leer('app/second-brain/useChatDelCoach.ts');
  assert.match(motor, /cual === 'offer' \? saludoDelOfferCoach\(oferta, r\?\.completo \?\? null\)\n\s*: dosCoaches \? saludoDelFunnelCoachV2\(oferta\) : saludoDelFunnelCoach\(oferta\);/);
  assert.match(motor, /if \(ocupado \|\| cual !== 'funnel'\) return;/);
  assert.match(motor, /const sinReferente = dosCoaches && cual === 'funnel' && !delCoach;/, 'el Funnel Coach del V2: su criatura si no hay referente de adquisición');
});

test('21. el Offer Coach tiene su conversación, fija en su fila, y su video la primera vez', () => {
  assert.ok(TABS_CON_CHAT_PROPIO.includes(TAB_OFFER_COACH));
  assert.equal(TAB_OFFER_COACH, 'offer-coach');
  assert.equal(ORIGEN_OFFER_COACH, 'Offer Coach');
  assert.ok(esCoachDelOps('offer') && esCoachDelOps('funnel') && !esCoachDelOps('hormozi'));
  const clave = `mako-movil:p:${TAB_OFFER_COACH}`;
  assert.equal(origenDeClave(clave), ORIGEN_OFFER_COACH);
  const lista = listaDelCliente({ sesiones: [], offer: [], busca: '', antes: [
    { id: 7, titulo: 'x', updatedAt: '2026-11-01T00:00:00Z', clave },
    { id: 9, titulo: 'z', updatedAt: '2026-11-01T00:00:00Z', clave: `mako-movil:p:${TAB_FUNNEL_COACH}` },
    { id: 8, titulo: 'y', updatedAt: '2026-11-01T00:00:00Z', clave: 'mako-movil:p:crm:4' },
  ] });
  assert.deepEqual(lista.map((f) => f.clave), ['jefe', 'a8'], 'las dos conversaciones de los coaches van en su fila fija, no en el resto');
  // Su video y el del Funnel Coach (las claves acordadas con el chat de los videos), sólo con los dos coaches y con el chat vacío.
  const v = leer('app/second-brain/VideoDelCoach.tsx');
  assert.match(v, /<VideoDelMomento clave="offer-coach" titulo=\{ORIGEN_OFFER_COACH\} revision=\{revision\} \/>/);
  assert.match(v, /<VideoDelMomento clave="funnel-coach" titulo=\{ORIGEN_FUNNEL_COACH\} revision=\{revision\} \/>/);
  assert.match(v, /useVideoTutorial\(dosCoaches \? clave : null\)/);
  assert.match(v, /const conVideo = dosCoaches && \(video != null \|\| revision\);/);
  for (const f of ['app/second-brain/ChatDelCoach.tsx', 'app/m/second-brain/HojaDelCoach.tsx']) {
    const c = leer(f);
    assert.match(c, /const portada = useVideoDelCoach\(cual, dosCoaches, saludo\);/, f);
    assert.match(c, /<HiloMako items=\{portada\.items\} [^\n]*enMensaje=\{(?:dosCoaches \? conVoz\(true, portada\.enMensaje as never\) : )?portada\.enMensaje\}/, `${f}: en la portada (el chat vacío)`);
  }
  // El Funnel Coach del V2 no elige referente (su criatura); el Offer Coach sí.
  assert.match(leer('app/second-brain/ChatDelCoach.tsx'), /const eligeReferente = puedeElegir && !\(dosCoaches && cual === 'funnel'\);/);
  assert.match(leer('app/m/second-brain/HojaDelCoach.tsx'), /const eligeReferente = puedeElegir && !\(dosCoaches && cual === 'funnel'\);/);
});

test('cada coach del V2 con el referente de SU área (el Cerebro, 18/11): Juan ADS nunca al frente del Offer Coach', async () => {
  const { referenteDelOfferCoachV2, referenteDelFunnelCoachV2, areaDeReferente } = await import('../lib/asesores/catalogo');
  assert.equal(areaDeReferente('hormozi'), 'oferta');
  assert.equal(areaDeReferente('juan-ads'), 'adquisicion');
  assert.equal(referenteDelOfferCoachV2('juan-ads'), 'hormozi', 'uno de anuncios no va al Offer Coach: Hormozi de fábrica');
  assert.equal(referenteDelFunnelCoachV2('juan-ads'), 'juan-ads', 'va al Funnel Coach');
  assert.equal(referenteDelOfferCoachV2('hormozi'), 'hormozi');
  assert.equal(referenteDelFunnelCoachV2('hormozi'), null, 'uno de oferta no va al Funnel Coach: su criatura');
  assert.equal(referenteDelOfferCoachV2(null), null, 'eligió MaKo: se respeta');
});

test('hasta 3 funnels en el Funnel Coach del V2 (el Cerebro, 18/11): el principal y hasta 2 más, en orden; el coach único, igual', () => {
  const p = sanearPlan({ funnel: 'anuncios', otros: ['organico', 'anuncios', 'tiktok', 'organico', 'youtube', 'anuncios-a-vsl'] }, '2026-11-18');
  assert.deepEqual(p?.otros, ['organico', 'youtube'], 'sin repetir, sin el principal, sólo funnels de verdad, y 2 como mucho');
  assert.deepEqual(sanearPlan({ funnel: 'anuncios', otros: 'youtube, organico' })?.otros, ['youtube', 'organico'], 'también «a, b»');
  const solo = sanearPlan({ funnel: 'anuncios' }, '2026-11-18')!;
  assert.equal('otros' in solo, false, 'sin otros, la clave no está: el plan de siempre queda igual');
  assert.deepEqual(lineasDelPlan(p!).map((l) => l.rotulo), ['Funnel', 'Después']);
  assert.equal(lineasDelPlan(p!)[1].valor, 'Orgánico, YouTube');
  assert.match(contextoDelFunnelCoachV2(), /HASTA TRES: puede elegir hasta 3 funnels/);
  assert.match(contextoDelFunnelCoachV2(), /en otros \(hasta 2\)/);
  assert.doesNotMatch(contextoDelFunnelCoach(null), /HASTA TRES/, 'el coach único sigue con uno');
});
