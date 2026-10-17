// =============================================================================
// editor-acciones — el catálogo de acciones COMO LO PRESENTA el paso «⚡ Acción»
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 7): «El editor de Acción esta muy complejo,
// simplificalo... Y sobre todo el desplegable de acciones, como son tantas, tantas, debe estar muy
// bien diseñado. Tener barra de busqueda y también que sea modular, como tenemos el desplegable de
// Plan, de una sección se abren opciones.»
//
// Tercera tanda (09/10/2026, punto 16), textual: «Le puse "Mover un lead de etapa" y me pide un campo
// abierto para colocar el nombre de la etapa? En lugar de un desplegable para seleccionar las que tengo
// disponible? Y abajo me aparece "Monto" y "Motivo", no tiene nada de sentido... cada cosa debes
// configurar bien los campos. También siento que pusiste muchísimas acciones que tal vez no son
// necesarias...». Decisión 16 del diseño (docs/chatbot-flujo-ramas-diseno.md).
//
// Acá vive, PURO y con test (tests/editor-acciones.test.ts), lo que decide cómo se ve el catálogo:
//   · la LISTA CORTA de acciones que ofrece el lienzo (`ACCIONES_DEL_FLUJO`): las que tienen sentido
//     CORRIENDO SOLAS sobre el lead de un flujo. El resto del registro sigue existiendo para la API y
//     el doer, y un paso ya guardado con una de ellas se sigue dibujando y editando;
//   · los RÓTULOS de los parámetros, con tildes: el `rotulo?` de la def (lib/api-mako/tipos.ts)
//     gana; si no lo tiene, este diccionario de respaldo; si tampoco, el nombre partido. Antes los
//     derivaba el componente del camelCase y salían «Titulo», «Razon», «Anio», «Kpi id»;
//   · el ÁRBOL del selector: un ÁREA por sección (CRM, Customer Success, WhatsApp), con su ícono, y
//     adentro los bloques separados por una línea (sexta tanda, ACTION 1: «siempre con el arbol»);
//   · el CONTROL de cada parámetro (`controlDe`): la etapa con producto + etapa, la etiqueta, la
//     automatización, la persona del equipo, el monto con su moneda, la fecha;
//   · qué campos se ven según lo elegido (`repartoDelFormulario`): monto y motivo sólo al mover a una
//     etapa que los pide (la regla es la del CRM: `datosQuePideLaEtapa` → lib/stage-requirements.ts);
//   · la LÍNEA de qué hace una acción, sacada de su descripción;
//   · qué operaciones son de ETIQUETA (la tarjeta 🏷️ es una presentación sobre ellas), su verbo
//     («Agregar» / «Eliminar») y cómo una tarjeta con VARIAS etiquetas corre una por etiqueta.
//
// ⚠️ NO VIVE EN lib/api-mako/ A PROPÓSITO. Un componente `'use client'` sólo puede importar valores
//    de cuatro módulos de esa carpeta (tests/api-mako-registro.test.ts: alcance, flujo-params,
//    permisos, tokens-forma), y por buenas razones: el resto trae el registro con sus descripciones.
//    Éste importa CERO valores del registro (sólo tipos), así que el editor lo puede usar sin meter
//    el catálogo entero en el bundle del navegador.
// ⚠️ LAS DESCRIPCIONES DEL REGISTRO SE ESCRIBIERON PARA EL MODELO, no para una persona: arrancan con
//    «PROPONE …» y dicen «queda pendiente hasta el «sí»», que en un flujo es FALSO (la acción corre
//    sola, decisión del 08/10/2026). La línea de qué hace las limpia (`resumenDeAccion`): sin el
//    verbo del protocolo, sin el paréntesis y sin las MAYÚSCULAS de énfasis.
// =============================================================================

import type { Parametro, TipoParametro } from './api-mako/tipos';
// Puro y sin `server-only` (lo importa el tablero del CRM en el navegador): es la MISMA regla con la
// que el CRM decide qué pide mover a una etapa. Ver `datosQuePideLaEtapa`.
import { funnelReqInfo, stepsForStage } from './stage-requirements';
import type { EtapaLite } from './funnel-etapas';
// Sólo el TIPO: los nombres del set de íconos de la casa. El dibujo lo hace el desplegable.
import type { NombreIconoMenu } from '../app/_ui/iconos-menu';

// ── Rótulos ─────────────────────────────────────────────────────────────────────────────────

/**
 * El rótulo de un parámetro cuando la def no trae `rotulo`. Por NOMBRE EXACTO: un `id` que en un
 * flujo es otra cosa (`secuenciaId` es una «Automatización», `embudoId` un «Producto») o una sigla.
 * Lo que no está acá sale de partir el nombre y ponerle las tildes por palabra (`TILDES`).
 */
