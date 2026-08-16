# LA PROPUESTA — Onboarding de MaKo

Raíz del repo: `C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\`

---

## 0. La tensión, resuelta antes de empezar (porque decide todo lo demás)

El antipatrón escrito no es "poco movimiento". Es **movimiento que no significa nada**. Un gradiente morado no es feo por morado: es feo porque no informa. Un glassmorphism no es cripto por el blur: es cripto porque el blur no transporta un dato.

De ahí sale la regla que gobierna toda esta propuesta, y es una sola:

> **Cada píxel que se mueve transporta un hecho del negocio del cliente. Si no transporta ninguno, no se mueve.**

Las cuatro consecuencias operativas, todas verificables en review:

1. **Un nodo que aparece = una cosa que MaKo entendió.** No hay partículas, ni destellos, ni confeti, ni "✨ Analizando la magia de tu negocio". El espectáculo es que el dibujo es *tuyo*.
2. **El dorado es un verbo, no un adorno.** La regla ya está escrita en `app\_ui\ui.css:438` y en `MakoBrand.tsx` (donde `shimmer = false` es el **default**, línea 70): destellos y barridos solo para el momento en que MaKo está haciendo algo. El dorado se enciende mientras lee el documento y **se apaga cuando termina**. Un dorado permanente es decoración y viola una regla del repo.
3. **Un solo "momento" por sesión.** Vocabulario con jerarquía: micro 100 ms (hover), transición 250 ms (pantalla a pantalla), momento 600 ms (una vez, el mapa completándose). Si todo celebra, nada celebra.
4. **La celebración es un dato, no una animación.** El premio por terminar son tres tareas y un número, no fuegos artificiales. Es el patrón Linear ("estado de éxito limpio, sin celebración excesiva") y es el que le podés mostrar a un socio sin vergüenza.

**Y el movimiento más grande de todos: no hay gema.** Elegir una metáfora que sale del producto hace que toda la discusión técnica de la gema (three vs Rive vs canvas, 235 KB, refracción, `feDisplacementMap`, matcaps) **desaparezca**. Ese es el mayor ahorro de esta propuesta y es un efecto lateral de la decisión de producto, no de la de ingeniería.

---

## 1. LA METÁFORA

### Las tres opciones

**A) EL MAPA — "tu segundo cerebro"**
El grafo del negocio que ya existe en `/second-brain`: 42 nodos y 51 aristas medidos sobre un workspace completo, con cinco carpetas madre que forman una frase (*este NEGOCIO vende esta OFERTA a este MERCADO diciéndole este MENSAJE por este FUNNEL*), doce áreas y una dimensión de autoría ya modelada: `mako` / `usuario` / **`pendiente`** (`lib\cerebro-modelo.ts`).

- **Pro decisivo:** el equivalente de "pulir la gema" ya está en el tipo de datos. Un nodo `pendiente` es literalmente un hueco; llenarlo es literalmente pulir. Y la evolución de Opal ("más brillante e intrincada con las semanas") acá no es una animación: es que el mapa se densifica cuando el negocio crece. Nada de esto hay que inventarlo.
- **Pro 2:** es el artefacto generado del mecanismo M4 (Gamma). El artefacto *es* la activación.
- **Pro 3:** existe, anda, está medido y el dueño ya decidió cómo se llama ("tu segundo cerebro", 8/8/2026) y que se diseña primero suelto.
- **Contra real:** el dueño ya lo miró y dijo *"se ve feo, se siente lageado, no se entiende"*. Esa es una deuda de ejecución, no de concepto, pero es deuda y hay que pagarla.
- **Contra 2:** un "cerebro" suena a IA-magia. Se resuelve con el sustantivo de pantalla (ver abajo).

**B) LA SALA DE CONTROL — los paneles que se encienden**
La dirección estética se llama *Calm Intelligence Command Center*; la metáfora sería literal: paneles apagados que se encienden a medida que MaKo entiende.

- **Pro:** cero fricción con la dirección estética. Es la dirección estética.
- **Contra que la mata:** la gema de Opal habla del **usuario**. Una sala de control habla del **software**. Es la metáfora de "mirá qué buena es mi app", que es exactamente el error de onboarding que la literatura llama *explicar en vez de dejar hacer*. Y una grilla de paneles con números que se encienden es, visualmente, **la terminal de cripto** — el otro antipatrón, alcanzado por el camino de intentar evitar el primero.

**C) EL EXPEDIENTE — la carpeta del negocio que se llena**
El Archivero ya existe como paso, y el vault ZIP ya existe con las cinco carpetas madre numeradas.

- **Pro:** adulto, profesional, cero riesgo de casino. Y el ZIP es un entregable real que el cliente se lleva.
- **Contra que la mata:** una carpeta que se llena es **inerte**. No hay nada que apretar, no hay reconocimiento — un índice de carpetas no te muestra nada que no supieras. Es la opción que cumple todas las reglas y no produce ningún momento.

### RECOMENDACIÓN: **A, el mapa.**

Con dos precisiones de nombre, que no son cosméticas:

- **El sustantivo de pantalla es "el mapa".** Concreto, físico, imposible de leer como magia. "Segundo cerebro" queda como nombre de la *feature* en el nav — el dueño ya lo decidió y no se estrena vocabulario.
- **El giro respecto de Opal, y es el que hace que esto sea de MaKo:** Opal dice *vos sos la gema*. MaKo **no** dice eso, y no debería: a un dueño de negocio de high-ticket no le vendés superación personal. MaKo dice **"tu negocio es una cosa que se puede ver entera, y hoy nadie la ve. Te la dibujo."** Es una promesa de legibilidad, no de transformación. Es adulta, es cierta y es exactamente lo que el producto hace.

> ⚠️ **Apuesta, no certeza:** que `construirCerebro()` sobre un workspace vacío devuelva el esqueleto con nodos `pendiente` (y no un grafo vacío). El tipo `Autoria` incluye `'pendiente'` con el texto *"todavía no existe"*, así que el modelo lo contempla — pero **hay que correrlo contra el ws 5 (Ananda, `pending`, abandonó en el primer paso)** antes de construir nada. Toda la Fase 1 depende de eso. Es una medición de 10 minutos.

---

## 2. LA PROMESA CUANTIFICADA

Antes de las tres: **lo que NO se puede sostener y por lo tanto no se escribe.**

Cualquier variante de *"te devolvemos X horas/año"* o *"+30% de ROAS"* es indefendible hoy. No hay baseline de horas, no hay cohorte, hay **cuatro clientes reales** y dos de ellos ni terminaron el onboarding. Y el precedente está a la vista: los "6+ años" de Opal necesitan **99,5 años de vida** para cerrar con su propia aritmética (22 días/año × 6 años). Copiamos el *frame* — mala noticia → buena noticia con un número grande — **nunca la aritmética**.

### Las tres

**Opción 1 — LA FÁBRICA.**
> *"Con lo que cargaste, MaKo ya puede escribir **72 anuncios distintos**. Hoy lanzás 4 por mes."*

El número sale de filas que existen: avatares × razones × formatos recomendados (`getAvatares()`, `getRazones()`, `getRecomendaciones()`). No es una proyección, es un `count`.
- **A favor:** es el número más grande y más honesto disponible, es 100% derivado de sus respuestas, y ataca justo donde está la competencia — la fábrica de creativos es el único diferencial real de 100ads.
- **En contra:** el copy tiene que decir **"escribir"**, jamás "ganadores". Y si el cliente cargó 1 avatar y 2 razones, el número es 6 y la promesa se desinfla.

**Opción 2 — EL MAPA.**
> *"MaKo entendió **42 cosas** de tu negocio. Vos escribiste 9."*

- **A favor:** irrefutable, es un conteo. Y la razón 42/9 *es* la palanca: dice "hice el trabajo por vos" sin adjetivos.
- **En contra:** 42 no se siente como "6 años". Dice lo que MaKo hizo, no lo que el cliente se lleva.

**Opción 3 — LAS MAÑANAS.**
> *"Todos los días a las 7, MaKo mira tus 47 anuncios y tus 12 leads antes de que abras la computadora."*

- **A favor:** cuantifica el trabajo entregado, que es la única forma honesta de cuantificar en B2B.
- **La descarto, y por un motivo específico:** el número necesita Meta conectado. Y en esta propuesta Meta pasa a ser **opcional**, justo porque ahí se muere la gente. O sea: la promesa se apagaría exactamente para las personas que más necesitan una razón para volver. Una promesa que solo aparece cuando todo salió bien no es una promesa, es una felicitación.

### RECOMENDACIÓN: **Opción 1 como titular, Opción 2 como segunda línea de la misma tarjeta.**

```
72 anuncios distintos
MaKo ya sabe qué decir, a quién y en qué formato.

