import 'server-only';

// =============================================================================
// alumno-acceso — el cliente que entra a SU curso: la cookie, el login con Google y el link
// =============================================================================
// La firma pura (formato, vencimiento) vive en lib/alumno-sesion.ts; acá está lo que toca la base y
// las cookies. El porqué de una cookie propia y no una `mako_session`, en la cabecera de aquel.
//
// ⚠️ LA COOKIE NO SE CREE: se REVALIDA en cada pedido con la MISMA regla del link del portal
// (`resolverAcceso`: versión vigente, no revocado, lead ganado). Por eso no hay una segunda
// implementación de «¿este acceso abre?»: la cookie se traduce al token `c1.` de esa misma
// (ws, lead, versión) y se le pregunta a `resolverAcceso`, adentro del workspace de la firma.
// Revocar sube la versión, así que corta la cookie en el pedido siguiente.

import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { runWithWorkspace } from './workspace';
import { getSupabaseServer } from './supabase';
import { buscarUsuarioPorEmail } from './usuarios';
import { firmarAccesoCurso, type AccesoCurso } from './curso-acceso';
import { resolverAcceso, linkDeAcceso, accesoDe } from './curso-datos';
import { ALUMNO_COOKIE, ALUMNO_DIAS, firmarSesionAlumno, leerSesionAlumno, opcionesCookieAlumno, urlDeEntrada } from './alumno-sesion';

/**
 * ¿Este acceso abre HOY? Devuelve el token `c1.` de esa (ws, lead, versión) —el que usan las rutas
 * del portal— o `null` si ya no abre. ⚠️ Un error de base TIRA: «no pude leer» no es «revocado».
 */
async function accesoVigente(a: AccesoCurso): Promise<{ acceso: AccesoCurso; token: string } | null> {
  const token = firmarAccesoCurso(a);
  if (!token) return null;
  return runWithWorkspace(a.ws, async () => {
    const acceso = await resolverAcceso(token);
    return acceso ? { acceso, token } : null;
  });
}

/** La firma de la cookie de ESTE pedido, sin mirar la base. `null` = no hay alumno. */
export async function firmaDeLaCookie(): Promise<AccesoCurso | null> {
  const store = await cookies();
  return leerSesionAlumno(store.get(ALUMNO_COOKIE)?.value);
}

/**
 * Para /login: ¿hay una cookie de alumno que todavía abre? Si la base no contesta se le cree a la
 * firma: lo único que decide esto es si se ofrece un link, y /mi-curso vuelve a mirar igual.
 */
export async function hayAlumnoVigente(): Promise<boolean> {
  const firma = await firmaDeLaCookie();
  if (!firma) return false;
  try {
    return (await accesoVigente(firma)) != null;
  } catch {
    return true;
  }
}

/**
 * El login con Google de alguien que NO es usuario de MaKo: el acceso al que se lo invitó con ese
 * email (mig 0206). `null` = no hay ninguno que abra.
 *
 * ⚠️ `usuarios` GANA, y se vuelve a preguntar acá aunque el callback ya lo hizo: el callback llega
 * a esta rama también con un usuario SUSPENDIDO (`resolverUsuario` devuelve null para los dos
 * casos), y un suspendido no puede colarse como alumno por la puerta de al lado.
 *
 * ⚠️ «Tiene fila» NO es «lo invitaron»: la fila nace con sólo abrir la pestaña Curso de la ficha.
 * Lo que dice que el mail salió es `invitacion_enviada_at` (lo estampa `marcarInvitacion` después
 * del envío), y sin eso el email ni siquiera es dato de esta persona.
 *
 * ⚠️ SIN scope de inquilino, a propósito y con el email EXPLÍCITO en el filtro: el callback no sabe
 * todavía de qué negocio es el alumno. `.eq` y no `.ilike`: un `_` del email es comodín en un patrón
 * (AGENTS.md, «Un patrón trae CANDIDATOS»). Va en minúsculas porque `marcarInvitacion` —el único que
 * escribe la columna— la guarda así.
 *
 * Si es alumno de dos negocios gana la invitación MÁS RECIENTE que siga abriendo: se prueban en ese
 * orden y la primera vigente entra (un lead que dejó de ser ganado no tapa al otro).
 *
 * ⚠️ SÓLO LA INVITACIÓN DEL CLIENTE (`area` null), nunca la de un LÍDER de área (#665, mig 0212): la
 * cookie que sale de acá es la DEL CLIENTE, así que leer la fila de un líder le abriría al líder
 * todo el curso del cliente. El líder entra sólo con su link (lib/curso-acceso.ts, `c2.`).
 */
export async function accesoInvitadoPorEmail(email: string): Promise<AccesoCurso | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  if (await buscarUsuarioPorEmail(e)) return null;
  const { data, error } = await getSupabaseServer()
    .from('curso_accesos')
    .select('workspace_id, lead_id, version')
    .eq('email', e)
    .is('area', null)
    .not('invitacion_enviada_at', 'is', null)
    .is('revocado_at', null)
    .order('invitacion_enviada_at', { ascending: false })
    .limit(5);
  if (error) throw new Error(`curso_accesos: ${error.message}`);
  for (const f of (data ?? []) as Array<{ workspace_id: number | string; lead_id: number | string; version: number | string }>) {
    // ⚠️ bigint puede llegar como texto según el cliente (AGENTS.md): se pasa por Number siempre.
    const a: AccesoCurso = { ws: Number(f.workspace_id), leadId: Number(f.lead_id), version: Number(f.version) };
    const v = await accesoVigente(a);
    if (v) return v.acceso;
  }
  return null;
}

/** Pone la cookie del alumno en una respuesta. `false` = no hay secreto para firmarla. */
export function ponerCookieAlumno(res: NextResponse, a: AccesoCurso): boolean {
  const valor = firmarSesionAlumno(a);
  if (!valor) return false;
  res.cookies.set({ name: ALUMNO_COOKIE, value: valor, maxAge: ALUMNO_DIAS * 24 * 60 * 60, ...opcionesCookieAlumno() });
  return true;
}

/**
 * El link de entrada para el MAIL de invitación (`/api/compartido/curso/entrar?t=…`): deja la
 * cookie y lleva a /mi-curso. Crea el acceso si el cliente no lo tenía (lo hace `linkDeAcceso`).
 * `null` = el acceso está REVOCADO o no hay secreto: no se manda un link que no abre.
 *
 * ⚠️ Igual que `linkDeAcceso`: quien llama está ADENTRO del workspace del cliente (sesión o
 * `runWithWorkspace`), y `ws` es ese mismo workspace.
 */
export async function linkDeEntradaAlumno(leadId: number, ws: number, porQuien: string | null = null): Promise<string | null> {
  if (!(await linkDeAcceso(leadId, ws, porQuien))) return null;
  const a = await accesoDe(leadId);
  if (!a || a.revocado) return null;
  const token = firmarAccesoCurso({ ws, leadId, version: a.version });
  return token ? urlDeEntrada(token) : null;
}
