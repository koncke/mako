// =============================================================================
// notif-destinatarios — a QUIÉNES les llegan las notificaciones del negocio
// =============================================================================
// Un negocio no es una persona: el dueño quiere el reporte, la asistente quiere
// los avisos de reuniones y el contador quiere el de cobranza. Antes acá había un
// solo teléfono y un solo email, así que todo eso terminaba reenviado a mano.
//
// Es del WORKSPACE (lo leen los crons, que corren sin sesión), a diferencia del
// pop-up y el sonido, que son de cada persona (ver lib/perfil.ts).
//
// ── Por qué este módulo existe ───────────────────────────────────────────────
// Había TRES lugares distintos que parecían el mismo dato, y nadie los
// sincronizaba salvo el wizard de onboarding:
//
//   mako.numero_dueno   → con quién se arma el grupo de WhatsApp de MaKo.
//   user_telefono       → a qué número manda el cron la apertura del día.
//   user_email          → a qué mail manda el cron los reportes.
//
// Cambiar el número en Configuraciones escribía el primero y no el segundo, así
// que el grupo quedaba con el número nuevo y la apertura diaria seguía yendo al
// viejo. Nadie lo veía: los dos "andaban". Ahora la lista de acá es la fuente y
// los tres se escriben juntos; los singulares quedan como espejo del primero para
// no romper a quien todavía los lee.

import 'server-only';
import { getSetting, setSetting } from './settings';
import { getWorkspaceActual, runWithWorkspace, OWNER_WS } from './workspace';
import { getNumeroDueno, setNumeroDuenoYSync, agregarParticipanteGrupo, getGrupoJidMaKo } from './mako-grupo';
import { normalizarDestinatarios, soloDigitos, type Destinatarios } from './notif-catalogo';

const KEY_TELEFONOS = 'notif_telefonos';
const KEY_EMAILS = 'notif_emails';

export type { Destinatarios };

