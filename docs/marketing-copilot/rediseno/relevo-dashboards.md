# Relevo — las hojas de «Métricas» del Piloto automático: ¿sirven para decidir?

12/11/2026 · rama `punta/marketing-copilot-agente` · sólo se leyó código: nada se probó contra la base.

La pregunta de Martín: los gráficos que el paso 3 («Piloto automático» → «Métricas») muestra por área, ¿sirven para que el
piloto decida? ¿Cuáles sobran y cuáles faltan?

Lo que el piloto decide sale de `QUE_HAGO` en la maqueta (`docs/marketing-copilot/rediseno/maqueta-doce.html`; la fuente es
`bloque-doce.js:604-641` del scratchpad): oferta 605-609, web 610-615, anuncios 616-624, Instagram 625-633, YouTube 634-640.

## En cinco renglones

1. Las hojas contestan «¿cómo me fue?». El piloto pregunta «¿qué toco ahora, y cruzó el umbral?». Casi ninguna tarjeta dibuja un umbral.
2. **Anuncios** tiene la mitad de lo que necesita. **Instagram y YouTube casi nada**: sus hojas miden la pauta de Meta y el VSL, no tu cuenta ni tu canal.
3. **Web** no tiene la conversión: la hoja Landing no dice cuántos agendan.
4. Lo que más falta: la frecuencia de cada anuncio (bien medida), el costo contra **tu objetivo**, lo orgánico de Instagram (existe por Zernio y no llega al Dashboard) y los clics de la miniatura de YouTube (no existe).
5. Hay tarjetas que dicen otra cosa que su título (§0). Ésas se arreglan antes que sumar nada.

## 0. Cinco trampas que cruzan las hojas

1. **Tres «agendas» distintas en la hoja Marketing.** La frase y los números usan las agendas de **todo el CRM**, por la fecha de la reunión
   (`lib/graficos-datos.ts:209`, `:414`). La tabla por anuncio y el mosaico usan las que **reporta Meta** (`agendas_meta`,
   `lib/graficos-datos.ts:70`). «Qué red trae agendas» usa otra lectura de Meta, en vivo (`lib/graficos-audiencia.ts:37`). La frase dice
   «trajeron N agendas» y N incluye las orgánicas. El Media Buyer ya separa las dos (`agendasMeta` / `agendasCrm`, `lib/media-buyer/senales.ts:46`, `:69-70`).
2. **«Anuncio ganador» y «Hooks» sólo ven los anuncios con su guion analizado** (`script_analyses` con `status = 'analizada'`,
   `lib/graficos-datos-extra.ts:125-130`). Un anuncio que gana sin análisis no aparece. Ninguna tarjeta dice cuántos quedan afuera.
3. **El hook rate mezcla imágenes.** Es reproducciones de 3 s ÷ impresiones (`lib/graficos-fuentes-extra.ts:68`). Las filas de un anuncio
   de imagen entran con 0 reproducciones (`lib/graficos-datos-extra.ts:190-199`) y ninguna de las dos hojas filtra por tipo
   (`lib/graficos-plantillas-analysts.ts:154-158`, `:239-243`). «El gancho en el tiempo» dice «de los anuncios con video»
   (`app/dashboard/disenos/HojaAnuncio.tsx:573`) y no lo es: las imágenes bajan el promedio.
4. **Los umbrales del piloto no son los de MaKo.**
   - «Cambiar el hook si se va más del 60 % en 3 s» quiere decir hook rate < 40 %. El «buen gancho» de MaKo es 28 % (`lib/ads-analyst-patrones.ts:26`): la regla prendería en casi todos los anuncios, también en los buenos.
   - «Subir como mucho +25 % por vez»: el tope del Media Buyer es 20 % por día (`lib/media-buyer/tipos.ts:33`, `:62`).
   - «Desde frecuencia 4»: MaKo **promedia las frecuencias diarias** (`lib/ads-analyst.ts:642-643`, `:752`; `lib/media-buyer/senales.ts:78`). Eso no es la frecuencia del período (impresiones ÷ alcance), que es más alta. Hay que decir de qué ventana es el 4.
5. **Las dos hojas de guiones abren con el período «todo»** (`lib/graficos-plantillas-analysts.ts:155`, `:240`). El piloto decide con 7 a 30 días.

## Cómo leer las tablas

- **Dato:** Sí = se mide y llega a la tarjeta. Parcial = existe en otro lado, o mide otra cosa. No = no se mide.
- **Veredicto:** Queda / Cambia / Sale. «Sale» quiere decir que sale de «Métricas»; la grilla de la hoja la conserva.

## 1. Las hojas, tarjeta por tarjeta

