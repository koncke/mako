// =============================================================================
// funnels — N funnels por workspace (mig 0170, la 0126 de docs/modelo-oferta-producto-funnel.md)
// =============================================================================
// Reemplaza al bloque de funnel_config que vivía en lib/leads.ts. La tabla vieja
// queda de respaldo, SIN LECTORES: si algo vuelve a leerla, se está leyendo una
// copia que ya nadie escribe.
//
// Por qué hay dos lectores y no uno solo con un parámetro opcional:
//
//   getFunnelDefault()   → el funnel DEL NEGOCIO. Catálogos, prompts, el editor
//                          de /funnel, las columnas del board. Pregunta «¿cómo
//                          vende este cliente?».
//   getFunnelDeLead(l)   → el funnel POR EL QUE ENTRÓ ESE LEAD. Requisitos de
//                          etapa, validación de un movimiento, la ficha.
//                          Pregunta «¿qué recorrido le toca a ÉL?».
//
// Con un solo funnel por workspace las dos devuelven lo mismo, y por eso el
// rename (`getFunnel` → `getFunnelDefault`) se hizo rompiendo la compilación: la
// decisión hay que tomarla UNA vez, con el compilador mostrando los 33 call-sites,
// y no el día que aparezca el segundo funnel — ese día nadie los vuelve a mirar.
//
// ⚠️ NUNCA `.maybeSingle()` acá. Con N filas devuelve PGRST116 y el catch lo
// convierte en DEFAULT_PIPELINE sin un solo log: el board entero pintaría
// columnas genéricas y nadie se enteraría. Es el mismo bug que rompió el webhook
// de Calendly. Siempre `.order().limit(1)` explícito, y el catch LOGUEA.
// =============================================================================

import 'server-only';
import type { Stage, FunnelTransition } from './pipeline';
import { DEFAULT_PIPELINE, mergeFunnelData, suppressedInicial } from './pipeline';
import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import { casaParaEscribir } from './lead-funnel-reglas';
// El mapeo fila → FunnelConfig vive en un módulo PURO para que se pueda testear
// sin Supabase: ahí está la regla de que `origen` sale de `declarado`.
import { buildFunnel, filaAFunnel, COLS, FUNNEL_DEFAULT_NOMBRE, type FilaFunnel, type FunnelConfig, type FunnelResumen } from './funnel-fila';
export { FUNNEL_DEFAULT_NOMBRE };
export type { FunnelConfig, FunnelResumen };
export type { EventoFunnel } from './pipeline';

async function filaDefault(): Promise<FilaFunnel | null | undefined> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase
    .from('funnels').select(COLS)
    .order('es_default', { ascending: false }).order('orden', { ascending: true }).order('id')
    .limit(1);
  if (error) {
    console.error(`[funnels] no se pudo leer el funnel del workspace: ${error.message}`);
    return undefined;   // undefined = falló la lectura; null = no hay fila. No es lo mismo.
  }
  return ((data ?? []) as unknown as FilaFunnel[])[0] ?? null;
}

/**
 * El id del producto del NEGOCIO (el funnel `es_default`). `null` si no hay fila o falló.
 *
 * Lo necesita el modelo de varios productos (mig 0207): en `leads.funnel_id` ese producto se
 * escribe NULL, pero en `lead_funnel` va con su id, y los dos lados se traducen con
 * `casaParaEscribir` / `casaReal` (lib/lead-funnel-reglas.ts).
 */
export async function idDelFunnelDefault(): Promise<number | null> {
  const fila = await filaDefault();
  return fila ? Number(fila.id) : null;
}

export async function getFunnelDefault(): Promise<FunnelConfig> {
  try {
    const fila = await filaDefault();
    if (fila === undefined) return buildFunnel(DEFAULT_PIPELINE, [], { origen: 'error' });
    if (fila === null) return buildFunnel(DEFAULT_PIPELINE, [], { origen: 'sin-fila' });
    return filaAFunnel(fila);
  } catch (e) {
    console.error(`[funnels] getFunnelDefault: ${e instanceof Error ? e.message : String(e)}`);
    return buildFunnel(DEFAULT_PIPELINE, [], { origen: 'error' });
  }
}

/**
 * Los umbrales del CRM automático, si el cliente los ajustó (`data.umbrales`).
 *
 * Tiene función propia porque no entra en `FunnelConfig`: ese tipo es lo que la
 * PANTALLA necesita del funnel, y esto es una política de tiempos que lee un solo
 * módulo (lib/crm-auto.ts). Sacarlo por acá evita que crm-auto vuelva a abrir la
 * tabla por su cuenta — que es como `funnel_config` terminó con tres lectores
 * sueltos y un merge que le borraba esta misma clave.
 */
