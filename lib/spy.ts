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
//     recolectar y mostrárselo a un cliente que paga. Lo que hay son dos caminos con la persona
//     adelante: `guardarAnuncioPegado` (pega el enlace de un anuncio) y «Guardar en Spy» en la
//     extensión, con un clic, que Martín decidió el 3/11/2026 (§9.1 del plan; lib/spy-captura.ts).
//   · **No calcula métricas derivadas** mientras `ENMIENDA_III_L` sea `false` (lib/spy-reglas.ts):
//     el VPH y el outlier están prohibidos por defecto por los Developer Policies de YouTube, y la
//     salida es un trámite, no un `if`.
//   · **No transcribe el video de un competidor:** `captions.download` exige permiso de edición y
//     no hay vía legal. Se analiza título, descripción, etiquetas y miniatura, y se dice que el
//     guion no se leyó.
// =============================================================================

import 'server-only';

import { chatCheapCascade } from './ai-cheap';
import { HOOK_TYPES, TAG_VOCAB } from './ads-analyst-vocabulario';
import { leerPerfilInstagram } from './instagram-perfil-server';
import type { PiezaInstagram } from './instagram-perfil';
import { nombresDe } from './landing-snapshot';
import { mirarLanding } from './landing-vigilancia';
import { contenidoNoConfiable, getPromptText, renderPrompt } from './prompt-render';
import {
  contadorPublicado, diasCorriendo, etapaDeTendencia, leerTramo, podarVencido, TOPES,
  type CanalSpy, type FuentePieza, type TipoPieza,
  nombreComparable, dominioComparable, canalDeLaBio,
} from './spy-reglas';
import { esPaisConocido } from './paises';
import { comoAQuienMira, nombreDeReferente, referenteDeCompetidor } from './spy-caricatura';
import { sirveLaCompartida, type MotivoDeLectura } from './spy-compartido';
import { anotarAhorro, guardarLecturaCompartida, lecturaCompartida } from './spy-compartido-db';
import { conLectura, funnelDeFila, leerFunnel, type Funnel, type LecturaFunnel } from './spy-funnel';
import { esNuestra, guardarMiniaturas } from './spy-miniaturas';
import { faltaLaColumnaDeMedio, gruposDeMedio, medioDeInstagram, type Medio } from './spy-medio';
import { VIDEOS_POR_LECTURA_COMPLETA, leerCompleto, noPudeLeerCanal, traerVideosDelCanal } from './spy-youtube';
import { esAgregador, sitioDelTexto } from './spy-otras-redes-reglas';
import { CLAVE_CARICATURAS, caricaturaEnCamino, caricaturasListas, leerRegistro } from './spy-caricatura-reglas';
import { encolarAlLeer } from './spy-caricatura-servidor';
import { seFueron } from './spy-todo-reglas';
import { FORMATOS, GUIA_DE_FORMATOS, formatoDe } from './spy-detalle';
import { leerPorPaginas } from './supabase-paginado';
import { borrarSetting, borrarSettingsConPrefijo, getSetting } from './settings';
import { claveOfertaSpy } from './spy-oferta';
import { prefijoTranscripciones } from './spy-transcripcion';
import { ANALISIS_SIN_DATOS, ofertaQueQueda, pendientesDeAnalisis, refsSinRespuesta } from './spy-analisis-reglas';
import { queEs } from './spy-que-es';
import { claveLectura, leeCanal, type PasoLectura } from './spy-lectura-pasos';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { claveDeYoutube } from './youtube';

export { queEs };

// ─────────────────────────────────────────────────────────────────────────────
// Las filas
// ─────────────────────────────────────────────────────────────────────────────

export type Competidor = {
  id: number;
  nombre: string;
  instagram: string | null;
  youtube_id: string | null;
  /** Su @ de TikTok (0365). Spy no lo lee: dice dónde está. */
  tiktok: string | null;
  landing_url: string | null;
  pagina_anuncios: string | null;
  pais: string | null;
  oferta: OfertaLeida | null;
  mirado_en: string | null;
  texto_leido_en: string | null;
  metricas_leidas_en: string | null;
  /** Su foto de perfil, YA BAJADA a nuestro bucket (0362). No vence. En null, la lista dibuja la inicial. */
  avatar: string | null;
  /** La caricatura que se hizo sola, ya en nuestro bucket. No es una columna: sale de `spy.caricaturas` al listar. */
  caricatura?: string | null;
  /** Su caricatura está en la cola, sin fallos: la tarjeta lo dice y la pantalla pregunta hasta que llegue. No es una columna. */
  caricaturaPendiente?: boolean;
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
  /** Sólo en la landing: sus píxeles, su checkout y su video (0373). Se lee con `funnelDeFila`: es jsonb y puede faltar. */
  funnel?: unknown;
  visto_primera_vez: string;
  visto_ultima_vez: string;
  dejo_de_verse_en: string | null;
  texto_leido_en: string | null;
  metricas_leidas_en: string | null;
  /** Sólo Instagram: carrusel, imagen o video, y las láminas de un carrusel (mig 0391, lib/spy-medio.ts). Sin la columna, no viene. */
  medio?: Medio | null;
  laminas?: number | null;
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
  /** El formato de la pieza (POV, Storytime…: `FORMATOS`, lib/spy-detalle.ts). Vacío en lo analizado antes del 4/11/2026. */
  formato?: string;
};

