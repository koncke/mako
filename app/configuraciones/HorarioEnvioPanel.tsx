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
// se guarda con su propia acción (`saveZonaHorarioAction`) y se ve aunque el horario esté apagado. Sin elegir,
// es la que se detectó de la ubicación de su equipo (app/_components/zona-actions.ts).

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dropdown } from '@/app/components/Dropdown';
import { getHorarioEnvioAction, saveHorarioEnvioAction, saveZonaHorarioAction } from './horario-actions';
import { DIAS_PANTALLA, horaTexto, MEDIAS_HORAS_DESDE, MEDIAS_HORAS_HASTA, HORARIO_SUGERIDO, type HorarioEnvio, type DiaSemana } from '@/lib/horario-envio';
import { ZONAS_POR_PAIS } from '@/lib/disparadores';
import { PAISES, flagUrl } from '@/lib/paises';
import { zonaCanonica } from '@/lib/zona-negocio-reglas';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 };

const DESDE = MEDIAS_HORAS_DESDE.map((h) => ({ value: String(h), label: horaTexto(h), icono: 'reloj' as const }));
const HASTA = MEDIAS_HORAS_HASTA.map((h) => ({ value: String(h), label: horaTexto(h), icono: 'reloj' as const }));

/** La zona del navegador de quien mira, canónica (`zonaCanonica`), o null. Es la que se SUGIERE arriba de la lista. */
function zonaDelNavegador(): string | null {
  try { return zonaCanonica(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { return null; }
}

/** El rótulo de la sugerida: la marca de que es la de quien mira (23/10/2026). */
export const ROTULO_ZONA_NAVEGADOR = 'la de tu navegador';

/**
 * Los husos que se ofrecen: los de la lista de países del teléfono, con su bandera (como el Recurrente). La del navegador
 * de quien mira va PRIMERA, marcada (23/10/2026: «lista de zonas canónicas y la del navegador sugerida»).
 */
export function opcionesDeZona(actual: string, navegador: string | null = null) {
  const out: Array<{ value: string; label: string; avatar?: string; avatarCuadrado?: boolean }> = [];
  for (const p of PAISES) {
    const zonas = ZONAS_POR_PAIS[p.iso2] ?? [];
    for (const z of zonas) out.push({ value: z.tz, label: zonas.length > 1 ? `${p.nombre} · ${z.label}` : p.nombre, avatar: flagUrl(p.iso2), avatarCuadrado: true });
  }
  if (navegador) {
    const i = out.findIndex((o) => o.value === navegador);
    const sugerida = i >= 0 ? out.splice(i, 1)[0] : { value: navegador, label: navegador };
    out.unshift({ ...sugerida, label: `${sugerida.label} · ${ROTULO_ZONA_NAVEGADOR}` });
  }
  // La que está puesta entra aunque no sea de la lista (AGENTS.md: el `<select>` que borra datos).
  if (actual && !out.some((o) => o.value === actual)) out.unshift({ value: actual, label: actual });
  return out;
}

/** El interruptor de la casa (el de «Activar» de una automatización). */
export function Interruptor({ on, disabled, onCambio, etiqueta }: { on: boolean; disabled?: boolean; onCambio: (v: boolean) => void; etiqueta: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={etiqueta} title={etiqueta} disabled={disabled} onClick={() => onCambio(!on)}
      style={{ width: 46, height: 26, borderRadius: 999, border: 'none', padding: 3, flex: 'none', background: on ? 'var(--good)' : 'var(--border-strong)', cursor: disabled ? 'default' : 'pointer', transition: 'background .15s' }}>
      <span style={{ display: 'block', width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(20px)' : 'none', transition: 'transform .15s' }} />
    </button>
  );
}

/**
 * Las dos props son OPCIONALES y Configuraciones › Horario no pasa ninguna: ahí el panel es la pantalla.
 * Las usa quien lo monta ADENTRO de otra cosa (el modal «Configuraciones» de Automations,
 * app/automations/ConfiguracionesBoton.tsx, que reemplazó al panel anclado del horario en la décima tanda):
 *   · `onGuardado` — justo después de guardar bien, con el horario guardado (lo usaba el botón del horario
 *     para ponerse al día; el de Configuraciones no muestra el horario y no lo pasa);
 *   · `onSucio` — si hay un guardado pendiente: el modal no se cierra mientras tanto;
 *   · `fuente` (20/10/2026) — de dónde lee y dónde guarda: sin ella, el horario del NEGOCIO; con ella, el de UNA
 *     automatización (app/automations/ConfigAutomatizacionPanel.tsx). La zona es siempre la del negocio.
 */
export type FuenteHorario = {
  leer: () => Promise<{ horario: HorarioEnvio; zona: string; puedeEditar: boolean }>;
  guardar: (h: HorarioEnvio) => Promise<{ ok: boolean; error?: string; horario?: HorarioEnvio }>;
  /** El título del recuadro (sin esto, «Horario de oficina»). */
  titulo?: string;
  /**
   * EL HUSO EN LA TUERCA DE UNA AUTOMATIZACIÓN (23/10/2026, Martín: «en configuraciones de Automations, no hay opción para
   * poner el huso horario»). Es el de TODO el negocio (`mako.timezone`, AGENTS.md: UNA zona por negocio): el 20/10 se dejó
   * de sólo lectura en el ⓘ porque elegir Madrid en UNA automatización dejaba a las demás mandando de madrugada sin
   * saberlo. Ahora va en la fila de las horas, con el MISMO selector que Configuraciones › Horario
   * (`saveZonaHorarioAction` → `fijarZonaDelNegocio`, origen 'persona') y una línea que dice que vale para todo el negocio
   * (`AVISO_ZONA_NEGOCIO`): el riesgo de antes era cambiarlo sin saberlo.
   */
  zonaDelNegocio?: true;
};
/** La línea de debajo del huso en la tuerca de una automatización (`zonaDelNegocio`). */
export const AVISO_ZONA_NEGOCIO = 'El huso vale para todo el negocio.';
const FUENTE_NEGOCIO: FuenteHorario = { leer: () => getHorarioEnvioAction(), guardar: (h) => saveHorarioEnvioAction(h) };

// (Del 25 al 26/10/2026 tuvo una cara en filas para Settings › General, `filas`. «General» se fue: el horario vive en la tuerca
// de cada automatización, y la zona del negocio en Perfil.)
export function HorarioEnvioPanel({ onGuardado, onSucio, fuente = FUENTE_NEGOCIO }: {
  onGuardado?: (h: HorarioEnvio) => void;
  onSucio?: (sucio: boolean) => void;
  fuente?: FuenteHorario;
}) {
  const [h, setH] = useState<HorarioEnvio | null>(null);
  const [zona, setZona] = useState('');
  // La del navegador, después de montar (en el server no hay `Intl` de quien mira).
  const [navegador, setNavegador] = useState<string | null>(null);
  useEffect(() => { setNavegador(zonaDelNavegador()); }, []);
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [aviso, setAviso] = useState('');
  /** Hay un guardado en vuelo (o esperando su respiro). */
  const [enVuelo, setEnVuelo] = useState(false);
  const respiro = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedido = useRef(0);

  useEffect(() => {
    let vivo = true;
    fuente.leer()
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
      void fuente.guardar(nuevo)
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
  // UN selector de huso y UNA escritura (`cambiarZona`) (tests/automations-config-revision.test.ts).
  const selectorZona = (ancho: number | string) => (
    <Dropdown value={zona} options={opcionesDeZona(zona, navegador)} width={ancho} search ariaLabel="Huso horario" disabled={off} onChange={cambiarZona} />
  );
  const dias = (
    <div role="group" aria-label="Días" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
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
  );
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontFamily: SANS }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>
          {fuente.titulo ?? 'Horario de oficina'}
        </span>
        <Interruptor on={h.activo} disabled={off} etiqueta={h.activo ? 'Apagar el horario de oficina' : 'Prender el horario de oficina'} onCambio={(v) => cambiar({ activo: v })} />
      </div>

      <div style={{ marginTop: fuente.zonaDelNegocio && !h.activo ? 0 : 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Las horas Y el huso en la MISMA fila (10/10/2026). El huso se ve también con el horario APAGADO
            (decisión 4 de la décima, 11/10/2026): es la zona de TODO el negocio, no una del horario. En la tuerca de una
            automatización (`zonaDelNegocio`) va sólo con el horario prendido (apagado manda a cualquier hora), y debajo dice
            que vale para todo el negocio. */}
        {(h.activo || !fuente.zonaDelNegocio) && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: SANS, fontSize: 14, color: 'var(--ink)' }}>
          {h.activo && (
            <>
              <span>De</span>
              <Dropdown value={String(h.desde)} options={DESDE} width={104} ariaLabel="Desde" disabled={off} onChange={(v) => cambiar({ desde: Number(v) })} />
              <span>a</span>
              <Dropdown value={String(h.hasta)} options={HASTA} width={104} ariaLabel="Hasta" disabled={off} onChange={(v) => cambiar({ hasta: Number(v) })} />
            </>
          )}
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            {selectorZona('100%')}
          </div>
        </div>}
        {fuente.zonaDelNegocio && h.activo && (
          <span data-aviso-zona-negocio="" style={{ marginTop: -6, fontFamily: SANS, fontSize: 12.5, color: 'var(--dim)' }}>{AVISO_ZONA_NEGOCIO}</span>
        )}
        {/* Los días CENTRADOS en el recuadro (décima tanda de Automations, general 3, 11/10/2026: «En "Horarios
            de Oficina" pon los días centrado en el recuadro, no alineado a la izquierda»). */}
        {h.activo && dias}
        {/* (14/10/2026 al 15/10/2026 vivió acá la casilla «Los avisos al equipo salen igual». Se fue a la tarjeta «MaKo en
            WhatsApp», donde se piensa ese envío: lib/mako-tarjeta.ts, `FueraDeHorario`.) */}
      </div>
      {aviso && <div role="alert" style={{ marginTop: 12, fontSize: 13, color: 'var(--bad)', fontFamily: SANS }}>{aviso}<ReportarASoporte /></div>}
    </div>
  );
}
