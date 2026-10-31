// =============================================================================
// cobros-conexion — conectar Stripe, Mercado Pago y Creem pegando UNA clave (BYOK)
// =============================================================================
// La persona pega su clave en /integraciones y MaKo deriva el resto: el id de la cuenta (que rutea
// cada aviso de pago a ESTE workspace) y, en Stripe, registra el aviso en la cuenta y guarda su
// firma. Es el molde de lib/meta-conexion.ts (`guardarConexionMeta`): lo que se guarda vive aquí y
// la ruta sólo lo llama, para que un segundo consumidor (la API de MaKo, un onboarding) no tenga que
// copiar la lógica de adentro de un route.ts (docs/hallazgos-integraciones.md → «La lógica de
// credenciales vive adentro de la ruta…»).
//
// Lo que no se ve en el código y muerde:
//   · NADA SE GUARDA SI EL PROVEEDOR NO ACEPTA LA CLAVE. El tilde genérico del formulario guarda sin
//     probar cuando faltan campos obligatorios, y en una pasarela SIEMPRE faltan (los derivados no
//     existen hasta descubrirlos): por ese camino una clave rota quedaba guardada con un «Guardada.
//     Falta ID de tu cuenta para poder probarla» que mentía. Aquí la clave se guarda recién después
//     de que el proveedor la aceptó.
//   · EL ID SE RECLAMA ANTES QUE LA CLAVE. Si la cuenta ya es de otro workspace
//     (`IdentificadorOcupadoError`), no se guarda NADA: ni el id ni la clave. Eso cierra también el
//     caso de un cliente pegando la clave de cobro de MaKo como propia — la cuenta de la plataforma
//     ya está reclamada por `wsSuperAdmin()` —, sin una lista aparte (`BYOK_NUNCA_PLATAFORMA`).
//   · CAMBIAR DE CUENTA SUELTA LA VIEJA. `guardarCredencial` sólo AGREGA filas de ruteo: sin
//     `soltarIdentificador`, la cuenta anterior quedaba reclamada para siempre por un workspace que
//     ya no la usa, y sus avisos llegaban acá sin un secreto que los verifique.
//   · Las claves se leen con `credDelCliente` y con nada más (lib/cobros.ts lo cuenta; lo barre
//     tests/pasarela-sin-env.test.ts).

import 'server-only';
import { APP_BASE_URL } from './app-url';
import { auditarCredencial, credDelCliente, eliminarCredencial, guardarCredencial, IdentificadorOcupadoError } from './credenciales';
import { soltarIdentificador, upsertRouting, wsPorIdentificadorEstricto } from './webhook-routing';
import { asegurarWebhookStripe, borrarWebhooksStripe, leerCuentaStripe, modoDeClaveStripe, type CuentaStripe } from './stripe-api';
import { leerCuentaMp, type CuentaMp } from './mercadopago-api';
import { asegurarWebhookCreem, modoDeClaveCreem, probarClaveCreem } from './creem-api';
import { NOMBRE_PASARELA, type Pasarela } from './cobros-tipos';
import { CLAVES_BASE, CUENTA_PRINCIPAL, claveDeCuenta, type ProveedorConCuentas } from './cuentas-integracion';
import { cuentaDeIdentificador, cuentasDePago } from './cuentas-pago-server';

/** La clave que PEGA la persona en cada pasarela. El resto de los campos se deriva de esta. */
export const CLAVE_PASARELA: Readonly<Record<Pasarela, string>> = {
  stripe: 'STRIPE_SECRET_KEY',
  mercadopago: 'MERCADOPAGO_ACCESS_TOKEN',
  creem: 'CREEM_API_KEY',
};

/**
 * La URL del aviso de Stripe de UNA cuenta. La cuenta viaja en la URL porque el evento de una cuenta
 * directa (sin Connect) no trae `account`: es lo único que le dice al webhook de quién es antes de
 * verificar la firma (docs/diseno-pasarela-pagos.md §4.5). Es `/api/…`, así que va sin `?ws=`
 * (tests/link-con-workspace.test.ts).
 */
