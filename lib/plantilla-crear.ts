// =============================================================================
// plantilla-crear — crear una automatización DESDE UNA PLANTILLA de la galería
// =============================================================================
// Pedido de Martín (10/10/2026): «Si, hagamos la galería de las más comunes...». El catálogo vive en
// lib/plantillas-automatizaciones.ts; esto es lo que hace el server cuando alguien elige una
// (POST /api/chat-agent/secuencias `{ action: 'crear_desde_plantilla', plantilla, disparador? }`).
//
// Las decisiones, cada una con su porqué (el molde es «Duplicar», lib/secuencia-duplicar.ts):
//
//   · NACE APAGADA, SIEMPRE, en el workspace de quien la pide (la base del inquilino, `getTenantDb`)
//     y sin un solo envío: crear no inscribe a nadie, y el CRON no corre sobre una automatización
//     pausada. Prenderla es una decisión de la persona, con la validación de Activar.
//   · LOS PASOS ENTRAN POR `setSecuenciaPasos`, la puerta de todos los escritores de `pasos`
//     (AGENTS.md): normaliza, valida con `validarGrafo` y rechaza lo imposible. Un `insert` con los
//     pasos adentro sería un escritor por el costado.
//   · EL CRON ENTRA POR `guardarDisparadores` (la lista de CRON, mig 0241), con la etapa que eligió
//     la pantalla (`disparadorDeEleccion`). Sin elegir, nace con el CRON a elegir —el `manual` de
//     «＋ Nueva»—, y la tarjeta CRON dice «Elige qué la dispara». ⚠️ UNA ETAPA QUE NO SE PUDO
//     GUARDAR NO TUMBA LA AUTOMATIZACIÓN: la persona eligió una plantilla y la plantilla está; lo que
//     falta es el CRON, y eso se dice (`aviso`) y se elige en el lienzo. Es lo que hace Crear con IA
//     (app/api/chat-agent/secuencias/ia/route.ts, «No pude poner qué la dispara»).
//   · SI LOS PASOS FALLAN, SE BORRA. Una automatización con el nombre de la plantilla y sin sus
//     tarjetas dice ser algo que no es. Recién creada no tiene inscripciones ni envíos: borrarla no
//     se lleva nada.
//   · UN CRON FIJO (`cron.fijo`, el recordatorio de la reunión, 10/10/2026) NACE EN LA FILA, no por
//     `guardarDisparadores`: `setSecuenciaPasos` lee el `trigger_tipo` de la fila para saber si tiene que
//     exigir la forma que el emisor del recordatorio sabe mandar, así que tiene que estar ANTES de los
//     pasos. Y un negocio tiene UNO: con dos, el emisor manda la primera activa por cada minuto y la
//     lista muestra dos recordatorios sin decir cuál sale. Si ya lo tiene (sin archivar), no se crea nada.
//   · UN EVENTO DE MaKo (`cron.fijo: TRIGGER_AVISO_MAKO`, «MaKo en WhatsApp», 11/10/2026) NACE EN LA FILA con
//     su lista de CRON puesta (`disparadores: [{ trigger_tipo: 'aviso_mako', subtipo: <evento> }]`), en el
//     MISMO insert y antes de los pasos: `setSecuenciaPasos` lee el evento para frenar lo que su emisor no sabe
//     mandar (`frenoDelEvento`), y sin él la fila quedaría «Elige el evento» y no saldría nunca. Por la lista de
//     CRON (`guardarDisparadores`) no puede: un CRON del emisor no se cambia (`problemaDeCambio`). Y de un
//     evento se permiten VARIAS: «uno por negocio» es sólo del recordatorio (dos filas del mismo evento salen
//     las dos, como dos automatizaciones del mismo CRON).
//   · EL EVENTO DE UN CANAL (`cron.fijo` Instagram, Messenger o «Recibes un email», décima tanda, 11/10/2026:
//     docs/diseno-automations-galeria-v2.md §3) NACE EN LA FILA igual que el de MaKo, con su lista de CRON puesta
//     (`subtipo` = el evento). A diferencia del de MaKo, NO es del emisor: el CRON se cambia después como cualquiera.
//     Va en la fila y no por `guardarDisparadores` porque no hay nada que elegir: es la plantilla la que lo trae.
//   · «SE LE PUSO [UNA ETIQUETA]» (`cron.pide: 'etiqueta'`, la bienvenida al newsletter): la etiqueta es del
//     negocio y la elige la pantalla; entra por `guardarDisparadores` como una etapa (`disparadorDeEleccion`). Sin
//     elegir, nace con el CRON a elegir.
//
// ⚠️ SIN `server-only` Y SIN IMPORTS DEL SERVIDOR, a propósito: la base y los dos setters entran por
// parámetro, así el test (tests/plantillas-automatizaciones.test.ts) ejecuta la función entera con
// una base de mentira. La ruta enchufa los de verdad.

