'use client';

// =============================================================================
// /m/tickets — tus tickets y «Contarle a MaKo» (la Ticketera del cliente en el teléfono)
// =============================================================================
// Desde el 23/10/2026 es un CHAT (Martín: «Cuando podría tener el mismo diseño que un chat y que los usuarios le comenten a
// MaKo cual fue su problema»): la lista de lo que levantó (número, título, en qué anda) y UN botón grande abajo que abre la
// conversación con MaKo en una hoja (./SoporteM.tsx). MaKo repregunta lo justo y arma el ticket; al mandarlo, la hoja sigue
// con la conversación de ese ticket y la lista lo suma. Tocar un ticket abre su conversación (/m/tickets/<id>).
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useRouter } from '@/app/_ui/Link';
import { hace } from '@/app/tickets/navegador';
import type { TicketCliente } from '@/lib/tickets-reglas';
import { ErrorM, FilaM, ListaM, PieFijoM, PildoraM, SeccionM, VacioM } from '@/app/m/_ui';
import { useSoporte } from '@/app/tickets/soporte/useSoporte';
import { TONO_TICKET, rutaTicketM } from './modelo';
import { HojaSoporteM } from './SoporteM';

export function TicketsM({ tickets, error }: { tickets: TicketCliente[]; error: string | null }) {
  const router = useRouter();
  const s = useSoporte({ tickets, movil: true });
  const [abierta, setAbierta] = useState(false);
  // Un ticket recién mandado desde la hoja: la lista lo vuelve a leer del servidor.
  const visto = useRef(s.abierto);
  useEffect(() => {
    if (s.abierto !== visto.current && typeof s.abierto === 'number') router.refresh();
    visto.current = s.abierto;
  }, [s.abierto, router]);
  return (
    <>
      {error ? (
        <ErrorM frase={error} />
      ) : tickets.length === 0 ? (
        <VacioM frase="Todavía no levantaste ninguno. Cuéntale a MaKo qué pasó y lo arma como un ticket para el equipo." />
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
      <PieFijoM consecuencia="MaKo lo arma como un ticket; te avisamos cuando cambie.">
        <Button variant="primary" size="lg" full onClick={() => { s.nuevo(); setAbierta(true); }}>Contarle a MaKo</Button>
      </PieFijoM>
      <HojaSoporteM s={s} abierta={abierta} onCerrar={() => setAbierta(false)} />
    </>
  );
}
