// =============================================================================
// sync-extension-local — copia extension/ a las carpetas que Chrome tiene cargadas
// =============================================================================
// ⚠️ Existe por un día entero perdido. Al cliente se le descomprimió el zip en una
// carpeta suelta, y Chrome quedó leyendo ESA copia: cada arreglo de la extensión
// salía a producción, él le daba a «recargar» —correctamente— y Chrome recargaba
// con total fidelidad el código de dos horas antes. Se diagnosticaron durante
// horas los resultados de una versión que ya no existía.
//
// Lo que lo delata es la VERSIÓN, y por eso ahora se muestra en chrome://extensions
// y en la propia pantalla del Video Generator. Lo que lo evita es esto.
//
// De dónde saca las carpetas: del perfil de Chrome, NO de una lista escrita a
// mano. Una lista se queda vieja el día que alguien descomprime en otro lado —
// que es exactamente el bug que este script viene a cerrar.
//
//   node scripts/sync-extension-local.mjs           ← sincroniza
//   node scripts/sync-extension-local.mjs --donde   ← solo dice dónde están

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const ORIGEN = resolve(import.meta.dirname, '..', 'extension');
const PERFILES = join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');

/** Las rutas desde las que Chrome tiene cargada una extensión desempaquetada de MaKo. */
function carpetasCargadas() {
  const out = new Set();
  if (!existsSync(PERFILES)) return out;

  for (const perfil of readdirSync(PERFILES)) {
    for (const archivo of ['Preferences', 'Secure Preferences']) {
      const p = join(PERFILES, perfil, archivo);
      if (!existsSync(p)) continue;
      let datos;
      try { datos = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
      const settings = datos?.extensions?.settings ?? {};
      for (const conf of Object.values(settings)) {
        const ruta = conf?.path;
        // `location: 4` es UNPACKED — el marcador que Chrome le pone a lo cargado
        // con «Cargar descomprimida».
        //
        // Se filtra por ahí y NO por la forma del path. El primer intento decía
        // «las desempaquetadas tienen ruta absoluta» y era cierto pero insuficiente:
        // las que Chrome trae de fábrica (el visor de PDF, web_store) también la
        // tienen, apuntando a Program Files. Un filtro por forma acierta hasta que
        // aparece el caso que comparte la forma sin ser lo mismo.
        if (conf?.location !== 4) continue;
        if (typeof ruta !== 'string' || !existsSync(join(ruta, 'manifest.json'))) continue;
        try {
          const m = JSON.parse(readFileSync(join(ruta, 'manifest.json'), 'utf8'));
          if (m?.name === 'MaKo') out.add(ruta);
        } catch { /* manifest ilegible: no es nuestra */ }
      }
    }
  }
  return out;
}

const version = JSON.parse(readFileSync(join(ORIGEN, 'manifest.json'), 'utf8')).version;
const destinos = carpetasCargadas();

if (destinos.size === 0) {
  console.log('No hay ninguna carpeta de MaKo cargada en Chrome.');
  console.log(`Cargá esta en chrome://extensions → «Cargar descomprimida»:\n  ${ORIGEN}`);
  process.exit(0);
}

const soloMirar = process.argv.includes('--donde');
for (const destino of destinos) {
  const antes = JSON.parse(readFileSync(join(destino, 'manifest.json'), 'utf8')).version;
  if (soloMirar) { console.log(`${antes.padEnd(8)} ${destino}`); continue; }
  for (const f of readdirSync(ORIGEN)) writeFileSync(join(destino, f), readFileSync(join(ORIGEN, f)));
  console.log(`✅ ${antes} → ${version}   ${destino}`);
}

if (!soloMirar) {
  console.log('\nFalta el paso que ningún script puede hacer: chrome://extensions → ↻ en MaKo.');
  console.log(`Comprobá que la tarjeta diga ${version}. Si dice otra cosa, hay una carpeta más.`);
}