const COLUMNAS_COMPETIDOR =
  'id, nombre, instagram, youtube_id, tiktok, landing_url, pagina_anuncios, pais, oferta, mirado_en, texto_leido_en, metricas_leidas_en, instagram_seguidores, youtube_suscriptores, avatar';

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
  // La caricatura que hizo el Runner (la cola: lib/spy-caricatura-cola.ts). Sin poder leerla, la tarjeta usa su foto: no es un error.
  const registro = leerRegistro(await getSetting(CLAVE_CARICATURAS).catch(() => null));
  const caricaturas = caricaturasListas(registro);
  const ahora = Date.now();
  return {
    ok: true,
    competidores: ((data ?? []) as Competidor[]).map((c) => ({
      ...c,
      caricatura: caricaturas.get(c.id) ?? null,
      caricaturaPendiente: caricaturaEnCamino(registro[String(c.id)], { avatar: c.avatar, referente: !!referenteDeCompetidor(c) }, ahora),
    })),
  };
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
 * Agrega un competidor con lo poco que se pegó. El `nombre` es del negocio y no se sobrescribe: si
 * sólo pegó un @, el nombre arranca siendo ese @ y después lo puede cambiar.
 *
 * `deLaBio` = el link que la persona tiene puesto en su bio de Instagram, tal como lo devolvió la
 * vista previa (`web`). Es la mitad GRATIS del pedido «con un dato, traer todas sus redes» (ítem 10,
 * 2/11/2026): **ya lo leímos y lo estábamos tirando a la basura al guardar.**
 *
 * ⚠️ POR QUÉ LLEGA DESDE LA PANTALLA Y NO SE LEE ACÁ: la vista previa YA pagó esa lectura de Apify
 * para mostrar quién es. Leer el perfil otra vez acá sería pagar dos veces por el mismo dato y
 * gastar del tope diario (`APIFY_TOPE_POR_DIA`), que es lo que deja al negocio sin poder agregar a
 * nadie el resto del día.
 *
 * ⚠️ Y SE CLASIFICA CON `queEs`, no con una expresión nueva: así un link de instagram.com en la bio
 * NO se guarda como landing (vuelve como `instagram`, que es a quien ya estamos agregando), un link
 * a su canal entra como `youtube_id` —que es justo «traer otra de sus redes»— y el tope de 500
 * caracteres ya está puesto. Un normalizador propio acá habría dejado pasar los dos primeros casos.
 */
export async function agregarCompetidor(pegado: string, nombrePedido?: string, deLaBio?: string | null): Promise<{ ok: true; competidor: Competidor } | { ok: false; error: string }> {
  const leido = queEs(pegado);
  if (!leido) return { ok: false, error: 'No reconocí eso. Pega el @ de Instagram, el enlace de su canal de YouTube o el de su sitio.' };
  // Del link de la bio sólo sirven los dos canales que no son el que ya estamos agregando. Un
  // `nombre` (texto que no es un link) se descarta: el nombre lo pone el negocio, no su bio.
  const extra = canalDeLaBio(deLaBio ? queEs(deLaBio) : null, leido.campo);
  // ⚠️ SI LO PEGADO ES ALGUIEN QUE YA TENEMOS DIBUJADO, SE GUARDA SU NOMBRE DE VERDAD. Martín,
  // 2/11/2026: «no pueden haber dos Alex Hormozi, no pueden haber dos Sofía Contreras». Pegar su
  // YouTube guardaba `UCxxxxxx` (el id del canal) y pegar su @ guardaba `alexhormozi`: dos nombres
  // distintos para la base, dos tarjetas para la persona. Con el nombre completo, la deduplicación
  // por nombre comparable de abajo los junta sola la próxima vez.
  const referente = referenteDeCompetidor(comoAQuienMira(leido));
  const nombre = (nombrePedido ?? '').trim().slice(0, TOPES.nombre)
    || (referente ? nombreDeReferente(referente) : '')
    || (leido.campo === 'nombre' ? leido.valor : leido.valor.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]);
  const db = await getTenantDb();
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
    || (leido.campo === 'tiktok' && x.tiktok === leido.valor)
    || (leido.campo === 'landing_url' && !!x.landing_url && dominioComparable(x.landing_url) === dominioComparable(leido.valor))
    || (!!buscado && nombreComparable(x.nombre) === buscado)
    // 3. el REFERENTE. Si lo pegado y el que ya está son la misma persona dibujada, son la misma
    //    persona, aunque sus nombres guardados no se parezcan en nada: así «UCxxxx» de su canal cae
    //    sobre la tarjeta que se creó con su @. Es lo que pidió Martín: «que esa data se cargue en
    //    ese que ya existía, no que se creen dos tarjetas diferentes».
    || (!!referente && referenteDeCompetidor(x) === referente)
  ));
  if (yaEsta) {
    // Sólo se escribe si el canal pegado FALTA. Nunca se pisa uno que ya estaba: el que está es
    // el que el negocio eligió, y pisarlo sería cambiarle el competidor sin avisar.
    const suma: Record<string, unknown> = {};
    if (leido.campo === 'instagram' && !yaEsta.instagram) suma.instagram = leido.valor;
    if (leido.campo === 'youtube_id' && !yaEsta.youtube_id) suma.youtube_id = leido.valor;
    if (leido.campo === 'tiktok' && !yaEsta.tiktok) suma.tiktok = leido.valor;
    if (leido.campo === 'landing_url' && !yaEsta.landing_url) suma.landing_url = leido.valor;
    // El link de la bio entra con la MISMA regla: sólo si ese canal falta. Volver a pegar un @ sobre
    // una ficha vieja le completa la landing que antes no se guardaba, y no pisa nada.
    if (extra?.campo === 'youtube_id' && !yaEsta.youtube_id) suma.youtube_id = extra.valor;
    if (extra?.campo === 'tiktok' && !yaEsta.tiktok) suma.tiktok = extra.valor;
    if (extra?.campo === 'landing_url' && !yaEsta.landing_url) suma.landing_url = extra.valor;
    if (!Object.keys(suma).length) return { ok: true, competidor: yaEsta };
    const r = await db.from('spy_competidores').update({ ...suma, updated_at: new Date().toISOString() })
      .eq('id', yaEsta.id).select(COLUMNAS_COMPETIDOR).maybeSingle();
    return r.data ? { ok: true, competidor: r.data as Competidor } : { ok: true, competidor: yaEsta };
  }

  // ⚠️ EL TOPE SE MIRA ACÁ, DESPUÉS DE BUSCAR EL DUPLICADO, y antes estaba arriba de todo. Con la
  // lista llena, pegar a alguien que YA ESTABA contestaba «ya tienes 25 competidores» en vez de
  // abrirlo — y volver a pegar al mismo es justamente lo que uno hace cuando la lista se llenó de
  // duplicados. El tope existe para que no entren veinticinco personas DISTINTAS, no para frenar
  // al que ya está adentro.
  //
  // Y de paso se fue una consulta: `existentes` ya es la lista entera, así que contar era pedir
  // lo mismo dos veces.
  if (existentes.length >= TOPES.competidores) {
    return { ok: false, error: `Ya tienes ${TOPES.competidores} competidores. Quita uno antes de agregar otro: la tab sirve para mirar pocos a fondo.` };
  }

  const fila: Record<string, unknown> = { nombre, updated_at: new Date().toISOString() };
  if (leido.campo !== 'nombre') fila[leido.campo] = leido.valor;
  if (extra) fila[extra.campo] = extra.valor;
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
  // Su oferta (lib/spy-oferta.ts) vive en una clave aparte y se va con él. Si no se puede, queda una clave huérfana que
  // nadie lee: no frena el «Dejar de mirarlo».
  await borrarSetting(claveOfertaSpy(id)).catch((e) => console.warn(`[spy] no pude borrar la oferta del competidor ${id}:`, e instanceof Error ? e.message : e));
  await borrarSetting(claveLectura(id)).catch(() => undefined);
  // Y los guiones de sus reels (lib/spy-transcripcion.ts), por su prefijo.
  await borrarSettingsConPrefijo(prefijoTranscripciones(id)).catch((e) => console.warn(`[spy] no pude borrar los guiones del competidor ${id}:`, e instanceof Error ? e.message : e));
  return { ok: true };
}

