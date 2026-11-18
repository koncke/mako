// v5 (18/11/2026, Martín vía el Cerebro): the scripts know what the person is living. Applied once over guiones.json:
//   · the 34 tabs: the «qué es» step becomes the welcome to the tab («Te doy la bienvenida a X: en esta pestaña vas a poder…»);
//   · recorrido: «¡Hola de nuevo!» (the welcome of the onboarding came first) and the TWO coaches, marked without pausing;
//   · new: the onboarding (3), Offer Coach and Funnel Coach (two chats, Martín 15/11), and the 7 days of the reto (lib/reto/dias.ts).
// The source of the text is guiones-v5.md (approved by the Cerebro with its 4 corrections). Run: node motor/aplicar-v5.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const RAIZ = 'C:/dev/tutoriales-video';
const G = JSON.parse(readFileSync(`${RAIZ}/guiones.json`, 'utf8'));

const BIENVENIDA = {
  'ops-center': 'Te doy la bienvenida al Ops Center: en esta pestaña vas a poder pedirle a Máko lo que necesites, con tus palabras, y lo hace por ti.',
  offer: 'Te doy la bienvenida a Offer: en esta pestaña vas a poder armar tu oferta en un chat con Máko, y de ahí salen tu landing y tus guiones.',
  copilot: 'Te doy la bienvenida al Marketing CoPilot: aquí tienes tu equipo de marketing, que mira lo que publicas y lo que inviertes, y te dice qué hacer.',
  'settings-integraciones': 'Te doy la bienvenida a Integraciones, en Settings: aquí vas a poder darle a Máko acceso a tu negocio.',
  settings: 'Te doy la bienvenida a tu perfil, en Settings: lo que escribes se guarda solo, al salir del campo.',
  crm: 'Te doy la bienvenida al CRM: en esta pestaña vas a poder ver tu venta en columnas, y arriba de cada una, cuánto podría entrar.',
  ticketera: 'Te doy la bienvenida a la Ticketera: en este chat vas a poder avisarle al equipo de un error o de una idea, y Máko arma el ticket contigo.',
  calendar: 'Te doy la bienvenida a Calendar: en esta pestaña vas a poder ver todo lo que tienes agendado, y las reuniones del CRM aparecen solas.',
  automations: 'Te doy la bienvenida a Automations: en esta pestaña vas a poder mandar mensajes solos cuando alguien agenda, no se presenta o le vence una cuota.',
  spy: 'Te doy la bienvenida a Competitor Spy: aquí sigues las cuentas que eliges, y te marca las piezas que rindieron varias veces más de lo normal.',
  copywriting: 'Te doy la bienvenida a Copywriting: en esta pestaña vas a ver los anuncios, reels y videos que mejor rindieron en las cuentas que sigues.',
  web: 'Te doy la bienvenida a Web Generator: aquí vas a ver páginas que venden, y cada una trae su botón Replicar.',
  plan: 'Te doy la bienvenida al Plan: aquí tu negocio se ordena en un Objetivo Principal y cinco tareas para ahora.',
  dashboard: 'Te doy la bienvenida al Dashboard: arranca vacío a propósito, y aquí vas a poder llenarlo con hojas de lo que quieres ver.',
  classroom: 'Te doy la bienvenida a Classroom: aquí vas a poder armar tu curso, y cada módulo es una etapa de tu entrega.',
  avatar: 'Te doy la bienvenida a Ei-Ai Avatar: aquí vas a poder ponerte en esas escenas con IA, en cuatro pasos.',
  video: 'Te doy la bienvenida a Video: aquí vas a poder armar tus videos con Máko, a partir de una frase o de una plantilla.',
  image: 'Te doy la bienvenida a Ímich: aquí vas a poder armar esas piezas, y cada miniatura de YouTube viene en dos versiones para probar cuál se toca más.',
  chats: 'Te doy la bienvenida a Chats: aquí vas a leer los mensajes de tus clientes, escriban por donde escriban, y en WhatsApp Máko te sugiere qué contestar.',
  'classroom-community': 'Te doy la bienvenida a Community, dentro de Classroom: aquí conversan tus alumnos entre ellos, contigo y con tu equipo.',
  'classroom-clients': 'Te doy la bienvenida a Clients, dentro de Classroom: aquí vas a ver en qué etapa de tu servicio va cada cliente que ganaste en el CRM.',
  'classroom-calendar': 'Te doy la bienvenida al Calendar del curso: aquí vas a poder armar esas citas con tus alumnos.',
  'classroom-leaderboards': 'Te doy la bienvenida a Leaderboards, dentro de Classroom: aquí vas a ver el ranking de tu comunidad.',
  'classroom-about': 'Te doy la bienvenida a About, dentro de Classroom: aquí cuentas de qué se trata tu comunidad y qué se espera de cada miembro.',
  'settings-seguridad': 'Te doy la bienvenida a Seguridad, en Settings: aquí vas a ver lo que le falta a tu cuenta para protegerla.',
  'settings-notificaciones': 'Te doy la bienvenida a Notificaciones, en Settings: aquí eliges por dónde te avisa: En la app, Celular, WhatsApp o Email.',
  'settings-instalar': 'Te doy la bienvenida a Instalar la app, en Settings: aquí te guío en cada uno.',
  'settings-equipo': 'Te doy la bienvenida a Equipo, en Settings: aquí vas a poder sumar a quien trabaja contigo, con su rol.',
  'settings-fiscal': 'Te doy la bienvenida a Identidades fiscales, en Settings: aquí guardas tu moneda y cada empresa con la que facturas.',
  'settings-plan': 'Te doy la bienvenida a Tu plan, en Settings: aquí vas a ver qué día termina tu prueba gratis y cuánto se cobra.',
  partners: 'Te doy la bienvenida a Máko Partners, en el menú de tu foto: aquí vas a poder ganar dinero por recomendar Máko.',
  agency: 'Te doy la bienvenida a Agency Dashboard, en el menú de tu foto: aquí juntas las cuentas de tus clientes.',
  api: 'Te doy la bienvenida a la API, en el menú de tu foto: aquí vas a poder hacer que esas herramientas lean y escriban en tu cuenta.',
  'report-problem': 'Te doy la bienvenida a Report a problem, en el menú de tu foto: aquí le llevas tu pedido al equipo.',
};

