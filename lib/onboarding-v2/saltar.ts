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
import type { EstadoArranque } from '@/lib/onboarding-arranque';
import { DIAS_RETO, type EstadoReto } from '@/lib/reto/dias';

export type PasoDelArranque = 'nombre' | 'telefono' | 'agendado' | 'negocio' | 'origen' | 'interes' | 'cierre';
export type PasoDeRevision = PasoDelArranque | 'llegada' | 'reto' | `dia-${1 | 2 | 3 | 4 | 5 | 6 | 7}`;

/** Los pasos del desplegable, en el orden en que se viven. */
export const PASOS_DE_REVISION: ReadonlyArray<{ id: PasoDeRevision; grupo: 'Onboarding' | 'Ops Center' | 'Reto de 7 días'; rotulo: string }> = [
  { id: 'nombre', grupo: 'Onboarding', rotulo: 'Tu nombre' },
  { id: 'telefono', grupo: 'Onboarding', rotulo: 'Tu WhatsApp' },
  { id: 'agendado', grupo: 'Onboarding', rotulo: 'Guardar el contacto de MaKo' },
  { id: 'negocio', grupo: 'Onboarding', rotulo: 'Tu negocio' },
  { id: 'origen', grupo: 'Onboarding', rotulo: '¿Cómo llegaste a MaKo?' },
  { id: 'interes', grupo: 'Onboarding', rotulo: '¿Qué resolver primero?' },
  { id: 'cierre', grupo: 'Onboarding', rotulo: 'El cierre («Entrar a MaKo»)' },
  { id: 'llegada', grupo: 'Ops Center', rotulo: 'La llegada («¡Hola de nuevo!» y el recorrido)' },
  { id: 'reto', grupo: 'Reto de 7 días', rotulo: '«¿Qué hacemos ahora?»' },
  ...([1, 2, 3, 4, 5, 6, 7] as const).map((n) => ({ id: `dia-${n}` as const, grupo: 'Reto de 7 días' as const, rotulo: `Día ${n}` })),
];
const IDS = new Set<string>(PASOS_DE_REVISION.map((p) => p.id));
export const esPasoDeRevision = (x: unknown): x is PasoDeRevision => typeof x === 'string' && IDS.has(x);
const ARRANQUE: readonly PasoDelArranque[] = ['nombre', 'telefono', 'agendado', 'negocio', 'origen', 'interes', 'cierre'];
export const esPasoDelArranque = (p: PasoDeRevision): p is PasoDelArranque => (ARRANQUE as readonly string[]).includes(p);
/** El día del reto de un paso: 0 = «¿Qué hacemos ahora?», 1 a 7; null si no es del reto. */
export const diaDelPaso = (p: PasoDeRevision): number | null => (p === 'reto' ? 0 : p.startsWith('dia-') ? Number(p.slice(4)) : null);

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

/** «+54 9 11 5555 0101», como lo escribe la persona en su tarjeta. */
function visible(numero: string): string {
  const d = numero.replace(/\D/g, '');
  return d.startsWith('549') && d.length === 13 ? `+54 9 ${d.slice(3, 5)} ${d.slice(5, 9)} ${d.slice(9)}` : `+${d}`;
}

/**
 * El estado del arranque EN `paso`: todo lo de antes contestado con las respuestas de ejemplo, y la pregunta de `paso` sin contestar.
 * El WhatsApp de antes, el verificado del negocio (`telefonoYa`: «ya está confirmado», sin código nuevo).
 */
export function estadoArranqueHasta(paso: PasoDelArranque, o: { telefonoNumero: string | null }): EstadoArranque {
  const hasta = ARRANQUE.indexOf(paso);
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
export function clavesVistasDelReto(inicio: string, n: number): string[] {
  return Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 1).flatMap((d) => [`mako.reto.visto.${inicio}|video:${d}`, `mako.reto.visto.${inicio}|entrada:${d}`]);
}
