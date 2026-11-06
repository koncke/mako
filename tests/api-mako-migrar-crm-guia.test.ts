// =============================================================================
// La guía «Migrar tu CRM con Claude» (6/11/2026, la promesa a la agencia de Thiago), paso a paso contra la API real
// =============================================================================
// La guía de /api-mako es lo que se le pega a Claude: una ruta vieja, un campo que cambió de nombre o un encabezado mal
// escrito es un 404 o un 422 en la migración de un cliente, que no sabe leerlo. Acá cada paso pasa por la MISMA pieza que
// lo va a atender en producción: el resolvedor REST (`resolverRest`, lib/api-mako/rest.ts), el registro (`porId`) y el
// validador de la operación (`validarInput`, lib/api-mako/validar.ts). El lote de ejemplo, además, por la regla de la
// migración (`leerLoteMigracion`). Que la operación entera haga lo que la guía promete (quietos, sin repetir) lo prueba
// tests/migrar-contactos.test.ts sobre el código real.
//
// Probado ROMPIÉNDOLO (6/11/2026), sobre una base de 6/0: la ruta de la guía cambiada (/crm/migraciones → /crm/migracion)
// → 5/1; el campo del ejemplo renombrado (idExterno → id) → 5/1; el encabezado de la guía cambiado (X-MaKo-Cliente →
// X-Mako-Client) → 5/1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolverRest } from '../lib/api-mako/rest';
import { porId } from '../lib/api-mako/registro';
import { validarInput } from '../lib/api-mako/validar';
import { leerLoteMigracion } from '../lib/migracion-leads';
import { CABECERA_CLIENTE, PREFIJO_AGENCIA } from '../lib/api-mako/tokens-cartera';
import { ARTICULOS, GRUPOS_ARTICULOS, EJEMPLO_LOTE_MIGRACION } from '../app/api-mako/articulos-meta';

const RAIZ = join(import.meta.dirname, '..');
const guia = (): string => {
  const src = readFileSync(join(RAIZ, 'app', 'api-mako', 'Articulos.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const ini = src.indexOf('function MigrarCrm(');
  assert.ok(ini > 0, 'no encontré la guía');
  const fin = src.indexOf('\nfunction ', ini + 10);
  return src.slice(ini, fin > 0 ? fin : undefined);
};

test('la guía está en la barra de la documentación, primera de las guías', () => {
  assert.ok('migrar-crm' in ARTICULOS);
  const guias = GRUPOS_ARTICULOS.find((g) => g.titulo === 'Guías');
  assert.equal(guias?.articulos[0], 'migrar-crm');
});

test('cada pedido de la guía lo atiende una operación que existe y sale por HTTP, con ese método', () => {
  const rutas = [...guia().matchAll(/(GET|POST|PUT|PATCH|DELETE) \/api\/v1(\/[a-zA-Z0-9/{}_-]*)?/g)];
  assert.ok(rutas.length >= 5, `sólo ${rutas.length} pedidos en la guía: el barrido quedó ciego`);
  const ops = new Set<string>();
  for (const [, metodo, ruta = ''] of rutas) {
    if (ruta === '' || ruta === '/docs') continue; // el catálogo y la referencia: rutas propias de /api/v1
    const r = resolverRest(metodo, ruta.split('/'));
    assert.ok(r && 'operacion' in r, `la guía manda ${metodo} /api/v1${ruta}, que no existe`);
    const d = porId(r.operacion);
    assert.ok(d && (d.canales as readonly string[]).includes('http'), `«${r.operacion}» no sale por HTTP`);
    ops.add(r.operacion);
  }
  for (const id of ['ver_funnel', 'agregar_etapa', 'migrar_contactos', 'contar_leads_por_etapa']) assert.ok(ops.has(id), `la guía no pasa por ${id}`);
});

test('el lote de ejemplo pasa el validador REAL de la operación y la regla de la migración', () => {
  const d = porId('migrar_contactos');
  assert.ok(d);
  const v = validarInput(d!.parametros, EJEMPLO_LOTE_MIGRACION, 'json');
  assert.ok('input' in v, `el ejemplo de la guía no valida: ${'error' in v ? v.error : ''}`);
  const lote = leerLoteMigracion((v as { input: Record<string, unknown> }).input.contactos);
  assert.equal(lote.contactos.length, 1);
  assert.deepEqual(lote.descartados, []);
  assert.equal(lote.contactos[0].fechaOriginal, '2025-03-14T00:00:00.000Z');
});

test('los campos que la guía nombra en el paso 3 son los de la operación', () => {
  const d = porId('migrar_contactos')!;
  const contactos = d.parametros.find((p) => p.nombre === 'contactos');
  const campos = new Set((contactos?.campos ?? []).map((c) => c.nombre));
  const paso = /3\. Manda los contactos[^\n']*/.exec(guia())?.[0] ?? '';
  const nombrados = [...paso.matchAll(/\{?"([a-zA-Z_]+)"/g)].map((m) => m[1]).filter((n) => n !== 'crmAnterior' && n !== 'contactos');
  assert.ok(nombrados.length >= 8, `sólo ${nombrados.length} campos en el paso 3`);
  for (const n of nombrados) assert.ok(campos.has(n), `la guía nombra «${n}», que la operación no tiene`);
  assert.ok(d.parametros.some((p) => p.nombre === 'crmAnterior'));
});

test('el encabezado y el prefijo del token de agencia son los que mira la API', () => {
  const g = guia();
  assert.ok(g.includes(`«${CABECERA_CLIENTE}: <número de cuenta>»`), 'el mensaje para Claude nombra otro encabezado');
  assert.ok(g.includes(PREFIJO_AGENCIA), 'la guía nombra otro prefijo');
});

test('la guía dice lo que NO hace (las conversaciones, los ganados) y lo que no hay que hacer (etiquetas, mover)', () => {
  const g = guia();
  assert.match(g, /conversaciones del CRM anterior no se traen/);
  assert.match(g, /ganados y los perdidos no se migran/);
  assert.match(g, /no les pongas etiquetas, no los muevas de columna/);
});
