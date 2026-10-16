'use client';

// =============================================================================
// Repriorizar — «Re-priorizar todo» en el tablero: arrancar, mirar el avance, pintar lo que cambió
// =============================================================================
// 16/10/2026, decisión 9 de «hacer el kanban un kanban». El pedido, textual (Martín): «un botón en
// los 3 puntos de arriba del plan para "re-priorizar" todo, y eso puede correr en segundo plano y
// no impedir que el usuario siga utilizando todo».
//
// La entrada vive en el menú de los tres puntos (`BarraAcciones`, en BoardShell) y sólo se dibuja
// si el tablero tiene la capacidad (`repo.repriorizar`). Mientras corre:
//   · una línea chica abajo del header —«Re-priorizando 40/185»— y nada más: no hay modal, no se
//     bloquea ningún control;
//   · cada 4 s se pregunta el avance (`repo.repriorizar.estado`), y esa misma pregunta empuja la
//     tanda siguiente en el server. Si se cierra la pestaña, lo termina el cron;
//   · lo que el trabajo ya escribió se PINTA (`aplicarPerroServer`): los dos tableros guardan la fila
//     entera desde el navegador, y una tarjeta con el número viejo en memoria se lo devolvería a la
//     base en el próximo guardado.
// Al terminar, un toast corto. Si se cortó, la línea lo dice con «Reintentar».
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Repo, GuardPatch, GuardProjPatch } from './types';
import { SONDEO_MS, lineaDeProgreso, avisoAlTerminar, cambiosParaPantalla, type Repriorizacion } from '@/lib/plan-repriorizar-nucleo';
import { MONO, SANS } from '@/app/_ui/tokens';

type Opciones = {
  /** Pinta lo que el server ya escribió (sin volver a guardarlo). */
  aplicar: (tareas: GuardPatch[], proyectos: GuardProjPatch[]) => void;
  /** El toast del tablero. */
  avisar: (texto: string) => void;
};

export function useRepriorizar(rp: Repo['repriorizar'], o: Opciones) {
  // ⚠️ EN REFS, NO EN LAS DEPENDENCIAS: los dos tableros arman el `repo` en cada render (un objeto
  // literal), así que `rp` cambia de identidad siempre. Con él en las dependencias, el sondeo se
  // reiniciaría en cada render del tablero.
  const rpRef = useRef(rp);
  const oRef = useRef(o);
  useEffect(() => { rpRef.current = rp; oRef.current = o; });
  const hay = !!rp;

  const [trabajo, setTrabajo] = useState<Repriorizacion | null>(null);
  /** El trabajo que se cortó MIENTRAS se miraba: la línea lo dice hasta que se cierre o se reintente. */
  const [cortado, setCortado] = useState<Repriorizacion | null>(null);
  const [arrancando, setArrancando] = useState(false);
  const actual = useRef<Repriorizacion | null>(null);
  /** Hasta dónde se pintaron los cambios de qué trabajo: el `desde` del próximo sondeo. */
  const visto = useRef<{ id: number; n: number } | null>(null);

  const absorber = useCallback((t: Repriorizacion | null, pintar: boolean) => {
    if (!t) return;
    const prev = actual.current;
    if (pintar && t.cambios.length) {
      const { tareas, proyectos } = cambiosParaPantalla(t.cambios);
      oRef.current.aplicar(tareas, proyectos);
    }
    visto.current = { id: t.id, n: t.nCambios };
    // EL FINAL QUE SE VIO: sólo si este mismo tablero lo estaba mirando correr. Un trabajo que ya
    // había terminado al abrir la pantalla no avisa nada.
    if (prev && prev.id === t.id && prev.estado === 'corriendo' && t.estado !== 'corriendo') {
      const a = avisoAlTerminar(t);
      if (a) oRef.current.avisar(a.texto);
      if (t.estado === 'error') setCortado(t);
    }
    actual.current = t;
    setTrabajo(t);
  }, []);

  const pedir = useCallback(async () => {
    const r = rpRef.current;
    if (!r) return;
    const v = visto.current;
    let t = await r.estado(v?.n ?? 0);
    // Otro trabajo (lo arrancó otra pestaña, o MaKo por WhatsApp): sus cambios desde el principio.
    if (t && v && t.id !== v.id) t = await r.estado(0);
    absorber(t, true);
  }, [absorber]);

  // AL ABRIR: ¿hay uno corriendo? Primero sin cambios (un trabajo terminado puede traer un tablero
  // entero de cambios que ya están en lo que se cargó); si corre, entonces sí, desde el principio.
  useEffect(() => {
    if (!hay) return;
    let vivo = true;
    (async () => {
      try {
        const r = rpRef.current!;
        const t = await r.estado(Number.MAX_SAFE_INTEGER);
        if (!vivo || !t) return;
        if (t.estado === 'corriendo') { const t0 = await r.estado(0); if (vivo) absorber(t0, true); }
        else { visto.current = { id: t.id, n: t.nCambios }; actual.current = t; setTrabajo(t); }
      } catch (e) { console.warn('[repriorizar] estado al abrir:', e instanceof Error ? e.message : String(e)); }
    })();
    return () => { vivo = false; };
  }, [hay, absorber]);

  // EL SONDEO, sólo mientras corre. Con la pestaña escondida, más espaciado (el cron lo sigue igual).
  const corriendo = trabajo?.estado === 'corriendo';
  useEffect(() => {
    if (!hay || !corriendo) return;
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try { await pedir(); } catch (e) { console.warn('[repriorizar] sondeo:', e instanceof Error ? e.message : String(e)); }
      if (!vivo) return;
      timer = setTimeout(tick, typeof document !== 'undefined' && document.hidden ? SONDEO_MS * 5 : SONDEO_MS);
    };
    timer = setTimeout(tick, SONDEO_MS);
    return () => { vivo = false; if (timer) clearTimeout(timer); };
  }, [hay, corriendo, pedir]);

  const iniciar = useCallback(async () => {
    const r = rpRef.current;
    if (!r || arrancando) return;
    if (actual.current?.estado === 'corriendo') { oRef.current.avisar('Ya está re-priorizando'); return; }
    setArrancando(true);
    setCortado(null);
    try {
      const { trabajo: t, yaCorria } = await r.iniciar();
      absorber(t, true);
      if (t.estado === 'corriendo') oRef.current.avisar(yaCorria ? 'Ya está re-priorizando' : 'Re-priorizando en segundo plano');
      else { const a = avisoAlTerminar(t); if (a) oRef.current.avisar(a.texto); }
    } catch (e) {
      console.error('[repriorizar] iniciar:', e instanceof Error ? e.message : String(e));
      oRef.current.avisar('No se pudo re-priorizar');
    } finally { setArrancando(false); }
  }, [absorber, arrancando]);

  return {
    disponible: hay,
    trabajo,
    linea: lineaDeProgreso(trabajo),
    cortado,
    cerrarCortado: () => setCortado(null),
    iniciar,
    arrancando,
  };
}

