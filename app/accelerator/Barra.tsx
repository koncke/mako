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

export function BarraAccelerator({ boton }: {
  /** El botón de la derecha: en la landing, «Aplica ahora»; en el formulario, la vuelta al programa. Sin botón, sólo los links. */
  boton?: { href: string; texto: string };
}) {
  return (
    <header className="acl-hdr">
      <a className="acl-hdr-marca" href="/" aria-label="MaKo: volver a la página principal">
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
 * El CSS de lo nuevo de la barra (la estrella, el link y el lado derecho). Va DESPUÉS de `CSS_ACELERADOR` (./estilo.ts), que
 * tiene la barra de siempre (`.acl-hdr`, fija y oscura al bajar) y la marca.
 * En el teléfono «Ver planes» se esconde: con la estrella, el nombre del programa y el botón ya no entra a 390 px (y los planes
 * están en el pie del sitio, que va en las dos páginas).
 */
export const CSS_BARRA_ACCELERATOR = `
.acl-hdr-marca { display: inline-flex; align-items: center; gap: 10px; min-width: 0; color: var(--acl-ink); }
.acl-estrella { flex: none; width: 26px; height: 26px; border-radius: 7px; background: rgba(255,255,255,.10); display: inline-flex; align-items: center; justify-content: center; }
.acl-hdr-marca:hover .acl-estrella { background: rgba(255,255,255,.16); }
.acl-hdr-marca:focus-visible, .acl-hdr-link:focus-visible { outline: 2px solid var(--acl-accent); outline-offset: 4px; border-radius: 4px; }
.acl-hdr-der { display: inline-flex; align-items: center; gap: 22px; flex: none; }
.acl-root .acl-hdr-link { font-family: var(--acl-sans); font-weight: 600; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; color: var(--acl-ink-soft); }
.acl-root .acl-hdr-link:hover { color: var(--acl-ink); }
@media (max-width: 880px) {
  .acl-hdr-link { display: none; }
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
