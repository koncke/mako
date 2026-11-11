// =============================================================================
// spy-sugeridos — los competidores de la PLATAFORMA, sugeridos en todos los negocios (4/11/2026)
// =============================================================================
// Pedido de Martín (por el Cerebro, 4/11): los competidores que carga el negocio de la plataforma aparecen en TODOS los
// negocios como un catálogo «Sugeridos», sin cobrarle al cliente; el cliente los suma a su lista, sin duplicarlos, y
// siguen en el catálogo.
//
// ⚠️ SÓLO LOS DE LA PLATAFORMA, NUNCA LOS DE OTRO CLIENTE. A quién mira un cliente es suyo y no sale de su negocio
// (docs/hallazgos-competitors-spy.md, «son DOS permisos»). La plataforma se resuelve por CAPA (`wsSuperAdmin`), nunca
// por número, y cada fila se vuelve a mirar contra ese negocio (`soloDeLaPlataforma`): una consulta mal filtrada no
// alcanza para que se cuele una fila ajena.
//
// ⚠️ SIN COBRARLE: agregarlo COPIA lo que la plataforma ya leyó (sus publicaciones, su foto, sus números); no se le pide
// nada a Apify ni a YouTube con la clave del cliente. Después, lo nuevo sigue las reglas de siempre (la lectura
// compartida primero, `lib/spy-compartido.ts`).
//
// ⚠️ LOS ANUNCIOS NO SE COPIAN: lo que se trajo de la Biblioteca de Anuncios no se le pasa a un tercero (los términos de
// Meta no dejan transferir lo recolectado). Sus anuncios, el cliente los trae con su propia lectura. Tampoco viaja lo que
// la plataforma concluyó de él (`oferta`): está escrito contra el negocio de la plataforma, no contra el del cliente.
//
// Sin `server-only`, a propósito: lo que habla con la base entra por `deps` (lib/spy-sugeridos-server.ts), así el test
// corre esto mismo con dobles de varios negocios.
// =============================================================================

import { caricaturaDeCompetidor, referenteDeCompetidor } from './spy-caricatura';
import { caraDeTarjeta } from './spy-caricatura-reglas';
import { dominioComparable, nombreComparable, type CanalSpy } from './spy-reglas';

/** Un competidor como lo guarda la base, con su negocio. */
export type FilaCompetidor = {
  id: number;
  workspace_id: number;
  nombre: string;
  instagram: string | null;
  youtube_id: string | null;
  tiktok: string | null;
  landing_url: string | null;
  avatar: string | null;
  instagram_seguidores: number | null;
  youtube_suscriptores: number | null;
};

/** Lo que se muestra de un sugerido: quién es y dónde está. Nada de lo que la plataforma concluyó de él. */
export type Sugerido = {
  id: number;
  nombre: string;
  instagram: string | null;
  youtube_id: string | null;
  tiktok: string | null;
  landing_url: string | null;
  cara: string | null;
  seguidores: number | null;
  suscriptores: number | null;
};

/** Una pieza como la guarda la base (lo que hace falta para copiarla). */
export type FilaPieza = {
  canal: CanalSpy;
  tipo: string;
  ref: string;
  fuente: string;
  url: string | null;
  titulo: string | null;
  texto: string | null;
  etiquetas: string[] | null;
  vistas: number | null;
  megusta: number | null;
  comentarios: number | null;
  duracion: string | null;
  publicada_en: string | null;
  miniatura: string | null;
  dejo_de_verse_en: string | null;
};

/** Lo que se le pasa a `guardarVistas` (lib/spy.ts). */
export type PiezaCopiada = {
  canal: CanalSpy; tipo: string; ref: string; fuente: string;
  url: string | null; titulo: string | null; texto: string | null; etiquetas: string[] | null;
  vistas: number | null; megusta: number | null; comentarios: number | null; duracion: string | null;
  publicadaEn: string | null; miniatura: string | null;
};

/** Lo que identifica a una persona, para no sugerirle a alguien que ya mira ni crearle un duplicado. */
type Identidad = { nombre?: string | null; instagram?: string | null; youtube_id?: string | null; tiktok?: string | null; landing_url?: string | null };

