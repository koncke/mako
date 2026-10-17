// =============================================================================
// editor-video/espejo — la copia de LECTURA de un proyecto del Video Editor (`video_editor_proyectos`, mig 0299)
// =============================================================================
// Etapa 3 del diseño AI-native (docs/diseno-mako-ai-native.md): las operaciones del chat pasan a la API de MaKo. El
// proyecto vive en el NAVEGADOR de quien lo edita y la API corre en el server, así que el editor sube, un rato después
// de cada cambio, la MISMA vista que lee su chat (chat/linea.ts → vistaDeLinea), con las refs cortas (v1, t2, m1…).
// Lo sube app/video-editor/_opencut/chat/espejo.ts por /api/video-editor/proyectos; lo leen `listar_proyectos_video` y
// `ver_proyecto_video` (lib/api-mako/areas/video.run.ts).
//
// Lo que gobierna, y no se ve en las firmas:
//   · ES UNA COPIA. La fuente es el navegador; nada escribe la línea de tiempo desde la base. Puede ir unos segundos
//     atrás, y lo dice (`actualizado`).
//   · LAS REFS SE ACUMULAN y no se reusan (`unirRefs`): la copia guarda TODAS las que el proyecto usó, y el editor las
//     pasa como `refsPrevias`, así una ref de un elemento borrado no le toca a uno nuevo y «t2» de una propuesta vieja
//     nunca cae sobre otro texto. Las dos mitades unen: el navegador y el server (que no le cree al navegador).
//   · LA VISTA TIENE EL TOPE DEL CHAT (`TOPES_CHAT.vistaMax`): más grande no se sube y queda `demasiado_grande`.
//
// Puro y sin `server-only`: lo leen la ruta, el editor, la API y los tests.
// =============================================================================

import { TOPES_CHAT } from './chat-catalogo';

export const TOPES_ESPEJO = {
  /** Las refs que se recuerdan de un proyecto (las más viejas se caen primero). */
  refs: 4000,
  nombre: 200,
  /** Una duración imposible de un proyecto real, en segundos (24 h). */
  duracionMax: 86_400,
} as const;

/** Lo que sube el editor, saneado. `vista` es el JSON del chat, o null si el proyecto es demasiado grande. */
export type EspejoSubido = {
  proyecto: string;
  nombre: string;
  escenaId: string;
  duracion: number;
  vista: Record<string, unknown> | null;
  refs: Array<[string, string]>;
  demasiadoGrande: boolean;
};

const ID = /^[A-Za-z0-9_-]{1,100}$/;
/** Un id del motor (proyecto, escena, elemento, medio): lo arma el navegador, así que es texto acotado. */
export const idDelMotor = (x: unknown): x is string => typeof x === 'string' && ID.test(x);
const REF = /^[a-z]{1,3}\d{1,5}$/;

/** Los pares [id, ref] válidos, sin repetir id (gana el último), en orden. */
function pares(x: unknown): Array<[string, string]> {
  const porId = new Map<string, string>();
  for (const p of Array.isArray(x) ? x : []) {
    if (Array.isArray(p) && p.length === 2 && idDelMotor(p[0]) && typeof p[1] === 'string' && REF.test(p[1])) {
      porId.delete(p[0]);
      porId.set(p[0], p[1]);
    }
  }
  return [...porId];
}

/**
 * Las refs de antes más las de ahora: un id conserva la suya, y una ref que ya usó un id no se le da a otro. Con más
 * de TOPES_ESPEJO.refs se caen las más viejas.
 */
export function unirRefs(previas: unknown, actuales: unknown): Array<[string, string]> {
  const porId = new Map(pares(previas));
  const usadas = new Map([...porId].map(([id, ref]) => [ref, id] as const));
  for (const [id, ref] of pares(actuales)) {
    if (porId.has(id)) continue; // el id ya tenía la suya
    const duena = usadas.get(ref);
    if (duena && duena !== id) continue; // esa ref es de otro: no se reusa
    porId.set(id, ref);
    usadas.set(ref, id);
  }
  return [...porId].slice(-TOPES_ESPEJO.refs);
}

