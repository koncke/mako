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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilaM, ListaM, SheetM, useToastM } from '@/app/m/_ui';
import type { PedidoP } from '@/lib/progreso-reglas';
import type { LecturaPushes } from '@/lib/progreso';
import type { EstadoCarteros, Pedido } from '@/lib/operaciones';
import { carteroVivo } from '@/lib/operaciones-reglas';
import { completarChats, esperasPorChat, type ChatCentro, type DecisionEspera, type TrabajoP } from '@/lib/centro-chats';
import type { MunecosElegidos } from '@/lib/centro-munecos';
import { fotoCentroAction, pushesCentroAction } from '@/app/admin/operaciones/acciones';
import { copiar, useFirma } from '@/app/admin/operaciones/mandar';
import { RunnerMovil } from './RunnerMovil';
import { ChatsM } from './ChatsMovil';
import type { AccionResponder } from '@/app/admin/runway/decisiones';

const REFRESCO_MS = 8000;

/** Lo de la cola que dibuja un chat (la misma forma que en la computadora). */
const trabajoDe = (p: Pedido): TrabajoP => ({
  id: p.id, destino: p.destino, destino_titulo: p.destino_titulo, destino_cuenta: p.destino_cuenta, created_at: p.created_at,
  texto: p.texto, estado: p.estado, motivo: p.motivo, entregado_at: p.entregado_at, cerrado_at: p.cerrado_at, cierre: p.cierre,
});

export function CentroAppMovil({ base, colaInicial, carterosIniciales, decisionesIniciales, munecosIniciales, pedidos, ahora: ahoraServer, sub, responder }: {
  /** La mitad de la lista que sale de las bitácoras (lib/centro-chats.ts → chatsDeBitacoras). */
  base: ChatCentro[];
  colaInicial: Pedido[] | null;
  carterosIniciales: EstadoCarteros | null;
  decisionesIniciales: DecisionEspera[] | null;
  /** Los muñecos que Martín eligió, por nombre (lib/centro-munecos-db.ts). */
  munecosIniciales: MunecosElegidos;
  pedidos: PedidoP[];
  ahora: number;
  sub: string;
  /** La acción de la Ticketera: contestar la pregunta de un chat acá es contestarla allá. */
  responder: AccionResponder;
}) {
  const [cola, setCola] = useState<Pedido[]>(colaInicial ?? []);
  const [locales, setLocales] = useState<TrabajoP[]>([]);
  const [estado, setEstado] = useState<EstadoCarteros | null>(carterosIniciales);
  const [decisiones, setDecisiones] = useState<DecisionEspera[]>(decisionesIniciales ?? []);
  const [ahora, setAhora] = useState(ahoraServer);
  const [pushes, setPushes] = useState<LecturaPushes | null>(null);
  const [runners, setRunners] = useState(false);
  const [munecos, setMunecos] = useState<MunecosElegidos>(munecosIniciales);
  const toast = useToastM();
  const firma = useFirma(sub);

  // Lo recién mandado se ve enseguida; cuando el refresco lo trae de la cola, se usa el de la cola.
  const trabajos = useMemo(() => {
    const deCola = cola.map(trabajoDe);
    return [...locales.filter((l) => !deCola.some((w) => w.id === l.id)), ...deCola];
  }, [cola, locales]);
  const carteros = useMemo(() => estado?.carteros ?? [], [estado]);
  const esperas = useMemo(() => esperasPorChat(decisiones, carteros), [decisiones, carteros]);
  const chats = useMemo(() => completarChats(base, { carteros, trabajos, ahora }), [base, carteros, trabajos, ahora]);

  const refrescar = useCallback(async () => {
    const f = await fotoCentroAction();
    if (f.ok) { setCola(f.pedidos); setEstado(f.carteros); if (f.decisiones) setDecisiones(f.decisiones); }
    setAhora(Date.now());
  }, []);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') refrescar(); }, REFRESCO_MS);
    return () => clearInterval(t);
  }, [refrescar]);
  useEffect(() => { let vivo = true; pushesCentroAction().then((p) => { if (vivo) setPushes(p); }).catch(() => {}); return () => { vivo = false; }; }, []);

  // Lo contestado arriba de la caja se ve en el acto (el refresco trae la verdad).
  const responderAca: AccionResponder = async (prev, fd) => {
    const r = await responder(prev, fd);
    if (r.ok) {
      const id = Number(fd.get('id'));
      const clave = String(fd.get('clave') ?? '');
      const texto = String(fd.get('texto') ?? '').trim();
      setDecisiones((ds) => ds.map((d) => (d.id !== id ? d : { ...d, respuesta: clave, respuestaTexto: texto || null, respondidaAt: new Date().toISOString(), recogidaAt: null })));
    }
    return r;
  };
  const pendientes = decisiones.filter((d) => !d.respuesta && d.urgencia !== 'aviso').length;

  const copiarClave = async () => { if (firma.clave) toast(await copiar(firma.clave.spki) ? 'Copiado: pégalo en el Runner' : 'No pude copiar'); };
  const crearClave = async () => { toast((await firma.crear()) ? 'Token creado' : 'No pude crear tu Token'); };
  const activos = carteros.filter((k) => carteroVivo(k, ahora)).length;

  return (
    <>
      {/* La Ticketera entera, arriba de los chats (Martín: «No veo el botón de la ticketera dentro del Centro»). */}
      <ListaM etiqueta="Ticketera">
        <FilaM icono="soporte" titulo="Ticketera" segunda={pendientes ? `${pendientes} por decidir` : 'Nada por decidir'} href="/m/operaciones?ticketera=tarjetas" navegacion />
      </ListaM>
      <ChatsM
        decisiones={decisiones} responder={responderAca}
        chats={chats} carteros={carteros} pedidos={pedidos} trabajos={trabajos} pushes={pushes?.ok ? pushes.pushes : null} ahora={ahora}
        esperas={esperas} firma={firma} onEnviado={(t) => { setLocales((l) => [t, ...l]); refrescar(); }}
        munecos={munecos} onMunecos={setMunecos}
      />
      <ListaM etiqueta="Runners">
        <FilaM icono="config" titulo="Runners" segunda={`${activos} de ${carteros.length} activos`} onClick={() => setRunners(true)} navegacion />
      </ListaM>
      <SheetM abierto={runners} onCerrar={() => setRunners(false)} titulo="Runners">
        <RunnerMovil carteros={estado ? carteros : null} clave={firma.clave} ahora={ahora} onCrearClave={crearClave} onCopiarClave={copiarClave} />
      </SheetM>
    </>
  );
}
