// =============================================================================
// general-piezas — los bloques de General que se insertan en el editor como un elemento más
// =============================================================================
// Martín, 14/10/2026: «Tenemos un constructor de landing y gráficos para poder personalizar la tab general... Que
// todo sea personalizable, intenta replicar lo que tenemos en dashboard... Los bloques también deberían ser
// editables». La tab General es desde ese día el MISMO editor que el Dashboard (app/dashboard/EditorInforme.tsx con
// `informe: 'general'`): cada hoja se arma con gráficos del catálogo, textos, imágenes, secciones… y con ESTOS
// bloques, que son los de la General de siempre (el diseño que Martín fijó el 08/09/2026: el hero oscuro con la
// acción del día, el semáforo dibujado, los KPIs que se editan en el lugar).
//
// Un bloque es un ELEMENTO (`tipo: 'general'`, lib/graficos-catalogo.ts): se mueve, se agranda, se duplica, se borra y
// se le cambia el título como cualquier otro. El server de /general lee sus DATOS (app/general/datos.ts) y cada bloque
// se dibuja en el navegador con sus opciones (app/general/bloques/): fuera de General (en el Dashboard, en un link
// compartido) no hay de dónde sacarlo, y lo dice.
//
// La segunda vuelta (14/10/2026, Martín, con capturas): «Diseña nuevamente todos los "Bloque general", la mayoría son
// solamente texto... Si no hay datos aún, se debería ver el placeholder siempre», «Todos los desplegables de edición de
// un bloque y en general la edición del bloque hazlo mejor, porque no tiene muchas opciones», «Hay bloques que en la
// configuración se deben definir allí mismo ciertas cosas... Como el objetivo del trimestre, que me gustaría que se
// llamen (OKRs)» y «Pon muchos menos gráficos disponibles en General, justamente para eso ya tenemos una tab de
// dashboard». De ahí: cada bloque declara sus OPCIONES (`opciones`), que el panel ofrece y el saneo valida, y General
// acota la galería de gráficos, los datos y lo que se inserta (`TIPOS_GENERAL`, `FUENTES_GENERAL`,
// `ELEMENTOS_FUERA_DE_GENERAL`).
//
// Puro y sin imports: lo leen el catálogo, la pantalla, las plantillas, la API de MaKo y los tests.
// =============================================================================

/** Una opción de un bloque: qué se elige, los valores posibles (con su ícono del set de la casa, si se estandariza) y el de entrada. */
export type OpcionDeBloque = {
  id: string;
  nombre: string;
  valores: ReadonlyArray<{ id: string; nombre: string; icono?: string }>;
  def: string;
};

/**
 * El fondo de un bloque, que lo ofrecen TODOS (14/10/2026, la tercera vuelta; Martín sobre el objetivo: «que no tenga un
 * diseño dark... Los usuarios pueden elegir cambiarlo en la edición personalizada de cada bloque, pero por defecto tiene
 * que ser como el resto»). «Como la hoja» es la tarjeta de los gráficos (el tema de la hoja); «Oscuro», la isla oscura de
 * la General de antes. Lo aplica el editor (app/dashboard/ElementoGeneral.tsx): ningún bloque tiene que saberlo.
 */
const FONDO: OpcionDeBloque = { id: 'fondo', nombre: 'Fondo', def: 'claro', valores: [{ id: 'claro', nombre: 'Como la hoja' }, { id: 'oscuro', nombre: 'Oscuro' }] };

