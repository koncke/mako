// =============================================================================
// fase-diagnostico — en qué FASE está el negocio, y cuál es su cuello de botella
// =============================================================================
// Adaptación del "Análisis de Negocio" de Andrea Estratega (Fórmula 100k) al
// caso de MaKo. La idea central, textual del original:
//
//   "Esto es lo que le da el NORTE a todo el sistema. Ese Norte se presetea,
//    porque TODOS los emprendedores comparten los MISMOS problemas según en qué
//    situación estén."
//
// O sea: 6 preguntas rápidas sobre la situación real del negocio → una FASE
// (1-5) + su CUELLO DE BOTELLA + qué priorizar. De ahí sale el Norte del cliente,
// y alimenta al Perro Guardián (prioridad) y a la Retro (¿avanzaste hacia el hito?).
//
// ADAPTACIÓN CLAVE: Andrea es ORGÁNICO VIRAL POR INSTAGRAM (seguidores, mezcla de
// contenido viral/autoridad/ventas). MaKo es VSL POR ANUNCIOS (Meta Ads). Traducción:
//   seguidores          → INVERSIÓN/DÍA en Meta Ads (el combustible)
//   contenido viral     → CREATIVOS lanzados/mes (el motor — el diferencial de MaKo)
//   sistema de captación→ el FUNNEL (VSL/landing/agenda/nutrición)
//   lead magnets        → NUTRICIÓN y follow-up del lead que no compró hoy
// La "estrategia de contenido" de Andrea (viral/autoridad/ventas) se reemplaza por
// el mix de MaKo: PROSPECCIÓN (creativos fríos) / RETARGETING Y NUTRICIÓN / ESCALA.
//
// NUMERACIÓN: las fases se MUESTRAN como 1..5 (FaseDef.id). Internamente el array,
// los votos de cada pregunta (índice 0-4), la mediana y el `reparto` siguen siendo
// 0-based: faseDef() se llama SIEMPRE con el índice 0-4, y el display usa `f.id`.
//
// DATOS PUROS a propósito (sin 'server-only'): lo consume el wizard en el browser
// y la persistencia en el server. La lógica de diagnóstico está testeada abajo.
// =============================================================================

export type CuelloId = 'oferta' | 'conversion' | 'sistema' | 'delegacion' | 'foco';

/** Una secuencia de mensajes de la fase. `titulo` = el título corto del punto; las críticas van
 *  marcadas (críticas primero, en orden). El ORDEN del array importa: es el orden
 *  en que hay que hacerlas (oferta → activo → invertir → creativos → medir → venta). */
export type Accion = { titulo: string; texto: string; critica: boolean };

/** El funnel recomendado para esta fase (más simple abajo, más complejo arriba).
 *  `pasos` = las etapas del funnel, para dibujarlas conectadas con flechas.
 *  `retarget` = true si el funnel incluye reimpactar al que no compró. */
export type FunnelSugerido = { nombre: string; complejidad: 'Simple' | 'Media' | 'Compleja'; comoFunciona: string; pasos: string[]; retarget: boolean };

/** El mix de dónde va el presupuesto+esfuerzo en esta fase (suma 100), más una guía
 *  concreta de CUÁNTO invertir, cómo repartirlo y cuánto testear. */
export type Estrategia = { prospeccion: number; nutricion: number; escala: number; nota: string; inversion: string; comoRepartir: string };

export type FaseDef = {
  /** 1..5 — el número que se MUESTRA (el índice del array es id-1). */
  id: number;
  nombre: string;
  /** El hito de la fase en 2-4 palabras ("El primer creativo ganador"). */
  subtitulo: string;
  emoji: string;
  /** La dimensión donde se rompe la cadena en esta fase. */
  cuello: CuelloId;
  cuelloLabel: string;
  /** Rango que caracteriza la fase (facturación + inversión/día). */
  rango: string;
  /** La frase-objetivo de la fase: es el "Norte" que se presetea. */
  objetivo: string;
  /** Cómo se siente estar acá (para que el cliente se reconozca). */
  sintomas: string[];
  /** El funnel recomendado para esta fase (según su nivel de complejidad). */
  funnelSugerido: FunnelSugerido;
  /** Las secuencias de mensajes de esta fase, EN ORDEN de ejecución. Las `critica:true` van primero. */
  acciones: Accion[];
  /** Cómo repartir el presupuesto+esfuerzo en esta fase. */
  estrategia: Estrategia;
  /** Qué NO hacer todavía (el error caro de saltarse la fase), como lista. */
  noHacer: string[];
  /** El HITO para pasar de fase, en una frase directa. */
  hito: string;
  /** Criterios sí/no que el usuario se responde: si todos son SÍ, pasa de fase. */
  hitoCriterios: string[];
  color: string;
};

