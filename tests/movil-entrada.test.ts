// =============================================================================
// Al abrir la app en el teléfono sale UNA entrada de MaKo, y el final del onboarding no la repite (20/10 → 21/10/2026)
// =============================================================================
// Martín pidió que la entrada del onboarding salga al abrir la app en el teléfono dos veces: el 18/10 (punto 2) y el 21/10
// (pedidos del Ops Center 91ebee6f y e180365d). Las dos ramas lo hicieron por su lado: esta (EntradaMobile, en el layout) y
// la del 21/10 en main (ShellM, una vez por apertura, vuela a la criatura de la barra y no se pinta en el server). Al
// juntarlas salían DOS. Queda la de ShellM; la de esta rama se fue, con su script y su CSS.
// Lo que fija este test: una sola entrada (la de ShellM), cargada diferida (trae un .css que tumba los tests de node), y
// la MISMA marca de sessionStorage en ShellM y en el final del onboarding, para que quien termina el onboarding en el
// teléfono no la vea dos veces seguidas (app/m/_ui/entrada.ts).
//
// ROTURAS (21/10/2026, romper.js + roturas-una-entrada.json del scratchpad; base 3/0): vuelve la entrada al layout → 2/1 ·
// ShellM con su propia clave escrita → 2/1 · el onboarding no la marca vista → 2/1 · la entrada importada directo en
// ShellM → 2/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAVE_ENTRADA_MOVIL } from '../app/m/_ui/entrada';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('una sola entrada al abrir la app: la de ShellM, y el layout no monta otra', () => {
  const layout = sinComentarios(leer('app/m/layout.tsx'));
  assert.doesNotMatch(layout, /EntradaMobile|EntradaMako|ENTRADA_ANTES_DE_PINTAR/, 'dos entradas: el layout monta otra además de la de ShellM');
  assert.equal(existsSync(join(__dirname, '..', 'app/m/_ui/EntradaMobile.tsx')), false);
  const shell = sinComentarios(leer('app/m/_ui/ShellM.tsx'));
  // Diferida: su criatura importa un .css y el índice de app/m/_ui lo arrastraría a los tests de node (run 182).
  assert.match(shell, /const EntradaMako = dynamic\(\(\) => import\('@\/app\/onboarding\/EntradaMako'\)/);
  assert.doesNotMatch(shell, /import \{ EntradaMako \}/, 'la entrada importada directo arrastra su .css al índice de app/m/_ui');
  assert.match(shell, /\{entrada && <EntradaMako /);
});

test('la marca de «ya salió» es UNA: la lee ShellM y la pone el final del onboarding', () => {
  assert.equal(CLAVE_ENTRADA_MOVIL, 'mako_entrada_m');
  const shell = sinComentarios(leer('app/m/_ui/ShellM.tsx'));
  assert.match(shell, /import \{ CLAVE_ENTRADA_MOVIL \} from '\.\/entrada';/);
  assert.match(shell, /const LS_ENTRADA = CLAVE_ENTRADA_MOVIL;/, 'una constante escrita dos veces se desincroniza');
  assert.match(shell, /if \(sessionStorage\.getItem\(LS_ENTRADA\)\) return;/);
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
