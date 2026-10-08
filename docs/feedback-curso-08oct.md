# Feedback del curso de Customer Success: el audio del 08/10/2026 (26 min)

Martín lo mandó por WhatsApp a las 12:42 con: «Te paso feedback de Customer Success... SI hay
tareas que le corresponden a otros chats, pasalas a esos chats. (Como CRM que se que estuvimos
viendo algo de eso)». Es una prueba del curso con alguien que tiene su propio curso, «Service
Delivery Ops», y un cliente, «Fiesta»: él lo usa en pantalla compartida y Martín le explica.

Transcripto con la cascada del repo. ⚠️ Los primeros 7 minutos salieron de Gemini como un conteo
«1 2 3 … 699» en vez del texto (ver docs/hallazgos-ia.md) y se volvieron a transcribir con Whisper
en tramos de 2:20. Las voces no vienen separadas: quién dice qué se deduce del contenido.

## Lo que salió, y a qué chat va

Los minutos son aproximados (± 1 min).

### Customer Success (este chat): el curso

1. **Guardar a mano** (14:30, 15:40): «prefiero que haya un botón que me obligue a guardar de forma
   manual frente a que simplemente cambie y que se guarde solo, porque siento que esto puede llegar
   a traer bugs». Martín: «lo más fácil es un botón de guardar y que diga guardando».
2. **Se pierden los campos** (15:30-16:40): «volví para atrás y se me borraron todos los campos de
   edición». Era un campo sin la pregunta escrita: no se guarda y no lo dice. Pide «un enmarcado
   rojo y que diga falta completar la pregunta».
3. **La vista del alumno no muestra lo último** hasta recargar o esperar (02:40, 15:40): un loader o
   no dejar entrar hasta que se guarde.
4. **Ctrl+Z** al editar una clase (20:50).
5. **La tarea y sus campos en UN contenedor** (21:00): «no sabía que el campo estaba asociado a esa
   tarea». Los campos nuevos se agregan ABAJO del último y un poco más chicos.
6. **Al crear una tarea, nace ya con su primer campo** (12:30).
7. **«Obligatoria para avanzar» sale de la tarea** y va al menú «…» de la clase (13:00).
8. **Las opciones de un campo de elección se editan como opciones**, no en un cuadro de texto
   gigante (13:40, 14:00); y la vista previa, «un poco más esthetic».
9. **La escala**: un deslizador o estrellas, no sólo números (14:50).
10. **«Lo hice» no se entiende** (17:30): decir qué es.
11. **La descripción de la tarea con formato** (negrita…), como la de la clase (18:00).
12. **Más de una tarea por clase** (21:30): «sería bueno que se pueda agregar más de una tarea».
13. **Chat de la clase** (15:00): «agregar si el usuario quiere un apartado de chat… para chatear
    acerca de esa clase».
14. **Video por código embed** (22:40): el link de Panda no anda; «tengo que hacer que funcione con
    URL y con HTML embed». Y un YouTube que no se reproducía adentro y abría el link afuera (23:10).
15. **Embeber en la descripción y la tarea** (24:30): sobre todo el calendario para agendar la llamada
    ahí mismo.
16. **Un módulo público y vacío no aparece en la vista del alumno** (03:00): que aparezca (para un
    «coming soon», como Skool).
17. **Botón «Nuevo producto» en el curso** (00:40): hoy hay que ir al CRM.
18. **Abrir una clase tarda mucho** (10:40).
19. **El video y el texto al costado, alineados arriba** (11:00).
20. **Migrar cursos de otras plataformas** (04:40): averiguar cuáles tienen API; Skool no tiene, y
    se podría con la extensión de MaKo. Para Panda, con la API de MaKo y Claude (ver API).
21. **La invitación con el email y el WhatsApp propios** (09:30): «puedes conectar tu email, puedes
    conectar tu WhatsApp y a la persona le puede llegar por ambos lados».

### CRM

- **Sacar la fricción del pre-onboarding del CRM** (09:00-10:20). Martín: «tengo que quitar toda la
  fricción que hay en el CRM y que se entre automáticamente». El que probaba: «no entiendo nada,
  siento que es mucho texto».
