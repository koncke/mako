// =============================================================================
// Vista de agencia — el lado servidor: leer la cartera y resolver el contexto
// =============================================================================
// El JUICIO («¿puede esta agencia mirar a este cliente?») vive en
// `lib/agencia-cartera.ts`, sin `server-only`, para que los tests lo puedan
// importar. Acá está lo que necesita base: leer las filas y decidir el contexto
// del request.
//
// ⚠️ SE PREGUNTA A LA BASE EN CADA REQUEST, y es a propósito. El token firmado
// alcanza para saber QUIÉN entró y a DÓNDE, pero no para saber si el super-admin
// revocó el acceso hace cinco minutos: eso cambia DESPUÉS de firmarlo. Un permiso
// que sólo se chequea al emitir el token es un permiso que se puede quitar y no
// se quita.
//
// El costo real es una sola consulta por request, y sólo para las sesiones que
// traen la cookie de agencia: `contextoDeAgencia` está memoizado con `cache()`
// (por request) y sale temprano —sin tocar la base— para el super-admin, para un
// cliente normal y para cualquiera sin la cookie, que es el 99% del tráfico. Es
// un lookup por clave primaria.
//
// ⚠️ Y ES FAIL-CLOSED. Si la consulta tira (la base caída, la tabla sin migrar),
// se devuelve null: la agencia NO entra. Un permiso que se abre cuando el store
// falla es el modo de falla de siempre — «un store que puede fallar sólo tiene
// permitido hacer las cosas MÁS restrictivas».

import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getSupabaseServer } from './supabase';
import { getUsuarioActual } from './auth';
import { AGENCIA_COOKIE, leerAgencia } from './auth-session';
import { puedeEntrar, clientesAprobados, esWsValido, type FilaCartera } from './agencia-cartera';

/** Las columnas que la pantalla necesita, además de las tres del juicio. */
export type FilaCarteraUI = FilaCartera & {
  decidido_por: string | null;
  decidido_at: string | null;
  motivo: string | null;
  created_at: string;
};

const COLS = 'agencia_ws, cliente_ws, estado, decidido_por, decidido_at, motivo, created_at';

/**
 * La cartera ENTERA de una agencia —los tres estados—, para dibujarla.
 * Devuelve `[]` si falla: una lista vacía se lee como «todavía no tiene
 * clientes», que es lo que la pantalla ya sabe mostrar.
 */
export async function carteraDeAgencia(agenciaWs: number): Promise<FilaCarteraUI[]> {
  if (!esWsValido(agenciaWs)) return [];
  try {
    const { data, error } = await getSupabaseServer()
      .from('agencia_clientes').select(COLS).eq('agencia_ws', agenciaWs);
    if (error) throw error;
    return (data ?? []) as FilaCarteraUI[];
  } catch {
    return [];
  }
}

/** Todo lo que está esperando la firma del super-admin, de todas las agencias. */
export async function pendientesDeAprobar(): Promise<FilaCarteraUI[]> {
  try {
    const { data, error } = await getSupabaseServer()
      .from('agencia_clientes').select(COLS).eq('estado', 'pendiente').order('created_at');
    if (error) throw error;
    return (data ?? []) as FilaCarteraUI[];
  } catch {
    return [];
  }
}

/** ¿De qué agencia es este workspace? Lo pregunta /admin sobre la fila de un cliente. */
export async function agenciasDeCliente(clienteWs: number): Promise<FilaCarteraUI[]> {
  if (!esWsValido(clienteWs)) return [];
  try {
    const { data, error } = await getSupabaseServer()
      .from('agencia_clientes').select(COLS).eq('cliente_ws', clienteWs);
    if (error) throw error;
    return (data ?? []) as FilaCarteraUI[];
  } catch {
    return [];
  }
}

/**
 * LA PREGUNTA DEL GUARD, contra la base, ahora.
 *
 * ⚠️ Trae la fila de ESA pareja y se la pasa al juicio puro en vez de resolver
 * con un `.eq('estado','aprobado')` en la query. Parece un rodeo y no lo es: así
 * la condición que decide el acceso es UNA, está en un módulo testeable, y la
 * consulta no puede tener su propia versión de la regla que se desincronice.
 */
export const puedeEntrarAhora = cache(async (agenciaWs: number, clienteWs: number): Promise<boolean> => {
  if (!esWsValido(agenciaWs) || !esWsValido(clienteWs) || agenciaWs === clienteWs) return false;
  try {
    const { data, error } = await getSupabaseServer()
      .from('agencia_clientes')
      .select('agencia_ws, cliente_ws, estado')
      .eq('agencia_ws', agenciaWs).eq('cliente_ws', clienteWs).limit(1);
    if (error) throw error;
    return puedeEntrar(agenciaWs, clienteWs, (data ?? []) as FilaCartera[]);
  } catch {
    return false;   // fail-closed: si no se puede preguntar, no se entra
  }
});

/**
 * El cliente que esta sesión de AGENCIA está mirando, o null.
 *
 * Los tres cortes, en orden, y cada uno cierra una puerta distinta:
 *
 *   1. **El token vale** (firma + vencimiento). Lo hace `leerAgencia`.
 *   2. **El token es de ESTA sesión** — `agenciaWs === sesion.ws`. Es lo que
 *      hace que la cookie no sea portable: pegada en otro navegador, el sujeto
 *      firmado no coincide con quien la presenta y no vale nada. El token viejo
 *      de impersonación no puede hacer esto porque firma sólo el número.
 *   3. **El permiso sigue vigente** — la consulta a la base.
 *
 * ⚠️ Y SALE TEMPRANO PARA EL SUPER-ADMIN. Un admin global ya resuelve su
 * contexto por `?ws=` y por `mako_ws`; si además honrara esta cookie habría tres
 * fuentes para el mismo dato y `getWorkspaceActual` / `estaImpersonando`
 * tendrían que coincidir en las tres. Dos ya costó un warning de doce líneas.
 */
export const contextoDeAgencia = cache(async (): Promise<number | null> => {
  const sesion = await getUsuarioActual();
  if (!sesion || sesion.rol === 'admin' || sesion.legacy) return null;
  if (!esWsValido(sesion.ws)) return null;

  const store = await cookies();
  const token = leerAgencia(store.get(AGENCIA_COOKIE)?.value);
  if (!token) return null;
  if (token.agenciaWs !== sesion.ws) return null;      // la cookie no es de esta sesión

  return (await puedeEntrarAhora(token.agenciaWs, token.clienteWs)) ? token.clienteWs : null;
});

/**
 * ¿Esta sesión es la de una agencia con al menos un cliente aprobado? Es lo que
 * decide si se dibuja la sección «Vista de agencia», y **no** si se puede entrar
 * — eso lo contesta `puedeEntrarAhora` del lado del server, en cada request.
 * Esconder el botón no protege nada; lo que protege es el guard.
 */
export async function esAgenciaConCartera(): Promise<boolean> {
  const sesion = await getUsuarioActual();
  if (!sesion || !esWsValido(sesion.ws)) return false;
  return clientesAprobados(sesion.ws, await carteraDeAgencia(sesion.ws)).length > 0;
}
