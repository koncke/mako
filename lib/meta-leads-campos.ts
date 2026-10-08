// =============================================================================
// meta-leads-campos — qué saca el parser de un field_data de Meta, y qué DESCARTA
// =============================================================================
// Puro y SIN `server-only` A PROPÓSITO. Estas cuatro decisiones son las que
// deciden qué se guarda de un lead de Meta, y adentro de un módulo con
// `server-only` ningún test las puede importar: terminarían siendo lo único sin
// red justo donde más duele (AGENTS.md → «La condición va en un módulo SIN
// `server-only`, para que se pueda testear»). Medido el 04/10/2026: importar
// `lib/meta-leads` desde `npm test` revienta con «This module cannot be imported
// from a Client Component module», porque el runner corre sin
// `--conditions react-server`.
//
// Las cuatro:
//
//  · `parseLeadFields` saca los CUATRO campos de contacto por coincidencia de
//    palabra clave, y ahora devuelve TAMBIÉN los `name` que no reconoció. Hasta
//    el 04/10/2026 los descartaba sin dejar ni un `console.warn`, así que «no
//    llegó» y «lo tiramos nosotros» se veían exactamente iguales — que es la
//    política que esta casa prohíbe («Una política puede RECHAZAR; no puede no
//    dejar rastro»).
//
//  · `columnasCrudasDeMeta` decide qué columnas crudas viajan en el upsert, y es
//    lo único que impide que una ingesta posterior PISE CON VACÍO las respuestas
//    ya guardadas. Meta borra el field_data a los 90 días y no se recupera de
//    ningún lado: lo que costó plata no se sobrescribe con un `?? null`.
//
//  · `fechaDeMeta` normaliza el `created_time`: cuándo creó Meta el lead, que no
//    es cuándo lo ingestamos. Un lead rescatado por el poll de hace 60 días nacía
//    con la fecha de la ingesta.
//
//  · `rastroDescartes` redacta la línea que el historial del lead va a mostrar.
//
// ⚠️ EL CONTACTO SE SIGUE BUSCANDO POR PALABRA CLAVE, y eso no cambia: un
// formulario con DOS teléfonos sigue aportando uno solo a la columna `telefono`,
// y ese segundo teléfono no cuenta como «no reconocido» porque el keyword sí lo
// matcheó. Lo que cambia es que ahora la respuesta entera queda en
// `leads.meta_field_data`, así que nada se pierde aunque el parser elija uno.
// =============================================================================

export type MetaFieldData = Array<{ name?: string; values?: string[] }>;

/**
 * Las palabras clave de cada campo de contacto, en UN lugar.
 *
 * Viven acá y no sueltas en `parseLeadFields` porque ahora se leen DOS veces: para
 * sacar el valor y para decidir si un `name` quedó sin reconocer. Con dos listas,
 * la que se quede vieja acusa de «no reconocido» a un campo que el parser sí usó.
 */
export const KEYWORDS_CONTACTO = {
  email: ['email', 'correo'],
  nombre: ['full_name', 'full name', 'nombre completo', 'name', 'nombre'],
  telefono: ['phone', 'teléfono', 'telefono', 'celular'],
  empresa: ['company', 'empresa', 'negocio', 'organiz'],
} as const;

/** Lo que se guarda como nombre cuando el formulario no pregunta ninguno. */
export const NOMBRE_SIN_NOMBRE = 'Lead sin nombre (Meta)';

/**
 * Extrae el primer field cuyo `name` contenga alguno de los keywords
 * (case-insensitive). Devuelve su primer value (trim) o null.
 */
export function extractField(
  fieldData: MetaFieldData | undefined,
  names: readonly string[],
): string | null {
  if (!fieldData) return null;
  const lowered = names.map((n) => n.toLowerCase());
  const found = fieldData.find(
    (f) => f.name && lowered.some((n) => f.name!.toLowerCase().includes(n)),
  );
  return found?.values?.[0]?.trim() || null;
}

