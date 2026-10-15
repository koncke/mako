// =============================================================================
// api-mako/areas/chatbot.run — los cuerpos del área `chatbot`
// =============================================================================
// Un runner por id de chatbot.def.ts. Lecturas: { leer }. Acciones: { preparar,
// ejecutar }; las heredadas de lib/mako-doer-acciones.ts se ENVUELVEN (siete tests
// leen ese archivo por regex: los cuerpos no se mudan). Todo corre adentro de
// runWithWorkspace(ctx.ws): las libs que usan getTenantDb scopean solas.
//
// ⚠️ NADA ESCRIBE EN leer() NI EN preparar(). La pantalla genérica /mako/revisar
// guarda el INPUT y al confirmar vuelve a llamar preparar(input): por eso cada
// preparar acepta exactamente los `parametros` declarados y revalida contra la base.
// =============================================================================

import 'server-only';
import type { Ctx, Runners, SalidaLectura } from '../tipos';
import { crearRunnerAcciones, ejecutarAccion } from '@/lib/mako-doer-acciones';
import { getSecuenciasConStats, setSecuenciaPasos, planificarInscripciones, planificarEnvios, inscribirEnSecuencia, PasosInvalidosError, type PasoSecuencia, type InscripcionManual } from '@/lib/nutricion';
import { motivoNoInscribe } from '@/lib/nutricion-inscripcion-manual';
import { esPasoAccion } from '@/lib/nutricion-paso-accion';
import { claseDe, idDe, siguienteDe, raizRespuesta, esPasoIA, medioDe, juntarPasosIA, nodoPorId, type PasoGrafo } from '@/lib/flujo-grafo';
import { libertadDeCaso, ROTULO_LIBERTAD } from '@/lib/ai-step-libertad';
import { libertadDeLoDemas } from '@/lib/ai-step-armar';
import { esLineal, esNodoDeControl, relinear, tieneTarjetasDeControl, agregarCasoAlGrafo } from '@/lib/nutricion-grafo-motor';
import { getAdjunto } from '@/lib/setting-adjuntos';
import { emitirAviso } from '@/lib/avisos';
import { linkApp } from '@/lib/app-url';
import { valoresVariablesLead } from '@/lib/template-vars';
import { valoresDeVariables } from '@/lib/variables-resolver';
import { textoConDatos } from '@/lib/variables-del-lead';
import { prepararDisparadores, guardarDisparadores } from '@/lib/disparadores-guardar';
import { firmaLista, eventosDe, esClaseDeEventos, claseDeDisparador, TRIGGER_SOLO_GRUPO, type Disparador } from '@/lib/disparadores';
import { textoCron } from '@/lib/cron-aviso';
import { TRIGGERS } from '@/lib/email-marketing';
import { getTenantDb } from '@/lib/workspace';
import { logLeadEvent } from '@/lib/leads';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { PREFIJO_FLUJO } from '../canal';
import { proveedorDelPaso } from '@/lib/nutricion-canal';
import { partesExplicitas, pasosUsanAudio, problemaDePartes, sanearPartes } from '@/lib/mensaje-partes';
import { partesDeMako, esTarjetaTalCual, armarAvisoDeTarjeta, resultadoDelAviso, textoDePreparadas, type PartePreparada } from '@/lib/mako-tarjeta';
import { prepararPartesGrupo, problemaDePartesGrupo } from '@/lib/mako-tarjeta-envio';
import { getSettingData, guardarEstrategia, probarSecuencia, escenarioDePrueba, muestraParaCriterio, productosConEtapas, TriggerInvalidoError } from '@/lib/setting-secuencias';
import { escenariosDeLaSecuencia } from '@/lib/simulador-grafo';
import {
  PLANTILLAS, plantillaPorId, canalesDe, eleccionEnPalabras, CANALES_PLANTILLA, OBJETIVOS_PLANTILLA, type PlantillaAutomatizacion,
} from '@/lib/plantillas-automatizaciones';
import { crearDesdePlantilla, motivoDePlantillaVieja, PlantillaInvalidaError, type DbPlantilla } from '@/lib/plantilla-crear';
import { listarEtiquetas } from '@/lib/etiquetas';
import { crearFlujoConIA, hayIAParaCrear, armarContexto } from '@/lib/flujo-ia-crear';
import { preguntaAntes, preguntaParaWhatsApp, respuestaDeTexto, sanearRespuestas } from '@/lib/flujo-ia-preguntas';
import { TOPE_RONDAS, type RespuestaMako } from '@/lib/automatizacion-chat';
import { falloDeIA } from '@/lib/flujo-ia';
import { parseEstrategia, OBJETIVOS, type Estrategia, type EscenarioSecuencia } from '@/lib/setting-estrategia';
import { huecosDeSecuencias, archivarSecuencias } from '@/lib/secuencias-huecos';
import { handoffsPendientes, resolverHandoff } from '@/lib/chat-agent-handoff';
import { contextoDe } from '@/lib/etapas-contexto';
import { listAudios, audioUrlFirmada, getAudio, borrarAudio } from '@/lib/setting-audios';
import { audiosDe, guionDe, esPublico, KEY_PUBLICO, KEY_LINK_VIDEO } from '@/lib/audios-paso';
import { escenariosDe } from '@/lib/chat-agent-escenarios';
import { getEvidencia, getManual, huecosDeVoz } from '@/lib/chat-agent-voz';
import { getVozGuia, destilarVoz } from '@/lib/nutricion-generator';
import { responderSimulador, evaluarCalificacion, type TurnoSim } from '@/lib/setting-simulador';
import { getEstadoTab, tabOnboardingDef, reabrirOnboardingTab, TAB_ONBOARDINGS } from '@/lib/tab-onboarding-state';
import { getEntregables } from '@/lib/entregable';
import { estadoPlantillasSecuencia, plantillaDesdePaso } from '@/lib/nutricion-plantillas';
import { armarSecuenciasDeAudios } from '@/lib/secuencias-audios';
import { getContactoReportes } from '@/lib/perfil';
import { getSetting, setSetting } from '@/lib/settings';
import { getFunnelDefault } from '@/lib/funnels';
import {
  secuenciaFila, inscripcionesVivas, handoffFila, inscripcionesDeLead, TOPE_INSCRIPCIONES_LEAD,
  estadoCanalWhatsapp, etapasParaSecuencia, leerObjetivosCustom, esObjetivoDelCatalogo, agregarObjetivoCustom, TOPE_OBJETIVOS_CUSTOM,
  leerAudiosPorClave, asignarAudioAClave, quitarAudioDeClaves, insumosAudios, leerEnsayo, crearLeadMagnet,
  responderHuecosVoz, CLAVES_BLOQUE_VOZ, secuenciasArchivadas, TOPE_ARCHIVADAS, desarchivarYPausar, secuenciasChatAgent,
} from './chatbot.helpers';

// ── utilidades ───────────────────────────────────────────────────────────────

const legado = (ctx: Ctx) => crearRunnerAcciones(ctx.ws, ctx.canalKey, ctx.turnStart ?? 0, ctx.mensajeUsuario ?? '');
const texto = async (p: Promise<string | { content: string; isError?: boolean }>) => { const r = await p; return typeof r === 'string' ? r : r.content; };
const json = (x: unknown): string => JSON.stringify(x);
const errorLectura = (msg: string): SalidaLectura => ({ content: msg, isError: true });
const num = (input: Record<string, unknown>, k: string): number => Number(input[k]);
const str = (input: Record<string, unknown>, k: string): string => (typeof input[k] === 'string' ? (input[k] as string).trim() : '');

// Hasta el 17/09 acá había un `avisoTope()` que contaba las filas reales y avisaba
// «los conteos quedan CORTOS» porque getSecuenciasConStats, getSettingData y
// planificarInscripciones/Envios leían sin paginar. Las cuatro paginan ahora, así
// que el aviso pasó a ser falso y se sacó: un aviso que miente enseña a ignorar
// los que no mienten. Si una lectura vuelve a cortar, se arregla la lectura.

const ventana30 = () => {
  const hasta = new Date();
  return { desde: new Date(hasta.getTime() - 30 * 86400 * 1000).toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10), dias: 30 };
};

/** Las situaciones de audio que armarSecuenciasDeAudios (lib/secuencias-audios.ts) convierte en secuencia,
 *  con la clave de la secuencia que arma. Las otras claves del catálogo no las consume. */
const AUDIO_A_SECUENCIA: Record<string, string> = {
  bienvenida: 'chat-agent-bienvenida',
  agenda_con_bienvenida: 'chat-agent-post-agenda-conocido',
  agenda_primer_contacto: 'chat-agent-post-agenda-nuevo',
};

async function secuenciaVigente(id: number) {
  return (await getSecuenciasConStats()).find((s) => s.id === id) ?? null;
}

const noExiste = (id: number) => `No existe la secuencia #${id} vigente en este negocio (puede estar archivada). Pide el id con listar_secuencias_nutricion.`;

const historialDe = (input: Record<string, unknown>): TurnoSim[] =>
  (Array.isArray(input.historial) ? (input.historial as Array<Record<string, unknown>>) : [])
    .filter((t) => (t.de === 'lead' || t.de === 'negocio') && typeof t.texto === 'string' && t.texto.trim())
    .map((t) => ({ de: t.de as TurnoSim['de'], texto: String(t.texto) }))
    .slice(-30);

/** Por qué no se inscribe, en la frase que lee la persona: sale de lib/nutricion-inscripcion-manual.ts
 *  (puro, con test), incluido el id que no es de este negocio. */
const noSeInscribe = (v: Extract<InscripcionManual, { inscribe: false }>, leadId: number, secuenciaId: number): string =>
  motivoNoInscribe(v.porque, { secuenciaId, secuencia: v.secuencia?.nombre, leadId, lead: v.lead?.nombre });

/**
 * El lead de un aviso al equipo, de ESTE negocio (getTenantDb). Un error de lectura TIRA: «no pude leer»
 * no es «no existe». Trae el nombre CRUDO y la empresa para las variables del mensaje (`{{nombre}}`,
 * `{{empresa}}`…), que la tarjeta MAKO ofrece insertar.
 */
async function leadDelAviso(leadId: number): Promise<{ id: number; nombre: string; nombreCrudo: string | null; empresa: string | null; telefono: string | null } | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id, nombre, telefono, empresa').eq('id', leadId).maybeSingle();
  if (error) throw new Error(`avisar_al_equipo (lead): ${error.message}`);
  const l = data as { id: number; nombre: string | null; telefono: string | null; empresa: string | null } | null;
  return l ? {
    id: Number(l.id), nombre: l.nombre?.trim() || `el lead #${l.id}`, nombreCrudo: l.nombre?.trim() || null,
    empresa: l.empresa?.trim() || null, telefono: l.telefono ?? null,
  } : null;
}

/**
 * Los datos «{ }» en el mensaje y el título de un aviso al EQUIPO (la tarjeta MAKO EN WHATSAPP del lienzo).
 *
 * ⚠️ DESDE LA SEXTA TANDA, CON EL CATÁLOGO ENTERO (`valoresDeVariables`, lib/variables-resolver.ts, destino
 * 'equipo'): la tarjeta ofrece el árbol de `datosOfrecidos({ destino: 'equipo' })` —la etapa, la reunión,
 * los links al CRM, la campaña— y hasta acá resolvía sólo los cinco del motor: todo lo demás llegaba
 * CRUDO al grupo. Es la regla de AGENTS.md («La previsualización de un editor no puede resolver un token
 * que el motor NO resuelve»), del otro lado: lo que se ofrece se tiene que poder resolver. Con el
 * workspace del ctx (nunca el de las cookies: un flujo corre en un cron).
 *
 * Lo del motor que ya estaba en la mano (el nombre partido y la empresa de la fila que se acaba de leer)
 * va como `datos` y GANA; y después `textoConDatos` (adentro, `aplicarVariables`) cubre lo de antes con UNA llave (`{nombre}`), que
 * el catálogo nuevo no lee. Lo que no se puede resolver queda crudo: se nota.
 */
