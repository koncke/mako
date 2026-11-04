'use client';

// =============================================================================
// El grupo de un negocio, adentro del Ops Center de la computadora (3/11/2026)
// =============================================================================
// Martín: «grupos de WhatsApp dentro del Ops Center... todas las notificaciones que hoy en día estamos enviando por WhatsApp». El panel de todos los chats (`PanelDeChat`), con su motor
// (app/_chat/grupo/useHiloDelGrupo.ts). Copiado de ./ChatDelReferente.tsx: queda montado, escondido, al irse a otro chat (ChatSecondBrain.tsx), y al volver sigue donde estaba.
//
// ⚠️ NO VA EN `ElegidoChat`, como el gurú: ese es el motor de LA pantalla, y el grupo tiene el suyo. Y no toca `useChatCliente`.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { CajaDelGrupo } from '@/app/_chat/grupo/CajaDelGrupo';
import { HiloDelGrupo } from '@/app/_chat/grupo/HiloDelGrupo';
import { Participantes } from '@/app/_chat/grupo/Participantes';
import { useHiloDelGrupo } from '@/app/_chat/grupo/useHiloDelGrupo';
import { useSeguirElHilo } from '@/app/_chat/grupo/useSeguirElHilo';
import type { GrupoDeLaLista } from '@/app/_chat/grupo/pantalla';

export function ChatDelGrupo({ ws, grupo, visible = true, onVolver, onLeido, onCambio, onSalio }: {
  ws: number;
  /** Su fila de la lista. null: el link lo abrió sin ella (el super admin en otro negocio), o todavía no llegó. */
  grupo: GrupoDeLaLista | null;
  visible?: boolean;
  onVolver: () => void;
  onLeido: (ws: number, hastaId: number) => void;
  /** Cambiaron los participantes o algo de la lista. */
  onCambio: () => void;
  onSalio: () => void;
}) {
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  const k = useHiloDelGrupo({ ws, visible, onLeido });
  const seguir = useCallback(() => hilo.current, []);
  const s = useSeguirElHilo({ contenedor: seguir, mensajes: k.mensajes, pendientes: k.pendientes.length, conError: k.pendientes.filter((p) => p.estado === 'error').length, listo: k.estado === 'listo', visible });
  const [viendo, setViendo] = useState(false);
  const [estado, setEstado] = useState<string | null>(null);
  const { marcarLeido } = k;
  useEffect(() => { if (visible && s.abajo && k.estado === 'listo') marcarLeido(); }, [visible, s.abajo, k.estado, k.mensajes, k.ahora, marcarLeido]);
  // Hasta dónde había leído al abrir: lo que dice «Sin leer» no se mueve mientras se lee.
  const desdeLeido = useRef<number | null>(null);
  if (desdeLeido.current == null && grupo) desdeLeido.current = grupo.hastaId;
  const titulo = grupo?.titulo ?? 'Grupo de MaKo';

  return (
    <>
      <PanelDeChat hilo={hilo}
        cabecera={{
          clave: `grupo-${ws}`, titulo, criatura: 'MaKo', aspecto: ASPECTO_MAKO, animo: k.pensando ? 'trabajando' : 'despierto', onVolver,
          acciones: k.estado === 'fuera' ? undefined : (
            <button type="button" className="co-chip gr-participantes" onClick={() => setViendo(true)}><Icon name="users" size={14} />Participantes</button>
          ),
        }}
        caja={k.estado === 'fuera' ? null : <div className="co-caja"><CajaDelGrupo k={k} campo={caja} seguir={seguir} onError={setEstado} onEnviado={s.bajar} /></div>}
        estado={estado ?? ''}>
        <HiloDelGrupo k={k} rol={grupo} invitacion={!!grupo?.invitado && !!grupo?.titulo.startsWith('Invitación')} desdeLeido={desdeLeido.current} campo={caja}
          nuevos={s.nuevos} onBajar={s.bajar} onVolver={onVolver} />
      </PanelDeChat>
      {viendo && (
        <Modal titulo="Participantes" onCerrar={() => setViendo(false)} ancho={460}>
          <Participantes ws={ws} onCambio={onCambio} onSalio={() => { setViendo(false); onSalio(); }} />
        </Modal>
      )}
    </>
  );
}
