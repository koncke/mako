// =============================================================================
// La ficha del lead dice EN QUÉ PRODUCTOS está, y la etapa es la del que se mira
// =============================================================================
// Pedido de Martín (06/10/2026), textual: «Le acabo de dar a un lead a "Mover a prueba" y se
// desapareció del producto principal de Mauricio. Eso JAMÁS debe pasar... No se debe "Mover" se
// debe agregar al otro producto... en el desplegable, tal como lo hacemos en Customer Success,
// cuando está en más de 2 productos, salta el botón de X para sacarlo de alguno... Y si hay
// productos en los que no está, en lugar del botón de X, un ícono que indique que se lo puede
// agregar.»
//
// El modelo (mig 0207, lib/lead-funnel*.ts) lo fija tests/lead-funnel.test.ts. Acá se fija la
// PANTALLA: el desplegable de app/crm/lead-view/ProductoDelLead.tsx y las dos puertas que lo
// montan (el pop-up y la ruta /crm/[id]).
//
// ⚠️ LAS TRES DECISIONES PURAS SE EJECUTAN, aunque vivan en un archivo 'use client' que trae
// server actions y no se puede importar acá: se sacan del FUENTE real, se les borran los tipos
// con el propio TypeScript y se llaman. Lo que se audita es el código que corre, no una copia escrita al lado
// (el molde es `traer` de tests/flow-estado-clip.test.ts). El cableado se mira sobre el código
// sin comentarios.
//
// ⚠️ DESDE EL 12/10/2026 SON UN SOLO DESPLEGABLE, EN ÁRBOL (punto 9: «Que sea solo 1 desplegable de
// "PROSPECCIÓN" que es el funnel, y que sea un desplegable tipo arbol, que dentro de "PROSPECCIÓN"
// tenga mis etapas... O le pueda agregar a otros funnel»): `FunnelYEtapa` en ProductoDelLead.tsx.
// Qué se ofrece en cada funnel lo decide app/crm/lead-view/arbol-funnels.ts, que es puro y acá se
// IMPORTA y se ejecuta (ahí vive también `accionDelRenglon`, que se mudó con el árbol).
//
// ⚠️ PROBADO ROMPIÉNDOLO, restaurando de memoria. Lo de abajo, medido el 12/10/2026 sobre la versión
// en árbol (las roturas del 06/10 que tocaban los dos desplegables viejos se fueron con ellos).
// Con todo puesto: 13 pases, 0 fallos.
//   · «Quitar» sin mirar puedeQuitar (`return 'quitar'` en accionDelRenglon) ...... 1 FALLO, 12 pases
//   · el árbol pinta la etapa de la casa del SERVER y no la de la pantalla ......... 1 FALLO, 12 pases
//   · un funnel donde NO está ofrece sus etapas en vez de «Agregar» ................. 1 FALLO, 12 pases
//   · el desplegable no espera (sin `disabled={ficha.esperando}`) .................. 1 FALLO, 12 pases
//   · la casa se mueve sin pasar por la ficha (sin `onElegirCasa`) .................. 1 FALLO, 12 pases
//   · la vista sigue al pedido aunque el lead NO esté ahí (sin `&& p.esta`) ......... 1 FALLO, 12 pases
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import {
  accionDelRenglon, funnelsDelArbol, seccionesDelArbol, leerEleccion, valorEtapa, etapasEnOrden, funnelEnVista,
} from '../app/crm/lead-view/arbol-funnels';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const PROD = sinComentarios(leer('app/crm/lead-view/ProductoDelLead.tsx'));
const SHEET = sinComentarios(leer('app/crm/LeadSheet.tsx'));
const RUTA = sinComentarios(leer('app/crm/[id]/LeadDetailBody.tsx'));