export const urlAvisoStripe = (acct: string): string => `${APP_BASE_URL}/api/webhooks/stripe?acct=${encodeURIComponent(acct)}`;

type Fact = { k: string; v: string; c?: string };

export type ResultadoConexionPago =
  | {
      ok: true;
      /** true = quedaron todos los campos que hacen funcionar el cobro (el aviso incluido). */
      completa: boolean;
      /** Lo que se dibuja debajo de la clave: corto, y dice lo que falta si algo quedó a medias. */
      mensaje: string;
      guardadas: string[];
      /** Los datos de la cuenta, sin plata ni datos personales (los pinta el panel negro). */
      facts: Fact[];
    }
  | {
      ok: false;
      error: string;
      status: number;
      /** true = no se escribió nada (la clave tampoco): el formulario puede decir «No la guardé». */
      nadaGuardado: boolean;
    };

// ── Los textos de error, compartidos con el ping (lib/metodo-verificar.ts) ───────────────────────

/** El fallo de Stripe al leer la cuenta, en una frase que diga qué hacer. */
export function errorDeStripe(r: { status: number; error: string }, key?: string): string {
  if (String(key ?? '').trim().startsWith('pk_')) return 'Esa es la clave publicable (pk_). La que sirve empieza con rk_ o sk_.';
  if (r.status === 0) return 'Stripe no contestó a tiempo. Prueba de nuevo.';
  if (r.status === 400) return r.error; // el formato: el mensaje ya es nuestro (lib/stripe-api.ts)
  if (r.status === 401) return 'Esa clave no es válida. Cópiala de nuevo desde Stripe.';
  // Con una clave restringida, el 403 trae en el mensaje QUÉ permiso falta: es lo único que la
  // persona tiene que ir a cambiar, así que va tal cual (en inglés, con el nombre que usa Stripe).
  if (r.status === 403) return `A la clave le falta un permiso. Stripe dice: «${r.error}»`;
  return `Stripe respondió ${r.status}: ${r.error}`;
}

export function errorDeMercadoPago(r: { status: number; error: string }): string {
  if (r.status === 0) return 'Mercado Pago no contestó a tiempo. Prueba de nuevo.';
  if (r.status === 400) return r.error;
  if (r.status === 401 || r.status === 403) return 'Ese access token no es válido. Cópialo de nuevo desde "Credenciales de producción".';
  return `Mercado Pago respondió ${r.status}: ${r.error}`;
}

// ── Los facts: cuenta, país, moneda y modo. NUNCA plata ni datos personales ──────────────────────
// La API de MaKo reusa el ping como «probar la conexión» (hallazgos-integraciones.md → «verificarServicio
// se escribió para el tilde…»): el nombre comercial puede ser el de una persona y el email lo es,
// así que la cuenta se muestra por su id.

const PAIS_DE_SITIO_MP: Record<string, string> = { MLA: 'AR', MLB: 'BR', MLM: 'MX', MLC: 'CL', MCO: 'CO', MPE: 'PE', MLU: 'UY' };

