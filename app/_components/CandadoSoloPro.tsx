'use client';

// =============================================================================
// CandadoSoloPro — la entrada a algo que es SÓLO de MaKo Pro, con su candado (14/11/2026)
// =============================================================================
// Lo que ve un Esencial en lugar de la entrada (la IA de los editores: el chat de Image y el de Video, la «Edición automática»,
// «Clips mágicos», «B-roll de MaKo» y «Editar» un ejemplo): el candado, `textoSoloPro` («Editar con IA es de MaKo Pro. Pasa a
// Pro para usarlo.») y el botón «Pasar a Pro» a «Tu plan» (`RUTA_CAMBIAR_PLAN`). Como el candado del scraper
// (app/crm/TraerDeGrupoWA.tsx): el texto en gris y el botón lleno, adentro de `CtaPasarAPro` (al cliente de una agencia, a
// quién pedírselo; a la agencia adentro de su cliente, la ficha en el Agency Dashboard).
// El teléfono no vende (T5, docs/tiendas-play-appstore.md; como app/crm/PasarAPro.tsx): ahí va el texto, sin el botón.
// Cuándo se dibuja lo decide ./solo-pro.ts (`useSoloPro`).
// ⚠️ NO ES `CartelSoloPro` (./CartelSoloPro.tsx, el mismo día): ése reemplaza una PANTALLA entera (centrado, 520 px); éste va
//    en el lugar de un botón o de una caja, en paneles de 212 a 340 px. El «Pasar a Pro» es el mismo (`CtaPasarAPro`).
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { SANS } from '@/app/_ui/tokens';
import { CtaPasarAPro } from './CtaPasarAPro';
import { esTelefono } from '@/lib/telefono';
import { ROTULO_PASAR_A_PRO } from '@/lib/plan-esencial-reglas';
import { RUTA_CAMBIAR_PLAN, textoSoloPro, type FuncionSoloPro } from '@/lib/topes-plan';

const caja: CSSProperties = { display: 'grid', gap: 10, justifyItems: 'start', minWidth: 0 };
const texto: CSSProperties = {
  margin: 0, display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: SANS, fontSize: 13, lineHeight: 1.45, color: 'var(--dim)',
};
/** El de «Pasar a Pro» del scraper (app/crm/TraerDeGrupoWA.tsx, `btnPro`). */
const btnPro: CSSProperties = {
  display: 'inline-block', padding: '8px 14px', borderRadius: 10, border: '1px solid var(--primary)', background: 'var(--primary)',
  color: 'var(--on-primary)', fontFamily: SANS, fontSize: 13, fontWeight: 600, textDecoration: 'none',
};

/** El candado de la barra (app/_components/Sidebar.tsx → `Candado`). */
function IconoCandado() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none', marginTop: 2 }}>
      <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function CandadoSoloPro({ funcion, style }: { funcion: FuncionSoloPro; style?: CSSProperties }) {
  // Se decide después de montar (como `CartelSoloPro`, ./CartelSoloPro.tsx): el server no sabe si es un teléfono.
  const [telefono, setTelefono] = useState(false);
  useEffect(() => { setTelefono(esTelefono(navigator.userAgent)); }, []);
  return (
    <div role="status" data-solo-pro={funcion} style={{ ...caja, ...style }}>
      <p style={texto}><IconoCandado /><span>{textoSoloPro(funcion)}</span></p>
      {!telefono && <CtaPasarAPro><Link href={RUTA_CAMBIAR_PLAN} style={btnPro}>{ROTULO_PASAR_A_PRO}</Link></CtaPasarAPro>}
    </div>
  );
}
