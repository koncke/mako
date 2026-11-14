// =============================================================================
// copywriter/portada-tema — la portada «De tu tema»: el tema y el idioma de cada outlier (PURO; 13/11/2026)
// =============================================================================
// La maqueta aprobada el 13/11/2026 (el relevo de Copywriting): la portada abre en «De tu tema», con el idioma del negocio primero
// y el inglés después y marcado. Aquí se marca cada outlier (de qué habla, en qué idioma, si es del tema del negocio) y se ordena;
// el filtro es `tema` de `FiltrosCopy` (./outliers.ts). El tema sale de palabras (./tema.ts), sin IA.
// =============================================================================

import type { FormatoCopy, OutlierCopy, PortadaCopy } from './outliers';
import { idiomaDe, temaDeTexto, temaRelacionado, type Tema } from './tema';

/** Con menos que esto del tema del negocio, la portada abre en «Todo» (el chip queda, con su número). */
export const MINIMO_PARA_ABRIR_EN_TEMA = 8;

/**
 * ¿Es del tema del negocio? El mismo tema o un vecino. Uno SIN tema (pocas palabras) cuenta si es de una cuenta que el negocio
 * sigue en Spy (la eligió él, es su nicho); de la biblioteca de la plataforma, no.
 */
export function esDeTuTema(o: Pick<OutlierCopy, 'tema' | 'fuente'>, negocio: Tema): boolean {
  if (o.tema) return temaRelacionado(negocio.id, o.tema);
  return o.fuente === 'spy';
}

/**
 * La portada con el tema y el idioma de cada outlier, y en orden: lo que está en inglés va DESPUÉS de lo demás (sin cambiar el
 * orden de adentro de cada parte). Sin tema del negocio, igual se marca y se ordena por idioma; «De tu tema» no aparece.
 */
export function conTemaYIdioma(p: PortadaCopy, negocio: Tema | null): PortadaCopy {
  const marcados = p.outliers.map((o): OutlierCopy => {
    const texto = `${o.gancho}\n${o.texto}`;
    const tema = temaDeTexto(texto)?.id ?? null;
    const x: OutlierCopy = { ...o, tema, idioma: idiomaDe(texto) };
    return negocio ? { ...x, deTuTema: esDeTuTema(x, negocio) } : x;
  });
  const outliers = [...marcados.filter((o) => o.idioma !== 'en'), ...marcados.filter((o) => o.idioma === 'en')];
  if (!negocio) return { ...p, outliers, tema: null };
  const delTema = outliers.filter((o) => o.deTuTema);
  const porFormato: Partial<Record<FormatoCopy, number>> = {};
  for (const o of delTema) porFormato[o.formato] = (porFormato[o.formato] ?? 0) + 1;
  return { ...p, outliers, tema: { negocio, total: delTema.length, porFormato, abre: delTema.length >= MINIMO_PARA_ABRIR_EN_TEMA } };
}

/** El texto con que se decide el tema de un NEGOCIO: lo que dijo de sí (el onboarding), sus ofertas y sus productos. */
export function textoDelNegocio(p: {
  respuestas?: Readonly<Record<string, string>>;
  ofertas?: readonly { nombre?: string | null; promesa?: string | null; para_quien?: string | null; incluye?: string | null }[];
  productos?: readonly { nombre?: string | null; descripcion?: string | null; promesa?: string | null }[];
}): string {
  const r = p.respuestas ?? {};
  const delOnboarding = ['negocio_que_hace', 'avatar_nicho', 'oferta_nombre', 'oferta_promesa', 'oferta_incluye', 'avatar_quien'].map((k) => r[k] ?? '');
  const deOfertas = (p.ofertas ?? []).flatMap((o) => [o.nombre, o.promesa, o.para_quien, o.incluye]);
  const deProductos = (p.productos ?? []).flatMap((x) => [x.nombre, x.descripcion, x.promesa]);
  return [...delOnboarding, ...deOfertas, ...deProductos].filter((t): t is string => !!t && !!t.trim()).join('\n');
}
