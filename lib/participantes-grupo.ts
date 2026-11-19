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
 * El número como jid COMPLETO (`…@s.whatsapp.net`), para que Evolution lo mande TAL CUAL.
 *
 * ⚠️ EVOLUTION LE BORRA UN DÍGITO A LOS NÚMEROS DE ARGENTINA Y MÉXICO. Su `createJid` (2.3.7,
 * `formatMXOrARNumber`) agarra todo número de 13 dígitos que empiece con 52 o 54 y le saca el
 * TERCERO: `5491125052605` sale como `541125052605`. WhatsApp conoce a ese número como `549…`
 * (es el `ownerJid` de la propia línea), así que el pedido va a OTRO número. Medido el
 * 07/10/2026 sumando la línea nueva de MaKo al grupo SuperAdmin: HTTP 201 con `status: "403"`
 * y `jid: "541125052605@s.whatsapp.net"` — y la mudanza dijo «no quedó adentro» en los 6
 * grupos sin que nadie entendiera por qué. Un número que ya trae `@s.whatsapp.net` Evolution
 * lo devuelve sin tocar.
 *
 * ⚠️ SÓLO PARA UN NÚMERO QUE DIO WHATSAPP (el `ownerJid` de una línea, el jid que devuelve
 * `whatsappNumbers`). Lo que tipeó una persona puede traer un 0 o un 15 de más: ése sigue
 * yendo crudo, y lo normaliza quien corresponda.
 */
export function jidCanonico(numero: string): string {
  return `${soloDigitos(numero)}@s.whatsapp.net`;
}

/** Las formas en que puede volver un número que se mandó: tal cual, y como lo deja Evolution. */
function formasDe(numero: string): string[] {
  const d = soloDigitos(numero);
  const formas = [d];
  if (d.length === 13 && (d.startsWith('52') || d.startsWith('54'))) formas.push(d.slice(0, 2) + d.slice(3));
  return formas;
}

/**
 * El resultado de CADA número pedido, en el orden en que se pidieron. Un número que no
 * aparece en la respuesta queda `ok: null`: no se sabe, y no se inventa.
 *
 * La fila se busca por las DOS formas del número (ver `jidCanonico`): con la forma exacta
 * sola, el 403 que contestó WhatsApp sobre `541…` no se encontraba, el resultado quedaba
 * «no se sabe», y `accionParticipantes` lo contaba como éxito. Y con UN número pedido y UNA
 * fila, la fila es la suya aunque venga con otra cara (un `…@lid`).
 */