export type LeadContacto = {
  email: string | null;
  nombre: string;
  telefono: string | null;
  empresa: string | null;
  /**
   * Los `name` de field_data que no matchearon NINGÚN keyword — las preguntas
   * personalizadas del formulario («en qué plazo busca vender»). Sin repetidos y
   * en el orden en que Meta las manda.
   */
  noReconocidos: string[];
};

/** ¿Este `name` lo mira alguno de los cuatro campos de contacto? */
function reconocido(name: string): boolean {
  const n = name.toLowerCase();
  return Object.values(KEYWORDS_CONTACTO).some((ks) => ks.some((k) => n.includes(k)));
}

/**
 * Saca email / nombre / teléfono / empresa de un field_data de Meta, y dice qué
 * campos NO reconoció. Mismos keywords en el webhook y en el polling.
 */
export function parseLeadFields(fieldData: MetaFieldData | undefined): LeadContacto {
  const email = extractField(fieldData, KEYWORDS_CONTACTO.email);
  const nombre = extractField(fieldData, KEYWORDS_CONTACTO.nombre) ?? NOMBRE_SIN_NOMBRE;
  const telefono = extractField(fieldData, KEYWORDS_CONTACTO.telefono);
  const empresa = extractField(fieldData, KEYWORDS_CONTACTO.empresa);

  const vistos = new Set<string>();
  const noReconocidos: string[] = [];
  for (const f of fieldData ?? []) {
    const name = f.name?.trim();
    if (!name || reconocido(name) || vistos.has(name)) continue;
    vistos.add(name);
    noReconocidos.push(name);
  }

  return { email, nombre, telefono, empresa, noReconocidos };
}

/**
 * LAS RESPUESTAS PROPIAS DEL FORMULARIO: lo que la persona contestó y que no es
 * nombre, email, teléfono ni empresa.
 *
 * Esas cuatro ya se leen en la ficha con su rótulo; repetirlas acá sería escribir
 * dos veces el mismo dato. Lo que falta mostrar es lo OTRO — «¿en qué zona buscas?»,
 * «¿cuál es tu presupuesto?» —, que hoy se guarda en `leads.meta_field_data` (mig
 * 0187) y no lo leía una sola pantalla.
 *
 * ⚠️ MIDE EN EL MISMO LUGAR QUE `parseLeadFields`: usa `reconocido()`, la misma
 * función que decide si el parser miró un campo. Con dos listas, la que se quede
 * vieja muestra como «pregunta propia» algo que la ficha ya dibuja arriba — o peor,
 * esconde una respuesta real porque su nombre se parece a «nombre».
 *
 * Se queda con el PRIMER valor no vacío de cada pregunta y conserva el orden en que
 * Meta las manda, que es el orden en que la persona las contestó.
 */
export function respuestasPropias(fieldData: MetaFieldData | null | undefined): Array<{ pregunta: string; respuesta: string }> {
  if (!Array.isArray(fieldData)) return [];
  const vistas = new Set<string>();
  const out: Array<{ pregunta: string; respuesta: string }> = [];
  for (const f of fieldData) {
    const pregunta = f.name?.trim();
    if (!pregunta || reconocido(pregunta) || vistas.has(pregunta)) continue;
    const respuesta = (f.values ?? []).map((v) => (v ?? '').trim()).find((v) => v.length > 0);
    // Una pregunta sin respuesta no se dibuja: un renglón con el rótulo y nada al
    // lado se lee como que el dato se perdió, cuando lo que pasó es que no contestó.
    if (!respuesta) continue;
    vistas.add(pregunta);
    out.push({ pregunta: preguntaLegible(pregunta), respuesta: respuestaLegible(respuesta) });
  }
  return out;
}

