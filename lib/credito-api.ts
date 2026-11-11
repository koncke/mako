// =============================================================================
// El crédito de API de los cuatro planes Max 20x, en el Uso del Ops Center (22/10/2026; puro, con test)
// =============================================================================
// Martín (22/10/2026): «En USO de SuperAdmin quiero ver también el USO de la API, que como tenemos 4 cuentas de Claude x20,
// deberían ser 800 usd al mes...». Cada plan Max 20x trae US$200 por mes de crédito de API, que se reclama vinculando UNA
// organización de Console por plan (claude.ai → Configuración → Facturación), recién a los 7 días de suscripto; llega con
// cada cobro del plan, vence al fin del ciclo y no se acumula (platform.claude.com/docs/en/about-claude/api-credits-for-subscribers).
//
// DE DÓNDE SALE LO GASTADO (medido el 22/10/2026): de lo que MaKo REGISTRA en `anthropic_usage`, porque Anthropic no deja
// leerlo. Con las claves del crédito, `GET /v1/organizations/cost_report` y `usage_report` devuelven 401 («The Admin API
// requires an Admin API key or an organization-scoped API key»), y las organizaciones son «Individual Org», que no tienen
// Admin API. Lo único que contestan es `/v1/organizations/me` (el nombre de la organización). El saldo tampoco tiene
// endpoint: se ve en platform.claude.com → Billing → Promotional credits.
// Una llamada se le cuenta a un crédito por dos caminos, los dos ya registrados:
//   · la marca del crédito en el motivo (`MOTIVO_CREDITO_PLATAFORMA (cuenta N)`, lib/anthropic.ts → conCreditoDeLaPlataforma);
//   · el workspace: un negocio cuya `ANTHROPIC_API_KEY` ES la clave de un crédito (el ws10 tiene la de la cuenta 2 como su
//     Claude, scripts/claude-propio-de-un-negocio.mts) paga con ese crédito todo lo que registra como Anthropic en su ws.
//     Lo decide quien lee (lib/credito-api-db.ts), comparando las claves; acá llega el mapa ws → cuenta.
// ⚠️ NUNCA SE INVENTA UN NÚMERO: si el registro no se pudo leer, `gastadoUsd` es null y la pantalla lo dice; si las claves
//    de los negocios no se pudieron leer, `negociosSinLeer` lo avisa (lo de ese negocio no estaría sumado).
// ⚠️ SIN `server-only`: lo leen el servidor y los tests; la pantalla importa sólo los tipos.

import { CREDITO_DE_UN_NEGOCIO, MOTIVO_CREDITO_PLATAFORMA, esDelCreditoDeLaPlataforma } from './veto-claude';

/** Lo que trae por mes el plan Max 20x (Max 5x: 100). */
export const CREDITO_MENSUAL_USD = 200;
/** Lo que espera Anthropic desde la suscripción para dejar vincular el crédito. */
export const DIAS_PARA_VINCULAR = 7;

/**
 * Cada cuenta de Claude y el nombre de la clave de SU crédito. La clave vive en el `.env.local` o, cifrada, en la fila del
 * workspace de la plataforma con ese mismo nombre (scripts/credito-claude-a-plataforma.mts), que es como la lee
 * `conCreditoDeLaPlataforma`. ⚠️ El número de la clave es el de la cuenta: medido el 22/10/2026 con `/v1/organizations/me`,
 * la CUENTA1 es «Mauricio's Individual Org» (claude1, el gmail de Mauricio) y la CUENTA2 «Lean's Individual Org» (claude2;
 * la 4, el otro gmail de Leandro, todavía no podía vincular).
 * `suscripta`: el día (Argentina) en que se compró el plan, si se sabe: de ahí sale desde cuándo se puede vincular.
 * `diaDeCobro`: el día del mes en que se cobra el plan, que es cuando llega el crédito nuevo. Sin él, se mide el mes calendario
 * y la pantalla dice «con el cobro del plan». Lo ve Martín en claude.ai → Configuración → Facturación.
 */
