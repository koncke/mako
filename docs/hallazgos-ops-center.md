# Hallazgos — Ops Center (los coaches y sus referentes)

La casa de varios chats: el central, el Funnel Coach y el Offer Coach. Quién aconseja de qué está en
`lib/asesores/catalogo.ts`, su ficha destilada en `lib/asesores/fichas.ts`, la caricatura en
`public/asesores/<id>.png` y se elige tocando la criatura, en `app/second-brain/ElegirReferente.tsx`.
Acá va lo que costó y no se deduce leyendo el código.

---

## Dos fotos parecidas dan dos muñecos IDÉNTICOS, y el estilo no es el culpable (1/11/2026)

**El síntoma.** Las caricaturas de Marcos Razzetti y Víctor Heras salieron indistinguibles. Martín:
«entre marcos razzetti y victor heras no hay diferencia».

**El diagnóstico obvio era el equivocado.** Parecía el prompt, o el estilo. No: **las dos fotos de
origen son casi la misma foto** — los dos morochos de treinta y pico, barba corta, saco azul marino,
fondo neutro, misma pose. Y el estilo de figurita encima normaliza la cabeza a una esfera y los ojos a
dos óvalos iguales, así que la identidad queda colgando de tres cosas: pelo, barba y ropa. Cuando esas
tres también coinciden, los dos muñecos son el mismo muñeco.

**La regla que queda: un prompt por persona, que NOMBRE lo que la diferencia.** No un prompt común con
el nombre cambiado. Para cada uno se mira la foto y se escribe qué tiene de propio — volumen y forma del
pelo, borde y densidad de la barba, color de la camisa — **y además se le da un color de fondo propio**:
a 92 px, que es como se ven en la pantalla, el fondo es lo primero que el ojo separa.

**⚠️ Y lo que NO se toca: la forma de la cabeza.** Para separar a Razzetti le puse «cabeza ancha y
redonda» y Martín lo cazó en el acto: «su cara se ensanchó muchísimo». Exagerar el cráneo rompe el
parecido, que es justo lo que la caricatura tiene que conservar. La diferencia va en pelo, barba, ropa y
fondo; nunca en el ancho de la cara.

## El canal que devuelve la búsqueda puede ser OTRA PERSONA (1/11/2026)

Buscar el nombre en `search.list` de YouTube y agarrar el primer resultado trajo a una Sofía Contreras
que no era. Martín: «Esa no es sofia contreras». **Se resuelve por `forHandle`, no por búsqueda**, y se
contrasta con los suscriptores y con lo que el referente hace: `@sofiacontreras` (178 mil, Mastery Haus)
es ella; `@marcosrazzettii` (29,2 mil) es él y no los cuatro homónimos de 1 a 155 suscriptores;
`@derekchamizo` se llama «YouTube Millonario», que no aparece buscando su nombre.
**Antes de dibujar, las fotos se le muestran a Martín en una hoja de contacto.** Un dibujo de la persona
equivocada se descubre recién cuando él pregunta «¿ése quién es?», y para entonces ya se gastó.

## Tres de los catorce usan gorra con marca, y uno una remera con logo (1/11/2026)

Hormozi, Derek Chamizo y Guille Collado posan con gorra de marca; Marc Verdú con una remera con logo.
El prompt pide **explícitamente** gorra y remera LISAS, «no text, no logos, no brand marks anywhere».
Si alguna se regenera, eso no se puede perder: el producto dice «Inspirado en», no reproduce marcas de
nadie.

## Un PNG no parpadea, y los ojos decían el estado del chat (1/11/2026)

Los retratos dibujados a mano tenían `.mun-ojos`: parpadeaban y decían si el chat trabajaba, como la criatura de MaKo. Un PNG no.

**Decidido: una sola cara en todos lados, y el estado por afuera de la foto** (`app/admin/operaciones/Retratos.tsx`): un anillo que late mientras trabaja, y la foto apagada si está cansada o dormida. Flotar sigue. Conservar el SVG para el chat activo era mostrarle a la misma persona dos caras, y una que Martín ya rechazó: por eso se borraron.

