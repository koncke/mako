// =============================================================================
// /m/copywriting — el modelo de «Ads Writer» en el teléfono (puro: sin React, con test)
// =============================================================================
// Lo que la pantalla decide sin dibujar nada, sacado de las MISMAS reglas que escritorio:
//   · las vistas y su URL: app/ads-writer/tabs.ts (`?tab=`, Anuncios por defecto);
//   · la cobertura, «el próximo guion» y el orden de la galería: app/ads-writer/reglas.ts;
//   · el gancho y la espina de un guion: lib/guion-secciones.ts (el parser de SeccionCard);
//   · el estado de un guion: lib/guion-estado.ts; el veredicto de una valoración: ValoracionGuion.tsx;
//   · el día y el extracto de una fila del historial: app/ads-writer/analizar.ts.
// Los rótulos que el teléfono repite van en `R`, y tests/m-copywriting.test.ts los cruza ENTEROS
// contra el fuente de escritorio (con `includes`, un rótulo recortado pasaba).
// =============================================================================

import { parsearSecciones, type Seccion } from '@/lib/guion-secciones';
import { TONO_ESTADO_GUION, estadoMasAvanzado, type EstadoGuion, type GuionItem } from '@/lib/guion-estado';
import type { ScriptDraft, Valoracion } from '@/lib/ads-analyst';
import { VISTAS_ADS_WRITER, type VistaAdsWriter } from '@/app/ads-writer/tabs';
import { masRecientePrimero } from '@/app/ads-writer/reglas';
import { diaMes, extracto } from '@/app/ads-writer/analizar';
import { veredictoDe } from '@/app/ads-writer/ValoracionGuion';
import type { TonoPildora } from '@/app/m/_ui';

/** Los rótulos de escritorio que el teléfono dibuja, tal cual (el archivo de origen, en el test). */
export const R = {
  anuncios: 'Anuncios',
  guiones: 'Guiones',
  analizar: 'Analizar guion',
  escribirProximo: 'Escribir el próximo guion',
  todosConGuion: 'Todos tienen guion',
  queMakoEscriba: 'Que MaKo lo escriba',
  makoSolo: 'MaKo lo hace solo',
  makoEscribiendo: 'MaKo está escribiendo',
  copiarGuion: 'Copiar el guion',
  analizaNuevo: 'Analiza un guion nuevo',
  valorar: 'Valorar guion',
  tarda: 'Puede tardar hasta 2 minutos.',
  historial: 'Historial',
  guionAValorar: 'Guion a valorar',
  queProbar: 'Qué probar',
  sinDatos: 'Predicción sin datos',
  hookEst: 'Hook (est.)',
  retEst: 'Ret. CTA (est.)',
} as const;

/** El nombre de cada vista, en el orden de escritorio (`VISTAS_ADS_WRITER`). */
const ROTULO_VISTA: Record<VistaAdsWriter, string> = { anuncios: R.anuncios, guiones: R.guiones, analizar: R.analizar };
export const VISTAS: readonly { id: VistaAdsWriter; label: string }[] = VISTAS_ADS_WRITER.map((id) => ({ id, label: ROTULO_VISTA[id] }));

// ── La matriz, adelgazada para el teléfono ───────────────────────────────────

/** Una celda (avatar × razón = un anuncio) con lo que el teléfono dibuja: sin copy, imagen ni ángulos. */
export type CeldaM = { id: string; avatarId: string; nombre: string; guiones: GuionItem[] };
export type AvatarLite = { id: string; nombre: string };

/** De una celda de lib/razones.ts (o de la respuesta de /api/onboarding/razones) a la del teléfono. */
export function celdaM(c: { id: string; avatarId: string; nombre: string; guiones?: GuionItem[] | null }): CeldaM {
  return { id: c.id, avatarId: c.avatarId, nombre: c.nombre, guiones: Array.isArray(c.guiones) ? c.guiones : [] };
}
export function avatarLite(a: { id: string; nombre: string }): AvatarLite {
  return { id: a.id, nombre: a.nombre };
}

/**
 * La matriz que queda en pantalla cuando una escritura FALLA. Mientras MaKo escribe (60-120 s), la copia
 * que manda el server (tirar para refrescar, volver la red, volver al frente: ShellM refresca solo) se
 * guarda aparte y no pisa la pantalla, porque la respuesta de la escritura trae algo más nuevo. Si falla:
 *   · llegó otra copia en el medio → ESA. Quedarse con la foto de antes la perdía, y `proximaCeldaDe`
 *     seguía apuntando a una celda que el server ya había escrito: el próximo toque pagaba IA otra vez
 *     y le sumaba un segundo guion al mismo anuncio;
 *   · no llegó ninguna → la de pantalla, que puede ser MÁS nueva que la del server (la devolvió la
 *     escritura anterior). Volver a la del server borraba de la pantalla el guion recién escrito.
 * «Llegó otra» es por identidad: cada copia del server es un objeto nuevo (CopywritingM.tsx).
 */
