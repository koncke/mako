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
import { puedeEntrar, clientesAprobados, esCarteraVigente, esWsValido, type FilaCartera } from './agencia-cartera';

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

/**
 * TODAS las filas de todas las agencias.
 *
 * ⚠️ LA NECESITA LA GRILLA DE LA PLATAFORMA, y para una pregunta que no es de permisos:
 * «¿este workspace es cliente de una agencia?». Si lo es, no va como una tarjeta más de
 * MaKo — va adentro de la ficha de su agencia («los clientes de agencia deberían
 * aparecer dentro de la tab de EQUIPO de esa agencia como una card de cliente, no como
 * un cliente más de MaKo», 28/09/2026). Es una pregunta de PRESENTACIÓN, así que mira
 * los tres estados: uno pendiente o revocado sigue siendo de esa agencia, y sacarlo de
 * la grilla sin mostrarlo en ningún lado lo haría desaparecer.
 */
export async function todasLasCarteras(): Promise<FilaCarteraUI[]> {
  try {
    const { data, error } = await getSupabaseServer().from('agencia_clientes').select(COLS);
    if (error) throw error;
    return (data ?? []) as FilaCarteraUI[];
  } catch {
    // ⚠️ `[]` ACÁ ES EL DEFAULT SEGURO, y es el opuesto del de un permiso: si no se
    // pudo leer, NINGÚN workspace se esconde de la grilla. Esconder de más sería
    // perder clientes de la pantalla sin un error que lo diga.
    return [];
  }
}

/**
 * Las filas de cartera de un cliente, o **`null` si NO SE PUDO LEER**.
 *
 * ⚠️ ES LA MISMA CONSULTA QUE `agenciasDeCliente`, PARTIDA EN DOS, y lo que se
 * gana es la única cosa que esa no podía decir: la diferencia entre «este
 * cliente no tiene dueño» y «no pude preguntar». Las dos salían como `[]`, y un
 * `[]` que puede significar las dos cosas obliga a quien decide un permiso a
 * elegir una — siempre elige la cómoda, que es «no tiene dueño».
 *
 * `agenciasDeCliente` conserva su contrato (`[]` para dibujar) colgándose de
 * acá; `esClienteDeAgencia`, que sí decide, mira el `null`.
 */