export const ROTULOS_PARAMETRO: Readonly<Record<string, string>> = {
  leadId: 'Lead', etiquetaId: 'Etiqueta', secuenciaId: 'Automatización', embudoId: 'Funnel',
  kpiId: 'KPI', objectiveId: 'Objetivo', pagoId: 'Cuota', audioId: 'Audio', handoffId: 'Caso',
  miembro_id: 'Miembro', recording_id: 'Grabación', facturado_por_id: 'Facturado por',
  campaignId: 'Campaña', adsetId: 'Conjunto', adId: 'Anuncio', ad_id: 'Anuncio', contactId: 'Contacto',
  chatJid: 'Chat', celdaId: 'Anuncio', guionId: 'Guion', retroId: 'Retro', projId: 'Proyecto',
  lead_magnet_id: 'Lead magnet', waLabelId: 'Etiqueta del celular', labelId: 'Etiqueta del celular',
  cual: 'Reunión', which: 'Reunión', on: 'Prendido', anio: 'Año', quarter: 'Trimestre', metaValor: 'Meta',
  deadline: 'Fecha límite', startIso: 'Horario', orden: 'Paso', delayHoras: 'Espera (h)',
  duracion_min: 'Duración (min)', ventana_dias: 'Ventana (días)', programado_at: 'Cuándo',
  emailPrueba: 'Email de prueba', preheader: 'Vista previa', url: 'URL', desc: 'Descripción',
  montoMxn: 'Monto (MXN)', montoMonedaCuenta: 'Monto', monto_usd: 'Monto (USD)', total_usd: 'Total (USD)',
  presupuesto_usd: 'Presupuesto (USD)', cobro_inicial_usd: 'Cobro inicial (USD)', monto_cuota_usd: 'Cuota (USD)',
  total_cuotas: 'Cuotas', rol_ws: 'Rol', timezone: 'Zona horaria', trigger_tipo: 'Disparador', trigger: 'Disparador',
  es_default: 'Predeterminada', fiscal_razon: 'Razón social', fiscal_id_fiscal: 'Id fiscal', id_fiscal: 'Id fiscal',
  esVsl: 'Es el VSL', fomo: 'FOMO', cta: 'Llamado a la acción', cta_type: 'Botón', primary_text: 'Texto principal',
  headline: 'Título', description: 'Descripción', destination_url: 'URL de destino', name: 'Nombre', label: 'Nombre',
  body: 'Cuerpo', header: 'Encabezado', footer: 'Pie', language: 'Idioma', note: 'Nota', summary: 'Resumen',
  next_step: 'Siguiente paso', outcome: 'Desenlace', outcome_tone: 'Tono del desenlace', angle: 'Ángulo',
  anguloId: 'Ángulo', estructuraId: 'Estructura', key: 'Clave', notaExcepcion: 'Nota', maxLeads: 'Máximo de leads',
  diasAtras: 'Días atrás', sitioUrl: 'URL del sitio', privacidadUrl: 'URL de privacidad', page: 'Página',
  senalesMeta: 'Señales en Meta', queEs: 'Qué es', comoResponder: 'Cómo responder', contestaSolo: 'Contesta solo',
  linkVideo: 'Link del video', fuenteId: 'Fuente', deId: 'De', aId: 'A', itemId: 'Ítem',
  // Los de las operaciones de Meta y del Pixel, que vienen en inglés o pegados (medido sobre las 200
  // acciones del registro el 08/10/2026: eran los únicos rótulos que salían en inglés o sin tilde).
  category: 'Categoría', image_hash: 'Imagen', lead_form_id: 'Formulario', media_type: 'Tipo de archivo',
  source_ad_id: 'Anuncio de origen', ref: 'Referencia', params: 'Parámetros', descripcionHtml: 'Descripción',
  despuesDe: 'Después de', moduloClave: 'Módulo', servicio_que_es: 'Qué es el servicio', sinWhatsApp: 'Sin WhatsApp',
  videoUrl: 'URL del video',
};

/**
 * Las tildes POR PALABRA, para lo que se arma partiendo el nombre: «fecha_termino» → «Fecha
 * término», «anio» no (va entero en el diccionario de arriba). Sólo palabras que en un nombre de
 * parámetro no pueden ser otra cosa: «cuando» sí (es siempre la pregunta), «que» no (en
 * «servicio_que_es» es un relativo y con tilde quedaría mal).
 */
const TILDES: Readonly<Record<string, string>> = {
  titulo: 'título', razon: 'razón', descripcion: 'descripción', telefono: 'teléfono', duracion: 'duración',
  metrica: 'métrica', definicion: 'definición', termino: 'término', decision: 'decisión', hipotesis: 'hipótesis',
  direccion: 'dirección', garantia: 'garantía', dia: 'día', dias: 'días', situacion: 'situación',
  implicacion: 'implicación', patron: 'patrón', categoria: 'categoría', seccion: 'sección', reunion: 'reunión',
  publico: 'público', cuando: 'cuándo', exito: 'éxito', ambar: 'ámbar', item: 'ítem', items: 'ítems',
  angulo: 'ángulo', asistio: 'asistió', pagina: 'página', automatizacion: 'automatización', accion: 'acción',
  codigo: 'código', numero: 'número', nutricion: 'nutrición', informacion: 'información', opcion: 'opción',
  pais: 'país', minimo: 'mínimo', maximo: 'máximo', ultimo: 'último', proximo: 'próximo', periodo: 'período',
  estandar: 'estándar', intencion: 'intención', suscripcion: 'suscripción', diagnostico: 'diagnóstico',
  despues: 'después', modulo: 'módulo',
};

