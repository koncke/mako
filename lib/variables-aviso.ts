// =============================================================================
// Los DATOS que se pueden meter adentro de un mensaje
// =============================================================================
// Pedido textual (30/09/2026): «hace falta configurar llamados a datos dentro de
// MaKo... Por ejemplo, llamados al CRM, traer el nombre, el número, el email, etc...
// O llamados a los anuncios, traer el rendimiento, el presupuesto... Y revisa también
// que hoy en día tenemos varios LINKS dentro de MaKo que podrían ser de utilidad...
// Para evitar poner mucha info dentro de un mensaje y aprovechar este sistema».
//
// ── LA REGLA DE ADMISIÓN, Y ES LA QUE HACE QUE ESTO NO MIENTA ───────────────
// Sólo entra lo que quien EMITE ya tiene en la mano: cero queries nuevas, cero
// llamadas a un proveedor. Un aviso que espera 900 ms a Meta para resolver
// `{{presupuesto}}` es un aviso que no sale — y el webhook que lo dispara tiene un
// `maxDuration`. Para los números de anuncios está `{{link_anuncios}}`, que lleva a
// la pantalla donde el número está fresco; ésa es la mitad del pedido que dice
// «para evitar poner mucha info dentro de un mensaje».
//
// ⚠️ Y EL TOKEN VIAJA COMO TEXTO PLANO, NUNCA COMO UN CHIP. `domAMarcas` del editor
// aplana todo lo que no sea b/i/s y NO avisa: un `<span>` bonito que diga «Nombre
// del lead» se serializa como ese texto y la variable desaparece entera. Lo que se
// escribe en el contenteditable es `{{lead_nombre}}`, y el color se lo pone el
// pintado, no la etiqueta.

/** El molde de un token. Se escribe UNA vez y lo usan el editor, el pintado y el saneo. */
export const RE_VARIABLE = /\{\{[a-z0-9_]+\}\}/gi;

/**
 * Parte un texto en tramos, separando los tokens del resto.
 *
 * ⚠️ EXISTE PORQUE LAS MARCAS DE WHATSAPP SE COMEN LOS TOKENS. La itálica es
 * `_texto_`, y `{{lead_nombre}}` tiene un guión bajo adentro: con dos tokens en la
 * misma línea, `Hola {{lead_nombre}}, mirá {{link_crm}}` se dibuja
 * «Hola {{leadnombre}}, mirá {{linkcrm}}» en itálica — el `_` de uno cierra con el
 * del otro. Y con una negrita en el medio salen etiquetas cruzadas, que el navegador
 * reparenta y el serializador devuelve con `_` de más: el texto guardado cambia solo.
 *
 * Los dos renderers parten por acá y aplican las marcas SÓLO a los tramos de afuera.
 */
export function tramosConVariables(linea: string): Array<{ txt: string; esVar: boolean }> {
  const out: Array<{ txt: string; esVar: boolean }> = [];
  let i = 0;
  for (const hit of linea.matchAll(RE_VARIABLE)) {
    const at = hit.index ?? 0;
    if (at > i) out.push({ txt: linea.slice(i, at), esVar: false });
    out.push({ txt: hit[0], esVar: true });
    i = at + hit[0].length;
  }
  if (i < linea.length) out.push({ txt: linea.slice(i), esVar: false });
  return out;
}

// ──────────────────────────────────────────────────────────────────────────

/** Un dato que se puede meter adentro del texto de un mensaje. */
export type VariableAviso = {
  key: string;
  label: string;
  ejemplo: string;
  /** Qué hace falta para que se pueda resolver. Es lo que filtra el selector. */
  alcance: 'siempre' | 'lead' | 'cron';
};

/**
 * EL CATÁLOGO, con la regla de admisión escrita al lado de cada fila: acá sólo entra
 * lo que quien EMITE ya tiene en la mano.
 *
 * Lo que NO entra, y por qué: el presupuesto, el gasto y el CPL de los anuncios. Traer
 * un número de Meta son ~900 ms medidos y las lecturas de ads están marcadas `lenta`
 * en el registro; un webhook con `maxDuration` que espera eso es un aviso que no sale.
 * Para eso está `{{link_anuncios}}`, que lleva a la pantalla donde el número está
 * FRESCO — que es, textual, «para evitar poner mucha info dentro de un mensaje y
 * aprovechar este sistema». El día que un aviso lo dispare un cron que YA leyó Meta,
 * ese cron pasa los números y la variable entra con alcance propio.
 */
