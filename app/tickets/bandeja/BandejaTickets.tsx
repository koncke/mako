'use client';

// =============================================================================
// La Ticketera de Martín: los tickets de los usuarios, en MAZO o en TABLA (17/10 y 22/10/2026)
// =============================================================================
// 17/10: Martín: «La ticketera desde ahora será exclusiva para los tickets levantados por los usuarios... y obvio el ticket
// me tiene que llegar con el reporte de a quién pertenece». El ticket entero se copió de Linear Triage
// (docs/diseno-ticketera-usuarios.md §3): DE QUIÉN, el reporte, lo que escribió, el veredicto del triage CON SU PORQUÉ (y
// «Corregir»), el historial, y las acciones con su atajo: Aprobar 1 · Rechazar 2 · Duplicado 3 · Preguntar 4 · Responder 5.
// 22/10 (desde el teléfono): «La ticketera se ve horrible... vuelva la vista de tarjetas y el desplazamiento tipo tinder...
// si quiero elegir la vista tabla también». Ahora hay dos vistas, y la que elige se recuerda en SU perfil:
//   · el MAZO (./MazoTickets.tsx), la de entrada: un ticket por tarjeta, para deslizar, con «Volver»;
//   · la TABLA (./TablaTickets.tsx): todos, con orden y el filtro por estado (los chips de antes).
// «Ver todo» en una tarjeta, o una fila de la tabla, abre el ticket entero (`Detalle`, abajo) en una hoja.
// Sin «Actualizar»: se refresca sola (cada 30 s con la pestaña a la vista, y al volver a ella).
// «Aprobar» FIRMA en este dispositivo un pedido al chat «Cerebro» con el ticket entero (./cerebro.ts → mandar.ts).
//
// ⚠️ Se monta adentro del panel de la Ticketera de Ops Center (app/admin/operaciones/TicketeraCentro.tsx, y en el teléfono
// app/m/operaciones/TicketeraMovil.tsx). Lee sus datos con sus propias acciones (./acciones.ts, con `puedeOperar`): Ops
// Center no tiene que cargar nada para dibujarla.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button, ErrorState, Status, Switch, Textarea, Input, type Tono } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { ICONO_VISTA } from '@/app/_ui/iconos-vista';
import {
  PRIORIDADES, TIPOS, decisionDeAprobar, pedidoAlCerebro, ROTULO_ESTADO_CLIENTE, estadoParaElCliente,
  type DecisionTicket, type Prioridad, type TipoTicket,
} from '@/lib/tickets-reglas';
import { avisoAlCliente, entregaAlCerebro } from '@/lib/tickets-aviso';
import type { Evento, FilaTicket } from '@/lib/tickets-db';
import {
  anotarDespachoAction, autoArregloAction, cambiarPrioridadAction, corregirTipoAction, decidirTicketAction, guardarVistaAction,
  leerBandejaAction, verTicketBandejaAction,
} from './acciones';
import type { CerebroParaTickets } from './cerebro';
import { MazoTickets } from './MazoTickets';
import { TablaTickets } from './TablaTickets';
import { CaraTicket, ChipOrigen } from './TarjetaTicket';
import {
  ROTULO_ESTADO, decirFalloDeLectura, enGrupo, lectorDeBandeja, linkDeOrigen, nombreDe, ordenarTabla, quePaso, textoDeLaPersona, tipoCorto as corto, ORDEN_INICIAL,
  type Orden, type VistaBandeja,
} from './mazo-reglas';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
// ⚠️ Su hoja (./bandeja.css) la importa la PÁGINA (app/second-brain/pagina.tsx), como las del mazo: un import de CSS acá
// rompería un test que dibuje esto con node.

