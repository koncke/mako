// =============================================================================
// El gasto FIJO de MaKo: lo que se paga vaya o no vaya un cliente (7/11/2026)
// =============================================================================
// QUÉ RESUELVE: Admin › Analytics › Costs mide el gasto de IA, que es variable y se lee de
// `anthropic_usage`. No sabía nada del gasto FIJO —las suscripciones, la infraestructura—, que a
// poca escala pesa MÁS que la IA: con 10 clientes, US$1.123 de fijo son US$112 por cliente, más de
// lo que paga uno del plano de US$47.
//
// ── Por qué va DECLARADO y no leído ─────────────────────────────────────────
//
// Porque no se puede leer, y eso está medido el 7/11:
//   · Vercel: `VERCEL_API_TOKEN` devuelve **403** en `/v1/billing/charges` y en `/v9/projects`.
//   · GitHub Actions: el token de Actions NO ve el panel de facturación. La API contesta **0**, y
//     ese cero significa «no pude leer», nunca «no gastamos» (ver docs/hallazgos-video-pipeline.md).
//   · Anthropic: las organizaciones del crédito son «Individual Org» y no tienen Admin API; el
//     saldo no tiene endpoint (lib/credito-api.ts lo documenta).
//
// ⚠️ ENTONCES CADA CIFRA LLEVA LA FECHA EN QUE SE CONFIRMÓ, y la pantalla la muestra. Un número
// declarado sin fecha es una mentira que envejece en silencio: a los tres meses nadie sabe si
// US$60 de Vercel siguen siendo US$60. Con la fecha, se ve viejo y alguien lo vuelve a mirar.
//
// ⚠️ Y CADA CIFRA LLEVA QUIÉN LA PAGA. No es un detalle contable: hoy Mauricio paga su cuenta de
// Claude, Vercel, Supabase y Railway, y las otras cuentas de Claude van a mitad con Leandro. El
// punto de equilibrio de Martín se calcula con lo que sale de SU bolsillo — son 10 clientes contra
// los 31 que darían si se sumara todo. Mezclarlo da una respuesta que no sirve para decidir nada.
//
// La cuenta completa, con el punto de equilibrio y la economía por cliente, en
// `docs/costos-fijos-mako.md`.
// =============================================================================

/** Quién paga una partida HOY. Lo que algún día pase a Martín no cambia su equilibrio de hoy. */
export type QuienPaga = 'martin' | 'mauricio' | 'compartido';

/** Si la cifra se puede confirmar sola o hay que ir a mirarla a mano. */
export type ComoSeSabe =
  /** Se consultó a su API y contestó. */
  | 'api'
  /** Hay que entrar al panel: su API no lo expone o el token no alcanza. */
  | 'panel'
  /** Lo dijo una persona. */
  | 'declarado';

export type PartidaFija = {
  readonly id: string;
  readonly nombre: string;
  /** US$ por mes. Un gasto anual va prorrateado, y la nota lo dice. */
  readonly usdPorMes: number;
  readonly quienPaga: QuienPaga;
  /**
   * Si es compartido, qué fracción le toca a Martín (0 a 1). Para el resto, 1.
   * Las cuentas de Claude que no son de Mauricio van a mitad con Leandro: 0,5.
   */
  readonly parteDeMartin: number;
  readonly comoSeSabe: ComoSeSabe;
  /** YYYY-MM-DD. La pantalla muestra cuánto hace que nadie lo confirma. */
  readonly confirmado: string;
  readonly nota?: string;
};

/**
 * Las partidas, al 7/11/2026.
 *
 * ⚠️ NO se listan acá las que son BYOK (Resend, Apify): el cliente trae su token y a MaKo le
 * cuestan cero. Ponerlas en 0 ensucia la tabla y sugiere que algún día costarán.
 */