### Anuncios → «Marketing» (`app/dashboard/disenos/HojaMarketing.tsx`, `lib/marketing-diseno.ts`, plantilla `lib/graficos-plantillas.ts:66-125`)

| Tarjeta | Qué contesta | Decisión que alimenta | Dato | Veredicto |
|---|---|---|---|---|
| Frase de arriba | Cuánto gastaste, cuántas agendas, cuánto costó cada una | Ninguna directa | Sí, mezclado: gasto de Meta, agendas de todo el CRM (`graficos-plantillas.ts:81`) | **Cambia.** Que diga «llegaron», o que use las agendas de los anuncios. Hoy atribuye las orgánicas a la pauta |
| Costo por agenda | Cuánto cuesta una agenda | «Apagar lo que no trae» (pasa tu costo) | Sí (`graficos-plantillas.ts:86`) | **Cambia.** Contra **tu objetivo** (`ConfigMediaBuyer.objetivo`, `lib/media-buyer/tipos.ts:30-31`), no sólo contra el período anterior |
| ROAS cobrado | Si la pauta se paga | Ninguna | Sí: lo cobrado de todo el negocio ÷ gasto (`graficos-catalogo.ts:99`) | **Queda** como control del dueño. No decide nada |
| Agendas | Cuántas agendas | Ninguna | Sí | **Sale.** Lo dice la frase |
| Gasto | Cuánto gastaste | Los topes | Sí | **Cambia.** Gasto del mes contra tu meta de gasto (`metaGastoMes`, `lib/media-buyer/tipos.ts:37-38`) |
| CTR | Cuántos tocan el anuncio | «Apagar… casi nadie hace clic» | Sí, de la cuenta entera (`graficos-plantillas.ts:90`) | **Cambia.** La decisión es por anuncio: va como columna de la tabla |
| Costo por lead | Cuánto cuesta un lead | Ninguna, salvo que tu resultado sea el lead | Sí: gasto ÷ leads de todo el CRM | **Cambia.** Un solo «costo por resultado», el que eligió el negocio (`kpi`: lead, agenda o venta, `lib/media-buyer/tipos.ts:22`, `:29`) |
| Tendencias | Si el gasto y lo que trae se movieron juntos | Ninguna | Sí, pero dibuja el % contra la primera semana, no los valores (`lib/marketing-diseno.ts:166-188`). Con 1 o 2 agendas por día sale en serrucho (hallazgos-templates-dashboard §21) | **Cambia.** El costo por resultado por semana, en dólares, con la línea de tu objetivo |
| Tabla · Por anuncio | Qué anuncio trae y cuál cuesta caro | «Apagar», «Subir el que gana» | Sí: gasto, leads y agendas de Meta. Marca barata/cara contra el **promedio** (`lib/marketing-diseno.ts:203-212`) | **Queda y cambia.** Contra tu objetivo, más CTR y frecuencia por anuncio, más las agendas del CRM |
| Tabla · Por campaña | Ídem, por campaña | «Subir el que gana» | Sí (`graficos-plantillas.ts:105`) | **Queda** |
| Tabla · Día por día | Lo de cada día | Ninguna | Sí | **Sale.** Repite Tendencias |
| «Lo que trae la pauta» (embudo + anillo) | Dónde se pierde la gente del anuncio a la agenda | «Cambiar el botón» (clic → página) | Parcial. Mezcla Meta (impresiones, clics, vistas de la página) con todo el CRM (leads, agendas) y con las vistas del VSL, que suman YouTube y Panda (`graficos-catalogo.ts:96-97`, `graficos-plantillas.ts:99`) | **Cambia.** Un embudo de UNA fuente: Meta hasta la página, después el Pixel, después el CRM por `meta_ad_id` |
| Mosaico «Los que más agendas trajeron» | Los 4 mejores anuncios | Ninguna nueva | Sí (agendas de Meta) | **Sale.** Repite la tabla |
| «Qué red trae agendas» | Instagram, Facebook y el resto | «Sacar los lugares que no traen» | Parcial. Agendas por red sí; el gasto por red no, aunque la fuente lo trae (`graficos-catalogo.ts:134-136`; la pieza no lo pide, `graficos-plantillas.ts:103`). Impresiones, CTR y CPM de abajo son **de la cuenta**, no de cada red (`lib/marketing-diseno.ts:297-305`). Sólo cuenta entera (`lib/meta-desgloses.ts:127`) | **Cambia.** Parte del gasto y agendas de cada lugar: con eso se saca Audience Network |

### Anuncios → «Anuncio ganador» (`HojaAnuncio.tsx`, `lib/anuncio-diseno.ts`, plantilla `lib/graficos-plantillas-analysts.ts:144-226`)