- **Migrar en lote desde CRMs conocidos** (04:40): «averiguar cuáles son esas plataformas, no
  solamente de curso, sino también de CRM conocidas, averiguar si tienen API, integrar la API… con
  un botón podés empezar la migración en lote».

### API de MaKo

- **El curso en la API** (04:00-07:30): «¿esto lo puedo conectar por medio de API para que mi Claude lo
  pueda subir de forma automática?». Martín: «No están las acciones dentro de curso, como agregar
  nueva clase… tengo que agregar el tema de curso en la API». Y una guía para quien no es técnico:
  «copia tu token de API, pásalo a Claude y dile que te haga tal».

### Integraciones

- **La seguridad** (07:30): «voy a conectar el Stripe y básicamente toda la base de datos de cliente,
  facturación, todo. A mí me gustaría que se pueda ver el tema de seguridad lo máximo posible,
  porque si ya me hackean MaKo, me hackean a mí también».

### Lo que se habló y NO es tarea

- Una cuenta por cliente: el curso de un cliente va en la cuenta de ese cliente. Hoy no hay registro
  propio: se invita.
- Un dominio propio para el curso: Martín explicó que es como Skool, con la cuenta de MaKo.
- La invitación automática al ganar ya existe (es un script, no IA).

## La transcripción

### Desde el 00:00

Bueno, a ver, vamos a ver feedback y preguntas del proceso de cursos dentro de MaKo. Bueno, mi caso es, acá tengo el curso de Service Delivery Ops, que me encanta, porque si yo tuviese un infoproducto de Service Delivery Ops, o sea, sería ideal porque ya tengo el nombre y todo. Y no me gustaría cambiar esto, sino que me gustaría agregar otro curso de un cliente que yo tengo. no sé si yo tengo que tener o cuenta de agencia con ese cliente específico o cómo lo agrego esto. A ver, vos si querés agregar un nuevo producto tenés que irte hoy en día, eso es algo que tengo que poner ahí el botón, pero hoy en día tenés que irte al CRM y en el CRM pones nuevo producto. Y cuando pones un nuevo producto ahí, ahí se crea también en cursos, podés seleccionar tu nuevo producto. Sin embargo, eso yo también lo voy a poner ahí en el mismo curso, que vos puedas agregar un nuevo producto. Y con respecto a tener cursos de clientes, lo ideal sería que no, que cada cliente si quiere tener un curso de Joven MaKo tenga su propio acuendo Entonces b lo que hago en este caso como voy a manejar fiesta la idea es tener a fiesta ac tipo como otro cliente aparte y como me puedo crear otra cuenta no puedes crear otra cuenta eso te tienen que invitar hoy en día no existe un proceso de crear cuenta aunque Ok. Pero bueno, vuelve el curso. Bueno, pero entonces yo ahora, por ejemplo, quiero crear algo de fiesta. Y te tengo que invitar yo al email de fiesta. Bueno. Pero no, o sea, ahora no, o sea, seguí mirando el curso. Bueno, nada, acá tengo un boarding. A ver, cómo hago para los colores, me gustan los colorcitos. Me gusta, me gusta mucho como está, me gustan las fuentes, está muy bueno esto, es cool quedó un poroto al lado, me gustan los módulos, me gusta la previsualización del agar, ok, no hay porque no hay nada publicado, quiero crear yo, claro yo tengo que mandar como, ah como público, publico, publico,

### Desde el 02:20

