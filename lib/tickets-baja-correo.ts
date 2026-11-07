import 'server-only';

// =============================================================================
// «No me mandes más los correos de los tickets»: UN solo lugar que lo escribe (6/11/2026)
// =============================================================================
// Hay dos caminos para pedir la baja, y antes de este archivo había uno solo:
//   · el link del pie del correo (app/api/email/unsubscribe/tickets), que no pide sesión y lo autentica una firma;
//   · la casilla de Notificaciones (/api/perfil/correos-tickets), que sí la pide.
//
// ⚠️ SE ESCRIBE EN DOS LUGARES, Y POR ESO ESTÁ ACÁ Y NO EN CADA RUTA:
//   · `usuarios.perfil.ticketsPorEmail` de ESA cuenta (mig 0364), que es lo que la persona ve en su cuenta;
//   · `correo_bajas` por su DIRECCIÓN (mig 0410), que es lo que vale para TODAS sus cuentas.
// Una fila de `usuarios` no es una persona: es una persona en un negocio.
//
// ⚠️⚠️ CORRECCIÓN (6/11/2026, el mismo día): acá decía «y la misma dirección puede estar en varias
// (`usuarios(email)` tiene un índice NO único, 0053)». **ES FALSO.** La 0053 declara `email text not null unique` y
// ninguna migración lo saca; medido contra producción, `usuarios_email_key` = `UNIQUE (email)`, y el `idx_usuarios_email`
// que se citó es un índice de MÁS, no único, al lado del único. O sea que `filasDe` devuelve siempre UNA fila, y el bug de
// «apretó la baja en un negocio y los sigue recibiendo por el otro» **no podía pasar**. Esto se queda igual igual: la
// razón de ser de la 0410 es la OTRA —quien no tiene cuenta no tenía dónde guardar su «no me escribas»—, que sí es real,
// y escribir los dos lugares desde un solo módulo sigue siendo lo correcto. Ver docs/hallazgos-ajustes.md →
// «El índice de más que se leyó como el único».
//
// Y el porqué de que la regla viva acá y no en cada ruta se sostiene solo: con la regla en dos rutas distintas, el
// próximo camino vuelve a escribir una sola mitad.
//
// ⚠️ Y EL ORDEN IMPORTA: primero la dirección. Si lo segundo falla, queda una baja que frena MÁS correos de los que la
// persona apagó, que es el lado correcto para equivocarse. Al revés quedaría una baja a medias que sigue escribiendo.
// =============================================================================

import { getSupabaseServer } from './supabase';
import { CLAVE_PERFIL_CORREOS, TIPO_BAJA_TICKETS, apagoLosCorreos } from './tickets-avance';

/** De dónde vino la baja, para poder contestar «¿cuándo y cómo la pidió?» (`correo_bajas.por`). */
export type CaminoDeLaBaja = 'link-del-correo' | 'notificaciones';

type FilaConPerfil = { id: number; perfil: Record<string, unknown> };

/** La dirección de una fila de `usuarios`, en minúsculas. '' = no existe o no se pudo leer. */
async function emailDe(usuarioId: number): Promise<string> {
  const { data, error } = await getSupabaseServer().from('usuarios').select('email').eq('id', usuarioId).maybeSingle();
  if (error || !data) return '';
  return String((data as { email?: unknown }).email ?? '').trim().toLowerCase();
}

/**
 * Las filas de `usuarios` con esa dirección, con su perfil. **Hoy es siempre UNA**: `usuarios.email` es `unique`
 * (mig 0053, medido en producción el 6/11/2026). Acá decía «son VARIAS a propósito»: ver la corrección de la cabecera.
 *
 * ⚠️ Se deja con `.eq(…).limit(50)` y no se vuelve a `.maybeSingle()`, por dos razones y ninguna es la de antes: una
 * lista no se cae si mañana alguien saca el `unique` (un `maybeSingle()` ahí tira PGRST116, que es el hallazgo de
 * `filaPropia`, lib/perfil.ts), y el `for` de `cambiarBajaPorEmail` ya está escrito sobre una lista. Un error de lectura
 * vuelve como `null` y lo convierte en «no se pudo», nunca en «no hay ninguna».
 */
