// =============================================================================
// El grupo de WhatsApp del DUEÑO, a su computadora: quién es el que escribe (25/10/2026)
// =============================================================================
// docs/conexiones-y-ayuda.md, decisión 2. Martín: «todo eso se hace con la app de escritorio de MaKo». El grupo de MaKo del
// dueño contesta con su computadora, igual que el chat de la app, SÓLO si el que escribe es la persona que conectó esa PC.
//
// En la app, la prueba es la cookie (`laPersonaEstaAdentro`). El doer de WhatsApp corre en un after() del webhook, sin cookie,
// así que la prueba es otra, y la hace la PUERTA (`encolarTurno`, lib/ia-pc.ts), no quien llama:
//   · el teléfono de quien escribe (el que manda WhatsApp, no lo que dice el mensaje) es un teléfono de verdad: nunca un @lid,
//     un jid ni un «whatsapp:…»;
//   · es de UNA sola persona ACTIVA del negocio de esa PC (su perfil, comparado con `mismoContacto`, AGENTS.md): si dos del
//     equipo cargaron el mismo, no es de nadie;
//   · y esa persona es la que conectó la PC (`actorDeSesion`, como lo guardó la PC al conectarse).
// Leads, crons, webhooks hacia un lead y Automations no llegan acá: no traen el teléfono de una persona del equipo, y D6a
// sigue entera para ellos (AGENTS.md; tests/ia-pc-nunca-a-leads.test.ts).
// Puro (sin server-only): lo prueban los tests y lo usa la puerta. Aparte de lib/ia-pc-reglas.ts para no llevar la tabla de
// países (`mismoContacto`) al bundle de «Tus cuentas de IA».
// =============================================================================

import { mismoContacto } from './numero-whatsapp';
import { actorDeSesion } from './ia-pc-reglas';

/** El teléfono, si lo es: dígitos (con o sin +, espacios, guiones o paréntesis), de 8 a 15. Un jid, un @lid o un «whatsapp:…», no. */
export function telefonoDeVerdad(x: unknown): string | null {
  const s = String(x ?? '').trim();
  if (!s || /[@:a-z]/i.test(s)) return null;
  const d = s.replace(/[\s()+.-]/g, '');
  return /^\d{8,15}$/.test(d) ? d : null;
}

export type UsuarioDelNegocio = { id?: unknown; email?: string | null; nombre?: string | null; estado?: string | null; telefono?: string | null };

/** ¿Ese teléfono es de UNA sola persona activa del negocio, y es `persona` (la que conectó la PC)? */
export function elTelefonoEsDeLaPersona(telefono: unknown, usuarios: readonly UsuarioDelNegocio[], persona: string | null | undefined): boolean {
  const t = telefonoDeVerdad(telefono);
  if (!t || !persona) return false;
  const iguales = usuarios.filter((u) => u.estado === 'activo' && mismoContacto(u.telefono, t));
  if (iguales.length !== 1) return false;
  const actor = actorDeSesion({ email: iguales[0].email, nombre: iguales[0].nombre, sub: iguales[0].id });
  return !!actor && actor.toLowerCase() === persona.toLowerCase();
}
