// =============================================================================
// Las HOJAS de la ficha del lead (17/10/2026): el título con su desplegable y «Nueva hoja», como el Dashboard
// =============================================================================
// Martín, 16/10/2026 (feedback del CRM, puntos 4, 5 y 9): «que el sistema para cambiar de hoja sea exactamente el mismo
// que tenemos en Dashboard y General, el desplegable del título con las secciones, entonces ahí mismo se puede crear
// otra hoja... que no salgan las opciones de "Toda la ficha" esos deben ser templates... Quiero que esté alineado al
// título del nombre de la persona». Lo que se fija, EJECUTANDO el motor (lib/ficha/config.ts), la traducción de la
// API de MaKo (lib/ficha/api.ts) y la galería (app/crm/lead-view/ficha/galeria.ts):
//   1. una hoja propia se crea con una plantilla de cualquier tab, con unos bloques o en blanco; su nombre no choca
//      con otro (se numera), hay tope, se borra y se mueve, y lleva cualquier bloque de la ficha del lead (los de
//      Customer Success, no);
//   2. volver toda la ficha a su plantilla, o cambiar la plantilla de toda la ficha, NO borra las hojas propias;
//   3. un cambio sobre una hoja que otra persona borró no escribe nada;
//   4. «Nueva hoja» crea con la clave que ya tenía la pantalla, y «En blanco» no trae el contacto del Resumen;
//   5. MaKo crea, borra y mueve hojas por cambiar_ficha_funnel, y ver_ficha_funnel las muestra;
//   6. la pantalla: «＋ Nueva hoja» primera en el desplegable, sólo para quien guarda, y el título a la altura del
//      nombre del lead en las dos puertas.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y restaurada, con el archivo en 6 / 0:
//   · el nombre de una hoja nueva sin numerar («Resumen» dos veces)                         → 5 / 1
//   · `sanearHojas` sin tirar las claves repetidas                                          → 5 / 1
//   · «Volver toda la ficha» borrando las hojas propias (`delete g.hojas`)                  → 5 / 1
//   · un bloque de Customer Success aceptado en una hoja (`vaEnLugar` siempre true)         → 5 / 1
//   · «En blanco» de «Nueva hoja» mandando la plantilla `hoja-en-blanco`                    → 5 / 1
//   · «Nueva hoja» al final del desplegable en vez de primera                               → 5 / 1
//   · la ruta sin la sangría del nombre                                                     → 5 / 1
// Correr: node --import tsx --test tests/ficha-hojas.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aplicarCambio, fichaEfectiva, normalizar, sanearCambio, sanearFicha, RESPALDO_VACIO, TOPE_HOJAS, type FichaGuardada } from '../lib/ficha/config';
import { esIdHoja, vaEnLugar, bloqueDef } from '../lib/ficha/catalogo';
import { cambioDeInputApi, salidaFichaApi } from '../lib/ficha/api';
import { cambioDeNueva, galeriaDeLugar, EN_BLANCO_HOJA } from '../app/crm/lead-view/ficha/galeria';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '');
const R = RESPALDO_VACIO;
const TIPO = 'dos-reuniones' as const;

/** Aplica cambios en fila, y falla si alguno no entra. */
function aplicar(g: FichaGuardada, ...cs: unknown[]): FichaGuardada {
  let f = g;
  for (const raw of cs) {
    const c = sanearCambio(raw);
    assert.ok(!('error' in c), `el cambio no pasa el saneo: ${JSON.stringify(raw)} → ${'error' in c ? c.error : ''}`);
    const r = aplicarCambio(f, c as Exclude<typeof c, { error: string }>, TIPO, R);
    assert.ok(r.ok, `el cambio no entra: ${JSON.stringify(raw)} → ${!r.ok ? r.error : ''}`);
    f = r.ok ? r.ficha : f;
  }
  return f;
}

