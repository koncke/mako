// =============================================================================
// /general se rompía en todo negocio SIN OKR: el ejemplo de la Meta objetivo sin `funnelIds` (17/10/2026)
// =============================================================================
// Martín abrió /general en su Android (17/10/2026, 09:34 UTC) y salió app/error.tsx: «Cannot read properties of
// undefined (reading 'length')». La cadena: Martín no tiene informe de General guardado → la hoja es la de siempre
// (`informeGeneralInicial`, con «Meta objetivo» arriba) → el ws 9 no tiene OKR → el bloque dibuja el placeholder, que AL
// MONTAR pinta `CuerpoMeta` con `META_MUESTRA` → `objetivo.funnelIds.length` (app/general/bloques/Meta.tsx), y el ejemplo
// no tenía `funnelIds`: e5ded0af8 lo sumó al OKR y el `{…} as ObjectiveConAvance` de app/general/bloques/muestras.ts
// dejó pasar el objeto sin él. En el teléfono es la portada (/general → /m/hoy → GeneralM, la primera hoja); en la
// computadora, la miniatura «General» de la galería y la vista previa del menú «Bloques de General».
//
// Lo que fija: el ejemplo trae TODOS los campos del OKR (tipado, sin `as`) y la vista previa de la Meta objetivo se
// dibuja de verdad, por la misma `CuerpoMeta` que el placeholder.
// ⚠️ Meta.tsx arrastra módulos con `server-only` (EditarObjetivo → actions): el hook de abajo resuelve SÓLO ese
//    paquete con la condición `react-server` (su `empty.js`); React y lo demás quedan como en el navegador.
// Correr: node --import tsx --test tests/general-meta-muestra.test.ts
//
// PROBADO ROMPIÉNDOLO (17/10/2026; base en verde: 2 pasan, 0 fallan). Volviendo muestras.ts a como está en producción
// (70276424a: `{…} as ObjectiveConAvance`, sin `funnelIds`) -> 0 / 2: «el ejemplo…» (funnelIds undefined, y el `as`) y
// «la vista previa…» con el MISMO error de la captura, «TypeError: Cannot read properties of undefined (reading
// 'length')» en CuerpoMeta (Meta.tsx:94). Sólo con `funnelIds: []` y el `as` todavía -> 1 / 1 (el `as` de nuevo).
// Y el tipo declarado sin `funnelIds`: `node scripts/tsc-acotado.mjs app/general/bloques/muestras.ts` -> TS2322 en
// OBJETIVO_MUESTRA (muestras.ts:114), que es lo que el `as` callaba.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as modulo from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { FOCO_MUESTRA, META_MUESTRA } from '../app/general/bloques/muestras';
import type { DatosGeneral } from '../app/general/datos-tipos';

// `registerHooks` existe desde Node 22.15 (CI corre 24), pero @types/node 20 todavía no lo declara: se tipa acá.
type Ctx = { conditions?: string[] };
type Resolver = (spec: string, ctx: Ctx, next: (spec: string, ctx: Ctx) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { resolve: Resolver }) => void };

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'server-only') return next(spec, { ...ctx, conditions: [...(ctx.conditions ?? []), 'react-server'] });
    return next(spec, ctx);
  },
});

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el ejemplo de la Meta objetivo trae los campos del OKR (funnelIds incluido) y no se castea', () => {
  const o = META_MUESTRA.objetivo;
  assert.ok(Array.isArray(o.funnelIds), `funnelIds del ejemplo: ${JSON.stringify(o.funnelIds)}`);
  assert.deepEqual(o.funnelIds, [], 'el ejemplo es de todo el negocio');
  // El `as` es lo que escondió el campo faltante: con el tipo declarado, el próximo campo obligatorio lo frena el tsc.
  assert.doesNotMatch(sinComentarios('app/general/bloques/muestras.ts'), /\bas\s+ObjectiveConAvance\b/);
});

test('la vista previa de la Meta objetivo se dibuja en un negocio sin OKR (la del placeholder)', async () => {
  const { MuestraMetaObjetivo } = await import('../app/general/bloques/Meta');
  // Como llega de app/general/datos.ts cuando el negocio no tiene OKR: `objetivo: null`, lo demás de verdad.
  const d: DatosGeneral['cabecera'] = {
    ok: true,
    d: {
      objetivo: null, foco: FOCO_MUESTRA,
      capacidad: { cupo: null, activos: 0, libres: null, ocupacionPct: null, mesesEntrega: 6 },
      progreso: { qt: { anio: 2026, q: 4 }, desde: '2026-10-01', hasta: '2026-12-31', diasTotales: 92, diasTranscurridos: 17, diasRestantes: 75, fraccion: 17 / 92 },
      fraccion: 17 / 92, anio: 2026, quarter: 4, desglose: null, complemento: null,
    },
  };
  // «Editar la meta» (EditarObjetivo) pide el router de Next: uno que no navega.
  const nada = () => {};
  const router: AppRouterInstance = { back: nada, forward: nada, refresh: nada, push: nada, replace: nada, prefetch: nada };
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(MuestraMetaObjetivo, { d })));
  assert.match(html, /Meta objetivo/);
  assert.match(html, /\$18,600/, 'el número del ejemplo');
  assert.match(html, /Q4 2026/, 'el período es el de verdad');
});
