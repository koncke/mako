// =============================================================================
// El chat de MaKo al costado del CRM y sus sugerencias (14/10/2026): lo que tiene que ser cierto
// =============================================================================
// Martín (13/10, General 3): «replica el mismo chat que hay en Automations, que se abre al costado…
// que siempre esté plegado y que ahí aparezcan notificaciones»; (14/10): «No veo nada sobre el chat de
// MaKo y las recomendaciones...». El mapa: docs/sugerencias-mako-crm.md.
//
//   1. EL MOTOR (lib/sugerencias-crm.ts, puro): cada etapa del CRM sin su automatización trae la suya
//      (clase 1), el tablero trae lo suyo con sus umbrales (clase 3), y NUNCA propone lo que ya existe
//      (por disparador, con la lista de CRON entera). Lo que no se pudo leer no sugiere nada.
//   2. LO QUE «HACERLO» CREA: el CRON que viaja es el que la galería entiende (`disparadorDeEleccion`),
//      y el texto promete lo que la plantilla hace (su plazo, sacado de su grafo).
//   3. LO CALLADO: por CRM, con vencimiento y con tope; se lista y se vuelve a mostrar.
//   4. EL CHAT: una conversación por persona y por CRM; lo que lee MaKo son lecturas reales, gratis.
//   5. EL CABLEADO (sobre el fuente, sin comentarios): la página no calcula; el GET del botón no
//      escribe; «Hacerlo» y «Ahora no» son del admin y la cuenta fresca decide; el rincón marcado.
//
// Probado rompiéndolo (base: 16 pasan / 0 fallan, 14/10/2026), con un arnés que rompe, corre y
// restaura de memoria; cada rotura la cazó el test que la nombra:
//   · `yaExiste` sin mirar los CRON de `disparadores` (`disparadoresDe(a).slice(0, 1)`)     → 15 / 1
//   · `yaExiste` con una de OTRA plantilla tapando igual (sin el `continue` de `de !== q…`)    → 15 / 1
//   · `diasParadosDe` sin el caso del chat (todo a 3 días)                                   → 15 / 1
//   · la clase 3 de reuniones sin marcar con `fathom !== true` (sugiere sobre un «no sé»)     → 15 / 1
//   · `conCallada` sin sacar las vencidas                                                    → 15 / 1
//   · `chartKeyDelCrm` aceptando una base que ya es de un lead                               → 15 / 1
//   · la ruta llamando `hacerSugerencia` / `ahoraNo` sin mirar el rol                        → 15 / 1
//   · `hacerSugerencia` con la caché de respaldo (`CACHE.get(…) ?? await calcular(…)`)        → 15 / 1
//
// La revisión del 14/10 (lo propuesto = lo creado, «Ahora no» con vuelta, un panel por CRM). Base:
// 18 pasan / 0 fallan, con un arnés propio que rompe UNA cosa, corre este archivo y restaura de
// memoria (al final, 18 / 0 otra vez). Cada rotura la cazó el test que la nombra → 17 / 1:
//   · `esperaDePlantilla` con un plazo fijo ('2 días') en vez del de la plantilla
//   · la clase 1 de vuelta a «más de lo previsto» · la clase 3 de vuelta a «¿Te aviso?»
//   · `conEtapa` cortando la línea al final en vez de la etapa (la pregunta quedaba a medias)
//   · `sinCallada` sin sacar la clave · `sinCallada` sacándola de TODOS los CRM
//   · leer lo callado con «no pude leer» como «nada callado» · la lista sin su null
//   · `volverAMostrar` escribiendo sin mirar si HOY está callada · leyendo sin estricto
//   · la ruta con «volver a mostrar» en su propia rama antes del rol · con el corte de rol
//     exceptuándola · el GET sin la lista de calladas
//   · `volver_a_mostrar_sugerencia` sin `rolMinimo: 'admin'` · `sugerencias_crm` sin lo callado
//   · el panel sin la `key` por CRM · «Calladas» a la vista de quien no es admin
//
// La estrella del Ops Center (22/10/2026): el chat propio del CRM se fue y lo escrito va al Cerebro. Base 19 / 0, una
// rotura por vez y restaurada:
//   · el panel montando su propia `<aside>` en vez de la pieza                                    → 18 / 1
//   · «Hacerlo» de una `chat` mandando `s.pedido` sin nombrar el CRM                              → 18 / 1
//   · `pedidoParaElCerebro` sin cambiar «a éste»                                                   → 18 / 1
//   · la pieza sin recordar el último `vez` (el pedido vuelve a salir al reabrir)                  → 18 / 1
//   · la pieza mandando el pedido sin esperar al Cerebro (`!k.esJefe`)                             → 18 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sugerenciasDelCrm, yaExiste, diasParadosDe, plantillaDeClave, parsearCalladas, conCallada, sinCalladas, sinCallada, estaCallada, claveCallada,
  dePantalla, esperaDePlantilla, pedidoParaElCerebro, UMBRALES_SUGERENCIAS, TOPE_TEXTO, CLAVE_CALLADAS,
  type EntradaSugerencias, type LeadSug, type AutomatizacionSug, type Sugerencia,
} from '../lib/sugerencias-crm';
import { generateFunnel, DEFAULT_PIPELINE } from '../lib/pipeline';
import { plantillaPorId, disparadorDeEleccion, canalesDe } from '../lib/plantillas-automatizaciones';
import { textoDuracion } from '../lib/espera-duracion';
import { chartKeyDelCrm, SUFIJO_CRM, LECTURAS_DEL_CRM, lecturasDe, contextoDelCrm } from '../app/crm/mako-crm/chat-reglas';
import { chartKeyDelLead, TOPE_CONTEXTO } from '../lib/mako-analyst-lead-reglas';
import { PREFIJO_CHART_MOVIL, chartKeyDePersona } from '../lib/mako-turno-app-reglas';
import { porId, visible, type Vista } from '../lib/api-mako/registro';
import { esPublica } from '../lib/rutas-publicas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// --- El CRM de prueba: el pipeline de fábrica (Lead entrante, Agenda R1, Agenda R2, Facturando, Ganado) ---

