// =============================================================================
// lead-magnets/landing — la landing que crea el Lead Magnet Generator, con lo que ya sabe del lead magnet (PURO)
// =============================================================================
// Las landings nacen del Web Generator, del objetivo de siempre (lib/editor-landing/plantillas.ts: «Lead magnet / descarga»
// para captar una guía, «Clase grabada» para la clase), con DOS cosas que el Lead Magnet Generator sí sabe y la plantilla no:
//   · el NOMBRE: los marcadores «[Nombre de la guía]» / «[Nombre de la clase]» se reemplazan por el del lead magnet;
//   · a DÓNDE va quien se registra: el formulario lleva a la página de gracias (`pagina:<id>`, lo resuelve render.ts) y el
//     botón «Descargar ahora» de esa página, al link público del lead magnet si ya existe.
// Nada más se toca: el resto de los marcadores los completa la persona (o MaKo) en el editor.
// ⚠️ PURO y sin copiar el objeto de afuera: devuelve una copia.
// =============================================================================

import type { LandingContenido } from '../editor-landing/doc';

/** Los marcadores del nombre en las plantillas de captura (los dos objetivos que usa la tab). */
export const MARCADORES_NOMBRE = ['[Nombre de la guía]', '[Nombre de la clase]'] as const;

type Nodo = { type?: unknown; attrs?: Record<string, unknown>; content?: Nodo[]; text?: unknown };

/** Cambia, en la copia, cada string que tenga un marcador del nombre. */
function reemplazarNombre(v: unknown, nombre: string): unknown {
  if (typeof v === 'string') return MARCADORES_NOMBRE.reduce((t, m) => t.split(m).join(nombre), v);
  if (Array.isArray(v)) return v.map((x) => reemplazarNombre(x, nombre));
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = reemplazarNombre(x, nombre);
    return o;
  }
  return v;
}

function* nodos(n: Nodo): Generator<Nodo> {
  yield n;
  for (const h of n.content ?? []) yield* nodos(h);
}

/** ¿Es un link que puede ir en un botón? Sólo http(s): lo demás (un `javascript:`) no se escribe. */
export function enlaceParaBoton(enlace: string | null | undefined): string | null {
  const t = (enlace ?? '').trim();
  if (!t || t.length > 2_000) return null;
  try {
    const u = new URL(t);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password ? u.toString() : null;
  } catch { return null; }
}

/**
 * La landing con el nombre puesto, el formulario llevando a la página de gracias y, si hay link, el botón de esa página
 * apuntando a él. Un formulario que ya tenía a dónde ir no se toca.
 */
export function personalizarLanding(c: LandingContenido, o: { nombre: string; enlace?: string | null }): LandingContenido {
  const nombre = o.nombre.replace(/\s+/g, ' ').trim();
  const copia = (nombre ? reemplazarNombre(c, nombre) : JSON.parse(JSON.stringify(c))) as LandingContenido;
  const gracias = copia.paginas.find((p) => p.ruta === 'gracias');
  const enlace = enlaceParaBoton(o.enlace);
  if (!gracias) return copia;
  for (const pagina of copia.paginas) {
    if (pagina === gracias) continue;
    for (const n of nodos(pagina.doc as Nodo)) {
      if (n.type === 'formulario' && n.attrs && !n.attrs.redirigir) n.attrs.redirigir = `pagina:${gracias.id}`;
    }
  }
  if (enlace) {
    for (const n of nodos(gracias.doc as Nodo)) {
      if (n.type === 'boton' && n.attrs && n.attrs.href === '#') {
        n.attrs.href = enlace;
        n.attrs.nuevaPestana = true;
      }
    }
  }
  return copia;
}
