// =============================================================================
// flujo-ia-crear-core — CREAR una automatización con IA: el orden de las cosas (puro, con test)
// =============================================================================
// Décima tanda (11/10/2026, NUEVA AUTOMATIZACIÓN 6 y 8; docs/diseno-automations-galeria-v2.md §2 y §4). Martín: «La
// opción de "Pídeselo a MaKo" no debería ser un botón que me lleve al lienzo... allí mismo ya debería poder escribir y
// grabar audio» y «El paso de "Pídeselo a MaKo" quiero que lo guardes en la API... por el grupo de WhatsApp con MaKo».
//
// UNA IMPLEMENTACIÓN, DOS PUERTAS: la caja del modal «Nueva automatización» (la ruta /api/chat-agent/secuencias/ia,
// con stream) y la acción `crear_automatizacion_con_ia` de la API de MaKo (sin stream). Las dos llaman a
// `crearFlujoConIA` (lib/flujo-ia-crear.ts, server-only), que enchufa las dependencias de verdad a ESTO.
//
// ⚠️ SIN `secuenciaId`, LA FILA NACE AL GUARDAR, NO ANTES. Hasta la décima tanda crear exigía una vacía (`crear_vacia`
// primero): con eso, un «Cancelar» o un fallo de la IA dejaba una automatización vacía huérfana en la lista. Ahora se
// inserta (`insertar`, que es `crearSecuenciaVacia`: pausada y con el nombre) RECIÉN después de que el modelo contestó,
// la revisión pasó y nadie canceló; y si los pasos no se guardan, se BORRA (como en lib/plantilla-crear.ts). Con
// `secuenciaId` (la caja de un lienzo vacío, que hoy no se dibuja), se escribe encima de esa, que tiene que seguir vacía.
//
// ⚠️ PURO Y SIN `server-only`, a propósito: todo lo que toca la base o un modelo entra por `DepsCrearIA`, así
// tests/flujo-ia-crear.test.ts lo EJECUTA con dependencias de mentira (que la IA falle o se cancele no escribe nada).
// =============================================================================

import { validarGrafo, type PasoGrafo } from './flujo-grafo';
import {
  deIA, validarIA, userDeCrear, leyendoDe, leyendoTexto, conEtiquetasReales, refsSinResolver, disparadorReal, ordenDeRevelado,
  type CtxIA, type EventoIA, type ResultadoIA, type FalloIA, type EtiquetaNueva,
} from './flujo-ia';
import { ordenarAvisos } from './flujo-ia-cliente';

/** Lo que tiene el modelo para contestar, si quien llama no dice otra cosa (la ruta: 300 s de función). */
export const PLAZO_CREAR_MS = 220_000;

/** Una fase del trabajo (lo que la ruta convierte en el stream). */
export type FaseCrearIA = Extract<EventoIA, { t: 'fase' }>;

export type OptsCrearIA = {
  ws: number;
  pedido: string;
  /** La automatización VACÍA sobre la que se escribe. Sin esto, la fila nace al guardar. */
  secuenciaId?: number | null;
  /** Desde el arranque, cuánto tiene el modelo (la API: menos, su turno ya gastó lo suyo). */
  plazoMs?: number;
  /** Cuándo arrancó el pedido (ms). Sin esto, ahora. */
  inicio?: number;
  /** Cancelar: se mira ANTES de escribir nada (después de la revisión ya no). */
  signal?: AbortSignal;
  alFase?: (f: FaseCrearIA) => void;
};

export type CreadaConIA = {
  ok: true;
  secuenciaId: number;
  nombre: string;
  /** Lo que quedó GUARDADO (`setSecuenciaPasos` normaliza): lo que va a leer el motor. */
  pasos: PasoGrafo[];
  orden: string[];
  /** Ordenados por lo que cambian en lo que sale (`ordenarAvisos`). */
  avisos: string[];
  etiquetasNuevas: Array<{ id: number; nombre: string }>;
  /** El valor del CRON que quedó PUESTO, o null. */
  disparador: string | null;
};
export type ResultadoCrearIA = CreadaConIA | { ok: false; error: string; link?: string; cancelado?: true };

type Traducido = { r: ResultadoIA; errores: string[] };

export type DepsCrearIA = {
  /** Lo que el negocio tiene configurado (`armarContexto`). */
  contexto: (pedido: string) => Promise<{ ctx: CtxIA; perfil: string; voz: string | null }>;
  /** El system prompt de crear (editable en /configuraciones). */
  system: () => Promise<string>;
  /** La cascada gratis con sus tres escalones (`generar`). */
  generar: (p: { system: string; user: string; hastaMs: number; traducir: (obj: Record<string, unknown>) => Traducido }) => Promise<{ r: ResultadoIA } | FalloIA>;
  crearEtiquetas: (nuevas: EtiquetaNueva[]) => Promise<{ ids: Map<number, number>; creadas: Array<{ id: number; nombre: string }> }>;
  /** Los pasos guardados de una fila y su nombre (null = no existe en este negocio). */
  filaDe: (id: number) => Promise<{ pasos: PasoGrafo[]; nombre: string } | null>;
  /** Inserta la fila nueva, PAUSADA y vacía, con el nombre (normalizado ahí). */
  insertar: (nombre: string | null) => Promise<{ id: number; nombre: string }>;
  borrar: (id: number) => Promise<void>;
  pausar: (id: number) => Promise<void>;
  guardarPasos: (id: number, pasos: PasoGrafo[]) => Promise<void>;
  /** El motivo si el error de guardar es de los pasos (`PasosInvalidosError`); null = otra cosa. */
  motivoDePasos: (e: unknown) => string | null;
  ponerDisparador: (id: number, valor: string) => Promise<void>;
  /** El motivo si el error del CRON es de la persona (`TriggerInvalidoError`); null = otra cosa. */
  motivoDeDisparador: (e: unknown) => string | null;
  /** Renombra con el nombre propuesto; devuelve el que quedó, o null si no había nada que poner. */
  renombrar: (id: number, nombre: string) => Promise<string | null>;
};

