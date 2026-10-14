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
//   2. LO QUE «HACERLO» CREA: el CRON que viaja es el que la galería entiende (`disparadorDeEleccion`).
//   3. LO CALLADO: por CRM, con vencimiento y con tope.
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
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sugerenciasDelCrm, yaExiste, diasParadosDe, plantillaDeClave, parsearCalladas, conCallada, sinCalladas, claveCallada,
  dePantalla, UMBRALES_SUGERENCIAS, TOPE_TEXTO, CLAVE_CALLADAS,
  type EntradaSugerencias, type LeadSug, type AutomatizacionSug, type Sugerencia,
} from '../lib/sugerencias-crm';
import { generateFunnel, DEFAULT_PIPELINE } from '../lib/pipeline';
import { plantillaPorId, disparadorDeEleccion } from '../lib/plantillas-automatizaciones';
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
  assert.match(page, /<PanelMakoCrm funnelId=\{funnelId\} \/>/);
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
  assert.ok(!/body\.(plantilla|disparador|etapa)/.test(post), 'la ruta deja que la pantalla elija qué se crea');
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
  // Lo callado no se cachea: se lee en cada pedido; y al escribir, ESTRICTO y con compare-and-set.
  const ver = s.slice(s.indexOf('export async function sugerenciasDeUnCrm'), s.indexOf('async function callar'));
  assert.match(ver, /parsearCalladas\(await getSetting\(CLAVE_CALLADAS\)\)/);
  const callar = s.slice(s.indexOf('async function callar'), s.indexOf('export type FalloSugerencia'));
  assert.match(callar, /getSettingEstricto\(CLAVE_CALLADAS\)/);
  assert.match(callar, /cambiarSettingSi\(CLAVE_CALLADAS, crudo, nuevo\)/);
});

test('el chat: permiso del CRM, el hilo sólo al abrir, y el rincón marcado', () => {
  const srv = sinComentarios(leer('app/crm/mako-crm/chat-server.ts'));
  assert.match(srv, /puedeVerKey\('crm', rolWs, capa\)/);
  assert.match(srv, /return turnoApp\(c\.persona, sid, \{ mensaje: entrada\.mensaje, contexto \}\)/);
  const panel = sinComentarios(leer('app/crm/mako-crm/PanelMakoCrm.tsx'));
  const chat = sinComentarios(leer('app/crm/mako-crm/ChatMakoCrm.tsx'));
  // El chat (y su GET del hilo) viaja con `dynamic` y se monta recién al abrir.
  assert.match(panel, /dynamic\(\(\) => import\('\.\/ChatMakoCrm'\)/);
  assert.match(panel, /\{montado && \(/);
  assert.ok(!panel.includes('hilo=1') && chat.includes('&hilo=1'), 'el botón plegado pide el hilo');
  // Los dos fetch del botón y los del chat con corte.
  for (const [nombre, src] of [['panel', panel], ['chat', chat]] as const) {
    // Cada `fetch(` con su corte antes del siguiente `fetch(` (y dentro de sus primeros 600 caracteres).
    const tramos = src.split(/\bfetch\(/).slice(1);
    assert.ok(tramos.length >= 2, `${nombre}: no encontré los fetch`);
    for (const t of tramos) assert.match(t.slice(0, 600), /AbortSignal\.timeout\(/, `${nombre}: un fetch sin corte`);
  }
  // El botón plegado y el panel abierto, en el rincón de abajo a la derecha: con la marca.
  assert.match(panel, /<button type="button" data-esquina-ocupada data-boton-mako-crm/);
  assert.match(panel, /<aside aria-label="MaKo" data-esquina-ocupada=\{abierto \|\| undefined\}/);
  // Nada de next/link: los links con el `?ws=` de la casa.
  assert.ok(!/from 'next\/link'/.test(panel + chat));
});
