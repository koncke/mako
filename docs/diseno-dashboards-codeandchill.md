# Diseño — lo que aprendimos mirando los 114 tableros de Code and Chill

**Fecha de la medición: 31/10/2026.** Todo lo de acá se miró ese día en las demos vivas de
`demo.codeandchill.store`. Son demos de una tienda: pueden cambiar sin aviso, y varias
**re-siembran sus datos en cada carga** (el mismo pipeline de Hearth dio $10,84M en
escritorio y $7,43M en teléfono). Si dentro de un mes un número de este documento no
coincide, el documento no está mal: la demo cambió.

Pedido de Martín (31/10/2026, 00:08): *«Revisa esa pagina de templates de diseño, quiero
que bajes a tierra todos los templates… mira y analiza los videos para copiar los diseños.
Esto se aplica en muchos lugares, principalmente en DASHBOARD para el rediseño de los
templates y bloques con base en esto. Y luego en toda la app mobile y desktop aplicar estos
diseños.»*

---

## ⚠️ El límite, y por qué este documento está escrito así

> **Corregido el 31/10/2026:** lo de abajo fue el error de la primera vuelta. Una referencia que manda Martín se copia con sus valores (`AGENTS.md`). Los valores están en `docs/diseno/`.

**codeandchill.store es una tienda: lo que vende es el código.** No se bajó, no se copió y
no se pegó nada de su HTML, CSS, JS, fuentes ni imágenes, y no se leyó su fuente. Lo único
que se hizo es **mirar las demos, tocarlas y describir el patrón con palabras nuestras**.

Un patrón de interfaz —dónde va la jerarquía, cómo entra un panel, qué se mueve al
arrastrar— no es de nadie. Su implementación sí. Por eso acá no hay un solo valor suyo:
**cada medida, color y curva de este documento es nuestra**, expresada en nuestros tokens
(`app/globals.css`, `app/_ui/tokens.ts`, `lib/graficos-temas.ts`). Lo que se toma de ellos es
la **idea**, y queda dicho de dónde salió.

