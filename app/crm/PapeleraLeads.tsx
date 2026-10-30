'use client';

// =============================================================================
// PapeleraLeads — los leads que se eliminaron, para recuperarlos (mig 0340, 28/10/2026)
// =============================================================================
// «Eliminar» manda a la papelera (lib/leads-papelera.ts): el lead sale del CRM y su foto queda 30 días. Ésta es la puerta de
// vuelta, en el menú de funnels al lado de «CRM eliminados» (la misma idea: una copia que nadie puede ver no es una copia).
// Recuperar lo devuelve IGUAL: sus mismos ids, sus pagos, sus funnels, sus etiquetas, sus mensajes. Va de a tandas con su
// avance (app/crm/lote-tandas.ts), como todo lote que se escribe lead por lead.
//
// ⚠️ ACÁ NO HAY «BORRAR PARA SIEMPRE». Lo hace la purga a los 30 días (/api/cron/leads-papelera): el único botón irreversible
// de esta pantalla sería el que se toca por error, y la papelera existe justo para ese error.

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { SANS, MONO } from '@/app/_ui';
import { papeleraDeLeadsAction, recuperarLeadsAction } from './actions';
import { TANDA_LOTE, colaDelAviso, correrEnTandas } from './lote-tandas';
import { diasQuedan, textoQuedan } from '@/lib/leads-papelera-reglas';
import { coincideBusqueda } from '@/lib/buscar-texto';
import type { FilaPapelera } from '@/lib/leads-papelera';

/** De a cuántas filas se dibuja la lista: una papelera de 394 no se pinta de una. */
const DE_A = 100;

/** Avisa al renglón «Papelera» del menú que cambió cuántos hay (se borró o se recuperó). */
export const EVENTO_PAPELERA = 'mako:papelera';
export const avisarPapelera = () => { try { window.dispatchEvent(new Event(EVENTO_PAPELERA)); } catch { /* sin ventana */ } };

