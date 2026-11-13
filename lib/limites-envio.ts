// =============================================================================
// limites-envio — los TOPES de las automatizaciones, configurables por negocio
// =============================================================================
// Pedido de Martín (11/10/2026, décima tanda, GENERAL 4), textual: «Quiero agregar un botón de
// "Configuraciones", que se despliegue un modal, dentro se puede editar el horario de oficina... Pero
// también configuraciones sobre todo para limitaciones de todos los flujos, si estoy prospectando en frio
// con esto, que se tenga en cuenta las configuraciones que en su momento tuvimos en cuenta, como que no se
// envien más de X cantidad de mensajes... Que todo eso sea configurable.»
//
// El inventario de los números cableados y el porqué de cada rango, en
// docs/diseno-automations-configuraciones.md §1. Lo que vive acá:
//   · LA CLAVE (`mako.limites_envio` en `app_settings`, por workspace y SIN herencia, como el horario).
//   · LO DE FÁBRICA = LO DE HOY: el env si está puesto, si no la constante que el motor tenía cableada.
//   · UN CAMPO AUSENTE = EL DE FÁBRICA. Se guarda sólo lo que difiere: sumar un campo mañana no pide
//     migración, y nadie queda con un valor que no eligió (si el de fábrica cambia, cambia para él).
//   · GUARDAR RECHAZA LO QUE ESTÁ FUERA DE RANGO; NUNCA RECORTA EN SILENCIO (un 0 en «por día» no se
//     guarda como 1: se le dice a quien lo escribió).
//
// Lo que NO se configura, a propósito (decisión 1 del diseño): las 3 h con reunión en ≤ 48 h, el residuo,
// las ventanas de los eventos de antes, el «escribiendo…» y la ventana de Instagram/Messenger (ésa es de
// Meta, no nuestra).
//
// ⚠️ EL TOPE ES POR NEGOCIO, NO POR NÚMERO (`enviosUltimas24h` cuenta el canal entero): con dos líneas de
// WhatsApp, las dos comparten el «por día». Es lo de hoy y queda así.
//
// ⚠️ PURO, SIN `server-only` Y SIN IMPORTS (molde: lib/horario-envio.ts): lo importan el motor, las
// acciones de Configuraciones, el panel (navegador) y su test. Lo de fábrica NO se lee de `process.env`
// acá: en el navegador el env del server no existe y daría las constantes; lo calcula el server
// (`limitesDeFabrica(process.env)`) y se lo pasa a la pantalla.
// =============================================================================

/** La clave en `app_settings`. Una sola: la leen el motor y la pantalla. */
export const KEY_LIMITES_ENVIO = 'mako.limites_envio';

export type LimitesEnvio = {
  /** WhatsApp (el presupuesto anti-ban de la LÍNEA). */
  wa: {
    /** Mensajes por día y negocio, en 24 h móviles. */
    dia: number;
    /** Mensajes por hora de reloj (el «por corrida» de cuando el cron corría cada hora). */
    hora: number;
    /** Horas mínimas entre dos mensajes a la misma persona (el freno de la prospección en frío). */
    personaHoras: number;
    /**
     * LA RAMPA DE LA LÍNEA (5/11/2026, Black November de Leila: a Mauricio le suspendieron el número 24 h al pasar de unos 20
     * a 60 por día). El tope por día arranca en `arranqueDia` y sube `arranqueSube` cada día que llegó a su tope, hasta `dia`
     * (`topeConRampa`, lib/goteo.ts), contando lo que SALIÓ por WhatsApp de las automatizaciones del negocio: una línea que
     * ya viene mandando no vuelve a empezar (los días que llegaron ya cuentan), y una que pasó más de 2 días seguidos callada, sí.
     * ⚠️ Cuenta el NEGOCIO, como el tope: un número nuevo de un negocio que ya venía mandando no arranca de a poco.
     */
    arranqueDia: number;
    arranqueSube: number;
  };
  /** Email (la reputación del dominio del negocio). */
  email: {
    dia: number;
    personaHoras: number;
    /**
     * LA RAMPA DEL DOMINIO (4/11/2026, la campaña de email de Mauricio): el tope de la línea de email arranca en
     * `arranqueDia` y sube `arranqueSube` cada día que llegó a su tope, hasta `dia` (`topeConRampa`, lib/goteo.ts). Un
     * dominio nuevo que manda 100 el primer día se va a spam; uno que ya mandaba no la nota (los días que llegaron ya cuentan).
     */
    arranqueDia: number;
    arranqueSube: number;
  };
  /** MaKo contesta sola (el setter, #787/#788). */
  mako: {
    /** Respuestas automáticas por persona en 24 h. 0 = siempre borrador. */
    solasPor24h: number;
    /** Días que la charla con el lead sigue abierta después del último intercambio. */
    diasCharla: number;
  };
};

