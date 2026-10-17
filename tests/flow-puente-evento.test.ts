// =============================================================================
// «Nada por detrás», lote 2: «Tus videos no se están generando» es una automatización de SuperAdmin (17/10/2026)
// =============================================================================
// docs/inventario-nada-por-detras.md, lote 2: `flow-puente-ausente` lo armaba el cron flow-abandono con su texto en el
// código (con singular y plural escritos ahí). Ahora es el evento de la plataforma `flow_puente_ausente`: el cron pasa sólo
// cuántas tomas quedaron (`datosPuenteAusente`) y la fila tiene el texto literal, que sirve para una toma y para varias.
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-flow.json`; base 3 / 0). Pasan / fallan:
//   P1 la cantidad sin su unidad («3» en vez de «3 tomas»)                          → 2 / 1
//   P2 el cron vuelve a pasar el texto escrito en el código                          → 2 / 1
//   P3 el evento sin `flow` en lo que trae (su dato no se ofrece ni se valida)       → 2 / 1
//
// Correr: node --import tsx --test tests/flow-puente-evento.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { datosDelEvento } from '../lib/aviso-evento';
import { EVENTOS_MAKO } from '../lib/disparadores';
import { datosPuenteAusente } from '../lib/flow-puente-aviso';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { textoConDatos } from '../lib/variables-del-lead';
import { partesDeMako } from '../lib/mako-tarjeta';
import { variablesPara } from '../lib/variables-aviso';
import { AVISOS_SOLO_SUPERADMIN } from '../lib/avisos-catalogo';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const tarjeta = (): string => {
  const p = pasosDePlantilla(plantillaPorId('mako-flow-puente-ausente')!)[0] as unknown as PasoGrafo;
  const parte = partesDeMako((p.accion as { params?: Record<string, unknown> }).params)[0];
  return parte && 'cuerpo' in parte ? String(parte.cuerpo) : '';
};

test('el texto de la fila, con una toma y con varias', () => {
  assert.equal(textoConDatos(tarjeta(), datosPuenteAusente(3)),
    '🔴 Tus videos no se están generando: tu navegador dejó de responder.\n⏸️ Sin tomar: *3 tomas*\n\nAbre la extensión de MaKo y toca *Conectar*. Las tomas no se cobraron: cuando vuelvas, las vuelves a mandar. — MaKo');
  assert.match(textoConDatos(tarjeta(), datosPuenteAusente(1)), /⏸️ Sin tomar: \*1 toma\*\n/);
});

test('el evento es de la plataforma, del super admin, y ofrece su dato', () => {
  const ev = EVENTOS_MAKO.find((e) => e.subtipo === 'flow_puente_ausente');
  assert.ok(ev && ev.plataforma === true && ev.aviso === 'flow-puente-ausente');
  assert.ok(AVISOS_SOLO_SUPERADMIN.includes('flow-puente-ausente'));
  assert.ok(variablesPara(datosDelEvento('flow_puente_ausente')).some((v) => v.key === 'flow_tomas'), 'falta {{flow_tomas}}');
});

test('el cron pasa sólo la cantidad, por código', () => {
  const src = leer('app/api/cron/flow-abandono/route.ts');
  assert.match(src, /emitirDelCatalogo\('flow-puente-ausente', \{ ws, datos: datosPuenteAusente\(cuantos\) \}\)/);
  assert.doesNotMatch(src, /texto:/, 'volvió el texto escrito en el código');
  assert.match(leer('scripts/mudanza-avisos-plataforma.mts'), /\{ plantilla: 'mako-flow-puente-ausente', evento: 'flow_puente_ausente' \}/);
});
