// =============================================================================
// ficha/catalogo — los BLOQUES de la ficha del lead (docs/diseno-ficha-bloques.md §3)
// =============================================================================
// Pedido de Martín (14/10/2026, 03:06): «Que Pagos sea personalizable... Que replique la edición que
// tenemos en "Dashboard" y "Landing Generator", que sea un constructor por bloques... con templates...
// que pueda elegir que bloques poner, que diseño, tamaño... y que ahí mismo se configure qué datos sin
// marcar notifica». Y al ver el catálogo: «Si, avanza con todo y pushea».
//
// Un bloque es una pieza de la ficha con su tab principal, las otras tabs donde se puede poner, los
// anchos que acepta (columnas de 12, la grilla del Dashboard), sus diseños (formas de dibujar el mismo
// dato), los «datos sin marcar» que se completan ahí y su ícono del set de la casa.
//
// ⚠️ EL ID ES EL DEL DOCUMENTO, TAL CUAL, y es lo que se guarda en `funnels.data.ficha`: no se
//    renombra. Un id que ya no existe se tira en el saneo (lib/ficha/config.ts), sin error.
// ⚠️ EL ORDEN DE ESTA LISTA ES EL DEL MENÚ «Agregar bloque» de cada tab (el del documento).
// ⚠️ `tests/ficha-catalogo.test.ts` lee las tablas del documento y falla si falta o sobra un id, si
//    un bloque cambió de tab, o si sus anchos o la cantidad de diseños no son los del documento.
//
// Puro, sin `server-only` ni `'use client'`: lo leen el motor (lib/ficha/config.ts), el registro de la
// API de MaKo (lib/api-mako/areas/crm.def.ts), la pantalla y los tests. El ícono va por NOMBRE del set
// (app/_ui/iconos-menu.tsx): sólo se importa el TIPO, así este archivo no arrastra JSX.
// =============================================================================

import type { StepId } from '../stage-requirements';
import type { NombreIconoMenu } from '../../app/_ui/iconos-menu';

/** Las cuatro tabs que se personalizan en la ficha del CRM (decisión del §1). */
export type TabFicha = 'resumen' | 'reuniones' | 'pagos' | 'tracking';
/** Las dos de la ficha de Customer Success: plantilla fija, no se personaliza en la v1 (§3, CS). */
export type TabCs = 'cs-resumen' | 'cs-pagos';
/** Cualquier tab donde puede vivir un bloque. */
export type TabBloque = TabFicha | TabCs;

export const TABS_FICHA: readonly TabFicha[] = ['resumen', 'reuniones', 'pagos', 'tracking'];
export const TABS_CS: readonly TabCs[] = ['cs-resumen', 'cs-pagos'];

/** El nombre corto de cada tab, como se dibuja. */
export const NOMBRE_TAB: Readonly<Record<TabBloque, string>> = {
  resumen: 'Resumen', reuniones: 'Reuniones', pagos: 'Pagos', tracking: 'Tracking',
  'cs-resumen': 'CS · Resumen', 'cs-pagos': 'CS · Pagos',
};

export const esTabFicha = (x: unknown): x is TabFicha => typeof x === 'string' && (TABS_FICHA as readonly string[]).includes(x);

/** El ancho en columnas de 12: ¼, ⅓, ½ y completo (la grilla `COLS = 12` del Dashboard). El alto lo da el contenido. */
export type Ancho = 3 | 4 | 6 | 12;
export const ANCHOS: readonly { id: Ancho; nombre: string }[] = [
  { id: 3, nombre: '¼' }, { id: 4, nombre: '⅓' }, { id: 6, nombre: '½' }, { id: 12, nombre: 'Completo' },
];
export const esAncho = (x: unknown): x is Ancho => x === 3 || x === 4 || x === 6 || x === 12;

