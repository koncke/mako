'use client';

// =============================================================================
// /api-mako › Registro — qué pidieron los tokens por /api/v1 (el «Security log» de GitHub)
// =============================================================================
// Contesta «¿me filtraron el token?»: cuánto, qué, desde dónde, con qué token y cómo salió.
// La tabla `api_llamadas` guarda la IP recortada (los dos últimos octetos en cero) y, desde
// la migración 0222, QUÉ token pidió (`token_id`: el id del detallado o `principal`). Sin esa
// migración aplicada el registro se lee igual, sin el desglose por token.
//
// Los días se arman ACÁ, con la zona del navegador: el server manda conteos por hora UTC
// (datos.ts). Agrupar en el server con una zona fija partía mal el día de un cliente de México.
// =============================================================================

import { useMemo, useState, type ReactNode } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import type { UsoApi } from './datos';
import { Icono, fechaCorta } from './piezas';

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

export function Registro({ uso, nombres }: { uso: UsoApi | { error: string }; nombres: Record<string, string> }) {
  const router = useRouter();
  const nombreDe = (id: string | null) => (!id ? '—' : id === 'principal' ? 'Skill de Claude (clásico)' : nombres[id] ?? `${id} (eliminado)`);
  const filtro = 'error' in uso ? null : uso.token;

  const opciones = Object.entries(nombres);
  return (
    <div style={{ paddingTop: 24 }}>
      <div className="gh-subhead">
        <h2 className="gh-subhead-heading">Registro</h2>
        <p className="gh-subhead-description" style={{ margin: 0 }}>Lo que pidieron tus tokens a la API en los últimos 30 días.</p>
      </div>
      {!('error' in uso) && uso.conToken && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <label htmlFor="rg-token" style={{ fontWeight: 600 }}>Token</label>
          <select id="rg-token" className="gh-form-control" style={{ width: 280 }} value={filtro ?? ''}
            onChange={(e) => router.push(`/api-mako?tab=registro${e.target.value ? `&token=${encodeURIComponent(e.target.value)}` : ''}`)}>
            <option value="">Todos los tokens</option>
            <option value="principal">Skill de Claude (clásico)</option>
            {opciones.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            {filtro && filtro !== 'principal' && !nombres[filtro] && <option value={filtro}>{nombreDe(filtro)}</option>}
          </select>
        </div>
      )}
      {'error' in uso ? (
        <div className="gh-flash gh-flash--error">{uso.error} Recarga la página.</div>
      ) : !uso.total ? (
        <div className="gh-box gh-blankslate">
          <Icono n="pulse" size={24} />
          <h3>Sin llamadas {filtro ? 'de este token ' : ''}todavía</h3>
          <p>Aquí aparece lo que piden tus tokens por /api/v1 en los últimos {uso.dias} días.</p>
          <Link href="/api-mako?tab=tokens">Ver los tokens</Link>
        </div>
      ) : (
        <ConDatos uso={uso} nombreDe={nombreDe} />
      )}
    </div>
  );
}

