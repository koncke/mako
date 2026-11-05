// =============================================================================
// MaKo toma la iniciativa: la APERTURA de un chat, sus reglas y su memoria (PURO; 29/10/2026)
// =============================================================================
// Martín (29/10/2026): «en todos lados que haya un chat de MaKo, que MaKo te vaya guiando dependiendo del template que se
// eligió, o de la situación de la persona… EN LUGAR de botones en la top bar… cuando el usuario llega por primera vez… que MaKo
// tome la iniciativa». El plan: docs/mako-iniciativa/plan.md §2.
//
// UNA APERTURA es el primer mensaje de MaKo en un chat:
//   · la arma el CÓDIGO, sin IA y sin gastar la IA de nadie (por eso se dibuja aunque falte la app de escritorio);
//   · una o dos frases, y la última es UNA pregunta de HECHO («¿Cuál usas?»), nunca de acción («¿Quieres que…?»);
//   · de 2 a 4 botones, el primero es el recomendado, y uno es de callar («Ahora no»).
// La función de cada superficie (./ops.ts, después ./copywriter.ts, ./crm.ts…) devuelve `null` si no falta nada: MaKo calla.
// NO es una recomendación (lib/recomendaciones*.ts: señal medida, plegadas) ni un recorrido (no tapa la pantalla).
//
// LA MEMORIA es POR PERSONA, en `usuarios.perfil.aperturas` (al lado de `recorridos`, mig 0056: sin migración), con el
// workspace en la clave: «<ws>:<id>[|<entidad>]». El perfil cruza negocios (una agencia, el super admin mirando un cliente), y
// sin el workspace un «Ahora no» en un negocio callaba a MaKo en todos. Acá viven las claves y las anotaciones SIN el workspace:
// lo pone y lo saca la ruta (app/api/aperturas/route.ts), que es la que sabe en qué negocio está la sesión.
//
// Este archivo lo importan la pantalla, la ruta y los tests: sin React, sin `server-only`.
// =============================================================================

// ── La apertura ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Lo que dice un botón de callar. Sólo estos: «Después» o «Cancelar» no compilan (cada uno anota distinto, abajo). Los tres
 * últimos son de la guía de cada pestaña (lib/guia/): «Ya sé usarla» a su primera pregunta, «No, gracias» a «¿Algo más?» y
 * «Salir» mientras señala.
 */
export type RotuloCallar = 'Ahora no' | 'Lo hago yo' | 'Lo edito yo' | 'Lo escribo yo' | 'Ya sé usarla' | 'No, gracias' | 'Salir';

/**
 * Un botón de la apertura:
 *   · `respuesta`: un HECHO que contesta la persona; la superficie vuelve a correr con él (`Respuestas`);
 *   · `ir`: un link que la persona elige (nunca navega solo);
 *   · `hacer`: código de la pantalla, sin IA (`accion` es de la superficie: el montaje la recibe en un `Record` tipado, así que
 *     ofrecer algo que la pantalla no hace no compila). Las COMUNES las hace la pieza misma (app/_chat/AperturaMako.tsx):
 *     `instalar` es «Instalar MaKo» de la caja (InstalarMaKo, con su «ya lo descargó»), y `conectar` abre «Tus cuentas de IA»;
 *   · `pedir`: la IA del negocio, con el texto que arma el código (se dibuja como mensaje de la persona);
 *   · `callar`: MaKo se calla (cuánto, lo dice `anotar`).
 */
export type Boton<A extends string = string> =
  | { tipo: 'respuesta'; rotulo: string; valor: string }
  | { tipo: 'ir'; rotulo: string; href: string }
  | { tipo: 'hacer'; rotulo: string; accion: A | AccionComun }
  | { tipo: 'pedir'; rotulo: string; pedido: string }
  | { tipo: 'callar'; rotulo: RotuloCallar };

