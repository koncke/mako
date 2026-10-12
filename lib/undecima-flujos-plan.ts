// =============================================================================
// undecima-flujos-plan — cómo quedan los flujos de PRODUCCIÓN rehechos con las piezas de hoy (puro)
// =============================================================================
// Undécima tanda (11/10/2026). Martín, con enojo y varias veces:
//   «2. En el CRON dice "Dejó su formulario sin agendar (de antes)"... Eso NO tiene sentido... la automatización
//    debería apuntar a la etapa de "Lead Entrante" y en CONDITIONS configurar que no agendó con las configuraciones
//    existentes...
//    3. ...hay 2 conditions uno al lado del otro ... en el medio de los conditions hay un delay de 1 hora...
//    6. ...Jamás se debe cambiar una tarjeta... Elimina todas los flujos y vuelvelos a hacer con las herramientas que
//    ya existen...
//    8. "Recordatorio de reunión" NO debería ser un flujo aparte ... Debería estar todo en un mismo flujo ... Y que el
//    único flujo pase a llamarse "Un Lead Agendó Llamada".»
//
// Lo que hay acá es la ESPECIFICACIÓN tarjeta por tarjeta de docs/diseno-undecima-tanda.md §3, escrita como funciones
// puras: dada la fila LEÍDA, la propuesta (pasos, CRON, columnas, nombre, prendida o no). La usa
// scripts/undecima-flujos.mts (el único que escribe, en SIMULACRO por defecto) y la prueba
// tests/undecima-flujos.test.ts con filas sintéticas de la MISMA forma.
//
// Las reglas que manda cada propuesta (y que `chequearPropuesta` vuelve a medir con las funciones del motor):
//   · el CRON es una ETAPA (`etapa_actual`) escrito con la MISMA forma que el editor del CRON
//     (lib/disparadores-guardar.ts: el primero en las columnas `columnasDeDisparador` + la lista entera en
//     `disparadores` + `disparadores_rev` subido): nunca un evento «(de antes)» (`esEventoDeAntes`);
//   · una CONDITION con VARIAS filas en UNA tarjeta, nunca dos pegadas ni con un DELAY en el medio (`problemasDeForma`);
//   · UN AI Step por medio, con su objetivo (`juntarPasosIA`); los escenarios se conservan VERBATIM;
//   · «MaKo en WhatsApp» con `params.partes` y los datos a la vista (`paramsConPartes`); nada de `{{mensaje_mako}}`
//     (`problemasDeTokens`);
//   · los recordatorios son DELAY «N antes de la reunión» del MISMO flujo (el carril del motor, M3);
//   · los ids viejos quedan en su índice y los nuevos van AL FINAL (el motor ubica una inscripción por su nodo y los
//     que todavía cuentan por índice por `paso_actual`), con ids DETERMINÍSTICOS: el simulacro muestra los mismos
//     que escribiría --aplicar;
//   · lo que sobra se ARCHIVA, nunca se borra («cerrar no es borrar»);
//   · IDEMPOTENTE: sobre la fila ya rehecha, la propuesta no cambia nada (`columnas` vacío).
//
// ⚠️ {{hora}} NO ES LO MISMO EN EL RECORDATORIO Y EN EL MOTOR. En el emisor del recordatorio (#228) `{{hora}}` es la
// hora de la REUNIÓN; en el catálogo del motor, otra cosa. Los textos de #228 se traducen con `MAPA_RECORDATORIO`
// (`{{cuando}}` → `{{reunion_cuando}}`, `{{hora}}` → `{{reunion_hora}}`, `{{faltan}}` → `{{reunion_faltan}}`,
// `{{link}}` → `{{reunion_link}}`): copiados tal cual, el «1 día antes» diría la hora de ENVÍO.
//
// ⚠️ PURO, SIN `server-only`: lo ejecutan el script y los tests.
// =============================================================================

import {
  claseDe, idDe, nodoPorId, normalizar, juntarPasosIA, esPasoIA, medioDe, validarGrafo, ID_INICIO, MEDIOS_AI_STEP,
  type PasoGrafo, type FilaCondicion, type RamaCondicion,
} from './flujo-grafo';
import { libertadDeCaso, type Libertad } from './ai-step-libertad';
import { camposDelFlujo, RELLENO_CONTROL, esNodoDeControl } from './nutricion-grafo-motor';
import { frenoDelFlujo, emojiDeSecuencia } from './flujo-conversacion';
import {
  sanearDisparadores, problemaDeDisparadores, disparadoresDe, columnasDeDisparador, firmaLista, esEventoDeAntes,
  TRIGGER_AVISO_MAKO, type Disparador, type FilaDisparadores,
} from './disparadores';
import { TRIGGER_ETAPA } from './nutricion-etapa';
import { problemasDeTokens } from './tokens-del-flujo';
import { problemasDeForma } from './flujo-forma';
import { paramsConPartes, esTarjetaTalCual } from './mako-tarjeta';
import { OP_AVISAR } from './flujo-legado';
import { LEAD_DEL_EVENTO } from './api-mako/flujo-params';
import { eventoDeFila, frenoDelEvento } from './aviso-evento';
import { PLANTILLAS, pasosDePlantilla } from './plantillas-automatizaciones';
import { tokensDe, CLAVE_MENSAJE_MAKO } from './variables-aviso';
import { sanearAccion } from './nutricion-paso-accion';
import { nombreDeSecuencia } from './setting-estrategia';

// ── Lo que dice el diseño (§3), escrito una vez ──────────────────────────────────────────────────

/** Los nombres (decisión §9.2: el de #213 es el pedido; los otros, por consistencia con las plantillas). */
export const NOMBRE_ENTRO = 'Un Lead Entró';
export const NOMBRE_AGENDO = 'Un Lead Agendó Llamada';

/** Los objetivos de los dos AI Step de prod (decisión §9.13). */
export const OBJETIVO_ENTRO = 'Que cuente a qué se dedica su negocio y agende una llamada';
export const OBJETIVO_AGENDO = 'Que llegue a su reunión confirmada y sin hablar de cifras';

