// =============================================================================
// mako-context — arma el system prompt de MaKo (todo aditivo)
// =============================================================================
// Combina: persona activa + núcleo fijo (código) + perfil del negocio +
// instrucción de la sección + conocimiento recuperado (RAG) + datos del gráfico.
// Cada pieza es resiliente: si falla o está vacía, se omite. Con todo vacío y la
// persona por defecto, el prompt es IDÉNTICO al de hoy.

import 'server-only';
import { MAKO_NUCLEO, getActivePersona } from './mako-prompts';
import { getFaseInstruccion } from './mako-fases';
import { perfilNegocioTexto } from './onboarding';
import { searchKnowledge, formatKnowledge } from './mako-knowledge';
import { META_RULES_TEXT } from './meta-rules';

// Resumen fresco de las secuencias de nutrición + borradores de plantillas, para
// que MaKo opine con el funnel real a la vista en el chat de secuencias.
async function resumenSecuencias(): Promise<string> {
  const { getSecuenciasConStats } = await import('./nutricion');
  const { listDrafts } = await import('./meta-templates');
  const [secs, drafts] = await Promise.all([
    getSecuenciasConStats().catch(() => []),
    listDrafts().catch(() => []),
  ]);
  const lineasSec = secs.map((s) => {
    const pasos = s.pasos
      .map((p, i) => `    ${i + 1}. +${p.delay_horas}h ${p.canal}${p.template_wa ? ` [${p.template_wa}]` : ''}: ${(p.cuerpo || '').slice(0, 90)}`)
      .join('\n');
    return `- "${s.nombre}" (etapa ${s.etapa}, trigger ${s.trigger_tipo}, ${s.activa ? 'activa' : 'pausada'}, ${s.inscriptos} inscriptos):\n${pasos || '    (sin pasos)'}`;
  }).join('\n');
  const lineasTpl = drafts
    .map((d) => `- "${d.name}" (${d.category}, ${d.status}${d.etapa ? `, etapa ${d.etapa}` : ''}): ${(d.body || '').slice(0, 110)}`)
    .join('\n');
  return [lineasSec && `SECUENCIAS:\n${lineasSec}`, lineasTpl && `BORRADORES DE PLANTILLAS:\n${lineasTpl}`]
    .filter(Boolean).join('\n\n');
}

export async function buildSystemPrompt(opts: { chartKey: string; titulo: string; contexto: string; query: string }): Promise<string> {
  const { chartKey, titulo, contexto, query } = opts;

  const [persona, perfil, fase, knowledge] = await Promise.all([
    getActivePersona().catch(() => ''),
    perfilNegocioTexto().catch(() => ''),
    getFaseInstruccion(chartKey).catch(() => ''),
    searchKnowledge(query, 4).catch(() => [] as Array<{ titulo: string; cuerpo: string }>),
  ]);

  let base = `${persona}\n\n${MAKO_NUCLEO}`.trim();
  if (perfil) base += `\n\nNEGOCIO DE MARTÍN (perfil del cliente):\n${perfil}`;
  if (fase) base += `\n\nQUÉ TENÉS QUE MIRAR Y HACER EN ESTA SECCIÓN:\n${fase}`;
  const know = formatKnowledge(knowledge);
  if (know) base += `\n\nTU METODOLOGÍA (lo más relevante a esta consulta):\n${know}`;

  // Chat de secuencias de WhatsApp: sos consultor de deliverability. Cargás las
  // reglas de aprobación de Meta + las secuencias/plantillas reales del negocio.
  if (chartKey === 'whatsapp-secuencias') {
    base += `\n\nSOS CONSULTOR DE SECUENCIAS Y PLANTILLAS DE WHATSAPP. Cuando Martín te proponga una secuencia o un mensaje, evaluá si Meta lo aprobaría (citá la regla), sugerí mejoras concretas y pensá el timing/copy en función del funnel. Sé directo y accionable.\n\n${META_RULES_TEXT}`;
    const resumen = await resumenSecuencias().catch(() => '');
    if (resumen) base += `\n\nESTADO ACTUAL DE LAS SECUENCIAS Y PLANTILLAS DEL NEGOCIO:\n${resumen}`;
  }

  if (!contexto.trim()) {
    return `${base}\n\nCONTEXTO: chat general del dashboard del negocio de Martín. Ayudá con lo que pregunte; si te pega datos, analizalos.`;
  }
  return `${base}\n\nCONTEXTO: estás mirando el gráfico "${titulo}" del PROPIO negocio de Martín. Ya tenés los datos abajo, analizá directo.\n\nDATOS DEL GRÁFICO:\n${contexto}`;
}
