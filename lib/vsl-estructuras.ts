// =============================================================================
// vsl-estructuras — el esqueleto narrativo de un VSL LARGO (20-45 min)
// =============================================================================
// Hermana de lib/guion-estructuras.ts, y existe por separado porque las de allá
// son de ANUNCIO CORTO: Gancho→Historia→CTA, PAS, AIDA, BAB, 4P. Sirven para 30
// a 90 segundos. Un VSL de media hora no es un anuncio largo — tiene que
// sostener atención durante veinte minutos antes de pedir nada, y para eso
// necesita bloques que en un ad no existen (mecanismo único, prueba, manejo de
// objeciones, garantía, cierre con escasez).
//
// Las `etiquetas` son CONTRATO con el parser de la UI, igual que en los ads: el
// guion generado marca cada bloque con su etiqueta EXACTA, en MAYÚSCULA y sola
// en su línea, y la app lo parte en tarjetas por ahí. Reglas duras del parser:
// MAYÚSCULA pura, SIN TILDES, sin dos puntos ni texto extra en esa línea.
// Agregar estructuras nuevas es seguro; RENOMBRAR una etiqueta existente deja
// como texto plano todos los guiones ya guardados con ella.
//
// Además, las etiquetas son el puente con el VSL Analyst: cada bloque tiene un
// segundo de inicio, y con eso la curva de retención deja de decir "se cae en el
// 40%" para decir "se cae cuando arranca la OFERTA" (lib/vsl-retencion.ts →
// corteDeSegundo).
//
// DATOS PUROS (sin 'server-only'). El super-admin los edita desde la página
// "Guiones" — override global en el OWNER_WS, mismo patrón que los ángulos.
// =============================================================================

export type EstructuraVsl = {
  id: string;
  nombre: string;
  emoji: string;
  /** Cuándo conviene (1-2 frases — se ve al elegir estructura). */
  cuando: string;
  /** Los bloques del VSL, EN ORDEN, en MAYÚSCULA exacta (contrato del parser). */
  etiquetas: string[];
  /** Guía por bloque para la IA: qué hace cada uno, con minutos y ejemplos. */
  guia: string;
  /** Duración objetivo en minutos (orienta a la IA sobre cuánto escribir). */
  minutos: number;
  activo: boolean;
};

