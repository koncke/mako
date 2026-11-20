// =============================================================================
// ¿Esta persona tiene la app de escritorio? Ya no se pregunta (20/11/2026)
// =============================================================================
// Del 25/10 al 20/11 esto le preguntaba al servidor (`/api/mako/chat?app=1`) una vez por página y, mientras bloqueaba, cada 8 s:
// sin la computadora conectada, todo chat con MaKo se apagaba con «Instala MaKo para escribir». El 20/11 Martín lo sacó («hoy en
// día utilizamos los MaKo Tokens. Entonces, no pongas la restricción de instalar MaKo para enviar mensajes»): la respuesta es
// `tiene` siempre (lib/chat-mako-reglas.ts), así que no hace falta preguntar. Quedan las dos funciones que llaman las cajas con
// motor propio, sin estado y sin red (tests/app-de-escritorio-primero.test.ts).

import type { AppDeEscritorio } from '@/lib/chat-mako-reglas';

/** Lo que el servidor diría de la app de escritorio: `tiene`, siempre. */
export function useApp(): AppDeEscritorio {
  return 'tiene';
}

/** ¿Este chat no puede mandar nada por la app? Nunca. */
export function useAppBloqueada(): boolean {
  return false;
}