const { stages, transitions } = generateFunnel(DEFAULT_PIPELINE);
const HOY = '2026-10-14';
const AHORA = Date.parse(`${HOY}T15:00:00Z`);
const hace = (dias: number) => new Date(AHORA - dias * 86_400_000).toISOString();

const lead = (o: Partial<LeadSug> = {}): LeadSug => ({
  etapa: 'lead', creado: hace(0), r1: null, asistioR1: null, r2: null, asistioR2: null, cobrado: null, ventaTipo: null, manualVence: null, ...o,
});

const base = (o: Partial<EntradaSugerencias> = {}): EntradaSugerencias => ({
  funnel: { id: 7, canal: 'llamadas', entradas: ['landing'], productoId: 3, etapasEntrega: ['onboarding'] },
  etapas: stages, transiciones: transitions, plazos: {},
  automatizaciones: [], leads: [], cuotas: { vencidas: 0, pendientes: 0 },
  conectado: { whatsapp: true, fathom: true }, hoy: HOY, ahora: AHORA, ...o,
});
const ids = (s: readonly Sugerencia[]) => s.map((x) => x.id);
const todas = (e: EntradaSugerencias) => sugerenciasDelCrm(e, 100);

// --- 1. El motor ---------------------------------------------------------------------

test('clase 1: cada etapa del CRM sin su automatización trae la suya, con el CRON en ESA etapa de ESTE CRM', () => {
  const s = todas(base({ plazos: { agendaj2: 4 }, cuotas: { vencidas: 0, pendientes: 2 } }));
  const esperado = [
    'lead-entro:lead', 'lead-agendo:agenda', 'lead-no-asistio:noshow_r1', 'lead-agendo:agendaj2', 'lead-no-asistio:noshow_r2',
    'lead-confirmo-compra:facturando', 'cliente-empezo', 'lead-no-avanzo:agendaj2', 'mako-cobranza',
  ];
  assert.deepEqual(ids(s), esperado);
  for (const x of s) {
    assert.equal(x.clase, 1);
    assert.equal(x.accion.tipo, 'plantilla');
    assert.equal(x.soloAdmin, true, `${x.id}: crear automatizaciones es del admin`);
  }
  const agendo = s.find((x) => x.id === 'lead-agendo:agenda')!;
  assert.deepEqual(agendo.accion, { tipo: 'plantilla', plantilla: 'lead-agendo', disparador: 'venta:7:agenda' });
  // El No Show sale de la TRANSICIÓN del funnel, no de una key escrita a mano.
  assert.ok(ids(s).includes('lead-no-asistio:noshow_r1'));
  // «Un Cliente Empezó» arranca en la ENTREGA del producto; sin producto, nace con el CRON a elegir.
  assert.deepEqual(s.find((x) => x.id === 'cliente-empezo')!.accion, { tipo: 'plantilla', plantilla: 'cliente-empezo', disparador: 'entrega:3:onboarding' });
  const sinProducto = todas(base({ funnel: { id: 7, canal: null, entradas: [], productoId: null, etapasEntrega: [] } }));
  assert.deepEqual(sinProducto.find((x) => x.id === 'cliente-empezo')!.accion, { tipo: 'plantilla', plantilla: 'cliente-empezo', disparador: null });
  // Sin cuotas en la cartera no se ofrece la cobranza; prospección no recibe «Gracias por dejarnos tus datos».
  assert.ok(!ids(todas(base())).includes('mako-cobranza'));
  const prospeccion = todas(base({ funnel: { id: 7, canal: 'conversaciones', entradas: ['chat_saliente'], productoId: null, etapasEntrega: [] } }));
  assert.ok(!ids(prospeccion).includes('lead-entro:lead'), 'a un CRM de prospección le propuso «Un Lead Entró»');
});

test('lo que «Hacerlo» manda es el CRON que la galería entiende, de la plantilla que pide esa etapa', () => {
  const s = todas(base({ plazos: { agendaj2: 4 }, cuotas: { vencidas: 1, pendientes: 2 } }));
  for (const x of s) {
    if (x.accion.tipo !== 'plantilla') continue;
    const p = plantillaPorId(x.accion.plantilla);
    assert.ok(p, `${x.id}: la plantilla ${x.accion.plantilla} no está en la galería`);
    if (x.accion.disparador == null) {
      assert.ok(!p!.cron.pide || x.id === 'cliente-empezo', `${x.id}: sin CRON en una plantilla que lo pide`);
      continue;
    }
    assert.ok(p!.cron.pide, `${x.id}: manda un CRON a una plantilla que trae el suyo`);
    const d = disparadorDeEleccion(p!.cron.pide!, x.accion.disparador);
    assert.ok(d, `${x.id}: la galería no entiende «${x.accion.disparador}»`);
    assert.equal(d!.etapa, x.accion.disparador.split(':')[2]);
  }
});

