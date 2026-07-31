// =============================================================================
// guion-angulos — la biblioteca de ÁNGULOS DE GUION (el enfoque de cada anuncio)
// =============================================================================
// Un ÁNGULO DE GUION es el ENFOQUE estratégico del anuncio: desde dónde le entra
// al espectador (su dolor, un testimonio, un regalo, una comparación…). NO es el
// FORMATO de video (lib/angulos-formatos: cómo se VE el creativo) ni la
// ESTRUCTURA (lib/guion-estructuras: el orden de los bloques) — un ángulo puede
// contarse con varias estructuras (estructuras[] = las compatibles, la primera
// es la sugerida) y una celda de la matriz puede tener VARIOS guiones, cada uno
// con su ángulo. Eso es exactamente lo que se testea en Meta.
//
// Cada ángulo es un PAQUETE completo para la IA y para el wizard:
//  · requisitos    → qué tiene que existir en el negocio para usarlo con honestidad.
//  · ejemplosHook  → patrones de apertura probados (con [placeholders]).
//  · cuerpo / cta  → guía concreta de cómo se desarrolla y cómo cierra.
//  · siempre/nunca → reglas duras del ángulo.
//  · preguntas     → lo que el wizard le pregunta al dueño ANTES de generar
//                    (sus respuestas entran al prompt como contexto).
//
// DATOS PUROS (sin 'server-only'). El super-admin edita el catálogo en la
// página "Guiones" del sidebar — override global en el OWNER_WS
// (lib/guion-angulos-store.ts) que pisa este catálogo por completo.
// =============================================================================

export type AnguloGuion = {
  id: string;
  nombre: string;
  emoji: string;
  /** Cuándo usarlo (1 frase — se muestra en la card al elegir ángulo). */
  cuando: string;
  /** Qué debe existir en el contexto del negocio para usar este ángulo. */
  requisitos: string;
  /** Patrones de hook de apertura (con [placeholders]). */
  ejemplosHook: string[];
  /** Guía del CUERPO del guion bajo este ángulo. */
  cuerpo: string;
  /** Guía del CTA bajo este ángulo (el destino real lo pone el funnel). */
  cta: string;
  /** Reglas duras: SIEMPRE hacer. */
  siempre: string[];
  /** Reglas duras: NUNCA hacer. */
  nunca: string[];
  /** Preguntas al dueño antes de generar (sus respuestas van al prompt). */
  preguntas: string[];
  /** Estructuras compatibles (ids de lib/guion-estructuras); la primera es la sugerida. */
  estructuras: string[];
  /** false = no se ofrece al elegir (el super-admin lo apagó sin borrarlo). */
  activo: boolean;
};

/** El paquete del ángulo como texto de prompt para el generador de guiones. */
export function instruccionesTexto(a: AnguloGuion): string {
  const partes: string[] = [];
  if (a.requisitos) partes.push(`Cuando aplica: ${a.requisitos}`);
  partes.push(a.cuerpo);
  if (a.ejemplosHook.length) partes.push(`Patrones de hook para el bloque de apertura (adaptalos al negocio real, no los copies literal):\n${a.ejemplosHook.map((h) => `- ${h}`).join('\n')}`);
  if (a.cta) partes.push(`El CTA bajo este angulo: ${a.cta}`);
  if (a.siempre.length) partes.push(`SIEMPRE:\n${a.siempre.map((s) => `- ${s}`).join('\n')}`);
  if (a.nunca.length) partes.push(`NUNCA:\n${a.nunca.map((s) => `- ${s}`).join('\n')}`);
  return partes.join('\n\n');
}

