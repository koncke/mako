'use client';

// =============================================================================
// NotasCard — notas de seguimiento MANUAL del lead (cualquier etapa)
// =============================================================================
// El lugar donde el usuario deja apuntes de lo que hizo a mano con el prospecto
// (mandé WhatsApp, lo llamé, quedó en avisarme…). No depende del status: sirve
// igual en Nutrición Manual, R2, o donde sea. Cada nota queda con fecha y autor
// en el historial del lead (evento 'Nota').

import { useEffect, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { addLeadNoteAction, getLeadNotasAction, type LeadAuditRowFull } from '../actions';
import { useTzWorkspace } from './useTzWorkspace';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const fmtFecha = (iso: string, tz: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).format(d);
};

export function NotasCard({ leadId }: { leadId: number }) {
  const router = useRouter();
  const tz = useTzWorkspace();
  const [notas, setNotas] = useState<LeadAuditRowFull[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    getLeadNotasAction(leadId)
      .then((r) => { if (alive) setNotas(r); })
      .catch(() => {})
      .finally(() => { if (alive) setCargando(false); });
    return () => { alive = false; };
  }, [leadId]);

  const agregar = () => {
    const t = texto.trim();
    if (!t || pending) return;
    setTexto('');
    startTransition(async () => {
      try {
        await addLeadNoteAction(leadId, t);
        const r = await getLeadNotasAction(leadId);
        setNotas(r);
        router.refresh();
      } catch { setTexto(t); }
    });
  };

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Notas</div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ej: Le mandé WhatsApp para retomar; quedó en avisarme la semana que viene."
        style={{ width: '100%', minHeight: 84, resize: 'vertical', padding: '12px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, lineHeight: 1.5, outline: 'none' }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button
          type="button"
          onClick={agregar}
          disabled={!texto.trim() || pending}
          style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: texto.trim() && !pending ? 'var(--primary)' : 'var(--border)', color: texto.trim() && !pending ? '#fff' : 'var(--faint)', fontSize: 14, fontWeight: 700, cursor: texto.trim() && !pending ? 'pointer' : 'default', fontFamily: SANS }}
        >{pending ? 'Guardando…' : 'Agregar nota'}</button>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cargando && <div style={{ fontSize: 13, color: 'var(--faint)' }}>Cargando notas…</div>}
        {!cargando && notas.length === 0 && (
          <div style={{ fontSize: 13.5, color: 'var(--faint)', fontStyle: 'italic', padding: '4px 0' }}>Todavía no hay notas. Escribí la primera arriba.</div>
        )}
        {notas.map((n) => (
          <div key={n.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.valor_nuevo ?? ''}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11.5, color: 'var(--faint)' }}>
              {n.autor_foto && <img src={n.autor_foto} alt="" width={18} height={18} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
              <span style={{ fontWeight: 600, color: 'var(--dim)' }}>{n.autor_nombre}</span>
              <span>·</span>
              <span style={{ fontFamily: MONO }}>{fmtFecha(n.created_at, tz)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
