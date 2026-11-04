// Los tres de arriba del Ops Center (Martín, 1/11/2026: «primero el chat principal de Ops Center, que ya no se llama cerebro... segundo
// funnel coach y ahí adentro la calculadora. Y tercero offer coach, que cambiaría por Hormozi») y los referentes.
// Probado rompiéndolo:
//   · el jefe con `titulo: JEFE_SECOND_BRAIN`                    → 1
//   · sacar el filtro del Funnel Coach de `antes`                → 2 (dos filas)
//   · sacar `funnel-coach` de TABS_CON_CHAT_PROPIO               → 3 (su hilo no se crea)
//   · sacar la regla «no eres» de reglasDe                       → 5
//   · sanearReferentes sin el null                               → 6 (elegir MaKo vuelve a Hormozi)
//   · una ficha vacía o de más de 5.000 caracteres               → 7
//   · sanearPlan aceptando un funnel cualquiera                  → 8
//   · el camino con archivos con CONTEXTO_SECOND_BRAIN fijo       → 10

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  JEFE_SECOND_BRAIN, NOMBRE_JEFE, ORIGEN_FUNNEL_COACH, TABS_CON_CHAT_PROPIO, TAB_FUNNEL_COACH, listaDelCliente, origenDeClave,
} from '../lib/chat-mako-reglas';
import { ASESORES, REFERENTES_DE_FABRICA, inspiradoEn, sanearReferentes } from '../lib/asesores/catalogo';
import { FICHAS } from '../lib/asesores/fichas';
import { PISTA_DEL_FUNNEL_COACH, contextoDeReferente, contextoDelFunnelCoach, pistaDelFunnelCoach } from '../lib/asesores/contexto';
import { lineasDelPlan, sanearPlan } from '../lib/funnel-plan';
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

