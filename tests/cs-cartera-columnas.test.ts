// =============================================================================
// #109 — las dos columnas de la cartera y el onboarding de la tab Clientes
// =============================================================================
// Decisión de Martín (06/10/2026, «Columnas + alerta»): la tabla de Clientes suma «Último
// contacto» y «Vencidas» (las tareas del Plan con fecha pasada, que el tablero ya calculaba y
// ninguna pantalla dibujaba). Y la tab estrena su onboarding (regla de la casa: toda tab tiene uno),
// con el estado DERIVADO de los datos para que el ws1 —con todo armado— no quede tapado.
//
// Lo que se fija, y cada cosa falla en silencio si se rompe:
//   · las columnas se dibujan, el `colSpan` de los grupos las cuenta, y «Vencidas» va en rojo
//     sólo con algo vencido;
//   · se ordenan desde la barra («Ordenar»), que es como ordena esta tabla;
//   · el onboarding: los pasos y su orden (una guarda), qué dato cierra cada uno, que «no pude
//     leer» no marque ni desmarque nada, y que el ws1 entre sin lista.
//
// PROBADO ROMPIÉNDOLO (07/10/2026, arnés del scratchpad que restaura de MEMORIA, nunca con git).
// La tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { pasoBloqueadoPor } from '../lib/onboarding-orden';
import {
  TAB_CLIENTES, PASOS_CLIENTES, cambiosDeOnboarding, pasosDeLosDatos, listaVisible, pasosParaDibujar,
  serviciosConEtapas, filasDeEntrega, type HechosClientes,
} from '../app/customer-success/onboarding-clientes';
import { ORDEN_LABEL } from '../app/customer-success/BarraClientes';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: ¿se movió?`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(i, j);
};

const TABLA = sinComentarios(leer('app/customer-success/TablaClientes.tsx'));
const APP = sinComentarios(leer('app/customer-success/ClientesApp.tsx'));
const PAGE = sinComentarios(leer('app/customer-success/page.tsx'));

// ── 1. Las columnas ───────────────────────────────────────────────────────────

test('la tabla dibuja «Último contacto» y «Vencidas», y el colSpan de los grupos las cuenta', () => {
  const cabecera = bloque(TABLA, '<thead>', '</thead>');
  assert.match(cabecera, />Último contacto</);
  assert.match(cabecera, />Vencidas</);
  // El número que mira el `colSpan` de la cabecera de cada grupo tiene que ser el de los <th>: uno
  // de menos deja la fila plegada corta, uno de más la hace desbordar (pasó en el Plan).
  const ths = (cabecera.match(/<th\b/g) ?? []).length;
  const soloAgrupada = (cabecera.match(/\{agrupada && <th\b/g) ?? []).length;
  const m = TABLA.match(/const cols = agrupada \? (\d+) : (\d+);/);
  assert.ok(m, 'no encontré `cols`');
  assert.equal(Number(m![1]), ths, 'con etapas, `cols` no cuenta todas las columnas');
  assert.equal(Number(m![2]), ths - soloAgrupada, 'sin etapas, `cols` no cuenta las columnas que quedan');
});

test('«Vencidas» sale de las `atrasadas` del tablero, en rojo SÓLO si hay alguna, y con guion sin tablero', () => {
  const fila = bloque(TABLA, 'const fila = (c: ClienteCruce', 'return (\n    <>');
  assert.match(fila, /\{n\(r\?\.atrasadas\)\}/, 'la columna no lee las tareas vencidas del tablero');
  assert.match(fila, /tableroOk && \(r\?\.atrasadas \?\? 0\) > 0 \? ' tc-vencidas' : ''/,
    'el rojo tiene que depender de que haya ALGUNA vencida (y de que el tablero se haya leído)');
  assert.match(TABLA, /\.tc-vencidas\{ color:var\(--bad\);/);
  // `n()` es el que pone el guion sin tablero: un 0 sería una afirmación que nadie hizo.
  assert.match(fila, /const n = \(v: number \| undefined\) => \(tableroOk \? String\(v \?\? 0\) : '—'\);/);
});

test('«Último contacto» dice tres cosas distintas: «—» no pude leer, «Nunca», y «hace N días»', () => {
  const celda = bloque(TABLA, 'function celdaContacto(', '\n}\n');
  assert.match(celda, /if \(!u\) return <span className="tc-vacio">—<\/span>;/);
  assert.match(celda, /if \(!u\.fecha\) return <span className="tc-vacio">Nunca<\/span>;/);
  assert.match(celda, /haceCuanto\(u\.fecha\)/, 'el «hace cuánto» es el del módulo compartido, no uno propio');
  assert.match(TABLA, /\{celdaContacto\(c\)\}/);
});

test('se ORDENAN desde la barra: los dos criterios existen y la pantalla los aplica', () => {
  assert.equal(ORDEN_LABEL.contacto, 'Último contacto');
  assert.equal(ORDEN_LABEL.vencidas, 'Tareas vencidas');
  const cmp = bloque(APP, 'const cmp = (a: ClienteCruce, b: ClienteCruce) => {', 'const signo = ');
  assert.match(cmp, /if \(criterio === 'vencidas'\) return \(resumenDe\(b\.leadId\)\?\.atrasadas \?\? 0\) - \(resumenDe\(a\.leadId\)\?\.atrasadas \?\? 0\);/);
  assert.match(cmp, /if \(criterio === 'contacto'\) \{/);
  // «No pude leer» al final en LAS DOS direcciones: el resultado se multiplica por `signo` después.
  assert.match(cmp, /if \(ta === null \|\| tb === null\) return ta === tb \? 0 : ta === null \? signo : -signo;/);
  // Y el arreglo de paso: «sin fecha» de Cuándo se ganó también va al final en las dos.
  assert.match(cmp, /if \(Number\.isNaN\(fa\)\) return signo;/);
});

// ── 2. El onboarding de la tab ────────────────────────────────────────────────

const DEF = TAB_ONBOARDINGS[TAB_CLIENTES];

test('el catálogo: la key del nav, prefijo propio y el orden de PASOS_CLIENTES', () => {
  assert.ok(DEF, 'la tab Clientes no tiene onboarding en el catálogo');
  assert.equal(TAB_CLIENTES, 'customer-success');
  assert.equal(DEF.href, '/customer-success');
  assert.deepEqual(DEF.pasos.map((p) => p.key), [...PASOS_CLIENTES], 'el catálogo y PASOS_CLIENTES dicen órdenes distintos: el orden es una guarda');
  for (const p of DEF.pasos) assert.match(p.key, /^cs_/, `«${p.key}» sin prefijo: colisiona vía KEY_PASOS_COMPARTIDOS`);
  assert.ok(DEF.pasos.every((p) => !p.opcional), 'los tres deciden si la tab está lista');
  assert.match(leer('app/_components/nav.ts'), /key:\s*'customer-success'/);
});

test('el ws1 (dos productos con etapas, catorce clientes, uno ubicado) entra con TODO hecho y sin lista', () => {
  const ws1: HechosClientes = { servicios: 2, clientes: 14, movidos: 1 };
  const cambios = cambiosDeOnboarding({}, ws1);
  assert.deepEqual(cambios.map((c) => c.paso), ['cs_servicio', 'cs_clientes', 'cs_ficha']);
  // Cada cambio es marcable en el orden en que sale (`marcarPasoTab` corre esta guarda).
  const steps: Record<string, { done: boolean }> = {};
  for (const c of cambios) {
    assert.equal(pasoBloqueadoPor(DEF.pasos, steps, c.paso), null, `«${c.paso}» saldría bloqueado`);
    steps[c.paso] = { done: c.done };
  }
  assert.equal(listaVisible({ cs_servicio: true, cs_clientes: true, cs_ficha: true }), false, 'con todo hecho, la lista no tapa nada');
});

test('un workspace nuevo ve la lista; abrir una ficha cierra el ensayo; nada de eso pide escribir', () => {
  const nuevo: HechosClientes = { servicios: 0, clientes: 0, movidos: 0 };
  assert.deepEqual(cambiosDeOnboarding({}, nuevo), []);
  assert.equal(listaVisible({ cs_servicio: false, cs_clientes: false, cs_ficha: false }), true);
  assert.equal(pasosDeLosDatos({ servicios: null, clientes: null, movidos: 0, fichaAbierta: true }).cs_ficha, true);
  assert.equal(pasosDeLosDatos({ servicios: 1, clientes: 3, movidos: 0 }).cs_ficha, false);
});

test('«no pude leer» NO marca ni desmarca nada; y el ensayo, hecho, no se deshace', () => {
  const todoHecho = Object.fromEntries(PASOS_CLIENTES.map((p) => [p, { done: true }]));
  const nada: HechosClientes = { servicios: null, clientes: null, movidos: null };
  assert.deepEqual(cambiosDeOnboarding(todoHecho, nada), []);
  assert.deepEqual(cambiosDeOnboarding({}, nada), []);
  // Sin servicios ni clientes de verdad (no «sin leer»): esos dos vuelven atrás; la ficha no.
  assert.deepEqual(cambiosDeOnboarding(todoHecho, { servicios: 0, clientes: 0, movidos: 0 }), [
    { paso: 'cs_servicio', done: false },
    { paso: 'cs_clientes', done: false },
  ]);
  assert.equal(listaVisible(null), false, 'sin lo anotado, no se dibuja una lista que le pediría al ws1 lo que ya tiene');
});

// ── 2b. Lo anotado respeta el orden; lo dibujado no niega un hecho (revisión, 07/10/2026) ──
// Ganados y NINGÚN producto con etapas: «Tus clientes» no se puede anotar (falta «Tu servicio»
// antes, `marcarPasoTab` tira y el sync se lo traga), y la lista decía «Carga uno o gana una venta
// en el CRM» con su botón arriba de los 14 clientes del workspace.

/** El bucle de `sincronizarOnboardingClientes`, con la guarda de orden de `marcarPasoTab`. */
function sincronizarComoElServer(h: HechosClientes, steps: Record<string, { done: boolean }> = {}) {
  for (const c of cambiosDeOnboarding(steps, h)) {
    if (c.done && pasoBloqueadoPor(DEF.pasos, steps, c.paso)) continue;   // tira y se saltea
    steps[c.paso] = { done: c.done };
  }
  return { anotado: steps, dibujo: pasosParaDibujar(steps, h) };
}

test('con clientes y SIN servicio: lo anotado respeta el orden, y la lista no le pide clientes a quien tiene 14', () => {
  const { anotado, dibujo } = sincronizarComoElServer({ servicios: 0, clientes: 14, movidos: 0 });
  assert.equal(anotado.cs_clientes, undefined, 'lo que lee MaKo sigue el orden del catálogo');
  assert.deepEqual(dibujo, { cs_servicio: false, cs_clientes: true, cs_ficha: false },
    'la lista dibuja el hecho leído: tiene clientes');
  assert.equal(listaVisible(dibujo), true, 'falta el servicio: la lista sigue, pidiendo eso');
  // Y abrir una ficha (el ensayo) se dibuja igual, aunque el orden no deje anotarlo todavía.
  const ficha = sincronizarComoElServer({ servicios: null, clientes: null, movidos: null, fichaAbierta: true }, { ...anotado });
  assert.equal(ficha.anotado.cs_ficha, undefined);
  assert.equal(ficha.dibujo.cs_ficha, true, 'la persona acaba de abrir una ficha: no se le vuelve a pedir');
});

test('lo dibujado sólo SUMA hechos: «no pude leer» no pinta nada, y un cero no desmarca lo anotado', () => {
  assert.deepEqual(pasosParaDibujar({}, { servicios: null, clientes: null, movidos: null }),
    { cs_servicio: false, cs_clientes: false, cs_ficha: false });
  const hecho = Object.fromEntries(PASOS_CLIENTES.map((p) => [p, { done: true }]));
  assert.deepEqual(pasosParaDibujar(hecho, { servicios: null, clientes: null, movidos: null }),
    { cs_servicio: true, cs_clientes: true, cs_ficha: true });
});

test('el cableado: el sync devuelve lo DIBUJADO, y la action de la ficha no lo contradice', () => {
  const sync = sinComentarios(leer('app/customer-success/onboarding-clientes-sync.ts'));
  const fn = bloque(sync, 'export async function sincronizarOnboardingClientes(', '\n}\n');
  assert.match(fn, /return pasosParaDibujar\(steps, h\);/, 'devolver lo anotado vuelve a pedir clientes a quien los tiene');
  const accion = bloque(sinComentarios(leer('app/customer-success/actions.ts')),
    'export async function anotarFichaAbiertaAction(', '\n}\n');
  assert.match(accion, /return o \? \{ ok: true \} : \{ ok: false, error: 'No se pudo anotar\.' \};/);
});

test('los hechos se cuentan sobre lo que el kanban DIBUJA: productos con etapas y filas de entrega', () => {
  assert.equal(serviciosConEtapas([{ etapas: [1, 2] }, { etapas: [] }, { etapas: [1] }]), 2);
  assert.equal(filasDeEntrega({ 7: { 1: {}, 2: {} }, 8: {}, 9: { 3: {} } }), 3);
});

test('el cableado: la página anota con lo que ya leyó; la pantalla dibuja la lista y anota la ficha UNA vez', () => {
  const sync = bloque(PAGE, 'const onboarding = await sincronizarOnboardingClientes({', '});');
  assert.match(sync, /servicios: entrega\.ok \? serviciosConEtapas\(entrega\.servicios\) : null,/, 'con la entrega caída, un cero no es un dato');
  assert.match(sync, /movidos: entrega\.ok \? filasDeEntrega\(entrega\.porServicio\) : null,/);
  assert.match(bloque(PAGE, '    <ClientesApp\n      clientes={clientesConFicha}', '/>'), /onboarding=\{onboarding\}/);
  // La pantalla: la lista mientras falte algo, y el ensayo anotado sobre lo que SE VE (la ficha
  // abierta por cualquier camino), por `atajar`, una vez, y sólo si no estaba hecho.
  assert.match(APP, /\{!error && conLista && pasosOnb && \(\s*<ChecklistClientes/);
  const efecto = bloque(APP, 'const fichaAnotada = useRef(false);', '}, [idEnUrl]);');
  assert.match(efecto, /if \(idEnUrl == null \|\| !onboarding \|\| onboarding\.cs_ficha \|\| fichaAnotada\.current\) return;/);
  assert.match(efecto, /await atajar\(anotarFichaAbiertaAction\(\), /);
  // La lista no escribe nada por su cuenta.
  assert.doesNotMatch(sinComentarios(leer('app/customer-success/ChecklistClientes.tsx')), /Action\(/);
});

// ── Las roturas (07/10/2026), cada una restaurada de memoria (nunca con git) ────
// Base de este archivo: 10 pass / 0 fail. Cada rotura tumbó su test (9 / 1), salvo dos (8 / 2):
//   1. `cols` sin las dos columnas nuevas (8 : 6)                  → «…el colSpan de los grupos…»
//   2. «Vencidas» en rojo siempre                                  → «"Vencidas" sale de las atrasadas…»
//   3. «Vencidas» leyendo las abiertas                              → el mismo
//   4. «Nunca» dibujado como «—»                                    → «"Último contacto" dice tres cosas…»
//   5. «no pude leer» primero al ordenar al revés (1/-1 fijos)      → «se ORDENAN desde la barra…»
//   6. el catálogo con clientes antes que servicio                  → 8/2: el del catálogo y el del ws1
//      (marcar «Tu servicio» quedaba bloqueado por un paso que el dato todavía no cerró)
//   7. «no pude leer» leído como «no hay» (`(n ?? 0) > 0`)           → «"no pude leer" NO marca…»
//   8. el ensayo en DESMARCABLES                                    → el mismo
//   9. las filas de entrega no cierran el ensayo                    → 8/2: el del ws1 y el del workspace nuevo
//  10. la página con un 0 inventado si la entrega no se leyó        → «el cableado…»
//  11. la página sin `onboarding={onboarding}`                      → el mismo
//  12. la ficha anotada aunque el paso ya estuviera hecho           → el mismo
//  13. la lista dibujada con todo hecho                            → «el ws1… entra con TODO hecho y sin lista»
// Restaurado: 10 pass / 0 fail.
//
// ── Revisión del 07/10/2026: lo dibujado no niega un hecho leído ────────────────
// Base: 13 pass / 0 fail (junto con tests/cs-sin-contacto.test.ts: 34 / 0). Cada rotura → 33 / 1:
//  14. `pasosParaDibujar` devuelve sólo lo anotado                  → «con clientes y SIN servicio…»
//  15. un hecho en `null` («no pude leer») se dibuja como hecho      → «lo dibujado sólo SUMA hechos…»
//  16. el sync devuelve lo anotado en vez de lo dibujado              → «el cableado: el sync devuelve…»
//  17. la action vuelve a `o?.cs_ficha ? … : 'Antes falta tu servicio.'` → el mismo
// Restaurado: 34 / 0.
