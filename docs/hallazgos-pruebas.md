# Hallazgos — Pruebas A/B (el motor compartido, `lib/pruebas/`)

El motor de las pruebas A/B de toda la app: el reparto (`asignar.ts`), las cuentas (`estadistica.ts`), el juez
(`juez.ts`), el volumen (`volumen.ts`) y las métricas (`metricas.ts`). Lo usan la tarjeta «A/B TEST» de Automations y
la landing (Landings). El diseño está en `docs/diseno-pruebas-ab.md`; donde chocan, manda la crítica (Anexo 2).

## La landing sirve y cuenta su prueba A/B (O18, L2; 18/11/2026)

**Vive en:** `lib/editor-landing/prueba-landing-servir.ts` (qué rama se le sirve a un pedido, sin base), `lib/editor-landing/prueba-landing-server.ts`
(las piezas reales), `lib/editor-landing/pagina-publica.ts` (`dep.probar`), las rutas `app/l/[slug]`, `app/l/[slug]/[ruta]` y el dominio propio
(`app/api/landing-generator/dominio`), `lib/pruebas/medidores-landing*.ts` y el cron `app/api/cron/pruebas`. **Lo fija:** `tests/pruebas-landing.test.ts`.

- **Con prueba, la respuesta es privada para TODO pedido**, también lo de MaKo que va fijo a A: desde el 12/11 la publicada se guarda 30 s
  en el borde de Vercel (`CACHE_BORDE`), y un A guardado ahí se lo daría a todos sin repartir. Sin prueba, nada cambia. Por lo mismo, la
  lectura de la prueba en cada pedido (lo que la crítica 27 quería evitar con una marca en la fila, que es una migración) corre sólo en
  los pedidos que llegan a la función.
- **Una B armada sobre otra versión, o con otra estructura, no se sirve NI SE ASIGNA.** Se revisa antes de `servirRama`: una persona
  contada en B que vio A ensucia la prueba. La estructura de A sale CRUDA de la fila (`SitioPublico.estructura`): `leerFoto` no copia
  `pagos` ni `htmlLibre`, y sin ellos dos pagos distintos daban «igual». Publicar a mano además detiene la prueba (`publicar`).
- **El servidor asigna antes de que corra el Pixel**, así que un bot o la vista previa de WhatsApp reciben rama y nunca ven la página. El
  medidor los devuelve `cuenta: false` y `conteosPorRama` los saca del denominador sin tomarlos como un hueco (un hueco sigue haciendo
  fallar la lectura). El denominador es quien tiene una visita de ESA landing desde que se asignó.
- **La rama que ya vio viaja en `mko_ab_<prueba>`** (HttpOnly, del servidor) y `ramaParaServir` la respeta como `preferida` si está
  activa: Safari borra a los 7 días la cookie del visitante (la escribe el Pixel por JavaScript) y la huella del id nuevo podía mandarla
  a la otra versión. La primera rotura de ese test quedó en verde: la unidad de ejemplo caía en B por la huella.
- **`clic_conversion` cuenta sólo los destinos congelados**, con su query, su ancla o su subruta, y no uno que sólo empieza igual.
- **Sin hacer:** nada crea una prueba de landing todavía (ni pantalla ni API): una prueba existe sólo si alguien la crea, y la primera en
  público espera el sí de Martín (M1). Tampoco: la vista previa `?variante=B`, servir la ganadora después de concluir (hoy vuelve a
  servirse lo publicado), los guardrails «agendó» y «pagó» por visitante, el dominio propio en el medidor (como el Análisis) y todo L3
  (el agente que propone variantes).

## Lo que ve la PC y no GitHub (16/11/2026)

- **Los tests que arman su lista con `git ls-files` no ven un archivo NUEVO sin commitear** (tests/cuenta-revision-escrituras): verde
  en la PC, rojo en GitHub después del commit (pasó con POST /api/accelerator/aplicar, corrida 1456). Para verlo como GitHub sin
  tocar el índice: copiar el índice (`git rev-parse --git-path index`), `GIT_INDEX_FILE=<copia> git add -N <nuevos>` (o
  `--pathspec-from-file=<lista>` si son muchos: el 16/11 fueron 41) y correr CADA test con esa misma variable.
- **El filtro del pre-push corre sobre el DISCO**: con agentes editando en el mismo worktree da rojos que no son del commit.
  `MAKO_SIN_FILTRO=1` sólo cuando el commit está verificado aparte (sigue el resto del pre-push y GitHub prueba todo).
- **Los tests de «una prueba por persona» sólo buscan texto**: ninguna consulta `.or(email.ilike…)` ni `origen->>whatsapp` corre
  contra una base.
- **Un arnés que bloquea fonts.gstatic.com mide con la letra de respaldo**: dejar pasar sólo ese dominio.

- **Cambiar una firma rompe tests de otras áreas que fijan líneas exactas del fuente.** Con el `conSesion` de la API pública
  cayeron `movil-carga-sin-error`, `landing-optin` y `sondeo-a-la-vista` (en GitHub habrían tumbado la corrida), además de
  `no-encontrado` (las dependencias de TituloTab) y `movil-mismas-rutas` (el `if` del cromo). El agente buscó los tests que
  IMPORTAN el archivo y encontró 2 de 5. **Regla:** antes de cambiar la firma de un helper o las dependencias de un efecto,
  `grep` del TEXTO LITERAL en `tests/`.
