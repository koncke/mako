// =============================================================================
// editor-landing/bloques-chat — lo que el chat del Ops Center DIBUJA de una landing (piezas 1.12 y 1.13)
// =============================================================================
// Martín (20/10/2026): «comienza a implementar directamente toda mi idea de que Ops Center sea lo principal en MaKo...
// quiero que en Ops Center se pueda hacer todo, editar videos, crear webs, etc...». docs/ops-center-principal.md:
//   · 1.12: listar, crear y replicar terminan con la miniatura y «Abrir en el editor»; «armame una landing» sin diseño
//     muestra 3 diseños para tocar; elegir entre 3 también temas y el formato de Replicar;
//   · 1.13: publicar deja el link público con Copiar y Abrir, y conectar un dominio muestra los registros DNS con su
//     estado vivo.
// Esto arma los DATOS de cada bloque. El marco que los lleva al hilo (`datos.bloque`, el tipo nuevo de ItemHilo) es de
// Ops Center 3 (pieza 1.7): cuando esté, cada operación devuelve lo de acá y el hilo lo dibuja con las piezas del Web
// Generator (MiniaturaLanding.tsx, la tabla de DialogoPublicar).
//
// LAS REGLAS (§2.4 del documento):
//   · el bloque sale de un campo estructurado, nunca del texto del modelo, y los links los arma el código;
//   · lo que pesa (el JSON de la primera sección) va al bloque y NO al modelo: un bloque no viaja en la respuesta de la
//     herramienta;
//   · los diseños, los temas y los formatos son catálogo del navegador (crear/tipo.ts, temas.ts): el bloque lleva sus ids
//     y la pantalla dibuja la miniatura con ellos, como el Panel. Sólo la tarjeta de una landing creada trae su sección.
//
// PURO y sin `server-only`: lo usan las operaciones de la API, el hilo y los tests.
// =============================================================================

import type { JsonNodo } from './doc';
import { DISENOS_LANDING } from './disenos-landing';
import { FORMATOS_REPLICAR, NOMBRE_FORMATO_REPLICAR, type FormatoReplicar } from './replicar-reglas';
import type { GrupoTema } from './temas';

/** La ruta del editor de una landing, ADENTRO de la app (el `Link` de la pantalla le pega el ?ws=). */
export const rutaEditor = (id: number): string => `/web-generator/${id}`;

// ─────────────────────────────────────────────────────────────────────────────
// La tarjeta de una landing (G5, «Creado»)
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoLanding = 'borrador' | 'publicada' | 'pausada';

export type BloqueLanding = {
  k: 'landing';
  id: number;
  titulo: string;
  formato: 'landing' | 'presentacion';
  estado: EstadoLanding;
  /** La dirección pública (la del dominio propio verificado si tiene uno), o null si no está publicada. */
  url: string | null;
  /** Lo que dibuja la miniatura (MiniaturaLanding): la primera sección y el tema. */
  miniatura: { tarjeta: JsonNodo | null; tema: string; proporcion: '16:9' | '4:3' | null };
  abrir: { titulo: string; href: string };
};

/** Lo que hace falta de una landing: lo trae `listar` (LandingResumen) y también `abrir` (LandingCompleta). */
export type LandingParaBloque = {
  id: number;
  titulo: string;
  tema: string;
  primera: JsonNodo | null;
  formato?: string | null;
  proporcion?: string | null;
  slug: string | null;
  publicadoAt: string | null;
  /** Sólo lo sabe `abrir`: con false, la publicada está pausada. Sin el dato, no se dice «pausada». */
  sitioActivo?: boolean;
};

/**
 * El estado que dice la tarjeta. Publicada = tiene slug y fecha de publicación (la misma regla que `estaPublicada`
 * de la API); pausada = publicada con el sitio apagado. Sin saber si el sitio está activo, «publicada».
 */
export function estadoDeLanding(d: Pick<LandingParaBloque, 'slug' | 'publicadoAt' | 'sitioActivo'>): EstadoLanding {
  if (!(d.slug && d.publicadoAt)) return 'borrador';
  return d.sitioActivo === false ? 'pausada' : 'publicada';
}

