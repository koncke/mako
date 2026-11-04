// =============================================================================
// spy-catalogo-datos — GENERADO desde docs/catalogo-funnels-y-formatos.md (§4). No se edita a mano.
// =============================================================================
// Se regenera con `node --import tsx scripts/spy-catalogo-a-codigo.mts`; tests/spy-funnel-tipo.test.ts falla si el catálogo
// y este archivo dicen cosas distintas. La investigación (definiciones y fuentes) vive en el documento.
// =============================================================================

import type { EntradaCatalogo } from './spy-catalogo-leer';

export const FUNNELS_DEL_CATALOGO: readonly EntradaCatalogo[] = [
  {
    "id": "evento-presencial",
    "label": "Evento presencial",
    "que": "Vende entradas a un evento en un lugar, y ahí vende lo caro.",
    "fuertes": [
      "comprar entradas",
      "compra tu entrada",
      "comprar boletos",
      "compra tu boleto",
      "boletos a la venta",
      "entradas a la venta",
      "venta de entradas",
      "preventa de entradas",
      "últimas entradas",
      "quedan pocas entradas",
      "entradas agotadas",
      "boletos agotados",
      "evento presencial",
      "100% presencial",
      "lugar del evento",
      "sede del evento",
      "centro de convenciones",
      "get tickets",
      "buy tickets",
      "in person event"
    ],
    "debiles": [
      "evento",
      "conferencia",
      "seminario",
      "congreso",
      "experiencia",
      "escenario",
      "speakers",
      "speaker",
      "conferencista",
      "agenda del evento",
      "networking",
      "auditorio",
      "teatro",
      "salón",
      "hotel",
      "sede",
      "dirección",
      "aforo",
      "cupo limitado",
      "primera edición",
      "próxima edición",
      "edición",
      "gira",
      "tour",
      "vip",
      "preventa",
      "early bird",
      "sold out",
      "agotamos",
      "agotado",
      "boletos",
      "entradas",
      "tickets",
      "venue"
    ],
    "compuestas": [
      "fecha + ciudad o sede + (entradas | boletos | tickets | preventa | vip)",
      "recap-evento con público + fecha o ciudad",
      "gracias + nombre de ciudad",
      "nos vemos en + nombre de ciudad"
    ],
    "descarta": [
      "online",
      "en línea",
      "virtual",
      "por zoom",
      "zoom",
      "desde tu casa",
      "desde donde estés",
      "link de acceso",
      "transmisión",
      "replay",
      "grabación",
      "en directo por youtube"
    ],
    "nota_hibrido": [
      "presencial y online",
      "modalidad híbrida",
      "híbrido",
      "streaming"
    ],
    "hosts": [
      "eventbrite.",
      "ticketmaster.",
      "passline.com",
      "boletia.com",
      "joinnus.com",
      "teleticket.com.pe",
      "tuboleta.com",
      "puntoticket.com",
      "eticket.",
      "ticketek.",
      "allaccess.com.ar",
      "tickantel.com.uy",
      "superboletos.com",
      "boletomovil.com",
      "entradium.com",
      "feverup.com",
      "dice.fm",
      "woutick.com",
      "wegow.com",
      "sympla.com.br",
      "luma.com",
      "lu.ma",
      "maps.app.goo.gl",
      "goo.gl/maps",
      "google.com/maps",
      "waze.com/ul"
    ]
  },
  {
    "id": "mastermind-retiro",
    "label": "Mastermind o retiro",
    "que": "Junta a un grupo chico unos días, por un precio alto.",
    "fuertes": [
      "mastermind",
      "retiro",
      "retreat",
      "solo por aplicación",
      "application only",
      "by invitation",
      "por invitación",
      "todo incluido",
      "hospedaje incluido"
    ],
    "debiles": [
      "grupo reducido",
      "cupos limitados",
      "intensivo",
      "inmersión",
      "círculo",
      "cohorte",
      "aplica",
      "destino"
    ],
    "compuestas": [
      "mastermind + (aplica | aplicación)",
      "retiro + fechas + lugar"
    ],
    "descarta": [
      "llamadas grupales por zoom"
    ],
    "hosts": [
      "typeform.com",
      "tally.so",
      "jotform.com",
      "forms.gle"
    ]
  },
  {
    "id": "webinar-en-vivo",
    "label": "Webinar en vivo",
    "que": "Una clase gratis en vivo, con registro, y la oferta al final.",
    "fuertes": [
      "clase en vivo gratuita",
      "masterclass gratuita en vivo",
      "webinar gratuito",
      "webinar en vivo",
      "regístrate a la clase",
      "free live training",
      "free webinar"
    ],
    "debiles": [
      "reserva tu lugar",
      "regístrate gratis",
      "inscríbete gratis",
      "save your seat",
      "register now",
      "masterclass",
      "clase gratuita",
      "taller online",
      "taller gratuito",
      "live workshop",
      "en vivo",
      "live",
      "webinar",
      "hora méxico",
      "hora colombia",
      "hora argentina",
      "hora españa",
      "hora cdmx",
      "grupo de whatsapp"
    ],
    "compuestas": [
      "(regístrate | reserva tu lugar | inscríbete) + fecha + hora, sin sede"
    ],
    "descarta": [
      "elige tu horario",
      "on demand",
      "acceso inmediato",
      "sede",
      "presencial",
      "centro de convenciones"
    ],
    "hosts": [
      "zoom.us/webinar/register",
      "zoom.us/meeting/register",
      "event.webinarjam.com",
      "livestorm.co",
      "demio.com",
      "streamyard.com",
      "crowdcast.io",
      "bigmarker.com",
      "gotowebinar.com",
      "chat.whatsapp.com"
    ]
  },
  {
    "id": "webinar-automatizado",
    "label": "Webinar automatizado",
    "que": "La misma clase grabada, que se ve a la hora que elijas.",
    "fuertes": [
      "elige tu horario",
      "elige el horario",
      "próxima sesión en",
      "comienza en minutos",
      "sesiones cada",
      "instant replay",
      "just in time"
    ],
    "debiles": [
      "ver ahora",
      "watch now",
      "on demand",
      "clase gratuita",
      "acceso inmediato",
      "webinar",
      "masterclass"
    ],
    "compuestas": [
      "registro + selector de sesión sin fecha fija"
    ],
    "descarta": [
      "solo en vivo",
      "no habrá repetición"
    ],
    "hosts": [
      "everwebinar.com",
      "easywebinar",
      "stealthseminar"
    ]
  },
  {
    "id": "vsl-llamada",
    "label": "VSL → llamada",
    "que": "Un video de venta que termina en agendar una llamada.",
    "fuertes": [
      "mira el video antes de agendar",
      "mira este video antes de agendar"
    ],
    "debiles": [
      "agenda tu llamada",
      "book a call",
      "agenda una sesión",
      "mira este video",
      "watch the video",
      "sesión estratégica",
      "llamada de diagnóstico",
      "sesión de claridad",
      "evaluación gratuita",
      "llamada gratuita"
    ],
    "compuestas": [
      "video principal + calendario en la misma página"
    ],
    "descarta": [
      "aplica",
      "aplicación",
      "postúlate"
    ],
    "hosts": [
      "calendly.com",
      "cal.com",
      "api.leadconnectorhq.com",
      "tidycal.com",
      "savvycal.com"
    ]
  },
  {
    "id": "vsl-compra",
    "label": "VSL → compra directa",
    "que": "Un video de venta con el botón de compra debajo.",
    "fuertes": [
      "comprar ahora",
      "quiero acceso",
      "inscríbete ahora",
      "garantía de devolución",
      "garantía de 7 días",
      "garantía incondicional",
      "buy now",
      "get instant access"
    ],
    "debiles": [
      "oferta especial",
      "precio de lanzamiento",
      "solo hoy",
      "bonos",
      "acceso de por vida",
      "garantía",
      "por solo"
    ],
    "compuestas": [
      "video principal + checkout (lib/spy-funnel.ts)"
    ],
    "descarta": [
      "agenda tu llamada",
      "aplica",
      "agregar al carrito"
    ],
    "hosts": [
      "pay.hotmart.com",
      "go.hotmart.com",
      "pay.kiwify.com",
      "buy.stripe.com",
      "checkout.stripe.com",
      "mpago.la",
      "link.mercadopago.",
      "mykajabi.com/offers",
      "thrivecart.com",
      "samcart.com",
      "gumroad.com"
    ]
  },
  {
    "id": "aplicacion-llamada",
    "label": "Aplicación + llamada",
    "que": "Llenas una solicitud y, si calificas, te llaman.",
    "fuertes": [
      "aplica aquí",
      "aplica ahora",
      "aplica a mi mentoría",
      "solicita tu lugar",
      "postúlate",
      "completa la aplicación",
      "llena la aplicación",
      "apply now",
      "revisamos cada aplicación"
    ],
    "debiles": [
      "aplica",
      "application",
      "no es para todos",
      "solo trabajamos con",
      "mentoría 1:1",
      "mentoría 1 a 1",
      "programa de acompañamiento",
      "high ticket",
      "trabajemos juntos",
      "cupos por mes",
      "llamada de evaluación"
    ],
    "compuestas": [
      "formulario + calendario después"
    ],
    "hosts": [
      "typeform.com",
      "tally.so",
      "jotform.com",
      "forms.gle",
      "docs.google.com/forms",
      "api.leadconnectorhq.com",
      "calendly.com"
    ]
  },
  {
    "id": "agenda-directa",
    "label": "Agenda directa",
    "que": "Del anuncio o el contenido, directo a agendar una llamada.",
    "fuertes": [
      "agenda tu llamada gratis",
      "agenda una llamada gratis",
      "reserva tu sesión",
      "consulta gratuita",
      "llamada de descubrimiento",
      "book a free call",
      "free consultation",
      "discovery call"
    ],
    "debiles": [
      "llamada",
      "sesión",
      "agenda",
      "diagnóstico",
      "reservar"
    ],
    "compuestas": [
      "enlace de calendario en la bio o en un botón"
    ],
    "descarta": [
      "aplica",
      "aplicación"
    ],
    "hosts": [
      "calendly.com",
      "cal.com",
      "tidycal.com",
      "savvycal.com",
      "as.me",
      "acuityscheduling.com",
      "meetings.hubspot.com",
      "calendar.app.google",
      "youcanbook.me",
      "zcal.co",
      "oncehub.com"
    ]
  },
  {
    "id": "dm-setter",
    "label": "Conversación por DM → llamada",
    "que": "Te escribe por mensaje privado y te lleva a una llamada.",
    "debiles": [
      "escríbeme",
      "envíame un mensaje",
      "mándame un dm",
      "dm para info",
      "info por dm",
      "hablemos",
      "dm me",
      "send me a message",
      "agenda por dm"
    ],
    "compuestas": [
      "2 o más débiles + alguna señal de llamada (agenda, sesión, calendly)"
    ],
    "descarta": [
      "comenta"
    ],
    "hosts": [
      "ig.me/m",
      "m.me"
    ]
  },
  {
    "id": "dm-palabra-clave",
    "label": "DM por palabra clave",
    "que": "Comentas una palabra y te llega el enlace por mensaje.",
    "fuertes": [
      "comenta la palabra",
      "te lo envío por dm",
      "te lo mando por dm",
      "te llega por mensaje",
      "te envío el link por dm",
      "comment the word"
    ],
    "debiles": [
      "por dm",
      "te lo mando",
      "link por mensaje",
      "comenta"
    ],
    "compuestas": [
      "comenta + MAYÚSCULAS",
      "escribe + MAYÚSCULAS + en los comentarios",
      "déjame + MAYÚSCULAS + en comentarios",
      "escríbeme + MAYÚSCULAS + (por dm | por mensaje)",
      "comment + MAYÚSCULAS",
      "dm me + MAYÚSCULAS"
    ]
  },
  {
    "id": "whatsapp-conversacional",
    "label": "Conversación por WhatsApp",
    "que": "Te lleva a WhatsApp y vende conversando.",
    "fuertes": [
      "escríbenos por whatsapp",
      "escríbeme por whatsapp",
      "mándanos un whatsapp"
    ],
    "debiles": [
      "whatsapp",
      "info por whatsapp",
      "pide informes"
    ],
    "compuestas": [
      "anuncio cuyo destino es wa.me o api.whatsapp.com"
    ],
    "hosts": [
      "wa.me",
      "api.whatsapp.com/send",
      "whatsapp.com/send"
    ]
  },
  {
    "id": "reto",
    "label": "Reto o challenge",
    "que": "Un reto gratis de varios días que termina en la oferta.",
    "fuertes": [
      "reto gratuito",
      "únete al reto",
      "inscríbete al reto",
      "día 1 del reto"
    ],
    "debiles": [
      "reto",
      "desafío",
      "challenge",
      "días"
    ],
    "compuestas": [
      "(reto | desafío | challenge) + de + [N] + días + registro",
      "[N]-day challenge + registro",
      "día [N] del reto"
    ],
    "hosts": [
      "chat.whatsapp.com",
      "facebook.com/groups",
      "t.me"
    ]
  },
  {
    "id": "lanzamiento",
    "label": "Lanzamiento",
    "que": "Una serie de videos gratis antes de abrir las ventas.",
    "fuertes": [
      "carrito abierto",
      "abrimos inscripciones",
      "inscripciones abiertas",
      "cierre de inscripciones",
      "últimas horas para inscribirte",
      "inscripciones cerradas",
      "lista de espera",
      "próxima apertura",
      "cart open",
      "doors open",
      "doors close",
      "waitlist",
      "contenido de prelanzamiento"
    ],
    "debiles": [
      "lanzamiento",
      "muy pronto",
      "se viene algo grande",
      "grupo vip",
      "preventa",
      "cpl"
    ],
    "compuestas": [
      "clase + [N] (serie de 3) (débil)",
      "video [N] de [N] (débil)",
      "aula [N] (débil)"
    ],
    "hosts": [
      "chat.whatsapp.com"
    ]
  },
  {
    "id": "clase-gratis",
    "label": "Clase gratis o mini curso",
    "que": "Clases o un mini curso gratis que llevan a la oferta.",
    "fuertes": [
      "mini curso gratis",
      "curso gratuito",
      "entrenamiento gratuito",
      "serie de videos gratis",
      "mírala ahora",
      "free training",
      "free mini course",
      "free video series",
      "free course"
    ],
    "debiles": [
      "clase gratuita",
      "gratis",
      "clase",
      "aprende gratis",
      "acceso inmediato"
    ],
    "compuestas": [
      "clase gratuita + acceso inmediato",
      "serie de [N] videos"
    ],
    "descarta": [
      "elige tu horario",
      "en vivo"
    ]
  },
  {
    "id": "lead-magnet",
    "label": "Lead magnet → email",
    "que": "Un regalo a cambio del email, y después la venta por correo.",
    "fuertes": [
      "descarga gratis",
      "descárgala gratis",
      "guía gratuita",
      "guía gratis",
      "plantilla gratis",
      "checklist gratis",
      "ebook gratis",
      "pdf gratis",
      "te lo envío a tu correo",
      "free download",
      "free guide",
      "free template",
      "free checklist"
    ],
    "debiles": [
      "gratis",
      "recurso",
      "regalo",
      "freebie",
      "plantilla",
      "guía",
      "checklist",
      "ebook"
    ],
    "compuestas": [
      "formulario de email + recurso gratis"
    ],
    "hosts": [
      "kit.com",
      "ck.page",
      "convertkit.com",
      "mailchi.mp",
      "eepurl.com",
      "flodesk.com",
      "mailerlite.com",
      "activehosted.com",
      "systeme.io"
    ]
  },
  {
    "id": "quiz",
    "label": "Quiz o test",
    "que": "Un test que te dice qué te conviene y te ofrece algo.",
    "fuertes": [
      "haz el test",
      "responde el quiz",
      "descubre qué tipo de",
      "test gratuito",
      "scorecard",
      "take the quiz"
    ],
    "debiles": [
      "descubre",
      "test",
      "quiz",
      "evaluación gratuita",
      "find out your",
      "diagnóstico en 2 minutos",
      "qué tipo de"
    ],
    "compuestas": [
      "preguntas + página de resultados"
    ],
    "hosts": [
      "scoreapp.com",
      "tryinteract.com",
      "outgrow.co",
      "involve.me"
    ]
  },
  {
    "id": "comunidad",
    "label": "Comunidad o membresía",
    "que": "Una comunidad o membresía con pago cada mes.",
    "fuertes": [
      "únete a mi comunidad",
      "comunidad gratuita",
      "membresía",
      "suscripción mensual",
      "join my community",
      "free community"
    ],
    "debiles": [
      "comunidad",
      "tribu",
      "club",
      "miembros",
      "al mes"
    ],
    "compuestas": [
      "precio + al mes (o /mes) (débil)"
    ],
    "hosts": [
      "skool.com",
      "circle.so",
      "mn.co",
      "discord.gg",
      "discord.com/invite",
      "t.me",
      "patreon.com",
      "whop.com"
    ]
  },
  {
    "id": "low-ticket",
    "label": "Low ticket → upsell",
    "que": "Algo barato primero, y después lo caro.",
    "fuertes": [
      "agrega también",
      "oferta única",
      "solo en esta página",
      "one time offer",
      "order bump"
    ],
    "debiles": [
      "por solo",
      "a solo",
      "precio especial",
      "oferta",
      "taller",
      "menos de lo que cuesta un café"
    ],
    "compuestas": [
      "checkout + precio bajo para su mercado",
      "taller + precio (débil)"
    ],
    "descarta": [
      "aplica",
      "agenda tu llamada"
    ],
    "hosts": [
      "pay.hotmart.com",
      "pay.kiwify.com",
      "stan.store",
      "gumroad.com",
      "payhip.com",
      "whop.com",
      "lemonsqueezy.com"
    ]
  },
  {
    "id": "summit-virtual",
    "label": "Cumbre virtual",
    "que": "Varias charlas online gratis, con un pase pago.",
    "fuertes": [
      "summit",
      "cumbre virtual",
      "congreso virtual",
      "pase gratuito",
      "all access pass",
      "pase de acceso total"
    ],
    "debiles": [
      "speakers",
      "expertos",
      "conferencias",
      "congreso",
      "pase vip"
    ],
    "compuestas": [
      "[N] expertos + online"
    ],
    "descarta": [
      "sede",
      "centro de convenciones",
      "presencial"
    ]
  },
  {
    "id": "libro",
    "label": "Libro gratis + envío",
    "que": "Un libro gratis, pagas el envío, y después la oferta.",
    "fuertes": [
      "solo pagas el envío",
      "free plus shipping",
      "consigue mi libro gratis"
    ],
    "debiles": [
      "libro gratis",
      "mi libro",
      "autor de",
      "libro"
    ],
    "hosts": [
      "amazon."
    ]
  },
  {
    "id": "tienda",
    "label": "Tienda online",
    "que": "Vende productos en su tienda online.",
    "fuertes": [
      "agregar al carrito",
      "tienda online",
      "envío gratis",
      "shop now",
      "add to cart"
    ],
    "debiles": [
      "envíos a todo el país",
      "productos",
      "catálogo",
      "tienda"
    ],
    "compuestas": [
      "ruta /products/ o /collections/ o /cart o /carrito o /producto/"
    ],
    "hosts": [
      "myshopify.com",
      "mitiendanube.com",
      "tiendanube.com",
      "mercadolibre.",
      "amazon."
    ]
  },
  {
    "id": "newsletter",
    "label": "Newsletter",
    "que": "Un correo periódico que vende de a poco.",
    "fuertes": [
      "suscríbete a mi newsletter",
      "newsletter semanal",
      "subscribe to my newsletter"
    ],
    "debiles": [
      "newsletter",
      "correo",
      "suscríbete",
      "cada domingo"
    ],
    "hosts": [
      "substack.com",
      "beehiiv.com"
    ]
  }
];

