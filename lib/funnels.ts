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
import { DEFAULT_PIPELINE, mergeFunnelData } from './pipeline';
import { getTenantDb } from './workspace';
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

/** Los funnels del workspace, para el desplegable. El default primero. */
export async function listarFunnels(): Promise<FunnelResumen[]> {
  try {
    const supabase = await getTenantDb();
    const { data, error } = await supabase
      .from('funnels').select('id, nombre, canal, es_default, declarado, activo')
      .eq('activo', true)
      .order('es_default', { ascending: false }).order('orden', { ascending: true }).order('id');
    if (error) { console.error(`[funnels] listarFunnels: ${error.message}`); return []; }
    const filas = (data ?? []) as unknown as FilaFunnel[];

    // El nombre que el negocio reconoce es el del PRODUCTO, no el del funnel —que
    // se llama «Funnel principal» en todos los workspaces porque lo puso la
    // migración—. Sale de la vista que ya cruza funnel → oferta → producto.
    // Nunca rompe: si la vista falla, el desplegable sigue mostrando lo de antes.
    const productos = new Map<number, string>();
    try {
      const { data: vp } = await supabase
        .from('v_funnel_productos').select('funnel_id, producto_id').eq('es_principal', true);
      const ids = [...new Set(((vp ?? []) as Array<{ producto_id: number }>).map((x) => x.producto_id))];
      if (ids.length) {
        const { data: ps } = await supabase.from('productos').select('id, nombre').in('id', ids);
        const nombreDe = new Map(((ps ?? []) as Array<{ id: number; nombre: string }>).map((p) => [p.id, p.nombre]));
        for (const x of (vp ?? []) as Array<{ funnel_id: number; producto_id: number }>) {
          const n = nombreDe.get(x.producto_id);
          if (n) productos.set(x.funnel_id, n);
        }
      }
    } catch (e) {
      console.warn('[funnels] no se pudo leer el producto de cada funnel:', e instanceof Error ? e.message : e);
    }

    return filas.map((f) => ({
      id: f.id, nombre: f.nombre ?? FUNNEL_DEFAULT_NOMBRE, canal: f.canal ?? null,
      esDefault: f.es_default === true, declarado: f.declarado === true,
      producto: productos.get(f.id) ?? null,
    }));
  } catch (e) {
    console.error(`[funnels] listarFunnels: ${e instanceof Error ? e.message : String(e)}`);
    return [];
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
  const { data, error } = await supabase
    .from('funnels')
    .insert({
      nombre,
      canal: input.canal ?? null,
      plantilla: input.plantilla ?? null,
      // Sin pipeline la fila nace con `{}`: igual que las que creó la 0170 para
      // los workspaces que no tenían funnel_config.
      data: tienePipeline ? mergeFunnelData({}, input.pipeline!, input.suppressed ?? [], input.extra) : {},
      declarado: input.declarado ?? tienePipeline,
      es_default: input.esDefault === true,
    })
    .select('id');
  if (error) throw new Error(`Error creando el funnel: ${error.message}`);
  const id = ((data ?? []) as Array<{ id: number }>)[0]?.id;
  if (id == null) throw new Error('Error creando el funnel: la base no devolvió el id.');
  return id;
}
