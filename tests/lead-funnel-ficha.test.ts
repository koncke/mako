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
// ⚠️ PROBADO ROMPIÉNDOLO, las ocho, restaurando de memoria (06/10/2026). Con todo puesto: 8 pases, 0 fallos.
//   · la X sin mirar puedeQuitar (`return 'quitar'` en accionDelRenglon) ....... 1 FALLO, 7 pases
//   · el desplegable le pasa `true` en vez de `ficha.puedeQuitar` ................ 1 FALLO, 7 pases
//   · sin el «+»: el renglón donde no está queda sin acción ....................... 1 FALLO, 7 pases
//   · vuelve el Confirm «Mover a X» (import de Confirm en ProductoDelLead) ........ 1 FALLO, 7 pases
//   · el pop-up dibuja siempre el selector de la casa (sin EtapaEnProducto) ....... 1 FALLO, 7 pases
//   · la ruta /crm/[id] dibuja siempre el selector de la casa ..................... 1 FALLO, 7 pases
//   · la vista sigue al pedido aunque el lead NO esté ahí (sin `&& p.esta`) ....... 1 FALLO, 7 pases
//   · la etapa no espera cuando la casa del server ≠ la de la pantalla ........... 1 FALLO, 7 pases
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

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
const accionDelRenglon = traer<(esta: boolean, puedeQuitar: boolean) => 'quitar' | 'agregar' | null>('accionDelRenglon');
const productoEnVista = traer<(ps: readonly P[] | null, pedido: number | null) => P | null>('productoEnVista');
const etapaEnEspera = traer<(o: { cargado: boolean; fallo: boolean; idEnVista: number | null; vistaEsCasa: boolean; casaDeLaPantalla: number | null }) => boolean>('etapaEnEspera');

// ── Lo puro, ejecutado ─────────────────────────────────────────────────────────

test('la X sólo donde está y sólo con dos productos o más; el «+» en todos los que no está', () => {
  assert.equal(accionDelRenglon(true, true), 'quitar');
  assert.equal(accionDelRenglon(true, false), null, 'con uno solo, sacarlo lo dejaría en ningún tablero');
  assert.equal(accionDelRenglon(false, true), 'agregar');
  assert.equal(accionDelRenglon(false, false), 'agregar', 'el «+» no depende de cuántos tenga');
});

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

// ── El desplegable ────────────────────────────────────────────────────────────

test('cada renglón: la X (roja) con puedeQuitar, el «+» (neutro) donde no está, y «No está» en gris', () => {
  const b = entre(PROD, 'const opciones: DropdownOption[] = productos', 'const enVista');
  assert.match(b, /const accion = accionDelRenglon\(p\.esta, ficha\.puedeQuitar\);/, 'la X tiene que mirar puedeQuitar');
  assert.match(b, /sub: p\.esta \? undefined : 'No está',/);
  assert.match(b, /accion === 'quitar'\s*\? \[\{ icono: <IconoQuitar \/>, title: 'Quitar de este producto', tone: 'bad' as const, cierra: true, onClick: \(\) => ficha\.quitar\(p\) \}\]/);
  const mas = b.match(/accion === 'agregar'\s*\? \[\{([^\]]*)\}\]/);
  assert.ok(mas, 'falta el «+» en los productos donde no está');
  assert.match(mas[1], /icono: <IconoAgregar \/>, title: 'Agregar a este producto', cierra: true, onClick: \(\) => ficha\.agregar\(p\)/);
  assert.doesNotMatch(mas[1], /tone:/, 'el «+» va en tono neutro: agregar no es una acción peligrosa');
  // Elegir el renglón: donde está, MIRARLO; donde no, lo mismo que el «+».
  assert.match(PROD, /if \(p\.esta\) ficha\.verProducto\(p\.id\); else ficha\.agregar\(p\);/);
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
  const sel = entre(PROD, 'export function EtapaEnProducto', '\n}\n');
  assert.match(sel, /value=\{producto\.etapa \?\? ''\}/);
  assert.match(sel, /onChange=\{\(k\) => ficha\.moverEtapa\(producto, k\)\}/);
  assert.match(sel, /producto\.etapas/, 'las etapas de ESE producto, no las de la casa');
});

test('las dos puertas: agregado → EtapaEnProducto; casa → el selector de siempre, que espera si no se sabe', () => {
  for (const [f, src, casa] of [['LeadSheet', SHEET, 'stageKey'], ['LeadDetailBody', RUTA, 'currentStage']] as const) {
    assert.match(src, /const agregado = fichaProd\.vista && !fichaProd\.vista\.esCasa \? fichaProd\.vista : null;/, `${f}: falta el producto en vista`);
    assert.match(src, /agregado\s*\?\s*\(?\s*<EtapaEnProducto ficha=\{fichaProd\} producto=\{agregado\}/, `${f}: el agregado no usa sus etapas`);
    assert.match(src, new RegExp(`value=\\{fichaProd\\.esperando \\? '' : ${casa}\\}`), `${f}: la casa no espera`);
    assert.match(src, /disabled=\{fichaProd\.esperando\}/);
    assert.match(src, /<ProductoDelLead ficha=\{fichaProd\}/);
  }
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
