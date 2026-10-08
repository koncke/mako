// =============================================================================
// etiquetas-reglas — lo que decide el sistema de etiquetas del CRM, sin base
// =============================================================================
// Pedido de Martín (08/10/2026, punto 12): «Deberías agregar todo un sistema de ETIQUETAS...
// que el usuario elija qué nombres ponerles y si están vinculadas a etapas del CRM... esas
// mismas etiquetas que se asignan en MaKo, se pongan en esas ambas plataformas».
//
// Módulo PURO y sin `server-only`: lo importan los tests, la ruta y el registro de la API.
// Acá vive todo lo que se puede decidir sin leer la base —el nombre, el color, el slug de
// Chatwoot, qué etiqueta del celular es una lista del sistema, y quién apunta a una etiqueta
// dentro de los pasos de una secuencia—. La orquestación de poner y sacar vive en
// lib/etiquetas-motor.ts (también puro, con puertos), y la base en lib/etiquetas.ts.
// =============================================================================

/** El tope del nombre. El mismo número lo exige el CHECK de la mig 0224. */
export const TOPE_NOMBRE_ETIQUETA = 40;

/**
 * Los colores que ofrece el CRUD: la paleta Nord de la casa (docs/branding-mako.md) más el azul
 * de Meta. El primero es el default de la columna. Se guarda el hex, así que cambiar la paleta
 * no repinta nada de lo ya creado.
 */
export const COLORES_ETIQUETA: readonly string[] = [
  '#5E81AC', '#88C0D0', '#8FBCBB', '#A3BE8C', '#EBCB8B', '#D08770', '#BF616A', '#B48EAD', '#4C566A', '#1877F2',
];
export const COLOR_ETIQUETA_DEFAULT = COLORES_ETIQUETA[0];

/**
 * El espaciado del disparo: la MISMA (etiqueta, lead) no dispara dos veces en 30 s. Es la regla de
 * ManyChat (docs/hallazgos-comunicacion.md): poner, sacar y volver a poner en un minuto no puede
 * mandarle dos veces la misma automatización a una persona. En minutos porque es lo que pide
 * `reclamarEspaciado` (lib/espaciado.ts).
 */
export const ESPACIADO_DISPARO_MIN = 0.5;

/** Hasta cuántos leads de un lote se pasan a WhatsApp/Chatwoot en la misma llamada. */
export const SYNC_LOTE_MAX = 40;

/** El trigger de una secuencia que arranca cuando se pone una etiqueta (lo resuelve el motor, parte M). */
export const TRIGGER_ETIQUETA = 'etiqueta_puesta';

/** El prefijo de un segmento de email por etiqueta: `etiqueta:<id>`. */
export const PREFIJO_SEGMENTO_ETIQUETA = 'etiqueta:';

/** `etiqueta:12` → 12. Cualquier otra cosa → null (un id que no es entero positivo no es un segmento). */
export function etiquetaDeSegmento(segmento: string): number | null {
  if (!segmento.startsWith(PREFIJO_SEGMENTO_ETIQUETA)) return null;
  const crudo = segmento.slice(PREFIJO_SEGMENTO_ETIQUETA.length);
  if (!/^[1-9][0-9]{0,15}$/.test(crudo)) return null;
  return Number(crudo);
}

// ── El nombre ────────────────────────────────────────────────────────────────

/**
 * El nombre tal como se guarda: sin caracteres de control ni marcas de dirección (U+200E…), con
 * los espacios colapsados y topeado. `''` = no hay nombre.
 */
export function limpiarNombreEtiqueta(crudo: unknown): string {
  if (typeof crudo !== 'string') return '';
  const s = sinMarcasInvisibles(crudo).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, TOPE_NOMBRE_ETIQUETA).join('').trim();
}

/**
 * La clave con la que se compara un nombre: la MISMA que el índice único de la mig 0224
 * (`lower(btrim(nombre))`). «Cualificado» y « cualificado » son la misma etiqueta; «Calificado»
 * y «Cualificado», no.
 */
export function claveNombre(nombre: string): string {
  return limpiarNombreEtiqueta(nombre).toLowerCase();
}

export function colorValido(c: unknown): string | null {
  return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c.trim()) ? c.trim().toUpperCase() : null;
}

/** Un emoji (o cualquier glifo corto). Lo que no entra en 1-16 caracteres no se guarda. */
export function emojiValido(e: unknown): string | null {
  if (typeof e !== 'string') return null;
  const s = e.trim();
  return s.length >= 1 && s.length <= 16 ? s : null;
}

// ── Chatwoot ─────────────────────────────────────────────────────────────────

/**
 * El título con el que se crea en Chatwoot. Su modelo lo pasa a minúscula y sólo admite letras,
 * números, guion y guion bajo, único por cuenta (github.com/chatwoot/chatwoot app/models/label.rb):
 * «Seguimiento semanal» es inválido tal cual. Se GUARDA el resultado (`chatwoot_label`) y no se
 * recalcula: renombrar en MaKo no renombra allá.
 */
export function slugChatwoot(nombre: string, id: number): string {
  const base = limpiarNombreEtiqueta(nombre)
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');
  return (base || `etiqueta_${id}`).slice(0, 60);
}

// ── El catálogo del celular (Evolution) ──────────────────────────────────────

/** Las marcas de dirección que WhatsApp mete delante de las listas del sistema (medido: U+200E en ws1). */
export function sinMarcasInvisibles(s: string): string {
  return s.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
}

