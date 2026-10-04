// =============================================================================
// El runway al 03/10/2026 — los datos de la pantalla, separados de la pantalla
// =============================================================================
// Es una FOTO con fecha, no un estado vivo: sale de tres fuentes (las llamadas
// con Leila del 21/09 y del 01/10, y el audio de 60 minutos del 03/10), y las
// 579 citas se verificaron con comparación exacta contra las transcripciones.
//
// ⚠️ POR ESO LOS NÚMEROS ESTÁN ESCRITOS Y NO SE CALCULAN DE LA BASE. Nada de
// esto vive en una tabla: el capital que queda, el show up medido y la ventana
// de venta salen de lo que Martín dijo en una grabación. Derivarlos de algo
// sería inventarlos.
//
// ⚠️ Y LLEVA SU FECHA A LA VISTA. Un runway sin fecha se lee como el estado de
// HOY, y este caduca solo: el día que entre una venta o se mueva un deadline,
// la pantalla miente. Cuando pase, se reescribe este archivo — o se borra la
// ruta, que es lo correcto el día que deje de ser la foto vigente.
//
// El detalle largo, con las citas, en docs/panorama-03oct.md (se lee en
// /admin/docs).

/** El día en que se midió todo esto. Se dibuja. */
export const MEDIDO = '3 de octubre de 2026';

/** El tramo que dibuja el riel. Las posiciones de los hitos salen de acá. */
export const DESDE = '2026-10-03';
export const HASTA = '2026-12-15';

export type Hito = {
  fecha: string;
  /** Lo que se lee debajo de la marca. Corto: es una etiqueta, no una frase. */
  rotulo: string;
  /** La nota de arriba. Vacía = sólo la fecha. */
  nota?: string;
  peso?: 'fuerte' | 'normal';
  tono?: 'malo';
};

export const HITOS: Hito[] = [
  { fecha: '2026-10-07', rotulo: '7 OCT', nota: 'P1 técnico', peso: 'fuerte' },
  { fecha: '2026-10-14', rotulo: '14 OCT', nota: 'cierra lo técnico', peso: 'fuerte' },
  { fecha: '2026-10-18', rotulo: '18', nota: 'prospección' },
  { fecha: '2026-11-01', rotulo: '1 NOV', nota: 'arrancan los anuncios', peso: 'fuerte' },
  { fecha: '2026-11-30', rotulo: '30 NOV', nota: 'se acaba la plata', tono: 'malo' },
  { fecha: '2026-12-15', rotulo: '15 DIC', nota: 'dejan de comprar', tono: 'malo' },
];

export type Cifra = {
  clave: string;
  /** El valor escrito. Excluyente con `faltanHasta`. */
  valor?: string;
  /** Si está, el valor son los días que faltan hasta esa fecha, contados al abrir. */
  faltanHasta?: string;
  urge: boolean;
  detalle: string;
};

export const CIFRAS: Cifra[] = [
  {
    clave: 'Capital restante', valor: 'US$2.000', urge: true,
    detalle: 'Dos pagos de **un solo cliente**, y menos en la práctica. Se termina en noviembre.',
  },
  {
    // ⚠️ El ÚNICO valor que no se escribe: se cuenta contra el reloj. Un «4 días»
    // escrito a mano es verdad el día que se escribe y miente todos los demás, y
    // justo esa cifra es la que aprieta. Lo demás —el capital, el show up— no
    // sale de ninguna tabla y por eso sí va escrito.
    clave: 'Al primer deadline', faltanHasta: '2026-10-07', urge: true,
    detalle: 'Chatbot, Ads Manager, CRM y Customer Success al 100% el 7/10. Cuatro frentes en paralelo.',
  },
  {
    clave: 'Ventana de venta', valor: '45 días', urge: false,
    detalle: 'Del 1/11 al 15/12. El precedente para estabilizar un funnel son **tres meses**.',
  },
];

export type Escalon = { et: string; que: string; cuando: string; estado: 'vive' | 'fuera' };

export const ESCALONES: Escalon[] = [
  { et: 'P1', que: 'Chatbot · Ads Manager · CRM · Customer Success', cuando: '7 OCT', estado: 'vive' },
  { et: 'P2', que: 'Offer Analyst + Generator', cuando: 'eliminado', estado: 'fuera' },
  { et: 'P3', que: 'Onboarding + el video', cuando: '9 OCT · era 14', estado: 'vive' },
  { et: 'P4', que: 'Landing y VSL Analyst + Generator', cuando: 'eliminado', estado: 'fuera' },
  { et: 'P5', que: 'Video + Image Generator', cuando: '14 OCT · era 21', estado: 'vive' },
];