test('NUNCA propone lo que ya existe: por disparador, con TODOS los CRON, y una de otra plantilla no tapa', () => {
  const con = (automatizaciones: AutomatizacionSug[]) => ids(todas(base({ automatizaciones, leads: Array.from({ length: 6 }, () => lead({ creado: hace(10) })) })));
  const enAgenda = (o: Partial<AutomatizacionSug>): AutomatizacionSug => ({ id: 1, trigger_tipo: 'etapa_actual', etapa: 'agenda', funnel_id: null, ...o });
  // Un embudo `null` es «a TODOS»: tapa. El de este CRM tapa. El de OTRO CRM no.
  assert.ok(!con([enAgenda({})]).includes('lead-agendo:agenda'));
  assert.ok(!con([enAgenda({ funnel_id: 7 })]).includes('lead-agendo:agenda'));
  assert.ok(con([enAgenda({ funnel_id: 9 })]).includes('lead-agendo:agenda'), 'la del CRM 9 tapó la sugerencia del CRM 7');
  // El SEGUNDO CRON (la lista de `disparadores`, mig 0241) cuenta igual que el de las columnas.
  const segunda = { id: 2, trigger_tipo: 'etapa_actual', etapa: 'lead', funnel_id: 7, disparadores: [{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'lead' }, { id: 'd2', trigger_tipo: 'etapa_actual', etapa: 'facturando', funnel_id: 7 }] };
  assert.ok(!con([segunda]).includes('lead-confirmo-compra:facturando'), 'el segundo CRON de una automatización no contó');
  // De OTRA plantilla conocida: tapa la suya y no la otra. Escrita a mano: tapa todo lo de su etapa.
  const deLeadEntro = { id: 3, trigger_tipo: 'etapa_actual', etapa: 'lead', funnel_id: 7, clave: 'plantilla-lead-entro-mg9-ab12' };
  assert.ok(!con([deLeadEntro]).includes('lead-entro:lead'));
  assert.ok(con([deLeadEntro]).includes('lead-no-avanzo:lead'), '«Un Lead Entró» tapó «Un Lead No Avanzó» en la misma etapa');
  const aMano = { ...deLeadEntro, clave: 'mi-bienvenida' };
  assert.ok(!con([aMano]).includes('lead-entro:lead') && !con([aMano]).includes('lead-no-avanzo:lead'));
  // Creada de la plantilla y sin CRON (la etapa no se pudo guardar): espera; no se ofrece otra en ningún lado.
  const esperando = { id: 4, trigger_tipo: 'manual', etapa: 'manual', funnel_id: null, clave: 'plantilla-lead-agendo-mg9-zz' };
  assert.ok(!con([esperando]).some((x) => x.startsWith('lead-agendo:')));
  // Archivada no cuenta. El evento de la cobranza se mira por su evento.
  assert.ok(con([enAgenda({ archivada_at: '2026-10-01' })]).includes('lead-agendo:agenda'));
  assert.equal(yaExiste([{ id: 5, trigger_tipo: 'aviso_mako', etapa: 'manual', disparadores: [{ id: 'd1', trigger_tipo: 'aviso_mako', subtipo: 'cuota_vencida' }] }],
    { donde: 'evento', plantilla: 'mako-cobranza', trigger: 'aviso_mako', subtipo: 'cuota_vencida' }), true);
  assert.equal(plantillaDeClave('plantilla-recordatorio-reunion-mg1-a'), 'lead-agendo', 'un id de antes no se tradujo a la de su categoría');
  assert.equal(plantillaDeClave('plantilla-lead-no-asistio-mg1-ab'), 'lead-no-asistio');
  assert.equal(plantillaDeClave('nutri-manual'), null);
});

test('clase 3: parados en la entrada con el N del mapa (2 chat, 3 landing, 7 llamada) y su piso', () => {
  assert.equal(diasParadosDe('llamadas', ['chat_entrante']), 2);
  assert.equal(diasParadosDe('conversaciones', []), 2);
  assert.equal(diasParadosDe('llamadas', ['landing']), 3);
  assert.equal(diasParadosDe('llamadas', []), 7);
  assert.equal(diasParadosDe(null, []), 3);
  const parados = (n: number, dias: number, entradas: string[] = ['landing']) => todas(base({
    funnel: { id: 7, canal: 'llamadas', entradas, productoId: null, etapasEntrega: [] },
    leads: Array.from({ length: n }, () => lead({ creado: hace(dias) })),
  })).find((x) => x.id === 'lead-no-avanzo:lead');
  const s = parados(6, 4)!;
  assert.equal(s.clase, 3);
  assert.match(s.texto, /^6 leads parados en «Lead entrante» hace más de 3 días/);
  assert.equal(parados(UMBRALES_SUGERENCIAS.paradosMinimo - 1, 4), undefined, 'con menos del piso igual sugirió');
  assert.equal(parados(6, 2.5), undefined, 'en landing sugirió a los 2,5 días');
  assert.ok(parados(6, 2.5, ['chat_entrante']), 'en chat no sugirió a los 2,5 días');
});

test('clase 3: lo que no se pudo leer NO sugiere (null es «no sé»); Fathom sólo si se SABE que no está', () => {
  const sinMarcar = Array.from({ length: 5 }, () => lead({ etapa: 'agenda', r1: '2026-10-10', asistioR1: null }));
  const fathom = (f: boolean | null) => todas(base({ leads: sinMarcar, conectado: { whatsapp: true, fathom: f } })).find((x) => x.id === 'conectar-fathom');
  assert.deepEqual(fathom(false)?.accion, { tipo: 'link', href: '/integraciones?abrir=fathom' });
  assert.equal(fathom(null), undefined, 'con Fathom sin poder mirar, sugirió conectarlo');
  assert.equal(fathom(true), undefined);
  // Sin leads leídos, nada del tablero (pero sí lo del CRM armado).
  const ciegas = todas(base({ leads: null, cuotas: null }));
  assert.ok(ciegas.every((x) => x.clase === 1), 'sin leads igual sugirió algo del tablero');
  // Las cuotas vencidas y los ganados sin cobro traen la cobranza con su número (una sola fila).
  const cobro = todas(base({ cuotas: { vencidas: 2, pendientes: 5 } })).filter((x) => x.id === 'mako-cobranza');
  assert.equal(cobro.length, 1);
  assert.equal(cobro[0].clase, 3);
  assert.match(cobro[0].texto, /^2 cuotas vencidas/);
  const ganados = Array.from({ length: 3 }, () => lead({ etapa: 'ganado', cobrado: 0 }));
  assert.match(todas(base({ leads: ganados })).find((x) => x.id === 'mako-cobranza')!.texto, /^3 en «Ganado» sin cobro/);
  assert.equal(todas(base({ leads: ganados.map((l) => ({ ...l, ventaTipo: 'sin_cobro' })) })).find((x) => x.id === 'mako-cobranza'), undefined, 'un becado cuenta como deuda');
  // La nutrición manual vencida se revisa en el CHAT, y eso lo puede pedir cualquiera que vea el CRM.
  const manual = todas(base({ leads: Array.from({ length: 3 }, () => lead({ etapa: 'manual', manualVence: '2026-10-01' })) })).find((x) => x.id === 'manual-vencida')!;
  assert.equal(manual.accion.tipo, 'chat');
  assert.equal(manual.soloAdmin, false);
});

