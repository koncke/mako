// =============================================================================
// dolar-blue-reglas — el precio en pesos de los planes, al dólar blue del día: la cuenta y los frenos (16/11/2026)
// =============================================================================
// Martín: «el checkout, si se cambia de Mercado Pago o tarjeta de crédito o débito, debería cambiar de pesos a dólares… Y
// obviamente eso, la automatización debería estar creada con la API de Mercado Pago para actualizar diariamente al dólar blue del
// día». Hasta hoy el precio en pesos de cada plan era un número fijo en el setting `planes.mako` (lo cargaba Martín a mano en
// Settings › Payments; medido el 16/11: $ 73.555 y $ 151.805, o sea US$47 y US$97 a 1.565). Esto lo pone al día solo, una vez por
// día (app/api/cron/dolar-blue, lib/dolar-blue.ts).
//
// ⚠️ MERCADO PAGO NO PUBLICA EL BLUE. Su API cobra en pesos pero no da cotizaciones del dólar paralelo (el blue no es una
//    cotización oficial: nadie que opere regulado la publica). Se lee de un servicio PÚBLICO de cotizaciones de Argentina:
//    dolarapi.com (`/v1/dolares/blue`, el valor de VENTA) y, si no contesta, bluelytics (`/v2/latest`, `blue.value_sell`). Los
//    dos son gratis y sin clave. El de venta es el que paga quien compra dólares: es el que dice cuántos pesos vale un dólar.
//
// LA CUENTA: pesos = dólares del plan × venta, redondeado HACIA ARRIBA al millar ($ 74.025 → $ 75.000). Es la regla de la casa para
// todo número que lee el cliente (el commit «Precios con números redondos», 15/11/2026, lib/mako-tokens-paquetes.ts): redondo para
// que se lea («no me gusta que sea un número que no sea redondo») y hacia arriba, para que el redondeo quede de nuestro lado. A un
// blue de ~1.500, el millar es menos del 1,5 % del plan más barato.
//
// LOS FRENOS (si salta uno, NO SE TOCA NADA y queda el aviso, que dice qué pasa mañana y cómo frenarlo):
//   1. La cotización no llegó, no es un número, o es vieja (más de `DIAS_VIEJA` días: el blue no cotiza los fines de semana, y un
//      lunes a la mañana la última es del viernes). Se leen los DOS servicios; vale la primera que esté al día.
//   2. Contestaron los dos y no coinciden dentro de un 3 % (`COINCIDEN`): no se sabe cuál es el blue de hoy, SEA CUAL SEA EL SALTO.
//      ⚠️ ANTES ESTO SE MIRABA SÓLO CON UN SALTO DE MÁS DEL 15 % (segunda revisión del 16/11/2026, hallazgo 1): con dolarapi 1.790 y
//      bluelytics 1.570 contra 1.565 (+14,4 %), se aplicaba el primero sin mirar el segundo, y sin aviso.
//   3. Salta más del 15 % (`SALTO_MAXIMO`) contra lo que dicen los PRECIOS EN VIGOR (`cotizacionDeLosPrecios`) y el otro servicio
//      no contestó para confirmarlo. Un salto así se aplica SOLO si los dos dicen lo mismo.
//      ⚠️ ERA «CONTRA LA DEL DÍA ANTERIOR» (primera revisión del 16/11/2026, hallazgo 1): la lectura frenada quedaba guardada como
//      «la de ayer» y al día siguiente el salto daba 0. Contra los precios en vigor, un dato roto salta igual el segundo día.
//   4. La red: nunca se aplica una cotización a más del doble o a menos de la mitad (`BANDA`) de la que dicen los precios en vigor,
//      aunque los dos servicios coincidan. Un servicio que se rompe y devuelve 15,75 en vez de 1.575 no baja los precios a la
//      centésima. Una devaluación así la decide Martín a mano, en Settings › Payments.
// LOS AVISOS DE UN CAMBIO QUE SÍ SE APLICÓ: todo cambio de más de un 5 % (`AVISAR_DESDE`), del blue o de un precio, y siempre uno
// grande (`seAvisaElCambio`). El día a día del blue se mueve menos que eso: no llena la casilla.
// UN PRECIO CAMBIADO A MANO NO SE PISA (segunda revisión, hallazgo 2): el estado guarda lo último que escribió el cron
// (`EstadoBlue.escritos`). Si un precio en pesos de hoy no es ése, alguien lo cambió en Settings › Payments: el cron no toca nada, se
// APAGA SOLO y avisa (`avisoDeAMano`). Antes, Pro puesto a mano en $ 140.000 volvía a $ 153.000 a las 18:05, sin aviso.
// EL FRENO DE EMERGENCIA: `{"apagada": true}` en el ajuste `CLAVE_ESTADO_BLUE` del negocio de la plataforma (`COMO_FRENARLO`): no lee
// ni escribe nada hasta que se saque. Es el mismo que usa el cron al apagarse solo. Settings › Payments lo dice (`CARTEL_DEL_BLUE`).
// Y lo que NO toca nunca: un link de pago ya emitido (el cobro guarda su monto; ver lib/dolar-blue.ts), un plan sin precio en pesos
// (sin pesos, ese plan no se ofrece por Mercado Pago: agregárselo sería prender Mercado Pago donde Martín no lo prendió) y
// cualquier otro campo del setting.
//
// Puro: sin red, sin base y sin reloj propio (todo entra por parámetro). Lo importa también un componente del cliente (el cartel):
// nada de `node:` acá. Lo prueba tests/dolar-blue.test.ts.
// =============================================================================

