// =============================================================================
// perfil-cdp — el perfil temporal de Chrome, que se borra solo (6/11/2026)
// =============================================================================
// Los tres scripts que manejan Chrome por CDP (`mirar-consola`, `mirar-pantalla`, `onboarding-vg-recorrer`) hacían
// `mkdtempSync(join(tmpdir(), 'mako-cdp-'))` y no lo borraban NUNCA: ni al terminar bien, ni al cortar con Ctrl-C, ni al
// morir. Un perfil de Chrome son decenas de MB, y estos scripts se corren muchas veces por día.
//
// ⚠️ EL BORRADO VA EN `process.on('exit')`, NO EN UN `finally`. Los tres son scripts de top-level await que terminan con
// `ws.close(); chrome.kill();` y pueden morir en cualquier `await` del medio: un `finally` habría que envolverlo en todo el
// archivo, y de todos modos no corre si el proceso se va por una señal. El handler de `exit` cubre los tres caminos.
//
// ⚠️ CHROME PRIMERO, LA CARPETA DESPUÉS. En Windows, un Chrome vivo tiene los archivos del perfil abiertos y el borrado
// falla con EBUSY/EPERM. Por eso `perfilTemporal` se queda con el hijo y lo mata ella antes de borrar. Y aun así se reintenta
// (`maxRetries`): Chrome tarda un instante en soltarlos después del kill.
//
// ⚠️ ES UN FAVOR, NO UNA GARANTÍA: si el borrado falla, no se avisa ni se cambia el código de salida. Un script que ya hizo
// su trabajo no puede fallar por no haber podido limpiar. Lo que quede huérfano lo barre `scripts/limpiar-temporales.mjs`.
// =============================================================================

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const PREFIJO_PERFIL = 'mako-cdp-';

/**
 * Una carpeta de perfil de Chrome que se borra al salir. Devuelve `{ dir, aCargoDe }`:
 * `dir` para el `--user-data-dir`, y `aCargoDe(chrome)` para entregarle el proceso que hay que matar antes de borrar.
 */
export function perfilTemporal() {
  const dir = mkdtempSync(join(tmpdir(), PREFIJO_PERFIL));
  let hijo = null;
  process.on('exit', () => {
    try { hijo?.kill(); } catch { /* ya estaba muerto */ }
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }); } catch { /* es un favor */ }
  });
  // Ctrl-C y `taskkill` no disparan `exit` solos: se vuelven una salida normal para que el handler de arriba corra.
  for (const senal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(senal, () => { process.exitCode = 130; process.exit(); });
  }
  return { dir, aCargoDe: (chrome) => { hijo = chrome; return chrome; } };
}
