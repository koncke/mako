// ¿A cuáles de estos cursos ENTRA la cuenta? Un sondeo barato antes de enumerar.
//
//   node scripts/cursos-sondear.mjs --categoria IA
//   node scripts/cursos-sondear.mjs --categoria Ecommerce --espera 12
//
// ⚠️ POR QUÉ NO ALCANZA CON `curl`. Un curso que la cuenta NO tiene **rebota al catálogo
// desde el NAVEGADOR** (la SPA hace el redirect, no el servidor), así que por HTTP
// contesta 200 en la URL del curso y se ve idéntico a uno accesible. El 27/08/2026 el
// enumerador gastó dos cursos descubriéndolo de a uno, con dos mensajes de error
// distintos —«No encontré ninguna clase» y «No hay ninguna pestaña con esa URL»— que
// escondían la misma causa. Sondear los N de una cuesta un minuto y ahorra el resto.
//
// Requiere el Chrome dedicado abierto y logueado (scripts/curso-perfil.ps1).

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('port', 9333));
const CAT = arg('categoria', 'IA');
const ESPERA = Number(arg('espera', 9)) * 1000;
const RAIZ = arg('raiz', 'C:\\cursos');
const CATALOGO = arg('catalogo', join(RAIZ, 'catalogo-plataforma-full.json'));

const cdp = async (ruta, metodo = 'GET') => {
  const r = await fetch(`http://127.0.0.1:${PORT}${ruta}`, { method: metodo });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
};

const cat = JSON.parse(readFileSync(CATALOGO, 'utf8'));
const cursos = cat.filter((c) => (c.category || '') === CAT);
console.log(`\n  Sondeando ${cursos.length} cursos de «${CAT}»…\n`);

const entra = [];
const rebota = [];
for (const [i, c] of cursos.entries()) {
  const url = `https://cursoselite.com.mx/curso/${c.slug}`;
  let tab;
  try { tab = await cdp(`/json/new?${url}`, 'PUT'); } catch { /* se reporta abajo */ }
  await new Promise((r) => setTimeout(r, ESPERA));

  const lista = await cdp('/json');
  const t = Array.isArray(lista) ? lista.find((x) => x.id === (tab && tab.id)) : null;
  const final = (t && t.url) || '';
  // La prueba es la URL FINAL, no el HTTP: el rebote lo hace la SPA.
  const ok = final.includes(`/curso/${c.slug}`);
  (ok ? entra : rebota).push({ ...c, final });
  console.log(`  ${ok ? '✓' : '✖'} ${String(i + 1).padStart(2)}/${cursos.length}  ${(c.title || '').slice(0, 44).padEnd(44)} ${ok ? '' : '→ ' + (final.split('/').pop() || '?')}`);

  if (tab && tab.id) { try { await cdp(`/json/close/${tab.id}`); } catch { /* la cierra el usuario */ } }
}

console.log(`\n${'─'.repeat(70)}`);
console.log(`  ENTRA: ${entra.length} · REBOTA (la cuenta no lo tiene): ${rebota.length}`);
const salida = join(RAIZ, `_sondeo-${CAT.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`);
writeFileSync(salida, JSON.stringify({ entra, rebota }, null, 1), 'utf8');
console.log(`  → ${salida}\n`);
if (rebota.length) {
  console.log('  Los que rebotan NO son un error del script: la cuenta no los incluye.');
  for (const r of rebota) console.log(`     · ${r.title}`);
  console.log('');
}
