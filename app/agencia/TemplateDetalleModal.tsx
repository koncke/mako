'use client';

// =============================================================================
// TemplateDetalleModal — detalle + edición + CRUD de una plantilla de aviso
// =============================================================================
// Cubre TODO el chat (inline). Explica CUÁNDO se dispara (diagrama), deja EDITAR
// la referencia, ACTIVAR/DESACTIVAR, ELIMINAR y CREAR. La referencia NO es un
// molde: "Probar con IA" muestra cómo MaKo la adapta con datos reales.

import { useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { FlujoEditor } from './FlujoEditor';
import { PrefsDeMensaje } from '../perfil/PrefsDeMensaje';
import { EMOJI_CATEGORIA, type AvisoCatalogo, type CategoriaAviso } from '@/lib/avisos-catalogo';

export type PlantillaVista = AvisoCatalogo & { enabled: boolean; esCustom: boolean; fijo: boolean };

const ORDEN: CategoriaAviso[] = ['reporte', 'aviso', 'accion', 'pregunta'];
const LABEL: Record<CategoriaAviso, string> = { reporte: 'Reporte', aviso: 'Aviso', accion: 'Acción', pregunta: 'Pregunta' };
const btn: CSSProperties = { padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, fontFamily: "'Geist', sans-serif", outline: 'none' };

function Paso({ icono, titulo, detalle, tono = 'neutro' }: { icono: string; titulo: string; detalle?: string; tono?: 'neutro' | 'mako' | 'dueno' }) {
  const bg = tono === 'mako' ? 'var(--primary-bg)' : 'var(--surface-2)';
  const bd = tono === 'mako' ? 'var(--primary-weak)' : 'var(--border)';
  return (
    <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 12, background: bg, border: `1px solid ${bd}` }}>
      <span style={{ fontSize: 18, flex: 'none', lineHeight: 1.2 }}>{icono}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{titulo}</div>
        {detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.45 }}>{detalle}</div>}
      </div>
    </div>
  );
}
const Flecha = () => <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--faint)', fontSize: 14, margin: '2px 0' }}>↓</div>;

/**
 * El endpoint entra por parámetro porque esta misma pantalla sirve a DOS dueños:
 * el super-admin de la agencia (`/api/admin/plantillas`) y el admin de un
 * workspace desde Configuraciones › Notificaciones (`/api/perfil/plantillas`).
 * Mismo protocolo, distinto guard — copiar el componente para cambiar una URL
 * dejaría dos pantallas que divergen en la primera edición.
 */
/** El endpoint del super-admin. Quien no lo usa, es un cliente en su propia tab. */
const ENDPOINT_AGENCIA = '/api/admin/plantillas';

async function api(endpoint: string, body: unknown): Promise<{ ok: boolean; plantilla?: PlantillaVista; texto?: string; borrada?: boolean }> {
  try { return await (await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); } catch { return { ok: false }; }
}

