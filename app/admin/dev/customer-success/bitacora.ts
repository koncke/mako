// =============================================================================
// Customer Success — registro de construcción
// =============================================================================
// Qué va acá y qué no es lo mismo que en el resto: el motivo y la trampa, no el
// changelog. Los tipos y la forma de una entrada, en ../_registro/tipos.ts.
//
// Este registro nace con la historia ya hecha, porque el encargo tiene cinco
// semanas y ninguna estaba escrita en el repo. El contexto completo —las 7
// reuniones, las citas textuales, el estado real de cada frente— vive en
// docs/sprint-servicio-mauricio.md; acá va solo lo que gobierna las decisiones.

import type { Hito, Parte } from '../_registro/tipos';

/**
 * ⚠️ Estas PARTES **no se pintan** en esta área: su Roadmap es propio y las
 * reemplaza (ver `roadmapPropioDe` en ../paneles.tsx). Siguen acá porque son lo
 * que alimenta el contador «N de M» del encabezado, y por eso son ESPEJO EXACTO
 * de las fases de `roadmap-cs.ts`. Si allá se agrega una fase, acá va su fila —
 * si no, el contador cuenta otra cosa que lo que la pantalla muestra.
 */
export const PARTES: Parte[] = [
  { titulo: 'El bucle de entrega', detalle: 'El curso en MaKo por etapas, lo que responde el cliente, la IA que lo mejora con la junta y su aprobación.', estado: 'sigue' },
  { titulo: 'La cartera de Mauricio', detalle: 'Avisos de compromiso vencido y de cliente sin señales, la etapa de cada uno y verlos a todos en una pantalla.', estado: 'sigue' },
  { titulo: 'Que armar un tablero cueste menos', detalle: 'Proponerle la evidencia y los umbrales desde los seis clientes anteriores, que es lo que ninguna de sus skills puede hacer.', estado: 'cola' },
];

const CH = 'Customer Success: mapeo y roadmap';