- **Medir una página sin `next dev`:** `server-only` se deja pasar con la condición `react-server` por `module.registerHooks`
  (como hace `tests/api-mako-publica.test.ts`); si no, la API no se arma. El detector de texto cortado da falsos positivos en el
  menú del teléfono fuera de la pantalla y en las tiras que se deslizan.
- **`tsc-acotado` y la RAM:** las landings piden ~3,9 GB. Con `--heap=4096` alcanzó con 4-5 GB libres y UN chequeo a la vez; con
  otros agentes corriendo, el vigía lo mata al bajar de 0,9 GB libres, y con `--heap=2560` muere sin heap (código 134).

- **⚠️ Un test con tickets de mentira choca con los números REALES** (la suite de la noche, corrida 43913998213): el cron de
  tickets CIERRA los números que nombra un hito del código (`cerrarLosDesplegados`, `lib/tickets-cierre.ts`, los `tickets: [n]` de
  las bitácoras). `tests/tickets-avance-email.test.ts` armaba los suyos con #101-#130; el día que entró el hito real de los
  tickets #103 y #105, su cron «cerró» el #103 de mentira y mandó un correo de más. Parecía una falla del cron y era el test. Los
  tickets de un test van en un rango que ningún ticket real va a tener (990101 en adelante).

## Dos mediciones que dan verde sin mirar (16/11/2026, /accelerator)

- **`s.slice(s.indexOf(A), s.indexOf(B))` devuelve VACÍO si B queda antes que A**, y una aserción sobre ese pedazo pasa sin
  mirar nada (pasó en tests/planes-sin-pasarela.test.ts al mover `TarjetaAccelerator`). Afirmar también el orden
  (`indexOf(A) < indexOf(B)`) o que el pedazo no esté vacío.
- **`getClientRects()` de un hijo de un flex da 1 aunque su texto se parta en dos renglones**: para contar renglones, un `Range`
  sobre su contenido (`range.selectNodeContents(el); range.getClientRects()`).

## Un `\b` después de una tilde nunca calza: 23 guards del voseo no ven «elegí» ni «mirá» (16/11/2026, /accelerator/aplicar)

- **Síntoma:** el guard de tests/aplicacion-accelerator.test.ts tenía `elegí|completá|revisá` y daba verde con «Elegí tu horario»
  en la pantalla.
- **Causa:** en JavaScript, sin la bandera `u`, `\b` sólo reconoce `[A-Za-z0-9_]`: la «í» final no cuenta como letra, y entre «í»
  y un espacio no hay borde. `/\b(elegí|mirá|acá)\b/i` no calza con «Elegí tu horario», «mirá esto» ni «está acá.». Las que
  terminan en consonante (`tenés`, `podés`) sí calzan, y por eso el guard parecía andar.
- **Regla:** para palabras con tilde, `(?<!\p{L})(…)(?!\p{L})` con la bandera `u`, y el guard se prueba con una palabra que
  TERMINE en tilde. Mejor todavía: `marcasDeVoseo` (lib/voseo.ts) genera las formas y separa las palabras con `\p{L}`.
- **SIN HACER:** 23 tests tienen palabras así adentro de `\b(…)\b`: centro-limbo, conectar-ia, conversacion-resumen-reglas,
  copiloto-comunicacion, curso-admin, editor-landing-replicar-animaciones, email-remitente, ficha-editar-con-mako, ia-pc-ola2,
  image-editor-plantillas-crear, m-second-brain, mako-bot-reglas, mako-no-descalifica, marketing-copilot-descubrir, pedir-avisos,
  plan-a-mano-recorrido, plan-a-mano, sugerencias-crm, tutoriales-legibles, video-outliers-criterio, video-puestas,
  zernio-aviso-cobro y zernio-conectar-redes. Arreglarlos puede destapar voseo de verdad en esas pantallas.
- **El guard que barre el repo no ve un archivo nuevo** (ya anotado el 13/11: lista con `git ls-files`). Una pantalla nueva, sin
  `git add`, queda sin revisar: su propio test pasa `marcasDeVoseo` por lo que lee el visitante.
- **Dos trampas al medir con Playwright:** `getComputedStyle(input, '::placeholder').color` devuelve el color del TEXTO del campo
  en Chromium (dio 16,65:1 para un placeholder de 3,23:1): el contraste del placeholder se calcula con el valor del CSS. Y una
  captura justo después de mover el mouse saca el botón a mitad de su transición (desteñido): se espera lo que dura (0,25 s en
  `.acl-btn`).

## Cómo juzgar una réplica con el panel oculto: los lienzos del editor al lado del original (12/11/2026, Image)

**El problema:** con el panel oculto la captura sale a 800 × 500 para una página de 1440: una lámina del editor queda en ~260 px de
ancho, y así no se ve si un rótulo blanco se lee o si un titular se corta.

**Lo que sirvió:** copiar el `canvas.lower-canvas` de cada página (los píxeles que dibujó fabric, sin manijas) a una imagen, recortarla
al borde de la página, y armar una hoja propia en la pestaña (un `div` fijo con el original y la réplica de 500 px de alto); después
`resize_window` a 800 × 600 (sin escalar) y captura normal. El editor sólo dibuja las páginas cercanas: un lienzo de 300 × 150 es uno
que todavía no se dibujó (se repite la vuelta). Los datos (textos, colores, cajas) se leen de `/api/image-editor/disenos/<id>`.

