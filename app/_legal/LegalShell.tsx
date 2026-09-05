// =============================================================================
// El molde de las páginas legales (privacidad, términos)
// =============================================================================
// Son tres páginas con la misma anatomía y ninguna razón para verse distinto:
// la de la extensión nació sola con sus estilos inline y este shell es donde se
// unifican. Copiar el estilo en la cuarta es cómo se llega a tres páginas
// legales que se contradicen en el tono, que es justo la impresión que una
// página legal no puede dar.
//
// ⚠️ NO usa los tokens del tema (`var(--surface)`, `var(--ink)`): estas páginas
// las abre un revisor de Google o de la Chrome Web Store SIN sesión y a veces
// las imprime a PDF. Colores fijos y tipografía del sistema, para que se vean
// igual en cualquier lado y no dependan de que el tema haya cargado.

import type { ReactNode } from 'react';

/** Un apartado. El `id` deja linkear a una sección puntual desde un mail. */
export function H({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} style={{ fontSize: 19, fontWeight: 650, margin: '32px 0 10px', scrollMarginTop: 24 }}>
      {children}
    </h2>
  );
}

/** Un subapartado, para las listas largas (los subprocesadores, los scopes). */
export function H3({ children }: { children: ReactNode }) {
  return <h3 style={{ fontSize: 15.5, fontWeight: 650, margin: '22px 0 6px' }}>{children}</h3>;
}

/**
 * Una franja para lo que el lector TIENE que ver aunque venga salteando: hoy en
 * día, que no hay borrado automático y que la agenda no se revoca sola. Ámbar y
 * no rojo: no es una advertencia de peligro, es una aclaración que preferiríamos
 * no tener que hacer y que ocultar sería peor.
 */
export function Ojo({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: '#fff8e6', border: '1px solid #f0d9a0', borderRadius: 10, padding: '12px 16px', margin: '14px 0' }}>
      {children}
    </div>
  );
}

export function LegalShell({ titulo, actualizado, intro, children }: {
  titulo: string;
  actualizado: string;
  /** El párrafo de arriba de todo: de qué trata esta página, en una frase. */
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <main style={{
      maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px',
      fontFamily: 'system-ui, sans-serif', color: '#1a1a1a', lineHeight: 1.7, fontSize: 15.5,
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px' }}>{titulo}</h1>
      <p style={{ color: '#666', fontSize: 14, margin: 0 }}>Actualizada el {actualizado}</p>
      <p style={{ marginTop: 28 }}>{intro}</p>
      {children}
    </main>
  );
}