/**
 * ¿Son la misma persona? Las mismas reglas con que `agregarCompetidor` (lib/spy.ts) junta duplicados: el mismo canal,
 * el mismo sitio, el mismo nombre comparable o el mismo referente dibujado.
 */
export function esLaMismaPersona(a: Identidad, b: Identidad): boolean {
  const ig = (x: Identidad) => String(x.instagram ?? '').replace(/^@/, '').toLowerCase();
  if (ig(a) && ig(a) === ig(b)) return true;
  if (a.youtube_id && a.youtube_id === b.youtube_id) return true;
  if (a.tiktok && a.tiktok.toLowerCase() === String(b.tiktok ?? '').toLowerCase()) return true;
  if (a.landing_url && b.landing_url && dominioComparable(a.landing_url) === dominioComparable(b.landing_url)) return true;
  const na = nombreComparable(a.nombre ?? '');
  if (na && na === nombreComparable(b.nombre ?? '')) return true;
  const ra = referenteDeCompetidor(a);
  return !!ra && ra === referenteDeCompetidor(b);
}

/** Sólo las filas de la plataforma. Positivo: lo que no dice ser de ese negocio no entra. */
export const soloDeLaPlataforma = <T extends { workspace_id: number }>(filas: readonly T[], plataforma: number): T[] =>
  filas.filter((f) => f.workspace_id === plataforma);

/** Los canales que se copian. Los anuncios no: no se le pasan a un tercero. */
export const CANALES_QUE_SE_COPIAN: readonly CanalSpy[] = ['instagram', 'youtube', 'landing'];

/** Las piezas que se copian: de esos canales, y sólo las que siguen a la vista (una borrada no se copia como viva). */
export function piezasACopiar(piezas: readonly FilaPieza[]): PiezaCopiada[] {
  return piezas
    .filter((p) => CANALES_QUE_SE_COPIAN.includes(p.canal) && !p.dejo_de_verse_en)
    .map((p) => ({
      canal: p.canal, tipo: p.tipo, ref: p.ref, fuente: p.fuente, url: p.url, titulo: p.titulo, texto: p.texto,
      etiquetas: p.etiquetas, vistas: p.vistas, megusta: p.megusta, comentarios: p.comentarios, duracion: p.duracion,
      publicadaEn: p.publicada_en, miniatura: p.miniatura,
    }));
}

/** Con qué se lo agrega: lo mismo que pegaría una persona, para pasar por la misma deduplicación. */
export function pegadoDe(f: Pick<FilaCompetidor, 'instagram' | 'youtube_id' | 'landing_url' | 'nombre'>): string {
  if (f.instagram) return `@${f.instagram.replace(/^@/, '')}`;
  if (f.youtube_id) return f.youtube_id.startsWith('@') ? `https://www.youtube.com/${f.youtube_id}` : `https://www.youtube.com/channel/${f.youtube_id}`;
  if (f.landing_url) return f.landing_url;
  return f.nombre;
}

export type DepsSugeridos = {
  /** El negocio de la plataforma (por capa). */
  plataforma: () => Promise<number | null>;
  /** El negocio que pregunta. */
  actual: () => Promise<number | null>;
  /** Los competidores de UN negocio. */
  competidoresDe: (ws: number) => Promise<FilaCompetidor[]>;
  /** Las caricaturas listas de UN negocio (id → url). */
  caricaturasDe: (ws: number) => Promise<Map<number, string>>;
  /** Los competidores del negocio que pregunta. */
  propios: () => Promise<Identidad[]>;
};

