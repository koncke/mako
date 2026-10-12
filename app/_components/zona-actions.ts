'use server';

// =============================================================================
// La zona del negocio se DETECTA de la ubicación de SU equipo (decisión 4 de la décima, 11/10/2026)
// =============================================================================
// Martín: «Si, siempre por ubicación que se maneje por defecto. Detectando la ubicacion del usuario.» La monta
// app/_components/ZonaDelNegocio.tsx (una vez por pestaña, sin dibujar nada) con la zona del navegador. Las reglas
// de quién pisa a quién viven en lib/zona-negocio-reglas.ts (`decidirZona`); el único escritor, en lib/timezone.ts.
//
// ⚠️ QUIÉN CUENTA COMO «EL USUARIO» ES TODO EL PUNTO. La ubicación que se guarda es la de un ADMIN PROPIO del
// negocio: rol global que no es el de la plataforma, sin vista de agencia, mirando SU workspace y con rol de admin
// adentro. Nunca:
//   · el super admin con ?ws= (Martín en Buenos Aires mirando a un cliente de Tijuana le cambiaría la hora a ese
//     negocio: es el mismo modo de falla que le dejó un acento argentino a Mauricio, AGENTS.md);
//   · una agencia, un setter o un closer (no deciden el horario del negocio);
//   · un `next dev`: bootear la app local ESCRIBE en prod (VERCEL_ENV sólo vale 'production' en el deploy).
// Para los que NO son propios, si el negocio no tiene zona, se usan las integraciones DEL CLIENTE (Cal.com,
// Google, Meta, teléfono), nunca el navegador ni la IP de quien mira.
//
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md).

import { headers } from 'next/headers';
import { getUsuarioActual } from '@/lib/auth';
import { contextoDeAgencia } from '@/lib/agencia';
import { getWorkspaceActual } from '@/lib/workspace';
import { fijarZonaDelNegocio, inferirZonaDesdeIntegraciones, zonaDelNegocioDetalle } from '@/lib/timezone';
import { zonaDeUbicacion, type OrigenZona } from '@/lib/zona-negocio-reglas';

/** El header que Vercel pone con la zona de la IP de quien pide. Sólo llena un vacío del navegador. */
const HEADER_ZONA_IP = 'x-vercel-ip-timezone';

export async function detectarZonaAction(tzNavegador: unknown): Promise<void> {
  try {
    // 1. Sólo en producción: un `next dev` local lee y escribe la base de prod.
    if (process.env.VERCEL_ENV !== 'production') return;
    // 2. Sin sesión, o la sesión vieja compartida: nada.
    const sesion = await getUsuarioActual();
    if (!sesion || sesion.legacy) return;
    // 3. El negocio que se está mirando.
    const ws = await getWorkspaceActual();
    if (ws == null) return;
    // 4. ¿Es un admin PROPIO de este negocio?
    const propio = sesion.rol !== 'admin'
      && !(await contextoDeAgencia())
      && sesion.ws === ws
      && (sesion.rolWs ?? 'admin') === 'admin';

    if (propio) {
      // Ya la eligió una persona o ya se detectó: nada que hacer (la lectura va por el memo; el escritor relee).
      const ya = (await zonaDelNegocioDetalle(ws)).origen?.origen;
      if (ya === 'persona' || ya === 'navegador') return;
      // 5. Su navegador; si no sirve (UTC de un modo privado, sin Intl), la zona de su IP.
      let zona = zonaDeUbicacion(tzNavegador);
      let origen: OrigenZona = 'navegador';
      if (!zona) {
        zona = zonaDeUbicacion((await headers()).get(HEADER_ZONA_IP));
        origen = 'ip';
      }
      if (!zona) return;
      await fijarZonaDelNegocio(ws, zona, origen, sesion.email || null);
      return;
    }

    // 6. NO propio (super admin con ?ws=, agencia, setter, closer): sólo si el negocio no tiene zona, y con las
    //    integraciones DEL CLIENTE. Nunca el navegador ni la IP de quien mira.
    const actual = await zonaDelNegocioDetalle(ws);
    if (actual.guardada) return;
    const inferida = await inferirZonaDesdeIntegraciones(ws);
    if (!inferida) return;
    await fijarZonaDelNegocio(ws, inferida.tz, inferida.origen, null);
  } catch (e) {
    // Detectar la zona nunca puede romper una pantalla.
    console.error(`[zona] detectar: ${e instanceof Error ? e.message : String(e)}`);
  }
}