// ── El catálogo por default ───────────────────────────────────────────────────
// El super-admin lo edita/expande desde la página "Guiones" (override completo).
export const ANGULOS_GUION_DEFAULT: AnguloGuion[] = [
  {
    id: "dolor", nombre: "Dolor", emoji: "😩", activo: true,
    cuando: "Tráfico frío que siente el problema pero todavía no busca solución — el default para arrancar campañas.",
    requisitos: "Funciona mejor cuando el contexto del negocio tiene un dolor específico y bien documentado del avatar (síntomas concretos del día a día, no categorías genéricas). No requiere casos ni pruebas: requiere conocer al avatar lo suficiente para nombrar su síntoma exacto.",
    ejemplosHook: [
      "Si te pasa [dolor], deja de hacer scroll.",
      "¿Por qué sigues con [dolor] aunque ya probaste [solución típica]?",
      "[Consecuencia cara] no es tu culpa: es culpa de [causa inesperada].",
      "Hay una razón por la que cada [momento recurrente] terminas [síntoma exacto].",
      "Nadie te lo dice, pero [dolor] te está costando [costo concreto] cada mes.",
    ],
    cuerpo: "Después del gancho, agita el costo de seguir igual: tiempo, dinero y frustración diaria, aterrizados en una escena que el avatar viva en carne propia ('otra vez domingo en la noche contestando mensajes en lugar de cenar con tu familia'). Desarrolla la escalada del dolor antes de mencionar cualquier solución: primero el síntoma, luego la consecuencia acumulada, luego el punto donde el avatar dice 'así ya no'. Recién entonces presenta el servicio como la salida natural, en una o dos frases, conectándolo directamente con el síntoma nombrado ('para eso existe exactamente [servicio]: para que [síntoma] deje de pasar'). Mantén el cuerpo en segunda persona y en presente, como si describieras la semana del espectador, no un caso abstracto.",
    cta: "El CTA debe sentirse como un alivio, no como una venta: la puerta de salida del dolor que acabas de describir. Tono empático y de siguiente paso pequeño, sin presión de urgencia. Ejemplo: 'Si esto te sonó demasiado familiar, da el primer paso hoy.'",
    siempre: [
      "Nombra el dolor específico del avatar en los primeros 3 segundos.",
      "Usa el síntoma exacto que aparece en el contexto del negocio, con detalles de escena.",
      "Agita el costo de seguir igual antes de presentar la solución.",
      "Escribe en segunda persona, hablándole directo al avatar.",
      "Cuanto más estrecho el dolor, mejor: filtra a propósito.",
    ],
    nunca: [
      "Nunca nombres el producto ni la marca en el gancho.",
      "Nunca uses dolores genéricos tipo 'no tienes tiempo' o 'quieres crecer'.",
      "Nunca presentes la solución antes de haber agitado el problema.",
      "Nunca exageres el dolor hasta lo catastrófico: pierde credibilidad y Meta lo castiga.",
      "Nunca culpes al avatar por su situación.",
    ],
    preguntas: [
      "¿Cuál es la queja exacta, con sus palabras, que más escuchas de tus clientes antes de contratarte?",
      "¿En qué momento del día o de la semana ese dolor duele más?",
      "¿Qué ya intentaron para resolverlo y no les funcionó?",
    ],
    estructuras: ["gancho-historia-cta", "pas", "bab"],
  },
  {
    id: "lead-magnet", nombre: "Lead Magnet (regalo)", emoji: "🎁", activo: true,
    cuando: "Tráfico frío donde pedir la compra directa es demasiado: el objetivo es el registro, no la venta.",
    requisitos: "Requiere que exista un lead magnet real y definido en el contexto del negocio (checklist, guía, plantilla, clase), con contenido conocido. Sin entregable concreto, este ángulo no se puede usar: no se le inventa contenido a un regalo que no existe.",
    ejemplosHook: [
      "Te voy a regalar [lead magnet] que me costó [tiempo/dinero] armar. Gratis.",
      "Hice el trabajo sucio por ti: [lead magnet] listo para usar hoy.",
      "Si [condición calificadora del avatar], esto es para ti.",
      "Deja de buscar en Google cómo [resultado]: ya te lo dejé resuelto en [lead magnet].",
      "Esto normalmente lo cobro; hoy te lo llevas gratis: [lead magnet].",
    ],
    cuerpo: "El guion entero gira alrededor del entregable: describe qué contiene el lead magnet y el resultado específico que produce, con precisión de inventario ('no es una guía útil: es el checklist exacto de 12 puntos para [resultado] en [plazo]'). Después suma una línea de credibilidad de por qué el negocio puede regalar esto ('es el mismo proceso que usamos con nuestros clientes'). Enfatiza el desequilibrio de valor: cuánto costó armarlo versus lo poco que cuesta obtenerlo. No vendas el servicio principal en ningún momento; el único trabajo del cuerpo es hacer que el regalo se sienta imperdible y de aplicación inmediata.",
    cta: "El CTA es de fricción cero: obtener el regalo debe sonar instantáneo, sin compromiso y sin letra chica. Usa palabras como 'gratis' y 'ahora' y deja claro que es un solo paso. Ejemplo: 'Descárgalo gratis ahora, te toma menos de un minuto.'",
    siempre: [
      "Califica al avatar o promete el regalo en la primera frase.",
      "Describe el contenido del lead magnet con especificidad de inventario, no con vaguedad.",
      "Vende el regalo, no el servicio principal.",
      "Incluye una línea de credibilidad de por qué el negocio puede regalar esto.",
      "Deja claro que obtenerlo es un solo paso.",
    ],
    nunca: [
      "Nunca inventes contenido que el lead magnet no tenga.",
      "Nunca pidas más de un paso (solo descargar o registrarse).",
      "Nunca uses promesas vagas tipo 'una guía muy útil'.",
      "Nunca desvíes el guion a vender el servicio principal.",
      "Nunca escondas que hay que registrarse si el flujo lo requiere: fricción sorpresa mata la confianza.",
    ],
    preguntas: [
      "¿Qué incluye exactamente el recurso que regalas (puntos, páginas, plantillas)?",
      "¿Qué resultado concreto obtiene alguien que lo aplica, y en cuánto tiempo?",
      "¿Por qué tú puedes regalar esto (de dónde sale ese conocimiento)?",
    ],
    estructuras: ["gancho-propuesta-cta", "aida"],
  },
  {
    id: "educativo", nombre: "Educativo (pasos/tips)", emoji: "🎓", activo: true,
    cuando: "Tráfico frío: gana atención regalando valor útil antes de pedir nada.",
    requisitos: "Requiere que el negocio tenga conocimiento accionable real que pueda regalar: pasos o tips que el espectador pueda aplicar hoy aunque nunca compre. Funciona mejor cuando el método del negocio se puede descomponer en 2-3 acciones concretas con verbo.",
    ejemplosHook: [
      "[N] [trucos/pasos] para [resultado] que ojalá hubiera conocido antes.",
      "Así es exactamente como [lograr resultado], paso a paso.",
      "Te enseño en [N] segundos lo que a mí me tomó [años/mucho dinero] aprender.",
      "El paso 3 es el que casi nadie hace, y es el que más [resultado] genera.",
      "Si quieres [resultado], solo necesitas hacer estas [N] cosas.",
    ],
    cuerpo: "Promete el resultado en los primeros 2 segundos y entrega 2-3 pasos numerados de verdad accionables: cada paso es una acción concreta con verbo, no teoría ('paso 1: escribe hoy a tus últimos 10 clientes y pregúntales X'). Usa el formato numerado porque señala orden y payoff garantizado, y guarda el mejor tip para el final para sostener la retención ('y el tercero es el que cambia todo'). El servicio aparece DENTRO de uno de los pasos como herramienta natural del proceso, nunca como pitch separado al final. Cierra el valor completo antes del CTA: el espectador debe sentir que ya ganó algo aunque no haga clic.",
    cta: "CTA suave y contextual, con energía de mentor y no de vendedor: la compra es el atajo para quien no quiere hacerlo solo. Ejemplo: 'Y si prefieres que esto lo hagamos por ti, ya sabes dónde encontrarnos.'",
    siempre: [
      "Promete el resultado en los primeros 2 segundos.",
      "Entrega pasos aplicables hoy, cada uno con un verbo de acción.",
      "Usa formato numerado y anuncia cuántos pasos son.",
      "Guarda el mejor tip para el final.",
      "Integra el servicio dentro de un paso, como herramienta natural.",
    ],
    nunca: [
      "Nunca des teoría abstracta ni consejos que no se puedan ejecutar hoy.",
      "Nunca cierres con un pitch duro con energía de vendedor.",
      "Nunca guardes todo el valor 'para el final' sin entregar nada: eso es clickbait.",
      "Nunca uses más de 3-4 pasos: se diluye la retención.",
      "Nunca hagas depender los pasos de comprar el servicio: deben funcionar solos.",
    ],
    preguntas: [
      "¿Qué 2-3 acciones concretas le enseñarías gratis a alguien para lograr [resultado]?",
      "¿Cuál de esas es la que casi nadie conoce o casi nadie hace?",
      "¿En qué parte de ese proceso entra naturalmente tu servicio?",
    ],
    estructuras: ["gancho-valor-cta", "aida"],
  },
  {
    id: "contrarian", nombre: "Contrarian (romper mitos)", emoji: "🚫", activo: true,
    cuando: "Mercados saturados donde el avatar ya escuchó todos los consejos típicos y está escéptico.",
    requisitos: "Requiere una creencia popular real del mercado del avatar y un argumento DEFENDIBLE con lo que hay en el contexto del negocio (método, lógica, evidencia) de por qué ese consejo falla. Sin mecanismo alternativo que lo respalde, el claim contrario es solo provocación vacía.",
    ejemplosHook: [
      "Deja de hacer [práctica común]: te está frenando [resultado].",
      "Todo el mundo dice [consejo popular]. Es justo lo que está matando tu [métrica].",
      "Opinión impopular: no necesitas [cosa que todos compran], necesitas [alternativa simple].",
      "Llevo [tiempo] en [industria] y te lo confirmo: [creencia popular] es mentira.",
      "Si [consejo popular] funcionara, ya tendrías [resultado]. No lo tienes.",
    ],
    cuerpo: "La estructura es más argumento que historia: afirmación contraria, por qué todos se equivocan, el mecanismo real, CTA. Tras el gancho, sostén la contradicción con lógica y evidencia: explica el fallo del consejo popular con causa y efecto ('todos te dicen que publiques más, pero publicar más sin [X] solo amplifica el problema'). Luego revela qué funciona en su lugar y por qué, apoyándote solo en lo que existe en el contexto del negocio. Presenta el servicio como la encarnación natural de esa verdad alternativa, no como un producto aparte. Ataca prácticas e ideas con precisión quirúrgica; la fuerza del ángulo está en que el argumento cierre, no en el volumen de la provocación.",
    cta: "El CTA invita a actuar según la nueva lógica que acabas de demostrar: tono de 'ahora que lo sabes, haz lo correcto'. Sin urgencia artificial; la disonancia ya hizo el trabajo. Ejemplo: 'Si estás listo para dejar de hacer lo que no funciona, este es el siguiente paso.'",
    siempre: [
      "Abre contradiciendo una creencia establecida y sostén la contradicción todo el guion.",
      "Defiende el claim con lógica y evidencia del contexto del negocio.",
      "Explica el mecanismo real que reemplaza al consejo popular.",
      "Ataca prácticas e ideas, con argumentos de causa y efecto.",
      "Mantén la disonancia del gancho: es lo que frena el scroll.",
    ],
    nunca: [
      "Nunca nombres competidores ni personas específicas.",
      "Nunca suavices el gancho con matices tipo 'bueno, depende'.",
      "Nunca hagas un claim contrario que no puedas defender con el contexto disponible.",
      "Nunca exageres hasta lo absurdo: la audiencia y Meta castigan la exageración.",
      "Nunca contradigas por contradecir: sin mecanismo alternativo no hay ángulo.",
    ],
    preguntas: [
      "¿Qué consejo típico de tu industria crees que está mal o incompleto?",
      "¿Por qué falla ese consejo, en tu experiencia real con clientes?",
      "¿Qué haces tú diferente que demuestra tu punto?",
    ],
    estructuras: ["gancho-valor-cta", "pas"],
  },
  {
    id: "pov-relatable", nombre: "POV / Escena relatable", emoji: "🎬", activo: true,
    cuando: "Formato nativo de feed que parece contenido orgánico: ideal para dolores cotidianos reconocibles.",
    requisitos: "Requiere conocer detalles cotidianos y específicos del día a día del avatar (situaciones, frases, momentos recurrentes) presentes en el contexto del negocio. Funciona mejor con dolores frecuentes y reconocibles al instante, no con problemas abstractos o de baja frecuencia.",
    ejemplosHook: [
      "POV: otra vez [situación frustrante del avatar].",
      "Dime por qué nadie me dijo esto antes de [situación].",
      "Yo, un [avatar], fingiendo que [dolor] no me está comiendo vivo.",
      "Nadie: ... Yo a las [hora] un [día]: [acción absurda que causa el dolor].",
      "Las 5 etapas de [situación recurrente del avatar], en 30 segundos.",
    ],
    cuerpo: "Escribe una mini-escena que el avatar viva cada semana: la frustración con el dolor escala beat a beat hasta un pico ('tercer mensaje sin responder... cuarto... y el cliente ya se fue con otro'), y el servicio entra como la resolución, casi como el remate del chiste. El guion debe sonar a video casero de celular: diálogo natural, humor o ironía suave, frases cortas como se habla de verdad. El problema-solución va contrabandeado dentro de la escena, nunca explicado de frente; el espectador debe entender la solución por lo que pasa, no porque se la expliquen. Usa detalles específicos del contexto del negocio para que el avatar diga 'ese soy yo'.",
    cta: "CTA ligero y con la misma voz casual de la escena, casi como un aparte al final; cualquier formalidad rompe la ilusión de contenido orgánico. Ejemplo: 'Si te vist en esta escena... ya sabes qué hacer.'",
    siempre: [
      "Escribe una escena específica que el avatar viva cada semana.",
      "Usa diálogo natural y tono de video casero de celular.",
      "Escala la frustración hasta un pico antes de la resolución.",
      "Contrabandea el problema-solución dentro de la escena.",
      "Usa humor o ironía suave que nace de la verdad de la situación.",
    ],
    nunca: [
      "Nunca uses lenguaje publicitario ni energía de vendedor: mata el ángulo por completo.",
      "Nunca expliques la moraleja de frente ('y por eso necesitas...').",
      "Nunca uses escenas genéricas que le sirvan a cualquier negocio.",
      "Nunca te burles del avatar: la risa es con él, no de él.",
      "Nunca alargues la escena después del remate: el CTA va inmediato y corto.",
    ],
    preguntas: [
      "¿Cuál es la escena exacta que tu cliente vive cada semana con este problema?",
      "¿Qué frase dice o piensa tu cliente en ese momento de frustración?",
      "¿Hay algún detalle gracioso o absurdo de esa situación que todos reconocen?",
    ],
    estructuras: ["gancho-historia-cta", "pas"],
  },
  {
    id: "historia-fundador", nombre: "Historia del fundador", emoji: "👤", activo: true,
    cuando: "Marcas lideradas por su fundador, cuando su historia de origen conecta con el dolor del avatar.",
    requisitos: "Requiere una historia de origen real y documentada en el contexto del negocio: el problema que el fundador vivió en carne propia, el punto de quiebre y hechos biográficos verificables. Si no existe esa historia documentada, este ángulo no se usa: no se inventa biografía.",
    ejemplosHook: [
      "Creé [servicio] porque no encontraba [solución] que no [defecto de las existentes].",
      "Hace [N] años yo era [situación dolorosa]. Hoy [contraste]. Esta es la historia.",
      "Me dijeron que [idea] era imposible. [N] clientes después, esto pasó.",
      "Perdí [costo real] antes de entender esto. Te lo cuento para que tú no lo pierdas.",
      "No empecé [negocio] por ambición. Empecé porque [momento de quiebre personal].",
    ],
    cuerpo: "Narra en primera persona del fundador y en orden: el problema que vivió en carne propia, el punto de quiebre, la decisión de crear el servicio, y una prueba de que hoy funciona. La vulnerabilidad es el motor: incluye el fracaso, el costo o la frustración real antes del giro ('perdí dos años y mis ahorros intentando hacerlo como todos decían'), porque la confesión crea conexión y el conflicto abre el loop narrativo. Dedica más tiempo al valle que a la cima: el avatar se identifica con la lucha, no con el éxito. La prueba de que hoy funciona va al final del arco y en una sola pincelada, como consecuencia natural de la historia. Cierra el relato conectando su situación pasada con la situación actual del avatar.",
    cta: "El cierre es una invitación de igual a igual, nunca un pitch: el fundador le tiende la mano a quien está donde él estuvo. Tono cálido y personal. Ejemplo: 'Si estás donde yo estaba hace [N] años, hablemos.'",
    siempre: [
      "Narra en primera persona del fundador.",
      "Incluye el fracaso, costo o frustración real antes del giro.",
      "Sigue el arco: problema vivido, quiebre, decisión, prueba de hoy.",
      "Usa solo hechos biográficos y del negocio presentes en el contexto.",
      "Conecta el pasado del fundador con el presente del avatar.",
    ],
    nunca: [
      "Nunca inventes historia de origen: si no está documentada, usa otro ángulo.",
      "Nunca conviertas el final en venta dura.",
      "Nunca cuentes solo los éxitos sin el valle: sin conflicto no hay conexión.",
      "Nunca hagas la historia más larga que su punto: cada beat empuja al siguiente.",
      "Nunca uses tono de superioridad ('yo lo logré y tú no').",
    ],
    preguntas: [
      "¿Qué momento concreto te hizo decidir crear este negocio?",
      "¿Qué te costó (tiempo, dinero, frustración) antes de que funcionara?",
      "¿Qué prueba tienes hoy de que el camino valió la pena?",
    ],
    estructuras: ["gancho-historia-cta", "bab"],
  },
  {
    id: "testimonio", nombre: "Testimonio", emoji: "🗣️", activo: true,
    cuando: "Cuando el bloqueo es la confianza: suena a recomendación de un igual, no a anuncio.",
    requisitos: "Idealmente requiere un caso real documentado en el contexto del negocio: cliente, situación y resultado. Si no existe, solo puede escribirse como hipotético honesto explícito ('imagina que...'), nunca como testimonio real fabricado.",
    ejemplosHook: [
      "Yo no creía que [resultado] fuera posible hasta que [momento de quiebre].",
      "Era escéptico con [servicio]... y se pagó solo en [plazo].",
      "Llevo [tiempo] trabajando con ellos y esto es lo que nadie te dice.",
      "Casi no contrato [servicio]. Habría sido el error más caro de mi año.",
      "Mi [socio/pareja/colega] me dijo que era tirar el dinero. Hoy me pide el contacto.",
    ],
    cuerpo: "Escribe en primera persona con la voz de un cliente, siguiendo el arco escéptico: resultado concreto al inicio, luego la duda ('yo no creía que esto funcionara, ya me habían quemado antes'), la historia de cómo lo probó, y el desenlace. Incluye detalles cotidianos y alguna fricción real del proceso ('las primeras dos semanas no vi nada y pensé en cancelar'): la imperfección es lo que hace creíble el relato. La voz debe sonar a alguien contándole su experiencia a un amigo, con frases coloquiales y ritmo de conversación. El servicio se menciona como parte natural de la historia, nunca con lenguaje de folleto.",
    cta: "El CTA mantiene la voz del cliente: una recomendación de igual a igual, no una orden de la marca. Tono de 'yo ya pasé por ahí, te ahorro la duda'. Ejemplo: 'Si estás dudando como dudaba yo, hazme caso: pregunta y sal de la duda.'",
    siempre: [
      "Escribe en primera persona con la voz de un cliente.",
      "Sigue el arco escéptico: resultado, duda inicial, prueba, desenlace.",
      "Incluye detalles cotidianos y alguna fricción o duda real.",
      "Usa únicamente hechos, resultados y clientes presentes en el contexto.",
      "Abre con el resultado concreto para ganar la atención.",
    ],
    nunca: [
      "Nunca inventes nombres, cifras ni testimonios.",
      "Nunca uses tono publicitario ni frases de folleto en boca del cliente.",
      "Nunca pintes una experiencia perfecta sin fricción: es lo que delata el guion.",
      "Nunca presentes un hipotético como caso real: si no hay caso, dilo como 'imagina que...'.",
      "Nunca hagas que el cliente recite features: habla de su vida, no del producto.",
    ],
    preguntas: [
      "¿De qué cliente real es el caso y qué resultado logró?",
      "¿Qué duda o escepticismo tenía ese cliente antes de empezar?",
      "¿Qué frase textual te dijo (o te escribió) cuando vio el resultado?",
    ],
    estructuras: ["gancho-historia-cta", "bab"],
  },
  {
    id: "caso-de-exito", nombre: "Caso de éxito (antes/después)", emoji: "📈", activo: true,
    cuando: "Cuando el negocio tiene resultados medibles y el avatar necesita prueba de que funciona con alguien como él.",
    requisitos: "Requiere un caso real con métricas en el contexto del negocio: cliente, número de antes, número de después y plazo. Sin números reales solo puede plantearse como proyección honesta ('imagina pasar de X a Y'), nunca presentada como hecho.",
    ejemplosHook: [
      "Así fue como [avatar] pasó de [antes] a [resultado] en [plazo].",
      "Esto era su [métrica] hace [plazo]... y esto es hoy. La diferencia fue una sola cosa.",
      "Un solo cambio duplicó su [métrica] en [plazo].",
      "[Cliente/avatar] llegó con [problema medible]. [Plazo] después, mira esto.",
      "De [antes] a [después] sin [sacrificio esperado]. Te cuento qué hicimos.",
    ],
    cuerpo: "Cuenta la transformación de UN cliente con números: abre con el contraste antes/después y luego narra en orden qué estaba mal, qué se hizo distinto y cómo quedó hoy. A diferencia del testimonio, aquí narra la marca o el fundador, así que el foco está en el sistema que produjo el resultado, no en la emoción ('lo primero que hicimos fue [acción concreta]; eso destrabó [efecto]'). Atribuye el resultado a pasos identificables y repetibles: el espectador debe concluir que hay un método, no suerte. Ancla cada cifra a su plazo y contexto para que sea creíble, y cierra conectando: 'si su situación se parece a la tuya, el camino es el mismo'.",
    cta: "El CTA invita al espectador a ser el siguiente caso: tono de replicabilidad, no de promesa garantizada. Ejemplo: 'Si quieres saber si tu caso se puede trabajar igual, este es el primer paso.'",
    siempre: [
      "Céntrate en UN solo cliente y su transformación medible.",
      "Abre con el contraste antes/después con números y plazo.",
      "Explica qué se hizo distinto: el sistema, no la magia.",
      "Usa solo casos, métricas y plazos que existan en el contexto del negocio.",
      "Conecta el caso con la situación del espectador al cierre.",
    ],
    nunca: [
      "Nunca inventes cifras ni presentes proyecciones como hechos.",
      "Nunca prometas resultados garantizados ni uses claims absolutos.",
      "Nunca uses cifras redondas sospechosas sin contexto que las respalde.",
      "Nunca mezcles varios casos en un guion: diluye la historia.",
      "Nunca narres en la voz del cliente: eso es el ángulo testimonio.",
    ],
    preguntas: [
      "¿Qué cliente real es el caso y en qué números estaba antes?",
      "¿A qué números llegó y en cuánto tiempo?",
      "¿Cuál fue LA cosa que se hizo distinto y produjo el cambio?",
    ],
    estructuras: ["gancho-historia-cta", "bab", "cuatro-p"],
  },
  {
    id: "comparacion", nombre: "Comparación", emoji: "⚖️", activo: true,
    cuando: "Cuando el avatar duda entre alternativas o sigue casado con la forma vieja de resolver el problema.",
    requisitos: "Requiere tener claras las alternativas típicas que el avatar ya probó o considera (hacerlo solo, la solución genérica, el método viejo) y razones concretas y verificables de por qué la forma del negocio gana. Funciona mejor cuando el diferencial del servicio está bien definido en el contexto.",
    ejemplosHook: [
      "Probé [N] formas de [resultado]. Solo una vale la pena.",
      "La forma vieja: [ritual doloroso]. La forma nueva: esto.",
      "Si sigues haciendo [práctica común], estás dejando dinero en la mesa.",
      "[Alternativa típica] vs [forma del negocio]: te ahorro la comparación.",
      "Hay 3 maneras de [resultado]. Dos te van a costar más de lo que crees.",
    ],
    cuerpo: "Contrasta la forma vieja de lograr el resultado (o las alternativas típicas que el avatar ya probó) contra la forma del negocio: describe cada opción, reconoce primero qué hace bien ('hacerlo tú solo funciona... si te sobran 10 horas a la semana'), y luego di con razones concretas por qué se queda corta. Ese reconocimiento honesto antes del golpe es lo que da credibilidad al veredicto. Compara contra categorías y métodos, y presenta el servicio como el ganador claro con su porqué explícito: qué hace distinto que elimina la falla de las otras opciones. Ordena las alternativas de la más conocida a la menos, dejando la forma del negocio al final como resolución.",
    cta: "El CTA invita a probar la forma nueva ahora que la comparación quedó clara: tono de decisión lógica y evidente, sin presión. Ejemplo: 'Ya conoces las dos formas. Si quieres probar la que sí funciona, empieza aquí.'",
    siempre: [
      "Compara contra categorías y métodos ('hacerlo tú solo', 'el curso de siempre').",
      "Reconoce qué hace bien cada alternativa antes de mostrar dónde falla.",
      "Da razones concretas y verificables para cada veredicto.",
      "Explica el porqué del ganador: qué elimina la falla de las otras opciones.",
      "Mantén el contraste justo: la credibilidad es el activo del ángulo.",
    ],
    nunca: [
      "Nunca compares contra competidores con nombre propio.",
      "Nunca uses claims absolutos que Meta pueda marcar ('el único', 'el mejor del mundo').",
      "Nunca pintes las alternativas como estúpidas: el avatar ya las probó y se sentiría atacado.",
      "Nunca compares más de 3 opciones: se pierde el hilo.",
      "Nunca declares ganador sin haber dado el porqué.",
    ],
    preguntas: [
      "¿Qué alternativas suele probar tu cliente antes de llegar contigo?",
      "¿Qué hace bien cada una y dónde se queda corta?",
      "¿Cuál es la razón concreta por la que tu forma gana?",
    ],
    estructuras: ["gancho-valor-cta", "bab"],
  },
  {
    id: "mecanismo", nombre: "Mecanismo (la razón real)", emoji: "🔬", activo: true,
    cuando: "Avatares quemados que ya probaron de todo: responde el \"por qué esto sí va a funcionar\".",
    requisitos: "Requiere que el negocio tenga un mecanismo único articulable en el contexto: un proceso, método o sistema con nombre y pasos que explique POR QUÉ funciona donde lo demás falló. Sin un cómo diferenciado y documentado, el ángulo se queda en promesa vacía.",
    ejemplosHook: [
      "Esta es la razón real por la que nada de lo que probaste para [dolor] funcionó.",
      "El problema nunca fue [causa asumida]. Es [causa real].",
      "Pensaba que [categoría de solución] era puro humo... hasta que entendí cómo funciona de verdad.",
      "Todos atacan [síntoma]. Nadie ataca [causa raíz]. Por eso sigues igual.",
      "No necesitas más [esfuerzo que ya hace]. Necesitas atacar [causa real].",
    ],
    cuerpo: "Reencuadra la causa raíz: dile al avatar que el problema nunca fue lo que él asume sino la causa real, y valida su esfuerzo previo antes de vender ('no es que no le echaste ganas: atacabas el síntoma equivocado') para desarmar la culpa. Luego explica el mecanismo único paso a paso, construyendo un puente lógico entre promesa y resultado: cada afirmación se sostiene con el cómo, no con adjetivos ('funciona porque primero [paso 1], y eso hace posible [paso 2]'). Traduce toda jerga técnica a lenguaje cotidiano, con analogías si hace falta. El servicio es la ejecución del mecanismo: cuando el cómo queda claro, la venta es la consecuencia natural.",
    cta: "El CTA apela al entendimiento recién ganado: 'ahora que sabes por qué fallaba lo anterior, prueba lo que ataca la causa real'. Tono lógico y sobrio, sin hype. Ejemplo: 'Si esto por fin te hizo clic, el siguiente paso es simple.'",
    siempre: [
      "Reencuadra la causa raíz: de la causa asumida a la causa real.",
      "Valida el esfuerzo previo del avatar antes de vender.",
      "Sostén cada afirmación con el cómo, nunca con adjetivos.",
      "Usa solo el método y las pruebas que existan en el contexto del negocio.",
      "Traduce la jerga técnica a lenguaje cotidiano.",
    ],
    nunca: [
      "Nunca presentes el mecanismo como magia: es lógico, no milagroso.",
      "Nunca uses jerga técnica sin traducir.",
      "Nunca culpes al avatar por sus intentos fallidos.",
      "Nunca prometas el resultado sin haber explicado el puente lógico completo.",
      "Nunca inventes un mecanismo o nombre de método que no exista en el contexto.",
    ],
    preguntas: [
      "¿Cuál crees que es la verdadera causa por la que tus clientes no lograban [resultado] antes de ti?",
      "¿Cómo funciona tu método, en 2-3 pasos simples?",
      "¿Qué asume mal tu cliente sobre su propio problema?",
    ],
    estructuras: ["gancho-valor-cta", "pas"],
  },
  {
    id: "demostracion", nombre: "Demostración", emoji: "🖥️", activo: true,
    cuando: "Cuando el producto/servicio se puede MOSTRAR funcionando en pantalla — ver es creer.",
    requisitos: "Requiere que el producto o servicio se pueda MOSTRAR funcionando en pantalla y que el contexto del negocio describa qué se ve y qué hace. Si el servicio no tiene nada visual demostrable, este ángulo no aplica.",
    ejemplosHook: [
      "Mira cómo [resultado] en [tiempo corto].",
      "Esto es exactamente lo que pasa cuando [acción con el producto].",
      "Te muestro en vivo cómo [tarea dolorosa] se hace sola.",
      "Sin promesas: te lo enseño funcionando. Mira.",
      "Esto que ves en pantalla es [tarea] resolviéndose en tiempo real.",
    ],
    cuerpo: "El guion narra una demostración en vivo: describe con palabras qué está viendo el espectador mientras el producto hace lo suyo, en lenguaje simple y de acompañamiento ('mira esto: aquí se ve cómo [acción] ya quedó lista'). Ancla cada cosa mostrada al dolor que resuelve: nada de tour de features, solo los 2-3 momentos que le importan al avatar, ordenados del más impactante al de soporte. Marca los momentos 'wow' verbalmente ('fíjate en esto, porque es lo que te ahorra [costo]') para dirigir la atención. Recuerda que es SOLO lo hablado: todo lo visual se describe con palabras, sin acotaciones de cámara ni indicaciones de edición.",
    cta: "El CTA invita a vivir en carne propia lo que acaba de ver: de espectador a usuario, tono de 'compruébalo tú mismo'. Ejemplo: 'Esto mismo puede estar corriendo con tus datos: pruébalo tú.'",
    siempre: [
      "Narra lo que el espectador ve, en lenguaje simple de acompañamiento.",
      "Ancla cada cosa mostrada al dolor concreto que resuelve.",
      "Selecciona solo los 2-3 momentos que le importan al avatar.",
      "Señala verbalmente los momentos 'wow' para dirigir la atención.",
      "Deja que lo mostrado sea la prueba: describe, no prometas.",
    ],
    nunca: [
      "Nunca hagas un tour de features: solo lo que resuelve el dolor.",
      "Nunca incluyas acotaciones de cámara o edición: el guion es solo lo hablado.",
      "Nunca uses jerga técnica del producto sin traducir al resultado.",
      "Nunca describas algo que el producto no hace realmente en pantalla.",
      "Nunca alargues la demo más allá del momento fuerte: cierra en el pico.",
    ],
    preguntas: [
      "¿Qué momento exacto del producto en acción impresiona más a un cliente nuevo?",
      "¿Qué tarea dolorosa se ve resolverse en pantalla y cuánto tarda?",
      "¿Qué suele decir la gente cuando ve la demo por primera vez?",
    ],
    estructuras: ["gancho-propuesta-cta", "cuatro-p"],
  },
  {
    id: "propuesta-directa", nombre: "Propuesta directa", emoji: "🎯", activo: true,
    cuando: "Sin vueltas y sin urgencia: qué haces, para quién y qué logra — filtra fuerte y trae al que ya busca ayuda.",
    requisitos: "Requiere una propuesta nítida en el contexto del negocio: qué ofrece, para quién exactamente y qué resultado logra. No necesita urgencia ni casos: necesita claridad total; si la oferta es difusa, este ángulo la expone.",
    ejemplosHook: [
      "¿Eres [avatar] y [situación]? Esto es para ti.",
      "Ayudo a [avatar] a [resultado] sin [dolor].",
      "¿Qué tienes que hacer para [resultado]? Te lo cuento en 1 minuto.",
      "Esto es lo que hago, para quién y qué logra. Sin rodeos.",
      "Si eres [avatar], este es probablemente el anuncio más directo que verás hoy.",
    ],
    cuerpo: "Directo al grano: cualifica al avatar en la primera frase, nombra qué ofreces y el resultado que logra, y cierra con el paso siguiente. Puedes listar rápido 2-3 cosas que el avatar YA intentó sin resultado para ganar confianza ('ya probaste X, Y, Z... y sigues igual'), demostrando que entiendes su recorrido. Cada frase debe pasar un filtro triple: o cualifica, o propone, o llama a la acción; si no hace ninguna de las tres, se corta. La fuerza está en la claridad, no en la presión: describe la oferta con sustantivos y resultados concretos, cero adjetivos de relleno.",
    cta: "El CTA es la continuación natural de la franqueza del guion: claro, sin presión de tiempo y sin dramatismo. Ejemplo: 'Si esto es lo que buscas, el siguiente paso te toma dos minutos.'",
    siempre: [
      "Cualifica al avatar en la primera frase.",
      "Nombra qué ofreces y el resultado que logra, con sustantivos concretos.",
      "Haz que cada frase cualifique, proponga o llame a la acción.",
      "Demuestra que conoces lo que el avatar ya intentó sin resultado.",
      "Mantén la claridad brutal como único recurso persuasivo.",
    ],
    nunca: [
      "Nunca agregues urgencia, límites de tiempo ni cupos: ese es otro ángulo.",
      "Nunca uses relleno, rodeos ni introducciones antes de cualificar.",
      "Nunca uses adjetivos vacíos ('increíble', 'revolucionario') en lugar de resultados.",
      "Nunca intentes hablarle a todo el mundo: la cualificación estrecha es la fuerza.",
      "Nunca escondas qué es la oferta detrás de misterio o intriga.",
    ],
    preguntas: [
      "En una frase: ¿qué ofreces, a quién y qué resultado logra?",
      "¿Qué 2-3 cosas ya intentó tu cliente ideal sin resultado?",
      "¿Quién NO es para ti (a quién quieres filtrar)?",
    ],
    estructuras: ["gancho-propuesta-cta", "aida"],
  },
  {
    id: "retargeting", nombre: "Retargeting (objeciones)", emoji: "🔁", activo: true,
    cuando: "Solo tráfico tibio/caliente que ya vio la oferta y no actuó — cada anuncio ataca UNA objeción distinta.",
    requisitos: "Requiere que el avatar ya haya visto la oferta (solo tráfico tibio/caliente) y que exista una objeción identificada más la prueba real del negocio que la desarma (garantía, proceso, resultados documentados). Cada anuncio ataca UNA sola objeción.",
    ejemplosHook: [
      "¿Sigues pensando en [servicio]? Esto es lo que te está frenando.",
      "Sé lo que estás pensando: '[objeción textual]'. Déjame mostrarte por qué no es así.",
      "Viste [servicio], no actuaste. Normal. Pero esto no lo sabías...",
      "La razón por la que no diste el paso no es [excusa]; es '[objeción real]'. Hablemos de eso.",
      "¿'[Objeción textual]'? Justo por eso existe [prueba/garantía].",
    ],
    cuerpo: "Habla directo a la persona que ya vio el anuncio o la página y no actuó: nombra la objeción exacta que la frenó (precio, tiempo, '¿y si no me funciona?', 'ya probé algo parecido') con sus propias palabras, y destrúyela con prueba concreta del contexto del negocio: garantía, proceso, resultados reales ('por eso la primera etapa no la pagas hasta ver [entregable]'). No necesita arco narrativo: es un pitch directo, corto y frontal, con tono de 'sé lo que estás pensando'. Este anuncio existe para decir algo NUEVO que la primera vez no se dijo, así que aporta la información o el ángulo que faltaba, y remata reconectando con la oferta.",
    cta: "El CTA cierra el círculo pendiente: tono de 'ya lo pensaste suficiente, resuelve la duda', directo y sin ambigüedad, apelando a que la objeción quedó desactivada. Ejemplo: 'Ya no tienes esa excusa: retoma donde lo dejaste.'",
    siempre: [
      "Ataca UNA sola objeción por anuncio, nombrada con las palabras del avatar.",
      "Desarma la objeción con prueba concreta que exista en el negocio.",
      "Di algo NUEVO que el anuncio original no dijo.",
      "Usa tono frontal y cómplice de 'sé lo que estás pensando'.",
      "Remata con la oferta y un CTA sin ambigüedad.",
    ],
    nunca: [
      "Nunca repitas el pitch original tal cual.",
      "Nunca menciones garantías o pruebas que no existan realmente en el negocio.",
      "Nunca ataques varias objeciones en un mismo guion.",
      "Nunca regañes ni avergüences al avatar por no haber actuado.",
      "Nunca uses este ángulo con tráfico frío que no vio la oferta.",
    ],
    preguntas: [
      "¿Cuál es la objeción número uno que escuchas de quienes no compran?",
      "¿Qué prueba real tienes para desarmarla (garantía, proceso, caso)?",
      "¿Qué información importante NO decía tu anuncio o página original?",
    ],
    estructuras: ["gancho-propuesta-cta", "cuatro-p"],
  },
  {
    id: "oferta-directa", nombre: "Oferta directa (urgencia)", emoji: "🔥", activo: true,
    cuando: "Tráfico caliente, lanzamientos o cupos limitados REALES; usar poco en frío.",
    requisitos: "Requiere una restricción REAL documentada en el contexto del negocio: fecha límite, cupos de agenda, capacidad del equipo o fecha de inicio, con su razón creíble. Sin escasez o deadline verdadero, este ángulo no se usa: la urgencia inventada destruye la confianza.",
    ejemplosHook: [
      "No te voy a hacer perder tiempo: si quieres [resultado], esto es lo único que necesitas ver hoy.",
      "Solo por [plazo]: [oferta] para los primeros [N].",
      "Esto es [servicio], logra [resultado], y hasta [fecha] tiene [incentivo].",
      "Quedan [N] lugares para [oferta] y cierran el [fecha]. Los detalles, en 40 segundos.",
      "El [fecha] arranca [oferta]. Si querías una señal, es esta.",
    ],
    cuerpo: "Ve al grano desde el segundo cero: qué es la oferta, qué resultado da, qué incluye y cuándo cierra, con números concretos en lugar de adjetivos ('incluye 4 sesiones, arranca el 15, quedan 6 lugares'). Explica el PORQUÉ de la urgencia: la razón creíble detrás del límite (cupos reales de agenda, fecha de inicio, capacidad del equipo), porque una restricción con causa se cree y una sin causa huele a truco. Agrega un destello de prueba social si existe en el contexto (clientes actuales, resultados) en una sola línea. Sin historia y sin rodeos: claridad brutal, cada frase es un dato de la oferta o un empujón al cierre.",
    cta: "El CTA es específico y con fecha o límite explícito: la acción, el plazo y qué pierde quien lo deja pasar. Tono decidido, sin dramatismo falso. Ejemplo: 'Aparta tu lugar antes del [fecha]; después de eso, no hay forma de entrar.'",
    siempre: [
      "Di qué es la oferta, qué resultado da, qué incluye y cuándo cierra.",
      "Explica la razón creíble detrás de la urgencia.",
      "Usa números concretos en lugar de adjetivos.",
      "Cierra con un CTA específico con fecha o cupo límite.",
      "Incluye un destello de prueba social si existe en el contexto.",
    ],
    nunca: [
      "Nunca inventes escasez, descuentos ni deadlines que no estén en el contexto.",
      "Nunca metas historia ni rodeos: este ángulo es claridad brutal.",
      "Nunca uses urgencia sin explicar su porqué.",
      "Nunca abuses de este ángulo en tráfico frío: reservarlo para caliente y lanzamientos.",
      "Nunca apiles bonos e incentivos difusos: cada elemento de la oferta debe ser concreto.",
    ],
    preguntas: [
      "¿Cuál es el límite real (fecha, cupos, capacidad) y por qué existe?",
      "¿Qué incluye exactamente la oferta, en números?",
      "¿Qué pasa con quien no entra antes del cierre?",
    ],
    estructuras: ["gancho-propuesta-cta", "cuatro-p", "aida"],
  },
];

