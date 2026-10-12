// =============================================================================
// Las piezas chicas de la v2: lista agrupada, fila de dato, «En la computadora», avatar,
// ícono, píldora de estado y el pie con la consecuencia
// =============================================================================
// Sin 'use client': no tienen estado, así que se dibujan en el server cuando la página es un
// Server Component (y también adentro de uno de cliente). La anatomía es la del prototipo
// (docs/prototipos/mako-mobile-v2.html) y del documento (docs/diseno-mako-mobile-v2.md,
// «Tarjetas, listas y estados»):
//
//   <ListaM>                                     caja --surface, borde --border, radio --r-lg
//     <FilaM avatar="Camila Rivas" titulo=… />   filete que arranca DESPUÉS del avatar/ícono
//     <FilaDatoM k="Teléfono" v="+52 …" />       clave en gris, valor a la derecha
//   </ListaM>
//   <ComputadoraM que="Pagos, historial y campos" />   UNA fila gris al final de la pantalla
//
// ⚠️ El color de estado va en la MARCA (el punto de la píldora, la flecha), NUNCA en el texto:
// --good y --bad como texto a 13 px no pasan AA (3,45:1 y 4,26:1 sobre blanco, medido).
// =============================================================================

import type { ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { inicialesM } from './formato';

/** La lista agrupada (la pieza base). Adentro: FilaM, FilaDatoM o lo que sea; el filete lo pone cada fila. */
export function ListaM({ children, etiqueta }: { children?: ReactNode; etiqueta?: string }) {
  return <div className="m-lista" role={etiqueta ? 'group' : undefined} aria-label={etiqueta}>{children}</div>;
}

/**
 * Una fila clave → valor (los datos de una ficha, el resumen de Ads). Con `href` u `onClick`
 * abre algo (y lleva chevron); `azul` pinta el valor como un link (la etapa que se cambia).
 * `onClick` sólo desde un componente de cliente.
 */
export function FilaDatoM({ k, v, href, onClick, azul = false }: {
  k: ReactNode;
  v: ReactNode;
  href?: string;
  onClick?: () => void;
  azul?: boolean;
}) {
  const abre = !!(href || onClick);
  const dentro = (
    <>
      <span className="m-fila__txt"><span className="m-dato__k">{k}</span></span>
      <span className={azul ? 'm-dato__v m-dato__v--azul' : 'm-dato__v'}>{v}</span>
      {abre && <span className="m-fila__ir" aria-hidden><Icon name="chevron" size={18} /></span>}
    </>
  );
  const clase = `m-fila m-fila--dato${abre ? ' m-fila--toca' : ''}`;
  return (
    <div className="m-fila-envoltorio">
      {href ? <Link href={href} className={clase}>{dentro}</Link>
        : onClick ? <button type="button" className={clase} onClick={onClick}>{dentro}</button>
        : <div className={clase}>{dentro}</div>}
    </div>
  );
}

/**
 * Lo que la pantalla NO hace en el teléfono: una sola fila gris al final, en su propia caja
 * («Pagos, historial y campos · En la computadora»). Informa, no navega: nunca un botón grande
 * «Abrir en la computadora» repetido en cada pantalla.
 */
export function ComputadoraM({ que }: { que: string }) {
  return (
    <div className="m-lista m-lista--compu">
      <div className="m-fila-envoltorio">
        <div className="m-fila m-fila--compu">
          <span className="m-fila__lead"><IconoM nombre="computadora" /></span>
          <span className="m-fila__txt">
            <span className="m-fila__t m-fila__t--nav">{que}</span>
            <span className="m-fila__c">En la computadora</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * El avatar de iniciales (fondo teñido de azul, letras --primary-strong), como Marca.tsx.
 * sm 34 · md 40 (filas) · lg 52 (la cuenta en More) · xl 88 (la ficha).
 */
export function AvatarM({ nombre, email, tam = 'md' }: { nombre: string | null | undefined; email?: string | null; tam?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return <span className={`m-avatar m-avatar--${tam}`} aria-hidden>{inicialesM(nombre, email)}</span>;
}

/** El ícono de una fila de navegación, en su baldosa de 32 (`app/_components/icons.tsx`). */
export function IconoM({ nombre, azul = false }: { nombre: string; azul?: boolean }) {
  return <span className={azul ? 'm-icono m-icono--azul' : 'm-icono'} aria-hidden><Icon name={nombre} size={18} /></span>;
}

export type TonoPildora = 'neutro' | 'good' | 'warn' | 'bad' | 'info';

/** La píldora de ESTADO: punto de color + texto en tinta --dim sobre --surface-2. */
export function PildoraM({ tono = 'neutro', children }: { tono?: TonoPildora; children: ReactNode }) {
  return <span className="m-pildora" data-tono={tono}><i aria-hidden />{children}</span>;
}

/**
 * La consecuencia pegada arriba del botón, en TINTA, y los botones apilados (el primario
 * grande arriba, la salida como texto debajo). Va en el `pie` de SheetM o adentro de PieFijoM.
 *
 *   <PieM consecuencia="Salen ahora por WhatsApp a 3 personas.">
 *     <Button variant="primary" size="lg" full>Enviar 3 mensajes</Button>
 *     <Button variant="tertiary" size="lg" full>No enviar</Button>
 *   </PieM>
 */
export function PieM({ consecuencia, children }: { consecuencia?: ReactNode; children?: ReactNode }) {
  return (
    <div className="m-pie">
      {consecuencia != null && consecuencia !== '' && <p className="m-pie__consecuencia">{consecuencia}</p>}
      {children}
    </div>
  );
}
