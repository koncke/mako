// =============================================================================
// comunidad-copy — lo que se DIBUJA en la comunidad: voz neutra, sin HTML inyectado, tokens que existen
// =============================================================================
// La comunidad la leen los ALUMNOS (los clientes de un cliente: mexicanos, en el caso del ws1), así
// que el texto va en español neutro con TÚ. El guard de voseo de la casa
// (tests/puente-panel-copy.test.ts) barre con `git ls-files` y no ve un archivo nuevo hasta el
// `git add` (AGENTS.md): éste mira los archivos de la comunidad por su ruta, commiteados o no.
//
// Y dos cosas que no dan error: un `var(--token)` que no existe HEREDA (y sin nadie arriba no pinta
// nada), y un `dangerouslySetInnerHTML` con texto de una persona es un script en el navegador de otra.
//
// Verificado ROMPIÉNDOLO: ver el bloque «ROTURAS» al final (números medidos).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CSS_COMUNIDAD } from '../app/_comunidad/estilos';

const RAIZ = join(import.meta.dirname, '..');
const DIRS = [
  ['app', '_comunidad'],
  ['app', 'customer-success', 'comunidad'],
  ['app', 'api', 'compartido', 'comunidad'],
];
const sinComentarios = (src: string) => src
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
const archivos = DIRS.flatMap((d) => readdirSync(join(RAIZ, ...d))
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ ruta: [...d, f].join('/'), src: sinComentarios(readFileSync(join(RAIZ, ...d, f), 'utf8')) })));

/**
 * Las formas de voseo que más aparecen en una interfaz (imperativos y presentes de 2ª persona), con
 * borde UNICODE (en JavaScript `\b` es ASCII: `tocá` no tendría borde). No es el generador de la casa:
 * es la red de esta carpeta mientras sus archivos no estén en el índice.
 */
const FORMAS = [
  'vos', 'tenés', 'podés', 'querés', 'sabés', 'sos', 'hacé', 'poné', 'decí', 'salí', 'venís', 'tenelo',
  'escribí', 'elegí', 'subí', 'pedí', 'abrí', 'compartí', 'seguí', 'escribís', 'elegís', 'subís',
  'publicá', 'buscá', 'mirá', 'guardá', 'agregá', 'borrá', 'cargá', 'probá', 'tocá', 'mandá', 'dejá', 'usá',
  'esperá', 'intentá', 'comentá', 'respondé', 'votá', 'fijá', 'editá', 'creá', 'completá', 'llená', 'contestá',
  'publicás', 'buscás', 'mirás', 'guardás', 'agregás', 'comentás', 'votás', 'llegás', 'llegá', 'fijate', 'acordate',
  // No es voseo pero es rioplatense, y el detector de la casa lo marca igual (→ «aquí»).
  'acá',
];
const VOSEO = new RegExp(`(?<!\\p{L})(${FORMAS.join('|')})(?!\\p{L})`, 'iu');

