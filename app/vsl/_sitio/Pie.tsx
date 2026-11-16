// =============================================================================
// El pie del sitio de MaKo: copiado del de https://www.beehiiv.com/ (12/11/2026)
// =============================================================================
// Su estructura: a la izquierda una frase (su «Get beehiiv updates delivered to your inbox.» con el formulario); a la derecha
// las columnas de links (Company, Product, Solutions, Resources, Connect); abajo, después del filete, los links legales, su
// isotipo a la derecha y el ©.
// Lo que cambió: en el lugar de su newsletter va la frase de la portada de MaKo (app/vsl/PortadaSinJs.tsx), sin formulario; sus
// columnas son MaKo, las cuatro familias de la barra de la app con sus funciones, Industrias (con los Funnels debajo) y Recursos;
// sin redes (MaKo no las lista en ningún lado). Los legales van en su columna y el © lleva la razón social. La estrella de MaKo
// va donde va su isotipo. Server component.
//
// UN PIE PARA TODO EL SITIO (15/11/2026, Martín: «la bottom bar… debería estar en todas las landing, todas las rutas»): fuera de
// la portada y de Comparaciones, lo pone `PieGlobal` (./Barra.tsx).
// =============================================================================

import { EstrellaMaKo, LogoMaKo } from '../_competencia/marca';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';
import { columnasDelPie, type LinkDelPie } from './datos';

/** La línea del © con la razón social, en UN solo nodo de texto (ver abajo). */
export const lineaDelCopyright = (anio: number) => `© ${anio} MaKo · Razón social: ${RAZON_SOCIAL_MAKO}`;

function Links({ links }: { links: readonly LinkDelPie[] }) {
  return <ul>{links.map((l) => <li key={l.href}><a href={l.href} {...(l.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{l.nombre}</a></li>)}</ul>;
}

/** `claro`: el pie de una página que nace clara. El logo va oscuro desde el server: en una página sin el sol y la luna nadie lo da vuelta. */
export function Pie({ claro = false }: { claro?: boolean }) {
  const columnas = columnasDelPie();
  return (
    <footer className="s-pie">
      <div className="s-cont">
        <div className="s-pie-in">
          <div className="s-pie-marca">
            {/* Lo mismo que dice arriba (Martín, 12/11/2026: «sigue el texto viejo… tienes que copiarlo de cómo está arriba hoy»), con
                el logo encima («tienes que poner también el logo otra vez. No puede quedar flotando eso»). */}
            <LogoMaKo className="s-pie-logo" tamano={30} claro={!claro} />
            <p className="s-pie-lema">El mejor software para vender High Ticket.</p>
            <p className="s-pie-sub">Ventas, marketing y contenido en una sola app.</p>
          </div>
          <div className="s-pie-cols">
            {columnas.map((c) => (
              <div key={c.titulo} className="s-pie-col">
                <p className="s-pie-h">{c.titulo}</p>
                <Links links={c.links} />
                {c.sub ? (
                  <>
                    <p className="s-pie-h s-pie-h2">{c.sub.titulo}</p>
                    <Links links={c.sub.links} />
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        {/* LA RAZÓN SOCIAL, PEGADA A LO DE ARRIBA (Martín, 15/11/2026: «el tema de la razón social se me hace que quedó como muy
            alejado, hay mucha separación»): el aire que la separaba era de una fila de legales que se fue el 12/11 (los márgenes
            quedaron huérfanos, ver CSS_PIE). Y en UN nodo de texto: con «Razón social: {X}» React mete un comentario entre el rótulo
            y el nombre, y quien busca la frase entera en el HTML no la encuentra (Meta rechazó la verificación del negocio el
            08/10/2026 porque no la veía: lib/titular-mako.ts). */}
        <div className="s-pie-base">
          <p className="s-pie-c">{lineaDelCopyright(new Date().getFullYear())}</p>
          <EstrellaMaKo size={32} />
        </div>
      </div>
    </footer>
  );
}
