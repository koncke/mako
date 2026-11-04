// =============================================================================
// LogoRed — el logo de la red de un competidor o de una pieza, el MISMO en toda la tab (4/11/2026)
// =============================================================================
// Pedido de Martín (por el Cerebro, 4/11): los mismos logos de Instagram y YouTube que el buscador, en todos lados
// donde se ve la red de una pieza (las miniaturas del gráfico, su detalle, «¿En qué publica?» y los filtros). Una sola
// pieza: antes vivía adentro del buscador y el resto dibujaba íconos genéricos.
//
// ⚠️ Los logos de marca se dibujan con los <symbol> de <BrandDefs> (app/_components/ServicioVisual.tsx): la pantalla
// que lo usa monta <BrandDefs /> una vez. Sin él, el logo sale vacío.
// =============================================================================

import { Icon } from '../_components/icons';
import { SvcIcon } from '../_components/ServicioVisual';

export type RedConLogo = 'instagram' | 'youtube' | 'tiktok' | 'anuncios' | 'sitio';

const LOGO: Record<Exclude<RedConLogo, 'sitio'>, string> = { instagram: 'red-instagram', youtube: 'youtube', tiktok: 'red-tiktok', anuncios: 'meta' };

/** Decorativo: el nombre de la red va al lado, o en el `aria-label` de quien lo usa. */
export function LogoRed({ red, box = 18 }: { red: RedConLogo; box?: number }) {
  if (red === 'sitio') return <Icon name="web" size={box - 2} />;
  return <SvcIcon k={LOGO[red]} box={box} size={Math.round(box * 0.62)} radius={Math.round(box * 0.28)} />;
}

/** La red de una pieza, para su logo. Su web no tiene logo de marca: es «sitio». */
export const redDePieza = (canal: string): RedConLogo | null =>
  canal === 'instagram' || canal === 'youtube' || canal === 'anuncios' ? canal : canal === 'landing' ? 'sitio' : null;
