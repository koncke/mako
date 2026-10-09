// =============================================================================
// EL CRON DE UN MENSAJE: cada cuánto sale, y cuándo es la próxima vez
// =============================================================================
// Pedido textual (30/09/2026): «El cron debería ser uno de dos... O el usuario lo
// configura para que salga en TIEMPO... 1 vez a la semana, al mes, al año,
// diariamente... Cada X horas... O lo configura que se dispare mediante una
// ACCIÓN. Y no deben poder editarse los 2 al mismo tiempo».
//
// La mitad ACCIÓN ya existía: son los cinco `EVENTOS` de `lib/flujos-tipos.ts`,
// cada uno con su choke point cableado. Esta mitad —el TIEMPO— no existía para
// nadie: los tres reportes que salen por expresión de cron resuelven al workspace
// del dueño y ninguna pantalla podía agendar nada.
//
// ── POR QUÉ NO SE REUSA LA RRULE DEL TABLERO ─────────────────────────────────
// `lib/plan-recurrentes.ts` ya tiene un vocabulario de recurrencia, y la tentación
// de importarlo es fuerte. No se puede, y el motivo está medido: su `Freq` es
// CERRADO en `DAILY | WEEKLY | MONTHLY | YEARLY`, `leerRRule('FREQ=HOURLY')`
// devuelve `null` y hay un test que lo blinda (`tests/plan-recurrencia.test.ts`).
// O sea que «cada X horas» —la mitad del pedido— exigiría ampliar un tipo
// compartido que importan quince archivos del board del plan, y con eso el alta de
// una tarea empezaría a aceptar recurrencias horarias que nadie pidió.
//
// Son dos preguntas distintas sobre dos objetos distintos: allá es «cada cuánto se
// repite esta TAREA» (con «el segundo martes» y «el día 15», que acá no hace falta
// nadie), y acá es «a qué hora sale este MENSAJE». Un vocabulario propio y chico es
// más barato que ampliar el ajeno, y no le cambia el comportamiento a otra feature.
//
// ── LA PRÓXIMA OCURRENCIA SE ANCLA EN LA ANTERIOR, NUNCA EN `now()` ─────────
// Es la trampa que este repo ya pagó con las insistencias: `proximaSalida` es
// `desde + cadaMin` con `desde = ahora`, así que un mensaje de los lunes a las 9
// que sale 9:07 agenda el lunes siguiente 9:07, después 9:14, y una semana sin tick
// corre el horario para siempre. Se llama deriva y no da error: manda en el horario
// equivocado, que es el modo de falla que nadie reporta porque no se nota.
//
// Acá `proximaOcurrencia` recibe la ocurrencia AGENDADA anterior y calcula desde
// ahí. Y avanza hasta pasar `ahora` **saltándose las perdidas**: si el cron estuvo
// caído un día, un «cada 2 horas» tiene que mandar UNO, no doce.

/** La unidad del intervalo. Es el vocabulario del pedido, literal. */
export type UnidadCron = 'hora' | 'dia' | 'semana' | 'mes' | 'anio';

export const UNIDADES: Array<{ key: UnidadCron; label: string; plural: string }> = [
  { key: 'hora', label: 'hora', plural: 'horas' },
  { key: 'dia', label: 'día', plural: 'días' },
  { key: 'semana', label: 'semana', plural: 'semanas' },
  { key: 'mes', label: 'mes', plural: 'meses' },
  { key: 'anio', label: 'año', plural: 'años' },
];

/** El tope del intervalo. Existe para que un `cada: 999999` no agende en el año 3000. */
export const CADA_MAX = 99;

/**
 * Cuándo sale un mensaje.
 *
 * `hora` y `minuto` son la hora de PARED del negocio, no UTC: «a las 9» tiene que
 * ser a las 9 para quien lo lee. La zona con la que se resolvió viaja aparte (ver
 * `lib/avisos-programados.ts`), porque es un dato del agendado y no del horario.
 *
 * `diaSemana` (0 = domingo) sólo se usa con `unidad: 'semana'`; `diaMes` con `mes`
 * y `anio`; `mes` sólo con `anio`. Los de más se ignoran al sanear en vez de
 * rechazar el objeto: un cambio de unidad en la pantalla no puede tirar el resto.
 */
