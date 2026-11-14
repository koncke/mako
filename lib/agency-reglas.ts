// =============================================================================
// agency-reglas — Agency Dashboard en reglas puras: quién se suma, quién paga cada cliente y cuándo salta su pago
// =============================================================================
// Pedido de Martín (25/10/2026, docs/feedback-25-10-tarde.md punto 9): «crees otra tab abajo de "Partners" que sea "Agency
// Dashboard"... que tengas la "landing" y que te puedas sumar como "Agency", solo para los que tengan su plan de 97
// activo... Las agencias no ganan dinero con MaKo, porque sus clientes son suyos... tu agregas a 1 cliente nuevo y puedes
// elegir si el cobro se realiza ahí mismo con tu tarjeta, o si quieres que lo pague tu cliente, y en dicho caso, al
// finalizar el onboarding de ese cliente debe saltar el cartel de pago».
//
// Lo que quedó (el porqué, en docs/hallazgos-agencias.md):
//   · SER AGENCY = TENER EL PLAN PRO Y HABERSE SUMADO. Hasta hoy bastaba la capa `agencia` (que es la del plan Pro de
//     US$97, lib/planes-mako.ts), o sea que todo el que compraba Pro era agencia sin pedirlo. Sumarse es una fila en
//     `agencias` (mig 0176, la tabla que ya existía y tenía a Código Inmobiliario): no hace falta migración.
//   · QUIÉN PAGA vive en la cuenta del CLIENTE (`app_settings`, `KEY_QUIEN_PAGA`): lo lee el cartel de pago del propio
//     cliente sin cruzar de inquilino, y la agencia lo lee con el cliente de servicio. Sin la clave, paga la agencia: es
//     lo que pasaba con todas las cuentas abiertas antes de este día.
//   · EL CARTEL DE PAGO del cliente sale cuando él paga, terminó el onboarding y hay algo que pagar: el primer mes (no se
//     cierra: sin él la cuenta no sigue) o la renovación mensual (se cierra: el mes ya está pagado).
//
// Sin `server-only`: lo ejecutan los tests.
// =============================================================================

/** La capa que da el plan Pro de US$97 (lib/planes-mako.ts, `capa: 'agencia'`): la única que puede sumarse. */
export const CAPA_PRO = 'agencia';

/** Por qué un negocio no puede sumarse como Agency. */
export type MotivoNoAgency = 'plataforma' | 'plan' | 'pausado';

export const TEXTO_NO_AGENCY: Record<MotivoNoAgency, string> = {
  plataforma: 'MaKo no se suma como Agency: desde aquí ves las agencias.',
  plan: 'Agency es parte del plan MaKo Pro: cámbiate a Pro para sumarte.',
  pausado: 'Tu cuenta está pausada: vuelve a activar tu plan para sumarte.',
};

/**
 * ¿Puede sumarse como Agency? Sólo con el plan Pro ACTIVO («solo para los que tengan su plan de 97 activo»). En positivo:
 * la capa exacta y el estado exacto; cualquier otra cosa, no.
 */
export function puedeSumarseComoAgency(w: { capa: string | null | undefined; estado: string | null | undefined; esPlataforma: boolean }):
  { ok: true } | { ok: false; motivo: MotivoNoAgency } {
  if (w.esPlataforma) return { ok: false, motivo: 'plataforma' };
  if (w.capa !== CAPA_PRO) return { ok: false, motivo: 'plan' };
  if (w.estado !== 'activo') return { ok: false, motivo: 'pausado' };
  return { ok: true };
}

// ── Quién paga la cuenta de un cliente ─────────────────────────────────────────────────────────────────────────────

/** La clave de `app_settings` en el workspace del CLIENTE. */
export const KEY_QUIEN_PAGA = 'agency.quien_paga';

export const QUIEN_PAGA = ['agencia', 'cliente'] as const;
export type QuienPaga = (typeof QUIEN_PAGA)[number];

/** Lo guardado (o lo pedido), saneado. Lo que no se entiende es 'agencia': lo que pasaba antes de que se pudiera elegir. */
export function quienPagaDe(raw: unknown): QuienPaga {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return v === 'cliente' ? 'cliente' : 'agencia';
}

export const ROTULO_QUIEN_PAGA: Record<QuienPaga, string> = {
  agencia: 'Pagas tú',
  cliente: 'Paga tu cliente',
};

// ── Lo que la agencia cuenta al sumarse ────────────────────────────────────────────────────────────────────────────

/** La clave de `app_settings` en el workspace de la AGENCIA. */
export const KEY_PERFIL_AGENCY = 'agency.perfil';

export const CUANTOS_CLIENTES = ['1-5', '6-20', '21-50', '50+'] as const;
export const QUIEN_PAGA_HOY = ['yo', 'clientes', 'depende'] as const;

export type PerfilAgency = {
  /** Cuántos clientes maneja hoy. */
  clientes: (typeof CUANTOS_CLIENTES)[number] | null;
  /** A qué se dedican sus clientes (texto libre, corto). */
  rubro: string;
  /** Quién paga hoy las herramientas de sus clientes: sugiere el default de «¿Quién paga?» al sumar uno. */
  pagaHoy: (typeof QUIEN_PAGA_HOY)[number] | null;
  /** Cuándo se sumó. */
  desde: string | null;
};

