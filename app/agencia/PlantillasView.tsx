'use client';

// =============================================================================
// PlantillasView — todos los mensajes que MaKo le puede mandar al dueño
// =============================================================================
// Muestra el catálogo de avisos (biblioteca de voz de MaKo) agrupado por
// categoría, con el ejemplo real de cada mensaje, su prioridad, el semáforo y si
// la lógica ya está cableada. Es la vista de "templates" del admin.

import { useMemo, useState, type CSSProperties } from 'react';
import { CATALOGO_AVISOS, EMOJI_CATEGORIA, type CategoriaAviso, type AvisoCatalogo } from '@/lib/avisos-catalogo';

const MONO = "'Geist Mono', monospace";
const ORDEN: CategoriaAviso[] = ['reporte', 'aviso', 'accion', 'pregunta'];
const LABEL: Record<CategoriaAviso, string> = { reporte: 'Reportes', aviso: 'Avisos', accion: 'Acciones', pregunta: 'Preguntas' };
const SEM_COLOR: Record<string, string> = { rojo: 'var(--bad)', amarillo: 'var(--warn)', verde: 'var(--good)', na: 'var(--faint)' };
const IMPL: Record<string, { t: string; c: string }> = {
  si: { t: 'activo', c: 'var(--good)' }, parcial: { t: 'parcial', c: 'var(--warn)' }, no: { t: 'por venir', c: 'var(--faint)' },
};

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 };

function Tarjeta({ a }: { a: AvisoCatalogo }) {
  const impl = IMPL[a.yaImplementado] ?? IMPL.no;
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {a.semaforo !== 'na' && <span title={a.semaforo} style={{ width: 9, height: 9, borderRadius: '50%', background: SEM_COLOR[a.semaforo], flex: 'none' }} />}
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{a.titulo}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {a.requiereRespuesta && <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid var(--primary-weak)', borderRadius: 5, padding: '1px 5px' }}>responde</span>}
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.05em', textTransform: 'uppercase', color: impl.c, border: `1px solid ${impl.c}`, borderRadius: 5, padding: '1px 5px', opacity: 0.85 }}>{impl.t}</span>
        </span>
      </div>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, color: 'var(--dim)', background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>{a.ejemplo}</pre>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8, lineHeight: 1.4 }}>⚙︎ {a.disparador}</div>
    </div>
  );
}

export function PlantillasView() {
  const [filtro, setFiltro] = useState<CategoriaAviso | 'todas'>('todas');
  const grupos = useMemo(() => {
    const out: Record<CategoriaAviso, AvisoCatalogo[]> = { reporte: [], aviso: [], accion: [], pregunta: [] };
    for (const a of CATALOGO_AVISOS) out[a.categoria].push(a);
    return out;
  }, []);
  const cats = filtro === 'todas' ? ORDEN : [filtro];

  return (
    <div>
      <p style={{ color: 'var(--dim)', fontSize: 14.5, lineHeight: 1.5, margin: '0 0 16px', maxWidth: 620 }}>
        Todos los mensajes que MaKo le puede mandar al dueño ({CATALOGO_AVISOS.length}). Es la voz de MaKo —
        algunos ya se disparan solos y otros están por cablearse.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {(['todas', ...ORDEN] as const).map((k) => {
          const on = filtro === k;
          const n = k === 'todas' ? CATALOGO_AVISOS.length : grupos[k].length;
          return (
            <button key={k} type="button" onClick={() => setFiltro(k)}
              style={{ padding: '6px 13px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: on ? 'var(--primary-strong)' : 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {k === 'todas' ? 'Todas' : `${EMOJI_CATEGORIA[k]} ${LABEL[k]}`} · {n}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {cats.map((cat) => (
          <div key={cat}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 10 }}>{EMOJI_CATEGORIA[cat]} {LABEL[cat]}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {grupos[cat].map((a) => <Tarjeta key={a.id} a={a} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
