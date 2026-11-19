# Inspiración: el link de Instagram que llega por WhatsApp se guarda y se ordena solo

Diseño mínimo del 19/11/2026 (cuenta claude5, chat `inspiracion`). El relevo de los 76 links con que Martín la estrenó está en
[relevo-19-11.md](relevo-19-11.md).

## Qué pidió Martín (textual, 19/11)

> «la diferencia entre Competitor Spy y esto… en Competitor Spy es para scrapear una cuenta entera, para trackear el funnel de
> tal persona, pero muchas veces yo lo único que me interesa de esa competencia es un reel en particular, o una cosa… lo quiero
> ir guardando y que se vaya organizando de manera automática… que sea simple… agarras, copias el link de compartir y se lo
> envías al chat de MaKo en WhatsApp… MaKo en WhatsApp automáticamente, cuando detecta que es un link de Instagram
> (normalmente no se le va a enviar un link de Instagram para otra cosa), lo guarda automáticamente en la competencia y lo
> ordena… Cuando no sabes dónde ponerlo, tenés que preguntar, no determinarlo automáticamente… dentro de copywriting, me
> imagino que queden en un apartado sin organizar. Un primer filtro que sea literalmente lo que tenemos en la etiquetera de
> SuperAdmin, como un scroll tipo Tinder: si sospechas que debería ir en tal carpeta pero no estás 100 % seguro, lo preguntas:
> "Este reel que me pasaste de inspiración, ¿es de tal serie de contenido?", sí o no. La idea es que le acierte. Si pone que
> no, la persona crea a mano una nueva carpeta, un nuevo tema, una nueva serie de contenido».

## El recorrido, en una línea

WhatsApp → se detecta el link → se guarda al toque → MaKo lo lee (Apify) y lo clasifica (IA, con MaKo Tokens) → si está
segura, a su carpeta; si duda, a la bandeja de Copywriting → la persona contesta de a una tarjeta: Sí / No / Nueva carpeta.

## 1. La entrada: dónde se engancha

- **En `procesarDoer` (`lib/mako-doer-in.ts`), apenas el texto y los adjuntos están resueltos (≈ línea 2090) y ANTES de la
  memoria y de `clasificarConIA` (≈ 2198).** Así cubre los tres caminos que terminan ahí (el grupo de WhatsApp, el chat 1 a 1
  con la línea del bot y el grupo dentro de la app), no se paga el clasificador del turno y no cae en la regla 6 de
  `lib/mako-intencion.ts` (≈ 1398), que hoy manda un link pelado al Plan como borrador de tarea.
- **Se corta ahí sólo si se cumplen las tres:**
  1. el negocio tiene la función prendida (`veInspiracion(ws)`, ver §7);
  2. escribe quien administra el negocio: `!hayInvitado` (ni un invitado ni alguien del equipo);
  3. el mensaje trae al menos un link de Instagram y **no pide nada con él**.
- **«No pide nada»:** lo que queda del texto sin los links está vacío, es un comentario («mirá este», «buenísimo», «para la
  serie de ventas») o nombra una carpeta. Si trae un pedido («replicá este reel», «hacé un carrusel como este», «transcribime
  esto», «¿qué opinás?»), sigue el turno de siempre, que ya sabe replicar (`replicar_link_o_texto_copywriter`). La lista de
  verbos es corta, pura y con test (`lib/inspiracion/links.ts`).
- **Detectar el link:** `lib/carruseles/link.ts` ya tiene `linkDeInstagram`, pero su regex arranca con `^` (sólo ve el link si
  el mensaje EMPIEZA con él) y devuelve uno. Hace falta `linksDeInstagram(texto)`: todos los links del texto, sin el ancla,
  sin repetidos, con su `ref` (shortcode) y su tipo por la dirección (`/reel/`, `/tv/` = video; `/p/` = a leer; perfil =
  cuenta). Un lote de varios mensajes (la ventana de silencio de `encolar`) llega como un texto: se guardan todos y se contesta
  una vez.
- **Una cuenta entera** (`instagram.com/usuario`) también se guarda, como tipo `cuenta`, sin leerla: seguirla entera es
  Competitor Spy. Va derecho a la bandeja.

## 2. Lo que se guarda (migración 0422)

Dos tablas por negocio, con RLS prendido sin políticas y `revoke` a `anon`/`authenticated` (como la 0359); el aislamiento lo
hace `getTenantDb()`. Se registran en `TENANT_TABLES` (`lib/workspace.ts`) y en `lib/tablas-de-inquilino.ts`.

**`inspiracion_carpetas`** — las carpetas del negocio (sus series de contenido).
| columna | qué es |
|---|---|
| `id`, `workspace_id` | |
| `nombre` | «Serie 3: ventas», «Carruseles de ventas»… |
| `descripcion` | una línea de qué va ahí: es lo que lee el clasificador |
| `orden`, `creada_por` (`persona` / `mako`), `creada_en` | |