export function anguloGuionPorId(angulos: AnguloGuion[], id: string): AnguloGuion | undefined {
  return angulos.find((a) => a.id === id);
}

const sTxt = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
const sArr = (x: unknown) => (Array.isArray(x) ? x.map(sTxt).filter(Boolean) : []);

/** Normaliza un catálogo crudo (del override editable). Tolera la forma VIEJA
 *  (un solo campo `instrucciones` + `estructura` singular) mapeándola al modelo
 *  rico — un override guardado antes del cambio no rompe nada. */
export function normalizarAngulosGuion(v: unknown): AnguloGuion[] {
  if (!Array.isArray(v)) return [];
  const out: AnguloGuion[] = [];
  for (const raw of v) {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const id = sTxt(o.id).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const nombre = sTxt(o.nombre);
    const cuerpo = sTxt(o.cuerpo) || sTxt(o.instrucciones); // compat forma vieja
    if (!id || !nombre || !cuerpo) continue;
    const estructuras = sArr(o.estructuras);
    if (!estructuras.length && sTxt(o.estructura)) estructuras.push(sTxt(o.estructura)); // compat
    out.push({
      id, nombre, emoji: sTxt(o.emoji) || '🎬', cuando: sTxt(o.cuando),
      requisitos: sTxt(o.requisitos), ejemplosHook: sArr(o.ejemplosHook), cuerpo,
      cta: sTxt(o.cta), siempre: sArr(o.siempre), nunca: sArr(o.nunca),
      preguntas: sArr(o.preguntas),
      estructuras: estructuras.length ? estructuras : ['gancho-historia-cta'],
      activo: o.activo !== false,
    });
  }
  return out;
}
