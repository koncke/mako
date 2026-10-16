// =============================================================================
// campo-inline — qué campos del lead se editan EN EL LUGAR, y por dónde escriben
// =============================================================================
// «Que ya no exista el botón de "editar" en la ruta de cada lead, sino que
// simplemente en cada campo … le doy click arriba y ya puedo sobre escribir»
// (Martín, 05/10/2026). Este módulo es el CATÁLOGO de esos campos: lo lee la
// pantalla (para saber qué gesto dibujar) y la server action (para validar lo que
// le llega). Es puro a propósito — sin 'use server' ni 'use client' — así el
// catálogo no se parte en dos copias que se desincronicen.
//
// ⚠️ YA ESTÁN TODOS LOS DEL FORMULARIO. La primera pasada dejó afuera cuatro
// (fecha de agendamiento, motivo de salida, fecha límite de la nutrición manual y
// los dos links de Fathom) y esos cuatro eran exactamente la razón por la que el
// botón «Editar lead →» seguía existiendo. Lo único que sigue colgando de una
// pantalla aparte es el DEAL (Deal Details), que tiene su propia tab y su propio
// «Editar deal →».

import type { FathomLink } from '@/lib/leads';
import { usuarioDeTexto } from '@/lib/instagram-buscar';

/**
 * Los campos que la ficha edita en el lugar.
 *
 * ⚠️ LA CLAVE ES LA COLUMNA DE `leads`, con UNA excepción declarada: `fathom_r1` y
 * `fathom_r2` son los dos SLOTS de la columna `fathom_links`, que es un array. Se
 * parten en dos claves porque se editan en dos renglones distintos (el bloque de
 * la R1 y el de la R2) y porque guardar uno NO puede borrar el otro — que es
 * justo lo que hacía el formulario, que reescribía el array entero.
 */
export type CampoInline =
  | 'fecha_agenda'
  | 'fecha_junta_1'
  | 'fecha_junta_2'
  | 'fecha_confirmacion'
  | 'asistio_j1'
  | 'asistio_j2'
  | 'calificado'
  | 'closer'
  | 'setter'
  | 'motivo_perdida'
  | 'nutricion_manual_deadline'
  | 'fathom_r1'
  | 'fathom_r2'
  // Mig 0258 (12/10/2026): los dos datos nuevos de «Información principal».
  | 'ingreso_estimado'
  | 'instagram';

/** Lo que la pantalla manda: texto de un `<input type="date">`, tri-estado, nombre o un monto. */
export type ValorInline = string | number | boolean | null;

/**
 * Por dónde se escribe cada campo. NO es un detalle de implementación:
 *
 *  · `lead` → `updateLead`, que es el único lugar que aplica las invariantes
 *    (sin fecha R1 no hay asistencia, sin asistencia no hay «calificado», y un
 *    motivo de salida sólo sobrevive si el lead está perdido o descalificado) y
 *    el único que DISPARA META CAPI cuando `calificado` pasa a true. Escribir
 *    `calificado` por el camino corto deja a Meta sin el evento que la pantalla
 *    dice que manda — que es justo el dato por el que el cliente la marca.
 *  · `meta` → `saveLeadMeta`, columnas sin invariante ni evento (closer/setter y
 *    la fecha límite de la nutrición manual).
 *  · `fathom` → también `saveLeadMeta`, pero PARCHEANDO un slot del array: la
 *    action lee los links que ya están, reemplaza el de esa reunión y deja el
 *    resto como estaba.
 */
export const VIA_INLINE: Record<CampoInline, 'lead' | 'meta' | 'fathom'> = {
  fecha_agenda: 'lead',
  fecha_junta_1: 'lead',
  fecha_junta_2: 'lead',
  fecha_confirmacion: 'lead',
  asistio_j1: 'lead',
  asistio_j2: 'lead',
  calificado: 'lead',
  // El motivo va por `updateLead` y no por el camino corto porque la invariante
  // es SUYA: «motivo solo tiene sentido en perdido/descalificado» está escrita
  // ahí, y por el camino corto un lead reabierto se quedaba con el motivo viejo.
  motivo_perdida: 'lead',
  closer: 'meta',
  setter: 'meta',
  nutricion_manual_deadline: 'meta',
  fathom_r1: 'fathom',
  fathom_r2: 'fathom',
  // ⚠️ El ingreso estimado va por el camino CORTO a propósito: NO es una venta. `updateLead`
  // aplica las invariantes del desenlace (monto ⇔ cerro) y dispara Meta; un estimado no
  // decide nada de eso, y no puede tocar `monto_cierre_usd`, que es lo que cuenta Revenue.
  ingreso_estimado: 'meta',
  instagram: 'meta',
};