function nombrePais(codigo: string | null | undefined): string | null {
  const c = String(codigo ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  try { return new Intl.DisplayNames(['es'], { type: 'region' }).of(c) ?? c; } catch { return c; }
}

const factModo = (modo: 'real' | 'prueba'): Fact =>
  modo === 'prueba' ? { k: 'Modo', v: 'Prueba: los pagos no son reales', c: 'var(--warn)' } : { k: 'Modo', v: 'Real', c: 'var(--good)' };

export function factsDeStripe(c: CuentaStripe, conAviso: boolean): Fact[] {
  const out: Fact[] = [{ k: 'Cuenta', v: c.id }];
  const pais = nombrePais(c.pais);
  if (pais) out.push({ k: 'País', v: pais });
  if (c.moneda) out.push({ k: 'Moneda', v: c.moneda });
  out.push(factModo(c.modo));
  if (!c.cobrosHabilitados) out.push({ k: 'Cobros', v: 'Falta activar la cuenta en Stripe', c: 'var(--warn)' });
  out.push(conAviso
    ? { k: 'Aviso de pagos', v: 'Registrado por MaKo', c: 'var(--good)' }
    : { k: 'Aviso de pagos', v: 'Falta registrarlo', c: 'var(--warn)' });
  return out;
}

export function factsDeMercadoPago(c: CuentaMp, conClaveDelAviso: boolean): Fact[] {
  const out: Fact[] = [{ k: 'Cuenta', v: c.id }];
  const pais = nombrePais(PAIS_DE_SITIO_MP[c.sitio ?? '']);
  if (pais) out.push({ k: 'País', v: pais });
  if (c.moneda) out.push({ k: 'Moneda', v: c.moneda });
  out.push(factModo(c.modo));
  out.push(conClaveDelAviso
    ? { k: 'Aviso de suscripciones', v: 'Configurado', c: 'var(--good)' }
    : { k: 'Aviso de suscripciones', v: 'Falta la clave secreta', c: 'var(--warn)' });
  return out;
}

// ── Guardar campo por campo, auditando ───────────────────────────────────────────────────────────

async function guardar(ws: number, env: string, valor: string, servicio: Pasarela, autor: string | null): Promise<void> {
  await guardarCredencial(ws, env, valor, servicio, autor);
  await auditarCredencial(ws, env, 'guardar', autor);
}

/**
 * Reclama el id de la cuenta. `false` si ya es de OTRO workspace (auditado como rechazo); en ese
 * caso no se escribió nada. Si el workspace tenía OTRA cuenta, la suelta.
 */
async function reclamarCuenta(ws: number, env: string, id: string, servicio: Pasarela, autor: string | null): Promise<{ ok: boolean; cambio: boolean }> {
  const previo = await credDelCliente(env, ws);
  try {
    await guardar(ws, env, id, servicio, autor);
  } catch (e) {
    if (e instanceof IdentificadorOcupadoError) {
      await auditarCredencial(ws, env, 'guardar', autor, { permitido: false, motivo: 'identificador ya reclamado por otro workspace' });
      return { ok: false, cambio: false };
    }
    throw e;
  }
  // ⚠️ QUE LA FILA DE RUTEO EXISTA DE VERDAD (revisión del 11/10/2026). `guardarCredencial` guarda la credencial
  // aunque `upsertRouting` devuelva 'error' (la idea era re-sembrarla en el boot, y eso sólo cubre al ws1): con un
  // corte justo al conectar, la tarjeta decía «Conectada», cada aviso daba 401 y el cron no veía ese workspace
  // (lee `webhook_routing`). Se reintenta una vez; si no queda, se deshace y se dice.
  if ((await wsPorIdentificadorEstricto(servicio, id)) !== ws && (await upsertRouting(servicio, id, ws)) !== 'ok') {
    await eliminarCredencial(ws, env).catch(() => {});
    throw new Error(`No pude registrar la cuenta de ${NOMBRE_PASARELA[servicio]} para recibir sus pagos. Prueba de nuevo en un momento.`);
  }
  const cambio = !!previo && previo !== id;
  if (cambio) await soltarIdentificador(servicio, previo!, ws);
  return { ok: true, cambio };
}

/**
 * ¿Esta cuenta del proveedor ya está conectada en ESTE negocio como OTRA de sus cuentas? Dos cuentas de MaKo con el mismo
 * `acct_…` compartirían los avisos y los cobros se releerían con las claves de la primera. Se dice con su nombre.
 */
async function yaConectadaComoOtra(ws: number, p: ProveedorConCuentas, id: string, cuenta: string): Promise<ResultadoConexionPago | null> {
  const otra = await cuentaDeIdentificador(ws, p, id);
  if (!otra || otra === cuenta) return null;
  const nombre = (await cuentasDePago(ws, p)).find((x) => x.cuenta === otra)?.nombre ?? NOMBRE_PASARELA[p];
  return { ok: false, status: 409, nadaGuardado: true, error: `Esa cuenta de ${NOMBRE_PASARELA[p]} ya está conectada aquí como «${nombre}».` };
}

const ocupada = (servicio: Pasarela): ResultadoConexionPago => ({
  ok: false,
  status: 409,
  nadaGuardado: true,
  error: `Esa cuenta de ${NOMBRE_PASARELA[servicio]} ya está conectada en otro espacio de MaKo. Si es tuya, quítala de ahí primero.`,
});

/** Borra una credencial que quedó de OTRA cuenta (su firma ya no verifica nada). */
async function borrarVieja(ws: number, env: string, autor: string | null, motivo: string): Promise<void> {
  if (!(await credDelCliente(env, ws))) return;
  await eliminarCredencial(ws, env);
  await auditarCredencial(ws, env, 'borrar', autor, { motivo });
}

// ── Stripe ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Lee la cuenta con `key`, reclama su id, guarda la clave (si `guardarClave`) y registra el aviso
 * de pagos en la cuenta, guardando su firma.
 *
 * Si Stripe no acepta la clave o la cuenta es de otro workspace, no guarda NADA. Si la clave sirve
 * pero el aviso no se pudo registrar (le falta el permiso de Webhook Endpoints, típicamente), la
 * clave y la cuenta quedan y el resultado dice qué falta: «conectada» no se pinta hasta que esté.
 *
 * ⚠️ El `whsec_` vuelve SÓLO al crear el aviso, así que cada llamada borra el nuestro y crea otro
 * (asegurarWebhookStripe): la firma cambia cada vez. Es lo que permite volver a conectar después de
 * una mudanza de dominio, y por eso este paso no se saltea aunque la firma ya esté guardada.
 */
export async function descubrirStripe(ws: number, key: string, autor: string | null, opts: { guardarClave: boolean; cuenta?: string } = { guardarClave: true }): Promise<ResultadoConexionPago> {
  const clave = key.trim();
  // La cuenta (varias por proveedor, 22/10/2026): la principal, sin sufijo; las demás con `__C2` (lib/cuentas-integracion.ts).
  const k = (base: string) => claveDeCuenta(base, opts.cuenta ?? CUENTA_PRINCIPAL);
  const c = await leerCuentaStripe(clave);
  if (!c.ok) return { ok: false, status: c.status === 0 ? 504 : 422, nadaGuardado: true, error: errorDeStripe(c, clave) };
  const repetida = await yaConectadaComoOtra(ws, 'stripe', c.id, opts.cuenta ?? CUENTA_PRINCIPAL);
  if (repetida) return repetida;
  // ⚠️ UNA CLAVE DE PRUEBA NO PISA A UNA REAL (revisión del 23/10/2026). Hay UNA firma por cuenta (STRIPE_WEBHOOK_SECRET) y
  // dos avisos en Stripe (el real y el de prueba), cada uno con la suya: pegar sk_test encima de sk_live guardaba la firma del
  // de prueba, y desde ahí cada pago, renovación y devolución REAL daba 401 hasta volver a la clave real (que además borra el
  // aviso real con sus reintentos). Para probar con una cuenta que ya cobra en vivo, se desconecta antes, a propósito.
  if (opts.guardarClave && c.modo === 'prueba' && modoDeClaveStripe(await credDelCliente(k('STRIPE_SECRET_KEY'), ws)) === 'real') {
    return {
      ok: false, status: 409, nadaGuardado: true,
      error: 'Ya cobras en vivo con Stripe aquí: una clave de prueba encima rompería los avisos de los pagos reales. Para probar, desconecta Stripe primero.',
    };
  }

  const r = await reclamarCuenta(ws, k('STRIPE_ACCOUNT_ID'), c.id, 'stripe', autor);
  if (!r.ok) return ocupada('stripe');
  const guardadas = [k('STRIPE_ACCOUNT_ID')];
  if (opts.guardarClave) {
    await guardar(ws, k('STRIPE_SECRET_KEY'), clave, 'stripe', autor);
    guardadas.push(k('STRIPE_SECRET_KEY'));
  }

  const w = await asegurarWebhookStripe(clave, urlAvisoStripe(c.id));
  if (!w.ok) {
    // Con otra cuenta, la firma guardada es de un aviso que ya no es de este workspace. Con la
    // misma, puede seguir valiendo (si falló al LISTAR, el aviso viejo sigue ahí): se deja.
    if (r.cambio) await borrarVieja(ws, k('STRIPE_WEBHOOK_SECRET'), autor, 'firma de la cuenta de Stripe anterior');
    const e = errorDeStripe(w).replace(/[.\s»]*$/, (m) => (m.includes('»') ? '».' : '.'));
    // Va después de dos puntos: minúscula, salvo que arranque con la marca.
    const motivo = e.startsWith('Stripe') ? e : e.charAt(0).toLowerCase() + e.slice(1);
    return {
      ok: true,
      completa: false,
      guardadas,
      facts: factsDeStripe(c, false),
      mensaje: `Guardada, pero no pude registrar el aviso de pagos: ${motivo} Sin el aviso, los pagos no entran a tu CRM.`,
    };
  }
  await guardar(ws, k('STRIPE_WEBHOOK_SECRET'), w.secret, 'stripe', autor);
  guardadas.push(k('STRIPE_WEBHOOK_SECRET'));

  const avisos: string[] = [];
  if (c.modo === 'prueba') avisos.push('Es una clave de prueba: los pagos no son reales.');
  if (!c.cobrosHabilitados) avisos.push('Tu cuenta todavía no puede cobrar: termina de activarla en Stripe.');
  return {
    ok: true,
    completa: true,
    guardadas,
    facts: factsDeStripe(c, true),
    mensaje: ['Conectada: MaKo encontró tu cuenta y registró el aviso de pagos.', ...avisos].join(' '),
  };
}

// ── Mercado Pago ─────────────────────────────────────────────────────────────────────────────────

/**
 * Lee la cuenta con `token`, reclama su id y guarda el token (si `guardarClave`). No registra nada
 * en Mercado Pago: la clave secreta del aviso sólo existe en su panel (no hay API para leerla), así
 * que ese paso lo hace la persona (el `pasoExterno` del catálogo).
 */
export async function descubrirMercadoPago(ws: number, token: string, autor: string | null, opts: { guardarClave: boolean; cuenta?: string } = { guardarClave: true }): Promise<ResultadoConexionPago> {
  const t = token.trim();
  const k = (base: string) => claveDeCuenta(base, opts.cuenta ?? CUENTA_PRINCIPAL);
  const c = await leerCuentaMp(t);
  if (!c.ok) return { ok: false, status: c.status === 0 ? 504 : 422, nadaGuardado: true, error: errorDeMercadoPago(c) };
  const repetida = await yaConectadaComoOtra(ws, 'mercadopago', c.id, opts.cuenta ?? CUENTA_PRINCIPAL);
  if (repetida) return repetida;

  const r = await reclamarCuenta(ws, k('MERCADOPAGO_USER_ID'), c.id, 'mercadopago', autor);
  if (!r.ok) return ocupada('mercadopago');
  const guardadas = [k('MERCADOPAGO_USER_ID')];
  if (opts.guardarClave) {
    await guardar(ws, k('MERCADOPAGO_ACCESS_TOKEN'), t, 'mercadopago', autor);
    guardadas.push(k('MERCADOPAGO_ACCESS_TOKEN'));
  }
  // La clave del aviso es de la APLICACIÓN de la cuenta vieja: con ella, cada aviso firmado de la
  // nueva se rechazaría como falso. Se borra y se pide de nuevo.
  if (r.cambio) await borrarVieja(ws, k('MERCADOPAGO_WEBHOOK_SECRET'), autor, 'clave del aviso de la cuenta de Mercado Pago anterior');

  const conClave = !!(await credDelCliente(k('MERCADOPAGO_WEBHOOK_SECRET'), ws));
  const avisos: string[] = [];
  if (c.modo === 'prueba') avisos.push('Es una cuenta de prueba: los pagos no son reales.');
  // El recuadro amarillo es de la tarjeta de la principal; el de una cuenta de más está en su fila (CuentasDePago).
  if (!conClave) avisos.push((opts.cuenta ?? CUENTA_PRINCIPAL) === CUENTA_PRINCIPAL ? 'Para las suscripciones, falta el paso del recuadro amarillo.' : 'Para sus suscripciones, falta su aviso: está en su fila.');
  return {
    ok: true,
    // «Conectada» no exige la clave del aviso (es opcional): los cobros únicos entran sin ella.
    completa: true,
    guardadas,
    facts: factsDeMercadoPago(c, conClave),
    mensaje: ['Conectada: MaKo encontró tu cuenta.', ...avisos].join(' '),
  };
}

// ── Creem ────────────────────────────────────────────────────────────────────────────────────────

/**
 * La URL del aviso de Creem de UNA cuenta. ⚠️ No lleva el identificador al registrarla, porque el identificador ES el
 * id que Creem le da al endpoint: primero se registra con la URL pelada, Creem devuelve `wh_…`, y el ruteo se hace con
 * ese id. El webhook lo lee del `?w=`, y `asegurarWebhookCreem` se lo escribe a la URL guardada en Creem con un PATCH.
 */
export const urlAvisoCreem = (): string => `${APP_BASE_URL}/api/webhooks/creem`;

export function factsDeCreem(c: { modo: 'real' | 'prueba' }, webhookId: string | null, conAviso: boolean): Fact[] {
  const out: Fact[] = [];
  if (webhookId) out.push({ k: 'Aviso', v: webhookId });
  out.push({ k: 'Moneda', v: 'USD' });
  // Lo que distingue a Creem de las otras dos, y la razón por la que existe acá: se hace cargo del impuesto.
  out.push({ k: 'Impuestos', v: 'Los cobra y los paga Creem (merchant of record)', c: 'var(--good)' });
  // El costo REAL sobre el ticket de MaKo, no el porcentaje suelto: en US$47 el cargo fijo pesa más que el 3,9%.
  out.push({ k: 'Comisión', v: '3,9% + US$0,40 (sobre el total con impuesto)' });
  out.push(factModo(c.modo));
  out.push(conAviso
    ? { k: 'Aviso de pagos', v: 'Registrado por MaKo', c: 'var(--good)' }
    : { k: 'Aviso de pagos', v: 'Falta registrarlo', c: 'var(--warn)' });
  return out;
}

/**
 * Conecta Creem: prueba la clave, registra el aviso de pagos en la cuenta, y guarda el id del aviso (que es el
 * identificador de ruteo) y su secreto.
 *
 * ⚠️ EL ORDEN ES AL REVÉS QUE EN STRIPE Y EN MERCADO PAGO, y hay un motivo. Los otros dos primero leen QUIÉN es la
 * cuenta (`GET /v1/account`, `GET /users/me`) y después registran el aviso. Creem NO TIENE ningún endpoint que diga de
 * quién es una clave, así que no hay identificador para reclamar hasta DESPUÉS de registrar el aviso: el `wh_…` que
 * devuelve Creem es lo único estable y propio de esa cuenta que MaKo puede conocer. Por eso:
 *   1. se prueba la clave (una lectura inofensiva: `/products/search`),
 *   2. se registra (o se reusa) el aviso y se pide su secreto,
 *   3. recién ahí se reclama el `wh_…` como identificador de ruteo,
 *   4. y al final se guardan la clave y el secreto.
 *
 * ⚠️ SIN SECRETO NO SE CONECTA. En Stripe, si el aviso no se puede registrar, la clave queda guardada y la tarjeta dice
 * qué falta. Acá no: el webhook de Creem es FAIL-CLOSED (sin secreto rechaza todo), así que una cuenta con la clave
 * guardada y sin secreto no sería «a medias», sería una cuenta que no puede cobrar nada y que encima se vería
 * conectada. Se devuelve el error y no queda nada guardado.
 */
export async function descubrirCreem(ws: number, key: string, autor: string | null, opts: { guardarClave: boolean; cuenta?: string } = { guardarClave: true }): Promise<ResultadoConexionPago> {
  const clave = key.trim();
  const k = (base: string) => claveDeCuenta(base, opts.cuenta ?? CUENTA_PRINCIPAL);

  // 1. ¿La clave sirve? El modo sale del PREFIJO (`creem_test_…`), que es lo único que lo dice.
  const prueba = await probarClaveCreem(clave);
  if (!prueba.ok) {
    return { ok: false, status: prueba.status === 0 ? 504 : 422, nadaGuardado: true, error: prueba.error };
  }
  // Una clave de prueba no pisa a una real: hay UN secreto de aviso por cuenta, y el de prueba dejaría todos los
  // avisos REALES rebotando con 401 (el mismo razonamiento, y el mismo incidente, que en Stripe el 23/10/2026).
  if (opts.guardarClave && prueba.modo === 'prueba' && modoDeClaveCreem(await credDelCliente(k('CREEM_API_KEY'), ws)) === 'real') {
    return {
      ok: false, status: 409, nadaGuardado: true,
      error: 'Ya cobras en vivo con Creem aquí: una clave de prueba encima rompería los avisos de los pagos reales. Para probar, desconecta Creem primero.',
    };
  }

  // 2. El aviso y su secreto. Esto es lo que da el identificador.
  const w = await asegurarWebhookCreem(clave, urlAvisoCreem());
  if (!w.ok) {
    return {
      ok: false, status: w.status === 0 ? 504 : 422, nadaGuardado: true,
      error: `La clave sirve, pero no pude registrar el aviso de pagos en Creem: ${w.error} Sin el aviso, ningún pago entraría a tu CRM, así que no guardé nada.`,
    };
  }
  if (!w.secreto) {
    return { ok: false, status: 422, nadaGuardado: true, error: 'Creem no me dio el secreto del aviso. Sin él no puedo verificar tus pagos, así que no guardé nada.' };
  }

  // 3. ¿Ese aviso ya está conectado acá como otra cuenta, o en otro espacio de MaKo?
  const repetida = await yaConectadaComoOtra(ws, 'creem', w.id, opts.cuenta ?? CUENTA_PRINCIPAL);
  if (repetida) return repetida;
  const r = await reclamarCuenta(ws, k('CREEM_WEBHOOK_ID'), w.id, 'creem', autor);
  if (!r.ok) return ocupada('creem');

  // 4. La clave y el secreto.
  const guardadas = [k('CREEM_WEBHOOK_ID')];
  if (opts.guardarClave) {
    await guardar(ws, k('CREEM_API_KEY'), clave, 'creem', autor);
    guardadas.push(k('CREEM_API_KEY'));
  }
  await guardar(ws, k('CREEM_WEBHOOK_SECRET'), w.secreto, 'creem', autor);
  guardadas.push(k('CREEM_WEBHOOK_SECRET'));

  const avisos: string[] = [];
  if (prueba.modo === 'prueba') avisos.push('Es una clave de prueba: los pagos no son reales.');
  return {
    ok: true,
    completa: true,
    guardadas,
    facts: factsDeCreem({ modo: prueba.modo }, w.id, true),
    mensaje: ['Conectada: MaKo registró el aviso de pagos en tu cuenta de Creem.', ...avisos].join(' '),
  };
}

/** El descubrimiento de la pasarela que corresponda. */
export function descubrirPasarela(p: Pasarela, ws: number, clave: string, autor: string | null, opts: { guardarClave: boolean; cuenta?: string }): Promise<ResultadoConexionPago> {
  // ⚠️ `switch` con `never`, no un ternario (31/10/2026). Escrito como `p === 'stripe' ? stripe : mercadopago`, la
  // tercera pasarela mandaba su clave a la API de MERCADO PAGO, que la rechazaba, y la pantalla decía «Mercado Pago:
  // …» mientras la persona creía estar conectando Creem. O sea: conectar Creem era imposible, y el error mentía.
  switch (p) {
    case 'stripe': return descubrirStripe(ws, clave, autor, opts);
    case 'mercadopago': return descubrirMercadoPago(ws, clave, autor, opts);
    case 'creem': return descubrirCreem(ws, clave, autor, opts);
    default: {
      const _x: never = p;
      return Promise.resolve({ ok: false, status: 400, nadaGuardado: true, error: `No sé conectar ${String(_x)}.` });
    }
  }
}

/** Los campos de cada pasarela, en el orden en que se borran (la clave pegada, al final). */
export const CAMPOS_PASARELA: Readonly<Record<Pasarela, readonly string[]>> = {
  stripe: ['STRIPE_WEBHOOK_SECRET', 'STRIPE_ACCOUNT_ID', 'STRIPE_SECRET_KEY'],
  mercadopago: ['MERCADOPAGO_WEBHOOK_SECRET', 'MERCADOPAGO_USER_ID', 'MERCADOPAGO_ACCESS_TOKEN'],
  creem: ['CREEM_WEBHOOK_SECRET', 'CREEM_WEBHOOK_ID', 'CREEM_API_KEY'],
};

/**
 * DESCONECTAR del todo (revisión del 11/10/2026: «quitar la clave no suelta la cuenta»). Borrar sólo la clave
 * pegada dejaba guardados la cuenta, su fila de ruteo y la firma del aviso: al conectar esa misma cuenta en
 * otro workspace salía «quítala de ahí primero», y desde la pantalla no había cómo (los derivados no se ven).
 * Y en Stripe el aviso quedaba registrado en la cuenta del negocio, apuntando a un MaKo que ya no lo acepta:
 * Stripe reintenta tres días y le manda mails de fallo.
 *
 * Así: primero, con la clave todavía guardada, se saca el aviso de MaKo de la cuenta de Stripe (si falla, se
 * desconecta igual y se dice); después se borran los TRES campos — al borrar el id de la cuenta se va su fila
 * de ruteo (`eliminarCredencial`, ROUTING_CREDS). En Mercado Pago el aviso vive en el panel del negocio: se le
 * dice que lo quite ahí.
 */
export async function desconectarPasarela(ws: number, p: Pasarela, autor: string | null, cuenta: string = CUENTA_PRINCIPAL): Promise<{ ok: true; aviso: string | null }> {
  // UNA cuenta (varias por proveedor, 22/10/2026): sus campos, su aviso y su fila de ruteo; las otras cuentas quedan.
  const k = (base: string) => claveDeCuenta(base, cuenta);
  let aviso: string | null = null;
  if (p === 'stripe') {
    const [key, acct] = await Promise.all([credDelCliente(k('STRIPE_SECRET_KEY'), ws), credDelCliente(k('STRIPE_ACCOUNT_ID'), ws)]);
    if (key && acct) {
      const r = await borrarWebhooksStripe(key, urlAvisoStripe(acct));
      if (!r.ok) {
        console.warn(`[cobros-conexion] ws ${ws}: no se pudo borrar el aviso de Stripe: ${errorDeStripe(r, key)}`);
        aviso = 'Borra el aviso de MaKo en Stripe → Webhooks.';
      }
    }
  } else if (p === 'creem') {
    // El aviso queda registrado en la cuenta de Creem apuntando a un MaKo que ya no lo acepta (401 por falta de secreto), y
    // ⚠️ NO SE PIDE BORRARLO: su `wh_…` es la identidad de la cuenta en sus cobros (`cuenta_ref`). Borrado, al volver a conectar
    // nace otro id y sus suscripciones quedan huérfanas: sin claves y con los avisos ignorados, mientras Creem les sigue cobrando.
    aviso = 'Deja el aviso de MaKo en Creem: si vuelves a conectar esta cuenta, tus cobros siguen atados a él.';
  } else {
    aviso = 'Quita la URL de MaKo en Mercado Pago → Webhooks.';
  }
  // Los campos de ESA cuenta, y su nombre (`…_ALIAS`): una cuenta desconectada no deja nada que la nombre.
  for (const env of [...CAMPOS_PASARELA[p], CLAVES_BASE[p].alias].map(k)) {
    const habia = await credDelCliente(env, ws);
    // Se borra AUNQUE no se lea: una fila que no descifra, o un ruteo sin su fila, también atan la cuenta.
    await eliminarCredencial(ws, env);
    if (habia) await auditarCredencial(ws, env, 'borrar', autor);
  }
  return { ok: true, aviso };
}
