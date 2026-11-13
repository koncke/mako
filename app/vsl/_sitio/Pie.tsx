// =============================================================================
// El pie del sitio de MaKo: copiado del de https://www.beehiiv.com/ (12/11/2026)
// =============================================================================
// Su estructura: a la izquierda una frase (su «Get beehiiv updates delivered to your inbox.» con el formulario); a la derecha
// las columnas de links (Company, Product, Solutions, Resources, Connect); abajo, después del filete, los links legales, su
// isotipo a la derecha y el ©.
// Lo que cambió: en el lugar de su newsletter va la frase de la portada de MaKo (app/vsl/PortadaSinJs.tsx), sin formulario; sus
// columnas son MaKo, las cuatro familias de la barra de la app con sus funciones, e Industrias; sin redes (MaKo no las lista en
// ningún lado). Los legales son los de la portada sin JavaScript y el © lleva la razón social, como ella. La estrella de MaKo va
// donde va su isotipo. Server component.
// =============================================================================

import { EstrellaMaKo, LogoMaKo } from '../_competencia/marca';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';
import { columnasDelPie } from './datos';

export function Pie() {
  const columnas = columnasDelPie();
  return (
    <footer className="s-pie">
      <div className="s-cont">
        <div className="s-pie-in">
          <div className="s-pie-marca">
            {/* Lo mismo que dice arriba (Martín, 12/11/2026: «sigue el texto viejo… tienes que copiarlo de cómo está arriba hoy»), con
                el logo encima («tienes que poner también el logo otra vez. No puede quedar flotando eso»). */}
            <LogoMaKo className="s-pie-logo" tamano={30} claro />
            <p className="s-pie-lema">El mejor software para negocios High Ticket.</p>
            <p className="s-pie-sub">Ventas, marketing y contenido en una sola app.</p>
          </div>
          <div className="s-pie-cols">
            {columnas.map((c) => (
              <div key={c.titulo} className="s-pie-col">
                <p className="s-pie-h">{c.titulo}</p>
                <ul>{c.links.map((l) => <li key={l.href}><a href={l.href}>{l.nombre}</a></li>)}</ul>
              </div>
            ))}
          </div>
        </div>
        <div className="s-pie-base">
          <div>
            <p className="s-pie-c">© {new Date().getFullYear()} MaKo · Razón social: {RAZON_SOCIAL_MAKO}</p>
          </div>
          <EstrellaMaKo size={32} />
        </div>
      </div>
    </footer>
  );
}
