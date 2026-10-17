'use client';

// =============================================================================
// La Ticketera de Martín: los tickets de los usuarios, como la bandeja Triage de Linear (17/10/2026)
// =============================================================================
// Martín: «La ticketera desde ahora será exclusiva para los tickets levantados por los usuarios... y obvio el ticket me
// tiene que llegar con el reporte de a quién pertenece». Copiado de Linear Triage (docs/diseno-ticketera-usuarios.md §3):
//   · la lista a la izquierda, en grupos (Por decidir · Esperan al cliente · En curso · Cerrados);
//   · el detalle a la derecha: DE QUIÉN (negocio, persona, rol, plan), el reporte que juntó el sistema, lo que escribió,
//     el veredicto del triage CON SU PORQUÉ (y «Corregir»), y el historial;
//   · las acciones con su atajo: Aprobar 1 · Rechazar 2 · Duplicado 3 · Preguntar 4 · Responder 5.
// «Aprobar» FIRMA en este dispositivo un pedido al chat «Cerebro» con el ticket entero (./cerebro.ts → mandar.ts).
//
// ⚠️ Se monta adentro del panel de la Ticketera de Ops Center (app/admin/operaciones/TicketeraCentro.tsx). Lee sus datos
// con sus propias acciones (./acciones.ts, con `puedeOperar`): Ops Center no tiene que cargar nada para dibujarla.

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Button, EmptyState, ErrorState, Status, Switch, Tag, Textarea, Input, type Tono } from '@/app/_ui';
import {
  PRIORIDADES, TIPOS, decisionDeAprobar, pedidoAlCerebro, ROTULO_ESTADO_CLIENTE, estadoParaElCliente,
  type DecisionTicket, type EstadoTicket, type Prioridad, type TipoTicket,
} from '@/lib/tickets-reglas';
import type { Evento, FilaTicket } from '@/lib/tickets-db';
import {
  anotarDespachoAction, autoArregloAction, cambiarPrioridadAction, corregirTipoAction, decidirTicketAction, leerBandejaAction,
  verTicketBandejaAction,
} from './acciones';
import type { CerebroParaTickets } from './cerebro';
// ⚠️ Su hoja (./bandeja.css) la importa la PÁGINA (app/second-brain/pagina.tsx), como las del mazo: un import de CSS acá
// rompería un test que dibuje esto con node.

const GRUPOS: Array<{ clave: string; titulo: string; estados: readonly EstadoTicket[] }> = [
  { clave: 'decidir', titulo: 'Por decidir', estados: ['nuevo', 'esperando_decision'] },
  { clave: 'cliente', titulo: 'Esperan al cliente', estados: ['esperando_cliente'] },
  { clave: 'curso', titulo: 'En curso', estados: ['en_curso', 'arreglado'] },
  { clave: 'cerrados', titulo: 'Cerrados', estados: ['resuelto', 'rechazado', 'duplicado'] },
];
const ROTULO_ESTADO: Record<EstadoTicket, string> = {
  nuevo: 'Nuevo', esperando_decision: 'Por decidir', esperando_cliente: 'Espera al cliente', en_curso: 'En curso',
  arreglado: 'Arreglado, sin desplegar', resuelto: 'Resuelto', rechazado: 'Rechazado', duplicado: 'Duplicado',
};
const TONO_PRIORIDAD: Record<Prioridad, Tono> = { urgente: 'bad', alta: 'warn', media: 'info', baja: 'neutral' };
const ROTULO_PRIORIDAD: Record<Prioridad, string> = { urgente: 'Urgente', alta: 'Alta', media: 'Media', baja: 'Baja' };
const corto = (t: TipoTicket) => TIPOS.find((x) => x.clave === t)?.corto ?? t;

const fecha = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
};

type Modo = Exclude<DecisionTicket, 'arreglar' | 'hacer'> | 'aprobar';
const ACCIONES: Array<{ modo: Modo; rotulo: string; atajo: string }> = [
  { modo: 'aprobar', rotulo: 'Aprobar', atajo: '1' },
  { modo: 'rechazar', rotulo: 'Rechazar', atajo: '2' },
  { modo: 'duplicado', rotulo: 'Duplicado', atajo: '3' },
  { modo: 'preguntar', rotulo: 'Preguntar', atajo: '4' },
  { modo: 'responder', rotulo: 'Responder', atajo: '5' },
];