export const VARIABLES_AVISO: VariableAviso[] = [
  // Del lead: viajan en el evento que dispara el aviso. Cero queries.
  { key: 'lead_nombre', label: 'Nombre del lead', ejemplo: 'Sofía Contreras', alcance: 'lead' },
  { key: 'link_lead', label: 'Link a la ficha del lead', ejemplo: '/crm/2498/resumen', alcance: 'lead' },
  // Del momento, en la zona del negocio. Se calculan.
  { key: 'fecha', label: 'La fecha de hoy', ejemplo: '30/09', alcance: 'siempre' },
  { key: 'hora', label: 'La hora', ejemplo: '09:00', alcance: 'siempre' },
  { key: 'negocio', label: 'El nombre del negocio', ejemplo: 'Código Inmobiliario', alcance: 'siempre' },
  // Los links a una pantalla: una constante más la base. Son los que evitan pegar
  // media pantalla adentro de un WhatsApp.
  { key: 'link_crm', label: 'Link al CRM', ejemplo: '/crm', alcance: 'siempre' },
  { key: 'link_anuncios', label: 'Link a los anuncios', ejemplo: '/ads-manager', alcance: 'siempre' },
  { key: 'link_plan', label: 'Link al plan', ejemplo: '/plan', alcance: 'siempre' },
  { key: 'link_chat', label: 'Link a las conversaciones', ejemplo: '/whatsapp', alcance: 'siempre' },
  { key: 'link_integraciones', label: 'Link a integraciones', ejemplo: '/integraciones', alcance: 'siempre' },
  { key: 'link_configuraciones', label: 'Link a configuraciones', ejemplo: '/configuraciones', alcance: 'siempre' },
];

/** Las rutas de los links, sin la base. Se arma en el server, que sabe la base. */
export const RUTA_DE_LINK: Readonly<Record<string, string>> = {
  link_crm: '/crm',
  link_anuncios: '/ads-manager',
  link_plan: '/plan',
  link_chat: '/whatsapp',
  link_integraciones: '/integraciones',
  link_configuraciones: '/configuraciones',
};

/** Las que ese mensaje puede resolver de verdad. Ofrecer el resto es prometer un dato
 *  que no existe — y lo que sale al WhatsApp del cliente es el `{{token}}` crudo. */
export function variablesPara(opts: { conLead: boolean }): VariableAviso[] {
  return VARIABLES_AVISO.filter((v) => v.alcance !== 'lead' || opts.conLead);
}

/**
 * Sustituye los tokens conocidos. Lo desconocido se DEJA INTACTO, a propósito: un
 * token que sale crudo se ve raro y se nota; uno borrado deja el mensaje cojo y nadie
 * se entera de que faltaba algo.
 *
 * ⚠️ NO reusa `aplicarVariables` de lib/template-vars.ts: aquélla acepta `{una llave}`
 * y su regex es `[a-z_]+` sin dígitos, porque la comparte la NUTRICIÓN con la sintaxis
 * de Meta. Ampliarla para que acepte estos tokens convertiría un `{1}` de un copy de
 * nutrición en un candidato, y esa función además decide qué parámetros se registran
 * en Meta. Dos preguntas distintas, dos regex.
 */
export function resolverVariables(texto: string, vars: Record<string, string>): string {
  if (typeof texto !== 'string' || !texto) return '';
  return texto.replace(RE_VARIABLE, (m) => {
    const k = m.slice(2, -2).toLowerCase();
    return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k]! : m;
  });
}

/** Con qué se dibuja la vista previa: el `ejemplo` de cada uno. */
export function valoresDeEjemplo(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of VARIABLES_AVISO) out[v.key] = v.ejemplo;
  return out;
}