/** Los ids NUEVOS de «Un Lead Agendó Llamada» (al final del array, en este orden). `entrada` es la tarjeta de inicio. */
export const IDS_AGENDO = {
  entrada: ID_INICIO, aviso: 'u11aviso',
  e1440: 'u11e1440', t1440: 'u11t1440', e60: 'u11e60', t60: 'u11t60', e15: 'u11e15', t15: 'u11t15',
} as const;
/** El orden en que se agregan (y el que los tests miden). */
export const ORDEN_NUEVOS_AGENDO: readonly string[] = [
  IDS_AGENDO.entrada, IDS_AGENDO.aviso, IDS_AGENDO.e1440, IDS_AGENDO.t1440, IDS_AGENDO.e60, IDS_AGENDO.t60, IDS_AGENDO.e15, IDS_AGENDO.t15,
];
/** Los minutos de cada recordatorio («1 día / 1 h / 15 min antes de la reunión»), con su espera y su WhatsApp. */
export const TOQUES_AGENDO: ReadonlyArray<{ min: number; espera: string; toque: string }> = [
  { min: 1440, espera: IDS_AGENDO.e1440, toque: IDS_AGENDO.t1440 },
  { min: 60, espera: IDS_AGENDO.e60, toque: IDS_AGENDO.t60 },
  { min: 15, espera: IDS_AGENDO.e15, toque: IDS_AGENDO.t15 },
];

/** La CONDITION nueva de #209 (ws4): ocupa el lugar del DELAY que se va. */
export const ID_CONDICION_WS4 = 'u11cond';

/**
 * El aviso «Nuevo agendado» (u11aviso, una parte de texto). Cada renglón cuyo dato no tiene valor se va entero
 * (`sinRenglonesVacios`, la regla del renglón opcional).
 */
export const TEXTO_NUEVO_AGENDADO = '🎯 *Nuevo agendado*: {{nombre_completo}} reservó su {{reunion_cual}} para {{reunion_cuando}} a las {{reunion_hora}}.\n'
  + 'Vino del anuncio "{{lead_utm_campaign}}".\n📱 {{lead_telefono}}\n✉️ {{lead_email}}\n{{lead_respuestas_agenda}}\n\n👉 {{link_lead}}';

/** El «no confirmó» de #213 (ne9jyr0): el texto de antes y el de ahora, con los datos a la vista (§1.4). */
export const TEXTO_NO_CONFIRMO_ANTES = 'Agendó y no confirmó. Conviene que le marques tú.';
export const TEXTO_NO_CONFIRMO = 'Agendó y no confirmó: {{nombre_completo}}. Conviene que le marques tú.\n📱 {{lead_telefono}}\n👉 {{link_lead}}';

/** Los recordatorios de §3, por si #228 ya no está (una segunda corrida): los de #228 traducidos. */
export const TEXTOS_RECORDATORIO: Readonly<Record<number, string>> = {
  1440: 'Hola {{nombre}}, te recuerdo tu reunión {{reunion_cuando}} a las {{reunion_hora}}.\nPara entrar: {{reunion_link}}',
  60: 'Hola {{nombre}}, tu reunión empieza {{reunion_faltan}}, a las {{reunion_hora}}.\nPara entrar: {{reunion_link}}',
  15: 'Hola {{nombre}}, empezamos {{reunion_faltan}}.\nEntra aquí: {{reunion_link}}',
};

/**
 * LOS DATOS DEL EMISOR DEL RECORDATORIO → LOS DEL MOTOR (ver la cabecera: `{{hora}}` cambia de significado). Un token
 * del texto de #228 que no está acá FRENA: no se adivina qué quería decir.
 */
export const MAPA_RECORDATORIO: Readonly<Record<string, string>> = {
  nombre: 'nombre', cuando: 'reunion_cuando', hora: 'reunion_hora', faltan: 'reunion_faltan', link: 'reunion_link',
};

/** Los escenarios de #213, en el orden del clasificador, con su libertad (§3: VERBATIM, no los de la galería). */
export const ESCENARIOS_AGENDO: ReadonlyArray<readonly [titulo: string, libertad: Libertad]> = [
  ['Confirma o ya vio el video', 'sola'],
  ['Pregunta el precio', 'aprueba'],
  ['Pregunta por la reunión', 'aprueba'],
  ['Quiere cambiar el día', 'sola'],
];

/** Los ids de cada fila de prod que el plan conoce (§3). */
export const IDS_198 = { condicion: 'n2199q6', espera: 'nv8c28e', condicion2: 'nz7zsf8', audio: 'o0', ia: 'n1b5m7i' } as const;
export const IDS_213 = {
  espera: 'nvlvg08', audio: 'o0', espera24: 'nh92v3h', mensaje: 'o1', espera12: 'n4z5uil', noConfirmo: 'ne9jyr0',
  ia: 'nb7dt1y', yaLeEscribiste: 'n2jl2v4', audioConocido: 'n136j5s', plegados: ['nyiufgy', 'nofi37o', 'njodb7o'] as readonly string[],
} as const;
export const IDS_209 = { espera: 'nyoyu9g', audio: 'o0' } as const;
export const IDS_210 = { condicion: 'n15t6s5', espera: 'n48anmb', audioYa: 'o0', esperaNo: 'n9cyxap', audioNo: 'o1' } as const;

/** Las horas de «Llegó hace menos de N h»: 72 en la Bienvenida del ws1 (la de hoy) y 720 en la del ws4 (`ENTRADA_DE_ANTES`). */
export const HORAS_ENTRO_WS1 = 72;
export const HORAS_ENTRO_WS4 = 720;

// ── Tipos ────────────────────────────────────────────────────────────────────────────────────────

/** Lo que el plan lee de una fila de `nutricion_secuencias`. */
export type FilaFlujo = FilaDisparadores & {
  id: number;
  workspace_id: number;
  nombre: string;
  clave?: string | null;
  activa: boolean;
  archivada_at: string | null;
  updated_at: string | null;
  pasos: unknown;
  pasos_borrador?: unknown;
  posiciones?: unknown;
  disparadores_rev?: number | null;
  emoji?: string | null;
};

/** El CRON de una etapa de adquisición: qué embudo y qué etapa (la `value` de `productosConEtapas`). */
export type EtapaCron = { funnelId: number; etapa: string };

