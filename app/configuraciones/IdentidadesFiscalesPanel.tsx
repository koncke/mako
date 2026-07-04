'use client';

// =============================================================================
// IdentidadesFiscalesPanel — CRUD de las identidades fiscales del workspace
// =============================================================================
// Se cargan una sola vez acá y después se eligen como "Facturado por" en la tab
// Deal Details de cada lead. Puede haber varias; una puede ser la default.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ConfirmDialog } from '../_components/ChatItemMenu';
import {
  getIdentidadesFiscalesAction,
  saveIdentidadFiscalAction,
  deleteIdentidadFiscalAction,
  type IdentidadFiscal,
} from '../leads/[id]/deal-actions';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const ghostBtn: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };
const primaryBtn: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };
const linkBtn: CSSProperties = { background: 'transparent', border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: SANS, padding: 0 };
const dashedBtn: CSSProperties = { background: 'transparent', border: '1.5px dashed var(--border-strong)', color: 'var(--primary)', fontWeight: 600, fontSize: 13.5, padding: '11px 16px', borderRadius: 11, cursor: 'pointer', width: '100%', fontFamily: SANS };

type FormState = {
  id: number | null;
  nombre: string;
  idFiscal: string;
  domicilio: string;
  correo: string;
  esDefault: boolean;
};

function Campo({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: 'var(--dim)' }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11.5, marginTop: 5, color: 'var(--faint)' }}>{hint}</span>}
    </label>
  );
}

