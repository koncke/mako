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
 * Lo que un bloque ofrece configurar además del ancho y el diseño; un campo que el bloque no declara se tira en el
 * saneo. `datos`: qué datos van ADENTRO del bloque (los de `BloqueDef.datos`).
 */
export type OpcionBloque = 'redes' | 'fuentes' | 'pregunta' | 'datos';

/**
 * UN DATO QUE VA ADENTRO DE UN BLOQUE (23/10/2026). Martín: «en todos me dice "empresa obligatorio" porque está dentro de
 * un bloque que tiene 3 datos, y no se puede personalizar, no puedo decidir sacar a empresa o agregar otra cosa... me
 * obligas a hacer obligatorio un dato que no quería que lo fuera». Dentro de un bloque la persona decide QUÉ datos van
 * (sacar y agregar) y CUÁLES son obligatorios, cada uno por su cuenta: nada es obligatorio porque viene con otro.
 * `aviso` es el «dato sin marcar» que se completa ahí (uno de `avisa`); sin él, el dato no puede ser obligatorio.
 */
export type DatoBloque = { id: string; nombre: string; aviso?: StepId };
/** Los datos que un bloque PUEDE llevar (en el orden de su menú) y los que trae de entrada. */
export type DatosDelBloque = { todos: readonly DatoBloque[]; deEntrada: readonly string[] };

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
  | 'oferta' | 'links-de-pago' | 'confirmacion-de-pago' | 'venta' | 'cobrado' | 'cuotas' | 'movimientos' | 'suscripcion'
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
  /**
   * Los «datos sin marcar» que se PUEDEN completar en este bloque (§3, «Avisa si falta»), contra lib/stage-requirements.ts.
   * No dice cuáles avisan: eso es por dato y por funnel (`FichaGuardada.avisos`), y en un bloque con `datos`, sólo los
   * que la persona dejó adentro (`avisaDelPuesto`, ./config.ts).
   */
  avisa: readonly StepId[];
  /**
   * Si se puede quitar. Desde el 23/10/2026 todos (Martín: la persona decide qué va); el campo queda para el bloque que
   * de verdad no pueda faltar, y `tests/ficha-catalogo.test.ts` lo fija en ninguno.
   */
  quitable: boolean;
  /** Los datos que van adentro, si se eligen (`opciones: ['datos']`). Sin esto, el bloque dibuja lo suyo entero. */
  datos?: DatosDelBloque;
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
 * LOS DATOS DEL CONTACTO (23/10/2026): de entrada teléfono, email y empresa (lo que mostraba siempre), y se pueden sumar
 * las redes y la dirección, que también tienen su bloque aparte. Sólo el teléfono y la empresa son «datos sin marcar», y
 * cada uno es obligatorio por su cuenta.
 */
export const DATOS_CONTACTO: DatosDelBloque = {
  todos: [
    { id: 'telefono', nombre: 'Teléfono', aviso: 'telefono' }, { id: 'email', nombre: 'Email' },
    { id: 'empresa', nombre: 'Empresa', aviso: 'empresa' }, { id: 'instagram', nombre: 'Instagram' },
    { id: 'web', nombre: 'Web' }, { id: 'linkedin', nombre: 'LinkedIn' }, { id: 'youtube', nombre: 'YouTube' },
    { id: 'direccion', nombre: 'Dirección' },
  ],
  deEntrada: ['telefono', 'email', 'empresa'],
};

/**
 * LOS DATOS DE LO QUE SE VENDIÓ (30/10/2026, el resto del punto 12 del 24/10: «en general revisá que todo sea editable»). Los
 * tres bloques dibujaban todos sus datos y sólo se podía sacar el bloque entero. De entrada, todos: una ficha guardada se ve igual.
 */
export const DATOS_FISCALES: DatosDelBloque = {
  todos: [
    { id: 'facturado_por', nombre: 'Facturado por' }, { id: 'razon', nombre: 'Razón social', aviso: 'dealFiscal' },
    { id: 'id_fiscal', nombre: 'Identificación fiscal' }, { id: 'domicilio', nombre: 'Domicilio fiscal' },
    { id: 'correo', nombre: 'Correo de facturación' }, { id: 'documento', nombre: 'Documento fiscal', aviso: 'dealFiscalDoc' },
  ],
  deEntrada: ['facturado_por', 'razon', 'id_fiscal', 'domicilio', 'correo', 'documento'],
};
export const DATOS_SERVICIO: DatosDelBloque = {
  todos: [
    { id: 'que_es', nombre: 'Qué es', aviso: 'dealServicio' }, { id: 'fecha_inicio', nombre: 'Inicio' }, { id: 'fecha_termino', nombre: 'Término' },
    { id: 'duracion', nombre: 'Duración' }, { id: 'frecuencia', nombre: 'Frecuencia' }, { id: 'modalidad', nombre: 'Modalidad' },
    { id: 'sesiones', nombre: 'Sesiones' }, { id: 'arranco', nombre: 'Arrancó' },
  ],
  deEntrada: ['que_es', 'fecha_inicio', 'fecha_termino', 'duracion', 'frecuencia', 'modalidad', 'sesiones', 'arranco'],
};
export const DATOS_PROMESA: DatosDelBloque = {
  todos: [{ id: 'resultado', nombre: 'Resultado prometido', aviso: 'dealPromesa' }, { id: 'garantia', nombre: 'Garantía' }],
  deEntrada: ['resultado', 'garantia'],
};

