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

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
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
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [k.items.length, k.trabajo, visible]);
  const seguirHilo = useCallback(() => hilo.current, []);
  const [viendoCerebro, setViendoCerebro] = useState(false);

  return (
    <>
      <PanelDeChat hilo={hilo} adjuntos={k.adjuntosCaja}
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
          <HiloMako items={saludo} quien={quien} ahora={k.ahora} escribiendo={null} tarjeta={null}
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
