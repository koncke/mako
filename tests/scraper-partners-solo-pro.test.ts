// =============================================================================
// El scraper de WhatsApp, SÓLO en Pro (27/10/2026); MaKo Partners, en TODOS los planes desde el 29/10/2026
// =============================================================================
// Martín, en la llamada con Leila (Fathom 876470842-15), ya decidido: traer los contactos de un grupo de WhatsApp y hacerse
// partner son de MaKo Pro. Antes, `TABS_SOLO_PRO` no tenía al scraper (no es una tab) y `hacermePartner` no miraba el plan:
// un Esencial hacía las dos cosas. Lo que se cuida acá:
//   · la regla y el texto del candado (lib/topes-plan.ts, `FUNCIONES_SOLO_PRO`, `textoSoloPro`);
//   · el scraper: CADA acción del CRM y cada operación de la API lo frenan (la pantalla no es la única puerta), y la pantalla
//     muestra «Pasar a Pro»;
//   · Partners: `hacermePartner` frena ANTES de crear el código, pero quien ya era partner sigue; la página (computadora y
//     teléfono) muestra «Pasar a Pro» en lugar del alta; la API no propone lo que va a frenar;
//   · /planes lo dice (tests/planes-tres-bloques.test.ts, las filas de `FUNCIONES_SOLO_PRO`).
// ⚠️ 29/10/2026: Partners SALIÓ de Pro (la llamada con Thiago, «una persona refiere a MaKo», y las landings, que dicen
// «gratis» y «cualquier plan»). Los dos tests de Partners de abajo ahora fijan que NO haya candado.
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// Correr: node --import tsx --test tests/scraper-partners-solo-pro.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FUNCIONES_SOLO_PRO, RUTA_CAMBIAR_PLAN, textoSoloPro } from '../lib/topes-plan';
import { filasDeComparacion, NOMBRE_FUNCION_PRO } from '../lib/planes-comparacion';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El cuerpo de una función de un archivo (hasta la función siguiente). */
function cuerpo(rel: string, nombre: string): string {
  const src = fuente(rel);
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre} en ${rel}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const |\n\/\*\*/);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

test('la regla: el scraper es de Pro (Partners ya no), y el candado dice qué es y cómo tenerlo', () => {
  assert.deepEqual([...FUNCIONES_SOLO_PRO], ['scraper-whatsapp']);
  assert.equal(textoSoloPro('scraper-whatsapp'), 'Traer los contactos de un grupo de WhatsApp es de MaKo Pro. Pasa a Pro para usarlo.');
  for (const f of FUNCIONES_SOLO_PRO) {
    const fila = filasDeComparacion().find((x) => x.que === NOMBRE_FUNCION_PRO[f]);
    assert.deepEqual([fila?.esencial, fila?.pro], [false, true], `/planes lo dice: ${f}`);
  }
});

