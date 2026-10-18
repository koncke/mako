'use client';

// =============================================================================
// /m/tickets — la lista de tus tickets y la hoja para levantar uno (Intercom y Zendesk en el celular)
// =============================================================================
// La persona escribe UNA cosa: qué pasó. El tipo es opcional (las tres opciones de escritorio, `TIPOS`) y el título
// sale solo de la primera oración en el servidor. El contexto (pantalla de la que venía, navegador, hora) lo junta
// `contextoDelNavegador`, la misma de la computadora. `ref` es la clave de idempotencia de un doble toque.
// =============================================================================

import { useRef, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useRouter } from '@/app/_ui/Link';
import { haptico } from '@/lib/haptico';
import { TIPOS, TOPES, type TicketCliente, type TipoTicket } from '@/lib/tickets-reglas';
import { levantarTicketAction } from '@/app/tickets/acciones';
import { contextoDelNavegador, hace } from '@/app/tickets/navegador';
import {
  ErrorM, FilaM, ListaM, PieFijoM, PieM, PildoraM, SeccionM, SheetM, VacioM, useToastM,
} from '@/app/m/_ui';
import { TONO_TICKET, rutaTicketM } from './modelo';

export function TicketsM({ tickets, error }: { tickets: TicketCliente[]; error: string | null }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      {error ? (
        <ErrorM frase={error} />
      ) : tickets.length === 0 ? (
        <VacioM frase="Todavía no levantaste ninguno. Cuando mandes uno, lo vas a ver aquí con en qué anda." />
      ) : (
        <SeccionM titulo="Tus tickets">
          <ListaM>
            {tickets.map((t) => (
              <FilaM key={t.id} titulo={t.titulo} segunda={`#${t.id} · ${hace(t.actualizado)}`}
                pill={<PildoraM tono={TONO_TICKET[t.estado]}>{t.rotulo}</PildoraM>} href={rutaTicketM(t.id)} />
            ))}
          </ListaM>
        </SeccionM>
      )}
      <PieFijoM consecuencia="Te avisamos cuando cambie.">
        <Button variant="primary" size="lg" full onClick={() => setAbierta(true)}>Reportar un problema</Button>
      </PieFijoM>
      <HojaNuevoTicket abierta={abierta} onCerrar={() => setAbierta(false)} />
    </>
  );
}

function HojaNuevoTicket({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const router = useRouter();
  const toast = useToastM();
  const [tipo, setTipo] = useState<TipoTicket | null>(null);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mandando, setMandando] = useState(false);
  const ref = useRef<string>(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()));

  const mandar = async () => {
    if (mandando) return;
    if (!texto.trim()) { setError('Escribe qué pasó'); return; }
    setMandando(true); setError(null);
    try {
      const r = await levantarTicketAction({ tipo, texto, contexto: contextoDelNavegador('reportar-problema-movil'), ref: ref.current });
      if (!r.ok) { haptico('error'); setError(r.error); return; }
      ref.current = crypto.randomUUID();
      haptico('success');
      setTexto(''); setTipo(null);
      onCerrar();
      toast(`Ticket #${r.id} enviado`);
      router.push(rutaTicketM(r.id));
    } catch {
      haptico('error'); setError('No salió. Revisa tu conexión y vuelve a mandarlo.');
    } finally {
      setMandando(false);
    }
  };

  return (
    <SheetM id="nuevo-ticket" abierto={abierta} onCerrar={onCerrar} titulo="Reportar un problema" snap="alto" ocupado={mandando}
      rotuloCerrar="Cerrar sin mandar"
      pie={(
        <PieM consecuencia="También puedes pedírselo a MaKo en el chat.">
          <Button variant="primary" size="lg" full loading={mandando} onClick={() => { void mandar(); }}>Mandar al equipo</Button>
        </PieM>
      )}>
      <div className="m-tickets-tipos" role="radiogroup" aria-label="Qué es">
        {TIPOS.map((t) => (
          <button key={t.clave} type="button" role="radio" aria-checked={tipo === t.clave} className="m-tickets-chip"
            onClick={() => setTipo(tipo === t.clave ? null : t.clave)}>
            {t.rotulo}
          </button>
        ))}
      </div>
      <label className="m-tickets-pregunta" htmlFor="m-tickets-texto">¿Qué pasó o qué necesitas?</label>
      <textarea id="m-tickets-texto" className="m-tickets-texto" rows={7} value={texto} maxLength={TOPES.descripcion}
        placeholder="Cuéntalo como se lo dirías a alguien del equipo: qué intentaste y qué pasó."
        onChange={(e) => { setTexto(e.target.value); setError(null); }} />
      {error && <p className="m-tickets-error" role="alert">{error}</p>}
    </SheetM>
  );
}
