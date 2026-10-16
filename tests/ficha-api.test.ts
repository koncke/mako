// =============================================================================
// La ficha por bloques en la API de MaKo: ver_ficha_funnel y cambiar_ficha_funnel
// =============================================================================
// AGENTS.md: toda capacidad nueva va a la API de MaKo, con confirmación por chat en lo que escribe. La
// traducción entre las palabras de un modelo y el motor vive en lib/ficha/api.ts (puro) y se EJECUTA acá;
// la def (lib/api-mako/areas/crm.def.ts) se ata a esa traducción para que no se separen.
//
// Correr: npx tsx --test tests/ficha-api.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (14/10/2026, base 5/0), cada rotura restaurada antes de la siguiente:
//   · «ancho 1/2» traducido a 4 columnas                                          → 4 / 1
//   · el acento «ninguno» guardado como texto en vez de volver al de la plantilla   → 4 / 1
//   · `para_sumar` ofreciendo un bloque que ya está puesto                          → 4 / 1
//   · cambiar_ficha_funnel sin `rolMinimo: 'admin'`                                 → 4 / 1
//   · preparar() sin el ensayo de `aplicarCambio` (la pendiente se consumiría al confirmar) → 4 / 1
//
// Y lo de «Personalizar» que la API no tenía, el ícono de un bloque (15/10/2026, base 6/0), restaurando de memoria:
//   · `icono` fuera de CAMBIOS_API (la def lo sigue declarando)                       → 4 / 2
//   · la pantalla manda un cambio que la API no tiene (`lista`, en PanelFicha)         → 5 / 1
//   · «de-siempre» guardado como texto en vez de volver al ícono del catálogo          → 5 / 1
//   · ICONOS_BLOQUE con el tacho de borrar                                             → 5 / 1
//   · la pantalla con su propia lista de íconos (sin `mako`)                           → 5 / 1
//   · ver_ficha_funnel sin la lista de íconos                                          → 5 / 1
//   · la def sin el parámetro `icono`                                                  → 5 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cambioDeInputApi, salidaFichaApi, CAMBIOS_API, ANCHOS_API, ICONOS_BLOQUE, ICONO_DE_SIEMPRE } from '../lib/ficha/api';
import { fichaEfectiva, RESPALDO_VACIO } from '../lib/ficha/config';
import { TABS_FICHA } from '../lib/ficha/catalogo';
import { IDS_PLANTILLA } from '../lib/ficha/plantillas';
import { porId } from '../lib/api-mako/registro';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (x: string) => x.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('del input de un modelo al cambio del motor', () => {
  assert.deepEqual(cambioDeInputApi({ cambio: 'poner', tab: 'pagos', bloque: 'cuotas', ancho: '1/2', lugar: 2 }), { op: 'poner', tab: 'pagos', bloque: 'cuotas', lugar: 2, ancho: 6 });
  assert.deepEqual(cambioDeInputApi({ cambio: 'ancho', tab: 'resumen', bloque: 'sexo', ancho: '1/4' }), { op: 'ancho', tab: 'resumen', bloque: 'sexo', ancho: 3 });
  assert.ok('error' in cambioDeInputApi({ cambio: 'ancho', tab: 'resumen', bloque: 'sexo', ancho: 'gigante' }));
  assert.deepEqual(cambioDeInputApi({ cambio: 'estilo', tema: 'editorial', acento: 'ninguno' }), { op: 'tema', tema: { plantilla: 'editorial', acento: null } });
  assert.deepEqual(cambioDeInputApi({ cambio: 'estilo', acento: '#AABBCC' }), { op: 'tema', tema: { acento: '#aabbcc' } });
  assert.ok('error' in cambioDeInputApi({ cambio: 'estilo', acento: 'rojo' }));
  assert.ok('error' in cambioDeInputApi({ cambio: 'estilo' }), 'un estilo sin nada que cambiar');
  assert.deepEqual(cambioDeInputApi({ cambio: 'plantilla', plantilla: 'auto' }), { op: 'plantilla', plantilla: null });
  assert.deepEqual(cambioDeInputApi({ cambio: 'volver', tab: 'tracking' }), { op: 'volver', tab: 'tracking' });
  assert.deepEqual(cambioDeInputApi({ cambio: 'aviso', aviso: 'empresa', avisa: false }), { op: 'aviso', paso: 'empresa', avisa: false });
  assert.ok('error' in cambioDeInputApi({ cambio: 'aviso', aviso: 'asistenciaR1', avisa: false }), 'las asistencias siempre avisan');
  const malTab = cambioDeInputApi({ cambio: 'poner', tab: 'tracking', bloque: 'cuotas' });
  assert.ok('error' in malTab && Array.isArray(malTab.disponibles) && (malTab.disponibles as string[]).includes('visitas'), 'un bloque que no va: los que sí');
  assert.ok('error' in cambioDeInputApi({}));
});