test('una hoja propia: con plantilla, numerada si el nombre ya existe, con tope, se mueve y se borra', () => {
  // Con una plantilla de OTRA tab: sus bloques y su épica, y su nombre.
  const g1 = aplicar({}, { op: 'hoja', hoja: 'h-aaa111', nombre: null, plantilla: 'resumen-epica' });
  const ef1 = fichaEfectiva(TIPO, g1, R);
  assert.equal(ef1.hojas.length, 1);
  assert.equal(ef1.hojas[0].epica, true, 'la épica viene con la plantilla');
  assert.ok(ef1.hojas[0].bloques.length > 0, 'los bloques de la plantilla');
  // Un nombre que ya usa una tab se numera, con el tope.
  const g2 = aplicar(g1, { op: 'hoja', hoja: 'h-bbb222', nombre: 'Resumen' }, { op: 'hoja', hoja: 'h-ccc333', nombre: 'Resumen' });
  assert.deepEqual(fichaEfectiva(TIPO, g2, R).hojas.slice(1).map((h) => h.nombre), ['Resumen 2', 'Resumen 3']);
  // Mover: la última pasa a ser la primera.
  const g3 = aplicar(g2, { op: 'mover-hoja', hoja: 'h-ccc333', lugar: 1 });
  assert.deepEqual(fichaEfectiva(TIPO, g3, R).hojas.map((h) => h.id), ['h-ccc333', 'h-aaa111', 'h-bbb222']);
  // Borrar.
  const g4 = aplicar(g3, { op: 'quitar-hoja', hoja: 'h-aaa111' });
  assert.deepEqual(fichaEfectiva(TIPO, g4, R).hojas.map((h) => h.id), ['h-ccc333', 'h-bbb222']);
  // El tope.
  let lleno: FichaGuardada = {};
  for (let i = 0; i < TOPE_HOJAS; i++) lleno = aplicar(lleno, { op: 'hoja', hoja: `h-tope${i}x`, nombre: `Hoja ${i}` });
  const mas = aplicarCambio(lleno, { op: 'hoja', hoja: 'h-unamas', nombre: null }, TIPO, R);
  assert.ok(!mas.ok, `pasó el tope de ${TOPE_HOJAS} hojas`);
  // Una hoja propia no se queda sin nombre.
  assert.ok('error' in sanearCambio({ op: 'nombre', tab: 'h-bbb222', nombre: '  ' }));
  // Una clave que no es de hoja no pasa.
  assert.ok(!esIdHoja('actividad') && !esIdHoja('h-') && !esIdHoja('resumen') && esIdHoja('h-abc'));
});

test('en una hoja propia va cualquier bloque de la ficha del lead, y uno de Customer Success no', () => {
  const g = aplicar({}, { op: 'hoja', hoja: 'h-mix001', nombre: 'Mezcla' },
    { op: 'poner', tab: 'h-mix001', bloque: 'cuotas' }, { op: 'poner', tab: 'h-mix001', bloque: 'proxima-reunion' }, { op: 'poner', tab: 'h-mix001', bloque: 'visitas' });
  assert.deepEqual(fichaEfectiva(TIPO, g, R).hojas[0].bloques.map((b) => b.id), ['cuotas', 'proxima-reunion', 'visitas']);
  assert.ok(!vaEnLugar(bloqueDef('senal-de-atencion')!, 'h-mix001'), 'un bloque de Customer Success no va en la ficha del lead');
  assert.ok('error' in sanearCambio({ op: 'poner', tab: 'h-mix001', bloque: 'senal-de-atencion' }));
  // Un cambio sobre una hoja que ya no está (otra persona la borró) no escribe nada.
  const r = aplicarCambio(g, { op: 'poner', tab: 'h-otra01', bloque: 'notas' }, TIPO, R);
  assert.ok(!r.ok && /ya no existe/.test(r.error));
});

test('volver o cambiar la plantilla de TODA la ficha no borra las hojas propias; el saneo tira lo roto', () => {
  const g = aplicar({}, { op: 'hoja', hoja: 'h-keep01', nombre: 'La mía' }, { op: 'epica', tab: 'resumen', epica: true });
  const vuelta = aplicar(g, { op: 'volver' });
  assert.deepEqual(fichaEfectiva(TIPO, vuelta, R).hojas.map((h) => h.nombre), ['La mía'], '«Volver toda la ficha» se llevó una hoja que nadie sacó de una plantilla');
  const otra = aplicar(g, { op: 'plantilla', plantilla: 'prospeccion' });
  assert.equal(fichaEfectiva(TIPO, otra, R).hojas.length, 1);
  // El saneo: claves inválidas o repetidas afuera, un bloque que no existe afuera, sin nombre «Hoja N».
  const s = sanearFicha({ hojas: [
    { id: 'h-ok0001', nombre: 'Una', bloques: [{ id: 'notas', ancho: 12, diseno: 'x' }, { id: 'no-existe' }] },
    { id: 'h-ok0001', nombre: 'Repetida', bloques: [] },
    { id: 'resumen', nombre: 'Mala', bloques: [] },
    { id: 'h-ok0002', bloques: [] },
  ] });
  assert.deepEqual(s.hojas?.map((h) => [h.id, h.nombre, h.bloques.map((b) => b.id)]), [['h-ok0001', 'Una', ['notas']], ['h-ok0002', 'Hoja 2', []]]);
  assert.deepEqual(normalizar(s, TIPO, R).hojas, s.hojas, 'normalizar no las compara contra ninguna plantilla: quedan');
});