**Lo que se pierde, a sabiendas:** el parpadeo. Choca con su regla del 21/10 («las criaturas, siempre, donde sea que estén deben tener su animación de movimiento, y parpadeo»), y si lo extraña, hay que resolverlo con otra imagen, no con otro código.

## El prompt aprobado de las caricaturas no estaba escrito en ningún lado (1/11/2026)

Las catorce caras salieron de ocho vueltas de prueba y error, y el prompt que Martín aprobó quedó
**sólo adentro de las llamadas a la herramienta**: para recuperarlo hubo que rastrear un transcript
de 173 MB. Una caricatura nueva, o regenerar una, sin ese texto empieza de cero las ocho vueltas.
Queda acá, literal. Lo único que cambia por persona es el tramo de «Make him unmistakable».

```
Collectible vinyl toy caricature figure of the man in the reference photo — glossy toy-figurine
look like a Funko/Pop Mart collectible. HEAD AND SHOULDERS ONLY, tightly cropped, centered, facing
forward. Oversized head but keeping HIS OWN face shape — do not widen or round out the face, do not
puff up the cheeks. Eyes NORMAL SIZE and normally proportioned, open and bright, glossy with a small
catchlight — NOT oversized, NOT anime. Make him unmistakable: <PELO · BARBA · ANTEOJOS O GORRA ·
PIEL · GESTO, lo que lo separa de los demás>. Wearing <PRENDA LISA, sin texto ni logo>. Smooth
glossy vinyl surfaces, soft studio product lighting with gentle reflections. Plain <COLOR PROPIO>
background. No text, no logos, no brand marks anywhere.
```

Se genera con la foto de referencia subida (`upload-asset-from-url` → `generate-image` con
`imageReferences`). Las fotos están en el scratchpad de la sesión, en `refs/<id>.jpg`, y la hoja de
contacto que se le muestra a Martín la arma `hoja.py`.

## El nombre del curso es el nombre de la CARPETA, y puede estar mal (1/11/2026)

**El síntoma.** Al sumar seis referentes nuevos, antes de dibujar se buscó a cada uno para sacarle
la foto. Dos no cerraron:

- **«Jaime Jiguera» no existe.** Es **Jaime HIGUERA**, el fundador de E-com Growth Partners. El
  apellido mal escrito venía de la carpeta del curso y ya había entrado al repo en dos lugares más
  (`lib/offer-autores.ts` y `docs/offer-marco.md`), así que se corrigió en los cinco archivos a la
  vez. La pantalla dice «Inspirado en \<completo\>»: un apellido mal escrito se publica con el
  nombre de nadie.
- **«Tino Mossu» sí es él**, aunque la transcripción automática escriba **«Teo»** cada vez que se
  nombra (13 veces contra 7 de «Tino» en las primeras veinte clases, y «Mossu» cero). Suenan casi
  igual en español. Confirmado por fuera del curso: Crónica y Forbes Argentina lo ubican en Merlo,
  CEO de Factor Studios, fundador de «la U del Closer» en diciembre de 2023.

**La regla que queda: el nombre de un referente se verifica CONTRA EL MUNDO antes de dibujarlo, no
contra la carpeta.** Y la transcripción automática no sirve para nombres propios: confirma el
método, no quién lo firma. Es la misma familia de error que la Sofía Contreras equivocada, pero una
capa antes — ahí se dibujó a otra persona; acá se habría publicado a una persona que no existe.

## Cuál de los 130 cursos de Knowledge sirve, y por qué el título engaña (1/11/2026)

**El pedido.** Martín: «hay un montón de cursos que podríamos aprovechar de los que tenemos en
Knowledge... Implementa la mayor cantidad posible que tenga sentido, obviamente, de algunos, por
ejemplo, de trading o de e-commerce o de cosas que no tienen sentido para MaKo, pero el resto sí».

