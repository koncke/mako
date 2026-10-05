'use client';

/**
 * EL CONTROL DE «CUÁNDO SE DISPARA ESTO»: por tiempo o por una acción.
 *
 * ⚠️ VIVE ACÁ PORQUE LO USAN DOS PANTALLAS. Nació adentro de `app/agencia/FlujoAviso.tsx`
 * (el lienzo de /mensajes) y el 05/10/2026 lo pidió también el lienzo del chatbot:
 * «el CRON está mal, lo habíamos hecho ya… con las 2 opciones por tiempo o por acción».
 * Se extrae ANTES de la segunda pantalla y no después, que es la regla de la casa:
 * copiarlo cuesta cero y deja las mismas cinco trampas resueltas en dos lugares — y
 * después divergen, con el día 31 arreglado en uno y vivo en el otro.
 *
 * Lo que NO está acá: qué se escribe al elegir cada modo. Eso es distinto en cada
 * pantalla (un aviso apaga su evento, una secuencia apaga su agendado) y por eso
 * `SelectorDisparo` sólo avisa qué eligió la persona.
 */

import { useState, type ReactNode } from 'react';
import { Dropdown } from '../components/Dropdown';
import { inpLienzo } from './Lienzo';
import { UNIDADES, CADA_MAX, DIA_MES_MAX, sanearCron, textoCron, type CronAviso } from '@/lib/cron-aviso';

/** Lo que se escribe al apretar «Por tiempo» sin nada guardado: todos los días a las 9. */
export const CRON_DEFAULT: CronAviso = { unidad: 'dia', cada: 1, hora: 9, minuto: 0 };

export type ModoDisparo = 'tiempo' | 'accion' | null;

/**
 * LOS DOS BOTONES, Y LA FLECHA PARA VOLVER.
 *
 * Pedido con la captura delante: «el CRON debería elegirse 1 sola opción, por tiempo o
 * por acción y si se quiere cambiar debería retroceder. No que aparezcan siempre ambos
 * botones». Con los dos puestos, el apagado se leía como una segunda cosa configurable
 * al lado de la elegida.
 *
 * ⚠️ LA FLECHA NO ES DECORACIÓN: es la única salida. Antes el modo se apagaba volviendo
 * a apretar el botón activo, y al dejar uno solo visible eso desapareció — sin la
 * flecha, elegir «Por tiempo» una vez dejaría esto agendado para siempre y la única
 * salida sería apagar el mensaje entero.
 */