import {
  plantillaPorId, pasosDePlantilla, nombreLibre, disparadorDeEleccion,
  type PlantillaAutomatizacion, type PideCron,
} from './plantillas-automatizaciones';
import { TRIGGER_AVISO_MAKO, TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO, type Disparador } from './disparadores';
import { TRIGGER_RECORDATORIO } from './recordatorio-automatizacion';
import { emojiDeSecuencia } from './flujo-conversacion';

/** Lo que pidió no es una plantilla de la galería, o la etapa no es del kanban que pide: es del que pide (400). */
export class PlantillaInvalidaError extends Error {
  constructor(m: string) { super(m); this.name = 'PlantillaInvalidaError'; }
}

type Resp<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

/**
 * Lo mínimo que la función le pide a la base del inquilino (`getTenantDb()`). La ruta pasa la de
 * verdad con un cast: el tipo de supabase-js no se deja comparar estructuralmente con esto.
 */
export type DbPlantilla = {
  from(tabla: 'nutricion_secuencias'): {
    select(cols: string): { is(col: string, v: null): Resp<Array<{ nombre: string | null; trigger_tipo?: string | null }>> };
    insert(fila: Record<string, unknown>): { select(cols: string): { single(): Resp<{ id: number }> } };
    delete(): { eq(col: string, v: number): Resp<unknown> };
  };
};

export type DepsPlantilla = {
  db: DbPlantilla;
  /** `setSecuenciaPasos` (lib/nutricion.ts). */
  setPasos: (id: number, pasos: never[]) => Promise<void>;
  /** `guardarDisparadores` (lib/disparadores-guardar.ts). */
  setDisparadores: (id: number, lista: Disparador[]) => Promise<unknown>;
  /**
   * El motivo, si el error del CRON es de la PERSONA (`TriggerInvalidoError`: la etapa no existe, el
   * producto está archivado). null = es otra cosa (la base): ésa sí deshace todo.
   */
  motivoDeCron?: (e: unknown) => string | null;
  /** Para el test: la clave nueva. Sin pasar nada, una al azar como la de «＋ Nueva». */
  clave?: () => string;
};

export type CreadaDesdePlantilla = {
  id: number;
  nombre: string;
  /** Qué le falta elegir en el CRON (null = se guardó la etapa). */
  pide: PideCron | null;
  /** Por qué no se pudo guardar la etapa elegida, si pasó. */
  aviso: string | null;
};

