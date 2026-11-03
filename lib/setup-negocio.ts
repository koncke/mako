// =============================================================================
// setup-negocio — lo que un negocio tiene que dejar CONECTADO para terminar su onboarding (27/10/2026)
// =============================================================================
// Martín (27/10/2026), textual: «en el onboarding también es importante no dejarlos avanzar hasta que no hayan hecho su
// setup, descargar la app de mako, instalar la extensión, conectar su cuenta de Meta con login, etc... Fijate si
// necesitamos agregar otra cosa. Claro que siempre el sistema debe detectar si ya lo tienen, por ejemplo, si ya tienen
// la app desktop instalada o la extensión».
//
// Las reglas PURAS (sin `server-only`, con test que las ejecuta): qué pasos tiene el setup, cuáles se pueden saltear y
// con qué frase, y cuándo está completo. Qué pasos le tocan a cada plan lo dice su capa (lib/capas.ts → `setup`). Lo que
// MIDE cada paso vive en lib/setup-negocio-server.ts.
//
// ⚠️ EL ESTADO ES VIVO, NO RECORDADO. Un paso está hecho porque MaKo lo DETECTA hoy (la computadora conectada, la
//    extensión vista, la cuenta conectada), nunca porque alguien tildó una casilla: si ya lo tenía, ni aparece como
//    pendiente, y si lo desconecta, vuelve a faltar. Lo único que se guarda es lo que la persona DECIDE (saltear Meta
//    porque no hace anuncios) y la versión de la extensión que vio su navegador (la extensión vive en el navegador: el
//    servidor no la puede ver de otra forma hasta que se conecta al puente).
// ⚠️ «NO PUDE COMPROBARLO» NO ES «HECHO». Una lectura caída deja el paso pendiente con su motivo (y la persona puede
//    reintentar): un setup que se da por terminado porque la base no contestó es el gate que no frena nada.
// ⚠️ SALTEAR SÓLO LO QUE SE PUEDE NO TENER. Meta, si no hace anuncios; Google Calendar, si su modelo no usa reuniones ni
//    visitas (lib/modelo-negocio.ts → `agenda`). La computadora, la extensión, WhatsApp y su IA no se saltean: sin ellas
//    MaKo no trabaja (su IA la paga cada negocio, D6b).
// ⚠️ EL PIXEL Y LA PASARELA DE COBRO NO SON PASOS, a propósito (27/10/2026): el Pixel necesita una página publicada que
//    el onboarding todavía no conoce (no la pregunta), y cobrar online es de quien vende por carrito; a una inmobiliaria
//    o a quien cobra por transferencia los trabaría por algo que no usa. Se ofrecen en su tab.
// =============================================================================

import { usaAgenda, type ModeloNegocio } from './modelo-negocio';

export const PASOS_SETUP = ['desktop', 'extension', 'meta', 'whatsapp', 'calendario', 'ia'] as const;
export type PasoSetup = (typeof PASOS_SETUP)[number];

export const esPasoSetup = (v: unknown): v is PasoSetup => typeof v === 'string' && (PASOS_SETUP as readonly string[]).includes(v);

/** Las formas de saltear un paso (lo que se guarda). */
export const SALTOS = ['sin_anuncios', 'sin_agenda'] as const;
export type Salto = (typeof SALTOS)[number];

export type DefSetup = {
  id: PasoSetup;
  /** El nombre del paso (corto: es un renglón). */
  titulo: string;
  /** Para qué sirve, en una frase. */
  para: string;
  /** El botón que lo resuelve. */
  boton: string;
  /** Sólo se hace en una computadora (en el teléfono, la tarjeta lo dice en vez de ofrecer el botón). */
  soloComputadora?: true;
};

export const SETUP: Readonly<Record<PasoSetup, DefSetup>> = {
  desktop: { id: 'desktop', titulo: 'MaKo en tu computadora', para: 'Para que MaKo trabaje desde tu computadora.', boton: 'Instalar MaKo', soloComputadora: true },
  extension: { id: 'extension', titulo: 'La extensión de Chrome', para: 'Para que MaKo use WhatsApp Web y Google Flow por ti.', boton: 'Instalar la extensión', soloComputadora: true },
  meta: { id: 'meta', titulo: 'Tu cuenta de Meta', para: 'Tus anuncios y tus formularios, en MaKo.', boton: 'Conectar con Facebook' },
  whatsapp: { id: 'whatsapp', titulo: 'Tu WhatsApp', para: 'Tus chats y tus mensajes salen por tu número.', boton: 'Conectar con QR', soloComputadora: true },
  calendario: { id: 'calendario', titulo: 'Google Calendar', para: 'Tus reuniones y visitas, en MaKo.', boton: 'Conectar Google Calendar' },
  ia: { id: 'ia', titulo: 'Tu IA', para: 'Tu Claude o tu ChatGPT: cada negocio usa la suya.', boton: 'Conectar tu IA' },
};

/** La frase del botón que saltea un paso. */
export const TEXTO_SALTO: Readonly<Record<Salto, string>> = { sin_anuncios: 'No hago anuncios', sin_agenda: 'No agendo reuniones' };

/** El paso que saltea cada forma. */
const PASO_DEL_SALTO: Readonly<Record<Salto, PasoSetup>> = { sin_anuncios: 'meta', sin_agenda: 'calendario' };