// Las 5 fases, adaptadas a un negocio que vende con VSL Funnel + pauta.
export const FASES: FaseDef[] = [
  {
    id: 1, nombre: 'Validación', subtitulo: 'El primer anuncio ganador', emoji: '🐣',
    cuello: 'oferta', cuelloLabel: 'Oferta y Mensaje',
    rango: '$0 – $3k/mes · $0 – $20/día en ads',
    objetivo: 'Encontrar UN anuncio frío que traiga clientes potenciales a un costo que cierra, y UNA oferta que un desconocido te compra sin que lo persigas.',
    sintomas: [
      'Vendes solo cuando le escribes tú a un conocido, un referido o alguien que ya te seguía; a un desconocido total todavía no le vendiste nada.',
      'Lanzas un anuncio, no pasa nada, lo apagas a los dos días y pruebas otro, sin saber por qué el anterior no funcionó.',
      'Cambias la oferta en cada charla según quién tienes enfrente: no hay UNA oferta, hay un favor distinto cada vez.',
      'Miras lo que te cuesta un cliente potencial y no sabes si está bien o mal, porque no tienes con qué compararlo.',
      "Tu página de venta está 'casi lista' hace semanas y todavía no la pusiste a correr con dinero real.",
    ],
    funnelSugerido: { nombre: 'Mensajes directos', complejidad: 'Simple', pasos: ['Anuncio', 'WhatsApp', 'Charla', 'Venta'], retarget: false, comoFunciona: 'Un anuncio que abre una conversación por WhatsApp o DM: charlas ahí mismo y cierras. No necesitas video de venta ni página todavía — es lo más rápido de montar para validar tu oferta con dinero real.' },
    acciones: [
      { titulo: 'Define UNA oferta clara', texto: 'A quién, qué problema, qué resultado y a qué precio. Tan clara que un desconocido la entienda en 30 segundos.', critica: true },
      { titulo: 'Prepara dónde cae el que te escribe', texto: 'Un WhatsApp con un saludo listo, o una página de una sola pantalla. Nada de video de venta ni web completa todavía.', critica: false },
      { titulo: 'Crea tus 9 anuncios (3 avatares × 3 razones)', texto: 'La misma oferta, un ángulo distinto por combinación de avatar y razón de compra — MaKo te arma esa matriz de 9 más adelante.', critica: false },
      { titulo: 'Prende Meta con poco', texto: '$10 a $20 por día. Alcanza para saber si funciona sin arriesgar de más.', critica: false },
      { titulo: 'Mira solo 2 números', texto: 'Cuánto te cuesta un cliente potencial y si ya te compró un desconocido. Lo demás es ruido.', critica: false },
      { titulo: 'Ten lista tu conversación de venta', texto: 'Qué dices cuando por fin te escriban: cómo abres, qué preguntas y cómo das el precio.', critica: false },
    ],
    estrategia: { prospeccion: 100, nutricion: 0, escala: 0,
      nota: 'Todo a tráfico frío. Todavía no hay audiencia a la que reimpactar (nadie te vio aún), así que no hay retargeting posible; y no se escala lo que no sabes si funciona.',
      inversion: '$300 a $600 el primer mes (unos $10 a $20 por día). Dale a cada anuncio 3 a 4 días y ~$50 antes de decidir si sirve o lo apagas.',
      comoRepartir: 'Reparte parejo entre tus 9 anuncios para ver cuál engancha. Cuando UNO gane, vuelca casi todo el presupuesto a ese anuncio y súbelo de a poco.' },
    noHacer: [
      'No sumes equipo ni delegues: todavía no hay un proceso que delegar.',
      'No armes una escalera de varios productos ni un webinar: es demasiado para esta etapa.',
      'No subas el presupuesto ni lances 15 anuncios por mes: escalar algo que ningún desconocido validó es quemar dinero.',
      'No hagas retargeting: nadie te vio todavía, no hay a quién reimpactar.',
    ],
    hito: 'Un anuncio que te trae clientes potenciales a un costo rentable de forma repetible, y tus primeras ventas a desconocidos con la misma oferta.',
    hitoCriterios: [
      '¿Tienes un anuncio que te trae clientes potenciales de forma repetible, varias semanas seguidas (no un golpe de suerte)?',
      '¿Te compró al menos un desconocido total (ni referido ni conocido)?',
      '¿Todas esas ventas fueron con la MISMA oferta?',
    ],
    color: '#7C5CFB',
  },
  {
    id: 2, nombre: 'Conversión', subtitulo: 'El funnel que convierte', emoji: '🌱',
    cuello: 'conversion', cuelloLabel: 'Conversión',
    rango: '$3k – $10k/mes · $20 – $100/día en ads',
    objetivo: 'Que cada tramo de tu funnel convierta parejo, y encontrar el punto que te está tirando el dinero a la basura.',
    sintomas: [
      'Entran clientes potenciales pero se caen: agendas una llamada y la mitad no aparece.',
      'Sabes cuánto te sale un cliente potencial, pero no cuánto te sale una venta cerrada — y ese número te asusta.',
      'Persigues tú cada lead por WhatsApp; si no escribes a mano, no compra nadie.',
      'El anuncio trae clics, pero no sabes si se rompe en el video, en la página o en la llamada.',
      'Cada semana da otro número: una semana cierras tres, la otra cero, y no sabes por qué.',
    ],
    funnelSugerido: { nombre: 'VSL Funnel', complejidad: 'Media', pasos: ['Anuncio', 'Video (VSL)', 'Agenda', 'Venta'], retarget: false, comoFunciona: 'Anuncio → una página con un video de venta (VSL) → agenda o compra. El video filtra y precalienta al cliente potencial antes de que hables con él.' },
    acciones: [
      { titulo: 'Encuentra dónde se te caen', texto: 'Mira tu funnel por partes (ven el video, agendan, se presentan, cierran) y arregla primero el punto más flojo.', critica: true },
      { titulo: 'Frena las ausencias a las llamadas', texto: 'El que agenda y no aparece es tu fuga más cara. Recordatorios automáticos (día antes y 1 hora antes) + seguimiento al que no llegó.', critica: true },
      { titulo: 'Estandariza tu venta', texto: 'Anota las objeciones que más se repiten y ten una respuesta lista para cada una.', critica: false },
      { titulo: 'Recupera al que ya te vio', texto: 'Seguimiento y anuncios de remarketing al que te vio y no compró, en vez de gastar todo en gente nueva.', critica: false },
      { titulo: 'Ten reemplazos de tu ganador', texto: 'Mientras tu mejor anuncio convierte, prepara 2 a 3 variantes para el día que se canse.', critica: false },
    ],
    estrategia: { prospeccion: 70, nutricion: 25, escala: 5,
      nota: 'Sigues con tráfico frío fuerte (70) para no depender de un solo ganador, pero ya aparece el retargeting (25): calentar al que te vio y no cerró es donde recuperas la venta que se te caía. La escala (5) recién asoma.',
      inversion: '$600 a $3.000 al mes (unos $20 a $100 por día). Subes solo cuando un anuncio ya probó que convierte.',
      comoRepartir: 'La mayor parte a tráfico frío, una parte a reimpactar al que ya te vio, y un poco a subir presupuesto en lo que rinde.' },
    noHacer: [
      "No subas el presupuesto para 'traer más leads' cuando el problema es que los que entran no cierran: escalas el agujero.",
      'No cuelgues todo de un solo anuncio ganador.',
      'No armes todavía un equipo grande ni una escalera de varios productos.',
    ],
    hito: 'Tasa de cierre estable y costo por venta sano sostenidos 4+ semanas, con el funnel convirtiendo parejo y sin que persigas cada lead a mano.',
    hitoCriterios: [
      '¿Tu tasa de cierre se mantiene pareja 4 semanas seguidas?',
      '¿Sabes cuánto te cuesta una VENTA (no solo un lead) y te deja ganancia?',
      '¿El que agenda se presenta, sin que le escribas tú a mano?',
    ],
    color: '#1E9E57',
  },
  {
    id: 3, nombre: 'Automatización', subtitulo: 'La máquina que corre sola', emoji: '💰',
    cuello: 'sistema', cuelloLabel: 'Sistema',
    rango: '$10k – $30k/mes · $100 – $300/día en ads',
    objetivo: 'Que los anuncios nuevos, el seguimiento y los recordatorios corran solos: la máquina depende del sistema, no de que tú empujes todos los días.',
    sintomas: [
      'Vives colgado de UN anuncio ganador y ruegas para que no se canse, porque sostiene casi toda tu pauta.',
      'Sacas anuncios nuevos a los tirones, cuando el ganador ya empezó a caer y el costo subió, no antes.',
      'Si te tomas una semana, la máquina se frena: cada venta todavía depende de que tú empujes.',
      'El lead que no cerró se enfría y nadie lo vuelve a tocar; las ausencias a las llamadas se pierden a mano.',
      'El funnel ya convierte parejo, pero lo sostienes tú a pulso: si no estás encima, se cae.',
    ],
    funnelSugerido: { nombre: 'VSL Funnel + retargeting', complejidad: 'Media', pasos: ['Anuncio', 'Video (VSL)', 'Agenda', 'Venta'], retarget: true, comoFunciona: 'El mismo VSL Funnel, pero con anuncios de remarketing que reimpactan al que te vio y no compró, y con seguimiento automático.' },
    acciones: [
      { titulo: 'Produce anuncios en tanda', texto: 'Ten siempre el próximo ganador listo: varios anuncios por mes, y reemplaza al que gana antes de que se canse.', critica: true },
      { titulo: 'Automatiza el seguimiento', texto: 'Recordatorios, rescate del que no llegó y una secuencia para el que dijo "lo pienso", corriendo solos.', critica: true },
      { titulo: 'Saca la venta de tu cabeza', texto: 'Deja tu forma de vender escrita para que cualquiera que atienda cierre parecido a ti.', critica: false },
      { titulo: 'Reutiliza al que ya te vio', texto: 'Remarketing al que vio medio video o agendó y no llegó. Ya lo pagaste una vez.', critica: false },
      { titulo: 'Detecta el desgaste con números', texto: 'Mira el costo de cada anuncio para meter el reemplazo antes de que te pegue en la facturación.', critica: false },
    ],
    estrategia: { prospeccion: 45, nutricion: 40, escala: 15,
      nota: 'Ya no cazas un solo ganador: buena parte va a anuncios nuevos para tener reemplazos listos, otra parte igual de fuerte a recuperar al que ya te vio, y una porción a subir presupuesto en lo que rinde.',
      inversion: '$3.000 a $9.000 al mes (unos $100 a $300 por día). Recién ahora empiezas a escalar, y solo lo probado.',
      comoRepartir: 'Casi mitad y mitad entre traer gente nueva y recuperar a la que ya te vio; y una parte fija a subir presupuesto solo en lo que rinde.' },
    noHacer: [
      'No dejes que toda la máquina se apoye en UN anuncio ganador.',
      'No dependas de empujar tú cada venta: si se cae cuando te tomas una semana, no es un sistema.',
      'No escales el presupuesto todavía: primero lograr que corra solo.',
    ],
    hito: 'Los anuncios nuevos reemplazan al ganador antes de que se canse, el seguimiento corre solo, y vendes sin empujar cada lead — sostenido 4+ semanas y contigo fuera del día a día.',
    hitoCriterios: [
      '¿Tienes siempre un anuncio nuevo listo antes de que el actual se canse?',
      '¿El seguimiento y los recordatorios corren sin que los toques?',
      '¿La máquina sigue vendiendo si te tomas una semana?',
    ],
    color: '#C8870C',
  },
  {
    id: 4, nombre: 'Equipo', subtitulo: 'Escala rentable con equipo', emoji: '🚀',
    cuello: 'delegacion', cuelloLabel: 'Delegación',
    rango: '$30k – $80k/mes · $300 – $1.000/día en ads',
    objetivo: 'Subir la inversión en Meta manteniendo el costo por venta, con un equipo que corre la operación y contigo fuera del cierre y de la pauta diaria.',
    sintomas: [
      'Ya no das abasto: entran más clientes potenciales de los que tu agenda y tus vendedores pueden atender bien.',
      'Cada vez que subes el presupuesto el costo por venta se dispara y tienes que volver a bajarlo al día siguiente.',
      'La máquina ya corre sola, pero corre a UN tamaño: no sabes cómo darle más gas sin romperla.',
      'Contrataste gente, pero terminas corrigiéndoles todo: el estándar sigue en tu cabeza, no escrito.',
      'Sigues metiendo mano en cada cierre y tocando la pauta todos los días; eres el techo de tu propia operación.',
    ],
    funnelSugerido: { nombre: 'VSL Funnel a escala + equipo', complejidad: 'Compleja', pasos: ['Campañas', 'Video (VSL)', 'Agenda', 'Equipo', 'Venta'], retarget: true, comoFunciona: 'Varias campañas de tráfico frío y de remarketing en paralelo, con vendedores que cierran por ti y alguien a cargo de la pauta. El mismo funnel, a mucho más volumen.' },
    acciones: [
      { titulo: 'Sube la inversión por partes', texto: 'Nada de subir todo de golpe: más presupuesto en los ganadores probados + campañas nuevas en paralelo. Vigila el costo por venta día a día.', critica: true },
      { titulo: 'Sácate del cierre', texto: 'Arma tu equipo de vendedores sobre tu forma de vender ya escrita, y revisa las llamadas grabadas.', critica: true },
      { titulo: 'Delega la pauta diaria', texto: 'Pasa el manejo de Meta a alguien de confianza. Tú revisas los números, no tocas botones cada día.', critica: false },
      { titulo: 'Aguanta el volumen sin perder ventas', texto: 'Con más gente entrando, una misma tasa de ausencias cuesta el doble. Que los recordatorios aguanten el caudal.', critica: false },
      { titulo: 'Ten más reemplazos listos', texto: 'Al subir presupuesto los anuncios se cansan más rápido: ten siempre 2 a 3 reemplazos.', critica: false },
    ],
    estrategia: { prospeccion: 40, nutricion: 20, escala: 40,
      nota: 'La escala pesa tanto como el tráfico frío: subes fuerte en lo probado mientras sigues alimentando la máquina con anuncios nuevos. El remarketing baja de peso porque el volumen ya lo sostienen los otros dos frentes.',
      inversion: '$9.000 a $30.000 al mes (unos $300 a $1.000 por día). La clave ya no es cuánto, sino subir sin que el costo por venta se rompa.',
      comoRepartir: 'Mitad a escalar lo probado, y el resto repartido entre traer gente nueva y recuperar a la que ya te vio.' },
    noHacer: [
      'No subas todo el presupuesto de golpe porque un anuncio viene bien.',
      'No escales sin reemplazos listos ni equipo con tu forma de vender escrita: se cansa el ganador y quemas el doble.',
      'No sigas cerrando tú cada venta ni tocando la pauta todos los días.',
    ],
    hito: 'Inversión escalada con costo por venta estable 4+ semanas, la mitad de la operación delegada (pauta y cierre corriendo sin ti) y tú fuera del cierre y de la pauta diaria.',
    hitoCriterios: [
      '¿Subiste la inversión sin que el costo por venta se dispare?',
      '¿Cierran las ventas tus vendedores, no tú?',
      '¿Alguien más maneja la pauta de Meta todos los días?',
    ],
    color: '#2F6FED',
  },
  {
    id: 5, nombre: 'Escala', subtitulo: 'La escalera de valor', emoji: '👑',
    cuello: 'foco', cuelloLabel: 'Foco',
    rango: '$80k+/mes · $1.000+/día en ads',
    objetivo: 'Dejar de correr atrás del volumen: que cada peldaño de tu escalera venda con anuncios ya probados, y que el margen y la recompra crezcan más rápido que la facturación. Escalas solo lo rentable.',
    sintomas: [
      'Facturas más que nunca, pero el margen casi no se mueve: le metes más dinero a Meta y arriba queda parecido.',
      'Tienes 4 o 5 ofertas y no sabes bien cuál te deja el mejor margen ni cuál te trae los mejores clientes.',
      'Casi toda tu facturación viene de la venta fría de adelante; vendes poco hacia arriba y casi no le recompras al que ya te compró.',
      'Subes presupuesto en ángulos que facturan pero no dejan margen, y no lo ves hasta fin de mes.',
      'Te sobra volumen y te falta foco: el problema ya no es traer más, es decidir qué mover.',
    ],
    funnelSugerido: { nombre: 'Escalera de valor', complejidad: 'Compleja', pasos: ['Entrada', 'Recompra', 'Ticket alto'], retarget: true, comoFunciona: 'Un funnel por cada peldaño —entrada, medio y alto precio—, cada uno con su oferta y sus anuncios. Lo más complejo: solo cuando ya dominas los anteriores. Aquí ganas subiendo el valor de cada cliente.' },
    acciones: [
      { titulo: 'Ordena tus productos por lo que DEJAN', texto: 'No por lo que facturan, sino por lo que te queda después de pauta y comisiones. Achica o corta el que no deja dinero.', critica: true },
      { titulo: 'Véndele más al que ya te compró', texto: 'Ofertas hacia arriba y recompras a tu base (mayor precio, renovación). Sale más barato que traer uno nuevo.', critica: true },
      { titulo: 'Anuncios para cada peldaño', texto: 'Anuncios ganadores no solo para la entrada, también para las ofertas de mayor precio y las recompras.', critica: false },
      { titulo: 'Frena las bajas', texto: 'Cuida al cliente después de la venta (buen arranque, chequeos) para que no se vaya.', critica: false },
      { titulo: 'Escala solo lo rentable', texto: 'Sube presupuesto solo en lo de mejor costo y mejor valor de cliente; el resto se sostiene o se apaga.', critica: false },
    ],
    estrategia: { prospeccion: 30, nutricion: 30, escala: 40,
      nota: 'El dinero se va a escalar lo que ya sabes que deja margen y a recomprarle a tu base con la escalera. El tráfico frío lo sostienes para no depender de una sola oferta, pero ya no es donde ganas: aquí ganas en margen y en recompra.',
      inversion: '$30.000+ al mes (más de $1.000 por día). El número ya no es el problema: el problema es a QUÉ le metes cada peso.',
      comoRepartir: 'Buena parte a escalar lo que ya deja margen, otra parte a recomprarle a tu base, y el tráfico frío solo para no depender de una sola oferta.' },
    noHacer: [
      'No sigas metiendo presupuesto a todo por igual persiguiendo facturación mientras el margen se achica.',
      'No sumes productos u ofertas nuevas sin validarlas con anuncios ganadores: diluyes el foco justo cuando necesitas simplificar.',
    ],
    hito: 'Tu escalera de valor validada en cada peldaño y clientes que vuelven a comprar: el negocio crece en margen, no solo en volumen.',
    hitoCriterios: [
      '¿Cada peldaño de tu escalera vende con anuncios ya probados?',
      '¿Tus clientes te vuelven a comprar (recompra o producto de mayor precio)?',
      '¿Tu margen crece más rápido que tu facturación?',
    ],
    color: '#D6489B',
  },
];