/**
 * De qué país es (ISO-2), o `null` para borrarlo. Lo pregunta la ficha, y hoy es el ÚNICO que escribe `spy_competidores.pais`:
 * desde que la columna existe (migración 0359) llegaba siempre `null`, así que `adLibraryCubreComercial` nunca decía nada y el
 * enlace a la Biblioteca iba con `country=ALL`.
 *
 * ⚠️ Se valida contra `PAISES` ANTES de escribir: la columna tiene un `check` de dos letras, y un valor cualquiera no vuelve
 * como «no válido» sino como un error de Postgres en medio de una acción.
 */
export async function ponerPais(id: number, pais: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const iso = pais === null ? null : pais.trim().toUpperCase();
  if (iso !== null && !esPaisConocido(iso)) return { ok: false, error: 'No conozco ese país.' };
  const db = await getTenantDb();
  const { error } = await db.from('spy_competidores').update({ pais: iso, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, error: sinTabla(error) ? AUN_SIN_TABLAS : `No pude guardar su país: ${error.message}` };
  return { ok: true };
}

/**
 * Le saca UN canal a un competidor: lo que deshace «Sumé su YouTube» cuando no era de él (4/11/2026). Se borran también
 * las piezas que se leyeron de ese canal: si no, la ficha seguiría mostrando videos de otra persona.
 */
export async function quitarCanal(id: number, red: 'instagram' | 'youtube' | 'tiktok'): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getTenantDb();
  const campo = red === 'youtube' ? 'youtube_id' : red;
  const { error } = await db.from('spy_competidores').update({ [campo]: null, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, error: sinTabla(error) ? AUN_SIN_TABLAS : `No pude sacarlo: ${error.message}` };
  if (red !== 'tiktok') {
    const { error: e2 } = await db.from('spy_piezas').delete().eq('competidor_id', id).eq('canal', red);
    if (e2) return { ok: false, error: `Saqué el canal, pero no sus piezas: ${e2.message}` };
    // Los guiones son de sus reels de Instagram: se van con ellos.
    if (red === 'instagram') await borrarSettingsConPrefijo(prefijoTranscripciones(id)).catch(() => {});
  }
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
/**
 * Cuántas piezas de un competidor se leen como mucho. Eran 200 (un `.limit`), y desde que se trae TODO (punto 8 del
 * 4/11/2026: cientos de reels y videos) eso cortaba en silencio. Se pagina de a 1000 (el techo de PostgREST) hasta acá.
 */
export const PIEZAS_POR_COMPETIDOR = 2000;

export async function listarPiezas(competidorId: number, canal?: CanalSpy): Promise<Pieza[]> {
  const db = await getTenantDb();
  const filas: Record<string, unknown>[] = [];
  try {
    // ⚠️ Paginado por `id`, que es único: con `visto_ultima_vez` (se repite en toda una lectura) las páginas se pisan.
    await leerPorPaginas<Record<string, unknown>>(db, 'spy_piezas', '*', (pagina) => {
      filas.push(...pagina);
      return filas.length < PIEZAS_POR_COMPETIDOR;
    }, { orden: 'id', filtros: (q) => (canal ? q.eq('competidor_id', competidorId).eq('canal', canal) : q.eq('competidor_id', competidorId)) });
  } catch {
    return [];
  }
  // El orden de antes, en memoria: lo último visto primero.
  filas.sort((a, b) => String(b.visto_ultima_vez ?? '').localeCompare(String(a.visto_ultima_vez ?? '')));
  // Con la flecha: `map` le pasaría el índice como la fecha de `ahora`.
  return filas.slice(0, PIEZAS_POR_COMPETIDOR).map((fila) => podarVencido(fila)) as Pieza[];
}

/**
 * Una pieza por su id, con su competidor. `null` si no es de este negocio (el proxy ya scopea por workspace) o si no se
 * pudo leer: «Copiar estructura» no copia lo que no pudo leer.
 */
export async function leerPieza(id: number): Promise<{ pieza: Pieza; competidor: Competidor } | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('spy_piezas').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const pieza = podarVencido(data as Record<string, unknown>) as Pieza;
  const competidor = await leerCompetidor(pieza.competidor_id);
  return competidor ? { pieza, competidor } : null;
}

/**
 * Pone la web que encontró la cadena de sus redes (lib/spy-cadena.ts), si no tenía o si la que tenía era su página de
 * enlaces (beacons, linktree…). Nunca pisa una web que eligió el negocio: compare-and-set sobre lo que había. true si la puso.
 */
export async function ponerWebEncontrada(id: number, web: string): Promise<boolean> {
  const c = await leerCompetidor(id);
  if (!c || (c.landing_url && !esAgregador(c.landing_url))) return false;
  const db = await getTenantDb();
  const q = db.from('spy_competidores').update({ landing_url: web.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', id);
  const r = await (c.landing_url ? q.eq('landing_url', c.landing_url) : q.is('landing_url', null)).select('id');
  return !r.error && (r.data?.length ?? 0) > 0;
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
  /** La fecha en que la FUENTE dice que terminó (un anuncio inactivo de la Biblioteca). No es «no vino en esta lectura». */
  dejoDeVerseEn?: string | null;
  /** Instagram y anuncios: si es carrusel, imagen o video, y (Instagram) sus láminas (lib/spy-medio.ts). Se escribe aparte (`guardarMedios`). */
  medio?: Medio | null;
  laminas?: number | null;
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
  // Se trae también la `miniatura` guardada: sin eso se volvería a bajar la MISMA imagen en cada
  // lectura (ver abajo, donde se arma `yaBajada`).
  const { data: yaEstaban, error: errLeer } = await db.from('spy_piezas').select('ref, canal, miniatura').eq('competidor_id', competidorId).in('canal', canales);
  if (errLeer) return { nuevas: 0, actualizadas: 0, error: sinTabla(errLeer) ? AUN_SIN_TABLAS : errLeer.message };
  const conocidas = new Set((yaEstaban ?? []).map((r) => `${(r as { canal: string }).canal}|${(r as { ref: string }).ref}`));

  /**
   * La miniatura que YA bajamos de una pieza, si la bajamos.
   *
   * ⚠️ SIN ESTO SE VUELVE A BAJAR TODO EN CADA LECTURA. Lo que llega de la API es siempre la URL
   * FRESCA del CDN, nunca la nuestra, así que `esNuestra` da false y el bajador empezaría de cero
   * cada vez: el presupuesto de 9 s se gastaría siempre en las mismas imágenes y nunca llegaría a
   * las que faltan. Con esto, una lectura sólo paga por lo que todavía no tiene, y las que quedan
   * afuera por presupuesto entran en la siguiente — que es lo que hace que converja.
   */
  const yaBajada = new Map<string, string>();
  for (const r of (yaEstaban ?? []) as Array<{ canal: string; ref: string; miniatura: string | null }>) {
    if (esNuestra(r.miniatura)) yaBajada.set(`${r.canal}|${r.ref}`, r.miniatura as string);
  }

  // Las dos clases de dato llevan RELOJES DISTINTOS, y por eso se escriben en columnas distintas:
  // el texto se borra a los 30 días y las métricas duran hasta 36 meses con la enmienda III.L.
  // ⚠️ LA MINIATURA SE BAJA ANTES DE GUARDAR. La URL del CDN de la fuente vence Y, en el caso de
  // Meta, devuelve 403 a todo pedido que venga de otro dominio: guardar la URL era guardar algo
  // que después no se iba a poder ver. `guardarMiniaturas` NUNCA tira — si una imagen no se puede
  // bajar deja la URL original y la pieza se guarda igual, porque perder el competidor entero por
  // una imagen sería cambiar un problema chico por uno grande. Ver lib/spy-miniaturas.ts y la 0361.
  const conFoto = await guardarMiniaturas(vistas.map((v) => {
    const nuestra = yaBajada.get(`${v.canal}|${v.ref}`);
    return nuestra ? { ...v, miniatura: nuestra } : v;
  }));

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
    dejo_de_verse_en: v.dejoDeVerseEn ?? null,
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
  // Carrusel, imagen o video, y sus láminas: APARTE del upsert (lib/spy-medio.ts), que no puede fallar por una columna nueva.
  if (!err) await guardarMedios(competidorId, conFoto);
  return { nuevas: nuevas.length, actualizadas: viejas.length, error: err };
}

/** La 0391 sin aplicar se dice UNA vez por proceso: no es un error del negocio, y el explorador de carruseles vive sin ella. */
let medioSinColumna = false;

/**
 * Escribe si cada publicación de Instagram (o cada anuncio, desde el 6/11/2026) es un carrusel, una imagen o un video, y las
 * láminas de un carrusel (mig 0391).
 * Un update por grupo, nunca uno por pieza. NUNCA tira y nunca hace fallar la lectura: es un dato de más. Sin la columna,
 * deja de intentar hasta el próximo arranque.
 */
async function guardarMedios(competidorId: number, vistas: readonly PiezaVista[]): Promise<void> {
  if (medioSinColumna) return;
  const grupos = gruposDeMedio(vistas);
  if (!grupos.length) return;
  const db = await getTenantDb();
  for (const g of grupos) {
    const r = await db.from('spy_piezas').update({ medio: g.medio, laminas: g.laminas })
      .eq('competidor_id', competidorId).eq('canal', g.canal).in('ref', g.refs);
    if (r.error) {
      if (faltaLaColumnaDeMedio(r.error)) { medioSinColumna = true; console.warn('[spy] la 0391 (medio, láminas) todavía no está aplicada'); return; }
      console.warn('[spy] no pude guardar el medio:', r.error.message);
    }
  }
}

/**
 * Marca como «ya no se ve» lo que estaba y esta vez no vino. **Se llama SÓLO después de una lectura
 * buena**, y nunca con una lista vacía: con las piezas vacías de un timeout, esto convertiría «no
 * pude leer» en «lo bajó todo» y la línea de tiempo diría que el competidor dejó de publicar.
 */
/** Una publicación de Instagram (de Meta o de Apify) como la guarda Spy. La usan la lectura de siempre y la corrida larga. */
export function vistaDeInstagram(p: PiezaInstagram): PiezaVista {
  return {
    canal: 'instagram' as const,
    tipo: (p.formato === 'REELS' ? 'reel' : 'publicacion') as TipoPieza,
    ref: p.ref, fuente: 'api' as const, url: p.permalink, texto: p.texto,
    vistas: p.vistas, megusta: p.megusta, comentarios: p.comentarios,
    publicadaEn: p.fecha || null,
    // ⚠️ ACÁ SE PERDÍAN LOS VIDEOS DE IG. `leerPerfilInstagram` ya devolvía la miniatura
    // (`thumbnail_url`, lib/instagram-perfil.ts) y este mapeo no la copiaba, así que un reel
    // llegaba a la grilla como texto con números en vez de como un video que se ve.
    miniatura: p.miniatura,
    // Carrusel, imagen o video (lib/spy-medio.ts): lo decía la fuente y se perdía al guardar.
    medio: medioDeInstagram(p.tipo),
    laminas: medioDeInstagram(p.tipo) === 'carrusel' ? p.laminas ?? null : null,
  };
}

export async function marcarDejadas(competidorId: number, canal: CanalSpy, leidas: ReadonlyArray<{ ref: string; publicadaEn?: string | null }>): Promise<void> {
  if (!leidas.length) return;
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  const { data, error } = await db.from('spy_piezas').select('id, ref, publicada_en').eq('competidor_id', competidorId).eq('canal', canal).is('dejo_de_verse_en', null).limit(5000);
  // No poder leer no es «se fueron todas».
  if (error) return;
  // Sólo lo que esta lectura podía ver (`seFueron`, lib/spy-todo-reglas.ts): lo más viejo que lo que trajo no se marca.
  const idsQueSeFueron = seFueron((data ?? []) as Array<{ id: number; ref: string; publicada_en: string | null }>, leidas);
  if (!idsQueSeFueron.length) return;
  await db.from('spy_piezas').update({ dejo_de_verse_en: ahora, updated_at: ahora }).in('id', idsQueSeFueron);
}

/**
 * Escribe lo que vio UN lector en la fila de esa página, sin tocar lo que vio el otro (lib/spy-funnel.ts).
 *
 * ⚠️ VA APARTE DE `guardarVistas` Y NO TIRA. La columna la agrega la 0373: si el código llega antes que
 * ella, un upsert con `funnel` adentro haría fallar la lectura entera de la landing, y esto es un dato
 * más, no una razón para perder las piezas. La pantalla lo tolera igual: `listarPiezas` pide `*`.
 */
export async function guardarFunnel(competidorId: number, ref: string, lector: keyof Funnel, lectura: LecturaFunnel): Promise<void> {
  const db = await getTenantDb();
  const clave = ref.slice(0, TOPES.ref);
  const { data, error } = await db.from('spy_piezas').select('funnel').eq('competidor_id', competidorId).eq('canal', 'landing').eq('ref', clave).maybeSingle();
  if (error) { console.warn('[spy] no pude leer el funnel:', error.message); return; }
  if (!data) return;
  const r = await db.from('spy_piezas')
    .update({ funnel: conLectura(funnelDeFila((data as { funnel?: unknown }).funnel), lector, lectura) })
    .eq('competidor_id', competidorId).eq('canal', 'landing').eq('ref', clave);
  if (r.error) console.warn('[spy] no pude guardar el funnel:', r.error.message);
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
/**
 * `motivo` decide si sirve la lectura que YA pagó otro negocio (`lib/spy-compartido.ts`).
 *
 * ⚠️ EL DEFAULT ES `'a-pedido'`, QUE NUNCA USA LA CACHÉ, y es a propósito: quien no dice para qué
 * está leyendo se lleva datos frescos. Equivocarse hacia «leer de más» cuesta un crédito;
 * equivocarse hacia «servir lo de otro» le muestra a alguien datos viejos creyendo que son de hoy.
 */
export async function mirarCompetidor(
  competidorId: number,
  motivo: MotivoDeLectura = 'a-pedido',
  /** Antes de cada canal: lo que la pantalla del alta muestra como «Mirando su Instagram…» (lib/spy-lectura-pasos.ts). Nunca tira. */
  alPaso?: (paso: PasoLectura) => Promise<void>,
  /**
   * Sólo estos canales (4/11/2026, Leila Hormozi en producción). Cuando se le SUMA un canal (su YouTube, encontrado solo), se
   * lee ESE canal y nada más. Antes se releía todo, Instagram por Apify incluido: la lectura pasaba los 60 s de la acción, se
   * cortaba antes de llegar a YouTube y el canal quedaba sumado sin un video («como si hubiese apretado en deshacer»).
   * Una web que aparece en la descripción del canal nuevo también se lee: es nueva. Sin esto, todos.
   */
  solo?: readonly PasoLectura[],
): Promise<{ ok: boolean; canales: LecturaCanalSpy[]; error?: string }> {
  const paso = (p: PasoLectura) => (alPaso ? alPaso(p).catch(() => undefined) : Promise.resolve());
  const lee = (p: PasoLectura) => leeCanal(solo, p);
  const c = await leerCompetidor(competidorId);
  if (!c) return { ok: false, canales: [], error: 'No encontré ese competidor.' };
  const canales: LecturaCanalSpy[] = [];
  const ahora = new Date().toISOString();
  let seguidores: number | null = c.instagram_seguidores;
  let cara: string | null = c.avatar;
  let suscriptores: number | null = c.youtube_suscriptores;
  let landing: string | null = c.landing_url;
  let landingNueva = false;

  // ── Instagram: Business Discovery con el juego ancho de campos ──────────────
  if (c.instagram && lee('instagram')) {
    await paso('instagram');
    // ⚠️ ANTES DE PAGAR, ¿YA LO LEYÓ OTRO? (ítem 13, 2/11/2026). Una lectura de Instagram gasta del
    // tope diario de Apify del negocio, y el resultado es el MISMO para cualquiera porque el canal
    // es público. Con `'alta'` sirve hasta 24 h; con «Revisar ahora» (`'a-pedido'`) NUNCA, por
    // fresca que esté: quien toca ese botón pide datos de hoy.
    const yaLeida = motivo === 'a-pedido' ? null : await lecturaCompartida('instagram', c.instagram);
    if (yaLeida && sirveLaCompartida(motivo, yaLeida.leidoEn, Date.now())) {
      const vistas = yaLeida.piezas as PiezaVista[];
      const g = await guardarVistas(competidorId, vistas);
      void anotarAhorro('instagram', c.instagram);
      const p = yaLeida.perfil ?? {};
      if (typeof p.seguidores === 'number') seguidores = p.seguidores;
      canales.push({
        canal: 'instagram', ok: !g.error, piezas: vistas.length, nuevas: g.nuevas,
        detalle: g.error ?? `${vistas.length} publicaciones (de una lectura de hace poco, sin gastar una nueva)`,
      });
    } else {
    // ⚠️ CON EL NEGOCIO (1/11/2026): sin `ws`, la función no podía usar la Meta del cliente ni su clave, y leía siempre con la de la plataforma.
    const l = await leerPerfilInstagram(c.instagram, { ws: await getWorkspaceActual(), conPiezas: true, fuentes: ['meta-negocio', 'meta-plataforma', 'apify-spy'], variasClaves: true });
    if (!l.ok) {
      canales.push({ canal: 'instagram', ok: false, piezas: 0, nuevas: 0, detalle: `No pude leer @${c.instagram}: ${detalleDeInstagram(l.motivo, l.detalle)}` });
    } else {
      seguidores = l.perfil.seguidores;
      // Su sitio, si lo tiene en la bio y todavía no se le cargó uno (Martín, 4/11: «Si encuentra la web, que la analice
      // automáticamente»). Un Linktree o un acortador no cuentan (`sitioDelTexto`).
      if (!landing) {
        const sitio = sitioDelTexto([l.perfil.web, l.perfil.bio].filter(Boolean).join(' '));
        if (sitio) { landing = sitio; landingNueva = true; }
      }
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
        const vistas: PiezaVista[] = piezas.map(vistaDeInstagram);
        const g = await guardarVistas(competidorId, vistas);
        if (vistas.length) await marcarDejadas(competidorId, 'instagram', vistas);
        // Se guarda para que el PRÓXIMO negocio no la pague. No se espera: si falla, este negocio
        // ya tiene sus piezas y lo único que se pierde es el ahorro del siguiente.
        // Con su bio y su web (4/11/2026): la cadena de sus otras redes las lee de acá y no paga otra lectura (lib/spy-cadena.ts).
        void guardarLecturaCompartida('instagram', c.instagram, vistas, { seguidores: l.perfil.seguidores ?? null, bio: l.perfil.bio ?? '', web: l.perfil.web ?? null });
        canales.push({ canal: 'instagram', ok: !g.error, piezas: vistas.length, nuevas: g.nuevas, detalle: g.error ?? `${vistas.length} publicaciones` });
      }
      }
    }
  }

  // ── YouTube: channels.list → playlist de subidas → playlistItems → videos.list ───
  if (c.youtube_id && lee('youtube')) {
    await paso('youtube');
    // La misma caché compartida que Instagram (ítem 13). Acá no se ahorra PLATA del negocio sino
    // CUOTA de la API de YouTube, que es de la plataforma y es igual de finita: leer el canal de
    // Hormozi una vez por negocio la agota igual.
    const yaYt = motivo === 'a-pedido' ? null : await lecturaCompartida('youtube', c.youtube_id);
    const clave = await claveDeYoutube();
    if (yaYt && sirveLaCompartida(motivo, yaYt.leidoEn, Date.now())) {
      const vistas = yaYt.piezas as PiezaVista[];
      const g = await guardarVistas(competidorId, vistas);
      void anotarAhorro('youtube', c.youtube_id);
      const p = yaYt.perfil ?? {};
      if (typeof p.suscriptores === 'number') suscriptores = p.suscriptores;
      canales.push({
        canal: 'youtube', ok: !g.error, piezas: vistas.length, nuevas: g.nuevas,
        detalle: g.error ?? `${vistas.length} videos (de una lectura de hace poco, sin gastar cuota)`,
      });
    } else if (!clave) {
      canales.push({ canal: 'youtube', ok: false, piezas: 0, nuevas: 0, detalle: noPudeLeerCanal('sin-clave') });
    } else {
      const apunta = c.youtube_id.startsWith('@') ? { handle: c.youtube_id.slice(1) }
        : c.youtube_id.startsWith('user:') ? { usuario: c.youtube_id.slice(5) }
        : { id: c.youtube_id };
      // Completa (500 videos) la primera vez, o mientras tenga pocos guardados; después, la corta (punto 8 del 4/11).
      const { count: guardados } = await (await getTenantDb()).from('spy_piezas').select('id', { count: 'exact', head: true })
        .eq('competidor_id', competidorId).eq('canal', 'youtube');
      const completa = leerCompleto(guardados ?? 0);
      const l = await traerVideosDelCanal(apunta, clave, fetch, completa ? VIDEOS_POR_LECTURA_COMPLETA : TOPES.piezasPorVuelta, completa);
      if (!l.ok) {
        canales.push({ canal: 'youtube', ok: false, piezas: 0, nuevas: 0, detalle: noPudeLeerCanal(l.motivo) });
      } else {
        suscriptores = l.canal.suscriptores;
        // ⚠️ Y SU SITIO SALE DE LA DESCRIPCIÓN DE SU CANAL si no lo tenía (4/11/2026; Martín: «Si encuentra la web, que la
        // analice automáticamente»). Se lee en esta misma vuelta, más abajo.
        if (!landing) {
          const sitio = sitioDelTexto(l.canal.descripcion);
          if (sitio) { landing = sitio; landingNueva = true; }
        }
        // ⚠️ SU CARA TAMBIÉN SALE DE YOUTUBE (4/11/2026). Un competidor que se agregó por su canal quedaba sin foto —
        // Martín: «le pongo el link de su canal y no me trae la foto»— y la foto venía en la misma respuesta. Gana la de
        // Instagram si la hay: es la que la persona reconoce. Se baja al bucket, como la de Instagram.
        if (l.canal.foto && (!c.instagram || !cara)) {
          const [bajada] = await guardarMiniaturas([{ canal: 'avatar', ref: c.youtube_id, miniatura: l.canal.foto }]);
          if (esNuestra(bajada.miniatura)) cara = bajada.miniatura ?? cara;
        }
        const vistas: PiezaVista[] = l.videos.map((v) => ({
          canal: 'youtube' as const, tipo: 'video' as const, ref: v.id, fuente: 'api' as const,
          url: `https://www.youtube.com/watch?v=${v.id}`,
          titulo: v.titulo, texto: v.descripcion, etiquetas: v.etiquetas,
          vistas: v.vistas, megusta: v.megusta, comentarios: v.comentarios,
          duracion: v.duracion, publicadaEn: v.publicadoEn || null,
          // ⚠️ LA MINIATURA DE YOUTUBE TAMBIÉN SE GUARDA, y hasta el 2/11/2026 no se guardaba: se
          // derivaba del id al dibujar (`miniaturaDePieza`) y nunca se bajaba. Para VERLA alcanzaba
          // —la URL de YouTube no vence ni bloquea—, pero Martín la quiere archivada por otro
          // motivo: «que eso también pueda servir de referencia para crear miniaturas luego para
          // los propios usuarios de MaKo». Una URL ajena no es material de referencia; un archivo
          // sí. `guardarMiniaturas` la baja una sola vez y después `yaBajada` no la vuelve a pedir.
          // Se usa la que YouTube dio —la de mayor resolución que haya— y no una armada a mano.
          miniatura: v.miniatura || `https://i.ytimg.com/vi/${encodeURIComponent(v.id)}/hqdefault.jpg`,
        }));
        const g = await guardarVistas(competidorId, vistas);
        if (vistas.length) await marcarDejadas(competidorId, 'youtube', vistas);
        // Para que el próximo negocio que mire este canal no gaste cuota. No se espera.
        void guardarLecturaCompartida('youtube', c.youtube_id, vistas, { suscriptores: l.canal.suscriptores ?? null });
        canales.push({ canal: 'youtube', ok: !g.error, piezas: vistas.length, nuevas: g.nuevas, detalle: g.error ?? `${vistas.length} videos` });
      }
    }
  }

  // ── La landing: lo que ya hace `mirarLanding`, apuntado a una página ajena ──
  if (landing && (lee('web') || landingNueva)) {
    await paso('web');
    try {
      // Se llena mientras se lee. El HTML no vuelve en `m` porque esa respuesta también viaja a la
      // pantalla del Pixel, que no tiene por qué llevar 2 MB de una página.
      const crudo: { html?: string; bundle?: string } = {};
      const m = await mirarLanding(landing, undefined, (html, bundle) => { crudo.html = html; crudo.bundle = bundle; });
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
          canal: 'landing' as const, tipo: 'landing' as const, ref: landing, fuente: 'pagina' as const,
          url: landing,
          titulo: hostDe(landing),
          etiquetas: piezas.length ? piezas : null,
        }];
        const g = await guardarVistas(competidorId, vistas);
        if (!g.error && crudo.html != null) await guardarFunnel(competidorId, landing, 'pagina', leerFunnel({ html: crudo.html, bundle: crudo.bundle, piezas }));
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
    // Una lectura de UN canal no dice que el resto esté fresco: las fechas sólo las mueve una lectura entera (o la primera).
    ...(!solo || !c.mirado_en ? { mirado_en: ahora, texto_leido_en: ahora, metricas_leidas_en: ahora } : {}),
    instagram_seguidores: seguidores, youtube_suscriptores: suscriptores, avatar: cara, updated_at: ahora,
    ...(landingNueva ? { landing_url: landing } : {}),
  }).eq('id', competidorId);
  // ⚠️ SU CARICATURA ENTRA A LA COLA AL LEERLO (4/11/2026; Martín: «cada vez que se genere un nuevo competidor, hacer
  // una especie de levantar un ticket para generar esa imagen»): con su foto ya en NUESTRO Storage, sin IA y sin gastar
  // nada. La hace el Runner con Canva (lib/spy-caricatura-cola.ts). Si la misma persona ya la tiene, se usa esa.
  const wsDeLaLectura = await getWorkspaceActual();
  if (wsDeLaLectura != null) await encolarAlLeer(wsDeLaLectura, c, cara);
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

FORMATOS (uno por pieza: lo que la pieza CUENTA, no cómo está filmada):
{{formatosQueSon}}

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
    { "ref": "el ref tal como vino", "gancho": "con qué abre, en sus palabras", "tipoGancho": "{{tiposGancho}}", "angulo": "el ángulo en una o dos palabras", "formato": "{{formatos}} (por el título y la descripción; si no se ve, otro)", "etiquetas": ["de esta lista: {{etiquetas}}"] }
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
      formato: formatoDe(p.formato),
      etiquetas: (Array.isArray(p.etiquetas) ? p.etiquetas : []).map((t) => txt(t, 40)).filter((t) => (TAG_VOCAB as readonly string[]).includes(t)).slice(0, 6),
    })).filter((p) => p.ref),
  };
}

