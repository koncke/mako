'use client';

// =============================================================================
// PrioridadAMano — el lápiz, y el pop-up del 1 al 100
// =============================================================================
// El pedido, textual (22/09/2026): «no hagas un interruptor para apagar el perro… que siga
// funcionando normalmente. Solo que NO tenga fricción a la hora de cambiar prioridad».
//
// ⚠️ Y EL 23/09, MIRANDO LA PANTALLA: «no tiene más sentido que salga el botón o deslizable
// para cambiar la prioridad allí, si para eso teníamos el pop-up» + «que el botón de cambiar
// prioridad sea minimalista, que solo sea un ícono de lápiz». Así que el panel del detalle
// NO tiene slider: tiene el número y un lápiz al lado. El lápiz abre ESTE pop-up, que es el
// mismo que sale al arrastrar una tarjeta de una columna a otra — un solo lugar donde se
// elige un número, en vez de dos controles que hacen lo mismo con distinta cara.
//
// ⚠️ ESCRIBE EL SERVER, Y POR ESO ESTE ARCHIVO NO TOCA NINGÚN CAMPO NI SABE A QUÉ API
// PEGARLE. La escritura entra por `board.repo.prioridadManual`, que cada tablero implementa
// como puede: el del dueño corre la cascada y el candado (`score_manual`, mig 0143), el del
// cliente escribe el número por `/api/todo`. Con el endpoint hardcodeado adentro, este mismo
// control se dibujaba en el board de cada cliente y su única respuesta posible era un 403.
//
// Lo que devuelve el server es lo que se pinta, nunca lo que se pidió: el número final puede
// ser ±1 del pedido (el tablero del dueño no tiene empates, así que si alguien ya ocupaba
// ese número, queda el de al lado).
// =============================================================================

import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { MakoStar } from '../../_components/MakoBrand';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

export type MovimientoCascada = { id: string; nombre: string; antes: number; despues: number };

const numStyle: CSSProperties = {
  width: 62, textAlign: 'center', fontFamily: MONO, fontSize: 15, fontWeight: 800,
  padding: '7px 4px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)',
};

/**
 * El LÁPIZ. Lo único que se ve del control en el panel del detalle.
 *
 * Va pegado al número —no debajo, no en un botón de ancho completo—: «posicionalo donde
 * realmente se vea bien, porque donde está ahora si aparece un icono de lápiz flotando no
 * tiene sentido». Un ícono suelto al final de una columna no se lee como «editá esto»; al
 * lado del dato que edita, sí.
 */
/* El `onClick` recibe el evento —y no es cosmético—: el lápiz de la PORTADA necesita su
   propio nodo para colgar de ahí el popover. Ensancharlo no toca a nadie: una función que
   ignora el parámetro sigue siendo asignable. */