**Y el micrófono:** un audio se prueba reemplazando `navigator.mediaDevices.getUserMedia` por un `MediaStream` de WebAudio que
reproduce una nota de voz real (la voz de Windows con System.Speech, pasada a Opus de 8 KB). Graba, transcribe y manda como con
una persona. Así se vio el «Enviar» cortado y se midieron los 105 s de transcripción.

**Y el guiado de «Editar»**, que el 10/11 y el 11/11 «no abría con el panel oculto»: en ws 3 tampoco abrió hoy, ni «Anuncios»
cambió la grilla (la URL sí cambiaba); en ws 9, recargando y esperando 8 s, abrió y se recorrió entero, también a 375. Antes de
anotarlo como falla de la pantalla se prueba otra carga.

## Grabar un audio en el navegador de la app, que bloquea el micrófono (12/11/2026, chat «probar-copy»)

- El navegador de la app no da micrófono («No se pudo acceder al micrófono»). Para probar una nota de voz de punta a punta se le
  da a la página una voz sintetizada: el sintetizador de Windows (`System.Speech`, voz «Helena», es-ES) escribe un WAV, y la
  página reemplaza `navigator.mediaDevices.getUserMedia` por un `AudioContext` que lo reproduce en un `MediaStreamDestination`.
  La transcripción y la respuesta de MaKo son las de verdad.
- ⚠️ **Las tres trampas para meter el WAV en la página:** pegarlo en base64 cuesta ~30.000 tokens por 25 KB; `fetch` de
  hola-mako a `http://localhost` falla («Failed to fetch»: el acceso a la red local se bloquea sin preguntar); y `window.open`
  desde una página local abre en la MISMA pestaña, así que `postMessage` no tiene a quién. **Lo que anduvo:** una página local
  pone el WAV en `window.name` (sobrevive a la navegación a otro origen en la misma pestaña) y navega a MaKo; ahí un `<script>`
  insertado (corre en el mundo de la página) lee `window.name` y reemplaza `getUserMedia`.

## Mirar la foto ACHICADA también engaña: el velo del recorrido «no estaba», y el píxel decía que sí (11/11/2026)

**Síntoma:** en la sexta maqueta de Marketing CoPilot, la foto de 1440 × 900 del recorrido de «Tu web» se veía con la página clara. Parecía que el velo oscuro no se dibujaba.

**El diagnóstico obvio era el equivocado.** Leyendo el color del píxel de la misma foto, la barra de arriba pasaba de `#e4e4e1` a `#5a5a59`: el velo estaba. Recortada a tamaño real, la foto mostraba el velo y el recorte con el aro alrededor del titular. Lo que engañó fue mirarla achicada.

**Lo que queda:**
- Ante «esto no se dibuja» en una captura grande, primero se recorta a tamaño real o se lee el píxel (System.Drawing alcanza).
- Recién después se toca el código.
- Y al revés: una captura achicada que «se ve bien» tampoco prueba detalles chicos.
## Probar leyendo no es mirar: la primera vuelta de Competitor Spy no vio un gráfico sin una sola portada (11/11/2026)

Martín miró las pruebas del 10/11 y dijo que no funcionaron: en Video había un solo outlier, miniaturas grises, títulos cortados y
una página casi vacía, y nadie lo marcó. En Competitor Spy pasó lo mismo: la primera vuelta leyó la página con `get_page_text` y
el DOM, contó tarjetas, midió portadas con `naturalWidth`, y dio por bien una ficha cuyo gráfico tenía **cero portadas** y una
caja blanca de 650 px vacía. Las dos cosas estaban en las capturas; nadie las miró como las mira Martín. Lo que queda:

- **Cada pantalla se captura y se critica al lado de su referencia**, abierta en la misma sesión (fitlo y merrin para Spy). La
  pregunta no es «¿anda?» sino «¿Martín diría que está vacío, cortado, roto o que no se entiende?».
- **Una pantalla vacía en producción es una falla**, aunque el código haga lo que dice.
- **Mirar también sin la barra de agencia**: el super admin ve una ficha distinta de la del cliente (en Spy, una regla global
  de `<aside>` cortaba justo la parte que en el cliente quedaba vacía). `document.documentElement.removeAttribute('data-barra-agencia')`.
- **Una captura que llega en blanco o atrasada no prueba nada** (el panel oculto; ver la entrada de abajo): se espera, se
  vuelve a capturar, y lo que no se puede ver se anota «mirar en Chrome».

## El navegador de la app con el panel OCULTO congela la página: lo que no responde ahí no es una falla de la app (10/11/2026)

**Síntoma:** en la prueba de punta a punta de Image, en el navegador de la app de Claude (`mcp__Claude_Browser__*`), «Editar» no
abría el guiado: ni con un clic real, ni llamando a mano a `onReplicar`. El estado de React no cambiaba, no había errores en la
consola y el botón era el que estaba arriba (`elementFromPoint`). Antes, un script sin esperas tardó más de 45 s y una
navegación quedó colgada 300 s.

**Lo obvio era una falla del guiado en el ws 3, y no:** en el Chrome de Martín, a la vista, el mismo «Editar» abre el guiado.
Con la sesión de Claude sin ventana a la vista, el panel queda oculto y la página corre como pestaña de fondo; con poca RAM (1,9 GB
libres esa noche), además, se congela. Los filtros y el orden sí andaban ahí, así que «a veces anda» no prueba que la página esté
bien.

