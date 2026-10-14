'use server';

// =============================================================================
// Server actions de la tab Curso (/customer-success/curso)
// =============================================================================
// Borrar y ordenar las clases de un producto, ver sus videos subidos y cómo se ve el curso. Lo
// que se escribe y cómo se valida vive en lib/curso-admin.ts; acá está la PUERTA. Crear una clase y
// guardar cada parte de la lección van por ./modulos-actions.ts (`crearClaseAction`,
// `guardarCampoClaseAction`).
//
// ⚠️ 08/10/2026 (items 13, 15 y 16 de Martín): se fueron `guardarClaseAction` (el guardado de la
// clase ENTERA, que sólo usaba el editor de la clase que se fue con «Editar»), `marcarGrabarAction`
// («Grabar / No grabar») y las seis de las notas del equipo. Una action sin pantalla sigue siendo un
// POST que cualquiera con sesión puede mandar: lo que nadie usa, no se deja abierto.
//
// ⚠️ CADA ACTION AUTORIZA SOLA, y no por prolijidad: una server action es un POST que se
// puede invocar directo, sin pasar por la página (Next 16,
// node_modules/next/dist/docs/01-app/02-guides/data-security.md). Que el botón sólo se dibuje
// para un admin no protege nada — el guard de la página (`requireCapa`) tampoco corre acá.
//
// ⚠️ Y EDITAR ES DE UN ADMIN DEL WORKSPACE, igual que las etapas de la entrega
// (`guardarEtapasEntregaAction`): el curso es lo que ven TODOS los clientes en su portal, y
// borrar una clase se lleva el avance de cada uno. Mirar la tab alcanza con tenerla.
//
// ⚠️ SÓLO SE EXPORTAN FUNCIONES ASYNC: en un archivo 'use server' un `export const` tipa,
// pasa el typecheck y TIRA EL BUILD (AGENTS.md; guard en tests/campana-producto.test.ts).

import { revalidatePath } from 'next/cache';
import { getUsuarioActual } from '@/lib/auth';
import { puedeVer, puedeEditar, productoPropio } from './puerta-curso';
import { borrarClase, moverClase, urlLectura, renombrarClase, claseEsDelProducto } from '@/lib/curso-admin';
import { guardarAjusteEstilo } from '@/lib/curso-estilo-datos';
import { ajusteValido, type Ajuste } from '@/lib/curso-estilo';
import { anotarVistaAbierta } from './onboarding-sync';

const RUTA = '/customer-success/curso';

// `puedeVer` (mirar la tab), `puedeEditar` (admin del workspace) y `productoPropio` viven en
// ./puerta-curso.ts desde el 08/10/2026: eran privadas acá y estaban copiadas en ./adjuntos-actions.ts.

const fallo = (e: unknown, def: string) => ({ ok: false as const, error: e instanceof Error && e.message ? e.message : def });

/** Borra una clase (y el avance de cada cliente en ella: la pantalla pregunta antes). */
export async function borrarClaseAction(claseId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    const r = await borrarClase(Number(claseId));
    if (!r.ok) return r;
    revalidatePath(RUTA);
    return { ok: true };
  } catch (e) {
    return fallo(e, 'No se pudo borrar.');
  }
}

/**
 * Sube o baja una clase dentro de su etapa. Devuelve el orden que quedó en la base, para que
 * la pantalla corrija si su versión optimista no coincide (otra pestaña movió en el medio).
 *
 * ⚠️ SIN `revalidatePath`, a propósito: la pantalla ya movió la fila en el acto, y releer la
 * página entera (la entrega, los clientes, el avance) por cada flechita pone medio segundo de
 * espera detrás de un gesto que se repite cinco veces seguidas.
 */
export async function moverClaseAction(claseId: number, dir: 'arriba' | 'abajo'): Promise<{ ok: true; ids: number[] } | { ok: false; error: string }> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    return await moverClase(Number(claseId), dir);
  } catch (e) {
    return fallo(e, 'No se pudo mover.');
  }
}

// ⚠️ SIN `urlSubidaVideoAction` NI `descartarVideoAction` desde el 08/10/2026 (item 11 de Martín:
//    «Elimina la opción de "Subir vídeo", solo mediante link»). Eran la puerta de la subida, y una
//    action sin pantalla es un POST abierto (ver la cabecera). Los videos YA subidos se siguen viendo:
//    `urlVerVideoAction`, abajo, y la ruta del portal.

/**
 * Lo que hay en la COMUNIDAD del producto para armar un campo de tarea «Publicar en la comunidad» o
 * «Comentar en la comunidad» (item 17 del 08/10/2026): las categorías donde puede publicar un alumno y
 * los posts (los fijados y los más nuevos). Alcanza con poder editar el curso.
 */