/** El nombre partido en palabras y con sus tildes: «fechaPago» → «Fecha pago», «anio» → «Año». */
function rotuloDerivado(nombre: string): string {
  const palabras = nombre
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  // «secuencia id» → «secuencia»: el id es cómo se guarda, no qué es.
  if (palabras.length > 1 && palabras[palabras.length - 1] === 'id') palabras.pop();
  const s = palabras.map((p) => TILDES[p] ?? p).join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * El rótulo de un parámetro, desde UN lugar: el de la def, el del diccionario o el derivado.
 * Recibe cualquier cosa con `nombre` (y `rotulo?`), así sirve igual para la def del registro y para
 * lo que baja al editor por la API.
 */
export function rotuloDeParametro(p: { nombre: string; rotulo?: string | null }): string {
  const propio = typeof p.rotulo === 'string' ? p.rotulo.trim() : '';
  return propio || ROTULOS_PARAMETRO[p.nombre] || rotuloDerivado(p.nombre);
}

// ── La línea de qué hace ────────────────────────────────────────────────────────────────────

/** Las siglas que se quedan en mayúsculas; el resto de las MAYÚSCULAS son énfasis para el modelo. */
const SIGLAS = new Set(['CRM', 'KPI', 'USD', 'MXN', 'IANA', 'URL', 'VSL', 'FOMO', 'CBO', 'ABO', 'IA', 'DNS', 'ID', 'RFC', 'CUIT', 'NIT', 'EIN', 'API', 'PDF', 'CSV', 'R1', 'R2', 'UTC', 'ON', 'OFF']);

/** El tope de la línea: entra en un renglón del desplegable y debajo del selector. */
export const TOPE_RESUMEN = 90;

/**
 * UNA línea de qué hace la acción, para una persona: la primera frase de la descripción, sin el
 * verbo del protocolo («PROPONE»), sin paréntesis («queda pendiente hasta el «sí»», que en un flujo
 * no pasa), sin las mayúsculas de énfasis y con tope.
 *
 * ⚠️ LOS PARÉNTESIS SE SACAN, NO SE CORTA AHÍ. La primera versión cortaba la frase en el primer
 * «(», y «Propone crear (sin id) o editar (con id) un objetivo…» quedaba en «Crear»: siete de las
 * 200 acciones tenían una línea de una o dos palabras (medido sobre el registro el 08/10/2026).
 */
export function resumenDeAccion(descripcion: string): string {
  let s = (descripcion ?? '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^propone\s+/i, '');
  // Los paréntesis, de adentro para afuera (un anidado sale en dos vueltas).
  for (let antes = ''; antes !== s;) { antes = s; s = s.replace(/\s*\([^()]*\)/g, ''); }
  // La primera frase: hasta un punto, dos puntos o punto y coma.
  const corte = s.search(/[.:;](\s|$)/);
  if (corte > 0) s = s.slice(0, corte);
  // Una coma después de un trecho ya largo suele abrir la letra chica («…elegida, aunque no…»).
  const coma = s.indexOf(', ', 30);
  if (coma > 0) s = s.slice(0, coma);
  s = s.replace(/(?<!\p{L})(\p{Lu}[\p{Lu}\d]+)(?!\p{L})/gu, (w) => (SIGLAS.has(w) ? w : w.toLowerCase()));
  s = s.trim();
  if (s.length > TOPE_RESUMEN) {
    const hasta = s.lastIndexOf(' ', TOPE_RESUMEN - 1);
    s = `${s.slice(0, hasta > 40 ? hasta : TOPE_RESUMEN - 1).replace(/[\s,;:]+$/, '')}…`;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Las acciones del lienzo, en ÁRBOL por área ──────────────────────────────────────────────

/**
 * LAS ÁREAS: el primer nivel del selector, en orden, con su ícono (sexta tanda, ACTION 1, textual:
 * «Faltan muchas acciones posibles que podríamos agregar, siempre con el arbol...»). Se abre el área y
 * adentro están sus acciones; buscar aplana (el `Dropdown` de la casa, `secciones`).
 */
export const AREAS_ACCION = ['CRM', 'Customer Success', 'WhatsApp'] as const;
export type AreaAccion = (typeof AREAS_ACCION)[number];
export const ICONO_AREA: Readonly<Record<AreaAccion, NombreIconoMenu>> = { CRM: 'equipo', 'Customer Success': 'cliente', WhatsApp: 'whatsapp' };

/**
 * Los BLOQUES de un área: adentro de un área se separan con una línea, no con otro clic. Tres niveles
 * (CRM › Etiquetas › Agregar) eran un clic de más sobre once acciones que ya se buscan escribiendo.
 */
export const GRUPOS_ACCION = ['Etapa y funnels', 'Etiquetas', 'Ficha', 'Agenda', 'Equipo', 'Automatizaciones', 'Cliente', 'Chat'] as const;
export type GrupoAccion = (typeof GRUPOS_ACCION)[number];
/** El área de cada bloque. `Automatizaciones` sólo tiene las que el selector no ofrece (`FUERA_DEL_SELECTOR`). */
export const AREA_DE_GRUPO: Readonly<Record<GrupoAccion, AreaAccion>> = {
  'Etapa y funnels': 'CRM', Etiquetas: 'CRM', Ficha: 'CRM', Agenda: 'CRM', Equipo: 'CRM', Automatizaciones: 'CRM',
  Cliente: 'Customer Success', Chat: 'WhatsApp',
};

/** Una acción que el lienzo ofrece: su id del registro y cómo se presenta en un flujo. */
export type AccionDelFlujo = {
  id: string;
  /** El nombre en el lienzo (el del registro está escrito para el modelo: «Meter un lead en una secuencia»). */
  titulo: string;
  /** La línea de qué hace, debajo del nombre. Corta: es texto que se DIBUJA. */
  que: string;
  grupo: GrupoAccion;
  /** El ícono del renglón, del set de la casa (general 10: «pon íconos en todos los desplegable»). */
  icono: NombreIconoMenu;
};

/**
 * LAS ACCIONES QUE OFRECE EL LIENZO, en orden y por bloque. Es el ÚNICO lugar donde vive esta lista:
 * `accionesParaFlujo` (lib/api-mako/flujo.ts) la aplica al armar el catálogo, y el selector sólo
 * ofrece éstas.
 *
 * El criterio, medido contra las 200 acciones del registro el 09/10/2026: que tenga sentido CORRIENDO
 * SOLA sobre el lead del flujo, sin una persona mirando, y que no cueste plata. La sexta tanda (ACTION 1:
 * «Faltan muchas acciones») sumó las que cumplían y estaban afuera:
 *   · `quitar_lead_de_producto`: sólo saca de uno de dos o más (del único no deja, y lo dice);
 *   · `ignorar_datos_sin_marcar` / `reactivar_datos_sin_marcar`: callar o volver a contar sus
 *     pendientes en «Datos sin marcar» (p.ej. al etiquetarlo «Spam»);
 *   · `aplicar_etiqueta_lead_whatsapp`: deja en su chat la etiqueta del celular de su etapa.
 * Siguen afuera, con su porqué:
 *   · las que piden un valor FIJO que en un flujo miente: `mover_a_nutricion_manual` (una fecha límite
 *     fija vence para todos los leads que entren después), `proponer_agendar_agenda` (un día y una hora
 *     fijos), `editar_contacto_lead` (pisaría el nombre o el email de cada lead con el mismo texto),
 *     `marcar_pago_cobrado` (una cuota por id);
 *   · `proponer_tareas_plan`: aplicar un borrador del plan corre al Perro, que re-curva TODO el
 *     tablero (AGENTS.md); una tarea por lead lo dispararía en cada inscripción. Del Plan no queda
 *     ninguna que sea de UN lead;
 *   · `mover_lead_en_producto`: mueve SÓLO en un producto AGREGADO, y «Mover de etapa»
 *     (`proponer_cambio_etapa`) SÓLO en el principal. Cuál es el principal depende del LEAD, no del
 *     flujo: ofrecer las dos es pedirle a quien arma la automatización que sepa eso de cada lead que va a
 *     pasar, y la equivocada falla en cada uno con una alarma al dueño (medido en `preparar`,
 *     lib/api-mako/areas/crm.run.ts). Lo que falta es UNA «Mover de etapa» que elija cuál correr por
 *     lead (docs/hallazgos-chatbot.md, parte «editores»);
 *   · `marcar_asistencia_reunion`: la asistencia la marca el evento de la agenda, no un flujo;
 *   · las que usan IA (`generar_insight_lead`, `redactar_followup_post_llamada`, `analizar_llamadas_lead`):
 *     tardan y gastan en cada lead;
 *   · `crear_borrador_whatsapp_empresa`: un WhatsApp al lead es la tarjeta WHATSAPP;
 *   · lo del WhatsApp oficial (se borró el 09/10/2026) y lo que no es de UN lead (configurar, publicar, Meta,
 *     cursos, el equipo).
 * Las de Customer Success que trae la rama de la API (`wip/api-acciones-0910`: mover en la entrega,
 * invitar al curso, abrir un módulo…) entran acá cuando esa rama llegue a main, cada una con su control
 * (docs/hallazgos-chatbot.md, parte «editores»).
 *
 * Un paso ya guardado con una acción que no está acá se sigue dibujando y editando: el catálogo trae
 * TODAS las del workspace marcadas con `curada` (lib/api-mako/flujo.ts), y el selector suma la puesta.
 */
export const ACCIONES_DEL_FLUJO: readonly AccionDelFlujo[] = [
  { id: 'proponer_cambio_etapa', titulo: 'Mover de etapa', que: 'Lo pasa a otra etapa del kanban', grupo: 'Etapa y funnels', icono: 'etapa' },
  { id: 'agregar_lead_a_producto', titulo: 'Agregar a un funnel', que: 'Lo suma a otro funnel, sin sacarlo del suyo', grupo: 'Etapa y funnels', icono: 'producto' },
  { id: 'quitar_lead_de_producto', titulo: 'Quitar de un funnel', que: 'Lo quita de uno de sus funnels', grupo: 'Etapa y funnels', icono: 'quitar' },
  { id: 'poner_etiqueta_lead', titulo: 'Agregar una etiqueta', que: 'Le agrega una etiqueta del CRM', grupo: 'Etiquetas', icono: 'etiqueta-mas' },
  { id: 'sacar_etiqueta_lead', titulo: 'Eliminar una etiqueta', que: 'Le elimina una etiqueta del CRM', grupo: 'Etiquetas', icono: 'etiqueta-menos' },
  { id: 'agregar_nota_lead', titulo: 'Agregar una nota', que: 'Deja una nota en su historial', grupo: 'Ficha', icono: 'nota' },
  { id: 'marcar_calificado', titulo: 'Marcar calificado', que: 'Marca si era un buen fit', grupo: 'Ficha', icono: 'calificado' },
  { id: 'ignorar_datos_sin_marcar', titulo: 'Ignorar sus datos sin marcar', que: 'Deja de contar en «Datos sin marcar»', grupo: 'Ficha', icono: 'silenciar' },
  { id: 'reactivar_datos_sin_marcar', titulo: 'Volver a contar sus datos', que: 'Vuelve a contar en «Datos sin marcar»', grupo: 'Ficha', icono: 'avisar' },
  { id: 'cancelar_reunion_calendly', titulo: 'Cancelar su reunión', que: 'Cancela en Calendly su próxima reunión', grupo: 'Agenda', icono: 'calendario' },
  { id: 'asignar_closer_setter', titulo: 'Asignar closer o setter', que: 'Le asigna alguien del equipo', grupo: 'Equipo', icono: 'persona-mas' },
  { id: 'avisar_al_equipo', titulo: 'Avisar al equipo', que: 'Manda un aviso al grupo de WhatsApp', grupo: 'Equipo', icono: 'mako' },
  { id: 'inscribir_lead_secuencia', titulo: 'Inscribir en otra automatización', que: 'Lo mete en otra automatización', grupo: 'Automatizaciones', icono: 'accion' },
  { id: 'marcar_estado_cliente_cs', titulo: 'Cambiar el estado del cliente', que: 'Activo, graduado, baja o pausado', grupo: 'Cliente', icono: 'cliente' },
  { id: 'invitar_cliente_curso_cs', titulo: 'Invitar al curso', que: 'Le manda su acceso al curso', grupo: 'Cliente', icono: 'cliente' },
  { id: 'aplicar_etiqueta_lead_whatsapp', titulo: 'Etiquetar su chat por su etapa', que: 'Le agrega en el chat la etiqueta de su etapa', grupo: 'Chat', icono: 'whatsapp' },
];

const POR_ID: ReadonlyMap<string, AccionDelFlujo> = new Map(ACCIONES_DEL_FLUJO.map((a) => [a.id, a]));

/**
 * Las de la lista corta que el SELECTOR de ACTION no ofrece (cuarta tanda, punto 11: «elimina la
 * opción "Avisar al equipo", para eso ya tenemos la opción de "MaKo en WhatsApp". Tampoco tiene
 * sentido "Inscribir en otra automatización"... el cliente le pondrá una etiqueta y ahí se disparará
 * esa otra automatización»). Siguen en la lista —con su nombre y su formulario— porque la tarjeta
 * MaKo ES `avisar_al_equipo` y Crear con IA la usa, y porque un paso que ya tiene una de las dos se
 * sigue dibujando y editando (va en «La que tiene puesta»).
 */
export const FUERA_DEL_SELECTOR: ReadonlySet<string> = new Set(['avisar_al_equipo', 'inscribir_lead_secuencia']);

/** La acción de la lista corta, o null si el lienzo no la ofrece. */
export const accionDelFlujo = (id: string | null | undefined): AccionDelFlujo | null => (id ? POR_ID.get(id) ?? null : null);

// ── La tarjeta TAG: una o VARIAS etiquetas ──────────────────────────────────────────────────

/** Las operaciones que dibuja la tarjeta 🏷️ (decisión 8: una presentación sobre la ⚡ Acción). */
export const OPS_ETIQUETA = ['poner_etiqueta_lead', 'sacar_etiqueta_lead'] as const;
export type OperacionEtiqueta = (typeof OPS_ETIQUETA)[number];
export const esOperacionEtiqueta = (op: string | null | undefined): op is OperacionEtiqueta =>
  op === 'poner_etiqueta_lead' || op === 'sacar_etiqueta_lead';

/**
 * EL VERBO, en UN lugar (sexta tanda, TAG 1, textual: «En lugar de "Poner" y "Sacar", se formal
 * escribiendo siempre... "Agregar" y "Eliminar". Revisa que no esté ese error en otro lado»). Lo usan el
 * editor de la tarjeta, la línea que dice la tarjeta y los nombres del selector de ACTION.
 */
export const VERBO_ETIQUETA: Readonly<Record<OperacionEtiqueta, string>> = {
  poner_etiqueta_lead: 'Agregar', sacar_etiqueta_lead: 'Eliminar',
};

/** El parámetro donde viajan las etiquetas de más (la primera sigue en `etiquetaId`). */
export const PARAM_ETIQUETAS = 'etiquetaIds';

const idValido = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * LAS ETIQUETAS DE UNA TARJETA TAG, en orden y sin repetir (sexta tanda, TAG 2: «Se debería poder
 * seleccionar multiple, si quiero sacar o agragar varias etiquetas»).
 *
 * ⚠️ LA ACCIÓN DEL REGISTRO ACEPTA UNA. `poner_etiqueta_lead` / `sacar_etiqueta_lead` declaran un solo
 *    `etiquetaId: number` (lib/api-mako/areas/crm.def.ts), y el validador del registro TIRA en silencio
 *    lo que la def no declara (`validarInput`, lib/api-mako/validar.ts: recorre sólo `parametros`).
 *    Medido el 09/10/2026. Por eso la tarjeta guarda la PRIMERA en `etiquetaId` —así todo lo que ya lee
 *    una (la tarjeta, el conteo de uso, Crear con IA, el freno de Publicar) sigue andando— y TODAS, sólo
 *    cuando son más de una, en `etiquetaIds`; y quien corre la acción la corre UNA VEZ POR ETIQUETA
 *    (`unaPorEtiqueta`). Sin ese enchufe en el ejecutor, una tarjeta con tres corre sólo la primera.
 */
export function etiquetasDelPaso(params: Record<string, unknown> | null | undefined): number[] {
  const out: number[] = [];
  const sumar = (v: unknown) => { const id = idValido(v); if (id != null && !out.includes(id)) out.push(id); };
  const varias = params?.[PARAM_ETIQUETAS];
  if (Array.isArray(varias)) varias.forEach(sumar);
  sumar(params?.etiquetaId);
  // Si `etiquetaId` no era la primera de la lista (un paso editado a mano), manda la lista.
  return out;
}

/**
 * Los parámetros de una tarjeta TAG con estas etiquetas, sobre los que ya tenía (el lead): la primera en
 * `etiquetaId` y la lista entera en `etiquetaIds` SÓLO si son más de una. Con una, el paso queda EXACTO
 * como hasta ahora (lo que ya está guardado no cambia de forma); con ninguna, sin las dos.
 */
export function paramsConEtiquetas(ids: readonly number[], base: Record<string, unknown> = {}): Record<string, unknown> {
  const limpias = etiquetasDelPaso({ [PARAM_ETIQUETAS]: ids });
  const { etiquetaId: _1, [PARAM_ETIQUETAS]: _2, ...resto } = base;
  void _1; void _2;
  if (!limpias.length) return resto;
  return { ...resto, etiquetaId: limpias[0], ...(limpias.length > 1 ? { [PARAM_ETIQUETAS]: limpias } : {}) };
}

/**
 * PARA EL QUE EJECUTA (`ejecutarDesdeFlujo`, lib/api-mako/flujo.ts): una tanda de parámetros POR
 * ETIQUETA, cada una con su `etiquetaId` y sin la lista. Una acción que no es de etiqueta, o una tarjeta
 * con una sola, vuelve tal cual en UNA tanda: para todo lo demás no cambia nada.
 */
export function unaPorEtiqueta(operacion: string, params: Record<string, unknown> | null | undefined): Array<Record<string, unknown> | null | undefined> {
  if (!esOperacionEtiqueta(operacion) || !Array.isArray(params?.[PARAM_ETIQUETAS])) return [params];
  const ids = etiquetasDelPaso(params);
  if (ids.length <= 1) return [paramsConEtiquetas(ids, params ?? {})];
  const { [PARAM_ETIQUETAS]: _l, ...resto } = params ?? {};
  void _l;
  return ids.map((etiquetaId) => ({ ...resto, etiquetaId }));
}

/**
 * El resultado de las N tandas, como UNO (escrito estructural: `ResultadoFlujo` vive en un módulo
 * server-only). Salió bien si salieron TODAS —«ya la tenía» cuenta como bien, igual que con una—; el
 * resumen dice cada una, para que el rastro de la corrida no esconda cuál falló.
 */
export function juntarPorEtiqueta<R extends { ok: boolean; resumen: string; via: string }>(rs: readonly R[]): R {
  if (rs.length === 1) return rs[0];
  const via = rs.find((r) => r.via !== 'ninguna')?.via ?? rs[0]?.via ?? 'ninguna';
  return { ...rs[0], ok: rs.every((r) => r.ok), resumen: rs.map((r) => r.resumen).join(' · '), via } as R;
}

/**
 * Lo que dice la TARJETA del lienzo: «Agregar Cualificado», «Agregar Cualificado y Seguimiento»,
 * «Eliminar Cualificado, Seguimiento y 2 más». Los nombres los pone quien llama (los de las archivadas
 * también: una tarjeta que apunta a una archivada se sigue leyendo).
 */
export function textoDeEtiquetas(operacion: OperacionEtiqueta, nombres: readonly string[]): string {
  const verbo = VERBO_ETIQUETA[operacion];
  if (!nombres.length) return verbo;
  if (nombres.length === 1) return `${verbo} ${nombres[0]}`;
  if (nombres.length === 2) return `${verbo} ${nombres[0]} y ${nombres[1]}`;
  return `${verbo} ${nombres[0]}, ${nombres[1]} y ${nombres.length - 2} más`;
}

// ── Las secciones del selector ──────────────────────────────────────────────────────────────

/** Lo mínimo de una acción que necesitan las secciones (es un subconjunto de `AccionEditor`). */
export type AccionParaSecciones = { id: string; titulo: string; descripcion: string; curada: boolean; grupo: GrupoAccion | null };

/**
 * Una sección del selector: un ÁREA con sus acciones en el orden de la lista (los bloques quedan
 * juntos; quien dibuja pone la línea donde cambia el bloque), o «La que tiene puesta».
 */
export type SeccionAcciones<A> = { titulo: string; icono?: NombreIconoMenu; acciones: A[] };

export const SECCION_PUESTA = 'La que tiene puesta';

/**
 * Las secciones del selector: un ÁREA por sección, en el orden de `AREAS_ACCION`, con sus acciones en el
 * orden de la lista. Si el paso tiene puesta una acción que NO está en la lista corta (`puesta`), va
 * primero en «La que tiene puesta»: un desplegable cuyo valor no está entre sus opciones no muestra nada
 * (AGENTS.md). Un área vacía no se devuelve (la capa del workspace no ve sus acciones).
 */
export function seccionesDeAcciones<A extends AccionParaSecciones>(acciones: readonly A[], puesta?: string | null): SeccionAcciones<A>[] {
  const out: SeccionAcciones<A>[] = [];
  const fuera = puesta ? acciones.find((a) => a.id === puesta && (!a.curada || FUERA_DEL_SELECTOR.has(a.id))) : undefined;
  if (fuera) out.push({ titulo: SECCION_PUESTA, acciones: [fuera] });
  const orden = new Map(ACCIONES_DEL_FLUJO.map((a, i) => [a.id, i]));
  for (const area of AREAS_ACCION) {
    const del = acciones
      .filter((a) => a.curada && a.grupo != null && AREA_DE_GRUPO[a.grupo] === area && !FUERA_DEL_SELECTOR.has(a.id))
      .sort((x, y) => (orden.get(x.id) ?? 99) - (orden.get(y.id) ?? 99));
    if (del.length) out.push({ titulo: area, icono: ICONO_AREA[area], acciones: del });
  }
  return out;
}

// ── Lo que pide una etapa ───────────────────────────────────────────────────────────────────

/** Los datos que un flujo PUEDE cargar al mover (`REQUISITOS_PEDIBLES` del doer: lib/mako-doer-acciones.ts). */
export type DatoDeEtapa = 'monto' | 'motivo';

/**
 * Qué pide mover a ESTA etapa que un paso de un flujo pueda cargar: el monto (la etapa de cierre del
 * funnel) o el motivo (perdido, descalificado).
 *
 * ⚠️ NO ES UNA REGLA NUEVA: es `stepsForStage` (lib/stage-requirements.ts) —la que usa el CRM y la que
 * corre `proponer_cambio_etapa` al proponer (`faltantesParaMover`)— preguntada por una etapa sin lead.
 * Con una copia («ganado pide monto, perdido pide motivo»), un funnel cuya etapa de cierre no se llama
 * `ganado` mostraría el monto en otra columna que la que lo exige. Las reuniones (`sinR1`/`sinR2`)
 * quedan afuera a propósito: un flujo no las puede cargar, y la acción no las exige (las deja dichas
 * en el historial).
 */
export function datosQuePideLaEtapa(pipeline: readonly EtapaLite[], key: string): DatoDeEtapa[] {
  const info = funnelReqInfo([...pipeline], key);
  const pasos = stepsForStage(key, {
    nivel: info.nivel, numReuniones: info.numReuniones, esVenta: info.esVenta, sinR1: true, sinR2: true,
  });
  return (['monto', 'motivo'] as const).filter((d) => pasos.some((p) => p.id === d));
}

// ── Lo que el editor necesita de la base ─────────────────────────────────────────────────────

export type EtapaDeAccion = { value: string; label: string; pide: DatoDeEtapa[] };
export type ProductoDeAccion = { embudoId: number; nombre: string; esDefault: boolean; etapas: EtapaDeAccion[] };
export type SecuenciaDeAccion = { id: number; nombre: string };

/**
 * Las opciones de los controles (GET /api/flujos/opciones). Cada lista en `null` = NO SE
 * PUDO LEER, que no es «no hay» (AGENTS.md: «No pude leer» es un tercer estado): el control lo dice
 * y conserva lo puesto, en vez de ofrecer una lista vacía que se lee como que el negocio no tiene.
 */
/** Un curso que se puede elegir: el producto del catálogo con al menos una clase (#874). */
export type CursoDeAccion = { productoId: number; nombre: string };

export type OpcionesAccion = {
  productos: ProductoDeAccion[] | null;
  equipo: string[] | null;
  secuencias: SecuenciaDeAccion[] | null;
  /** Los cursos del negocio (`productoId` de una acción de curso). Ausente = una respuesta de antes: «no se pudo leer». */
  cursos?: CursoDeAccion[] | null;
};

// ── El control de cada parámetro ─────────────────────────────────────────────────────────────

export type Control =
  | 'lead' | 'etapa' | 'producto' | 'curso' | 'etiqueta' | 'secuencia' | 'persona' | 'monto' | 'fecha'
  | 'si_no' | 'casilla' | 'opcion' | 'varias' | 'numero' | 'lista' | 'json' | 'texto_largo' | 'texto';

type ParamDeControl = { nombre: string; tipo: TipoParametro; obligatorio?: boolean; enum?: readonly string[]; descripcion?: string };

const ES_TEXTO_LARGO = /texto|mensaje|nota|detalle|descripcion|cuerpo|contenido|motivo/i;

/** La moneda de un parámetro de plata, por su nombre o su descripción; null = no es plata. */
export function monedaDe(p: Pick<ParamDeControl, 'nombre' | 'tipo' | 'descripcion'>): string | null {
  if (p.tipo !== 'number') return null;
  if (/(_usd|Usd)$/.test(p.nombre)) return 'USD';
  if (/(_mxn|Mxn)$/.test(p.nombre)) return 'MXN';
  if (/^monto/i.test(p.nombre)) return /\bMXN\b/.test(p.descripcion ?? '') ? 'MXN' : /\bUSD\b/.test(p.descripcion ?? '') ? 'USD' : '';
  return null;
}

/**
 * Qué control dibuja un parámetro. Por NOMBRE para los que son ids de algo del negocio (la etapa, el
 * producto, la etiqueta, la automatización, la persona): un id se elige, nunca se tipea. Por tipo
 * para el resto.
 *
 * ⚠️ LA ETAPA ES UN CONTROL DE DOS PASOS (producto → etapa de SU kanban). Si la acción declara
 * `embudoId`, ese mismo control lo escribe y el reparto no lo dibuja aparte.
 */
export function controlDe(p: ParamDeControl): Control {
  if (p.nombre === 'leadId') return 'lead';
  if (p.nombre === 'etapa' && p.tipo === 'string' && !p.enum?.length) return 'etapa';
  if (p.nombre === 'embudoId' && p.tipo === 'number') return 'producto';
  // EL CURSO (#874): un `productoId` que habla de un curso se elige entre los productos con clases. El de un cobro
  // («Producto del catálogo») no: ése es cualquier producto, con su precio.
  if (p.nombre === 'productoId' && p.tipo === 'number' && /curso/i.test(p.descripcion ?? '')) return 'curso';
  if (p.nombre === 'etiquetaId' && p.tipo === 'number') return 'etiqueta';
  if (p.nombre === 'secuenciaId' && p.tipo === 'number') return 'secuencia';
  if ((p.nombre === 'closer' || p.nombre === 'setter') && p.tipo === 'string') return 'persona';
  if (monedaDe(p) != null) return 'monto';
  if (p.tipo === 'string' && /YYYY-MM-DD/.test(p.descripcion ?? '') && !/HH:MM/.test(p.descripcion ?? '')) return 'fecha';
  if (p.tipo === 'boolean') return p.obligatorio ? 'si_no' : 'casilla';
  if (p.tipo === 'string[]' && p.enum?.length) return 'varias';
  if (p.enum?.length) return 'opcion';
  if (p.tipo === 'number') return 'numero';
  if (p.tipo === 'string[]') return 'lista';
  if (p.tipo === 'object' || p.tipo === 'object[]') return 'json';
  return ES_TEXTO_LARGO.test(p.nombre) ? 'texto_largo' : 'texto';
}

/**
 * El producto de un control de etapa: el elegido (`embudoId`), o el que tiene esa etapa (el principal
 * primero: es donde se mueve un lead con `proponer_cambio_etapa`), o el principal.
 */
export function productoDeLaEtapa(productos: readonly ProductoDeAccion[], embudoId: unknown, etapa: unknown): ProductoDeAccion | null {
  if (typeof embudoId === 'number') return productos.find((p) => p.embudoId === embudoId) ?? null;
  const tiene = (p: ProductoDeAccion) => typeof etapa === 'string' && p.etapas.some((e) => e.value === etapa);
  if (typeof etapa === 'string' && etapa) return productos.find((p) => p.esDefault && tiene(p)) ?? productos.find(tiene) ?? null;
  return productos.find((p) => p.esDefault) ?? productos[0] ?? null;
}

/** La etapa elegida en un paso, con lo que pide; null si no hay o no se pudo leer. */
export function etapaElegida(params: Record<string, unknown>, opciones: OpcionesAccion | null | undefined): EtapaDeAccion | null {
  if (!opciones?.productos || typeof params.etapa !== 'string') return null;
  return productoDeLaEtapa(opciones.productos, params.embudoId, params.etapa)?.etapas.find((e) => e.value === params.etapa) ?? null;
}

// ── El formulario ───────────────────────────────────────────────────────────────────────────

/**
 * Los parámetros que nombran OTRO destinatario que el lead: con uno de éstos, el lead del evento no
 * es el default de un `leadId` opcional (ver `naceSobreElLeadDelEvento`).
 */
export const OTRO_DESTINATARIO: readonly string[] = ['telefono', 'contactId'];

/**
 * ¿Al ELEGIR esta acción, el paso nace «sobre el lead de este flujo»? Con un `leadId` obligatorio da
 * igual (ausente ya es el del evento, `paramsDelPaso`); con uno OPCIONAL, ausente quiere decir
 * «ninguno», y «Avisar al equipo» recién elegido nacía en «Ninguno»: el aviso salía sin el nombre
 * ni el link del lead, al revés de lo que hacen el conversor y el lienzo (lib/flujo-legado.ts, que lo
 * crea con `leadId: 'evento'`).
 *
 * ⚠️ SALVO QUE LA ACCIÓN TENGA OTRO DESTINATARIO (`OTRO_DESTINATARIO`). Medido en la revisión del
 * 08/10/2026: un borrador de WhatsApp a un teléfono fijo (avisarle a un socio) que además recibía el
 * lead del evento contestaba «el teléfono no coincide» en cada corrida, con alarma al dueño. Ahí el
 * lead queda en «Ninguno» y elegirlo es un clic («Cambiar»).
 */
export function naceSobreElLeadDelEvento(parametros: ReadonlyArray<{ nombre: string; obligatorio?: boolean }>): boolean {
  const lead = parametros.find((p) => p.nombre === 'leadId');
  if (!lead) return false;
  if (lead.obligatorio === true) return true;
  return !parametros.some((p) => OTRO_DESTINATARIO.includes(p.nombre));
}

const tieneValor = (v: unknown): boolean => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length);

/** Cómo se ve un campo según lo que ya está elegido en el paso. */
export type Visibilidad = 'obligatorio' | 'opcional' | 'oculto';

/** Lo que el reparto necesita saber del paso para decidir los campos que dependen de otro. */
export type ContextoDelPaso = { accionId: string; params: Record<string, unknown>; opciones?: OpcionesAccion | null };

/**
 * LOS CAMPOS QUE DEPENDEN DE OTRO. Lo que se lee en la captura de Martín: «Monto» y «Motivo» a la
 * vista en «Mover de etapa» con cualquier etapa.
 *   · con un control de ETAPA: el monto y el motivo aparecen —y obligatorios— sólo si la etapa
 *     elegida los pide (`datosQuePideLaEtapa`, la regla del CRM). Sin etapa elegida, o sin poder leer
 *     las etapas, no se ven (salvo que ya tengan valor: plegar lo puesto lo esconde). Y `embudoId` lo
 *     escribe el mismo control, así que no se dibuja aparte;
 *   · el estado de un cliente: el motivo, obligatorio para una baja (lo exige `preparar`, cs.run.ts) y
 *     opcional al pausar; con activo o graduado no hay nada que explicar.
 * El resto: obligatorio u opcional según la def.
 */
export function visibilidadDe(p: Pick<ParamDeControl, 'nombre' | 'tipo' | 'obligatorio' | 'enum'>, parametros: readonly Pick<ParamDeControl, 'nombre' | 'tipo' | 'enum'>[], ctx?: ContextoDelPaso): Visibilidad {
  const declarado: Visibilidad = p.obligatorio === true ? 'obligatorio' : 'opcional';
  if (!ctx) return declarado;
  const conEtapa = parametros.some((x) => controlDe(x) === 'etapa');
  if (conEtapa && p.nombre === 'embudoId') return 'oculto';
  if (conEtapa && (p.nombre === 'monto' || p.nombre === 'motivo')) {
    if (etapaElegida(ctx.params, ctx.opciones)?.pide.includes(p.nombre)) return 'obligatorio';
    if (p.obligatorio === true) return 'obligatorio';
    return tieneValor(ctx.params[p.nombre]) ? 'opcional' : 'oculto';
  }
  if (ctx.accionId === 'marcar_estado_cliente_cs' && p.nombre === 'motivo') {
    if (ctx.params.estado === 'baja') return 'obligatorio';
    if (ctx.params.estado === 'pausado' || tieneValor(ctx.params.motivo)) return 'opcional';
    return 'oculto';
  }
  return declarado;
}

/** Lo mínimo de un parámetro que necesita el reparto del formulario. */
type ParamReparto = Pick<Parametro, 'nombre' | 'obligatorio' | 'tipo' | 'enum'>;

/**
 * Cómo se reparte el formulario de una acción: el lead aparte (va primero, como una línea), lo
 * obligatorio a la vista y lo opcional plegado detrás de «Más opciones». Lo que llena el FLUJO
 * (`ocultos`, de `LLENA_EL_FLUJO` en lib/api-mako/flujo-params.ts) no se dibuja, y lo que depende de
 * otro campo sale de `visibilidadDe` (con `ctx`; sin él, como lo declara la def).
 *
 * ⚠️ `plegar` es false cuando NO HAY NADA OBLIGATORIO a la vista: «Asignar closer o setter» tiene sus
 * dos campos opcionales (pide uno de los dos), y plegados el formulario quedaba vacío con un «Más
 * opciones» como única pista de que había algo que elegir.
 */
export function repartoDelFormulario<P extends ParamReparto>(
  parametros: readonly P[], pideLead: boolean, ocultos: ReadonlySet<string>, ctx?: ContextoDelPaso,
): { lead: P | null; obligatorios: P[]; opcionales: P[]; plegar: boolean } {
  const visibles = parametros.filter((p) => !ocultos.has(p.nombre));
  const lead = pideLead ? visibles.find((p) => p.nombre === 'leadId') ?? null : null;
  const resto = visibles.filter((p) => p !== lead).map((p) => [p, visibilidadDe(p, parametros, ctx)] as const);
  const obligatorios = resto.filter(([, v]) => v === 'obligatorio').map(([p]) => p);
  return { lead, obligatorios, opcionales: resto.filter(([, v]) => v === 'opcional').map(([p]) => p), plegar: obligatorios.length > 0 };
}

/**
 * Lo OBLIGATORIO que el formulario muestra y el paso no trae, por nombre de parámetro: lo declarado
 * en la def MÁS lo que pide lo elegido (el monto al mover a Ganado, el motivo de una baja). El lead no
 * cuenta (el del evento lo pone el motor: `faltanEnPaso`, lib/api-mako/flujo-params.ts). Es para
 * «Probar» y «Publicar» (decisión 13 de la tercera tanda): `faltanEnPaso` sólo ve lo declarado, y un
 * «Mover a Ganado» sin monto rebota en cada lead con «falta cargar: Monto de cierre».
 */
export function faltanDelFormulario(
  accionId: string, parametros: readonly ParamReparto[], params: Record<string, unknown>, opciones?: OpcionesAccion | null, ocultos: ReadonlySet<string> = new Set(),
): string[] {
  const { obligatorios } = repartoDelFormulario(parametros, parametros.some((p) => p.nombre === 'leadId'), ocultos, { accionId, params, opciones });
  return obligatorios.filter((p) => !tieneValor(params[p.nombre])).map((p) => p.nombre);
}

/** El rótulo de una opción cerrada («baja» → «Baja»): el valor se guarda tal cual. */
export const rotuloDeOpcion = (v: string): string => (v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : v);
