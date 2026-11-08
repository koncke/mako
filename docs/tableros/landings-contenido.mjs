// =============================================================================
// El contenido de las landings. El molde está en generar-landings.mjs.
// =============================================================================
// ⚠️ NINGUNA FRASE SIN FUENTE. Al lado de cada afirmación que no sea obvia va de dónde sale.
// ⚠️ Español neutro con «tú»: la audiencia es México (reglas-de-voz-y-nombres).
//
// FALTA LA OCTAVA, /l/avatar, A PROPÓSITO: `AI_AVATAR_SE_VENDE = false` en lib/planes-comparacion.ts.
// La tab está abierta en los tres planes desde el 29/10, pero el avatar NO SE VENDE y se paga con los
// créditos de Google Flow de la persona. Una landing que lo venda promete algo que el checkout no da.
// Es una decisión de producto de Martín, no un olvido.
// =============================================================================
import { LANDINGS, generar } from './generar-landings.mjs';

LANDINGS.push({
  slug: 'setter',
  titulo: 'Tu setter que no duerme',
  para: 'Para coaches, infoproductores e inmobiliarias',
  h1: 'Te escribieron a las 3 de la mañana.<br><em>Alguien les contestó.</em>',
  bajada: 'MaKo le responde a cada interesado de WhatsApp e Instagram en segundos, a cualquier hora, hasta dejar la llamada agendada en tu calendario. Tú entras cuando ya hay con quién hablar.',
  chat: {
    h2: 'Así se ve',
    sub: 'Tres idas y vueltas, desde que escriben hasta que queda agendado en tu calendario.',
    pie: 'Mientras dormías, quedó en tu calendario.',
    mensajes: [
      { de: 'ellos', hora: '03:14', texto: 'Hola, vi el reel. ¿Cómo funciona el programa?' },
      { de: 'mako', hora: '03:14 · 11 segundos después', texto: '¡Hola! Qué bueno que escribes. Cuéntame rápido: ¿ya estás vendiendo o apenas empiezas?' },
      { de: 'ellos', hora: '03:16', texto: 'Vendiendo, pero se me va el día contestando mensajes' },
      { de: 'mako', hora: '03:16', texto: 'Te entiendo, es lo que más escuchamos. Lo mejor es que lo veas en 20 minutos con alguien del equipo. ¿Mañana 10:30 o el jueves 16:00?' },
      { de: 'ellos', hora: '03:17', texto: 'Jueves 16' },
      { de: 'mako', hora: '03:17', texto: 'Listo, agendado para el jueves a las 16:00. Te llega la invitación por correo. 👋' },
    ],
  },
  duele: {
    h2: 'Lo que te está costando hoy',
    cajas: [
      { t: 'El que escribe de noche', p: 'Le contestas en la mañana. Para entonces ya le escribió a dos más, y uno le respondió en el momento.' },
      { t: 'El de hace tres semanas', p: 'Pidió precio, no volviste a escribirle, y no está ni en tu cabeza ni en una lista. Está perdido.' },
      { t: 'Tú, haciendo de setter', p: 'Eres el que vende, el que publica y el que contesta. Lo que mejor haces es para lo que menos tiempo te queda.' },
    ],
  },
  // US$800-2.000/mes: docs/como-venden-otros.md §3, el blog en español de SetSmart. Los 2-3 meses y la
  // rotación del 34%, de Setterflo en el mismo documento.
  vs: {
    h2: 'Contra contratar a alguien',
    sub: 'Es la comparación honesta, porque es la decisión que estás tomando de verdad.',
    ellos: {
      que: 'Un setter', precio: 'US$800 – 2.000', pie: 'al mes',
      puntos: ['Dos o tres meses hasta que rinde', 'Contesta en su horario', 'Se va, y empiezas de nuevo', 'Hay que escucharlo y corregirlo'],
    },
    nosotros: ['Funciona el primer día', 'Contesta a las 3 de la mañana', 'No se va ni se olvida de nadie', 'Le cambias el guion tú, cuando quieras'],
  },
  control: {
    h2: 'Tú mandas',
    sub: 'No es un bot suelto contestando lo que se le ocurre.',
    cajas: [
      // Los tres ajustes por escenario: lib/nutricion-grafo-motor.ts ~1554 («Sola», «Para aprobar», «Sólo te avisa»).
      { t: 'Decides caso por caso', p: 'Cada situación tiene su ajuste: que conteste sola, que te pase el mensaje para aprobarlo antes de enviarlo, o que sólo te avise. Empiezas aprobando todo y vas soltando.' },
      // `libertadesPermitidas`: un caso con plata no se puede poner en «Sola».
      { t: 'Nunca sola con dinero', p: 'Si la conversación toca precios, descuentos o cobros, MaKo no contesta por su cuenta aunque tú quieras configurarlo así. Esa la das tú.' },
      { t: 'Habla como tú', p: 'Le cargas tu oferta, tus precios y tus objeciones, y cada conversación queda en tu bandeja. Entras cuando quieras y sigues desde donde iba.' },
    ],
  },
  faq: [
    { q: '¿Usa la API oficial de WhatsApp?', a: 'No. MaKo se conecta a tu WhatsApp como un teléfono más, y los mensajes salen con tu número de siempre. Es más barato y no necesitas la aprobación de Meta. A cambio, los envíos salen poco a poco y con horarios, para cuidar tu número: eso lo configuras tú.' },
    { q: '¿Qué pasa si contesta cualquier cosa?', a: 'Mientras te acostumbras, deja todo en «para aprobar»: redacta el mensaje y espera tu visto bueno antes de enviarlo. Vas soltando los casos en los que ves que responde bien.' },
    { q: '¿Me ata a algo?', a: 'No. Es mes a mes y lo cancelas cuando quieras.' },
    { q: '¿Y si ya uso otra cosa?', a: 'Si te funciona, quédatela. MaKo tiene sentido cuando estás contestando tú, o cuando lo que usas no habla con tu CRM y no sabes qué conversación terminó en venta.' },
    { q: '¿Mis conversaciones entrenan alguna IA?', a: 'No. Corren en tu propia cuenta del proveedor que elijas, con sus condiciones, y nosotros no las usamos para nada más.' },
  ],
  noEs: [
    'Si te llegan menos de 10 consultas al mes, el problema no es contestar: es que no te escriben. Arregla eso primero.',
    'Si no tienes una oferta clara con un precio, ningún setter —humano o no— la va a poder vender.',
    'Si quieres que alguien cierre la venta por ti, no es esto: MaKo agenda, tú cierras.',
  ],
  cierre: 'Lo que necesitas para que nadie se quede sin respuesta.',
});

