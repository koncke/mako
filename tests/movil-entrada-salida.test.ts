// =============================================================================
// La entrada de MaKo se va cuando la app está LISTA: corrida con un reloj falso, no leída con expresiones regulares
// (revisión adversarial del 22/10/2026)
// =============================================================================
// tests/movil-entrada.test.ts fija la forma (el primer cuadro, el CSS, el script de antes de pintar). Éste corre la SALIDA.
//
// Lo que halló la revisión: la salida corría en el efecto de EntradaApp, o sea cuando React hidrataba el SHELL. En una ruta
// con `loading.tsx` (la entrada de los clientes, /second-brain, y /crm, /inbox, /plan… al abrir un aviso) el server manda
// primero el layout con el esqueleto, el shell hidrata enseguida y la página llega después por el stream: la criatura se
// iba al segundo y quedaba a la vista el esqueleto del Ops Center a medio cargar. Ahora espera además a que el documento
// termine de llegar y a que ningún borde de Suspense del server esté pendiente (`<!--$?-->`) o por revelarse (`<!--$~-->`,
// React 19.2 junta las revelaciones). Y al irse marca <html>: un ShellM que se vuelve a montar navegando no pinta un cuadro
// de la baldosa (el efecto corre DESPUÉS de pintar).
// Sin DOM de verdad en node: jsdom está en node_modules pero no en package.json, y le falta una dependencia
// (`@asamuzakjp/css-color`): no se puede hidratar acá. Por eso la lógica vive en funciones con el navegador inyectado.
//
// ROTURAS (22/10/2026, scratchpad `romper-revision.mjs`: una por vez, restaurado y comprobado con sha256; corridos este
// archivo, movil-entrada, movil-carga-sin-error y movil-shell; BASE 38 pasan / 0 fallan). pasan / fallan:
//   · `paginaLista` sin mirar `readyState`                                  → 37 / 1 (el de paginaLista)
//   · `paginaLista` sin mirar los comentarios `$?`/`$~`                      → 37 / 1 (el de paginaLista)
//   · `programarSalida` sin el tope (`lleva < MS_SEGURO &&` fuera)           → 37 / 1 (el del tope)
//   · `MS_MINIMO = 0`                                                       → 36 / 2 (el del segundo mínimo y el 9 de movil-entrada)
//   · `marcarDocumento` que no marca                                        → 37 / 1 (el de la marca)
//   · el efecto con `lista: () => true` (sólo el mínimo, como estaba)       → 37 / 1 (el del cableado)
// La primera corrida dio 37 / 1 con `MS_MINIMO = 0` pero por el test viejo: el nuevo usaba `MS_MINIMO - 300` y se movía con
// la constante. Ahora el 700 va escrito a mano.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ATTR_ENTRADA_VISTA } from '../app/m/_ui/entrada';
import { MS_MINIMO, MS_SEGURO, marcarDocumento, paginaLista, programarSalida } from '../app/m/_ui/EntradaApp';

const RAIZ = join(__dirname, '..');

/** Un reloj falso: `esperar` y `dosCuadros` encolan; `avanzar` corre lo que vence. La entrada arrancó hace `inicio` ms. */
function reloj(inicio: number, lista: () => boolean) {
  let ahora = 0;
  let salio: number | null = null;
  const cola: { en: number; fn: () => void }[] = [];
  const esperar = (fn: () => void, ms: number) => { cola.push({ en: ahora + ms, fn }); };
  programarSalida({ lleva: () => inicio + ahora, lista, esperar, dosCuadros: (fn) => esperar(fn, 32) }, () => { salio = ahora; });
  return {
    avanzar(ms: number) {
      const hasta = ahora + ms;
      for (;;) {
        cola.sort((a, b) => a.en - b.en);
        const p = cola[0];
        if (!p || p.en > hasta) break;
        cola.shift();
        ahora = p.en;
        p.fn();
      }
      ahora = hasta;
    },
    salio: () => salio,
  };
}

