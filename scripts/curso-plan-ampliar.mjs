// =============================================================================
// curso-plan-ampliar — sumarle al plan las clases que faltaban, SIN renumerar
// =============================================================================
// Cuando una enumeración sale corta —«BigSEO Academy» salió con 77 de 136— no alcanza
// con volver a correr `curso-plan.mjs`: el plan nuevo trae los 136 numerados de 1 a 136,
// y ese `n` es la clave de TODO lo que ya se hizo.
//
//   drive.json           mapea n → videoId de Drive
//   video/ audio/ texto/ los archivos empiezan por «NN - »
//   public/cono-tx/      la transcripción vive bajo el videoId que sale de ese mapeo
//
// Pisar el plan con la numeración nueva no deja un curso incompleto: deja un curso
// MEZCLADO —la clase 50 apuntando al video de otra— y eso no se ve hasta que alguien
// abre una clase y escucha otra cosa. Es peor que la falta.
//
// Así que se AMPLÍA:
//   · el orden es el del plan NUEVO (que es el de la fuente, y es lo que ve el lector);
//   · una clase que ya estaba conserva su entrada vieja ENTERA (su `n`, su `archivo`,
//     su `videoId`, su `url`);
//   · una clase nueva entra con un `n` libre, después del máximo que ya existía.
//
// ⚠️ Y SI UNA CLASE VIEJA NO APARECE EN EL PLAN NUEVO, SE FRENA. Puede ser que el autor
// la borró, o puede ser que la enumeración nueva también salió corta — y son dos cosas
// distintas que se ven igual. Descartarla en silencio perdería una clase ya bajada y
// transcripta, así que se listan y decide una persona (--igualmente para seguir).
//
//   node scripts/curso-plan-ampliar.mjs --dir C:\cursos\bigseo-academy          → seco
//   node scripts/curso-plan-ampliar.mjs --dir C:\cursos\bigseo-academy --aplicar
// =============================================================================
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const DIR = arg('dir', '');
const APLICAR = process.argv.includes('--aplicar');
const IGUALMENTE = process.argv.includes('--igualmente');
if (!DIR || !existsSync(DIR)) { console.error('\n  ✖ Falta --dir <carpeta del curso>\n'); process.exit(1); }

const leer = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const P_VIEJO = join(DIR, 'plan.json');
const P_NUEVO = join(DIR, 'plan.nuevo.json');
for (const p of [P_VIEJO, P_NUEVO]) {
  if (!existsSync(p)) { console.error(`\n  ✖ Falta ${p}\n`); process.exit(1); }
}
const viejo = leer(P_VIEJO);
const nuevo = leer(P_NUEVO);

// ── QUÉ HACE QUE DOS ENTRADAS SEAN LA MISMA CLASE ───────────────────────────
//
// Ni el `n` (es lo que cambió), ni el `videoId` (la plataforma puede REPUBLICAR el
// curso entero: en «BigSEO Academy» los ids de Vimeo pasaron de 1199xxxxxx a
// 1219xxxxxx y la intersección con los viejos fue CERO, sobre el mismo contenido).
//
// Ni el MÓDULO: el plan viejo de BigSEO tiene los encabezados concatenados de la
// lección 33 en adelante («Modulo 06 - Headings Modulo 07 - Contenidos»), así que
// matchear por módulo daba 38 de 77 y hacía pasar por nuevas a 39 clases que ya
// estaban bajadas.
//
// Ni el TÍTULO solo: «Introducción» aparece una vez por módulo, 18 veces en total.
//
// La identidad es TÍTULO + DURACIÓN, y la duración es la que hace el trabajo pesado:
// sobrevive al reformateo del título (el orden viene pegado adelante de forma
// inconsistente: «01. Introducción», «02Qué es el SEO», «03.Google») y sobrevive a la
// republicación. Medido: 77 de 77 con este criterio, 38 de 77 con el módulo.
const norm = (s) => String(s ?? '').normalize('NFC')
  .replace(/^\d+[.\s]*/, '')            // el número de orden viene pegado y no es estable
  .replace(/\s+/g, ' ').trim().toLowerCase();
const segundos = (c) => {
  if (Number(c.segundos)) return Number(c.segundos);
  const p = String(c.duracion ?? '').split(':').filter((x) => /^\d+$/.test(x)).map(Number);
  if (p.length === 2) return p[0] * 60 + p[1];
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return null;
};
const clave = (c) => `${norm(c.titulo)}|${segundos(c) ?? '?'}`;