**La regla:** antes de anotar una falla de algo que no reacciona en el navegador de la app, `tabs_context` dice si el panel está
oculto. Si lo está, se repite con el panel a la vista, o se le pide un turno al Cerebro, antes de creerle. ⚠️ **NO en el Chrome de
la extensión:** tiene la sesión de LEANDRO (ws 10), un cliente real, y el `?ws=` se ignora. La prueba del 10/11 dejó ahí 2 usos
de IA y una apertura vista (docs/pruebas/image-10-11.md, «Límites»).

**Lo mismo con las capturas, 11/11 (Competitor Spy en producción):** los videos de YouTube de «Todas sus piezas» salieron SIN
portada, como tarjetas celestes con texto, y parecía una regresión del despliegue. Era la captura atrasada: el DOM decía
`img.complete`, `naturalWidth 1280`, opacidad 1, y la captura siguiente ya las mostraba. Pasó tres veces en la misma vuelta (el
modal a medio aparecer, el menú «⋯» que no estaba, la caricatura de Leila en blanco). Antes de anotar «no se ve»: leer la imagen en
el DOM y capturar de nuevo. **Y para medir un arreglo de CSS antes de subirlo:** se le inyectan las mismas reglas a la página de
producción y se cuenta (los nombres cortados pasaron de 14 a 3 de 15). Así la captura del «después» no espera el despliegue.
**11/11/2026, CÓMO MIRAR con el panel oculto (medido):** el panel mide 800 × 600 y la página se emula a 1440 × 900.
- **La receta que anda (medida en toda la prueba del 11/11 a la tarde):** `resize_window` 1440 × 900 y, EN EL MISMO LOTE y
  sin espera, `zoom` de `[0, 0, 1440, 900]`. Devuelve la página ENTERA a 1440, reducida a 800 × 500, también después de
  clics, de escribir y de abrir modales.
- ⚠️ **Lo que da un recorte:** un `zoom` suelto, o con una espera entre el `resize_window` y el `zoom`. Sale un RECORTE de
  800 × 500 de la esquina, que parece bueno y no muestra la mitad derecha. A la mañana parecía que lo rompía el primer clic
  con la herramienta; era la espera.
- **El clic desde JS** (`elemento.click()`) sirve para manejar la pantalla sin coordenadas. La página reacciona igual (React).
- **La pintura llega tarde:** la primera captura después de un cambio puede ser la vieja (sin el modal recién abierto) o
  tener las imágenes en blanco con `naturalWidth` 1080. Se mide el estado con JS (`[role=dialog]`, `naturalWidth`) y se repite
  la captura antes de anotar una falla.
- ⚠️ **Lo que el panel oculto NO deja probar: el guiado de «Editar» de Image.** El 10/11 y el 11/11, con el panel oculto, el
  clic (de la herramienta, desde JS, o llamando a `onReplicar` a mano) no lo abría. El 11/11 a 375 la pestaña se congeló entera:
  ni un `javascript_tool` de una línea ni `navigate` en 300 s. Había 2,25 GB libres, así que no era la RAM. El mismo clic,
  en una ventana a la vista, abre el guiado (10/11). Lo demás de la cadena se pudo probar abriendo el diseño por su link
  (`/image-editor/<id>`): editar, ordenar, plantilla, imagen, guardar, reabrir y exportar (docs/pruebas/image-11-11.md).
- **Exportar sin bajar nada a la PC:** se reemplaza `HTMLAnchorElement.prototype.click` para anotar el `download` y leer el
  blob (nombre, tipo, bytes) en vez de bajarlo. Después se restaura.
- **A 375:** `resize_window` con `preset: mobile` + `navigate` (el servidor dibuja el armado de teléfono por el agente). La
  captura normal sirve: el marco es 469 × 1015. Al volver a 1440 hay que navegar otra vez, porque la página quedó con el armado
  de teléfono.
**La captura de 1440 con el panel oculto (11/11/2026, prueba de Copywriting):** sale SIEMPRE el pedazo de arriba a la izquierda, y
repetir `resize_window` no lo arregló (cinco veces). Si la sesión no está abierta en ninguna ventana, `show_pane` tampoco puede
mostrarlo. Lo que sí sirvió: achicar sólo el DIBUJO de la página, que sigue armada a 1440 (`innerWidth` no cambia), con
`document.documentElement.style.transform = 'scale(0.8)'` y `transformOrigin = '0 0'`. La captura cubre unos 1152 × 720 px de
CSS, así que 1440 × 900 × 0,8 entra entera. Se saca antes de hacer clic: las coordenadas de la captura ya no son las de la página.
En 375 la captura sale entera.

## Un `assert.equal` con un elemento de jsdom que falla agota la memoria (10/11/2026)

**Síntoma:** al verificar rompiéndolo `tests/carruseles-imagen-rota.test.ts`, el corredor contó «tests 1» y terminó: los casos
2 a 4 no aparecían, sin ningún error. Con `--test-reporter=tap` salió `RangeError: Array buffer allocation failed` en el 2.

**Lo obvio era la PC sin RAM, y no:** había 7,7 GB libres. Lo que pasaba es que `assert.equal(v.img(), null)`, al fallar, arma el
mensaje de diferencia inspeccionando `actual`, y `actual` era un `HTMLImageElement` de jsdom. Su grafo de objetos (la ventana,
el documento, todo) no entra en memoria. El reporte por defecto se come el error: cuenta sólo los tests que terminaron.

**La regla:** en un test con jsdom, se compara un DATO del elemento (`img?.getAttribute('src') ?? null`), nunca el elemento.
Y un «tests N» menor que la cantidad de `test(` del archivo es un proceso que se murió, no una pasada: se vuelve a correr con
`--test-reporter=tap`.

