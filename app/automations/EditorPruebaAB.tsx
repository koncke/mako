'use client';
// =============================================================================
// EditorPruebaAB — el editor de la tarjeta «A/B TEST» (tanda A3 de las pruebas A/B, 25/10/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md (3.1 y 2.9). Lo que se edita es la TARJETA (sus ramas: letra, nombre, porcentaje); lo que se
// prueba lo decide el juez (lib/pruebas/juez.ts) con el plan que se calcula al empezar:
//   · de 2 a 4 filas «A · 50 %», que suman 100, de a 5, 10 o más cada una. A es «Sin cambio» (el control): no se borra ni
//     se renombra. Cada fila es una salida del lienzo;
//   · arriba, el estado de la prueba (mientras corre, sin verde ni rojo). Sin prueba corriendo, todos van a A, y lo dice;
//   · «Empezar la prueba» corre sobre lo PUBLICADO (lo que corre el motor): primero se publica;
//   · mientras corre, cambiar un porcentaje o lo de una rama abre una época nueva al publicar (sólo cuentan los que entran
//     después): lo dice antes de que pase.
// =============================================================================

import { useState, type CSSProperties } from 'react';
import { inpLienzo } from '@/app/_components/Lienzo';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { MAX_RAMAS_AB, MIN_PCT_AB, MIN_RAMAS_AB, PASO_PCT_AB, TOPE_NOMBRE_RAMA_AB, type PasoGrafo, type RamaAB } from '@/lib/flujo-grafo';
import type { EstadoPruebaAB } from './usePruebaAB';

const SANS = 'inherit';
const caja: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 };
const rotulo: CSSProperties = { fontSize: 12, color: 'var(--dim)', fontWeight: 600 };

export function EditorPruebaAB({ paso, busy, cambiar, onAgregarRama, onQuitarRama, prueba, accion, id, publicado }: {
  paso: PasoGrafo;
  id: string;
  busy: boolean;
  cambiar: (patch: { ramas_ab: RamaAB[] }, apilar: boolean) => void;
  onAgregarRama: () => void;
  onQuitarRama: (clave: string) => void;
  prueba: EstadoPruebaAB | null;
  accion: (a: 'empezar' | 'detener', nodoId?: string) => Promise<{ ok: boolean; plan?: string; error?: string }>;
  /** ¿Lo que se ve es lo publicado? (Sin cambios sin publicar: la prueba corre sobre lo publicado.) */
  publicado: boolean;
}) {
  const ramas = paso.ramas_ab ?? [];
  const [aviso, setAviso] = useState<{ texto: string; tono: 'ok' | 'bad' } | null>(null);
  const [yendo, setYendo] = useState(false);
  const corre = prueba?.estado === 'corriendo';
  const suma = ramas.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const poner = (k: number, patch: Partial<RamaAB>, apilar: boolean) => cambiar({ ramas_ab: ramas.map((r, j) => (j === k ? { ...r, ...patch } : r)) }, apilar);

  const empezar = async () => {
    setYendo(true);
    const r = await accion('empezar', id);
    setYendo(false);
    setAviso(r.ok ? { texto: r.plan ?? 'La prueba empezó.', tono: 'ok' } : { texto: r.error ?? 'No pude empezarla.', tono: 'bad' });
  };
  const detener = async () => {
    setYendo(true);
    const r = await accion('detener');
    setYendo(false);
    setAviso(r.ok ? { texto: 'Detenida: todos van a A.', tono: 'ok' } : { texto: r.error ?? 'No pude detenerla.', tono: 'bad' });
  };

  return (
    <div style={caja} data-editor-ab="">
      <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)' }} data-estado-ab="">{prueba?.texto ?? 'Sin prueba: todos van a A.'}</div>
      <span style={rotulo}>Ramas</span>
      {ramas.map((r, k) => (
        <div key={r.clave} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 7, display: 'grid', placeItems: 'center', fontWeight: 700, background: 'var(--surface-2)', color: 'var(--ink)' }}>{r.clave}</span>
          <input value={r.clave === 'A' ? 'Sin cambio' : (r.nombre ?? '')} disabled={busy || r.clave === 'A'} maxLength={TOPE_NOMBRE_RAMA_AB}
            placeholder="Qué cambia (para ti)" aria-label={`Nombre de la rama ${r.clave}`}
            onChange={(e) => poner(k, { nombre: e.target.value }, false)} style={{ ...inpLienzo, flex: '1 1 auto', minWidth: 0 }} />
          <input type="number" min={MIN_PCT_AB} max={100 - MIN_PCT_AB} step={PASO_PCT_AB} value={r.pct} disabled={busy} aria-label={`Porcentaje de la rama ${r.clave}`}
            onChange={(e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v)) poner(k, { pct: v }, false); }}
            style={{ ...inpLienzo, width: 72, flex: 'none', textAlign: 'right' }} />
          <span style={{ fontSize: 13, color: 'var(--dim)', flex: 'none' }}>%</span>
          {r.clave !== 'A' && ramas.length > MIN_RAMAS_AB
            ? <BotonBorrar talla="xs" onClick={() => onQuitarRama(r.clave)} disabled={busy} title={`Quitar la rama ${r.clave}`} />
            : <span style={{ width: 24, flex: 'none' }} />}
        </div>
      ))}
      {suma !== 100 && <span style={{ fontSize: 12, color: 'var(--bad)' }}>Suman {suma} %: tienen que sumar 100.</span>}
      {ramas.length < MAX_RAMAS_AB && (
        <button type="button" onClick={onAgregarRama} disabled={busy} aria-label="Agregar una rama"
          style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--primary)', cursor: busy ? 'default' : 'pointer', fontFamily: SANS }}>
          ＋ Rama
        </button>
      )}
      {corre && <span style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.45 }}>Si cambias un porcentaje o lo de una rama, al publicar la prueba vuelve a empezar: sólo cuentan los que entran después.</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        {corre || prueba?.estado === 'propuesta' ? (
          <button type="button" onClick={() => void detener()} disabled={busy || yendo}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
            Detener la prueba
          </button>
        ) : (
          <button type="button" onClick={() => void empezar()} disabled={busy || yendo || !publicado || suma !== 100 || prueba?.sinTablas === true}
            title={!publicado ? 'Publica la automatización primero: la prueba corre sobre lo publicado' : undefined}
            style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'var(--on-primary, #fff)', fontWeight: 600, cursor: 'pointer', fontFamily: SANS, opacity: !publicado || suma !== 100 ? 0.55 : 1 }}>
            Empezar la prueba
          </button>
        )}
        {!publicado && !corre && <span style={{ fontSize: 12, color: 'var(--dim)' }}>Publica para empezar.</span>}
      </div>
      {aviso && <span role="status" style={{ fontSize: 12.5, lineHeight: 1.45, color: aviso.tono === 'bad' ? 'var(--bad)' : 'var(--ink)' }}>{aviso.texto}</span>}
    </div>
  );
}