| Tarjeta | Qué contesta | Decisión que alimenta | Dato | Veredicto |
|---|---|---|---|---|
| Agendas de tus anuncios (por día) | Cuántas agendas por día | Ninguna | Sí, de los analizados | **Sale.** Repite Tendencias de Marketing |
| Qué hacer con cada uno (anillo) | Cuántos guiones van a escalar, mejorar el gancho… | Resume «Subir» y «Cambiar el hook» | Sí (`graficos-plantillas-analysts.ts:181`) | **Cambia.** Un anillo dice cuántos, no cuáles. El cuadrante (gancho × llegan al llamado) sí dice cuáles y hoy está sólo en la grilla (`:174-180`, `:217`) |
| Con cuánta muestra | Cuántos guiones juntaron impresiones para juzgarlos | Freno de «Subir el que gana» | Sí: ≥25 mil alta, ≥8 mil media (`lib/ads-analyst-patrones.ts:33`). No es un A/B (§7.4 de la propuesta) | **Cambia.** Va como marca dentro del ranking, no como tarjeta |
| Qué guion rinde más | Agendas por US$1.000, con muestra | «Subir el que gana», «Duplicar al ganador» | Sí (`:201-205`) | **Queda.** Es la tarjeta del piloto. Sumar el presupuesto de hoy de cada uno |
| Cuánto cuesta (3 números) | Costo por agenda, por cierre y gasto sin retorno | «Apagar lo que no trae» | Sí. Los cierres son del CRM por `meta_ad_id` (`lib/graficos-datos-extra.ts:136-138`) | **Cambia.** Quedan el costo por cierre y el gasto sin retorno. El costo por agenda repite Marketing |
| Listos para escalar | Qué parte de lo invertido va a los que conviene escalar | «Subir el que gana» | Sí (sale del veredicto) | **Queda** |
| Agendas por mes · Lo invertido por mes | Los seis meses cerrados | Ninguna | Sí (`:207-210`) | **Sale.** Es la vista larga de General |
| Agendas y cierres (por semana) | Cuántas agendas cerraron | Ninguna del área | Sí | **Sale.** Es de Comercial y Closing |
| El gancho en el tiempo | Hook rate, llegan al llamado y ThruPlay por día | «Cambiar el hook» | Parcial: incluye imágenes y dice que no (trampa 3) | **Sale.** Repite Hooks |
| El que más agendó + atajos | El mejor guion | Ninguna nueva | Sí | **Sale.** Repite el ranking |

### Anuncios → «Hooks y retención» (`HojaHooks.tsx`, `lib/hooks-diseno.ts`, plantilla `lib/graficos-plantillas-analysts.ts:234-278`)

| Tarjeta | Qué contesta | Decisión que alimenta | Dato | Veredicto |
|---|---|---|---|---|
| Frase de arriba | Cuántos vieron 3 s, la mitad y entero | Ninguna | Sí | **Sale.** Repite el embudo |
| Hook rate | Cuántos de los que ven el anuncio se quedan 3 s | «Cambiar el hook» | Sí, de la cuenta y con imágenes (`graficos-fuentes-extra.ts:68`) | **Cambia.** Sin imágenes, y con el umbral que usa el piloto (trampa 4) |
| Llegan al llamado | Cuántos llegan al CTA del guion | Ninguna de `QUE_HAGO` (sí el veredicto) | Parcial: es una **estimación**, interpolando los cuartiles al punto del CTA (`lib/graficos-datos-puro.ts:108-132`) | **Cambia.** Va al cuadrante, y que diga «estimado» |
| ThruPlay | Cuántos ven 15 s o todo | Ninguna | Sí | **Sale** |
| Guiones analizados | Cuántos guiones hay | Ninguna | Sí | **Cambia.** «X de Y anuncios activos analizados»: dice cuánto cubre la hoja (trampa 2) |
| Qué gancho retiene | Qué tipo de gancho retiene más | Qué hook probar al cambiarlo | Sí (`:257`) | **Queda** |
| Cada guion | Del que más retiene al que menos | «Cambiar el hook» | Sí, los 6 primeros (`lib/hooks-diseno.ts:118`) | **Cambia.** Al revés: los que peor retienen, con su gasto, y marcados los que cruzan el umbral. Ésa es la lista que el piloto toca |
| En qué parte se van | El embudo 3 s → ¼ → ½ → ¾ → entero | Ninguna de anuncios | Parcial: suma los cuartiles de videos de largos distintos (el 25 % de 15 s y de 90 s no es el mismo segundo). `caidaDe` no obliga a que baje (`lib/hooks-diseno.ts:139-151`) | **Cambia.** Por anuncio, en su ficha; no sumado |
| Hook rate por avatar | A quién le habla cada guion | Ninguna | Sí | **Sale.** Es de Ads Writer |
| Tu gancho (medidor contra 28 %) | Tu gancho contra el bueno | El umbral de «Cambiar el hook» | Sí | **Cambia.** Un solo umbral, el del piloto |
| Qué gancho funciona (caja de MaKo) | Texto de la IA | Ninguna | Nunca corre al abrir (`lib/hooks-diseno.ts:17`) | **Sale.** Lo explica «Acciones» |