LANDINGS.push({
  slug: 'paginas',
  titulo: 'Una página por cada cosa que vendes',
  para: 'Para quien vende más de una cosa',
  h1: 'Tienes cuatro ofertas<br>y <em>una sola página</em>.',
  bajada: 'Le cuentas a MaKo qué vendes y a quién, y te arma la página con su texto, su precio y su botón de compra. Una por oferta, para saber cuál vende.',
  muestra: {
    h2: 'Qué sale de ahí',
    sub: 'No es una plantilla vacía esperando que escribas: viene con el texto puesto.',
    cajas: [
      { t: 'El texto, escrito', p: 'El titular, las objeciones y el cierre salen de tu oferta y de tu manera de venderla, no de un ejemplo genérico.' },
      { t: 'El cobro, conectado', p: 'El botón lleva a tu pasarela. Quien compra entra a tu CRM con la página de la que vino.' },
      { t: 'Una por oferta', p: 'Sabes cuál página trae ventas porque cada una tiene su número, en vez de una sola que mezcla todo.' },
    ],
  },
  duele: {
    h2: 'Por qué una sola página no alcanza',
    cajas: [
      { t: 'Le hablas a todos y no convences a nadie', p: 'Una página que intenta vender el curso, la asesoría y el servicio termina sin decir nada concreto de ninguno.' },
      { t: 'No sabes qué funcionó', p: 'Si todo tu tráfico cae en el mismo lugar, el día que algo vende no puedes saber qué fue.' },
      { t: 'Cambiar una cosa te lleva la tarde', p: 'Subir un precio o probar otro titular deja de hacerse, y probar es lo único que mejora una página.' },
    ],
  },
  vs: {
    h2: 'Contra un constructor de páginas',
    sub: 'La diferencia no es el editor: es de dónde sale el contenido y a dónde van los datos.',
    ellos: {
      que: 'Un constructor suelto', precio: 'Desde US$29', pie: 'al mes, sólo la página',
      puntos: ['La página vacía, el texto lo pones tú', 'No sabe qué vendes', 'Los contactos quedan ahí, aparte', 'Cobrar es otra herramienta más'],
    },
    nosotros: ['El texto escrito desde tu oferta', 'Sabe qué vendes porque ya te conoce', 'Quien deja su dato entra a tu CRM', 'El cobro y el seguimiento, adentro'],
  },
  control: {
    h2: 'Y después de publicarla',
    cajas: [
      { t: 'La editas tú', p: 'Lo que escribió MaKo es un punto de partida. Cambias lo que quieras, cuando quieras, sin pedirle nada a nadie.' },
      { t: 'Quien llega no se pierde', p: 'El que deja su dato y no compra entra a los seguimientos automáticos en vez de quedarse en una lista muerta.' },
      { t: 'Sabes de dónde vino', p: 'Cada página arrastra su origen hasta la venta, así que la pregunta «¿esto de dónde salió?» tiene respuesta.' },
    ],
  },
  faq: [
    { q: '¿Necesito dominio propio?', a: 'No para empezar: la página queda publicada y lista para compartir. Si tienes dominio, lo conectas.' },
    { q: '¿Puedo partir de una página que ya me gusta?', a: 'Sí. Le pasas la referencia y MaKo replica la estructura con tu contenido. Lo que se replica es el armado, no las imágenes de otro.' },
    { q: '¿Y si no me gusta lo que escribió?', a: 'Le dices qué cambiar y lo reescribe, o lo editas tú a mano. No te deja encerrado en su versión.' },
    { q: '¿Me ata a algo?', a: 'No. Es mes a mes y lo cancelas cuando quieras.' },
  ],
  noEs: [
    'Si vendes una sola cosa y tu página ya convierte, no cambies nada.',
    'Si lo que buscas es un sitio institucional de diez secciones, esto está hecho para vender, no para presentar.',
    'Si todavía no tienes una oferta con precio, la página no la va a inventar por ti.',
  ],
  cierre: 'Una página por oferta, y los números de cada una.',
});