/** La tarjeta de una landing. `url`: la dirección pública que ya armó la API (`urlPublicaParaApi`), o null. */
export function bloqueLanding(d: LandingParaBloque, url: string | null): BloqueLanding {
  const estado = estadoDeLanding(d);
  const presentacion = d.formato === 'presentacion';
  return {
    k: 'landing',
    id: d.id,
    titulo: d.titulo.trim() || 'Sin título',
    formato: presentacion ? 'presentacion' : 'landing',
    estado,
    url: estado === 'borrador' ? null : url,
    miniatura: { tarjeta: d.primera, tema: d.tema, proporcion: presentacion ? (d.proporcion === '4:3' ? '4:3' : '16:9') : null },
    abrir: { titulo: 'Abrir en el editor', href: rutaEditor(d.id) },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Elegir entre 3 (G2): diseños, temas y el formato de Replicar
// ─────────────────────────────────────────────────────────────────────────────

/** Una opción: el id que se manda al elegirla, su nombre y cuándo conviene (una línea). */
export type OpcionBloque = { id: string; titulo: string; cuando: string };

export type BloqueElegir = {
  k: 'elegir';
  que: 'diseno' | 'tema' | 'formato';
  pregunta: string;
  opciones: OpcionBloque[];
  /** La que se marca como recomendada (una de `opciones`), o null. */
  recomendada: string | null;
  /** La operación que corre la opción elegida, y el parámetro que llena su id. */
  operacion: string;
  parametro: string;
};

/** Cuántas opciones muestra un «elegir». */
export const OPCIONES_POR_BLOQUE = 3;

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Los 3 diseños para «armame una landing» sin diseño. Tres maneras distintas de arrancar, no tres parecidos: el VSL al
 * costado (el de MaKo), el VSL al centro con el botón debajo, y sólo texto. Lo que dice el pedido los ordena:
 *   · «sin video», «simple», «minimalista», «solo texto» → Minimal primero;
 *   · «oscuro», «dark», «elegante» → Oscuro moderno en vez del Clásico claro;
 *   · lo demás, en el orden de arriba. La recomendada es la primera.
 */
export function elegirDiseno(pedido = ''): BloqueElegir {
  const p = plano(pedido);
  const sinVideo = /\bsin (?:video|vsl)\b|\bsimple\b|\bminimal(?:ista)?\b|\bsolo texto\b/.test(p);
  const oscuro = /\boscur[ao]\b|\bdark\b|\belegante\b|\bnegr[ao]\b/.test(p);
  const ids = [oscuro ? 'oscuro-moderno' : 'claro-clasico', 'mako', 'minimal'];
  if (sinVideo) ids.unshift(...ids.splice(ids.indexOf('minimal'), 1));
  const opciones = ids
    .map((id) => DISENOS_LANDING.find((d) => d.id === id))
    .filter((d): d is (typeof DISENOS_LANDING)[number] => !!d)
    .map((d) => ({ id: d.id, titulo: d.nombre, cuando: d.descripcion }));
  return {
    k: 'elegir', que: 'diseno', pregunta: '¿Con qué diseño la arrancamos?',
    opciones, recomendada: opciones[0]?.id ?? null, operacion: 'crear_landing_desde_diseno', parametro: 'diseno',
  };
}

/** Lo que el «elegir» necesita de un tema (el catálogo de temas.ts o un tema propio). */
export type TemaParaBloque = { id: string; nombre: string; grupo: GrupoTema; etiquetas?: readonly string[] };

const NOMBRE_GRUPO: Record<GrupoTema, string> = { claro: 'Claro', oscuro: 'Oscuro' };

/**
 * 3 temas para cambiar el de una landing: dos del MISMO grupo que el actual (claro u oscuro) y uno del otro, para que
 * la elección no sea entre tres casi iguales. Nunca el que ya tiene. Con un tema que no está, como si fuera claro.
 */
export function elegirTema(actual: string | null, temas: readonly TemaParaBloque[]): BloqueElegir {
  const delActual = temas.find((t) => t.id === actual);
  const grupo: GrupoTema = delActual?.grupo ?? 'claro';
  const otros = temas.filter((t) => t.id !== actual);
  const mismos = otros.filter((t) => t.grupo === grupo).slice(0, OPCIONES_POR_BLOQUE - 1);
  const distinto = otros.find((t) => t.grupo !== grupo);
  const elegidos = [...mismos, ...(distinto ? [distinto] : [])];
  for (const t of otros) if (elegidos.length < OPCIONES_POR_BLOQUE && !elegidos.includes(t)) elegidos.push(t);
  const opciones = elegidos.slice(0, OPCIONES_POR_BLOQUE).map((t) => ({
    id: t.id, titulo: t.nombre, cuando: [NOMBRE_GRUPO[t.grupo], ...(t.etiquetas ?? [])].join(' · '),
  }));
  return {
    k: 'elegir', que: 'tema', pregunta: '¿Qué tema le ponemos?',
    opciones, recomendada: opciones[0]?.id ?? null, operacion: 'cambiar_tema_landing', parametro: 'tema',
  };
}

/** Cuándo conviene cada formato de Replicar (crear/Replicar.tsx los ofrece con estos nombres). */
export const CUANDO_FORMATO: Record<FormatoReplicar, string> = {
  landing: 'Secciones editables con su estilo: la de casi siempre.',
  web: 'Igual a la original, para mirarla o publicarla tal cual.',
  presentacion: 'Diapositivas con lo que dice la página.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Publicar y el dominio propio (1.13)
// ─────────────────────────────────────────────────────────────────────────────

/** Lo publicado: el link con «Copiar» y «Abrir», y la vuelta al editor. */
export type BloquePublicada = {
  k: 'publicada';
  id: number;
  titulo: string;
  url: string;
  abrir: { titulo: string; href: string };
  editor: { titulo: string; href: string };
};

export function bloquePublicada(d: { id: number; titulo: string; url: string }): BloquePublicada {
  return {
    k: 'publicada', id: d.id, titulo: d.titulo.trim() || 'Sin título', url: d.url,
    abrir: { titulo: 'Abrir', href: d.url }, editor: { titulo: 'Abrir en el editor', href: rutaEditor(d.id) },
  };
}

/** Si una dirección está libre (revisar_direccion_landing), antes de publicar: la que sí, o por qué no y una parecida. */
export type BloqueDireccion = { k: 'direccion'; id: number; slug: string; libre: boolean; motivo: string | null; sugerencia: string | null };

export function bloqueDireccion(d: { id: number; slug: string; disponible: boolean; motivo?: string | null; sugerencia?: string | null }): BloqueDireccion {
  return {
    k: 'direccion', id: d.id, slug: d.slug, libre: d.disponible,
    motivo: d.disponible ? null : d.motivo ?? null, sugerencia: d.disponible ? null : d.sugerencia ?? null,
  };
}

/** Una fila de la tabla DNS: lo que hay que cargar y si ya está (null = no se pudo leer). */
export type FilaDns = { tipo: string; nombre: string; valor: string; listo: boolean | null; para?: string };

export type BloqueDominio = {
  k: 'dominio';
  id: number;
  dominio: string;
  estado: 'pendiente' | 'verificado';
  registros: FilaDns[];
  /** Cuántos registros faltan cargar. El www que MaKo le suma a una raíz verificada es informativo y no cuenta. */
  faltan: number;
  falta: string | null;
  /** Lo que vuelve a mirar el DNS para que el estado cambie en el MISMO bloque. */
  verificar: { operacion: 'verificar_dominio_landing'; id: number };
};

/** El dominio de una landing, de lo que devuelve `estadoDominio` / `conectarDominio` (lib/editor-landing/dominios.ts). */
export function bloqueDominio(id: number, e: { dominio: string; estado: 'pendiente' | 'verificado'; registros: readonly FilaDns[]; falta: string | null }): BloqueDominio {
  const registros = e.registros.map((r) => ({ tipo: r.tipo, nombre: r.nombre, valor: r.valor, listo: r.listo, ...(r.para ? { para: r.para } : {}) }));
  return {
    k: 'dominio', id, dominio: e.dominio, estado: e.estado, registros,
    faltan: e.estado === 'verificado' ? 0 : registros.filter((r) => r.listo === false && r.para !== 'www').length,
    falta: e.estado === 'verificado' ? null : e.falta,
    verificar: { operacion: 'verificar_dominio_landing', id },
  };
}

/** Los 3 formatos de Replicar, con Landing primero y recomendada (el default de la pantalla). */
export function elegirFormatoReplicar(): BloqueElegir {
  const orden: FormatoReplicar[] = ['landing', ...FORMATOS_REPLICAR.filter((f) => f !== 'landing')];
  return {
    k: 'elegir', que: 'formato', pregunta: '¿Cómo la replicamos?',
    opciones: orden.map((f) => ({ id: f, titulo: NOMBRE_FORMATO_REPLICAR[f], cuando: CUANDO_FORMATO[f] })),
    recomendada: 'landing', operacion: 'replicar_landing', parametro: 'formato',
  };
}
