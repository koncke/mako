// =============================================================================
// video-planner — el motor del Video Generator: de un tema a un plan de clips
// =============================================================================
// Produce el PLAN de un anuncio con avatar: cuántos clips, qué dice cada uno,
// qué se ve, cómo se mueve la cámara y el prompt listo para pegar en el modelo
// de video. NO genera video: eso es el paso siguiente (lib/flow.ts).
//
// El plan es la parte cara de hacer bien y la barata de producir: iterar el
// texto no cuesta créditos, re-animar sí. Por eso la tab entrega el plan
// aprobado ANTES de tocar un solo crédito.
//
// Dos ejes entran acá y no se mezclan (ver lib/puestas-data.ts):
//   - la PUESTA EN ESCENA aporta las restricciones físicas (ritmo, densidad,
//     cámara, si hace falta generar imágenes antes);
//   - el ÁNGULO aporta qué se cuenta.
//
// ⚠️ TRAMPA QUE EL COMPILADOR NO VE: el tag de `feature` tiene que existir
// IDÉNTICO en lib/model-catalogo.ts. Si no coincide, la llamada queda VETADA
// (no hay modelo por default) — no cae a otro modelo, falla.
// =============================================================================

import 'server-only';
import { chatClaude } from './anthropic';
import { chatCheapCascade } from './ai-cheap';
import { getFunnel } from './leads';
import { perfilNegocioTexto } from './onboarding';
import { getPersona } from './persona';
import { getWorkspaceActual } from './workspace';
import { brandSystem, parseJsonObject } from './campaign-structurer';
import { renderTemplate, contenidoNoConfiable } from './prompt-render-pure';
import { tienePromptVideoPropio } from './prompts-video';
import {
  puestaPorId, ritmoDeClips, palabrasQueEntran, contarPalabras, repartirDuracion,
  marcasDeVoseo, conAcento, soloHablado, type Puesta,
} from './puestas-data';
import { repartirGuion, contarPalabrasReparto } from './guion-reparto';
import { cierreDeGuion, tomasDelCierre, ctaInventado } from './guion-cierre';

// Se re-exportan porque son parte del contrato del motor, pero VIVEN en
// puestas-data: sin `server-only` ahí, los tests las pueden importar.
export { contarPalabras, repartirDuracion, marcasDeVoseo };

/** El tag de gasto. Tiene que existir igual en lib/model-catalogo.ts. */
export const FEATURE_VIDEO_PLANNER = 'video-planner';

// ── Lo que devuelve el motor ─────────────────────────────────────────────────

export type ClipPlan = {
  /** 1-indexado: es el número que el usuario ve y nombra («regenerá el 3»). */
  n: number;
  segundos: number;
  /** true = habla en cámara; false = está en cuadro pero la voz va en off. */
  habla: boolean;
  /** Lo que se dice en este clip. Con `habla:false` es la voz en off. */
  voz: string;
  /** La acción física: qué hace la persona. Va SIEMPRE, o el modelo rellena. */
  queSeVe: string;
  /** La indicación de cámara, en la voz del método. */
  camara: string;
  /** El prompt completo, listo para pegar. Español para el guion, inglés para la escena. */
  prompt: string;
  /** Palabras contadas en `voz`. Medido acá, no declarado por el modelo. */
  palabras: number;
  /** Cuántas entran en este clip según la densidad de la puesta. */
  tope: number;
  /** true = es el CIERRE del guion y va palabra por palabra como lo escribió el cliente. */
  literal?: boolean;
  /** Palabras de llamado a la acción que MaKo metió y el guion no tenía. */
  ctaInventado?: string[];
  /** Lo que decía el guion, cuando el modelo lo dijo de otra forma. */
  original?: string;
  /** Marcas de voseo encontradas en `voz`. Vacío = limpio. */
  voseo: string[];
};

export type PlanVideo = {
  puestaId: string;
  anguloId?: string;
  titulo: string;
  duracionTotalSeg: number;
  /** El patrón de alternancia realmente usado, ya expandido a la cantidad de clips. */
  ritmo: string;
  clips: ClipPlan[];
  /** El guion entero seguido, para leerlo de corrido y detectar que no cierra. */
  deCorrido: string;
  /**
   * ⚠️ Acá vivía `imagenesNecesarias`: una lista en prosa que escribía el modelo.
   *
   * La reemplazan las ESCENAS (`lib/escenas.ts`), y la diferencia no es de
   * formato. Aquella lista contestaba «¿cuántas imágenes?» con una opinión;
   * ahora esa pregunta la contesta `Puesta.escenarios`, que es un dato del
   * catálogo, y cada escena sabe además qué tomas cubre y trae su prompt en
   * inglés. Un plan no puede tener dos respuestas distintas a la misma pregunta.
   */
  /**
   * `true` si el acento del cliente ES rioplatense.
   *
   * Lo decide el SERVER al generar y viaja CON el plan, porque la pantalla que lo
   * muestra ya no pregunta el acento — es un atributo del cliente, no del
   * anuncio. Sin esto, las marcas de voseo se pintarían como una filtración de la
   * voz de MaKo en un guion donde «tenés» es, simplemente, el idioma del cliente.
   *
   * Opcional: los planes guardados antes de este cambio no lo tienen, y ausente
   * se lee como «no sé», que es la verdad.
   */
  acentoEsVoseante?: boolean;
};