Lo mismo vale para lo que se implemente después: esto se construye de cero. Si algún
movimiento no se entiende sin ver el código, está anotado abajo en
[§11](#11-lo-que-no-se-pudo-ver) y Martín decide si compra el template.

---

## 1. Qué se miró, y qué no

No se miraron los 114 con la misma profundidad, a propósito. Esto es lo que quedó visto y
lo que quedó sin ver, para que nadie suponga cobertura que no hay.

**A fondo (se abrió la demo, se tocó, se midió cuadro a cuadro) — 26:**

| Grupo | Templates |
|---|---|
| Tablero que se arma solo / morfea | **Corbel**, **Kairo**, Coffra, Kinlo, Merrin, Wynlo |
| Planificador de caja de arrastrar | **Talvo**, **Tilvo**, Orvel, Rivolo |
| CRM con tablero de arrastrar | Rapport, Sprig, Accord, Mender, Tessly, Lintel, Hearth, Selvar, Solvik, Kerfa, Tandem, Halden |
| Canales y reglas externas | **Tend** (WhatsApp 24 h), **Parley** (3 canales), Murmura (redes + roles) |
| Pagos | **Corvane** (umbrales, disputas, conciliación) |
| Automatizaciones | **Noria** (lienzo de nodos + corridas) |
| Marketing | Kestrel, Ondra |
| Vidrio | Vitrea, Pane (además de Solvik y Kerfa) |
| Login | Bamboo, Nocturne, Verso, Portal, Huddle, Vault, Tether (7 de 14) |
| Tienda | Oria (1 de 9) |

**Por encima (sólo la descripción de la tienda, sin abrir la demo) — el resto**, unos 55:
los ERP (Cadra, Sunrow), los de turnos y nómina (Pembra, Kelvo, Folka), los bancarios
(Kofra, Sovra, Grista, Kinby, Obolo, Rivlet, Ledra, Covry), los de local y punto de venta
(Ledge, Petalo, Ambrel, Mavora, Pelago, Olvara, Wharf, Solum, Fitlo), los verticales
(Ivora, Tavola, Lumora, Torque, Vessa, Pacely, Moorly, Kesta), y los personales (Rivet,
Stride, Meridian, Fathom, Prism, Coffer, Fernly, Orrery, Coterie).

**Sin ver:** 7 de los 14 logins (Mochi, Den, Flow, Lunara, Warden, Lumen, y **Pebble, que da
404** en su demo), y 8 de las 9 tiendas.

**Qué se perdió con eso:** los ERP y los de nómina tienen Gantt de arrastrar con empuje en
cascada (Cadra, Sunrow) y rejillas de turnos; si algún día hacemos planificación con
dependencias, ahí hay que volver. Nada de lo que quedó sin ver pesa sobre el Dashboard, que
es lo que pidió Martín primero.

---

## 2. El hallazgo que ordena todo lo demás

Los 26 que se miraron a fondo se ven caros por razones distintas, pero **todos comparten
una sola cosa**, y es la que más lejos está de lo que hacemos hoy:

> **Cada número dice de dónde salió, y la interfaz tiene un vocabulario visual para
> distinguir lo medido de lo supuesto.**

Selvar dibuja «lo que falta para la cuota» con **relleno rayado** porque todavía no existe.
Noria dibuja las horas que aún no pasaron como **ranuras punteadas vacías**, no como barras
en cero. Talvo marca las facturas estimadas con **círculo hueco** y las confirmadas con
círculo lleno. Orvel escribe el supuesto al lado del número derivado: *«alcanza para 2,7
meses — al ritmo de los últimos 90 días»*. Corvane pone **$6.482 de $7.599** al lado de cada
porcentaje.

Nosotros ya tenemos la mitad de esta regla escrita y es de las mejores que hay en el repo
(`AGENTS.md`: *«lo que no se puede medir no se estima: el campo queda en `null` y ni la
pantalla ni la API dicen una palabra — nunca un cero, nunca un "falta"»*, y la procedencia
`CRITERIO / SUPUESTO / MEDICIÓN` para los números que gobiernan gasto). Lo que no tenemos es
**la otra mitad: cómo se ve** un número supuesto cuando sí decidimos mostrarlo. Hoy un
pronóstico y una medición se dibujan igual.

Todo el resto de este documento cuelga de ahí.

---

## 3. Los patrones, uno por uno

Cada uno lleva: **nombre nuestro · qué problema resuelve · dónde se aplica (la tab concreta) ·
el movimiento con precisión · cómo cae en el teléfono**.

Las duraciones en milisegundos son **estimadas** muestreando cuadros, no cronometradas.
Donde no se pudo verificar, dice que no se pudo.

---

### A — El Dashboard primero (plantillas y bloques)

Es lo que Martín nombró como principal. El editor es de Looker y eso **no cambia**
(`docs/hallazgos-graficos.md`); lo que sigue es cómo se ven los bloques adentro.

---

#### A1 · La métrica se nombra tres veces

**El problema.** Un bloque nuestro hoy tiene título y poco más. Quien lo mira sabe cómo se
llama la métrica, pero no qué mide. Y el nombre corto que entra en una pestaña no es el
nombre que explica.

**Cómo lo resuelven.** En Kairo la cabecera del informe dice la misma métrica en tres
registros, y cada uno hace un trabajo distinto:

1. **La pastilla** del selector: la sigla, porque tiene que entrar en una fila (`MRR`).
2. **El título**: el nombre completo (`Monthly Recurring Revenue`).
3. **Una frase debajo**: la **definición** (`Monthly recurring revenue across every active
   subscription.`). Al cambiar a «Net MRR change» la frase pasa a ser
   `New, expansion and reactivation, minus churn and contraction.` — **la frase es la fórmula
   en castellano**.

Encima del título va una línea gris chica con **el grupo y el rango real**: `Revenue ·
Nov '24 – Oct '26`.

**Por qué importa acá.** Nosotros tenemos **cuatro definiciones distintas de «cerró»**
(`docs/hallazgos-graficos.md`), y el documento dice textual: *«Antes de "arreglar" un número
que no coincide con otra pantalla, mirá cuál de las cuatro definiciones es»*. Esa frase
debajo del título es exactamente el lugar donde esa ambigüedad deja de costar tiempo.

**Dónde se aplica.** `app/dashboard/Cabecera.tsx` (ya tiene título, emoji y subtítulo
editables en el lugar: el subtítulo pasa a ser **obligatorio y a significar la definición**,
no texto libre decorativo) y el título de cada tarjeta en `app/dashboard/editor-css.ts`
(`.lk-comp-tit`). En el catálogo, cada entrada de `TIPOS` / cada métrica de
`lib/graficos-catalogo.ts` debería traer su `definicion: string` corta.

**Cuidado con nuestra regla de texto.** `AGENTS.md` pone techo de *«el nombre y el número»*
a una cabecera de vista. Esto no la rompe: la definición **no es la cabecera de la pantalla**,
es el subtítulo del bloque, y cae en la fila *«una fila de una lista: una frase, ~110
caracteres»*. Una frase, no un párrafo.

**Teléfono.** La sigla y el título sobreviven; la frase de definición pasa a ser el contenido
del `ⓘ` que ya existe en nuestras tarjetas, no una tercera línea que coma alto. En
`app/m/dashboard` el título queda y la definición se toca.

---

#### A2 · El morfeo tiene dos modos, y elegir mal se nota

**El problema.** Cuando el usuario cambia un filtro, el rango o la dimensión, hoy nuestro
gráfico simplemente se vuelve a dibujar. Se ve como una recarga, no como una respuesta.

**Cómo lo resuelven — y acá hay una regla real, no un gusto.** Comparando Corbel, Coffra,
Kinlo, Talvo, Tilvo y Kairo cuadro a cuadro aparecen **dos técnicas distintas, y la elección
sigue una lógica**:

| Qué cambió | Técnica | Qué se ve |
|---|---|---|
| **Las mismas categorías, otros valores** (filtro de canal, de sede, de métrica comparable) | **Morfeo punto a punto** | Las marcas **no desaparecen**: se deforman en el lugar. El eje se re-etiqueta y los números cuentan |
| **Otro conjunto de categorías** (12 meses → 7 días) o **otro tipo de marca** (área → barras) | **Borrado y redibujo** | El área de trazado se vacía, el eje se re-escala **primero**, y las marcas crecen desde la base |

Coffra hace las dos en la misma pantalla: cambiar de sede morfea, cambiar de rango borra y
redibuja. Tilvo borra y redibuja al pasar de `Money in` (área) a `Net` (barras), y tiene
razón: **cambió la marca porque el dato puede ser negativo**. La forma sigue a la métrica.

**El detalle más fino, y es de Kairo.** Cuando morfea, **las marcas del eje interpolan
numéricamente en vez de apagarse**: pasan de `$160k / $120k / $80k` a `$155k / $117k /
$77,7k` camino a su destino. Talvo y Kinlo, en cambio, **blanquean las etiquetas del eje
durante el tránsito** (Talvo deja la píldora `Today` como un rectángulo de esqueleto) y las
devuelven ya re-etiquetadas. Las dos funcionan; la de Kairo se ve más cara **y sólo sirve si
las dos escalas son del mismo orden de magnitud** — interpolar de `$160k` a `$900` es un
contador enloquecido.

**El orden de operaciones que capturé en Kairo** (dos cuadros, click en «Net MRR change»):

- **Cuadro 1, inmediato:** la pastilla activa y **la leyenda** ya cambiaron (son estado, no
  animación). El título sigue siendo el viejo. El subtítulo se está apagando. El eje ya
  arrancó a interpolar (`$80k` → `$79,9k`).
- **Cuadro 2:** el título está a mitad de camino (el viejo sale por la izquierda), el
  subtítulo **ya es el nuevo** y está entrando, y el eje va por `$155k / $117k / $77,7k`.

O sea: **estado primero (instantáneo), texto después (cross-fade corto), geometría al final
(la más lenta)**. Nunca al revés.

**Nuestros números.** Estado: 0 ms. Texto: 160 ms de cross-fade con `--ease-out`. Geometría y
eje: 400 ms con `--ease-out` (`cubic-bezier(.23,1,.32,1)`, que ya es nuestro token). La
pastilla del segmentado viaja los mismos 400 ms.

**Al interrumpir.** Kerfa y Talvo lo resuelven igual y es lo correcto: el contador **sigue
desde el valor que está mostrando hacia el nuevo objetivo, no vuelve a cero**, y la píldora
del segmentado viaja desde donde esté. En Talvo probé `60 días` e inmediatamente `90 días`:
las burbujas redirigieron al destino nuevo **sin volver al principio ni parpadear**. Es el
detalle que evita que se sienta roto.

**Dónde se aplica.** `app/dashboard/Grafico.tsx` y `lib/graficos-agregar.ts`. La decisión
morfeo-vs-redibujo se puede derivar del catálogo: si cambia `dimension` o el `Grupo` del tipo,
es redibujo; si sólo cambian los valores, es morfeo.

**Teléfono.** El morfeo sobrevive bien porque no depende del ancho. Lo que **no** sobrevive es
el eje: Talvo en 375 px muestra marcas `$62,5k / $125k / $188k`, que no son números de
humano. Nuestra regla: en teléfono el eje usa **3 marcas redondas como máximo**, y si no hay
números redondos posibles, se muestran 2.

---

#### A3 · El filtro cambia el número y **también** cambia su comparación

**El problema, y es un bug conceptual que vale la pena no heredar.** En Corbel toqué las
pestañas `Overview / Online / In store` y capturé dos cuadros del morfeo. Los números
grandes cambian bien (`$48.320` → `$42.957` en vuelo → `$33.672`, contando). El eje del
gráfico de ingresos se re-etiqueta de `$56k/$44k/$32k` a `$40k/$30k/$20k`.

**Pero los chips de variación no se mueven: `+7,1% vs mes pasado` es idéntico en los tres
canales.** O el delta de «todas las ventas» está mal en dos de las tres vistas, o no está
atado al filtro. Es, exactamente, un número que parece medido y no lo está — en la cara
visible de la pantalla más importante del template más caro del catálogo.

**La regla que queda.** **Un filtro que cambia una cifra cambia su comparación, o la
comparación se va.** No hay tercera opción. Si el período anterior del mismo largo no se
puede leer para ese recorte, el chip no se dibuja (que es, otra vez, nuestra regla del `null`).

**Dónde se aplica.** `lib/graficos-agregar.ts` y el chip `↑ 1,3×` de
`docs/hallazgos-graficos.md`, que ya lee el período anterior del mismo largo. Hay que
verificar que lo lea **con los filtros efectivos aplicados** (`efectivoDe`), no con los de la
hoja.

---

#### A4 · Una tarjeta oscura entre claras

**El problema.** `AGENTS.md` lista entre lo feo *«cuatro bloques apilados del mismo peso sin
jerarquía»*, y una fila de KPIs idénticos es justamente eso: cuatro cajas que piden la misma
atención, así que no la pide ninguna.

**Cómo lo resuelven.** El truco se repite en cinco templates distintos y es el más barato del
catálogo: **de cuatro tarjetas iguales, UNA se invierte**. En Corbel la primera KPI es negra
y las otras tres claras. En Selvar la invertida es azul llena y marca la métrica del día. En
Rapport la tarjeta de cuota es verde oscuro, la única oscura de la pantalla. En Tessly y
Coffra los mosaicos van en pastel **tintado por lo que significan** (rosa = pendiente, verde
= gente, ámbar = gasto).

No es decoración: **es el ancla visual de la pantalla**. Rapport lo lleva al extremo —
columnas enteras de color pleno sobre fondo crema, con la columna «Closing» en negro
funcionando de ancla— y casi no usa sombras: **la profundidad la da el color, no la
elevación**.

**Dónde se aplica.** Nuestro editor ya tiene la pieza: la opción **«Fondo: Oscuro»** de un
bloque da vuelta los tokens dentro del marco (`app/dashboard/ElementoGeneral.tsx`). Lo que
falta es que **las plantillas la usen**: hoy `lib/graficos-plantillas.ts` arma filas de
bloques del mismo peso. La regla para plantillas nuevas: **en una fila de 3 o 4 KPIs, exactamente
una va invertida, y es la que contesta la pregunta de la hoja**.

**Y el que elige cuál no es el diseñador: es la plantilla.** `AGENTS.md` ya lo dice —
*«Una plantilla contesta UNA pregunta»*. La KPI invertida es la respuesta a esa pregunta.

**Teléfono.** En grilla 2×2 el truco sigue funcionando y de hecho mejora: la invertida arriba
a la izquierda es lo primero que se lee. Lo que **no** se puede es invertir dos.

---

#### A5 · El gesto sobre el gráfico se convierte en un chip de filtro

**El problema.** En nuestro editor, lo que se elige mirando *«es estado de la vista: no pasa
por `mutar`, no se guarda»* (`docs/hallazgos-graficos.md`). Está bien decidido, pero hoy ese
estado es **invisible**: no hay manera de ver qué recorte estás mirando ni de sacarlo.

**Cómo lo resuelven.** En Orvel se arrastra sobre los días del campo de pagos: aparece un
rectángulo de selección con borde discontinuo, **los puntos de afuera caen a ~20 % de
opacidad** (foco y contexto, sin ocultar nada) y **dos manijas** quedan posadas sobre la línea
de cero para re-ajustar. Al soltar, el gesto **se materializa en un chip removible**
(`📅 21 sep – 4 oct ✕`) y **todo el panel de abajo se recalcula a ese rango**.

Un gesto efímero sobre un gráfico queda convertido en **estado visible y deshacible**. Eso es
lo que le falta a nuestra barra de controles.

**Dónde se aplica.** `app/dashboard/BarraControles.tsx` y `app/dashboard/MenuFiltro.tsx`. El
chip ya existe en nuestra UI para los filtros de hoja; lo que falta es que **un recorte hecho
mirando el gráfico genere uno igual**, marcado como de vista (no persistido) y con su `✕`.

**Ojo con una regla nuestra.** Los filtros `fijo: true` son **de definición y no se dibujan**
—Martín: esos chips en la tarjeta *«no tienen mucho sentido»*—. El chip del gesto es lo
contrario: es de vista, es temporal y **tiene** que verse. Son dos cosas distintas y no hay
que mezclarlas: uno define el bloque, el otro define lo que estás mirando ahora.

**Teléfono.** El arrastre de selección sobre un gráfico en 375 px no funciona (compite con el
scroll). En teléfono el chip se genera desde el selector de período de siempre, y el gráfico
no acepta brush. Decirlo explícito evita que alguien lo intente.

---

#### A6 · La paleta cambia, el semáforo no

**El problema.** Tenemos 6 plantillas de estilo (`lib/graficos-temas.ts`) donde una hoja
guarda `plantilla`, `acento` y `fuente`, y *«todo lo demás lo decide la plantilla, así ningún
gráfico puede quedar mal combinado»*. Bien. Pero no está escrito qué pasa con el verde de
«bueno» y el rojo de «malo» cuando alguien elige un acento rojo.

**Cómo lo resuelven.** El panel de Ajustes de Corbel tiene una fila «Colour» con cuatro
opciones (Mono, Pastel, Ocean, Sage) dibujadas como **ruedas de cuatro cuartos** —la muestra
ES la paleta, no un cuadradito de color— y debajo, en gris, una sola frase:

> *«Blanco y negro por defecto. **Los colores de estado conservan su significado en cada
> paleta.**»*

Esa frase es la regla entera, y además está **dicha en la pantalla**, no escondida en una
guía. Y arriba del bloque: *«Appearance — se aplica al instante, en este dispositivo»*: el
alcance declarado, sin botón de Guardar.

**Dónde se aplica.** `app/dashboard/PanelEstilo.tsx` y `lib/graficos-temas.ts`. Tres cosas:

1. **La muestra de cada plantilla es su paleta**, no un cuadrado del acento. Hoy elegir a
   ciegas entre «Suave» y «Elevada» es adivinar.
2. **Escribir la frase.** Es una línea en el panel y cierra la pregunta para siempre. Encaja
   con lo que ya está decidido en `AGENTS.md`: *«UN SOLO SIGNIFICADO POR COLOR»*, y con
   `colorDeTono()`, que ya pinta una KPI *«según lo que SIGNIFICA su métrica, no según un
   color elegido a mano»*.
3. **El `acento` de la hoja no puede pisar `--good` / `--warn` / `--bad`.** Hoy el acento es
   «el primer color de la serie»; hay que garantizar en `tests/graficos-temas.test.ts` que
   ninguna plantilla ni ningún acento elegido por el usuario colisione con el semáforo. Ya
   medimos contraste ahí; esto es una medición más.

**Teléfono.** Igual. La fila de paletas pasa a scroll horizontal con las ruedas de 40 px.

---

#### A7 · El bloque vacío que se dibuja a sí mismo

Esto **ya lo tenemos y está bien**, y lo anoto sólo para que no se toque: *«Un bloque vacío
dibuja su placeholder: el mismo bloque con los datos de ejemplo de `muestras.ts` (ficticios),
apagado, con la acción que lo llena. "No pude leer" es otra cosa y se dice»*.

Es **mejor** que lo que hacen ellos. Mender muestra `0 cases / 0 First reply / 0 Satisfaction`
al entrar y recién cuenta hacia arriba cuando entran en pantalla: **si un día falla la carga,
el usuario ve ceros creíbles y nadie se entera**. Nosotros ya decidimos los tres estados
(vacío / sin leer / con datos) y la decisión de que *«un número en cero cuenta como vacío»*.

**Lo único que se puede robar:** que el placeholder se vea **apagado de verdad**. El de ellos
no existe; el nuestro sí, y conviene que la diferencia entre «ejemplo» y «tu dato» sea obvia
a un metro de distancia, no sólo por un rótulo.

---

### B — El CRM: el tablero de arrastrar

Nuestro CRM es un kanban por etapa. Se miraron doce.

---

#### B1 · Soltar cambia algo más que la columna

**El problema.** En un kanban, arrastrar y soltar es un gesto caro (dos manos de atención) y
hoy sólo produce un cambio de columna. El usuario no ve qué ganó.

**Cómo lo resuelven.** Los mejores no tratan el arrastre como el fin, sino como **la causa de
un efecto que se ve en otra parte de la pantalla**:

- **Rapport:** al soltar, el KPI «pronóstico ponderado» **de la cabecera de página** se
  recalcula ($713.157 → $750.264) mientras «pipeline abierto» queda igual — que es lo
  correcto, porque mover de etapa cambia la probabilidad, no el monto.
- **Tessly:** las sumas de las columnas **ruedan** del valor viejo al nuevo en vez de saltar.
- **Hearth:** arrastrar un préstamo a «Fondeado» hace **flotar su comisión hacia arriba** —un
  `+$7,21K` verde que sube y se desvanece— y recalcula tres cifras a la vez, contando.
- **Mender:** asignarle gente a un paso **cambia el estado del caso** de «New» a «Working».
  Causa y efecto en la misma pantalla.

**Dónde se aplica.** `/crm`. Nuestras etapas ya tienen requisitos y el funnel ya pondera.
Al soltar, lo que tiene que moverse es el **número de la cabecera**, no un cartel.

**El movimiento.** El número que cambia **cuenta** entre su valor viejo y el nuevo en 500 ms
con `--ease-out`. El `+$X` que flota: sube 24 px y se desvanece en 700 ms, arrancando desde
el borde superior de la tarjeta soltada. Si se sueltan dos seguidas, la segunda **reemplaza**
a la primera (así lo hace Tend, y es lo correcto: nadie lee dos).

---

#### B2 · La inclinación sigue al movimiento, no es una rotación fija

**El problema.** Una tarjeta que al agarrarla se inclina 3° fijos se siente de plantilla. Es
el adorno más barato y más obvio.

**Cómo lo resuelve Accord, que es el único que lo hace bien.** La inclinación **sigue la
dirección del movimiento**: moviéndola rápido a la derecha se inclina en sentido horario unos
2–3°; moviéndola a la izquierda, al revés; **cuando frenás, vuelve sola a 0°**. Es física de
naipe sobre una mesa. Tres grados que se mueven con vos convierten un `transform` en una ley.

**El movimiento, en nuestros términos.** El ángulo se deriva de la velocidad horizontal del
puntero, con tope en ±3°; sin velocidad, el ángulo se relaja a 0° en 220 ms con un
asentamiento tipo resorte suave. La tarjeta además se levanta (sombra `pop` de
`app/_ui/tokens.ts`) y crece ~2 %.

**Al soltar.** Accord aterriza la tarjeta **con un realce del color de la etapa que se
desvanece en ~1,2 s** hasta quedar como las demás. Es el «acá cayó» sin un cartel.

**Dónde se aplica.** `/crm`. Y acá hay que ser honesto sobre el costo: es el patrón más lindo
del catálogo **y el menos necesario**. Va último de esta sección, no primero.

**Teléfono.** La inclinación no aplica: en 375 px no hay arrastre libre (ver B4).

---

#### B3 · El encabezado de columna dice cómo se calcula el pronóstico

**El problema.** Nuestro funnel pondera por etapa, pero la ponderación vive en la
configuración. Quien mira el tablero ve sumas y no sabe de dónde salen.

**Cómo lo resuelve Tessly**, que tiene el mejor encabezado de columna de los doce: punto de
color + nombre + conteo; debajo, **la suma en grande**; y alineada a la derecha, en la misma
línea, **la probabilidad de la etapa** (`Qualify 10 % · Samples sent 30 % · Proposal 55 % ·
Negotiation 80 % · Won 100 %`).

**El tablero te enseña su propia aritmética sin una sola pantalla de ayuda.** Y en Tessly las
cuentas cierran: la «escalera» de la ficha de empresa suma 18.600 + 23.237 + 4.575 + 3.225 =
**49.637**, y el titular dice **$49.638**. Es el único de los doce cuyos números no derivan
solos y cuyas cuentas cierran — **es el que hay que imitar**.

**Dónde se aplica.** `/crm`, la cabecera de cada columna del kanban.

**Teléfono.** En la tira de chips de etapa entra `Propuesta 6` pero no la probabilidad. Va en
la vista de etapa, en la fila de resumen de arriba.

---

#### B4 · El teléfono tiene tres respuestas, y la mejor es cambiar el modelo

**El problema.** `AGENTS.md` dice *«La app de MaKo se debe adaptar al tamaño de la pantalla
siempre»*. Un kanban de 5 columnas en 375 px no se adapta encogiéndose.

**Las tres respuestas que se vieron, de peor a mejor:**

1. **Dejar las columnas con scroll horizontal** (Rapport, Accord, Mender, Lintel, Solvik,
   Kerfa). Columna al ~85 % del ancho con la siguiente asomando. Funciona para mirar;
   **el arrastre táctil no se activó** en ninguno de los que probé.
2. **Lo mismo, pero con manubrio explícito** (Tessly): cada tarjeta suma un **manubrio de seis
   puntos** arriba a la derecha, así el arrastre no depende de una pulsación larga adivinada.
   Tilvo hace la variante escrita: la etiqueta del carril **cambia de texto** entre escritorio
   (`arrastrá para mover`) y teléfono (`mantené apretado, después arrastrá`).
3. **Cambiar el modelo** (Sprig, y es el mejor): las columnas **desaparecen**. Quedan una
   **fila de chips de etapa con scroll horizontal** (`Leads 5`, `Discovery 6`, `Demo 6`) y
   **una sola columna vertical** a pantalla completa, con tarjetas más aireadas. Entre etapas
   se mueve con el menú **«Mover a»** de la tarjeta, no arrastrando.

**La que nos sirve es la 3**, y por una razón de regla propia, no de gusto: `AGENTS.md` dice
*«un solo paso a la vez, cosas grandes, casi sin texto»* y *«una barra de navegación NO lleva
scroll horizontal»*. Un carrusel de columnas es el kanban de escritorio apretado; una etapa a
la vez con un menú «Mover a» es **un paso por pantalla**.

**Dónde se aplica.** `app/m/crm`.

**Y el bonus que nadie espera:** Sprig y Accord **publican su contrato de teclado en la
pantalla** — *«Espacio levanta la tarjeta; las flechas la mueven entre etapas; Escape la
devuelve»*. Un kanban operable sin mouse, declarado. Eso no es accesibilidad de trámite: es
velocidad para quien usa el CRM ocho horas por día.

---

### C — Canales: WhatsApp, la bandeja y los pagos

---

#### C1 · La ventana de 24 h se cuenta en cuatro lugares, y ninguno dice «no podés»

**Este es el patrón más valioso de los 114, y es el que más directo nos toca.**

**El problema.** La ventana de 24 horas de WhatsApp es una regla externa, real, que rompe
conversaciones. Hoy el usuario se entera cuando falla.

**Cómo lo resuelve Tend.** La misma restricción aparece en cuatro registros, y **cada uno dice
algo distinto**:

1. **En la lista de conversaciones:** un chip gris `Sólo plantilla`. Sabés cuáles están
   cerradas **antes de abrirlas**.
2. **En la cabecera del hilo:** abierta → píldora con punto, `Ventana de respuesta: quedan
   23 h 33 min`. **En horas y minutos, no en segundos** (un contador de segundos es ansiedad,
   no información). Cerrada → el mismo chip gris, sin contador.
3. **Dentro del hilo, como evento de la línea de tiempo:** un separador centrado con reloj —
   *«la ventana de 24 h se cerró a las 3:20 · sólo plantillas hasta que Kwame responda»*, y en
   un hilo reabierto, dónde se volvió a abrir. **La ventana es parte de la historia, no sólo
   del estado actual.** Esto es lo mejor de todo el catálogo.
4. **En el compositor, cuando venció:** un cartel ámbar con candado y **el input no se
   esconde**: queda deshabilitado, con el placeholder *«sólo se puede enviar una plantilla
   aprobada ahora mismo»* y un botón **«Enviar una plantilla»** al lado.

> **Nunca te dice «no podés». Te dice por qué, desde cuándo y qué hacer.**

Y el selector de plantillas cierra el círculo: lista a la izquierda con el **nombre técnico en
monoespaciada** (`appointment_reminder`) y debajo **la categoría de Meta** (`Utility` /
`Marketing`); a la derecha, la plantilla **renderizada como burbuja real de WhatsApp** con sus
botones, y debajo la tabla de variables **ya resueltas con los datos de este contacto**
(`{{1}} Nombre = Kwame`). En el hilo, los salientes de plantilla llevan un rótulo
`PLANTILLA · RESULTS_READY` arriba de la burbuja: se distingue a ojo lo que mandó una
plantilla de lo que escribió una persona.

**Dónde se aplica.** `app/whatsapp/_shared/ChatHilo.tsx`, la lista de `/chats`, y el selector
de plantillas. Y ojo: **Parley, que es el template de bandeja de tres canales, NO modela la
ventana de 24 h** —abrí una conversación de WhatsApp de hace dos días y el compositor seguía
abierto sin aviso—. O sea: de los 114, **uno solo** se tomó el trabajo. Ese trabajo es nuestro
diferencial, no un detalle.

**Una salvedad medida:** no vi en Tend ningún cambio de color cuando queda poco tiempo, ni un
aviso tipo «te quedan 2 h». Sólo hilos con 23 h y hilos vencidos. Si queremos un umbral de
alerta, lo inventamos nosotros.

**Teléfono.** Todo el mecanismo se lee igual de bien en 375 px: el cartel ámbar va a ancho
completo y el compositor bloqueado ocupa dos líneas. Es lo que mejor sobrevive de toda la
demo de Tend.

---

#### C2 · El compositor cambia de reglas con el canal, y el medidor dice lo que vas a pagar

**El problema.** Vamos a mandar por WhatsApp, email y (eventualmente) SMS desde el mismo
lugar. Un cuadro de texto genérico miente sobre tres restricciones distintas.

**Cómo lo resuelve Parley.** El mismo compositor, **el canal nombrado en el placeholder**
(`Responder a Amara por WhatsApp…`) y **el medidor cambia de naturaleza**:

| Canal | Medidor |
|---|---|
| WhatsApp | `0 / 4.096` |
| SMS | `0 / 160 · 1 segmento` |
| Email | `0 caracteres` (sin tope) |

Al pasar los 160 en SMS el medidor **deja de ser texto gris y se vuelve una píldora ámbar**:
`169 caracteres · 2 segmentos de SMS`. **No dice «te pasaste»: dice cuánto vas a pagar.**

Y modelaron algo que a nosotros se nos va a escapar: el tope de WhatsApp es **4.096 en una
respuesta de bandeja** y **1.000 en una campaña** (sesión contra plantilla). Esa distinción es
correcta.

**En la campaña nueva**, tres cosas más que valen:
- El canal se elige con **tarjetas-radio que llevan el precio adentro**.
- El canal no conectado está **gris con la razón y el arreglo**: *«Email todavía no está
  conectado. **Conectá un dominio de envío** para usarlo.»* — que es literal nuestra regla de
  `AGENTS.md`: *«UN AVISO DICE QUÉ HACER Y PARA QUÉ, NUNCA EL ESTADO INTERNO»*.
- Un bloque de costo con **la cuenta y el saldo que queda después**: `$23,44 — 4.688 contactos
  × $0,005` junto a `saldo $1.830 — quedan $1.806,56 después de enviar`.

**Dónde se aplica.** `/chats`, `/email`, y la pantalla de campañas. El bloque de costo + saldo
toca directo lo que ya tenemos en `docs/hallazgos-planes-y-cobro.md` y el gasto de IA.

**Teléfono.** La bandeja de dos paneles **se parte en dos pantallas, no en dos columnas**:
lista a pantalla completa, y al tocar una fila la conversación **reemplaza** la lista con un
`‹ Todas las conversaciones` arriba. Los iconos de acción bajan a una segunda fila en vez de
apretarse en la cabecera. Es lo obvio, pero está bien hecho y es lo que `app/m/chats` tiene
que hacer.

---

#### C3 · El control que mueve dos contadores en contra, con la plata al lado

**El problema.** Cualquier umbral (riesgo, puntaje de lead, presupuesto, límite de gasto de
IA) tiene dos costos que tiran para lados opuestos, y una pantalla que muestra sólo uno
miente por omisión.

**Cómo lo resuelve Corvane**, y es el mejor control de todo el catálogo. Sobre un **histograma
real** de los puntajes del último mes —con **la tapa de cada barra más oscura** marcando la
porción que después se confirmó fraude, y la leyenda de ese encoding escrita en el subtítulo,
no en un tooltip— hay **dos líneas verticales arrastrables** con su valor en una píldora-manija.

Al arrastrar:
- La línea sigue al puntero **1:1, sin inercia ni easing** — es lo correcto para un control de
  precisión. (Compará con A2: una transición de datos se suaviza; un control que la persona
  está sosteniendo, nunca.)
- **Las barras se recolorean en el momento** y el tinte de la zona se estira con ellas.
- **Los números NO se animan: se reemplazan.** Nada de contadores durante un arrastre.
- Una frase debajo **se reescribe sola**: *«en 46 / 72, bloquearía el 5,6 % de los pagos,
  frenaría cerca del 88 % del fraude y mandaría 18,1 por día a una persona».*

Y el panel de resultados, cuyo badge pasa de **`● En vivo` a `● Borrador`** apenas tocás algo:

| | antes | después | delta |
|---|---|---|---|
| Fraude frenado | 61 % | 88 % | `↑ 27 %` **verde** · `$6.482 de $7.599` |
| Buenos clientes bloqueados | 12 | 118 | `↑ 106` **rojo** · `$13.267 de venta perdida` |

**Dos cosas para tomar tal cual:**

1. **El color del delta codifica bueno/malo, no dirección.** «Subió» es verde en fraude
   frenado y rojo en clientes bloqueados. Kestrel hace lo mismo: gasto que baja va en verde,
   CTR que baja va en rojo. Nosotros ya tenemos `colorDeTono()` haciendo esto **para las
   KPIs**; falta extenderlo **al chip de variación**.
2. **Cada porcentaje trae su línea en plata.** Ganar 27 puntos de fraude frenado costó
   $13.267. Eso no se discute: se ve.

Pie del panel: `↺ Restablecer` y `✓ Aplicar`. **Nada se guarda solo.**

**Dónde se aplica.** Tres lugares concretos: el **laboratorio de puntaje de leads** del CRM
(hoy el peso de cada factor se configura a ciegas), los **topes de gasto de IA**
(`docs/hallazgos-planes-y-cobro.md`), y los **presupuestos por canal** del Media Buyer.

**Teléfono.** Sobrevive entero a 375 px —lo verifiqué— y la razón es instructiva: **es un
gráfico y una frase**, no una grilla de tarjetas. Las manijas siguen siendo píldoras de ~28 px,
agarrables con el pulgar. Cuando algo sobrevive al teléfono es porque tiene pocas piezas.

---

#### C4 · Cómo se muestra un pago, un rechazo y una disputa

Esto es para Mercado Pago y es corto, porque Corvane lo tiene resuelto y se copia casi entero:

- **La lista** declara sus unidades en el subtítulo: *«los horarios son UTC; los montos, en la
  moneda de cada comercio»*. Chips con conteo por estado, y a la derecha **la suma con su
  salvedad**: `$70.396 bruto · USD a tasas fijas`.
- **Aprobado = punto verde en una píldora casi invisible. Rechazado = píldora tintada.** El
  tintado sólo para lo malo: el ojo va solo.
- **El detalle es un cajón lateral**, no una página: la lista queda visible y atenuada. Monto
  gigante + píldora de estado arriba, `ID` monoespaciado, y una lista etiqueta/valor.
- **Y lo único que de verdad importa: la línea de tiempo.** `● Pago creado · 25 oct 10:58` y
  **`● Rechazado por el emisor · tarjeta vencida · 25 oct 10:58`**. **El motivo del rechazo es
  un evento con nombre en castellano, no un código.** Eso es exactamente lo que nos va a
  faltar con Mercado Pago, que devuelve `cc_rejected_bad_filled_date`.
- **Las disputas son un kanban de dos columnas cuyos nombres son lo que hay que hacer**
  («Necesita respuesta», «Con el banco»), no estados abstractos, y cada columna lleva su
  expectativa debajo (*«normalmente se deciden en 60–75 días»*). La evidencia es un checklist
  donde **cada ítem explica qué es** (*«Comprobante de entrega — número de seguimiento con
  firma»*), y el botón de rendirse dice lo que es: **`✕ Aceptar`** = darlo por perdido.
- `Tasa de disputas 0,84 %` con medidor contra el límite, y `Tasa de éxito 56 % · **de 9
  decididas**` — **el denominador escrito**.

**Dónde se aplica.** La pantalla de cobros y `docs/hallazgos-planes-y-cobro.md`.

---

#### C5 · El lienzo de nodos y la luz que camina

**El problema.** `/chatbot` y `/automations` tienen un lienzo. Hoy, cuando una automatización
corre, no se ve correr.

**Cómo lo resuelve Noria.** **La luz es el color de la arista, no un punto que viaja.** Nodo
terminado → contorno verde en toda la tarjeta + check en la esquina, **y la flecha que sale de
él se pone verde**. La flecha que **entra** al nodo en curso se pone azul. Lo no alcanzado
queda gris. Es mucho más barato de implementar que una partícula animada y se lee mejor,
porque el estado queda **persistente** en vez de pasar.

Los nodos llevan **una franja de cabecera tintada con el TIPO en versalitas** (`DISPARADOR`
ámbar, `ACCIÓN` gris, `AVISO` verde). Y el `Probar` no pone spinner: **atenúa el botón** y una
píldora global pasa de `● 0 corriendo` a `● 1 corriendo`.

**Las corridas fallidas agrupadas por causa** es la otra mitad, y es mejor que una lista:
- El badge de conteo en cuadrado: `3 ×`.
- **El titular es el mensaje de error**, no el nombre del flujo: *«el portal de aduana
  devolvió 503»*.
- Segunda línea: flujo · **`en "Buscar aranceles"`** (el paso que rompió) · `hace 21 min`.
- Acciones con **la etiqueta dimensionada al grupo**: `⟳ Reintentar los 3` (o `⟳ Reintentarlo`
  si es uno).

**Dónde se aplica.** `app/chatbot`, `app/automations`, y la ticketera de fallas.

**Teléfono.** Y acá está la respuesta que buscábamos: **en 375 px el lienzo se reemplaza por
la lista de pasos, elegida por defecto** (el segmentado `Lienzo | Pasos` arranca en Pasos, pero
el lienzo sigue disponible). La lista es un stepper numerado con el tipo en versalitas y un
lápiz de editar a la derecha. **Un lienzo de arrastre no se adapta: se sustituye.**

---

### D — Login, planes y galerías

---

#### D1 · El formulario de login son seis cosas, y la tarjeta mide 400 px

Nadie miró nunca nuestro login con criterio de diseño (`app/login/LoginForm.tsx`). De los
siete que se abrieron, el que gana es **Verso**, y gana **por lo que no tiene**: sin logo, sin
subtítulo bajo el título, sin botones sociales. Seis elementos: título, dos campos,
«mantener sesión» + «¿olvidaste?», botón, y «¿no tenés cuenta?».

El relato (marca, promesa) **vive en el panel visual, no entre los campos** — y ese panel
**cambia de texto según el estado**: «Bienvenido de vuelta» al entrar, «Empezá la primera
página» al registrarse. Un panel que no reacciona es relleno bonito (el bosque de Nocturne).

**Los números que convergen en los cinco medidos:**

| Pieza | Valor |
|---|---|
| Ancho de la tarjeta | **400–420 px** (los cuatro de una columna caen ahí) |
| Alto de campo | 44–50 px |
| Radio de campo | 10–14 px → nuestro `--r-md` (11px) o `--r-lg` (14px) |
| Alto de botón | 48–50 px, **siempre ancho completo** |

**Tres detalles de texto que valen más que el diseño:**
- **«Recordarme por 30 días»** (Huddle), no «Recordarme». Dice cuánto dura.
- **«¿Olvidaste?» en la misma línea de la etiqueta «Contraseña»**, alineado a la derecha
  (Portal). Ahorra una fila entera y está donde se busca.
- **«Gratis para siempre. Sin tarjeta.»** como subtítulo del registro (Vault): mata la
  objeción antes del primer campo.

**El error: hay un ganador y dos vergüenzas.** Verso valida de verdad y escribe en castellano
humano (*«Decinos cómo llamarte»*, *«Escribí tu correo»*) con subrayado rojo y scroll
automático al primer error. Huddle ancla el error al campo con ícono y motivo: *«No tenemos
una cuenta con ese correo»*. **Bamboo y Nocturne no validan nada: apreté «Entrar» con el
usuario vacío y contestaron «¡Bienvenido!» y «Entrando…».** Es teatro, y es exactamente lo que
no queremos ser.

**Lo que SÍ vale la pena robar de un login con personaje: Huddle, no Bamboo.** Huddle son
cuatro formas geométricas planas; con el correo los ojos miran hacia el campo, con la
contraseña **los cuatro cierran los ojos** (los círculos se vuelven arcos). **El único estado
que cambia es la forma del ojo** — es el mismo chiste que el panda de Bamboo y cuesta la
décima parte. Y el panda hay que descartarlo igual por otra razón: Bamboo **arranca a
oscuras** y hay que tirar de un cordel para que aparezca el formulario. Le pone una puerta a
la puerta.

**Teléfono.** Nocturne y Verso entran enteros en 812 px. **Bamboo es el peor**: la lámpara y
el panda comen ~250 px antes del primer campo y «Crear cuenta» pide scroll. Y la trampa que
hay que mirar en el nuestro: **Vault pone el panel que explica la fuerza de la contraseña
debajo del campo, y con el teclado abierto queda tapado** — justo en el único momento en que
sirve.

**No copiar:** el botón que escapa del cursor (Tether). Castigar al usuario por querer apretar
el botón es un anti-patrón por más prolija que sea la salida de emergencia.

---

#### D2 · El patrón de elegir plan

De la tienda Oria, y se copia casi literal a `app/planes/Tarjetas.tsx` y
`app/planes/Vitrina.tsx`:

- **Fila a ancho completo** con radio a la izquierda, título en negrita, **una frase que
  explica qué pasa si elegís eso** (*«Transferencia — te mandamos los datos cuando se agenda
  la entrega»*), y el precio a la derecha.
- **En el upgrade va el delta (`+$30`), no el absoluto.**
- Seleccionado = borde de 2 px; el resto, 1 px. **Sin relleno de color.**
- **El total va adentro del botón: «Confirmar · $234».**
- Debajo del botón, **tres líneas con ícono que matan objeciones** (plazo, qué incluye,
  devolución).
- El checkout es **una página larga con secciones numeradas** («01 Contacto», «02 Pago»), no
  un asistente. El título es una frase, no «Paso 1 de 3».

**Y uno que nos sirve ya:** el aviso de modo demo, textual — *«Esta es una tienda de
demostración. No se cobra nada, no se envía nada, y tus datos no salen de este navegador.»*
Para nuestro sandbox de pagos, eso se copia tal cual.

**Para las galerías de plantillas** (`app/dashboard/Galeria.tsx`, `NuevaHoja.tsx`): **chips de
filtro con el conteo adentro** (`Todas 14 · Ventas 4 · Marketing 3 · **Email 1**`). Sabés
antes de tocar si vale la pena, y el «1» te dice que no. Y la tarjeta de producto de Oria
**no tiene tarjeta**: imagen, y una fila con nombre a la izquierda y precio a la derecha. Sin
borde, sin sombra, sin botón. Se escanea más rápido que cualquier grilla con marco.

⚠️ **Pero eso último choca con una decisión nuestra y gana la nuestra.** `docs/hallazgos-ui.md`
documenta que dejar `/general` sin una sola superficie lo hizo *«se ve mucho peor, no se ve
nada»*, y que *«la caja de afuera es lo que hace que una pantalla se lea como hermana de la de
al lado»*. El catálogo sin marco funciona en una tienda, donde la foto hace todo el trabajo.
**En nuestras galerías, la portada de cada plantilla ya tiene color propio
(`lib/graficos-portadas.ts`, `lib/graficos-identidad.ts`) y la caja se queda.** Lo que se toma
de Oria son los chips con conteo, no el quitar la tarjeta.

---

### E — Lo transversal

---

#### E1 · El contador cuenta entre dos valores reales, o no cuenta

**Este es el defecto más repetido del catálogo y el más fácil de heredar sin darse cuenta.**
Lo tienen **todos**:

- Tilvo pasa por `+£143.170` camino a `−£18.319`: **cambia de signo en vuelo**.
- Kinlo muestra `£764.087` como total de 7 días camino a `£22.897`.
- Noria muestra `Corridas 92` mientras el titular de la misma pantalla dice `109`.
- Sprig, Rapport, Parley, Kestrel, Murmura y Hearth **suben sus KPIs solos mientras los
  mirás**, sin que nadie toque nada: en Sprig «New leads» pasó de 127 a 142 entre dos lecturas
  separadas por segundos.
- Mender arranca en `0 cases / 0 Satisfaction` y cuenta hacia arriba al entrar en pantalla:
  **si falla la carga, el usuario ve ceros creíbles**.

Kestrel es el único decente: su número también oscila, **pero lleva un rótulo `● En vivo`**.
Si el número se mueve solo, decilo.

**La regla.** Un número que cuenta **interpola sólo entre dos valores reales y comparables**,
y sólo cuando el cambio lo causó el usuario. **Nunca desde cero al montar** —eso dibuja un
cero que parece medido, y nuestra regla ya dice *«nunca un cero»*—. Si los dos valores no son
comparables (otro orden de magnitud, otro signo, otra unidad), **el número salta**.

---

#### E2 · El punteado significa UNA sola cosa, y hay que elegirla

**El problema que encontramos sin buscarlo.** Las demos usan el mismo recurso visual para tres
cosas distintas:

| Demo | Línea punteada = |
|---|---|
| Talvo | un **umbral** (la línea del colchón de caja) |
| Noria | **otro período** (la línea «una semana antes») |
| Kinlo | **otra unidad** (la serie del eje secundario) |

Las tres son defendibles por separado. Juntas en un producto serían un desastre, y nosotros
tenemos 46 tipos de gráfico en un editor donde el usuario los mezcla en la misma hoja.

**La propuesta, y es la regla que más vale de este documento:**

| Recurso | Significa | Ejemplo nuestro |
|---|---|---|
| **Relleno sólido / línea sólida** | **Medido.** Pasó y lo leímos | el gasto de Meta hasta ayer |
| **Relleno rayado en diagonal / trazo punteado** | **No medido.** Proyectado, comprometido o todavía no ocurrido | lo que falta para la meta del mes |
| **Contorno sin relleno** | **Un hueco que todavía no pasó** | las horas de hoy que aún no corrieron |
| **Tono más claro del mismo color** | **Otro período** (el año pasado, el mes anterior) | la serie de comparación |
| **Línea fina de 1 px con rótulo** | **Un umbral o una meta** | la cuota, el colchón, el tope de gasto |

Eso cubre los cinco casos sin que ninguno pise a otro. Selvar lo demuestra en una sola barra:
`Ganado` azul sólido → `Comprometido` ámbar → `Mejor caso` azul pálido → **`Falta conseguir`
rayado**. El rayado hace todo el trabajo: **dice «esto todavía no existe» sin necesitar
leyenda**.

**Y hay una pieza nuestra que ya lo pide.** `AGENTS.md`: *«Una barra de gráfico se recorta al
100 %, siempre… Que se vea que está cortada: va a filo, con una marca, y el número al lado»*.
Ese «se ve que está cortada» es el mismo vocabulario.

---

#### E3 · El aviso dice la consecuencia — y acá hay un conflicto con una regla de Martín

**Lo que hacen.** Hearth, al soltar un préstamo en «Fondeado»:

> *«David Jenkins fondeado · +$4,3K de comisión — queda abierto: 2 documentos pendientes,
> 3 condiciones»*

Tres cosas en una línea: qué pasó, qué ganaste, qué queda roto. Murmura: *«Editor ya no puede:
Escribir publicaciones»* con `Deshacer`. Ondra: *«Cambios de presupuesto sin guardar · total
$6.700 menos»*. Ninguno dice «Guardado».

**El conflicto, y no lo resuelvo solo.** `AGENTS.md` tiene una regla explícita y repetida de
Martín (26/09/2026): *«el mensaje del botón de deshacer es MUY largo, por dios deja de
escribir textos así de largos, que sea una regla»*, con techo de **3-4 palabras** para el
toast del deshacer. El toast de Hearth son 18 palabras. **Gana la regla de Martín.**

**La salida que respeta las dos, y es mejor que las dos:** la consecuencia **no va en el
toast**. Va donde ya vive. El toast dice `Movido a Ganado` + `Deshacer` (4 palabras), y **lo
que cambió se ve cambiando**: el pronóstico ponderado de la cabecera cuenta hasta su valor
nuevo (B1), la comisión flota desde la tarjeta (B1), y lo que queda abierto ya tiene su lugar
en la ficha. El toast anuncia; la pantalla demuestra.

Es más trabajo de implementación y es el camino correcto: un toast largo es texto que hay que
leer, un número que se mueve es información que se ve.

---

## 4. Qué hace que se vean caros

Esto es lo que Martín está comprando. Son cinco cosas, sin misticismo, y ninguna cuesta plata.

**1 · Tres pisos en cada cifra, siempre.** Etiqueta chica en gris → número grande con
**cifras tabulares** → una línea de contexto que **define** la métrica. Nunca un número solo.
Los ejemplos que más se notan son los que escriben el método: `de 9 decididas`,
`acreditado por último clic`, `respuestas por mensaje entregado`, `cada uno necesita una
persona en 7 días`. **El contexto no es relleno: es lo que distingue un tablero de un
adorno.**

> Nota técnica nuestra: *cifras tabulares* significa `font-variant-numeric: tabular-nums`.
> Sin eso, un número que cuenta hace bailar el ancho y se ve barato al instante. Hoy no está
> en ningún token (`app/_ui/tokens.ts`); debería estar.

**2 · Densidad asimétrica.** Tarjetas con radio grande (los nuestros: `--r-lg 14px`,
`--r-xl 18px`) y padding generoso (`--card-pad 28px`), pero **las filas de datos apretadas**
(48–56 px). **Lo que se lee respira; lo que se escanea, no.** Es la diferencia más visible
entre un tablero caro y uno hecho con una grilla uniforme.

**3 · Profundidad por capas, no por sombras.** Tres niveles y se acabó: fondo apenas tintado →
tarjeta → un bloque aún más claro adentro para los metadatos. Las sombras fuertes **sólo
aparecen en lo que flota de verdad** (un riel, una barra de pestañas, una barra de guardado).
Eso es exactamente lo que ya tenemos: `app/_ui/tokens.ts` → `shadow` con tres niveles,
`card` → `pop` → `modal`, y el comentario *«Sólo tres niveles»*. **La regla ya está escrita;
lo que falta es usarla.** Rapport llega al extremo de no usar casi ninguna sombra: su
profundidad es **color de superficie**.

**4 · Un solo acento, y los colores de datos fuera de la paleta de marca.** Los colores de
canal, de etapa o de rol son un **sistema aparte**, y **siempre vienen con el nombre escrito
al lado** (Parley: `● WhatsApp`, `● SMS`, `● Email` — el color refuerza, el nombre informa).
Eso es literal nuestra regla *«el color nunca es el único portador»*, y también la respuesta
al problema del dorado documentado en `docs/hallazgos-ui.md`: *«el dorado no significa MaKo,
significa destacado»* en ~25 superficies, y por eso la marca se diluye.

**5 · El panel que explica en prosa.** Todas las buenas pantallas tienen **una frase escrita
que resume el estado**, con los números en negrita embebidos:

> *«Los ingresos subieron 11,9 % contra los 30 días anteriores. [9 leads nuevos] no tuvieron
> respuesta, y búsqueda paga va por encima del presupuesto.»* (Ondra, con el link accionable
> adentro de la frase)

> *«109 corridas desde medianoche. 7 fallidas necesitan una mirada. Los flujos le ahorraron al
> escritorio 16 h hoy.»* (Noria)

**Se ve caro porque alguien pensó qué decir, no sólo qué graficar.** Y tiene una ventaja
concreta: es la única pieza de un tablero que sobrevive intacta a un teléfono.

⚠️ **Y acá está el riesgo que hay que mirar.** Nosotros ya tenemos quien escriba esa frase:
es el AI Analyst (`lib/graficos-analisis*.ts`, `app/dashboard/PanelAnalista.tsx`). Una frase
generada que afirme «los ingresos subieron 11,9 %» **tiene que salir del mismo agregador que
dibujó el gráfico**, o va a contradecir a la tarjeta de al lado. `AGENTS.md` ya lo advierte:
*«cuando dos bloques que antes vivían separados quedan en la misma pantalla, hay que mirar si
pueden contradecirse»*.

---

## 5. El vidrio: ¿va o choca?

Martín lo pidió explícito porque se repite en todo el sitio («frosted glass», «liquid glass»)
y es lo que los hace ver actuales. Se miraron cuatro: Solvik, Kerfa, Vitrea y Pane.

**El veredicto: va, pero sólo en el chrome. Para datos densos, no.**

**Lo que se midió:**

- **El vidrio necesita variación detrás para existir.** Sobre una foto (Kerfa) se ve
  espectacular; sobre una aurora de dos colores (Solvik) se ve bien; **sobre negro casi plano
  (Vitrea, Pane) el desenfoque no aporta nada** y estás pagando GPU por una tarjeta oscura
  común. **Y en Pane, al pasar a tema claro el vidrio desaparece por completo**: paneles
  blancos sólidos. Se lee mucho mejor y pierde toda su identidad. **El vidrio de Pane es un
  efecto exclusivo de modo oscuro.**

- **El problema con los números no es el desenfoque.** Es que **el contraste deja de ser una
  propiedad del texto y pasa a ser una propiedad de la posición**. En Solvik, el mismo gris de
  un encabezado de columna se lee distinto arriba a la izquierda (sobre el teal frío) que
  abajo a la derecha (sobre el naranja cálido). En una tabla de 40 filas, eso es fatiga pura.

- **Hay un costo de render concreto.** En Kerfa, al recalcular tras marcar un negocio como
  ganado, **los paneles perdieron el relleno por un instante y se vio la foto a través**. Con
  tarjetas opacas eso no pasa.

- **Y los de Kerfa ya encontraron el límite solos.** Su panel de Apariencia trae un
  interruptor: *«Reducir transparencia — superficies sólidas en vez de vidrio esmerilado —
  más fácil de leer para algunas personas, y más liviano en máquinas viejas»*, más un fondo
  «Plano» sin foto, **y respeta el ajuste del sistema**. Prendido, la tabla pasa a superficie
  sólida y **la estética no se pierde**, porque la foto sigue viva en los márgenes y en la
  barra de navegación.

**Por qué choca con lo nuestro, y en qué medida.** `AGENTS.md` dice: *«La app es tema claro
con islas oscuras (el sidebar, el tooltip, el toast). No hay `prefers-color-scheme` ni modo
oscuro global, y no se está agregando uno»*. El vidrio es, por lo medido arriba,
**esencialmente un efecto de modo oscuro sobre un fondo con variación**. Nuestro fondo es
`--bg #F4F6F9`, plano y claro. **Sobre eso, el vidrio no tiene nada que desenfocar.**

**La recomendación, en una línea: no ahora, y cuando sea, sólo en el chrome.**

Si algún día se adopta, el límite es éste:

- **Vidrio permitido:** barra de navegación pegajosa, rieles flotantes, popovers, toasts,
  modales y cabeceras — donde el desenfoque **comunica** que hay contenido pasando por debajo.
- **Superficie opaca, obligatoria:** cualquier panel que contenga una tabla, una grilla de KPIs
  o un gráfico con eje. O sea: **todo el Dashboard**.
- **Y si se adopta, se adopta con su interruptor**, respetando `prefers-reduced-transparency`,
  como Kerfa. Esa es la diferencia entre un efecto y una decisión.

**Lo que sí se puede tomar del vidrio sin el vidrio** —y esto se puede hacer ya—: **la
hairline clara de 1 px en el borde superior** de un panel. Es lo que da la sensación de
material, cuesta una línea de CSS y funciona igual sobre una superficie opaca. En nuestro tema
claro es un blanco sobre `--surface`; en las islas oscuras (sidebar, tooltip), un
`--border-strong` a un escalón del fondo.

---

## 6. Sobre el tema Nord con azul de Meta

El candidato `true-north` (en `app/globals.css`, prendido sólo en `/admin/ui?tab=temas`) sale
intacto de esta revisión. **Nada de lo visto lo contradice, y dos cosas lo refuerzan:**

1. **Nord resolvió los dos modos con los mismos 7 grises.** Los cuatro templates de vidrio
   demostraron lo contrario de lo que prometen: Pane apaga su propio efecto en claro, o sea
   **su identidad existe en un modo y no en el otro**. Es exactamente la `falla` que el propio
   comentario de `true-north` ya declara sobre el azul (`#8AB4FA` en oscuro no se lee como
   «el de Meta»). Con la diferencia de que nosotros lo escribimos antes de adoptarlo.

2. **La frase de Corbel es la regla que le falta al candidato.** *«Los colores de estado
   conservan su significado en cada paleta.»* `true-north` ya separa los grupos de tokens en
   la tab (Superficies · Tinta · Barra · «Tú actúas (Meta)» · «MaKo intervino» · Semáforo) y
   ya cuidó el caso difícil: el rojo lleva la saturación subida a propósito *«para que un error
   no se lea como "MaKo intervino"»*. Lo que falta es decirlo en la pantalla, que es gratis.

**Lo que esta revisión agrega al candidato, concreto:** falta un token de `letter-spacing`
(hoy hay **564 escritos a mano** y cero tokens, según `docs/hallazgos-ui.md`) y falta
`tabular-nums` para los números. Las dos cosas se notan en cuanto se ponen al lado de
cualquiera de estos 26 templates, y las dos son una línea en `app/_ui/tokens.ts`.

---

## 7. Teléfono y computadora

La regla del proyecto es diseñar para los dos y Martín lo pidió explícito. De los 26 medidos
salen **cuatro respuestas**, y conviene nombrarlas porque elegir la equivocada es el error
más caro:

| # | Respuesta | Cuándo sirve | Ejemplo |
|---|---|---|---|
| 1 | **Reflow** — la grilla pasa a 2×2 o a una columna | KPIs, listas, formularios | casi todos |
| 2 | **Partir en dos pantallas** — lista → detalle, con un `‹ Volver` | bandejas, maestro-detalle | Parley |
| 3 | **Sustituir la pieza** — el lienzo se vuelve lista, el kanban se vuelve una etapa | lienzos de nodos, kanbans | Noria, Sprig |
| 4 | **Carrusel horizontal** — columnas al ~85 % con la siguiente asomando | **casi nunca** | el resto |

**La 4 es la trampa**, y es la que eligieron 8 de los 12 CRMs: se ve bien en una captura y es
mala de usar. **Nuestra regla ya la prohíbe para navegación** (*«una barra de navegación NO
lleva scroll horizontal… Si no entran, bajan de renglón»*), y lo que esta revisión agrega es
que para **contenido** la respuesta buena casi siempre es la 3.

**Lo que mejor sobrevive al teléfono, y es un patrón en sí mismo:** las piezas con **pocas
partes**. El laboratorio de umbrales de Corvane entra entero en 375 px porque es *un gráfico y
una frase*. El runway de Selvar entra entero —los cuatro tramos, la cápsula de pronóstico, la
marca de ritmo— porque es *una barra*. Las grillas de tarjetas son las que se rompen. **Si una
pieza no entra en un teléfono, casi siempre es porque tiene demasiadas piezas, no porque la
pantalla sea chica.**

**Tres errores concretos que vimos y que no hay que repetir:**
- **El dock flotante que tapa la última fila** (Rapport, Mender, Tend). Nuestra `EsquinaAvisos`
  ya resolvió esto con `data-esquina-ocupada`; la barra inferior necesita lo mismo: padding de
  fondo reservado en el `<main>`.
- **Los íconos sin etiqueta** en la barra inferior (Solvik: seis íconos anónimos). Hearth y
  Selvar ponen etiquetas y se entienden solos.
- **El eje con números que no son de humano** (Talvo: `$62,5k`, `$188k`).

---

## 8. Lo que NO hay que copiar

En una demo todo es inventado y eso está bien. El problema es que **varios de estos recursos
parecen diseño y son teatro**, y se copian sin darse cuenta. La lista, ordenada por cuánto
daño hace:

1. **Los contadores que suben solos.** Nueve de los 26. Ver [E1](#e1--el-contador-cuenta-entre-dos-valores-reales-o-no-cuenta).
2. **El cero creíble al montar** (Mender): si falla la carga, el usuario ve `0` y nadie se
   entera. Va esqueleto, no cero. Ya es nuestra regla; acá está el ejemplo de por qué.
3. **Los simuladores que mueven la plata solos** (Talvo y Orvel inyectan cobros con toast). En
   una demo divierte; en producción destruye la confianza.
4. **Las sparklines sin eje ni unidad** en las tarjetas KPI. Están en casi todos y son adorno
   puro: una forma que sugiere tendencia sin declarar sobre qué.
5. **Los porcentajes sin denominador ni ventana.** `97 % win rate` (Lintel), `Satisfaction out
   of 5` sin cuántas respuestas (Mender), `270 % de su cuota` con tres de cinco vendedores en
   $0 (Rapport). Corvane y Tessly son la excepción: escriben `de 9 decididas`.
6. **La falsa precisión.** `6,229 % tasa promedio` con tres decimales (Hearth).
   `84 años para crackearla` (Vault) es la mejor metáfora del catálogo **y un número que exige
   suponer una velocidad de ataque que la pantalla nunca dice**. Si copiamos la metáfora,
   mostramos el supuesto o decimos «años», no «84 años».
7. **La comparación que no compara.** Ondra: `Conversión 2,21 % ↑ +0,3 % vs 2,21 %`. El «vs»
   es idéntico al valor actual.
8. **El delta que no sigue al filtro** (Corbel). Ver [A3](#a3--el-filtro-cambia-el-número-y-también-cambia-su-comparación).
9. **La duración mostrada en un paso que todavía no corrió** (Noria: `1,1 s` en un paso
   pendiente). Una estimación con formato de medición.
10. **El `Deshacer` que se va en 4 segundos** para un cambio que aplica a todo el equipo al
    instante (Murmura, matriz de permisos).
11. **El mapa de cuadrados por país** (Wynlo) tiene una trampa que hay que nombrar: *parece*
    un mapa y no lo es, **la adyacencia miente**. Vale la pena igual —todos los países miden
    lo mismo, es tocable en teléfono, no pesa nada— **pero sólo con la franja que deletrea el
    nombre del país debajo**, que es lo que lo salva.

---

## 9. El orden de aplicación

Dashboard primero, porque es lo que pidió Martín. Dentro de cada bloque, el orden es por
relación costo/efecto, no por lo lindo.

### Primero — el Dashboard: plantillas y bloques

| # | Qué | Dónde | Por qué va acá |
|---|---|---|---|
| 1 | **El vocabulario de medido / no medido** (E2) | `lib/graficos-temas.ts`, `app/dashboard/Grafico.tsx` | Es la regla de la que cuelga todo lo demás, y hoy no existe |
| 2 | **`tabular-nums` + token de `letter-spacing`** | `app/_ui/tokens.ts` | Dos líneas, y es lo que más rápido sube el nivel visual de toda la app |
| 3 | **La definición del bloque** (A1) | `app/dashboard/Cabecera.tsx`, `lib/graficos-catalogo.ts` | Resuelve el problema de las cuatro definiciones de «cerró» |
| 4 | **El delta sigue al filtro, o no se dibuja** (A3) | `lib/graficos-agregar.ts` | Es un número que miente; va antes que cualquier cosa estética |
| 5 | **La KPI invertida en las plantillas** (A4) | `lib/graficos-plantillas.ts` | La pieza ya existe («Fondo: Oscuro»); es usarla |
| 6 | **La frase de la paleta + la muestra como rueda** (A6) | `app/dashboard/PanelEstilo.tsx` | Barato, y cierra la pregunta del semáforo para siempre |
| 7 | **El morfeo con sus dos modos** (A2) | `app/dashboard/Grafico.tsx` | El más caro de los siete y el más visible |
| 8 | **El chip de filtro desde el gesto** (A5) | `app/dashboard/BarraControles.tsx` | Depende de que 1–7 estén |

### Segundo — el teléfono del Dashboard

`app/m/dashboard`: eje de 3 marcas redondas, grilla 2×2 con una invertida, la definición en el
`ⓘ`, y **sin brush** sobre el gráfico.

### Tercero — el CRM

B1 (soltar mueve el número de la cabecera) → B3 (la probabilidad en el encabezado de columna)
→ B4 (el teléfono cambia de modelo: una etapa + «Mover a») → B2 (la inclinación, último).

### Cuarto — los canales

C1 (la ventana de 24 h en cuatro registros) es lo más valioso del catálogo entero y lo que
más nos diferencia. Después C2 (el compositor por canal) y C5 (el lienzo y su lista en
teléfono).

### Quinto — lo demás

C3 (el laboratorio de umbrales) cuando toquemos puntaje de leads o topes de gasto · C4 cuando
entre Mercado Pago · D1 (el login) y D2 (los planes) son chicos y se pueden hacer en
cualquier momento, ideales para una ventana corta.

### Fuera de alcance por ahora

El vidrio (§5), y el Gantt con empuje en cascada de Cadra/Sunrow (que ni siquiera miramos a
fondo, y no tenemos dónde usarlo todavía).

---

## 10. Lo que se propone como regla para `AGENTS.md`

Dos, y sólo dos, porque gobiernan código nuevo y el resto ya está cubierto:

1. **El vocabulario de medido contra no medido** ([E2](#e2--el-punteado-significa-una-sola-cosa-y-hay-que-elegirla)). Sólido = medido · rayado/punteado = no
   medido · contorno vacío = todavía no pasó · tono claro = otro período · línea de 1 px con
   rótulo = umbral. Sin esto, 46 tipos de gráfico en una misma hoja significan cinco cosas
   distintas con el mismo recurso.

2. **El contador interpola sólo entre dos valores reales y comparables**
   ([E1](#e1--el-contador-cuenta-entre-dos-valores-reales-o-no-cuenta)). Nunca desde cero al montar; si no son comparables, el número salta. Es el
   corolario visual de la regla que ya existe (*«nunca un cero, nunca un "falta"»*).

**Y una tensión que queda abierta para que la decida Martín, no yo**
([E3](#e3--el-aviso-dice-la-consecuencia--y-acá-hay-un-conflicto-con-una-regla-de-martín)): los mejores avisos del
catálogo cuentan la consecuencia en una línea larga, y la regla vigente de Martín pone techo
de 3-4 palabras al toast del deshacer. La propuesta de este documento es **respetar el techo y
mover la consecuencia a la pantalla** (el número que se mueve), pero si él prefiere el toast
largo para una acción irreversible, es una línea en `AGENTS.md` y cambia B1.

---

## 11. Lo que no se pudo ver

Para que nadie suponga que esto está completo:

- **El arrastre táctil real** no se pudo disparar con entrada sintética en ninguna demo. Lo que
  está escrito sobre el teléfono en B4 es el **layout** que se vio, no el gesto.
- **Los deslizadores de pesos de Selvar** no respondieron (y su árbol de accesibilidad no tiene
  ningún `role="slider"`: son divs con manejadores de puntero, sin teclado — eso es un defecto
  real de ellos, no de la medición). El «se reordena mientras arrastrás» lo afirma su ficha; no
  se vio correr.
- **El tablero de Solvik** no se pudo arrastrar: es drag nativo o con captura de puntero. Se
  describe el estado final, no la animación.
- **El desglose al tocar una columna en Kinlo** no respondió a clicks sintéticos.
- **El arrastre para reprogramar en el calendario de Ondra** abrió el detalle en vez de mover
  la barra. No se pudo confirmar.
- **El drop de archivos reales** en la bóveda de Hearth no se probó (no corresponde subir nada
  ahí).
- **Pebble** (login) da **404** en su demo.
- **7 de los 14 logins y 8 de las 9 tiendas** quedaron sin abrir, además de los ~55 templates
  vistos sólo por su descripción (§1).

**¿Hace falta comprar algún template?** **No, para lo que hay que hacer ahora.** Todo lo de las
secciones 3 a 9 se puede implementar de cero con lo descrito. Lo único donde ver el código
ahorraría tiempo real —y conviene decirlo por si Martín quiere acelerar— es:

- **Accord** ($78), por la inclinación que sigue a la velocidad del puntero y se relaja sola.
  Es la única pieza del catálogo cuya **sensación** depende de una constante de amortiguación
  que no se puede leer mirando. Todo lo demás se saca de la descripción.

Y es, convenientemente, el patrón que este documento pone **último** en la lista de prioridad
(B2). O sea: no hace falta comprar nada hasta que lleguemos ahí, si es que llegamos.

---

## De dónde salió este documento

Cinco agentes en paralelo sobre las demos vivas el 31/10/2026, más una pasada propia sobre
Corbel y Kairo. **No se leyó ni se descargó código de ninguna demo.** Las duraciones en ms son
estimaciones por muestreo de cuadros, no mediciones. Lo que no se pudo verificar está en §11.

Las decisiones vigentes contra las que se contrastó todo: `AGENTS.md`,
[hallazgos-graficos.md](hallazgos-graficos.md) (el editor), [hallazgos-ui.md](hallazgos-ui.md)
(el sistema visual y el dorado), y el tema candidato `true-north` en `app/globals.css`.