> Ojo con la muestra: «Carrusel: cómo pasé de 2 a 9 llamadas» trae hook rate y ThruPlay (`lib/hooks-diseno-muestra.ts:28`).
> Un carrusel no tiene reproducciones de 3 s: con datos reales daría 0 %.

### Instagram → «Instagram y redes» (`HojaInstagram.tsx`, `lib/instagram-diseno.ts`, plantilla `lib/general-plantillas.ts:282-333`)

**La hoja es la pauta de Meta en Instagram más el Calendario. No es tu cuenta.** Las 9 decisiones de Instagram son orgánicas
(reels, historias, horario, palabra clave). Sólo «Publicar lo programado» se apoya en esta hoja.

| Tarjeta | Qué contesta | Decisión que alimenta | Dato | Veredicto |
|---|---|---|---|---|
| Frase de arriba | Cuánto te mostró Instagram, cuántos tocaron, cuántos agendaron | Ninguna de Instagram | Sí, pero **de los anuncios** (`audiencia`, `general-plantillas.ts:296`) | **Sale** de Instagram (la pauta vive en Anuncios) |
| Alcance · Tocan el anuncio · Inversión (y CPM) | La pauta en Instagram | Ninguna de Instagram | Sí, de los anuncios | **Sale.** Lo dice «Qué red trae agendas» |
| Próxima publicación | Qué sale y cuándo | «Publicar lo programado» | Sí (Calendario de General) | **Queda** |
| Esta semana | Lo programado de los 7 días | «Publicar lo programado», «Pedirte las historias» | Sí (Calendario) | **Queda** |
| Qué anuncio trajo clientes · El que más clientes trajo | Anuncios por cierres | «Duplicar al ganador» (de Anuncios) | Sí, pero de **todas** las redes de Meta, Facebook incluido (`general-plantillas.ts:316`) | **Sale** a Anuncios. En una hoja de Instagram engaña |
| Leads de tus anuncios (por día) | Leads y agendas de Meta | Ninguna | Sí, de todas las redes de Meta (`general-plantillas.ts:322`) | **Sale** |
| Cada red | Instagram contra Facebook | «Sacar los lugares» (de Anuncios) | Sí (`general-plantillas.ts:306`) | **Sale.** Repite Marketing |
| Quién te ve en Instagram | Edad, género y región de quien ve tus anuncios | Ninguna | Sí (sin agendas por región: `lib/graficos-audiencia.ts:20-23`) | **Sale** |
| De dónde llegan tus leads | Leads por origen del CRM | Ninguna | Sí (`general-plantillas.ts:314`) | **Sale** |

### YouTube → «VSL y YouTube» (`HojaVsl.tsx`, `lib/vsl-diseno.ts`, plantilla `lib/graficos-plantillas-analysts.ts:498-557`)

**La hoja es tu video de ventas en tu página.** De YouTube sólo trae las vistas diarias de los 3 videos que el negocio configuró
(VSL, gracias y preparación: `lib/onboarding-extract.ts:489-495`). Ninguna de las 7 decisiones de YouTube se apoya en ella.

