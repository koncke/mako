// =============================================================================
// Al abrir la app en el teléfono sale UNA entrada de MaKo: en el primer HTML, igual al splash del sistema, y el final del
// onboarding no la repite (20/10 → 22/10/2026)
// =============================================================================
// Martín pidió que la entrada del onboarding salga al abrir la app en el teléfono dos veces: el 18/10 (punto 2) y el 21/10
// (pedidos del Ops Center 91ebee6f y e180365d). Las dos ramas lo hicieron por su lado (EntradaMobile, en el layout, y la de
// ShellM) y al juntarlas salían DOS: quedó la de ShellM.
// 22/10/2026, 09:46, desde su Android: «Al entrar en Mobile, me sigue apareciendo eso [el splash], cuando te pedí que solo
// sea la criatura de MaKo... Luego de ese logo recién aparece la criatura... Y lo peor es que entre medio, se ve el ops
// center por unos segundos». Medido (docs/hallazgos-mobile.md): la entrada era un `dynamic(..., { ssr: false })`, montado
// por un efecto: no existía hasta hidratar, y hasta ahí se veía el Centro del server. Lo que fija este archivo:
//   1. una sola entrada (EntradaApp, en ShellM), importada de frente y NACIDA PRENDIDA (está en el HTML del server); el
//      layout no monta otra; EntradaApp no importa .css (los tests de node importan app/m/_ui);
//   2. la MISMA marca de sessionStorage en ShellM, EntradaApp, el script de antes de pintar y el final del onboarding;
//   3. el onboarding marca la entrada cuando la VIO (sin cambios);
//   4. el HTML del server trae la entrada entera: la capa, su CSS en línea, la baldosa del splash, la chispa y la criatura;
//   5. el primer cuadro ES el splash: el fondo es el `background_color` del manifest, el maskable es el único y es el mismo
//      archivo que se midió, y la criatura cae sobre la chispa; los primeros 250 ms no se mueve nada;
//   6. con movimiento reducido, la criatura quieta (sólo fundidos);
//   7. el script de antes de pintar (corrido de verdad): apaga la entrada ya vista y corrige el centro sólo en la app
//      instalada, sin leer estilos;
//   8. ese script sale entero del minificador del build;
//   9. se va cuando la app está lista (un efecto, después de hidratar), nunca antes de 1 s, volando a la barra; si
//      JavaScript no llega, el CSS la saca a los 15 s.
//
// ROTURAS (21/10/2026, romper.js + roturas-una-entrada.json del scratchpad; base 3/0): vuelve la entrada al layout → 2/1 ·
// ShellM con su propia clave escrita → 2/1 · el onboarding no la marca vista → 2/1 · la entrada importada directo en
// ShellM → 2/1 (esa rotura era la de la entrada DIFERIDA; desde el 22/10 lo correcto es lo contrario).
// ROTURAS (22/10/2026, scratchpad `romper-entrada.py`: una por vez, corridos este archivo, movil-carga-sin-error y
// movil-shell, restaurado y comprobado con sha256; BASE 32 pasan / 0 fallan entre los tres). pasan / fallan:
//   · ShellM vuelve a `dynamic(() => import('./EntradaApp'), { ssr: false })`        → 30 / 2 (test 1 y el de movil-shell)
//   · ShellM nace con `useState(false)` (la entrada vuelve a esperar al efecto)        → 30 / 2 (test 1 y el de movil-shell)
//   · EntradaApp importa `Criatura` (y con ella criatura.css)                          → 23 / 1 (este archivo ni carga en node)
//   · el script de antes de pintar con la clave escrita a mano ('mako_entrada')        → 30 / 2 (tests 2 y 7)
//   · el CSS sin `html[data-entrada-vista] .ea-capa { display: none; }`                 → 31 / 1 (test 4)
//   · el manifest con `background_color: '#FFFFFF'`                                     → 31 / 1 (test 5)
//   · la criatura de 120 px (CRIATURA_ARRANQUE fijo)                                   → 30 / 2 (tests 4 y 5)
//   · la baldosa arrancando a los 0 s                                                  → 31 / 1 (test 5)
//   · el bloque reducido sin apagar el flotar y el parpadeo                            → 31 / 1 (test 6)
//   · el script sin la guarda de `display-mode: standalone`                            → 31 / 1 (test 7)
//   · `MS_MINIMO = 0`                                                                  → 31 / 1 (test 9)
//   · el reloj leído de la animación de la criatura (terminada, se queda en 800 ms)    → 31 / 1 (test 9)
//   · EntradaApp pone la marca al montarse                                             → 30 / 2 (test 9 y el 2 de movil-carga-sin-error)
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import manifest from '../app/manifest';
import {
  ARRANQUE_ANTES_DE_PINTAR, ARTE_ARRANQUE, ATTR_ENTRADA_VISTA, CHISPA_EN_ARTE, CLAVE_ENTRADA_MOVIL, CRIATURA_ARRANQUE,
  FONDO_ARRANQUE, FORMA_ARRANQUE, VAR_BARRAS, trazoForma,
} from '../app/m/_ui/entrada';
import { CSS_ENTRADA_APP, EntradaApp, MS_MINIMO, MS_SALIDA, esperaParaSalir, trayecto } from '../app/m/_ui/EntradaApp';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** Las reglas de un bloque `@media (prefers-reduced-motion: reduce) { … }` del CSS. */
const bloqueReducido = (css: string) => css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

