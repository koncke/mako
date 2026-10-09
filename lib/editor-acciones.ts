// =============================================================================
// editor-acciones — el catálogo de acciones COMO LO PRESENTA el paso «⚡ Acción»
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 7): «El editor de Acción esta muy complejo,
// simplificalo... Y sobre todo el desplegable de acciones, como son tantas, tantas, debe estar muy
// bien diseñado. Tener barra de busqueda y también que sea modular, como tenemos el desplegable de
// Plan, de una sección se abren opciones.»
//
// Acá vive, PURO y con test (tests/editor-acciones.test.ts), lo que decide cómo se ve el catálogo:
//   · los RÓTULOS de los parámetros, con tildes: el `rotulo?` de la def (lib/api-mako/tipos.ts)
//     gana; si no lo tiene, este diccionario de respaldo; si tampoco, el nombre partido. Antes los
//     derivaba el componente del camelCase y salían «Titulo», «Razon», «Anio», «Kpi id»;
//   · las SECCIONES del selector: «Más usadas», «Con este lead», una por área y «Avanzado»;
//   · la LÍNEA de qué hace una acción, sacada de su descripción;
//   · qué operaciones son de ETIQUETA (la tarjeta 🏷️ es una presentación sobre ellas).
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

// ── Rótulos ─────────────────────────────────────────────────────────────────────────────────

/**
 * El rótulo de un parámetro cuando la def no trae `rotulo`. Por NOMBRE EXACTO: un `id` que en un
 * flujo es otra cosa (`secuenciaId` es una «Automatización», `embudoId` un «Producto») o una sigla.
 * Lo que no está acá sale de partir el nombre y ponerle las tildes por palabra (`TILDES`).
 */
export const ROTULOS_PARAMETRO: Readonly<Record<string, string>> = {
  leadId: 'Lead', etiquetaId: 'Etiqueta', secuenciaId: 'Automatización', embudoId: 'Producto',
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

// ── Las secciones del selector ──────────────────────────────────────────────────────────────

/** Lo mínimo de una acción que necesitan las secciones (es un subconjunto de `AccionEditor`). */
export type AccionParaSecciones = {
  id: string; area: string; areaTitulo: string; titulo: string; descripcion: string; pideLead: boolean;
  parametros: ReadonlyArray<{ nombre: string; tipo: TipoParametro }>;
};

/**
 * Las más usadas en un flujo de LEADS, en este orden. Curada a mano, no medida: el día que haya uso
 * real que contar, se cuenta (lib/api-mako: `ejecutarDesdeFlujo` deja su fila con el flujo de origen).
 */
export const MAS_USADAS: readonly string[] = [
  'avisar_al_equipo',
  'poner_etiqueta_lead',
  'sacar_etiqueta_lead',
  'proponer_cambio_etapa',
  'agregar_nota_lead',
  'asignar_closer_setter',
  'inscribir_lead_secuencia',
  'marcar_calificado',
  'mover_a_nutricion_manual',
];

/** Las operaciones que dibuja la tarjeta 🏷️ (decisión 8: una presentación sobre la ⚡ Acción). */
export const OPS_ETIQUETA = ['poner_etiqueta_lead', 'sacar_etiqueta_lead'] as const;
export type OperacionEtiqueta = (typeof OPS_ETIQUETA)[number];
export const esOperacionEtiqueta = (op: string | null | undefined): op is OperacionEtiqueta =>
  op === 'poner_etiqueta_lead' || op === 'sacar_etiqueta_lead';

/** ¿Configurarla pide escribir JSON a mano? Ésas van a «Avanzado» y a ningún otro lado. */
export const pideJsonCrudo = (a: Pick<AccionParaSecciones, 'parametros'>): boolean =>
  a.parametros.some((p) => p.tipo === 'object' || p.tipo === 'object[]');

/** «Ads (Manager y Analyst)» → «Ads»: el título del área en el registro trae su letra chica. */
export const tituloDeArea = (t: string): string => t.replace(/\s*\(.*\)\s*$/, '').trim() || t;

export type SeccionAcciones<A> = {
  titulo: string;
  acciones: A[];
  /**
   * Un ATAJO: sus acciones también están en su área. Con texto en el buscador no se dibuja, o cada
   * resultado salía dos veces (prop `atajo` de `DropdownGroup`, app/components/Dropdown.tsx).
   */
  atajo?: boolean;
};

export const SECCION_MAS_USADAS = 'Más usadas';
export const SECCION_CON_LEAD = 'Con este lead';
export const SECCION_AVANZADO = 'Avanzado';

/**
 * Las secciones del selector, en orden: «Más usadas» (curada), «Con este lead» (las que piden
 * `leadId`, menos las de arriba), una por área en el orden del catálogo y «Avanzado» al final con
 * las que piden JSON crudo. Las dos primeras son atajos: todo lo que tienen vive también en su área.
 * Una sección vacía no se devuelve. Las de JSON van SÓLO a «Avanzado»: si siguieran en su área, no
 * estarían escondidas en ningún lado.
 */
export function seccionesDeAcciones<A extends AccionParaSecciones>(acciones: readonly A[]): SeccionAcciones<A>[] {
  const simples = acciones.filter((a) => !pideJsonCrudo(a));
  const porId = new Map(simples.map((a) => [a.id, a]));
  const usadas = MAS_USADAS.map((id) => porId.get(id)).filter((a): a is A => !!a);
  const enUsadas = new Set(usadas.map((a) => a.id));
  const conLead = simples.filter((a) => a.pideLead && !enUsadas.has(a.id));
  const areas: SeccionAcciones<A>[] = [];
  const indice = new Map<string, number>();
  for (const a of simples) {
    let i = indice.get(a.area);
    if (i == null) { i = areas.length; indice.set(a.area, i); areas.push({ titulo: tituloDeArea(a.areaTitulo), acciones: [] }); }
    areas[i].acciones.push(a);
  }
  const avanzado = acciones.filter((a) => pideJsonCrudo(a));
  return [
    { titulo: SECCION_MAS_USADAS, acciones: usadas, atajo: true },
    { titulo: SECCION_CON_LEAD, acciones: conLead, atajo: true },
    ...areas,
    { titulo: SECCION_AVANZADO, acciones: avanzado },
  ].filter((s) => s.acciones.length > 0);
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

/** Lo mínimo de un parámetro que necesita el reparto del formulario. */
type ParamReparto = Pick<Parametro, 'nombre' | 'obligatorio'>;

/**
 * Cómo se reparte el formulario de una acción: el lead aparte (va primero, como una línea), lo
 * obligatorio a la vista y lo opcional plegado detrás de «Más opciones». Lo que llena el FLUJO
 * (`ocultos`, de `LLENA_EL_FLUJO` en lib/api-mako/flujo-params.ts) no se dibuja.
 */
export function repartoDelFormulario<P extends ParamReparto>(
  parametros: readonly P[], pideLead: boolean, ocultos: ReadonlySet<string>,
): { lead: P | null; obligatorios: P[]; opcionales: P[] } {
  const visibles = parametros.filter((p) => !ocultos.has(p.nombre));
  const lead = pideLead ? visibles.find((p) => p.nombre === 'leadId') ?? null : null;
  const resto = visibles.filter((p) => p !== lead);
  return { lead, obligatorios: resto.filter((p) => p.obligatorio === true), opcionales: resto.filter((p) => p.obligatorio !== true) };
}
