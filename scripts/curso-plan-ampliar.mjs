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

// ⚠️ Y EL TÍTULO NO SIEMPRE SIRVE NI COMO DESEMPATE. En BigSEO alcanzaba con sacarle el
// número de orden; en «Jaque Blue» las dos capturas leyeron rótulos DISTINTOS para la
// misma clase —«1- Pre INTRO» contra «PRE INTRO», «3. Haz Bajo La manga» contra «AS BAJO
// LA MANGA»— y el match cayó a 2 de 20, o sea que 18 clases ya bajadas se habrían vuelto
// a bajar y a transcribir. Las duraciones, en cambio, coincidían las 20.
//
// Así que el criterio es de DOS PASADAS: primero título+duración, que es el fuerte, y lo
// que quede se resuelve por DURACIÓN sola. La duración no es única por diseño (acá hay
// dos clases con 812 y 813 s), por eso va segunda y consumiendo de a una: lo que empareja
// bien por nombre no entra nunca a la pasada floja.
//
// La tolerancia existe porque las dos fuentes redondean distinto: la misma clase figura
// con 812 s en el inventario y 813 en el plan.
const TOLERANCIA_S = 2;

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

// PASADA 1 (fuerte): título + duración. Se resuelve entera antes de tocar la floja, para
// que una coincidencia de duración no le robe la entrada a un match por nombre.
const empareja = new Map();
for (const c of nuevo.clases) {
  const cola = porClave.get(clave(c));
  if (cola?.length) empareja.set(c, cola.shift());
}
// PASADA 2 (floja): duración sola, con tolerancia, sobre lo que quedó sin emparejar.
const libresViejas = viejo.clases.filter((v) => ![...empareja.values()].includes(v));
for (const c of nuevo.clases) {
  if (empareja.has(c)) continue;
  const s = segundos(c);
  if (s == null) continue;
  const i = libresViejas.findIndex((v) => { const t = segundos(v); return t != null && Math.abs(t - s) <= TOLERANCIA_S; });
  if (i > -1) empareja.set(c, libresViejas.splice(i, 1)[0]);
}

for (const c of nuevo.clases) {
  const previa = empareja.get(c);
  if (previa) {
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
  // ⚠️ EL `archivo` DE UNA CLASE NUEVA HAY QUE RENUMERARLO. Viene del plan nuevo, donde
  // esta clase era la 16 de 23; acá pasa a ser la 22, y si el nombre se deja como estaba
  // quedan DOS archivos «16 - …» en la misma carpeta. Todo el pipeline aguas abajo lee el
  // número del BASENAME (`nDe()` en curso-audio, el mapeo de curso-a-drive), así que el
  // segundo «16» se atribuye a la clase 16 y el curso queda mezclado — que es justo lo
  // que este script existe para evitar. Pasó con «Jaque Blue»: 13, 16 y 18 duplicados.
  const n = ++libre;
  const resto = String(c.archivo ?? c.titulo ?? '').replace(/^\d+\s*-\s*/, '');
  const conN = { ...c, n, archivo: `${String(n).padStart(2, '0')} - ${resto}` };
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