/** Lo que el plan propone para UNA fila. */
export type Propuesta = {
  tipo: 'reescribir' | 'archivar' | 'crear';
  /** null = una fila NUEVA. */
  id: number | null;
  ws: number;
  nombre: string;
  activa: boolean;
  /** Los pasos como quedan (la forma guardada). En un archivado, los de siempre. */
  pasos: PasoGrafo[];
  /** La lista de CRON como queda. */
  disparadores: Disparador[];
  /** LO QUE SE ESCRIBE (sin `updated_at`; jsonb como OBJETO). Vacío = ya está como tiene que quedar. */
  columnas: Record<string, unknown>;
  /** Cambia la lista de CRON: se escribe con compare-and-set sobre `disparadores_rev` (y lo sube). */
  cambiaCron: boolean;
  /** Lo que se sabe y no frena (para el simulacro). */
  notas: string[];
};

export type Plan = { ok: true; propuesta: Propuesta } | { ok: false; error: string };

// ── Utilidades ───────────────────────────────────────────────────────────────────────────────────

/** JSON con las claves ordenadas: dos valores iguales dan el mismo texto aunque las claves vengan en otro orden. */
export function estable(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, (x as Record<string, unknown>)[k]]))
    : x)) ?? '';
}

export const pasosDeFila = (f: Pick<FilaFlujo, 'pasos'>): PasoGrafo[] => (Array.isArray(f.pasos) ? (f.pasos as PasoGrafo[]) : []);
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const falla = (error: string): Plan => ({ ok: false, error });

/** Lo que todo paso tiene de relleno (lo mismo que `nodoNuevo` y la galería). */
const RELLENO = { canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null } as const;

/** Un WhatsApp de texto que sale solo, en la forma en que lo guarda `setSecuenciaPasos`. */
function whatsapp(id: string, cuerpo: string, siguiente: string | null): PasoGrafo {
  return {
    ...RELLENO, id, cuerpo, siguiente, revisar: false, proveedor: 'no_oficial', preheader: null,
    template_idioma: 'es_MX', template_param: 'nombre',
  } as PasoGrafo;
}
/** Un DELAY «N antes de la reunión» (el carril del motor, M3). */
const antesDeLaReunion = (id: string, minutos: number, siguiente: string | null): PasoGrafo =>
  ({ ...RELLENO, id, nodo: 'esperar', espera: { modo: 'antes_reunion', minutos }, siguiente } as PasoGrafo);
/** «MaKo en WhatsApp» con su lista explícita: sale TAL CUAL (lib/mako-tarjeta.ts). */
const mako = (id: string, texto: string, siguiente: string | null, leadId: unknown = LEAD_DEL_EVENTO): PasoGrafo =>
  ({ ...RELLENO, id, siguiente, preheader: null, accion: { operacion: OP_AVISAR, params: paramsConPartes({ leadId }, [{ tipo: 'texto', cuerpo: texto }]) } } as PasoGrafo);

const esAvisoMako = (p: PasoGrafo | null | undefined): boolean =>
  !!p && claseDe(p) === 'accion' && (p.accion as { operacion?: unknown } | null | undefined)?.operacion === OP_AVISAR;
const paramsDe = (p: PasoGrafo): Record<string, unknown> =>
  ((p.accion as { params?: Record<string, unknown> } | null | undefined)?.params ?? {});

/**
 * LA FORMA EN QUE `setSecuenciaPasos` GUARDA cada tarjeta (lib/nutricion.ts): un nodo de control con el relleno y sus
 * campos del flujo saneados (`camposDelFlujo`, la quinta puerta); una acción sin nada de un mensaje y con su `accion`
 * saneada (`sanearAccion`); un mensaje, TAL CUAL. `orden` = su índice + 1. Normalizado antes y después.
 */
export function formaGuardada(pasosIn: readonly PasoGrafo[]): PasoGrafo[] {
  const pasos = normalizar(pasosIn).map((p, i): PasoGrafo => {
    const flujo = camposDelFlujo(p);
    if (esNodoDeControl(flujo)) return { orden: i + 1, ...RELLENO_CONTROL, ...flujo } as PasoGrafo;
    if (claseDe(p) === 'accion') {
      const a = sanearAccion(p.accion);
      return {
        orden: i + 1, canal: 'whatsapp', delay_horas: 0, ...flujo,
        asunto: null, preheader: null, cuerpo: '', template_wa: null, accion: a && a.ok ? a.accion : p.accion,
      } as PasoGrafo;
    }
    return { ...p, orden: i + 1 };
  });
  return normalizar(pasos);
}

/** Los campos del flujo que un paso trae y `camposDelFlujo` devuelve (para la ida y vuelta). */
const CLAVES_FLUJO = ['id', 'siguiente', 'paralelos', 'nodo', 'espera', 'ramas', 'casos', 'suelta', 'si_no', 'paralelos_si_no', 'destino', 'revisar', 'paso_ia', 'instrucciones', 'otra_aviso', 'medio', 'objetivo', 'audio', 'ejemplos'] as const;

/**
 * LO QUE EL PRÓXIMO GUARDADO DESDE LA PANTALLA LE BORRARÍA a cada tarjeta (`setSecuenciaPasos` la reconstruye campo
 * por campo con `camposDelFlujo`). Vacío = lo que se escribe es su forma guardada. En un mensaje no se miran `audio`
 * ni `objetivo` (son campos del AI Step).
 */
