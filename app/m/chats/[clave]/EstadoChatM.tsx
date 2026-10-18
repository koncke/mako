'use client';

// La UNA acción de la cabecera de un chat del teléfono: Cerrar la conversación (o Reabrirla), como el
// botón de la ventana de escritorio (POST /api/chats/estado, el mismo). Con Deshacer en el toast.

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { postJson } from '@/app/chats/ventana-piezas';
import { useToastM } from '@/app/m/_ui';
import type { EstadoChat } from '@/lib/chats-tipos';
import { haptico } from '@/lib/haptico';

export function EstadoChatM({ clave, estado }: { clave: string; estado: EstadoChat }) {
  const router = useRouter();
  const toast = useToastM();
  const [ocupado, setOcupado] = useState(false);
  const abierta = estado === 'abierta';

  const cambiar = async (accion: 'cerrar' | 'reabrir', conDeshacer: boolean) => {
    setOcupado(true);
    const j = await postJson<{ ok: boolean; error?: string }>('/api/chats/estado', { clave, accion });
    setOcupado(false);
    if (!j.ok) { haptico('error'); toast(j.incierto ? 'Revisa el chat' : 'No se pudo'); return; }
    haptico('success');
    router.refresh();
    if (conDeshacer) {
      toast(accion === 'cerrar' ? 'Cerrada' : 'Reabierta', {
        deshacer: () => { void cambiar(accion === 'cerrar' ? 'reabrir' : 'cerrar', false); },
      });
    }
  };

  return (
    <button
      type="button"
      className="m-cabecera__accion m-chats-estado"
      disabled={ocupado}
      aria-busy={ocupado || undefined}
      onClick={() => { void cambiar(abierta ? 'cerrar' : 'reabrir', true); }}
    >
      {abierta ? 'Cerrar' : 'Reabrir'}
    </button>
  );
}
