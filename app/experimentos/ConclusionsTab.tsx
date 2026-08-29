'use client';

// =============================================================================
// ConclusionsTab — las verdades validadas, con datos
// =============================================================================

import { useState } from 'react';
import type { Experimento, Punto, Veredicto } from '@/lib/experimentos';
import { MONO, card, Pill, Spark, Empty, fmtVal, fmtFechaLarga } from './ui';

const VER: Record<Veredicto, { label: string; tone: 'good' | 'bad' | 'warn'; color: string }> = {
  validada: { label: 'Validada', tone: 'good', color: 'var(--good)' },
  refutada: { label: 'Refutada', tone: 'bad', color: 'var(--bad)' },
  no_concluyente: { label: 'No concluyente', tone: 'warn', color: 'var(--warn)' },
};

type Filtro = 'todas' | Veredicto;

export function ConclusionsTab({ aprendizajes }: { aprendizajes: Experimento[] }) {
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const cuenta = (v: Veredicto) => aprendizajes.filter((e) => e.veredicto === v).length;
  const filtradas = filtro === 'todas' ? aprendizajes : aprendizajes.filter((e) => e.veredicto === filtro);

  const chips: Array<{ key: Filtro; label: string; n: number }> = [
    { key: 'todas', label: 'Todas', n: aprendizajes.length },
    { key: 'validada', label: 'Validadas', n: cuenta('validada') },
    { key: 'refutada', label: 'Refutadas', n: cuenta('refutada') },
    { key: 'no_concluyente', label: 'No concluyentes', n: cuenta('no_concluyente') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--dim)', maxWidth: 620, lineHeight: 1.55 }}>
        Cada conclusión nació de un experimento cerrado: es una <b>verdad de tu negocio respaldada por el dato</b>. Lo único que MaKo puede afirmar sin probar de nuevo.
      </p>

      {aprendizajes.length === 0 ? (
        <Empty titulo="Todavía no hay conclusiones"
          sub="Cuando cierras un experimento, MaKo lee el dato medido y deja aquí la lectura: validada, refutada o no concluyente. Arranca un experimento en la tab Experiments." />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chips.map((c) => {
              const on = c.key === filtro;
              return (
                <button key={c.key} type="button" onClick={() => setFiltro(c.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999, border: `1px solid ${on ? 'var(--ink)' : 'var(--border-strong)'}`, background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--dim)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  {c.label} <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.7 }}>{c.n}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtradas.map((e) => <ConclusionCard key={e.id} e={e} />)}
          </div>
        </>
      )}
    </div>
  );
}

function ConclusionCard({ e }: { e: Experimento }) {
  const v = VER[e.veredicto ?? 'no_concluyente'];
  const serie = ((e.config?.serie_cierre as Punto[] | undefined) ?? []);
  return (
    <div style={{ ...card, display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap', borderLeft: `3px solid ${v.color}` }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Pill tone={v.tone}>{v.label}</Pill>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{e.titulo}</span>
        </div>
        <p style={{ margin: '11px 0 0', fontSize: 15.5, color: 'var(--ink)', lineHeight: 1.55, fontWeight: 500 }}>{e.aprendizaje || '—'}</p>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Pill>📏 {e.metrica_label ?? e.metrica}</Pill>
          <Pill>{fmtVal(e.baseline_valor, e.metrica)} → {fmtVal(e.resultado_valor, e.metrica)}</Pill>
          <Pill>cerrado {fmtFechaLarga(e.cerrado_at)}</Pill>
        </div>
      </div>
      {serie.length >= 2 && (
        <div style={{ width: 210, minWidth: 170, alignSelf: 'center' }}>
          <Spark serie={serie} color={v.color} height={72} />
        </div>
      )}
    </div>
  );
}
