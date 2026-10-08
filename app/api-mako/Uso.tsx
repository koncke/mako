'use client';

// =============================================================================
// /api-mako › Uso — qué pidieron los tokens por /api/v1, de `api_llamadas`
// =============================================================================
// Contesta «¿me filtraron el token?»: cuánto, qué, desde dónde y cómo salió. La
// tabla guarda la IP recortada (dos últimos octetos en cero) y no guarda QUÉ token
// pidió; el «último uso» de cada token está en la vista Tokens.
//
// Los días se arman ACÁ, con la zona del navegador: el server manda conteos por
// hora UTC (datos.ts). Agrupar en el server con una zona fija partía mal el día de
// un cliente de México.
// =============================================================================

import { useMemo, useState, type ReactNode } from 'react';
import { Banner, EmptyState, Section, Status } from '@/app/_ui';
import type { UsoApi } from './datos';
import { Mono, fechaCorta } from './piezas';

const DIA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

type Dia = { clave: string; rotulo: string; total: number; errores: number };

function dias(uso: UsoApi): Dia[] {
  const out = new Map<string, Dia>();
  // Los 30 días, aunque estén vacíos: un hueco en la tira también dice algo.
  for (let i = uso.dias - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const clave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    out.set(clave, { clave, rotulo: DIA.format(d), total: 0, errores: 0 });
  }
  uso.porHora.total.forEach((n, i) => {
    if (!n) return;
    const d = new Date(uso.desdeMs + i * 3_600_000);
    const x = out.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    if (!x) return;
    x.total += n;
    x.errores += uso.porHora.errores[i] ?? 0;
  });
  return [...out.values()];
}

export function Uso({ uso, irATokens }: { uso: UsoApi | { error: string }; irATokens: () => void }) {
  if ('error' in uso) return <Banner tono="bad">{uso.error} Recarga la página.</Banner>;
  if (!uso.total) {
    return (
      <EmptyState titulo="Sin llamadas todavía"
        detalle={`Aquí aparece lo que piden tus tokens por /api/v1 en los últimos ${uso.dias} días.`}
        accion={{ label: 'Ver tokens', onClick: irATokens }} />
    );
  }
  return <ConDatos uso={uso} />;
}

function ConDatos({ uso }: { uso: UsoApi }) {
  const serie = useMemo(() => dias(uso), [uso]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Kpi k={`Llamadas · ${uso.dias} días`} v={uso.total} />
        <Kpi k="Con error" v={uso.errores} tono={uso.errores ? 'bad' : undefined} />
        <Kpi k="Desde IPs distintas" v={uso.porIp.length} />
      </div>

      <Section titulo="Por día" nota={uso.muestra ? 'sobre las 5.000 más recientes' : undefined}>
        <Tira serie={serie} />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--sect-gap)' }}>
        <Section titulo="Qué pidieron">
          <Tabla cab={['Operación', 'Llamadas', 'Errores']} filas={uso.porOperacion.map((o) => [<Mono key="o">{o.operacion}</Mono>, o.total, o.errores || '—'])} />
        </Section>
        <Section titulo="Desde dónde" nota="IP recortada">
          <Tabla cab={['IP', 'Llamadas', 'Última']} filas={uso.porIp.map((p) => [<Mono key="i">{p.ip}</Mono>, p.total, fechaCorta(p.ultima)])} />
        </Section>
      </div>

      <Section titulo="Últimas llamadas">
        <Tabla cab={['Cuándo', 'Operación', 'Estado', 'ms', 'IP']} filas={uso.ultimas.map((l) => [
          fechaCorta(l.cuando),
          <Mono key="o">{l.operacion}</Mono>,
          <Status key="s" tono={l.status < 400 ? 'good' : l.status < 500 ? 'warn' : 'bad'}>{l.status}</Status>,
          l.ms,
          <Mono key="i" tenue>{l.ip}</Mono>,
        ])} />
      </Section>
    </div>
  );
}

function Kpi({ k, v, tono }: { k: string; v: number; tono?: 'bad' }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>{k}</div>
      <div style={{ fontSize: 'var(--fs-kpi)', fontWeight: 650, color: tono === 'bad' ? 'var(--bad)' : 'var(--ink)', lineHeight: 1.2 }}>{v.toLocaleString('es')}</div>
    </div>
  );
}

/**
 * La tira de 30 barras: llamadas por día, con los errores apilados ARRIBA en rojo
 * y un hueco de 2 px de superficie entre los dos tramos. La columna entera es la
 * zona de hover (más grande que la barra), y la leyenda nombra los dos colores:
 * el rojo nunca dice «error» solo.
 */
function Tira({ serie }: { serie: Dia[] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const max = Math.max(1, ...serie.map((d) => d.total));
  const ALTO = 120;
  const f = foco != null ? serie[foco] : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 14, fontSize: 'var(--fs-meta)', color: 'var(--dim)', alignItems: 'center', flexWrap: 'wrap' }}>
        <Leyenda color="var(--primary)" texto="Bien" />
        <Leyenda color="var(--bad)" texto="Con error" />
        <span style={{ marginLeft: 'auto', color: f ? 'var(--ink)' : 'var(--faint)' }}>
          {f ? `${f.rotulo}: ${f.total} llamadas${f.errores ? `, ${f.errores} con error` : ''}` : `Máximo: ${max} por día`}
        </span>
      </div>
      <div role="img" aria-label="Llamadas por día" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: ALTO, borderBottom: '1px solid var(--border)' }}
        onMouseLeave={() => setFoco(null)}>
        {serie.map((d, i) => {
          // Recortado al 100 % (AGENTS.md: una barra de gráfico se recorta, siempre).
          const hBien = Math.min(ALTO, Math.round(((d.total - d.errores) / max) * ALTO));
          const hErr = Math.min(ALTO - hBien, Math.round((d.errores / max) * ALTO));
          return (
            <div key={d.clave} title={`${d.rotulo}: ${d.total} llamadas${d.errores ? `, ${d.errores} con error` : ''}`}
              onMouseEnter={() => setFoco(i)} onFocus={() => setFoco(i)} tabIndex={0}
              style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: hErr && hBien ? 2 : 0, cursor: 'default', outline: 'none', background: foco === i ? 'var(--surface-2)' : 'transparent', borderRadius: '4px 4px 0 0' }}>
              {hErr > 0 && <div style={{ height: hErr, background: 'var(--bad)', borderRadius: '4px 4px 0 0', margin: '0 18%' }} />}
              {hBien > 0 && <div style={{ height: hBien, background: 'var(--primary)', borderRadius: hErr ? 0 : '4px 4px 0 0', margin: '0 18%' }} />}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>
        <span>{serie[0]?.rotulo}</span><span>{serie[serie.length - 1]?.rotulo}</span>
      </div>
    </div>
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />{texto}</span>;
}

function Tabla({ cab, filas }: { cab: string[]; filas: ReactNode[][] }) {
  if (!filas.length) return <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>—</div>;
  return (
    <div className="mk-scroll-x" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--faint)', fontSize: 'var(--fs-meta)' }}>
            {cab.map((c) => <th key={c} style={{ padding: '0 12px 8px 0', fontWeight: 500 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
              {f.map((c, j) => <td key={j} style={{ padding: '8px 12px 8px 0', color: 'var(--dim)' }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
