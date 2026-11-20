'use client';

// =============================================================================
// El chat con un GURÚ, adentro del Ops Center (3/11/2026, #16 y #18)
// =============================================================================
// Martín: «me interesa que se avance con los gurús, y el second brain de cada uno». Se elige desde «Nuevo chat» (./GaleriaDeGurus.tsx),
// o desde su fila, y es EL CHAT ÚNICO DE LA APP (AGENTS.md), copiado de ./ChatDelCoach.tsx: el panel, el hilo
// y la caja del Ops Center, y el motor useChatCliente → /api/mako/chat → turnoApp.
//   · SU HILO ES SUYO: una conversación por persona, negocio y gurú (`…:referente-<id>`, lib/chat-mako-reglas.ts). Elegir otra
//     vez al mismo gurú la retoma.
//   · ⚠️ LO QUE LO HACE GURÚ NO ES ESTA PANTALLA: es la CLAVE de la conversación, que lee el servidor (app/api/mako/chat/route.ts →
//     `contextoDelChat`): su ficha en cada mensaje y los tramos de su curso que hablan de la pregunta (lib/cerebro-referente.ts →
//     `cursoParaElTurno`). Por eso retomarla desde la lista del Ops Center sigue siendo con él.
//   · ⚠️ SU CARA Y SU NOMBRE EN EL HILO los pone `quien` (./useChatDelReferente.ts): la burbuja salía de la fila de la lista, y este
//     chat se abre sin lista.
//   · «SECOND BRAIN DE <GURÚ>» (#18; 4/11/2026): el grafo de SU curso EN EL LUGAR de la conversación, y el mismo botón dice
//     «Volver al chat» (./SuSecondBrain.tsx).

import { useCallback, useMemo, useRef, useState } from 'react';
import { useDichoConPuntitos } from '@/app/_chat/useColaDeSalida';
import { Modal } from '@/app/_ui';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { HiloMako, esRespuestaDeMaKo } from '@/app/_chat/HiloMako';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from './PiezasCliente';
import { BotonSecondBrainDe, CerebroDelGuru } from './SuSecondBrain';
import { useChatDelReferente } from './useChatDelReferente';
import { tabDeReferente } from '@/lib/chat-mako-reglas';
import { inspiradoEn, type Asesor } from '@/lib/asesores/catalogo';

export function ChatDelReferente({ referente: r, visible = true, onVolver }: {
  referente: Asesor;
  /** Queda montado, escondido, al irse a otro chat (ChatSecondBrain.tsx): al volver, el hilo baja a lo último. */
  visible?: boolean;
  onVolver: () => void;
}) {
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  const { k, aspecto, quien, vacio, saludo } = useChatDelReferente(r, caja);
  const seguirHilo = useCallback(() => hilo.current, []);
  const [viendoCerebro, setViendoCerebro] = useState(false);
  // EL SALUDO CON SUS PUNTITOS (20/11, la auditoría de chats, ops-center-7): la primera vez en la visita; al volver, de una.
  const filasSaludo = useMemo(() => (vacio ? saludo.map((x) => ({ id: x.id, de: 'mako', texto: x.k === 'msg' ? x.texto ?? '' : '' })) : []), [vacio, saludo]);
  const dicho = useDichoConPuntitos(filasSaludo);
  const saludoVisible = saludo.filter((x) => dicho.visibles.some((f) => f.id === x.id));
  // SIEMPRE AL ÚLTIMO MENSAJE (el panel, por la clave de la última fila; ops-center-4), también al volver a verse.
  const ultimaFila = vacio
    ? `saludo|${saludoVisible.length}|${dicho.escribiendo}|${visible}`
    : `${k.items[k.items.length - 1]?.id ?? ''}|${k.enCurso ? 'escribe' : ''}|${visible}|${viendoCerebro}`;

  return (
    <>
      <PanelDeChat hilo={hilo} adjuntos={k.adjuntosCaja} seguir={{ clave: ultimaFila }}
        cabecera={{
          clave: tabDeReferente(r.id), titulo: r.nombre, aspecto, animo: k.enCurso ? 'trabajando' : 'despierto', onVolver,
          acciones: (
            <>
              <span className="co-cab__inspirado">{inspiradoEn(r)}</span>
              <BotonSecondBrainDe referente={r} viendo={viendoCerebro} onCambiar={setViendoCerebro} />
            </>
          ),
        }}
        reemplazo={viendoCerebro ? <CerebroDelGuru referente={r} /> : undefined}
        arriba={<BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={r.nombre} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />}
        despues={<>
          <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} reportable={esRespuestaDeMaKo} />
          {k.infoWA && <Modal titulo="Info del mensaje" onCerrar={() => k.setInfoWA(null)} ancho={460}><InfoMensaje m={k.infoWA} /></Modal>}
        </>}
        caja={<div className="co-caja"><CajaDelCliente k={k} campo={caja} seguir={seguirHilo} /></div>}
        estado={estadoDelCliente(k)}>
        {vacio ? (
          <HiloMako items={saludoVisible} quien={quien} ahora={k.ahora} escribiendo={dicho.escribiendo ? { segs: 0 } : null} tarjeta={null}
            onTarjeta={() => {}} onReintentar={() => {}} onRecargar={k.recargar} onResponder={(t) => k.enviar(t)} />
        ) : <HiloDelCliente k={k} />}
      </PanelDeChat>
      {k.conectando && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { k.setConectando(false); k.mirarSuIA(); }} ancho={640}>
          <TusCuentasIA sinCabecera conectar />
        </Modal>
      )}
    </>
  );
}