/**
 * ¿Es una LISTA del sistema (Favoritos, Grupos, No leídos) y no una etiqueta del negocio? Entran
 * por el mismo `labels.edit` que las de verdad, a veces con U+200E delante, y no se pueden poner
 * en un chat como una etiqueta. Se comparan sin acentos ni mayúsculas, en los idiomas en que las
 * manda WhatsApp.
 */
export function esListaDelSistema(nombre: string | null | undefined): boolean {
  if (!nombre) return false;
  const n = sinMarcasInvisibles(nombre).normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
  return LISTAS_DEL_SISTEMA.has(n);
}
const LISTAS_DEL_SISTEMA = new Set([
  'favoritos', 'favoritas', 'grupos', 'no leidos', 'no leidas',
  'favorites', 'groups', 'unread', 'favoris', 'groupes', 'non lus',
]);

export type LabelCelular = { labelId: string; nombre: string; color: number | null };

/**
 * Lo que se ofrece para mapear: las etiquetas del celular SIN las listas del sistema, con el
 * nombre limpio, sin repetidos por id y ordenadas por nombre. Una sin nombre se muestra con su id
 * (medido: ws11 tiene dos así), porque esconderla dejaría sin elegir una que existe.
 */
export function catalogoCelular(filas: ReadonlyArray<{ label_id: string; name: string | null; color: number | null }>): LabelCelular[] {
  const vistos = new Set<string>();
  const out: LabelCelular[] = [];
  for (const f of filas) {
    const id = String(f.label_id ?? '').trim();
    if (!id || vistos.has(id) || esListaDelSistema(f.name)) continue;
    vistos.add(id);
    const nombre = limpiarNombreEtiqueta(f.name ?? '') || `Etiqueta ${id}`;
    out.push({ labelId: id, nombre, color: f.color ?? null });
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * La sincronización del catálogo contra `findLabels`, sin PISAR NOMBRES. Evolution 2.3.7 guarda el
 * nombre con `name.replace(/[^\x20-\x7E]/g,'')`: «Hablar en cámara 📷» vuelve «Hablar en cmara »,
 * y el upsert por label_id que había acá cambiaba los nombres buenos (llegados por el webhook) por
 * esos. De `findLabels` se toma QUÉ IDS SIGUEN VIVOS:
 *   · id nuevo → se agrega, con el único nombre que hay (el roto, mejor que ninguno);
 *   · id que ya estaba → se le actualiza el color, nunca el nombre;
 *   · id que ya no está → se poda (medido: ws1 arrastra 7 del 11/09 que no existen en el celular).
 * Con una lectura VACÍA no se poda nada: «no me devolvió nada» no es «el celular no tiene ninguna».
 */
export function planSincronizarCatalogo(
  guardadas: ReadonlyArray<{ label_id: string; name: string | null; color: number | null }>,
  vivas: ReadonlyArray<{ id: string; name: string | null; color: number | null }>,
): { nuevas: Array<{ label_id: string; name: string | null; color: number | null }>; colores: Array<{ label_id: string; color: number | null }>; podar: string[] } {
  const porId = new Map(guardadas.map((g) => [String(g.label_id), g]));
  const vivasIds = new Set(vivas.map((v) => String(v.id)));
  const nuevas: Array<{ label_id: string; name: string | null; color: number | null }> = [];
  const colores: Array<{ label_id: string; color: number | null }> = [];
  for (const v of vivas) {
    const id = String(v.id);
    const g = porId.get(id);
    if (!g) nuevas.push({ label_id: id, name: v.name, color: v.color });
    else if ((g.color ?? null) !== (v.color ?? null)) colores.push({ label_id: id, color: v.color });
  }
  const podar = vivas.length ? guardadas.map((g) => String(g.label_id)).filter((id) => !vivasIds.has(id)) : [];
  return { nuevas, colores, podar };
}

// ── Quién apunta a una etiqueta ──────────────────────────────────────────────

export type UsoEnPasos = { condiciones: number; acciones: number };

const OPS_ETIQUETA = new Set(['poner_etiqueta_lead', 'sacar_etiqueta_lead']);

/**
 * Cuántas condiciones y cuántos pasos «⚡ Acción» de UNA secuencia nombran la etiqueta. Mira la
 * forma de lib/flujo-grafo.ts (ramas → filas con `campo: 'etiqueta'`) y la del paso de acción
 * (`accion.operacion` + `accion.params.etiquetaId`). Es lo que hay que contar ANTES de archivar:
 * una condición que apunta a una etiqueta archivada nunca más se cumple, sin un aviso.
 */
export function usoEnPasos(pasos: unknown, etiquetaId: number): UsoEnPasos {
  const out: UsoEnPasos = { condiciones: 0, acciones: 0 };
  if (!Array.isArray(pasos)) return out;
  for (const p of pasos) {
    if (!p || typeof p !== 'object') continue;
    const paso = p as { ramas?: unknown; accion?: unknown };
    if (Array.isArray(paso.ramas)) {
      for (const r of paso.ramas) {
        const filas = (r as { filas?: unknown })?.filas;
        if (!Array.isArray(filas)) continue;
        if (filas.some((f) => (f as { campo?: unknown })?.campo === 'etiqueta' && Number((f as { valor?: unknown }).valor) === etiquetaId)) out.condiciones++;
      }
    }
    const a = paso.accion as { operacion?: unknown; params?: { etiquetaId?: unknown } } | undefined;
    if (a && typeof a.operacion === 'string' && OPS_ETIQUETA.has(a.operacion) && Number(a.params?.etiquetaId) === etiquetaId) out.acciones++;
  }
  return out;
}