/** El setter y el closer: dos datos, cada uno con su aviso. Se puede dejar uno solo (un negocio sin setter). */
export const DATOS_SETTER_Y_CLOSER: DatosDelBloque = {
  todos: [{ id: 'setter', nombre: 'Setter', aviso: 'setter' }, { id: 'closer', nombre: 'Closer', aviso: 'closer' }],
  deEntrada: ['setter', 'closer'],
};

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
    disenos: [d('grilla', 'Grilla'), d('renglon', 'Renglón'), d('botonera', 'Botonera grande')], avisa: ['telefono', 'empresa'], quitable: true, sinDatos: 'raya', icono: 'telefono',
    opciones: ['datos'], datos: DATOS_CONTACTO },
  { id: 'redes-y-web', tab: 'resumen', tambienEn: [], titulo: 'Redes y web', anchos: [3, 4, 6], ancho: 6,
    disenos: [d('chips', 'Chips con ícono'), d('filas', 'Filas con el link'), d('destacada', 'Red destacada')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'web', opciones: ['redes'] },
  { id: 'direccion', tab: 'resumen', tambienEn: [], titulo: 'Dirección', anchos: [4, 6], ancho: 6,
    disenos: [d('fila', 'Fila'), d('mapa', 'Tarjeta con el mapa')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'fijar' },
  { id: 'sexo', tab: 'resumen', tambienEn: [], titulo: 'Sexo', anchos: [3, 4], ancho: 4,
    disenos: [d('chip', 'Chip'), d('fila', 'Fila')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'persona' },
  { id: 'setter-y-closer', tab: 'resumen', tambienEn: [], titulo: 'Setter y closer', anchos: [3, 4, 6], ancho: 6,
    disenos: [d('cajas', 'Dos cajas'), d('chips', 'Chips con foto'), d('renglon', 'Renglón')], avisa: ['setter', 'closer'], quitable: true, sinDatos: 'raya', icono: 'equipo',
    opciones: ['datos'], datos: DATOS_SETTER_Y_CLOSER },
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
  // «Estado de cuenta» desde el 16/10/2026 (la tab Pagos en bloques): qué debe, qué pagó y qué hago ahora. El id no
  // cambia (es lo que se guarda en `funnels.data.ficha`).
  { id: 'cobrado', tab: 'pagos', tambienEn: ['resumen', 'cs-resumen', 'cs-pagos'], titulo: 'Estado de cuenta', anchos: [3, 4, 6, 12], ancho: 6,
    disenos: [d('numero', 'Número grande con barra'), d('chip', 'Chip de semáforo'), d('anillo', 'Anillo')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'grafico' },
  { id: 'cuotas', tab: 'pagos', tambienEn: ['cs-pagos'], titulo: 'Cuotas', anchos: [6, 12], ancho: 12,
    disenos: [d('tabla', 'Tabla'), d('lista', 'Lista con chips'), d('proxima', 'Sólo la próxima'), d('calendario', 'Calendario')], avisa: ['plan', 'comprobante'], quitable: true, sinDatos: 'raya', icono: 'plan' },
  // 16/10/2026: todo lo que movió plata, del más nuevo al más viejo (cobros a mano y de la pasarela, rechazos,
  // devoluciones), con los avisos de los cobros arriba (contracargo, devolución que falló). Sin movimientos se calla.
  { id: 'movimientos', tab: 'pagos', tambienEn: ['cs-pagos'], titulo: 'Movimientos', anchos: [6, 12], ancho: 12,
    disenos: [d('lista', 'Lista'), d('ultimos', 'Los últimos 5')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'reloj' },
  // «Sólo en una suscripción». El monto de una suscripción es `suscripcion_monto_usd` (lib/stage-requirements.ts).
  // (5/11/2026) Es la tab Pagos ENTERA de una venta de suscripción: el estado, cuánto paga hoy, cuándo le toca, lo pagado y
  // su historia mes a mes, con cambiar el monto desde un mes, cortar, retomar y registrar pagos (copiado de Chargebee:
  // docs/investigacion-suscripciones.md). Por eso va de ancho completo y primero en las plantillas.
  { id: 'suscripcion', tab: 'pagos', tambienEn: ['cs-pagos'], titulo: 'Suscripción', anchos: [6, 12], ancho: 12,
    disenos: [d('completa', 'Mes a mes con acciones'), d('numero', 'Número grande'), d('tarjeta', 'Tarjeta con el estado'), d('meses', 'Línea de meses')], avisa: ['monto'], quitable: true, sinDatos: 'se-calla', icono: 'repetir' },
  { id: 'recordatorios-de-cobro', tab: 'pagos', tambienEn: ['cs-pagos'], titulo: 'Recordatorios de cobro', anchos: [4, 6], ancho: 6,
    disenos: [d('renglon', 'Renglón'), d('lista', 'Lista por cuota')], avisa: [], quitable: true, sinDatos: 'se-calla', icono: 'avisar' },
  { id: 'contrato', tab: 'pagos', tambienEn: ['cs-pagos'], titulo: 'Contrato', anchos: [4, 6], ancho: 6,
    disenos: [d('franja', 'Franja con botones'), d('vista', 'Vista previa')], avisa: [], quitable: true, sinDatos: 'raya', icono: 'archivo' },
  { id: 'datos-fiscales', tab: 'pagos', tambienEn: ['cs-pagos'], titulo: 'Datos fiscales', anchos: [6, 12], ancho: 12,
    disenos: [d('grilla', 'Grilla'), d('compacta', 'Lista compacta')], avisa: ['dealFiscal', 'dealFiscalDoc'], quitable: true, sinDatos: 'raya', icono: 'llave',
    opciones: ['datos'], datos: DATOS_FISCALES },
  { id: 'servicio-vendido', tab: 'pagos', tambienEn: ['cs-resumen'], titulo: 'Servicio vendido', anchos: [6, 12], ancho: 12,
    disenos: [d('grilla', 'Grilla'), d('renglon', 'Renglón')], avisa: ['dealServicio'], quitable: true, sinDatos: 'raya', icono: 'producto',
    opciones: ['datos'], datos: DATOS_SERVICIO },
  { id: 'promesa-y-garantia', tab: 'pagos', tambienEn: ['cs-resumen'], titulo: 'Promesa y garantía', anchos: [4, 6], ancho: 6,
    disenos: [d('cajas', 'Dos cajas'), d('cita', 'Cita destacada'), d('comparada', 'Comparada con la oferta')], avisa: ['dealPromesa'], quitable: true, sinDatos: 'raya', icono: 'candado',
    opciones: ['datos'], datos: DATOS_PROMESA },
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

// ── Las HOJAS PROPIAS (17/10/2026) ───────────────────────────────────────────
// Martín, 16/10/2026: «que el sistema para cambiar de hoja sea exactamente el mismo que tenemos en Dashboard y General,
// el desplegable del título con las secciones, entonces ahí mismo se puede crear otra hoja». Una hoja propia es la que
// crea el admin con «Nueva hoja» (lib/ficha/config.ts, `FichaGuardada.hojas`): es del funnel, como las cuatro tabs, y
// en ella va cualquier bloque de la ficha del lead (los de Customer Success, no: son de otra ficha). Su clave es `h-` y
// unas letras, que no choca con ninguna tab ni con `actividad`.

/** La clave de una hoja propia: `h-` y de 3 a 16 letras o números. */
export type IdHoja = `h-${string}`;
export const esIdHoja = (x: unknown): x is IdHoja => typeof x === 'string' && /^h-[a-z0-9]{3,16}$/.test(x);
/** Donde se pone un bloque de la ficha del lead: una de las cuatro tabs o una hoja propia. */
export type LugarFicha = TabFicha | IdHoja;
export const esLugarFicha = (x: unknown): x is LugarFicha => esTabFicha(x) || esIdHoja(x);
/** La tab de la ficha del lead de la que ES un bloque, o null si es de Customer Success. */
export const casaDelBloque = (b: BloqueDef): TabFicha | null => (esTabFicha(b.tab) ? b.tab : null);
/** ¿Este bloque va en este lugar? En una tab, su regla; en una hoja propia, todo bloque de la ficha del lead. */
export const vaEnLugar = (b: BloqueDef, lugar: LugarFicha): boolean => (esTabFicha(lugar) ? vaEnTab(b, lugar) : casaDelBloque(b) !== null);
/** Los bloques de un lugar, en el orden del menú. En una hoja propia, los de cada tab, en el orden de las tabs. */
export function bloquesDelLugar(lugar: LugarFicha): BloqueDef[] {
  if (esTabFicha(lugar)) return bloquesDeLaTab(lugar);
  return TABS_FICHA.flatMap((t) => BLOQUES.filter((b) => b.tab === t));
}

/** Los bloques donde se completa un «dato sin marcar» (los que lo tienen en `avisa`). */
export const bloquesQueAvisan = (paso: StepId): BloqueDef[] => BLOQUES.filter((b) => b.avisa.includes(paso));