test('una sola entrada al abrir la app: la de ShellM, en el primer HTML, y el layout no monta otra', () => {
  const layout = sinComentarios(leer('app/m/layout.tsx'));
  assert.doesNotMatch(layout, /EntradaMobile|EntradaMako|EntradaApp|ENTRADA_ANTES_DE_PINTAR/, 'dos entradas: el layout monta otra además de la de ShellM');
  assert.equal(existsSync(join(RAIZ, 'app/m/_ui/EntradaMobile.tsx')), false);
  const shell = sinComentarios(leer('app/m/_ui/ShellM.tsx'));
  // De frente: diferida (`dynamic`, sin SSR) no existe hasta hidratar, y hasta ahí se veía el Centro (22/10/2026).
  assert.match(shell, /^import \{ EntradaApp \} from '\.\/EntradaApp';$/m);
  assert.doesNotMatch(shell, /dynamic\(|ssr: false|EntradaMako/, 'la entrada vuelve a cargarse después de hidratar');
  // Nace PRENDIDA, en el server: el estado inicial es el mismo en el server y al hidratar (si no, React no la encuentra).
  assert.match(shell, /const \[entrada, setEntrada\] = useState\(\(\) => !cliente && limpia\(pathname\) !== RUTA_CONFIGURAR\);/);
  assert.match(shell, /\{entrada && <EntradaApp destino=\{`\[\$\{DESTINO_ENTRADA\}\]`\} onFin=\{finEntrada\} \/>\}/);
  // Sin .css: el índice de app/m/_ui lo arrastraría a los tests de node (run 182). Criatura.tsx importa criatura.css.
  const entrada = sinComentarios(leer('app/m/_ui/EntradaApp.tsx'));
  assert.doesNotMatch(entrada, /^import .*\.css';$/m);
  assert.doesNotMatch(entrada, /from '@\/app\/admin\/operaciones\/Criatura'|from '@\/app\/_components\/Criatura'/);
});

test('la marca de «ya salió» es UNA: la leen ShellM, la entrada y el script de antes de pintar, y la pone el onboarding', () => {
  assert.equal(CLAVE_ENTRADA_MOVIL, 'mako_entrada_m');
  const shell = sinComentarios(leer('app/m/_ui/ShellM.tsx'));
  assert.match(shell, /import \{ CLAVE_ENTRADA_MOVIL \} from '\.\/entrada';/);
  assert.match(shell, /const LS_ENTRADA = CLAVE_ENTRADA_MOVIL;/, 'una constante escrita dos veces se desincroniza');
  assert.match(sinComentarios(leer('app/m/_ui/EntradaApp.tsx')), /sessionStorage\.getItem\(CLAVE_ENTRADA_MOVIL\)/);
  assert.ok(ARRANQUE_ANTES_DE_PINTAR.includes(`sessionStorage.getItem('${CLAVE_ENTRADA_MOVIL}')`), 'el script mira otra clave');
  assert.match(sinComentarios(leer('app/m/_ui/entrada.ts')), /getItem\('\$\{CLAVE_ENTRADA_MOVIL\}'\)/, 'la clave escrita a mano en el script');
});

test('la entrada que ya se vio en el onboarding no se repite al entrar; la que no se vio, sí', () => {
  const chat = sinComentarios(leer('app/onboarding/ChatArranque.tsx'));
  assert.match(chat, /import \{ CLAVE_ENTRADA_MOVIL \} from '@\/app\/m\/_ui\/entrada';/);
  // Se marca cuando la intro del onboarding se VIO (su onFin), no al terminar: quien retomaba el onboarding en otra apertura
  // de la app no veía ninguna (cuarta revisión, 21/10).
  const intro = chat.slice(chat.indexOf('{intro && <EntradaMako onFin={() => {'), chat.indexOf("void llamar({ action: 'intro' });"));
  assert.match(intro, /sessionStorage\.setItem\(CLAVE_ENTRADA_MOVIL, '1'\)/);
  const entrar = chat.slice(chat.indexOf('const entrar = useCallback('), chat.indexOf('}, [vista.modo, router]);'));
  assert.doesNotMatch(entrar, /CLAVE_ENTRADA_MOVIL/, 'al terminar no se marca: la intro pudo no haberse visto en esta apertura');
});

test('el HTML del server trae la entrada entera: capa, CSS en línea, la baldosa del splash, la chispa y la criatura', () => {
  const html = renderToString(createElement(EntradaApp, { destino: '[data-mako-foto-barra]', onFin: () => {} }));
  assert.match(html, /^<div class="ea-capa" role="presentation" aria-hidden="true"><style>/, 'la capa no es lo primero o no tapa');
  assert.ok(html.includes('@keyframes ea-nace') && html.includes('@keyframes ea-flota'), 'el movimiento no viene en el HTML');
  assert.ok(html.includes('<clipPath id="ea-forma"><path d="M117.50 0.00'), 'falta la forma del splash');
  assert.ok(html.includes('fill="url(#ea-fondo)"') && html.includes('fill="url(#ea-oro)"'), 'falta la baldosa o la chispa');
  assert.match(html, /<svg class="mun mun--despierto" width="135" height="135"/, 'falta la criatura (Muneco, que dibuja el server)');
  // La que ya se vio en esta apertura no se pinta ni un cuadro: el script de antes de pintar marca <html> y esto la apaga.
  assert.ok(CSS_ENTRADA_APP.includes(`html[${ATTR_ENTRADA_VISTA}] .ea-capa { display: none; }`), 'una entrada vista se vuelve a ver');
  // Tapa todo lo de la app (toasts, hojas, avisos).
  assert.match(CSS_ENTRADA_APP, /\.ea-capa \{\s*position: fixed; inset: 0; z-index: 9999;/);
});

test('el primer cuadro ES el splash: el fondo del manifest, el único maskable (el medido), la criatura sobre la chispa', () => {
  const m = manifest();
  assert.equal(m.background_color, FONDO_ARRANQUE, 'el splash y el primer cuadro con fondos distintos');
  assert.ok(CSS_ENTRADA_APP.includes(`background-color: ${FONDO_ARRANQUE};`));
  // Chrome elige el maskable para el splash (y la pantalla de inicio). Otro maskable, u otro arte en el mismo archivo, es otro
  // splash: hay que volver a medir el primer cuadro (app/m/_ui/entrada.ts) antes de cambiar esta huella.
  const maskables = (m.icons ?? []).filter((i) => String(i.purpose ?? '').includes('maskable'));
  assert.deepEqual(maskables.map((i) => i.src), ['/icon-maskable-512.png']);
  const huella = createHash('sha256').update(readFileSync(join(RAIZ, 'public/icon-maskable-512.png'))).digest('hex');
  assert.equal(huella, '41b293bfb2e7aa8bb77b5dba7bf1f1f752f3ea9a7243c449b0a3c886f38d567d', 'cambió el ícono del splash: medir de nuevo el primer cuadro');
  // Las medidas: la forma adentro del arte, y las puntas de la criatura (38 de 40 unidades) sobre las de la chispa.
  assert.ok(FORMA_ARRANQUE < ARTE_ARRANQUE);
  const chispa = ARTE_ARRANQUE * CHISPA_EN_ARTE;
  assert.ok(Math.abs((CRIATURA_ARRANQUE * 38) / 40 - chispa) < 1, `criatura ${CRIATURA_ARRANQUE}px para una chispa de ${chispa}px`);
  const d = trazoForma(FORMA_ARRANQUE / 2);
  const xs = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((x) => Number(x[1]));
  assert.equal(Math.max(...xs), FORMA_ARRANQUE / 2);
  assert.equal(Math.min(...xs), -FORMA_ARRANQUE / 2);
  // Los primeros 250 ms es el splash quieto (Chrome lo levanta con un fundido): nada arranca antes.
  for (const regla of ['.ea-baldosa', '.ea-sello']) {
    const r = CSS_ENTRADA_APP.match(new RegExp(`\\n\\${regla} \\{ animation: [\\w-]+ \\.\\d+s [^;]*?(\\.\\d+)s both; \\}`));
    assert.ok(r && Number(r[1]) >= 0.25, `${regla} arranca antes de los 250 ms`);
  }
  assert.match(CSS_ENTRADA_APP, /\.ea-cria \{ display: flex; animation: ea-nace \.5s cubic-bezier\([^)]*\) \.3s both,/);
  assert.match(CSS_ENTRADA_APP, /@keyframes ea-nace \{\s*0% \{ opacity: 0;/, 'la criatura se ve en el primer cuadro');
});

test('con movimiento reducido la criatura queda QUIETA: sólo fundidos, sin rebote, sin flotar, sin parpadear', () => {
  const r = bloqueReducido(CSS_ENTRADA_APP);
  assert.match(r, /\.ea-cria \{ animation: ea-aparece \.2s linear \.25s both; \}/);
  assert.match(r, /\.ea-capa \.mun-cuerpo, \.ea-capa \.mun-ojos--parpadeo \{ animation: none !important; \}/);
  assert.match(r, /\.ea-chispitas \{ display: none; \}/);
  assert.match(CSS_ENTRADA_APP, /@keyframes ea-aparece \{ from \{ opacity: 0; \} to \{ opacity: 1; \} \}/, 'el fundido mueve algo');
  assert.match(sinComentarios(leer('app/m/_ui/EntradaApp.tsx')), /const t = quieta \? null : trayecto\(/, 'sin movimiento no vuela');
});

/** Una ventana falsa donde correr el script de antes de pintar. */
function correr(o: { storage?: Map<string, string> | null; instalada?: boolean; pantalla?: number; ventana?: number }) {
  const attrs: Record<string, string> = {};
  const vars: Record<string, string> = {};
  const storage = o.storage === undefined ? new Map<string, string>() : o.storage;
  let estilosLeidos = 0;
  const w: Record<string, unknown> = {
    document: { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; }, style: { setProperty: (k: string, v: string) => { vars[k] = v; } } } },
    sessionStorage: storage === null
      ? { getItem: () => { throw new Error('SecurityError'); } }
      : { getItem: (k: string) => storage.get(k) ?? null },
    screen: { height: o.pantalla ?? 882 },
    innerHeight: o.ventana ?? 882,
    getComputedStyle: () => { estilosLeidos += 1; return {}; },
  };
  w.matchMedia = (q: string) => ({ matches: q === '(display-mode: standalone)' && !!o.instalada });
  w.window = w;
  vm.runInNewContext(ARRANQUE_ANTES_DE_PINTAR, w);
  return { vista: ATTR_ENTRADA_VISTA in attrs, barras: vars[VAR_BARRAS], estilosLeidos };
}

test('el script de antes de pintar apaga la entrada ya vista y centra como el splash sólo en la app instalada', () => {
  assert.equal(correr({}).vista, false, 'una apertura nueva no la ve');
  assert.equal(correr({ storage: new Map([[CLAVE_ENTRADA_MOVIL, '1']]) }).vista, true, 'un documento más de la misma apertura la repite');
  assert.equal(correr({ storage: null }).vista, true, 'sin sessionStorage no se sabe: la entrada saldría en cada pantalla');
  // La app instalada: la barra de estado (30 px) corre la página respecto del splash, que se centra en la pantalla entera.
  assert.equal(correr({ instalada: true, pantalla: 882, ventana: 852 }).barras, '30px');
  assert.equal(correr({ instalada: false, pantalla: 882, ventana: 790 }).barras, undefined, 'en una pestaña la barra de direcciones no es un splash');
  assert.equal(correr({ instalada: true, pantalla: 882, ventana: 500 }).barras, undefined, 'pantalla partida o teclado: no se corrige');
  assert.equal(correr({ instalada: true }).estilosLeidos, 0, 'leer estilos antes de pintar arranca la animación antes de que se vea');
  // El CSS corrige sólo si la página llega hasta abajo (edge-to-edge): ahí la diferencia es toda de la barra de estado.
  assert.ok(CSS_ENTRADA_APP.includes(`min(env(safe-area-inset-bottom, 0px) * 1000, var(${VAR_BARRAS}, 0px) / 2)`));
  // Va en el layout de /m ANTES de ShellM (que trae la entrada).
  const layout = sinComentarios(leer('app/m/layout.tsx'));
  assert.ok(layout.indexOf('__html: ARRANQUE_ANTES_DE_PINTAR') > 0 && layout.indexOf('__html: ARRANQUE_ANTES_DE_PINTAR') < layout.indexOf('<ShellM'));
});

test('el script de antes de pintar sale ENTERO del minificador del build', async () => {
  const req = createRequire(join(RAIZ, 'package.json'));
  const swc = req('next/dist/build/swc/index.js');
  if (swc.loadBindings) await swc.loadBindings();
  const r = await swc.transform(leer('app/m/_ui/entrada.ts'), {
    filename: 'entrada.ts',
    jsc: { parser: { syntax: 'typescript' }, target: 'es2020', minify: { compress: true, mangle: false } },
    minify: true,
    module: { type: 'es6' },
  });
  // Lo emitido se corre (sin los `export`) y el script tiene que ser el mismo texto que el del fuente.
  const emitido = (r.code as string).replace(/export\s*\{[^}]*\};?/g, '').replace(/\bexport\s+/g, '');
  const valor = vm.runInNewContext(`${emitido};ARRANQUE_ANTES_DE_PINTAR`, {}) as string;
  assert.equal(valor, ARRANQUE_ANTES_DE_PINTAR, 'el minificador cambió el texto del script');
  assert.doesNotThrow(() => new Function(valor));
});

test('se va cuando la app está lista (después de hidratar), nunca antes de 1 s, volando a la barra; sin JS, a los 15 s', () => {
  assert.equal(MS_MINIMO, 1000);
  assert.ok(MS_SALIDA <= 450, 'la salida tiene que ser corta');
  assert.equal(esperaParaSalir(700), 300, 'lista a los 0,7 s: espera hasta el segundo');
  assert.equal(esperaParaSalir(1500), 0, 'lista después del segundo: se va ya');
  // El reloj es el de su propia animación, no el primer pintado de la página: montada navegando (después del login), con
  // el primer pintado de hace rato, se iba en el acto.
  assert.match(sinComentarios(leer('app/m/_ui/EntradaApp.tsx')), /const t = capa\?\.getAnimations\(\)\[0\]\?\.currentTime;/);
  // El vuelo: de la criatura (135 px, flotando 7 px arriba del centro de su capa) al Ops Center de la barra (24 px).
  const capa = { left: 68, top: 304, width: 274, height: 274 };
  const t = trayecto({ left: 137.5, top: 366.5, width: 135, height: 135 }, { left: 193, top: 820, width: 24, height: 24 }, capa);
  assert.deepEqual(t, { origen: '137px 130px', fin: `translate(0px, 398px) scale(${24 / 135})` });
  assert.equal(trayecto({ left: 0, top: 0, width: 135, height: 135 }, { left: 0, top: 0, width: 0, height: 0 }, capa), null, 'sin barra: se funde');
  assert.equal(trayecto(null, undefined, capa), null);
  // La salida corre en un EFECTO (después de hidratar), y la marca la pone ShellM al terminar, no la entrada al montarse.
  const src = sinComentarios(leer('app/m/_ui/EntradaApp.tsx'));
  assert.match(src, /useEffect\(\(\) => \{\n\s*if \(entradaYaVista\(\)\) \{ alFin\.current\(\); return; \}/);
  assert.doesNotMatch(src, /sessionStorage\.setItem/);
  assert.match(CSS_ENTRADA_APP, /animation: ea-seguro \.3s ease 15s forwards;/);
  assert.match(CSS_ENTRADA_APP, /@keyframes ea-seguro \{ to \{ opacity: 0; visibility: hidden; \} \}/);
});