LANDINGS.push({
  slug: 'anuncios',
  titulo: 'Un media buyer que mira ventas',
  para: 'Para quien ya invierte en anuncios',
  h1: 'Tus anuncios se optimizan<br>para <em>clics que no compran</em>.',
  bajada: 'MaKo mira tus campañas todos los días y aplica las mejoras solo, sin pasarse del presupuesto que tú le pusiste. Y mide lo que te importa: llamadas agendadas y ventas, no impresiones.',
  muestra: {
    h2: 'Qué hace cada día',
    sub: 'No es un informe que tienes que leer: son cambios aplicados, con su explicación.',
    cajas: [
      // Textual del `incluye` de pro en lib/planes-mako.ts.
      { t: 'Aplica, no sugiere', p: 'MaKo aplica solo las mejoras de tus anuncios, sin pasarse de tu presupuesto. Tú pones el límite y no lo cruza.' },
      { t: 'Mira hasta la venta', p: 'Un anuncio barato que no agenda es caro. Como el CRM está adentro, se mide hasta donde termina la plata, no hasta el clic.' },
      { t: 'Te cuenta qué cambió', p: 'Cada cambio queda escrito con el porqué. Si no te gusta, lo reviertes y le dices que no lo repita.' },
    ],
  },
  duele: {
    h2: 'Lo que la plataforma no te va a decir',
    cajas: [
      { t: 'Optimiza para lo que puede ver', p: 'Meta ve el clic y el formulario. No ve si esa persona apareció a la llamada ni si pagó, así que optimiza hacia donde tú no ganas.' },
      { t: 'El anuncio se cansa', p: 'Lo que funcionó dos semanas deja de funcionar, y para entonces ya gastaste de más esperando a que repunte.' },
      { t: 'Mirarlo todos los días no se sostiene', p: 'Es lo que de verdad mueve el costo por venta, y es exactamente lo que nadie hace cuando además tiene que vender.' },
    ],
  },
  // US$79-349 y US$2.000-5.000: docs/como-venden-otros.md §3.
  vs: {
    h2: 'Contra una agencia',
    sub: 'Y contra las herramientas de optimización que no saben qué pasó después del clic.',
    ellos: {
      que: 'Una agencia de medios', precio: 'US$2.000 – 5.000', pie: 'al mes, más permanencia',
      puntos: ['Reportes semanales, cambios cuando pueden', 'Mide clics y formularios', 'Tus datos viven en su cuenta', 'Dejarla es empezar de nuevo'],
    },
    nosotros: ['Mira y aplica todos los días', 'Mide llamadas agendadas y ventas', 'Todo en tu cuenta, siempre', 'Te vas cuando quieras'],
  },
  control: {
    h2: 'Tú pones los límites',
    cajas: [
      { t: 'El presupuesto es tuyo', p: 'MaKo no puede gastar más de lo que le dijiste. No es una promesa: es el límite con el que trabaja.' },
      { t: 'Decides qué puede tocar', p: 'Puedes dejarlo aplicar solo, o que te proponga y apruebes tú. Como con todo lo demás.' },
      { t: 'La cuenta sigue siendo tuya', p: 'Es tu cuenta publicitaria, con tu historial. Si mañana te vas, te vas con todo.' },
    ],
  },
  faq: [
    { q: '¿Cuánto tengo que invertir para que tenga sentido?', a: 'Si estás gastando menos de lo que te cuesta una venta, el problema no es optimizar: es que todavía no hay datos suficientes para decidir nada.' },
    { q: '¿Va a apagar mis campañas sin avisar?', a: 'Depende de cómo lo dejes. En el modo de aprobar, te propone y tú decides; en el automático, se mueve dentro del presupuesto que fijaste y te cuenta qué hizo.' },
    { q: '¿Funciona si mis ventas se cierran por llamada?', a: 'Es justamente el caso para el que está hecho: lo que se mide es la llamada agendada y la venta, no el formulario.' },
    { q: '¿Me ata a algo?', a: 'No. Es mes a mes y lo cancelas cuando quieras.' },
  ],
  noEs: [
    'Si todavía no invertiste nunca en anuncios, empieza por tener una oferta que ya venda sin pauta.',
    'Si esperas que alguien te garantice un costo por venta, desconfía: nadie serio lo hace.',
    'Si no tienes el CRM adentro, se puede medir el clic pero no la venta, y entonces esto vale la mitad.',
  ],
  cierre: 'Tus anuncios mirados todos los días, hasta la venta.',
});