Es muy intuitivo, me gusta mucho porque es muy intuitivo. Voy a Vista de alumno y acá... Bueno, entiendo de qué por qué tengo que recargar. No hay clases. No hay clases, esto está público, o sea, es como un módulo que yo pensé que iba a aparecer aunque no hubiese clases. Pero no tiene nada. Ok, entonces, o sea, si yo lo pongo como público, no significa que lo va a poder ver la persona aunque esté vacío, sino de que sí o sí tiene que haber clases dentro si no se va a poder poner yo lo que puedo hacer ahí es para el botón de vista de alumno que si alguien lo intenta cliquear y todavía no tiene ninguna clase que no lo admita y que le salte simplemente un mensajito de agrega tu primera clase en realidad no, para mí es antiintuitivo yo lo que haría sería de que esto, aunque, o sea si está público, que está público y que aparezca acá en la vista de alumno el módulo que digo onboarding qu Porque me pongo a pensar en el caso de fiesta por ejemplo que quer hacer el m de lanzamiento y a m me gustar por ejemplo que alguien que sea una fiesta vea el m que est vac pero que pueda poner en el nombre del m entre par como coming soon Que eso por ejemplo en Skool s se puede hacer En Skool se pueden publicar m aunque no haya nada dentro Entonces, me gusta. Fíjate en la portada. Bueno, me gusta mucho esto, que está como estandarizado. La verdad es que me gusta bastante. Me gusta mucho. Me gusta mucho cómo está realmente. A ver Me gusta mucho que pueda subir Porque yo tengo mis propias portadas Entonces me parece increíble ¿Viste que tenés galería? Sí, sí, sí No, me gusta mucho Esto está muy bueno Por eso Dios Cool quedó un poroto al lado Lo único que quiero saber Es si esto lo puedo conectar por medio de API Para que mi cloud Lo pueda subir de forma automática Eso también es algo que lo tengo que resolver Ahora para que quede anotado en el audio la misma objeción me puso Juanfran cuando le propuse que lleve su Skool a MaKo me dijo que sí, que está buenísimo que lo vio pero que tiene cientos de clases y la verdad es que pasar todo eso no lo va a hacer nunca y algo muy normal

### Desde el 04:40

Todos los servicios de SaaS, de software así, es que tengan una opción de migración automática o de migración en lote, de otras plataformas que sean muy conocidas. Entonces, lo que yo tengo que hacer es averiguar cuáles son esas plataformas, no solamente de curso, sino también de CRM conocidas, averiguar si tienen API, integrar la API de esas plataformas dentro de MaKo, entonces vos con un botón podés empezar la migración en lote o sea la migración masiva digamos de todo ahora para las cosas que no tengan API como por ejemplo Skool no tiene API y tengo que averiguar cómo hacerlo yo creo que se podría llegar a hacer a través de la extensión de MaKo que ya la tengo habilitada que hoy en día por ejemplo la extensión de MaKo ya descarga videos porque está descargando cosas del propio Flow entonces podría descargarse todos los vídeos de Skool y subirlos. Sí, yo creo que está bueno. Yo creo que ahí ya depende de la persona. O sea, el problema es, por ejemplo yo resolv por cuenta propia yo ten cosas en Skool y yo pude resolver por cuenta propia Yo tengo todo en Panda por ejemplo El problema no es pasar de Skool a tal me parece que eso lo tiene que resolver el usuario, bueno con Juanfran puede ser más exquisito, sí, eso hace que pague, pero yo creo que el tema es cómo yo de forma automática puedo subir todo acá, porque la verdad es que sí, si yo tengo que pasar cada uno de estos vídeos de Panda que me va a tardar como una hora y media por ahí, encima con las descripciones y con todo, acá manual me pegó un tiro bueno, hoy en día yo creo que ya se podría llegar a hacer no lo probé, pero creo que ya se podría llegar a hacer porque vos en MaKo ya tenés MaKo API entonces como ya tenés MaKo API podés generar tu propio token y tenés la documentación y acá tenés todas las cosas que hace MaKo MaKo pendientes cuenta, integraciones Closing, landing Bueno, esto, como yo Lo último que hice fue el tema de curso No están las acciones dentro de curso Como agregar nueva clase Agregar nuevo lo que sea Acá, entonces tengo que agregar El tema de curso en la API

### Desde el 07:00

