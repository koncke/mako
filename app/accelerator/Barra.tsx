// =============================================================================
// La barra de arriba de /accelerator y de su aplicación (/accelerator/aplicar) — 16/11/2026
// =============================================================================
// La de la landing de Lovable (el nombre del programa en letras y un botón), con lo que Martín pidió el 16/11: «la top bar…
// más personalizada… me gusta… la que está ahora, pero no hay un botón… para volver a la landing principal o el coso de MaKo
// para volver a la landing principal o ver los otros planes». Así que: la estrella de MaKo con el nombre del programa vuelve a
// la portada («/», como el logo de todo el sitio, `LogoMaKo`), «Ver planes» lleva a /planes, y a la derecha el botón de la
// página (en la landing, «Aplica ahora» al formulario; en el formulario, el que lleva de vuelta al programa).
// Server component, sin JavaScript. Su CSS vive en ./estilo.ts (`.acl-hdr`, `.acl-marca`, `.acl-hdr-*`).
// =============================================================================

import { EstrellaMaKo } from '../vsl/_competencia/marca';
import { PROGRAMA_ACELERADOR } from '@/lib/planes-mako';

export const RUTA_VER_PLANES = '/planes';
export const TEXTO_VER_PLANES = 'Ver planes';

/** El nombre del programa: la primera palabra en blanco y el resto en naranja, como «MARKETING KONCEPT» en la de Lovable. */
export function Marca() {
  const [primera, ...resto] = PROGRAMA_ACELERADOR.nombre.split(' ');
  return <span className="acl-marca">{primera} <span>{resto.join(' ')}</span></span>;
}

/** Adonde lleva la marca: en la landing, la portada de MaKo; en el formulario, la landing del programa. */
export const MARCA_A_LA_PORTADA = { href: '/', aria: 'volver a la página principal' } as const;
export const MARCA_AL_PROGRAMA = { href: '/accelerator', aria: 'volver al programa' } as const;

export function BarraAccelerator({ boton, marca = MARCA_A_LA_PORTADA }: {
  /** El botón de la derecha: en la landing, «Aplica ahora»; en el formulario, la vuelta al programa. Sin botón, sólo los links. */
  boton?: { href: string; texto: string };
  /**
   * Adonde lleva la marca. EN EL FORMULARIO, A LA LANDING (16/11/2026, Martín: «cuando aprieto el botón de MaKo Accelerator [en el
   * formulario], debería llevarme nuevamente a la landing»): ahí la marca dice el programa, y quien la toca quiere volver a él.
   */
  marca?: { href: string; aria: string };
}) {
  return (
    <header className="acl-hdr">
      {/* El nombre que se lee primero es el que se ve (revisión del 16/11/2026): decía «MaKo: volver…» y la marca dice el programa. */}
      <a className="acl-hdr-marca" href={marca.href} aria-label={`${PROGRAMA_ACELERADOR.nombre}: ${marca.aria}`}>
        <span className="acl-estrella" aria-hidden="true"><EstrellaMaKo size={15} /></span>
        <Marca />
      </a>
      <nav className="acl-hdr-der" aria-label={PROGRAMA_ACELERADOR.nombre}>
        <a className="acl-hdr-link" href={RUTA_VER_PLANES}>{TEXTO_VER_PLANES}</a>
        {boton ? <a className="acl-btn acl-btn-sm" href={boton.href}>{boton.texto}</a> : null}
      </nav>
    </header>
  );
}

/**
 * «Ver planes» en el TELÉFONO (revisión del 16/11/2026): en la barra no entra (medido de 320 a 430 en la landing: le sobran 10 a
 * 30 px, y la marca ya va en dos renglones), así que va debajo del «Aplica ahora» del héroe, como un link de texto. En la barra se
 * ve desde 600 px: hasta el 16/11 se escondía hasta 880, y a 768 sobraban 320 px.
 */
export function VerPlanesDelHeroe() {
  return <a className="acl-hero-planes" href={RUTA_VER_PLANES}>{TEXTO_VER_PLANES}</a>;
}

/**
 * El CSS de lo nuevo de la barra (la estrella, el link y el lado derecho). Va DESPUÉS de `CSS_ACELERADOR` (./estilo.ts), que
 * tiene la barra de siempre (`.acl-hdr`, fija y oscura al bajar) y la marca.
 * Debajo de 600 px «Ver planes» se esconde de la barra: con la estrella, el nombre del programa y el botón ya no entra; en la
 * landing va debajo del botón del héroe (`VerPlanesDelHeroe`), y los planes están también en el pie del sitio.
 */
export const CSS_BARRA_ACCELERATOR = `
.acl-hdr-marca { display: inline-flex; align-items: center; gap: 10px; min-width: 0; color: var(--acl-ink); }
.acl-estrella { flex: none; width: 26px; height: 26px; border-radius: 7px; background: rgba(255,255,255,.10); display: inline-flex; align-items: center; justify-content: center; }
.acl-hdr-marca:hover .acl-estrella { background: rgba(255,255,255,.16); }
.acl-hdr-marca:focus-visible, .acl-hdr-link:focus-visible, .acl-hero-planes:focus-visible { outline: 2px solid var(--acl-accent); outline-offset: 4px; border-radius: 4px; }
.acl-hdr-der { display: inline-flex; align-items: center; gap: 22px; flex: none; }
/* Del alto de un dedo (de 600 a 880 px la barra ya la ve una tableta): el texto es el mismo, el área que se toca, 44 px. */
.acl-root .acl-hdr-link { display: inline-flex; align-items: center; min-height: 44px; font-family: var(--acl-sans); font-weight: 600; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; color: var(--acl-ink-soft); }
.acl-root .acl-hdr-link:hover { color: var(--acl-ink); }
.acl-hero-planes { display: none; }
@media (max-width: 599px) {
  .acl-root .acl-hdr-link { display: none; }
  .acl-root .acl-hero-planes { display: flex; align-items: center; justify-content: center; width: fit-content; min-height: 44px; margin: 10px auto 0; padding: 0 10px;
    font-family: var(--acl-sans); font-weight: 600; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; color: var(--acl-ink-soft);
    text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(241,238,232,.35); }
  .acl-root .acl-hero-planes:hover { color: var(--acl-ink); text-decoration-color: var(--acl-accent); }
}
@media (max-width: 420px) {
  .acl-hdr { padding-inline: 16px; gap: 10px; }
  .acl-hdr-marca { gap: 8px; }
  .acl-estrella { width: 24px; height: 24px; }
  .acl-hdr .acl-marca { font-size: 13px; letter-spacing: .1em; }
}
@media (max-width: 359px) {
  .acl-hdr .acl-marca { font-size: 12px; letter-spacing: .06em; }
}
`;