export function pierdeAlGuardar(pasos: readonly PasoGrafo[]): string[] {
  const out: string[] = [];
  pasos.forEach((p, i) => {
    const o = p as Record<string, unknown>;
    const deIA = esPasoIA(p);
    const claves = CLAVES_FLUJO.filter((k) => deIA || (k !== 'objetivo' && k !== 'audio' && k !== 'ejemplos'));
    const propio = Object.fromEntries(claves.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
    const saneado = camposDelFlujo(p);
    if (estable(propio) !== estable(saneado)) out.push(`${idDe(p, i)}: ${estable(propio).slice(0, 90)} → ${estable(saneado).slice(0, 90)}`);
  });
  return out;
}

/** El CRON de una etapa de adquisición, saneado como lo guarda el editor del CRON. */
export function cronDeEtapa(e: EtapaCron): Disparador[] {
  return sanearDisparadores([{ id: 'd1', trigger_tipo: TRIGGER_ETAPA, etapa: e.etapa, funnel_id: e.funnelId }]);
}

/**
 * LAS COLUMNAS DEL CRON, con la MISMA forma que `guardarDisparadores` (lib/disparadores-guardar.ts): el primero en las
 * columnas de siempre (`columnasDeDisparador`, sin horario: `cron_proxima_at` null) y la lista entera en `disparadores`
 * con `disparadores_rev` subido. Vacío si la lista ya es ésa.
 */
export function columnasDelCron(fila: FilaFlujo | null, lista: readonly Disparador[]): { columnas: Record<string, unknown>; cambia: boolean } {
  const previos = fila ? disparadoresDe(fila) : [];
  const crudaIgual = fila ? firmaLista(sanearDisparadores(fila.disparadores)) === firmaLista(lista) : false;
  // La lista guardada también tiene que decir lo mismo: es lo que se lee crudo (y lo que miró el relevo de #238).
  if (fila && firmaLista(previos) === firmaLista(lista) && crudaIgual) return { columnas: {}, cambia: false };
  const primero = lista[0];
  return {
    columnas: {
      ...columnasDeDisparador(primero), cron_proxima_at: null,
      disparadores: lista.map((d) => ({ ...d })),
      disparadores_rev: (fila ? Number(fila.disparadores_rev ?? 0) : 0) + 1,
    },
    cambia: true,
  };
}

/** Lo que cambia entre la fila y lo propuesto (pasos, nombre, prendida, borrador y posiciones). */
function columnasDeLaFila(fila: FilaFlujo, p: { pasos: PasoGrafo[]; nombre: string; activa: boolean }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (estable(pasosDeFila(fila)) !== estable(p.pasos)) out.pasos = p.pasos;
  if (fila.nombre !== p.nombre) out.nombre = p.nombre;
  if (fila.activa !== p.activa) out.activa = p.activa;
  // El borrador (no vigente) y las posiciones del lienzo eran de la forma de antes: se van (§3).
  if (fila.pasos_borrador != null) out.pasos_borrador = null;
  if (fila.posiciones != null) out.posiciones = null;
  return out;
}

/** Los ids viejos que quedan, ¿en su índice? Devuelve los que se corrieron. */
export function indicesCorridos(antes: readonly PasoGrafo[], despues: readonly PasoGrafo[]): string[] {
  const ids = despues.map((p, i) => idDe(p, i));
  return antes.map((p, i) => idDe(p, i)).filter((id, i) => ids.includes(id) && ids.indexOf(id) !== i);
}

/** Una tarjeta con la clase esperada, o el motivo. */
function exigir(pasos: readonly PasoGrafo[], id: string, clase: ReturnType<typeof claseDe>, extra?: (p: PasoGrafo) => boolean): string | null {
  const p = nodoPorId(pasos, id);
  if (!p) return `falta la tarjeta ${id}`;
  if (claseDe(p) !== clase) return `${id} no es ${clase} (es ${claseDe(p)})`;
  if (extra && !extra(p)) return `${id} no es la tarjeta que se esperaba`;
  return null;
}

/** «No agendó», la fila del catálogo (`agendo` negada). */
const NO_AGENDO: FilaCondicion = { campo: 'agendo', no: true };

/**
 * LA CONDITION DE ENTRADA DE «Un Lead Entró»: UNA tarjeta con «Llegó hace menos de N h» y «No agendó» (y), que sigue en
 * `siguiente`; «Si no» termina. Conserva el id de la rama si la había. Es la PRIMERA tarjeta con la antigüedad en todas
 * sus ramas: el motor la mira también al inscribir (`antiguedadDeEntrada`).
 */
function condicionDeEntrada(base: PasoGrafo | null, id: string, horas: number, siguiente: string): PasoGrafo {
  const ramaId = base?.ramas?.[0]?.id || `${id}_si`;
  const rama: RamaCondicion = {
    id: ramaId, modo: 'todas',
    filas: [{ campo: 'antiguedad', valor: horas }, { ...NO_AGENDO, union: 'y' }],
    siguiente,
  };
  return { ...(base ?? {}), ...RELLENO_CONTROL, id, nodo: 'condicion', ramas: [rama], si_no: null } as PasoGrafo;
}

/** El AI Step con su objetivo: el que tiene, o el del diseño si está vacío (lo que alguien escribió después se respeta). */
function conObjetivo(pasos: readonly PasoGrafo[], id: string, objetivo: string): PasoGrafo[] {
  return pasos.map((p) => (p.id === id && !(p.objetivo ?? '').trim() ? { ...p, objetivo } : p));
}

// ── Los planes, fila por fila (§3) ───────────────────────────────────────────────────────────────

/**
 * #198 (ws1) «Bienvenida — dejó sus datos y no agendó» → «Un Lead Entró», en el lugar:
 *   CRON «Lead entrante» → n2199q6 CONDITION «Llegó hace menos de 72 h» y «No agendó» → o0 (audio, igual) · si no termina;
 *   n1b5m7i AI Step con objetivo, sin escenarios («Lo demás: Sólo te avisa»). Se van nv8c28e (DELAY) y nz7zsf8 (la
 *   segunda CONDITION): sus índices se corren (no hay inscripción viva que no sea la 199, inerte).
 */
export function planBienvenidaWs1(fila: FilaFlujo, cron: EtapaCron, horas = HORAS_ENTRO_WS1): Plan {
  const I = IDS_198;
  const antes = normalizar(pasosDeFila(fila));
  for (const e of [
    exigir(antes, I.condicion, 'condicion'),
    exigir(antes, I.audio, 'mensaje'),
    exigir(antes, I.ia, 'respuesta', esPasoIA),
  ]) if (e) return falla(`#${fila.id}: ${e}`);
  const espera = nodoPorId(antes, I.espera);
  if (espera && claseDe(espera) !== 'esperar') return falla(`#${fila.id}: ${I.espera} no es el DELAY de antes`);
  const cond2 = nodoPorId(antes, I.condicion2);
  if (cond2 && claseDe(cond2) !== 'condicion') return falla(`#${fila.id}: ${I.condicion2} no es la CONDITION de antes`);
  const cond = nodoPorId(antes, I.condicion)!;
  if ((cond.ramas ?? []).length !== 1) return falla(`#${fila.id}: ${I.condicion} tiene ${(cond.ramas ?? []).length} ramas (se esperaba una)`);
  const antig = cond.ramas![0].filas.find((f) => f.campo === 'antiguedad' && !f.no);
  if (!antig || Number(antig.valor) !== horas) return falla(`#${fila.id}: ${I.condicion} no pide «Llegó hace menos de ${horas} h»`);
  const otras = antes.map((p, i) => idDe(p, i)).filter((id) => !(Object.values(I) as string[]).includes(id));
  if (otras.length) return falla(`#${fila.id}: tiene tarjetas que el plan no conoce (${otras.join(', ')})`);

  const sin = antes.filter((p) => p.id !== I.espera && p.id !== I.condicion2)
    .map((p) => (p.id === I.condicion ? condicionDeEntrada(p, I.condicion, horas, I.audio) : p));
  const junto = juntarPasosIA(sin);
  const pasos = formaGuardada(conObjetivo(junto.pasos, I.ia, OBJETIVO_ENTRO));
  const lista = cronDeEtapa(cron);
  const c = columnasDelCron(fila, lista);
  const nombre = nombreDeSecuencia(NOMBRE_ENTRO);
  return {
    ok: true,
    propuesta: {
      tipo: 'reescribir', id: fila.id, ws: fila.workspace_id, nombre, activa: fila.activa, pasos, disparadores: lista,
      columnas: { ...columnasDeLaFila(fila, { pasos, nombre, activa: fila.activa }), ...c.columnas }, cambiaCron: c.cambia,
      notas: [...junto.perdidos.map((x) => `AI Step: ${x}`), ...junto.conflictos.map((x) => `AI Step, distinto: ${x}`),
        ...(fila.activa ? [] : ['está PAUSADA: el diseño la quería prendida (no se prende sola)'])],
    },
  };
}

/** Los textos de los recordatorios de #228, traducidos al catálogo del motor, por minutos. null + motivo si no se puede. */
export function textosDeRecordatorio(fila228: FilaFlujo | null): { textos: Record<number, string>; origen: string } | { error: string } {
  if (!fila228) return { textos: { ...TEXTOS_RECORDATORIO }, origen: 'los de §3 (#228 no está)' };
  const pasos = normalizar(pasosDeFila(fila228));
  const textos: Record<number, string> = {};
  for (const p of pasos) {
    if (claseDe(p) !== 'esperar' || p.espera?.modo !== 'antes_reunion') continue;
    const toque = nodoPorId(pasos, p.siguiente ?? null);
    if (!toque || claseDe(toque) !== 'mensaje') return { error: `#${fila228.id}: después de ${p.id} no hay un WhatsApp` };
    const cuerpo = String(toque.cuerpo ?? '');
    const raros = tokensDe(cuerpo).map((t) => t.key).filter((k) => !(k in MAPA_RECORDATORIO));
    if (raros.length) return { error: `#${fila228.id}: ${toque.id} usa ${raros.map((k) => `{{${k}}}`).join(', ')}, que no sé traducir` };
    textos[Number(p.espera.minutos)] = cuerpo.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k: string) => {
      const nuevo = MAPA_RECORDATORIO[k.toLowerCase()];
      return nuevo ? `{{${nuevo}}}` : m;
    });
  }
  const faltan = TOQUES_AGENDO.filter((t) => !textos[t.min]).map((t) => t.min);
  if (faltan.length) return { error: `#${fila228.id}: no tiene el toque de ${faltan.join(', ')} min` };
  return { textos, origen: `los de #${fila228.id}, traducidos` };
}

