// =============================================================================
// Las pruebas del EXPERTO del Copywriter (evals): los casos, en el formato de marketingskills (18/11/2026)
// =============================================================================
// docs/plantillas-reales/README.md (sección 4): «Las pruebas del experto (evals) usan el formato de marketingskills
// (`prompt`, `expected_output`, `assertions`)». marketingskills (https://github.com/coreyhaines31/marketingskills, MIT,
// lib/avisos/LICENSE-MARKETINGSKILLS) guarda en `evals/evals.json` un pedido, la salida esperada y sus verificaciones; acá
// van igual, y cada caso trae además las SALIDAS del modelo con las que se prueban esas verificaciones:
//   · `buena`: lo que el experto (lib/copywriter/experto.ts) tendría que devolver. Pasa TODAS sus verificaciones;
//   · `malas`: cada una rompe UNA regla del método (`rompe`) y esa verificación tiene que dar rojo;
//   · `arregladas`: un defecto que el CÓDIGO corrige solo (el voseo, las palabras en inglés, una sección de notas que nadie
//     pidió, el renglón de la sección copiado): con el defecto adentro, después del saneo pasa igual.
// El modelo NO se llama: lo que se ejecuta es lo determinista (el pedido que se le arma, el saneo y la aplicación de sus
// operaciones, y las verificaciones). La calidad de un modelo de verdad se mide con el arnés de chats
// (scripts/probar-chats/), que sí lo llama.
//
// LOS NEGOCIOS DE LOS CASOS SON INVENTADOS (Cocina con Margen, Plan Fiscal Claro, Estudio Raíz y Ritmo Docente), como sus
// cifras: ninguno es de la lista REALES (tests/_reales.ts). Las salidas buenas están en español neutro con «tú».
// =============================================================================

import type { DatoNegocio } from '../lib/copywriter/experto';
import { marcasDeVoseo } from '../lib/puestas-data';

/** Un bloque y una operación como los escribe el modelo (lib/copywriter/ia-editar.ts, FORMATO_EDITAR). */
export type Bloque = Record<string, unknown>;
export type Op = Record<string, unknown>;
export type SalidaModelo = { respuesta: string; operaciones: Op[] };

/** Las verificaciones (marketingskills: `assertions`): cada una sale de una regla escrita del método (el test lo exige). */
export const IDS_VERIFICACION = [
  'escribe-entera', 'nada-del-ejemplo', 'sin-cifras-inventadas', 'dato-donde-falta', 'una-pregunta', 'destacado-arriba',
  'titulo-y-angulo', 'conserva-la-forma', 'sin-muletillas', 'sin-voseo', 'reglas-de-meta', 'palabra-clave', 'reglas-del-email',
  'largo-de-la-duracion', 'toca-solo-lo-pedido', 'responde-en-una-linea',
] as const;
export type IdVerificacion = (typeof IDS_VERIFICACION)[number];

export type CasoEval = {
  id: string;
  /** Lo que pide la persona (marketingskills: `prompt`), como lo arma la pantalla (lib/copywriter/iniciativa.ts) o lo escribe. */
  prompt: string;
  /** La plantilla de «Nueva» de la que nació la página. */
  plantilla: string;
  /** true: «Adaptar a mi negocio» (`copywriter.adaptar.user`); false: «Editar» con su user de siempre. */
  adaptar: boolean;
  /** La página sobre la que se trabaja: el esqueleto de la plantilla, o la que dejó la salida buena de otro caso. */
  sobre?: string;
  /** EL NEGOCIO del Second Brain (inventado) y los nombres de sus ofertas (lo que `alEspanol` no toca). */
  negocio: string;
  ofertas: string[];
  /** Lo que la plantilla usa (`pide`) y EL NEGOCIO no dice: va como [DATO: …]. */
  falta: DatoNegocio[];
  /** Lo propio del negocio ficticio del ejemplo que no puede quedar (además de su nombre y sus cifras). */
  delEjemplo: string[];
  /** false = el negocio dice que no tiene la automatización que contesta una palabra clave. */
  automatizacion?: boolean;
  /** Un cambio puntual: las únicas secciones que se pueden tocar. */
  tocar?: string[];
  /** Lo que tiene que salir (marketingskills: `expected_output`). */
  expected_output: string;
  assertions: IdVerificacion[];
  buena: SalidaModelo;
  malas: { rompe: IdVerificacion; porque: string; salida: SalidaModelo }[];
  /** `queTiene` se corre sobre el texto CRUDO de la salida (tiene que encontrar el defecto) y sobre el texto de la página
   *  después del saneo (no tiene que encontrar nada). */
  arregladas?: { porque: string; queTiene: (texto: string) => string[]; salida: SalidaModelo }[];
};