**`inspiracion_piezas`** — cada link guardado. Único por `(workspace_id, ref)`: mandar el mismo link dos veces contesta «ya la
tenías en X».
| columna | qué es |
|---|---|
| `id`, `workspace_id`, `ref` (shortcode o usuario), `url` | |
| `tipo_link` | `reel` / `post` / `cuenta` |
| `cuenta`, `pie`, `miniatura_url`, `metricas` (jsonb) | lo que devuelve Apify |
| `lectura` (jsonb) | lo que dijo la IA: formato (carrusel, reel animado, avatar de IA, persona a cámara, otro), de qué trata, gancho, estructura, CTA |
| `carpeta_id` | null mientras no esté ordenada |
| `sugerida_id`, `confianza` (0-100), `por_que` | la sospecha de MaKo |
| `estado` | `leyendo` → `ordenada` / `por_revisar` (la bandeja) / `sin_leer` (falló la lectura o no había saldo) |
| `nota` | lo que escribió la persona junto al link |
| `origen` (`whatsapp` / `app`), `mensaje_id`, `creada_en`, `revisada_en` | `revisada_en` = la persona la confirmó (como en `carruseles_biblioteca_piezas`, 0411) |

## 3. La lectura

- **Apify, un solo post:** el molde de «Traer tu outlier» (`traerCarrusel`, `lib/carruseles/traer-servidor.ts`):
  `entradaDeUnaPublicacion` + `piezasDeApify` dan cuenta, tipo, pie, miniatura y métricas. Con la clave de Spy del negocio
  y, si no tiene, la de la plataforma, con tope por día (como `TRAIDOS_POR_DIA`).
- **Transcripción, sólo si hace falta (PENDIENTE: la primera versión lee sólo el pie):** si es un video y el pie dice poco (menos de ~150 caracteres), se transcribe el primer
  minuto (`videoDeUnaPublicacion` + `transcribirAudio`). Un reel con el guion en el pie no paga transcripción.
- **Si Instagram no deja leerlo** (19/11/2026: la única clave de Apify, la de la plataforma, daba 401): la pieza ya quedó guardada
  (se inserta ANTES de leer), se ordena igual con lo que hay —la nota del dueño y la cuenta— y la respuesta dice «Todavía no pude
  leer el post en Instagram: lo completo apenas pueda». Queda `leida_en` null; cuando una lectura vuelve a andar (otro link que
  sí se lee), se releen hasta 3 de las pendientes (`releerPendientes`). Nunca un «no pude guardar» por Apify. Una lectura que
  falla no se cobra.
- **Cuándo:** en el mismo turno, después del 👍 que ya pone la entrada. La lectura tarda 20-40 s. Hasta 5 links por mensaje se
  leen en el momento; el resto queda `sin_leer` en la bandeja. Si Apify o la IA fallan, la pieza va a la bandeja sin sugerencia.
  (PENDIENTE: un cron que relea las `sin_leer`, `app/api/cron/inspiracion/route.ts`, con la skill `add-cron-job`.)

## 4. La clasificación

- `chatCheapCascade({ feature: 'inspiracion-clasificar', json: true })` (`lib/ai-cheap.ts`): el cobro lo pone solo
  `conMedidorDeMt`.
- **Entra:** la cuenta, el tipo, el pie (hasta ~1.500 caracteres), la transcripción si hubo, la nota de la persona y las
  carpetas del negocio, cada una con su descripción y hasta 3 piezas que la persona YA confirmó ahí (cuenta + de qué trata).
  Con lo confirmado aprende qué quiere decir cada carpeta para ESE negocio.
- **Sale:** `{ carpeta_id | null, confianza, por_que, carpeta_nueva?, lectura }`.
- **La regla (pura, con test, `lib/inspiracion/reglas.ts`):** va sola a su carpeta sólo si la confianza es ≥ 90 **y** la
  carpeta ya tiene 3 piezas confirmadas por la persona. Todo lo demás va a la bandeja con la pregunta. Al principio pregunta
  todo; a medida que la persona contesta, pregunta menos. Martín: «no determinarlo automáticamente… La idea es que le acierte».
- **Un negocio sin carpetas:** la IA propone el nombre de una carpeta nueva («Historias A/B») y la tarjeta pregunta
  «¿Creo la carpeta «Historias A/B» para esta?».
- **Sin saldo** (`esSinSaldoDeMt`): se guarda igual, `sin_leer`, y va a la bandeja sin sugerencia. Nunca se pierde un link.

## 5. La respuesta por WhatsApp

Fija, la arma el código (el molde de la rama del ticket, ≈ 2251-2269: `enviarAGrupoJid`, `registrarEnviado`, `guardarTurno`,
`return { engaged: true }`):
- uno, seguro: «Guardado en Inspiración › Serie 3: ventas.»
- uno, dudoso: «Guardado. No estoy seguro de en qué carpeta va: te lo dejé en Copywriting › Inspiración para que me digas.
  <link>»
