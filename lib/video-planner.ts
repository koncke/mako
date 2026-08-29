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
import { getFunnel } from './leads';
import { perfilNegocioTexto } from './onboarding';
import { getPersona } from './persona';
import { getWorkspaceActual } from './workspace';
import { brandSystem, parseJsonObject } from './campaign-structurer';
import { renderTemplate, contenidoNoConfiable } from './prompt-render-pure';
import {
  puestaPorId, ritmoDeClips, palabrasQueEntran, contarPalabras, repartirDuracion,
  marcasDeVoseo, conAcento, soloHablado, type Puesta,
} from './puestas-data';
import { repartirGuion, contarPalabrasReparto } from './guion-reparto';
import { cierreDeGuion, tomasDelCierre, fidelidad } from './guion-cierre';

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
  /** Qué imagen adjuntar, cuando la puesta necesita imágenes previas. */
  imagenAdjunta?: string;
  /** El prompt completo, listo para pegar. Español para el guion, inglés para la escena. */
  prompt: string;
  /** Palabras contadas en `voz`. Medido acá, no declarado por el modelo. */
  palabras: number;
  /** Cuántas entran en este clip según la densidad de la puesta. */
  tope: number;
  /** true = es el CIERRE del guion y va palabra por palabra como lo escribió el cliente. */
  literal?: boolean;
  /** true = la adaptación conservó menos de la mitad del contenido del original. */
  seAlejo?: boolean;
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
  /** Qué imágenes hay que tener ANTES de animar. Vacío si la puesta no las pide. */
  imagenesNecesarias: string[];
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

const SYSTEM_TEMPLATE = `Eres MaKo, planificando un anuncio en video con avatar de IA para un negocio real.

Tu salida es el PLAN DE CLIPS: qué dice cada clip, qué se ve, cómo se mueve la cámara, y el prompt listo para pegar en el modelo de video. No escribes prosa ni explicaciones.

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

## CÓMO SE ESCRIBE EL PROMPT DE VIDEO

Tres bloques, en este orden y siempre en inglés salvo el guion:

1. **Cámara.** Qué hace el teléfono que filma. Con precisión: "retrocede frente a él" y "visto desde el asiento del acompañante" son tomas opuestas, y si no lo dices el modelo elige la que no es. Cuando la puesta pide cámara estática, se dice explícitamente que no se mueve.
2. **Acción.** Qué hace la persona, físicamente. Va siempre, incluso si es "está quieto": si no se escribe, el modelo rellena.
3. **Guion.** El texto entre comillas, tal cual.

**NO escribas el acento ni el idioma en el prompt.** Lo agrega el sistema al final, con las palabras exactas que eligió el cliente. Si lo escribes tú, se borra.

**NUNCA describas la cara, el pelo, la edad ni el cuerpo de la persona.** Ni una palabra. La identidad la resuelve la foto de referencia que se adjunta, y cualquier descripción compite con ella: el modelo prefiere el texto y devuelve a alguien que cumple la descripción sin ser la persona. Esta es la regla que más caro se paga romper.

**Tampoco describas el tratamiento fotográfico** (contraste, flash, grano). Eso ya viene resuelto.

Cuando la persona no habla en un clip, el prompt dice explícitamente que no dice nada.

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
const BLOQUE_GUION_LITERAL = `## EL GUION YA ESTÁ ESCRITO — ADAPTAS LA FORMA, NO EL FONDO

El cliente eligió un guion suyo y **ya está repartido en tomas**. Cada clip de la
estructura de abajo trae su línea de VOZ.

**Lo que SÍ tienes que hacer con esas líneas:** decirlas como las diría él. Meter
sus conectores de arranque —"a ver", "mira", "pues", "entonces", "la verdad"—,
usar las palabras de su variedad del español, y ajustar el largo al tope del clip.
Un guion escrito como se escribe suena leído; escrito como se habla, suena dicho.

**Lo que NO puedes cambiar, nunca:**
- Lo que la frase DICE. Ni un dato, ni un número, ni una consecuencia, ni el
  orden de las ideas. Cambias cómo suena, no qué afirma.
- **El CIERRE. Va LITERAL, palabra por palabra.** Las tomas marcadas
  \`CIERRE — LITERAL\` se copian tal cual: ni una palabra distinta, ni una de más.

Por qué el cierre es distinto del resto: ahí está a dónde manda el anuncio. Ya
falló una vez — un guion que cerraba con «en el video del enlace te explico cómo
construir ese sistema» volvió como «toca el botón aquí abajo, deja tus datos en el
formulario». Eso no es un cambio de estilo: es mandar a la gente a un paso del
embudo que puede no existir, y no se nota leyendo. Se nota cuando nadie llega.

La sección de abajo sobre cómo se escribe el texto hablado te sirve para el TONO.
No la uses para inventar contenido: acá no hay que escribir un guion, hay que
decir el que ya está.
`;