/**
 * El catálogo, pensado desde lo que alguien quiere ver al entrar (Martín, el mismo día: «Piensa en todos los bloques que
 * un usuario, con los diferentes funnels que tenemos y en general, todo lo que un usuario podría llegar a querer ver en
 * una tab general»). El ORDEN es el del menú «Bloques de General», que desde la segunda vuelta va sin títulos internos
 * (Martín: «que no tenga titulos internos y que sean una preview de lo que va a ser»), así que el orden ES la agrupación:
 *   · el norte (¿voy bien?): la meta objetivo, la acción del día, los OKRs, los KPIs y el semáforo;
 *   · hoy (¿qué hago ahora?): las tareas prioritarias, las prioridades y los proyectos del Plan, los próximos deadlines,
 *     mi día, las próximas llamadas y lo que falta marcar en el CRM;
 *   · la plata y el funnel (¿cómo viene?): el funnel de hoy, a quién cobrarle y el mes;
 *   · el contenido (¿qué sale esta semana?): las próximas publicaciones.
 * El resto de lo que un negocio puede querer (lo cobrado, los anuncios, la landing, el VSL, WhatsApp) se inserta como
 * GRÁFICO (los pocos de `TIPOS_GENERAL`); las plantillas por tipo de funnel (lib/general-plantillas.ts) lo combinan.
 *
 * La tercera vuelta (14/10/2026, Martín con capturas: «Mucho espacio en blanco en el template, bloques que no se ven»,
 * «Rediseña completamente el grafico de "Objetivo" y "Acción del día", deben ser 2 gráficos diferentes... Y que el primero
 * se llame "Meta objetivo"» y «Faltan bloques... como el de "Tareas Prioritarias"... si quiero que muestre 1 tarea, 3
 * tareas, 5, 10... Piensa en cada bloque y como debería poder editarse»):
 *   · `cabecera` es «Meta objetivo» (el id no cambia: lo guardan los informes) y la acción del día es su propio bloque;
 *   · entran «Tareas prioritarias» y «Próximos deadlines»;
 *   · el tamaño de cada uno es el de su CONTENIDO (`w`/`h` en la grilla de 12 columnas y filas de 30 px): un bloque más
 *     alto que lo que dibuja es el espacio en blanco del reporte.
 *
 * `icono`: el del set de la casa (app/_ui/iconos-menu.tsx) para el desplegable de «Bloque» del panel.
 */