**Volvió a pasar el 16/11/2026, con esta regla escrita en la cabecera del mismo test** (tests/aplicacion-accelerator.test.ts):
`assert.equal(n.q('iframe'), null)`. Con la agenda rota a propósito, la corrida tardaba de 35 a 117 s y terminaba con
«✖ tests\aplicacion-accelerator.test.ts» sin decir qué test; una de esas roturas corría cuando la PC se quedó sin memoria
(01:33) y se cerró el proceso del agente. Un comentario no alcanzó: el test ahora se revisa a sí mismo (sin comentarios, ningún
`assert.equal(x.q(…), …)`) y compara `x.q(…) === null`. Y lo que se monta se desmonta en un `afterEach`, falle o no el test.

## El juez decide UNA vez, en el horizonte del plan: medido con pruebas A/A (25/10/2026)

**El síntoma (lo midió la crítica):** mirar todos los días y declarar ganador con «95 % dos días seguidos» daba entre 10 y
35 % de falsos ganadores con el volumen de MaKo. El diagnóstico obvio era «el umbral es bajo», y no alcanzaba: el
problema era MIRAR. Cada lectura es otra chance de que el azar cruce el umbral.

**La regla:** «gana» se decide una sola vez, en el horizonte: el día en que todas las ramas tienen el n del plan
(`volumen.ts`, calculado ANTES de arrancar) y pasaron 7 días. Ese día depende sólo de cuánta gente entró, nunca de los
resultados, y por eso vale como una sola mirada. Antes del horizonte sólo se corta por daño, con 99,5 % y con la mitad
del plan en cada rama. Cortar NO es «no funciona»: queda `no_concluyente`. Al tope no se registra ninguna verdad.

**Los números (semillas fijas, `tests/pruebas-juez-aa.test.ts`):** en una automatización A/A (10 %, 12 por rama y por
día, ventana de 7), 1,3 % «gana B» y 0,7 % «gana el control». Con 3 ramas, 1 %. En una landing (5 %, 34 por día),
2 % + 1,3 %. Con el efecto del plan (10 % → 18 %), B gana 78 % de las veces. El test exige ≤ 5 % de falsos ganadores. Con
«mirar todos los días» da 2 / 3, y con un juez mudo, 4 / 1: un juez que nunca decide también pasa el A/A, por eso el test
mide la potencia.

## La regla doble de VWO (pérdida < 1 %) no ataba con 98 %: salió de «gana» (25/10/2026)

El diseño la pedía junto al 95 %. Con el umbral en 98 % no frenaba nunca: el caso más extremo, 0/6 contra 6/6, pierde
0,00115 con un techo de 0,0033, y su rotura quedaba verde. Una regla que nunca actúa es una regla mentirosa (el Cerebro):
salió de «gana» y quedó sólo al tope, donde SÍ decide (1/10 contra 4/10 da 85 % de ser la mejor, pero pierde 0,0102, y se
queda A). Si el umbral baja, se mide de nuevo antes de traerla.

## Integrar en vez de sortear, y la grilla que se agranda sola (25/10/2026)

El diseño pedía 20.000 sorteos de la Beta por lectura. El test A/A corre decenas de miles de lecturas: con sorteos
tardaba minutos. `estadistica.ts` integra sobre una grilla (1.500 puntos) y queda a ~1e-5 de la fórmula cerrada de Evan
Miller.

**⚠️ La trampa:** la primera rotura de «grilla gruesa» salió VERDE. Ningún caso del test tenía dos ramas angostas y
cercanas junto a una lejos. Con ese caso, 1.500 puntos daban un error de 7,5e-4. Por eso la grilla se agranda hasta 16
puntos por desvío de la rama más angosta (tope 20.000), y el test lleva el caso.

**El prior es Beta(1 + 10·p, 1 + 10·(1 − p)), no Beta(10·p, 10·(1 − p)):** con 0 éxitos y la tasa conjunta casi en 0, α
quedaba por debajo de 1 y la densidad era infinita en el 0. El «1 +» la deja acotada para la integral.

## «Da lo mismo» tiene que cruzar el cero (25/10/2026)

Con la regla de la crítica (el intervalo del 90 % dentro de ± el efecto del plan), una B 50 % PEOR salía «da lo mismo»
en 1 de cada 3 simulaciones: el intervalo [−70 %, −20 %] queda dentro de ±80 %. Ahora además tiene que cruzar el cero.
Si no lo cruza, es `no_concluyente`.

## Sólo cuentan las personas maduras (25/10/2026)

El diseño (2.5) contaba también a las que todavía no cumplieron la ventana pero ya lograron la métrica. Eso sube la tasa
de la rama que convierte más RÁPIDO aunque no convierta más. `metricas.ts` cuenta sólo a las que ya cumplieron la
ventana, y el éxito sólo dentro de ella. Si el medidor no devolvió a alguien maduro, la lectura falla: no cuenta como 0.

## Dónde se guardan, y cómo concluyen en Experimentos (A2, 25/10/2026)

**Las tablas** (`supabase/migrations/0335_pruebas_ab.sql`, aplicada en producción el 25/10/2026 19:27) llevan
`workspace_id` SIN default, porque las viejas tienen DEFAULT 1 y el 1 es un cliente. Tienen RLS sin políticas y las lee
`lib/pruebas/store.ts` con el cliente de servicio y el ws explícito, porque la página pública y el cron no tienen sesión.
Sin la migración: crear tira `PruebasSinTabla`, servir da el CONTROL sin escribir y el cron no decide. El reset del
Cliente de Prueba avisa «esa tabla no existe» y sigue (`lib/reset-workspace.ts`), así que la migración puede ir junto con
el deploy.