const enLista = <T extends string>(lista: readonly T[], v: unknown): T | null =>
  typeof v === 'string' && (lista as readonly string[]).includes(v) ? (v as T) : null;

/** Lo que manda la pantalla (o lo guardado), saneado: nada de lo que no se entiende llega a la base. */
export function sanearPerfilAgency(raw: unknown): PerfilAgency {
  let o: unknown = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { o = null; } }
  const r = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
  const rubro = typeof r.rubro === 'string' ? r.rubro.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const desde = typeof r.desde === 'string' && Number.isFinite(Date.parse(r.desde)) ? r.desde : null;
  return { clientes: enLista(CUANTOS_CLIENTES, r.clientes), rubro, pagaHoy: enLista(QUIEN_PAGA_HOY, r.pagaHoy), desde };
}

/** El «¿Quién paga?» que el alta de un cliente propone primero, según lo que la agencia contó al sumarse. */
export const quienPagaSugerido = (p: Pick<PerfilAgency, 'pagaHoy'> | null): QuienPaga => (p?.pagaHoy === 'clientes' ? 'cliente' : 'agencia');

// ── El cartel de pago del cliente ──────────────────────────────────────────────────────────────────────────────────

export type PagoPendiente = { pagar: string | null; renovacion: { link: string; desde: string | null; activada: boolean } | null };

export type CartelDePago =
  | { tipo: 'primer-mes'; link: string; cerrable: false }
  | { tipo: 'renovacion'; link: string; desde: string | null; cerrable: true }
  | null;

/**
 * ¿Qué cartel ve el cliente? Sólo si paga él, si terminó su onboarding («al finalizar el onboarding de ese cliente debe
 * saltar el cartel de pago») y si hay algo que pagar. El primer mes primero, y no se cierra: es lo que habilita la cuenta.
 * La renovación, después, y se cierra: su mes ya está pagado.
 */
export function cartelDePago(p: { quienPaga: QuienPaga; onboardingTerminado: boolean; pendiente: PagoPendiente | null }): CartelDePago {
  if (p.quienPaga !== 'cliente' || !p.onboardingTerminado || !p.pendiente) return null;
  if (p.pendiente.pagar) return { tipo: 'primer-mes', link: p.pendiente.pagar, cerrable: false };
  const r = p.pendiente.renovacion;
  if (r && !r.activada) return { tipo: 'renovacion', link: r.link, desde: r.desde, cerrable: true };
  return null;
}

// ── «No puedes entrar: falta pagar su mes» (14/11/2026) ────────────────────────────────────────────────────────────
// Código Inmobiliario tocaba «Inspeccionar» en Giselle y Marcela (en pausa por su mensualidad, el corte `paga-para-entrar`) y
// entraba a /cuenta-pausada: otra pantalla, «Escribir a MaKo», y para volver, «Salir de la cuenta». Para ellos, «no puedo entrar».
// Martín: «ahí mismo debería aparecer un cartelito… no puedes entrar a inspeccionar porque te falta abonar la cuota… que sea simple
// el texto». Ahora la ruta de entrar contesta `pausa: 'falta-pagar'` SIN dar la cookie, y la fila dice el aviso donde se tocó.

/** Lo justo de un corte guardado (lib/plan-acceso-reglas.ts, `CorteGuardado`) para decidir. */
type CorteParaEntrar = { vigente: boolean; motivo: string; mensualidad?: { agenciaWs: number } | null };

/**
 * ¿Esta agencia no puede entrar a su cliente porque falta pagar su mes? Es el corte `paga-para-entrar` de SU mensualidad
 * (lib/agencia-mes.ts): la cuenta pausada, el corte vigente y de esta agencia. ⚠️ Cualquier otra pausa (la pasarela, una a mano,
 * la mensualidad de OTRA agencia) no es «falta pagar»: entra como siempre y /cuenta-pausada dice por qué.
 */
export function faltaPagarParaEntrar(p: { pausada: boolean; corte: CorteParaEntrar | null; agenciaWs: number }): boolean {
  return p.pausada && !!p.corte?.vigente && p.corte.motivo === 'paga-para-entrar' && p.corte.mensualidad?.agenciaWs === p.agenciaWs;
}

/** Lo que dice la fila de un cliente así, ANTES de tocarla (su estado). */
export const ESTADO_FALTA_PAGAR = 'Falta pagar';

/** El aviso al tocar «Inspeccionar», en la computadora: una línea, con su botón «Pagar su mes». */
export const avisoFaltaPagar = (nombre: string): string => `No puedes entrar: falta pagar el mes de ${nombre}`;

/**
 * El del teléfono, y el `error` de la ruta (que el teléfono también muestra). SIN PLATA: el teléfono no dice lo que se le debe a
 * MaKo ni ofrece pagar (T5 y ticket #94, tests/agency-telefono-94.test.ts). Pagar, en la computadora.
 */
export const avisoEnPausa = (nombre: string): string => `No puedes entrar: ${nombre} está en pausa. Se resuelve en la computadora.`;
