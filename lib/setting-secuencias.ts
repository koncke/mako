// =============================================================================
// setting-secuencias — fetch, estrategia y prueba en vivo de la tab /setting
// =============================================================================
// La ESTRATEGIA (lib/setting-estrategia.ts) vive en nutricion_secuencias.estrategia.
// Acá: getSecuencias (secuencias + estrategia + métricas 30d), guardarEstrategia,
// crearSecuenciaDesdeEtapa (wizard paso 1) y probarSecuencia (paso 6 — manda TODOS
// los pasos al contacto del admin, marcados [PRUEBA], SIN tocar inscripciones
// ni nutricion_envios: cero contaminación de KPIs y del guard anti-ban).

import 'server-only';
import { getTenantDb } from './workspace';
import { getSecuenciasConStats, type SecuenciaConStats } from './nutricion';
import { parseEstrategia, type Estrategia } from './setting-estrategia';
import { agregarMetricas, serieDiaria, METRICAS_CERO, type FilaEnvio, type FilaInsc, type MetricasSecuencia, type PuntoSerie } from './setting-metricas';
import { getContactoReportes } from './perfil';
import { getInstanciaRow } from './evolution';
import { enviarYEspejar, enviarAudioYEspejar } from './evolution-envio';
import { getAudio, audioBase64 } from './setting-audios';
import { sendEmail, renderEmailHtml, remitenteEsSandbox } from './resend';
import { aplicarVariables, valoresVariablesLead } from './template-vars';

export type SecuenciaConEstrategia = Omit<SecuenciaConStats, 'estrategia'> & { estrategia: Estrategia | null; metricas: MetricasSecuencia };

/** Secuencias + métricas 30d + la serie diaria del workspace (una sola pasada). */
export async function getSettingData(): Promise<{ secuencias: SecuenciaConEstrategia[]; serie: PuntoSerie[] }> {
  const supabase = await getTenantDb();
  const desde = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  const [secs, envios, inscs] = await Promise.all([
    getSecuenciasConStats(),
    supabase.from('nutricion_envios').select('secuencia_id, canal, estado, abierto_at, clic_at, created_at').gte('created_at', desde),
    supabase.from('nutricion_inscripciones').select('secuencia_id, estado, updated_at'),
  ]);
  const filasEnvio = (envios.data ?? []) as FilaEnvio[];
  const filasInsc = (inscs.data ?? []) as FilaInsc[];
  const met = agregarMetricas(filasEnvio, filasInsc);
  const secuencias = secs.map((s) => ({
    ...s,
    estrategia: parseEstrategia(s.estrategia),
    metricas: met.get(s.id) ?? { ...METRICAS_CERO },
  }));
  return { secuencias, serie: serieDiaria(filasEnvio, filasInsc, new Date().toISOString()) };
}

export async function getSecuencias(): Promise<SecuenciaConEstrategia[]> {
  return (await getSettingData()).secuencias;
}

export async function guardarEstrategia(secuenciaId: number, estrategia: Estrategia): Promise<void> {
  const supabase = await getTenantDb();
  const { data } = await supabase.from('nutricion_secuencias').select('id').eq('id', secuenciaId).maybeSingle();
  if (!data) throw new Error('Esa secuencia no existe en este workspace.');
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({ estrategia, updated_at: new Date().toISOString() })
    .eq('id', secuenciaId);
  if (error) throw new Error(`guardarEstrategia: ${error.message}`);
}

/**
 * Wizard paso 1: secuencia nueva colgada de una etapa del funnel (funnel-
 * agnóstica, trigger 'etapa_actual'). Nace PAUSADA con 2 pasos de esqueleto que
 * MaKo escribe en el paso 5; aprobar la prende.
 */
export async function crearSecuenciaDesdeEtapa(etapa: string, nombre: string): Promise<number> {
  const supabase = await getTenantDb();
  const clave = `secuencia-${etapa}-${Date.now().toString(36)}`;
  const pasos = [
    { orden: 1, canal: 'email', delay_horas: 24, asunto: '[MaKo lo escribe]', cuerpo: '[MaKo lo escribe en el paso de redacción]', template_wa: null },
    { orden: 2, canal: 'whatsapp', delay_horas: 48, asunto: null, cuerpo: '[MaKo lo escribe en el paso de redacción]', proveedor: 'no_oficial', template_wa: null },
  ];
  const { data, error } = await supabase
    .from('nutricion_secuencias')
    .insert({ clave, nombre, etapa, trigger_tipo: 'etapa_actual', activa: false, pasos })
    .select('id')
    .single();
  if (error) throw new Error(`crearSecuenciaDesdeEtapa: ${error.message}`);
  return (data as { id: number }).id;
}

// ── Prompts del wizard (editables en /configuraciones vía prompt-registry) ────

