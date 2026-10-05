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
import { leerTodo, type ConsultaPaginada } from './supabase-paginado';
import { getSecuenciasConStats, type SecuenciaConStats } from './nutricion';
import { TRIGGER_ETAPA, TRIGGER_ENTREGA } from './nutricion-etapa';
import { sanearCron, proximaOcurrencia } from './cron-aviso';
import { tzActual, TZ_DEFAULT } from './timezone';
import { listarFunnels, getFunnelDe, getFunnelDefault, productoDeFunnel } from './funnels';
import { entregasDeProductos } from './entrega-servicio';
import type { EntregaConfig } from './servicio-etapas';
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
  // Paginado por `id`. Eran dos `.select()` sueltos: nutricion_envios suma hasta
  // 40 filas por día por workspace, así que la ventana de 30 días cruza las 1000
  // en semanas, y la tabla de inscripciones se lee ENTERA. Pasado el techo,
  // PostgREST devuelve 1000 y un 200: las métricas y la serie diaria de /setting
  // salían calculadas sobre una muestra, sin ningún aviso.
  const [secs, filasEnvio, filasInsc] = await Promise.all([
    getSecuenciasConStats(),
    leerTodo<FilaEnvio>(supabase, 'nutricion_envios', 'secuencia_id, canal, estado, abierto_at, clic_at, created_at', {
      orden: 'id', filtros: (q) => q.gte('created_at', desde) as ConsultaPaginada,
    }),
    leerTodo<FilaInsc>(supabase, 'nutricion_inscripciones', 'secuencia_id, estado, updated_at', { orden: 'id' }),
  ]);
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

/**
 * Renombrar una secuencia.
 *
 * ⚠️ CAMBIA EL NOMBRE, NUNCA LA CLAVE. La `clave` es con lo que el desenlace de OTRA
 * secuencia la nombra (`logradoSecuencia`), así que renombrarla rompería el encadenado
 * en silencio — es la regla de la casa sobre referenciar por nombre, y acá ya la
 * pagamos una vez con el nodo «Sigue con» dibujado roto.
 */
/**
 * EL HORARIO DE UNA SECUENCIA: la mitad «por tiempo» del disparador (mig 0192).
 *
 * `null` la devuelve a disparar POR UNA ACCIÓN, que es lo que hacen hoy las 62 filas.
 *
 * ⚠️ LA ZONA SE RESUELVE ACÁ Y LA PRÓXIMA OCURRENCIA SE SIEMBRA ACÁ, igual que en
 * `lib/avisos-programados.ts` y por el mismo motivo: el motor itera workspaces con el
 * `ws` por parámetro, así que resolver la zona ahí sería preguntarle al inquilino del
 * CONTEXTO —que para un cron es el dueño— y el horario de cada cliente se movería solo
 * el día que `tzDeWorkspace` contestara otra cosa.
 *
 * ⚠️ Y SE SIEMBRA SIN DISPARAR. `decidirAgenda` devuelve `toca: false` cuando siembra,
 * pero sembrar desde acá es mejor: si el horario naciera sin ocurrencia, la primera
 * corrida del cron la escribiría y la persona tendría que esperar DOS ciclos para ver
 * algo. Poner un horario tampoco dispara en el momento: la primera ocurrencia es
 * estrictamente posterior a ahora (`proximaOcurrencia`).
 */
export async function setCronSecuencia(secuenciaId: number, cron: unknown): Promise<void> {
  const c = cron == null ? null : sanearCron(cron);
  if (cron != null && !c) throw new Error('Ese horario no se entiende: elegí la unidad de la lista.');
  const supabase = await getTenantDb();
  const ahora = new Date();
  const tz = c ? await tzActual().catch(() => TZ_DEFAULT) : TZ_DEFAULT;
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({
      cron: c,
      cron_proxima_at: c ? proximaOcurrencia(c, ahora, tz, ahora).toISOString() : null,
      updated_at: ahora.toISOString(),
    })
    .eq('id', secuenciaId);
  if (error) throw new Error(`setCronSecuencia: ${error.message}`);
}

export async function renombrarSecuencia(secuenciaId: number, nombre: string): Promise<void> {
  const n = (nombre ?? '').trim();
  if (!n) throw new Error('El nombre no puede quedar vacío.');
  const supabase = await getTenantDb();
  const { error } = await supabase
    .from('nutricion_secuencias')
    .update({ nombre: n.slice(0, 120), updated_at: new Date().toISOString() })
    .eq('id', secuenciaId);
  if (error) throw new Error(`renombrarSecuencia: ${error.message}`);
}

