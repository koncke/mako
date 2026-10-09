// =============================================================================
// etiquetas-reglas — lo que decide el sistema de etiquetas del CRM, sin base
// =============================================================================
// Pedido de Martín (08/10/2026, punto 12): «Deberías agregar todo un sistema de ETIQUETAS...
// que el usuario elija qué nombres ponerles y si están vinculadas a etapas del CRM... esas
// mismas etiquetas que se asignan en MaKo, se pongan en esas ambas plataformas».
//
// Módulo PURO y sin `server-only`: lo importan los tests, la ruta y el registro de la API.
// Acá vive todo lo que se puede decidir sin leer la base —el nombre, el color, qué etiqueta
// del celular es una lista del sistema, y quién apunta a una etiqueta
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

/** Hasta cuántos leads de un lote se pasan a WhatsApp en la misma llamada. */
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

// ── Archivar: lo que se le dice a la persona antes del «sí» ──────────────────

/** Quién apunta a una etiqueta (`usoDeEtiqueta`, lib/etiquetas.ts). `null` = no se pudo contar. */
export type UsoEtiqueta = { disparadores: number | null; condiciones: number | null; acciones: number | null; leads: number | null };

/**
 * La consecuencia de archivar, en UNA frase: la dicen la confirmación del CRUD
 * (app/crm/EditorEtiquetas.tsx) y la propuesta de MaKo (`archivar_etiqueta`, crm.run.ts). Una sola
 * redacción para las dos, porque las dos tenían la suya y una prometía lo que el motor no hacía.
 *
 * ⚠️ LO QUE AFIRMA ES LA DECISIÓN DEL 08/10/2026: archivar una etiqueta la APAGA — deja de contar
 * en las condiciones y no dispara más (el motor la excluye, lib/nutricion.ts) — y los leads
 * conservan la fila como historia (la ficha la muestra «(archivada)»). Si el motor dejara de
 * excluirla, esta frase vuelve a mentir: el test del motor es el que la sostiene.
 * Lo que no se pudo contar se dice, no se inventa. `null` = nada la usa (no hace falta preguntar).
 */
