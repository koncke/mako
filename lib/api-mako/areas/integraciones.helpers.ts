// =============================================================================
// api-mako/areas/integraciones.helpers — lo que el área necesita y lib/ no exporta
// =============================================================================
// Dos piezas, las dos DEUDA (viven inline en rutas y no en lib):
//
//  1. EL GUARD DE PLATAFORMA POR WORKSPACE. `servicioDelContexto` vive solo en
//     app/api/integraciones/credencial/route.ts. `servicioMetodo()` es el accessor
//     CRUDO: devuelve GitHub (soloPlataforma) a cualquiera. La pregunta es «¿el
//     workspace objetivo es el de la plataforma?» (ws === wsSuperAdmin()), nunca
//     «¿quien pide es admin?», y la respuesta a quien no le toca es «no existe».
//     El día que exista lib/integraciones-credencial.ts, esto se borra.
//  2. LAS TARJETAS VISIBLES. getIntegraciones calcula el estado de TODAS (credWs por
//     campo, landing, Google, agente) solo para saber cuáles se ven; para validar un
//     key alcanza con la regla de visibilidad (capa + plataforma), que es pura.
// =============================================================================

import 'server-only';
import { servicioMetodo, serviciosPara, type ServicioMetodo } from '@/lib/metodo-catalogo';
import { DEFS as DEFS_TARJETAS, defsVisibles, type Def } from '@/lib/integraciones-catalogo';
import { capaDef, type CapaId } from '@/lib/capas';
import { getWorkspace, wsSuperAdmin } from '@/lib/workspace';

/** ¿Este workspace es el de la plataforma? Fail-closed: si no se puede saber, no. */
export async function esWsPlataforma(ws: number): Promise<boolean> {
  const sup = await wsSuperAdmin().catch(() => -1);
  return ws === sup;
}

/** El servicio del catálogo del método que ESTE workspace tiene derecho a ver, o undefined. */
export async function servicioDelWs(key: string, ws: number): Promise<ServicioMetodo | undefined> {
  const s = servicioMetodo(key);
  if (!s) return undefined;
  if (s.soloPlataforma && !(await esWsPlataforma(ws))) return undefined;
  return s;
}

/** Los keys del catálogo del método que este workspace puede nombrar (para `disponibles`). */
export async function keysServiciosDelWs(ws: number): Promise<string[]> {
  return serviciosPara(await esWsPlataforma(ws)).map((s) => s.key);
}

/**
 * Las integraciones de /integraciones que este workspace puede configurar: su capa y la regla de plataforma.
 *
 * ⚠️ CON LAS `oculto` (25/10/2026). Desde que las cuatro IA (anthropic, openai, gemini, groq) y Google Calendar dejaron de
 * ser tarjetas de la grilla, `defsVisibles` las sacaba, y link_configurar_integracion (la única que usa esto) contestaba
 * «La integración «anthropic» no existe para este negocio»: MaKo, en el chat y en WhatsApp, no podía mandar el link para
 * conectarlas — justo el caso de un cliente al que le falta su clave. `oculto` es «no es una tarjeta», no «no se
 * configura»: su `?abrir=<key>` abre el modal suelto. Es lo mismo que hacen `getIntegraciones({ conOcultas: true })` y
 * `getIntegracion` (lib/integraciones.ts). La capa y la plataforma siguen cortando igual.
 */
export async function tarjetasDelWs(ws: number): Promise<Def[]> {
  const w = await getWorkspace(ws).catch(() => null);
  const cap = capaDef((w?.capa ?? null) as CapaId | null);
  return defsVisibles(DEFS_TARJETAS.map((d) => ({ ...d, oculto: false })), {
    cats: cap.categoriasIntegraciones,
    ocultas: new Set(cap.integracionesOcultas ?? []),
    esSuper: await esWsPlataforma(ws),
  });
}
