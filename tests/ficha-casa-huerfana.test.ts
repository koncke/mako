// =============================================================================
// «N sin marcar» de un lead cuya casa ya no existe: el MISMO número en la ficha y en el worklist
// =============================================================================
// `leads.funnel_id` no tiene FK a propósito (mig 0181): «un `funnel_id` que apunta a un funnel que ya no
// existe se comporta igual que un NULL», o sea, el funnel del negocio. Los dos lectores de UN funnel lo
// cumplen (`apagadosDeFunnel` y `fichaDelFunnelDelLead`, lib/ficha/config-server.ts: si el funnel no está,
// `leerFichaDeFunnel(null)`), y con eso cuentan la ficha del pop-up, /crm/[id], el teléfono y MaKo. El
// worklist (y «A revisar», que sale de él) lee TODOS los funnels de una vez (`avisosDelWorkspace`) y, para
// una casa que no estaba en el mapa, caía al respaldo PELADO del negocio (`crm.datos_aviso.apagados`), sin
// la plantilla del funnel del negocio. Revisión del 16/10/2026: un lead de ese tipo en un negocio con la
// plantilla «Te escriben» (y el respaldo del negocio sin tocar), en Ganado con todo por cargar, decía
// «6 sin marcar» en su ficha y salía con 12 en «A revisar».
//
// Cómo se llega a una casa huérfana: borrar un funnel rescata a su gente ANTES (`eliminarFunnelDefinitivo`),
// pero el alta y la importación escriben el `funnelId` del tablero abierto sin mirar si existe
// (app/crm/actions.ts, `altaDeLead` e `importarLeadsRevisadosAction`): un tablero que quedó abierto sobre un
// funnel que otra persona borró, o un id de otro workspace. Medido en producción el 16/10/2026: 0 leads con
// la casa huérfana (de 33 con casa propia), así que hoy no cambia ningún número; es la regla para cuando pase.
//
// Correr: node --import tsx --test tests/ficha-casa-huerfana.test.ts
//
// ⚠️ ROJO ANTES DEL ARREGLO: con la regla del worklist sacada tal cual a `apagadosDeLaCasa` (sin cambiarla),
//    1 / 1 (el primer test, en la casa huérfana y en la de otro workspace).
// ⚠️ VERIFICADO ROMPIÉNDOLO (16/10/2026, base 2/0), cada rotura restaurada de memoria antes de la siguiente:
//   · la casa huérfana cae al respaldo pelado (la regla vieja del worklist)   → 1 / 1
//   · la casa NULL sin el funnel del negocio                                  → 1 / 1
//   · devuelve el arreglo del mapa sin copiarlo                               → 1 / 1
//   · el worklist resuelve la casa por su cuenta (sin `apagadosDeLaCasa`)     → 1 / 1
//   · `apagadosDeFunnel` sin caer al funnel del negocio                       → 1 / 1
//   · `fichaDelFunnelDelLead` sin caer al funnel del negocio                  → 1 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apagadosDeLaCasa, fichaEfectiva, RESPALDO_VACIO } from '../lib/ficha/config';
import { avisanDelLead } from '../lib/datos-aviso';
import { stepsForStage, type StageReqValues } from '../lib/stage-requirements';
import type { StepId } from '../lib/stage-requirements';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, desde: string, hasta: string): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  return src.slice(i, j < 0 ? undefined : j);
};

// Un workspace como el ws3: el funnel del negocio (8) con la plantilla «Te escriben», otro (30) con
// «Carrito» y uno archivado (41) con «Evento». El respaldo del negocio apaga sólo la empresa.
const NEGOCIO = 8;
const POR_FUNNEL = new Map<number, StepId[]>([
  [NEGOCIO, fichaEfectiva('te-escriben', {}, RESPALDO_VACIO).apagados],
  [30, fichaEfectiva('carrito', {}, RESPALDO_VACIO).apagados],
  [41, fichaEfectiva('evento', {}, RESPALDO_VACIO).apagados],
]);
const DEL_NEGOCIO: StepId[] = ['empresa'];