export type GenerarPlanOut =
  | { ok: true; plan: PlanVideo }
  | { ok: false; error: string };

// ── El prompt ────────────────────────────────────────────────────────────────

/**
 * Cómo se escribe el prompt de video — y por qué NO siempre se pide.
 *
 * ⚠️ ESTE BLOQUE SOLO VIAJA SI EL FORMATO NO TIENE PROMPT PROPIO.
 *
 * Un formato con prompt validado —hoy `selfie-movimiento`, el de Martín— lo
 * arma `promptDeClip` (lib/prompts-video.ts) y le GANA al que escriba el modelo,
 * entero. O sea que en ese caso todo esto era instrucción para producir un campo
 * que se descarta: el más largo del JSON, un párrafo cinematográfico en inglés
 * por clip, y `selfie-movimiento` declara `habla: 'siempre'`, así que se
 * descartaban los siete. Trabajo de generación pagado en la espera del cliente.
 *
 * El dueño: «cuando acomoda el guion en las tomas, se demora increíblemente
 * mucho para una tarea simple». Y tiene razón sobre lo simple: el reparto del
 * guion en tomas ya lo hace el CÓDIGO (`repartirGuion`), así que en un anuncio
 * con guion propio lo único que de verdad le queda al modelo es decirlo como se
 * habla.
 *
 * Lo que sí sobrevive es el ACENTO, y no porque lo escriba el modelo: lo pega
 * `conAcento()` con el texto que eligió el cliente. Pedírselo al modelo era
 * hacerle dar la vuelta a un dato que ya teníamos — justo lo que la regla de la
 * casa prohíbe («un dato exacto que pasa por las manos de un LLM deja de ser
 * exacto»).
 */
const BLOQUE_PROMPT_VIDEO = `
## CÓMO SE ESCRIBE EL PROMPT DE VIDEO

Tres bloques, en este orden y siempre en inglés salvo el guion:

1. **Cámara.** Qué hace el teléfono que filma. Con precisión: "retrocede frente a él" y "visto desde el asiento del acompañante" son tomas opuestas, y si no lo dices el modelo elige la que no es. Cuando la puesta pide cámara estática, se dice explícitamente que no se mueve.
2. **Acción.** Qué hace la persona, físicamente. Va siempre, incluso si es "está quieto": si no se escribe, el modelo rellena.
3. **Guion.** El texto entre comillas, tal cual.

**NO escribas el acento ni el idioma en el prompt.** Lo agrega el sistema al final, con las palabras exactas que eligió el cliente. Si lo escribes tú, se borra.

**NUNCA describas la cara, el pelo, la edad ni el cuerpo de la persona.** Ni una palabra. La identidad la resuelve la foto de referencia que se adjunta, y cualquier descripción compite con ella: el modelo prefiere el texto y devuelve a alguien que cumple la descripción sin ser la persona. Esta es la regla que más caro se paga romper.

**Tampoco describas el tratamiento fotográfico** (contraste, flash, grano). Eso ya viene resuelto.

Cuando la persona no habla en un clip, el prompt dice explícitamente que no dice nada.
`;