// ── Cómo se escribe una salida (la forma de FORMATO_EDITAR) ──────────────────────────────────────────────────────────

const txt = (texto: string): Bloque => ({ tipo: 'texto', texto });
const vin = (...items: string[]): Bloque => ({ tipo: 'vinetas', items });
const tab = (...filas: string[][]): Bloque => ({ tipo: 'tabla', filas });
const sec = (seccion: string, ...bloques: Bloque[]): Op => ({ op: 'escribir_seccion', seccion, bloques });
/** El destacado de arriba de todo (para quién es y cómo se mide). */
const arriba = (texto: string): Op => ({ op: 'insertar_despues', bid: null, bloques: [{ tipo: 'destacado', texto, emoji: '🎯' }] });
const titulo = (texto: string): Op => ({ op: 'titulo', texto });
const props = (p: Record<string, unknown>): Op => ({ op: 'propiedades', ...p });

/** La misma salida con otra versión de una sección. */
function conSeccion(s: SalidaModelo, seccion: string, ...bloques: Bloque[]): SalidaModelo {
  return { ...s, operaciones: s.operaciones.map((op) => (op.op === 'escribir_seccion' && op.seccion === seccion ? sec(seccion, ...bloques) : op)) };
}
const sinOps = (s: SalidaModelo, quitar: (op: Op) => boolean): SalidaModelo => ({ ...s, operaciones: s.operaciones.filter((op) => !quitar(op)) });
const conOps = (s: SalidaModelo, ...ops: Op[]): SalidaModelo => ({ ...s, operaciones: [...s.operaciones, ...ops] });
const conRespuesta = (s: SalidaModelo, respuesta: string): SalidaModelo => ({ ...s, respuesta });
const marcas = (re: RegExp) => (t: string): string[] => t.match(re) ?? [];

// ── 1 · Anuncio a cámara (PAS), adaptado ─────────────────────────────────────────────────────────────────────────────

const NEGOCIO_COCINA = 'Cocina con Margen: mentoría de 12 semanas para dueños de restaurantes que facturan bien y no les queda dinero. Oferta principal: «Cocina con Margen», USD 1,800, en grupo, con una sesión semanal en vivo y la revisión de los costos de tu carta. A quién le habla: dueños de restaurantes de 10 a 40 mesas que dicen "facturo bien pero a fin de mes no me queda nada". La acción: agendar un diagnóstico gratis de 30 minutos.';

const GANCHO_COCINA = sec('GANCHO', vin(
  '**Se ve:** [DATO: quién sale en cámara] en la cocina, con el cierre de caja en la mano.',
  '**Dice:** «Si tu restaurante se llena cada fin de semana y a fin de mes no te queda nada, el problema está en tu carta.»',
  '**Texto en pantalla:** «Lleno el sábado, sin ganancia el día 30»',
));
const SOLUCION_COCINA = '**Dice:** «En Cocina con Margen revisamos el costo de cada platillo de tu carta y decidimos cuáles subir, cuáles quitar y cuáles vender más. Son 12 semanas en grupo, con una sesión en vivo cada semana.»';