export function matrizSiFalla<T>(e: { enPantalla: T; delServerAlEmpezar: T; delServerAhora: T }): T {
  return e.delServerAhora !== e.delServerAlEmpezar ? e.delServerAhora : e.enPantalla;
}

/** La píldora de un estado: el tono de escritorio (`TONO_ESTADO_GUION`) con el nombre de /m. */
const TONO_M: Record<(typeof TONO_ESTADO_GUION)[EstadoGuion], TonoPildora> = { neutral: 'neutro', info: 'info', warn: 'warn', good: 'good' };
export const tonoDeEstado = (e: EstadoGuion): TonoPildora => TONO_M[TONO_ESTADO_GUION[e]];

export type FilaAnuncio = { id: string; nombre: string; n: number; estado: EstadoGuion | null };
export type GrupoAnuncios = { avatarId: string; avatar: string; conGuion: number; total: number; filas: FilaAnuncio[] };

/**
 * La vista Anuncios: un carril por avatar, en el orden de los avatares, con sus razones (MatrizView:
 * `avatares.map` → `razonesDe`; un avatar sin razones no sale). Cada fila: cuántos guiones tiene y el
 * estado más avanzado («¿cómo viene este anuncio?»).
 */
export function gruposDeAnuncios(celdas: readonly CeldaM[], avatares: readonly AvatarLite[]): GrupoAnuncios[] {
  return avatares.flatMap((av) => {
    const rs = celdas.filter((c) => c.avatarId === av.id);
    if (!rs.length) return [];
    return [{
      avatarId: av.id,
      avatar: av.nombre,
      conGuion: rs.filter((r) => r.guiones.length).length,
      total: rs.length,
      filas: rs.map((r) => ({ id: r.id, nombre: r.nombre, n: r.guiones.length, estado: estadoMasAvanzado(r.guiones.map((g) => g.estado)) })),
    }];
  });
}

/** La segunda línea de un anuncio: la invitación de escritorio si no tiene guion, o cuántos tiene. */
export function segundaDeAnuncio(f: Pick<FilaAnuncio, 'n'>): string {
  if (!f.n) return R.queMakoEscriba;
  return `${f.n} ${f.n === 1 ? 'guion' : 'guiones'}`;
}

// ── La galería: todos los guiones, el más nuevo primero ──────────────────────

export type GuionM = { g: GuionItem; celdaId: string; celda: string; avatar: string };

/** Cada guion de cada celda, con el anuncio y el avatar de los que salió, en el orden de escritorio. */
export function guionesRecientes(celdas: readonly CeldaM[], avatares: readonly AvatarLite[]): GuionM[] {
  const nombre = new Map(avatares.map((a) => [a.id, a.nombre]));
  return celdas
    .flatMap((c) => c.guiones.map((g) => ({ g, celdaId: c.id, celda: c.nombre, avatar: nombre.get(c.avatarId) ?? 'Sin avatar' })))
    .sort((a, b) => masRecientePrimero(a.g, b.g));
}

/** Un guion por su celda y su id (la hoja lo relee de la matriz viva: después de refrescar es el de hoy). */
export function guionDe(celdas: readonly CeldaM[], avatares: readonly AvatarLite[], celdaId: string | null, guionId: string | null): GuionM | null {
  const c = celdas.find((x) => x.id === celdaId);
  const g = c?.guiones.find((y) => y.id === guionId);
  if (!c || !g) return null;
  return { g, celdaId: c.id, celda: c.nombre, avatar: avatares.find((a) => a.id === c.avatarId)?.nombre ?? 'Sin avatar' };
}

/** Los bloques de un guion, con el mismo tope de rótulo que el lector y la tarjeta de escritorio (20). */
export function seccionesDe(texto: string): Seccion[] {
  return parsearSecciones(texto, undefined, 20);
}

/**
 * La portada de un guion: EL GANCHO (el primer bloque, los segundos que deciden el anuncio), como la
 * tarjeta de escritorio (GuionCard.tsx). Un guion viejo, sin rótulos, muestra su principio.
 */
export function portadaDe(texto: string): { titulo: string | null; texto: string } {
  const s = seccionesDe(texto)[0];
  return s ? { titulo: s.titulo, texto: s.texto } : { titulo: null, texto: texto.slice(0, 200) };
}

