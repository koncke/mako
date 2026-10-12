// =============================================================================
// Desplegable — el <details> de Offer Playbook, y el cuerpo de una parte del marco
// =============================================================================
// Sin 'use client' y sin JavaScript: abre y cierra el navegador. Lo que llega
// abierto lo decide el server con `?ver=` (un link «§7.1» de un autor abre el
// desplegable de precio en vez de caer en un ancla escondida).
//
// Los estilos viven en playbook.css (`.opb-det`).
// =============================================================================

import type { ReactNode } from 'react';
import { MarkdownDoc } from '@/app/_components/MarkdownDoc';
import { sinCursivas, type Seccion } from './secciones';

export function Desplegable({ id, titulo, meta, abierto = false, className, children }: {
  id?: string;
  /** Un texto, o una cabecera armada (la tarjeta de un autor). */
  titulo: ReactNode;
  meta?: ReactNode;
  abierto?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details id={id} open={abierto || undefined} className={className ? `opb-det ${className}` : 'opb-det'}>
      <summary>
        {typeof titulo === 'string' ? <span className="opb-det__t">{titulo}</span> : titulo}
        {meta != null && <span className="opb-det__meta">{meta}</span>}
      </summary>
      <div className="opb-det__cuerpo">{children}</div>
    </details>
  );
}

/** MarkdownDoc sin las marcas de cursiva que no entiende (ver `sinCursivas`). Todo texto del marco pasa por acá. */
export function Md({ texto }: { texto: string }) {
  return <MarkdownDoc texto={sinCursivas(texto)} />;
}

/**
 * Una o varias secciones del documento, dibujadas con MarkdownDoc. Cada una va en
 * un contenedor con el ancla de su «## N.» (el título ya lo dice el desplegable; con
 * varias, va un subtítulo por sección). La intro, si viene, va primero.
 */
export function CuerpoDeSecciones({ secciones, intro, conTitulos }: {
  secciones: readonly Seccion[];
  intro?: string | null;
  conTitulos: boolean;
}) {
  return (
    <>
      {intro && <Md texto={intro} />}
      {secciones.map((s) => (
        <div key={s.numero} id={s.id} className="opb-ancla">
          {conTitulos && <h3 className="opb-det__sub">{s.numero}. {s.titulo}</h3>}
          <Md texto={s.cuerpo} />
        </div>
      ))}
    </>
  );
}
