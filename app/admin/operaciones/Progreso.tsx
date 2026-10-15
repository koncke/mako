'use client';

// =============================================================================
// Progreso — Pedidos · Pushes · Áreas, en la computadora (15/10/2026)
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
  GRUPOS_PEDIDO, ROTULO_GRUPO, ROTULO_TIPO, diaDeNovedad, estadoDeProduccion, grupoPedido, hace, pushDelCommit,
  type EstadoPedidoP, type Frente, type GrupoPedido, type NovedadP, type PedidoP, type PushP,
} from '@/lib/progreso-reglas';
import type { LecturaPushes } from '@/lib/progreso';
import './progreso.css';

export type VistaProgreso = 'pedidos' | 'pushes' | 'areas';

type Tono = 'good' | 'bad' | 'warn' | 'info' | 'neutro';
const TONO_PEDIDO: Record<EstadoPedidoP, Tono> = { pendiente: 'warn', en_curso: 'info', hecho: 'good' };
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
            <thead><tr><th style={{ width: '20%' }}>Área</th><th style={{ width: '17%' }}>Chat</th><th>Último movimiento</th><th className="prog-opc" style={{ width: '11%' }}>Sin empezar</th><th style={{ width: '11%' }}>Hace</th></tr></thead>
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
/** El camino de un pedido en la fila, sin abrir nada: anotado → lo tomó un chat → en producción. Como el
 *  grafo de un run de GitHub Actions, en chico: un punto por etapa, lleno si ya pasó. */
function Camino({ p, ahora }: { p: PedidoP; ahora: number }) {
  const tomado = p.pasos.length > 0;
  const listo = p.estado === 'hecho';
  const ultimo = p.pasos[p.pasos.length - 1];
  const texto = listo
    ? 'En producción'
    : tomado ? `${ROTULO_TIPO[ultimo.tipo] ?? ultimo.tipo} · ${hace(p.ultimo, ahora)}` : 'Nadie lo tomó';
  return (
    <span className="prog-camino" aria-label={`Anotado${tomado ? ', tomado' : ''}${listo ? ', en producción' : ''}`}>
      <span className="prog-camino__etapas" aria-hidden>
        <i className="prog-camino__punto prog-camino__punto--si" />
        <i className={`prog-camino__tramo${tomado ? ' prog-camino__tramo--si' : ''}`} />
        <i className={`prog-camino__punto${tomado ? ' prog-camino__punto--si' : ''}`} />
        <i className={`prog-camino__tramo${listo ? ' prog-camino__tramo--si' : ''}`} />
        <i className={`prog-camino__punto${listo ? ' prog-camino__punto--listo' : ''}`} />
      </span>
      <span className="prog-camino__texto">{texto}</span>
    </span>
  );
}

function DetallePedido({ p, pushes, ahora }: { p: PedidoP; pushes: readonly PushP[]; ahora: number }) {
  return (
    <div className="prog-actividad">
      <div className="prog-paso">
        <Punto tono="warn" /><strong>Martín pidió</strong><span className="prog-meta">{hace(p.instante, ahora)} · {p.areas.join(', ')}</span>
        <p className="prog-texto">{p.texto}</p>
        {p.junto > 0 && <p className="prog-meta">{`Anotado junto con ${p.junto} ${p.junto === 1 ? 'pedido más' : 'pedidos más'}: lo que sigue responde a todos.`}</p>}
      </div>
      {p.pasos.length === 0 && <div className="prog-paso"><Punto tono="neutro" /><span className="prog-meta">Ningún chat lo anotó como empezado todavía.</span></div>}
      {p.pasos.map((s, i) => (
        <div key={i} className="prog-paso">
          <Punto tono={TONO_TIPO[s.tipo] ?? 'neutro'} /><strong>{s.chat}</strong>
          <span className="prog-meta">{ROTULO_TIPO[s.tipo] ?? s.tipo} · {hace(s.instante, ahora)}</span>
          <p className="prog-texto">{s.titulo}</p>
          {s.commits.map((c) => {
            const push = pushDelCommit(c.sha, pushes);
            return (
              <p key={c.sha} className="prog-commit"><code>{c.sha.slice(0, 9)}</code> {c.msg}{push && <span className="prog-meta">{`subió ${hace(push.creado, ahora)}`}</span>}</p>
            );
          })}
        </div>
      ))}
      {p.estado === 'hecho' && (
        <div className="prog-paso">
          <Punto tono="good" /><strong>En producción</strong>
          <span className="prog-meta">está en la versión publicada</span>
        </div>
      )}
    </div>
  );
}