export const CUENTA = [
  { v: 'US$2.000', l: 'pauta' },
  { v: '÷' },
  { v: 'US$100', l: 'por agenda' },
  { v: '=' },
  { v: '20', l: 'agendas' },
  { v: '×' },
  { v: '50%', l: 'show up' },
  { v: '=' },
  { v: '10', l: 'clientes' },
  { v: '=' },
  { v: 'US$15.000', l: 'facturado', fin: true },
];

export const RIESGOS_MECANISMO = [
  '**El desarrollo canibaliza la venta**, que es lo único que paga.',
  'Y lo nombraste: **eliges tareas técnicas porque tienen final**, y la prospección no cierra. Cualquier plan que te deje producto por hacer te da una salida.',
  '**Estás quemado y lo dices** — y el plan se sigue armando después de ese punto.',
];

export const RIESGOS_SUPUESTOS = [
  '**Tu talón de Aquiles es el show rate**, no el cierre. El problema no es cerrar: es que lleguen.',
  '**La fecha del 14 está impugnada.** La persona con la que hablas te dice en la cara que no llegas con lo técnico. No la refutas: cortas el tema.',
  'Los creativos, los anuncios y el VSL de la oferta pasada **están hechos y nunca se lanzaron**.',
];

export const ROTO_HOY = [
  '**La cuota de Gemini se agota con uno o dos prompts** y sin eso no se puede pasar el onboarding. Cada cliente nuevo se traba en la puerta.',
  'El envío de WhatsApp está fallando — y es el canal del Chatbot del P1.',
  'La landing pública tiene **los botones muertos**: no se puede agendar llamada.',
  'La thank you page no existe.',
  'El lector del archivero está roto.',
];

// =============================================================================
// La depuración del CRM — qué se hace con cada una de las 25 tarjetas abiertas
// =============================================================================
// Medido el 03/10: seis lectores pasaron las 25 por el código una por una, un
// cruzador buscó solapes y lo que NO tenía tarjeta, y tres refutadores atacaron
// por separado los «se va», los «se pospone» y los «se queda» — cada uno con una
// vara distinta, que es lo que hizo que esta vez cortara. La misma pregunta sin
// el marco del runway se había hecho el 30/09 y dio 0 de 25 cerrables.
//
// ⚠️ ACÁ VIVE SÓLO EL VEREDICTO. El título, la prioridad y el deadline salen del
// tablero en cada carga: el Perro recurva los scores todos los días, así que un
// número escrito acá estaría viejo mañana. Es el mismo reparto que ya usa
// app/admin/dev/crm/auditoria.ts.
//
// ⚠️ Y SE BORRA UNA FILA CUANDO LA TAREA SE CIERRA, en vez de corregirla: lo que
// no está en el tablero no se dibuja, y lo que está sin veredicto sale marcado
// como sin revisar — que es la verdad, no un hueco.
//
// El detalle de cada una, con archivo:línea, en docs/depuracion-crm-03oct.md.

export type Veredicto = 'queda' | 'pospone' | 'va';

export const VEREDICTO_LABEL: Record<Veredicto, string> = {
  queda: 'Se queda',
  pospone: 'Se pospone',
  va: 'Se va',
};