/**
 * Lo que contestó en el formulario de Meta, como lo recibe MaKo (la herramienta `ficha_lead`).
 *
 * ⚠️ UNA HERRAMIENTA CON UNA LISTA CERRADA DE CAMPOS HACE QUE EL MODELO AFIRME «NO HAY» SOBRE
 * UN DATO QUE ESTÁ GUARDADO (08/10/2026). Joan le preguntó a MaKo por WhatsApp qué propiedad
 * quería vender Rosana (ws15) y contestó «en su ficha no hay detalles»: la respuesta («Casa»)
 * estaba en `leads.meta_field_data` y la ficha de la app la mostraba, pero `ficha_lead`
 * devolvía 20 campos fijos y las respuestas de R1/R2 (`lead_respuestas`), que un lead de
 * formulario no tiene. El otro turno, «¿tenés acceso a lo que dijo en el formulario?», gastó
 * seis pasos buscando con otras herramientas algo que ninguna devolvía hasta el 429 de cuota.
 *
 * `null` = no vino de un formulario de Meta, o entró antes del 04/10/2026, cuando las
 * respuestas no se guardaban. NO es «no contestó»: eso lo dice la descripción de la
 * herramienta, una vez, y no cada ficha. Los topes dejan el peor caso (12 × 500 caracteres)
 * lejos del corte de esquema y resultados; lo medido el 08/10 son 2 preguntas, unos 200.
 */
export const TOPE_FORMULARIO_MODELO = { preguntas: 12, pregunta: 200, respuesta: 300 } as const;

export function formularioParaModelo(fieldData: MetaFieldData | null | undefined): {
  formulario_meta: Array<{ pregunta: string; respuesta: string }> | null;
  formulario_meta_omitidas?: number;
} {
  if (fieldData == null) return { formulario_meta: null };
  const T = TOPE_FORMULARIO_MODELO;
  const todas = respuestasPropias(fieldData);
  const filas = todas.slice(0, T.preguntas).map((r) => ({
    pregunta: r.pregunta.slice(0, T.pregunta),
    respuesta: r.respuesta.slice(0, T.respuesta),
  }));
  return { formulario_meta: filas, ...(todas.length > filas.length ? { formulario_meta_omitidas: todas.length - filas.length } : {}) };
}

/** La primera letra en mayúscula, saltando el «¿» o el «¡» de apertura. */
const conMayuscula = (s: string): string => s.replace(/^([¿¡]?)(\p{Ll})/u, (_, a: string, b: string) => a + b.toUpperCase());

/**
 * La pregunta como la escribió el negocio, no como la guarda Meta.
 *
 * ⚠️ META MANDA LA CLAVE, NO EL TEXTO. El `name` de una pregunta propia es su texto
 * pasado a minúsculas con guiones bajos: medido el 07/10/2026 en los formularios de
 * una inmobiliaria, «¿qué_tipo_de_propiedad_buscas_vender?». Dibujado tal cual, la
 * ficha mostraba el identificador y no la pregunta. Los acentos y los signos sí
 * vienen, así que alcanza con devolver los espacios y la mayúscula.
 */
export function preguntaLegible(name: string): string {
  return conMayuscula(name.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim());
}

/**
 * La respuesta, legible SÓLO si es una opción del formulario.
 *
 * Las opciones de una pregunta de selección llegan como clave («una_casa», «un_ph»);
 * lo que la persona tipeó llega como lo tipeó («san telmo», «Urquiza»). Lo que las
 * distingue es el espacio: una clave no tiene, un texto libre de más de una palabra
 * sí. ⚠️ Por eso un texto libre NO se toca —ni la mayúscula—: es lo que escribió esa
 * persona, y corregírselo es afirmar algo que no dijo. El único caso que queda mal es
 * una respuesta libre de UNA palabra en minúscula, que gana su mayúscula.
 */
export function respuestaLegible(valor: string): string {
  const v = valor.trim();
  if (/\s/.test(v)) return v;
  return conMayuscula(v.replace(/_+/g, ' ').trim());
}

/**
 * Lo que contestó, en renglones, para un mensaje (`{{lead_formulario}}`).
 *
 * Mismo tope que el resumen de la landing (app/api/track/optin/route.ts): seis
 * preguntas y 120 caracteres cada una. Un WhatsApp no es un volcado, y un formulario
 * de 40 campos no puede convertir el aviso en algo que nadie lee. Sin preguntas
 * propias devuelve `null`: quien arma el mensaje decide qué decir en ese caso.
 */
