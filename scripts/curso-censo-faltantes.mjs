// Que clases quedaron sin transcribir en los cursos PUBLICADOS, y por que.
//
//   node scripts/curso-censo-faltantes.mjs
//
// Contesta la pregunta que importa cuando un curso figura incompleto: si lo que falta se
// puede recuperar o no. Las tres respuestas son distintas y piden cosas distintas —un 5xx
// se reintenta con scripts/cursos-rescatar.sh, un 404 no vuelve nunca, y una clase sin
// pista de audio no es una perdida sino material sin voz.
// Censo: de las clases sin texto en cursos YA PUBLICADOS, ¿cuáles son una pérdida real y
// a cuáles no hay nada que hacerles?
//
// ⚠️ SOLO LOS PUBLICADOS. Los que la cola todavía no procesó tienen CERO textos, así que
//    meterlos da 1.911 «clases sin texto» y ahoga las 14 que importan. Un censo sobre el
//    universo equivocado no da un número grande: da un número SIN SIGNIFICADO, y encima
//    con cara de catástrofe.
//
// La distinción no es cosmética: «faltan 14 clases» invita a seguir buscando, y si diez de
// esas catorce no existen en el origen, lo que corresponde es escribirlo y parar.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

// Qué cursos están publicados, cruzados por TÍTULO (el slug de la cola y el de la ficha no
// coinciden: la ficha le saca el «curso-» y a veces un «de-»).
const catalogo = readFileSync(join(REPO, 'app/conocimientos/catalogo.ts'), 'utf8');
const publicados = new Set();
for (const m of catalogo.matchAll(/from '\.\/(curso-[a-z0-9-]+)'/g)) {
  try {
    const src = readFileSync(join(REPO, `app/conocimientos/${m[1]}.ts`), 'utf8');
    const tt = /\n  titulo: '([^']+)'/.exec(src);
    if (tt) publicados.add(tt[1].trim().toLowerCase());
  } catch { /* la ficha ya no está */ }
}

// Un solo barrido de los logs para el error de cada id.
const errores = new Map();
for (const l of readdirSync('C:/cursos').filter((f) => f.endsWith('.log'))) {
  try {
    for (const m of readFileSync(join('C:/cursos', l), 'utf8').matchAll(/ERROR: \[[a-z]+\] (\d+): ([^\n]{0,120})/g)) {
      errores.set(m[1], m[2].trim());
    }
  } catch { /* log ilegible */ }
}
const tipo = (e) => !e ? 'sin rastro en los logs'
  : /404/.test(e) ? 'NO ESTÁ en el origen (404)'
  : /403/.test(e) ? 'sin permiso (403)'
  : /50\d/.test(e) ? 'caída del server (5xx)'
  : /timed out|curl: \(28\)/i.test(e) ? 'timeout'
  : 'otro';

const filas = [];
let cursos = 0;
for (const slug of readFileSync('C:/cursos/_cola.txt', 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
  const base = `C:/cursos/${slug}`;
  if (!existsSync(join(base, 'plan.json'))) continue;
  let plan;
  try { plan = JSON.parse(readFileSync(join(base, 'plan.json'), 'utf8').replace(/^\uFEFF/, '')); } catch { continue; }

  const tit = `${plan.curso ?? ''} - ${plan.autor ?? ''}`.replace(/^[\s-]+|[\s-]+$/g, '').toLowerCase();
  if (!publicados.has(tit) && !publicados.has(String(plan.curso ?? '').trim().toLowerCase())) continue;
  cursos++;

  const textos = new Set();
  try { for (const f of readdirSync(join(base, 'texto'))) textos.add(f.replace(/\.md$/i, '')); } catch {}
  const mudas = new Set();
  try { for (const f of readdirSync(join(base, 'audio'))) if (f.endsWith('.mudo')) mudas.add(f.replace(/\.mudo$/, '')); } catch {}

  for (const c of plan.clases) {
    if (textos.has(c.archivo)) continue;
    filas.push({
      slug, n: c.n, titulo: String(c.titulo).slice(0, 36),
      causa: mudas.has(c.archivo) ? 'sin pista de audio (nada que transcribir)' : tipo(errores.get(String(c.videoId))),
    });
  }
}

const por = {};
for (const f of filas) (por[f.causa] ??= []).push(f);

console.log(`\n  ${cursos} cursos publicados · ${filas.length} clase(s) sin texto\n`);
for (const [causa, xs] of Object.entries(por).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ── ${xs.length} · ${causa}`);
  for (const f of xs) console.log(`       ${f.slug.slice(0, 30).padEnd(32)} n=${String(f.n).padStart(3)}  ${f.titulo}`);
}
const perdidas = filas.filter((f) => !/audio|404/.test(f.causa));
console.log(`\n  ${filas.length - perdidas.length} sin nada que hacerles · ${perdidas.length} valdría la pena reintentar\n`);