const SYSTEM_TEMPLATE = `Eres MaKo, planificando un anuncio en video con avatar de IA para un negocio real.

Tu salida es el PLAN DE CLIPS: qué dice cada clip, qué se ve y cómo se mueve la cámara{{salidaPrompt}}. No escribes prosa ni explicaciones.

## LA PUESTA EN ESCENA ELEGIDA: {{puestaNombre}}

{{puestaDescripcion}}

Reglas de esta puesta. No son estilo: romperlas rompe el formato.
{{puestaReglas}}

## LA ESTRUCTURA EXACTA QUE TIENES QUE LLENAR

{{estructura}}

## EL IDIOMA DEL GUION — ANTES QUE CUALQUIER OTRA COSA

El guion lo va a decir una persona real frente a una cámara, a SU audiencia. No es un texto tuyo.

**Acento y variedad del español: {{acento}}.** Escribe el guion en esa variedad. En el prompt de video NO lo escribas: lo pone el sistema.

⚠️ **Tu voz rioplatense NO entra aquí. Jamás.** Nada de «vos», «tenés», «querés», «podés», «mirá», «dale», «acá», «che». Si la variedad pedida es mexicana o neutra, va «tú / tienes / quieres / puedes / mira / aquí». Un anuncio con el voseo de MaKo adentro suena a que lo escribió otra persona, porque lo escribió otra persona.

Esto ya costó seis versiones de guion en este proyecto: el acento equivocado no se nota al leer y se nota apenas alguien lo dice en voz alta.

{{guionLiteral}}## CÓMO SE ESCRIBE EL TEXTO HABLADO

**La densidad manda.** Cada clip admite un número exacto de palabras y está indicado arriba, clip por clip. Menos palabras y el modelo alarga sílabas o repite; más y la frase se corta a la mitad. Cuenta las palabras de cada línea antes de darla por buena.

**Se escribe como habla la persona, no como escribe.** Frases que empiezan por un conector —"a ver", "mira", "pues", "entonces", "la verdad"— porque ahí es donde la voz sube. Un texto de frases que arrancan por el sujeto suena plano por construcción, por más que la voz sea buena.

**Un solo énfasis por clip, no cuatro.** El énfasis es contraste: si todas las palabras suben, ninguna destaca. Marca en **negrita** la frase que lleva el peso, y solo esa.

**El último clip cierra con la acción.** Directo, en imperativo, señalando.
{{promptDeVideo}}
## LO QUE SE VE NO ILUSTRA LO QUE SE DICE

El fondo es contexto, no subtítulo. Si la frase habla de una junta, no hace falta que se vea una junta. La imagen sostiene la atención; el texto lleva el argumento.

Responde SOLO con el objeto JSON, sin texto alrededor y sin cercas de código.`;


/**
 * El apartado que se le agrega al system cuando el cliente trajo SU guion.
 *
 * Existe aunque la voz se pise después: sin él, el modelo escribe la cámara y la
 * acción para un texto que cree que él eligió, y el prompt de video termina
 * describiendo otra escena que la que se va a decir.
 */
const BLOQUE_GUION_LITERAL = `## EL GUION YA ESTÁ ESCRITO — TU TRABAJO ES DECIRLO COMO ÉL

El cliente eligió un guion suyo y ya está repartido en tomas. Cada clip trae la
IDEA que le toca decir.

**Eso está escrito, no dicho.** Tu trabajo es volver a decirlo como lo diría él
frente a la cámara. Eso NO es ponerle un "mira" adelante y dejar la frase igual:
es reescribir la frase con sus palabras.

Tienes permiso —y se espera que lo uses— para:
- **cambiar las palabras por las suyas**: "un problema" puede ser "una bronca",
  "un detalle" puede ser "un detallito", "necesito alguien" puede ser "ocupas
  alguien";
- **condensar**: si la idea se dice más corta y más fuerte, se dice más corta;
- **cortar y unir frases** para que el ritmo hablado funcione;
- **arrancar con conector**: "a ver", "mira", "pues", "entonces", "la verdad";
- **traer media frase de la toma de al lado** si el corte queda mejor ahí — sin
  perder nada y sin cambiar el orden.

Así se ve bien hecho:
  escrito : "Y el viernes estás tú hablando con el cliente para explicar por qué no llegaron."
  dicho   : "Y el viernes tú tienes que darle la cara al cliente."

  escrito : "Entonces piensas: 'Necesito alguien más duro que los haga cumplir.'"
  dicho   : "Entonces piensas que ocupas un gerente más duro."

  escrito : "Era una forma de saber desde el lunes quién podía incumplir el viernes."
  dicho   : "Faltaba un sistema para saber desde el lunes quién iba a fallar."

**Los DOS límites, y son los únicos:**

1. **Los HECHOS no cambian.** Ni un número, ni un plazo, ni quién le hace qué a
   quién, ni el orden en que se cuenta. Cambias cómo suena y con qué palabras, no
   qué pasó.

2. **El CIERRE va LITERAL.** Las tomas marcadas \`CIERRE — LITERAL\` se copian
   palabra por palabra: ni una distinta, ni una de más. Y en ninguna otra toma
   puedes inventar un mecanismo que el guion no nombra —un formulario, un
   WhatsApp, un registro, una llamada—: si el guion manda a un video en un enlace,
   el anuncio manda a un video en un enlace.

Por qué el cierre es distinto: ahí está a dónde va la gente. Ya falló una vez —un
guion que cerraba con "en el video del enlace te explico cómo construir ese
sistema" volvió como "toca el botón aquí abajo, deja tus datos en el formulario".
Eso manda a la gente a un paso del embudo que puede no existir, y no se nota
leyendo: se nota cuando nadie llega.

`;

