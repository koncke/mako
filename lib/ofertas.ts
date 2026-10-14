// =============================================================================
// ofertas — la OFERTA como entidad (migs 0169 y 0171, las 0125/0127 del modelo)
// =============================================================================
// producto = LO QUE SE ENTREGA Y SE FACTURA   → lib/productos.ts (mig 0117)
// oferta   = CÓMO SE PRESENTA PARA QUE SE COMPRE → esto
//
// Un cambio en el producto cambia una FACTURA; uno en la oferta cambia un
// ANUNCIO. Por eso la oferta lleva bonos, urgencia, prueba, objeciones y para
// quién es: nada de eso cabe en una factura, y nada de eso existía en ninguna
// tabla del repo antes de la 0169.
//
// ⚠️ NO IMPORTA `./onboarding` A PROPÓSITO. `perfilNegocioTexto()` (allá) llama a
// `ofertaPrincipal()` (acá), así que importar `getAnswers()` desde acá cerraría un
// ciclo entre los dos módulos. Las answers entran POR PARÁMETRO, que además deja
// la dependencia a la vista en cada call-site.
//
// Todas las tablas están en TENANT_TABLES (lib/workspace.ts), así que el
// `.eq('workspace_id')` lo pone `getTenantDb` y no se escribe a mano.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { getSetting, setSetting } from './settings';
import {
  filaAOferta, resolverOfertaPrincipal,
  type Oferta, type OfertaInput, type OfertaPrincipal,
} from './oferta-modelo';

const SEED_KEY = 'mako.ofertas.seeded';

const COLS = 'id, nombre, precio_usd, precio_nota, promesa, incluye, garantia, bonos, '
  + 'urgencia_tipo, urgencia_dato, urgencia_razon, urgencia_hasta, para_quien, objeciones, prueba, '
  + 'desde_brief, es_principal, activa, orden, origen';

const fallo = (que: string, msg: string) => new Error(`${que} falló: ${msg}`);

/**
 * ¿Esta fila es de ESTE workspace?
 *
 * ⚠️ HACE FALTA, y no lo cubre `getTenantDb`. El proxy filtra los SELECT y ESTAMPA
 * el `workspace_id` de los INSERT — pero las FK de Postgres sólo miran que el id
 * EXISTA, no de quién es. En una tabla puente eso alcanza para que un admin que
 * mande un `productoId` ajeno (el body del POST es texto suyo) cree en SU
 * workspace una fila `oferta_productos` que apunta a un producto de otro cliente.
 * Leerlo de vuelta no se lo muestra —`estado()` cruza contra listas ya scopeadas y
 * el id no matchea nada—, así que lo que se rompe no es la privacidad sino la
 * integridad: una liga fantasma que no se ve, no se puede desligar desde la
 * pantalla y ensucia la vista `v_funnel_productos`. Sale más barato prohibirlo en
 * las tres puertas que descubrirlo después con las filas puestas.
 *
 * Es el mismo criterio que ya usan `saveFunnelDe` y `upsertOferta` contra el
 * UPDATE que no tocó nada: nunca dar por buena una operación sobre una fila que
 * el workspace no tiene.
 */
async function esDelWorkspace(tabla: string, id: number): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db.from(tabla).select('id').eq('id', id).limit(1);
  if (error) throw fallo(`verificar ${tabla} #${id}`, error.message);
  return ((data ?? []) as unknown[]).length > 0;
}

// ── Lectura ──────────────────────────────────────────────────────────────────

export async function listarOfertas(soloActivas = false): Promise<Oferta[]> {
  const db = await getTenantDb();
  let q = db.from('ofertas').select(COLS)
    .order('es_principal', { ascending: false })
    .order('orden', { ascending: true })
    .order('id', { ascending: true });
  if (soloActivas) q = q.eq('activa', true);
  const { data, error } = await q;
  if (error) throw fallo('listarOfertas', error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(filaAOferta);
}

/**
 * La fila de la oferta principal, o `null`.
 *
 * ⚠️ NUNCA `.maybeSingle()`: `ofertas_ws_principal_uk` es un índice único PARCIAL
 * y una fila de más devolvería PGRST116, que el catch convertiría en «no hay
 * oferta» sin un solo log. Es el bug que rompió el webhook de Calendly.
 */
export async function filaOfertaPrincipal(): Promise<Oferta | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('ofertas').select(COLS)
    .eq('es_principal', true)
    .order('orden', { ascending: true }).order('id', { ascending: true })
    .limit(1);
  if (error) {
    console.error(`[ofertas] filaOfertaPrincipal: ${error.message}`);
    return null;
  }
  const fila = ((data ?? []) as unknown as Array<Record<string, unknown>>)[0];
  return fila ? filaAOferta(fila) : null;
}

