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

/** Una jugada de la fase. Las críticas van marcadas (críticas primero, en orden). */
export type Accion = { texto: string; critica: boolean };

/** El mix de dónde va el presupuesto+esfuerzo en esta fase (suma 100). Reemplaza
 *  el "viral/autoridad/ventas" de Andrea por el de un negocio de VSL + pauta. */
export type Estrategia = { prospeccion: number; nutricion: number; escala: number; nota: string };

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
  /** Las jugadas de esta fase, en orden. Las `critica:true` van primero. */
  acciones: Accion[];
  /** Cómo repartir el presupuesto+esfuerzo en esta fase. */
  estrategia: Estrategia;
  /** Qué NO hacer todavía (el error caro de saltarse la fase). */
  noHacer: string;
  /** El HITO medible para pasar a la fase siguiente. */
  hito: string;
  color: string;
};

// Las 5 fases, adaptadas a un negocio que vende con VSL Funnel + pauta.
export const FASES: FaseDef[] = [
  {
    id: 1, nombre: 'Nacimiento', subtitulo: 'El primer creativo ganador', emoji: '🐣',
    cuello: 'oferta', cuelloLabel: 'Oferta y Mensaje',
    rango: '$0 – $3k/mes · $0 – $20/día en ads',
    objetivo: 'Encontrar UN creativo frío que traiga leads a un costo que cierra, y UNA oferta que un desconocido te compra sin que lo persigas.',
    sintomas: [
      'Vendés solo cuando le escribís vos a un conocido, un referido o alguien que ya te seguía; a un desconocido total todavía no le vendiste nada.',
      'Lanzás un creativo, no pasa nada, lo apagás a los dos días y probás otro, sin saber por qué el anterior no anduvo.',
      'Cambiás la oferta en cada llamada según quién tenés enfrente: no hay UNA oferta, hay un favor distinto cada vez.',
      'Mirás el costo por lead y no sabés si está bien o mal, porque no tenés con qué compararlo.',
      "El VSL o la landing están 'casi listos' hace semanas y todavía no los pusiste a correr con plata real.",
    ],
    acciones: [
      { texto: 'Sacá 3-5 creativos con la fábrica de creativos, cada uno con un ÁNGULO distinto (el dolor, el deseo, el enemigo común), misma oferta y mismo público. Buscás qué MENSAJE engancha al desconocido, no qué color ni qué música.', critica: true },
      { texto: 'Escribí UNA sola oferta con MaKo —a quién, qué problema, qué resultado y a qué precio— tan clara que un desconocido la entienda en 30 segundos. Si cambia según el cliente que tenés enfrente, todavía no es oferta.', critica: true },
      { texto: 'Prendé el tablero para mirar las dos únicas métricas de esta fase: costo por lead y si cerró un desconocido. Todo lo demás es ruido por ahora.', critica: false },
      { texto: 'Con 0-5 llamadas al mes no te podés dar el lujo de un plantón: prendé los recordatorios de reunión y el follow-up post-llamada. En esta fase, un solo no-show te tira el mes entero.', critica: false },
      { texto: 'Cargá el guion de setter/closer de MaKo. Cuando por fin agenda un desconocido, la llamada no puede depender de cómo te levantaste ese día.', critica: false },
    ],
    estrategia: { prospeccion: 80, nutricion: 20, escala: 0, nota: 'Casi todo a prospección: tenés que encontrar el creativo y la oferta que funcionan. Un poco de nutrición para no perder a los pocos que levantan la mano. Cero escala: no se escala lo que todavía no sabés si funciona.' },
    noHacer: 'No sumes equipo, no armes la escalera de valor, no subas el presupuesto ni te llenes de 15 creativos por mes. Escalar o delegar una oferta que ningún desconocido validó todavía es quemar plata rápido. Primero UN creativo ganador y UNA venta a alguien que no te conocía.',
    hito: 'UN creativo que trae leads a un costo rentable de forma repetible (no un golpe de suerte de una semana) + las primeras ventas reales a desconocidos, todas con la MISMA oferta. Ahí ya sabés qué tenés para escalar: recién ahí pasás a Fase 2.',
    color: '#7C5CFB',
  },
  {
    id: 2, nombre: 'Crecimiento', subtitulo: 'El funnel que convierte', emoji: '🌱',
    cuello: 'conversion', cuelloLabel: 'Conversión',
    rango: '$3k – $10k/mes · $20 – $100/día en ads',
    objetivo: 'Que cada tramo del funnel —del VSL al cierre— convierta parejo, y encontrar el eslabón que te está tirando la plata a la basura.',
    sintomas: [
      'Entran leads pero se caen: agendás una R1 y la mitad no aparece.',
      'Sabés cuánto te sale un lead, pero no cuánto te sale una venta cerrada — y el CPA real te asusta.',
      'Perseguís vos cada lead por WhatsApp; si no escribís a mano, no compra nadie.',
      'El creativo trae clics, pero no sabés si se rompe en el VSL, en la landing o en la llamada.',
      'Cada semana da otro número: una semana cerrás tres, la otra cero, y no sabés por qué.',
    ],
    acciones: [
      { texto: 'Medí el funnel tramo por tramo en el tablero —retención del VSL, CTR de la landing, show de la R1, tasa de cierre— y atacá primero el eslabón más flojo, uno a la vez, no todo junto. Encontrar dónde se rompe es EL trabajo de esta fase.', critica: true },
      { texto: "Cortá el no-show, que es el asesino #1: dejá corriendo los recordatorios de reunión (día antes + 1h antes) y el follow-up de MaKo para el que no apareció o quedó en 'lo pienso'. Acá lo automatizás para que no dependa de tu memoria.", critica: true },
      { texto: 'Estandarizá el cierre con los guiones de setter/closer: anotá las objeciones que se repiten y ajustá el libreto sobre eso, para que la tasa no dependa de qué día se levantó el que atiende.', critica: false },
      { texto: 'Prendé la nutrición y el remarketing sobre el que ya te vio y no agendó o no compró —secuencia de mensajes + creativos de retargeting— en vez de gastar todo en tráfico frío nuevo. Ahí está la venta que se te caía.', critica: false },
      { texto: 'No dejes morir al ganador: pedile a la fábrica de creativos 2-3 variantes ahora, mientras convierte, para tener con qué reemplazarlo el día que empiece a fatigar.', critica: false },
    ],
    estrategia: { prospeccion: 60, nutricion: 30, escala: 10, nota: 'Seguís prospectando fuerte (60) para no colgar todo de un solo ganador, pero ya metés 30 en calentar al que te vio y no cerró: ahí se recupera la venta que se te caía. La escala (10) recién asoma —subís de a poco, solo lo que ya probó que convierte.' },
    noHacer: "No subas el presupuesto para 'traer más leads' cuando el problema es que los que ya entran no cierran. Escalás el agujero y quemás plata más rápido. Primero arreglá la cadena, después le das gas.",
    hito: 'Tasa de cierre estable y CPA sano sostenidos 4+ semanas seguidas, con el funnel convirtiendo parejo y sin que vos persigas cada lead a mano.',
    color: '#1E9E57',
  },
  {
    id: 3, nombre: 'Monetización', subtitulo: 'La máquina que corre sola', emoji: '💰',
    cuello: 'sistema', cuelloLabel: 'Sistema',
    rango: '$10k – $30k/mes · $100 – $300/día en ads',
    objetivo: 'Que la fábrica de creativos, la nutrición y el follow-up corran solos en evergreen: la máquina depende del sistema, no de que vos empujes todos los días.',
    sintomas: [
      'Vivís colgado de UN creativo ganador y rezás para que no se fatigue, porque sostiene casi toda tu pauta.',
      'Sacás creativos nuevos a los tirones, cuando el ganador ya empezó a caer y el CPA subió, no antes.',
      'Si te tomás una semana, la máquina se frena: cada venta todavía depende de que vos empujes.',
      'El lead que no cerró en la R1 se enfría y nadie lo vuelve a tocar; los no-shows se pierden a mano.',
      'El funnel ya convierte parejo, pero lo sostenés vos a pulso: si no estás encima, se cae.',
    ],
    acciones: [
      { texto: 'Prendé la fábrica de creativos en modo evergreen: producí en tandas 10-25 creativos/mes para tener SIEMPRE el próximo ganador en banca. La regla es rotar por calendario, reemplazando al ganador ANTES de que se fatigue, no correr a producir cuando el CPA ya se disparó.', critica: true },
      { texto: "Dejá la nutrición multicanal y el follow-up en piloto automático de punta a punta: recordatorios, rescate de no-show y una secuencia larga para el lead que dijo 'lo pienso' y no volvió. En Fase 2 apagaste el no-show; acá el objetivo es que ningún lead frío quede sin tocar sin que vos muevas un dedo.", critica: true },
      { texto: 'Sacá el cierre de tu cabeza: meté los guiones de setter y closer DENTRO de MaKo con las objeciones ya resueltas, para que cualquiera que atienda siga el mismo libreto y la tasa no se mueva según quién estuvo ese día.', critica: false },
      { texto: 'Reciclá al público que ya es tuyo con remarketing sostenido (VSL a medias, landing sin agendar, no-show viejo): creativos que lo vuelven a entrar al funnel semanas después. Ya lo pagaste una vez; no lo pagues de nuevo como frío.', critica: false },
      { texto: 'Leé fatiga por creativo en el tablero (CPA y frecuencia de CADA uno) y dejá que ese número te avise cuándo meter el reemplazo de la banca. Rotás con dato, no a ojo ni cuando ya te pegó en la facturación.', critica: false },
    ],
    estrategia: { prospeccion: 40, nutricion: 40, escala: 20, nota: 'Ya no cazás un solo ganador: 40 va a creativos fríos nuevos para llenar la banca de reemplazos, 40 a calentar y recuperar al que ya te vio (nutrición + no-show + remarketing) y 20 a subir presupuesto en lo que rinde. La escala todavía va atrás; en Fase 4 pasa al frente.' },
    noHacer: 'No dejes que toda la máquina se apoye en UN creativo ganador y en que vos empujes cada venta. Si el sistema se cae cuando te tomás una semana, no es sistema: es un cuello con forma tuya. Y en Fase 4, cuando subas la inversión, ese cuello se rompe justo cuando más gastás.',
    hito: 'Los creativos nuevos reemplazan al ganador ANTES de que se fatigue, la nutrición y los recordatorios/follow-up corren automáticos, y vendés sin empujar cada lead. Sostenido 4+ semanas y con vos afuera del día a día.',
    color: '#C8870C',
  },
  {
    id: 4, nombre: 'Escalamiento', subtitulo: 'Escala rentable con equipo', emoji: '🚀',
    cuello: 'delegacion', cuelloLabel: 'Delegación',
    rango: '$30k – $80k/mes · $300 – $1.000/día en ads',
    objetivo: 'Subir la inversión en Meta manteniendo el CPA, con un equipo que corre la operación y vos fuera del cierre y de la pauta diaria.',
    sintomas: [
      'Ya no das abasto: entran más leads de los que tu agenda y tus closers pueden atender bien.',
      'Cada vez que subís el presupuesto el CPA se dispara y tenés que volver a bajarlo al día siguiente.',
      'La máquina ya corre sola, pero corre a UN tamaño: no sabés cómo darle más gas sin romperla.',
      'Contrataste closer, editor o media buyer, pero terminás corrigiéndoles todo: el estándar sigue en tu cabeza, no escrito.',
      'Seguís metiendo mano en cada cierre y tocando la pauta todos los días; sos el techo de tu propia operación.',
    ],
    acciones: [
      { texto: 'Escalá por estructura, no de golpe: subí presupuesto en los ganadores probados y abrí campañas de prospección nuevas en paralelo. Vigilá CPA y ROAS por campaña día a día en el tablero y cortá antes de que se rompa, no después. Este manejo de la escala es lo nuevo de esta fase.', critica: true },
      { texto: 'Sacate del cierre de una vez: armá el equipo de closers y setters sobre los guiones que ya estandarizaste, y sumá el Closing Analyst sobre las llamadas grabadas para que el estándar viva en el sistema y mejore sin vos encima.', critica: true },
      { texto: 'Delegá la pauta diaria: pasá la operación de Meta a un media buyer con el tablero de MaKo como fuente de verdad. Vos revisás números y decidís dónde escalar; no tocás botones todos los días.', critica: false },
      { texto: 'Blindá el show contra el volumen: con más leads entrando, un mismo % de no-show te cuesta el doble de plata. Confirmá que los recordatorios y el follow-up aguanten el nuevo caudal sin que se escape ningún lead caro.', critica: false },
      { texto: 'Poné la banca de creativos a la altura de la escala: cuando subís presupuesto, el ganador se fatiga más rápido, así que necesitás 2-3 reemplazos listos SIEMPRE, no los que alcanzaban en Fase 3.', critica: false },
    ],
    estrategia: { prospeccion: 40, nutricion: 20, escala: 40, nota: 'Escala pesa tanto como prospección: subís fuerte en los ganadores probados mientras seguís alimentando la máquina con creativos fríos nuevos. El retargeting baja de peso, no porque importe menos, sino porque el volumen ya lo sostienen los otros dos frentes.' },
    noHacer: 'No escales de golpe subiendo el presupuesto un día solo porque un creativo viene bien. Sin reemplazos listos en la banca y sin equipo con estándar escrito, el ganador se fatiga, el CPA se rompe y volvés a facturar como en Fase 3 pero quemando el doble de plata.',
    hito: 'Inversión escalada (rango $300-1.000/día) con CPA estable 4+ semanas seguidas, media operación delegada (pauta y cierre corriendo sin vos) y vos definitivamente fuera del cierre y de la pauta diaria.',
    color: '#2F6FED',
  },
  {
    id: 5, nombre: 'Priorización', subtitulo: 'La escalera de valor', emoji: '👑',
    cuello: 'foco', cuelloLabel: 'Foco',
    rango: '$80k+/mes · $1.000+/día en ads',
    objetivo: 'Dejar de correr atrás del volumen: que cada peldaño de tu escalera venda con creativos ya probados, y que el margen, el LTV y la retención crezcan más rápido que la facturación. Escalás solo lo rentable.',
    sintomas: [
      'Facturás más que nunca, pero el margen casi no se mueve: le metés más plata a Meta y arriba queda parecido.',
      'Tenés 4 o 5 ofertas o productos y no sabés bien cuál te deja el mejor margen ni cuál te trae los mejores clientes.',
      'Casi toda tu facturación viene de la venta fría de adelante (la R1/R2); vendés poco hacia arriba y casi no le recomprás al que ya te compró.',
      'Subís presupuesto en ángulos que facturan pero no dejan margen, y no lo ves hasta fin de mes.',
      'Te sobra volumen —leads, llamadas, creativos— y te falta foco: el problema ya no es traer más, es decidir qué mover.',
    ],
    acciones: [
      { texto: 'Rankeá tu escalera de valor por MARGEN y LTV, no por facturación. Usá el tablero (Cobranza y Revenue real) para ver cuánto deja de verdad cada peldaño después de pauta, comisiones de closer y fees, y cortá o achicá el que factura pero no deja plata arriba.', critica: true },
      { texto: 'Vendé hacia arriba y recomprá: activá la escalera con nutrición y remarketing sobre los que YA te compraron —upsell, programa de mayor ticket, renovación—. Subir el LTV de tu base sale mucho más barato que traer un lead frío nuevo, y es donde ganás en esta fase.', critica: true },
      { texto: 'Poné la fábrica de creativos a alimentar CADA peldaño, no solo la oferta de entrada: creativos ganadores probados también para el remarketing hacia arriba y las ofertas de ticket más alto.', critica: false },
      { texto: 'Atacá el churn con follow-up post-venta: onboarding del cliente nuevo, chequeos y guiones para frenar cancelaciones. La baja del que ya compró es tu no-show de esta fase; retenerlo vale más que un lead nuevo.', critica: false },
      { texto: 'Escalá solo lo rentable y dejá que el Perro Guardián lo defienda: subí presupuesto únicamente en los ángulos y ofertas con mejor CPA y mejor LTV; el resto se sostiene o se apaga. Foco, no expansión a ciegas.', critica: false },
    ],
    estrategia: { prospeccion: 30, nutricion: 30, escala: 40, nota: 'La plata se va a escalar lo que ya sabés que deja margen (40) y a calentar y recomprarle a tu base con la escalera (30). La prospección fría (30) la sostenés para no depender de una sola oferta, pero ya no es donde ganás: acá ganás en margen y en LTV.' },
    noHacer: 'Seguir escalando volumen a lo bruto: meterle más presupuesto a todo por igual persiguiendo facturación mientras el margen se achica y el churn se come lo que entra. Y peor todavía: sumar productos u ofertas nuevas sin validarlas con creativos ganadores, diluyendo el foco justo cuando lo que necesitás es simplificar.',
    hito: 'Escalera de valor validada con creativos ganadores probados en cada peldaño, y LTV y retención altos y estables. El negocio crece en margen y previsibilidad, no en volumen: podés bajar la prospección fría sin que la facturación caiga.',
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
    descripcion: 'Qué vendés, a quién y con qué promesa. Si un desconocido no la compra o el mensaje no le pega al dolor, no hay pauta ni funnel que lo salve. Es lo primero que se valida.',
    senales: [
      'Tus anuncios tienen buen CTR pero después nadie compra: hacen clic y se van.',
      'No podés explicar en una frase por qué alguien te elige a vos y no al de al lado.',
      'Bajás el precio para cerrar; sin descuento no entra nadie.',
      'Cambiás de oferta cada dos semanas porque ninguna termina de pegar.',
    ],
    faseCuello: 1,
  },
  {
    nombre: 'Pauta y Creativos', emoji: '🎬',
    descripcion: 'Tu capacidad de producir y testear creativos que frenan el scroll y traen clics baratos al VSL, sin quemar plata en la cuenta. Es el motor que empuja todas las fases; si se seca, se frena todo.',
    senales: [
      'Vivís de uno o dos creativos y cuando se cansan, se te cae la facturación.',
      'No sabés qué anuncio te trae las ventas: mirás el total, no creativo por creativo.',
      'El CPA sube semana a semana y no tenés creativos nuevos listos para reemplazar.',
      'Sacar un creativo nuevo te lleva días y lo hacés vos a mano cada vez.',
    ],
    faseCuello: 1,
  },
  {
    nombre: 'Funnel y Conversión', emoji: '🔻',
    descripcion: 'El tramo del clic a la venta: retención del VSL, CTA de la landing, que la R1 se presente y que el closer cierre. Si la cadena se rompe en un eslabón, pagás leads que no convierten.',
    senales: [
      'Entran leads pero la mayoría no llega a agendar o no se presenta a la llamada.',
      'No sabés en qué punto se te caen: si es el VSL, la landing o la reunión.',
      'La gente ve medio VSL y se va; la retención se desploma temprano.',
      'De las llamadas que sí se presentan, cerrás muy pocas y no sabés por qué.',
    ],
    faseCuello: 2,
  },
  {
    nombre: 'Nutrición y Sistema', emoji: '⚙️',
    descripcion: 'Lo que pasa entre que el lead te ve y compra, corriendo solo: recordatorios de la reunión, follow-up post-llamada y nutrición multicanal. El no-show y el lead frío olvidado son el asesino silencioso.',
    senales: [
      'Perseguís vos cada lead a mano; si un día no estás, no los toca nadie.',
      'El no-show te come la agenda y no hay recordatorio que salga solo.',
      'Después de un "lo pienso" el lead desaparece: no tenés follow-up armado.',
      'Todo vive en tu cabeza o en un Excel; nada se dispara solo.',
    ],
    faseCuello: 3,
  },
  {
    nombre: 'Escala y Equipo', emoji: '🚀',
    descripcion: 'Subir la inversión sin romper el CPA, con equipo que cierra y pautea por vos, y una escalera de valor donde todos los productos venden. Acá el cuello sos vos: si no soltás, no escala.',
    senales: [
      'Cada vez que subís el presupuesto, el CPA se dispara y tenés que bajarlo.',
      'Seguís cerrando vos las ventas o tocando la pauta todos los días.',
      'Tenés un solo producto; no hay peldaños de menor y mayor precio para el mismo cliente.',
      'Trabajás más horas para facturar lo mismo; el negocio no crece sin vos adentro.',
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
// MaKo sirve 3 modelos de cierre. El volumen "correcto" no es el mismo: una
// llamada high-ticket no se mide igual que un carrito low-ticket ni que los
// registrados de un webinar. La pregunta de volumen se adapta al canal elegido,
// pero el VOTO (el índice de opción) mapea a la misma fase en los tres.
export type CanalId = 'llamadas' | 'carrito' | 'webinar';

export const CANALES: Array<{ id: CanalId; label: string }> = [
  { id: 'llamadas', label: 'Llamada de venta' },
  { id: 'carrito', label: 'Carrito' },
  { id: 'webinar', label: 'Webinar' },
];

/** Texto + 5 opciones (una por fase) para la pregunta de volumen, por canal. */
export const VOLUMEN_POR_CANAL: Record<CanalId, { texto: string; opciones: string[] }> = {
  llamadas: {
    texto: '¿Cuántas llamadas de venta agendás por mes?',
    opciones: ['0 – 5 (casi ninguna)', '5 – 25', '25 – 75', '75 – 250', 'Más de 250'],
  },
  carrito: {
    texto: '¿Cuántas ventas por carrito hacés por mes?',
    opciones: ['0 – 50', '50 – 250', '250 – 1.000', '1.000 – 5.000', 'Más de 5.000'],
  },
  webinar: {
    texto: '¿Cuántos registrados a tu webinar por mes?',
    opciones: ['0 – 50', '50 – 200', '200 – 600', '600 – 2.000', 'Más de 2.000'],
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
    id: 'creativos', emoji: '🎬', texto: '¿Cuántos creativos (anuncios) lanzás por mes?',
    opciones: ['0 – 3 (o ninguno)', '4 – 10', '10 – 25', '25 – 60', 'Más de 60'],
  },
  {
    // Volumen — se adapta al canal (ver VOLUMEN_POR_CANAL); default = llamadas.
    id: 'volumen', emoji: '📞', texto: VOLUMEN_POR_CANAL.llamadas.texto,
    opciones: VOLUMEN_POR_CANAL.llamadas.opciones,
  },
  {
    id: 'funnel', emoji: '🪜', texto: '¿Cómo está tu funnel / escalera de valor?',
    opciones: [
      'No tengo VSL ni oferta armada (o recién probando)',
      'VSL + una oferta que agenda o vende, pero sin sistema atrás',
      'Funnel completo: VSL + agenda + nutrición + follow-up, con un creativo ganador',
      'Funnel + fábrica de creativos + remarketing, escalando con equipo',
      'Escalera de valor validada (low→high): varios productos vendiendo con creativos ganadores probados',
    ],
  },
  {
    id: 'cuello', emoji: '🧠', texto: '¿Cuál es tu MAYOR cuello de botella hoy?',
    opciones: [
      'Nadie compra desde el anuncio / no tengo oferta-creativo que funcione',
      'Entran leads o llamadas, pero no cierran',
      'Vendo solo cuando empujo / no hay creativos nuevos ni sistema que corra solo',
      'No tengo tiempo, todo depende de mí / no puedo escalar sin romper el CPA',
      'Disperso: muchas ofertas, leads de baja calidad, me falta foco',
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
    `Estrategia de pauta: ${f.estrategia.prospeccion}% prospección · ${f.estrategia.nutricion}% nutrición/retargeting · ${f.estrategia.escala}% escala.`,
    `Hito para avanzar de fase: ${f.hito}`,
    `NO conviene todavía: ${f.noHacer}`,
  ].filter(Boolean);
  if (d.mixto) lineas.push(`Diagnóstico mixto (${repartoTexto(d.reparto)}): trabajar primero el cuello de la fase más baja.`);
  return lineas.join('\n');
}