export function LapizPrioridad({ onClick, titulo = 'Cambiar la prioridad', tam = 26 }: { onClick: (e: MouseEvent<HTMLButtonElement>) => void; titulo?: string; tam?: number }) {
  return (
    <button type="button" onClick={onClick} title={titulo} aria-label={titulo}
      style={{
        flex: 'none', width: tam, height: tam, borderRadius: 7, border: '1px solid transparent',
        background: 'transparent', color: 'var(--faint)', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--faint)'; }}>
      <svg width={Math.round(tam * 0.54)} height={Math.round(tam * 0.54)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  );
}

/**
 * El pop-up del 1 al 100. Sale al arrastrar una tarjeta Y al tocar el lápiz.
 *
 * «Y sí que se pueda arrastrar, pero que siempre salga el pop-up para cambiar la prioridad
 * del 1 al 100, solo que ahora ya no habrá fricción» (22/09/2026). O sea: soltar no fija el
 * número por su cuenta. La columna dice la BANDA y el número exacto lo elige la persona.
 *
 * `onDebate` es la ÚNICA puerta que le queda a la audiencia con el Perro, y vive acá adentro
 * a propósito: discutirle el número es una opción de quien ya decidió cambiarlo, no un botón
 * más en el panel. Sin esto, sacar el botón del detalle dejaba la audiencia inalcanzable.
 */
export type Vecino = { id: string; titulo: string; score: number };

/** La banda a la que pertenece un número, y su color. UNA sola definición para el pop-up. */
const BANDAS: Array<{ min: number; label: string; color: string }> = [
  { min: 75, label: 'Alta', color: '#D0504A' },
  { min: 50, label: 'Media', color: '#C8870C' },
  { min: 25, label: 'Baja', color: '#1E9E57' },
  { min: 1, label: 'A futuro', color: '#98A0AC' },
];
const bandaDe = (n: number) => BANDAS.find((b) => n >= b.min) ?? BANDAS[BANDAS.length - 1];

/**
 * El pop-up del 1 al 100. Sale al arrastrar una tarjeta Y al tocar el lápiz.
 *
 * «Y sí que se pueda arrastrar, pero que siempre salga el pop-up para cambiar la prioridad
 * del 1 al 100, solo que ahora ya no habrá fricción» (22/09/2026). O sea: soltar no fija el
 * número por su cuenta. La columna dice la BANDA y el número exacto lo elige la persona.
 *
 * ⚠️ Y LOS VECINOS SON EL PUNTO, no un adorno. «Mientras voy desplazando sería increíble ver
 * ejemplos de otras tareas o proyectos que están cercanos a esa prioridad que le estoy
 * poniendo» (23/09/2026), y es lo que le falta al número solo: **un score no significa nada
 * en abstracto, significa algo comparado con el resto del tablero**. Es la misma regla que
 * gobierna al Perro —una razón tiene que comparar contra algo que EXISTE— aplicada a la
 * persona que mueve el slider.
 *
 * `onDebate` es la única puerta que le queda a la audiencia con el Perro, y es un ÍCONO
 * arriba a la derecha: discutirle el número es la excepción, no el botón principal.
 */
export function MoverPrioridadModal({ titulo, score, sugerido, vecinos = [], onAplicado, onDebate, onAbrir, onClose }: {
  titulo: string;
  score: number;
  /** el número con el que arranca el slider: el de la columna donde la soltaste, o el actual */
  sugerido: number;
  /** el resto del MISMO nivel (tareas con tareas, proyectos con proyectos), para comparar */
  vecinos?: Vecino[];
  onAplicado: (score: number) => Promise<void> | void;
  /** abrir la audiencia con el Perro. Ausente = este tablero no la tiene. */
  onDebate?: () => void;
  /** abrir un vecino. Ausente = la lista es sólo para mirar. */
  onAbrir?: (id: string) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(sugerido);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const aplicar = async () => {
    setGuardando(true);
    setErr('');
    try { await onAplicado(v); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); setGuardando(false); }
  };

  const banda = bandaDe(v);
  /**
   * TRES ARRIBA Y TRES ABAJO, con la propia EN EL MEDIO.
   *
   * «Que "Queda al lado de" tiene que ser por arriba y por abajo. Es decir, la que estamos
   * cambiando debería quedar con el título como en el medio» (23/09/2026). La versión
   * anterior mostraba las cinco más cercanas en cualquier dirección, así que con un 85
   * podían salir cinco de 86 y ninguna de abajo: se veía una lista, no una POSICIÓN.
   *
   * El orden es el del tablero (de mayor a menor), que es como se van a ver después. Se
   * recalcula con cada movimiento del slider.
   */
  const alrededor = useMemo(() => {
    const orden = vecinos.slice().sort((x, y) => y.score - x.score);
    const arriba = orden.filter((x) => x.score > v).slice(-3);
    const abajo = orden.filter((x) => x.score <= v).slice(0, 3);
    return [...arriba, { id: '__yo__', titulo, score: v, yo: true }, ...abajo];
  }, [vecinos, v, titulo]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(18,21,27,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.3)', padding: '18px 20px 16px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Cambiar prioridad</span>
          <span style={{ flex: 1 }} />
          {onDebate && (
            <button type="button" onClick={() => { onClose(); onDebate(); }} title="Que lo decida MaKo: discútele el número al Perro" aria-label="Que lo decida MaKo"
              style={{ flex: 'none', width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
              <MakoStar size={15} color="var(--primary)" />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          {/* La barra se tiñe de la banda: es el mismo color que la columna del Kanban y el
              del chip de la tarjeta, así que mover el slider DICE a qué columna va antes de
              soltarlo. */}
          <input type="range" min={1} max={100} value={v} onChange={(e) => setV(Number(e.target.value))} aria-label="Prioridad, del 1 al 100"
            style={{ flex: 1, accentColor: banda.color, cursor: 'pointer' }} />
          <input type="number" min={1} max={100} value={v}
            onChange={(e) => { const t = e.target.value.trim(); if (t === '') return; setV(Math.max(1, Math.min(100, Number(t) || v))); }}
            aria-label="Prioridad, del 1 al 100" style={{ ...numStyle, color: banda.color, borderColor: banda.color + '66' }} />
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: banda.color, textTransform: 'uppercase', letterSpacing: '.06em', minHeight: 16 }}>{banda.label}</div>

        {vecinos.length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 7 }}>Dónde queda</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {alrededor.map((x) => {
                const yo = 'yo' in x && x.yo === true;
                const c = bandaDe(x.score).color;
                const fila = (
                  <>
                    <span style={{ flex: 'none', width: 30, textAlign: 'right', fontFamily: MONO, fontSize: yo ? 12 : 11, fontWeight: 700, color: c }}>{x.score}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{x.titulo}</span>
                  </>
                );
                // La propia se DESTACA: fondo, borde del color de su banda y negrita. Sin
                // eso la lista no dice dónde queda — dice qué hay cerca, que es otra cosa.
                if (yo) {
                  return (
                    <div key="yo" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, padding: '6px 8px', margin: '3px 0', borderRadius: 8, background: c + '14', border: `1px solid ${c}55` }}>
                      {fila}
                    </div>
                  );
                }
                // Los vecinos se ABREN. «Y que las tareas se puedan abrir desde allí mismo»:
                // comparar contra una tarjeta cuyo título está cortado a 40 caracteres no
                // alcanza para decidir si va arriba o abajo de ella.
                return onAbrir ? (
                  <button key={x.id} type="button" onClick={() => { onClose(); onAbrir(x.id); }} title={`Abrir «${x.titulo}»`}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '4px 8px', borderRadius: 7, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.3, cursor: 'pointer', font: 'inherit', fontWeight: 400 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    {fila}
                  </button>
                ) : (
                  <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.3 }}>{fila}</div>
                );
              })}
            </div>
          </div>
        )}

        {err && <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
          <button type="button" onClick={() => void aplicar()} disabled={guardando || v === score}
            style={{ border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: guardando || v === score ? 'default' : 'pointer', opacity: guardando || v === score ? 0.5 : 1, fontFamily: SANS }}>
            {guardando ? 'Guardando…' : 'Cambiar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ⛔ ACÁ VIVÍA `PrioridadAMano`, el slider del panel, y con él «La fijaste a mano: MaKo ya
// no la toca. Devolvérsela.». Los dos se fueron el 23/09/2026 a pedido, mirando la pantalla:
// el slider porque «para eso teníamos el pop-up» —dos controles para el mismo número, uno
// ocupando cuatro renglones del panel— y el cartel porque explicaba un mecanismo interno en
// el lugar más caro, y ofrecía deshacer algo que nadie había pedido deshacer.
//
// El candado (`score_manual`, mig 0143) NO se tocó: sigue puesto, `recurvarPlanOwner` ahora
// sí lo respeta, y `Repo.prioridadAlPerro` sigue existiendo para quien lo necesite. Lo que
// se sacó es el cartel, no el mecanismo.