/**
 * EL RESOLVER ÚNICO de los 5 campos del brief. Ver `resolverOfertaPrincipal` en
 * lib/oferta-modelo.ts, que es donde vive la regla (y donde el test la mira).
 *
 * Tolerante a propósito: si la tabla todavía no existe —la migración 0169 se
 * aplica a mano, después de mirar el deploy— la lectura falla y se cae al brief,
 * que es exactamente lo que el producto hace hoy. Un deploy sin migración no
 * puede dejar a ~20 features sin promesa ni precio.
 */
export async function ofertaPrincipal(answers: Record<string, string>): Promise<OfertaPrincipal> {
  const fila = await filaOfertaPrincipal().catch((e) => {
    console.error(`[ofertas] ofertaPrincipal cayó al brief: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  });
  return resolverOfertaPrincipal(fila, answers);
}

// ── Escritura ────────────────────────────────────────────────────────────────

/** El `orden` que le toca a una oferta nueva: al final. Tolerante — si falla, 0. */
async function proximoOrden(): Promise<number> {
  const db = await getTenantDb();
  const { data } = await db.from('ofertas').select('orden').order('orden', { ascending: false }).limit(1);
  const max = (data as { orden: number }[] | null)?.[0]?.orden;
  return typeof max === 'number' && Number.isFinite(max) ? max + 1 : 0;
}

/** Las columnas que se escriben, desde un input parcial. Lo que no venga, no se toca. */
function fila(input: Partial<OfertaInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  if (input.nombre !== undefined) r.nombre = input.nombre.trim();
  set('precio_usd', input.precio_usd);
  set('precio_nota', input.precio_nota?.trim() || null);
  set('promesa', input.promesa?.trim() || null);
  set('incluye', input.incluye?.trim() || null);
  set('garantia', input.garantia?.trim() || null);
  set('bonos', input.bonos);
  set('urgencia_tipo', input.urgencia_tipo ?? null);
  set('urgencia_dato', input.urgencia_dato?.trim() || null);
  set('urgencia_razon', input.urgencia_razon?.trim() || null);
  set('urgencia_hasta', input.urgencia_hasta || null);
  set('para_quien', input.para_quien?.trim() || null);
  set('objeciones', input.objeciones?.trim() || null);
  set('prueba', input.prueba?.trim() || null);
  set('activa', input.activa);
  set('orden', input.orden);
  set('origen', input.origen);
  return r;
}

/**
 * Alta o edición. `es_principal` y `desde_brief` NO se escriben por acá: los dos
 * tienen índice único parcial por workspace y se cambian con funciones propias,
 * para que un formulario no pueda chocar contra el índice sin querer.
 */
export async function upsertOferta(input: OfertaInput, id?: number): Promise<number> {
  if (!input.nombre.trim()) throw new Error('La oferta necesita un nombre.');
  const db = await getTenantDb();
  const row = fila(input);
  if (id) {
    const { data, error } = await db.from('ofertas')
      .update({ ...row, updated_at: new Date().toISOString() }).eq('id', id).select('id');
    if (error) throw fallo('upsertOferta (update)', error.message);
    // Un UPDATE que no tocó nada devuelve ok y cero filas: sin este guard la
    // pantalla diría «guardado» sobre una oferta de otro workspace o ya borrada.
    if (!((data ?? []) as unknown[]).length) throw new Error(`No existe la oferta #${id} en este workspace.`);
    return id;
  }
  const orden = input.orden ?? (await proximoOrden());
  const { data, error } = await db.from('ofertas').insert({ ...row, orden }).select('id');
  if (error) throw fallo('upsertOferta (insert)', error.message);
  const nuevo = ((data ?? []) as Array<{ id: number }>)[0]?.id;
  if (nuevo == null) throw new Error('upsertOferta: la base no devolvió el id.');
  return Number(nuevo);
}

export async function borrarOferta(id: number): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('ofertas').delete().eq('id', id);
  if (error) throw fallo('borrarOferta', error.message);
}

/**
 * Mueve la marca de principal a esta oferta.
 *
 * Dos escrituras y en este orden: primero se apaga la que estaba, después se
 * prende la nueva. Al revés, el índice único parcial `ofertas_ws_principal_uk`
 * rechaza el UPDATE con 23505 y la operación queda a medias.
 */
export async function marcarPrincipal(id: number): Promise<void> {
  const db = await getTenantDb();
  const { error: off } = await db.from('ofertas').update({ es_principal: false }).eq('es_principal', true).neq('id', id);
  if (off) throw fallo('marcarPrincipal (apagar)', off.message);
  const { error } = await db.from('ofertas').update({ es_principal: true }).eq('id', id);
  if (error) throw fallo('marcarPrincipal', error.message);
}

// ── oferta ↔ producto ────────────────────────────────────────────────────────

export type LigaProducto = { id: number; oferta_id: number; producto_id: number; rol: string; orden: number };

export async function productosDeOfertas(): Promise<LigaProducto[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('oferta_productos')
    .select('id, oferta_id, producto_id, rol, orden').order('orden').order('id');
  if (error) throw fallo('productosDeOfertas', error.message);
  return (data ?? []) as unknown as LigaProducto[];
}

export async function ligarProducto(ofertaId: number, productoId: number, rol = 'incluido'): Promise<void> {
  const db = await getTenantDb();
  // Las FK no miran DE QUIÉN es la fila, sólo que exista: ver `esDelWorkspace`.
  if (!(await esDelWorkspace('ofertas', ofertaId))) throw new Error(`No existe la oferta #${ofertaId} en este workspace.`);
  if (!(await esDelWorkspace('productos', productoId))) throw new Error(`No existe el producto #${productoId} en este workspace.`);
  // `uq_oferta_producto` ya impide el duplicado; se pregunta antes para no
  // devolverle al usuario un 23505 crudo por volver a tildar lo mismo.
  const { data } = await db.from('oferta_productos').select('id')
    .eq('oferta_id', ofertaId).eq('producto_id', productoId).limit(1);
  if (((data ?? []) as unknown[]).length) return;
  const { error } = await db.from('oferta_productos').insert({ oferta_id: ofertaId, producto_id: productoId, rol });
  if (error) throw fallo('ligarProducto', error.message);
}

/** Nombre comparable: sin tildes, sin dobles espacios, en minúsculas. El mismo criterio que el catálogo. */
function norm(v: string): string {
  return v.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Liga la oferta al producto del catálogo que le corresponde **sin adivinar**, y devuelve cuál (o null).
 *
 * Dos casos, y sólo dos: el producto que se llama IGUAL que la oferta, o el ÚNICO que hay. Con varios
 * productos y ninguno que coincida **no liga**, y eso es la respuesta correcta, no una a medias: el
 * catálogo es del CRM —lo que se FACTURA— y elegirle uno por parecido le mete al cliente una línea de
 * facturación que él no cargó. La persona liga a mano desde la pantalla de la oferta, que es «un canal
 * propone, una persona confirma» aplicado al único lugar donde no se puede proponer sin inventar.
 *
 * Nunca tira: una oferta guardada sin su producto es un dato incompleto; una oferta que no se guarda
 * porque el puente falló es trabajo perdido. Lo que no se pudo ligar se loguea.
 *
 * Vivía suelta adentro de `seedOfertaDesdeBrief`, y Offer guardaba ofertas sin pasar por ella: la misma
 * regla tenía que correr en los dos caminos que crean una oferta.
 */
export async function ligarProductoQueCorresponde(ofertaId: number, nombreOferta: string): Promise<number | null> {
  try {
    const db = await getTenantDb();
    const { data } = await db.from('productos').select('id, nombre');
    const prods = (data ?? []) as Array<{ id: number; nombre: string }>;
    const elegido = prods.find((p) => norm(p.nombre) === norm(nombreOferta)) ?? (prods.length === 1 ? prods[0] : undefined);
    if (!elegido) return null;
    await ligarProducto(ofertaId, elegido.id, 'principal');
    return elegido.id;
  } catch (e) {
    console.error(`[ofertas] no se pudo ligar el producto de la oferta #${ofertaId}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Desligar es BORRAR la fila: la tabla no tiene `activo` (discontinuar es `ofertas.activa`). */
export async function desligarProducto(ofertaId: number, productoId: number): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('oferta_productos').delete().eq('oferta_id', ofertaId).eq('producto_id', productoId);
  if (error) throw fallo('desligarProducto', error.message);
}

// ── funnel ↔ oferta (mig 0171) ───────────────────────────────────────────────
// La arista va a la OFERTA y no al producto: «TOFU distinto, BOFU compartido» son
// dos funnels vendiendo lo mismo con otra promesa y otro bono, y eso es otra
// oferta del mismo producto. producto↔funnel se DERIVA (vista v_funnel_productos).

export type LigaFunnel = { id: number; funnel_id: number; oferta_id: number; es_principal: boolean; orden: number };

export async function ofertasDeFunnels(): Promise<LigaFunnel[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('funnel_ofertas')
    .select('id, funnel_id, oferta_id, es_principal, orden').order('orden').order('id');
  if (error) throw fallo('ofertasDeFunnels', error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id), funnel_id: Number(r.funnel_id), oferta_id: Number(r.oferta_id),
    es_principal: r.es_principal === true, orden: Number(r.orden ?? 0) || 0,
  }));
}

/**
 * Liga una oferta a un funnel.
 *
 * `esPrincipal` es la que el wizard de cierre ofrece PRIMERO y el foco por defecto
 * del writer: una decisión declarada, nunca `array[0]`. Como tiene índice único
 * parcial por funnel, se apaga la anterior antes de prender esta.
 */
export async function ligarOfertaAFunnel(funnelId: number, ofertaId: number, esPrincipal = false): Promise<void> {
  const db = await getTenantDb();
  // Las FK no miran DE QUIÉN es la fila, sólo que exista: ver `esDelWorkspace`.
  if (!(await esDelWorkspace('funnels', funnelId))) throw new Error(`No existe el funnel #${funnelId} en este workspace.`);
  if (!(await esDelWorkspace('ofertas', ofertaId))) throw new Error(`No existe la oferta #${ofertaId} en este workspace.`);
  const { data } = await db.from('funnel_ofertas').select('id')
    .eq('funnel_id', funnelId).eq('oferta_id', ofertaId).limit(1);
  const yaEsta = ((data ?? []) as Array<{ id: number }>)[0];
  if (esPrincipal) {
    const { error: off } = await db.from('funnel_ofertas').update({ es_principal: false })
      .eq('funnel_id', funnelId).eq('es_principal', true);
    if (off) throw fallo('ligarOfertaAFunnel (apagar principal)', off.message);
  }
  if (yaEsta) {
    if (!esPrincipal) return;
    const { error } = await db.from('funnel_ofertas').update({ es_principal: true }).eq('id', yaEsta.id);
    if (error) throw fallo('ligarOfertaAFunnel (marcar principal)', error.message);
    return;
  }
  const { error } = await db.from('funnel_ofertas')
    .insert({ funnel_id: funnelId, oferta_id: ofertaId, es_principal: esPrincipal });
  if (error) throw fallo('ligarOfertaAFunnel', error.message);
}

export async function desligarOfertaDeFunnel(funnelId: number, ofertaId: number): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('funnel_ofertas').delete().eq('funnel_id', funnelId).eq('oferta_id', ofertaId);
  if (error) throw fallo('desligarOfertaDeFunnel', error.message);
}

// ── lead_magnets (mig 0169) ──────────────────────────────────────────────────
// La tabla existe desde la 0169 y el imán SIGUE viviendo hoy en
// app_settings['mako.entregable'] (lib/entregable.ts, ~14 lectores). La mudanza
// de esos lectores NO es de esta fase: mover el dato y sus lectores en pasadas
// distintas es cómo se arma la segunda copia que se queda vieja. Lo que sí entra
// acá es el CRUD, para que la tabla no nazca sin puerta.

export type LeadMagnet = {
  id: number; oferta_id: number | null; nombre: string; tipo: string | null;
  que_es: string | null; fomo: string | null; enlace: string | null; orden: number;
};

export async function listarLeadMagnets(): Promise<LeadMagnet[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('lead_magnets')
    .select('id, oferta_id, nombre, tipo, que_es, fomo, enlace, orden').order('orden').order('id');
  if (error) throw fallo('listarLeadMagnets', error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    oferta_id: r.oferta_id == null ? null : Number(r.oferta_id),
    nombre: String(r.nombre ?? ''), tipo: (r.tipo as string) ?? null,
    que_es: (r.que_es as string) ?? null, fomo: (r.fomo as string) ?? null,
    enlace: (r.enlace as string) ?? null, orden: Number(r.orden ?? 0) || 0,
  }));
}

export async function upsertLeadMagnet(input: Omit<LeadMagnet, 'id'> & { id?: number }): Promise<number> {
  const db = await getTenantDb();
  // `oferta_id` es FK a `ofertas` y la FK no mira de quién es la fila: sin esto,
  // un imán de este workspace puede quedar colgado de la oferta de otro cliente
  // (ver `esDelWorkspace`). `null` es válido: «del negocio», el caso legacy.
  if (input.oferta_id != null && !(await esDelWorkspace('ofertas', input.oferta_id))) {
    throw new Error(`No existe la oferta #${input.oferta_id} en este workspace.`);
  }
  const row = {
    oferta_id: input.oferta_id, nombre: input.nombre.trim(), tipo: input.tipo,
    que_es: input.que_es, fomo: input.fomo, enlace: input.enlace, orden: input.orden,
  };
  if (input.id) {
    const { data, error } = await db.from('lead_magnets').update(row).eq('id', input.id).select('id');
    if (error) throw fallo('upsertLeadMagnet (update)', error.message);
    // El MISMO guard que `upsertOferta` y `saveFunnelDe`, que acá faltaba: un
    // UPDATE que no tocó ninguna fila devuelve ok con cero filas, así que sin
    // esto la pantalla decía «guardado» sobre un imán de otro workspace o ya
    // borrado, y devolvía su id como si existiera.
    if (!((data ?? []) as unknown[]).length) throw new Error(`No existe el lead magnet #${input.id} en este workspace.`);
    return input.id;
  }
  const { data, error } = await db.from('lead_magnets').insert(row).select('id');
  if (error) throw fallo('upsertLeadMagnet (insert)', error.message);
  return Number(((data ?? []) as Array<{ id: number }>)[0]?.id);
}

export async function borrarLeadMagnet(id: number): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('lead_magnets').delete().eq('id', id);
  if (error) throw fallo('borrarLeadMagnet', error.message);
}