/**
 * Los PRODUCTOS del workspace con las etapas de cada uno, para el desplegable del
 * disparador. Un producto es un embudo (mig 0170/0171) y sus etapas son las que el
 * dueño configuró en /funnel, así que esto no inventa un catálogo: lee el que ya hay.
 *
 * ⚠️ EL NOMBRE QUE SE MUESTRA ES EL DEL PRODUCTO, NO EL DEL EMBUDO. «Funnel principal»
 * lo escribió la migración y es igual en todos los workspaces: quien mira piensa en su
 * producto. Es la misma lección que ya está escrita en `FunnelResumen.producto`.
 *
 * Las etapas de SALIDA (band 'salidas': perdido, descalificado) no se ofrecen: colgar
 * una secuencia de mensajes de «perdido» es escribirle a quien dijo que no.
 */
export type ProductoConEtapas = {
  funnelId: number;
  /** El id del PRODUCTO, que no es el del embudo. `null` = ese embudo no vende uno. */
  productoId: number | null;
  nombre: string;
  esDefault: boolean;
  /** Las etapas del EMBUDO: por dónde pasa el lead antes de comprar. */
  etapas: Array<{ value: string; label: string }>;
  /**
   * Las etapas de la ENTREGA del servicio (mig 0188): por dónde pasa el CLIENTE
   * después de comprar. Vacío si ese embudo no tiene producto.
   *
   * ⚠️ `origenEntrega: 'default'` significa que el cliente todavía NO configuró sus
   * etapas y está viendo las de fábrica. Colgar una secuencia de una de esas es
   * legítimo —son las que su kanban dibuja hoy— pero el día que las edite, la clave
   * puede dejar de existir: `nuevaClaveEtapa` nunca reusa una borrada, así que la
   * secuencia queda apuntando a NINGUNA etapa, que es lo correcto y se puede detectar.
   */
  etapasEntrega: Array<{ value: string; label: string }>;
  origenEntrega: 'declarado' | 'default' | null;
};

export async function productosConEtapas(): Promise<ProductoConEtapas[]> {
  const funnels = await listarFunnels();
  const delFunnel = await productoDeFunnel(funnels.map((f) => f.id))
    .catch(() => new Map<number, { id: number; nombre: string }>());
  const entregas = await entregasDeProductos([...delFunnel.values()].map((p) => p.id))
    .catch(() => new Map<number, EntregaConfig>());
  const out: ProductoConEtapas[] = [];
  for (const f of funnels) {
    // El default se lee con `getFunnelDefault` (es el camino que ya cachea la pantalla);
    // el resto por id. Son pocas filas —6 en producción— y se piden una vez por carga.
    const cfg = f.esDefault ? await getFunnelDefault().catch(() => null) : await getFunnelDe(f.id).catch(() => null);
    const prod = delFunnel.get(f.id) ?? null;
    const entrega = prod ? entregas.get(prod.id) ?? null : null;
    out.push({
      funnelId: f.id,
      productoId: prod?.id ?? null,
      nombre: f.producto ?? f.nombre,
      esDefault: f.esDefault,
      etapas: (cfg?.stages ?? [])
        .filter((st) => (st.band ?? 'pipeline') !== 'salidas')
        .map((st) => ({ value: st.key, label: st.label })),
      etapasEntrega: (entrega?.etapas ?? []).map((et) => ({ value: et.key, label: et.label })),
      origenEntrega: entrega?.origen ?? null,
    });
  }
  return out;
}

/**
 * «Si un lead cae en ESTA etapa de ESTE producto, disparate» — el disparador de una
 * secuencia, elegido por el dueño.
 *
 * Pedido de Martín (05/10/2026): «esto debería leer eso y que el usuario pueda elegir que
 * si cae en dicha etapa, se dispare esa secuencia». Antes la etapa se fijaba al CREAR la
 * secuencia y no se podía cambiar, y el producto no se podía elegir nunca: las 62 filas de
 * producción tienen `funnel_id` NULL, o sea «todos los productos», porque ninguna pantalla
 * ofrecía el dato.
 *
 * ⚠️ VALIDA QUE LA ETAPA EXISTA EN ESE PRODUCTO, Y NO ES UN LUJO. Una etapa de otro embudo
 * es una combinación imposible: la secuencia queda colgada de una key que ese funnel no
 * tiene y no dispara NUNCA — sin error, sin aviso, y leyéndose como «la secuencia no
 * funciona». La regla de la casa es que eso se ataja al guardar y no en el log de un cron.
 *
 * `funnelId = null` es «todos los productos», y es una elección explícita del dueño: la
 * secuencia le aplica a cualquier lead que caiga en una etapa con esa key.
 */
