'use client';
// =============================================================================
// «SIGAMOS EN TU COMPUTADORA» (el V2 en el teléfono), EN SU ARCHIVO (20/11/2026, la segunda verificación de R57-F5)
// =============================================================================
// Lo acordado (memoria, onboarding-16-11-decisiones, «20/11, tarde»): el teléfono SIEMPRE dice «Sigamos en tu computadora» en el reto,
// con el MISMO componente del onboarding. Vivía dentro de ./ChatArranque.tsx, y traerlo desde el Ops Center del teléfono sumaba las
// rutas del onboarding, que llegan a una IA (tests/d6b-rutas.test.ts lo frenó el 20/11): por eso el reto tenía una copia aparte. Aquí
// vive solo, con lo único que necesita, y lo usan el onboarding (lo re-exporta ./ChatArranque.tsx), /m/second-brain?reto=1 y el chat
// del reto abierto en un teléfono con «Versión completa» (app/second-brain/reto/ChatDelReto.tsx).
// =============================================================================
import type { ReactNode } from 'react';
import { CriaturaMako } from './CriaturaMako';

const TEXTOS = {
  onboarding: { que: 'Tu onboarding sigue en una pantalla grande: ahí te muestro MaKo por dentro, con tu reto de 7 días.', link: 'Con el link que te mandamos a tu correo.', sigue: 'Sigues justo donde quedaste', guardado: 'Lo que contestaste ya está guardado.' },
  reto: { que: 'Tu reto de 7 días se hace en una pantalla grande: ahí está el video de cada día y lo que te toca.', link: 'Con el link del correo de tu día.', sigue: 'Tu día te espera', guardado: 'Lo que hiciste ya está guardado.' },
} as const;

/** «SIGAMOS EN TU COMPUTADORA» (V2, en el teléfono): lo que sigue del onboarding (el video, el recorrido y el reto) va en una pantalla
 *  grande. Lo contestado ya quedó guardado: al entrar desde la computadora sigue justo donde quedó. */
/**
 * «Sigamos en tu computadora». Con `maqueta` (el V2, 20/11, OA-11 y OD-F3), como la maqueta: la estrellita contenta arriba y, abajo,
 * «Te mandamos el link a {correo}». Sin él, la de siempre.
 */
export function SeguirEnPc({ nombre, email, video = null, maqueta = false, para = 'onboarding' }: { nombre: string; email: string; video?: ReactNode; maqueta?: boolean;
  /** Lo que sigue en la computadora: el onboarding, o el reto de 7 días (sólo cambian esas palabras; R57-F5). */
  para?: 'onboarding' | 'reto' }) {
  const tx = TEXTOS[para];
  const paso = (n: number, t: string, x: string) => (
    <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--ink)', color: 'var(--surface)', fontSize: 13, fontWeight: 700 }}>{n}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><b style={{ fontSize: 'var(--fs-sm)' }}>{t}</b><small style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)', overflowWrap: 'anywhere' }}>{x}</small></span>
    </li>
  );
  return (
    <div role="dialog" aria-modal="true" aria-label="Sigamos en tu computadora" style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'var(--bg)', color: 'var(--ink)', overflow: 'auto', display: 'grid', placeItems: 'center', padding: '24px max(20px, env(safe-area-inset-left, 0px))' }}>
      <div style={{ width: 'min(380px, 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
        {maqueta && <span aria-hidden="true" data-seguir-criatura=""><CriaturaMako size={64} reaccion="contenta" /></span>}
        <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 700 }}>{nombre ? `${nombre}, sigamos` : 'Sigamos'} en tu computadora</h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--dim)' }}>{tx.que}</p>
        {video}
        <ol style={{ listStyle: 'none', margin: '6px 0 0', padding: 14, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' }}>
          {paso(1, 'Abre MaKo en tu computadora', tx.link)}
          {paso(2, 'Entra con tu cuenta', email)}
          {paso(3, tx.sigue, tx.guardado)}
        </ol>
        {/* Con su sobre delante, y «tu correo» si no hay email (20/11, la verificación de OA-11: la maqueta, `.mq-pc__mail`). */}
        {maqueta && (
          <p data-seguir-correo="" style={{ margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', fontSize: 13, color: 'var(--dim)', overflowWrap: 'anywhere' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>
            <span>Te mandamos el link a <b style={{ color: 'var(--ink)' }}>{email || 'tu correo'}</b>.</span>
          </p>
        )}
      </div>
    </div>
  );
}
