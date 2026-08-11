// =============================================================================
// cargar-programa-whop — el temario de `lib/programa-catalogo.ts` a Whop
// =============================================================================
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/cargar-programa-whop.ts
//   …--aplicar   → escribe de verdad. Sin el flag solo dice qué haría.
//   …--visible   → publica el curso. Por defecto nace OCULTO, ver abajo.
//   …--actualizar → reescribe el cuerpo de las lecciones que ya existen. Sin
//                  esto solo crea las que faltan y nunca corrige un texto.
//
// ES IDEMPOTENTE, y no es un lujo: la API de Whop no tiene "crear si no existe".
// Correrlo dos veces sin comparar por título dejaría el curso con 84 clases
// duplicadas y ningún endpoint para borrarlas en lote. Por eso cada nivel
// (experiencia → curso → capítulo → lección) se busca por título antes de crear.
//
// EL CURSO NACE OCULTO A PROPÓSITO. Todavía no hay un solo video grabado: un
// curso visible con 42 lecciones de puro texto es peor que no tenerlo — el
// cliente entra, ve una lista vacía y no vuelve. Se publica con --visible el día
// que estén los cinco videos que destraban (CLASES_QUE_DESTRABAN).
//
// ⚠️ ESCRIBE EN LA CUENTA REAL DE WHOP DEL WORKSPACE 1 (Mauricio). El .env.local
// apunta a producción; no hay sandbox configurado.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { PROGRAMA, TOTAL_CLASES, CLASES_QUE_DESTRABAN, type Modulo, type Clase } from '../lib/programa-catalogo';
import {
  whopCuenta, listarExperiencias, crearExperiencia, listarCursos, crearCurso,
  listarCapitulos, crearCapitulo, listarLecciones, crearLeccion, actualizarLeccion,
  type WhopRes,
} from '../lib/whop';
import { runWithWorkspace } from '../lib/workspace';

const APLICAR = process.argv.includes('--aplicar');
const ACTUALIZAR = process.argv.includes('--actualizar');
const VISIBLE = process.argv.includes('--visible');
const WS = 1; // Mauricio. OWNER_WS.

const NOMBRE_EXPERIENCIA = 'Sistema Negocio que Escala';
const NOMBRE_CURSO = 'Sistema Negocio que Escala™';
const BAJADA = 'Dirige tu negocio. No lo cargues.';

/** El cuerpo de la lección, en Markdown. El video se agrega después; lo que va
 *  hoy es la TAREA, que es lo único que hace avanzar el bucle.
 *
 *  ⚠️ ACÁ NO VA NINGÚN LINK, Y NO ES UN OLVIDO. El cuerpo de una lección es el
 *  MISMO para todos los alumnos: Whop no lo personaliza. Un link acá no puede
 *  llevar el token de nadie, así que sería la misma URL para todos — o pide
 *  identificarse (y son empresarios que no manejan la computadora), o abre la
 *  tarea de otro. Las dos están mal.
 *
 *  El link personal lo manda MaKo por WhatsApp o mail cuando toca el bloque, y
 *  es un share de escritura acotado a ESE cliente (`lib/shares.ts` →
 *  `puedeEditar`). Acá solo va el enunciado, que es lo que el alumno necesita
 *  mientras mira el video. */
function cuerpo(modulo: Modulo, clase: Clase): string {
  const partes: string[] = [];
  partes.push(`## Tu tarea de este bloque\n\n${clase.pregunta}`);
  if (clase.atoro) partes.push(`> **Ojo con esto**\n>\n> ${clase.atoro}`);
  if (modulo.quien === 'líder de área') {
    partes.push('**Este bloque lo contesta el líder del área, no el dueño.** Los umbrales los pone quien va a responder por ellos.');
  }
  if (modulo.porArea) {
    partes.push('_Este bloque se repite una vez por cada área de tu negocio. El video es el mismo; la tarea, no._');
  }
  partes.push('---\n\nTe llega un link para contestarla. Dejala contestada **antes** de la sesión: ahí la debatimos y la afinamos, y después te vuelve la versión mejorada para que la apruebes.');
  return partes.join('\n\n');
}

// -- Utilidades ---------------------------------------------------------------

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

function morir(r: WhopRes<unknown>): never {
  console.error(`\n  ✖ ${'error' in r ? r.error : 'error desconocido'}\n`);
  process.exit(1);
}

let creados = 0, saltados = 0, actualizados = 0;
const marca = (hubo: boolean) => { hubo ? creados++ : saltados++; return hubo ? 'CREADA' : 'ya estaba'; };

