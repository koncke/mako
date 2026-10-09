'use client';

// =============================================================================
// EditorRecurrente — el horario de un CRON «Recurrente», como el diálogo de Google Calendar
// =============================================================================
// Sexta tanda del Chatbot (09/10/2026), CRON punto 9, literal: «Mejora la edición de "Cron" en
// "RECURRENTE"... No está bueno que tenga tantos desplegables, no se entiende... Ya hicimos algo así
// en PLAN, con RECURRENCIA, copiando el diseño de google calendar, sacalo de allí... no puedo poner más
// de 1 día a la semana, martes y jueves por ejemplo... Con un calendario para que se pueda seleccionar
// fecha, con un reloj para la hora... Y con respecto al huso horario, por defecto, siempre dejalo en
// el huso del usuario, pero que se pueda editar... con la lista de paises y banderas que ya tenemos al
// poner un número de telefono».
//
// LO QUE SE COPIA DEL PLAN (`RepeticionModal`, app/plan/board/AccionesLote.tsx): los mismos bloques y
// en el mismo orden —«Repetir cada [N] [unidad]», los siete días como círculos, VARIOS a la vez y el
// último que no se destilda, «el día N» o «el segundo martes»—, y lo que el Plan decidió sobre ellos
// (el número que no escribe lo que no entiende, ningún estado imposible de guardar). Lo que se SUMA
// acá, porque un horario sí dispara algo: la fecha de inicio con un calendario, la hora con su reloj y
// el huso con las banderas del teléfono (`PAISES`, lib/paises.ts, y sus zonas, `ZONAS_POR_PAIS`).
//
// ⚠️ NO SE COPIA EL COMPONENTE: aquel guarda una RRULE (`Freq` cerrado en DAILY…YEARLY) y éste un
// `CronAviso` (lib/cron-aviso.ts, que tiene «cada N horas» y que el motor ya sabe agendar). Por qué no
// se reusa el vocabulario del Plan está escrito en la cabecera de lib/cron-aviso.ts.
//
// ⚠️ SIN RENGLÓN DE RESUMEN, como el Plan: los bloques SON la frase. La frase entera la dice la
// tarjeta CRON del lienzo (`textoDeDisparador`).
//
// No guarda nada: avisa cada cambio por `onCron` (ya saneado) y quien lo monta decide.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown } from '@/app/components/Dropdown';
import { UNIDADES, CADA_MAX, DIA_MES_MAX, sanearCron, zonaDelCron, type CronAviso, type UnidadCron } from '@/lib/cron-aviso';
import { paisDeZona, zonasDelPais } from '@/lib/disparadores';
import { PAISES, flagUrl } from '@/lib/paises';
import { hoyEnTz, TZ_TIJUANA } from '@/lib/date-utils';

const SANS = "'Geist', sans-serif";