export function resumenRespuestas(fieldData: MetaFieldData | null | undefined): string | null {
  const filas = respuestasPropias(fieldData).slice(0, 6);
  if (!filas.length) return null;
  return filas.map((r) => `• ${r.pregunta.slice(0, 120)}: ${r.respuesta.slice(0, 120)}`).join('\n');
}

/** Un field_data con AL MENOS una respuesta. `undefined`, `null` y `[]` son lo mismo acá. */
export function tieneRespuestas(fd: unknown): fd is MetaFieldData {
  return Array.isArray(fd) && fd.length > 0;
}

/**
 * El `created_time` de Meta, normalizado a ISO para una columna timestamptz.
 *
 * Acepta el string ISO que devuelve Graph para un nodo de lead y también el
 * entero en SEGUNDOS que viaja en el cuerpo del webhook — son las dos formas en
 * que Meta manda la misma cosa. Una fecha ilegible vuelve `null`: la columna es
 * nullable justamente para poder decir «no sé», y un `Invalid Date` reventaría
 * el insert de un lead entero por un campo de atribución.
 */
export function fechaDeMeta(v: string | number | null | undefined): string | null {
  if (v == null || v === '') return null;
  const d = new Date(typeof v === 'number' ? v * 1000 : v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export type MetaCrudoEntra = {
  fieldData?: MetaFieldData | null;
  createdTime?: string | number | null;
};

/** Las columnas crudas que viajan en el upsert. Lo que no está, no se toca. */
export type ColumnasCrudasDeMeta = {
  meta_field_data?: MetaFieldData;
  meta_created_at?: string;
};

/**
 * Qué columnas crudas se escriben de esta ingesta.
 *
 * ⚠️ LA CLAVE AUSENTE ES EL MECANISMO, y es todo el mecanismo. Una ingesta que no
 * trae respuestas NO manda `meta_field_data`, así que PostgREST deja la columna
 * como estaba y gana lo guardado. Escribirla como `input.field_data ?? null`
 * —que es la forma natural de armar el objeto, y lo que hacen las otras cinco
 * columnas de Meta de al lado— le BORRA al lead las respuestas que Meta ya no
 * tiene: a los 90 días no se recuperan de ningún lado.
 *
 * Por eso tampoco recibe el lead guardado: no hay nada que comparar. Lo único que
 * se decide es si la clave viaja.
 */
export function columnasCrudasDeMeta(entra: MetaCrudoEntra): ColumnasCrudasDeMeta {
  const out: ColumnasCrudasDeMeta = {};
  if (tieneRespuestas(entra.fieldData)) out.meta_field_data = entra.fieldData;
  const fecha = fechaDeMeta(entra.createdTime);
  if (fecha) out.meta_created_at = fecha;
  return out;
}

/** Con qué nombre aparece el descarte en el historial del lead. */
export const CAMPO_RESPUESTAS_META = 'Respuestas de Meta';

/** Techo de la línea del historial: es una fila de una lista de N. */
export const TOPE_RASTRO = 110;

/**
 * La línea del historial para las respuestas que el parser no reconoció, o null
 * si no hubo ninguna (no se escribe una línea para decir que no pasó nada).
 *
 * El texto nombra lo que distingue a ESA fila —qué preguntas fueron— y se topea
 * en 110 caracteres como cualquier fila de una lista. Las respuestas enteras no
 * van acá: viven en `leads.meta_field_data`, que es donde se leen.
 */
export function rastroDescartes(nombres: string[]): string | null {
  const limpios = nombres.map((n) => n.trim()).filter(Boolean);
  if (!limpios.length) return null;
  const texto = `Sin columna: ${limpios.join(', ')}`;
  return texto.length <= TOPE_RASTRO ? texto : `${texto.slice(0, TOPE_RASTRO - 1).trimEnd()}…`;
}
