'use client';

// =============================================================================
// CartelSoloPro — lo que se ve en lugar de algo que es de MaKo Pro, o pasado un tope del plan (14/11/2026)
// =============================================================================
// Martín (14/11/2026): «seas más limitado en el de 47». Dos formas, con UN solo «Pasar a Pro»:
//   · `CartelSoloPro`: la pantalla entera de algo que es de Pro (la comunidad de Classroom, la hoja Closing del Dashboard),
//     con el texto del candado (`textoSoloPro`, lib/topes-plan.ts, o el de Closing, lib/closing-solo-pro.ts) EN LUGAR de los
//     datos. Nada se borra: se deja de mostrar mientras el plan sea Esencial.
//   · `TextoConPasarAPro`: el texto de un tope (`textoTope`) con el link, para el aviso corto (el toast) de quien choca con
//     él al crear (el segundo curso de Classroom).
// El link va a `RUTA_CAMBIAR_PLAN` (la única) adentro de `CtaPasarAPro`, que al cliente de una agencia le dice a quién
// pedírselo. El teléfono no vende (T5, docs/tiendas-play-appstore.md): ahí va el texto sin el link.
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { CtaPasarAPro } from './CtaPasarAPro';
import { esTelefono } from '@/lib/telefono';
import { ROTULO_PASAR_A_PRO } from '@/lib/plan-esencial-reglas';
import { RUTA_CAMBIAR_PLAN } from '@/lib/topes-plan';

/** ¿Se dibuja el link? En el teléfono no (y en el primer dibujo tampoco se sabe: se decide después de montar). */
function useConLink(): boolean {
  const [con, setCon] = useState(true);
  useEffect(() => { if (esTelefono(navigator.userAgent)) setCon(false); }, []);
  return con;
}

const caja: CSSProperties = {
  maxWidth: 520, margin: '48px auto', padding: '28px 24px', textAlign: 'center', borderRadius: 16,
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)',
  display: 'grid', justifyItems: 'center', gap: 14, boxSizing: 'border-box',
};
const boton: CSSProperties = {
  display: 'inline-block', padding: '9px 16px', borderRadius: 10, background: 'var(--ink)', color: 'var(--surface)',
  fontWeight: 650, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap',
};

/** La pantalla de algo que es de MaKo Pro: el candado, el texto y «Pasar a Pro». */
export function CartelSoloPro({ texto }: { texto: string }) {
  const conLink = useConLink();
  return (
    <div role="status" data-cartel-solo-pro style={caja}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: 'var(--dim)' }}>
        <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      </svg>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>{texto}</p>
      {conLink && <CtaPasarAPro><Link href={RUTA_CAMBIAR_PLAN} style={boton}>{ROTULO_PASAR_A_PRO}</Link></CtaPasarAPro>}
    </div>
  );
}

/** El texto de un tope con «Pasar a Pro» al lado, para un aviso corto (el toast oscuro de la pantalla). */
export function TextoConPasarAPro({ texto }: { texto: string }) {
  const conLink = useConLink();
  return (
    <span data-tope-plan>
      {texto}
      {conLink && (
        <>
          {' '}
          <CtaPasarAPro>
            <Link href={RUTA_CAMBIAR_PLAN} style={{ color: 'var(--primary-weak)', fontWeight: 650, textDecoration: 'underline', whiteSpace: 'nowrap' }}>{ROTULO_PASAR_A_PRO}</Link>
          </CtaPasarAPro>
        </>
      )}
    </span>
  );
}