/**
 * El «tamaño de las cards» (Martín, 13/10/2026): el aire de TODA la ficha, no de un bloque. Vive acá y
 * no en config.ts para que la API de MaKo lo lea sin arrastrar el saneo.
 */
export type Densidad = 'compacta' | 'normal' | 'amplia';
export const DENSIDADES: readonly { id: Densidad; nombre: string }[] = [
  { id: 'compacta', nombre: 'Compacta' }, { id: 'normal', nombre: 'Normal' }, { id: 'amplia', nombre: 'Amplia' },
];
export const DENSIDAD_BASE: Densidad = 'normal';
export const esDensidad = (x: unknown): x is Densidad => x === 'compacta' || x === 'normal' || x === 'amplia';

/** Una forma de dibujar el bloque. El id se guarda; el nombre se dibuja (corto). */
export type DisenoBloque = { id: string; nombre: string };

/**
 * Qué hace un bloque cuando no tiene datos (§3, «Cómo se lee»): uno de sólo lectura se CALLA (no se
 * dibuja); uno con un dato que se llena ahí se dibuja con «—» para que lo llenen. Es lo que lee el
 * armador antes de dibujar: «un bloque sin datos se calla: el lead nuevo ve poco y el ganado ve su cobro».
 */
export type SinDatos = 'se-calla' | 'raya';

/** Las redes de `redes-y-web`: «Dentro del bloque eliges cuáles van». Son los cuatro interruptores viejos del Resumen. */
export type Red = 'web' | 'instagram' | 'youtube' | 'linkedin';
export const REDES: readonly Red[] = ['web', 'instagram', 'youtube', 'linkedin'];

/** Las fuentes de `lo-que-contesto`: formulario de Meta, opt-in de la landing y agenda («eliges fuentes y orden»). */
export type FuenteRespuesta = 'meta' | 'landing' | 'agenda';
export const FUENTES_RESPUESTA: readonly FuenteRespuesta[] = ['meta', 'landing', 'agenda'];

/**
 * Lo que un bloque ofrece configurar además del ancho y el diseño. Sólo tres bloques lo tienen hoy; un
 * campo que el bloque no declara se tira en el saneo.
 */
export type OpcionBloque = 'redes' | 'fuentes' | 'pregunta';

export type BloqueId =
  // Resumen
  | 'siguiente-accion' | 'pase-a-humano' | 'posibles-duplicados' | 'cambios-de-mako' | 'contacto'
  | 'redes-y-web' | 'direccion' | 'sexo' | 'setter-y-closer' | 'proxima-reunion' | 'calificacion'
  | 'ingreso-estimado' | 'tiempo-en-etapa' | 'motivo-de-salida' | 'plazo-nutricion' | 'lo-que-contesto'
  | 'respuesta-destacada' | 'origen' | 'pagina-de-registro' | 'publicacion-de-entrada' | 'charla-whatsapp'
  | 'charla-dm' | 'mensaje-listo' | 'automatizaciones-en-curso' | 'lo-que-le-mandamos' | 'notas'
  // Reuniones
  | 'reunion-1' | 'reunion-2' | 'agendar-reunion' | 'lo-que-salio-de-la-llamada' | 'diagnostico-mako'
  | 'ciclo-de-venta' | 'cohorte' | 'coaching-de-la-llamada'
  // Tracking
  | 'visitas' | 'video-visto' | 'actividad-en-pagina' | 'grabacion-de-visita' | 'anuncio-de-origen'
  // Pagos
  | 'oferta' | 'links-de-pago' | 'confirmacion-de-pago' | 'venta' | 'cobrado' | 'cuotas' | 'suscripcion'
  | 'recordatorios-de-cobro' | 'contrato' | 'datos-fiscales' | 'servicio-vendido' | 'promesa-y-garantia'
  | 'obligaciones' | 'excepciones' | 'cliente-en-cs'
  // Customer Success
  | 'senal-de-atencion' | 'reloj-del-programa';

