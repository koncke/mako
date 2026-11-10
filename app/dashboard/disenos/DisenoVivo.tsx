'use client';

// =============================================================================
// DisenoVivo — el componente de cada diseño de hoja, con los datos de VERDAD, en UN lugar (6/11/2026)
// =============================================================================
// Hasta el 6/11/2026 esto eran 22 ramas en app/dashboard/EditorInforme.tsx, una por diseño, cada una con sus props. Desde que cada
// tarjeta de un diseño es un BLOQUE de la grilla (./BloqueDeDiseno.tsx, lib/disenos-partes.ts), la misma elección la hacen el
// bloque (una tarjeta) y la hoja que todavía se dibuja entera (un diseño que no tiene sus partes): las dos pasan por acá.
// Los diseños pesados van con next/dynamic: el Dashboard no se lleva los 22 si la hoja no tiene ninguno.
// =============================================================================

import dynamic from 'next/dynamic';
import type { Grafico, Hoja } from '@/lib/graficos-catalogo';
import type { DatosPieza } from '@/lib/closing-diseno';
import { HojaClosing, type ExtrasClosing } from './HojaClosing';
import { HojaCobranza, type ExtrasCobranza } from './HojaCobranza';
import type { ExtrasComercial } from './ComercialVivo';
import type { ExtrasMarketing } from './MarketingVivo';
import type { ExtrasLanding } from './LandingVivo';
import type { ExtrasChat } from './ChatVivo';
import type { ExtrasAutomatizaciones } from './AutomatizacionesVivo';
import type { ExtrasProductividad } from './ProductividadVivo';
import type { ExtrasCs } from './CsVivo';
import type { ExtrasContenido } from './ContenidoVivo';
import type { ExtrasVelocidad } from './VelocidadVivo';

const FocusVivo = dynamic(() => import('./FocusVivo'));
const MiDiaVivo = dynamic(() => import('./MiDiaVivo'));
const GeneralVivo = dynamic(() => import('./GeneralVivo'));
const OperacionVivo = dynamic(() => import('./OperacionVivo'));
const ComercialVivo = dynamic(() => import('./ComercialVivo'));
const MarketingVivo = dynamic(() => import('./MarketingVivo'));
const LandingVivo = dynamic(() => import('./LandingVivo'));
const ChatVivo = dynamic(() => import('./ChatVivo'));
const AutomatizacionesVivo = dynamic(() => import('./AutomatizacionesVivo'));
const ProductividadVivo = dynamic(() => import('./ProductividadVivo'));
const CsVivo = dynamic(() => import('./CsVivo'));
const ContenidoVivo = dynamic(() => import('./ContenidoVivo'));
const CursoVivo = dynamic(() => import('./CursoVivo'));
const ServicioVivo = dynamic(() => import('./ServicioVivo'));
const InstagramVivo = dynamic(() => import('./InstagramVivo'));
const AnuncioVivo = dynamic(() => import('./AnuncioVivo'));
const HooksVivo = dynamic(() => import('./HooksVivo'));
const VslVivo = dynamic(() => import('./VslVivo'));
const InmobiliariaVivo = dynamic(() => import('./InmobiliariaVivo'));
const ColdCallingVivo = dynamic(() => import('./ColdCallingVivo'));
const VelocidadVivo = dynamic(() => import('./VelocidadVivo'));

/** Lo que leen los diseños y ningún componente lee (la agenda, quién mira, las etapas): lo arma la página. */
export type ExtrasDisenos = {
  closing?: ExtrasClosing | null; cobranza?: ExtrasCobranza | null; comercial?: ExtrasComercial | null; marketing?: ExtrasMarketing | null;
  landing?: ExtrasLanding | null; chat?: ExtrasChat | null; automatizaciones?: ExtrasAutomatizaciones | null; cs?: ExtrasCs | null;
  productividad?: ExtrasProductividad | null; contenido?: ExtrasContenido | null; velocidad?: ExtrasVelocidad | null;
};

