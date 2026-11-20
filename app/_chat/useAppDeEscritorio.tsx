'use client';

// =============================================================================
// Ninguna caja se apaga sin la app de escritorio (20/11/2026)
// =============================================================================
// Del 25/10 (Martín: «En ningun chat, no solo en Ops Center») al 20/11, toda caja de MaKo con motor propio montaba esto y, sin la
// computadora conectada, se apagaba con «Instala MaKo para escribir» y el botón en el lugar del micrófono. El 20/11 Martín lo sacó:
// «hoy en día utilizamos los MaKo Tokens. Entonces, no pongas la restricción de instalar MaKo para enviar mensajes».
// Desde ese día el gancho NO decide nada: `bloqueada` es false y no hay `bloqueo`. Las pantallas que lo llaman siguen llamándolo hasta
// que se saque el cableado, que es lo pendiente: el parche sin subir de las pestañas («reto-tutoriales») toca esas mismas líneas en
// 13 de ellas, y se saca después de él (tests/app-de-escritorio-todos-los-chats.test.ts).

import type { ReactNode } from 'react';

export type BloqueoDeCaja = { frase: string; boton: ReactNode };

const SIN_BLOQUEO: { bloqueada: boolean; bloqueo: BloqueoDeCaja | undefined } = { bloqueada: false, bloqueo: undefined };

export function useAppDeEscritorio(): { bloqueada: boolean; bloqueo: BloqueoDeCaja | undefined } {
  return SIN_BLOQUEO;
}
