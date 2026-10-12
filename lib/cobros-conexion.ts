// =============================================================================
// cobros-conexion — conectar Stripe y Mercado Pago pegando UNA clave (BYOK)
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
import { asegurarWebhookStripe, leerCuentaStripe, type CuentaStripe } from './stripe-api';
import { leerCuentaMp, type CuentaMp } from './mercadopago-api';
import { NOMBRE_PASARELA, type Pasarela } from './cobros-tipos';

/** La clave que PEGA la persona en cada pasarela. El resto de los campos se deriva de esta. */
export const CLAVE_PASARELA: Readonly<Record<Pasarela, string>> = {
  stripe: 'STRIPE_SECRET_KEY',
  mercadopago: 'MERCADOPAGO_ACCESS_TOKEN',
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
export async function descubrirStripe(ws: number, key: string, autor: string | null, opts: { guardarClave: boolean } = { guardarClave: true }): Promise<ResultadoConexionPago> {
  const clave = key.trim();
  const c = await leerCuentaStripe(clave);
  if (!c.ok) return { ok: false, status: c.status === 0 ? 504 : 422, nadaGuardado: true, error: errorDeStripe(c, clave) };

  const r = await reclamarCuenta(ws, 'STRIPE_ACCOUNT_ID', c.id, 'stripe', autor);
  if (!r.ok) return ocupada('stripe');
  const guardadas = ['STRIPE_ACCOUNT_ID'];
  if (opts.guardarClave) {
    await guardar(ws, 'STRIPE_SECRET_KEY', clave, 'stripe', autor);
    guardadas.push('STRIPE_SECRET_KEY');
  }

  const w = await asegurarWebhookStripe(clave, urlAvisoStripe(c.id));
  if (!w.ok) {
    // Con otra cuenta, la firma guardada es de un aviso que ya no es de este workspace. Con la
    // misma, puede seguir valiendo (si falló al LISTAR, el aviso viejo sigue ahí): se deja.
    if (r.cambio) await borrarVieja(ws, 'STRIPE_WEBHOOK_SECRET', autor, 'firma de la cuenta de Stripe anterior');
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
  await guardar(ws, 'STRIPE_WEBHOOK_SECRET', w.secret, 'stripe', autor);
  guardadas.push('STRIPE_WEBHOOK_SECRET');

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
export async function descubrirMercadoPago(ws: number, token: string, autor: string | null, opts: { guardarClave: boolean } = { guardarClave: true }): Promise<ResultadoConexionPago> {
  const t = token.trim();
  const c = await leerCuentaMp(t);
  if (!c.ok) return { ok: false, status: c.status === 0 ? 504 : 422, nadaGuardado: true, error: errorDeMercadoPago(c) };

  const r = await reclamarCuenta(ws, 'MERCADOPAGO_USER_ID', c.id, 'mercadopago', autor);
  if (!r.ok) return ocupada('mercadopago');
  const guardadas = ['MERCADOPAGO_USER_ID'];
  if (opts.guardarClave) {
    await guardar(ws, 'MERCADOPAGO_ACCESS_TOKEN', t, 'mercadopago', autor);
    guardadas.push('MERCADOPAGO_ACCESS_TOKEN');
  }
  // La clave del aviso es de la APLICACIÓN de la cuenta vieja: con ella, cada aviso firmado de la
  // nueva se rechazaría como falso. Se borra y se pide de nuevo.
  if (r.cambio) await borrarVieja(ws, 'MERCADOPAGO_WEBHOOK_SECRET', autor, 'clave del aviso de la cuenta de Mercado Pago anterior');

  const conClave = !!(await credDelCliente('MERCADOPAGO_WEBHOOK_SECRET', ws));
  const avisos: string[] = [];
  if (c.modo === 'prueba') avisos.push('Es una cuenta de prueba: los pagos no son reales.');
  if (!conClave) avisos.push('Para las suscripciones, falta el paso del recuadro amarillo.');
  return {
    ok: true,
    // «Conectada» no exige la clave del aviso (es opcional): los cobros únicos entran sin ella.
    completa: true,
    guardadas,
    facts: factsDeMercadoPago(c, conClave),
    mensaje: ['Conectada: MaKo encontró tu cuenta.', ...avisos].join(' '),
  };
}

/** El descubrimiento de la pasarela que corresponda. */
export function descubrirPasarela(p: Pasarela, ws: number, clave: string, autor: string | null, opts: { guardarClave: boolean }): Promise<ResultadoConexionPago> {
  return p === 'stripe' ? descubrirStripe(ws, clave, autor, opts) : descubrirMercadoPago(ws, clave, autor, opts);
}
