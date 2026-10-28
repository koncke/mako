// =============================================================================
// useNotaEnElActo — la nota de voz que sale en el acto, para una pantalla cuyo motor lee texto (28/10/2026)
// =============================================================================
// Lo que tarda (pasarla a texto) corre fuera de React (./notas-en-el-acto.ts). La pantalla:
//   const nota = useNotaEnElActo({ clave, puede: !pensando, mandar: (t) => enviar(t) });
//   <CajaChat … onGrabada={nota.onGrabada} />
//   <HiloMako items={nota.conNotas(items)} onReintentar={nota.reintentar(suReintentar)} onDescartar={nota.descartar} … />
// `clave`: el chat (una nota no viaja a otro). `puede`: lo que la pantalla pide para mandar (no está pensando, hay sesión);
// mientras no puede, la nota espera dibujada. `mandar`: SU camino de siempre, con el texto ya transcrito.
// ⚠️ SIN 'use client' A PROPÓSITO (como app/tickets/soporte/useSoporte.ts): es un hook que sólo importan componentes de
//    cliente, y así lo puede importar otro hook sin directiva (tests/frontera-use-client.test.ts).
// =============================================================================

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import { prepararNota } from './preparar-nota';
import { conNotas, crearNotasEnElActo, type VozDeNota } from './notas-en-el-acto';
import type { GrabacionLista } from './nota-que-se-manda';

/** Uno para toda la app: sobrevive a que el panel se cierre o se cambie de tab. */
const NOTAS = crearNotasEnElActo(prepararNota);

export function useNotaEnElActo({ clave, puede, mandar }: {
  clave: string;
  puede: boolean;
  mandar: (texto: string, voz: VozDeNota) => void;
}) {
  const delChat = useSyncExternalStore(NOTAS.suscribir, () => NOTAS.de(clave), () => NOTAS.de(clave));
  // El `mandar` del último render: el que lee el estado de AHORA (la sesión, el alcance).
  const mandarRef = useRef(mandar);
  useEffect(() => { mandarRef.current = mandar; });
  useEffect(() => {
    if (!puede) return;
    const y = NOTAS.siguiente(clave);
    if (!y) return;
    NOTAS.salio(clave, y.id);
    mandarRef.current(y.texto, y.voz);
  }, [puede, delChat, clave]);
  return {
    onGrabada: (g: GrabacionLista) => { NOTAS.grabar(clave, g.audio, g.segundos); },
    conNotas: (items: readonly ItemHilo[]) => conNotas(items, delChat),
    /** El «Reintentar» del hilo: una nota se pasa a texto otra vez; lo demás, al de la pantalla. */
    reintentar: (deLaPantalla: (id: string) => void) => (id: string) => { if (!NOTAS.reintentar(clave, id)) deLaPantalla(id); },
    descartar: (id: string) => NOTAS.descartar(clave, id),
  };
}