/**
 * El GESTO de cada campo. Un «click y escribí» sobre un desplegable no existe:
 *  · `fecha`   → el click abre el campo de fecha (y su calendario).
 *  · `tri`     → el click abre Sí / No / —, ahí mismo.
 *  · `persona` → el click abre el desplegable del equipo.
 *  · `texto`   → el click pone el cursor y se sobrescribe (`EditableInline`).
 *  · `enlace`  → texto, pero validado: un link que no es de Fathom deja al
 *    buscador de grabaciones apuntando a la nada.
 * El contacto (nombre, empresa, email, teléfono) NO pasa por acá: ya se edita con
 * `EditableInline` en `InfoPrincipalCard`, que es el molde de esta casa.
 */
export const GESTO_INLINE: Record<CampoInline, 'fecha' | 'tri' | 'persona' | 'texto' | 'enlace' | 'monto' | 'instagram'> = {
  fecha_agenda: 'fecha',
  fecha_junta_1: 'fecha',
  fecha_junta_2: 'fecha',
  fecha_confirmacion: 'fecha',
  asistio_j1: 'tri',
  asistio_j2: 'tri',
  calificado: 'tri',
  closer: 'persona',
  setter: 'persona',
  motivo_perdida: 'texto',
  nutricion_manual_deadline: 'fecha',
  fathom_r1: 'enlace',
  fathom_r2: 'enlace',
  //  · `monto`     → un número en USD, ≥ 0 (`montoDeTexto`): el click abre una caja numérica.
  //  · `instagram` → un usuario, sin la @ (`usuarioInstagram`): acepta el @, el usuario o el link.
  ingreso_estimado: 'monto',
  instagram: 'instagram',
};

/** El techo de un ingreso estimado, en USD. Un número así es un dedo de más, no un lead. */
export const INGRESO_MAX_USD = 1_000_000_000;

/**
 * Un monto escrito por una persona, a número. `null` = no se entiende.
 *
 * Acepta lo que se escribe de verdad: `1500`, `1,500`, `1.500`, `$1,500.50`, `US$ 2000`,
 * `1500,5`. La única ambigüedad real es el punto (o la coma) seguido de EXACTAMENTE tres
 * dígitos: `1.500` es mil quinientos en México y uno y medio en Estados Unidos. Se lee como
 * miles, porque un ingreso estimado con tres decimales no lo escribe nadie y mil quinientos
 * dólares sí.
 */
