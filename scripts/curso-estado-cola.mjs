// Como va la cola de cursos: que esta publicado, que esta a medias y que falta empezar.
//
//   node scripts/curso-estado-cola.mjs
//
// Complementa a `curso-censo-faltantes.mjs`: aquel contesta «que clases faltan y por que»
// dentro de los cursos publicados, y este contesta «por donde va la cola».
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogo = readFileSync(join(REPO, 'app/conocimientos/catalogo.ts'), 'utf8');

/**
 * ⚠️ EL CRUCE VA POR TITULO, NO POR SLUG. El slug de la cola y el de la ficha no coinciden
 *    siempre —la ficha le saca el «curso-» y a veces un «de-»—, y cruzar por slug daba
 *    cinco cursos publicados leidos como «sin publicar». El titulo es el mismo dato en los
 *    dos lados.
 */
const titulos = new Map();
for (const m of catalogo.matchAll(/from '\.\/(curso-[a-z0-9-]+)'/g)) {
  try {
    const src = readFileSync(join(REPO, `app/conocimientos/${m[1]}.ts`), 'utf8');
    const t = /\n  titulo: '([^']+)'/.exec(src);
    if (t) titulos.set(t[1].trim().toLowerCase(), m[1]);
  } catch { /* la ficha ya no esta */ }
}

/**
 * ⚠️ Y LOS REEMPLAZADOS NO SON UN PENDIENTE. `catalogo.ts` mantiene un `REEMPLAZADOS` con
 *    los cursos que se rehicieron: el viejo NO se importa —a proposito, para que nadie abra
 *    el corte viejo creyendo que es el bueno— pero su slug sigue resolviendo al nuevo.
 *    Sin mirar ese mapa, «Creativos Animados» figura eternamente como «terminado y sin
 *    publicar», que es una tarea que no existe.
 */
const reemplazados = new Set();
const bloque = /const REEMPLAZADOS[^[]*\[([\s\S]*?)\]\);/.exec(catalogo);
if (bloque) for (const m of bloque[1].matchAll(/\['([^']+)',\s*'([^']+)'\]/g)) reemplazados.add(m[1]);

const pub = [], medias = [], nuevos = [], incompletos = [], reemp = [];
const slugs = readFileSync('C:/cursos/_cola.txt', 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

for (const slug of slugs) {
  const base = `C:/cursos/${slug}`;
  if (!existsSync(join(base, 'plan.json'))) continue;
  let plan;
  try { plan = JSON.parse(readFileSync(join(base, 'plan.json'), 'utf8').replace(/^\uFEFF/, '')); } catch { continue; }

  // Igual que el pipeline: el objetivo son las clases que TIENEN video del otro lado.
  const alcanzables = plan.clases.filter((c) => c.videoId && !c.sinFuente).length;
  let txt = 0;
  try { txt = readdirSync(join(base, 'texto')).filter((f) => f.endsWith('.md') && !f.startsWith('_')).length; } catch {}
  let mudas = 0;
  try { mudas = readdirSync(join(base, 'audio')).filter((f) => f.endsWith('.mudo')).length; } catch {}
  const hechas = Math.min(txt + mudas, alcanzables);

  const tit = `${plan.curso ?? ''} - ${plan.autor ?? ''}`.replace(/^[\s-]+|[\s-]+$/g, '').toLowerCase();
  const publicado = titulos.has(tit) || titulos.has(String(plan.curso ?? '').trim().toLowerCase());

  if (reemplazados.has(slug)) reemp.push(slug);
  else if (publicado) { pub.push(slug); if (hechas < alcanzables) incompletos.push({ slug, hechas, alcanzables }); }
  else if (hechas >= alcanzables && alcanzables) medias.push({ slug, hechas, alcanzables, listo: true });
  else if (hechas) medias.push({ slug, hechas, alcanzables, listo: false });
  else nuevos.push({ slug, n: alcanzables });
}

console.log(`\n  publicados en MaKo ......... ${pub.length}`);
console.log(`  en curso / a medias ........ ${medias.length}`);
console.log(`  sin empezar ................ ${nuevos.length}`);
if (reemp.length) console.log(`  reemplazados (no van) ...... ${reemp.length}  ${reemp.join(', ')}`);
console.log(`  --- ${slugs.length} cursos en la lista`);

if (medias.length) {
  console.log('\n  ── en curso ──');
  for (const m of medias) console.log(`     ${String(m.hechas).padStart(3)}/${String(m.alcanzables).padEnd(4)} ${m.slug}${m.listo ? '   ← terminado, falta publicar' : ''}`);
}
if (incompletos.length) {
  const n = incompletos.reduce((a, b) => a + (b.alcanzables - b.hechas), 0);
  console.log(`\n  ── publicados con clases faltantes (${n}; el porque, en curso-censo-faltantes.mjs) ──`);
  for (const i of incompletos) console.log(`     ${String(i.hechas).padStart(3)}/${String(i.alcanzables).padEnd(4)} faltan ${String(i.alcanzables - i.hechas).padStart(2)}  ${i.slug}`);
}
if (nuevos.length) {
  console.log('\n  ── los que siguen, en orden de la cola ──');
  let t = 0;
  for (const x of nuevos) { console.log(`     ${String(x.n).padStart(3)} clases  ${x.slug}`); t += x.n; }
  console.log(`\n     ${t} clases por delante`);
}
console.log('');