/** faseDef se llama SIEMPRE con el ÍNDICE 0-4 (no con el id 1-5). */
export const faseDef = (idx: number): FaseDef => FASES[Math.max(0, Math.min(4, idx))];

// ── Las 5 dimensiones del diagnóstico ────────────────────────────────────────
// Cada negocio tiene estas 5 dimensiones y el cuello siempre vive en una. Es la
// adaptación de las 5 dimensiones de Andrea (Producto y Oferta / Marketing y
// Audiencia / Ventas y Monetización / Lead Magnets y Prospectos / Sistemas y
// Automatización) al modelo VSL + Meta Ads.
export type Dimension = {
  nombre: string;
  emoji: string;
  descripcion: string;
  /** Señales de que ESTA es tu dimensión débil. */
  senales: string[];
  /** La fase (1-5) donde esta dimensión es el cuello dominante. */
  faseCuello: number;
};

export const DIMENSIONES: Dimension[] = [
  {
    nombre: 'Oferta y Mensaje', emoji: '🎯',
    descripcion: 'Qué vendes, a quién y con qué promesa. Si un desconocido no la compra o el mensaje no le pega al dolor, no hay pauta ni funnel que lo salve. Es lo primero que se valida.',
    senales: [
      'Tus anuncios tienen buen CTR pero después nadie compra: hacen clic y se van.',
      'No puedes explicar en una frase por qué alguien te elige a ti y no al de al lado.',
      'Bajas el precio para cerrar; sin descuento no entra nadie.',
      'Cambias de oferta cada dos semanas porque ninguna termina de pegar.',
    ],
    faseCuello: 1,
  },
  {
    nombre: 'Pauta y Creativos', emoji: '🎬',
    descripcion: 'Tu capacidad de producir y testear creativos que frenan el scroll y traen clics baratos al VSL, sin quemar dinero en la cuenta. Es el motor que empuja todas las fases; si se seca, se frena todo.',
    senales: [
      'Vives de uno o dos creativos y cuando se cansan, se te cae la facturación.',
      'No sabes qué anuncio te trae las ventas: miras el total, no creativo por creativo.',
      'El CPA sube semana a semana y no tienes creativos nuevos listos para reemplazar.',
      'Sacar un creativo nuevo te lleva días y lo haces tú a mano cada vez.',
    ],
    faseCuello: 1,
  },
  {
    nombre: 'Funnel y Conversión', emoji: '🔻',
    descripcion: 'El tramo del clic a la venta: retención del VSL, CTA de la landing, que la R1 se presente y que el closer cierre. Si la cadena se rompe en un eslabón, pagas leads que no convierten.',
    senales: [
      'Entran leads pero la mayoría no llega a agendar o no se presenta a la llamada.',
      'No sabes en qué punto se te caen: si es el VSL, la landing o la reunión.',
      'La gente ve medio VSL y se va; la retención se desploma temprano.',
      'De las llamadas que sí se presentan, cierras muy pocas y no sabes por qué.',
    ],
    faseCuello: 2,
  },
  {
    nombre: 'Nutrición y Sistema', emoji: '⚙️',
    descripcion: 'Lo que pasa entre que el lead te ve y compra, corriendo solo: recordatorios de la reunión, follow-up post-llamada y nutrición multicanal. El no-show y el lead frío olvidado son el asesino silencioso.',
    senales: [
      'Persigues tú cada lead a mano; si un día no estás, no los toca nadie.',
      'El no-show te come la agenda y no hay recordatorio que salga solo.',
      'Después de un "lo pienso" el lead desaparece: no tienes follow-up armado.',
      'Todo vive en tu cabeza o en un Excel; nada se dispara solo.',
    ],
    faseCuello: 3,
  },
  {
    nombre: 'Escala y Equipo', emoji: '🚀',
    descripcion: 'Subir la inversión sin romper el CPA, con equipo que cierra y pautea por ti, y una escalera de valor donde todos los productos venden. Aquí el cuello eres tú: si no sueltas, no escala.',
    senales: [
      'Cada vez que subes el presupuesto, el CPA se dispara y tienes que bajarlo.',
      'Sigues cerrando tú las ventas o tocando la pauta todos los días.',
      'Tienes un solo producto; no hay peldaños de menor y mayor precio para el mismo cliente.',
      'Trabajas más horas para facturar lo mismo; el negocio no crece sin ti adentro.',
    ],
    faseCuello: 4,
  },
];

