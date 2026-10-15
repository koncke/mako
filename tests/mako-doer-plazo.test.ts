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
// Esas rutas no son de este carril: el `todo` de abajo queda hasta que alguien las suba (y entonces se le
// saca el todo, como se hizo con esPedidoDeLanding).
//
// PROBADO ROMPIÉNDOLO (15/10/2026, arnés que restaura de memoria y compara el sha256). Base: 1 / 0 (+1 todo).
//   · /api/mako-doer sin el maxDuration explícito                    → 0 / 1
//   · /api/mako-doer con incluirAcciones: true                       → 0 / 1
//   · /api/mako-doer con las herramientas de acción (confirmar_accion) → 0 / 1
// Restaurado: 1 / 0 (+1 todo).
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
  assert.match(src, /toolsDelRegistro\(\{ vista: await vistaDe\(ctx\), areas, incluirAcciones: false,/);
  assert.doesNotMatch(src, /mako-doer-acciones|MAKO_ACCION_TOOLS|confirmar_accion|confirmarPendiente/, 'acá no se confirma nada');
});

test('las rutas donde una confirmación por chat corre replicar_landing aguantan ~420 s', {
  todo: 'BLOQUEANTE de otro carril (MaKo Doer / Mobile / CRM): subir de 300 a 420 el maxDuration de estas rutas',
}, () => {
  const RUTAS = [
    'app/api/webhooks/evolution/route.ts',
    'app/api/m/mako/route.ts',
    'app/m/mako/page.tsx',
    'app/m/inbox/page.tsx',
    'app/mako/pendientes/page.tsx',
    'app/api/crm/mako/route.ts',
  ];
  for (const r of RUTAS) {
    const s = maxDurationDe(r);
    assert.ok(s != null && s >= 420 && s <= 800, `${r}: maxDuration ${s}`);
  }
});
