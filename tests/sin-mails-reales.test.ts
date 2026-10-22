// =============================================================================
// Ningún mail real de un dueño o de un colaborador en tests/, docs/ ni AGENTS.md (22/10/2026)
// =============================================================================
// La revisión adversarial de Offer (22/10/2026) encontró en main el mail del dueño de un negocio en un test, y el barrido
// que siguió, mails de dueños y colaboradores en 30 archivos de docs y tests. Se reemplazaron por inventados del mismo
// formato (un gmail sigue siendo un gmail). Esta guarda frena los más obvios: compara la HUELLA (sha256 del mail en
// minúscula) de cada mail que aparece en esas carpetas contra la de los mails reales de los usuarios de MaKo (sin el de
// Martín, que es quien opera) y dos gmail personales que aparecían. El repo no guarda ningún mail en claro: sólo huellas.
// Sin falsos positivos: un mail inventado («ana@gmail.com») no tiene la huella de nadie. Un dueño NUEVO no está en la
// lista: se suma su huella acá (`node -e "console.log(require('crypto').createHash('sha256').update('<mail>').digest('hex'))"`).
// ⚠️ La historia de git conserva lo que ya estuvo en main (docs/hallazgos-offer.md, «Datos reales en el repo»).
//
// ⚠️ PROBADO ROMPIÉNDOLO (22/10/2026, arnés romper-guarda.mjs en el scratchpad de la sesión): un mail real metido en un doc
// y en un test hace fallar la guarda; uno inventado no.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const HUELLAS = new Set<string>([
  '0377a0640328e86673cd97554e830d63d4e457c41a77501371df079e6a52d444',
  '0c3e3b99138edf2139f7af3a5b6ae2699b6b7819dc3608e85a81bbfb94eeaed7',
  '104496018aa66488c46af455e0ae9115b4f29abcfdb23793d69463e24a438fdf',
  '13091feb2cc3906f82bf3bd54988257891f0c74e6638aeeb585421cf3424fee0',
  '13638211d5cc8f58c51ed51723773f26063e5f69f3ac1739a648413cea6957d5',
  '3b7f76b6fb5599109a7b1816ddde2e976ad1c4ed47e86eb86766b36958f3a191',
  '42b427b1afc2eb11dd50a952fd402893d1940ed8d6a1271eb8338132f67b4d2e',
  '56b612ab277c4128c005abc02b604fefa788e683053c07c305e336d0d133ae68',
  '5a30578170434df1ed4e008a20c2ab695c95793cc4b38d0bcbc32a229c2fdee5',
  '6d27976c1546de783da77dfae0b775f97ff9508fbb7639b284642d84a2699933',
  '719d9d23632bc9916dd5a70ee9992e3d2ce29c8725bf355827364a24fb064baf',
  '76fc59f10c326bfdb24b85056ab61a2a2c4cad1d15447495e208211461edbbfd',
  '82c08af288dd0e1e447c38f5513b1fb6c3a33c46273e2b78a0c1d5d91c24f3d3',
  '98c14d1383ecef6c1e07c5a4862f52a4ee43ec9d5fbb2245172c13bb2f77cc42',
  'a8e930ee7a73a1b27d15b31fd8fd32e86fc9edea0288ce4ccc4ad8fc191fa491',
  'b7d4020d95aec93265597902f424837eb636d5036a09a85093eb5e84fa251b6c',
  'effb82ea795155f24ae157d01d7b2b5e5777db3409d76bf4560d634b8dec0da3',
  'f472748ca7278f01b22e9f96c3970d9f2647345ab8dbae07912d07ffdc16b8aa',
]);
const MAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const huella = (m: string) => createHash('sha256').update(m.toLowerCase()).digest('hex');
/** Cómo se nombra uno encontrado sin volver a escribirlo: la primera letra y el dominio. */
const enmascarar = (m: string) => `${m[0]}…@${m.split('@')[1]}`;

/** Los mails reales que aparecen en un texto (con su línea), enmascarados. */
function mailsReales(texto: string): string[] {
  const out: string[] = [];
  texto.split('\n').forEach((linea, i) => {
    for (const m of linea.match(MAIL) ?? []) if (HUELLAS.has(huella(m.replace(/\.+$/, '')))) out.push(`línea ${i + 1}: ${enmascarar(m)}`);
  });
  return out;
}

test('la guarda reconoce un mail inventado como inventado (sin falsos positivos)', () => {
  assert.equal(HUELLAS.size >= 15, true, 'la lista de huellas está');
  assert.deepEqual(mailsReales('ana@gmail.com, ejemplo.ws13.mako@gmail.com y dueno@negocio-uno.com'), []);
});

test('ningún mail real de un dueño o un colaborador en tests/, docs/ ni AGENTS.md', () => {
  const archivos = execFileSync('git', ['ls-files', 'tests', 'docs', 'AGENTS.md'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 << 20 })
    .split('\n').filter((f) => /\.(ts|tsx|mts|mjs|md|txt|json)$/i.test(f));
  assert.ok(archivos.length > 100, `revisé ${archivos.length} archivos: la lista no puede venir vacía`);
  const hallados: string[] = [];
  for (const f of archivos) {
    let t: string;
    try { t = readFileSync(join(RAIZ, f), 'utf8'); } catch { continue; }
    for (const h of mailsReales(t)) hallados.push(`${f} ${h}`);
  }
  assert.deepEqual(hallados, [], 'un mail real en el repo: reemplazalo por uno inventado del mismo formato (un gmail, por un gmail inventado)');
});
