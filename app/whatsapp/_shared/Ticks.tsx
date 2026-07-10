// =============================================================================
// Ticks — estado de entrega de un mensaje saliente (✓ enviado / ✓✓ entregado /
// ✓✓ azul leído / ! falló). Copiado 1:1 del inbox oficial. Deriva SOLO de status.
// =============================================================================

export function Ticks({ status, error }: { status: string | null; error?: string | null }) {
  if (status === 'failed') return <span title={error ?? 'No se entregó'} style={{ color: 'var(--bad)', fontWeight: 700 }}>!</span>;
  const color = status === 'read' ? '#53bdeb' : 'var(--faint)';
  const props = { stroke: color, strokeWidth: 1.4, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (status === 'delivered' || status === 'read') {
    return <svg viewBox="0 0 16 11" width="16" height="11" aria-hidden="true"><path d="M1 6 L4 9 L9.5 2.5" {...props} /><path d="M5.5 6 L8.5 9 L14 2.5" {...props} /></svg>;
  }
  // 'sent' o null → un solo check.
  return <svg viewBox="0 0 13 11" width="13" height="11" aria-hidden="true"><path d="M2 6 L5 9 L11 2.5" {...props} /></svg>;
}