/** La dimensión débil que corresponde a una fase (1-5). F5 cae en Escala y Equipo. */
export function dimensionDeFase(faseId: number): Dimension {
  return DIMENSIONES.find((d) => d.faseCuello === faseId)
    ?? DIMENSIONES[Math.max(0, Math.min(DIMENSIONES.length - 1, faseId - 1))];
}

// ── El canal de venta (para adaptar la pregunta de volumen) ──────────────────
// MaKo sirve varios modelos de cierre. El volumen "correcto" no es el mismo: una
// llamada high-ticket no se mide igual que un carrito low-ticket ni que los
// registrados de un webinar. La pregunta de volumen se adapta al canal elegido,
// pero el VOTO (el índice de opción) mapea a la misma fase en todos.
//
// ⚠️ Este eje describe DÓNDE SE CIERRA la venta, no cómo entra el lead. Los dos
// son independientes y confundirlos fue el bug: una clienta que prospecta en frío
// por WhatsApp y cierra en un taller presencial declaró 'llamadas' —lo más
// parecido que había— y con eso el sistema le pidió, y ella grabó, un audio que
// dice «vi que dejaste tus datos en el anuncio». Cómo ENTRA vive en
// `funnel_config.data.entradas` (ver ENTRADAS en lib/pipeline.ts).
export type CanalId = 'llamadas' | 'conversaciones' | 'carrito' | 'webinar' | 'presencial';

