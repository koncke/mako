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
import { Participantes, useMiembrosDelGrupo } from '@/app/_chat/grupo/Participantes';
import { useHiloDelGrupo } from '@/app/_chat/grupo/useHiloDelGrupo';
import { useSeguirElHilo } from '@/app/_chat/grupo/useSeguirElHilo';
import { quienesEstan, type GrupoDeLaLista } from '@/app/_chat/grupo/pantalla';

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
  // Participantes, o la misma hoja con el cursor en el email («Invitar», 4/11/2026: Martín, «no veo el botón de invitar allí mismo»).
  const [viendo, setViendo] = useState<'participantes' | 'invitar' | null>(null);
  const miembros = useMiembrosDelGrupo(ws);
  // Invita quien administra: lo dice la hoja cuando llegó, y mientras tanto la fila de la lista. A un invitado no se le ofrece.
  const invita = miembros.datos ? miembros.datos.administra : !!grupo?.administra && !grupo?.invitado;
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
          // Como WhatsApp: debajo del nombre, quiénes están; a la derecha del todo, Invitar y Participantes (como «Second Brain de …» en los otros chats).
          subtitulo: miembros.datos && k.estado !== 'fuera' ? quienesEstan(miembros.datos.participantes) : undefined,
          acciones: k.estado === 'fuera' ? undefined : (
            <div className="gr-cab-acciones">
              {invita && <button type="button" className="co-chip gr-participantes" aria-label="Invitar" title="Invitar" onClick={() => setViendo('invitar')}><Icon name="plus" size={14} /><span className="gr-cab-rotulo">Invitar</span></button>}
              <button type="button" className="co-chip gr-participantes" aria-label="Participantes" title="Participantes" onClick={() => setViendo('participantes')}><Icon name="users" size={14} /><span className="gr-cab-rotulo">Participantes</span></button>
            </div>
          ),
        }}
        caja={k.estado === 'fuera' ? null : <div className="co-caja"><CajaDelGrupo k={k} campo={caja} seguir={seguir} onError={setEstado} onEnviado={s.bajar} /></div>}
        estado={estado ?? ''}>
        <HiloDelGrupo k={k} rol={grupo} invitacion={!!grupo?.invitado && !!grupo?.titulo.startsWith('Invitación')} desdeLeido={desdeLeido.current} campo={caja}
          nuevos={s.nuevos} onBajar={s.bajar} onVolver={onVolver} />
      </PanelDeChat>
      {viendo && (
        // Alto FIJO: invitar suma una fila y un renglón, y la hoja no puede crecer y saltar (4/11/2026). La lista scrollea adentro.
        <Modal titulo="Participantes" onCerrar={() => setViendo(null)} ancho={460} alto="min(85vh, 640px)">
          <Participantes ws={ws} miembros={miembros} enfocar={viendo === 'invitar'} onCambio={onCambio} onSalio={() => { setViendo(null); onSalio(); }} />
        </Modal>
      )}
    </>
  );
}