const BLOQUE_SIN_ADAPTAR = `## EL GUION VA TAL CUAL — NO SE TOCA

El cliente pidió expresamente que su guion NO se adapte. Cada clip trae su línea
de VOZ y se copia **palabra por palabra**: ni una distinta, ni una de más, ni un
conector agregado.

Tu trabajo acá es el OTRO: para cada toma, con esa voz ya dada, escribir qué se
ve y qué hace la cámara.

⚠️ NO devuelvas el campo "voz". El texto ya está decidido y lo pone el sistema:
copiarlo sería devolvernos algo que ya tenemos.

La sección de abajo sobre cómo se escribe el texto hablado **no aplica**: describe
cómo se escribiría un guion desde cero, y acá no hay que escribir ninguno.

`;

const USER_TEMPLATE = `## EL PEDIDO

{{pedido}}

## EL NEGOCIO

{{contexto}}

Escribe el plan completo respetando la cantidad de clips, la duración de cada uno y el tope de palabras que se indica clip por clip.`;

/**
 * La forma del JSON. Sin el `prompt` cuando el formato ya trae el suyo validado
 * — ver `BLOQUE_PROMPT_VIDEO` para el porqué: es el campo más largo de la salida
 * y en ese caso se descarta entero.
 */
const jsonShape = (conPrompt: boolean, conVoz: boolean): string => `{
  "titulo": "el título del anuncio, corto",
  "clips": [
    {
      "n": 1,${conVoz ? '\n      "voz": "lo que se dice en este clip",' : ''}
      "queSeVe": "la acción física de la persona",
      "camara": "qué hace la cámara"${conPrompt ? ',\n      "prompt": "el prompt completo listo para pegar"' : ''}
    }
  ]
}`;

/**
 * El esqueleto que el modelo tiene que llenar: un renglón por clip con su
 * duración, si habla o va en off, y CUÁNTAS PALABRAS entran.
 *
 * Va calculado desde acá y no se le delega al modelo, por dos razones: el ritmo
 * es una propiedad de la puesta (no una decisión creativa) y el conteo de
 * palabras es aritmética, que es justo lo que un modelo de lenguaje hace peor.
 */
function estructuraDeClips(
  puesta: Puesta,
  cantidad: number,
  segundos: number[],
  /** El texto de cada clip cuando ya está decidido. */
  reparto: { voz: string }[] | null,
  /** Índices de las tomas del CIERRE: esas van literales. */
  literales: Set<number>,
): string {
  const habla = ritmoDeClips(puesta, cantidad);
  const filas = habla.map((h, i) => {
    const seg = segundos[i];
    const tope = palabrasQueEntran(puesta, seg);
    const modo = h ? 'HABLA en cámara' : 'NO habla: está en cuadro, la voz va en OFF';
    const base = `- Clip ${i + 1}: ${seg} s · ${modo} · máximo ${tope} palabras`;
    if (!reparto) return base;
    // Dos clases de toma, y la diferencia está escrita en la línea que ve el
    // modelo. Sin este rótulo el cierre es una línea más y se adapta como el
    // resto — que es exactamente lo que había que impedir.
    const texto = reparto[i]?.voz ?? '';
    return literales.has(i)
      ? `${base}\n  CIERRE — LITERAL, cópiala tal cual: "${texto}"`
      : `${base}\n  IDEA A DECIR: "${texto}"\n    (dila con SUS palabras, no la copies)`;
  });
  return [
    `Son ${cantidad} clips, en este orden y con estas restricciones:`,
    '',
    ...filas,
    '',
    `Ritmo: ${habla.map((h) => (h ? 'H' : 'O')).join(' ')} (H = habla en cámara, O = voz en off).`,
    // Las imágenes NO se piden acá. Se generan después, en su propio paso, con la
    // cantidad que fija el formato — este prompt solo escribe el guion y las
    // tomas. Pedírselas también acá era darle al modelo una segunda oportunidad
    // de contestar distinto la misma pregunta.
  ].join('\n');
}

/** El contexto del negocio, sin la ficha física de la persona. Ver abajo por qué. */
async function briefDelNegocio(): Promise<string> {
  const [funnelTxt, perfilTxt] = await Promise.all([
    (async () => {
      try {
        const f = await getFunnel();
        const entrada = f.pipeline.find((s) => s.kind === 'entrada');
        return `Entrada del funnel: ${entrada ? entrada.label : '—'}. El cierre del anuncio tiene que empujar hacia ahí.`;
      } catch { return '—'; }
    })(),
    perfilNegocioTexto().catch(() => '—'),
  ]);
  return [
    `## FUNNEL\n${funnelTxt}`,
    `## PERFIL DEL NEGOCIO\n${contenidoNoConfiable(perfilTxt, 'perfil_negocio')}`,
  ].join('\n\n');
}