export const BITACORA: Hito[] = [
  {
    fecha: '4 jul', hora: '—', chat: 'Weekly Mauricio <> Martín', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'La propuesta: MaKo Customer Success, todo adentro de la app',
    pedido: 'A todo eso en una sola, que es en Maco. […] la idea es que ahora también entregás todo el servicio dentro de Maco, o sea, que todo se construya dentro de una misma aplicación.',
    puntos: [
      'Once funcionalidades en pantalla y **ningún precio**: iba a anclarse al sueldo de un Customer Success en México, no a un ticket de software.',
      'La objeción de Mauricio ese día NO fue contra la app: fue contra perder al mentor. [01:44:22] «que pierda a mi mentor y a mi coach estrella y que adquiera un buen trabajador».',
    ],
  },
  {
    fecha: '8 jul', hora: '—', chat: 'Mau <> Martín (2 de 2)', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'La bisagra: US$9.000 pedidos y rechazados el mismo día',
    pedido: 'Es que yo nunca planteé contratar un Customer Success, eso tú lo trajiste a la mesa como una asesoría. Yo planteé alguien que me ayude a quitar los tiempos donde yo dedico más tiempo, que son la de codificación, de estarle dando enter al cloud cuando hay un prompt ya establecido, y que me ayude a generar la plataforma donde pueda el cliente ver videos en lugar de que los vea en Google Drive.',
    puntos: [
      '**No lo rechazó por precio, por timing.** [01:08:16] «9 mil dólares van a ser una ganga… pero es el timing». Y lo aplazó con gatillo: [00:59:31] «Si yo tengo eso para 15 y podemos empezar a tener testimonios de 5, a lo mejor ya estamos listos para escalar».',
      'La objeción más dura, y la que hay que tener presente en cada decisión: [00:38:45] «tu tiempo ha estado mucho más enfocado en crear Maco… **es nice, es cool, es wow, pero no es el core**».',
      'La frase que resume la relación: [00:49:54] «en lugar de que tú me lleves a tu modelo de escalamiento supersónico, wow, high class, **yo te quiero traer a mi humilde producto mínimo viable**».',
      '⚠️ **El sprint se cerró acá, el 8/7, no el 10/7.** [01:28:42] «Cerramos ahora ya, me parece bien, 500 dólares extra por los próximos dos meses». El 10/7 es la fecha del primer pago. Y el «10 de septiembre» del documento **no se dijo nunca**: el disparador que él puso es de resultado.',
      'Y acá nació «doer vs thinker» — **la frase la dijo Martín, no Mauricio**. Él dio el diagnóstico: [01:09:47] «Maco está diseñado para ver feedback del dato del mercado… pero ¿qué pasa con tu cliente que tiene que hacer algo?».',
    ],
  },
  {
    fecha: '31 jul', hora: '—', chat: 'Mau <> Martin (4h15)', cuenta: 'claude2', actor: 'claude', tipo: 'investigacion',
    titulo: 'Los 5 pasos, y el pedido de producto más fuerte de las 7 reuniones',
    puntos: [
      '**El bucle quedó definido** [03:46:44] y Mauricio lo validó: «Me late, me hace sentido» / «Y así con todo, es como un bucle». Es el único activo metodológico de las ocho semanas.',
      '**Y quedó enterrado.** El 6/8 ni Martín ni Mauricio se acordaban de la lista de cinco entregables: [01:10:26] «eran cinco en total, me acuerdo. Si no, ahí yo reviso la grabación». Recuperaron tres. Es exactamente lo que la regla de la cosecha viene a evitar.',
      '**El pedido de producto que define el doer**, y no es «ver mis clientes»: [02:09:00] «si Mauricio Bustos no subió con evidencia los siete videos a la semana, no va a ocurrir» + [02:12:04] «¿qué me va a dar el valor de que la herramienta sea mi brújula? **Porque obligas a la gente**». Es su propia metodología —palanca con dueño, umbral y evidencia— aplicada a él mismo.',
      'Su principio de diseño para la ficha de palanca, que gobierna el frente 01: [03:38:14] «**La inteligencia artificial no funciona por procesos, funciona por estándares**».',
    ],
  },
  {
    fecha: '6 ago', hora: '—', chat: 'Mau <> Martin: GUIONES + VSL + LANDING', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: '«No queremos desarrollar»: la regla se endurece, y el consumo de IA le costó tres días',
    pedido: 'estamos claros que no queremos, no queremos desarrollar, ¿verdad? Más bien queremos pagar un service, un software as a service que ya está ahí, que ya podemos usar, que se adecúa más o menos.',
    puntos: [
      'Martín acota su propio alcance: [01:11:00] «no vamos a desarrollarlo dentro de Maco… lo que sí voy a hacer es **la conexión de API**». Ese «se adecúa más o menos» es la licencia para no optimizar la elección.',
      '⚠️ **El riesgo de relación más grande del encargo.** [00:04:02] «tuve como tres días sin poder trabajar y tuve que pedir disculpas a mi cliente»: desarrollar MaKo sobre la cuenta de Claude de Mauricio se comió los créditos con los que él arma los tableros de sus clientes. **El frente 01 se bloqueó a sí mismo.**',
      'Y el reproche que vino con eso es el mismo del 8/7: [00:04:45] «siento que a lo mejor estás desarrollando, pero no sé si estás compartiendo también como esa restricción de lograr objetivos».',
      'Tema nuevo que no está en ningún documento: **propiedad del código**, 25 minutos. Cerrado — Martín nunca le cobra MaKo, el repo/Supabase/Vercel quedan accesibles para él, y la única contraprestación es no compartirlo con terceros.',
    ],
  },
  {
    fecha: '11 ago', hora: '—', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'investigacion',
    titulo: 'Las reuniones no estaban donde se las buscaba, y el documento decía siete cosas al revés',
    puntos: [
      '⚠️ **Hay TRES cuentas de Fathom, no dos.** El conector MCP apunta a una tercera donde las weeklies con Mauricio no existen: `find_person "Mauricio"` devuelve «no encontrado» y se lee como «esas reuniones no existen». Existen: son 7 entre el 4/7 y el 6/8, y salen todas con `FATHOM_API_KEY_MARTIN` del `.env.local`. Escrito en docs/conectores.md.',
      '**La diarización de Fathom está rota en tramos largos** de las 7: bloques duplicados con los hablantes invertidos y tramos traducidos al inglés. Una cita se atribuye por dialecto, nunca por la etiqueta.',
      'Siete puntos donde el Google Doc del Sprint dice lo contrario que las reuniones: la fecha de cierre, la forma del pago, la fecha de fin, el alcance de «no dentro de MaKo», quién dijo lo de doer, cuántos clientes son (~7, no 15) y si el frente 04 es entregable (no lo es).',
      '**El frente 03 se mudó adentro de MaKo y lo pidió Mauricio**, del 16/7 en adelante. Lo que se endureció es el 02. Gana lo posterior.',
    ],
  },
  {
    fecha: '11 ago', hora: '—', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Whop, y una tab con el roadmap completo',
    pedido: '1. Lo vamos a hacer con Whop ya que es la alternativa gratuita que tiene API...\n2. Quiero que crees una tab en dev de super admin que justamente tenga el roadmap completo. Primero lo que hay que resolver con Mauricio, pero luego también todo lo que yo habia pensado en un primer momento.\n3. También carga TODO al plan y mandame el link, son muchas tareas y el plan lo debe tener.',
    puntos: [
      '**Whop cierra el compromiso más viejo del sprint.** La comparativa de plataformas se prometió el 8/7 [01:16:16] y llevaba cinco semanas sin entregarse; Circle y Thinkific no volvieron a nombrarse después de esa reunión.',
      '⚠️ **El área se llamaba «CS Analyst» y era la mitad del asunto.** Su `proyectos` apuntaba a «Feature: CS Analyst», que NO existe en el tablero: el proyecto real es «Feature: Customer Success» (P34, 3 tareas), que a su vez no estaba en el catálogo. El Roadmap salía vacío **sin fallar** y el ruteo no podía mandarle nada. Es el mismo agujero que tuvieron Landing Analyst y YouTube Analyst, pero al revés: acá el huérfano era el proyecto real.',
      'De las 10 features que el documento le mostró a Mauricio con el tag `listo`, **cuatro no lo estaban** — entre ellas «Semáforo del negocio», que se vendió como hecha y es exactamente el comportamiento que él después reclamó como faltante.',
    ],
  },
  {
    fecha: '11 ago', hora: '—', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'correccion',
    titulo: '«No entiendo porque hay 2 tabs de roadmap»',
    pedido: 'No entiendo porque hay 2 tabs de roadmap... Y no se entiende, ¿que tenemos que hacer primero? Está bien que pongas "los 5 pasos" pero que hay que hacer primero... Y si dentro de los 5 pasos está uno que el cliente se vea el curso, no puede estar como paso posterior el crear la plataforma... Hazlo bien, y está bien que pongas el objetivo grande, pero también desglozalo. Puedes diferenciar el gran objetivo de las cosas que tenemos que hacer para llegar a ello.',
    puntos: [
      '**Tenía razón y eran TRES, no dos**: las `partes` de esta bitácora, el panel propio y `RoadmapDelPlan`, apiladas en la misma pantalla. La regla que queda: **un área tiene UN roadmap.** Si trae uno escrito a mano, ese REEMPLAZA al genérico y se hace cargo de mostrar las tareas del plan adentro — no al lado. Vive en `roadmapPropioDe` (paneles.tsx).',
      '⚠️ **El error de fondo era de categorías, no de tabs.** Estaban mezclados el OBJETIVO (cómo va a funcionar el servicio: el bucle de 5 pasos) y el CAMINO (lo que hay que construir para que ese bucle pueda correr). Mezclados producen el absurdo que él marcó: el paso 1 es «el cliente ve el video» y aparecía ANTES que la fase que construye la plataforma donde vive ese video. **El paso 1 del bucle es el ÚLTIMO en poder correr.**',
      'Ahora el objetivo va aparte y sin estado —no es trabajo, es el destino— y cada paso declara qué fase lo habilita. El camino son 9 fases en orden de DEPENDENCIA, no en el orden de los cuatro frentes del Sprint: cada una dice qué desbloquea y qué necesita antes, y dos están marcadas como paralelas.',
      'La matriz vinculada pasó a ser la fase 1 por la misma razón: el formulario, el prompt maestro y el tablero preguntan o pintan LO MISMO. Construir cualquiera antes es construirlo sobre una suposición.',
      'Las tareas del plan se resuelven **por título** adentro de cada paso (`tareasDelCamino` en roadmap.ts, que une las del proyecto con las que el camino reclama en otros). Si el título no matchea no se inventa número: un número aproximado manda a la tarjeta de otra tarea. Y las que el camino no reclama se muestran igual, para que la pantalla no diga «esto es todo» cuando no lo es.',
    ],
  },
  {
    fecha: '11 ago', hora: '—', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'correccion',
    titulo: 'Toda la paja afuera, y el renglón es el mismo que el de las otras siete áreas',
    pedido: 'Elimina TODA la información innecesaria... Ahora SOLO queremos tener claridad en el roadmap de implementación, TODA TODA la paja eliminala.\nY se más específico en el roadmap de implementación sobre lo que hay que hacer.\nIntenta seguir el mismo diseño que estamos acostumbrados en otras tabs del roadmap. Hazlo bien diseñado, que se la facil.',
    puntos: [
      '**Se fue todo lo que no es un paso**: las citas de reuniones, las seis objeciones del 8/7, los precios, la tabla a 3 años, «lo que MaKo no reemplaza» y las reglas del acuerdo. Nada de eso se perdió — vive en `docs/sprint-servicio-mauricio.md`, que es donde se lee. Una pantalla de roadmap que además argumenta una venta no sirve para ninguna de las dos cosas.',
      '⚠️ **Y lo posterior dejó de ser un documento para ser TRABAJO.** Los 12 módulos de la propuesta estaban como features con su copy de venta; ahora son 24 pasos de implementación con el mismo formato que los del sprint. Los que ya se habían descartado con motivo (NPS, CES, churn rate, gamificación, momentos wow, escudo de disputas, blindaje legal, firma de contrato, asignación de consultor) **no están**: un roadmap con pasos que nadie va a hacer no es un roadmap.',
      '**El renglón ahora es literalmente el mismo.** `FilaRoadmap`, `ListaRoadmap` y `ChipEstado` se extrajeron de `_registro/Registro.tsx` —donde ya vivían, adentro de `Roadmap`— y las dos pantallas los comparten. Antes esto era un diseño «parecido» al de las otras siete áreas, que es exactamente lo que AGENTS.md manda no hacer: si comparten esqueleto, es una pieza con dos usos.',
      'Se suma un cuarto estado, `bloqueada`, al vocabulario de los chips. Es la única información que cambia qué se puede hacer HOY: con solo `hecha | sigue | cola`, «en cola» miente sobre los 3 pasos que no pueden arrancar.',
      '**La numeración es continua y cruza los grupos**: el paso 01 es lo primero que hay que hacer, y no hay que interpretar nada. Los grupos pasaron de ser cajas a ser un rótulo tenue con una línea que dice qué desbloquea.',
      'Y el detalle de cada paso dice **dónde se toca**: `lib/tablero-matriz.ts`, `lib/whop.ts` + los dos catálogos, el molde `app/api/cron/tareas-verificar/route.ts`, `TENANT_TABLES` **y** `TABLAS_RESET`. Antes decía qué se lograba; ahora dice qué se escribe.',
    ],
  },
  {
    fecha: '11 ago', hora: '—', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'correccion',
    titulo: 'Dos bloques, títulos en castellano, y el modal es el de /plan',
    pedido: `1. Elimina TODO el texto inncesario, como "Antes de tocarla", o los subtitulos innecesarios, eso ya está como regla, elimina TODA la paja.
2. Separa el roadmap en 2 bloques, uno de Urgencia que es lo que debemos hacer para Mauricio ya. Y otro de "A futuro" que es todo lo que estaba en la propuesta original.
3. Que las task se abran como modal sin cambiar de ruta. El modal EXACTO que ya hemos implementado en el plan, no inventes nada nuevo, solo llama a ese modal que ya existe.
4. Haz que TODOS los títulos sean ENTENDIBLES, mira como pusiste algunos titulos "Validador \`validarMatriz()\` con las 6 auditorías" eso no se entiende...
5. Dentro del detail de cada paso, se más específico con lo que hay que hacer, se más detallista. Revisa como lo hacemos en el plan, para que se entienda.`,
    puntos: [
      '**La caja «Antes de tocarla» se saca del roadmap propio.** Lo que decía son reglas que ya viven en `AGENTS.md` y en `docs/`, y arriba de un roadmap son paja: el que entra viene a ver qué hacer, no a leer el porqué de la pantalla. Sigue apareciendo en las áreas que NO tienen roadmap propio, donde sí es lo único que hay.',
      '**Dos bloques.** `URGENTE` (5 grupos, lo de Mauricio ya) y `FUTURO` (7 grupos, la propuesta original convertida en pasos). La numeración es continua y cruza los dos: el paso 01 es lo primero que hay que hacer.',
      '⚠️ **El modal es LITERALMENTE el de /plan.** `TaskModal` se exporta desde `app/plan/board/BoardShell.tsx` y el `Board` se arma con `useBoard` + el mismo `repoPlan()`. Para eso el I/O salió de `PlanBoard.tsx` a `app/plan/board/repo-plan.ts`: apareció el segundo consumidor, y copiarlo era garantizar que el segundo se quedara viejo. Consecuencia buena: lo que se edita desde el roadmap —detalle, checklist, avance, MaKo— queda guardado igual que si se hubiera abierto la tarjeta en /plan, y sin cambiar de ruta.',
      'Los pasos que todavía NO tienen tarjeta abren una ficha corta con «Ya está construido / Falta / Dónde se toca». Se distinguen a propósito: un paso sin tarjeta es un paso que nadie va a hacer.',
      '**Los títulos pasan a castellano llano.** Antes decían `Validador validarMatriz() con las 6 auditorías` — el nombre de la función no es el título de una tarea. Ahora: «Que el sistema rechace un tablero mal armado». Los 34 se reescribieron.',
      '⚠️ **Corrección de un diagnóstico mío anterior:** dije que la app no hidrataba «por el trabajo a medias de la otra sesión». Es falso. Con `.next` limpio y sin un solo error de módulo, siguen sin hidratar TODOS los botones (0 fibers sobre 62) con los 27 scripts cargados. **El pane del navegador no ejecuta React** —tampoco compone: los screenshots vencen y todo mide 0 px—. La verificación de interacción hay que hacerla en producción o a mano.',
    ],
  },
  {
    fecha: '11 ago', hora: '—', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'correccion',
    titulo: 'Sus dos skills reales: el tablero NO se construye adentro de MaKo',
    pedido: `1. Elimina todos los subtitulos y textos innecesarios... revisa bien, y elimina los textos innecesarios.
2. El paso numero 1 ya esta resuelto. NO quiero preguntarle nada a Mauricio, es lo que ya te pasé en los MD desde un principio.
3. Te paso los prompts y las skills que Mauricio ACTUALMETE ejecuta para con todos sus clientes... OJO, como lo haga el no significa que es ley.
4. Todos los primeros pasos NO se entienden... Eso significa que LOS clientes de Mauricio deberán ingresar a MaKo? O deberán ingresar a Whop? No se entiende como vamos a plantear el proyecto... Y el orden de las cosas`,
    puntos: [
      '⚠️ **El roadmap estaba mal planteado de raíz, y sus dos skills lo dejaron claro.** Tenía `lib/tablero-matriz.ts`, una migración de la matriz y un validador **adentro de MaKo**. El tablero de sus clientes NO vive en MaKo: es una app PROPIA por cliente, duplicada del repo privado `plantilla-accountability` (Next + Supabase + Vercel, uno por cliente). Y su propia metodología lo dice al revés de como yo lo había modelado: «**MCIs: NO se modelan en base de datos**».',
      '**Las tres piezas, que es lo que la pantalla no contestaba:** MaKo lo usa MAURICIO (su cartera y su seguimiento) · el TABLERO lo usa el equipo del cliente (app propia, no MaKo) · WHOP es donde el cliente ve los videos y hace la tarea. Ahora eso está arriba de todo, en tres renglones.',
      '**El generador de tableros ya existe y no era nuestro trabajo.** `dashboard-accountability` ya hace el BUILD desde el Excel, y `mapa-ejecucion-4dx` produce ese Excel auditando contra 4DX. Se sacaron del roadmap los pasos que los duplicaban.',
      '⭐ **Lo que sí puede aportar MaKo, y ninguna de sus dos skills puede:** el histórico de los seis clientes anteriores. Con eso ataca el **bloqueo número uno de todo su programa, dicho por él**: definir la evidencia (Baja Teriyaki estuvo tres semanas detenida en esa sola pregunta) y poner el umbral («qué nivel ya lograste alguna vez»). Sus skills ven un cliente por vez; MaKo los ve a todos.',
      '**El paso de preguntarle cuántos campos tiene la ficha se elimina: ya estaba contestado** en el material que él había pasado desde el principio — «La ficha de nueve campos». Preguntar algo que ya está escrito es hacerle perder el tiempo.',
      '⚠️ **Y el protocolo prohíbe lo que yo estaba por proponer:** «UN SOLO ARCHIVO… cero duplicación de captura». Nada de un cuestionario nuevo en MaKo: lo que MaKo aporte tiene que entrar al MISMO Excel que él ya trabaja con el cliente.',
      'Fuera la paja: el `proposito` del encabezado, la línea de «Ordenado por dependencia», y el `desbloquea` de cada grupo. Los grupos son un rótulo y nada más.',
    ],
  },

  // Cosecha retroactiva (17 ago): tandas que se trabajaron y no habian dejado
  // hito. Salieron de cruzar el git log del area contra este mismo archivo.
  {
    fecha: "11 ago", hora: "13:38", chat: "Productos X Funnels", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "La tarea NO puede vivir en Whop: la arquitectura de cuatro piezas, y las cuatro trampas del webhook",
    puntos: [
      "Se verificó la API de Whop contra la cuenta real («Elévate», biz_1FDimrbhXluff7, lienzo en blanco) y eso CAMBIÓ el planteo: Whop da la señal de avance (cursos, lecciones, alumnos, el webhook course_lesson_interaction.completed) pero NO tiene endpoint para LEER las respuestas de un assessment ni dónde guardar datos por miembro. Como la tarea de cada bloque es un documento a tres manos —lo escribe el cliente, lo reescribe la IA con lo hablado en la junta, lo aprueba el cliente— vive en cs_respuestas (mig 0125) y Whop queda solo como señal. De ahí salen las cuatro piezas que hoy encabezan la pantalla: Whop (videos, acceso y cobro) · la TAREA (en MaKo, el cliente entra por link sin cuenta) · el tablero (app propia del cliente) · MaKo (la cartera de Mauricio). Se cargaron 54 objetos por API con un cargador idempotente por título, y el curso quedó OCULTO a propósito hasta que existan videos.",
      "Es la decisión de arquitectura que gobierna todo el frente y solo se descubre mal cuando el bucle ya está construido. Y las trampas no dan síntoma útil: la firma la escribí estilo Stripe cuando Whop usa Standard Webhooks (habría rechazado el 100% con un error indistinguible de un secreto mal pegado); el secreto de Whop es ws_+64 hex y NO es base64, así que Buffer.from(...,'base64') no lanza y devuelve bytes equivocados; los ids de lección son lesn_ y no less_, así que el receptor descartaba todas contestando 200; el webhook estaba apuntado a la raíz del dominio y la landing devolvía 200, o sea que Whop lo daba por entregado. Además Whop no se veía en /integraciones porque CAT_ORDER hace de whitelist y le puse una categoría nueva. Y el cron tiraba las juntas de entrega por UNA línea (tipo==='equipo'), con las dos explicaciones que yo mismo había escrito antes siendo FALSAS.",
    ],
    commits: [
      { sha: "43daab59", msg: "El programa de Mauricio por bloques, y la tarea NO puede vivir en Whop", lineas: 252, archivos: 2 },
      { sha: "1d022463", msg: "Whop conectado y el programa cargado: 12 módulos y 42 clases en su cuenta real", lineas: 889, archivos: 7 },
      { sha: "7d0080de", msg: "La firma de Whop la tenía mal, y la integración estaba invisible", lineas: 738, archivos: 17 },
      { sha: "8911b51b", msg: "El webhook de Whop, y el cron deja de tirar las juntas con clientes", lineas: 568, archivos: 9 },
      { sha: "c60ddde1", msg: "Los ids de lección de Whop son `lesn_`, no `less_`: descartaba todas", lineas: 154, archivos: 5 },
      { sha: "8fdb9c58", msg: "La trampa del paso que sigue, anotada antes de perderla", lineas: 8, archivos: 1 },
    ],
  },
  {
    fecha: "11 ago", hora: "15:46", chat: "Productos X Funnels", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El bucle cierra y tiene vuelta: el cliente contesta sin cuenta, MaKo reescribe con la conversación, y el aviso lo manda un humano",
    puntos: [
      "Se construyó la pantalla /compartido/[token] donde el cliente contesta sin cuenta ni contraseña, probada de punta a punta contra un lead real (link de solo lectura → 404, link del lead 92 escribiendo → escribe en 92 y nunca en 91). Después el eslabón que faltaba: cuando termina una junta de entrega, MaKo reescribe las respuestas previas del cliente y él ve las dos versiones. Y el último: el bloque quedaba en «esperando su ok» PARA SIEMPRE porque nadie le avisaba — ahora MaKo deja un BORRADOR de WhatsApp por cliente (no por bloque) que manda Mauricio con un click, con textos de él y sin que MaKo se nombre.",
      "Tres trampas que se ven exactamente igual que el camino sano. (1) POST /api/compartido/tarea devolvía 405 a todo: proxy.ts corta cualquier método que no sea GET sobre PUBLICOS_SOLO_LECTURA y el handler nunca corría — la excepción se lista EXACTA en PUBLICOS_ESCRITURA, nunca sacando el prefijo. (2) La reescritura enganchada donde era natural (ExtractOut) le habría dado al modelo una lista de TÍTULOS en vez de la conversación, y un modelo al que se le pide «mejorá esto» siempre devuelve algo plausible e inventado; por eso viaja la cabecera de Fathom. (3) Esa misma cabecera quedó como campo opcional y NUNCA se devolvió: código muerto en producción que pasó el typecheck, los 613 tests y un ensayo end-to-end que llamaba a la función de adentro salteándose justo el eslabón roto. La regla que queda: un campo que alguien va a usar como guarda va OBLIGATORIO. Y la de producto: MaKo no le escribe sola a un cliente que paga; el click de Mauricio ES la aprobación.",
    ],
    commits: [
      { sha: "1d566ca7", msg: "La pantalla donde el cliente contesta, y un 405 que no decía por qué", lineas: 543, archivos: 7 },
      { sha: "387dba4c", msg: "El bucle cierra: MaKo reescribe la tarea con lo hablado en la junta", lineas: 228, archivos: 5 },
      { sha: "86bfd460", msg: "La reescritura estaba MUERTA en producción, y nada lo dijo", lineas: 164, archivos: 5 },
      { sha: "dbeb07c1", msg: "Un ensayo del bucle entero, y el bug que el chequeo débil escondía", lineas: 246, archivos: 2 },
      { sha: "94f1e28b", msg: "El bucle tenía ida y no tenía vuelta: ahora el cliente se entera", lineas: 191, archivos: 5 },
      { sha: "bb99502e", msg: "El bucle de entrega queda cerrado, y lo que costó cada eslabón", lineas: 110, archivos: 2 },
    ],
  },
  {
    fecha: "11 ago", hora: "17:58", chat: "Productos X Funnels", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "La cartera gira sobre de quién es la pelota, y las 26 semanas del programa eran inventadas",
    puntos: [
      "Se construyó Clients (la cartera de los 13 clientes) con investigación de Skool, Vitally, Planhat, Catalyst, Attio y Linear. La card contesta UNA cosa —¿te toca a vos o le toca a él?— y no el avance del programa, porque cs_respuestas está vacía y una pantalla que gire sobre eso se ve idéntica de rota durante las semanas que tarde en llenarse. Se emite, rota y revoca el link del cliente desde la pantalla y no desde una terminal. Se sumó el histórico de los seis clientes anteriores (lo único que MaKo aporta y ninguna de sus dos skills puede) y el guard de workspace.",
      "Tres cosas que solo se ven con los datos de producción. (1) El ORDEN de los if de clasificación ES el diseño: la primera regla que escribí («no tiene link, te toca a vos») era verdadera y metía a los 13 en el mismo grupo, y a un cliente con 187 días sin una sola sesión le decía «dale su link» cuando ahí lo que hace falta es una llamada. (2) Puse 26 semanas como constante TENIENDO el dato en la base: los contratos firmados dicen 16 semanas y 3 meses. Una constante inventada es peor que un dato faltante — el faltante se ve, el inventado se cree; ahora lib/cs-contrato.ts devuelve null antes que inventar. (3) El guard va en POSITIVO («solo el dueño») y sin `?? OWNER_WS`: ese default parece inofensivo y mandaba a la cartera de Mauricio a un usuario suspendido cuyo token sigue firmado. Y NADA de health score a propósito: con 13 clientes un 78/100 esconde «cuota vencida hace 9 días» detrás de un número que nadie sabe cómo se calculó.",
    ],
    commits: [
      { sha: "c3b81405", msg: "Customer Success en la sidebar, y la cartera sin tocar una terminal", lineas: 447, archivos: 6 },
      { sha: "7ed42cf7", msg: "Clients gira sobre de quién es la pelota, con los datos reales de su cartera", lineas: 649, archivos: 3 },
      { sha: "21add557", msg: "Las 26 semanas eran inventadas: el contrato de cada cliente lo dice", lineas: 245, archivos: 7 },
      { sha: "640f880d", msg: "La card lidera con el reloj del contrato y con lo que le prometiste", lineas: 254, archivos: 3 },
      { sha: "ab50f859", msg: "El histórico de sus clientes anteriores, que es lo único que MaKo aporta", lineas: 233, archivos: 2 },
      { sha: "133ddef0", msg: "El link de cada cliente, y una columna que existía sin poder leerse", lineas: 129, archivos: 2 },
      { sha: "6a6604bb", msg: "Customer Success solo en el workspace de Mauricio, con ComingSoon en el resto", lineas: 30, archivos: 3 },
      { sha: "e0136b06", msg: "Program usaba cinco variables de color que no existen", lineas: 17, archivos: 1 },
      { sha: "c293ed09", msg: "El cuaderno del cliente: 118 campos, y Clients en cards", lineas: 1085, archivos: 9 },
      { sha: "e50ef124", msg: "El formulario de verdad: 118 preguntas de sus dos Cuestionarios Maestros", lineas: 824, archivos: 8 },
    ],
  },
  {
    fecha: "11 ago", hora: "21:38", chat: "Productos X Funnels", cuenta: "claude2",
    actor: "claude", tipo: "cosecha",
    titulo: "44 clases son 25 videos: fusionar el VIDEO no es fusionar el BLOQUE",
    puntos: [
      "Se descubrió que el temario se había cortado donde se cortaba el CUESTIONARIO, no donde se corta una clase: las cuatro secciones de la carta de expectativas son cuatro respuestas y UNA explicación, y los tres umbrales son un ejercicio. Le estábamos haciendo grabar 44 videos y hacen falta 25. Se modeló con `mismoVideoQue`, que junta SOLO la grabación: las 44 tareas, sus 118 preguntas y sus 44 estados siguen intactos. Después se escribieron los 259 puntos de grabación (mediana 342 caracteres) con doce agentes, uno por módulo, más un revisor encima. La pantalla Program se partió en dos sub-tabs (Clases = «¿qué grabo?» / Tareas = «¿qué le pedimos?») con la estructura de Skool medida en vivo.",
      "La distinción que salva el diseño —fusionar el VIDEO, no el BLOQUE— porque el bloque ES el gate de la sesión, la unidad de la reescritura de la IA y el estado de aprobación: fusionarlo rompe el bucle. Y agrupar NO reordena: el rótulo sale de la POSICIÓN de la clase y es lo que el cliente ya tiene abierto en Whop. Del revisor salieron tres defectos que ningún esquema puede ver: un dato de cliente INVENTADO y perfectamente verosímil, una muletilla de cierre en 24 de 44 clases que solo se ve leyendo agrupado por VIDEO (Mauricio diciendo la misma fórmula tres veces en una grabación), y guiones encubiertos («conviene decirla tal cual:»). La regla: cuando N agentes escriben piezas de un mismo entregable, el revisor las lee en el orden en que las CONSUME el usuario, no en el que se generaron. Además quedó medido que Skool no tiene vista de autor —que es justo la que hacía falta— y que implementar mientras corre una corrida de escépticos envenena su veredicto (24 de 24 refutaron por código que se movió debajo de ellos).",
    ],
    commits: [
      { sha: "920ddaf0", msg: "Program: una sub-tab de grabación, y 44 clases que son 25 videos", lineas: 443, archivos: 6 },
      { sha: "2d7c3596", msg: "Los módulos de la tab Clases, en cards, y el módulo abierto viaja en la URL", lineas: 172, archivos: 2 },
      { sha: "b9f43de6", msg: "Adentro del módulo, cada video también es una card", lineas: 42, archivos: 1 },
      { sha: "b16ed196", msg: "Una sola card para el módulo y para el video, con la indicación adentro", lineas: 135, archivos: 1 },
      { sha: "09c4eab7", msg: "La card del video navega igual que la del módulo: tres niveles, misma mecánica", lineas: 108, archivos: 3 },
      { sha: "539fadb4", msg: "Una card = una clase, numeradas «Clase 1, Clase 2…»", lineas: 84, archivos: 2 },
      { sha: "ac0aab67", msg: "La card del módulo lidera con «MÓDULO 1» y el nombre", lineas: 16, archivos: 1 },
      { sha: "ec6e37da", msg: "«Módulo 1: Tu negocio en números» es EL título, no dos renglones", lineas: 5, archivos: 1 },
      { sha: "ab159c4c", msg: "Program con la estructura de Skool, medida en vivo, y contenido de autor", lineas: 359, archivos: 2 },
      { sha: "0be678c3", msg: "Los puntos para grabar, empezando por el módulo 1", lineas: 81, archivos: 3 },
      { sha: "06600ae1", msg: "Los puntos de grabación de las 44 clases, con el detalle que hacía falta", lineas: 365, archivos: 2 },
      { sha: "dcfaf7d9", msg: "Cosecha: el amarillo que nadie pregunta, y por qué la refutación salió envenenada", lineas: 118, archivos: 1 },
      { sha: "c7597179", msg: "Cosecha: lo que caza un revisor y no caza un esquema", lineas: 43, archivos: 1 },
    ],
  },
  {
    fecha: "12 ago", hora: "11:10", chat: "Customer Success", cuenta: "claude1",
    actor: "claude", tipo: "implementacion",
    titulo: "El portal de cursos se llenó: 15 cursos, y el catálogo escrito dos veces rompía el link de cada curso nuevo",
    puntos: [
      "Entraron al portal ~15 cursos (M5-95 de Juan ADS con 116 clases, PROGRAMA RAIO con 201, Instituto de Comunicación con 158, Bigseo con 77, Master Marca Personal 5.0 con 92, Creator Club, Brian Tracy, Felipe Vergara con 242, Jaque Blue, ManyChat, Social Funnel, UGC SIM, Hackeando la Edición…), con secciones propias, buscador, filtro, portadas y transcripciones. Y se rehizo compartir: el catálogo pasó a app/conocimientos/catalogo.ts y el token se guarda TAMBIÉN cifrado (AES-256-GCM v2, mig 0131) para que copiar un link sea copiarlo.",
      "El catálogo estaba escrito DOS veces —el portal juntaba seis fuentes y /compartido/[token] armaba la suya con dos—, así que los dos cursos con archivo propio se listaban, se podían compartir y su link daba 404 de Next: cada curso nuevo nacía con el link roto, sin ningún síntoma del lado del admin (el share se creaba bien y mostraba 0 visitas porque se registran después). «Copiar link» rotaba y mataba el anterior; el dueño lo dijo textual: «estoy queriendo copiarlo, no rotar el link». El «Volver» se reportó roto tres veces con tres causas distintas y los dos primeros arreglos eran correctos: fallaron por compartir la premisa de router.back() — el destino es propiedad de la PANTALLA, no del camino (ya subió a AGENTS.md). Y tres trampas del cargador que dan éxito por vacío: un ZIP que el downloader daba por PDF bajado, un curso cargado dos veces sin que ningún chequeo de unicidad lo viera, y un reintento que consultaba un id ya persistido (o sea, no reintentaba nada).",
    ],
    commits: [
      { sha: "dc5c2318", msg: "Los links de /conocimientos daban 404: el catálogo estaba escrito dos veces", lineas: 106, archivos: 4 },
      { sha: "e8902ffa", msg: "Compartir la tab entera de Conocimientos por link", lineas: 181, archivos: 7 },
      { sha: "42771900", msg: "Conocimientos: dos niveles plegables, portada del curso y el título que corresponde", lineas: 515, archivos: 9 },
      { sha: "2365fead", msg: "Conocimientos: secciones, recursos plegables, portadas y el autor en el título", lineas: 305, archivos: 13 },
      { sha: "f50bbbf6", msg: "Las portadas reales, y el slug que ponía la de otro curso", lineas: 63, archivos: 12 },
      { sha: "fc41e638", msg: "Conocimientos: buscador y filtro por categoría, y dos secciones nuevas", lineas: 120, archivos: 3 },
      { sha: "4dfa3b2d", msg: "Copiar un link es copiarlo, no rotarlo (mig 0131)", lineas: 211, archivos: 6 },
      { sha: "a287425a", msg: "Volver a copiar el link de un enlace publico", lineas: 88, archivos: 3 },
      { sha: "78534c7a", msg: "El hub del curso no tenía botón de Volver: se entraba y no había salida", lineas: 6, archivos: 1 },
      { sha: "8e084c36", msg: "Los links compartidos salen sin marca y sin la seccion propia", lineas: 58, archivos: 8 },
      { sha: "4d38cc59", msg: "Un ZIP no es un PDF que falló: el downloader de recursos daba éxito por vacío", lineas: 1037, archivos: 50 },
      { sha: "f9076d18", msg: "Un curso de 116 clases se enumeraba como CERO, y el filtro pasa a desplegable", lineas: 243, archivos: 4 },
      { sha: "746c2532", msg: "M5 -95 de Juan ADS entra al portal: 116 clases con transcripción", lineas: 1772, archivos: 119 },
      { sha: "512b5994", msg: "Fusionar un curso con la carpeta de Drive que ya existía: las 242 de Felipe Vergara", lineas: 3962, archivos: 38 },
      { sha: "cd3dd12e", msg: "Jaque Blue tenía el curso cargado dos veces, y ningún chequeo de unicidad lo vio", lineas: 129, archivos: 4 },
      { sha: "4d7aa838", msg: "Un reintento que consulta un id persistido no es un reintento", lineas: 464, archivos: 213 },
      { sha: "722b7ea6", msg: "Una clase sin video no entra a la ficha, y dos cursos tienen huecos en el origen", lineas: 623, archivos: 39 },
      { sha: "5702f936", msg: "Las transcripciones estaban rotas en TODO link compartido", lineas: 111, archivos: 7 },
      { sha: "be305f8c", msg: "Transcripción: copiar y descargar. Y navegación entre clases", lineas: 111, archivos: 1 },
      { sha: "be85c669", msg: "Volver deja de desandar clase por clase, y la navegación se va abajo del video", lineas: 84, archivos: 3 },
      { sha: "12db4183", msg: "El «Volver» de una clase deja de depender del historial del navegador", lineas: 25, archivos: 5 },
      { sha: "5ce89db4", msg: "El «Volver» del hub ya no depende del historial", lineas: 49, archivos: 4 },
      { sha: "30562425", msg: "Social Funnel entra a Orgánico, y el verificador de huecos tenía un falso positivo", lineas: 197, archivos: 14 },
      { sha: "897ce26e", msg: "Un redirect es navegación: los 26 que perdían el ?ws= de la pestaña", lineas: 126, archivos: 26 },
    ],
  },
  {
    fecha: "12 ago", hora: "16:49", chat: "Customer Success", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "Mau revisó Program en vivo y dictó los cambios: los tests frenaron la aplicación, y tenían razón",
    puntos: [
      "En la reunión «Mau <> Martin: CUSTOMER SUCCESS» del 12/08 revisó la tab Program módulo por módulo y dictó los cambios: el módulo 5 se reescribe entero porque su propósito NO se organiza por «adversario» sino por STAKEHOLDER («yo no hablo tanto de adversario, sino de cada stakeholder, cómo va a cumplir su propósito») — siete clases; el módulo 8 se funde en una («aquí literalmente sería una sola»); el 10 pasa a «Diseñando las juntas», una clase por junta; el 11 pierde «Los catálogos que faltan» («esto es un retraso, se supone que ya me los mandaron»); el 4 es insuficiente y falta el árbol MCI → objetivos por área → medidas de predicción; y del 6 dijo «los objetivos son el puente que no existe para las palancas, ahí es donde está roto». El 11/08 quedó ESCRITO y sin aplicar; el 12/08 se aplicó repartiendo las 18 preguntas existentes sin inventar ninguna.",
      "Es el único pedido textual del dueño posterior al último hito y no está en ningún registro. Y trae la trampa: al intentar aplicarlo, las clases nuevas quedaban sin preguntas y las que reusaban un id existente se quedaban con LAS PREGUNTAS VIEJAS pegadas al contenido nuevo — siete clases así, entre ellas «El origen» preguntando por el adversario. Error silencioso del tipo que descubre el cliente. La decisión que queda escrita: un cambio se deja escrito y NO aplicado antes que dejar un catálogo roto. Cuando se aplicó, el reparto de preguntas cerró solo (I7 ES la promesa al colaborador, I8 la del accionista), que es la señal de que la estructura nueva es la suya y no una nuestra. Se retiran I12 e I13 (las del adversario): única pérdida, anotada como decisión. Y la evidencia del módulo 11 no se tiró con la clase: el caso TEXX se recolgó de 6.3. Falta el PDF de feedback maestro que Mau manda el domingo 17/08 con las preguntas nuevas.",
    ],
    commits: [
      { sha: "bbc7b42a", msg: "El feedback de Mau sobre el programa, y por qué NO se aplicó todavía", lineas: 126, archivos: 2 },
      { sha: "fcf1750a", msg: "Aplicados los cambios del programa que pidió Mau el 12/08", lineas: 144, archivos: 3 },
    ],
  },
  {
    fecha: "17 ago", hora: "00:14", chat: "CURSOS", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "Replicar la pantalla del origen: un div de diferencia dejaba fuera 593 de 598 reglas de CSS",
    puntos: [
      "AvatarHype dejó de verse como una grilla del portal y pasa a verse como en AvatarHype: se replicó su pantalla (documentos, prompts, imágenes y clips, 13 recursos migrados del curso viejo) importando el CSS del origen rescopeado. Después vinieron ocho rondas de arreglos sobre esa réplica: la URL, la transcripción, los recursos, el ancho, la barra lateral, el scroll y el flash de contenido crudo.",
      "El componente montaba `.ahdoc > .ugc-shell` y el origen es `.ugc > .ugc-shell`: 593 de 598 reglas no matcheaban nada — la pantalla salía con las portadas apiladas y el texto crudo, y el diagnóstico obvio («el CSS no cargó») era el equivocado. Con eso apareció el segundo: las variables de fuente (440 referencias) viven en clases `__variable_*` que el origen pone en el MISMO div, y el rescopeo las dejó apuntando a un elemento inexistente, así que todas resolvían vacío y caía a la fuente de sistema. Tres más que se repiten: la vista vivía en useState, así que un F5 devolvía a la grilla y un link compartido perdía el curso (ahora viaja en el hash, porque la vista se monta dentro de dos rutas distintas); la barra horizontal la metí yo con `100vw`, que incluye el ancho de la barra VERTICAL; y una conversión de codificación destruyó las flechas unicode de 3 bytes sin que el typecheck ni los tests las vieran, porque el editor las muestra bien y COMPILA.",
    ],
    commits: [
      { sha: "a42b68ce", msg: "El AvatarHype viejo sale de la grilla, y sus 13 recursos se mudan al nuevo", lineas: 823, archivos: 2 },
      { sha: "b417a0bd", msg: "Los módulos tenían por nombre su número, y el portal repetía el conteo", lineas: 102, archivos: 4 },
      { sha: "104cc7c2", msg: "AvatarHype con los módulos que se llaman como se llaman", lineas: 144, archivos: 2 },
      { sha: "ed058799", msg: "El curso de AvatarHype replicado: documentos, prompts, imágenes y clips", lineas: 1288, archivos: 93 },
      { sha: "40852f52", msg: "AvatarHype se ve como en AvatarHype: su pantalla, no la grilla del portal", lineas: 416, archivos: 35 },
      { sha: "17a1d987", msg: "Faltaba el contenedor .ugc: 593 reglas de 598 no matcheaban", lineas: 46, archivos: 3 },
      { sha: "7db3c3c4", msg: "Portadas de módulo por su número real, fondo de papel, y el video con su alto", lineas: 113, archivos: 3 },
      { sha: "9580959f", msg: "El texto ilegible era codificacion rota, y la barra tapaba por un margen del origen", lineas: 143, archivos: 3 },
      { sha: "f1a4f02a", msg: "Los seis defectos de la replica: URL, transcripcion, recursos, flechas, botones y ancho", lineas: 225, archivos: 3 },
      { sha: "d820646c", msg: "El curso sale de la caja: pegado al papel, sidebar al borde y clases en grilla", lineas: 65, archivos: 3 },
      { sha: "28e35010", msg: "Fuera el scroll horizontal, el fondo se ve, y el indice deja de contradecir a la barra", lineas: 56, archivos: 3 },
      { sha: "d4b2d1aa", msg: "La barra horizontal se mata en el documento, no peleando con el ancho", lineas: 32, archivos: 3 },
      { sha: "2ea1bc72", msg: "La barra marcaba dos lugares a la vez, y ninguno adentro de una clase", lineas: 14, archivos: 1 },
      { sha: "361ef504", msg: "La barra no llegaba arriba porque algo la empujaba, no porque le faltara alto", lineas: 44, archivos: 3 },
      { sha: "1041d512", msg: "Habia 4 segundos de curso crudo antes de que llegara el CSS", lineas: 35, archivos: 1 },
      { sha: "6e2e9c25", msg: "Tres cosas que aparecieron al hacer que scrollee el contenido y no la pagina", lineas: 87, archivos: 4 },
    ],
  },
  {
    fecha: "5 oct", hora: "03:07", chat: "Customer Success", cuenta: "claude2",
    actor: "martin", tipo: "prompt",
    titulo: "El kanban de la ENTREGA de un servicio, y TODO por producto",
    pedido: "si un CLIENTE actual llega a X etapa de mi SERVICIO (onboarding, hito 1, hito 2, o lo que sea que el usuario configure en su entrega de servicio\u2026). Todo por producto, siempre, justamente pueden tener muchos productos, por eso la instruccion es que repliques todo lo que creamos en el CRM",
    puntos: [
      "Es el pedido que funda la tab: las columnas son las etapas de la entrega de UN servicio y las tarjetas son los clientes. \u00abTodo por producto\u00bb es lo que decide el modelo entero \u2014 un cliente que compro la mentoria Y el servicio mensual aparece en los dos tableros, en la etapa que le toca en cada uno.",
      "\u26a0\ufe0f Y lo que hubo que MEDIR para no equivocarse: la entrega NO es otro embudo del mismo producto. Era la hipotesis barata y esta medida como falsa \u2014 `leads.funnel_id` es UNA columna, un cliente ES un lead ganado, y las dos etapas son SIMULTANEAS (el mismo cliente es `ganado` en ventas y `hito2` en entrega al mismo tiempo), asi que meterlo en un embudo de entrega lo sacaria del tablero del CRM donde esta ganado. Y `leads.producto_id` tampoco sirve: es el producto con el que se CERRO, y es uno, y el pedido dice N.",
    ],
  },
  {
    fecha: "5 oct", hora: "04:42", chat: "Customer Success", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "La capa de datos: un choke point de escritura, y lo que una FK en cascada envejecio sin que nadie la tocara",
    puntos: [
      "La mig 0188 trae `producto_entrega` (el catalogo de columnas de cada producto) y `cliente_entrega` (en que etapa esta cada cliente en cada producto), y TODA escritura pasa por `moverClienteDeEtapa` (`lib/cs-mover-etapa.ts`). El CRM no tenia un choke point para copiar \u2014 alla la etapa se DERIVA y el historial se audita por DIFF, y `app/crm/mover-etapa.ts`, que por su nombre parecia el camino de escritura, tiene 24 lineas.",
      "\u26a0\ufe0f UN MOVIMIENTO IDEMPOTENTE QUE IGUAL ESCRIBE MIENTE SOBRE EL TIEMPO: pisar la fila resetea `etapa_desde`, o sea que un segundo click convierte un cliente trabado hace tres semanas en uno que acaba de llegar. Sale temprano antes de escribir.",
      "\u26a0\ufe0f Y LA MITAD QUE UNA MIGRACION ENVEJECE SIN TOCARLA: `cliente_entrega.producto_id` es `on delete cascade`, asi que desde la 0188 borrar un producto se lleva la etapa de entrega de CADA cliente \u2014 y el resumen que una persona lee antes de confirmar `borrar_producto` seguia diciendo solo \u00abBorrar el producto X. No se puede deshacer\u00bb: verdadero y a la mitad. Al agregar una FK en cascada hay que grepear quien borra la fila PADRE y leer lo que esa pantalla le promete a quien confirma. El contador devuelve `number | null` y no reusa un `[]`: un \u00ab0 clientes\u00bb sobre una consulta caida es la afirmacion que hace apretar el boton.",
    ],
    commits: [
      { sha: "cc15ad24", msg: "Entrega de servicio: el catalogo por producto y el choke point del kanban de CS", lineas: 1132, archivos: 10 },
      { sha: "1e668734", msg: "Las secuencias de la ENTREGA: evento propio, ambito por PRODUCTO", lineas: 302, archivos: 10 },
      { sha: "00e6a079", msg: "El kanban de la ENTREGA en /customer-success: por producto, con su editor de etapas", lineas: 1348, archivos: 13 },
      { sha: "9a842cbb", msg: "La cabecera del choke point de entrega dice lo que ES, no lo que faltaba", lineas: 56, archivos: 1 },
      { sha: "446ef9b5", msg: "Salir de una etapa de entrega CIERRA lo que esa etapa tenia agendado", lineas: 121, archivos: 3 },
      { sha: "478090c6", msg: "Borrar un producto AVISA cuantos clientes pierden su etapa de entrega", lineas: 96, archivos: 4 },
      { sha: "e9e8609b", msg: "Borrar una etapa avisa tambien las SECUENCIAS que quedan sin disparador", lineas: 5363, archivos: 6 },
    ],
    archivos: [
      "supabase/migrations/0188_entrega_servicio.sql \u2014 las dos tablas, con el porque de que la entrega NO sea otro embudo en la cabecera",
      "lib/servicio-etapas.ts \u2014 el catalogo PURO (sin `server-only`, para que la pantalla lo importe y los tests lo ejecuten)",
      "lib/cs-mover-etapa.ts \u2014 el UNICO camino de escritura de `cliente_entrega`",
      "lib/entrega-servicio.ts \u2014 las lecturas del server",
    ],
  },
  {
    fecha: "5 oct", hora: "09:06", chat: "Customer Success", cuenta: "claude2",
    actor: "martin", tipo: "prompt",
    titulo: "Fuera la vista de Tarjetas: el kanban es la de por defecto",
    pedido: "No quiero que exista la vista de \u2018Tarjetas\u2019 es la vista de kanban por default y la otra es la vista de tabla. Solo que dentro del kanban, las tarjetas no son como las del CRM, son como las nuevas que hicimos, de clientes.",
    puntos: [
      "\u26a0\ufe0f LA TARJETA NO SE BORRO, CAMBIO DE LUGAR \u2014 y ahi estaba el problema: la hoja de estilos viajaba con la GRILLA y no con la tarjeta, asi que dibujarla adentro de una columna la deja sin banda, sin bordes y sin pie. No es un error: es una tarjeta mal hecha. Se extrajo `EstilosTarjeta` y se monta a nivel de PANTALLA, asi la vista de tabla tambien conserva su `.cl-nada`.",
      "Mas lo que solo se contesta midiendo en el navegador: el `dragstart` SI burbujea desde el boton invisible que cubre la tarjeta, pero el cursor NO (sale `pointer`), y todo el contenido tiene `pointer-events: none` salvo la fila de acciones \u2014 un control extra dibujado en cualquier otro lado se ve y no se puede apretar. Y esa fila es `nowrap`: en una columna 44 px mas angosta que la grilla y con un cuarto boton desborda una tarjeta con `overflow: hidden`, o sea que el ultimo control DESAPARECE sin dejar rastro.",
    ],
    commits: [
      { sha: "60edd6ea", msg: "La vista de Tarjetas se va: kanban por default, y la tarjeta de cliente adentro", lineas: 557, archivos: 7 },
    ],
  },
  {
    fecha: "5 oct", hora: "10:03", chat: "Customer Success", cuenta: "claude2",
    actor: "martin", tipo: "prompt",
    titulo: "Los diez puntos de diseno del kanban",
    pedido: "Muchas cosas mal en diseno\u2026 1. Elimina \u20180 de 14 clientes en esta entrega\u2019 2. Elimina \u2018Etapas de ejemplo. Define las tuyas\u2019. 3. Elimina ese boton de al lado de \u2018nuevo cliente\u2019 para eso justamente ya hay un boton de nuevo cliente en cada columna\u2026 Deberia haberlo. 4. Elimina el texto de \u2018Servicio\u2019 5. El desplegable de productos se deberia ver exactamente igual como este\u2026 Y siempre que se crea un nuevo producto en el CRM debe aparecer aca. Y viceversa, si creo un nuevo producto aca, debe aparecer en el CRM\u2026 6. Copia el estilo de las columnas\u2026 Que no sean transparentes. 7. Pon a todos los leads en la primera columna, los de Mauricio\u2026 No puede ser que yo vea muchos leads en la vista de tabla y luego no vea nada en la vista de kanban\u2026 Jamas puede ser eso. 8. Recuerda la animacion de arrastrar tarjetas por el kanban, eso replicalo tal cual de como lo hacemos en PLAN, de mover tarjetas. 9. El boton de filtro va luego de la barra de busqueda. Y los iconos de kanban y tabla, antes de la barra de busqueda. 10. Toda la topbar, donde esta la barra de busqueda, etc\u2026 va al mismo ancho que el kanban, no se queda agrupado en el medio. Ocupa casi todo el ancho.",
    puntos: [
      "\u26a0\ufe0f \u00abQUE NO SEAN TRANSPARENTES\u00bb NO ERA TRANSPARENCIA, ERA CONTRASTE CERO. Las columnas tenian fondo \u2014 `--surface-2`, que en el tema claro por defecto es #F5F7FA sobre un `--bg` de #F4F6F9: UNA unidad por canal. Tenian fondo, y era el mismo fondo de la pagina. Y solo pasa en el claro: en oscuro y en true-north los dos tokens si se distinguen, asi que nadie que probara en otro tema lo habria visto. Se da vuelta el par como en el CRM (columna `--surface`, tarjeta `--surface-2`), con la linea de arriba sacada de `dot` y NO de la banda \u2014 la banda son tres colores y pintaria las cinco columnas del mismo verde.",
      "\u26a0\ufe0f LA TABLA MOSTRABA 14 CLIENTES Y EL KANBAN NINGUNO, y era un bug de modelo: el tablero solo dibujaba a quien tuviera fila en `cliente_entrega`, y nadie la tenia. Ahora UN CLIENTE SIN FILA ESTA EN LA PRIMERA ETAPA, derivado y no sembrado \u2014 un backfill habria arreglado a los catorce de hoy y dejado al decimoquinto afuera. Y eso le dio un sentido exacto a algo que habia quedado sin ninguno: `sacarEntrega` es el DESHACER DEL PRIMER MOVIMIENTO, porque lo contrario de mover a alguien que nunca se movio no es moverlo a la primera (seria escribirle una fila con un reloj arrancando hoy) sino borrar la que acaba de nacer.",
      "EL ARRASTRE NO SE REPLICA: SE IMPORTA. El nucleo del Plan ya estaba extraido adentro de `BoardShell.tsx` y ninguno de sus tres helpers estaba exportado. Salieron a `app/plan/board/arrastre-copia.ts` y ahora las dos pantallas usan la misma pieza. Al leer el molde aparecieron TRES contradicciones del kanban \u2014 le pintaba un anillo al nodo origen (el Plan no le hace NADA, y esta medido: con la copia siguiendo al cursor y el hueco marcando el destino, atenuar el original hace aparecer la misma tarjeta tres veces), forzaba el fondo de la copia en vez de leer el computado, y le faltaba el `rotate(1.5deg)`. Y lo que de verdad faltaba era EL HUECO.",
      "\u26a0\ufe0f \u00abIGUAL QUE EL DESPLEGABLE DEL CRM\u00bb ERA EL PRIMITIVE, NO EL COMPONENTE: el de la captura es el `Dropdown` del repo, que ya trae el lapiz por renglon, el \u00ab+ Nuevo producto\u00bb y el renglon gris. Lo que NO se pudo importar es el `SelectorFunnel`: elige un EMBUDO y su `value` es `funnels.id`, asi que copiarlo habria traido el id equivocado. Y \u00absi creo un producto aca debe aparecer en el CRM\u00bb NO sale con `upsertProducto`: el desplegable del CRM lista EMBUDOS, asi que hace falta la cadena entera (producto \u2192 oferta_productos \u2192 oferta \u2192 funnel_ofertas \u2192 funnel, con el funnel naciendo CON sus etapas). El sentido inverso no necesitaba nada.",
      "\u26a0\ufe0f Y DOS TRAMPAS DE TIMING DE REACT, las dos encontradas ARRASTRANDO en el navegador: la decision de un arrastre no puede colgar de un `useState` \u2014 el primer `dragover` lee `null`, no llama a `preventDefault()` y el `drop` NO SE DISPARA NUNCA, sin un solo error; y el callback de \u00abDeshacer\u00bb de un toast corre con el estado de SU render, asi que una guarda de idempotencia adentro de la funcion que vuelve a llamar lo mata en silencio (el cartel se cierra y la tarjeta no vuelve).",
    ],
    commits: [
      { sha: "0f156de5", msg: "El kanban se ve como el del CRM y se arrastra como el del Plan", lineas: 1215, archivos: 11 },
    ],
  },
  {
    fecha: "5 oct", hora: "11:13", chat: "Customer Success", cuenta: "claude2",
    actor: "martin", tipo: "prompt",
    titulo: "Las FASES, el scroll de la tab y el editor con el diseno del CRM",
    pedido: "1. La tab NO tiene que tener scroll, las columnas tienen su scroll propio. La tab si debe tener scroll de izquierda a derecha. 2. Dile al chat que esta trabajando el CRM que: 1. Elimine la tab de \u2018Pendientes\u2019 y que todos los pendientes aparezcan abajo, en el desplegable que dice \u2018MaKo movio 3 leads\u2019\u2026 Que se fije si debe cambiar el titulo del desplegable. 2. Que en lugar que diga \u2018Kanban\u2019 y \u2018Tabla\u2019, que sean los iconos que vos usaste. 3. Que replique la animacion del PLAN al arrastrar tarjetas, tal vez puedes indicarle como es, o como replicarlo, para que no tenga que lanzar un multi agente y mapear eso\u2026 3. El boton de filtrar que si tenga el texto \u2018Filtrar\u2019. 4. Fijate que en el CRM los colores de las columnas son 3, porque alli hay \u2018Activo, nutricion o descartado\u2019\u2026 Y esas 3 categorias engloban varias columnas/etapas\u2026 Seria bueno duplicar eso aqui. Que al crear columnas tambien se puedan crear FASES\u2026 Entonces dentro de una fase pueden haber varias etapas (columnas), y que se le ponga el color a esa fase y que sus columnas adopten eso. Eso te permite traer los botones similares del CRM para solo ver las columnas de esa fase. Esto sirve, porque por ejemplo, en todo programa existen \u2018fases\u2019, por ejemplo, Fase 1: \u2018Cimientos\u2019 y dentro estan las etapas\u2026 5. No pongas el texto \u2018Sin clientes.\u2019 6. Dentro del editable del producto, no pongas el texto \u2018Son las columnas del tablero de este servicio. El cliente entra por la primera.\u2019 y tampoco pongas divisores. Copia el diseno del CRM que te adjunto, para agregar una etapa hay un boton como el que se ve\u2026 Y no existe el boton de \u2018No cambiar nada\u2019 o el de guardar\u2026 Se guarda automaticamente\u2026",
    puntos: [
      "LAS FASES, con el color decidido en UNA funcion. `colorDeEtapa(e, fases)` devuelve el color de la fase si la etapa tiene una y el propio si no, y el propio NO se pisa al asignarla: sacar una etapa de su fase le devuelve el suyo, y una que apunta a una fase BORRADA cae a su color propio por la misma linea. Leyendo `e.dot` en la pantalla \u2014que es lo que habia\u2014 las cinco columnas de una fase salen de cinco colores distintos: AGRUPAR NO SE VE, que es lo unico que las fases vienen a mostrar. La clave lleva prefijo `f_` porque una fase y una etapa pueden llamarse igual (\u00abCimientos\u00bb las dos) y sin el compartirian clave.",
      "\u26a0\ufe0f EL FILTRO POR FASE ES DEL RENDER, NUNCA DEL REPARTO. Pasarle a `repartirEnEtapas` las columnas ya filtradas por el chip manda a todos los clientes de las escondidas a HUERFANOS, y el pie del tablero anuncia \u00ab12 clientes estan en una etapa que ya no existe\u00bb \u2014 falso, plausible, y producido por mirar una fase. Y las fases viajan en el MISMO upsert que las etapas, SIN default en la firma: el `data` se reemplaza entero, asi que olvidarselas es BORRARLAS.",
      "EL SCROLL: el recorte vive en la COLUMNA (`max-height: 68vh`, el mismo numero que el tablero del CRM) y no en la pagina, porque un alto en vh es un numero cerrado mientras que `height: 100%` contra un padre de alto indefinido resuelve CERO en Safari \u2014 y con un overflow hidden encima, cero es una pantalla en blanco. El min-height en 0 del cuerpo no es decorativo: sin el, un hijo flex no baja de su alto de contenido y el overflow no recorta nada. \u26a0\ufe0f Y DESDE QUE LA COLUMNA SCROLLEA, EL ARRASTRE NECESITA SU PROPIO EMPUJE VERTICAL: `scrollerDe` resuelve el scroller UNA vez, en el `dragstart`, con la tarjeta de ORIGEN, asi que empujaria la columna de la que salio y no la que esta bajo el cursor \u2014 y `empujarScroll` estaba destructurado SIN llamarse: la capacidad escrita, el gesto muerto y el typecheck en verde.",
      "EL EDITOR, SIN BOTON DE GUARDAR, mueve el aviso AL CLICK: guardando solo no hay donde frenar despues, asi que la consecuencia va pegada a la \u2715 y ANTES, con las dos separadas (un cliente sin columna se puede volver a mover y el tablero lo lista aparte; una secuencia sin etapa deja de dispararse y no se ve en ningun lado). Y NO SE GUARDA AL MONTAR, porque ese upsert marca el servicio como DECLARADO: sin la guarda, abrir el editor y cerrarlo convierte el default en una configuracion que nadie escribio.",
      "\u26a0\ufe0f EL CONTEO DEL EDITOR CONTABA FILAS, NO CLIENTES \u2014 lo encontro el navegador, no el codigo. Decia 0 en la primera columna mientras el tablero dibujaba 5 tarjetas ahi, las dos pantallas con la MISMA funcion y el mismo overlay. Se le pasaban las FILAS de `cliente_entrega` y no los CLIENTES, y \u00abun cliente sin fila esta en la primera etapa\u00bb es una regla DERIVADA: a quien no aparece en la lista no hay de donde derivarsela. No es cosmetico \u2014 ese numero es lo unico que hace que sacar una columna sea una decision, asi que con el 0 puesto el \u00ab\u00bfseguro?\u00bb NO SE DISPARA y la columna se va con cinco clientes adentro, en silencio. La regla general quedo en AGENTS.md.",
      "Y dos trampas del propio guard: los asserts de \u00abesto NO esta\u00bb fallaron TRES veces encontrando lo que el archivo dice DE SI (el comentario que explica que el texto se fue, el que cita el pedido), asi que se busca sobre el texto SIN comentarios y con las lineas antes que los bloques; y el mismo archivo pago DOS VECES el backtick adentro del template de estilos, con el typecheck senalando lineas que no tenian nada que ver.",
    ],
    commits: [
      { sha: "50a2a672", msg: "Las etapas de la entrega se agrupan en FASES, y el editor guarda solo", lineas: 1535, archivos: 13 },
    ],
    archivos: [
      "app/customer-success/KanbanEntrega.tsx \u2014 el tablero, los chips de fase y los dos empujes del arrastre",
      "app/customer-success/EtapasEntregaModal.tsx \u2014 el editor con el molde del CRM y guardado automatico",
      "tests/cs-kanban-fases.test.ts \u2014 los 11 guards de cableado, cada uno probado rompiendolo (9/1)",
      "docs/hallazgos-customer-success.md \u2014 la cosecha de las dos tandas del 5/10",
    ],
  },
  {
    fecha: "5 oct", hora: "16:01", chat: "Customer Success", cuenta: "claude1",
    actor: "martin", tipo: "prompt",
    titulo: "Acciones en lote, la tabla del Plan y el editor del CRM",
    pedido: "1. Tiene que cambiar la animaci\u00f3n de mover tarjetas si estoy en la vista de tabla deber\u00eda poder moverse tambi\u00e9n, ya tenemos animaci\u00f3n de eso en el plan...\n2. El \u00edcono de kanban deber\u00eda ser como en el plan, que son cubos. Y el placeholder deber\u00eda ser \"Ven en Kanban\".\n3. Tambi\u00e9n revisa el dise\u00f1o de la tabla, que se parezca m\u00e1s a como lo tenemos en el plan. Con acciones \u00fatiles. Y aplica lo que te ped\u00ed de mover filas, ya tenemos esa animaci\u00f3n.\nMuy importante que implementes las acciones en LOTE, tanto para la vista de tablas como kanban... Copia todo del plan. Y piensa que acciones en lote valdr\u00eda la pena.\n4. En la vista de tabla siempre deber\u00eda estar el desplegable de los productos, porque desaparece.\n5. Revisa el desplegable de productos, haz puesto otros que no existen, eliminalos... En el CRM de Mauricio, solo hay esos 2.\n6. En el editable, agregar fase deber\u00eda estar arriba del todo, no abajo. Y tal como en el editable del CRM, deber\u00eda poder cambiar el nombre del producto, y se debe cambiar en todos lados, en el CRM y aqu\u00ed. Y viceversa, si lo cambio en el CRM debe aparecer aqu\u00ed.\n7. Fijate el dise\u00f1o de ese editable en el CRM y copialo tal cual. El tama\u00f1o del contenedor, los botones, etc...\n8. Tu que conoces al 100% el servicio de Mauricio, con las fases y etapas, modifica al 100% el producto de Negocio que Escala con la info que tienes.",
    puntos: [
      "\u26a0\ufe0f ELIMINAR UN PRODUCTO EN EL CRM NO LO DESACTIVA: archiva su embudo (`funnels.activo = false`) y el producto sigue con `activo = true`, as\u00ed que el selector, leyendo la tabla de productos, ofrec\u00eda lo que el CRM ya hab\u00eda borrado. La regla obvia \u2014s\u00f3lo productos con embudo\u2014 era la equivocada: el ws13 tiene tres productos sin embudo y una entrega REAL sobre uno. Se ofrece todo producto activo que no est\u00e9 atado \u00daNICAMENTE a embudos archivados.",
      "RENOMBRAR EN LOS DOS LADOS NO NECESITABA SINCRONIZAR NADA: las dos pantallas leen `productos.nombre`, y `renombrarFunnel` ya lo escribe cuando el embudo tiene producto principal. Customer Success pasa por esa misma funci\u00f3n; el otro sentido andaba solo.",
      "EL LOTE ES UNA LLAMADA Y UN DESHACER. Mover a, Siguiente etapa, Exportar y Seleccionar todos, en kanban y tabla con la selecci\u00f3n compartida. Para quien nunca se movi\u00f3, deshacer es BORRAR su fila: escribirle la primera etapa arrancar\u00eda hoy el reloj de \u00aben la etapa\u00bb.",
      "\u26a0\ufe0f EL EDITOR TEN\u00cdA CUATRO BUGS QUE EL DEL CRM PROBABLEMENTE COMPARTE: una guarda de primer render que Strict Mode saltea (abrir guardaba y marcaba el servicio como DECLARADO), el Escape que `Modal` se come en captura antes de llegar al campo, el nombre perdido al cerrar dentro del respiro, y la primera etapa que se pod\u00eda mover y mandaba en silencio a los clientes sin fila a otra columna. El del CRM no se midi\u00f3.",
      "Y DOS QUE S\u00d3LO SE VIERON EN EL NAVEGADOR: la casilla del kanban era una franja blanca porque `.ke-card > *` le daba el ancho de la tarjeta (un `> *` es una regla sobre los hijos que todav\u00eda no existen), y el l\u00e1piz del desplegable dejaba el men\u00fa flotando ENCIMA del editor (flag `cierra` en el primitive).",
      "NEGOCIO QUE ESCALA qued\u00f3 con 9 etapas en 5 fases (Inicio, Contexto y Norte, Criterio y Palancas, Tablero y Ritmo, Cierre), escritas en producci\u00f3n con respaldo. Los 14 clientes quedan en Bienvenida: su etapa real no se adivin\u00f3.",
    ],
    commits: [
      { sha: "42d91a41", msg: "Customer Success: acciones en lote, la tabla del Plan y el editor del CRM", lineas: 3283, archivos: 16 },
    ],
    archivos: [
      "app/customer-success/LoteClientes.tsx \u2014 la barra de acciones en lote, copia declarada de la del Plan",
      "app/customer-success/TablaClientes.tsx \u2014 la tabla agrupada por etapa, con el arrastre de filas del Plan",
      "app/customer-success/EtapasEntregaModal.tsx \u2014 el editor con el molde del CRM: t\u00edtulo que renombra, fases arriba, eliminar",
      "app/customer-success/entrega.ts \u2014 productosOfrecibles: lo que el CRM elimin\u00f3 no se ofrece",
      "app/components/Dropdown.tsx \u2014 DropdownAccion.cierra",
      "docs/hallazgos-customer-success.md \u2014 la cosecha de esta tanda",
    ],
  },
  {
    fecha: "5 oct", hora: "16:30", chat: "Customer Success", cuenta: "claude1",
    actor: "martin", tipo: "prompt",
    titulo: "Verificar lo que integr\u00f3 el workflow de la tabla, el lote y el editor",
    pedido: "Revis\u00e1 el estado del workflow wwocfwu5a (cs-tabla-lote-editor) y segu\u00ed con la integraci\u00f3n y verificaci\u00f3n de Customer Success.",
    puntos: [
      "EL WORKFLOW HAB\u00cdA TERMINADO ENTERO, y los siete pedidos que sus tres agentes dejaron \u00abpara el orquestador\u00bb ya estaban enchufados en 42d91a41. Lo que faltaba era lo que ninguno pudo hacer: probarlo en el navegador. Se hizo con las escrituras bloqueadas, leyendo el cuerpo de cada POST.",
      "\u26a0\ufe0f EL DESHACER RESETEABA EL RELOJ DE LA ETAPA, y la pantalla lo tapaba. Para el choke point un deshacer es un movimiento m\u00e1s y escribe `etapa_desde = ahora`: un cliente en rojo por 21 d\u00edas, arrastrado por error y devuelto con el toast, quedaba en la base como reci\u00e9n llegado. La pantalla restauraba la fila vieja, as\u00ed que el chip segu\u00eda rojo hasta el F5. Lo encontr\u00f3 leer el c\u00f3digo buscando qu\u00e9 estado arrastra el movimiento, no el navegador.",
      "LA MISMA PREGUNTA TEN\u00cdA DOS MEN\u00daS: \u00abMover a\u00bb de la barra en 500 px con la \u00faltima etapa cortada, y el chip de la tabla con la fase repetida en cada rengl\u00f3n y cinco de nueve a la vista. Ahora es uno. Los 500 px los pone el primitive a todo `columns`, tambi\u00e9n con una sola columna, y el tope de alto fijo no miraba d\u00f3nde abre el men\u00fa (se sal\u00eda 32 px de la ventana).",
      "Y TRES TRAMPAS DEL ARN\u00c9S que se leen como bugs: `dragTo` de Playwright no prueba un arrastre en lote (a mano, en pasos, mand\u00f3 los dos clientes), `getByRole` busca por el `aria-label` y no por el texto, y una opci\u00f3n con subt\u00edtulo no matchea su r\u00f3tulo exacto.",
    ],
    commits: [
      { sha: "9b5a4c9b", msg: "Customer Success: el deshacer devuelve el reloj de la etapa, y un solo menú de etapas", lineas: 302, archivos: 13 },
    ],
    archivos: [
      "lib/servicio-etapas.ts \u2014 relojDeVuelta: el reloj que vuelve con un deshacer, validado",
      "lib/cs-mover-etapa.ts \u2014 el choke point escribe el reloj previo si viene",
      "app/components/Dropdown.tsx \u2014 alContenido: una columna del ancho de su contenido, topeada por la ventana",
      "tests/cs-deshacer-reloj.test.ts \u2014 7 tests, cada pieza probada rompi\u00e9ndola",
      "docs/hallazgos-customer-success.md \u2014 la cosecha de esta pasada",
    ],
  },
  {
    fecha: "5 oct", hora: "18:17", chat: "Customer Success", cuenta: "claude1",
    actor: "martin", tipo: "prompt",
    titulo: "El modal de \u00abAbrir cuenta\u00bb debajo de la tarjeta de al lado",
    pedido: "Soluciona ese bug",
    puntos: [
      "Pedido con una captura sobre C\u00f3digo Inmobiliario: al abrir \u00abAbrir cuenta\u00bb en una tarjeta, la tarjeta de la columna siguiente se pintaba ENCIMA del modal.",
      "\u26a0\ufe0f DOS COSAS CORRECTAS POR SEPARADO: `Modal` no se portalea y `TarjetaEntidad` le da z-index 1 a cada hijo de la tarjeta, as\u00ed que un modal montado desde la fila de acciones queda atrapado en esa tarjeta. Lo dej\u00f3 pasar que el control se MUD\u00d3 de la ficha (donde no se ve) a la tarjeta, el 27/09.",
      "El portal no alcanza solo: los eventos sint\u00e9ticos suben por el \u00e1rbol de React, y arrastrar texto en el email del modal agarraba la tarjeta. El arrastre ignora lo que no naci\u00f3 adentro de ella en el DOM.",
    ],
    commits: [
      { sha: "a9d4471c", msg: "El modal de «Abrir cuenta» deja de quedar debajo de la tarjeta de al lado", lineas: 68, archivos: 5 },
    ],
    archivos: [
      "app/customer-success/CuentaDeMaKo.tsx \u2014 el modal va por portal al body",
      "app/customer-success/KanbanEntrega.tsx \u2014 agarrar ignora gestos que no nacieron en la tarjeta",
      "tests/cs-kanban-fases.test.ts \u2014 el guard, probado rompi\u00e9ndolo",
    ],
  },
  {
    fecha: "5 oct", hora: "23:27", chat: "Customer Success", cuenta: "claude1",
    actor: "martin", tipo: "prompt",
    titulo: "La casilla del CRM, las fases al filtro, el editor y la ficha por pesta\u00f1as",
    pedido: "1. Quiero que copies la animaci\u00f3n de aparici\u00f3n del checkbox para la selecci\u00f3n de multiples tarjetas que hizo el CRM. Es una animaci\u00f3n que aparece detr\u00e1s del t\u00edtulo y que se desplaza el t\u00edtulo cuando paso el cursor.\n2. Como terminaron siendo muchas fases, es mejor que lo pongas como un filtro directamente, porque no queda bien que est\u00e9n todos esos botones.\n3. No me gusta el dise\u00f1o de las fases y las etapas... Es muy confuso, vuelve a dise\u00f1arlo, hazlo de la mejor manera que te parezca pero que sea simple de entender, minimalista.\n4. En el detail de un cliente, la tab de \"Equipo\" y en general todo lo que tenga que ver con invitar a MaKo, deber\u00eda solo verse si la cuenta es AGENCIA, sino, no deber\u00edan estar esas opciones.\n5. Se me ocurre agregar una tab de \"Resumen\" antes de \"Prioridades\", que contenga los datos m\u00e1s importantes del cliente... Un apartado de \"Notas\" para que el usuario pueda escribir lo que quiera sobre ese cliente. Y tal vez otra tab con las llamadas de fathom que se tuvo con ese cliente... Qu\u00e9 otras cosas piensas que ser\u00edan importantes ver en un detail de Customer Success?... Tal vez pienso que para que no sea tan confuso y copiar toda la tab de PLAN en el detail, dejar solo la secci\u00f3n de \"PRIORIDADES\" y Tareas, Proyectos y Recurrentes que se vean en la tab de Plan, y que haya un bot\u00f3n que te redirija con el filtro ya puesto para ver solo las tareas o proyectos de ese cliente...\n6. Te pas\u00f3 lo mismo que al CRM, si intento desplazar una tarjeta... Es: \"Tambi\u00e9n revisa el desplazamiento de la tarjeta, si lo muevo muy al costado, se sale del contenedor del kanaban y deja de desplazar, eso no debe pasar, porque es incomodo, si desplazo muy al costado a\u00fan debe seguir funcionando el scroll\"",
    puntos: [
      "CUATRO AGENTES SOBRE ARCHIVOS SEPARADOS (kanban, editor, ficha, Plan) y la integraci\u00f3n a mano. Lo que cruzaba de un \u00e1rea a otra lo enchuf\u00f3 el orquestador: el bot\u00f3n \u00abVer en el Plan\u00bb usa la URL que arma el tablero (`hrefPlanDeCliente`) y no una copia del nombre del par\u00e1metro, y aterriza en Tareas.",
      "\u26a0\ufe0f \u00abCLIENTE DESDE\u00bb Y EL FILTRO \u00abCU\u00c1NDO\u00bb LE\u00cdAN UN CAMPO QUE NADIE LLENABA. `lib/clientes-ganados.ts` seleccionaba `fecha_cierre` desde el 28/09 y nunca la mapeaba: el filtro dejaba 0 clientes en cualquier ventana durante una semana. El diagn\u00f3stico obvio (\u00abese cliente no tiene la fecha cargada\u00bb) era falso.",
      "LAS LLAMADAS DE LA ENTREGA NO EST\u00c1N EN `fathom_links` (s\u00f3lo R1/R2 de venta, sin fecha) sino en `closing_analyses`: la pesta\u00f1a une las dos fuentes. Y esconder \u00abEquipo\u00bb no proteg\u00eda nada: la p\u00e1gina le\u00eda el equipo de otro inquilino sin mirar si el workspace era agencia.",
      "LA FASE EN \u00abFILTRAR\u00bb DESTAP\u00d3 DOS DEFINICIONES DE \u00abSIN FASE\u00bb y un lote que mov\u00eda clientes de fases escondidas; ahora decide una funci\u00f3n y todo act\u00faa sobre lo que se ve. El editor guarda el ORDEN QUE SE VE, y la firma inicial pasa por el mismo orden o abrir una lista partida la guardaba.",
      "Coordinado con la sesi\u00f3n del Plan, que tocaba los mismos dos archivos: se commite\u00f3 s\u00f3lo la l\u00ednea gen\u00e9rica de `globals.css` y s\u00f3lo los hunks propios de `BoardShell.tsx`, con el \u00edndice y no con `git commit -- <rutas>` (que habr\u00eda subido la versi\u00f3n del \u00e1rbol con el trabajo ajeno).",
    ],
    commits: [
      { sha: "41566563", msg: "Customer Success: casilla del CRM, fases al filtro, editor nuevo y la ficha por pestañas", lineas: 4265, archivos: 30 },
    ],
    archivos: [
      "app/customer-success/KanbanEntrega.tsx \u2014 la casilla del CRM y el empuje del riel en document",
      "app/customer-success/BarraClientes.tsx \u2014 la fase dentro de \u00abFiltrar\u00bb (columnasVisibles)",
      "app/customer-success/EtapasEntregaModal.tsx \u2014 el editor redise\u00f1ado: una lista, el orden que se ve",
      "app/customer-success/FichaPestanas.tsx \u2014 Resumen y Llamadas de la ficha",
      "app/plan/board/filtro-cliente.ts \u2014 el filtro de cliente del Plan y ?cliente=",
      "lib/clientes-ganados.ts \u2014 fechaCierre, que se seleccionaba y no se mapeaba",
    ],
  },
  {
    fecha: "6 oct", hora: "02:25", chat: "Customer Success", cuenta: "claude1",
    actor: "martin", tipo: "prompt",
    titulo: "Clientes por producto, la ficha con las tabs del CRM y el editor por cajas",
    pedido: "1. No hagas que el editor sea totalmente blanco que parezca que est\u00e1n flotando las cosas, eso no se entiende... Yo lo que pienso es que las fases sean contenedores grandes, y que el bot\u00f3n de nueva fase sea como una fase arriba del todo, as\u00ed como hacemos lo de \"Nuevo proyecto\" que es como mas gris y opaco.\n2. La secci\u00f3n de \"Trabajo\" no deber\u00eda estar en el resumen, para eso ya est\u00e1 la secci\u00f3n de \"Prioridades\". Por lo tanto, en esa tab deber\u00eda estar el link al plan... Te pido que pongas ese bot\u00f3n de ver en el plan en el lugar donde est\u00e1 el bot\u00f3n de 3 puntos, que no deber\u00eda estar m\u00e1s, ya que no cumple funci\u00f3n all\u00ed. Y que la tab pase a llamarse \"Tareas\".\n3. Elimina la secci\u00f3n de \"Entrega\" y para eso, tal como est\u00e1 en el CRM, un desplegable con la etapa actual y que se pueda cambiar a otra etapa. Como tambi\u00e9n deber\u00eda aparecer el desplegable de productos, por si quiero poner a ese cliente en otro producto.\n4. Los datos que deben aparecer son esos 4 de la captura, menos direcci\u00f3n, con sus botones para poder ir al WhatsApp o copiar. Y Si eliminamos el WhatsApp OFICIAL, solo debe quedar 1 bot\u00f3n de WhatsApp. Y ser\u00eda bueno que siempre traigas la foto de perfil del cliente, buscala en WhatsApp y sino tiene, la foto del email... En lugar de \"Direcci\u00f3n\" pon \"Web\" eso tambi\u00e9n lo estoy cambiando en el CRM as\u00ed que esos datos van a salir de all\u00ed tambi\u00e9n.\n5. Ser\u00eda bueno que traigas la tab de Pagos directamente, como est\u00e1 en el CRM...\n6. Falta la tab de Historial, que es importante que se registre historial en los clientes de Customer Success.",
    puntos: [
      "\u26a0\ufe0f CADA TABLERO DIBUJABA A LA CARTERA ENTERA. \u00abPrueba\u00bb mostraba a los 14 clientes de Negocio que Escala en Bienvenida sin una sola fila: la regla \u00absin fila, primera etapa\u00bb nunca pregunt\u00f3 de qu\u00e9 producto era el cliente. Lo destap\u00f3 la respuesta de Mart\u00edn (\u00abun cliente puede estar en varios productos\u2026 en PRUEBA deber\u00eda estar vac\u00edo\u00bb). Ahora es de un producto si es su CASA (el embudo del CRM) o si tiene una fila ah\u00ed, aplicado UNA vez a kanban, tabla, \u00abN de M\u00bb y el conteo del editor.",
      "LA ETAPA DE LA FICHA NO PUEDE SER UNA FOTO DEL SERVER: un desplegable que mueve tiene que leer la asignaci\u00f3n con lo movido en la sesi\u00f3n, o despu\u00e9s de moverlo dice la etapa de antes. El desplegable de producto elige qu\u00e9 entrega se mira, no muda al cliente (al rev\u00e9s que el del CRM).",
      "RENOMBRAR AL CLIENTE DESDE SU FICHA NO DEJABA HISTORIAL: escrib\u00eda `leads` a pelo. Ahora pasa por `logLeadChanges`, el mismo de la ficha del CRM. Queda a medias que los movimientos de entrega firman \u00abCRM\u00bb y no a la persona.",
      "LA FOTO WHATSAPP \u2192 EMAIL NO SE PUEDE ENCADENAR CON `Marca`: su `onError` cae directo a las iniciales. Se prueba cada candidata con un `Image()` y se pasa s\u00f3lo la que carg\u00f3; el `<img>` lleva el `?ws=` a mano porque no pasa por el parche de fetch.",
      "El editor por cajas lo hizo un agente aparte (verificado en el navegador, 14 roturas probadas). La Web y el WhatsApp \u00fanico de la \u00abInformaci\u00f3n principal\u00bb los hizo la sesi\u00f3n del CRM en el mismo componente, que ac\u00e1 se reusa sin copiarlo.",
    ],
    commits: [
      { sha: "b7a72267", msg: "Customer Success: clientes por producto, la ficha con las tabs del CRM y el editor por cajas", lineas: 2048, archivos: 22 },
    ],
    archivos: [
      "app/customer-success/pertenencia.ts \u2014 de qu\u00e9 productos es cada cliente (casa o fila)",
      "app/customer-success/FichaEntrega.tsx \u2014 producto y etapa en la cabecera de la ficha",
      "app/customer-success/foto-cliente.ts \u2014 la foto de WhatsApp o del email, probada antes de dibujar",
      "app/customer-success/FichaPestanas.tsx \u2014 Resumen, Pagos e Historial con los componentes del CRM",
      "app/customer-success/EtapasEntregaModal.tsx \u2014 el editor con las fases como cajas",
      "app/plan/board/BoardShell.tsx \u2014 accionEnLugarDelMenu: \u00abVer en el Plan\u00bb en lugar del \u22ee",
    ],
  },
  {
    fecha: "6 oct", hora: "03:42", chat: "Customer Success", cuenta: "claude1",
    actor: "martin", tipo: "prompt",
    titulo: "Quitar de un producto, el orden manual y el hueco que sigue al cursor",
    pedido: "1. S\u00ed, agreg\u00e1 \u00abQuitar de este producto\u00bb, pero solo para los leads que est\u00e9n en m\u00e1s de 1 producto.\n2. Que el desplegable de etapas NO est\u00e9 dividido por las fases, que solo aparezcan las etapas.\n3. Que el apartado de NOTAS tenga el mismo tama\u00f1o que el recuadro de al lado.\n4. En el editor de etapas, al arrastrar, copia la misma animaci\u00f3n que tenemos en el CRM o ah\u00ed mismo en las tarjetas de clientes, ya que si lo estoy arrastrando se tiene que ver donde va a caer, eso lo tenemos en el CRM y en el PLAN. Tambi\u00e9n con las tarjetas, se ve al momento de pasar de una columna a otra, pero si a un cliente lo arrastro abajo de otro, no se ve esa animaci\u00f3n.",
    puntos: [
      "SACAR A UN CLIENTE DE SU CASA NO SE PUEDE HACER BORRANDO NADA: la casa (el embudo del CRM) se deriva. Va a una tabla aparte, `cliente_entrega_fuera` (mig 0196), y no a una columna de `cliente_entrega`, que cada lector entender\u00eda como \u00abest\u00e1 en esta etapa\u00bb. El server vuelve a contar los productos antes de quitar.",
      "\u26a0\ufe0f EL HUECO NO SEGU\u00cdA AL CURSOR A PROP\u00d3SITO: la columna no ten\u00eda orden, y seguir al cursor era prometer \u00abac\u00e1\u00bb y dejarla \u00aball\u00e1\u00bb. Para cumplir el pedido hubo que GUARDAR el orden; se pregunt\u00f3 y Mart\u00edn eligi\u00f3 \u00abSe guarda + \"Manual\"\u00bb (`cliente_entrega_orden`). El CRM dibuja el mismo hueco y no guarda la posici\u00f3n.",
      "SE GUARDA LA COLUMNA ENTERA CON UN VECINO (\u00abantes de Juan\u00bb), no un n\u00famero: con un buscador puesto, \u00abel tercero\u00bb de lo que se ve no es el tercero de la columna. Y \u00abManual\u00bb arranca solo si hay algo guardado, o el orden desaparec\u00eda en cada F5.",
      "UN HUECO QUE APARECE DEBAJO DEL CURSOR QUIETO SE COME EL DROP: en esa vuelta Chromium manda `dragenter` y no `dragover`. Lo midi\u00f3 el agente del editor (0 de 2 drops sin cancelar el `dragenter`); se arregl\u00f3 en el editor y en el kanban. El CRM y el Plan quedan sin revisar.",
      "Verificado el ciclo entero del orden en ws1 (soltar \u2192 queda \u2192 F5 \u2192 sigue, \u00abOrdenar: Manual\u00bb) y la fila de prueba se borr\u00f3 al terminar. \u00abQuitar\u00bb no se prob\u00f3 de punta a punta: el Cliente de Prueba no tiene clientes.",
    ],
    commits: [
      { sha: "d9ee19cd", msg: "Customer Success: quitar de un producto, orden manual y el hueco que sigue al cursor", lineas: 1713, archivos: 22 },
    ],
    archivos: [
      "supabase/migrations/0196_entrega_fuera_y_orden.sql \u2014 qui\u00e9n se sac\u00f3 de su producto y el orden de cada columna",
      "app/customer-success/orden-manual.ts \u2014 d\u00f3nde cae una tarjeta y c\u00f3mo queda la columna",
      "app/customer-success/KanbanEntrega.tsx \u2014 el hueco sigue al cursor y el dragenter aceptado",
      "app/customer-success/EtapasEntregaModal.tsx \u2014 el hueco del alto de una fila en el editor",
      "app/customer-success/FichaEntrega.tsx \u2014 \u00abQuitar de este producto\u00bb con dos o m\u00e1s",
      "app/customer-success/LoteClientes.tsx \u2014 el men\u00fa de etapas sin t\u00edtulos de fase",
    ],
  },
  {
    fecha: "6 oct", hora: "12:38", chat: "Customer Success", cuenta: "claude1",
    actor: "martin", tipo: "prompt",
    titulo: "El curso de Mauricio adentro de MaKo: la tab, el portal, la ficha y el paso de etapa",
    pedido: "1. Mandales mensajes al CRM y PLAN para que solucionen esto... Y cuando se hace esto, es como poner un \"ORDENAMIENTO\" dentro de filtros... Porque entiendo que normalmente se ordena por orden de llegada. Para quitar eso y volver a antes, simplemente es volver a ordenar por fecha y listo. Y luego si quiero volver a la posici\u00f3n que habia dejado las tarjetas es simplemente quitar filtros. Pero en el plan funciona diferente, ya que la posici\u00f3n son PRIORIDADES, creo que el plan ya lo hace. Si lo hace bien, que no modifique nada...\n2. Quiero que implementes la tab de \"CURSO\" que ya teniamos en el workspace de Mauricio, con todo su programa...\n3. Dentro del Detail de los clientes de Mauricio se tiene que ver este CURSO.\n4. Dentro de la tab de CURSOS quiero que implementes los formularios con las tareas para los clientes que Mauricio me habia pedido... Tienes m\u00e1s info en el plan seguramente. Tambi\u00e9n hay que implementar una automatizaci\u00f3n de env\u00edo de mensaje como lo quiere Mauricio, previo a la llamada y posterior.\n5. Quiero que implementes la automatizaci\u00f3n de pasar de etapas a los clientes de Mauricio seg\u00fan las tareas que vayan completando... Si se completa X cosa y ah\u00ed ya termina la etapa, deber\u00eda ir a la pr\u00f3xima etapa. Y si esa pr\u00f3xima etapa tiene un tutorial con sus tareas, se deber\u00eda enviarle un mensaje.\n6. Quiero eliminar Whop de la ecuaci\u00f3n, que utilicemos directamente MaKo... Quiero que se puedan cargar v\u00eddeos, ya sea con un link o subiendo el video del curso. Y claro, que tambi\u00e9n se mida cuanto del v\u00eddeo se vieron, cuales tareas completaron... Quiero que los clientes de Mauricio puedan ingresar a MaKo con un nivel de acceso especial que solo ellos tienen, donde solo ven las clases de Mauricio y las tareas.\n7. Implementa todo esto, no preguntes, ya tienes mucha informaci\u00f3n en el plan y en las llamadas que hemos tenido de lo que realmente quiere Mauricio... Si se me olvid\u00f3 algo en estos items que hay que implementar, dimelo.",
    puntos: [
      "EL CURSO CUELGA DE LAS ETAPAS DE LA ENTREGA (mig 0202): \u00abla pr\u00f3xima etapa tiene tutorial\u00bb es una consulta, y pasar de etapa usa el choke point que ya exist\u00eda, firmado por MaKo. El programa de Mauricio qued\u00f3 cargado en el ws1: 107 clases (63 videos de su planilla, 43 formularios del cat\u00e1logo viejo y la log\u00edstica), y cada etapa la cierra su \u00faltima Demostraci\u00f3n.",
      "EL ACCESO ES UN LINK FIRMADO, NO UNA CUENTA: el login de MaKo es s\u00f3lo con Google y 10 de los 14 clientes no tienen Gmail. El portal muestra la etapa actual abierta y las siguientes bloqueadas; YouTube, Vimeo y los videos subidos se miden en el server, Drive y Loom dicen \u00absin medir\u00bb.",
      "LOS MENSAJES RESPETAN envio_whatsapp_enabled, QUE EN EL WS1 EST\u00c1 APAGADO desde el 29/09: hasta que se prenda, a ning\u00fan cliente de Mauricio le llega el link, la etapa nueva ni los avisos de las llamadas. A Mauricio s\u00ed le llegan sus avisos.",
      "Whop sali\u00f3 del producto entero (tarjeta, campos, ping, logo y su lib). Las credenciales guardadas se quedaron: son del cliente.",
      "La revisi\u00f3n cruzada encontr\u00f3 y se arregl\u00f3: \u00abenviado\u00bb sobre avisos que no salieron, cualquier clase al 100% con un POST, una tabla de filas fijas vac\u00eda que contaba como respondida, el contador de ingresos inflado por la vista previa de WhatsApp, un borrador que pisaba una tarea ya revisada y el hash del Vimeo no listado.",
      "CONTRADICCI\u00d3N ABIERTA: la planilla pone el PAS despu\u00e9s de Tablero y Ritmo y la etapa est\u00e1 tercera en el kanban. Lo decide Mart\u00edn.",
    ],
    commits: [
      { sha: "eba4f12f", msg: "Curso del servicio en MaKo: tab Curso, portal del cliente, la ficha, el paso de etapa por tareas, los avisos de las llamadas, y Whop fuera", lineas: 10069, archivos: 76 },
    ],
    archivos: [
      "supabase/migrations/0202_curso.sql \u2014 las clases, el avance, el acceso y las llamadas, y el bucket de videos",
      "lib/curso.ts \u2014 las reglas puras: qu\u00e9 cierra una etapa, el % visto, el reproductor de una clase",
      "app/customer-success/curso/ \u2014 la tab Curso: clases por etapa, el editor, la subida y el Avance",
      "app/compartido/curso/ \u2014 el portal del alumno, con su link",
      "app/customer-success/FichaCurso.tsx \u2014 la pesta\u00f1a Curso de la ficha",
      "lib/curso-avance.ts \u2014 el paso autom\u00e1tico de etapa al enviar las obligatorias",
      "lib/curso-mensajes.ts \u2014 el link, la etapa nueva y los avisos de antes y despu\u00e9s de cada llamada",
      "scripts/curso-cargar-programa.ts \u2014 la carga idempotente del programa de Mauricio",
    ],
  },
  {
    fecha: "6 oct", hora: "\u2014", chat: "Customer Success", cuenta: "claude1",
    actor: "martin", tipo: "prompt",
    titulo: "Invitar al cliente a MaKo para que entre a su curso",
    pedido: "Al igual que en la vista de Agencia, se deber\u00eda poder INVITAR al cliente a MaKo para que tenga acceso al curso.",
    puntos: [
      "Cierra el punto 6 del pedido de las 12:38 (\u00abun nivel de acceso especial que s\u00f3lo ellos tienen\u00bb), que la primera pasada hab\u00eda resuelto s\u00f3lo con el link firmado. La hora del pedido no est\u00e1 en ning\u00fan commit: el trabajo arranca antes de las 15:40, que es cuando naci\u00f3 la migraci\u00f3n 0206.",
    ],
  },
  {
    fecha: "6 oct", hora: "18:30", chat: "Customer Success", cuenta: "claude1",
    actor: "claude", tipo: "implementacion",
    titulo: "El alumno entra con SU cookie, nunca con una sesi\u00f3n de MaKo \u2014 y lo que se verific\u00f3 antes de commitear la superficie",
    puntos: [
      "\u26a0\ufe0f EL ALUMNO NUNCA RECIBE `mako_session` NI UNA FILA EN `usuarios`, y est\u00e1 medido: una sesi\u00f3n v\u00e1lida pasa por todas las rutas que no son /admin, un rol desconocido cae a 'admin', y 98 APIs m\u00e1s las 53 acciones de crm/actions.ts no miran el rol. Con una fila en `usuarios`, el alumno le\u00eda el CRM de Mauricio. Tiene su propia cookie (`mako_alumno`), que el proxy no toma por sesi\u00f3n: todo lo interno le da 401 POR CONSTRUCCI\u00d3N, y lo \u00fanico que se le abre es /mi-curso, en una rama exacta y s\u00f3lo de lectura.",
      "Lo escribi\u00f3 una sesi\u00f3n que se qued\u00f3 sin cuota antes de commitear, y lo cerr\u00f3 otra. Antes de commitear una superficie de seguridad ajena se verific\u00f3 el C\u00d3DIGO y no los comentarios: la firma con prefijo propio y el `exp` firmado; `resolverAcceso` en cada pedido adentro del workspace de la firma (y que `curso_accesos` ya estaba acotada, o habr\u00eda sido passthrough); y que la rama del proxy que devuelve temprano NO se saltea el borrado del header interno de workspace.",
      "\u26a0\ufe0f EL DIAGN\u00d3STICO QUE SE HIZO MAL: al separar este trabajo del de otras tres sesiones, dos arreglos de app/api/admin/agencia/* quedaron afuera por \u00abno ser del curso\u00bb. Los delat\u00f3 verificar el conjunto en un worktree limpio: fallaba un test del PROPIO archivo del curso que los cuidaba. El tema de un hunk dice de qu\u00e9 habla; el test que lo cuida dice a qu\u00e9 commit va.",
      "Qued\u00f3 AFUERA a prop\u00f3sito app/_cursos/: una extracci\u00f3n cuya cabecera nombra tres pantallas que la montan y que tiene CERO `import`. Y se report\u00f3 sin tocar el `email_verified === false` del callback de Google, que deja pasar el campo ausente: es previo, y endurecerlo cambia el login de todos.",
    ],
    archivos: [
      "lib/alumno-sesion.ts \u2014 la firma de la cookie, pura y con test",
      "lib/alumno-acceso.ts \u2014 la revalidaci\u00f3n en cada pedido y el login por email invitado",
      "app/mi-curso/ \u2014 la pantalla del alumno, que dibuja lo mismo que el portal del link",
      "app/api/compartido/curso/entrar/route.ts \u2014 el link del mail: deja la cookie y lleva a /mi-curso",
      "proxy.ts + lib/rutas-publicas.ts \u2014 `decidirRutaAlumno`: la \u00fanica ruta que esa cookie abre",
      "app/customer-success/curso/InvitarAlCurso.tsx \u2014 el bot\u00f3n de la ficha",
    ],
  },
  {
    fecha: "6 oct", hora: "—", chat: "Customer Success", cuenta: "claude2",
    actor: "martin", tipo: "prompt",
    titulo: "Terminar todo el proyecto de Customer Success y cerrar las tareas",
    pedido: "Revisa todo lo que falta en el proyecto de Customer Success y terminalo todo, cierra las tareas",
    puntos: [
      "La auditoría de las 12 tareas abiertas contra HEAD, con refutación, dio CERO hechas. Lo que no necesitaba una decisión se hizo en una primera tanda de siete grupos.",
      "Cuatro decisiones se le preguntaron y las contestó así: la tabla de Clientes suma «Último contacto» y «Vencidas» y se arma la alerta de baja AL DUEÑO (21 días sin contacto ni movimiento, sin IA); los becados son un tipo de venta «Sin cobro» en el CRM; el recordatorio de clases va por WhatsApp a los 3 días sin entrar; y de #665 van las TRES piezas (Calendly al completar la etapa, la IA que reescribe con la llamada y el cliente aprueba, y m6-m9 por área con link propio del líder).",
      "Defaults tomados sin preguntar: los compromisos de la junta van sólo en el aviso al DUEÑO, nunca al cliente; el CSV de Exportar suma email y teléfono, sin botón nuevo.",
      "Quedan de Martín: dónde va la clienta que quedó en «onboarding», el PAS fuera de orden, si las sesiones de entrega se agendan por Calendly, app/_cursos/, el arrastre con el dedo y si un cliente de baja sale del kanban.",
    ],
  },
  {
    fecha: "6 oct", hora: "23:40", chat: "Customer Success", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "Las llamadas de entrega se analizan, el curso se anota y se limpia, y el choke point deja de mentir",
    puntos: [
      "#107: las 283 sesiones de entrega que se tiraban (129 del ws1) se analizan GRATIS con un contrato propio (resumen, riesgos con su cita verificada, próximos pasos) desde un cron aparte, que las drena de a dos por workspace por hora. ⚠️ Un fallo NUNCA deja status 'error': closing-sync re-analiza esos con Sonnet PAGO.",
      "⚠️ LA CLIENTA EN «ONBOARDING»: el diagnóstico obvio («alguien borró la etapa») era el equivocado. El choke point validaba la etapa contra las de FÁBRICA cuando no podía leer el catálogo, y las escribía. Ahora falla; y la ficha dice «Etapa borrada» en las dos partes.",
      "El choke point escribe con compare-and-set (dos movimientos simultáneos mandaban dos WhatsApp), firma con la persona y no «CRM»; las 16 actions de la tab preguntan la capa, que antes vivía sólo en la página.",
      "El curso: grabar / no grabar por clase (#693), notas y adjuntos por clase y etapa que nunca llegan al portal (#692), una purga fail-closed de archivos huérfanos, el onboarding de la tab con una vista previa del alumno que no escribe nada, y los dos campos de #694 aplicados en la base del ws1 con un script seco por default.",
      "MaKo ve las tareas vencidas de cada cliente (conTrabajo no tenía call site) y el avance del curso; las secuencias de entrega cuentan a los clientes sin fila; el aviso de la sesión al dueño suma los compromisos de su grabación.",
    ],
    commits: [
      { sha: "54e31272", msg: "Customer Success: las llamadas de entrega se analizan, el curso se anota y se limpia, y el choke point deja de mentir", lineas: 8834, archivos: 94 },
      { sha: "ab81f03f", msg: "Temario #694 en la semilla, borrador del protocolo de graduación, y Whop pasa a ser historia", lineas: 1089, archivos: 11 },
    ],
    archivos: [
      "lib/closing-entrega.ts + lib/closing-entrega-contrato.ts — el análisis de una sesión de entrega y su saneo",
      "app/api/cron/cs-sesiones-entrega/route.ts — el drenaje, horario",
      "lib/cs-mover-etapa.ts — el choke point, ahora con compare-and-set",
      "app/customer-success/puerta.ts — la pregunta de capa de cada action",
      "lib/curso-notas.ts + lib/curso-purga.ts — las notas del equipo y la purga del bucket",
      "app/customer-success/curso/onboarding-curso.ts — el onboarding derivado de los datos",
      "scripts/curso-aplicar-694.mjs — lleva la semilla a lo ya cargado, seco por default",
      "docs/protocolos/graduacion.md — el borrador para Mauricio (#667)",
    ],
  },
  {
    fecha: "7 oct", hora: "01:28", chat: "Customer Success", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "La cartera con señal, «Sin cobro», el recordatorio de clases y el bucle de #665 entero",
    puntos: [
      "Las cuatro decisiones de Martín del 06/10. La tabla de Clientes suma «Último contacto» y «Vencidas» y hay una alerta de baja AL DUEÑO (21 días sin contacto ni movimiento, sin IA); «Sin cobro» es un tipo de venta del CRM que no baja el ticket; el alumno recibe por WhatsApp los videos que le faltan a los 3 días sin entrar; y #665 completo: el link de agenda al completar la etapa, m6-m9 por área con link propio del líder, y la IA gratis que propone la respuesta con lo hablado para que el cliente la apruebe.",
      "⚠️ LO ENCONTRÓ LA INTEGRACIÓN, NO UN TEST: el recordatorio se escribió sobre un árbol sin líderes y cinco de sus consultas a curso_accesos filtraban sólo por lead. Juntos, «hace 3 días que no entra» se decidía con las fechas del LÍDER para mandarle el WhatsApp al cliente. Guard nuevo que barre todo el repo.",
      "⚠️ El paso 5 no podía mirar «la etapa actual»: completarla pasa al cliente a la siguiente en el acto, así que cuando ocurre la llamada su etapa es la nueva y vacía. Mira la que acaba de cerrar.",
      "Un saliente no es contacto: con el envío prendido, los recordatorios automáticos reiniciaban el reloj de la alerta. Contacto = una sesión o un mensaje DEL cliente; un WhatsApp manual del dueño tampoco cuenta hasta que la base distinga quién escribió.",
      "De paso: el drenador de mensajes programados tenía un compare-and-set que no leía las filas tocadas (dos ticks mandaban dos veces). Arreglado con su test.",
    ],
    commits: [
      { sha: "f6b33ed0", msg: "Customer Success, segunda tanda: la cartera con señal, «Sin cobro», el recordatorio de clases y el bucle de #665 entero", lineas: 8103, archivos: 94 },
    ],
    archivos: [
      "lib/cs-contacto.ts + lib/cs-sin-contacto.ts — el último contacto (una regla) y la alerta de baja",
      "app/api/cron/cs-sin-contacto/route.ts — la alerta, diaria",
      "lib/stage-requirements.ts + app/crm/StageMoveDialog.tsx — «Sin cobro» en el wizard del CRM",
      "lib/curso-mensajes.ts — el recordatorio de clases, adentro del cron curso-sesiones",
      "lib/curso-acceso.ts + lib/curso-datos.ts — el link del líder (c2.) y las respuestas por área",
      "lib/curso-propuesta.ts — el paso 5: la IA propone, el cliente aprueba",
      "tests/curso-accesos-area.test.ts — toda consulta a curso_accesos dice de quién es el acceso",
    ],
  },
  {
    fecha: "7 oct", hora: "—", chat: "Customer Success", cuenta: "claude2",
    actor: "martin", tipo: "prompt",
    titulo: "El portal del alumno y la tab Curso, con el diseño de Conocimientos",
    pedido: "No se ve para nada igual, COPIA lo que ya hicimos en CONOCIMIENTOS · No solo la vista de alumnos, la vista del editor también se tiene que ver tal cual",
    puntos: [
      "Lo mandó con dos capturas: la vista del alumno (un «Hola.», las barras de etapas y un acordeón de clases) y un curso de /conocimientos (la barra oscura con los módulos, la portada y las tarjetas con su lámina).",
    ],
  },
  {
    fecha: "7 oct", hora: "16:30", chat: "Customer Success", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El curso se dibuja como Conocimientos: las etapas son los módulos y las clases las lecciones",
    puntos: [
      "Las dos pantallas montan app/_cursos/CursoUgc.tsx, el dibujo que otra sesión había extraído de Conocimientos y dejado sin enchufar. La traducción de cada una es pura y con test.",
      "El alumno: la tarea y la descripción en el papel, «Agenda tu sesión» arriba y en la cabecera de cada etapa terminada, el candado en lo que todavía no se abre, y la portada lleva a lo que vino a hacer.",
      "La tab Curso: el mismo dibujo con Editar, ordenar, borrar y «+ Clase», la marca de grabar, la tarea tal como la ve el alumno (sin guardar nada), las notas y el Avance como entrada de la barra.",
      "⚠️ Pasar de clase desmontaba la tarea y la dibujaba como al cargar la página: ahora devuelve lo último que quedó. Y un link directo a una clase abría el índice: las dos pantallas siembran la posición al montar.",
      "Queda: que Conocimientos monte el mismo dibujo (sigue con su copia, y en el teléfono con la barra al lado del contenido).",
    ],
    commits: [
      { sha: "70a207df", msg: "Curso: el portal del alumno y la tab Curso con el diseño de Conocimientos", lineas: 2767, archivos: 16 },
    ],
    archivos: [
      "app/_cursos/CursoUgc.tsx + app/_cursos/estilos.ts — el dibujo, y lo que la hoja de Conocimientos no traía",
      "app/compartido/curso/[token]/PortalAlumno.tsx + modelo-ugc.ts — el portal del alumno",
      "app/customer-success/curso/CursoApp.tsx + modelo-ugc.ts — la tab Curso",
      "app/compartido/curso/[token]/TareaAlumno.tsx — onValores: lo escrito sobrevive a pasar de clase",
      "tests/cursos-ugc.test.ts — las reglas, los dos adaptadores y que las dos pantallas lo monten",
    ],
  },
];