export const ESTRUCTURAS_VSL_DEFAULT: EstructuraVsl[] = [
  {
    id: 'vsl-respuesta-directa',
    nombre: 'VSL clásico de respuesta directa',
    emoji: '🎯',
    activo: true,
    minutos: 30,
    cuando:
      'La estructura más probada para vender high ticket a tráfico frío. El espectador llega sin conocerte y sale queriendo agendar. Si no sabés cuál elegir, es esta.',
    etiquetas: ['LEAD', 'PROBLEMA', 'HISTORIA', 'MECANISMO', 'PRUEBA', 'OFERTA', 'OBJECIONES', 'CTA'],
    guia: `LEAD (0-2 min): la promesa grande y para quién es, en las primeras 30 segundos. Tiene que cualificar (que el que no es tu avatar se vaya) y comprometer una promesa específica y creíble. Prohibido arrancar con "hola, soy X": nadie sabe quién sos todavía y es donde más gente se cae.
PROBLEMA (2-6 min): nombra el problema real como lo vive el avatar, con sus palabras. No es el problema que vos ves: es el que él siente. Mostrá el costo de seguir igual —en plata, en tiempo, en la cabeza— sin exagerar ni dramatizar.
HISTORIA (6-12 min): cómo llegaste vos (o tu cliente) a este problema y qué pasó. Antes creible, fondo, y el momento del descubrimiento. Es lo que compra la atención para lo que viene: sin historia, el mecanismo suena a otro método más.
MECANISMO (12-19 min): LA pieza que separa este VSL de todos los demás. Explicá POR QUE funciona lo que ofrecés, con nombre propio y en términos que se entiendan. Una sola idea central, bien explicada, gana a tres a medias. Si el espectador no puede repetirle el mecanismo a un tercero, todavía no está escrito.
PRUEBA (19-24 min): casos concretos con números y nombres, no adjetivos. Uno detallado vale más que seis en una grilla. Mostrá el antes, qué se hizo y el después, y elegí casos con los que el avatar se pueda comparar.
OFERTA (24-28 min): qué es exactamente, qué incluye y qué logra. Precio o el paso para saberlo. Acá se cae mucha gente y está bien que se caiga: es el filtro. Lo que no puede pasar es que se caiga por no entender qué estás ofreciendo.
OBJECIONES (28-32 min): las tres o cuatro que de verdad aparecen en tus llamadas ("no tengo tiempo", "ya probé algo así", "es caro", "mi caso es distinto"). Contestalas como si estuvieras en la reunión, sin pelear con el espectador.
CTA (32-35 min): una sola instrucción, dicha con claridad y repetida. Qué va a pasar cuando haga clic, cuánto dura, con quién habla y qué se lleva. Nada de urgencia inventada: si hay escasez real, decila; si no, no la actúes.`,
  },
  {
    id: 'vsl-clase-educativa',
    nombre: 'Clase gratuita (webinar comprimido)',
    emoji: '🎓',
    activo: true,
    minutos: 40,
    cuando:
      'Enseñás de verdad y la venta llega al final, ganada. Rinde con avatares escépticos o técnicos que ya vieron muchas promesas y compran a quien les demuestra que sabe.',
    etiquetas: ['LEAD', 'PROMESA', 'QUIEN SOY', 'CLAVE UNO', 'CLAVE DOS', 'CLAVE TRES', 'TRANSICION', 'OFERTA', 'CTA'],
    guia: `LEAD (0-2 min): qué va a aprender en esta clase y para quién es. Concreto y enumerable ("las tres razones por las que X").
PROMESA (2-4 min): qué se lleva aunque no compre nada. Tiene que ser cierto: es lo que compra la atención de los siguientes treinta minutos.
QUIEN SOY (4-7 min): credenciales en función del problema, no un currículum. Por qué tenés derecho a hablar de esto. Corto: el espectador vino por la clase, no por vos.
CLAVE UNO (7-15 min): la primera idea, enseñada completa y aplicable. Que se pueda usar hoy sin comprarte nada.
CLAVE DOS (15-23 min): la segunda. Idealmente rompe una creencia que el avatar da por cierta.
CLAVE TRES (23-31 min): la tercera, y la que naturalmente abre la puerta a lo que vendés: la que se puede entender sola pero se ejecuta mucho mejor acompañado.
TRANSICION (31-34 min): el puente honesto de enseñar a ofrecer. Nombralo en voz alta ("ahora te cuento cómo lo hacemos nosotros, y si no te interesa, ya te llevaste las tres claves"). El espectador ya sabe que viene una oferta: fingir que no es lo que rompe la confianza.
OFERTA (34-39 min): qué es, para quién, qué incluye y qué logra. Sin inflar: venís de treinta minutos de credibilidad, no la gastes acá.
CTA (39-42 min): una sola instrucción clara y qué pasa después del clic.`,
  },
  {
    id: 'vsl-anti-solucion',
    nombre: 'Contrarian (por qué lo que probaste falla)',
    emoji: '🔥',
    activo: true,
    minutos: 25,
    cuando:
      'Para mercados quemados, donde el avatar ya probó de todo y desconfía. En vez de sumar otra promesa, explica por qué las anteriores no podían funcionar. Fuerte en retargeting.',
    etiquetas: ['LEAD', 'ENEMIGO', 'POR QUE FALLA', 'CATEGORIA NUEVA', 'MECANISMO', 'PRUEBA', 'OFERTA', 'CTA'],
    guia: `LEAD (0-2 min): la afirmación contraintuitiva que frena el scroll mental ("el problema no es que no consigas leads"). Tiene que ser algo que el avatar sospecha pero no se animó a decir.
ENEMIGO (2-6 min): nombrá lo que todos hacen y él ya intentó. Sin insultar a nadie: el enemigo es el METODO, nunca la persona que lo siguió — si lo atacás a él, se defiende y se va.
POR QUE FALLA (6-11 min): la explicación estructural de por qué eso no podía funcionar. Acá se gana o se pierde el VSL: si el "por qué" convence, todo lo que sigue entra solo.
CATEGORIA NUEVA (11-15 min): si lo viejo no sirve, ¿qué? Presentá la categoría antes que tu producto. El espectador tiene que querer la categoría primero.
MECANISMO (15-19 min): cómo funciona en concreto, con nombre propio.
PRUEBA (19-22 min): que alguien como él ya lo hizo. Con números.
OFERTA (22-25 min): qué es y qué incluye, directo.
CTA (25-27 min): una sola instrucción.`,
  },
  {
    id: 'vsl-diagnostico',
    nombre: 'Diagnóstico (síntoma → causa raíz)',
    emoji: '🩺',
    activo: true,
    minutos: 25,
    cuando:
      'Para B2B y servicios donde el avatar sabe que algo no funciona pero no sabe qué. Vende posicionándote como quien entiende el problema mejor que él, no como quien grita más fuerte.',
    etiquetas: ['LEAD', 'SINTOMAS', 'DIAGNOSTICO', 'CAUSA RAIZ', 'TRATAMIENTO', 'CASO', 'OFERTA', 'GARANTIA', 'CTA'],
    guia: `LEAD (0-2 min): el síntoma que él reconoce al instante ("facturás bien pero no te queda plata"). Si acierta el síntoma, se queda.
SINTOMAS (2-6 min): tres o cuatro señales más, para que se vea retratado. Cuantas más marque, más autoridad ganás sin decir una palabra sobre vos.
DIAGNOSTICO (6-10 min): qué tienen en común esos síntomas. Empezá a nombrar el patrón.
CAUSA RAIZ (10-15 min): la causa real, la que él no ve. Es el corazón del VSL: tiene que ser una sola, explicada de forma que se entienda y duela un poco.
TRATAMIENTO (15-19 min): qué hay que hacer, en orden. El QUE completo, aunque el COMO requiera ayuda.
CASO (19-22 min): un caso, en profundidad, de alguien con los mismos síntomas. Antes, qué se cambió, después.
OFERTA (22-25 min): cómo se hace con vos y qué incluye.
GARANTIA (25-27 min): qué pasa si no funciona. Si no tenés garantía, decí qué riesgo asume cada parte — el silencio en este bloque se lee como letra chica.
CTA (27-29 min): una sola instrucción y qué pasa después.`,
  },
  {
    id: 'vsl-historia-fundador',
    nombre: 'Historia del fundador',
    emoji: '📖',
    activo: true,
    minutos: 20,
    cuando:
      'Cuando la marca personal es el activo y el avatar compra por identificación. Rinde en orgánico y con audiencia tibia que ya te vio antes; flojo en tráfico frío puro.',
    etiquetas: ['LEAD', 'ORIGEN', 'FONDO', 'DESCUBRIMIENTO', 'TRANSFORMACION', 'MECANISMO', 'OFERTA', 'CTA'],
    guia: `LEAD (0-2 min): el momento más alto o más bajo de la historia, contado primero. Nunca arranques por el principio cronológico: arrancá por la escena que engancha.
ORIGEN (2-5 min): de dónde venías, en la situación en la que hoy está el avatar. Que se reconozca.
FONDO (5-9 min): qué salió mal y qué te costó. Honesto y concreto: la vulnerabilidad genérica no construye nada.
DESCUBRIMIENTO (9-12 min): qué cambió y cómo lo encontraste. El giro de la historia.
TRANSFORMACION (12-15 min): qué pasó después, con números.
MECANISMO (15-18 min): el paso de "me funcionó a mí" a "esto es un método". Sin este bloque queda una anécdota linda que no vende: una historia no es un sistema.
OFERTA (18-21 min): cómo se lo pasás a él.
CTA (21-23 min): una sola instrucción.`,
  },
];