/**
 * Analiza a un competidor con lo que ya está guardado, con la IA DEL NEGOCIO.
 *
 * ⚠️ NUNCA CON LA DE MAKO (4/11/2026: «cada negocio paga la suya, y el crédito de Claude de la plataforma no se usa
 * acá»). Antes, sin la clave de Claude del negocio, caía a `chatClaude` —la de la plataforma, que el veto igual frenaba
 * porque `spy` no está en `CLAUDE_PERMITIDO`—. Ahora es `chatCheapCascade`: su Claude primero y después su GPT o su
 * Gemini. Sin ninguna, `sinIA: true` y la pantalla muestra lo que ya tiene, sin «Analizando».
 *
 * `soloPendientes` (lo que usa el análisis automático): sólo las piezas que la IA todavía no leyó, de a
 * `PIEZAS_POR_ANALISIS`, las de más vistas primero. Sin él (el menú «Qué vende y qué ataca» y la API), las primeras 40.
 *
 * No tira nunca: devuelve `{ ok: false, error }`, porque quien llama es una ruta en segundo plano o un runner de la API.
 */
export async function analizarCompetidor(
  competidorId: number,
  queVendeElNegocio: string,
  opts: { soloPendientes?: boolean } = {},
): Promise<{ ok: true; analisis: Analisis; leidas: number } | { ok: false; error: string; falla?: true; sinIA?: true }> {
  const c = await leerCompetidor(competidorId);
  if (!c) return { ok: false, error: 'No encontré ese competidor.' };
  const todas = await listarPiezas(competidorId);
  if (!todas.length) return { ok: false, error: 'Todavía no hay nada leído de ese competidor. Míralo primero.' };
  const piezas = opts.soloPendientes ? pendientesDeAnalisis(todas) : todas.slice(0, 40);
  if (!piezas.length) return { ok: true, analisis: { oferta: c.oferta ?? { promete: '', aQuien: '', precio: null, objecion: '', huecos: [] }, piezas: [] }, leidas: 0 };
  const comoTexto = piezas.map((p) => {
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
      formatos: FORMATOS.map((f) => f.value).join('|'),
      formatosQueSon: GUIA_DE_FORMATOS,
    });
    const user = await renderPrompt('spy.analisis.user', SPY_ANALISIS_USER_TEMPLATE, {
      competidor: c.nombre,
      negocio: contenidoNoConfiable(queVendeElNegocio || '(sin oferta cargada)', 'oferta_del_negocio'),
      // Todo lo del competidor es contenido de un tercero: va marcado para que el modelo no lo lea
      // como una instrucción. El copy de un anuncio puede decir cualquier cosa.
      piezas: contenidoNoConfiable(comoTexto, 'piezas_del_competidor'),
    });
    const errores: string[] = [];
    // `pii: false`: lo que se manda es contenido PÚBLICO de un tercero y la oferta del propio negocio, no datos de sus
    // clientes.
    const texto = await chatCheapCascade({
      system, user, json: true, maxTokens: 4000, feature: 'spy', motivo: 'Analizar a un competidor', timeoutMs: 90_000,
      erroresOut: errores, pii: false,
    });
    if (!texto.trim()) {
      return errores.length
        ? { ok: false, error: 'Tu IA no pudo analizar al competidor ahora. Vuelve a intentar en un rato.', falla: true }
        : { ok: false, error: 'Conecta tu Claude, tu GPT o tu Gemini para que MaKo analice sus piezas.', sinIA: true };
    }
    const analisis = leerAnalisis(objetoJson(texto));
    await guardarAnalisis(competidorId, analisis, piezas.map((p) => p.ref), c.oferta);
    return { ok: true, analisis, leidas: piezas.length };
  } catch (e) {
    return { ok: false, error: `No pude analizar al competidor: ${msg(e)}`, falla: true };
  }
}