/** El ícono de la entrada: dos flechas que reordenan. */
export function RepriorizarIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 20V4" /><path d="M3 8l4-4 4 4" /><path d="M17 4v16" /><path d="M21 16l-4 4-4-4" />
    </svg>
  );
}

/**
 * La LÍNEA CHICA del header: el avance mientras corre, o el corte con «Reintentar». Ocupa su propio
 * renglón del header (que envuelve), así que no empuja ni tapa ningún control, en escritorio ni en el
 * teléfono. `null` cuando no hay nada que decir.
 */
export function LineaRepriorizar({ trabajo, cortado, onReintentar, onCerrar }: {
  trabajo: Repriorizacion | null;
  cortado: Repriorizacion | null;
  onReintentar: () => void;
  onCerrar: () => void;
}) {
  const linea = lineaDeProgreso(trabajo);
  if (!linea && !cortado) return null;
  const base = { flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, fontFamily: SANS, fontSize: 12.5 } as const;
  if (linea && trabajo) {
    const pct = trabajo.total ? Math.round((Math.min(trabajo.hechas, trabajo.total) / trabajo.total) * 100) : 0;
    return (
      <div role="status" aria-live="polite" style={{ ...base, color: 'var(--dim)' }}>
        <span aria-hidden style={{ flex: 'none', width: 96, height: 4, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--primary)', transition: 'width .4s ease' }} />
        </span>
        <span style={{ fontFamily: MONO, fontSize: 12, whiteSpace: 'nowrap' }}>{linea}</span>
      </div>
    );
  }
  const c = cortado!;
  return (
    <div role="status" aria-live="polite" style={{ ...base, color: 'var(--ink)', flexWrap: 'wrap' }}>
      <span style={{ minWidth: 0 }}>Re-priorizar se cortó en <span style={{ fontFamily: MONO }}>{Math.min(c.hechas, c.total)}/{c.total}</span></span>
      <button type="button" onClick={onReintentar}
        style={{ flex: 'none', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--primary)', borderRadius: 7, padding: '3px 10px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
        Reintentar
      </button>
      <button type="button" onClick={onCerrar} aria-label="Cerrar el aviso"
        style={{ flex: 'none', border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 15, lineHeight: 1, cursor: 'pointer', padding: 2 }}>
        ✕
      </button>
    </div>
  );
}