LANDINGS.push({
  slug: 'numeros',
  titulo: 'La venta que la plataforma no ve',
  para: 'Para quien no sabe qué contenido le trae clientes',
  h1: 'Sabes cuántas vistas tuviste.<br>No sabes <em>cuáles pagaron</em>.',
  bajada: 'MaKo junta lo que pasa en tus anuncios, tus páginas y tus conversaciones con lo que pasa en tu CRM, y cada mañana te dice qué movió la aguja ayer.',
  muestra: {
    h2: 'Lo que ves cada mañana',
    sub: 'Un resumen corto, no un tablero con cuarenta números que nadie mira.',
    cajas: [
      { t: 'Qué trajo clientes', p: 'Qué publicación, qué página y qué anuncio terminaron en una conversación y en una venta.' },
      { t: 'Dónde se cae la gente', p: 'En qué paso se quedan: no te escriben, no agendan, no aparecen o no compran. Cada uno se arregla distinto.' },
      { t: 'Qué hacer hoy', p: 'No sólo el número: lo que conviene hacer con él, dicho en una línea.' },
    ],
  },
  duele: {
    h2: 'Por qué los números de siempre no alcanzan',
    cajas: [
      { t: 'Cada plataforma cuenta lo suyo', p: 'Instagram te da alcance, el anuncio te da clics y el calendario te da reuniones. Nadie te dice cuál de los tres trajo la venta.' },
      { t: 'La planilla se desactualiza', p: 'La que armaste con cariño se llena a mano, y a la tercera semana ya no refleja nada.' },
      { t: 'El dato llega cuando ya no sirve', p: 'Enterarte a fin de mes de que un anuncio no servía es enterarte después de haberlo pagado.' },
    ],
  },
  control: {
    h2: 'De dónde salen esos números',
    cajas: [
      { t: 'De tus propios datos', p: 'De tus conversaciones, tus páginas y tu CRM, que ya están adentro. No hay que conectar media docena de cosas.' },
      { t: 'Sin cargar nada a mano', p: 'Lo que se mide se mide solo. Si hay que acordarse de anotarlo, no se anota.' },
      { t: 'Y si no hay dato, lo dice', p: 'Cuando algo no se puede saber todavía, lo dice. No inventa un número para llenar el espacio.' },
    ],
  },
  faq: [
    { q: '¿Necesito instalar algo en mi web?', a: 'Para las páginas hechas en MaKo, no: ya vienen medidas. Si quieres medir una web tuya de antes, se pega un código una vez.' },
    { q: '¿Y si vendo por WhatsApp y no por una página?', a: 'Es el caso normal, y por eso las conversaciones están adentro: la venta por chat se cuenta igual que la de un carrito.' },
    { q: '¿Puedo verlo en el teléfono?', a: 'Sí, y el resumen de la mañana está pensado para leerse ahí, en treinta segundos.' },
    { q: '¿Me ata a algo?', a: 'No. Es mes a mes y lo cancelas cuando quieras.' },
  ],
  noEs: [
    'Si todavía no tienes ventas, no hay nada que atribuir: consigue las primeras y vuelve.',
    'Si lo que buscas es un tablero para presentarle a un inversor, esto está hecho para decidir, no para mostrar.',
    'Si tus datos viven en cinco herramientas que no piensas mover, vas a ver la mitad del recorrido.',
  ],
  cierre: 'Saber qué funcionó, el día que funcionó.',
});

