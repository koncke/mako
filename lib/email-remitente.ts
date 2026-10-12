// =============================================================================
// email-remitente — QUIÉN manda un email de un flujo de /automations, y QUIÉN lo firma
// =============================================================================
// Pedido de Martín (09/10/2026, cuarta tanda, punto 16): «En la opción de "De" se debería poder
// elegir el email remitente, si se tiene vinculado varios email, con el botón de vincular nuevo…
// Abajo del todo pusiste "MaKo / Si no quieres recibir más estos correos, darme de baja." eso no
// tiene sentido, es una automatización de cada cliente, no debería decir MaKo».
//
// ── Lo que se midió antes de escribir esto (09/10/2026, lectura de la base) ──
// · Un workspace tiene UN remitente: `getEmailFrom()` (lib/resend.ts) = el setting `resend_from` →
//   la credencial `RESEND_FROM` → el sandbox de Resend. No existe una lista de remitentes en ningún
//   lado: `/api/email/dominio` guarda UN dominio (`resend_domain`) y UN remitente, y «Guardar
//   remitente» lo REEMPLAZA. De los 11 workspaces, sólo el ws1 tiene `resend_from`, y es
//   «MaKo <equipo@hola-mako.com>».
// · El «MaKo» del pie NO lo escribe el render del correo: sale del NOMBRE VISIBLE de ese remitente
//   (`displayNameDe(getEmailFrom())` en el motor, `nombreDelRemitente` en la vista del editor), que
//   el render pinta como firma. En el ws1 eso dice «MaKo»; en cualquier workspace sin dominio, el
//   sandbox decía «Mauricio Bustos» — el nombre de OTRO cliente firmando el mail. (Desde el cierre del
//   punto 16 el sandbox va sin nombre: `SANDBOX_FROM` en lib/resend.ts.)
//
// ── Lo que decide este módulo ──
// · LA FIRMA del pie de un email de un cliente es el NOMBRE DEL NEGOCIO (`firmaDelPie`), nunca el
//   nombre visible del remitente. El link de baja se queda: es lo que separa un mail de un spam.
//   Los mails de la PLATAFORMA no pasan por acá: firman «MaKo» explícito (lib/invitaciones.ts,
//   lib/aviso-plan.ts) o llevan la banda (`marca: 'mako'`).
// · EL REMITENTE DE UN PASO (`paso.remitente`) es opcional: ausente = el del workspace, como
//   siempre. El motor lo usa SÓLO si es del MISMO DOMINIO que el remitente del workspace y ese no es
//   el sandbox (`remitenteDelPaso`). ⚠️ Esa regla es la que importa: la cuenta de Resend es UNA para
//   todos los clientes (Opción A, lib/resend.ts), así que cualquier dominio verificado ahí sale por
//   cualquier workspace. Sin esta guarda, un paso guardado con «hola@otrocliente.com» (o
//   «equipo@hola-mako.com») mandaría en nombre de otro. El dominio del remitente del workspace es
//   suyo: la ruta sólo deja guardar uno de su dominio verificado y con titularidad.
// · LOS VINCULADOS que ofrece el «De» salen de `/api/email/dominio`: `remitentes` si la ruta los
//   manda (hoy no: ver el relevo, «Vincular nuevo» que SUME), y si no, el único que hay.
//
// ⚠️ PURO Y SIN IMPORTS: lo usan el motor (server, lib/nutricion.ts) y el editor (`'use client'`,
//    app/automations/EditorEmailGmail.tsx). Ninguno de los dos puede importar lib/resend.ts desde el
//    navegador (lleva `server-only` por la API key), por eso el sandbox se reconoce acá con la MISMA
//    regla que `remitenteEsSandbox` (lo fija tests/email-remitente.test.ts leyendo los dos).
// =============================================================================

/** El remitente de prueba de Resend (resend.dev): sólo le entrega al dueño de la cuenta. */
const SANDBOX = /@resend\.dev>?\s*$/i;

/** ¿Es el sandbox de Resend? Con él no sale nada a un lead. */
export function esRemitenteSandbox(r: string | null | undefined): boolean {
  return typeof r === 'string' && SANDBOX.test(r.trim());
}