export type CronAviso = {
  unidad: UnidadCron;
  cada: number;
  hora: number;
  minuto: number;
  diaSemana?: number;
  /**
   * VARIOS días de la semana (sexta tanda del Chatbot, 09/10/2026, CRON punto 9: «no puedo poner
   * más de 1 día a la semana, martes y jueves por ejemplo»). 0 = domingo, en el orden de la semana
   * que arranca el LUNES (`ordenarDias`). Sólo con `unidad: 'semana'` y sólo con DOS o más: con uno
   * no se escribe y `diaSemana` dice cuál, así que un horario de antes (o de /mensajes, que no
   * ofrece varios) se sanea idéntico. Cuando está, `diaSemana` es el primero.
   */
  dias?: number[];
  diaMes?: number;
  /**
   * «El segundo martes» en vez de «el día 10» (el bloque del mes del diálogo de Google Calendar que
   * copia el Plan, `RepeticionModal` de app/plan/board/AccionesLote.tsx). 1 a 4, o -1 = el último;
   * va con `diaSemana`. Sólo con `unidad: 'mes'`. Ausente = `diaMes`, como siempre.
   */
  ordinal?: number;
  mes?: number;
  /**
   * Desde qué día sale (YYYY-MM-DD, en la zona del horario): antes no sale nada. Es la «fecha de
   * inicio» con calendario del pedido (CRON punto 9). Ausente = desde ya.
   */
  desde?: string;
  /**
   * La zona del horario (IANA), cuando la persona la eligió (CRON punto 9: «por defecto, siempre
   * dejalo en el huso del usuario, pero que se pueda editar»). Ausente = la del negocio, que es lo
   * que pasa quien llama. MANDA sobre la que llega por parámetro (`proximaOcurrencia`).
   */
  tz?: string;
};

/** Los días en el orden de una semana que arranca el LUNES (como el diálogo del Plan). */
const ordenSemana = (d: number): number => (d + 6) % 7;
const ordenarDias = (ds: number[]): number[] => [...new Set(ds)].sort((a, b) => ordenSemana(a) - ordenSemana(b));

/** ¿Es una zona que este motor de fechas conoce? Sin `server-only` (lib/timezone lo tiene). */
export function zonaValida(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz.trim() || tz.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** 'YYYY-MM-DD' que existe en el calendario. */
const fechaValida = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
};

/** La zona con la que se calcula un horario: la suya si la eligió, si no la del negocio. */
export const zonaDelCron = (c: Pick<CronAviso, 'tz'> | null | undefined, porDefecto: string): string =>
  (c?.tz && zonaValida(c.tz) ? c.tz : porDefecto);

const enteroEn = (v: unknown, min: number, max: number, def: number): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
};

/**
 * ⚠️ EL DÍA DEL MES SE TOPEA EN 28, y no es pereza. Un «el 31 de cada mes» no
 * existe en febrero, y las dos salidas posibles —saltear el mes o correrlo al 1 de
 * marzo— son decisiones de producto que nadie tomó. 28 sale todos los meses, y el
 * día que alguien pida «el último día del mes» eso es otro campo, no este número
 * estirado.
 */
export const DIA_MES_MAX = 28;

export function sanearCron(v: unknown): CronAviso | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const unidad = UNIDADES.find((u) => u.key === o.unidad)?.key;
  if (!unidad) return null;
  const out: CronAviso = {
    unidad,
    cada: enteroEn(o.cada, 1, CADA_MAX, 1),
    hora: enteroEn(o.hora, 0, 23, 9),
    minuto: enteroEn(o.minuto, 0, 59, 0),
  };
  if (unidad === 'semana') {
    // VARIOS días: los que se entienden, sin repetir y en el orden de la semana. Con UNO solo no se
    // escribe la lista (el horario queda igual que uno de antes); sin ninguno válido, `diaSemana`.
    const dias = Array.isArray(o.dias)
      ? ordenarDias((o.dias as unknown[]).map((x) => Math.floor(Number(x))).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))
      : [];
    out.diaSemana = dias.length ? dias[0] : enteroEn(o.diaSemana, 0, 6, 1);
    if (dias.length > 1) out.dias = dias;
  }
  // «El segundo martes» (sólo el mes): con un ordinal que se entiende, va con su día de la semana y
  // sin `diaMes`; si no, el día del mes de siempre.
  const ordinal = Math.floor(Number(o.ordinal));
  if (unidad === 'mes' && o.ordinal != null && (ordinal === -1 || (ordinal >= 1 && ordinal <= 4))) {
    out.ordinal = ordinal;
    out.diaSemana = enteroEn(o.diaSemana, 0, 6, 1);
  } else if (unidad === 'mes' || unidad === 'anio') out.diaMes = enteroEn(o.diaMes, 1, DIA_MES_MAX, 1);
  if (unidad === 'anio') out.mes = enteroEn(o.mes, 1, 12, 1);
  // La fecha de inicio y la zona: sólo si se entienden. Una zona inventada no tira el horario: se
  // cae a la del negocio, que es lo que pasaría sin el campo.
  if (fechaValida(o.desde)) out.desde = o.desde;
  if (zonaValida(o.tz)) out.tz = o.tz;
  return out;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const hhmm = (h: number, m: number): string => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/**
 * Una frase corta y EXACTA, con la zona adentro cuando se la pasan.
 *
 * ⚠️ La zona va en el texto a propósito. Medido el 30/09/2026: de los 10 workspaces
 * activos, SEIS no tienen `mako.timezone` y caen a `America/Tijuana`; si la
 * averiguación falla, la hora local cae a 12. Decir «a la mañana» sobre eso es
 * afirmar algo que no se verificó — decir «9:00 de America/Tijuana» deja que el
 * dueño lo vea y lo corrija.
 */
