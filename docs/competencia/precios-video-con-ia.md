# Cuánto cobran y cuánto dan: video con IA y avatares (leído el 17/11/2026)

Lo pidió Martín el 17/11, para saber cuánto cobrar por «30 días de contenido». Antes no había en el repo una
comparación de **cuánto video da** cada uno. Lo que había era:

- el precio de entrada y un sí/no por función en `app/vsl/_sitio/competencia-datos.ts`;
- créditos sin minutos en `docs/como-venden-otros.md:566-575`;
- las cifras del chat de MaKo Tokens del 16/11, sacadas de reseñas.

Este documento lo reemplaza. Lo armó la corrida `wf_42fb8b45-5da`, con dos agentes que leyeron las páginas oficiales y un
refutador que las volvió a abrir. **Los precios se mueven:** antes de citarlos, volver a abrir la fuente.

**Cómo se leen los minutos:** son cálculo propio, créditos del plan ÷ costo del clip × duración, con clips enteros, sin
rehechos y sin promociones. La referencia es lo que pide un mes de MaKo: **30 reels con 30 s generados, y la mitad de los
clips rehecha una vez**. Eso es 135 clips de 10 s, o 22,5 minutos generados para 15 publicados.

## Video generativo: el modelo arma la escena, con voz (lo mismo que hace MaKo)

| Herramienta | Modelo | Plan | Precio por mes | Minutos por mes | US$ por minuto | Fuente |
|---|---|---|---:|---:|---:|---|
| Google Flow | Omni Flash 1.2 a 720p (3 cr/s hasta 10 s) | AI Ultra | 99,99 | 55,6 | 1,80 | support.google.com/flow/answer/16526234 |
| Google Flow | el mismo | AI Pro (con los 50 cr diarios) | 19,99 | ~13,9 | 1,44 | la misma |
| Higgsfield | Kling 3.0 1080p | Ultra 3K | 129 | 17,9 a 28,6 | 4,52 a 7,22 | higgsfield.ai/pricing |
| Higgsfield | Kling 4.0 1080p | Ultra 3K | 129 | 15,4 | 8,39 | la misma |
| Higgsfield | Kling 4.0 1080p | Ultra 6K | 250 | 30,8 | 8,13 | la misma |
| Kling (oficial) | Kling 3.0 con audio (12 cr/s) | Premier 18K | 181,99 | 25 | 7,28 | kling.ai/app/membership/membership-plan |
| Hailuo | H3 | Max (mensual) | 216 | 37,5 | 5,76 | hailuoai.video/subscribe |
| Runway | Kling O3 Pro (85 cr cada 5 s) | Max | 95 | 9,3 | 10,20 (8,16 en anual) | runway.com/pricing |
| Runway | Gen-4.5 | Max | 95 | ~13,2 | 7,20 | la misma |
| Dreamina | Seedance 2.0 Fast, sin la promo | Advanced | 159 | 20,9 | 7,61 | dreamina.capcut.com (panel Upgrade) |
| Luma | Ray3.2 a 720p | Pro | 90 | 33 | 2,70 | lumalabs.ai/pricing |
| Pika | Kling 4.0 | Fancy (desde) | 95 | 6 | 15,73 | pika.art/pricing |
| invideo | Seedance 2.5 1080p | Ultra | 80 | 2,6 | 30,72 | invideo.io/pricing |

**MaKo, para comparar:**
- Costo propio del clip de 10 s por ApiMart:
  - Omni Flash de Google («Omni-Flash-Ext», vertical, con voz y labios): **US$0,40**, medido el 8/11;
  - kling-v3-omni: **US$0,896**, el que tiene hoy el código, y entrega 16:9.
- El minuto suelto se vende hoy a US$21,60.

## Avatar: anima una foto o un gemelo sobre un audio (otro producto, y más barato)

| Herramienta | Plan | Precio por mes | Qué da | Fuente |
|---|---|---:|---|---|
| HeyGen | Creator | 29 | Entre 12,5 y 85 min, según el motor. Con el que vende hoy (Avatar 6) no se sabe | heygen.com/pricing; help.heygen.com/en/articles/15126059 |
| HeyGen | Business | 149 | Hasta ~94 min con Avatar IV foto | las mismas |
| Creatify | Ultra | 95 | 36,5 min | creatify.ai/pricing |
| Synthesia | Pro | 89 | Hasta 60 min. Menos con el avatar en pantalla todo el tiempo, sin decir cuánto | synthesia.io/pricing |
| Captions (Mirage) | Frontier | 69,99 | US$8 a 24 por minuto: la ayuda publica dos tarifas | captions.ai/help/docs/ai-usage.md y …/mirage-credits.md |
| Argil | Pro | 149 | ~33 min, con la tarifa de pago por uso | docs.argil.ai |
| Arcads | Creator / Pro | 220 / ~550 | 20 videos / unos 60. **De terceros** | layer3labs.io/guides/arcads-pricing |
| D-ID, Hedra, MakeUGC | — | — | No se puede saber: sin fuente oficial de minutos | — |

**Armarlo afuera:** el video (Google AI Ultra, Higgsfield Ultra 3K o Kling 18K) más edición y subtítulos (CapCut Pro US$17,99
o Submagic Pro US$39) suma entre US$118 y US$221 por mes. No trae guiones automáticos ni CRM.

## Trampas al leer estas páginas

- **HeyGen «30 min» no es lo que da por mes:** es el largo máximo de cada video. El chat del 16/11 lo leyó al revés.
- **Higgsfield publica tres costos para Kling 3.0 en la misma página:** ~8 cr por 5 s en la lista, 8,75 en la tabla
  anual y ~14 en el configurador. No dice si trae audio. Por eso va un rango y no un número.
- **Higgsfield no tiene plan de US$59:** Plus cuesta US$49. Team muestra 5 asientos, pero dice «2 to 9 members».
- **Dreamina muestra los segundos con el descuento de Black Friday aplicado,** incluido el -43 % de Seedance 2.0 Fast.
  Sin la promo, Advanced da 20,9 min y no 36,7.
- **Hailuo sí tiene vista mensual:** se entra desde «From $9.99/mo» del encabezado; la pestaña Monthly de la página manda
  al inicio. Los tachados (14,99 / 54,99 / 119,99) no son el precio.
- **Comparar contra el mismo modelo, con audio.** MaKo hace una cara que habla. Seedance Mini, Ray a 720p o Kling sin audio
  salen más baratos porque son otro producto. Con el mismo modelo, Runway sale más barato que el paquete de MaKo.
- **PixVerse Premium muestra H3 y Wan 3.0 «100% OFF».** Es una promo con condiciones que no publica, no «ilimitado».
- **Google:**
  - los precios de gemini.google se leyeron con Argentina elegida, y en otro país pueden cambiar;
  - Veo 3.1 Quality y Fast se retiran el 5/12/2026;
  - Flow puede generar 2 videos por pedido y cobra cada uno.
- **CapCut se contradice:** la misma página da 19,2 y 5,1 cr/s para el mismo modelo. Avisa que el precio mostrado es «for
  reference only».
- **Synthesia** dice «about 100 credits» por minuto, «more if the avatar is on screen throughout». Ese es justamente el
  caso de un reel con la cara.

Lo que esto cambió en el precio de MaKo está en [../hallazgos-mako-tokens.md](../hallazgos-mako-tokens.md), en «El precio de
30 días de contenido lo decide el modelo, no el margen».