export type Apertura<A extends string = string> = {
  /** `<superficie>:<paso>` («ops:ia»): la clave de su memoria. Cada paso de una cadena tiene la suya. */
  id: string;
  /** `negocio`: habla de lo que le falta al negocio (una vez por día). `entidad`: de la pieza abierta (su chat vacío). */
  alcance: 'negocio' | 'entidad';
  /** La pieza (la página, el diseño): va en la clave, `ops:ia|<entidad>`. */
  entidad?: string;
  texto: string;
  /** El primero que no es de callar es el recomendado (★). */
  botones: readonly Boton<A>[];
  /** Lo que dice al lado de la estrella cerrada: 4 palabras o menos, un hecho, con «?». */
  corto?: string;
  /** Se contesta también escribiendo (una pregunta de texto libre, «¿Qué vas a vender con esto?»). Sin la app no se ofrece. */
  libre?: true;
};

/** Las acciones que hace la pieza misma, en toda superficie: «Instalar MaKo» (la de la caja) y «Tus cuentas de IA». */
export const ACCIONES_COMUNES = ['instalar', 'conectar'] as const;
export type AccionComun = (typeof ACCIONES_COMUNES)[number];
export const esAccionComun = (a: string): a is AccionComun => (ACCIONES_COMUNES as readonly string[]).includes(a);

/** Lo que la persona ya contestó en ESTA superficie: el id de cada paso y su valor (de la memoria y de esta visita). */
export type Respuestas = Readonly<Record<string, string>>;

/**
 * Una superficie: su id (el prefijo de sus pasos), las acciones que su pantalla hace, y la función. `H` son sus hechos, leídos
 * VIVOS: una apertura no se «marca hecha»; si el hecho cambió, la función ya no la devuelve.
 */
export type Superficie<H, A extends string = never> = {
  id: string;
  acciones: readonly A[];
  apertura: (h: H, r: Respuestas) => Apertura<A> | null;
};

/** El primer botón que no calla: el recomendado. */
export const recomendadoDe = <A extends string>(a: Apertura<A>): Boton<A> | null => a.botones.find((b) => b.tipo !== 'callar') ?? null;

// ── Los topes, y la pregunta de hecho ───────────────────────────────────────────────────────────────────────────────

export const TOPE_TEXTO = 160;
export const TOPE_ROTULO = 28;
export const TOPE_CORTO_PALABRAS = 4;
export const MIN_BOTONES = 2;
export const MAX_BOTONES = 4;

/**
 * Una pregunta de ACCIÓN: «¿Quieres que…?», «¿Te ayudo…?», «¿Lo adapto?», «¿Cargamos tus clientes?». La regla es preguntar el
 * hecho (lo que pasa, lo que tiene) y que la acción sea la consecuencia. Con la primera persona del plural: sin ella,
 * «¿Cargamos tus clientes?» pasaba.
 */
export const PREGUNTA_DE_ACCION = /¿\s*(quieres que|te ayudo|lo (adapto|armo|escribo|hago|cargo|creo|subo)|(adapto|armo|creo|genero|hago|cargo|conecto)\b|(cargamos|armamos|creamos|conectamos|hacemos|empezamos|arrancamos)\b)/i;

/**
 * Las que preguntan una acción A PROPÓSITO, por su id y con su porqué escrito. Hoy una sola: la guía de cada pestaña
 * (lib/guia/reglas.ts → `preguntaDeLaGuia`) pregunta con la frase literal de Martín, «¿Quieres que te ayude a aprender a usar
 * esta pestaña?». El 29/10 la crítica la cambió por «¿Qué vienes a hacer en <Tab>?» para cumplir «preguntar hechos», que es una
 * regla de FORMULARIOS; el Cerebro decidió que gana el pedido posterior y explícito de Martín (docs/mako-iniciativa/README.md).
 */
export const EXCEPCIONES_PREGUNTA_DE_ACCION: readonly { id: RegExp; porque: string }[] = [
  { id: /^guia:/, porque: 'La pregunta de la guía es la frase literal de Martín (29/10/2026), y su pedido posterior gana sobre la regla de formularios.' },
];