export function textoCron(c: CronAviso, tz?: string | null): string {
  const hora = hhmm(c.hora, c.minuto);
  const n = c.cada;
  const u = UNIDADES.find((x) => x.key === c.unidad)!;
  const cada = n === 1 ? '' : ` ${n} ${u.plural}`;
  let base: string;
  if (c.unidad === 'hora') base = n === 1 ? 'Cada hora' : `Cada${cada}`;
  else if (c.unidad === 'dia') base = n === 1 ? `Todos los días a las ${hora}` : `Cada${cada} a las ${hora}`;
  // VARIOS días: «Todos los martes y jueves». Con uno, la frase de siempre (los horarios de antes
  // y los de /mensajes se leen igual que ayer).
  else if (c.unidad === 'semana' && (c.dias?.length ?? 0) > 1) base = `${n === 1 ? 'Todos los' : `Cada${cada}, los`} ${enumerar(c.dias!.map((d) => DIAS_PLURAL[d]))} a las ${hora}`;
  else if (c.unidad === 'semana') base = `${n === 1 ? 'Todos los' : `Cada${cada}, el`} ${DIAS[c.diaSemana ?? 1]} a las ${hora}`;
  else if (c.unidad === 'mes' && c.ordinal != null) base = `${n === 1 ? 'El' : `Cada${cada}, el`} ${ORDINAL_TXT[String(c.ordinal)] ?? 'primer'} ${DIAS[c.diaSemana ?? 1]}${n === 1 ? ' de cada mes' : ''} a las ${hora}`;
  else if (c.unidad === 'mes') base = `${n === 1 ? 'El' : `Cada${cada}, el`} ${c.diaMes ?? 1} a las ${hora}`;
  else base = `${n === 1 ? 'El' : `Cada${cada}, el`} ${c.diaMes ?? 1} de ${MESES[(c.mes ?? 1) - 1]} a las ${hora}`;
  // La zona que se NOMBRA es la que se usa: la del horario si la eligió, si no la que pasa quien llama.
  const zona = c.tz && zonaValida(c.tz) ? c.tz : tz;
  // «Cada hora» no lleva hora de pared: la hora de pared no la decide nadie ahí.
  return c.unidad === 'hora' || !zona ? base : `${base} de ${zona}`;
}

const DIAS_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
const ORDINAL_TXT: Record<string, string> = { '1': 'primer', '2': 'segundo', '3': 'tercer', '4': 'cuarto', '-1': 'último' };
const enumerar = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

// ── HORA DE PARED ↔ INSTANTE ────────────────────────────────────────────────
// No hay librería de fechas en el repo (medido: ni luxon, ni date-fns, ni
// cron-parser en package.json) y no se agrega una por esto. `Intl` alcanza, con la
// salvedad de abajo.

type Partes = { y: number; m: number; d: number; h: number; min: number; dow: number };

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Las partes de la hora LOCAL de `tz` para un instante. */
export function partesEn(tz: string, d: Date): Partes {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  // El `% 24` es DEFENSIVO y no se pudo medir: el ICU de este Node ya devuelve «00».
  // Se deja porque `hour12: false` devuelve «24» en otros ICU y ahí la medianoche se
  // leería como el final del día anterior — pero no lo vi pasar, así que no se afirma.
  const h = Number(p.hour) % 24;
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h, min: Number(p.minute), dow: DOW[p.weekday] ?? 0 };
}