/** El bloque entre dos anclas, afirmando que las dos están (si no, el test quedó viejo). */
function entre(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: el test quedó viejo`);
  const f = src.indexOf(hasta, i + desde.length);
  assert.ok(f > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, f);
}

/**
 * Saca una función top-level del fuente real y la vuelve llamable. Termina en su `}` de la
 * columna 0 —las tres lo tienen—, y no en la primera llave: dos de ellas llevan llaves en la
 * firma (el genérico y el objeto de opciones).
 */
function traer<T>(nombre: string): T {
  const ini = PROD.indexOf(`export function ${nombre}`);
  assert.ok(ini >= 0, `${nombre}() ya no está en ProductoDelLead.tsx: el test quedó viejo`);
  const fin = PROD.indexOf('\n}\n', ini);
  assert.ok(fin > ini, `no se pudo delimitar ${nombre}()`);
  const fuente = PROD.slice(ini, fin + 2).replace(/^export /, '');
  const js = ts.transpileModule(fuente, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  // eslint-disable-next-line no-new-func
  return new Function(`${js}; return ${nombre};`)() as T;
}

type P = { id: number; esta: boolean; esCasa: boolean };
const productoEnVista = traer<(ps: readonly P[] | null, pedido: number | null) => P | null>('productoEnVista');
const etapaEnEspera = traer<(o: { cargado: boolean; fallo: boolean; idEnVista: number | null; vistaEsCasa: boolean; casaDeLaPantalla: number | null }) => boolean>('etapaEnEspera');

// ── Lo puro, ejecutado ─────────────────────────────────────────────────────────

test('el producto en vista: el de la URL si el lead ESTÁ ahí; si no, su casa', () => {
  const ps: P[] = [
    { id: 1, esta: true, esCasa: true },     // la casa (el del negocio)
    { id: 14, esta: true, esCasa: false },   // agregado
    { id: 20, esta: false, esCasa: false },  // no está
  ];
  assert.equal(productoEnVista(ps, 14)?.id, 14, 'abierto desde el tablero de un producto agregado');
  assert.equal(productoEnVista(ps, 20)?.id, 1, 'un producto donde no está no se puede mirar: casa');
  assert.equal(productoEnVista(ps, null)?.id, 1, 'el tablero del negocio no lleva ?funnel=');
  assert.equal(productoEnVista(ps, 999)?.id, 1, 'un ?funnel= que no existe');
  assert.equal(productoEnVista(null, 14), null, 'sin la respuesta del server no se afirma nada');
  // Si se quita el producto que se miraba, la vista vuelve sola a la casa — sin un camino por gesto.
  assert.equal(productoEnVista(ps.map((p) => (p.id === 14 ? { ...p, esta: false } : p)), 14)?.id, 1);
});

test('la etapa ESPERA mientras no se sabe qué se mira, y mientras la casa del server no es la de la pantalla', () => {
  const base = { cargado: false, fallo: false, vistaEsCasa: false, casaDeLaPantalla: 1 };
  assert.equal(etapaEnEspera({ ...base, idEnVista: 14 }), true, 'abierto desde otro tablero, sin respuesta: espera');
  assert.equal(etapaEnEspera({ ...base, idEnVista: 1 }), false, 'se mira la casa: el selector de siempre, ya');
  assert.equal(etapaEnEspera({ ...base, idEnVista: 14, fallo: true }), false, 'si el server falló, no queda trabado');
  const cargado = { ...base, cargado: true };
  assert.equal(etapaEnEspera({ ...cargado, idEnVista: 14, vistaEsCasa: false }), false, 'un agregado tiene sus propias etapas');
  assert.equal(etapaEnEspera({ ...cargado, idEnVista: 1, vistaEsCasa: true }), false);
  // Se acaba de quitar la casa: el server ya dice que es la 14 y la pantalla todavía tiene las
  // etapas de la 1. Mover con ésas escribiría una clave que en la 14 no existe.
  assert.equal(etapaEnEspera({ ...cargado, idEnVista: 14, vistaEsCasa: true }), true);
});

// ── El árbol (ejecutado) ──────────────────────────────────────────────────────

/** Las etapas de la casa como las tiene la PANTALLA (con `col`), y las de un agregado como las trae el server. */
const ETAPAS_CASA = [
  { key: 'nopaga', label: 'Nutrición - No Paga', band: 'nutricion', dot: '#a', col: 0 },
  { key: 'agenda', label: 'Agenda R1', band: 'pipeline', dot: '#b', col: 1 },
  { key: 'lead', label: 'Lead entrante', band: 'pipeline', dot: '#c', col: 0 },
  { key: 'perdido', label: 'Perdido', band: 'salidas', dot: '#d', col: 0 },
];
const FOTO = [
  { id: 1, nombre: 'PROSPECCIÓN', esDefault: true },
  { id: 14, nombre: 'Mentoría', esDefault: false },
  { id: 20, nombre: 'Taller', esDefault: false },
];
const SERVER = [
  // La casa, con la etapa VIEJA: el server sólo se relee tras agregar/quitar/mover en un agregado.
  { id: 1, nombre: 'PROSPECCIÓN', esDefault: true, esta: true, esCasa: true, etapa: 'lead', etapas: [{ key: 'lead', label: 'Lead entrante' }] },
  { id: 14, nombre: 'Mentoría', esDefault: false, esta: true, esCasa: false, etapa: 'm2', etapas: [{ key: 'm1', label: 'Nuevo' }, { key: 'm2', label: 'Círculo ROJO' }] },
  { id: 20, nombre: 'Taller', esDefault: false, esta: false, esCasa: false, etapa: null, etapas: [] },
];

test('el árbol: sin respuesta del server, SÓLO la casa, con las etapas de la pantalla', () => {
  const fs = funnelsDelArbol({ foto: FOTO, productos: null, casaId: 1, etapasCasa: ETAPAS_CASA, etapaCasa: 'agenda' });
  assert.equal(fs.length, 1, 'sin saber si está en los otros, no se afirma nada de ellos');
  assert.deepEqual([fs[0].id, fs[0].nombre, fs[0].esCasa, fs[0].etapa], [1, 'PROSPECCIÓN', true, 'agenda']);
  // Sin la casa en la pantalla (NULL = el del negocio), es el del negocio.
  assert.equal(funnelsDelArbol({ foto: FOTO, productos: null, casaId: null, etapasCasa: [], etapaCasa: null })[0].id, 1);
});

test('el árbol: la casa con las etapas y la etapa de la PANTALLA; el agregado con las suyas; donde no está, sólo «Agregar»', () => {
  const fs = funnelsDelArbol({ foto: FOTO, productos: SERVER, casaId: 1, etapasCasa: ETAPAS_CASA, etapaCasa: 'agenda' });
  assert.equal(fs[0].etapa, 'agenda', 'la etapa de la casa es la de la pantalla, no la que guardó el server');
  assert.equal(fs[0].etapas.length, 4, 'y sus etapas, las del wizard');
  const [casa, mentoria, taller] = seccionesDelArbol(fs, true);
  // La casa: sus etapas EN EL ORDEN DEL TABLERO (pipeline por columna, nutrición, salida), con una
  // línea donde cambia la banda, y «Quitar» al fondo.
  assert.deepEqual(casa.options.map((o) => o.label), ['Lead entrante', 'Agenda R1', 'Nutrición - No Paga', 'Perdido', 'Quitar de este funnel']);
  assert.deepEqual(casa.options.map((o) => !!o.lineaArriba), [false, false, true, true, true]);
  assert.equal(casa.resumen, 'Agenda R1', 'la fila de la raíz dice su etapa');
  assert.equal(leerEleccion(casa.options[1].value)?.tipo, 'etapa');
  // El agregado: SUS etapas.
  assert.deepEqual(mentoria.options.map((o) => o.label), ['Nuevo', 'Círculo ROJO', 'Quitar de este funnel']);
  assert.equal(mentoria.resumen, 'Círculo ROJO');
  // Donde no está: una sola opción, y la raíz dice «No está».
  assert.deepEqual(taller.options.map((o) => o.label), ['Agregar a este funnel']);
  assert.deepEqual(leerEleccion(taller.options[0].value), { tipo: 'agregar', funnelId: 20 });
  assert.equal(taller.resumen, 'No está');
});

test('«Quitar» sólo con dos funnels o más; «Agregar» siempre donde no está', () => {
  assert.equal(accionDelRenglon(true, true), 'quitar');
  assert.equal(accionDelRenglon(true, false), null, 'con uno solo, sacarlo lo dejaría en ningún tablero');
  assert.equal(accionDelRenglon(false, true), 'agregar');
  assert.equal(accionDelRenglon(false, false), 'agregar', 'agregar no depende de cuántos tenga');
  const fs = funnelsDelArbol({ foto: FOTO, productos: SERVER, casaId: 1, etapasCasa: ETAPAS_CASA, etapaCasa: 'agenda' });
  const sinQuitar = seccionesDelArbol(fs, false);
  assert.ok(sinQuitar.every((g) => !g.options.some((o) => leerEleccion(o.value)?.tipo === 'quitar')), 'sin puedeQuitar no hay «Quitar» en ningún funnel');
  assert.deepEqual(leerEleccion(seccionesDelArbol(fs, true)[1].options.at(-1)!.value), { tipo: 'quitar', funnelId: 14 });
});

test('el valor de un renglón dice QUÉ funnel y QUÉ hacer, aunque la etapa traiga dos puntos', () => {
  assert.deepEqual(leerEleccion(valorEtapa(14, 'r1:llamada')), { tipo: 'etapa', funnelId: 14, etapa: 'r1:llamada' });
  assert.equal(leerEleccion(''), null);
  assert.equal(leerEleccion('e:14'), null, 'una etapa sin clave no es una elección');
  assert.equal(leerEleccion('a:14:x'), null);
  assert.equal(leerEleccion('basura'), null);
});

test('dos funnels con el mismo nombre no comparten sección (la navegación del Dropdown va por título)', () => {
  const fs = [
    { id: 1, nombre: 'Ventas', esta: true, esCasa: true, etapa: 'a', etapas: [{ key: 'a', label: 'A' }] },
    { id: 2, nombre: 'Ventas', esta: false, esCasa: false, etapa: null, etapas: [] },
  ];
  assert.deepEqual(seccionesDelArbol(fs, false).map((g) => g.title), ['Ventas', 'Ventas (2)']);
});

test('el botón nombra el funnel que se mira si el lead ESTÁ ahí; si no, la casa', () => {
  const fs = funnelsDelArbol({ foto: FOTO, productos: SERVER, casaId: 1, etapasCasa: ETAPAS_CASA, etapaCasa: 'agenda' });
  assert.equal(funnelEnVista(fs, 14)?.id, 14);
  assert.equal(funnelEnVista(fs, 20)?.id, 1, 'donde no está no se puede mirar');
  assert.equal(funnelEnVista(fs, null)?.id, 1);
  assert.deepEqual(etapasEnOrden([{ key: 'x', label: 'X' }, { key: 'y', label: 'Y', band: 'salidas' }, { key: 'z', label: 'Z' }]).map((e) => e.key), ['x', 'z', 'y'], 'sin columna, el orden de llegada dentro de la banda');
});

// ── El desplegable (cableado) ─────────────────────────────────────────────────

test('el componente arma el árbol con el estado de la ficha, y agregar/quitar van por el server del hook', () => {
  const comp = entre(PROD, 'export function FunnelYEtapa', '\n}\n');
  assert.match(comp, /funnelsDelArbol\(\{ foto: ficha\.foto, productos: ficha\.productos, casaId: ficha\.casaId, etapasCasa, etapaCasa \}\)/);
  assert.match(comp, /seccionesDelArbol\(funnels, ficha\.puedeQuitar\)/, 'la X tiene que mirar puedeQuitar');
  assert.match(comp, /secciones=\{secciones\}/, 'es el Dropdown de la casa en modo árbol, no un menú propio');
  assert.match(comp, /if \(e\.tipo === 'agregar'\) \{ if \(p\) ficha\.agregar\(p\); return; \}/);
  assert.match(comp, /if \(e\.tipo === 'quitar'\) \{ if \(p\) ficha\.quitar\(p\); return; \}/);
});

test('sin Confirm de mover: actúa al toque y el aviso trae Deshacer', () => {
  assert.doesNotMatch(PROD, /<Confirm\b|from '@\/app\/_ui\/Confirm'|moverLeadAFunnelAction|Mover a /, 'volvió el «Mover a X»');
  for (const [f, src] of [['LeadSheet', SHEET], ['LeadDetailBody', RUTA]] as const) {
    assert.doesNotMatch(src, /moverLeadAFunnelAction/, `${f}: volvió a mover el lead de producto`);
  }
  // «Agregado a X» se deshace borrando SÓLO la fila que creó; «Quitado de X», con su deshacer.
  const agregar = entre(PROD, 'const agregar = (p: ProductoFicha) =>', 'const quitar = (p: ProductoFicha) =>');
  assert.match(agregar, /await agregarAProductoAction\(leadId, p\.id\)/);
  assert.match(agregar, /show\(`Agregado a \$\{p\.nombre\}`, \(\) => startTrabajo\(async \(\) => \{\s*const u = await quitarLoteDeProductoAction\(\[leadId\], p\.id\);/);
  const quitar = entre(PROD, 'const quitar = (p: ProductoFicha) =>', 'const moverEtapa = ');
  assert.match(quitar, /await quitarDeProductoAction\(leadId, p\.id\)/);
  assert.match(quitar, /show\(`Quitado de \$\{p\.nombre\}`, \(\) => startTrabajo\(async \(\) => \{\s*const u = await deshacerQuitarAction\(d\);/);
  // Y el tablero de atrás se entera.
  assert.match(entre(PROD, 'const despues = async', 'const fallar'), /router\.refresh\(\);/);
  assert.match(PROD, /<Toast state=\{ficha\.aviso\} onClose=\{ficha\.cerrarAviso\} \/>/, 'el aviso se dibuja');
});

// ── La etapa de al lado ───────────────────────────────────────────────────────

test('en un producto AGREGADO la etapa es la de su fila y se mueve con moverEtapaEnProductoAction, sin wizard', () => {
  const mover = entre(PROD, 'const moverEtapa = (p: ProductoFicha, etapa: string) =>', 'return {');
  assert.match(mover, /if \(ocupado \|\| p\.esCasa \|\| !etapa \|\| etapa === p\.etapa\) return;/, 'la casa no pasa por acá');
  assert.match(mover, /await moverEtapaEnProductoAction\(leadId, p\.id, etapa\)/);
  assert.match(mover, /show\(`Movido a \$\{nombre\}`, \(\) => \{[\s\S]*moverEtapaEnProductoAction\(leadId, p\.id, r\.antes\)/, 'con Deshacer, que vuelve a la etapa de antes');
  assert.doesNotMatch(mover, /StageMoveDialog|MoverEtapaConfirm|setPipelineStage|setMoveTo/);
  // En el árbol: la etapa de un funnel AGREGADO se mueve con `ficha.moverEtapa`, la de la CASA la
  // decide la ficha (`onElegirCasa`: wizard o confirmación). Nunca al revés.
  const elegir = entre(PROD, 'const elegir = (v: string) =>', 'return (');
  assert.match(elegir, /if \(f\.esCasa\) onElegirCasa\(e\.etapa\);\s*else if \(p\) ficha\.moverEtapa\(p, e\.etapa\);/);
  assert.match(elegir, /ficha\.verProducto\(f\.id\);/, 'el funnel donde se movió pasa a ser el que se mira');
});

test('las dos puertas montan el MISMO árbol, con las etapas de la casa que tiene la pantalla, y espera si no se sabe', () => {
  for (const [f, src, casa] of [['LeadSheet', SHEET, 'stageKey'], ['LeadDetailBody', RUTA, 'currentStage']] as const) {
    assert.match(src, new RegExp(`<FunnelYEtapa ficha=\\{fichaProd\\} etapasCasa=\\{stages\\} etapaCasa=\\{${casa}\\} onElegirCasa=\\{pickStage\\}`), `${f}: el árbol no recibe la casa de la pantalla`);
    assert.doesNotMatch(src, /<ProductoDelLead|<EtapaEnProducto/, `${f}: volvieron los dos desplegables`);
    // La casa se mueve por el camino de siempre: wizard o confirmación.
    assert.match(src, /pideWizardAlElegir\(stages, (k|key)\)\) setMoveTo\((k|key)\); else setMoverDirecto\((k|key)\)/, `${f}: la casa no decide entre wizard y mover`);
  }
  // Y el desplegable ESPERA (apagado, sin etapa elegida) en las dos ventanas de `etapaEnEspera`.
  const comp = entre(PROD, 'export function FunnelYEtapa', '\n}\n');
  assert.match(comp, /disabled=\{ficha\.esperando\}/);
  assert.match(comp, /value=\{ficha\.esperando \|\| !enVista \|\| !etapa \? '' : valorEtapa\(enVista\.id, etapa\.key\)\}/);
});

test('la vista inicial sale del tablero desde el que se abrió (?funnel=N), y el pop-up se relee si cambia la casa', () => {
  const hook = entre(PROD, 'export function useProductosDeLaFicha', 'const aplicar = useCallback');
  assert.match(hook, /const sp = useSearchParams\(\);\s*const crudo = Number\(sp\?\.get\('funnel'\)\);/);
  assert.match(hook, /useState<number \| null>\(pedido\)/);
  // El pop-up no se entera por el refresh: sus datos los trajo una action al abrir.
  // (Desde el 08/10/2026 el releer es UNO, el mismo que usan las tarjetas y los botones de mover:
  // tests/ficha-se-relee.test.ts.)
  assert.match(SHEET, /const releer = useCallback\(\(\) => \{\s*void getLeadFullAction\(lead\.id\)\.then\(\(x\) => \{ if \(x\) setFresca\(x\); \}\)/);
  assert.match(SHEET, /onCasaCambiada: releer,/);
  assert.match(SHEET, /const vigente = fresca && fresca\.lead\.id === data\.lead\.id \? fresca : data;/);
  assert.match(SHEET, /fotoEmail \} = vigente;/);
});
