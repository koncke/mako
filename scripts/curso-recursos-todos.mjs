// =============================================================================
// curso-recursos-todos — bajar, subir y publicar los recursos de TODOS los cursos
// =============================================================================
// Los cuatro pasos por curso, en orden, para los que tienen material sin bajar:
//
//   1. curso-recursos-vip.mjs   baja los archivos (por URL firmada o por el lector)
//   2. curso-a-drive.mjs        los copia a G: y espera a que Drive registre
//   3. curso-a-drive --solo-ids resuelve el id de cada uno
//   4. curso-a-portal.mjs       emite la ficha con la sección «Recursos»
//
// ⚠️ SECUENCIAL, y no se puede paralelizar: hay UN Chrome con UNA sesión y CDP en un
// solo puerto. Dos cursos a la vez se pisan la pestaña.
//
// ⚠️ EL PLAN QUE VALE ES EL QUE TIENE `drive.json` AL LADO. Varios cursos tienen DOS
// carpetas en C:\cursos —una con el slug y otra con «Curso - Autor»— y el trabajo real
// (audio, texto, drive.json) vive en una sola. Pasar la equivocada deja los recursos en
// una carpeta huérfana: pasó con los 56 de Guille, que hubo que mover a mano.
//
// Cada paso se registra con su código de salida. Un curso que falla NO frena a los
// demás: se anota y se sigue, porque abortar el lote por uno deja los otros ocho sin
// tocar y sin explicación.
//
//   node scripts/curso-recursos-todos.mjs                 → dice qué haría
//   node scripts/curso-recursos-todos.mjs --aplicar
//   node scripts/curso-recursos-todos.mjs --aplicar --solo bigseo-academy
// =============================================================================
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { esFinderJunk } from './curso-comun.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const APLICAR = process.argv.includes('--aplicar');
const SOLO = arg('solo', '');
const RAIZ = arg('raiz', 'C:\\cursos');
const REPO = process.cwd();

/** Los cursos con recursos en la fuente que el portal todavía no tiene. Sale del
 *  inventario, no de una lista escrita a mano: una lista se queda vieja. */
