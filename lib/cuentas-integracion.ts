// =============================================================================
// cuentas-integracion — varias cuentas por proveedor (Stripe, Mercado Pago; después Calendly y Cal.com)
// =============================================================================
// Martín, 22/10/2026 (feedback del CRM, punto 3): «que pueda tener de MP y de Stripe al mismo tiempo... e incluso que pueda
// tener varias cuentas de Stripe y MP conectadas, lo mismo que Calendly o Cal, que pueda tener varias».
//
// MEDIDO (22/10/2026, producción): `credenciales` tiene como clave primaria (workspace_id, clave). Una clave por nombre y
// por negocio: UNA cuenta por proveedor.
//
// EL MODELO. Una cuenta es un sufijo en el NOMBRE de sus claves:
//   · la principal, las de siempre, sin sufijo: `STRIPE_SECRET_KEY` (nada que migrar);
//   · las demás, `STRIPE_SECRET_KEY__C2`, `STRIPE_SECRET_KEY__C3`… con su nombre al lado (`STRIPE_ALIAS__C2`).
// El id de una cuenta es `<proveedor>:<cuenta>`: `stripe:principal`, `stripe:c2`. Es el que guarda el cobro
// (`cobros.cuenta`, mig 0328) y el que lista «Vincular cobro» (lib/cobro-etapa.ts, `CuentaPago`).
// ⚠️ Las protecciones de las claves (que no se copien al entorno ni a otro negocio, que rutean sus avisos) preguntan por
// el NOMBRE BASE (`baseDeClave`): una lista por nombre exacto deja afuera la segunda cuenta sin que nada falle
// (docs/hallazgos-integraciones.md, «Varias cuentas por pasarela»).
//
// Puro y sin `server-only`: lo leen el servidor, la pantalla de Integraciones y los tests (tests/cuentas-pago.test.ts).
// =============================================================================

export type ProveedorConCuentas = 'stripe' | 'mercadopago';

/** La cuenta de siempre: sus claves no llevan sufijo. */
export const CUENTA_PRINCIPAL = 'principal';

/** El separador del sufijo de una cuenta en el nombre de una clave. Ningún nombre de clave de MaKo lo usa para otra cosa. */
const SEP = '__';

/** Una cuenta que no es la principal: `c2`, `c3`… (la acuña MaKo, nunca la escribe nadie). */
const CUENTA_EXTRA_RE = /^c([2-9]|[1-9][0-9]{1,2})$/;

/** ¿Es un nombre de cuenta válido? La principal o una `cN` (N de 2 a 999). */
export const cuentaValida = (c: unknown): c is string => c === CUENTA_PRINCIPAL || (typeof c === 'string' && CUENTA_EXTRA_RE.test(c));

/** El nombre de una clave en una cuenta: la principal sin sufijo; las demás con `__C2`. */
export function claveDeCuenta(base: string, cuenta: string = CUENTA_PRINCIPAL): string {
  if (!cuentaValida(cuenta)) throw new Error(`Cuenta inválida: ${String(cuenta)}`);
  return cuenta === CUENTA_PRINCIPAL ? base : `${base}${SEP}${cuenta.toUpperCase()}`;
}

/** El nombre base de una clave, sin la cuenta: `STRIPE_SECRET_KEY__C2` → `STRIPE_SECRET_KEY`. */
export function baseDeClave(clave: string): string {
  const i = clave.indexOf(SEP);
  return i < 0 ? clave : clave.slice(0, i);
}

/** La cuenta de una clave: sin sufijo, la principal; con un sufijo válido, `c2`…; con uno inválido, null. */
export function cuentaDeClave(clave: string): string | null {
  const i = clave.indexOf(SEP);
  if (i < 0) return CUENTA_PRINCIPAL;
  const c = clave.slice(i + SEP.length).toLowerCase();
  return CUENTA_EXTRA_RE.test(c) ? c : null;
}

/** La próxima cuenta libre: después de la más alta que ya existe, empezando en `c2`. */
export function proximaCuenta(existentes: readonly string[]): string {
  const nums = existentes.map((c) => CUENTA_EXTRA_RE.exec(c)?.[1]).filter((x): x is string => !!x).map(Number);
  return `c${Math.max(1, ...nums) + 1}`;
}

/** El id de una cuenta: `stripe:principal`, `mercadopago:c2`. */
export const idDeCuenta = (p: ProveedorConCuentas, cuenta: string): string => `${p}:${cuenta}`;

/** El id partido; null si no es de un proveedor con cuentas o la cuenta no es válida. */
export function partirIdDeCuenta(id: unknown): { proveedor: ProveedorConCuentas; cuenta: string } | null {
  if (typeof id !== 'string') return null;
  const [p, c] = id.split(':', 2);
  if (p !== 'stripe' && p !== 'mercadopago') return null;
  return cuentaValida(c) ? { proveedor: p, cuenta: c } : null;
}

/** Las claves de una pasarela, por cuenta: la que se pega, el id de la cuenta (rutea los avisos) y el secreto del aviso. */
export const CLAVES_BASE: Readonly<Record<ProveedorConCuentas, { clave: string; identificador: string; secretoAviso: string; alias: string }>> = {
  stripe: { clave: 'STRIPE_SECRET_KEY', identificador: 'STRIPE_ACCOUNT_ID', secretoAviso: 'STRIPE_WEBHOOK_SECRET', alias: 'STRIPE_ALIAS' },
  mercadopago: { clave: 'MERCADOPAGO_ACCESS_TOKEN', identificador: 'MERCADOPAGO_USER_ID', secretoAviso: 'MERCADOPAGO_WEBHOOK_SECRET', alias: 'MERCADOPAGO_ALIAS' },
};

/** El nombre que ve la persona: el que le puso, o «Stripe» / «Stripe 2». */
export function nombreDeCuenta(p: ProveedorConCuentas, cuenta: string, alias: string | null | undefined): string {
  const a = (alias ?? '').trim();
  if (a) return a;
  const base = p === 'stripe' ? 'Stripe' : 'Mercado Pago';
  return cuenta === CUENTA_PRINCIPAL ? base : `${base} ${cuenta.slice(1)}`;
}

/**
 * Con qué cuenta de una pasarela se cobra cuando nadie la eligió: la de siempre (`porDefecto`: la principal si cobra, si
 * no la primera que cobre), salvo que el producto esté vinculado a un CRM («Vincular cobro») por OTRAS cuentas de esa
 * pasarela: entonces la primera de su vínculo que cobre. Si no, el pago saldría por una cuenta que el vínculo no tiene y
 * nunca llegaría a ese CRM (`vinculoDelPago`, lib/cobro-etapa.ts).
 */
export function cuentaSinElegir(p: ProveedorConCuentas, porDefecto: string | null, delVinculo: readonly string[], cobran: readonly string[]): string | null {
  const delV = delVinculo.map(partirIdDeCuenta).flatMap((x) => (x && x.proveedor === p ? [x.cuenta] : []));
  if (!delV.length || (porDefecto != null && delV.includes(porDefecto))) return porDefecto;
  // Si ninguna del vínculo cobra (se desconectó), ninguna: cobrar ese producto por la principal podía ser cobrarlo en la
  // cuenta de OTRA razón social (segunda revisión de plata, 22/10/2026). El link dice «no conectada».
  return delV.find((c) => cobran.includes(c)) ?? null;
}

/** Lo más largo de un nombre de cuenta. */
export const TOPE_ALIAS = 40;

/** Un nombre de cuenta limpio (sin control, espacios colapsados); '' si no queda nada. */
export function aliasLimpio(v: unknown): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TOPE_ALIAS);
}