async function leerCarteraDeCliente(clienteWs: number): Promise<FilaCarteraUI[] | null> {
  if (!esWsValido(clienteWs)) return null;
  try {
    const { data, error } = await getSupabaseServer()
      .from('agencia_clientes').select(COLS).eq('cliente_ws', clienteWs);
    if (error) throw error;
    return (data ?? []) as FilaCarteraUI[];
  } catch (e) {
    console.warn(`[agencia] no pude leer la cartera del cliente ${clienteWs}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * ¿De qué agencia es este workspace? Lo pregunta /admin sobre la fila de un cliente.
 *
 * ⚠️ `[]` TAMBIÉN CUANDO FALLA LA LECTURA, y acá está bien: es para DIBUJAR, y
 * una lista vacía se lee como «todavía no tiene». Para DECIDIR algo —un permiso,
 * una pantalla— está `esClienteDeAgencia`, que distingue el «no sé».
 */
export async function agenciasDeCliente(clienteWs: number): Promise<FilaCarteraUI[]> {
  return (await leerCarteraDeCliente(clienteWs)) ?? [];
}

/**
 * LAS AGENCIAS QUE LLEVAN HOY A ESTE CLIENTE: sólo las aprobadas, porque una pendiente todavía no entra a su cuenta y una revocada
 * ya no (31/10/2026, los avisos del ticket #37). ⚠️ TIRA SI NO SE PUDO LEER: acá `[]` manda el aviso al cliente, y «no sé» no puede
 * significar eso (por lo mismo que `esClienteDeAgencia`).
 */
export async function agenciasAprobadasDe(clienteWs: number): Promise<number[]> {
  const filas = await leerCarteraDeCliente(clienteWs);
  if (!filas) throw new Error(`no pude leer la cartera del cliente ${clienteWs}`);
  return filas.filter((f) => f.estado === 'aprobado').map((f) => Number(f.agencia_ws));
}

/**
 * ¿ES ESTE WORKSPACE CLIENTE DE ALGUNA AGENCIA? — sí / no / **no sé**.
 *
 * ⚠️ ES LA PREGUNTA QUE HAY QUE HACER PARA DECIDIR UNA PANTALLA O UN PERMISO, y
 * nació de un bug: las dos pantallas de Agency preguntaban con `agenciaDeCliente`
 * (P15, 30/10/2026). Ésa contesta **QUIÉN** es el dueño, y para eso necesita que
 * haya exactamente uno: con dos dueños aprobados devuelve `null` a propósito,
 * porque elegir el primero sería inventar un padre. Arriba, ese `null` se leía
 * como «no es cliente de ninguna agencia» y dejaba entrar al Agency Dashboard
 * justo al cliente que MÁS dueños tiene. La relación es N:N a propósito, así que
 * el caso no es imposible: es que todavía no pasó.
 *
 * Acá la pregunta es de SÍ/NO y no depende de que el dueño sea uno: alcanza con
 * que haya **alguno** vigente (`esCarteraVigente`: pendiente o aprobado; una
 * revocada ya no es dueña).
 *
 * ⚠️ Y EL TERCER VALOR NO ES UN LUJO. `null` es «no pude leer la cartera», que
 * NO es «no». Quien decide con esto tiene que tratar el `null` como el sí
 * —fail-closed, lo mismo que dice la cabecera de este módulo— y por eso se
 * compara contra `false` y no por verdad: `if (deAgencia !== false)`. Un
 * `if (deAgencia)` vuelve a leer el «no sé» como «no», que es el molde del bug
 * que esto vino a cerrar.
 *   · `true`  — tiene al menos un dueño vigente;
 *   · `false` — la cartera se leyó y no tiene ninguno;
 *   · `null`  — no se pudo leer (base caída, tabla sin migrar, ws inválido).
 *
 * ⚠️ **NO VUELVAS A COLAPSARLA EN UN `boolean`, Y ÉSTE ES EL AVISO QUE LO DICE.**
 * Nació dos veces, con dos criterios, y el 30/10/2026 al juntarlas una tenía el
 * `null` y la otra devolvía `boolean` con «no se pudo leer = no». El tipo
 * `boolean` es más cómodo en los cuatro `const deAgencia = await …` de abajo, y
 * es exactamente lo que hay que NO hacer: `false` en una puerta DEJA ENTRAR.
 * Si te tienta simplificar, lo que estás por borrar es la diferencia entre «no
 * tiene dueño» y «no pude preguntar».
 *
 * ⚠️ **EL `null` SE RESUELVE IGUAL EN LOS SEIS USOS —como «sí, puede ser de una
 * agencia»— Y LO QUE CAMBIA ES LA CONSECUENCIA, NO LA LECTURA.** Es el detalle
 * que hace que `!== false` sirva en todos y que igual haya que pensar cada caso:
 *
 * | Uso | Qué habilita | Con `null` |
 * |---|---|---|
 * | `app/agency/page.tsx` · `app/m/agency/page.tsx` | la puerta del Agency Dashboard | **no entra** |
 * | `app/m/partners/page.tsx` | la puerta de MaKo Partners | **no entra** |
 * | `app/configuraciones/plan/page.tsx` | «Pasar a Pro» en «Tu plan» | **no se ofrece** |
 * | `app/m/mas/page.tsx` | «Pasar a Pro» en el menú del teléfono | **no se ofrece** |
 * | `app/no-esta-en-tu-plan/page.tsx` | «Pasar a Pro» en el cartel del candado | **no se ofrece** |
 *
 * Las dos primeras filas son fail-closed de acceso; las tres últimas son la
 * regla de producto de Thiago (29/10/2026: «yo no me meto con ese cliente»): si
 * NO SABEMOS si tiene dueño, no le pisamos el cliente a una agencia. Ofrecer de
 * menos por una falla de la base cuesta una venta; ofrecer de más le rompe el
 * trato a la agencia, y eso no se deshace.
 *
 * ⚠️ Y NO NOMBRA A NADIE, a propósito: contesta sí/no/no sé y nunca de quién es.
 * Quién es el dueño lo contesta `agenciaDeCliente`, y sólo para DECIRLO.
 */
export const esClienteDeAgencia = cache(async (clienteWs: number | null | undefined): Promise<boolean | null> => {
  if (!esWsValido(clienteWs)) return null;
  const filas = await leerCarteraDeCliente(clienteWs);
  if (filas === null) return null;
  return filas.some(esCarteraVigente);
});

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
  // La cuenta de revisión de las tiendas no mira otro negocio, ni con una cookie de agencia válida (lib/cuenta-revision-reglas.ts):
  // su contraseña la tienen terceros, y su negocio se mide sin cartera antes de dar la sesión. Esto es la segunda capa.
  if (sesion.mfa === 'revision') return null;
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
 *
 * ⚠️ POR ESO MISMO **NO DECIDE UN PERMISO NI UNA PANTALLA**: su `null` significa
 * tres cosas a la vez —no tiene dueño, tiene DOS, o no se pudo leer— y las tres
 * se leen como «no es cliente de ninguna agencia». Eso fue un bug de verdad
 * (P15, 30/10/2026): las dos pantallas de Agency hacían `if (await
 * agenciaDeCliente(ws)) redirect(...)` y con dos dueños dejaban entrar al Agency
 * Dashboard al cliente que más dueños tenía. La pregunta de sí/no es
 * `esClienteDeAgencia` (arriba). Acá sólo se pregunta QUIÉN, para DECIRLO.
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
  // ⚠️ Pero una REVOCADA ya no es dueña (`esCarteraVigente`, 17/10/2026): con la del ws 3, «Salir» llevaba a la
  // cartera de Código Inmobiliario.
  const duenos = (await agenciasDeCliente(clienteWs)).filter(esCarteraVigente);
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
 *
 * ⚠️ 25/10/2026: VUELVEN LOS DOS EJES, y esta vez lo pidió el dueño. «Ser Agencia es
 * muy diferente a Partner... que te puedas sumar como "Agency", solo para los que
 * tengan su plan de 97 activo». La capa `agencia` es la del plan Pro (lo que compró);
 * sumarse es una fila en `agencias` (la 0176, que ya existía y tenía al ws 13). Con
 * sólo la capa, todo el que compraba Pro quedaba agencia sin pedirlo. Las dos, o no:
 * quien baja de plan deja de abrir cuentas aunque su fila siga, y quien tiene la fila
 * sin el plan no la usa. Medido en producción ese día: el único con la capa es el
 * ws 13, y tiene su fila; nadie pierde nada.
 */
export const esAgencia = cache(async (ws: number | null | undefined): Promise<boolean> => {
  if (!esWsValido(ws)) return false;
  try {
    const db = getSupabaseServer();
    const [w, a] = await Promise.all([
      db.from('workspaces').select('capa').eq('id', ws).maybeSingle(),
      db.from('agencias').select('ws').eq('ws', ws).maybeSingle(),
    ]);
    if (w.error) throw w.error;
    if (a.error) throw a.error;
    return (w.data as { capa?: string } | null)?.capa === 'agencia' && a.data != null;
  } catch {
    return false;
  }
});

/**
 * ¿Se sumó como Agency? Sólo la fila (sin mirar el plan): lo que distingue «nunca se sumó» de «se sumó y su plan ya no
 * lo deja». Para PERMISOS se pregunta `esAgencia`. `null` = no se pudo leer (no es «no»).
 */
export async function seSumoComoAgency(ws: number): Promise<{ desde: string } | false | null> {
  if (!esWsValido(ws)) return false;
  try {
    const { data, error } = await getSupabaseServer().from('agencias').select('habilitada_at').eq('ws', ws).maybeSingle();
    if (error) throw error;
    return data ? { desde: String((data as { habilitada_at: string }).habilitada_at) } : false;
  } catch {
    return null;
  }
}

/**
 * Sumarse como Agency: la fila en `agencias`, firmada por quien apretó el botón. Idempotente (`on conflict do nothing`):
 * dos clics o dos pestañas no hacen dos. El plan lo pregunta quien llama (lib/agency.ts), antes.
 */
export async function anotarAgency(ws: number, quien: string | null, nota: string): Promise<void> {
  if (!esWsValido(ws)) throw new Error('Ese negocio no existe.');
  const { error } = await getSupabaseServer().from('agencias')
    .upsert({ ws, habilitada_por: quien, nota: nota.slice(0, 300) }, { onConflict: 'ws', ignoreDuplicates: true });
  if (error) throw new Error(`No pude sumarte como Agency: ${error.message}`);
}

/**
 * Las agencias, para que la pantalla pueda marcarlas: las que tienen el plan Pro Y se sumaron (lo mismo que
 * `esAgencia`, en lote).
 */
export async function agenciasHabilitadas(): Promise<{ ws: number }[]> {
  try {
    const db = getSupabaseServer();
    const [w, a] = await Promise.all([
      db.from('workspaces').select('id').eq('capa', 'agencia').order('id'),
      db.from('agencias').select('ws'),
    ]);
    if (w.error) throw w.error;
    if (a.error) throw a.error;
    const sumadas = new Set(((a.data ?? []) as { ws: number }[]).map((f) => Number(f.ws)));
    return ((w.data ?? []) as { id: number }[]).filter((x) => sumadas.has(Number(x.id))).map((x) => ({ ws: x.id }));
  } catch {
    return [];
  }
}

// =============================================================================
// Las ALTAS que una agencia pide (mig 0178)
// =============================================================================
// «En super admin, me tienen que aparecer las notificaciones de cuando una agencia
// intenta agregar a un nuevo usuario, para poder aceptarlo o rechazarlo»
// (27/09/2026). El juicio y el saneo viven en `lib/agencia-altas.ts`, sin
// `server-only`; acá está la base, con el mismo criterio que la cartera de arriba:
// una lectura que falla devuelve `[]` para que la pantalla siga viva, y toda
// escritura vuelve a preguntar el permiso.

/** Una fila de `agencia_altas` como la dibujan las dos pantallas. */
export type FilaAlta = {
  id: number;
  agencia_ws: number;
  cliente_ws: number;
  email: string;
  nombre: string;
  rol_ws: string;
  estado: string;
  pedido_por: string | null;
  decidido_por: string | null;
  decidido_at: string | null;
  motivo: string | null;
  usuario_id: number | null;
  created_at: string;
};

const COLS_ALTA =
  'id, agencia_ws, cliente_ws, email, nombre, rol_ws, estado, pedido_por, decidido_por, decidido_at, motivo, usuario_id, created_at';

/** Todo lo que espera la firma del super admin, de todas las agencias. */
export async function altasPendientes(): Promise<FilaAlta[]> {
  try {
    const { data, error } = await getSupabaseServer()
      .from('agencia_altas').select(COLS_ALTA).eq('estado', 'pendiente').order('created_at');
    if (error) throw error;
    return (data ?? []) as FilaAlta[];
  } catch {
    return [];
  }
}

/** Lo que ESTA agencia pidió, en los tres estados. Es lo que dibuja la ficha del cliente. */
export async function altasDeAgencia(agenciaWs: number): Promise<FilaAlta[]> {
  if (!esWsValido(agenciaWs)) return [];
  try {
    const { data, error } = await getSupabaseServer()
      .from('agencia_altas').select(COLS_ALTA).eq('agencia_ws', agenciaWs).order('created_at');
    if (error) throw error;
    return (data ?? []) as FilaAlta[];
  } catch {
    return [];
  }
}

/**
 * Deja un pedido. Devuelve la fila, o el motivo por el que no se pudo.
 *
 * ⚠️ NO CHEQUEA EL PERMISO: eso lo hace `puedeEntrarAhora` en la ruta, contra la base
 * y en el mismo request. Acá llega ya sanado (`sanearPedido`) y ya autorizado.
 *
 * ⚠️ Y EL DUPLICADO LO ATAJA LA BASE, no un SELECT previo. El índice parcial único de
 * la 0178 (`cliente_ws` + email en minúsculas, sólo sobre 'pendiente') es lo único
 * que sobrevive a dos pestañas y a un doble click: un «¿ya existe?» seguido de un
 * insert es la carrera de siempre. El 23505 se traduce a una frase en vez de a un 500.
 */
export async function pedirAlta(p: {
  agenciaWs: number; clienteWs: number; email: string; nombre: string; rolWs: string; pedidoPor: string | null;
}): Promise<{ ok: true; fila: FilaAlta } | { ok: false; error: string }> {
  const { data, error } = await getSupabaseServer()
    .from('agencia_altas')
    .insert({
      agencia_ws: p.agenciaWs, cliente_ws: p.clienteWs,
      email: p.email, nombre: p.nombre, rol_ws: p.rolWs, pedido_por: p.pedidoPor,
    })
    .select(COLS_ALTA).single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya pediste sumar a esa persona: está esperando aprobación.' };
    return { ok: false, error: error.message };
  }
  return { ok: true, fila: data as FilaAlta };
}

/**
 * Firma un pedido: lo reclama y devuelve la fila.
 *
 * ⚠️ RECLAMA ANTES DE QUE NADIE ACTÚE (`.eq('estado','pendiente')`), que es la misma
 * regla que `reclamarPendiente` de la API de MaKo. Sin eso, dos pestañas del super
 * admin —o un doble click— aprobarían el mismo pedido dos veces, y aprobar significa
 * CREAR UNA CUENTA y mandar un mail: la segunda vez rebota contra el único de
 * `usuarios.email` con un error que no dice nada. Sin fila devuelta, alguien llegó
 * primero y el llamador NO tiene que crear nada.
 */
export async function reclamarAlta(
  id: number,
  estado: 'aprobada' | 'rechazada',
  decididoPor: string,
  motivo?: string,
): Promise<FilaAlta | null> {
  const { data, error } = await getSupabaseServer()
    .from('agencia_altas')
    .update({
      estado, decidido_por: decididoPor, decidido_at: new Date().toISOString(),
      motivo: motivo?.trim().slice(0, 300) || null,
    })
    .eq('id', id).eq('estado', 'pendiente')
    .select(COLS_ALTA).maybeSingle();
  if (error) throw new Error(`agencia_altas: ${error.message}`);
  return (data as FilaAlta | null) ?? null;
}

/** Anota en qué terminó un alta aprobada. Falla en silencio: la cuenta YA se creó,
 *  y tirar acá dejaría al super admin pensando que el alta no salió. */
export async function anotarUsuarioDeAlta(id: number, usuarioId: number): Promise<void> {
  try {
    await getSupabaseServer().from('agencia_altas').update({ usuario_id: usuarioId }).eq('id', id);
  } catch { /* el rastro es lo que se pierde, no el alta */ }
}