export const CANALES: Array<{ id: CanalId; label: string; desc: string }> = [
  { id: 'llamadas', label: 'Llamada de venta', desc: 'Agendas una llamada y cierras la venta ahí.' },
  { id: 'conversaciones', label: 'Conversaciones por chat', desc: 'Vendes charlando por WhatsApp o DM, sin llamada.' },
  { id: 'carrito', label: 'Carrito / checkout', desc: 'Compran directo en tu página, sin que hables con ellos.' },
  { id: 'webinar', label: 'Webinar', desc: 'Se registran a un webinar y ahí presentas y vendes.' },
  { id: 'presencial', label: 'Sesión presencial', desc: 'Van a tu local, taller o sesión, y ahí cierras.' },
];

/** Texto + 5 opciones (una por fase) para la pregunta de volumen, por canal. */
export const VOLUMEN_POR_CANAL: Record<CanalId, { texto: string; opciones: string[] }> = {
  llamadas: {
    texto: '¿Cuántas llamadas de venta agendas por mes?',
    opciones: ['0 – 5 (casi ninguna)', '5 – 25', '25 – 75', '75 – 250', 'Más de 250'],
  },
  conversaciones: {
    texto: '¿Cuántas conversaciones de venta abres por mes?',
    opciones: ['0 – 20', '20 – 100', '100 – 400', '400 – 1.500', 'Más de 1.500'],
  },
  carrito: {
    texto: '¿Cuántas ventas por carrito haces por mes?',
    opciones: ['0 – 50', '50 – 250', '250 – 1.000', '1.000 – 5.000', 'Más de 5.000'],
  },
  webinar: {
    texto: '¿Cuántos registrados a tu webinar por mes?',
    opciones: ['0 – 50', '50 – 200', '200 – 600', '600 – 2.000', 'Más de 2.000'],
  },
  // Los tramos son los de 'llamadas' y no los de 'webinar', aunque la sesión sea
  // grupal: lo que se mide es a cuánta gente lográs llevar hasta la sesión, y eso
  // tiene el techo de un lugar físico, no el de un registro online.
  presencial: {
    texto: '¿Cuántas personas van a tu sesión o taller por mes?',
    opciones: ['0 – 5 (casi nadie)', '5 – 25', '25 – 75', '75 – 250', 'Más de 250'],
  },
};