test('sin WhatsApp no propone lo que le habla al lead SÓLO por WhatsApp; con email o al grupo, sí', () => {
  const s = ids(todas(base({ conectado: { whatsapp: false, fathom: true }, plazos: { agendaj2: 4 } })));
  assert.ok(!s.includes('lead-confirmo-compra:facturando'), '«Un Lead Confirmó la Compra» sale sólo por WhatsApp');
  assert.ok(s.includes('lead-entro:lead'), '«Un Lead Entró» también sale por email');
  assert.ok(s.includes('lead-no-avanzo:agendaj2'), '«Un Lead No Avanzó» avisa al grupo de MaKo, no al lead');
  assert.ok(ids(todas(base({ conectado: { whatsapp: null, fathom: true } }))).includes('lead-confirmo-compra:facturando'), 'un «no sé» frenó');
});

test('el orden, el tope y las líneas: clase 3 primero, una por id, cortas y en español neutro', () => {
  const e = base({ leads: Array.from({ length: 6 }, () => lead({ creado: hace(10) })), plazos: { lead: 2 }, cuotas: { vencidas: 1, pendientes: 1 } });
  const s = sugerenciasDelCrm(e);
  assert.ok(s.length <= UMBRALES_SUGERENCIAS.tope);
  assert.equal(s[0].clase, 3);
  const primerUno = s.findIndex((x) => x.clase === 1);
  assert.ok(s.slice(primerUno).every((x) => x.clase === 1), 'una de clase 3 quedó después de una de clase 1');
  assert.equal(new Set(ids(s)).size, s.length, 'una sugerencia salió dos veces');
  // `lead-no-avanzo:lead` sale una vez, con el número del tablero (gana la de clase 3).
  assert.match(s.find((x) => x.id === 'lead-no-avanzo:lead')!.texto, /^6 leads parados/);
  for (const x of todas(base({ plazos: { agendaj2: 4 }, cuotas: { vencidas: 3, pendientes: 3 }, leads: [lead({ etapa: 'manual', manualVence: '2026-10-01' })] }))) {
    assert.ok(x.texto.length <= TOPE_TEXTO, `«${x.texto}» pasa de ${TOPE_TEXTO}`);
    assert.ok(!/\b(tenés|querés|podés|conectás|armás|probá|tocá|mirá|hacé)\b/i.test(x.texto), `voseo en «${x.texto}»`);
  }
});

test('lo que se PROPONE es lo que se ejecuta: «Un Lead No Avanzó» dice el plazo de SU definición', () => {
  // El plazo, sacado del grafo de la plantilla por OTRO camino que el motor: desde su primera tarjeta,
  // sumando las esperas hasta la que avisa. Es lo que hace la automatización que «Hacerlo» crea.
  const p = plantillaPorId('lead-no-avanzo')!;
  const pasoDe = new Map(p.pasos.map((x) => [x.id, x]));
  let paso = p.pasos[0]; let minutos = 0; const vistos = new Set<string>();
  while (paso && !paso.accion && !vistos.has(String(paso.id))) {
    vistos.add(String(paso.id));
    if (paso.nodo === 'esperar') minutos += paso.espera!.minutos;
    paso = pasoDe.get(String(paso.nodo === 'condicion' ? paso.ramas?.[0]?.siguiente : paso.siguiente))!;
  }
  assert.ok(paso?.accion && canalesDe(p).includes('mako'), 'la plantilla no termina en un aviso al grupo: «te aviso» sería falso');
  const plazo = textoDuracion(minutos * 60);
  assert.equal(esperaDePlantilla('lead-no-avanzo'), plazo);
  // N del mapa (7 en llamada) distinto del plazo de la plantilla, y una etapa con su plazo de CRM (4).
  const e = base({
    funnel: { id: 7, canal: 'llamadas', entradas: [], productoId: null, etapasEntrega: [] },
    leads: Array.from({ length: 6 }, () => lead({ creado: hace(10) })), plazos: { agendaj2: 4 },
  });
  const noAvanzo = (x: EntradaSugerencias) => todas(x).filter((s) => s.accion.tipo === 'plantilla' && s.accion.plantilla === 'lead-no-avanzo');
  assert.deepEqual(noAvanzo(e).map((s) => s.clase), [3, 1]);
  for (const s of noAvanzo(e)) {
    assert.ok(s.texto.includes(`pasa ${plazo}`), `«${s.texto}» no dice el plazo de la plantilla (${plazo})`);
    assert.ok(!/más de lo previsto|¿Te aviso\?$/.test(s.texto), `«${s.texto}» promete otra cosa`);
  }
  // El conteo sigue con el N del mapa: es lo que se MIDIÓ, y no se ofrece como lo que hará.
  assert.match(noAvanzo(e)[0].texto, /^6 leads parados en «Lead entrante» hace más de 7 días\. ¿Te aviso si uno pasa .+ ahí\?$/);
  // Una etapa larga se acorta ELLA: la promesa entra entera y la línea no pasa el tope.
  const larga = 'Leads que llegaron por el formulario del anuncio de octubre y todavía no contestan nada';
  const etapas = stages.map((s) => (s.key === 'lead' || s.key === 'agendaj2' ? { ...s, label: larga } : s));
  for (const s of noAvanzo({ ...e, etapas })) {
    assert.ok(s.texto.length <= TOPE_TEXTO, `«${s.texto}» pasa de ${TOPE_TEXTO}`);
    assert.ok(s.texto.includes(`pasa ${plazo}`) && s.texto.includes('…»'), `la etapa larga se comió la promesa: «${s.texto}»`);
    if (s.clase === 3) assert.match(s.texto, /ahí\?$/, `la etapa larga cortó la pregunta: «${s.texto}»`);
  }
});