export async function setDisparadorEtapa(secuenciaId: number, etapa: string, funnelId: number | null): Promise<void> {
  const key = (etapa ?? '').trim();
  if (!key) throw new Error('Elegí la etapa que dispara la secuencia.');

  const productos = await productosConEtapas();
  if (funnelId == null) {
    // «Todos los productos»: la etapa tiene que existir en ALGUNO, o es una key muerta.
    const existe = productos.some((pr) => pr.etapas.some((e) => e.value === key));
    if (!existe) throw new Error(`La etapa «${key}» no existe en ninguno de tus productos.`);
  } else {
    const pr = productos.find((x) => x.funnelId === funnelId);
    if (!pr) throw new Error('Ese producto no existe o está archivado.');
    if (!pr.etapas.some((e) => e.value === key)) {
      throw new Error(`«${key}» no es una etapa de ${pr.nombre}: elegí una de las suyas.`);
    }
  }

  const supabase = await getTenantDb();
  const { error } = await supabase
    .from('nutricion_secuencias')
    // `producto_id` se limpia por lo mismo que allá se limpia `funnel_id`.
    .update({ trigger_tipo: TRIGGER_ETAPA, etapa: key, funnel_id: funnelId, producto_id: null, updated_at: new Date().toISOString() })
    .eq('id', secuenciaId);
  if (error) throw new Error(`setDisparadorEtapa: ${error.message}`);
}

/**
 * «Si un CLIENTE llega a ESTA etapa de la entrega de ESTE producto, disparate».
 *
 * Es la hermana de `setDisparadorEtapa` y es una función aparte, no un parámetro más:
 * son dos disparadores distintos (`etapa_actual` / `entrega_actual`) que escriben dos
 * columnas distintas (`funnel_id` / `producto_id`) porque el ámbito de uno es el embudo
 * y el del otro el producto. El porqué entero, en lib/nutricion-etapa.ts.
 *
 * ⚠️ EL PRODUCTO NO ES OPCIONAL ACÁ. En la venta, `funnel_id` NULL significa «todos los
 * embudos» y es el estado de las 62 filas de hoy; en la entrega, una etapa suelta no
 * quiere decir nada sin el producto —«hito 2» es de UN servicio— y el motor directamente
 * no enrola sin él (`secuenciasDeEntrega` devuelve [] con el producto vacío). Ofrecer
 * «todos los productos» acá sería ofrecer una configuración que no dispara nunca.
 */
export async function setDisparadorEntrega(secuenciaId: number, etapa: string, productoId: number): Promise<void> {
  const key = (etapa ?? '').trim();
  if (!key) throw new Error('Elegí la etapa de la entrega que dispara la secuencia.');
  if (!Number.isFinite(productoId) || productoId <= 0) throw new Error('Elegí de qué producto es la entrega.');

  const pr = (await productosConEtapas()).find((x) => x.productoId === productoId);
  if (!pr) throw new Error('Ese producto no existe o está archivado.');
  if (!pr.etapasEntrega.some((e) => e.value === key)) {
    throw new Error(`«${key}» no es una etapa de la entrega de ${pr.nombre}: elegí una de las suyas.`);
  }

  const supabase = await getTenantDb();
  const { error } = await supabase
    .from('nutricion_secuencias')
    // `funnel_id` se LIMPIA: una secuencia es de venta o es de entrega, y dejar el
    // embudo puesto deja un ámbito viejo escrito al lado del nuevo.
    .update({ trigger_tipo: TRIGGER_ENTREGA, etapa: key, producto_id: productoId, funnel_id: null, updated_at: new Date().toISOString() })
    .eq('id', secuenciaId);
  if (error) throw new Error(`setDisparadorEntrega: ${error.message}`);
}

// ── Prompts del wizard (editables en /configuraciones vía prompt-registry) ────

export const SETTING_GANCHO_TEMPLATE = `Eres MaKo armando una secuencia de mensajes de setting. El negocio: {{perfil}}.
Objetivo de la secuencia de mensajes: {{objetivo}}. Etapa del lead: {{etapa}}.
Propón 3 GANCHOS concretos (lead magnet, oferta puntual, motivo de re-contacto) que este negocio puede ofrecer YA — nada genérico y nada de inventar recursos que no existen: derívalos del perfil. Máximo 15 palabras cada uno.
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma: {"sugerencias": ["...", "...", "..."]}`;

export const SETTING_CRITERIO_TEMPLATE = `Eres MaKo deduciendo el CRITERIO DE CALIFICACIÓN de un negocio a partir de sus datos reales. El negocio: {{perfil}}.

Esto es lo que pasó con los leads que ya fueron evaluados en su CRM (respuestas del formulario de agenda, si el dueño los marcó como calificados, y si cerraron):
{{datos}}

Deduce qué separa a un cliente ideal de uno que no sirve, y devuélvelo como reglas que un setter pueda aplicar leyendo una conversación de WhatsApp.
Reglas: básate SOLO en los patrones que ves en los datos y en el perfil del negocio — no inventes umbrales de facturación ni de tamaño que no aparezcan. Si los datos no alcanzan para una regla, no la escribas. Cada regla en una frase corta y verificable en un chat.
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma: {"califica": ["...", "..."], "descalifica": ["...", "..."]}`;