// ── Las 6 preguntas (adaptadas a VSL Funnel + pauta) ─────────────────────────
// Cada opción, por orden, "vota" a una fase (índice 0-4). El diagnóstico combina
// los 6 votos (ver diagnosticar()). La pregunta 'volumen' usa por defecto la
// variante de "llamadas"; el wizard la reemplaza según el canal elegido.
export type Pregunta = { id: string; emoji: string; texto: string; opciones: string[] };

export const PREGUNTAS: Pregunta[] = [
  {
    id: 'facturacion', emoji: '💵', texto: '¿Cuánto factura tu negocio por mes?',
    opciones: ['$0 – $3.000 (o todavía nada)', '$3.000 – $10.000', '$10.000 – $30.000', '$30.000 – $80.000', 'Más de $80.000'],
  },
  {
    id: 'inversion', emoji: '🔥', texto: '¿Cuánto invertís por día en Meta Ads?',
    opciones: ['Nada o menos de $20', '$20 – $100', '$100 – $300', '$300 – $1.000', 'Más de $1.000'],
  },
  {
    id: 'creativos', emoji: '🎬', texto: '¿Cuántos creativos (anuncios) lanzas por mes?',
    opciones: ['0 – 3 (o ninguno)', '4 – 10', '10 – 25', '25 – 60', 'Más de 60'],
  },
  {
    // Volumen — se adapta al canal (ver VOLUMEN_POR_CANAL); default = llamadas.
    id: 'volumen', emoji: '📞', texto: VOLUMEN_POR_CANAL.llamadas.texto,
    opciones: VOLUMEN_POR_CANAL.llamadas.opciones,
  },
  {
    id: 'funnel', emoji: '🪜', texto: '¿Cómo está tu funnel hoy?',
    opciones: [
      'Todavía no tengo VSL ni oferta armada (o recién estoy probando).',
      'Tengo VSL y una oferta que ya agenda o vende, pero sin sistema atrás.',
      'Funnel completo (VSL + agenda + recordatorios + seguimiento) y un creativo ganador.',
      'Funnel + fábrica de creativos + remarketing, escalando con equipo.',
      'Escalera de valor validada: varios productos, de menor a mayor precio, vendiendo con creativos probados.',
    ],
  },
  {
    id: 'cuello', emoji: '🧠', texto: '¿Cuál es tu MAYOR cuello de botella hoy?',
    opciones: [
      'Un desconocido no me compra desde el anuncio: mi oferta o mi creativo todavía no funcionan.',
      'Me entran leads pero se caen: no llego a agendar, o agendan y no se presentan, o llegan a la llamada y no cierran.',
      'Vendo solo cuando empujo yo: ni los creativos, ni los recordatorios, ni el seguimiento corren solos.',
      'No doy abasto y no puedo subir la inversión sin que el CPA se dispare.',
      'Me sobra volumen y me falta foco: muchas ofertas, leads flojos, el margen no crece.',
    ],
  },
];

