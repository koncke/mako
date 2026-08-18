// =============================================================================
// curso-huecos — ¿le falta alguna clase o algún módulo a los cursos del portal?
// =============================================================================
// El dueño encontró A OJO que a «Hackeando la Edición» le faltaban dos clases del
// módulo 1 y el módulo 5 entero. Nada en la app lo decía: el portal mostraba «64
// clases, 6 módulos» y el número cerraba solo.
//
// POR QUÉ NO SE VE. Nuestro campo `n` es una numeración PROPIA, corrida de 1 a N sobre
// lo que se logró bajar. Si de 66 clases entraron 64, `n` igual va a 64 sin saltos y el
// hueco desaparece. El único testigo de lo que había en el ORIGEN es el título, que
// viene con el número del autor adentro: «10. Cortes en J y L».
//
// Es el cuarto contador de esta área que cuenta lo que hay en vez de lo que debería
// haber (ver docs/hallazgos-conocimiento.md, «tercera vez que un contador miente»).
//
// ⚠️ UN HUECO NO PRUEBA QUE FALTE ALGO. Prueba que el autor no numera corrido, que es
// otra cosa. Corrido sobre «Hackeando la Edición» dio «falta el Módulo 5 y las clases 10
// y 28»; al volver a preguntarle a la plataforma, el origen tiene EXACTAMENTE lo mismo:
// ese módulo está vacío allá y esas dos clases no existen. Esto SEÑALA dónde mirar; lo
// que decide es `curso-plan-vip.mjs` contra la fuente, y el resultado se anota en
// VERIFICADOS para no volver a investigar lo mismo.
//
//   node scripts/curso-huecos.mjs
//   node scripts/curso-huecos.mjs --curso hackeando-la-edicion
// =============================================================================
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'app', 'conocimientos');
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : ''; };
const SOLO = arg('curso');