// ── El seed perezoso ─────────────────────────────────────────────────────────

/**
 * Siembra la oferta PRINCIPAL desde el brief, si todavía no existe.
 *
 * Copia el molde ya probado de `seedProductosDesdeOferta` (lib/productos.ts):
 * guard por setting, corre UNA vez, y marca aunque no haya nada que sembrar para
 * no reintentar en cada carga.
 *
 * ⚠️ LOS 5 CAMPOS QUEDAN EN NULL, con `desde_brief = true`. No es un olvido: el
 * valor sigue viviendo en el blob y lo resuelve `ofertaPrincipal()`. Copiarlos
 * sería la segunda copia que se queda vieja el día que alguien edite el brief.
 *
 * ⚠️ Y EL PRECIO DEL BRIEF NO SE PARSEA A NÚMERO. `oferta_ticket` es texto libre
 * en 4 de 6 workspaces medidos («Entre USD 5.000 y USD 10.000», «800 MXN/mes»):
 * un `parseFloat` ahí devuelve NaN y deja el precio en null, que es como quedó el
 * producto id=1 del ws1. Acá directamente no se toca.
 */
export async function seedOfertaDesdeBrief(
  answers: Record<string, string>,
  funnelDefaultId?: number | null,
): Promise<void> {
  if ((await getSetting(SEED_KEY))?.trim()) return;
  const existentes = await listarOfertas();
  if (existentes.length > 0) { await setSetting(SEED_KEY, '1'); return; }
  const nombre = (answers.oferta_nombre ?? '').trim();
  // Se marca ANTES de la primera escritura: sin esto, un workspace sin
  // `oferta_nombre` reintentaría el seed entero en cada carga de la pantalla.
  await setSetting(SEED_KEY, '1');
  if (!nombre) return;

  const id = await upsertOferta({ nombre, desde_brief: true, origen: 'brief', orden: 0 });
  // `es_principal` y `desde_brief` van aparte: `upsertOferta` no los escribe, para
  // que ningún formulario pueda chocar contra sus índices únicos parciales.
  const db = await getTenantDb();
  await db.from('ofertas').update({ es_principal: true, desde_brief: true }).eq('id', id);

  // Se liga al producto que YA existe con el mismo nombre. Si no hay ninguno, la
  // oferta queda SIN producto y está bien: el catálogo es del CRM (lo que se
  // factura) y crear un producto fantasma para llenar el puente le metería al
  // cliente una línea de facturación que él no cargó.
  //
  // ⚠️ Esto pasa de verdad: el ws4 tiene `mako.productos.seeded='1'` con el
  // catálogo VACÍO — el seed de productos corrió, marcó y el producto no quedó.
  // Un guard de seed quemado no se vuelve a abrir, así que ahí `oferta_productos`
  // nace vacío y el dueño liga a mano desde la pantalla.
  await ligarProductoQueCorresponde(id, nombre);

  // Y al funnel del negocio. El backfill de la 0171 hace esto mismo en SQL, pero
  // sólo para las ofertas que existieran el día de la migración — y ese día no
  // existía ninguna, porque el seed es de acá.
  if (funnelDefaultId != null) {
    await ligarOfertaAFunnel(funnelDefaultId, id, true).catch((e) =>
      console.error(`[ofertas] seed: no se pudo ligar al funnel: ${e instanceof Error ? e.message : String(e)}`));
  }
}