/**
 * El instante UTC de una hora de PARED en `tz`.
 *
 * ⚠️ HACEN FALTA DOS PASADAS, y está MEDIDO. La primera estima el desvío leyendo de
 * vuelta un candidato; la segunda lo corrige, porque el desvío puede cambiar justo en
 * el salto de horario de verano. Barrido de fuerza bruta sobre 11 zonas × 366 días ×
 * 7 horas: **49 casos de 28.182 difieren**, y uno es `America/Tijuana` el 8/3 a las
 * 9:00 — o sea la zona POR DEFECTO de este repo y la hora típica de un aviso diario.
 * Con una sola pasada, ese día el mensaje sale a las 10 y no da ningún error.
 *
 * (La primera versión del test probaba el 15/7 y el 15/12, lejos del salto, donde una
 * sola pasada también acierta: daba VERDE sobre el bug.)
 */
export function instanteDe(tz: string, y: number, m: number, d: number, h: number, min: number): Date {
  const pedido = Date.UTC(y, m - 1, d, h, min);
  let t = pedido;
  for (let i = 0; i < 2; i++) {
    const p = partesEn(tz, new Date(t));
    const leido = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    t = t - (leido - pedido);
  }
  return new Date(t);
}

/** Un día del mes que exista en ese mes (para el tope de 28 nunca recorta). */
const diaValido = (y: number, m: number, d: number): number =>
  Math.min(d, new Date(Date.UTC(y, m, 0)).getUTCDate());

/**
 * La PRÓXIMA vez que sale, estrictamente después de `ahora`.
 *
 * `anterior` es la ocurrencia AGENDADA anterior (no la que efectivamente salió, ni
 * `now()`): es lo que impide la deriva. Si nunca salió, se le pasa el momento en
 * que se agendó.
 *
 * ⚠️ AVANZA SALTÁNDOSE LAS PERDIDAS. Con el cron caído un día, un «cada 2 horas»
 * tiene que mandar UNO y seguir en su grilla — no doce de golpe. El tope de 5000
 * vueltas es un backstop: con `cada: 99` años y un `anterior` de 1970 el bucle
 * igual termina.
 */