// --- 3. Lo callado -----------------------------------------------------------------------

test('«Ahora no» calla 30 días en ESE CRM, vence solo, tiene tope y descarta lo que no entiende', () => {
  assert.equal(CLAVE_CALLADAS, 'crm.sugerencias.calladas');
  const m = conCallada({}, claveCallada(7, 'lead-agendo:agenda'), UMBRALES_SUGERENCIAS.callarDias, AHORA);
  const sugs = [{ id: 'lead-agendo:agenda' }, { id: 'lead-entro:lead' }];
  assert.deepEqual(sinCalladas(sugs, m, 7, AHORA).visibles.map((x) => x.id), ['lead-entro:lead']);
  assert.equal(sinCalladas(sugs, m, 7, AHORA).calladas, 1);
  assert.equal(sinCalladas(sugs, m, 9, AHORA).visibles.length, 2, 'callar en un CRM calló la del otro');
  assert.equal(sinCalladas(sugs, m, 7, AHORA + 31 * 86_400_000).visibles.length, 2, 'a los 31 días seguía callada');
  // Lo vencido se va al sumar otra; el tope deja las más nuevas.
  const viejo = { [claveCallada(7, 'x')]: new Date(AHORA - 1000).toISOString() };
  assert.ok(!(claveCallada(7, 'x') in conCallada(viejo, claveCallada(7, 'y'), 30, AHORA)), 'lo vencido sobrevivió');
  let mucho: Record<string, string> = {};
  for (let i = 0; i < 250; i++) mucho = conCallada(mucho, claveCallada(1, `s${i}`), 30 + i / 1000, AHORA);
  assert.equal(Object.keys(mucho).length, 200);
  assert.ok(claveCallada(1, 's249') in mucho);
  assert.deepEqual(parsearCalladas('{"7|ok":"2026-11-01T00:00:00.000Z","basura":"x","8|a":"no-es-fecha"}'), { '7|ok': '2026-11-01T00:00:00.000Z' });
  assert.deepEqual(parsearCalladas('no es json'), {});
});