/**
 * #213 (ws1) «Agendó una reunión» → «Un Lead Agendó Llamada», en el lugar, con TRES caminos desde el CRON «Agenda R1»
 * (la tarjeta de inicio `entrada`, al final): 1. la preparación de hoy (nvlvg08 …, tal cual, con ne9jyr0 pasado a
 * partes); 2. el aviso «Nuevo agendado» (u11aviso); 3. los recordatorios «1 día / 1 h / 15 min antes» (lo que era #228).
 * nb7dt1y queda como el ÚNICO AI Step (se pliegan nyiufgy, nofi37o y njodb7o, los índices 9-11: nadie se corre).
 * `fila228`: la de #228 viva, de donde salen los textos de los recordatorios (null = ya archivada: los de §3).
 */
export function planAgendoWs1(fila: FilaFlujo, fila228: FilaFlujo | null, cron: EtapaCron): Plan {
  const I = IDS_213;
  const antes = normalizar(pasosDeFila(fila));
  for (const e of [
    exigir(antes, I.espera, 'esperar'), exigir(antes, I.audio, 'mensaje'), exigir(antes, I.espera24, 'esperar'),
    exigir(antes, I.mensaje, 'mensaje'), exigir(antes, I.espera12, 'esperar'), exigir(antes, I.noConfirmo, 'accion', esAvisoMako),
    exigir(antes, I.ia, 'respuesta', esPasoIA), exigir(antes, I.yaLeEscribiste, 'condicion'), exigir(antes, I.audioConocido, 'mensaje'),
  ]) if (e) return falla(`#${fila.id}: ${e}`);
  for (const id of I.plegados) {
    const p = nodoPorId(antes, id);
    if (p && !esPasoIA(p)) return falla(`#${fila.id}: ${id} no es un AI Step`);
  }
  const conocidas = new Set<string>([...Object.values(I).flat() as string[], ...ORDEN_NUEVOS_AGENDO]);
  const otras = antes.map((p, i) => idDe(p, i)).filter((id) => !conocidas.has(id));
  if (otras.length) return falla(`#${fila.id}: tiene tarjetas que el plan no conoce (${otras.join(', ')})`);

  // El AI Step: UNO (`juntarPasosIA`), con los escenarios VERBATIM y en el orden de antes.
  const junto = juntarPasosIA(antes);
  const ia = nodoPorId(junto.pasos, I.ia);
  if (!ia || junto.pasos.some((p) => I.plegados.includes(p.id ?? ''))) return falla(`#${fila.id}: el AI Step no quedó en ${I.ia}`);
  const escenarios = (ia.casos ?? []).filter((x) => x.cualquiera !== true);
  const loDemas = (ia.casos ?? []).find((x) => x.cualquiera === true);
  const esperados = ESCENARIOS_AGENDO.map(([t, l]) => `${t}:${l}`).join(' · ');
  const quedan = escenarios.map((x) => `${x.titulo}:${libertadDeCaso(x)}`).join(' · ');
  if (quedan !== esperados) return falla(`#${fila.id}: los escenarios no son los de §3 (${quedan || 'ninguno'})`);
  if (loDemas && libertadDeCaso(loDemas) !== 'avisa') return falla(`#${fila.id}: «Lo demás» no es «Sólo te avisa»`);
  let pasos = conObjetivo(junto.pasos, I.ia, OBJETIVO_AGENDO);

  // ne9jyr0: «MaKo en WhatsApp» con partes y los datos a la vista. Una que ya tiene partes se respeta.
  const nc = nodoPorId(pasos, I.noConfirmo)!;
  const params = paramsDe(nc);
  if (!esTarjetaTalCual(params)) {
    if (String(params.mensaje ?? '').trim() !== TEXTO_NO_CONFIRMO_ANTES) return falla(`#${fila.id}: ${I.noConfirmo} ya no dice «${TEXTO_NO_CONFIRMO_ANTES}»: alguien la cambió`);
    pasos = pasos.map((p) => (p.id === I.noConfirmo
      ? { ...p, accion: { operacion: OP_AVISAR, params: paramsConPartes({ leadId: params.leadId ?? LEAD_DEL_EVENTO }, [{ tipo: 'texto', cuerpo: TEXTO_NO_CONFIRMO }]) } }
      : p));
  }

  // Los nuevos, AL FINAL y en su orden. Uno que ya está (una segunda corrida, o editado después) se respeta.
  const rec = textosDeRecordatorio(fila228);
  if ('error' in rec) return falla(rec.error);
  const nuevos: PasoGrafo[] = [
    { ...RELLENO, id: IDS_AGENDO.entrada, nodo: 'inicio', siguiente: I.espera, paralelos: [IDS_AGENDO.aviso, IDS_AGENDO.e1440] } as PasoGrafo,
    mako(IDS_AGENDO.aviso, TEXTO_NUEVO_AGENDADO, null),
    ...TOQUES_AGENDO.flatMap((t, k) => {
      const sig = TOQUES_AGENDO[k + 1]?.espera ?? null;
      return [antesDeLaReunion(t.espera, t.min, t.toque), whatsapp(t.toque, rec.textos[t.min], sig)];
    }),
  ];
  for (const n of nuevos) if (!nodoPorId(pasos, n.id!)) pasos = [...pasos, n];
  const ini = pasos.filter((p) => claseDe(p) === 'inicio');
  if (ini.length !== 1 || ini[0].id !== IDS_AGENDO.entrada) return falla(`#${fila.id}: la tarjeta de inicio no es ${IDS_AGENDO.entrada}`);
  pasos = formaGuardada(pasos);
  const corridos = indicesCorridos(antes, pasos);
  if (corridos.length) return falla(`#${fila.id}: se correrían de índice ${corridos.join(', ')}`);

  const lista = cronDeEtapa(cron);
  const c = columnasDelCron(fila, lista);
  const nombre = nombreDeSecuencia(NOMBRE_AGENDO);
  return {
    ok: true,
    propuesta: {
      tipo: 'reescribir', id: fila.id, ws: fila.workspace_id, nombre, activa: fila.activa, pasos, disparadores: lista,
      columnas: { ...columnasDeLaFila(fila, { pasos, nombre, activa: fila.activa }), ...c.columnas }, cambiaCron: c.cambia,
      notas: [
        `recordatorios: ${rec.origen}`,
        ...junto.perdidos.map((x) => `AI Step: ${x}`), ...junto.conflictos.map((x) => `AI Step, distinto: ${x}`),
        ...(fila.activa ? [] : ['está PAUSADA: el diseño la quería prendida (no se prende sola)']),
      ],
    },
  };
}