/**
 * La espina de la tarjeta: un segmento por bloque, de ancho proporcional a cuánto texto tiene (el
 * primero, el gancho, en tinta). Con un solo bloque no hay espina: no dice nada.
 */
export function espinaDe(texto: string): number[] {
  const s = seccionesDe(texto);
  if (s.length < 2) return [];
  const total = s.reduce((n, x) => n + x.texto.length, 0) || 1;
  return s.map((x) => Math.max(x.texto.length, 1) / total);
}

/** La línea de una tarjeta: el ángulo y el avatar («Dolor · Dueño ocupado»), lo que falte no se dibuja. */
export function metaDeGuion(x: Pick<GuionM, 'avatar'> & { g: Pick<GuionItem, 'anguloNombre'> }): string {
  return [x.g.anguloNombre, x.avatar].filter((s) => s && s.trim()).join(' · ');
}

// ── Analizar guion: el historial y la valoración, adelgazados ────────────────

/**
 * El tono de la píldora de cada veredicto. Escritorio los pinta con un hex propio
 * (`VEREDICTO_VALORACION`): verde, azul, ámbar, rojo y gris → good, info, warn, bad, neutro.
 * Las claves son las de escritorio (el test las cruza): uno nuevo allá sin su tono acá sale neutro.
 */
export const TONO_VEREDICTO: Record<string, TonoPildora> = {
  'escalar-candidato': 'good',
  'mejorar-gancho': 'info',
  'reescribir-cuerpo': 'warn',
  'repensar-angulo': 'bad',
  'promesa-pero-validar': 'neutro',
};
export const tonoDeVeredicto = (k: string | null | undefined): TonoPildora => TONO_VEREDICTO[k ?? ''] ?? 'neutro';
/** El rótulo de escritorio de un veredicto (uno desconocido sale con su clave). */
export const rotuloVeredicto = (k: string | null | undefined): string => veredictoDe(k).label;

export type ValoracionM = {
  /** Cómo la llamó MaKo al clasificarla (`clasificacion.short`): el título de su hoja. */
  titulo: string;
  veredicto: string;
  /** La lectura estructural (el título y su texto) y el porqué de la predicción. */
  lectura: { titulo: string; texto: string };
  razon: string;
  hook: string;
  ret: string;
  probar: { que: string; propuesta: string }[];
  /** Con cuántos guiones reales se comparó (el aviso de «predicción sin datos» de escritorio). */
  nTotal: number;
};

const rango = (r: { min?: unknown; max?: unknown } | null | undefined): string => {
  const min = Number(r?.min);
  const max = Number(r?.max);
  return Number.isFinite(min) && Number.isFinite(max) ? `${min}–${max}%` : '—';
};
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Lo que el teléfono dibuja de una valoración: el veredicto, la lectura, los dos estimados y qué
 * probar. Se lee a la defensiva: una fila vieja del historial puede no traer todos los campos (es JSON).
 */
export function valoracionM(v: Valoracion | null | undefined): ValoracionM | null {
  if (!v || typeof v !== 'object') return null;
  const reesc = Array.isArray(v.reescrituras) ? v.reescrituras : [];
  return {
    titulo: str(v.clasificacion?.short).trim(),
    veredicto: str(v.prediccion?.verdicto),
    lectura: { titulo: str(v.lectura_estructural?.title), texto: str(v.lectura_estructural?.text) },
    razon: str(v.prediccion?.razon),
    hook: rango(v.prediccion?.hook_rate_estimado),
    ret: rango(v.prediccion?.retencion_cta_estimada),
    probar: reesc.map((r) => ({ que: str(r?.que_cambiar), propuesta: str(r?.propuesta) })).filter((r) => r.que || r.propuesta),
    nTotal: Number(v.perfil?.n_total) || 0,
  };
}

export type DraftM = { id: number; titulo: string; extracto: string; veredicto: string; dia: string; v: ValoracionM | null };

/** Una fila del historial (script_drafts) para el teléfono: sin el guion entero ni la valoración cruda. */
export function draftM(d: ScriptDraft): DraftM {
  return {
    id: d.id,
    titulo: (d.short ?? '').trim() || 'Guion',
    extracto: extracto(d.guion ?? ''),
    veredicto: str(d.verdicto) || str(d.valoracion?.prediccion?.verdicto),
    dia: diaMes(str(d.created_at)),
    v: valoracionM(d.valoracion),
  };
}

/** Lo que la página manda de «Analizar guion» (sólo con `?tab=analizar`). */
export type DatosAnalizarM = {
  /** Meta no está conectado: no hay contra qué valorar. */
  sinMeta: boolean;
  drafts: DraftM[];
  /** No se pudo leer el historial (la base). */
  error: boolean;
};