export function consecuenciaDeArchivar(u: UsoEtiqueta): string | null {
  const autom = (u.disparadores ?? 0) + (u.condiciones ?? 0) + (u.acciones ?? 0);
  const partes: string[] = [];
  if (autom) partes.push(`deja de contar en ${autom} ${autom === 1 ? 'paso' : 'pasos'}${u.disparadores ? ' o disparadores' : ''} de automatizaciones`);
  if (u.leads) partes.push(u.leads === 1 ? 'el lead que la tiene la conserva como historia' : `los ${u.leads} leads que la tienen la conservan como historia`);
  if (u.condiciones == null) partes.push('no pude contar las automatizaciones');
  if (!partes.length) return null;
  const frase = partes.join(' y ');
  return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.`;
}

// ── Quién la puso, para un canal sin datos del equipo ────────────────────────

/**
 * `puesta_por` guarda el EMAIL de la sesión que la puso (`autorDelMovimiento`), y por HTTP no
 * viajan datos del equipo: `historial_lead` y `notas_lead`, que traen el mismo autor, son SIN_HTTP
 * (revisión del 08/10/2026, datos-7). Lo de MaKo sale tal cual («MaKo», «MaKo · automatización
 * «x»»: el nombre de una automatización del negocio, no de una persona); cualquier otra cosa —un
 * email, un nombre, el default «CRM» de la columna— es «una persona».
 */
export function autorPublico(puestaPor: string | null | undefined): string {
  const s = (puestaPor ?? '').trim();
  return /^MaKo(?:\s·\s|$)/.test(s) ? s : 'una persona';
}

// ── Las copias a un workspace de prueba ──────────────────────────────────────

export type TraduccionEtiquetas = {
  /** Los pasos con los ids traducidos (un array NUEVO; el de entrada no se toca). */
  pasos: unknown;
  /** La columna `nutricion_secuencias.etiqueta_id` (el disparador «se le puso X»), traducida. */
  etiquetaId: number | null;
  /** Cuántos ids de etiqueta no estaban en el mapa y quedaron vacíos. */
  sinTraducir: number;
};

const idEtiqueta = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Los ids de etiquetas que viven ADENTRO de una secuencia, traducidos con el mapa de una copia
 * (lib/datos-mau.ts y lib/clonar-config.ts → el workspace de prueba). Revisión del 08/10/2026,
 * datos-6: las copias llevaban los ids del DUEÑO, y como los ids de `crm_etiquetas` son globales,
 * en el destino nunca coinciden — la condición «tiene X» no se cumplía nunca, el paso ⚡ contestaba
 * «No existe la etiqueta» y el disparador no corría, todo sin un error. La prueba no probaba lo que
 * decía.
 *
 * Mira las TRES formas en que una secuencia nombra una etiqueta (las mismas que `usoEnPasos`):
 *   · `ramas[].filas[]` con `campo: 'etiqueta'` → `valor` (lib/flujo-grafo.ts);
 *   · `accion.params.etiquetaId` de un paso «⚡ Acción» (cualquier operación que la nombre);
 *   · la columna `etiqueta_id` del disparador.
 * ⚠️ LO QUE NO ESTÁ EN EL MAPA QUEDA VACÍO, nunca con el id viejo: un id del dueño que sobrevive
 * apunta a una etiqueta que en el destino no existe o, por casualidad, a OTRA. Vacía, la condición
 * la marca el lienzo y Publicar la frena («falta elegir la etiqueta»), que es el estado honesto.
 */
export function traducirEtiquetasEnSecuencia(pasos: unknown, etiquetaId: unknown, traducir: (id: number) => number | null): TraduccionEtiquetas {
  let sinTraducir = 0;
  const tr = (v: unknown): number | null => {
    const id = idEtiqueta(v);
    if (id == null) return null;
    const nuevo = traducir(id);
    if (nuevo == null) sinTraducir++;
    return nuevo;
  };
  const columna = etiquetaId == null ? null : tr(etiquetaId);
  if (!Array.isArray(pasos)) return { pasos, etiquetaId: columna, sinTraducir };
  const nuevos = pasos.map((p) => {
    if (!p || typeof p !== 'object') return p;
    const paso = { ...(p as Record<string, unknown>) };
    if (Array.isArray(paso.ramas)) {
      paso.ramas = paso.ramas.map((r) => {
        if (!r || typeof r !== 'object' || !Array.isArray((r as { filas?: unknown }).filas)) return r;
        const rama = r as { filas: unknown[] };
        return {
          ...rama,
          filas: rama.filas.map((f) => {
            if (!f || typeof f !== 'object' || (f as { campo?: unknown }).campo !== 'etiqueta') return f;
            return { ...(f as Record<string, unknown>), valor: tr((f as { valor?: unknown }).valor) };
          }),
        };
      });
    }
    const a = paso.accion as { params?: Record<string, unknown> } | undefined;
    if (a && typeof a === 'object' && a.params && typeof a.params === 'object' && 'etiquetaId' in a.params) {
      const params = { ...a.params };
      const nuevo = tr(params.etiquetaId);
      if (nuevo == null) delete params.etiquetaId; else params.etiquetaId = nuevo;
      paso.accion = { ...a, params };
    }
    return paso;
  });
  return { pasos: nuevos, etiquetaId: columna, sinTraducir };
}

// ── El espejo etapa→etiqueta para lo que NO pasa por un movimiento explícito ─

/**
 * La FOTO con la que el barrido horario (lib/etiquetas.ts, `conciliarEspejoEtapas`) detecta que un
 * lead CAMBIÓ de etapa sin que nadie llamara al espejo: la etapa DERIVADA (Calendly le carga la
 * fecha y el tablero lo muestra en «Agenda R1» sin escribir `pipeline_stage`), un alta, una fila de
 * otro producto escrita por otro camino. Revisión del 08/10/2026 (etiquetas-3, datos-2).
 *
 * ⚠️ ES UNA FOTO Y NO UNA RECONCILIACIÓN DE ESTADO, a propósito. La salida obvia —«por cada etiqueta
 * vinculada, ponérsela a los que están en su etapa y sacársela a los que no»— era la equivocada:
 *   · DESHACE DECISIONES DE PERSONAS: una etiqueta vinculada que alguien sacó a mano vuelve en la
 *     hora siguiente, y la que alguien puso sobre un lead que no se pudo mover (un cierre, un lead
 *     cerrado, otro producto) desaparece;
 *   · CONTRADICE EL CONTRATO DEL VÍNCULO: «cambiar el vínculo vale de acá en adelante» (editarEtiqueta,
 *     crm.def editar_etiqueta). Vincular «Cualificado» —puesta a mano a 300 leads— a una etapa se la
 *     sacaría en una hora a todos los que no están ahí.
 * El espejo es de TRANSICIONES («entrar a la etapa la pone, salir la saca», diseño §5), así que el
 * barrido compara contra la etapa que vio la vez anterior y sólo actúa sobre lo que se movió.
 *
 * Clave: `${leadId}:${productoId}` (el producto REAL, el default incluido: no NULL). `productos`
 * son los que tenían alguna etiqueta vinculada al sacar la foto: una clave nueva de un producto que
 * ya se miraba es un lead que ENTRÓ (alta, agregado); una de un producto que recién se empieza a
 * mirar es la línea de base, sin tocar nada (lo mismo que la primera corrida).
 */
export type FotoEspejo = { v: 1; at: string; productos: number[]; etapas: Record<string, string> };
export type EtapaActual = { leadId: number; productoId: number; etapa: string };
export type TransicionEspejo = { leadId: number; productoId: number; desde: string | null; hacia: string | null };

export const claveEspejo = (leadId: number, productoId: number): string => `${leadId}:${productoId}`;

/** La foto guardada, o null si no hay o no se entiende (null = la próxima es la línea de base). */
export function leerFotoEspejo(raw: string | null | undefined): FotoEspejo | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<FotoEspejo>;
    if (p?.v !== 1 || typeof p.at !== 'string' || !Array.isArray(p.productos) || !p.etapas || typeof p.etapas !== 'object') return null;
    const etapas: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.etapas)) if (typeof v === 'string' && /^\d+:\d+$/.test(k)) etapas[k] = v;
    return { v: 1, at: p.at, productos: p.productos.map(Number).filter((n) => Number.isInteger(n) && n > 0), etapas };
  } catch {
    return null;
  }
}

/**
 * Qué se movió desde la foto anterior, y la foto nueva. `tope` acota cuántas transiciones se
 * aplican en UNA corrida: las que no entran quedan en la foto nueva con su etapa VIEJA (o sin
 * clave, si era una entrada), así la corrida siguiente las vuelve a ver. Un lead que ya no existe
 * se suelta sin transición (sus filas se fueron con él, por la FK).
 */
export function planEspejo(
  foto: FotoEspejo | null,
  actuales: ReadonlyArray<EtapaActual>,
  leadsVivos: ReadonlySet<number>,
  productos: ReadonlyArray<number>,
  opts: { ahora: string; tope: number },
): { transiciones: TransicionEspejo[]; diferidas: number; foto: FotoEspejo } {
  const etapas: Record<string, string> = {};
  for (const a of actuales) etapas[claveEspejo(a.leadId, a.productoId)] = a.etapa;
  const nueva: FotoEspejo = { v: 1, at: opts.ahora, productos: [...new Set(productos)].sort((a, b) => a - b), etapas };
  if (!foto) return { transiciones: [], diferidas: 0, foto: nueva };

  const mirados = new Set(foto.productos);
  const vigentes = new Set(productos);
  const todas: TransicionEspejo[] = [];
  for (const a of actuales) {
    const previa = foto.etapas[claveEspejo(a.leadId, a.productoId)];
    if (previa !== undefined) { if (previa !== a.etapa) todas.push({ leadId: a.leadId, productoId: a.productoId, desde: previa, hacia: a.etapa }); }
    else if (mirados.has(a.productoId)) todas.push({ leadId: a.leadId, productoId: a.productoId, desde: null, hacia: a.etapa });
  }
  for (const [k, previa] of Object.entries(foto.etapas)) {
    if (k in etapas) continue;
    const [leadId, productoId] = k.split(':').map(Number);
    if (leadsVivos.has(leadId) && vigentes.has(productoId)) todas.push({ leadId, productoId, desde: previa, hacia: null });
  }
  todas.sort((x, y) => x.leadId - y.leadId || x.productoId - y.productoId);

  const tope = Math.max(0, Math.trunc(opts.tope));
  const transiciones = todas.slice(0, tope);
  for (const t of todas.slice(tope)) {
    const k = claveEspejo(t.leadId, t.productoId);
    if (t.desde == null) delete etapas[k]; else etapas[k] = t.desde;
  }
  return { transiciones, diferidas: todas.length - transiciones.length, foto: nueva };
}
