// =============================================================================
// Una estética para «Traer de otro funnel», el Scraper e «Importar» (24/10/2026, punto 20)
// =============================================================================
// Martín, textual: «Rediseña los modales de "scraper" y "de otro funnel", se ven muy feos, mira la captura la cantidad de
// botones que tienen, no se entiende nada... Y también rediseña el de "importar", que tiene una estetica MUY diferente,
// todos tienen que compartir estetica...». El molde (app/crm/MoldeTraer.tsx) se copió de la pantalla «Preview import» del
// importador de Attio (su documentación oficial): de dónde arriba con un «⋯», a dónde abajo, una línea de resumen con sus
// números, la lista, y el pie con SÓLO «Atrás» y la acción.
//   1. el molde dibujado (react-dom/server): el pie tiene dos botones, el «⋯» sólo si hay algo, el resumen con sus chips;
//   2. las tres vistas lo usan, y el importador dejó `WizardShell`;
//   3. el Scraper: lo que trabaja sobre los que ya están se fue al «⋯», y su «Parar» al pie.
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoldeTraer } from '../app/crm/MoldeTraer';

const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const nada = () => {};
const dibujar = (props: Partial<Parameters<typeof MoldeTraer>[0]>) =>
  renderToStaticMarkup(createElement(MoldeTraer, { children: createElement('table'), ...props } as Parameters<typeof MoldeTraer>[0]));

test('1. el pie lleva SÓLO «Atrás» y la acción; el «⋯» sale sólo con algo adentro', () => {
  const html = dibujar({
    fuente: createElement('select', { 'aria-label': 'De qué grupo' }),
    resumen: { texto: '131 para traer', chips: [{ texto: '2 ya están', tono: 'gris' }, { texto: 'No les manda nada', tono: 'gris' }] },
    atras: { onClick: nada }, accion: { texto: 'Traer 131', onClick: nada },
    mas: [{ id: 'empresa', texto: 'Datos de empresa', icono: 'cliente', onElegir: nada }],
  });
  assert.equal((html.match(/<button/g) ?? []).length, 3, 'el «⋯», «Atrás» y «Traer 131»: nada más');
  assert.match(html, />Atrás<\/button>/);
  assert.match(html, />Traer 131<\/button>/);
  assert.match(html, /aria-label="Más acciones"/);
  assert.match(html, /<strong[^>]*>131 para traer<\/strong>/);
  assert.match(html, /2 ya están/);
  assert.doesNotMatch(dibujar({ accion: { texto: 'Traer', onClick: nada } }), /Más acciones/, 'un «⋯» vacío no se dibuja');
  // Los pasos numerados, con el actual marcado.
  const pasos = dibujar({ pasos: { nombres: ['Archivo', 'Revisar'], actual: 1 } });
  assert.match(pasos, /aria-current="step"[^>]*>.*Revisar/);
});

test('2. las tres vistas usan el molde, y el importador dejó su molde propio', () => {
  for (const r of ['app/crm/TraerDeOtroProducto.tsx', 'app/crm/TraerDeGrupoWA.tsx', 'app/crm/ImportarLeadsModal.tsx']) {
    assert.match(leer(r), /<MoldeTraer\b/, `${r} no usa el molde`);
  }
  const imp = leer('app/crm/ImportarLeadsModal.tsx');
  assert.doesNotMatch(imp, /<WizardShell|from '\.\.\/_components\/WizardShell'/, 'el importador volvió a su estética aparte');
  assert.match(imp, /pasos=\{\{ nombres: \['Archivo', 'Revisar'\], actual: paso \}\}/);
});

test('3. el Scraper: completar y datos de empresa en el «⋯», y su «Parar» en el pie', () => {
  const g = leer('app/crm/TraerDeGrupoWA.tsx');
  const sinComentarios = g.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.doesNotMatch(sinComentarios, />\s*\{?[^<]*Completar desde mi WhatsApp[^<]*<\/button>|>Datos de empresa<|← Atrás<\/button>\s*\{\/\*/, 'volvieron los botones sueltos al pie');
  assert.match(g, /\{ id: 'empresa', texto: 'Datos de empresa', icono: 'cliente', onElegir: \(\) => void contarPerfiles\(\) \}/);
  assert.match(g, /accion: parar/, 'lo que corre no se puede parar');
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 3 / 0, de a una y restaurando de una copia:
//   · el molde dibujando el «⋯» aunque esté vacío (`mas.length >= 0`)                     → 2 / 1
//   · el importador volviendo a `WizardShell` en el import                                 → 2 / 1
//   · el Scraper sin el «Parar» en el estado (`...(parar ? { accion: parar } : {})` fuera) → 2 / 1