Salen de 4 avatares × 6 razones × 3 formatos que armaste vos y dedujo MaKo.
De las 42 cosas que hay en tu mapa, 9 las escribiste vos.
```

Tres reglas duras que van con la promesa:

1. **El número se CALCULA en render, nunca se escribe en el copy.** El repo ya pagó esto: en `lib\cerebro-modelo.ts` está el comentario de que un cliente con cuatro avatares leyó un texto que decía "los TRES segmentos". Ningún número de esta pantalla puede ser un literal.
2. **Piso con salida.** Si el producto de la matriz da **< 12**, la tarjeta cambia sola a la Opción 2 (el conteo del mapa, que nunca es chico). No se muestra un número flojo: se muestra otro número.
3. **Medir antes de shippear.** Correr `avatares × razones × formatos` contra los 4 workspaces vivos (ws1, ws5, ws10, ws11) y ver la magnitud típica. Si la mediana es 15, el titular es mentira emocional aunque sea cierto aritméticamente. **Es un script que se tira, diez minutos, y es la regla del repo sobre umbrales.**

> ⚠️ **Apuesta:** que la magnitud típica sea de dos dígitos altos. No la medí.

### Y la mala noticia — dónde va y cómo se escribe

Va en la pantalla **8** (`fase:result`, "Tu diagnóstico"), que ya existe. Hoy muestra fase + cuello. Se reestructura en dos tarjetas, mala → buena, con aritmética hecha **sobre sus propias respuestas y nada más**:

```
Tarjeta 1 — lo que dicen tus números
Invertís unos $100 por día y lanzás 4 creativos por mes.
Redondeando: cada idea que probás se lleva $750 antes de que sepas si sirve.