export function PapeleraLeadsModal({ funnels, onCerrar, onRecuperados }: {
  funnels: { id: number; nombre: string; esDefault: boolean }[];
  onCerrar: () => void;
  /** Volvió alguno: el tablero de atrás tiene que releer. */
  onRecuperados: () => void;
}) {
  const [filas, setFilas] = useState<FilaPapelera[] | null>(null);
  const [falta, setFalta] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [cuantas, setCuantas] = useState(DE_A);
  const [avance, setAvance] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void papeleraDeLeadsAction()
      .then((r) => { if (vivo) { setFilas(r.filas); setFalta(r.falta); } })
      .catch((e: unknown) => { if (vivo) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, []);

  const nombreFunnel = (id: number | null) => (id == null ? funnels.find((f) => f.esDefault) : funnels.find((f) => f.id === id))?.nombre ?? null;
  const ahora = Date.now();
  const visibles = useMemo(
    () => (filas ?? []).filter((f) => !q.trim() || coincideBusqueda([f.lead_id, f.nombre, f.telefono, f.email], q)),
    [filas, q],
  );
  const todosSel = visibles.length > 0 && visibles.every((f) => sel.has(f.lead_id));
  const alternarTodos = () => setSel((p) => {
    const n = new Set(p);
    if (todosSel) for (const f of visibles) n.delete(f.lead_id); else for (const f of visibles) n.add(f.lead_id);
    return n;
  });
  const alternar = (id: number) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const recuperar = async () => {
    const ids = [...sel];
    if (!ids.length || avance) return;
    setErr(null); setAviso(null);
    const t = await correrEnTandas(ids, TANDA_LOTE, (tanda) => recuperarLeadsAction(tanda), (k) => setAvance(`Recuperando ${k} de ${ids.length}…`));
    setAvance(null);
    const vueltos = new Set<number>();
    const fallaron = t.resultados.reduce((s, r) => s + r.fallaron, 0);
    const motivos = new Set(t.resultados.map((r) => r.motivo).filter((m): m is string => !!m));
    // Los que volvieron son los que ya no están en la papelera: se relee, que es lo único que no adivina.
    const r = await papeleraDeLeadsAction().catch(() => null);
    if (r) {
      const quedan = new Set(r.filas.map((f) => f.lead_id));
      for (const id of ids) if (!quedan.has(id)) vueltos.add(id);
      setFilas(r.filas);
    }
    setSel(new Set([...sel].filter((id) => !vueltos.has(id))));
    const mal = fallaron ? ` · ${fallaron} no ${fallaron === 1 ? 'volvió' : 'volvieron'}${motivos.size ? ` (${[...motivos].join(' · ')})` : ''}` : '';
    setAviso(`${vueltos.size} ${vueltos.size === 1 ? 'recuperado' : 'recuperados'}${mal}${colaDelAviso(t, ['recuperó', 'recuperaron'])}`);
    if (vueltos.size) { avisarPapelera(); onRecuperados(); }
  };

  const n = sel.size;
  return (
    <Modal
      titulo="Papelera"
      ancho={600}
      onCerrar={onCerrar}
      pie={(
        <>
          {avance && <span role="status" style={{ marginRight: 'auto', fontFamily: SANS, fontSize: 13, color: 'var(--dim)' }}>{avance}</span>}
          <button type="button" onClick={onCerrar} disabled={!!avance}
            style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
            Cerrar
          </button>
          <button type="button" onClick={() => void recuperar()} disabled={!n || !!avance} data-recuperar-papelera
            style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: n && !avance ? 'pointer' : 'default', opacity: n && !avance ? 1 : 0.5, fontFamily: SANS }}>
            {n ? `Recuperar ${n}` : 'Recuperar'}
          </button>
        </>
      )}
    >
      <p style={{ fontSize: 13, color: 'var(--dim)', margin: '0 0 12px', fontFamily: SANS }}>
        Lo que eliminaste vuelve tal cual, con su historial y sus pagos. A los 30 días se borra para siempre.
      </p>
      {falta && <p style={{ fontSize: 13.5, color: 'var(--bad)', margin: 0 }}>La papelera todavía no está lista en tu cuenta.</p>}
      {filas === null && !err && <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0 }}>Cargando…</p>}
      {filas?.length === 0 && !falta && <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0 }}>La papelera está vacía.</p>}
      {!!filas?.length && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <input type="checkbox" checked={todosSel} onChange={alternarTodos} aria-label={`Elegir los ${visibles.length}`}
            style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar entre ${filas.length}`}
            style={{ flex: 1, minWidth: 0, height: 34, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13 }} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visibles.slice(0, cuantas).map((f) => {
          const dias = diasQuedan(f.purgar_at, ahora);
          const de = [nombreFunnel(f.funnel_id), f.etapa].filter(Boolean).join(' · ');
          return (
            <label key={f.lead_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={sel.has(f.lead_id)} onChange={() => alternar(f.lead_id)}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)', flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.nombre?.trim() || f.telefono || f.email || `Lead ${f.lead_id}`}
                </span>
                <span style={{ fontFamily: SANS, fontSize: 12, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {[de, f.por ? `lo eliminó ${f.por}` : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: dias <= 3 ? 'var(--bad)' : 'var(--dim)' }}>{textoQuedan(dias)}</span>
            </label>
          );
        })}
      </div>
      {visibles.length > cuantas && (
        <button type="button" onClick={() => setCuantas((c) => c + DE_A)}
          style={{ marginTop: 10, background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Ver {Math.min(DE_A, visibles.length - cuantas)} más · quedan {visibles.length - cuantas}
        </button>
      )}
      {aviso && <div role="status" style={{ marginTop: 12, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--ink)' }}>{aviso}</div>}
      {err && <div style={{ marginTop: 12, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>}
    </Modal>
  );
}