// ── El diagnóstico ──────────────────────────────────────────────────────────
export type Diagnostico = {
  /** Índice 0-4 de la fase diagnosticada (el display usa faseDef(fase).id → 1-5). */
  fase: number;
  cuello: CuelloId;
  /** Canal de venta elegido (para el contexto y la métrica de volumen). */
  canal?: CanalId;
  /** % de las respuestas que caen en la fase diagnosticada (qué tan parejo es). */
  consistencia: number;
  /** true si las respuestas están repartidas entre fases (avanzó en una dimensión y se atrasó en otra). */
  mixto: boolean;
  /** Reparto de votos por fase (índice 0-4), para el texto del diagnóstico mixto. */
  reparto: number[];
  /** Las respuestas crudas (índice de opción por pregunta). */
  respuestas: number[];
};

/**
 * De las 6 respuestas al diagnóstico. La fase es la MEDIANA de los votos (no la
 * moda): cuando el negocio está repartido, se queda en la fase MÁS BAJA con peso
 * — "trabajá primero el cuello de tu fase más baja antes de saltar adelante".
 * Con [0,1,1,2,2,2] la mediana cae en 1 → Fase 2 (display), y la consistencia = 33%.
 */
export function diagnosticar(respuestas: number[], canal?: CanalId): Diagnostico {
  const votos = respuestas.map((r) => Math.max(0, Math.min(4, r | 0)));
  const orden = [...votos].sort((a, b) => a - b);
  // Mediana con sesgo hacia abajo (índice 2 de 6 = el más bajo del par central).
  const fase = orden[Math.floor((orden.length - 1) / 2)];
  const reparto = [0, 0, 0, 0, 0];
  for (const v of votos) reparto[v]++;
  const consistencia = Math.round((reparto[fase] / votos.length) * 100);
  return {
    fase,
    cuello: faseDef(fase).cuello,
    canal,
    consistencia,
    mixto: consistencia < 60,
    reparto,
    respuestas: votos,
  };
}

