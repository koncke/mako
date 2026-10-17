'use client';

// =============================================================================
// El Centro en el teléfono: los chats y los Runners (15/10/2026)
// =============================================================================
// Las mismas piezas que la computadora (app/admin/operaciones/CentroApp.tsx), destiladas: la lista de chats con su
// caja de escribir (ChatsMovil.tsx) y, abajo, los Runners en una hoja (RunnerMovil.tsx). Sin pestañas: Martín,
// 15/10/2026, mirándolo en producción: «Elimina lo de "Avances y pushes", quiero que cada chat tenga arriba... un
// botón para ver los avances». El avance de cada chat va adentro de su conversación (la barra «Avance 3/5» de
// Avance.tsx, la de «Tu oferta» de Offer en el teléfono).
//
// ⚠️ La pantalla se refresca sola cada pocos segundos con la pestaña a la vista (el estado de los chats y la
// cola), y además se tira hacia abajo (PantallaM). Los pushes de Vercel llegan después de dibujar.
// ⚠️ Desde el 17/10 el motor (refresco, cola, firma, lo recién mandado) es el de la computadora y el del Second Brain:
// app/admin/operaciones/useCentro.ts.

import { useState } from 'react';
import { FilaM, ListaM, SheetM, useToastM } from '@/app/m/_ui';
import { carteroVivo } from '@/lib/operaciones-reglas';
import { useCentro, type Centro, type DatosCentro } from '@/app/admin/operaciones/useCentro';
import { RunnerMovil } from './RunnerMovil';
import { ChatsM } from './ChatsMovil';
import { usoPrincipal } from '@/lib/centro-uso';
import { hace } from '@/lib/progreso-reglas';

export function CentroAppMovil(datos: DatosCentro) {
  const toast = useToastM();
  const k = useCentro(datos, (t) => toast(t));
  const { carteros, ahora, estado, firma } = k;
  const [runners, setRunners] = useState(false);

  const activos = carteros.filter((c) => carteroVivo(c, ahora)).length;
  const principal = usoPrincipal(carteros.map((c) => ({ cuenta: c.cuenta, cuota: c.cuota ?? null })), ahora);

  return (
    <>
      {/* La Ticketera entera, arriba de los chats (Martín: «No veo el botón de la ticketera dentro del Centro»). */}
      <ListaM etiqueta="Ticketera">
        <FilaM icono="soporte" titulo="Ticketera" segunda={k.pendientesTicketera ? `${k.pendientesTicketera} por decidir` : 'Nada por decidir'} href="/m/operaciones?ticketera=tarjetas" navegacion />
        {/* Ops Center (17/10/2026): «que "Second brain" sea la sub tab debajo de la Ticketera», como en la computadora. */}
        <FilaM icono="cerebro" titulo="Second Brain" href="/m/second-brain" navegacion />
      </ListaM>
      <ChatsMDelCentro centro={k} />
      {/* El Uso de las cuentas y sus Runners, en una fila que dice siempre el número (Uso.tsx, la de la computadora). */}
      <ListaM etiqueta="Uso">
        <FilaM icono="config" titulo="Uso y Runners" segunda={[principal ? `Semana ${principal.pct}%${principal.viejo && principal.medido != null ? ` · ${hace(principal.medido, ahora)}` : ''}` : null, `${activos} de ${carteros.length} Runners activos`].filter(Boolean).join(' · ')}
          onClick={() => setRunners(true)} navegacion />
      </ListaM>
      <SheetM abierto={runners} onCerrar={() => setRunners(false)} titulo="Uso y Runners">
        <RunnerMovil carteros={estado ? carteros : null} clave={firma.clave} ahora={ahora} onCrearClave={() => void k.crearClave()} onCopiarClave={k.copiarClave} />
      </SheetM>
    </>
  );
}

/** ChatsMovil.tsx enchufado al motor del Centro: lo usan este Centro y el Second Brain del teléfono (por partes). */
export function ChatsMDelCentro({ centro: k, parte, tituloChats, abierto, onAbierto }: {
  centro: Centro;
  parte?: 'lista' | 'hoja';
  tituloChats?: string;
  abierto?: string | null;
  onAbierto?: (clave: string | null) => void;
}) {
  return (
    <ChatsM
      parte={parte} tituloChats={tituloChats} abierto={abierto} onAbierto={onAbierto}
      decisiones={k.decisiones} responder={k.responderAca} tabs={k.tabs}
      chats={k.chats} carteros={k.carteros} pedidos={k.pedidos} trabajos={k.trabajos} pushes={k.pushes?.ok ? k.pushes.pushes : null} ahora={k.ahora}
      esperas={k.esperas} firma={k.firma} onEnviado={k.anotarEnviado}
      munecos={k.munecos} onMunecos={k.setMunecos}
    />
  );
}