export type CuentaDelCredito = { cuenta: string; clave: string; suscripta?: string; diaDeCobro?: number };
export const CUENTAS_DEL_CREDITO: readonly CuentaDelCredito[] = [
  { cuenta: 'claude1', clave: 'ANTHROPIC_CREDITO_CUENTA1' },
  { cuenta: 'claude2', clave: 'ANTHROPIC_CREDITO_CUENTA2' },
  { cuenta: 'claude3', clave: 'ANTHROPIC_CREDITO_CUENTA3' },
  // La cuenta 4 entró la noche del 16/10/2026 (memoria dos-cuentas-claude: «16/10 ~23:50 AR entra la cuenta 4», con 0% de uso).
  { cuenta: 'claude4', clave: 'ANTHROPIC_CREDITO_CUENTA4', suscripta: '2026-10-16' },
  // La 5 (Ananda) entró el 24/10/2026 (~/.claude/cuentas.tsv). Martín, 28/10/2026: «Si, todas mis cuentas son x20». Su clave la
  // pega él en SuperAdmin › Uso › API; se puede vincular desde los 7 días.
  { cuenta: 'claude5', clave: 'ANTHROPIC_CREDITO_CUENTA5', suscripta: '2026-10-24' },
];

/**
 * Las claves del crédito de los GRUPOS de WhatsApp (lib/credito-negocio.ts, `cuentasDelCreditoDeLosGrupos`; Martín, 28/10/2026:
 * «todas las cuentas de planes 200»): las MISMAS cuentas que el Uso, para N cuentas. Una cuenta nueva es UNA línea arriba (y su
 * clave, que la carga Martín): el reparto entre las cuentas, la puerta 2 y el Uso la toman solos. Antes era una copia con cuatro
 * nombres en lib/veto-claude.ts, y una quinta habría pagado turnos que el Uso no mostraba. Sólo estos nombres: una clave
 * `ANTHROPIC_CREDITO_CUENTA9` que no está acá no paga nada.
 */
export const CLAVES_CREDITO_DE_LOS_GRUPOS: readonly string[] = CUENTAS_DEL_CREDITO.map((c) => c.clave);

/**
 * El % gastado de cada cuenta en su ciclo, como lo deja el vigía (`vigilarCreditoClaude`, cada 10 minutos) en la fila de la
 * plataforma: `{ at, cuentas: { ANTHROPIC_CREDITO_CUENTA2: 81.3, … } }`. Con él se reparte (primero la que menos gastó) y la
 * plataforma deja el último 10% de cada cuenta para WhatsApp (11/11/2026).
 */
export const CLAVE_USO_DEL_CREDITO = 'ia.credito.uso';
/** Desde este % de una cuenta, la plataforma (el ws 9) no la usa: ese resto queda para los grupos de WhatsApp. */
export const TOPE_DE_LA_PLATAFORMA_PCT = 90;
/** Un % más viejo que esto no se usa: el vigía corre cada 10 minutos, y un dato viejo de otro ciclo saltearía cuentas sanas. */
const USO_VIGENTE_MS = 2 * 3_600_000;

/** El % de cada cuenta guardado por el vigía, si es reciente y se entiende. null = no hay dato (y entonces el reparto de siempre). */
export function leerUsoDelCredito(valor: string | null | undefined, ahora: number): Record<string, number> | null {
  try {
    const v = JSON.parse(valor ?? '') as { at?: unknown; cuentas?: unknown };
    const t = typeof v?.at === 'string' ? Date.parse(v.at) : NaN;
    if (!Number.isFinite(t) || ahora - t > USO_VIGENTE_MS || t - ahora > 60_000) return null;
    if (!v.cuentas || typeof v.cuentas !== 'object') return null;
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(v.cuentas as Record<string, unknown>)) if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[k] = n;
    return out;
  } catch { return null; }
}