const ANUNCIO: CasoEval = {
  id: 'anuncio-adaptado',
  prompt: 'Es para: Agendar llamadas. Adáptalo a mi oferta «Cocina con Margen».',
  plantilla: 'guion-anuncio', adaptar: true, negocio: NEGOCIO_COCINA, ofertas: ['Cocina con Margen'],
  falta: ['quien_habla'], delEjemplo: ['Andrea', 'lo voy a pensar'],
  expected_output: 'El anuncio de 45 s entero para Cocina con Margen, sección por sección, con [DATO: quién sale en cámara] (el negocio no lo dice), el texto del anuncio con un título corto, un destacado arriba con para quién es y cómo se mide, un título y el ángulo «dolor». Nada de Cierre Consultivo. En la respuesta, una sola pregunta: quién sale en cámara.',
  assertions: ['escribe-entera', 'nada-del-ejemplo', 'sin-cifras-inventadas', 'dato-donde-falta', 'una-pregunta', 'destacado-arriba', 'titulo-y-angulo', 'conserva-la-forma', 'sin-muletillas', 'sin-voseo', 'reglas-de-meta'],
  buena: {
    respuesta: 'Escribí el anuncio entero para «Cocina con Margen» y quedó 1 [DATO: …] por completar. ¿Quién sale en cámara y de qué país es? Por ejemplo: «Yo, de Chile».',
    operaciones: [
      arriba('Para dueños de restaurantes que facturan bien y no ven ganancia. Se mide en el costo por diagnóstico agendado.'),
      titulo('Facturas bien y no te queda nada'),
      props({ angulo: 'dolor' }),
      GANCHO_COCINA,
      sec('PROBLEMA', vin(
        '**Se ve:** el reporte de ventas del día, junto a la caja.',
        '**Dice:** «Vendes, pagas a los proveedores, pagas los sueldos y la cuenta no cierra. Subes los precios y la gente se queja; los bajas y trabajas gratis.»',
      )),
      sec('AGITACION', vin(
        '**Se ve:** una mano tacha platillos en la carta impresa.',
        '**Dice:** «Cada platillo que vendes por debajo de su costo te cobra dos veces: en lo que pierdes y en las horas que trabajas para nada. Y mientras no sepas cuáles son, el mes que viene se repite.»',
        '**Texto en pantalla:** «¿Qué platillos te cuestan dinero?»',
      )),
      sec('SOLUCION', vin('**Se ve:** la carta con el costo anotado al lado de cada platillo.', SOLUCION_COCINA)),
      sec('CTA', vin(
        '**Dice:** «Toca "Más información" y agenda un diagnóstico gratis de 30 minutos. Me cuentas cómo está tu carta y te digo por dónde se te va el margen.»',
        '**Texto en pantalla:** «Agenda tu diagnóstico»',
      )),
      sec('TEXTO DEL ANUNCIO', vin(
        '**Texto principal:** «Si tu restaurante se llena y a fin de mes no te queda nada, agenda un diagnóstico gratis de 30 minutos. Revisamos tu carta y te digo qué platillos te cuestan dinero.»',
        '**Título:** «Lleno y sin ganancia»',
        '**Botón:** Más información',
      )),
    ],
  },
  malas: [],
  arregladas: [],
};
ANUNCIO.malas = [
  { rompe: 'escribe-entera', porque: 'contesta con preguntas en lugar de la pieza', salida: { respuesta: 'Antes de escribir: ¿quién sale en cámara? ¿Tienes un caso con números?', operaciones: [] } },
  { rompe: 'nada-del-ejemplo', porque: 'deja la agitación de Cierre Consultivo (Andrea y los USD 8,000)', salida: conSeccion(ANUNCIO.buena, 'AGITACION', vin(
    '**Se ve:** Andrea anota la cuenta en una libreta.',
    '**Dice:** «Haz la cuenta: si tu programa vale mil dólares y se te escapan dos llamadas por semana, son ocho mil dólares al mes que se quedan en un chat.»',
    '**Texto en pantalla:** «2 llamadas por semana = USD 8,000 al mes»',
  )) },
  { rompe: 'sin-cifras-inventadas', porque: 'inventa un porcentaje que el negocio no tiene', salida: conSeccion(ANUNCIO.buena, 'SOLUCION', vin(
    '**Se ve:** la carta con el costo anotado al lado de cada platillo.',
    '**Dice:** «El 73 % de los restaurantes que trabajan conmigo suben su margen en el primer mes. Son 12 semanas en grupo, con una sesión en vivo cada semana.»',
  )) },
  { rompe: 'dato-donde-falta', porque: 'inventa quién sale en cámara en lugar de dejar el [DATO: …]', salida: conSeccion(ANUNCIO.buena, 'GANCHO', vin(
    '**Se ve:** Luis, el chef, en la cocina, con el cierre de caja en la mano.',
    '**Dice:** «Si tu restaurante se llena cada fin de semana y a fin de mes no te queda nada, el problema está en tu carta.»',
    '**Texto en pantalla:** «Lleno el sábado, sin ganancia el día 30»',
  )) },
  { rompe: 'sin-muletillas', porque: '«descubre» y «potencia», las muletillas que el método prohíbe', salida: conSeccion(ANUNCIO.buena, 'SOLUCION', vin(
    '**Se ve:** la carta con el costo anotado al lado de cada platillo.',
    '**Dice:** «Descubre cómo Cocina con Margen potencia tu restaurante: revisamos el costo de cada platillo de tu carta en 12 semanas.»',
  )) },
  { rompe: 'reglas-de-meta', porque: 'el título del anuncio pasa de los 40 caracteres', salida: conSeccion(ANUNCIO.buena, 'TEXTO DEL ANUNCIO', vin(
    '**Texto principal:** «Si tu restaurante se llena y a fin de mes no te queda nada, agenda un diagnóstico gratis de 30 minutos.»',
    '**Título:** «El método para que tu restaurante deje de perder dinero cada mes»',
    '**Botón:** Más información',
  )) },
  { rompe: 'destacado-arriba', porque: 'no deja el destacado de para quién es y cómo se mide', salida: sinOps(ANUNCIO.buena, (op) => op.op === 'insertar_despues') },
  { rompe: 'una-pregunta', porque: 'hace tres preguntas en lugar de una', salida: conRespuesta(ANUNCIO.buena, 'Escribí el anuncio entero. ¿Quién sale en cámara? ¿Tienes un caso con números? ¿Cuánto inviertes en anuncios?') },
  { rompe: 'titulo-y-angulo', porque: 'no pone título ni ángulo', salida: sinOps(ANUNCIO.buena, (op) => op.op === 'titulo' || op.op === 'propiedades') },
  { rompe: 'conserva-la-forma', porque: 'el texto del anuncio sale en un párrafo, sin «Texto principal», «Título» ni «Botón»', salida: conSeccion(ANUNCIO.buena, 'TEXTO DEL ANUNCIO', txt('Si tu restaurante se llena y a fin de mes no te queda nada, agenda un diagnóstico gratis de 30 minutos.')) },
];
ANUNCIO.arregladas = [
  { porque: 'el voseo se pasa a «tú» solo (operacionesAlTuteo)', queTiene: marcasDeVoseo, salida: conSeccion(ANUNCIO.buena, 'CTA', vin(
    '**Dice:** «Tocá "Más información" y agendá un diagnóstico gratis de 30 minutos. Me contás cómo está tu carta y te digo por dónde se te va el margen.»',
    '**Texto en pantalla:** «Agenda tu diagnóstico»',
  )) },
  { porque: 'las palabras sueltas en inglés pasan al español solas (operacionesAlEspanol)', queTiene: marcas(/\b(?:tips|step by step)\b/gi), salida: conSeccion(ANUNCIO.buena, 'SOLUCION', vin(
    '**Se ve:** la carta con el costo anotado al lado de cada platillo.',
    '**Dice:** «En Cocina con Margen revisamos tu carta step by step y te doy los tips para decidir qué platillos subir. Son 12 semanas en grupo, con una sesión en vivo cada semana.»',
  )) },
  { porque: 'la sección nombrada como la ve en el guion («## SECCIÓN GANCHO: Gancho») y con su título repetido se lee igual (sanearOperaciones)', queTiene: (t) => [
    ...marcas(/SECCIÓN GANCHO/g)(t),
    // El título repetido: el texto de la página trae «GANCHO» UNA vez, la de su sección.
    ...((t.match(/^GANCHO$/gm) ?? []).length > 1 ? ['GANCHO dos veces'] : []),
  ], salida: {
    ...ANUNCIO.buena,
    operaciones: ANUNCIO.buena.operaciones.map((op) => (op === GANCHO_COCINA ? { op: 'escribir_seccion', seccion: '## SECCIÓN GANCHO: Gancho', bloques: [{ tipo: 'titulo2', texto: 'GANCHO' }, ...(GANCHO_COCINA.bloques as Bloque[])] } : op)),
  } },
];

