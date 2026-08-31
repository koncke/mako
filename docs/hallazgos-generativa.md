# Hallazgos — Generación de imagen y video

> **Versión leíble:** todo lo de este documento está consolidado como curso en
> `lib/curso-avatar.ts` (fuente única) → `/conocimientos` en super-admin, 23 lecciones.
> Acá viven las mediciones y las rutas; allá, el criterio. Si corregís algo acá que
> cambie una regla, corregilo también en el curso.

Dónde vive el código: `app/image-generator`, `app/video-generator`, `app/reels`,
`lib/persona.ts`, y el catálogo de formatos en `lib/angulos-data.ts`.

Lo aprendido revisando el curso **Creativos UGC Realistas · Avatar Hype** (30 clases,
replicado en `app/conocimientos/curso-creativos-ugc-realistas.ts`) para llevarlo a
MaKo. Corrida de 9 agentes, 2026-08-18.

---

## El diagnóstico obvio era el equivocado: BYOK de medios está PROHIBIDO

La intuición razonable —«para texto cada cliente pone su key, hacemos lo mismo con
imagen y video»— **choca con los contratos**. `app/admin/dev/pricing/modelo.ts:618`
ya lo tenía escrito y nadie lo había cruzado con esta idea:

> «BYOK va en el Growth, SIN tocar el precio, y **solo para texto**.»
> «BYOK de MEDIOS está prohibido, textual: fal.ai (ToS act. 31/07/2026) *You may not
> share or permit others to use your individual account credentials*. Replicate dice
> lo mismo. Y son justo los dos proveedores cuyos términos contemplan un SaaS.»

**Regla que queda:** cualquier diseño de imagen/video que asuma la key del cliente
está muerto antes de empezar. El eje es **cupo medido dentro del plan**, no BYOK.
Y antes de proponer economía de medios, **abrir `modelo.ts` y `docs/costos-ia-y-planes.md`**:
el negocio ya está costeado ahí y proponer lo contrario sin citarlo hace que la
próxima sesión rediscuta todo desde cero.

## La aritmética: la imagen entra en el plan, el video NO

Del propio `modelo.ts` (`PERFILES`, línea 398): el Growth de US$97 presupuesta
`mediosUsd: 24,58` contra `textoUsd: 2,82` — **los medios son el 90% del costo**.

| | Costo | Contra el presupuesto de medios del Growth |
|---|---|---|
| Tanda de 7 placas estáticas (Nano Banana Pro, 3 intentos) | US$2,82 | 8 tandas = US$22,56 → **se come el presupuesto entero** |
| Ídem en carril batch (Nano Banana 2) | US$0,72 | 8 tandas = US$5,76 → **sobra el 76%** |
| Un anuncio de video 30s usable (Veo 3.1 Lite, 2-3 intentos) | US$3–4,50 | 20 al mes = US$60–90 → **no entra** |

**Regla:** la imagen se lanza en el carril **batch**, no en el de calidad. El video
no se promete hasta que exista medición de gasto.

## Ya hay casa, y está vacía: no inventar una nueva

`app/image-generator/page.tsx` y `app/video-generator/page.tsx` **existen** como
`ComingSoon` con guard y entrada de nav bajo «Content Machine»; `app/reels/` ya es
una tab construida. Poner la generación adentro de `app/onboarding/MatrizView.tsx`
crea **dos hogares para lo mismo**, que es la deuda más cara disponible hoy.

## El método 6C: el prompt completo YA está en el repo

No hace falta volver al curso. El texto íntegro (8.682 caracteres) del
`avatarhype-6c-prompt-engine.md` vive como campo `texto` del recurso `metodo-6c` en
**`app/conocimientos/curso-ugc-recursos.ts:38`**.

Las seis C son el esqueleto de un **prompt de imagen**, no un framework de marketing:
**Character · Camera · Clothing · Context · Cinematic Light · Consistency Anchors.**

⚠️ **Trampa verificada:** la transcripción del video las enumera MAL (dice
«composición» y «entorno», y se pierde *Consistency Anchors* — justo la que resuelve
la consistencia de personaje). **La fuente autoritativa es el texto del skill, no el
video.** Vale como regla general para todo este curso: los apuntes (`resumen`) de las
5 clases del módulo «Fundamentos» están VACÍOS y los docs de `public/cono-doc/` son
boilerplate de una frase — la carne está en las transcripciones y en el archivo de
recursos.

**La regla de realismo es contraintuitiva y es la clave:** el avatar perfecto arruina
el realismo. El prompt exige poros visibles, pecas, líneas finas, manchas sutiles y
asimetrías naturales, y **prohíbe** piel alisada o de plástico. Las constantes
literales del método son «iPhone photo», «direct harsh iPhone flash», «candid dump
vibe» y «slight grain».

Cómo se parametriza en MaKo: C1 sale del avatar del onboarding + la lámina de
referencia, C3/C4 del brief de marca, C2/C5 son casi constantes del sistema, y **C6
es constante pura** — se pega igual en todas las generaciones.

## Los niveles de conciencia son un EJE NUEVO, no un sinónimo

Son los 5 de Schwartz, y **no existen en el repo** (grep del proyecto entero: cero).
Son **ortogonales** a las razones de compra y a los 14 ángulos de guion — no es lo
mismo con otro nombre. Antes de mapearlos contra lo que ya hay, tenerlo presente.

Y «las palancas» son tres: **ángulo (el 80% del resultado), oferta y creatividad**,
con un catálogo cerrado de 12 ángulos.

## Lo que la automatización NO puede prometer

El módulo «Formatos» parte **cada** formato en *Producción* y *Edición*, y la edición
es CapCut a mano. Entregar 4 mp4 sueltos y pedirle al dueño de negocio que corte
silencios y aplique un preset **no es un pendiente técnico: es el posicionamiento**.
Un cliente que compró «MaKo genera tus creativos» y recibe materia prima pide
reembolso.

El modo de falla más caro está en la imagen, no en el video: las placas de «Imágenes
estáticas» llevan **el texto en español incrustado**, y ningún modelo lo renderiza
fiable al primer intento. Prometer «7 anuncios listos» sin haber medido eso es la vía
directa a que el cliente queme su cuota con el copy deformado y se vaya.
**Se responde con 7 generaciones reales, no con una discusión.**

## Cosas rotas que encontró la corrida (no son del plan, son de hoy)

- **`lib/persona.ts:29-31`** cae a `OWNER_WS` si no hay workspace. Los 2 call-sites
  están envueltos, así que hoy es seguro — pero el fallback tiene que morir antes de
  que alguien agregue el tercero.
- **ElevenLabs miente en producción:** la key se pide, se cifra y se verifica, y
  **no la usa ni una línea**. `lib/metodo-verificar.ts:290` afirma algo falso. Se
  cablea o se saca.
- **`imagenUrl` de `RazonCelda` está muerto:** declarado, nunca escrito. Cuando
  exista generación, va una **tabla de creativos con historial**, no un string.
- **No hay primitiva de denegación por consumo.** Lo único que contiene el gasto hoy
  es que la llamada explota sin key propia. Cualquier función que corra con la key de
  la plataforma (por ejemplo generar la lámina en el onboarding) es un bucle sin
  techo, porque el usuario puede regenerar hasta que le guste.

---

## La promo de Google Flow del curso: por qué no sirve para el producto

El curso recomienda comprar «un recurso» que da 3 meses de Google AI Pro por US$12.
Verificado, 2026-08-18:

**Lo que es cierto:** existe, y en Flow las imágenes **no descuentan créditos** (la
tabla oficial de consumo lista solo modelos de video). Para producir a mano, la
suscripción legítima de AI Pro a US$19,99 **le gana a la API por ~1,7x**: 1.000
créditos son ~5,5 min de Omni, que por API saldrían US$33.

**Son 18 MESES, no 3 — corregido el 21/08/2026 con la pantalla de activación.**
La primera versión de este hallazgo decía «3 meses» y que era reventa de *activation
links* de mercado gris. **Las dos cosas eran falsas.** Martín activó el plan desde
`one.google.com/activate-plan` y la pantalla dice textual: *«Activa tu plan Google AI Pro
de Jio por ₹35.100 sin costo por 18 meses»*, con *«Oferta válida hasta octubre de 2026»* y
*«No se requiere pago»*. Es la promo real de Jio, activada por el canal oficial de Google
One, no un link revendido.

Lo que quedó bien de la advertencia original: es una promo de un tercero (Jio) con fecha
de corte, no un precio permanente de Google. Se apaga en octubre de 2026.

**Lo que sí sigue siendo cierto:**
- **«Ilimitado» no lo dice Google.** Los límites de Gemini son por cómputo, se reponen
  cada 5 horas, y la doc dice «Limits may change without notice».
- Manda al modelo más caro por defecto: **Veo 3.1 Lite cuesta 10 créditos** por clip de
  hasta 8s, contra los 15+ de Omni Flash.
- En Flow las imágenes **no descuentan créditos** (la tabla oficial de consumo lista solo
  modelos de video).

## La tabla de créditos que circula está mal, y la resolución no tiene nada que ver

Toda la producción se planificó con la tabla que repiten los blogs de terceros: Omni Flash
4s=15, 6s=20, 8s=25, **10s=30** créditos.

**Es falsa.** La pantalla de generación de Flow, en la cuenta real, con Omni Flash · 9:16 ·
**10s** · x1 dice: *«La generación consumirá 15 puntos»*. La mitad de lo planificado.

Y de paso invalida una acusación que este mismo documento le hacía al curso de AvatarHype
(«la cuenta está inflada 2x, los US$0,06 por clip de 10s son en realidad 4 segundos»). **El
inflado era nuestro, no del curso.** Con 15 créditos por clip de 10s, su número cierra.

**La primera explicación que se intentó también estaba mal, y conviene que quede escrito.**
Se supuso que la diferencia venía de la resolución: la captura era de 720p y los montajes
se hacían «a 1080p». **Pero la resolución NO es un parámetro de generación en Flow.** El
selector de la barra tiene modelo, relación de aspecto, duración y cantidad de variantes —
nada más. Los 720p / 1080p / 4K aparecen recién en el menú de **descarga**, donde 720p
figura como *«Tamaño original»* y 1080p y 4K como *«Mejora de resolución»* (el 4K además
pide upgrade de plan).

**Dos consecuencias:**

1. Todo lo que se generó es **720p nativo**. Los archivos «1080p» del pipeline son ese
   mismo material reescalado al bajarlo, no material generado en alta. Eso pone un techo
   real a la calidad que ninguna capa de post levanta.
2. El costo depende de **modelo × duración × variantes**, y de nada más.

**La regla:** el costo en créditos NO se planifica desde una tabla de internet. Se lee **en
la propia pantalla de Flow**, que lo muestra antes de generar. Una tabla escrita en un
documento envejece sin avisar; el contador de la UI, no.

**No verificado:** el costo real de 4s, 6s y 8s (solo está confirmado el de 10s), y si el
reescalado de la descarga consume créditos — la hipótesis del dueño es que no.

**EL TAPÓN, y es de arquitectura:** Flow **no tiene API**, y la suscripción de
consumidor **no cubre requests de API** — doc oficial textual: *«Google AI plan
benefits for developer usage apply only within the Google AI Studio web interface»* y
*«Direct use of the Gemini API is billed and managed separately»*. Los 1.000 créditos
valen **cero** para MaKo. Aunque la promo fuera legítima y perpetua, los créditos son
por CUENTA («shared across your account»): un inquilino pesado se comería la cuota de
todos, sin aislamiento ni atribución.

> **CORRECCIÓN (2026-08-18):** más arriba este documento decía que el prompt del
> character sheet no estaba en el repo. Ya no es cierto: Martín consiguió la
> **biblioteca completa de prompts de AvatarHype** (imagen, video y formatos), que
> incluye el *Character sheet · 9 ángulos (3×3)* y los prompts de cambio de vestuario,
> fondo, ángulos, producto y app. Hay que incorporarla al repo — hoy vive suelta fuera
> de él, que es exactamente cómo se pierde.

**Regla que queda:** ninguna suscripción de consumidor puede alimentar un SaaS
multi-inquilino. Y ojo con las APIs no oficiales de Flow (useapi.net y similares):
resuelven el reCAPTCHA de Google por vos, o sea *bypassing our protective measures*.

## LA PALANCA QUE SÍ APARECIÓ: la tarifa MUDA de Veo por Vertex

**La página de precios de la Gemini API no la lista; la de Vertex AI sí, y es la
mitad.** Veo 3.1 Lite 720p: **US$0,05/s con audio contra US$0,03/s mudo.** Veo 3.1
Standard: 0,40 contra 0,20.

**Y el default cobra audio.** Si no se pide explícitamente la variante muda, se paga el
doble por un audio que en UGC de performance se descarta igual, porque encima va voz
en off propia o música de librería.

Rehaciendo el `mediosUsd: 24,58` del Growth (que se descompone en 200 imágenes ×0,034
+ 20 clips de 8s ×0,40 + 4 Reels de 15s con 3 intentos ×2,445):

| Escenario | Medios | Baja |
|---|---|---|
| Hoy (audio nativo) | US$24,58 | — |
| Solo mudo | US$17,78 | **−28%** |
| Mudo + Batch API en el cron | US$14,34 | **−42%** |

El margen bruto de IA del Growth pasa de 71,8% a 78,8% / 82,3%.

**Esto hay que decidirlo ANTES de escribir el generador, no después:** si nace pidiendo
audio nativo, nadie lo migra. Y reabre la elección de proveedor: fal.ai y Replicate se
eligieron por sus términos, pero **ninguno de los dos expone la tarifa muda** — para
modelos de Google, Vertex directo es el único camino a ese −40%.

**Falta en el catálogo** (`app/admin/dev/pricing/modelo.ts`, verificado): no hay fila
de la tarifa muda ni de Gemini Omni Flash (US$0,1014/s por API — 2x Veo Lite con audio
y 3,4x el mudo).

**Un segundo motivo, técnico, para la decisión de «BYOK solo texto»:** en la página de
precios de Google, TODOS los modelos de imagen y video tienen el Free Tier en «Not
available». Hoy MaKo corre el texto con la key GRATIS de Gemini del cliente; esa misma
key en medios **falla el 100% de las veces**. Pasar a BYOK de medios obligaría al
cliente a cargar una tarjeta en Google Cloud, que es otro orden de fricción. Si algún
día se intenta, hay que detectarlo explícito en la UI y no dejar que el cron falle en
loop (ya pasó con el BYOK de texto sin key).

---

## El montaje de los clips: `silencedetect` devuelve VACÍO, no error

Al armar a mano el primer anuncio de IA de Mauricio (12 clips de Flow, hablando dentro
del auto) hubo que unirlos y quitarles el aire de las puntas. El camino obvio es
`ffmpeg -af silencedetect`. **En 11 de los 12 clips no detectó absolutamente nada** — ni
a −32 dB, ni a −35. Ninguna advertencia, ninguna excepción: salida vacía, que se lee
igual que «no hay silencios que cortar».

**La causa:** el clip tiene motor y ruido de calle de punta a punta. El piso de ruido
está en −30 dB y la voz en −18. Nunca hay silencio *digital*, así que un umbral absoluto
no separa nada. El error fue creer que «silencio» es una propiedad de la señal cuando en
realidad es **relativa a ese clip**.

**Primer intento, y ESTABA MAL** — envolvente RMS y percentiles por clip: `piso = p10`,
`voz = p90`, `umbral = piso + 0,45·(voz − piso)`, margen 0,10 s antes / 0,15 s después.
Parecía funcionar: recortó 5,6 s de 102 s. **Pero ~4 de esos segundos eran habla.** En 6
de los 12 clips el corte cayó antes de que terminara la última palabra. Lo detectó el
usuario escuchando, no la herramienta.

**Por qué falla, y es la parte que importa:** la energía de audio NO es la palabra. La
*s* final de «tareas» o la *a* átona de «semana» tienen 10-15 dB menos que la vocal
tónica, así que caen por debajo de cualquier umbral razonable mientras el hablante
todavía está hablando. Subir el margen no lo arregla: mueve el error, no lo elimina,
porque el ancla sigue siendo la energía.

**Lo que sí funciona** — anclar en la PALABRA, no en la energía:

1. Whisper con `timestamp_granularities[]=word` sobre cada clip. Devuelve `start`/`end`
   por palabra.
2. **La cabeza de Whisper no sirve:** ancla la primera palabra en `0.00` en 10 de 12
   clips (artefacto conocido de la alineación). La cola sí es confiable.
3. Cruzar con la envolvente RMS y quedarse con **la unión, no la intersección**:
   `inicio = min(whisper, rms) − 0,25` y `fin = max(whisper, rms) + 0,25`. Se recorta
   solo donde los dos métodos coinciden en que no hay nadie hablando.
4. **Verificar SIEMPRE:** transcribir el montaje final y comparar la secuencia de
   palabras contra la concatenación de los originales (difflib sobre tokens
   normalizados: minúsculas, sin tildes, sin puntuación). Si falta una, no sale.
   Medido: 289 esperadas → 289 presentes, 99,65% (la única diferencia fue «hasta» vs
   «esta», ambigüedad del transcriptor sobre el mismo audio).

**Cuánto aire había de verdad: 1,54 s en 102 s.** Los clips de Veo salen pegados al
texto, casi sin respiración. O sea que en material generado, «quitar silencios» es casi
un no-evento — el aire aparece cuando hay una cámara real y alguien pensando. Esto
importa para no prometer una limpieza que no tiene nada que limpiar.

**La regla que queda:** ningún corte de audio se ancla en un umbral de energía. Se ancla
en timestamps de palabra, y se verifica transcribiendo el resultado. Un recorte de audio
sin diff de palabras no está terminado, está sin probar.

**Corolario sobre los subtítulos:** con word-level timestamps, los subtítulos también
salen de Whisper. CapCut deja de ser necesario para eso — su única ventaja era la
autogeneración, y ya la tenemos por API.

**No verificado:** si hay música o silencios largos de verdad, el `p10` deja de ser el
piso de ruido y el umbral se corre. Para material así hay que revisar la calibración.

---

## El diagnóstico obvio era el equivocado: no hace falta resincronizar labios

El plan decía Make It Yours para ponerle la voz real al avatar, porque esa herramienta
reemplaza la voz **y** vuelve a sincronizar los labios. La creencia de fondo: si cambiás
la voz, los labios dejan de coincidir.

**Es falso para nuestro caso, y por una razón estructural.** Make It Yours resincroniza
porque su usuario típico se grabó a sí mismo y quiere otro idioma o otro timbre — ahí el
ritmo cambia. Pero *speech-to-speech* no es texto-a-voz: es conversión de timbre que
**preserva el ritmo, las pausas y la entonación del audio de entrada**. Nuestro video
tiene los labios animados para ese ritmo exacto. Si el ritmo no cambia, los labios
siguen coincidiendo y no hay nada que resincronizar.

**Medido, no supuesto.** 100,6 s de anuncio pasados por `eleven_multilingual_sts_v2`:

| | |
|---|---|
| duración entrada / salida | 100,625 s / 100,635 s (**10 ms** en 100 s) |
| desfase mediano | **0 ms** |
| desfase medio absoluto | 5 ms |
| desfase máximo | 30 ms |
| tramos de 2 s sobre 80 ms | **0 de 50** |
| palabras | 289 → 289 |

**GOTCHA del método de verificación.** El primer intento midió la deriva comparando
timestamps de palabra de Whisper entre los dos audios, y dio *840 ms de máximo* y 7,6% de
palabras «corridas». **Era ruido del transcriptor, no desfase real.** Se delató solo: un
corrimiento de 840 ms con duración total idéntica exigiría que el audio se comprima y se
estire, cosa que STS no hace. Los peores casos eran todos palabras cortas y átonas —
«y», «la», «en», «hay» — que es donde la alineación de Whisper es más floja.

Lo que sí mide: **correlación cruzada de las envolventes de energía** en ventanas de 2 s
(RMS cada 10 ms, buscar el retardo que maximiza la correlación). Eso mide la señal, no
la interpretación de la señal. La regla: *para medir alineación temporal usá la forma de
onda; los timestamps de un modelo sirven para saber QUÉ se dijo, no exactamente CUÁNDO.*

**Consecuencia para el producto, que es lo importante:** Make It Yours **no tiene API**
(verificado en su sitio; es una herramienta de interfaz web). ElevenLabs sí, y hace lo
mismo con `eleven_multilingual_sts_v2` (`can_do_voice_conversion: true`, español entre
sus 29 idiomas). Ya hay `ELEVENLABS_API_KEY` en el entorno y la cuenta tiene voces
cargadas. Es decir: **el último paso manual del pipeline deja de serlo**, y no queda
ningún eslabón que obligue a salir a una app de interfaz.

Receta completa, toda por API:
`/v1/voices/add` con ~90 s de audio del cliente → `/v1/speech-to-speech/{voice_id}` con
el audio del montaje → remux con `-c:v copy` (la imagen no se recomprime) → verificar por
correlación cruzada antes de dar por bueno.

**No verificado:** la voz se clonó desde el audio del anuncio de Meta, que viene
recomprimido a 61 kbps y normalizado casi al techo. No sabemos cuánto mejora el clon con
audio de celular en una habitación quieta — la hipótesis es que bastante, pero no está
medido. Tampoco se probó STS sobre material con música de fondo.

---

## El último tramo (subtítulos y música) cuesta el 0,6% del anuncio

Con las tarifas del propio `modelo.ts`, un anuncio de 12 clips de 8 s son US$4,80 de
generación (`:488`, `clip8`). Subtitularlo cuesta **US$0,001** (`:441`, `stt`, grupo
`Conversar`) y una pista generada por fal, **US$0,03**. El quemado y el degradado son
CPU propia: US$0.

**La regla:** al priorizar este pipeline, el tramo caro es el video generado, no el
acabado. Discutir la economía de los subtítulos es discutir centavos — y el único
tramo que puede volverse caro de golpe es la **música**, porque si va por biblioteca
licenciada deja de costar por anuncio y pasa a ser un fee mensual sin precio publicado.

## Falta UNA línea, y sobra un tipo: por qué el repo no puede subtitular hoy

`lib/transcribe.ts` pide `verbose_json` (`:172` y `:258`) pero **nunca** manda
`timestamp_granularities[]`, así que la API devuelve como máximo segmentos. Grep del
repo entero: la cadena no aparece en un solo archivo de código.

**Pero agregar el parámetro no alcanza:** `TranscribeResult` (`:17-28`) y
`UploadTranscribeResult` (`:148-154`) no tienen campo de palabras, y el código lee solo
`tr.text` / `tr.language` / `tr.duration` — el resto del body se tira. Hay que tocar el
tipo y el form, en dos lugares cada uno.

**Y NO se reusa `lib/ai-cheap.ts`.** Tres bloqueos: `transcribirAudio` devuelve
`Promise<string>` (`:820`), `SttOpts` no tiene por dónde pedir granularidad (`:742`), y
la cascada arranca por Gemini (`:150`) cuyo prompt **prohíbe explícitamente** los
timestamps (`:783` — «sin comillas, sin timestamps, sin nombres de hablante»).

**La regla:** para subtítulos se llama a Whisper **directo**, no a la cascada barata. Y
el modelo tiene que seguir siendo `whisper-1` (el que ya usa `transcribe.ts:257`): es el
único que soporta `timestamp_granularities`, los `gpt-4o-transcribe-*` no. Migrar de
modelo por «modernizar» rompe los subtítulos en silencio.

**Más corto y más preciso que transcribir:** `POST /v1/forced-alignment` de ElevenLabs
le pasa el audio **y el guion que ya conocés**, y devuelve start/end por palabra y por
carácter. No transcribe: alinea, así que no puede equivocarse en QUÉ palabra dijo. La
`ELEVENLABS_API_KEY` ya está en el entorno; falta el cliente (`lib/elevenlabs.ts` no
existe: el único lector de la key es el ping de `lib/metodo-verificar.ts:281`).

## libass no avisa cuando le falta la fuente

Con `Style: Tok,Montserrat ExtraBold,...` el log dice
`fontselect: (Montserrat ExtraBold, 700, 0) -> Arial-BoldMT` y sale con **exit code 0**,
sin warning ni error. El video queda bien, con la tipografía equivocada.

Y no hay **ni un** archivo `.ttf`/`.otf`/`.woff` en el repo.

**La regla:** todo render con `ass=`/`subtitles=` se verifica grepeando `fontselect` en
el log de ffmpeg, no mirando el exit code. En contenedor es peor: sin
`/usr/share/fonts` el filtro directamente no renderiza (caso canónico: la imagen Docker
de ffmpeg sobre Alpine).

**Probado en esta máquina:** el mecanismo de karaoke funciona. Un `.ass` con
`{\k40}HOLA {\k60}MUNDO` quemado con `-vf ass=` da el resaltado palabra por palabra
estilo TikTok (frame a 0,2 s: HOLA en primario, el resto en secundario). Las duraciones
de `\k` van en **centésimas** (100 = 1 s). Y el estilo va entero en el header del
`.ass`: pasar `force_style` además lo **pisa**.

Costo: 100 s de 1080×1920@30 con 50 líneas = **43,2 s de reloj** (speed 2,31x, libx264
veryfast crf 20) en esta laptop. El burn-in obliga a reencodear el video (`ass` es
V->V), pero el audio pasa con `-c:a copy`.

## El diagnóstico obvio era el equivocado: el ducking dinámico entierra la música

La física de `sidechaincompress` está medida y es contraintuitiva: la profundidad la
fija el **threshold**, no el ratio (con ratio 8: T=0.02 → -8,0 dB; T=0.006 → -17,2 dB;
T=0.002 → -25,5 dB; con T fijo, subir el ratio de 4 a 20 solo mueve 1,8 dB). El default
`threshold=0.125` (= -18,1 dBFS, es **amplitud lineal**) produce **cero** ducking con
una voz que pica a -24 dBFS: quien copia el filtro sin tocar el threshold cree que puso
ducking y no puso nada. Y el ejemplo **oficial** de la doc de FFmpeg está roto: usa
`threshold=-30` como si fuera dB y el comando falla entero.

