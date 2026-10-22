// El chat de MaKo de una automatización: lo que se ve al mandar (22/10/2026)
// =============================================================================
// Martín, con capturas (12 a 14), por el Cerebro:
//   1. «Elimina los textos innecesarios, como "Hace lo que pides, tal cual." o "Te contesta y sugiere, sin tocar el lienzo."»
//   2. «Envío un mensaje y no se ve que se envió... no se ve mi envío hasta que me responde»: lo escrito entra al hilo AL
//      INSTANTE, antes de los tres puntos; si falla, queda marcado con «Reintentar».
//   3. «No me gusta que quede blureado... solo una parte del lienzo, debería quedar todo, incluso atrás de la sidebar, todo»
//      (lo fijan tests/crear-ia-tercera.test.ts y tests/lienzo-capas.test.ts).
//   4. «No me gusta que "cancelar" tenga un salto de línea»: «Pensando la respuesta 50 s · hasta 5 min» y «Cancelar»,
//      en UNA línea.
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const CHAT = () => sinComentarios(leer('app/automations/ChatMako.tsx'));

/** Desde la firma hasta la próxima declaración del mismo nivel de sangría. */
function bloque(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const sangria = /^[ \t]*/.exec(src.slice(src.lastIndexOf('\n', i) + 1))![0];
  const resto = src.slice(i + firma.length);
  const fin = resto.search(new RegExp(`\\n${sangria}(?:const |function |export |async function |/\\*\\*)`));
  return firma + (fin >= 0 ? resto.slice(0, fin) : resto);
}

test('1 · Discutir / Editar es el segmento solo: lo que hace cada uno, al pasar el cursor', () => {
  const selector = bloque(CHAT(), 'function SelectorIntencion(');
  assert.doesNotMatch(selector, /\{AYUDA_INTENCION\[valor\]\}/, 'volvió la leyenda al lado del segmento');
  assert.doesNotMatch(selector, />\s*\{AYUDA_INTENCION/, 'la ayuda se dibuja como texto');
  assert.match(selector, /title=\{AYUDA_INTENCION\[o\.id\]\}/, 'sin la ayuda al pasar el cursor');
  // Ningún otro lugar del chat dibuja esas frases.
  const sinLaTabla = CHAT().replace(/export const AYUDA_INTENCION[\s\S]*?\n\};/, '');
  assert.doesNotMatch(sinLaTabla, /Hace lo que pides|Te contesta y sugiere/);
});