Tarjeta 2 — lo que MaKo va a hacer con eso
Tu cuello no es el presupuesto: es la cantidad de ideas.
MaKo multiplica los creativos, no la inversión.
```

Sin benchmarks inventados, sin comparaciones contra "los que escalan". Solo su plata dividida por sus creativos.

⚠️ **Caso borde con consecuencia real:** quien contesta `0-3 creativos (o ninguno)` y `nada o menos de $20` rompe la división. Y es probablemente el perfil de Ananda (ws 5), la que abandonó en el primer paso hace tres semanas. La variante de fase 1 no puede ser una división:
> *"Todavía no estás probando ideas: estás apostando todo a una sola. Lo primero que hace MaKo es darte cuatro más."*

---

## 3. LA SECUENCIA, PANTALLA POR PANTALLA

Estructura: **20 pantallas** (hoy son 19). Se agregan dos (la puerta y el mapa), se saca una del wizard (la Retro), y **se cambia el estado de dos: Meta y Retro pasan a ser salteables de verdad.**

⚠️ **Nota de voz, y hay que decidirla:** el pedido es voseo, y escribo en voseo. Pero **hoy la app mezcla**: la pantalla 9 dice "Conecta la IA de MaKo" (neutro) y la 18 dice "Conectá Meta" (voseo); la 1 dice "¿Cuánto factura tu negocio?" (neutro) y la 2 "¿Cuánto invertís por día?" (voseo). La memoria del proyecto dice "copy en español neutro". **Son ~19 strings y una decisión, no un proyecto.** Si gana neutro, este documento se traduce en una pasada; lo que no puede seguir es la mezcla.

---

### ACTO 0 — La puerta *(NUEVA)*

**P1 · `puerta`** — pantalla completa, fuera de `WizardShell`.

Se ve el mapa **vacío**: el esqueleto de nodos dibujado con trazo punteado, todos `pendiente`, quietos. Sin logo girando, sin video 3D, sin gradiente.

```
H1   Esto es tu negocio, visto por MaKo.
sub  Hoy está en blanco. Vas a llenarlo en unos 40 minutos,
     y no vas a tener que escribir casi nada: la mayor parte la deduce MaKo.

btn  Empezar
pie  Se puede cortar y seguir después. Lo que contestás queda guardado.
```

**Por qué esta pantalla y no un splash:** es la mitad de arriba del *peak-end*. La última pantalla es exactamente este mismo objeto, lleno. Un splash de marca no se puede volver a mostrar al final; un dibujo vacío sí.

**El "40 minutos" es un dato medido, no un deseo:** Leila hizo los 12 pasos en 39 min. Mauricio en 2 h 36. Escribir "40 minutos" y que a alguien le lleve dos horas es una promesa rota en el peor momento. Escribir **"unos 40 minutos"** y calibrarlo cuando haya más de cuatro mediciones. ⚠️ Apuesta: con n=2 completados, 40 min es la mediana de una muestra de dos.

---

### ACTO 1 — El diagnóstico *(P2-P9 · las 8 de hoy, sin tocar el contenido)*

Las 6 preguntas + canal + resultado quedan **idénticas**. Lo único que cambia es la columna de 336 px.

**Hoy:** ahí corre `FaseLoopAnimado`, un loop autónomo que recorre las 5 fases cada 2.800 ms. Es movimiento que no transporta nada del cliente — es el antipatrón, hoy, en producción.

**Nuevo:** ahí va el mapa. Y con cada respuesta **un nodo se llena**:

| Pantalla | Nodo que se llena |
|---|---|
| P2 facturación | `Negocio → Diagnóstico → Facturación` |
| P3 inversión | `Negocio → Diagnóstico → Inversión` |
| P4 creativos | `Negocio → Diagnóstico → Creativos` |
| P5 canal | `Funnel → El funnel` (la carpeta madre se enciende) |
| P6 volumen | `Negocio → Diagnóstico → Volumen` |
| P7 funnel | `Funnel → El funnel` (etapas) |
| P8 cuello | el nodo **de alerta**, naranja, el único que queda marcado |
| P9 resultado | el **Norte**, el único nodo dorado permanente del mapa |

Esto no es decoración: es el test operativo del antipatrón raíz. *Por cada pregunta, señalá la pantalla donde esa respuesta se ve.* Acá se ve en la siguiente, siempre, sin excepción.

**P9 · `fase:result`** — copy nuevo (las dos tarjetas de la sección 2).

```
H3   Tu diagnóstico
sub  Sale de tus seis respuestas. Si algo no te cierra, se cambia después
     desde Diagnóstico — no queda escrito en piedra.