| Tarjeta | Qué contesta | Decisión que alimenta | Dato | Veredicto |
|---|---|---|---|---|
| Le dieron play (tarjeta grande, días) | Cuántos le dieron play y cuántos llegan al final | «Regrabar una parte del VSL» (Web) | Sí, del Pixel (`retencion_vsl`) | **Queda**, en Web |
| Llegan al final | Qué parte ve todo | Ídem | Sí | **Queda**, en Web |
| Vistas del VSL | Vistas | Ninguna | Parcial: YouTube del video marcado VSL + Panda (`graficos-catalogo.ts:97`). No es el «le dieron play» de arriba. En la muestra: 14.380 contra ~3.190 (`lib/vsl-diseno-muestra.ts:52`) | **Sale.** Dos «vistas» distintas en la misma hoja |
| Costo por vista | Cuánto cuesta una vista | Ninguna | Engaña: **todo** el gasto de Meta ÷ esas vistas, que incluyen las orgánicas de YouTube (`graficos-catalogo.ts:105`) | **Sale** |
| Agendaron | Cuántos agendaron | Ninguna directa | Sí: eventos «agendo» del Pixel (`lib/graficos-datos.ts:161`, `:171`) | **Cambia.** Va como «agendan de cada 100 que le dan play» |
| Dónde se van (la curva) | En qué parte del video se va la gente | «Regrabar una parte del VSL» | Parcial: por cortes del 5 %, no por minuto (cabecera de `lib/vsl-diseno.ts`) | **Cambia.** En minutos, con la duración de Panda, marcando el minuto que más pierde |
| Tus videos | Cada video medido, del más visto | Ninguna | Sí, de los videos de tu página, no de tu canal | **Sale** (o queda en Web si hay varios VSL) |
| ¿Los que más ven, más agendan? | Leads por tramo visto | «Subir tu video si quien lo ve agenda más» (Web) | Sí (`vsl_leads`, `lib/graficos-datos-extra.ts:719-742`) | **Queda**, en Web |
| Los últimos días | Play y cuartos por día | Ninguna | Sí | **Sale** |
| Dónde más se van · De cada 100 | Los tramos que más pierden | «Regrabar» | Sí | **Cambia.** Una sola de las dos, unida a la curva |
| Qué dice tu video (caja de MaKo) | Texto de la IA | Ninguna | Nunca corre al abrir | **Sale** |

### Web → «Landing» (`HojaLanding.tsx`, `lib/landing-diseno.ts`, plantilla `lib/graficos-plantillas-analysts.ts:283-336`)

**La hoja no tiene la conversión.** Nadie dice cuántos de los que entran agendan, y las 6 decisiones de Web se miden con eso.

| Tarjeta | Qué contesta | Decisión que alimenta | Dato | Veredicto |
|---|---|---|---|---|
| Frase + Visitas | Cuántos entraron | Las «1.000 visitas» de las pruebas | Sí (`visitas`) | **Queda** |
| Llegan a la mitad | Cuántos bajan hasta la mitad | «Cambiar la parte que nadie lee» | Sí, en cuartos (`graficos-plantillas-analysts.ts:307`) | **Cambia.** El alcance por sección dice cuál parte; ya existe (§2) |
| Llegan al final | Cuántos llegan abajo | Ídem | Sí, pero el anillo de la misma tarjeta es OTRO número: de los que llegan a la mitad, cuántos siguen (`lib/landing-diseno.ts:95`) | **Cambia.** Un número por tarjeta |
| Tocan un botón | Cuánta gente toca algo | Ninguna | Parcial: cualquier botón o enlace, también el menú (`graficos-fuentes-extra.ts:80-85`). No es el llamado a la acción ni una agenda | **Cambia** por «agendan de cada 100 visitas» |
| Puntaje de la página | El diagnóstico de MaKo | «Cambiar la parte que nadie lee» (qué cambiar) | Sí, es una foto que se recalcula al analizar (`graficos-fuentes-extra.ts:129-130`) | **Queda** |
| Visitas por día (columnas) | Cuántos entran cada día | Ninguna | Sí | **Sale.** La frase lo dice |
| Cuándo entran | Visitas por franja y día | Ninguna de Web | Sí, en la zona del negocio | **Sale** |
| De dónde llegan | Visitas por origen | Ninguna | Sí | **Sale** de «Métricas» (queda en la grilla) |

El mapa de calor, los clics por botón y las grabaciones están en la plantilla pero no en el diseño (`:311`, `:318-319`): no se ven en
«Métricas». Para decidir no hacen falta.

## 2. Lo que FALTA para que el piloto decida, por área

### Anuncios

