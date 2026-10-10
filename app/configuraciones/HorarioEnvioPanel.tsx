'use client';

// =============================================================================
// HorarioEnvioPanel — el HORARIO DE OFICINA: cuándo las automatizaciones le escriben a alguien
// =============================================================================
// Pedido de Martín (09/10/2026, sobre el DELAY): «SI es que configuraste un "Horario de oficina"
// no deberías hacerlo... Eso se hace en todo caso en configuraciones, no aquí. No pongas esa
// limitación». Y su respuesta del mismo día: «Sin límite, editable».
//
// Y el 10/10/2026, textual: «En lugar de "Limitar horario", que el título sea "Horario de oficina".
// Elimina el texto "Tus automatizaciones mandan a cualquier hora. Si quieres, ponles un horario." y que
// en lugar de un check, que sea el típico desplegable de on off para prender el horario de oficina.
// Elimina "Lo que vence afuera sale al abrir. Hora de America/Mexico_City." y que eso se configure
// también allí mismo, el huso horario, en la misma fila donde se configura la hora... Las horas debes
// ponerlas de media en media hora... y elimina el botón de guardar, si se hace un cambio ya se debe
// quedar guardado, para eso ya tenemos el botón de on off.»
//
// Por defecto viene APAGADO: las esperas se cumplen a su hora exacta, de día o de noche. Prendido,
// el motor no manda fuera de horario y lo que vence afuera sale al abrir. Las reglas viven en
// lib/horario-envio.ts; esto sólo las dibuja.
//
// ⚠️ SE GUARDA SOLO, CADA CAMBIO. Lo que no cierra (el cierre antes de la apertura, ningún día) NO se
// guarda: se dice al lado y lo de antes sigue mandando. Mientras un guardado está en vuelo, el panel
// está «sucio» (`onSucio`): el panel anclado de Automations no se cierra con un clic afuera.
//
// ⚠️ EL HUSO ES EL DEL NEGOCIO (`mako.timezone`), no uno del horario: lo lee el motor para todo. Por eso
// se guarda con su propia acción (`saveZonaHorarioAction`).

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dropdown } from '@/app/components/Dropdown';
import { getHorarioEnvioAction, saveHorarioEnvioAction, saveZonaHorarioAction } from './horario-actions';
import { DIAS_PANTALLA, horaTexto, MEDIAS_HORAS_DESDE, MEDIAS_HORAS_HASTA, HORARIO_SUGERIDO, type HorarioEnvio, type DiaSemana } from '@/lib/horario-envio';
import { ZONAS_POR_PAIS } from '@/lib/disparadores';
import { PAISES, flagUrl } from '@/lib/paises';

const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 };

const DESDE = MEDIAS_HORAS_DESDE.map((h) => ({ value: String(h), label: horaTexto(h), icono: 'reloj' as const }));
const HASTA = MEDIAS_HORAS_HASTA.map((h) => ({ value: String(h), label: horaTexto(h), icono: 'reloj' as const }));

/** Los husos que se ofrecen: los de la lista de países del teléfono, con su bandera (como el Recurrente). */
function opcionesDeZona(actual: string) {
  const out: Array<{ value: string; label: string; avatar?: string; avatarCuadrado?: boolean }> = [];
  for (const p of PAISES) {
    const zonas = ZONAS_POR_PAIS[p.iso2] ?? [];
    for (const z of zonas) out.push({ value: z.tz, label: zonas.length > 1 ? `${p.nombre} · ${z.label}` : p.nombre, avatar: flagUrl(p.iso2), avatarCuadrado: true });
  }
  // La que está puesta entra aunque no sea de la lista (AGENTS.md: el `<select>` que borra datos).
  if (actual && !out.some((o) => o.value === actual)) out.unshift({ value: actual, label: actual });
  return out;
}

/** El interruptor de la casa (el de «Activar» de una automatización). */
function Interruptor({ on, disabled, onCambio, etiqueta }: { on: boolean; disabled?: boolean; onCambio: (v: boolean) => void; etiqueta: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={etiqueta} title={etiqueta} disabled={disabled} onClick={() => onCambio(!on)}
      style={{ width: 46, height: 26, borderRadius: 999, border: 'none', padding: 3, flex: 'none', background: on ? 'var(--good)' : 'var(--border-strong)', cursor: disabled ? 'default' : 'pointer', transition: 'background .15s' }}>
      <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(20px)' : 'none', transition: 'transform .15s' }} />
    </button>
  );
}

/**
 * Las dos props son OPCIONALES y Configuraciones › Horario no pasa ninguna: ahí el panel es la pantalla.
 * Las usa quien lo monta ADENTRO de otra cosa (el panel anclado de Automations, app/automations/HorarioLista.tsx):
 *   · `onGuardado` — justo después de guardar bien, con el horario guardado: el botón de afuera se pone
 *     al día sin esperar a que se cierre el panel;
 *   · `onSucio` — si hay un guardado pendiente: el panel anclado no se cierra con un clic afuera mientras tanto.
 */