export type PropsDisenoVivo = {
  /** La hoja con el `diseno` que se dibuja (en un bloque, la hoja con las piezas de ESE bloque). */
  hoja: Hoja;
  datos: Record<string, DatosPieza>;
  hoy: string;
  /** El nombre del período de la hoja («Últimos 30 días»). */
  periodo: string;
  compartido: boolean;
  extras: ExtrasDisenos | null;
  /** ¿Están los datos de General? (los diseños de General sin ellos no se dibujan). */
  conGeneral: boolean;
  /** Una fila de una pieza: abre lo de siempre de esa pieza. */
  onFila?: (g: Grafico, clave: string) => void;
  /** Una llamada de Closing: su pop-up. */
  onLlamada?: (g: Grafico, clave: string) => void;
  /** Después de una acción que cambia los datos (grabar una llamada): la hoja se vuelve a pedir. */
  onCambio?: () => void;
  /** Ver la hoja en su grilla (sólo la hoja entera de antes: un bloque ya está en la grilla). */
  onGrilla?: () => void;
  /** Tocar el período de la tarjeta abre el de la hoja (Marketing, Chat, Landing). */
  onPeriodo?: () => void;
};

/** El diseño de la hoja, con sus datos; null si la hoja no tiene uno (o es de General y no están sus datos). */
export function DisenoVivo({ hoja, datos, hoy, periodo, compartido, extras, conGeneral, onFila, onLlamada, onCambio, onGrilla, onPeriodo }: PropsDisenoVivo) {
  const comunes = { hoja, hoy, compartido, onGrilla };
  switch (hoja.diseno?.id) {
    case 'closing': return <HojaClosing {...comunes} datos={datos} extras={extras?.closing ?? null} periodo={periodo} onLlamada={onLlamada} />;
    case 'cobranza': return <HojaCobranza {...comunes} datos={datos} extras={extras?.cobranza ?? null} periodo={periodo} onFila={onFila} />;
    case 'comercial': return <ComercialVivo {...comunes} datos={datos} extras={extras?.comercial ?? null} periodo={periodo} onFila={onFila} />;
    case 'marketing': return <MarketingVivo {...comunes} datos={datos} extras={extras?.marketing ?? null} periodo={periodo} onPeriodo={onPeriodo} onFila={onFila} />;
    case 'landing': return <LandingVivo {...comunes} datos={datos} extras={extras?.landing ?? null} periodo={periodo} onPeriodo={onPeriodo} onFila={onFila} />;
    case 'chat': return <ChatVivo {...comunes} datos={datos} extras={extras?.chat ?? null} periodo={periodo} onPeriodo={onPeriodo} onFila={onFila} />;
    case 'automatizaciones': return <AutomatizacionesVivo {...comunes} datos={datos} extras={extras?.automatizaciones ?? null} periodo={periodo} onFila={onFila} />;
    case 'cs': return <CsVivo hoja={hoja} datos={datos} extras={extras?.cs ?? null} compartido={compartido} onGrilla={onGrilla} onFila={onFila} />;
    case 'productividad': return <ProductividadVivo {...comunes} datos={datos} extras={extras?.productividad ?? null} onFila={onFila} />;
    case 'contenido': return <ContenidoVivo hoja={hoja} datos={datos} extras={extras?.contenido ?? null} periodo={periodo} compartido={compartido} onGrilla={onGrilla} onFila={onFila} />;
    case 'foco': return conGeneral ? <FocusVivo {...comunes} /> : null;
    case 'mi-dia': return conGeneral ? <MiDiaVivo {...comunes} /> : null;
    case 'general': return conGeneral ? <GeneralVivo {...comunes} datos={datos} /> : null;
    case 'operacion': return conGeneral ? <OperacionVivo {...comunes} datos={datos} /> : null;
    case 'curso': return <CursoVivo {...comunes} datos={datos} periodo={periodo} onFila={onFila} />;
    case 'servicio': return <ServicioVivo {...comunes} datos={datos} onFila={onFila} />;
    case 'instagram': return <InstagramVivo {...comunes} datos={datos} periodo={periodo} onFila={onFila} />;
    case 'anuncio': return <AnuncioVivo {...comunes} datos={datos} periodo={periodo} onFila={onFila} />;
    case 'hooks': return <HooksVivo {...comunes} datos={datos} periodo={periodo} onFila={onFila} />;
    case 'inmobiliaria': return <InmobiliariaVivo {...comunes} datos={datos} periodo={periodo} onFila={onFila} />;
    case 'cold-calling': return <ColdCallingVivo {...comunes} datos={datos} periodo={periodo} onFila={onFila} onCambio={onCambio} />;
    case 'vsl': return <VslVivo {...comunes} datos={datos} periodo={periodo} onFila={onFila} />;
    case 'velocidad': return <VelocidadVivo {...comunes} datos={datos} extras={extras?.velocidad ?? null} periodo={periodo} onFila={onFila} onCambio={onCambio} />;
    default: return null;
  }
}
