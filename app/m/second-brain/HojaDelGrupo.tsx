'use client';

// =============================================================================
// El grupo en el teléfono (3/11/2026)
// =============================================================================
// El de la computadora (app/second-brain/ChatDelGrupo.tsx) A PANTALLA COMPLETA, como un grupo de WhatsApp (PantallaChatM, 13/11/2026: el prototipo que
// aprobó Martín), con el mismo motor. ⚠️ UNA SOLA CAPA (PantallaChatM usa el historial de SheetM → «Una hoja sobre otra REEMPLAZA»): Participantes se abre
// ADENTRO, con su «‹» para volver, como en HojaDelGuru.tsx. Tocar el título los abre, como en WhatsApp; el «+» de la derecha invita.

import '@/app/admin/operaciones/centro.css';
import '@/app/m/operaciones/operaciones.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CUERPO_CHAT, PantallaChatM } from '@/app/m/_chat/PantallaChatM';
import { Icon } from '@/app/_components/icons';
import { CajaDelGrupo } from '@/app/_chat/grupo/CajaDelGrupo';
import { HiloDelGrupo } from '@/app/_chat/grupo/HiloDelGrupo';
import { FotoDelGrupo } from './FilasDelGrupoM';
import { Participantes, useMiembrosDelGrupo } from '@/app/_chat/grupo/Participantes';
import { useHiloDelGrupo } from '@/app/_chat/grupo/useHiloDelGrupo';
import { useSeguirElHilo } from '@/app/_chat/grupo/useSeguirElHilo';
import { quienesEstan, type GrupoDeLaLista } from '@/app/_chat/grupo/pantalla';

export function HojaDelGrupo({ ws, grupo, onCerrar, onLeido, onCambio, onSalio }: {
  ws: number;
  grupo: GrupoDeLaLista | null;
  onCerrar: () => void;
  onLeido: (ws: number, hastaId: number) => void;
  onCambio: () => void;
  onSalio: () => void;
}) {
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  // Participantes, o la misma vista con el cursor en el email («Invitar», 4/11/2026).
  const [viendo, setViendo] = useState<'participantes' | 'invitar' | null>(null);
  const miembros = useMiembrosDelGrupo(ws);
  const invita = miembros.datos ? miembros.datos.administra : !!grupo?.administra && !grupo?.invitado;
  const [estado, setEstado] = useState<string | null>(null);
  const k = useHiloDelGrupo({ ws, visible: true, onLeido });
  // La hoja mide su cuerpo después del primer pintado (el mismo cuidado que ChatClienteM.tsx): lo que escrolea es el cuerpo, no el hilo.
  const seguirHoja = useCallback(() => hilo.current?.closest(CUERPO_CHAT) as HTMLElement | null, []);
  const s = useSeguirElHilo({ contenedor: seguirHoja, mensajes: k.mensajes, pendientes: k.pendientes.length, conError: k.pendientes.filter((p) => p.estado === 'error').length, listo: k.estado === 'listo' && !viendo, visible: !viendo });
  const { marcarLeido } = k;
  useEffect(() => { if (!viendo && s.abajo && k.estado === 'listo') marcarLeido(); }, [viendo, s.abajo, k.estado, k.mensajes, k.ahora, marcarLeido]);
  const desdeLeido = useRef<number | null>(null);
  if (desdeLeido.current == null && grupo) desdeLeido.current = grupo.hastaId;
  const titulo = grupo?.titulo ?? 'Grupo de MaKo';

  return (
    <PantallaChatM abierto onCerrar={onCerrar} id={`grupo-${ws}`} grupo
      accion={!viendo && invita && k.estado !== 'fuera' ? (
        <button type="button" className="gr-invitar-m" onClick={() => setViendo('invitar')} aria-label="Invitar al grupo" title="Invitar">
          <Icon name="plus" size={18} />
        </button>
      ) : undefined}
      titulo={viendo ? 'Participantes' : (
        <span className="gr-titulo-m-fila">
          <button type="button" className="gr-titulo-boton m-operaciones-titulo" onClick={() => setViendo('participantes')} aria-label={`${titulo}: ver participantes`} disabled={k.estado === 'fuera'}>
            <span className="m-operaciones-titulo__muneco"><FotoDelGrupo size={40} /></span>
            <span className="m-operaciones-titulo__texto">
              <span className="m-operaciones-titulo__nombre">{titulo}</span>
              {/* Como WhatsApp: quiénes están, y tocar el nombre abre los participantes. */}
              <span className="gr-titulo-boton__ver">{miembros.datos ? quienesEstan(miembros.datos.participantes) : 'Ver participantes'}</span>
            </span>
          </button>
        </span>
      )}
      pie={viendo || k.estado === 'fuera' ? undefined : (
        <div className="m-operaciones-caja">
          <CajaDelGrupo k={k} campo={caja} seguir={seguirHoja} movil onError={setEstado} onEnviado={s.bajar} />
          {estado && <div className="m-operaciones-caja__fila m-operaciones-caja__fila--meta"><span className="m-operaciones-caja__estado">{estado}</span></div>}
        </div>
      )}>
      {viendo ? (
        <>
          <button type="button" className="m-operaciones-volver" onClick={() => setViendo(null)}>
            <span aria-hidden>‹</span> {titulo}
          </button>
          <Participantes ws={ws} miembros={miembros} enfocar={viendo === 'invitar'} onCambio={onCambio} onSalio={onSalio} />
        </>
      ) : (
        <div className="m-operaciones-hilo" ref={hilo}>
          <HiloDelGrupo k={k} rol={grupo} invitacion={!!grupo?.invitado && !!grupo?.titulo.startsWith('Invitación')} desdeLeido={desdeLeido.current} campo={caja}
            nuevos={s.nuevos} onBajar={s.bajar} onVolver={onCerrar} />
        </div>
      )}
    </PantallaChatM>
  );
}
