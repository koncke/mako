// =============================================================================
// Los escenarios — DÓNDE se graba el anuncio, que no es lo mismo que el formato
// =============================================================================
//
// ── Por qué es un catálogo aparte y no un campo del formato ─────────────────
//
// El formato dice CÓMO se filma: la cámara, el ritmo, cuántos escenarios entran.
// El escenario dice DÓNDE pasa. Son dos preguntas distintas y hasta hoy había
// una sola: MaKo leía el guion y decidía el lugar solo. El dueño lo pidió al
// revés — «si quiero grabar en la oficina y quiero hacer variaciones del fondo».
//
// Que estuvieran mezclados se nota en los nombres: «The Office» suena a un
// lugar y NO lo es —es un plano secuencia caminando, que sirve igual en un
// depósito, un local o un coworking—. Un formato con nombre de lugar es
// exactamente el síntoma de las dos preguntas colapsadas en una.
//
// ── Qué NO se afirma acá ────────────────────────────────────────────────────
//
// ⚠️ Estos escenarios NO están «medidos» como los formatos. Un formato se ofrece
// sólo después de producir un anuncio entero con él (`confianza: 'medido'`, y
// `puestasOfrecidas()` filtra por tener ejemplo). Acá no hay nada de eso y no se
// pinta como si lo hubiera.
//
// Y la diferencia no es descuido, es que el riesgo es otro: la imagen del
// escenario se genera GRATIS —las de Flow no gastan créditos— y la persona la
// MIRA antes de confirmar. Un escenario que no funciona se ve en la pantalla
// siguiente y cuesta un click. Un formato que no funciona se descubre con el
// anuncio pagado y montado.
//
// ── Sin `server-only`, igual que `puestas-data` ─────────────────────────────
//
// Son constantes de producto y la pantalla de elegir las necesita para pintar
// las tarjetas. No hay nada de ningún workspace acá.

import type { Camara } from '@/lib/puestas-data';

export type Escenario = {
  /** El id que se guarda en el plan. No cambia nunca. */
  id: string;
  /** Como lo lee la persona. En español. */
  nombre: string;
  /** Una línea: qué es este lugar. */
  descripcion: string;
  /** Cuándo conviene. Es lo que ayuda a elegir, no la descripción. */
  cuando: string;
  /**
   * El lugar, en inglés, para el prompt de imagen. Es el MUNDO: lo que no
   * cambia entre escenario y escenario del mismo anuncio.
   */
  mundo: string;
  /**
   * Los fondos distintos que existen DENTRO de ese mundo, en inglés.
   *
   * ⚠️ ESTO ES LO QUE HACE QUE «OTRO FONDO» SIRVA. Sin la lista, la única forma
   * de cambiar el fondo era volver a tirar el mismo prompt y rezar: el modelo
   * devuelve una variación de lo mismo, casi siempre el mismo rincón con otra
   * luz. Con la lista, «otro fondo» es un lugar DISTINTO del mismo sitio, que
   * es lo que la persona quiere decir cuando lo pide.
   *
   * Y por eso también son los que se reparten entre los escenarios de un
   * anuncio: cuatro tomas en la misma oficina tienen que verse en cuatro
   * rincones, no cuatro veces en el mismo.
   */
  fondos: string[];
  /**
   * Con qué cámaras funciona. Vacío = con todas.
   *
   * ⚠️ Existe porque hay combinaciones que son una contradicción, no una
   * preferencia: «Car Talks» ES un selfie adentro de un auto, y ofrecerle una
   * oficina sería ofrecerle romper el formato. La pantalla no muestra lo que no
   * se puede elegir en vez de dejar elegirlo y fallar después.
   */
  camaras: Camara[];
};

/**
 * El catálogo. Cerrado, como el de proyectos y por el mismo motivo: una lista
 * abierta se convierte en un campo de texto con pasos de más.
 */