function pendientes() {
  const out = [];
  for (const dir of readdirSync(RAIZ)) {
    const planPath = join(RAIZ, dir, 'plan.json');
    const drivePath = join(RAIZ, dir, 'drive.json');
    // Sin drive.json esta NO es la carpeta operativa del curso (ver la nota de arriba).
    if (!existsSync(planPath) || !existsSync(drivePath)) continue;
    let plan;
    try { plan = JSON.parse(readFileSync(planPath, 'utf8').replace(/^\uFEFF/, '')); } catch { continue; }
    const slug = plan.slug;
    if (!slug || (SOLO && slug !== SOLO)) continue;
    if (!/cursoselite/.test(String(plan.pagina ?? ''))) continue;   // otra plataforma

    // Cuántos recursos ÚNICOS dice la fuente que hay (inventario), y cuántos ya tenemos.
    const inv = [join(RAIZ, dir, 'inventario.json'), join(RAIZ, slug, 'inventario.json')]
      .find((p) => existsSync(p));
    let enFuente = 0;
    if (inv) {
      try {
        const j = JSON.parse(readFileSync(inv, 'utf8'));
        // ⚠️ `recursosUnicos` VIENE DE UNA FOTO TOMADA CON LA POLÍTICA VIEJA: cuenta los
        // `._` de macOS, que el bajador ya no baja. Leerlo tal cual dejaba a «Programa
        // RAIO» con «80 faltan» PERMANENTE — y con --aplicar el lote volvía a correr sus
        // cuatro pasos (bajar 183, subir a Drive, esperar ids 10 min, republicar) para
        // terminar exactamente donde estaba, corrida tras corrida. Un pendiente que no
        // se puede completar nunca no es un pendiente: es ruido que tapa a los reales.
        const det = j.recursosDetalle ?? [];
        enFuente = det.length
          ? det.filter((r) => !esFinderJunk(r.titulo ?? r.title)).length
          : (j.recursosUnicos ?? 0);
      } catch { /* sin inventario utilizable */ }
    }
    const ts = join(REPO, 'app', 'conocimientos', `curso-${slug}.ts`);
    const enPortal = existsSync(ts)
      ? Math.max(0, (readFileSync(ts, 'utf8').match(/slug: '/g) ?? []).length - 1)
      : 0;
    if (enFuente > enPortal) out.push({ slug, dir, planPath, enFuente, enPortal });
  }
  return out.sort((a, b) => (b.enFuente - b.enPortal) - (a.enFuente - a.enPortal));
}

const correr = (script, args) => {
  const r = spawnSync(process.execPath, [join(REPO, 'scripts', script), ...args], {
    encoding: "utf8", timeout: Number(arg("tope-min", 20)) * 60 * 1000,
  });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { ok: r.status === 0, code: r.status, cola: salida.trim().split('\n').slice(-4).join('\n   ') };
};

const cursos = pendientes();
console.log(`\n  ${cursos.length} curso(s) con recursos por bajar:\n`);
for (const c of cursos) console.log(`    ${String(c.enFuente - c.enPortal).padStart(4)} faltan  ${c.slug}   (${c.dir})`);
if (!APLICAR) { console.log('\n  Corrida SECA. Sumá --aplicar para ejecutar.\n'); process.exit(0); }

const resumen = [];
for (const [i, c] of cursos.entries()) {
  console.log(`\n${'═'.repeat(74)}\n[${i + 1}/${cursos.length}] ${c.slug}\n${'═'.repeat(74)}`);
  const pasos = [
    ['bajar recursos', 'curso-recursos-vip.mjs', ['--plan', c.planPath, '--segundos', '18']],
    ['subir a Drive', 'curso-a-drive.mjs', ['--plan', c.planPath]],
    ['resolver ids', 'curso-a-drive.mjs', ['--plan', c.planPath, '--solo-ids']],
    ['publicar', 'curso-a-portal.mjs', ['--plan', c.planPath]],
  ];

  // ⚠️ DRIVE TARDA EN REGISTRAR, Y ESO NO ES UN ERROR. Copiar a G: es instantáneo (es una
  // carpeta local), pero el id solo existe cuando el archivo llegó DEL LADO DEL SERVIDOR.
  // El paso «resolver ids» devuelve 0/5 y el de publicar aborta pidiendo justamente lo que
  // acaba de correr — un lote que se rinde ahí deja el curso a medias por esperar 40
  // segundos. Se reintenta hasta que todos tengan id, con un tope para no colgarse.
  // ⚠️ SE VERIFICA EL ARCHIVO, NO EL LOG. La primera versión buscaba «N/M con id» en las
  // últimas líneas de la salida y, si no lo encontraba, devolvía `r.ok` — o sea, asumía
  // que estaba bien. Con cursos grandes esa línea queda fuera de las últimas cuatro, así
  // que «resolver ids» decía ok y «publicar» abortaba pidiendo justo lo que acababa de
  // correr: 5 de 8 cursos del lote murieron ahí. Es el mismo «el silencio se lee como
  // éxito» que este trabajo viene cazando todo el día, cometido en la propia espera.
  //
  // Ahora la verdad sale de `drive.json`: cuántos recursos tienen `driveId`.
  const idsListos = () => {
    try {
      const d = JSON.parse(readFileSync(join(RAIZ, c.dir, 'drive.json'), 'utf8').replace(/^﻿/, ''));
      const r = d.recursos ?? [];
      const archivos = r.filter((x) => x.tipo !== 'link');
      const conId = archivos.filter((x) => x.driveId);
      return { total: archivos.length, con: conId.length };
    } catch { return { total: 0, con: 0 }; }
  };

  const esperarIds = async () => {
    for (let intento = 1; intento <= 30; intento++) {   // 30 x 20s = 10 min
      correr('curso-a-drive.mjs', ['--plan', c.planPath, '--solo-ids']);
      const { total, con } = idsListos();
      if (total > 0 && con === total) return true;
      if (total === 0 && intento > 2) return true;      // curso sin recursos: nada que esperar
      process.stdout.write(`(${con}/${total}) `);
      await new Promise((res) => setTimeout(res, 20000));
    }
    return false;
  };
  let falla = '';
  for (const [nombre, script, args] of pasos) {
    process.stdout.write(`  → ${nombre}… `);
    if (nombre === 'resolver ids') {
      const ok = await esperarIds();
      console.log(ok ? 'ok' : 'FALLÓ (Drive no terminó de registrar)');
      if (!ok) { falla = nombre; break; }
      continue;
    }
    const r = correr(script, args);
    console.log(r.ok ? 'ok' : `FALLÓ (${r.code})`);
    if (!r.ok) { console.log(`   ${r.cola}`); falla = nombre; break; }

    // ⚠️ UN CURSO SIN RECURSOS NO ES UN CURSO FALLADO. La API es la que manda, y para
    // «Mateo Maffia» dice CERO —el «2» del inventario era de otro curso—. Sin archivos
    // en disco, los tres pasos que siguen no tienen nada que hacer y el de Drive aborta
    // con un error que se lee como un problema del curso. Se corta acá y se dice.
    if (nombre === 'bajar recursos') {
      const dir = join(RAIZ, c.dir, 'recursos');
      const n = existsSync(dir) ? readdirSync(dir).length : 0;
      if (!n) { console.log('     (la fuente no tiene recursos para este curso: nada que subir ni publicar)'); falla = ''; break; }
    }
  }
  resumen.push({ slug: c.slug, falla });
}

console.log(`\n${'═'.repeat(74)}\n  RESUMEN\n${'═'.repeat(74)}`);
for (const r of resumen) console.log(`  ${r.falla ? '✖' : '✓'} ${r.slug.padEnd(36)} ${r.falla ? `cortó en: ${r.falla}` : 'completo'}`);
const mal = resumen.filter((r) => r.falla).length;
console.log(`\n  ${resumen.length - mal} completo(s) · ${mal} con problema\n`);