// ── 2 · Reel que trae mensajes, sin la automatización de la palabra clave ─────────────────────────────────────────────

const REEL: CasoEval = {
  id: 'reel-sin-automatizacion',
  prompt: 'Es para: Mensajes con una palabra. Adáptalo a mi oferta «Plan Fiscal Claro».',
  plantilla: 'reel', adaptar: true, ofertas: ['Plan Fiscal Claro'], automatizacion: false,
  negocio: 'Plan Fiscal Claro: asesoría fiscal para freelancers de diseño y programación en México. Oferta: «Plan Fiscal Claro», USD 900 al año: las declaraciones mensuales, la anual y un canal directo para dudas. A quién le habla: freelancers que facturan a clientes del extranjero y dicen "no sé cuánto tengo que apartar para impuestos". La acción: agendar una llamada de 15 minutos desde el enlace del perfil. Todavía no tenemos la automatización que contesta comentarios con una palabra clave.',
  falta: ['palabra_clave', 'recurso'], delEjemplo: ['Andrea'],
  expected_output: 'El reel entero (gancho, historia en tabla, moraleja, CTA y caption) para Plan Fiscal Claro. Como el negocio no tiene la automatización, el CTA lleva a la llamada de 15 minutos y la palabra clave queda como [DATO: …]: nunca «comenta X». En la respuesta, una pregunta por el recurso para regalar.',
  assertions: ['escribe-entera', 'nada-del-ejemplo', 'sin-cifras-inventadas', 'dato-donde-falta', 'una-pregunta', 'destacado-arriba', 'titulo-y-angulo', 'conserva-la-forma', 'sin-muletillas', 'sin-voseo', 'palabra-clave'],
  buena: {
    respuesta: 'Escribí el reel entero con la llamada de 15 minutos como acción, porque todavía no tienes la automatización de la palabra clave. ¿Tienes algo para regalar a quien escriba? Por ejemplo: «Checklist de 12 puntos».',
    operaciones: [
      arriba('Para freelancers que facturan al extranjero y no saben cuánto apartar. Se mide en llamadas agendadas desde el perfil.'),
      titulo('Tres errores con los impuestos de un freelancer'),
      props({ angulo: 'educativo' }),
      sec('GANCHO', vin(
        '**Frase hablada:** «Si facturas a clientes de afuera, estos tres errores te cuestan dinero cada abril.»',
        '**Título en pantalla:** «3 errores fiscales de un freelancer»',
        '**Visual:** una mano tacha tres renglones en una libreta.',
      )),
      sec('HISTORIA', tab(
        ['Escena', 'Locución', 'Cámara'],
        ['1', '«Uno: no apartar nada cada mes. Cuando llega la declaración anual, el dinero ya se gastó.»', 'Plano medio. En pantalla: «1. No apartar cada mes».'],
        ['2', '«Dos: facturar sin saber en qué régimen estás. Puedes estar pagando de más sin enterarte.»', 'Cambio de ángulo. En pantalla: «2. El régimen equivocado».'],
        ['3', '«Tres: dejar las deducciones para el último día. Lo que no juntaste en el año, ya no lo puedes deducir.»', 'Primer plano. En pantalla: «3. Las deducciones del último día».'],
      )),
      sec('MORALEJA', txt('Los impuestos de un freelancer se ordenan cada mes, no en abril.')),
      sec('CTA', txt('Si quieres ordenar los tuyos, agenda una llamada de 15 minutos desde el enlace de mi perfil.'), vin('**Palabra clave:** [DATO: la palabra, cuando tengas la automatización que la contesta]')),
      sec('CAPTION', txt('Los impuestos de un freelancer se ordenan cada mes. Guárdalo para tu próxima factura y agenda 15 minutos desde el enlace del perfil.')),
    ],
  },
  malas: [],
};
REEL.malas = [
  { rompe: 'palabra-clave', porque: 'pide comentar una palabra que nadie va a contestar', salida: conSeccion(REEL.buena, 'CTA', txt('Comenta IMPUESTOS y te mando por mensaje la lista para ordenar los tuyos.'), vin('**Palabra clave:** IMPUESTOS')) },
  { rompe: 'conserva-la-forma', porque: 'pasa la tabla de la historia a párrafos', salida: conSeccion(REEL.buena, 'HISTORIA',
    txt('Uno: no apartar nada cada mes. Cuando llega la declaración anual, el dinero ya se gastó.'),
    txt('Dos: facturar sin saber en qué régimen estás.'),
    txt('Tres: dejar las deducciones para el último día.'),
  ) },
  { rompe: 'nada-del-ejemplo', porque: 'deja la moraleja del ejemplo tal cual', salida: conSeccion(REEL.buena, 'MORALEJA', txt('La mayoría de las ventas se pierden en el chat, antes de la llamada.')) },
  // «andá», «vení», «pedime» o «ponete» no los pasa `alTuteo` (sí «tocá», «agendá», «contás»): quedan, y sólo los avisa la tarjeta.
  { rompe: 'sin-voseo', porque: 'un imperativo de voseo que el código no pasa a «tú»', salida: conSeccion(REEL.buena, 'CAPTION', txt('Los impuestos de un freelancer se ordenan cada mes. Andá al enlace del perfil y agenda 15 minutos.')) },
];

