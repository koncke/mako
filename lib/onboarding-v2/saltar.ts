// =============================================================================
// LA REVISIÓN: IR A CUALQUIER PASO DEL ONBOARDING V2 Y DEL RETO, Y SUS RESPUESTAS DE EJEMPLO (20/11/2026; puro)
// =============================================================================
// Martín, probando en producción: «viste que hay un desplegable en el artefacto que me deja ir avanzando o retrocediendo. Si no, cada vez
// que quiero ver algo que ya pasó, tengo que resetear todo». Lo decidido por el Cerebro:
//   · sólo en la revisión: los negocios de PRUEBA (`WS_PRUEBA_COMO_CLIENTE`, el 3 y el 9; nunca el 11 de Leila, que es una clienta, ni
//     un cliente) y sólo con alguien de MaKo (`admin`: la sesión de administrador, mirando o en su cuenta);
//   · con el estado REAL (no una maqueta), dejándolo como si se hubiera llegado ahí: las respuestas de antes son las de ejemplo de la
//     maqueta (el escenario A de C:/dev/artefactos-onboarding/cuerpo.html), y lo miran las máquinas de verdad (`etapaDeArranqueV2`,
//     `diaAbierto`: tests/revision-saltar-y-ejemplos.test.ts).
// Lo aplica lib/onboarding-v2/saltar-server.ts, detrás de /api/admin/saltar-onboarding.
// =============================================================================
import { WS_PRUEBA_COMO_CLIENTE } from './revision';
import { TUTORIAL_RECORRIDO } from './recorrido';
import type { EstadoArranque } from '@/lib/onboarding-arranque';
import { DIAS_RETO, type EstadoReto, type MarcaReto } from '@/lib/reto/dias';

export type PasoDelArranque = 'bienvenida' | 'nombre' | 'telefono' | 'codigo' | 'agendado' | 'agendado-no' | 'negocio' | 'origen' | 'interes' | 'cierre';
/** Un id de la lista (`esPasoDeRevision` lo valida): los del arranque, 'llegada', 'recorrido-N', 'reto', 'dia-N', 'dia-N-video',
 *  'dia-N-<tarea>' y 'dia-N-<tarea>-<marca>'. */
export type PasoDeRevision = string;
export type GrupoDeRevision = 'Onboarding' | 'Ops Center' | 'Reto de 7 días' | `Día ${number}`;

/**
 * TODOS LOS PASOS, COMO EL ARTEFACTO (21/11/2026, Martín: «Hoy son 16 bloques. Tiene que tener el desglose de cada uno»; la lista de
 * C:/dev/artefactos-onboarding/cuerpo.html → ETIQUETA): cada mensaje o pregunta del arranque, la llegada y cada marca del recorrido,
 * y cada día con MaKo que escribe, su video, cada tarea y cada marca de cada tarea. El código del WhatsApp va con su propio camino.
 */
