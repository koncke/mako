'use client';

// =============================================================================
// «Reportar problema» del lado del cliente: el campo de arriba, «Tus tickets» y el detalle con la conversación
// =============================================================================
// Copiado de Intercom (el ticket como conversación, con cinco estados en palabras del cliente) y del «Mis solicitudes»
// de Zendesk (la lista: número, título, estado, última novedad). docs/diseno-ticketera-usuarios.md §2.2.
//
// ⚠️ La persona escribe UNA cosa: qué pasó. El tipo es opcional (tres opciones, como las plantillas bug / feature de
// GitHub) y el título sale solo de la primera oración. La pantalla, el navegador y la hora los junta esto, no ella.

import { useMemo, useRef, useState, useTransition } from 'react';
import { Button, EmptyState, ErrorState, Status, Textarea, type Tono } from '@/app/_ui';
import { TIPOS, TOPES, type EstadoCliente, type TicketCliente, type TipoTicket } from '@/lib/tickets-reglas';
import { contestarTicketAction, levantarTicketAction, verMiTicketAction } from './acciones';
// El contexto y el «hace un rato» los comparte con el teléfono (app/m/tickets): una sola copia.
import { contextoDelNavegador, hace } from './navegador';

const TONO_ESTADO: Record<EstadoCliente, Tono> = { recibido: 'neutral', en_curso: 'info', tu_respuesta: 'warn', resuelto: 'good', cerrado: 'neutral' };