| Decisión (`QUE_HAGO`) | Hoy | Gráfico que haría falta | De dónde saldría |
|---|---|---|---|
| Apagar lo que no trae (pasa tu costo y casi nadie hace clic) | Parcial: costo por anuncio contra el promedio, sin CTR | Tabla por anuncio: costo por resultado contra tu objetivo y CTR, marcando los que cruzan las dos reglas | `meta` ya trae el CTR por anuncio (`graficos-catalogo.ts:120`). El objetivo: `lib/media-buyer/tipos.ts:30-31` |
| Subir el presupuesto del que gana | Sí, sólo de los analizados | El ranking con el presupuesto de hoy de cada uno y cuánto puede subir | Fuente `presupuesto` (`graficos-catalogo.ts:141-147`), sin usar en estas hojas. El tope: `subidaMaxPctDia` |
| Cambiar el hook (se va >60 % en 3 s) | Parcial (trampas 3 y 4) | Por anuncio de video: «se quedan a los 3 s», con la línea del umbral, ordenado por gasto | `guiones` sin imágenes |
| Sumar un video cuando se cansa (frecuencia 4) | **No** en el Dashboard. La base tiene `frequency` diaria (`lib/ads-analyst.ts:624`, `lib/media-buyer/datos.ts:163`) | La frecuencia de cada anuncio en el tiempo, con la línea en 4 y su CTR al lado (cansancio = frecuencia que sube y CTR que baja) | Hace falta el **alcance del período** por anuncio (frecuencia = impresiones ÷ alcance). El promedio de días no sirve (trampa 4) |
| Mover el presupuesto a las horas más baratas | **No**: Meta se lee sin desglose por hora (`lib/meta-desgloses.ts:33`) | Mapa de calor: costo por agenda por hora y día, como «Cuándo entran» de Landing | Una lectura nueva de Meta por hora. No sé si trae las agendas del Pixel con ese desglose: con región no las trae (`lib/graficos-audiencia.ts:20-23`) |
| Retargeting a quien vio el VSL y no agendó (desde 1.000) | Parcial: el avance por persona y los leads con `visitor_id` existen; el número no | Un número: personas que vieron más de la mitad y no agendaron, contra 1.000 | `retencion_vsl` + `vsl_leads` (`lib/graficos-datos-extra.ts:719-742`) |
| Sacar los lugares que no traen | Parcial: agendas por red, sin gasto | Barras: parte del gasto y agendas de cada lugar, 30 días | `audiencia` por plataforma ya trae el gasto (`graficos-catalogo.ts:134-136`) |
| Duplicar al ganador en un público parecido | Sí: cierres por anuncio | El ranking por cierres, con cuántos compradores hay para armar el público | `leads` por `meta_ad_id` |
| Lanzar de a 3 con US$ 7 por día | **No**: no hay piezas por semana | Columnas: anuncios nuevos por semana y por formato, y cuántos siguen vivos | `meta` cuenta anuncios distintos (`graficos-catalogo.ts:116`). El formato sólo está en los analizados (`script_analyses.format`) |

### Instagram

Todo lo orgánico sale de **Zernio** (`lib/zernio-organico.ts`), que ya lo usan WhatsApp y la portada de videos, pero ninguna hoja del
Dashboard. Necesita el complemento de Analytics de Zernio, que es **pago**: sin él contesta 402 (`lib/organico-reglas.ts:16`, `:40`).

| Decisión (`QUE_HAGO`) | Hoy | Gráfico que haría falta | De dónde saldría |
|---|---|---|---|
| Publicar lo programado | Sí | Ya está (Calendario) | — |
| Cambiar el hook de un reel (>55 % en 3 s) | **No**: Zernio trae alcance, vistas, me gusta, comentarios, compartidos y guardados; nada de retención (`lib/organico-reglas.ts:143-149`) | Por reel: «se quedan a los 3 s», con la línea en 45 % | No sé, leyendo el código, si Zernio o la API de Instagram lo entregan |
| Reels de prueba (si rinde más que tu promedio) | Parcial: el «cuántas veces tu mediana» existe para tus reels (`lib/video-outliers.ts:361-386`) | Barras: cada reel en múltiplos de tu mediana | Zernio. No separa seguidores de no seguidores |
| Pasar a reel un carrusel (>1,5×) | Parcial: Zernio trae el tipo de cada publicación; el múltiplo sólo se calcula para reels (`lib/video-outliers.ts:366`) | **Piezas por formato y por semana**: cuántas publicaste y cuánto rinde cada formato en múltiplos de lo normal | Zernio, extendiendo el múltiplo a todos los tipos |
| Mover el horario a cuando más te ven | **No**: la cuenta se pide en total; sólo el alcance trae serie (`lib/zernio-organico.ts:26-27`) | Mapa de calor: rendimiento por hora y día en que publicaste | Parcial con Zernio: la hora de cada publicación y sus vistas. Es «cuándo publicaste», no «cuándo te ven» |
| Cambiar la palabra clave | Parcial: los comentarios entran por el webhook de Zernio a `ig_conversaciones` (`lib/zernio-entrante.ts:7-12`); no se cuentan por palabra | Barras: comentarios con cada palabra, por reel | `ig_conversaciones` |
| Contestar a quien comenta | No hace falta un gráfico | Un número: comentaron, se les contestó, pidieron llamada | `ig_mensajes` + `leads` |
| Reordenar las historias (>30 % se va en una) | **No** | Salidas por historia | Sin fuente en el código |
| Pedirte las historias del día | No es una métrica | — | — |

### YouTube

