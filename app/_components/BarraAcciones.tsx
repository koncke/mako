'use client';

// =============================================================================
// BarraAcciones - los botones de una barra, plegados detras de los tres puntos
// =============================================================================
// Vivia adentro de app/plan/board/BoardShell.tsx, donde nacio. Se mudo el
// 27/09/2026 y el motivo es medible: la monta tambien la barra de Clientes
// (app/customer-success/BarraClientes.tsx) y ahora la de /admin, y mientras
// vivio alla ese import arrastraba BoardShell ENTERO -5.728 lineas, 56 imports
// de primer nivel, todos los modales del tablero, el DnD, los pickers- al bundle
// de cualquier pantalla que la usara.
//
// Es la regla de «una cosa, un lugar» del lado del peso: una pieza que montan
// tres pantallas no puede vivir adentro de una de ellas.
//
// BoardShell la re-exporta, asi que los call-sites viejos siguen andando.

import { Fragment, useEffect, useState } from 'react';
// Las dos familias salen del catalogo (app/_ui/tokens.ts) y no de una constante
// local como en BoardShell: son las mismas dos cadenas, y copiarlas seria el
// tercer lugar donde vive la tipografia de la casa.
import { SANS, MONO } from '@/app/_ui/tokens';

/**
 * BarraAcciones — los botones del header, plegados detrás de un «+» cuando no entran.
 *
 * El header es de UNA sola línea a propósito (que nada salte de renglón al cambiar de
 * tab), y eso tiene un costo: cuando la ventana se angosta, el grupo de la derecha no
 * se achica —sus botones son de 38px fijos— y termina DIBUJÁNDOSE ENCIMA de "Filtrar".
 * Medido: a 700px de ancho, el grupo se salía 290px del contenedor.
 *
 * Quién decide es el header (mide si entra o no); acá solo se pinta. El «+» abre los
 * mismos botones, hacia la izquierda —vive pegado al borde derecho, así que hacia el
 * otro lado se irían de la pantalla.
 */
/** Tres puntos: en esta app ES el simbolo de «hay mas acciones aca». Ya lo usa el CRM
 *  (app/crm/CrmToolbar.tsx) con el mismo significado. */
