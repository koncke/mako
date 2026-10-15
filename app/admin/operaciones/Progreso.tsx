'use client';

// =============================================================================
// Progreso — En curso · Pedidos · Pushes, en la computadora (15/10/2026)
// =============================================================================
// Copiado de la vista de TABLA de GitHub Projects (filas agrupadas por estado, con su cuenta y
// plegables; capturada de su guía oficial el 15/10), la lista de deployments de Vercel para los pushes
// (abierta en la sesión de Martín el 15/10) y el «Activity» de un issue de Linear para el detalle de un
// pedido (de su página; la app pide sesión). Las reglas viven en lib/progreso-reglas.ts.
//
// ⚠️ Sin scroll horizontal (pedido del coordinador): la tabla es `table-layout: fixed`, lo largo se corta
// con «…» y el detalle entero va en la fila que se abre. En una pantalla angosta (una tablet) se esconden
// las columnas que menos dicen (`.prog-opc`), nunca el estado.
// ⚠️ El color va en el PUNTO, nunca en el texto.

import { Fragment, useState, type KeyboardEvent } from 'react';
import Link from '@/app/_ui/Link';
import { ErrorState } from '@/app/_ui';
import {
  ROTULO_PEDIDO, ROTULO_PUSH, ROTULO_TIPO, duracion, hace, type EstadoPedidoP, type EstadoPush, type Frente,
  type PedidoP, type PushP,
} from '@/lib/progreso-reglas';
import type { LecturaPushes } from '@/lib/progreso';
import './progreso.css';

export type VistaProgreso = 'curso' | 'pedidos' | 'pushes';

type Tono = 'good' | 'bad' | 'warn' | 'info' | 'neutro';
const TONO_PEDIDO: Record<EstadoPedidoP, Tono> = { pendiente: 'warn', en_curso: 'info', hecho: 'good' };
const TONO_PUSH: Record<EstadoPush, Tono> = { listo: 'good', error: 'bad', construyendo: 'warn', en_cola: 'neutro', cancelado: 'neutro' };
const TONO_TIPO: Record<string, Tono> = { prompt: 'warn', implementacion: 'good', correccion: 'info', investigacion: 'info', cosecha: 'neutro' };

const Punto = ({ tono }: { tono: Tono }) => <span className={`prog-dot prog-dot--${tono}`} aria-hidden />;

/** Una fila que se abre con el clic y también con el teclado (Enter o espacio), como las de Linear. */
function abre(alternar: () => void, abierta: boolean) {
  return {
    tabIndex: 0,
    'aria-expanded': abierta,
    onClick: alternar,
    onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } },
  };
}

/** «Hoy», «Ayer» o «Antes», con el día de Argentina. */
function diaDe(instante: number, ahora: number): 'Hoy' | 'Ayer' | 'Antes' {
  const dia = (t: number) => Math.floor((t - 3 * 3_600_000) / 86_400_000);
  const d = dia(ahora) - dia(instante);
  return d <= 0 ? 'Hoy' : d === 1 ? 'Ayer' : 'Antes';
}

function Grupo({ titulo, n, abierto, onToggle, columnas }: { titulo: string; n: number; abierto: boolean; onToggle: () => void; columnas: number }) {
  return (
    <tr className="prog-grupo">
      <td colSpan={columnas}>
        <button type="button" className="prog-grupo__btn" aria-expanded={abierto} onClick={onToggle}>
          <span className={`prog-chev${abierto ? ' prog-chev--abierto' : ''}`} aria-hidden>›</span>
          {titulo} <span className="prog-n">{n}</span>
        </button>
      </td>
    </tr>
  );
}