Hoy MaKo pide a YouTube Analytics sólo vistas, minutos y duración promedio (`lib/youtube-analytics.ts:121`), y sólo de 3 videos.
La duración promedio se guarda y ninguna hoja la lee (`lib/onboarding-extract.ts:507-508`; `lib/graficos-datos.ts:90` sólo lee las vistas).

| Decisión (`QUE_HAGO`) | Hoy | Gráfico que haría falta | De dónde saldría |
|---|---|---|---|
| Sacar los shorts de los minutos que más retienen | **No** | La curva de retención de cada video largo, con sus picos | YouTube Analytics por video. No se pide hoy |
| Cambiar la miniatura que pierde (24 h de prueba) | **No** | **El clic de cada miniatura**: tasa de clics por video y por variante | No sé, leyendo el código, si la API que usa MaKo lo entrega. La prueba de miniaturas no aparece en el código |
| Reescribir el título (<3 % de clics) | **No** | Tasa de clics por video, con la línea en 3 % | Ídem |
| Link en el comentario fijado de los que más vistas traen | Parcial: vistas sólo de 3 videos | Ranking: vistas por video y visitas que mandan a tu página | Visitas con origen youtube.com (`visitas.origen`, `graficos-catalogo.ts:154`) |
| Elegir el próximo tema con lo que te piden | **No**: no se leen los comentarios de tus videos | Lista de temas pedidos | Sin lector propio (`lib/spy-youtube.ts` es de competidores) |
| Pantalla final al video que más vende | Parcial: «¿Los que más ven, más agendan?» es del VSL de tu página | Agendas por video de origen | Sin dato por video del canal |
| Programar el día que más te ven (8 videos) | **No** | Vistas en 48 h por día de publicación | YouTube Analytics por video |

### Web

| Decisión (`QUE_HAGO`) | Hoy | Gráfico que haría falta | De dónde saldría |
|---|---|---|---|
| Todas | **No hay conversión en la hoja** | «Agendan de cada 100 visitas», por página | Eventos «agendo» por página (`vsl`, `graficos-catalogo.ts:159-166`) ÷ visitantes |
| Probar dos titulares (1.000 visitas) | Parcial: el motor A/B existe para landings (`lib/pruebas/metricas.ts:20`) y `visitas` tiene la dimensión «Variante» (`graficos-catalogo.ts:154`) | Dos barras: agendan de cada 100 por variante, con sus visitas y la línea de 1.000 | `lib/pruebas`. ⚠️ El juez da falsos ganadores entre 10 y 35 % (`docs/diseno-pruebas-ab.md`, Anexo 2 §A): mostrar el intervalo, no «ganó» |
| Cambiar la parte que nadie lee | Parcial: el **alcance por sección** existe desde el Pixel v26 (`lib/editor-landing/alcance-secciones.ts`) y vive en el editor, no en el Dashboard | Barras: qué parte de los visitantes vio cada sección, en el orden de la página | `alcance-secciones` |
| Acortar el formulario (si >30 % lo deja en una pregunta) | **No**: el Pixel no manda eventos del formulario (`app/api/track/vsl/route.ts:462`); el opt-in sólo registra el envío (`app/api/track/optin/route.ts`) | Embudo por pregunta | Un evento nuevo del Pixel |
| Subir tu video si quien lo ve agenda más | Sí, en la hoja VSL | Llevar «¿Los que más ven, más agendan?» a Web | Ya está |
| Achicar lo lento (>3 s en el celular) | **No**: no hay medición de carga en el código | Tiempo de carga en celular por página, con la línea en 3 s | Un dato nuevo del Pixel |
| Regrabar una parte del VSL | Parcial: cortes del 5 % | La curva en minutos y el minuto que más pierde | `retencion_vsl` + la duración de Panda |

## 3. La oferta: ¿hace falta una hoja?

**Sí, una chica.** Las 5 decisiones de la oferta (`QUE_HAGO` 605-609) se apoyan en llamadas y chats, y hoy no tienen nada en «Métricas».
No conviene mostrar Closing entera: es la hoja que ve el closer (`HOJA_DE_ROL`) y tiene 14 paneles.

Con piezas que ya existen (todas en `lib/graficos-plantillas-analysts.ts`, la plantilla CLOSING):

| Tarjeta | Para qué decisión | De dónde |
|---|---|---|
| Tasa de cierre, con su cambio | Si la versión nueva de la oferta cierra más | `cl-tasa` (`:360`) |
| Embudo R1 → R2 → ganadas | Dónde se cae la venta | `cl-embudo-embudo` (`:366`) |
| «Manejo de objeciones» en las ganadas contra las perdidas | Si las objeciones deciden | `cl-factores-barras` (`:370`), dimensión de `lib/api-mako/areas/closing.helpers.ts:33` |
| Motivo de pérdida, contado | Por qué no compran | Dimensión `motivo` de `leads` (`lib/graficos-catalogo.ts:188`, `lib/graficos-datos.ts:269`). No sé cuántos negocios lo llenan: eso es de la base |
| Las objeciones de cada llamada | El detalle | Pieza `objeciones` del pop-up de la llamada (`:104`) |

