'use client';

// =============================================================================
// Sin la app de escritorio no se escribe en NINGÚN chat con MaKo (25/10/2026)
// =============================================================================
// Martín: «Ni en la cuenta de Mauricio ni en la mia tengo instalado aun la app de escritorio de MaKo y aún así me sigue dejando
// enviar mensajes... No debería. En ningun chat, no solo en Ops Center». El 24/10 el bloqueo vivía en la caja del chat común
// (app/second-brain/PiezasCliente.tsx → CajaDelCliente): el Ops Center del cliente y la estrella de cada tab. Los chats con caja
// propia (Automations, Offer, Web Generator, Dashboard, los editores de imagen y video, la ficha del lead, el asesor de WhatsApp,
// el chat de un gráfico) y las cajas de pedido (crear una landing, una automatización, una hoja) no preguntaban nada. Esto es la
// pregunta para todos ellos:
//   · la decide el servidor, igual que para el chat común (./app-de-escritorio.ts, `?app=1`): sin computadora conectada,
//     `bloquea`; en el teléfono, que no la instala, no bloquea; si no se pudo saber, tampoco (un bache no tapa nada);
//   · lo que devuelve es lo que la caja ya sabe dibujar, `bloqueo` (CajaChat y CajaPedido: el campo apagado con su frase y
//     «Instalar MaKo» en el lugar del micrófono), y `bloqueada`, para cortar el envío también por fuera de la caja (una
//     sugerencia, un pedido que llega de otra pantalla).
// SIN CSS a propósito: lo usan motores que los tests cargan en node (Automations, el cuadro del Web Generator). El botón, que sí
// trae CSS, entra con `next/dynamic` (./InstalarMaKo.tsx).
// Qué cajas lo montan y cuáles no (con su porqué) lo fija tests/app-de-escritorio-todos-los-chats.test.ts.

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { FRASE_APP, FRASE_INSTALAR, useAppBloqueada, useDescargado } from './app-de-escritorio';

const InstalarMaKo = dynamic(() => import('./InstalarMaKo'), { ssr: false, loading: () => null });

export type BloqueoDeCaja = { frase: string; boton: ReactNode };

export function useAppDeEscritorio(): { bloqueada: boolean; bloqueo: BloqueoDeCaja | undefined } {
  const bloqueada = useAppBloqueada();
  const descargado = useDescargado();
  return {
    bloqueada,
    bloqueo: bloqueada ? { frase: descargado ? FRASE_INSTALAR : FRASE_APP, boton: <InstalarMaKo /> } : undefined,
  };
}
