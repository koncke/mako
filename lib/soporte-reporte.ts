// =============================================================================
// «Reportar a Soporte» — lo que viaja de un error que vio la persona a su Ticketera (23/10/2026)
// =============================================================================
// Martín (22/10/2026): «en toda la app, SIEMPRE que sale un error, en donde sea, debe aparecer el botón de "Reportar a
// Soporte" y que cuando lo apreten se mande automático un mensaje aquí [la Ticketera] reportando solo lo que pasó». El botón
// es UNO (app/_ui/ReportarASoporte.tsx) y lo exige tests/reportar-a-soporte.test.ts en cada aviso de error de la app.
//
// ⚠️ SÓLO LO QUE PASÓ: la pantalla (su ruta sin valores ni tokens), el último botón que tocó, el mensaje de error que vio, la
//    hora y su zona. NUNCA el resto de la pantalla (los leads, sus mensajes), y nada de lo que se manda elige DE QUIÉN es el
//    ticket: el workspace y el email salen de la SESIÓN, en el servidor (app/api/soporte/reportar/route.ts).
// ⚠️ SIN CLAVES NI DATOS: todo texto pasa por `sinSecretos` (tokens, claves de API, «Bearer …», «Authorization: …», la query
//    de un link), por `sinDatos` (emails, teléfonos, lo citado: lib/errores-app-reglas.ts) y por `sinNombres` (los nombres
//    propios: «No pude mover a Roberto Pérez» → «… a «…»»). Se sanea OTRA VEZ en el servidor: lo del navegador nunca es limpio.
// ⚠️ EL TEXTO LO PUEDE ESCRIBIR CUALQUIERA CON SESIÓN (un POST a mano), así que NO es «el error que registró el código»: va
//    en el detalle del ticket y NO en `contexto.error`, que el triage lee como la señal fuerte de un bug evidente y manda al
//    arreglo automático (la revisión de privacidad del 23/10/2026: con eso, un cliente podía hacerle llegar texto suyo al
//    Cerebro como si lo hubiera visto el sistema, y gastar los arreglos del día).
// ⚠️ UNA VEZ POR DÍA EL MISMO ERROR: la `ref` es la huella de la persona, la pantalla (como patrón) y el mensaje, con el día.
//    El segundo toque devuelve el mismo ticket, no uno nuevo.
// ⚠️ PURO (sin `server-only`): lo usan el botón, la ruta y los tests.

import { rutaPatron, rutaSinDatos, sinDatos } from './errores-app-reglas';
import { tituloDe as tituloDeLaTab } from './titulo-tab';

/** Lo que dice el botón, y lo que dice después: las mismas palabras en toda la app. */
export const ROTULO_REPORTAR = 'Reportar a Soporte';
export const ROTULO_MANDADO = 'Lo mandamos al equipo';
export const RUTA_REPORTAR = '/api/soporte/reportar';
/**
 * La del ALUMNO de un curso (27/10/2026): no tiene sesión de MaKo, así que manda el token de su portal en el cuerpo
 * (app/api/compartido/curso/soporte/route.ts). El reporte le llega al DUEÑO del curso, en su Ticketera.
 */
export const RUTA_REPORTAR_ALUMNO = '/api/compartido/curso/soporte';
/** Lo más que se lee de un aviso: un error es una frase, no la pantalla. */
export const TOPE_ERROR = 300;
export const TOPE_ACCION = 60;
export const TOPE_BYTES = 4_000;