Eso se podría, pero fíjate que la API también está bastante intuitiva de utilizar y eh con esto ya te permitiría, conectas tu API, le pasas la API como como variable en torno a Claude y te lo haces. Exacto. Está bueno. Eh, sí, me gusta. Ahora, lo Pero es también tenía bueno de que si ya existe la API, para los usuarios que no son tan técnicos, yo le dé en al menos, por ejemplo, en el tutorial una opción de migrar masivamente. O sea, que que le dé tipo un pequeño tutorial de copia tu token de API, pásalo a Claude y dile que te haga tal. Sí, o sea, eso ya el mismo solo debería saber hacerlo. No todos los usuarios son técnicos. Pero bueno, y a mí lo último que me da duda realmente y que yo, fíjate que no soy un cliente eh pero para mí lo único que me daría duda es lo siento súper increíble, pero yo acá voy a conectar el Stripe eh y voy a conectar básicamente toda la base de datos de cliente, facturación, todo. A mí me gustaría que se pueda ver el tema de seguridad eh lo máximo posible, porque si ya me hackean MaKo, entiendo que me hackean a mí también, entonces es súper importante este tema de seguridad. Eso es como lo último que agregaría. Bueno, pero vamos al tema del curso, porque si no el audio se Eh, invitar, clientes sin invitar alguien nuevo Eso es porque vos dentro del CRM puedes tener personas enganados, es decir, personas que ya son tus clientes, pero que no están dentro del curso porque no los invitaste todavía. Entonces, lo puedes invitar de ahí. Hm. Okay. Ahora, también ya está la automatización dentro del CRM eh para eh invitar de manera automática que les llegue un email a todos los que caigan enganados, o sea, eso ya está. Lo que pasa es que vos actualmente en el CRM tenés como el pre onboarding del CRM, yo yo lo que quiero hacer es quitar eso, o sea, tengo que quitar toda la fricción que hay en el CRM y que se entre automáticamente. Pero bueno, eso ya lo voy a hacer ahora. Sí, a mí me gustaría de que se quite la fricción y también eh entiendo de que el CRM funciona por medio de API y no sé si hay problemas con la API. ¿Qué API? La API de Claude, o sea, que si yo puedo el API de gratis que entiendo que pongo API gratis, pero No, no, no, no, no, no hay pocas cosas en el CRM que funcionen a través de Y, pero la automatización, ¿cómo va a funcionar entonces? ¿Qué automatización? Y, yo yo ya te había comentado, te dije que quiero que entre los alumnos Bueno, pero eso no es IA, eso es un script. Alguien cae enganado y se ejecuta un script interno que le llega un email. O sea, eso no no es IA. Okay. Y el email de de qué va a ser? Mi email propio, tengo que conectar mi dominio, entonces también. Sí, vas a tener que conectar, puedes conectar tu email, puedes conectar tu WhatsApp y a la persona le puede llegar por ambos por ambos lados. Pero bueno, vamos al tema de No, bueno, es eso, básicamente, lo veo bastante bien. Eh, sí me gustaría que se quite esta fricción del CRM. Eh, porque la verdad es que no esto no es no entiendo nada, siento que es mucho texto también. Eh, Sí, pero eso porque yo no lo hice, podemos ir, por favor, a la cosa que yo sí hice, que es el tema del curso. Ya está, no tengo nada más que decir del curso. Pero no entraste en a una clase, nada. Está dando mucho en cargar. una clase. Sí, eso Pero fíjate todas las cosas que tenés, o sea, Sí, agregar video, esto lo quiero hacer de forma automática porque no lo quiero hacer de forma manual. Me gusta la vista del alumno. Pero va por ejemplo el tema de Fred. Fíjate por favor, hermano. Lo me estoy fijando. Qué más pero es que había Texto abajo, si no que el video se puede enlazar. Sí, sí, o sea, esto está bueno. y agregar eh bueno, otra cosa que puedo llegar a hacer es que cuando crea una nueva clase, el video y el párrafo del costado tienen que estar alineados, sí o sí, tiene que estar alineados. No puede estar el párrafo de la descripción muy arriba. Hm, eso, la verdad es que a mí no me cambia, a mí me gusta inclusive, que sea como un poco más normal. Me gusta lo de buscar clase, ojalá funcione bien, habría que probarlo. Sí, funciona. Fíjate lo de tarea, eso también es muy importante, tareas. Está bueno. Entonces, vos ahí que eh lo que podés hacer es obligatorio para avanzar, a ver, poner nuevo campo. Es raro porque fíjate que cuando pones nuevo campo recién te deja seleccionar el tipo de, a ver, andate para arriba por favor. Tarea, ah claro. Cuando creas una tarea te da el te da la opción de poner el título, el nombre de la tarea y la descripción, tipo una descripción de qué es lo que tiene que hacer el alumno. Eso está bien, pero automáticamente cuando se crea la nueva tarea, que se ponga como la descripción de la tarea, pero abajo también ya se tienen que crear de manera automática el nuevo campo, es decir, el primer campo. Y fíjate, interactuáis con el campo, las opciones que tenés. Tenés para hacer de todo. No, está muy bueno. Y fíjate abajo del todo, al final de las opciones, es algo bueno que yo agregué. obligatorio para avanzar, pero no me deja modificarlo. Es como que hago esto, pero no me Hay uno, un bug cuando dice obligatorio para avanzar que dice, a ver. Como que pongo esto Para cerrar la etapa, agrega la tarea, a ver. A ver, no sé, eh Hola. Ah, pone obligatorio en ahí abajito, ese es obligatorio, entonces quitar el tema de obligatorio para avanzar ahí abajo. Entiendo de que obligatorio para avanzar es que no te deja ver la próxima clase si no hiciste la tarea, pero ese botón tal vez no se debería configurar ahí, sino que se debería configurar en el desplegable de cada clase o cada módulo. Sí, después por otro lado, eh, fíjate en las opciones, eso es lo que quería que te fijes, todas las que hay, sobre todo las últimas. Sí, sí, sí, o sea, acá veo una opción y ya me aparecen opciones, o sea, a ver, Hola. No, no, no, no entiendo, tampoco entiendo cómo se previsualiza, a ver, acá creo que ya se guardó, puse hola, hola dos, hola tres, entiendo que esto básicamente es un formular selection the choice. Okay, sí, se ve bien, pero siento un poco anti intuitivo.

