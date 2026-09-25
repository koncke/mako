import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// =============================================================================
// El «¿seguro?» va ARRIBA del modal que lo abrió, sea cual sea su z-index
// =============================================================================
// El confirm no es un modal más: es la pregunta de la acción que estás por hacer. Si queda
// debajo, la acción NO SE PUEDE COMPLETAR y encima no se nota, porque el fondo oscuro del
// confirm sí se ve — parece que la app se colgó.
//
// La constante miraba solo la pila de modales (`pila-modales.ts`, Z_BASE 130) y era ciega a
// los modales escritos a mano, que eligen su z-index solos. Medido el 25/09/2026: tres
// pantallas los tenían en 1000-2500 contra un confirm en 500 — entre ellas la que desvincula
// el WhatsApp de un cliente, que es el ÚNICO camino para recuperar una línea caída.
//
// Por eso el guard compara contra los overlays de pantalla completa de todo `app/`, y no
// contra una lista escrita a mano: una lista se desactualiza con el modal que viene.
//
// Probado rompiéndolo: con Z_CONFIRM de vuelta en 500 caen los dos tests (0 pasan / 2 fallan)
// y el primero nombra los archivos — que son MÁS de los tres que encontré a mano: también
// `app/crm/lead-view/InfoPrincipalCard.tsx` (1000) y `app/perfil/DestinatariosModal.tsx`
// (3000). Con 3500, 2/2. Esa diferencia es el motivo de que el guard barra el árbol en vez de
// llevar una lista.

/** Sin `\r`: en un checkout de Windows el archivo llega con CRLF y los regex multilínea fallan. */
const leer = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

function tsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsx(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const RAIZ = new URL('../app', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/**
 * Un overlay de pantalla completa: `position: 'fixed'` + `inset: 0` + su z-index, todo en la
 * misma declaración de estilo. Deja afuera tooltips y carteles flotantes (que se anclan con
 * top/left y no tapan una pregunta centrada).
 */
function overlays(src: string): number[] {
  const out: number[] = [];
  const rx = /position:\s*'fixed'[^}]{0,400}?\binset:\s*0[^}]{0,400}?\bzIndex:\s*(\d{2,6})|zIndex:\s*(\d{2,6})[^}]{0,400}?position:\s*'fixed'[^}]{0,400}?\binset:\s*0/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src)) != null) out.push(Number(m[1] ?? m[2]));
  return out;
}

const Z_CONFIRM = (() => {
  const src = leer(new URL('../app/_ui/Confirm.tsx', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const m = src.match(/const Z_CONFIRM = (\d+);/);
  assert.ok(m, 'no encontré Z_CONFIRM en app/_ui/Confirm.tsx');
  return Number(m![1]);
})();

test('el confirm se dibuja por encima de todos los overlays de la app', () => {
  // El login es la excepción legítima: es la pantalla entera antes de que exista sesión, y
  // ningún confirm de la app puede aparecer sobre ella.
  const EXCEPCIONES = ['app/login/page.tsx', 'app/_ui/Confirm.tsx'];
  const tapan: string[] = [];
  for (const p of tsx(RAIZ)) {
    const rel = p.replace(/\\/g, '/').replace(/^.*?\/(app\/)/, '$1');
    if (EXCEPCIONES.some((e) => rel.endsWith(e))) continue;
    for (const z of overlays(leer(p))) {
      if (z >= Z_CONFIRM) tapan.push(`${rel} (zIndex ${z})`);
    }
  }
  assert.deepEqual(tapan, [], `Estos overlays taparían el «¿seguro?» (Z_CONFIRM ${Z_CONFIRM}), y la acción quedaría sin poder completarse:\n  ${tapan.join('\n  ')}`);
});

test('Z_CONFIRM sigue siendo un número alto y explicado', () => {
  // Un guard que solo compara no impide bajarlo a 5 y "pasar": esto fija el piso.
  assert.ok(Z_CONFIRM >= 3000, `Z_CONFIRM quedó en ${Z_CONFIRM}: por debajo de los modales de 3000 del repo`);
});
