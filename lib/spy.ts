// =============================================================================
// Competitors Spy — leer a un competidor, guardar la historia, y concluir algo útil
// =============================================================================
// El plan: docs/diseno-competitors-spy.md. Las trampas: docs/hallazgos-competitors-spy.md. Las
// reglas puras (contadores, tramos, retenciones, etapa de tendencia): lib/spy-reglas.ts.
//
// Es el molde del analista que ya usa el repo (`scaffold-mako-analyst`, lib/closing.ts): lee una
// fuente → Claude devuelve JSON → una fila por entidad por workspace → sincronización batcheada con
// fecha límite ABSOLUTA. No se inventa un patrón nuevo.
//
// LO QUE SE REUSA, Y ES CASI TODO (docs/diseno-competitors-spy.md §3):
//   · Instagram  → `leerPerfilInstagram` (lib/instagram-perfil-server.ts): Business Discovery con
//     la Meta del negocio, la de la plataforma y Apify, con caché por @ y los seis motivos de fallo
//     tipados. Acá se pide con `conPiezas: true`, el juego ancho de campos.
//   · YouTube    → `claveDeYoutube` (lib/youtube.ts) resuelve la clave, y `traerVideosDelCanal`
//     (lib/spy-youtube.ts) trae los videos SIN pasar por `search.list`.
//   · Landing    → `mirarLanding` (lib/landing-vigilancia.ts) baja la página con su guarda
//     anti-SSRF, dice qué piezas tiene y QUÉ CAMBIÓ desde la última lectura buena, con la regla
//     correcta ya escrita: una lectura que falló es «NO SÉ», jamás «lo sacaron». Replicarla es
//     `replicar-reglas.ts`, que ya le saca los rastreadores del dueño original.
//   · Vocabulario → `HOOK_TYPES` y `TAG_VOCAB` (lib/ads-analyst-vocabulario.ts): el mismo con que
//     clasificamos nuestros propios anuncios, para que «lo que hace la competencia» y «lo que
//     hacemos nosotros» sean comparables.
// No se escribió ningún conector nuevo salvo el lector de canal de YouTube, que no existía.
//
// ⚠️ LO QUE ESTE ARCHIVO NO HACE, Y HAY QUE DECIRLO:
//   · **No trae los anuncios de un competidor de América Latina, porque no se puede.** La Ad
//     Library API devuelve sólo política fuera de la Unión Europea y el Reino Unido (HTTP 200 con
//     lista vacía), y raspar la web pública está prohibido por `robots.txt` (`Disallow: /`) y por
//     los Automated Data Collection Terms de Meta, cuya cláusula 4 describe el modelo de MaKo:
//     recolectar y mostrárselo a un cliente que paga. Lo que SÍ se puede es `guardarAnuncioPegado`:
//     la persona pega el enlace de un anuncio que está mirando y queda en la ficha. El recorrido
//     guiado con la extensión es la Etapa 4 y lo decide Martín (§9 del plan).
//   · **No calcula métricas derivadas** mientras `ENMIENDA_III_L` sea `false` (lib/spy-reglas.ts):
//     el VPH y el outlier están prohibidos por defecto por los Developer Policies de YouTube, y la
//     salida es un trámite, no un `if`.
//   · **No transcribe el video de un competidor:** `captions.download` exige permiso de edición y
//     no hay vía legal. Se analiza título, descripción, etiquetas y miniatura, y se dice que el
//     guion no se leyó.
// =============================================================================

import 'server-only';

import { chatClaude, conClaveDelNegocio } from './anthropic';
import { HOOK_TYPES, TAG_VOCAB } from './ads-analyst-vocabulario';
import { leerPerfilInstagram } from './instagram-perfil-server';
import { nombresDe } from './landing-snapshot';
import { mirarLanding } from './landing-vigilancia';
import { contenidoNoConfiable, getPromptText, renderPrompt } from './prompt-render';
import {
  contadorPublicado, diasCorriendo, etapaDeTendencia, leerTramo, metricasVencidas, textoVencido, TOPES,
  type CanalSpy, type FuentePieza, type TipoPieza,
  nombreComparable, dominioComparable,
} from './spy-reglas';
import { esNuestra, guardarMiniaturas } from './spy-miniaturas';
import { canalDeUrl, noPudeLeerCanal, traerVideosDelCanal } from './spy-youtube';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { claveDeYoutube } from './youtube';

// ─────────────────────────────────────────────────────────────────────────────
// Las filas
// ─────────────────────────────────────────────────────────────────────────────

export type Competidor = {
  id: number;
  nombre: string;
  instagram: string | null;
  youtube_id: string | null;
  landing_url: string | null;
  pagina_anuncios: string | null;
  pais: string | null;
  oferta: OfertaLeida | null;
  mirado_en: string | null;
  texto_leido_en: string | null;
  metricas_leidas_en: string | null;
  /** Su foto de perfil, YA BAJADA a nuestro bucket (0362). No vence. En null, la lista dibuja la inicial. */
  avatar: string | null;
  instagram_seguidores: number | null;
  youtube_suscriptores: number | null;
};

export type Pieza = {
  id: number;
  competidor_id: number;
  canal: CanalSpy;
  tipo: TipoPieza;
  ref: string;
  fuente: FuentePieza;
  url: string | null;
  titulo: string | null;
  texto: string | null;
  etiquetas: string[] | null;
  analisis: AnalisisPieza | null;
  vistas: number | null;
  megusta: number | null;
  comentarios: number | null;
  duracion: string | null;
  gasto_tramo: string | null;
  impresiones_tramo: string | null;
  plataformas: string[] | null;
  dominio_destino: string | null;
  publicada_en: string | null;
  /** La imagen de la pieza, como la dio su fuente. VENCE: ver supabase/migrations/0360_spy_miniatura.sql. */
  miniatura: string | null;
  visto_primera_vez: string;
  visto_ultima_vez: string;
  dejo_de_verse_en: string | null;
  texto_leido_en: string | null;
  metricas_leidas_en: string | null;
};