### Desde el 14:00

el formato tampoco como está. La la la edición de las tareas está mal. Cuando vos ponés un formato multiple choice, en lugar de salirte opciones multiple choice te sale un cuadro de texto gigante a la hora de editarlo. Sí. Puedes poner otra vez para que estoy viendo. Eh y tampoco me gusta la previsualización, esto es algo muy mío igual, está bien, pero si puedes hacer la previsualización un poco más linda, genial. 
Puedo volver a editar. 
Qué previsualización? 
Esta. 
Por qué no te gusta? 
Y yo no sé, lo haría un poco más esthetic. 
Después vamos a ver si con varias opciones me permite seleccionar varias. 
Ahí voy a ver vista del alumno. 
No. Acá puse, por ejemplo, seleccioné varias opciones y no me deja ver. 
Sí, ahí ahí está se actualiza. 
Ahí se actualizó. Bueno, tarda un poco en actualizarse cuando cambio de opción entre una opción y varias opciones, por ejemplo. 
Y eh otra cosa que ocurre es que, bueno, la previsualización eh Y siento de que lo que faltaría acá es un botón para guardar, porque por ahí yo modifico algo y no yo prefiero de que haya un botón que me obligue a guardar de forma manual frente a que simplemente cambie y que se guarde solo, porque siento que esto puede llegar a traer bugs. Entonces lo mejor sería como un botón de confirmación de guardado, como que esta edición la quiero así. A ver si voy a tabla. Bueno, ahora a ver una escala del 1 al 10, que es el 1 más lo bueno. Bueno, voy a poner todos los campos, ahí estamos. Viste, ese es lo que te quería mostrar, agendar llamada. Te permite agendar una llamada, por ejemplo, vos vamos a suponer estás, estás mirando el vídeo y si puedes agendar llamada, y bueno, ahora te toca tu clase, no sé qué y agendar llamada conmigo. Entonces vos le puedes poner ahí abajo también publicar en la comunidad o comentar en la comunidad porque hay una comunidad Y la tarea puede ser poner un comentario en la comunidad o publicar algo en la comunidad. Bueno, tarea, hola MaKo, me pasé un poco de espacio, un link ahí. Malo, bueno, bueno, la escala lineal podría ser bueno de que sea como un una barra deslizable, no simplemente números seleccionables. O si no, de última, la típica de estrellas. Algo que falta dentro de las clases, tal vez estaría bueno, es agregar si el usuario quiere agregar un apartado de chat, que a veces muchas plataformas tienen, entonces vos puedes chatear acerca de esa clase. Como que quité una tarea y se me quitó todo porque era la única que tenías. No, pero quité una tarea y también se me quitó el campo que tenía. O sea, no sé si una tarea está asociada, o sea una tarea puede tener varios campos asociados y si yo quito esto, por ejemplo acá tengo no sé, dos campos. Tengo el campo de opciones, campo de número, acá pongo no sé, A, B, C, acá pongo un campo de número, escribe una pregunta, hola, ¿Qué es campo de número? Hay que poner un número? Que es un campo normal, pero solamente te deja escribir números el usuario. Okay. Y acá por ejemplo, bueno obviamente pongo la vista del alumno y me no me aparece. Tienes que esperar, o sea, algo algo estaría bueno que en la vista del alumno, si se está actualizando, que eh aparezca un loder o que no te permita entrar a la vista del alumno hasta que se actualice todo. Sí, o sea, lo más fácil es un botón de guardar y que diga guardando de última. Y acá volví para atrás, por ejemplo, y se me borraron todos los campos de edición. Y esto va a ser súper molesto si tengo que hacerlo, no sé cuántas veces lo tengo que repetir. O sea, como que no se me guarda ahora. Varias opciones, 1, 2, 3 texto, una opción, 1, 2, 3 Acá faltaría una vez más el tema de guardar y cuando voy a vista del alumno no me aparece. Vuelvo para atrás, no me aparece la edición. Voy a ver con nuevos campos. A ver que tal vez estoy haciendo algo mal, pero una opción, a ver, vamos a poner con la pregunta hola 123 y acá vamos a poner varias opciones Hola 123. Ya está todo, en teoría, pongo vista al alumno y acá me aparece, okay, algo muy importante es que las opciones me aparecieron de forma automática cuando puse la pregunta, es decir, solamente puedo ver la vista del alumno, yo deduje por cuenta propia como usuario de que solo me aparece la previsualización cuando pongo una pregunta, pero si yo quiero ver una previsualización y eh todavía no está la pregunta, la aplicación me debería indicar lo que me falta completar del campo correspondiente para que lo pueda previsualizar. O sea, que básicamente me aparezca como un enmarcado rojo y que diga no sé, falta completar la pregunta, porque acá sí se guardaron los campos. Eso es muy importante. Como no había puesto la pregunta de el campo de escribe la pregunta, no me, no me aparece, o sea, no me podía previsualizar. Y eso tiene que ver con aparecer como que falta algo. Lo que dice, ¿qué tiene que hacer? Hiciste X eh no entiendo el campo de lo hice. A ver, fíjate que qué haces? Es como un checkbox, básicamente. una confirmación. Ahora, si yo pongo tarea que tiene que hacer, pongo hola. Si pongo vista del alumno en una tarea no me aparece él, hola. Ahí me apareció el texto, entiendo que es como simplemente una descripción, se podría decir porque Sería bueno que sea formateable la descripción de la tarea, como lo veas arriba, la descripción de el curso, o sea, que tenga negrita, que, o sea, que tenga formatos y si yo quito tarea se borra todo porque estás quitando la tarea, no estás quitando un campo. Okay, ahí tienes el botón de deshacer cuando Bueno, ya se me fue, control Z. Bueno. Eh, estaría bueno que cuando aprieto control Z me deje deshacer

