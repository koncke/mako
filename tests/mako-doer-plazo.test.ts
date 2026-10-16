// =============================================================================
// El plazo de las rutas de MaKo donde una confirmación por chat corre replicar_landing / analizar_landing
// =============================================================================
// Pendiente de la tanda 6 del Web Generator: «/api/mako-doer sin maxDuration para los 240 s de replicar por
// chat». MEDIDO el 15/10/2026 (tanda 7) y era el diagnóstico equivocado:
//   · /api/mako-doer (el chat de escritorio) es SÓLO LECTURA: `incluirAcciones: false` y sin las herramientas
//     de acción (`confirmar_accion`): ahí no se confirma ni se ejecuta nada. Y sin maxDuration ya corría 300 s:
//     el proyecto de Vercel tiene fluid compute con `functionDefaultTimeout: 300` (GET a la API de Vercel; plan
//     Pro, tope 800 con fluid). Se deja 300 EXPLÍCITO para no depender de esa configuración.
//   · Donde SÍ corre una confirmación por chat: el webhook de Evolution (el «sí» por WhatsApp), /api/m/mako y
//     las server actions de /m/mako, /m/inbox y /mako/pendientes, y /api/crm/mako. Todas con 300. replicar
//     por bloques corre hasta ~275 s (lib/editor-landing/replicar.ts: imágenes hasta los 265 s desde que
//     arranca, más guardar el tema y crear), y antes y después van los pasos del modelo y el envío: 300 lo
//     corta. Lo justo: 420 (275 + dos pasos del modelo y el envío, ~60, + margen). analizar_landing (150 s
//     de presupuesto, lib/landing-analyst.ts) entra en 300.
// La corrección de la tanda 7 (15/10/2026) las subió a 420 y le sacó el `todo` al segundo test. Y como
// `maxDuration` no acota al navegador (AGENTS.md: el `signal` va con el tope de la ruta + un margen), el
// corte de las dos pantallas que llaman a esas rutas con `fetch` pasó de 305 a 425 s: con el server en 420
// y el navegador en 305, la persona vería «se cortó» mientras replicar sigue corriendo.
//
// PROBADO ROMPIÉNDOLO (15/10/2026, arnés que restaura de memoria y compara el sha256). Base: 3 / 0.
//   · /api/mako-doer sin el maxDuration explícito                         → 2 / 1
//   · /api/mako-doer con incluirAcciones: true                            → 2 / 1
//   · /api/mako-doer con las herramientas de acción (confirmar_accion)    → 2 / 1
//   · el webhook de Evolution de vuelta en 300                            → 2 / 1 «las rutas… aguantan ~420 s»
//   · /mako/pendientes sin maxDuration                                    → 2 / 1 «las rutas… aguantan ~420 s»
//   · /api/crm/mako en 900 (más que el tope del plan)                     → 1 / 2 «las rutas… aguantan ~420 s» y
//                                                                           «el corte del navegador…» (425 s < 900 s)
//   · ChatMako.tsx con el corte del navegador en 305_000                  → 2 / 1 «el corte del navegador…»
//   · ChatMakoCrm.tsx con el corte del navegador en 500_000 (espera de más) → 2 / 1 «el corte del navegador…»
// Restaurado: 3 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const maxDurationDe = (rel: string): number | null => {
  const m = /^export const maxDuration = (\d+);/m.exec(sinComentarios(leer(rel)));
  return m ? Number(m[1]) : null;
};

test('/api/mako-doer es SÓLO LECTURA y declara su plazo (300) sin depender del default del proyecto', () => {
  const src = sinComentarios(leer('app/api/mako-doer/route.ts'));
  assert.equal(maxDurationDe('app/api/mako-doer/route.ts'), 300);
  // La auditoría de seguridad del 14/10 (main, 52e2c0d07) sacó la vista a una constante (`const vista = await
  // vistaDe(ctx)`): el merge de la tanda 7 dejó este test en rojo hasta aceptar las dos formas.
  assert.match(src, /toolsDelRegistro\(\{ vista(?:: await vistaDe\(ctx\))?, areas, incluirAcciones: false,/);
  assert.doesNotMatch(src, /mako-doer-acciones|MAKO_ACCION_TOOLS|confirmar_accion|confirmarPendiente/, 'acá no se confirma nada');
});

test('las rutas donde una confirmación por chat corre replicar_landing aguantan ~420 s', () => {
  const RUTAS = [
    'app/api/webhooks/evolution/route.ts',
    'app/api/m/mako/route.ts',
    'app/m/mako/page.tsx',
    'app/m/inbox/page.tsx',
    'app/mako/pendientes/page.tsx',
    'app/api/crm/mako/route.ts',
    'app/api/mako/chat/route.ts',
  ];
  for (const r of RUTAS) {
    const s = maxDurationDe(r);
    assert.ok(s != null && s >= 420 && s <= 800, `${r}: maxDuration ${s}`);
  }
});

test('el corte del navegador de esas pantallas va DESPUÉS del techo de su ruta (y no mucho después)', () => {
  const PANTALLAS: Array<[string, string]> = [
    ['app/m/mako/ChatMako.tsx', 'app/api/m/mako/route.ts'],
    ['app/crm/mako-crm/ChatMakoCrm.tsx', 'app/api/crm/mako/route.ts'],
    ['app/second-brain/ChatSecondBrain.tsx', 'app/api/mako/chat/route.ts'],
  ];
  for (const [pantalla, ruta] of PANTALLAS) {
    const src = sinComentarios(leer(pantalla));
    const m = /^const TOPE_MS = ([\d_]+);/m.exec(src);
    assert.ok(m, `${pantalla}: no encontré TOPE_MS`);
    const tope = Number(m[1].replace(/_/g, ''));
    const techo = (maxDurationDe(ruta) ?? 0) * 1000;
    assert.ok(tope > techo && tope <= techo + 15_000, `${pantalla}: corta a los ${tope} ms y su ruta a los ${techo}`);
    assert.match(src, /signal: AbortSignal\.timeout\(TOPE_MS\)/, `${pantalla}: el pedido largo no usa TOPE_MS`);
  }
});