btn  Seguir →
```

La segunda línea del sub existe por una razón: el diagnóstico usa **la mediana con sesgo hacia abajo**, no la moda. A un dueño que se autopercibe en fase 4 y le sale 2, decirle que es editable es la diferencia entre que siga y que cierre la pestaña.

---

### ACTO 2 — La llave *(P10 · `gemini`, arreglada)*

```
H3   La llave de la IA
sub  MaKo lee tus documentos, arma tu perfil y escribe tus anuncios con
     la IA gratis de Google. La sacás en aistudio.google.com/apikey, en un minuto.

     Lo que sigue de este arranque son unas 30 lecturas. Una llave gratis
     aguanta 250 por día. Si cargás dos, no te quedás a mitad de camino.

     [ Llave 1 ]  [ + Agregar otra llave ]

btn  Verificar →
```

Dos cambios y los dos son de producto, no de copy:

1. **Se piden hasta 3 llaves.** El dueño ya lo decidió (8/8/2026) y `lib\ai-cheap.ts` + `lib\ia-cuotas.ts` ya lo soportan. Es la línea que impide que el reveal del final no exista porque la IA se murió en la pantalla 12. **Sin esto, todo lo demás de esta propuesta es opcional.**
2. **El número está a la vista.** "30 lecturas contra 250 por día" es honestidad operativa y, de paso, es *labor illusion* real: le estás diciendo cuánto trabajo se viene. No hay que fingirlo.

⚠️ **Bug que hay que arreglar en este mismo paso:** al recargar la página, `geminiConectada` sale de `data.geminiConfig.configurado`, y `estadoCampo` devuelve `configurado: true` con solo tener un valor descifrable guardado (`lib\credenciales.ts:217-228`). O sea: **una llave guardada que dejó de funcionar pasa el gate de `puedeAvanzar`** — justo el caso del free tier agotado. Al recargar hay que re-verificar contra Google, no confiar en "hay algo guardado".

---

### ACTO 3 — El Archivero *(P11, con la ilusión de trabajo que es de verdad)*

```
H3   Tirá acá lo que tengas
sub  Un PDF de tu oferta, la transcripción de una llamada, tus notas sueltas.
     MaKo lee todo y llena solo lo que pueda del mapa.
     No hace falta que esté prolijo.
```

Y mientras lee — esto es lo importante — **no hay barra de progreso**. Hay una lista:

```
Leyendo  Oferta-2026.pdf
         ✓ Tu oferta principal          → nodo Oferta
         ✓ El precio                    → nodo Oferta
         ✓ Dos objeciones frecuentes    → nodo Cliente ideal
Leyendo  llamada-19-jul.txt
         ✓ Un avatar nuevo              → nodo Avatares
```

Cada línea que aparece se corresponde con un nodo que se llena en el mapa de al lado. **Es el experimento de Buell & Norton exactamente: mostrar los vuelos que se están buscando vale +8%; una barra genérica, no.** Y acá no hay que falsearlo: el trabajo es real, son ~30 llamadas de IA.

⚠️ **Y es un amplificador con signo.** El mismo paper dice que la ilusión de trabajo hace que un producto bueno se vea mejor **y uno malo se vea peor**. Si la extracción del Archivero saca porquerías, esta pantalla las exhibe en primer plano. La contra-medida no es esconderla: es que el Archivero ya tiene el handler que **abre las preguntas en vez de avanzar** cuando le faltan datos (`archiveroRef.current.siguiente()`). Eso se queda.

---

### ACTO 4 — Lo que MaKo entendió *(P12-P17 · las 6 de hoy, contenido intacto)*

`productos` · `entregable` · `avatares` · `persona` · `personalidad` · `angulos`.

Cambio único: cada una **cierra con sus nodos aterrizando en el mapa**, y el contador del pie sube.

```
pie  18 de las 42 cosas de tu mapa. 6 las escribiste vos.
```

Ese contador es el **endowed progress** (Nunes & Drèze: 19% vs 34% con el mismo esfuerzo real) y es honesto porque arranca con ventaja de verdad — MaKo ya dedujo cosas del Archivero antes de que el cliente escribiera nada.

⚠️ **Y no reemplaza los dots del `WizardShell`.** Esos siguen con su política escrita ("honesto o mudo, pero nunca mentiroso": son las 12 secciones, no las 20 pantallas, y el punto no se mueve dentro de una sección, a propósito). Son dos indicadores de dos cosas distintas: uno dice *cuánto falta del trámite*, el otro *cuánto tenés del negocio*. No se fusionan.

---

### ACTO 5 — El reparto *(P18 · `contacto`, sin cambios)*

Queda igual: nombre / email / WhatsApp con el Dropdown de banderas-como-imagen (los emoji de bandera en Windows se ven como letras), código de 6 dígitos, verificación.

---

### ACTO 6 — Meta, ahora CON SALIDA *(P19 · el cambio más importante de toda la propuesta)*

Los datos: de cuatro clientes reales, **los dos que no terminaron murieron en un paso de conexión, no de contenido**. Leandro llenó nueve pantallas de negocio sin quejarse y está trabado **hace 9 días** en un paso que ocurre dentro de la consola de Meta Business — usuario de sistema, 3 activos, 8 permisos, expiración "Nunca". Y como el wizard es bloqueante y no tiene salida, no puede entrar a la app a hacer otra cosa mientras lo resuelve.

**El wizard bloqueante no causó el tropiezo. Convirtió un tropiezo en un abandono de nueve días.** Eso es lo que hay que arreglar, y vale más que el reveal, la metáfora y la promesa juntos.

```
H3   Conectá Meta
sub  Es lo último y es lo único que pasa fuera de MaKo. Cuando esté,
     MaKo empieza a mirar tus anuncios todas las mañanas.

     [ Conectar Meta ]

