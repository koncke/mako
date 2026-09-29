// =============================================================================
// mako-capacidades — qué de esto se puede hacer ADENTRO de MaKo, y dónde
// =============================================================================
// El pedido: «que el Perro identifique si una tarea se puede completar DENTRO de MaKo,
// que dentro de la tarea te indique cómo hacerlo, e incluso te dé el botón para ir a la
// tab. Si la tarea es "publicar campaña de X", eso se hace en el Ads Manager de MaKo».
//
// Sin esto, MaKo le arma al cliente una lista de tareas y lo manda a resolverlas
// afuera — teniendo la herramienta en la tab de al lado. El tablero deja de ser una
// lista de deberes y pasa a ser una lista de botones.
//
// ES UNA LISTA CERRADA A PROPÓSITO. La escribe una persona que sabe qué hace cada tab;
// si la dejáramos inferir, el Perro mandaría al cliente a pantallas que no existen o
// que no hacen lo que promete, que es peor que no decir nada. Cuando una tab crece,
// se agrega acá — y si algo todavía NO se puede hacer en MaKo, simplemente no está.
// =============================================================================

export type Capacidad = {
  /** id corto y estable: es lo que devuelve el modelo. */
  id: string;
  /** Cómo se llama la tab, tal cual la ve el usuario en el sidebar. */
  tab: string;
  ruta: string;
  /** Qué se puede hacer ahí, en la voz del producto. Es lo que lee el modelo. */
  que: string;
  /** Los pasos concretos, para mostrárselos en la tarjeta. Cortos, imperativos. */
  como: string[];
};