export type BloqueDef = {
  id: BloqueId;
  /** La tab principal: donde está en el documento y en el menú. */
  tab: TabBloque;
  /** Las otras tabs donde también se puede poner («también en…» debajo del nombre). */
  tambienEn: readonly TabBloque[];
  /** El título corto del menú «Agregar bloque». `reunion-1` y `reunion-2` se dibujan con el nombre de su etapa. */
  titulo: string;
  /** Los anchos que acepta, de menor a mayor. */
  anchos: readonly Ancho[];
  /** El ancho con que entra. Siempre uno de `anchos`. */
  ancho: Ancho;
  /** Sus diseños, en el orden del documento. El primero es el de entrada. */
  disenos: readonly DisenoBloque[];
  /** Los «datos sin marcar» que se completan en este bloque (§3, «Avisa si falta»), contra lib/stage-requirements.ts. */
  avisa: readonly StepId[];
  /** `contacto` no se puede quitar: sin él no hay ficha. */
  quitable: boolean;
  /** Qué hace sin datos. */
  sinDatos: SinDatos;
  /** El ícono del set de la casa. Se puede cambiar por bloque (el «ícono de cada bloque» del §1). */
  icono: NombreIconoMenu;
  /** Se puede poner más de una vez en la misma tab (sólo `respuesta-destacada`: «Se pueden poner varias»). */
  varias?: true;
  /** Sólo lo ven el admin y el closer de ese lead (decisión 5: el puntaje de la llamada). */
  privado?: 'admin-y-closer';
  /** Lo que se configura adentro del bloque, además del ancho y el diseño. */
  opciones?: readonly OpcionBloque[];
};

const d = (id: string, nombre: string): DisenoBloque => ({ id, nombre });

/**
 * EL CATÁLOGO ENTERO de la §3, en su orden. Los anchos de entrada: ⅓ para lo que es un número o un
 * chip, ½ para lo que es una ficha corta y completo para lo que es una lista, un hilo o una tarjeta.
 */
