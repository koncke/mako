// =============================================================================
// copywriter/tema — de qué habla un texto y en qué idioma está, sin IA (PURO; 13/11/2026)
// =============================================================================
// El relevo de Copywriting (13/11/2026, Martín: «escribe casi que cualquier cosa»): para un negocio de marketing y ventas, la
// portada abría con fitness, autoayuda y una maratón, y 35 de los 48 carruseles de arriba estaban en inglés. El flujo nuevo (la
// maqueta que aprobó el Cerebro el mismo día):
//   · la portada abre en «De tu tema»: lo que habla de lo mismo que el negocio (o de algo vecino), en su idioma primero y lo que
//     está en inglés después y marcado;
//   · al replicar algo que no tiene que ver, MaKo pregunta cómo usarlo (sólo su gancho y su estructura, o llevar su tema al negocio).
// Se decide con PALABRAS, no con una IA: la portada tiene cientos de outliers y se arma en cada apertura; una palabra de un tema
// suma un punto a ese tema y gana el que más suma (con 2 como mínimo). Lo que no llega a 2 queda sin tema: no se adivina.
// =============================================================================

export type IdTema = 'negocios' | 'tecnologia' | 'fitness' | 'nutricion' | 'mentalidad' | 'finanzas' | 'inmobiliario' | 'belleza' | 'pareja' | 'diseno';

export type Tema = { id: IdTema; nombre: string };

/**
 * Los temas y sus palabras, sin tildes y en minúscula, en español y en inglés. Una palabra con «*» al final es un comienzo
 * («vend*» es vender, vendes, vendiste). Las que sirven para todo (dinero, éxito, rutina, peso) no están: hacían ganar a cualquiera.
 */