for (const [id, dice] of Object.entries(BIENVENIDA)) {
  const g = G.find((x) => x.id === id); if (!g) throw new Error('falta ' + id);
  const p = g.pasos.find((x) => x.rol === 'que-es'); if (!p) throw new Error('sin que-es ' + id);
  p.dice = dice;                                      // `ver` stays: «Ei-Ai» → AI, «Ímich» → Image
  g.v5 = true;
}

// recorrido: after the onboarding welcome; the two coaches marked WITHOUT pausing (a click on a coach mid-tour would open it and
// start its own first-time video)
const rec = G.find((x) => x.id === 'recorrido');
rec.pasos = [
  { dice: '¡Hola de nuevo! Ya estás adentro de Máko.', rol: 'gancho' },
  { dice: 'Máko trae un equipo entero para tu negocio: te lo presento en un minuto.', rol: 'gancho' },
  { dice: 'Todo arranca en el Ops Center: escribes lo que te hace falta, y Máko se encarga.', rol: 'que-es' },
  { dice: 'Mira aquí, Offer Coach: arma contigo tu oferta.', rol: 'accion', tipo: 'mira', sel: 'button[title="Offer Coach"]' },
  { dice: 'Y aquí, Funnel Coach: tu sistema para conseguir clientes.', rol: 'accion', tipo: 'mira', sel: 'button[title="Funnel Coach"]' },
  ...rec.pasos.slice(3),
];
rec.v5 = true;