/** El aviso del CRON sin elegir (la pantalla lo muestra al final: `ordenarAvisos`). */
export const AVISO_SIN_CRON = 'Elige qué la dispara en el CRON';

/**
 * CREA (o llena una vacía) con el pedido. Nunca escribe antes de tener un flujo que pasó la revisión, y lo que
 * falla después de insertar una fila nueva la BORRA. Tira sólo lo inesperado (la base caída): eso lo convierte en
 * error quien llama.
 */
export async function crearConIA(o: OptsCrearIA, deps: DepsCrearIA): Promise<ResultadoCrearIA> {
  const inicio = o.inicio ?? Date.now();
  const { ctx, perfil, voz } = await deps.contexto(o.pedido);
  const leyendo = leyendoDe(ctx, perfil);
  o.alFase?.({ t: 'fase', fase: 'contexto', leyendo, texto: leyendoTexto(leyendo) });

  const system = await deps.system();
  const user = userDeCrear(ctx, { perfil, voz, pedido: o.pedido });
  const traducir = (obj: Record<string, unknown>): Traducido => {
    const r = deIA(obj, ctx);
    const errores = [...validarIA(r.pasos, ctx), ...validarGrafo(r.pasos)];
    if (!r.pasos.some((x) => !x.nodo)) errores.unshift('el flujo quedó sin ningún mensaje ni acción');
    return { r, errores };
  };

  o.alFase?.({ t: 'fase', fase: 'modelo' });
  const g = await deps.generar({ system, user, hastaMs: inicio + (o.plazoMs ?? PLAZO_CREAR_MS), traducir });
  if ('error' in g) return { ok: false, error: g.error, ...(g.link ? { link: g.link } : {}) };
  const r = g.r;
  o.alFase?.({ t: 'fase', fase: 'revision', reparadas: r.avisos.length });

  // Cancelado mientras el modelo escribía: no queda NADA escrito (ni etiquetas, ni la fila).
  if (o.signal?.aborted) return { ok: false, error: 'Cancelado', cancelado: true };

  const { ids, creadas } = await deps.crearEtiquetas(r.etiquetasNuevas);
  const pasos = conEtiquetasReales(r.pasos, ids);
  if (refsSinResolver(pasos).length) throw new Error('Quedó una etiqueta sin crear.');
  const avisos = [...r.avisos];

  // LA FILA. Con id: se vuelve a mirar que siga vacía (otra pestaña pudo escribir) y se PAUSA antes de escribir.
  // Sin id: nace ACÁ, pausada y con el nombre, recién ahora que hay un flujo que guardar.
  let id: number;
  let nombre: string;
  let nueva = false;
  if (o.secuenciaId != null) {
    const ya = await deps.filaDe(o.secuenciaId);
    if (ya == null) return { ok: false, error: 'Esa automatización ya no existe.' };
    if (ya.pasos.length) return { ok: false, error: 'Alguien le puso tarjetas mientras tanto: no la pisé.' };
    id = o.secuenciaId;
    nombre = ya.nombre;
    // ⚠️ PRIMERO PAUSAR, DESPUÉS ESCRIBIR (revisión, 09/10/2026): si lo que sigue falla, queda pausada y vacía.
    await deps.pausar(id);
  } else {
    const fila = await deps.insertar(r.nombre);
    id = fila.id;
    nombre = fila.nombre;
    nueva = true;
  }

  try {
    await deps.guardarPasos(id, pasos);
  } catch (e) {
    // Una fila NUEVA sin sus tarjetas dice ser algo que no es: se borra (recién creada, no tiene nada adentro).
    if (nueva) await deps.borrar(id).catch(() => {});
    const motivo = deps.motivoDePasos(e);
    if (motivo != null) return { ok: false, error: `No pude guardar el flujo: ${motivo}` };
    throw e;
  }

  const valor = disparadorReal(r.disparador, ids);
  let puesto: string | null = null;
  if (valor) {
    try {
      await deps.ponerDisparador(id, valor);
      puesto = valor;
    } catch (e) {
      const motivo = deps.motivoDeDisparador(e);
      if (motivo == null) throw e;
      avisos.push(`No pude poner qué la dispara (${motivo}): elígelo en el CRON`);
    }
  } else {
    avisos.push(AVISO_SIN_CRON);
  }

  // Con id, el nombre propuesto se pone ahora (sin id ya nació con él).
  if (!nueva) {
    const n = await deps.renombrar(id, r.nombre ?? '');
    if (n) nombre = n;
  }

  // Lo que quedó GUARDADO, no lo que se mandó: el lienzo tiene que dibujar lo mismo que va a leer el motor.
  const guardado = (await deps.filaDe(id))?.pasos ?? pasos;
  return {
    ok: true, secuenciaId: id, nombre, pasos: guardado, orden: ordenDeRevelado(guardado),
    avisos: ordenarAvisos(avisos), etiquetasNuevas: creadas, disparador: puesto,
  };
}