// ── 3 · Email de cierre, con la fecha, el cupo y la garantía del negocio ─────────────────────────────────────────────

// ⚠️ Ni «Hola, {nombre}:» ni «Agenda tu llamada de admisión»: son bloques del ejemplo de Voz de Líder tal cual, y
// `restosDelEjemplo` los cuenta como restos (la página diría que todavía no es del negocio).
const CUERPO_EMAIL = [
  'Hola, {nombre}. Te escribo por la cohorte de marzo.',
  'Si haces bodas todo el año y al sacar la cuenta del mes te queda menos de lo que esperabas, casi siempre el problema es el precio por sesión.',
  'En Estudio Raíz trabajamos 10 semanas en lo que hace que una pareja pague más por la sesión: el portafolio que muestras, el paquete que ofreces y cómo respondes cuando te preguntan el precio.',
  'La inversión es de USD 1,400 de contado, o 2 pagos de USD 750. Si haces las 10 entregas y no subes tu precio por sesión, te devolvemos el pago.',
  'La cohorte de marzo empieza el 3 de marzo y somos 15. Quedan 6 lugares, y las inscripciones cierran el domingo 1 de marzo a las 11:59 p. m. (hora de Ciudad de México).',
  'Agenda tu llamada de admisión de 20 minutos aquí: https://example.com/admision',
  'P. D. Si no sabes si es para ti, responde este correo con una línea: cuánto cobras hoy por sesión. Te contesto yo.',
];
const EMAIL: CasoEval = {
  id: 'email-de-cierre',
  prompt: 'Es para: Cerrar inscripciones. Adáptalo a mi oferta «Estudio Raíz».',
  plantilla: 'email', adaptar: true, ofertas: ['Estudio Raíz'],
  negocio: 'Estudio Raíz: programa de 10 semanas para fotógrafos de bodas que quieren cobrar más por sesión. Oferta: «Estudio Raíz», USD 1,400 de contado o 2 pagos de USD 750. La cohorte de marzo empieza el 3 de marzo; quedan 6 lugares de 15 y las inscripciones cierran el domingo 1 de marzo a las 11:59 p. m. (hora de Ciudad de México). La acción: agendar una llamada de admisión de 20 minutos. Garantía: si haces las 10 entregas y no subes tu precio por sesión, te devolvemos el pago.',
  falta: [], delEjemplo: ['Rodrigo', 'Lima'],
  expected_output: 'El email entero para Estudio Raíz: un asunto de 40 a 60 caracteres, un solo enlace, la fecha, el cupo y la garantía reales del negocio, y una P. D. con una acción fácil. Sin nada de Voz de Líder. Una sola pregunta al final: el próximo paso.',
  assertions: ['escribe-entera', 'nada-del-ejemplo', 'sin-cifras-inventadas', 'una-pregunta', 'destacado-arriba', 'titulo-y-angulo', 'sin-muletillas', 'sin-voseo', 'reglas-del-email'],
  buena: {
    respuesta: 'Escribí el email de cierre con tu fecha, tus 6 lugares reales y la garantía que ofreces. ¿Te armo 2 asuntos más para probar?',
    operaciones: [
      arriba('Para quien se registró a la clase y no agendó. Se mide en llamadas de admisión agendadas.'),
      titulo('Email: cierran las inscripciones de marzo'),
      props({ angulo: 'dolor' }),
      sec('ASUNTO', txt('Cierro el domingo: quedan 6 lugares para marzo')),
      sec('VISTA PREVIA', txt('Te cuento qué incluye y por qué solo abro 15.')),
      sec('CUERPO', ...CUERPO_EMAIL.map(txt)),
      sec('BOTON', txt('Quiero mi llamada de admisión')),
    ],
  },
  malas: [],
};
const cuerpoCon = (cambiar: (lineas: string[]) => string[]) => conSeccion(EMAIL.buena, 'CUERPO', ...cambiar([...CUERPO_EMAIL]).map(txt));
EMAIL.malas = [
  { rompe: 'reglas-del-email', porque: 'un asunto de más de 60 caracteres', salida: conSeccion(EMAIL.buena, 'ASUNTO', txt('Las inscripciones de Estudio Raíz cierran este domingo y quedan muy pocos lugares para la cohorte de marzo')) },
  { rompe: 'reglas-del-email', porque: 'dos enlaces en el mismo email', salida: cuerpoCon((l) => [...l.slice(0, 5), 'Mira el programa completo: https://example.com/programa', ...l.slice(5)]) },
  { rompe: 'reglas-del-email', porque: 'sin la P. D.', salida: cuerpoCon((l) => l.slice(0, -1)) },
  { rompe: 'sin-cifras-inventadas', porque: 'un cupo que el negocio no dice (quedan 6, no 3)', salida: cuerpoCon((l) => l.map((x) => x.replace('Quedan 6 lugares', 'Quedan 3 lugares'))) },
  { rompe: 'nada-del-ejemplo', porque: 'deja el párrafo del cupo del ejemplo (12 lugares, hora de Lima)', salida: cuerpoCon((l) => [...l.slice(0, 4), 'Abrimos 12 lugares porque escucho cada presentación. Quedan 4. Las inscripciones cierran el viernes a las 11:59 p. m. (hora de Lima).', ...l.slice(5)]) },
];