/** La moneda que se actualiza: el precio local de la Mercado Pago de MaKo (su cuenta es argentina: cobra en ARS). */
export const MONEDA_PESOS = 'ARS';
/** El salto máximo contra los precios en vigor que se aplica con un solo servicio. Más que esto, sólo si los dos coinciden. */
export const SALTO_MAXIMO = 0.15;
/** Cuánto pueden diferir dolarapi.com y bluelytics cuando contestan los dos. Más que esto, no se toca nada. */
export const COINCIDEN = 0.03;
/** Desde cuánto se avisa un cambio que se aplicó (del blue contra los precios en vigor, o de un precio). */
export const AVISAR_DESDE = 0.05;
/** La red: ni más del doble ni menos de la mitad de la cotización que dicen los precios en vigor. */
export const BANDA = 2;
/** Más vieja que esto, la cotización no se usa (el blue no cotiza sábados ni domingos; feriados largos: cinco días). */
export const DIAS_VIEJA = 5;
/** El millar: el redondeo de un precio en pesos. */
export const REDONDEO_PESOS = 1000;
/** Lo razonable para un dólar en pesos: lo que está afuera es un error del servicio, no una cotización. */
const PISO = 50, TECHO = 1_000_000;

/** La clave del estado de la automatización (en el negocio de la plataforma, junto a `planes.mako`). */
export const CLAVE_ESTADO_BLUE = 'planes.dolar_blue';
/**
 * Donde se cambian a mano los precios en pesos: Settings › Payments (app/admin/_polar/web/Settings/OrganizationPaymentSettings.tsx).
 * ⚠️ NO /admin/cobros: es un redirect a Sales desde el 6/11/2026, y los avisos mandaban ahí.
 */
export const RUTA_DE_LOS_PRECIOS = '/admin/settings/payments';
const DONDE_SE_CAMBIAN = `Settings › Payments (${RUTA_DE_LOS_PRECIOS})`;

export type Cotizacion = { venta: number; compra: number | null; fecha: string; fuente: string };

/** Los servicios que se consultan, en orden: el primero que contesta bien, gana. */
export const FUENTES_BLUE: ReadonlyArray<{ nombre: string; url: string; leer: (json: unknown) => Omit<Cotizacion, 'fuente'> | null }> = [
  { nombre: 'dolarapi.com', url: 'https://dolarapi.com/v1/dolares/blue', leer: (j) => leerDolarApi(j) },
  { nombre: 'bluelytics.com.ar', url: 'https://api.bluelytics.com.ar/v2/latest', leer: (j) => leerBluelytics(j) },
];