export const TEMAS: readonly (Tema & { palabras: readonly string[] })[] = [
  { id: 'negocios', nombre: 'negocios, marketing y ventas', palabras: [
    'vend*', 'venta', 'ventas', 'cliente', 'clientes', 'lead', 'leads', 'marketing', 'anuncio', 'anuncios', 'ads', 'funnel', 'funnels', 'embudo*',
    'negocio', 'negocios', 'empresa*', 'emprend*', 'factur*', 'ingresos', 'agencia*', 'high ticket', 'cierre', 'cerrar', 'closer*', 'setter*',
    'oferta*', 'escalar', 'prospect*', 'whatsapp', 'copy', 'copywriting', 'marca personal', 'consultor*', 'cobrar', 'cobras', 'rentab*',
    'conversion*', 'campana*', 'meta ads', 'facebook ads', 'ecommerce', 'tienda online', 'dropshipping', 'mentoria*', 'infoproducto*', 'webinar*',
    'sales', 'sell', 'selling', 'customer*', 'business*', 'revenue', 'offer*', 'scale', 'scaling', 'agency', 'agencies', 'entrepreneur*',
    'profit*', 'closing', 'pricing', 'brand', 'branding', 'client', 'clients', 'audiencia', 'audience', 'contenido que vende', 'llamada de venta*',
  ] },
  { id: 'tecnologia', nombre: 'tecnología e IA', palabras: [
    'inteligencia artificial', 'ia', 'ai', 'chatgpt', 'gpt', 'claude', 'automatiz*', 'automation*', 'software', 'app', 'apps', 'programar',
    'programacion', 'codigo', 'coding', 'code', 'saas', 'herramienta*', 'tool', 'tools', 'agente*', 'agent', 'agents', 'prompt*', 'n8n', 'zapier',
  ] },
  { id: 'fitness', nombre: 'fitness y deporte', palabras: [
    'ejercicio*', 'entren*', 'gym', 'gimnasio', 'musculo*', 'muscular', 'biceps', 'triceps', 'abdominal*', 'abs', 'cardio', 'correr', 'corredor*',
    'maraton', 'marathon', 'running', 'grasa', 'sentadilla*', 'squat*', 'workout*', 'training', 'fitness', 'deporte*', 'atleta*', 'pesas',
    'crossfit', 'brazos', 'piernas', 'gluteo*', 'shred', 'reps', 'repeticiones', 'hipertrofia', 'muscle*', 'curl', 'curls', 'push up*', 'flexiones',
    'km', 'kilometros', 'race',
  ] },
  { id: 'nutricion', nombre: 'nutrición y salud', palabras: [
    'dieta*', 'nutricion*', 'alimentacion', 'receta*', 'caloria*', 'ayuno', 'proteina*', 'salud', 'hormona*', 'dormir', 'sueno', 'intestin*',
    'diet', 'nutrition', 'recipe*', 'calorie*', 'fasting', 'protein', 'health', 'healthy', 'sleep', 'gut', 'azucar', 'sugar', 'suplemento*',
  ] },
  { id: 'mentalidad', nombre: 'desarrollo personal', palabras: [
    'mentalidad', 'mindset', 'habito*', 'habit', 'habits', 'motivacion', 'motivation', 'disciplina', 'discipline', 'proposito', 'purpose',
    'meditacion', 'meditation', 'ansiedad', 'anxiety', 'felicidad', 'happiness', 'autoestima', 'productividad', 'productivity', 'espiritual*',
    'manifest*', 'consciencia', 'gratitud', 'gratitude', 'trauma*', 'emocion*', 'emotion*', 'mindvalley', 'mente',
  ] },
  { id: 'finanzas', nombre: 'finanzas e inversión', palabras: [
    'invertir', 'inversion*', 'inversor*', 'acciones', 'bolsa', 'cripto*', 'bitcoin', 'trading', 'trader*', 'ahorr*', 'deuda*', 'finanzas',
    'patrimonio', 'invest*', 'stock', 'stocks', 'crypto', 'savings', 'debt', 'wealth', 'dividend*', 'interes compuesto', 'compound interest',
  ] },
  { id: 'inmobiliario', nombre: 'inmobiliario', palabras: [
    'inmobiliari*', 'propiedad*', 'departamento*', 'alquiler*', 'hipoteca*', 'bienes raices', 'real estate', 'realtor*', 'mortgage*',
    'property', 'properties', 'rent', 'rental*', 'airbnb', 'terreno*', 'lote', 'lotes',
  ] },
  { id: 'belleza', nombre: 'belleza y moda', palabras: [
    'maquillaje', 'piel', 'skincare', 'cabello', 'pelo', 'moda', 'ropa', 'outfit*', 'makeup', 'skin', 'hair', 'fashion', 'beauty', 'manicura',
    'cosmetic*', 'estetica', 'peinado*',
  ] },
  { id: 'pareja', nombre: 'pareja y relaciones', palabras: [
    'pareja', 'novio', 'novia', 'citas', 'enamor*', 'dating', 'relationship*', 'boyfriend', 'girlfriend', 'marriage', 'matrimonio', 'ex',
  ] },
  { id: 'diseno', nombre: 'diseño', palabras: [
    'diseno', 'disenador*', 'tipografia*', 'design', 'designer*', 'font', 'fonts', 'typography', 'logo', 'logos', 'canva', 'figma', 'paleta',
    'palette', 'kerning', 'layout',
  ] },
];

/**
 * Los temas que van JUNTOS: un negocio de marketing y ventas también aprende de un anuncio de una herramienta de IA o de un carrusel
 * de diseño, pero no de una rutina de bíceps.
 */
export const VECINOS: Readonly<Record<IdTema, readonly IdTema[]>> = {
  negocios: ['tecnologia', 'diseno'],
  tecnologia: ['negocios'],
  diseno: ['negocios'],
  fitness: ['nutricion'],
  nutricion: ['fitness'],
  mentalidad: [],
  finanzas: ['negocios'],
  inmobiliario: ['finanzas'],
  belleza: [],
  pareja: ['mentalidad'],
};

/** Lo mínimo para decir de qué habla: con menos, no se adivina. */
export const PUNTOS_MINIMOS = 2;

const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const palabrasDe = (t: string): string[] => plano(t).match(/[a-z0-9ñ]+/g) ?? [];

/** Las palabras de un tema, listas para comparar: las sueltas, los comienzos y las de dos palabras. */
const INDICE = TEMAS.map((t) => ({
  tema: t,
  sueltas: new Set(t.palabras.filter((p) => !p.endsWith('*') && !p.includes(' '))),
  comienzos: t.palabras.filter((p) => p.endsWith('*') && !p.includes(' ')).map((p) => p.slice(0, -1)),
  frases: t.palabras.filter((p) => p.includes(' ')).map((p) => p.replace(/\*$/, '')),
}));