export const CAPACIDADES: Capacidad[] = [
  {
    id: 'ads-publicar', tab: 'Ads Manager', ruta: '/ads-manager',
    que: 'Crear una campaña de Meta, subirle creativos, prenderla o pausarla, cambiarle el presupuesto y renombrarla — sin salir a Meta.',
    como: ['Entra a Ads Manager', 'Toca "Nueva campaña" y cuéntale a MaKo qué quieres promocionar', 'Elige los creativos y revisa la estructura que arma', 'Se publica en PAUSA: la prendes tú cuando la miraste'],
  },
  {
    id: 'creativos', tab: 'Fábrica de creativos', ruta: '/onboarding',
    que: 'Sacar los avatares, las razones de compra, el lead magnet y la persona de marca — el material del que salen los anuncios.',
    como: ['Abre la Fábrica de creativos', 'Define tus avatares', 'Deja que MaKo saque las razones de compra de cada uno', 'Carga tu lead magnet'],
  },
  {
    // La tab se llama Content Machine pero la RUTA sigue siendo /ads-writer (ver
    // el comentario de nav.ts): /content-machine todavía no existe y mandar acá
    // a un cliente le daba un 404.
    id: 'copy-ads', tab: 'Content Machine', ruta: '/ads-writer',
    que: 'Escribir los guiones de los anuncios de video, y seguirlos de borrador a publicado.',
    como: ['Entra a Content Machine', 'En Anuncios, abre el que quieres atacar (avatar × razón)', 'Pídele el guion: MaKo elige el ángulo y la estructura solo', 'En Guiones los ves todos, los filtras y los vas marcando grabado y publicado'],
  },
  {
    id: 'landing-diagnosticar', tab: 'Landing Analyst', ruta: '/landing-analyst',
    que: 'Diagnosticar una landing: MaKo la abre, le lee el mensaje y lo cruza con lo que hace la gente que llega (visitas, retención del video, agendas) para decir qué cambiar primero.',
    como: ['Entra a Landing Analyst', 'Pega la dirección de tu página y toca Analizar', 'Mira los hallazgos: cada uno cita la frase exacta y trae el reemplazo escrito'],
  },
  {
    id: 'landing-escribir', tab: 'Landing Generator', ruta: '/landing-generator',
    que: 'Escribir la landing entera —estructura y copy terminado— desde tu oferta y tu proceso comercial. Si la página ya se analizó, la escribe resolviendo esos hallazgos.',
    como: ['Entra a Landing Generator', 'Cuéntale qué página necesitas y qué tiene que lograr', 'Elige en "Sobre cuál" la página ya analizada para que arregle lo que falla', 'Pídele los cambios que quieras y copia el texto listo'],
  },
  {
    id: 'crm-lead', tab: 'CRM', ruta: '/crm',
    que: 'Ver y mover leads, completar su ficha, agendar, registrar el cierre y el cobro, y dejar el seguimiento anotado.',
    como: ['Abre el CRM', 'Busca el lead por nombre o teléfono', 'Actualiza su etapa y lo que falte de la ficha'],
  },
  {
    id: 'wa-conversar', tab: 'WhatsApp', ruta: '/whatsapp',
    que: 'Leer y contestar las conversaciones de WhatsApp del negocio, con MaKo sugiriendo la respuesta.',
    como: ['Entra a WhatsApp', 'Abre la conversación', 'Pídele a MaKo que te sugiera la respuesta y ajústala'],
  },
  {
    // ⚠️ Decía `tab: 'Chat Agent', ruta: '/chat-agent'` y las DOS cosas eran
    // falsas: la tab se llama **Chatbot** en el sidebar (nav.ts:207) y
    // `/chat-agent` es un redirect a `/chatbot`. O sea que MaKo mandaba al
    // cliente a una tab con un nombre que no existe y por una URL de rebote.
    // Es el riesgo de que este archivo sea la fuente de los links: se arregla
    // una vez acá, o se propaga a cada lugar que lo copie.
    id: 'nutricion', tab: 'Chatbot', ruta: '/chatbot',
    que: 'Armar las secuencias de seguimiento y nutrición: qué se manda, cuándo, y a quién.',
    como: ['Entra a Chatbot', 'Elige la secuencia o crea una nueva', 'MaKo escribe los mensajes en tu voz y tú los apruebas'],
  },
  {
    id: 'email', tab: 'Email', ruta: '/email',
    que: 'Mandar campañas y secuencias por email.',
    como: ['Entra a Email', 'Elige a quién le va', 'Revisa el texto que escribe MaKo y envíalo'],
  },
  {
    // La tab se llama Dashboard en el sidebar, pero `/dashboard` es un redirect
    // a `/marketing`: la ruta va directo al destino real, así el link no rebota.
    id: 'metricas', tab: 'Dashboard', ruta: '/marketing',
    que: 'Ver los números de marketing y comercial: gasto, costo por lead, agendas, show rate, cierres y facturación.',
    como: ['Abre el Dashboard', 'Elige el período', 'Pregúntale a MaKo qué cambió y por qué'],
  },
  {
    id: 'llamadas', tab: 'Closing Analyst', ruta: '/closing',
    que: 'Analizar una llamada de venta: qué objeciones salieron, qué se hizo bien y qué corregir.',
    como: ['Entra a Closing Analyst', 'Elige la llamada', 'Lee el análisis y lo que propone para la próxima'],
  },
  {
    id: 'guiones-ads', tab: 'Ads Analyst', ruta: '/ads-analyst',
    que: 'Ver qué guion y qué gancho retienen mejor, por cuartiles, cruzado con lo que después cerró.',
    como: ['Entra a Ads Analyst', 'Elige el anuncio', 'Mira dónde se cae la retención y qué gancho aguantó'],
  },
  {
    id: 'experimento', tab: 'Experiments', ruta: '/experimentos',
    que: 'Registrar un experimento, su hipótesis y su resultado. Es el único lugar donde se concluye si algo funcionó.',
    como: ['Entra a Experiments', 'Carga la hipótesis y qué vas a medir', 'Vuelve cuando tengas el dato y ciérralo'],
  },
  {
    id: 'contexto', tab: 'Contexto de MaKo', ruta: '/contexto',
    que: 'Cargar lo que MaKo tiene que saber del negocio: documentos, glosario, oferta, precios.',
    como: ['Entra a Contexto de MaKo', 'Sube el documento o escríbelo', 'Desde ahí lo usa en todas las tabs'],
  },
  {
    id: 'conectar', tab: 'Integraciones', ruta: '/integraciones',
    que: 'Conectar Meta, WhatsApp, Fathom, el email y el resto de las cuentas, y ver cuáles están sanas.',
    como: ['Entra a Integraciones', 'Busca el servicio', 'Sigue el paso a paso y prueba la conexión ahí mismo'],
  },
  {
    id: 'funnel', tab: 'CRM', ruta: '/crm',
    que: 'Definir el embudo: las etapas por las que pasa un lead y qué las hace avanzar.',
    como: ['Entra al CRM', 'Abre «Editar las etapas» en el menú de arriba', 'Eso alimenta al tablero y a la nutrición'],
  },
  {
    // Es la contraparte de `experimento`: aquél registra si algo funcionó, éste
    // fija a qué se comprometió el negocio este trimestre. Sin la entrada acá, el
    // Perro no tiene a dónde mandar una tarea de «definir la meta del Q» y la deja
    // como deber suelto teniendo la pantalla en la tab de al lado.
    id: 'objetivo', tab: 'General', ruta: '/general',
    que: 'Fijar el objetivo del trimestre, elegir los KPIs que lo mueven y marcar cuánto puedes entregar. Es lo que decide qué aparece como prioridad del día.',
    como: ['Entra a General', 'Toca el objetivo y ponle su meta y su período', 'Elige los KPIs que propone MaKo o escribe los tuyos', 'Los que registras a mano se cargan desde la misma lista'],
  },
  {
    id: 'equipo', tab: 'Configuraciones', ruta: '/equipo',
    que: 'Sumar gente al equipo y darle el rol que corresponde (setter, closer, admin).',
    como: ['Entra a Configuraciones → Equipo', 'Invita a la persona', 'Elige su rol: ve solo lo suyo'],
  },
];

const PORID = new Map(CAPACIDADES.map((c) => [c.id, c]));
export const capacidad = (id: string): Capacidad | undefined => PORID.get(id);

/** El catálogo como se lo pasamos al modelo: id + qué se hace. */
export const capacidadesParaPrompt = (): string =>
  CAPACIDADES.map((c) => `· ${c.id} (tab "${c.tab}") — ${c.que}`).join('\n');