const corta = (v: unknown, n: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');

/**
 * Saca lo que puede ser una clave: un JWT; «Authorization: …» y «Cookie: …»; «Bearer/Basic/Token …»; cualquier «…token=…»,
 * «client_secret: …», «password es …»; las claves con prefijo conocido (sk-, AIza, EAA… de Meta, ya29. de Google, ghp_, whsec_,
 * sb_…); la query de un link (donde viajan los tokens de un OAuth) y todo token largo. Va ANTES de `sinDatos`.
 * Un token corto sin prefijo ni nombre no se reconoce: por eso el reporte es una frase, nunca un volcado.
 */
export function sinSecretos(texto: string): string {
  return texto
    .replace(/\beyJ[\w-]{6,}\.[\w-]{6,}\.[\w-]{6,}/g, '«clave»')
    .replace(/\b(Proxy-Authorization|Authorization|Set-Cookie|Cookie)\s*:\s*\S+(?:\s+\S+)?/gi, '$1: «clave»')
    .replace(/\b(Bearer)\s+\S+/gi, '$1 «clave»')
    .replace(/\b(Basic|Token)\s+[A-Za-z0-9._~+/=-]{6,}/g, '$1 «clave»')
    .replace(/\b(\w*(?:token|secret|key|pass(?:word)?|pwd|auth|cookie|session|code|sig(?:nature)?|clave|contrase[nñ]a)\w*)\s*[:=]\s*\S+/gi, '$1=«clave»')
    .replace(/\b(password|contrase[nñ]a|clave)\s+(es|is)\s+\S+/gi, '$1 $2 «clave»')
    .replace(/\b(?:sk|pk|rk|sbp?|sb_secret|ghp|gho|github_pat|xox[abp]|whsec|AIza|EAA[A-Za-z0-9]|ya29)[-_.A-Za-z0-9]{10,}/g, '«clave»')
    .replace(/(https?:\/\/[^\s?#«»"']+)[?#][^\s«»"']*/gi, '$1')
    .replace(/\b[A-Za-z0-9+/_-]{32,}={0,2}/g, '«clave»');
}

/** Las palabras con mayúscula que NO son un nombre: la marca, las tabs y los servicios que nombra un error. */
const PALABRAS_DE_MAKO = new Set([
  'MaKo', 'Ops', 'Center', 'Second', 'Brain', 'CRM', 'Dashboard', 'General', 'Automations', 'Web', 'Generator', 'Image', 'Video',
  'Editor', 'Offer', 'Clients', 'Calendar', 'Plan', 'Ads', 'Manager', 'Writer', 'Analyst', 'Ticketera', 'Soporte', 'Today', 'Sales',
  'Marketing', 'Create', 'Meta', 'Google', 'WhatsApp', 'Instagram', 'Facebook', 'Gmail', 'Drive', 'Sheets', 'Stripe', 'Mercado',
  'Pago', 'Resend', 'Calendly', 'Fathom', 'OpenAI', 'ChatGPT', 'Claude', 'Anthropic', 'Gemini', 'Groq', 'Supabase', 'Vercel',
  'Chrome', 'Safari', 'Firefox', 'Android', 'iPhone', 'Excel', 'Pixel', 'Business', 'Zoom', 'Panda',
]);
/** Con las que empieza una frase de error: no son un nombre aunque las siga algo tapado («El «…» no se guardó»). */
const COMUNES = new Set(['El', 'La', 'Los', 'Las', 'Un', 'Una', 'No', 'Se', 'Tu', 'Su', 'Hay', 'Para', 'Con', 'En', 'De', 'Al', 'Del', 'Lo', 'Le', 'Ya', 'Sin', 'Error', 'Falló', 'Ups', 'Mover', 'Abrir', 'Guardar', 'Mandar', 'Borrar', 'Editar']);
const quitarBordes = (w: string) => w.replace(/^[«"“'(¿¡]+|[»"”')\].,;:!?…]+$/g, '');

/**
 * Los nombres propios afuera: una palabra con mayúscula que no empieza la oración, no es una sigla (CRM, IA) ni algo de MaKo
 * («Google», «Web Generator») puede ser un lead. Y la que empieza la oración, si la sigue otra así («Ana López dijo…»).
 * Una con minúscula («maría gómez») no se reconoce: por eso el reporte es la frase del error, no la pantalla.
 */
export function sinNombres(texto: string): string {
  let inicio = true;
  const salida = texto.split(/(\s+)/).map((w) => {
    if (!w || /^\s+$/.test(w)) return w;
    const p = quitarBordes(w);
    const nombre = !inicio && /^\p{Lu}/u.test(p) && !PALABRAS_DE_MAKO.has(p) && !/^[\p{Lu}\d]{2,}$/u.test(p);
    inicio = /[.!?:]$/.test(w);
    return nombre ? w.replace(p, '«…»') : w;
  }).join('');
  return salida
    .replace(/(^|[.!?:]\s+)(\p{Lu}[\p{L}'-]*)(\s+«…»)/gu, (m, a, b, c) => (PALABRAS_DE_MAKO.has(b) || COMUNES.has(b) ? m : `${a}«…»${c}`))
    .replace(/«…»(\s+«…»)+/g, '«…»');
}

/**
 * ¿La frase de un toast del teléfono es un error? Los de /m son de 3-4 palabras y no traen tono («No se pudo guardar»,
 * «No salió»): un error empieza diciendo que no se pudo, que falló o que algo no anda.
 */
export function esTextoDeError(frase: string): boolean {
  return /^\s*(no (se )?(pud|pudo|pudimos|pude|sali|carg|guard|envi|mand|encontr|anduvo|hay conexi)|no te pud|fall[oó]|error\b|algo (fall|sali[oó] mal)|ups)/i.test(frase);
}

/** Un texto de la pantalla, limpio: sin claves, sin datos ni nombres de clientes, en una línea y con su tope. */
export const limpio = (v: unknown, tope: number): string => sinNombres(sinDatos(sinSecretos(corta(v, tope * 2)))).slice(0, tope).trim();

/**
 * La pantalla: sin los tokens del CAMINO (/pagar/<token>, /compartido/<token>, /l/vista/<token>: un segmento largo de letras
 * y números, o con @) ni los números que pueden ser un teléfono o un código (más de 9 cifras, o la clave es code, otp, tel…).
 *
 * ⚠️ DESDE EL 6/11/2026 ES `rutaSinDatos` TAL CUAL, y queda nombrada acá porque es el nombre que usa el botón y sus tests.
 * Esta regla vivía SÓLO acá, y `/api/errores` —que usa `rutaSinDatos` directo— mandaba la ruta con los tokens adentro. Una
 * regla de privacidad en el camino de UNA pantalla es una regla que los otros caminos no tienen: ahora está en
 * `rutaSinDatos` (lib/errores-app-reglas.ts) y la tienen los dos. Si hace falta endurecerla, se endurece allá.
 * El detalle de qué cuenta como token (incluido el punto del token del alumno, 27/10/2026), en esa función.
 */
export const rutaSoporte = (ruta: string): string => rutaSinDatos(ruta);

export type ReporteSoporte = {
  error: string;
  accion?: string;
  ruta?: string;
  hora?: string;
  zona?: string;
  navegador?: string;
  pantalla?: string;
  idioma?: string;
};

/** Limpia lo que manda el botón. null = no hay un error que reportar. */
export function sanearReporteSoporte(x: unknown): ReporteSoporte | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const error = limpio(o.error, TOPE_ERROR);
  if (!error) return null;
  const r: ReporteSoporte = { error };
  const accion = limpio(o.accion, TOPE_ACCION);
  if (accion && accion !== '«…»') r.accion = accion;
  const ruta = rutaSoporte(typeof o.ruta === 'string' ? o.ruta : '');
  if (ruta) r.ruta = ruta;
  const hora = corta(o.hora, 40);
  if (hora && Number.isFinite(Date.parse(hora))) r.hora = new Date(hora).toISOString();
  const zona = corta(o.zona, 60);
  if (/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(zona)) r.zona = zona;
  // El navegador, con la forma de uno de verdad y sólo sus caracteres: no es un campo para escribir.
  const navegador = corta(o.navegador, 300).replace(/[^\w .;:,()/+-]/g, '');
  if (/^Mozilla\/5\.0 \(/.test(navegador)) r.navegador = navegador.slice(0, 200);
  const pantalla = corta(o.pantalla, 20);
  if (/^\d{2,5}x\d{2,5}$/.test(pantalla)) r.pantalla = pantalla;
  const idioma = corta(o.idioma, 20);
  if (/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(idioma)) r.idioma = idioma;
  return r;
}

/** La tab de una ruta, como la nombra el menú («CRM»), sin la marca de la pestaña. */
export function tabDeRuta(ruta: string | undefined): string | null {
  if (!ruta) return null;
  const t = tituloDeLaTab(ruta.split('?')[0]).replace(/^MaKo\s*[-–·]\s*/, '').trim();
  return t && t !== 'MaKo' ? t : null;
}

const horaLocal = (iso: string, zona?: string): string => {
  try {
    return new Date(iso).toLocaleString('es-AR', { timeZone: zona || 'UTC', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  } catch { return iso; }
};

/**
 * El ticket que se levanta: el título dice dónde y qué; el detalle, lo que pasó en renglones (lo lee la persona y el equipo).
 * El contexto lleva sólo lo que el navegador sabe de sí (la pantalla, la hora, el navegador): ni el error ni lo que hacía
 * (ver arriba: lo puede escribir cualquiera, y `contexto.error` / `herramienta` el triage los lee como lo que vio el sistema).
 */
export function ticketDelReporte(r: ReporteSoporte): { titulo: string; descripcion: string; contexto: Record<string, unknown> } {
  const tab = tabDeRuta(r.ruta);
  const frase = r.error.replace(/[.\s]+$/, '');
  const titulo = (tab ? `${tab}: ${frase}` : frase).slice(0, 120);
  const descripcion = [
    'Lo reporté con el botón «Reportar a Soporte».',
    tab || r.ruta ? `Pantalla: ${[tab, r.ruta ? `(${r.ruta})` : ''].filter(Boolean).join(' ')}` : '',
    r.accion ? `Lo que hacía: ${r.accion}` : '',
    `El error: ${r.error}`,
    r.hora ? `Cuándo: ${horaLocal(r.hora, r.zona)}${r.zona ? ` (${r.zona})` : ''}` : '',
  ].filter(Boolean).join('\n');
  const contexto: Record<string, unknown> = {
    ...(r.ruta ? { ruta: r.ruta } : {}), chat: { donde: 'reportar-a-soporte' },
    ...(r.hora ? { hora: r.hora } : {}), ...(r.zona ? { zona: r.zona } : {}),
    ...(r.navegador ? { navegador: r.navegador } : {}), ...(r.pantalla ? { pantalla: r.pantalla } : {}), ...(r.idioma ? { idioma: r.idioma } : {}),
  };
  return { titulo, descripcion, contexto };
}

// ── El reporte del ALUMNO de un curso (27/10/2026) ─────────────────────────────────────────────────────────────────
// Leandro (llamada del 24/10, 874749710-18): su alumno no tenía cómo reportar. Lo manda desde su portal con el token de su
// link y le llega al DUEÑO del curso: el ticket es del dueño (lo ve en su Ticketera y el equipo de MaKo en la bandeja), dice
// que lo reportó un alumno y desde dónde, y nombra al alumno por su FICHA (/crm/<id>), no por su nombre: el dueño lo abre y
// sabe quién es, y el nombre de un cliente de su cliente no viaja en el texto del ticket.

/** La pantalla del portal, la pone el SERVIDOR: el camino del link lleva el token del alumno (su credencial entera). */
export function rutaDelPortal(ruta: string | undefined): '/mi-curso' | '/compartido/curso/:token' {
  return /^\/mi-curso(?:[/?#]|$)/.test(ruta ?? '') ? '/mi-curso' : '/compartido/curso/:token';
}

/** De quién se cuenta el tope del día y con qué empieza la `ref` de sus reportes: el alumno de ESE negocio. */
export const claveDelAlumno = (ws: number, leadId: number): string => `alumno:${ws}:${leadId}`;

/** El ticket del reporte de un alumno: el del botón de siempre, con la pantalla del portal y quién lo mandó. */
export function ticketDelAlumno(r: ReporteSoporte, quien: { leadId: number; area: string | null }): { titulo: string; descripcion: string; contexto: Record<string, unknown> } {
  const ruta = rutaDelPortal(r.ruta);
  const t = ticketDelReporte({ ...r, ruta });
  const frase = r.error.replace(/[.\s]+$/, '');
  const quienEs = quien.area ? `el líder del área de tu alumno (ficha /crm/${quien.leadId})` : `tu alumno (ficha /crm/${quien.leadId})`;
  return {
    titulo: `Portal del curso: ${frase}`.slice(0, 120),
    descripcion: [`Lo reportó ${quienEs} desde su portal del curso, con «Reportar a Soporte».`, ...t.descripcion.split('\n').slice(1)]
      .join('\n').replace(/^Pantalla: .*$/m, `Pantalla: el portal del curso (${ruta})`),
    contexto: { ...t.contexto, ruta, chat: { donde: 'portal-alumno' } },
  };
}

/** La huella del día: la misma persona, la misma pantalla (como patrón) y el mismo mensaje, el mismo día (UTC). */
export function semillaDeRef(ws: number, email: string, r: ReporteSoporte, ahora = new Date()): string {
  return [ws, email.trim().toLowerCase(), rutaPatron(r.ruta ?? '/'), r.error.toLowerCase(), ahora.toISOString().slice(0, 10)].join('|');
}
