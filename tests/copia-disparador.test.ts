// =============================================================================
// #882: pegar una automatización en OTRO negocio no la deja en «manual»: la misma etapa, en un embudo de acá
// =============================================================================
// Martín en la revisión del 16/10/2026 (48:23): «saltó un error que dice: elige qué la dispara, su etapa no está en su
// negocio». La copia de Joan en la cuenta de Brigitte (ws15, #266) nació en MANUAL y prendida: no escuchaba nada.
// Probado rompiéndolo (17/10/2026, arnés `romper.py` + `roturas-882.json`; base 2 / 2): eligiendo el primer embudo cuando
// la etapa está en varios → 1 / 1 (cae el 1); mapeando aunque la etapa no exista → 1 / 1 (el 1); `crearDesdeCopia` sin
// reintentar con el CRON de acá → 1 / 1 (el 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cronParaEsteNegocio, type EmbudoDeAca } from '../lib/copia-disparador';
import type { Disparador } from '../lib/disparadores';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const etapas = (...k: string[]) => k.map((value) => ({ value }));
// Los embudos de Brigitte el 17/10: «Funnel principal» (10) y «Captacion Forms» (17), los dos con «lead».
const BRIGITTE: EmbudoDeAca[] = [
  { funnelId: 10, nombre: 'Funnel principal', etapas: etapas('lead', 'ganado') },
  { funnelId: 17, nombre: 'Captacion Forms', etapas: etapas('lead', 'st1', 'agenda', 'descal') },
  { funnelId: null, nombre: 'Un producto que sólo se entrega', etapas: [] },
];
const cron = (x: Partial<Disparador>): Disparador => ({ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'lead', etapas: null, funnel_id: 6, ...x }) as Disparador;

test('1. la misma etapa en un embudo de acá: uno → ése; varios → todos; ninguno → no se adivina', () => {
  // «lead» está en los dos embudos de Brigitte: todos (`funnel_id: null`), y lo dice.
  const varios = cronParaEsteNegocio([cron({})], BRIGITTE);
  assert.deepEqual(varios?.lista, [cron({ funnel_id: null })], 'elegir el primero sería adivinar: sus leads entran por el 17');
  assert.match(varios!.aviso, /todos tus funnels/);
  // «agenda» sólo está en el 17: ése.
  assert.deepEqual(cronParaEsteNegocio([cron({ etapa: 'agenda' })], BRIGITTE)?.lista, [cron({ etapa: 'agenda', funnel_id: 17 })]);
  // Varias etapas: el embudo que tiene TODAS.
  assert.deepEqual(cronParaEsteNegocio([cron({ etapa: 'lead', etapas: ['lead', 'st1'] })], BRIGITTE)?.lista, [cron({ etapa: 'lead', etapas: ['lead', 'st1'], funnel_id: 17 })]);
  // Una etapa que acá no existe: null (queda «Elige qué la dispara»).
  assert.equal(cronParaEsteNegocio([cron({ etapa: 'facturando' })], BRIGITTE), null);
  // Si su embudo SÍ es de acá, no hay nada que cambiar.
  assert.equal(cronParaEsteNegocio([cron({ funnel_id: 17 })], BRIGITTE), null);
  // Uno de etiqueta no se toca (su id no se reemplaza a ciegas), y sin uno de etapa que mapear no hay cambio.
  assert.equal(cronParaEsteNegocio([{ id: 'd1', trigger_tipo: 'etiqueta_agregada', etiqueta_id: 99 } as unknown as Disparador], BRIGITTE), null);
});

test('2. `crearDesdeCopia` reintenta con el CRON de acá antes de dejarla para elegir', () => {
  const src = leer('lib/flujo-copia-negocio.ts');
  const i = src.indexOf("aviso = 'Elige qué la dispara: su etapa no está en tu negocio.';");
  assert.ok(i > 0);
  const resto = src.slice(i, src.indexOf('return { id, nombre, aviso };', i));
  assert.match(resto, /const deAca = cronParaEsteNegocio\(copia\.disparadores, await productosConEtapas\(\)\);/);
  assert.match(resto, /await guardarDisparadores\(id, deAca\.lista\);\n\s*aviso = deAca\.aviso;/, 'la copia nacía en «manual»');
});
