'use client';

// =============================================================================
// ElementoExperimento — un experimento en la hoja: la propuesta, la medición en vivo y el veredicto
// =============================================================================
// Martín, 17/10/2026: «Quiero que "Experiments" la simplifiques completamente: la funcionalidad, o lo que pretendía,
// puede vivir dentro del chat de MaKo de "Dashboard"». Se pide en «Editar con MaKo» («probemos X»): la IA arma la
// propuesta (lib/experimentos-catalogo.ts) y la hoja la muestra acá. Tres momentos, en el mismo lugar:
//   · PROPUESTO: la hipótesis, qué se mide y por cuántos días, y «Arrancar». Arrancar NO escribe la hoja: el
//     experimento guarda de qué elemento salió (`config.elemento`, app/api/experimentos/route.ts) y éste lo busca por
//     su id. Por eso se arranca mirando la hoja, sin entrar a editarla.
//   · EN CURSO: cómo venía (los mismos días antes de arrancar) contra cómo va, la variación y la serie. El dato es el
//     real y se mide al abrir (lib/experimentos.ts, `medir`).
//   · TERMINADO: «Concluir» (cuando se cumplió la ventana) y MaKo dicta el veredicto y el aprendizaje, que queda en su
//     contexto como una verdad de este negocio. Es el único lugar donde MaKo concluye: sobre el dato medido.
// En un link compartido no se pide nada (la ruta es del admin): se ve la propuesta.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import type { Elemento } from '@/lib/graficos-catalogo';
import { metricaExperimento, textoDireccion, type PropuestaExperimento } from '@/lib/experimentos-catalogo';
import { fmtDelta, fmtFechaCorta, fmtVal } from '@/lib/experimentos-formato';

type Punto = { fecha: string; valor: number | null };
type Leido = {
  id: number; titulo: string; hipotesis: string; estado: 'propuesto' | 'activo' | 'cerrado' | 'descartado';
  metrica: string; metrica_label: string | null; direccion: 'subir' | 'bajar'; ventana_dias: number;
  baseline_valor: number | null; resultado_valor: number | null; veredicto: 'validada' | 'refutada' | 'no_concluyente' | null;
  aprendizaje: string | null; fecha_inicio: string | null; fecha_fin: string | null;
  config: { serie_cierre?: Punto[] } | null;
  medicion: {
    baseline: number | null; actual: number | null; dias_corridos: number; dias_total: number; delta_pct: number | null;
    va_bien: boolean | null; serie: Punto[]; baseline_desde: string; baseline_hasta: string;
  } | null;
};

/** El veredicto en palabras (nunca «validada»: es vocabulario de la base). */
const VEREDICTO: Record<NonNullable<Leido['veredicto']>, { texto: string; color: string }> = {
  validada: { texto: 'Se cumplió', color: 'var(--good)' },
  refutada: { texto: 'No se cumplió', color: 'var(--bad)' },
  no_concluyente: { texto: 'No alcanza para decir', color: 'var(--warn)' },
};

export function ElementoExperimento({ e, editando, compartido }: { e: Elemento; editando: boolean; compartido: boolean }) {
  const x = e.experimento;
  const propuesta = x?.propuesta ?? null;
  const [leido, setLeido] = useState<Leido | null>(null);
  const [cargando, setCargando] = useState(!compartido);
  const [ocupado, setOcupado] = useState<'arrancar' | 'concluir' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leer = useCallback(async () => {
    if (compartido || !x) return;
    setCargando(true);
    setError(null);
    try {
      const q = x.id ? `id=${x.id}` : `elemento=${encodeURIComponent(e.id)}`;
      const r = await fetch(`/api/experimentos?${q}`, { cache: 'no-store' });
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string; experimento?: Leido | null } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'No pude leer el experimento.');
      setLeido(j.experimento ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, [compartido, x, e.id]);

  useEffect(() => { void leer(); }, [leer]);

  const pedir = async (cuerpo: Record<string, unknown>, que: 'arrancar' | 'concluir') => {
    setOcupado(que);
    setError(null);
    try {
      const r = await fetch('/api/experimentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string; experimento?: Leido | null } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'No se pudo.');
      setLeido(j.experimento ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOcupado(null);
    }
  };

  if (!x) return <Caja><span style={S.dim}>Este experimento ya no está.</span></Caja>;
  const titulo = e.texto || leido?.titulo || propuesta?.titulo || 'Experimento';

  // Sin experimento en la base: la propuesta, con «Arrancar».
  if (!leido) {
    return (
      <Caja>
        <Cabeza titulo={titulo} estado="Propuesto" />
        {propuesta && <Propuesta p={propuesta} />}
        {cargando ? <span style={S.dim}>Mirando si ya arrancó…</span> : !compartido && propuesta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 'auto' }}>
            <button type="button" style={S.boton} disabled={editando || !!ocupado}
              onClick={() => void pedir({ action: 'arrancar', elemento: e.id, propuesta }, 'arrancar')}>
              {ocupado === 'arrancar' ? 'Arrancando…' : 'Arrancar'}
            </button>
            <span style={S.dim}>MaKo mide cómo venía y desde hoy lo compara.</span>
          </div>
        )}
        {error && <span style={S.error} role="alert">{error}</span>}
      </Caja>
    );
  }

  const metrica = leido.metrica;
  const nombreMetrica = leido.metrica_label || metricaExperimento(metrica)?.label || metrica;

  // Terminado: el veredicto y lo que aprendió.
  if (leido.estado === 'cerrado') {
    const v = VEREDICTO[leido.veredicto ?? 'no_concluyente'];
    return (
      <Caja>
        <Cabeza titulo={titulo} estado={v.texto} color={v.color} />
        <Numeros nombre={nombreMetrica} antes={fmtVal(leido.baseline_valor, metrica)} ahora={fmtVal(leido.resultado_valor, metrica)} />
        {leido.aprendizaje && <p style={S.aprendizaje}>{leido.aprendizaje}</p>}
        <Serie puntos={leido.config?.serie_cierre ?? []} color={v.color} />
      </Caja>
    );
  }

  const m = leido.medicion;
  const termino = !!m && m.dias_corridos >= m.dias_total;
  const color = m?.va_bien == null ? 'var(--dim)' : m.va_bien ? 'var(--good)' : 'var(--bad)';
  return (
    <Caja>
      <Cabeza titulo={titulo} estado={m ? `Día ${m.dias_corridos} de ${m.dias_total}` : 'En curso'} />
      {m ? (
        <>
          <Numeros nombre={`${nombreMetrica} · ${textoDireccion(leido.direccion)}`} antes={fmtVal(m.baseline, metrica)} ahora={fmtVal(m.actual, metrica)}
            delta={m.delta_pct == null ? null : fmtDelta(m.delta_pct)} color={color}
            rango={`Antes: ${fmtFechaCorta(m.baseline_desde)} al ${fmtFechaCorta(m.baseline_hasta)}`} />
          <Serie puntos={m.serie} color={color} />
        </>
      ) : <span style={S.dim}>No pude medirlo ahora. Vuelve a abrir la hoja en un rato.</span>}
      {!compartido && termino && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 'auto' }}>
          <button type="button" style={S.boton} disabled={editando || !!ocupado} onClick={() => void pedir({ action: 'concluir', id: leido.id }, 'concluir')}>
            {ocupado === 'concluir' ? 'MaKo lo está leyendo…' : 'Concluir'}
          </button>
          <span style={S.dim}>Se cumplió la ventana: MaKo dice si se cumplió.</span>
        </div>
      )}
      {error && <span style={S.error} role="alert">{error}</span>}
    </Caja>
  );
}