export function BandejaTickets({ cerebro }: { cerebro: CerebroParaTickets | null }) {
  const [tickets, setTickets] = useState<FilaTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoArreglo, setAutoArreglo] = useState(true);
  const [grupo, setGrupo] = useState('decidir');
  const [elegido, setElegido] = useState<number | null>(null);
  const [cargando, startCargar] = useTransition();

  const cargar = useCallback(() => startCargar(async () => {
    const r = await leerBandejaAction();
    if (!r.ok) { setError(r.error); return; }
    setError(null); setTickets(r.tickets); setAutoArreglo(r.autoArreglo);
  }), []);
  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const g = GRUPOS.find((x) => x.clave === grupo)!;
    return (tickets ?? []).filter((t) => g.estados.includes(t.estado))
      .sort((a, b) => PRIORIDADES.indexOf(a.prioridad) - PRIORIDADES.indexOf(b.prioridad) || Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [tickets, grupo]);
  const cuenta = (clave: string) => (tickets ?? []).filter((t) => GRUPOS.find((g) => g.clave === clave)!.estados.includes(t.estado)).length;

  // j / k recorren la lista, como en Linear.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key !== 'j' && e.key !== 'k') return;
      const i = visibles.findIndex((t) => t.id === elegido);
      const sig = visibles[e.key === 'j' ? Math.min(visibles.length - 1, i + 1) : Math.max(0, i - 1)];
      if (sig) setElegido(sig.id);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [visibles, elegido]);

  const cambiarAuto = async (v: boolean) => {
    setAutoArreglo(v);
    const r = await autoArregloAction(v);
    if (!r.ok) { setAutoArreglo(!v); setError(r.error); }
  };

  if (error && !tickets) return <ErrorState titulo="No pude abrir la Ticketera" detalle={error} onReintentar={cargar} />;
  return (
    <div className="tickets-bandeja">
      <div className="tickets-bandeja__barra">
        <div className="tickets-bandeja__grupos" role="tablist" aria-label="Grupos">
          {GRUPOS.map((g) => (
            <button key={g.clave} type="button" role="tab" aria-selected={grupo === g.clave}
              className={`tickets-bandeja__grupo${grupo === g.clave ? ' is-on' : ''}`} onClick={() => { setGrupo(g.clave); setElegido(null); }}>
              {g.titulo}<span className="tickets-bandeja__n">{cuenta(g.clave)}</span>
            </button>
          ))}
        </div>
        <div className="tickets-bandeja__ajustes">
          <Switch checked={autoArreglo} onChange={cambiarAuto} label="Arreglar solos los bugs evidentes" />
          <Button variant="tertiary" size="sm" loading={cargando} onClick={cargar}>Actualizar</Button>
        </div>
      </div>
      {error && <p className="tickets-bandeja__error" role="alert">{error}</p>}
      <div className={`tickets-bandeja__cuerpo${elegido ? ' tickets-bandeja__cuerpo--detalle' : ''}`}>
        <ul className="tickets-bandeja__lista" aria-label="Tickets">
          {tickets === null ? <li className="tickets-bandeja__vacio">Cargando…</li>
            : !visibles.length ? <li className="tickets-bandeja__vacio"><EmptyState inline titulo={grupo === 'decidir' ? 'No hay nada por decidir' : 'No hay tickets acá'} /></li>
              : visibles.map((t) => (
                <li key={t.id}>
                  <button type="button" className={`tickets-bandeja__fila${elegido === t.id ? ' is-on' : ''}`} onClick={() => setElegido(t.id)}>
                    <span className={`tickets-bandeja__prio tickets-bandeja__prio--${t.prioridad}`} title={ROTULO_PRIORIDAD[t.prioridad]} aria-label={`Prioridad ${ROTULO_PRIORIDAD[t.prioridad]}`} />
                    <span className="tickets-bandeja__num">#{t.id}</span>
                    <span className="tickets-bandeja__titulo">{t.titulo}</span>
                    <Tag>{corto(t.tipo)}</Tag>
                    <span className="tickets-bandeja__quien">{t.negocio ?? `ws ${t.workspace_id}`} · {t.usuario_nombre || t.usuario_email}</span>
                  </button>
                </li>
              ))}
        </ul>
        {elegido != null && (
          <Detalle key={elegido} id={elegido} cerebro={cerebro} todos={tickets ?? []} onCerrar={() => setElegido(null)} onCambio={cargar} />
        )}
      </div>
    </div>
  );
}

