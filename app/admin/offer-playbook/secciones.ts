// =============================================================================
// secciones — cómo se reparte docs/offer-marco.md entre las tabs de Offer Playbook
// =============================================================================
// Módulo PURO (sin fs, sin server-only) para que lo pruebe un test: la pantalla
// lee el documento y se lo pasa; acá sólo se corta.
//
// ⚠️ EL DOCUMENTO ES LA FUENTE. Esta tab lo RENDERIZA (como /admin/docs), no lo
// copia: una segunda copia del marco se queda vieja en cuanto alguien edite la
// primera, y el marco va a cambiar —Martín lo abre justamente para revisarlo—.
//
// ⚠️ Y UNA SECCIÓN NUEVA NO PUEDE DESAPARECER EN SILENCIO. Si el documento suma un
// «## 11.» que nadie mapeó, va a la última tab (no se pierde) y el test
// tests/offer-playbook.test.ts falla hasta que alguien decida dónde va.
// =============================================================================

import { ancla } from '@/app/_components/MarkdownDoc';

import type { TabPlaybook } from './tabs';

export { TABS_PLAYBOOK, esTabPlaybook, type TabPlaybook } from './tabs';

/**
 * Qué secciones `## N.` del documento van en cada tab. «autores» no sale del
 * documento: sale de lib/offer-autores.ts. La introducción (lo que está antes
 * del «## 1.») va arriba de «criterio».
 */
export const SECCIONES_DE_TAB: Readonly<Record<Exclude<TabPlaybook, 'autores'>, readonly number[]>> = {
  criterio: [1, 2, 3, 4, 5],
  precio: [6, 7],
  errores: [8],
  discrepancias: [9],
  fuentes: [10],
};

export type Seccion = { numero: number; titulo: string; texto: string };

const RE_SECCION = /^##\s+(\d+)\.\s+(.*)$/;

/**
 * Corta el documento por sus «## N.». Saltea los bloques de código: un «## »
 * adentro de un ``` no es un título (la misma trampa que `sumario` en MarkdownDoc).
 */
export function cortarSecciones(doc: string): { intro: string; secciones: Seccion[] } {
  const lineas = doc.replace(/\r\n/g, '\n').split('\n');
  const intro: string[] = [];
  const secciones: Seccion[] = [];
  let actual: { numero: number; titulo: string; lineas: string[] } | null = null;
  let enCodigo = false;
  for (const l of lineas) {
    if (l.trim().startsWith('```')) enCodigo = !enCodigo;
    const m = enCodigo ? null : l.match(RE_SECCION);
    if (m) {
      if (actual) secciones.push({ numero: actual.numero, titulo: actual.titulo, texto: actual.lineas.join('\n').trim() });
      actual = { numero: Number(m[1]), titulo: m[2].trim(), lineas: [l] };
      continue;
    }
    if (actual) actual.lineas.push(l);
    else intro.push(l);
  }
  if (actual) secciones.push({ numero: actual.numero, titulo: actual.titulo, texto: actual.lineas.join('\n').trim() });
  return { intro: intro.join('\n').trim(), secciones };
}

/** La tab de una sección. Lo que nadie mapeó va a la última (no se pierde). */
export function tabDeSeccion(numero: number): Exclude<TabPlaybook, 'autores'> {
  for (const [tab, nums] of Object.entries(SECCIONES_DE_TAB)) {
    if (nums.includes(numero)) return tab as Exclude<TabPlaybook, 'autores'>;
  }
  return 'fuentes';
}

/** El texto markdown de una tab: sus secciones en orden (y la intro, si es «criterio»). */
export function textoDeTab(doc: string, tab: Exclude<TabPlaybook, 'autores'>): string {
  const { intro, secciones } = cortarSecciones(doc);
  const partes = secciones.filter((s) => tabDeSeccion(s.numero) === tab).map((s) => s.texto);
  return (tab === 'criterio' && intro ? [intro, ...partes] : partes).join('\n\n');
}

/**
 * Dónde vive cada «§N» o «§N.N» del documento: en qué tab y con qué ancla. Lo
 * usan los «lo tomó MaKo» de cada autor para linkear a la regla. El ancla es la
 * misma que le pone MarkdownDoc al título (`ancla(texto del título)`), así que
 * no puede divergir.
 */
export function indiceDeSecciones(doc: string): Map<string, { tab: Exclude<TabPlaybook, 'autores'>; id: string; titulo: string }> {
  const out = new Map<string, { tab: Exclude<TabPlaybook, 'autores'>; id: string; titulo: string }>();
  let enCodigo = false;
  for (const l of doc.replace(/\r\n/g, '\n').split('\n')) {
    const t = l.trim();
    if (t.startsWith('```')) { enCodigo = !enCodigo; continue; }
    if (enCodigo) continue;
    const m = t.match(/^(#{2,4})\s+((\d+)(?:\.(\d+))?\.?\s+.*)$/);
    if (!m) continue;
    const clave = m[4] ? `${m[3]}.${m[4]}` : m[3];
    if (!out.has(clave)) out.set(clave, { tab: tabDeSeccion(Number(m[3])), id: ancla(m[2]), titulo: m[2] });
  }
  return out;
}

/** «§2.10», «2.10», «§ 9» → «2.10» / «9». Null si no es una referencia. */
export function claveDeReferencia(ref: string): string | null {
  const m = ref.match(/§?\s*(\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}
