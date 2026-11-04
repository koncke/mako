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
import { nombreCuenta } from '@/lib/centro-chats';
import { useCentro, type Centro, type DatosCentro } from '@/app/admin/operaciones/useCentro';
import { RunnerMovil } from './RunnerMovil';
import { ChatsM } from './ChatsMovil';
import { cuentasConTitular } from '@/app/admin/operaciones/PiezasCentro';
import { estadoRunnerUso, usoPrincipal } from '@/lib/centro-uso';
import { useTicketsPorDecidir } from '@/app/tickets/bandeja/usarContador';
import { hace } from '@/lib/progreso-reglas';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';

export function CentroAppMovil({ grupoInicial = null, ...datos }: DatosCentro & { grupoInicial?: number | null }) {
  const toast = useToastM();
  const k = useCentro(datos, (t) => toast(t));
  const { carteros, ahora, estado, firma } = k;
  const [runners, setRunners] = useState(false);
  // Los tickets de los usuarios que esperan a Martín (el mismo número que el botón de la computadora). null = leyendo.
  const tickets = useTicketsPorDecidir(true);

  // «Midiendo» y no «con noticias»: `visto_at` lo refresca la vuelta para TODAS las cuentas (30/10/2026, lib/centro-uso.ts).
  const activos = carteros.filter((c) => estadoRunnerUso(carteroVivo(c, ahora), c.cuota ?? null, ahora) === 'mide').length;
  const principal = usoPrincipal(carteros.map((c) => ({ cuenta: c.cuenta, cuota: c.cuota ?? null })), ahora);

  return (
    <>
      {/* La Ticketera entera, arriba de los chats (Martín: «No veo el botón de la ticketera dentro del Centro»). Desde el
          17/10 es la de los tickets de los usuarios; «Preguntas de los chats» se sacó (se contestan en cada chat). */}
      <ListaM etiqueta="Ticketera">
        <FilaM icono="soporte" titulo="Ticketera" segunda={tickets == null ? 'Tickets de clientes' : tickets ? `${tickets} por decidir` : 'Nada por decidir'} href="/m/operaciones?ticketera=tickets" navegacion />
        {/* Ops Center (17/10/2026): «que "Second brain" sea la sub tab debajo de la Ticketera», como en la computadora.
            Abre el GRAFO («debería saltar el grafo»): `?panel=mapa` lleva al Mapa a quien lo ve, y al chat a quien no. */}
        <FilaM icono="cerebro" titulo="Second Brain" href="/m/second-brain?panel=mapa" navegacion />
        {/* El Uso de las cuentas y sus Runners, ARRIBA de los chats y junto a Second Brain (Martín, 17/10/2026: «El botón de
            USO en mobile debe ir arriba de los chats junto a Second Brain»; antes había que bajar hasta el final de la
            lista). Dice siempre el número (Uso.tsx, la de la computadora). */}
        {/* «Uso», como la del cliente (23/10/2026, Martín: «"USO de IA" sea IGUAL que en los clientes, sólo que SuperAdmin tiene
            más configuraciones»): abre «Tus cuentas de IA» y, debajo, lo suyo (las cuentas de Claude Code, la API, los Runners). */}
        <FilaM icono="config" titulo="Uso" segunda={[principal ? `Semana ${principal.pct}%${principal.viejo && principal.medido != null ? ` · ${hace(principal.medido, ahora)}` : ''} · ${nombreCuenta(principal.cuenta)}` : null, `${activos} de ${carteros.length} midiendo ahora`].filter(Boolean).join(' · ')}
          onClick={() => setRunners(true)} navegacion />
      </ListaM>
      <ChatsMDelCentro centro={k} grupoInicial={grupoInicial} />
      {/* En «alto» (17/10/2026, Martín: «esa sección se traba y no se puede scrollear hasta el final»): en «medio» la hoja
          está corrida hacia abajo y lo último del cuerpo queda DEBAJO de la pantalla aunque se scrollee hasta el fondo
          (SheetM mide el cuerpo con el alto de «alto»; docs/hallazgos-mobile.md). */}
      <SheetM abierto={runners} onCerrar={() => setRunners(false)} titulo="Tus cuentas de IA" snap="alto">
        <TusCuentasIA sinCabecera />
        <RunnerMovil carteros={estado ? carteros : null} clave={firma.clave} ahora={ahora} onCrearClave={() => void k.crearClave()} onCopiarClave={k.copiarClave}
          cuentas={cuentasConTitular(k)} onRenombrar={k.renombrarCuenta} onLeerCredito={k.leerCreditoApi} onCambiarCredito={k.cambiarCreditoDelNegocio} />
      </SheetM>
    </>
  );
}

/** ChatsMovil.tsx enchufado al motor del Centro: lo usan este Centro y el Second Brain del teléfono (por partes). */
export function ChatsMDelCentro({ centro: k, parte, tituloChats, abierto, onAbierto, grupoInicial = null }: {
  centro: Centro;
  grupoInicial?: number | null;
  parte?: 'lista' | 'hoja';
  tituloChats?: string;
  abierto?: string | null;
  onAbierto?: (clave: string | null) => void;
}) {
  return (
    <ChatsM
      parte={parte} tituloChats={tituloChats} abierto={abierto} onAbierto={onAbierto} grupoInicial={grupoInicial}
      decisiones={k.decisiones} responder={k.responderAca}
      chats={k.chats} carteros={k.carteros} pedidos={k.pedidos} trabajos={k.trabajos} pushes={k.pushes?.ok ? k.pushes.pushes : null} ahora={k.ahora}
      esperas={k.esperas} firma={k.firma} onEnviado={k.anotarEnviado}
      munecos={k.munecos} onMunecos={k.setMunecos} centro={k}
    />
  );
}