const palabras = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
/** La última oración del texto (la pregunta): lo que va después del último punto. */
const ultimaOracion = (s: string) => s.trim().split(/(?<=[.!])\s+/).pop() ?? '';

/**
 * Lo que una apertura tiene mal, en palabras (vacío = bien). Lo corre tests/aperturas.test.ts sobre los ejemplos de cada
 * superficie. `primerPaso`: la que abre una cadena tiene que terminar en una pregunta de hecho; las que siguen pueden decir
 * qué hacer («Instala MaKo y conecta tu Claude.»).
 */
export function problemasDeApertura(a: Apertura<string>, o: { primerPaso: boolean }): string[] {
  const out: string[] = [];
  if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(a.id)) out.push(`id «${a.id}»: tiene que ser <superficie>:<paso>, en minúsculas`);
  if (a.texto.length > TOPE_TEXTO) out.push(`el texto tiene ${a.texto.length} caracteres (tope ${TOPE_TEXTO})`);
  const excepcion = EXCEPCIONES_PREGUNTA_DE_ACCION.some((e) => e.id.test(a.id));
  if (o.primerPaso) {
    if (!a.texto.trim().endsWith('?')) out.push('el primer paso termina en una pregunta');
    if (!excepcion && PREGUNTA_DE_ACCION.test(ultimaOracion(a.texto))) out.push(`pregunta una acción: «${ultimaOracion(a.texto)}»`);
  }
  if (a.corto != null) {
    if (palabras(a.corto) > TOPE_CORTO_PALABRAS) out.push(`el corto tiene más de ${TOPE_CORTO_PALABRAS} palabras`);
    if (!a.corto.trim().endsWith('?')) out.push('el corto es un hecho con «?»');
    if (!excepcion && PREGUNTA_DE_ACCION.test(a.corto)) out.push(`el corto pregunta una acción: «${a.corto}»`);
  }
  if (a.botones.length < MIN_BOTONES || a.botones.length > MAX_BOTONES) out.push(`tiene ${a.botones.length} botones (de ${MIN_BOTONES} a ${MAX_BOTONES})`);
  if (!a.botones.some((b) => b.tipo !== 'callar')) out.push('ningún botón avanza');
  if (!a.botones.some((b) => b.tipo === 'callar')) out.push('falta el botón de callar');
  for (const b of a.botones) if (b.rotulo.length > TOPE_ROTULO) out.push(`el botón «${b.rotulo}» tiene más de ${TOPE_ROTULO} caracteres`);
  const rotulos = a.botones.map((b) => b.rotulo);
  if (new Set(rotulos).size !== rotulos.length) out.push('dos botones dicen lo mismo');
  return out;
}

// ── La memoria ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Lo que la persona DECIDIÓ con una apertura (nada más se recuerda: el resto se lee vivo). */
export type DecisionApertura = 'vista' | 'respondida' | 'ahora-no' | 'nunca';

export type AnotacionApertura = {
  d: DecisionApertura;
  /** Cuándo (ISO). */
  at: string;
  /** En cuántos días distintos se vio sin respuesta. */
  vistas?: number;
  /** Cuántos «Ahora no» lleva (el segundo es `nunca`). */
  ahoraNo?: number;
  /** El hecho que contestó (`respuesta`): «claude». */
  valor?: string;
  /** Lo que pidió y no se pudo pedir (sin la app o sin su IA): sale apenas haya con qué. */
  pendiente?: string;
};

/** Lo de ESTE negocio: la clave sin el workspace («ops:ia», «copywriter:oferta|pg-12»). */
export type MemoriaAperturas = Readonly<Record<string, AnotacionApertura>>;

export const CLAVE_PERFIL_APERTURAS = 'aperturas';
/** Cuántas claves se recuerdan por persona (todos sus negocios): pasado el tope se olvidan las más viejas. */
export const TOPE_CLAVES = 200;
export const DIAS_AHORA_NO = 14;
/** Tres vistas sin respuesta, en días distintos: calla 14 días (lo mismo que el motor de recomendaciones). */
export const VISTAS_SIN_RESPUESTA = 3;
const DIA_MS = 86_400_000;

