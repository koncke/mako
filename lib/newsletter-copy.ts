// =============================================================================
// newsletter-copy — el guion del Copywriter de una edición, armado con lo que ya tiene la edición
// =============================================================================
// Puro, sin server-only (lo usa el test). La lectura al revés —del guion al email— es `edicionDelDoc`
// (./newsletter-reglas.ts).
// =============================================================================

import { NODOS, docDeEstructura, parrafo, textoDeNodo } from './copywriter/doc';
import type { JsonNodo } from './copywriter/tipos';
import type { CopyDeEdicion } from './newsletter-reglas';

/** Las secciones de un email en el Copywriter (las de su plantilla «Email»). */
export const SECCIONES_EMAIL = ['ASUNTO', 'VISTA PREVIA', 'CUERPO', 'BOTON'] as const;

const vacio = (n: JsonNodo | undefined) => !!n && n.type === NODOS.parrafo && !textoDeNodo(n).trim();

/**
 * El documento de una edición: el esqueleto de la plantilla (la «Newsletter» del Copywriter si ya existe, o las
 * secciones del email) con el asunto, la vista previa y el cuerpo que la edición ya tenía, cada uno en el renglón vacío
 * de su sección. Una sección que no está en el esqueleto no se inventa; lo que no tiene dónde ir no se pierde: va al final.
 */
export function docDeEdicion(base: JsonNodo | null, copy: Partial<CopyDeEdicion>): JsonNodo {
  const doc = base?.content?.length ? base : docDeEstructura(SECCIONES_EMAIL);
  const textos: Record<string, string> = {
    ASUNTO: (copy.asunto ?? '').trim(),
    'VISTA PREVIA': (copy.preheader ?? '').trim(),
    CUERPO: (copy.cuerpo ?? '').trim(),
  };
  const usados = new Set<string>();
  const content: JsonNodo[] = [];
  const nodos = doc.content ?? [];
  for (let i = 0; i < nodos.length; i++) {
    const n = nodos[i];
    content.push(n);
    const s = n.type === NODOS.titulo && typeof n.attrs?.seccion === 'string' ? (n.attrs.seccion as string) : null;
    if (!s || !textos[s] || usados.has(s) || !vacio(nodos[i + 1])) continue;
    usados.add(s);
    i += 1; // el renglón vacío se reemplaza
    for (const p of textos[s].split(/\n{2,}/)) if (p.trim()) content.push(parrafo(p.trim()));
  }
  for (const [s, t] of Object.entries(textos)) {
    if (!t || usados.has(s)) continue;
    for (const p of t.split(/\n{2,}/)) if (p.trim()) content.push(parrafo(p.trim()));
  }
  return { ...doc, content };
}