async function main() {
  const cuenta = await whopCuenta(WS);
  if (!cuenta.ok) morir(cuenta);
  console.log(`\nWhop conectado a: ${cuenta.data.title ?? '(sin nombre)'}  [${cuenta.data.id}]`);
  console.log(`Programa: ${PROGRAMA.length} módulos, ${TOTAL_CLASES} clases.`);
  console.log(APLICAR ? '\n>>> APLICANDO (escribe en Whop)\n' : '\n>>> ENSAYO. Nada se escribe. Agregá --aplicar.\n');

  // 1. La experiencia (el contenedor del app de Cursos dentro del negocio).
  const exps = await listarExperiencias(WS);
  if (!exps.ok) morir(exps);
  let exp = exps.data.find(e => norm(e.name) === norm(NOMBRE_EXPERIENCIA));
  if (!exp) {
    console.log(`experiencia «${NOMBRE_EXPERIENCIA}» → ${APLICAR ? 'creando…' : 'se crearía'}`);
    if (APLICAR) {
      const r = await crearExperiencia(NOMBRE_EXPERIENCIA, WS);
      if (!r.ok) morir(r);
      exp = r.data;
      console.log(`  ✓ ${exp.id}`);
    } else { console.log('  (sin experiencia no se puede seguir en ensayo: se listan los módulos y se corta)'); }
  } else {
    console.log(`experiencia «${exp.name}» → ya estaba  [${exp.id}]`);
  }

  // 2. El curso.
  let curso: { id: string } | undefined;
  if (exp) {
    const cursos = await listarCursos(WS);
    if (!cursos.ok) morir(cursos);
    const hit = cursos.data.find(c => norm(c.title) === norm(NOMBRE_CURSO));
    if (hit) { curso = hit; console.log(`curso «${NOMBRE_CURSO}» → ya estaba  [${hit.id}]`); }
    else if (APLICAR) {
      const r = await crearCurso({ experienceId: exp.id, titulo: NOMBRE_CURSO, bajada: BAJADA, visible: VISIBLE }, WS);
      if (!r.ok) morir(r);
      curso = r.data;
      console.log(`curso «${NOMBRE_CURSO}» → CREADO  [${curso.id}]  visibilidad=${VISIBLE ? 'visible' : 'oculto'}`);
    } else { console.log(`curso «${NOMBRE_CURSO}» → se crearía`); }
  }

  // 3. Capítulos y lecciones.
  for (const modulo of PROGRAMA) {
    const tituloCap = `Módulo ${modulo.numero} · ${modulo.titulo}`;
    let cap: { id: string } | undefined;

    if (curso) {
      const caps = await listarCapitulos(curso.id, WS);
      if (!caps.ok) morir(caps);
      const hit = caps.data.find(c => norm(c.title) === norm(tituloCap));
      if (hit) { cap = hit; console.log(`\n${tituloCap} → ${marca(false)}`); }
      else if (APLICAR) {
        const r = await crearCapitulo(curso.id, tituloCap, WS);
        if (!r.ok) morir(r);
        cap = r.data;
        console.log(`\n${tituloCap} → ${marca(true)}`);
      } else { console.log(`\n${tituloCap} → se crearía`); }
    } else {
      console.log(`\n${tituloCap} → se crearía`);
    }

    const yaHay = cap ? await listarLecciones(cap.id, WS) : null;
    if (yaHay && !yaHay.ok) morir(yaHay);

    for (const [i, clase] of modulo.clases.entries()) {
      const titulo = `${modulo.numero}.${i + 1} · ${clase.titulo}`;
      const destaca = (CLASES_QUE_DESTRABAN as readonly string[]).includes(clase.id) ? '  ⭐' : '';
      const ya = yaHay?.ok ? yaHay.data.find(l => norm(l.title) === norm(titulo)) : undefined;
      const texto = cuerpo(modulo, clase);

      if (ya) {
        // El cargador es idempotente por TÍTULO, así que sin --actualizar una
        // lección creada con el texto equivocado se queda con él para siempre.
        if (ACTUALIZAR && (ya.content ?? '') !== texto) {
          if (!APLICAR) { console.log(`   ${titulo} → se reescribiría${destaca}`); saltados++; continue; }
          const r = await actualizarLeccion(ya.id, { contenido: texto }, WS);
          if (!r.ok) morir(r);
          actualizados++;
          console.log(`   ${titulo} → REESCRITA${destaca}`);
        } else {
          console.log(`   ${titulo} → ${marca(false)}${destaca}`);
        }
        continue;
      }
      if (!APLICAR || !cap) { console.log(`   ${titulo} → se crearía${destaca}`); continue; }

      const r = await crearLeccion({ capituloId: cap.id, titulo, contenido: texto }, WS);
      if (!r.ok) morir(r);
      console.log(`   ${titulo} → ${marca(true)}${destaca}`);
    }
  }

  console.log(`\n${APLICAR ? `Listo. ${creados} creadas, ${saltados} ya estaban.` : 'Ensayo terminado. Nada se escribió.'}`);
  if (APLICAR && !VISIBLE) {
    console.log('El curso quedó OCULTO. Se publica con --visible cuando estén grabados los cinco videos que destraban:');
    console.log(`  ${CLASES_QUE_DESTRABAN.join(', ')}`);
  }
}

runWithWorkspace(WS, main).catch((e) => { console.error(e); process.exit(1); });
