'use client';

// =============================================================================
// El grupo en el teléfono (3/11/2026)
// =============================================================================
// El de la computadora (app/second-brain/ChatDelGrupo.tsx) en una hoja alta, con el mismo motor. ⚠️ UNA SOLA HOJA (SheetM → «Una hoja sobre otra REEMPLAZA»): Participantes se abre ADENTRO, con su
// «‹» para volver, como en HojaDelGuru.tsx. Tocar el título los abre, como en WhatsApp.

import '@/app/admin/operaciones/centro.css';
import '@/app/m/operaciones/operaciones.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SheetM } from '@/app/m/_ui';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { CajaDelGrupo } from '@/app/_chat/grupo/CajaDelGrupo';
import { HiloDelGrupo } from '@/app/_chat/grupo/HiloDelGrupo';
import { Participantes } from '@/app/_chat/grupo/Participantes';
import { useHiloDelGrupo } from '@/app/_chat/grupo/useHiloDelGrupo';
import { useSeguirElHilo } from '@/app/_chat/grupo/useSeguirElHilo';
import type { GrupoDeLaLista } from '@/app/_chat/grupo/pantalla';

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
  const [viendo, setViendo] = useState(false);
  const [estado, setEstado] = useState<string | null>(null);
  const k = useHiloDelGrupo({ ws, visible: true, onLeido });
  // La hoja mide su cuerpo después del primer pintado (el mismo cuidado que ChatClienteM.tsx): lo que escrolea es el cuerpo, no el hilo.
  const seguirHoja = useCallback(() => hilo.current?.closest('.m-sheet__cuerpo') as HTMLElement | null, []);
  const s = useSeguirElHilo({ contenedor: seguirHoja, mensajes: k.mensajes, pendientes: k.pendientes.length, conError: k.pendientes.filter((p) => p.estado === 'error').length, listo: k.estado === 'listo' && !viendo, visible: !viendo });
  const { marcarLeido } = k;
  useEffect(() => { if (!viendo && s.abajo && k.estado === 'listo') marcarLeido(); }, [viendo, s.abajo, k.estado, k.mensajes, k.ahora, marcarLeido]);
  const desdeLeido = useRef<number | null>(null);
  if (desdeLeido.current == null && grupo) desdeLeido.current = grupo.hastaId;
  const titulo = grupo?.titulo ?? 'Grupo de MaKo';

  return (
    <SheetM abierto onCerrar={onCerrar} snap="alto" id={`grupo-${ws}`}
      titulo={viendo ? 'Participantes' : (
        <button type="button" className="gr-titulo-boton m-operaciones-titulo" onClick={() => setViendo(true)} aria-label={`${titulo}: ver participantes`} disabled={k.estado === 'fuera'}>
          <span className="m-operaciones-titulo__muneco"><Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo={k.pensando ? 'trabajando' : 'despierto'} size={34} /></span>
          <span className="m-operaciones-titulo__texto">
            <span className="m-operaciones-titulo__nombre">{titulo}</span>
            <span className="gr-titulo-boton__ver">Ver participantes</span>
          </span>
        </button>
      )}
      pie={viendo || k.estado === 'fuera' ? undefined : (
        <div className="m-operaciones-caja">
          <CajaDelGrupo k={k} campo={caja} seguir={seguirHoja} movil onError={setEstado} onEnviado={s.bajar} />
          {estado && <div className="m-operaciones-caja__fila m-operaciones-caja__fila--meta"><span className="m-operaciones-caja__estado">{estado}</span></div>}
        </div>
      )}>
      {viendo ? (
        <>
          <button type="button" className="m-operaciones-volver" onClick={() => setViendo(false)}>
            <span aria-hidden>‹</span> {titulo}
          </button>
          <Participantes ws={ws} onCambio={onCambio} onSalio={onSalio} />
        </>
      ) : (
        <div className="m-operaciones-hilo" ref={hilo}>
          <HiloDelGrupo k={k} rol={grupo} invitacion={!!grupo?.invitado && !!grupo?.titulo.startsWith('Invitación')} desdeLeido={desdeLeido.current} campo={caja}
            nuevos={s.nuevos} onBajar={s.bajar} onVolver={onCerrar} />
        </div>
      )}
    </SheetM>
  );
}