/** La parte local de una dirección: la MISMA lista que acepta «Guardar remitente» (/api/email/dominio). */
const LOCAL = /^[a-z0-9._%+-]{1,64}$/;
/** Un dominio: etiquetas sin guión en los bordes y un TLD que arranca con letra (la de /api/email/dominio). */
const DOMINIO = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;
/** Caracteres de control: en un encabezado `From` son inyección de encabezados. */
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * Un remitente como se puede usar en un `From`, o null: «Nombre <local@dominio>» o «local@dominio».
 * La dirección sale en minúsculas y el nombre sin `< > " , ;` ni controles (el mismo saneo que la
 * ruta le hace al nombre al guardarlo): lo que no se puede leer así no se manda.
 */
export function sanearRemitente(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > 254 || CONTROL.test(s)) return null;
  const conNombre = /^(.*?)\s*<\s*([^<>\s]+)\s*>$/.exec(s);
  const direccion = (conNombre ? conNombre[2] : s).toLowerCase();
  const arroba = direccion.lastIndexOf('@');
  if (arroba <= 0 || direccion.indexOf('@') !== arroba) return null;
  const local = direccion.slice(0, arroba);
  const dominio = direccion.slice(arroba + 1);
  if (!LOCAL.test(local) || !DOMINIO.test(dominio)) return null;
  const nombre = conNombre ? conNombre[1].replace(/^"|"$/g, '').replace(/[<>",;]/g, '').replace(/\s+/g, ' ').trim() : '';
  return nombre ? `${nombre} <${direccion}>` : direccion;
}

/** La dirección de un remitente («Ana <ana@x.com>» → «ana@x.com»), o '' si no se puede leer. */
export function direccionDe(r: unknown): string {
  const s = sanearRemitente(r);
  if (!s) return '';
  const m = /<([^>]+)>$/.exec(s);
  return m ? m[1] : s;
}

/** El dominio de un remitente, o null. */
export function dominioDe(r: unknown): string | null {
  const d = direccionDe(r);
  return d ? d.slice(d.lastIndexOf('@') + 1) : null;
}

/** «Nombre <mail>» → sus dos mitades, para dibujarlo. Un mail pelado es su propio nombre. */
export function partesDeRemitente(r: string): { nombre: string; mail: string } {
  const m = /^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/.exec(r);
  if (m) return { nombre: m[1] || m[2], mail: m[2] };
  return { nombre: r.trim(), mail: r.trim() };
}

// ── DÉCIMA TANDA, EMAIL 1 (11/10/2026): EL EMAIL DE MaKo NO ES EL DE UN CLIENTE ──────────────────
// Pedido literal de Martín: «No permitas enviar emails con los email de MaKo, ellos deben poner sus
// propios email». Medido en la base (ver arriba): el ws1 —Mauricio, un CLIENTE— tiene como remitente
// «MaKo <equipo@hola-mako.com>», así que el «De» de sus emails y el emisor de «Probar» le ofrecían el
// email de la PLATAFORMA (la captura de «Probar» decía «MaKo <equipo@hola-mako.com> → …»).
//   · Un remitente de un dominio de MaKo NO se ofrece como vinculado (`remitentesVinculados`), un paso no
//     lo usa (`remitenteDelPaso`) y no se guarda en un paso (`remitenteAGuardar`). La pantalla decía
//     «Usa tu propio email» (`AVISO_EMAIL_DE_MAKO`); desde la undécima dice `SIN_EMAIL_PROPIO` (abajo).
//   · LA EXCEPCIÓN ES LA PLATAFORMA (`plataforma`: el workspace del super admin, `wsSuperAdmin()`): ahí el
//     email de MaKo ES el suyo. La decide el SERVER (GET /api/email/dominio la manda); este módulo sólo la lee.
//     Aun así un PASO no lleva NUNCA un remitente de MaKo (`remitenteDelPaso` no lo devuelve) ni lo guarda
//     (`remitenteAGuardar`): la plataforma manda sin `from`, con el suyo de siempre.
//   · EL CORTE ESTABA EN EL ENVÍO SIN `from` (décima tanda, segunda pasada, `remitenteDeMakoFrenado`) y era
//     NEGATIVO: un `from` explícito se lo salteaba. Lo reemplaza la regla POSITIVA de la undécima
//     (`remitenteDelNegocio`, abajo), que `sendEmail` aplica a TODO mail que no habla MaKo.

/**
 * Los dominios de MaKo. `EMAIL_MAKO` (lib/app-url.ts) tiene que ser de uno de éstos: lo fija
 * tests/email-remitente.test.ts (si la plataforma cambia de dominio, la lista se queda vieja y el test lo dice).
 */
export const DOMINIOS_MAKO: readonly string[] = ['hola-mako.com', 'makodigital.app'];

/** ¿Es un dominio de MaKo (o un subdominio, como `send.hola-mako.com`)? */
export function esDominioDeMako(dominio: string | null | undefined): boolean {
  if (typeof dominio !== 'string') return false;
  const d = dominio.trim().toLowerCase().replace(/\.$/, '');
  return !!d && DOMINIOS_MAKO.some((m) => d === m || d.endsWith(`.${m}`));
}

/** ¿Este remitente es un email de MaKo? Uno ilegible no lo es (tampoco se puede usar: `sanearRemitente`). */
export function esRemitenteDeMako(r: unknown): boolean {
  return esDominioDeMako(dominioDe(r));
}

// ── UNDÉCIMA TANDA (11/10/2026): EL REMITENTE DEL NEGOCIO, POR UNA REGLA POSITIVA ─────────────────
// Decisión 3 de la décima, literal de Martín: «Quitale a Mauricio que pueda mandar email con MaKo. Nadie
// debería poder.» El corte de la décima era NEGATIVO («si es de MaKo y no es la plataforma, no sale») y lo
// miraba sólo `sendEmail` SIN `from`: un `from` explícito se lo salteaba, y cada pantalla preguntaba por su
// cuenta (`remitenteEsDeMako`, `remitenteDeMakoAjeno`, `AVISO_EMAIL_DE_MAKO`). Ahora es al revés: un mail del
// NEGOCIO sale SÓLO con un remitente que pasa `remitenteDelNegocio`, y todo lo demás (el motor, los
// broadcasts, «Probar», /integraciones, el «De», la API) lo pregunta por la MISMA puerta —`getEmailFrom()`
// devuelve el remitente que pasó o el sandbox (lib/resend.ts)—.
//
// Lo medido el 11/10/2026 (sólo lectura): el ws1 es el ÚNICO con un remitente de MaKo (`resend_from` =
// «MaKo <equipo@hola-mako.com>») y NO tiene `resend_domain`; ws10 y ws11 tienen su propia cuenta de Resend
// (`RESEND_API_KEY` y `RESEND_FROM` suyos); ws1 y ws4 tienen en su fila la key de la PLATAFORMA (la del ws4 es
// una copia de «Datos de Mau»), que no los vuelve dueños de ninguna cuenta.

/** Lo que dice la pantalla cuando el negocio no tiene un remitente propio (chip, botón, 409, motivo del medio). */
export const SIN_EMAIL_PROPIO = 'Conecta tu email';
/** El porqué, donde hay lugar para una frase (la tarjeta de /integraciones). */
export const POR_QUE_SIN_EMAIL = 'Sin tu dominio, el email no sale.';
/** Un dominio de MaKo en un negocio (al conectarlo en /email, al guardarlo como credencial, en el ping). */
export const NO_ES_TUYO = 'Ese dominio es de MaKo. Usa el de tu negocio.';

/** Lo que se lee de UN workspace para decidir su remitente. Lo lee lib/resend.ts (y el script de datos). */
export type HechosRemitente = {
  /** El setting `resend_from` (lo escribe «Guardar remitente» de /api/email/dominio). */
  resendFrom: string | null | undefined;
  /** El setting `resend_domain` del MISMO workspace: el dominio que reclamó y verificó en /email. */
  resendDominio: string | null | undefined;
  /** La credencial `RESEND_FROM` DEL CLIENTE (`credDelCliente`; nunca la del env de la plataforma). */
  credFrom: string | null | undefined;
  /** ¿Su `RESEND_API_KEY` es SUYA? Cargada en su fila Y distinta de la de la plataforma. */
  keyPropia: boolean;
  /** ¿Es el workspace de la plataforma (`wsSuperAdmin()`)? Sólo importa si el candidato es de MaKo. */
  plataforma: boolean;
};

export type MotivoSinRemitente = 'sin-remitente' | 'sandbox' | 'de-mako' | 'otro-dominio' | 'sin-cuenta-propia';

export type VeredictoRemitente =
  | { puede: true; from: string; via: 'dominio' | 'cuenta-propia' }
  | { puede: false; motivo: MotivoSinRemitente };

const hayTexto = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

/** Vía DOMINIO: el `resend_from` es de SU dominio reclamado (el de MaKo, sólo en la plataforma). null = no hay candidato. */
function porDominio(h: HechosRemitente): VeredictoRemitente | null {
  if (!hayTexto(h.resendFrom)) return null;
  const from = sanearRemitente(h.resendFrom);
  if (!from) return { puede: false, motivo: 'sin-remitente' };
  if (esRemitenteSandbox(from)) return { puede: false, motivo: 'sandbox' };
  const dominio = dominioDe(from);
  // MaKo ANTES que el dominio: el ws1 no tiene `resend_domain`, y su motivo es «de MaKo», no «otro dominio».
  if (esDominioDeMako(dominio) && !h.plataforma) return { puede: false, motivo: 'de-mako' };
  const reclamado = typeof h.resendDominio === 'string' ? h.resendDominio.trim().toLowerCase().replace(/\.$/, '') : '';
  if (!reclamado || dominio !== reclamado) return { puede: false, motivo: 'otro-dominio' };
  return { puede: true, from, via: 'dominio' };
}

/** Vía CUENTA PROPIA: la credencial `RESEND_FROM` con SU key. El de MaKo nunca, ni en la plataforma. */
function porCuentaPropia(h: HechosRemitente): VeredictoRemitente | null {
  if (!hayTexto(h.credFrom)) return null;
  const from = sanearRemitente(h.credFrom);
  if (!from) return { puede: false, motivo: 'sin-remitente' };
  if (esRemitenteSandbox(from)) return { puede: false, motivo: 'sandbox' };
  if (esRemitenteDeMako(from)) return { puede: false, motivo: 'de-mako' };
  if (!h.keyPropia) return { puede: false, motivo: 'sin-cuenta-propia' };
  return { puede: true, from, via: 'cuenta-propia' };
}

/**
 * EL REMITENTE DEL NEGOCIO, o por qué no tiene. Un mail del negocio sale SÓLO si:
 *   (a) vía DOMINIO: `resend_from` legible, no el sandbox, de SU `resend_domain` (el mismo dominio exacto), y si
 *       es de un dominio de MaKo, el workspace es la plataforma (decisión 22: hoy la plataforma no lo reclamó);
 *   (b) vía CUENTA PROPIA: la credencial `RESEND_FROM` legible, no el sandbox ni de MaKo, con SU key.
 * Primero (a), como lo leía `getEmailFrom` desde siempre. Si ninguna pasa, el motivo es el de la primera que
 * tenía candidato. ⚠️ La key del ws1 y la copia del ws4 son las de la PLATAFORMA: `keyPropia` = false.
 */
export function remitenteDelNegocio(h: HechosRemitente): VeredictoRemitente {
  const a = porDominio(h);
  if (a?.puede) return a;
  const b = porCuentaPropia(h);
  if (b?.puede) return b;
  return a ?? b ?? { puede: false, motivo: 'sin-remitente' };
}

/**
 * ¿Se puede GUARDAR este valor como credencial `RESEND_FROM`? null = sí; un texto = por qué no. Lo llama
 * `guardarCredencial` (lib/credenciales.ts) para TODO workspace: la identidad de la plataforma vive en el
 * código (`REMITENTE_MAKO`), nunca en una credencial. Mira también lo que no se puede leer como remitente
 * («a@hola-mako.com, b@x.com»): un dominio de MaKo en cualquier dirección del texto alcanza.
 */
export function problemaDeRemitenteGuardado(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  if (esRemitenteDeMako(valor)) return NO_ES_TUYO;
  for (const m of valor.matchAll(/@([a-z0-9.-]+)/gi)) if (esDominioDeMako(m[1])) return NO_ES_TUYO;
  return null;
}

/**
 * EL `From` DE UN PASO: el remitente que eligió el paso, si se puede usar; si no, null (= el del
 * workspace, como siempre). Se usa sólo si (1) se puede leer, (2) el del workspace no es el sandbox,
 * (3) es del MISMO dominio que el del workspace y (4) NO es un email de MaKo (décima tanda, EMAIL 1). Lo
 * llaman el motor al mandar y el editor al mostrar cuál queda elegido: si el dominio del negocio cambió,
 * los dos dicen lo mismo (el del workspace), sin que una pantalla prometa un remitente que el envío ya no usa.
 */
export function remitenteDelPaso(delPaso: unknown, delWorkspace: string | null | undefined): string | null {
  const paso = sanearRemitente(delPaso);
  if (!paso || !delWorkspace || esRemitenteSandbox(delWorkspace) || esRemitenteSandbox(paso)) return null;
  // ⚠️ UN EMAIL DE MaKo, NUNCA, ni siquiera el del workspace mismo. Era «sólo si es EXACTAMENTE el del
  // workspace (la plataforma eligiendo el suyo)», y eso abría un costado: en el ws1 —un cliente cuyo remitente
  // ES el de MaKo— un paso guardado con él salía con `from` EXPLÍCITO, y el corte de `sendEmail` (que mira
  // sólo lo que se manda SIN `from`) no lo veía. Con null, el paso sale con el del workspace: el mismo `From`
  // para la plataforma (que pasa el corte) y frenado para un cliente.
  if (esRemitenteDeMako(paso)) return null;
  const dPaso = dominioDe(paso);
  const dWs = dominioDe(delWorkspace);
  return dPaso && dWs && dPaso === dWs ? paso : null;
}

/**
 * Lo que contesta GET /api/email/dominio y este módulo lee. `plataforma`: el workspace es el de la
 * PLATAFORMA (el del super admin), el único que puede mandar con un email de MaKo (EMAIL 1).
 */
export type EstadoDominioEmail = { remitente?: unknown; remitentes?: unknown; sandbox?: unknown; plataforma?: unknown } | null | undefined;

/**
 * Los remitentes VINCULADOS que ofrece el «De»: el del workspace primero, y los demás que mande la
 * ruta (`remitentes`), sin repetidos y sólo los de su mismo dominio. Con el sandbox no hay ninguno
 * vinculado: el sandbox no le entrega a nadie, ofrecerlo sería ofrecer un remitente que no manda. Y
 * con un email de MaKo tampoco, salvo en la plataforma (décima tanda, EMAIL 1): ofrecerlo era ofrecerle
 * a un cliente el email de otro. (Desde la undécima la ruta ya no lo manda; esto queda de red.)
 */
export function remitentesVinculados(e: EstadoDominioEmail): string[] {
  if (!e || e.sandbox === true) return [];
  const principal = sanearRemitente(e.remitente);
  if (!principal || esRemitenteSandbox(principal)) return [];
  if (e.plataforma !== true && esRemitenteDeMako(principal)) return [];
  const dominio = dominioDe(principal);
  const otros = Array.isArray(e.remitentes) ? e.remitentes : [];
  const out: string[] = [principal];
  for (const r of otros) {
    const s = sanearRemitente(r);
    if (s && !out.includes(s) && dominioDe(s) === dominio && !esRemitenteSandbox(s)) out.push(s);
  }
  return out;
}

/**
 * Las opciones del «De» de UN paso: los vinculados, y el que el paso ya tiene guardado si todavía se
 * puede usar y no está en la lista (un remitente que se reemplazó en /email pero sigue siendo del
 * dominio del negocio). Así nunca se dibuja elegido algo que no está entre las opciones.
 */
export function opcionesDeRemitente(vinculados: readonly string[], delPaso: unknown, delWorkspace: string | null | undefined): string[] {
  const usable = remitenteDelPaso(delPaso, delWorkspace);
  return usable && !vinculados.includes(usable) ? [...vinculados, usable] : [...vinculados];
}

/**
 * Lo que GUARDA un paso de email como `remitente` (lo llama `setSecuenciaPasos`). Si quien guarda NO
 * manda el campo (`undefined`: la API por orden, /email, cualquier escritor que no sabe de esto),
 * sigue el que ya estaba: `setSecuenciaPasos` reconstruye cada paso campo por campo y lo que no viaja
 * se BORRA (la «quinta puerta», AGENTS.md). Un `null` o un '' explícitos lo sacan (= el del workspace).
 */
export function remitenteAGuardar(entrante: unknown, previo: unknown): string | null {
  const r = sanearRemitente(entrante === undefined ? previo : entrante);
  // Un email de MaKo no se guarda en un paso (décima tanda, EMAIL 1): `remitenteDelPaso` no lo usaría nunca,
  // y guardado se leería como un remitente elegido. Queda la ausencia (= el del workspace).
  return r && !esRemitenteDeMako(r) ? r : null;
}

/**
 * LA FIRMA del pie de un email de un CLIENTE: el nombre de su negocio. Nunca el nombre visible del
 * remitente (ver la cabecera: así llegaba «MaKo», o el nombre de otro cliente desde el sandbox).
 * Vacío = sin firma: no se inventa una.
 */
export function firmaDelPie(negocio: string | null | undefined): string {
  return typeof negocio === 'string' ? negocio.replace(/\s+/g, ' ').trim() : '';
}