**El veredicto va a `experimentos` así:** `gana_variante` → validada; `gana_control` → refutada, y sólo porque el juez
la da con daño demostrado en el horizonte; `da_lo_mismo` y `no_concluyente` → no_concluyente. «No se vio una diferencia
mayor a X» no es «probado que no funciona». MaKo cita «PROBADO QUE NO FUNCIONA» sólo de las refutadas que traen
`config.prueba_id`: un antes/después refutado medía la cuenta contra sí misma (`lib/experimentos-verdades.ts`).

**⚠️ `fmtVal` dibujaba mal una métrica de prueba (lo había confirmado la crítica):** «ab:…» no estaba en `METRICA_FMT`, caía
en 'num', y `Math.round(0,09)` da 0. Ahora el prefijo `ab:` formatea en % y la tarjeta del Dashboard rotula «A» y la
letra de la rama (con 3 ramas, la que se cuenta puede no ser B: va en `config.variante`). El catálogo de
`lib/experimentos-catalogo.ts` NO se tocó: lo lee la IA que propone experimentos, y con «ab» adentro empezaría a proponerlos.

**El cron** (`/api/cron/pruebas`, 6:15 UTC) todavía no tiene medidores: los suman A3 (Automations) y Landings. Sin medidor,
la lectura de esa prueba queda fallida y no decide. Una lectura que falla nunca cuenta como «0 éxitos».

## La tarjeta de Automations y lo que mide (A3, 25/10/2026)

La tarjeta «A/B TEST» y sus puertas están en docs/hallazgos-chatbot.md («La tarjeta «A/B TEST»…»). Del motor de las pruebas:
- **Los medidores van por SUPERFICIE y por métrica** (`Medidores`, lib/pruebas/corrida.ts): «agendó» de una automatización
  no se mide como el de una landing. Los de Automations están en lib/pruebas/medidores-automatizacion.ts.
- **Al medidor le llegan TODAS las asignaciones**, no sólo las maduras. «Agendó» no tiene hora propia (`junta_1_at` es la de
  la reunión), así que su hora es la de la lectura que lo vio por primera vez. Si sólo se le pasan las maduras, no hay
  forma de saber si pasó dentro de la ventana. El primer resultado se congela (`resultado` y `resultado_at` en la
  asignación). Nunca se congela un «no»: puede volverse «sí» mañana.
- **⚠️ Lo congelado también va POR MÉTRICA** (`prueba_asignaciones.resultados`, jsonb `{respondio: {at}}`). Con una sola
  columna `resultado`, el «sí» de «respondió» (la que decide) se leía después como el «sí» de «agendó» (el guardrail): un
  guardrail que nunca frena. Lo encontró la relectura, no un test.
- **`previo` es un mapa por métrica** (`{agendo: true}`, jsonb): la que decide y un guardrail pueden ser las dos de estado.
  Sin previo, un estado no cuenta (no se sabe si ya estaba).
- **La rama se escribe cuando el lead LLEGA a la tarjeta** (`falta_rama_ab`, como `faltan_hechos`), no antes. Desde ahí
  corre su ventana. Sin prueba corriendo de ESA tarjeta, o ante un error, va a la A.
- **Editar mientras corre:** guardar el flujo compara la firma de cada rama (SÓLO sus tarjetas, no lo compartido después
  de que se juntan). Si cambió algo, abre una época nueva. Si se borró la tarjeta o cambiaron las ramas, la detiene
  (`revisarLaPruebaAlGuardar`, que nunca frena el guardado).

## Sin hacer

- **A3, lo que queda:** la dimensión «rama» en los gráficos del Dashboard (Métricas lo muestra en una franja fija), verla en
  pantalla, y la primera prueba real en el Cliente de Prueba (la migración ya está aplicada).
- **El plan de una prueba de «Agendó» usa la tasa de «Respondió»** (`historiaDe`, lib/pruebas/automatizacion.ts): el n del
  plan queda corto, y la prueba llega antes a su horizonte con menos potencia. El juez sigue mirando una sola vez (no
  inventa ganadores), pero ve menos. Falta leer la tasa de agenda de la automatización.
- ~~**Landings** tiene las firmas y el store (25/10): sus medidores van en `MEDIDORES.landing` del cron.~~ (18/11/2026, O18: están; ver «La landing sirve y cuenta su prueba A/B», arriba).

## Mirar todos los días miente: 10 a 35 % de falsos ganadores con el volumen de MaKo (25/10/2026)

**Vive en:** `lib/pruebas/juez.ts` (todavía no existe: esto es lo que su test tiene que fijar).

- **El diseño obvio era el de VWO:** declarar ganador con P(mejor) ≥ 95 % en dos lecturas diarias seguidas, más pérdida esperada
  menor al 1 %, con un prior «escéptico» de peso 10. El crítico simuló 20.000 pruebas A/A (sin ninguna diferencia real) con ese
  calendario:
  - automatización, 25 por rama y por día, mínimo 20, 60 días: **17,4 % «gana B» falso y 16,9 % «gana el control» falso**;
  - con mínimo 300 por rama: 14,5 % y 16,6 %;
  - landing, 34 por rama y por día, mínimo 400, 28 días: 10,0 % y 12,1 %;
  - UNA sola mirada al llegar a 1.800 por rama: 4,7 % y 0 %.
  Un prior de peso 10 son 10 visitas inventadas: al lado de cientos de visitas reales no frena nada.
