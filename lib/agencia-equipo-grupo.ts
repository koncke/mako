// =============================================================================
// El equipo de la agencia en el grupo de MaKo de un cliente suyo — lo PURO (3/11/2026)
// =============================================================================
// Martín, 3/11/2026: «cuando un usuario agencia se une a MaKo, es decir, cuando nuevos clientes de ese mismo usuario agencia se
// unen, cuando crea el grupo automáticamente que le invite a las personas que están en el usuario padre». Lo que habla con la base y
// con WhatsApp vive en lib/mako-grupo.ts (`sumarEquipoDeAgenciaAlGrupo`); acá, a quién y qué se dice. SIN `server-only`: se ejecuta en
// tests/agencia-grupos-auto.test.ts.
//
// ⚠️ DE DÓNDE SALE EL TELÉFONO, MEDIDO EN PRODUCCIÓN (3/11/2026): la única agencia tiene un usuario y su `perfil.telefono` está VACÍO. Su
// número vive en `mako.numero_dueno` de la agencia. Con sólo el perfil, el automático no invitaba a nadie, en silencio.
//
// ⚠️ SÓLO QUIEN ADMINISTRA LA AGENCIA, NO TODO SU EQUIPO. En ese grupo caen los reportes de ventas, gasto y montos del cliente, y la
// auditoría del 14/10/2026 cerró justamente que un closer o un setter se sumara a él (app/api/perfil/destinatarios/route.ts). Es el
// mismo corte de la pantalla: el admin de la agencia entra a Notificaciones del cliente; su closer, no.

/** Una fila de `usuarios` de la agencia, con lo que hace falta. */
export type MiembroAgencia = { nombre?: string | null; perfil?: { telefono?: unknown } | null; rol_ws?: string | null; estado?: string | null };

export const soloDigitosTel = (s: unknown): string => String(s ?? '').replace(/\D/g, '');

/**
 * ¿Son el mismo teléfono? Por el final: el mismo celular de Argentina llega como `549…` (WhatsApp), `54…` y `+54 9 …` (tipeado en el
 * perfil), y tomarlos como dos personas lo invita dos veces. El mismo criterio que `mismaPersona` (lib/notif-destinatarios.ts).
 */
export function mismoTelefono(a: unknown, b: unknown): boolean {
  const x = soloDigitosTel(a), y = soloDigitosTel(b);
  return x.length >= 8 && y.length >= 8 && x.slice(-8) === y.slice(-8);
}

/** rol_ws NULL es admin (`getRolWsEfectivo`, el backfill). Un suspendido no entra; un invitado todavía no entró a MaKo. */
export const administraActivo = (u: Pick<MiembroAgencia, 'rol_ws' | 'estado'>): boolean => (u.rol_ws == null || u.rol_ws === 'admin') && (u.estado == null || u.estado === 'activo');

/**
 * Los teléfonos de quienes administran la agencia, sin repetir: el número del dueño de la agencia primero, y los perfiles.
 * Un número de menos de 8 dígitos no es un teléfono: no se lo manda a WhatsApp.
 */
export function telefonosDelEquipo(miembros: readonly MiembroAgencia[], numeroDueno: string | null | undefined): string[] {
  const out: string[] = [];
  const sumar = (t: unknown) => {
    const d = soloDigitosTel(t);
    if (d.length >= 8 && !out.some((x) => mismoTelefono(x, d))) out.push(d);
  };
  sumar(numeroDueno);
  for (const m of miembros) if (administraActivo(m)) sumar(m.perfil?.telefono);
  return out;
}

/** Quiénes faltan: los que no están entre los números que ya se sabe que están adentro. */
export function quienesFaltan(equipo: readonly string[], adentro: readonly unknown[]): string[] {
  return equipo.filter((t) => !adentro.some((a) => mismoTelefono(t, a)));
}

/** El número de un participante de `GET /group/participants` (`id` es un `@lid`; el teléfono viene en `phoneNumber`: lib/grupo-wa-reglas.ts). */
export function telefonoDeParticipante(p: { id?: unknown; jid?: unknown; phoneNumber?: unknown }): string {
  for (const v of [p.phoneNumber, p.jid, p.id]) {
    const s = String(v ?? '');
    if (s && !s.includes('@lid')) {
      const d = soloDigitosTel(s.split('@')[0].split(':')[0]);
      if (d) return d;
    }
  }
  return '';
}

/**
 * Lo que dice el grupo sobre quién entró, para que el cliente no vea caer un número suelto sin saber de quién es. Sólo nombra a la
 * agencia: lo de plata y cuenta publicitaria va a la agencia y nunca a este grupo (lib/avisos-catalogo.ts, `aLaAgencia`).
 *
 * Dice lo que PASÓ: «sumé» sólo si alguien entró; si WhatsApp no dejó y salió la invitación, «invité». Sin nadie, vacío.
 */
export function lineaDeLaAgencia(agencias: readonly string[], r: { entraron: number; invitados: number }): string {
  const nombres = agencias.map((a) => a.trim()).filter(Boolean);
  if (nombres.length === 0 || r.entraron + r.invitados === 0) return '';
  const quien = nombres.length === 1 ? `*${nombres[0]}*, tu agencia` : `tus agencias, ${nombres.map((n) => `*${n}*`).join(' y ')}`;
  return `${r.entraron > 0 ? 'Sumé' : 'Invité'} también a ${quien}, para que vean lo mismo que tú en este grupo.`;
}
