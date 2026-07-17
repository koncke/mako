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
import { faseNegocioTexto } from './fase-store';
import { searchKnowledge, formatKnowledge } from './mako-knowledge';
import { resumenExperimentos } from './experimentos';
import { META_RULES_TEXT } from './meta-rules';
import { getPromptText, renderPrompt } from './prompt-render';
import {
  MAKO_CTX_GENERAL_DEFAULT,
  MAKO_CTX_CHART_DEFAULT,
  MAKO_CTX_WHATSAPP_DEFAULT,
} from './prompt-defaults';

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

// Resumen del FUNNEL real del negocio (funnel_config del workspace), para que MaKo
// razone con las etapas CONFIGURADAS y no con un embudo genérico de memoria. Es la
// fuente de verdad del proceso comercial ([[funnel-fuente-de-verdad]]). Aditivo y
// resiliente: getFunnel cae a DEFAULT_PIPELINE si no hay fila, así que nunca queda
// vacío; con el funnel por defecto, el bloque describe el embudo base de siempre.
async function resumenFunnel(): Promise<string> {
  const { getFunnel } = await import('./leads');
  const { BAND_LABEL } = await import('./pipeline');
  const funnel = await getFunnel().catch(() => null);
  if (!funnel?.stages?.length) return '';
  const bandas: Array<'pipeline' | 'nutricion' | 'salidas'> = ['pipeline', 'nutricion', 'salidas'];
  const bloques = bandas.map((banda) => {
    const etapas = funnel.stages
      .filter((s) => (s.band ?? 'pipeline') === banda)
      .sort((a, b) => (a.col ?? 0) - (b.col ?? 0))
      .map((s) => (banda === 'pipeline' && s.kind ? `${s.label} (${s.kind})` : s.label));
    if (!etapas.length) return '';
    const sep = banda === 'pipeline' ? ' → ' : ', ';
    return `${BAND_LABEL[banda]}: ${etapas.join(sep)}`;
  }).filter(Boolean);
  return bloques.join('\n');
}

export async function buildSystemPrompt(opts: { chartKey: string; titulo: string; contexto: string; query: string }): Promise<string> {
  const { chartKey, titulo, contexto, query } = opts;

  const [persona, perfil, faseNegocio, fase, knowledge] = await Promise.all([
    getActivePersona().catch(() => ''),
    perfilNegocioTexto().catch(() => ''),
    faseNegocioTexto().catch(() => ''),
    getFaseInstruccion(chartKey).catch(() => ''),
    searchKnowledge(query, 4).catch(() => [] as Array<{ titulo: string; cuerpo: string }>),
  ]);

  // Núcleo de formato/tono: editable desde Configuraciones (default en código).
  const nucleo = await getPromptText('mako.nucleo', MAKO_NUCLEO);
  let base = `${persona}\n\n${nucleo}`.trim();
  if (perfil) base += `\n\nNEGOCIO DE MARTÍN (perfil del cliente):\n${perfil}`;
  // La FASE del negocio (diagnóstico de onboarding): es el Norte. MaKo prioriza
  // y aconseja según la etapa real — no le propone escalar a quien todavía no
  // convierte, ni high-ticket a quien no tiene tráfico.
  if (faseNegocio) base += `\n\nEN QUÉ FASE ESTÁ EL NEGOCIO (su Norte — priorizá según esto):\n${faseNegocio}`;
  if (fase) base += `\n\nQUÉ TENÉS QUE MIRAR Y HACER EN ESTA SECCIÓN:\n${fase}`;
  const know = formatKnowledge(knowledge);
  if (know) base += `\n\nTU METODOLOGÍA (lo más relevante a esta consulta):\n${know}`;

  // Experimentos: las verdades validadas (que MaKo SÍ puede afirmar) y lo que
  // sigue en prueba. Para todo lo no probado, MaKo sugiere abrir un experimento.
  const exps = await resumenExperimentos().catch(() => '');
  if (exps) base += `\n\nESTADO DE EXPERIMENTOS DEL NEGOCIO:\n${exps}`;

  // El funnel/proceso comercial real (funnel_config, editable en /funnel): que MaKo
  // razone con las etapas del workspace y no con un embudo genérico. Aditivo — con
  // el funnel default el prompt describe el embudo base de siempre.
  const funnelTxt = await resumenFunnel().catch(() => '');
  if (funnelTxt) base += `\n\nEL FUNNEL / PROCESO COMERCIAL DEL NEGOCIO (fuente de verdad, editable en /funnel):\n${funnelTxt}`;

  // Chat de secuencias de WhatsApp: sos consultor de deliverability. Cargás las
  // reglas de aprobación de Meta + las secuencias/plantillas reales del negocio.
  if (chartKey === 'whatsapp-secuencias') {
    const instruccion = await getPromptText('mako.context.whatsapp_consultor', MAKO_CTX_WHATSAPP_DEFAULT);
    const metaRules = await getPromptText('meta.rules.text', META_RULES_TEXT);
    base += `\n\n${instruccion}\n\n${metaRules}`;
    const resumen = await resumenSecuencias().catch(() => '');
    if (resumen) base += `\n\nESTADO ACTUAL DE LAS SECUENCIAS Y PLANTILLAS DEL NEGOCIO:\n${resumen}`;
  }

  if (!contexto.trim()) {
    const general = await getPromptText('mako.context.general_fallback', MAKO_CTX_GENERAL_DEFAULT);
    return `${base}\n\n${general}`;
  }
  const chartCtx = await renderPrompt('mako.context.chart_standard', MAKO_CTX_CHART_DEFAULT, { titulo, contexto });
  return `${base}\n\n${chartCtx}`;
}