**Nada de eso importa acá, y ese es el punto.** Este proyecto ya lo probó y lo sacó:
en un anuncio el narrador habla casi todo el tiempo, así que el ducking dinámico deja
la música enterrada, y además `sidechaincompress` colgó el mux una vez. Lo que quedó en
producción es nivel **fijo**: 0.38 bajo la voz, 0.9 en la intro con rampa,
`amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.97`.

**La regla:** música bajo voz continua = nivel fijo a ~-20 dB bajo la voz (validado por
el dueño y coincidente con la práctica de industria), no ducking dinámico.

**Y el flag de una línea que explica «se escucha todo muy bajo»:** el default de `amix`
es `normalize=true`, o sea que ffmpeg **divide** cada entrada. Medido: mezclando 3
pistas la voz sale a -25,8 dB; con `normalize=0`, a -16,3 dB; sola, -21,1 dB.
`normalize=0` no es opcional.

## La música no es un problema técnico

Generar una pista cuesta US$0,03. Poder usarla en el anuncio pago de un cliente es otra
cosa:

- **Mubert está descartado, textual:** su licencia de suscripción excluye «any
  advertisement purposes… published within paid media space» y «visual branded
  content». Y prohíbe el patrón entero: «You can not use Remixes within any mobile app
  or any computer software».
- **Uppbeat / Artlist / Pixabay** son licencias por-creador: prohíben redistribuir el
  archivo, que es exactamente lo que hace un SaaS al entregar el render.
- **La vía limpia es Partner API con sublicencia** (Epidemic Sound, Soundstripe,
  Storyblocks — sus partners publicados son Pictory, Lumen5, Descript, WeVideo). El
  modelo se puede contratar. **Ninguna publica precio**: todas son «Contact sales», y
  el tier gratis de Epidemic dice «Prototyping only — you cannot go live on this plan».
- **fal.ai permite el patrón SaaS pero no lo respalda:** «does not represent, warrant,
  or covenant that any Output Content will be original, will not infringe rights of any
  third party». Sin indemnización el riesgo queda entero en MaKo.
- **Lyria no tiene capa gratuita** (Free Tier «Not available»), y el plan gratis de
  ElevenLabs es **no comercial** por contrato.

**La regla que queda:** si el usuario sube la pista, MaKo es una herramienta de edición
y el riesgo es de quien subió el archivo. Si MaKo genera o sirve la pista, MaKo es la
fuente y el riesgo es de MaKo. Esa línea no se cruza sin contrato firmado, y los emails
de licenciamiento se mandan **antes** de escribir código de música, no después.

**Y hay una promesa rota hoy:** `public/cono-doc/musica-efectos.json:1` apunta a
«Recurso propio: cientos de pistas sin copyright» en `/academy/resources/audio`, y
**`app/academy` no existe en el repo**.

## El realismo se pierde en el PROMPT, no en el render

El C5 por defecto del método 6C **pide** «direct harsh iPhone flash» y «Use high
contrast when appropriate» (`app/conocimientos/curso-ugc-recursos.ts:38`). O sea: si un
clip sale con demasiado contraste y demasiado flash, lo más probable es que el método lo
haya pedido. Arreglar eso en post es pelear contra píxeles ya quemados.

**El antídoto ya está en el repo, del mismo curso, y es para el mismo escenario** (un
avatar hablando dentro de un auto) — `public/cono-doc/trends-virales.json:1`:

> «Natural iPhone photo with soft ambient daylight, **no dramatic flash, low contrast,
> muted tones**, slight grain, authentic smartphone exposure, realistic shadows, candid
> UGC vibe.»

**La regla:** antes de escribir una capa de post, mirar el prompt. El C5 tiene dos
variantes (alto contraste para podcast/voz-en-off, bajo contraste para auto/interior) y
elegir la equivocada es el error más caro porque no se puede deshacer.

**El reparto.** En el prompt va lo que el render no puede inventar: piel con poros (C6,
constante pura), dirección y dureza de la luz, encuadre descentrado, **rolling shutter y
autofocus hunting** (no hay filtro de ffmpeg para eso: solo prompt), y el negative
prompt. En el post va lo que el modelo no hace estable: grano temporal
(`noise=alls=10:allf=t+u`), bajar contraste (`eq=contrast=0.92:saturation=0.94` —
defaults son 1), rango dinámico corto (`colorlevels` output points), quitar filo
(`unsharp=3:3:-0.35`, negativo desenfoca), deriva de exposición
(`eq=brightness='0.012*sin(2*PI*t/6)':eval=frame`), temblor (`crop` con `sin(t)`,
se evalúa por frame), viñeteo suave (`vignette=PI/9`; el default PI/5 ya es mucho) y
compresión (`-crf 26`). Lo único que va en los dos lados es el grano.

**Orden, y no es un detalle:** degradado primero, subtítulos al final, **en la misma
pasada**. Si los quemás antes, el grano y la compresión se comen el texto; si hacés dos
pasadas, tirás calidad dos veces.

⚠️ **No copiar las recetas «TikTok» de internet.** La más citada hace `contrast=1.06` y
`unsharp=...:0.6` — **sube** contraste y **sube** nitidez, o sea empeora exactamente las
dos quejas típicas del material generado.

**El otro ajuste de realismo del curso no es color:** acelerar los clips hablados entre
**1.12 y 1.20** («la IA genera clips hablados en los que la persona habla bastante
lento»). Automatizable con `setpts`/`atempo`.

⚠️ **Trampa: los valores numéricos de la «capa de realismo» de AvatarHype NO están en el
repo.** El instructor los muestra en pantalla y no los dice
(`public/cono-tx/1ijpP-JkLljTnlNUTilZN41FbybgE_BX-.json`). Buscarlos en el material
replicado es tiempo perdido: hay que abrir el video o medir un antes/después del
ejemplo del curso.

## Los medidores de emoción no sirven para escribir un prompt

Para copiar cómo se mueve una persona en un video de referencia, la tentación es una
herramienta de análisis facial. **No sirve ninguna, y la razón es estructural:**
MorphCast y MediaPipe devuelven **números** (`Happy: 0.71`, `yaw` en radianes,
blendshape `mouthSmileLeft: 0.42`) y **Veo no consume números** — su guía oficial pide
palabras: «a subtle nod, fingers tapping impatiently, eyes blinking slowly».

Además, MorphCast **no da landmarks** (cero apariciones en toda su doc), la pose está
topeada a ±27°, y cuesta **US$199/mes mínimo** (no tiene tier gratis comercial).
Claude no acepta video en absoluto (solo JPEG/PNG/GIF/WebP, y del GIF solo el primer
frame).

**Lo que sí sirve: Gemini con video nativo**, pidiéndole el esquema de prompt de Veo
(Subject / Action / Scene / Camera angles / Camera motion / Ambiance / Dialogue /
negative) como JSON tipado, no prosa libre.

**Y el fierro ya está puesto:** `lib/archivo-a-texto.ts:96` ya recibe video del usuario y
ya se lo manda a Gemini — **pero le pide solo la transcripción, y el canal visual se
tira**. La feature es una segunda pregunta sobre bytes que ya se están subiendo
(`lib/ai-cheap.ts:539` ya llama al endpoint nativo con `inline_data`;
`lib/formatos-archivo.ts:46` ya tiene la lista de contenedores correcta).

⚠️ **Gemini muestrea el video a 1 FPS.** Un parpadeo o un gesto de mano dura menos que
eso. La mitigación es de la propia doc: ralentizar el clip antes de subirlo. No hay
parámetro para subir el muestreo; `media_resolution` baja el costo, no sube los frames.

**La regla que queda, y es de privacidad, no de contrato:** el análisis de video del
cliente **NO puede ir por `credWs`**. En el free tier de Google «human reviewers may
read, annotate, and process your API input and output» y el contenido se usa para
entrenar; en el pago, no. Subir la cara y la voz de un cliente de Mauricio al free tier
es regalar biometría de un tercero. Esta feature fuerza cuenta paga de plataforma.

## Transcribir es TEXTO, generar voz es MEDIOS

La pregunta aparece cada vez que se toca audio, así que queda escrita. **STT cae del
lado texto**, por tres razones del propio `modelo.ts`:

1. La taxonomía ya lo puso ahí: `:441` — `{ id: 'stt', grupo: 'Conversar', … }`.
2. La definición de medio es otra: `:363` — «`medio: true` = compra píxeles».
3. La asimetría es deliberada: *generar* voz es Medios a US$0,045 (`:482`), *escuchar*
   voz es Conversar a US$0,00067 (`:441`). **67× y grupos distintos, a propósito.**

Y la prohibición de `:619` se apoya en fal.ai y Replicate, que **no son proveedores de
STT**. La alineación forzada cae del mismo lado por la misma regla: mide un audio, no lo
genera.

⚠️ **Tensión abierta, todavía no incidente:** ElevenLabs —proveedor de MEDIOS— ya está
publicado como campo BYOK por workspace (`lib/integraciones-catalogo.ts:37`) y el
tutorial invita a su plan gratis (`lib/metodo-catalogo.ts:427`), que por contrato es
**no comercial**. No estalló porque nada consume esa key salvo el ping de verificación.
**El día que se escriba `lib/elevenlabs.ts`, hay que sacar o gatear ese campo.**

## Deuda: la receta de audio de producción no está en el repo

Los scripts de ensamblado ffmpeg que produjeron el VSL viven en
`C:/Users/marti/OneDrive/Escritorio/MaKo-VSL/` y en `scratchpad/anim/`. La cadena de
audio validada por el dueño solo existe **transcripta en un log de chat**
(`docs/chats/chat-mako-landing-page-4d6acb52.md:4033`). Si se pierde esa carpeta, se
pierde la receta.

## No verificado (de esta corrida)

- **Precio de `/v1/forced-alignment`** de ElevenLabs y si consume el mismo pool que
  TTS/STS.
- **La «Music Commercial Rights table» de ElevenLabs.** Su FAQ dice que el uso comercial
  self-serve está permitido salvo cine/TV, pero la tabla que gobierna eso no se pudo
  recuperar. Es *la* pregunta que decide si existe una vía barata de música: hay que
  pedirla por escrito.
- **Si Lyria está en los Generative AI Indemnified Services de Google.** Sería la única
  vía con indemnización del proveedor. La búsqueda sugiere que no; el texto no se leyó.
- **Precios de las vías con sublicencia**: Epidemic Scale, Soundstripe, Storyblocks,
  Loudly, Mubert custom. Ninguna publica número.
- **Si Groq tiene cláusula de no-comercial en su free tier.** Es el chequeo que faltó
  antes de apoyar subtítulos de anuncios pagos en una key gratis.
- **Si los word timestamps del audio ORIGINAL sirven sobre el audio post-STS.** Hay 0 ms
  de desfase mediano medido por correlación cruzada, pero no palabra por palabra.
- **Si el filtro `whisper` de ffmpeg da granularidad por PALABRA.** Este build lo trae
  (`--enable-whisper`) y escupe SRT sin salir a ninguna API, pero las opciones expuestas
  son `model/language/format/max_len/vad_*` y la salida documentada es por segmento.
- **La ruta serverless.** ffmpeg full pesa 194,7 MB de los 250 MB del bundle estándar de
  Vercel; «large functions» (5 GB) existe pero **no está verificado que permita spawnear
  un binario nativo**; el body tope de 4,5 MB obliga a que el video vaya por storage; y
  los 43,2 s por 100 s son de una laptop, no de 1 vCPU contra el techo de 800 s.
- **El fps de salida de Flow/Veo** (hipótesis sin fuente: 24 se lee como cine, 30 como
  celular).
- **La calidad real de Gemini describiendo gestos.** Todo lo de arriba es capacidad
  documentada, no medida. Test barato: un clip de 30 s, dos corridas (normal y 0,5x),
  comparar contra lo que se ve.

---

## Nunca referencies IA con IA: la grilla no es el ancla de identidad

Generando la imagen base del avatar de un cliente, el modelo devolvió **otra persona**:
cara distinta, cámara equivocada, y a veces reproduciendo la propia grilla de referencia.
Tres intentos fallidos con tres prompts distintos.

**La causa no estaba en el prompt.** Se le estaban pasando dos referencias: la foto real
del cliente **y el character sheet 3×3**, que es una imagen *generada*. La grilla ya es
una interpretación de la foto; pedirle al modelo que interprete esa interpretación
compone la deriva de las dos. Lo detectó el usuario, no la herramienta: sacó la grilla,
dejó solo la foto real, y salió bien a la primera.

**La regla:** la fuente de identidad es siempre una **foto real** de la persona. El
character sheet es un refuerzo opcional para ángulos que la foto no muestra — nunca el
ancla. Y en general: **menos referencias es mejor**; dos imágenes reales le ganan a cinco
mezcladas.

**El error de prompt que lo acompañaba, y que también cuesta identidad:** describir la
cara con palabras («hombre de unos 55, pelo gris corto, lentes de marco fino»). Esa
descripción **compite** con la imagen de referencia y el modelo prefiere el texto,
devolviendo a alguien que cumple la descripción sin ser la persona. El propio 6C lo dice
y es fácil de violar sin darse cuenta (`app/conocimientos/curso-ugc-recursos.ts:38`, C1):
*«Do not invent hidden traits that cannot be observed»* y *«Preserve the visible identity
and facial characteristics when a reference image is supplied»*.

**El reparto correcto: el texto describe la ESCENA y la CÁMARA; la foto define la CARA.**
Y la cámara hay que describirla con precisión — «selfie con el brazo estirado» y «visto
desde el asiento del acompañante» son tomas opuestas, y si no se dice, el modelo elige la
que no es.

**Para el producto:** cualquier flujo que encadene generación sobre generación (grilla →
escena → variantes → clip) acumula deriva de identidad en cada salto. El diseño correcto
ancla **cada** salto en el material real del cliente, no en la salida anterior.

---

## Leer gestos con Gemini: sirve el PERFIL de la persona, no la dirección por toma

Probado con un video real de 108 s (selfie en auto), Gemini 3.1 Pro vía File API. Cuesta
~9,9k tokens de video por 108 s — barato como para correrlo sobre un catálogo entero.
La salida es texto en inglés utilizable literal en un prompt de Veo: nada de puntajes de
emoción, nada de números.

**Pero solo el 25-30% de lo que devuelve es específico de esa persona.** El resto es
deducible del guion y un humano lo escribe gratis: «apunta abajo en el CTA», «niega con la
cabeza en *se cancela*», «cejas arriba en la apertura».

**Y la parte por-toma directamente no es confiable.** Tres descripciones independientes
del **mismo segundo** del **mismo video**:

- corrida 1: *"right hand chops downward with pinched fingers"*
- verificación a ojo sobre el frame: **las dos manos abiertas**
- corrida 2: *"loose fist with the index finger slightly extended"*

Fiabilidad test-retest de los beats: **cero**. Peor, arrastran errores de lateralidad
(«mano derecha» donde hay dos manos) que meterían al avatar en un gesto que la persona
nunca hizo.

**Lo que SÍ replica entre corridas independientes es la lista de manías.** Esa es la única
capa con información. En este caso, tres frases, y las tres sobrevivieron a corridas
separadas:

1. chop simétrico de **dos manos, palma contra palma, aterrizando en la sílaba tónica**
   — lo único que un humano no puede deducir del guion, porque es ritmo y no significado;
2. pinza pulgar-índice sacudida frente al pecho para el dato crítico;
3. posición base: manos altas, a la altura del pecho, enmarcando, casi todo el tiempo.

**La regla:** el extractor de gestos es **por persona y una sola vez**, corrido sobre
varios videos, quedándose solo con lo que aparece en más de uno. No es un paso por clip.
Y exigir **dos ocurrencias con timestamp** por manía es el control que se paga solo: fue
lo que mató la única manía alucinada de la prueba (un pulgar sobre el hombro que no
existe).

**Sacar del pedido:** `shoulders` (inverificable en encuadre de selfie, relleno
garantizado) y la plantilla de N partes del cuerpo en una oración, que obliga al modelo a
llenar casilleros vacíos. Un `visibility` autodeclarado no alcanza: en la prueba, 4 de 8
momentos decían *"hands partly in frame or blurred"* y describían los dedos igual.

**Ralentizar el video a 0.5x: NO sirve, y la razón vale más que el resultado.** Dio cero
gestos nuevos, costó 45% más tokens, rompió los timestamps (los devuelve en tiempo del
archivo lento, hasta 43 s de corrimiento) y encima inventó una manía que la pasada normal
no había inventado. **El 0.5x agrega resolución temporal a un problema que es espacial:**
el motion blur y las manos fuera del borde están horneados en cada frame; ver el doble de
frames borrosos no desborrona ninguno. Ralentizar sirve cuando el gesto pasa *entre* dos
muestras, no cuando está movido o fuera de cuadro.

**Lo que NO se midió, y hunde la mitad del caso:** nadie metió esas tres frases en Veo
para ver si las obedece. Todo el experimento mide fidelidad de la *descripción*, no si el
avatar se mueve más como la persona. Antes de construir el proceso: un A/B de dos
generaciones, misma línea, una con el bloque de manías y otra sin. **Si Veo no obedece
«chop de dos manos en la sílaba tónica», el proceso vale cero por más exacta que sea la
extracción.**

**Y el cuello de botella es el MATERIAL, no el prompt.** El video de prueba es un selfie
con las manos entrando y saliendo de cuadro. Un video con las manos enteras y buena luz
rinde más que diez iteraciones de prompt sobre material malo.

---

## El guion trae el registro de donde se transcribió

Después de clonar la voz, ajustar `stability` y probar tres clones distintos, el avatar
seguía sonando a lectura. La causa no estaba en ninguna de esas capas: **estaba en el
texto**.

El guion se había transcripto del anuncio ya publicado del cliente. Ese anuncio es su
registro **actuado**: oraciones cerradas, sin muletillas, sin conectores de habla. Se le
estaba pidiendo a Veo que leyera texto de anuncio y después nos quejábamos de que sonaba
a anuncio.

**Medido sobre 1.710 palabras de habla natural de la misma persona** (notas de voz de
WhatsApp) contra su anuncio:

| | en su anuncio | hablando normal |
|---|---|---|
| «pues» | 0 | 18 (1 cada 95 palabras) |
| «entonces» | 0 | 14 (1 cada 122) |
| «¿no?» de cierre | 0 | frecuente |
| «este» | 0 | 7 |

**Y la firma melódica, que es lo que la gente oye como «su cantito»:** el tono le pica
más de 3 semitonos sobre su mediana **en el conector que abre la frase**, no en la palabra
importante — «entonces» pica el 82% de las veces que lo dice, «y» el 72%. Arranca arriba y
desciende a lo largo de la oración.

Eso tiene una consecuencia de diseño que no es obvia: **si el guion no tiene conectores,
el modelo no tiene dónde levantar el tono.** Un texto de frases que empiezan por el sujeto
fuerza una entonación plana por construcción, sin importar qué voz le pongas encima.

**La regla:** para que un avatar suene a la persona, el guion se escribe con su habla, no
con su prosa. Y si la fuente del guion es material actuado (un anuncio, una conferencia),
hay que reinyectar los marcadores desde material conversacional del mismo hablante.

**Densidad:** el doble de su frecuencia natural funciona para un anuncio corto — hay que
notarlo. Más que eso lee como parodia.

**Corolario sobre el orden de ataque:** timbre, `stability` y prosodia del clon son las
tres últimas capas. El texto es la primera. Cuando algo suena a IA, revisar el guion
**antes** de tocar el clonador.

**Ojo con la conclusión que esto corrige.** Una transcripción verbatim del anuncio dio
cero muletillas y de ahí se concluyó que «el cliente habla así de limpio». Era cierto del
anuncio y falso de la persona. **Cuando midas un rasgo de habla, mirá material
conversacional, no material publicado.**

---

## El énfasis es CONTRASTE: medir variación global es medir lo que no es

Queja del usuario sobre el avatar: «no tiene agudos para enfatizar». La medición decía lo
contrario — la salida tenía **más** variación de tono que la persona real (7,06 semitonos
de desvío contra 4,70). Los dos tenían razón, y el error era de la métrica.

**La variación global no es énfasis.** Un énfasis es un **pico local**: una palabra que
sobresale de sus vecinas inmediatas. Medido como cuánto excede cada palabra la mediana de
las 4 que la rodean:

| | palabras con pico >4 st | >6 st |
|---|---|---|
| **la persona real** | **9,5%** | 6,7% |
| la entrada generada por Veo | 18,7% | 10,7% |
| la salida por speech-to-speech | 22,7% | 14,7% |

**Sobraba énfasis, no faltaba.** Una de cada cuatro palabras subía, así que ninguna
sobresalía. Él sube en una de cada diez y por eso se le nota. *El énfasis necesita una
base plana contra la cual destacarse.*

**Y el origen no era el clonador: era el prompt.** Se le había escrito dirección de
actuación a los 12 clips —*«landing hard and flat»*, *«lifting his pitch on»*, *«starting
high on the opening word»*—. Pedir énfasis en todos los clips es no pedirlo en ninguno.

**`stability` no es la palanca.** Barrido completo midiendo picos locales: 0,00 → 22,7%;
0,35 → 27,3%; 0,60 → 19,7%; 0,85 → 20,8%. Ninguno baja del doble del objetivo.
`similarity_boost` a 1,0 da 23,7% y `style` 0,2 da 25% — los dos peores. (Esto corrige a su
vez una recomendación previa de «stability en 0.0», que se apoyaba en la variación global.)

## LA PALANCA ERA EL REGISTRO DEL CLON, y el diagnóstico obvio estaba equivocado

Con el barrido agotado se concluyó que el exceso de énfasis entraba con la voz de Veo y que
ninguna palanca de la voz podía arreglarlo. **Era falso.** El usuario pidió volver al primer
clon —el hecho con **97 s del anuncio publicado**, descartado antes por venir comprimido a
61 kbps— y clavó las dos métricas:

| clon | fuente | tono | picos >4 st |
|---|---|---|---|
| objetivo (la persona) | — | 139 Hz | **9,5%** |
| celular, 11 min limpios | él conversando | 105 Hz | 20,1% |
| **anuncio, 97 s a 61 kbps** | **él actuando** | **137 Hz** | **10,9%** |

**El clon del anuncio BAJA el énfasis de la entrada** (18,7% → 10,9%), o sea que sí había
palanca del lado de la voz: no era un ajuste, era **de qué material se clonó**.

**La regla, y es contraintuitiva: para clonar una voz, el REGISTRO del material importa más
que su duración y más que su calidad técnica.** 97 segundos recomprimidos de la persona
*actuando* le ganaron a 11 minutos limpios de la persona *conversando*. Si el destino es un
anuncio, hay que clonar de anuncios; pedir «dos minutos hablando natural» produce un clon
que suena a alguien contando algo, no a alguien vendiendo.

**Lo que esto invalida de este mismo documento:** la idea de que el audio comprimido de Meta
era el techo del clon, y el pedido de «2 minutos de celular» como la mejora que más movía la
aguja. El celular da mejor señal y peor registro, y el registro pesó más.

**Cómo detectarlo sin oído:** dos números por corrida — tono mediano y porcentaje de palabras
con pico local >4 semitonos — contra los mismos dos de la persona real. Si el tono está 30 Hz
abajo, el clon salió de material conversacional.

**Aparte, un gotcha de STS:** el desfase de labios no es determinista. Tres corridas idénticas
sobre el mismo audio: dos con un tramo corrido 290-310 ms en el mismo punto (68 s), la tercera
limpia (máximo 10 ms). **Verificar por correlación cruzada y repetir la corrida si aparece un
tramo malo** — sale más barato que diagnosticarlo.

---

Corrida de 4 agentes, 2026-08-22: automatizar Google Flow con useapi.net para uso
interno (Martín + Mauricio), cruzando los dos cursos con la doc de useapi y el
estado del arte abierto de lip-sync / face swap.

## El diagnóstico obvio era el equivocado: esto no es más barato que HeyGen