export const FORMATOS_DEL_CATALOGO: readonly EntradaCatalogo[] = [
  {
    "id": "tutorial",
    "label": "Tutorial",
    "fuertes": [
      "tutorial",
      "paso a paso",
      "cómo hacer",
      "how to",
      "step by step"
    ],
    "debiles": [
      "cómo",
      "aprende a",
      "te enseño",
      "guía",
      "así se hace",
      "demo"
    ]
  },
  {
    "id": "lista",
    "label": "Lista o tips",
    "debiles": [
      "top",
      "lista",
      "tips",
      "consejos"
    ],
    "compuestas": [
      "[N] + (errores | tips | consejos | claves | pasos | razones | cosas | hábitos | herramientas | señales | mistakes | ways)"
    ]
  },
  {
    "id": "storytime",
    "label": "Storytime",
    "fuertes": [
      "storytime",
      "mi historia",
      "les cuento cómo",
      "te cuento cómo",
      "nunca les conté",
      "la vez que",
      "lo que me pasó"
    ],
    "debiles": [
      "cuando yo",
      "cuando empecé",
      "my story"
    ],
    "compuestas": [
      "hace + [N] + años (débil)"
    ]
  },
  {
    "id": "pov",
    "label": "POV",
    "fuertes": [
      "pov",
      "punto de vista"
    ],
    "debiles": [
      "cuando eres",
      "tú cuando"
    ]
  },
  {
    "id": "antes-despues",
    "label": "Antes y después",
    "fuertes": [
      "antes y después",
      "antes vs ahora",
      "before and after",
      "glow up"
    ],
    "debiles": [
      "transformación",
      "hace un año",
      "antes",
      "después"
    ],
    "compuestas": [
      "de + cifra + a + cifra (débil)"
    ]
  },
  {
    "id": "testimonio",
    "label": "Testimonio",
    "fuertes": [
      "testimonio",
      "testimonial",
      "opinión de mi alumna",
      "opinión de mi alumno",
      "review de mi cliente"
    ],
    "debiles": [
      "alumno",
      "alumna",
      "cliente",
      "gracias a",
      "resultados"
    ],
    "compuestas": [
      "lo que dice + nombre"
    ]
  },
  {
    "id": "caso-de-exito",
    "label": "Caso de éxito",
    "fuertes": [
      "caso de éxito",
      "case study",
      "cómo ayudé a"
    ],
    "debiles": [
      "facturó",
      "resultados",
      "en meses"
    ],
    "compuestas": [
      "cómo + nombre + pasó de",
      "de + cifra + a + cifra + en + [N] + meses (débil)"
    ]
  },
  {
    "id": "opinion",
    "label": "Opinión",
    "fuertes": [
      "opinión impopular",
      "unpopular opinion",
      "hot take",
      "me van a odiar por esto",
      "nadie te dice"
    ],
    "debiles": [
      "la verdad sobre",
      "deja de",
      "stop",
      "polémico",
      "mi opinión"
    ]
  },
  {
    "id": "mito",
    "label": "Mito vs realidad",
    "fuertes": [
      "mito vs realidad",
      "mitos",
      "mito",
      "myth",
      "te mintieron",
      "no es cierto que"
    ],
    "debiles": [
      "falso",
      "mentira",
      "en realidad"
    ]
  },
  {
    "id": "resena",
    "label": "Reseña",
    "fuertes": [
      "reseña",
      "review",
      "unboxing",
      "honest review"
    ],
    "debiles": [
      "probé",
      "vale la pena",
      "vs",
      "comparación",
      "mejor"
    ]
  },
  {
    "id": "detras",
    "label": "Detrás de escena",
    "fuertes": [
      "detrás de cámaras",
      "detrás de escena",
      "behind the scenes",
      "bts",
      "un día en mi vida",
      "day in my life",
      "vlog"
    ],
    "debiles": [
      "mi rutina",
      "así es mi día",
      "preparando"
    ]
  },
  {
    "id": "recap-evento",
    "label": "Recap de evento",
    "fuertes": [
      "recap",
      "resumen del evento",
      "así se vivió",
      "aftermovie",
      "highlights"
    ],
    "debiles": [
      "sold out",
      "así fue",
      "lleno total",
      "qué noche",
      "edición",
      "escenario"
    ],
    "compuestas": [
      "gracias + nombre de ciudad"
    ]
  },
  {
    "id": "entrevista",
    "label": "Entrevista o podcast",
    "fuertes": [
      "entrevista",
      "podcast",
      "episodio",
      "invitado",
      "conversación con",
      "charla con"
    ],
    "debiles": [
      "ep.",
      "con @"
    ]
  },
  {
    "id": "preguntas",
    "label": "Preguntas y respuestas",
    "fuertes": [
      "respondiendo a",
      "preguntas frecuentes",
      "me preguntaron",
      "q&a",
      "preguntas y respuestas",
      "ask me anything"
    ],
    "debiles": [
      "respondo",
      "pregunta de",
      "me escriben"
    ]
  },
  {
    "id": "reaccion",
    "label": "Reacción",
    "fuertes": [
      "reacciono",
      "reaccionando a",
      "reaction",
      "stitch",
      "dueto",
      "duet"
    ],
    "debiles": [
      "vi este video",
      "opino sobre"
    ]
  },
  {
    "id": "tendencia",
    "label": "Tendencia o meme",
    "fuertes": [
      "trend",
      "meme",
      "sketch",
      "parodia"
    ],
    "compuestas": [
      "línea que arranca con nadie: o yo: (débil)",
      "audio que no es suyo + menos de 15 s (débil)"
    ]
  },
  {
    "id": "frase",
    "label": "Frase",
    "debiles": [
      "frase",
      "recuerda",
      "reflexión",
      "quote"
    ],
    "compuestas": [
      "una sola imagen + texto entre comillas"
    ]
  },
  {
    "id": "promo",
    "label": "Promoción directa",
    "fuertes": [
      "inscríbete",
      "inscripciones abiertas",
      "últimos lugares",
      "entradas a la venta",
      "preventa",
      "link en mi bio para inscribirte"
    ],
    "debiles": [
      "link en mi bio",
      "cupos",
      "oferta",
      "descuento"
    ],
    "compuestas": [
      "hasta el + fecha (débil)",
      "precio + moneda (débil)"
    ]
  },
  {
    "id": "otro",
    "label": "Otro"
  }
];