test('«Nueva hoja» crea con la clave de la pantalla; «En blanco» no trae el contacto; su galería tiene todas las tabs', () => {
  assert.deepEqual(cambioDeNueva({ tipo: 'plantilla', id: EN_BLANCO_HOJA.id }, 'h-nueva1'), { op: 'hoja', hoja: 'h-nueva1', nombre: null });
  assert.deepEqual(cambioDeNueva({ tipo: 'plantilla', id: 'pagos-epica' }, 'h-nueva1'), { op: 'hoja', hoja: 'h-nueva1', nombre: null, plantilla: 'pagos-epica' });
  const g = aplicar({}, cambioDeNueva({ tipo: 'plantilla', id: EN_BLANCO_HOJA.id }, 'h-nueva1'));
  assert.deepEqual(fichaEfectiva(TIPO, g, R).hojas[0].bloques, [], 'una hoja en blanco no trae el contacto del Resumen');
  const gal = galeriaDeLugar('h-nueva1', { plantilla: TIPO });
  assert.equal(gal[0].plantilla.id, EN_BLANCO_HOJA.id, '«En blanco» primera');
  assert.deepEqual([...new Set(gal.slice(1).map((x) => x.plantilla.tab))].sort(), ['pagos', 'resumen', 'reuniones', 'tracking'], 'las plantillas de todas las tabs');
  assert.ok(gal.every((x) => x.porque === null), 'una hoja nueva no tiene un tipo que la sugiera');
});

test('MaKo crea, borra y mueve hojas propias, y las ve', () => {
  const c = cambioDeInputApi({ cambio: 'nueva_hoja', nombre: 'Cierre', plantilla: 'resumen-epica' });
  assert.ok(!('error' in c) && c.op === 'hoja' && esIdHoja(c.hoja) && c.plantilla === 'resumen-epica' && c.nombre === 'Cierre');
  assert.deepEqual(cambioDeInputApi({ cambio: 'quitar_hoja', tab: 'h-abc123' }), { op: 'quitar-hoja', hoja: 'h-abc123' });
  assert.deepEqual(cambioDeInputApi({ cambio: 'mover_hoja', tab: 'h-abc123', lugar: 2 }), { op: 'mover-hoja', hoja: 'h-abc123', lugar: 2 });
  const mala = cambioDeInputApi({ cambio: 'nueva_hoja', plantilla: 'inventada' });
  assert.ok('error' in mala && Array.isArray(mala.disponibles), 'una plantilla que no existe vuelve con las que hay');
  const g = aplicar({}, { op: 'hoja', hoja: 'h-ver001', nombre: 'Para el closer' }, { op: 'poner', tab: 'h-ver001', bloque: 'notas' });
  const v = salidaFichaApi({ funnel: { id: 1, nombre: 'X', esDefault: true }, eleccion: { id: TIPO, porque: 'x' }, efectiva: fichaEfectiva(TIPO, g, R) });
  assert.deepEqual(v.hojas.map((h) => [h.id, h.nombre, h.bloques.map((b) => b.bloque)]), [['h-ver001', 'Para el closer', ['notas']]]);
});

test('la pantalla: «＋ Nueva hoja» primera y sólo para quien guarda; el título a la altura del nombre del lead', () => {
  const tabs = sinComentarios(leer('app/crm/lead-view/LeadTabs.tsx'));
  const menu = tabs.slice(tabs.indexOf('function MenuHojasFicha'));
  assert.ok(menu.indexOf('texto="Nueva hoja"') > 0 && menu.indexOf('texto="Nueva hoja"') < menu.indexOf('visibles.map('), '«Nueva hoja» va primera, antes de las hojas (como el Dashboard)');
  assert.match(tabs, /paddingLeft: sangria/);
  const ficha = sinComentarios(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx'));
  assert.match(ficha, /onNueva=\{puedeGuardar && efectiva\.hojas\.length < TOPE_HOJAS \? abrirNueva : undefined\}/);
  assert.match(ficha, /const puedeGuardar = puede && !!ff\.ficha;/);
  // Las dos puertas pasan la sangría: el nombre del lead empieza en `SANGRIA_NOMBRE_LEAD` de su cabecera.
  assert.match(sinComentarios(leer('app/crm/LeadSheet.tsx')), /sangria=\{`calc\(\$\{SANGRIA_NOMBRE_LEAD\}px - clamp\(16px,4vw,28px\)\)`\}/, 'el pop-up le resta su padding');
  assert.match(sinComentarios(leer('app/crm/[id]/LeadDetailBody.tsx')), /sangria=\{`\$\{SANGRIA_NOMBRE_LEAD\}px`\}/);
  assert.match(leer('app/crm/lead-view/CabeceraLead.tsx'), /export const SANGRIA_NOMBRE_LEAD = geometriaCabecera\(0, TAM_CARA_LEAD\)\.sangria;/);
});