const TONO_PRIORIDAD: Record<Prioridad, Tono> = { urgente: 'bad', alta: 'warn', media: 'info', baja: 'neutral' };
const ROTULO_PRIORIDAD: Record<Prioridad, string> = { urgente: 'Urgente', alta: 'Alta', media: 'Media', baja: 'Baja' };
/** Cada cuánto se vuelve a leer la bandeja con la pestaña a la vista (y siempre al volver a ella). */
const REFRESCO_MS = 30_000;

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
  const [vista, setVista] = useState<VistaBandeja | null>(null);
  const [grupo, setGrupo] = useState('decidir');
  const [ordenDeTabla, setOrdenDeTabla] = useState<Orden>(ORDEN_INICIAL);
  const [elegido, setElegido] = useState<number | null>(null);
  // «Hace cuánto» de los avisos y de las tarjetas: se fija al leer, no al dibujar.
  const [ahoraLista, setAhoraLista] = useState(() => Date.now());
  // Una lectura a la vez, sin perder la que se pide mientras tanto, y la vista hasta que llega (./mazo-reglas.ts).
  // Un refresco que falla deja lo que se ve (22/10/2026, el 503 de cada deploy): con tickets a la vista, se dice recién si
  // falla varias veces seguidas (./mazo-reglas.ts → decirFalloDeLectura); sin tickets, a la primera.
  const fallos = useRef(0);
  const hayTickets = useRef(false);
  const cargar = useMemo(() => lectorDeBandeja(leerBandejaAction, (r, conVista) => {
    if (!r || !r.ok) {
      fallos.current += 1;
      if (decirFalloDeLectura(fallos.current, hayTickets.current)) setError(r && !r.ok ? r.error : 'No pude leer la Ticketera');
      return;
    }
    fallos.current = 0;
    hayTickets.current = true;
    setError(null); setTickets(r.tickets); setAutoArreglo(r.autoArreglo); setAhoraLista(Date.now());
    if (conVista) setVista((v) => v ?? r.vista);
  }), []);
  const refrescar = useCallback(() => { void cargar(); }, [cargar]);

  // Se refresca sola: cada 30 s con la pestaña a la vista, y en el acto al volver a ella.
  useEffect(() => {
    void cargar();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void cargar(); }, REFRESCO_MS);
    const volvio = () => { if (document.visibilityState === 'visible') void cargar(); };
    document.addEventListener('visibilitychange', volvio);
    window.addEventListener('focus', volvio);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', volvio); window.removeEventListener('focus', volvio); };
  }, [cargar]);

  const elegirVista = (v: VistaBandeja) => {
    setVista(v);
    void guardarVistaAction(v).catch(() => undefined);
  };

  // j / k recorren la tabla con el ticket abierto, como en Linear, en el MISMO orden que se ve (el que eligió).
  useEffect(() => {
    if (vista !== 'tabla' || elegido == null) return;
    const tecla = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key !== 'j' && e.key !== 'k') return;
      const visibles = ordenarTabla((tickets ?? []).filter((t) => enGrupo(t, grupo)), ordenDeTabla);
      const i = visibles.findIndex((t) => t.id === elegido);
      const sig = visibles[e.key === 'j' ? Math.min(visibles.length - 1, i + 1) : Math.max(0, i - 1)];
      if (sig) setElegido(sig.id);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [vista, elegido, tickets, grupo, ordenDeTabla]);

  const cambiarAuto = async (v: boolean) => {
    setAutoArreglo(v);
    const r = await autoArregloAction(v);
    if (!r.ok) { setAutoArreglo(!v); setError(r.error); }
  };

  if (error && !tickets) return <ErrorState titulo="No pude abrir la Ticketera" detalle={error} onReintentar={refrescar} />;

  const barra = (
    <>
      <div className="tickets-bandeja__vistas" role="tablist" aria-label="Vista">
        {(['mazo', 'tabla'] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => elegirVista(v)} title={v === 'mazo' ? 'Mazo' : 'Tabla'}>
            {ICONO_VISTA[v === 'mazo' ? 'tarjetas' : 'tabla'].icono}
            <span>{v === 'mazo' ? 'Mazo' : 'Tabla'}</span>
          </button>
        ))}
      </div>
      <AutoArreglo prendido={autoArreglo} onCambio={cambiarAuto} />
    </>
  );

  return (
    <div className="tickets-bandeja">
      {error && <p className="tickets-bandeja__error" role="alert">{error}<ReportarASoporte /></p>}
      {tickets === null || vista === null ? (
        <p className="tickets-bandeja__vacio">Cargando…</p>
      ) : vista === 'mazo' ? (
        <MazoTickets tickets={tickets} cerebro={cerebro} ahora={ahoraLista} onCambio={refrescar} onVerTodo={setElegido}
          quieto={elegido != null} barra={barra} onVerTabla={() => elegirVista('tabla')} />
      ) : (
        <TablaTickets tickets={tickets} ahoraLista={ahoraLista} grupo={grupo} onGrupo={(g) => { setGrupo(g); setElegido(null); }}
          orden={ordenDeTabla} setOrden={setOrdenDeTabla}
          elegido={elegido} onAbrir={setElegido} barra={barra} />
      )}
      {elegido != null && (
        <div className="tickets-bandeja__hoja" role="presentation" onClick={() => setElegido(null)}>
          <div className="tickets-bandeja__hoja-caja" role="dialog" aria-modal="true" aria-label={`Ticket #${elegido}`} onClick={(e) => e.stopPropagation()}>
            <Detalle key={elegido} id={elegido} cerebro={cerebro} todos={tickets ?? []} onCerrar={() => setElegido(null)} onCambio={refrescar} />
          </div>
        </div>
      )}
    </div>
  );
}