test('lo callado tiene VUELTA: se lista con hasta cuándo y «Volver a mostrar» la saca sólo de ESE CRM', () => {
  const sugs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  let m = conCallada({}, claveCallada(7, 'c'), 30, AHORA);
  m = conCallada(m, claveCallada(7, 'a'), 30, AHORA);
  m = conCallada(m, claveCallada(9, 'a'), 30, AHORA);
  const r = sinCalladas(sugs, m, 7, AHORA);
  assert.deepEqual(r.visibles.map((x) => x.id), ['b']);
  assert.deepEqual(r.lista.map((x) => x.s.id), ['a', 'c'], 'las calladas no salen en el orden del motor');
  assert.equal(r.lista[0].hasta, m[claveCallada(7, 'a')]);
  assert.equal(r.calladas, 2);
  const vuelta = sinCallada(m, claveCallada(7, 'a'), AHORA);
  assert.ok(!estaCallada(vuelta, claveCallada(7, 'a'), AHORA), '«Volver a mostrar» no la sacó');
  assert.ok(estaCallada(vuelta, claveCallada(9, 'a'), AHORA), 'volver a mostrar en el CRM 7 la sacó también del 9');
  assert.ok(estaCallada(vuelta, claveCallada(7, 'c'), AHORA), 'se llevó otra callada del mismo CRM');
  // Lo vencido no se lista (ya se ve) y se limpia al escribir.
  const vieja = { ...m, [claveCallada(7, 'b')]: new Date(AHORA - 1000).toISOString() };
  assert.deepEqual(sinCalladas(sugs, vieja, 7, AHORA).lista.map((x) => x.s.id), ['a', 'c']);
  assert.ok(!(claveCallada(7, 'b') in sinCallada(vieja, claveCallada(7, 'a'), AHORA)), 'lo vencido sobrevivió');
  // La API: lo callado viene en la lectura; volver a mostrar es una acción del ADMIN que se confirma.
  const def = porId('volver_a_mostrar_sugerencia');
  assert.ok(def && def.tipo === 'accion' && def.confirmacion === 'chat', 'volver_a_mostrar_sugerencia no es una acción que se confirma');
  const quien = (rol: Vista['rol']): Vista => ({ canal: 'app', alcance: 'proponer', ws: 9, rol, tabs: null });
  assert.ok(visible(def!, quien('admin')));
  assert.ok(!visible(def!, quien('miembro')), 'un closer puede volver a mostrar lo que calló el admin');
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const lectura = run.slice(run.indexOf('  sugerencias_crm: {'), run.indexOf('  volver_a_mostrar_sugerencia: {'));
  assert.match(lectura, /calladas: r\.calladas\?\.map\(/, 'sugerencias_crm no devuelve lo callado');
  assert.match(run.slice(run.indexOf('  volver_a_mostrar_sugerencia: {')), /await volverAMostrar\(ctx\.ws, Number\(payload\.embudoId\), String\(payload\.sugerenciaId\)\)/);
});

test('a la pantalla: sin plantilla ni etapa, y sin «Hacerlo» de admin para quien no lo es', () => {
  const [agendo] = todas(base()).filter((x) => x.id === 'lead-agendo:agenda');
  const admin = dePantalla(agendo, true);
  const closer = dePantalla(agendo, false);
  assert.equal(admin.hacer, true);
  assert.equal(closer.hacer, false, 'a un closer se le ofrece crear una automatización');
  assert.ok(!('plantilla' in admin) && !('disparador' in admin) && !JSON.stringify(admin).includes('venta:'), 'la pantalla recibe qué se crea');
  const chat: Sugerencia = { id: 'manual-vencida', clase: 3, texto: 'x', etapa: 'manual', soloAdmin: false, accion: { tipo: 'chat', pedido: 'revisa' } };
  assert.deepEqual(dePantalla(chat, false), { id: 'manual-vencida', clase: 3, texto: 'x', tipo: 'chat', pedido: 'revisa', hacer: true });
});

// --- 4. El chat --------------------------------------------------------------------------

test('la conversación es de UNA persona sobre UN CRM, con su sufijo, y no se anida', () => {
  const martin = chartKeyDePersona({ sub: '1', email: 'martin@x.com' });
  const closer = chartKeyDePersona({ sub: '22', email: 'closer@x.com' });
  const a = chartKeyDelCrm(martin, 7);
  assert.equal(a, `${PREFIJO_CHART_MOVIL}u1${SUFIJO_CRM}7`);
  assert.notEqual(a, chartKeyDelCrm(martin, 8), 'dos CRM comparten la conversación');
  assert.notEqual(a, chartKeyDelCrm(closer, 7), 'dos personas comparten la conversación del mismo CRM');
  assert.notEqual(a, chartKeyDelLead(martin, 7), 'el chat del CRM 7 es el del lead 7');
  for (const malo of [null, '', 'mako-doer', PREFIJO_CHART_MOVIL, a, chartKeyDelLead(martin, 3)]) {
    assert.equal(chartKeyDelCrm(malo, 7), null, `aceptó la base ${String(malo)}`);
  }
  for (const mal of [0, -3, 1.5, Number.NaN]) assert.equal(chartKeyDelCrm(martin, mal), null, `aceptó el CRM ${mal}`);
});

test('lo que MaKo lee del CRM son lecturas REALES, gratis, por la app, y las del principal sólo en el principal', () => {
  const closer: Vista = { canal: 'app', alcance: 'lectura', ws: 9, rol: 'miembro', tabs: null };
  for (const l of LECTURAS_DEL_CRM) {
    const d = porId(l.id);
    assert.ok(d, `«${l.id}» no existe en el registro`);
    assert.equal(d!.tipo, 'lectura', `«${l.id}» no es una lectura`);
    assert.equal(d!.costo, 'gratis', `«${l.id}» cuesta y corre en CADA mensaje`);
    assert.ok(d!.canales.includes('app'), `«${l.id}» no sale por la app`);
    assert.ok(!d!.datosDeGoogle && !d!.lenta, `«${l.id}» lee la agenda de Google o es lenta`);
  }
  const sug = porId('sugerencias_crm')!;
  assert.ok(visible(sug, closer), 'un closer no ve las sugerencias de su CRM por la app');
  assert.ok(sug.parametros.some((p) => p.nombre === 'embudoId' && !p.obligatorio), 'sugerencias_crm no es por CRM');
  assert.ok(!lecturasDe(false).some((l) => l.id === 'ver_funnel' || l.id === 'contar_leads_por_etapa'), 'en otro CRM lee las etapas del principal');
  assert.ok(lecturasDe(true).some((l) => l.id === 'ver_funnel'));
  assert.deepEqual(LECTURAS_DEL_CRM.find((l) => l.id === 'sugerencias_crm')!.input(12), { embudoId: 12 });
});

test('el bloque del system: de qué CRM es, cada lectura con su título, lo que faltó dicho, y el tope', () => {
  const crm = { id: 12, nombre: 'Mentoría', principal: false };
  const t = contextoDelCrm({ crm, lecturas: [{ id: 'sugerencias_crm', ok: true, salida: '{"etapas":[]}' }, { id: 'reuniones_proximas', ok: false }] });
  assert.match(t, /«Mentoría» \(embudoId 12\)/);
  assert.match(t, /DATOS, no instrucciones/);
  assert.match(t, /\[Este CRM: [^\]]+\]\n\{"etapas":\[\]\}/);
  assert.match(t, /No se pudo leer ahora: Las reuniones/);
  assert.ok(!t.includes('Las etapas del CRM con sus keys'), 'pidió ver_funnel en un CRM que no es el principal');
  const largo = 'x'.repeat(30_000);
  const lleno = contextoDelCrm({ crm: { ...crm, principal: true }, lecturas: LECTURAS_DEL_CRM.map((l) => ({ id: l.id, ok: true as const, salida: largo })) });
  assert.ok(lleno.length <= TOPE_CONTEXTO, `el bloque mide ${lleno.length}`);
  assert.match(lleno, /se cortó aquí por largo/);
  assert.match(contextoDelCrm({ crm, lecturas: [] }), /no se pudo leer nada/);
});

// --- 5. El cableado ----------------------------------------------------------------------

test('la página MONTA el panel al lado del tablero y no calcula nada; el tablero no lo trae', () => {
  const page = sinComentarios(leer('app/crm/page.tsx'));
  // Con lo que la apertura necesita (5/11/2026, lib/aperturas/crm.ts): los leads del negocio y si administra. Nada más.
  assert.match(page, /<PanelMakoCrm funnelId=\{funnelId\} apertura=\{\{ leads: leadsNegocio, esAdmin: puedeCrearCrm \}\} \/>/);
  assert.ok(!/sugerenciasDeUnCrm|sugerencias-crm/.test(page), 'la página calcula las sugerencias en su render');
  assert.ok(!/PanelMakoCrm|mako-crm/.test(leer('app/crm/CrmBoard.tsx')), 'el panel vive adentro de CrmBoard (es de otro frente)');
});