/** ARCHIVAR (cerrar no es borrar): pausada y con `archivada_at`. Ya archivada = nada que escribir. */
export function planArchivar(fila: FilaFlujo, ahoraIso: string): Plan {
  const pasos = pasosDeFila(fila);
  const lista = disparadoresDe(fila);
  return {
    ok: true,
    propuesta: {
      tipo: 'archivar', id: fila.id, ws: fila.workspace_id, nombre: fila.nombre, activa: false, pasos, disparadores: lista,
      columnas: fila.archivada_at ? {} : { activa: false, archivada_at: ahoraIso }, cambiaCron: false, notas: [],
    },
  };
}

/**
 * #238 (ws1) «Felicitación por pasar la clase»: SÓLO su lista de CRON, coherente con las columnas (decisión §9.11), y
 * sigue pausada; las tarjetas no se tocan.
 *
 * ⚠️ LA COLUMNA ES LA QUE CORRE, NO LA LISTA (medido el 11/10/2026 sobre la fila leída). El motor arma `disparadores`
 * con `disparadoresDe(fila)` (`listaDe`, lib/nutricion.ts), y ahí el PRIMERO sale SIEMPRE de las columnas: la lista
 * cruda (`etapa_actual@lead`, funnel 1) sólo la lee quien mira el jsonb sin pasar por `disparadoresDe`. Lo que se
 * escribe es la lista que el motor y la pantalla ya ven (`disparadoresDe`): no cambia lo que dispara.
 */
export function planFelicitacion(fila: FilaFlujo): Plan {
  const lista = disparadoresDe(fila);
  const c = columnasDelCron(fila, lista);
  // Las columnas del primero ya dicen eso: lo único que cambia es la lista guardada (y su revisión).
  const columnas = c.cambia ? { disparadores: c.columnas.disparadores, disparadores_rev: c.columnas.disparadores_rev } : {};
  return {
    ok: true,
    propuesta: {
      tipo: 'reescribir', id: fila.id, ws: fila.workspace_id, nombre: fila.nombre, activa: fila.activa, pasos: pasosDeFila(fila),
      disparadores: lista, columnas, cambiaCron: c.cambia,
      notas: [
        ...(c.cambia ? [`la lista guardada decía ${sanearDisparadores(fila.disparadores).map((d) => `${d.trigger_tipo} ${d.etapa ?? ''}${d.funnel_id ? ` (embudo ${d.funnel_id})` : ''}`).join(' + ') || 'nada'}; el motor y la pantalla ya leían las columnas`] : []),
        ...(fila.activa ? ['está PRENDIDA: el diseño la quería pausada'] : []),
      ],
    },
  };
}

