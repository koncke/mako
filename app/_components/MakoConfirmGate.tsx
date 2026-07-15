'use client';

// =============================================================================
// MakoConfirmGate — modal bloqueante de confirmaciones del CRM automático
// =============================================================================
// Al entrar al CRM (/leads*), si MaKo hizo cambios automáticos "fuertes", este
// modal NO cerrable los lista y pide confirmar / deshacer / elegir una opción.
// Sale solo cuando resolvés todo. (Fuente: mako_confirmaciones.)

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { listConfirmacionesAction, resolverConfirmacionAction } from '../leads/mako-confirm-actions';
import type { MakoConfirmacion, ConfOpcion } from '@/lib/mako-confirmaciones';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(18,21,27,.62)', backdropFilter: 'blur(3px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto', fontFamily: SANS,
};
const panel: CSSProperties = {
  width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
  boxShadow: '0 30px 80px rgba(18,21,27,.45)', overflow: 'hidden',
  display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 96px)',
};
const btnBase: CSSProperties = { padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, border: '1px solid transparent' };

function ItemCard({ c, busy, bloqueado, error, onResolve }: { c: MakoConfirmacion; busy: boolean; bloqueado: boolean; error: boolean; onResolve: (id: number, decision: string) => void }) {
  const opBtn = (o: ConfOpcion): CSSProperties => o.tone === 'danger'
    ? { ...btnBase, background: 'var(--bad-bg)', color: 'var(--bad)', borderColor: 'var(--bad)' }
    : o.tone === 'primary'
      ? { ...btnBase, background: 'var(--primary)', color: '#fff' }
      : { ...btnBase, background: 'var(--surface)', color: 'var(--dim)', borderColor: 'var(--border-strong)' };
  const off = bloqueado ? 0.5 : 1;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 13, padding: '15px 16px', background: 'var(--surface-2)', opacity: bloqueado && !busy ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', background: 'rgba(47,111,237,.1)', padding: '2px 7px', borderRadius: 6 }}>{c.regla}</span>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{c.titulo}</span>
      </div>
      <div style={{ fontSize: 11.5, color: c.aplicado ? '#B5630A' : 'var(--dim)', fontWeight: 600, marginBottom: 8 }}>
        {c.aplicado ? 'MaKo ya lo aplicó — confirmá o deshacé' : 'MaKo necesita que decidas'}
      </div>
      {c.detalle && <p style={{ fontSize: 13, color: 'var(--dim)', margin: '0 0 10px', lineHeight: 1.5 }}>{c.detalle}</p>}
      {c.cambios.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12, padding: '9px 11px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {c.cambios.map((ch, i) => (
            <div key={i} style={{ fontSize: 12.5, color: 'var(--ink)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--dim)', fontWeight: 600 }}>{ch.campo}:</span>
              {ch.antes != null && <><span style={{ color: 'var(--faint)', textDecoration: 'line-through' }}>{ch.antes}</span><span style={{ color: 'var(--faint)' }}>→</span></>}
              <span style={{ fontWeight: 600 }}>{ch.despues ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {c.aplicado && (
          <button disabled={bloqueado} onClick={() => onResolve(c.id, 'confirmar')} style={{ ...btnBase, background: 'var(--good-bg)', color: 'var(--good)', borderColor: 'var(--good)', opacity: off }}>✓ Confirmar</button>
        )}
        {(c.opciones ?? []).map((o) => (
          <button key={o.key} disabled={bloqueado} onClick={() => onResolve(c.id, `op:${o.key}`)} style={{ ...opBtn(o), opacity: off }}>{o.label}</button>
        ))}
        {c.aplicado && (
          <button disabled={bloqueado} onClick={() => onResolve(c.id, 'rechazar')} style={{ ...btnBase, background: 'transparent', color: 'var(--bad)', borderColor: 'var(--border-strong)', opacity: off }}>↶ Deshacer</button>
        )}
        {busy && <span style={{ fontSize: 12, color: 'var(--dim)' }}>Aplicando…</span>}
        {error && <span style={{ fontSize: 12, color: 'var(--bad)', fontWeight: 600 }}>No se pudo, reintentá</span>}
      </div>
    </div>
  );
}

export function MakoConfirmGate() {
  const pathname = usePathname();
  const router = useRouter();
  const enCrm = pathname?.startsWith('/leads') ?? false;
  const [items, setItems] = useState<MakoConfirmacion[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<number | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (!enCrm) return;
    let vivo = true;
    listConfirmacionesAction()
      .then((r) => { if (vivo) { setItems(r); setCargado(true); } })
      .catch(() => { if (vivo) setCargado(true); });
    return () => { vivo = false; };
  }, [enCrm, pathname]);

  const resolver = useCallback(async (id: number, decision: string) => {
    if (busy !== null) return; // gate global: una resolución a la vez
    setBusy(id);
    setErr((e) => (e === id ? null : e));
    const r = await resolverConfirmacionAction(id, decision).catch(() => ({ ok: false as const }));
    setBusy(null);
    if (r.ok) {
      setItems((xs) => xs.filter((x) => x.id !== id));
      router.refresh();
    } else {
      setErr(id);
    }
  }, [router, busy]);

  if (!enCrm || !cargado || items.length === 0) return null;

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 11, padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, letterSpacing: '-.02em' }}>Mk</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>MaKo movió {items.length} {items.length === 1 ? 'lead' : 'leads'} por vos</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>Revisá los cambios automáticos antes de seguir. Podés confirmarlos o deshacerlos.</div>
          </div>
        </div>
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 22px' }}>
          {items.map((c) => <ItemCard key={c.id} c={c} busy={busy === c.id} bloqueado={busy !== null} error={err === c.id} onResolve={resolver} />)}
        </div>
      </div>
    </div>
  );
}
