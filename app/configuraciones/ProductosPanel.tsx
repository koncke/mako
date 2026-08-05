'use client';

// =============================================================================
// ProductosPanel — catálogo de productos/ofertas del workspace (#374)
// =============================================================================
// Se cargan una vez acá y después se eligen al cerrar un lead (wizard "Ganado",
// F2): el deal hereda el pricing del producto (tipo/monto/plazo). El primer
// producto se siembra solo desde la 'oferta' del onboarding.

import { useEffect, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { ConfirmDialog } from '../_components/ChatItemMenu';
import { listProductosAction, saveProductoAction, deleteProductoAction } from './productos-actions';
import type { Producto, ProductoTipo } from '@/lib/productos';

const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const field: CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const ghostBtn: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };
const primaryBtn: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };
const linkBtn: CSSProperties = { background: 'transparent', border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: SANS, padding: 0 };
const dashedBtn: CSSProperties = { background: 'transparent', border: '1.5px dashed var(--border-strong)', color: 'var(--primary)', fontWeight: 600, fontSize: 13.5, padding: '11px 16px', borderRadius: 11, cursor: 'pointer', width: '100%', fontFamily: SANS };

const fmtUSD = (n: number | null) => (n == null ? '—' : '$' + n.toLocaleString('en-US'));

type Form = {
  id: number | null;
  nombre: string;
  tipo: ProductoTipo;
  monto: string;
  meses: string;
  promesa: string;
  incluye: string;
  garantia: string;
  descripcion: string;
  activo: boolean;
};

const FORM_VACIO: Form = { id: null, nombre: '', tipo: 'unico', monto: '', meses: '', promesa: '', incluye: '', garantia: '', descripcion: '', activo: true };

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, marginBottom: 6, color: 'var(--dim)' }}>{label}</span>
      {children}
    </label>
  );
}

function btnTipo(activo: boolean): CSSProperties {
  return { flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, background: activo ? 'var(--ink)' : 'var(--surface)', border: '1px solid ' + (activo ? 'var(--ink)' : 'var(--border-strong)'), color: activo ? '#F3F5F8' : 'var(--ink)' };
}