/** Lo que concluyó el analista sobre la oferta de un competidor. El bloque que justifica la tab. */
export type OfertaLeida = {
  promete: string;
  aQuien: string;
  precio: string | null;
  objecion: string;
  /** Lo que el competidor ataca y la landing del negocio no menciona: la pantalla «Hallazgos». */
  huecos: string[];
};

/** Lo que concluyó el analista sobre una pieza. */
export type AnalisisPieza = {
  gancho: string;
  tipoGancho: string;
  angulo: string;
  etiquetas: string[];
};

const COLUMNAS_COMPETIDOR =
  'id, nombre, instagram, youtube_id, landing_url, pagina_anuncios, pais, oferta, mirado_en, texto_leido_en, metricas_leidas_en, instagram_seguidores, youtube_suscriptores, avatar';

/**
 * ¿El error es «la tabla no existe» (42P01)? La nube escribe la migración y no la puede aplicar, así
 * que durante un rato el código corre sin las tablas. Eso NO es un error del negocio: la pantalla y
 * la API dicen que la tab todavía no está lista y nadie pierde nada.
 */
const sinTabla = (e: { code?: string; message?: string } | null): boolean =>
  e?.code === '42P01' || /relation .*spy_(competidores|piezas).* does not exist/i.test(e?.message ?? '');

export const AUN_SIN_TABLAS = 'Competitors Spy todavía no tiene sus tablas en la base. Falta aplicar la migración 0359.';

// ─────────────────────────────────────────────────────────────────────────────
// Leer y escribir competidores
// ─────────────────────────────────────────────────────────────────────────────

/** Los competidores del negocio, el que se miró más tarde primero. */
export async function listarCompetidores(): Promise<{ ok: true; competidores: Competidor[] } | { ok: false; error: string }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('spy_competidores').select(COLUMNAS_COMPETIDOR).order('mirado_en', { ascending: false, nullsFirst: false }).limit(TOPES.competidores);
  if (error) return { ok: false, error: sinTabla(error) ? AUN_SIN_TABLAS : `No pude leer los competidores: ${error.message}` };
  return { ok: true, competidores: (data ?? []) as Competidor[] };
}

/** Lo que se le dice a la persona: sin una fuente que lea Instagram, el motivo técnico de Meta no le sirve; sí cuáles son las salidas. */
export function detalleDeInstagram(motivo: string, detalle: string): string {
  if (motivo === 'sin-cuenta' || motivo === 'sin-conexion') return 'hace falta Meta con un Instagram vinculado, o tu clave de Apify.';
  if (motivo === 'limite') return `${detalle}. Vuelve a intentarlo más tarde.`;
  return detalle;
}

/** Un competidor por su id. `null` si no es de este negocio: el proxy ya scopea por workspace. */
export async function leerCompetidor(id: number): Promise<Competidor | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('spy_competidores').select(COLUMNAS_COMPETIDOR).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as Competidor;
}

/**
 * Lo que se pega para agregar un competidor: UN campo, no un formulario. Un @ de Instagram, un link
 * de YouTube, el link de su landing o su nombre. Es el mismo patrón del link pegado del Web
 * Generator: la persona pega lo que tiene y el código resuelve qué es.
 */
export function queEs(crudo: string): { campo: 'instagram' | 'youtube_id' | 'landing_url' | 'nombre'; valor: string } | null {
  const s = (crudo ?? '').trim();
  if (!s) return null;
  // Un @ suelto, o un link de Instagram.
  const arroba = s.match(/^@([A-Za-z0-9._]{2,30})$/);
  if (arroba) return { campo: 'instagram', valor: arroba[1].toLowerCase() };
  const ig = s.match(/^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{2,30})\/?/i);
  if (ig) return { campo: 'instagram', valor: ig[1].toLowerCase() };
  // Un canal de YouTube. `canalDeUrl` ya sabe qué formas puede resolver y cuáles no (un `/c/<alias>`
  // no tiene endpoint y devuelve null, en vez de adivinar).
  if (/youtube\.com|youtu\.be/i.test(s)) {
    const c = canalDeUrl(s);
    if (c && 'id' in c) return { campo: 'youtube_id', valor: c.id };
    // Un @handle o un /user/ se resuelven con una llamada: se guardan como vinieron y `mirarCompetidor` los resuelve.
    if (c && 'handle' in c) return { campo: 'youtube_id', valor: `@${c.handle}` };
    if (c && 'usuario' in c) return { campo: 'youtube_id', valor: `user:${c.usuario}` };
    return null;
  }
  if (/^https?:\/\//i.test(s)) return { campo: 'landing_url', valor: s.slice(0, 500) };
  // Un dominio pelado también es una landing («acme.com»).
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return { campo: 'landing_url', valor: `https://${s}`.slice(0, 500) };
  return { campo: 'nombre', valor: s.slice(0, TOPES.nombre) };
}

/**
 * Agrega un competidor con lo poco que se pegó. El `nombre` es del negocio y no se sobrescribe: si
 * sólo pegó un @, el nombre arranca siendo ese @ y después lo puede cambiar.
 */