export function SelectorDisparo({ modo, disabled, onModo, rotuloTiempo, rotuloAccion }: {
  modo: ModoDisparo;
  disabled?: boolean;
  /** `null` = volver a la elección, y el caller apaga lo que ese modo tenía escrito. */
  onModo: (m: ModoDisparo) => void;
  rotuloTiempo?: string;
  rotuloAccion?: string;
}) {
  const txt = { tiempo: rotuloTiempo ?? 'Por tiempo', accion: rotuloAccion ?? 'Por una acción' };
  if (modo === null) {
    return (
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['tiempo', 'accion'] as const).map((k) => (
          <button key={k} type="button" onClick={() => onModo(k)} disabled={disabled}
            style={{
              flex: 1, padding: '7px 4px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11.5, fontWeight: 600, transition: 'background .12s',
              border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--dim)',
            }}>{txt[k]}</button>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
      <button type="button" onClick={() => onModo(null)} disabled={disabled}
        title="Elegir otra cosa: apaga lo que está configurado aquí" aria-label="Elegir otra cosa"
        style={{
          flex: 'none', width: 26, height: 26, borderRadius: 7, cursor: 'pointer',
          border: '1px solid var(--border-strong)', background: 'var(--surface)',
          color: 'var(--dim)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)' }}>{txt[modo]}</span>
    </div>
  );
}

/**
 * EL CONTROL DEL CRON POR TIEMPO.
 *
 * Un desplegable de unidad y, al lado, SÓLO los campos que esa unidad necesita:
 * una semana pide el día, un mes pide el número, un año pide mes y número, y «cada
 * hora» no pide hora de pared porque ahí no la decide nadie. Dibujar los cinco
 * siempre y desactivar tres es pedirle a la persona que adivine cuáles miran.
 *
 * ⚠️ Y LA FRASE DE ABAJO NOMBRA LA ZONA. Medido el 30/09/2026: de los 10 workspaces
 * activos, SEIS no tienen `mako.timezone` y caen a America/Tijuana. Un «a la mañana»
 * sobre eso es una afirmación que nadie verificó; «9:00 de America/Tijuana» deja que
 * el dueño vea que está mal y lo arregle.
 */
export function EditorCron({ cron, tz, disabled, onCron, nota }: {
  cron: CronAviso; tz: string | null; disabled: boolean; onCron: (c: CronAviso | null) => void;
  /** Una línea extra debajo de la frase, para lo que esta pantalla agrega al hecho. */
  nota?: ReactNode;
}) {
  const set = (p: Partial<CronAviso>) => { const c = sanearCron({ ...cron, ...p }); if (c) onCron(c); };
  const num = (v: number, min: number, max: number, onSet: (n: number) => void, rotulo: string) => (
    <input type="number" value={v} min={min} max={max} disabled={disabled} aria-label={rotulo}
      onChange={(e) => onSet(Number(e.target.value))}
      style={{ ...inpLienzo, width: 62, flex: 'none' }} />
  );
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--dim)', flex: 'none' }}>Cada</span>
        {num(cron.cada, 1, CADA_MAX, (n) => set({ cada: n }), 'Cada cuántos')}
        <Dropdown value={cron.unidad} width="100%" ariaLabel="Unidad"
          options={UNIDADES.map((u) => ({ value: u.key, label: cron.cada === 1 ? u.label : u.plural }))}
          onChange={(v) => set({ unidad: v as CronAviso['unidad'] })} />
      </div>
      {cron.unidad === 'semana' && (
        <Dropdown value={String(cron.diaSemana ?? 1)} width="100%" ariaLabel="Día de la semana"
          options={DIAS.map((d, i) => ({ value: String(i), label: d }))}
          onChange={(v) => set({ diaSemana: Number(v) })} />
      )}
      {(cron.unidad === 'mes' || cron.unidad === 'anio') && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--dim)', flex: 'none' }}>El día</span>
          {num(cron.diaMes ?? 1, 1, DIA_MES_MAX, (n) => set({ diaMes: n }), 'Día del mes')}
          {cron.unidad === 'anio' && (
            <Dropdown value={String(cron.mes ?? 1)} width="100%" ariaLabel="Mes"
              options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
              onChange={(v) => set({ mes: Number(v) })} />
          )}
        </div>
      )}
      {cron.unidad !== 'hora' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--dim)', flex: 'none' }}>A las</span>
          {num(cron.hora, 0, 23, (n) => set({ hora: n }), 'Hora')}
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>:</span>
          {num(cron.minuto, 0, 59, (n) => set({ minuto: n }), 'Minuto')}
        </div>
      )}
      {/* Y el día 31 no está: no existe en febrero, y saltear el mes o correrlo al 1
          de marzo son dos decisiones que nadie tomó. El tope es 28. */}
      <div style={{ fontSize: 11, color: 'var(--good)', lineHeight: 1.4, fontWeight: 600 }}>{textoCron(cron, tz)}</div>
      {nota}
    </div>
  );
}

/** El estado del selector, que NO se puede derivar sólo de los datos.
 *
 * ⚠️ La primera versión hacía `modo = cron ? 'tiempo' : evento ? 'accion' : null`, y con
 * eso apretar «Por una acción» no hacía NADA: sin evento elegido el modo seguía siendo
 * null, el desplegable no se dibujaba, y no había forma de llegar a elegirlo. Medido en
 * el navegador — el botón cambiaba de color y el panel no cambiaba. Elegir un modo es
 * una INTENCIÓN de quien mira; lo guardado es otra cosa, y la intención manda hasta que
 * se guarde algo. */
export function useModoDisparo(guardado: ModoDisparo): [ModoDisparo, (m: ModoDisparo) => void] {
  const [intencion, setIntencion] = useState<ModoDisparo>(null);
  return [intencion ?? guardado, setIntencion];
}
