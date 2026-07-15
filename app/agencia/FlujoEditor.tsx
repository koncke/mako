'use client';

// =============================================================================
// FlujoEditor — el FLUJO "dibujado" y editable: disparador + pasos en tarjetas
// =============================================================================
// Se ve como el diagrama de antes (una tarjeta por paso, con su mensaje adentro y
// flechas), pero editable: cada paso tiene un lápiz que lo despliega para modificar
// ESE paso (cambiar tipo, texto, reordenar, eliminar). Abajo de todo, una flecha y
// una caja gris "＋ Nuevo paso". Autosave. TODA plantilla ya es un flujo (no hay
// "convertir"); el on/off es el toggle de la plantilla (arriba en el modal).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { EVENTOS, flujoVacio, type Flujo, type Paso } from '@/lib/flujos-tipos';

const cap: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' };
const input: CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const iconBtn: CSSProperties = { background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontSize: 13, color: 'var(--faint)', lineHeight: 1 };

const Flecha = () => <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--faint)', fontSize: 15, margin: '3px 0' }}>↓</div>;

// Meta de presentación de cada tipo de paso (icono + título para la tarjeta).
function metaPaso(p: Paso): { icono: string; titulo: string; detalle?: string } {
  if (p.tipo === 'mensaje') return p.canal === 'aviso_dueno'
    ? { icono: '🔔', titulo: 'Avisarte a vos', detalle: p.texto || undefined }
    : { icono: '💬', titulo: 'WhatsApp al lead (con tu OK)', detalle: p.texto || undefined };
  if (p.tipo === 'accion') {
    const acc: Record<string, string> = { crear_tarea: 'Crear una tarea', inscribir_nutricion: 'Inscribir en nutrición', marcar_lead: 'Marcar el lead' };
    return { icono: '⚙️', titulo: acc[p.accion] ?? 'Acción', detalle: 'Se propone y confirmás con un “sí”.' };
  }
  return { icono: '⏳', titulo: `Esperar ${p.horas} h`, detalle: 'Después sigue con el próximo paso.' };
}

