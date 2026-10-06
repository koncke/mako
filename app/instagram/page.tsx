// =============================================================================
// /instagram → /chatbot  (la tab se retiró el 06/10/2026)
// =============================================================================
// Decisión de Martín (06/10/2026), sobre la pregunta de qué hacer con la tab:
// «C: sacar la tab» — entera, la bandeja de DMs Y el programador de publicaciones.
// Medido ese día en producción: 0 conversaciones, 0 mensajes y 0 publicaciones en
// toda su historia, con dos workspaces (ws11 y ws13) que llegaron a conectar Zernio.
// El Chatbot es SÓLO WhatsApp por la línea no oficial (AGENTS.md).
//
// ⚠️ SE REDIRIGE, NO SE BORRA: hay links viejos afuera del repo (marcadores, avisos
// ya mandados, el redirect_uri del OAuth de Zernio `?conectado=1`). Un 404 ahí es
// peor que llevarlos a la tab de conversaciones que sí existe. Los links INTERNOS
// se borraron en el mismo commit (los guarda tests/sin-instagram.test.ts), así que
// este redirect sólo atiende a los de afuera.
//
// Va con `rutaConWs`: un `redirect()` pelado pierde la pestaña del cliente que el
// super admin está mirando. Ningún parámetro viejo se traduce: el `?conectado=1`
// era la vuelta de un OAuth que ya no existe.

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function InstagramRetirada() {
  redirect(await rutaConWs('/chatbot'));
}
