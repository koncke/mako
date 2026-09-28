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
 *
 * ⚠️ Y EL `===` DEL JUICIO COMPARA NÚMEROS, MEDIDO Y NO SUPUESTO. Las dos
 * columnas son `bigint`, y un bigint puede llegar como STRING según quién lo
 * lea: el driver `postgres` de los scripts devuelve `'13'`. Si PostgREST hiciera
 * lo mismo, `f.agencia_ws === agenciaWs` sería false SIEMPRE y nadie entraría
 * nunca — un fail-closed silencioso que se lee como «el botón no hace nada».
 * Comprobado contra prod el 27/09/2026: supabase-js devuelve
 * `{"agencia_ws":13}` con `typeof === 'number'`. Si algún día esto se lee por
 * otro camino, hay que volver a medirlo.
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

/**
 * ¿De qué agencia es este cliente? — para DECIR la cadena, no para autorizar.
 *
 * ⚠️ SE DERIVA, NO SE PASA POR LA URL, y ésa es la decisión que evita un bug y un
 * leak a la vez. La tentación era un `?via=13` puesto por quien hace el click:
 *   · Se pierde en la primera navegación. Medido: `conWs` (lib/ws-tab.ts) y
 *     `useWs` miran SÓLO `ws`, y `rutaConWs` lee el header — ninguna de las
 *     cuatro formas de navegar re-pega un parámetro extra. La cadena aparecería
 *     al entrar y desaparecería al primer click, que es peor que no tenerla.
 *   · Y sería un dato de afuera echado en pantalla: cualquiera pondría `?via=N`
 *     en su propia URL y aprendería el nombre de un workspace ajeno.
 * Acá sale de la base, así que es verdad siempre y sobrevive a cualquier ruta.
 *
 * ⚠️ Y CON DOS AGENCIAS NO SE AFIRMA NADA. La relación es N:N a propósito (un
 * cliente puede haber venido por una agencia y seguir siendo cliente directo).
 * Si hay dos dueños aprobados, la cadena es ambigua: se devuelve null y el cartel
 * dice lo de siempre. Elegir el primero sería inventar un padre.
 */
export const agenciaDeCliente = cache(async (clienteWs: number | null | undefined): Promise<{ ws: number; nombre: string } | null> => {
  if (!esWsValido(clienteWs)) return null;
  // ⚠️ CUALQUIER ESTADO, NO SÓLO 'aprobado', y el cambio importa: de esto cuelga
  // la CADENA que se dibuja en la barra y el escalón al que vuelve «Salir», que
  // son hechos de NAVEGACIÓN — «de quién es este cliente»— y no un permiso. Con
  // sólo las aprobadas, el caso que el dueño más quiere mirar —inspeccionar un
  // pedido ANTES de firmarlo— se quedaba sin cadena y sin escalón, o sea que
  // salir lo mandaba dos niveles arriba de una.
  // El permiso lo sigue contestando `puedeEntrarAhora`, que es otra función y
  // mira 'aprobado'. Son dos preguntas y por eso son dos lecturas.
  const duenos = await agenciasDeCliente(clienteWs);
  // Con dos dueños la cadena es ambigua y no se afirma nada: elegir el primero
  // sería inventar un padre. Se distingue de «no tiene dueño» en el log, no en
  // el valor — las dos cosas significan «no hay escalón que mostrar».
  if (duenos.length !== 1) return null;
  const ws = duenos[0].agencia_ws;
  try {
    // El nombre se pide acá y no con `getWorkspace` para no importar
    // lib/workspace.ts: ese módulo ya importa ÉSTE (`contextoDeAgencia`), y el
    // ciclo sólo funciona mientras nadie llame nada al cargar. Una consulta por
    // id contra una tabla de nueve filas es más barato que esa fragilidad.
    const { data } = await getSupabaseServer()
      .from('workspaces').select('nombre').eq('id', ws).maybeSingle();
    return { ws, nombre: (data as { nombre?: string } | null)?.nombre ?? `Workspace ${ws}` };
  } catch {
    return { ws, nombre: `Workspace ${ws}` };
  }
});

/**
 * ¿Este workspace puede TENER clientes propios? (mig 0176)
 *
 * ⚠️ ES OTRA PREGUNTA QUE `carteraDeAgencia`, y separarlas es lo que cierra el
 * huevo-y-gallina. Si «es agencia» se dedujera de «tiene alguna fila en la
 * cartera», para conseguir la primera fila habría que poder pedirla — o sea que
 * CUALQUIER admin de CUALQUIER workspace podría darse de alta clientes y crear
 * workspaces nuevos en la plataforma. No expondría datos (la 0175 sigue
 * exigiendo la firma del super-admin para mirar adentro), pero deja a un
 * inquilino creando objetos de plataforma, que es una puerta que nadie abrió.
 *
 * Fail-closed: si no se puede preguntar, no es agencia.
 */
/**
 * ¿Este workspace puede TENER clientes propios?
 *
 * ⚠️ LO CONTESTA EL PLAN, y eso es un cambio de ayer. Nació como una tabla propia
 * (`agencias`, mig 0176) con el argumento de que la capa dice «qué compró» y esto
 * dice «qué puede hacer con otros workspaces» — dos ejes. El dueño lo miró al día
 * siguiente y dijo lo contrario: «un cliente de Agencia NO es super admin y
 * tampoco Completo, es Agencia». O sea que para él ser agencia ES el plan, y
 * tenerlo en dos lugares era garantizar que un día digan cosas distintas.
 *
 * Lo que NO cambió, y es lo que la 0176 realmente vino a cerrar: esto sigue sin
 * derivarse de `agencia_clientes`. Deducir «es agencia el que tenga alguna fila»
 * deja un huevo-y-gallina con un solo lado abierto — para conseguir la primera
 * fila hay que poder pedirla, así que cualquier admin crearía inquilinos en la
 * plataforma. Acá lo decide el super admin poniendo el plan, que es un acto suyo.
 *
 * Fail-closed por partida doble: si no se puede leer, no es agencia; y si un valor
 * desconocido entrara a la columna, `capaDef` cae a 'completo', que tampoco lo es.
 */
export const esAgencia = cache(async (ws: number | null | undefined): Promise<boolean> => {
  if (!esWsValido(ws)) return false;
  try {
    const { data, error } = await getSupabaseServer()
      .from('workspaces').select('capa').eq('id', ws).maybeSingle();
    if (error) throw error;
    return (data as { capa?: string } | null)?.capa === 'agencia';
  } catch {
    return false;
  }
});

/**
 * Las agencias, para que la pantalla pueda marcarlas. Salen del PLAN: desde el
 * 27/09/2026 ser agencia es la capa, no una fila en una tabla aparte.
 */
export async function agenciasHabilitadas(): Promise<{ ws: number }[]> {
  try {
    const { data, error } = await getSupabaseServer()
      .from('workspaces').select('id').eq('capa', 'agencia').order('id');
    if (error) throw error;
    return ((data ?? []) as { id: number }[]).map((w) => ({ ws: w.id }));
  } catch {
    return [];
  }
}