/** El reparto como texto: "F1:1 · F2:2 · F3:3". Solo las fases con votos. */
export function repartoTexto(reparto: number[]): string {
  return reparto.map((n, i) => (n > 0 ? `F${i + 1}:${n}` : null)).filter(Boolean).join(' · ');
}

/**
 * El "Norte" preseteado, en una línea: lo que este cliente tiene que priorizar.
 * Es lo que después alimenta al Perro Guardián y a la Retro.
 */
export function norteDeFase(faseIdx: number): string {
  const f = faseDef(faseIdx);
  return `Fase ${f.id} (${f.nombre}) · Cuello: ${f.cuelloLabel}. ${f.objetivo}`;
}

/** Texto para inyectar en el contexto de MaKo (sabe en qué fase está el cliente). */
export function faseContextoTexto(d: Diagnostico | null): string {
  if (!d) return '';
  const f = faseDef(d.fase);
  const dim = dimensionDeFase(f.id);
  const criticas = f.acciones.filter((a) => a.critica).map((a) => a.texto);
  const lineas = [
    `FASE DEL NEGOCIO: ${f.id} — ${f.nombre} (${f.rango}).`,
    `Cuello de botella principal: ${f.cuelloLabel}. Dimensión débil: ${dim.nombre}.`,
    d.canal ? `Canal de venta: ${CANALES.find((c) => c.id === d.canal)?.label ?? d.canal}.` : null,
    `Objetivo/Norte de esta fase: ${f.objetivo}`,
    `Prioridades (críticas): ${criticas.join(' · ')}.`,
    `Estrategia de pauta: ${f.estrategia.prospeccion}% tráfico frío · ${f.estrategia.nutricion}% nutrición/retargeting · ${f.estrategia.escala}% escala.`,
    `Hito para avanzar de fase: ${f.hito}`,
    `Funnel sugerido: ${f.funnelSugerido.nombre} (${f.funnelSugerido.complejidad}) — ${f.funnelSugerido.comoFunciona}`,
    `Inversión sugerida: ${f.estrategia.inversion}`,
    `NO conviene todavía: ${f.noHacer.join(' · ')}`,
  ].filter(Boolean);
  if (d.mixto) lineas.push(`Diagnóstico mixto (${repartoTexto(d.reparto)}): trabajar primero el cuello de la fase más baja.`);
  return lineas.join('\n');
}