export const PASOS_DE_REVISION: ReadonlyArray<{ id: PasoDeRevision; grupo: GrupoDeRevision; rotulo: string }> = [
  { id: 'bienvenida', grupo: 'Onboarding', rotulo: 'El video de bienvenida' },
  { id: 'nombre', grupo: 'Onboarding', rotulo: '1 · Tu nombre' },
  { id: 'telefono', grupo: 'Onboarding', rotulo: '2 · Tu WhatsApp' },
  { id: 'codigo', grupo: 'Onboarding', rotulo: '3 · El código por WhatsApp' },
  { id: 'agendado', grupo: 'Onboarding', rotulo: '¿Guardaste el contacto de MaKo?' },
  { id: 'agendado-no', grupo: 'Onboarding', rotulo: 'Si no lo guardó: por qué importa' },
  { id: 'negocio', grupo: 'Onboarding', rotulo: '4 · Tu negocio' },
  { id: 'origen', grupo: 'Onboarding', rotulo: '5 · Cómo llegaste' },
  { id: 'interes', grupo: 'Onboarding', rotulo: '6 · Qué resolver primero (hasta 3)' },
  { id: 'cierre', grupo: 'Onboarding', rotulo: '¡Listo! Entrar a MaKo' },
  { id: 'llegada', grupo: 'Ops Center', rotulo: 'La llegada («¡Hola de nuevo!»)' },
  ...TUTORIAL_RECORRIDO.pasos.map((p, k) => ({ id: `recorrido-${k + 1}`, grupo: 'Ops Center' as const, rotulo: `Recorrido ${k + 1} · ${p.titulo}` })),
  { id: 'reto', grupo: 'Reto de 7 días', rotulo: '«¿Qué hacemos ahora?»' },
  ...DIAS_RETO.flatMap((d) => {
    const grupo = `Día ${d.n}` as const;
    return [
      { id: `dia-${d.n}`, grupo, rotulo: `Día ${d.n} · MaKo escribe y manda el video` },
      { id: `dia-${d.n}-video`, grupo, rotulo: `Día ${d.n} · El video del día` },
      ...d.tareas.filter((t) => !t.siempre).flatMap((t) => [
        { id: `dia-${d.n}-${t.id}`, grupo, rotulo: `Día ${d.n} · ${t.titulo}` },
        ...t.marcas.slice(1).map((m, k) => ({ id: `dia-${d.n}-${t.id}-${k + 2}`, grupo, rotulo: `Día ${d.n} · ${t.titulo}: ${m.titulo}` })),
      ]),
    ];
  }),
];
const IDS = new Set<string>(PASOS_DE_REVISION.map((p) => p.id));
export const esPasoDeRevision = (x: unknown): x is PasoDeRevision => typeof x === 'string' && IDS.has(x);
const ARRANQUE: readonly PasoDelArranque[] = ['bienvenida', 'nombre', 'telefono', 'codigo', 'agendado', 'agendado-no', 'negocio', 'origen', 'interes', 'cierre'];
export const esPasoDelArranque = (p: PasoDeRevision): p is PasoDelArranque => (ARRANQUE as readonly string[]).includes(p);
/** Lo que dice un paso del reto: su día, y si es su video o una tarea (con su marca, desde 0). */
function partesDelDia(p: PasoDeRevision): { dia: number; video: boolean; tarea: string | null; marca: number } | null {
  const m = /^dia-(\d)(?:-(.+))?$/.exec(p);
  if (!m) return null;
  const dia = Number(m[1]);
  const resto = m[2] ?? null;
  if (!resto) return { dia, video: false, tarea: null, marca: 0 };
  if (resto === 'video') return { dia, video: true, tarea: null, marca: 0 };
  const tareas = DIAS_RETO.find((d) => d.n === dia)?.tareas ?? [];
  const t = tareas.find((x) => resto === x.id) ?? tareas.find((x) => resto.startsWith(`${x.id}-`) && /^\d+$/.test(resto.slice(x.id.length + 1)));
  if (!t) return null;
  return { dia, video: false, tarea: t.id, marca: resto === t.id ? 0 : Number(resto.slice(t.id.length + 1)) - 1 };
}
/** El día del reto de un paso: 0 = «¿Qué hacemos ahora?», 1 a 7; null si no es del reto. */
export const diaDelPaso = (p: PasoDeRevision): number | null => (p === 'reto' ? 0 : partesDelDia(p)?.dia ?? null);

/** Lo que el paso deja para que lo tome la pantalla al llegar (./salto-pendiente.ts): el recorrido desde su marca, o una tarea. */
export type SaltoPendiente = { recorrido: number } | { dia: number; tarea: string; marca: number };
export function saltoDelPaso(p: PasoDeRevision): SaltoPendiente | null {
  const r = /^recorrido-(\d+)$/.exec(p);
  if (r) return { recorrido: Number(r[1]) - 1 };
  const d = partesDelDia(p);
  return d?.tarea ? { dia: d.dia, tarea: d.tarea, marca: d.marca } : null;
}
/** Las tareas de HOY antes de la elegida, «Lo hago después» (así la elegida es la próxima). */
export function despuesDelPaso(p: PasoDeRevision): string[] {
  const d = partesDelDia(p);
  if (!d?.tarea) return [];
  const tareas = DIAS_RETO.find((x) => x.n === d.dia)?.tareas ?? [];
  return tareas.slice(0, tareas.findIndex((t) => t.id === d.tarea)).filter((t) => !t.siempre).map((t) => `${d.dia}:${t.id}`);
}
/** Adónde va: el onboarding, el reto, o el grafo abierto (la flecha del recorrido sólo existe ahí). */
export function destinoDelPaso(p: PasoDeRevision): string {
  if (esPasoDelArranque(p)) return '/onboarding';
  const s = saltoDelPaso(p);
  if (s && 'recorrido' in s && TUTORIAL_RECORRIDO.pasos[s.recorrido]?.sel.includes('sb-brain-volver')) return '/second-brain?panel=mapa';
  return '/second-brain?reto=1';
}
/** Una tarea desde su marca `k`: las de antes se tocan solas, en cadena (el `antes` del motor), y se marca la `k`. */
export function marcasDesde<M extends MarcaReto>(marcas: readonly M[], k: number): Array<M | (M & { antes: string[] })> {
  if (k <= 0) return [...marcas];
  return [{ ...marcas[k], antes: marcas.slice(0, k).map((m) => m.sel) }, ...marcas.slice(k + 1)];
}

