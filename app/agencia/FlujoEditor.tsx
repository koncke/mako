'use client';

// =============================================================================
// FlujoEditor — editar el FLUJO de una plantilla: CUÁNDO dispara + QUÉ pasos hace
// =============================================================================
// TODA plantilla YA es un flujo (por eso arriba dice "cuándo dispara"): no hay
// "convertir en flujo". Se edita directo — el disparador y CADA paso son editables.
// El on/off es el de la plantilla (arriba), no hay un activo/pausado acá.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { EVENTOS, flujoVacio, type Flujo, type Paso } from '@/lib/flujos-tipos';

const btn: CSSProperties = { padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const input: CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const cap: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)' };

export function FlujoEditor({ plantillaId }: { plantillaId: string }) {
  const [flujo, setFlujoState] = useState<Flujo | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const guardarT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch('/api/admin/plantillas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'flujo-get', id: plantillaId }) }).then((r) => r.json());
      // Toda plantilla es un flujo: si no tenía uno guardado, arrancamos con uno vacío
      // editable (activo — el on/off real es el toggle de la plantilla, no de acá).
      const f = (j?.ok && j.flujo) ? (j.flujo as Flujo) : { ...flujoVacio(), activo: true };
      setFlujoState(f);
    } finally { setLoading(false); }
  }, [plantillaId]);
  useEffect(() => { cargar(); }, [cargar]);

  // Guarda con debounce cada cambio (sin botón "Guardar": editás y se persiste solo).
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
  const addPaso = (p: Paso) => setFlujo({ ...flujo, pasos: [...flujo.pasos, p] });
  const delPaso = (i: number) => setFlujo({ ...flujo, pasos: flujo.pasos.filter((_, j) => j !== i) });
  const movePaso = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= flujo.pasos.length) return;
    const ps = [...flujo.pasos];[ps[i], ps[j]] = [ps[j], ps[i]]; setFlujo({ ...flujo, pasos: ps });
  };

  const dispTipo = flujo.disparador.tipo;
  const evento = dispTipo === 'evento' ? flujo.disparador.evento : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cuándo dispara */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={cap}>⚡ Cuándo se dispara</span>
          {flash && <span style={{ fontSize: 11.5, color: 'var(--good)', fontWeight: 600, marginLeft: 'auto' }}>{flash}</span>}
        </div>
        <Dropdown
          value={dispTipo === 'manual' ? 'manual' : `evento:${evento}`}
          options={[...EVENTOS.map((e) => ({ value: `evento:${e.key}`, label: e.label })), { value: 'manual', label: 'Manual (lo disparás vos)' }]}
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

      {/* Pasos — cada uno editable */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={cap}>Qué hace, paso a paso</span>
        {flujo.pasos.length === 0 && <div style={{ fontSize: 12, color: 'var(--faint)' }}>Sin pasos todavía. Agregá el primero abajo.</div>}
        {flujo.pasos.map((p, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: 'var(--faint)' }}>{i + 1}.</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{p.tipo === 'mensaje' ? (p.canal === 'aviso_dueno' ? 'Avisarte a vos' : 'WhatsApp al lead') : p.tipo === 'accion' ? 'Acción' : 'Esperar'}</span>
              <button aria-label="subir" onClick={() => movePaso(i, -1)} disabled={i === 0} style={{ ...btn, padding: '2px 7px', opacity: i === 0 ? 0.4 : 1 }}>↑</button>
              <button aria-label="bajar" onClick={() => movePaso(i, 1)} disabled={i === flujo.pasos.length - 1} style={{ ...btn, padding: '2px 7px', opacity: i === flujo.pasos.length - 1 ? 0.4 : 1 }}>↓</button>
              <button aria-label="quitar" onClick={() => delPaso(i)} style={{ ...btn, padding: '2px 7px', color: 'var(--bad)' }}>✕</button>
            </div>
            {p.tipo === 'mensaje' && (
              <>
                <div style={{ maxWidth: 220 }}>
                  <Dropdown value={p.canal} options={[{ value: 'aviso_dueno', label: 'Avisarte a vos' }, { value: 'wa_lead', label: 'WhatsApp al lead (con tu OK)' }]} onChange={(v) => setPaso(i, { ...p, canal: v as 'aviso_dueno' | 'wa_lead' })} />
                </div>
                <textarea value={p.texto} onChange={(e) => setPaso(i, { ...p, texto: e.target.value })} placeholder="El mensaje (MaKo lo adapta con los datos reales)…" rows={2} style={{ ...input, resize: 'vertical' }} />
              </>
            )}
            {p.tipo === 'accion' && (
              <div style={{ maxWidth: 260 }}>
                <Dropdown value={p.accion} options={[{ value: 'crear_tarea', label: 'Crear una tarea' }, { value: 'inscribir_nutricion', label: 'Inscribir en nutrición' }, { value: 'marcar_lead', label: 'Marcar el lead' }]} onChange={(v) => setPaso(i, { ...p, accion: v as never })} />
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 5 }}>Se propone y confirmás con un “sí” (nunca dispara solo).</div>
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