/** Los puntos de cada tema en un texto (cada palabra DISTINTA suma uno: «venta, venta, venta» es un punto). */
export function puntosDeTemas(texto: string): Map<IdTema, number> {
  const ws = palabrasDe(texto);
  const unicas = new Set(ws);
  const corrido = ` ${ws.join(' ')} `;
  const out = new Map<IdTema, number>();
  for (const { tema, sueltas, comienzos, frases } of INDICE) {
    const vistas = new Set<string>();
    for (const w of unicas) {
      if (sueltas.has(w)) vistas.add(w);
      else { const c = comienzos.find((x) => w.startsWith(x)); if (c) vistas.add(c); }
    }
    for (const f of frases) if (corrido.includes(` ${f}`)) vistas.add(f);
    if (vistas.size) out.set(tema.id, vistas.size);
  }
  return out;
}

/** De qué habla un texto: el tema con más puntos (al menos PUNTOS_MINIMOS y sin empate arriba), o null. */
export function temaDeTexto(texto: string): Tema | null {
  const pts = [...puntosDeTemas(texto)].sort((a, b) => b[1] - a[1]);
  const [primero, segundo] = pts;
  if (!primero || primero[1] < PUNTOS_MINIMOS || (segundo && segundo[1] === primero[1])) return null;
  const t = TEMAS.find((x) => x.id === primero[0])!;
  return { id: t.id, nombre: t.nombre };
}

/** ¿Un tema le sirve a un negocio de ese tema? (el mismo, o un vecino). */
export const temaRelacionado = (negocio: IdTema, otro: IdTema): boolean => negocio === otro || VECINOS[negocio].includes(otro);

// ── El idioma ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type Idioma = 'es' | 'en';

const ES = new Set(['de', 'la', 'que', 'el', 'en', 'y', 'los', 'se', 'del', 'las', 'un', 'por', 'con', 'no', 'una', 'su', 'para', 'es', 'al', 'lo',
  'como', 'mas', 'pero', 'sus', 'le', 'ya', 'este', 'porque', 'esta', 'cuando', 'muy', 'sin', 'sobre', 'tambien', 'me', 'hasta', 'hay', 'donde',
  'quien', 'desde', 'todo', 'nos', 'tu', 'tus', 'te', 'mi', 'mis', 'yo', 'si', 'eso', 'esto', 'son', 'tiene', 'tienes', 'puedes', 'hacer',
  'quieres', 'nunca', 'siempre', 'cada', 'asi', 'ser', 'estas', 'estos', 'ese', 'esa', 'otro', 'otra', 'algo', 'nada', 'vas', 'aqui']);
const EN = new Set(['the', 'and', 'to', 'of', 'in', 'is', 'it', 'you', 'that', 'for', 'on', 'with', 'this', 'are', 'be', 'your', 'i', 'my', 'was',
  'have', 'not', 'but', 'what', 'all', 'can', 'so', 'if', 'do', 'how', 'they', 'we', 'from', 'at', 'or', 'will', 'just', 'about', 'get', 'more',
  'like', 'when', 'out', 'up', 'why', 'who', 'these', 'those', 'than', 'then', 'them', 'their', 'our', 'here', 'there', 'did', 'does', 'don',
  'its', 'into', 'every', 'never', 'want', 'need', 'make', 'way', 'most', 'people', 'should', 'would', 'could', 'by', 'an', 'as', 'one']);

/**
 * El idioma de un texto por sus palabras chicas (de, la, que · the, and, to): el que tenga al menos 2 y más que el otro (una
 * vez y media). null = no se sabe (pocas palabras, o mezclado): se trata como del idioma del negocio, no se esconde.
 */
export function idiomaDe(texto: string): Idioma | null {
  let es = 0;
  let en = 0;
  for (const w of palabrasDe(texto)) { if (ES.has(w)) es++; if (EN.has(w)) en++; }
  if (es >= 2 && es > en * 1.5) return 'es';
  if (en >= 2 && en > es * 1.5) return 'en';
  return null;
}
