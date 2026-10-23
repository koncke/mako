// =============================================================================
// Hijo de tests/ia-pc-firma-mac.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Importa el programa REAL (scripts/ia-pc/mako-pc.mjs) con su carpeta en un directorio temporal y prueba lo que hace MaKo.app
// FIRMADA al abrirse: reconocer que es la app y copiarse a la carpeta del arranque. Escribe el resultado como JSON.
// =============================================================================

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'mako-pc-firma-mac-'));
process.env.MAKO_PC_DIR = join(dir, 'pc');
process.env.MAKO_PC_SIN_ARRANQUE = '1';
const pc = await import(new URL('../scripts/ia-pc/mako-pc.mjs', import.meta.url).href);
const out = {};
out.esLaApp = [
  '/Applications/MaKo.app/Contents/MacOS/MaKo',
  '/private/var/folders/xy/T/AppTranslocation/1234/d/MaKo.app/Contents/MacOS/MaKo',
  '/Users/mau/.mako-pc/bin/mako-pc',
  '/Applications/MaKo.app/Contents/Resources/mako-pc-arm64',
  'C:\\Users\\marti\\.mako-pc\\bin\\mako-pc.exe',
].map((p) => pc.esLaAppDeMac(p));

const app = join(dir, 'MaKo.app', 'Contents', 'MacOS');
mkdirSync(app, { recursive: true });
const origen = join(app, 'MaKo');
writeFileSync(origen, 'el programa firmado, versión nueva');
const destino = join(dir, 'home', '.mako-pc', 'bin', 'mako-pc');
const cuarentena = [];
out.primera = pc.copiarLaAppAlArranque({ origen, destino, quitarCuarentena: (f) => cuarentena.push(f) }) === destino;
out.contenido = readFileSync(destino, 'utf8');
out.cuarentena = cuarentena.map((f) => f === `${destino}.nuevo`);
out.sinNuevo = !existsSync(`${destino}.nuevo`);
out.modo = process.platform === 'win32' ? 'windows' : (statSync(destino).mode & 0o777).toString(8);
// Otra vez, con la de antes en su lugar (la Mac ya conectada que abre la app nueva): la pisa.
writeFileSync(origen, 'el programa firmado, otra versión');
pc.copiarLaAppAlArranque({ origen, destino, quitarCuarentena: () => {} });
out.pisada = readFileSync(destino, 'utf8');
writeFileSync(1, `@@FIRMAMAC@@${JSON.stringify(out)}\n`);
rmSync(dir, { recursive: true, force: true });
setTimeout(() => process.exit(0), 200).unref();