export const BLOQUES: readonly BloqueDef[] = [
  // ── Resumen ────────────────────────────────────────────────────────────────────
  { id: 'siguiente-accion', tab: 'resumen', tambienEn: [], titulo: 'Siguiente acción', anchos: [6, 12], ancho: 12,
    disenos: [d('banner', 'Banner arriba'), d('fila', 'Fila'), d('chip', 'Chip')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'accion' },
  { id: 'pase-a-humano', tab: 'resumen', tambienEn: [], titulo: 'Pase a humano', anchos: [6, 12], ancho: 12,
    disenos: [d('banner', 'Banner'), d('fila', 'Fila con el motivo')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'persona' },
  { id: 'posibles-duplicados', tab: 'resumen', tambienEn: [], titulo: 'Posibles duplicados', anchos: [12], ancho: 12,
    disenos: [d('banner', 'Banner'), d('lista', 'Lista')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'duplicar' },
  { id: 'cambios-de-mako', tab: 'resumen', tambienEn: [], titulo: 'Cambios de MaKo', anchos: [6, 12], ancho: 12,
    disenos: [d('tarjeta', 'Tarjeta por cambio'), d('renglon', 'Renglón')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'mako' },
  { id: 'contacto', tab: 'resumen', tambienEn: ['cs-resumen'], titulo: 'Contacto', anchos: [6, 12], ancho: 12,
    disenos: [d('grilla', 'Grilla'), d('renglon', 'Renglón'), d('botonera', 'Botonera grande')], avisa: ['telefono', 'empresa'], quitable: false, sinDatos: 'raya', icono: 'telefono' },
  { id: 'redes-y-web', tab: 'resumen', tambienEn: [], titulo: 'Redes y web', anchos: [3, 4, 6], ancho: 6,
    disenos: [d('chips', 'Chips con ícono'), d('filas', 'Filas con el link'), d('destacada', 'Red destacada')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'web', opciones: ['redes'] },
  { id: 'direccion', tab: 'resumen', tambienEn: [], titulo: 'Dirección', anchos: [4, 6], ancho: 6,
    disenos: [d('fila', 'Fila'), d('mapa', 'Tarjeta con el mapa')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'fijar' },
  { id: 'sexo', tab: 'resumen', tambienEn: [], titulo: 'Sexo', anchos: [3, 4], ancho: 4,
    disenos: [d('chip', 'Chip'), d('fila', 'Fila')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'persona' },
  { id: 'setter-y-closer', tab: 'resumen', tambienEn: [], titulo: 'Setter y closer', anchos: [3, 4, 6], ancho: 6,
    disenos: [d('cajas', 'Dos cajas'), d('chips', 'Chips con foto'), d('renglon', 'Renglón')], avisa: ['setter', 'closer'], quitable: true, sinDatos: 'raya', icono: 'equipo' },
  // Fechas y asistencias: «las asistencias nunca se apagan» (NO_IGNORABLES, lib/datos-aviso.ts). Sin reunión
  // próxima se calla: en un formulario de Meta sólo aparece si reserva por Cal.com (§4).
  { id: 'proxima-reunion', tab: 'resumen', tambienEn: [], titulo: 'Próxima reunión', anchos: [4, 6, 12], ancho: 12,
    disenos: [d('automatico', 'Dos tiempos, automático'), d('numero', 'Número grande'), d('renglon', 'Renglón'), d('banner', 'Banner «Va bien»')],
    avisa: ['fechaJ1', 'fechaJ2', 'asistenciaR1', 'asistenciaR2'], quitable: true, sinDatos: 'se-calla', icono: 'calendario' },
  { id: 'calificacion', tab: 'resumen', tambienEn: [], titulo: 'Calificación', anchos: [3, 4], ancho: 4,
    disenos: [d('botones', 'Tres botones'), d('chip', 'Chip'), d('fila', 'Fila')], avisa: ['calificado'], quitable: true, sinDatos: 'raya', icono: 'calificado' },
  { id: 'ingreso-estimado', tab: 'resumen', tambienEn: ['pagos'], titulo: 'Ingreso estimado', anchos: [3, 4], ancho: 4,
    disenos: [d('numero', 'Número grande'), d('fila', 'Fila')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'dinero' },
  { id: 'tiempo-en-etapa', tab: 'resumen', tambienEn: [], titulo: 'Tiempo en la etapa', anchos: [3, 4], ancho: 4,
    disenos: [d('chip', 'Chip con semáforo'), d('barra', 'Barra contra el plazo'), d('numero', 'Número grande')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'reloj' },
  // «Sólo si salió, y se dibuja aunque esté vacío».
  { id: 'motivo-de-salida', tab: 'resumen', tambienEn: [], titulo: 'Motivo de salida', anchos: [4, 6, 12], ancho: 12,
    disenos: [d('texto', 'Texto'), d('chips', 'Chips y texto')], avisa: ['motivo'], quitable: true, sinDatos: 'raya', icono: 'cerrar' },
  { id: 'plazo-nutricion', tab: 'resumen', tambienEn: [], titulo: 'Plazo de nutrición', anchos: [3, 4], ancho: 4,
    disenos: [d('fecha', 'Fecha'), d('cuenta', 'Cuenta regresiva')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'cronometro' },
  { id: 'lo-que-contesto', tab: 'resumen', tambienEn: [], titulo: 'Lo que contestó', anchos: [6, 12], ancho: 12,
    disenos: [d('lista', 'Lista'), d('tabla', 'Tabla'), d('linea', 'Una línea'), d('tarjetas', 'Tarjetas'), d('plegado', 'Plegado por fuente')],
    avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'pregunta', opciones: ['fuentes'] },
  { id: 'respuesta-destacada', tab: 'resumen', tambienEn: [], titulo: 'Respuesta destacada', anchos: [3, 4, 6], ancho: 4,
    disenos: [d('grande', 'Grande'), d('chip', 'Chip'), d('fila', 'Fila')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'numero', varias: true, opciones: ['pregunta'] },
  { id: 'origen', tab: 'resumen', tambienEn: ['tracking'], titulo: 'Origen', anchos: [4, 6, 12], ancho: 6,
    disenos: [d('linea', 'Una línea'), d('migas', 'Migas'), d('chip', 'Chip')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'anuncio' },
  { id: 'pagina-de-registro', tab: 'resumen', tambienEn: ['tracking'], titulo: 'Página de registro', anchos: [4, 6], ancho: 6,
    disenos: [d('linea', 'Una línea con el link'), d('fila', 'Fila con la fecha')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'link' },
  { id: 'publicacion-de-entrada', tab: 'resumen', tambienEn: ['tracking'], titulo: 'Publicación de entrada', anchos: [4, 6], ancho: 6,
    disenos: [d('linea', 'Una línea'), d('miniatura', 'Miniatura y comentario')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'imagen' },
  // «Escribir y mandar»: sin mensajes igual se dibuja, porque en prospección el primero lo escribe el equipo.
  { id: 'charla-whatsapp', tab: 'resumen', tambienEn: [], titulo: 'Charla de WhatsApp', anchos: [6, 12], ancho: 12,
    disenos: [d('ultimo', 'Último mensaje'), d('tres', 'Últimos 3'), d('hilo', 'Hilo')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'whatsapp' },
  { id: 'charla-dm', tab: 'resumen', tambienEn: [], titulo: 'Charla por DM', anchos: [6, 12], ancho: 12,
    disenos: [d('ventana', 'Ventana y último mensaje'), d('hilo', 'Hilo'), d('chip', 'Chip de la ventana')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'cita' },
  { id: 'mensaje-listo', tab: 'resumen', tambienEn: ['reuniones'], titulo: 'Mensaje listo', anchos: [6, 12], ancho: 12,
    disenos: [d('tarjeta', 'Tarjeta con «Mandar»'), d('renglon', 'Renglón'), d('llamada', 'Sólo el de la llamada')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'enviar' },
  { id: 'automatizaciones-en-curso', tab: 'resumen', tambienEn: [], titulo: 'Automatizaciones', anchos: [6, 12], ancho: 12,
    disenos: [d('lista', 'Lista'), d('linea', 'Una línea'), d('tiempo', 'Línea de tiempo')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'repetir' },
  { id: 'lo-que-le-mandamos', tab: 'resumen', tambienEn: [], titulo: 'Lo que le mandamos', anchos: [3, 4, 6, 12], ancho: 6,
    disenos: [d('contador', 'Contador de toques'), d('tiempo', 'Línea de tiempo'), d('canal', 'Por canal'), d('emails', 'Sólo emails')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'email' },
  { id: 'notas', tab: 'resumen', tambienEn: ['cs-resumen'], titulo: 'Notas', anchos: [6, 12], ancho: 12,
    disenos: [d('caja', 'Caja y lista'), d('tres', 'Últimas 3'), d('ultima', 'La última')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'nota' },

  // ── Reuniones ─────────────────────────────────────────────────────────────────
  // El título que se DIBUJA es el nombre de su etapa («Agenda R1», «Webinar»), nunca «Reunión 1»: `tituloDeBloque`.
  { id: 'reunion-1', tab: 'reuniones', tambienEn: [], titulo: 'Primera reunión', anchos: [6, 12], ancho: 12,
    disenos: [d('completa', 'Tarjeta completa'), d('renglon', 'Renglón'), d('evento', 'Evento')], avisa: ['fechaJ1', 'asistenciaR1', 'fathomR1'], quitable: true, sinDatos: 'raya', icono: 'video' },
  // «Sólo si hubo R2».
  { id: 'reunion-2', tab: 'reuniones', tambienEn: [], titulo: 'Segunda reunión', anchos: [6, 12], ancho: 12,
    disenos: [d('completa', 'Tarjeta completa'), d('renglon', 'Renglón')], avisa: ['fechaJ2', 'asistenciaR2', 'fathomR2'], quitable: true, sinDatos: 'se-calla', icono: 'video' },
  { id: 'agendar-reunion', tab: 'reuniones', tambienEn: ['resumen'], titulo: 'Agendar reunión', anchos: [4, 6], ancho: 6,
    disenos: [d('horarios', 'Botón y horarios'), d('dias', 'Chips de días'), d('link', 'Sólo «Mandar link»')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'agregar' },
  { id: 'lo-que-salio-de-la-llamada', tab: 'reuniones', tambienEn: ['resumen'], titulo: 'Lo que salió de la llamada', anchos: [6, 12], ancho: 12,
    disenos: [d('reunion', 'Por reunión'), d('objeciones', 'Sólo objeciones abiertas'), d('paso', 'Sólo el próximo paso')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'audio' },
  { id: 'diagnostico-mako', tab: 'reuniones', tambienEn: ['resumen'], titulo: 'Diagnóstico de MaKo', anchos: [6, 12], ancho: 12,
    disenos: [d('secciones', 'Tarjeta con secciones'), d('preguntas', 'Sólo las preguntas'), d('riesgos', 'Sólo riesgos y objeciones')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'mako' },
  { id: 'ciclo-de-venta', tab: 'reuniones', tambienEn: [], titulo: 'Ciclo de venta', anchos: [6, 12], ancho: 12,
    disenos: [d('linea', 'Línea con días'), d('numero', 'Número grande'), d('cajas', 'Cajas')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'grafico' },
  { id: 'cohorte', tab: 'reuniones', tambienEn: [], titulo: 'Cohorte', anchos: [3], ancho: 3,
    disenos: [d('chip', 'Chip'), d('numero', 'Número grande')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'etiqueta' },
  { id: 'coaching-de-la-llamada', tab: 'reuniones', tambienEn: [], titulo: 'Coaching de la llamada', anchos: [3, 4, 6], ancho: 6,
    disenos: [d('puntaje', 'Puntaje grande'), d('barras', 'Barras por dimensión'), d('recomendaciones', 'Recomendaciones')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'check', privado: 'admin-y-closer' },

  // ── Tracking ──────────────────────────────────────────────────────────────────
  // «Sin visitas registradas, cada bloque se calla».
  { id: 'visitas', tab: 'tracking', tambienEn: ['resumen'], titulo: 'Visitas', anchos: [3, 4, 6], ancho: 4,
    disenos: [d('numeros', 'Tres números'), d('renglon', 'Renglón'), d('chip', 'Chip con la ciudad')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'ver' },
  { id: 'video-visto', tab: 'tracking', tambienEn: ['resumen'], titulo: 'Video visto', anchos: [4, 6, 12], ancho: 6,
    disenos: [d('numero', 'Número grande con barra'), d('cajitas', 'Tres cajitas'), d('lista', 'Lista por video')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'activar' },
  { id: 'actividad-en-pagina', tab: 'tracking', tambienEn: [], titulo: 'Actividad en la página', anchos: [6, 12], ancho: 12,
    disenos: [d('tiempo', 'Línea de tiempo'), d('clics', 'Sólo clics'), d('visita', 'Por visita')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'filtro' },
  { id: 'grabacion-de-visita', tab: 'tracking', tambienEn: [], titulo: 'Grabación de la visita', anchos: [6, 12], ancho: 12,
    disenos: [d('lista', 'Lista'), d('ultima', 'Sólo la última')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'video' },
  { id: 'anuncio-de-origen', tab: 'tracking', tambienEn: ['resumen'], titulo: 'Anuncio de origen', anchos: [6, 12], ancho: 12,
    disenos: [d('lineas', 'Tres líneas'), d('completo', 'Texto completo')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'texto' },

  // ── Pagos ─────────────────────────────────────────────────────────────────────
  // «Cada bloque decide solo si se dibuja, con la misma regla de hoy (si hay venta) y con el tipo de venta».
  { id: 'oferta', tab: 'pagos', tambienEn: [], titulo: 'Oferta', anchos: [4, 6, 12], ancho: 12,
    disenos: [d('desplegable', 'Desplegable con ticket'), d('tarjeta', 'Tarjeta de la oferta'), d('renglon', 'Renglón')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'producto' },
  { id: 'links-de-pago', tab: 'pagos', tambienEn: ['cs-pagos'], titulo: 'Links de pago', anchos: [6, 12], ancho: 12,
    disenos: [d('lista', 'Botón y lista'), d('pendiente', 'Sólo el pendiente'), d('chips', 'Chips')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'link' },
  { id: 'confirmacion-de-pago', tab: 'pagos', tambienEn: [], titulo: 'Confirmación de pago', anchos: [3, 4], ancho: 4,
    disenos: [d('fecha', 'Caja con la fecha'), d('alerta', 'Alerta sin pago')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'check' },
  { id: 'venta', tab: 'pagos', tambienEn: [], titulo: 'Venta', anchos: [4, 6], ancho: 6,
    disenos: [d('cajas', 'Tres cajas'), d('renglon', 'Renglón'), d('numero', 'Número grande')], avisa: ['monto'], quitable: true, sinDatos: 'raya', icono: 'dinero' },
  { id: 'cobrado', tab: 'pagos', tambienEn: ['resumen', 'cs-resumen', 'cs-pagos'], titulo: 'Cobrado', anchos: [3, 4, 6, 12], ancho: 6,
    disenos: [d('numero', 'Número grande con barra'), d('chip', 'Chip de semáforo'), d('anillo', 'Anillo')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'grafico' },
  { id: 'cuotas', tab: 'pagos', tambienEn: ['cs-pagos'], titulo: 'Cuotas', anchos: [6, 12], ancho: 12,
    disenos: [d('tabla', 'Tabla'), d('lista', 'Lista con chips'), d('proxima', 'Sólo la próxima'), d('calendario', 'Calendario')], avisa: ['plan', 'comprobante'], quitable: true, sinDatos: 'raya', icono: 'plan' },
  // «Sólo en una suscripción». El monto de una suscripción es `suscripcion_monto_usd` (lib/stage-requirements.ts).
  { id: 'suscripcion', tab: 'pagos', tambienEn: ['cs-pagos'], titulo: 'Suscripción', anchos: [4, 6], ancho: 6,
    disenos: [d('numero', 'Número grande'), d('tarjeta', 'Tarjeta con el estado'), d('meses', 'Línea de meses')], avisa: ['monto'], quitable: true, sinDatos: 'se-calla', icono: 'repetir' },
  { id: 'recordatorios-de-cobro', tab: 'pagos', tambienEn: ['cs-pagos'], titulo: 'Recordatorios de cobro', anchos: [4, 6], ancho: 6,
    disenos: [d('renglon', 'Renglón'), d('lista', 'Lista por cuota')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'avisar' },
  { id: 'contrato', tab: 'pagos', tambienEn: ['cs-pagos'], titulo: 'Contrato', anchos: [4, 6], ancho: 6,
    disenos: [d('franja', 'Franja con botones'), d('vista', 'Vista previa')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'archivo' },
  { id: 'datos-fiscales', tab: 'pagos', tambienEn: ['cs-pagos'], titulo: 'Datos fiscales', anchos: [6, 12], ancho: 12,
    disenos: [d('grilla', 'Grilla'), d('compacta', 'Lista compacta')], avisa: ['dealFiscal', 'dealFiscalDoc'], quitable: true, sinDatos: 'raya', icono: 'llave' },
  { id: 'servicio-vendido', tab: 'pagos', tambienEn: ['cs-resumen'], titulo: 'Servicio vendido', anchos: [6, 12], ancho: 12,
    disenos: [d('grilla', 'Grilla'), d('renglon', 'Renglón')], avisa: ['dealServicio'], quitable: true, sinDatos: 'raya', icono: 'producto' },
  { id: 'promesa-y-garantia', tab: 'pagos', tambienEn: ['cs-resumen'], titulo: 'Promesa y garantía', anchos: [4, 6], ancho: 6,
    disenos: [d('cajas', 'Dos cajas'), d('cita', 'Cita destacada'), d('comparada', 'Comparada con la oferta')], avisa: ['dealPromesa'], quitable: true, sinDatos: 'raya', icono: 'candado' },
  { id: 'obligaciones', tab: 'pagos', tambienEn: ['cs-resumen'], titulo: 'Obligaciones', anchos: [6, 12], ancho: 12,
    disenos: [d('listas', 'Dos listas'), d('tabla', 'Tabla')], avisa: ['dealObligaciones'], quitable: true, sinDatos: 'raya', icono: 'check' },
  { id: 'excepciones', tab: 'pagos', tambienEn: [], titulo: 'Excepciones', anchos: [4, 6], ancho: 6,
    disenos: [d('chips', 'Chips'), d('lista', 'Lista con el motivo')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'pregunta' },
  { id: 'cliente-en-cs', tab: 'pagos', tambienEn: [], titulo: 'Cliente en CS', anchos: [4, 6, 12], ancho: 12,
    disenos: [d('chips', 'Chips'), d('checklist', 'Listo para entregar'), d('tarjeta', 'Tarjeta')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'cliente' },

  // ── Customer Success (plantilla fija, §3) ──────────────────────────────────────
  { id: 'senal-de-atencion', tab: 'cs-resumen', tambienEn: [], titulo: 'Señal de atención', anchos: [3, 4, 12], ancho: 12,
    disenos: [d('chip', 'Chip'), d('banner', 'Banner')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'avisar' },
  // «Sin contrato, «—», nunca un número inventado».
  { id: 'reloj-del-programa', tab: 'cs-resumen', tambienEn: [], titulo: 'Reloj del programa', anchos: [3, 4], ancho: 4,
    disenos: [d('barra', 'Barra de semanas'), d('numero', 'Número grande')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'reloj' },
];

const POR_ID: ReadonlyMap<string, BloqueDef> = new Map(BLOQUES.map((b) => [b.id, b]));

export const IDS_BLOQUE: readonly BloqueId[] = BLOQUES.map((b) => b.id);
export const esBloqueId = (x: unknown): x is BloqueId => typeof x === 'string' && POR_ID.has(x);
/** La definición de un bloque, o undefined si el id no existe (un id viejo guardado en una ficha). */
export const bloqueDef = (id: string): BloqueDef | undefined => POR_ID.get(id);

/** ¿Este bloque se puede poner en esta tab? Su tab principal o una de «también en». */
export const vaEnTab = (b: BloqueDef, tab: TabBloque): boolean => b.tab === tab || b.tambienEn.includes(tab);

/** Los bloques que se pueden poner en una tab, en el orden del menú: primero los suyos, después los de «también en». */
export function bloquesDeLaTab(tab: TabBloque): BloqueDef[] {
  return [...BLOQUES.filter((b) => b.tab === tab), ...BLOQUES.filter((b) => b.tab !== tab && b.tambienEn.includes(tab))];
}

/** Los bloques donde se completa un «dato sin marcar» (los que lo tienen en `avisa`). */
export const bloquesQueAvisan = (paso: StepId): BloqueDef[] => BLOQUES.filter((b) => b.avisa.includes(paso));