export const CATALOGO_ESCENARIOS: Escenario[] = [
  {
    id: 'oficina',
    nombre: 'Oficina',
    descripcion: 'Un espacio de trabajo con escritorios, luz de ventana y vidrio.',
    cuando: 'Cuando lo que vendes es un servicio o una asesoría y quieres verte trabajando.',
    mundo: 'a modern open-plan office with glass partitions, wooden desks and large windows',
    fondos: [
      'standing beside a glass meeting-room wall, city daylight coming in from the left',
      'walking past a row of desks with monitors, warm ceiling lights overhead',
      'in front of a whiteboard covered in diagrams, at the end of a corridor',
      'by the corner window with the city visible behind, plants on the sill',
      'next to the coffee station, brick wall and shelves in the background',
    ],
    camaras: ['seguimiento', 'estatica', 'mano'],
  },
  {
    id: 'auto',
    nombre: 'Auto',
    descripcion: 'Adentro del auto, cámara en mano, la calle pasando por la ventana.',
    cuando: 'Para hablar de frente y sin producción. Es el más creíble de todos.',
    mundo: 'inside a car, seated in the driver seat, street moving past the window',
    fondos: [
      'daylight, city street reflections passing on the side window',
      'parked, late afternoon sun coming through the windshield',
      'highway at midday, open sky and distant hills through the window',
      'evening, street lights out of focus behind the glass',
    ],
    camaras: ['selfie'],
  },
  {
    id: 'casa',
    nombre: 'Casa',
    descripcion: 'Living o escritorio en casa, luz natural y cosas personales.',
    cuando: 'Cuando quieres sonar cercano y no corporativo.',
    mundo: 'a warm home interior with natural light, plants and personal objects',
    fondos: [
      'seated on the living room sofa, window light from the side',
      'at a wooden desk with a bookshelf behind, lamp on',
      'standing in the kitchen, morning light on the counter',
      'by a large window with curtains, plants around',
    ],
    camaras: [],
  },
  {
    id: 'local',
    nombre: 'Local o showroom',
    descripcion: 'Tu local, con el producto y los estantes a la vista.',
    cuando: 'Cuando el producto se ve y vende solo estando ahí.',
    mundo: 'a retail showroom with product shelves, warm spot lighting and a counter',
    fondos: [
      'in front of the product shelves, spot lights above',
      'at the counter, the shop window and street visible behind',
      'walking down the aisle between two display walls',
      'beside the storefront glass, daylight coming in',
    ],
    camaras: ['seguimiento', 'estatica', 'mano'],
  },
  {
    id: 'estudio',
    nombre: 'Estudio',
    descripcion: 'Fondo liso y luz controlada. Nada distrae de lo que dices.',
    cuando: 'Para un mensaje directo, o cuando no quieres mostrar dónde estás.',
    mundo: 'a clean studio backdrop with controlled soft lighting and no props',
    fondos: [
      'plain deep-grey seamless backdrop, soft key light from the left',
      'warm off-white backdrop, even frontal lighting',
      'dark backdrop with a soft rim light separating the shoulders',
      'muted blue-grey backdrop, gentle gradient behind the head',
    ],
    camaras: ['estatica', 'selfie'],
  },
  {
    id: 'exterior',
    nombre: 'Exterior urbano',
    descripcion: 'La calle, la vereda, la ciudad de fondo.',
    cuando: 'Cuando quieres movimiento y que se note que estás yendo a algún lado.',
    mundo: 'an urban street exterior with buildings, sidewalk and city depth behind',
    fondos: [
      'on the sidewalk with the street receding behind, midday light',
      'in front of a building entrance, glass doors reflecting the street',
      'crossing a plaza with people out of focus in the distance',
      'against a painted wall on a quiet side street, late afternoon sun',
    ],
    camaras: ['seguimiento', 'mano', 'selfie'],
  },
  {
    id: 'deposito',
    nombre: 'Depósito o taller',
    descripcion: 'Galpón, estanterías altas, cajas y luz industrial.',
    cuando: 'Cuando vendes producto físico y quieres mostrar la operación real.',
    mundo: 'a warehouse interior with tall racking, boxes and industrial ceiling lights',
    fondos: [
      'walking between two tall racking aisles, lights running overhead',
      'in front of the loading door with daylight spilling in',
      'beside a stack of boxes on a pallet, concrete floor',
      'at a work bench with tools on the wall behind',
    ],
    camaras: ['seguimiento', 'mano'],
  },
  {
    id: 'cafe',
    nombre: 'Café',
    descripcion: 'Una mesa de café, gente de fondo fuera de foco.',
    cuando: 'Para una conversación relajada, como si le hablaras a un conocido.',
    mundo: 'a cafe interior with wooden tables, warm lamps and blurred people behind',
    fondos: [
      'at a window table, street visible and out of focus behind',
      'at the bar counter, espresso machine and shelves behind',
      'at a corner table with brick wall and hanging lamps',
      'on the terrace, daylight and plants around',
    ],
    camaras: ['estatica', 'selfie', 'mano'],
  },
];

/** Un escenario por su id. `null` si el plan guardó uno que ya no existe. */
export function escenarioPorId(id: string | undefined | null): Escenario | null {
  if (!id) return null;
  return CATALOGO_ESCENARIOS.find((e) => e.id === id) ?? null;
}

/**
 * Los que se pueden elegir con esta cámara.
 *
 * Nunca devuelve vacío: si un formato tuviera una cámara que ningún escenario
 * declara, la pantalla quedaría sin nada que ofrecer y sin forma de avanzar. En
 * ese caso se ofrecen todos y que decida la persona, que es mejor que un
 * callejón.
 */
export function escenariosParaCamara(camara: Camara): Escenario[] {
  const sirven = CATALOGO_ESCENARIOS.filter((e) => !e.camaras.length || e.camaras.includes(camara));
  return sirven.length ? sirven : CATALOGO_ESCENARIOS;
}

/**
 * Reparte los fondos entre los escenarios de un anuncio.
 *
 * ⚠️ SIN REPETIR MIENTRAS ALCANCEN, y ésa es toda la gracia. Cuatro tomas en la
 * misma oficina que salen en el mismo rincón se leen como un error de
 * generación, no como una decisión. Cuando los escenarios superan a los fondos
 * del catálogo se vuelve a empezar por el primero: repetir el fondo 1 en el
 * quinto escenario es aceptable; dejarlo vacío no.
 */
export function repartirFondos(escenario: Escenario, cuantos: number): string[] {
  const f = escenario.fondos;
  if (!f.length) return Array.from({ length: Math.max(0, cuantos) }, () => '');
  return Array.from({ length: Math.max(0, cuantos) }, (_, i) => f[i % f.length]);
}

/**
 * El fondo que sigue al que se está usando, dentro del mismo escenario.
 *
 * Es lo que hace el botón «Otro fondo»: avanza por la lista en orden y da la
 * vuelta al llegar al final, así tocarlo N veces recorre todos los rincones del
 * lugar y vuelve al primero. Si el fondo actual no está en la lista —viene de un
 * anuncio anterior al catálogo, o de un prompt editado a mano— arranca por el
 * primero, que es la respuesta correcta a «dame otro» cuando no se sabe cuál es
 * el de ahora.
 */
export function fondoSiguiente(escenario: Escenario, actual: string | undefined): string {
  const f = escenario.fondos;
  if (!f.length) return '';
  const i = actual ? f.indexOf(actual) : -1;
  return f[(i + 1) % f.length];
}