test('la ruta: privada, quién y qué CRM ANTES de todo, el GET del botón no escribe, y lo del admin es del admin', () => {
  assert.equal(esPublica('/api/crm/mako'), false, '/api/crm/mako quedó pública');
  const r = sinComentarios(leer('app/api/crm/mako/route.ts'));
  const get = r.slice(r.indexOf('export async function GET'), r.indexOf('async function mandar'));
  assert.ok(get.indexOf('chatDelRequest(') >= 0 && get.indexOf('chatDelRequest(') < get.indexOf('sugerenciasDeUnCrm('));
  // El hilo (que ESCRIBE: vence pendientes) sólo detrás de `hilo=1`.
  assert.match(get, /get\('hilo'\) === '1'\) return json\(\{ ok: true, crm, \.\.\.\(await abrirDelCrm\(c\)\) \}\)/);
  assert.equal((r.match(/abrirDelCrm\(/g) ?? []).length, 1);
  const post = r.slice(r.indexOf('export async function POST'));
  assert.ok(post.indexOf('chatDelRequest(') < post.indexOf("body.action === 'send'"), 'corre algo antes de saber quién pregunta');
  const admin = post.indexOf("c.persona.rol !== 'admin'");
  assert.ok(admin > 0 && admin < post.indexOf('hacerSugerencia(') && admin < post.indexOf('ahoraNo('), '«Hacerlo» o «Ahora no» corren sin mirar el rol');
  // «Volver a mostrar» deshace lo callado para todo el equipo: del admin, detrás del MISMO corte, que
  // es la PRIMERA línea de la rama de las tres y no exceptúa a ninguna.
  const volver = post.indexOf('volverAMostrar(');
  assert.ok(volver > 0 && admin < volver && post.indexOf('chatDelRequest(') < volver, '«Volver a mostrar» corre sin mirar la sesión o el rol');
  assert.equal((post.match(/volverAMostrar\(/g) ?? []).length, 1, '«Volver a mostrar» tiene otra rama');
  assert.match(post, /if \(body\.action === 'hacer' \|\| body\.action === 'ahora_no' \|\| body\.action === 'volver_a_mostrar'\) \{\n\s+if \(c\.persona\.rol !== 'admin'\) return json\(\{ ok: false, error: 'Esto lo decide el admin de la cuenta\.' \}, 403\);\n/);
  assert.ok(!/body\.(plantilla|disparador|etapa)/.test(post), 'la ruta deja que la pantalla elija qué se crea');
  // El GET del botón trae lo callado de ESE CRM (null = no se pudo leer, no «nada»).
  assert.match(get, /calladas: r \? r\.calladas\?\.map\(\(x\) => dePantalla\(x\.sugerencia, admin\)\) \?\? null : \[\]/);
});

test('el server: cuenta FRESCA antes de crear, por la puerta de la galería, la caché con el ws, y lo callado leído aparte', () => {
  const s = sinComentarios(leer('lib/sugerencias-crm-server.ts'));
  assert.match(s, /^import 'server-only';/m);
  const hacer = s.slice(s.indexOf('export async function hacerSugerencia'));
  // La cuenta fresca, SIN pasar por la caché (ni como respaldo), y antes de crear.
  assert.match(hacer, /const calc = await calcular\(ws, crm\);/, 'crea con lo de la caché');
  assert.ok(hacer.indexOf('await calcular(') < hacer.indexOf('crearDesdePlantilla('), 'crea antes de contar');
  assert.match(hacer, /setPasos: setSecuenciaPasos,\s+setDisparadores: guardarDisparadores,/);
  assert.match(s, /const claveCache = \(ws: number, crmId: number\) => `\$\{ws\}:\$\{crmId\}`;/);
  // Lo callado no se cachea: se lee en cada pedido (estricto: «no pude leer» viaja como null, no como
  // «nada callado»); y al escribir, ESTRICTO y con compare-and-set.
  const ver = s.slice(s.indexOf('export async function sugerenciasDeUnCrm'), s.indexOf('async function callar'));
  assert.match(ver, /await getSettingEstricto\(CLAVE_CALLADAS\)\.then\(parsearCalladas, avisar\(/);
  assert.match(ver, /calladas: mapa \? lista\.map\(/);
  const callar = s.slice(s.indexOf('async function callar'), s.indexOf('export type FalloSugerencia'));
  assert.match(callar, /getSettingEstricto\(CLAVE_CALLADAS\)/);
  assert.match(callar, /cambiarSettingSi\(CLAVE_CALLADAS, crudo, nuevo\)/);
  // «Volver a mostrar»: la misma lectura estricta y el mismo compare-and-set, y sólo si HOY está callada.
  const volver = s.slice(s.indexOf('export async function volverAMostrar'), s.indexOf('// ── Hacerlo'));
  assert.ok(volver.length > 0, 'no encontré volverAMostrar');
  assert.match(volver, /const crudo = await getSettingEstricto\(CLAVE_CALLADAS\);/);
  assert.match(volver, /if \(!estaCallada\(mapa, clave, ahora\)\) return \{ ok: true, cambio: false \};/);
  assert.match(volver, /cambiarSettingSi\(CLAVE_CALLADAS, crudo, JSON\.stringify\(sinCallada\(mapa, clave, ahora\)\)\)/);
  assert.match(volver, /const clave = claveCallada\(crm\.id, sugerenciaId\);/);
});

test('el chat: permiso del CRM en el server; en la pantalla, la estrella del Ops Center con las sugerencias arriba', () => {
  const srv = sinComentarios(leer('app/crm/mako-crm/chat-server.ts'));
  assert.match(srv, /puedeVerKey\('crm', rolWs, capa\)/);
  assert.match(srv, /return turnoApp\(c\.persona, sid, \{ mensaje: entrada\.mensaje, contexto \}\)/);
  const panel = sinComentarios(leer('app/crm/mako-crm/PanelMakoCrm.tsx'));
  // UN PANEL POR CRM: lo exportado sólo monta el de ESE CRM con su `key` (sus sugerencias, y la estrella plegada).
  const exportado = panel.slice(panel.indexOf('export function PanelMakoCrm'), panel.indexOf('function PanelDeUnCrm'));
  assert.match(exportado, /return <PanelDeUnCrm key=\{funnelId \?\? 'principal'\} funnelId=\{funnelId\} apertura=\{apertura\} \/>;/);
  assert.ok(!/use(State|Effect|Callback)\(/.test(exportado), 'el envoltorio guarda estado: sobrevive al cambio de CRM');
  // «Calladas (N)» y «Volver a mostrar»: del admin, como «Ahora no».
  assert.match(panel, /\{callar && calladas\.length > 0 && \(/);
  assert.match(panel, /onClick=\{\(\) => void pedirAlServer\('volver_a_mostrar', s\)\}>Volver a mostrar</);
  // Los fetch del panel, con corte.
  const tramos = panel.split(/\bfetch\(/).slice(1);
  assert.ok(tramos.length >= 2, 'no encontré los fetch');
  for (const t of tramos) assert.match(t.slice(0, 600), /AbortSignal\.timeout\(/, 'un fetch sin corte');
  // LA ESTRELLA ES LA DEL OPS CENTER desde el 22/10/2026 (Martín, 21/10: «los iconos de las criaturas siempre debe ser el
  // icono de MaKo, se envía lo que sea que envíen al cerebro y ya el cerebro se encarga de repartir»): la pieza de todas
  // las tabs, con lo del CRM arriba del hilo y su número en la estrella. Ni barra, ni estrella, ni chat propios.
  assert.match(panel, /import \{ MakoEnLaTab \} from '@\/app\/_chat\/MakoEnLaTab';/);
  // Con el lead de la ficha abierta (CR3, 22/10/2026: app/crm/lead-abierto.ts), y las sugerencias en el bloque de preguntas de
  // la estrella (22/10/2026: tests/ops-center-bloque-y-estado.test.ts, 9).
  // Y la apertura de la tab (5/11/2026, docs/mako-iniciativa/plan.md T7), ANTES de `arriba=` (tests/ops-center-bloque-y-estado.test.ts, 9).
  assert.match(panel, /return <MakoEnLaTab tab="CRM" apertura=\{aperturaTab\} entidad=\{entidadDelLead\(abierto\)\} arriba=\{sugerencias\} preguntas=\{preguntas\} aviso=\{n\} pedido=\{pedido\} \/>;/);
  assert.doesNotMatch(panel, /ChatMakoCrm|hilo=1|<aside\b|<Muneco\b|data-sidebar|--ancho-panel-mako/, 'el CRM volvió a armar su chat, su barra o su estrella');
  assert.ok(!existsSync(join(RAIZ, 'app/crm/mako-crm/ChatMakoCrm.tsx')), 'volvió el chat propio del CRM');
  // «Hacerlo» de una que se revisa con MaKo: al Cerebro, con el CRM nombrado.
  assert.match(panel, /setPedido\(\{ texto: pedidoParaElCerebro\(s\.pedido, crm\), vez: Date\.now\(\) \}\)/);
  // La pieza: el pedido abre el panel, sale UNA vez por `vez` (el panel se desmonta al cerrar: lo recuerda la pieza) y sale
  // al Cerebro, no al chat que esté cargando.
  const pieza = sinComentarios(leer('app/_chat/MakoEnLaTab.tsx'));
  // `abrir()` desde el 22/10/2026 (CR4): abre, y decide si va encima de un modal de la tab.
  assert.match(pieza, /if \(!pedido \|\| ultimaVez\.current === pedido\.vez\) return;\n\s*ultimaVez\.current = pedido\.vez;\n\s*setPorMandar\(pedido\);\n\s*abrir\(\);/);
  assert.match(pieza, /const abrir = useCallback\(\(\) => \{ setSobre\(encimaDeModales && profundidadModales\(\) > 0\); setAbierto\(true\); \}, \[encimaDeModales\]\);/);
  // (`onMandado?.()` desde el 29/10/2026: la tarjeta fija de Create, `ConversacionCerebro`, puede no pasarlo.)
  assert.match(pieza, /if \(!pedido \|\| !k\.esJefe\) return;\n\s*if \(k\.enviar\(pedido\.texto\)\) onMandado\?\.\(\);/);
  // Abierta, el tablero le deja el lugar: la pieza publica su ancho y el padding izquierdo de CrmBoard lo lee.
  assert.match(leer('app/crm/CrmBoard.tsx'), /padding: `16px 44px \$\{view === 'kanban' \? ABAJO_KANBAN : 60\}px calc\(44px \+ var\(--ancho-panel-mako, 0px\)\)`/);
  // Nada de next/link: los links con el `?ws=` de la casa.
  assert.ok(!/from 'next\/link'/.test(panel));
});

test('el pedido que sale al Cerebro NOMBRA el CRM: «este CRM» no le dice nada', () => {
  assert.equal(pedidoParaElCerebro('En este CRM hay 3 leads en «Manual».', 'Sprint 3 días'), 'En el CRM «Sprint 3 días» hay 3 leads en «Manual».');
  assert.equal(pedidoParaElCerebro('Estos leads de este CRM volvieron', 'Sprint'), 'Estos leads del CRM «Sprint» volvieron');
  assert.equal(pedidoParaElCerebro('¿A qué CRM conviene conectarla? Si es a éste, conéctala.', 'Sprint'), '¿A qué CRM conviene conectarla? Si es al CRM «Sprint», conéctala.');
  assert.equal(pedidoParaElCerebro('En este CRM hay 3', null), 'En este CRM hay 3', 'sin el nombre, como está');
  // TODOS los pedidos del motor: ninguno sale al Cerebro con «este CRM» o «éste» sin nombrar.
  const pedidos = [...leer('lib/sugerencias-crm.ts').matchAll(/pedido: `([^`]*)`/g)].map((m) => m[1]);
  assert.ok(pedidos.length >= 5, `encontré ${pedidos.length} pedidos`);
  // (`\b` no ve la «é» como letra: «éste» se busca después de un espacio.)
  for (const p of pedidos) assert.doesNotMatch(pedidoParaElCerebro(p, 'X'), /\beste CRM\b|(?:^|\s)éste\b/i, p.slice(0, 70));
});