test('2 · lo escrito entra al hilo ANTES de la vuelta por los pedidos, y se va cuando el turno lo pone de verdad', () => {
  const enviar = bloque(CHAT(), 'const enviarTexto = async (');
  const entra = enviar.indexOf('ponerExtras((xs) => [...xs, enviado]);');
  const espera = enviar.indexOf('await pedirPedidos(');
  assert.ok(entra >= 0, 'lo escrito no entra al hilo como extra');
  assert.ok(espera >= 0 && entra < espera, 'lo escrito entra recién después de los pedidos: se ven sólo los tres puntos');
  assert.match(enviar, /const enviado: ExtraChat = \{ id: `\$\{PREFIJO_EXTRA\}\$\{nuevoId\('yo'\)\}`, at: new Date\(\)\.toISOString\(\), yo: t \};/);
  // Cada camino que llega a un turno saca el extra (el turno lo pone en el hilo): si no, se ve dos veces.
  const turnos = [...enviar.matchAll(/return turno\(t, null, origen, actual( \?\? undefined)?\);/g)];
  assert.equal(turnos.length, 2, 'cambiaron los caminos que llegan al turno: revisar que todos saquen el extra');
  assert.match(enviar, /if \(!nuevas\.length\) \{ ponerExtras\(sinEnviado\); return turno\(t, null, origen, actual \?\? undefined\); \}/, 'sin burbujas, el mensaje queda dos veces');
  assert.match(enviar, /ponerExtras\(\(xs\) => \[\.\.\.sinEnviado\(xs\), \.\.\.burbujas\]\);\n\s+return turno\(t, null, origen, actual\);/, 'con burbujas, el mensaje queda dos veces');
  // Sin nada de esta automatización, lo escrito ya está: no se suma otra vez.
  assert.doesNotMatch(enviar, /\{ id: `\$\{PREFIJO_EXTRA\}\$\{nuevoId\('yo'\)\}`, at: new Date\(base\)/, 'lo escrito se suma dos veces cuando sólo trae burbujas');
});

test('2 · si no salió, queda en el hilo con «No se envió · Reintentar», y Reintentar lo manda otra vez', () => {
  const chat = CHAT();
  const deshacer = bloque(chat, 'const deshacer = (');
  // Un error (no Cancelar, no una opción tocada): el mensaje queda, marcado; no vuelve a la barra.
  assert.match(deshacer, /if \(e && origen !== 'boton'\) \{\n\s+ponerExtras\(\(xs\) => \[\.\.\.xs, \{ id: `\$\{PREFIJO_EXTRA\}\$\{yo\.id\}`, at: yo\.at, yo: dicho, fallido: e\.texto \}\]\);\n\s+return true;\n\s+\}/);
  assert.ok(deshacer.indexOf("if (e && origen !== 'boton')") < deshacer.indexOf("if (origen === 'barra') return { error: null };"), 'el error vuelve a la barra antes de quedar en el hilo');
  // Cancelar sigue igual: lo escrito vuelve a la barra.
  assert.match(chat, /if \(fin\.t === 'cancelado'\) return deshacer\(null\);/);
  // Se dibuja debajo del mensaje, con el botón.
  assert.match(chat, /\{e\.fallido !== undefined && \(\n\s+<div data-yo-fallido="" role="alert" title=\{e\.fallido\} style=\{S\.fallido\}>\n\s+No se envió\n\s+<button type="button" onClick=\{\(\) => reintentar\(e\.id, e\.yo!\)\}/);
  const reintentar = bloque(chat, 'const reintentar = (');
  assert.match(reintentar, /ponerExtras\(\(xs\) => xs\.filter\(\(x\) => x\.id !== id\)\);/, 'Reintentar deja el viejo y suma otro: el mensaje queda dos veces');
  assert.match(reintentar, /void enviarTexto\(texto, 'afuera'\);/, 'Reintentar no lo manda');
  assert.match(reintentar, /if \(trabajando \|\| interpretando\) return;/, 'Reintentar con MaKo trabajando pisa el turno en curso');
});

test('4 · «Pensando la respuesta 50 s · hasta 5 min» y «Cancelar», en una sola línea', () => {
  const chat = CHAT();
  const fases = /\n {2}fases: \{([^}]*)\},/.exec(chat);
  assert.ok(fases, 'no encontré el estilo de las fases');
  assert.match(fases![1], /flexWrap: 'nowrap'/, 'las fases vuelven a partirse en dos líneas');
  assert.doesNotMatch(fases![1], /flexWrap: 'wrap'/);
  // Lo que se achica es el rótulo, con «…»; el tiempo y Cancelar, nunca.
  assert.match(chat, /\n {2}rotulo: \{[^}]*minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' \},/);
  const fasesIA = bloque(chat, 'function FasesIA(');
  assert.match(fasesIA, /\{segundos\} s · hasta/);
  assert.match(fasesIA, /whiteSpace: 'nowrap' \}\}>\{segundos\} s/);
  assert.match(fasesIA, /<span style=\{\{ flex: 'none' \}\}><Button variant="tertiary" size="sm" onClick=\{onCancelar\}>Cancelar<\/Button><\/span>/, '«Cancelar» se puede achicar y partir');
});

// ── Probado rompiéndolo (22/10/2026, romper.mjs) ───────────────────────────────────────────────────────────────────
// Los números son «tests / fallan» de ESTE archivo con cada rotura.
//   R1. la leyenda vuelve al lado del segmento                         → 4 / 1 (1)
//   R2. lo escrito entra recién después de los pedidos                 → 4 / 1 (2)
//   R3. sin burbujas, el extra no se saca antes del turno              → 4 / 1 (2)
//   R4. el error vuelve a la barra como antes (sin «Reintentar»)       → 4 / 1 (2 · Reintentar)
//   R5. Reintentar no saca el viejo                                     → 4 / 1 (2 · Reintentar)
//   R6. las fases con `flexWrap: 'wrap'`                               → 4 / 1 (4)
//   R7. Cancelar sin su `flex: 'none'`                                  → 4 / 1 (4)
//   R8. la ayuda sin el `title` del segmento                            → 4 / 1 (1)
// La capa a pantalla completa (mismo día): sin `document.body` (adentro del chat) → crear-ia-tercera 14 / 1; `absolute`
// en vez de `fixed` → crear-ia-tercera 14 / 1; la capa en 58, debajo de la barra de la app → lienzo-capas 3 / 1; la lista
// sin subir encima de la capa → lienzo-capas 3 / 1.
