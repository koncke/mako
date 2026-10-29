// =============================================================================
// «Mandar mensaje de difusión» desde el «⋯» de una columna del CRM (29/10/2026). Martín: «¿Se está ejecutando todo lo del
// CRM, como lo que quería Leila de enviar un mensaje de difusión en los 3 puntitos de la columna?». Estaba hecho en dos
// ramas que nadie juntó: la barra en bloque con `onMandarMensaje` (crm-lote-2810) sin nadie que se lo pasara, y la hoja de
// Automations (`HojaDifusion`, aut-2510) sin montar. Y el «⋯» no tenía la opción.
//
// Lo que se encontró al juntarlas: una columna del funnel PRINCIPAL viajaba con `funnelId: null` (así llega `funnelActivo`),
// y el server lee `{ funnelId: null, etapa }` como esa etapa en TODOS los funnels (`ambitoDeFunnel(null)` → «todos»): la
// difusión a «Contacto nuevo» le llegaba también a los de los otros funnels. Ahora el principal va con su id, y sin id, los
// ids que se ven.
//
// Sin mandar nada: estos tests no llaman a `crearDifusionAction`.
// ── Probado rompiéndolo (29/10/2026), de a una y restaurando. Ver el pie. ──
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seleccionDeColumna, seleccionDeDifusion, textoDifusionDeColumna } from '../app/crm/seleccion-difusion';
import { itemsCrm, opcionesCrm, SECCION_COLUMNA, type ContextoCrm, type DatosMenuCrm } from '../app/crm/menu-contextual-crm';
import { ambitoDeSecuencia } from '../lib/nutricion-ambito';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('la columna entera va como columna (la resuelve el server, sin el tope de lo cargado); con filtros, los que se ven', () => {
  assert.deepEqual(seleccionDeColumna({ etapa: 'lead', funnelId: 18 }, [1, 2, 3], false), { funnelId: 18, etapa: 'lead' });
  assert.deepEqual(seleccionDeColumna({ etapa: 'lead', funnelId: 18 }, [2, 3], true), { leadIds: [2, 3] });
});

test('⚠️ sin el id del funnel NUNCA va la columna: el server la leería en TODOS los funnels', () => {
  // Por qué: el ámbito sin funnel es «todos» (lib/nutricion-ambito.ts), y con el id del principal, el negocio.
  assert.deepEqual(ambitoDeSecuencia(null, null), { modo: 'todos' });
  assert.deepEqual(ambitoDeSecuencia(18, true), { modo: 'negocio', id: 18 });
  assert.deepEqual(seleccionDeColumna({ etapa: 'lead', funnelId: null }, [7, 8], false), { leadIds: [7, 8] });
  assert.deepEqual(seleccionDeDifusion([7, 8], { etapa: 'lead', funnelId: null }), { leadIds: [7, 8] }, 'también la barra en bloque');
  assert.deepEqual(seleccionDeDifusion([1, 2], { etapa: 'contacto_nuevo', funnelId: 44 }), { funnelId: 44, etapa: 'contacto_nuevo' });
});

test('el renglón del «⋯»: «Mandar mensaje de difusión», o «a los N que se ven» con filtros', () => {
  assert.equal(textoDifusionDeColumna(394, false), 'Mandar mensaje de difusión');
  assert.equal(textoDifusionDeColumna(12, true), 'Mandar mensaje a los 12 que se ven');
  assert.equal(textoDifusionDeColumna(1, true), 'Mandar mensaje al que se ve');
});

const columna = (difusion: { visibles: number; filtrado: boolean } | null): ContextoCrm =>
  ({ sobre: 'columna', mover: true, entrada: false, curso: null, borrable: false, difusion });
const DATOS: DatosMenuCrm = { etapas: [], equipo: [], etiquetas: [], funnels: [] };

