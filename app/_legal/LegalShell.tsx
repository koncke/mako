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
import { EMAIL_MAKO } from '@/lib/app-url';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';

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

/**
 * Dos arreglos que NO son cosmética, los dos medidos sobre la página publicada:
 *
 * 1. EL SIDEBAR DE LA APP SE COLABA. Estas rutas cuelgan del layout raíz, así que
 *    el `<aside>` viaja en el HTML **aunque no haya sesión** — verificado con curl
 *    contra producción. O sea que un revisor de Google abría el documento legal
 *    con el chrome de una aplicación alrededor. Se oculta con el mismo truco que
 *    ya usa la landing (`body:has(.vsl-root) aside`), y por la misma razón: es
 *    preferible a tocar layout.tsx para tres rutas.
 *
 * 2. LAS LISTAS NO TENÍAN VIÑETAS. El reset global deja los `<ul>` sin marca, y
 *    en una página legal eso importa más que en otras: las enumeraciones —qué
 *    datos, qué permisos, qué proveedores— son justo lo que alguien viene a
 *    contar, y sin viñetas se leen como un párrafo corrido. Se veía igual en la
 *    página de la extensión desde que se publicó.
 */
const CSS = `
body:has(.legal-root) aside { display: none !important; }
body:has(.legal-root) { background: #fff; }
.legal-root ul { list-style: disc; padding-left: 24px; margin: 10px 0; }
.legal-root li { margin: 6px 0; }
.legal-root a { color: #2F6FED; }
.legal-root code {
  background: #f4f5f7; border-radius: 4px; padding: 1px 5px;
  font-size: 13.5px; font-family: ui-monospace, monospace;
}
`;

/**
 * Las páginas legales, enlazadas entre sí al pie de cada una (5/11/2026). Un revisor de una pasarela (Creem, Stripe,
 * Mercado Pago) o de una tienda llega a UNA y busca las demás: desde cualquiera llega a las otras, con el correo de soporte
 * y la razón social, que tienen que coincidir en todas (lib/app-url.ts, lib/titular-mako.ts). Sin JavaScript: es HTML del
 * server, como el resto de la página.
 *
 * ⚠️ SIN /planes NI /reembolsos, A PROPÓSITO: estas páginas también se abren ADENTRO de la app de iPhone (/privacidad,
 * /terminos, /soporte), y Apple no deja mandar a pagar afuera (lib/tienda.ts, `RUTAS_DE_VENTA`: el proxy las redirige ahí).
 * Los precios y los reembolsos se enlazan desde el pie de la landing (app/vsl/Landing.tsx), que la app no abre.
 */
export const PAGINAS_LEGALES: ReadonlyArray<{ href: string; texto: string }> = [
  { href: '/terminos', texto: 'Términos' },
  { href: '/privacidad', texto: 'Privacidad' },
  { href: '/aup', texto: 'Uso aceptable' },
  { href: '/soporte', texto: 'Soporte' },
];

function PieLegales() {
  return (
    <nav aria-label="Páginas legales" style={{ marginTop: 48, paddingTop: 18, borderTop: '1px solid #e5e7eb', fontSize: 14, color: '#666', display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
      {PAGINAS_LEGALES.map((p) => <a key={p.href} href={p.href}>{p.texto}</a>)}
      <a href={`mailto:${EMAIL_MAKO}`}>{EMAIL_MAKO}</a>
      {/* Un solo nodo de texto, como en el pie de la landing: una búsqueda de la frase entera la encuentra. */}
      <span>{`Razón social: ${RAZON_SOCIAL_MAKO}`}</span>
    </nav>
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
    <div className="legal-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main style={{
        maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px',
        fontFamily: 'system-ui, sans-serif', color: '#1a1a1a', lineHeight: 1.7, fontSize: 15.5,
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px' }}>{titulo}</h1>
        <p style={{ color: '#666', fontSize: 14, margin: 0 }}>Actualizada el {actualizado}</p>
        <p style={{ marginTop: 28 }}>{intro}</p>
        {children}
        <PieLegales />
      </main>
    </div>
  );
}
