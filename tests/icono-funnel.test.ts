// =============================================================================
// El ícono de un funnel (un CRM) es UNO en toda la app: el cubo, en el control que elige funnels
// =============================================================================
// Martín, 17/10/2026, viendo «De qué funnels» con el ícono de las etapas en cada renglón: «Los íconos del CRM no son
// esos... Es el cubo que tenemos en el CRM... Hay que unificar los íconos». Había CUATRO dibujos para lo mismo: el cubo
// del set (`producto`, el selector del CRM), un cubo trazado a mano en tres archivos del CRM, el embudo del sidebar en
// Offer y el de las etapas en los selectores de General. Ahora sale de `ICONO_FUNNEL` (app/_ui/icono-funnel.ts).
//
// Correr: node --import tsx --test tests/icono-funnel.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 4/0): `ICONO_FUNNEL = 'etapa'` → 3 / 1; volver a dibujar el cubo a mano en
// app/crm/AccionesLoteLeads.tsx → 3 / 1; el embudo en el selector de Offer → 3 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ICONO_FUNNEL } from '../app/_ui/icono-funnel';
import { IconoFunnel } from '../app/_ui/iconos-menu';

const leer = (r: string) => readFileSync(r, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('el funnel es el cubo del set, y el dibujo sale de ahí', () => {
  assert.equal(ICONO_FUNNEL, 'producto');
  // El cubo: un hexágono con la arista del medio (el trazo de `producto` en app/_ui/iconos-menu.tsx).
  assert.match(renderToStaticMarkup(createElement(IconoFunnel)), /M12 3\.5 4\.5 7\.5v9l7\.5 4 7\.5-4v-9L12 3\.5Z/);
});

test('cada selector de funnels lleva ESE cubo en el control', () => {
  const casos: Array<[string, RegExp]> = [
    ['app/components/ElegirFunnels.tsx', /const icono = <IconoFunnel \/>;/],
    ['app/dashboard/Elemento.tsx', /ariaLabel="De qué funnel" icono=\{<IconoFunnel \/>\}/],
    ['app/crm/CrmToolbar.tsx', /icono=\{<IconoFunnel \/>\}/],
    ['app/crm/lead-view/ProductoDelLead.tsx', /<IconoFunnel \/>/],
    ['app/crm/AccionesLoteLeads.tsx', /<IconoFunnel \/>/],
    ['app/crm/CampanasModal.tsx', /icon=\{<IconoFunnel \/>\}/],
    ['app/offer/SelectorFunnel.tsx', /funnel: <IconoFunnel size=\{18\} \/>[\s\S]*icono=\{<IconoFunnel size=\{20\} \/>\}/],
    ['app/m/offer/OfferM.tsx', /<IconoFunnel size=\{18\} \/>/],
  ];
  for (const [archivo, re] of casos) assert.match(leer(archivo), re, `${archivo}: el funnel sin el cubo de la casa`);
  // Y los renglones de un funnel no repiten un ícono (el cubo va en el control).
  assert.doesNotMatch(leer('app/components/ElegirFunnels.tsx'), /icono: '/);
  // El embudo del sidebar es el de FILTRAR: ya no nombra un funnel en Offer.
  for (const f of ['app/offer/SelectorFunnel.tsx', 'app/m/offer/OfferM.tsx']) assert.doesNotMatch(leer(f), /<Icon name="funnel"/, f);
});

test('nadie vuelve a dibujar un cubo a mano', () => {
  const tsx = readdirSync('app', { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f));
  const conCubo = tsx.filter((f) => /M20\.6 7\.8 12 3 3\.4 7\.8 12 12\.6z|function IconoProducto\b/.test(readFileSync(join('app', f), 'utf8')));
  assert.deepEqual(conCubo, [], 'un cubo propio: usa IconoFunnel (app/_ui/iconos-menu.tsx)');
});

test('las listas armadas en un .ts piden el funnel por la constante', () => {
  assert.match(leer('app/crm/menu-contextual-crm.ts'), /lote_funnel: \{ texto: 'Agregar a un funnel', icono: ICONO_FUNNEL \}/);
  assert.match(leer('app/crm/CampanasModal.tsx'), /\{ v: 'este', label: `En \$\{nombreProducto\}`, icono: ICONO_FUNNEL \}/);
});