/** Lo que manda el editor, validado. */
export function espejoValido(b: unknown): { ok: true; espejo: EspejoSubido } | { ok: false; error: string } {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, error: 'Pedido inválido.' };
  const x = b as Record<string, unknown>;
  if (!idDelMotor(x.proyecto)) return { ok: false, error: 'Falta el proyecto.' };
  if (!idDelMotor(x.escenaId)) return { ok: false, error: 'Falta la escena.' };
  const duracion = typeof x.duracion === 'number' && Number.isFinite(x.duracion) ? Math.min(Math.max(0, x.duracion), TOPES_ESPEJO.duracionMax) : 0;
  const nombre = typeof x.nombre === 'string' && x.nombre.trim() ? x.nombre.trim().slice(0, TOPES_ESPEJO.nombre) : 'Proyecto sin título';
  let vista: Record<string, unknown> | null = null;
  let demasiadoGrande = x.demasiadoGrande === true;
  if (typeof x.vista === 'string' && !demasiadoGrande) {
    if (x.vista.length > TOPES_CHAT.vistaMax) demasiadoGrande = true;
    else {
      try {
        const v = JSON.parse(x.vista) as unknown;
        if (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray((v as { pistas?: unknown }).pistas)) vista = v as Record<string, unknown>;
      } catch {
        vista = null;
      }
      if (!vista) return { ok: false, error: 'La vista no es válida.' };
    }
  }
  return { ok: true, espejo: { proyecto: x.proyecto, nombre, escenaId: x.escenaId, duracion, vista, refs: pares(x.refs), demasiadoGrande } };
}

/** Una fila de la copia, como la devuelve la base. */
export type FilaEspejo = {
  proyecto_id: string;
  nombre: string;
  duracion: number | string;
  demasiado_grande: boolean;
  updated_at: string;
  editado_por: string | null;
  vista?: Record<string, unknown> | null;
};

const segundos = (x: number | string): number => Math.round(Number(x) * 10) / 10 || 0;

/** Un proyecto en la lista de la API. */
export function proyectoEnLista(f: FilaEspejo, link: string) {
  return {
    id: f.proyecto_id,
    nombre: f.nombre,
    duracion_segundos: segundos(f.duracion),
    actualizado: f.updated_at,
    ...(f.demasiado_grande ? { demasiado_grande: true } : {}),
    link,
  };
}

/** Minúsculas y sin tildes, para que «Anuncio Octubre» encuentre «anuncio octubre». */
const plano = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * El proyecto que nombra un pedido: por su id o por su NOMBRE (exacto primero; si no, el único que lo contiene).
 * ⚠️ Por nombre a propósito: en un turno de WhatsApp entran pocas herramientas (12 k caracteres) y medido el 16/10, la
 *    acción entra pero `listar_proyectos_video` no; sin esto el modelo no tiene de dónde sacar el id. Si el nombre no
 *    alcanza, el motivo lista los proyectos, que es lo que la lista le habría dado.
 */
export function elegirProyecto(filas: readonly FilaEspejo[], valor: string): { ok: true; fila: FilaEspejo } | { ok: false; motivo: string } {
  const v = valor.trim();
  if (!v) return { ok: false, motivo: 'falta el proyecto (su nombre o su id, de listar_proyectos_video)' };
  const porId = filas.find((f) => f.proyecto_id === v);
  if (porId) return { ok: true, fila: porId };
  const p = plano(v);
  const lista = (fs: readonly FilaEspejo[]) => fs.slice(0, 10).map((f) => `«${f.nombre}» (id ${f.proyecto_id})`).join(', ');
  for (const candidatos of [filas.filter((f) => plano(f.nombre) === p), filas.filter((f) => plano(f.nombre).includes(p))]) {
    if (candidatos.length === 1) return { ok: true, fila: candidatos[0] };
    if (candidatos.length > 1) return { ok: false, motivo: `hay ${candidatos.length} proyectos que se llaman así: ${lista(candidatos)}; va el id` };
  }
  if (!filas.length) return { ok: false, motivo: 'todavía no hay proyectos del editor: aparecen al abrirlos en el editor' };
  return { ok: false, motivo: `no hay un proyecto «${v.slice(0, 60)}». Los proyectos: ${lista(filas)}` };
}

/** El aviso que acompaña a lo que lee la API: es una copia, y para cambiarlo hay que abrirlo donde vive. */
export const NOTA_COPIA =
  'Es la copia que subió el editor mientras se editaba: el proyecto vive en el navegador de quien lo edita, y el link lo abre ahí (en otro navegador el editor no lo tiene).';

/** Un proyecto entero para la API: lo de la lista y su línea de tiempo (la vista del chat). */
export function proyectoEntero(f: FilaEspejo, link: string) {
  return {
    ...proyectoEnLista(f, link),
    ...(f.demasiado_grande
      ? { aviso: 'El proyecto es muy grande para leerlo entero: ábrelo en el editor y pídeselo al chat «Editar con IA» sobre una selección.' }
      : f.vista
        ? { linea_de_tiempo: f.vista }
        : { aviso: 'Todavía no se subió su línea de tiempo: se sube al abrirlo en el editor.' }),
    nota: NOTA_COPIA,
  };
}