export const PIEZAS_GENERAL = [
  {
    id: 'cabecera', nombre: 'Meta objetivo', icono: 'fijar', linea: 'El OKR que manda: cuánto llevas, cuánto falta y si vas a tiempo.', w: 6, h: 7,
    opciones: [
      { id: 'detalle', nombre: 'Qué muestra', def: 'simple', valores: [{ id: 'simple', nombre: 'El avance y el ritmo', icono: 'numero' }, { id: 'completo', nombre: 'Con el detalle', icono: 'grafico' }] },
      FONDO,
    ],
  },
  {
    id: 'accion', nombre: 'Acción del día', icono: 'accion', linea: 'Lo que más conviene hacer hoy, y por qué.', w: 6, h: 7,
    opciones: [
      { id: 'razon', nombre: 'El porqué', def: 'no', valores: [{ id: 'si', nombre: 'Se ve', icono: 'ver' }, { id: 'no', nombre: 'Oculto', icono: 'ocultar' }] },
      FONDO,
    ],
  },
  {
    id: 'objetivos', nombre: 'OKRs', icono: 'grafico', linea: 'Cada OKR con su avance, contra el tiempo que pasó.', w: 12, h: 5,
    opciones: [
      { id: 'estilo', nombre: 'Cómo se ven', def: 'anillos', valores: [{ id: 'anillos', nombre: 'Anillos', icono: 'grafico' }, { id: 'barras', nombre: 'Barras', icono: 'numero' }] },
      { id: 'cuales', nombre: 'Cuáles', def: 'todos', valores: [{ id: 'todos', nombre: 'Todos' }, { id: 'trimestre', nombre: 'Del trimestre' }, { id: 'anio', nombre: 'Del año' }] },
      FONDO,
    ],
  },
  {
    id: 'kpis', nombre: 'KPIs', icono: 'numero', linea: 'Los compromisos de la semana, con su registro.', w: 12, h: 7,
    opciones: [
      { id: 'cadencia', nombre: 'Cuáles', def: 'todas', valores: [{ id: 'todas', nombre: 'Todos' }, { id: 'diaria', nombre: 'Diarios' }, { id: 'semanal', nombre: 'Semanales' }] },
      FONDO,
    ],
  },
  {
    id: 'semaforo', nombre: 'Semáforo del negocio', icono: 'condicion', linea: 'Lo que está en rojo, en ámbar y en verde.', w: 6, h: 6,
    opciones: [
      { id: 'lamparas', nombre: 'Las lámparas', def: 'si', valores: [{ id: 'si', nombre: 'Se ven', icono: 'ver' }, { id: 'no', nombre: 'Ocultas', icono: 'ocultar' }] },
      { id: 'limite', nombre: 'Alertas', def: '4', valores: [{ id: '3', nombre: '3' }, { id: '4', nombre: '4' }, { id: '6', nombre: '6' }, { id: 'todas', nombre: 'Todas' }] },
      FONDO,
    ],
  },
  {
    id: 'tareas', nombre: 'Tareas prioritarias', icono: 'check', linea: 'Las tareas del Plan que más mueven la aguja, para completarlas aquí.', w: 6, h: 8,
    opciones: [
      { id: 'cuantas', nombre: 'Cuántas', def: '5', valores: [{ id: '1', nombre: '1' }, { id: '3', nombre: '3' }, { id: '5', nombre: '5' }, { id: '10', nombre: '10' }] },
      { id: 'vista', nombre: 'Cómo se ven', def: 'lista', valores: [{ id: 'lista', nombre: 'Lista', icono: 'texto' }, { id: 'tarjetas', nombre: 'Tarjetas', icono: 'plan' }] },
      { id: 'proyecto', nombre: 'El proyecto', def: 'no', valores: [{ id: 'si', nombre: 'Se ve', icono: 'ver' }, { id: 'no', nombre: 'Oculto', icono: 'ocultar' }] },
      FONDO,
    ],
  },
  {
    id: 'prioridades', nombre: 'Prioridades del Plan', icono: 'plan', linea: 'El Objetivo Principal y las tareas que más lo mueven.', w: 12, h: 10,
    opciones: [
      { id: 'cuantas', nombre: 'Tareas', def: '3', valores: [{ id: '1', nombre: '1' }, { id: '3', nombre: '3' }, { id: '5', nombre: '5' }] },
      { id: 'objetivo', nombre: 'El Objetivo Principal', def: 'si', valores: [{ id: 'si', nombre: 'Se ve', icono: 'ver' }, { id: 'no', nombre: 'Oculto', icono: 'ocultar' }] },
      FONDO,
    ],
  },
  {
    id: 'deadlines', nombre: 'Próximos deadlines', icono: 'calendario', linea: 'Lo que vence pronto en el Plan, y lo que ya se pasó.', w: 6, h: 8,
    opciones: [
      { id: 'dias', nombre: 'Los próximos', def: '14', valores: [{ id: '7', nombre: '7 días' }, { id: '14', nombre: '14 días' }, { id: '30', nombre: '30 días' }] },
      { id: 'que', nombre: 'Qué', def: 'todo', valores: [{ id: 'todo', nombre: 'Tareas y proyectos' }, { id: 'tareas', nombre: 'Tareas', icono: 'check' }, { id: 'proyectos', nombre: 'Proyectos', icono: 'producto' }] },
      { id: 'vencidos', nombre: 'Los vencidos', def: 'si', valores: [{ id: 'si', nombre: 'Se ven', icono: 'ver' }, { id: 'no', nombre: 'Ocultos', icono: 'ocultar' }] },
      FONDO,
    ],
  },
  {
    id: 'proyectos', nombre: 'Proyectos del Plan', icono: 'producto', linea: 'Los proyectos que más importan, con su avance y su deadline.', w: 12, h: 6,
    opciones: [
      { id: 'cuantos', nombre: 'Cuántos', def: '4', valores: [{ id: '2', nombre: '2' }, { id: '3', nombre: '3' }, { id: '4', nombre: '4' }, { id: '6', nombre: '6' }] },
      { id: 'orden', nombre: 'Cuáles', def: 'prioridad', valores: [{ id: 'prioridad', nombre: 'Los más prioritarios', icono: 'arriba' }, { id: 'deadline', nombre: 'Los que vencen antes', icono: 'calendario' }] },
      FONDO,
    ],
  },
  {
    id: 'agenda', nombre: 'Mi día', icono: 'calendario', linea: 'Lo de hoy en el Calendario: llamadas, bloques, publicaciones y tu Google.', w: 6, h: 8,
    opciones: [
      { id: 'vista', nombre: 'Cómo se ve', def: 'linea', valores: [{ id: 'linea', nombre: 'Línea de tiempo', icono: 'reloj' }, { id: 'lista', nombre: 'Lista', icono: 'texto' }] },
      FONDO,
    ],
  },
  {
    id: 'llamadas', nombre: 'Próximas llamadas', icono: 'telefono', linea: 'Las reuniones del CRM que vienen, con su closer.', w: 6, h: 8,
    opciones: [
      { id: 'dias', nombre: 'Los próximos', def: '7', valores: [{ id: '1', nombre: 'Hoy' }, { id: '3', nombre: '3 días' }, { id: '7', nombre: '7 días' }, { id: '14', nombre: '14 días' }] },
      { id: 'limite', nombre: 'Cuántas', def: '3', valores: [{ id: '3', nombre: '3' }, { id: '4', nombre: '4' }, { id: '6', nombre: '6' }, { id: '8', nombre: '8' }] },
      FONDO,
    ],
  },
  { id: 'pendientes', nombre: 'Pendientes del CRM', icono: 'check', linea: 'Los leads que falta marcar para que el tablero sea confiable.', w: 6, h: 6, opciones: [FONDO] },
  {
    id: 'funnel', nombre: 'Tu funnel hoy', icono: 'etapa', linea: 'Cuántos leads hay ahora en cada etapa de tu funnel.', w: 6, h: 8, porFunnel: true,
    opciones: [
      { id: 'estilo', nombre: 'Cómo se ve', def: 'embudo', valores: [{ id: 'embudo', nombre: 'Embudo', icono: 'etapa' }, { id: 'barras', nombre: 'Barras', icono: 'grafico' }] },
      FONDO,
    ],
  },
  {
    id: 'cobranza', nombre: 'A quién cobrarle', icono: 'dinero', linea: 'La próxima cuota de cada cliente, con «Marcar cobrada».', w: 6, h: 8, porFunnel: true,
    opciones: [
      { id: 'cuales', nombre: 'Cuáles', def: 'todas', valores: [{ id: 'todas', nombre: 'Todas' }, { id: 'vencidas', nombre: 'Sólo vencidas' }] },
      { id: 'limite', nombre: 'Cuántas', def: '4', valores: [{ id: '4', nombre: '4' }, { id: '6', nombre: '6' }, { id: '10', nombre: '10' }, { id: 'todas', nombre: 'Todas' }] },
      FONDO,
    ],
  },
  {
    id: 'mes', nombre: 'El mes', icono: 'grafico', linea: 'Ad Spend, agendas, cierres y lo cobrado contra el mes anterior.', w: 12, h: 5,
    opciones: [
      { id: 'comparar', nombre: 'El mes anterior', def: 'si', valores: [{ id: 'si', nombre: 'Se compara', icono: 'ver' }, { id: 'no', nombre: 'Sin comparar', icono: 'ocultar' }] },
      FONDO,
    ],
  },
  {
    id: 'publicaciones', nombre: 'Próximas publicaciones', icono: 'imagen', linea: 'Lo que tienes planeado publicar.', w: 12, h: 5,
    opciones: [
      { id: 'dias', nombre: 'Los próximos', def: '7', valores: [{ id: '7', nombre: '7 días' }, { id: '14', nombre: '14 días' }] },
      { id: 'vista', nombre: 'Cómo se ve', def: 'tarjetas', valores: [{ id: 'tarjetas', nombre: 'Tarjetas', icono: 'imagen' }, { id: 'lista', nombre: 'Lista', icono: 'texto' }] },
      FONDO,
    ],
  },
] as const satisfies ReadonlyArray<{
  id: string; nombre: string; icono: string; linea: string; w: number; h: number; porFunnel?: true; opciones?: readonly OpcionDeBloque[];
}>;

