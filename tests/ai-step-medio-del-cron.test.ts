// =============================================================================
// Un AI Step nuevo nace con el medio del CRON (10/11/2026)
// =============================================================================
// La auditoría de Automations para un usuario nuevo (Martín, 9/11: «Leandro lo estuvo intentando utilizar y no lo pudo»):
// en una automatización que dispara un DM de Instagram, el AI Step nacía en WhatsApp. Escuchaba por WhatsApp, nadie le
// contestaba al lead en Instagram, y Activar le pedía conectar un WhatsApp a quien sólo usa Instagram. Lo que fija, ejecutando:
//   1. la regla: el medio cambia sólo si TODOS los CRON llegan por el mismo medio social; si no, WhatsApp, como siempre;
//   2. el ＋, el click derecho (suelta) y el menú lo usan: nace con ese medio, y «ya hay uno» se pregunta por ESE medio;
//   3. la pantalla le pasa el medio al lienzo y a su propio ＋.
// Probado rompiéndolo (10/11/2026, base 3/0): la regla devolviendo siempre WhatsApp → 1 rojo; `insertarDesdeLienzo` sin
// `conMedioIA` → 1 rojo; el menú preguntando siempre por WhatsApp → 1 rojo; la pantalla sin `medioIA={medioIA}` → 1 rojo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { medioIADeLosCron } from '../lib/medios-automatizacion';
import { insertarDesdeLienzo, opcionesDelMas, opcionesSueltas, type PasoParaGrafo } from '../lib/flujo-conversacion';
import { crearSuelta } from '../lib/flujo-edicion';
import { esPasoIA, medioDe, ID_INICIO, type PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const IG = { trigger_tipo: 'instagram', cron: null };
const MS = { trigger_tipo: 'messenger', cron: null };
const ETAPA = { trigger_tipo: 'etapa', cron: null };
const BASE = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, template_wa: null, proveedor: 'no_oficial', cuerpo: '' } as const;
const aiStepWa = { ...BASE, id: 'ia1', nodo: 'respuesta', paso_ia: true, casos: [], si_no: null, siguiente: null } as unknown as PasoParaGrafo;
const VACIO: PasoParaGrafo[] = [];
const VACIO_G: PasoGrafo[] = [];

test('1. la regla: el medio del CRON sólo si es inequívoco', () => {
  assert.equal(medioIADeLosCron([IG]), 'instagram');
  assert.equal(medioIADeLosCron([MS, MS]), 'messenger');
  assert.equal(medioIADeLosCron([IG, MS]), 'whatsapp', 'dos medios sociales: lo de siempre');
  assert.equal(medioIADeLosCron([ETAPA, IG]), 'whatsapp', 'un CRON de etapa no llega por Instagram');
  assert.equal(medioIADeLosCron([ETAPA]), 'whatsapp');
  assert.equal(medioIADeLosCron([]), 'whatsapp');
  assert.equal(medioIADeLosCron(null), 'whatsapp');
});

test('2. el ＋, la tarjeta suelta y los menús nacen con ese medio, y lo cuentan por medio', () => {
  const r = insertarDesdeLienzo(VACIO, ID_INICIO, undefined, 'ai_step', Math.random, { medioIA: 'instagram' });
  const n = r.pasos.find((p) => p.id === r.id);
  assert.ok(n && esPasoIA(n), 'se creó el AI Step');
  assert.equal(medioDe(n), 'instagram', 'nace por Instagram');
  const s = crearSuelta(VACIO_G, 'ai_step', Math.random, { medioIA: 'messenger' });
  assert.equal(medioDe(s.pasos.find((p) => p.id === s.id)), 'messenger');
  // Con un AI Step de WhatsApp ya puesto, se puede sumar el de Instagram (uno POR MEDIO), y el menú lo ofrece.
  const con = insertarDesdeLienzo([aiStepWa], ID_INICIO, undefined, 'ai_step', Math.random, { medioIA: 'instagram' });
  assert.ok(con.id, 'el de Instagram se suma al de WhatsApp');
  assert.ok(opcionesDelMas([aiStepWa], ID_INICIO, false, undefined, 'instagram').some((o) => o.value === 'ai_step'));
  assert.ok(opcionesSueltas([aiStepWa], 'instagram').some((o) => o.value === 'ai_step'));
  // Sin medio, lo de siempre: WhatsApp, y con uno de WhatsApp puesto no se ofrece otro.
  const wa = insertarDesdeLienzo(VACIO, ID_INICIO, undefined, 'ai_step');
  assert.equal(medioDe(wa.pasos.find((p) => p.id === wa.id)), 'whatsapp');
  assert.ok(!opcionesDelMas([aiStepWa], ID_INICIO, false).some((o) => o.value === 'ai_step'));
});

test('3. la pantalla le pasa el medio del CRON al lienzo y a su ＋', () => {
  const src = leer('app/automations/SecuenciaPerfil.tsx');
  assert.match(src, /const medioIA = medioIADeLosCron\(crons\.lista\);/);
  assert.match(src, /insertarDesdeLienzo\(pasos, nodo, puerto, que, Math\.random, \{ medioIA \}\)/);
  assert.match(src, /medioIA=\{medioIA\}/);
  const lienzo = leer('app/automations/FlujoLienzo.tsx');
  assert.match(lienzo, /crearSuelta\(pasos, que, Math\.random, \{ medioIA \}\)/);
  assert.match(lienzo, /opcionesDelMas\(pasos, nodo, medio, puerto, medioIA\)/);
});