function Caja({ children }: { children: React.ReactNode }) {
  return <div style={S.caja}>{children}</div>;
}

function Cabeza({ titulo, estado, color = 'var(--primary)' }: { titulo: string; estado: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
      <span style={S.titulo}>{titulo}</span>
      <span style={{ ...S.chip, color }}>{estado}</span>
    </div>
  );
}

function Propuesta({ p }: { p: PropuestaExperimento }) {
  const m = metricaExperimento(p.metrica);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <p style={S.hipotesis}>«{p.hipotesis}»</p>
      <span style={S.linea}>Mide <strong>{m?.label ?? p.metrica}</strong> ({textoDireccion(p.direccion)}) durante {p.ventana_dias} días.</span>
      {p.cambio && <span style={S.linea}>Qué cambia: {p.cambio}</span>}
      {p.criterio_exito && <span style={S.linea}>Se cumple si: {p.criterio_exito}</span>}
    </div>
  );
}

function Numeros({ nombre, antes, ahora, delta = null, color = 'var(--ink)', rango }: {
  nombre: string; antes: string; ahora: string; delta?: string | null; color?: string; rango?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={S.linea}>{nombre}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={S.antes}>{antes}</span>
        <span aria-hidden style={S.dim}>→</span>
        <span style={{ ...S.ahora, color }}>{ahora}</span>
        {delta && <span style={{ fontSize: 14, fontWeight: 600, color }}>{delta}</span>}
      </div>
      {rango && <span style={S.dim}>{rango}</span>}
    </div>
  );
}

/** La serie, como una línea sin ejes: la forma de cómo viene, no un gráfico para leer números. */
function Serie({ puntos, color }: { puntos: readonly Punto[]; color: string }) {
  const vals = puntos.map((p) => p.valor).filter((v): v is number => v != null && Number.isFinite(v));
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const rango = max - min || 1;
  const pts = puntos
    .map((p, i) => (p.valor == null ? null : `${(i / (puntos.length - 1)) * 100},${36 - ((p.valor - min) / rango) * 32}`))
    .filter(Boolean)
    .join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden style={{ width: '100%', height: 44, display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const S = {
  caja: { height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, padding: 'var(--dash-tarjeta-pad, 18px 20px)', overflow: 'auto', fontFamily: 'var(--dash-letra, inherit)' },
  titulo: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25, overflowWrap: 'anywhere' },
  chip: { flex: 'none', fontSize: 12, fontWeight: 600 },
  hipotesis: { margin: 0, fontSize: 14, lineHeight: 1.45, color: 'var(--ink)', fontStyle: 'italic', overflowWrap: 'anywhere' },
  linea: { fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', overflowWrap: 'anywhere' },
  antes: { fontSize: 18, fontWeight: 600, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' },
  ahora: { fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' },
  aprendizaje: { margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--ink)', overflowWrap: 'anywhere' },
  dim: { fontSize: 12.5, color: 'var(--faint)' },
  error: { fontSize: 12.5, color: 'var(--bad)' },
  boton: { height: 34, padding: '0 16px', borderRadius: 17, border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' },
} satisfies Record<string, React.CSSProperties>;