Lo que falta para que el piloto decida solo:

- **Objeciones contadas por tipo** («es caro» en 9 de 23 llamadas). Cada objeción es texto libre: cita, si se respondió y una nota
  (`lib/closing.ts:454`). No hay categoría. Hace falta clasificarlas al analizar la llamada y dibujar una barra por tipo, «de N llamadas»,
  con la línea en 5 (la regla del bono).
- **Las objeciones de los chats.** Hoy son un resumen de texto en la voz del negocio (`lib/chat-agent-voz.ts:54`); no se cuentan.
- **Los cupos.** No hay dato de cupos en el código: «Proponerte subir el precio cuando se llenan» no tiene con qué medirse.
- **El puntaje de la oferta** (46 → 63) existe en el diagnóstico de Offer (`lib/offer-pdf.ts:209`), fuera del Dashboard. Iría como un número.
- **El escalón de abajo:** cierres por producto o funnel (dimensión `producto` de `leads`, `lib/graficos-catalogo.ts:187`). Parcial.

## 4. La lista corta

### Sacar (de lo que más engaña a lo que menos estorba)

1. **«Costo por vista» y «Vistas del VSL»** (VSL): dividen todo el gasto de Meta entre vistas que suman YouTube orgánico y Panda, y no son el «le dieron play» de la misma hoja.
2. **«Lo que trae la pauta» tal como está** (Marketing): un embudo que mezcla tres fuentes. Se rehace de una sola (ver Sumar 2).
3. **De «Instagram y redes», todo lo que es pauta** (frase, tres números, cada red, quién te ve, anuncios y leads de Meta): no es Instagram y repite Marketing.
4. **Lo repetido entre hojas:** «Agendas de tus anuncios», «El gancho en el tiempo», «El que más agendó», el mosaico, «Agendas» y «Gasto» sueltos, la pestaña «Día por día», la frase de Hooks.
5. **Lo que no alimenta ninguna decisión:** ThruPlay, hook rate por avatar, los dos «por mes» y las agendas por semana de Anuncio ganador, «Cuándo entran», «De dónde llegan» y «Visitas por día» de Landing, «Tus videos» y «Los últimos días» de VSL.
6. **Las cajas de MaKo** de Hooks y VSL: nunca corren al abrir, y «Acciones» ya explica cada decisión con su dato.

### Sumar (de lo que más decide a lo que más cuesta)

1. **Costo por resultado contra tu objetivo, por anuncio, con CTR y frecuencia** (Anuncios). Es «Apagar», «Subir» y «Se cansa» en una tabla. El dato está casi entero; la frecuencia hay que medirla bien.
2. **Un embudo de una sola fuente**, y la frase con las agendas de los anuncios (las del CRM por `meta_ad_id`, como el Media Buyer).
3. **«Agendan de cada 100 visitas», por página y por variante** (Web). Sin esto ninguna decisión de Web tiene su número.
4. **Instagram orgánico por Zernio:** cada publicación en múltiplos de lo normal, y piezas por formato y por semana. Depende del complemento pago.
5. **Gasto y agendas por lugar** (Audience Network). El dato ya viene; sólo falta pedirlo.
6. **Alcance por sección** de la página (Web). Ya existe en el editor.
7. **Cobertura de las hojas de guiones:** «X de Y anuncios analizados», y sin imágenes en el hook rate.
8. **La hoja de la oferta** (§3), con las objeciones contadas.
9. **YouTube:** clic de la miniatura, retención por video y vistas por día de publicación. Hace falta dato nuevo; antes de prometerlo, verificar qué entrega la API.
10. **Costo por hora, tiempo de carga y abandono del formulario:** dato nuevo de Meta o del Pixel.

## Lo que no se puede saber leyendo el código

- Si Zernio o la API de Instagram entregan la retención a los 3 s de un reel o las salidas de cada historia.
- Si la API de YouTube que usa MaKo entrega la tasa de clics de la miniatura, y si la prueba de miniaturas tiene API.
- Si Meta manda las agendas del Pixel con el desglose por hora.
- Cuántos negocios tienen Zernio con Analytics, YouTube conectado, guiones analizados o el motivo de pérdida lleno. Eso se mide en la base.
- Cómo se arma en Meta el público de retargeting del VSL: el número de MaKo sólo dice si llega a 1.000.
