// =============================================================================
// offer-quien-hace — los detectores de QUIÉN HACE EL TRABAJO en una oferta (puro)
// =============================================================================
// Feedback de la llamada con Leila (12/10/2026): Martín, «yo no le puedo prometer implementar una estructura cuando lo
// tiene que hacer él… Es un curso»; Leila, hay que distinguir «do-it-yourself, done-with-you y done-for-you». La regla
// que los usa es `prometeHacerloPorElCliente` (lib/offer-reglas.ts).
//
// Aparte, y FUERA de la guarda de voseo (tests/puente-panel-copy.test.ts, FUERA_DE_ALCANCE): son detectores, y tienen
// que nombrar «por vos» para RECONOCERLO en lo que escribió el dueño o la IA (MaKo le habla al dueño en rioplatense, y
// el dueño escribe como escribe). No son copy: nada de acá se le muestra a nadie.

/** Lo que vende el dueño lo hace el CLIENTE: un curso, una membresía, un grupo, un acompañamiento. */
export const RE_LO_HACE_EL_CLIENTE = /\bcurso|\bgrabad|\bmembres[ií]a|\bclases?\b|\btaller|\bcapacitaci|\bentrenamiento|\bgrupal|\bmentor[ií]a|\bacompa[ñn]amiento/i;

/** …salvo que el dueño diga que lo hace POR el cliente. */
export const RE_LO_HACE_EL_NEGOCIO = /\b(?:lo hago|lo hacemos|hecho|lo implemento|lo implementamos) (?:yo |nosotros )?por (?:ti|vos|el cliente|ellos|mis clientes)|done.?for.?you|\bagencia\b|llave en mano/i;

/** Lo que en la oferta promete hacerlo POR el cliente. */
export const RE_PROMETE_HACERLO = /\bimplementamos\b|\blo (?:hacemos|implementamos) por (?:ti|vos)\b|\bte lo (?:implementamos|dejamos (?:funcionando|listo|armado))\b|\bnos encargamos de\b|\bejecutad[oa] por (?:el|nuestro) equipo\b|\bhecho por nosotros\b/i;