export function FlujoEditor({ plantillaId }: { plantillaId: string }) {
  const [flujo, setFlujoState] = useState<Flujo | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null); // qué paso está desplegado
  const guardarT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch('/api/admin/plantillas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'flujo-get', id: plantillaId }) }).then((r) => r.json());
      setFlujoState((j?.ok && j.flujo) ? (j.flujo as Flujo) : { ...flujoVacio(), activo: true });
    } finally { setLoading(false); }
  }, [plantillaId]);
  useEffect(() => { cargar(); }, [cargar]);

  const setFlujo = (f: Flujo) => {
    setFlujoState(f);
    if (guardarT.current) clearTimeout(guardarT.current);
    guardarT.current = setTimeout(async () => {
      try {
        await fetch('/api/admin/plantillas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'flujo-set', id: plantillaId, flujo: { ...f, activo: true } }) });
        setFlash('Guardado ✓'); setTimeout(() => setFlash(null), 1500);
      } catch { /* reintenta en el próximo cambio */ }
    }, 700);
  };

  if (loading || !flujo) return <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Cargando flujo…</div>;

  const setPaso = (i: number, p: Paso) => setFlujo({ ...flujo, pasos: flujo.pasos.map((x, j) => (j === i ? p : x)) });
  const addPaso = (p: Paso) => { setFlujo({ ...flujo, pasos: [...flujo.pasos, p] }); setEditIdx(flujo.pasos.length); };
  const delPaso = (i: number) => { setFlujo({ ...flujo, pasos: flujo.pasos.filter((_, j) => j !== i) }); setEditIdx(null); };
  const movePaso = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= flujo.pasos.length) return;
    const ps = [...flujo.pasos];[ps[i], ps[j]] = [ps[j], ps[i]]; setFlujo({ ...flujo, pasos: ps }); setEditIdx(j);
  };

  const dispTipo = flujo.disparador.tipo;
  const evento = dispTipo === 'evento' ? flujo.disparador.evento : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Cuándo dispara */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={cap}>⚡ Cuándo se dispara</span>
        {flash && <span style={{ fontSize: 11.5, color: 'var(--good)', fontWeight: 600, marginLeft: 'auto' }}>{flash}</span>}
      </div>
      <Dropdown
        value={dispTipo === 'manual' ? 'manual' : `evento:${evento}`}
        options={[...EVENTOS.map((e) => ({ value: `evento:${e.key}`, label: e.label })), { value: 'manual', label: 'Manual (lo disparás vos)' }]}
        onChange={(v) => { if (v === 'manual') setFlujo({ ...flujo, disparador: { tipo: 'manual' } }); else setFlujo({ ...flujo, disparador: { tipo: 'evento', evento: v.replace('evento:', '') as never } }); }}
        width="100%"
      />
      {dispTipo === 'evento' && (evento === 'lead.agendo' || evento === 'reunion.ocurrio' || evento === 'lead.cancelo') && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--dim)', marginTop: 6 }}>
          <span>Solo para:</span>
          <div style={{ minWidth: 140 }}>
            <Dropdown value={flujo.disparador.tipo === 'evento' ? (flujo.disparador.filtro?.reunion ?? 'ambas') : 'ambas'}
              options={[{ value: 'ambas', label: 'R1 y R2' }, { value: 'R1', label: 'Solo R1' }, { value: 'R2', label: 'Solo R2' }]}
              onChange={(v) => { if (flujo.disparador.tipo !== 'evento') return; const filtro = v === 'ambas' ? undefined : { reunion: v as 'R1' | 'R2' }; setFlujo({ ...flujo, disparador: { ...flujo.disparador, filtro } }); }} />
          </div>
        </label>
      )}

      <Flecha />

      {/* Los pasos, dibujados como tarjetas (con su mensaje adentro) */}
      {flujo.pasos.map((p, i) => {
        const m = metaPaso(p);
        const abierto = editIdx === i;
        return (
          <div key={i}>
            {i > 0 && <Flecha />}
            <div style={{ border: `1px solid ${abierto ? 'var(--primary-weak)' : 'var(--border)'}`, borderRadius: 12, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 14px' }}>
                <span style={{ fontSize: 18, flex: 'none', lineHeight: 1.2 }}>{m.icono}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{m.titulo}</div>
                  {m.detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{m.detalle}</div>}
                </div>
                <button aria-label="editar paso" title="Editar este paso" onClick={() => setEditIdx(abierto ? null : i)} style={{ ...iconBtn, color: abierto ? 'var(--primary)' : 'var(--faint)', fontSize: 14 }}>✏️</button>
              </div>
              {abierto && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9, background: 'var(--surface)' }}>
                  {/* Cambiar el TIPO de paso */}
                  <div style={{ maxWidth: 260 }}>
                    <Dropdown value={p.tipo === 'mensaje' ? (p.canal === 'aviso_dueno' ? 'aviso' : 'wa') : p.tipo}
                      options={[{ value: 'aviso', label: '🔔 Avisarte a vos' }, { value: 'wa', label: '💬 WhatsApp al lead (con tu OK)' }, { value: 'accion', label: '⚙️ Acción' }, { value: 'esperar', label: '⏳ Esperar' }]}
                      onChange={(v) => setPaso(i, v === 'aviso' ? { tipo: 'mensaje', canal: 'aviso_dueno', texto: p.tipo === 'mensaje' ? p.texto : '' } : v === 'wa' ? { tipo: 'mensaje', canal: 'wa_lead', texto: p.tipo === 'mensaje' ? p.texto : '' } : v === 'accion' ? { tipo: 'accion', accion: 'crear_tarea' } : { tipo: 'esperar', horas: 24 })} />
                  </div>
                  {p.tipo === 'mensaje' && (
                    <textarea value={p.texto} onChange={(e) => setPaso(i, { ...p, texto: e.target.value })} placeholder="El mensaje (MaKo lo adapta con los datos reales)…" rows={3} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} autoFocus />
                  )}
                  {p.tipo === 'accion' && (
                    <div style={{ maxWidth: 260 }}>
                      <Dropdown value={p.accion} options={[{ value: 'crear_tarea', label: 'Crear una tarea' }, { value: 'inscribir_nutricion', label: 'Inscribir en nutrición' }, { value: 'marcar_lead', label: 'Marcar el lead' }]} onChange={(v) => setPaso(i, { ...p, accion: v as never })} />
                    </div>
                  )}
                  {p.tipo === 'esperar' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                      Esperar <input type="number" min={1} value={p.horas} onChange={(e) => setPaso(i, { ...p, horas: Math.max(1, Number(e.target.value) || 1) })} style={{ ...input, width: 80 }} /> horas
                      <span style={{ fontSize: 11, color: 'var(--warn)' }}>(necesita el cron — próximamente)</span>
                    </label>
                  )}
                  {/* Acciones del paso */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <button aria-label="subir" title="Subir" onClick={() => movePaso(i, -1)} disabled={i === 0} style={{ ...iconBtn, opacity: i === 0 ? 0.35 : 1, fontSize: 15 }}>↑</button>
                    <button aria-label="bajar" title="Bajar" onClick={() => movePaso(i, 1)} disabled={i === flujo.pasos.length - 1} style={{ ...iconBtn, opacity: i === flujo.pasos.length - 1 ? 0.35 : 1, fontSize: 15 }}>↓</button>
                    <span style={{ flex: 1 }} />
                    <button onClick={() => delPaso(i)} style={{ ...iconBtn, color: 'var(--bad)', fontSize: 12.5, fontWeight: 600, padding: '4px 8px' }}>Eliminar paso</button>
                    <button onClick={() => setEditIdx(null)} style={{ ...iconBtn, color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, padding: '4px 8px' }}>Listo</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <Flecha />

      {/* + Nuevo paso: caja gris translúcida al final */}
      <button type="button" onClick={() => addPaso({ tipo: 'mensaje', canal: 'aviso_dueno', texto: '' })}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '13px', borderRadius: 12, border: '1.5px dashed var(--border-strong)', background: 'var(--surface-2)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: 0.9 }}>
        <span style={{ fontSize: 15 }}>＋</span> Nuevo paso
      </button>
    </div>
  );
}