test('lo que se dibuja no vosea (strings y texto de JSX, sin los comentarios)', () => {
  assert.ok(archivos.length >= 15, `encontré ${archivos.length} archivos: el barrido está mirando otra cosa`);
  const malos: string[] = [];
  for (const { ruta, src } of archivos) {
    for (const s of src.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`|>[^<>{}\n]+</g) ?? []) if (VOSEO.test(s)) malos.push(`${ruta}: ${s.trim()}`);
  }
  assert.deepEqual(malos, []);
});

test('ningún texto de una persona entra como HTML: el único dangerouslySetInnerHTML es la hoja de estilos', () => {
  for (const { ruta, src } of archivos) {
    for (const m of src.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g)) {
      assert.equal(m[1].trim(), 'CSS_COMUNIDAD', `${ruta} inyecta ${m[1].trim()}`);
    }
    assert.doesNotMatch(src, /innerHTML\s*=/, `${ruta} escribe innerHTML`);
  }
});

test('la hoja: sin interpolación, y cada var(--x) existe (o es de la paleta del portal, con su respaldo)', () => {
  assert.ok(!CSS_COMUNIDAD.includes('${'), 'una interpolación adentro de la hoja la corta');
  const globals = readFileSync(join(RAIZ, 'app', 'globals.css'), 'utf8');
  const propios = new Set([...CSS_COMUNIDAD.matchAll(/(--cm-[\w-]+)\s*:/g)].map((m) => m[1]));
  const faltan: string[] = [];
  for (const m of CSS_COMUNIDAD.matchAll(/var\((--[\w-]+)(\s*,)?/g)) {
    const [, nombre, conRespaldo] = m;
    if (nombre.startsWith('--cm-')) { if (!propios.has(nombre)) faltan.push(nombre); continue; }
    if (nombre.startsWith('--u-')) { if (!conRespaldo) faltan.push(`${nombre} (sin respaldo)`); continue; }
    if (!new RegExp(`${nombre}\\s*:`).test(globals)) faltan.push(nombre);
  }
  assert.deepEqual([...new Set(faltan)], []);
});

test('la hoja va acotada a la comunidad: ninguna regla sale de .cmu', () => {
  const reglas = CSS_COMUNIDAD.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]+\{/g, '').split('}')
    .map((r) => r.split('{')[0].trim()).filter(Boolean);
  const sueltas = reglas.flatMap((sel) => sel.split(',').map((s) => s.trim())).filter((s) => s && !s.startsWith('.cmu'));
  assert.deepEqual(sueltas, []);
});

test('los botones no dicen «Sí», «No», «Aceptar», «Cancelar» ni «Descartar» a secas', () => {
  const malos: string[] = [];
  for (const { ruta, src } of archivos) {
    for (const m of src.matchAll(/>\s*(Sí|No|Aceptar|Cancelar|Descartar)\s*</g)) malos.push(`${ruta}: ${m[1]}`);
    for (const m of src.matchAll(/(confirmLabel|cancelLabel):\s*'(Sí|No|Aceptar|Cancelar|Descartar)'/g)) malos.push(`${ruta}: ${m[2]}`);
  }
  assert.deepEqual(malos, []);
});

// ── La revisión del 08/10/2026 ───────────────────────────────────────────────────

const fuente = (f: string) => archivos.find((a) => a.ruta === `app/_comunidad/${f}`)?.src ?? '';

test('un popover abierto es una CAPA: el Escape que lo cierra no cierra el modal de abajo', () => {
  // El post, el compositor y el evento son un Modal que escucha Escape en `document`, en captura. Sin
  // registrarse en la pila, cerrar las sugerencias de una @mención cerraba el compositor entero.
  const piezas = fuente('piezas.tsx');
  const capa = piezas.slice(piezas.indexOf('export function CapaPopover'), piezas.indexOf('export type ItemMenu'));
  assert.ok(capa.length > 200 && capa.length < 2500, `el recorte de CapaPopover mide ${capa.length}`);
  assert.match(capa, /useCapaModal\(true, \{ anidada: true \}\)/, 'no se registra en la pila');
  assert.match(capa, /if \(e\.key !== 'Escape' \|\| !esElDeArriba\(\)\) return;\s*e\.stopImmediatePropagation\(\);/);
  // Los tres popovers lo montan mientras están abiertos, y ninguno escucha Escape por su cuenta.
  assert.match(piezas, /\{abierto && <CapaPopover caja=\{ref\} /, 'el menú de los tres puntos');
  assert.match(fuente('Campana.tsx'), /\{abierta && <CapaPopover caja=\{ref\} /, 'el panel de la campana');
  assert.match(fuente('CampoMenciones.tsx'), /\{consulta && sugerencias\.length > 0 && <CapaPopover caja=\{caja\} /, 'las sugerencias de una mención');
  for (const f of ['Campana.tsx', 'CampoMenciones.tsx']) {
    assert.doesNotMatch(fuente(f), /e\.key === 'Escape'/, `${f} atiende Escape por su cuenta (llega después que el del modal)`);
  }
  assert.equal([...piezas.matchAll(/e\.key === 'Escape'|e\.key !== 'Escape'/g)].length, 1, 'el Escape de un popover vive sólo en CapaPopover');
});

test('editar un comentario arranca con las menciones que ya tiene (si no, se guardan como texto suelto)', () => {
  const src = fuente('PostAbierto.tsx');
  assert.match(src, /label: 'Editar', onClick: \(\) => \{ setTexto\(c\.texto\); setMenciones\(mencionesDeTokens\(c\.cuerpo\)\); setEditando\(true\); \}/);
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 08/10/2026 (arnés del scratchpad, restaura de memoria): cada rotura, sola, contra este
// archivo de 5 tests da 1 fallo y 4 pases: «Escribí algo» en el feed · un pedazo de texto dibujado con
// `dangerouslySetInnerHTML` · un `var(--fs-texto)` que no existe · una regla `*` fuera de `.cmu` · un
// botón «Cancelar».
// Re-medido con la SEGUNDA mitad (08/10/2026): las cinco siguen dando 1 / 4, y lo mismo sobre los
// archivos nuevos (scratchpad/comunidad-2/romper.mjs): «Elegí otro día.» en el calendario · el globito
// de la campana con un `var(--malo)` · una regla `.campana` fuera de `.cmu` · el About dibujado con
// `dangerouslySetInnerHTML` · «Cancelar» en el editor del About.
// La REVISIÓN (08/10/2026, scratchpad/revision-comunidad/romper.mjs), contra este archivo de 7 tests:
// el popover sin registrarse en la pila · la campana sin su capa · las sugerencias de una mención sin
// su capa · editar un comentario con la lista de menciones vacía: 1 fallo y 6 pases cada una. Las diez
// de arriba, re-medidas: 1 / 6.
// ⚠️ Lo que este test NO ve: un rótulo prohibido adentro de una expresión (`{x ? 'Cancelar' : …}`) no
// es texto de JSX ni un `cancelLabel`. Los de la comunidad están escritos a mano y revisados.
// ⚠️ Y que el Escape de verdad no cierre el modal se probó leyendo el orden de los listeners
// (`app/_ui/Modal.tsx`: escucha en `document`, en captura, y se abstiene si no es «el de arriba»), NO
// en un navegador: la regla de la casa pide arrastrar/teclear en uno, y esta revisión no levantó el
// servidor.