export type PiezaGeneral = (typeof PIEZAS_GENERAL)[number]['id'];

export const esPiezaGeneral = (x: unknown): x is PiezaGeneral => PIEZAS_GENERAL.some((p) => p.id === x);
export const piezaGeneral = (id: PiezaGeneral) => PIEZAS_GENERAL.find((p) => p.id === id)!;

/**
 * Los bloques que se atan a UN funnel (el pedido del 13/10: «e incluso asignarles ofertas y/o funnels»). Sin funnel
 * elegido, «Tu funnel hoy» cuenta el principal y «A quién cobrarle» todo el negocio. El resto mide el negocio entero.
 */
export const piezaPorFunnel = (id: PiezaGeneral): boolean => 'porFunnel' in piezaGeneral(id);

/** Las opciones que un bloque ofrece (vacío = ninguna). */
export const opcionesDePieza = (id: PiezaGeneral): readonly OpcionDeBloque[] => {
  const p = piezaGeneral(id);
  return 'opciones' in p ? p.opciones : [];
};

/** Lo elegido en un bloque: sólo lo que el bloque declara y con un valor que existe; lo demás no se guarda. */
export type OpcionesElegidas = Partial<Record<string, string>>;

/** Las opciones de un bloque, saneadas: lo que no se ofrece o no es un valor posible se tira (vuelve a su default). */
export function sanearOpciones(id: PiezaGeneral, crudo: unknown): OpcionesElegidas | undefined {
  if (!crudo || typeof crudo !== 'object') return undefined;
  const out: OpcionesElegidas = {};
  for (const o of opcionesDePieza(id)) {
    const v = (crudo as Record<string, unknown>)[o.id];
    if (typeof v === 'string' && v !== o.def && o.valores.some((x) => x.id === v)) out[o.id] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** El valor de una opción: el elegido si es válido, si no el de entrada. */
export function opcionDe(id: PiezaGeneral, elegidas: OpcionesElegidas | undefined, opcion: string): string {
  const o = opcionesDePieza(id).find((x) => x.id === opcion);
  if (!o) return '';
  const v = elegidas?.[opcion];
  return v && o.valores.some((x) => x.id === v) ? v : o.def;
}

/** Un número de una opción («5», «todas» → Infinity). */
export const numeroDe = (v: string): number => (v === 'todas' ? Infinity : Math.max(0, Number(v) || 0));

// ── Lo que General ofrece del editor del Dashboard ───────────────────────────────────────────────────────────────

/**
 * Los gráficos de la galería de General. Martín, 14/10/2026: «Pon muchos menos gráficos disponibles en General,
 * justamente para eso ya tenemos una tab de dashboard». Son los que se leen de un vistazo (un número, su tendencia,
 * un avance contra una meta, una serie, columnas, barras, un anillo y la tabla) y los que usan las plantillas de General
 * (tests/general-editor.test.ts lo fija). La tabla está porque «Añadir datos» arranca con una.
 */
export const TIPOS_GENERAL = ['numero', 'numero_tendencia', 'bala', 'serie', 'columnas', 'barras', 'anillo', 'tabla', 'tabla_barras'] as const;

/**
 * Los conjuntos de datos de General («Añadir datos» y el panel de un gráfico). El mismo pedido: «si vamos a quitar la
 * mayoría de gráficos, también hay que limitar los gráficos que se traen... Generalmente deberían ser los más
 * importantes, confio en tu criterio». Los que responden «¿cómo va el negocio?» de cada tipo de funnel: el resumen, los
 * anuncios, los leads, las llamadas de venta, lo vendido y lo cobrado, las conversaciones, la landing y su video, los
 * clientes y su entrega, los cursos y el Plan. Las plantillas de General no usan otros (lo fija el mismo test).
 */
export const FUENTES_GENERAL = [
  'negocio', 'meta', 'leads', 'llamadas_venta', 'revenue', 'pagos', 'cobranza', 'conversaciones', 'whatsapp',
  'visitas', 'vsl', 'cartera', 'entrega', 'avance_cursos', 'tareas', 'proyectos',
] as const;

/**
 * Lo que General no inserta. Martín, 14/10/2026: «Elimina lo de insertar codigo, conclusiones de mako y acción.»
 * (`lugaresInsertar`, app/dashboard/Galeria.tsx). Un informe de General que ya los tenía los sigue dibujando.
 */
export const ELEMENTOS_FUERA_DE_GENERAL = ['insertado', 'ia', 'accion'] as const;

// ── Las variables de un Texto ────────────────────────────────────────────────────────────────────────────────────

/**
 * Lo que un Texto puede nombrar entre llaves dobles («{{saludo}}, {{nombre}}»): la plantilla «Bienvenida» de General
 * (Martín: «Me imagino una que diga "Bienvenido NOMBRE..."»). Se resuelve AL DIBUJAR, nunca se guarda resuelto: el
 * mismo texto le dice su nombre a cada persona que abre la hoja. Editando se ve el texto con sus llaves.
 */
export const VARIABLES_TEXTO = [
  { id: 'saludo', nombre: 'Saludo', ejemplo: 'Buenos días' },
  { id: 'nombre', nombre: 'Tu nombre', ejemplo: 'Ana' },
  { id: 'negocio', nombre: 'El negocio', ejemplo: 'Tu negocio' },
  { id: 'fecha', nombre: 'La fecha de hoy', ejemplo: 'miércoles 14 de octubre' },
  { id: 'trimestre', nombre: 'El trimestre', ejemplo: 'Q4 2026' },
] as const;
export type VariableTexto = (typeof VARIABLES_TEXTO)[number]['id'];
export type ValoresVariables = Partial<Record<VariableTexto, string>>;

/**
 * Reemplaza las variables que tienen valor. Las que no (fuera de General, o sin dato) quedan como están: crudo se
 * nota y se arregla; borrado deja la frase coja sin que nadie se entere.
 */
export function conVariables(texto: string, valores: ValoresVariables | null | undefined): string {
  if (!valores) return texto;
  return texto.replace(/\{\{\s*([a-z]+)\s*\}\}/g, (todo, k: string) => {
    const v = (valores as Record<string, string | undefined>)[k];
    return typeof v === 'string' && v ? v : todo;
  });
}

/** El saludo de la hora (en la zona del negocio): «Buenos días» hasta las 12, «Buenas tardes» hasta las 20. */
export function saludoDeHora(hora: number): string {
  return hora < 12 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
}
