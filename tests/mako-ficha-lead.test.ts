// =============================================================================
// Lo que MaKo lee de la ficha (`ficha_lead`, `buscar_leads`): lo mismo que ve el equipo
// =============================================================================
// Tanda B del CRM (14/10/2026, docs/diseno-ficha-bloques.md §5): `resumenLead` (lib/mako-tools.ts) no
// devolvía la web, las redes, el ingreso estimado, lo que contestó en la landing, la oferta ni el tipo
// de venta, y la etapa salía de `pipeline_stage` CRUDO —null en todo lead sin override—. Con eso MaKo
// decía «no hay» sobre lo que la ficha muestra (el mismo modo de falla del 08/10 con el formulario de
// Meta, tests/mako-ficha-formulario.test.ts).
//
// Lo puro se EJECUTA (lib/mako-ficha-lead.ts); el cableado de lib/mako-tools.ts (`server-only`), sobre
// el FUENTE sin comentarios.
//
// Correr: npx tsx --test tests/mako-ficha-lead.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (14/10/2026), una rotura por vez y restaurando. Base en verde: 6 pass / 0 fail.
//   (los números de cada rotura, abajo, junto al test que la caza)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { etapaParaModelo, datosDeLaFicha, landingParaModelo, TOPE_LANDING_MODELO, type LeadParaModelo } from '../lib/mako-ficha-lead';
import { DEFAULT_STAGES, type StageDerivable } from '../lib/pipeline';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const base: StageDerivable = {
  estado_lead: 'abierto', pipeline_stage: null, fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null,
  asistio_j1: null, asistio_j2: null, nutricion_realizada: false,
};
const ETAPAS = [
  { key: 'lead', label: 'Lead entrante' }, { key: 'agenda', label: 'Agenda R1', kind: 'reunion' },
  { key: 'conversando', label: 'Conversación abierta' }, { key: 'ganado', label: 'Ganado' },
];

// Rotura: volver a `etapa: l.pipeline_stage ?? null` en resumenLead → 5 / 1 (el del cableado).
// Rotura: `etapaParaModelo` sin caer a DEFAULT_STAGES con la lista vacía → 5 / 1 (éste).
test('la etapa es la efectiva, con su nombre: derivada sin override, y un override huérfano no cuenta', () => {
  // Sin override (la mayoría): antes salía null.
  assert.deepEqual(etapaParaModelo({ ...base, fecha_junta_1: '2026-10-20' }, ETAPAS), { etapa: 'agenda', etapa_nombre: 'Agenda R1' });
  // Override a una etapa que el funnel tiene: manda.
  assert.deepEqual(etapaParaModelo({ ...base, pipeline_stage: 'conversando' }, ETAPAS), { etapa: 'conversando', etapa_nombre: 'Conversación abierta' });
  // Override a una etapa que el funnel YA NO tiene: se deriva (como la ficha).
  assert.deepEqual(etapaParaModelo({ ...base, pipeline_stage: 'fantasma' }, ETAPAS), { etapa: 'lead', etapa_nombre: 'Lead entrante' });
  // Sin etapas (la lectura falló): las de por defecto, como `stagesRaw.length ? stagesRaw : DEFAULT_STAGES` de la ficha.
  const sin = etapaParaModelo({ ...base, pipeline_stage: 'fantasma' }, []);
  assert.equal(sin.etapa, 'lead');
  assert.equal(sin.etapa_nombre, DEFAULT_STAGES.find((s) => s.key === 'lead')!.label);
  assert.deepEqual(etapaParaModelo({ ...base, estado_lead: 'ganado' }, null), { etapa: 'ganado', etapa_nombre: 'Ganado' });
  // Una derivada que el funnel no rotula (no-show de la R1): la key, sin nombre inventado.
  assert.deepEqual(etapaParaModelo({ ...base, fecha_junta_1: '2026-10-01', asistio_j1: false }, ETAPAS), { etapa: 'noshow_r1', etapa_nombre: null });
});