LANDINGS.push({
  slug: 'llamadas',
  titulo: 'Por qué se te cae cada venta',
  para: 'Para quien vende por llamada',
  h1: 'Hiciste veinte llamadas.<br>Cerraste tres. <em>¿Por qué?</em>',
  bajada: 'MaKo escucha tus llamadas de venta y te dice qué mejorar en cada una: dónde se perdió el interés, qué objeción no respondiste y qué hiciste distinto en las que sí cerraste.',
  muestra: {
    h2: 'Qué sale de cada llamada',
    sub: 'No un resumen de lo que ya sabes que pasó: lo que conviene hacer distinto la próxima.',
    cajas: [
      // Textual del `incluye` de pro: «Qué mejorar en cada llamada de venta, con IA».
      { t: 'Qué mejorar, concreto', p: 'En qué minuto se enfrió, qué pregunta faltó y qué objeción quedó sin responder.' },
      { t: 'Qué hacen distinto las que cierran', p: 'Cuando hay varias llamadas, lo que se repite en las que cerraron deja de ser una corazonada.' },
      { t: 'Y qué hacer después', p: 'El seguimiento de quien no compró sale de lo que de verdad dijo en la llamada, no de una plantilla.' },
    ],
  },
  duele: {
    h2: 'Lo que pasa cuando nadie escucha las llamadas',
    cajas: [
      { t: 'Cada uno se acuerda distinto', p: 'Terminada la llamada, lo que queda es tu impresión. Y la impresión siempre dice que la culpa fue del precio.' },
      { t: 'El mismo error, veinte veces', p: 'Una pregunta que no haces nunca no aparece en ningún reporte: sólo aparece en las ventas que no se cerraron.' },
      { t: 'Entrenar a alguien se vuelve imposible', p: 'Sin saber qué funciona, lo que se transmite al que entra es tu intuición, y tarda meses.' },
    ],
  },
  control: {
    h2: 'Con tus llamadas, tus reglas',
    cajas: [
      { t: 'Tú eliges qué se analiza', p: 'Se analiza lo que tú subes o conectas. Nada se escucha por su cuenta.' },
      { t: 'Corre en tu cuenta de IA', p: 'El análisis pasa por tu propia cuenta del proveedor que elegiste, con sus condiciones.' },
      { t: 'Es para ti, no para vigilar', p: 'Está hecho para mejorar el guion, no para ponerle una nota a nadie.' },
    ],
  },
  faq: [
    { q: '¿Tengo que grabar las llamadas?', a: 'Sí, y tienes que avisarle a la otra persona que estás grabando. En la mayoría de los países es obligatorio, y además es lo correcto.' },
    { q: '¿Sirve si vendo yo solo?', a: 'Es donde más se nota: no tienes a nadie que escuche tus llamadas y te diga qué hiciste distinto el día que cerraste.' },
    { q: '¿Funciona en español?', a: 'Sí, y es la razón de que exista: casi todo lo que hay está hecho para llamadas en inglés.' },
    { q: '¿Me ata a algo?', a: 'No. Es mes a mes y lo cancelas cuando quieras.' },
  ],
  noEs: [
    'Si no vendes por llamada, esto no te sirve: mira el setter o los seguimientos.',
    'Si no puedes grabar por el tipo de conversaciones que tienes, no hay nada que analizar.',
    'Si lo que buscas es controlar a tu equipo, está hecho para lo contrario.',
  ],
  cierre: 'Saber por qué se cayó, mientras todavía puedes llamar de vuelta.',
});