/** Cómo se puede saltear un paso para ESTE modelo, o null si no se puede. */
export function saltoPermitido(paso: PasoSetup, modelo: ModeloNegocio | null | undefined): Salto | null {
  if (paso === 'meta') return 'sin_anuncios';
  if (paso === 'calendario' && !usaAgenda(modelo)) return 'sin_agenda';
  return null;
}

/** Lo que MIDIÓ el servidor de cada paso: hecho (con su detalle), no hecho, o no se pudo comprobar. */
export type Deteccion = { hecho: true; detalle?: string } | { hecho: false } | { noPude: string };
export type Detectado = Partial<Record<PasoSetup, Deteccion>>;
/** Lo que se guarda: lo que la persona decidió saltear (paso → forma). */
export type Saltos = Partial<Record<PasoSetup, Salto>>;

export type EstadoPaso = 'hecho' | 'saltado' | 'falta' | 'no_pude';
export type ItemSetup = {
  paso: PasoSetup;
  estado: EstadoPaso;
  /** Lo que se comprobó («Versión 0.74.0»), o por qué no se pudo comprobar. */
  detalle?: string;
  /** Cómo se puede saltear (si se puede). */
  salto: Salto | null;
};
export type EstadoSetup = {
  items: ItemSetup[];
  /** Todos hechos o salteados (y hay al menos uno). Sin pasos, completo. */
  completo: boolean;
  /** Los que faltan, en orden. */
  faltan: PasoSetup[];
};

/**
 * El estado del setup. Un salto cuenta SÓLO si hoy está permitido para su modelo (un «No agendo reuniones» guardado
 * cuando vendía por chat no vale si ahora vende con reuniones). Lo que no se pudo comprobar, falta.
 */
export function estadoSetup(pasos: readonly PasoSetup[], detectado: Detectado, saltos: Saltos, modelo: ModeloNegocio | null | undefined): EstadoSetup {
  const items: ItemSetup[] = pasos.map((paso) => {
    const salto = saltoPermitido(paso, modelo);
    const d = detectado[paso];
    if (d && 'hecho' in d && d.hecho) return { paso, estado: 'hecho', salto, ...(d.detalle ? { detalle: d.detalle } : {}) };
    if (salto && saltos[paso] === salto) return { paso, estado: 'saltado', salto, detalle: TEXTO_SALTO[salto] };
    if (d && 'noPude' in d) return { paso, estado: 'no_pude', salto, detalle: d.noPude };
    return { paso, estado: 'falta', salto };
  });
  const faltan = items.filter((i) => i.estado === 'falta' || i.estado === 'no_pude').map((i) => i.paso);
  return { items, completo: faltan.length === 0, faltan };
}

/**
 * Lo que queda guardado al saltear (o al volver a pedir) un paso. Valida contra el modelo, en positivo: un salto que no
 * corresponde a ese paso, o que su modelo no permite, es un error con el porqué.
 */
export function aplicarSalto(saltos: Saltos, paso: PasoSetup, salto: Salto | null, modelo: ModeloNegocio | null | undefined): { saltos: Saltos } | { error: string } {
  if (salto === null) {
    const resto = { ...saltos };
    delete resto[paso];
    return { saltos: resto };
  }
  if (PASO_DEL_SALTO[salto] !== paso) return { error: `«${TEXTO_SALTO[salto]}» no es una forma de saltear «${SETUP[paso].titulo}».` };
  if (saltoPermitido(paso, modelo) !== salto) return { error: `«${SETUP[paso].titulo}» no se puede saltear: tu forma de vender usa reuniones.` };
  return { saltos: { ...saltos, [paso]: salto } };
}

/** El setting donde se guarda lo que la persona decidió y la extensión que vio su navegador. */
export const CLAVE_SETUP = 'onboarding.setup';
export type GuardadoSetup = { saltos?: Saltos; extension?: { version: string; at: string } };

/** Lo guardado, saneado (tira si no es JSON: quien ESCRIBE no puede pisar lo que no entendió). */
export function setupGuardado(raw: string | null | undefined): GuardadoSetup {
  if (!raw) return {};
  const v = JSON.parse(raw) as Record<string, unknown>;
  const out: GuardadoSetup = {};
  if (v.saltos && typeof v.saltos === 'object') {
    const saltos: Saltos = {};
    for (const [k, s] of Object.entries(v.saltos as Record<string, unknown>)) {
      if (esPasoSetup(k) && typeof s === 'string' && (SALTOS as readonly string[]).includes(s)) saltos[k] = s as Salto;
    }
    out.saltos = saltos;
  }
  const ext = v.extension as Record<string, unknown> | undefined;
  if (ext && typeof ext.version === 'string' && VERSION_RE.test(ext.version) && typeof ext.at === 'string') out.extension = { version: ext.version, at: ext.at };
  return out;
}

/** Una versión de la extensión como la pone su manifiesto (x.y.z). Lo demás no se guarda. */
export const VERSION_RE = /^\d{1,3}(?:\.\d{1,4}){1,3}$/;

/** Lo que dice la tarjeta arriba de la lista: cuántos faltan, o que ya está. */
export function resumenSetup(e: EstadoSetup): string {
  if (e.completo) return 'Todo listo.';
  const n = e.faltan.length;
  return n === 1 ? 'Te falta 1 paso.' : `Te faltan ${n} pasos.`;
}
