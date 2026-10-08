// =============================================================================
// Meta Platform — el registro de construcción del área
// =============================================================================
// Alcance: la app de Meta y todo lo que sale HACIA Meta. Vive en: lib/meta-capi.ts
// + lib/meta-capi-payload.ts (las conversiones server-side), lib/meta-ads.ts,
// lib/meta-write.ts, lib/meta-descubrir.ts, lib/meta-leads.ts (la ingesta por
// polling), lib/meta-templates.ts y app/api/webhooks/meta-leads/ (la ingesta en
// vivo). Los disparos viven en lib/leads.ts (updateLead) y en los dos webhooks.
//
// ⚠️ ESTA BITÁCORA NACIÓ EL 5/10/2026, con el área ya a medio construir. Lo
// anterior está en docs/hallazgos-ads.md, que es largo y está ordenado por
// corrida; acá entra sólo lo que tiene un pedido textual de Martín detrás.
//
// NO es un changelog. Lo que git ya guarda no se repite: va el motivo, la trampa
// y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'Las conversiones server-side', detalle: 'lib/meta-capi.ts manda Lead, SubmitApplication, QualifiedLead y Schedule con identidad hasheada · nunca rompe el flujo del negocio', estado: 'hecha' },
  { titulo: 'El embudo con DOS etapas distinguibles', detalle: 'Lead sale del webhook de formularios (el lead crudo) y la calificación del CRM · antes las dos viajaban con el mismo nombre', estado: 'hecha' },
  { titulo: 'El lead_id de Meta en el payload', detalle: 'user_data.lead_id sin hashear, validado por forma (15-17 dígitos) · es lo único que mueve la Cobertura de leads', estado: 'hecha' },
  { titulo: 'Lo que Meta rechaza se ve', detalle: 'El 200 con el error adentro se lee y la línea va al historial del lead · antes alcanzaba con res.ok y la función devolvía void', estado: 'hecha' },
  { titulo: 'La conversión personalizada declarada por API', detalle: 'POST /act_{cuenta}/customconversions sobre QualifiedLead, listando antes porque el edge no tiene update ni delete · hoy no existe en ninguna parte del repo', estado: 'cola' },
  { titulo: 'El dataset de CRM', detalle: 'Es el destino obligatorio de «Clientes potenciales de conversión» y NO tiene endpoint: se crea a mano en Events Manager · lo decide Martín, porque es lo único que hay que pedirle al cliente', estado: 'cola' },
  { titulo: 'Idempotencia que dure meses', detalle: 'Hoy la dedup es el event_id de Meta, con la ventana de Meta · una garantía nuestra necesita una columna y no existe', estado: 'cola' },
  { titulo: 'Pausar, presupuestar, renombrar y borrar por workspace', detalle: 'lib/meta-write.ts con credWs(ws) y el rename propagado en el mismo ws · antes envCred = la cuenta del ws1 para todos, y la ruta y el doer cerrados al ws1', estado: 'hecha' },
  { titulo: 'Conectar con Meta en un clic (la app propia MaKo)', detalle: 'Facebook Login for Business con la app 2586146911825340 · escrito el 7/10; falta que Martín cargue MAKO_META_APP_SECRET y, después del App Review, abrirlo a todos con META_OAUTH_ABIERTO', estado: 'sigue' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '5 oct', hora: '04:11', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que MaKo le mande a Meta lo que le falta, sin pedirle nada al cliente',
    pedido: 'Y si los usuarios configurar y ponen su Meta Token, no puede MaKo automatizar todo y justamente mandarle los datos de los leads cualificados independientemente del funnel?\n\nSi, calificado significa lo mismo sin reunión, porque puedo hacer un filtro por WhatsApp y marcarlo como calificado.\n\nPrefiero no pedirle nada, pero sería bueno ver si lo podemos automatizar dentro de MaKo, de lo contrario, si no queda otra opción, si se lo pedimos',
    puntos: [
      'Las tres frases cierran una cosa cada una: que la señal viaje **independientemente del funnel**, que **calificado significa lo mismo sin reunión** (un filtro por WhatsApp alcanza) y que **no se le pide nada al cliente** salvo que no quede otra.',
      'La primera ya estaba resuelta ese mismo día por otro lado: `calificado` dejó de exigir una reunión (`lib/calificado-reunion.ts`), así que el dato se guarda en cualquier embudo. Lo que faltaba era que lo que se guarda LLEGUE bien.',
      '⚠️ La tercera es la que define el alcance, y es la que obligó a medir del lado de Meta antes de escribir código: «se automatiza» y «hay que pedírselo» son dos listas distintas, y el día anterior se habían confundido.',
    ],
  },
  {
    fecha: '5 oct', hora: '04:11', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Declarar el evento propio SÍ es una llamada de API — el bloqueante del día anterior no existía',
    puntos: [
      'El día anterior se cerró con «`QualifiedLead` no es estándar, así que hay que declararlo del lado de Meta» y de ahí se saltó a «hay que pedírselo al cliente». **La primera mitad es cierta; la segunda era el diagnóstico equivocado**: declararlo es `POST /act_{cuenta}/customconversions`, con el token que ya guardamos. Dos límites duros medidos: el edge **no tiene update ni delete** (hay que listar antes de crear) y hay un **tope de 100 por cuenta publicitaria**.',
      '**Hay una salida que no necesita declarar nada:** `SubmitApplication` es un evento ESTÁNDAR y significa exactamente «este lead califica». Es elegible como objetivo de un conjunto de anuncios hoy. Se mandan los dos —el estándar para que Meta optimice, el propio para medirlo con su nombre— y es seguro porque el dedup de Meta es por el par (`event_name`, `event_id`).',
      'Los 8 eventos priorizados del AEM **son sólo pantalla y no hacen falta**: `aem_conversion_configs` es de sólo lectura, está scopeado a un app id móvil, y el AEM sólo toca la atribución del tráfico web de iOS — nuestros eventos salen del servidor con `system_generated` y no pasan por ahí. Pedirlo es fricción que no compra nada.',
      '⚠️ **Lo único que sí hay que pedir, y es UNA cosa:** el **dataset de CRM** (Events Manager → Conectar orígenes → CRM) es el destino obligatorio de «Clientes potenciales de conversión» y no tiene endpoint. Pero los arreglos del payload funcionan sin él, así que la recomendación es hacerlos primero y pedir el dataset recién cuando el cliente quiera el paso siguiente.',
      '**El bar de Meta, que es lo que decide si vale la pena:** 200 leads/mes por cuenta publicitaria, cobertura de leads ≥60%, la etapa a optimizar dentro de 28 días con tasa entre 1% y 40%, y **sólo cuentan los formularios instantáneos nativos de FB/IG** — los leads de la landing y del VSL no entran. Sin medir: si algún workspace llega a esos 200 (hay 1.041 `meta_lead_id` acumulados, sin ventana ni corte por cliente). De esa consulta depende si el dataset se pide o no se pide nunca.',
      'Sin medir tampoco: si `POST /{business_id}/adspixels` puede parir un dataset de tipo CRM. Ningún doc lo dice ni a favor ni en contra, y si funciona **el único pedido desaparece**. Es la pregunta de mayor rendimiento que quedó abierta.',
    ],
    archivos: ['docs/hallazgos-ads.md — las mediciones con su fuente, endpoint por endpoint'],
  },
  {
    fecha: '5 oct', hora: '04:11', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Las dos etapas, el lead_id, la hora del hecho y el rechazo que ahora se ve',
    puntos: [
      '**`calificado` disparaba `Lead`, que es el evento del lead CRUDO.** Las dos etapas que Meta necesita para armar el embudo viajaban con el mismo nombre, así que no se podían distinguir. `Lead` se mudó al único lugar que sabe cuándo ENTRA un lead de Meta: el webhook de formularios. La calificación manda `SubmitApplication` + `QualifiedLead`.',
      '**El `asistió a la R1` + calificado dejó de mandar nada a Meta.** Era un PROXY de «califica» de cuando calificar exigía una reunión; desde que se marca en cualquier embudo es la MISMA etapa, y un segundo evento con el mismo nombre la contaba dos veces. La asistencia sigue moviendo la etapa del CRM, que es razón suficiente para seguir preguntándola al mover.',
      '⚠️ **El filtro del `lead_id` es lo que más cerca estuvo de salir mal.** La validación obvia —«si el campo no está vacío, mandalo»— habría empeorado las cosas: la doc de Meta dice que ante un `lead_id` inválido **rechaza el evento entero**, y en esta base hay un centinela que parece un id (`meta_lead_id = \'0\'` en los leads cargados a mano de un negocio que prospecta en frío, ver lib/audios-paso.ts). Se valida la FORMA: 15-17 dígitos.',
      '**`res.ok` no era «salió bien» y además no había dónde contestar:** la función devolvía `void`, así que un evento RECHAZADO por Meta (200 con `body.error`) se veía igual que uno que entró. Ahora devuelve un resultado y los tres call sites escriben la línea en el **historial del lead**, que es donde el dueño mira — el log de Vercel no lo lee nadie y a los 60 minutos no existe. Y un 200 que no confirma ningún evento tampoco se da por bueno.',
      '**`event_time` era `Date.now()`.** Para una calificación interactiva eso es correcto; donde mentía es en el webhook, que puede llegar tarde. Y la ventana de CAPI es de 7 días, así que un hecho más viejo **no tiene hora buena**: o se recorta o Meta lo rechaza y la conversión se pierde. Se recorta al borde y el recorte se DECLARA (`custom_data.hecho_en` lleva el instante real, y queda el warn).',
      '**La duplicación medida: el disparo compara el valor viejo contra el nuevo**, así que marcar → desmarcar → marcar mandaba DOS. La cura es un `event_id` derivado del lead (`calif:<id>`), que llega igual las dos veces y Meta descarta el segundo. ⚠️ La ventana de dedup es de META, no nuestra: cubre el rebote de minutos u horas, que es el caso real, y una garantía que tenga que valer meses necesita una columna que hoy no existe.',
      '⚠️ **Lo que NO se tocó, a propósito:** el camino de POLLING (`lib/meta-leads.ts`) no manda CAPI. Hace una pasada de 90 días, así que mandaría `Lead` por leads que caen fuera de la ventana. Y el payload sigue yendo al **píxel del sitio** y no a un dataset de CRM: hasta que exista un dataset, ese payload es justo lo que la doc dice que no se haga, y el orden correcto es primero el píxel actual y el camino de CRM como segunda ruta.',
    ],
    archivos: [
      'lib/meta-capi-payload.ts — las cuatro decisiones puras, sin server-only para que tengan test',
      'lib/meta-capi.ts — el cliente HTTP: devuelve resultado y lee el cuerpo del 200',
      'lib/leads.ts — updateLead: la calificación con los dos nombres y un solo event_id',
      'app/api/webhooks/meta-leads/route.ts — el Lead crudo, con la hora real del formulario',
      'app/api/webhooks/calendly/route.ts — Schedule, ahora con lead_id y con el rechazo visible',
      'tests/meta-capi-lead-id.test.ts — 8 tests, los 8 probados rompiéndolos',
    ],
  },
  {
    fecha: '7 oct', hora: '15:47', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Terminar las dos: escribir en Meta por cliente, y el botón de conectar',
    pedido: 'Si, termina ambas. Te consulto, cuando la app esté, significa que los usuarios ya no tendrán que poner su token de Meta?',
    puntos: [
      '«Ambas» eran las dos piezas que quedaban para que la app propia sirva: que pausar, presupuestar, renombrar y borrar salgan con la cuenta de CADA cliente (hasta ese día cerradas al ws1), y el botón «Conectar con Meta» con la sección de Meta en la política de privacidad.',
      'La pregunta se contestó en el chat: sí, el cliente deja de pegar el token — pero hasta el App Review el botón sólo funciona para quien tenga un rol en la app, y los tres clientes que hoy usan una app ajena reconectan UNA vez.',
    ],
  },
  {
    fecha: '7 oct', hora: '15:47', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Las escrituras a Meta salen con la cuenta de cada cliente',
    puntos: [
      '**No era un candado: eran tres** —el 403 de `/api/meta-write`, `soloWs1` en las ocho operaciones del doer y un `OWNER_WS` en cada runner— y abajo un `envCred` que los hacía correctos. Abrirlos sin cambiar el token era el peor estado posible: un cliente pausando «su» campaña con el token del ws1. Salieron en el mismo cambio.',
      'El `ws` tenía que llegar a **cuatro** lugares y dos no se ven leyendo la ruta: el rename que se propaga a leads y métricas (corría clavado al ws1) y el estado vivo que decide un borrado (un cuarto `envCred`, escondido en un helper del área).',
      '⚠️ **`soloWs1` traía de regalo el rol admin** (`gatingOk` lo lee como «ws principal Y admin»). Reemplazarlo por un gating sin `rolMinimo` le dejaba a un closer borrar campañas por WhatsApp. Va `G_META_ADMIN`, el mismo de las otras escrituras.',
      'Nueve roturas a propósito sobre los tests nuevos, una por pieza: las nueve dan 1 fallo.',
    ],
    archivos: [
      'lib/meta-write.ts — metaWrite(body, ws): token y rename del mismo ws',
      'app/api/meta-write/route.ts — wsDeAdsManager(), el guard de /api/ads-manager',
      'lib/api-mako/areas/ads.def.ts — G_META_ADMIN en vez de soloWs1',
      'lib/api-mako/areas/ads.run.ts · ads.helpers.ts · lib/mako-doer-acciones.ts — sin OWNER_WS, con ctx.ws',
      'tests/ads-manager-credenciales.test.ts — 5 tests nuevos, probados rompiéndolos',
      'docs/hallazgos-ads.md — «Pausar, represupuestar, renombrar y borrar…»',
    ],
  },
  {
    fecha: '7 oct', hora: '16:05', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El botón «Conectar con Meta» y la sección de Meta en la política de privacidad',
    puntos: [
      'Facebook Login for Business con la app MaKo: el diálogo devuelve un token de **usuario del sistema** que no vence, y el callback guarda por el MISMO camino que pegar un token (`lib/meta-conexion.ts`). El workspace viaja en cookie, como en Google Calendar.',
      '⚠️ **El secreto de la app nueva no puede llamarse `META_APP_SECRET`**: ése es el de la app vieja y firma cada lead del webhook. Va en `MAKO_META_APP_SECRET`, con un test que lo fija.',
      '⚠️ **Reconectar con VARIAS páginas dejaba el token de página viejo**: la regla de los dos tokens sólo se cumplía con UNA página. Ahora se re-deriva el de la página ya elegida.',
      'Hasta el App Review, Meta sólo deja entrar a quien tenga rol en la app: el botón lo ve sólo el super admin, y se abre a todos con `META_OAUTH_ABIERTO=true` sin deploy.',
      'Sin probar en un navegador: el botón sólo aparece con el secreto cargado, y lo carga Martín.',
    ],
    archivos: [
      'lib/meta-login.ts — app id, config id, redirect y a dónde se vuelve (sin server-only, con test)',
      'lib/meta-conexion.ts — lo que se guarda al conectar, para las dos puertas',
      'app/api/integraciones/meta/route.ts · callback/route.ts — el OAuth',
      'app/integraciones/ServicioConfigForm.tsx — el botón y el resultado',
      'app/privacidad/page.tsx — la sección #meta, permiso por permiso',
      'tests/meta-login.test.ts — 10 tests, probados rompiéndolos',
    ],
  },
  {
    fecha: '7 oct', hora: '22:53', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Terminar el portafolio de MaKo y desvincular la página ajena',
    pedido: 'Mientras se aprueba Meta... Termina de configurar todo el portfolio de MaKo, ponle el branding y no se si haga falta configurar otras cosas...\nY también elimina la pagina de LGBT Posadas y desvincula completamente de eso, no quiero que tenga nada que ver.',
    puntos: [
      'Hecho en el navegador de Martín: logo del portafolio, hola-mako.com verificado como dominio (registro TXT por la API de Porkbun), la app MaKo publicada (modo producción, que NO es el App Review) y la página «Hola MaKo» creada con la marca y puesta como principal.',
      '⚠️ La página ajena no se podía sacar del portafolio: Meta exige antes una persona con control total por su cuenta de Facebook, y asignar permisos lo frena el clasificador de Claude. Martín se asignó el control y la dio de baja él.',
    ],
  },
  {
    fecha: '8 oct', hora: '00:58', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La cuenta publicitaria para vender MaKo, y en qué moneda conviene',
    pedido: '1. Configura todo la cuenta publicitaria, allí comenzaré a hacer ads para vender MaKo. Haz todo lo necesario, configura también el perfil de facebook que le va a salir a los usuarios como el que está corriendo la publicidad. Con respecto a la moneda, investiga que me conviene más estando en Argentina... Yo se que hay maneras de eludir los terribles impuestos que te pone Argentina, por ejemplo, tenía entendido que con mi cuenta de ARQ (DolarApp), si tengo USD y tarjeta global, me evito algunos impuestos... Pero te pido que investigues la mejor manera para que me salga más económico y que configures todo ese tema de divisas teninedo en cuenta eso. Y claro, crea todo el resto necesario para comenzar a publicitar MaKo.\n2. Por ahora nadie más como admin, solo yo.\n3. El Doble Factor lo hacemos a lo último, cuando ya esté todo, antes de correr anuncios, es decir, por ahora en esta tanda y en las que vienen lo posponemos.',
    puntos: [
      'Dos decisiones que quedan: Martín es el único admin del portafolio, y el doble factor se deja para el final, antes de correr anuncios.',
    ],
  },
  {
    fecha: '8 oct', hora: '01:12', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Cuenta publicitaria, conjunto de datos y el píxel en la landing de MaKo',
    puntos: [
      'Creados en el portafolio MaKo: la cuenta publicitaria «MaKo» (act_1426493815659364, USD, zona horaria de Buenos Aires) y el conjunto de datos «MaKo» (1869323014511830), conectado a la cuenta. La identidad de los anuncios es la página «Hola MaKo».',
      'La landing (raíz de hola-mako.com) manda PageView al cargar y Schedule cuando Calendly avisa que se agendó; sólo en hola-mako.com, para que un preview no ensucie las audiencias.',
      'Verificado en producción con un Chrome limpio y la llamada a Meta abortada antes de salir. ⚠️ Desde un Chrome headless Meta no manda nada, y en el Chrome de Martín una extensión define `fbq` antes que nosotros: las dos cosas se leen como «el píxel no dispara».',
      'Falta y lo hace Martín: asignarse en la cuenta publicitaria, cargar la tarjeta y la facturación, y el doble factor al final.',
    ],
    commits: [
      { sha: 'af9030c7', msg: 'Landing de MaKo: el píxel de Meta para pautar MaKo (visita y agenda)', lineas: 212, archivos: 6 },
    ],
    archivos: [
      'lib/meta-pixel-mako.ts — el ID, dónde se mide y qué mensaje cuenta como agenda',
      'app/vsl/Landing.tsx — el código base del píxel, escrito en TS',
      'app/privacidad/page.tsx — la página pública sí lleva el píxel',
      'docs/hallazgos-landing.md — «El píxel de Meta de MaKo en su propia landing»',
    ],
  },
  {
    fecha: '8 oct', hora: '01:30', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'La cuenta va en USD: el 30% sólo se percibe sobre lo que se paga en pesos',
    puntos: [
      'Recomendado: cuenta en USD y tarjeta de un banco argentino a nombre de Martín, con el resumen pagado en dólares propios. Son unos USD 121 por cada 100 de pauta (el 21% de IVA lo percibe el banco). Un débito automático en pesos se lleva el 30%.',
      '⚠️ **«ARQ Global sin impuestos» es IVA que nadie percibe, no IVA que no se deba**: quien contrata lo paga por VEP antes de fin de mes, y no pagarlo es omisión. Hoy además ARQ vende el dólar un 4,4% arriba del oficial. Queda como plan B, sólo pagando el VEP.',
      'La moneda se eligió ANTES de crear la cuenta porque cambiarla después es crear otra cuenta publicitaria. Lo que va al contador quedó escrito en el hallazgo.',
    ],
    archivos: [
      'docs/hallazgos-ads.md — «Pautar MaKo desde Argentina: la moneda de la cuenta y cómo se paga»',
    ],
  },
  {
    fecha: '8 oct', hora: '01:56', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Meta rechazó la verificación del negocio',
    pedido: 'Mira lo que pasó, solucionalo...',
    puntos: [
      'Con una captura del Centro de seguridad: «No podemos verificar que el sitio web empresarial está asociado con la empresa Tejado Gonzalvez Leandro Martin porque la razón social de la empresa debe aparecer en el sitio web.»',
    ],
  },
  {
    fecha: '8 oct', hora: '02:05', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La razón social aparece en hola-mako.com, en el HTML que sirve el server',
    puntos: [
      'El sitio decía «MaKo» en todos lados y el nombre legal en ninguno. Ahora va en el pie de la landing y como responsable en /privacidad y /terminos, desde una sola constante, escrita como en la verificación (apellido primero).',
      '⚠️ El pie de la landing se renderiza en el server: lo que esa página agrega en el efecto no lo ve un verificador que no ejecuta JavaScript. El test renderiza sin correr efectos, y se probó rompiéndolo (1 fallo por pieza).',
      'Después del deploy, falta volver a mandar la verificación desde el Centro de seguridad.',
    ],
    archivos: [
      'lib/titular-mako.ts — la razón social, exacta',
      'app/vsl/Landing.tsx — PieLegal la muestra',
      'app/privacidad/page.tsx · app/terminos/page.tsx — el responsable',
      'tests/razon-social-sitio.test.ts — 4 tests',
      'docs/hallazgos-ads.md — «La verificación del negocio de MaKo: lo que Meta rechaza no es el documento»',
    ],
  },
  {
    fecha: '8 oct', hora: '02:41', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Meta la rechazó otra vez por lo mismo',
    pedido: 'Otra vez lo mismo... Asegurate de hacerlo bien',
    puntos: [
      'Con la misma captura: «la razón social de la empresa debe aparecer en el sitio web», sobre el reenvío confirmado por «Verificación del dominio», con el nombre ya publicado en el sitio.',
    ],
  },
  {
    fecha: '8 oct', hora: '02:57', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La vista previa de hola-mako.com, en esta misma sesión',
    pedido: 'Haz esta tarea aquí: “Cambiar la vista previa de hola-mako.com”',
    puntos: [
      'La tarea salió de mirar la portada en el Depurador de Meta: la tarjeta decía «Material compartido».',
    ],
  },
  {
    fecha: '8 oct', hora: '03:05', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'El nombre estaba en el HTML, pero oculto: sin JavaScript la portada se leía vacía',
    puntos: [
      'Cuatro ángulos con un refutador cada uno (documentación de Meta, reportes, el crawler, el documento). Meta no publica dónde busca el nombre; lo que decidió fue MEDIR: con Chromium sin JavaScript, la portada tenía 0 caracteres visibles.',
      '⚠️ El Suspense del layout raíz hace que React esconda en un `<div hidden>` todo bloque de más de 12.800 bytes hasta que corre JavaScript. La copia vieja de Meta y el «está en el HTML» eran ciertos y no eran la causa.',
      'Meta visita el sitio 11-20 minutos después de cada envío (Chrome desde su red con un `fbclid`, y después facebookexternalhit): en el log se ve qué versión evaluó.',
    ],
    archivos: [
      'docs/hallazgos-landing.md — «La portada viajaba VACÍA para quien no ejecuta JavaScript»',
    ],
  },
  {
    fecha: '8 oct', hora: '03:25', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'La portada se lee sin JavaScript, con su propia vista previa y su robots.txt',
    puntos: [
      'La landing va en su propio Suspense con un fallback visible (marca, título, razón social y enlaces legales): sin JavaScript se lee eso, con JavaScript la landing. El test renderiza en streaming dentro de <html><body>, que es lo único que reproduce producción.',
      'La razón social también va en datos estructurados (`legalName`) al principio de la página, y /robots.txt existe y es público (antes redirigía al login).',
      'La vista previa de la portada es suya (/og-landing.jpg) y ya no dice «Material compartido».',
      'Pendiente: /privacidad sigue llegando vacía sin JavaScript; el arreglo de fondo toca el layout de toda la app.',
    ],
    archivos: [
      'app/page.tsx — el Suspense propio, el JSON-LD y la vista previa',
      'app/vsl/PortadaSinJs.tsx — lo que se ve sin JavaScript',
      'app/robots.ts · lib/rutas-publicas.ts — robots.txt público',
      'public/og-landing.jpg — la tarjeta de la portada',
      'tests/razon-social-sitio.test.ts · tests/portada-vista-previa.test.ts',
      'AGENTS.md — «Una página pública de más de ~12 KB llega VACÍA a quien no ejecuta JavaScript»',
    ],
  },
  {
    fecha: '8 oct', hora: '03:31', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El reenvío, de punta a punta',
    pedido: 'Haz todo el proceso tu, como siempre...',
    puntos: [
      'Martín sólo resolvió el captcha; el resto del asistente lo recorrió Claude en su Chrome.',
    ],
  },
  {
    fecha: '8 oct', hora: '04:00', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Verificación del negocio APROBADA al tercer envío',
    puntos: [
      'Enviada a las 03:35 por «Verificación del dominio», con la misma constancia y los mismos datos. Meta leyó el sitio a las 03:45 y 03:46 y esta vez encontró la razón social visible sin JavaScript.',
      'Lo único distinto respecto del segundo rechazo era el sitio: lo que la destrabó fue sacar el nombre del bloque que React dejaba oculto.',
    ],
    archivos: [
      'docs/hallazgos-ads.md — «La verificación del negocio de MaKo…»',
    ],
  },
  {
    fecha: '8 oct', hora: '04:35', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Probar «Conectar con Meta» en la cuenta de Admin, con todas las integraciones',
    pedido: 'Si, a la cuenta de Admin... En su momento habiamos quitado muchas conexiones, vuelvelas a poner todo, y de paso ya puedes ver si se conecta realmente todo.',
    puntos: [
      'La tarjeta de Meta no aparecía en el workspace del súper admin: su capa estaba armada «sin ads, sin CRM, sin VSL» y escondía Publicidad, Mensajería y las de agenda. Probar el botón adentro de un cliente le pisaría su conexión.',
    ],
  },
  {
    fecha: '8 oct', hora: '04:45', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El súper admin vuelve a ver todas las integraciones',
    puntos: [
      'La capa SuperAdmin pasa a `categoriasIntegraciones: null` y sin ocultas: Meta, Calendly, Google y YouTube vuelven a aparecer en su /integraciones. Las tabs no cambian.',
      'Un test lee la capa de verdad (no una lista copiada) y exige que el súper admin vea Meta y las que antes escondía. Rompiéndolo con la lista vieja: 1 fallo.',
    ],
    archivos: [
      'lib/capas.ts — la capa superadmin, con el porqué',
      'tests/integraciones-visibles.test.ts — el test nuevo',
    ],
  },
  {
    fecha: '8 oct', hora: '05:15', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: '«Conectar con Meta» probado de verdad: entran la página y los leads, los anuncios no',
    puntos: [
      'El primer intento rebotaba con «el dominio no está incluido»: la lista de URI de redireccionamiento estaba vacía (el guardado del 07/10 no persistió; el campo pide Enter y Guardar). Se cargó y se verificó con el Validador de URI.',
      'Reconectado eligiendo a mano la página, el píxel y la cuenta publicitaria MaKo: el token trae los permisos de página y leads, y faltan ads_management, ads_read y business_management aunque el consentimiento los muestra.',
      'Descartado: el rol (los permisos que sí entran también son de acceso estándar) y la cuenta elegida. Más probable, sin medir: el acceso limitado de la API de marketing y la verificación de acceso en revisión.',
    ],
    archivos: [
      'docs/hallazgos-ads.md — «La primera prueba real (08/10)…»',
    ],
  },
];