**Lo que hay.** 130 cursos, uno por archivo en `app/conocimientos/curso-<slug>.ts`, con el nombre de
cada clase en `grupo`/`titulo` y la transcripción en `public/cono-tx/<videoId>.json` (9.719
archivos). **Leer los `grupo` de un curso cuesta un segundo y dice de qué se trata de verdad**; las
transcripciones pesan 60-130 KB por clase y sólo hacen falta para destilar la ficha.

**El título miente, y es lo que más tiempo ahorra saber:**

- **«Belikethealgo»** suena a algoritmo y contenido orgánico: sus módulos son *orderblocks*,
  *imbalances*, rango de Asia y sesión de Londres. Es **trading**.
- **«Master Escala 100k»** (186 clases) suena a escalar un negocio: es **dropshipping** con Shopify.
- **«PROGRAMA RAIO»** (201 clases) es *interactive storytelling* para aprender inglés.
- **«DominIA Academy»** (159 clases) no es IA para vender: es ingeniería de automatizaciones con n8n.
- **«Growing Content Specialist»** es para el EMPLEADO que edita, no para el dueño del negocio.

**Dónde se cortó.** MaKo es ticket alto (coaches, agencias, consultorías), así que afuera quedaron
e-commerce, dropshipping, importación, Amazon FBA, trading, inmobiliario, afiliados, canales de
YouTube automatizados, los cursos de herramienta (Canva, CapCut, edición, ChatGPT, HeyGen) y los de
mentalidad. Afuera también los que no tienen autor con nombre (**un referente sin persona no se
puede dibujar ni atribuir**): «Club de Negocios», «MIDAS CONCEPT», los de «Lathos club».
Entraron seis: Felipe Vergara (anuncios), Jaime Higuera (socio de crecimiento), Adrià Solà Pastor
(comunicación), Augusto Bianchi (llamadas de ticket alto), Tino Mossu (objeciones y seguimiento) y
Jordi Seguís (TikTok).

**Un curso puede entrar A MEDIAS, y hay que decirlo en la ficha.** Growth Partner enseña el modelo de
socio (fijo + porcentaje, nicho, oferta, setting, llamada) a clientes de e-commerce: el modelo se
traslada a ticket alto y su catálogo de ofertas de entrada —producto gratis pagando el envío, set de
prueba— no. Va anotado adentro de la ficha, que es donde el chat lo va a leer.

**Y hay cursos que enseñan cosas que MaKo no puede aconsejar.** En Five Stars los alumnos cuentan
que cerraron con plazos de 24 h y cupos inventados; en «La universidad del Closer» la respuesta
universal se formula como «si te puedo GARANTIZAR que…» y se proponen catorce contactos por semana;
en el Instituto de Comunicación se improvisa un estudio de una universidad como ejemplo.
`lib/asesores/contexto.ts` ya prohíbe la escasez inventada y las promesas de ingresos, pero **la
prohibición genérica no alcanza cuando el marco entero se apoya en eso**: cada una lleva su línea
`⚠️ NO SE TRASLADA` con la versión usable.

**El tope de 5.200 caracteres no es decorativo.** `tests/coaches-ops-center.test.ts` lo afirma
porque la ficha entra entera al system del turno. Las seis salieron entre 5.600 y 7.000 y hubo que
recortarlas: primero las citas de clase a una por marco, después viñetas de la cola (CÓMO HABLA,
QUÉ PREGUNTA). **Nunca un marco**: la cola repite el tono que los marcos ya dejan claro.
⚠️ Y el recorte automático de la última viñeta se comió el acento invertido que cierra el template
en dos archivos — el error sale recién al importar, como «Unterminated string literal». Si se
recorta por script, hay que contar los acentos invertidos después.

## Lo que quedó sin hacer

- **La foto de Ximena Fukuda es una toma de escenario** donde la cara es chica: su parecido es el más
  flojo de los catorce. Si aparece una foto de frente, vale regenerarla.
- **No se probaron en la app de verdad:** el anillo y las cuatro caras apagadas se miraron con el `Muneco` real en una página suelta, no en un chat con sesión.
