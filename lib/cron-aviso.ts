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
  diaMes?: number;
  mes?: number;
};

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
  if (unidad === 'semana') out.diaSemana = enteroEn(o.diaSemana, 0, 6, 1);
  if (unidad === 'mes' || unidad === 'anio') out.diaMes = enteroEn(o.diaMes, 1, DIA_MES_MAX, 1);
  if (unidad === 'anio') out.mes = enteroEn(o.mes, 1, 12, 1);
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
  else if (c.unidad === 'semana') base = `${n === 1 ? 'Todos los' : `Cada${cada}, el`} ${DIAS[c.diaSemana ?? 1]} a las ${hora}`;
  else if (c.unidad === 'mes') base = `${n === 1 ? 'El' : `Cada${cada}, el`} ${c.diaMes ?? 1} a las ${hora}`;
  else base = `${n === 1 ? 'El' : `Cada${cada}, el`} ${c.diaMes ?? 1} de ${MESES[(c.mes ?? 1) - 1]} a las ${hora}`;
  // «Cada hora» no lleva hora de pared: la hora de pared no la decide nadie ahí.
  return c.unidad === 'hora' || !tz ? base : `${base} de ${tz}`;
}

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
export function proximaOcurrencia(c: CronAviso, anterior: Date, tz: string, ahora: Date = new Date()): Date {
  if (c.unidad === 'hora') {
    const paso = c.cada * 3_600_000;
    let t = anterior.getTime() + paso;
    if (t <= ahora.getTime()) {
      // Se salta a la ocurrencia de la grilla que viene después de ahora.
      const saltos = Math.ceil((ahora.getTime() - anterior.getTime()) / paso);
      t = anterior.getTime() + Math.max(1, saltos) * paso;
      if (t <= ahora.getTime()) t += paso;
    }
    return new Date(t);
  }

  const a = partesEn(tz, anterior);
  let y = a.y, m = a.m, d = a.d;

  for (let i = 0; i < 5000; i++) {
    if (c.unidad === 'dia') {
      const cand = instanteDe(tz, y, m, d, c.hora, c.minuto);
      if (cand.getTime() > ahora.getTime() && cand.getTime() > anterior.getTime()) return cand;
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
      if (cand.getTime() > ahora.getTime() && cand.getTime() > anterior.getTime()) return cand;
      const sig = new Date(Date.UTC(y, m - 1, d + 7 * c.cada));
      y = sig.getUTCFullYear(); m = sig.getUTCMonth() + 1; d = sig.getUTCDate();
      continue;
    }
    // mes y año
    const mesObjetivo = c.unidad === 'anio' ? (c.mes ?? 1) : m;
    const dia = diaValido(y, mesObjetivo, c.diaMes ?? 1);
    const cand = instanteDe(tz, y, mesObjetivo, dia, c.hora, c.minuto);
    if (cand.getTime() > ahora.getTime() && cand.getTime() > anterior.getTime()) return cand;
    if (c.unidad === 'anio') { y += c.cada; continue; }
    const sig = new Date(Date.UTC(y, m - 1 + c.cada, 1));
    y = sig.getUTCFullYear(); m = sig.getUTCMonth() + 1; d = 1;
  }
  // Backstop: no puede pasar con los topes de arriba, y si pasa no se agenda nada
  // en el pasado — que es lo que dispararía un envío por tick para siempre.
  return new Date(ahora.getTime() + 86_400_000);
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
