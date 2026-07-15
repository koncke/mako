'use client';

// =============================================================================
// TemplateDetalleModal — detalle + edición + CRUD de una plantilla de aviso
// =============================================================================
// Cubre TODO el chat (inline). Explica CUÁNDO se dispara (diagrama), deja EDITAR
// la referencia, ACTIVAR/DESACTIVAR, ELIMINAR y CREAR. La referencia NO es un
// molde: "Probar con IA" muestra cómo MaKo la adapta con datos reales.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { FlujoEditor } from './FlujoEditor';
import { EMOJI_CATEGORIA, type AvisoCatalogo, type CategoriaAviso } from '@/lib/avisos-catalogo';

export type PlantillaVista = AvisoCatalogo & { enabled: boolean; esCustom: boolean };

const ORDEN: CategoriaAviso[] = ['reporte', 'aviso', 'accion', 'pregunta'];
const LABEL: Record<CategoriaAviso, string> = { reporte: 'Reporte', aviso: 'Aviso', accion: 'Acción', pregunta: 'Pregunta' };
const btn: CSSProperties = { padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, fontFamily: "'Geist', sans-serif", outline: 'none' };

async function api(body: unknown): Promise<{ ok: boolean; plantilla?: PlantillaVista; texto?: string; borrada?: boolean }> {
  try { return await (await fetch('/api/admin/plantillas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); } catch { return { ok: false }; }
}

export function TemplateDetalleModal({ plantilla, onClose, onCambio }: { plantilla: PlantillaVista | null; onClose: () => void; onCambio?: () => void }) {
  const crear = plantilla === null;
  const [titulo, setTitulo] = useState(plantilla?.titulo ?? '');
  const [categoria, setCategoria] = useState<CategoriaAviso>(plantilla?.categoria ?? 'aviso');
  const [requiereResp, setRequiereResp] = useState(plantilla?.requiereRespuesta ?? false);
  const [texto, setTexto] = useState(plantilla?.ejemplo ?? '');
  const [orig, setOrig] = useState(plantilla?.ejemplo ?? '');
  const [enabled, setEnabled] = useState(plantilla?.enabled ?? true);
  const [prueba, setPrueba] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const flashOk = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2200); };
  const id = plantilla?.id;

  const guardarTexto = async () => { if (!id) return; setBusy('save'); const r = await api({ action: 'texto', id, texto }); if (r.ok) { setOrig(texto); flashOk('Guardado ✓'); onCambio?.(); } setBusy(null); };
  const toggle = async () => { if (!id) return; setBusy('toggle'); const r = await api({ action: 'enabled', id, enabled: !enabled }); if (r.ok) { setEnabled(!enabled); flashOk(!enabled ? 'Activada ✓' : 'Desactivada ✓'); onCambio?.(); } setBusy(null); };
  const eliminar = async () => { if (!id) return; setBusy('del'); const r = await api({ action: 'borrar', id }); if (r.ok) { onCambio?.(); onClose(); } setBusy(null); };
  const probar = async () => { if (!id) return; setBusy('probar'); const r = await api({ action: 'probar', id }); if (r.ok && r.texto) setPrueba(r.texto); setBusy(null); };
  const crearNueva = async () => {
    setBusy('crear');
    const r = await api({ action: 'crear', titulo, categoria, requiereRespuesta: requiereResp, texto });
    if (r.ok) { onCambio?.(); onClose(); }
    setBusy(null);
  };

  return (
    <div style={{ height: 620, width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Topbar fija (no scrollea) */}
      <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onClose} title="Volver" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', fontSize: 14, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>← Volver</button>
        {/* Solo "Eliminar" para las personalizadas. El on/off de las del catálogo es
            el toggle de abajo (no repetimos "Desactivar" acá). */}
        {!crear && id && plantilla?.esCustom && <button onClick={eliminar} disabled={busy === 'del'} style={{ background: 'none', border: 'none', color: 'var(--bad)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {crear ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>Nueva plantilla</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ej. Recordar renovación)" style={inp} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Dropdown value={categoria} onChange={(v) => setCategoria(v as CategoriaAviso)} width={180} ariaLabel="Categoría" options={ORDEN.map((k) => ({ value: k, label: `${EMOJI_CATEGORIA[k]} ${LABEL[k]}` }))} />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--dim)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={requiereResp} onChange={(e) => setRequiereResp(e.target.checked)} /> Espera respuesta
                </label>
              </div>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} placeholder="Referencia del mensaje (MaKo la adapta con datos reales)…" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={crearNueva} disabled={busy === 'crear' || !titulo.trim()} style={{ ...btn, opacity: busy === 'crear' || !titulo.trim() ? 0.5 : 1 }}>Crear plantilla</button>
            </div>
          </>
        ) : plantilla ? (
          <>
            <div style={{ display: 'flex', gap: 11, alignItems: 'center', minWidth: 0, marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{EMOJI_CATEGORIA[plantilla.categoria]}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{plantilla.titulo}</div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{EMOJI_CATEGORIA[plantilla.categoria]} {LABEL[plantilla.categoria]}{plantilla.esCustom ? ' · personalizada' : ''}</div>
              </div>
              <div style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: enabled ? 'var(--good)' : 'var(--dim)' }}>{enabled ? 'Activa' : 'Inactiva'}</span>
                <button onClick={toggle} disabled={busy === 'toggle'} aria-pressed={enabled} title={enabled ? 'Desactivar' : 'Activar'}
                  style={{ width: 42, height: 24, borderRadius: 999, border: 'none', padding: 2, background: enabled ? 'var(--good)' : 'var(--border-strong)', cursor: 'pointer', flex: 'none', transition: 'background .15s' }}>
                  <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: enabled ? 'translateX(18px)' : 'none', transition: 'transform .15s' }} />
                </button>
              </div>
            </div>

            {/* El flujo se edita DIRECTO (no hay "convertir en flujo": ya es uno). */}
            <div style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 12, padding: '16px 16px', background: 'var(--surface-2)' }}>
              {id ? <FlujoEditor plantillaId={id} /> : <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Guardá la plantilla para editar su flujo.</div>}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 15, flex: 'none' }}>🧠</span>
                <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.45 }}>Cuando dispara, MaKo <b>escribe cada mensaje con IA</b> (usa la referencia de abajo + los datos reales del evento) y te llega al grupo de WhatsApp.{plantilla.requiereRespuesta ? ' Espera tu OK para seguir.' : ''}</div>
              </div>
            </div>

            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>Referencia (MaKo la usa como guía, no literal)</div>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={7} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />

            {prueba && (
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-strong)', marginBottom: 5 }}>✨ MaKo lo escribiría así:</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{prueba}</div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              {flash && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--good)', marginRight: 'auto' }}>{flash}</span>}
              <button onClick={probar} disabled={busy === 'probar'} style={{ ...btnGhost, opacity: busy === 'probar' ? 0.6 : 1 }}>{busy === 'probar' ? 'Generando…' : '✨ Probar con IA'}</button>
              <button onClick={guardarTexto} disabled={busy === 'save' || texto === orig} style={{ ...btn, opacity: busy === 'save' || texto === orig ? 0.5 : 1 }}>Guardar</button>
            </div>
          </>
        ) : null}
        </div>
      </div>
    </div>
  );
}
