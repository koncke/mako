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
// La depuración del CRM — 25 tarjetas abiertas, medidas el 03/10 contra el código
// =============================================================================
// Seis lectores las midieron una por una contra el repo, un cruzador buscó
// solapes y lo que NO tenía tarjeta, y tres refutadores atacaron por separado los
// «cerrar», los «posponer» y los «meter al P1» — cada uno con una vara distinta,
// que es lo que hizo que esta vez cortara: la misma pregunta sin el marco del
// runway se había hecho el 30/09 y dio 0 de 25 cerrables.
//
// El detalle de cada una, en docs/depuracion-crm-03oct.md.

export type TareaCrm = { num: number; linea: string; cuando: string; horas: number };

export const CRM_ENTRA: TareaCrm[] = [
  { num: 621, linea: 'Al importar toma el nombre y tira el apellido cuando vienen en dos columnas', cuando: '7 OCT', horas: 2 },
  { num: 702, linea: 'El lead nace sin origen, y la lista del CRM nunca lo mira', cuando: '7 OCT', horas: 6 },
  { num: 39, linea: 'Con una sola persona en el equipo el lead nace sin vendedor asignado', cuando: '7 OCT', horas: 2 },
  { num: 38, linea: 'Al pegar la grabación de la 2ª reunión se borra el link de la 1ª', cuando: '7 OCT', horas: 5 },
  { num: 174, linea: 'Conectar la agenda sin cargar las reuniones tira las citas sin un solo aviso', cuando: '7 OCT', horas: 4 },
  { num: 0, linea: 'La importación crea el duplicado que la pantalla dice que descartó', cuando: '17 OCT', horas: 2 },
];

export type GrupoCrm = { motivo: string; detalle: string; items: { num: number; que: string }[] };

/** Lo que SALE, agrupado por el motivo que lo saca. El motivo es el entregable. */
export const CRM_SALE: GrupoCrm[] = [
  {
    motivo: 'Hay un camino a mano que aguanta hasta el 15/12',
    detalle: 'Cuesta tiempo tuyo, no un lead ni un cobro.',
    items: [
      { num: 19, que: 'Cobranza automática por WhatsApp' },
      { num: 697, que: 'El botón de mensualidad cobrada' },
      { num: 800, que: 'Aviso de lead quieto' },
      { num: 671, que: 'Agendar la 2ª reunión desde la ficha' },
      { num: 622, que: 'Importar clientes que ya pagaron' },
    ],
  },
  {
    motivo: 'Sirve a un cliente que configura su embudo, no a estas seis semanas',
    detalle: 'Hoy no hay ningún negocio en esa situación. Vende por llamada, con un solo embudo.',
    items: [
      { num: 798, que: 'Métricas del embudo de cada cliente' },
      { num: 40, que: 'El recorrido con más de dos reuniones' },
      { num: 332, que: 'Completar el formulario con lo que salió en la llamada' },
      { num: 696, que: 'La casilla de «landing como entrada»' },
    ],
  },
  {
    motivo: 'El dato no se pierde: queda mal ubicado o invisible',
    detalle: 'Se puede recuperar después. Con una excepción: lo de Meta caduca a los 90 días.',
    items: [
      { num: 6, que: 'Las respuestas del formulario de Facebook' },
      { num: 701, que: 'Los clics de la landing en la ficha' },
      { num: 623, que: 'Sumar el dato nuevo al reimportar' },
      { num: 626, que: 'El mismo teléfono con y sin código de país' },
    ],
  },
  {
    motivo: 'No es programar: es escribir el texto y prender',
    detalle: 'El mecanismo está. Falta el contenido y una decisión.',
    items: [{ num: 18, que: 'La tanda de seguimiento a quien no compró' }],
  },
  {
    motivo: 'Posponer es más seguro que hacerlo',
    detalle: 'Apagar la automatización vieja cortaría los recordatorios que hoy le llegan al lead.',
    items: [{ num: 20, que: 'Unificar las dos bases' }],
  },
];

export const CRM_SEVAN = [
  { num: 37, titulo: 'Datos del trato', porque: 'Está en producción. Lo único vivo —que la ficha diga «no vio el video» sin saberlo— se midió hoy: **0 casos reales** en 10.137 visitantes.' },
  { num: 698, titulo: 'Alerta de campos fiscales', porque: 'Hecha: ya es un renglón, se ignora de a uno o en lote, y guardar nunca se bloquea.' },
  { num: 627, titulo: 'Embudo por producto', porque: 'Construido. Lo único que falta —medir por producto— se escribe **adentro de #798** antes de cerrarla.' },
  { num: 15, titulo: 'Piloto del CRM automático', porque: 'Se funde en #40. Su número se guarda: **Mauricio rechazó 35 de las 69 propuestas** que resolvió, y 3 siguen pendientes.' },
];

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
  '**#697**, el botón que anota la cuota como impaga: sale como tarjeta, pero el arreglo es **una línea**. ¿De paso o pospuesto?',
  '**«Agente: CRM automático»** sigue vivo con 0 tareas y parte en dos la respuesta a «¿dónde está lo del CRM?». ¿Se tacha?',
];

export const CONTRADICCIONES = [
  'Eliminaste **Offer Analysis**, y el último entregable que te queda de tu propia oferta —bajarla a un PDF— lo ibas a hacer justamente con esa feature.',
  'Toda la prospección se apoya en **Video/Image Generator**, que todavía no está hecho. Si se corre, la prospección pierde su gancho.',
  'El precedente para estabilizar un funnel son **tres meses**; la ventana son **seis semanas**.',
];
