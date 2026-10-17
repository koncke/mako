// =============================================================================
// Un texto con sus links azules y clickeables (17/10/2026)
// =============================================================================
// Martín: «un link pegado en el chat siempre se ve azul y clickeable, en la caja y en los mensajes». Las reglas (qué es
// un link) en lib/links-texto.ts. Lo usan la burbuja de Martín (Hilo.tsx), los chips de la caja y la capa que pinta los
// links adentro de la caja (Conversacion.tsx y ChatsMovil.tsx).
// ⚠️ SIN 'use client' Y SIN HOOKS, como Hilo.tsx: lo dibujan el teléfono y la computadora.

import { linksDe, rotuloDeLink, trozosConLinks } from '@/lib/links-texto';

/** El texto, con cada link como <a> (abre en otra pestaña). */
export function ConLinks({ texto }: { texto: string }) {
  const trozos = trozosConLinks(texto);
  if (!trozos.some((x) => x.tipo === 'link')) return <>{texto}</>;
  return (
    <>
      {trozos.map((x, i) => (x.tipo === 'texto'
        ? <span key={i}>{x.t}</span>
        : <a key={i} className="co-link" href={x.href} target="_blank" rel="noreferrer noopener">{x.t}</a>))}
    </>
  );
}

/**
 * La capa de la caja que pinta lo escrito con los links en azul, DEBAJO del <textarea> (que se vuelve transparente sólo
 * mientras hay un link: sin links la caja es la de siempre). Un <textarea> no puede tener colores; ésta es la manera de
 * todos los editores livianos (highlight-within-textarea).
 */
export function ResalteDeLinks({ texto, capa }: { texto: string; capa: (el: HTMLDivElement | null) => void }) {
  return (
    <div className="co-caja__resalte" ref={capa} aria-hidden>
      {trozosConLinks(texto).map((x, i) => (x.tipo === 'texto' ? <span key={i}>{x.t}</span> : <span key={i} className="co-link">{x.t}</span>))}
      {/* Un renglón vacío al final ocupa su alto, como en el <textarea>. */}
      {'​'}
    </div>
  );
}

/** Los links de lo escrito, como chips para abrirlos sin salir de la caja. */
export function LinksDeLaCaja({ texto }: { texto: string }) {
  const links = linksDe(texto).slice(0, 4);
  if (!links.length) return null;
  return (
    <div className="co-caja__links">
      {links.map((h) => (
        <a key={h} className="co-caja__link" href={h} target="_blank" rel="noreferrer noopener" title={h}>{`↗ ${rotuloDeLink(h)}`}</a>
      ))}
    </div>
  );
}

/** ¿Hay algún link en lo escrito? (la caja pasa a pintarlos). */
export const hayLinks = (texto: string) => linksDe(texto).length > 0;