/**
 * En qué orden se prueban las cuentas con clave. Sin dato del vigía, el reparto de siempre (una distinta primero en cada turno,
 * `giro`). Con dato: primero la que menos % gastó (lo que gasta el ws1 con su cuenta 1 se compensa solo), las de % desconocido
 * al final; y para la PLATAFORMA, sin las que llegaron al 90%. Los grupos las usan hasta que Anthropic diga que no hay saldo.
 */
export function ordenDeLasCuentas(con: readonly string[], uso: Readonly<Record<string, number>> | null, para: 'grupos' | 'plataforma', giro: number): string[] {
  if (!con.length) return [];
  const i = ((giro % con.length) + con.length) % con.length;
  const rotadas = [...con.slice(i), ...con.slice(0, i)];
  if (!uso) return rotadas;
  const usables = para === 'plataforma' ? rotadas.filter((c) => !((uso[c] ?? 0) >= TOPE_DE_LA_PLATAFORMA_PCT)) : rotadas;
  return usables
    .map((c, j) => ({ c, j, pct: uso[c] ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => (a.pct === b.pct ? a.j - b.j : a.pct - b.pct))
    .map((x) => x.c);
}

/** Una fila de `anthropic_usage`, lo justo para saber qué crédito la pagó. */
export type FilaGasto = {
  workspace_id: number; created_at: string; motivo: string | null; cuenta: number | null;
  cost_usd: number | string | null; provider: string | null; model: string | null;
};

export type FilaCredito = {
  cuenta: string;
  /** Su clave está en MaKo. null = no se pudo leer (no es «falta vincular»). */
  vinculada: boolean | null;
  /** Desde cuándo se cuenta (inicio del ciclo, o del mes si no se sabe el día de cobro) y cuándo llega el próximo. */
  desde: string;
  renueva: string | null;
  /** Lo registrado con este crédito en el período. null = el registro no se pudo leer. */
  gastadoUsd: number | null;
  llamadas: number;
  /** La parte que gastó un negocio que usa esta clave como su Claude (ya sumada en `gastadoUsd`). */
  delNegocio: Array<{ ws: number; usd: number }>;
  /** La última vez del período que Anthropic contestó «credit balance is too low» con esta clave. */
  sinCreditoAt: string | null;
  /** Si todavía no se puede vincular: desde cuándo (los 7 días de suscripta). */
  vinculableDesde: string | null;
};
/** Lo de arriba de la sección (`totalCredito`). */
export type TotalCredito = { gastadoUsd: number | null; vinculadas: number; rindeUsd: number; totalUsd: number };
/**
 * Un negocio con un crédito ASIGNADO como su Claude (lib/veto-claude.ts → CREDITO_DE_UN_NEGOCIO; el ws1, 22/10/2026), con su
 * interruptor de SuperAdmin › Uso. `prendido` null = no se pudo leer (y apagado para la puerta 2: falla cerrada). `gastadoUsd`:
 * lo que lleva gastado ESE negocio de ese crédito en el ciclo de la cuenta; null = el registro no se pudo leer.
 */
export type AsignadoCredito = { ws: number; quien: string; cuenta: string; prendido: boolean | null; gastadoUsd: number | null; llamadas: number };
/** Lo que recibe la pantalla: las filas y el total ya armados en el servidor (la pantalla importa sólo los tipos). */
export type LecturaCredito =
  | { ok: true; filas: FilaCredito[]; total: TotalCredito; negociosSinLeer: boolean; asignados?: AsignadoCredito[] }
  | { ok: false; error: string };

const AR_MS = 3 * 3_600_000;
const fechaAR = (t: number) => { const d = new Date(t - AR_MS); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }; };
const medianocheAR = (y: number, m: number, d: number) => Date.UTC(y, m, d) + AR_MS;
const ultimoDia = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const diaValido = (y: number, m: number, dia: number) => Math.min(dia, ultimoDia(y, m));

/**
 * El ciclo del crédito: desde el último cobro del plan hasta el próximo, a la medianoche de Argentina. Sin el día de cobro,
 * el mes calendario y `renueva: null` (no se sabe: se dice).
 */
export function cicloDelCredito(diaDeCobro: number | null | undefined, ahora: number): { desde: number; renueva: number | null } {
  const { y, m, d } = fechaAR(ahora);
  if (!diaDeCobro || diaDeCobro < 1 || diaDeCobro > 31) return { desde: medianocheAR(y, m, 1), renueva: null };
  const esteMes = diaValido(y, m, diaDeCobro);
  if (d >= esteMes) return { desde: medianocheAR(y, m, esteMes), renueva: medianocheAR(y, m + 1, diaValido(y, m + 1, diaDeCobro)) };
  return { desde: medianocheAR(y, m - 1, diaValido(y, m - 1, diaDeCobro)), renueva: medianocheAR(y, m, esteMes) };
}

/** Desde cuándo se puede vincular el crédito de una cuenta suscripta tal día (AR). null = no se sabe cuándo se suscribió. */
export function vinculableDesde(suscripta: string | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(suscripta ?? '');
  return m ? medianocheAR(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + DIAS_PARA_VINCULAR) : null;
}

/**
 * ¿Qué crédito pagó esta fila? `cuenta` (claudeN) y, si la pagó un negocio con esa clave como su Claude, su ws. null = ninguno.
 * La marca del crédito trae el número en el motivo («⚠ crédito de Claude de la plataforma (cuenta 2) · …»); sin él, la columna.
 */
export function creditoQuePago(
  f: Pick<FilaGasto, 'workspace_id' | 'motivo' | 'cuenta' | 'provider'>,
  wsConClave: ReadonlyMap<number, string>,
  cuentas: readonly CuentaDelCredito[] = CUENTAS_DEL_CREDITO,
): { cuenta: string; negocio: number | null } | null {
  if (esDelCreditoDeLaPlataforma(f.motivo)) {
    const enMotivo = /^\s*\(cuenta (\d+)\)/.exec((f.motivo ?? '').trimStart().slice(MOTIVO_CREDITO_PLATAFORMA.length))?.[1];
    // «(su clave es el crédito)» no trae el número: lo dice el NEGOCIO, con la clave de un crédito como su Claude (el ws10, la
    // cuenta 2) o con un crédito asignado (el ws1, la cuenta 1). Sin esto, todo iba a la cuenta 1 (la columna `cuenta` es la
    // de su proveedor, 1), y lo del ws10 se le sumaba a Mauricio (22/10/2026).
    if (!enMotivo) {
      const asignado = CREDITO_DE_UN_NEGOCIO.find((a) => a.ws === f.workspace_id);
      const delNegocio = wsConClave.get(f.workspace_id) ?? (asignado ? cuentas.find((x) => x.clave === asignado.clave)?.cuenta : undefined);
      if (delNegocio) return { cuenta: delNegocio, negocio: f.workspace_id };
    }
    const n = Number(enMotivo ?? f.cuenta ?? 1);
    const c = cuentas.find((x) => x.clave === `ANTHROPIC_CREDITO_CUENTA${n}`);
    return c ? { cuenta: c.cuenta, negocio: null } : null;
  }
  if ((f.provider ?? 'anthropic') !== 'anthropic') return null;
  // La clave del negocio es su `ANTHROPIC_API_KEY` (la cuenta 1 de su proveedor): otra cuenta suya sería otra clave.
  const c = wsConClave.get(f.workspace_id);
  return c && (f.cuenta ?? 1) === 1 ? { cuenta: c, negocio: f.workspace_id } : null;
}

/** Lo que gastó un negocio del crédito asignado, desde `desde`: sus filas con la marca del crédito. null = sin registro. */
export function gastoDelAsignado(gastos: readonly FilaGasto[] | null, ws: number, desde: number): { usd: number; llamadas: number } | null {
  if (!gastos) return null;
  let usd = 0;
  let llamadas = 0;
  for (const f of gastos) {
    if (Number(f.workspace_id) !== ws || !esDelCreditoDeLaPlataforma(f.motivo) || Date.parse(f.created_at) < desde) continue;
    usd += Number(f.cost_usd ?? 0) || 0;
    llamadas++;
  }
  return { usd: Math.round(usd * 1e6) / 1e6, llamadas };
}

const SIN_CREDITO_RE = /sin crédito hasta el próximo ciclo/;
const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

/** Cada cuenta con su crédito: vinculado o no, lo gastado en su ciclo según lo registrado, y desde cuándo puede vincular. */
export function resumenCredito(p: {
  vinculadas: Readonly<Record<string, boolean | null>>;
  /** Las filas de Anthropic desde el inicio del ciclo más viejo. null = no se pudieron leer. */
  gastos: readonly FilaGasto[] | null;
  wsConClave: ReadonlyMap<number, string>;
  ahora: number;
  cuentas?: readonly CuentaDelCredito[];
}): FilaCredito[] {
  const cuentas = p.cuentas ?? CUENTAS_DEL_CREDITO;
  return cuentas.map((c) => {
    const ciclo = cicloDelCredito(c.diaDeCobro, p.ahora);
    const desde = vinculableDesde(c.suscripta);
    const fila: FilaCredito = {
      cuenta: c.cuenta, vinculada: p.vinculadas[c.cuenta] ?? null,
      desde: new Date(ciclo.desde).toISOString(), renueva: ciclo.renueva == null ? null : new Date(ciclo.renueva).toISOString(),
      gastadoUsd: null, llamadas: 0, delNegocio: [], sinCreditoAt: null,
      vinculableDesde: desde != null && desde > p.ahora ? new Date(desde).toISOString() : null,
    };
    if (!p.gastos) return fila;
    let usd = 0;
    const negocios = new Map<number, number>();
    for (const f of p.gastos) {
      const t = Date.parse(f.created_at);
      if (!Number.isFinite(t) || t < ciclo.desde || t > p.ahora) continue;
      const pago = creditoQuePago(f, p.wsConClave, cuentas);
      if (pago?.cuenta !== c.cuenta) continue;
      if (SIN_CREDITO_RE.test(f.motivo ?? '')) {
        if (!fila.sinCreditoAt || f.created_at > fila.sinCreditoAt) fila.sinCreditoAt = new Date(t).toISOString();
        continue;
      }
      // Un veto no llegó a Anthropic: no es una llamada (y cuesta 0).
      if ((f.model ?? '').startsWith('vetado:')) continue;
      const costo = Number(f.cost_usd) || 0;
      usd += costo;
      fila.llamadas++;
      if (pago.negocio != null) negocios.set(pago.negocio, (negocios.get(pago.negocio) ?? 0) + costo);
    }
    fila.gastadoUsd = redondear(usd);
    fila.delNegocio = [...negocios].sort((a, b) => a[0] - b[0]).map(([ws, u]) => ({ ws, usd: redondear(u) }));
    return fila;
  });
}

/**
 * Lo de arriba de la sección: «US$X de US$800 este mes». `gastadoUsd` null si alguna cuenta vinculada no se pudo leer, O si
 * de alguna no se sabe si está vinculada (su clave no se pudo leer): una suma con un hueco no es un dato (revisión del
 * 22/10/2026: con una cuenta en «No pude leerlo», el total salía igual, sin lo de esa cuenta). `rindeUsd`: lo que hoy se
 * puede gastar (las vinculadas); `totalUsd`: con las cuatro.
 */
export function totalCredito(filas: readonly FilaCredito[]): TotalCredito {
  const vinculadas = filas.filter((f) => f.vinculada === true);
  const hueco = filas.some((f) => f.vinculada == null) || vinculadas.some((f) => f.gastadoUsd == null);
  const gastadoUsd = hueco ? null : redondear(vinculadas.reduce((s, f) => s + (f.gastadoUsd ?? 0), 0));
  return { gastadoUsd, vinculadas: vinculadas.length, rindeUsd: vinculadas.length * CREDITO_MENSUAL_USD, totalUsd: filas.length * CREDITO_MENSUAL_USD };
}