/** La regla de los lectores de UN funnel: el suyo si existe; si no (NULL o borrado), el del negocio; sin funnels, el respaldo. */
const comoLaFicha = (casa: number | null | undefined): StepId[] =>
  [...((casa != null ? POR_FUNNEL.get(casa) : undefined) ?? POR_FUNNEL.get(NEGOCIO) ?? DEL_NEGOCIO)];

// Un lead en Ganado con casi todo por cargar: avisa de muchos datos distintos.
const GANADO: StageReqValues = {
  fechaJ1: '2026-10-01', asistioJ1: null, calificado: null, hasFathomUrl: false, fechaJ2: '2026-10-05', asistioJ2: true,
  monto: null, tienePlan: false, dealServicioOk: false, dealPromesaOk: false, dealFiscalOk: false, dealObligacionesOk: false,
  closer: '', setter: '', empresa: '', telefono: '', hoyISO: '2026-10-16',
};
const FALTAN = stepsForStage('ganado', GANADO);

test('una casa que ya no existe cuenta como una sin casa: el worklist da el número de la ficha', () => {
  assert.notDeepEqual(POR_FUNNEL.get(NEGOCIO), DEL_NEGOCIO, 'el caso tiene que distinguir la plantilla del funnel del negocio del respaldo pelado');
  const casas: Array<[string, number | null | undefined]> = [
    ['sin casa (NULL)', null], ['sin casa (undefined)', undefined], ['el funnel del negocio', NEGOCIO], ['otro funnel', 30],
    ['un funnel archivado', 41], ['un funnel borrado', 999], ['un funnel de otro workspace', 5],
  ];
  for (const [nombre, casa] of casas) {
    const worklist = apagadosDeLaCasa(POR_FUNNEL, NEGOCIO, DEL_NEGOCIO, casa);
    assert.deepEqual(worklist, comoLaFicha(casa), `${nombre}: los apagados`);
    assert.equal(avisanDelLead(FALTAN, {}, worklist).length, avisanDelLead(FALTAN, {}, comoLaFicha(casa)).length, `${nombre}: «N sin marcar»`);
  }
  // Sin ningún funnel leído, el respaldo del negocio (es lo que hace `apagadosDeFunnel` sin filas).
  assert.deepEqual(apagadosDeLaCasa(new Map(), null, DEL_NEGOCIO, 999), DEL_NEGOCIO);
  assert.deepEqual(apagadosDeLaCasa(new Map(), null, DEL_NEGOCIO, null), DEL_NEGOCIO);
  // Devuelve una copia: quien la recibe no le cambia el mapa al lead siguiente.
  const antes = [...POR_FUNNEL.get(30)!];
  const a = apagadosDeLaCasa(POR_FUNNEL, NEGOCIO, DEL_NEGOCIO, 30);
  a.push('closer');
  assert.deepEqual(apagadosDeLaCasa(POR_FUNNEL, NEGOCIO, DEL_NEGOCIO, 30), antes);
});

test('los tres lectores de la casa usan la misma regla: el worklist por `apagadosDeLaCasa`, los de un funnel caen al del negocio', () => {
  const src = sinComentarios(leer('lib/ficha/config-server.ts'));
  const work = tramo(src, 'export async function avisosDelWorkspace', '\nexport ');
  assert.match(work, /apagadosDe: \(fid\) => apagadosDeLaCasa\(porId, defaultId, delNegocio, fid\)/, 'el worklist resuelve la casa con la regla compartida');
  assert.doesNotMatch(work, /porId\.get\(/, 'el worklist no resuelve la casa por su cuenta');
  const uno = tramo(src, 'export async function apagadosDeFunnel', '\nexport ');
  assert.match(uno, /if \(f\) return f\.efectiva\.apagados;\s*const d = await leerFichaDeFunnel\(null\);/, 'apagadosDeFunnel: un funnel que no está cae al del negocio');
  const ficha = tramo(src, 'export async function fichaDelFunnelDelLead', '\nexport ');
  assert.match(ficha, /if \(f \|\| funnelId == null\) return f;\s*return await leerFichaDeFunnel\(null\);/, 'fichaDelFunnelDelLead: un funnel que no está cae al del negocio');
});