/** Las respuestas de ejemplo de la maqueta (el escenario A: «Charla completa»). Las de un cliente de mentira: nadie real. */
export const EJEMPLOS_DE_REVISION = {
  nombre: 'Valentina',
  negocio: 'Nutri Vale',
  origen: 'Instagram',
  intereses: ['Que WhatsApp e Instagram respondan solos', 'Armar mi landing'],
  /** Si el negocio de prueba no tiene un WhatsApp verificado: el de la maqueta. */
  telefonoNumero: '5491155550101',
} as const;

/** ¿Se ve lo de la revisión (el desplegable y los ejemplos)? Sólo alguien de MaKo y sólo en un negocio de prueba. */
export function puedeVerLaRevision(o: { ws: number | null | undefined; admin: boolean }): boolean {
  return o.admin && o.ws != null && WS_PRUEBA_COMO_CLIENTE.includes(o.ws);
}

/** La respuesta de ejemplo de una pregunta que se ESCRIBE (las que tienen opciones ya se contestan con un toque). */
export function ejemploDe(etapa: string): string | null {
  if (etapa === 'nombre') return EJEMPLOS_DE_REVISION.nombre;
  if (etapa === 'negocio') return EJEMPLOS_DE_REVISION.negocio;
  return null;
}

/**
 * «AUTOCOMPLETAR» (21/11/2026, Martín: «Datos de Mauricio» sale y en su lugar va esto, desde la barra): la respuesta de ejemplo de la
 * pregunta de ahora, como si la persona la hubiera dado. Las que se escriben, con su texto; las de opciones, con la opción (el mismo
 * toque: la del ejemplo si está, si no la primera); las de varias, con las del ejemplo que estén. El WhatsApp y el código, nunca: tienen
 * su propio camino. null = nada que autocompletar.
 */
export function respuestaDeEjemplo(o: { etapa: string; opciones: readonly string[] | null; varias: number }): { cuerpo: Record<string, unknown>; mostrar: string } | null {
  const E = EJEMPLOS_DE_REVISION;
  const escrito = ejemploDe(o.etapa);
  if (escrito) return { cuerpo: { texto: escrito }, mostrar: escrito };
  if (o.etapa === 'telefono' || o.etapa === 'codigo' || !o.opciones?.length) return null;
  const ops = o.opciones;
  if (o.varias > 0) {
    const del = (o.etapa === 'interes' ? (E.intereses as readonly string[]) : []).filter((t) => ops.includes(t));
    const elegidas = (del.length ? del : [ops[0]]).slice(0, o.varias);
    return { cuerpo: { opciones: elegidas }, mostrar: elegidas.join(' · ') };
  }
  const i = Math.max(0, o.etapa === 'origen' ? ops.indexOf(E.origen) : 0);
  return { cuerpo: { opcion: i, opcionTexto: ops[i] }, mostrar: ops[i] };
}

/** «+54 9 11 5555 0101», como lo escribe la persona en su tarjeta. */
function visible(numero: string): string {
  const d = numero.replace(/\D/g, '');
  return d.startsWith('549') && d.length === 13 ? `+54 9 ${d.slice(3, 5)} ${d.slice(5, 9)} ${d.slice(9)}` : `+${d}`;
}

/**
 * El estado del arranque EN `paso`: todo lo de antes contestado con las respuestas de ejemplo, y la pregunta de `paso` sin contestar.
 * El WhatsApp de antes, el verificado del negocio (`telefonoYa`: «ya está confirmado», sin código nuevo).
 */
