# Para contarle a Joan y Juanfran

Lo que se les puede decir que **ya está**, y lo que **viene**. Se actualiza cada vez que
sale algo del feedback del grupo «Makito».

**Cómo se usa:** los renglones de «ya está» son hechos, no copy — Martín los escribe a su
manera. Lo que sí importa es que **ningún renglón entra acá hasta estar desplegado y
verificado contra la base**, porque decir «ya está» sobre algo que no está es cómo se
pierde la confianza del que reporta.

Contexto de quiénes son y cómo llega su feedback: `docs/hallazgos-landing.md` y la memoria
`grupo-makito-feedback`. El cliente del que se habla casi siempre es **Código Inmobiliario
(ws13)**, que es cliente de ELLOS.

---

## ✅ Ya está, desplegado y verificado — 27/09/2026

### 1. La retención del VSL ya se mide bien

**Lo que reportaron (22/09):** *«no está trackeando bien la retención del VSL, porque
ustedes no lo tienen en Panda Video o YouTube»*.

**Qué pasaba:** el video se estaba contando **dos veces**, como si fueran dos videos
distintos. Por eso las reproducciones salían al doble y la curva de retención aparecía
partida o vacía. No era que faltara soporte de su reproductor: ya estaba.

**Cómo se ve ahora:** un solo video, con sus 2.631 eventos y su curva completa.

⚠️ **Lo que ellos tienen que hacer:** repegar el código del Pixel en su landing. El que
tienen instalado es de una versión vieja y sigue mandando el dato duplicado desde su
página. El arreglo del servidor ya los cubre, pero repegar lo deja limpio de punta a punta.

### 2. Ya se ve de qué anuncio y de qué creativo vino cada lead

**Lo que reportaron (22/09):** *«¿dónde puedo ver la trazabilidad inversa para saber de qué
anuncio, de qué creativo llegó la agenda?»* y *«todos me aparecen como orgánico manual»*.

**Qué pasaba:** tres cosas distintas. La ficha no sabía dibujar el canal «landing» y lo
mostraba como «orgánico manual»; el id del anuncio se cortaba por el largo de la URL en la
mitad de los casos; y los leads que ya existían nunca se iban a actualizar solos.

**Cómo se ve ahora:** la ficha del lead muestra **Campaña › Conjunto › Anuncio**, con link
directo al anuncio en el Ads Manager. **18 de sus 21 leads ya tienen su anuncio y su
campaña** (antes: ninguno).

Los 3 que faltan: dos entraron por Cal.com sin identificador de visita, y uno sólo trae el
identificador de clic de Facebook, que hoy no se guarda.

### 3. ~~Lo del formulario~~ — ESTO ESTABA MAL DE MI PARTE, NO SE LO CUENTES

⚠️ **Contesté la pregunta equivocada y conviene que quede escrito**, porque es el tipo
de error que más caro sale: una respuesta segura sobre otra cosa.

Yo revisé el formulario DE SU LANDING, comprobé que no existe (lo único que capta es la
agenda de Cal.com) y cerré el tema con un «no hay nada roto». Todo eso es cierto **y no
era lo que reportaron.**

Lo que reportaron, en palabras de Martín el 27/09:

> «Se trata de las campañas de **Clientes Potenciales de Meta, con formulario**… Que esas
> campañas no las corren ellos, sino **sus clientes**. Sus clientes son inmobiliarias que
> corren esa campaña, los compradores de casas rellenan sus datos en el formulario de
> Meta, y **ese lead no llega**.»

O sea: **Instant Form / Lead Ads de Meta**, que es otro pipeline entero — el formulario
vive DENTRO de Meta, el lead llega por webhook o por sondeo de la API, y no tiene nada que
ver con el Pixel ni con la landing.

**Y la cadena de tres es lo que lo vuelve distinto de todo lo demás:** la campaña la corre
la inmobiliaria (cliente de Joan), no el ws13. Así que la página de Facebook y el
formulario **son de un tercero**, y que el token del ws13 pueda leer esos leads no es
obvio: es la primera cosa que hay que comprobar.