export async function agregarCompetidor(pegado: string, nombrePedido?: string): Promise<{ ok: true; competidor: Competidor } | { ok: false; error: string }> {
  const leido = queEs(pegado);
  if (!leido) return { ok: false, error: 'No reconocí eso. Pega el @ de Instagram, el enlace de su canal de YouTube o el de su sitio.' };
  const nombre = (nombrePedido ?? '').trim().slice(0, TOPES.nombre) || (leido.campo === 'nombre' ? leido.valor : leido.valor.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]);
  const db = await getTenantDb();
  const cuantos = await db.from('spy_competidores').select('id', { count: 'exact', head: true });
  if (cuantos.error) return { ok: false, error: sinTabla(cuantos.error) ? AUN_SIN_TABLAS : `No pude leer los competidores: ${cuantos.error.message}` };
  if ((cuantos.count ?? 0) >= TOPES.competidores) {
    return { ok: false, error: `Ya tienes ${TOPES.competidores} competidores. Quita uno antes de agregar otro: la tab sirve para mirar pocos a fondo.` };
  }
  // ── ¿YA ESTÁ? ───────────────────────────────────────────────────────────────────────────────
  // ⚠️ EL `onConflict: workspace_id,nombre` DE ABAJO NO ALCANZA, y es la razón de que Martín
  // terminara con tres «Sofia Contreras» (2/11/2026): pegar su @ guarda el nombre
  // «sofiacontreras», pegar su nombre guarda «Sofia Contreras» y pegar su link de YouTube guarda
  // otro más. Para la base son tres nombres distintos; para cualquier persona es la misma.
  //
  // Se deduplica por lo que identifica DE VERDAD, en este orden:
  //   1. el canal — un @ de Instagram o un id de canal pertenecen a una cuenta y a una sola;
  //   2. el nombre reducido a lo comparable, que es lo que colapsa las tres de arriba.
  // Y si el que ya estaba no tenía ese canal, se lo suma: pegar su YouTube sobre la ficha que ya
  // existía tiene que AGREGARLE el canal, no crear a la persona de nuevo.
  const todos = await db.from('spy_competidores').select(COLUMNAS_COMPETIDOR);
  if (todos.error) return { ok: false, error: sinTabla(todos.error) ? AUN_SIN_TABLAS : `No pude leer los competidores: ${todos.error.message}` };
  const existentes = (todos.data ?? []) as Competidor[];
  const buscado = nombreComparable(nombre);
  const yaEsta = existentes.find((x) => (
    (leido.campo === 'instagram' && x.instagram === leido.valor)
    || (leido.campo === 'youtube_id' && x.youtube_id === leido.valor)
    || (leido.campo === 'landing_url' && !!x.landing_url && dominioComparable(x.landing_url) === dominioComparable(leido.valor))
    || (!!buscado && nombreComparable(x.nombre) === buscado)
  ));
  if (yaEsta) {
    // Sólo se escribe si el canal pegado FALTA. Nunca se pisa uno que ya estaba: el que está es
    // el que el negocio eligió, y pisarlo sería cambiarle el competidor sin avisar.
    const suma: Record<string, unknown> = {};
    if (leido.campo === 'instagram' && !yaEsta.instagram) suma.instagram = leido.valor;
    if (leido.campo === 'youtube_id' && !yaEsta.youtube_id) suma.youtube_id = leido.valor;
    if (leido.campo === 'landing_url' && !yaEsta.landing_url) suma.landing_url = leido.valor;
    if (!Object.keys(suma).length) return { ok: true, competidor: yaEsta };
    const r = await db.from('spy_competidores').update({ ...suma, updated_at: new Date().toISOString() })
      .eq('id', yaEsta.id).select(COLUMNAS_COMPETIDOR).maybeSingle();
    return r.data ? { ok: true, competidor: r.data as Competidor } : { ok: true, competidor: yaEsta };
  }

  const fila: Record<string, unknown> = { nombre, updated_at: new Date().toISOString() };
  if (leido.campo !== 'nombre') fila[leido.campo] = leido.valor;
  const { data, error } = await db.from('spy_competidores').upsert(fila, { onConflict: 'workspace_id,nombre' }).select(COLUMNAS_COMPETIDOR).maybeSingle();
  if (error || !data) return { ok: false, error: sinTabla(error) ? AUN_SIN_TABLAS : `No pude guardar el competidor: ${error?.message ?? 'sin fila'}` };
  return { ok: true, competidor: data as Competidor };
}

/**
 * Deja de mirar a alguien. Sus piezas se van con él (`on delete cascade`, 0359): lo leído de un
 * competidor no tiene sentido sin el competidor. El mensaje del tope manda a hacer esto, y hasta el
 * 31/10/2026 no había cómo.
 */
export async function quitarCompetidor(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getTenantDb();
  const { error } = await db.from('spy_competidores').delete().eq('id', id);
  if (error) return { ok: false, error: sinTabla(error) ? AUN_SIN_TABLAS : `No pude quitarlo: ${error.message}` };
  return { ok: true };
}

/** Lo que dice la fila de un competidor en la tabla. */
export type ResumenPiezas = { vivas: number; idas: number; desde: string | null };

/**
 * Cuántas piezas se ven y cuántas ya no, por competidor, y desde cuándo hay historia. Sin agregados
 * en SQL: son a lo sumo 25 competidores (`TOPES.competidores`).
 *
 * ⚠️ ANTE UN ERROR DEVUELVE VACÍO, y la tabla entonces no dibuja esa columna. No hay cero que afirmar.
 */
export async function resumenDePiezas(): Promise<Record<number, ResumenPiezas>> {
  const db = await getTenantDb();
  const { data, error } = await db.from('spy_piezas').select('competidor_id, dejo_de_verse_en, visto_primera_vez').neq('canal', 'landing').limit(5000);
  if (error) return {};
  const out: Record<number, ResumenPiezas> = {};
  for (const fila of (data ?? []) as Array<{ competidor_id: number; dejo_de_verse_en: string | null; visto_primera_vez: string }>) {
    const r = (out[fila.competidor_id] ??= { vivas: 0, idas: 0, desde: null });
    if (fila.dejo_de_verse_en) r.idas += 1; else r.vivas += 1;
    if (!r.desde || fila.visto_primera_vez < r.desde) r.desde = fila.visto_primera_vez;
  }
  return out;
}