### Desde el 21:00

lo que hice básicamente a la hora de modificar una nueva clase, a ver que yo la idea es hacerlo con IA y en Pelo lo hago manual, pero bueno, como que estaría bueno y después, yo no sabía de que eso cuando agregaba una tarea tipo los campos asociados como que estaban yo creo que estaría bueno que cuando agregue una tarea, por ejemplo, tarea 1, eh me diga que eh el campo, como que me indique de alguna forma de que el campo está asociado a esa tarea, porque yo no sabía de que era una asociación. El mo el campo lo pondría tal vez un poco más chico, un tema más mío y lo pondría abajo de el campo que ya puse, ¿se entiende? Entonces se me va agregando hacia abajo y no tengo cómo esto en el medio y trataría si de alguna forma se puede generar como eso a nivel visual esa asociación de que, che, estos campos corresponden a esta tarea. Eso es fácil, para eso tengo que ponerlo todo dentro de un contenedor, porque ahora están en tres contenedores separados y no se entiende. Claro. Y después entiendo de que eh solamente una tarea, creo que no puedo agregar tareas, sino que solamente puedo quitar la actual. Está bien, no pasa nada, simplemente es un tema que, bueno, yo no lo voy a usar, pero qué sé yo. Sí, sería bueno que se pueda agregar más de una tarea. Y bueno, de video, no sé, podemos probar agregar un video. 
A ver si funciona. 
Funcionan videos de YouTube, voy a cambiar el link, voy a poner uno de de Panda video. 
Compartir. 
Voy a copiar el el link. 
Esto es enlace público. 
Eh. Sí, sí. 
Pero si esto es enlace público, entonces lo lo podría ver cualquiera. 
No, si no tiene acceso a. 
Sí, pero alguien copia el enlace de esto. 
Bueno, por ejemplo, el de Panda no me lo toma Para aplicar el. O sea, no poner el el video, el de caso. 
Como que me redirige a Panda pero no me toma la previsualización de Panda. 
No sé por qué. 
Por ahí falta algo, por ahí es un tema de configuración mía, no sé. 
A ver, Ed, acá está, hay como un Ed, creo que es el embedded, ahí está. 
No, creo que no va a funcionar el. 
A ver, vamos a probar. 
Voy a probar a ver si el enveído funciona. 
Introduce 9RL Hoy en día solamente funciona con URL, tengo que hacer que funcione con URL y con objetos embed. Con con HTML embed. 
Tiene que funcionar con esa, con ambas cosas. 
Es como que el de YouTube me lo permite previsualizar, pero no puedo tipo ver el video desde la aplicación. 
Sí, o sea, o sea, tengo que poner apretar el video y me redirige un link y no puedo verlo desde acá. 
Pero recién, recién te pasaba por ahí quitar. 
No, pero me parece que era como el Claro, ves, nuevo a clase, ver video, No, pero lo recién dejaba, por eso te digo por ahí quitar y ponerlo de vuelta. 
¿Qué pongo? El de panda. No, el de YouTube te digo. 
No, el de YouTube, creo que lo que ocurría, a ver. 
Ahí sí te deja verlo desde el banco. 
Sí, es como que no me deja en panda, no sé por qué. 
No sé si me falta algo. 
Porque panda yo tendría que poner sí o sí un un agregar una opción de de insertado de en vez. 
No solamente con el link. 
Bueno. 
Sería eso, básicamente. 
O sea, por ahora los de panda no los puedo poner. 
También sería bueno de que eh se pueda poner en vez eh inserta ya que estoy poniendo insertado de en vez en el tema de las tareas o la descripción o lo que sea, o sea, que lo pueda embeber cosas como, por ejemplo, también superimportante el tema del Calendar, que se puedan beber ahí mismo en las en la en la barra de tareas 
el Calendar para ir exagerando y llamada directamente desde ahí. 
Y después lo único que no sé si está acá, pero simplemente lo haré como sugerencia si no está, de que pueda conectar tipo el servicio, o sea, el infoproducto a un dominio propio. 
Si se puede. 
Si no está bien, tampoco hay gran cosa, pero se puede genial. 
¿Cómo que el infoproducto no domina propio? 
El la el coso este, el curso. 
Ah, la idea es que vos le invites al usuario en Maca, tiene que registrarse, o sea, tiene que organizarse con el email. 
Pero como Skool, o sea, vos en Skool no, no, no tenés un Skool para vos solo. 
O sea, tenés que unirte a Skool y tenés que poner tu email como usuario y tanto como profesor del curso como alumno.