export async function umbralesDelFunnelDefault(): Promise<Record<string, unknown> | null> {
  try {
    const fila = await filaDefault();
    if (!fila) return null;
    const cfg = (fila.data && typeof fila.data === 'object' ? fila.data : {}) as Record<string, unknown>;
    const u = cfg.umbrales;
    return u && typeof u === 'object' && !Array.isArray(u) ? (u as Record<string, unknown>) : null;
  } catch (e) {
    console.error(`[funnels] umbralesDelFunnelDefault: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * Los umbrales de UN embudo (`data.umbrales`), o los del embudo del negocio sin `funnelId`.
 * `{}` = no declaró ninguno; null = no se pudo leer (y entonces nadie escribe encima).
 *
 * Lo leen el pop-up de etapas (el plazo de cada etapa, #800) y la operación que lo guarda,
 * que tiene que conservar las otras claves de `umbrales` — las cuatro perillas del CRM
 * automático viven en el mismo objeto.
 */
export async function umbralesDe(funnelId?: number | null): Promise<Record<string, unknown> | null> {
  try {
    let fila: { data?: unknown } | null | undefined;
    if (funnelId != null) {
      const { data, error } = await (await getTenantDb()).from('funnels').select('data').eq('id', funnelId).limit(1);
      if (error) { console.error(`[funnels] umbralesDe(${funnelId}): ${error.message}`); return null; }
      fila = ((data ?? []) as Array<{ data?: unknown }>)[0] ?? null;
    } else {
      fila = await filaDefault();
      if (fila === undefined) return null;
    }
    if (!fila) return {};
    const cfg = (fila.data && typeof fila.data === 'object' ? fila.data : {}) as Record<string, unknown>;
    const u = cfg.umbrales;
    return u && typeof u === 'object' && !Array.isArray(u) ? { ...(u as Record<string, unknown>) } : {};
  } catch (e) {
    console.error(`[funnels] umbralesDe: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * Cada embudo VIVO del workspace con su config y sus umbrales crudos. null = no se pudo leer.
 *
 * Lo usa el aviso del lead quieto (lib/lead-quieto-aviso.ts), que necesita, por embudo, qué
 * etapas tiene (para descartar plazos de etapas borradas), cómo se llaman (para el mensaje) y
 * qué plazo le puso el dueño a cada una.
 */
export async function funnelsConUmbrales(): Promise<Array<{
  id: number; esDefault: boolean; cfg: FunnelConfig; umbrales: Record<string, unknown> | null;
}> | null> {
  try {
    const { data, error } = await (await getTenantDb())
      .from('funnels').select(COLS).eq('activo', true).order('id');
    if (error) { console.error(`[funnels] funnelsConUmbrales: ${error.message}`); return null; }
    return ((data ?? []) as unknown as FilaFunnel[]).map((f) => {
      const d = (f.data && typeof f.data === 'object' ? f.data : {}) as Record<string, unknown>;
      const u = d.umbrales;
      return {
        id: Number(f.id), esDefault: f.es_default === true, cfg: filaAFunnel(f),
        umbrales: u && typeof u === 'object' && !Array.isArray(u) ? (u as Record<string, unknown>) : null,
      };
    });
  } catch (e) {
    console.error(`[funnels] funnelsConUmbrales: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Un funnel concreto del workspace actual (el `.eq('workspace_id')` lo pone getTenantDb). */
export async function getFunnelDe(funnelId: number): Promise<FunnelConfig> {
  try {
    const supabase = await getTenantDb();
    const { data, error } = await supabase.from('funnels').select(COLS).eq('id', funnelId).limit(1);
    if (error) {
      console.error(`[funnels] getFunnelDe(${funnelId}): ${error.message}`);
      return buildFunnel(DEFAULT_PIPELINE, [], { origen: 'error' });
    }
    const fila = ((data ?? []) as unknown as FilaFunnel[])[0];
    if (!fila) return buildFunnel(DEFAULT_PIPELINE, [], { origen: 'sin-fila' });
    return filaAFunnel(fila);
  } catch (e) {
    console.error(`[funnels] getFunnelDe(${funnelId}): ${e instanceof Error ? e.message : String(e)}`);
    return buildFunnel(DEFAULT_PIPELINE, [], { origen: 'error' });
  }
}

/** Lo mínimo que hace falta de un lead para saber qué funnel le toca. */
export type LeadConFunnel = { id: number };

/**
 * El funnel POR EL QUE ENTRÓ ESE LEAD — el que decide sus requisitos de etapa.
 *
 * ⚠️ HOY DEVUELVE EL DEFAULT, y eso es correcto: en F1 cada workspace tiene
 * exactamente un funnel, así que el del lead ES el del negocio. Lo que aporta
 * esta función hoy es la MARCA: cada call-site ya declaró cuál de las dos
 * preguntas hace, y el día que exista `lead_participaciones` (F3, la 0128 del
 * doc) cambia el CUERPO de acá y ni un call-site más. Sin la marca, ese día hay
 * que volver a auditar 33 lugares a mano.
 */
export async function getFunnelDeLead(_lead: LeadConFunnel): Promise<FunnelConfig> {
  return getFunnelDefault();
}

/** Etapas del pipeline del NEGOCIO — las consume el Kanban del CRM. */
export async function getPipelineStagesDefault(): Promise<Stage[]> {
  return (await getFunnelDefault()).stages;
}

/** Transiciones del funnel del NEGOCIO — alimentan "Datos sin marcar". */
export async function getFunnelTransitionsDefault(): Promise<FunnelTransition[]> {
  return (await getFunnelDefault()).transitions;
}

/** Etapas del funnel DE ESE LEAD — las que deciden sus requisitos. */
export async function getPipelineStagesDeLead(lead: LeadConFunnel): Promise<Stage[]> {
  return (await getFunnelDeLead(lead)).stages;
}

/**
 * El nombre del PRODUCTO principal de cada embudo — el único que la persona reconoce.
 *
 * ⚠️ VIVE ACÁ Y NO EN CADA LECTOR. «Funnel principal» es el nombre que puso la migración
 * 0170 y es el MISMO en todos los workspaces: no le dice nada a nadie y encima obliga a
 * pensar en la estructura en vez de en lo que se vende. El desplegable ya lo tapaba; el
 * pop-up que edita el embudo NO, así que Martín abría «Negocio que Escala» y el título
 * del pop-up decía «Funnel principal» (30/09/2026). Dos lectores del mismo dato con dos
 * respuestas distintas es el modo de falla de siempre — y acá es peor que cosmético: ese
 * título es un INPUT, o sea que quien renombra arranca desde el valor equivocado.
 *
 * Nunca tira: si la vista falla, el mapa vuelve vacío y quien llama se cae al nombre del
 * funnel, que es lo que había.
 */
/**
 * El PRODUCTO principal de cada embudo: su id y su nombre.
 *
 * ⚠️ EL ID HACE FALTA Y NO ES EL DEL EMBUDO. Lo necesita todo lo que cuelga del
 * producto y no del embudo —la ENTREGA del servicio (mig 0188/0189) es el primer
 * caso—, y del producto al embudo hay dos saltos (`producto ──oferta_productos──>
 * oferta ──funnel_ofertas──> funnel`): usar uno por el otro es un número correcto
 * sobre la pregunta equivocada.
 */
export async function productoDeFunnel(ids?: number[]): Promise<Map<number, { id: number; nombre: string }>> {
  const productos = new Map<number, { id: number; nombre: string }>();
  try {
    const supabase = await getTenantDb();
    let q = supabase
      .from('v_funnel_productos').select('funnel_id, producto_id').eq('es_principal', true);
    if (ids?.length) q = q.in('funnel_id', ids);
    const { data: vp } = await q;
    const pids = [...new Set(((vp ?? []) as Array<{ producto_id: number }>).map((x) => x.producto_id))];
    if (pids.length) {
      const { data: ps } = await supabase.from('productos').select('id, nombre').in('id', pids);
      const nombreDe = new Map(((ps ?? []) as Array<{ id: number; nombre: string }>).map((p) => [p.id, p.nombre]));
      for (const x of (vp ?? []) as Array<{ funnel_id: number; producto_id: number }>) {
        const n = nombreDe.get(x.producto_id);
        if (n) productos.set(x.funnel_id, { id: Number(x.producto_id), nombre: n });
      }
    }
  } catch (e) {
    console.warn('[funnels] no se pudo leer el producto de cada funnel:', e instanceof Error ? e.message : e);
  }
  return productos;
}

/** Sólo el NOMBRE, que es lo único que mira el desplegable del tablero. */
export async function productosPorFunnel(ids?: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (const [funnelId, p] of await productoDeFunnel(ids)) out.set(funnelId, p.nombre);
  return out;
}

/** Los funnels del workspace, para el desplegable. El default primero. Nunca tira: si falla, `[]`. */
export async function listarFunnels(): Promise<FunnelResumen[]> {
  return (await leerFunnels()) ?? [];
}

/**
 * Lo mismo que `listarFunnels`, pero con la lectura FALLIDA como `null`.
 *
 * ⚠️ «NO PUDE LEER» NO ES «NO HAY» NI «HAY UNO». `listarFunnels` devuelve `[]` ante un error,
 * y para una pantalla que pregunta el producto sólo con dos o más, `[]` se lee como «hay uno»:
 * el alta desde WhatsApp volvía a crear en el principal sin preguntar —el bug que reportó
 * Leila el 08/10/2026— justo el día que la base tosiera. Y del lado del server, validar un id
 * contra `[]` contesta «Ese producto no existe.» sobre un id válido. Quien tenga que distinguir
 * los dos casos usa ésta (`destinoDelAlta` en lib/lead-funnel-reglas.ts, /whatsapp).
 *
 * El nombre del producto (`productosPorFunnel`) sigue sin tirar: si ESA lectura falla, cada
 * embudo sale con su nombre propio, que es un rótulo peor pero no un dato falso.
 */
export async function leerFunnels(): Promise<FunnelResumen[] | null> {
  try {
    const supabase = await getTenantDb();
    const { data, error } = await supabase
      .from('funnels').select('id, nombre, canal, es_default, declarado, activo')
      .eq('activo', true)
      .order('es_default', { ascending: false }).order('orden', { ascending: true }).order('id');
    if (error) { console.error(`[funnels] listarFunnels: ${error.message}`); return null; }
    const filas = (data ?? []) as unknown as FilaFunnel[];

    const productos = await productosPorFunnel();


    return filas.map((f) => ({
      id: f.id, nombre: f.nombre ?? FUNNEL_DEFAULT_NOMBRE, canal: f.canal ?? null,
      esDefault: f.es_default === true, declarado: f.declarado === true,
      producto: productos.get(f.id) ?? null,
    }));
  } catch (e) {
    console.error(`[funnels] listarFunnels: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * Guarda un funnel concreto.
 *
 * ⚠️ MERGE, no reemplazo. Antes escribía `data: { pipeline, suppressed }` y con eso
 * BORRABA cualquier otra clave del jsonb — y el editor de /funnel autoguarda con un
 * debounce de 500 ms en cada tecla, así que alcanzaba con que alguien tocara una
 * etiqueta. `data.umbrales`, que `lib/crm-auto.ts` sí lee para los tiempos del CRM
 * automático, se borraba solo. Hoy ninguna fila lo tiene escrito (verificado en prod
 * el 26/09: de las 6 filas heredadas de funnel_config, cinco tienen exactamente
 * `pipeline` y `suppressed`, y ws11 además `entradas` y `evento`), o sea que era un
 * lector sin escritor y el daño no había ocurrido todavía. Con `entradas` y `evento`
 * viviendo acá, dejaba de ser latente el primer día.
 *
 * Guardar ES declarar: la fila queda con `declarado = true`, que es lo que hace que
 * `origen` pase a 'declarado' y los prompts puedan afirmar el funnel.
 */
export async function saveFunnelDe(
  funnelId: number,
  pipeline: Stage[],
  suppressed: string[],
  extra?: Record<string, unknown>,
): Promise<void> {
  const supabase = await getTenantDb();
  // El previo se lee para el MERGE. Sin maybeSingle: con `.limit(1)` una fila de
  // más no rompe el guardado, solo mergea contra la primera.
  const { data: actual } = await supabase.from('funnels').select('data').eq('id', funnelId).limit(1);
  const previo = ((actual ?? []) as Array<{ data: unknown }>)[0]?.data ?? {};
  const { data: tocadas, error } = await supabase
    .from('funnels')
    .update({
      data: mergeFunnelData(previo, pipeline, suppressed, extra),
      declarado: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', funnelId)
    .select('id');
  if (error) throw new Error(`Error guardando el funnel: ${error.message}`);
  // Un UPDATE que no tocó nada devuelve ok y cero filas: sin este guard, el
  // editor diría «guardado» sobre un funnel de otro workspace o ya borrado.
  if (!((tocadas ?? []) as unknown[]).length) throw new Error(`Error guardando el funnel: no existe el funnel #${funnelId} en este workspace.`);
}

/**
 * Guarda el funnel del NEGOCIO. Si el workspace todavía no tiene ninguno, lo crea.
 *
 * Ese autoparche no es defensivo porque sí: la 0170 le dio un funnel a los 9
 * workspaces que existían el día de la migración, pero un workspace creado DESPUÉS
 * por otro camino que no sea `crearWorkspace` no tendría fila, y antes —con el
 * upsert de `funnel_config`— la primera escritura la creaba sola. Sin esto, el paso
 * «funnel por plantilla» del onboarding fallaría en silencio en ese cliente.
 */
export async function saveFunnelDefault(
  pipeline: Stage[],
  suppressed: string[],
  extra?: Record<string, unknown>,
): Promise<void> {
  const actual = await getFunnelDefault();
  if (actual.origen === 'error') throw new Error('No se pudo leer el funnel actual; no se guardó nada para no pisarlo.');
  if (actual.id == null) {
    await crearFunnel({ nombre: FUNNEL_DEFAULT_NOMBRE, pipeline, suppressed, extra, esDefault: true });
    return;
  }
  await saveFunnelDe(actual.id, pipeline, suppressed, extra);
}

/**
 * Renombra un embudo — y lo que se renombra puede NO SER el embudo.
 *
 * ⚠️ LA PANTALLA MUESTRA EL NOMBRE DEL PRODUCTO, no el del funnel. Todos los funnels de
 * todos los workspaces se llaman «Funnel principal» porque lo puso la migración 0170, y
 * `listarFunnels` lo tapa con el nombre del producto principal (vista `v_funnel_productos`).
 * O sea que escribir `funnels.nombre` y refrescar deja la pantalla EXACTAMENTE IGUAL: un
 * guardado que funciona, no da error, y no se ve. Es el modo de falla que ya se reportó
 * tres veces en esta tab con otro nombre.
 *
 * Así que se escribe donde se LEE: si el funnel tiene producto principal, se renombra el
 * producto; si no, el funnel.
 *
 * ⚠️ Y el índice `funnels_nombre_uk` es único por workspace sobre `lower(btrim(nombre))`:
 * dos embudos no pueden llamarse igual ni cambiando mayúsculas. El choque se traduce a
 * una frase, porque el error crudo de Postgres no le dice nada a nadie.
 */
export async function renombrarFunnel(funnelId: number, nombreCrudo: string): Promise<{ donde: 'producto' | 'funnel' }> {
  const nombre = nombreCrudo.trim().replace(/\s+/g, ' ');
  if (!nombre) throw new Error('El funnel necesita un nombre.');
  if (nombre.length > 60) throw new Error('El nombre no puede pasar de 60 caracteres.');
  const supabase = await getTenantDb();

  // ¿Tiene producto principal? Ahí es donde hay que escribir.
  let productoId: number | null = null;
  try {
    const { data } = await supabase
      .from('v_funnel_productos').select('producto_id').eq('funnel_id', funnelId).eq('es_principal', true).limit(1);
    productoId = ((data ?? []) as Array<{ producto_id: number }>)[0]?.producto_id ?? null;
  } catch {
    // La vista puede fallar sin que el renombre deje de tener sentido: se cae al funnel.
    productoId = null;
  }

  if (productoId != null) {
    const { data: tocadas, error } = await supabase.from('productos').update({ nombre }).eq('id', productoId).select('id');
    if (error) throw new Error(traducirChoque(error.message, nombre));
    if (!((tocadas ?? []) as unknown[]).length) throw new Error('No se pudo renombrar: ese funnel no es de este workspace.');
    return { donde: 'producto' };
  }

  const { data: tocadas, error } = await supabase
    .from('funnels').update({ nombre, updated_at: new Date().toISOString() }).eq('id', funnelId).select('id');
  if (error) throw new Error(traducirChoque(error.message, nombre));
  if (!((tocadas ?? []) as unknown[]).length) throw new Error('No se pudo renombrar: ese funnel no es de este workspace.');
  return { donde: 'funnel' };
}

/** El choque del índice único, dicho en una frase que se entiende. */
function traducirChoque(msg: string, nombre: string): string {
  if (/duplicate key|unique constraint|23505/i.test(msg)) return `Ya tienes un funnel que se llama «${nombre}».`;
  return `No se pudo renombrar: ${msg}`;
}

/**
 * ARCHIVA un embudo: `activo = false`. No borra NADA.
 *
 * ⚠️ ES UN ARCHIVADO Y NO UN BORRADO, y es lo que pidió Martín: «siempre guardando una
 * copia de seguridad en caso de eliminar un funnel con leads, por si el usuario lo quiere
 * recuperar». La copia de seguridad NO hace falta inventarla — la columna `activo` existe
 * desde la 0170 y `listarFunnels` ya filtra por ella. Archivar saca el embudo de la
 * pantalla y deja la fila, su `data` (el pipeline entero, las entradas, las nutriciones
 * suprimidas) y sus leads intactos. Restaurar es poner el booleano de vuelta.
 *
 * Una copia aparte sería peor: un segundo lugar con los mismos datos, que se queda viejo.
 *
 * ⚠️ EL DEFAULT NO SE ARCHIVA, y el guard va en POSITIVO. El índice parcial
 * `funnels_ws_default_uk` garantiza que un workspace tiene EXACTAMENTE UNO, y medio repo
 * asume que existe: `getFunnelDefault`, el CRM sin `?funnel=`, el onboarding, los prompts.
 * Archivarlo no daría error — daría un workspace cuyo embudo por defecto no se puede leer.
 */
export async function archivarFunnel(funnelId: number): Promise<void> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('funnels').select('id, es_default, activo').eq('id', funnelId).limit(1);
  if (error) throw new Error(`No se pudo leer el funnel: ${error.message}`);
  const fila = ((data ?? []) as Array<{ id: number; es_default: boolean; activo: boolean }>)[0];
  if (!fila) throw new Error('Ese funnel no es de este workspace.');
  if (fila.es_default) throw new Error('Este es tu funnel principal: no se puede eliminar. Puedes cambiarle el nombre.');
  const { data: tocadas, error: e2 } = await supabase
    .from('funnels').update({ activo: false, updated_at: new Date().toISOString() }).eq('id', funnelId).select('id');
  if (e2) throw new Error(`No se pudo archivar el funnel: ${e2.message}`);
  if (!((tocadas ?? []) as unknown[]).length) throw new Error('Ese funnel no es de este workspace.');
}

/**
 * Borra un embudo archivado PARA SIEMPRE, y antes pone a salvo a su gente.
 *
 * ⚠️ EL RESCATE NO ES CORTESÍA: SIN ÉL LOS LEADS DESAPARECEN DE TODOS LOS TABLEROS.
 * `leads.funnel_id` NO tiene foreign key (mig 0181, a propósito), así que borrar la fila
 * de `funnels` no toca a los leads: se quedan con un id que ya no resuelve a nada, y
 * `listLeadsDeFunnel` los busca por igualdad exacta. No falla, no avisa y no borra una
 * fila — simplemente no aparecen en ninguna pantalla, para siempre. Las personas no son
 * configuración: vuelven al embudo del negocio.
 *
 * ⚠️ Y VUELVEN CON `funnel_id = NULL`, NO CON EL ID DEL NEGOCIO. El tablero del negocio pide
 * sus leads con `.is('funnel_id', null)`: hasta el 06/10/2026 el rescate escribía el id del
 * default y los rescatados no aparecían en NINGÚN tablero — el mismo agujero que el rescate
 * venía a cerrar, por la otra puerta. Toda escritura de la casa pasa por `casaParaEscribir`
 * (lib/lead-funnel-reglas.ts).
 *
 * ⚠️ Y LOS OTROS PRODUCTOS DEL LEAD (mig 0207). Las filas de `lead_funnel` de ESTE embudo se
 * van solas (`on delete cascade`). Lo que no se va solo es la fila que un rescatado tuviera
 * en el producto del negocio: al volver, ése pasa a ser su casa, y nunca hay fila para la
 * casa. Su etapa de esa fila pasa a ser la del lead —estaba en esa columna del tablero del
 * negocio y ahí se queda; con la etapa del embudo borrado caería a «fuera del embudo»— y la
 * fila se borra. Es lo mismo que hace `quitarDeProducto` al promover una fila a casa.
 *
 * ⚠️ Y ESTO SÍ BORRA, EN CASCADA, lo que era del embudo: sus secuencias de nutrición y su
 * ligazón con las ofertas (las dos FKs son `on delete cascade`). Eso está bien —son
 * configuración de un producto que deja de existir— y es lo que hace que esta función sea
 * irreversible de verdad, a diferencia de `archivarFunnel`.
 *
 * Devuelve cuántos leads rescató, para que la pantalla pueda decirlo. Un «listo» pelado
 * sobre 300 personas que cambiaron de tablero es lo que se descubre al día siguiente.
 */
export async function eliminarFunnelDefinitivo(funnelId: number): Promise<{ rescatados: number }> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('funnels').select('id, es_default, activo').eq('id', funnelId).limit(1);
  if (error) throw new Error(`No se pudo leer el funnel: ${error.message}`);
  const fila = ((data ?? []) as Array<{ id: number; es_default: boolean; activo: boolean }>)[0];
  if (!fila) throw new Error('Ese funnel no es de este workspace.');
  if (fila.es_default) throw new Error('Este es tu funnel principal: no se puede eliminar.');
  // ⚠️ SÓLO SE BORRA LO QUE YA ESTÁ ARCHIVADO. Es el guard en positivo que hace que
  // eliminar de verdad exija DOS decisiones en dos momentos: nada se pierde de un clic.
  if (fila.activo) throw new Error('Primero hay que eliminarlo del tablero; recién después se puede borrar para siempre.');

  // El embudo del negocio, que es a donde vuelve su gente. Su id hace falta para las filas
  // de `lead_funnel`; en `leads.funnel_id` se escribe NULL (`casaParaEscribir` del default
  // contra sí mismo es null siempre, a propósito: que se lea por qué).
  const { data: defs } = await supabase
    .from('funnels').select('id').eq('es_default', true).eq('activo', true).limit(1);
  const crudo = ((defs ?? []) as Array<{ id: number | string }>)[0]?.id;
  const idNegocio = crudo == null ? null : Number(crudo);
  const destino = casaParaEscribir(idNegocio, idNegocio);

  // Los que vuelven y YA estaban también en el producto del negocio, con su etapa de ahí.
  // Se lee ANTES de tocar nada: si esto falla, no se escribió una sola fila.
  const etapaEnNegocio = new Map<number, string>();
  if (idNegocio != null) {
    const suyos = await leerTodo<{ id: number | string }>(supabase, 'leads', 'id', {
      orden: 'id', filtros: (q) => q.eq('funnel_id', funnelId),
    });
    const ids = suyos.map((l) => Number(l.id));
    for (let i = 0; i < ids.length; i += 200) {
      const { data: fs, error: eF } = await supabase.from('lead_funnel')
        .select('lead_id, etapa').eq('funnel_id', idNegocio).in('lead_id', ids.slice(i, i + 200));
      if (eF) throw new Error(`No se pudo leer en qué otros funnels está su gente: ${eF.message}`);
      for (const f of (fs ?? []) as Array<{ lead_id: number | string; etapa: string }>) etapaEnNegocio.set(Number(f.lead_id), f.etapa);
    }
  }

  // ⚠️ EL RESCATE VA PRIMERO. Al revés, si el borrado sale bien y el rescate falla, los
  // leads quedan apuntando a un embudo que ya no existe y no hay forma de encontrarlos:
  // el dato que decía dónde estaban se fue con la fila.
  const { data: movidos, error: eMov } = await supabase
    .from('leads').update({ funnel_id: destino }).eq('funnel_id', funnelId).select('id');
  if (eMov) throw new Error(`No se pudo poner a salvo a sus leads: ${eMov.message}`);
  const rescatados = ((movidos ?? []) as unknown[]).length;

  // Nunca hay fila para la casa: la del negocio de los rescatados pasa a ser su etapa y se
  // borra. Después del rescate y sin tirar —la gente ya está a salvo, y un reintento no
  // podría volver a encontrarlos—: si falla queda una fila de más, que el tablero ya
  // deduplica (`agregadosDelTablero`) y `productosDe` ignora. Se registra.
  if (idNegocio != null && etapaEnNegocio.size) {
    const porEtapa = new Map<string, number[]>();
    for (const [id, etapa] of etapaEnNegocio) {
      const ids = porEtapa.get(etapa) ?? [];
      ids.push(id);
      porEtapa.set(etapa, ids);
    }
    for (const [etapa, ids] of porEtapa) {
      for (let i = 0; i < ids.length; i += 200) {
        const { error: eE } = await supabase.from('leads')
          .update({ pipeline_stage: etapa }).in('id', ids.slice(i, i + 200)).is('funnel_id', null);
        if (eE) console.error(`[funnels] rescate: la etapa del negocio no se copió (${ids.length} leads): ${eE.message}`);
      }
    }
    const todos = [...etapaEnNegocio.keys()];
    for (let i = 0; i < todos.length; i += 200) {
      const { error: eB } = await supabase.from('lead_funnel')
        .delete().eq('funnel_id', idNegocio).in('lead_id', todos.slice(i, i + 200));
      if (eB) console.error(`[funnels] rescate: quedaron filas del negocio sobre su propia casa: ${eB.message}`);
    }
  }

  const { data: borradas, error: eDel } = await supabase.from('funnels').delete().eq('id', funnelId).select('id');
  if (eDel) throw new Error(`No se pudo borrar el funnel: ${eDel.message}`);
  if (!((borradas ?? []) as unknown[]).length) throw new Error('Ese funnel no es de este workspace.');
  return { rescatados };
}
/** Devuelve un embudo archivado a la lista. Lo inverso exacto de `archivarFunnel`. */
export async function restaurarFunnel(funnelId: number): Promise<void> {
  const supabase = await getTenantDb();
  const { data: tocadas, error } = await supabase
    .from('funnels').update({ activo: true, updated_at: new Date().toISOString() }).eq('id', funnelId).select('id');
  if (error) throw new Error(`No se pudo restaurar el funnel: ${error.message}`);
  if (!((tocadas ?? []) as unknown[]).length) throw new Error('Ese funnel no es de este workspace.');
}

/**
 * Los embudos ARCHIVADOS del workspace, para poder recuperarlos.
 *
 * ⚠️ Sin esta lectura, archivar sería un borrado: la fila queda pero no hay pantalla que
 * la nombre, así que para la persona desapareció igual. Una copia de seguridad que nadie
 * puede ver no es una copia de seguridad.
 */
export async function listarFunnelsArchivados(): Promise<FunnelResumen[]> {
  try {
    const supabase = await getTenantDb();
    const { data, error } = await supabase
      .from('funnels').select('id, nombre, canal, es_default, declarado, activo')
      .eq('activo', false).order('updated_at', { ascending: false }).order('id');
    if (error) { console.error(`[funnels] listarFunnelsArchivados: ${error.message}`); return []; }
    return ((data ?? []) as unknown as FilaFunnel[]).map((f) => ({
      id: f.id, nombre: f.nombre ?? FUNNEL_DEFAULT_NOMBRE, canal: f.canal ?? null,
      esDefault: f.es_default === true, declarado: f.declarado === true, producto: null,
    }));
  } catch (e) {
    console.error(`[funnels] listarFunnelsArchivados: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}
/**
 * Crea un funnel en el workspace actual y devuelve su id.
 *
 * `esDefault` NO se pasa a la ligera: el índice único parcial `funnels_ws_default_uk`
 * rechaza el segundo default del workspace, que es justo el guard que queremos (un ws
 * tiene exactamente uno). Un funnel nuevo del desplegable nace con `esDefault:false`.
 */
export async function crearFunnel(input: {
  nombre: string;
  pipeline?: Stage[];
  suppressed?: string[];
  canal?: string | null;
  plantilla?: string | null;
  extra?: Record<string, unknown>;
  esDefault?: boolean;
  /** false = la fila existe pero el cliente no declaró nada (origen 'sin-fila'). */
  declarado?: boolean;
}): Promise<number> {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error('El funnel necesita un nombre.');
  const supabase = await getTenantDb();
  const tienePipeline = Boolean(input.pipeline?.length);
  /**
   * Las nutriciones que nacen APAGADAS. Se calculan ACÁ, en el choke point del alta, y no
   * en cada llamador: son TRES los caminos que crean un funnel (el alta de producto del
   * CRM, el onboarding de ofertas y la siembra del embudo del negocio) y sólo uno pasaba
   * la lista de la plantilla. Un default que depende de por dónde entraste no es un
   * default: es una lotería.
   *
   * Lo que el llamador manda se RESPETA y se suma — la plantilla `presencial` trae la suya
   * por un motivo propio— y se unen sin duplicar.
   */
  const apagadas = tienePipeline
    ? [...new Set([...(input.suppressed ?? []), ...suppressedInicial(input.pipeline!)])]
    : (input.suppressed ?? []);
  const { data, error } = await supabase
    .from('funnels')
    .insert({
      nombre,
      canal: input.canal ?? null,
      plantilla: input.plantilla ?? null,
      // Sin pipeline la fila nace con `{}`: igual que las que creó la 0170 para
      // los workspaces que no tenían funnel_config.
      data: tienePipeline ? mergeFunnelData({}, input.pipeline!, apagadas, input.extra) : {},
      declarado: input.declarado ?? tienePipeline,
      es_default: input.esDefault === true,
    })
    .select('id');
  if (error) throw new Error(`Error creando el funnel: ${error.message}`);
  const id = ((data ?? []) as Array<{ id: number }>)[0]?.id;
  if (id == null) throw new Error('Error creando el funnel: la base no devolvió el id.');
  return id;
}
