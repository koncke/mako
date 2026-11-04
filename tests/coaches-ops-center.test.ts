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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  JEFE_SECOND_BRAIN, NOMBRE_JEFE, ORIGEN_FUNNEL_COACH, TABS_CON_CHAT_PROPIO, TAB_FUNNEL_COACH, listaDelCliente, origenDeClave,
} from '../lib/chat-mako-reglas';
import { ASESORES, REFERENTE_DE_FABRICA, conReferenteElegido, inspiradoEn, referenteDelCoach, referentePedido } from '../lib/asesores/catalogo';
import { FICHAS } from '../lib/asesores/fichas';
import { HERRAMIENTAS_DEL_COACH, contextoDeReferente, contextoDelFunnelCoach } from '../lib/asesores/contexto';
import { hayOfertaParaElCoach, lineasDelPlan, saludoDelFunnelCoach, sanearPlan } from '../lib/funnel-plan';
import { aspectoDe, aspectoDeReferente, esCriaturaDeMako, sanearAspecto } from '../lib/centro-munecos';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

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
  assert.match(p, /<div className="co-cuenta co-cuenta--cerebro">\{fila\(cerebroFila\)\}<\/div>\n\s*\{coaches\}/, 'el coach va debajo del Ops Center');
  // Sus herramientas son del admin, y un closer no ve Offer: lo cerraría la puerta de la tab.
  assert.match(p, /const verCoach = ops \|\| veMapa \|\| puedeElegir;/);
  assert.match(p, /\{verCoach && \(\n\s*<div className="co-jefe">\n\s*<FilaDeChat titulo=\{ORIGEN_FUNNEL_COACH\}/);
  assert.match(p, /onElegir=\{\(\) => elegir\(\{ coach: 'funnel' \}\)\} \/>\n(\s*\{\/\*[^\n]*\*\/\}\n)?\s*\{filasOffer\.length > 0 && <div className="co-jefe__subs">\{filasOffer\.map\(\(f\) => fila\(f, true\)\)\}<\/div>\}/,
    'las conversaciones de oferta cuelgan del Funnel Coach');
  // Un turno no se corta por tocar otro chat: queda montado, escondido.
  assert.match(p, /\{funnelAbierto && \(\n\s*<div style=\{\{ display: verFunnel \? 'contents' : 'none' \}\}>/);
  assert.match(p, /const hrefVolver = conCoach \? `\$\{base\}\?coach=funnel`/, 'ir al Mapa y volver no pierde el coach');
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
  assert.match(r, /desde\?\.tab !== ORIGEN_FUNNEL_COACH\) return \{ contexto: CONTEXTO_SECOND_BRAIN \}/);
  // Los dos caminos de la ruta, JSON y con archivos: un adjunto no le saca el contexto ni sus herramientas.
  assert.equal((r.match(/contexto: delChat\.contexto, referente: delChat\.referente, propias: delChat\.propias/g) ?? []).length, 2);
  assert.match(r, /return \{ contexto: contextoDelFunnelCoach\(referente\), referente, propias: HERRAMIENTAS_DEL_COACH \};/);
  assert.doesNotMatch(r, /contexto: CONTEXTO_SECOND_BRAIN, guardarAdjuntos/);
  assert.match(r, /if \(persona\.rol !== 'admin'\) return json\(\{ ok: false, error: 'Lo cambia quien administra el negocio\.' \}, 403\);/);
});

// ── El coach único (4/11/2026) ────────────────────────────────────────────────────────────────────────────────────────────────
// Probado rompiéndolo, una rotura por vez y restaurada:
//   · `referenteDelCoach` sin la rama de `funnel` (el Offer Coach gana siempre)          → cae 12 «gana el del Funnel Coach»
//   · `referenteDelCoach` que trata `offer: null` como «no eligió»                      → cae 12 «eligió MaKo en el Offer Coach»
//   · `conReferenteElegido` que guarda sólo `{ coach }`                                   → cae 12 «lo de antes queda»
//   · `hayOfertaParaElCoach` con `armada` ignorada                                       → cae 13
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

test('13. quien armó la oferta en una conversación de oferta no vuelve a empezar', () => {
  assert.equal(hayOfertaParaElCoach(0, true), true, 'armada y sin guardar');
  assert.equal(hayOfertaParaElCoach(2, false), true);
  assert.equal(hayOfertaParaElCoach(0, false), false);
  assert.equal(hayOfertaParaElCoach(null, false), true, 'no se pudo leer: no se le dice que le falta');
  assert.equal(hayOfertaParaElCoach(0, null), true);
  assert.match(saludoDelFunnelCoach(false), /oferta/);
  assert.doesNotMatch(saludoDelFunnelCoach(false), /Coach|vuelve con ella/, 'la oferta se trabaja ahí mismo, sin mandar a otro chat');
  const r = leer('app/api/mako/chat/route.ts');
  assert.match(r, /hayOfertaArmada\(\)\.catch\(\(\) => null\)/);
  assert.match(r, /hayOferta: hayOfertaParaElCoach\(ofertas\?\.length \?\? null, armada\)/);
  // Y el contexto: primero la oferta, mirando lo guardado y lo armado, y después el funnel.
  const c = contextoDelFunnelCoach('hormozi');
  assert.ok(c.indexOf('1. LA OFERTA') >= 0 && c.indexOf('1. LA OFERTA') < c.indexOf('2. ELEGIR EL FUNNEL'), 'la oferta va primero');
  for (const h of HERRAMIENTAS_DEL_COACH) assert.ok(c.includes(h), `el contexto no nombra ${h}`);
  assert.doesNotMatch(c, /Offer Coach/, 'no manda a un chat que ya no existe');
  assert.ok(c.includes(FICHAS.hormozi), 'con Hormozi al frente, su ficha');
});

test('14. «Offer Coach» no aparece en ninguna pantalla ni en la API', () => {
  const lista = execFileSync('git', ['ls-files', '-c', '-o', '--exclude-standard', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(tsx?|mts)$/.test(f) && !f.startsWith('app/admin/dev/'));
  assert.ok(lista.length > 500, `miró ${lista.length} archivos`);
  const con: string[] = [];
  for (const f of lista) {
    let src: string;
    try { src = readFileSync(resolve(RAIZ, f), 'utf8'); } catch { continue; }
    // Sin comentarios: la historia se cuenta ahí, y está bien. Primero las líneas, después los bloques.
    const sin = src.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/offer coach/i.test(sin)) con.push(f);
  }
  assert.deepEqual(con, [], 'un «Offer Coach» en un texto es una segunda puerta a lo mismo');
  assert.doesNotMatch(leer('lib/chat-mako-reglas.ts'), /ORIGEN_OFFER_COACH|queAbreElOfferCoach/);
});

test('15. en el teléfono también hay un solo coach, para el cliente y el super admin', () => {
  const m = leer('app/m/second-brain/ChatClienteM.tsx');
  assert.match(m, /const verCoach = hrefMapa != null \|\| puedeElegir;/);
  assert.match(m, /titulo=\{<span className="m-operaciones-texto1">\{ORIGEN_FUNNEL_COACH\}<\/span>\}/);
  assert.match(m, /\{filasOffer\.map\(\(f\) => fila\(f, true\)\)\}/, 'las conversaciones de oferta cuelgan del coach');
  assert.match(m, /const resto = verCoach \? todasLasFilas\.filter\(\(f\) => f\.origen !== 'offer'\) : todasLasFilas;/, 'sin la fila del coach, siguen en la lista');
  assert.match(m, /<HojaDelCoach referente=\{referente\}/);
  const sa = leer('app/m/operaciones/ChatsMovil.tsx');
  assert.match(sa, /titulo=\{<span className="m-operaciones-texto1">\{ORIGEN_FUNNEL_COACH\}<\/span>\}/);
  assert.match(sa, /<HojaDelCoach referente=\{referente\}/);
  const h = leer('app/m/second-brain/HojaDelCoach.tsx');
  assert.match(h, /useChatDelCoach\(\{ referente, hayOferta, caja \}\)/, 'el motor de la computadora');
  assert.match(h, /onClick=\{\(\) => \{ onReferente\(id\); setVista\(null\); \}\}/, 'se elige quién aconseja adentro de la hoja');
  assert.match(leer('app/second-brain/ChatDelCoach.tsx'), /useChatDelCoach\(\{ referente, hayOferta, caja \}\)/);
});

test('16. las conversaciones de oferta aconsejan con el MISMO referente que el coach del que cuelgan', () => {
  const o = leer('app/api/offer/route.ts');
  assert.match(o, /const id = await leerReferente\(\);/);
  assert.doesNotMatch(o, /leerReferentes\(\)\)\.offer/);
  const sb = leer('app/second-brain/ChatSecondBrain.tsx');
  assert.match(sb, /aspectoOffer: delCoach \? aspectoDeReferente\(delCoach\.id\) : null/, 'su cara en la lista y en el hilo');
});