function KebabIcon({ size = 17 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" /></svg>;
}

/** Una fila del menu plegado: icono, NOMBRE y una linea de que hace. */
function FilaAccion({ icono, label, desc, badge, onClick }: {
  icono: React.ReactNode; label: string; desc: string; badge?: number; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" role="menuitem" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: hover ? 'var(--surface-2)' : 'transparent', fontFamily: SANS }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flex: 'none', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: hover ? 'var(--primary)' : 'var(--dim)' }}>{icono}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', lineHeight: 1.35, marginTop: 1 }}>{desc}</span>
      </span>
      {badge != null && badge > 0 && (
        <span style={{ flex: 'none', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontFamily: MONO, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
      )}
    </button>
  );
}

/** Lo que hace falta saber de una accion cuando NO entra en la barra. */
export type AccionPlegable = {
  key: string;
  /** el boton tal cual, para cuando SI entra */
  nodo: React.ReactNode;
  /** como se llama y que hace, para cuando hay que plegarla */
  menu: { icono: React.ReactNode; label: string; desc: string; badge?: number; onClick: () => void };
};

/**
 * Los botones de accion del header, plegables.
 *
 * TRES DECISIONES QUE NO SON DE GUSTO, y las tres salieron de que el dueño no entendiera
 * la primera version («el boton de + no me gusta mucho, no se entiende que es un
 * desplegable»):
 *
 *  1. TRES PUNTOS, NO «+». Un «+» significa CREAR en toda la industria y en esta misma
 *     app; usarlo para «hay mas cosas» promete una tarea nueva y entrega un menu. Los
 *     tres puntos son el simbolo de overflow, y el CRM ya lo usa asi
 *     (app/crm/CrmToolbar.tsx): el precedente estaba en casa y esto lo ignoraba.
 *  2. EL MENU ES VERTICAL Y CON TEXTO. La version anterior desplegaba los MISMOS iconos
 *     mudos en una tira horizontal: cambiaba un icono ambiguo por cinco. Un menu se lee.
 *  3. EL PROGRESO DEL PLAN VA ARRIBA DEL MENU. Es un DATO, no una accion: cuando no
 *     entra en la barra tiene que seguir estando en algun lado. La regla de la casa es
 *     «plegar si, esconder no», y un numero que desaparece es esconder.
 */
/**
 * ⚠️ EXPORTADA porque la usa TAMBIEN la pantalla de Clientes (27/09/2026): «falta la
 * barra de progreso en los 3 puntitos en clientes, y los iconos; asegurate de copiar
 * el diseno». Copiar el diseno es escribir el segundo, y el segundo se queda viejo —
 * ya paso en esta misma sesion con el buscador y el toggle. Lo que Clientes le pasa
 * son sus propias acciones y su propio progreso; el menu, el punto de aviso, el
 * Escape y la animacion son estos.
 */
export function BarraAcciones({ acciones, compacto, progreso }: {
  acciones: AccionPlegable[];
  /** no entran: se pliegan detras de los tres puntos. Lo decide el header, que es quien mide. */
  compacto: boolean;
  /** el avance del plan, para que no desaparezca al plegarse */
  progreso?: { pct: number; hechas: number; total: number; label: string };
}) {
  const [abierto, setAbierto] = useState(false);
  const n = acciones.length;
  const esperando = acciones.reduce((t, a) => t + (a.menu.badge ?? 0), 0);

  // Al desplegarse la ventana, cerrar el panel: si no, queda flotando sobre el tablero.
  useEffect(() => { if (!compacto) setAbierto(false); }, [compacto]);
  // Escape cierra, como todo lo que se abre en esta app.
  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [abierto]);

  if (!compacto) return <div data-barra-acciones style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>{acciones.map((a) => <Fragment key={a.key}>{a.nodo}</Fragment>)}</div>;

  return (
    <div data-barra-menu style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 'none' }}>
      <button type="button" onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? 'Cerrar las acciones' : 'Mas acciones del plan (' + n + ')'} aria-expanded={abierto} aria-haspopup="menu"
        title="Mas acciones del plan"
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 9, border: '1px solid ' + (abierto ? 'var(--primary)' : 'var(--border-strong)'), background: abierto ? 'var(--surface-2)' : 'var(--surface)', color: abierto ? 'var(--primary)' : 'var(--dim)', cursor: 'pointer', flex: 'none', padding: 0 }}>
        <KebabIcon />
        {/* Que hay algo esperando se ve SIN abrir: un menu cerrado que esconde sus avisos
            es esconder sin pista, que es justo lo que la regla prohibe.
            Un PUNTO, no un numero: sumar los badges de las acciones daba «507» —429 tareas
            sin datos + 19 de MaKo + 59 de reuniones—, un total que no significa nada porque
            no son la misma cosa. El numero de cada una vive en su fila, adentro. */}
        {esperando > 0 && (
          <span aria-hidden style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 999, background: 'var(--primary)', border: '2px solid var(--surface)' }} />
        )}
      </button>
      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div role="menu" style={{ position: 'absolute', top: 44, right: 0, zIndex: 41, width: 312, maxWidth: 'calc(100vw - 32px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, boxShadow: '0 16px 40px rgba(18,21,27,.18)', padding: 7, display: 'flex', flexDirection: 'column', gap: 2, animation: 'makoDesplegar .14s ease-out both' }}>
            {progreso && (
              <div style={{ padding: '8px 10px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{progreso.pct}%</span>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)' }}>{progreso.hechas}/{progreso.total} {progreso.label}</span>
                </div>
                <span style={{ display: 'block', height: 4, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 6 }}>
                  <span style={{ display: 'block', height: '100%', width: Math.min(100, progreso.pct) + '%', background: 'var(--primary)' }} />
                </span>
              </div>
            )}
            {progreso && <span style={{ height: 1, background: 'var(--border)', margin: '3px 6px 5px' }} />}
            {acciones.map((a) => (
              <FilaAccion key={a.key} icono={a.menu.icono} label={a.menu.label} desc={a.menu.desc} badge={a.menu.badge}
                onClick={() => { setAbierto(false); a.menu.onClick(); }} />
            ))}
          </div>
          <style>{'@keyframes makoDesplegar{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}'}</style>
        </>
      )}
    </div>
  );
}