pie  Lo hago después → entrás igual, y MaKo te lo recuerda en /general.
```

Ese pie tiene que **funcionar de verdad**, y hoy no existe:
- `action: 'skip'` es un flag del body que **no usa nadie en la UI** (cero ocurrencias de `skip: true`).
- Y aunque se usara, `onboardingPendiente()` devuelve `s.status !== 'done'` — así que `'skipped'` **también rebota al wizard**. El estado está modelado y no libera nada.
- El slot para ese pie ya existe y está sin usar: **`extraFooter` de `WizardShell`**.

Tres tareas aprobadas (#610, #302, #54) cuelgan de esta pieza que no está construida. **Esta es la Fase 2 y probablemente sea lo primero que habría que mergear.**

---

### La Retro se va del wizard

Hoy es la pantalla 19 y está gateada a `ext.jobs.meta_metrics.status === 'done'`. Si Meta pasa a ser opcional, una Retro obligatoria es un candado atado a una puerta abierta. Y hay un motivo aparte y peor: la Retro **miente con solo Meta conectado** (`docs\hallazgos-plan.md` #164).

La Retro pasa a ser **lo primero que espera en `/general`**, con su propio botón. Es el mecanismo M14 (everboarding): el onboarding sigue después del dashboard, como en 30 de 37 flows B2B auditados.

---

### ACTO 7 — EL MAPA *(P20 · la pieza interactiva. Ver sección 4.)*

---

### ACTO 8 — El plan

Sale a `/plan/revisar/<id>` con el borrador ya escrito. **Sin la espera de hoy** (ver Fase 3).

---

## 4. LA PIEZA INTERACTIVA DEL FINAL

### Qué es

**"Los huecos".** Pantalla completa, fondo oscuro, el mapa entero del cliente dibujado y quieto. Nada gira. Nada brilla.

De los ~42 nodos, hay unos pocos con trazo punteado: los `pendiente`. Tres de ellos **respiran despacio** — los tres que cuelgan del cuello de botella que el propio cliente eligió en la pantalla 8.

```
H1   Tu negocio, entero.
     MaKo entendió 42 cosas. Nueve las escribiste vos.

sub  Estas tres todavía están en blanco, y son las que tocan tu cuello.
     Elegí por dónde arranca MaKo.
```

### Qué hace el usuario

**Hace click en un nodo hueco.** Tres veces, uno por uno.

### Qué ve

Con cada click, y en este orden exacto:

1. El nodo **se llena** — de punteado a sólido, 250 ms. No explota, no se rompe una costra, no salen partículas. Se llena.
2. Se dibuja **una línea** desde el nodo hasta el borde derecho, 350 ms.
3. Del otro lado de la línea **aparece una tarjeta de tarea**, con el texto que MaKo ya escribió, y su deadline. 250 ms.

Tres clicks, tres tareas. El botón cambia a **`Ver mi plan →`**.

Eso es todo. Los tres momentos suman ~850 ms cada uno, ocurren tres veces, y son los únicos "momentos" de las 20 pantallas.

### Con qué dato real se conecta — la parte que hace que no sea decorativa

Las tres tareas que el cliente eligió **son las tres primeras tareas de su borrador de plan**, el que ya escribe `/api/onboarding/plan-arranque` hoy. No es una animación seguida de una tarea: **el click es lo que ordena el plan.** El cliente sale de la pantalla y en `/plan/revisar` están, arriba, esas tres, en el orden en que las tocó.

Y la cadena entera es de datos reales, sin un solo eslabón inventado:

```
sus 6 respuestas → cuello de botella → nodos `pendiente` de esa área
    → el click → orden del borrador → las 3 primeras tareas del plan