function Detalle({ id, cerebro, todos, onCerrar, onCambio }: {
  id: number; cerebro: CerebroParaTickets | null; todos: readonly FilaTicket[]; onCerrar: () => void; onCambio: () => void;
}) {
  const [t, setT] = useState<FilaTicket | null>(todos.find((x) => x.id === id) ?? null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [modo, setModo] = useState<Modo | null>(null);
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState('');
  const [dup, setDup] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [haciendo, startHacer] = useTransition();

  const leer = useCallback(async () => {
    const r = await verTicketBandejaAction(id);
    if (r.ok) { setT(r.ticket); setEventos(r.eventos); } else setError(r.error);
  }, [id]);
  useEffect(() => { void leer(); }, [leer]);

  // Sobre uno EN CURSO no se aprueba de nuevo: el Cerebro ya lo tiene (`sePuedeDecidir`, que el servidor vuelve a mirar).
  const aprobar = t && t.estado !== 'en_curso' ? decisionDeAprobar(t.tipo) : null;
  const decidible = !!t && ['nuevo', 'esperando_decision', 'esperando_cliente', 'en_curso'].includes(t.estado);
  // «Mandar al Cerebro» otra vez: Martín aprobó y la firma no salió (el ticket quedó en curso sin despacho).
  const faltaMandar = !!t && t.estado === 'en_curso' && (t.decision === 'arreglar' || t.decision === 'hacer') && !t.despacho;

  // Los atajos de Linear: 1-5 eligen la acción, Escape cierra.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) { if (e.key === 'Escape') setModo(null); return; }
      if (e.key === 'Escape') { if (modo) setModo(null); else onCerrar(); return; }
      const a = ACCIONES.find((x) => x.atajo === e.key);
      if (a && decidible && (a.modo !== 'aprobar' || aprobar)) { e.preventDefault(); setModo(a.modo); setError(null); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [modo, decidible, aprobar, onCerrar]);

  const mandarAlCerebro = async (fila: FilaTicket, decision: 'arreglar' | 'hacer', notaCerebro: string): Promise<string | null> => {
    if (!cerebro) return 'No hay un chat «Cerebro» en Ops Center: quedó aprobado, mándaselo cuando esté.';
    if (!cerebro.listo.ok) return `${cerebro.listo.motivo}: quedó aprobado, mándaselo cuando se pueda.`;
    const r = await cerebro.mandar(pedidoAlCerebro(fila, decision, notaCerebro || null));
    if (!r.ok) return `No le llegó al Cerebro (${r.error}): quedó aprobado, vuelve a mandárselo.`;
    const a = await anotarDespachoAction(fila.id, r.id);
    return a.ok ? null : a.error;
  };

  const confirmar = () => startHacer(async () => {
    if (!t || !modo) return;
    setError(null);
    if (modo === 'aprobar') {
      if (!aprobar) return;
      const r = await decidirTicketAction(t.id, { decision: aprobar, nota });
      if (!r.ok) { setError(r.error); return; }
      const e = await mandarAlCerebro(t, aprobar, nota);
      if (e) setError(e);
    } else {
      const r = await decidirTicketAction(t.id, { decision: modo, respuesta: texto, duplicadoDe: modo === 'duplicado' ? Number(dup.replace(/^#/, '')) : null });
      if (!r.ok) { setError(r.error); return; }
    }
    setModo(null); setTexto(''); setNota(''); setDup('');
    await leer(); onCambio();
  });

  const reMandar = () => startHacer(async () => {
    if (!t || !(t.decision === 'arreglar' || t.decision === 'hacer')) return;
    const e = await mandarAlCerebro(t, t.decision, t.decision_nota ?? '');
    setError(e);
    await leer(); onCambio();
  });

  const corregir = (tipo: TipoTicket) => startHacer(async () => {
    if (!t) return;
    const r = await corregirTipoAction(t.id, tipo);
    if (!r.ok) setError(r.error); else { await leer(); onCambio(); }
  });
  const prioridad = (p: Prioridad) => startHacer(async () => {
    if (!t) return;
    const r = await cambiarPrioridadAction(t.id, p);
    if (!r.ok) setError(r.error); else { await leer(); onCambio(); }
  });

  if (!t) return <aside className="tickets-bandeja__detalle">{error ?? 'Cargando…'}</aside>;
  const c = t.contexto;
  const reporte: Array<[string, string | undefined]> = [
    ['Pantalla', c.ruta], ['Chat', c.chat ? `${c.chat.donde}${c.chat.hilo ? ` · hilo ${c.chat.hilo}` : ''}` : undefined],
    ['Herramienta', c.herramienta], ['Error', c.error], ['No existe', c.noExiste ? 'MaKo vio que la app no lo tiene' : undefined],
    ['Le pidió a MaKo', c.pedido], ['MaKo contestó', c.respuestaMako], ['Navegador', c.navegador], ['Pantalla (px)', c.pantalla],
    ['Zona', c.zona], ['Hora', c.hora ? fecha(c.hora) : undefined],
  ];
  const pideTexto = modo === 'rechazar' || modo === 'preguntar' || modo === 'responder';
  return (
    <aside className="tickets-bandeja__detalle" aria-label={`Ticket #${t.id}`}>
      <header className="tickets-bandeja__cab">
        <button type="button" className="tickets-bandeja__volver" onClick={onCerrar} aria-label="Cerrar el ticket">←</button>
        <div className="tickets-bandeja__cab-texto">
          <p className="tickets-bandeja__meta">#{t.id} · {corto(t.tipo)}{t.tipo_manual ? ' (corregido)' : ''} · {ROTULO_ESTADO[t.estado]} · el cliente ve «{ROTULO_ESTADO_CLIENTE[estadoParaElCliente(t.estado)]}»</p>
          <h2 className="tickets-bandeja__h">{t.titulo}</h2>
        </div>
        <Status tono={TONO_PRIORIDAD[t.prioridad]}>{ROTULO_PRIORIDAD[t.prioridad]}</Status>
      </header>

      <section className="tickets-bandeja__bloque">
        <h3>De quién</h3>
        <p className="tickets-bandeja__quien-grande"><strong>{t.usuario_nombre || t.usuario_email}</strong> · {t.usuario_email}</p>
        <p className="tickets-bandeja__dato">{t.negocio ?? `Workspace ${t.workspace_id}`} (ws {t.workspace_id}) · {t.rol ?? 'rol ?'} · plan {t.plan ?? '?'} · por {t.canal.replace('_', ' ')} · {fecha(t.created_at)}</p>
      </section>

      <section className="tickets-bandeja__bloque">
        <h3>Lo que escribió</h3>
        <p className="tickets-bandeja__escrito">{t.descripcion || t.titulo}</p>
      </section>

      <section className="tickets-bandeja__bloque">
        <h3>El reporte que juntó el sistema</h3>
        <dl className="tickets-bandeja__reporte">
          {reporte.filter(([, v]) => v).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
      </section>

      {t.triage && (
        <section className="tickets-bandeja__bloque tickets-bandeja__triage">
          <h3>El triage: {corto(t.triage.tipo)}, confianza {t.triage.confianza} · {t.triage.autoArreglo ? 'se arregla solo' : 'decides tú'}</h3>
          <ul>{t.triage.porque.map((p, i) => <li key={i}>{p}</li>)}</ul>
          <div className="tickets-bandeja__corregir">
            <span>¿Se equivocó? Es</span>
            {TIPOS.map((x) => (
              <button key={x.clave} type="button" className={`tickets-bandeja__chip${t.tipo === x.clave ? ' is-on' : ''}`} disabled={haciendo || t.tipo === x.clave} onClick={() => corregir(x.clave)}>{x.corto.toLowerCase()}</button>
            ))}
            <span className="tickets-bandeja__sep">· Prioridad</span>
            {PRIORIDADES.map((p) => (
              <button key={p} type="button" className={`tickets-bandeja__chip${t.prioridad === p ? ' is-on' : ''}`} disabled={haciendo || t.prioridad === p} onClick={() => prioridad(p)}>{ROTULO_PRIORIDAD[p].toLowerCase()}</button>
            ))}
          </div>
        </section>
      )}

      {t.respuesta && (
        <section className="tickets-bandeja__bloque">
          <h3>Lo que lee el cliente</h3>
          <p className="tickets-bandeja__escrito">{t.respuesta}</p>
        </section>
      )}

      {decidible && (
        <section className="tickets-bandeja__acciones" aria-label="Decidir">
          <div className="tickets-bandeja__botones">
            {ACCIONES.map((a) => (
              <Button key={a.modo} variant={modo === a.modo ? 'primary' : 'secondary'} size="sm" disabled={haciendo || (a.modo === 'aprobar' && !aprobar)}
                onClick={() => { setModo(modo === a.modo ? null : a.modo); setError(null); }}>
                {a.rotulo} <kbd className="tickets-bandeja__kbd">{a.atajo}</kbd>
              </Button>
            ))}
          </div>
          {modo === 'aprobar' && (
            <div className="tickets-bandeja__form">
              <p className="tickets-bandeja__dato">
                Le firma al {cerebro ? `chat «${cerebro.titulo}»` : 'Cerebro'} el ticket entero para que lo {aprobar === 'arreglar' ? 'arregle' : 'haga'}: decide él si abre un chat o se lo da a un jefe.
                {cerebro && !cerebro.listo.ok ? ` ⚠️ ${cerebro.listo.motivo}.` : ''}
              </p>
              <Textarea rows={2} value={nota} maxLength={2000} placeholder="Una nota para el Cerebro (opcional): el alcance, qué no tocar…" onChange={(e) => setNota(e.target.value)} />
            </div>
          )}
          {modo === 'duplicado' && (
            <div className="tickets-bandeja__form">
              <Input value={dup} onChange={(e) => setDup(e.target.value)} placeholder="Número del ticket original (#12)" inputMode="numeric" />
              <Textarea rows={2} value={texto} maxLength={2000} placeholder="Lo que lee el cliente (opcional)" onChange={(e) => setTexto(e.target.value)} />
            </div>
          )}
          {pideTexto && (
            <div className="tickets-bandeja__form">
              <Textarea rows={3} value={texto} maxLength={2000} autoFocus
                placeholder={modo === 'rechazar' ? 'Por qué no se hace (lo lee el cliente)' : modo === 'preguntar' ? 'Qué le preguntas al cliente' : 'La respuesta para el cliente'}
                onChange={(e) => setTexto(e.target.value)} />
            </div>
          )}
          {modo && <div className="tickets-bandeja__confirmar"><Button variant="primary" loading={haciendo} onClick={confirmar}>{modo === 'aprobar' ? 'Aprobar y mandar al Cerebro' : 'Confirmar'}</Button></div>}
        </section>
      )}
      {faltaMandar && <div className="tickets-bandeja__confirmar"><Button variant="primary" loading={haciendo} onClick={reMandar}>Mandárselo al Cerebro</Button></div>}
      {error && <p className="tickets-bandeja__error" role="alert">{error}</p>}

      {eventos.length > 0 && (
        <section className="tickets-bandeja__bloque">
          <h3>Historial</h3>
          <ol className="tickets-bandeja__historial">
            {eventos.map((e) => (<li key={e.id}><span>{fecha(e.at)}</span> <strong>{e.actor}</strong> {e.tipo}{e.texto ? ` — ${e.texto}` : ''}</li>))}
          </ol>
        </section>
      )}
    </aside>
  );
}