export function montoDeTexto(t: string): number | null {
  let s = t.replace(/us\$|usd|\$|\s/gi, '');
  if (!s) return null;
  if (!/^[0-9.,]+$/.test(s)) return null;
  const tienePunto = s.includes('.');
  const tieneComa = s.includes(',');
  if (tienePunto && tieneComa) {
    // El que va ÚLTIMO es el decimal; el otro, de miles.
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const miles = dec === '.' ? ',' : '.';
    s = s.split(miles).join('').replace(dec, '.');
  } else if (tienePunto || tieneComa) {
    const sep = tienePunto ? '.' : ',';
    s = new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`).test(s) ? s.split(sep).join('') : s.replace(sep, '.');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Las rutas de instagram.com que NO son un perfil: un link así no nombra a nadie. */
const RUTAS_NO_PERFIL = new Set(['p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts', 'direct', 'about', 'legal', 'developer']);

/**
 * El usuario de Instagram, como lo guarda `leads.instagram`: sin la @, en minúsculas.
 * `null` = no es un usuario.
 *
 * Acepta las tres formas en que llega: `@martinkoncke`, `martinkoncke` y el link del perfil
 * (`https://www.instagram.com/martinkoncke/?igsh=…`). Un link a un post o a un reel NO es un
 * perfil y no se acepta: guardaría `p` como usuario y el link de la ficha abriría la nada.
 * Las reglas de un usuario son las de Instagram: hasta 30 letras, números, puntos y guiones
 * bajos. Instagram no distingue mayúsculas, así que se guarda en minúsculas y dos altas del
 * mismo perfil escrito distinto no se ven como dos personas.
 *
 * ⚠️ LA USA TAMBIÉN EL ALTA (el buscador de Instagram de «Nuevo lead»): un valor, una regla.
 */
export function usuarioInstagram(t: string | null | undefined): string | null {
  let s = (t ?? '').trim();
  if (!s) return null;
  const link = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#]+)/i);
  if (link) {
    if (RUTAS_NO_PERFIL.has(link[1].toLowerCase())) return null;
    s = link[1];
  }
  // ⚠️ UNA SOLA REGLA de «esto es un usuario de Instagram»: la del buscador del alta
  // (lib/instagram-buscar.ts). Había dos y diferían en «___» (sin letras ni números), que la
  // ficha guardaba como usuario y el buscador no (docs/relevo/crm.md, 12/10/2026).
  return usuarioDeTexto(s);
}

/**
 * Qué se guarda al cerrar el teléfono de la ficha (el editor con el país primero, punto 5 del
 * 12/10/2026). `null` = NO se escribe nada; `''` = se borra el teléfono; si no, los dígitos.
 *
 * ⚠️ EL FORMATO GUARDADO NO CAMBIA SI EL NÚMERO NO CAMBIÓ. Lo que llegó de Calendly o de un
 * formulario está guardado como vino («+52 1 55 5555 5555»); abrirlo, verlo partido en país y
 * número, y cerrarlo, no puede reescribirlo con otro formato ni dejar una línea en el historial.
 * Se comparan DÍGITOS, que es también la llave del match (`telefono_normalizado`).
 * Si cambió, sale lo que la pieza de la casa emite en todos lados: `lada + número` en dígitos
 * (`unirTelefono`, lib/paises.ts) — se escribe acá a mano para que este módulo siga sin imports de
 * valores y lo puedan cargar el test y el navegador.
 *
 * ⚠️ Y LO QUE SE ABRIÓ Y NO SE TOCÓ TAMPOCO SE ESCRIBE (revisión del 12/10/2026). Un teléfono guardado
 * SIN código de país («2233550684», del alta vieja de texto libre o de un CSV) no matchea ninguna
 * lada: `splitTelefono` lo abre como +52 y el número entero, y comparar dígitos daba «cambió»
 * (522233550684 ≠ 2233550684). Cerrar la ficha sin tocar nada le pegaba un +52 en silencio, con su
 * línea en el historial, y el WhatsApp salía a México. `inicial` es la partición con la que se ABRIÓ
 * el editor: si la lada y los dígitos siguen siendo ésos, no se escribe nada.
 */
export function telefonoAGuardar(
  antes: string | null | undefined, lada: string, numero: string, inicial?: { lada: string; resto: string },
): string | null {
  const digitosAntes = (antes ?? '').replace(/\D/g, '');
  const local = numero.replace(/\D/g, '');
  if (inicial && lada === inicial.lada && local === inicial.resto.replace(/\D/g, '')) return null;
  const nuevo = local ? `${lada}${local}`.replace(/\D/g, '') : '';
  return nuevo === digitosAntes ? null : nuevo;
}

/** El link al perfil, para el botón de la ficha. */
export function linkInstagram(usuario: string | null | undefined): string | null {
  const u = usuarioInstagram(usuario);
  return u ? `https://www.instagram.com/${u}/` : null;
}

/**
 * Qué Instagram manda el ALTA de un lead (app/crm/new/NewLeadForm.tsx): el perfil ELEGIDO en el
 * buscador y, si no se eligió ninguno, lo ESCRITO en él cuando es un usuario (`usuarioInstagram`).
 * `''` = nada que guardar.
 *
 * ⚠️ LO ESCRITO NO SE PIERDE EN SILENCIO (revisión del 12/10/2026). El buscador sólo entregaba lo
 * elegido de su lista, y quien tipeaba «@martinkoncke» y apretaba «Crear lead» sin tocar «Usar
 * @martinkoncke» creaba el lead SIN Instagram, sin un aviso: el campo se veía lleno y no viajaba.
 * Un nombre («Martin Koncke») no es un usuario y no se manda: no hay a qué perfil apuntarlo.
 */
export function instagramDelAlta(elegido: string | null | undefined, escrito: string | null | undefined): string {
  return usuarioInstagram(elegido) ?? usuarioInstagram(escrito) ?? '';
}

export function esCampoInline(campo: string): campo is CampoInline {
  return Object.prototype.hasOwnProperty.call(VIA_INLINE, campo);
}

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Un link de grabación de Fathom.
 *
 * ⚠️ ES LA ÚNICA VALIDACIÓN QUE HAY, y hasta hoy NO EXISTÍA EN LA FICHA: el
 * formulario sólo ponía un `placeholder="https://fathom.video/…"` y guardaba
 * cualquier cosa que se pegara. La regla ya estaba escrita —pero en el canal de
 * MaKo (`lib/api-mako/areas/crm.run.ts`), o sea que el bot era más estricto que
 * la pantalla—. Acá queda una sola copia y el canal la importa.
 *
 * Importa porque el link es lo que siguen el reparto de grabaciones y el Closing
 * Analyst: con un texto cualquiera, el bloque de la reunión dibuja un «Abrir →»
 * que no abre nada y el análisis queda huérfano.
 */
export const FATHOM_URL = /^https:\/\/([a-z0-9-]+\.)*fathom\.video\//i;

/** Los dos slots fijos de `fathom_links`: una llamada de VENTA por reunión. */
export const ETIQUETA_FATHOM: Record<'fathom_r1' | 'fathom_r2', string> = {
  fathom_r1: 'Reunión 1',
  fathom_r2: 'Reunión 2',
};

/**
 * Normaliza lo que llega de la pantalla al tipo de la columna, o tira.
 *
 * ⚠️ VALIDA DE VERDAD porque el llamador NO es la pantalla: es una server action,
 * o sea una URL. Un `fecha_junta_1: 'mañana'` entra en Postgres como error de
 * tipo y sube como un 500 sin nombre; un `calificado: 'si'` entraría como truthy
 * y mandaría un evento a Meta por un dato que nadie marcó.
 */
export function valorDeCampo(campo: CampoInline, v: ValorInline): string | number | boolean | null {
  const gesto = GESTO_INLINE[campo];
  if (gesto === 'tri') {
    if (v === true || v === false || v === null) return v;
    throw new Error(`"${campo}" solo acepta sí, no o sin marcar.`);
  }
  if (typeof v === 'boolean') throw new Error(`"${campo}" no es un sí/no.`);
  if (gesto === 'monto') {
    // Vaciarlo es legítimo: «ya no sé cuánto vale» es un dato, y no es lo mismo que 0.
    if (v === null || (typeof v === 'string' && !v.trim())) return null;
    const n = typeof v === 'number' ? v : montoDeTexto(v);
    if (n == null || !Number.isFinite(n) || n < 0) throw new Error('Escribe un monto en dólares (por ejemplo, 1500).');
    if (n > INGRESO_MAX_USD) throw new Error('Ese monto es demasiado grande.');
    // Centavos como mucho: un `numeric` guarda lo que le den, y 1500.333333 no lo escribió nadie.
    return Math.round(n * 100) / 100;
  }
  if (typeof v === 'number') throw new Error(`"${campo}" no es un número.`);
  const s = (v ?? '').trim();
  if (gesto === 'instagram') {
    if (!s) return null;
    const u = usuarioInstagram(s);
    if (!u) throw new Error('Escribe un usuario de Instagram (por ejemplo, @usuario).');
    return u;
  }
  if (gesto === 'fecha') {
    // ⚠️ LA FECHA LÍMITE DE LA NUTRICIÓN MANUAL NO PUEDE QUEDAR VACÍA, y es la
    // única validación de campo que el formulario tenía de verdad («Para
    // "Nutrición - Manual" tienes que poner una fecha límite»). Sin ella el lead
    // se queda en Manual sin plazo: `lib/crm-auto-plan.ts` cuelga de esa fecha
    // para avisar que venció, así que vaciarla lo saca del radar en silencio.
    if (!s && campo === 'nutricion_manual_deadline') throw new Error('La nutrición manual necesita una fecha límite.');
    if (!s) return null;
    if (!ISO_DIA.test(s)) throw new Error(`"${campo}" espera una fecha (AAAA-MM-DD).`);
    return s;
  }
  if (!s) return null;
  if (gesto === 'enlace') {
    if (!FATHOM_URL.test(s)) throw new Error('El link tiene que ser una URL de Fathom (https://fathom.video/…).');
    return s.slice(0, 500);
  }
  if (gesto === 'texto') return s.slice(0, 500);
  // persona: el nombre de un miembro del equipo (o uno viejo que ya no está).
  return s.slice(0, 80);
}

/**
 * Reemplaza el link de UNA reunión y deja TODOS los demás como estaban.
 *
 * ⚠️ ES LO QUE EL FORMULARIO NO HACÍA. Su `buildFathom(u1, u2)` reconstruía el
 * array desde cero con dos slots: cualquier link que no cayera en esos dos —un
 * tercero, o uno con otra etiqueta— se perdía al guardar, sin aviso y sin línea en
 * el historial. Editando campo por campo eso sería peor todavía (tocar la R1
 * borraría la R2), así que acá se parchea EN SU POSICIÓN el primer link de esa
 * reunión y no se toca nada más.
 *
 * `esR2` entra por parámetro —y no importado acá— porque `etiquetaEsR2` vive en
 * `lib/insights-llamada-reparto.ts` junto al reparto de los análisis: es la MISMA
 * pregunta, y con dos copias el link cae en un bloque y su análisis en el otro.
 */
export function ponerLinkFathom(
  links: FathomLink[],
  campo: 'fathom_r1' | 'fathom_r2',
  url: string | null,
  esR2: (label: string | null | undefined) => boolean,
): FathomLink[] {
  const mio = campo === 'fathom_r2';
  // Un link sin URL no es un link: el array guarda {label, url} y una fila vacía
  // dibuja un «Abrir →» muerto. Es la misma limpieza que hacía el formulario.
  const vivos = links.filter((f) => f.url?.trim());
  const nuevo: FathomLink | null = url ? { label: ETIQUETA_FATHOM[campo], url } : null;
  const i = vivos.findIndex((f) => esR2(f.label) === mio);
  if (i < 0) return nuevo ? (mio ? [...vivos, nuevo] : [nuevo, ...vivos]) : vivos;
  const out = vivos.slice();
  if (nuevo) out[i] = nuevo;
  else out.splice(i, 1);
  return out;
}

// ── El «Deshacer» que no pisa a otro (verificación de la ficha v2, 16/10/2026) ────────────────────────────────
//
// El aviso «Guardado · Deshacer» vive 5 segundos, y hasta el 16/10/2026 su Deshacer escribía el valor de antes A
// CIEGAS: si en ese medio otra persona (u otro camino: el webhook de Calendly, el motor, Fathom) cambió el mismo campo,
// se lo pisaba sin decir nada. Ahora el Deshacer manda lo que ÉL escribió (`esperado`), y el server sólo deshace si hoy
// el campo sigue diciendo eso: el mismo criterio que el `esperado` de «restaurar» en la ficha del funnel
// (lib/ficha/config.ts) y de `guardarObligacionAction` en el deal. Lo fija tests/ficha-resumen-lo-de-antes.test.ts.

/** Cómo lo compara el Deshacer: vacío y sin dato son lo mismo, y los textos se comparan recortados. */
const textoComparable = (v: unknown): string => (v == null ? '' : String(v).trim());

/**
 * Lo que el campo dice HOY en la fila del lead, en la forma de `valorDeCampo`. Las fechas, el día (la columna puede
 * volver con hora); un link de Fathom, el de SU reunión en `fathom_links` (`esR2`, el mismo de `ponerLinkFathom`).
 */
export function valorGuardadoDeCampo(
  campo: CampoInline,
  lead: Record<string, unknown>,
  esR2: (label: string | null | undefined) => boolean,
): ValorInline {
  if (VIA_INLINE[campo] === 'fathom') {
    const links = Array.isArray(lead.fathom_links) ? (lead.fathom_links as FathomLink[]) : [];
    const mio = campo === 'fathom_r2';
    return links.find((f) => f?.url?.trim() && esR2(f.label) === mio)?.url?.trim() ?? null;
  }
  const v = lead[campo];
  if (v == null) return null;
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  return String(v);
}

/** ¿El campo dice lo mismo? `hoy` sale de `valorGuardadoDeCampo`; `esperado`, de `valorDeCampo` (lo que se escribió). */
export function mismoValorDeCampo(campo: CampoInline, hoy: ValorInline, esperado: ValorInline): boolean {
  const gesto = GESTO_INLINE[campo];
  if (gesto === 'tri') return (hoy ?? null) === (esperado ?? null);
  if (gesto === 'monto') {
    const a = hoy == null || hoy === '' ? null : Number(hoy);
    const b = esperado == null || esperado === '' ? null : Number(esperado);
    return a === b || (a != null && b != null && Math.abs(a - b) < 0.005);
  }
  if (gesto === 'fecha') return textoComparable(hoy).slice(0, 10) === textoComparable(esperado).slice(0, 10);
  return textoComparable(hoy) === textoComparable(esperado);
}

/** Los datos de contacto que la ficha guarda por `saveLeadMetaAction` (el contacto, las redes, la dirección y el sexo). */
export const CAMPOS_CONTACTO = ['empresa', 'email', 'telefono', 'web', 'youtube', 'linkedin', 'direccion', 'sexo'] as const;
export type CampoContacto = (typeof CAMPOS_CONTACTO)[number];
export const esCampoContacto = (c: unknown): c is CampoContacto => typeof c === 'string' && (CAMPOS_CONTACTO as readonly string[]).includes(c);

/** ¿El dato de contacto dice lo mismo? Con la limpieza de `saveLeadMeta`: recortado, y a 300 los de texto largo. */
export function mismoDatoDeContacto(campo: CampoContacto, hoy: unknown, esperado: unknown): boolean {
  const largo = campo === 'youtube' || campo === 'linkedin' || campo === 'direccion';
  const n = (v: unknown) => (largo ? textoComparable(v).slice(0, 300) : textoComparable(v));
  return n(hoy) === n(esperado);
}

/** Lo que contesta el Deshacer cuando el campo ya no dice lo que él escribió. Corto: es un aviso. */
export const YA_LO_CAMBIARON = 'Alguien ya lo cambió';

/**
 * ¿Guardar por `updateLead` le va a BORRAR el monto de cierre a este lead?
 *
 * ⚠️ ESTO NO ERA PARANOIA, ERA UNA REGLA ESCRITA EN `updateLead`: «si cerro != true
 * → monto_cierre_usd y fecha_cierre se fuerzan a null», y se aplicaba mirara el
 * caller lo que mirara — aunque sólo hubiera mandado `asistio_j1`. Desde el
 * 06/10/2026 se aplica sólo si el caller tocó un campo que decide la venta
 * (`desenlaceAlGuardar`, lib/lead-desenlace.ts), así que el rescate de
 * `guardarCampoLeadAction` quedó como red: reescribe los mismos valores.
 *
 * Y hay leads a los que eso les saca un número real: `lib/pagos.ts` y el editor
 * del deal escriben `monto_cierre_usd` DIRECTO, sin pasar por `updateLead`, así
 * que un lead en «Facturando» (estado `abierto`, `cerro` null) tiene monto y no
 * tiene `cerro`. Corregirle «asistió a R1» desde la ficha le vaciaba la venta.
 *
 * El síntoma es peor que el bug: el monto desaparece del lead y de Revenue sin un
 * error, sin un toast y sin una línea en el historial que diga quién lo sacó.
 */
export function montoEnRiesgo(l: { cerro?: boolean | null; monto_cierre_usd?: number | null; fecha_cierre?: string | null }): boolean {
  return l.cerro !== true && (l.monto_cierre_usd != null || l.fecha_cierre != null);
}
