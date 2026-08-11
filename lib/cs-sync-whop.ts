// =============================================================================
// cs-sync-whop — el temario a Whop, desde la app
// =============================================================================
// Es el cuerpo de `scripts/cargar-programa-whop.ts`, sacado a una lib para que
// el script y el BOTÓN de la pantalla hagan exactamente lo mismo. Dos copias del
// mismo cargador es cómo se llega a que uno cree lecciones que el otro no
// reconoce (AGENTS.md → «Una cosa, un lugar»).
//
// IDEMPOTENTE POR TÍTULO, y no es un lujo: la API de Whop no tiene «crear si no
// existe» ni borrado en lote. Correrlo dos veces sin comparar dejaría el curso
// con 88 lecciones duplicadas y ninguna forma cómoda de limpiarlas.
//
// EL CURSO NACE OCULTO. Mientras no haya videos, un curso visible con 44
// lecciones de puro texto es peor que no tenerlo: el cliente entra, ve una lista
// vacía y no vuelve.

import 'server-only';
import { PROGRAMA, rotuloDe, type Modulo, type Clase } from './programa-catalogo';
import { camposDe } from './programa-campos';
import {
  listarExperiencias, crearExperiencia, listarCursos, crearCurso,
  listarCapitulos, crearCapitulo, listarLecciones, crearLeccion, actualizarLeccion,
} from './whop';
import { guardarMapaLecciones, type MapaLecciones } from './cs-avance';

const NOMBRE_EXPERIENCIA = 'Sistema Negocio que Escala';
const NOMBRE_CURSO = 'Sistema Negocio que Escala™';
const BAJADA = 'Dirige tu negocio. No lo cargues.';

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** El cuerpo de la lección. ⚠️ SIN LINK: el cuerpo es el mismo para todos los
 *  alumnos —Whop no lo personaliza—, así que un link acá no puede llevar el
 *  token de nadie. El link personal lo emite Mauricio desde Clients. */
function cuerpo(modulo: Modulo, clase: Clase): string {
  const p: string[] = [`## Tu tarea de este bloque\n\n${clase.pregunta}`];
  const campos = camposDe(clase.id);
  if (campos.length) {
    p.push(`**Son ${campos.length} ${campos.length === 1 ? 'pregunta' : 'preguntas'}.**`);
  }
  if (clase.atoro) p.push(`> **Ojo con esto**\n>\n> ${clase.atoro}`);
  if (modulo.quien === 'líder de área') {
    p.push('**Este bloque lo contesta el líder del área, no el dueño.** Los umbrales los pone quien va a responder por ellos.');
  }
  if (modulo.porArea) p.push('_Este bloque se repite una vez por cada área de tu negocio. El video es el mismo; la tarea, no._');
  p.push('---\n\nTe llega un link para contestarla. Dejala contestada **antes** de la sesión: ahí la debatimos y la afinamos, y después te vuelve la versión mejorada para que la apruebes.');
  return p.join('\n\n');
}

export async function sincronizarPrograma(ws: number): Promise<
  { ok: true; creadas: number; reescritas: number; sinCambios: number; mapa: number } | { ok: false; error: string }
> {
  const exps = await listarExperiencias(ws);
  if (!exps.ok) return { ok: false, error: exps.error };
  let exp = exps.data.find(e => norm(e.name) === norm(NOMBRE_EXPERIENCIA));
  if (!exp) {
    const r = await crearExperiencia(NOMBRE_EXPERIENCIA, ws);
    if (!r.ok) return { ok: false, error: r.error };
    exp = r.data;
  }

  const cursos = await listarCursos(ws);
  if (!cursos.ok) return { ok: false, error: cursos.error };
  let curso = cursos.data.find(c => norm(c.title) === norm(NOMBRE_CURSO));
  if (!curso) {
    const r = await crearCurso({ experienceId: exp.id, titulo: NOMBRE_CURSO, bajada: BAJADA, visible: false }, ws);
    if (!r.ok) return { ok: false, error: r.error };
    curso = r.data;
  }

  const mapa: MapaLecciones = {};
  let creadas = 0, reescritas = 0, sinCambios = 0;

  for (const modulo of PROGRAMA) {
    const tituloCap = `Módulo ${modulo.numero} · ${modulo.titulo}`;
    const caps = await listarCapitulos(curso.id, ws);
    if (!caps.ok) return { ok: false, error: caps.error };
    let cap = caps.data.find(c => norm(c.title) === norm(tituloCap));
    if (!cap) {
      const r = await crearCapitulo(curso.id, tituloCap, ws);
      if (!r.ok) return { ok: false, error: r.error };
      cap = r.data;
    }

    const lecs = await listarLecciones(cap.id, ws);
    if (!lecs.ok) return { ok: false, error: lecs.error };

    for (const clase of modulo.clases) {
      // El título sale de `rotuloDe` y no se arma acá: es el MISMO con el que
      // `reconstruirMapa` reconoce la lección. Dos plantillas separadas por un
      // espacio dejarían el mapa vacío sin un solo error.
      const titulo = rotuloDe(clase.id);
      const texto = cuerpo(modulo, clase);
      const ya = lecs.data.find(l => norm(l.title) === norm(titulo));

      if (ya) {
        mapa[ya.id] = clase.id;
        if ((ya.content ?? '') !== texto) {
          const r = await actualizarLeccion(ya.id, { contenido: texto }, ws);
          if (!r.ok) return { ok: false, error: r.error };
          reescritas++;
        } else sinCambios++;
        continue;
      }
      const r = await crearLeccion({ capituloId: cap.id, titulo, contenido: texto }, ws);
      if (!r.ok) return { ok: false, error: r.error };
      mapa[r.data.id] = clase.id;
      creadas++;
    }
  }

  // El mapa se guarda SIEMPRE que haya algo: es lo único que le permite al
  // webhook saber de qué clase habla un `lesn_…` pelado, y un curso ya cargado
  // es justamente el caso donde falta.
  if (Object.keys(mapa).length) await guardarMapaLecciones(mapa);
  return { ok: true, creadas, reescritas, sinCambios, mapa: Object.keys(mapa).length };
}
