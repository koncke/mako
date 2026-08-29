// =============================================================================
// mako-knowledge-seed — cursos curados listos para "bajar a tierra" (importar)
// =============================================================================
// Cada curso es un paquete de entradas de conocimiento (metodología destilada de
// un autor/framework) que se importa con un click a mako_knowledge (embebe cada
// entrada). Empieza con "Levanta Muertos" (reactivación de leads por mensaje).
// A futuro se agregan más cursos/autores acá (ej. ads) sin tocar el resto.
//
// NO es "server-only": es data pura. La escritura la hace el caller (ruta server)
// vía createKnowledge, que embebe cada entrada.

export type CuratedEntry = { titulo: string; categoria: string; cuerpo: string };
export type CuratedCurso = {
  clave: string;        // id estable para no re-sembrar (cursoExiste(curso))
  curso: string;        // nombre visible / agrupador en mako_knowledge.curso
  autor: string;
  area: 'mensajes' | 'ads' | 'general';
  descripcion: string;  // qué es y para qué sirve (UI)
  entradas: CuratedEntry[];
};

// ── Levanta Muertos ──────────────────────────────────────────────────────────
// Destilado de la documentación de "Levanta Muertos" (síntesis de Julio Iero,
// Gallo Reyna y Allen Hernández — C.I.A.). Área: mensajes (WhatsApp / DM / email).
const LEVANTA_MUERTOS: CuratedCurso = {
  clave: 'levanta-muertos',
  curso: 'Levanta Muertos',
  autor: 'Julio Iero · Gallo Reyna · Allen Hernández (síntesis)',
  area: 'mensajes',
  descripcion:
    'Metodología para reactivar leads que mostraron interés y dejaron de responder, sin sonar necesitado ni insistente. La usa MaKo para recomendarte qué escribir en WhatsApp y para redactar plantillas.',
  entradas: [
    {
      titulo: 'Levanta Muertos — Qué es y los 3 pilares',
      categoria: 'Fundamento',
      cuerpo: `"Levanta Muertos" es reactivar a un prospecto que ya mostró interés (pidió info, tuvo una llamada, vio una propuesta) y después dejó de responder. Se reactiva SIN sonar necesitado, agresivo ni desesperado: cada reactivación se trata como una NUEVA oportunidad, no como una insistencia.

Objetivo: reabrir la conversación y aumentar la probabilidad de respuesta, moviendo al prospecto al siguiente paso — no cerrar de golpe si está frío.

LOS 3 PILARES (obligatorios en cada mensaje):
1. RECONECTAR con el contexto real + el objetivo del prospecto. Retomá exactamente lo que se habló y su problema/beneficio de forma natural. NUNCA escribas "solo te escribo para dar seguimiento".
2. APORTAR VALOR TANGIBLE en el mismo mensaje: un beneficio concreto, un caso real, un recurso o un insight. El prospecto debe ganar algo con solo leer, aunque no avance.
3. CERRAR con UNA sola pregunta clara que permita responder "sí / no / re-agendar" sin presión. Siempre dejar una salida digna.`,
    },
    {
      titulo: 'Levanta Muertos — Estructura C.I.A. y 3 variantes de tono',
      categoria: 'Estructura',
      cuerpo: `ESTRUCTURA C.I.A. (esqueleto de cada mensaje, fluida, sin etiquetar las secciones en el texto final):
- C — CONTEXTO: conexión casual + reafirmación del objetivo del prospecto, anclada en la conversación previa.
- I — INTERÉS: aporte de valor + (cuando encaje) una pregunta suave o un detalle que despierte curiosidad genuina.
- A — ACCIÓN: UNA sola CTA, formulada como pregunta abierta con salida digna ("si esto ya no es prioridad, sin problema, me dices y cierro el tema").

3 VARIANTES DE TONO (generar siempre las tres, cada una con un ángulo distinto):
1. DIRECTO — claro, breve, sin rodeos. Va al punto con respeto. Ideal para leads tibios o marcas de tono directo.
2. CÁLIDO — humano, empático, conversacional. Reconoce que la vida pasa, baja la guardia, cero presión. Ideal para leads fríos o tono cercano.
3. CON GANCHO — abre con curiosidad, novedad o un detalle relevante (un caso, un cambio en la oferta, un recurso nuevo) que justifica reabrir la conversación como algo NUEVO.

Las tres comparten los 3 pilares y la C.I.A., pero cada una usa un ángulo diferente (valor / curiosidad / prueba social / objeción / urgencia elegante / cierre suave / depuración). Nunca repitas el mismo enfoque entre variantes.`,
    },
    {
      titulo: 'Levanta Muertos — Reglas de calidad y prohibiciones',
      categoria: 'Reglas',
      cuerpo: `REGLAS DE CALIDAD:
- Cada mensaje cumple los 3 pilares y sigue la C.I.A.
- Una sola CTA por mensaje, formulada como pregunta abierta.
- Siempre deja una salida digna: que decir "no" sea tan fácil y libre de culpa como decir "sí".
- Personalizá con datos reales del negocio y de la conversación previa.
- Usa solo pruebas sociales reales; NUNCA inventes casos, cifras ni testimonios.
- Adapta longitud y formato al canal (WhatsApp corto + nota de voz máx 40s; email con asunto + cuerpo).
- Español neutro localizable a MX; tono humano y conversacional.
- Si el lead no califica o el objetivo es depurar, entregá mensajes de depuración elegante en lugar de venta.
- Si falta un dato crítico (contexto, objeción o activo de valor), pregunta antes de asumir.

PROHIBIDO (no negociable):
- Frases genéricas de seguimiento: "solo te escribo para dar seguimiento", "¿sigues interesado?", "¿pudiste ver mi mensaje?".
- Sonar necesitado, rogar o insistir; presión, urgencia falsa o culpa emocional.
- Inventar resultados, cifras o testimonios.
- Más de una CTA por mensaje.
- Cerrar vendiendo de golpe si el lead está frío.
- Repetir el mismo ángulo entre variantes.
- Mezclar el formato del canal equivocado (asunto de email en WhatsApp, párrafos largos en SMS).`,
    },
    {
      titulo: 'Levanta Muertos — Por etapa del lead',
      categoria: 'Etapas',
      cuerpo: `Adapta el ángulo según en qué etapa se enfrió el lead:

- PIDIÓ INFO (tibio): retoma EXACTAMENTE lo que preguntó y aporta valor sobre su duda concreta, no un folleto. Cierra con una pregunta de bajo compromiso (mandar un caso, una muestra). No empujes el cierre todavía.
- VIO PROPUESTA / COTIZACIÓN (se congeló): el silencio casi siempre es una objeción no dicha (precio o auto-duda). No repreguntes "¿la viste?". Aporta un ángulo nuevo y abre la puerta a nombrar lo que lo frenó: "normalmente cuando alguien se queda callado aquí es por X o por Y, ¿cuál fue tu caso?". Cierre suave de 3 opciones (entramos / lo movemos / lo paramos).
- OBJECIÓN (ghosting tras una objeción concreta): valida la objeción de frente sin atacar, reencuádrala y ofrece un activo de valor o un paso intermedio. No repitas el argumento que ya no funcionó; cambia el ángulo. Deja el "no" como opción legítima.
- FRÍO / MUY FRÍO (semanas o meses sin contacto): reabre como NUEVA oportunidad, no como seguimiento: usa una novedad real (cambio en la oferta, nuevo caso, nuevo recurso) que justifique escribir. Tono cálido, cero presión. Si no hay novedad real, no inventes: usa valor puro o pasa a depuración.
- DEPURACIÓN (no responde tras varios intentos, o quieres limpiar pipeline): mensaje de depuración elegante — reconoce que las prioridades cambian, cierra el ciclo con dignidad y deja la puerta abierta sin rogar. Una pregunta que facilite el "no" tanto como el "sí". Quitar la presión frecuentemente reactiva al lead.`,
    },
    {
      titulo: 'Levanta Muertos — Coaching y consultoría: psicología y objeciones',
      categoria: 'Nicho · Coaching/Consultoría',
      cuerpo: `PSICOLOGÍA DE COMPRA (coaching/consultoría/formación — el nicho de Mauricio): el comprador no compra un curso ni horas, compra una TRANSFORMACIÓN y la CERTEZA de que esta vez sí lo va a lograr. Decisión 80% emocional. El miedo #1 NO es el precio, es "¿esto a MÍ me va a funcionar?" (auto-desconfianza disfrazada de escepticismo al método). Este público es alérgico al humo: huele la manipulación y la urgencia falsa. Por eso el valor real, la honestidad y BAJAR la promesa a algo creíble venden más que la euforia. El lead casi siempre se enfría por DUDA INTERNA, no por falta de interés en el resultado.

POR QUÉ SE ENFRÍAN: auto-desconfianza ("a mí no me va a funcionar"), escarmiento previo (ya pagó un curso que dejó a la mitad), olor a humo, objeción de precio no dicha, se sintieron presionados, "no es buen momento" real, parálisis por exceso de opciones.

OBJECIONES Y CÓMO MANEJARLAS:
- "Está caro / no me alcanza": no bajes el precio; reencuadra de gasto a inversión y conecta con el costo de seguir igual. Ofrece un paso intermedio. "La pregunta no es si cuesta, es cuánto te está costando seguir otro año en el mismo punto."
- "Ya tomé un curso y no me funcionó": valida sin atacar al competidor; diferencia por mecanismo (acompañamiento vs información suelta). "La mayoría te da info y te deja solo; ahí es donde casi todos lo dejamos a la mitad."
- "No tengo tiempo": no discutas el tiempo; reducí el compromiso percibido y anclá en el costo de postergar.
- "No sé si a MÍ me va a funcionar" (la objeción real del sector, es miedo no lógica): baja la promesa, muestra a alguien parecido, reduce el riesgo. "No te voy a prometer magia."
- "Lo tengo que pensar / lo hablo con mi pareja": respétalo de verdad, dale un activo para pensar mejor y deja salida digna.
- "¿Y tú quién eres?": ofrece prueba verificable y transparencia, sin defenderte con ego.

TONO: humano, cercano y consultivo, de igual a igual. Cero euforia de gurú, cero MAYÚSCULAS, casi sin emojis. La credibilidad viene de BAJAR la promesa y poner el resultado del prospecto por encima de la venta. Valida siempre la duda antes de responderla. En high-ticket, registro más premium y selectivo.`,
    },
    {
      titulo: 'Levanta Muertos — Banco de scripts de WhatsApp',
      categoria: 'Ejemplos',
      cuerpo: `Ejemplos parametrizables (usa {nombre}, {oferta}, {beneficio}, {problema}, {tipo_cliente}, {activo_valor}, {X_tiempo}). Adáptalos al contexto real; no los pegues literales.

VALOR (whatsapp, corto):
"Hola {nombre}, me quedé pensando en lo que me contaste de {problema}. Armé algo que ataca justo eso: {activo_valor}, con los pasos que usamos para llegar a {beneficio}. Te lo paso aunque al final no avancemos juntos, te va a servir igual. ¿Te lo mando?"

PRUEBA SOCIAL (whatsapp, medio):
"Qué tal {nombre}. Te escribo porque un {tipo_cliente} que estaba justo donde tú (atorado con {problema}) acaba de lograr {beneficio} con el proceso del que platicamos, y pensé en ti. ¿Quieres que te pase su caso para que tú mismo juzgues si te hace sentido? Si ya no es para ti, sin bronca, me dices y lo dejamos."

OBJECIÓN precio/duda (whatsapp, medio):
"{nombre}, me quedó claro que lo que te frenaba era esa duda de '¿y si a mí no me funciona?'. Es la más normal del mundo. Por eso no te vendo magia: te muestro a alguien igual que tú que lo logró, y tú decides. ¿Te paso ese caso y de ahí me dices si lo retomamos o lo cerramos? Cualquiera de las dos me parece bien."

CIERRE SUAVE / último intento (whatsapp, corto):
"Hola {nombre}, sin rodeos: ya vimos que {beneficio} es algo que de verdad quieres y {oferta} es el camino más directo. No te quiero apurar, solo cerrar el tema con claridad. ¿Lo arrancamos esta semana, lo dejamos para más adelante, o de plano lo paramos? La respuesta que sea está bien para mí."

DEPURACIÓN elegante (whatsapp, corto):
"Hola {nombre}, lo platicamos hace {X_tiempo} y entiendo que las prioridades cambian. No quiero ser una notificación más. Si {beneficio} sigue en tus planes, aquí estoy cuando lo quieras retomar; y si hoy ya no es para ti, dímelo con confianza y cierro el tema sin problema. ¿Cómo lo ves?"

GUION DE NOTA DE VOZ (máx 40s, curiosidad):
"Hola {nombre}, soy [tu nombre]. Oye, me acordé de ti por algo concreto: cambiamos una parte de cómo trabajamos {oferta} y justo resuelve lo que me comentabas de {problema}, creo que ahora te encaja mejor que antes. Te lo cuento en dos minutos por aquí o por llamada, lo que prefieras. Y si ya no es tu momento, me dices con confianza y sin pena, va."`,
    },
    {
      titulo: 'Levanta Muertos — Secuencias 7/14/21 días',
      categoria: 'Secuencias',
      cuerpo: `No es un mensaje aislado: una secuencia corta de alto impacto, cada día con un ángulo y un tipo de valor distinto.

SECUENCIA 7 DÍAS (WhatsApp):
- Día 1 — Valor directo: "vi que dejamos pendiente lo de {oferta}. Te mando rápido 2 formas en las que está ayudando a otros {tipo_cliente} a {beneficio}. Si te hace sentido lo vemos, si no lo dejamos aquí."
- Día 3 — Caso de uso: "te comparto un caso de un cliente que estaba en una situación parecida a la tuya y qué cambió después de {oferta}. ¿Te lo cuento en 3 mensajes cortos?"
- Día 5 — Prueba social: cita breve o resultado real anonimizado + pregunta "¿te gustaría lograr algo parecido en {X tiempo}?".
- Día 7 — Cierre suave: "¿qué prefieres? 1) Lo vemos esta semana. 2) Lo dejamos para más adelante. 3) Mejor no avanzar. Cualquiera está bien, solo quiero respetar tu tiempo."

SECUENCIA 14 DÍAS (email + WhatsApp mixto):
- Día 1: email de valor con mini diagnóstico.
- Día 4: WhatsApp corto con pregunta abierta.
- Día 8: email con caso de éxito y CTA clara.
- Día 12: WhatsApp breve "sigo aquí si lo necesitas" + opción de salir.
- Día 14: email de cierre suave ("cierro carpeta o lo retomamos con ajustes").

Regla: cero presión, valor inmediato, cerrar siempre con pregunta abierta y salida digna. Si en algún punto el lead responde, se sale de la secuencia y se conversa.`,
    },
  ],
};

export const CURATED_CURSOS: CuratedCurso[] = [LEVANTA_MUERTOS];

export function getCuratedCurso(clave: string): CuratedCurso | undefined {
  return CURATED_CURSOS.find((c) => c.clave === clave);
}