export const CRM_VEREDICTOS: Record<number, { que: Veredicto; motivo: string }> = {
  // ── Se queda: sin esto, algo del plan no funciona ──
  621: { que: 'queda', motivo: 'Sin apellido, la prospección entra con media identidad' },
  702: { que: 'queda', motivo: 'Es lo único que separa los 1.000 en frío de los que llegan solos' },
  39: { que: 'queda', motivo: 'Tu equipo es una persona: los 1.000 nacerían sin vendedor' },
  38: { que: 'queda', motivo: 'Se pierde el link de la primera reunión, y hay que repegarlo a mano' },
  174: { que: 'queda', motivo: 'Tu agenda no está conectada y la pantalla no lo dice' },

  // ── Se va: está hecho, o es la misma que otra ──
  37: { que: 'va', motivo: 'En producción. Lo único vivo se midió: 0 casos reales en 10.137 visitantes' },
  698: { que: 'va', motivo: 'Hecha: es un renglón, se ignora en lote y guardar nunca se bloquea' },
  627: { que: 'va', motivo: 'Construido. Lo que falta —medir por producto— se escribe dentro de #798' },
  15: { que: 'va', motivo: 'Es la misma que #40, que ya nombra el mismo pendiente' },

  // ── Se pospone: hay camino a mano ──
  19: { que: 'pospone', motivo: 'La cuota vencida ya sale en Comercial y se marca cobrada con un clic' },
  697: { que: 'pospone', motivo: 'Se corrige a mano en la ficha — y el arreglo real es una línea' },
  800: { que: 'pospone', motivo: 'El lead se mueve a mano. Vuelve si no prendes el motor automático' },
  671: { que: 'pospone', motivo: 'La segunda reunión se agenda a mano: un minuto por reunión' },
  622: { que: 'pospone', motivo: 'Tus 1.000 son fríos, no clientes pagos. Y se mueven a mano' },

  // ── Se pospone: sirve a un cliente que configura su embudo ──
  798: { que: 'pospone', motivo: 'Hoy ningún negocio tiene un embudo propio que medir' },
  40: { que: 'pospone', motivo: 'Hoy nadie vende en tres reuniones' },
  332: { que: 'pospone', motivo: 'Lo que dijo en la llamada ya se lee en la ficha, a pedido' },
  696: { que: 'pospone', motivo: 'El formulario ya entra solo. Queda decidir si la casilla sigue haciendo falta' },

  // ── Se pospone: el dato no se pierde ──
  6: { que: 'pospone', motivo: 'Lo ÚNICO que se pierde de verdad: Meta lo borra a los 90 días' },
  701: { que: 'pospone', motivo: 'Los clics ya están guardados: lo que falta es dibujarlos' },
  623: { que: 'pospone', motivo: 'El contacto entra igual; lo que no se suma es el dato nuevo' },
  626: { que: 'pospone', motivo: 'Duplica la ficha, no pierde el lead' },

  // ── Se pospone: no es programar / es más seguro no tocarlo ──
  18: { que: 'pospone', motivo: 'El mecanismo está. Falta escribir el texto y prenderlo' },
  20: { que: 'pospone', motivo: 'Apagar la automatización vieja cortaría los recordatorios al lead' },
};

/**
 * La única que NO está en el tablero: un bug vivo que la depuración encontró de
 * paso. Se dibuja al pie de la tabla porque no tiene número hasta que se cree.
 */
export const CRM_NUEVA = {
  titulo: 'La importación crea el duplicado que la pantalla dice que descartó',
  motivo: 'Vivo desde el 14 de agosto. Con tres bases que se solapan, cada repetido entra dos veces',
};

/** Lo que el 17/10 necesita y no tiene tarjeta. No es código: son filas que faltan. */
export const CRM_SIN_TARJETA = [
  { que: 'Por dónde escribirles a los 100', estado: 'No hay línea de WhatsApp, y el interruptor de envío no tiene fila: apagado' },
  { que: 'Dónde reservan los que contesten', estado: 'Cero credenciales de agenda, y ninguna ruta conectada' },
  { que: 'Quién hace el seguimiento', estado: 'El motor automático está apagado ahí' },
  { que: 'Que entren 1.000 filas de una vez', estado: 'Tope de 3.000 sobre 60 segundos, con el alta de a una. Al cortar, reintentar duplica' },
  { que: 'Que el teléfono sirva para escribir', estado: 'En el libro de una clienta, 47 de 52 no se pueden contactar como están' },
  { que: 'Filtrar los 100 mejores', estado: 'No existe en el CRM. La salida sin código es filtrar en la planilla ANTES de importar' },
  { que: 'Separar los 1.000 en frío de los que llegan solos', estado: 'Se guarda el origen y ningún motor lo lee' },
];

export const CRM_DECISIONES = [
  '**¿Prendes el motor automático antes de importar?** De eso depende que #800 quede afuera: con 1.000 leads, darse cuenta de que uno está quieto abriendo su ficha no escala.',
  '**¿Filtras los 100 en la planilla, o importas los 1.000?** Si entran los 1.000, después hace falta separarlos y eso no existe.',
  '**#697**, el botón que anota la cuota como impaga: se pospone, pero el arreglo es **una línea**. ¿De paso o pospuesto?',
  '**«Agente: CRM automático»** sigue vivo con 0 tareas y parte en dos la respuesta a «¿dónde está lo del CRM?». ¿Se tacha?',
];

export const CONTRADICCIONES = [
  'Eliminaste **Offer Analysis**, y el último entregable que te queda de tu propia oferta —bajarla a un PDF— lo ibas a hacer justamente con esa feature.',
  'Toda la prospección se apoya en **Video/Image Generator**, que todavía no está hecho. Si se corre, la prospección pierde su gancho.',
  'El precedente para estabilizar un funnel son **tres meses**; la ventana son **seis semanas**.',
];
