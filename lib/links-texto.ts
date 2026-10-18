// =============================================================================
// Los links de un texto, siempre azules y clickeables (17/10/2026; puro, con test)
// =============================================================================
// Martín: «un link pegado en el chat siempre se ve azul y clickeable, en la caja y en los mensajes». Lo usan la caja y el
// hilo del Ops Center (app/admin/operaciones/ConLinks.tsx) y el Markdown de la casa cuando se lo piden (`enlaces`).
// ⚠️ SIN `server-only` y sin React: es texto.

// ── Los links, siempre azules y clickeables (17/10/2026) ─────────────────────────────────────────────────────────
// Martín: «un link pegado en el chat siempre se ve azul y clickeable, en la caja y en los mensajes». Se reconocen las
// direcciones http(s) sueltas y los links de Markdown `[texto](https://…)`. Sólo http y https: nada de `javascript:` ni
// de otros esquemas. El punto, la coma o el paréntesis del final no son parte del link (es como se escribe una frase).

export type TrozoConLink = { tipo: 'texto'; t: string } | { tipo: 'link'; t: string; href: string };

const LINK_RE = /\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]{1,2000})\)|(https?:\/\/[^\s<>"'«»]{1,2000})/gi;

/** El texto partido en lo que es link y lo que no, para dibujarlo. */
export function trozosConLinks(texto: string): TrozoConLink[] {
  const out: TrozoConLink[] = [];
  let desde = 0;
  for (const m of texto.matchAll(LINK_RE)) {
    const i = m.index ?? 0;
    let crudo = m[0];
    let href = m[2] ?? m[3] ?? '';
    let visible = m[1] ?? href;
    if (!m[2]) {
      // Lo que cierra la frase no es del link: «mirá https://x.com/a.» → el punto queda afuera. Un paréntesis sólo si no
      // abrió adentro del link (https://es.wikipedia.org/wiki/Foo_(bar) lo lleva).
      // ⚠️ En un bucle: «(ver https://x.com/a).» cierra con «).» y un solo corte dejaba el «)» pegado al link (17/10/2026).
      let h = href;
      for (;;) {
        const c = h.slice(-1);
        if (/[.,;:!?]/.test(c) || (c === ')' && !h.includes('('))) h = h.slice(0, -1); else break;
      }
      if (h !== href) { href = h; crudo = h; visible = h; }
    }
    if (i > desde) out.push({ tipo: 'texto', t: texto.slice(desde, i) });
    out.push({ tipo: 'link', t: visible, href });
    desde = i + crudo.length;
  }
  if (desde < texto.length) out.push({ tipo: 'texto', t: texto.slice(desde) });
  return out;
}

/** Los links de un texto (para los chips clickeables de la caja), sin repetir. */
export const linksDe = (texto: string): string[] =>
  [...new Set(trozosConLinks(texto).flatMap((x) => (x.tipo === 'link' ? [x.href] : [])))];

/** Cómo se muestra un link en un chip: sin el esquema ni el «www.», y corto. */
export function rotuloDeLink(href: string, tope = 40): string {
  const t = href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  return t.length > tope ? `${t.slice(0, tope - 1)}…` : t;
}