- **La regla:** el n por rama se calcula ANTES de arrancar (`volumen.ts`) y «gana» se decide sólo en ese horizonte. Las lecturas
  de antes sólo pueden cortar por DAÑO (99,5 %). El test del juez simula A/A con el calendario real de lecturas y exige ≤ 5 % de
  falsos ganadores, y es la puerta de todo lo demás.
- **Cortar temprano no es «no funciona».** Si el corte termina en «gana el control» y eso se guarda como `refutada`, MaKo lo
  repite en todo el dashboard como «probado que no funciona» (`resumenExperimentos`). Una prueba cortada queda `no_concluyente`.
- **«Da lo mismo» con ±10 % relativo nunca se cumple** con este volumen (con 10 % de tasa harían falta ~4.900 por rama): el
  umbral es el efecto mínimo detectable planificado, y el texto dice «no se vio una diferencia mayor a X».
- **El aprendizaje cita el INTERVALO, no el punto:** 2/20 contra 8/20 da P = 0,969 pero el lift va de +10 % a +523 %. Un «subió de
  10 % a 40 %» presenta como verdad un número que no se sabe.
- **«Agendó» y «respondió» son estados que se reescriben** (una reunión vieja cuenta apenas el lead entra; la inscripción se
  reusa al volver a entrar): se congelan en la asignación.

*25/10/2026, el Cerebro (claude5), con los relevamientos de pruebas A/B y de conexiones (docs/diseno-pruebas-ab.md, docs/conexiones-y-ayuda.md).*

## El listado del repo pasó de 1 MiB y las guardas cayeron con ENOBUFS (5/11/2026)

**Síntoma:** dos ramas sin relación (recibos y Admin) quedaron en rojo en la misma guarda, `tests/resend-clave-admin.test.ts`, sin tocar nada de Resend. **Lo obvio era que el código de la rama nombraba la clave, y no era eso.** El error real es `spawnSync git ENOBUFS`: `git ls-files` da 1.048.981 bytes, y `execFileSync` corta en 1 MiB si no se le da otro tope. Falla cualquier test que liste el repo entero, y sólo cuando entra en los afectados, por eso parecía de esas ramas.

**La regla:** un `execFileSync('git', …)` que lista todo el repo lleva `maxBuffer`. Con ruta (`ls-files app lib`) todavía entra, pero el repo crece y un día deja de entrar.

## Probar el Dashboard en producción con el navegador de la app: cinco trampas (10/11/2026)

- **Si nadie tiene la sesión abierta en una ventana, el panel del navegador queda oculto** y `show_pane` no lo puede mostrar. La
  página corre como de fondo: la primera captura sale negra o vieja (todavía no pintó). Lo que sirve: `document.getAnimations().forEach(a => a.finish())`
  antes de cada captura, medir con el DOM y, si la captura sale negra, volver a capturar.
- **Un `click()` de JavaScript no abre la lista de hojas** (`button.dash-pestana`): escucha `pointerdown`. Hay que mandar
  `pointerdown`, `mousedown`, `pointerup`, `mouseup` y `click`, en ese orden, o usar el clic del navegador.
- **Arrastrar una flecha hacia una tarjeta cerca del borde de arriba corre la página** (la selección de texto la desplaza), y la
  flecha cae en otra tarjeta o en ninguna. Con las dos tarjetas a la vista y lejos del borde, anda.
- **Para mirar un negocio de cliente sin riesgo**, después de cargar se pisa `window.fetch` para que todo POST con
  `"accion":"guardar"` a /api/graficos devuelva 500. Mirar no guarda (`alMoverGrilla` sólo escribe editando), pero un link con
  `?hoja=<plantilla>` sí agrega y guarda. Ojo: la traba se va con una recarga entera; un link de la app (navegación de Next) la conserva.
- **Exportar sin bajar archivos:** se pisan `URL.createObjectURL` y `HTMLAnchorElement.prototype.click` para leer el CSV que se iba
  a bajar, y `window.print` para ver que el PDF arme su vista (`lk--imprimir`).

## Probar el Web Generator con el panel oculto: tres trampas más (10/11/2026)

- **Un botón que «no abre» puede ser una página sin hidratar.** Con el panel oculto, la hidratación tarda: el botón está pintado
  pero sin React encima, y el clic (de mouse o de JS) no hace nada. Antes de anotarlo como roto:
  `Object.keys(boton).some(k => k.startsWith('__react'))`. Pasó con «Compartir»; con la página hidratada abría siempre.
- **Una pestaña nueva con el panel oculto mide 0×0** hasta que se le pone un tamaño (`resize_window`): `innerWidth` da 0 y el
  primer `resize_window` puede contestar «Policy check in progress»; se repite.
- **El teléfono se sirve en la MISMA dirección**: con el tamaño «mobile» (que cambia el navegador a Android), `/web-generator`
  muestra la lista del teléfono (`app/m/landing`). Si el tamaño se pone DESPUÉS de cargar, queda el editor de escritorio apretado:
  primero el tamaño, después la dirección.
- **Una `await` con `setTimeout` en una pestaña de fondo puede no volver nunca** (los relojes se frenan): para esperar, se lee
  el DOM en llamadas separadas.

## Leer no es mirar: la prueba que no ve capturas no vio nada (11/11/2026, Web Generator)

