# Brief de diseño — Customer Success

Para pegar en una app de diseño (v0, Lovable, Figma AI, Claude Artifacts). Están
los dos prompts por separado: las apps de diseño dan mejor resultado con una
pantalla por vez.

**Los datos que aparecen son REALES**, de la cartera de Mauricio. No usar lorem
ipsum: la mitad de las decisiones de layout dependen de que los textos tengan el
largo que tienen de verdad — «Definir y dar seguimiento a 3 objetivos claros para
instalarlos en las rutinas de trabajo» no entra donde entraría «Lorem ipsum».

---

## Contexto común (va en los dos prompts)

Mauricio Bustos es consultor de negocios en México. Vende un programa de ~6 meses
a dueños de PyMEs —supermercados, restaurantes, distribuidoras—. Tiene 13
clientes activos. Cada cliente firma un contrato con una duración distinta: uno
16 semanas, otro 3 meses, otro sin duración escrita.

El programa son 12 módulos y 44 clases. Cada clase es un video + una tarea (un
formulario con preguntas duras sobre su negocio). Son 118 preguntas en total,
muchas son tablas de 5 columnas.

Estas dos pantallas las mira **Mauricio**, no sus clientes. Es su tablero de
trabajo, lo abre el lunes a la mañana.

**Sistema visual (respetarlo, es una app que ya existe):**

| | |
|---|---|
| Fondo de página | `#F4F6F9` |
| Superficie / cards | `#FFFFFF` |
| Superficie 2 | `#F5F7FA` |
| Líneas | `#EAECF1` · más fuerte `#DCE0E7` |
| Tinta | `#12151B` · media `#5B6472` · tenue `#98A0AC` |
| Dorado (lo que toca la IA) | `#F2B01E` · su tinta `#8F6709` · su fondo `#FDF4DE` |
| Verde (hecho) | `#1E9E57` · Ámbar `#B4530E` · Rojo `#D0504A` |

Tipografía **Geist** (o Inter). Radio de esquina 14px en cards, 7-8px en
controles. **Sin sombras, sin gradientes.** Números tabulares.

---

# PROMPT 1 · La pantalla de clientes

> Diseñá la pantalla «Clients» de una app de consultoría. La usa Mauricio, un
> consultor de negocios mexicano, para mirar su cartera de 13 clientes el lunes a
> la mañana.
>
> **La pantalla contesta una sola pregunta: ¿a quién le debo algo y quién me debe
> algo?** Todo lo demás es secundario.
>
> Los clientes van agrupados en tres bloques, en este orden:
>
> 1. **Te toca a vos** — están frenados esperándolo a él
> 2. **Le toca a él** — la pelota está del lado del cliente
> 3. **Al día** — sin nada pendiente
>
> El orden importa: una deuda suya nunca puede quedar tapada por una del cliente.
>
> **Cada cliente es una card.** Lo que tiene que mostrar, por orden de peso
> visual:
>
> - **El reloj del programa**, que es el número más grande de la card: en qué
>   semana va y de cuántas. Debajo, chiquito, cuándo arrancó y **de dónde salió
>   ese dato** («según su contrato» / «según su ficha» / «desde el cierre de la
>   venta»). Cuando el contrato no dice cuántas semanas dura, se muestra solo el
>   número de semana transcurridas, sin denominador.
> - **Por qué está en ese grupo**, en una frase corta y concreta.
> - Una línea de contexto: cuándo fue la última sesión, si debe cuotas.
> - **Lo que se le prometió**, en una banda separada abajo (fondo distinto). Sale
>   del contrato firmado.
> - Dos o tres acciones al pie.
>
> **Ejemplos reales, usalos tal cual:**
>
> ```
> Jorge Negrete
> Programa de coaching ejecutivo y liderazgo.
> [Te toca]
> 37  de 13 semanas · se pasó
> Arrancó el 26 de nov · según su contrato
> Cerró hace meses y nunca tuvieron una sesión
> Todavía no tuvieron ninguna sesión
> LE PROMETISTE → Definir y dar seguimiento a 3 objetivos claros para
> instalarlos en las rutinas de trabajo.
> [Darle su link] [Ver todo]
> ```
>
> ```
> Sergio Esquer
> Grupo Esquer · Consultoría y coaching ejecutivo
> [Te toca]
> 10  de 16 semanas
> Arrancó el 9 de junio · según su contrato
> Todavía no tiene su link para contestar las tareas
> Última sesión hace 32 días
> LE PROMETISTE → Sistema directivo instalado y operando
> [Darle su link] [Ver todo]
> ```
>
> ```
> Oscar Dalvah
> Sin empresa cargada
> [Te toca]
> 34  semanas
> Arrancó el 18 de dic · desde el cierre de la venta
> Se enfrió: 187 días sin una sola sesión
> Última sesión hace 187 días
> [Darle su link] [Ver todo]
> ```
>
> Fijate que las tres cards tienen distinta cantidad de información: una no tiene
> empresa, otra no tiene promesa, otra no tiene denominador de semanas. **El
> diseño tiene que aguantar eso sin romperse ni verse desbalanceado.**
>
> Al hacer click en una card se abre un panel con tabs: Programa · Contrato ·
> Sesiones · Cobros · Contacto. Diseñá también ese panel.
>
> Abajo de todo, plegado, «Ver los N que ya terminaron»: los graduados y las
> bajas, que salen de la cartera pero no desaparecen.
>
> **Qué NO hacer:** ningún health score numérico (con 13 clientes un «78/100»
> esconde el hecho concreto detrás de un número inventado). Ni gráficos de torta,
> ni sparklines, ni medallas. Ningún avatar con foto — a lo sumo iniciales.
> Mauricio no necesita que le adornen la cartera, necesita saber a quién llamar
> hoy.