```

Por qué esto le gana a la gema, punto por punto:

| | Opal | MaKo |
|---|---|---|
| Qué apretás | un token bonito | un hueco de tu negocio |
| Qué pasa | vuela tierra | se llena el hueco y nace una tarea |
| Qué queda | nada | tu plan, ordenado por vos |
| Cuándo pasa | después de pagar, y faltan 8 pantallas | al final, y es el final |

Opal lo pone **post-paywall y a mitad de flujo**, y su propio análisis registra que le falta cierre (*peak-end rule*). Acá el momento es el cierre. Eso es una mejora sobre el original, no una copia.

### Los tres detalles de ejecución que la hacen o la rompen

1. **No cabe en `WizardShell`.** La tarjeta es de 980 px, el aside de 336, y **el pozo de contenido está capado a 480 px** (`WizardShell.tsx:243`). Un mapa en 480 px es un chiste. Solución: esta pantalla **no usa `WizardShell`** — se pinta full-bleed, exactamente como ya lo hace el reporte de la Retro en el mismo archivo (`if (retro?.reporte) return <div style={{position:'fixed', inset:0, zIndex:100 …}}>`). El precedente está a 200 líneas de distancia.
2. **`zIndex: 100` está por DEBAJO de la pila de modales** (`Z_BASE = 130` en `pila-modales.ts`). Si algo de esta pantalla abre un modal, se pinta encima sin error ni síntoma. Respetar la escala.
3. **`prefers-reduced-motion`: no se apaga, se salta al final.** Es el patrón de la casa (`VisualCanvas.tsx:188`) y acá significa: el mapa aparece completo de una, y el click llena el nodo en ≤150 ms sin línea animada. La tarea aparece igual. Nadie con reduce se queda sin la pieza — se queda sin los 850 ms.

⚠️ **Apuesta:** que los tres nodos `pendiente` colgados del cuello **existan siempre**. Si un cliente completó todo, no hay huecos y la pantalla se queda sin pieza. Necesita un fallback: si hay menos de tres pendientes, se ofrecen los tres nodos de **menor grado** del área del cuello con el copy cambiado a *"elegí por dónde arranca MaKo"*. Hay que medirlo contra ws1 y ws11 (los dos `done`).

---

## 5. LA IMPLEMENTACIÓN

### La técnica: SVG + rAF, cero dependencias nuevas

No canvas, no `three`, no Rive, no Lottie. El motor **ya está escrito y medido**: `app\second-brain\Grafo.tsx`, 1.953 líneas, con entrada escalonada por grado (12 ms por nodo hasta ~700 ms), flotación por nodo con fase derivada del hash del id escrita por rAF, vuelo de cámara easeInOutCubic de 520 ms, y física d3 cargada perezosamente solo al arrastrar (`await import('d3-force')` en `fisica.ts:102`). Hay hasta banco de medición: `scripts\medir-grafo.mjs` y `scripts\probar-grafo.mjs`.

Construir un motor de canvas nuevo para esto sería construir el segundo motor de animación del repo para dibujar lo mismo que ya dibuja el primero.

Dos deudas del motor que hay que pagar al reusarlo, las dos ya diagnosticadas en el repo:
- **Guarda de visibilidad.** Ningún loop de rAF de la casa tiene `IntersectionObserver` ni `document.visibilityState`. Es el mismo antipatrón que `docs\hallazgos-infra.md:876` (el polling global que hace 1.020 req/h con la pestaña minimizada). Se agrega acá.
- **`view-transition-name` está descartado con medición** para el nacimiento de un nodo: no captura hijos de un `<svg>` en Chromium y React 19.2.4 no exporta `ViewTransition`. Si hace falta, es FLIP a mano (~40 líneas). Para el reveal probablemente ni haga falta: el nodo no viaja, se llena en el lugar.

---

### FASE 1 — El mapa en la columna de 336 px *(lo que se ve andando primero)*

**Objetivo:** entrar al onboarding, contestar la primera pregunta, y ver un nodo llenarse. Nada más. Sin reveal, sin puerta, sin copy nuevo.

| Qué | Dónde |
|---|---|
| Componente nuevo, client | `C:\...\dashboard-marketing\app\onboarding\MapaPanel.tsx` |
| Modelo puro que puede importar (sin `server-only`, a propósito) | `C:\...\dashboard-marketing\lib\cerebro-modelo.ts` |
| Posiciones, se calculan en el server | `C:\...\dashboard-marketing\lib\cerebro-layout.ts` |
| Dónde se enchufa (prop `escenario`) | `C:\...\dashboard-marketing\app\onboarding\OnboardingWizard.tsx:504-593` |
| Lo que reemplaza en las pantallas de fase | `FasePanel` / `FaseLoopAnimado`, mismo archivo, líneas 822-881 |

**Las cuatro trampas, todas ya pagadas por el repo:**

1. **Jamás importar `lib\cerebro-grafo.ts` desde el componente cliente.** Tiene `server-only` y arrastra `productos → workspace → auth → next/headers`. Rompe el build **y `tsc --noEmit` da verde** — la única red que lo caza es levantar la página. Es exactamente el motivo por el que `cerebro-modelo.ts` existe separado, y está escrito en su cabecera.
2. **No pollear `construirCerebro()`.** Hace 21 lecturas y pesa 27-40 kB de JSON (`lib\agente-contexto.ts:9`). Se construye **una vez** en el server component y viaja como prop; cada paso devuelve solo **los ids que acaban de llenarse**.
3. **A ≤820 px la columna del escenario colapsa a alto 0 y desaparece sin un solo error.** La media query (`app\globals.css:495`) pisa el `min-height`. El mapa necesita alto explícito: `clamp(200px, 30vh, 320px)`, nunca heredado.
4. **`PanelMarketing.tsx` tiene 8 consumidores**, no 7: los 7 del componente entero más `app\second-brain\BotonClaude.tsx:24`, que importa `Carrusel` y `EnlaceMaKo` sueltos. Tocarlo mal rompe `/integraciones`, el onboarding de cada tab **y la página donde se está prototipando el mapa**. Se agrega un modo, no se reescribe el archivo.

---

### FASE 2 — La salida *(la que más plata vale, y no tiene nada de épica)*

Construir el concepto de **paso opcional**, que hoy no existe.

| Qué | Dónde |
|---|---|
| Que `'skipped'` libere la app | `C:\...\dashboard-marketing\lib\onboarding-state.ts:127-137` (`onboardingPendiente`) |
| Que la UI mande el flag | `C:\...\dashboard-marketing\app\onboarding\OnboardingWizard.tsx` + `extraFooter` de `WizardShell` |
| El flag ya existe en el server | `C:\...\dashboard-marketing\app\api\onboarding\route.ts:173,353` |
| La lista de qué es salteable | `C:\...\dashboard-marketing\lib\capas.ts` |

⚠️ **El guard va en POSITIVO.** La lista dice **cuáles** pasos se pueden saltear (`['integraciones','retro']`), nunca "todos menos". Es la regla del repo y la razón es que la negativa se queda vieja sola: cada paso nuevo entra a la lista de los que nadie contempló.

Y el aviso de que quedó pendiente **va donde el dueño mira** — un chip en `/general`, no un `console.warn`, no solo un aviso. Un aviso es un evento; lo que hace falta es un estado.

---

### FASE 3 — El reveal, y mover el trabajo pesado

Dos cosas, y la segunda es la que más se nota:

**a) La pantalla.** Full-bleed fuera de `WizardShell`, siguiendo el molde del reporte de Retro en el mismo archivo. Reusa `Grafo.tsx` en modo onboarding: sin filtros, sin buscador, sin exportar, sin drag.

**b) `plan-arranque` se adelanta.** Hoy corre **al final**, tarda decenas de segundos (`maxDuration = 120`), y el botón dice "MaKo está armando tu plan…" en el peor momento posible: cuando el cliente ya terminó y quiere salir. Se dispara **al entrar al Archivero** (pantalla 11), en background. Cuando el cliente llega al mapa, el borrador ya está y el click solo lo reordena.

Eso convierte una espera de 40 segundos en cero, sin optimizar una sola línea del endpoint. Es la mejora de rendimiento más barata que tiene este onboarding.

---

### FASE 4 — La puerta y los copys

Lo más barato y va último a propósito: es `MapaPanel` en tamaño grande más strings. Incluye la decisión de voseo vs neutro en una pasada.

---

### FASE 5 — La promesa

El contador por autoría (`nodos.filter(n => n.autoria === 'usuario').length`) y el producto de la matriz. Trivial una vez que existe la Fase 1. Y **antes de shippearla, el script de diez minutos que mide la magnitud contra los 4 workspaces.**

---

### Prerrequisito que no es una fase: las llaves de IA

El multi-key de Gemini (ya decidido por el dueño). Sin eso, hay un cliente que se queda sin IA en la pantalla 12 y ninguna de las cinco fases existe para él. **Va primero o va con la Fase 1.**

---

### Lo que NO se toca

- Los dots de `WizardShell` y su política de progreso.
- El contenido de las 6 preguntas de fase, sus 5 opciones y la mediana con sesgo hacia abajo.
- La geometría de 980/336/480. No se convierte en lienzo. El lienzo aparece **una sola vez**, en la pantalla 20, y por fuera.
- El orden de los pasos: fase primero (es el Norte), gemini segundo (mueve toda la IA), Meta último. Está justificado en `lib\capas.ts:119-133` por pedido explícito de las dos personas.

---

## 6. LO QUE NO HAY QUE HACER

Con nombre y apellido.

1. **No una gema 3D.** No `three` (182,8 KB gzip), no `@react-three/fiber` (51,8 KB), no `@react-three/drei` (520,8 KB), no Rive, no Lottie. Y el argumento que cierra la discusión no es el peso: **la opción 3D obliga a construir igual el fallback 2D** para reduced-motion y para el 4,82% de máquinas con "major performance caveat". No te ahorra construir la 2D — te obliga a construir las dos.

2. **No un splash 3D de apertura.** La pantalla 1 es el mapa vacío. Un video de marca no se puede volver a mostrar al final; el dibujo vacío sí, y esa repetición *es* el arco.

3. **No "Calculando…" ni "Preparando tu reporte".** MaKo hace ~30 llamadas de IA reales. Poner un loading falso de 4 segundos en un producto B2B, donde el usuario **sabe** cuánto tarda una llamada a la API de Meta, es el riesgo reputacional más grande de la lista. Y la táctica ya está sobreusada en consumer.

4. **No paywall en el onboarding.** No existe la tabla de planes: `CapaId` son tres, `workspaces` solo tiene `activo | pausado`, cero apariciones de `plan_free` o `trial`. Un paywall sin plan es una pantalla que miente. Dos tareas (#611, #310) ya están bloqueadas por esto — y lo que hay que hacer primero es la **definición de producto**, no la pantalla. Lo mismo vale para el *reverse trial*: es un buen mecanismo y hoy es inejecutable.

5. **No racha ni streak.** Duolingo funciona porque el producto **es** la práctica diaria. Un SaaS de marketing tiene ritmo de campaña. Una racha castiga al cliente por irse de vacaciones. *(Contra-argumento honesto: Duolingo lo resolvió con streak freeze y el Weekend Amulet, +2,1% D7 / +4% D14. O sea, es resoluble. Igual lo descarto, pero por el ritmo, no porque sea imposible.)*

6. **No badges, XP, niveles, confeti ni leaderboard entre clientes.** La regla de Vohra es un test de diagnóstico, no una opinión: *si necesitás badges, el problema está en el core loop.* Y el riesgo real no es estético, es el *overjustification effect*: el dueño ya tenía una razón para hacer esto (su negocio) y le estás ofreciendo una peor.

7. **No el prompt de review de App Store ni el "fist bump".** Opal mete el review **adentro** de su pantalla de reporte y su propio reviewer lo llama *"a very weird place"*. El fist bump lo llama *"a bit of a gimmick"*. No se copia lo que el analista de la fuente marcó como error.

8. **No el leaderboard borroso con datos falsos.** Opal muestra una lista de "quién usa más el teléfono" que el usuario cree que son sus amigos y **el 100% de los datos es inventado**. En consumer es un truco sucio; en B2B, donde el cliente compara contra sus propios números, es que te descubran mintiendo el día uno.

9. **No el grafo de graphify.** `/api/admin/graph` son 4.165.285 bytes y 4.440 nodos cuyos ids son archivos `.ts`. Es el mapa del código de MaKo. Mostrarle a un cliente la ingeniería interna en el momento en que esperaba ver su negocio es el opuesto exacto del efecto buscado, y ya está escrito así en la cabecera de `lib\cerebro-grafo.ts`.

10. **No alargar con preguntas cuya respuesta no vuelve.** Lose It! subió los trial starts de dos dígitos agregando preguntas que ni usa. **Eso no transfiere.** En consumer de hábitos la fricción se lee como rigor; en B2B, con el tipo en horario laboral, una pregunta que no reaparece se lee como formulario de CRM. Y la evidencia local es contundente: los que abandonaron acá no murieron por largo — Leila hizo 39 minutos y terminó.

11. **No dejar el wizard bloqueante en el paso de Meta.** Es el bug de producto más caro que tiene el onboarding hoy y tiene un cliente parado adentro hace nueve días.

12. **No gradientes morados, glassmorphism ni "MaKo está desbloqueando la magia de tu negocio".** El dorado se enciende cuando MaKo está trabajando y se apaga cuando termina. `shimmer = false` es el default de `MakoBrand` y así se queda.

13. **No convertir el `escenario` en lienzo "porque el mapa necesita espacio".** Son 8 consumidores y dos de ellos son `/integraciones` y el onboarding de cada tab. El lienzo aparece una vez, en la pantalla 20, y por fuera del shell.

14. **No `view-transition-name` para animar el nacimiento de un nodo.** Ya se descartó con medición, por dos razones independientes. Si aparece en un PR, es que alguien no leyó `docs\hallazgos-onboarding.md:296-311`.

15. **No un número fijo de promesa tipo "6 años".** Con cuatro clientes y dos completados no hay cohorte que lo sostenga. **Y ese es el diferencial, no la carencia:** Opal tiene un número de folleto igual para todos; MaKo tiene el tuyo. Decilo así.

---

## Los tres números que decido shippear, y los tres que no

| Decido | Por qué |
|---|---|
| **El mapa como metáfora** | El "pulido" ya está en el tipo de datos (`autoria: 'pendiente'`). No hay que inventar un objeto. |
| **La promesa derivada, nunca fija** | Es lo único honesto con n=4, y resulta ser mejor que la alternativa. |
| **Meta opcional con salida real** | Es donde se muere el 50% de los clientes reales medidos. |

| No decido — hay que medir antes | Cómo, en diez minutos |
|---|---|
| Que `construirCerebro()` dé esqueleto en un ws vacío | Correrlo contra el ws 5 (Ananda, `pending`) |
| Que `avatares × razones × formatos` dé dos dígitos altos | Un script contra ws1, ws5, ws10, ws11 |
| Que "unos 40 minutos" sea cierto | Hoy la mediana es de una muestra de dos (39 min y 2 h 36) |

---

**Para la cosecha:** esto va a `docs\hallazgos-onboarding.md` — el área es donde vive el wizard. Y lo que corresponde escribir ahí no es la propuesta, es el cruce que la produjo: **el diagnóstico obvio del onboarding de MaKo era el equivocado.** No se cae por largo ni por falta de espectáculo (Leila hizo 39 minutos y terminó): se cae en un OAuth ajeno, y lo que convierte el tropiezo en abandono es que el wizard sea bloqueante y no tenga salida. Toda la literatura de onboarding —14 mecanismos, 8 antipatrones— no nombra ni una vez el modo de falla de depender de la consola de otra empresa. La regla que queda: **un paso de onboarding que ocurre fuera de tu app es salteable por definición, o es un embudo con tapón.**