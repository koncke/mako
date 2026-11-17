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
| Higgsfield | Kling 3.0 720p con audio (20 cr por 10 s, botón Generate) | Ultra 3K | 129 | 25 | 5,16 | higgsfield.ai/ai/video |
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

## Higgsfield, medido con el botón Generate (17/11, corrida `wf_1d9bf4cd-78d`)

**Los tres números de la tabla de precios eran el mismo Kling 3.0, leído de tres maneras.** Los tres son clips de 5 s,
y ninguno es el de una persona que habla:
- el «~8» de la lista es 1080p sin audio, redondeado;
- el 8,75 es el mismo número sin redondear: la tabla anual cuenta videos POR AÑO;
- el «~14» del configurador es una cifra fija que no cambia con las opciones.

El costo real lo muestra el botón **Generate** de higgsfield.ai/ai/video, y se ve sin cuenta. La ayuda de Higgsfield dice que
ese es el que se descuenta. Clip de 10 s, 9:16, 720p:

| Modelo | Créditos | Minutos con Ultra 3K (US$129, 3.000 cr) | US$ por minuto (mensual) | US$ por minuto (anual de Black Friday, US$50 por mes) |
|---|---:|---:|---:|---:|
| **Gemini Omni Flash 1.2 (el Omni de Flow)** | 22,5 | 22,2 | 5,81 | 2,25 |
| Kling 3.0 con audio | 20 | 25 | 5,16 | 2,00 |
| Kling 3.0 Omni con sonido (el Kling O3, el mismo `kling-v3-omni` que tenía el código) | 12,5 | 40 | 3,23 | 1,25 |
| Kling 4.0 | 22,5 | 22,2 | 5,81 | — |

- **Kling 3.0 cobra por segundo:** 2 cr/s con audio a 720p y 2,5 a 1080p.
- **El Omni 1.2 no tiene interruptor de audio.** Si sale con voz y labios, sólo se sabe generando.
- **Lo «ilimitado» no incluye video** en los planes individuales. En los de empresa dura 7 días, es sólo en la web y prohíbe
  automatizar y revender.

## El mismo Omni 1.2 en otros proveedores (clip de 10 s, 720p, con audio)

| Proveedor | US$ por clip | US$ por minuto |
|---|---:|---:|
| **ApiMart `gemini-omni-1.2-flash-ext`** | **0,24** | **1,44** |
| Kie.ai | 0,45 | 2,70 |
| ApiMart `gemini-omni-1.2-flash` (canal normal) | ~0,56 | ~3,34 |
| Google directo (AI Studio, Vertex) | 0,70 | 4,18 |
| OpenRouter, AI/ML API, Runware, WaveSpeed | ~0,70 | ~4,2 |
| Segmind, sin la promo | 0,74 | 4,42 |
| Atlas Cloud | 0,75 | 4,48 |
| fal.ai | 0,82 | 4,91 |
| Replicate | 1,05 | 6,30 |

Leonardo sólo tiene la 1.1, y PiAPI no tiene ninguna versión. El clip del 8/11 («Omni-Flash-Ext», US$0,40) era la 1.1.

## Vheer (vheer.com): «gratis», pero no para lo que hace MaKo (leído el 17/11/2026)

Martín lo pidió por voz como «bheer.com». No hay nada con ese nombre: es **Vheer**, operado por «Sparklightforce», sin país
declarado (vheer.com/terms).

- **Lo gratis:** 50 créditos por mes, «basic image generation», sin marca de agua. Las imágenes del modelo «Quality» del plan
  gratis son sólo para uso personal (términos, 11.2).
- **El video gratis:** el modelo propio «Vheer Quality», 5 s a 768p, sin voz ni labios a la vista. Los modelos premium
  (Seedance 1.5 Pro, Hailuo 2.3, LTX 2.3, Sora 2 y Veo 3.1) gastan créditos, y cuántos no se ve sin cuenta. **No tiene Omni.**
- **Planes:**
  - Premium, US$9,99 por 1.000 créditos;
  - Business, US$19,99 por 2.000;
  - Ultra, US$49,99 por 5.000;
  - paquetes sueltos de US$3,99 a 69,99.

  Se cobra por PayPro (vheer.com/pricing).
- **Para integrarlo:** no tiene API, y los términos prohíben bots y automatizar («automated tools… bots, crawlers»).
- **Lo que se sube:** se borra cada 6 h, y dicen que no entrenan con eso.
- **Conclusión:** sirve, como mucho, para que Martín haga a mano imágenes o b-roll mudo de 5 s, con el plan pago si va a anuncios.
  No sirve para el video con una persona que habla, y no se puede enchufar a MaKo.

## Trampas al leer estas páginas

- **HeyGen «30 min» no es lo que da por mes:** es el largo máximo de cada video. El chat del 16/11 lo leyó al revés.
- **(Resuelto abajo, en «Higgsfield, medido con el botón Generate».)** Higgsfield publica tres costos para Kling 3.0 en la misma página: ~8 cr por 5 s en la lista, 8,75 en la tabla
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