/** Las piezas de un competidor, la última vista primero. */
export async function listarPiezas(competidorId: number, canal?: CanalSpy): Promise<Pieza[]> {
  const db = await getTenantDb();
  let q = db.from('spy_piezas').select('*').eq('competidor_id', competidorId);
  if (canal) q = q.eq('canal', canal);
  const { data, error } = await q.order('visto_ultima_vez', { ascending: false }).limit(200);
  if (error) return [];
  return (data ?? []).map(podarVencido) as Pieza[];
}

/**
 * Tacha de una fila lo que ya venció, al LEERLA. Son las dos retenciones de los Developer Policies
 * de YouTube, y se aplican acá porque es el único lugar por donde pasan todas las lecturas: una poda
 * que vive sólo en un cron deja la fila vieja a la vista hasta que el cron corra.
 *
 * El texto a los 30 días SIEMPRE; las métricas a los 36 meses con la enmienda III.L y a los 30 días
 * sin ella (lib/spy-reglas.ts). Lo que se tacha queda `null`, que es «no lo sé» — no «no lo tiene».
 */
function podarVencido(fila: Record<string, unknown>): Record<string, unknown> {
  const out = { ...fila };
  const tTexto = typeof fila.texto_leido_en === 'string' ? fila.texto_leido_en : null;
  if (tTexto && textoVencido(tTexto)) { out.titulo = null; out.texto = null; out.etiquetas = null; out.analisis = null; }
  const tMetricas = typeof fila.metricas_leidas_en === 'string' ? fila.metricas_leidas_en : null;
  if (tMetricas && metricasVencidas(tMetricas)) { out.vistas = null; out.megusta = null; out.comentarios = null; }
  return out;
}