const base = (id, pestana, ruta, icono, pasos, extra = {}) => ({ id, pestana, ruta, icono, soloTexto: true, v4: true, v5: true, pasos, ...extra });
const DEBAJO = { dice: 'Debajo de este video están tus tareas: toca cada una y te marco dónde se hace.', rol: 'cosa' };
const NUEVOS = [
  base('onboarding-bienvenida', 'Onboarding · Bienvenida', '/onboarding', 'lucide:sparkles', [
    { dice: '¡Hola! Soy Martín, el creador de Máko. Bueno, mi versión en cubos.', rol: 'gancho' },
    { dice: 'Te doy la bienvenida a Máko: desde hoy tienes un equipo entero trabajando para tu negocio.', rol: 'que-es' },
    { dice: 'Ya activaste tu prueba gratuita de 7 días, y quiero que le saques el máximo provecho.', rol: 'cosa' },
    { dice: 'Primero, unas preguntas cortas para conocerte: contéstalas en el chat, debajo de este video.', rol: 'cierre' },
  ]),
  base('onboarding-whatsapp', 'Onboarding · Tu WhatsApp', '/onboarding', 'lucide:messages-square', [
    { dice: 'Tu WhatsApp es por donde Máko te manda avances sobre tu negocio.', rol: 'gancho' },
    { dice: 'Para confirmarlo, toca Abrir WhatsApp y manda el mensaje que ya va escrito, con tu código.', rol: 'que-es' },
    { dice: 'En cuanto llega, tu número queda confirmado solo.', rol: 'cosa' },
    { dice: 'Y guarda el contacto de Máko en tu teléfono: así esos avances siempre te llegan.', rol: 'cierre' },
  ]),
  base('onboarding-seguir-pc', 'Onboarding · Sigamos en tu computadora', '/onboarding (en el teléfono)', 'lucide:download', [
    { dice: 'Desde el teléfono, esto era todo por ahora.', rol: 'gancho' },
    { dice: 'Lo que sigue se ve mucho mejor en una pantalla grande: Máko por dentro y tu reto de 7 días.', rol: 'que-es' },
    { dice: 'Abre Máko en tu computadora con el link que te mandamos a tu correo, y entra con tu cuenta.', rol: 'cosa' },
    { dice: 'Lo que contestaste ya está guardado: sigues justo donde quedaste.', rol: 'cierre' },
  ]),
  base('offer-coach', 'Offer Coach', '/second-brain', 'lucide:tag', [
    { dice: 'Si tu oferta no convence, ningún anuncio la salva.', rol: 'gancho' },
    { dice: 'Te doy la bienvenida a Offer Coach: aquí armas tu oferta, que es todo lo que prometes y entregas.', rol: 'que-es' },
    { dice: 'Te pregunta una cosa a la vez, y si algo no conviene, te frena.', rol: 'cosa' },
    { dice: 'Al final te deja el diagnóstico de tu oferta, con su nota.', rol: 'cosa' },
    { dice: 'Mira aquí, la caja del chat: contéstale la primera pregunta.', rol: 'cierre', tipo: 'mira', sel: '[data-recorrido="sb-escribir"]' },
  ]),
  base('funnel-coach', 'Funnel Coach', '/second-brain', 'lucide:workflow', [
    { dice: 'Una oferta que nadie ve, no vende.', rol: 'gancho' },
    { dice: 'Te doy la bienvenida a Funnel Coach: aquí armas tu sistema para conseguir clientes.', rol: 'que-es' },
    { dice: 'Tu funnel es un solo camino, desde que alguien te ve hasta que te paga, y se arma alrededor de tu oferta.', rol: 'cosa' },
    { dice: 'Conviene empezar por uno: con varios a la vez, no ves cuál te trae clientes.', rol: 'cosa' },
    { dice: 'Funnel Coach te pregunta una cosa a la vez, y lo que elijas queda en tu CRM, con sus etapas.', rol: 'cosa' },
    { dice: 'Mira aquí, la caja del chat: contéstale la primera pregunta.', rol: 'cierre', tipo: 'mira', sel: '[data-recorrido="sb-escribir"]' },
  ]),
  base('reto-dia-1', 'Reto · Día 1: tu oferta y tu sistema de adquisición', '/second-brain?reto=1', 'lucide:trophy', [
    { dice: 'Te doy la bienvenida al día 1 del reto de 7 días.', rol: 'gancho' },
    { dice: 'Tu onboarding ya está. Hoy armas tu oferta con Offer Coach, y después tu sistema para conseguir clientes con Funnel Coach.', rol: 'que-es' },
    { dice: 'Los dos te preguntan como un coach, una cosa a la vez, y tu funnel queda armado en el CRM.', rol: 'cosa' },
    { ...DEBAJO, rol: 'cierre' },
  ]),
  base('reto-dia-2', 'Reto · Día 2: conecta todo', '/second-brain?reto=1', 'lucide:trophy', [
    { dice: 'Te doy la bienvenida al día 2: hoy conectamos todo, de a un paso.', rol: 'gancho' },
    { dice: 'Primero, Máko en tu teléfono: escaneas un QR, y los avisos de tu negocio te llegan al instante.', rol: 'que-es' },
    { dice: 'Después, la extensión para Chrome, para tener a Máko a mano mientras navegas.', rol: 'cosa' },
    { dice: 'En Integraciones conectas sólo lo que necesita tu funnel, y al final, tu perfil y tu foto.', rol: 'cosa' },
    DEBAJO,
    { dice: 'Para cerrar el día, dile a Máko por WhatsApp a qué hora te escribe sobre el reto: le escribes tú primero, y así WhatsApp no frena sus mensajes.', rol: 'cierre' },
  ]),
  base('reto-dia-3', 'Reto · Día 3: tus contactos', '/second-brain?reto=1', 'lucide:trophy', [
    { dice: 'Te doy la bienvenida al día 3: hoy ordenas tus contactos y tu agenda.', rol: 'gancho' },
    { dice: 'Cargas tus clientes en el CRM, con un CSV o integrando el CRM que ya usas.', rol: 'que-es' },
    { dice: 'Y conectas tu calendario: las llamadas que agenden caen en tu agenda.', rol: 'cosa' },
    DEBAJO,
    { dice: 'Y pruébalo por WhatsApp: mándale a Máko un audio pidiéndole que cargue un lead en tu CRM.', rol: 'cierre' },
  ], { nota: 'Sin la difusión: el Cerebro la está confirmando con Martín (nada invasivo, cuidar el baneo). Si dice que sí, se suma.' }),
  base('reto-dia-4', 'Reto · Día 4: copia lo que le funciona a tu competencia', '/second-brain?reto=1', 'lucide:trophy', [
    { dice: 'Te doy la bienvenida al día 4: hoy copias lo que ya le funciona a tu competencia.', rol: 'gancho' },
    { dice: 'En Competitor Spy agregas a tres competidores y miras lo que más tiempo llevan activo: si sigue activo, es porque vende.', rol: 'que-es' },
    { dice: 'Después, en Web Generator pegas una página que ya vende, y la arma con tu oferta.', rol: 'cosa' },
    DEBAJO,
    { dice: 'Y por WhatsApp, pregúntale a Máko qué le está funcionando a tu competencia.', rol: 'cierre' },
  ]),
  base('reto-dia-5', 'Reto · Día 5: tu carrusel y tu guion', '/second-brain?reto=1', 'lucide:trophy', [
    { dice: 'Te doy la bienvenida al día 5: hoy armas una semana de contenido, sin hoja en blanco.', rol: 'gancho' },
    { dice: 'En Ímich replicas un carrusel que ya funcionó, con tu oferta.', rol: 'que-es', ver: { 'ímich': 'Image' } },
    { dice: 'Y en Copywriting escribes tu guion replicando a tu referente.', rol: 'cosa' },
    DEBAJO,
    { dice: 'Y por WhatsApp, mándale a Máko un audio con la idea de tu guion: te lo escribe.', rol: 'cierre' },
  ]),
  base('reto-dia-6', 'Reto · Día 6: tu video con IA', '/second-brain?reto=1', 'lucide:trophy', [
    { dice: 'Te doy la bienvenida al día 6: hoy haces tu video con IA, sin grabarte.', rol: 'gancho' },
    { dice: 'En Video, dentro de Ei-Ai Avatar, armas tu personaje con una foto tuya.', rol: 'que-es', ver: { 'ei-ai': 'AI' } },
    { dice: 'Y el clip de 10 segundos va de regalo, con el gancho del guion que escribiste ayer.', rol: 'cosa' },
    DEBAJO,
    { dice: 'Mañana es el último día: tu CoPilot revisa todo lo que armaste.', rol: 'cierre' },
  ]),
  base('reto-dia-7', 'Reto · Día 7: tu Marketing CoPilot', '/second-brain?reto=1', 'lucide:trophy', [
    { dice: 'Te doy la bienvenida al día 7, el último del reto.', rol: 'gancho' },
    { dice: 'Hoy tu Marketing CoPilot revisa todo lo que armaste: tu oferta, tu página y tu contenido.', rol: 'que-es' },
    { dice: 'Y te deja las tareas de cada semana en tu Plan.', rol: 'cosa' },
    DEBAJO,
    { dice: 'Y mándale a Máko un audio por WhatsApp con cómo te fue en el reto.', rol: 'cierre' },
  ]),
];
// order: what is seen first goes first (the manifest is sorted by guiones.json)
const sinNuevos = G.filter((x) => !NUEVOS.some((n) => n.id === x.id));
const orden = ['onboarding-bienvenida', 'onboarding-whatsapp', 'onboarding-seguir-pc', 'recorrido', 'offer-coach', 'funnel-coach',
  'reto-dia-1', 'reto-dia-2', 'reto-dia-3', 'reto-dia-4', 'reto-dia-5', 'reto-dia-6', 'reto-dia-7'];
const todos = [...NUEVOS, ...sinNuevos];
const final = [...orden.map((k) => todos.find((x) => x.id === k)), ...sinNuevos.filter((x) => !orden.includes(x.id))];
writeFileSync(`${RAIZ}/guiones.json`, JSON.stringify(final, null, 1) + '\n');
console.log(final.length, 'guiones;', final.filter((x) => x.v5).length, 'v5');