const claveNueva = (p: PlantillaAutomatizacion) => `plantilla-${p.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * La fila que se inserta: apagada, sin pasos (entran después por su puerta) y con el CRON a elegir, o con el
 * suyo si es fijo. `etapa: 'manual'` porque la columna es NOT NULL: es lo mismo que escribe «＋ Nueva»
 * (`crearSecuenciaVacia`, lib/setting-secuencias.ts).
 */
export function filaDePlantilla(p: PlantillaAutomatizacion, clave: string, nombre: string): Record<string, unknown> {
  const fila: Record<string, unknown> = { clave, nombre, etapa: 'manual', trigger_tipo: p.cron.fijo ?? 'manual', activa: false, pasos: [], emoji: emojiDeSecuencia(p.emoji) };
  // El evento de MaKo o de un canal: CUÁL evento va en la lista de CRON (mig 0241), y nace con ella (ver la cabecera).
  if (p.cron.fijo && CON_EVENTO.has(p.cron.fijo) && p.cron.evento) fila.disparadores = [{ id: 'd1', trigger_tipo: p.cron.fijo, subtipo: p.cron.evento }];
  return fila;
}

/** Los CRON fijos que traen CUÁL evento (el `subtipo`): el de MaKo y los de un canal. El recordatorio, no. */
const CON_EVENTO: ReadonlySet<string> = new Set([TRIGGER_AVISO_MAKO, TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO]);

/** Crea la automatización de la plantilla `plantillaId`. Devuelve la creada, o tira con el motivo. */
export async function crearDesdePlantilla(plantillaId: unknown, deps: DepsPlantilla, o: { disparador?: unknown } = {}): Promise<CreadaDesdePlantilla> {
  const p = plantillaPorId(plantillaId);
  if (!p) throw new PlantillaInvalidaError('Esa plantilla no existe.');
  // Lo elegido se entiende ANTES de crear nada: una etapa de otro kanban es un error de quien pide, y una
  // plantilla con el CRON fijo (sin `pide`) no se arranca en ninguna etapa.
  const pidio = o.disparador != null && o.disparador !== '';
  const elegido = !pidio || !p.cron.pide ? null : disparadorDeEleccion(p.cron.pide, o.disparador);
  if (pidio && !elegido) throw new PlantillaInvalidaError('Esa etapa no sirve para esta plantilla.');

  const { data: vivas, error: errNombres } = await deps.db.from('nutricion_secuencias').select('nombre, trigger_tipo').is('archivada_at', null);
  if (errNombres) throw new Error(`crearDesdePlantilla: ${errNombres.message}`);
  // «Ya la tienes» es SÓLO del recordatorio: de un evento de MaKo se permiten varias (ver la cabecera).
  if (p.cron.fijo === TRIGGER_RECORDATORIO && (vivas ?? []).some((r) => r.trigger_tipo === TRIGGER_RECORDATORIO)) {
    throw new PlantillaInvalidaError('Ya la tienes en tu lista.');
  }
  const nombre = nombreLibre(p.nombre, (vivas ?? []).map((r) => String(r.nombre ?? '')));

  const fila = filaDePlantilla(p, (deps.clave ?? (() => claveNueva(p)))(), nombre);
  const { data: nueva, error: errIns } = await deps.db.from('nutricion_secuencias').insert(fila).select('id').single();
  if (errIns || !nueva) throw new Error(`crearDesdePlantilla: ${errIns?.message ?? 'no se creó'}`);

  const borrar = () => Promise.resolve(deps.db.from('nutricion_secuencias').delete().eq('id', nueva.id)).catch(() => {});
  try {
    await deps.setPasos(nueva.id, pasosDePlantilla(p) as never[]);
  } catch (e) {
    // El motivo de `setSecuenciaPasos` es el que la pantalla muestra («No se guardó: …»). Si el
    // borrado falla, el motivo sigue siendo el otro.
    await borrar();
    throw e;
  }

  if (!elegido) return { id: nueva.id, nombre, pide: p.cron.pide ?? null, aviso: null };
  try {
    await deps.setDisparadores(nueva.id, [elegido]);
    return { id: nueva.id, nombre, pide: null, aviso: null };
  } catch (e) {
    const motivo = deps.motivoDeCron?.(e) ?? null;
    if (motivo == null) { await borrar(); throw e; }
    return { id: nueva.id, nombre, pide: p.cron.pide ?? null, aviso: `No pude poner la etapa (${motivo}): elígela en el CRON.` };
  }
}