La intuición —«nos salimos de HeyGen y ahorramos»— **da al revés**. HeyGen por API
cuesta **US$1 por minuto** de avatar estándar
(https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained). Flow
vía useapi con el plan Pro da **1.000 créditos/mes ÷ 20 créditos por generación de
8 s = 50 clips = 6,67 minutos de video al mes**
(https://useapi.net/docs/api-google-flow-v1/post-google-flow-videos). Con los US$15
de useapi eso es **US$2,25 por minuto**, con techo duro mensual.

> ⚠️ **Ese número está MAL y se corrige más abajo** — ver «Lo que el corpus tenía MAL
> (2)». Los 1.000 créditos son de TU cuenta de Google, no de useapi: los US$15 compran
> el transporte, no los créditos. La conclusión de la sección (esto no se justifica por
> ahorro) **sigue siendo cierta** y por eso la sección queda; lo que no vale es la
> aritmética que la sostenía.

Peor: casi todas las alternativas de lip-sync por API están entre US$3 y US$7 el
minuto (sync lipsync-2 US$3/min, OmniHuman 1.5 US$0,12/s = US$7,20/min).

**Regla que queda:** este proyecto **no se justifica por ahorro**. El Norte se
escribe como **«avatar que se MUEVE con voz propia»**, no como «HeyGen propio». Lo
dice el propio curso: «*puedo andar, puedo saludarte, puedo dar una vuelta, puedo
rascarme el ojo mientras hablo*» (`public/cono-tx/13A0RAHz8Rly5guwRVYpP9DkyPeqK3U_r.json:1`).
Y al revés, SIM reconoce que **en lip-sync HeyGen gana**
(`public/cono-tx/1bCgf1a7pC3ojQTwFUyab8enlU-L-R6xH.json:1`). Consecuencia de diseño:
priorizar clips de acción sobre planos parlantes fijos. En plano parlante fijo no
compitas: ya está resuelto y mejor.

## La consistencia entre clips es estructural, no un prompt mejor

**Síntoma:** la identidad del avatar deriva entre clip y clip y se intenta arreglar
adjuntando más fotos de referencia o insistiendo en el prompt.

**Causa real:** Veo acepta **hasta 3 imágenes de referencia** y clips de **máximo
8 segundos** (https://ai.google.dev/gemini-api/docs/veo). La deriva es una propiedad
del modelo, no un bug del prompt. Los dos cursos convergen en la misma solución
mecánica: **el último frame de un clip es el primero del siguiente**.

> AvatarHype: «cada uno de los vídeos que generan luego el anuncio completo **es una
> transición animada entre dos de las imágenes consecutivas**»
> (`public/cono-tx/1eeOFpwumZ869pa5wjMy1owhfEwSIqLVT.json:1`)
> SIM: «podéis meter un star frame y un end frame… **vuestro video gira en torno a
> esas dos fotos**» (`public/cono-tx/1rIlEGbkhAMSMb74SiFTjEPvo1VhwN3Nv.json:1`)

**Y la API lo expone:** modo **I2V-FL**, parámetros `startImage` + `endImage`, ambos
`mediaGenerationId`, **solo Veo**
(https://useapi.net/docs/api-google-flow-v1/post-google-flow-videos).

**Regla que queda:** el planificador produce **N+1 imágenes y N clips**, con
`clip[i].startFrame = img[i]` y `clip[i].endFrame = img[i+1]`. La primitiva del
wrapper no es `generarVideo(prompt)`, es
`generarClip({startImage, endImage, prompt, model, aspectRatio})`.

## Flow es el recurso escaso: gastarlo solo donde el avatar habla

**Síntoma:** los créditos de Flow se agotan a mitad de mes.

**Causa real:** los planos de corte y el B-roll consumen la misma cuota que los
clips hablados, y ahí Flow no aporta nada. La regla del curso está escrita:
«Avatar hablando → Omni / **Avatar sin hablar → Grok**… planos recurso y B-roll»
(`public/cono-doc/creativos-ugc-realistas__catalogo-modelos-ia.json:1`).

**Aritmética:** 50 generaciones/mes por cuenta ÷ 8 clips por anuncio de 60 s =
**6 anuncios/mes por cuenta**. Con `veo-3.1-lite` (10 créditos) son 100 videos/mes.

**Regla que queda:** router determinista en el generador —
`if (clip.guion === '') → proveedor barato; else → Flow`. Y `lite` para iterar,
`fast` solo para la toma final. El contador de créditos se lee de
**`remainingCredits`, que viene en cada respuesta de `POST /videos`**: el saldo es
observable por API, no hace falta scraping (lo contrario del problema de Anthropic).

## La API de Flow tiene cuatro trampas que rompen silencioso

Todo de https://useapi.net/docs/api-google-flow-v1/

1. **Una respuesta exitosa puede venir SIN `videoUrl`.** Textual: «*A missing URL
   means 'not yet', not 'failed'*». Se auto-resuelve re-consultando dentro de 24 h,
   con gap mínimo de 60 s. Si `status == completed` y falta la URL, **no marcar la
   fila como fallida**: reencolar. Es el mismo modo de falla del pipeline de
   reuniones.
2. **Las URLs son firmadas con `Expires`** y **los jobs se retienen 7 días** (después
   `GET /jobs/{id}` da 410). Descargar el mp4 a Supabase en el mismo tick del
   callback. Nunca guardar la `videoUrl` como permanente.
3. **`aspectRatio` no acepta `'9:16'`** — hay que mandar el literal `'portrait'` o da
   400. Y **`duration` 4/6 son Ultra-only en Veo**: con AI Pro el único valor válido
   en Veo es **8**. Para clips cortos, `omni-flash` (4/6/8/10) o recortar con ffmpeg.
4. **Las imágenes de referencia se suben aparte**, como **binario crudo** en el body
   de `POST /assets/{email}` (no multipart, no base64, no FormData → 400), y lo que
   se pasa a `POST /videos` es el `mediaGenerationId` devuelto.

**Regla que queda:** todo el parseo de respuestas en **una sola función validada con
zod**. El 15/06/2026 movieron `body.error.code` a `body.response.error.code` sin
aviso, y el 11/05/2026 retiraron el modelo `veo-3.1-fast-relaxed` entero
(https://useapi.net/docs/changelog). Un cambio de forma tiene que fallar ruidoso en
un lugar, no propagar `undefined`.

## Avatar y máxima calidad no coexisten en Veo

**Síntoma esperable:** pedir `model: 'veo-3.1-quality'` con un character y recibir
`400 Model 'veo-3.1-quality' does not support R2V mode`.

**Causa real:** la tabla de compatibilidad de
https://useapi.net/docs/api-google-flow-v1/post-google-flow-characters —
Veo 3.1 Fast/Lite soporta characters **solo a 8 s**, Omni Flash soporta todas las
duraciones, y **Veo 3.1 Quality no los soporta en absoluto**.

**Regla que queda:** el camino a calidad con avatar es **Fast + `POST /videos/upscale`
a 1080p, que cuesta 0 créditos** y tarda 30-60 s
(https://useapi.net/docs/api-google-flow-v1/post-google-flow-videos-upscale). El
upscale a 1080p es paso **obligatorio y automático** al final de toda generación: es
gratis. El 4K cuesta 50 créditos y exige Ultra — no exponerlo.

## La cuenta de Google conectada a useapi queda QUEMADA para uso humano

**Síntoma futuro:** error **596 «Session refresh failed»** y todo el pipeline muerto,
sin causa aparente.

**Causa real:** entrar a esa cuenta por cualquier otra vía —AI Studio, la UI de Flow
en el navegador, login manual— **invalida las cookies** que useapi está usando
(https://useapi.net/docs/start-here/setup-google-flow).

Precondiciones del setup que si no se cumplen rompen la sesión: **Gmail dedicada**
(no personal), **2FA con Google Authenticator** marcando «Don't ask again on this
device», navegador **Opera / Brave / Ungoogled Chromium (NO Chrome)**, cookies
limpias antes y después, y las cookies se copian de **`accounts.google.com`**, no de
labs.google.

**Lo bueno:** useapi refresca la sesión solo, 1 hora antes de expirar. **No construir
un cron propio de refresco de cookies.** Lo que sí hay que construir es la detección
del 596 → aviso a Martín, porque exige re-pegar cookies a mano.

**Regla que queda:** nadie abre esa cuenta «solo para mirar». Es el único paso manual
del pipeline y el que va a costar horas de debug si alguien la toca.

## El campo minado de licencias del lip-sync: Wav2Lip contagia

**Síntoma:** adoptar un repo con licencia limpia y quedar igualmente en no-comercial.

**Causa real:** **Wav2Lip es explícitamente no comercial** («*This repository can only
be used for personal/research/non-commercial purposes*»,
https://github.com/Rudrabha/Wav2Lip) y viene embebido en medio ecosistema: SadTalker
lo usa aunque el repo pasó a Apache 2.0, FaceFusion lo lista. Lo mismo con
**inswapper_128** (roop, ReActor — https://github.com/deepinsight/insightface) y con
**CodeFormer** (NTU S-Lab 1.0). **FaceFusion dejó de ser MIT** en 2025 (OpenRAIL-AS,
https://docs.facefusion.io/introduction/licenses). Los autores de Wav2Lip fundaron
Sync Labs: el open source es el embudo de su producto pago.

**Regla que queda:** antes de meter cualquier repo de video generativo,
`grep -rE 'wav2lip|s3fd|syncnet|inswapper|codeformer'`. Si aparece, o se reemplaza el
módulo o el pipeline entero queda no-comercial por contagio. Combinación limpia:
**GHOST 2.0** (Apache 2.0, head swap one-shot), **LatentSync** (código Apache 2.0,
pesos openrail++ — no es lo mismo), **GFPGAN / RestoreFormer** (Apache 2.0) y
**Real-ESRGAN** (BSD-3). **LivePortrait es MIT pero hay que reemplazar los detectores
de InsightFace** por YuNet o 2DFAN4 antes de usarlo.

## El techo de hardware decide qué corre en casa

Medido con `nvidia-smi` el 21/08/2026 en la máquina de Martín:
**NVIDIA GeForce RTX 4060 Laptop GPU, 8.188 MiB, driver 610.88**.

Entran en 8 GB: **LatentSync 1.5** (8 GB), **MuseTalk 1.5** (MIT y comercial, pero
cara a 256×256 y «*identity details (mustache, lip features) not fully preserved*»),
**LivePortrait** (~15 ms/frame en 4090).
No entran: **LatentSync 1.6** (18 GB, el que arregla la borrosidad, entrenado a
512×512), **EchoMimicV3** (12-24 GB), **Wan2.2-Animate** (80 GB oficial).

**Regla que queda:** 8 GB es el filtro de entrada. Todo lo demás va a **RunPod
(4090 community US$0,34/h)** o a **fal**. Y hay antecedente en este proyecto de que
la GPU híbrida de esta máquina tumba procesos: cargarla con difusión de video por
horas no es gratis.

## El pipeline de montaje tiene cinco parámetros medidos que no estamos aplicando

**Causa real:** están escritos en el curso con números exactos y el montador por
ffmpeg los deja al ojo o directamente no los hace.

| Qué | Valor | Fuente |
|---|---|---|
| Acelerar el habla | 1,12–1,20 hablado / 1,20–1,30 animado | `public/cono-tx/1ijpP-JkLljTnlNUTilZN41FbybgE_BX-.json:1`; `app/conocimientos/curso.ts:210` |
| Mezcla | música −25/−30 dB, SFX −8, voz +5, crossfade 0,5–0,7 s | `app/conocimientos/curso.ts:210` |
| Capa de realismo | temp −3, tinte 2, sat −6, exp −3, contraste 12, highlight −35, sombra 18, fade 6 | `app/conocimientos/curso.ts:145` |
| L-cut / J-cut | audio desfasado 3-5 frames en **cada** empalme, con fade | `public/cono-tx/1pqlY_y-7wZIq9Et-wEEUURwbJ6NeLwRm.json:1` |
| Rótulo persistente | texto fijo durante todo el video | `public/cono-tx/1DIV4ZogCOwwC1HngfLP7MoANDF1Af77m.json:1` |

**Orden que importa:** acelerar va **antes** del reemplazo de voz con ElevenLabs STS,
no después.

**Regla que queda:** son constantes del montador, no criterio del editor. Y el
rótulo es el de mejor relación esfuerzo/resultado: un `drawtext`, alimentado por el
campo que El Estratega ya emite por clip.

## El avatar perfecto es el que delata: la imperfección es invariante, no palanca

**Síntoma:** un avatar impecable que igual «canta a IA».

**Causa real** (solo AvatarHype la explica; SIM converge sin dar el porqué):
«*por muy realista que sea la imagen de referencia que tú le estás dando, **el modelo
añade una pequeña capa de textura en la piel**, que por muy sutil que sea, está ahí*»
(`public/cono-tx/1oy9q2O1pWpIhCQfBzbcb-MOV5HLG9Q0V.json:1`). Esa capa se **suma** a lo
que le mandaste: si la base ya era perfecta, el resultado queda de plástico.

Corolario del mismo eje, contraintuitivo y medido: **la expresividad alta delata**.
SIM baja el dial al mínimo siempre — «*he probado con normal y high, y exagera un
montón e incluso a veces da hasta miedo*»
(`public/cono-tx/1bCgf1a7pC3ojQTwFUyab8enlU-L-R6xH.json:1`). Y **ningún dial de
parecido va al máximo**: en Omni Reference (0-1000) el punto útil es **300-600**; a
1000 se bloquea la pose de la referencia y hasta cambia el tono de piel
(`public/cono-tx/1ekN3TjDwU5vfhZeBLBxRX00TM-zmeaa8.json:1`).

**Regla que queda:** el banco de identidad se construye **deliberadamente imperfecto**
(poros, asimetría, tono desigual, ojeras leves) y la actuación se adjetiva **hacia
abajo** por defecto (`calm`, `restrained`, `subtle`); la energía alta es opt-in del
guion. Ningún parámetro de parecido se clava al máximo: se barren 3 valores en el
primer lote de cada avatar y el ganador se guarda en la ficha.

## Flow no reemplaza a ElevenLabs, y su propia doc lo dice

`POST /voices` **no acepta subir audio de referencia** — textual: «*Reference Audio
Upload: **Not supported.** This API does not accept custom audio uploads*»
(https://useapi.net/docs/api-google-flow-v1/post-google-flow-voices). Solo genera
voces derivadas de 30 presets del sistema a partir de texto.

**Regla que queda:** el orden del pipeline es fijo —
**Flow genera con voz preset → ElevenLabs STS pisa la voz → ffmpeg re-muxea.**
Y aunque la voz se reemplace, **el bloque ACENTO sigue siendo obligatorio en el
prompt de video** (el STS conserva la entonación del clip original, así que la boca
tiene que estar articulando el idioma correcto), mientras que **el bloque VOZ
—edad, género— deja de hacer falta**
(`public/cono-tx/13A0RAHz8Rly5guwRVYpP9DkyPeqK3U_r.json:1`). Es una regla de código de
una línea que evita re-renders caros. Elegir el preset de timbre más parecido al del
cliente para que el STS tenga menos trabajo.

## Automatizar Flow con Playwright está descartado

El proyecto open source más maduro del rubro (**FlowKit**, MIT, 602★,
https://github.com/crisng95/flowkit) **descartó Playwright/Puppeteer explícitamente**
y eligió una extensión Chrome MV3 como puente, porque Flow exige **tokens reCAPTCHA
v3 Enterprise en cada llamada**.

⚠️ **CORREGIDO el 25/08/2026 leyendo el código de FlowKit.** Este párrafo decía que
hacerlo nosotros «implicaría igualmente pagar un proveedor de captcha (US$0,80-3,00 por
1.000 resoluciones)». **Es falso: no hay proveedor que pagar.** La extensión ejecuta
`grecaptcha.enterprise.execute()` en la propia página, con la sesión del usuario — es el
mecanismo, no una evasión. Lo que sí cuesta es mantener un Chrome vivo, y los US$15/mes
de useapi compran exactamente eso. El detalle completo, con la auditoría de la extensión y
la línea que NO hay que cruzar (el simulador de actividad humana), está más abajo en
«Replicar useapi: qué hace de verdad».

Y descartar también kie.ai / PiAPI / Apiframe para este objetivo: **no son wrappers de
Flow**, son revendedores de la API oficial de Veo, y por eso **les faltan
`characters`, `extend`, ingredients y el upscale gratis**. Sirven si algún día se
ofrece generación de video al público de MaKo, no para replicar HeyGen.

## No existe API oficial de Flow: diseñar para degradar

`labs.google/fx/tools/flow` dirige a los desarrolladores a **Vertex AI y la Gemini
API**, no a una API pública de Flow. Toda esta vía es **no oficial por construcción**.

**Regla que queda:** el cliente vive detrás de una interfaz propia `generarVideo()`
para que, si useapi cae o Google cierra el agujero, se cambie **una implementación y
no todo el pipeline**. Y **nunca omitir el parámetro `email`**: con Martín y Mauricio
en cuentas separadas hay que aislar las cuotas por workspace, o el video de un
cliente se come los créditos del otro (omitirlo activa load balancing automático).

## El 401 de ElevenLabs dice «key» y significa «factura impaga»

**Síntoma (22/08/2026):** `GET /v1/voices` responde 200 y lista las cinco voces
clonadas; `GET /v1/user/subscription` devuelve **401**. Leído así, el diagnóstico
obvio es una API key con permisos acotados — que es exactamente lo que se concluyó
primero, y es falso.

**Causa real:** la suscripción tiene un pago fallido. El cuerpo lo dice, pero recién
en la llamada que importa:

```json
{"detail":{"type":"payment_required","code":"payment_issue",
 "message":"Your subscription has a failed or incomplete payment.
 Complete the latest invoice to continue usage."}}
```

**Lo que lo vuelve caro** y es lo único que hay que recordar: **crear un clon SÍ
funciona (`POST /v1/voices/add` → 200), convertir NO.** Un preflight que valide la
credencial listando voces, o creando una voz de prueba, da verde sobre una cuenta
que no puede generar un solo segundo de audio. La capacidad de escritura de metadatos
y la de consumir cuota son dos permisos distintos y sólo una está cortada.

**Regla que queda:** el preflight de un proveedor tiene que ejercitar **la operación
que se va a usar**, no una barata del mismo dominio. Es la misma regla que
`remitenteEsSandbox()` en `AGENTS.md` — chequear otra función y creerte cubierto — y
acá el costo es un pipeline que aborta después de generar los clips, que es la parte
que cuesta créditos.

**Vive en:** `C:/Users/marti/OneDrive/Escritorio/Mauricio/VOZ/` (producción a mano;
todavía no hay cliente de ElevenLabs en el repo).

## El guion no se deduce: sale del audio del cliente contando ESE contenido

**Lo que se venía haciendo:** medir las muletillas del cliente en material
conversacional y **reinyectarlas por función** en un guion escrito en prosa. Funciona
—es la lección «Los marcadores van por función, no por cuota»— pero es una
reconstrucción.

**Lo que apareció el 22/08:** Mauricio grabó cinco notas de voz contando **los mismos
guiones**, en registro de anuncio y con CTA. Con eso el guion se **transcribe**, no se
deduce. De un solo audio de 197 palabras salieron, textuales:

| Del audio | Lo reemplaza |
|---|---|
| «pues ahí la llevamos» | «solo falta un detalle» |
| «ponerlo ahí con un garrote» | «el gerente más exigente del mundo» a secas |
| «Y esa es la trampa» | «Pero ahí está la trampa» |
| «Dale click aquí abajo» | «Da click en el enlace» |
| «Mira» ×2, «a ver» ×1 | marcadores que había que elegir por función |

Ninguna se podía inventar. «Ponerlo ahí con un garrote» es la mejor línea del guion y
no sale de ninguna lista de muletillas.

**Regla que queda:** antes de escribir un guion para un avatar, pedir **una nota de
voz del cliente contando ese guion**. No para usarla como pista —eso rompe el lip-sync
gratis— sino como fuente del texto. Cambia el pedido de «grabame dos minutos hablando»
a «contame este anuncio como se lo contarías a un cliente», que además produce material
de clonación en el registro correcto. Un pedido, dos usos.

**Vive en:** `Mauricio/VOZ/audios-22ago/`, `Mauricio/GUION-03.md`.

## Un medidor de F0 propio no es comparable con el número histórico

**Síntoma:** se midió el tono mediano de material nuevo para decidir si servía para
clonar, y salió **152 Hz** sobre el archivo de referencia — el mismo del que la
medición previa había reportado **139 Hz**. El porcentaje de picos de énfasis dio
**1,4%** donde el histórico decía **9,5%**.

**Causa real:** no hay un «tono mediano» absoluto. El número depende del umbral de
energía que separa habla de pausa, del rango de búsqueda, del tamaño de ventana y del
umbral de correlación. El de picos depende además de cómo se define «vecindario». Dos
implementaciones razonables dan números distintos sobre el mismo audio, y ninguna está
mal.

**Lo que lo salva, y es barato:** medir **en la misma corrida y con el mismo
instrumento** los materiales de referencia cuyo veredicto ya se conoce. Acá alcanzó con
agregar el clon que gana y el que pierde:

| | F0 | picos |
|---|---|---|
| Referencia (anuncio Meta 97 s) | 152 Hz | 1,4 % |
| Clon que **gana** | 139 Hz | 2,6 % |
| Clon del celular, que **pierde** | 119 Hz | 8,1 % |
| Material nuevo (3 audios) | 134-142 Hz | 1,3-3,2 % |

Con la escala completa el veredicto es inmediato aunque los números no coincidan con
los viejos: el material nuevo cae en la banda del que gana. Sin los controles, 136 Hz
no significa nada.

**Regla que queda:** un número comparado contra otro medido con **otro código** no es
una comparación. Cuando se reimplemente una métrica, la corrida incluye los casos
conocidos como control, y el veredicto se lee en **relativo**. Es la contracara de «las
trampas de medición»: ahí la métrica medía lo que no importaba; acá mide bien y el
punto de comparación es el que no vale.

## Dos audios con hash distinto pueden ser el mismo audio

**Síntoma:** en un lote de seis notas de voz, dos tenían la misma duración **al
microsegundo** (78,058667 s) y el mismo bitrate. `md5sum` las declaró distintas, así
que se tomaron como dos materiales.

**Causa real:** eran el mismo contenido re-encodeado o con metadatos distintos. La
transcripción salió **idéntica palabra por palabra**. El hash detecta archivos iguales,
no contenidos iguales — y en audio esa diferencia es la regla, no la excepción.

**Y el otro lado del mismo lote:** **el nombre del archivo miente.** `Avenida Berlín
56.m4a` no era una dirección: era el guion completo de «Todos dijeron que sí». El
nombre había quedado de otra nota de voz. Un lote que se procesa por nombre habría
tirado ese archivo o lo habría archivado en el tema equivocado.

**Regla que queda:** en un lote de audio, la identidad de una pieza es **su
transcripción**, no su hash ni su nombre. Transcribir primero cuesta centavos con Groq
y es lo que ordena el lote. Duración idéntica al microsegundo con hashes distintos es
la firma del duplicado re-encodeado.

## `drawtext` de ffmpeg entrega el alfa PREMULTIPLICADO

**Síntoma:** un PNG de texto blanco sobre fondo transparente, generado con
`drawtext` sobre `color=black@0.0`, muestra un halo gris oscuro alrededor de cada letra
al componerlo sobre cualquier fondo que no sea negro.

**Causa real:** los píxeles de borde salen con el color **multiplicado por su propio
alfa**. Medido sobre 17.514 píxeles de antialiasing: `color === alfa` **exacto** en
todos (ratio 1,0000 en p05, mediana y p95). Es alfa premultiplicado, y casi todos los
compositores esperan no premultiplicado.

**El arreglo, que es exacto y no aproximado:** forzar el color a blanco puro dejando el
canal alfa **intacto**. En premultiplicado eso ES la conversión a no-premultiplicado: el
texto no engorda ni adelgaza un píxel.

**Y la regla hermana, que vale para todo PNG con alfa:** poner el color también en los
píxeles con `alfa = 0`. Dejarlos negros produce borde oscuro al escalar, porque el
interpolador promedia el color de píxeles invisibles.

**Cómo verificarlo en 10 líneas:** volcar a `rawvideo rgba` y mirar el ratio
`color/alfa` de los píxeles con alfa parcial. Si es ~1,0 en todo el rango, está
premultiplicado.

**Vive en:** producción a mano; el scratchpad de la sesión. Si el montador de MaKo
quema texto, va acá.

## Composición e identidad se resuelven en DOS pasos, no en uno

El hallazgo que destrabó la producción del cuarto anuncio, y lo encontró el cliente
después de que el método fallara seis veces seguidas.

**Lo que no funciona:** pedirle al modelo la escena completa —fondo correcto, pose
correcta Y la cara de esta persona— en un solo prompt. Cuanto más se describe la
escena, menos pesa la foto de referencia; y cuanto más se describe la cara, más
compite con ella. Las dos mitades se pelean por la misma atención y ninguna sale bien.

**El orden que sí funciona:**

1. **Imagen, resolviendo SOLO composición.** Que el fondo sea el correcto y que el
   personaje esté en el lugar y la pose correctos — **da igual si no se parece o si es
   otra persona**. Ese es el punto: la identidad no se toca todavía.
2. **Recién ahí, reemplazar el personaje** pasando una foto real de la persona y
   pidiendo que sustituya al que está. **Siempre la misma foto**, en todas las
   escenas: por eso el avatar sale idéntico entre clips sin ningún esfuerzo de
   consistencia.
3. **Y recién ahí, el video.**

**Corolario que ahorra tandas enteras: todo cambio va en la IMAGEN, nunca en el
video.** Si la foto tiene un objeto que estorba —una taza en la mano— se quita antes de
generar. Corregirlo en video obliga al modelo a inventar la corrección cuadro a cuadro.

**Y la parte que invalida lo anterior:** describir el aspecto con palabras es lo que
ROMPÍA el parecido. Durante seis versiones se defendió un bloque de contra-deriva
(«rounder jaw with a slight double chin, never square…») como corrección medida. Con la
identidad resuelta por la imagen, ese texto la sobreescribe. **No se describe la cara.
Nunca.** Es la regla de oro del método llevada a su conclusión.

**Vive en:** `Mauricio/GUION-04-oficina-plano-secuencia.md`.

## El fondo NO aluciona con la cámara en movimiento — la regla del auto no generaliza

**Lo que decía el método:** *«solo estos dos bloques de cámara, cualquier movimiento
hace alucinar el fondo»*.

**Lo que se midió:** un clip de 10 s con la cámara retrocediendo por una oficina, sin un
solo corte detectado ni a umbral 0,2, y el open space coherente de punta a punta. Y ocho
clips más después, todos con movimiento, ninguno con el fondo hervido.

**Por qué la regla vieja decía lo contrario:** se midió **dentro de un auto** — espacio
chico, fondo corriendo por la ventanilla, el peor caso posible. En un espacio amplio con
luz pareja, aguanta.

**La regla que queda:** una restricción medida en un caso extremo no es una ley del
modelo. Antes de aceptarla como límite, hay que preguntarse **en qué condiciones se
midió** y si el caso nuevo se parece. Costó seis versiones de guion diseñadas alrededor
de una prohibición que no aplicaba.

## Con acción física, la densidad baja de 3 a 2,1 palabras por segundo

**Medido:** 21 palabras en un clip de 10 s donde además estrecha la mano de un colega =
**2,10 p/s**, sin tartamudeo y con las 21 palabras dichas.

La regla de **3 p/s** vale para un clip donde habla de punta a punta. Cuando el clip
lleva una acción física adentro —caminar, saludar, servirse un café— **la acción ocupa
tiempo que el modelo no rellena con voz**, y la densidad real cae a ~2 p/s.

**Consecuencia práctica:** un clip con acción admite **un tercio menos de texto** que
uno estático de la misma duración. Y al revés — es la forma de llenar 10 s sin escribir
más guion: se escribe la acción, no más palabras. Pero **la acción hay que escribirla en
el prompt**: si no, el modelo rellena repitiendo sílabas.

## La receta del ambiente NO es una constante: se calibra por pieza

**Lo que dice el método:** filtrar el crudo por debajo de 120 Hz y mezclarlo con
**ganancia 1,6**.

**Lo que pasó en una oficina:** la ganancia óptima fue **3,2-4,0**, y en dos clips ni
siquiera alcanzó el objetivo con el techo del barrido.

**La causa:** la ganancia 1,6 se calibró contra un auto en movimiento, donde el crudo
tenía **16,9 dB** de caída habla/huecos porque el motor suena todo el tiempo. Una
oficina tranquila da **32-36 dB**: casi no hay fondo que devolver, así que hay que
amplificar mucho más lo poco que hay.

**La regla:** la ganancia se **barre** contra la caída del crudo de ESA pieza, no se
copia. Y el número a igualar es la caída del crudo, que también cambia.

**Y el corolario que evita aplicar la receta donde no va:** el STS suprimió acá **6 dB**
de ambiente (de ~35 a ~41), contra los **16 dB** del auto. La corrección sigue valiendo,
pero conviene medir los tres valores —crudo, STS puro, mezcla— antes de dar por hecho
que hace falta.

## TTS y STS del mismo clon se pueden mezclar en un montaje

**El problema:** en un anuncio con clips donde la persona habla y clips mudos con voz en
off, los primeros salen por **speech-to-speech** (hay audio de entrada) y los segundos
por **text-to-speech** (no lo hay). Son dos motores distintos: el STS copia la prosodia
del audio de entrada, el TTS la inventa.

**Medido sobre el mismo clon:** STS 114-133 Hz, TTS 118-131 Hz. **Misma banda.** En el
montaje no hay salto audible al pasar de un tipo de clip al otro.

**Pero la voz en off tiene que ENTRAR en el clip, y eso hay que medirlo antes de
montar.** Un texto de 26 palabras dio **10,22 s** de TTS para un clip de **8 s**: no
entra, y no hay forma de arreglarlo en el montaje. Se recorta el texto y se regenera —
son centavos. La velocidad del TTS de este clon es ~2,55 p/s, o sea **~20 palabras por
cada 8 s** de clip.

## «Gracias por ver el video» es la confirmación de que un clip está MUDO

Ya estaba documentado que el transcriptor alucina sobre audio sin habla («¡Hipo!»,
«Teresa», «Gracias»). Lo que no estaba dicho es que eso **sirve como verificación
positiva**.

En un anuncio con clips que deben quedar mudos a propósito, hay que confirmar que
efectivamente lo estén antes de montarles la voz en off encima. Transcribir los ocho
clips devolvió texto real en cinco y **«Gracias por ver el video» en dos de los tres
mudos**. Esa alucinación no es ruido: es la firma de que ahí no habla nadie.

Es más barato y más confiable que mirar los clips: una llamada al transcriptor contra
ocho archivos y el mapa queda hecho.

---

Corrida del 25/08/2026: construir el Video Generator, con el pedido de presentar los
formatos **«a la carta»** para que el cliente elija cómo quiere su video.

## «Formato» significaba DOS cosas, y estaban mezcladas en un solo catálogo

**Síntoma:** el pedido era «que la persona elija el formato», y el repo ya tenía un
catálogo llamado `BIBLIOTECA_ANGULOS` cuyo comentario dice *«un ÁNGULO = el FORMATO del
creativo»*. Parecía cubierto y no lo estaba.

**Causa real:** son **dos ejes ortogonales** con el mismo nombre.

| | Qué contesta | Ejemplos |
|---|---|---|
| `lib/angulos-data.ts` (ya existía) | **QUÉ se cuenta** — el eje de marketing | Comparación, Hook de problema, Mini-VSL |
| `lib/puestas-data.ts` (nuevo) | **CÓMO se filma** — el eje de producción | Podcast, Plano secuencia, Voz en off |

Elegir «Hook de problema» no dice si se filma en un auto o caminando por una oficina. El
creativo es el **cruce** de los dos, y lo que faltaba era el segundo entero.

**Regla que queda:** los ejes **conviven, no se fusionan**. `angulos-data.ts` no se tocó
—tiene cuatro consumidores vivos y uno es `MatrizView`, que las dos cuentas tocan a la vez
y ya rompió el build en prod el 16/08. Y cuando un catálogo «parece cubrir» un pedido,
comparar lo que CONTESTA cada uno antes que sus nombres.

## Los dos formatos que mejor funcionan no estaban en ningún catálogo

**Plano secuencia** (recorrer un espacio) y **Selfie en movimiento** salieron de producir
los cuatro anuncios a mano, y vivían solo en los `.md` de
`C:/Users/marti/OneDrive/Escritorio/Mauricio/`. Ninguno de los siete formatos del curso
los describe.

El de la oficina ya estaba completamente especificado en `GUION-04` y **es una receta
reutilizable, no un guion suelto**: 8 clips, ritmo `H O H O H O H H`, en los clips de voz
en off el avatar sigue en cuadro, lo que se ve no ilustra la frase, y **no necesita
generar ninguna imagen**.

**Regla que queda:** cuando una producción manual funciona, sus **parámetros** son el
entregable —ritmo, densidad, cámara, si pide imágenes previas—, no el guion. Un guion se
usa una vez; los parámetros se usan siempre.

**Y el campo `confianza` no es decoración:** `medido` = salió de producir un anuncio real
y contarlo; `curso` = lo dice AvatarHype y nadie lo verificó acá. La tabla de créditos de
Flow que decía el curso estaba mal por 2x, así que la distinción se paga sola.

## Una puesta con piso alto NO puede entregar la duración que se le pide

**Síntoma:** elegir Plano secuencia + «30 segundos» devolvía un anuncio de 56 s sin decir
nada.

**Causa real:** el piso de esa puesta son 7 clips de 8 s. Ninguna aritmética de reparto
baja de ahí, y el selector ofrecía 30 igual.

**Regla que queda:** cuando un catálogo impone un mínimo estructural, la pantalla muestra
**lo que realmente va a salir**, no lo que se pidió, y avisa cuando difieren. Es el mismo
modo de falla que «un verde que cierra la pregunta sobre algo que se está perdiendo».
`duracionReal()` en `app/video-generator/video-pedido.ts`, con un test que la ata a lo que
reparte el motor: si se separan, el aviso mentiría.

## La densidad se MIDE, no se le pide al modelo

El tope de palabras por clip es LA regla de este formato —pasarse hace que el modelo corte
la frase o acelere— y estaba solo en la prosa del prompt. Ahora `sanearPlan` cuenta las
palabras de cada clip y la tarjeta muestra «21 palabras, entran 18» en ámbar.

No se recorta el texto: cortar una frase a la mitad es peor que un clip largo. Se marca y
se pide rehacer **ese** clip, no todo el plan.

**Detalle que importa:** `contarPalabras` saca los asteriscos del énfasis. Sin eso,
`**palabra**` contaba como tres y el aviso saltaba sobre texto que sí entraba.

**Y dónde vive la función importa tanto como qué hace:** `contarPalabras` y
`repartirDuracion` están en `puestas-data.ts` (sin `server-only`) y `video-planner.ts` las
re-exporta. Adentro del módulo con `server-only` ningún test las puede importar, que es el
mismo criterio de `exigirClienteDePrueba`.

## La voz de MaKo se filtra al guion DEL CLIENTE, y la regla ya estaba escrita en otro writer

**Síntoma:** el primer plan que generó la tab, para un cliente **norteño de México**, salió
así: *«el cuello de botella **sos vos**»*, *«**¿y vos qué vas a hacer?**»*, *«**Tocá** el
botón abajo y **completá** el formulario»*, y los siete prompts de video pedían
`Argentine (Rioplatense) accent`.

**Causa real:** `brandSystem()` antepone `getActivePersona()` —la voz de MaKo, que es
rioplatense— a **todo** prompt que lo use. Eso está bien para lo que MaKo le dice a Martín,
y está mal para lo que MaKo escribe **para** el cliente.

**Y lo que lo vuelve caro: la prohibición ya existía, textual, en otro writer.**
`lib/campaign-structurer.ts:83` dice desde antes:

> «IDIOMA DEL COPY (IMPORTANTE): el texto de los anuncios es para la AUDIENCIA del cliente,
> que es de MÉXICO […] NUNCA "vos / tenés / querés / podés / mirá / che". Tu voz rioplatense
> va SOLO en el "rationale" […] JAMÁS en los textos del anuncio.»

Es el patrón que `AGENTS.md` llama por su nombre: **una regla aplicada en un lugar de dos no
está implementada, está documentada.** El writer nuevo nació sin ella y nada avisó.

**Regla que queda:** todo prompt que pase por `brandSystem()` y produzca texto que va a leer
o decir el CLIENTE lleva su bloque de idioma explícito. La pregunta al escribir un writer
nuevo no es «¿qué le pido al modelo?» sino **«¿de quién es la voz de lo que sale?»**.

**Y la segunda capa, porque el prompt solo no alcanza:** `marcasDeVoseo()` en
`lib/puestas-data.ts` mide la salida y la pantalla marca el clip en ámbar. No corrige el
texto —reemplazar formas verbales a mano rompe la prosodia que el guion venía a cuidar—:
avisa y se pide rehacer.

**El acento pasó a ser un CAMPO, no un default.** No se puede adivinar y equivocarlo ya
costó seis versiones de guion en este proyecto. El texto de cada opción viaja literal al
prompt de video (`ACENTOS` en `app/video-generator/video-pedido.ts`).

## `\b` de JavaScript es ASCII: un detector de español pierde todo lo acentuado

**Síntoma:** el detector de voseo encontraba `vos`, `sos`, `sabés` y `podés`, y **no**
encontraba `Tocá el botón`. Cero coincidencias, sin error.

**Causa real:** `\b` en JS se define sobre `[A-Za-z0-9_]` **incluso con el flag `u`**. En
`tocá`, entre la `á` y el espacio no hay borde de palabra, porque `á` no es un carácter de
palabra ASCII. Las formas que terminan en `s` funcionaban (`podés`, `tenés`) y por eso el
detector parecía andar.

**Lo que se escapaba es justo lo que más aparece:** los imperativos —`tocá`, `andá`,
`mandá`, `dejá`, `mirá`, `escuchá`— que son la forma de todo CTA.

**Regla que queda:** en cualquier regex sobre español, los límites de palabra van por
Unicode: `(?<!\p{L})(…)(?!\p{L})` con flag `u`, nunca `\b`. Y el test que lo caza tiene que
incluir **una palabra terminada en vocal acentuada**: con solo probar las que terminan en
`s`, el bug pasa verde.

## Un formato se elige VIENDO, no leyendo — y la primera pantalla se rehízo entera

**Síntoma:** la primera versión del Video Generator puso las **ocho** puestas en escena
como tarjetas —nombre, descripción, cuándo usarlo, tres chips— todas a la vez, al lado del
formulario del pedido. El dueño la rechazó de una: *«se ve horrible todo junto, la
experiencia del usuario es 0»*.

**Causa real, y es de diseño, no de estilo:** describir un formato de video con texto es
pedirle a alguien que imagine el resultado. Los cuatro anuncios ya estaban producidos —el
material para mostrarlo existía desde hacía dos días— y la pantalla igual explicaba con
párrafos.

**Las tres reglas que quedan:**

1. **El ejemplo es el anuncio real, no la descripción.** Diez segundos en loop contestan
   «cómo se ve» mejor que cualquier texto, y de paso prueban que el formato existe.
2. **Solo se ofrece lo que tiene ejemplo.** El campo `ejemplo` de la ficha es lo que
   habilita a una puesta a aparecer (`puestasOfrecidas()`); el catálogo entero sigue vivo
   porque el motor sabe planificar las ocho y porque es el orden de trabajo de lo que falta
   producir. Hoy se ofrecen **dos**. Se suman de a una, cuando hay un anuncio nuevo que
   mostrar. Ofrecer un formato que nadie produjo es prometer sin haber medido.
3. **Una pregunta por pantalla.** El molde ya existía en el repo (`WizardShell` fullscreen
   embebido, el de los onboardings de tab) y no se usó. Son cuatro pasos: formato → tema →
   duración → acento.

**El costo del ejemplo es despreciable y conviene tenerlo escrito:** 10 s recortados del
anuncio original (2160×3840 a 24 Mbps) escalados a 360×640 con `-crf 30 -preset slow` y sin
audio dan **entre 310 y 380 KB**, más un poster de ~25 KB. Van en `public/formatos/`. Sin
audio a propósito: lo que se juzga al elegir es cómo se mueve la cámara, y `muted` +
`playsInline` es lo que el navegador exige para dejar autoplay.

**El test que lo sostiene** verifica contra el disco que el video y el poster de cada
ejemplo existan. Una ruta que apunta a la nada no rompe nada: deja un cuadro negro donde
tenía que estar el ejemplo.

## El acento no lo transporta el modelo: lo pone el código

**Síntoma:** con el campo de acento ya cableado y el prompt pidiéndolo, se eligió
**México — norteño** y los **siete** clips salieron con
`Spoken in neutral Latin American Spanish`.

**Causa real:** no lo parafraseó — lo **ignoró**. El valor pedido
(`Mexican Spanish with a northern (norteño) accent`) no aparece en ninguna parte de la
salida. Es la regla de `AGENTS.md` sobre datos exactos, aplicada a un campo que no parece
un id: *si tiene que llegar intacto, no lo transporta el modelo*.

**Regla que queda:** el prompt le dice al modelo que escriba el guion en esa variedad y que
**NO escriba el acento** en el prompt de video; `conAcento()` lo agrega al final de cada
clip con el texto literal del catálogo.

**Y borra el que haya escrito el modelo, no solo agrega el nuestro.** Dos frases de acento
contradictorias en el mismo prompt son peor que una equivocada: el modelo de video elige una
y no hay forma de saber cuál. La limpieza cubre las tres formas con que cierra el prompt —
`Spoken in X.`, `Spoken naturally with an X accent.`, `Accent: X.`

**Cómo se detecta, que es lo que más ahorra:** no se mira si el prompt «tiene acento», se
busca **el string exacto que se pidió**. Un prompt con un acento plausible adentro pasa
cualquier revisión a ojo — y era el equivocado en los siete clips.

## El mismo texto dos veces, y el detalle de producción abierto en la pantalla de aprobar

**Síntoma:** con el wizard ya rehecho, el dueño rechazó la pantalla del PLAN con lo mismo:
*«Aún se ve increíblemente complejo y lleno de texto»*. Medida: **3.107 px** de alto para un
anuncio de 7 clips.

**Dos causas, y las dos son de contenido, no de estilo.**

**1. El guion estaba escrito dos veces en la misma pantalla.** Arriba iba `deCorrido` —el
texto seguido— y abajo el mismo texto partido clip por clip. Ninguna de las dos versiones
era «de más» mirada sola; juntas eran el doble de palabras. Las filas dicen lo mismo MÁS
dónde corta cada clip, así que el de corrido es el que sobra. (El botón «Copiar todo» sigue
entregando el guion seguido: es lo que hacía falta de él.)

**2. El prompt en inglés estaba abierto en los siete clips a la vez.** Seis líneas de
inglés técnico por clip, en monospace, en la pantalla donde lo único que se hace es leer el
guion y decidir si gusta.

**La regla que queda, y vale para cualquier pantalla de aprobar:** separar **lo que se
juzga** de **lo que se ejecuta**. El guion se juzga; el prompt, la cámara y la acción se
ejecutan después, frente al generador de video, de a un clip por vez. Lo segundo va cerrado
y se abre solo. El botón de copiar el prompt vive afuera —no hace falta abrir para copiar—,
que es lo que hace que cerrarlo no cueste nada.

**Resultado medido: 3.107 px → 1.008 px** con la misma información disponible.

**Y el detalle que se leía como un error:** el modelo marca el énfasis con `**markdown**`
—porque es la instrucción que mejor obedece, y el énfasis importa: es la palabra que el
avatar levanta— y la pantalla lo pintaba literal, con los asteriscos a la vista. Se
renderiza en negrita en la UI y se deja **crudo en el prompt**, que es donde el modelo de
video sí los tiene que leer.

## La corrección que valía más que las otras dos: el cliente NUNCA ve un prompt

**Tres rechazos seguidos de la misma pantalla, y los dos primeros arreglaron el síntoma
equivocado.** Vale escrito el orden completo, porque es el patrón:

| # | Lo que dijo el dueño | Lo que arreglé | ¿Era eso? |
|---|---|---|---|
| 1 | «Se ve horrible todo junto, la UX es 0» | 8 formatos de texto → 2 con video, wizard de 4 pasos | Parcial |
| 2 | «Aún se ve complejo y lleno de texto» | Saqué el guion duplicado y cerré los prompts | Parcial |
| 3 | «No tiene sentido que entre y vea prompts y guiones. **Jamás debe ver prompts.** Lo PRIMERO tiene que ser el CATÁLOGO» | La lógica entera | **Sí** |

**La causa real, y es de producto:** yo había construido la herramienta que YO usaba para
producir los cuatro anuncios a mano —plan de clips, prompts, indicaciones de cámara— y le
había puesto una pantalla encima. Pero el cliente no produce nada: compró que MaKo le haga
el anuncio. **El prompt es cómo se fabrica el video, del mismo orden que la query SQL detrás
de una tabla.** Mostrárselo no es transparencia, es filtrar la implementación.

Las dos primeras correcciones bajaron el ruido de esa pantalla equivocada — de 3.107 px a
1.008 — sin tocar la premisa. Por eso volvió.

**Las dos reglas que quedan:**

1. **El prompt no sale a pantalla, nunca.** Se genera, se guarda y lo consume la producción.
   `guionATexto()` es lo que copia el cliente —solo lo que se dice, sin cámara, sin acción,
   sin inglés— y `planATexto()` queda para producir, sin call-site en la UI. Con test que
   falla si se filtra una palabra del prompt al guion.
2. **La home de una tab es donde se EMPIEZA, no lo último que se hizo.** Se entra a crear un
   anuncio nuevo, así que lo primero es el catálogo de plantillas; lo ya hecho va abajo. Se
   estaba abriendo en el último plan porque «ya hay algo que mostrar», que es razonar desde
   el dato y no desde para qué entra la persona.

**Y la pregunta que me habría ahorrado los tres intentos:** antes de diseñar la pantalla,
*¿qué compró el que la abre?* Si la respuesta es «que se lo hagan», todo lo que se parezca a
una instrucción para que lo haga él está de más — por prolijo que se vea.

## Dos trampas de esta pantalla que el compilador no ve

**`<Icon>` con un nombre que no existe dibuja un PUNTO.** Está tipado `name: string` (sin
unión) y resuelve `PATHS[name] ?? PATHS.dot`, así que `arrow-left` —que no está en el set—
compila, pasa el typecheck y pinta un puntito gris donde iba una flecha. Antes de usar un
ícono, verificar que la clave exista en `app/_components/icons.tsx`.

**Un `<button>` dentro de otro `<button>` es un error de HIDRATACIÓN, no de estilo.** La
tarjeta de plantilla era clickeable entera y adentro tenía un `<Button>` de «Usar esta
plantilla»: React lo reporta como *hydration mismatch* con la lista genérica de causas
(`Date.now()`, locale, extensiones del navegador) y ninguna es la real — la real está en la
última línea, «Invalid HTML tag nesting». Si la tarjeta entera ya es el botón, lo de adentro
es un `<span>` estilado.

**Y un `{/* comentario */}` dentro de una prop-expresión rompe el parseo** (`Expected '</',
got 'ident'`). Ahí el comentario va como `//` de JavaScript, arriba de la prop. Lo peor del
caso: el typecheck había pasado **antes** de ese edit, así que la pantalla quedó en 500 con
el tsc en verde. **Correr el typecheck después de CADA edit, no al final de la tanda.**

## Un guion listo no es un anuncio, y por eso no va en la portada

**Síntoma:** la home listaba «Tus anuncios» con los guiones generados y un chip «Guion
listo». El dueño: *«Que un guion esté listo no significa que tiene que salir allí abajo. Sí
deberían salir "Tus anuncios" pero cuando ya haya VIDEOS creados... y lo haremos en otra
tab, así que no lo pongas allí.»*

**Causa real:** el guion es un **paso intermedio** del proceso, no el entregable. Llamar
«Tus anuncios» a una lista de guiones promete algo que todavía no existe, y la primera vez
que alguien haga click esperando un video se va a encontrar con texto.

**Regla que queda:** una lista se nombra por lo que la persona **recibe**, no por la fila
que hay en la base. Si el nombre correcto todavía no aplica, la lista no va.

**Y dónde SÍ va lo intermedio:** adentro del proceso que lo produce. Los guiones ya escritos
viven en el primer paso del wizard —el del tema—, que es el momento exacto en que sirven:
estás por escribir de qué habla el anuncio y quizá ya escribiste uno sobre eso. En la
portada no servían para nada, porque ahí se viene a empezar.

## La tarjeta se SELECCIONA; el botón que dispara es uno solo

Cada tarjeta tenía su «Usar esta plantilla», así que había tantas formas de empezar como
plantillas y ninguna se leía como la principal. El dueño pidió volver al patrón anterior:
click = marco azul + tilde, y **un** botón arriba.

**Regla que queda:** en una grilla de opciones, la tarjeta cambia el ESTADO y la acción vive
afuera, una sola vez. Un botón por tarjeta convierte cada opción en un disparador y hace
imposible mostrar la acción apagada mientras no hay nada elegido — que es lo que le dice a
alguien que primero tiene que elegir.

**Detalle que no es detalle:** nada nace preseleccionado. Con una plantilla marcada de
entrada, el marco azul afirma «ya elegiste» sin que nadie haya elegido, y el botón nace
encendido sin decisión detrás.

## El nombre de una plantilla no es su término técnico

«Plano secuencia» y «Selfie en movimiento» describen **cómo se filma**, que es vocabulario
de producción. El dueño los rebautizó **The Office** y **Car Talks**: nombres que se
entienden solos y se recuerdan.

El término técnico no se tira —quien abre el detalle quiere saber cómo se filma, y es la
palabra con la que va a encontrar material afuera—: baja al campo `tecnico` y se muestra
como encabezado del detalle. En la tarjeta va el nombre y nada más; el video ya dice cómo se
ve.

## El detalle es donde el formato se juzga de verdad: con AUDIO

La tarjeta muestra 10 s mudos en loop, que contestan «cómo se mueve». Lo que no contesta es
cómo SUENA, y en un anuncio con avatar la voz es la mitad del producto.

Por eso el detalle («Ver más detalles», o doble click en la tarjeta) abre el **anuncio
entero con audio y controles**, más la descripción, cuándo conviene y los números del
formato. Todo lo que se sacó de la tarjeta vive ahí.

**Costo, medido:** el anuncio completo a 540×960, `-crf 30 -preset slow` con AAC 96k da
**3,5 MB** para 56 s y **6,6 MB** para 92 s. Bajar a 480×854 con CRF 33 ahorra un 40% y se
nota: para el material que PRUEBA el producto, esa es la compresión equivocada.

## Replicar useapi: qué hace de verdad, y las dos cosas que teníamos mal

Análisis del 25/08/2026 sobre `github.com/useapi/google-flow-api`, la doc de setup de
useapi y el código de **FlowKit** (`github.com/crisng95/flowkit`, MIT, 607★, último push
18/08/2026 — vivo).

### El repo que parece la respuesta no la tiene

`useapi/google-flow-api` **no es el código de useapi**: son ejemplos de cliente contra su
API hospedada (`veo-video/`, `images/`, `omni-flash/`, un `prompts.json` y llamadas REST
con un token de useapi). No habla con Google en ninguna línea. Leerlo no dice nada de cómo
funciona por detrás.

### Lo que useapi hace de verdad, según su propia doc de setup

No es una API: es **una sesión de navegador prestada**. Le pedís al usuario que:

- copie **todas las cookies de `accounts.google.com`** desde las DevTools;
- use **Opera, Brave o Ungoogled Chromium** — textual: *«Do NOT use Google Chrome. Google's
  integration with Chrome will interfere with cookie extraction»*;
- active 2FA con Authenticator y marque **«Don't ask again on this device»**;
- y no vuelva a entrar nunca a esa cuenta: *«Using the same account through both the API and
  direct access will break the session and require you to redo this entire setup»*.

Los **US$15/mes no compran capacidad**: los créditos los pone tu propia suscripción de
Google. Compran que ellos mantengan viva esa sesión.

### FlowKit ya es la replicación, es MIT y corre local

Tres piezas: un agente Python (FastAPI + SQLite, puerto 8100), una extensión Chrome MV3, y
un WebSocket entre las dos (`ws://127.0.0.1:9222`).

- **El token** se captura con `chrome.webRequest.onBeforeSendHeaders` sobre
  `aisandbox-pa.googleapis.com` y `labs.google`, tomando el `Authorization: Bearer ya29.…`
  que **la propia página ya manda**. Dura 24-48 h y la extensión lo recaptura sola.
- **El backend real de Flow es `aisandbox-pa.googleapis.com`** (no `labs.google`, que es
  solo la UI). Ese es el dato que faltaba para entender la superficie.
- **Los medios expiran a ~1 h** en el storage de Google: hay que descargar en el mismo tick.

**Auditoría de seguridad de la extensión — limpia en lo que importa:** el `manifest.json`
pide `labs.google/*`, `aisandbox-pa.googleapis.com/*`, `flow-content.google/*` y
`127.0.0.1:8100`. **No pide `accounts.google.com` ni `*.google.com`**, así que no puede
tocar Gmail ni las cookies de sesión global. No tiene `externally_connectable`, así que
ninguna web puede manejarla. Y el token **solo viaja a `127.0.0.1`** — no hay un solo host
remoto que lo reciba, ni carga de código remoto, ni config externa.

### Lo que el corpus tenía MAL (1): no hay bypass de reCAPTCHA, ni proveedor que pagar

Este documento decía que automatizar Flow «implicaría igualmente pagar un proveedor de
captcha (US$0,80–3,00 por 1.000 resoluciones)» y que useapi *«resuelve el reCAPTCHA por vos,
o sea bypassing our protective measures»*.

**Las dos cosas son falsas.** `extension/injected.js` corre en el contexto de la página y
hace:

```js
window.grecaptcha.enterprise.execute('6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV', { action })
```

Es **el mismo widget que la página ya carga**, invocado desde la propia sesión del usuario.
reCAPTCHA v3 Enterprise no plantea un desafío que se «resuelva»: emite un **score de riesgo**
que calcula Google. Nadie lo evade — si tu comportamiento parece automatizado, Google
devuelve `403 PUBLIC_ERROR_UNUSUAL_ACTIVITY` («reCAPTCHA evaluation failed»), que es
justamente el error que FlowKit documenta como **no auto-recuperable**.

Corolario económico: **el captcha no cuesta nada**. Ese renglón sale del presupuesto.

### Lo que el corpus tenía MAL (2): useapi no cuesta US$2,25 por minuto

El cálculo era: «1.000 créditos ÷ 20 por clip de 8 s = 50 clips = 6,67 min ÷ US$15 =
US$2,25/min, contra US$1 de HeyGen». **Está mal atribuido**: esos 1.000 créditos son de TU
plan de Google, no de useapi. Los US$15 son el fee del servicio, y los pagás igual generes 1
clip o 50.

Con FlowKit el costo marginal es **solo tu suscripción de Google**. Los US$15/mes de useapi
son exactamente lo que se ahorra: **US$180/año**, a cambio de mantener un Chrome vivo.

La conclusión de «esto no se justifica por ahorro» **sigue en pie por otro motivo**: el
Norte es «avatar que se MUEVE», no reemplazar HeyGen. Pero el número que la sostenía estaba
mal y no hay que volver a usarlo.

### ⚠️ La línea: FlowKit fabrica actividad humana falsa, y eso SÍ es evasión

`background.js` tiene una función `sendTelemetry()` con este comentario textual:

> *«Periodically send tracking events to Google's analytics endpoints to mimic normal browser
> behavior.»*

Cada 45–120 segundos manda a `/v1:batchLog` y `/v1/flow:batchLogFrontendEvents` eventos
**inventados** —`FLOW_IMAGE_LATENCY`, `GRID_SCROLL_DEPTH`, `FLOW_PROJECT_OPEN`,
`FLOW_SCENE_VIEW`— con latencias y scroll fabricados, y rota el session id cada 25–35
minutos.

**Esa pieza no es «usar el mecanismo»: es fabricar señales para que el antifraude de Google
no detecte la automatización.** Es una cosa distinta de ejecutar el grecaptcha de la propia
página, y conviene no mezclarlas al decidir.

**Y es separable.** Existe para poder ir **más rápido de lo que iría una persona**. El propio
FlowKit documenta los límites que hacen innecesario fingir: **10 s de cooldown** entre
requests, **≤5 concurrentes**, **≥1 s** entre envíos. A ese ritmo no hay nada que disimular,
porque el ritmo ya es humano.

**La regla que queda:** si se replica esto, se replica el transporte —token de la sesión
real, grecaptcha de la página real, ritmo humano— y **no** el simulador de actividad. Un
sistema que necesita mentirle a la detección para funcionar es un sistema que ya sabe que
está haciendo algo que el proveedor no quiere, y el día que lo detecten se cae la cuenta con
todo adentro.

### Lo que NO se puede verificar sin la cuenta abierta

FlowKit afirma que `veo_3_1_i2v_lite_low_priority` es **«the true 0-credit Low Priority»**
para cuentas `PAYGATE_TIER_TWO`, y da una tabla propia (imagen ~0,5 créditos; video i2v
5–10 por clip de 8 s; upscale 4K ~15). **Ninguno de esos números está verificado**, y la
búsqueda pública devuelve cifras que no coinciden entre sí (50 créditos/día gratis para no
suscriptores, ~100/mes en AI Pro).

Es exactamente el caso de la regla que ya está escrita más arriba: **el costo en créditos no
se planifica desde una tabla de internet — se lee en la pantalla de Flow, que lo muestra
antes de generar.** Si el «0 créditos» fuera cierto cambia la economía entera del pipeline,
así que es lo primero que hay que mirar al abrir la cuenta.

### Y lo que no cambia: esto no sirve para el SaaS

FlowKit necesita **un Chrome abierto, con sesión iniciada, en una máquina**. Sirve para uso
interno (Martín + Mauricio, que es el alcance declarado) y **no** para que MaKo le genere
videos a un cliente cualquiera: cada inquilino necesitaría su propia sesión de Google viva,
y los créditos son por cuenta. Para el producto multi-inquilino sigue valiendo lo de siempre
— Vertex/fal con tarifa por segundo, y la tarifa **muda** de Veo, que es la mitad.

**Vive en:** todavía nada en el repo — `lib/flow.ts` no existe. Este análisis es el paso
previo a escribirlo.

## Lo que quedó SIN hacer de esta corrida

- **`lib/flow.ts` no existe todavía.** La tab llega hasta el plan y los prompts; generar
  por useapi es el paso siguiente y sigue gateado por dos bloqueantes que solo puede
  cerrar Martín: la marca de agua de Flow sin verificar y la cuenta Gmail dedicada sin
  abrir.
- **El Image Generator sigue en `ComingSoon`,** y su catálogo «a la carta» ya está
  identificado: las ~12 placas del módulo *Imágenes estáticas* del curso (conversación,
  testimonio, ticket, búsqueda, foro tipo Reddit, comparación, progresión, presupuesto
  tipo Excel, antes/después). Vive en
  `public/cono-tx/15aXb_YhsA0moFYNv0pxK4mVLjYQGWHDQ.json`.
- **El eje ÁNGULO no está cableado a la tab.** `PedidoVideo` ya lleva `anguloId` y el plan
  lo guarda, pero la pantalla todavía no lo ofrece: hoy se elige solo la puesta.
- **Las `reglas` de cada puesta no se muestran en ningún lado.** Viajan al prompt del
  modelo, que es donde más pesan, pero el usuario no las ve.
- **Faltan seis ejemplos en video.** Podcast, Dualcast, Voz en off, UGC con y sin producto y
  Trends virales están en el catálogo y NO se ofrecen, porque nadie produjo un anuncio con
  ellos. Cada uno entra al menú el día que exista el anuncio para mostrar.
- **`docs/guia-produccion-mauricio.md` estaba sin commitear** al empezar esta corrida y se
  dejó donde estaba (puede ser de la otra sesión).

**Vive en:** `lib/puestas-data.ts`, `lib/video-planner.ts`, `app/video-generator/`,
`tests/video-puestas.test.ts`, `lib/model-catalogo.ts` (feature `video-planner`).

## Lo que queda SIN hacer

**Bloqueantes, en orden:**

1. **Verificar si la salida por API trae la marca de agua visible**, y medir sus
   coordenadas. El curso confirma que Flow con plan AI Pro **siempre** la pone
   (`public/cono-tx/1JtIGH79K_OGBizAgRDN00oYATizL0RpH.json:1`) y que a veces cae sobre
   fondo en movimiento, lo que exige inpaint por frames y no un `delogo` de caja fija
   (`public/cono-tx/1UUGtgmmFcx2vuP2yyDDYen5D1TduSad0.json:1`). **Sin resolver esto,
   todo lo que salga de la automatización es inusable como anuncio.** Es distinto de
   SynthID, que es invisible.
2. **Abrir la cuenta Gmail dedicada y leer el saldo de créditos real.** Nadie
   verificó que la promo Jio (18 meses, hasta oct 2026) entregue el tier Pro de 1.000
   créditos/mes y no uno recortado. Si el plan está atado a una cuenta personal que
   Martín usa a diario, **es un bloqueante de arranque**, porque la cuenta queda
   quemada para uso humano.
3. **Probar que `POST /characters` sostiene la identidad de Mauricio** en 3
   generaciones seguidas. La doc promete «*consistent identity*» pero es marketing del
   vendor: cero mediciones.

**El experimento más barato que puede cambiar la arquitectura entera** (US$5, una
hora, se hace hoy sin useapi ni cuenta nueva): pasar **uno de los tres anuncios ya
producidos a mano** por `fal-ai/wan/v2.2-14b/animate/replace` (US$0,04/s a 480p) con
una foto de Mauricio, y por `fal-ai/latentsync` (US$0,005/s = US$0,30/min, **10x más
barato que sync lipsync-2**). Si la corrección de identidad **encima** del video ya
generado funciona, Flow pasa a ser solo un generador de movimiento y encuadre, y toda
la ingeniería de `characters` y reference frames baja de prioridad. Si no funciona,
el híbrido muere. Camino alternativo a «identidad horneada» de verdad: **un LoRA de
Wan 2.2 en fal por US$4** (US$0,004/paso × 1000).

**Ventana de reembolso:** useapi devuelve el 100% dentro de **14 días si hiciste
menos de 50 generaciones exitosas**, y **solo si pagaste con Stripe** (cripto no es
reembolsable). Todo el spike técnico entra ahí.

**Material del curso sin bajar** — es materia prima del generador y hoy dependemos de
una web ajena: la **biblioteca de 86 prompts** (29 imagen + 37 video + 20 formatos, en
el repo solo están los conteos:
`public/cono-doc/creativos-ugc-realistas__biblioteca-prompts.json:1`), los **tres
skills .md** que el curso reparte (`avatarhype-6c-prompt-engine.md`, El Estratega,
Ads Visual Architect) y el **diccionario de ~100 keywords de micro-realismo**
(`C:/cursos/UGC SIM Academy de Mindshft/recursos/01 - Leccion_3_-_100_KEYWORDS_PARA_MEJORAR_TUS_PROMPTS.pdf`).

**Decisión implícita que hay que fijar:** dónde se inserta el STS. AvatarHype lo
aplica **una vez sobre el montaje final** (entonación coherente, pero rehacer un clip
obliga a reconvertir todo); SIM lo aplica **por clip antes de montar** (N llamadas,
pero permite parchear). Nadie lo midió. Medirlo con un anuncio real y dejarlo escrito.

**Sin verificar, ordenado por lo que más duele:** el costo en créditos de `extend` y
`concatenate` (no publicado); cuántas veces se puede encadenar `extend` (la doc dice
explícitamente que no lo especifica); el formato del payload del webhook `replyUrl`
(no hay página que documente el contrato del callback, ni si reintenta, ni si firma);
el límite de concurrencia de **video** (el único número publicado, 3-20, es para
imágenes); si el STS desincroniza labios sobre salidas de la **API** (la medición de
0 ms de desfase fue sobre videos de Flow hechos a mano); si SynthID sobrevive a un
face-swap encima y qué dicen los ToS de Google sobre modificar la salida de Flow; si
**GHOST 2.0 usa ArcFace/InsightFace internamente** (si lo hace, el Apache 2.0 del repo
no alcanza y vuelve la restricción no comercial por la puerta de atrás); y **todos los
precios del curso** — el curso calcula **US$0,0133 por clip de 8 s** contra los
**US$0,20-0,40** que sale de la aritmética publicada de useapi, 15-30x de diferencia.
Ninguno de los dos es dato hasta leer el saldo real: un precio de un curso no es un
precio.

## Publicar la extensión: lo que la Chrome Web Store mira de verdad

Enviada a revisión el 26/08/2026. El id que asigna la tienda —
`gapbemdaaghomjbnggechglkpmbgplle` — sale **al subir el paquete, antes de aprobar**, así
que el link de instalación se puede cablear el mismo día. Lo que no se puede es
mostrarlo: **da 404 hasta que la revisión termina**. Por eso `lib/extension-tienda.ts`
tiene un booleano a mano y no una detección — preguntarle a Google si ya aprobó exige
scrapear su HTML, que se rompe en silencio el día que cambian la página.

**«Gratis» no es «Non-trader».** Fue la duda al llenar el formulario y la respuesta no es
la intuitiva: la declaración de *trader* no pregunta si el ítem se cobra, pregunta si
quien publica actúa **con fines comerciales**. La extensión es la puerta de entrada a un
SaaS que cobra, así que es *trader* aunque la extensión sea gratis y aunque haya plan
free. Declarar *Non-trader* para ahorrarse subir el documento de identidad es declarar
algo falso sobre un dato que la tienda verifica contra la dirección y la factura.

**`injected.js` NO es remote code.** Se inyecta en la página, pero **viaja dentro del
paquete** (`web_accessible_resources`). *Remote code* es JS o WASM que se descarga en
tiempo de ejecución. Contestar «sí» por las dudas abre una revisión de algo que no se
hace y no tiene cómo terminar bien.

**Hay que declarar «Authentication information», y tienta no hacerlo.** La extensión lee
el header `Authorization` que el navegador ya manda a Flow y lo guarda en
`chrome.storage.local`; no lo transmite a ningún lado, ni siquiera a MaKo. Es cierto que
no sale del equipo, y por eso da ganas de marcar «no recolecta nada». **Lo que la
revisión compara es la declaración contra el `manifest.json`**: `webRequest` + un host de
Google + «no recolecto datos» es una contradicción visible en treinta segundos, y hunde
la credibilidad de todo el resto del formulario — incluido lo que sí era cierto.

**Unlisted no es un atajo.** Pasa exactamente la misma revisión que Public; lo único que
cambia es que no aparece en búsquedas. Elegirlo para «evitar la revisión» no evita nada.

**Y el paquete que se sube no es la carpeta de desarrollo.** El `localhost` de
`content_scripts.matches` sirve para probar contra el server local y no tiene ningún uso
para un cliente: un permiso sin uso visible es de los motivos más comunes de rechazo. Se
filtra **al empaquetar** (`scripts/zip-extension.mjs`), nunca a mano — un manifest que hay
que editar antes de cada subida se sube sin editar la vez que hay apuro.

**Lo que queda pendiente del trámite:**

- **Poner `EXTENSION_EN_TIENDA = true`** en `lib/extension-tienda.ts` cuando aprueben. Es
  el único cambio: la pantalla pasa sola de «descargar el zip» a «añadir a Chrome» y el
  instructivo de modo desarrollador desaparece.
- **Si rechazan**, el motivo llega por mail con el ítem concreto del formulario. Casi
  siempre es una justificación de permiso que no explica el *para qué* del usuario: se
  reescribe ese campo y se reenvía, sin resubir el paquete.

⚠️ **Y el link corto `hola-mako.com/extension` NO reparte a gente sin cuenta**, aunque exista
para eso: el redirect manda un 307 y el destino (`/mako-puente.zip`) es un request nuevo que
sí pasa por el gate, así que quien no tenga sesión de MaKo cae en el login. Está **cerrado a
propósito** —se verificó que el zip no lleva secretos y se decidió no abrirlo igual—, y el
`?next` del login entrega el archivo después de entrar, así que sirve para gente CON cuenta,
que es toda la que puede usar la extensión. El detalle, con el comentario falso que lo tapó
durante días, en [hallazgos-infra.md](hallazgos-infra.md) → «El comentario decía que el gate
"ni se entera"».

**Vive en:** `lib/extension-tienda.ts`, `extension/manifest.json`,
`scripts/zip-extension.mjs`, `app/privacidad/extension/page.tsx`,
`app/video-generator/PuentePanel.tsx`.

## El navegador que no puede: por qué el guard mira el MOTOR y no la marca

Un usuario de Safari entraba al Video Generator, veía «Descargar la extensión» y un
instructivo que le decía que abriera `chrome://extensions` — que en su navegador no
existe. La única señal que recibía era muda: a los 1,5 s el botón «Conectar» del paso 2
se apagaba solo, sin decir por qué.

**La trampa está del lado positivo, no del negativo.** La regla del repo pide guards en
positivo, y acá la forma obvia de cumplirla —una lista de marcas permitidas, `['Google
Chrome', 'Microsoft Edge', 'Brave', 'Arc'…]`— **rompe exactamente lo que quiere
proteger**: Brave no pone su nombre en `navigator.userAgentData.brands` (lo omite a
propósito, es anti-fingerprinting) y Arc tampoco (es un Chromium re-skinneado). Los dos
dicen «Google Chrome», y los dos instalan de la Chrome Web Store sin problema. Una lista
de marcas le niega la función a dos navegadores que la tienen.

La condición correcta mira el **motor**: todo build de Chromium emite `Chromium` en
`brands`. Vive en `lib/navegador.ts`, sin `server-only` para que se pueda testear con
objetos literales, y devuelve **tres** valores.

**Por qué tres y no un booleano.** `navigator.userAgentData` es **secure-context-only**:
en `http://` que no sea `localhost` es `undefined` incluso en un Chrome real. Abrir el
dev server por IP de LAN (`http://192.168.x.x:3000`, probar desde el celular) es
exactamente ese caso — y es donde más se prueba esta pantalla. Con un booleano, ahí le
diríamos «tu navegador no sirve» a un Chrome.

**Y `no-se-sabe` NO pinta el aviso, porque los dos errores no cuestan lo mismo.** No
avisarle a un Safari le cuesta medio minuto y **es el comportamiento de hoy**, así que
equivocarse hacia ahí no es una regresión. Avisarle de más a un Chrome le niega la
función, contradice un hecho que la propia pantalla puede observar un segundo después, y
no tiene recuperación: la persona cierra la pestaña.

**El hecho le gana a la corazonada, y el orden de la condición lo dice:** se pinta con
`instalada === false && puedeInstalar === 'no'`. Si el content script ya puso
`data-mako-puente` en el `<html>`, la extensión ESTÁ instalada y el navegador ES Chromium
— ningún sniff puede contradecir eso. Es «estado vivo, no recordado» aplicado literal: el
atributo es el hecho, la inferencia es la corazonada.

**Tres trampas más del user-agent, todas medidas:**

- **`\b` no sirve, pero tampoco sirve lo obvio:** Chrome, Edge, Brave y Opera meten
  `Safari/537.36` y `AppleWebKit` en su cadena. Buscar `Safari` a secas matchea Chrome —
  es el bug de sniffing más viejo que existe.
- **Los tokens de iOS son un «no», no una excepción.** `CriOS/` (Chrome), `EdgiOS/`,
  `FxiOS/`: Apple obliga a WebKit en el iPhone, así que «Chrome» en iOS es Safari con otro
  ícono y no instala nada. Excluirlos de la confirmación —que fue el primer intento— los
  dejaba en «no se sabe» siendo un «no» seguro. **Lo cazó el test, no la revisión.**
- **`brands` trae basura DELIBERADA.** Chromium inyecta una entrada cuyo nombre cambia
  entre versiones (`Not;A=Brand`, `Not_A Brand`, `Not.A/Brand`…) y en orden aleatorio,
  justamente para romper al que asuma una lista fija. Nunca indexar por posición, nunca
  mirar el largo.

**No existe ninguna API que conteste la pregunta.** `chrome.webstore.install()` y
`chrome.app.isInstalled` murieron con el inline install en 2018. Todo es inferencia, y
conviene que esté escrito para que nadie la busque de nuevo.

**Verificado en los dos motores**, no razonado: WebKit de Playwright ve el aviso, Chromium
no lo ve. Para este caso puntual el WebKit de Playwright SÍ sirve —aunque no sirva para
bugs de layout de Safari—, porque lo que se prueba es la ausencia de `userAgentData`, que
es igual en todas sus versiones.

**Vive en:** `lib/navegador.ts`, `tests/navegador.test.ts`,
`app/video-generator/PuentePanel.tsx`, `tests/puente-panel-copy.test.ts`.

## Un `var(--token)` inexistente no falla: hereda

`var(--fs-xs)` y `var(--fs-lg)` **no existen** — `app/globals.css` define `meta / sm / md
/ card / sect / page / kpi` y nada más. Un token inventado no da error ni warning: el
texto hereda el tamaño del padre y queda *casi* bien, que es la peor forma de estar mal.
Es el mismo modo de falla que `<Icon name="warning">`, que dibuja un punto gris en
silencio porque `name` es `string` pelado y hace `PATHS[name] ?? PATHS.dot`.

Se habían colado dos, en cuatro lugares. Ahora hay un test que barre **el repo entero**
con `git grep` y no una lista de archivos: un guard que cubre dos pantallas deja pasar la
tercera, y el que la escribe no tiene por qué saber que el test existe.

**Vive en:** `tests/puente-panel-copy.test.ts`, `app/globals.css:168`,
`app/_components/icons.tsx:265`.

## Lo que el reconocimiento encontró de paso y NO se arregló

Nada de esto es del aviso de navegador; salió de mirar el terreno alrededor. Ordenado por
lo que más cuesta:

1. **`tomarTrabajos` no es atómico** (`lib/flow-cola.ts`). El `SELECT` de los pendientes y
   el `UPDATE` que los marca `tomado` son dos operaciones separadas; el comentario dice
   «en el mismo tick» y esa es la intención, pero hay ventana. Dos consumidores a la vez
   —dos pestañas de MaKo, o la extensión de desarrollo conviviendo con la de la tienda—
   toman el mismo trabajo. No cuesta un registro duplicado: cuesta **generar el mismo clip
   dos veces y gastarle los créditos de Google al cliente**. El arreglo es un RPC con
   `FOR UPDATE SKIP LOCKED`.
2. **El paso 4 nunca se persiste.** `prueba` arranca en `null` y no se hidrata del server,
   así que `listo` es SIEMPRE `false` en una carga fresca: un workspace enteramente
   configurado ve los cuatro pasos otra vez, con el 4 en gris, cada vez que entra. El
   early return de la línea 230 es código muerto al cargar.
3. **`crearTokenPuente` ROTA el token** (`onConflict: 'workspace_id'`). Apretar «Volver a
   conectar» desde otro navegador mata el puente que andaba. El `disabled={instalada ===
   false}` del paso 2 está protegiendo eso, no siendo tonto — no tocarlo.
4. **Un puente por workspace.** Una agencia no puede tener los puentes de cinco clientes
   en el mismo Chrome: `flow_puentes` tiene una fila por `workspace_id` y `popup.js` guarda
   un único token.
5. **El content script solo matchea `hola-mako.com` y localhost.** En un preview de Vercel
   o en `www.hola-mako.com`, `useExtensionInstalada()` devuelve `false` aunque la extensión
   esté instalada — y se va a diagnosticar como un bug del aviso, no del manifest.
6. **`app/integraciones/ProbarTracking.tsx:493` tiene el mismo problema en otra tab**: da
   la instrucción literal de la UI de Chrome para desbloquear pop-ups («el ícono con la
   ventanita tachada»). Peor de detectar, porque ese copy solo aparece DESPUÉS de que el
   navegador bloqueó el pop-up: lo ve únicamente quien ya está en la peor situación.
7. **La tab no está en `TAB_ONBOARDINGS`** aunque el panel dice aplicar la skill
   `tab-onboarding`. Consecuencia: `resumenOnboardingTabs` alimenta a MaKo con qué tabs
   están sin configurar, y el Video Generator es **invisible** para ese resumen. Ojo al
   registrarla: las keys van namespaced (`video_*`) o colisionan vía
   `KEY_PASOS_COMPARTIDOS`, y agregar un paso no opcional devuelve a «pendiente» a todo el
   que ya la tenía cerrada.
8. **`app/admin/dev/areas.ts:562` dice `estado: 'por-construir'`** y su `vive` nombra dos
   archivos: quien busque dónde tocar por el mapa de dev no encuentra `PuentePanel.tsx`,
   `puente-actions.ts`, `lib/flow-cola.ts` ni `lib/extension-tienda.ts`.
9. **`tests/rutas-publicas.test.ts` no asegura que `/privacidad` siga en `PUBLICOS`.**
   Sacarla por error deja la política de privacidad detrás del login, que es motivo de
   rechazo de la Chrome Web Store.

**Y el dato que cambia la urgencia de todo lo anterior:** hoy el único `encolar()` de la
app es `creditos` (`app/video-generator/puente-actions.ts:60`). `TipoTrabajo` declara
`generar_clip` y `background.js` ya lo sabe mapear, pero **ningún código encola un clip
todavía**. El puente entero existe, por ahora, para contestar una consulta de saldo — así
que nadie está perdiendo videos, y el copy no puede prometer generación que aún no existe.

## El puente a Flow FUNCIONA: 1.012 créditos leídos de una cuenta real

26/08/2026, después de un día entero. El circuito completo —MaKo encola, la
extensión toma, le pega a Google con la sesión del cliente, devuelve— cerró con:

```json
{"sku":"WS_FREEMIUM","credits":1012,"serviceTier":"SERVICE_TIER_ENTRY",
 "userPaygateTier":"PAYGATE_TIER_NOT_PAID","subscriptionCredits":1012}
```

**Eso cierra uno de los dos bloqueos que estaban abiertos hace semanas** (leer el
saldo real). Y trae un dato de negocio que no teníamos: la cuenta de Mauricio es
**freemium, no de pago**.

⚠️ **Lo que NO se puede afirmar todavía: cuántos videos son 1.012 créditos.** El
costo por clip que circula en el corpus (20 por 8 s) sale de la documentación de
useapi y **no está medido**. Se sabrá mirando el saldo antes y después del primer
video, y no antes. `leerSaldo()` no hace esa conversión a propósito.

### El contrato REAL, capturado del tráfico de Flow

| Pedido | Método | Autenticación | ¿`?key=`? |
|---|---|---|---|
| `/v1/credits` | **GET** | header `Authorization` | **sí** |
| `/v1:checkAppAvailability` | POST | header **`X-goog-api-key`** | no |
| `/v1:fetchUserRecommendations` | POST | `Authorization` + `Accept-Language` | no |
| `/v1/flow:batchLogFrontendEvents` | POST | `Authorization` | no |

Tres cosas que se creían y eran falsas: que **todo era POST** (créditos es GET),
que **el `?key=` iba en todos los pedidos** (va solo en créditos), y que la
autenticación era siempre el bearer (`checkAppAvailability` usa `X-goog-api-key`,
que es otra cosa).

## Los cuatro diagnósticos obvios que fueron el equivocado, en orden

Esto es lo que más tiempo ahorra la próxima vez. **Cada arreglo era correcto y
ninguno era la causa**, y en cada paso el error cambiaba, lo que hacía parecer que
íbamos bien.

1. **«Recargá la pestaña»** — cierto: el content script no se inyecta hacia atrás
   en pestañas ya abiertas. Arregló el `Receiving end does not exist` y destapó el
   siguiente.
2. **«La CSP bloquea la inyección»** — cierto: meter `injected.js` con un
   `<script src="chrome-extension://…">` no funciona en labs.google. Va con
   `world: MAIN` en el manifest. Destapó el siguiente.
3. **«Google bloqueó la sesión»** — **FALSO, y es el que más costó.** Lo dijo
   nuestro propio mensaje de error con toda autoridad mientras el dueño generaba
   videos a mano, en la misma pestaña, con la misma cuenta y la misma IP. La
   página «Sorry» de Google **no significa que la cuenta esté marcada**: significa
   que ESE pedido no fue atribuido a ningún proyecto.
4. **«Falta la API key»** — cierto y necesario, y **tampoco alcanzaba**. La causa
   final era el MÉTODO: `GET`, no `POST`.

**La regla que queda: cuando el usuario dice que a mano funciona, eso NO es
información de color — es el dato que descarta media hipótesis.** Si la misma
sesión, misma cuenta y misma IP funcionan por un camino y fallan por el otro, el
problema está en la diferencia entre los dos caminos, nunca en la cuenta. Se
perdieron horas tratando ese reporte como ruido.

## Un pedido a una API privada de Google no se RECONSTRUYE: se COPIA

Todo el contrato salía de la documentación de un tercero (useapi). Cuando se
comparó contra el tráfico real aparecieron el `?key=` faltante y el método
equivocado — y esos son los que sabíamos buscar. Los headers que uno **no sabe que
le faltan** no se encuentran adivinando.

La solución es un espejo: `extension/injected.js` corre en `world: MAIN`, envuelve
el `fetch` de la página y guarda el último pedido de cada clase como **plantilla**
(método, URL, headers, cuerpo). Nuestros pedidos salen calcados. No hay nada que
adivinar, y si Google cambia el contrato la plantilla cambia sola.

Tres reglas del espejo, todas pagadas:

- **El envoltorio no puede romper la app.** Todo en `try/catch` y la promesa
  original se devuelve intacta siempre. Si la captura falla, Flow sigue andando y
  nosotros nos quedamos sin plantilla — ese es el orden correcto.
- **Sin plantilla NO se inventa el pedido.** Se dice qué falta y qué hacer para que
  aparezca. Inventarlo es exactamente lo que no funcionó.
- **Una lectura que la app acaba de hacer se contesta con SU respuesta.** Cero
  tráfico nuestro: el pedido que la produjo lo hizo Flow.

⚠️ Y la primera versión del espejo **no copiaba la URL**: `urlPedida ||
plantilla.url`, con `urlPedida` siempre seteada. Copiaba método y headers y seguía
mandando el path armado a mano. El bug estaba justo en la línea que era el punto
de todo el cambio. Lo cazó una auditoría, no una prueba.

## Un `fetch` de extensión no es un `fetch` de la página

Desde el service worker viaja con `Origin: chrome-extension://<id>`, sin las
cookies del sitio y sin los headers de la app. Para Google tiene **la forma exacta
de un bearer de Flow usado por un tercero** — o sea, la forma de un token robado.

Y esto explica por qué useapi necesita su `sendTelemetry()` que fabrica eventos
falsos: **piden desde afuera del contexto y tienen que fingir que son la página.**
Nosotros no fingimos nada porque el pedido sale realmente de la página del
usuario. La decisión de no replicar esa telemetría no costó nada: solo había que
pedir desde el lugar correcto.

## Reintentar contra un bloqueo es lo que causa el bloqueo

El `catch` de la extensión clasificaba por descarte —todo lo que no fuera
`NO_FLOW_TAB` era «transitorio y reintentable»— y el endpoint nunca miraba el
`status` HTTP. Resultado medido: **25 pedidos automáticos contra la página de
bloqueo de Google**, 5 por trabajo. Muy probablemente el bug de clasificación es
lo que produjo el bloqueo que después diagnosticamos como «te marcaron».

Y el freno que existía para eso **nunca enganchó**: `fallar()` escribía `marcada` y
el auto-reporte de la extensión lo pisaba con `listo` **dos líneas después, en el
mismo request**. El guard de `tomarTrabajos` era inalcanzable y `pausado` siempre
`false`. La regla: **un estado de contención no se levanta con un ciclo automático
— se sale de ahí con una acción de la persona.**

## El mensaje traducido no puede reemplazar al error original

Cuando el clasificador dice «Google bloqueó la sesión» y tira el HTML que lo
motivó, el que investiga se queda con la INTERPRETACIÓN y sin la evidencia. Si la
interpretación es la equivocada —lo fue— no hay forma de enterarse. Ahora el crudo
va al lado del mensaje.

## El cliente estaba corriendo una versión de dos horas antes

**El error de método más caro del día.** Se le descomprimió el zip en una carpeta
suelta del Escritorio, y Chrome quedó leyendo esa copia. Cada arreglo salía a
producción, el dueño le daba a «recargar» —correctamente— y Chrome recargaba con
total fidelidad el código viejo. Se diagnosticaron durante horas los síntomas de
una versión que no existía: `world: MAIN`, el fetch desde la página, la API key y
el método GET **nunca se ejecutaron ni una vez**.

Y no había forma de notarlo porque nada mostraba la VERSIÓN: «sigue igual» era
indistinguible de «no llegó el cambio».

- **Un artefacto que se distribuye COPIADO se desincroniza el mismo día.** Vale
  para un zip descomprimido, un `dist/` bajado, un binario en el Escritorio.
- **Toda pieza que se instala aparte muestra su versión donde el usuario mira.**
  El content script ya la escribía en el DOM y la tirábamos con `hasAttribute()`.
- **Y para encontrar la carpeta se lee el PERFIL de Chrome, no se supone.** El
  script (`scripts/sync-extension-local.mjs`) saca las rutas de `Secure
  Preferences` filtrando por `location: 4` (UNPACKED). Filtrar por «parece una
  ruta absoluta» no sirve: el visor de PDF y el web_store de fábrica también la
  tienen.

**Vive en:** `extension/`, `scripts/sync-extension-local.mjs`,
`lib/flow-protocolo.ts`, `app/api/flow/puente/route.ts`, `lib/flow-cola.ts`,
`app/video-generator/PuentePanel.tsx`.

## Lo que sigue, ahora que el circuito funciona

1. **Medir cuántos créditos cuesta un video de verdad**: mirar el saldo, generar
   un clip, mirar el saldo. Es el número que decide la economía del plan y el
   único que hoy no tenemos.
2. **Verificar la marca de agua** en la salida por API. Sigue siendo el otro
   bloqueo abierto, y si la trae, todo lo generado es inusable como anuncio.
3. **`tomarTrabajos` no es atómico** (`lib/flow-cola.ts`): el `SELECT` y el
   `UPDATE` son dos operaciones. Dos consumidores toman el mismo trabajo y se
   generan clips duplicados con los créditos del cliente. Se arregla con un RPC
   con `FOR UPDATE SKIP LOCKED`.
4. **El paso 4 no se persiste**: `prueba` arranca en `null` y no se hidrata, así
   que un workspace configurado ve los cuatro pasos otra vez cada vez que entra.
5. **El cooldown de 10 s con 5 concurrentes** no está medido contra una cuenta
   real. Se mide generando, no antes.

## La extensión se aprobó, y lo que cambia no es el botón

28/08/2026. `EXTENSION_EN_TIENDA = true`, verificado antes de tocarlo: la ficha
devuelve 200 y redirige a `/detail/mako/<id>`. La URL va con el slug canónico —
sin él resuelve igual pero con un redirect, y un link que rebota es uno que a
veces no llega.

**Lo que de verdad cambia es DÓNDE ocurre la instalación.** Con el zip era un
desvío por `chrome://extensions` que terminaba en una recarga, así que al volver
la pantalla ya sabía. Desde la tienda el camino es «clic → pestaña nueva →
instalar → volver», y al volver la respuesta seguía siendo la de hace un minuto:
**el content script no se inyecta hacia atrás en una página que ya estaba
abierta**, así que el atributo tampoco aparece solo.

Se re-mira en cada `visibilitychange`, y si sigue sin estar aparece un botón «Ya
la instalé» que recarga. **Lo único honesto que se puede hacer al detectar el
regreso es ofrecer la recarga, no simularla** — no hay forma de que el atributo
aparezca sin recargar.

**Y el camino del zip no se borra.** Si Google baja la extensión, el flag vuelve a
`false` y la pantalla lo recupera sola. Un camino alternativo que se borra el día
que deja de usarse hay que reescribirlo el día que vuelve a hacer falta.

**Vive en:** `lib/extension-tienda.ts`, `app/video-generator/PuentePanel.tsx`.

## La aprobación convirtió una carrera teórica en el escenario normal

`tomarTrabajos` hacía un `SELECT` de los pendientes y **después** un `UPDATE` que
los marcaba. El comentario decía «en el mismo tick» — esa era la intención, no el
efecto: entre las dos operaciones hay una ventana donde dos consumidores leen el
mismo trabajo.

Vivió meses sin morder porque había un navegador por cliente. **La aprobación lo
cambia**: tener la de la tienda y la desempaquetada conviviendo pasa a ser lo
normal, y dos pestañas de MaKo abiertas ya lo era antes.

Y lo que costaba no era una fila duplicada: era **generar el mismo clip dos veces
con los créditos del cliente**.

Ahora es un RPC con `FOR UPDATE SKIP LOCKED` (mig 0147). **Medido contra la base
con dos consumidores simultáneos: 6 trabajos, 3 y 3, cero entregados dos veces** —
la prueba que la versión de dos queries no podía pasar.

Tres decisiones que valen para cualquier cola:

- **El guard de `marcada` y el rescate de colgados viven ADENTRO del RPC.** Afuera
  eran dos `if` que el segundo call-site podía olvidarse de copiar.
- **Si el RPC falla NO se degrada al camino viejo.** Volver a las dos queries
  devolvería la carrera justo cuando algo ya anda mal. Sin trabajos, el puente
  vuelve a preguntar en el próximo ciclo y no pasa nada.
- **El `interval` del rescate quedó en dos lugares** (el RPC y `COLGADO_MS`), y
  está dicho en el comentario cuál manda. Un valor duplicado sin esa línea es el
  que se queda viejo.

**La regla que generaliza: una carrera que «no muerde» está esperando el cambio de
contexto que la vuelve probable.** Acá el cambio fue una aprobación de la Chrome
Web Store — nada del código se tocó.

**Vive en:** `supabase/migrations/0147_flow_tomar_atomico.sql`, `lib/flow-cola.ts`.

## El primer clip no es un clip: es el ancla

Decisión del 28/08/2026, tomada ANTES de construir el pipeline de video.

**Un clip por vez, con OK entre cada uno.** El dueño lo planteó como economía —
«es un gasto de tokens impresionante si los hizo todo mal»— y al detallarlo eligió
la versión estricta: aprobación en CADA clip, no solo en el primero.

Los números, medidos en su cuenta: 1.012 créditos, y Car Talks son 7-12 tomas. Si
el costo por clip fuera el que circula (~20 créditos, **sin verificar**), un
anuncio entero son 140-240: entre 4 y 7 anuncios con todo el saldo. Generar los 7
de una y descubrir que el avatar no se parece cuesta un anuncio entero; generar 1
y mirarlo cuesta 20.

**Pero la razón que más importa no es la plata.** El clip 1 fija la cara que los
siguientes encadenan por `startImage`/`endImage`. El corpus ya midió que
«referenciar IA con IA pierde la identidad» y que la foto real es el ancla: si el
primero sale con otra cara, los seis que vienen salen **consistentemente** mal —
que es peor que salir mal cada uno a su manera, porque parece deliberado.

Aprobar el clip 1 no es aprobar un clip. Es aprobar el ancla.

**Y cuando uno no convence, se EDITA SU PROMPT** — no un botón de «otra vez» a
ciegas.

⚠️ Eso choca de frente con una regla ya escrita: «el cliente JAMÁS ve prompts». No
es contradicción: esa regla protege de que le entreguen instrucciones en vez de un
anuncio. Acá el prompt se abre porque el dueño está DEPURANDO una toma que salió
mal. Va detrás de un «no me convence», nunca en el camino feliz.

**La regla que generaliza: un paso caro e irreversible se aprueba de a uno, y el
primero se aprueba distinto que el resto** — porque es el que condiciona a todos
los demás.

**Vive en:** `app/video-generator/`, `lib/flow-cola.ts`, `extension/background.js`.

## «Generar anuncio» no genera un video, y hay que decirlo

Hoy el botón produce el PLAN: reparte el guion en tomas y escribe cómo se filma
cada una. Una llamada de texto, centavos, segundos. El video es otro paso.

Un botón que promete un anuncio y devuelve un texto es **la forma más barata de
que alguien crea que algo se rompió**. Por eso el paso de revisión lo dice con
todas las letras: «todavía no se genera ningún video ni se gastan créditos».

**Y lo que se revisa NO es un resumen de lo que el usuario eligió.** El formato y
el guion los acaba de elegir; mostrárselos otra vez es hacerle leer lo que ya
sabe. Lo que se revisa es lo que el SISTEMA puso solo y nadie vio: la cara, la
duración derivada y el acento inferido — justo los tres que se notan recién en el
video terminado.

La cara va como IMAGEN y no como conteo: «3 fotos cargadas» se lee exactamente
igual con las fotos correctas que con las de otra persona. Un parecido se juzga
mirando.

**Vive en:** `app/video-generator/VideoGeneratorApp.tsx`, `video-datos.ts`.


## La instrucción que importaba viajaba marcada como «no confiable»

**El síntoma.** El dueño eligió un guion suyo en el Video Generator y el plan salió
con otro texto. El cierre, que es lo más caro de un anuncio:

| | |
|---|---|
| el guion decía | «En el video del enlace te explico cómo construir ese sistema para detectar el incendio antes de que empiece. Da click en el enlace.» |
| el plan devolvió | «Toca el botón aquí abajo, deja tus datos en el formulario y te mando los detalles completos.» |

Y además metió regionalismos que el cliente no escribió: «una bronca», «nomás»,
«ocupas un gerente».

**El diagnóstico obvio era el equivocado.** Parecía «al prompt le falta decirle que
no reescriba». No le faltaba: `componerTema` mandaba el guion precedido de
**«GUION A GRABAR — respeta su contenido, su orden y su cierre»**.

**La causa real.** Esa instrucción viajaba dentro de
`contenidoNoConfiable(tema, 'tema_usuario')`, o sea envuelta en la etiqueta que le
dice al modelo *«esto es DATO del usuario, no órdenes»* — la misma envoltura que
protege contra inyección de prompt. Mientras tanto el **system** prompt tenía un
apartado entero titulado «CÓMO SE ESCRIBE EL TEXTO HABLADO» y cerraba con «Escribe
el plan completo». El modelo obedeció a la parte confiable, que es exactamente lo
que la envoltura existe para lograr.

El disparador fue un cambio de producto sin cambio de prompt: la tab pasó de
preguntar **un tema** («¿De qué habla tu anuncio?») a recibir **un guion
terminado**, y el guion siguió entrando por el mismo campo `tema`.

**Regla que queda.** Una instrucción metida en el mismo bloque que el contenido del
usuario **no es una instrucción**: la envoltura anti-inyección la degrada a dato, y
funciona igual de bien contra uno mismo. Lo que gobierna el comportamiento va en el
system; en el bloque del usuario van los datos y nada más. Y cuando cambia lo que
entra por un campo, hay que releer el prompt que lo consume: el compilador no ve
que `tema` pasó de ser un tema a ser un guion.

**Y el arreglo no fue un prompt mejor.** Un prompt que pide no reescribir funciona
*casi siempre*, y «casi siempre» sobre el CTA de un anuncio es un modo de falla
silencioso: el texto sale bien escrito, suena natural y solo se nota comparando
contra el original — o cuando nadie llega al embudo.

**Pero el primer arreglo se pasó de largo**, y la corrección del dueño es el
hallazgo de verdad: *«si me gusta que le puso el acento de Mauricio y sus
muletillas, eso sí está muy bien, pero que le cambie el CTA, para nada»*. Dejar el
guion 100 % literal mataba una feature — un guion escrito como se escribe suena
LEÍDO; dicho con los conectores con los que arranca la persona, suena dicho.

**La línea no está entre «tocar» y «no tocar», sino entre FORMA y FONDO** — y
dentro del fondo hay una parte que no admite ni un matiz. El contrato quedó así:

| | |
|---|---|
| la forma | se adapta: conectores, variedad del español, largo al tope del clip |
| el fondo | no se toca: ni un dato, ni un número, ni el orden de las ideas |
| **el cierre** | **se PISA con el literal** — ahí vive a dónde manda el anuncio |

`lib/guion-cierre.ts` decide dónde empieza el cierre: por el rótulo `CTA` si el
guion pasó por MaKo, o por las últimas frases si no. Y lo que no se puede
prohibir, se **mide**: `fidelidad()` compara las palabras con CONTENIDO —ignorando
las vacías, porque sumar «mira» o «pues» es justamente la adaptación buscada— y
por debajo de 0,45 la pantalla lo dice al lado de la toma, con lo que decía el
guion. No se descarta: se hace visible.

**Regla que queda:** cuando un modelo se pasa de la raya, la pregunta no es «¿cómo
lo freno?» sino «¿qué parte exactamente no puede tocar?». Prohibir todo es tan
caro como no prohibir nada — solo que el costo se paga en calidad y no se ve.

Medido de punta a punta contra el guion real: volvió el «Mira,» del arranque y el
cierre salió palabra por palabra como lo escribió el cliente.

**Vive en:** `lib/guion-reparto.ts`, `lib/guion-cierre.ts`, `lib/video-planner.ts`,
`app/video-generator/actions.ts`, `app/video-generator/video-pedido.ts`.

## Un catálogo puede documentar una producción que nunca ocurrió

El catálogo de puestas declaraba `fuente: 'Mauricio/GUION-01-v4.md, GUION-02.md,
GUION-03.md · anuncios 1 a 3'`, y sobre esa línea se marcaron guiones como «ya
grabados». El dueño avisó que uno de ellos nunca lo generó.

**Se midió en vez de discutir:** `ffprobe` sobre los cuatro anuncios terminados da
100,7 s · 98,2 s · 92,0 s · 56,1 s. `GUION-03.md` declara **~62 s** y ningún video
producido dura eso. El guion de producción existe —7 clips, derivado del *Guion 2*
del archivo del cliente— pero **no se produjo**. La línea del catálogo era una
intención escrita como si fuera un hecho.

**Regla que queda.** Un campo de procedencia escrito a mano no es evidencia. Cuando
una marca de la UI depende de él («ya lo grabaste»), la marca hereda su
confiabilidad. Para atar un guion a un anuncio sirven los artefactos: la duración
del archivo final y la cantidad de clips, no el nombre del documento. Y frente a la
duda se marca **de menos**: decirle a alguien que ya grabó algo que no grabó lo
manda a buscar un anuncio que no existe.

**Vive en:** `lib/puestas-data.ts` (campo `fuente`),
`app/video-generator/guiones-datos.ts`.

## El 403 del puente de Flow: el token se emite bien, y aun así el sitio key queda descartado por deducción

Síntoma: `403 · "reCAPTCHA evaluation failed" · PUBLIC_ERROR_UNUSUAL_ACTIVITY` en
`video:batchAsyncGenerateVideoReferenceImages` por el puente, mientras el dueño
genera a mano en la misma pestaña, cuenta e IP.

**Lo que se puede deducir sin medir nada**, y ahorra la prueba entera del site key:
`grecaptcha.enterprise.execute(clave, …)` **tira excepción** si la clave no es la que
`api.js` cargó en la página («Invalid site key or not loaded in api.js»). Si tirara,
`background.js:102` devolvería `CAPTCHA_FALLO` y nunca habría un 403 de Google. Hubo
403 con cuerpo de Google ⇒ **se acuñó un token y llegó**. O sea que el site key
hardcodeado coincide con el de la página, y `siteKeyDeLaPagina()` (0.9.0) es correcto
como higiene pero **no es el arreglo del 403**.

Eso deja dos causas, y **las dos dan el error idéntico**: (a) la `action` del token no
es la que Flow usa, (b) el score es bajo. Las separa una sola prueba: **espejar
`grecaptcha.enterprise.execute` igual que se espeja `window.fetch`** y leer la acción
real cuando el dueño genera a mano.

**El diagnóstico obvio era el equivocado, dos veces.** `clientContext.projectId: ""`
(`background.js:202`, el regex de `:58` nunca aprende el id porque ninguna URL de
video tiene forma `/v1/projects/<id>/`) y el `Authorization` **duplicado y concatenado**
(`injected.js:280-281`: la plantilla trae `Authorization` con mayúscula, se agrega
`authorization` en minúscula, y `Headers` los une en `"Bearer VIEJO, Bearer NUEVO"` —
verificado en node) son defectos REALES pero **no son la causa de este error**: el
rechazo de reCAPTCHA ocurre antes de validar el cuerpo, y si el auth no se hubiera
parseado la respuesta sería 401, no un veredicto de captcha. Son las dos fallas que
aparecen **apenas el captcha pase**.

**Trampa del entorno:** `delete o.authorization` sobre `{Authorization: 'x'}` no borra
nada. Por eso `injected.js:187` deja el **Bearer guardado en `chrome.storage.local`**,
contradiciendo textualmente el comentario de `background.js:122-125`. Mismo caso con
`delete headers['content-type']` (`:287`), que es código muerto.

**Regla que queda.** El espejo se aplicó a la URL, al método, a los headers, al cuerpo
y al site key — y **el único campo que quedó adivinado es el que produce este error
exacto**. Cuando un diseño existe para no suponer, el campo que todavía se supone es
el sospechoso, sin importar cuántas veces se lo haya «arreglado» (la acción ya se
cambió una vez, de `batchAsyncGenerateVideo` a derivarla del path: cambiar una
suposición por otra no es medir).

**Y el corolario que decide el frente:** si la causa resulta ser el score, la única
diferencia entre nosotros y useapi/FlowKit es la telemetría de actividad humana
inventada, que está **deliberadamente prohibida** acá (`extension/background.js:8-18`).
En ese caso el puente no puede correr desatendido por diseño y el camino es la API
oficial (`gemini-omni-flash-preview` / Veo 3.1 Lite), no otra vuelta de arreglo.

**Antes de invertir una hora más en el 403:** mirar un video que el dueño ya generó a
mano y confirmar si trae la marca de agua «Veo» móvil de las cuentas sin Ultra. Si la
trae, el puente produce 0 anuncios usables ande o no ande el captcha, y arreglar el
403 no destraba nada.

**Vive en:** `extension/injected.js` (`:155-168` captcha, `:187` delete roto, `:194`
borra `applicationType`, `:200` borra `sessionId`, `:280-281` auth duplicado, `:305`
`credentials:'include'`), `extension/background.js` (`:25` site key, `:58` projectId,
`:90-98` `pestanaDeFlow` sin filtro de pestaña activa, `:174-181` `accionDeCaptcha`,
`:353` alarm cada 15 s), `lib/flow-protocolo.ts:230-236` (reintento infinito de la
rama recaptcha) y `:400-406` (tabla `accion` muerta: la extensión ya no la lee).

## Cuando el avatar no se parece, la culpa puede ser de la foto que se le pasó

**El pedido del dueño, textual:** *«muchas muchas veces la imagen de IA sale mal, porque
la IMAGEN que se le pasó era mala… no tenía buena iluminación, o ya de por sí, como nos
ha pasado, era otra imagen de IA, lo que hacía que todo se vea muy artificial. Por eso es
importante compararlo una al lado de la otra… "Mirá, esto es lo que vos me pasaste, y
esto es lo que se generó, ¿realmente no se parecen o la IA lo hizo mal? ¿O en realidad tu
input estaba mal?"»*

**Por qué importa más de lo que parece.** «No se parece» es un diagnóstico ambiguo con
dos causas de costo opuesto:

| Causa | Cómo se arregla | Cuánto cuesta |
|---|---|---|
| El modelo lo hizo mal | Regenerar | Un clip |
| **La foto de origen era mala** | Cambiar la foto | Regenerar **todo** lo hecho con ella |

Y la segunda tiene un caso especialmente traicionero: **una foto que ya era generada por
IA**. Alimentar IA con IA acumula el sesgo del modelo y el resultado se ve artificial sin
que ningún prompt lo arregle — ya está medido en este proyecto que «referenciar IA con IA
pierde la identidad», pero se había tratado como una regla de producción, no como algo
que la pantalla tenga que ayudar a DETECTAR.

**La regla que queda:** cuando una pantalla le pide a alguien que juzgue un resultado
generado, tiene que mostrarle **la entrada al lado de la salida**. Sin la entrada
delante, la persona solo puede culpar al modelo — que es la conclusión equivocada la
mitad de las veces, y la que lleva a quemar créditos regenerando sobre una foto que
nunca iba a funcionar.

Es el mismo principio que ya rige el error crudo de Flow: **el veredicto no puede
reemplazar a la evidencia**.

**Vive en:** el paso de imágenes del Video Generator (por construir),
`app/video-generator/`.

## El orden correcto es IMAGEN → VIDEO, y el catálogo decía otra cosa

El primer clip que el Video Generator generó de punta a punta salió con el ángulo
equivocado y sin parecerse a la persona. La causa no fue el prompt: fue el ORDEN.

Se generaba en UN paso —escena descrita + foto de referencia en el mismo pedido—, que es
exactamente lo que la sección «Composición e identidad se resuelven en DOS pasos» de este
mismo documento dice que no funciona. El método estaba escrito y el código no lo seguía.

**Y el catálogo lo contradecía por escrito:** `The Office` y `Car Talks` declaraban
`imagenesPrevias: false`. Ese dato salió de cómo se produjo A MANO el cuarto anuncio
—donde se fue de foto a video— y se generalizó a una regla del formato. El dueño lo
corrigió: *«en cada formato es 1 o más imágenes… en esta del auto puede ser 1, porque es
una sola toma; pero en la oficina, como son cambios de escenario, sí deberían ser
diferentes imágenes»*.

**La cuenta no es por clip: es por ESCENARIO.** Un anuncio de 7 tomas dentro del mismo
auto necesita una imagen; uno que recorre una oficina necesita una por lugar. Decidido:
el número vive en el catálogo, fijo por formato, porque es una propiedad de la puesta en
escena y no del guion.

**Vive en:** `lib/puestas-data.ts`, `app/video-generator/video-action.ts`.

## El contrato de imagen de Flow, medido del bundle (30/08/2026)

Se leyó del bundle de Flow en vez de reconstruirlo, que es lo que costó cinco vueltas con
el endpoint de video. Vale para no volver a buscarlo:

```
endpoint : /v1/projects/<projectId>/flowMedia:batchGenerateImages
captcha  : accion IMAGE_GENERATION
cuerpo   : { clientContext, modelInput, modelSettings, userInput }
  userInput.prompts[]        ← un string por imagen pedida
  userInput.candidatesCount  ← cuántas variantes (Flow pide 4 en su diálogo, 1 al editar)
  userInput.referenceImageInput.referenceImages[]
      { mediaId, useMediaId: true, isLikeness: true,
        imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE' }
  userInput.userImages[]     ← alternativa con bytes: { imageType: 'SUBJECT', rawImageBytes }
respuesta: { imagePanels: [ { generatedImages: [...], prompt } ], workflowId }
```

**El hallazgo que ahorra el paso entero: `isLikeness`.** La sustitución del personaje por
la foto real NO es un segundo pedido — es un campo del mismo. Y como el mecanismo es el
mismo que usa el clip (`referenceImages`), se puede reusar el `mediaId` que el paso de
video ya aprendió (`KEY_CARA_FLOW`): una cara, un lugar. Sin ese campo la foto entra como
referencia estética y la cara se reinventa.

**Y `IMAGE_USAGE_TYPE_ASSET` NO es un error de tipeo por `IMAGE_USAGE_TYPE_ASSET_IMAGE`.**
Los dos existen en el bundle, en enums de mensajes distintos. Estuvo a punto de
«arreglarse» un valor copiado del tráfico real contra el enum del mensaje equivocado — que
es el antipatrón del espejo con el signo cambiado. Antes de corregir un valor medido,
comprobar contra QUÉ enum se lo está comparando.

**Vive en:** `lib/flow-imagen.ts`, `lib/flow-clip-referencias.ts`.

## Dos agujeros del espejo que sólo destapa un endpoint con id en el path

Los dos estuvieron dormidos mientras la única generación fue de video, y los dos
habrían fallado con el mismo cuerpo de error: 403 «reCAPTCHA evaluation failed».

**1. Nuestro `path` pisaba el de la plantilla.** Había un
`if (path && !plantilla.url.includes(path)) url.pathname = path`. Con el endpoint de
imágenes el path lleva el projectId adentro (`/v1/projects/<id>/flowMedia:...`), nosotros
NO lo sabemos —sólo se aprende de URLs que Flow no hace— y la condición daba verdadera
**justamente porque los ids no coincidían**. O sea: habría reemplazado el projectId real
de la plantilla por uno inventado. La regla que queda: **el `path` sirve para ENCONTRAR la
plantilla, nunca para reescribirla** — la clase sale del último tramo del path, así que la
plantilla que se encontró ya es la de ese endpoint.

**2. El fallback del captcha pisaba una acción MEDIDA.** `injected.js` decía: «si Flow no
acuñó esta acción en la sesión, usá la primera que sí acuñó». Nació cuando la acción se
derivaba del path —una suposición— y ahí cualquier cosa vista de verdad era mejor. Con la
tabla leída del bundle deja de ser cierto: en una sesión donde Flow generó un VIDEO y
nosotros pedimos una IMAGEN, `IMAGE_GENERATION` (medida, correcta) perdía contra
`VIDEO_GENERATION` (vista, de OTRA pregunta). **Un fallback sólo puede pisar a un valor
adivinado**, así que ahora el service worker manda un flag `medida` diciendo de dónde
salió la acción.

**Vive en:** `extension/injected.js`, `extension/background.js`, `extension/content.js`.

## «Genera algo una vez» no es un mensaje de error

`SIN_PLANTILLA` contestaba *«Todavía no vimos a Google Flow hacer este pedido. Abre Flow,
genera algo una vez, y vuelve a intentar»*. Con dos clases de generación eso manda a hacer
la que ya estaba hecha: generar un video no le enseña al espejo a pedir una imagen, son
plantillas distintas. Ahora hay una frase por clase (`QUE_HACER_SIN_PLANTILLA`).

**Y de paso, un bug que el mensaje mismo escondía:** la clase se sacaba con
`m.split(':')[1]`, y la clase de imágenes lleva dos puntos adentro
(`flowMedia:batchGenerateImages`). El error nombraba `flowMedia`, un endpoint que no
existe. Un mensaje de error con un dato partido a la mitad manda a buscar lo que no es.

**Vive en:** `lib/flow-protocolo.ts`.

## Una pregunta contestada dos veces: `imagenesPrevias` vs `escenarios`

El catálogo de puestas tenía las dos, y se contradecían: `The Office` decía
`imagenesPrevias: false` y `escenarios: 4`. Con el booleano vivo, el planner además le
pedía al modelo una lista en prosa (`imagenesNecesarias`) de las imágenes a generar —una
TERCERA respuesta a la misma pregunta, esta vez una opinión.

Se borraron las dos. Queda `Puesta.escenarios`, que es un dato del catálogo, y las escenas
(`lib/escenas.ts`), que además saben qué tomas cubre cada una y traen su prompt.

**La regla que queda, y es la de siempre con una vuelta más:** cuando encuentres dos
fuentes para el mismo dato, contá TRES antes de dar por cerrada la unificación. La tercera
casi nunca está en el mismo archivo — acá vivía adentro del esquema JSON que se le pedía a
un modelo, que es donde nadie busca un catálogo.

**Vive en:** `lib/puestas-data.ts`, `lib/video-planner.ts`, `lib/escenas-core.ts`.

## Qué le toca al modelo y qué no, en el paso de imágenes

Tres decisiones, y sólo una es del modelo:

| Pregunta | Quién la contesta | Por qué |
|---|---|---|
| ¿Cuántas imágenes? | el CATÁLOGO (`Puesta.escenarios`) | es una propiedad del formato, no del guion |
| ¿Dónde corta cada escenario? | el modelo, y si contesta mal, la aritmética | es juicio, pero un reparto parejo siempre existe |
| ¿Qué se ve en cada uno? | el modelo | es lo único que no se puede derivar |

El reparto se valida entero o se descarta (`validarEscenas`), y cuando los cortes no valen
**no se cae el paso**: cae al reparto parejo. Un paso de imágenes que se rompe porque un
modelo devolvió mal una lista de números deja a la persona sin anuncio por una razón que
no es suya.

**Y la red de las caras es la segunda capa obligatoria.** El catálogo dice desde siempre
«no se describe la cara: la identidad la resuelve la foto real», y eso vivía sólo en la
prosa de un prompt. Acá «casi siempre» es caro de un modo particular: el fallo NO se ve al
leer el prompt, se ve tres pasos después, cuando el clip sale con la cara de otro y los
créditos del video ya se gastaron. `mencionaCara()` lo mide y descarta.

**Vive en:** `lib/escenas-core.ts`, `lib/escenas.ts`, `tests/escenas-core.test.ts`.

## Lo que quedó SIN hacer del paso de imágenes

1. **El clip todavía NO arranca desde la imagen aprobada.** Hoy la imagen sirve para
   confirmar el escenario y para elegir la cara; el video se sigue pidiendo con
   `clipDesdeReferencias`. Para animar desde la imagen hace falta `IMAGE_USAGE_TYPE_START_IMAGE`
   con el `mediaId` de la imagen generada — y **no se hizo a propósito**: no hay plantilla
   de ese pedido en el espejo, y armarlo a mano es exactamente lo que costó cinco vueltas.
   Se destraba solo el día que alguien anime UNA imagen a mano en Flow con la pestaña
   abierta. `imagenesDeRespuesta()` ya guarda el `mediaId` cuando viene.
   **Vive en:** `lib/flow-imagen.ts`, `app/video-generator/video-action.ts`.
2. **«Las imágenes son gratis» sigue siendo una afirmación, no una medición.** Se guarda
   el `saldoAntes` de cada imagen —que es la mitad irrecuperable— pero nada calcula todavía
   la diferencia. Y ojo con el atajo: `saldoAction` atribuye CUALQUIER bajada de saldo al
   costo de un clip, así que si las imágenes cobraran, ese número quedaría contaminado.
   **Vive en:** `app/video-generator/saldo-datos.ts`, `app/video-generator/video-action.ts`.
3. **La foto propia del lugar se guarda como data: URI dentro del historial**, que topea en
   10 anuncios en `app_settings`. Es la misma deuda que ya tienen los clips y se salda
   igual: bajando los medios a storage propio.
   **Vive en:** `app/video-generator/video-datos.ts`.

**Vive en:** `app/video-generator/PasoEscenarios.tsx`.

## Una causa VERDADERA que no era LA causa

El 30/08/2026, ante «recargué la extensión y sigue en la versión anterior», se diagnosticó
—con evidencia dura— que producción servía el zip 0.12.0 porque el build estaba rojo. Los
dos hechos eran ciertos y están medidos: `git show 0a8205bc:public/mako-puente.zip` trae
`version: 0.12.0`, el de HEAD trae `0.13.0`, y difieren en el código, no solo en el string
(`injected.js` 20.773 b → 22.377 b).

**Y no era el motivo del síntoma.** La extensión que corría no había salido de ningún zip:
Chrome tenía cargada, descomprimida, `C:\Users\marti\OneDrive\Escritorio\mako-puente` — una
COPIA de `extension/` hecha a las 10:54:34, 68 minutos antes de que existiera la 0.13.0.
Recargar releía esa carpeta. La recarga funcionó perfecto; recargó la carpeta equivocada.

**Cómo se probó que no vino de un zip, que es la parte reusable:** `zip-extension.mjs`
REESCRIBE el manifest al empaquetar (`manifestParaPaquete()` saca los `http://localhost/*`).
El manifest de la carpeta cargada mide 1.244 b y contiene `localhost`; el de adentro de
cualquier zip mide 1.182 b y no puede contenerlo. Un archivo que el empaquetador toca es una
**huella de procedencia gratis**: dice de dónde salió una copia sin preguntarle a nadie.

Tres reglas:

1. **Una hipótesis con evidencia dura sigue siendo una hipótesis mientras la CADENA hasta el
   síntoma tenga un eslabón sin medir.** Acá el eslabón era «la extensión que corre salió de
   bajar el zip», que nunca se comprobó. Se puede tener el hecho perfectamente medido y la
   conclusión al revés.
2. **Cuando el síntoma es «X no se actualiza», la primera pregunta es QUÉ X está corriendo,
   no por qué no se actualizó.** Y se contesta leyendo el perfil de Chrome (`location: 4` =
   unpacked, y el `path`), nunca suponiendo la carpeta. Ya estaba escrito en este mismo
   documento de la vez anterior, se citó, y no se aplicó.
3. **Dos errores que coinciden se leen como confirmación.** La pantalla decía que la
   extensión estaba al día: comparaba la instalada (0.12.0) contra `EXTENSION_VERSION` del
   build servido (0.12.0), y `esMasVieja('0.12.0','0.12.0')` es false. El aviso de «quedó
   vieja» no aparecía **porque las dos mitades estaban viejas**. Un indicador que compara dos
   valores que se mueven juntos no detecta el desfase: lo esconde.

**Vive en:** `app/video-generator/PuentePanel.tsx`, `scripts/zip-extension.mjs`,
`lib/extension-version.ts`.

## La única fuente viva de qué código corre no la pinta ninguna pantalla

`flow_puentes.version` la escribe el latido de la extensión cada 15 s desde
`chrome.runtime.getManifest()` (`extension/background.js`). Es lo ÚNICO que dice qué código
está corriendo de verdad, y contestó la pregunta en un comando:

    ws 1 | listo | version reportada: 0.12.0 | ultimo latido: 2026-08-30T15:35:35Z

`estadoPuente()` la devuelve y ahí muere: ninguna vista la muestra. Mientras tanto la
pantalla derivaba el estado de dos números que podían estar los dos viejos.

**La regla: cuando exista un dato REPORTADO por el sistema del que se sospecha, ese le gana a
cualquier cosa derivada.** Y si no se pinta en ningún lado, la próxima vez se vuelve a
diagnosticar por deducción — que es lo que pasó acá durante media hora.

**Sin hacer:** mostrar la versión reportada en `PuentePanel`, al lado de la que se espera.
**Vive en:** `lib/flow-cola.ts` (`estadoPuente`), `app/video-generator/PuentePanel.tsx`.

## El guard del zip no abre el zip

`scripts/zip-extension.mjs --check` compara una huella del CONTENIDO de `extension/` contra
`public/mako-puente.sha`. Nunca abre `public/mako-puente.zip`. Un zip corrupto, truncado o
sencillamente no regenerado pasa el guard mientras el `.sha` esté al día.

Esta vez NO se activó —los 10 archivos del zip hashean idéntico a `extension/`, verificado— y
por eso se anota en vez de arreglarse a las apuradas: es una debilidad medida, no un bug vivo.
El arreglo, cuando se haga, es que la huella se calcule LEYENDO el zip, que es el artefacto
que se distribuye. Es la misma lección que ya tiene este repo escrita —«el artefacto que se
distribuye no es el fuente»— aplicada una vuelta más adentro.

**Vive en:** `scripts/zip-extension.mjs`.

---

## Una ZONA se gana con contenido; sin él es un hueco con un borde al lado

El riel de referencia de `/video-generator` —el ejemplo del formato elegido, a la derecha—
se rehizo cuatro veces y las dos últimas fallaron por lo mismo, con el diagnóstico obvio
apuntando al lado equivocado las dos veces.

La versión que el dueño cortó era una franja anclada al borde derecho, `position: fixed`,
de **alto completo**, con el ejemplo (391 px) **centrado contra la pantalla** y un filete de
1 px que recorría la ventana entera. El argumento escrito era bueno: Flow separa zonas con
un escalón de relleno y cero bordes, pero a escala de ZONA, así que una franja de alto
completo sí es una zona y ahí alcanza un filete donde antes hacía falta un contorno.

Lo reportó como **«se ve muy vacío»**, y el diagnóstico obvio —el centrado— era el
equivocado. Medido a 1600×980: contenido 391 px dentro de una franja de 980. **El error no
era dónde estaba el objeto: era haber declarado zona a una franja que el contenido no
llena.** Y el filete la empeoraba en vez de disimularla: una línea de 900 px al lado de un
objeto de 391 no marca un borde, **dibuja el hueco**.

La regla: antes de anclar algo al borde de la pantalla, poné el alto del contenido contra
el alto de la franja. Si no la llena, no es una zona — se ancla a la altura de lo que
acompaña (acá, la pregunta) y **el separador mide lo que mide el contenido**, no lo que
mide la ventana. El estado plegado no lleva separador ninguno: ahí no hay zona, hay un
control de 48 px, y darle el filete de la versión abierta reproduce el mismo hueco en
chico.

**Vive en:** `.mk-riel` de `app/_ui/ui.css` (el `::before` con el filete acotado) y
`VistaPrevia` de `app/video-generator/WizardAnuncio.tsx`.

## Nombrar una cosa no es decir para qué está

El segundo defecto del mismo reporte: **«y sobre todo, no se entiende que hace eso allí»**.

Lo único escrito en la pieza era el rótulo quemado dentro del recorte, `Ejemplo · Car
Talks`. Es correcto y no contesta la pregunta: dice **QUÉ ES**, que es identidad, no
propósito. Un usuario que ve un video que no es el suyo al lado de su guion no necesita el
nombre del formato — necesita saber por qué está en pantalla.

La frase que lo contesta —«Así se verá tu anuncio»— **había sido escrita por el dueño** y
la sacó una ronda de rediseño con un argumento propio (que le prometía al usuario que ese
video era el suyo). El argumento tenía sentido y aun así estaba mal, porque la ambigüedad
se resuelve con las dos juntas: la línea de arriba dice para qué sirve, y el rótulo de
adentro aclara que el video todavía no es suyo.

Y lo mismo en el estado plegado: la palabra vertical decía `Ejemplo` —lo que hay adentro— y
pasó a `Ver el ejemplo`, que dice lo que pasa al apretar. Un control se rotula por su
efecto.

**Vive en:** `.mk-riel__para` de `app/_ui/ui.css`.

## Cómo se verificó, que es lo que hace repetible el arreglo

El Chrome real no llegaba al `localhost` del dev server (`ERR_CONNECTION_REFUSED` con el
puerto escuchando en las dos familias), y el wizard vive detrás de login y de estado de
cliente, así que no se alcanza con una URL. La salida fue un **banco de pruebas**: un HTML
que inyecta los tokens de `app/globals.css` (los bloques `:root` y `[data-tema="oscuro"]`,
extraídos con un script — la hoja entera no sirve porque arranca con `@import "tailwindcss"`),
enlaza `app/_ui/ui.css` **tal cual** y reproduce el esqueleto del estudio. Se captura con
`chrome.exe --headless=new --screenshot`.

⚠️ **La ruta del `--screenshot` va ABSOLUTA y en formato Windows.** Con una ruta relativa
contesta `Failed to write file: Access is denied (0x5)`, que se lee como un problema de
permisos y no lo es.

⚠️ **Y no sirve para el CONTENIDO, solo para la GEOMETRÍA.** Lo que el banco prueba es
dónde cae cada cosa con la hoja real; los datos, el video y los estados de React son
maqueta. Confundir las dos cosas es dar por verificado lo que no se miró.

**Vive en:** el harness es descartable (va al scratchpad de la sesión), la técnica no.

---

## Un arreglo puede diagnosticar bien y curar mal: la extensión que no se actualizaba

Martín lo reportó **cuatro veces** en dos días: «recargué la extensión y no se actualiza».
Las cuatro tenía razón, y la tercera vez se «arregló» de una forma que no podía funcionar.

El diagnóstico, del 30/08, era correcto y está escrito en el commit `0e21b906`: **a una
instalación DESCOMPRIMIDA Chrome no la actualiza nunca**; el botón ↻ de
`chrome://extensions` vuelve a leer *la misma carpeta*, no baja nada de ningún lado.

La cura fue hacer que la extensión se reiniciara sola con `chrome.runtime.reload()`. Y
`chrome.runtime.reload()` **también vuelve a leer la misma carpeta**. Automatizar la
relectura de una carpeta que nadie actualiza no cambia nada: se cambió un botón que no
servía por un reintento automático que tampoco, y encima silencioso — su guarda de «un
intento por versión de destino» hace que después del primer intento fallido no vuelva a
pasar nada nunca.

**La regla: cuando el diagnóstico es «el origen está viejo», la cura tiene que tocar el
ORIGEN.** Releer más veces, o releer automáticamente, es hacer más rápido lo que ya no
servía. Antes de dar por cerrado un arreglo, preguntá qué cambió *del lado del dato*.

### Y la carpeta se LEE del perfil de Chrome, no se supone

Medido el 31/08 con un script sobre `%LOCALAPPDATA%/Google/Chrome/User Data/*/Secure
Preferences`, buscando las extensiones con `location: 4` (descomprimida):

    repo:                      0.17.0
    carpeta que Chrome carga:  0.16.0  →  C:\Users\marti\OneDrive\Escritorio\mako-puente
    puente vivo:               0.16.0

Chrome no cargaba la carpeta del repo: cargaba **una copia en el Escritorio**, congelada el
30/08 a las 21:12. Es la segunda vez que esa copia produce horas de diagnóstico equivocado
— la primera está anotada más arriba, con la misma conclusión: *un artefacto que se
distribuye copiado se desincroniza el mismo día*.

El perfil también trae `manifest.update_url`, que separa «viene de la tienda» (la actualiza
Chrome) de «descomprimida» (no la actualiza nadie). Son dos mundos distintos y desde la
pantalla se ven iguales.

**Vive en:** el script es descartable; lo que queda es el método — `location: 4` + `path` +
leer el `manifest.json` de esa carpeta.

## Un aviso que vive lejos de donde se paga la consecuencia es un aviso que no existe

El aviso «tu extensión quedó vieja», con el número instalado, el actual y el link al zip,
**ya existía y era correcto**. Vivía en `PuentePanel` — la pantalla de *conectar el
puente*—, y la falla ocurre en el **wizard**, que es donde alguien pasa una hora generando.
Martín estuvo con la 0.16.0 mientras producción servía la 0.17.0 y la única pantalla que se
lo habría dicho era una que no estaba mirando.

Corolario del texto: decía «descárgala, descomprímela sobre la misma carpeta y usa el botón
de recargar». Correcto y **incompleto**: le faltaba la frase que costó cuatro rondas —
*recargar sin reemplazar los archivos no hace nada*. Cuando un mecanismo se malinterpreta
tres veces, el aviso tiene que negar explícitamente la interpretación equivocada, no sólo
describir la correcta.

**Vive en:** `app/video-generator/extension-instalada.tsx` (la pieza, usada por el panel y
por el wizard).

## Lo que el navegador aprende, si no se guarda, se vuelve a pedir

Pregunta del dueño: *«¿por qué me pides constantemente generar imágenes o videos? ¿No te
basta la data de todas las veces que lo hemos generado?»*. No bastaba, y era un defecto.

El puente funciona **copiando** el pedido que hace la propia página de Flow. Esa copia vivía
en dos lugares y los dos son del navegador: la memoria de la pestaña (muere con el F5) y
`chrome.storage.local` (se va con el perfil). Del lado del servidor no quedaba nada — así
que cada olvido del navegador reactivaba **cuatro mensajes distintos** pidiendo generar algo
a mano, sobre cosas que el cliente ya había hecho decenas de veces.

Lo caro no es la molestia: es que el producto le pide al cliente que repita trabajo para
recuperar un dato que nosotros teníamos y tiramos.

La lección ya estaba aplicada **a un solo dato** —el `mediaId` de la cara, con su comentario
diciendo «un dato que se descubre una vez y no cambia no puede depender de que una pestaña
siga abierta»— y no a lo que lo produce. Ahora el latido manda las plantillas (sólo cuando
cambian, por firma) y el servidor devuelve las que a ese navegador le faltan.

⚠️ **El saneo va DONDE SE ESCRIBE, aunque la extensión ya sanee.** No es desconfianza del
código de al lado: el que guarda es el único que puede garantizar qué quedó guardado, y las
extensiones viejas —de las que siempre hay— mandan lo que mandaba su versión.

**Vive en:** `lib/flow-plantillas.ts`, `app/api/flow/puente/route.ts`, `extension/background.js`.


---

## El contrato del estado de un video: el campo se llama `media`

Medido el 31/08/2026, leyendo el pedido que hace la propia página de Flow:

```
POST https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus
{"media":[{"name":"<mediaId>","projectId":"<projectId>"}]}
```

**`operations` no existe.** Durante todo ese día se mandó
`{"operations":[{"operation":{"name":…}}]}`, que salió del contrato de FlowKit —la
doc de un tercero—. El `path` de ese contrato resultó correcto y el CUERPO no, que
es el modo de falla más caro: el endpoint responde, así que parece un problema de
datos y no de forma.

`fundir()` agregaba nuestra clave **al lado** de la de Flow, así que salía un
pedido con `media` (el de Flow, apuntando a otro video) y `operations` (el
nuestro, inexistente). «Request contains an invalid argument» era literal.

**Vive en:** `parchesEstadoClip` en `lib/flow-protocolo.ts`, con su test en
`tests/flow-estado-clip.test.ts` — que ahora corre contra la plantilla MEDIDA. El
mismo test escrito sobre la forma inventada pasaba en verde mientras producción
devolvía 400.

## Tres hipótesis razonadas, ninguna correcta, y lo que sí lo resolvió

Vale anotarlo porque el error no fue de razonamiento: las tres eran defendibles y
dos eran ciertas *sobre otra cosa*.

1. **«el cuerpo pisa el array de Flow»** — cierto (`fundir` reemplaza arrays) y no
   era la causa: el pedido salió por parches y dio el mismo 400.
2. **«la plantilla quedó sin cuerpo»** — cierto para otras clases, no para ésta.
3. **«falta el `clientContext`»** — **falso**, y duró un commit. El cuerpo medido
   no lo lleva, así que agregarlo era el antipatrón que el espejo existe para
   evitar: nuestro dato inventado ganándole al copiado.

Lo que contestó la pregunta no fue pensar mejor: fue **hacer que la plantilla real
llegara al servidor y leerla**. Y esa instrumentación —el espía reportando el
respaldo, sin cortar el cuerpo de esa clase, y las plantillas persistidas— se
había construido dos commits antes **para otra cosa**.

**La regla: cuando dos hipótesis razonables se turnan sin cerrar, dejá de razonar
y andá a buscar el dato.** El costo de instrumentar se paga con la primera
hipótesis que no hay que probar. Y el olfato: si cada arreglo produce el MISMO
error idéntico, no estás cerca — estás mirando la variable equivocada.

## Una falla de la CONSULTA no puede matar lo consultado

Al hacer visible el fallo se agregó una rama que, si la causa era del cliente
—sesión, créditos, puente—, escribía un `error` **terminal** sobre la toma. Es la
regla de la casa aplicada al revés, y en la misma función que la aplica bien dos
líneas más abajo: *no poder preguntar por algo no lo vuelve falso*.

El puente se queda mudo por cosas que duran segundos —recargar la extensión deja
huérfanos los content scripts de las pestañas abiertas—, y nada de eso le pasa al
video, que se genera del lado de Google. El daño es doble y el segundo es plata:
un `error` apaga el sondeo y la pantalla ofrece volver a filmar, o sea pagar un
segundo clip por uno que ya existe.

Y el síntoma es inconfundible una vez que se sabe: **la pantalla afirmaba «La toma
1 no salió» mientras el popup de la extensión, a diez centímetros, decía «✓
Conectado a MaKo · ✓ Sesión de Flow detectada».** Cuando dos partes de la misma
app se contradicen a la vista, una está recordando en vez de leer.

**Vive en:** `estadoTomaAction` en `app/video-generator/video-action.ts`.

---

## Los contratos de Flow, todos MEDIDOS (31/08/2026)

Lo que costó la noche fue creerle a FlowKit —la doc de un tercero— tres veces. Éstos
salen del pedido que hace la propia página, capturado por el espejo:

```
POST /v1/flow/uploadImage
{"clientContext":{"projectId":"…","tool":"PINHOLE"},"imageBytes":"<base64>"}
→ {"media":{"name":"<mediaId>", …}}            ← OBJETO, no array
```
⚠️ **No lleva `mimeType`** (FlowKit lo incluía) **ni `recaptchaContext`**: subir una
imagen no acuña captcha aunque sea una escritura. Agregar un campo que la app no
manda es lo que produjo los dos HTTP 400 del día.

```
POST /v1/video:batchCheckAsyncVideoGenerationStatus
{"media":[{"name":"<mediaId>","projectId":"…"}]}
```
⚠️ El campo se llama **`media`**, no `operations`. El `path` de FlowKit era correcto
y el CUERPO no — el modo de falla más caro, porque el endpoint responde y parece un
problema de datos.

```
La cara, en el pedido de imagen:  requests[0].imageInputs[0].name
La cara, en el pedido de clip:    requests[0].referenceImages[0].mediaId
El enlace de un medio:  GET labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=<id>
    → 302 a flow-content.google/video/<id>?Expires&KeyName&Signature  (firmada, ~6 h)
```

**Vive en:** `lib/flow-protocolo.ts`, `lib/flow-imagen.ts`, `lib/flow-clip-referencias.ts`.

## Una proyección que tira un campo no falla: falla tres pasos después

```ts
const opciones = imagenesDeRespuesta(data).map((i) => i.url);
```

`imagenesDeRespuesta` devuelve `{url, mediaId}`. Ese `.map` guardaba la dirección
para pintar la imagen y **descartaba su identidad**. Nada falló ahí. Falló tres pasos
más adelante, al filmar: sin el id no había con qué referenciar la imagen recién
generada, así que el código se caía a la foto cruda del onboarding — y el clip salía
animado desde un retrato de estudio en vez de desde la escena.

Lo vio el dueño mirando la grilla de Flow, no ningún test.

**La regla: cuando proyectes una lista de objetos a uno solo de sus campos,
preguntá quién más va a necesitar esa fila.** Un `.map(x => x.algo)` es una decisión
de arquitectura disfrazada de conveniencia, y el lugar donde se paga nunca es el
lugar donde se escribe.

## Encolar un trabajo y seguir de largo es hacerlo con el dato viejo

Los trabajos #351 (subir la foto a Flow) y #352 (generar la imagen con esa cara) se
crearon **en el mismo segundo**: la función encolaba la subida y continuaba. La
imagen salió con la cara anterior y la foto recién elegida llegó un latido tarde,
para nada.

Y la forma en que falla es la peor: **no da error, da una imagen** — con la cara
equivocada, cobrada, y sin nada que lo delate. Un selector cuyo efecto se pierde en
una carrera es un selector decorativo que además cuesta plata.

**La regla: si el paso B necesita el resultado de A, B no se encola hasta tener A.**
Esperar un latido no cuesta nada; generar con el dato viejo cuesta la generación.

## Un elemento que se desmonta no se puede seguir con el ojo

El riel del ejemplo se rehízo **cinco** veces y las cuatro primeras fallaron por lo
mismo, que nadie —incluido yo— nombró hasta la quinta: **el video se destruía y se
volvía a crear** en cada cambio de pantalla y en cada pliegue, porque abierto y
plegado eran dos ramas de JSX distintas.

Con eso, ninguna cantidad de rótulos podía contestar «¿qué hace eso ahí?»: la única
respuesta que funciona es que la persona VEA que la cosa que eligió es la misma que
se corrió al costado, y eso exige un nodo con identidad estable.

La pieza que lo resuelve es un solo `<video>` `position: fixed` que recorre tres
estaciones cambiando de caja (`lib` no: `app/video-generator/PreviaVolante.tsx`).
Cuatro detalles deciden si funciona:

- La caja de origen se mide **en el handler del click**: el elemento se desmonta en
  ese mismo commit, así que medirlo en un efecto mide algo que ya no está.
- `useLayoutEffect`, no `useEffect`: con el segundo aparece un cuadro en la posición
  vieja y después salta.
- El destino se **escribe antes** de animar y la animación va al revés (del lugar
  viejo al nuevo): si algo la interrumpe, el elemento ya está donde va.
- Un **fantasma** que se cruza con el original es más simple de escribir y se rompe
  en cuanto algo lo interrumpe: quedan dos videos o ninguno.


---

## Los tres muros que fijan DÓNDE puede vivir el emparejado (31/08/2026)

Se midieron al mudar la configuración del puente al popup de la extensión, y
valen para cualquier cosa que una extensión quiera pedirle al server de MaKo:

1. **No hay a qué llamar.** `crearTokenPuente` guarda `sha256` del token
   (`lib/flow-cola.ts`), así que **ningún endpoint podría devolver el existente
   aunque quisiera**, y su único call site es la server action.
2. **El transporte muere en `proxy.ts`.** Un `fetch` de extensión manda siempre
   `Origin: chrome-extension://<id>`, que nunca coincide con el host → 403 a todo
   POST, con cookie o sin ella. Un GET esquivaría el chequeo (solo cubre
   POST/PUT/PATCH/DELETE) pero **un GET que ROTA una credencial es una primitiva
   de CSRF**: cualquier `<img>` de cualquier sitio desconectaría al cliente.
3. **`PUBLICOS` no sirve**, y lo dice textual `lib/rutas-publicas.ts`: estar ahí
   significa que la ruta **no lee la cookie de sesión**, que es justo lo que un
   endpoint de emparejado necesita.

Y hay un cuarto que no es de código: **mientras la extensión se instale
descomprimida, su id es distinto en CADA máquina.** Fijar `chrome-extension://<id>`
en el proxy rompería al 100% de los clientes, y no fijarlo abriría un POST exento
de CSRF a cualquier extensión con acceso a hola-mako.com.

**Lo que queda: la página deja de ser una PANTALLA y pasa a ser un MENSAJERO.**
`app/video-generator/PuenteEnlace.tsx` no dibuja nada; escucha el pedido del
content script, acuña con la sesión, y contesta por evento. El botón vive en el
popup y el acuñado vive donde está la cookie.

**Vive en:** `extension/mako-puente.js`, `app/video-generator/PuenteEnlace.tsx`.

## Un dato que sale de un global hidratado por callback no es un dato

El popup preguntaba `{tipo:'ESTADO'}` y el service worker contestaba **de forma
síncrona** con `{ conectado: !!bearer }`, leyendo un global que se hidrata por el
callback de `chrome.storage.local.get` al arrancar el worker.

El detalle que lo vuelve inevitable: **el propio `sendMessage` del popup es lo que
despierta al worker en frío.** O sea que la pregunta llega justo cuando el
callback todavía no corrió, `bearer` es `null`, y el popup pinta «falta abrir
Flow» con Flow perfectamente abierto. No es intermitente por carga: es lo que pasa
siempre que el worker estaba dormido, que es casi siempre.

La cura es leer de `storage` en el handler. Y la regla general: **si un valor se
hidrata en un callback, cualquier lectura síncrona de él es una carrera** — no
importa cuánto tiempo «suele» tardar.

⚠️ Y al lado había un segundo bug de la misma familia: el `return true` estaba
**fuera** del `if`, así que el listener dejaba el canal abierto para TODO mensaje
desconocido y el emisor esperaba una respuesta que no iba a llegar nunca.

## Un rastro escrito «al final» no registra las salidas tempranas

`ciclo()` —el latido de la extensión— tiene **cuatro** returns antes del final:
sin token, `!res.ok`, el `catch`, y el `return` de pausado. Escribir el estado
«al terminar el ciclo» deja sin registrar exactamente los casos que hay que
mostrar: el **404** (token rotado porque se conectó otro navegador) y el **fallo
de red**.

Y el modo de falla es el peor: el popup pintaría **el último latido bueno para
siempre**, que se lee como que todo anda.

Va con un acumulador declarado antes del `try` y un `finally` que escribe. La
regla: **cuando instrumentes una función, contá sus salidas antes de elegir dónde
escribir.** Es la misma familia que «la métrica puesta después del early-return no
mide el fallo», que este repo ya tiene escrita para las visitas.

## Un botón a un clic convierte un accidente raro en uno normal

`crearTokenPuente` hace `upsert … onConflict:'workspace_id'`: acuñar un token
**desconecta la máquina anterior**. Mientras eso vivía detrás de un panel de
cuatro pasos en la web, pasaba casi nunca. Con el botón «Conectar» a un clic
dentro del popup, pasa a ser el camino normal.

**La regla: cuando muevas una acción a un lugar más accesible, revisá qué
supuestos de FRECUENCIA tenía.** Lo que era seguro porque «nadie lo hace dos
veces» deja de serlo. Acá quedó un guard por `vivo && listo` —un navegador que
late pero tiene Flow cerrado no está trabajando, así que no tiene derecho a
bloquear al que sí— y una salida explícita que **nombra al otro navegador**, que
es lo único que convierte esto en una decisión en vez de una sorpresa.

## Y el saldo NO puede leerse desde el service worker

Medido y escrito en `extension/background.js`: un pedido a `/v1/credits` desde el
worker viaja con `Origin: chrome-extension://` y sin las cookies del sitio, y
Google contesta su página de bloqueo. Sale de la **página** de Flow o no sale.

**Corolario duro: leer los créditos siempre exige la pestaña de Flow abierta**,
por autónomo que sea el popup. Por eso «Abre Google Flow» no se puede saltear.


## El bucle de «La toma 1 no salió»: el rechazo sobrevivía a su propia cura

**Vive en:** `app/video-generator/tomas-invalidar.ts`, `app/video-generator/video-action.ts`,
`app/video-generator/WizardAnuncio.tsx`, `lib/flow-fallo-texto.ts`

Reportado el 31/08/2026 como *«entra en un bucle infinito de "La toma 1 no salió"…
y me vuelve a la tab anterior»*. Eran **cuatro** defectos distintos apilados en la
misma pantalla, y ninguno daba error.

### 1. El bucle: nadie borraba el fallo cuando cambiaba lo que lo había causado

Google rechazó la toma 1 (`PROMINENT_PERSON`). La pantalla ofrecía arreglar el
escenario; se arreglaba; se apretaba Continuar; `pasoDe` volvía a la toma 1 —que
seguía con el `error` del intento viejo— y la pantalla volvía a ofrecer arreglar
el escenario. Sin salida y sin un solo mensaje de error.

Las dos pantallas estaban bien por separado: cada una hacía lo suyo. Lo que
faltaba era que **rehacer la ENTRADA invalidara el resultado que esa entrada
había producido**. Es «rechazar deja una deuda» con nadie encargado de saldarla.

El corte va en `guardarImagen`, que es el choke point por el que pasan las tres
actions que escriben una imagen. Y la condición es que **`elegida` CAMBIE, no que
se apriete Continuar**: confirmar no cambia la entrada, así que limpiar ahí
ofrecería filmar de nuevo la misma imagen que Google ya rechazó, a ~15 créditos
la vuelta. **Un bucle gratis es un bug; uno que cobra es peor.**

Lo que NUNCA se olvida: una toma con `url` (créditos pagados) y una toma en vuelo
(borrarla deja el trabajo huérfano y su resultado sin dónde caer).

### 2. El porqué se calculaba y no se dibujaba

`textoFlow` devuelve título, detalle y acción. La pantalla de la toma usaba
**sólo el título**, en `pregunta`, y tiraba el resto — así que el paso más caro
del recorrido mostraba «La toma 1 no salió» y nada más. El dueño lo reportó dos
veces con la misma frase: *«no hace nada, ni un mensaje de error»*. Era literal: el
mensaje estaba clasificado y guardado en la base, y no llegaba al DOM.

Es «escribir la salida no es ofrecerla», en el mismo archivo donde esa lección ya
estaba escrita dos veces. **Un `grep` del campo no alcanza cuando el objeto SÍ se
usa**: `txt` aparecía en cuatro lugares y en ninguno era `txt.detalle`.

### 3. «Elegir otra foto» era la mitad equivocada de la cura

El clip **no se anima desde la foto del perfil: se anima desde la imagen del
escenario** (`elegidaId`, en `generarTomaAction`). Cambiar la foto y volver a
filmar le manda a Google exactamente la misma cara que ya rechazó, y cobra otro
clip por el mismo resultado. Lo que cambia lo que Google mira es una imagen de
escenario nueva — y eso además no cuesta créditos.

El texto de `persona_publica` decía «elegir otra foto» y el botón sólo NAVEGABA,
dejando a la persona en un paso desde donde Continuar la traía de vuelta al mismo
error. Ahora el botón genera la imagen y lleva ahí a mirarla: **una promesa, un
efecto**.

⚠️ **La regla general:** antes de escribir la instrucción de un error, seguí la
cadena de entradas hasta la que el proveedor realmente mira. Una instrucción que
nombra el eslabón equivocado se lee como una solución y gasta el presupuesto.

### 4. El crudo se recortaba justo por la punta donde vive el motivo

`errorCrudo: texto.slice(0, 1200)`. En la respuesta de Flow el principio es el
prompt —que ya tenemos escrito en el plan— y el motivo vive al final:
`mediaStatus`, `failureReasons`, el `PUBLIC_ERROR_…`. Medido sobre el rechazo
real: los 1200 caracteres guardados terminaban a la mitad del prompt y **no
contenían una sola palabra de por qué había fallado**.

La clasificación estaba bien —se hace sobre el texto entero, antes de recortar—,
así que el daño no fue un mensaje equivocado: fue que después **no hubiera forma
de comprobarlo**. Queda `crudoGuardable()`, que se queda con las dos puntas.

### 5. Y un `ok: false` puede haber ESCRITO igual

`correr()` aplicaba `r.item` sólo cuando `r.ok`. La salida temprana de «todavía
estoy subiendo tu foto» borra el fallo del intento anterior **antes** de
rendirse, y ese trabajo se descartaba: la pantalla seguía pintando el error viejo
arriba y el nuevo abajo, contradiciéndose. Lo reportó junto: *«no solo me sigue
apareciendo el mismo mensaje erróneo, sino que me dice también que está subiendo
la foto cuando ya la subió»*.

**Una action que falla puede haber cambiado el estado.** Tirar su `item` deja la
pantalla afirmando algo que el server ya no tiene — y dos mensajes que se
contradicen no confunden sólo sobre ese punto: hacen desconfiar de todos los
demás.

### El método que los separó

Los cuatro se veían como un solo síntoma. Lo que los partió fue **preguntarle a
la base qué decía la marca**, en vez de leer el código buscando el bug: `errorAt`
fechaba el rechazo, `errorCausa` decía `persona_publica`, y el `errorCrudo` no
alcanzaba a contener la evidencia — tres respuestas de tres defectos distintos en
un solo registro. Es la regla de la casa: cuando N cosas fallan, contá cuántas
CAUSAS hay antes de buscar la causa.


## Auditoría del /video-generator: dónde se pierde trabajo pagado

**Vive en:** `app/video-generator/` (`video-action.ts`, `WizardAnuncio.tsx`,
`video-datos.ts`, `puente-actions.ts`)

Corrida de 23 agentes el 31/08/2026, con un escéptico por hallazgo: **19
hallazgos, 16 sobrevivieron**. Cuatro ángulos —qué destruye trabajo, qué deja sin
salida, qué se calcula y no se dibuja, qué estado sobrevive a su causa—.

El patrón que comparten casi todos y que conviene tener a mano: **este módulo
gasta créditos reales, y sus fallas no dan error — dan una pantalla plausible.**

### Lo que se arregló

| Qué pasaba | Por qué |
|---|---|
| «Rehacer la toma N» borraba el clip pagado antes de saber si podía refilmar | Es `descartar` + `generar` en un click, y `generar` tiene CINCO puertas que devuelven sin filmar. Ahora se archiva (`MarcaVideo.descartadas`) |
| El .mp4 nuevo pisaba el anterior | `guardarClip` subía a una ruta fija con `upsert: true`. Ahora la ruta lleva la operación |
| Un enlace firmado vencido tapaba el pedido de uno nuevo | El `return` del enlace estaba ARRIBA del re-encolado: un clip pagado quedaba inalcanzable **para siempre** |
| El diagnóstico se borraba antes de esos cinco guards | Una toma rechazada se veía como una que nunca se intentó |
| `ciego.error` se calculaba y se pintaba el genérico | El parámetro `delServidor` ya existía y nadie se lo pasaba |
| «Atrás» de una toma iba al ÚLTIMO escenario | Y tocar una variante ahí reabría un paso ya cerrado |

### Lo que quedó SIN hacer

**Cambiar la foto no invalida la imagen del escenario ya generada**
(`video-action.ts`, `elegirFotoAction`). Y es la cura DOCUMENTADA para el rechazo
`persona_publica`: la persona cambia la foto, aprieta Continuar… y «Continuar»
CONFIRMA la imagen vieja en vez de rehacerla. El selector de fotos no gobierna
nada una vez que la imagen existe. **Éste es el más caro de los pendientes.**

**El anuncio terminado es una puerta de un solo sentido**
(`WizardAnuncio.tsx`, paso `listo`). El «Atrás» está escrito y no se dibuja
nunca: `Volver` vive adentro del `{boton && …}` de `Estudio`, así que desaparece
en toda pantalla sin botón principal. Con eso quedan inalcanzables los pliegues
«Rehacer la toma N» de los siete clips.

**«Volver» desde «¿Apruebas este clip?» cae en una toma ya filmada** cuyo botón
promete cobrar ~15 créditos y no hace nada — el freno de plata devuelve `ok` sin
generar. Es el éxito falso servido por el camino más natural que existe.

**El paso del escenario tiene el defecto que la toma ya arregló**: el rótulo sale
de `txt.accion` y el `onClick` llama siempre a `generarImagenAction`. Con el
filtro de contenido el botón dice «Decir qué cambiar» y reenvía el mismo prompt.
Las dos curas —reescribir el prompt, subir tu propia imagen— están implementadas
en el server y son inalcanzables desde la pantalla justo en el estado en que
hacen falta.

**Si MaKo no logra escribir los escenarios, la pantalla queda sin un solo botón**
y reintenta sola cada pocos segundos, sin tope y sin que nada lo cuente.

**«Ya lo hice, volver a habilitar» borra TODOS los trabajos fallidos del
workspace** (`puente-actions.ts`), no sólo los que mató la marca de sesión: se
lleva la evidencia cruda de toda falla anterior — justo lo que este módulo se
esforzó en conservar.

**El tope de 10 del historial evicta un anuncio terminado sin avisar** y
huerfaniza sus siete clips: los .mp4 siguen en el bucket colgados de un `planId`
que sólo vivía en esa fila de `app_settings`.

**`fotoId` y el mapa `flow.caras` sobreviven al borrado de la foto**: se sigue
generando con una cara que ya no existe, mientras la pantalla muestra otra.

**4 de los 7 campos de `EstadoContextoVideo` se calculan en cada carga y no los
lee nadie** — dos consultas por página cuyo resultado se descarta, incluido el
aviso que el propio módulo declara como su razón de leer el perfil.

### Y el método, que es lo que se reusa

Los cuatro ángulos se eligieron por **modo de falla**, no por archivo: qué
destruye, qué deja sin salida, qué no se dibuja, qué queda viejo. Esa partición
es la que hizo que 23 agentes no se pisaran — y el escéptico por hallazgo mató 3
de 19, todos por la misma razón: describían un camino que un guard de más arriba
ya impedía.


## El prompt de un clip con referencia sólo dice QUÉ HACE la persona

**Vive en:** `lib/prompts-video.ts`, `lib/video-planner.ts`

El prompt de video lo escribía un modelo, y salía describiendo la toma desde
cero y en inglés: *«Close-up selfie angle filmed with a handheld smartphone
inside a parked car…»*. Suena razonable y está mal: **el clip no se genera de la
nada, se anima DESDE la imagen del escenario**, que ya tiene el auto, la luz, el
encuadre y la cara resueltos. Un prompt que vuelve a describir todo eso le
compite a la imagen en vez de apoyarse en ella.

De ahí que el prompt de video sea corto y el de imagen larguísimo. No es una
inconsistencia: **el de imagen tiene que fijar una fotografía completa porque no
hay nada previo; el de video hereda todo eso y sólo agrega movimiento.**
Alargarlo es volver a pelearle a la imagen.

### Y el guion traía asteriscos que nunca se habían notado

Medido: **12 de los 14 clips del historial** tienen `**énfasis**` adentro de
`voz`. Lo escribe el planificador para que se vea al LEER el guion, y ahí está
bien.

Hasta ahora no llegaban al modelo **por casualidad**: el prompt lo redactaba el
mismo modelo, que al copiar la línea adentro de `Script: "…"` los dejaba afuera.
El día que el guion se interpola verbatim en una plantilla, ese accidente
desaparece — y `"apagando una **bronca que ya existía** desde…"` es un texto que
el modelo de video puede leer en voz alta o directamente romper.

⚠️ **La regla: lo que se MUESTRA y lo que se DICE no son el mismo texto.** Cuando
un campo cruza de la pantalla a un modelo que lo va a pronunciar, hay que sacarle
las marcas de lectura. Y el corolario de diagnóstico: **una protección que existe
por accidente no aparece en ningún grep.** Nada en el código sacaba esos
asteriscos; lo que los sacaba era que un modelo reescribía la frase en el medio.
Cuando quites un paso intermedio, preguntá qué estaba haciendo sin que nadie se
lo hubiera pedido.

### Falso positivo que casi reporto

Mi chequeo de «¿el prompt viaja intacto?» dio **NO**, y el prompt viajaba
perfecto: comparaba la cadena cruda contra `JSON.stringify(cuerpo)`, donde el
salto de línea ya es `
` escapado. Verificar recorriendo el objeto dio 1
coincidencia idéntica. **Un chequeo que compara texto contra JSON serializado
mide el escapado, no el contenido.**


## La geometría del riel: por qué «el preview está mal ubicado» volvió tantas veces

**Vive en:** `app/_ui/ui.css` (bloque `.mk-estudio`), `app/video-generator/WizardAnuncio.tsx`

Reportado seis o siete veces con la misma frase, arreglado cuatro. La cuenta,
medida por fin:

    despeje = 16 − (D − A)/2 − S/2

con **A** = el ancho que el paso DECLARA (`--riel-contenido`), **D** = el que de
verdad DIBUJA, y **S** = la barra de scroll. Eran dos defectos sumándose:

**1. Declarar el ancho no alcanza: hay que dibujarlo.** El paso `cara` declaraba
620 y dibujaba `2·W + 20`, porque sus dos `Vertical` iban sin la prop `ancho` —
y sin ella la caja sale de `height: min(62vh,720px)` + `aspect-ratio`, o sea que
**su ancho cambia con el ALTO de la ventana**. Con `flex: none` no puede
encogerse, así que desborda y se come el filete. Se pisa cuando W > 314, o sea
con la ventana más alta que ~900px — por eso aparecía y desaparecía según la
pantalla. La regla estaba escrita en el propio docstring de `Vertical` («donde
hay dos, manda el ancho») y el paso hermano ya la aplicaba.

**2. Los dos anchos de ventana.** El CSS restaba `64px` de sidebar cuando el
`<aside>` mide **68**, y usaba `100vw` —que **incluye** la barra de scroll—
contra el `right:` de un `position: fixed`, que **no la incluye**. Los dos
errores corren para el mismo lado: **2px + S/2 de corrimiento permanente**. Con
una barra de 15px, el hueco que tenía que ser de 16 quedaba en 6,5. Ahora el JS
baja `--riel-vw` medido con `clientWidth`.

⚠️ **La trampa que queda viva:** la caja de contenido del estudio mide
`A − 60 − S`, no `A`. Los 16px aparecen **porque el contenido DESBORDA 30px por
lado**. Si alguien le pone `width: 100%` o un `maxWidth` al cuerpo de un paso, el
contenido deja de desbordar y aterriza a **44px** del filete. Es lo que le pasa
hoy a `guion-leer`, que declara 760 y dibuja 700 − S.

**Y los fallbacks del CSS mienten**: `--riel-calle` cae a 20px donde el JS manda
16, `--riel-ancho` a 341px donde el JS manda un `calc`. Si el paso no trae
`puesta.ejemplo`, `anchoRiel` es `undefined` y manda toda esa columna de valores
falsos. Un fallback que no coincide con el valor real no es una red: es un
segundo diseño que nadie revisó.