/** «Arreglar solos los bugs evidentes», sin estorbar: un rayo arriba a la derecha que abre el interruptor. Apagado, el
 *  rayo se ve tachado (AGENTS.md: lo que decide solo se tiene que poder apagar, y se tiene que VER si está apagado). */
function AutoArreglo({ prendido, onCambio }: { prendido: boolean; onCambio: (v: boolean) => void }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('pointerdown', fuera);
    window.addEventListener('keydown', tecla);
    return () => { window.removeEventListener('pointerdown', fuera); window.removeEventListener('keydown', tecla); };
  }, [abierto]);
  const titulo = prendido ? 'Arreglo automático prendido' : 'Arreglo automático apagado';
  return (
    <div className="tickets-bandeja__auto" ref={caja}>
      <button type="button" className={`tickets-bandeja__auto-btn${prendido ? ' is-on' : ''}`} aria-expanded={abierto} aria-label={titulo} title={titulo}
        onClick={() => setAbierto((v) => !v)}>
        <Icon name="rayo" size={17} />
      </button>
      {abierto && (
        <div className="tickets-bandeja__auto-caja">
          <Switch checked={prendido} onChange={onCambio} label="Arreglar solos los bugs evidentes" />
        </div>
      )}
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
  // Para los avisos («hace cuánto no sale»): se fija al leer el ticket, no al dibujar.
  const [ahora, setAhora] = useState(() => Date.now());

  const leer = useCallback(async () => {
    const r = await verTicketBandejaAction(id);
    if (r.ok) { setT(r.ticket); setEventos(r.eventos); setAhora(Date.now()); } else setError(r.error);
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
  const link = linkDeOrigen(t);
  const reporte: Array<[string, string | undefined]> = [
    ['Pantalla', c.ruta], ['Chat', c.chat ? `${c.chat.donde}${c.chat.hilo ? ` · hilo ${c.chat.hilo}` : ''}` : undefined],
    ['Herramienta', c.herramienta], ['Error', c.error], ['No existe', c.noExiste ? 'MaKo vio que la app no lo tiene' : undefined],
    ['Le pidió a MaKo', c.pedido], ['MaKo contestó', c.respuestaMako], ['Navegador', c.navegador], ['Pantalla (px)', c.pantalla],
    ['Zona', c.zona], ['Hora', c.hora ? fecha(c.hora) : undefined],
  ];
  const pideTexto = modo === 'rechazar' || modo === 'preguntar' || modo === 'responder';
  // Si el aviso llegó (al cliente, cuando se cierra o se le pregunta; al Cerebro, cuando lo entrega el Runner).
  const avisos: Array<[string, NonNullable<ReturnType<typeof avisoAlCliente>>]> = [];
  const alCliente = avisoAlCliente(t, ahora);
  if (alCliente) avisos.push(['Cliente', alCliente]);
  const alCerebro = entregaAlCerebro(t, ahora);
  if (alCerebro) avisos.push(['Cerebro', alCerebro]);
  return (
    <aside className="tickets-bandeja__detalle" aria-label={`Ticket #${t.id}`}>
      <header className="tickets-bandeja__cab">
        <button type="button" className="tickets-bandeja__volver" onClick={onCerrar} aria-label="Cerrar el ticket">←</button>
        <div className="tickets-bandeja__cab-texto">
          <p className="tickets-bandeja__meta">#{t.id} · {corto(t.tipo)}{t.tipo_manual ? ' (corregido)' : ''} · {ROTULO_ESTADO[t.estado]} · el cliente ve «{ROTULO_ESTADO_CLIENTE[estadoParaElCliente(t.estado)]}»</p>
          {/* La misma frase que la tarjeta y la tabla; el título que lee el cliente queda en el `title`. */}
          <h2 className="tickets-bandeja__h" title={t.titulo}>{quePaso(t)}</h2>
        </div>
        <Status tono={TONO_PRIORIDAD[t.prioridad]}>{ROTULO_PRIORIDAD[t.prioridad]}</Status>
      </header>

      <section className="tickets-bandeja__bloque">
        <h3>De quién</h3>
        <div className="tickets-bandeja__de-quien">
          <CaraTicket t={t} tam={44} />
          <div>
            <p className="tickets-bandeja__quien-grande"><strong>{nombreDe(t)}</strong> · {t.usuario_email}</p>
            <p className="tickets-bandeja__dato">{t.negocio ?? `Workspace ${t.workspace_id}`} (ws {t.workspace_id}) · {t.rol ?? 'rol ?'} · plan {t.plan ?? '?'} · {fecha(t.created_at)}</p>
          </div>
        </div>
        <div className="tickets-bandeja__de-donde">
          <ChipOrigen t={t} />
          {link && <a className="tickets-bandeja__pildora tickets-bandeja__pildora--suave" href={link.href} target="_blank" rel="noopener noreferrer">{link.rotulo}<span aria-hidden> ↗</span></a>}
        </div>
      </section>

      {/* Un ticket automático no lo escribió nadie: su descripción es el aviso fijo para el cliente (lo que importa es el
          error, en el reporte). Si le había pedido algo a MaKo, eso sí es lo suyo. */}
      {(t.canal !== 'sistema' || textoDeLaPersona(t)) && (
        <section className="tickets-bandeja__bloque">
          <h3>Lo que escribió</h3>
          <p className="tickets-bandeja__escrito">{t.canal === 'sistema' ? textoDeLaPersona(t) : t.descripcion || t.titulo}</p>
        </section>
      )}

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

      {avisos.length > 0 && (
        <section className="tickets-bandeja__bloque" aria-label="Avisos">
          <h3>Avisos</h3>
          <ul className="tickets-bandeja__avisos">
            {avisos.map(([quien, v]) => (
              <li key={quien}>
                <span className="tickets-bandeja__aviso-quien">{quien}</span>
                <Status tono={v.tono}>{v.texto}</Status>
                {v.desde ? <span className="tickets-bandeja__dato">{fecha(v.desde)}</span> : null}
              </li>
            ))}
          </ul>
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
      {error && <p className="tickets-bandeja__error" role="alert">{error}<ReportarASoporte /></p>}

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
