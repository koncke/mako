// =============================================================================
// grupos-guardados — qué grupos de WhatsApp SÍ se guardan
// =============================================================================
// Sin `server-only`: lo importa el webhook y lo importa un test.
//
// ⚠️ EN POSITIVO, Y ES LA REGLA DE LA CASA. «Solo ESTE grupo», nunca «cualquiera
// menos los personales». La línea de voz de MaKo es el WhatsApp PERSONAL de
// Martín: 77 grupos, con «Primos 🇵🇾», «Círculo Financiero» y «LOS BUSTOS»
// adentro. Una lista negra deja entrar a todo grupo nuevo sin que nadie avise —
// o sea que la vida privada de una persona se aspiraría a la base del producto
// por omisión.
//
// ⚠️ Y POR QUÉ HAY QUE GUARDARLOS, medido el 27/09/2026: los 24 audios del grupo
// «Makito» (11 minutos de feedback de Joan y Juan Francisco sobre MaKo) están
// PERDIDOS. Evolution no guarda la media, guarda el link cifrado del CDN de
// WhatsApp y lo va a buscar cuando se lo piden — y ese link caduca. El de un
// audio del 24/08 venció el 23/09 19:09 UTC:
//
//     Failed to fetch stream from https://mmg.whatsapp.net/…&oe=6AB423D5
//
// Los mensajes de TEXTO del grupo sí se pudieron leer (234, del 21/08 al 01/09):
// ésos viven en el store de Evolution y no dependen de ningún CDN. Lo que se
// evapora a los ~30 días es la media.
//
// La diferencia con un chat 1-a-1, que es lo que hace que esto se sienta como un
// bug: en un 1-a-1 el webhook baja los bytes y los sube a NUESTRO bucket
// (`subirMedia`), así que el audio se escucha para siempre. En un grupo, el
// webhook se iba antes de llegar ahí.

/**
 * Los grupos cuyos mensajes se persisten, con el porqué de cada uno al lado.
 *
 * Un grupo que no está acá se ignora igual que siempre: esta lista es lo único
 * que abre la puerta.
 */
export const GRUPOS_GUARDADOS: ReadonlyArray<{ jid: string; nombre: string; porque: string }> = [
  {
    jid: '120363411300409914@g.us',
    nombre: 'Makito',
    porque: 'Es donde Joan Dowd y Juan Francisco dejan el feedback de MaKo, y la mitad llega en audios que caducan a los ~30 días. Pedido de Martín el 27/09/2026: «guarda todo lo del grupo de Makito siempre, porque es un grupo donde me pasan feedback».',
  },
];

const JIDS = new Set(GRUPOS_GUARDADOS.map((g) => g.jid));

/** ¿Este chat es un grupo que hay que guardar? */
export const grupoSeGuarda = (chatJid: string): boolean => JIDS.has(chatJid);

/** ¿Es un grupo? (el resto de los jids de WhatsApp no terminan así). */
export const esGrupoJid = (chatJid: string): boolean => chatJid.endsWith('@g.us');