// ── Saneo ────────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function sanearPlan(
  raw: Record<string, unknown>,
  puesta: Puesta,
  segundos: number[],
  acento: string,
  /** El reparto del guion del cliente. Presente = hay un guion que respetar. */
  reparto: { voz: string }[] | null,
  /** Las tomas del cierre: ahí manda el reparto y no el modelo. */
  literales: Set<number>,
  /** El guion del cliente, entero. Es contra esto que se mide un CTA inventado. */
  guionCompleto: string,
): PlanVideo {
  const habla = ritmoDeClips(puesta, segundos.length);
  const crudos = Array.isArray(raw.clips) ? raw.clips : [];
  if (crudos.length === 0) throw new Error('el plan volvió sin clips');

  // El ritmo y la duración los decide la puesta, NO el modelo: si devolvió otra
  // cantidad de clips, se recorta o se corta con error honesto en vez de dejar
  // un plan que dice una cosa y produce otra.
  if (crudos.length !== segundos.length) {
    throw new Error(`se pidieron ${segundos.length} clips y volvieron ${crudos.length}`);
  }

  // La densidad es LA regla de este formato, y pedírsela al modelo en el prompt
  // no la hace cumplir: acá se MIDE. No se recorta el texto —cortar una frase a
  // la mitad es peor que un clip largo— se marca, y la pantalla lo muestra al
  // lado del clip para que se pida rehacer ese y no todo el plan.
  const clips: ClipPlan[] = crudos.map((c, i) => {
    const o = (c ?? {}) as Record<string, unknown>;
    // ── La voz: adaptada, salvo en el cierre ────────────────────────────────
    // El modelo adapta la forma —los conectores con los que arranca la persona,
    // las palabras de su variedad— y eso es una feature: un guion dicho como se
    // escribe suena leído.
    //
    // ⚠️ Salvo en el CIERRE, que se PISA con el literal. Un prompt que pide no
    // tocar el CTA funciona casi siempre, y «casi siempre» sobre un CTA es un
    // modo de falla silencioso: el texto sale bien escrito, suena natural, y solo
    // se nota comparando contra el original — o cuando nadie llega al embudo.
    const original = reparto?.[i]?.voz ?? '';
    const delModelo = str(o.voz);
    const esCierre = literales.has(i);
    const voz = reparto
      ? (esCierre ? original : (delModelo || original))
      : delModelo;

    // ── La guarda, y por qué NO mide parecido ────────────────────────────────
    // Medir «cuánto se parece al original» castiga justo lo que se quiere: decir
    // la misma idea con otras palabras —«tienes que darle la cara al cliente» por
    // «estás hablando con el cliente para explicar por qué no llegaron»— pierde
    // casi todos los sustantivos y ES la adaptación buscada. El dueño lo dijo
    // mirando las dos versiones: «me gusta mucho más la naturalidad que hizo el
    // anterior, ahora como que se limitó bastante».
    //
    // Lo que de verdad no puede pasar es puntual: que aparezca un mecanismo que
    // el negocio no tiene. Eso sí se detecta sin falsos positivos.
    const inventado = reparto && !esCierre && delModelo
      ? ctaInventado(guionCompleto, delModelo)
      : [];

    return {
      n: i + 1,
      segundos: segundos[i],
      habla: habla[i],
      voz,
      queSeVe: str(o.queSeVe),
      camara: str(o.camara),
      // ⚠️ CON UN FORMATO DE PROMPT PROPIO, ACÁ QUEDA SOLO EL ACENTO — y alcanza.
      //
      // `promptDeClip` lee de este campo UNA cosa: el `Spoken in …` final, con
      // `acentoDe()`. Y ese renglón nunca lo escribió el modelo: lo pega
      // `conAcento` con el texto que eligió el cliente. Pedirle el párrafo entero
      // era generar siete prompts cinematográficos para tirar siete.
      prompt: conAcento(tienePromptVideoPropio(puesta.id) ? '' : str(o.prompt), acento),
      palabras: contarPalabras(voz),
      tope: palabrasQueEntran(puesta, segundos[i]),
      voseo: marcasDeVoseo(voz),
      literal: esCierre && !!reparto,
      // No se descarta: se MUESTRA. La pantalla lo dice al lado de la toma con lo
      // que decía el guion, que es la diferencia entre un cambio y un cambio
      // silencioso. Descartarlo automáticamente devolvería el texto plano y
      // perdería la adaptación buena de esa misma toma.
      ctaInventado: inventado.length ? inventado : undefined,
      original: reparto && !esCierre && delModelo && delModelo !== original ? original : undefined,
    };
  });

  return {
    puestaId: puesta.id,
    titulo: str(raw.titulo) || 'Anuncio sin título',
    duracionTotalSeg: segundos.reduce((a, b) => a + b, 0),
    ritmo: habla.map((h) => (h ? 'H' : 'O')).join(' '),
    clips,
    deCorrido: clips.map((c) => c.voz).filter(Boolean).join(' '),
  };
}