/** La clave de una apertura en este negocio, sin el workspace: «ops:ia» o «ops:ia|<entidad>». */
export const claveApertura = (id: string, entidad?: string | null): string => (entidad ? `${id}|${entidad}` : id);

/** Una clave válida sin el workspace (la valida la ruta antes de escribir: viene del navegador). */
export function claveValida(c: unknown): c is string {
  return typeof c === 'string' && c.length <= 120 && /^[a-z0-9-]+:[a-z0-9-]+(\|[A-Za-z0-9_-]{1,60})?$/.test(c);
}

/** Las claves especiales que no son una apertura: el corto del día en toda la app y la primera visita de la estrella por tab. */
export const CLAVE_CORTO = 'mako:corto';
export const claveEstrella = (tab: string): string => claveApertura('mako:estrella', tab.normalize('NFD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'tab');

const mismoDia = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** La anotación nueva de una decisión. Nunca baja una `respondida` ni un `nunca` a «vista». */
export function anotar(prev: AnotacionApertura | undefined, d: DecisionApertura, ahora: number, extra: { valor?: string; pendiente?: string } = {}): AnotacionApertura {
  const at = new Date(ahora).toISOString();
  switch (d) {
    case 'vista': {
      if (prev && (prev.d === 'nunca' || prev.d === 'respondida')) return prev;
      // Se cuentan DÍAS: verla dos veces el mismo día no es ignorarla dos veces.
      const otroDia = !prev || prev.d !== 'vista' || !mismoDia(Date.parse(prev.at), ahora);
      return { d: 'vista', at, vistas: (prev?.vistas ?? 0) + (otroDia ? 1 : 0), ...(prev?.ahoraNo ? { ahoraNo: prev.ahoraNo } : {}) };
    }
    case 'ahora-no': {
      const n = (prev?.ahoraNo ?? 0) + 1;
      return n >= 2 ? { d: 'nunca', at, ahoraNo: n } : { d: 'ahora-no', at, ahoraNo: n };
    }
    case 'respondida':
      return { d: 'respondida', at, ...(extra.valor != null ? { valor: extra.valor.slice(0, 200) } : {}), ...(extra.pendiente ? { pendiente: extra.pendiente.slice(0, 600) } : {}) };
    case 'nunca':
      return { d: 'nunca', at };
  }
}

/** Cuánto calla cada botón de callar: «Ahora no», 14 días (dos, para siempre); «Lo hago yo» y los suyos, para siempre. */
export const decisionDeCallar = (r: RotuloCallar): DecisionApertura => (r === 'Ahora no' ? 'ahora-no' : 'nunca');

/**
 * ¿Puede hablar esta apertura? (plan.md §2.7)
 *   · `nunca` y `respondida`: no (lo que sigue de una cadena es OTRO paso, con su clave);
 *   · «Ahora no»: 14 días;
 *   · vista sin respuesta: las de alcance `negocio` hablan una vez por día (ignorada, calla hasta mañana); tres días ignorada,
 *     14 días.
 */
export function puedeHablar(a: AnotacionApertura | undefined, alcance: Apertura['alcance'], ahora: number): boolean {
  if (!a) return true;
  const hace = ahora - (Date.parse(a.at) || 0);
  switch (a.d) {
    case 'nunca':
    case 'respondida':
      return false;
    case 'ahora-no':
      return hace >= DIAS_AHORA_NO * DIA_MS;
    case 'vista':
      if (alcance === 'negocio' && mismoDia(Date.parse(a.at), ahora)) return false;
      return (a.vistas ?? 0) < VISTAS_SIN_RESPUESTA || hace >= DIAS_AHORA_NO * DIA_MS;
  }
}

/**
 * El prefijo de los HECHOS DEL NEGOCIO que comparten varias superficies (`negocio:plan`, `negocio:funnel`; lib/aperturas/comunes.ts):
 * contestado en una, la otra no lo vuelve a preguntar. Una apertura puede llevar este prefijo en vez del de su superficie, y
 * `useApertura` suma estas respuestas a las de la superficie.
 */
export const PREFIJO_NEGOCIO = 'negocio';

/** Lo que la persona contestó en esta superficie, de la memoria: el `valor` de cada paso respondido. */
export function respuestasDeMemoria(m: MemoriaAperturas, superficie: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, a] of Object.entries(m)) if (a.d === 'respondida' && a.valor != null && k.startsWith(`${superficie}:`) && !k.includes('|')) out[k] = a.valor;
  return out;
}