async function textoDelAviso(texto: string, lead: { id: number; nombreCrudo: string | null; empresa: string | null } | null, ws: number): Promise<string> {
  const t = texto.trim();
  if (!t) return t;
  const base = lead ? valoresVariablesLead({ nombre: lead.nombreCrudo, empresa: lead.empresa }) : {};
  // UNDÉCIMA TANDA (docs/diseno-undecima-tanda.md §5): con `textoConDatos`, la MISMA función de todo envío. Un renglón
  // cuyo dato del catálogo no tiene valor se va entero («📱 {{lead_telefono}}» de un lead sin teléfono no sale); lo que
  // no se conoce queda crudo. Sin token, ni una lectura.
  const vars = t.includes('{{') ? await valoresDeVariables({ ws, leadId: lead?.id ?? null, leadNombre: lead?.nombreCrudo ?? null, destino: 'equipo' }, t, base) : base;
  return (lead ? textoConDatos(t, { ...vars, ...base }) : textoConDatos(t, vars)).trim();
}

/** Qué hay que elegir al crear una plantilla, en palabras (null = trae su CRON puesto). */
function pideDePlantilla(p: PlantillaAutomatizacion): string | null {
  if (p.cron.pide === 'etapa_venta') return 'una etapa del embudo de venta';
  if (p.cron.pide === 'etapa_entrega') return 'una etapa de la entrega';
  if (p.cron.pide === 'etiqueta') return 'una etiqueta';
  return null;
}

/** ¿Lo pide un paso «⚡ Acción» de un flujo? La clave de scope lo dice (lib/api-mako/canal.ts). */
const desdeUnFlujo = (ctx: Ctx): boolean => ctx.canalKey.startsWith(PREFIJO_FLUJO);

/** Cuándo sale el primer paso, en la zona del negocio. Desde la sexta tanda (09/10/2026) el motor manda
 *  a cualquier hora salvo el horario de envío que el NEGOCIO ponga en Configuraciones (apagado por
 *  defecto), y con un tope diario: es «desde», no «a las». Desde un flujo no hay vía rápida
 *  (lib/nutricion.ts → inscribirEnSecuencia): lo que ya toca lo levanta el tick de cada minuto
 *  (app/api/cron/nutricion-tick). Antes decía «de 9 a 21» y «cada hora», que ya no es así. */
async function cuandoSale(iso: string, ws: number, porElCron: boolean): Promise<string> {
  if (Date.parse(iso) <= Date.now() + 60_000) {
    return porElCron
      ? 'el primer mensaje sale en el próximo minuto (o al abrir el horario de envío, si el negocio puso uno)'
      : 'el primer mensaje sale ya (o al abrir el horario de envío, si el negocio puso uno)';
  }
  const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
  let cuando = iso;
  try { cuando = new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }); } catch { /* el ISO tal cual */ }
  return `el primer mensaje sale desde el ${cuando}`;
}

/**
 * Un CRON en una línea, para el resumen de `cambiar_crons_secuencia` (lo lee la persona en la pantalla
 * de revisión). El nombre del disparador sale del catálogo (`TRIGGERS`), el evento de su lista, el
 * horario de `textoCron` con la zona que el horario eligió (sin ella, la del negocio).
 */
function textoDeUnCron(d: Disparador): string {
  const nombre = TRIGGERS.find((t) => t.value === d.trigger_tipo)?.label ?? d.trigger_tipo;
  if (d.cron) return `${textoCron(d.cron, d.cron.tz ?? null)}${d.grupo ? ' · al grupo de MaKo' : ''}${d.trigger_tipo !== TRIGGER_SOLO_GRUPO && d.trigger_tipo !== 'manual' ? ` · ${nombre}` : ''}`;
  const clase = claseDeDisparador(d);
  const evento = esClaseDeEventos(clase) ? eventosDe(clase).find((e) => e.subtipo === d.subtipo)?.label : null;
  if (evento) return evento;
  if (d.etapa) return `${nombre}: ${[...new Set([d.etapa, ...(d.etapas ?? [])])].join(', ')}`;
  if (d.etiqueta_id) return `${nombre} (#${d.etiqueta_id})`;
  return nombre;
}

/**
 * Lo que la ficha de una automatización dice de un AI STEP (undécima tanda, docs/diseno-undecima-tanda.md §6: UNO por
 * medio, con un objetivo y sus escenarios adentro): el objetivo, por dónde escucha, la voz, cuántas respuestas del
 * ensayo tiene, cada escenario con su LIBERTAD (`libertadDeCaso`: la MISMA que dibuja la tarjeta y lee el motor) y
 * «Lo demás» aparte. Explícito y con todos los campos (null/0 = no lo tiene): quien lee la ficha es un modelo, y un
 * campo ausente lo lee como «no sé», no como «no». Lo de antes (tono, «Otra cosa» con texto, «hasta», `avisar`) ya no
 * se dice: la ficha lee lo junto (`juntarPasosIA`), que es lo que el motor y el lienzo ven. Se lee con el tipo del
 * modelo (`PasoGrafo`): `PasoSecuencia` (lib/nutricion.ts) todavía no declara `objetivo`, `audio` ni `ejemplos`.
 */
function fichaPasoIA(p: PasoGrafo) {
  const casos = p.casos ?? [];
  return {
    paso_ia: true as const,
    objetivo: (p.objetivo ?? '').trim() || null,
    medio: medioDe(p),
    suelta: p.suelta === true,
    audio: p.audio ?? null,
    ejemplos: (p.ejemplos ?? []).length,
    escenarios: casos.filter((c) => c.cualquiera !== true).map((c) => ({
      id: c.id, titulo: c.titulo, cuando: c.cuando, responder: (c.responder ?? '').trim() || null, libertad: libertadDeCaso(c),
    })),
    lo_demas: libertadDeLoDemas(casos),
  };
}

/**
 * Cómo se dice dónde entra un escenario enseñado (`agregar_escenario_secuencia`, `resolver_handoff`), con la libertad
 * con la que QUEDA (la escribe `agregarCasoAlGrafo` con `libertadesPermitidas`: un «contesta solo» que habla de plata
 * queda para aprobar, y la pantalla de revisión lo tiene que decir así, no como se pidió).
 */
function dondeEntra(pasos: readonly PasoGrafo[], titulo: string): string {
  const r = nodoPorId(pasos, raizRespuesta(pasos));
  if (!r || !esPasoIA(r)) return 'como rama de «Si responde»';
  const c = (r.casos ?? []).find((x) => x.cualquiera !== true && x.titulo.trim().toLowerCase() === titulo.trim().toLowerCase());
  return `como escenario del AI Step${c ? ` (${ROTULO_LIBERTAD[libertadDeCaso(c)]})` : ''}`;
}

/** El detector de copy sin terminar del motor (RX_RELLENO en lib/nutricion.ts, que no lo exporta):
 *  un paso con un [corchete] que no sea [tu link …] NO sale nunca y se reprograma cada 24 h. */
const RX_RELLENO = /\[(?!tu link)[^\]\n]{2,80}\]/i;

// ── runners ──────────────────────────────────────────────────────────────────