/** Lo que el motor tenía cableado el 11/10/2026 (lib/nutricion.ts y lib/setter-conversacion.ts). */
export const LIMITES_CONSTANTES: LimitesEnvio = {
  // La rampa de la línea, desde el 5/11/2026: 20 el primer día y 20 más cada día que llega a su tope (la de la difusión).
  wa: { dia: 40, hora: 6, personaHoras: 20, arranqueDia: 20, arranqueSube: 20 },
  // La rampa, desde el 4/11/2026: 50 el primer día y 50 más cada día que llega a su tope.
  email: { dia: 100, personaHoras: 20, arranqueDia: 50, arranqueSube: 50 },
  mako: { solasPor24h: 3, diasCharla: 7 },
};

/** Los rangos que se pueden elegir, ambos extremos incluidos. Enteros. */
export const RANGOS_LIMITES = {
  wa: { dia: [1, 150], hora: [1, 30], personaHoras: [3, 72], arranqueDia: [1, 150], arranqueSube: [1, 150] },
  email: { dia: [1, 500], personaHoras: [1, 168], arranqueDia: [1, 500], arranqueSube: [1, 500] },
  mako: { solasPor24h: [0, 10], diasCharla: [1, 30] },
} as const satisfies { [G in keyof LimitesEnvio]: { [K in keyof LimitesEnvio[G]]: readonly [number, number] } };

/**
 * EL EMAIL POR DÍA DE QUIEN MANDA CON SU PROPIA CUENTA (13/11/2026, ticket #93; decisión del Cerebro). Un negocio que manda con
 * SU clave de Resend y SU dominio verificado (Mauricio, elevate.com.mx desde el 9/11) puede subir «Email por día» hasta
 * 2.000: es su cuenta y su riesgo (Resend Pro da 50.000 por mes). Quien manda con la clave de la PLATAFORMA sigue con el
 * máximo de 500: ahí se cuida el dominio de MaKo. El arranque y la suba de la rampa siguen de 1 a 500 para todos.
 * La pregunta «¿con qué cuenta manda?» es de la base (`opcionesDeRango`, lib/limites-envio-cuenta.ts); acá, la regla.
 */
export const EMAIL_DIA_MAX_CUENTA_PROPIA = 2000;
const RANGO_EMAIL_DIA_CUENTA_PROPIA: readonly [number, number] = [RANGOS_LIMITES.email.dia[0], EMAIL_DIA_MAX_CUENTA_PROPIA];

/** Con qué cuenta manda el negocio. `cuentaPropia`: su clave de Resend Y su dominio. Sin decirlo, la de la plataforma. */
export type OpcionesRango = { cuentaPropia?: boolean };

/** El rango de un campo para ESTE negocio (el de «Email por día» cambia con la cuenta). */
export function rangoDeLimite(grupo: keyof LimitesEnvio, campo: string, o?: OpcionesRango): readonly [number, number] {
  return grupo === 'email' && campo === 'dia' && o?.cuentaPropia
    ? RANGO_EMAIL_DIA_CUENTA_PROPIA
    : (RANGOS_LIMITES[grupo] as Record<string, readonly [number, number]>)[campo];
}

type Grupo = keyof LimitesEnvio;
type Campo<G extends Grupo> = keyof LimitesEnvio[G] & string;

/** Los campos, en el orden en que se dibujan y se validan. Una sola lista: la recorren todos. */
export const CAMPOS_LIMITES: ReadonlyArray<{ grupo: Grupo; campo: string }> = [
  { grupo: 'wa', campo: 'dia' }, { grupo: 'wa', campo: 'hora' }, { grupo: 'wa', campo: 'personaHoras' },
  { grupo: 'wa', campo: 'arranqueDia' }, { grupo: 'wa', campo: 'arranqueSube' },
  { grupo: 'email', campo: 'dia' }, { grupo: 'email', campo: 'personaHoras' },
  { grupo: 'email', campo: 'arranqueDia' }, { grupo: 'email', campo: 'arranqueSube' },
  { grupo: 'mako', campo: 'solasPor24h' }, { grupo: 'mako', campo: 'diasCharla' },
];