export function proximaOcurrencia(c: CronAviso, anteriorPedido: Date, tzPedida: string, ahora: Date = new Date()): Date {
  // ⚠️ LA ZONA DEL HORARIO MANDA SOBRE LA QUE LLEGA (CRON punto 9: el huso se elige). Va acá y no en
  // cada caller: son cinco (el motor, el dry-run, el guardado, los avisos programados, la pantalla) y
  // uno que se olvide calcularía en otra zona sin un error.
  const tz = zonaDelCron(c, tzPedida);
  // ⚠️ LA FECHA DE INICIO ES UN PISO, Y LA GRILLA ARRANCA AHÍ. Con un ancla anterior al inicio
  // (un horario recién guardado, sembrado con `ahora`), se ancla en el INICIO: «cada 2 días desde el
  // jueves» tiene que salir el jueves, no el viernes por haber contado desde hoy.
  const piso = c.desde ? instanteDe(tz, ...(c.desde.split('-').map(Number) as [number, number, number]), 0, 0) : null;
  const antesDelPiso = piso != null && anteriorPedido.getTime() < piso.getTime();
  // El «un milisegundo antes» hace que la primera del día de inicio valga (`vale` exige DESPUÉS del ancla).
  const anterior = antesDelPiso ? new Date(piso!.getTime() - 1) : anteriorPedido;
  const vale = (t: number): boolean => t > ahora.getTime() && t > anterior.getTime();

  if (c.unidad === 'hora') {
    const paso = c.cada * 3_600_000;
    // Con piso, la grilla de las horas arranca en el inicio (el primero sale ahí mismo).
    const base = antesDelPiso ? piso!.getTime() - paso : anterior.getTime();
    let t = base + paso;
    if (t <= ahora.getTime()) {
      // Se salta a la ocurrencia de la grilla que viene después de ahora.
      const saltos = Math.ceil((ahora.getTime() - base) / paso);
      t = base + Math.max(1, saltos) * paso;
      if (t <= ahora.getTime()) t += paso;
    }
    return new Date(t);
  }

  const a = antesDelPiso ? partesEn(tz, piso!) : partesEn(tz, anterior);
  let y = a.y, m = a.m, d = a.d;

  // VARIOS DÍAS DE LA SEMANA (o uno, con su propio camino: el de abajo, que es el de siempre).
  if (c.unidad === 'semana' && (c.dias?.length ?? 0) > 1) return proximaSemanalVarios(c, tz, y, m, d, vale, ahora);

  for (let i = 0; i < 5000; i++) {
    if (c.unidad === 'dia') {
      const cand = instanteDe(tz, y, m, d, c.hora, c.minuto);
      if (vale(cand.getTime())) return cand;
      const sig = new Date(Date.UTC(y, m - 1, d + c.cada));
      y = sig.getUTCFullYear(); m = sig.getUTCMonth() + 1; d = sig.getUTCDate();
      continue;
    }
    if (c.unidad === 'semana') {
      // Dos movimientos, y en este orden: primero se PLANTA en el día de la semana
      // pedido, y desde ahí avanza de `cada` en `cada` semanas enteras. Hacerlo al
      // revés —sumar semanas y después buscar el día— corre la fecha una semana la
      // primera vez, y eso no se ve nunca en una prueba que arranca justo en el día.
      const p = partesEn(tz, instanteDe(tz, y, m, d, c.hora, c.minuto));
      const delta = ((c.diaSemana ?? 1) - p.dow + 7) % 7;
      if (delta) {
        const mov = new Date(Date.UTC(y, m - 1, d + delta));
        y = mov.getUTCFullYear(); m = mov.getUTCMonth() + 1; d = mov.getUTCDate();
        continue;   // vuelve a entrar ya parado en el día pedido
      }
      const cand = instanteDe(tz, y, m, d, c.hora, c.minuto);
      if (vale(cand.getTime())) return cand;
      const sig = new Date(Date.UTC(y, m - 1, d + 7 * c.cada));
      y = sig.getUTCFullYear(); m = sig.getUTCMonth() + 1; d = sig.getUTCDate();
      continue;
    }
    // mes y año. «El segundo martes» (`ordinal`) se busca en CADA mes: no es un número fijo.
    const mesObjetivo = c.unidad === 'anio' ? (c.mes ?? 1) : m;
    const dia = c.unidad === 'mes' && c.ordinal != null
      ? diaDelOrdinal(y, mesObjetivo, c.ordinal, c.diaSemana ?? 1)
      : diaValido(y, mesObjetivo, c.diaMes ?? 1);
    const cand = instanteDe(tz, y, mesObjetivo, dia, c.hora, c.minuto);
    if (vale(cand.getTime())) return cand;
    if (c.unidad === 'anio') { y += c.cada; continue; }
    const sig = new Date(Date.UTC(y, m - 1 + c.cada, 1));
    y = sig.getUTCFullYear(); m = sig.getUTCMonth() + 1; d = 1;
  }
  // Backstop: no puede pasar con los topes de arriba, y si pasa no se agenda nada
  // en el pasado — que es lo que dispararía un envío por tick para siempre.
  return new Date(ahora.getTime() + 86_400_000);
}

/** El día de la semana de una fecha de CALENDARIO (0 = domingo). No depende de ninguna zona. */
const dowDe = (y: number, m: number, d: number): number => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const diasDelMes = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** «El segundo martes» de un mes: 1 a 4, o -1 = el último. */
function diaDelOrdinal(y: number, m: number, ordinal: number, diaSemana: number): number {
  if (ordinal === -1) {
    const ultimo = diasDelMes(y, m);
    return ultimo - ((dowDe(y, m, ultimo) - diaSemana + 7) % 7);
  }
  return 1 + ((diaSemana - dowDe(y, m, 1) + 7) % 7) + (ordinal - 1) * 7;
}

/**
 * VARIOS DÍAS DE LA SEMANA, «cada N semanas» (CRON punto 9: martes y jueves). Es la generalización
 * del camino de un solo día, y con un solo día da LO MISMO (lo fija tests/cron-aviso-dias.test.ts):
 *
 *   1. se PLANTA en el primer día elegido desde el ancla (el de la semana en curso, si queda);
 *   2. las semanas que valen son las de esa planta y las de `cada` en `cada` después — semanas de
 *      CALENDARIO, de lunes a domingo, como el diálogo de Google Calendar que copia el Plan. Con
 *      semanas que arrancan en la planta, «cada 2 semanas, martes y jueves» desde un miércoles daba
 *      jueves y el martes CINCO días después, que no es lo que nadie eligió;
 *   3. se recorre día por día dentro de las semanas que valen.
 *
 * ⚠️ Y SALTA LO PERDIDO DE A CICLOS ENTEROS: con el cron caído un mes, recorrer día por día desde el
 * ancla vieja serviría igual (5000 vueltas), pero el salto deja la grilla en su lugar y no depende del
 * tope del bucle.
 */
