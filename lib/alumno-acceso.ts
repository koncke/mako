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
import { runWithWorkspace, getWorkspace } from './workspace';
import { getSupabaseServer } from './supabase';
import { buscarUsuarioPorEmail } from './usuarios';
import { firmarAccesoCurso, type AccesoCurso } from './curso-acceso';
import { resolverAcceso, linkDeAcceso, accesoDe, emitirLinkMagico, consumirLinkMagico } from './curso-datos';
import { mandarLinkAlumnoPorEmail } from './invitaciones';
import {
  ALUMNO_COOKIE, ALUMNO_DIAS, LINK_ALUMNO_MINUTOS, firmarSesionAlumno, leerSesionAlumno, opcionesCookieAlumno, urlDeEntrada,
  firmarLinkAlumno, leerLinkAlumno, urlDeLinkAlumno,
} from './alumno-sesion';

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

// ── «Soy alumno: entrar con mi email» (07/10/2026) ───────────────────────────────
// La forma del link y por qué un solo uso, en lib/alumno-sesion.ts. Las dos mitades de acá las
// llaman las rutas de app/api/alumno/: pedir el link (`mandarLinkDeEntrada`) y entrar con él
// (`entrarConLinkDeEmail`).

/**
 * Le manda el link de entrada a ESE email, SI tiene una invitación vigente. Si no la tiene, no hace
 * nada — y quien llama no se entera de cuál de las dos pasó: la ruta contesta lo mismo siempre.
 *
 * ⚠️ LA MISMA BÚSQUEDA QUE EL LOGIN CON GOOGLE (`accesoInvitadoPorEmail`): sólo invitaciones que
 * SALIERON, del CLIENTE (nunca de un líder), no cortadas, con el lead ganado; y `usuarios` gana —
 * a un usuario de MaKo no se le manda una puerta de alumno. Con dos búsquedas, el email abriría una
 * cosa por Google y otra por acá.
 *
 * ⚠️ EL NONCE SE ESCRIBE ANTES DEL MAIL (`emitirLinkMagico`, compare-and-set con la espera de un
 * minuto en el WHERE): dos pedidos a la vez no mandan dos mails. Tira si la base falla (lo atrapa la
 * ruta, que ya contestó).
 */
export async function mandarLinkDeEntrada(email: string): Promise<void> {
  const a = await accesoInvitadoPorEmail(email);
  if (!a) return;
  await runWithWorkspace(a.ws, async () => {
    const nonce = await emitirLinkMagico(a.leadId, a.version);
    if (!nonce) return;
    const token = firmarLinkAlumno({ ws: a.ws, leadId: a.leadId, version: a.version }, nonce);
    if (!token) return;
    const negocio = (await getWorkspace(a.ws).catch(() => null))?.nombre?.trim() || null;
    const r = await mandarLinkAlumnoPorEmail({ email, enlace: urlDeLinkAlumno(token), minutos: LINK_ALUMNO_MINUTOS, negocio });
    if (!r.enviado) console.error('[alumno-link] no salió el link de entrada:', r.error);
  });
}

/**
 * Entra con el link del mail: lo GASTA (un solo uso) y devuelve el acceso para poner la cookie.
 * `null` = no abre (firma mala, vencido, ya usado, reemplazado por otro, cortado, ya no es cliente)
 * — UNA respuesta sin el porqué: distinguir los casos ayudaría a probar tokens. Tira si la base falla.
 *
 * ⚠️ EL WORKSPACE SALE DE LA FIRMA, y adentro de él: primero se gasta el nonce (compare-and-set, que
 * además exige la versión vigente y no revocado) y DESPUÉS `resolverAcceso`, la misma regla de la
 * cookie y del link del curso (lead ganado). Gastarlo primero es a propósito: si la regla dice que no,
 * el link igual quedó usado, y no hay un segundo intento con el mismo token.
 */
export async function entrarConLinkDeEmail(token: string): Promise<AccesoCurso | null> {
  const l = leerLinkAlumno(token);
  if (!l) return null;
  return runWithWorkspace(l.ws, async () => {
    if (!(await consumirLinkMagico(l.leadId, l.version, l.nonce))) return null;
    const c1 = firmarAccesoCurso({ ws: l.ws, leadId: l.leadId, version: l.version });
    if (!c1) return null;
    return resolverAcceso(c1);
  });
}