export function ProductosPanel() {
  const [items, setItems] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [borrar, setBorrar] = useState<Producto | null>(null);
  const [pending, start] = useTransition();

  const recargar = () => listProductosAction().then(setItems).catch(() => {}).finally(() => setCargando(false));
  useEffect(() => { recargar(); }, []);

  const abrirNuevo = () => setForm({ ...FORM_VACIO });
  const abrirEditar = (p: Producto) => setForm({
    id: p.id, nombre: p.nombre, tipo: p.tipo, monto: p.monto_usd != null ? String(p.monto_usd) : '',
    meses: p.suscripcion_meses != null ? String(p.suscripcion_meses) : '', promesa: p.promesa ?? '',
    incluye: p.incluye ?? '', garantia: p.garantia ?? '', descripcion: p.descripcion ?? '', activo: p.activo,
  });

  const guardar = () => {
    if (!form || !form.nombre.trim()) return;
    start(async () => {
      try {
        await saveProductoAction({
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          monto_usd: form.monto.trim() ? (parseFloat(form.monto) || null) : null,
          suscripcion_meses: form.tipo === 'suscripcion' && form.meses.trim() ? (parseInt(form.meses, 10) || null) : null,
          promesa: form.promesa, incluye: form.incluye, garantia: form.garantia, descripcion: form.descripcion, activo: form.activo,
        }, form.id ?? undefined);
        setForm(null);
        await recargar();
      } catch (e) { alert(`No se pudo guardar: ${e instanceof Error ? e.message : 'error'}`); }
    });
  };

  const confirmarBorrar = () => {
    if (!borrar) return;
    const id = borrar.id;
    start(async () => {
      try { await deleteProductoAction(id); setBorrar(null); await recargar(); }
      catch (e) { alert(`No se pudo borrar: ${e instanceof Error ? e.message : 'error'}`); }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0, lineHeight: 1.5 }}>
        Cargá tus productos u ofertas. Al cerrar un lead vas a elegir uno y el CRM hereda su precio y tipo (pago único o suscripción) — sin volver a tipear nada.
      </p>

      {cargando ? (
        <div style={{ fontSize: 13.5, color: 'var(--faint)' }}>Cargando…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((p) => (
            <div key={p.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', opacity: p.activo ? 1 : 0.55 }}>
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>
                  {p.nombre}
                  {!p.activo && <span style={{ marginLeft: 8, fontSize: 11.5, color: 'var(--faint)' }}>(inactivo)</span>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>
                  {p.tipo === 'suscripcion'
                    ? `🔁 Suscripción · ${fmtUSD(p.monto_usd)}/mes · ${p.suscripcion_meses ? `${p.suscripcion_meses} meses` : 'indefinida'}`
                    : `Pago único · ${fmtUSD(p.monto_usd)}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <button type="button" style={{ ...linkBtn, color: 'var(--primary)', fontWeight: 600 }} onClick={() => abrirEditar(p)}>Editar</button>
                <button type="button" style={{ ...linkBtn, color: 'var(--bad)' }} onClick={() => setBorrar(p)}>Borrar</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--faint)', fontStyle: 'italic' }}>Todavía no cargaste productos. Agregá el primero abajo.</div>}
          <button type="button" style={dashedBtn} onClick={abrirNuevo}>+ Nuevo producto</button>
        </div>
      )}

      {form && (
        <div onClick={() => !pending && setForm(null)} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: 24 }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, margin: '0 0 16px', color: 'var(--ink)' }}>{form.id ? 'Editar producto' : 'Nuevo producto'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Campo label="Nombre"><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Mentoría 1:1" style={field} autoFocus /></Campo>
              <Campo label="Tipo de venta">
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setForm({ ...form, tipo: 'unico' })} style={btnTipo(form.tipo === 'unico')}>Pago único</button>
                  <button type="button" onClick={() => setForm({ ...form, tipo: 'suscripcion' })} style={btnTipo(form.tipo === 'suscripcion')}>Suscripción mensual</button>
                </div>
              </Campo>
              <Campo label={form.tipo === 'suscripcion' ? 'Monto mensual (USD)' : 'Precio (USD)'}><input inputMode="numeric" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" style={field} /></Campo>
              {form.tipo === 'suscripcion' && (
                <Campo label="Duración">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input inputMode="numeric" value={form.meses} onChange={(e) => setForm({ ...form, meses: e.target.value.replace(/[^\d]/g, '') })} placeholder="meses" style={{ ...field, maxWidth: 120 }} />
                    <button type="button" onClick={() => setForm({ ...form, meses: '' })} style={btnTipo(!form.meses)}>Indefinida</button>
                  </div>
                </Campo>
              )}
              <Campo label="Promesa (opcional)"><input value={form.promesa} onChange={(e) => setForm({ ...form, promesa: e.target.value })} placeholder="La transformación que entregás" style={field} /></Campo>
              <Campo label="¿Qué incluye? (opcional)"><textarea value={form.incluye} onChange={(e) => setForm({ ...form, incluye: e.target.value })} placeholder="Entregables, sesiones, plantillas…" style={{ ...field, minHeight: 70, resize: 'vertical' }} /></Campo>
              <Campo label="Garantía (opcional)"><input value={form.garantia} onChange={(e) => setForm({ ...form, garantia: e.target.value })} placeholder="30 días o devolución" style={field} /></Campo>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--dim)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo (aparece al cerrar leads)
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" disabled={pending} style={ghostBtn} onClick={() => setForm(null)}>Cancelar</button>
              <button type="button" disabled={pending || !form.nombre.trim()} style={{ ...primaryBtn, opacity: pending || !form.nombre.trim() ? 0.6 : 1 }} onClick={guardar}>{pending ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {borrar && (
        <ConfirmDialog
          titulo={`¿Borrar "${borrar.nombre}"?`}
          detalle="Se saca del catálogo. Los deals que ya lo referencian no se tocan."
          confirmLabel="Borrar"
          danger
          onConfirm={confirmarBorrar}
          onCancel={() => setBorrar(null)}
        />
      )}
    </div>
  );
}
