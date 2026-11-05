// =============================================================================
// MaKo toma la iniciativa en el CRM: la apertura de la estrella y la guía del tablero (5/11/2026, T7 de docs/mako-iniciativa/plan.md)
// =============================================================================
// Martín (29/10/2026): «en todos lados que haya un chat de MaKo, que MaKo te vaya guiando… dependiendo de la situación de la
// persona» y «cada vez que un usuario entra por primera vez a una tab, Mako le puede preguntar… ¿quieres que te ayude a aprender a
// utilizar esta pestaña?». Lo que se fija:
//   1. la apertura (lib/aperturas/crm.ts): con el CRM vacío pregunta un HECHO, «¿Dónde tienes hoy a tus clientes?», sólo a quien
//      administra; cada respuesta lleva a donde se cargan (el importador del tablero, el QR de WhatsApp); con leads, o con la
//      lectura caída, calla;
//   2. el montaje: la estrella del CRM le pasa la apertura a MakoEnLaTab ANTES de `arriba=`, calla con sugerencias en el bloque o
//      con la guía hablando, y la página cuenta los leads del NEGOCIO (no del funnel) con su error mirado;
//   3. `/crm?importar=1` abre «Importar leads» al entrar (sobre el cambio del prop: la estrella navega a la misma página) y saca el
//      parámetro de la URL;
//   4. la guía (app/crm/guia-crm.ts): «Cargar tus clientes» va primero con el CRM vacío y sólo al admin; «Buscar un lead», sólo con
//      leads; la estrella llama a useGuiaDeLaTab('crm').
//
// Correr: node --import tsx --test tests/iniciativa-crm.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HREF_WHATSAPP, aperturaCrm, hrefImportar } from '../lib/aperturas/crm';
import { PREGUNTA_DE_ACCION, problemasDeApertura } from '../lib/aperturas/reglas';
import { objetivosOfrecidos } from '../lib/guia/reglas';
import { GUIA_CRM } from '../app/crm/guia-crm';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la apertura: con el CRM vacío, el admin; cada respuesta lleva a donde se cargan; con leads o sin saber, calla', () => {
  const a = aperturaCrm({ leads: 0, esAdmin: true, funnelId: 7 }, {})!;
  assert.equal(a.id, 'crm:clientes');
  assert.match(a.texto, /¿Dónde tienes hoy a tus clientes\?$/);
  assert.doesNotMatch(a.texto, PREGUNTA_DE_ACCION, 'pregunta un hecho, no una acción');
  assert.deepEqual(problemasDeApertura(a, { primerPaso: true }), []);
  const hrefs = a.botones.map((b) => (b.tipo === 'ir' ? b.href : b.tipo));
  assert.deepEqual(hrefs, ['/crm?importar=1&funnel=7', '/crm?importar=1&funnel=7', HREF_WHATSAPP, 'callar'], 'la planilla y el otro CRM, al importador del funnel que se mira');
  assert.equal(hrefImportar(null), '/crm?importar=1');
  assert.equal(HREF_WHATSAPP, '/chats?conectar=whatsapp', 'el QR de siempre (el link a una conexión es contrato)');
  assert.equal(aperturaCrm({ leads: 3, esAdmin: true, funnelId: null }, {}), null, 'con leads hablan las sugerencias medidas');
  assert.equal(aperturaCrm({ leads: 0, esAdmin: false, funnelId: null }, {}), null, 'un closer no carga la base');
  assert.equal(aperturaCrm({ leads: null, esAdmin: true, funnelId: null }, {}), null, 'una lectura caída no es «no tienes»');
});

test('2. el montaje: la estrella pasa la apertura antes de `arriba=`, calla con sugerencias o con la guía, y la página cuenta el NEGOCIO', () => {
  const panel = sinComentarios(leer('app/crm/mako-crm/PanelMakoCrm.tsx'));
  assert.match(panel, /useApertura\(\{ superficie: SUPERFICIE_CRM, hechos, libre: sugs != null && n === 0 && !guia\.pregunta && !guia\.senalando && !guia\.esperando \}\)/,
    'calla mientras cargan las sugerencias, con algo en el bloque y con la guía hablando o señalando');
  assert.match(panel, /<MakoEnLaTab tab="CRM" apertura=\{aperturaTab\} entidad=/);
  const page = sinComentarios(leer('app/crm/page.tsx'));
  assert.match(page, /db\.from\('leads'\)\.select\('id', \{ count: 'exact', head: true \}\)/, 'todos los leads, no los del funnel');
  assert.match(page, /\.then\(\(\{ count, error \}\) => \(error \? null : count \?\? 0\), \(\) => null\)/, 'el error, mirado: null calla');
  assert.match(page, /<PanelMakoCrm funnelId=\{funnelId\} apertura=\{\{ leads: leadsNegocio, esAdmin: puedeCrearCrm \}\} \/>/);
});

test('3. `/crm?importar=1` abre «Importar leads» al entrar, sobre el cambio del prop, y saca el parámetro', () => {
  const page = sinComentarios(leer('app/crm/page.tsx'));
  assert.match(page, /const abrirImportar = sp\?\.importar === '1';/);
  assert.match(page, /abrirImportar=\{abrirImportar\}/);
  const board = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  const efecto = board.slice(board.indexOf('if (!abrirImportar) return;') - 30, board.indexOf('}, [abrirImportar]);') + 20);
  assert.ok(efecto.length > 60 && efecto.length < 600, 'el efecto del importador');
  assert.match(efecto, /setImportar\(true\);/);
  assert.match(efecto, /u\.searchParams\.delete\('importar'\);/, 'un F5 no lo vuelve a abrir');
});

test('4. la guía del CRM: «Cargar tus clientes» primero con el CRM vacío y sólo al admin; «Buscar», sólo con leads', () => {
  const presente = () => true;
  const vacio = objetivosOfrecidos(GUIA_CRM, { sinLeads: true }, presente, 'admin').map((o) => o.id);
  assert.equal(vacio[0], 'importar', 'con el CRM vacío, cargar los clientes va primero');
  assert.ok(!vacio.includes('buscar'), 'no se enseña a buscar en un CRM vacío');
  assert.ok(!objetivosOfrecidos(GUIA_CRM, { sinLeads: true }, presente, 'miembro').some((o) => o.id === 'importar'), 'un closer no carga la base');
  assert.ok(objetivosOfrecidos(GUIA_CRM, { sinLeads: false }, presente, 'admin').some((o) => o.id === 'buscar'));
  const panel = sinComentarios(leer('app/crm/mako-crm/PanelMakoCrm.tsx'));
  assert.match(panel, /useGuiaDeLaTab\('crm', \{ listo: sugs != null, hechos: \{ sinLeads \}, rol: datos\?\.esAdmin \? 'admin' : 'miembro' \}\);/);
  const barra = sinComentarios(leer('app/crm/CrmToolbar.tsx'));
  for (const id of ['crm-nuevo', 'crm-mas', 'crm-buscar', 'crm-funnels']) assert.match(barra, new RegExp(`\\{\\.\\.\\.ancla\\('${id}'\\)\\}`), id);
});

// PROBADO ROMPIÉNDOLO (5/11/2026, base 4/0):
//   · la apertura también a un closer                                   → 3/1 (1)
//   · la apertura no calla con sugerencias en el bloque                 → 3/1 (2)
//   · la página no mira el error del conteo (count ?? 0)                → 3/1 (2)
//   · el importador no saca `importar` de la URL                        → 3/1 (3)
//   · «Cargar tus clientes» sin `roles: ['admin']`                      → 3/1 (4)
