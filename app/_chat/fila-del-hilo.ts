// Qué es cada línea del hilo para la cola de salida (20/11/2026, la auditoría de chats: ops-center-6 y coaches-5). Puro, sin
// React ni server-only, para que lo pruebe un test: useChatCliente lo usa con lo que llegó en ESTE turno.
//   · lo que no vino en el turno (el historial, lo que había al abrir) → 'ya', de una;
//   · el texto de MaKo y un aviso suyo → 'mako', con sus puntitos;
//   · lo de la persona → 'yo', ya;
//   · lo demás (la tarjeta, el bloque con opciones, el aviso de la plataforma) → 'pieza', en la pausa después del texto.
import type { FilaDeCola } from '@/app/_chat/useColaDeSalida';
import type { ItemHilo } from '@/app/m/mako/chat-ui';

export function filaDeItem(x: ItemHilo, delTurno: boolean): FilaDeCola {
  if (!delTurno) return { id: x.id, de: 'ya', texto: '' };
  if (x.k === 'msg') return x.role === 'assistant' ? { id: x.id, de: 'mako', texto: x.texto ?? '' } : { id: x.id, de: 'yo', texto: '' };
  if (x.k === 'aviso' && x.tono === 'mako') return { id: x.id, de: 'mako', texto: x.texto };
  return { id: x.id, de: 'pieza', texto: '' };
}
