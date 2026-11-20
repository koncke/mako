// =============================================================================
// «SIGAMOS EN TU COMPUTADORA», PARA EL RETO EN EL TELÉFONO (20/11/2026, auditoría f24-01 y R57-F5)
// =============================================================================
// Lo acordado: pasado el primer paso del onboarding, el teléfono siempre dice «Sigamos en tu computadora», también al elegir un día
// del reto. El link del correo de cada día (`/second-brain?reto=1`) abierto en el teléfono lo muestra (app/m/second-brain/page.tsx).
// El mismo diseño que la del onboarding (app/onboarding/ChatArranque.tsx, `SeguirEnPc`, con la estrellita de la maqueta), con lo del
// reto. Va aparte a propósito: importar `ChatArranque` desde el Ops Center del teléfono le suma las rutas del onboarding, que llegan a
// una IA (tests/d6b-rutas.test.ts lo frenó el 20/11).
// =============================================================================

import { CriaturaMako } from '@/app/onboarding/CriaturaMako';

export function SeguirEnPcReto({ nombre, email }: { nombre: string; email: string }) {
  const paso = (n: number, t: string, x: string) => (
    <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--ink)', color: 'var(--surface)', fontSize: 13, fontWeight: 700 }}>{n}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><b style={{ fontSize: 'var(--fs-sm)' }}>{t}</b><small style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)', overflowWrap: 'anywhere' }}>{x}</small></span>
    </li>
  );
  return (
    <div role="dialog" aria-modal="true" aria-label="Sigamos en tu computadora" style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'var(--bg)', color: 'var(--ink)', overflow: 'auto', display: 'grid', placeItems: 'center', padding: '24px max(20px, env(safe-area-inset-left, 0px))' }}>
      <div style={{ width: 'min(380px, 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
        <span aria-hidden="true"><CriaturaMako size={64} reaccion="contenta" /></span>
        <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 700 }}>{nombre ? `${nombre}, sigamos` : 'Sigamos'} en tu computadora</h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--dim)' }}>Tu reto de 7 días se hace en una pantalla grande: ahí está el video de cada día y lo que te toca.</p>
        <ol style={{ listStyle: 'none', margin: '6px 0 0', padding: 14, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' }}>
          {paso(1, 'Abre MaKo en tu computadora', 'Con el link del correo de tu día.')}
          {paso(2, 'Entra con tu cuenta', email)}
          {paso(3, 'Tu día te espera', 'Lo que hiciste ya está guardado.')}
        </ol>
      </div>
    </div>
  );
}
