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
  { titulo: 'El esquema del tablero', detalle: '`lib/tablero-matriz.ts`, `validarMatriz()` con las 6 auditorías y su migración. La piedra angular: bloquea cinco pasos.', estado: 'cola' },
  { titulo: 'El generador de tableros', detalle: 'El prompt maestro en el registro y la skill de Claude Code que emite el código.', estado: 'cola' },
  { titulo: 'La plataforma del cliente', detalle: '`lib/whop.ts`, el `WS = 1` de compartir, el 404 del curso y el contenido por workspace.', estado: 'sigue' },
  { titulo: 'El bucle de entrega', detalle: 'Dejar entrar las reuniones de entrega, el formulario por bloque, la reescritura con Fathom y la aprobación del cliente.', estado: 'cola' },
  { titulo: 'El seguimiento de la cartera', detalle: 'Cron de vencidos, regla de cliente sin señales, tabla de seguimiento y la vista de cartera.', estado: 'cola' },
  { titulo: 'El final del ciclo', detalle: 'Analizar las llamadas de entrega, el riesgo de baja, el estado de graduado, testimonios y casos.', estado: 'cola' },
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
];
