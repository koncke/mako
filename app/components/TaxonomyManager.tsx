'use client';

// =============================================================================
// TaxonomyManager — editor de ÁNGULOS + AVATARES de los anuncios (CRUD)
// =============================================================================
// Una sola modal con dos secciones. Cada ítem: color, nombre y una descripción
// (que también guía a la IA al clasificar). Guarda las dos listas enteras contra
// /api/script-analyst/angles y /api/script-analyst/avatares (misma data que el
// onboarding del cliente). Reusable desde Script Analyst y desde el onboarding.

import { useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const PALETTE = ['#2F6DDB', '#C8870C', '#CF4E29', '#3B6D11', '#7C4DD6', '#0E8E7E', '#A8770F', '#B5742A', '#9A3D6B', '#6B675C'];

export type TaxItem = { key: string; label: string; color: string; desc?: string };
type Row = { uid: number; key: string; label: string; color: string; desc: string };

// Mismo slug que angleKey/avatarKey del backend, para detectar colisiones de clave.
function slug(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const inp: CSSProperties = { border: '1px solid var(--border-strong)', borderRadius: 9, background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, padding: '8px 11px', outline: 'none', width: '100%' };

export function TaxonomyManager({ angles, avatares, onClose, onSaved }: { angles: TaxItem[]; avatares: TaxItem[]; onClose: () => void; onSaved: () => void }) {
  const uid = useRef(0);
  const seed = (list: TaxItem[]): Row[] => list.map((a) => ({ uid: uid.current++, key: a.key, label: a.label, color: a.color, desc: a.desc ?? '' }));
  const [aRows, setARows] = useState<Row[]>(() => seed(angles));
  const [vRows, setVRows] = useState<Row[]>(() => seed(avatares));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mk = (rows: Row[], setRows: (f: (rs: Row[]) => Row[]) => void) => ({
    update: (u: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.uid === u ? { ...r, ...patch } : r))),
    remove: (u: number) => setRows((rs) => rs.filter((r) => r.uid !== u)),
    add: () => setRows((rs) => [...rs, { uid: uid.current++, key: '', label: '', color: PALETTE[rs.length % PALETTE.length], desc: '' }]),
  });

  function validate(rows: Row[], nombre: string, minUno: boolean): string | null {
    if (rows.some((r) => !r.label.trim())) return `Cada ${nombre} necesita un nombre.`;
    if (minUno && rows.length === 0) return `Tiene que quedar al menos un ${nombre}.`;
    const slugs = rows.map((r) => slug(r.key || r.label));
    const dup = slugs.find((s, i) => s && slugs.indexOf(s) !== i);
    return dup ? `Hay dos ${nombre}s que quedarían con la misma clave ("${dup}"). Cambiá un nombre.` : null;
  }

  async function save() {
    const e1 = validate(aRows, 'ángulo', true);
    const e2 = validate(vRows, 'avatar', false);
    if (e1 || e2) { setErr(e1 ?? e2); return; }
    setSaving(true); setErr(null);
    try {
      const payload = (rows: Row[]) => rows.map((r) => ({ key: r.key || undefined, label: r.label.trim(), color: r.color, desc: r.desc.trim() || undefined }));
      const [ra, rv] = await Promise.all([
        fetch('/api/script-analyst/angles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ angles: payload(aRows) }) }).then((r) => r.json()),
        fetch('/api/script-analyst/avatares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatares: payload(vRows) }) }).then((r) => r.json()),
      ]);
      if (!ra.ok) throw new Error(ra.error || 'no se pudieron guardar los ángulos');
      if (!rv.ok) throw new Error(rv.error || 'no se pudieron guardar los avatares');
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // Se llama como FUNCIÓN ({section(...)}), no como <Section/>: si fuera un
  // componente definido en el render, React lo remontaría en cada tecla y los
  // inputs perderían el foco. Llamado así, las filas quedan inline en el padre.
  const section = ({ title, blurb, rows, setRows, placeholder }: { title: string; blurb: string; rows: Row[]; setRows: (f: (rs: Row[]) => Row[]) => void; placeholder: string }) => {
    const ops = mk(rows, setRows);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>{title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 4, lineHeight: 1.4 }}>{blurb}</div>
        </div>
        {rows.length === 0 && <div style={{ fontSize: 13, color: 'var(--faint)', padding: '2px 0' }}>Todavía no hay. Agregá el primero ↓</div>}
        {rows.map((r) => (
          <div key={r.uid} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="color" aria-label="Color" value={r.color} onChange={(e) => ops.update(r.uid, { color: e.target.value })} style={{ width: 38, height: 38, flex: 'none', border: '1px solid var(--border)', borderRadius: 9, background: 'transparent', cursor: 'pointer', padding: 2 }} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={r.label} placeholder={placeholder} onChange={(e) => ops.update(r.uid, { label: e.target.value })} style={inp} />
              <input value={r.desc} placeholder="Cuándo aplica — guía para la IA (opcional)" onChange={(e) => ops.update(r.uid, { desc: e.target.value })} style={{ ...inp, fontSize: 12.5, color: 'var(--dim)' }} />
            </div>
            <button onClick={() => ops.remove(r.uid)} aria-label="Borrar" style={{ width: 38, height: 38, flex: 'none', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--bad)', fontSize: 15, cursor: 'pointer', fontFamily: SANS }}>✕</button>
          </div>
        ))}
        <button onClick={ops.add} style={{ alignSelf: 'flex-start', padding: '8px 13px', borderRadius: 10, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--primary)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>+ Agregar</button>
      </div>
    );
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '22px 26px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontWeight: 600, fontSize: 22, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Ángulos y avatares</h2>
            <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 6, lineHeight: 1.5 }}>El vocabulario con el que se clasifican los guiones. Se aplica al re-analizar o sincronizar; los anuncios ya clasificados con uno que borrás lo siguen mostrando hasta re-analizarse.</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>
        </div>
        <div style={{ padding: '20px 26px', maxHeight: '62vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {section({ title: 'Ángulos del mensaje', blurb: 'El enfoque del guion (visionario, dolor, testimonio…). Tiene que quedar al menos uno.', rows: aRows, setRows: setARows, placeholder: 'Nombre del ángulo (ej. Autoridad)' })}
          <div style={{ height: 1, background: 'var(--border)' }} />
          {section({ title: 'Avatares (público objetivo)', blurb: 'A quién le habla el anuncio. Dos guiones del mismo ángulo pueden apuntarle a avatares distintos. Pueden quedar en cero.', rows: vRows, setRows: setVRows, placeholder: 'Nombre del avatar (ej. Dueño de clínica)' })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 26px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12.5, color: err ? 'var(--bad)' : 'var(--faint)' }}>{err ?? `${aRows.length} ángulo${aRows.length === 1 ? '' : 's'} · ${vRows.length} avatar${vRows.length === 1 ? '' : 'es'}`}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: saving ? 'var(--border-strong)' : 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