export function TicketsCliente({ tickets: iniciales, error, abierto: abiertoInicial }: {
  tickets: TicketCliente[]; error: string | null; abierto: TicketCliente | null;
}) {
  const [tickets, setTickets] = useState(iniciales);
  const [abierto, setAbierto] = useState<TicketCliente | null>(abiertoInicial);
  const [tipo, setTipo] = useState<TipoTicket | null>(null);
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<{ tono: 'good' | 'bad'; texto: string } | null>(null);
  const [mandando, startMandar] = useTransition();
  const ref = useRef<string>(crypto.randomUUID());

  const mandar = () => {
    if (!texto.trim()) { setAviso({ tono: 'bad', texto: 'Escribe qué pasó' }); return; }
    startMandar(async () => {
      const r = await levantarTicketAction({ tipo, texto, contexto: contextoDelNavegador(), ref: ref.current });
      if (!r.ok) { setAviso({ tono: 'bad', texto: r.error }); return; }
      ref.current = crypto.randomUUID();
      setTexto(''); setTipo(null);
      setAviso({ tono: 'good', texto: `Listo: es el ticket #${r.id}` });
      const t = await verMiTicketAction(r.id);
      if (t) { setTickets((xs) => [t, ...xs.filter((x) => x.id !== t.id)]); setAbierto(t); }
    });
  };

  const abrir = async (id: number) => {
    const t = await verMiTicketAction(id);
    if (t) { setAbierto(t); setTickets((xs) => xs.map((x) => (x.id === t.id ? t : x))); }
    try { const u = new URL(window.location.href); u.searchParams.set('t', String(id)); window.history.replaceState(null, '', u); } catch { /* sin URL */ }
  };

  return (
    <div className={`tickets-cliente${abierto ? ' tickets-cliente--detalle' : ''}`}>
      <div className="tickets-cliente__lado">
        <section className="tickets-nuevo" aria-label="Levantar un ticket">
          <label className="tickets-nuevo__pregunta" htmlFor="tickets-texto">¿Qué pasó o qué necesitas?</label>
          <div className="tickets-nuevo__tipos" role="radiogroup" aria-label="Qué es">
            {TIPOS.map((t) => (
              <button key={t.clave} type="button" role="radio" aria-checked={tipo === t.clave}
                className={`tickets-chip${tipo === t.clave ? ' is-on' : ''}`} onClick={() => setTipo(tipo === t.clave ? null : t.clave)}>
                {t.rotulo}
              </button>
            ))}
          </div>
          <Textarea id="tickets-texto" rows={4} value={texto} maxLength={TOPES.descripcion}
            placeholder="Cuéntalo como se lo dirías a alguien del equipo: qué intentaste y qué pasó."
            onChange={(e) => { setTexto(e.target.value); setAviso(null); }} />
          <div className="tickets-nuevo__pie">
            <span className="tickets-nuevo__nota">También puedes pedírselo a MaKo en el chat.</span>
            <Button variant="primary" loading={mandando} onClick={mandar}>Mandar al equipo</Button>
          </div>
          {aviso && <p className={`tickets-aviso tickets-aviso--${aviso.tono}`} role="status">{aviso.texto}</p>}
        </section>

        <section className="tickets-lista" aria-label="Tus tickets">
          <h2 className="tickets-lista__titulo">Tus tickets</h2>
          {error ? <ErrorState titulo="No pude leer tus tickets" detalle={error} />
            : !tickets.length ? <EmptyState inline titulo="Todavía no levantaste ninguno" detalle="Cuando mandes uno, lo vas a ver aquí con en qué anda." />
              : (
                <ul className="tickets-filas">
                  {tickets.map((t) => (
                    <li key={t.id}>
                      <button type="button" className={`tickets-fila${abierto?.id === t.id ? ' is-on' : ''}`} onClick={() => abrir(t.id)}>
                        <span className="tickets-fila__num">#{t.id}</span>
                        <span className="tickets-fila__titulo">{t.titulo}</span>
                        <Status tono={TONO_ESTADO[t.estado]}>{t.rotulo}</Status>
                        <span className="tickets-fila__cuando">{hace(t.actualizado)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </section>
      </div>

      {abierto && <DetalleCliente key={abierto.id} t={abierto} onCerrar={() => setAbierto(null)}
        onCambio={(t) => { setAbierto(t); setTickets((xs) => xs.map((x) => (x.id === t.id ? t : x))); }} />}
    </div>
  );
}

function DetalleCliente({ t, onCerrar, onCambio }: { t: TicketCliente; onCerrar: () => void; onCambio: (t: TicketCliente) => void }) {
  const [respuesta, setRespuesta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mandando, startMandar] = useTransition();
  const tipo = useMemo(() => TIPOS.find((x) => x.clave === t.tipo)?.corto ?? '', [t.tipo]);
  const contestar = () => startMandar(async () => {
    const r = await contestarTicketAction(t.id, respuesta);
    if (!r.ok) { setError(r.error); return; }
    setRespuesta(''); setError(null);
    if (r.ticket) onCambio(r.ticket);
  });
  return (
    <aside className="tickets-detalle" aria-label={`Ticket #${t.id}`}>
      <header className="tickets-detalle__cab">
        <button type="button" className="tickets-detalle__volver" onClick={onCerrar} aria-label="Volver a tus tickets">←</button>
        <div>
          <p className="tickets-detalle__meta">#{t.id} · {tipo}</p>
          <h2 className="tickets-detalle__titulo">{t.titulo}</h2>
        </div>
        <Status tono={TONO_ESTADO[t.estado]} solido>{t.rotulo}</Status>
      </header>
      <ol className="tickets-conversacion">
        {t.lineas.map((l, i) => (
          <li key={i} className={`tickets-burbuja tickets-burbuja--${l.quien}`}>
            <span className="tickets-burbuja__quien">{l.quien === 'tu' ? 'Tú' : 'Equipo de MaKo'} · {hace(l.at)}</span>
            <p className="tickets-burbuja__texto">{l.texto}</p>
          </li>
        ))}
      </ol>
      {t.puedeResponder ? (
        <div className="tickets-detalle__responder">
          <Textarea rows={2} value={respuesta} maxLength={TOPES.nota} placeholder={t.estado === 'tu_respuesta' ? 'Contesta lo que te preguntó el equipo' : 'Suma un dato si te falta algo'}
            onChange={(e) => { setRespuesta(e.target.value); setError(null); }} />
          <div className="tickets-nuevo__pie">
            {error ? <span className="tickets-aviso tickets-aviso--bad">{error}</span> : <span />}
            <Button variant={t.estado === 'tu_respuesta' ? 'primary' : 'secondary'} loading={mandando} disabled={!respuesta.trim()} onClick={contestar}>Responder</Button>
          </div>
        </div>
      ) : (
        <p className="tickets-detalle__cerrado">Este ticket está cerrado. Si vuelve a pasar, levanta uno nuevo.</p>
      )}
    </aside>
  );
}