// ── El motor ─────────────────────────────────────────────────────────────────

export type PedidoPlan = {
  puestaId: string;
  anguloId?: string;
  /** El texto de la variedad del español, listo para el prompt de video. */
  acentoPrompt: string;
  /** El tema, la historia o el guion que el usuario ya tiene. */
  tema: string;
  /**
   * `false` = el guion va TAL CUAL, sin adaptar.
   *
   * Por defecto MaKo lo dice con las palabras de la persona —le pone sus
   * conectores, cambia «un problema» por «una bronca»— y eso suele ser lo que se
   * quiere: un guion escrito como se escribe suena leído.
   *
   * Pero no siempre. Un guion que ya se corrigió palabra por palabra, o uno que
   * cita algo textual, no se toca. La diferencia la decide el dueño, no nosotros:
   * es SU texto.
   */
  adaptarVoz?: boolean;
  /**
   * El guion del cliente, PALABRA POR PALABRA, cuando eligió uno suyo.
   *
   * Presente = el texto hablado ya está decidido y el modelo no lo escribe: se
   * reparte acá (lib/guion-reparto.ts) y él solo pone cámara, acción y prompt.
   * Ausente = el flujo viejo, donde `tema` es un tema y el modelo sí escribe.
   *
   * La diferencia no es de estilo. Cuando el modelo escribía sobre un guion ya
   * hecho, cambiaba el CTA — y un CTA cambiado manda a la gente a un paso del
   * embudo que puede no existir.
   */
  guionLiteral?: string;
  cantidadClips: number;
  duracionTotalSeg: number;
  /** Feedback sobre un plan anterior (regenerar). */
  feedback?: string;
};

/**
 * Genera el plan de clips.
 *
 * `ws` es el workspace que el caller CREE estar sirviendo y se verifica en
 * POSITIVO contra el del request: las fuentes del brief resuelven el workspace
 * por su cuenta, así que un `ws` distinto planificaría el anuncio de OTRO
 * cliente en silencio. Sin workspace se corta con error, nunca se cae al dueño.
 */
