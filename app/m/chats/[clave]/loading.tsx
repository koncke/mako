// /m/chats/<clave> — una conversación mientras se lee: la forma de un hilo, no el buscador de la lista
// (sin éste, el loading.tsx de /m/chats envolvía también esta pantalla y dibujaba el de la lista).

import { SkeletonFilas } from '@/app/m/_ui';

export default function ConversacionCargando() {
  return <SkeletonFilas filas={5} />;
}
