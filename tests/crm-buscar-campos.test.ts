// F150 (18/11/2026): la búsqueda avanzada del CRM, la del Plan (app/plan/board/BuscadorTareas.tsx): la flechita elige DÓNDE
// busca la barra. Sin tocar nada busca en todos los campos, como siempre (nada cambia para quien no la abre); achicar hace
// que «ana» no traiga a «mariana@…». El `#número` se busca siempre. Se ejecuta la regla de app/crm/buscar-leads.ts con
// `coincideBusqueda`, la misma que usa el tablero.
//
// Probado rompiéndolo (base 5/0):
//   · `camposDelLead` sin el id (el `#número` deja de buscarse) → 3/2;
//   · `camposDelLead` pasando todos los campos sin mirar los elegidos (la flechita no hace nada) → 4/1;
//   · el tablero buscando con la lista fija de antes en vez de `camposDelLead(l, camposBusqueda)` → 4/1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { coincideBusqueda } from '../lib/buscar-texto';
import {
  CAMPOS_LEAD, CAMPOS_LEAD_POR_DEFECTO, CAMPOS_LEAD_TODOS, camposAchicados, camposDelLead, resumenCamposLead, type CampoLead,
} from '../app/crm/buscar-leads';
import { arrobaInstagram } from '../app/crm/campo-inline';
import { marcasDeVoseo } from '../lib/voseo';

const leer = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const BETO = { id: 412, name: 'Beto Ruiz', company: 'Estudio Norte', email: 'mariana@estudionorte.com', phone: '+52 55 1234 5678', instagram: 'beto.ruiz' };
const busca = (q: string, campos: CampoLead[] = CAMPOS_LEAD_POR_DEFECTO) => coincideBusqueda(camposDelLead(BETO, campos), q);

test('sin tocar nada busca donde buscó siempre: id, nombre, empresa, email, teléfono e Instagram', () => {
  const antes = (q: string) => coincideBusqueda([BETO.id, BETO.name, BETO.company, BETO.email, BETO.phone, arrobaInstagram(BETO.instagram)], q);
  for (const q of ['beto', 'ruiz beto', 'norte', 'mariana', '@estudionorte.com', '1234', '@beto.ruiz', '#412', '412', 'otra', '#41']) {
    assert.equal(busca(q), antes(q), `«${q}» cambió de resultado sin tocar la flechita`);
  }
  assert.deepEqual(CAMPOS_LEAD_POR_DEFECTO, CAMPOS_LEAD_TODOS);
});

test('achicar: «ana» sólo en el nombre no trae al que la tiene en el email; el #número sale igual', () => {
  assert.equal(busca('mariana'), true, 'en todos, el email cuenta');
  assert.equal(busca('mariana', ['nombre']), false, 'sólo el nombre: el email no');
  assert.equal(busca('beto', ['nombre']), true);
  assert.equal(busca('#412', ['nombre']), true, 'el #número no es un campo: se busca siempre');
  assert.equal(busca('#412', []), true);
  assert.equal(busca('beto', []), false, 'sin ningún campo, un texto no encuentra nada');
  assert.equal(busca('@beto.ruiz', ['instagram']), true);
  assert.equal(busca('@beto.ruiz', ['email']), false);
});

test('el chip dice dónde se busca, y sale sólo al achicar', () => {
  assert.equal(camposAchicados(CAMPOS_LEAD_TODOS), false);
  assert.equal(camposAchicados(['nombre']), true);
  assert.equal(resumenCamposLead(CAMPOS_LEAD_TODOS), 'Todos los campos');
  assert.equal(resumenCamposLead(['nombre']), 'Nombre');
  assert.equal(resumenCamposLead(['nombre', 'email', 'telefono']), 'Nombre y 2 más');
  assert.equal(resumenCamposLead([]), 'Ningún campo');
});

test('los textos de la flechita: cortos, en español neutro', () => {
  for (const c of CAMPOS_LEAD) {
    assert.deepEqual(marcasDeVoseo(`${c.label} ${c.ayuda}`), [], `«${c.ayuda}» tiene voseo`);
    assert.ok(c.ayuda.length <= 60, `la ayuda de ${c.label} es una línea`);
  }
});

test('el tablero busca con los campos elegidos, y la barra los elige con la flechita del Plan', () => {
  const board = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(board, /const \[camposBusqueda, setCamposBusqueda\] = useState<CampoLead\[\]>\(CAMPOS_LEAD_POR_DEFECTO\);/);
  assert.match(board, /coincideBusqueda\(camposDelLead\(l, camposBusqueda\), linksDeInstagramComoArroba\(search\)\)/);
  assert.match(board, /<Buscador value=\{search\} onChange=\{setSearch\} campos=\{camposBusqueda\} onCampos=\{setCamposBusqueda\} \/>/);
  const tb = sinComentarios(leer('app/crm/CrmToolbar.tsx'));
  const b = tb.slice(tb.indexOf('export function Buscador('), tb.indexOf('const ATAJO_BUSCAR'));
  assert.match(b, /aria-label="Dónde buscar" aria-expanded=\{abierto\}/);
  assert.match(b, /<div data-buscador-panel style=\{\{/);
  assert.match(b, /\{CAMPOS_LEAD\.map\(\(c\) => \{/);
  assert.match(b, />Solo el nombre<\/button>/);
  assert.match(b, /\{resumenCamposLead\(campos!\)\}/);
});
