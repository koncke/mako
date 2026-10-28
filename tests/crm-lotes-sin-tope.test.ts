// LAS ACCIONES EN LOTE, SIN TOPES CALLADOS (27/10/2026). Leila (Fathom 876470842-13): etiquetó a sus tildados y «quedaron 79
// sin etiqueta»; la ruta de etiquetas contestaba «Hasta 200 leads por vez» y la barra le mandaba todos juntos. Martín: «no tiene
// que haber limitaciones». Mover y borrar ya iban de a tandas con lo que falta en `pendientes` (24/10, tests/crm-lote-tandas);
// etiquetar y el deshacer de «agregar a un funnel» ahora también, y las campañas dejaron de recortar en 200 sin decirlo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conCampana, MAX_ASIGNADAS, type CampanaAsignada } from '../lib/campana-config';
import { TANDA_ETIQUETAS_LOTE } from '../lib/etiquetas-reglas';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('etiquetar va de a tandas del tamaño que toma la ruta, y si se corta lo dice', () => {
  const barra = sinComentarios(leer('app/crm/AccionesLoteLeads.tsx'));
  assert.doesNotMatch(barra, /loteEtiqueta\('poner_lote', ids,/, 'manda todos los tildados en un pedido: la ruta corta en 200');
  assert.match(barra, /for \(const tanda of enTandas\(ids, TANDA_ETIQUETAS_LOTE\)\) \{\n\s+const r = await loteEtiqueta\('poner_lote', tanda, e\.id\)/);
  assert.match(barra, /se cortó: \$\{faltan\} \$\{faltan === 1 \? 'quedó' : 'quedaron'\} sin la etiqueta/, 'un corte de las etiquetas queda mudo');
  // El deshacer, igual: sacar a 279 en un pedido también lo rechazaría.
  assert.match(barra, /for \(const tanda of enTandas\(puestos, TANDA_ETIQUETAS_LOTE\)\) \{\n\s+const q = await loteEtiqueta\('sacar_lote', tanda, e\.id\);/);
  assert.match(barra, /for \(const tanda of enTandas\(agregados, TANDA_AGREGAR\)\) \{\n\s+const q = await quitarLoteDeProductoAction\(tanda, funnelId\);/, 'el deshacer de «agregar» corta en 2.000');
  // La ruta y la barra leen el MISMO número.
  assert.match(leer('app/api/crm/etiquetas/route.ts'), /const TOPE_LOTE = TANDA_ETIQUETAS_LOTE;/);
  assert.equal(TANDA_ETIQUETAS_LOTE, 200);
});

test('las campañas no recortan en 200 sin decirlo', () => {
  const acciones = sinComentarios(leer('app/crm/campanas-actions.ts'));
  assert.doesNotMatch(acciones, /TOPE_LOTE/, 'sigue el tope de 200 de las campañas');
  assert.ok(MAX_ASIGNADAS >= 5000);
  let lista: CampanaAsignada[] = [];
  for (let i = 0; i < 250; i++) lista = conCampana(lista, { tipo: 'campana', id: `1200000000${String(i).padStart(5, '0')}`, nombre: `C${i}`, funnelId: null }) ?? lista;
  assert.equal(lista.length, 250, 'la campaña 201 en adelante no quedó asignada');
});