function ConDatos({ uso, nombreDe }: { uso: UsoApi; nombreDe: (id: string | null) => string }) {
  const serie = useMemo(() => dias(uso), [uso]);
  return (
    <>
      <div className="gh-cifras">
        <Cifra k={`Llamadas · ${uso.dias} días`} v={uso.total} />
        <Cifra k="Con error" v={uso.errores} peligro={uso.errores > 0} />
        <Cifra k="Desde IPs distintas" v={uso.porIp.length} />
      </div>

      <Caja titulo="Por día" nota={uso.muestra ? 'sobre las 5.000 más recientes' : undefined}>
        <div style={{ padding: 16 }}><Tira serie={serie} /></div>
      </Caja>

      {uso.conToken && !uso.token && uso.porToken.length > 0 && (
        <Caja titulo="Por token">
          <Tabla cab={['Token', 'Llamadas', 'Errores', 'Última']} filas={uso.porToken.map((t) => [
            t.token === 'sin dato' ? <span key="t" style={{ color: 'var(--gh-fg-muted)' }}>Antes del registro por token</span> : <Link key="t" href={`/api-mako?tab=registro&token=${encodeURIComponent(t.token)}`}>{nombreDe(t.token)}</Link>,
            t.total, t.errores || '—', fechaCorta(t.ultima),
          ])} />
        </Caja>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Caja titulo="Qué pidieron">
          <Tabla cab={['Operación', 'Llamadas', 'Errores']} filas={uso.porOperacion.map((o) => [<code key="o">{o.operacion}</code>, o.total, o.errores || '—'])} />
        </Caja>
        <Caja titulo="Desde dónde" nota="IP recortada">
          <Tabla cab={['IP', 'Llamadas', 'Última']} filas={uso.porIp.map((p) => [<code key="i">{p.ip}</code>, p.total, fechaCorta(p.ultima)])} />
        </Caja>
      </div>

      <Caja titulo="Últimas llamadas">
        <Tabla cab={uso.conToken ? ['Cuándo', 'Operación', 'Estado', 'ms', 'IP', 'Token'] : ['Cuándo', 'Operación', 'Estado', 'ms', 'IP']} filas={uso.ultimas.map((l) => [
          fechaCorta(l.cuando),
          <code key="o">{l.operacion}</code>,
          <span key="s" className={`gh-label ${l.status < 400 ? 'gh-label--success' : l.status < 500 ? 'gh-label--attention' : 'gh-label--danger'}`}>{l.status}</span>,
          l.ms,
          <code key="i" style={{ color: 'var(--gh-fg-muted)' }}>{l.ip}</code>,
          ...(uso.conToken ? [nombreDe(l.token)] : []),
        ])} />
      </Caja>
    </>
  );
}

function Cifra({ k, v, peligro }: { k: string; v: number; peligro?: boolean }) {
  return (
    <div className="gh-cifra">
      <div className="gh-cifra-k">{k}</div>
      <div className="gh-cifra-v" style={peligro ? { color: 'var(--gh-fg-danger)' } : undefined}>{v.toLocaleString('es')}</div>
    </div>
  );
}

function Caja({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <div className="gh-box" style={{ marginBottom: 16 }}>
      <div className="gh-box-header" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span className="gh-box-title">{titulo}</span>
        {nota && <span style={{ fontSize: 12, color: 'var(--gh-fg-muted)' }}>{nota}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * La tira de 30 barras: llamadas por día, con los errores apilados ARRIBA en rojo y un hueco
 * de 2 px entre los dos tramos. La columna entera es la zona de hover (más grande que la
 * barra), y la leyenda nombra los dos colores: el rojo nunca dice «error» solo.
 */
function Tira({ serie }: { serie: Dia[] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const max = Math.max(1, ...serie.map((d) => d.total));
  const ALTO = 120;
  const f = foco != null ? serie[foco] : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--gh-fg-muted)', alignItems: 'center', flexWrap: 'wrap' }}>
        <Leyenda clase="gh-tira-ok" texto="Bien" />
        <Leyenda clase="gh-tira-err" texto="Con error" />
        <span style={{ marginLeft: 'auto', color: f ? 'var(--gh-fg)' : 'var(--gh-fg-muted)' }}>
          {f ? `${f.rotulo}: ${f.total} llamadas${f.errores ? `, ${f.errores} con error` : ''}` : `Máximo: ${max} por día`}
        </span>
      </div>
      <div role="img" aria-label="Llamadas por día" className="gh-tira" onMouseLeave={() => setFoco(null)}>
        {serie.map((d, i) => {
          // Recortado al 100 % (AGENTS.md: una barra de gráfico se recorta, siempre).
          const hBien = Math.min(ALTO, Math.round(((d.total - d.errores) / max) * ALTO));
          const hErr = Math.min(ALTO - hBien, Math.round((d.errores / max) * ALTO));
          return (
            <div key={d.clave} className="gh-tira-col" data-foco={foco === i} title={`${d.rotulo}: ${d.total} llamadas${d.errores ? `, ${d.errores} con error` : ''}`}
              onMouseEnter={() => setFoco(i)} onFocus={() => setFoco(i)} tabIndex={0} style={{ gap: hErr && hBien ? 2 : 0 }}>
              {hErr > 0 && <div className="gh-tira-err" style={{ height: hErr }} />}
              {hBien > 0 && <div className="gh-tira-ok" style={{ height: hBien, borderRadius: hErr ? 0 : '4px 4px 0 0' }} />}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gh-fg-muted)' }}>
        <span>{serie[0]?.rotulo}</span><span>{serie[serie.length - 1]?.rotulo}</span>
      </div>
    </div>
  );
}

function Leyenda({ clase, texto }: { clase: string; texto: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className={clase} style={{ width: 10, height: 10, borderRadius: 3, margin: 0, display: 'inline-block' }} />{texto}</span>;
}

function Tabla({ cab, filas }: { cab: string[]; filas: ReactNode[][] }) {
  if (!filas.length) return <div style={{ padding: 16, color: 'var(--gh-fg-muted)' }}>—</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="gh-tabla" style={{ margin: 0, border: 0 }}>
        <thead><tr>{cab.map((c) => <th key={c} style={{ borderLeft: 0, borderRight: 0, borderTop: 0 }}>{c}</th>)}</tr></thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>{f.map((c, j) => <td key={j} style={{ borderLeft: 0, borderRight: 0, borderBottom: 0 }}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