/**
 * Guarda la oferta en el competidor y el análisis en cada pieza, con el reloj del TEXTO.
 *
 * ⚠️ El ref que devuelve la IA se busca entre los ENVIADOS sin mayúsculas: un modelo que lo reescribe en minúsculas no
 * encuentra la fila con `.eq('ref', …)` y la pieza queda pendiente para siempre. Lo que se mandó y no volvió se marca
 * leído sin datos (`ANALISIS_SIN_DATOS`), por la misma razón.
 */
async function guardarAnalisis(competidorId: number, a: Analisis, enviadas: readonly string[], ofertaAnterior: OfertaLeida | null): Promise<void> {
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  const oferta = ofertaQueQueda(a.oferta, ofertaAnterior);
  await db.from('spy_competidores').update({ ...(oferta ? { oferta } : {}), texto_leido_en: ahora, updated_at: ahora }).eq('id', competidorId);
  const original = new Map(enviadas.map((r) => [r.trim().toLowerCase(), r]));
  for (const p of a.piezas) {
    const ref = original.get(p.ref.trim().toLowerCase());
    if (!ref) continue;
    await db.from('spy_piezas')
      .update({ analisis: { gancho: p.gancho, tipoGancho: p.tipoGancho, angulo: p.angulo, etiquetas: p.etiquetas, formato: p.formato || 'otro' }, texto_leido_en: ahora, updated_at: ahora })
      .eq('competidor_id', competidorId).eq('ref', ref);
  }
  const faltan = refsSinRespuesta(enviadas, a.piezas.map((p) => p.ref));
  if (faltan.length) {
    await db.from('spy_piezas').update({ analisis: ANALISIS_SIN_DATOS, texto_leido_en: ahora, updated_at: ahora })
      .eq('competidor_id', competidorId).in('ref', faltan).is('analisis', null);
  }
}

/**
 * Las instrucciones del analista, tal como quedaron después de la edición del negocio. Lo usa
 * /configuraciones para mostrar el texto vigente.
 */
export const leerSystemDelSpy = (): Promise<string> => getPromptText('spy.analisis.system', SPY_ANALISIS_SYSTEM_TEMPLATE);
