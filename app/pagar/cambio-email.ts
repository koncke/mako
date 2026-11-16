// =============================================================================
// cambio-email — ¿puede el comprador cambiar el email con el que entra a MaKo?
// =============================================================================
// Decisión de Martín (11/10/2026): al pagar un plan de MaKo la cuenta se crea SOLA con el email
// del pago, y en la página de retorno «se le ofrece cambiar la cuenta de Google con la que va a
// entrar». El login es sólo Google y la fila en `usuarios` ES la invitación: quien pagó con
// `juan@empresa.com` y usa Google con `juan@gmail.com` no puede entrar hasta que alguien le cambie
// el email (docs/hallazgos-planes-y-cobro.md, «Quien pague con un mail que no sea de Google…»).
//
// La ruta (app/api/pagar/email/route.ts) es PÚBLICA y se autentica sólo con el token del link, así
// que lo que habilita el cambio vive acá, puro y con test (tests/pagar-publico.test.ts). Las
// CUATRO condiciones, y por qué cada una:
//   1. El cobro está PAGADO: antes de pagar no hay cuenta que cambiar.
//   2. El alta está HECHA: la cuenta existe (no está pendiente, ni era de alguien que ya tenía una).
//   3. El usuario NUNCA ENTRÓ (`ultimo_login` null): una vez que entró, la cuenta ya es de alguien,
//      y un link reenviado no puede llevársela.
//   4. Menos de MAX_CAMBIOS_EMAIL cambios: el token no es un buscador de emails ilimitado.
//   5. Dentro de las VENTANA_CAMBIO_HORAS desde el pago (revisión adversarial del 11/10/2026): el link se
//      reenvía (el grupo de WhatsApp, un {{link_pago}}, el historial del navegador) y no vence. Sin
//      ventana, un admin que nunca entró —porque soporte le creó otro usuario a mano— quedaba para
//      siempre a un POST de que cualquiera con el link lo apuntara a su Gmail y entrara como admin.
//      Lo que queda abierto (que quien PAGA no sea el dueño de la cuenta) se cierra con un código al
//      email actual: docs/hallazgos-planes-y-cobro.md, «Lo que quedó SIN hacer».
//
//
// LA PRUEBA GRATIS TAMBIÉN (16/11/2026, Martín: «rediseña mucho mejor la parte de la thank you page de tu prueba gratis empezó…
// debería haberle llegado justamente el acceso para validar su cuenta desde el correo»). La prueba autorizada crea la cuenta sin
// pagar (el cobro sigue `pendiente`, con la suscripción `activa`, hasta el día 8: lib/cobros.ts, `altaSiCorresponde`), y estas
// condiciones pedían `pagado`: a quien empezaba la prueba —la mayoría de los que compran— la página no le ofrecía cambiar el email ni
// la ruta se lo dejaba. Ahora la condición 1 es «pagado, o la prueba autorizada», y su ventana cuenta desde que abrió el checkout
// (`created_at`: la prueba se autoriza en esos minutos). Y se puede REENVIAR el correo de acceso al mismo email
// (`motivoParaNoReenviar`): las mismas condiciones, sin gastar ninguno de los 3 cambios (la ruta le pone su propio tope).
//
// ⚠️ SIN `server-only` a propósito: lo ejecuta el test. La base la lee la ruta.

import { EMAIL_MAKO } from '@/lib/app-url';
import { emailNormalizado, emailUtilizable } from '@/lib/agencia-altas';
import { mailDeAccesoNoSalio } from '@/lib/cobros-reglas';
import { esPruebaDePlan } from '@/lib/prueba-plan-reglas';
import type { Cobro } from '@/lib/cobros-tipos';

export const MAX_CAMBIOS_EMAIL = 3;
export const VENTANA_CAMBIO_HORAS = 48;

/**
 * Lo que se contesta si el token no existe Y si el cobro no habilita el cambio: la MISMA respuesta,
 * así la ruta no sirve para saber qué links existen. Dice qué hacer, que es lo único útil para quien
 * sí tiene un link bueno.
 */
export const RESPUESTA_GENERICA = {
  status: 404,
  error: `Desde este link no se puede cambiar el email. Escríbenos a ${EMAIL_MAKO} y lo cambiamos.`,
} as const;