test('lo que ve MaKo: lo puesto, lo que se puede sumar y por qué avisa o no cada dato', () => {
  const efectiva = fichaEfectiva('carrito', { tabs: { pagos: [{ id: 'venta', ancho: 6, diseno: 'cajas' }] } }, { resumen: {}, apagados: ['telefono'] });
  const v = salidaFichaApi({ funnel: { id: 7, nombre: 'Tienda', esDefault: false }, eleccion: { id: 'carrito', porque: 'x' }, efectiva });
  assert.deepEqual(Object.keys(v.tabs), [...TABS_FICHA]);
  const pagos = v.tabs.pagos as { sigue_a_la_plantilla: boolean; bloques: Array<{ bloque: string; ancho: string; completa?: string[] }>; para_sumar: Array<{ bloque: string }> };
  assert.equal(pagos.sigue_a_la_plantilla, false);
  assert.deepEqual(pagos.bloques, [{ lugar: 1, bloque: 'venta', titulo: 'Venta', ancho: '1/2', diseno: 'cajas', diseno_nombre: 'Tres cajas', completa: ['monto'] }]);
  assert.ok(!pagos.para_sumar.some((x) => x.bloque === 'venta'), 'lo puesto no se ofrece para sumar');
  assert.ok(pagos.para_sumar.some((x) => x.bloque === 'cuotas'));
  assert.equal(v.avisos.find((a) => a.dato === 'telefono')!.por_que, 'lo apagó el negocio para todos sus CRM');
  assert.equal(v.avisos.find((a) => a.dato === 'setter')!.por_que, 'la plantilla no lo pide');
  assert.equal(v.plantilla.elegida_por, 'MaKo');
  assert.deepEqual(v.anchos, [...ANCHOS_API]);
});

test('la def dice lo mismo que la traducción, y cambiar es del admin y se confirma por chat', () => {
  const ver = porId('ver_ficha_funnel')!;
  const cambiar = porId('cambiar_ficha_funnel')!;
  assert.equal(ver.tipo, 'lectura');
  assert.equal(cambiar.tipo, 'accion');
  assert.ok(cambiar.tipo === 'accion' && cambiar.confirmacion === 'chat');
  assert.equal(cambiar.gating?.rolMinimo, 'admin', 'la ficha y los avisos de TODOS los leads del CRM');
  const p = (nombre: string) => cambiar.parametros.find((x) => x.nombre === nombre)!;
  assert.deepEqual([...p('cambio').enum!], [...CAMBIOS_API]);
  assert.deepEqual([...p('ancho').enum!], [...ANCHOS_API]);
  assert.deepEqual([...p('tab').enum!], [...TABS_FICHA]);
  assert.deepEqual([...p('plantilla').enum!], [...IDS_PLANTILLA, 'auto']);
});

test('preparar ensaya el cambio sobre la ficha de hoy; ejecutar escribe y vence la caché de leads', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const ini = run.indexOf('cambiar_ficha_funnel: {');
  const cuerpo = run.slice(ini, run.indexOf('\n  },\n', ini));
  const preparar = cuerpo.slice(0, cuerpo.indexOf('ejecutar:'));
  assert.match(preparar, /const r = aplicarCambio\(f\.guardada, c, f\.eleccion\.id, f\.respaldo\);/, 'lo que se sabe sin escribir falla en preparar (AGENTS.md)');
  assert.match(preparar, /if \(!r\.cambio\) return \{ error: 'La ficha ya está así\.', yaEstaba: true \};/);
  const ejecutar = cuerpo.slice(cuerpo.indexOf('ejecutar:'));
  assert.match(ejecutar, /await cambiarFichaDeFunnel\(Number\(payload\.embudoId\), c\)/);
  assert.match(ejecutar, /invalidar\('leads'\)/);
});