export function IdentidadesFiscalesPanel() {
  const [lista, setLista] = useState<IdentidadFiscal[] | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmBorrar, setConfirmBorrar] = useState<IdentidadFiscal | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Sube el documento fiscal propio (PDF/foto) y prellena el form con lo extraído
  // (solo lo que esté vacío — no pisa lo que ya cargaste).
  const subirDocFiscal = async (file: File) => {
    if (!form) return;
    setErr(null);
    setLeyendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/extract-fiscal', { method: 'POST', body: fd });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setForm((prev) => prev && ({
        ...prev,
        nombre: prev.nombre.trim() || j.razon || '',
        idFiscal: prev.idFiscal.trim() || j.id_fiscal || '',
        domicilio: prev.domicilio.trim() || j.domicilio || '',
        correo: prev.correo.trim() || j.correo || '',
      }));
    } catch (e) {
      setErr(`No se pudo leer el documento: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLeyendo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const cargar = async () => {
    try { setLista(await getIdentidadesFiscalesAction()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); setLista([]); }
  };
  useEffect(() => { void cargar(); }, []);

  const nueva = () => { setErr(null); setForm({ id: null, nombre: '', idFiscal: '', domicilio: '', correo: '', esDefault: (lista ?? []).length === 0 }); };
  const editar = (i: IdentidadFiscal) => { setErr(null); setForm({ id: i.id, nombre: i.nombre, idFiscal: i.id_fiscal ?? '', domicilio: i.domicilio ?? '', correo: i.correo ?? '', esDefault: i.es_default }); };

  const guardar = async () => {
    if (!form || !form.nombre.trim()) return;
    setErr(null);
    setBusy(true);
    try {
      await saveIdentidadFiscalAction({
        id: form.id ?? undefined,
        nombre: form.nombre,
        id_fiscal: form.idFiscal,
        domicilio: form.domicilio,
        correo: form.correo,
        es_default: form.esDefault,
      });
      await cargar();
      setForm(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const hacerDefault = async (i: IdentidadFiscal) => {
    setErr(null);
    setBusy(true);
    try {
      await saveIdentidadFiscalAction({ id: i.id, nombre: i.nombre, id_fiscal: i.id_fiscal, domicilio: i.domicilio, correo: i.correo, es_default: true });
      await cargar();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (i: IdentidadFiscal) => {
    setConfirmBorrar(null);
    setErr(null);
    setBusy(true);
    try {
      await deleteIdentidadFiscalAction(i.id);
      await cargar();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ marginTop: 34 }}>
      <h2 style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>Identidades fiscales</h2>
      <div style={card}>
        {lista === null ? (
          <div style={{ fontFamily: MONO, fontSize: 13, color: 'var(--faint)' }}>Cargando…</div>
        ) : lista.length === 0 && !form ? (
          <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 14px', lineHeight: 1.55 }}>
            Todavía no cargaste ninguna. Son tus razones sociales propias: se eligen como Facturado por en el Deal Details de cada lead.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: form || lista.length === 0 ? 0 : 14 }}>
            {lista.map((i) => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 14px', border: '1px solid var(--border-strong)', borderRadius: 11, background: 'var(--surface-2)' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{i.nombre}</span>
                    {i.es_default && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-bg)', border: '1px solid var(--primary)', borderRadius: 999, padding: '1px 8px' }}>Default</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, fontFamily: MONO }}>
                    {[i.id_fiscal, i.correo].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {i.domicilio && <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 2 }}>{i.domicilio}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {!i.es_default && (
                    <button type="button" style={{ ...linkBtn, color: 'var(--dim)', opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => void hacerDefault(i)}>Hacer default</button>
                  )}
                  <button type="button" style={{ ...linkBtn, color: 'var(--primary)', fontWeight: 600 }} onClick={() => editar(i)}>Editar</button>
                  <button type="button" style={{ ...linkBtn, color: 'var(--bad)' }} onClick={() => setConfirmBorrar(i)}>Borrar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {form ? (
          <div style={{ padding: '14px 15px', border: '1.5px dashed var(--border-strong)', borderRadius: 12, marginTop: lista && lista.length > 0 ? 14 : 0 }}>
            {/* Subir el documento fiscal propio → IA rellena los campos de abajo. */}
            <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirDocFiscal(f); }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <button type="button" style={{ ...ghostBtn, opacity: leyendo ? 0.6 : 1 }} disabled={leyendo} onClick={() => fileRef.current?.click()}>
                {leyendo ? 'Leyendo documento…' : '⇪ Subir PDF/foto de tus datos fiscales'}
              </button>
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>La IA lee la constancia/RFC/CUIT y rellena lo vacío. Revisá antes de guardar.</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <Campo label="Razón social / nombre">
                <input className="lead-field" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </Campo>
              <Campo label="Identificación fiscal" hint="RFC, CUIT, NIT, EIN… según país.">
                <input className="lead-field" value={form.idFiscal} onChange={(e) => setForm({ ...form, idFiscal: e.target.value })} />
              </Campo>
              <Campo label="Domicilio fiscal">
                <input className="lead-field" value={form.domicilio} onChange={(e) => setForm({ ...form, domicilio: e.target.value })} />
              </Campo>
              <Campo label="Correo">
                <input className="lead-field" type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
              </Campo>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer', fontFamily: SANS }}>
              <input type="checkbox" checked={form.esDefault} onChange={(e) => setForm({ ...form, esDefault: e.target.checked })} />
              Usar como identidad por defecto
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" style={ghostBtn} onClick={() => setForm(null)} disabled={busy}>Cancelar</button>
              <button
                type="button"
                style={{ ...primaryBtn, opacity: busy || !form.nombre.trim() ? 0.55 : 1 }}
                disabled={busy || !form.nombre.trim()}
                onClick={() => void guardar()}
              >
                {busy ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Agregar identidad'}
              </button>
            </div>
          </div>
        ) : (
          lista !== null && <button type="button" style={dashedBtn} onClick={nueva}>+ Agregar identidad</button>
        )}

        {err && (
          <div style={{ borderRadius: 11, padding: '11px 16px', fontSize: 13.5, fontWeight: 600, marginTop: 12, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>
        )}
      </div>

      {confirmBorrar && (
        <ConfirmDialog
          titulo="¿Borrar esta identidad?"
          detalle={`"${confirmBorrar.nombre}" se borra del workspace. Los deals que la tenían como Facturado por quedan sin identidad asignada.`}
          confirmLabel="Borrar"
          danger
          onCancel={() => setConfirmBorrar(null)}
          onConfirm={() => void borrar(confirmBorrar)}
        />
      )}
    </section>
  );
}