export type CobroParaCambio = Pick<Cobro, 'estado' | 'alta_estado' | 'alta_ws' | 'alta_email_cambios' | 'pagado_at'>
  & Partial<Pick<Cobro, 'tipo' | 'alta_capa' | 'creado_por' | 'suscripcion_estado' | 'created_at'>>;

/** La prueba gratis autorizada: el cobro sigue pendiente hasta el día 8, pero la tarjeta quedó cargada y la cuenta ya se creó. */
export const esPruebaAutorizada = (c: Partial<Pick<Cobro, 'estado' | 'tipo' | 'alta_capa' | 'creado_por' | 'suscripcion_estado'>>): boolean =>
  c.estado === 'pendiente' && c.suscripcion_estado === 'activa' && esPruebaDePlan({ tipo: c.tipo ?? '', alta_capa: c.alta_capa, creado_por: c.creado_por });
export type UsuarioDelAlta = { id: number; email: string; ultimo_login: string | null };
export type NoSePuede = { status: number; error: string };

/** El cobro, solo, ¿es de una cuenta de MaKo ya creada por un pago o por una prueba autorizada? (condiciones 1 y 2). */
export const esAltaHecha = (c: CobroParaCambio | null): boolean =>
  !!c && (c.estado === 'pagado' || esPruebaAutorizada(c)) && c.alta_estado === 'hecha' && c.alta_ws != null;

/** Cuántos cambios le quedan (para la página: si es 0, no se ofrece el formulario). */
export const cambiosRestantes = (c: Pick<Cobro, 'alta_email_cambios'>): number =>
  Math.max(0, MAX_CAMBIOS_EMAIL - (Number(c.alta_email_cambios) || 0));

/**
 * `null` = se puede cambiar. Si no, por qué, con lo que tiene que hacer la persona. El orden importa:
 * lo que no dice nada de la cuenta (genérico) va primero.
 */
/**
 * ¿Sigue abierta la ventana del cambio? Cuenta desde el pago o, en una prueba autorizada (que no tiene pago), desde que abrió el
 * checkout. Sin fecha, no (fail-closed).
 */
export function dentroDeLaVentana(c: Pick<Cobro, 'pagado_at'> & Partial<Pick<Cobro, 'estado' | 'tipo' | 'alta_capa' | 'creado_por' | 'suscripcion_estado' | 'created_at'>>, ahoraMs: number = Date.now()): boolean {
  const desde = c.pagado_at ?? (esPruebaAutorizada(c) ? c.created_at : null);
  const t = Date.parse(desde ?? '');
  return Number.isFinite(t) && ahoraMs - t <= VENTANA_CAMBIO_HORAS * 3_600_000;
}

export function motivoParaNoCambiar(c: CobroParaCambio | null, u: UsuarioDelAlta | null, ahoraMs: number = Date.now()): NoSePuede | null {
  if (!esAltaHecha(c)) return RESPUESTA_GENERICA;
  if (!dentroDeLaVentana(c!, ahoraMs)) {
    return { status: 409, error: `El email de acceso se cambia desde aquí sólo en las primeras ${VENTANA_CAMBIO_HORAS} horas. Escríbenos a ${EMAIL_MAKO} y lo cambiamos.` };
  }
  if (!u) return { status: 409, error: `No encontramos la cuenta de este pago. Escríbenos a ${EMAIL_MAKO} y lo resolvemos.` };
  if (u.ultimo_login) {
    return { status: 409, error: `Ya entraste a MaKo con esta cuenta, así que el email no se cambia desde aquí. Si necesitas otro, escríbenos a ${EMAIL_MAKO}.` };
  }
  if (cambiosRestantes(c!) <= 0) {
    return { status: 429, error: `Ya cambiaste el email ${MAX_CAMBIOS_EMAIL} veces. Escríbenos a ${EMAIL_MAKO} y lo cambiamos.` };
  }
  return null;
}

/** Lo que se contesta si el token no existe Y si el cobro no habilita reenviar: la misma respuesta, como en el cambio. */
export const RESPUESTA_GENERICA_REENVIO = {
  status: 404,
  error: `Desde este link no se puede reenviar el acceso. Escríbenos a ${EMAIL_MAKO} y te lo mandamos.`,
} as const;