test('el SCRAPER: cada acción del CRM pasa por el candado, después del «sólo el admin»', () => {
  const src = fuente('app/crm/grupo-wa-actions.ts');
  const acciones = [...src.matchAll(/\nexport async function (\w+)\(/g)].map((m) => m[1]);
  assert.ok(acciones.length >= 8, `son ${acciones.length}`);
  for (const a of acciones) {
    assert.match(cuerpo('app/crm/grupo-wa-actions.ts', a),
      /if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) return \{ ok: false, error: SOLO_ADMIN \};\n  const pro = await candadoDePro\(\);\n  if \(pro\) return pro;\n  try \{/, a);
  }
  const candado = cuerpo('app/crm/grupo-wa-actions.ts', 'candadoDePro');
  assert.match(candado, /if \(!\(await esEsencialDeLaSesion\(\)\)\) return null;/, 'sólo a un Esencial que paga por la pasarela');
  assert.match(candado, /return \{ ok: false, error: textoSoloPro\('scraper-whatsapp'\), pasarAPro: await rutaConWs\(RUTA_CAMBIAR_PLAN\) \};/);
  assert.equal(RUTA_CAMBIAR_PLAN, '/configuraciones/plan', '«Pasar a Pro» lleva a «Tu plan»');
  // La pantalla: el texto del candado y el botón.
  const ui = fuente('app/crm/TraerDeGrupoWA.tsx');
  assert.match(ui, /if \(!r\.ok\) \{ setErr\(r\.error\); setPasarAPro\(r\.pasarAPro \?\? null\); setLineas\(\[\]\); return; \}/);
  // El link va ENVUELTO en `CtaPasarAPro` (6/11/2026, #494): al cliente de una agencia, en vez del link, a quién pedírselo.
  assert.match(ui, /\{pasarAPro && <CtaPasarAPro><a href=\{pasarAPro\} style=\{btnPro\}>\{ROTULO_PASAR_A_PRO\}<\/a><\/CtaPasarAPro>\}/);
});

test('el SCRAPER por la API: la lista, el pedido de un grupo y las dos ejecuciones', () => {
  const run = fuente('lib/api-mako/areas/crm.run.ts');
  assert.match(cuerpo('lib/api-mako/areas/crm.run.ts', 'candadoDeGrupos'), /return ws != null && \(await esEsencialDe\(ws\)\) \? textoSoloPro\('scraper-whatsapp'\) : null;/);
  assert.match(cuerpo('lib/api-mako/areas/crm.run.ts', 'grupoPedido'), /^async function grupoPedido\(input: Record<string, unknown>\) \{\n  const pro = await candadoDeGrupos\(\);\n  if \(pro\) return \{ error: pro \};/);
  const leer = run.slice(run.indexOf('  grupos_whatsapp: {'), run.indexOf('  traer_contactos_de_grupo: {'));
  assert.match(leer, /const pro = await candadoDeGrupos\(\);\n\s*if \(pro\) return fallo\(pro\);\n\s*\/\/ La completa/);
  for (const que of ['traer los contactos del grupo', 'completar los nombres del grupo']) {
    const i = run.indexOf(`seguro('${que}', async () => {`);
    assert.ok(i > 0, que);
    assert.match(run.slice(i, i + 200), /const pro = await candadoDeGrupos\(\);\n\s*if \(pro\) return \{ ok: false, resumen: pro \};/, que);
  }
});

test('PARTNERS en todos los planes (29/10/2026): sin candado en hacermePartner, la API ni las pantallas, y /planes lo dice', () => {
  assert.doesNotMatch(cuerpo('lib/partners-programa.ts', 'hacermePartner'), /esEsencialDe\(/);
  const neg = fuente('lib/api-mako/areas/negocio.run.ts');
  assert.doesNotMatch(neg.slice(neg.indexOf('  hacerme_partner: {'), neg.indexOf('  cambiar_cobro_partners: {')), /esEsencialDe\(/);
  for (const rel of ['app/partners/page.tsx', 'app/m/partners/page.tsx']) assert.doesNotMatch(fuente(rel), /esEsencialDeLaSesion\(/, rel);
  const fila = filasDeComparacion().find((x) => x.que === 'Ganar el primer mes de cada negocio que traes a MaKo');
  assert.deepEqual([fila?.esencial, fila?.pro], [true, true]);
});

// Probado rompiéndolo (27/10/2026), una rotura por vez sobre la base en verde (5 pases, 0 fallos), restaurando el texto con un
// script (nunca git). Rota (pases / fallos):
//   · «Traer» del grupo sin candado                                            → 4 / 1
//   · `hacermePartner` sin candado                                             → 4 / 1
//   · la API de grupos sin candado                                             → 4 / 1
//   · /planes sin la fila del scraper                                          → 4 / 1
// Y tests/planes-tres-bloques.test.ts con la jerga de vuelta («media buyer» en la fila) → 13 / 3.