Está en medición ahora. **No se cuenta nada de este punto hasta tener el número.**

Lo único que sí queda en pie de lo que miré: su funnel tiene las «entradas» vacías, así
que conviene declarar de dónde entran sus leads igual.
### 4. Cómo activar el aviso de lead cualificado a Meta

Ya estaba, y quedó contestado en el audio del 24/09: se entra al CRM y se marca el lead
como **cualificado**. Con eso se dispara solo.

---

### 5. El aviso duplicado al agendar ya no se repite

**Lo que reportó Joan (21/09):** el aviso de MaKo por WhatsApp cuando se agenda un lead
llegaba dos veces.

**Qué pasaba:** el proveedor de la agenda reentrega el mismo aviso por las dudas, y MaKo
tardaba entre 7 y 11 segundos en anotar que ya lo había mandado — así que la segunda copia
entraba justo en ese hueco. Medido: de sus 51 avisos, 21 salieron duplicados.

**Cómo se ve ahora:** un aviso por reserva. Y no se arregló «esperando más»: ahora el
primero se reserva el aviso de forma atómica, así que aunque lleguen diez copias a la vez,
sale una.

### 6. El «te quedaste sin tokens» de Gemini: el mensaje mentía, y había una cuenta sin usar

**Lo que reportó Joan:** que cada rato MaKo le decía que se había quedado sin tokens, y eso
que tiene varias cuentas conectadas.

**Tenía razón dos veces, y eran dos cosas:**

· **MaKo por WhatsApp nunca probaba su segunda cuenta.** Siempre pegaba contra la primera,
  así que cuando ésa se topaba, se rendía teniendo la otra entera sin tocar. Medido: cero
  usos de la segunda cuenta en toda la historia por ese camino, mientras la misma clave
  funcionaba perfecto por otros lados.

· **Y el mensaje afirmaba cosas que nadie había comprobado.** Decía «las 2 llegaron al tope
  de hoy» y «se reponen solas mañana». Lo primero no se sabía; lo segundo es falso cuando el
  límite es el del minuto, que se destraba en un rato. Ahora dice lo que sí se sabe: que
  rebotó por límite, que puede ser el del minuto o el del día, y qué hacer con cada uno.

### 7. Los leads de Instant Form: ya sabemos por qué no llegan, y NO es de MaKo

**Lo que reportaron:** los leads de las campañas de Clientes Potenciales de Meta —las que
corren sus clientes inmobiliarios— no aparecen en el CRM.

**La causa, medida contra la API de Meta:** la página de Facebook **no está suscrita a
ninguna aplicación**, así que Meta nunca avisa que hubo un lead nuevo. El lead no se pierde
en el camino: nunca sale de Meta.

El control no deja lugar a dudas: la página del cliente que sí recibe tiene su app suscrita
y lleva 1.031 leads por esa vía; la de ellos tiene cero, y nunca tuvo ninguno.

Y lo que **no** era, que también hacía falta descartarlo: no es permisos (el token puede leer
el lead de prueba), no es el ruteo, y no es que MaKo lo descarte.

⚠️ **Pero suscribir la página no alcanza**, y esto es lo que hay que hablar con ellos: su
conexión de Meta sale de una app propia de Joan, y MaKo sólo puede recibir avisos de la suya.
Es el MISMO motivo que les bloquea la publicación de anuncios. Las dos cosas se arreglan de
una: pasar su conexión a la app de MaKo.
## 🔴 Lo que está en curso — no contarlo todavía

| Qué | Estado |
|---|---|
| **Publicar anuncios desde MaKo** | Diagnosticado, despachado. La causa es la conexión de Meta: su token sale de una app de terceros («Joan P2P app») en modo desarrollo, y Meta no deja crear anuncios con eso. Hay que migrarlos a la app de MaKo. ⚠️ Además, cada intento fallido dejó **una campaña y un conjunto de anuncios vacíos en su cuenta de Meta — 14 veces**. Hay que limpiarlos y hay que hacer que no vuelva a pasar. |