export function leerResultados(body: unknown, pedidos: string[]): Array<{ numero: string; ok: boolean | null; status?: string; error?: string }> {
  const filas = (body as { updateParticipants?: unknown })?.updateParticipants;
  const lista = Array.isArray(filas) ? (filas as Array<{ status?: unknown; jid?: unknown }>) : [];
  return pedidos.map((numero) => {
    const n = soloDigitos(numero);
    const formas = formasDe(n);
    const fila = lista.find((f) => formas.includes(soloDigitos(String(f?.jid ?? '').split('@')[0].split(':')[0])))
      ?? (pedidos.length === 1 && lista.length === 1 ? lista[0] : undefined);
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

// ── Cuando WhatsApp no deja que MaKo sume a alguien: qué se ofrece (19/11/2026) ──────────────────────────────────────────────────────
// Joan (la agencia de Sellers) guardó un número en Notificaciones y no entró al grupo: su WhatsApp sólo deja que lo agreguen sus
// contactos (el 403), y MaKo no lo es. La pantalla daba UNA salida, «pásale tú el link», y Joan no pudo sumarlo: no era admin del
// grupo. Martín lo hizo admin a mano y Joan lo sumó desde su teléfono, porque Joan SÍ es contacto de esa persona. Esa es la salida que
// faltaba: alguien del negocio que esté en el grupo y sea admin lo suma desde su WhatsApp, y si no es admin, MaKo lo hace admin con un
// clic. Y si MaKo misma no es admin del grupo, no se intenta nada ni se ofrece un link que no puede sacar: se dice eso.

/** Lo que se dice cuando la línea de MaKo está en el grupo y no es admin: no puede sumar a nadie ni sacar el link del grupo. */
export const MAKO_NO_ES_ADMIN = 'MaKo no es admin de este grupo, así que no puede sumar a nadie ni sacar el link. Que un admin del grupo haga admin a MaKo, o que sume a esa persona desde su WhatsApp.';

/** El número del negocio que podría sumarlo a mano (el principal), y cómo está en el grupo. */
export type QuienSuma = { numero: string; esta: boolean; esAdmin: boolean };

/** Las salidas que la pantalla ofrece, además del link. */
export type SalidaSinAlta = {
  /** Ese número ya es admin del grupo: puede sumarlo desde su WhatsApp. */
  yaPuedeSumar?: string;
  /** Ese número está en el grupo sin ser admin: MaKo lo puede hacer admin para que lo sume él. */
  hacerAdmin?: string;
};

/**
 * Qué se ofrece cuando WhatsApp no dejó a MaKo sumar a `numero`. Sólo con el 403: es la privacidad de esa persona, y un contacto suyo
 * sí puede sumarla. Con un 404 (no existe) o un 401 (bloqueó a MaKo), que lo intente otro no cambia nada. Y no se ofrece que se sume
 * a sí mismo ni a alguien que no está en el grupo.
 */
export function salidaSinAlta(status: string | undefined, numero: string, quien: QuienSuma | null): SalidaSinAlta {
  // '403': su privacidad. 'rechazo': WhatsApp rechazó el pedido entero por algo que no es «no existe» ni «MaKo no es admin» (`causaDelRechazo`).
  if ((status !== '403' && status !== 'rechazo') || !quien || !quien.esta) return {};
  const q = soloDigitos(quien.numero);
  if (!q || q === soloDigitos(numero)) return {};
  return quien.esAdmin ? { yaPuedeSumar: q } : { hacerAdmin: q };
}

/** La salida en una frase, para lo que no tiene botón (la respuesta de MaKo en el chat y la lista de quién no entró). */
export function textoDeSalida(s: SalidaSinAlta, leer: (tel: string) => string = (t) => t): string {
  if (s.yaPuedeSumar) return `O que lo sume ${leer(s.yaPuedeSumar)} desde su WhatsApp: es admin del grupo.`;
  if (s.hacerAdmin) return `O que lo sume ${leer(s.hacerAdmin)} desde su WhatsApp: MaKo puede hacerlo admin del grupo.`;
  return '';
}

/** ¿La línea de MaKo es admin del grupo? null = no la encontré entre los participantes (puede venir sólo como `@lid`): no se sabe. */
export function makoEsAdminDe(participantes: ParticipanteCrudo[], numeroDeMaKo: string | null): boolean | null {
  if (!numeroDeMaKo) return null;
  const e = esAdminEn(participantes, numeroDeMaKo);
  return e.esta ? e.admin : null;
}

/**
 * La causa, en palabras de persona, cuando WhatsApp rechaza el pedido ENTERO (HTTP 400 de Evolution, no el 403 de un participante adentro
 * de un 200). 19/11/2026: el cartel de Joan decía «No se pudo hablar con WhatsApp (Evolution 400)», que no dice qué pasó ni qué hacer, y
 * el texto que contestó WhatsApp se tiraba. `ofreceSalida`: si tiene sentido que lo sume a mano alguien del negocio. Con «MaKo no es admin»,
 * no: lo dice el motivo. Nunca nombra a Evolution.
 */
export function causaDelRechazo(status: number, body: unknown): { motivo: string; ofreceSalida: boolean; tipo: 'tope' | 'no-admin' | 'tiempo' | 'sin-conexion' | 'no-encontrado' | 'otro' } {
  const t = (typeof body === 'string' ? body : JSON.stringify(body ?? '')).toLowerCase();
  if (/rate-overlimit|\b429\b/.test(t)) return { tipo: 'tope', ofreceSalida: true, motivo: 'WhatsApp frenó a MaKo por hacer muchos cambios en grupos seguidos. Prueba de nuevo en un rato.' };
  if (/not-authorized|forbidden|not.?admin/.test(t)) return { tipo: 'no-admin', ofreceSalida: false, motivo: MAKO_NO_ES_ADMIN };
  if (/timed? ?out|\b408\b/.test(t)) return { tipo: 'tiempo', ofreceSalida: true, motivo: 'WhatsApp no contestó a tiempo. Prueba de nuevo en un minuto.' };
  if (/connection closed|not connected|connection.{0,12}clos/.test(t)) return { tipo: 'sin-conexion', ofreceSalida: true, motivo: 'La línea de MaKo no está conectada en este momento. Prueba de nuevo en unos minutos.' };
  if (/item-not-found|\b404\b/.test(t) || status === 404) return { tipo: 'no-encontrado', ofreceSalida: true, motivo: 'WhatsApp no encontró ese número para este grupo. Revisa que esté bien escrito, con el código de país.' };
  return { tipo: 'otro', ofreceSalida: true, motivo: 'WhatsApp no dejó que MaKo lo sume.' };
}