function parseLista(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

/**
 * ¿Son la misma persona? Compara por el final del número.
 *
 * Solo se usa al DERIVAR la lista de los settings viejos, donde los dos valores
 * apuntaban al dueño por definición. Un caso real de la base: `user_telefono` era
 * 526862168122 y `mako.numero_dueno` 5216862168122 — el mismo celular mexicano
 * con y sin el "1" que WhatsApp usaba antes. Tomarlos como dos personas le manda
 * cada reporte dos veces al mismo teléfono.
 *
 * En la lista que edita el usuario NO se aplica: ahí manda lo que él escribió, y
 * fusionarle dos contactos que él distingue sería peor que el duplicado.
 */
function mismaPersona(a: string, b: string): boolean {
  const fin = (s: string) => s.slice(-8);
  return a.length >= 8 && b.length >= 8 && fin(a) === fin(b);
}

/**
 * Los destinatarios del workspace actual.
 *
 * Si todavía no se guardó la lista, se arma con lo que había suelto: así un
 * workspace de antes de este cambio sigue recibiendo sin que nadie entre a
 * reconfigurarlo. `mako.numero_dueno` entra como respaldo porque hubo una época
 * en que solo se escribía ese.
 */
export async function getDestinatarios(): Promise<Destinatarios> {
  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  const [rawTel, rawMail, telViejo, mailViejo, numeroGrupo] = await Promise.all([
    getSetting(KEY_TELEFONOS),
    getSetting(KEY_EMAILS),
    getSetting('user_telefono'),
    getSetting('user_email'),
    getNumeroDueno(ws),
  ]);

  const guardados = parseLista(rawTel);
  let telefonos: string[];
  if (guardados) {
    telefonos = guardados;
  } else {
    // Derivación de compatibilidad: el de los reportes primero, y el del grupo
    // solo si de verdad es otra persona.
    telefonos = [telViejo ?? ''].filter(Boolean);
    const grupo = soloDigitos(numeroGrupo ?? '');
    if (grupo && !telefonos.some((t) => mismaPersona(soloDigitos(t), grupo))) telefonos.push(grupo);
  }

  return normalizarDestinatarios({ telefonos, emails: parseLista(rawMail) ?? [mailViejo ?? ''] });
}

export type ResultadoGuardar = {
  ok: boolean;
  destinatarios: Destinatarios;
  /** qué pasó con el grupo de WhatsApp al sincronizar los números. */
  grupo?: 'creado' | 'actualizado' | 'sin_cambios' | 'sin_numeros';
  error?: string;
  /**
   * Los que se guardaron en la lista pero NO entraron al grupo de WhatsApp, con
   * el motivo de cada uno.
   *
   * ⚠️ Existe porque acá había un `.catch(() => {})`. Sumar a alguien al grupo es
   * LO QUE LA PANTALLA PROMETE —«el resto se suma a ese mismo grupo»— y fallaba
   * sin decir una palabra. Un cliente lo reportó como «le di a enviar y no pasó
   * nada, ni siquiera un mensaje de error», que es exactamente lo que pasaba.
   */
  noAgregados?: Array<{ telefono: string; motivo: string }>;
};

/**
 * Guarda la lista y deja el mundo consistente: los tres settings viejos, y el
 * grupo de WhatsApp con TODOS los números adentro.
 *
 * El primer teléfono es el principal (con él se crea el grupo); el resto se suma
 * como participante. Quitar a alguien de la lista lo saca de los reportes, pero
 * NO lo echa del grupo: sacar gente de un grupo de WhatsApp ajeno es una acción
 * ruidosa y visible para todos, y no es lo que alguien espera al editar una lista
 * de destinatarios. Se avisa en la pantalla.
 */
export async function setDestinatarios(d: Partial<Destinatarios>, nombreCliente: string): Promise<ResultadoGuardar> {
  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  const dest = normalizarDestinatarios(d);

  await Promise.all([
    setSetting(KEY_TELEFONOS, JSON.stringify(dest.telefonos)),
    setSetting(KEY_EMAILS, JSON.stringify(dest.emails)),
    // Espejo de los singulares. `enviarAperturaDiaria` y `getContactoReportes`
    // todavía leen de acá; sin esto, cambiar el número dejaba la apertura del día
    // yendo al anterior.
    setSetting('user_telefono', dest.telefonos[0] ?? ''),
    setSetting('user_email', dest.emails[0] ?? ''),
  ]);

  if (dest.telefonos.length === 0) return { ok: true, destinatarios: dest, grupo: 'sin_numeros' };

  const principal = dest.telefonos[0];
  const teniaGrupo = Boolean(await getGrupoJidMaKo(ws));
  const sync = await setNumeroDuenoYSync(ws, principal, nombreCliente);
  if (!sync.ok) return { ok: false, destinatarios: dest, error: sync.error };

  // Los demás van como participantes. Es idempotente del lado de Evolution
  // (agregar a alguien que ya está contesta 409, que acá cuenta como hecho).
  //
  // ⚠️ Antes esta línea terminaba en `.catch(() => {})` y descartaba el valor de
  // retorno. Las dos mitades del mismo error: la excepción se tragaba y el
  // `{ ok: false, error }` ni se miraba. Agregar a alguien al grupo es lo que la
  // pantalla PROMETE, así que cuando no se puede hay que decirlo — es la regla de
  // la casa: si el que se tiene que enterar es el usuario, el aviso va donde él
  // mira, nunca a un log.
  const noAgregados: Array<{ telefono: string; motivo: string }> = [];
  for (const t of dest.telefonos.slice(1)) {
    const r = await agregarParticipanteGrupo(ws, t).catch((e) => ({
      ok: false as const, error: e instanceof Error ? e.message : String(e),
    }));
    if (!r.ok) noAgregados.push({ telefono: t, motivo: r.error ?? 'no se pudo agregar al grupo' });
  }

  return {
    ok: true,
    destinatarios: dest,
    grupo: !teniaGrupo ? 'creado' : sync.accion === 'sin_cambios' && dest.telefonos.length === 1 ? 'sin_cambios' : 'actualizado',
    noAgregados: noAgregados.length ? noAgregados : undefined,
  };
}

/** Igual que getDestinatarios pero para un workspace explícito (crons). */
export function getDestinatariosDe(ws: number): Promise<Destinatarios> {
  return runWithWorkspace(ws, () => getDestinatarios());
}
