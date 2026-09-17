// =============================================================================
// generar-api-doc — escribe docs/api-mako.md y el snapshot de lo que sale por HTTP
// =============================================================================
//   node --import tsx scripts/generar-api-doc.mjs           escribe los dos archivos
//   node --import tsx scripts/generar-api-doc.mjs --check   falla si quedaron viejos (pre-push)
//
// La referencia de la API NO se escribe a mano: sale de lib/api-mako/areas/*.def.ts
// por lib/api-mako/docs.ts, que es el MISMO módulo que sirve GET /api/v1/docs. Dos
// copias de un contrato es el bug del `detalle` que este repo ya pagó.
//
// El snapshot (tests/api-mako-http.snapshot.txt) es la lista EN POSITIVO de las
// operaciones que salen por HTTP: el test lo compara con el registro, así que
// exponer una operación nueva es regenerar el snapshot y commitearlo con el cambio
// — o sea, DECIDIRLO, en vez de que entre sola.
//
// ⚠️ SE COMPARA SIN LOS `\r`. El archivo en disco es CRLF (core.autocrlf=true) y lo
// generado es LF: en un clon nuevo o un worktree git normaliza todo a CRLF y la
// comparación exacta frena el push sobre un archivo idéntico. Ya pasó con las otras
// guardas de esta familia (AGENTS.md).
//
// ⚠️ EN --check EL ARCHIVO GENERADO SE LEE DE HEAD — PERO EL REGISTRO SE IMPORTA DEL
// DISCO, y esas dos cosas solo son la misma pregunta si lib/api-mako está limpio.
// Con definiciones sin commitear en el disco (la otra sesión a medio escribir un
// área), comparar «lo que el disco genera» contra «lo que HEAD publica» frena el
// push de alguien que no tocó nada de esto: el candado sin llave que AGENTS.md
// prohíbe. Así que si lib/api-mako tiene cambios locales, la guarda AVISA, lista qué
// y se abstiene — igual que hooks-en-orden.sh con los .tsx sin commitear. Si el
// disco está limpio, el registro del disco ES el de HEAD y la comparación vale.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://hola-mako.com';
const check = process.argv.includes('--check');
const sinCR = (s) => s.replace(/\r/g, '');

if (check) {
  let sucios = '';
  try {
    sucios = execFileSync('git', ['status', '--porcelain', '--', 'lib/api-mako'], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { sucios = ''; }
  const lineas = sinCR(sucios).split('\n').filter(Boolean);
  if (lineas.length) {
    console.log(`  · lib/api-mako tiene ${lineas.length} cambio(s) sin commitear: no puedo contestar sobre lo que se publica, así que no frenó nada.`);
    for (const l of lineas.slice(0, 8)) console.log(`      ${l}`);
    console.log('    Si son tuyos: commitealos junto con docs/api-mako.md y el snapshot regenerados.');
    process.exit(0);
  }
}

const { referenciaMarkdown } = await import('../lib/api-mako/docs.ts');
const { REGISTRO } = await import('../lib/api-mako/registro.ts');

const SALIDAS = [
  ['docs/api-mako.md', referenciaMarkdown(BASE)],
  ['tests/api-mako-http.snapshot.txt', REGISTRO.filter((d) => d.canales.includes('http')).map((d) => d.id).sort().join('\n') + '\n'],
];

let sucio = 0;
for (const [destino, generado] of SALIDAS) {
  if (check) {
    let enGit = null;
    try { enGit = execFileSync('git', ['show', `HEAD:${destino}`], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { enGit = null; }
    if (enGit === null) { console.error(`  ✖ ${destino} no está en git.`); sucio++; continue; }
    if (sinCR(enGit) !== sinCR(generado)) { console.error(`  ✖ ${destino} quedó viejo respecto del registro (lib/api-mako/areas/*.def.ts).`); sucio++; continue; }
    console.log(`  ✓ ${destino} al día.`);
    continue;
  }
  const ruta = path.join(RAIZ, destino);
  const actual = fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8') : '';
  if (sinCR(actual) === sinCR(generado)) console.log(`  · ${destino} ya estaba al día.`);
  else { fs.writeFileSync(ruta, generado, 'utf8'); console.log(`  ✓ escribí ${destino} (${generado.length} caracteres).`); }
}
if (check && sucio) {
  console.error('    Corré: node --import tsx scripts/generar-api-doc.mjs, y commitealo.');
  process.exit(1);
}