export const SETTING_GANCHO_TEMPLATE = `Sos MaKo armando una secuencia de mensajes de setting. El negocio: {{perfil}}.
Objetivo de la secuencia de mensajes: {{objetivo}}. Etapa del lead: {{etapa}}.
Proponé 3 GANCHOS concretos (lead magnet, oferta puntual, motivo de re-contacto) que este negocio puede ofrecer YA — nada genérico y nada de inventar recursos que no existen: derivalos del perfil. Máximo 15 palabras cada uno.
Devolvé EXCLUSIVAMENTE un objeto JSON con esta forma: {"sugerencias": ["...", "...", "..."]}`;

export const SETTING_CRITERIO_TEMPLATE = `Sos MaKo deduciendo el CRITERIO DE CALIFICACIÓN de un negocio a partir de sus datos reales. El negocio: {{perfil}}.

Esto es lo que pasó con los leads que ya fueron evaluados en su CRM (respuestas del formulario de agenda, si el dueño los marcó como calificados, y si cerraron):
{{datos}}

Deducí qué separa a un cliente ideal de uno que no sirve, y devolvelo como reglas que un setter pueda aplicar leyendo una conversación de WhatsApp.
Reglas: basate SOLO en los patrones que ves en los datos y en el perfil del negocio — no inventes umbrales de facturación ni de tamaño que no aparezcan. Si los datos no alcanzan para una regla, no la escribas. Cada regla en una frase corta y verificable en un chat.
Devolvé EXCLUSIVAMENTE un objeto JSON con esta forma: {"califica": ["...", "..."], "descalifica": ["...", "..."]}`;

export const SETTING_PREGUNTAS_TEMPLATE = `Sos MaKo armando la cualificación por WhatsApp de una secuencia de mensajes de setting. El negocio: {{perfil}}.
Objetivo: {{objetivo}}. Etapa del lead: {{etapa}}.
Proponé 4 PREGUNTAS de cualificación cerradas y cortas (responderlas toma menos de 15 segundos), en el orden en que un setter las haría, que separen a un lead calificado de uno que no. Sin preguntas obvias ni invasivas.
Devolvé EXCLUSIVAMENTE un objeto JSON con esta forma: {"sugerencias": ["...", "...", "...", "..."]}`;

// ── Criterio de calificación: MaKo lo deduce de los datos reales ─────────────
// En la reunión decidieron cancelar las llamadas de los no calificados, pero
// NUNCA definieron el criterio: vive en la cabeza de Mauricio. Esto lo saca de
// donde sí hay evidencia — los leads que el dueño YA marcó calificado/no, con
// las respuestas de su formulario de agenda y el desenlace.

export type MuestraCalificacion = {
  calificado: boolean | null; cerro: boolean | null;
  respuesta_facturacion: string | null; respuesta_colaboradores: string | null;
  respuesta_objetivo: string | null; respuesta_inversion: string | null; respuesta_decisor: string | null;
};

