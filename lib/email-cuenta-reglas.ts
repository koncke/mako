// =============================================================================
// email-cuenta-reglas — CADA NEGOCIO MANDA CON SU CUENTA DE RESEND, y la guía de cómo llegar ahí (4/11/2026)
// =============================================================================
// Martín (4/11/2026): «Resend free permite hasta 3 dominios, pero eso lo trae cada user de mako». Desde ese día MaKo no
// aloja dominios de clientes en su cuenta: cada negocio crea la suya (gratis), pega su clave en MaKo y su dominio se da de
// alta en SU cuenta. La de MaKo manda sólo lo que firma MaKo (`from: REMITENTE_MAKO`). Lo que decide de quién es cada
// cosa vive en lib/email-cuenta.ts (server-only); esto es lo puro: el webhook por negocio y la guía paso a paso.
//
// Y Martín, el mismo día: «todo esto es súper importante que lo pueda hacer por API… si detecta que no tiene [Resend]
// conectado, que le vaya guiando… para que cualquier usuario lo pueda manejar desde su [Claude]». `guiaDelEmail` es esa
// guía: de los hechos medidos, en qué paso está el negocio, qué tiene que hacer AHORA (en palabras de la persona) y qué
// operación de la API sigue. La usan `estado_email` y los errores de las operaciones que dependen de un paso anterior.
//
// ⚠️ La CLAVE no se recibe por la API (lib/api-mako/areas/integraciones.def.ts: «nunca pidas una key por el chat»). La
//    guía manda a pegarla en el modal de MaKo (`/integraciones?abrir=email`, el link lo pone el código) y a volver.
//
// ⚠️ PURO Y SIN server-only: lo importan los tests.
// =============================================================================

/**
 * El secreto del webhook de la cuenta de Resend DEL NEGOCIO (su fila de `credenciales`). Con OTRO nombre que el de la
 * plataforma (`RESEND_WEBHOOK_SECRET`, el del entorno): una fila del ws1 con ese nombre se leería como el de MaKo
 * (`envCred` cae a la fila de su fuente), y el de Mauricio verificaría los eventos de todos.
 */
export const SECRETO_WEBHOOK_PROPIO = 'RESEND_WEBHOOK_SECRET_PROPIO';

/** El parámetro de la URL del webhook que dice de qué negocio es la cuenta. Lo AUTENTICA la firma con SU secreto, no el número. */
export const PARAM_CUENTA = 'cuenta';

/** Lo que escucha el webhook de un negocio: lo que maneja app/api/webhooks/resend/route.ts. */
export const EVENTOS_DEL_WEBHOOK = ['email.opened', 'email.clicked', 'email.bounced', 'email.complained', 'email.received'] as const;

/** La URL del webhook de la cuenta de un negocio. */
export function urlWebhookDeCuenta(base: string, ws: number): string {
  return `${base.replace(/\/+$/, '')}/api/webhooks/resend?${PARAM_CUENTA}=${ws}`;
}