/** El catálogo para el negocio que pregunta: los de la plataforma que todavía no mira. Para la plataforma, nada. */
export async function listarSugeridos(deps: DepsSugeridos): Promise<Sugerido[]> {
  const [plataforma, actual] = await Promise.all([deps.plataforma(), deps.actual()]);
  if (plataforma == null || actual == null || plataforma === actual) return [];
  const [filas, caricaturas, propios] = await Promise.all([deps.competidoresDe(plataforma), deps.caricaturasDe(plataforma), deps.propios()]);
  return soloDeLaPlataforma(filas, plataforma)
    .filter(tieneDondeLeerlo)
    .filter((f) => !propios.some((p) => esLaMismaPersona(f, p)))
    .map((f) => ({
      id: f.id, nombre: f.nombre, instagram: f.instagram, youtube_id: f.youtube_id, tiktok: f.tiktok, landing_url: f.landing_url,
      // La misma cara que tendrá en «Competidores» al sumarlo, y la misma del teléfono: su caricatura, la DIBUJADA de ese
      // referente o su foto (10/11/2026: Alex Hormozi salía como una «A» acá y con su dibujo en el teléfono y en la lista).
      cara: caraDeTarjeta({ caricatura: caricaturas.get(f.id) ?? null, avatar: f.avatar }, caricaturaDeCompetidor(f)),
      seguidores: f.instagram_seguidores, suscriptores: f.youtube_suscriptores,
    }));
}

/**
 * ¿Hay de dónde leerlo? Un sugerido sin ninguna red no se ofrece (10/11/2026, prueba en producción): de 24 sugeridos, 17 eran
 * sólo un nombre —se cargaron el 8/11 por sus anuncios, y sus anuncios no se copian a otro negocio—, así que «Sumar» dejaba en
 * el cliente una ficha vacía y la grilla eran 17 letras gigantes. Es la fila muerta de docs/hallazgos-competitors-spy.md
 * («DAR DE ALTA UN COMPETIDOR SIN SU @…»). Cuando la plataforma le encuentre una red, vuelve a aparecer solo.
 */
export const tieneDondeLeerlo = (f: Pick<FilaCompetidor, 'instagram' | 'youtube_id' | 'tiktok' | 'landing_url'>): boolean =>
  !!(f.instagram?.trim() || f.youtube_id?.trim() || f.tiktok?.trim() || f.landing_url?.trim());

export type DepsAgregar = DepsSugeridos & {
  /** Las piezas de un competidor de UN negocio. */
  piezasDe: (ws: number, id: number) => Promise<FilaPieza[]>;
  /** El alta de siempre (`agregarCompetidor`), en el negocio que pregunta. */
  agregar: (pegado: string, nombre: string) => Promise<{ ok: true; id: number } | { ok: false; error: string }>;
  /** Le completa lo que le falte (sólo las columnas vacías) y lo marca como mirado ahora. */
  completar: (id: number, desde: FilaCompetidor) => Promise<void>;
  /** `guardarVistas` del negocio que pregunta. */
  guardar: (id: number, piezas: PiezaCopiada[]) => Promise<{ nuevas: number; error?: string }>;
  /** Que la traída larga no arranque ya con la clave del cliente: la historia vino copiada. */
  marcarTraido: (id: number) => Promise<void>;
};

/**
 * Suma un sugerido al negocio que pregunta, copiando lo que la plataforma ya leyó. Si ya lo mira, lo abre (no se crea
 * otro). Nunca acepta un id que no sea de la plataforma.
 */
export async function agregarSugerido(deps: DepsAgregar, idSugerido: number): Promise<{ ok: true; id: number; piezas: number } | { ok: false; error: string }> {
  const [plataforma, actual] = await Promise.all([deps.plataforma(), deps.actual()]);
  if (plataforma == null || actual == null) return { ok: false, error: 'No pude saber de qué negocio son los sugeridos.' };
  if (plataforma === actual) return { ok: false, error: 'Los sugeridos son los de este negocio: ya los miras.' };
  const fila = soloDeLaPlataforma(await deps.competidoresDe(plataforma), plataforma).find((f) => f.id === idSugerido);
  if (!fila) return { ok: false, error: 'Ese no está entre los sugeridos.' };
  const r = await deps.agregar(pegadoDe(fila), fila.nombre);
  if (!r.ok) return r;
  await deps.completar(r.id, fila);
  const piezas = piezasACopiar(await deps.piezasDe(plataforma, fila.id));
  const g = piezas.length ? await deps.guardar(r.id, piezas) : { nuevas: 0 };
  if (g.error) return { ok: false, error: `Lo sumé, pero no pude copiar lo que ya leímos de él: ${g.error}` };
  if (piezas.some((p) => p.canal === 'instagram')) await deps.marcarTraido(r.id);
  return { ok: true, id: r.id, piezas: piezas.length };
}