const numero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= PISO && n <= TECHO ? n : null;
};
const fechaIso = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** dolarapi.com: `{ moneda: "USD", casa: "blue", compra, venta, fechaActualizacion }`. */
export function leerDolarApi(json: unknown): Omit<Cotizacion, 'fuente'> | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (o.casa !== undefined && o.casa !== 'blue') return null;
  const venta = numero(o.venta);
  const fecha = fechaIso(o.fechaActualizacion);
  if (venta == null || !fecha) return null;
  const compra = numero(o.compra);
  // Una compra MAYOR que la venta es un dato roto (el que te compra un dólar no te paga más de lo que te lo vende).
  if (compra != null && compra > venta) return null;
  return { venta, compra, fecha };
}

/** bluelytics: `{ blue: { value_buy, value_sell, value_avg }, last_update }`. */
export function leerBluelytics(json: unknown): Omit<Cotizacion, 'fuente'> | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const blue = o.blue as Record<string, unknown> | undefined;
  if (!blue || typeof blue !== 'object') return null;
  const venta = numero(blue.value_sell);
  const fecha = fechaIso(o.last_update);
  if (venta == null || !fecha) return null;
  const compra = numero(blue.value_buy);
  if (compra != null && compra > venta) return null;
  return { venta, compra, fecha };
}

/** El precio en pesos de un plan: sus dólares a la venta del blue, redondeado HACIA ARRIBA al millar. */
export function pesosDelPlan(precioUsd: number, venta: number): number {
  // A la millonésima antes de subir: 47 × 1575 da 74025 exacto, pero una venta con decimales puede dar 74000.00000000001 y el
  // techo cobraría un millar de más (el mismo cuidado que `mtDeUsd`, lib/mako-tokens-reglas.ts).
  const exacto = Math.round(precioUsd * venta * 1e6) / 1e6;
  return Math.ceil(exacto / REDONDEO_PESOS) * REDONDEO_PESOS;
}

/** Un plan del setting tal cual está guardado (lo que no se lee, se deja como está). */
type PlanCrudo = Record<string, unknown> & { id?: unknown; precioUsd?: unknown; preciosLocales?: unknown };

/** Los planes del setting `planes.mako`, crudos. Si no es una lista, null: con algo que no se entiende, no se escribe. */
export function planesCrudos(crudo: string | null): PlanCrudo[] | null {
  if (crudo == null) return null;
  try {
    const v = JSON.parse(crudo) as unknown;
    return Array.isArray(v) ? (v as PlanCrudo[]) : null;
  } catch { return null; }
}

const pesosDe = (p: PlanCrudo): number | null => {
  const l = p.preciosLocales;
  if (!l || typeof l !== 'object' || Array.isArray(l)) return null;
  const v = Number((l as Record<string, unknown>)[MONEDA_PESOS]);
  return Number.isFinite(v) && v > 0 ? v : null;
};
const usdDe = (p: PlanCrudo): number | null => { const v = Number(p.precioUsd); return Number.isFinite(v) && v > 0 ? v : null; };

/**
 * La cotización que DICEN los precios en vigor: pesos ÷ dólares del plan ACTIVO más caro con precio en pesos (el más caro, porque el
 * redondeo al millar pesa menos: en el de US$97 son 10 pesos por dólar como mucho). null si ningún plan activo tiene precio en pesos.
 * ⚠️ SÓLO LOS ACTIVOS (segunda revisión, hallazgo 8): un plan apagado de US$ 300 con $ 200.000 viejos decía 667, y con eso el cron
 * o saltaba +136 % de un saque o quedaba frenado para siempre. Activo es lo que lee `planesDeSetting`: todo lo que no dice `false`.
 */
export function cotizacionDeLosPrecios(planes: readonly PlanCrudo[]): number | null {
  const con = planes.filter((p) => p.activo !== false).map((p) => ({ usd: usdDe(p), ars: pesosDe(p) }))
    .filter((x): x is { usd: number; ars: number } => x.usd != null && x.ars != null);
  if (!con.length) return null;
  const mayor = con.reduce((a, b) => (b.usd > a.usd ? b : a));
  return mayor.ars / mayor.usd;
}