export const SETTING_PREGUNTAS_TEMPLATE = `Eres MaKo armando la cualificación por WhatsApp de una secuencia de mensajes de setting. El negocio: {{perfil}}.
Objetivo: {{objetivo}}. Etapa del lead: {{etapa}}.
Propón 4 PREGUNTAS de cualificación cerradas y cortas (responderlas toma menos de 15 segundos), en el orden en que un setter las haría, que separen a un lead calificado de uno que no. Sin preguntas obvias ni invasivas.
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma: {"sugerencias": ["...", "...", "...", "..."]}`;

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
    return { ok: false, error: 'Carga tu teléfono y email en Perfil para recibir la prueba.' };
  }

  const avisos: string[] = [];
  let enviadosWa = 0;
  let enviadosEmail = 0;
  const total = sec.pasos.length;
  const vars = valoresVariablesLead({ nombre: contacto.nombre || 'Prueba' });

  const [inst, sandbox] = await Promise.all([getInstanciaRow(), remitenteEsSandbox()]);
  const evoConectada = inst?.estado === 'conectado';

  // ⚠️ EL NÚMERO CAÍDO SE CONTESTA ANTES DEL BUCLE, Y UNA SOLA VEZ.
  // Estaba adentro, así que una secuencia de dos pasos de WhatsApp devolvía la
  // MISMA frase dos veces pegada («…no se probaron. WhatsApp de empresa sin
  // conectar: los pasos de WhatsApp no se probaron.»), y ninguna de las dos
  // decía qué hacer ni dónde. Es la regla de «un mensaje de error dice DE QUIÉN
  // fue y QUÉ HACER»: la culpa no es de la secuencia ni de MaKo —está bien
  // armada—, es que la sesión de WhatsApp se cayó, y eso se arregla en un solo
  // lugar. Sin el link, quien lo lee concluye que el producto está roto.
  //
  // Se sale temprano solo si NO hay nada más que probar: una secuencia con un
  // paso de email sí se puede probar a medias, y frenar eso sería cobrarle al
  // email un problema del WhatsApp.
  if (!evoConectada && sec.pasos.every((p) => p.canal === 'whatsapp')) {
    const desde = inst?.ultima_conexion_at
      ? ` (se desconectó el ${new Date(inst.ultima_conexion_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })})`
      : '';
    return {
      ok: false,
      error: inst
        ? `Tu WhatsApp está desconectado${desde}, así que no se pudo mandar la prueba. La secuencia está bien: vuelve a vincular tu número en Configuración → WhatsApp y prueba de nuevo.`
        : 'Todavía no vinculaste tu WhatsApp, así que no hay desde dónde mandar la prueba. Conéctalo en Configuración → WhatsApp.',
    };
  }

  for (const paso of sec.pasos) {
    const cuerpo = `[PRUEBA ${paso.orden}/${total}] ${aplicarVariables(paso.cuerpo, vars)}`;
    if (paso.canal === 'whatsapp') {
      if (!contacto.telefono) { avisos.push(`Paso ${paso.orden}: sin teléfono en Perfil, no se probó.`); continue; }
      if (!evoConectada) { avisos.push('Tu WhatsApp está desconectado: esos pasos no se probaron (vuelve a vincularlo en Configuración → WhatsApp).'); continue; }
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
      if (sandbox) { avisos.push('Remitente sandbox: verifica tu dominio para probar los emails.'); continue; }
      const asunto = `[PRUEBA] ${aplicarVariables(paso.asunto ?? '(sin asunto)', vars)}`;
      const r = await sendEmail({ to: contacto.email, subject: asunto, html: renderEmailHtml({ subject: asunto, bodyText: cuerpo }), text: cuerpo });
      if (r.ok) enviadosEmail += 1; else avisos.push(`Paso ${paso.orden} (email): ${r.error ?? 'no salió'}`);
    }
  }

  if (enviadosWa + enviadosEmail === 0) {
    // `[...new Set()]`: los avisos se acumulan POR PASO, así que sin esto una
    // secuencia de tres pasos con la misma causa devuelve la misma frase tres
    // veces. Repetir un motivo no lo hace más claro: lo hace parecer tres
    // problemas distintos.
    return { ok: false, error: `No se pudo enviar ningún paso de prueba. ${[...new Set(avisos)].join(' ')}`.trim() };
  }

  // Registrar la prueba SOLO si la secuencia ya tiene secuencia definida (merge).
  const est = parseEstrategia(sec.estrategia);
  if (est) {
    try { await guardarEstrategia(secuenciaId, { ...est, probada_at: new Date().toISOString() }); }
    catch { avisos.push('La prueba salió pero no se pudo registrar probada_at.'); }
  }

  return { ok: true, enviadosWa, enviadosEmail, avisos };
}