LANDINGS.push({
  slug: 'cursos',
  titulo: 'Cobra sin comisión',
  para: 'Para quien vende cursos o comunidad',
  h1: 'Vendiste US$10.000.<br>La plataforma <em>se quedó con una parte</em>.',
  bajada: 'En MaKo el cobro va a tu cuenta de Mercado Pago o de Stripe. Nosotros te cobramos el plan y nada más: de cada venta que haces, no nos llevamos nada.',
  muestra: {
    h2: 'Cómo funciona el cobro',
    sub: 'La diferencia está en de quién es la cuenta que recibe el dinero.',
    cajas: [
      // Verificado en lib/cobros.ts: `credDelCliente(clave, ws)` — cada negocio cobra con SU cuenta.
      { t: 'La cuenta es tuya', p: 'El cobro sale por tu propia cuenta de la pasarela, con tus datos. El dinero no pasa por nosotros en ningún momento.' },
      { t: 'Cero comisión por venta', p: 'Pagas el plan y listo. Vendas uno o vendas mil, el precio del plan es el mismo.' },
      { t: 'Y el alumno entra solo', p: 'Quien paga queda dentro del curso y dentro de tu CRM, sin que tengas que darlo de alta a mano.' },
    ],
  },
  duele: {
    h2: 'Lo que te cuesta la comisión',
    cajas: [
      { t: 'Crece justo cuando te va bien', p: 'Un porcentaje por venta es una cuenta que sube cuanto mejor vendes. Es el peor momento para estar pagándola.' },
      { t: 'No es sólo el porcentaje', p: 'Al porcentaje de la plataforma se le suma el de la pasarela. Son dos mordidas sobre el mismo pago.' },
      { t: 'Y tus alumnos no son tuyos', p: 'En varias plataformas el contacto de quien te compró vive del lado de ellos. El día que te vas, no te lo llevas.' },
    ],
  },
  // Las cifras de Hotmart y Skool: docs/como-venden-otros.md.
  vs: {
    h2: 'Contra una plataforma de cursos',
    sub: 'A igual venta, lo que cambia es cuánto de eso llega a tu cuenta.',
    ellos: {
      que: 'Plataforma con comisión', precio: 'US$99 + 2,9%', pie: 'al mes más un corte por venta (Skool); Hotmart cobra por venta',
      puntos: ['Pagas más cuanto más vendes', 'El cobro pasa por su cuenta', 'Tus alumnos viven en su sistema', 'El marketing es otra herramienta'],
    },
    nosotros: ['El plan es el mismo vendas lo que vendas', 'Cobras con tu propia cuenta', 'Tus alumnos están en tu CRM', 'Las páginas y el seguimiento, adentro'],
  },
  control: {
    h2: 'Lo que viene con el curso',
    cajas: [
      { t: 'La comunidad, al lado', p: 'El curso y el espacio donde preguntan no son dos productos distintos que hay que conectar.' },
      { t: 'El que no terminó, se recupera', p: 'Quien se quedó en la clase tres puede recibir un mensaje por eso, y no por estar en una lista genérica.' },
      { t: 'Y el que no compró también', p: 'El que vio la página y no pagó entra a los seguimientos en vez de desaparecer.' },
    ],
  },
  faq: [
    { q: '¿Qué pasarelas puedo usar?', a: 'Mercado Pago y Stripe, con tu propia cuenta. El dinero llega directo ahí.' },
    { q: '¿De verdad no se llevan nada de mis ventas?', a: 'No. Lo que pagas es el plan mensual. La pasarela sí te cobra lo suyo, como le cobra a cualquiera.' },
    { q: '¿Puedo traer un curso que ya tengo en otra plataforma?', a: 'Sí. Los videos y el material se suben, y tus alumnos actuales se importan.' },
    { q: '¿Me ata a algo?', a: 'No. Es mes a mes y lo cancelas cuando quieras.' },
  ],
  noEs: [
    'Si vendes muy poco al mes, una plataforma que sólo cobra comisión te va a salir más barata. Haz la cuenta antes.',
    'Si lo que quieres es que alguien te traiga alumnos, esto no es un mercado: el tráfico lo traes tú.',
    'Si tu curso vive en una plataforma que te funciona y no te molesta la comisión, no muevas nada.',
  ],
  cierre: 'De cada venta que hagas, no nos llevamos nada.',
});