/** El precio en pesos de cada plan que lo tiene (activo o no), por id: lo que el cron deja escrito (`EstadoBlue.escritos`). */
export function pesosDeLosPlanes(planes: readonly PlanCrudo[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of planes) {
    const ars = pesosDe(p);
    if (ars != null && typeof p.id === 'string') out[p.id] = ars;
  }
  return out;
}

/** Un mapa de precios en pesos del estado (lo escribe el cron, pero el estado se puede tocar a mano): si no se entiende, null. */
export function mapaDePesos(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return Object.values(v as Record<string, unknown>).every((x) => typeof x === 'number' && Number.isFinite(x)) ? (v as Record<string, number>) : null;
}

/** Un precio que no es el que dejó el cron: el que tenía (`delCron`, null si no le había puesto) y el de ahora. */
export type CambioAMano = { id: string; delCron: number | null; ahora: number };

const centavos = (x: number | undefined) => (typeof x === 'number' ? Math.round(x * 100) : NaN);

/**
 * Los precios en pesos de hoy que NO son ninguno de los que dejó el cron (`delCron`: lo que escribió y, si se cortó a mitad de una
 * escritura, lo que estaba por escribir). Un plan con pesos que el cron no conocía también es un cambio a mano (alguien le prendió
 * Mercado Pago). Uno que ya no tiene pesos, no: el cron nunca se los vuelve a poner.
 */
export function cambiadosAMano(actuales: Readonly<Record<string, number>>, delCron: ReadonlyArray<Readonly<Record<string, number>> | null>): CambioAMano[] {
  const [escritos] = delCron;
  return Object.entries(actuales)
    .filter(([id, ars]) => !delCron.some((m) => m != null && centavos(m[id]) === centavos(ars)))
    .map(([id, ahora]) => ({ id, delCron: escritos?.[id] ?? null, ahora }));
}

export type Cambio = { id: string; antes: number; despues: number };

/**
 * El setting con SÓLO el precio en pesos de cada plan puesto al día. Cada plan que ya tiene precio en pesos lo recibe nuevo (activo
 * o no: si se vuelve a prender, ya está al día); el resto del setting queda igual, campo por campo (se edita lo leído, no se
 * reescribe desde `planesDeSetting`, que normaliza y habría podido perder lo que no entiende). Un plan sin precio en pesos no gana uno.
 */
export function settingConPesos(planes: readonly PlanCrudo[], venta: number): { planes: PlanCrudo[]; cambios: Cambio[] } {
  const cambios: Cambio[] = [];
  const nuevos = planes.map((p) => {
    const ars = pesosDe(p), usd = usdDe(p);
    if (ars == null || usd == null || typeof p.id !== 'string') return p;
    const despues = pesosDelPlan(usd, venta);
    if (despues === ars) return p;
    cambios.push({ id: p.id, antes: ars, despues });
    return { ...p, preciosLocales: { ...(p.preciosLocales as Record<string, unknown>), [MONEDA_PESOS]: despues } };
  });
  return { planes: nuevos, cambios };
}

/** Lo que guarda la automatización entre una corrida y la otra (`CLAVE_ESTADO_BLUE`). */
export type EstadoBlue = {
  /** La última cotización que se LEYÓ bien (aunque un freno no la haya aplicado). Es para mirarla: no decide nada. */
  ultima?: Cotizacion & { leidaEn: string };
  /** La última vez que se cambiaron los precios. */
  aplicada?: { venta: number; en: string; cambios: Cambio[] };
  /**
   * El precio en pesos de cada plan como lo dejó la última corrida que salió bien (`pesosDeLosPlanes`). Si hoy un precio no es ése,
   * alguien lo cambió a mano y el cron no lo pisa (`cambiadosAMano`). Sin esto (la primera corrida, o recién prendido) no se compara.
   */
  escritos?: Record<string, number>;
  /**
   * Lo que el cron está por escribir: se anota ANTES del compare-and-set de los planes. Si los planes se escribieron y el estado no
   * (una base que se cayó en el medio), mañana esos precios siguen siendo del cron, no «a mano».
   */
  escribiendo?: Record<string, number>;
  /** El último freno, con su motivo (null cuando la corrida salió bien). */
  freno?: { motivo: string; en: string } | null;
  /** Apagada: a mano (el freno de emergencia) o sola, cuando encontró un precio cambiado a mano. Con `true` no lee ni escribe nada. */
  apagada?: boolean;
};