---

# PROMPT 2 · La pantalla del programa

> Diseñá la pantalla «Program» de la misma app. Es el temario del programa que
> Mauricio le vende a sus clientes, y **la mira él como AUTOR**: viene a ver si
> está balanceado y dónde faltan videos, no a consumirlo.
>
> Referencia de estructura: el «classroom» de Skool (grilla de módulos → entrar a
> un módulo → rail de clases a la izquierda + contenido al centro). Pero **sin
> portadas**: donde Skool pone la imagen del módulo, acá van los datos que dejan
> auditar el temario.
>
> **Vista 1 — la grilla de los 12 módulos.** Cada card muestra:
>
> ```
> 04                                    NORTE ESTRATÉGICO
> Las dos MCIs
> 3 clases · 10 preguntas · 1 tabla
> [En Whop]  [1 que destraba]
> ```
>
> ```
> 07                                 PALANCAS Y UMBRALES
> La evidencia
> 3 clases · 7 preguntas · 3 tablas
> [Faltan 2 en Whop]  [Se repite por área]  [2 que destraban]
> ```
>
> Arriba de cada card, un filo fino que muestra qué proporción de sus clases ya
> está cargada en la plataforma de video.
>
> **Vista 2 — adentro de un módulo.** Rail izquierdo de ~300px con el árbol
> completo (los 12 módulos, el abierto desplegado mostrando sus clases). A la
> derecha, la clase como un documento:
>
> - Migas: «Módulo 7 · La evidencia»
> - Título grande con su número: «7.1 · Qué prueba que se hizo»
> - Una línea que resume qué hay que contestar
> - Un aviso destacado con el atoro conocido: «Ojo con esto. Es el bloqueo número
>   uno de todo el programa. Baja Teriyaki estuvo tres semanas detenida en esta
>   sola pregunta.»
> - Y después **el formulario que va a ver el cliente**, en modo lectura: las
>   preguntas numeradas, cada una con una etiqueta de qué tipo es (Párrafo · Una
>   línea · Tabla · Elegir una · Marcar varias), de qué pregunta del cuestionario
>   original sale, si es obligatoria, y las tablas con sus columnas reales.
>
> **Ejemplo real de una pregunta con tabla:**
>
> ```
> 01   [TABLA]  D2   Obligatoria
> Llena esta tabla con las decisiones que te suben cada semana y que alguien
> más debería estar tomando. Mínimo ocho renglones.
> Las últimas tres columnas son el criterio. Si solo puedes llenar la tercera,
> esa decisión tiene estándar pero no tiene criterio.
>
> | Decisión que se repite | Hoy la toma | Qué resultado se espera | Cómo se logra | Qué hacer cuando no se logra |
> ```
>
> Cinco columnas. **Ese es el caso difícil del layout**: tiene que entrar sin
> romper la medida de lectura del resto del documento.
>
> **Qué NO hacer:** nada de acordeones apilados (es lo que hay hoy y no sirve).
> Ni portadas genéricas, ni íconos decorativos por módulo.

---

# PROMPT 3 · El cuaderno del cliente (opcional)

Si querés rediseñar también lo que ve el cliente:

> Diseñá el formulario que contesta el cliente. Quien entra es un empresario
> mexicano de cincuenta y pico que dirige supermercados, entra por un link sin
> cuenta ni contraseña, probablemente desde el teléfono, y viene a contestar
> preguntas difíciles sobre su propia empresa.
>
> **No es un reproductor de curso, es un cuaderno de trabajo.** Estructura de
> Skool —módulos y clases a la izquierda, la clase al centro— pero carácter de
> cuaderno.
>
> Tres reglas:
>
> - **La pregunta es el héroe**, en 20px o más. Todo formulario achica su
>   etiqueta; acá la etiqueta ES el contenido, y lo único que importa es que la
>   lea antes de escribir.
> - Una clase a la vez. Las 44 están en el índice de la izquierda, no adelante.
> - Se guarda solo. Nada de un botón «Guardar».
>
> Hay seis tipos de campo: párrafo, una línea, número, elegir una, marcar varias,
> y tabla. **La tabla se abre con los renglones que el cuestionario pide** (una
> pide ocho), no con uno y un botón «agregar»: eso esconde el pedido. En el
> teléfono la tabla se da vuelta: cada renglón pasa a ser un bloque con sus
> columnas etiquetadas.
>
> Un estado especial: cuando la IA ya reescribió su respuesta con lo hablado en
> la sesión, la pantalla muestra **los dos textos enteros** lado a lado —el suyo
> y el propuesto— para que compare y apruebe. Nada de resúmenes ni links:
> aprobar lo que no se leyó es aprobar sin leer.

---

*Las pantallas construidas hoy viven en `app/customer-success/` y
`app/compartido/[token]/TareaCliente.tsx`. Los datos salen de `lib/cs-cartera.ts`,
`lib/cs-contrato.ts` y `lib/programa-campos.ts`.*