// Rotura: `datosDeLaFicha` sin la web → 5 / 1 (éste).
// Rotura: `ingreso_estimado_usd` también en un ganado → 5 / 1 (éste).
test('lo que la ficha muestra y MaKo no veía: redes, ingreso estimado, venta, oferta, página y entrada', () => {
  const lead: LeadParaModelo = {
    estado_lead: 'abierto', web: ' https://negocio.com ', instagram: 'ana.lopez', youtube: null, linkedin: '', direccion: 'Av. 1',
    ingreso_estimado: '1500', venta_tipo: 'suscripcion', suscripcion_monto_usd: 800, suscripcion_meses: null,
    pagina_registro: 'https://negocio.com/registro', email_opt_out: false,
    entrada_social: { canal: 'instagram', como: 'comentario', at: '2026-10-09T16:58:00.000Z', post_id: 'p1', comentario_id: 'k1', texto: 'INFO' },
  };
  const d = datosDeLaFicha(lead, { id: 7, nombre: 'Mentoría', ticket_usd: 2000, modelo: 'unico' });
  assert.deepEqual(d, {
    web: 'https://negocio.com', instagram: 'ana.lopez', direccion: 'Av. 1',
    ingreso_estimado_usd: 1500, venta_tipo: 'suscripcion', suscripcion_mensual_usd: 800, suscripcion_meses: 'mes a mes',
    oferta: { id: 7, nombre: 'Mentoría', ticket_usd: 2000, modelo: 'unico' },
    pagina_registro: 'https://negocio.com/registro',
    entrada_social: { canal: 'instagram', como: 'Comentó tu publicación', cuando: '2026-10-09T16:58:00.000Z', comento: 'INFO', publicacion_id: 'p1' },
  });
  // Un ganado: el estimado no es una venta y la ficha lo oculta.
  assert.equal('ingreso_estimado_usd' in datosDeLaFicha({ ...lead, estado_lead: 'ganado' }), false);
  // La baja de los emails, sólo si es cierta; una oferta que no se pudo leer, con el id.
  assert.equal(datosDeLaFicha({ email_opt_out: true }).email_dado_de_baja, true);
  assert.deepEqual(datosDeLaFicha({}, { id: 3, nombre: null }), { oferta: { id: 3, nombre: null } });
  // Un plazo cargado se dice en meses.
  assert.equal(datosDeLaFicha({ venta_tipo: 'suscripcion', suscripcion_meses: 6 }).suscripcion_meses, 6);
});

// Rotura: devolver los campos vacíos como null → 4 / 2 (éste y el de arriba).
test('sólo lo que tiene valor: un lead vacío no gasta caracteres (MaKo Analyst corta la ficha en 5.000)', () => {
  assert.deepEqual(datosDeLaFicha({ estado_lead: 'abierto', web: null, instagram: '  ', ingreso_estimado: 0, venta_tipo: null, entrada_social: 'basura' }), {});
});

// Rotura: `landingParaModelo` devolviendo [] cuando no hay nada → 5 / 1 (éste).
test('lo que contestó en la landing: null es «nada guardado», y con topes', () => {
  assert.deepEqual(landingParaModelo(null), { formulario_landing: null });
  assert.deepEqual(landingParaModelo([]), { formulario_landing: null });
  assert.deepEqual(landingParaModelo([{ pregunta: 'Zona', respuesta: 'Palermo' }]), { formulario_landing: [{ pregunta: 'Zona', respuesta: 'Palermo' }] });
  const muchas = Array.from({ length: 20 }, (_, i) => ({ pregunta: `p${i}`.padEnd(80, 'x'), respuesta: 'r'.repeat(900) }));
  const r = landingParaModelo(muchas);
  assert.equal(r.formulario_landing!.length, TOPE_LANDING_MODELO.preguntas);
  assert.equal(r.formulario_landing_omitidas, 20 - TOPE_LANDING_MODELO.preguntas);
  for (const f of r.formulario_landing!) assert.ok(f.respuesta.length <= TOPE_LANDING_MODELO.respuesta);
  assert.ok(JSON.stringify(r).length < 5000, `peor caso: ${JSON.stringify(r).length}`);
});