export function leerEstado(crudo: string | null): EstadoBlue {
  if (!crudo) return {};
  try {
    const v = JSON.parse(crudo) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as EstadoBlue) : {};
  } catch { return {}; }
}

export type Decision =
  | { tipo: 'aplicar'; venta: number; cotizacion: Cotizacion; contra: number | null; salto: number | null; grande: boolean; confirmacion: Cotizacion | null }
  | { tipo: 'frenar'; motivo: string; queSigue: string; contra: number | null; salto: number | null };

const pct = (x: number) => `${(x * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;
const pesos = (x: number) => `$ ${x.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
/** Cuánto difieren dos ventas: la mayor sobre la menor. */
const diferencia = (a: number, b: number) => Math.max(a, b) / Math.min(a, b) - 1;

/** El freno de emergencia, como lo lee una persona (va en cada aviso). */
export const COMO_FRENARLO = `Para frenar la automatización: ${JSON.stringify({ apagada: true })} en el ajuste «${CLAVE_ESTADO_BLUE}» del negocio de la plataforma (se le puede pedir a Claude). Con eso no lee ni escribe nada hasta que se saque.`;
const MANANA = 'Mañana a las 18:05 (hora de Argentina) se vuelve a probar.';
const MANANA_SI_COINCIDEN = `Mañana a las 18:05 (hora de Argentina) se vuelve a leer: si dolarapi.com y bluelytics coinciden dentro de un ${pct(COINCIDEN)}, el precio nuevo se aplica solo (con un aviso si se mueve más de un ${pct(AVISAR_DESDE)}). Si no coinciden, sigue frenado.`;
const A_MANO = `Un cambio así no se aplica solo nunca, aunque se repita: si es de verdad, los precios se cambian a mano en ${DONDE_SE_CAMBIAN}. El cron no pisa un precio cambiado a mano: se apaga solo, y al prenderlo de nuevo sigue el blue desde esos precios.`;

/**
 * ¿Se aplica? Los frenos 1 a 4 de la cabecera. `cotizaciones`: lo que contestó cada servicio, en el orden de `FUENTES_BLUE` (la
 * primera al día es la que se aplica; la segunda la confirma o la frena). `vigente`: la que dicen los precios en vigor
 * (`cotizacionDeLosPrecios`). `ahoraMs`: el reloj de quien llama.
 */
export function decidir(cotizaciones: readonly Cotizacion[], p: { vigente: number | null; ahoraMs: number }): Decision {
  const frenar = (motivo: string, queSigue: string, contra: number | null = null, salto: number | null = null): Decision => ({ tipo: 'frenar', motivo, queSigue, contra, salto });
  if (!cotizaciones.length) return frenar('No llegó la cotización del dólar blue (ningún servicio contestó con un número).', MANANA);
  const alDia = cotizaciones.filter((c) => (p.ahoraMs - Date.parse(c.fecha)) / 86_400_000 <= DIAS_VIEJA);
  if (!alDia.length) {
    const c = cotizaciones[0];
    return frenar(`La cotización del dólar blue de ${c.fuente} es del ${c.fecha.slice(0, 10)}: tiene más de ${DIAS_VIEJA} días.`, MANANA);
  }
  const [c, ...otras] = alDia;
  const otra = otras.find((o) => o.fuente !== c.fuente) ?? null;
  const contra = p.vigente;
  const salto = contra ? c.venta / contra - 1 : null;
  // El freno 2: contestaron los dos y no coinciden. Sea cual sea el salto: con +1 % o con +14 %, no se sabe cuál es el de hoy.
  if (otra && diferencia(c.venta, otra.venta) > COINCIDEN) {
    const seria = contra != null && salto != null ? ` Contra los precios de hoy (${pesos(contra)}), ${c.fuente} sería un salto de ${pct(salto)}.` : '';
    return frenar(`${c.fuente} dice ${pesos(c.venta)} y ${otra.fuente} dice ${pesos(otra.venta)}: difieren un ${pct(diferencia(c.venta, otra.venta))}, y para tocar los precios tienen que coincidir dentro de un ${pct(COINCIDEN)}.${seria}`, MANANA_SI_COINCIDEN, contra, salto);
  }
  const aplicar = (grande: boolean): Decision => ({ tipo: 'aplicar', venta: c.venta, cotizacion: c, contra, salto, grande, confirmacion: otra });
  if (contra == null || salto == null || Math.abs(salto) <= SALTO_MAXIMO) return aplicar(false);
  if (!otra) {
    return frenar(`El dólar blue saltó ${pct(salto)} contra los precios de hoy (de ${pesos(contra)} a ${pesos(c.venta)}, ${c.fuente}) y el otro servicio no contestó para confirmarlo: un salto de más del ${pct(SALTO_MAXIMO)} sólo se aplica si los dos servicios coinciden dentro de un ${pct(COINCIDEN)}.`, MANANA_SI_COINCIDEN, contra, salto);
  }
  if (c.venta > contra * BANDA || c.venta < contra / BANDA) {
    return frenar(`El dólar blue de ${c.fuente} y ${otra.fuente} (${pesos(c.venta)} y ${pesos(otra.venta)}) está a más del doble o a menos de la mitad del que dicen los precios de hoy (${pesos(contra)}).`, A_MANO, contra, salto);
  }
  return aplicar(true);
}

/**
 * ¿Se avisa un cambio que se aplicó? El grande (más del 15 %, confirmado por los dos) siempre; el resto, si el blue se movió más de
 * un 5 % (`AVISAR_DESDE`) contra los precios en vigor o algún precio cambia más que eso (el redondeo al millar, o un plan apagado con
 * pesos viejos). Antes sólo se avisaba el grande: +14 % entraba en silencio (segunda revisión, hallazgo 1).
 */
export function seAvisaElCambio(d: { grande: boolean; salto: number | null }, cambios: readonly Cambio[]): boolean {
  if (!cambios.length) return false;
  return d.grande || Math.abs(d.salto ?? 0) > AVISAR_DESDE || cambios.some((c) => Math.abs(c.despues / c.antes - 1) > AVISAR_DESDE);
}

/** Un aviso de la automatización: la campanita de la plataforma y un correo a equipo@hola-mako.com (lib/dolar-blue.ts). */
export type AvisoBlue = { tipo: 'freno' | 'cambio'; titulo: string; resumen: string; texto: string };

/** El aviso de un freno: qué pasó, que nada cambió, QUÉ PASA MAÑANA y cómo frenarlo (revisión del 16/11, hallazgo 1). */
export function avisoDelFreno(motivo: string, queSigue: string): AvisoBlue {
  return {
    tipo: 'freno',
    titulo: 'El precio en pesos de los planes no se actualizó hoy',
    resumen: motivo,
    texto: [
      `Hoy no se puso al día el precio en pesos de los planes con el dólar blue: ${motivo}`,
      'Los precios siguen como estaban, y los links de pago que ya salieron no cambian.',
      queSigue,
      COMO_FRENARLO,
    ].join('\n\n'),
  };
}

/**
 * El aviso de un cambio que se aplicó (`seAvisaElCambio`): con lo que cambió, quién lo dijo y cómo volver atrás. `confirmacion`: el
 * otro servicio, si contestó (y coincidió: si no, era un freno); null si contestó uno solo.
 */
export function avisoDelCambio(p: { venta: number; contra: number; salto: number; fuente: string; confirmacion: Cotizacion | null; cambios: readonly Cambio[]; nombres: Readonly<Record<string, string>> }): AvisoBlue {
  const lineas = p.cambios.map((c) => `· ${p.nombres[c.id] ?? c.id}: de ${pesos(c.antes)} a ${pesos(c.despues)} por mes.`);
  const movio = `${p.salto >= 0 ? 'subió' : 'bajó'} un ${pct(Math.abs(p.salto))}`;
  const quien = p.confirmacion
    ? `${p.fuente} dijo ${pesos(p.venta)} y ${p.confirmacion.fuente} ${pesos(p.confirmacion.venta)}: como coinciden`
    : `Sólo contestó ${p.fuente} (${pesos(p.venta)}): con un salto de menos del ${pct(SALTO_MAXIMO)} alcanza con uno`;
  return {
    tipo: 'cambio',
    titulo: `El precio en pesos de los planes ${movio}`,
    resumen: `El dólar blue pasó de ${pesos(p.contra)} a ${pesos(p.venta)} y se aplicó (${p.confirmacion ? `${p.fuente} y ${p.confirmacion.fuente} coinciden` : `sólo contestó ${p.fuente}`}).`,
    texto: [
      `Hoy el dólar blue ${movio} contra lo que decían los precios: de ${pesos(p.contra)} a ${pesos(p.venta)}. ${quien}, el precio en pesos nuevo ya está aplicado.`,
      lineas.join('\n'),
      'Los links de pago que ya salieron no cambian.',
      `Si está mal: frenar la automatización y volver a poner los precios a mano en ${DONDE_SE_CAMBIAN} (el cron no pisa un precio cambiado a mano). ${COMO_FRENARLO}`,
    ].join('\n\n'),
  };
}

/** El aviso de un precio cambiado a mano (`cambiadosAMano`): el cron no tocó nada y se apagó solo. Dice cómo prenderlo. */
export function avisoDeAMano(cambiados: readonly CambioAMano[], nombres: Readonly<Record<string, string>>): AvisoBlue {
  const uno = cambiados.length === 1;
  const lineas = cambiados.map((x) => `· ${nombres[x.id] ?? x.id}: ${x.delCron == null ? 'el cron no le había puesto precio en pesos' : `el cron lo había dejado en ${pesos(x.delCron)}`}, y ahora está en ${pesos(x.ahora)}.`);
  return {
    tipo: 'freno',
    titulo: `El dólar blue ya no mueve los precios en pesos: ${uno ? 'uno se cambió' : 'se cambiaron'} a mano`,
    resumen: `${uno ? 'Un precio en pesos no es el que dejó' : `${cambiados.length} precios en pesos no son los que dejó`} el cron: para no pisar ${uno ? 'ese cambio' : 'esos cambios'}, la automatización se apagó sola.`,
    texto: [
      `Hoy no se puso al día el precio en pesos de los planes con el dólar blue: ${uno ? 'uno no es el que dejó' : 'algunos no son los que dejó'} el cron en su última corrida, así que se ${uno ? 'cambió' : 'cambiaron'} a mano.`,
      lineas.join('\n'),
      'Para no pisar ese cambio, la automatización se apagó sola: no se tocó ningún precio, y los pesos quedan como están hasta que se prenda de nuevo. Los links de pago que ya salieron no cambian.',
      `Para prenderla: sacar «apagada» del ajuste «${CLAVE_ESTADO_BLUE}» del negocio de la plataforma (se le puede pedir a Claude). Al prenderla vuelve a poner todos los precios en pesos al dólar blue, también ${uno ? 'el que se cambió' : 'los que se cambiaron'} a mano.`,
    ].join('\n\n'),
  };
}

/** El cartel de Settings › Payments, donde se cambian a mano los precios en pesos (sólo con la Mercado Pago en `MONEDA_PESOS`). */
export const CARTEL_DEL_BLUE = {
  titulo: 'Estos precios en pesos se ponen al día solos con el dólar blue',
  texto: `Todos los días a las 18:05 (hora de Argentina): los dólares del plan por la venta del blue, hacia arriba al millar. Si cambias uno a mano, el cron no lo pisa: se apaga solo y te avisa por correo. Para apagarlo, ${JSON.stringify({ apagada: true })} en el ajuste «${CLAVE_ESTADO_BLUE}» del negocio de la plataforma; para prenderlo, se saca (se le puede pedir a Claude).`,
} as const;