- varios: «Guardé 4: 2 en Carruseles de ventas, 1 en Serie 1 y 1 para que me digas dónde va. <link>»
- repetido: «Ese ya lo tenías guardado en Serie 1.»

(La pregunta Sí/No por WhatsApp queda para después: necesita recordar qué tarjeta se está contestando.)

## 6. La bandeja, dentro de Copywriting

- **Dónde:** una vista nueva `/copywriter?ver=inspiracion` (`app/copywriter/vista.ts`) y, en la portada (`OutliersCopy.tsx`,
  junto a «Pegar link o texto»), el botón «Inspiración» con el número de las que esperan respuesta.
- **Arriba, «Sin organizar (N)»: el mazo de a una tarjeta**, con el molde Sí/No de la Ticketera
  (`app/tickets/decisiones/Mazo.tsx` + `reglas.ts`, `veredictoGesto`): el gesto lo hace `motion`, cada gesto tiene su botón y
  su tecla, y «Volver» deshace de verdad.
  - La tarjeta: miniatura, cuenta, formato, de qué trata, gancho y la pregunta grande: **«¿Va en Serie 3: ventas?»**
  - **Sí** (derecha / →): queda en esa carpeta, `revisada_en` = ahora.
  - **No** (izquierda / ←): la misma tarjeta pregunta «¿Dónde va?» con las carpetas que hay y **«Nueva carpeta»** (nombre y
    una línea de qué va ahí, que es lo que después lee el clasificador).
  - Sin sugerencia: pregunta «¿Dónde va?» directo.
- **Abajo, «Carpetas»:** cada carpeta con sus piezas (miniatura → abre el post en Instagram), mover de carpeta y borrar.
- **Teléfono:** la misma vista en `app/m/copywriter`; el mazo ya está pensado para el dedo.
- Acciones del servidor con `getTenantDb`, como `app/tickets/bandeja/acciones.ts`. Si MaKo tiene que poder leerla o moverla,
  se declara en `lib/api-mako/areas/copywriter.def.ts`.

## 7. El interruptor

`lib/inspiracion/revision.ts`, con el molde de `lib/onboarding-v2/revision.ts`: `PARA_TODOS = false`, los emails de la
revisión de Martín y `WS_REVISION = [3, 9]` (las cuentas de prueba; **nunca el ws 1, que es un cliente**). En el doer no hay
email: la puerta es por `ws`. La pantalla pregunta del lado del servidor (email o ws). Prenderlo para todos es un cambio:
`PARA_TODOS = true`.

## 8. MaKo Tokens

Todo gasta MaKo Tokens. Dos features nuevas, cada una con su fila en `COSTOS` (`lib/mako-tokens-costos.ts`) y en
`CATALOGO_MODELOS` (`lib/model-catalogo.ts`); el test `tests/mako-tokens-costos.test.ts` exige que ninguna quede sin costo:
- `inspiracion-leer`: la lectura de Apify (unos US$0,0025 por post) y la transcripción cuando hace falta;
- `inspiracion-clasificar`: la llamada de la IA.

## 9. Pruebas

- `tests/inspiracion-links.test.ts`: los links dentro de un texto (con y sin ancla, reel/p/tv/perfil, repetidos), y
  «comparte» contra «pide algo».
- `tests/inspiracion-reglas.test.ts`: la regla de la carpeta (confianza, piezas confirmadas, sin carpetas, sin saldo).
- El turno real, como pide AGENTS.md §8, con el molde de `tests/agenda-whatsapp.test.ts`.
- En producción: la cuenta de prueba (ws 3 o ws 9). Sale con el deploy diario.

## 10. Cómo quedó construido (19/11/2026)

- `lib/inspiracion/links.ts` (qué links trae un mensaje y si pide algo), `reglas.ts` (sola o a la bandeja), `clasificar.ts` (el
  pedido a la IA, su lectura y la respuesta por WhatsApp), `revision.ts` (el interruptor) y `servidor.ts` (guardar, leer con
  Apify, ordenar y la bandeja). Tests: `tests/inspiracion-*.test.ts`.
- El corte en `lib/mako-doer-in.ts` (buscar «INSPIRACIÓN»), la migración `supabase/migrations/0422_inspiracion.sql`, las dos
  tarifas, la entrada del catálogo y los dos textos editables (/configuraciones › «Inspiración»).
- La pantalla: `app/copywriter/inspiracion/` (`Inspiracion.tsx`, `acciones.ts`), `/copywriter?ver=inspiracion` y
  `/m/copywriter?ver=inspiracion`, y el botón «Inspiración (N)» en la portada de outliers.

## 11. Lo que NO entra en esta versión

- Contestar Sí/No por WhatsApp.
- Leer una cuenta entera (eso es Spy) o TikTok y YouTube.
- Mover de carpeta desde WhatsApp.
- La transcripción del reel cuando el pie dice poco, y el cron que relee lo que quedó sin leer (ver §3).