test('en el «⋯» de la columna (el mismo menú que el clic derecho), en «Leads», debajo de «Ordenar»; sin nadie o sin admin, no está', () => {
  const ids = opcionesCrm(columna({ visibles: 394, filtrado: false }));
  assert.equal(ids[ids.indexOf('col_ordenar') + 1], 'col_difusion');
  assert.equal(SECCION_COLUMNA.col_difusion, 'Leads');
  assert.ok(!opcionesCrm(columna(null)).includes('col_difusion'));
  const item = (d: { visibles: number; filtrado: boolean }) => itemsCrm(opcionesCrm(columna(d)), { ...DATOS, difusion: d })
    .find((x) => x && 'id' in x && x.id === 'col_difusion') as { label: string; icono?: string } | undefined;
  assert.equal(item({ visibles: 394, filtrado: false })?.label, 'Mandar mensaje de difusión');
  assert.equal(item({ visibles: 12, filtrado: true })?.label, 'Mandar mensaje a los 12 que se ven');
  assert.equal(item({ visibles: 12, filtrado: true })?.icono, 'enviar', 'el mismo dibujo que el botón de la barra');
});

test('el tablero monta la hoja de Automations con la barra Y con el «⋯», sólo para el admin', () => {
  const b = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(b, /const HojaDifusion = dynamic\(\(\) => import\('@\/app\/automations\/difusion\/HojaDifusion'\)\.then\(\(m\) => m\.HojaDifusion\), \{ ssr: false \}\);/);
  assert.match(b, /<HojaDifusion abierta seleccion=\{difusion\} onCerrar=\{\(\) => setDifusion\(null\)\}/);
  assert.match(b, /onMandarMensaje=\{puedeCrearCrm \? setDifusion : undefined\}/);
  assert.match(b, /case 'col_difusion': if \(c\) setDifusion\(seleccionDeColumna\(\{ etapa: c\.key, funnelId: funnelDeDifusion \}, visiblesDe\(c\.key\), hayFiltros\)\); return;/);
  assert.match(b, /return puedeCrearCrm && n > 0 \? \{ visibles: n, filtrado: hayFiltros \} : null;/);
  assert.match(b, /difusion: difusionDeColumna\(c\.key\),/);
  assert.match(b, /difusion: abierto\.ctx\.sobre === 'columna' \? abierto\.ctx\.difusion : undefined,/);
  // El funnel con su id aunque sea el principal, en la columna del «⋯» y en la de la barra.
  assert.match(b, /const funnelDeDifusion = funnelActivo \?\? funnels\.find\(\(f\) => f\.esDefault\)\?\.id \?\? null;/);
  assert.match(b, /return s \? \{ etapa: k, label: s\.label, funnelId: funnelDeDifusion \} : null;/);
  // Al crearla, el aviso con el link a la automatización (y si era el mismo pedido, que no se mandó dos veces).
  assert.match(b, /href=\{`\/automations\?sec=\$\{r\.secuenciaId\}`\}/);
  assert.match(b, /r\.yaEstaban \?/);
});

test('el contrato de la hoja: la selección que da el CRM es la que entiende la hoja y su action', () => {
  const hoja = leer('app/automations/difusion/HojaDifusion.tsx');
  assert.match(hoja, /export type SeleccionHojaDifusion = \{ leadIds: number\[\] \} \| \{ funnelId: number \| null; etapa: string \};/);
  assert.match(leer('app/crm/seleccion-difusion.ts'), /export type SeleccionDifusion = \{ leadIds: number\[\] \} \| \{ funnelId: number \| null; etapa: string \};/);
  // La action lee el id del funnel tal cual (>0) y es sólo del admin: el renglón y la barra preguntan lo mismo.
  const acc = leer('app/automations/difusion/actions.ts');
  assert.match(acc, /return \{ etapa: o\.etapa\.trim\(\), funnelId: Number\.isInteger\(f\) && f > 0 \? f : null \};/);
  assert.equal((acc.match(/if \(rol !== 'admin'\) return \{ ok: false, error: 'Sólo el administrador puede mandar una difusión\.' \};/g) ?? []).length, 2);
});

// ── Probado rompiéndolo (29/10/2026), de a una y restaurando. Base 6/0, final 6/0 ──
// CrmBoard y el menú como antes de este cambio (a01916587)                       → 5/1 cada uno; seleccion-difusion → 2/4
// R1  la columna del principal con funnelId null otra vez · R2 con filtros, la columna entera   → 5/1 cada una
// R3  el renglón sin «los N que se ven» → 4/2 · R4 el renglón fuera del menú                     → 5/1
// R5  el renglón en una columna vacía · R6 para cualquiera (no sólo el admin)                    → 5/1 cada una
// R7  la barra sin la hoja · R8 el «⋯» con funnelActivo crudo · R9 la barra con funnelActivo crudo → 5/1 cada una
// R10 el menú sin los datos de la difusión                                                      → 5/1