/** La clave determinística de la fila nueva de un workspace (dos corridas no crean dos). */
export const claveAgendo = (ws: number): string => `undecima-lead-agendo-ws${ws}`;

/**
 * La fila NUEVA «Un Lead Agendó Llamada» de un negocio que hoy sólo tiene el aviso (ws13, decisión §9.9): CRON en la
 * etapa de reunión de su embudo → u11aviso con el mismo texto que el ws1. PRENDIDA. `existente`: la que ya creó una
 * corrida anterior (por su clave): se compara contra ésa.
 */
export function planAgendoNueva(ws: number, cron: EtapaCron, existente: FilaFlujo | null): Plan {
  const nombre = nombreDeSecuencia(NOMBRE_AGENDO);
  const lista = cronDeEtapa(cron);
  if (existente) {
    // Una segunda corrida: lo que ya está se respeta (alguien pudo editarla); sólo se dice si se fue de la forma.
    return {
      ok: true,
      propuesta: {
        tipo: 'reescribir', id: existente.id, ws, nombre: existente.nombre, activa: existente.activa,
        pasos: pasosDeFila(existente), disparadores: disparadoresDe(existente), columnas: {}, cambiaCron: false,
        notas: [`ya existe (#${existente.id}, ${existente.archivada_at ? 'ARCHIVADA' : existente.activa ? 'prendida' : 'pausada'}): no se toca`],
      },
    };
  }
  const pasos = formaGuardada([mako(IDS_AGENDO.aviso, TEXTO_NUEVO_AGENDADO, null)]);
  const c = columnasDelCron(null, lista);
  return {
    ok: true,
    propuesta: {
      tipo: 'crear', id: null, ws, nombre, activa: true, pasos, disparadores: lista,
      columnas: {
        workspace_id: ws, clave: claveAgendo(ws), nombre, activa: true, pasos, emoji: emojiDeSecuencia('📅'),
        ...c.columnas,
      },
      cambiaCron: true, notas: [],
    },
  };
}

/**
 * #209 (ws4) «Bienvenida — dejó sus datos y no agendó» → «Un Lead Entró», en el lugar y PAUSADA: CRON «Lead entrante»
 * → CONDITION «Llegó hace menos de 720 h» y «No agendó» (en el lugar del DELAY de 1 h, que se va) → o0 (audio, para
 * aprobar, igual). No tiene inscripciones: el índice no importa, y la raíz queda primera.
 */
export function planBienvenidaWs4(fila: FilaFlujo, cron: EtapaCron): Plan {
  const I = IDS_209;
  const antes = normalizar(pasosDeFila(fila));
  const e = exigir(antes, I.audio, 'mensaje');
  if (e) return falla(`#${fila.id}: ${e}`);
  const espera = nodoPorId(antes, I.espera);
  if (espera && claseDe(espera) !== 'esperar') return falla(`#${fila.id}: ${I.espera} no es el DELAY de antes`);
  const ya = nodoPorId(antes, ID_CONDICION_WS4);
  if (ya && claseDe(ya) !== 'condicion') return falla(`#${fila.id}: ${ID_CONDICION_WS4} no es una CONDITION`);
  const otras = antes.map((p, i) => idDe(p, i)).filter((id) => id !== I.espera && id !== I.audio && id !== ID_CONDICION_WS4);
  if (otras.length) return falla(`#${fila.id}: tiene tarjetas que el plan no conoce (${otras.join(', ')})`);
  const audio = nodoPorId(antes, I.audio)!;
  const pasos = formaGuardada([ya ?? condicionDeEntrada(null, ID_CONDICION_WS4, HORAS_ENTRO_WS4, I.audio), audio]);
  const lista = cronDeEtapa(cron);
  const c = columnasDelCron(fila, lista);
  const nombre = nombreDeSecuencia(NOMBRE_ENTRO);
  return {
    ok: true,
    propuesta: {
      tipo: 'reescribir', id: fila.id, ws: fila.workspace_id, nombre, activa: false, pasos, disparadores: lista,
      columnas: { ...columnasDeLaFila(fila, { pasos, nombre, activa: false }), ...c.columnas }, cambiaCron: c.cambia, notas: [],
    },
  };
}

/**
 * #210 (ws4) «Agendó — confirmación y preparación» → «Un Lead Agendó Llamada», en el lugar y PAUSADA: CRON «Agenda R1»
 * → n48anmb DELAY 1 h → n15t6s5 CONDITION «Ya le escribiste» → o0 (audio #26) · si no → o1 (audio #25). Se va el DELAY
 * n9cyxap (era el mismo DELAY repetido en la otra rama). Sin inscripciones.
 */
export function planAgendoWs4(fila: FilaFlujo, cron: EtapaCron): Plan {
  const I = IDS_210;
  const antes = normalizar(pasosDeFila(fila));
  for (const e of [
    exigir(antes, I.condicion, 'condicion'), exigir(antes, I.espera, 'esperar'),
    exigir(antes, I.audioYa, 'mensaje'), exigir(antes, I.audioNo, 'mensaje'),
  ]) if (e) return falla(`#${fila.id}: ${e}`);
  const otras = antes.map((p, i) => idDe(p, i)).filter((id) => !(Object.values(I) as string[]).includes(id));
  if (otras.length) return falla(`#${fila.id}: tiene tarjetas que el plan no conoce (${otras.join(', ')})`);
  const cond = nodoPorId(antes, I.condicion)!;
  const r = cond.ramas ?? [];
  if (r.length !== 1 || r[0].filas.length !== 1 || r[0].filas[0].campo !== 'ya_contactado' || r[0].filas[0].no) {
    return falla(`#${fila.id}: ${I.condicion} ya no es «Ya le escribiste»`);
  }
  const espera = nodoPorId(antes, I.espera)!;
  const pasos = formaGuardada([
    { ...espera, siguiente: I.condicion },
    { ...cond, ramas: [{ ...r[0], siguiente: I.audioYa }], si_no: I.audioNo },
    nodoPorId(antes, I.audioYa)!,
    nodoPorId(antes, I.audioNo)!,
  ]);
  const lista = cronDeEtapa(cron);
  const c = columnasDelCron(fila, lista);
  const nombre = nombreDeSecuencia(NOMBRE_AGENDO);
  return {
    ok: true,
    propuesta: {
      tipo: 'reescribir', id: fila.id, ws: fila.workspace_id, nombre, activa: false, pasos, disparadores: lista,
      columnas: { ...columnasDeLaFila(fila, { pasos, nombre, activa: false }), ...c.columnas }, cambiaCron: c.cambia, notas: [],
    },
  };
}