test('nunca antes del segundo: lista a los 0,7 s, se va pasado el segundo (y dos cuadros)', () => {
  // 700 escrito a mano, no `MS_MINIMO - 300`: atado a la constante, bajarla a 0 no lo rompía (primera corrida de roturas).
  const r = reloj(700, () => true);
  r.avanzar(250);
  assert.equal(r.salio(), null, 'se fue antes del segundo mínimo');
  r.avanzar(200);
  assert.equal(r.salio(), 300 + 32);
  assert.ok(MS_MINIMO >= 1000);
});

test('con la página todavía llegando NO se va aunque React haya hidratado; cuando llega, sí', () => {
  let lista = false;
  const r = reloj(3000, () => lista);
  r.avanzar(5000);
  assert.equal(r.salio(), null, 'se fue con la página a medio llegar');
  lista = true;
  r.avanzar(200);
  assert.ok(r.salio() !== null && r.salio()! <= 5000 + 100 + 32, 'llegó la página y la entrada no se fue');
});

test('si la página no termina nunca, se va igual en el tope (el mismo del CSS): nunca trabada tapando la app', () => {
  assert.equal(MS_SEGURO, 15000);
  const r = reloj(1000, () => false);
  r.avanzar(MS_SEGURO);
  assert.notEqual(r.salio(), null, 'trabada tapando la app');
  assert.ok(r.salio()! >= MS_SEGURO - 1000 - 100, 'se fue antes del tope');
});

/** Un documento falso: `readyState` y los comentarios que escribe React en el HTML (`createTreeWalker` sólo de comentarios). */
function doc(readyState: DocumentReadyState, comentarios: string[]) {
  return {
    readyState,
    body: {},
    documentElement: {},
    createTreeWalker: (_raiz: unknown, que: number) => {
      assert.equal(que, 128, 'el walker tiene que pedir SÓLO comentarios (NodeFilter.SHOW_COMMENT)');
      let i = 0;
      return { nextNode: () => (i < comentarios.length ? { data: comentarios[i++] } : null) };
    },
  } as unknown as Document;
}

test('paginaLista: el documento terminó de llegar y ningún borde de Suspense del server espera ni está por revelarse', () => {
  assert.equal(paginaLista(doc('complete', ['$', '/$'])), true);
  assert.equal(paginaLista(doc('interactive', [])), true);
  assert.equal(paginaLista(doc('loading', [])), false, 'el stream sigue abierto: la página puede no haber llegado');
  // Una página con `loading.tsx`: el esqueleto entre <!--$?--> y <!--/$--> hasta que llega su contenido.
  assert.equal(paginaLista(doc('complete', ['$', '/$', '$?', '/$'])), false, 'el esqueleto todavía a la vista');
  // Llegó (`$RC`), pero React 19.2 la revela hasta 300 ms después (`$RV`).
  assert.equal(paginaLista(doc('complete', ['$~', '/$'])), false, 'llegó pero todavía no se ve');
  // `$!` = el server falló y el cliente la dibuja: no espera nada del stream.
  assert.equal(paginaLista(doc('complete', ['$!', '/$'])), true);
});

test('al irse marca <html> (un ShellM montado de nuevo no pinta ni un cuadro), y el efecto está cableado así', () => {
  const attrs: Record<string, string> = {};
  marcarDocumento({ documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } } as unknown as Document);
  assert.ok(ATTR_ENTRADA_VISTA in attrs, 'la próxima se pinta un cuadro antes de irse');
  // El cableado del efecto (lo único que no corre sin DOM): espera a `paginaLista(document)` y termina marcando el documento.
  const src = readFileSync(join(RAIZ, 'app/m/_ui/EntradaApp.tsx'), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(src, /lista: \(\) => paginaLista\(document\),/);
  assert.match(src, /const terminar = \(\) => \{ marcarDocumento\(document\); alFin\.current\(\); \};/);
  assert.match(src, /if \(entradaYaVista\(\)\) \{ terminar\(\); return; \}/);
  assert.match(src, /timers\.push\(window\.setTimeout\(terminar, ms \+ 30\)\);/);
});
