// =============================================================================
// cache-lecturas.cjs — precarga (`node --require`) para correr VARIAS barredoras en UN proceso
// =============================================================================
// POR QUE EXISTE: ~68 de los tests del repo son barredoras GLOBALES: cada una lee los mismos ~5.400 archivos de app/ y lib/ (medido
// el 17/10/2026 rastreando fs: 62 de ellas leen más de 1.500 archivos, y otras 6 más de 500). Con `node --test` cada archivo de test
// es un proceso aparte, así que esos 5.400 archivos se leen y se listan 68 veces: en esta PC (Windows, con ~14 chats) 12 de ellas
// tardaron 193 s con 2 procesos y 40 s en UN proceso que memoriza las lecturas. El costo era el disco, no el regex.
//
// QUE HACE: memoriza `fs.readFileSync` de los archivos del repo y los `git ls-files` / `git grep` (la misma lectura no se repite entre
// test y test). Si algo ESCRIBE o borra un archivo, se olvida esa entrada. No toca nada fuera del repo (tmpdir, el home).
//
// ⚠️ SÓLO SE USA JUNTO CON `--test-isolation=none` Y SÓLO PARA BARREDORAS que no tocan estado global (scripts/tests-afectados.mjs →
// `compartible`). Compartir proceso comparte también `globalThis`, `process.env` y los módulos importados: medido el mismo día,
// `editor-landing-origen` falló en un proceso compartido porque otro test dejó algo que hacía creer a lib/app-url.ts que corría
// «en el navegador», y pasó solo. Por eso todo rojo de un proceso compartido se REPITE aislado antes de contarlo como rojo.
// Esto es para la PC; en Actions el disco es rápido y cada test sigue en su proceso.
// =============================================================================
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const raiz = path.resolve(process.cwd()).replace(/\\/g, '/') + '/';
const dentro = (p) => {
  try { return typeof p === 'string' && path.resolve(p).replace(/\\/g, '/').startsWith(raiz) && !/node_modules|[\\/]\.next[\\/]|[\\/]\.git[\\/]/.test(p); } catch { return false; }
};

const lecturas = new Map();
const originalLeer = fs.readFileSync;
fs.readFileSync = function (p, opciones) {
  if (dentro(p)) {
    const clave = `${path.resolve(p)}|${typeof opciones === 'string' ? opciones : JSON.stringify(opciones ?? null)}`;
    if (!lecturas.has(clave)) lecturas.set(clave, originalLeer.call(this, p, opciones));
    return lecturas.get(clave);
  }
  return originalLeer.call(this, p, opciones);
};

// Lo que escribe o borra invalida su entrada: una barredora nunca debería escribir en el repo, pero si un test lo hace no lee viejo.
for (const nombre of ['writeFileSync', 'appendFileSync', 'unlinkSync', 'rmSync', 'renameSync', 'copyFileSync']) {
  const original = fs[nombre];
  if (typeof original !== 'function') continue;
  fs[nombre] = function (p, ...resto) {
    const destino = `${path.resolve(String(p))}|`;
    for (const clave of [...lecturas.keys()]) if (clave.startsWith(destino)) lecturas.delete(clave);
    return original.call(this, p, ...resto);
  };
}

const comandos = new Map();
const originalExecFile = cp.execFileSync;
cp.execFileSync = function (cmd, args, opciones) {
  if (cmd === 'git' && Array.isArray(args) && /^(?:ls-files|grep)$/.test(args[0])) {
    const clave = JSON.stringify([args, opciones && opciones.cwd, opciones && opciones.encoding]);
    if (!comandos.has(clave)) comandos.set(clave, originalExecFile.call(this, cmd, args, opciones));
    return comandos.get(clave);
  }
  return originalExecFile.call(this, cmd, args, opciones);
};