/**
 * ¿Se le puede REENVIAR el correo de acceso al email que ya tiene? `null` = sí. Las condiciones del cambio salvo el tope de 3 (no
 * cambia nada: el correo va al mismo email, que es el de la cuenta). La ruta le pone su propio tope por link.
 */
export function motivoParaNoReenviar(c: CobroParaCambio | null, u: UsuarioDelAlta | null, ahoraMs: number = Date.now()): NoSePuede | null {
  if (!esAltaHecha(c)) return RESPUESTA_GENERICA_REENVIO;
  if (!dentroDeLaVentana(c!, ahoraMs)) {
    return { status: 409, error: `El acceso se reenvía desde aquí sólo en las primeras ${VENTANA_CAMBIO_HORAS} horas. Escríbenos a ${EMAIL_MAKO} y te lo mandamos.` };
  }
  if (!u) return { status: 409, error: `No encontramos la cuenta de este pago. Escríbenos a ${EMAIL_MAKO} y lo resolvemos.` };
  if (u.ultimo_login) return { status: 409, error: 'Ya entraste a MaKo con esta cuenta: entra desde hola-mako.com/login.' };
  return null;
}

/**
 * Lo que anota lib/cobros.ts (`altaSiCorresponde`) cuando termina un alta que se había cortado: el correo de acceso PUDO haber salido
 * en el primer intento (tests/pagar-publico.test.ts fija que la frase siga siendo ésta).
 */
export const MAIL_INCIERTO = 'no sé si el mail llegó';

/**
 * EL CORREO DE ACCESO, EN TRES (revisión del 16/11/2026, hallazgo 4): 'salio'; 'no-salio' (la pasarela de correo dijo que no); o
 * 'no-se' (el alta cortada que se terminó en un reintento: lib/cobros.ts lo anota como «no salió», pero dice «no sé si el mail
 * llegó»). La página de gracias decía «No pudimos mandarte el correo» también en el tercero, y el correo podía estar en su bandeja.
 */
export function correoDeAcceso(altaMotivo: string | null | undefined): 'salio' | 'no-salio' | 'no-se' {
  if (!mailDeAccesoNoSalio(altaMotivo)) return 'salio';
  return String(altaMotivo).includes(MAIL_INCIERTO) ? 'no-se' : 'no-salio';
}

/**
 * «ABRIR MI CORREO» (16/11/2026): la bandeja de entrada del proveedor de ese email, si es uno conocido. Un email de empresa no tiene
 * una dirección para abrir su bandeja: null, y la página ofrece entrar a MaKo. Sólo mira el dominio.
 */
export function bandejaDeEntrada(email: string | null | undefined): { href: string; nombre: string } | null {
  const dominio = String(email ?? '').trim().toLowerCase().split('@')[1] ?? '';
  if (/^(gmail|googlemail)\.com$/.test(dominio)) return { href: 'https://mail.google.com/mail/u/0/#inbox', nombre: 'Gmail' };
  if (/^(outlook|hotmail|live|msn)\.[a-z.]+$/.test(dominio)) return { href: 'https://outlook.live.com/mail/0/', nombre: 'Outlook' };
  if (/^(yahoo|ymail)\.[a-z.]+$/.test(dominio)) return { href: 'https://mail.yahoo.com/', nombre: 'Yahoo' };
  if (/^(icloud|me|mac)\.com$/.test(dominio)) return { href: 'https://www.icloud.com/mail', nombre: 'iCloud' };
  if (/^(proton\.me|protonmail\.com|pm\.me)$/.test(dominio)) return { href: 'https://mail.proton.me/', nombre: 'Proton' };
  return null;
}

/** El email nuevo, normalizado; o por qué no sirve. No mira la base (si otro lo usa lo mira la ruta). */
export function emailNuevoValido(crudo: unknown, actual: string): { ok: true; email: string } | { ok: false; status: number; error: string } {
  const email = typeof crudo === 'string' ? emailNormalizado(crudo) : '';
  if (!emailUtilizable(email) || email.length > 254) return { ok: false, status: 400, error: 'Ese email no es válido. Revísalo y prueba de nuevo.' };
  if (email === emailNormalizado(actual)) return { ok: false, status: 400, error: 'Ese ya es el email de tu acceso.' };
  return { ok: true, email };
}