function proximaSemanalVarios(
  c: CronAviso, tz: string, y0: number, m0: number, d0: number,
  vale: (t: number) => boolean, ahora: Date,
): Date {
  const dias = new Set(c.dias ?? [c.diaSemana ?? 1]);
  const DIA = 86_400_000;
  const fecha = (ms: number) => { const f = new Date(ms); return { y: f.getUTCFullYear(), m: f.getUTCMonth() + 1, d: f.getUTCDate() }; };
  // 1. La planta: el primer día elegido desde el ancla (incluido el día del ancla).
  let planta = Date.UTC(y0, m0 - 1, d0);
  for (let i = 0; i < 7 && !dias.has(new Date(planta).getUTCDay()); i++) planta += DIA;
  // 2. El lunes de la semana de la planta, y el largo de un ciclo.
  const lunes0 = planta - ordenSemana(new Date(planta).getUTCDay()) * DIA;
  const ciclo = 7 * c.cada * DIA;
  // Lo perdido se salta de a ciclos enteros, sin pasar de la planta.
  const a = partesEn(tz, ahora);
  const hoy = Date.UTC(a.y, a.m - 1, a.d);
  let desde = planta;
  if (hoy - DIA > planta) {
    const ciclos = Math.floor((hoy - DIA - lunes0) / ciclo);
    desde = Math.max(planta, lunes0 + ciclos * ciclo);
  }
  // 3. Día por día, sólo en las semanas que valen.
  for (let t = desde, i = 0; i < 5000; t += DIA, i++) {
    const semana = Math.floor((t - lunes0) / (7 * DIA));
    if (semana % c.cada !== 0 || !dias.has(new Date(t).getUTCDay())) continue;
    const f = fecha(t);
    const cand = instanteDe(tz, f.y, f.m, f.d, c.hora, c.minuto);
    if (vale(cand.getTime())) return cand;
  }
  return new Date(ahora.getTime() + DIA);
}

// ── QUÉ PUEDE SALIR POR TIEMPO ──────────────────────────────────────────────

export type MotivoNoAgendable = 'sin-texto' | 'ejemplo';

/**
 * ¿Este texto puede salir POR TIEMPO? `null` si sí; el motivo si no.
 *
 * ⚠️ POR TIEMPO SALE EL TEXTO TAL CUAL, y para un mensaje del catálogo que nadie
 * reescribió ese texto es el `ejemplo` — o sea DATOS DE MUESTRA, por definición del
 * campo. Un aviso de evento (un recordatorio, una cuota, un lead nuevo) arma su texto
 * real en el código, con el evento en la mano; el agendado no tiene ningún evento, así
 * que mandaba el molde. Medido el 06/10/2026: el grupo de Leila recibió cuatro días
 * seguidos, a las 9:00, «En 30 min tienes la R2 con…» y un lead real de OTRO cliente,
 * porque el ejemplo de `reunion-recordatorio` lo nombraba.
 *
 * Se compara contra el ejemplo de FÁBRICA y no contra «¿hay override?» a propósito: un
 * override idéntico al ejemplo sigue siendo el ejemplo, y lo que se pregunta es qué
 * texto sale, no quién lo tocó. Lo llaman las DOS puntas —el que agenda y el que
 * manda—, así que no pueden contestar distinto.
 *
 * Lo que esto NO caza: un texto propio que es la FOTO de un dato (un reporte con los
 * números de una semana vieja). Eso no se distingue mirando el texto; ver
 * docs/hallazgos-comunicacion.md.
 */
export function motivoNoAgendable(texto: string | null | undefined, ejemploDeFabrica?: string | null): MotivoNoAgendable | null {
  const t = (texto ?? '').trim();
  if (!t) return 'sin-texto';
  if (ejemploDeFabrica && t === ejemploDeFabrica.trim()) return 'ejemplo';
  return null;
}

/** Lo que lee quien intenta agendar. Corto: el porqué está arriba. */
export const TEXTO_NO_AGENDABLE: Record<MotivoNoAgendable, string> = {
  'sin-texto': 'Sin texto no se agenda.',
  ejemplo: 'El texto de ejemplo no se agenda: publica el tuyo.',
};