test('3. tiene su hilo propio, y la pantalla lo abre con los tres en orden', () => {
  assert.ok(TABS_CON_CHAT_PROPIO.includes(TAB_FUNNEL_COACH));
  const p = leer('app/second-brain/ChatSecondBrain.tsx');
  assert.match(p, /<div className="co-cuenta co-cuenta--cerebro">\{fila\(cerebroFila\)\}<\/div>\n\s*\{coaches\}/, 'los coaches van debajo del Ops Center');
  assert.ok(p.indexOf('titulo={ORIGEN_FUNNEL_COACH}') < p.indexOf('titulo={delOffer?.nombre ?? ORIGEN_OFFER_COACH}'), 'primero el Funnel Coach, después el Offer Coach');
  assert.match(p, /\{\(ops \|\| veMapa\) && \(\n\s*<div className="co-jefe">/, 'un closer no ve Offer: lo cerraría la puerta de la tab');
  assert.match(p, /\{\(ops \|\| puedeElegir\) && <FilaDeChat titulo=\{ORIGEN_FUNNEL_COACH\}/, 'sus herramientas son del admin');
  // Un turno no se corta por tocar otro chat: queda montado, escondido.
  assert.match(p, /\{funnelAbierto && \(\n\s*<div style=\{\{ display: verFunnel \? 'contents' : 'none' \}\}>/);
  assert.match(p, /const hrefVolver = conCoach \? `\$\{base\}\?coach=funnel`/, 'ir al Mapa y volver no pierde el coach');
});

test('4. el Offer Coach abre con Hormozi; el Funnel Coach, con MaKo', () => {
  assert.deepEqual(REFERENTES_DE_FABRICA, { funnel: null, offer: 'hormozi' });
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
  assert.ok(!sinFrente.includes(FICHAS.hormozi), 'la ficha de oferta es del Offer Coach');
  assert.ok(sinFrente.includes(FICHAS['juan-ads']) && sinFrente.includes(FICHAS['julian-otalora']));
  assert.ok(sinFrente.length < 16_000, 'cada ficha son 5.000 caracteres en el system: sumar a todas lo infla');
  assert.ok(ASESORES.length >= 14, 'Martín: «Haz de muchos, no solo de hormozi»');
  for (const a of ['sofia-contreras', 'marcos-razzetti', 'victor-heras']) assert.ok(ASESORES.some((x) => x.id === a), `${a}: lo pidió por nombre`);
  assert.ok(PISTA_DEL_FUNNEL_COACH.length <= 118, 'el turno corta la pista en 120');
  assert.match(sinFrente, /manda sobre la voz del teléfono/, 'sin esto el turno responde en cinco líneas');
  // Un «sí» sigue siendo un sí: la pista adelante rompía las reglas ancladas al principio.
  for (const m of ['sí', 'Sí, dale', 'no', 'ok', '¡Listo!', 'confirmo', 'dale']) assert.equal(pistaDelFunnelCoach(m), undefined, m);
  for (const m of ['1000 dólares', 'tengo 500 al mes para invertir en anuncios', 'no tengo presupuesto para anuncios todavía']) assert.ok(pistaDelFunnelCoach(m)?.endsWith('. '), m);
});

test('6. lo elegido se sanea: un id que no existe vuelve al de fábrica; elegir MaKo se respeta', () => {
  assert.deepEqual(sanearReferentes(null), REFERENTES_DE_FABRICA);
  assert.deepEqual(sanearReferentes({ offer: 'andrew-tate', funnel: 'nadie' }), REFERENTES_DE_FABRICA);
  assert.deepEqual(sanearReferentes({ offer: null, funnel: 'juan-ads' }), { offer: null, funnel: 'juan-ads' });
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
  assert.equal(aspectoDe('Offer Coach', a).retrato, 'hormozi');
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

// docs/funnel-coach.md §8.2: cada herramienta de un coach le compite los 12.000 caracteres a las demás. Si una queda afuera, el recorte es
// un `console.warn` y el coach dice «no puedo». El mismo piso que tests/ops-center-bateria.test.ts, prueba 4.
test('11. las herramientas del Funnel Coach entran en el presupuesto, y con cuánto margen', async (t) => {
  const { charsDeTools, toolsDelRegistro } = await import('../lib/api-mako/registro');
  const { PRESUPUESTO_REGISTRO_CHARS } = await import('../lib/doer-herramientas');
  const relevanteA = [PISTA_DEL_FUNNEL_COACH, 'Tengo 1000 dólares por mes para anuncios'].join('\n');
  const vista = { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null } as const;
  const tools = toolsDelRegistro({ vista, areas: ['ads'], incluirAcciones: true, relevanteA });
  for (const nombre of ['calcular_presupuesto_anuncios', 'guardar_plan_funnel', 'ver_plan_funnel']) {
    const i = tools.findIndex((x) => x.name === nombre);
    assert.ok(i >= 0, `${nombre} no es visible en el área ads`);
    const margen = PRESUPUESTO_REGISTRO_CHARS - charsDeTools(tools.slice(0, i + 1));
    t.diagnostic(`${nombre}: ${i + 1}.º por relevancia · margen ${margen}`);
    assert.ok(margen >= 300, `${nombre} tiene ${margen} caracteres de margen: el Funnel Coach se queda sin ella`);
  }
});

test('10. la ruta usa el contexto del coach sólo desde su chat, y sólo el admin cambia quién lo aconseja', () => {
  const r = leer('app/api/mako/chat/route.ts');
  assert.match(r, /desde\?\.tab !== ORIGEN_FUNNEL_COACH\) return \{ contexto: CONTEXTO_SECOND_BRAIN \}/);
  // Los dos caminos de la ruta, JSON y con archivos: un adjunto no le saca el contexto.
  assert.equal((r.match(/contexto: delChat\.contexto, pista: delChat\.pista/g) ?? []).length, 2);
  assert.doesNotMatch(r, /contexto: CONTEXTO_SECOND_BRAIN, guardarAdjuntos/);
  assert.match(r, /if \(persona\.rol !== 'admin'\) return json\(\{ ok: false, error: 'Lo cambia quien administra el negocio\.' \}, 403\);/);
});
