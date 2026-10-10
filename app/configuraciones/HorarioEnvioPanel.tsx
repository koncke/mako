'use client';

// =============================================================================
// HorarioEnvioPanel — el horario OPCIONAL en que las automatizaciones le escriben a alguien
// =============================================================================
// Pedido de Martín (09/10/2026, sobre el DELAY): «SI es que configuraste un "Horario de oficina"
// no deberías hacerlo... Eso se hace en todo caso en configuraciones, no aquí. No pongas esa
// limitación». Y su respuesta del mismo día: «Sin límite, editable».
//
// Por defecto viene APAGADO: las esperas se cumplen a su hora exacta, de día o de noche. Prendido,
// el motor no manda fuera de horario y lo que vence afuera sale al abrir. Las reglas viven en
// lib/horario-envio.ts; esto sólo las dibuja. El texto que se dibuja es corto a propósito
// (AGENTS.md, «La pantalla dice QUÉ pasó»).

import { useEffect, useState, type CSSProperties } from 'react';
import { Dropdown } from '@/app/components/Dropdown';
import { getHorarioEnvioAction, saveHorarioEnvioAction } from './horario-actions';
import { DIAS_PANTALLA, horaTexto, type HorarioEnvio, type DiaSemana } from '@/lib/horario-envio';

const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const primaryBtn: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };

const DESDE = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: horaTexto(h) }));
const HASTA = Array.from({ length: 24 }, (_, i) => ({ value: String(i + 1), label: horaTexto(i + 1) }));

/**
 * Las dos props son OPCIONALES y Configuraciones › Horario no pasa ninguna: ahí el panel es la pantalla
 * y se queda idéntico. Las usa quien lo monta ADENTRO de otra cosa (el panel anclado de Automations,
 * app/automations/HorarioLista.tsx):
 *   · `onGuardado` — justo después de guardar bien, con el horario guardado: el botón de afuera se pone
 *     al día sin esperar a que se cierre el panel (antes miraba que apareciera «Guardado» en el DOM);
 *   · `onSucio` — si hay cambios sin guardar: un panel anclado que se cierra con un clic afuera tiraba lo
 *     que se estaba editando, y con esto se queda abierto.
 */
export function HorarioEnvioPanel({ onGuardado, onSucio }: {
  onGuardado?: (h: HorarioEnvio) => void;
  onSucio?: (sucio: boolean) => void;
}) {
  const [h, setH] = useState<HorarioEnvio | null>(null);
  const [zona, setZona] = useState('');
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  // Lo guardado, para saber si hay cambios. Un «Guardar» que se puede apretar sobre lo mismo que ya
  // está guardado no dice nada de si hay algo por hacer. Es ESTADO y no un ref (10/10/2026): «sucio» se
  // calcula al dibujar y alimenta el efecto de `onSucio`, y un ref leído al dibujar no hace redibujar
  // (react-hooks/refs). Se escribe en el mismo tick que `h`, así que React los junta en un render.
  const [guardado, setGuardado] = useState('');

  useEffect(() => {
    let vivo = true;
    getHorarioEnvioAction()
      .then((d) => { if (!vivo) return; setH(d.horario); setZona(d.zona); setPuedeEditar(d.puedeEditar); setGuardado(JSON.stringify(d.horario)); })
      .catch(() => { if (vivo) setAviso('No pude leer el horario.'); });
    return () => { vivo = false; };
  }, []);

  // ⚠️ ANTES DEL `return` de abajo, con el horario todavía sin leer: un hook detrás de un return temprano
  // se llama en unos renders y en otros no (AGENTS.md, el «Minified React error #300»). Sin leer no hay
  // nada que perder, así que no está sucio.
  const sucio = h != null && JSON.stringify(h) !== guardado;
  useEffect(() => { onSucio?.(sucio); }, [sucio, onSucio]);

  if (!h) return <p style={{ fontSize: 13.5, color: aviso ? 'var(--bad)' : 'var(--dim)', fontFamily: SANS }}>{aviso || 'Cargando…'}</p>;

  const cambiar = (patch: Partial<HorarioEnvio>) => { setH({ ...h, ...patch }); setAviso(''); };
  const invalido = h.activo && (h.hasta <= h.desde || !h.dias.length);
  const alternarDia = (d: DiaSemana) => cambiar({ dias: h.dias.includes(d) ? h.dias.filter((x) => x !== d) : [...h.dias, d].sort((a, b) => a - b) });

  async function guardar() {
    if (!h) return;
    setGuardando(true);
    setAviso('');
    const r = await saveHorarioEnvioAction(h).catch(() => ({ ok: false, error: 'No se pudo guardar.' } as const));
    setGuardando(false);
    if (!r.ok) { setAviso(r.error || 'No se pudo guardar.'); return; }
    const quedo = ('horario' in r && r.horario) ? r.horario : h;
    setH(quedo);
    setGuardado(JSON.stringify(quedo));
    setAviso('Guardado');
    onGuardado?.(quedo);
  }

  const off = !puedeEditar;
  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 18px', fontFamily: SANS }}>
        Tus automatizaciones mandan a cualquier hora. Si quieres, ponles un horario.
      </p>
      <div style={card}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: off ? 'default' : 'pointer', fontFamily: SANS }}>
          <input type="checkbox" checked={h.activo} disabled={off} onChange={(e) => cambiar({ activo: e.target.checked })}
            aria-label="Limitar el horario" style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Limitar el horario</span>
        </label>

        {h.activo && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: SANS, fontSize: 14, color: 'var(--ink)' }}>
              <span>De</span>
              <Dropdown value={String(h.desde)} options={DESDE} width={110} ariaLabel="Desde" disabled={off} onChange={(v) => cambiar({ desde: Number(v) })} />
              <span>a</span>
              <Dropdown value={String(h.hasta)} options={HASTA} width={110} ariaLabel="Hasta" disabled={off} onChange={(v) => cambiar({ hasta: Number(v) })} />
            </div>
            <div role="group" aria-label="Días" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DIAS_PANTALLA.map((d) => {
                const on = h.dias.includes(d.dia);
                return (
                  <button key={d.dia} type="button" disabled={off} aria-pressed={on} aria-label={d.nombre} title={d.nombre} onClick={() => alternarDia(d.dia)}
                    style={{
                      width: 38, height: 38, borderRadius: '50%', fontFamily: SANS, fontSize: 13.5, fontWeight: 700,
                      border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`,
                      background: on ? 'var(--primary)' : 'var(--surface)', color: on ? '#fff' : 'var(--dim)',
                      cursor: off ? 'default' : 'pointer',
                    }}>{d.corto}</button>
                );
              })}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--dim)', fontFamily: SANS }}>
              Lo que vence afuera sale al abrir. Hora de {zona}.
            </p>
          </div>
        )}

        {puedeEditar && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
            <button type="button" onClick={guardar} disabled={guardando || !sucio || invalido}
              style={{ ...primaryBtn, opacity: guardando || !sucio || invalido ? 0.45 : 1, cursor: guardando || !sucio || invalido ? 'default' : 'pointer' }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            {invalido && <span style={{ fontSize: 13, color: 'var(--bad)', fontFamily: SANS }}>{h.dias.length ? 'Cierra antes de abrir.' : 'Elige al menos un día.'}</span>}
            {aviso && <span style={{ fontSize: 13, color: aviso === 'Guardado' ? 'var(--good)' : 'var(--bad)', fontFamily: SANS }}>{aviso}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