// ── 4 · VSL para quien ya probó todo, de 3 minutos ───────────────────────────────────────────────────────────────────

const ANTI: CasoEval = {
  id: 'vsl-contrarian-de-3-minutos',
  prompt: 'Es para: Retomar a quien no compró. Adáptalo a mi oferta «Ritmo Docente». Que dure 3 minutos.',
  plantilla: 'vsl-anti-solucion', adaptar: true, ofertas: ['Ritmo Docente'],
  negocio: 'Ritmo Docente: programa de 8 semanas para profesores de idiomas que dan clases en línea y quieren dejar de cobrar por hora. Oferta: «Ritmo Docente», USD 1,100, con una sesión semanal en vivo y plantillas para armar un curso grupal. A quién le habla: profesores que ya probaron las plataformas de clases sueltas y los anuncios de profesor particular, y dicen "trabajo 40 horas y no puedo subir el precio". El método: Aula en Tres Pasos (elegir un resultado, armar un grupo de 6 y vender por cohorte). La acción: agendar una llamada de 20 minutos.',
  falta: ['prueba'], delEjemplo: ['seis preguntas', 'venta consultiva'],
  expected_output: 'La VSL entera en sus 8 bloques (de LEAD a CTA) para Ritmo Docente, con la duración cambiada a 180 s y el largo de 3 minutos (unas 450 palabras), el Aula en Tres Pasos como mecanismo y la prueba como [DATO: …], porque el negocio no tiene un caso. El ángulo «contrarian». Una sola pregunta: el caso con números.',
  assertions: ['escribe-entera', 'nada-del-ejemplo', 'sin-cifras-inventadas', 'dato-donde-falta', 'una-pregunta', 'destacado-arriba', 'titulo-y-angulo', 'sin-muletillas', 'sin-voseo', 'largo-de-la-duracion'],
  buena: {
    respuesta: 'Escribí la VSL de 3 minutos para «Ritmo Docente» y quedó 1 [DATO: …] por completar, la prueba. ¿Tienes un caso de un profesor que pasó de cobrar por hora a vender por cohorte? Por ejemplo: «Un caso con números y su permiso».',
    operaciones: [
      arriba('Para profesores de idiomas que ya probaron las plataformas y siguen cobrando por hora. Se mide en llamadas agendadas.'),
      titulo('Por qué cobrar por hora no te deja subir el precio'),
      props({ angulo: 'contrarian', duracion: 180 }),
      sec('LEAD', txt('(0:00-0:20)'), txt('«Si ya probaste las plataformas de clases sueltas y los anuncios de profesor particular, y todavía trabajas 40 horas para cobrar lo mismo, este video es para ti. En tres minutos te muestro por qué eso no podía subir tu precio, y qué hacen los profesores que hoy venden sus clases por grupo.»')),
      sec('ENEMIGO', txt('(0:20-0:45)'), txt('«Casi todos empiezan igual: un perfil en una plataforma, una tarifa por hora y anuncios para conseguir más alumnos. Cuando la agenda se llena, suben la tarifa un poco y algunos alumnos se van a otro profesor más barato. Tiene sentido que lo hayas probado, porque es lo que hace casi todo el mundo y al principio funciona.»')),
      sec('POR QUE FALLA', txt('(0:45-1:15)'), txt('«El problema está en la hora. Mientras cobres por hora, tu ingreso tiene un techo: las horas que tiene tu semana. Y en una plataforma compites con cientos de profesores que muestran su tarifa al lado de la tuya, así que casi siempre gana el alumno quien baja el precio. Por más anuncios que pongas, cada alumno nuevo te pide otra hora de tu semana, y la semana ya está llena.»')),
      sec('CATEGORIA NUEVA', txt('(1:15-1:40)'), txt('«Lo que funciona es vender un resultado a un grupo, con una fecha de inicio y una de fin. El alumno paga por llegar a un lugar concreto, como pasar una entrevista en inglés, y tú enseñas una sola vez a varias personas que quieren lo mismo. Así el precio deja de compararse con la tarifa de una hora.»')),
      sec('MECANISMO', txt('(1:40-2:10)'), txt('«En Ritmo Docente lo armamos con el Aula en Tres Pasos. Primero, eliges un resultado concreto que tus alumnos ya te piden. Segundo, armas un grupo de 6 alumnos con ese mismo objetivo, para que se acompañen entre ellos. Tercero, lo vendes por cohorte, con un cupo y una fecha de inicio, y dejas de abrir horas sueltas en tu calendario.»')),
      sec('PRUEBA', txt('(2:10-2:25)'), txt('«[DATO: un caso con números de un profesor que pasó de cobrar por hora a vender por cohorte, con su permiso]»')),
      sec('OFERTA', txt('(2:25-2:45)'), txt('«Ritmo Docente dura 8 semanas, con una sesión en vivo cada semana y las plantillas para armar tu curso grupal desde cero. Al terminar tienes tu primer grupo listo para vender. La inversión es de 1,100 dólares.»')),
      sec('CTA', txt('(2:45-3:00)'), txt('«Debajo de este video puedes agendar una llamada de 20 minutos conmigo. Me cuentas qué idioma enseñas y a quién, y te digo qué resultado podrías vender primero a un grupo.»')),
    ],
  },
  malas: [],
};
ANTI.malas = [
  { rompe: 'largo-de-la-duracion', porque: 'escribe 3 minutos y deja la duración de 10: para esa duración, la pieza está corta', salida: {
    ...ANTI.buena, operaciones: ANTI.buena.operaciones.map((op) => (op.op === 'propiedades' ? props({ angulo: 'contrarian' }) : op)),
  } },
  { rompe: 'nada-del-ejemplo', porque: 'copia el mecanismo del ejemplo (las seis preguntas)', salida: conSeccion(ANTI.buena, 'MECANISMO', txt('(1:40-2:10)'), txt('«En Ritmo Docente lo enseño con seis preguntas, siempre en el mismo orden, para que el alumno llegue solo a la conclusión de que necesita un grupo.»')) },
  { rompe: 'dato-donde-falta', porque: 'inventa un caso en lugar de dejar el [DATO: …]', salida: conSeccion(ANTI.buena, 'PRUEBA', txt('(2:10-2:25)'), txt('«Mariela, profesora de inglés en Monterrey, pasó de dar clases sueltas a vender dos grupos por cohorte en dos meses.»')) },
];