const USER_TEMPLATE = `## EL PEDIDO

{{pedido}}

## EL NEGOCIO

{{contexto}}

Escribe el plan completo respetando la cantidad de clips, la duración de cada uno y el tope de palabras que se indica clip por clip.`;

const JSON_SHAPE = `{
  "titulo": "el título del anuncio, corto",
  "clips": [
    {
      "n": 1,
      "voz": "lo que se dice en este clip",
      "queSeVe": "la acción física de la persona",
      "camara": "qué hace la cámara",
      "imagenAdjunta": "nombre de la imagen a adjuntar, o null",
      "prompt": "el prompt completo listo para pegar"
    }
  ],
  "imagenesNecesarias": ["descripción de cada imagen que hay que generar antes, o lista vacía"]
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
      : `${base}\n  VOZ: "${texto}"  (dila como él la diría, sin cambiar lo que afirma)`;
  });
  return [
    `Son ${cantidad} clips, en este orden y con estas restricciones:`,
    '',
    ...filas,
    '',
    `Ritmo: ${habla.map((h) => (h ? 'H' : 'O')).join(' ')} (H = habla en cámara, O = voz en off).`,
    puesta.imagenesPrevias
      ? 'Esta puesta necesita imágenes generadas ANTES de animar: enumera cuáles en `imagenesNecesarias` y referencia cada una en el `imagenAdjunta` del clip que la usa.'
      : 'Esta puesta NO necesita generar imágenes: se anima sobre fotos reales. Deja `imagenesNecesarias` vacío y `imagenAdjunta` en null.',
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
    const adjunta = str(o.imagenAdjunta);
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

    // Cuánto se alejó de lo que decía el guion. Solo palabras con contenido:
    // sumar «mira» o «pues» es la adaptación buscada, no un desvío.
    const fiel = reparto && !esCierre && delModelo ? fidelidad(original, delModelo) : 1;

    return {
      n: i + 1,
      segundos: segundos[i],
      habla: habla[i],
      voz,
      queSeVe: str(o.queSeVe),
      camara: str(o.camara),
      imagenAdjunta: puesta.imagenesPrevias && adjunta ? adjunta : undefined,
      prompt: conAcento(str(o.prompt), acento),
      palabras: contarPalabras(voz),
      tope: palabrasQueEntran(puesta, segundos[i]),
      voseo: marcasDeVoseo(voz),
      literal: esCierre && !!reparto,
      // Debajo de 0,45 ya no es «lo mismo dicho de otra forma»: quedó menos de la
      // mitad de los sustantivos y verbos del original. No se descarta —puede ser
      // una condensación legítima— pero la pantalla lo dice, que es la diferencia
      // entre un cambio y un cambio silencioso.
      seAlejo: fiel < 0.45,
      original: reparto && !esCierre && delModelo && delModelo !== original ? original : undefined,
    };
  });

  const imagenes = Array.isArray(raw.imagenesNecesarias)
    ? raw.imagenesNecesarias.map(str).filter(Boolean)
    : [];

  return {
    puestaId: puesta.id,
    titulo: str(raw.titulo) || 'Anuncio sin título',
    duracionTotalSeg: segundos.reduce((a, b) => a + b, 0),
    ritmo: habla.map((h) => (h ? 'H' : 'O')).join(' '),
    clips,
    deCorrido: clips.map((c) => c.voz).filter(Boolean).join(' '),
    imagenesNecesarias: puesta.imagenesPrevias ? imagenes : [],
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
  const cierre = pedido.guionLiteral ? cierreDeGuion(pedido.guionLiteral) : '';
  const literales = reparto
    ? tomasDelCierre(reparto, contarPalabrasReparto(cierre))
    : new Set<number>();

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
      guionLiteral: reparto ? BLOQUE_GUION_LITERAL : '',
      estructura: `${estructuraDeClips(puesta, cantidad, segundos, reparto, literales)}\n\nFORMA DEL JSON:\n${JSON_SHAPE}`,
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
      maxTokens: 12000,
      feature: FEATURE_VIDEO_PLANNER,
      motivo: `Planificar anuncio en video (${puesta.nombre})`,
    });

    return { ok: true, plan: { ...sanearPlan(parseJsonObject(salida), puesta, segundos, pedido.acentoPrompt, reparto, literales), anguloId: pedido.anguloId } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `No se pudo armar el plan: ${msg}` };
  }
}