// AGENTS.md: toda feature nueva va a la API de MaKo. «Personalizar» (app/crm/lead-view/ficha/) cambiaba el ícono
// de un bloque y la API no (15/10/2026). Esto fija que TODO cambio que manda la pantalla tenga su `cambio` en la
// API, salvo «Deshacer» (`restaurar`: el `antes` vive en la memoria de la pantalla y el funnel no tiene historial).
test('todo lo que hace «Personalizar» en la pantalla lo puede hacer MaKo, ícono incluido', () => {
  const API_DE_OP: Record<string, string> = { tema: 'estilo' };
  const ficha = ['Armador.tsx', 'FichaPorBloques.tsx', 'PanelFicha.tsx', 'AgregarBloque.tsx', 'useFichaDelFunnel.ts']
    .map((f) => sinComentarios(leer(`app/crm/lead-view/ficha/${f}`))).join('\n');
  const ops = new Set([...ficha.matchAll(/\bop: '([a-z]+)'/g)].map((m) => m[1]));
  assert.ok(ops.size >= 10, `encontré ${ops.size} cambios en la pantalla: el test no está leyendo lo que debe`);
  for (const op of ops) {
    if (op === 'restaurar') continue;
    assert.ok((CAMBIOS_API as readonly string[]).includes(API_DE_OP[op] ?? op), `la pantalla hace «${op}» y cambiar_ficha_funnel no`);
  }

  // El ícono: los mismos que ofrece la pantalla (una sola lista), y «de-siempre» vuelve al del catálogo.
  assert.deepEqual(cambioDeInputApi({ cambio: 'icono', tab: 'resumen', bloque: 'notas', icono: 'nota' }), { op: 'icono', tab: 'resumen', bloque: 'notas', icono: 'nota' });
  assert.deepEqual(cambioDeInputApi({ cambio: 'icono', tab: 'resumen', bloque: 'notas', icono: ICONO_DE_SIEMPRE }), { op: 'icono', tab: 'resumen', bloque: 'notas', icono: null });
  const borrar = cambioDeInputApi({ cambio: 'icono', tab: 'resumen', bloque: 'notas', icono: 'borrar' });
  assert.ok('error' in borrar && Array.isArray(borrar.disponibles), 'el tacho de borrar no es un ícono de bloque (la pantalla no lo ofrece)');
  assert.ok('error' in cambioDeInputApi({ cambio: 'icono', tab: 'resumen', bloque: 'notas' }), 'un ícono sin ícono');
  assert.ok(!ICONOS_BLOQUE.includes('borrar' as never) && ICONOS_BLOQUE.length > 20);
  const armador = sinComentarios(leer('app/crm/lead-view/ficha/Armador.tsx'));
  assert.match(armador, /\{ICONOS_BLOQUE\.map\(\(n\) =>/, 'la pantalla ofrece otros íconos que la API');
  const v = salidaFichaApi({ funnel: { id: 1, nombre: 'X', esDefault: true }, eleccion: { id: 'respaldo', porque: 'x' }, efectiva: fichaEfectiva('respaldo', null, RESPALDO_VACIO) });
  assert.deepEqual(v.iconos, [...ICONOS_BLOQUE], 'MaKo no ve qué íconos puede poner');
  const p = porId('cambiar_ficha_funnel')!.parametros.find((x) => x.nombre === 'icono');
  assert.ok(p && p.tipo === 'string', 'la def no tiene el parámetro icono');
});

test('un cambio de ficha por la pantalla también vence lo que cuenta «Datos sin marcar»', () => {
  const acc = sinComentarios(leer('app/crm/ficha-actions.ts'));
  assert.match(acc, /if \(r\.cambio\) \{[\s\S]*?updateTag\(TAG\.leads\)/);
});