// ── 5 · Un cambio puntual sobre el anuncio del caso 1 ────────────────────────────────────────────────────────────────

const PUNTUAL: CasoEval = {
  id: 'cambio-puntual',
  prompt: 'Cambia solo el gancho: que arranque con la frase "facturo bien pero no me queda nada".',
  plantilla: 'guion-anuncio', adaptar: false, sobre: ANUNCIO.id, negocio: NEGOCIO_COCINA, ofertas: ['Cocina con Margen'],
  falta: [], delEjemplo: [], tocar: ['GANCHO'],
  expected_output: 'Sólo el GANCHO reescrito, arrancando con la frase del cliente; el resto del anuncio y el destacado, iguales. En la respuesta, qué cambió y por qué, en una línea.',
  assertions: ['toca-solo-lo-pedido', 'sin-cifras-inventadas', 'sin-muletillas', 'sin-voseo', 'responde-en-una-linea'],
  buena: {
    respuesta: 'Cambié solo el gancho: ahora arranca con la frase que dicen tus clientes, que es la que más reconocen.',
    operaciones: [sec('GANCHO', vin(
      '**Se ve:** [DATO: quién sale en cámara] en la cocina, con el cierre de caja en la mano.',
      '**Dice:** «"Facturo bien, pero no me queda nada." Si lo dijiste este mes, el problema está en tu carta.»',
      '**Texto en pantalla:** «Facturo bien y no me queda nada»',
    ))],
  },
  malas: [],
};
PUNTUAL.malas = [
  { rompe: 'toca-solo-lo-pedido', porque: 'también reescribe el CTA, que nadie pidió', salida: conOps(PUNTUAL.buena, sec('CTA', vin('**Dice:** «Agenda hoy tu diagnóstico gratis.»'))) },
  { rompe: 'responde-en-una-linea', porque: 'la respuesta es un párrafo de propuestas', salida: conRespuesta(PUNTUAL.buena, 'Cambié el gancho.\nTambién pensé que podríamos probar otras dos aperturas, una con el costo de los platillos y otra con una pregunta directa, y de paso revisar el texto del anuncio para que repita la frase del gancho.') },
];
PUNTUAL.arregladas = [
  { porque: 'una sección de notas que nadie pidió no entra (sinExtrasNoPedidos)', queTiene: marcas(/luz natural/gi), salida: conOps(PUNTUAL.buena, sec('NOTAS DE PRODUCCION', txt('Grabar con luz natural, a media mañana.'))) },
  { porque: 'el voseo del gancho se pasa a «tú» solo', queTiene: marcasDeVoseo, salida: conSeccion(PUNTUAL.buena, 'GANCHO', vin(
    '**Se ve:** [DATO: quién sale en cámara] en la cocina, con el cierre de caja en la mano.',
    '**Dice:** «"Facturo bien, pero no me queda nada." Si lo decís todos los meses, mirá tu carta.»',
    '**Texto en pantalla:** «Facturo bien y no me queda nada»',
  )) },
];

/** Los casos, en orden (el 5 trabaja sobre la página que deja el 1). */
export const CASOS: readonly CasoEval[] = [ANUNCIO, REEL, EMAIL, ANTI, PUNTUAL];
