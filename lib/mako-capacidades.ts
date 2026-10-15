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

// El hub de /onboarding se retiró el 15/10/2026: sus secciones se editan donde diga lib/secciones-negocio.ts.
import { rutaSeccion } from './secciones-negocio';

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
    // Empieza por Avatares, que es el primer paso del «como»; el resto son áreas vecinas de la misma pantalla.
    id: 'creativos', tab: 'Second Brain', ruta: rutaSeccion('avatares'),
    que: 'Sacar los avatares, las razones de compra, el lead magnet y la persona de marca — el material del que salen los anuncios.',
    como: ['Abre Second Brain', 'En «Avatares», define tus avatares', 'En «Razones», deja que MaKo saque las razones de compra de cada uno', 'En «Lead Magnet», carga el tuyo'],
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
    // Desde el 11/10/2026 la oferta tiene SU tab: Offer Analyst y Offer Generator juntos en
    // /offer. Va antes que las de landing porque es anterior a todo lo que la vende: una
    // tarea de «mejorar la oferta» o «armar el documento de la oferta» se hace acá, y sin
    // esta entrada el Perro la dejaba como deber suelto teniendo la pantalla al lado.
    id: 'oferta-revisar', tab: 'Offer', ruta: '/offer',
    que: 'Revisar y mejorar la oferta conversando con MaKo; entrega un diagnóstico y una oferta nueva en PDF.',
    como: ['Entra a Offer', 'Cuéntale a MaKo qué vendes, a quién y a qué precio', 'Lee el diagnóstico y la oferta nueva que arma', 'Descarga el PDF; lo que quieras probar, llévalo a Experiments'],
  },
  {
    // Desde el 11/10/2026 Landing Analyst no es una tab: analizar una página es parte de Landing
    // Generator (/landing-generator/analizar) y los números de la landing son la hoja «Landing» del
    // Dashboard. El id no cambia: lo devuelve el modelo y queda escrito en las tareas del plan.
    id: 'landing-diagnosticar', tab: 'Landing Generator', ruta: '/landing-generator/analizar',
    que: 'Diagnosticar una landing: MaKo la abre, le lee el mensaje y lo cruza con lo que hace la gente que llega (visitas, retención del video, agendas) para decir qué cambiar primero.',
    como: ['Entra a Landing Generator y abre Diagnóstico', 'Pega la dirección de tu página y toca Analizar', 'Mira los hallazgos: cada uno cita la frase exacta y trae el reemplazo escrito'],
  },
  {
    // Desde el 11/10/2026 la tab es el editor copiado de Gamma (docs/diseno-editor-landing.md). Los
    // pasos nombran SÓLO botones que existen («Crear nuevo», «Generar esquema», «Publicar»): MaKo los
    // repite en un chat y una instrucción inventada se sigue y no se encuentra. Lo que NO se puede
    // (y por eso no está): dominio propio, código de terceros, «Generar imagen con IA» todavía, ni
    // editar a la vez con otra persona.
    id: 'landing-escribir', tab: 'Landing Generator', ruta: '/landing-generator',
    que: 'Crear tu landing con MaKo y publicarla: arma el esquema y las secciones desde tu oferta (o desde una página ya analizada, resolviendo sus hallazgos), la editas por bloques con el tema que elijas y queda en hola-mako.site/<tu-dirección>, con el Pixel de MaKo midiendo las visitas.',
    como: [
      'Entra a Landing Generator y toca "Crear nuevo"',
      'Cuéntale qué página necesitas (o pega tu texto) y toca "Generar esquema"',
      'Ajusta el esquema y elige el tema',
      'Edita las secciones: escribe "/" para agregar bloques, o pídele cambios a MaKo con ✨',
      'Toca "Publicar", elige la dirección y publica',
    ],
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
    // ⚠️ Decía `tab: 'Chatbot', ruta: '/chat-agent'` y las DOS cosas eran
    // falsas: la tab se llamaba **Chatbot** en el sidebar y `/chat-agent` era un
    // redirect. O sea que MaKo mandaba al cliente a una tab con un nombre que no
    // existe y por una URL de rebote. Es el riesgo de que este archivo sea la
    // fuente de los links: se arregla una vez acá, o se propaga a cada lugar que
    // lo copie. Desde el 09/10/2026 la tab es **Automations** y su ruta
    // /automations (ex /chatbot, que redirige): las dos cosas cambiaron juntas.
    id: 'nutricion', tab: 'Automations', ruta: '/automations',
    que: 'Armar las secuencias de seguimiento y nutrición: qué se manda, cuándo, y a quién.',
    como: ['Entra a Automations', 'Elige la secuencia o crea una nueva', 'MaKo escribe los mensajes en tu voz y tú los apruebas'],
  },
  {
    id: 'email', tab: 'Email', ruta: '/email',
    que: 'Mandar campañas y secuencias por email.',
    como: ['Entra a Email', 'Elige a quién le va', 'Revisa el texto que escribe MaKo y envíalo'],
  },
  {
    // Desde el 11/10/2026 `/dashboard` ES la pantalla (el editor de informes); /marketing y
    // /comercial son redirects a sus hojas.
    id: 'metricas', tab: 'Dashboard', ruta: '/dashboard',
    que: 'Ver los números de marketing y comercial: gasto, costo por lead, agendas, show rate, cierres y facturación.',
    como: ['Abre el Dashboard', 'Elige el período', 'Pregúntale a MaKo qué cambió y por qué'],
  },
  {
    // Closing Analyst se retiró el 11/10/2026: las llamadas, su ficha y sus tareas son la hoja
    // «Closing» del Dashboard. ⚠️ La ruta lleva `?hoja=`: quien la cruce con el nav tiene que mirar
    // sólo el camino (lib/api-mako/areas/mako.run.ts, `disponible`).
    id: 'llamadas', tab: 'Dashboard', ruta: '/dashboard?hoja=closing',
    que: 'Analizar una llamada de venta: qué objeciones salieron, qué se hizo bien y qué corregir.',
    como: ['Abre la hoja Closing del Dashboard', 'Elige la llamada en «Las llamadas»', 'Lee el análisis y lo que propone para la próxima'],
  },
  {
    // Ads Analyst también se retiró: el análisis de los guiones es la hoja «Ads Analyst» del Dashboard,
    // y valorar un guion nuevo es la capacidad de abajo (`guion-valorar`, en Ads Writer).
    id: 'guiones-ads', tab: 'Dashboard', ruta: '/dashboard?hoja=ads-analyst',
    que: 'Ver qué guion y qué gancho retienen mejor, por cuartiles, cruzado con lo que después cerró.',
    como: ['Abre la hoja Ads Analyst del Dashboard', 'Mira los patrones y el cuadrante de retención', 'En «Guiones», compara hook rate, retención y agendas de cada uno'],
  },
  {
    id: 'guion-valorar', tab: 'Ads Writer', ruta: '/ads-writer?tab=analizar',
    que: 'Valorar un guion antes de grabarlo: MaKo lo compara contra lo que ya funcionó en tus anuncios y dice qué esperar.',
    como: ['Entra a Ads Writer, en Analizar guion', 'Pega el guion completo', 'Lee la valoración y qué esperar; los intentos quedan guardados'],
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
