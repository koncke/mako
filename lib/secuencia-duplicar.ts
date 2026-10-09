// =============================================================================
// secuencia-duplicar — «Duplicar» de los tres puntos de la lista de /chatbot
// =============================================================================
// Pedido de Martín (09/10/2026, tercera tanda, punto 6): «en la sidebar donde están todas las
// secuencias pon los típicos 3 puntos para poder hacer estas acciones, como activarla, eliminarla,
// etc...». Decisión 6 del diseño (docs/chatbot-flujo-ramas-diseno.md): Activar/Pausar, Duplicar y
// Eliminar. Duplicar = una automatización PAUSADA con los mismos pasos y el mismo disparador.
//
// Las decisiones, cada una con su porqué:
//
//   · NACE PAUSADA, SIEMPRE. Una copia prendida de una secuencia prendida le manda el mismo
//     mensaje DOS veces a cada lead que entra (las dos inscriben por el mismo disparador). Prenderla
//     es una decisión de la persona, con la validación de Activar.
//   · LOS PASOS ENTRAN POR `setSecuenciaPasos` (la puerta de todos los escritores de `pasos`,
//     AGENTS.md): normaliza, valida y conserva lo que cada parte le enseñe a guardar (el `cuerpo_html`
//     del email, por ejemplo). Un `insert` con los pasos crudos sería un escritor por el costado.
//   · EL HORARIO ENTRA POR `setCronSecuencia`, que SIEMBRA la próxima ocurrencia en la zona del
//     negocio. Copiar `cron_proxima_at` tal cual le daría a la copia la de la original —si la
//     original está pausada hace meses, una fecha pasada que dispara apenas se prenda—.
//   · LO QUE SE COPIA ES UNA LISTA BLANCA (`COPIA`). Medido el 09/10/2026 contra
//     information_schema: 18 columnas. Lo que no está en ninguna de las dos listas no se copia: una
//     columna nueva (un contador, una marca de envío) copiada a ciegas sería un dato falso en la
//     copia. `emoji` (mig 0229, la parte B de la tercera tanda) se copia si la fila lo trae, y
//     `posiciones` (mig 0233, quinta tanda) también: los pasos conservan sus ids al pasar por
//     `setSecuenciaPasos`, así que la copia se dibuja acomodada igual que la original.
//   · SI ALGO FALLA DESPUÉS DE CREARLA, SE BORRA. Una copia a medias (sin pasos, o sin su horario)
//     es una automatización que dice ser la otra y no lo es. Recién creada no tiene inscripciones ni
//     envíos, así que borrarla no se lleva nada.
//
// ⚠️ SIN `server-only` Y SIN IMPORTS DEL SERVIDOR, a propósito: las piezas del servidor (la base,
// `setSecuenciaPasos`, `setCronSecuencia`) entran por parámetro, así el test ejecuta la función
// entera con una base de mentira. La ruta (app/api/chat-agent/secuencias/route.ts, acción
// `duplicar`) es la que enchufa las de verdad.

import { TOPE_NOMBRE_SECUENCIA } from './setting-estrategia';

/** Las columnas que la copia trae tal cual de la original. */
export const COPIA = ['etapa', 'etapas', 'trigger_tipo', 'estrategia', 'funnel_id', 'producto_id', 'instance_name', 'etiqueta_id', 'emoji', 'posiciones'] as const;

/**
 * Las que NO se copian, cada una por algo: la identidad (`id`, `clave`, `workspace_id`, que pone
 * la base del inquilino), el estado (`activa` nace en false, `archivada_at` en null), las marcas de
 * tiempo, y lo que entra por su puerta (`nombre` se arma, `pasos` y `cron` van por sus setters,
 * `cron_proxima_at` la siembra `setCronSecuencia`).
 */
export const NO_SE_COPIA = ['id', 'clave', 'workspace_id', 'activa', 'archivada_at', 'created_at', 'updated_at', 'nombre', 'pasos', 'cron', 'cron_proxima_at'] as const;

export type FilaOriginal = Record<string, unknown> & { id: number; nombre?: unknown; pasos?: unknown; cron?: unknown };

/**
 * El nombre de la copia: «Copia de …» con el tope de la lista. Se corta el FINAL del nombre y no
 * el «Copia de»: sin la marca, la copia y la original se leen iguales en la lista.
 */
export function nombreDeCopia(nombre: unknown): string {
  const base = String(nombre ?? '').trim().replace(/\s+/g, ' ');
  return `Copia de ${base || 'una automatización'}`.slice(0, TOPE_NOMBRE_SECUENCIA).trim();
}

/** La fila que se inserta: pausada, sin pasos ni horario (entran después por sus puertas). */
export function filaDeCopia(original: FilaOriginal, clave: string): Record<string, unknown> {
  const fila: Record<string, unknown> = { clave, nombre: nombreDeCopia(original.nombre), activa: false, pasos: [], cron: null };
  for (const k of COPIA) if (k in original) fila[k] = original[k] ?? null;
  return fila;
}

type Resp<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

/**
 * Lo mínimo que la función le pide a la base del inquilino (`getTenantDb()`). La ruta pasa la de
 * verdad con un cast: el tipo de supabase-js no se deja comparar estructuralmente con esto.
 */
export type DbDuplicar = {
  from(tabla: 'nutricion_secuencias'): {
    select(cols: string): { eq(col: string, v: number): { is(col: string, v: null): { maybeSingle(): Resp<FilaOriginal> } } };
    insert(fila: Record<string, unknown>): { select(cols: string): { single(): Resp<{ id: number }> } };
    delete(): { eq(col: string, v: number): Resp<unknown> };
  };
};

export type DepsDuplicar = {
  db: DbDuplicar;
  /** `setSecuenciaPasos` (lib/nutricion.ts). */
  setPasos: (id: number, pasos: never[]) => Promise<void>;
  /** `setCronSecuencia` (lib/setting-secuencias.ts). */
  setCron: (id: number, cron: unknown) => Promise<void>;
  /** Para el test: la clave nueva. Sin pasar nada, una al azar como la de «＋ Nueva». */
  clave?: () => string;
};

const claveNueva = () => `copia-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Duplica una automatización vigente. Devuelve la copia, o tira con el motivo. */
export async function duplicarSecuencia(id: number, deps: DepsDuplicar): Promise<{ id: number; nombre: string }> {
  const { data: original, error } = await deps.db.from('nutricion_secuencias').select('*').eq('id', id).is('archivada_at', null).maybeSingle();
  if (error) throw new Error(`duplicarSecuencia: ${error.message}`);
  if (!original) throw new Error('Esa automatización ya no está.');
  const fila = filaDeCopia(original, (deps.clave ?? claveNueva)());
  const { data: nueva, error: errIns } = await deps.db.from('nutricion_secuencias').insert(fila).select('id').single();
  if (errIns || !nueva) throw new Error(`duplicarSecuencia: ${errIns?.message ?? 'no se creó'}`);
  try {
    const pasos = Array.isArray(original.pasos) ? original.pasos : [];
    if (pasos.length) await deps.setPasos(nueva.id, pasos as never[]);
    if (original.cron != null) await deps.setCron(nueva.id, original.cron);
  } catch (e) {
    // Se borra la copia a medias y se cuenta por qué (el motivo de `setSecuenciaPasos` es el que
    // la pantalla muestra: «No se guardó: …»). Si el borrado falla, el motivo sigue siendo el otro.
    await Promise.resolve(deps.db.from('nutricion_secuencias').delete().eq('id', nueva.id)).catch(() => {});
    throw e;
  }
  return { id: nueva.id, nombre: String(fila.nombre) };
}
