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

export const CIFRAS = [
  {
    clave: 'Capital restante', valor: 'US$2.000', urge: true,
    detalle: 'Dos pagos de **un solo cliente**, y menos en la práctica. Se termina en noviembre.',
  },
  {
    clave: 'Al primer deadline', valor: '4 días', urge: true,
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

export type FilaCrm = { num: string; titulo: string; falta: string; cuando: string; dentro: boolean };

export const CRM: FilaCrm[] = [
  { num: '621', titulo: 'Apellido en el CSV', falta: 'El parser no busca ninguna columna «Apellido»', cuando: 'P1 · 7 OCT', dentro: true },
  { num: '38', titulo: 'Reuniones automáticas', falta: 'La R2 pisa el link de la R1', cuando: 'P1 · 7 OCT', dentro: true },
  { num: '702', titulo: 'Origen del lead', falta: 'Las tres altas no lo estampan', cuando: 'P1 · 7 OCT', dentro: true },
  { num: '39', titulo: 'Setter y closer', falta: 'Falla en cuentas con un solo admin', cuando: 'P1 · 7 OCT', dentro: true },
  { num: '174', titulo: 'Calendly', falta: 'R1 y R2 opcionales, el descarte es mudo', cuando: 'P1 · 7 OCT', dentro: true },
  { num: '800', titulo: 'SLA por etapa', falta: 'Hay workaround: el lead se mueve a mano', cuando: 'fuera', dentro: false },
  { num: '798', titulo: 'Funnel del cliente', falta: 'Las 8 etapas siguen escritas a mano', cuando: 'fuera', dentro: false },
];

export const CONTRADICCIONES = [
  'Eliminaste **Offer Analysis**, y el último entregable que te queda de tu propia oferta —bajarla a un PDF— lo ibas a hacer justamente con esa feature.',
  'Toda la prospección se apoya en **Video/Image Generator**, que todavía no está hecho. Si se corre, la prospección pierde su gancho.',
  'El precedente para estabilizar un funnel son **tres meses**; la ventana son **seis semanas**.',
];
