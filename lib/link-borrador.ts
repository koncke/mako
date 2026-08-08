// =============================================================================
// link-borrador — el link del borrador no lo escribe el modelo, lo escribe el código
// =============================================================================
// El id de un borrador es `prop` + base36 aleatorio: `propmskimbc4s4b4h`, 17
// caracteres sin ninguna redundancia. El código lo arma bien y se lo pasa a la
// tool, pero después la instrucción le pide al modelo que MANDE ese link — o sea
// que la integridad del id queda colgando de que un LLM copie 17 caracteres al
// azar sin errarle a uno.
//
// No aguantó. Lo medido en prod:
//   · «Este borrador ya no existe»: el id que llegó no era ninguno de los creados.
//   · Y el modo peor, porque es silencioso: un link que resolvía a un borrador
//     REAL pero EQUIVOCADO (1 tarea sobre un Reel de Instagram, cuando lo que
//     había que revisar eran 3 tareas de otra cosa). Ahí nadie se entera de nada:
//     la pantalla abre, muestra un borrador, y no es el tuyo.
//
// Pedirle al modelo que copie mejor no es una solución — es la misma clase de
// regla-en-prosa que ya falló con los tipos de pregunta y con el nombre de la
// marca. Acá la salida se CORRIGE, con el id que devolvió la tool como verdad.
//
// Sin `server-only`: es una función pura y se testea sola.

/**
 * Deja el texto con EL link correcto del borrador.
 *
 * Tres casos, y los tres importan:
 *   1. El modelo escribió el link bien   → no se toca nada.
 *   2. Lo escribió con el id cambiado    → se reemplaza por el bueno.
 *   3. No lo escribió                    → se agrega al final.
 *
 * `canonico` es el link que devolvió `crearPropuesta` en esta misma corrida. Si no
 * hay ninguno (la respuesta no armó un borrador), el texto se devuelve intacto:
 * esta función NUNCA inventa un link.
 */
export function corregirLinkBorrador(texto: string, canonico: string | null | undefined): string {
  const link = (canonico ?? '').trim();
  if (!texto || !link) return texto;

  // Cualquier cosa que se parezca a un link de revisión, venga con el host que
  // venga (el modelo a veces cambia el dominio o se olvida el https).
  const RE_REVISAR = /(?:https?:\/\/)?[^\s<>()"']*\/plan\/revisar\/[A-Za-z0-9_-]+/g;
  const encontrados = texto.match(RE_REVISAR) ?? [];

  if (!encontrados.length) {
    // Se lo tragó. Va en su propia línea al final: pegado al texto, WhatsApp a veces
    // se come el último carácter al armar la vista previa.
    return `${texto.trimEnd()}\n\n${link}`;
  }
  // Todos al canónico. Son todos EL MISMO borrador: esta corrección se aplica por
  // corrida y una corrida arma un borrador — si alguna vez armara dos, se pasa el
  // link de a uno y esto no se usa (ver `corregirLinksBorrador`).
  let out = texto.replace(RE_REVISAR, link);
  // Y si el modelo lo repitió tres veces, queda tres veces el mismo: se deduplica
  // dejando la primera. Un mensaje de WhatsApp con el mismo link tres veces se lee
  // como un error de la app.
  let visto = false;
  out = out.replace(new RegExp(escapar(link), 'g'), (m) => { if (visto) return ''; visto = true; return m; });
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * El id que hay adentro de un link de revisión, o null. Sirve para saber si lo que
 * escribió el modelo coincide con lo que se creó — y por lo tanto para poder LOGUEAR
 * cuándo se equivoca, que es la única forma de saber si esto sigue pasando.
 */
export function idDeLinkRevisar(texto: string): string | null {
  const m = texto.match(/\/plan\/revisar\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