// Rotura: sacar `...datosDeLaFicha(lead, oferta)` del return de ficha_lead → 5 / 1 (éste).
// Rotura: ficha_lead con las etapas del negocio en vez de `getPipelineStagesDeLead` → 5 / 1 (éste).
test('el cableado: ficha_lead y buscar_leads usan la etapa efectiva y la ficha completa', () => {
  const src = sinComentarios(leer('../lib/mako-tools.ts'));
  const resumen = src.slice(src.indexOf('function resumenLead('), src.indexOf('async function ofertaDeLaFicha('));
  assert.match(resumen, /\.\.\.etapaParaModelo\(l, etapas\),/);
  assert.doesNotMatch(resumen, /pipeline_stage/, 'la etapa cruda vuelve a decir null sobre leads que el equipo ve en una etapa');
  const ficha = src.slice(src.indexOf("case 'ficha_lead':"), src.indexOf("case 'historial_whatsapp':"));
  assert.match(ficha, /getPipelineStagesDeLead\(lead\)/, 'las etapas DEL LEAD, como la ficha (app\/crm\/\[id\]\/page.tsx)');
  assert.match(ficha, /lead: \{ \.\.\.resumenLead\(lead, etapas\), \.\.\.datosDeLaFicha\(lead, oferta\) \},/);
  assert.match(ficha, /\.\.\.landingParaModelo\(lead\.optin_respuestas\),/);
  const buscar = src.slice(src.indexOf("case 'buscar_leads':"), src.indexOf("case 'ficha_lead':"));
  assert.match(buscar, /\.map\(\(l\) => resumenLead\(l, etapas\)\)/);
  // La descripción le dice al modelo qué es un campo que no viene (y que null no es «no contestó»).
  const desc = src.match(/name: 'ficha_lead',\s*description: '([^']+)'/)?.[1] ?? '';
  assert.match(desc, /formulario_landing; null = no hay nada guardado, NO que no contestó/);
  assert.match(desc, /Un campo que no viene es un dato sin cargar/);
});

// ⚠️ REESCRITO EL 15/10/2026 porque cambió DÓNDE lee la ficha, no lo que se fija. Hasta el 14/10 la ruta
//    /crm/[id] (page.tsx) armaba sus datos a mano y este test leía ahí. Desde la ficha por bloques las DOS
//    puertas leen con `getLeadFullAction` (app/crm/actions.ts; lo fija tests/ficha-armador.test.ts), así
//    que la etapa de la ficha sale de ahí. La regla es la misma: las etapas DEL LEAD y, sin ellas, las de
//    por defecto, igual que `etapaParaModelo`.
// Rotura: `getLeadFullAction` con `getPipelineStagesDefault()` en vez de las del lead → 5 / 1 (éste).
// Rotura: sin caer a DEFAULT_STAGES cuando la lista viene vacía → 5 / 1 (éste).
test('la etapa de la ficha y la de MaKo salen de la misma lectura', () => {
  // La ficha: `getPipelineStagesDeLead(lead)` con DEFAULT_STAGES si falla o vino vacía. Si esto cambia,
  // MaKo vuelve a decir otra etapa que la pantalla: hay que cambiar las dos.
  const acc = sinComentarios(leer('../app/crm/actions.ts'));
  const ini = acc.indexOf('export async function getLeadFullAction');
  assert.ok(ini > 0, 'la lectura de la ficha ya no es getLeadFullAction');
  const cuerpo = acc.slice(ini, acc.indexOf('\nexport ', ini + 10));
  assert.match(cuerpo, /getPipelineStagesDeLead\(lead\)\.catch\(\(\) => DEFAULT_STAGES\)/);
  assert.match(cuerpo, /const stages = stagesRaw\.length \? stagesRaw : DEFAULT_STAGES;/);
  // Y la ruta no lee las etapas por su cuenta: es la misma lectura que el pop-up.
  const page = sinComentarios(leer('../app/crm/[id]/page.tsx'));
  assert.match(page, /await getLeadFullAction\(idNum\)/);
  assert.doesNotMatch(page, /getPipelineStages/);
});