/** El nombre de cada campo en un mensaje de error (no en la pantalla: ahí va el rótulo corto). */
const NOMBRE: Record<string, string> = {
  'wa.dia': 'WhatsApp por día', 'wa.hora': 'WhatsApp por hora', 'wa.personaHoras': 'WhatsApp a la misma persona',
  'wa.arranqueDia': 'WhatsApp el primer día', 'wa.arranqueSube': 'WhatsApp, cuánto sube por día',
  'email.dia': 'Email por día', 'email.personaHoras': 'Email a la misma persona',
  'email.arranqueDia': 'Email el primer día', 'email.arranqueSube': 'Email, cuánto sube por día',
  'mako.solasPor24h': 'Respuestas solas por persona', 'mako.diasCharla': 'Días de charla abierta',
};

const rango = (g: Grupo, c: string, o?: OpcionesRango): readonly [number, number] =>
  rangoDeLimite(g, c, o);
const valor = (l: LimitesEnvio, g: Grupo, c: string): number => (l[g] as Record<string, number>)[c];
const enRango = (n: unknown, g: Grupo, c: string, o?: OpcionesRango): n is number => {
  const [min, max] = rango(g, c, o);
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
};

/**
 * Lo de fábrica de ESTE servidor: el env si está puesto (los tres que el motor ya leía), si no la
 * constante. Un env que no es un entero positivo se ignora (antes daba `NaN` y el tope dejaba de frenar).
 *
 * ⚠️ UN ENV FUERA DEL RANGO DE LA PANTALLA SE RESPETA IGUAL: es «lo de hoy», y la pantalla lo muestra como
 * el de fábrica. Lo que se le pide al rango es lo que ELIGE un negocio, no lo que puso la plataforma.
 */
export function limitesDeFabrica(env: Record<string, string | undefined> = {}): LimitesEnvio {
  const deEnv = (k: string, def: number): number => {
    const v = env[k];
    if (v == null || !String(v).trim()) return def;
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : def;
  };
  const c = LIMITES_CONSTANTES;
  return {
    wa: { dia: deEnv('NUTRICION_MAX_POR_DIA', c.wa.dia), hora: deEnv('NUTRICION_MAX_POR_CORRIDA', c.wa.hora), personaHoras: c.wa.personaHoras, arranqueDia: c.wa.arranqueDia, arranqueSube: c.wa.arranqueSube },
    email: { dia: deEnv('NUTRICION_MAX_EMAIL_POR_DIA', c.email.dia), personaHoras: c.email.personaHoras, arranqueDia: c.email.arranqueDia, arranqueSube: c.email.arranqueSube },
    mako: { ...c.mako },
  };
}

/** Lo guardado, parcial: sólo los campos que se entienden y están en rango. Lo demás, ausente. */
export type LimitesGuardados = { [G in Grupo]?: Partial<LimitesEnvio[G]> };

/**
 * Lo guardado, saneado. Un campo que no se entiende o está fuera de rango queda AUSENTE (= el de fábrica).
 *
 * ⚠️ ESO NO ES «RECORTAR EN SILENCIO»: lo que se guarda pasa por `limitesParaGuardar`, que sólo escribe lo
 * que este mismo módulo entiende. Una fila rota (escrita por otro camino) cae a lo de fábrica, que es el
 * comportamiento de antes de esta pantalla. Lo que no se puede LEER (la base caída) no llega acá: el motor
 * no manda (`saltado: 'limites-ilegibles'`, lib/nutricion.ts).
 */