export async function generarPlan(ws: number, pedido: PedidoPlan): Promise<GenerarPlanOut> {
  const puesta = puestaPorId(pedido.puestaId);
  if (!puesta) return { ok: false, error: 'Esa puesta en escena no existe en el catálogo.' };

  const tema = (pedido.tema ?? '').trim().slice(0, 4000);
  if (!tema) return { ok: false, error: 'Escribe el tema o la historia del anuncio primero.' };

  const [minClips, maxClips] = puesta.clips;
  const cantidad = Math.min(maxClips, Math.max(minClips, Math.round(pedido.cantidadClips)));

  const wsActual = await getWorkspaceActual();
  if (wsActual == null) return { ok: false, error: 'No hay un workspace activo: entra al cliente antes de planificar.' };
  if (ws !== wsActual) return { ok: false, error: 'El workspace pedido no es el de esta sesión.' };

  // La foto real es el ancla de identidad y sin ella cada clip inventa una cara
  // distinta. Se verifica que EXISTA, pero la ficha física NO viaja al prompt:
  // describir la cara con palabras compite con la imagen de referencia y el
  // modelo prefiere el texto. Es el error que costó seis versiones del cuarto
  // anuncio, y está escrito en docs/hallazgos-generativa.md.
  const persona = await getPersona().catch(() => null);
  if (!persona || persona.fotos.length === 0) {
    return {
      ok: false,
      error: 'Este cliente no tiene ninguna foto cargada. Sube al menos una foto real en Onboarding → Persona: sin eso cada clip genera una cara distinta.',
    };
  }

  const segundos = repartirDuracion(puesta, cantidad, pedido.duracionTotalSeg);

  // ── El reparto del guion del cliente ──────────────────────────────────────
  // Se calcula ANTES de llamar al modelo y no se le delega. Los rótulos de
  // sección se sacan con `soloHablado` porque no se pronuncian: dejarlos haría
  // que «GANCHO» termine dicho a cámara.
  const hablado = pedido.guionLiteral ? soloHablado(pedido.guionLiteral).trim() : '';
  const reparto = hablado
    ? repartirGuion(hablado, segundos.map((sg) => palabrasQueEntran(puesta, sg)))
    : null;

  // Qué tomas caen dentro del CIERRE. Esas y solo esas van literales: es donde
  // vive a dónde manda el anuncio, y es lo único que no admite ni un matiz.
  // Sin adaptación, TODAS las tomas son literales: el guion entra como está.
  // Con adaptación, solo el cierre —que es donde vive a dónde manda el anuncio.
  const cierre = pedido.guionLiteral ? cierreDeGuion(pedido.guionLiteral) : '';
  const literales = !reparto
    ? new Set<number>()
    : pedido.adaptarVoz === false
      ? new Set<number>(reparto.map((_, i) => i))
      : tomasDelCierre(reparto, contarPalabrasReparto(cierre));

  // ¿Hay que pedirle el prompt de video al modelo? Solo si este formato no trae
  // uno propio validado — con `selfie-movimiento` se descartaba entero.
  const conPrompt = !tienePromptVideoPropio(puesta.id);

  // ⚠️ ¿HAY QUE PEDIRLE LA VOZ AL MODELO? Con un guion propio que el cliente
  // pidió NO adaptar, la respuesta es no — y pedírsela igual era la mitad del
  // «tarda muchísimo».
  //
  // `sanearPlan` hace `voz = esCierre ? original : (delModelo || original)`, y
  // con `adaptarVoz === false` TODAS las tomas son `literales`: o sea que la voz
  // que escribe el modelo se descarta entera, las siete. Le estábamos pidiendo
  // que nos devolviera 190 palabras que ya teníamos, y esa es la parte más larga
  // de la salida — más que `queSeVe` y `camara` juntos.
  //
  // Es el mismo hallazgo que el del `prompt`, un campo más allá: al agregar una
  // precedencia («el guion del cliente le gana al del modelo»), la pregunta que
  // sigue es si todavía hace falta PEDIR lo que perdió.
  const conVoz = !reparto || pedido.adaptarVoz !== false;

  try {
    const contexto = await briefDelNegocio();
    const system = await brandSystem(renderTemplate(SYSTEM_TEMPLATE, {
      puestaNombre: puesta.nombre,
      puestaDescripcion: puesta.descripcion,
      puestaReglas: puesta.reglas.map((r) => `- ${r}`).join('\n'),
      // ⚠️ Este slot EXISTÍA en el template y NO SE LLENABA NUNCA.
      //
      // `renderTemplate` deja los desconocidos literales (`k in vars ? vars[k] : m`),
      // así que al modelo le llegaba la cadena cruda «{{acento}}» y el guion se
      // escribía sin saber en qué variedad de español habla el cliente. No rompía
      // nada visible: el texto salía en un español plausible, y que la variedad no
      // fuera la pedida solo se nota al oírlo en voz alta.
      //
      // Es la trampa de un motor de plantillas permisivo: un slot mal escrito y
      // uno sin llenar se ven IGUAL desde afuera —el template renderiza en los dos
      // casos— y el único síntoma vive en la calidad de lo que sale.
      acento: pedido.acentoPrompt,
      guionLiteral: reparto ? (pedido.adaptarVoz === false ? BLOQUE_SIN_ADAPTAR : BLOQUE_GUION_LITERAL) : '',
      // Ver `BLOQUE_PROMPT_VIDEO`: con un formato que ya trae su prompt validado,
      // ni la instrucción ni el campo viajan. No es una poda de prosa —eso sería
      // cosmético—: es dejar de PEDIR el campo más largo de la salida, que en ese
      // caso se descartaba entero.
      promptDeVideo: conPrompt ? BLOQUE_PROMPT_VIDEO : '',
      salidaPrompt: conPrompt ? ', y el prompt listo para pegar en el modelo de video' : '',
      estructura: `${estructuraDeClips(puesta, cantidad, segundos, reparto, literales)}\n\nFORMA DEL JSON:\n${jsonShape(conPrompt, conVoz)}`,
    }));

    const feedback = pedido.feedback?.trim();
    const user = renderTemplate(USER_TEMPLATE, {
      pedido: [
        contenidoNoConfiable(tema, 'tema_usuario'),
        feedback
          ? `\n\nFEEDBACK sobre el plan anterior (aplícalo y escribe un plan NUEVO, no un parche): ${contenidoNoConfiable(feedback.slice(0, 900), 'feedback_usuario')}`
          : '',
      ].join(''),
      contexto,
    });

    const salida = await chatClaude(system, [{ role: 'user', content: user }], {
      thinking: true,
      effort: 'high',
      // ⚠️ EL TOPE TAMBIÉN ES TIEMPO, y no solo un techo por si acaso: el timeout
      // de la capa barata se calcula con él (`maxTokens * 12`, ver lib/anthropic.ts),
      // así que un tope inflado alarga la espera que se le concede a una llamada
      // que iba a contestar mucho antes.
      //
      // Sin el prompt de video son ~100 tokens menos por clip: doce tomas de
      // Car Talks son 1.200 tokens de párrafos en inglés que se descartaban. 12k
      // era el tope del plan CON prompts; sin ellos sobra con la mitad larga, y
      // el plan más grande que este formato admite (12 clips) entra holgado.
      // ⚠️ Y EL TOPE BAJA OTRA VEZ CUANDO TAMPOCO VA LA VOZ.
      //
      // No es un techo por si acaso: el timeout que la capa barata le concede a
      // la llamada se calcula con él (`maxTokens * 12`, lib/anthropic.ts), así
      // que un tope inflado alarga la espera que se le da a algo que iba a
      // contestar mucho antes.
      //
      // Con guion propio sin adaptar y un formato de prompt validado, al modelo
      // le queda el título, `queSeVe` y `camara` por clip. Doce tomas de eso son
      // ~1.200 tokens; 2.500 deja el doble de aire.
      maxTokens: conPrompt ? 12000 : (conVoz ? 5000 : 2500),
      feature: FEATURE_VIDEO_PLANNER,
      motivo: `Planificar anuncio en video (${puesta.nombre})`,
    });

    return { ok: true, plan: { ...sanearPlan(parseJsonObject(salida), puesta, segundos, pedido.acentoPrompt, reparto, literales, hablado), anguloId: pedido.anguloId } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `No se pudo armar el plan: ${msg}` };
  }
}