/** La semana arranca el LUNES, como el diálogo del Plan (y `dias` se guarda en ese orden). */
const DIAS: ReadonlyArray<{ d: number; ini: string; nombre: string }> = [
  { d: 1, ini: 'L', nombre: 'Lunes' }, { d: 2, ini: 'M', nombre: 'Martes' }, { d: 3, ini: 'M', nombre: 'Miércoles' },
  { d: 4, ini: 'J', nombre: 'Jueves' }, { d: 5, ini: 'V', nombre: 'Viernes' }, { d: 6, ini: 'S', nombre: 'Sábado' },
  { d: 0, ini: 'D', nombre: 'Domingo' },
];
const ORDINALES = [{ v: 1, label: 'primer' }, { v: 2, label: 'segundo' }, { v: 3, label: 'tercer' }, { v: 4, label: 'cuarto' }, { v: -1, label: 'último' }];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const fila: CSSProperties = { display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', alignItems: 'center', gap: 10, minHeight: 36 };
const rotulo: CSSProperties = { fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: 'var(--dim)' };
const num: CSSProperties = { width: 64, height: 36, boxSizing: 'border-box', padding: '4px 8px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontFamily: SANS };
const btnCampo: CSSProperties = { height: 36, padding: '0 10px', borderRadius: 9, gap: 6, fontSize: 13.5 };

const dowDeFecha = (f: string): number => { const [y, m, d] = f.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const fechaLarga = (f: string): string => { const [y, m, d] = f.split('-').map(Number); return `${DIAS_CORTOS[dowDeFecha(f)]} ${d} ${MESES[m - 1].slice(0, 3)} ${y}`; };
const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Las horas del reloj: cada 15 min, y la que está puesta aunque no caiga en la grilla (el `<select>` que borra datos). */
function opcionesHora(h: number, m: number) {
  const out: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < 24 * 4; i++) { const v = hhmm(Math.floor(i / 4), (i % 4) * 15); out.push({ value: v, label: v }); }
  const actual = hhmm(h, m);
  if (!out.some((o) => o.value === actual)) out.push({ value: actual, label: actual });
  return out.sort((a, b) => a.value.localeCompare(b.value));
}

/** El reloj del campo «A las». */
const IconoReloj = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
const IconoCalendario = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden><rect x="3.5" y="4.5" width="17" height="16" rx="3" /><path d="M3.5 9.5h17M8 2.8v3.4M16 2.8v3.4" /></svg>
);

export function EditorRecurrente({ cron, tzNegocio, disabled, onCron, aQuien }: {
  cron: CronAviso;
  /** La zona del negocio (`mako.timezone`): la del horario mientras la persona no elija otra. */
  tzNegocio: string | null;
  disabled?: boolean;
  onCron: (c: CronAviso) => void;
  /** «A quién», que es del CRON y no del horario: lo dibuja quien monta, como el último renglón. */
  aQuien?: ReactNode;
}) {
  const zona = zonaDelCron(cron, tzNegocio || TZ_TIJUANA);
  const hoy = hoyEnTz(zona);
  const set = (p: Partial<CronAviso>) => { const c = sanearCron({ ...cron, ...p }); if (c) onCron(c); };
  const unidad = UNIDADES.find((u) => u.key === cron.unidad) ?? UNIDADES[1];
  const [calendario, setCalendario] = useState(false);

  /** Cambiar de unidad: lo de la otra se cae solo en el saneo; lo que ésta necesita nace con HOY (como el Plan). */
  const cambiarUnidad = (u: UnidadCron) => {
    if (u === 'semana') set({ unidad: u, diaSemana: cron.diaSemana ?? dowDeFecha(hoy), dias: cron.dias });
    else if (u === 'mes' || u === 'anio') set({ unidad: u, diaMes: Math.min(Number(hoy.slice(8, 10)), DIA_MES_MAX), mes: Number(hoy.slice(5, 7)) });
    else set({ unidad: u });
  };
  const dias = cron.dias?.length ? cron.dias : [cron.diaSemana ?? 1];
  /** ⚠️ EL ÚLTIMO DÍA NO SE DESTILDA (como el Plan y como Google): una semana sin días es el único estado inválido. */
  const alternarDia = (d: number) => {
    const ya = dias.includes(d);
    if (ya && dias.length === 1) return;
    const nuevos = ya ? dias.filter((x) => x !== d) : [...dias, d];
    set({ dias: nuevos, diaSemana: nuevos[0] });
  };
  const porOrdinal = cron.unidad === 'mes' && cron.ordinal != null;
  const pais = paisDeZona(zona);
  const zonasPais = pais ? zonasDelPais(pais) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: SANS }}>
      <div style={fila}>
        <span style={rotulo}>Repetir cada</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
          {/* El número se valida al escribir y lo que no pasa NO se escribe (el Plan: con `|| 1` el
              campo salta a 1 apenas se borra para tipear otro). */}
          <input type="number" min={1} max={CADA_MAX} value={cron.cada} disabled={disabled} aria-label={`Cada cuántos ${unidad.plural}`}
            onChange={(e) => { const n = Math.floor(Number(e.target.value)); if (Number.isFinite(n) && n >= 1 && n <= CADA_MAX) set({ cada: n }); }}
            style={num} />
          <Dropdown value={cron.unidad} ariaLabel="Cada qué se repite" buttonStyle={btnCampo} disabled={disabled}
            options={UNIDADES.map((u) => ({ value: u.key, label: cron.cada === 1 ? u.label : u.plural }))}
            onChange={(v) => cambiarUnidad(v as UnidadCron)} />
        </div>
      </div>

      {cron.unidad === 'semana' && (
        <div style={fila}>
          <span style={rotulo}>Los días</span>
          {/* La letra no identifica (hay dos «M»): el nombre va en el title y el aria-label. */}
          <div role="group" aria-label="Días en que se repite" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DIAS.map((x) => {
              const on = dias.includes(x.d);
              return (
                <button key={x.d} type="button" onClick={() => alternarDia(x.d)} disabled={disabled} title={x.nombre} aria-label={x.nombre} aria-pressed={on}
                  style={{
                    width: 32, height: 32, flex: 'none', borderRadius: '50%', cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: 700,
                    border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'var(--surface)',
                    color: on ? '#fff' : 'var(--dim)', transition: 'background .12s, border-color .12s, color .12s',
                  }}>{x.ini}</button>
              );
            })}
          </div>
        </div>
      )}

      {cron.unidad === 'mes' && (
        <div style={{ ...fila, alignItems: 'start' }}>
          <span style={{ ...rotulo, paddingTop: 9 }}>Cada mes</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Dos radios de verdad: son dos lecturas EXCLUYENTES del mismo campo (como el Plan). */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink)' }}>
              <input type="radio" name="cron-mes" checked={!porOrdinal} disabled={disabled} style={{ accentColor: 'var(--primary)' }}
                onChange={() => set({ ordinal: undefined, diaMes: cron.diaMes ?? Math.min(Number(hoy.slice(8, 10)), DIA_MES_MAX) })} />
              <span>el día</span>
              <Dropdown value={String(cron.diaMes ?? 1)} ariaLabel="Día del mes" buttonStyle={btnCampo} disabled={disabled || porOrdinal}
                options={Array.from({ length: DIA_MES_MAX }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                onChange={(v) => set({ ordinal: undefined, diaMes: Number(v) })} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink)', flexWrap: 'wrap' }}>
              <input type="radio" name="cron-mes" checked={porOrdinal} disabled={disabled} style={{ accentColor: 'var(--primary)' }}
                onChange={() => set({ ordinal: 1, diaSemana: cron.diaSemana ?? dowDeFecha(hoy) })} />
              <span>el</span>
              <Dropdown value={String(cron.ordinal ?? 1)} ariaLabel="Qué semana del mes" buttonStyle={btnCampo} disabled={disabled || !porOrdinal}
                options={ORDINALES.map((o) => ({ value: String(o.v), label: o.label }))}
                onChange={(v) => set({ ordinal: Number(v), diaSemana: cron.diaSemana ?? 1 })} />
              <Dropdown value={String(cron.diaSemana ?? 1)} ariaLabel="Qué día de la semana" buttonStyle={btnCampo} disabled={disabled || !porOrdinal}
                options={DIAS.map((x) => ({ value: String(x.d), label: x.nombre.toLowerCase() }))}
                onChange={(v) => set({ ordinal: cron.ordinal ?? 1, diaSemana: Number(v) })} />
            </label>
          </div>
        </div>
      )}

      {cron.unidad === 'anio' && (
        <div style={fila}>
          <span style={rotulo}>El día</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Dropdown value={String(cron.diaMes ?? 1)} ariaLabel="Día" buttonStyle={btnCampo} disabled={disabled}
              options={Array.from({ length: DIA_MES_MAX }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
              onChange={(v) => set({ diaMes: Number(v) })} />
            <span style={{ fontSize: 13.5, color: 'var(--dim)' }}>de</span>
            <Dropdown value={String(cron.mes ?? 1)} ariaLabel="Mes" buttonStyle={btnCampo} disabled={disabled} search
              options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
              onChange={(v) => set({ mes: Number(v) })} />
          </div>
        </div>
      )}

      <div style={fila}>
        <span style={rotulo}>Empieza</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setCalendario((v) => !v)} disabled={disabled} aria-expanded={calendario} aria-label="Fecha de inicio"
            style={{ ...btnCampo, display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontFamily: SANS }}>
            <IconoCalendario />
            {cron.desde && cron.desde > hoy ? fechaLarga(cron.desde) : 'Hoy'}
          </button>
        </div>
      </div>
      {calendario && (
        <div style={{ marginLeft: 102 }}>
          <CalendarioMini valor={cron.desde ?? null} hoy={hoy}
            onElegir={(f) => { set({ desde: f && f > hoy ? f : undefined }); setCalendario(false); }} />
        </div>
      )}

      {cron.unidad !== 'hora' && (
        <div style={fila}>
          <span style={rotulo}>A las</span>
          <Dropdown value={hhmm(cron.hora, cron.minuto)} ariaLabel="A qué hora" buttonStyle={btnCampo} disabled={disabled} search icono={<IconoReloj />}
            options={opcionesHora(cron.hora, cron.minuto)}
            onChange={(v) => { const [h, m] = v.split(':').map(Number); set({ hora: h, minuto: m }); }} />
        </div>
      )}

      <div style={fila}>
        <span style={rotulo}>Huso</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, flexWrap: 'wrap' }}>
          {/* Las banderas como IMAGEN (flagcdn): los emoji de bandera no se ven en Windows (lib/paises.ts). */}
          <Dropdown value={pais ?? ''} ariaLabel="País del huso horario" buttonStyle={btnCampo} disabled={disabled} search
            botonLabel={pais ? undefined : zona}
            options={PAISES.map((p) => ({ value: p.iso2, label: p.nombre, avatar: flagUrl(p.iso2), avatarCuadrado: true }))}
            onChange={(iso) => { const z = zonasDelPais(iso); if (z.length) set({ tz: z[0].tz }); }} />
          {zonasPais.length > 1 && (
            <Dropdown value={zona} ariaLabel="Zona horaria" buttonStyle={btnCampo} disabled={disabled}
              options={zonasPais.map((z) => ({ value: z.tz, label: z.label }))}
              onChange={(tz) => set({ tz })} />
          )}
        </div>
      </div>

      {aQuien}
    </div>
  );
}