export function HorarioEnvioPanel({ onGuardado, onSucio }: {
  onGuardado?: (h: HorarioEnvio) => void;
  onSucio?: (sucio: boolean) => void;
}) {
  const [h, setH] = useState<HorarioEnvio | null>(null);
  const [zona, setZona] = useState('');
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [aviso, setAviso] = useState('');
  /** Hay un guardado en vuelo (o esperando su respiro). */
  const [enVuelo, setEnVuelo] = useState(false);
  const respiro = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedido = useRef(0);

  useEffect(() => {
    let vivo = true;
    getHorarioEnvioAction()
      .then((d) => { if (!vivo) return; setH(d.horario); setZona(d.zona); setPuedeEditar(d.puedeEditar); })
      .catch(() => { if (vivo) setAviso('No pude leer el horario.'); });
    return () => { vivo = false; if (respiro.current) clearTimeout(respiro.current); };
  }, []);

  // ⚠️ ANTES DEL `return` de abajo: un hook detrás de un return temprano se llama en unos renders y en
  // otros no (AGENTS.md, el «Minified React error #300»).
  useEffect(() => { onSucio?.(enVuelo); }, [enVuelo, onSucio]);

  if (!h) return <p style={{ fontSize: 13.5, color: aviso ? 'var(--bad)' : 'var(--dim)', fontFamily: SANS }}>{aviso || 'Cargando…'}</p>;

  const problemaDe = (x: HorarioEnvio): string | null =>
    x.activo && x.hasta <= x.desde ? 'Cierra antes de abrir.' : x.activo && !x.dias.length ? 'Elige al menos un día.' : null;

  /** Cada cambio se GUARDA (con un respiro: tocar tres días seguidos es un guardado, no tres). */
  const cambiar = (patch: Partial<HorarioEnvio>) => {
    const nuevo = { ...h, ...patch, ...(patch.activo && !h.dias.length ? { dias: HORARIO_SUGERIDO.dias } : {}) };
    setH(nuevo);
    const p = problemaDe(nuevo);
    setAviso(p ?? '');
    if (respiro.current) clearTimeout(respiro.current);
    if (p) { setEnVuelo(false); return; }
    setEnVuelo(true);
    const n = ++pedido.current;
    respiro.current = setTimeout(() => {
      void saveHorarioEnvioAction(nuevo)
        .catch(() => ({ ok: false, error: 'No se pudo guardar.' } as const))
        .then((r) => {
          if (n !== pedido.current) return;
          setEnVuelo(false);
          if (!r.ok) { setAviso(r.error || 'No se pudo guardar.'); return; }
          onGuardado?.(('horario' in r && r.horario) ? r.horario : nuevo);
        });
    }, 350);
  };
  const cambiarZona = (tz: string) => {
    const antes = zona;
    setZona(tz);
    void saveZonaHorarioAction(tz).then((r) => {
      if (!r.ok) { setZona(antes); setAviso(r.error || 'No se pudo guardar.'); return; }
      if (r.zona) setZona(r.zona);
      onGuardado?.(h);
    });
  };
  const alternarDia = (d: DiaSemana) => cambiar({ dias: h.dias.includes(d) ? h.dias.filter((x) => x !== d) : [...h.dias, d].sort((a, b) => a - b) });

  const off = !puedeEditar;
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontFamily: SANS }}>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>Horario de oficina</span>
        <Interruptor on={h.activo} disabled={off} etiqueta={h.activo ? 'Apagar el horario de oficina' : 'Prender el horario de oficina'} onCambio={(v) => cambiar({ activo: v })} />
      </div>

      {h.activo && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Las horas Y el huso en la MISMA fila (10/10/2026). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: SANS, fontSize: 14, color: 'var(--ink)' }}>
            <span>De</span>
            <Dropdown value={String(h.desde)} options={DESDE} width={104} ariaLabel="Desde" disabled={off} onChange={(v) => cambiar({ desde: Number(v) })} />
            <span>a</span>
            <Dropdown value={String(h.hasta)} options={HASTA} width={104} ariaLabel="Hasta" disabled={off} onChange={(v) => cambiar({ hasta: Number(v) })} />
            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              <Dropdown value={zona} options={opcionesDeZona(zona)} width="100%" search ariaLabel="Huso horario" disabled={off} onChange={cambiarZona} />
            </div>
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
        </div>
      )}
      {aviso && <div role="alert" style={{ marginTop: 12, fontSize: 13, color: 'var(--bad)', fontFamily: SANS }}>{aviso}</div>}
    </div>
  );
}