// ── En curso ──────────────────────────────────────────────────────────────────────────────────
function EnCurso({ frentes, hayCartero, ahora }: { frentes: Frente[]; hayCartero: boolean; ahora: number }) {
  const [cerrados, setCerrados] = useState<Set<string>>(new Set());
  const grupos = (['Hoy', 'Ayer', 'Antes'] as const).map((g) => ({ g, filas: frentes.filter((f) => diaDe(f.instante, ahora) === g) })).filter((x) => x.filas.length);
  return (
    <>
      <p className="prog-nota">Últimas 48 h, de las bitácoras de cada área.{hayCartero ? '' : ' Los chats abiertos y lo sin subir aparecen con el cartero instalado.'}</p>
      {!frentes.length ? <p className="prog-vacio">Nada se movió en las últimas 48 h.</p> : (
        <div className="prog-caja">
          <table className="prog-tabla">
            <thead><tr><th style={{ width: '20%' }}>Área</th><th style={{ width: '17%' }}>Chat</th><th>Último movimiento</th><th className="prog-opc" style={{ width: '11%' }}>Pendientes</th><th style={{ width: '11%' }}>Hace</th></tr></thead>
            <tbody>
              {grupos.map(({ g, filas }) => (
                <Fragment key={g}>
                  <Grupo titulo={g} n={filas.length} columnas={5} abierto={!cerrados.has(g)}
                    onToggle={() => setCerrados((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; })} />
                  {!cerrados.has(g) && filas.map((f) => (
                    <tr key={f.slug} className="prog-fila">
                      <td><Link href={`/admin/dev/${f.slug}`} className="prog-link">{f.area}</Link></td>
                      <td title={f.chat}>{f.chat}</td>
                      <td title={f.ultimo}><Punto tono={TONO_TIPO[f.tipo] ?? 'neutro'} /><span className="prog-tipo">{ROTULO_TIPO[f.tipo] ?? f.tipo}</span> {f.ultimo}</td>
                      <td className="prog-opc prog-num">{f.pendientes || '—'}</td>
                      <td className="prog-num">{hace(f.instante, ahora)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Pedidos ───────────────────────────────────────────────────────────────────────────────────
function DetallePedido({ p, ahora }: { p: PedidoP; ahora: number }) {
  return (
    <div className="prog-actividad">
      <div className="prog-paso">
        <Punto tono="warn" /><strong>Martín pidió</strong><span className="prog-meta">{hace(p.instante, ahora)} · {p.areas.join(', ')}</span>
        <p className="prog-texto">{p.texto}</p>
        {p.junto > 0 && <p className="prog-meta">{`Anotado junto con ${p.junto} ${p.junto === 1 ? 'pedido más' : 'pedidos más'}: lo que sigue responde a todos.`}</p>}
      </div>
      {p.pasos.length === 0 &&<div className="prog-paso"><Punto tono="neutro" /><span className="prog-meta">Ningún chat lo anotó como empezado todavía.</span></div>}
      {p.pasos.map((s, i) => (
        <div key={i} className="prog-paso">
          <Punto tono={TONO_TIPO[s.tipo] ?? 'neutro'} /><strong>{s.chat}</strong>
          <span className="prog-meta">{ROTULO_TIPO[s.tipo] ?? s.tipo} · {hace(s.instante, ahora)}</span>
          <p className="prog-texto">{s.titulo}</p>
          {s.commits.map((c) => (
            <p key={c.sha} className="prog-commit"><code>{c.sha.slice(0, 9)}</code> {c.msg}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

function Pedidos({ pedidos, todos, ahora }: { pedidos: PedidoP[]; todos: boolean; ahora: number }) {
  const [cerrados, setCerrados] = useState<Set<EstadoPedidoP>>(new Set(['hecho']));
  const [abierto, setAbierto] = useState<string | null>(null);
  const orden: EstadoPedidoP[] = ['pendiente', 'en_curso', 'hecho'];
  return (
    <>
      <p className="prog-nota">
        {todos ? 'Todos los pedidos anotados.' : 'Últimos 14 días.'} Un pedido aparece cuando un chat lo anota en su bitácora.{' '}
        <Link href={todos ? '/admin/operaciones?tab=pedidos' : '/admin/operaciones?tab=pedidos&todos=1'} className="prog-link">{todos ? 'Ver 14 días' : 'Ver todos'}</Link>
      </p>
      {!pedidos.length ? <p className="prog-vacio">Ningún pedido anotado en estos días.</p> : (
        <div className="prog-caja">
          <table className="prog-tabla">
            <thead><tr><th>Pedido</th><th className="prog-opc" style={{ width: '17%' }}>Área</th><th style={{ width: '17%' }}>Lo tomó</th><th className="prog-opc" style={{ width: '9%' }}>Commits</th><th style={{ width: '11%' }}>Hace</th></tr></thead>
            <tbody>
              {orden.map((e) => {
                const filas = pedidos.filter((p) => p.estado === e);
                if (!filas.length) return null;
                const plegado = cerrados.has(e);
                return (
                  <Fragment key={e}>
                    <Grupo titulo={ROTULO_PEDIDO[e]} n={filas.length} columnas={5} abierto={!plegado}
                      onToggle={() => setCerrados((s) => { const n = new Set(s); if (n.has(e)) n.delete(e); else n.add(e); return n; })} />
                    {!plegado && filas.map((p) => (
                      <Fragment key={p.id}>
                        <tr className="prog-fila" {...abre(() => setAbierto(abierto === p.id ? null : p.id), abierto === p.id)}>
                          <td title={p.texto}><Punto tono={TONO_PEDIDO[p.estado]} />{p.texto}</td>
                          <td className="prog-opc" title={p.areas.join(', ')}>{p.areas.join(', ')}</td>
                          <td title={p.tomo ?? ''}>{p.tomo ?? '—'}</td>
                          <td className="prog-opc prog-num">{p.commits.length || '—'}</td>
                          <td className="prog-num">{hace(p.instante, ahora)}</td>
                        </tr>
                        {abierto === p.id && <tr className="prog-detalle"><td colSpan={5}><DetallePedido p={p} ahora={ahora} /></td></tr>}
                      </Fragment>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Pushes ────────────────────────────────────────────────────────────────────────────────────
function Pushes({ lectura, ahora }: { lectura: LecturaPushes; ahora: number }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  if (!lectura.ok) return <ErrorState titulo="No pude leer los pushes" detalle={lectura.motivo} />;
  const ps = lectura.pushes;
  return (
    <>
      <p className="prog-nota">Producción, de Vercel.</p>
      {!ps.length ? <p className="prog-vacio">Vercel no tiene pushes a producción.</p> : (
        <div className="prog-caja">
          <table className="prog-tabla">
            <thead><tr><th>Push</th><th style={{ width: '17%' }}>Estado</th><th className="prog-opc" style={{ width: '12%' }}>Commit</th><th className="prog-opc" style={{ width: '10%' }}>Cuenta</th><th style={{ width: '11%' }}>Hace</th></tr></thead>
            <tbody>
              {ps.map((p: PushP) => (
                <Fragment key={p.id}>
                  <tr className="prog-fila" {...abre(() => setAbierto(abierto === p.id ? null : p.id), abierto === p.id)}>
                    <td title={p.mensaje}>{p.actual && <span className="prog-actual">En producción</span>}{p.mensaje}</td>
                    <td><Punto tono={TONO_PUSH[p.estado]} />{ROTULO_PUSH[p.estado]} <span className="prog-meta">{duracion(p.duracionMs)}</span></td>
                    <td className="prog-opc"><code className="prog-mono">{p.sha ?? '—'}</code></td>
                    <td className="prog-opc">{p.cuenta ?? '—'}</td>
                    <td className="prog-num">{hace(p.creado, ahora)}</td>
                  </tr>
                  {abierto === p.id && (
                    <tr className="prog-detalle"><td colSpan={5}>
                      <p className="prog-texto">{p.cuerpo || 'El commit no trae más que el título.'}</p>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function Progreso({ vista, frentes, pedidos, pushes, todos, hayCartero, ahora }: {
  vista: VistaProgreso;
  frentes: Frente[];
  pedidos: PedidoP[];
  pushes: LecturaPushes;
  todos: boolean;
  hayCartero: boolean;
  ahora: number;
}) {
  if (vista === 'curso') return <EnCurso frentes={frentes} hayCartero={hayCartero} ahora={ahora} />;
  if (vista === 'pedidos') return <Pedidos pedidos={pedidos} todos={todos} ahora={ahora} />;
  return <Pushes lectura={pushes} ahora={ahora} />;
}