/**
 * EL CALENDARIO DE LA FECHA DE INICIO (CRON punto 9: «con un calendario para que se pueda seleccionar
 * fecha»). En línea y no flotante, a propósito: el panel del CRON vive adentro del lienzo, con
 * `overflow` y un `transform`, y un popover nacido ahí se dibuja recortado (AGENTS.md); en línea, el
 * panel scrollea. La semana arranca el lunes. Los días que ya pasaron no se eligen: un inicio en el
 * pasado es «desde hoy», que es lo que dice el botón sin fecha.
 */
export function CalendarioMini({ valor, hoy, onElegir }: { valor: string | null; hoy: string; onElegir: (fecha: string | null) => void }) {
  const base = valor && valor >= hoy ? valor : hoy;
  const [mes, setMes] = useState(() => ({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) }));
  const primero = new Date(Date.UTC(mes.y, mes.m - 1, 1)).getUTCDay();
  const vacios = (primero + 6) % 7;
  const cuantos = new Date(Date.UTC(mes.y, mes.m, 0)).getUTCDate();
  const fecha = (d: number) => `${mes.y}-${String(mes.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const mover = (k: number) => setMes((x) => { const f = new Date(Date.UTC(x.y, x.m - 1 + k, 1)); return { y: f.getUTCFullYear(), m: f.getUTCMonth() + 1 }; });
  const flecha: CSSProperties = { width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontFamily: SANS, fontSize: 14 };
  return (
    <div role="dialog" aria-label="Elegir la fecha de inicio" style={{ width: 252, padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 4px 16px rgba(0,0,0,.08)', fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button type="button" style={flecha} onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{MESES[mes.m - 1]} {mes.y}</span>
        <button type="button" style={flecha} onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
        {DIAS.map((x) => <span key={x.d} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--faint)', padding: '2px 0' }}>{x.ini}</span>)}
        {Array.from({ length: vacios }, (_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: cuantos }, (_, i) => {
          const f = fecha(i + 1);
          const pasado = f < hoy;
          const elegido = f === valor || (!valor && f === hoy);
          return (
            <button key={f} type="button" disabled={pasado} onClick={() => onElegir(f)} aria-label={fechaLarga(f)} aria-pressed={elegido}
              style={{
                height: 30, borderRadius: '50%', fontFamily: SANS, fontSize: 12.5, cursor: pasado ? 'default' : 'pointer',
                border: f === hoy && !elegido ? '1.5px solid var(--primary)' : '1.5px solid transparent',
                background: elegido ? 'var(--primary)' : 'transparent', color: elegido ? '#fff' : pasado ? 'var(--faint)' : 'var(--ink)',
                fontWeight: elegido ? 700 : 500,
              }}>{i + 1}</button>
          );
        })}
      </div>
    </div>
  );
}