function Pedidos({ pedidos, pushes, todos, ahora }: { pedidos: PedidoP[]; pushes: LecturaPushes; todos: boolean; ahora: number }) {
  const [cerrados, setCerrados] = useState<Set<GrupoPedido>>(new Set(['terminado']));
  const [abierto, setAbierto] = useState<string | null>(null);
  const lista = pushes.ok ? pushes.pushes : [];
  return (
    <>
      <p className="prog-nota">
        {todos ? 'Todos tus pedidos anotados.' : 'Tus pedidos de los últimos 14 días.'} Aparecen cuando un chat los anota en su bitácora: lo que pediste y nadie anotó todavía no está, tampoco en «Sin empezar».{' '}
        <Link href={todos ? '/admin/operaciones' : '/admin/operaciones?todos=1'} className="prog-link">{todos ? 'Ver 14 días' : 'Ver todos'}</Link>
      </p>
      {!pedidos.length ? <p className="prog-vacio">Ningún pedido anotado en estos días.</p> : (
        <div className="prog-caja">
          <table className="prog-tabla">
            <thead><tr><th>Pedido</th><th style={{ width: '30%' }}>Camino</th><th className="prog-opc" style={{ width: '17%' }}>Lo tomó</th><th style={{ width: '11%' }}>Pedido hace</th></tr></thead>
            <tbody>
              {GRUPOS_PEDIDO.map((g) => {
                const filas = pedidos.filter((p) => grupoPedido(p, ahora) === g);
                if (!filas.length) return null;
                if (g === 'ahora' || g === 'empezado') filas.sort((a, b) => b.ultimo - a.ultimo);
                const plegado = cerrados.has(g);
                return (
                  <Fragment key={g}>
                    <Grupo titulo={ROTULO_GRUPO[g]} n={filas.length} columnas={4} abierto={!plegado}
                      onToggle={() => setCerrados((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; })} />
                    {!plegado && filas.map((p) => (
                      <Fragment key={p.id}>
                        <tr className="prog-fila" {...abre(() => setAbierto(abierto === p.id ? null : p.id), abierto === p.id)}>
                          <td title={p.texto}><Punto tono={TONO_PEDIDO[p.estado]} />{p.texto}</td>
                          <td><Camino p={p} ahora={ahora} /></td>
                          <td className="prog-opc" title={p.tomo ?? ''}>{p.tomo ?? '—'}</td>
                          <td className="prog-num">{hace(p.instante, ahora)}</td>
                        </tr>
                        {abierto === p.id && <tr className="prog-detalle"><td colSpan={4}><DetallePedido p={p} pushes={lista} ahora={ahora} /></td></tr>}
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

// ── Pushes: las novedades, como unas notas de versión ────────────────────────────────────────
// Copiado del changelog de Linear (linear.app/changelog, mirado el 15/10/2026): la fecha a la izquierda con su
// punto sobre una línea de tiempo, y a la derecha cada novedad con su título y un texto corto. Sin hash, sin
// commit, sin Vercel (Martín: «Para eso ya me voy a ir a ver vercel»); de Vercel sólo queda una frase: si lo
// último se publicó o falló.
function Novedades({ lista, lectura, ahora }: { lista: NovedadP[]; lectura: LecturaPushes; ahora: number }) {
  const prod = lectura.ok ? estadoDeProduccion(lectura.pushes, ahora) : null;
  const dias: Array<{ dia: string; items: NovedadP[] }> = [];
  for (const n of lista) {
    const dia = diaDeNovedad(n.instante, ahora);
    const ult = dias[dias.length - 1];
    if (ult?.dia === dia) ult.items.push(n); else dias.push({ dia, items: [n] });
  }
  return (
    <>
      {prod && <p className={`prog-nov-prod${prod.ok ? '' : ' prog-nov-prod--mal'}`}><Punto tono={prod.ok ? 'good' : 'bad'} />{prod.frase}</p>}
      {!lista.length ? <p className="prog-vacio">Nada publicado en estos días.</p> : (
        <div className="prog-nov">
          {dias.map(({ dia, items }) => (
            <section key={dia} className="prog-nov-dia">
              <div className="prog-nov-fecha"><span className="prog-nov-punto" aria-hidden />{dia}</div>
              <div className="prog-nov-items">
                {items.map((n) => (
                  <article key={n.id} className="prog-nov-item">
                    <p className="prog-nov-area">{n.area}{n.correccion ? ' · arreglo' : ''}</p>
                    <h3 className="prog-nov-titulo">{n.titulo}</h3>
                    {n.puntos.length > 0 && <ul className="prog-nov-puntos">{n.puntos.map((p, i) => <li key={i}>{p}</li>)}</ul>}
                    {n.verEnApp
                      ? <Link href={n.verEnApp} className="prog-nov-ver">Verlo en la app →</Link>
                      : <p className="prog-nov-sin">Sin pantalla para mirar: es algo interno.</p>}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

export function Progreso({ vista, frentes, pedidos, pushes, novedades, todos, hayCartero, ahora }: {
  vista: VistaProgreso;
  frentes: Frente[];
  pedidos: PedidoP[];
  pushes: LecturaPushes;
  novedades: NovedadP[];
  todos: boolean;
  hayCartero: boolean;
  ahora: number;
}) {
  if (vista === 'areas') return <EnCurso frentes={frentes} hayCartero={hayCartero} ahora={ahora} />;
  if (vista === 'pedidos') return <Pedidos pedidos={pedidos} pushes={pushes} todos={todos} ahora={ahora} />;
  return <Novedades lista={novedades} lectura={pushes} ahora={ahora} />;
}
