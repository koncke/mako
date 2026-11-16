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
//
// MÁS BAJO, CON EL WHATSAPP (16/11/2026). Martín: «la bottom bar quedó demasiado alta, entonces hay que ver cómo reducir eso» y «en
// la bottom bar y en el tema del contacto, que no solamente esté el email, sino que también esté el WhatsApp de MaKo».
//   · El contacto es un renglón propio, arriba, con el email y el WhatsApp de MaKo (./contacto.ts) a la vista: antes el email iba
//     escondido al final de la columna Legal y no había WhatsApp. En el teléfono queda a la vista aunque las columnas se plieguen.
//   · En la computadora, la marca, su frase y el contacto van en UN renglón (antes eran tres renglones apilados arriba de las
//     columnas) y los links van más juntos. En el teléfono, cada columna es un renglón que se despliega (como el menú de la barra):
//     eran ocho columnas en una grilla de dos, 1.409 px de pie a 390. Nada se fue: los mismos links, en el mismo orden.
//   · El teléfono dibuja su propia versión plegable (`.s-pie-pliegues`) y la computadora la de columnas: un <details> no se puede
//     dejar abierto en la computadora y cerrado en el teléfono sin JavaScript, y esta página no lleva. Las dos salen de la MISMA
//     lista (`columnasDelPie`), así que no pueden decir cosas distintas; la que no corresponde está con `display: none` (fuera del
//     árbol de accesibilidad).
// =============================================================================

import { LogoMaKo } from '../_competencia/marca';
import { EMAIL_MAKO } from '@/lib/app-url';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';
import { columnasDelPie, type ColumnaDelPie, type LinkDelPie } from './datos';
import { GLIFO_WHATSAPP, WHATSAPP_MAKO, linkWhatsappMako } from './contacto';
import { Chevron } from './Piezas';
import { WhatsappFlotante } from './WhatsappFlotante';

/** La línea del © con la razón social, en UN solo nodo de texto (ver abajo). */
export const lineaDelCopyright = (anio: number) => `© ${anio} MaKo · Razón social: ${RAZON_SOCIAL_MAKO}`;

function Links({ links }: { links: readonly LinkDelPie[] }) {
  return <ul>{links.map((l) => <li key={l.href}><a href={l.href} {...(l.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{l.nombre}</a></li>)}</ul>;
}

/** Lo de adentro de una columna: sus links y, si la tiene, su segundo rótulo con los suyos (los Funnels, debajo de Industrias). */
function Cuerpo({ c }: { c: ColumnaDelPie }) {
  return (
    <>
      <Links links={c.links} />
      {c.sub ? (
        <>
          <p className="s-pie-h s-pie-h2">{c.sub.titulo}</p>
          <Links links={c.sub.links} />
        </>
      ) : null}
    </>
  );
}

/** El contacto, a la vista: el email y el WhatsApp de MaKo (que abre el chat con un mensaje ya escrito). */
/** `corto`: sin la palabra «WhatsApp» delante del número (en la columna de Legal, donde el ancho es poco). */
function Contacto({ corto = false, clase }: { corto?: boolean; clase?: string }) {
  return (
    <ul className={clase ? `s-pie-contacto ${clase}` : 's-pie-contacto'} aria-label="Contacto">
      <li>
        <a href={`mailto:${EMAIL_MAKO}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" /><path d="M3 7l9 6l9 -6" /></svg>
          {EMAIL_MAKO}
        </a>
      </li>
      <li>
        <a href={linkWhatsappMako()} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de MaKo: ${WHATSAPP_MAKO.visible}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d={GLIFO_WHATSAPP} /></svg>
          {corto ? WHATSAPP_MAKO.visible : `WhatsApp ${WHATSAPP_MAKO.visible}`}
        </a>
      </li>
    </ul>
  );
}

/** `claro`: el pie de una página que nace clara. El logo va oscuro desde el server: en una página sin el sol y la luna nadie lo da vuelta. */
export function Pie({ claro = false }: { claro?: boolean }) {
  const columnas = columnasDelPie();
  return (
    <footer className="s-pie">
      <div className="s-cont">
        <div className="s-pie-in">
          {/* SIN EL LEMA ARRIBA (Martín, 16/11/2026, ~17:50 UTC: «podríamos eliminar el mejor software para ventas high ticket… y
              que el logo de MaKo esté abajo a la derecha»): el logo va en el renglón del ©, y el contacto, debajo de Legal. */}
          {/* En la computadora, el segundo rótulo de una columna (los Funnels, debajo de Industrias) va en SU columna: era la más
              alta y le daba el alto a todo el pie (Martín, 16/11/2026, a la tarde: «sigo viendo la bottom bar muy alta»). En el
              teléfono sigue adentro de su renglón (abajo): ahí el alto lo dan los renglones, no las columnas. */}
          <div className="s-pie-cols">
            {columnas.flatMap((c, i) => [
              <div key={c.titulo} className="s-pie-col">
                <p className="s-pie-h">{c.titulo}</p>
                <Links links={c.links} />
                {/* El email y el WhatsApp, en el hueco que quedaba debajo de Legal (la última columna). */}
                {i === columnas.length - 1 ? <><p className="s-pie-h s-pie-h-contacto">Contacto</p><Contacto corto /></> : null}
              </div>,
              ...(c.sub ? [
                <div key={c.sub.titulo} className="s-pie-col">
                  <p className="s-pie-h">{c.sub.titulo}</p>
                  <Links links={c.sub.links} />
                </div>,
              ] : []),
            ])}
          </div>
          {/* El teléfono: la misma lista, cada columna en un renglón que se despliega. */}
          <div className="s-pie-pliegues">
            {columnas.map((c) => (
              <details key={c.titulo} className="s-pie-pliegue">
                <summary>{c.titulo}<Chevron /></summary>
                <div className="s-pie-col">
                  <Cuerpo c={c} />
                </div>
              </details>
            ))}
          </div>
          {/* En el teléfono, el contacto a la vista, después de los renglones. */}
          <Contacto clase="s-pie-contacto-tel" />
        </div>
        {/* LA RAZÓN SOCIAL, PEGADA A LO DE ARRIBA (Martín, 15/11/2026: «el tema de la razón social se me hace que quedó como muy
            alejado, hay mucha separación»): el aire que la separaba era de una fila de legales que se fue el 12/11 (los márgenes
            quedaron huérfanos, ver CSS_PIE). Y en UN nodo de texto: con «Razón social: {X}» React mete un comentario entre el rótulo
            y el nombre, y quien busca la frase entera en el HTML no la encuentra (Meta rechazó la verificación del negocio el
            08/10/2026 porque no la veía: lib/titular-mako.ts). */}
        <div className="s-pie-base">
          <p className="s-pie-c">{lineaDelCopyright(new Date().getFullYear())}</p>
          <LogoMaKo className="s-pie-logo" tamano={26} claro={!claro} />
        </div>
      </div>
      {/* El WhatsApp que flota abajo a la derecha (16/11/2026): va donde va el pie, así lo tiene toda página que lo lleva. */}
      <WhatsappFlotante />
    </footer>
  );
}