// ── El perfil (lo que escribe la ruta) ──────────────────────────────────────────────────────────────────────────────

const esAnotacion = (v: unknown): v is AnotacionApertura => {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (o.d === 'vista' || o.d === 'respondida' || o.d === 'ahora-no' || o.d === 'nunca') && typeof o.at === 'string' && !!o.at;
};

/** Todas las anotaciones del perfil (con el workspace en la clave), saneadas: el jsonb lo escriben otras pantallas. */
export function aperturasDePerfil(perfil: unknown): Record<string, AnotacionApertura> {
  const crudo = perfil && typeof perfil === 'object' ? (perfil as Record<string, unknown>)[CLAVE_PERFIL_APERTURAS] : null;
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return {};
  const out: Record<string, AnotacionApertura> = {};
  for (const [k, v] of Object.entries(crudo as Record<string, unknown>)) {
    const i = k.indexOf(':');
    if (i > 0 && /^\d+$/.test(k.slice(0, i)) && claveValida(k.slice(i + 1)) && esAnotacion(v)) out[k] = v;
  }
  return out;
}

/** Lo de UN negocio, sin el workspace en la clave: lo que ve la pantalla. */
export function memoriaDelNegocio(perfil: unknown, ws: number): MemoriaAperturas {
  const out: Record<string, AnotacionApertura> = {};
  const pre = `${ws}:`;
  for (const [k, v] of Object.entries(aperturasDePerfil(perfil))) if (k.startsWith(pre)) out[k.slice(pre.length)] = v;
  return out;
}

/**
 * El `perfil` con una decisión anotada. ⚠️ CONSERVA TODO LO DEMÁS (el jsonb se reescribe entero: el teléfono, el cargo, los
 * recorridos), como `perfilConVisto` en lib/recorridos.ts. Pasado el tope se olvidan las más viejas, nunca la de ahora.
 */
export function perfilConApertura(perfil: unknown, ws: number, clave: string, d: DecisionApertura, ahora: number, extra: { valor?: string; pendiente?: string } = {}): Record<string, unknown> {
  const base = perfil && typeof perfil === 'object' && !Array.isArray(perfil) ? { ...(perfil as Record<string, unknown>) } : {};
  const todas = aperturasDePerfil(base);
  const k = `${ws}:${clave}`;
  todas[k] = anotar(todas[k], d, ahora, extra);
  const claves = Object.keys(todas);
  if (claves.length > TOPE_CLAVES) {
    const sobran = claves.filter((x) => x !== k).sort((a, b) => todas[a].at.localeCompare(todas[b].at)).slice(0, claves.length - TOPE_CLAVES);
    for (const x of sobran) delete todas[x];
  }
  base[CLAVE_PERFIL_APERTURAS] = todas;
  return base;
}

/** ¿La persona nunca vio una apertura, en ningún negocio? La primera lleva delante «¡Hola, <nombre>! Soy MaKo.». */
export const primeraVezDe = (perfil: unknown): boolean => Object.keys(aperturasDePerfil(perfil)).length === 0;

/** El saludo de la primera apertura, delante de su texto. Sin nombre, sin coma colgada. */
export const saludoDe = (nombre: string | null | undefined): string => {
  const primero = (nombre ?? '').trim().split(/\s+/)[0] ?? '';
  return primero ? `¡Hola, ${primero}! Soy MaKo.` : '¡Hola! Soy MaKo.';
};