export const RUNNERS: Runners = {
  // ═══ Lecturas ════════════════════════════════════════════════════════════
  listar_secuencias_nutricion: { leer: (input, ctx) => texto(legado(ctx)('listar_secuencias_nutricion', input)) },

  ficha_secuencia_mensajes: {
    leer: async (input) => {
      const id = num(input, 'secuenciaId');
      const { secuencias } = await getSettingData();
      const s = secuencias.find((x) => x.id === id);
      if (!s) return errorLectura(noExiste(id));
      // UN AI Step por medio (undécima tanda): lo guardado de antes (varias tarjetas) se lee JUNTO, como lo ven el
      // motor y el lienzo (`juntarPasosIA`, la puerta para lo viejo). Sin AI Step, los mismos pasos.
      const pasos = juntarPasosIA(s.pasos).pasos;
      return json({
        id: s.id, clave: s.clave, nombre: s.nombre, etapa: s.etapa, trigger: s.trigger_tipo, activa: s.activa,
        // LOS CRON (sexta tanda, mig 0241): la automatización arranca por CUALQUIERA de ellos, y `trigger` /
        // `etapa` de arriba son sólo el PRIMERO. Sin esto, quien lee la ficha creía que tenía uno solo.
        disparadores: s.disparadores ?? [],
        // Con ramas, «el paso 3» no es un lugar del flujo: cada tarjeta va con su `id` y a cuál sigue.
        con_ramas: !esLineal(pasos),
        pasos: pasos.map((p, i) => esNodoDeControl(p) ? ({
          // Una tarjeta de CONTROL no manda nada: decide por dónde sigue el flujo.
          orden: p.orden, id: idDe(p, i), tipo: p.nodo, siguiente: siguienteDe(pasos, i), espera: p.espera ?? null,
          // EL AI STEP sí contesta, y lo que contesta vive ADENTRO de la tarjeta: sus escenarios van en `escenarios`
          // (`fichaPasoIA`), no como los casos de un «Si responde» (que no dirían su libertad).
          ramas: p.ramas ?? null, casos: esPasoIA(p) ? undefined : p.casos ?? null, si_no: p.si_no ?? null, paralelos_si_no: p.paralelos_si_no ?? null, destino: p.destino ?? null,
          // El CRON: qué hace cada camino cuando el lead contesta (14/10/2026). Sin la clave, el de fábrica (sigue).
          ...(p.nodo === 'inicio' ? { paralelos: p.paralelos ?? [] } : {}),
          ...(esPasoIA(p) ? fichaPasoIA(p) : {}),
        }) : esPasoAccion(p) ? ({
          // Un paso «⚡ Acción de MaKo» no manda un mensaje: corre esta operación del registro.
          orden: p.orden, id: idDe(p, i), tipo: 'accion', delay_horas: p.delay_horas, ancla: p.ancla ?? null, requiere: p.requiere ?? null,
          accion: p.accion, siguiente: siguienteDe(pasos, i),
        }) : ({
          orden: p.orden, id: idDe(p, i), canal: p.canal, delay_horas: p.delay_horas, ancla: p.ancla ?? null, tipo: p.tipo ?? 'texto',
          audio_id: p.audio_id ?? null, media_id: p.media_id ?? null, requiere: p.requiere ?? null, proveedor: p.canal === 'whatsapp' ? proveedorDelPaso(p) : null,
          asunto: p.asunto, cuerpo: p.cuerpo, variantes: (p.variantes ?? []).length, plantilla_meta: p.template_wa,
          // VARIOS mensajes seguidos (cuarta tanda, punto 15): `cuerpo`/`audio_id`/`media_id` son el
          // espejo de la PRIMERA parte; sin esto, quien lee la ficha creía que el paso era sólo eso.
          ...(partesExplicitas(p) ? { partes: partesExplicitas(p) } : {}),
          revisar: p.revisar ?? null, siguiente: siguienteDe(pasos, i),
          sin_terminar: RX_RELLENO.test(p.cuerpo) || RX_RELLENO.test(p.asunto ?? ''),
        })),
        estrategia: s.estrategia,
        metricas_30d: { ventana: ventana30(), ...s.metricas },
        historico: { inscriptos: s.inscriptos, enviados: s.enviados },
        notas: [
          'Un «Si responde» con paso_ia=true es un AI Step: UN AI Step por medio, con un objetivo y sus escenarios adentro (hasta 10). Contesta cuando el lead escribe, hasta lograr el objetivo. Cada escenario dice cuándo entra (cuando), cómo responde (responder; null = no contesta) y su libertad: avisa (sólo te avisa), aprueba (deja la respuesta para aprobar y te avisa) o sola (sale sola, nunca si habla de plata). lo_demas es lo que pasa con lo que no encaja en ningún escenario: avisa o aprueba. Un escenario nuevo entra con agregar_escenario_secuencia.',
          'Un paso con sin_terminar=true no sale nunca: el motor lo reprograma cada 24 h.',
          'Los [tu link …] salen literales al lead: nada los reemplaza.',
          'activa=true no garantiza envíos: mira estado_canal_whatsapp_chatbot.',
        ],
      });
    },
  },

  escenarios_secuencia: {
    leer: async (input) => {
      const id = num(input, 'secuenciaId');
      const { secuencias } = await getSettingData();
      const s = secuencias.find((x) => x.id === id);
      if (!s) return errorLectura(noExiste(id));
      // El MISMO flujo y el MISMO lead recién llegado que «Probar» (app/automations/PanelProbar.tsx), y los MISMOS
      // números que `probar_secuencia` recibe en `escenario` (`escenariosDeLaSecuencia`).
      const { escenarios, faltan } = escenariosDeLaSecuencia(s, (clave) => secuencias.find((x) => x.clave === clave)?.id ?? null);
      return json({
        id: s.id, nombre: s.nombre,
        escenarios: escenarios.map((e, k) => ({ numero: k + 1, camino: e.pasos, mensajes_whatsapp: e.mensajes })),
        faltan,
      });
    },
  },

  metricas_chatbot: {
    leer: async (input) => {
      const filtro = input.secuenciaId != null ? num(input, 'secuenciaId') : null;
      const { secuencias, serie } = await getSettingData();
      const elegidas = filtro != null ? secuencias.filter((s) => s.id === filtro) : secuencias;
      if (filtro != null && !elegidas.length) return errorLectura(noExiste(filtro));
      return json({
        ventana: ventana30(),
        por_secuencia: elegidas.map((s) => ({ id: s.id, nombre: s.nombre, activa: s.activa, ...s.metricas })),
        // La serie diaria es del negocio entero: la lib no la separa por secuencia.
        serie_diaria_negocio: serie,
        notas: [
          'aperturas y clics existen solo para email; WhatsApp no informa aperturas.',
          'respuestas = inscripciones pausadas porque el lead contestó (la fecha es la de la pausa).',
          'Los envíos en borrador y simulados no cuentan como enviados.',
        ],
      });
    },
  },

  huecos_secuencias: {
    leer: async () => {
      const huecos = await huecosDeSecuencias();
      return json({ huecos, nota: huecos.length ? 'Ninguna automatización (ni pausada) arranca en estas etapas.' : 'Todas las etapas de nutrición del funnel tienen al menos una automatización (activa o pausada).' });
    },
  },

  listar_handoffs_pendientes: {
    leer: async () => {
      const lista = await handoffsPendientes();
      return json({ total: lista.length, tope: 50, handoffs: lista, nota: lista.length === 50 ? 'Se muestran los 50 más recientes; puede haber más.' : null });
    },
  },

  estado_canal_whatsapp_chatbot: { leer: async () => json(await estadoCanalWhatsapp()) },

  contexto_etapa: {
    leer: async (input) => {
      const etapa = str(input, 'etapa');
      const c = contextoDe(etapa);
      return json({ etapa, contexto: c, nota: c ? null : 'Esta etapa no tiene contexto escrito (es personalizada o no existe): no lo inventes.' });
    },
  },

  etapas_para_secuencia: { leer: async () => json({ etapas: await etapasParaSecuencia() }) },

  listar_objetivos_secuencia: {
    leer: async () => json({ catalogo: OBJETIVOS, propios: await leerObjetivosCustom(), tope_propios: TOPE_OBJETIVOS_CUSTOM }),
  },

  listar_audios: {
    leer: async () => {
      const [audios, porClave, linkVideo, publico] = await Promise.all([
        listAudios(), leerAudiosPorClave(), getSetting(KEY_LINK_VIDEO).catch(() => null), getSetting(KEY_PUBLICO).catch(() => null),
      ]);
      const vivos = new Set(audios.map((a) => a.id));
      const conUrl = await Promise.all(audios.map(async (a) => ({
        id: a.id, titulo: a.titulo, duracion_s: a.duracion_s, transcripcion: a.transcript, creado: a.created_at,
        url_escuchar_12h: await audioUrlFirmada(a.media_path),
      })));
      return json({
        audios: conUrl,
        por_situacion: Object.fromEntries(Object.entries(porClave).filter(([, id]) => vivos.has(id))),
        link_video: (linkVideo ?? '').trim() || null,
        publico: esPublico(publico) ? publico : 'mixto',
        nota: 'transcripcion null = no se pudo transcribir, no que el audio esté vacío.',
      });
    },
  },

  audios_requeridos: {
    leer: async () => {
      const [ins, porClave, audios] = await Promise.all([insumosAudios(), leerAudiosPorClave(), listAudios()]);
      if (!ins.entradas.length) return json({ requeridos: [], nota: 'El negocio no declaró por dónde le llegan los leads en su funnel: sin eso no se piden audios. Hay que declararlo primero en el funnel.' });
      const vivos = new Set(audios.map((a) => a.id));
      return json({
        requeridos: audiosDe(ins.entradas, ins.canal).map((d) => ({
          clave: d.clave, titulo: d.titulo, situacion: d.situacion,
          guion: guionDe(d, { linkVideo: ins.linkVideo, evento: ins.evento }),
          grabado: porClave[d.clave] != null && vivos.has(porClave[d.clave]),
        })),
      });
    },
  },

  guia_voz_negocio: {
    leer: async () => {
      const [guia, evidencia, manual] = await Promise.all([getVozGuia(), getEvidencia(), getManual()]);
      return json({ guia, evidencia, contestado_a_mano: manual, huecos: huecosDeVoz(evidencia, manual), nota: guia ? null : 'Todavía no hay guía de voz: MaKo escribe sin conocer el tono del negocio.' });
    },
  },

  escenarios_ensayo: {
    leer: async () => {
      const ins = await insumosAudios();
      const lista = escenariosDe(!!ins.linkVideo, ins.entradas, ins.canal);
      return json({
        escenarios: lista.map((e) => ({ id: e.id, titulo: e.titulo, objetivo: e.objetivo, audio: e.audio, desenlace: e.desenlace, minRespuestas: e.minRespuestas, obligatorio: e.obligatorio })),
        nota: ins.entradas.length ? null : 'Sin entradas de leads declaradas en el funnel no aplica ningún caso.',
      });
    },
  },

  ensayo_hecho: { leer: async () => json({ hechos: await leerEnsayo() }) },

  simular_respuesta_setter: {
    leer: async (input) => {
      const historial = historialDe(input);
      if (!historial.length || historial[historial.length - 1].de !== 'lead') return errorLectura('El último mensaje del historial tiene que ser del lead: es lo que MaKo contesta.');
      const r = await responderSimulador(num(input, 'secuenciaId'), historial);
      if (!r.ok) return errorLectura(r.error);
      return json({ respuesta: r.respuesta, desenlace: r.desenlace, nota: 'Simulación: no se envió ni se guardó nada. Los [tu link …] salen literales.' });
    },
  },

  evaluar_calificacion_charla: {
    leer: async (input) => {
      const historial = historialDe(input);
      if (!historial.length) return errorLectura('Falta la conversación.');
      const r = await evaluarCalificacion(num(input, 'secuenciaId'), historial);
      return json({ ...r, turnos_evaluados: Math.min(historial.length, 14), nota: 'califica null = sin criterio o sin evidencia; no es un «no».' });
    },
  },

  muestra_para_criterio: {
    leer: async (input) => {
      const limite = input.limite != null ? num(input, 'limite') : 60;
      const filas = await muestraParaCriterio(limite);
      return json({
        combinaciones_distintas: filas.length, limite_por_grupo: limite,
        combinaciones_por_tipo: { calificados: filas.filter((f) => f.calificado === true).length, no_calificados: filas.filter((f) => f.calificado === false).length, cerraron: filas.filter((f) => f.cerro === true).length },
        filas,
        nota: 'Los conteos son de COMBINACIONES distintas de respuestas, no de leads: los leads con las mismas respuestas se juntan en una fila. No trae nombres ni contactos.',
      });
    },
  },

  estado_onboarding_chatbot: {
    leer: async (input) => {
      const tab = str(input, 'tab') || 'setting';
      const [estado, def] = [await getEstadoTab(tab), tabOnboardingDef(tab)];
      if (!def) return errorLectura(`La tab «${tab}» no tiene onboarding.`);
      return json({
        tab, lista: estado.status === 'done',
        pasos: def.pasos.map((p) => ({ key: p.key, label: p.label, opcional: !!p.opcional, hecho: !!estado.steps[p.key]?.done, at: estado.steps[p.key]?.at ?? null })),
      });
    },
  },

  plantillas_meta_de_secuencia: {
    leer: async (input) => {
      const id = num(input, 'secuenciaId');
      if (!(await secuenciaVigente(id))) return errorLectura(noExiste(id));
      const pasos = await estadoPlantillasSecuencia(id);
      return json({ pasos, nota: pasos.length ? 'Estado del catálogo local de plantillas, no consultado a Meta en vivo.' : 'Ningún paso de esta secuencia va por WhatsApp oficial: no lleva plantillas.' });
    },
  },

  plan_nutricion_hoy: {
    leer: async () => {
      const TOPE = 200;
      const [ins, env] = await Promise.all([planificarInscripciones(), planificarEnvios()]);
      // planificarInscripciones/planificarEnvios paginan desde el 17/09: `total` es el
      // real. Los avisos de «se corta en 1000» que había acá se sacaron por falsos.
      return json({
        inscribiria: { total: ins.length, mostrados: Math.min(ins.length, TOPE), filas: ins.slice(0, TOPE) },
        enviaria: { total: env.length, mostrados: Math.min(env.length, TOPE), filas: env.slice(0, TOPE) },
        nota: 'Simulación: no aplica el tope diario configurado, la pausa de 20 h por lead, el horario de envío del negocio (si puso uno en Configuraciones) ni si el envío del canal está habilitado. Lo que sale de verdad puede ser menos.',
        avisos: [] as string[],
      });
    },
  },

  inscripciones_lead: {
    leer: async (input) => {
      const filas = await inscripcionesDeLead(num(input, 'leadId'));
      return json({
        total: filas.length, tope: TOPE_INSCRIPCIONES_LEAD,
        inscripciones: filas.map((f) => ({
          secuencia_id: f.secuencia_id, secuencia: f.secuencia?.nombre ?? null, archivada: !!f.secuencia?.archivada_at,
          estado: f.estado, pasos_avanzados: f.paso_actual, proximo_envio: f.proximo_envio_at, ultimo_envio: f.ultimo_paso_at,
          // Dónde está: la tarjeta (con ramas, `pasos_avanzados` es una posición del array) y, con
          // flechas en paralelo, cuántos caminos corren a la vez.
          tarjeta: f.nodo_actual, caminos_en_paralelo: Array.isArray(f.hilos) ? f.hilos.length : 0,
          desenlace: f.desenlace, desenlace_at: f.desenlace_at, inscripto: f.inscripto_at,
        })),
        nota: filas.length
          ? 'pasos_avanzados incluye pasos omitidos y los que quedaron como borrador para el setter: no son todos envíos. Un lead no vuelve a entrar a una secuencia en la que ya estuvo (completada, cancelada o fallida), salvo a la que prepara una reunión cuando vuelve a agendar para otro día (o, si no se sabe qué reunión preparaba, cuando la vez anterior no le llegó nada): ahí la misma inscripción vuelve a correr, con inscripto en la fecha nueva. A mano (inscribir_lead_secuencia) sí vuelve a una que terminó.'
          : 'Este lead no está ni estuvo en ninguna secuencia (o no existe en este negocio).',
      });
    },
  },

  // La galería (undécima tanda). Explícito y con todos los campos: quien lee es un modelo (un campo ausente es «no sé»).
  listar_plantillas_automatizaciones: {
    leer: async () => json({
      total: PLANTILLAS.length,
      plantillas: PLANTILLAS.map((p) => ({
        id: p.id, nombre: p.nombre, para_que: p.linea,
        objetivo: OBJETIVOS_PLANTILLA.find((o) => o.id === p.objetivo)?.label ?? p.objetivo,
        canales: canalesDe(p).map((c) => CANALES_PLANTILLA.find((x) => x.id === c)?.label ?? c),
        pide_etapa: pideDePlantilla(p),
        cron_puesto: p.cron.fijo ? true : false,
        ayuda_etapa: p.cron.ayuda ?? null,
      })),
      nota: 'Nacen pausadas. pide_etapa dice qué hay que elegir al crearla (null = trae su CRON puesto). Para crear una: crear_automatizacion_desde_plantilla.',
    }),
  },

  listar_secuencias_archivadas: {
    leer: async () => {
      const filas = await secuenciasArchivadas();
      return json({
        total: filas.length, tope: TOPE_ARCHIVADAS,
        archivadas: filas.map((s) => ({ id: s.id, nombre: s.nombre, clave: s.clave, etapa: s.etapa, archivada_at: s.archivada_at, prendida_al_archivarse: s.activa })),
        nota: filas.length === TOPE_ARCHIVADAS ? `Se muestran las ${TOPE_ARCHIVADAS} archivadas más recientes; puede haber más.` : (filas.length ? 'Desarchivar las devuelve PAUSADAS.' : 'Este negocio no tiene secuencias archivadas.'),
      });
    },
  },

  // ═══ Acciones por chat ═══════════════════════════════════════════════════
  proponer_toggle_nutricion: {
    proponerLegado: (input, ctx) => texto(legado(ctx)('proponer_toggle_nutricion', input)),
    ejecutar: (payload, ctx) => ejecutarAccion(ctx.ws, 'nutricion_toggle', payload),
  },

  // «Pídeselo a MaKo» por la API (décima tanda; la def explica el porqué de cada decisión). Reemplaza a
  // `crear_secuencia_mensajes`, que se retiró.
  crear_automatizacion_con_ia: {
    preparar: async (input, ctx) => {
      // ⚠️ UN FLUJO NO LA CORRE: `ctxDeFlujo` usa el canal `app`, así que toda acción `app` aparece sola como «⚡ Acción»
      // en los lienzos. Una automatización que crea automatizaciones con IA cada vez que alguien entra es un lazo que gasta
      // la IA del negocio. Además se saca de la lista del lienzo (`NO_EN_FLUJOS`, lib/api-mako/flujo.ts).
      if (desdeUnFlujo(ctx)) return { error: 'Una automatización no puede crear automatizaciones: pídeselo a MaKo por el grupo o en Automations.' };
      const pedido = str(input, 'pedido');
      if (!pedido) return { error: 'Falta qué tiene que hacer la automatización.', faltan: ['pedido'] };
      // Todo lo que se puede saber sin escribir falla ACÁ (AGENTS.md): confirmar reclama la pendiente y no vuelve.
      // El link a donde se arregla lo escribe el código y va a la persona (`paraLaPersona`), nunca por el modelo.
      if (!(await hayIAParaCrear())) {
        const f = falloDeIA([], false);
        return { error: f.error, ...(f.link ? { paraLaPersona: `${f.error} Conéctala aquí 👉 ${linkApp(f.link, ctx.ws)}` } : {}) };
      }
      // DUODÉCIMA TANDA (docs/diseno-duodecima-tanda.md §2.4): las MISMAS preguntas que la pantalla (`preguntaAntes`),
      // con el MISMO contexto que va a usar crear (`armarContexto`: sólo lee), sin escribir. Si falta un dato decisivo,
      // vuelve la pregunta numerada para que el doer la haga en el grupo; la respuesta llega en `canal`, `producto` o
      // `evento` (el número, el nombre o «Elige tú»; otra cosa va como texto al pedido).
      const { ctx: cx } = await armarContexto(ctx.ws, pedido);
      const respuestas: RespuestaMako[] = [];
      for (let ronda = 0; ronda < TOPE_RONDAS; ronda++) {
        const p = preguntaAntes(pedido, cx, respuestas);
        if (!p) break;
        const dado = str(input, p.sobre);
        if (!dado) return { error: preguntaParaWhatsApp(p), faltan: [p.sobre] };
        respuestas.push(respuestaDeTexto(p, dado));
      }
      return { payload: { pedido, respuestas }, resumen: `Crear con IA: «${pedido.length > 120 ? `${pedido.slice(0, 119)}…` : pedido}» (nace pausada)` };
    },
    ejecutar: async (payload, ctx) => {
      // 170 s: el turno del doer corre en un `after()` con `maxDuration` 300 y ya gastó lo suyo. El chat de la fila nueva
      // dice por dónde llegó el pedido (`via`).
      const via = ctx.canal === 'whatsapp' ? 'whatsapp' : 'app';
      const r = await crearFlujoConIA({ ws: ctx.ws, pedido: String(payload.pedido ?? ''), plazoMs: 170_000, respuestas: sanearRespuestas(payload.respuestas), via });
      // Algo cambió entre proponer y confirmar (o preguntó el modelo): la pregunta vuelve a la persona, numerada.
      if (!r.ok && 'pregunta' in r) return { ok: false, resumen: preguntaParaWhatsApp(r.pregunta) };
      if (!r.ok) return { ok: false, resumen: r.error, ...(r.link ? { paraLaPersona: `${r.error} 👉 ${linkApp(r.link, ctx.ws)}` } : {}) };
      // ⚠️ EL LINK LO ESCRIBE EL CÓDIGO y va por `paraLaPersona` (AGENTS.md: un id que pasa por un modelo deja de ser
      // exacto). `/automations?sec=<id>&mako=1` abre el lienzo de esa automatización CON el chat de MaKo abierto (§2.5),
      // y `linkApp` le pega el `?ws=`.
      const link = linkApp(`/automations?sec=${r.secuenciaId}&mako=1`, ctx.ws);
      const falta = r.disparador ? '' : ' Le falta elegir qué la dispara.';
      return {
        ok: true,
        resumen: `Automatización «${r.nombre}» creada (#${r.secuenciaId}), pausada.${falta}`,
        datos: { secuenciaId: r.secuenciaId },
        paraLaPersona: `🧩 «${r.nombre}» quedó pausada.${falta} Ábrela y actívala 👉 ${link}`,
      };
    },
  },

  // Crear desde la galería (undécima tanda; la def explica el porqué de cada decisión).
  crear_automatizacion_desde_plantilla: {
    preparar: async (input, ctx) => {
      if (desdeUnFlujo(ctx)) return { error: 'Una automatización no puede crear automatizaciones: pídeselo a MaKo por el grupo o en Automations.' };
      const id = str(input, 'plantilla');
      const p = plantillaPorId(id);
      // Un id de antes nombra la que lo reemplaza; nunca se crea otra cosa en silencio.
      if (!p) return { error: `${motivoDePlantillaVieja(id) ?? 'Esa plantilla no existe.'} Pide el id con listar_plantillas_automatizaciones.` };
      const etapa = str(input, 'etapa');
      const producto = str(input, 'producto');
      if (!p.cron.pide || !etapa) {
        const falta = p.cron.pide ? ' (le falta elegir dónde arranca: se elige en su CRON)' : '';
        return { payload: { plantilla: p.id, disparador: null }, resumen: `Crear «${p.nombre}» desde la galería, pausada${falta}` };
      }
      // La etapa en palabras → el valor del desplegable del CRON, con LAS MISMAS opciones que la galería. Con dos que
      // calzan, contesta con las opciones: una automatización en la etapa equivocada le escribe a otra gente.
      const e = eleccionEnPalabras(p.cron.pide, {
        productos: p.cron.pide === 'etiqueta' ? [] : await productosConEtapas(),
        etiquetas: p.cron.pide === 'etiqueta' ? (await listarEtiquetas()).map((x) => ({ id: x.id, nombre: x.nombre, archivada_at: x.archivada_at })) : [],
      }, etapa, producto || null);
      if (!e.ok) return { error: e.opciones.length ? `${e.motivo} Puede ser: ${e.opciones.join(' · ')}.` : e.motivo };
      return { payload: { plantilla: p.id, disparador: e.valor }, resumen: `Crear «${p.nombre}» desde la galería, pausada, arrancando en «${e.rotulo}»` };
    },
    ejecutar: async (payload, ctx) => {
      try {
        const r = await crearDesdePlantilla(payload.plantilla, {
          db: (await getTenantDb()) as unknown as DbPlantilla,
          setPasos: setSecuenciaPasos,
          setDisparadores: guardarDisparadores,
          motivoDeCron: (e) => (e instanceof TriggerInvalidoError ? e.message : null),
        }, { disparador: payload.disparador ?? undefined });
        // ⚠️ EL LINK LO ESCRIBE EL CÓDIGO y va por `paraLaPersona` (AGENTS.md: un id que pasa por un modelo deja de ser exacto).
        const link = linkApp(`/automations?sec=${r.id}`, ctx.ws);
        const falta = r.aviso ? ` ${r.aviso}` : r.pide ? ' Le falta elegir dónde arranca.' : '';
        return {
          ok: true,
          resumen: `Automatización «${r.nombre}» creada (#${r.id}), pausada.${falta}`,
          datos: { secuenciaId: r.id },
          paraLaPersona: `🧩 «${r.nombre}» quedó pausada.${falta} Ábrela y actívala 👉 ${link}`,
        };
      } catch (e) {
        if (e instanceof PlantillaInvalidaError || e instanceof PasosInvalidosError) return { ok: false, resumen: e.message };
        throw e;
      }
    },
  },

  cambiar_espera_paso: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId'); const orden = num(input, 'orden'); const horas = num(input, 'delayHoras');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      const p = s.pasos.find((x) => x.orden === orden);
      if (!p) return { error: `La secuencia «${s.nombre}» no tiene paso ${orden} (tiene ${s.pasos.length}).` };
      // Una tarjeta «Esperar» es la espera misma; una condición o un «Si responde» no esperan nada.
      if (esNodoDeControl(p) && claseDe(p) !== 'esperar') return { error: `El paso ${orden} de «${s.nombre}» es una tarjeta de control, no un paso con espera.` };
      if (claseDe(p) === 'esperar') {
        if (!(horas > 0)) return { error: 'Una espera de 0 horas no espera nada: para sacarla, bórrala en el lienzo de /automations.' };
        return { payload: { secuenciaId: id, orden, delayHoras: horas }, resumen: `La espera del paso ${orden} de «${s.nombre}»: de ${Math.round((p.espera?.minutos ?? 0) / 60)} h a ${horas} h` };
      }
      return { payload: { secuenciaId: id, orden, delayHoras: horas }, resumen: `Paso ${orden} de «${s.nombre}»: espera de ${p.delay_horas} h a ${horas} h` };
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId); const orden = Number(payload.orden); const horas = Number(payload.delayHoras);
      const s = await secuenciaVigente(id);
      if (!s || !s.pasos.some((p) => p.orden === orden)) return { ok: false, resumen: 'La secuencia o el paso ya no existen.' };
      const esEspera = claseDe(s.pasos.find((p) => p.orden === orden)!) === 'esperar';
      if (esEspera) {
        await setSecuenciaPasos(id, s.pasos.map((p) => (p.orden === orden ? { ...p, espera: { modo: p.espera?.modo ?? 'tiempo', minutos: Math.round(horas * 60) } } : p)));
        return { ok: true, resumen: `La espera del paso ${orden} de «${s.nombre}» ahora es de ${horas} h. Los envíos ya programados no se recalculan.` };
      }
      await setSecuenciaPasos(id, s.pasos.map((p) => (p.orden === orden ? { ...p, delay_horas: horas } : p)));
      return { ok: true, resumen: `Paso ${orden} de «${s.nombre}» ahora espera ${horas} h. Los envíos ya programados no se recalculan.` };
    },
  },

  asignar_audio_paso: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId'); const orden = num(input, 'orden');
      const audioId = input.audioId != null ? num(input, 'audioId') : null;
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      if (!s.pasos.some((p) => p.orden === orden)) return { error: `La secuencia «${s.nombre}» no tiene paso ${orden}.` };
      if (esPasoAccion(s.pasos.find((p) => p.orden === orden))) return { error: `El paso ${orden} de «${s.nombre}» es una acción de MaKo, no un mensaje: no lleva audio.` };
      if (esNodoDeControl(s.pasos.find((p) => p.orden === orden))) return { error: `El paso ${orden} de «${s.nombre}» es una tarjeta de control, no un mensaje: no lleva audio.` };
      if (audioId == null) return { payload: { secuenciaId: id, orden }, resumen: `Quitar el audio del paso ${orden} de «${s.nombre}» (vuelve a ser texto)` };
      const a = await getAudio(audioId);
      if (!a) return { error: `No existe el audio #${audioId} en este negocio. Pide el id con listar_audios.` };
      return { payload: { secuenciaId: id, orden, audioId }, resumen: `Paso ${orden} de «${s.nombre}» → nota de voz «${a.titulo}» (va por WhatsApp no oficial; a leads que todavía no son clientes queda como borrador para que alguien lo mande)` };
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId); const orden = Number(payload.orden);
      const audioId = payload.audioId != null ? Number(payload.audioId) : null;
      const s = await secuenciaVigente(id);
      if (!s || !s.pasos.some((p) => p.orden === orden)) return { ok: false, resumen: 'La secuencia o el paso ya no existen.' };
      if (audioId != null && !(await getAudio(audioId))) return { ok: false, resumen: `El audio #${audioId} ya no existe.` };
      const pasos: PasoSecuencia[] = s.pasos.map((p) => {
        if (p.orden !== orden) return p;
        return audioId != null
          ? { ...p, tipo: 'audio', audio_id: audioId, canal: 'whatsapp', proveedor: 'no_oficial' }
          : { ...p, tipo: 'texto', audio_id: null };
      });
      await setSecuenciaPasos(id, pasos);
      return { ok: true, resumen: audioId != null ? `El paso ${orden} de «${s.nombre}» ahora es una nota de voz.` : `El paso ${orden} de «${s.nombre}» volvió a ser texto.` };
    },
  },

  desarchivar_secuencia: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaFila(id);
      if (!s) return { error: `No existe la secuencia #${id} en este negocio.` };
      if (!s.archivada_at) return { error: `La secuencia «${s.nombre}» no está archivada.` };
      const estaba = s.activa ? 'estaba prendida al archivarse: vuelve PAUSADA y hay que activarla aparte' : 'vuelve pausada';
      return { payload: { secuenciaId: id }, resumen: `Desarchivar la secuencia «${s.nombre}» (${estaba}; las inscripciones canceladas no vuelven)` };
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId);
      // Desarchiva y pausa en la misma escritura: archivar no toca `activa`, así que desarchivar a
      // secas volvía a inscribir y a mandar a una secuencia que estaba prendida al archivarse.
      const n = await desarchivarYPausar(id);
      return n ? { ok: true, resumen: `Secuencia #${id} desarchivada y pausada.` } : { ok: false, resumen: 'La secuencia no existe o ya no estaba archivada.' };
    },
  },

  asignar_audio_situacion: {
    preparar: async (input) => {
      const clave = str(input, 'clave'); const audioId = num(input, 'audioId');
      const a = await getAudio(audioId);
      if (!a) return { error: `No existe el audio #${audioId} en este negocio. Pide el id con listar_audios.` };
      const consume = clave in AUDIO_A_SECUENCIA ? '' : ' (ojo: ninguna secuencia automática usa esta situación hoy; queda asignado sin salir)';
      return { payload: { clave, audioId }, resumen: `Usar el audio «${a.titulo}» para la situación «${clave}»${consume}` };
    },
    ejecutar: async (payload) => {
      if (!(await getAudio(Number(payload.audioId)))) return { ok: false, resumen: 'Ese audio ya no existe.' };
      const clave = String(payload.clave);
      await asignarAudioAClave(clave, Number(payload.audioId));
      const sigue = clave in AUDIO_A_SECUENCIA
        ? 'Para que salga, rearma las secuencias desde los audios.'
        : 'Ninguna secuencia automática usa esta situación hoy: queda asignado, pero no sale solo.';
      return { ok: true, resumen: `Audio #${Number(payload.audioId)} asignado a «${clave}». ${sigue}` };
    },
  },

  guardar_publico_audios: {
    preparar: async (input) => {
      const publico = str(input, 'publico');
      if (!esPublico(publico)) return { error: 'El público tiene que ser masculino, femenino o mixto.' };
      return { payload: { publico }, resumen: `Guardar que el negocio le habla a un público ${publico}` };
    },
    ejecutar: async (payload) => {
      await setSetting(KEY_PUBLICO, String(payload.publico));
      return { ok: true, resumen: `Público guardado: ${String(payload.publico)}.` };
    },
  },

  agregar_objetivo_custom: {
    preparar: async (input) => {
      const objetivo = str(input, 'objetivo');
      if (esObjetivoDelCatalogo(objetivo)) return { error: `«${objetivo}» ya es un objetivo del catálogo.` };
      const previos = await leerObjetivosCustom();
      if (previos.some((p) => p.toLowerCase() === objetivo.toLowerCase())) return { error: `El objetivo «${objetivo}» ya existe.` };
      const cae = previos.length >= TOPE_OBJETIVOS_CUSTOM ? ` (hay ${TOPE_OBJETIVOS_CUSTOM}: se descarta el más viejo, «${previos[0]}»)` : '';
      return { payload: { objetivo }, resumen: `Agregar el objetivo propio «${objetivo}»${cae}` };
    },
    ejecutar: async (payload) => {
      const r = await agregarObjetivoCustom(String(payload.objetivo));
      return r.agregado ? { ok: true, resumen: `Objetivo «${String(payload.objetivo)}» agregado.` } : { ok: false, resumen: 'Ese objetivo ya existía.' };
    },
  },

  inscribir_lead_secuencia: {
    // La decisión y la escritura son UNA función (inscribirEnSecuencia, lib/nutricion.ts): acá
    // con `soloVer`, que no escribe; al confirmar, sin él, y vuelve a decidir contra la base.
    preparar: async (input, ctx) => {
      const leadId = num(input, 'leadId'); const secuenciaId = num(input, 'secuenciaId');
      const v = await inscribirEnSecuencia(leadId, secuenciaId, { soloVer: true });
      // «Ya está en curso» es el estado que el paso pide: para un flujo, nada que hacer.
      if (!v.inscribe) return { error: noSeInscribe(v, leadId, secuenciaId), ...(v.porque === 'en_curso' ? { yaEstaba: true } : {}) };
      const como = v.como === 'reinicio' ? 'ya la había terminado: vuelve a arrancar desde el primer paso y le repite los mensajes' : 'arranca en el primer paso';
      return {
        payload: { leadId: v.lead.id, secuenciaId: v.secuencia.id },
        resumen: `Meter a ${v.lead.nombre} en «${v.secuencia.nombre}» (${como}); ${await cuandoSale(v.proximoEnvioAt, ctx.ws, desdeUnFlujo(ctx))}`,
      };
    },
    ejecutar: async (payload, ctx) => {
      const leadId = Number(payload.leadId); const secuenciaId = Number(payload.secuenciaId);
      try {
        // Desde un flujo, sin la vía rápida: el paso puede estar corriendo adentro del motor.
        const v = await inscribirEnSecuencia(leadId, secuenciaId, { sinEnvioInmediato: desdeUnFlujo(ctx) });
        if (!v.inscribe) return { ok: false, resumen: noSeInscribe(v, leadId, secuenciaId) };
        // El motor no deja historial al inscribir; una inscripción a mano sí, con quién la pidió.
        await logLeadEvent(v.lead.id, 'Secuencia', `${v.como === 'reinicio' ? 'Vuelve a arrancar' : 'Entra'} en «${v.secuencia.nombre}»`, ctx.actor?.trim() || 'MaKo');
        return {
          ok: true,
          resumen: `Listo: ${v.lead.nombre} ${v.como === 'reinicio' ? 'vuelve a arrancar' : 'quedó'} en «${v.secuencia.nombre}»; ${await cuandoSale(v.proximoEnvioAt, ctx.ws, desdeUnFlujo(ctx))}.`,
          datos: { leadId: v.lead.id, secuenciaId: v.secuencia.id, como: v.como, proximoEnvioAt: v.proximoEnvioAt },
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[api-mako chatbot] inscribir_lead_secuencia:', msg);
        return { ok: false, resumen: `No se pudo inscribir al lead #${leadId} en la secuencia #${secuenciaId} (${msg}).` };
      }
    },
  },

  // El «Otra cosa» de «Si responde»: avisa al grupo del negocio, nunca al lead. El molde es el aviso
  // 'lead-no-confirmo' (lib/nutricion-desenlace.ts): `ws` EXPLÍCITO (sin él cae al grupo de la
  // agencia), un tipo propio y el dedup POR LEAD (sin `dedupKey`, el primero se comería el aviso de
  // todos los demás durante la ventana).
  //
  // ⚠️ Y DESDE LA UNDÉCIMA, LA TARJETA «MaKo en WhatsApp» POR PARTES (lib/mako-tarjeta.ts): con `partes`,
  // desde un flujo y sin `respuesta`, sale TAL CUAL (sin envoltorio, sin rótulo, sin dedup: el reclamo del
  // motor ya impide el doble envío). Lo que arma el aviso —el de antes y el tal cual— es
  // `armarAvisoDeTarjeta`, y lo que se le contesta al motor, `resultadoDelAviso`: un WhatsApp que no salió
  // es un FALLO con su causa (hasta la décima quedaba «Le avisé al equipo.»).
  avisar_al_equipo: {
    preparar: async (input) => {
      const mensaje = str(input, 'mensaje');
      if (!mensaje) return { error: 'Falta el mensaje del aviso.', faltan: ['mensaje'] };
      const titulo = str(input, 'titulo');
      const respuesta = str(input, 'respuesta');
      const leadId = input.leadId != null ? num(input, 'leadId') : null;
      // Las partes, con la MISMA vara que un WhatsApp (`problemaDePartes`: una parte sin su texto o su
      // archivo, el tope, las pausas) y cada audio y archivo de ESTE negocio (la Voz de MaKo, nunca un audio
      // del dueño). Revalida al confirmar: `preparar` vuelve a correr con el mismo input.
      const conPartes = Array.isArray(input.partes);
      const partes = conPartes ? sanearPartes(input.partes) : [];
      if (conPartes) {
        const mala = problemaDePartes({ canal: 'whatsapp', proveedor: 'no_oficial', partes: input.partes as unknown[] });
        if (mala) return { error: `El aviso ${mala}.` };
        if (!partes.length) return { error: 'Falta el mensaje del aviso.', faltan: ['partes'] };
        const ajena = await problemaDePartesGrupo(partes);
        if (ajena) return { error: ajena };
      }
      let quien: string | null = null;
      if (leadId != null) {
        const l = await leadDelAviso(leadId);
        if (!l) return { error: `No existe el lead #${leadId} en este negocio.` };
        quien = l.nombre;
      }
      return {
        payload: { ...(leadId != null ? { leadId } : {}), ...(titulo ? { titulo } : {}), mensaje, ...(conPartes ? { partes } : {}), ...(respuesta ? { respuesta } : {}) },
        resumen: `Avisar al equipo${quien ? ` sobre ${quien}` : ''}: «${mensaje.slice(0, 120)}»${partes.length > 1 ? ` (${partes.length} mensajes)` : ''}`,
      };
    },
    ejecutar: async (payload, ctx) => {
      const leadId = payload.leadId != null ? Number(payload.leadId) : null;
      const lista = esTarjetaTalCual(payload) ? partesDeMako(payload) : [];
      // Con partes, el texto sale de ellas (`mensaje` es su espejo): no se resuelve dos veces.
      const mensajeCrudo = lista.length ? '' : String(payload.mensaje ?? '').trim();
      if (!mensajeCrudo && !lista.length) return { ok: false, resumen: 'El aviso no tiene mensaje.' };
      // Lo que escribió el lead, cuando el aviso sale de «Si responde» (lo pone el motor).
      const respuesta = String(payload.respuesta ?? '').trim();
      const lead = leadId != null ? await leadDelAviso(leadId) : null;
      if (leadId != null && !lead) return { ok: false, resumen: `El lead #${leadId} ya no existe en este negocio.` };
      // Los datos «{ }» (la tarjeta MAKO EN WHATSAPP los ofrece): sin esto, «{{nombre}}» salía crudo al grupo.
      const mensaje = await textoDelAviso(mensajeCrudo, lead, ctx.ws);
      const titulo = (await textoDelAviso(String(payload.titulo ?? ''), lead, ctx.ws)) || (lead ? `${lead.nombre}: hay que verlo` : 'Una automatización te avisa');
      // ⚠️ TODOS LOS BINARIOS SE BAJAN ANTES DE MANDAR NADA (y antes del feed): si falta la nota de voz o el
      // archivo, no sale una tarjeta a medias. Cada texto, con los mismos datos que el de antes.
      let partes: PartePreparada[] | null = null;
      if (lista.length) {
        const p = await prepararPartesGrupo(lista, (t) => textoDelAviso(t, lead, ctx.ws));
        if (!p.ok) return { ok: false, resumen: `No salió el aviso: ${p.error}` };
        partes = p.partes;
      }
      const r = await emitirAviso({
        ws: ctx.ws,
        ...armarAvisoDeTarjeta(payload, {
          desdeUnFlujo: desdeUnFlujo(ctx), respuesta, lead,
          // El link que viaja en el WhatsApp va por `linkApp` (lleva el `?ws=`): abierto desde el
          // teléfono, sin él abre la ficha en el negocio que esté mirando la pestaña.
          linkLead: lead ? linkApp(`/crm/${lead.id}`, ctx.ws) : null,
          textos: { titulo, mensaje: partes ? textoDePreparadas(partes) : mensaje },
          partes,
        }),
      });
      return resultadoDelAviso(r, lead);
    },
  },

  // ═══ Acciones por pantalla (genérica /mako/revisar) ══════════════════════
  reabrir_onboarding_chatbot: {
    // Solo la tab del área (setting): los recorridos de whatsapp y email son de OTRAS áreas.
    preparar: async () => {
      const def = tabOnboardingDef('setting');
      if (!def) return { error: 'El chatbot no tiene onboarding definido.' };
      const compartidos = def.pasos.map((p) => {
        const otras = Object.values(TAB_ONBOARDINGS).filter((d) => d.key !== 'setting' && d.pasos.some((q) => q.key === p.key)).map((d) => d.nombre);
        return otras.length ? `${p.label} (también en ${otras.join(', ')})` : null;
      }).filter(Boolean);
      const suelta = compartidos.length ? `; se sueltan del registro compartido: ${compartidos.join('; ')}` : '';
      return { payload: {}, resumen: `Reabrir desde cero el onboarding del chatbot: /automations vuelve a abrir en el recorrido y todos sus pasos se vuelven a pedir${suelta}` };
    },
    ejecutar: async () => {
      await reabrirOnboardingTab('setting');
      return { ok: true, resumen: 'Onboarding del chatbot reabierto.' };
    },
  },
  guardar_estrategia_secuencia: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      // ⚠️ EN UNA SECUENCIA DE TARJETAS, EL DESENLACE Y EL MODO NO SE ESCRIBEN POR ACÁ. Cuándo
      // termina es una condición del lienzo y qué pasa al responder es «Si responde»; el conversor
      // dejó el desenlace inerte y el modo en 'automatico' (LIMPIEZA, lib/flujo-legado.ts) para que
      // el motor viejo no repita lo que hacen las tarjetas. Escribirlos de nuevo lo reviviría al
      // lado del flujo, con dos cosas decidiendo lo mismo.
      if (tieneTarjetasDeControl(s.pasos) && (input.desenlace != null || str(input, 'modo'))) {
        return { error: `«${s.nombre}» está armada con tarjetas: cuándo termina y qué pasa cuando el lead responde se cambian en el lienzo de /automations (una condición, «Si responde»), no en la estrategia.` };
      }
      const actual = parseEstrategia(s.estrategia);
      const objetivo = str(input, 'objetivo');
      if (!actual && !objetivo) return { error: 'Esta secuencia todavía no tiene estrategia: el objetivo es obligatorio.', faltan: ['objetivo'] };
      const base: Estrategia = actual ?? parseEstrategia({ objetivo })!;
      const cambios: string[] = [];
      const nueva: Estrategia = { ...base, criterio: { ...base.criterio }, desenlace: { ...base.desenlace } };
      if (objetivo) { nueva.objetivo = objetivo; cambios.push('objetivo'); }
      if (str(input, 'gancho')) { nueva.gancho = str(input, 'gancho'); cambios.push('gancho'); }
      // Una por renglón y NO por comas: la pantalla genérica parte un string[] por comas al confirmar,
      // y «¿Cuánto facturas al mes, más o menos?» se guardaba como dos preguntas. El array se acepta
      // igual por las propuestas que quedaron guardadas con la forma anterior.
      const preguntas = Array.isArray(input.preguntas)
        ? (input.preguntas as unknown[]).map((x) => String(x).trim()).filter(Boolean)
        : typeof input.preguntas === 'string' ? input.preguntas.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) : null;
      if (preguntas) {
        if (preguntas.length > 10) return { error: `Son ${preguntas.length} preguntas: el máximo es 10.` };
        nueva.preguntas = preguntas; cambios.push('preguntas');
      }
      const lm = str(input, 'lead_magnet_id');
      if (lm) {
        const entregables = await getEntregables();
        if (!entregables.some((g) => g.id === lm)) return { error: `«${lm}» no es el id de un lead magnet de este negocio.`, disponibles: entregables.map((g) => ({ id: g.id, nombre: g.nombre })) };
        nueva.lead_magnet_id = lm; cambios.push('lead_magnet_id');
      }
      if (typeof input.usa_lead_magnet === 'boolean') {
        if (input.usa_lead_magnet && !nueva.lead_magnet_id) return { error: 'Para usar un lead magnet, pasa también lead_magnet_id.', faltan: ['lead_magnet_id'] };
        nueva.usa_lead_magnet = input.usa_lead_magnet; cambios.push('usa_lead_magnet');
      } else if (lm) {
        nueva.usa_lead_magnet = true;
      }
      const crit = (input.criterio ?? null) as { califica?: string[]; descalifica?: string[] } | null;
      if (crit?.califica) { nueva.criterio.califica = crit.califica; cambios.push('criterio.califica'); }
      if (crit?.descalifica) { nueva.criterio.descalifica = crit.descalifica; cambios.push('criterio.descalifica'); }
      const des = (input.desenlace ?? null) as Record<string, unknown> | null;
      if (des) {
        for (const k of ['logrado', 'logradoEtapa', 'logradoSecuencia', 'falloHoras', 'falloEtapa', 'falloSecuencia'] as const) {
          if (des[k] != null) { (nueva.desenlace as Record<string, unknown>)[k] = des[k]; cambios.push(`desenlace.${k}`); }
        }
        // El desenlace MUEVE leads desde el cron: una etapa o una secuencia inventada no puede entrar.
        // ⚠️ Hoy valida contra el funnel DEL NEGOCIO porque hay uno solo. Con varios,
        // acá va la UNIÓN de las etapas de todos: si no, una etapa válida del segundo
        // funnel rebota contra el primero y el chatbot se queda sin desenlace.
        const etapasFunnel = new Set((await getFunnelDefault()).stages.map((st) => st.key));
        for (const k of ['logradoEtapa', 'falloEtapa'] as const) {
          const v = des[k];
          if (typeof v === 'string' && !etapasFunnel.has(v)) return { error: `«${v}» (desenlace.${k}) no es una etapa de este funnel.`, disponibles: [...etapasFunnel] };
        }
        const claves = new Set((await getSecuenciasConStats()).map((x) => x.clave));
        for (const k of ['logradoSecuencia', 'falloSecuencia'] as const) {
          const v = des[k];
          if (typeof v === 'string' && !claves.has(v)) return { error: `«${v}» (desenlace.${k}) no es la clave de una secuencia vigente.`, disponibles: [...claves] };
        }
      }
      if (str(input, 'modo')) { nueva.modo = str(input, 'modo') as Estrategia['modo']; cambios.push('modo'); }
      if (str(input, 'notas')) { nueva.notas = str(input, 'notas'); cambios.push('notas'); }
      if (!cambios.length) return { error: 'No pasaste ningún campo para cambiar.' };
      const final = parseEstrategia(nueva);
      if (!final) return { error: 'La estrategia resultante no es válida.' };
      return { payload: { secuenciaId: id, estrategia: final }, resumen: `Estrategia de «${s.nombre}»: cambia ${cambios.join(', ')}` };
    },
    ejecutar: async (payload) => {
      const est = parseEstrategia(payload.estrategia);
      if (!est) return { ok: false, resumen: 'La estrategia no es válida.' };
      await guardarEstrategia(Number(payload.secuenciaId), est);
      return { ok: true, resumen: `Estrategia de la secuencia #${Number(payload.secuenciaId)} guardada.` };
    },
  },

  editar_pasos_secuencia_mensajes: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      const entrada = (Array.isArray(input.pasos) ? input.pasos : []) as Array<Record<string, unknown>>;
      // ⚠️ CON RAMAS, «EL PASO 3» NO ES UN LUGAR DEL FLUJO. Reescribir la lista por orden en una
      // secuencia con condiciones, «Si responde» o saltos le movería a cada rama su siguiente: no se
      // escribe nada y se dice dónde se edita.
      if (!esLineal(s.pasos)) {
        return { error: `«${s.nombre}» tiene ramas (condiciones, «Si responde» o «Ir a»): sus pasos no se reescriben por orden. Se editan en el lienzo de /automations.` };
      }
      // Una acción o una espera (tarjeta) se conservan en su lugar: el merge es posicional.
      const conAcciones = s.pasos.some((p) => esPasoAccion(p) || esNodoDeControl(p));
      if (conAcciones && entrada.length !== s.pasos.length) {
        return { error: `«${s.nombre}» tiene pasos «Acción de MaKo» o esperas: por aquí sólo se cambian sus mensajes, con los mismos ${s.pasos.length} pasos en el mismo orden. Para agregar o quitar pasos, el lienzo de /automations.` };
      }
      const avisos: string[] = [];
      const cambiosDeTexto: string[] = [];
      let avisosAudio = false;
      const recorte = (t: string) => (t.length > 80 ? `${t.slice(0, 80)}…` : t);
      const pasos: PasoSecuencia[] = [];
      for (let i = 0; i < entrada.length; i++) {
        const previo = s.pasos[i];
        const e = entrada[i];
        if (!previo && (e.canal == null || e.cuerpo == null || e.delay_horas == null)) {
          return { error: `El paso ${i + 1} es nuevo: necesita canal, delay_horas y cuerpo.`, faltan: [`pasos[${i}].canal`, `pasos[${i}].delay_horas`, `pasos[${i}].cuerpo`] };
        }
        // Un paso de acción conserva su acción: de lo que mande el modelo sólo vale cuándo sale.
        if (previo && esPasoAccion(previo)) {
          pasos.push({ ...previo, ...(e.delay_horas != null ? { delay_horas: Number(e.delay_horas) || 0 } : {}), orden: i + 1 });
          continue;
        }
        // Una tarjeta «Esperar» queda como está: su espera se cambia con cambiar_espera_paso.
        if (previo && esNodoDeControl(previo)) {
          pasos.push({ ...previo, orden: i + 1 });
          continue;
        }
        const base: PasoSecuencia = previo ?? { orden: i + 1, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null };
        // null = «no lo pasaste» (la pantalla genérica manda null por cada campo vacío): se conserva el previo.
        const cambiosPaso = Object.fromEntries(Object.entries(e).filter(([, v]) => v != null));
        const p = { ...base, ...cambiosPaso, orden: i + 1 } as PasoSecuencia & Record<string, unknown>;
        // «ninguno» quita la condición o el ancla: sin esto no había forma de borrarlas.
        if (p.requiere === ('ninguno' as never)) delete p.requiere;
        if (p.ancla === ('ninguno' as never)) delete p.ancla;
        if (p.tipo === 'texto') { p.audio_id = null; p.media_id = null; }
        if (p.tipo === 'audio') {
          if (!p.audio_id || !(await getAudio(Number(p.audio_id)))) return { error: `El paso ${i + 1} es de audio y su audio_id no existe en este negocio.` };
        }
        if (p.tipo === 'media') {
          if (!p.media_id || !(await getAdjunto(Number(p.media_id)))) return { error: `El paso ${i + 1} es un archivo y su media_id no existe en este negocio.` };
        }
        if (RX_RELLENO.test(p.cuerpo) || RX_RELLENO.test(p.asunto ?? '')) avisos.push(`el paso ${i + 1} tiene un [corchete] y no va a salir nunca`);
        const cambiaTexto = !!previo && e.cuerpo != null && e.cuerpo !== previo.cuerpo;
        if (cambiaTexto) cambiosDeTexto.push(`paso ${i + 1}: «${recorte(previo!.cuerpo)}» → «${recorte(String(e.cuerpo))}»`);
        if (cambiaTexto && (previo!.variantes ?? []).length) avisos.push(`el paso ${i + 1} cambia de texto pero conserva ${previo!.variantes!.length} variantes del texto viejo`);
        // Un mensaje de VARIAS partes (cuarta tanda, punto 15): por acá se cambia la PRIMERA (los campos
        // de siempre son su espejo) y las demás se conservan (`partesAlGuardar`). Se dice, para que nadie
        // crea que reescribió el mensaje entero.
        if (previo && partesExplicitas(previo) && (cambiaTexto || e.tipo != null || e.audio_id != null || e.media_id != null)) {
          avisos.push(`el paso ${i + 1} son ${partesExplicitas(previo)!.length} mensajes seguidos: por aquí cambia sólo el primero, el resto se edita en el lienzo de /automations`);
        }
        // El motor manda sendWhatsappTemplate con template.name: Meta entrega el texto APROBADO, no el cuerpo.
        // No se pone template_wa en null: plantillaDesdePaso (lib/nutricion-plantillas.ts) es idempotente por
        // nombre y volvería a vincular la misma plantilla aprobada con el texto viejo.
        if (cambiaTexto && p.canal === 'whatsapp' && p.proveedor !== 'no_oficial' && p.template_wa) avisos.push(`el paso ${i + 1} es de WhatsApp oficial: sigue saliendo la plantilla aprobada «${p.template_wa}» con el texto anterior hasta editarla en Meta`);
        if (p.tipo === 'audio' && p.canal === 'whatsapp') avisosAudio = true;
        pasos.push(p);
      }
      if (!pasos.length) return { error: 'La lista de pasos está vacía.', faltan: ['pasos'] };
      const borrados = s.pasos.length > pasos.length ? ` y borrar ${s.pasos.length - pasos.length}` : '';
      if (avisosAudio) avisos.push('los pasos de audio a leads que todavía no son clientes quedan como borrador para que alguien los mande');
      return {
        // `relinear`: la cadena vuelve a seguir el orden de la lista nueva. Sin esto, un paso
        // agregado al final quedaba suelto (el anterior decía «termina») y uno borrado del medio
        // dejaba a su anterior apuntando a la nada: `validarGrafo` los rechazaba.
        payload: { secuenciaId: id, pasos: relinear(pasos) },
        resumen: `Reescribir los pasos de «${s.nombre}»: quedan ${pasos.length}${borrados}`
          + `${cambiosDeTexto.length ? `. Textos que cambian: ${cambiosDeTexto.join(' · ')}` : ''}`
          + `${avisos.length ? `. Ojo: ${avisos.join('; ')}` : ''}`,
      };
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId);
      if (!(await secuenciaVigente(id))) return { ok: false, resumen: 'La secuencia ya no existe o se archivó.' };
      await setSecuenciaPasos(id, payload.pasos as PasoSecuencia[]);
      return { ok: true, resumen: `Pasos de la secuencia #${id} guardados.` };
    },
  },

  // Los CRON de una automatización, por la MISMA puerta que la pantalla (lib/disparadores-guardar.ts).
  // `preparar` chequea TODO lo que se puede saber sin escribir (la etapa, el producto, la etiqueta, el
  // evento): un rechazo al confirmar consumiría la pendiente.
  cambiar_crons_secuencia: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      // `ignorar` y `cron.dias` llegan como textos (el validador no tiene listas de números): el saneador
      // del CRON (`sanearDisparador` / `sanearCron`) ya los convierte, como con lo que manda la pantalla.
      try {
        const { lista, previos } = await prepararDisparadores(id, input.crons);
        if (firmaLista(lista) === firmaLista(previos)) return { error: `«${s.nombre}» ya arranca por esos CRON.`, yaEstaba: true };
        // Sin leer la zona del negocio: `tzDeWorkspace` la ESCRIBE si falta, y preparar() no escribe.
        const textos = lista.map(textoDeUnCron);
        return {
          payload: { secuenciaId: id, crons: lista },
          resumen: `Cambiar los CRON de «${s.nombre}» (${previos.length} → ${lista.length}): ${textos.join(' · ')}.${s.activa ? ' Está ACTIVA: la próxima corrida inscribe con los CRON nuevos.' : ''}`,
        };
      } catch (e) {
        if (e instanceof TriggerInvalidoError) return { error: e.message };
        throw e;
      }
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId);
      if (!(await secuenciaVigente(id))) return { ok: false, resumen: 'La automatización ya no existe o se archivó.' };
      try {
        const quedo = await guardarDisparadores(id, payload.crons);
        return { ok: true, resumen: `Listo: la automatización #${id} arranca por ${quedo.length} CRON.`, datos: { disparadores: quedo } };
      } catch (e) {
        if (e instanceof TriggerInvalidoError) return { ok: false, resumen: e.message };
        throw e;
      }
    },
  },

  agregar_escenario_secuencia: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      // `contestaSolo` sólo con un `true` literal (#787): el default es el borrador de siempre.
      const escenario: EscenarioSecuencia = {
        titulo: str(input, 'titulo'), cuando: str(input, 'cuando'), comoResponder: str(input, 'comoResponder'),
        ...(input.contestaSolo === true ? { contestaSolo: true } : {}),
      };
      // ⚠️ CON «SI RESPONDE», EL CASO ES UNA RAMA DE LA TARJETA: en `estrategia.escenarios` ya no lo
      // lee nadie (el clasificador de esa secuencia lee los casos de la tarjeta).
      // ⚠️ CON UN AI STEP (undécima tanda), UN ESCENARIO MÁS ADENTRO DEL AI STEP, sobre lo JUNTO (`juntarPasosIA`):
      // «mismo nombre = el mismo escenario» mira todos los escenarios, no sólo los de la primera tarjeta de antes. La
      // libertad la escribe `agregarCasoAlGrafo` (plata → nunca «Sola») y el resumen dice la que QUEDA.
      const pasos = juntarPasosIA(s.pasos).pasos;
      if (raizRespuesta(pasos) != null) {
        const r = agregarCasoAlGrafo(pasos, escenario);
        if ('error' in r) return { error: `No se puede agregar el caso en «${s.nombre}»: ${r.error}.` };
        const donde = dondeEntra(r.pasos, escenario.titulo);
        const solo = donde.startsWith('como rama') && escenario.contestaSolo ? ' (MaKo contesta solo)' : '';
        return { payload: { secuenciaId: id, escenario }, resumen: `Agregar el caso «${escenario.titulo}» ${donde} en «${s.nombre}»${solo}` };
      }
      const est = parseEstrategia(s.estrategia);
      if (!est) return { error: `La secuencia «${s.nombre}» no tiene estrategia: guárdala primero con guardar_estrategia_secuencia.` };
      const reemplaza = est.escenarios.some((x) => x.titulo === escenario.titulo);
      if (!reemplaza && est.escenarios.length >= 30) return { error: `La secuencia «${s.nombre}» ya tiene 30 casos, el máximo.` };
      return { payload: { secuenciaId: id, escenario }, resumen: `${reemplaza ? 'Reemplazar' : 'Agregar'} el caso «${escenario.titulo}» en «${s.nombre}»${escenario.contestaSolo ? ' (MaKo contesta solo)' : ''}` };
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId);
      const s = await secuenciaVigente(id);
      const pasos = s ? juntarPasosIA(s.pasos).pasos : [];
      if (s && raizRespuesta(pasos) != null) {
        const r = agregarCasoAlGrafo(pasos, payload.escenario as EscenarioSecuencia);
        if ('error' in r) return { ok: false, resumen: `No se agregó el caso: ${r.error}.` };
        // Todo escritor de pasos pasa por `setSecuenciaPasos` (sanea, junta y valida).
        await setSecuenciaPasos(id, r.pasos);
        const titulo = (payload.escenario as EscenarioSecuencia).titulo;
        return { ok: true, resumen: `Caso «${titulo}» agregado ${dondeEntra(r.pasos, titulo)} de «${s.nombre}».` };
      }
      const est = s ? parseEstrategia(s.estrategia) : null;
      if (!s || !est) return { ok: false, resumen: 'La secuencia ya no existe o se quedó sin estrategia.' };
      const e = payload.escenario as EscenarioSecuencia;
      // Mismo merge que resolverHandoff: se suma al final, el orden es el orden en que se enseñó.
      await guardarEstrategia(id, { ...est, escenarios: [...est.escenarios.filter((x) => x.titulo !== e.titulo), e] });
      return { ok: true, resumen: `Caso «${e.titulo}» guardado en «${s.nombre}».` };
    },
  },

  resolver_handoff: {
    preparar: async (input) => {
      const id = num(input, 'handoffId');
      const h = await handoffFila(id);
      if (!h) return { error: `No existe el hand-off #${id} en este negocio.` };
      if (h.resuelto_at) return { error: `El hand-off #${id} ya está resuelto.` };
      // secuenciaFila y no secuenciaVigente: resolverHandoff escribe el caso aunque la secuencia esté archivada.
      const s = h.secuencia_id != null ? await secuenciaFila(h.secuencia_id) : null;
      const est = s ? parseEstrategia(s.estrategia) : null;
      const escenario = { titulo: str(input, 'titulo'), cuando: str(input, 'cuando'), comoResponder: str(input, 'comoResponder') };
      // Con «Si responde» el caso entra como RAMA (resolverHandoff, lib/chat-agent-handoff.ts): el
      // tope y lo que se dice salen de la tarjeta, no de la estrategia.
      // Con un AI Step (undécima tanda), sobre lo JUNTO: entra como un escenario más adentro (`agregarCasoAlGrafo`).
      const pasos = s && Array.isArray(s.pasos) ? juntarPasosIA(s.pasos as PasoSecuencia[]).pasos : [];
      if (s && raizRespuesta(pasos) != null) {
        const r = agregarCasoAlGrafo(pasos, escenario);
        if ('error' in r) return { error: `No se puede enseñar el caso en «${s.nombre}»: ${r.error}.` };
        return { payload: { handoffId: id, escenario }, resumen: `Resolver el hand-off #${id} con el caso «${escenario.titulo}» (se suma ${dondeEntra(r.pasos, escenario.titulo)} en «${s.nombre}») y reactivar al lead` };
      }
      // resolverHandoff agrega al FINAL y escenariosDe recorta a 30 en la próxima lectura: el caso enseñado
      // desaparecería en silencio con el hand-off ya resuelto y la inscripción reactivada.
      if (s && est && est.escenarios.length >= 30 && !est.escenarios.some((x) => x.titulo === escenario.titulo)) {
        return { error: `La secuencia «${s.nombre}» ya tiene 30 casos, el máximo: reemplaza uno con agregar_escenario_secuencia (mismo título) antes de resolver este hand-off.` };
      }
      const guarda = !s ? 'el hand-off no tiene secuencia: el caso NO se guarda, solo se resuelve'
        : est ? `se suma a «${s.nombre}»${s.archivada_at ? ', que está archivada' : ''}`
        : `«${s.nombre}» no tiene estrategia: el caso NO se guarda, solo se resuelve`;
      return { payload: { handoffId: id, escenario }, resumen: `Resolver el hand-off #${id} con el caso «${escenario.titulo}» (${guarda}) y reactivar al lead` };
    },
    ejecutar: async (payload) => {
      await resolverHandoff(Number(payload.handoffId), payload.escenario as EscenarioSecuencia);
      return { ok: true, resumen: `Hand-off #${Number(payload.handoffId)} resuelto.` };
    },
  },

  archivar_secuencia: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaFila(id);
      if (!s) return { error: `No existe la secuencia #${id} en este negocio.` };
      if (s.archivada_at) return { error: `La secuencia «${s.nombre}» ya está archivada.` };
      const vivas = await inscripcionesVivas(id);
      return { payload: { secuenciaId: id }, resumen: `Archivar «${s.nombre}» y cancelar ${vivas ?? 'sus'} inscripciones vivas (esos leads no pueden volver a entrar)` };
    },
    ejecutar: async (payload) => {
      const id = Number(payload.secuenciaId);
      // archivarSecuencias([]) o sin ids archiva TODAS las del negocio: el id se exige acá.
      if (!Number.isInteger(id) || id < 1) return { ok: false, resumen: 'Falta el id de la secuencia.' };
      const r = await archivarSecuencias([id]);
      return r.archivadas ? { ok: true, resumen: `Secuencia #${id} archivada; ${r.inscripcionesCanceladas} inscripciones canceladas.` } : { ok: false, resumen: 'La secuencia ya estaba archivada o no existe.' };
    },
  },

  probar_secuencia: {
    // ⚠️ UN ESCENARIO, NO TODOS LOS PASOS (14/10/2026). Mandar cada mensaje del array mandaba juntas las ramas que se
    // excluyen (el «Sí» y el «No» de una condición): una prueba que ningún lead recibe. Con más de un escenario se elige
    // por su número (`escenarios_secuencia`); con uno solo, ése. Todo se sabe sin escribir: falla en `preparar()`.
    preparar: async (input) => {
      const id = num(input, 'secuenciaId');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      if (!s.pasos.length) return { error: `La secuencia «${s.nombre}» no tiene pasos para probar.` };
      const pedido = input.escenario != null ? num(input, 'escenario') : null;
      const e = await escenarioDePrueba(id, pedido);
      if (!e.ok) return { error: e.error };
      if (pedido == null && e.total > 1) {
        return { error: `«${s.nombre}» tiene ${e.total} escenarios: di cuál con "escenario" (el número de escenarios_secuencia).` };
      }
      if (!e.mensajes.length) return { error: `El escenario ${e.numero} de «${s.nombre}» no le manda ningún mensaje al lead: no hay nada que probar.` };
      const c = await getContactoReportes();
      if (!c.telefono && !c.email) return { error: 'El dueño no tiene teléfono ni email en Perfil: cárgalos para recibir la prueba.' };
      const destinos = [c.telefono ? `WhatsApp terminado en ${c.telefono.replace(/\D/g, '').slice(-4)}` : null, c.email ? `email ${c.email}` : null].filter(Boolean).join(' y ');
      const camino = e.camino.length ? ` (${e.camino.join(' → ')})` : '';
      const cuantos = e.mensajes.length === 1 ? 'el mensaje' : `los ${e.mensajes.length} mensajes`;
      return {
        payload: { secuenciaId: id, escenario: e.numero },
        resumen: `Mandar ${cuantos} del escenario ${e.numero}${camino} de «${s.nombre}», marcados [PRUEBA], a tu ${destinos}`,
      };
    },
    ejecutar: async (payload) => {
      const r = await probarSecuencia(Number(payload.secuenciaId), { escenario: Number(payload.escenario) || 1 });
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Prueba enviada: ${r.enviadosWa} por WhatsApp y ${r.enviadosEmail} por email.${r.avisos.length ? ` ${[...new Set(r.avisos)].join(' ')}` : ''}` };
    },
  },

  guardar_link_video: {
    preparar: async (input) => {
      const link = str(input, 'linkVideo');
      if (!/^https?:\/\/\S+$/i.test(link)) return { error: 'El link tiene que ser una URL completa que empiece con http:// o https://, sin espacios.' };
      return { payload: { linkVideo: link }, resumen: `Guardar el link del video de preparación: ${link}` };
    },
    ejecutar: async (payload) => {
      await setSetting(KEY_LINK_VIDEO, String(payload.linkVideo));
      return { ok: true, resumen: 'Link del video guardado. Las secuencias ya armadas lo toman al rearmarlas desde los audios.' };
    },
  },

  crear_lead_magnet: {
    preparar: async (input) => {
      const nombre = str(input, 'nombre'); const enlace = str(input, 'enlace');
      if (!/^https?:\/\/\S+$/i.test(enlace)) return { error: 'El enlace tiene que ser una URL completa que empiece con http:// o https://, sin espacios.' };
      return { payload: { nombre, enlace }, resumen: `Crear el lead magnet «${nombre}» con el enlace ${enlace}` };
    },
    ejecutar: async (payload) => {
      const id = await crearLeadMagnet(String(payload.nombre), String(payload.enlace));
      return { ok: true, resumen: `Lead magnet «${String(payload.nombre)}» creado.`, datos: { leadMagnetId: id } };
    },
  },

  borrar_audio: {
    preparar: async (input) => {
      const audioId = num(input, 'audioId');
      const a = await getAudio(audioId);
      if (!a) return { error: `No existe el audio #${audioId} en este negocio.` };
      // En CUALQUIER parte del mensaje, no sólo en el espejo de la primera (`pasosUsanAudio`): el audio
      // de la segunda parte se podía borrar y el motor fallaba en cada lead.
      const usan = (await getSecuenciasConStats()).filter((s) => pasosUsanAudio(s.pasos, audioId));
      if (usan.length) return { error: `El audio «${a.titulo}» lo usan pasos de: ${usan.map((s) => `«${s.nombre}» (#${s.id})`).join(', ')}. Quítaselo primero con asignar_audio_paso.` };
      return { payload: { audioId }, resumen: `Borrar para siempre la nota de voz «${a.titulo}»` };
    },
    ejecutar: async (payload) => {
      const audioId = Number(payload.audioId);
      if ((await getSecuenciasConStats()).some((s) => pasosUsanAudio(s.pasos, audioId))) return { ok: false, resumen: 'Un paso empezó a usar este audio: no se borró.' };
      await borrarAudio(audioId);
      await quitarAudioDeClaves(audioId);
      return { ok: true, resumen: `Audio #${audioId} borrado.` };
    },
  },

  responder_huecos_voz: {
    preparar: async (input) => {
      const respuestas = Object.fromEntries(CLAVES_BLOQUE_VOZ.map((k) => [k, str(input, k)]).filter(([, v]) => v));
      if (!Object.keys(respuestas).length) return { error: 'Pasa al menos un bloque (tono, preguntas, objeciones, cierre o patron).', faltan: ['tono'] };
      return { payload: { respuestas }, resumen: `Completar la guía de voz con: ${Object.keys(respuestas).join(', ')}` };
    },
    ejecutar: async (payload) => {
      const r = await responderHuecosVoz(payload.respuestas as Record<string, string>);
      return { ok: true, resumen: r.guiaActualizada ? 'Guía de voz actualizada.' : 'Respuestas guardadas; la guía todavía no tiene contenido para componerse.' };
    },
  },

  armar_secuencias_de_audios: {
    preparar: async () => {
      const [porClave, audios, existentes] = await Promise.all([leerAudiosPorClave(), listAudios(), secuenciasChatAgent()]);
      const vivos = new Set(audios.map((a) => a.id));
      // Solo las situaciones que armarSecuenciasDeAudios consume: con otras, confirmar devolvía «faltan audios».
      const cubiertas = Object.entries(porClave).filter(([k, id]) => k in AUDIO_A_SECUENCIA && vivos.has(id)).map(([k]) => k);
      if (!cubiertas.length) return { error: 'No hay audio asignado a bienvenida, agenda_con_bienvenida ni agenda_primer_contacto, que son las únicas situaciones que se convierten en secuencia.' };
      const porClaveSec = new Map(existentes.map((s) => [s.clave, s]));
      const detalle = cubiertas.map((k) => {
        const s = porClaveSec.get(AUDIO_A_SECUENCIA[k]);
        if (!s) return `${k}: secuencia nueva, nace pausada`;
        if (s.archivada_at) return `${k}: «${s.nombre}» está archivada y se DESARCHIVA${s.activa ? ' prendida: vuelve a enviar' : ' (pausada)'}`;
        return `${k}: se reescribe «${s.nombre}»${s.activa ? ', que está ACTIVA: manda los pasos nuevos en el acto' : ' (pausada)'}`;
      });
      const vieja = cubiertas.some((k) => k.startsWith('agenda_')) && porClaveSec.get('chat-agent-post-agenda') && !porClaveSec.get('chat-agent-post-agenda')!.archivada_at
        ? '. Además se archiva y pausa la post-agenda vieja' : '';
      // ⚠️ «PIERDEN SUS CAMBIOS DE TEXTO» YA NO ES CIERTO PARA UNA DE TARJETAS (desde el 08/10/2026): sobre
      // un flujo, rearmar sólo le cambia el audio a su tarjeta (`audiosDeLaListaEnElFlujo`,
      // lib/secuencias-audios.ts). Lo de perder el texto y las variantes vale sólo para una lista de antes.
      return { payload: {}, resumen: `Armar o rearmar las automatizaciones del onboarding. ${detalle.join('; ')}${vieja}. Una de tarjetas sólo cambia sus audios; una lista de antes se reescribe y pierde sus cambios de texto y variantes.` };
    },
    ejecutar: async () => {
      const link = await getSetting(KEY_LINK_VIDEO).catch(() => null);
      const r = await armarSecuenciasDeAudios((link ?? '').trim() || null);
      if (!r.length) return { ok: false, resumen: 'No se armó ninguna secuencia: faltan audios.' };
      return { ok: true, resumen: `Secuencias armadas: ${r.map((x) => `«${x.nombre}» (${x.creada ? 'nueva, pausada' : 'reescrita'})`).join(', ')}.` };
    },
  },

  destilar_voz: {
    preparar: async () => ({ payload: {}, resumen: 'MaKo reescribe la guía de voz desde las transcripciones de tus anuncios y tu perfil de marca (usa IA; pisa la guía actual)' }),
    ejecutar: async () => {
      const r = await destilarVoz();
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Guía de voz destilada desde ${r.fuentes} fuentes.`, datos: { costo_usd: r.uso?.costUsd ?? null } };
    },
  },

  enviar_plantilla_meta_paso: {
    preparar: async (input) => {
      const id = num(input, 'secuenciaId'); const orden = num(input, 'orden');
      const s = await secuenciaVigente(id);
      if (!s) return { error: noExiste(id) };
      const p = s.pasos.find((x) => x.orden === orden);
      if (!p) return { error: `La secuencia «${s.nombre}» no tiene paso ${orden}.` };
      if (p.canal !== 'whatsapp' || p.proveedor === 'no_oficial') return { error: 'Solo los pasos de WhatsApp oficial usan plantilla de Meta.' };
      if (!p.cuerpo?.trim() || RX_RELLENO.test(p.cuerpo)) return { error: 'El paso no tiene texto terminado: escríbelo primero.' };
      return { payload: { secuenciaId: id, orden }, resumen: `Convertir el paso ${orden} de «${s.nombre}» en plantilla de Meta y mandarla a aprobar (usa IA y el cupo de plantillas${p.template_wa ? `; si «${p.template_wa}» ya está aprobada o en revisión no se reemplaza` : ''})` };
    },
    ejecutar: async (payload) => {
      const r = await plantillaDesdePaso(Number(payload.secuenciaId), Number(payload.orden));
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Plantilla «${r.name}»: ${r.status}.${r.nota ? ` ${r.nota}` : ''}`, datos: { costo_usd: r.uso?.costUsd ?? null } };
    },
  },
};