export function estadoArranqueHasta(paso: PasoDelArranque, o: { telefonoNumero: string | null; codigo?: string }): EstadoArranque {
  // El video de bienvenida: nada contestado y sin haberlo visto. La segunda del contacto: contestó que no lo guardó.
  if (paso === 'bienvenida') return {};
  if (paso === 'agendado-no') return { ...estadoArranqueHasta('agendado', o), agendado: 'no' };
  // El código (21/11): el WhatsApp de un número NUEVO, simulado (./whatsapp-simulado.ts): esperando el código, con «Abrir WhatsApp» que abre
  // el modal. Nada de la verificación de verdad. El código lo pone el server (`o.codigo`).
  if (paso === 'codigo') {
    const numero = o.telefonoNumero || EJEMPLOS_DE_REVISION.telefonoNumero;
    return { ...estadoArranqueHasta('telefono', o), telefono: 'codigo', telefonoNumero: `+${numero.replace(/\D/g, '')}`, telefonoVisto: visible(numero), telefonoEntrante: true, simulacion: { codigo: o.codigo ?? '000000' } };
  }
  const hasta = (['nombre', 'telefono', 'agendado', 'negocio', 'origen', 'interes', 'cierre'] as const).indexOf(paso);
  const e: EstadoArranque = { introVista: true };
  const numero = o.telefonoNumero || EJEMPLOS_DE_REVISION.telefonoNumero;
  if (hasta > 0) e.nombre = EJEMPLOS_DE_REVISION.nombre;
  if (hasta > 1) Object.assign(e, { telefono: 'verificado', telefonoNumero: numero, telefonoVisto: visible(numero), telefonoYa: true });
  if (hasta > 2) e.agendado = 'si';
  if (hasta > 3) e.negocio = EJEMPLOS_DE_REVISION.negocio;
  if (hasta > 4) e.origen = EJEMPLOS_DE_REVISION.origen;
  if (hasta > 5) e.intereses = [...EJEMPLOS_DE_REVISION.intereses];
  return e;
}

/**
 * El reto EN el día `n` (0 = «¿Qué hacemos ahora?», antes de elegir el día 1). Como si se hubiera llegado ahí: empezado ahora, con el
 * día 1 elegido y los días hasta `n` adelantados (lo mismo que escribe «Adelantar al día N», /api/reto), y las tareas de los días de
 * antes con «Lo hago después» (el día termina igual y quedan marcadas, R57-F1: las hechas de verdad las LEE MaKo, no se escriben).
 */
export function estadoRetoEnDia(n: number, ahora: number, zona?: string): EstadoReto {
  const cuando = new Date(ahora).toISOString();
  const e: EstadoReto = { v: 1, inicio: cuando, adelantado: 0, hechas: {}, ...(zona ? { zona } : {}) };
  if (n < 1) return e;
  e.dia1Desde = cuando;
  if (n > 1) {
    e.adelantado = n;
    e.adelantadoEn = cuando;
    e.avisado = n;
    e.abiertoEl = Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), cuando]));
    e.adelantados = Array.from({ length: n - 1 }, (_, i) => i + 2);
  }
  e.despues = DIAS_RETO.filter((d) => d.n < n).flatMap((d) => d.tareas.filter((t) => !t.siempre).map((t) => `${d.n}:${t.id}`));
  return e;
}

/** Lo visto EN ESTE NAVEGADOR del reto que empieza en `inicio` (app/second-brain/reto/ChatDelReto.tsx: `mako.reto.visto.`): los
 *  videos y las entradas de los días de antes del `n`; el de hoy, sin ver (como si recién llegara). */
export function clavesVistasDelReto(inicio: string, n: number, paso?: PasoDeRevision): string[] {
  const antes = Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 1).flatMap((d) => [`mako.reto.visto.${inicio}|video:${d}`, `mako.reto.visto.${inicio}|entrada:${d}`]);
  // De HOY (21/11): con el paso del video, ya entró (MaKo escribió); con una tarea, también vio el video.
  const d = paso ? partesDelDia(paso) : null;
  if (!d || d.dia !== n || (!d.video && !d.tarea)) return antes;
  return [...antes, `mako.reto.visto.${inicio}|entrada:${n}`, ...(d.tarea ? [`mako.reto.visto.${inicio}|video:${n}`] : [])];
}
