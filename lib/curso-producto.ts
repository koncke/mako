// =============================================================================
// curso-producto — "Buenas prácticas para construir una App" (área 'producto')
// =============================================================================
// Conocimiento del SUPER-ADMIN sobre cómo se construye ESTE dashboard: reglas de
// diseño, metodología de onboarding, decisiones de arquitectura y los errores que
// ya pagamos. Vive en area='producto', que está FUERA del RAG general — nunca
// contamina lo que MaKo le responde a un dueño de negocio sobre su marketing.
//
// Se siembra con scripts/seed-curso-producto.mjs (idempotente por curso).

export const CURSO_PRODUCTO = 'Buenas prácticas para construir una App';

export type LeccionProducto = { titulo: string; categoria: string; cuerpo: string };

export const CURSO_PRODUCTO_LECCIONES: LeccionProducto[] = [
  {
    titulo: 'Toda tab tiene onboarding: Conectar → Contexto → Ensayo',
    categoria: 'Onboarding',
    cuerpo: `Ninguna tab sirve sin configuración previa, así que ninguna se entrega cruda. Toda tab lleva su onboarding y un estado (hecho / no hecho) que además alimenta a la IA: si detecta algo a optimizar en una tab sin configurar, lo primero que dice es eso, en vez de proponer optimizar el vacío.

Las tres etapas son SIEMPRE las mismas; lo que cambia es el contenido:

1) CONECTAR — la plomería, con PRUEBA DE VIDA. Guardar la credencial no es estar conectado: el paso cierra cuando llegó algo de verdad (un código al teléfono, un email a la bandeja, datos reales de su cuenta). Un tilde verde sin evidencia es una mentira que explota después.

2) CONTEXTO — lo que la IA necesita saber. Nunca se le pide al usuario que redacte: se le pide un ARTEFACTO que ya existe (capturas de sus chats, conectar el canal donde ya atiende, un PDF, un audio, un link) y la IA extrae de ahí. Y lo que la app ya sabe NO se pregunta: se muestra como "esto ya lo tengo de ti".

3) ENSAYO — la IA propone y el usuario valida JUGANDO. La IA hace de CLIENTE y plantea escenarios reales; el usuario responde como respondería de verdad, y de ese ida y vuelta salen los mensajes, las preguntas y las reglas. El usuario nunca escribe la configuración final: la descubre respondiendo. El ensayo es además la prueba de que la tab quedó lista.

El síntoma de que falta onboarding: una tab llena de funcionalidad que nadie usa porque nadie supo cómo dejarla lista.`,
  },
  {
    titulo: 'Baja fricción: nunca un campo libre en un formulario',
    categoria: 'Diseño de producto',
    cuerpo: `Si el candidato obvio para pedir un dato es un textarea, el paso está mal diseñado. El usuario no quiere escribir: quiere que el producto funcione.

Alternativas, en orden de preferencia:
- FORCED-CHOICE sobre autodescripción. La gente se describe mal a sí misma pero se reconoce al instante. En vez de "¿cuál es tu tono?", muéstrale tres frases concretas y que elija la suya; el dato real viaja OCULTO en la opción elegida.
- LA IA PROPONE, EL USUARIO CORRIGE. Nunca una hoja en blanco: todo llega pre-llenado y se edita inline.
- LAS OPCIONES SE PERSONALIZAN AL NEGOCIO antes de mostrarlas (con su oferta, su avatar, su dolor). Si la IA falla, cae a la versión genérica: el paso nunca se traba.
- LA PREGUNTA PUEDE SER "SUBE UNA FOTO". Si el dato ya existe en algún lado, se pide el archivo y la IA lo lee. Si el usuario ya declinó una vez, no se le vuelve a pedir.
- UNA PREGUNTA POR PANTALLA, y la siguiente la decide la IA mirando el historial; corta sola cuando ya sabe suficiente.
- CONTEXTO QUE NO SE PIDE: lo que se pueda levantar solo (métricas, historial, transcripciones) se levanta en background mientras el usuario avanza.

Y después de recibir algo, PRUEBA VISIBLE DE QUE LO LEYÓ: dos o tres frases de "esto entendí". Sin eso, el usuario no confía en lo que sigue.`,
  },
  {
    titulo: 'Empezar por el Norte antes de escribir código',
    categoria: 'Método',
    cuerpo: `Antes de construir cualquier feature, definir en una frase cuál es el diferencial: qué hace esto que no hace "otro editor de X". Si no se puede decir en una frase, todavía no se entendió el problema.

Ejemplo real: la tab de setting no era "otro editor de mensajes"; era "cada secuencia se convierte en una SECUENCIA DE MENSAJES con estrategia (a quién, con qué objetivo, con qué gancho, con qué preguntas), que se prueba en vivo antes de prender y que después rinde cuentas con números". Ese Norte decidió el modelo de datos, la UI y qué quedaba afuera.

El proceso que funciona: explorar el código que ya existe → preguntar de a UNA cosa las decisiones que cambian el resultado → proponer 2-3 enfoques con recomendación → escribir la spec → recién ahí el plan y el código. Saltarse esto produce features que técnicamente andan y que nadie usa.`,
  },
  {
    titulo: 'Copiar el código que ya existe, no inventar diseños nuevos',
    categoria: 'Método',
    cuerpo: `Cuando el producto ya resolvió algo bien en otra pantalla, la instrucción es replicarlo, no reinterpretarlo. Un diseño "parecido pero distinto" es peor que uno idéntico: rompe el hábito del usuario y duplica el mantenimiento.

En la práctica: antes de escribir una pantalla nueva, buscar la que más se le parece y leerla entera. Reusar el componente compartido aunque cueste un poco más de plomería (el chat, el shell del wizard, el panel lateral, el sistema de gráficos). Si hay que elegir entre un componente propio "más prolijo" y el compartido que ya usa el resto de la app, gana el compartido.

Señal de alarma: estar escribiendo desde cero algo que en otra parte de la app ya se ve bien.`,
  },
  {
    titulo: 'Fail-closed: ante la duda, no enviar',
    categoria: 'Seguridad operativa',
    cuerpo: `Todo lo que sale hacia afuera (mensajes, emails, escrituras a plataformas de terceros) se diseña para FALLAR CERRADO: si no se puede verificar que está bien, no sale.

Casos reales:
- Un paso con nota de voz cuyo audio no se puede bajar FALLA; no degrada a texto. Mandar un mensaje que nadie escribió es peor que no mandar nada.
- Un mensaje cuyo copy todavía tiene texto de relleno del template NO sale automático: espera a que alguien lo escriba y lo apruebe.
- Una plantilla que la plataforma todavía no aprobó no se manda, aunque el canal la acepte: quedaría contada como enviada sin llegar nunca.
- Si no se puede consultar el estado de aprobación (error de base), tampoco se manda: se reintenta más tarde.
- Sin credencial configurada, el receptor de webhooks rechaza todo en vez de asumir un dueño por defecto.

El costo de un falso negativo (un mensaje que sale tarde) es siempre menor que el de un falso positivo (un mensaje equivocado a un cliente real).`,
  },
  {
    titulo: 'Lo irreversible se confirma, no se automatiza',
    categoria: 'Seguridad operativa',
    cuerpo: `La IA puede decidir, preparar y proponer; ejecutar lo irreversible es del humano.

Regla práctica: si deshacer la acción requiere hablar con otra persona o no se puede deshacer, la IA deja el trabajo listo y avisa, pero no aprieta el botón.

Ejemplo real: cuando el sistema detecta que un lead no califica, marca el CRM y avisa recomendando cancelar la reunión — pero NO cancela la reunión. Cancelar toca el calendario de otra persona y no tiene vuelta atrás.

El mismo criterio aplica a: publicar, enviar en lote, borrar, cobrar, y cualquier escritura a una plataforma externa que el usuario no pueda revertir desde nuestra app.

El patrón que lo hace usable: la IA deja un BORRADOR aprobable con un clic. El humano no tiene que escribir nada, solo decidir.`,
  },
  {
    titulo: 'Los cambios de semántica se hacen antes del go-live',
    categoria: 'Arquitectura',
    cuerpo: `Hay decisiones que son gratis mientras no hay datos y carísimas después. Detectarlas y resolverlas ANTES de que el motor corra en producción.

Caso real: el motor marcaba un paso como "omitido" y AVANZABA cuando el canal estaba apagado. Con las tablas vacías eso era un cambio de diez líneas; con seis meses de datos hubiera sido una migración con leads a medio recorrer. Se cambió a tiempo: ahora el paso ESPERA y la cadencia retoma cuando se prende el canal.

Preguntas para hacerse antes de prender algo por primera vez:
- ¿Qué pasa si el usuario prende esto tarde? ¿Se perdió algo irrecuperable?
- ¿Hay un índice único que impide reintentar? (una inscripción "una vez en la vida" es una decisión, no un detalle)
- ¿Este estado intermedio se puede distinguir después? (dos causas distintas que guardan la misma marca son imposibles de auditar)

Si las tablas están vacías, ese es EL momento de arreglarlo.`,
  },
  {
    titulo: 'Multi-inquilino: la frontera es la app, no la base',
    categoria: 'Arquitectura',
    cuerpo: `Cuando el backend usa una credencial que bypassea las políticas de la base, el aislamiento entre clientes lo garantiza el código y nada más. Eso obliga a disciplina:

- Toda lectura/escritura de datos por-cliente pasa por el cliente que auto-scopea por workspace. Nunca el cliente crudo.
- Las tablas nuevas por-cliente se registran en el set de tablas scopeadas; si no, el proxy no las filtra y el leak es silencioso.
- Los crons iteran los workspaces activos con el contexto seteado; los flags se leen ADENTRO de ese contexto (afuera, la lectura cae al dueño y le aplica su configuración a todos los clientes).
- Los webhooks no tienen sesión: resuelven el workspace desde el payload por una clave global única y recién ahí escriben con scope. Nunca asumen el dueño.
- Un interruptor global que enciende algo "para todos" es un bug esperando: los flags son por cliente, y un cliente sin configurar queda apagado (fail-closed).

Cada vez que se agrega una feature, la pregunta es: "si dos clientes usan esto al mismo tiempo, ¿pueden verse los datos?".`,
  },
  {
    titulo: 'Verificación adversarial: buscar refutar, no confirmar',
    categoria: 'Método',
    cuerpo: `Revisar el propio trabajo buscando confirmarlo no encuentra casi nada. La revisión que sirve es la que intenta ROMPER lo escrito, y mejor si la hacen varios revisores independientes con lentes distintos (correctitud, aislamiento entre clientes, interfaz, compatibilidad con lo que ya existe).

Dos reglas que hacen la diferencia:
1. Cada hallazgo se verifica intentando REFUTARLO antes de reportarlo. Un revisor escéptico descarta buena parte de lo que un revisor entusiasta reporta; lo que sobrevive suele ser real.
2. El hallazgo tiene que traer un ESCENARIO CONCRETO de fallo: qué entra, en qué estado, y qué sale mal. "Esto podría fallar" no es un hallazgo.

Caso real: una revisión así encontró que los recordatorios anclados a una reunión podían enviarse DESPUÉS de la reunión, y que una fecha sin hora se interpretaba como la tarde del día anterior. Ninguno de los dos se veía leyendo el código con buena fe.`,
  },
  {
    titulo: 'Elegir el modelo de IA por el tipo de tarea',
    categoria: 'IA',
    cuerpo: `No toda llamada a un modelo vale lo mismo. La regla práctica:

- CLASIFICAR, extraer un dato, transcribir, sugerir opciones cortas → modelo barato y rápido. Son tareas con respuesta acotada y verificable.
- ANALIZAR, deducir un patrón de datos reales, escribir copy que representa la voz de alguien, razonar sobre un caso → modelo bueno. Aquí la calidad se nota y el ahorro sale caro.

Además:
- El modo JSON estricto de algunos proveedores exige un OBJETO en la raíz: pedir un array pelado falla. Y algunos rechazan salidas que otro modelo acepta sin chistar; conviene parsear con tolerancia (rescatar el objeto aunque venga con prosa alrededor).
- Todo prompt que va a producción se guarda EDITABLE con variables, no hardcodeado: quien conoce el negocio tiene que poder ajustarlo sin tocar código.
- Ante una salida inválida, degradar con gracia (usar la versión genérica) antes que romper el paso.`,
  },
  {
    titulo: 'Lo que la IA toca deja rastro',
    categoria: 'Producto',
    cuerpo: `Cada acción automática deja su huella visible con el nombre de la IA: en el historial del registro que tocó, en el aviso al dueño, y en la interfaz.

Por qué importa: la confianza en la automatización se construye mostrando lo que hizo, no escondiéndolo. Un cambio que aparece sin explicación se lee como un bug, aunque sea correcto.

En la práctica:
- El historial dice "MaKo movió este lead porque…" con el motivo concreto.
- Lo que se aplicó solo y es revertible deja una fila de confirmación con el botón de deshacer.
- El aviso al dueño llega cuando pasa algo que le importa (el lead respondió), no por cada evento del sistema. Los avisos de más se apagan todos juntos y entonces se pierde el que sí importaba.`,
  },
  {
    titulo: 'Documentar el porqué, no el qué',
    categoria: 'Método',
    cuerpo: `El código dice lo que hace; el comentario tiene que decir por qué es así y qué pasa si alguien lo "mejora".

Los comentarios que salvan tiempo son los que explican una decisión contraintuitiva: por qué un chequeo corre adentro y no afuera de un bloque, por qué un valor por defecto es ese, qué error real motivó una guarda. Los que no sirven son los que repiten la línea de abajo en castellano.

Complementos que valen la pena mantener:
- Una guía por tema con las convenciones y los errores ya pagados, para que cada persona nueva (o cada agente) no los repita.
- Notas de decisiones de producto que no se deducen del código: qué se decidió, con qué alternativa se comparó y por qué se descartó.
- Cuando algo se descubre probando (una API que responde distinto a lo documentado, un formato que rompe), se escribe en el momento. Esa información no se vuelve a encontrar sola.`,
  },
];