export function TemplateDetalleModal({ plantilla, onClose, onCambio, endpoint = ENDPOINT_AGENCIA }: { plantilla: PlantillaVista | null; onClose: () => void; onCambio?: () => void; endpoint?: string }) {
  const crear = plantilla === null;
  // Administrativo + no es la agencia = se lee, no se edita.
  const soloLectura = plantilla?.soloSuperAdmin === true && endpoint !== ENDPOINT_AGENCIA;
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

  const guardarTexto = async () => { if (!id) return; setBusy('save'); const r = await api(endpoint, { action: 'texto', id, texto }); if (r.ok) { setOrig(texto); flashOk('Guardado ✓'); onCambio?.(); } setBusy(null); };
  const toggle = async () => { if (!id) return; setBusy('toggle'); const r = await api(endpoint, { action: 'enabled', id, enabled: !enabled }); if (r.ok) { setEnabled(!enabled); flashOk(!enabled ? 'Activada ✓' : 'Desactivada ✓'); onCambio?.(); } setBusy(null); };
  const eliminar = async () => { if (!id) return; setBusy('del'); const r = await api(endpoint, { action: 'borrar', id }); if (r.ok) { onCambio?.(); onClose(); } setBusy(null); };
  const probar = async () => { if (!id) return; setBusy('probar'); const r = await api(endpoint, { action: 'probar', id }); if (r.ok && r.texto) setPrueba(r.texto); setBusy(null); };
  const crearNueva = async () => {
    setBusy('crear');
    const r = await api(endpoint, { action: 'crear', titulo, categoria, requiereRespuesta: requiereResp, texto });
    if (r.ok) { onCambio?.(); onClose(); }
    setBusy(null);
  };

  return (
    <div style={{ height: 620, width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Topbar fija (no scrollea) */}
      <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onClose} title="Volver" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', fontSize: 14, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>← Volver</button>
        {!crear && id && <button onClick={eliminar} disabled={busy === 'del'} style={{ background: 'none', border: 'none', color: 'var(--bad)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{plantilla.esCustom ? 'Eliminar' : 'Desactivar'}</button>}
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
                {/* Un mensaje FIJO no ofrece el switch: es el que avisa que MaKo se
                    quedó sin datos, y un botón que no hace nada es peor que ninguno.
                    Se dice POR QUÉ, en vez de dejar un control gris sin explicación. */}
                {plantilla?.fijo ? (
                  <span title="Este avisa que MaKo dejó de recibir datos: si se apaga, el resto de los números miente sin que nadie se entere."
                    style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--dim)' }}>
                    Siempre activa
                  </span>
                ) : (
                <>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: enabled ? 'var(--good)' : 'var(--dim)' }}>{enabled ? 'Activa' : 'Inactiva'}</span>
                <button onClick={toggle} disabled={busy === 'toggle'} aria-pressed={enabled} title={enabled ? 'Desactivar' : 'Activar'}
                  style={{ width: 42, height: 24, borderRadius: 999, border: 'none', padding: 2, background: enabled ? 'var(--good)' : 'var(--border-strong)', cursor: 'pointer', flex: 'none', transition: 'background .15s' }}>
                  <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: enabled ? 'translateX(18px)' : 'none', transition: 'transform .15s' }} />
                </button>
                </>
                )}
              </div>
            </div>

            {/* Lo que se configura de ESTE mensaje y no vive en su plantilla: por qué
                canal sale un reporte, qué trae adentro, y si los no urgentes esperan
                al resumen. Estaba en tres secciones sueltas de Configuraciones, cada
                una hablando de un mensaje que estaba en otra lista. */}
            {id && <PrefsDeMensaje id={id} />}

            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', margin: '20px 0 10px' }}>¿Cuándo se dispara?</div>
            <div style={{ marginBottom: 20 }}>
              <Paso icono="⚡" titulo="Se dispara cuando…" detalle={plantilla.disparador} />
              <Flecha />
              <Paso icono="🧠" titulo="MaKo lo detecta y ESCRIBE con IA" detalle="Toma esta referencia + los datos reales del evento y redacta el mensaje (libre de adaptarlo)." tono="mako" />
              <Flecha />
              <Paso icono="💬" titulo="Te llega al grupo de WhatsApp + al feed" tono="mako" />
              {plantilla.requiereRespuesta && (<><Flecha /><Paso icono="🙋" titulo="Tú respondes" detalle="Espera tu OK/respuesta para seguir." tono="dueno" /><Flecha /><Paso icono="✅" titulo="MaKo actúa y te confirma" tono="mako" /></>)}
            </div>

            {id && (
              <details style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', background: 'var(--surface-2)' }}>
                <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', listStyle: 'none' }}>⚙️ Editar el flujo (avanzado) — disparador + pasos</summary>
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <FlujoEditor plantillaId={id} endpoint={endpoint} />
                </div>
              </details>
            )}

            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>
              {soloLectura ? 'Lo que dice' : 'Referencia (MaKo la usa como guía, no literal)'}
            </div>
            {soloLectura ? (
              // Se muestra igual —el cliente tiene que poder LEER lo que sale en su
              // nombre— pero no se edita: es un hecho técnico y lo que vale es que
              // diga exactamente qué pasó. El guard de verdad está en el servidor.
              <>
                <div style={{ ...inp, whiteSpace: 'pre-wrap', lineHeight: 1.5, background: 'var(--surface-2)', color: 'var(--dim)', minHeight: 80 }}>{texto}</div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 7, lineHeight: 1.45 }}>
                  Este lo redacta MaKo y no se edita: avisa algo técnico y tiene que decir exactamente lo que pasó. Sí puedes elegir si te llega.
                </div>
              </>
            ) : (
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={7} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
            )}

            {prueba && (
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-strong)', marginBottom: 5 }}>✨ MaKo lo escribiría así:</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{prueba}</div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              {flash && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--good)', marginRight: 'auto' }}>{flash}</span>}
              {!soloLectura && (
                <>
                  <button onClick={probar} disabled={busy === 'probar'} style={{ ...btnGhost, opacity: busy === 'probar' ? 0.6 : 1 }}>{busy === 'probar' ? 'Generando…' : '✨ Probar con IA'}</button>
                  <button onClick={guardarTexto} disabled={busy === 'save' || texto === orig} style={{ ...btn, opacity: busy === 'save' || texto === orig ? 0.5 : 1 }}>Guardar</button>
                </>
              )}
            </div>
          </>
        ) : null}
        </div>
      </div>
    </div>
  );
}
