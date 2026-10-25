# El recolector del Second Brain — diseño

> **Pedido de Martín, 24/10/2026 ~03:00 ART, textual:** «Quiero que implementes en el Second Brain un
> "recolector de información" de TODOS lados... Quiero data de todo en el Second Brain... De las llamadas que
> ya tenemos la transcripción de Fathom, de la data de métricas de Meta... De los mensajes de WhatsApp, de
> absolutamente todo. Porque eso sí será un "Second Brain". **Esto para todos los ws**».

**Estado (25/10/2026):** el primer paso (§8, WhatsApp) está hecho: lib/recolector.ts, el cron
`second-brain-recolector` (cada hora), la migración 0333 y «Aprende solo» en el Mapa del Second Brain. Lo que se aprendió al
hacerlo, en docs/hallazgos-second-brain.md («El recolector»). Meta y Fathom siguen sin hacer.

**Estado original:** diseño, sin dueño asignado todavía. Lo escribió el Cerebro la noche del 23 al 24/10 para que el
pedido no se pierda mientras el lanzamiento del 25 ocupa a todos los chats. **No empezar a construir sin
leer la sección «Lo que puede salir muy mal».**

---

## 1. Qué es, en una frase

Hoy el Second Brain de cada negocio sabe lo que alguien le cargó. El recolector hace que sepa **lo que el
negocio ya vivió**: sus llamadas, sus conversaciones, sus números de pauta — sin que nadie los copie a mano.

## 2. Lo que ya existe (medido el 24/10 contra `origin/main`, 264cfabf1)

| Pieza | Dónde |
|---|---|
| Hub de áreas, buscador, chat, exportar, mapa | `app/second-brain/` |
| Versión de teléfono completa | `app/m/second-brain/` |
| API: buscar, cerebro, exportar | `app/api/second-brain/` |
| El núcleo | `lib/second-brain-opera.ts`, `lib/conocimiento-ajustes*.ts` |
| Diseño previo | `docs/diseno-second-brain-centro.md`, `docs/diseno-second-brain-grafo.md` |
| Hallazgos | `docs/hallazgos-second-brain.md`, `docs/hallazgos-conocimiento.md` |

**Lo que NO existe:** ninguna entrada automática de datos. `fathom` aparece sólo en bitácoras, nunca en
código que funcione. Todo lo que hay adentro entró porque alguien lo puso.

## 3. Las fuentes, en orden de lo que rinde por lo que cuesta

El orden importa: **no se construyen las cuatro a la vez**. Cada una se termina y se mide antes de la
siguiente, porque cada una trae su propia forma de romperse.

1. **WhatsApp** — ya es nuestro. Las conversaciones están en la base del negocio (`mako_doer_conv`,
   `evolution_*`). Es la fuente más rica y la única que no depende de nadie de afuera. Empezar acá.
2. **Métricas de Meta** — ya tenemos el token de cada negocio y el Ads Manager anda. Es traer lo que ya
   sabemos leer y guardarlo como conocimiento, no como tablero.
3. **Llamadas de Fathom** — la más valiosa por contenido (una llamada dice más que cien mensajes) y la más
   cara: hay que resolver de quién es cada cuenta de Fathom. **Ver la trampa en §5.**
4. **El resto** — correo, landings, cursos, tickets. Sólo después de que las tres primeras estén vivas.

## 4. La regla que decide todo: de quién es cada dato

Martín dijo «esto para todos los ws». Eso **no** significa un Second Brain con los datos de todos: significa
que **cada negocio tenga el suyo, lleno con lo suyo**.

- **Un dato recolectado pertenece al workspace del que salió, y no sale de ahí jamás.** Ni para "mejorar el
  modelo", ni para una métrica agregada, ni para que el super admin lo lea de pasada.
- El super admin ve **que** un negocio tiene conocimiento recolectado, no **qué** dice.
- Todo lo que entre lleva su origen y su fecha. Un dato sin procedencia no se guarda: cuando el chat del
  Second Brain lo cite, tiene que poder decir de dónde salió.
- **Nada de esto se le muestra al cliente final de ese negocio.** Es el cerebro del dueño, no del lead.

Esto no es un apartado de compliance: es el eje del diseño. Si una pieza no puede respetarlo, esa pieza no
se construye.

## 5. Lo que puede salir muy mal

- **Fathom, el dueño de la cuenta.** Hoy las transcripciones que ve el Cerebro salen del conector de la
  cuenta de Claude de Martín, no de una integración del producto. Si se cablea así, **el Second Brain de un
  cliente terminaría leyendo las llamadas de Martín, o peor, las de otro cliente**. Cada negocio tiene que
  conectar SU Fathom con SU clave (como ya se hace con Meta y con la IA: cada negocio trae la suya). Hasta
  que eso exista, Fathom no se toca.
- **«Absolutamente todo» es una trampa de volumen.** Un negocio con dos años de WhatsApp son cientos de
  miles de mensajes. Traerlos todos no hace un cerebro: hace un depósito donde no se encuentra nada, y una
  factura de IA. El recolector **resume y extrae**, no copia. Lo que entra al Second Brain es lo que un
  humano llamaría un hecho, no el renglón crudo.
- **La IA la paga el negocio.** Resumir conversaciones cuesta tokens. Rige la regla del 22/10: cada negocio
  paga SU IA, y el Plan nunca paga IA. Si un negocio no tiene clave, su recolector no corre — no corre con
  la nuestra.
- **Nunca escribir hacia afuera.** El recolector LEE. No manda un mensaje, no contesta, no marca como leído,
  no toca un anuncio. Es la misma regla del vigía de grupos, y por los mismos motivos.
- **Que no se vuelva a inventar lo que falta.** Si de una llamada no se pudo sacar nada, el Second Brain
  dice que no hay, no dibuja un resumen vacío ni, peor, uno plausible.

## 6. Cómo se dispara

Como el vigía de grupos después de la cosecha del 24/10: **un cron del servidor** (`app/api/cron/…` con su
entrada en `vercel.json`), nunca un proceso atado a una sesión. La regla quedó escrita esa misma noche en
AGENTS.md: *si «¿quién lo dispara?» se contesta «un chat», no es un guardia*.

- Cada negocio con su propio reloj y su propia marca de hasta dónde leyó.
- Si no pudo leer, **la marca no avanza**: «no pude leer» no es «no había nada».
- Lo que recolecta entra con su origen; si un paso falla, se reintenta sin duplicar.

## 7. Qué ve Martín

Una pantalla del Second Brain que diga, por negocio: **de qué fuentes está tomando datos, cuándo fue la
última vez, y cuánto entró**. Sin eso, el recolector es una caja negra que nadie sabe si está viva — que es
exactamente lo que pasó con el vigía de grupos, apagado tres días sin que nadie se enterara hasta que él vio
los errores a mano.

## 8. El primer paso concreto

**Una fuente, un negocio, de punta a punta: WhatsApp en el espacio de MaKo.** Que el chat del Second Brain
pueda contestar algo que sólo sabría leyendo las conversaciones, citando de dónde lo sacó. Si eso funciona y
rinde, las otras tres fuentes son el mismo molde. Si no rinde, mejor saberlo con una que con cuatro.

---

**Relacionado:** `docs/diseno-second-brain-centro.md` · `docs/hallazgos-second-brain.md` ·
`docs/hallazgos-infra.md` (el vigía atado a una sesión) · `docs/hallazgos-ia.md` (cada negocio paga su IA).
