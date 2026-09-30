'use client';

// =============================================================================
// TemplateDetalleModal — detalle + edición + CRUD de una plantilla de aviso
// =============================================================================
// Cubre TODO el chat (inline). Explica CUÁNDO se dispara (diagrama), deja EDITAR
// la referencia, ACTIVAR/DESACTIVAR, ELIMINAR y CREAR. La referencia NO es un
// molde: "Probar con IA" muestra cómo MaKo la adapta con datos reales.

import { useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { FlujoAviso } from './FlujoAviso';
import { PrefsDeMensaje } from '../perfil/PrefsDeMensaje';
import { EMOJI_CATEGORIA, esAvisoDelCliente, type AvisoCatalogo, type CategoriaAviso } from '@/lib/avisos-catalogo';

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
/** Las tarjetas del chrome FLOTANTE: fondo propio para leerse sobre el punteado
 *  del lienzo, y el mismo radio que el resto de la casa. */
const tarjetaChrome: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11,
  padding: '7px 12px', boxShadow: '0 2px 8px rgba(0,0,0,.06)',
};
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
  // ⚠️ EL MISMO CORTE QUE HACE EL SERVER, para no ofrecer un editor que va a
  // contestar 403. El que decide sigue siendo la ruta —esconder el campo no
  // protege nada— pero un textarea que rechaza todo lo que se escriba es peor que
  // no tenerlo: se lee como que la app está rota, no como que no te corresponde.
  const puedeEditarTexto = endpoint === ENDPOINT_AGENCIA || (id != null && esAvisoDelCliente(id));

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
      {crear ? (
        <>
          <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <button onClick={onClose} title="Cerrar el editor" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', fontSize: 14, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>← Cerrar el editor</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24 }}>
            <div style={{ maxWidth: 560 }}>
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
            </div>
          </div>
        </>
      ) : plantilla && id ? (
        /* ⚠️ EL LIENZO ES EL RECUADRO. Pedido textual: «cuando le doy a editar, el
           lienzo tiene que ocupar absolutamente todo el recuadro, incluso donde dice
           «cerrar el editor», de lo contrario se ve muy chico».

           Antes eran topbar + cabecera + lienzo + pie, y entre las tres le comían ~180
           px de 620: el dibujo entraba al 33% y las tarjetas eran del tamaño de una
           uña. Ahora todo eso FLOTA encima, incluido «Guardar» — que además asomaba
           por detrás del dibujo: «hay un botón azul detrás del lienzo, no tiene
           sentido». */
        <FlujoAviso
          id={id}
          disparador={plantilla.disparador}
          frecuenciaMin={plantilla.frecuenciaMin}
          texto={texto}
          canales={plantilla.canales}
          posiciones={plantilla.posiciones}
          endpoint={endpoint}
          editable={puedeEditarTexto}
          guardando={busy === 'save'}
          onTexto={setTexto}
          onCambio={onCambio}
          probando={busy === 'probar'}
          prueba={prueba}
          onProbar={probar}
          chrome={(
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={onClose} title="Cerrar el editor" style={{ ...tarjetaChrome, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer' }}>← Cerrar el editor</button>
                <div style={{ ...tarjetaChrome, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{plantilla.titulo}</div>
                  <div style={{ fontSize: 11, color: 'var(--faint)' }}>{EMOJI_CATEGORIA[plantilla.categoria]} {LABEL[plantilla.categoria]}{plantilla.esCustom ? ' · personalizada' : ''}</div>
                </div>
                <div style={{ ...tarjetaChrome, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {/* Un mensaje FIJO no ofrece el switch: es el que avisa que MaKo se
                      quedó sin datos, y un botón que no hace nada es peor que ninguno. */}
                  {plantilla.fijo ? (
                    <span title="Este avisa que MaKo dejó de recibir datos: si se apaga, el resto de los números miente sin que nadie se entere."
                      style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)' }}>Siempre activa</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 12, fontWeight: 600, color: enabled ? 'var(--good)' : 'var(--dim)' }}>{enabled ? 'Activa' : 'Inactiva'}</span>
                      <button onClick={toggle} disabled={busy === 'toggle'} aria-pressed={enabled} title={enabled ? 'Desactivar' : 'Activar'}
                        style={{ width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, background: enabled ? 'var(--good)' : 'var(--border-strong)', cursor: 'pointer', flex: 'none', transition: 'background .15s' }}>
                        <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: enabled ? 'translateX(16px)' : 'none', transition: 'transform .15s' }} />
                      </button>
                    </>
                  )}
                </div>
                {id && <PrefsDeMensaje id={id} estilo={tarjetaChrome} />}
                <div style={{ ...tarjetaChrome, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {flash && <span style={{ fontSize: 12.5, fontWeight: 600, color: flash.mal ? 'var(--bad)' : 'var(--good)' }}>{flash.txt}</span>}
                  <button onClick={guardarTexto} disabled={busy === 'save' || texto === orig}
                    style={{ ...btn, padding: '6px 14px', fontSize: 12.5, opacity: busy === 'save' || texto === orig ? 0.45 : 1 }}>
                    {busy === 'save' ? 'Guardando…' : 'Guardar'}
                  </button>
                  {plantilla.esCustom && (
                    <button onClick={eliminar} disabled={busy === 'del'}
                      style={{ background: 'none', border: 'none', color: 'var(--bad)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Eliminar</button>
                  )}
                </div>
              </div>
          )}
        />
      ) : null}
    </div>
  );
}