Martín, después de la primera vuelta: «deberían haber detectado esto… incluso yo detecté otros errores». La primera se hizo
leyendo `innerText`, el DOM y el código; la segunda MIRÓ cada pantalla con su captura y encontró tres defectos que ninguna
medición había visto: un título partido a mitad de palabra con un panel abierto, una galería sin fotos que eran tres títulos
sueltos, y la cabecera del teléfono con el título tapado por una pastilla.

- **Cada pantalla se mira con su captura**, a 1440 y a 375, y cada landing publicada. Se critica al lado de la referencia
  (Gamma): vacío, gris, cortado, pobre, qué no se entiende. Una pantalla vacía en producción también es una falla.
- **Una captura en blanco o vieja no prueba nada**: con el panel oculto, primero `getAnimations().forEach(a => a.finish())` y
  repetir la captura; si sigue así, se mira en una ventana a la vista (Chrome) antes de anotar nada.
- **Abrir cada panel lateral** (Animar, Temas, Comentarios): cambian el ancho del lienzo, y lo que depende del ancho se rompe ahí.
- **Una grilla de cabecera `minmax(0, 1fr) auto minmax(0, 1fr)`** le da a cada costado un tercio fijo: lo que no entra en su
  tercio se monta sobre el título. Los costados van con `minmax(max-content, 1fr)` y el título con `minmax(0, auto)` y «…».

## La sesión del navegador de la app no sobrevive al cierre de la app (11/11/2026, Dashboard)

- **Síntoma:** a las 14:43 UTC, después de que se cerró la app de Claude en la PC, `hola-mako.com/api/auth/me` en el navegador de la app
  daba `autenticado: false` y toda página caía en /login. El Chrome de la extensión, a la misma hora, tenía otra vez la sesión de LEANDRO
  (ws 10, un cliente real), aunque a la mañana había tenido la de Martín.
- **La regla:** antes de probar, `/api/auth/me` en la pestaña propia (nunca darlo por sabido de la mañana). Sin sesión de Martín en
  ninguno de los dos, no se prueba en el otro: se pide que Martín vuelva a entrar (lo pide el Cerebro). En el Chrome con Leandro no se toca nada.


## En el navegador de la app con el panel oculto, `loading="lazy"` no carga nada (11/11/2026, Web Generator)

Midiendo la portada de outliers, `document.images` daba 0 de 42 cargadas a los 8 s: con el panel escondido la página no se pinta,
y una imagen diferida espera a estar cerca de la pantalla, que nunca llega. No es una falla de la página. Para medir el peso, se
piden las imágenes con `fetch` (o se pasan a `eager`) y se suman; para mirarlas, se repite `resize_window` antes de la captura.

## El guard del voseo pasó en verde en la PC y dio rojo en la punta (13/11/2026, chat «probar-copy», corrida 1256)

- **Síntoma:** `tests/puente-panel-copy.test.ts` daba 9/9 en la PC con un «acá» en un archivo nuevo (lib/copywriter/oferta-elegida.ts),
  y la punta lo marcó.
- **Causa:** el guard lista los archivos con `git ls-files` (el ÍNDICE, no el disco). Un archivo nuevo sin `git add` no se revisa. La
  cabecera del test lo dice; corrido «antes de commitear» no sirve.
- **Regla:** con un archivo NUEVO, el guard del voseo (y todo guard que barre el repo con `git ls-files`) se corre DESPUÉS del
  `git add`.

## Mostrar /planes fuera de Next (un visor o un artefacto) (15/11/2026)

- **El modo del sitio** sólo se elige con `localStorage['mako.sitio.modo']` (app/vsl/_competencia/TemaSitio.tsx), y cada
  cambio se avisa con el evento `mako-sitio-modo`: así se fuerza el oscuro en una captura sin tocar el botón.
- **El recoloreo aclara todo recuadro oscuro que no tenga `data-tema-fijo`**: el marco del VSL queda claro en el modo claro y
  sólo lo tapa el video. Y lo que va dentro de `data-tema-fijo` no se da vuelta NUNCA: un texto oscuro ahí queda negro sobre
  negro en el oscuro (pasó con la barra de MaKo Tokens).
- **Un iframe de otro sitio no se ve en el visor de claude.ai**, ni en una captura sin red: el VSL de Panda va como una tapa
  con un link.

## Una prueba con WebKit hizo sonar los videos en la compu de Martín (16/11/2026)

- **El WebKit de Playwright en Windows reproduce el audio por los parlantes reales.** Una prueba del VSL en el motor de Safari
  hizo sonar «un montón de veces» los anuncios con IA de Martín y Mauricio mientras él estaba por entrar a una llamada. Chromium:
  siempre `--mute-audio`; WebKit no tiene esa bandera: no correrlo con la página entera (o pisar `HTMLMediaElement.prototype.play`
  para que todo arranque mudo).
- **No sirve para probar video:** el WebKit de Windows (WinCairo) no trae HLS ni H.264, así que el reproductor de Panda carga su
  interfaz y nunca su video. Con la portada, además, el evento `load` no llega en 60 s y la captura se queda «waiting for fonts».
  Un «no carga en Safari» no se confirma ni se descarta desde esta PC.
- **La versión:** playwright-core pedía `webkit-2370` y está instalado `webkit-2359`: se le pasa `executablePath` al .exe de esa
  carpeta.
- **La guardia de RAM frena por palabras del comando** (un listado con «playwright» en la ruta también): para mirar procesos,
  `Get-Process` por nombre o `Win32_Process -Filter "ProcessId=…"`, sin nombrar el navegador.