// Los archivos vienen en dos dialectos —`titulo: '…'` y `"titulo": "…"`— porque unos los
// escribió el generador y otros salieron de un JSON. Los dos matchean acá.
// El título se corta en la primera comilla: alcanza y sobra, porque lo único que se mira
// es el número del ARRANQUE.
const RE_TITULO = /["']?titulo["']?\s*:\s*["']([^"']*)/;
const RE_MODULO = /["']?modulo["']?\s*:\s*(\d+)/;
const RE_GRUPO = /["']?grupo["']?\s*:\s*["']([^"']*)/;
const RE_CORTE = /["']?n["']?\s*:\s*\d+/;

/** Las clases EN ORDEN, con su módulo y su título, leyendo el archivo como TEXTO.
 *  Se parsea en vez de importar porque `catalogo.ts` arrastra componentes de React. */
function clasesDe(texto) {
  // Cada clase arranca en su `n:`; lo que va hasta el próximo `n:` es todo suyo.
  return texto.split(RE_CORTE).slice(1).map((p) => {
    const t = RE_TITULO.exec(p);
    if (!t) return null;
    const m = RE_MODULO.exec(p);
    const g = RE_GRUPO.exec(p);
    return { titulo: t[1].trim(), modulo: m ? Number(m[1]) : 0, grupo: g ? g[1].trim() : '' };
  }).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// HUECOS YA VERIFICADOS CONTRA LA FUENTE
// ─────────────────────────────────────────────────────────────────────────────
// Un hueco en la numeración del autor NO prueba que nos falte algo: prueba que el
// autor no numera corrido. La única forma de saberlo es volver a preguntarle a la
// plataforma, y cuando se hace, el resultado es un HECHO que no se puede perder —
// si no, el mismo curso se investiga de cero cada vez que alguien corre esto.
//
// Se verifica así: abrir el Chrome dedicado en la página del curso
// (`scripts/curso-perfil.ps1 -Url <página>`) y correr `scripts/curso-plan-vip.mjs`,
// que captura la respuesta del RPC que la propia página pidió. Si el plan nuevo
// trae lo mismo que el viejo, el hueco es del origen.
// ⚠️ «VERIFICADO» ACÁ SIGNIFICA SOLO «VERIFICADO EN CLASES DE VIDEO».
// La primera versión de este mapa decía que el Módulo 5 de Guille estaba «vacío en la
// plataforma». Era falso y lo vio el dueño: el módulo se llama «Bonus 2 - Mis LUTs» y
// tiene ocho archivos .CUBE adentro. No tiene LECCIONES — y el RPC contra el que se
// verificó devuelve lecciones, así que contestó cero y eso se leyó como «no hay nada».
// Un endpoint que no puede ver una cosa no es evidencia de que esa cosa no exista.
const VERIFICADOS = {
  'hackeando-la-edicion': {
    fecha: '2026-08-18',
    // El RPC `get_vip_lessons_secure` devolvió las mismas 64 clases, sin una de más ni
    // de menos, así que POR EL LADO DEL VIDEO no falta nada: el Módulo 5 no tiene
    // lecciones y el autor saltea la 10 y la 28 del Módulo 1.
    nota: 'ninguna clase de VIDEO falta (RPC idéntico). Pero el Módulo 5 «Bonus 2 - Mis LUTs» tiene 8 archivos .CUBE que NO están bajados — los recursos son otro problema, ver hallazgos-conocimiento',
  },
};

/** El número que le puso el AUTOR, del arranque del título. null si no numera. */
function numDelAutor(titulo) {
  const m = /^\s*(\d{1,3})\s*[.)\-]/.exec(titulo);
  return m ? Number(m[1]) : null;
}

/** Los enteros que faltan entre el mínimo y el máximo de la lista. */
function huecos(nums) {
  const set = new Set(nums);
  const falt = [];
  for (let i = Math.min(...nums); i <= Math.max(...nums); i++) if (!set.has(i)) falt.push(i);
  return falt;
}

const archivos = readdirSync(DIR).filter((f) => /^curso-.*\.ts$/.test(f));
archivos.unshift('curso.ts');

let conProblemas = 0;
let sinEvaluar = 0;
let revisados = 0;

for (const f of archivos) {
  const slug = f === 'curso.ts' ? 'avatarhype' : f.replace(/^curso-/, '').replace(/\.ts$/, '');
  if (SOLO && slug !== SOLO) continue;
  const clases = clasesDe(readFileSync(join(DIR, f), 'utf8'));
  if (!clases.length) continue;
  revisados++;

  const lineas = [];
  const noEvaluables = [];

  // ── Huecos de MÓDULO. Tener 1,2,3,4,6,7 significa que falta el 5 entero.
  //
  // OJO: el número sale de la ETIQUETA («Módulo 6 - Bonus 3»), no del campo `modulo`.
  // Ese campo sufre la MISMA renumeración que `n`: en Hackeando la Edición va 1..6
  // corrido mientras las etiquetas dicen 1,2,3,4,6,7. Preguntarle al campo por un hueco
  // es preguntarle al que lo tapó.
  const numDeGrupo = (g) => { const m = /m[oó]dulo\s*(\d{1,2})/i.exec(g || ''); return m ? Number(m[1]) : null; };
  const mods = [...new Set(clases.map((c) => numDeGrupo(c.grupo) ?? c.modulo).filter((m) => m > 0))].sort((a, b) => a - b);
  if (mods.length > 1) {
    const faltan = huecos(mods);
    if (faltan.length) lineas.push(`  ⚠ MÓDULO ${faltan.join(', ')} no está — hay: ${mods.join(', ')}`);
  }

  // ── Huecos de CLASE, por módulo, contra la numeración del autor.
  // Se agrupa por la ETIQUETA, no por el campo `modulo`. Varios cursos meten submódulos
  // adentro del mismo `modulo` («Sesiones Semanales 1 · Tráfico Pago» son 84 clases con
  // la numeración reiniciándose en cada bloque): agrupar por el campo grueso los junta y
  // hace ver como REPETIDAS a numeraciones que en el origen son de bloques distintos.
  const porMod = new Map();
  for (const c of clases) {
    const k = c.grupo || `Módulo ${c.modulo || 0}`;
    if (!porMod.has(k)) porMod.set(k, []);
    porMod.get(k).push(c);
  }
  for (const [etiqueta, cs] of porMod.entries()) {
    const nums = cs.map((c) => numDelAutor(c.titulo)).filter((n) => n !== null);
    // Si la mayoría de los títulos no trae número, el autor no numera: no hay con qué
    // comparar y decir «faltan 3» sería inventar un hueco.
    if (nums.length < 3 || nums.length < cs.length * 0.6) continue;
    // NÚMEROS REPETIDOS = LA AGRUPACIÓN ES MÁS GRUESA QUE LA DEL ORIGEN, no un duplicado.
    // Varios cursos anidan submódulos que reinician la numeración («3. ADVANTAGE» tiene
    // adentro tres bloques que arrancan de 1) y ese anidamiento no viaja en ningún campo
    // que podamos leer. Cuando pasa, el grupo NO es una secuencia y sus «faltan» tampoco
    // valen: se saltea entero y se dice cuántos quedaron sin evaluar.
    //
    // Es la regla de los umbrales de AGENTS.md: corrido contra los 23 cursos, reportar
    // igual daba 8 cursos con huecos INVENTADOS. Callarse acá es lo que separa la señal
    // del ruido — un verificador con falsos positivos no lo mira nadie dos veces.
    if (nums.length !== new Set(nums).size) { noEvaluables.push(etiqueta); continue; }
    const falt = huecos(nums);
    if (falt.length) lineas.push(`  ${etiqueta}: faltan las clases ${falt.join(', ')}   (hay ${nums.length}, el autor numera hasta ${Math.max(...nums)})`);
  }

  // Un curso donde TODO quedó sin evaluar se imprime igual. Si no, el silencio se lee
  // como «está completo» — que es exactamente el error que este script vino a cazar: un
  // contador que se calla no está diciendo «no hay huecos», está diciendo «no miré».
  // Ya verificado contra la fuente: se dice y se saca de la cuenta. Un curso que se fue a
  // mirar y volvió limpio no puede seguir apareciendo como sospechoso, o el listado se
  // vuelve una lista de cosas que nadie revisa.
  const ok = VERIFICADOS[slug];
  if (ok && lineas.length) {
    console.log(`\n□ ${slug}   (${clases.length} clases cargadas)  — VERIFICADO ${ok.fecha}`);
    for (const l of lineas) console.log(`  ·${l.replace(/^\s+⚠?\s*/, ' ')}`);
    console.log(`  ✓ ${ok.nota}`);
    continue;
  }

  if (lineas.length || noEvaluables.length) {
    if (lineas.length) conProblemas++; else sinEvaluar++;
    console.log(`\n■ ${slug}   (${clases.length} clases cargadas)${lineas.length ? '' : '  — SIN EVALUAR'}`);
    for (const l of lineas) console.log(l);
    if (noEvaluables.length) console.log(`  · ${noEvaluables.length} bloque(s) sin evaluar: la numeración se reinicia adentro (submódulos que no viajan en ningún campo)`);
  }
}

// El resumen nombra a los dos, y los sin evaluar NO se cuentan como sanos: el total del
// final es lo único que mucha gente va a leer.
console.log(conProblemas || sinEvaluar
  ? `\n${conProblemas} de ${revisados} cursos con huecos${sinEvaluar ? `, y ${sinEvaluar} que no se pueden evaluar` : ''}.`
  : `\nLos ${revisados} cursos revisados están completos (según la numeración del autor).`);
