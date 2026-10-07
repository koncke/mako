// =============================================================================
// participantes-grupo — qué contestó WhatsApp al tocar los participantes de un grupo
// =============================================================================
// SIN `server-only`, a propósito: es la lectura que decide si «agregar a un grupo» salió
// o no, y adentro de un módulo con `server-only` ningún test la puede importar. La usan
// `lib/mako-grupo.ts` (sumar al dueño de un cliente) y `lib/mako-chat.ts` (el detalle de
// un grupo y la mudanza de MaKo a su número nuevo).
//
// ⚠️ EVOLUTION CONTESTA HTTP 200 CON EL FALLO ADENTRO. Medido el 21/8/2026 pidiendo
// agregar un número inexistente:
//
//     HTTP 200
//     { "updateParticipants": [ { "status": "403", "jid": "…", "content": {…} } ] }
//
// Hasta el 07/10/2026 `accionParticipantes` (lib/mako-chat.ts) miraba sólo que hubiera
// respuesta, así que el detalle de un grupo decía «Número agregado ✓» sobre un número que
// no entró — y la mudanza de la voz de MaKo contaba como hechos grupos donde la línea nueva
// nunca quedó adentro.

/** Qué significa cada `status`, en castellano de persona. Cadena vacía = salió bien. */
export const RESULTADO_PARTICIPANTE: Record<string, string> = {
  '200': '',
  '409': '',  // ya estaba adentro: el pedido igual se cumplió
  // ⚠️ El 403 (`addressable: false`) NO dice nada sobre invitaciones: dice que esa persona
  // tiene en «Quién puede agregarme a grupos» algo que nos excluye. Lo que se haga con eso
  // lo decide quien llama, y recién ahí se puede afirmar que se mandó algo.
  '403': 'WhatsApp no deja agregarlo directo: tiene restringido quién puede sumarlo a grupos.',
  '408': 'Ese número no está disponible en WhatsApp.',
  '401': 'Ese número bloqueó al WhatsApp de MaKo.',
  '404': 'Ese número no existe en WhatsApp.',
};

const soloDigitos = (s: unknown): string => String(s ?? '').replace(/\D/g, '');

/**
 * El resultado del PRIMER participante. Es el contrato que ya usaba el alta del dueño de un
 * cliente (un número por pedido).
 *
 * Sin la lista no se puede afirmar que salió bien, pero tampoco que falló: Evolution contestó
 * 200. Se toma como éxito y el silencio queda del lado del proveedor. Quien necesite SABER
 * —la mudanza de MaKo— no se queda con esto: relee el grupo (`esAdminEn`).
 */
export function leerResultadoParticipante(body: unknown): { ok: boolean; error?: string; status?: string } {
  const filas = (body as { updateParticipants?: unknown })?.updateParticipants;
  if (!Array.isArray(filas) || filas.length === 0) return { ok: true };
  const estado = String((filas[0] as { status?: unknown })?.status ?? '200');
  const motivo = RESULTADO_PARTICIPANTE[estado];
  if (motivo === '') return { ok: true, status: estado };
  return { ok: false, status: estado, error: motivo ?? `WhatsApp lo rechazó (código ${estado}).` };
}

/**
 * El resultado de CADA número pedido, en el orden en que se pidieron. Un número que no
 * aparece en la respuesta queda `ok: null`: no se sabe, y no se inventa.
 */
export function leerResultados(body: unknown, pedidos: string[]): Array<{ numero: string; ok: boolean | null; status?: string; error?: string }> {
  const filas = (body as { updateParticipants?: unknown })?.updateParticipants;
  const lista = Array.isArray(filas) ? (filas as Array<{ status?: unknown; jid?: unknown }>) : [];
  return pedidos.map((numero) => {
    const n = soloDigitos(numero);
    const fila = lista.find((f) => soloDigitos(String(f?.jid ?? '').split('@')[0].split(':')[0]) === n);
    if (!fila) return { numero: n, ok: null };
    const estado = String(fila.status ?? '200');
    const motivo = RESULTADO_PARTICIPANTE[estado];
    return motivo === ''
      ? { numero: n, ok: true, status: estado }
      : { numero: n, ok: false, status: estado, error: motivo ?? `WhatsApp lo rechazó (código ${estado}).` };
  });
}

/** Un participante tal como lo devuelve `findGroupInfos`. */
export type ParticipanteCrudo = { id?: unknown; jid?: unknown; phoneNumber?: unknown; admin?: unknown };

/**
 * ¿Ese número está en el grupo, y es admin? Es la pregunta que contesta si la mudanza SALIÓ:
 * el `status` de `updateParticipant` dice qué contestó WhatsApp al pedido, y esto dice cómo
 * quedó el grupo, que es lo único que importa.
 *
 * ⚠️ Se mira `id`, `jid` y `phoneNumber`: con la privacidad nueva de WhatsApp un participante
 * puede venir como `…@lid` en `id` y con el teléfono en otro campo. La comparación es EXACTA
 * sobre los dígitos: los dos lados son jids que escribió WhatsApp (el `ownerJid` de la línea
 * y el participante), así que ya vienen en la misma forma.
 */
export function esAdminEn(participantes: ParticipanteCrudo[], numero: string): { esta: boolean; admin: boolean } {
  const n = soloDigitos(numero);
  if (!n) return { esta: false, admin: false };
  const p = participantes.find((x) =>
    [x.id, x.jid, x.phoneNumber].some((v) => soloDigitos(String(v ?? '').split('@')[0].split(':')[0]) === n));
  if (!p) return { esta: false, admin: false };
  const a = String(p.admin ?? '').toLowerCase();
  return { esta: true, admin: a === 'admin' || a === 'superadmin' };
}