export const PARTIDAS_FIJAS: readonly PartidaFija[] = [
  {
    id: 'claude-otras',
    nombre: 'Claude × 4 (las que no son de Mauricio)',
    usdPorMes: 800,
    quienPaga: 'compartido',
    parteDeMartin: 0.5,
    comoSeSabe: 'declarado',
    confirmado: '2026-11-07',
    nota: 'US$200 cada plan Max 20x, a mitad con Leandro. Cada uno trae US$200/mes de crédito de API que VENCE (lib/credito-api.ts).',
  },
  {
    id: 'claude-mauricio',
    nombre: 'Claude de Mauricio',
    usdPorMes: 200,
    quienPaga: 'mauricio',
    parteDeMartin: 1,
    comoSeSabe: 'declarado',
    confirmado: '2026-11-07',
    nota: 'La cuenta claude1. También trae su crédito de API.',
  },
  {
    id: 'vercel',
    nombre: 'Vercel',
    usdPorMes: 60,
    quienPaga: 'mauricio',
    parteDeMartin: 1,
    comoSeSabe: 'panel',
    confirmado: '2026-11-06',
    nota: 'Piso medido US$54 + ~1 build/día a US$0,33. NO es la factura en curso (US$278): ése fue un pico ya corregido. El token de la API devuelve 403.',
  },
  {
    id: 'supabase',
    nombre: 'Supabase Pro',
    usdPorMes: 25,
    quienPaga: 'mauricio',
    parteDeMartin: 1,
    comoSeSabe: 'api',
    confirmado: '2026-11-07',
    nota: '⚠️ Es el plan de la organización ENTERA, que tiene 7 proyectos que no son MaKo. Cuando lo pague Martín conviene sacar MaKo a su propia org.',
  },
  {
    id: 'railway',
    nombre: 'Railway',
    usdPorMes: 21,
    quienPaga: 'mauricio',
    parteDeMartin: 1,
    comoSeSabe: 'declarado',
    confirmado: '2026-11-07',
    nota: 'Corre Evolution, el WhatsApp no oficial.',
  },
  {
    id: 'github',
    nombre: 'GitHub Actions',
    usdPorMes: 30,
    quienPaga: 'martin',
    parteDeMartin: 1,
    comoSeSabe: 'panel',
    confirmado: '2026-11-07',
    nota: '⚠️ Es el TOPE configurado, no el gasto. El token de Actions no ve el panel de facturación y contesta 0, que significa «no pude leer».',
  },
  {
    id: 'app-store',
    nombre: 'App Store (Apple Developer)',
    usdPorMes: 99 / 12,
    quienPaga: 'martin',
    parteDeMartin: 1,
    comoSeSabe: 'declarado',
    confirmado: '2026-11-07',
    nota: 'US$99 al año, prorrateado. Google Play son US$25 UNA vez y ya están pagos: no es gasto corriente.',
  },
];

/** Lo que una partida le cuesta a Martín HOY. Lo que paga otro es 0, por más que algún día pase. */
export const cuestaAMartin = (p: PartidaFija): number =>
  p.quienPaga === 'mauricio' ? 0 : p.usdPorMes * p.parteDeMartin;

/** Lo que costará el día que Martín pague todo: la partida entera, sin repartos. */
export const cuestaSiPagaTodo = (p: PartidaFija): number => p.usdPorMes;

/** El fijo de Martín HOY. Es el número que manda en su punto de equilibrio. */
export const fijoDeMartin = (partidas: readonly PartidaFija[] = PARTIDAS_FIJAS): number =>
  partidas.reduce((a, p) => a + cuestaAMartin(p), 0);

/** El fijo total, si Martín pasara a pagar todo. */
export const fijoSiPagaTodo = (partidas: readonly PartidaFija[] = PARTIDAS_FIJAS): number =>
  partidas.reduce((a, p) => a + cuestaSiPagaTodo(p), 0);

/**
 * Cuántos días hace que nadie confirma una cifra.
 *
 * `hoy` entra como texto YYYY-MM-DD a propósito: una fecha armada en el server (UTC) y mostrada en
 * el navegador ya salió corrida un día en esta misma pantalla (punto 5 de la revisión del 6/11).
 */
export function diasSinConfirmar(p: PartidaFija, hoy: string): number {
  const a = Date.parse(p.confirmado + 'T00:00:00Z');
  const b = Date.parse(hoy + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** A partir de cuántos días una cifra se muestra como vieja. Un trimestre: las facturas cambian. */
export const DIAS_PARA_ENVEJECER = 90;

/** Las partidas que hace demasiado que nadie confirma, de la más vieja a la más nueva. */
export const partidasViejas = (hoy: string, partidas: readonly PartidaFija[] = PARTIDAS_FIJAS): PartidaFija[] =>
  partidas
    .filter((p) => diasSinConfirmar(p, hoy) >= DIAS_PARA_ENVEJECER)
    .sort((x, y) => diasSinConfirmar(y, hoy) - diasSinConfirmar(x, hoy));

/**
 * Lo que el gasto fijo le cuesta a CADA cliente, que es como se compara con la IA.
 *
 * ⚠️ Con 0 clientes NO devuelve 0 ni Infinity: devuelve null. Un cero diría «no cuesta nada», que
 * es exactamente lo contrario de la verdad, y es la misma trampa que el «0 min» de GitHub.
 */
export const fijoPorCliente = (clientes: number, fijo: number): number | null =>
  Number.isFinite(clientes) && clientes > 0 ? fijo / clientes : null;