// ── Reescribir UNA toma ──────────────────────────────────────────────────────
// El pedido más chico que existe en esta tab, y el que más se usa: una frase no
// cierra y hay que cambiarla. Antes había que rehacer el plan entero, lo que
// cambiaba también las seis tomas que estaban bien.
//
// Va por la cascada barata y no por Claude: es un pedido de una frase con el
// contexto de siete, no necesita el modelo caro. Y por eso puede repetirse todas
// las veces que haga falta sin que corregir un anuncio salga como generarlo.

const SYSTEM_TOMA = `Eres MaKo. Reescribes UNA toma de un anuncio en video, con una
instrucción del dueño.

Te dan el anuncio entero para que sepas qué se dijo antes y qué viene después. La
toma que hay que cambiar está marcada con >>>.

Reglas:
- Devuelves SOLO el texto nuevo de esa toma. Sin comillas, sin explicación, sin el
  número de la toma.
- Es lo que una persona DICE a cámara: se escribe como se habla, no como se
  escribe. Puede arrancar con un conector ("a ver", "mira", "pues", "entonces",
  "la verdad").
- Respetas el tope de palabras que te dan. Menos palabras y el modelo de video
  alarga sílabas; más, y la frase se corta a la mitad.
- No repites lo que ya dice otra toma ni adelantas lo que viene después.
- **No inventas un mecanismo que el anuncio no nombra**: ni formularios, ni
  registros, ni WhatsApp, ni agendas. Si el anuncio manda a un video en un
  enlace, el anuncio manda a un video en un enlace.
- Haces lo que pide la instrucción del dueño. Si la instrucción pide algo que
  rompe una regla de arriba, la regla gana y haces lo más parecido que sí entra.`;

export async function reescribirToma(opts: {
  /** El anuncio entero, con la toma a cambiar marcada. */
  anuncio: string;
  actual: string;
  instruccion: string;
  tope: number;
  acentoEsVoseante: boolean;
}): Promise<string> {
  const user = [
    `EL ANUNCIO (la toma marcada con >>> es la que hay que cambiar):\n${opts.anuncio}`,
    '',
    `LO QUE DICE HOY: ${opts.actual}`,
    `TOPE: ${opts.tope} palabras.`,
    '',
    `LO QUE PIDE EL DUEÑO:\n${contenidoNoConfiable(opts.instruccion, 'instruccion_usuario')}`,
    '',
    'Devuelve solo el texto nuevo de esa toma.',
  ].join('\n');

  const salida = await chatCheapCascade({
    system: SYSTEM_TOMA,
    user,
    maxTokens: 400,
    temperature: 0.4,
    feature: 'video-toma',
    motivo: 'reescribir una toma del anuncio',
    // Se valida que ALGO vuelva y que no sea un párrafo: una toma de 8 segundos
    // no puede tener 80 palabras, y un modelo que devuelve el anuncio entero es
    // un modo de falla real.
    validar: (t: string) => {
      const limpio = t.trim();
      return limpio.length > 0 && contarPalabras(limpio) <= opts.tope * 2.5;
    },
  });

  // Se le sacan las comillas con las que a veces envuelve la respuesta, y las
  // marcas de voseo si el acento no lo admite — la misma limpieza que el plan.
  const limpio = salida.trim().replace(/^["«'`]+|["»'`]+$/g, '').trim();
  if (!limpio) return '';
  if (!opts.acentoEsVoseante && marcasDeVoseo(limpio).length > 0) {
    console.warn(`[video-toma] la toma volvió con voseo: ${marcasDeVoseo(limpio).join(', ')}`);
  }
  return limpio;
}