/** La etapa de tendencia de una pieza: cuánto lleva a la vista. Es lo único que MaKo agrega sobre mirar a mano. */
export function etapaDePieza(p: Pick<Pieza, 'publicada_en'>): ReturnType<typeof etapaDeTendencia> {
  return etapaDeTendencia(diasCorriendo(p.publicada_en));
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardar lo que se vio: el upsert que construye la HISTORIA
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que trae una lectura de un canal, antes de guardarse. */
export type PiezaVista = {
  canal: CanalSpy;
  tipo: TipoPieza;
  ref: string;
  fuente: FuentePieza;
  url?: string | null;
  titulo?: string | null;
  texto?: string | null;
  etiquetas?: string[] | null;
  vistas?: number | null;
  megusta?: number | null;
  comentarios?: number | null;
  duracion?: string | null;
  gastoTramo?: string | null;
  impresionesTramo?: string | null;
  plataformas?: string[] | null;
  dominioDestino?: string | null;
  publicadaEn?: string | null;
  /** La imagen que dio la fuente. Instagram la trae (`thumbnail_url`); YouTube no la necesita: la suya se deriva del ref. */
  miniatura?: string | null;
};

/**
 * Guarda lo visto de un canal. Es el corazón de la tab, y tiene UNA regla que decide todo:
 *
 * ⚠️ `visto_primera_vez` SÓLO LO ESCRIBE EL INSERT. En el upsert va fuera del objeto que actualiza,
 * porque si se escribiera en cada vuelta, cada pieza tendría «vista por primera vez: hoy» y la tab
 * perdería lo único que no se puede conseguir mirando a mano. Por eso se parte en dos: las que ya
 * están se ACTUALIZAN sin tocar esa columna, y las nuevas se INSERTAN con ella.
 *
 * ⚠️ Y UNA LECTURA QUE FALLÓ NO LLEGA ACÁ. Marcar `dejo_de_verse_en` con una lista vacía convertiría
 * «no pude leer» en «lo bajó», que es exactamente el error que `lib/landing-vigilancia.ts` lleva
 * escrito en su cabecera. Quien llama sólo pasa lo que leyó de verdad, y `marcarDejadas` se llama
 * aparte y sólo después de una lectura BUENA.
 */
export async function guardarVistas(
  competidorId: number,
  vistas: readonly PiezaVista[],
): Promise<{ nuevas: number; actualizadas: number; error?: string }> {
  if (!vistas.length) return { nuevas: 0, actualizadas: 0 };
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  const canales = [...new Set(vistas.map((v) => v.canal))];
  const { data: yaEstaban, error: errLeer } = await db.from('spy_piezas').select('ref, canal').eq('competidor_id', competidorId).in('canal', canales);
  if (errLeer) return { nuevas: 0, actualizadas: 0, error: sinTabla(errLeer) ? AUN_SIN_TABLAS : errLeer.message };
  const conocidas = new Set((yaEstaban ?? []).map((r) => `${(r as { canal: string }).canal}|${(r as { ref: string }).ref}`));

  // Las dos clases de dato llevan RELOJES DISTINTOS, y por eso se escriben en columnas distintas:
  // el texto se borra a los 30 días y las métricas duran hasta 36 meses con la enmienda III.L.
  // ⚠️ LA MINIATURA SE BAJA ANTES DE GUARDAR. La URL del CDN de la fuente vence Y, en el caso de
  // Meta, devuelve 403 a todo pedido que venga de otro dominio: guardar la URL era guardar algo
  // que después no se iba a poder ver. `guardarMiniaturas` NUNCA tira — si una imagen no se puede
  // bajar deja la URL original y la pieza se guarda igual, porque perder el competidor entero por
  // una imagen sería cambiar un problema chico por uno grande. Ver lib/spy-miniaturas.ts y la 0361.
  const conFoto = await guardarMiniaturas(vistas);

  const comun = (v: PiezaVista) => ({
    competidor_id: competidorId, canal: v.canal, tipo: v.tipo, ref: v.ref.slice(0, TOPES.ref), fuente: v.fuente,
    url: v.url ?? null,
    titulo: v.titulo?.slice(0, TOPES.titulo) ?? null,
    texto: v.texto?.slice(0, TOPES.texto) ?? null,
    etiquetas: v.etiquetas ?? null,
    texto_leido_en: ahora,
    // `contadorPublicado` y no `?? 0`: ausente es «no lo publica», y son dos datos distintos.
    vistas: contadorPublicado(v.vistas), megusta: contadorPublicado(v.megusta), comentarios: contadorPublicado(v.comentarios),
    duracion: v.duracion ?? null,
    // Ya bajada a nuestro bucket cuando se pudo (0361). Si no se pudo queda la del CDN ajeno, y
    // `miniatura_guardada_en` en null lo dice: ésa es la que vence y la que puede dar 403.
    miniatura: v.miniatura ?? null,
    miniatura_guardada_en: esNuestra(v.miniatura) ? ahora : null,
    metricas_leidas_en: ahora,
    // Los tramos de la Ad Library viajan como TEXTO. `leerTramo` valida la forma y devuelve el
    // texto tal cual: nunca un número, que sería un dato que nos inventamos.
    gasto_tramo: leerTramo(v.gastoTramo)?.texto ?? null,
    impresiones_tramo: leerTramo(v.impresionesTramo)?.texto ?? null,
    plataformas: v.plataformas ?? null,
    dominio_destino: v.dominioDestino ?? null,
    publicada_en: v.publicadaEn ?? null,
    visto_ultima_vez: ahora,
    dejo_de_verse_en: null,
    updated_at: ahora,
  });

  const nuevas = conFoto.filter((v) => !conocidas.has(`${v.canal}|${v.ref}`));
  const viejas = conFoto.filter((v) => conocidas.has(`${v.canal}|${v.ref}`));
  let err: string | undefined;
  if (nuevas.length) {
    // Las nuevas SÍ escriben `visto_primera_vez`: es la primera vez que las vemos.
    const r = await db.from('spy_piezas').upsert(nuevas.map((v) => ({ ...comun(v), visto_primera_vez: ahora })), { onConflict: 'workspace_id,competidor_id,canal,ref' });
    if (r.error) err = r.error.message;
  }
  if (viejas.length) {
    const r = await db.from('spy_piezas').upsert(viejas.map(comun), { onConflict: 'workspace_id,competidor_id,canal,ref' });
    if (r.error) err = r.error.message;
  }
  return { nuevas: nuevas.length, actualizadas: viejas.length, error: err };
}

/**
 * Marca como «ya no se ve» lo que estaba y esta vez no vino. **Se llama SÓLO después de una lectura
 * buena**, y nunca con una lista vacía: con las piezas vacías de un timeout, esto convertiría «no
 * pude leer» en «lo bajó todo» y la línea de tiempo diría que el competidor dejó de publicar.
 */
export async function marcarDejadas(competidorId: number, canal: CanalSpy, refsQueSiguen: readonly string[]): Promise<void> {
  if (!refsQueSiguen.length) return;
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  const { data } = await db.from('spy_piezas').select('id, ref').eq('competidor_id', competidorId).eq('canal', canal).is('dejo_de_verse_en', null);
  const idsQueSeFueron = (data ?? []).filter((r) => !refsQueSiguen.includes((r as { ref: string }).ref)).map((r) => (r as { id: number }).id);
  if (!idsQueSeFueron.length) return;
  await db.from('spy_piezas').update({ dejo_de_verse_en: ahora, updated_at: ahora }).in('id', idsQueSeFueron);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirar a un competidor: los tres canales que SÍ se pueden leer
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que pasó al mirar un canal. Tres estados, no dos: leyó · no se pudo · no está configurado. */
export type LecturaCanalSpy = { canal: CanalSpy; ok: boolean; piezas: number; nuevas: number; detalle: string };

/**
 * Mira a un competidor: Instagram, YouTube y su landing. Los anuncios NO entran acá (no hay camino
 * automático legal en América Latina: `guardarAnuncioPegado`).
 *
 * Devuelve una línea por canal, también por el que no se pudo leer: «no pude» es un tercer estado y
 * confundirlo con «no tiene» le miente al negocio.
 */
export async function mirarCompetidor(competidorId: number): Promise<{ ok: boolean; canales: LecturaCanalSpy[]; error?: string }> {
  const c = await leerCompetidor(competidorId);
  if (!c) return { ok: false, canales: [], error: 'No encontré ese competidor.' };
  const canales: LecturaCanalSpy[] = [];
  const ahora = new Date().toISOString();
  let seguidores: number | null = c.instagram_seguidores;
  let cara: string | null = c.avatar;
  let suscriptores: number | null = c.youtube_suscriptores;

  // ── Instagram: Business Discovery con el juego ancho de campos ──────────────
  if (c.instagram) {
    // ⚠️ CON EL NEGOCIO (1/11/2026): sin `ws`, la función no podía usar la Meta del cliente ni su clave, y leía siempre con la de la plataforma.
    const l = await leerPerfilInstagram(c.instagram, { ws: await getWorkspaceActual(), conPiezas: true, fuentes: ['meta-negocio', 'meta-plataforma', 'apify-spy'] });
    if (!l.ok) {
      canales.push({ canal: 'instagram', ok: false, piezas: 0, nuevas: 0, detalle: `No pude leer @${c.instagram}: ${detalleDeInstagram(l.motivo, l.detalle)}` });
    } else {
      seguidores = l.perfil.seguidores;
      // ⚠️ LA CARA SE BAJA, NO SE APUNTA. `l.perfil.foto` es una URL del CDN de Meta que vence y
      // que además da 403 desde otro dominio (ver lib/spy-miniaturas.ts). Por eso el comentario
      // de instagram-perfil.ts decía «nunca para guardarla»: con el bucket de 0361 ya se puede.
      if (l.perfil.foto) {
        const [bajada] = await guardarMiniaturas([{ canal: 'avatar', ref: c.instagram, miniatura: l.perfil.foto }]);
        // Sólo se guarda si quedó en NUESTRO bucket: guardar la de Meta sería guardar una que vence.
        if (esNuestra(bajada.miniatura)) cara = bajada.miniatura ?? cara;
      }
      // `piezas` es `undefined` cuando Meta rechazó el juego ancho y se cayó al de siempre: ahí hay
      // perfil pero no números, y eso se dice. No es una lista vacía.
      const piezas = l.perfil.piezas;
      if (!piezas) {
        canales.push({ canal: 'instagram', ok: true, piezas: 0, nuevas: 0, detalle: 'Leí el perfil, pero esta conexión de Meta no entrega los números de cada publicación.' });
      } else {
        const vistas: PiezaVista[] = piezas.map((p) => ({
          canal: 'instagram' as const,
          tipo: (p.formato === 'REELS' ? 'reel' : 'publicacion') as TipoPieza,
          ref: p.ref, fuente: 'api' as const, url: p.permalink, texto: p.texto,
          vistas: p.vistas, megusta: p.megusta, comentarios: p.comentarios,
          publicadaEn: p.fecha || null,
          // ⚠️ ACÁ SE PERDÍAN LOS VIDEOS DE IG. `leerPerfilInstagram` ya devolvía la miniatura
          // (`thumbnail_url`, lib/instagram-perfil.ts) y este mapeo no la copiaba, así que un reel
          // llegaba a la grilla como texto con números en vez de como un video que se ve.
          miniatura: p.miniatura,
        }));
        const g = await guardarVistas(competidorId, vistas);
        if (vistas.length) await marcarDejadas(competidorId, 'instagram', vistas.map((v) => v.ref));
        canales.push({ canal: 'instagram', ok: !g.error, piezas: vistas.length, nuevas: g.nuevas, detalle: g.error ?? `${vistas.length} publicaciones` });
      }
    }
  }

  // ── YouTube: channels.list → playlist de subidas → playlistItems → videos.list ───
  if (c.youtube_id) {
    const clave = await claveDeYoutube();
    if (!clave) {
      canales.push({ canal: 'youtube', ok: false, piezas: 0, nuevas: 0, detalle: noPudeLeerCanal('sin-clave') });
    } else {
      const apunta = c.youtube_id.startsWith('@') ? { handle: c.youtube_id.slice(1) }
        : c.youtube_id.startsWith('user:') ? { usuario: c.youtube_id.slice(5) }
        : { id: c.youtube_id };
      const l = await traerVideosDelCanal(apunta, clave, fetch);
      if (!l.ok) {
        canales.push({ canal: 'youtube', ok: false, piezas: 0, nuevas: 0, detalle: noPudeLeerCanal(l.motivo) });
      } else {
        suscriptores = l.canal.suscriptores;
        const vistas: PiezaVista[] = l.videos.map((v) => ({
          canal: 'youtube' as const, tipo: 'video' as const, ref: v.id, fuente: 'api' as const,
          url: `https://www.youtube.com/watch?v=${v.id}`,
          titulo: v.titulo, texto: v.descripcion, etiquetas: v.etiquetas,
          vistas: v.vistas, megusta: v.megusta, comentarios: v.comentarios,
          duracion: v.duracion, publicadaEn: v.publicadoEn || null,
        }));
        const g = await guardarVistas(competidorId, vistas);
        if (vistas.length) await marcarDejadas(competidorId, 'youtube', vistas.map((v) => v.ref));
        canales.push({ canal: 'youtube', ok: !g.error, piezas: vistas.length, nuevas: g.nuevas, detalle: g.error ?? `${vistas.length} videos` });
      }
    }
  }

  // ── La landing: lo que ya hace `mirarLanding`, apuntado a una página ajena ──
  if (c.landing_url) {
    try {
      const m = await mirarLanding(c.landing_url);
      // ⚠️ `analisis.ok === false` ES UNA LECTURA QUE FALLÓ, y acá se corta. Guardar la fila con la
      // lista de piezas vacía escribiría «esta landing no tiene nada» sobre una página que no
      // pudimos leer, y la próxima vuelta la línea de tiempo diría que el competidor le sacó el
      // video y el formulario. Es la regla que `lib/landing-vigilancia.ts` lleva escrita en su
      // cabecera: una lectura que falló es «NO SÉ», jamás «lo sacaron».
      if (!m.analisis.ok) {
        canales.push({ canal: 'landing', ok: false, piezas: 0, nuevas: 0, detalle: `No pude leer su sitio: ${m.analisis.error ?? 'la página no contestó'}` });
      } else {
        // Las piezas vienen como un `Set`: VSL, formulario, agenda, botón de WhatsApp, píxeles.
        const piezas = [...m.analisis.piezas];
        const vistas: PiezaVista[] = [{
          canal: 'landing' as const, tipo: 'landing' as const, ref: c.landing_url, fuente: 'pagina' as const,
          url: c.landing_url,
          titulo: hostDe(c.landing_url),
          etiquetas: piezas.length ? piezas : null,
        }];
        const g = await guardarVistas(competidorId, vistas);
        const cambios = m.cambios.nuevas.length + m.cambios.sacadas.length;
        canales.push({
          canal: 'landing', ok: !g.error, piezas: 1, nuevas: g.nuevas,
          detalle: g.error ?? `${piezas.length ? `${nombresDe(piezas).join(', ')}` : 'sin piezas detectadas'}${cambios ? ` · ${cambios} cambios` : ''}`,
        });
      }
    } catch (e) {
      canales.push({ canal: 'landing', ok: false, piezas: 0, nuevas: 0, detalle: `No pude leer su sitio: ${msg(e)}` });
    }
  }

  const db = await getTenantDb();
  await db.from('spy_competidores').update({
    mirado_en: ahora, texto_leido_en: ahora, metricas_leidas_en: ahora,
    instagram_seguidores: seguidores, youtube_suscriptores: suscriptores, avatar: cara, updated_at: ahora,
  }).eq('id', competidorId);
  return { ok: canales.some((x) => x.ok), canales };
}

/**
 * Guarda un anuncio que PEGÓ la persona. Es la única vía de anuncios que no tiene problema de
 * términos: un pedido explícito de un usuario sobre un dato público que él está mirando. No hay
 * recolección automatizada, así que no entra la cláusula 4 de los Automated Data Collection Terms.
 *
 * El `ref` es el Library ID cuando se puede sacar del enlace, y el enlace entero cuando no.
 */
export async function guardarAnuncioPegado(
  competidorId: number,
  enlace: string,
  copy?: string,
): Promise<{ ok: true; nuevo: boolean } | { ok: false; error: string }> {
  const url = (enlace ?? '').trim();
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Pega el enlace del anuncio de la Biblioteca de Anuncios.' };
  const id = url.match(/[?&]id=(\d{5,})/)?.[1] ?? url.match(/\/(\d{10,})\/?$/)?.[1] ?? url;
  const g = await guardarVistas(competidorId, [{
    canal: 'anuncios', tipo: 'anuncio', ref: id, fuente: 'pegado', url,
    texto: copy ?? null,
    // Sin gasto ni impresiones a propósito: de un competidor comercial de América Latina no existen
    // en ningún producto de Meta. Si algún día se pega un anuncio de la Unión Europea, los tramos
    // entran por `gastoTramo`/`impresionesTramo`, que son TEXTO.
  }]);
  if (g.error) return { ok: false, error: g.error };
  return { ok: true, nuevo: g.nuevas > 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// El analista: Claude lee lo guardado y dice qué vende el competidor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las instrucciones del analista. Editables desde /configuraciones
 * (lib/prompt-registry.ts → `spy.analisis.system`): si quedaran acá nada más, el negocio no podría
 * cambiarlas y el prompt sería mudo a su propia oferta.
 */
export const SPY_ANALISIS_SYSTEM_TEMPLATE = `Eres el analista de competencia de MaKo. Te doy lo que se leyó del competidor de un negocio y lo que ese negocio vende. Tu trabajo es decir qué ofrece el competidor y qué está atacando que el negocio no menciona.

REGLAS QUE NO SE NEGOCIAN:
- Trabaja SOLO con lo que está en los datos. Si algo no está, el campo va vacío. No completes con lo que suele pasar en ese rubro.
- No estimes números. Nada de facturación, visitas, conversión ni alcance: no están en los datos y un número inventado es peor que un campo vacío.
- No hables de la persona: habla de su oferta y de su contenido. Nada de "guerra", "batalla" ni rivalidades.
- El guion de los videos NO se leyó (no hay forma legal de transcribir el video de un tercero): trabaja con el título, la descripción y las etiquetas, y no afirmes qué dice el video.

Responde SOLO con este JSON, sin texto alrededor:
{
  "oferta": {
    "promete": "qué resultado promete, en una frase",
    "aQuien": "a quién se lo promete",
    "precio": "el precio si lo publica, o null",
    "objecion": "la objeción principal que ataca",
    "huecos": ["lo que este competidor ataca y el negocio no menciona, una frase por elemento, hasta 3"]
  },
  "piezas": [
    { "ref": "el ref tal como vino", "gancho": "con qué abre, en sus palabras", "tipoGancho": "{{tiposGancho}}", "angulo": "el ángulo en una o dos palabras", "etiquetas": ["de esta lista: {{etiquetas}}"] }
  ]
}`;

/** El pedido: lo que se leyó del competidor y lo que vende el negocio. */
export const SPY_ANALISIS_USER_TEMPLATE = `COMPETIDOR: {{competidor}}

LO QUE VENDE EL NEGOCIO QUE PREGUNTA:
{{negocio}}

LO QUE SE LEYÓ DEL COMPETIDOR:
{{piezas}}`;

/** Lo que devuelve el analista. */
export type Analisis = { oferta: OfertaLeida; piezas: Array<AnalisisPieza & { ref: string }> };

/** El primer objeto JSON de un texto, tolerando los cercos de ```json. El molde de lib/closing.ts. */
function objetoJson(texto: string): unknown {
  const limpio = texto.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const a = limpio.indexOf('{');
  const b = limpio.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) throw new Error('la respuesta no trae JSON');
  return JSON.parse(limpio.slice(a, b + 1));
}

/** El dominio de una URL, para titular la fila de la landing sin bajar la página otra vez. */
function hostDe(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0, TOPES.titulo); }
}

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const txt = (v: unknown, max = 400): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const unoDe = (v: unknown, permitidos: readonly string[], porDefecto: string): string => {
  const s = txt(v, 60).toLowerCase();
  return permitidos.includes(s) ? s : porDefecto;
};

/** Lee la respuesta del modelo con todos los campos opcionales: lo que no vino queda vacío, no inventado. */
export function leerAnalisis(crudo: unknown): Analisis {
  const o = esObj(crudo) && esObj(crudo.oferta) ? crudo.oferta : {};
  const piezas = esObj(crudo) && Array.isArray(crudo.piezas) ? crudo.piezas.filter(esObj) : [];
  return {
    oferta: {
      promete: txt(o.promete),
      aQuien: txt(o.aQuien),
      precio: txt(o.precio, 80) || null,
      objecion: txt(o.objecion),
      huecos: (Array.isArray(o.huecos) ? o.huecos : []).map((h) => txt(h, 240)).filter(Boolean).slice(0, 3),
    },
    piezas: piezas.map((p) => ({
      ref: txt(p.ref, TOPES.ref),
      gancho: txt(p.gancho, 300),
      tipoGancho: unoDe(p.tipoGancho, HOOK_TYPES, 'promesa'),
      angulo: txt(p.angulo, 60),
      etiquetas: (Array.isArray(p.etiquetas) ? p.etiquetas : []).map((t) => txt(t, 40)).filter((t) => (TAG_VOCAB as readonly string[]).includes(t)).slice(0, 6),
    })).filter((p) => p.ref),
  };
}

/**
 * Analiza a un competidor con lo que ya está guardado. La IA es la DEL NEGOCIO; si no tiene, la de
 * la plataforma (el Plan nunca paga IA, así que la clave de MaKo es el último recurso).
 *
 * No tira nunca: devuelve `{ ok: false, error }`, porque quien llama es un cron o un runner de la
 * API y los dos tienen que poder seguir con el competidor siguiente.
 */
export async function analizarCompetidor(
  competidorId: number,
  queVendeElNegocio: string,
): Promise<{ ok: true; analisis: Analisis } | { ok: false; error: string; falla?: true }> {
  const c = await leerCompetidor(competidorId);
  if (!c) return { ok: false, error: 'No encontré ese competidor.' };
  const piezas = await listarPiezas(competidorId);
  if (!piezas.length) return { ok: false, error: 'Todavía no hay nada leído de ese competidor. Míralo primero.' };
  const comoTexto = piezas.slice(0, 40).map((p) => {
    const etapa = etapaDePieza(p);
    return [
      `[${p.ref}] ${p.canal}/${p.tipo}`,
      p.titulo ? `título: ${p.titulo}` : '',
      p.texto ? `texto: ${p.texto.slice(0, 600)}` : '',
      p.etiquetas?.length ? `etiquetas: ${p.etiquetas.join(', ')}` : '',
      // Los contadores se dicen como lo que son. «no lo publica» y «0» son dos datos distintos, y
      // el modelo tiene que poder distinguirlos igual que la pantalla.
      `vistas: ${p.vistas ?? 'no lo publica'} · me gusta: ${p.megusta ?? 'no lo publica'} · comentarios: ${p.comentarios ?? 'no lo publica'}`,
      p.gasto_tramo ? `gasto (TRAMO, no un número): ${p.gasto_tramo}` : '',
      etapa ? `lleva a la vista: ${etapa}` : 'no se sabe desde cuándo corre',
    ].filter(Boolean).join(' · ');
  }).join('\n');

  try {
    const system = await renderPrompt('spy.analisis.system', SPY_ANALISIS_SYSTEM_TEMPLATE, {
      tiposGancho: HOOK_TYPES.join('|'),
      etiquetas: TAG_VOCAB.join(', '),
    });
    const user = await renderPrompt('spy.analisis.user', SPY_ANALISIS_USER_TEMPLATE, {
      competidor: c.nombre,
      negocio: contenidoNoConfiable(queVendeElNegocio || '(sin oferta cargada)', 'oferta_del_negocio'),
      // Todo lo del competidor es contenido de un tercero: va marcado para que el modelo no lo lea
      // como una instrucción. El copy de un anuncio puede decir cualquier cosa.
      piezas: contenidoNoConfiable(comoTexto, 'piezas_del_competidor'),
    });
    const suya = await conClaveDelNegocio({ system, user, maxTokens: 4000, feature: 'spy', motivo: 'Analizar a un competidor', timeoutMs: 90_000 });
    let texto: string;
    if (suya && 'texto' in suya) texto = suya.texto;
    else if (suya && 'noPudeLeer' in suya) return { ok: false, error: suya.error };
    else if (suya) return { ok: false, error: `Tu clave de IA no pudo analizar al competidor: ${suya.error}` };
    else texto = await chatClaude(system, [{ role: 'user', content: user }], { maxTokens: 4000, feature: 'spy' });
    const analisis = leerAnalisis(objetoJson(texto));
    await guardarAnalisis(competidorId, analisis);
    return { ok: true, analisis };
  } catch (e) {
    return { ok: false, error: `No pude analizar al competidor: ${msg(e)}`, falla: true };
  }
}

/** Guarda la oferta en el competidor y el análisis en cada pieza, con el reloj del TEXTO. */
async function guardarAnalisis(competidorId: number, a: Analisis): Promise<void> {
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  await db.from('spy_competidores').update({ oferta: a.oferta, texto_leido_en: ahora, updated_at: ahora }).eq('id', competidorId);
  for (const p of a.piezas) {
    await db.from('spy_piezas')
      .update({ analisis: { gancho: p.gancho, tipoGancho: p.tipoGancho, angulo: p.angulo, etiquetas: p.etiquetas }, texto_leido_en: ahora, updated_at: ahora })
      .eq('competidor_id', competidorId).eq('ref', p.ref);
  }
}

/**
 * Las instrucciones del analista, tal como quedaron después de la edición del negocio. Lo usa
 * /configuraciones para mostrar el texto vigente.
 */
export const leerSystemDelSpy = (): Promise<string> => getPromptText('spy.analisis.system', SPY_ANALISIS_SYSTEM_TEMPLATE);
