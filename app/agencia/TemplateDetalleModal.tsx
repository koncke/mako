'use client';

// =============================================================================
// TemplateDetalleModal — detalle + edición + CRUD de una plantilla de aviso
// =============================================================================
// Cubre TODO el chat (inline). Explica CUÁNDO se dispara (diagrama), deja EDITAR
// la referencia, ACTIVAR/DESACTIVAR, ELIMINAR y CREAR. La referencia NO es un
// molde: "Probar con IA" muestra cómo MaKo la adapta con datos reales.

import { useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { Recordatorios } from './Recordatorios';
import { Disparador } from './Disparador';
import { EditorMensaje } from './EditorMensaje';
import { PrefsDeMensaje } from '../perfil/PrefsDeMensaje';
import { EMOJI_CATEGORIA, type AvisoCatalogo, type CategoriaAviso } from '@/lib/avisos-catalogo';

// El tipo NO se copia: se re-exporta del store, que es quien lo define. Escrito a
// mano acá se quedo viejo al primer campo nuevo (`canales`) y el compilador no podia
// decir nada, porque las dos formas seguian siendo validas por separado. `import type`
// se borra en compilacion, asi que traerlo de un modulo `server-only` no baja una sola
// linea al navegador.
// Un `export ... from` no crea binding local y el propio archivo deja de compilar:
// van los dos, el import y el re-export.
import type { PlantillaVista } from '@/lib/plantillas';
export type { PlantillaVista };

const ORDEN: CategoriaAviso[] = ['reporte', 'aviso', 'accion', 'pregunta'];
const LABEL: Record<CategoriaAviso, string> = { reporte: 'Reporte', aviso: 'Aviso', accion: 'Acción', pregunta: 'Pregunta' };
const btn: CSSProperties = { padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, fontFamily: "'Geist', sans-serif", outline: 'none' };

/**
 * El endpoint entra por parámetro porque esta misma pantalla sirve a DOS dueños:
 * el super-admin de la agencia (`/api/admin/plantillas`) y el admin de un
 * workspace desde Configuraciones › Notificaciones (`/api/perfil/plantillas`).
 * Mismo protocolo, distinto guard — copiar el componente para cambiar una URL
 * dejaría dos pantallas que divergen en la primera edición.
 */
/** El endpoint del super-admin. Quien no lo usa, es un cliente en su propia tab. */
const ENDPOINT_AGENCIA = '/api/admin/plantillas';

async function api(endpoint: string, body: unknown): Promise<{ ok: boolean; error?: string; plantilla?: PlantillaVista; texto?: string; borrada?: boolean }> {
  try { return await (await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); } catch { return { ok: false }; }
}

/**
 * ⚠️ `alto` y `marco` existen porque este panel se monta en DOS sitios con forma
 * distinta: como panel derecho del chat de /mensajes (una tarjeta de 620 con su
 * borde) y adentro de la celda de la bandeja de email, donde el borde y el radio
 * ya los pone la caja de afuera — una tarjeta adentro de otra deja doble marco y
 * scroll anidado. Son dos props y no un `embebido` porque son dos decisiones: el
 * alto lo manda la fila del grid, y el marco, quién lo dibuja.
 */
export function TemplateDetalleModal({ plantilla, onClose, onCambio, endpoint = ENDPOINT_AGENCIA, alto = 620, marco = true }: {
  plantilla: PlantillaVista | null; onClose: () => void; onCambio?: () => void; endpoint?: string;
  alto?: number | string; marco?: boolean;
}) {
  const crear = plantilla === null;
  const [titulo, setTitulo] = useState(plantilla?.titulo ?? '');
  const [categoria, setCategoria] = useState<CategoriaAviso>(plantilla?.categoria ?? 'aviso');
  const [requiereResp, setRequiereResp] = useState(plantilla?.requiereRespuesta ?? false);
  const [texto, setTexto] = useState(plantilla?.ejemplo ?? '');
  const [orig, setOrig] = useState(plantilla?.ejemplo ?? '');
  const [enabled, setEnabled] = useState(plantilla?.enabled ?? true);
  const [prueba, setPrueba] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ txt: string; mal: boolean } | null>(null);

  // ⚠️ EL ERROR NO PUEDE SALIR EN VERDE. Esto servía a las dos cosas y el span de
  // abajo estaba cableado a `var(--good)`, así que el 403 de un aviso que MaKo
  // redacta se leía como un guardado. Un rechazo pintado de «hecho» es peor que
  // ninguno: nadie vuelve a mirar.
  const flashOk = (m: string) => { setFlash({ txt: m, mal: false }); setTimeout(() => setFlash(null), 2200); };
  const flashMal = (m: string) => { setFlash({ txt: m, mal: true }); setTimeout(() => setFlash(null), 4000); };
  const id = plantilla?.id;

  // ⚠️ El `else` no es decoración: la ruta del cliente contesta 403 para todo aviso
  // que redacta MaKo, y sin esta rama «Guardar» no decía NADA — el síntoma exacto que
  // esta pantalla viene arrastrando desde el primer reporte del cliente.
  const guardarTexto = async () => {
    if (!id) return;
    setBusy('save');
    const r = await api(endpoint, { action: 'texto', id, texto });
    if (r.ok) { setOrig(texto); flashOk('Guardado ✓'); onCambio?.(); }
    else flashMal(r.error || 'No se pudo guardar');
    setBusy(null);
  };
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
    <div style={{ height: alto, width: '100%', background: 'var(--surface)', border: marco ? '1px solid var(--border)' : 'none', borderRadius: marco ? 16 : 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Topbar fija (no scrollea) */}
      <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        {/* Dice lo que HACE, no a dónde lleva: embebido en la bandeja, la lista de la
            izquierda nunca se fue, así que «Volver» prometía una navegación que no pasa. */}
        <button onClick={onClose} title="Cerrar el editor" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', fontSize: 14, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>← Cerrar el editor</button>
        {/* ⚠️ SÓLO ELIMINAR, y sólo una custom. Antes este botón decía «Desactivar» para
            las built-in y llamaba a `borrar`, que apaga por un camino SIN el guard de
            `porDefecto: 'siempre'` que sí tiene `setEnabledPlantilla`: para un aviso fijo
            la pantalla dibujaba «Siempre activa» y 40px más arriba había un botón que lo
            apagaba igual. Apagar se hace con el interruptor de abajo, que es el que sabe
            cuáles no se pueden apagar. */}
        {!crear && id && plantilla.esCustom && <button onClick={eliminar} disabled={busy === 'del'} style={{ background: 'none', border: 'none', color: 'var(--bad)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>}
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

            {/*
              EL PRIMER PASO ES EL DISPARADOR, y desde el 29/09/2026 se configura.

              Estuvo en prosa una tanda, y el pedido volvió: «el "Qué lo dispara" NO es
              editable». Lo que se abrió es la mitad que sí es una decisión —CADA CUÁNTO,
              como máximo—; el hecho que lo produce sigue siendo un hecho. El porqué de
              ese corte, con la medición de los call sites, está en <Disparador>.
            */}
            {id && (
              <Disparador
                id={id}
                disparador={plantilla.disparador}
                frecuenciaMin={plantilla.frecuenciaMin}
                endpoint={endpoint}
                onCambio={onCambio}
              />
            )}
            <div style={{ marginBottom: 18 }}>
              {id && <Recordatorios plantillaId={id} endpoint={endpoint} porWhatsApp={plantilla.canales.wa} />}
            </div>

            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8 }}>El mensaje</div>
            <EditorMensaje valor={texto} onChange={setTexto} filas={7} disabled={busy === 'save'} />

            {prueba && (
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-strong)', marginBottom: 5 }}>✨ MaKo lo escribiría así:</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{prueba}</div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              {flash && <span style={{ fontSize: 13, fontWeight: 600, color: flash.mal ? 'var(--bad)' : 'var(--good)', marginRight: 'auto' }}>{flash.txt}</span>}
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