// Un mismo (módulo, título) puede repetirse de verdad: se consumen en orden.
const porClave = new Map();
for (const c of viejo.clases) {
  const k = clave(c);
  if (!porClave.has(k)) porClave.set(k, []);
  porClave.get(k).push(c);
}

let libre = Math.max(0, ...viejo.clases.map((c) => Number(c.n) || 0));
const usados = new Set();
const salida = [];
const nuevas = [];
for (const c of nuevo.clases) {
  const k = clave(c);
  const cola = porClave.get(k);
  if (cola?.length) {
    const previa = cola.shift();
    usados.add(previa);
    // ⚠️ SE CONSERVA `n` Y `archivo`, Y SE REFRESCA EL RESTO. Esos dos son el único
    // enganche con lo que ya existe en disco y en Drive («NN - Título.mp4», y
    // drive.json mapea n → videoId de Drive): tocarlos mezcla el curso.
    // Pero el `videoId` de la PLATAFORMA sí se actualiza, porque después de una
    // republicación el viejo ya no resuelve — conservarlo dejaría un plan que se ve
    // completo y falla entero la próxima vez que alguien quiera volver a bajar.
    salida.push({ ...c, n: previa.n, archivo: previa.archivo, sinFuente: previa.sinFuente ?? c.sinFuente });
    continue;
  }
  const conN = { ...c, n: ++libre };
  salida.push(conN);
  nuevas.push(conN);
}

const huerfanas = viejo.clases.filter((c) => !usados.has(c));

console.log(`\n  ${DIR}`);
console.log(`  plan viejo : ${viejo.clases.length} clases  (n hasta ${Math.max(0, ...viejo.clases.map((c) => Number(c.n) || 0))})`);
console.log(`  plan nuevo : ${nuevo.clases.length} clases`);
console.log(`  → resultado: ${salida.length} clases · ${nuevas.length} nuevas (n ${nuevas.length ? `${nuevas[0].n}–${nuevas[nuevas.length - 1].n}` : '—'}) · ${usados.size} conservadas`);

if (nuevas.length) {
  console.log(`\n  Las nuevas:`);
  for (const c of nuevas.slice(0, 40)) console.log(`    n=${String(c.n).padStart(3)}  ${String(c.modulo ?? '').slice(0, 30).padEnd(30)}  ${String(c.titulo).slice(0, 46)}`);
  if (nuevas.length > 40) console.log(`    … y ${nuevas.length - 40} más`);
}

if (huerfanas.length) {
  console.log(`\n  ⚠ ${huerfanas.length} clase(s) del plan viejo NO están en el nuevo:`);
  for (const c of huerfanas.slice(0, 20)) console.log(`    n=${String(c.n).padStart(3)}  ${String(c.modulo ?? '').slice(0, 30).padEnd(30)}  ${String(c.titulo).slice(0, 46)}`);
  console.log(`\n  Eso significa una de dos cosas, y NO se distinguen solas:`);
  console.log(`    · el autor las sacó del curso  → está bien perderlas`);
  console.log(`    · la enumeración nueva TAMBIÉN salió corta → perderlas es perder trabajo hecho`);
  if (!IGUALMENTE) {
    console.log(`\n  Freno acá. Mirá la lista y, si corresponde, repetí con --igualmente.`);
    console.log(`  (Con --igualmente se CONSERVAN igual, al final del plan.)\n`);
    process.exit(2);
  }
  console.log(`\n  --igualmente: las conservo al final del plan.\n`);
  salida.push(...huerfanas);
}

if (!APLICAR) { console.log(`\n  Corrida SECA. Sumá --aplicar para escribir plan.json.\n`); process.exit(0); }

// El plan viejo se guarda al lado antes de tocarlo: es la única copia del mapeo n→archivo.
const bak = join(DIR, `plan.json.bak-ampliar`);
copyFileSync(P_VIEJO, bak);
writeFileSync(P_VIEJO, JSON.stringify({ ...viejo, clases: salida }, null, 1), 'utf8');
console.log(`\n  ✓ plan.json ampliado a ${salida.length} clases.`);
console.log(`    copia del anterior en ${bak}\n`);
console.log(`  Siguiente: curso-bajar → curso-audio → curso-transcribir → curso-a-drive → curso-a-portal\n`);