/** Etiquetas válidas del parser: MAYÚSCULA, sin tildes, sin dos puntos, 2-48 chars. */
const ETIQUETA_OK = /^[A-Z0-9ÑÜ ]{2,48}$/;

const slug = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const sinTildes = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function estructuraVslPorId(
  estructuras: EstructuraVsl[],
  id: string,
): EstructuraVsl | undefined {
  return estructuras.find((e) => e.id === id);
}

/**
 * Normaliza lo que venga del override del admin. Descarta lo que rompería el
 * parser en vez de guardarlo: una etiqueta inválida no falla al guardar, falla
 * semanas después dejando el guion como un bloque de texto plano.
 */
export function normalizarEstructurasVsl(v: unknown): EstructuraVsl[] {
  if (!Array.isArray(v)) return [];
  const out: EstructuraVsl[] = [];
  const vistos = new Set<string>();
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const nombre = String(o.nombre ?? '').trim().slice(0, 120);
    const guia = String(o.guia ?? '').trim();
    const id = slug(String(o.id ?? '') || nombre);
    if (!id || !nombre || !guia || vistos.has(id)) continue;

    const etiquetas = (Array.isArray(o.etiquetas) ? o.etiquetas : [])
      .map((e) => sinTildes(String(e ?? '')).toUpperCase().trim().slice(0, 48))
      .filter((e) => ETIQUETA_OK.test(e));
    // Menos de dos bloques no es una estructura: es un párrafo.
    if (etiquetas.length < 2) continue;

    const minutosRaw = Number(o.minutos);
    out.push({
      id,
      nombre,
      emoji: String(o.emoji ?? '').trim().slice(0, 8) || '🎥',
      cuando: String(o.cuando ?? '').trim().slice(0, 400),
      etiquetas,
      guia,
      minutos: Number.isFinite(minutosRaw) && minutosRaw > 0 ? Math.min(120, Math.round(minutosRaw)) : 25,
      activo: o.activo !== false,
    });
    vistos.add(id);
  }
  return out;
}
