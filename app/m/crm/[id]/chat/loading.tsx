// /m/crm/<id>/chat — el hilo de WhatsApp mientras se lee: la forma de una lista, no una pantalla congelada.

import { SkeletonFilas } from '@/app/m/_ui';

export default function ChatCargando() {
  return <SkeletonFilas filas={5} />;
}
