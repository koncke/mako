'use client';

// =============================================================================
// FlujoEditor — editar el FLUJO de una plantilla: disparador + pasos (punto 7/8)
// =============================================================================
// CUÁNDO dispara (evento / manual) y QUÉ pasos ejecuta (mensaje / acción / esperar),
// editables + agregar/quitar/reordenar. Guarda en el store (flujo-set).

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { EVENTOS, flujoVacio, type Flujo, type Paso } from '@/lib/flujos-tipos';

const btn: CSSProperties = { padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const input: CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };

export function FlujoEditor({ plantillaId }: { plantillaId: string }) {
  const [flujo, setFlujo] = useState<Flujo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch('/api/admin/plantillas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'flujo-get', id: plantillaId }) }).then((r) => r.json());
      setFlujo(j?.ok ? (j.flujo as Flujo | null) : null);
    } finally { setLoading(false); }
  }, [plantillaId]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (f: Flujo | null) => {
    setSaving(true);
    try {
      const j = await fetch('/api/admin/plantillas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'flujo-set', id: plantillaId, flujo: f }) }).then((r) => r.json());
      if (j?.ok) { setFlujo(j.flujo as Flujo | null); setFlash('Guardado ✓'); setTimeout(() => setFlash(null), 2000); }
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Cargando flujo…</div>;

  if (!flujo) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>Esta plantilla todavía no tiene un <b>flujo</b> (cuándo dispara + qué pasos ejecuta). Conviértela en una automatización:</div>
        <button style={{ ...btn, alignSelf: 'flex-start' }} onClick={() => guardar(flujoVacio())}>+ Convertir en flujo</button>
      </div>
    );
  }

  const setPaso = (i: number, p: Paso) => setFlujo({ ...flujo, pasos: flujo.pasos.map((x, j) => (j === i ? p : x)) });
  const addPaso = (p: Paso) => setFlujo({ ...flujo, pasos: [...flujo.pasos, p] });
  const delPaso = (i: number) => setFlujo({ ...flujo, pasos: flujo.pasos.filter((_, j) => j !== i) });
  const movePaso = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= flujo.pasos.length) return;
    const ps = [...flujo.pasos];[ps[i], ps[j]] = [ps[j], ps[i]]; setFlujo({ ...flujo, pasos: ps });
  };

  const dispTipo = flujo.disparador.tipo;
  const evento = dispTipo === 'evento' ? flujo.disparador.evento : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Activo + guardar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={flujo.activo} onChange={(e) => setFlujo({ ...flujo, activo: e.target.checked })} />
          <span style={{ fontWeight: 600, color: flujo.activo ? 'var(--good)' : 'var(--dim)' }}>{flujo.activo ? 'Activo' : 'Pausado'}</span>
        </label>
        <span style={{ flex: 1 }} />
        {flash && <span style={{ fontSize: 12, color: 'var(--good)', fontWeight: 600 }}>{flash}</span>}
        <button style={{ ...btn, background: 'var(--ink)', color: 'var(--surface)', border: 'none', opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={() => guardar(flujo)}>{saving ? 'Guardando…' : 'Guardar flujo'}</button>
        <button style={{ ...btn, color: 'var(--bad)' }} onClick={() => guardar(null)}>Borrar flujo</button>
      </div>

      {/* Disparador */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' }}>Cuándo dispara</span>
        <Dropdown
          value={dispTipo === 'manual' ? 'manual' : `evento:${evento}`}
          options={[{ value: 'manual', label: 'Manual (lo disparas tú)' }, ...EVENTOS.map((e) => ({ value: `evento:${e.key}`, label: e.label }))]}
          onChange={(v) => { if (v === 'manual') setFlujo({ ...flujo, disparador: { tipo: 'manual' } }); else setFlujo({ ...flujo, disparador: { tipo: 'evento', evento: v.replace('evento:', '') as never } }); }}
        />
        {dispTipo === 'evento' && (evento === 'lead.agendo' || evento === 'reunion.ocurrio' || evento === 'lead.cancelo') && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--dim)' }}>
            <span>Solo para:</span>
            <div style={{ minWidth: 140 }}>
              <Dropdown value={flujo.disparador.tipo === 'evento' ? (flujo.disparador.filtro?.reunion ?? 'ambas') : 'ambas'}
                options={[{ value: 'ambas', label: 'R1 y R2' }, { value: 'R1', label: 'Solo R1' }, { value: 'R2', label: 'Solo R2' }]}
                onChange={(v) => { if (flujo.disparador.tipo !== 'evento') return; const filtro = v === 'ambas' ? undefined : { reunion: v as 'R1' | 'R2' }; setFlujo({ ...flujo, disparador: { ...flujo.disparador, filtro } }); }} />
            </div>
          </label>
        )}
      </div>

      {/* Pasos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' }}>Pasos</span>
        {flujo.pasos.length === 0 && <div style={{ fontSize: 12, color: 'var(--faint)' }}>Sin pasos todavía. Agrega uno abajo.</div>}
        {flujo.pasos.map((p, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--faint)' }}>{i + 1}.</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{p.tipo === 'mensaje' ? (p.canal === 'aviso_dueno' ? 'Avisar al dueño' : 'WhatsApp al lead') : p.tipo === 'accion' ? 'Acción' : 'Esperar'}</span>
              <button aria-label="subir" onClick={() => movePaso(i, -1)} style={{ ...btn, padding: '2px 7px' }}>↑</button>
              <button aria-label="bajar" onClick={() => movePaso(i, 1)} style={{ ...btn, padding: '2px 7px' }}>↓</button>
              <button aria-label="quitar" onClick={() => delPaso(i)} style={{ ...btn, padding: '2px 7px', color: 'var(--bad)' }}>✕</button>
            </div>
            {p.tipo === 'mensaje' && (
              <>
                <div style={{ maxWidth: 200 }}>
                  <Dropdown value={p.canal} options={[{ value: 'aviso_dueno', label: 'Avisar al dueño' }, { value: 'wa_lead', label: 'WhatsApp al lead (con tu OK)' }]} onChange={(v) => setPaso(i, { ...p, canal: v as 'aviso_dueno' | 'wa_lead' })} />
                </div>
                <textarea value={p.texto} onChange={(e) => setPaso(i, { ...p, texto: e.target.value })} placeholder="El mensaje (MaKo lo adapta con los datos reales)…" rows={2} style={{ ...input, resize: 'vertical' }} />
              </>
            )}
            {p.tipo === 'accion' && (
              <div style={{ maxWidth: 240 }}>
                <Dropdown value={p.accion} options={[{ value: 'crear_tarea', label: 'Crear una tarea' }, { value: 'inscribir_nutricion', label: 'Inscribir en nutrición' }, { value: 'marcar_lead', label: 'Marcar el lead' }]} onChange={(v) => setPaso(i, { ...p, accion: v as never })} />
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 5 }}>Se propone y confirmas con un “sí” (nunca dispara solo).</div>
              </div>
            )}
            {p.tipo === 'esperar' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                Esperar <input type="number" min={1} value={p.horas} onChange={(e) => setPaso(i, { ...p, horas: Math.max(1, Number(e.target.value) || 1) })} style={{ ...input, width: 80 }} /> horas
                <span style={{ fontSize: 11, color: 'var(--warn)' }}>(los pasos con espera necesitan el cron — próximamente)</span>
              </label>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn} onClick={() => addPaso({ tipo: 'mensaje', canal: 'aviso_dueno', texto: '' })}>+ Mensaje</button>
          <button style={btn} onClick={() => addPaso({ tipo: 'accion', accion: 'crear_tarea' })}>+ Acción</button>
          <button style={btn} onClick={() => addPaso({ tipo: 'esperar', horas: 24 })}>+ Esperar</button>
        </div>
      </div>
    </div>
  );
}