LANDINGS.push({
  slug: 'plan',
  titulo: 'Le das el objetivo y se hace cargo',
  para: 'Para quien tiene demasiadas cosas abiertas',
  h1: 'No te falta información.<br>Te falta <em>saber qué sigue</em>.',
  bajada: 'Le dices a MaKo a dónde quieres llegar este mes y arma el plan: qué hacer, en qué orden y para cuándo. Cada mañana te dice las tres cosas de hoy.',
  muestra: {
    h2: 'Cómo se usa',
    sub: 'La idea es no abrir nada: lo que hay que hacer te llega.',
    cajas: [
      { t: 'Le dices el objetivo', p: 'En una frase, como se lo dirías a alguien. «Quiero diez clientes nuevos este mes.»' },
      { t: 'Arma el plan', p: 'Lo parte en tareas con su orden y su fecha, mirando lo que ya tienes empezado en vez de arrancar de cero.' },
      { t: 'Y te dice qué sigue', p: 'Cada mañana, las pocas cosas que de verdad mueven el objetivo. No la lista entera.' },
    ],
  },
  duele: {
    h2: 'Por qué las listas de tareas no alcanzan',
    cajas: [
      { t: 'Anotar no es decidir', p: 'Una lista de cuarenta cosas no te dice cuál importa. Y la que importa casi nunca es la más fácil.' },
      { t: 'Lo urgente se come lo importante', p: 'Lo que mueve el negocio no tiene fecha límite, y por eso siempre pierde contra lo que sí la tiene.' },
      { t: 'Y a la semana nadie la abre', p: 'La lista que hay que mantener a mano deja de mantenerse, y entonces miente.' },
    ],
  },
  control: {
    h2: 'Qué lo hace distinto de una lista',
    cajas: [
      { t: 'Sabe cómo va tu negocio', p: 'El plan sale de tus números y tus conversaciones, que ya están adentro. No le tienes que explicar el contexto cada vez.' },
      { t: 'Se reacomoda solo', p: 'Si una semana no pudiste, no te quedas con un plan vencido: se recalcula con lo que de verdad pasó.' },
      { t: 'Lo decides tú', p: 'Lo que propone es un borrador. Lo cambias, lo pospones o lo tiras, y aprende de eso.' },
    ],
  },
  faq: [
    { q: '¿Tengo que cargar mis tareas a mano?', a: 'No hace falta. Lo que hablas por WhatsApp o lo que surge de una reunión puede entrar como tarea propuesta, que tú confirmas.' },
    { q: '¿Y si mi objetivo cambia a mitad de mes?', a: 'Se lo dices y rehace el plan. Es lo normal, no la excepción.' },
    { q: '¿Me va a llenar de notificaciones?', a: 'Es un resumen al día. La gracia es que puedas no abrir nada el resto del tiempo.' },
    { q: '¿Me ata a algo?', a: 'No. Es mes a mes y lo cancelas cuando quieras.' },
  ],
  noEs: [
    'Si ya tienes un método que sigues y te funciona, no lo cambies por esto.',
    'Si lo que buscas es una herramienta de gestión para un equipo grande, esto está pensado para el que decide, no para repartir trabajo.',
    'Si no piensas contarle cómo te fue, va a planificar a ciegas y vas a tener razón en desconfiar.',
  ],
  cierre: 'Un objetivo, y las tres cosas de hoy.',
});

const dir = process.argv[2] || '.';
const hechas = generar(dir);
console.log('landings generadas (' + hechas.length + '):', hechas.join(', '));
console.log('FALTA a proposito: avatar (AI_AVATAR_SE_VENDE = false)');
