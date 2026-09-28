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

### 3. Lo del formulario: su landing no tiene formulario

**Lo que se habló (22/09):** *«probaste el tema del formulario y no anda, ¿no?»*.

**Qué encontramos:** se revisó su página entera y **no hay ningún formulario propio**. Lo
único que capta datos es la agenda de Cal.com embebida, y eso **sí funciona**: sus 19 leads
de landing entraron los 19 por la agenda, uno de ellos registrado 1,4 segundos después de
la reserva.

O sea que no hay nada roto: no hay formulario que pueda fallar.

⚠️ **Y algo que conviene avisarles antes de que pase:** su funnel está configurado sin
«entradas» declaradas. Hoy los leads pasan por una excepción que tiene la agenda. **El día
que pongan un formulario de verdad, no va a entrar** hasta que declaren la landing como
entrada de leads. Son dos minutos de configuración y es mejor hacerlo antes.

### 4. Cómo activar el aviso de lead cualificado a Meta

Ya estaba, y quedó contestado en el audio del 24/09: se entra al CRM y se marca el lead
como **cualificado**. Con eso se dispara solo.

---

## 🔴 Lo que está en curso — no contarlo todavía

| Qué | Estado |
|---|---|
| **Publicar anuncios desde MaKo** | Diagnosticado, despachado. La causa es la conexión de Meta: su token sale de una app de terceros («Joan P2P app») en modo desarrollo, y Meta no deja crear anuncios con eso. Hay que migrarlos a la app de MaKo. ⚠️ Además, cada intento fallido dejó **una campaña y un conjunto de anuncios vacíos en su cuenta de Meta — 14 veces**. Hay que limpiarlos y hay que hacer que no vuelva a pasar. |

---

## ❓ Lo que necesitamos DE ELLOS para poder avanzar

Sin esto no se puede reproducir, y sin reproducir no se arregla.

1. **Avisos duplicados** (lo reportó Joan el 21/09) — **cuál** aviso y una captura. Los
   avisos salen al grupo de WhatsApp y los mensajes de grupo no se guardaban, así que no
   queda rastro medible de ninguno.
2. **«Gemini se queda sin tokens muy rápido»** — el mensaje de error que ven en pantalla.
   Los datos lo contradicen: su workspace usó entre 24 y 29 pedidos por cuenta **en 30
   días**, contra un tope de 250 por día. Los dos defectos de cuota que había ya están
   arreglados, así que lo que ven tiene que ser otra cosa.
3. **El link del formulario**, si es que existe en alguna versión de la página. Martín se
   lo pidió a Joan el 22/09 y no llegó.

---

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
