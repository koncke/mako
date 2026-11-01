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

## Lo que quedó sin hacer

- **La foto de Ximena Fukuda es una toma de escenario** donde la cara es chica: su parecido es el más
  flojo de los catorce. Si aparece una foto de frente, vale regenerarla.
- **No se probaron en la app de verdad:** el anillo y las cuatro caras apagadas se miraron con el `Muneco` real en una página suelta, no en un chat con sesión.