async function filasDe(email: string): Promise<FilaConPerfil[] | null> {
  const { data, error } = await getSupabaseServer().from('usuarios').select('id, perfil').eq('email', email).limit(50);
  if (error) return null;
  return (data ?? []).map((f) => {
    const p = (f as { perfil?: unknown }).perfil;
    return { id: Number((f as { id: unknown }).id), perfil: (p && typeof p === 'object' ? p : {}) as Record<string, unknown> };
  });
}

/** ¿Está anotada la baja de esa dirección? null = no se pudo leer (y eso NO es «le llegan»). */
export async function pidioLaBajaPorEmail(email: string): Promise<boolean | null> {
  const a = email.trim().toLowerCase();
  if (!a) return false;
  const { data, error } = await getSupabaseServer().from('correo_bajas')
    .select('email').eq('tipo', TIPO_BAJA_TICKETS).eq('email', a).limit(1);
  // Un error de lectura no se contesta como «le llegan»: eso le mostraría la casilla prendida a quien pidió la baja.
  if (error) return null;
  return !!data?.length;
}

/**
 * ¿Los tiene apagados, mirando los DOS lugares? Con la baja puesta desde OTRA cuenta con su misma dirección, esta tiene
 * que verse apagada igual: si no, la pantalla diría que le llegan correos que no le llegan.
 */
export async function apagadosPorEmail(email: string, perfil?: Record<string, unknown>): Promise<boolean | null> {
  if (perfil && apagoLosCorreos(perfil)) return true;
  const porDireccion = await pidioLaBajaPorEmail(email);
  if (porDireccion === null) return null;
  if (porDireccion) return true;
  if (perfil) return false;
  const filas = await filasDe(email.trim().toLowerCase());
  return filas === null ? null : filas.some((f) => apagoLosCorreos(f.perfil));
}

/**
 * Apaga (o vuelve a prender) los correos de los tickets de esa DIRECCIÓN, en los dos lugares. false = no se pudo.
 *
 * El perfil se toca en TODAS las filas con esa dirección, no sólo en la que pidió el cambio: así la casilla de cada
 * cuenta dice lo mismo que lo que de verdad va a pasar. La que manda, igual, es `correo_bajas`.
 */
export async function cambiarBajaPorEmail(email: string, prender: boolean, por: CaminoDeLaBaja): Promise<boolean> {
  const a = email.trim().toLowerCase();
  if (!a) return false;
  const db = getSupabaseServer();

  // Primero la dirección: ver la cabecera.
  const r = prender
    ? await db.from('correo_bajas').delete().eq('email', a).eq('tipo', TIPO_BAJA_TICKETS)
    // Upsert y no insert: pedirlo dos veces no apila filas (`unique (email, tipo)`).
    : await db.from('correo_bajas').upsert({ email: a, tipo: TIPO_BAJA_TICKETS, por, at: new Date().toISOString() }, { onConflict: 'email,tipo' });
  if (r.error) return false;

  const filas = await filasDe(a);
  if (filas === null) return false;
  for (const f of filas) {
    // El jsonb `perfil` se escribe ENTERO: se parte de lo que hay (lib/perfil.ts) para no borrar `notifInApp` ni el resto.
    const nuevo = { ...f.perfil };
    if (prender) delete nuevo[CLAVE_PERFIL_CORREOS];
    else nuevo[CLAVE_PERFIL_CORREOS] = false;
    const { error } = await db.from('usuarios').update({ perfil: nuevo, updated_at: new Date().toISOString() }).eq('id', f.id);
    if (error) return false;
  }
  return true;
}

/** Lo mismo, para el link del correo, que sólo conoce el id de la fila. */
export async function tieneLosCorreosApagados(usuarioId: number): Promise<boolean | null> {
  const email = await emailDe(usuarioId);
  return email ? apagadosPorEmail(email) : null;
}
export async function cambiarBajaDeTickets(usuarioId: number, prender: boolean, por: CaminoDeLaBaja): Promise<boolean> {
  const email = await emailDe(usuarioId);
  return email ? cambiarBajaPorEmail(email, prender, por) : false;
}