/** El negocio que nombra `?cuenta=` (un entero positivo), o null si no vino o no se puede leer. */
export function cuentaDelPedido(valor: string | null | undefined): number | null {
  if (valor == null || !/^\d{1,9}$/.test(valor.trim())) return null;
  const n = Number(valor.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** De quién es la cuenta de correo con la que manda el negocio. */
export type EstadoCuenta =
  | 'propia'        // su clave, en su fila, distinta de la de MaKo
  | 'plataforma'    // es el workspace de la plataforma: su cuenta ES la de MaKo
  | 'sin_cuenta'    // no pegó ninguna
  | 'la_de_mako'    // la clave de su fila es la de MaKo (el ws1 de antes del 4/11, una copia de «Datos de Mau»)
  | 'no_pude_leer';

export type PasoEmail =
  | 'no_pude_leer' | 'sin_cuenta' | 'la_de_mako' | 'clave_solo_envio' | 'clave_invalida'
  | 'sin_dominio' | 'dominio_en_otra_cuenta' | 'dns_pendiente' | 'sin_seguimiento' | 'sin_remitente' | 'envio_apagado' | 'listo';

/** Lo que se MIDE de un negocio para decidir su paso. Lo arma `estadoEmail` (lib/api-mako/areas/email.helpers.ts). */
export type HechosEmail = {
  cuenta: EstadoCuenta;
  /** Lo que contestó Resend a su clave: null = no se probó (sin cuenta) o no se pudo saber. */
  clave: 'ok' | 'solo_envio' | 'invalida' | null;
  dominio: string | null;
  /** El estado del dominio en SU cuenta ('verified', 'pending', 'not_started', 'failure'…), o null. */
  estadoDominio: string | null;
  /** Hay un dominio guardado pero su cuenta dice que no lo tiene (se dio de alta en la cuenta de MaKo, antes del 4/11). */
  dominioNoEstaEnSuCuenta: boolean;
  registrosPendientes: number;
  /** Los eventos de SU cuenta llegan a MaKo (el webhook con su secreto). La plataforma usa el suyo de siempre. */
  seguimiento: boolean;
  /** El negocio tiene un remitente que pasa `remitenteDelNegocio`. */
  remitentePropio: boolean;
  envioReal: boolean;
};

export type GuiaEmail = {
  paso: PasoEmail;
  /** true sólo en 'listo'. */
  listo: boolean;
  /** Lo que la persona tiene que hacer AHORA, en sus palabras. Sin links: el link lo pone el código aparte. */
  que_hacer: string;
  /** La operación de la API que sigue (null = ninguna: lo hace la persona, o ya está). */
  siguiente: string | null;
  /** ¿Lo que falta se pega en el modal de MaKo? Entonces va `link_conectar` al lado. */
  conectar: boolean;
};

const PEGAR = 'pégala en MaKo, en Integraciones → Resend (el link va abajo). Cuando la pegues, avísame y sigo';
const CREAR_CLAVE = 'En resend.com → «API Keys» → «Create API Key», elige el permiso «Full access» y copia la clave (empieza con re_ y se ve una sola vez)';

/** EL PASO del negocio, en orden: primero lo que traba todo lo demás. Cada paso dice qué hacer y qué operación sigue. */
export function guiaDelEmail(h: HechosEmail): GuiaEmail {
  const g = (paso: PasoEmail, que_hacer: string, siguiente: string | null, conectar = false): GuiaEmail =>
    ({ paso, listo: paso === 'listo', que_hacer, siguiente, conectar });
  if (h.cuenta === 'no_pude_leer') return g('no_pude_leer', 'No pude leer la configuración de email de tu negocio. Vuelve a intentarlo en un momento.', 'estado_email');
  if (h.cuenta === 'sin_cuenta') {
    return g('sin_cuenta',
      `Tus emails salen desde TU cuenta de Resend, que es gratis. 1) Crea la cuenta en resend.com. 2) ${CREAR_CLAVE}. 3) Cópiala y ${PEGAR}.`,
      'estado_email', true);
  }
  if (h.cuenta === 'la_de_mako') {
    return g('la_de_mako',
      `La clave de Resend que tiene tu negocio es la de MaKo, no la tuya: con ella tus emails no salen. Crea tu cuenta gratis en resend.com. ${CREAR_CLAVE}, y ${PEGAR}.`,
      'estado_email', true);
  }
  if (h.clave === 'solo_envio') {
    return g('clave_solo_envio',
      `Tu clave de Resend sólo puede enviar: con ella MaKo no puede dar de alta tu dominio ni prender el seguimiento. ${CREAR_CLAVE}, y ${PEGAR} (reemplaza la que está).`,
      'estado_email', true);
  }
  if (h.clave === 'invalida') {
    return g('clave_invalida',
      `Resend dice que tu clave no es válida (la borraste o se copió mal). ${CREAR_CLAVE}, y ${PEGAR} (reemplaza la que está).`,
      'estado_email', true);
  }
  if (!h.dominio) {
    return g('sin_dominio', 'Ahora el dominio desde el que salen tus emails (por ejemplo minegocio.com). Dime cuál es y lo doy de alta en tu cuenta de Resend.', 'conectar_dominio_email');
  }
  if (h.dominioNoEstaEnSuCuenta) {
    return g('dominio_en_otra_cuenta',
      `Tu dominio ${h.dominio} no está en tu cuenta de Resend (estaba en la de MaKo). Hay que darlo de alta de nuevo en la tuya y cargar sus registros DNS nuevos.`,
      'conectar_dominio_email');
  }
  if (h.estadoDominio !== 'verified') {
    const n = h.registrosPendientes;
    return g('dns_pendiente',
      `Carga ${n > 0 ? `los ${n} registros DNS` : 'los registros DNS'} de ${h.dominio} en donde compraste tu dominio (GoDaddy, Cloudflare…), tal como los muestra registros_dns. Cuando los cargues, avísame y lo verifico: a veces tarda unas horas.`,
      'verificar_dominio_envio');
  }
  if (!h.seguimiento) {
    return g('sin_seguimiento',
      'Falta conectar el seguimiento: sin él, MaKo no se entera de quién abre, hace clic o rebota, las tarjetas no se mueven y los rebotes no frenan el envío. Lo conecto yo en tu cuenta de Resend, sin que toques nada.',
      'conectar_seguimiento_email');
  }
  if (!h.remitentePropio) {
    return g('sin_remitente', `Falta el remitente: el nombre y el correo que ven tus leads (por ejemplo Ana <hola@${h.dominio}>), y si quieres, a dónde te llegan sus respuestas.`, 'fijar_remitente_email');
  }
  if (!h.envioReal) {
    return g('envio_apagado', 'Todo listo para mandar. Falta prender el envío real: eso lo confirmas tú en MaKo.', 'activar_envio_real_email');
  }
  return g('listo', 'El email de tu negocio está listo y el envío real está prendido.', null);
}

/**
 * Lo que dice una operación que no puede correr porque falta la cuenta propia (el texto que lee la persona). Lo usan la
 * pantalla de /email y la API; la API le suma `PARA_LA_API` (la pantalla ya tiene su botón «Conectar Resend»).
 */
export function sinCuentaParaOperar(cuenta: EstadoCuenta): string {
  if (cuenta === 'no_pude_leer') return 'No pude leer la clave de correo de tu negocio. Vuelve a intentarlo en un momento.';
  if (cuenta === 'la_de_mako') return 'La clave de Resend de tu negocio es la de MaKo, no la tuya. Pega la de TU cuenta de Resend en MaKo, en Integraciones → Resend.';
  return 'Tus emails salen desde TU cuenta de Resend (es gratis) y tu negocio todavía no la conectó. Crea la cuenta en resend.com, saca una clave con permiso «Full access» y pégala en MaKo, en Integraciones → Resend.';
}

/** Lo que la API le suma a una operación que no puede seguir por la cuenta: dónde están el link y los pasos. */
export const PARA_LA_API = 'estado_email te da el link y los pasos.';
