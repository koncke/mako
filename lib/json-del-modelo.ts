// =============================================================================
// El JSON que escribe un modelo no es JSON: es texto que casi siempre lo es
// =============================================================================
// ⚠️ ESTE MÓDULO EXISTE PORQUE EL DUEÑO VIO ESTO EN UNA REUNIÓN CON SU CLIENTE:
//
//     No se pudo armar el plan: Expected ',' or ']' after array element in JSON
//     at position 631 (line 9 column 6)
//
// El modelo había escrito el plan entero —diez tomas, bien— y le faltó UNA coma
// entre dos elementos de un array. `JSON.parse` es binario: o entra todo o no entra
// nada, y el error que tira es para un programador, no para la persona que está
// mostrando el producto.
//
// Los modos de falla son POCOS y siempre los mismos, y ninguno es ambiguo de
// reparar cuando se camina el texto sabiendo si se está adentro o afuera de un
// string:
//
//   · una coma que falta entre dos valores        `} {`   `] [`   `" "`
//   · una coma que sobra antes de cerrar          `, }`   `, ]`
//   · una comilla de diálogo sin escapar          `"dijo "hola" y se fue"`
//   · un salto de línea crudo adentro de un string
//   · las cercas ``` y la prosa antes o después del objeto
//
// ⚠️ SE REPARA SÓLO SI EL PARSE DIRECTO FALLA. Un JSON válido no se toca: cualquier
// heurística sobre texto válido es una oportunidad de romperlo.
//
// Había TRES copias de `parseJsonObject` en el repo, idénticas y todas ingenuas.
// «Una regla aplicada en un lugar de tres no está implementada, está documentada»:
// las tres delegan acá.
//
// SIN `server-only`: es lógica de strings, y la usa también el test.

/** Saca las cercas de markdown y se queda con el objeto exterior. */
export function extraerObjeto(texto: string): string {
  const c = String(texto ?? '').replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const a = c.indexOf('{');
  if (a === -1) throw new Error('respuesta sin JSON');
  const b = c.lastIndexOf('}');
  // Sin llave de cierre es un JSON TRUNCADO (el modelo se quedó sin tokens), no
  // una respuesta sin JSON: se devuelve lo que hay para que el error lo diga.
  return c.slice(a, b > a ? b + 1 : c.length);
}

const CIERRAN_VALOR = new Set([',', '}', ']', ':']);

/** El próximo carácter que no es espacio, a partir de `i` (o '' al final). */
function siguienteNoEspacio(s: string, i: number): { c: string; en: number } {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j++;
  return { c: j < s.length ? s[j] : '', en: j };
}

/**
 * ¿Esta comilla, estando ADENTRO de un string, es la que lo cierra?
 *
 * Cierra si lo que sigue es lo que sigue a un valor (`,` `}` `]` `:`) o el final.
 * Con `,` se mira un paso más: `"hola", dijo` es diálogo —después de la coma viene
 * una palabra—; `"hola", "otra"` es un array —después de la coma viene otro valor—.
 */
function esComillaDeCierre(s: string, i: number): boolean {
  const { c, en } = siguienteNoEspacio(s, i + 1);
  if (c === '') return true;
  // Otra comilla, o una llave/corchete que abre: es el valor SIGUIENTE sin su coma
  // (`"x" "y"`, `"x" {`). Un diálogo no pega dos comillas ni abre un objeto.
  if (c === '"' || c === '{' || c === '[') return true;
  if (!CIERRAN_VALOR.has(c)) return false;
  if (c !== ',') return true;
  const d = siguienteNoEspacio(s, en + 1).c;
  return d === '' || d === '"' || d === '{' || d === '[' || d === '}' || d === ']' || /[-0-9tfn]/.test(d);
}

/**
 * Repara los modos de falla conocidos, caminando el texto con estado de string.
 *
 * Devuelve el texto reparado; NO garantiza que parsee. Quien llama vuelve a
 * intentar `JSON.parse` y decide.
 */
export function repararJson(entrada: string): string {
  const s = entrada;
  let out = '';
  let enString = false;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (enString) {
      if (ch === '\\') {
        // Un escape ya escrito se copia entero (incluida la comilla escapada).
        out += ch + (s[i + 1] ?? '');
        i += 2;
        continue;
      }
      if (ch === '"') {
        if (esComillaDeCierre(s, i)) { enString = false; out += ch; }
        else out += '\\"'; // comilla de diálogo: se escapa y el string sigue
        i++;
        continue;
      }
      // Un salto de línea o tabulación crudos adentro de un string no son JSON.
      if (ch === '\n') { out += '\\n'; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\t') { out += '\\t'; i++; continue; }
      out += ch;
      i++;
      continue;
    }

    // Afuera de un string.
    if (ch === '"') { enString = true; out += ch; i++; continue; }

    if (ch === ',') {
      // Coma que sobra antes de cerrar.
      const { c } = siguienteNoEspacio(s, i + 1);
      if (c === '}' || c === ']') { i++; continue; }
      out += ch;
      i++;
      continue;
    }

    out += ch;
    // Coma que falta: después de cerrar un valor (`}` `]` o el fin de un string,
    // que ya se emitió arriba) viene otro valor sin separador.
    if (ch === '}' || ch === ']') {
      const { c } = siguienteNoEspacio(s, i + 1);
      if (c === '{' || c === '[' || c === '"') out += ',';
    }
    i++;
  }
  // El caso del string: al cerrar uno, si lo que sigue abre otro valor, faltó la coma.
  // Se hace en una segunda pasada barata sobre lo ya reparado, con el mismo estado.
  return insertarComasTrasString(out);
}

/** `"a" "b"` o `"a" {` fuera de contexto de clave → falta una coma. */
function insertarComasTrasString(s: string): string {
  let out = '';
  let enString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    out += ch;
    if (enString) {
      if (ch === '\\') { out += s[i + 1] ?? ''; i++; continue; }
      if (ch === '"') {
        enString = false;
        const { c } = siguienteNoEspacio(s, i + 1);
        // Después de cerrar un string, `:` significa que era una clave; cualquier
        // otro valor que arranque ahí mismo significa que faltó la coma.
        if (c === '"' || c === '{' || c === '[') out += ',';
      }
      continue;
    }
    if (ch === '"') enString = true;
  }
  return out;
}

/**
 * El objeto que el modelo quiso escribir.
 *
 * Primero tal cual; si no parsea, reparado. Si tampoco, tira con un mensaje que
 * dice de quién es la culpa y conserva el error original para diagnosticar.
 */
export function parseJsonObject(texto: string): Record<string, unknown> {
  const crudo = extraerObjeto(texto);
  try {
    return JSON.parse(crudo) as Record<string, unknown>;
  } catch (e1) {
    const reparado = repararJson(crudo);
    try {
      return JSON.parse(reparado) as Record<string, unknown>;
    } catch {
      const msg = e1 instanceof Error ? e1.message : String(e1);
      throw new Error(`el modelo devolvió un JSON inválido y no se pudo reparar (${msg})`);
    }
  }
}