/** ¿La fila cita `{{mensaje_mako}}` en alguna tarjeta? (como lo lee el motor: con espacios y sin mayúsculas). */
export function usaMensajeMako(pasos: readonly PasoGrafo[]): boolean {
  const re = new RegExp(`\\{\\{\\s*${CLAVE_MENSAJE_MAKO}\\s*\\}\\}`, 'i');
  return re.test(JSON.stringify(pasos));
}

/**
 * UNA FILA DE UN EVENTO DE MaKo CON `{{mensaje_mako}}` que no está en §3 (p. ej. una «Aviso de pago recibido» creada
 * después del relevo): se reescribe EN EL LUGAR con las tarjetas de la plantilla nueva de SU evento (la de la galería con
 * ese `cron.evento`). Un evento retirado (sin plantilla: `lead_agendo`, `reunion_pronto`) no se adivina: frena.
 */
export function reescribirEventoMako(fila: FilaFlujo): Plan {
  if (fila.trigger_tipo !== TRIGGER_AVISO_MAKO) return falla(`#${fila.id}: no es un Evento de MaKo`);
  const sub = eventoDeFila(fila);
  if (!sub) return falla(`#${fila.id}: no se sabe de qué evento es`);
  const p = PLANTILLAS.find((x) => x.cron.fijo === TRIGGER_AVISO_MAKO && x.cron.evento === sub);
  if (!p) return falla(`#${fila.id}: el evento «${sub}» no tiene plantilla nueva (se retiró): decide quien cierra`);
  const pasos = formaGuardada(pasosDePlantilla(p) as PasoGrafo[]);
  const igual = !usaMensajeMako(pasosDeFila(fila)) && estable(pasosDeFila(fila)) === estable(pasos);
  return {
    ok: true,
    propuesta: {
      tipo: 'reescribir', id: fila.id, ws: fila.workspace_id, nombre: fila.nombre, activa: fila.activa, pasos,
      disparadores: disparadoresDe(fila), columnas: igual ? {} : { pasos, ...(fila.pasos_borrador != null ? { pasos_borrador: null } : {}) },
      cambiaCron: false, notas: [`con la plantilla «${p.nombre}» (${p.id})`],
    },
  };
}

// ── Lo que se mide de cada propuesta ANTES de escribirla (y en los tests) ─────────────────────────

/** El subtipo del evento de una propuesta (null si no es de un Evento de MaKo). */
const subtipoDe = (lista: readonly Disparador[]): string | null =>
  lista[0]?.trigger_tipo === TRIGGER_AVISO_MAKO ? (lista[0].subtipo ?? null) : null;

/**
 * TODO LO QUE TIENE QUE VALER para escribir una propuesta, con las funciones del motor y de Publicar. Vacío = se puede.
 *   · `validarGrafo` (lo que frena Publicar) y `frenoDelFlujo` con los datos de cada tarjeta (`problemasDeTokens` con el
 *     CRON NUEVO de la fila);
 *   · `problemaDeDisparadores` y ningún CRON «(de antes)» (`esEventoDeAntes`);
 *   · `problemasDeForma` (ni CONDITION pegadas, ni CONDITION → DELAY → CONDITION, ni `{{mensaje_mako}}`, ni un AI Step
 *     de más) y ningún `{{mensaje_mako}}` en ningún lado;
 *   · un AI Step por medio, cada uno con su objetivo;
 *   · la ida y vuelta por `camposDelFlujo` no pierde nada (`pierdeAlGuardar`);
 *   · un Evento de MaKo: lo que su emisor sabe correr (`frenoDelEvento`).
 * Un archivado no se mide: sale de circulación.
 */
export function chequearPropuesta(p: Propuesta): string[] {
  if (p.tipo === 'archivar') return [];
  const out: string[] = [];
  const v = validarGrafo(p.pasos);
  if (v.length) out.push(`validarGrafo: ${v[0]}`);
  const trigger = p.disparadores[0]?.trigger_tipo ?? '';
  const sub = subtipoDe(p.disparadores);
  const datos = problemasDeTokens(p.pasos, trigger, sub);
  for (const d of datos) out.push(`datos de ${d.tarjeta}: ${d.motivo}`);
  const fr = frenoDelFlujo(p.pasos, null, datos);
  if (fr && !datos.length) out.push(`Publicar frena: ${fr.error} (${fr.tarjeta ?? 'CRON'})`);
  const pd = problemaDeDisparadores(p.disparadores);
  if (pd) out.push(`CRON: ${pd}`);
  for (const d of p.disparadores) if (esEventoDeAntes(d)) out.push(`CRON «(de antes)»: ${d.trigger_tipo}`);
  for (const f of problemasDeForma(p.pasos, p.disparadores)) out.push(`forma (${f.regla}) en ${f.tarjeta ?? 'el CRON'}: ${f.motivo}`);
  if (usaMensajeMako(p.pasos)) out.push(`cita {{${CLAVE_MENSAJE_MAKO}}}`);
  for (const m of MEDIOS_AI_STEP) {
    const ias = p.pasos.filter((x) => esPasoIA(x) && medioDe(x) === m);
    if (ias.length > 1) out.push(`${ias.length} AI Step de ${m}: va uno`);
    for (const x of ias) if (!(x.objetivo ?? '').trim()) out.push(`el AI Step ${x.id} no tiene objetivo`);
  }
  for (const x of pierdeAlGuardar(p.pasos)) out.push(`el próximo guardado le borraría: ${x}`);
  if (sub) {
    const fe = frenoDelEvento(p.pasos, sub);
    if (fe) out.push(`el emisor del evento no lo sabe correr: ${fe.error}`);
  }
  return out;
}

/** La fila como queda después de escribir la propuesta (para releer en el simulacro y para la idempotencia). */
export function filaDespues(fila: FilaFlujo, p: Propuesta): FilaFlujo {
  return { ...fila, ...copia(p.columnas) } as FilaFlujo;
}