---

## ❓ Lo que necesitamos DE ELLOS

Lo del aviso duplicado y lo de Gemini ya NO hace falta pedirlo: se resolvieron midiendo
contra la base y el código. Queda uno solo, y es una decisión más que un dato:

1. **Pasar su conexión de Meta a la app de MaKo.** Hoy usan una app propia («Joan P2P app»)
   y eso bloquea DOS cosas a la vez: los leads de Instant Form y la publicación de anuncios.
   Para eso hace falta saber qué páginas y qué cuentas publicitarias tienen que quedar
   conectadas — incluidas las de sus clientes inmobiliarios, que son quienes corren las
   campañas.
## 📋 Accionables acordados con ellos — pedido de Martín, 27/09/2026

Todavía sin fecha y sin tarjeta en el board. **Los 5 los benefician a ellos y al resto de
los clientes**, que es el criterio para que sean producto y no un parche para un cliente.

### 1. Integrar más grabadores de reuniones, no sólo Fathom

Hoy el lector de reuniones entra sólo por Fathom. Hay que sumar **Loom** e investigar qué
otros usa la gente (Fireflies, Otter, Grain, tl;dv, Zoom y Meet con su propia grabación).

**Lo que hay que decidir primero:** si cada uno entra con su integración propia o si alcanza
con una puerta que reciba **el archivo o el link** y de ahí salga lo mismo. La segunda
cubre a cualquier grabador, incluido el que todavía no existe.

### 2. Notificaciones editables

Que el cliente pueda cambiar **qué se le avisa, cada cuánto y qué lo dispara**, sin
pedírnoslo.

**El caso que lo pidió, textual de Martín:** *«ellos quieren que cuando un lead de sus
clientes entre al CRM, MaKo en WhatsApp le reviente a mensajes insistiendo que le LLAME»*.

⚠️ **Y esto se cruza con los «avisos duplicados» que ellos reportaron:** parte de lo que
hoy se siente como un defecto es que nadie puede tocar la frecuencia. Conviene mirarlos
juntos.

⚠️ **Lo que hay que cuidar:** «reventar a mensajes» es una configuración que puede quemar
la línea de WhatsApp de un cliente. Necesita un techo que el producto imponga, no una
confianza en que nadie va a poner 50.

### 3. Ads Manager: publicar, y después configurar de verdad

Dos etapas, en orden:

- **Que se pueda publicar** (ver «Lo que está en curso»).
- **Y después, la configuración fina de la campaña.** Los inmobiliarios necesitan más
  personalización que la que hay: el ejemplo que dio Martín es **elegir los códigos
  postales** donde corre el anuncio.

⚠️ Buena noticia medida: el buscador de lugares de Meta que ya usamos acepta país,
provincia, ciudad, **código postal**, barrio, partido y dirección. Lo que falta es la
pantalla que lo ofrezca, no la capacidad.

### 4. Onboarding del CRM: configurar el funnel la primera vez que se entra

Hoy el funnel viene con etapas armadas y no todos los negocios se parecen. En el caso de
ellos **puede que no tengan «R1 ni R2»: tienen VISITAS, y antes una llamada.**

Que al entrar por primera vez al CRM se pregunte y se arme el funnel a medida: **si vende
presencial, si vende por llamada, si vende sólo por WhatsApp, si es carrito.**

Palabras de Martín: *«todos estos cambios también les benefician al resto de usuarios»*.

### 5. Onboarding y configuración para INMOBILIARIAS

Dos cosas distintas que conviene no mezclar:

- **Sacar del onboarding principal lo que a un inmobiliario no le sirve** — el ejemplo que
  dio Martín: **no tienen closer**. Preguntar por un rol que no existe es fricción que
  además enseña que el producto no es para ellos.
- **Y un onboarding propio del nicho**, que sirve para ellos y para los próximos clientes
  inmobiliarios.

⚠️ Esto y el punto 4 son el mismo trabajo visto desde dos lados (el funnel y las preguntas
del alta). Conviene diseñarlos juntos aunque salgan en dos tandas.