export function sanearLimites(raw: unknown, cuenta?: OpcionesRango): LimitesGuardados {
  let v: unknown = raw;
  if (typeof v === 'string') {
    if (!v.trim()) return {};
    try { v = JSON.parse(v); } catch { return {}; }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const out: LimitesGuardados = {};
  for (const { grupo, campo } of CAMPOS_LIMITES) {
    const g = o[grupo];
    if (!g || typeof g !== 'object' || Array.isArray(g)) continue;
    const n = (g as Record<string, unknown>)[campo];
    // El email por día de una cuenta propia (hasta 2.000) leído SIN ella (#93): el máximo de la plataforma, no lo de
    // fábrica. «No pude leer la cuenta» no le baja el tope a 100 a quien manda 1.600: manda 500, menos y nunca más.
    if (grupo === 'email' && campo === 'dia' && !enRango(n, grupo, campo, cuenta) && enRango(n, grupo, campo, { cuentaPropia: true })) {
      (out.email ??= {}).dia = rango('email', 'dia')[1];
      continue;
    }
    if (!enRango(n, grupo, campo, cuenta)) continue;
    (out[grupo] ??= {} as never);
    (out[grupo] as Record<string, number>)[campo] = n;
  }
  return out;
}

/**
 * Los límites que mandan: lo guardado encima de lo de fábrica, campo por campo. `o`: con qué cuenta manda el negocio
 * (`opcionesDeRango`, lib/limites-envio-cuenta.ts); sin decirlo, la de la plataforma.
 */
export function limitesVigentes(raw: unknown, fabrica: LimitesEnvio = LIMITES_CONSTANTES, o?: OpcionesRango): LimitesEnvio {
  const g = sanearLimites(raw, o);
  return {
    wa: { ...fabrica.wa, ...(g.wa ?? {}) },
    email: { ...fabrica.email, ...(g.email ?? {}) },
    mako: { ...fabrica.mako, ...(g.mako ?? {}) },
  };
}

/**
 * Lo que se escribe en la base, o el motivo por el que no. Recibe los límites COMPLETOS que muestra la
 * pantalla y guarda sólo lo que difiere de lo de fábrica (`{}` = todo de fábrica: es «Restaurar»).
 *
 * Fuera de rango, no entero o ausente → error con el nombre del campo y su rango. Nunca se recorta.
 */
export function limitesParaGuardar(input: unknown, fabrica: LimitesEnvio, cuenta?: OpcionesRango): { ok: true; valor: string } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'No entendí los límites.' };
  const o = input as Record<string, unknown>;
  const out: LimitesGuardados = {};
  for (const { grupo, campo } of CAMPOS_LIMITES) {
    const g = o[grupo];
    const n = g && typeof g === 'object' ? (g as Record<string, unknown>)[campo] : undefined;
    // Lo de fábrica no se valida contra el rango: puede venir de un env fuera de él (`limitesDeFabrica`
    // lo respeta a propósito) y la pantalla lo muestra tal cual. Validarlo trababa CUALQUIER guardado con
    // «entre 1 y 150» sobre un número que la persona no tocó (revisión de la décima tanda, 11/10/2026).
    if (n === valor(fabrica, grupo, campo)) continue;
    if (!enRango(n, grupo, campo, cuenta)) {
      const [min, max] = rango(grupo, campo, cuenta);
      return { ok: false, error: `${NOMBRE[`${grupo}.${campo}`]}: entre ${min} y ${max}.` };
    }
    (out[grupo] ??= {} as never);
    (out[grupo] as Record<string, number>)[campo] = n;
  }
  return { ok: true, valor: JSON.stringify(out) };
}

/** ¿Algún campo difiere de lo de fábrica? Decide si se ofrece «Restaurar». */
export function difiereDeFabrica(l: LimitesEnvio, fabrica: LimitesEnvio): boolean {
  return CAMPOS_LIMITES.some(({ grupo, campo }) => valor(l, grupo, campo) !== valor(fabrica, grupo, campo));
}

/** Un campo, leído por su grupo y nombre (la pantalla recorre `CAMPOS_LIMITES`). */
export function leerLimite(l: LimitesEnvio, grupo: Grupo, campo: string): number {
  return valor(l, grupo, campo);
}

/** Lo mismo, devolviendo una copia con el campo cambiado. No valida: eso es de `limitesParaGuardar`. */
export function conLimite<G extends Grupo>(l: LimitesEnvio, grupo: G, campo: Campo<G> | string, n: number): LimitesEnvio {
  return { ...l, [grupo]: { ...l[grupo], [campo]: n } } as LimitesEnvio;
}

/** El rango de un campo, para las flechas y el `min`/`max` del número. */
export function rangoDe(grupo: Grupo, campo: string): readonly [number, number] {
  return rango(grupo, campo);
}

// ── La pantalla (Automations › Configuraciones › Límites) ─────────────────────────────────────
// Acá y no en el panel: el panel importa las acciones (`server-only`) y el test no lo puede importar.

/** Lo que ya salió en la ventana de cada tope (`usoDelCupo`, lib/nutricion.ts). */
export type UsoDelCupo = { waDia: number; waHora: number; emailDia: number };

/**
 * Un límite en la pantalla: su rótulo corto, la unidad al lado del número y su frase (`ayuda`, la de los mensajes). `info`
 * (22/10/2026) es el ⓘ de la fila, SÓLO donde el rótulo no alcanza: el resto de la frase no se dibuja (Martín: «Elimina
 * todo el texto innecesario»).
 */
export type FilaLimite = { grupo: Grupo; campo: string; rotulo: string; unidad: string; ayuda: string; info?: string };