/** Los leads ya evaluados del workspace, para que MaKo deduzca el patrón. */
export async function muestraParaCriterio(limite = 60): Promise<MuestraCalificacion[]> {
  const supabase = await getTenantDb();
  const cols = 'calificado, cerro, respuesta_facturacion, respuesta_colaboradores, respuesta_objetivo, respuesta_inversion, respuesta_decisor';
  const [evaluados, cerrados] = await Promise.all([
    supabase.from('leads').select(cols).not('calificado', 'is', null).limit(limite),
    // Los que cerraron son la evidencia más fuerte de "cliente ideal", aunque
    // nadie los haya marcado a mano.
    supabase.from('leads').select(cols).eq('cerro', true).limit(limite),
  ]);
  const filas = [...((evaluados.data ?? []) as MuestraCalificacion[]), ...((cerrados.data ?? []) as MuestraCalificacion[])];
  // Dedup por combinación de respuestas + desenlace (sin id no hay clave mejor).
  const vistos = new Set<string>();
  return filas.filter((f) => {
    const k = JSON.stringify(f);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** Texto compacto de la muestra para el prompt (evita mandar JSON crudo enorme). */
export function muestraATexto(filas: MuestraCalificacion[]): string {
  if (!filas.length) return '(el CRM todavía no tiene leads marcados como calificados o cerrados)';
  const linea = (f: MuestraCalificacion) => [
    f.calificado === true ? 'CALIFICADO' : f.calificado === false ? 'NO CALIFICADO' : 'sin marcar',
    f.cerro === true ? 'cerró' : f.cerro === false ? 'no cerró' : null,
    f.respuesta_facturacion ? `factura: ${f.respuesta_facturacion}` : null,
    f.respuesta_colaboradores ? `equipo: ${f.respuesta_colaboradores}` : null,
    f.respuesta_inversion ? `inversión: ${f.respuesta_inversion}` : null,
    f.respuesta_decisor ? `decisor: ${f.respuesta_decisor}` : null,
    f.respuesta_objetivo ? `objetivo: ${String(f.respuesta_objetivo).slice(0, 90)}` : null,
  ].filter(Boolean).join(' · ');
  const si = filas.filter((f) => f.calificado === true).length;
  const no = filas.filter((f) => f.calificado === false).length;
  return `Resumen: ${si} calificados, ${no} no calificados, ${filas.filter((f) => f.cerro === true).length} cerraron.\n\n${filas.map((f) => `- ${linea(f)}`).join('\n')}`;
}

// ── Prueba en vivo ───────────────────────────────────────────────────────────

export type ResultadoPrueba =
  | { ok: true; enviadosWa: number; enviadosEmail: number; avisos: string[] }
  | { ok: false; error: string };

export async function probarSecuencia(secuenciaId: number): Promise<ResultadoPrueba> {
  const secs = await getSecuenciasConStats();
  const sec = secs.find((s) => s.id === secuenciaId);
  if (!sec) return { ok: false, error: 'Esa secuencia no existe en este workspace.' };
  if (!sec.pasos.length) return { ok: false, error: 'La secuencia no tiene pasos para probar.' };

  const contacto = await getContactoReportes();
  if (!contacto.telefono && !contacto.email) {
    return { ok: false, error: 'Cargá tu teléfono y email en Perfil para recibir la prueba.' };
  }

  const avisos: string[] = [];
  let enviadosWa = 0;
  let enviadosEmail = 0;
  const total = sec.pasos.length;
  const vars = valoresVariablesLead({ nombre: contacto.nombre || 'Prueba' });

  const [inst, sandbox] = await Promise.all([getInstanciaRow(), remitenteEsSandbox()]);
  const evoConectada = inst?.estado === 'conectado';

  for (const paso of sec.pasos) {
    const cuerpo = `[PRUEBA ${paso.orden}/${total}] ${aplicarVariables(paso.cuerpo, vars)}`;
    if (paso.canal === 'whatsapp') {
      if (!contacto.telefono) { avisos.push(`Paso ${paso.orden}: sin teléfono en Perfil, no se probó.`); continue; }
      if (!evoConectada) { avisos.push('WhatsApp de empresa sin conectar: los pasos de WhatsApp no se probaron.'); continue; }
      // Paso de nota de voz: te llega el audio de verdad, como al lead.
      if (paso.tipo === 'audio' && Number(paso.audio_id) > 0) {
        const audio = await getAudio(Number(paso.audio_id));
        const b64 = audio ? await audioBase64(audio) : null;
        if (!audio || !b64) { avisos.push(`Paso ${paso.orden}: no pude bajar el audio «${audio?.titulo ?? paso.audio_id}».`); continue; }
        const ra = await enviarAudioYEspejar({ telefono: contacto.telefono, base64: b64, mimetype: audio.media_mime });
        if (ra.ok) enviadosWa += 1; else avisos.push(`Paso ${paso.orden} (audio): ${ra.error ?? 'no salió'}`);
        continue;
      }
      const r = await enviarYEspejar({ telefono: contacto.telefono, texto: cuerpo });
      if (r.ok) enviadosWa += 1; else avisos.push(`Paso ${paso.orden} (WhatsApp): ${r.error ?? 'no salió'}`);
    } else {
      if (!contacto.email) { avisos.push(`Paso ${paso.orden}: sin email en Perfil, no se probó.`); continue; }
      if (sandbox) { avisos.push('Remitente sandbox: verificá tu dominio para probar los emails.'); continue; }
      const asunto = `[PRUEBA] ${aplicarVariables(paso.asunto ?? '(sin asunto)', vars)}`;
      const r = await sendEmail({ to: contacto.email, subject: asunto, html: renderEmailHtml({ subject: asunto, bodyText: cuerpo }), text: cuerpo });
      if (r.ok) enviadosEmail += 1; else avisos.push(`Paso ${paso.orden} (email): ${r.error ?? 'no salió'}`);
    }
  }

  if (enviadosWa + enviadosEmail === 0) {
    return { ok: false, error: `No se pudo enviar ningún paso de prueba. ${avisos.join(' ')}`.trim() };
  }

  // Registrar la prueba SOLO si la secuencia ya tiene secuencia definida (merge).
  const est = parseEstrategia(sec.estrategia);
  if (est) {
    try { await guardarEstrategia(secuenciaId, { ...est, probada_at: new Date().toISOString() }); }
    catch { avisos.push('La prueba salió pero no se pudo registrar probada_at.'); }
  }

  return { ok: true, enviadosWa, enviadosEmail, avisos };
}