export async function opcionesComunidadAction(productoId: number): Promise<
  { ok: true; categorias: Array<{ id: number; nombre: string }>; posts: Array<{ id: number; titulo: string; fijado: boolean }> } | { ok: false; error: string }
> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    const ajeno = await productoPropio(Number(productoId));
    if (ajeno) return { ok: false, error: ajeno };
    const { opcionesParaTareas } = await import('@/lib/curso-tarea-comunidad');
    return { ok: true, ...(await opcionesParaTareas(Number(productoId))) };
  } catch (e) {
    return fallo(e, 'No pude leer la comunidad.');
  }
}

/**
 * El ensayo del onboarding de la tab: alguien del equipo abrió la vista del alumno. Sólo anota
 * el paso (`curso_vista`): la vista previa no crea accesos ni escribe progreso.
 *
 * ⚠️ DE UN ADMIN, como el resto del onboarding de una tab (`marcarPasoCopyAction`): lo que se
 * anota es que el curso quedó revisado, y eso lo decide quien lo arma.
 */
export async function marcarVistaAlumnoAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    const steps = await anotarVistaAbierta();
    if (!steps?.curso_vista?.done) return { ok: false, error: 'Antes falta tu programa.' };
    revalidatePath(RUTA);
    return { ok: true };
  } catch (e) {
    return fallo(e, 'No se pudo anotar.');
  }
}

/** Un link de vida corta para ver un video subido. Alcanza con poder mirar la tab. */
export async function urlVerVideoAction(path: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const no = await puedeVer();
    if (no) return { ok: false, error: no };
    return await urlLectura(String(path ?? ''));
  } catch (e) {
    return fallo(e, 'No pude abrir el video.');
  }
}

// ── Cómo se ve el curso: color, títulos, portadas y dónde va el texto (mig 0214, 07/10/2026) ──
// «Permite personalizar cosas, como colores (el verde), las portadas, los títulos solo con darle
// click» (Martín). Es de un ADMIN, como editar las clases: lo que se cambia acá lo ve cada alumno.
//
// ⚠️ SIN `revalidatePath`, como `moverClaseAction`: la pantalla aplica el cambio en el acto, y
//    probar tres colores o tres portadas son tres clics — releer la página entera por cada uno
//    pondría medio segundo detrás de cada uno. El portal del alumno es dinámico: lee lo nuevo.


/**
 * Guarda UN ajuste del estilo del curso (`valor: null` = volver al default). Devuelve lo que quedó,
 * que puede no ser lo pedido: un color muy oscuro vuelve aclarado (lib/curso-estilo.ts,
 * `acentoLegible`) y la pantalla tiene que dibujar ESE.
 */
export async function guardarEstiloCursoAction(productoId: number, ajuste: Ajuste, valor: string | null): Promise<
  { ok: true; valor: string | null } | { ok: false; error: string }
> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    const a = ajusteValido(ajuste);
    if (!a) return { ok: false, error: 'Ese ajuste no existe.' };
    const ajeno = await productoPropio(Number(productoId));
    if (ajeno) return { ok: false, error: ajeno };
    // La portada y los comentarios de una clase se atan a una clase de ESE producto: un id ajeno dejaría
    // una fila basura que nadie dibuja (y que nombra una clase de otro curso).
    if ((a.tipo === 'portada-clase' || a.tipo === 'comentarios-clase') && !(await claseEsDelProducto(a.clase, Number(productoId)))) {
      return { ok: false, error: 'Esa clase ya no existe.' };
    }
    const u = await getUsuarioActual();
    const v = await guardarAjusteEstilo(Number(productoId), a, valor, u?.email ?? null);
    return { ok: true, valor: v };
  } catch (e) {
    return fallo(e, 'No se pudo guardar.');
  }
}

/** Cambia SÓLO el título de una clase (el clic en el título de la lección). */
export async function renombrarClaseAction(claseId: number, titulo: string): Promise<{ ok: true; titulo: string } | { ok: false; error: string }> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    return await renombrarClase(Number(claseId), titulo);
  } catch (e) {
    return fallo(e, 'No se pudo renombrar.');
  }
}

// ⚠️ RENOMBRAR UN MÓDULO (y su etapa del kanban, si es vinculado) es `renombrarModuloAction`
// (./modulos-actions.ts) desde el 08/10/2026: `renombrarEtapaCursoAction` sólo sabía de etapas, y un
// módulo suelto no lo es. La lógica —la entrega ESTRICTA y las fases en la misma escritura— vive en
// lib/curso-modulos-datos.ts (`renombrarModulo`).