/** Los tres bloques, en el orden en que se dibujan. Los rótulos, de 1 a 3 palabras (AGENTS.md). */
export const BLOQUES_LIMITES: ReadonlyArray<{ titulo: string; filas: FilaLimite[] }> = [
  {
    titulo: 'WhatsApp',
    filas: [
      { grupo: 'wa', campo: 'dia', rotulo: 'Por día', unidad: 'mensajes', ayuda: 'Mensajes por día, en 24 h' },
      { grupo: 'wa', campo: 'hora', rotulo: 'Por hora', unidad: 'mensajes', ayuda: 'Mensajes por hora de reloj' },
      { grupo: 'wa', campo: 'personaHoras', rotulo: 'Misma persona', unidad: 'h', ayuda: 'Horas entre dos mensajes a la misma persona' },
      { grupo: 'wa', campo: 'arranqueDia', rotulo: 'Primer día', unidad: 'mensajes', ayuda: 'Mensajes el primer día de la rampa' },
      { grupo: 'wa', campo: 'arranqueSube', rotulo: 'Sube por día', unidad: 'mensajes', ayuda: 'Cuánto sube cada día que llega a su tope' },
    ],
  },
  {
    titulo: 'Email',
    filas: [
      { grupo: 'email', campo: 'dia', rotulo: 'Por día', unidad: 'emails', ayuda: 'Emails por día, en 24 h' },
      { grupo: 'email', campo: 'personaHoras', rotulo: 'Misma persona', unidad: 'h', ayuda: 'Horas entre dos emails a la misma persona' },
      { grupo: 'email', campo: 'arranqueDia', rotulo: 'Primer día', unidad: 'emails', ayuda: 'Emails el primer día de la rampa' },
      { grupo: 'email', campo: 'arranqueSube', rotulo: 'Sube por día', unidad: 'emails', ayuda: 'Cuánto sube cada día que llega a su tope' },
    ],
  },
  {
    titulo: 'MaKo contesta sola',
    filas: [
      { grupo: 'mako', campo: 'solasPor24h', rotulo: 'Por persona', unidad: 'en 24 h', ayuda: 'Respuestas solas por persona en 24 h (0 = siempre borrador)', info: 'Respuestas que MaKo manda sola a una persona en 24 h. Con 0, siempre deja un borrador.' },
      { grupo: 'mako', campo: 'diasCharla', rotulo: 'Charla abierta', unidad: 'días', ayuda: 'Días que la charla sigue abierta', info: 'Días que la charla sigue abierta después del último mensaje.' },
    ],
  },
];

/**
 * LAS FILAS DE LA LÍNEA EN LA PANTALLA DE CONFIGURACIONES (23/10/2026, Martín por el Cerebro: «Hay DOS "Misma persona": queda
 * UNA. Ordená los ajustes en bloques por canal»). Van en el bloque de su canal, debajo de lo de la automatización, rotuladas
 * «Línea …» (son de TODAS las automatizaciones juntas). SIN «Misma persona»: queda la de la automatización, que sin lo suyo
 * usa la del negocio (lib/config-automatizacion.ts). «MaKo contesta sola» es su propio bloque.
 */
export const INFO_LINEA = 'Para todas tus automatizaciones juntas: es lo que cuida a tu número de un bloqueo. No se apaga.';
export const FILAS_LINEA: ReadonlyArray<FilaLimite> = BLOQUES_LIMITES.flatMap((b) => b.filas)
  // Las rampas (la del email, 4/11/2026, y la de WhatsApp, 5/11/2026) se cambian por la API de MaKo (`cambiar_limites_envio`), no en esta pantalla.
  .filter((f) => f.campo !== 'personaHoras' && f.campo !== 'arranqueDia' && f.campo !== 'arranqueSube')
  .map((f) => (f.grupo === 'mako' ? f : { ...f, rotulo: f.campo === 'hora' ? 'Línea por hora' : 'Línea por día', info: f.campo === 'dia' ? INFO_LINEA : f.info }));

/** La línea de uso de un bloque, o null (sin uso leído, o un bloque sin tope que contar). */
export function lineaDeUso(titulo: string, uso: UsoDelCupo | null, l: LimitesEnvio): string | null {
  if (!uso) return null;
  if (titulo === 'WhatsApp') return `24 h: ${uso.waDia} de ${l.wa.dia} · Esta hora: ${uso.waHora} de ${l.wa.hora}`;
  if (titulo === 'Email') return `24 h: ${uso.emailDia} de ${l.email.dia}`;
  return null;
}

/** El número escrito, o el motivo por el que no vale. Entero y en su rango; nunca se recorta. */
export function leerNumero(texto: string, min: number, max: number): { ok: true; n: number } | { ok: false; error: string } {
  const t = texto.trim();
  const n = Number(t);
  if (!t || !Number.isInteger(n) || n < min || n > max) return { ok: false, error: `Entre ${min} y ${max}.` };
  return { ok: true, n };
}
