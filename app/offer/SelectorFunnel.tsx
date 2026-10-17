'use client';

// =============================================================================
// SelectorFunnel — el desplegable en ÁRBOL donde antes estaba el título «Offer»
// =============================================================================
// Pedido de Martín (11/10/2026): en el lugar del título se elige el funnel y desde ahí se crea o
// se analiza una oferta; el botón de «Ofertas anteriores» se va (las conversaciones viven adentro
// de cada oferta). El árbol es el `Dropdown` de la casa con `secciones` + `grupos` (el molde del
// disparador por etapa de /automations); su DATO lo arma ./arbol.ts, puro.
//
// El botón dice el CAMINO de lo que está abierto («Funnel › Oferta»), con `variante="principal"`:
// ocupa el lugar del título y tiene que leerse como lo que manda en la pantalla. Abre PARADO en la
// conversación abierta (el Dropdown baja solo por `caminoDe`).
//
// ⚠️ Elegir NO cambia el `value` acá: lo cambia la pantalla cuando el servidor contesta (abrir una
// conversación o crear una nueva puede fallar, y un botón que ya dice lo nuevo sobre una pantalla que
// sigue mostrando lo viejo es la contradicción que esta casa no deja dibujar).

import { Dropdown } from '@/app/components/Dropdown';
import { Icon } from '@/app/_components/icons';
import { IconoFunnel } from '@/app/_ui/iconos-menu';
import type { ArbolOffer, OfferSesionVista } from '@/lib/offer-marco';
import { arbolVacio, caminoDeSesion, seccionesDelArbol, valorSesion, type IconosArbol } from './arbol';

const ICONOS: IconosArbol = {
  funnel: <IconoFunnel size={18} />,
  oferta: <Icon name="tag" size={18} />,
  conversacion: <Icon name="chats" size={18} />,
  sueltas: 'archivo',
};

export function SelectorFunnel({ arbol, sesion, ocupado, onElegir }: {
  arbol: ArbolOffer;
  /** La conversación abierta (null = todavía no se eligió nada). */
  sesion: OfferSesionVista | null;
  /** Abriendo o creando una conversación, o armando la oferta: no se cambia de lugar a mitad. */
  ocupado: boolean;
  onElegir: (valor: string) => void;
}) {
  const vacio = arbolVacio(arbol);
  const camino = sesion ? caminoDeSesion(sesion) : null;
  return (
    <div style={{ width: '100%', maxWidth: 560, minWidth: 0 }}>
      <Dropdown
        value={sesion ? valorSesion(sesion.id) : ''}
        secciones={seccionesDelArbol(arbol, ICONOS)}
        onChange={onElegir}
        variante="principal"
        width="100%"
        menuAncho={400}
        menuAlto={460}
        ariaLabel="Funnel y oferta"
        disabled={ocupado || vacio}
        icono={<IconoFunnel size={20} />}
        botonLabel={camino
          ? (
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, minWidth: 0, maxWidth: '100%' }}>
              <span style={{ flex: 'none', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{camino.funnel}</span>
              <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontWeight: 500 }}>›</span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--dim)', fontWeight: 600 }}>{camino.oferta}</span>
            </span>
          )
          : 'Elige un funnel'}
      />
    </div>
  );
}
