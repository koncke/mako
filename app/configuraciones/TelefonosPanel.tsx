'use client';

// =============================================================================
// TelefonosPanel — números del workspace desde los que se contacta a los leads
// =============================================================================
// Una empresa puede tener varios números. Cada uno con su etiqueta, su fuente
// (API WhatsApp / personal) y los setters que lo atienden. El número nuevo arranca
// en "Número personal".
//
// ⛔ «Chatwoot» ya no se ofrece como fuente (la integración se borró el 09/10/2026), pero
// una fila guardada con esa fuente la sigue mostrando, y su editor la conserva entre las
// opciones: un desplegable cuyo valor no está en la lista lo pisa con el primero al tocarlo.

import { useEffect, useState, type CSSProperties } from 'react';
import { Dropdown } from '@/app/components/Dropdown';
import { ConfirmDialog } from '../_components/ChatItemMenu';
import { getTelefonosAction, saveTelefonoAction, deleteTelefonoAction, type WsTelefono, type FuenteTelefono, type TelefonosData } from './telefonos-actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const primaryBtn: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };

/** Las que se pueden ELEGIR. */
const FUENTES: Array<{ value: FuenteTelefono; label: string }> = [
  { value: 'whatsapp_api', label: 'API WhatsApp (no oficial)' },
  { value: 'personal', label: 'Número personal' },
];
/** La que sólo se MUESTRA: filas guardadas antes de que se borrara Chatwoot. */
const FUENTE_RETIRADA = { value: 'chatwoot' as FuenteTelefono, label: 'Chatwoot (retirado)' };
const fuenteLabel = (f: FuenteTelefono) => [...FUENTES, FUENTE_RETIRADA].find((x) => x.value === f)?.label ?? f;
/** Las opciones del editor: las elegibles y, si el número ya la tiene, la retirada. */
const opcionesFuente = (actual: FuenteTelefono) => (actual === FUENTE_RETIRADA.value ? [...FUENTES, FUENTE_RETIRADA] : FUENTES);
const fuenteTone: Record<FuenteTelefono, { bg: string; fg: string }> = {
  chatwoot: { bg: 'var(--good-bg)', fg: 'var(--good)' },
  whatsapp_api: { bg: 'var(--warn-bg)', fg: 'var(--warn)' },
  personal: { bg: 'var(--surface-2)', fg: 'var(--dim)' },
};

type Editable = { id?: number; numero: string; etiqueta: string; fuente: FuenteTelefono; setters: string[] };

export function TelefonosPanel() {
  const [data, setData] = useState<TelefonosData | null>(null);
  const [draft, setDraft] = useState<Editable | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<WsTelefono | null>(null);

  const cargar = () => { getTelefonosAction().then(setData).catch(() => setData({ telefonos: [], equipo: [] })); };
  useEffect(() => { cargar(); }, []);

  const nuevo = () => setDraft({ numero: '', etiqueta: '', fuente: 'personal', setters: [] });
  const editar = (t: WsTelefono) => setDraft({ id: t.id, numero: t.numero, etiqueta: t.etiqueta ?? '', fuente: t.fuente, setters: t.setters });

  const guardar = async () => {
    if (!draft || !draft.numero.trim()) return;
    setBusy(true);
    try {
      await saveTelefonoAction({ id: draft.id ?? null, numero: draft.numero, etiqueta: draft.etiqueta, fuente: draft.fuente, setters: draft.setters });
      setDraft(null);
      cargar();
    } finally { setBusy(false); }
  };

  const borrar = async () => {
    if (!confirmDel) return;
    setBusy(true);
    try { await deleteTelefonoAction(confirmDel.id); setConfirmDel(null); cargar(); } finally { setBusy(false); }
  };

  const toggleSetter = (email: string) => setDraft((d) => d && ({ ...d, setters: d.setters.includes(email) ? d.setters.filter((e) => e !== email) : [...d.setters, email] }));
  const nombreSetter = (email: string) => data?.equipo.find((m) => m.email === email)?.nombre ?? email;

  return (
    <section style={{ marginTop: 4 }}>
      <h2 style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>Teléfonos</h2>
      <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 14px', lineHeight: 1.55, maxWidth: 620 }}>
        Los números desde los que contactas a tus leads. Asigna los setters que atienden cada línea.
      </p>

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.telefonos.length === 0 && !draft && (
            <div style={{ ...card, color: 'var(--faint)', fontSize: 14 }}>Todavía no cargaste ningún número.</div>
          )}

          {data.telefonos.map((t) => (
            <div key={t.id} style={{ ...card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{t.numero}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, fontFamily: MONO, background: fuenteTone[t.fuente].bg, color: fuenteTone[t.fuente].fg }}>{fuenteLabel(t.fuente)}</span>
                </div>
                {t.etiqueta && <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 3 }}>{t.etiqueta}</div>}
                <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 5 }}>
                  {t.setters.length ? `Setters: ${t.setters.map(nombreSetter).join(', ')}` : 'Sin setters asignados'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button style={ghostBtn} onClick={() => editar(t)}>Editar</button>
                <button style={{ ...ghostBtn, color: 'var(--bad)', borderColor: '#EBBFBC' }} onClick={() => setConfirmDel(t)}>Borrar</button>
              </div>
            </div>
          ))}

          {draft ? (
            <div style={{ ...card, borderColor: 'var(--primary)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 5 }}>Número</span>
                  <input style={input} value={draft.numero} onChange={(e) => setDraft({ ...draft, numero: e.target.value })} placeholder="+52 686 399 6369" autoFocus />
                </label>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 5 }}>Etiqueta (opcional)</span>
                  <input style={input} value={draft.etiqueta} onChange={(e) => setDraft({ ...draft, etiqueta: e.target.value })} placeholder="Ej: Línea de Ana" />
                </label>
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 5 }}>Fuente</span>
                  <Dropdown
                    value={draft.fuente}
                    ariaLabel="Fuente del número"
                    width="100%"
                    onChange={(v) => { if (v) setDraft({ ...draft, fuente: v as FuenteTelefono }); }}
                    columns={[[{ title: 'Cómo está conectado', options: opcionesFuente(draft.fuente).map((f) => ({ value: f.value, label: f.label })) }]]}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 7 }}>Setters que atienden esta línea</span>
                {data.equipo.length === 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--faint)' }}>No hay setters en el equipo todavía.</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {data.equipo.map((m) => {
                      const on = draft.setters.includes(m.email);
                      return (
                        <button key={m.email} type="button" onClick={() => toggleSetter(m.email)} style={{ padding: '6px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: SANS, cursor: 'pointer', background: on ? 'var(--ink)' : 'var(--surface)', border: '1px solid ' + (on ? 'var(--ink)' : 'var(--border-strong)'), color: on ? '#F3F5F8' : 'var(--dim)' }}>{m.nombre}</button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button style={ghostBtn} onClick={() => setDraft(null)}>Cancelar</button>
                <button style={{ ...primaryBtn, opacity: !draft.numero.trim() || busy ? 0.5 : 1 }} disabled={!draft.numero.trim() || busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar número'}</button>
              </div>
            </div>
          ) : (
            <div>
              <button style={primaryBtn} onClick={nuevo}>+ Agregar número</button>
            </div>
          )}
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          titulo="¿Borrar número?"
          detalle={`Se elimina ${confirmDel.numero}${confirmDel.etiqueta ? ` (${confirmDel.etiqueta})` : ''} y sus asignaciones.`}
          confirmLabel="Borrar"
          danger
          onCancel={() => setConfirmDel(null)}
          onConfirm={borrar}
        />
      )}
    </section>
  );
}
