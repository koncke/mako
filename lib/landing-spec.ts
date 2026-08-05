// =============================================================================
// landing-spec — la FORMA de una landing propuesta (tipos puros, sin server-only)
// =============================================================================
// Vive aparte de lib/landing-writer.ts (que es 'server-only') porque la pantalla
// de revisión —un componente cliente— necesita el vocabulario y el exportador a
// Markdown como VALORES, no solo como tipos. Mismo patrón que
// prompt-render-pure: lo puro se importa de los dos lados, lo que toca la red y
// la base se queda del lado del server.
//
// El {{jsonShape}} del prompt, `parseLandingSpec` y esta forma son UNA sola
// fuente: si cambia una, cambian las tres.
// =============================================================================

export const OBJETIVOS_LANDING = [
  { value: 'agendar', label: 'Agendar una reunión', hint: 'El CTA lleva al calendario. El copy tiene que calificar antes de que agende.' },
  { value: 'vender', label: 'Vender directo', hint: 'La página cierra la venta: precio, garantía y objeciones adentro.' },
  { value: 'registrar', label: 'Dejar sus datos', hint: 'Formulario corto. Cuanto menos pida, mejor.' },
  { value: 'descargar', label: 'Descargar algo (lead magnet)', hint: 'La promesa es el recurso, no el servicio.' },
] as const;
export type ObjetivoLanding = (typeof OBJETIVOS_LANDING)[number]['value'];

export const BLOQUE_TIPOS = [
  'hero', 'prueba_social', 'problema', 'solucion', 'beneficios', 'como_funciona',
  'testimonios', 'oferta', 'precio', 'garantia', 'objeciones', 'faq', 'cta_final',
] as const;
export type BloqueTipo = (typeof BLOQUE_TIPOS)[number];

export const TIPO_LABEL: Record<BloqueTipo, string> = {
  hero: 'Hero', prueba_social: 'Prueba social', problema: 'Problema', solucion: 'Solución',
  beneficios: 'Beneficios', como_funciona: 'Cómo funciona', testimonios: 'Testimonios',
  oferta: 'Oferta', precio: 'Precio', garantia: 'Garantía', objeciones: 'Objeciones',
  faq: 'Preguntas frecuentes', cta_final: 'Cierre',
};

export type BloqueLanding = {
  tipo: BloqueTipo;
  titulo: string;          // el H2 de la sección
  copy: string;            // el cuerpo, listo para pegar
  bullets: string[];       // vacío si la sección no lleva
  cta: string;             // texto del botón; vacío si la sección no lleva
  nota: string;            // por qué está esta sección acá (para el dueño)
};

export type LandingSpec = {
  nombre: string;
  objetivo: ObjetivoLanding;
  avatar: string;
  promesa: string;
  headline: string;        // el H1
  subheadline: string;
  cta_principal: string;
  bloques: BloqueLanding[];
  meta_titulo: string;
  meta_descripcion: string;
  rationale: string;       // 1 frase para el dueño, en la voz de MaKo
};

export function objetivoLabel(v: string): string {
  return OBJETIVOS_LANDING.find((o) => o.value === v)?.label ?? v;
}

/** El spec como Markdown, para pegarlo en Lovable/Framer/el doc del diseñador. */
export function specAMarkdown(spec: LandingSpec): string {
  const l: string[] = [
    `# ${spec.nombre}`,
    '',
    `**Objetivo:** ${objetivoLabel(spec.objetivo)}`,
    `**Para:** ${spec.avatar || '—'}`,
    `**Promesa:** ${spec.promesa || '—'}`,
    '',
    '---',
    '',
    `## ${spec.headline}`,
    spec.subheadline,
    '',
    `**[ ${spec.cta_principal} ]**`,
    '',
  ];
  for (const b of spec.bloques) {
    l.push('---', '', `## ${b.titulo}`, `_${TIPO_LABEL[b.tipo] ?? b.tipo}_`, '');
    if (b.copy) l.push(b.copy, '');
    if (b.bullets.length) l.push(...b.bullets.map((x) => `- ${x}`), '');
    if (b.cta) l.push(`**[ ${b.cta} ]**`, '');
    if (b.nota) l.push(`> ${b.nota}`, '');
  }
  l.push('---', '', '### SEO', `**Título:** ${spec.meta_titulo || '—'}`, `**Descripción:** ${spec.meta_descripcion || '—'}`);
  return l.join('\n');
}
