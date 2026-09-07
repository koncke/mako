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


## El respaldo de plantillas no sabe de quién es

**Vive en:** `extension/mako-puente.js`, `extension/background.js`,
`app/api/flow/puente/route.ts`, `lib/flow-plantillas.ts`

Auditoría de aislamiento entre workspaces, 31/08/2026: 14 agentes, **10
hallazgos, 9 refutados por los escépticos, 1 real**. Éste.

El respaldo de plantillas de Flow vive en `chrome.storage.local` bajo **una clave
global** —`plantillas`—, sin token ni workspace adentro. Emparejar el mismo
navegador con otro cliente pisa el `token` y **no toca ese respaldo**, así que el
latido siguiente sube al workspace nuevo lo aprendido con el anterior: el
`projectId` de Flow de aquel cliente, el cuerpo de su generación y el `mediaId`
de su cara. El server lo persistía sin mirar procedencia, y en el latido
siguiente se lo bajaba al navegador real del otro cliente como «faltantes».

Es el caso normal del super-admin, que abre un cliente por pestaña.

⚠️ **Y lo que hace difícil verlo: nadie gana un permiso que no tenía.** El que
empareja está autorizado en los dos workspaces, y el Google que paga es siempre
el del navegador que apretó Conectar. Por eso pasa todos los filtros mentales de
«¿esto es una vulnerabilidad?» — y sin embargo los datos de un cliente terminan
**persistidos en la fila de otro**. La pregunta de una auditoría de aislamiento
no es «¿alguien escala privilegios?» sino **«¿un dato de A puede terminar en
B?»**.

**El arreglo va en los dos lados, y son dos lados distintos a propósito:** la
raíz es de la extensión —cambiar de token borra `plantillas`, `firmaPlantillas`,
`projectId` y `ultimoRedirectMedio`—, pero eso depende de que el cliente
actualice. El server no puede resolverlo solo (recibe un token válido) **salvo
por un dato que ya viene en el mismo request**: el `projectId` que el navegador
está mirando.

⚠️ **Sólo se descarta lo que se puede PROBAR ajeno.** Una plantilla sin
`projectId` —`credits`, `uploadImage`, las dos de video— pasa: tirarla sería
castigar la falta de evidencia, y son las que hacen andar el saldo y la subida de
fotos. Y si el puente no reporta proyecto, no se filtra nada: sin la mitad de la
comparación no hay comparación.

### Lo que la auditoría confirmó CERRADO

Vale escribirlo porque es lo que evita volver a auditarlo:

| Superficie | Por qué está cerrada |
|---|---|
| El puente | Se identifica por TOKEN, no por cookie. `workspaceDeToken` **nunca acepta un workspace por parámetro** |
| La cola | El RPC `flow_tomar_trabajos` filtra por `workspace_id` en sus TRES sentencias |
| Entregar el resultado | `resolver`/`fallar` filtran por workspace **y** por id |
| Las tablas | `flow_trabajos` y `flow_puentes` están en `TENANT_TABLES`: el proxy inyecta el filtro solo |
| Los ajustes | `getSetting`/`setSetting` scopean por `wsActual()` siempre |
| Las actions | Resuelven el plan desde el historial DEL WORKSPACE ACTUAL: un `planId` ajeno no se encuentra |
| Anon | `flow_trabajos` y `flow_puentes` contestan `permission denied` |

⚠️ **`video-clips` es un bucket PÚBLICO** y la ruta no lleva el workspace. NO es
un cruce —los dos segmentos son UUID y la url sólo vive en el historial de su
dueño— pero es un link público y permanente. Medido: `HEAD` sin sesión → 200.
Listar sí está cerrado, y se comprobó **con objetos adentro**, que es lo único
que distingue «denegado» de «bucket vacío».

⚠️ **Y el default que hay que recordar:** una request **sin cookie de sesión**
resuelve a `OWNER_WS`. Está puesto para crons y webhooks, y el puente no depende
de eso porque usa el token — pero cualquier endpoint nuevo que se autentique por
su cuenta y llame a `getTenantDb()` va a trabajar en silencio sobre los datos de
Mauricio.

### El residuo anotado y NO arreglado

El token del puente es un **bearer que sirve fuera del navegador y sobrevive al
logout**, y el `forzar` lo elige quien pide. Eso convierte «un script en la
página» en «una credencial persistente exfiltrable». No es un cruce entre
workspaces —un script que ya corre en el origen de la víctima tiene su sesión— y
por eso quedó afuera de este arreglo. Es endurecimiento, y vive en
`app/video-generator/PuenteEnlace.tsx` y `lib/flow-cola.ts`.


## Cerrar la lista de los 11: qué se arregló y qué queda

**Vive en:** `app/video-generator/`, `lib/guion-reparto.ts`, `lib/puestas-data.ts`

Cierre del 01/09/2026, sobre la lista que 12 agentes habían verificado viva.
Diez arreglados, uno que el rediseño dejó sin efecto, y uno a medias.

### Lo que las une

Casi todas eran **una decisión correcta aplicada mirando sólo a su vecino**:

- El tope del historial recortaba por fecha sin mirar si lo que tiraba estaba
  pagado.
- La compactación del guion se negaba a vaciar una toma mirando sólo a la de al
  lado, en vez de preguntar si había con qué rellenarla más adelante.
- `elegirFotoAction` escribía el `fotoId` sin mirar lo que esa foto ya había
  producido.
- `rehabilitarPuenteAction` borraba todos los fallidos sin mirar el motivo.
- `caraEnFlow` usaba el mapa cacheado sin mirar si la foto seguía existiendo.

⚠️ **La forma de reconocerlas: un guard que protege UNA cosa y decide mirando
UNA sola.** Cuando el estado que gobierna la decisión está a dos saltos —la toma
siguiente, el motivo del fallo, la imagen que produjo el clip—, el guard es
correcto en su vecindario y equivocado en el sistema.

### Lo que quedó a medias, con su límite nombrado

**El reparto del guion.** De 82 palabras en la última toma a 41, con las siete de
arriba llenas y sin perder una palabra. Lo que queda es la **granularidad de las
piezas**: se cortan contra el tope más chico, así que una toma con 6 de lugar no
puede aceptar una de 12. Partirlas más fino ya se probó **y los tests lo
frenaron: rompía el CTA**, que es lo único del guion que tiene que llegar entero.

La salida no es más algoritmo: es el editor de clips. Sumar una toma es un click.

### Y uno que se arregló solo

«Volver desde *¿Apruebas este clip?* cae en una toma filmada cuyo botón cobra y
no hace nada» dejó de ser posible cuando el paso único reemplazó a `cara` y
`toma`: `pasoDe` ya no los devuelve. **Un rediseño puede cerrar un pendiente sin
tocarlo** — conviene re-verificar la lista después de uno, y no darla por vigente.

## Media espera de punta a punta la poníamos nosotros (01/09/2026)

**Vive en:** `extension/background.js` · `app/video-generator/avisar-puente.ts` ·
`lib/video-planner.ts` · `lib/flow-protocolo.ts`

El dueño: *«hay cosas que demoran muchísimo y no deberían, ya que en flow se genera
rápido… es nuestro problema»*. Tenía razón, y se puede medir.

Partiendo los 348 trabajos `listo` más recientes en dos tramos —de `created_at` a
`tomado_at` (dormido en la cola) y de `tomado_at` a `listo_at`— en segundos:

| tipo | n | espera med | p75 | p90 | ejecución med | % perdido esperando |
|---|---|---|---|---|---|---|
| `estado_clips` | 234 | 13,6 | 167,6 | 357,3 | 14,6 | 48% |
| `creditos` | 35 | 8,2 | 12,8 | 13,4 | 14,2 | 37% |
| `generar_clip` | 32 | 10,3 | 14,2 | 30,9 | 28,9 | 26% |
| `enlace_clip` | 25 | 14,0 | 14,4 | 14,9 | 14,2 | 50% |
| `generar_imagen` | 17 | 10,3 | 12,7 | 14,7 | 43,9 | 19% |

### ⚠️ El dato que lo delata NO es el 48%: es la uniformidad

Lo que rompe el caso no es ninguno de los porcentajes, es que **una consulta de
estado y un pedido de enlace tarden los dos ~14 s**. Son dos operaciones que no se
parecen en nada. Dos trabajos distintos que tardan lo mismo no están trabajando:
están esperando algo fijo, y ese algo es de uno.

Sirve como olfato general: **cuando dos operaciones de costo muy distinto miden
igual, el número no es trabajo — es una constante tuya**. Un promedio por tipo lo
muestra en una tabla; un promedio global lo habría escondido.

### Las cuatro esperas, y por qué ninguna era la guarda anti-bloqueo

1. **`cuantos: 1`** — la extensión pedía UN trabajo por latido. Un clip no es un
   trabajo: son ~9 (generarlo, preguntar ~7 veces cómo va, pedir el enlace), o sea
   nueve alarmas de 15 s. La mediana de 13,6 s es exactamente lo que predice pedir
   de a uno: **media alarma**. El servidor ya topeaba en 5 y el RPC ya protegía con
   `FOR UPDATE SKIP LOCKED`; el cliente pedía uno por su cuenta.
2. **El cooldown después del ÚLTIMO trabajo del lote** — los 10 s separan una
   llamada a Google de la SIGUIENTE. Después de la última no hay siguiente en ese
   ciclo, así que no espaciaban nada.
3. **El resultado dormía un latido entero antes de reportarse** — se guardaba en
   `pendientes` y se mandaba al PRINCIPIO del ciclo siguiente. **Éste es el ~14 s
   uniforme.**
4. **El primer trabajo esperaba a la alarma** — apretar «Generar» costaba hasta
   15 s (30 en una extensión empaquetada: es el mínimo que impone Chrome) sobre un
   trabajo que ya estaba encolado.

### La regla: separar la GUARDA del RITMO

`cooldownMs` es la guarda —lo único entre un cliente y un
`PUBLIC_ERROR_UNUSUAL_ACTIVITY`, que le bloquea la sesión de Google—. Las cuatro
esperas de arriba **no eran esa guarda**: eran el ritmo del transporte, y estaba
puesto muy por debajo de lo que la guarda permitía. Cuando algo va lento y hay un
límite de seguridad cerca, la pregunta no es «¿puedo aflojar el límite?» sino
**«¿estoy respetándolo, o estoy MUY por debajo sin darme cuenta?»**. Acá el
`cooldownMs` no se tocó y aun así se recuperó la mitad del reloj.

### Y el corolario del sondeo: preguntar costaba más que hacer

234 de 348 trabajos eran «¿cómo va el clip?». `consultarUnaVez` ya deduplica bien
(no encola una consulta si hay otra viva para esa operación), así que no era un
flood: era que **cada pregunta pagaba el viaje completo**. Cuando un contador de
trabajos está dominado por los que sólo PREGUNTAN, el arreglo no es preguntar
menos — es que preguntar salga barato.

### El primer paso: se pedía el campo más largo para tirarlo

*«Cuando acomoda el guion en las tomas, se demora increíblemente mucho para una
tarea simple»*. El reparto en tomas ya lo hace el código (`repartirGuion`), así que
lo simple es simple. Lo que tardaba era otra cosa: el plan le pedía al modelo un
`prompt` de video por clip —un párrafo cinematográfico en inglés— y **para un
formato con prompt propio ese campo no se usa nunca**: `promptDeClip` le gana
entero. Car Talks declara `habla: 'siempre'`, así que se descartaban los siete.

Y lo único que sobrevivía de ese párrafo era el acento… que tampoco lo escribía el
modelo: lo pega `conAcento()` con el texto que eligió el cliente. Le pedíamos que
nos devolviera un dato que ya teníamos.

**La regla, que es la de siempre corrida un lugar:** «escribir la salida no es
ofrecerla» tiene una gemela del lado de la entrada — **pedirle a un modelo un campo
que después se descarta no es sólo código muerto: es tiempo de generación que el
cliente paga mirando un loader**. Al agregar una precedencia («el prompt del formato
le gana al del modelo»), la pregunta que sigue es si todavía hace falta PEDIR lo
que perdió.

Se comprueba con un `grep` del campo: si sus únicos lectores están detrás de un
`if` que casi siempre es falso, dejá de pedirlo en ese caso.

**Lo que NO se hizo, a propósito:** los formatos sin prompt validado siguen pidiendo
el suyo. Copiarles el de Car Talks sería peor que no tener ninguno — habla de la
palanca de cambios, y en una oficina eso no es un detalle de más, es una instrucción
falsa.

**Sigue pendiente:** publicar la extensión en la Chrome Web Store. La tienda tiene
≤0.36.0, así que **quien la instale desde ahí no tiene nada de esto**. El ZIP de
`/video-generator` sí (0.37.2).

## ⚠️ El p90 de 357 s NO era la cola: eran cuatro operaciones colgadas (01/09/2026)

**Vive en:** `app/video-generator/video-action.ts` (`consultarUnaVez`, la rama
`MEDIA_GENERATION_STATUS_FAILED`)

Corrección a la lectura de la tabla de arriba, y vale más que la tabla.

`estado_clips` eran 234 de 348 trabajos, con un p90 de espera de 357 s. Se lee como
«la cola de consultas está saturada». Contando las consultas **por operación** sobre
las 400 más recientes:

```
  104  …4c49574b68db   desde 2026-08-30 13:24
   74  …46fb36e3ffaf   desde 2026-08-31 04:28
   42  …48a078c3808f   desde 2026-08-31 18:47
   41  …9cc4f10b2989   desde 2026-08-31 02:50
    2  …6c78d4ae39d0   desde 2026-09-01 02:40
    2  …a04db0d040ac   desde 2026-09-01 02:00

  31 operaciones · MEDIANA: 1 consulta por operación
```

**261 de 400 consultas —el 65%— salieron de CUATRO operaciones**, todas anteriores
al 31/08. Eran los bucles de la toma que Google ya había rechazado y que se seguía
preguntando para siempre: el defecto que cerró la rama
`MEDIA_GENERATION_STATUS_FAILED`. Después de eso, la mediana es **1 consulta por
operación**.

### Las dos lecciones, y la segunda es la cara

1. **Un percentil alto sobre una cola puede ser un BUCLE, no una saturación.** Y los
   dos se ven idénticos en un agregado por tipo: muchas filas, mucha espera. Lo que
   los separa es **agrupar por la entidad** (acá, la operación) y mirar la
   distribución. Una mediana de 1 con un p90 de 357 s no es una cola cargada: es un
   puñado de casos rotos ahogando a los sanos. Vale para cualquier tabla de eventos.

2. **Un hallazgo de un subagente sobre datos históricos no fecha lo que lee.** Un
   agente reportó, con evidencia correcta, que una operación tuvo *«42 consultas con
   el mismo `MEDIA_GENERATION_STATUS_FAILED`»*. Cierto — y de **antes** del arreglo
   que estaba en el commit anterior. Es exactamente lo que ya está en `AGENTS.md`
   («un agente no distingue "nunca estuvo roto" de "se arregló hace una hora»),
   corrido de código a datos: **una tabla de eventos guarda el pasado, incluido el
   que ya se arregló**. Antes de tratar un conteo histórico como el estado de hoy,
   partilo por fecha.

**Lo que esto NO invalida:** la espera mediana de 13,6 s y los ~14 s de reporte
tardío eran reales y los pagaba **todo** trabajo, sano o no. Los arreglos siguen
valiendo lo que valen. Lo que cambia es qué esperar: el alivio va a verse en la
MEDIANA, no en un p90 que ya se había ido con otro arreglo.

## Por qué las consultas de estado NO se pueden agrupar en una

**Vive en:** `app/video-generator/video-action.ts` (`parchesEstadoClip`) ·
`extension/injected.js` (`fundir`)

Sale solo: el endpoint de Google se llama `batchCheckAsyncVideoGenerationStatus` y
toma una LISTA, así que preguntar por las siete tomas en un solo trabajo parece
gratis — 7 consultas → 1, y encima menos llamadas a Google, que es estrictamente
más seguro.

**No se puede, y la razón ya está pagada en este repo.** Nosotros no MANDAMOS ese
pedido: lo parcheamos. `fundir()` reemplaza arrays enteros a propósito, así que
mandar `operations: [...]` tira el array de Flow con todos los campos que cada
entrada lleva al lado del `name` y que no sabemos que existen — es la causa medida
del HTTP 400 «Request contains an invalid argument» del 31/08. El parche por camino
escribe `operations[0].operation.name` y nada más, y funciona **porque esa entrada
ya existe en el pedido de Flow**.

Para preguntar por siete habría que CREAR `operations[1..6]` desde cero, o sea
volver justo al modo de falla que el parche vino a evitar: un pedido mal formado
hecho por nosotros.

**La regla: en un espejo, lo que se puede parchear es lo que el original ya tiene.**
La forma del endpoint dice lo que Google acepta; el pedido real dice lo que nosotros
podemos escribir. Son dos preguntas distintas, y la segunda es la que manda.

**Lo que sí quedaría** —sin tocar el espejo— es que la extensión mire sola una
operación en vuelo en vez de esperar a que MaKo le encole cada consulta. Con la
mediana en 1 consulta por operación ya no es urgente.

## Y el otro camino descartado: aflojar el cooldown en las lecturas

**Vive en:** `lib/flow-protocolo.ts` (`PERFILES`, `soloLectura`) ·
`extension/background.js`

294 de 348 trabajos son de SOLO LECTURA —`getCredits`,
`batchCheckAsyncVideoGenerationStatus`, `getMediaUrl`— y los tres pagan el mismo
`cooldownMs` de 10 s que una generación. El dato para distinguirlos **ya viaja**:
`perfilDeTrabajo` escribe `soloLectura` dentro del `pedido` al encolar, y la
extensión no lo lee nunca.

Es tentador y **no se hizo**, por una razón concreta: el número con el que habría
que reemplazarlo no está medido. Lo que hace segura una lectura frecuente sería que
coincida con el ritmo al que la propia página de Flow pollea su estado, y ese ritmo
no lo tenemos — `LIMITES.pollMs` es una elección nuestra, no una medición de Flow.
Poner un número a ojo contra un guard cuyo modo de falla es **bloquearle la sesión
de Google a un cliente** es exactamente lo que la regla del umbral prohíbe.

**Lo que falta para poder hacerlo:** el espía de la extensión (`VER_ESPIA`) ya
captura los pedidos que hace la página de Flow por su cuenta. Con una sesión
generando, contar cada cuánto llama ella misma a
`batchCheckAsyncVideoGenerationStatus` contesta la pregunta con un dato y no con una
estimación. Es una tarde y cierra un 10 s en el 84% de los trabajos.

## ⚠️ Dos cambios que no tocan una guarda pueden desarmarla JUNTOS (01/09/2026)

**Vive en:** `extension/background.js` (el bucle que ejecuta el lote)

Lo cazó un revisor adversario sobre un commit que ya estaba desplegado, y es el
hallazgo más caro de esta tanda porque **ninguna prueba lo podía encontrar**.

El `cooldownMs` —lo único entre un cliente y un `PUBLIC_ERROR_UNUSUAL_ACTIVITY`,
que le bloquea la sesión de Google— vivía como un `await sleep(cooldownMs)` en la
cola del `for` que ejecuta el lote de trabajos. Eso espacia a los trabajos **de un
mismo lote**. Entre el último de un lote y el primero del siguiente no espaciaba
nada: lo hacía la alarma de 15 s, **por accidente y sin que nadie lo dijera**.

Dos cambios, cada uno correcto y verificable por separado:

1. sacar el sleep después del último trabajo del lote — no espaciaba nada, era
   tiempo muerto que pagaba el cliente mirando el loader;
2. encadenar el ciclo siguiente en el acto en vez de esperar la alarma — sólo
   adelanta un viaje a NUESTRO servidor, no le habla a Google.

**Juntos**, el último trabajo de un lote y el primero del siguiente quedaban
separados por ese viaje: **~0,3 s donde el piso son 10**.

### Por qué esto no se encuentra revisando ninguno de los dos

- Cada cambio, leído solo, es defendible — y los dos comentarios que escribí
  argumentaban bien su propio caso.
- No hay síntoma: no falla nada, no hay error, no hay test que se ponga rojo. El
  sistema simplemente le habla a Google más rápido de lo permitido, y **la factura
  llega días después y en la cuenta de otro** (la sesión bloqueada es la del
  cliente, no la nuestra).
- La guarda que se rompió **no estaba en ninguno de los dos diffs**.

**La regla: cuando un guard depende de dos cosas —una explícita y una accidental—
el diff que toca sólo la accidental no muestra nada.** Antes de cambiar el ritmo
de cualquier cosa, escribí qué mantiene hoy el espaciado REAL, no cuál es la línea
que dice `cooldown`. Acá el espaciado real era «el sleep del bucle **o** la
alarma», y el segundo término no estaba escrito en ningún lado.

### El arreglo: el cooldown como PISO, no como sleep al final del bucle

```js
const falta = cooldownMs - (Date.now() - (await ultimaLlamadaFlow()));
if (falta > 0) await esperar(falta);
…ejecutar…
await marcarLlamadaFlow();
```

Tres decisiones que no son de estilo:

- **El sello va DESPUÉS, no antes.** El ritmo original dormía al TERMINAR, así que
  el hueco real entre dos pedidos era «lo que tardó el primero + 10 s». Sellando al
  empezar se encogería a 10 s a secas — más rápido que antes, que es justo lo que no
  se puede hacer sin medir.
- **Se sella aunque la llamada falle.** Un pedido rechazado igual salió, y
  reintentar rápido contra un bloqueo es como se profundiza un bloqueo.
- **El reloj va en `chrome.storage`, no en un global.** El service worker MV3 se
  muere seguido y un piso en memoria se reinicia con él: la primera llamada del
  worker nuevo saldría sin esperar. **Un guard que se olvida de lo que pasó hace
  diez segundos es un guard el 80% de las veces**, que es exactamente el que no
  sirve cuando del otro lado hay un detector de actividad automática.

Con esto la guarda queda igual de estricta que siempre **y además vale entre ciclos,
entre latidos y entre reinicios del worker** — donde antes no valía y nadie lo
sabía. El tiempo muerto se recupera igual.

### Y la lección sobre el panel adversario

Los 18 veredictos del panel dieron 3 seguras, y **la mayoría de los ⛔ eran «esto ya
está aplicado»**: los agentes leyeron el árbol mientras yo lo editaba, que es la
trampa ya documentada en `AGENTS.md`. Fue ruido. Pero **uno solo de esos dieciocho
encontró un defecto real, introducido esa misma hora, que ningún test podía ver** —
y ése justificó la corrida entera. Un panel adversario no se mide por su tasa de
acierto: se mide por si el hallazgo que sí trae es de los que no se encuentran de
otra forma.

## Una ventana GLOBAL para una pregunta que es de UNA entidad (01/09/2026)

**Vive en:** `app/video-generator/video-action.ts` (`estadoTomaAction`)

`estadoTomaAction` traía las últimas 12 filas de `estado_clips` **de cualquier
operación** y recién después filtraba en JS por la suya. La pregunta es de una
toma; la ventana era del sistema entero.

Con varias tomas en vuelo, las doce filas más nuevas pueden ser todas de las
OTRAS, y la fila `listo` que ya trae la url de ésta se cae de la ventana. El bucle
no encuentra nada, la función llega al final, `consultarUnaVez` encola otra
consulta — y **no converge nunca: cuantas más tomas hay, menos chance tiene cada
una de verse**.

Medido sobre las 298 filas de `estado_clips` de producción, contando operaciones
distintas dentro de cada ventana de 12 filas consecutivas:

```
  MÁXIMO: 10 operaciones distintas en 12 slots
  30 ventanas con 6 o más
```

Ya estaba al borde, **con el sondeo viejo que seguía una sola toma**.

### Lo que lo hace valioso: dos aceleraciones correctas empujaban justo ahí

El lote de 5 hace que la cola drene más rápido (más filas nuevas por minuto) y el
sondeo pasó a preguntar por TODAS las tomas en vuelo. Los dos cambios son
correctos, y **los dos acercan este techo**. Encontrarlo después de mergearlos se
habría reportado como *«se cuelga desde que aceleramos»*, y el diagnóstico obvio
—revertir la aceleración— habría sido el equivocado: el defecto es de 2026-08-31 y
la aceleración sólo lo destapa.

**La regla: al acelerar algo, buscá qué CONSULTAS tienen un tope fijo aguas
abajo.** Un `limit(N)` sobre una tabla compartida es un supuesto de concurrencia
escrito como número, y acelerar la producción de filas es exactamente lo que lo
rompe. El síntoma no aparece del lado que cambiaste.

### Las tres decisiones del arreglo

- **El `limit(12)` NO se baja.** Con una sola operación en vuelo la profundidad
  efectiva de hoy ya es de hasta 12 filas suyas; recortarla sería una regresión en
  el camino `a_ciegas`, donde la fila que importa es la `listo` con `SUCCESSFUL`
  —la única que dispara `conseguirEnlace` en cada vuelta— y cada `fallido` la
  empuja hacia abajo. Con la ventana chica, tres fallas la entierran y dejaríamos
  de pedirle el enlace a un clip que **existe y está pagado**.
- **Sólo `listo`/`fallido` en el SELECT.** Son los únicos estados que leen los tres
  consumidores. Las filas `pendiente`/`tomado` no se miran nunca, y sacarlas en SQL
  es lo que evita que **las consultas en vuelo se coman los slots** — la otra mitad
  de la causa, y la que más crece con el paralelismo.
- **Sin índice, y queda escrito.** `pedido->>operacion` no está indexado y el
  `limit` se aplica DESPUÉS del predicado, así que para una operación con filas ya
  viejas el plan recorre `id` hacia atrás. Hoy no se nota y `consultarUnaVez` hace
  este mismo filtro desde el 31/08; crece con la tabla, que nadie purga. Cuando
  moleste va un índice de expresión, **no un `limit` más chico** — el `limit` chico
  rompe lo de arriba.

Es estrictamente más seguro que antes: la versión vieja podía encontrar **cero**
filas propias; ésta encuentra siempre al menos las mismas.

## Creador de formatos: lo que un formato ES, y lo que no (01/09/2026)

**Vive en:** `lib/formato-medir.ts` · `lib/formato-prompt.ts` ·
`app/video-generator/formatos-datos.ts` · mig 0152 y 0153

### La regla que decide toda la forma, y ya estaba escrita

El propio tipo `Puesta` la dice, y `puestasOfrecidas()` la cumple en código
(filtra por `p.ejemplo`):

> «Para sumar una puesta al menú: se produce un anuncio con ella… **sin ejemplo
> no entra** — ofrecer un formato que nadie produjo es prometer sin haber medido.»

O sea que **un formato no es una fila de configuración: es un prompt validado**.
Eso descarta el formulario y obliga a que el creador termine en una producción
real. Un formato nace `borrador` y sólo pasa a `listo` con un clip hecho.

### ⚠️ La densidad de un video NO es la densidad de un formato

El error conceptual que más caro habría salido. La densidad de un video de
referencia mide a un **humano** hablando; la de un formato mide **cuánto acepta
el modelo de video antes de trabarse**. No son la misma magnitud, y la del
modelo es más baja.

La evidencia es el catálogo: los ocho formatos van de **2,1 a 3** y ninguno llega
a 3,5 — esos números salieron de probar contra Flow, no de medir locutores. Un
tope de 5 (el que puse primero) dejaba pasar a cualquiera que hable rápido y le
guardaba una densidad que el modelo no sostiene.

**La regla: cuando midas algo del mundo para configurar un modelo, preguntá si el
modelo tiene su propio techo — y si el catálogo que ya tenés lo revela.**

### ⚠️ Una lista de palabras no distingue «hablar DE la cara» de «describirla»

Escribí una guarda de 25 palabras para que un prompt de formato no describa a la
persona. Corrida contra el único prompt real que existe, el de Car Talks:

```
  rostro  ×5   «la cámara mide la exposición basándose en su rostro»
  cara    ×2   «sin dejar la mitad de la cara a oscuras»
  bajo    ×2   «imagen lavada, de bajo contraste»
  piel    ×1   «mismo rostro, mismos rasgos, misma piel»
```

**10 coincidencias, las 10 falsas.** Y tiene sentido: un prompt de fotografía
habla de la cara todo el tiempo —dónde cae la luz, qué está enfocado— sin
describirla. La diferencia no está en la palabra sino en su papel gramatical, y
eso una regex no lo ve. Encima `bajo` cazaba «bajo contraste».

Queda una lista corta de palabras sin uso legítimo en un prompt de foto (barba,
canoso, años, pecas) y **está escrito que es una red para lo obvio, no una
prueba**, con un test que fija que «los ojos en sombra» PASA.

**El test de calibre es lo que lo encontró**, y es la regla de la casa: correr el
umbral contra los datos que ya tenés y contar los falsos positivos. Sin él la
guarda habría rechazado el 100% de los prompts buenos mientras parecía cuidar
algo.

### El molde: qué es genérico y qué es del formato

El prompt de Car Talks tiene siete bloques y sólo tres hablan del auto. Los
genéricos —identidad, exposición, enfoque— son los que hacen que la foto parezca
real y que la cara sea la de la persona, y son justo los que un modelo
escribiendo desde cero se olvida. Van escritos una vez; al modelo le queda
describir el **lugar**.

### Tres guardas que fallan calladas, y viven en la BASE

- **`camara` es la llave de un diccionario cerrado**: `COMO_FILMA[camara] ??
  COMO_FILMA.estatica`. Un valor desconocido no da error — cae a trípode, y un
  formato selfie sale con planos fijos sin una línea en ningún log.
- **`mixto` sin `ritmo` deja el anuncio entero mudo**, y el default vacío hacía
  que ésa fuera la combinación que salía sola.
- **Un formato sin aire en ninguno de los dos rangos** deja al guion que no entra
  sin a dónde crecer: es el apilado de la última toma entrando por otra puerta.

### Y una fuga que me hice yo

`formatos` no entró en `TENANT_TABLES`. `getTenantDb` sólo inyecta el
`workspace_id` en las tablas de esa lista: sin estar, un cliente habría visto los
formatos de otro. Agregué `montaje_trabajos` un rato antes y me olvidé de ésta.

**Al crear una tabla per-workspace, `TENANT_TABLES` es parte de la migración, no
un paso siguiente.** Ninguna prueba local lo caza: con un solo workspace, scopear
y no scopear dan lo mismo.

### El techo de la densidad NO se estima: está escrito y medido

Lo puse en 5, después en 3,4, y las dos veces dejaba pasar la franja que ya
sabemos que rompe. El número estaba a la vista en el catálogo, en las reglas de
Car Talks:

> «Un clip de 10 s admite entre 26 y 30 palabras. Menos de 26 tartamudea, **más
> de 30 no entra**.»

Eso son **3,0 exactos**. Un margen por encima de un techo duro no es prudencia:
es abrir la puerta al único lado donde ya está medido que falla. Queda en 3,15, y
ese 0,15 no es comodidad — es el error de la medición misma (el conteo sale de
una transcripción, la duración se redondea), con un test que fija las dos puntas:
3,5 se rechaza y 3,08 pasa.

**La regla: antes de elegir un umbral, buscá si el valor ya está escrito en el
sistema.** Acá estaba, en prosa, en el campo `reglas` del formato — que es
exactamente donde debía estar y no donde uno mira.

### ⚠️ Y una pregunta de producto que el CHECK no contesta

`camara` ahora está acotada a los cuatro valores. Pero eso decide qué entra a la
base, no **qué ve la persona cuando su video no encaja en ninguno**: con el CHECK
el INSERT falla, y sin él era trípode en silencio. Ninguna de las dos es
abstenerse.

La respuesta tiene que estar en la pantalla, y sale de la regla del dueño —nunca
un campo libre—: **la cámara se elige de las cuatro, siempre.** MaKo propone la
más parecida a lo que vio y la persona confirma o cambia. Así «no encaja» no
existe como estado: existe «se parece más a ésta», que es una decisión que la
persona puede tomar mirando su propio video.

### Lo que queda SIN hacer

- **Las pantallas del creador.** Están las piezas (medir, molde, guardas,
  resolver) y no hay un solo consumidor.
- **`MedidaVideo.cortes` no tiene productor**: detectar cortes de escena necesita
  ffmpeg, que hoy sólo vive en el contenedor del worker.
- **El `ejemplo` de un formato de cliente** necesita ir a un bucket: `public/` no
  lo puede escribir un cliente.
- **Los 7 call sites de `puestaPorId`** siguen siendo síncronos y sólo ven los de
  fábrica. Hasta que usen `puestaDe`, un formato creado no se puede usar.

---

## El puente que se apaga al actualizarse, y el timeout que acusaba de no tener sesión (01/09/2026)

**Vive en:** `extension/background.js` · `extension/mako-puente.js` · `extension/popup.js` ·
`app/layout.tsx` · `app/video-generator/VideoGeneratorApp.tsx` ·
`app/video-generator/video-action.ts` · `app/video-generator/plan-clips.ts` ·
`lib/plantilla-fabrica.ts` · `lib/flow-puente-frescura.ts`

Tres síntomas que reportó el dueño con capturas, y **dos de ellos comparten una sola causa**.

### ⚠️ La causa común: el puente vivía dentro de UNA vista de UNA ruta

`<PuenteEnlace />` —lo único que puede acuñar el token, porque nace de una server action
con la cookie de sesión— se renderizaba en el return final de `VideoGeneratorApp`, detrás
de **tres** early returns (`vista === 'ejemplo'`, `'wizard'`, `'anuncio'`). Y
`<AvisoPuente>` estaba en el mismo lugar.

O sea que en el **wizard** —que es DONDE SE FILMA, el único lugar donde el puente
importa— no había ni el aviso de que el navegador se había caído ni forma de reconectarlo.

Y del otro lado, `mako-puente.js` se inyecta en **toda** `hola-mako.com/*` (manifest). Con
una pestaña del CRM abierta al lado de la de video, la extensión le pedía el token A ESA,
que tampoco escuchaba.

**La regla: el alcance de un content script y el del listener que le contesta son EL MISMO
CONJUNTO, o el que sobra falla en silencio.** El manifest declara el alcance; la página
tiene que igualarlo. `<PuenteEnlace />` pasó al layout raíz.

### ⚠️ Un service worker MV3 que se actualiza puede no volver a arrancar NUNCA

`chrome.alarms.create('ciclo', …)` estaba en el nivel superior de `background.js`, que es
lo que todo el mundo escribe. Esa línea corre **cuando el worker arranca**. Después de una
actualización Chrome termina el worker; si la actualización se llevó la alarma —y la alarma
era el único evento que podía arrancarlo— **no queda ningún camino de vuelta**.

Medido: el último latido de una clienta reportó `version: '0.37.1'` y su popup corría la
`0.37.3`. Desde la actualización no latió ni una vez, durante horas.

**Van `chrome.runtime.onInstalled` (dispara con reason 'update') y `chrome.runtime.onStartup`.**
Son los dos únicos eventos que despiertan al worker sin que nadie toque nada. Y se late en
el acto, sin esperar el primer disparo.

**Cómo se reconoce:** un puente cuyo `version` en la base es MENOR que la que corre el
popup. Son dos hechos que se contradicen y sólo se ven juntos si alguien los cruza.

### Un campo GUARDADO no habla del presente, aunque diga «listo»

`generarTomaAction` —el guard que decide si se gastan 12 créditos— chequeaba
`puente.estado`, que vale `'listo'` desde el último latido bueno **y se queda así con la
extensión desinstalada**. Nunca miraba `ultimo_visto`.

`estaVivo` existía desde antes y su propio módulo decía tener tres consumidores: «el aviso
de la tab, el gate que decide si se puede empezar un anuncio, y el guard de reconexión».
**Eran dos.** El del medio no existía. Es «una regla aplicada en un lugar de dos no está
implementada, está documentada», con el módulo enumerando sus propios call sites como si
existieran.

### Un trabajo `pendiente` que nadie toma no caduca nunca

`flow_trabajos` tiene rescate de colgados, pero mira los `tomado` — y encima lo dispara el
mismo puente que ya no está. Un trabajo que **nunca se tomó** (`tomado_at` null,
`intentos` 0) se queda ahí para siempre, y la pantalla decía «Filmando» sin tope, sin
salida y sin botón.

Es exactamente el mismo modo de falla que la cola de montaje, entrando por otra puerta:
**«está en la fila» y «no hay nadie atendiendo la fila» se ven idénticos desde afuera: un
spinner.**

A los 4 minutos sin que nadie lo tome se cierra el trabajo y se dice qué pasó. ⚠️ **Se
CIERRA, no sólo se informa:** si no, un puente que despierte más tarde lo toma igual y el
cliente paga dos veces la misma toma —la que reintentó y ésta—.

### ⚠️ Un timeout convertido en una acusación

`mako-puente.js` reportaba su timeout de 12 s como `motivo: 'sesion'`, y el popup lo
AFIRMABA: **«Inicia sesión en MaKo»** — a alguien logueada, mirando su propio tablero, con
la pestaña abierta al lado.

**Lo que lo delata en un segundo: el server NI SIQUIERA PUEDE emitir ese motivo.**
`MotivoConectar` es `'rol' | 'sin_ws' | 'otro_navegador' | 'error'`. Los tres únicos
emisores de `'sesion'` eran de transporte: el timeout, un `catch` genérico en
`PuenteEnlace`, y un `r || { motivo: 'sesion' }` en `background.js`.

**La regla operativa que queda: cuando un mensaje de error acuse de algo, buscá si ese
valor existe en el contrato del que supuestamente lo emite.** Si no está, lo inventó el
transporte — y el transporte no sabe nada del hecho que está afirmando.

Y el remedio importa tanto como el diagnóstico: `sin_enlace` se arregla **recargando**, que
no tiene nada que ver con iniciar sesión. Mandarla a loguearse la mandaba a arreglar algo
que estaba bien.

### Tres formas de perder pestañas, en el mismo popup

- **`conectar()` se quedaba con la PRIMERA pestaña que contestara ALGO**, incluido un
  fracaso — y `mako-puente.js` SIEMPRE contesta, aunque sea su propio timeout. Con dos
  pestañas abiertas, cuál ganaba dependía del orden en que Chrome las devuelve. Ahora gana
  el primer ÉXITO, y si todas callan se recarga una y se reintenta.
- **«Abrir MaKo» hacía `chrome.tabs.create` siempre.** El remedio a «no estás conectada»
  era una segunda pestaña encima de la que ya estaba abierta. `abrirFlow`, **tres funciones
  más abajo en el mismo archivo**, ya enfocaba la existente desde siempre: el contraejemplo
  estaba al lado.
- **`enlaceListo` es un latch que nunca vuelve a false**, y `esperarEnlace()` toma
  `readyState === 'complete'` como prueba de que el enlace está montado. No lo es: una
  página cargada no es una página hidratada. **Sin arreglar.**

### La plantilla de fábrica cubría el primer paso y no el último

Un usuario nuevo llegaba hasta el escenario sin tocar Flow —que era el punto— y ahí, **al
filmar**, se topaba con «Abre Flow, genera UNO a mano usando tu foto». El paso manual
apareciendo en el último lugar del recorrido, que es donde más caro sale.

Se pueden sintetizar porque **el cuerpo del pedido ya lo arma el código entero**
(`cuerpoClipReferencias`): lo único que la plantilla aporta es el `clientContext`, y el
`projectId` ya viaja en cada latido. Van dos: la que filma y la que pregunta si salió —sin
la segunda el clip se genera y nadie va a buscarlo—.

⚠️ **Lo que NO se copia del espejo de otro cliente: `userPaygateTier`.** Afirma en qué plan
está una cuenta, y eso no lo sabemos. Omitirlo deja que lo resuelva Google, que sí lo sabe.
Es «no se afirma lo que no se verificó» aplicado a un campo de protocolo.

Y `conPlantillaDeFabrica` **salía temprano al encontrar la de imagen**, así que el cliente
que YA tenía esa —o sea, el que había generado una a mano— nunca recibía las de video. Eran
justo las que le faltaban. Va clase por clase.

### El guard del apilado se comía el arreglo que venía a proteger

`redistribuir` se abstenía del plan ENTERO ante **una sola** toma filmada. Sobre un plan con
8 tomas pagadas y la novena con 70 palabras, «sumar una toma» insertaba el clip vacío y
dejaba las 70 donde estaban: el mismo «corte a negro con la persona callada» que ese guard
dice que hay que evitar, **entrando por su propia puerta**.

Se reparte dentro de cada **tramo contiguo de tomas sin filmar**. Las filmadas quedan
congeladas y además hacen de PARED: el texto nunca cruza algo pagado.

**Y el corolario que costó encontrar: un solo `recomponer` para tres operaciones hacía que
dos mintieran sobre su propio contrato.** `cambiarDuracion` documenta, textual, «No toca el
texto» — y lo tocaba, porque pasaba por el mismo camino que sumar y quitar. Cada operación
declara su intención (`siDesborda` / `siempre` / `nunca`).

### ⚠️ `ceil(palabras / tope)` es un PISO, no la respuesta

El botón decía «Partirla en dos tomas», fijo. Se cambió por la cuenta… y la cuenta también
estaba mal: `repartirGuion` corta en **separadores seguros**, nunca por el medio de una
frase, así que 70 palabras en 3 tomas de tope 24 dejaban una de 28. Seguía sin poder
filmarse: el arreglo dejaba el problema puesto.

`partirHastaQueEntre` agrega de a una y **mira el resultado de verdad**, parando cuando
entra. Y el número del botón sale de la MISMA simulación: con dos cuentas distintas —una
para mostrar y otra para hacer— el botón promete un número y el server hace otro.

**La regla: cuando el resultado de una operación depende de unidades indivisibles (frases,
archivos, bloques), la división da un piso. La respuesta se simula.**

### Nadie validaba la densidad antes de cobrar

Dos planes en producción con la última toma en **70 y 63 palabras sobre 8 segundos** —
densidades de 8,75 y 7,88 contra un techo medido de 3,0. Apretar «Filmar» eran 12 créditos
cada uno en un clip donde el avatar se traba o se come media frase. El aviso de «no entra»
estaba en la pantalla; **el guard que gasta el dinero no lo miraba**.

### ⚠️ Nota de método: una refutación adversarial mide el árbol de AHORA

La corrida de agentes verificó las 5 investigaciones y después intentó refutar cada
hallazgo caro. Para entonces los arreglos ya estaban aplicados en el árbol de trabajo, así
que los refutadores leyeron el código NUEVO y marcaron como «refutado» casi todo — «no
sostiene: `PuenteEnlace` está en el layout raíz», «el archivo dice `sin_enlace`».

Eran ciertas todas, y **ninguna refutaba nada**: describían el arreglo. Es la advertencia de
`AGENTS.md` («un agente no distingue "nunca estuvo roto" de "se arregló hace una hora")
disparándose sobre la sesión que la escribió.

**La regla operativa: si vas a arreglar mientras una corrida verifica, la fase de
refutación tiene que correr contra un `git stash` o contra `HEAD`, no contra tu árbol.** Si
no, su salida es un espejo de tus propios cambios con cara de auditoría independiente.

### Dos controles muertos, y los dos en el camino de «probar que esto anda»

- **`probarImagenAction` no podía funcionar nunca.** Encolaba `{ body: { prompt } }` a
  secas, y `extension/background.js` rechaza todo pedido sin un `path` que empiece con
  `/v1`: «pedido sin path válido». Encolaba un trabajo, lo contaba como intento, y moría
  con un error que no nombra nada — justo el control que existe para contestar «¿anda el
  puente?». Es «escribir la salida no es ofrecerla» en su forma más cara: el call site
  existía, se ejecutaba, y el CONTRATO del otro lado no se cumplía.
- **La fábrica de plantillas se abstenía justo con quien la necesita.** Las tres arrancan
  con `if (!ES_UUID.test(proj)) return null`, y el navegador aprende el `projectId` de UN
  solo lugar: la url de las llamadas de imagen (`/v1/projects/<id>/…`). Un cliente que
  todavía no hizo ninguna llegaba con vacío → cero fábricas → «Abre Flow, genera UNO a
  mano», que es el paso manual que las fábricas vienen a borrar. **Degradaba en silencio:
  sin error y sin log.**

  `proyectoDePlantilla` ya sabía derivarlo del `clientContext.projectId` del cuerpo, y las
  de video lo traen ahí: con UNA plantilla guardada alcanza. Si no hay ninguna sigue vacío
  y se abstiene — un `projectId` inventado manda el pedido al proyecto de otro, y eso no da
  error: da una imagen en la grilla que no es de nadie.

**La regla que comparten: una precondición que se aprende de UN solo evento es una
precondición que falla para el primer usuario.** Antes de colgar algo de un dato aprendido,
preguntá de cuántas fuentes se puede derivar — y si la respuesta es una, escribí la
segunda.

### Lo que quedó SIN hacer

- **Publicar la extensión 0.38.0 en la Chrome Web Store.** Sin eso, el arreglo del latido
  no le llega a nadie que la haya instalado desde la tienda — y es EL arreglo que hace que
  un puente muerto vuelva solo. Necesita a Martín.
- **`enlaceListo` / `esperarEnlace()`**, arriba: `readyState === 'complete'` no prueba que
  React hidrató.
- **El aviso del puente dentro del wizard.** El enlace ya está en todas las pantallas; el
  AVISO sigue viviendo sólo en el catálogo (`VideoGeneratorApp.tsx:1431`), así que en el
  wizard el navegador se puede caer sin que nada lo diga. Lo tapa el gate nuevo —no deja
  filmar y explica por qué—, pero es un error donde debería haber un aviso.
- **Las otras 2 clases vivas sin fábrica** (`credits` y `uploadImage`), y derivar el
  `projectId` sin depender de que Flow haga una llamada que lo lleve en la URL.
- **`puestaDe` sigue sin call sites**, así que un plan hecho con un formato DEL CLIENTE no
  se puede redistribuir: `puestaPorId` no ve esos formatos y `redistribuir` se abstiene.
- **`www.hola-mako.com` y los previews no matchean** en el manifest: ahí la extensión se ve
  como no instalada y el emparejado no puede ocurrir.

### El popup: cinco callejones sin salida y un bug de contrato (01/09/2026)

**Vive en:** `extension/popup.js` · `extension/background.js` ·
`app/video-generator/WizardAnuncio.tsx` (`Estudio`)

#### ⚠️ «Consultar tokens» fallaba SIEMPRE, por un campo que no existe

`saldoLocal()` hacía `const d = (r && r.resultado) || null`. **Ningún punto de la
extensión escribe un campo `resultado`**: `injected.js` contesta `{ status, texto,
metodo, urlUsada }` o `{ error }`. Leyendo algo que nadie escribe, `d` era
`undefined` siempre y el botón contestaba «No pude leer tus créditos» en el 100% de
los casos, con Flow abierto y andando.

**Cómo se reconoce esta familia:** un consumidor que lee un campo con `|| null` o
`?? {}` y un productor que nunca lo escribe. No falla, no loguea: cae al camino de
error o al default, y se lee como que el proveedor externo tuvo la culpa.

Y el contraejemplo estaba treinta líneas más arriba: el otro consumidor del MISMO
mensaje ya hacía `String(r.texto || '')` + `JSON.parse` + mirar el `status`.

Una auditoría de los 17 tipos de mensaje y los 7 pares de CustomEvent confirmó que
**era el único desacuerdo** de todo el paso de mensajes de la extensión.

#### Un 403 tiene que frenar el LOTE, no sólo el trabajo

`out.pausado` se mira ANTES del bucle, así que un lote ya tomado seguía hasta el
final aunque el primer trabajo volviera con la sesión marcada. Medido: **tres
trabajos, tres 403 de `PUBLIC_ERROR_UNUSUAL_ACTIVITY`**. Con el corte habría sido
uno — y cada 403 de más profundiza la marca.

La regla estaba escrita en `lib/flow-protocolo.ts`: *«`sesion_marcada` es el peor y
el único que obliga a frenar todo»*. No la aplicaba nadie del lado del navegador.

⚠️ Y el `break` va **después** de `marcarLlamadaFlow()`: un pedido rechazado igual
salió, y no sellarlo deja al ciclo siguiente reintentando rápido contra un bloqueo.

**El principio:** la extensión no clasifica fallos —eso lo decide el server, que
sabe cuántos créditos hay en juego— pero **frenar no es clasificar**: es la
dirección segura, la única que un lado subordinado puede tomar solo.

#### ⚠️ `chrome.runtime.reload()` sólo corría donde no puede servir

`quizasReiniciar` reiniciaba la extensión cuando producción servía una versión más
nueva. Pero `reload()` vuelve a leer **la misma carpeta** —no descarga nada— y el
`if (manifest.update_url) return` de arriba hacía que corriera **sólo en
instalaciones descomprimidas**. O sea: se reiniciaba únicamente en el único caso
donde reiniciar no puede actualizar nada.

Y no era gratis: un `runtime.reload()` mata al service worker y **se lleva la
alarma**. Es la causa más probable del puente que se apagó y no volvió nunca.

**La regla: antes de automatizar un remedio, comprobá en qué casos corre. Un
remedio cuya única rama viva es aquella donde no sirve es peor que ninguno —
consume la confianza del que lo ve pasar y tiene efectos propios.**

#### El botón que arregla vivía en otra pantalla. Otra vez

`AvisoPuente` —con su botón «Ya lo hice, volver a habilitar», el único que levanta
una sesión marcada— se dibujaba **sólo en el catálogo**. El bloqueo ocurre
FILMANDO. La persona veía el error en rojo, con un texto que le decía «en el
catálogo, dentro de "Tu navegador", está el botón», y el botón estaba en otra
pantalla.

Es la **segunda vez** en esta tab: la primera fue «sumar tomas», y su comentario
quedó escrito. Pasó igual, porque la lección se anotó sobre el caso y no sobre la
forma. **La forma: cuando un mensaje de error DESCRIBE dónde está la solución, eso
no es un mensaje mal redactado — es la evidencia de que la solución está en el
lugar equivocado.** Se mueve el botón, no se mejora el texto.

El aviso pasó a `Estudio`, que es el chrome de las tres vistas, para que la cuarta
que alguien agregue nazca con él.

#### Tres pantallas del popup que no llevaban a ningún lado

- **«Conectando…» podía ser para siempre.** Una pantalla SIN BOTÓN colgada de un
  flag que apaga `finEmparejado` — el mismo proceso que se puede morir. El service
  worker de MV3 se duerme y `conectar()` espera hasta 12 s a que la página conteste;
  si lo matan en el medio, el flag queda en `true` y no queda nada que tocar.
  **Un flag de "en curso" que sólo apaga el proceso en curso necesita una marca de
  tiempo, o no distingue "trabajando" de "muerto".**
- **«Todo listo» no miraba el latido.** Era la pantalla que contradice a MaKo sobre
  el mismo hecho: el popup decía «Todo listo» —hay token, bearer y apiKey en
  storage— mientras la web decía «tu navegador no está conectado», que es lo que
  mide el server. Los dos hablaban del mismo navegador y sólo uno miraba el
  presente. Es el desacuerdo que `estadoDelPuente` ya había venido a cerrar del
  lado de la web, reapareciendo del lado de la extensión.
- **Las dos ramas nuevas de `verSaldo` mandaban a ABRIR Flow**, y lo que arregla las
  dos es RECARGARLO: `abrirFlow` ENFOCA la pestaña que ya está abierta, y enfocar no
  hace que Flow pida nada — la consulta de créditos que hay que copiar la hace al
  CARGAR. Escrito veinte minutos antes por esta misma sesión, y cazado por una
  auditoría adversaria y no por una prueba.

#### El gate de versión, y a quién alcanza cada mitad

El popup frena si la instalada es más vieja que la que sirve producción: es la
primera pantalla, con los pasos, y no deja seguir. La comparación la hace
`background.js` con `esMasVieja` —ORDENADA, no `!==`, porque una instalación que va
ADELANTE no es vieja— y el popup sólo la pinta.

⚠️ **Pero eso no alcanza a quien YA tiene la versión vieja: su popup es el viejo.**
A esa persona la alcanza `AvisoExtensionVieja`, que renderiza el server — y que
faltaba justo en el CATÁLOGO, que es donde se empieza un anuncio. Las dos piezas
dicen lo mismo a públicos distintos, y por eso tienen que existir las dos.

**La regla, para cualquier gate que viva dentro de lo que se está actualizando: el
gate protege a los que vienen, nunca a los que ya están. Al que ya está lo alcanza
solamente algo que no dependa de su versión.**

#### Lo que quedó SIN hacer

- **`forzar` no lo lee nadie** (`background.js`): con dos pestañas de MaKo, un clic
  puede desconectar el otro navegador sin preguntar.
- **`bearer` y `apiKey` nunca se invalidan**: son un «alguna vez», no un «ahora» —
  la misma familia que `puente.estado`.
- **El servidor pega `accion` y `soloLectura` a cada pedido y la extensión no los
  leyó nunca** (`lib/flow-cola.ts`).
- **`deLaTienda` viaja al popup y nadie lo lee** — el mismo modo de falla que
  `r.resultado`, en chiquito, y recién nacido.
- **La sonda no cierra por ninguno de los dos extremos**, y cambiar de cliente no la
  borra: urls firmadas del cliente anterior viajan en los latidos del siguiente.
- **`esperarEnlace()` toma `readyState === 'complete'`** como prueba de que el
  enlace está montado. Una página cargada no es una página hidratada.

### El barrido de pendientes (01/09/2026, tarde)

**Vive en:** `supabase/migrations/0154_flow_abandono.sql` ·
`app/api/cron/flow-abandono/route.ts` · `app/api/flow/puente/route.ts` ·
`lib/flow-plantillas.ts` · `lib/flow-cola.ts` · `lib/flow-protocolo.ts` ·
`extension/background.js` · `extension/mako-puente.js` ·
`app/extension/instalar/` · `app/video-generator/EditorAnuncio.tsx`

#### ⚠️ El vigilante y el vigilado eran el mismo

Todo lo que miraba `flow_trabajos` colgaba del propio puente: el rescate de
colgados vive DENTRO de `flow_tomar_trabajos`, que sólo corre cuando la extensión
pide trabajo. Cuando el navegador del cliente se muere, no queda nadie.

**La regla, y es más general que esta cola: si el worker de una cola es el
navegador de otra persona, el vigilante NO puede vivir adentro del worker.** Es
«todo proceso largo necesita algo que lo MIRE» con el agravante de que el proceso
no es nuestro.

Dos detalles del cierre que no son obvios:
- **El WHERE es `tomado_at is null`, no la edad a secas.** Un trabajo que YA fue
  tomado y volvió a `pendiente` por el rescate no está abandonado: se está
  reintentando, y su `created_at` puede ser de hace horas sin que eso signifique
  nada. Cerrar por edad mataría justo a los que el sistema está reintentando bien.
- **`for update skip locked`**: si otra transacción tiene la fila es porque alguien
  la está tomando en este preciso momento — o sea que no está abandonada.

Y el agujero que se ve al lado: **el rescate devolvía un `tomado` a `pendiente` sin
tocar `intentos`.** Un trabajo que el navegador toma y nunca reporta rebotaba entre
los dos estados PARA SIEMPRE con `intentos` en 0, ocupando un lugar del lote de
cinco en cada ciclo.

⚠️ **El incremento va en el RESCATE y NO al tomar.** `fallar()` ya suma cuando la
extensión REPORTA; sumar en las dos puntas contaría doble y el techo de 5 pasaría
a 2 o 3 **en silencio**. Las dos ramas son excluyentes —o reporta, o desaparece— y
cuentan lo mismo: un intento que no produjo resultado.

#### Una guarda que nadie escribe corre para siempre

`KEY_VARIANTE_VIDEO` decidía si hacía falta sondear, y **no la escribía nadie en
todo el repo**. Verificado contra producción: no existe en NINGÚN workspace. La
sonda se pedía en cada latido —cada quince segundos— mientras hubiera un
`estado_clips` en la cola. Cada corrida son ocho `<video>` y tres `fetch` contra la
sesión de Google del cliente, por una pregunta que se contesta una vez.

**Es la misma familia que `r.resultado`, pero al revés:** ahí un consumidor leía un
campo que nadie escribía; acá un guard consulta una clave que nadie escribe. Los
dos se ven igual desde afuera —el sistema hace su trabajo— y los dos son un
control muerto.

⚠️ **Y el cierre tiene que contar los intentos que NO sirvieron.** Si sólo cerrara
al encontrar una variante buena, un navegador donde ninguna sirve la seguiría
corriendo eternamente — que es el caso PEOR: el que más tráfico genera y el que
menos puede aprender. A los 12 intentos se guarda `'ninguna'`, que es una
respuesta.

#### Un ticket de permiso más un bucle es un consentimiento salteado

Regresión introducida el mismo día: al hacer que `conectar()` pruebe TODAS las
pestañas —y con `<PuenteEnlace/>` mudado al layout raíz, o sea que todas
contestan— **un solo clic desconectaba el otro navegador sin preguntar.**

El mecanismo: `conectarPuenteAction` no acepta un `forzar` del cliente. La primera
vez contesta «ya hay otro» **y deja un ticket armado por 60 s**; el segundo pedido
lo consume y pisa. Eso está bien cuando los dos pedidos son dos CLICS con la
pantalla de «Si continúas, ese se desconectará» en el medio. El bucle hacía los dos
seguidos, sin pantalla y sin persona.

**La regla: un permiso que se emite en la respuesta A y se consume en la petición B
asume que entre A y B hubo una PERSONA. Cualquier bucle que haga A y B seguidos lo
saltea — y no hay nada en el código de A ni en el de B que lo delate.** Antes de
poner un retry o un loop alrededor de una llamada, preguntá si esa llamada deja
algo armado.

#### El instructivo que no existía, y el paso que no se puede verificar

No había NINGUNA instrucción de instalación en todo el producto: el aviso ofrecía
un botón que baja un `.zip` y nada más.

Y la instrucción que se usaba de boca en boca —«descomprime encima de la misma
carpeta»— **tiene un paso que quien lo ejecuta no puede verificar: cuál es «la
misma carpeta»**. Se equivoca en silencio y el síntoma es idéntico al de un botón
roto. Falló tres veces, una de ellas costándole el día al dueño.

**La regla: entre dos instrucciones correctas, gana la que tiene todos sus pasos
verificables por quien los hace.** Reinstalar limpio no tiene ese paso — la carpeta
que se elige en «Cargar descomprimida» ES la que Chrome carga — y su costo estaba
medido y era casi nulo, porque el servidor ya repone las plantillas solo.

Con el paso que separa «lo hice» de «creí que lo hice»: mirar la versión abajo del
popup. Es el único hecho observable del instructivo.

#### Una pila de deshacer apila por GESTO, no por cambio

Un arrastre dispara decenas de `setPlan` por segundo. Si cada uno apilara, Ctrl+Z
desharía un píxel y habría que apretarlo cuarenta veces. El apilado de un borde va
en el `pointerdown` —cuando el gesto EMPIEZA— y un arrastre que vuelve al mismo
lugar se saca al soltar.

⚠️ **Y se calcula AFUERA del updater de `setState`.** Un updater tiene que ser puro
y en StrictMode React lo llama dos veces: apilar ahí adentro dejaría dos entradas
por gesto.

#### Datos de un cliente en la fila de otro, por dos caminos

Medido: `flow.respuestas` guardaba `userSettings`, `likeness:listUserLikenesses`
—los parecidos faciales cargados en Google—, `appConfig`, `sessions`,
`savedSharedApplets` y dos claves que eran UUID sueltos.

**El storage del navegador es UNO SOLO para todos los clientes que se abren desde
él.** Si el anterior dejó algo ahí, el latido del siguiente lo sube a SU fila. Es
el caso normal del super-admin, que abre un cliente por pestaña.

Se cierra por los dos lados y hacen falta los dos: la limpieza al cambiar de
cliente (que ya existía para las plantillas y **estaba a medias** — le faltaban las
tres claves de la sonda) y un allowlist en el server, **que es la mitad que
protege contra la extensión vieja: la que sigue instalada mientras la gente
actualiza.**

⚠️ **Un guard que se escribe en un cliente sólo protege a los clientes que ya
actualizaron.** El server es el único lado cuyo arreglo llega a todos el mismo día.

#### El editor no dejaba aplicar una edición que no cambiara la duración

`sinCambios` comparaba el TOTAL. Correr un tramo medio segundo, o recortarle a uno
lo que se le agrega a otro, dejaba el botón apagado — y son justo las ediciones que
uno hace cuando el largo ya está bien y lo que quiere arreglar es DÓNDE cortan.
**La duración es una consecuencia de los cortes, no su identidad.**

#### Lo que se decidió NO hacer

- **Cablear `puestaDe`** para que un plan hecho con un formato DEL CLIENTE se pueda
  redistribuir. Medido: **cero formatos en la tabla, y `formatos-datos.ts` no lo
  importa nadie** — el módulo entero es inalcanzable. Cablearlo ahora sería
  plomería para una feature sin datos, sin pantalla y sin consumidores: el séptimo
  caso de «escribir la salida no es ofrecerla» de esta misma sesión, escrito a
  sabiendas. Se desbloquea cuando exista la pantalla del creador de formatos, no
  antes.
- **Reordenar tramos en el editor.** Mover un tramo de lugar cambia lo que el
  anuncio DICE, y el guion ya está repartido y verificado contra el texto. Es una
  operación que se ve como recortar y no lo es.
- **Sumar `www.hola-mako.com` al manifest.** Medido: `www` devuelve 308 al apex
  antes de que la página cargue. El pendiente no existía.

#### Lo que sigue SIN resolverse

- **Publicar la extensión en la Chrome Web Store.** Mientras se sirva el ZIP, cada
  arreglo de la extensión es un trámite manual por cliente — y con el gate nuevo,
  además, **un bloqueo por cliente hasta que reinstale**. Es la decisión más cara
  que quedó abierta. Necesita a Martín.
- **Cuánto dura un `ya29.` de Google.** El bearer ya se invalida por evento (un 401
  lo borra), que es el arreglo sin umbral. Un umbral por TIEMPO necesita el número
  medido, y no lo tenemos.
- **Verificar el editor en un navegador hidratado.** Sigue sin verse en pantalla.
- **El worker de montaje sigue sin contenedor**, y Epidemic Sound sin alta.

---

## El lugar donde se graba, y el acento que nunca se preguntó (02/09/2026)

**Vive en:** `lib/escenarios-data.ts` · `lib/escenas.ts` · `lib/escenas-core.ts` ·
`lib/acento-workspace.ts` · `lib/tab-onboarding-catalogo.ts` ·
`app/video-generator/voz-cliente.ts` · `app/video-generator/OnboardingVideoGen.tsx` ·
`app/video-generator/WizardAnuncio.tsx` · `extension/popup.js` ·
`app/video-generator/PuenteEnlace.tsx`

### ⚠️ Un parámetro que existe desde el día uno y que ningún llamador usa

`resolverAcento(declarado, zona)` decide con qué variedad de español habla el
avatar de cada cliente. Sus **dos únicos** llamadores pasaban `declarado = null`
fijo, así que el acento de TODOS los clientes salía de adivinar su zona horaria,
el resultado se marcaba `seguro: false`, y no había ninguna pantalla donde
corregirlo.

El propio módulo lo tenía escrito desde que se creó —«el día que el onboarding de
la tab pregunte el acento, ese valor gana»—, y eso es justamente lo que lo hace
difícil de ver: **el comentario describe un futuro y se lee como si describiera el
presente.**

Y equivocarlo **no se ve al leer**: el guion sale en un español correcto igual. Se
oye, con el clip ya generado y pagado — el mismo modo de falla que dejó el slot
`{{acento}}` sin llenar durante meses.

**La regla: un parámetro opcional cuyos llamadores pasan todos el mismo valor no
es opcional, es muerto.** Un `grep` del nombre y una mirada a los call-sites lo
contesta en treinta segundos, y es el mismo chequeo que ya está escrito en
AGENTS.md para los campos de retorno.

### El formato decía CÓMO se filma y también DÓNDE, sin que nadie lo hubiera decidido

El síntoma está en los nombres: «The Office» suena a un lugar y **no lo es** — es
un plano secuencia caminando, que sirve igual en un depósito, un local o un
coworking. **Un formato con nombre de lugar es el síntoma de dos preguntas
colapsadas en una**, y hasta ahora el lugar lo elegía MaKo leyendo el guion.

Ahora son dos: el formato (cámara, ritmo, cuántos escenarios) y el escenario
(dónde pasa), con su catálogo cerrado de ocho lugares.

⚠️ **Y el escenario elegido le GANA al guion**, con la instrucción arriba del guion
en el prompt. Si el texto dice «entré al depósito» y la persona eligió la oficina,
se filma en la oficina: lo que se lee último pesa menos, así que la precedencia va
donde el modelo la lee primero y dice explícitamente qué hacer con el conflicto.

### ⚠️ «Regenerar» no podía cambiar el fondo, y parecía que sí

Regenerar vuelve a tirar el MISMO prompt: el modelo devuelve una variación de lo
mismo —el mismo rincón con otra luz—, así que quien no quería ESE fondo podía
apretarlo diez veces y seguir en el mismo lugar. **Un botón que produce un
resultado distinto cada vez se lee como que hace lo que uno quiere, aunque no lo
haga.**

La cura no fue tocar la generación: fue que cada lugar traiga sus rincones
escritos, y que el botón avance por la lista. Y esos mismos rincones se REPARTEN
entre los escenarios de un anuncio, porque cuatro tomas en la misma oficina que
salen en la misma pared se leen como un error del modelo y no como una decisión.

### Un error de la extensión estaba CONGELADO, y su única salida no reintentaba

Tres defectos de la misma familia, sobre una clienta con la extensión al día,
logueada y con su pestaña abierta, que leía «Inicia sesión en MaKo»:

1. **El `catch` de `PuenteEnlace` adivinaba `'sesion'` para cualquier excepción** —
   el mismo antipatrón ya arreglado un archivo más allá. La única pista sobre por
   qué no podía conectar era una afirmación inventada ahí. Ahora sólo el
   `redirect()` de Next (digest `NEXT_REDIRECT`) habla de la sesión.
2. **`emparejarError` no caducaba.** Vive en el storage y sólo lo pisa el próximo
   intento: un fallo de hace media hora —o de la versión anterior de la
   extensión— se repinta con la misma cara que uno de recién.
3. **La pantalla de error no reintentaba nunca.** Su único botón era «Abrir MaKo»,
   que lleva a donde no hay nada que hacer porque el botón de conectar vive en la
   extensión. **Un callejón con forma de salida.**

**La regla, que es la misma tres veces: el estado se lee vivo, no se recuerda.** Y
un estado recordado que no puede caducar necesita, como mínimo, una acción que lo
vuelva a medir.

### Dos guardas del repo atraparon cosas que yo escribí

Vale anotarlo porque es lo que justifica el costo de tenerlas:

- La **guarda de voseo** marcó `mirá` en las muletillas argentinas. Tenía razón:
  esas palabras se PINTAN como chips, o sea que son interfaz. Se cambió por una
  sin forma verbal antes que abrirle una excepción al guard y dejar sin revisar un
  archivo donde también viven las etiquetas de los siete acentos. **Una excepción
  de archivo apaga el guard para todo el archivo.**
- La **guarda de tokens** (`var(--fs-*)`) marcó un `--fs-lg` que no existe. Un
  token inexistente hereda en silencio.

### Tres defectos míos que aparecieron escribiendo lo de arriba

- **`porQueNoSirveElPlan` recibía un escalar** y se lo llamaba con
  `clips[0].segundos`, sobre un plan cuyas tomas duran 10, 8 y 10.
- **`correr()` no devolvía si había salido bien.** Es el único camino de la
  pantalla a una action, y un `.then()` encadenado corría IGUAL después de un
  fallo: «elige el lugar y avanza» iba a avanzar también cuando el lugar no se
  pudo guardar, y la pantalla siguiente escribía los escenarios sin él. El error
  se veía; la elección se perdía en silencio.
- **La oferta de reusar escenarios se limpiaba con un `setState` síncrono dentro
  del efecto.** Entre que el efecto corre y que el server contesta había una
  ventana pintando «ya generaste 3 de 4» sobre un anuncio que no tiene ninguno.
  La cura no fue mover el `setState`: fue que **la respuesta lleve de QUÉ anuncio
  es**, con lo que la ventana deja de existir.

### El catálogo de onboardings por tab no lo podía importar ningún test

Vivía adentro de un módulo `server-only`. Y tiene **dos reglas que fallan en
silencio y que ya se cometieron dos veces**: el prefijo de las keys (un `ensayo`
pelado marca el del Chat Agent como hecho, vía el registro compartido) y el orden
de los pasos. Se mudó a `lib/tab-onboarding-catalogo.ts`, mismo criterio que
`onboarding-orden`.

⚠️ Y al mudarlo, el `export … from` **no crea binding local**: el archivo original
dejó de compilar aunque el re-export fuera correcto. Es el gotcha que AGENTS.md ya
tiene escrito, cometido igual.

### El ensayo de una tab no lo cierra un botón

`vg_ensayo` lo marca `confirmarEscenaAction` al aprobar el primer escenario de
verdad, no el wizard. Un «listo» en la última pantalla diría que la tab quedó
configurada sin que nada lo haya probado — que es exactamente lo que el ensayo
existe para evitar. Mismo patrón que `landing-an` y `carousels_ensayo`.

### Lo que quedó SIN hacer

- **La clonación de voz no existe.** ElevenLabs está en el catálogo de
  integraciones y `lib/metodo-verificar.ts` sabe pingear su key, pero **no hay una
  sola línea que cree un clon ni que convierta audio**: la voz del clip la pone
  Flow. El onboarding no la promete, y por eso su paso de voz pide el acento y las
  muletillas —que sí llegan al guion— en vez de un audio que nadie procesaría.
- **Los ~40 hallazgos de la auditoría UX del 01/09 que no se tocaron**, entre
  ellos las tres pantallas que afirman un hecho que el código no sabe:
  `app/plan/page.tsx:56`, el CRM diciendo «todavía no hay leads» al lado de la
  cinta roja, y `app/crm/lead-view/NotasCard.tsx:39` con su `.catch(() => {})`.
- **48 pantallas escriben su propio `<main>`** contra 17 que usan `Pagina`, y
  `Pagina` tiene 88 px de padding lateral fijo que no baja en móvil. **Cero
  `loading.tsx` en toda la app.**
- **La extensión sigue sin publicarse en la Chrome Web Store**: acuñar el token
  OAuth exige autenticarse en la cuenta de Google. El trámite está convertido en
  un comando (`npm run publicar-extension`) y lo corre Martín.
- **El worker de montaje sigue sin contenedor**, y Epidemic Sound sin alta.

---

## La voz clonada, y tres formas de leer mal una respuesta (02/09/2026)

**Vive en:** `lib/flow-media.ts` · `lib/elevenlabs.ts` · `lib/elevenlabs-fallo.ts` ·
`lib/metodo-verificar.ts` · `app/video-generator/video-action.ts` ·
`app/video-generator/OnboardingVideoGen.tsx` · `app/api/onboarding/voz/route.ts`

### ⚠️ La respuesta de estado de Flow habla de VARIOS medios, y se leía entera

`batchCheckAsyncVideoGenerationStatus` contesta por N medios. La forma exacta,
sacada de `flow_trabajos.resultado` del trabajo 583:

```
$.media[0].name = 108dc579…   ← el clip     FAILED · IDENTIFIABLE_PERSON_SAFETY
$.media[1].name = 68a5ae6c…   ← la IMAGEN   SUCCESSFUL · 4.030.059 bytes
```

Son **hermanos**, y el segundo —la imagen del escenario desde la que se anima—
viaja en TODAS las consultas y siempre sale bien. El lector hacía dos cosas sobre
el JSON completo: un regex de `…_FAILED` y un `buscarCampo` de la url a cualquier
profundidad.

Las dos leen del medio equivocado y las dos fallan calladas:

- con el clip BIEN y la imagen mal, el clip se marca rechazado — **la pantalla
  afirma que Google lo rechazó y Google no dijo eso de él**;
- `buscarCampo` puede devolver la url de la IMAGEN. Eso no da error: da una toma
  que reproduce una foto fija. **Se ve como un clip.**

**La regla: cuando una respuesta habla de varias cosas, el desambiguador es una
CLAVE del payload —acá el `name`—, y hay que acotarse a su subárbol antes de leer
nada.** Y el id vive DOS veces en cada medio (`media[i].name` y
`media[i].video.operation.name`): el de adentro cuelga de `video`, que no tiene al
lado ni estado ni url, así que una búsqueda en profundidad entra por él y sale
vacía — indistinguible de «esta respuesta no lo menciona». Va en ANCHURA.

### El filtro de la cara tiene dos miembros y el detector conocía uno

`PROMINENT_PERSON` es «se parece a alguien famoso». `IDENTIFIABLE_PERSON_SAFETY`
es «hay una persona real reconocible». **Mismo remedio, distinto motivo** — y sólo
el primero estaba en el detector, así que el segundo caía al `else` y salía como
«el filtro de contenido rechazó **cómo está escrito el escenario**… hay que
reescribirlo».

⚠️ Le pasó a una clienta con dos tomas. Su guion estaba perfecto: la mandamos a
reescribir durante horas lo único que no era el problema, y **el camino que sí
destraba —regenerar la imagen del escenario, que es gratis— no se le nombró
nunca.**

Y la frase tampoco puede ser la del famoso: decirle a alguien que Google lo
confundió con una celebridad cuando dijo otra cosa es **inventar un hecho sobre su
propia cara**. Sin motivo reconocido no se elige ninguno.

### ⚠️ Un campo que significa dos cosas según quién lo escribió

En el mismo historial de la misma clienta, a la vez:

```
toma 1  → errorCrudo = «Todavía no vi a Google Flow generar un video…»   ← una FRASE
toma 10 → errorCrudo = {"media":[{"name":"108dc579…                      ← 1.600 b de JSON
```

`falloGuardable` recibe `data.error`, que es la traducción que escribió
`flow-protocolo.ts`. El sondeo guarda el JSON. Las dos pantallas pasaban ese campo
a `textoFlow` como «lo que dijo el servidor», que **gana sobre la constante** — y
así le dibujamos el payload de Google, con el prompt y los ids adentro, centrado
en el recuadro donde va el video.

Lo que más cuesta ver: **el comentario que eligió ese campo razonaba bien.** Decía
que `error` guarda el TÍTULO y que devolvérselo lo imprimía dos veces, y que «la
frase que sirve vive en `errorCrudo`». La primera mitad era cierta; la segunda,
sólo a veces.

**La regla: si un campo lo escriben dos caminos, escribí qué significa — o son dos
campos.** Ahora la frase tiene el suyo y el crudo vuelve a ser sólo evidencia. Y
la guarda va del lado del que MUESTRA (`pareceFraseParaPersona`), porque el
parámetro ya se usó mal tres veces: arreglar los dos call-sites deja vivo el
tercero.

### Un default que ACUSA

`PasoTomas` caía a `?? 'contenido'` cuando no había causa guardada, o sea que
cualquier fallo sin clasificar salía como «el filtro de contenido rechazó cómo
está escrito el escenario». **Un default no puede ser una acusación**: `desconocida`
dice lo que se sabe, que es nada, y no manda a arreglar algo que capaz está bien.

---

### ElevenLabs: dos 401 de la misma cuenta que mandan a lugares opuestos

```
22/08  /v1/voices            → 200 con las cinco voces clonadas
       /v1/user/subscription → 401 {"type":"payment_required","code":"payment_issue"}
02/09  /v1/user/subscription → 401 {"status":"missing_permissions"}
       /v1/models            → 200 CON LA LISTA VACÍA
```

El primero es una factura impaga y se leyó como «permisos acotados». El segundo es
un permiso faltante sobre una cuenta al día. **Se clasifica por `detail.code`,
nunca por el status.**

⚠️ **Y el 200 con lista vacía casi cierra el tema al revés.** Se leyó como «esta
cuenta no puede hacer voice conversion» y lo que pasaba es que la key no tiene
`models_read`. Cero resultados es una respuesta, no un hecho.

### ⚠️ Un preflight que ejercita la operación REAL y no gasta nada

El ping viejo miraba `/v1/user` y caía a `/v1/models`: los dos dan verde sobre una
cuenta que no puede generar un segundo de audio.

**La técnica, medida y reusable para cualquier API: se manda el pedido real a
propósito SIN cuerpo.** Sin permiso, el servidor contesta 401 antes de mirar el
cuerpo; con permiso, contesta **422 «Field required»**.

```
POST /v1/voices/add            (FormData vacío) → 422 «Field required: name, files»
POST /v1/speech-to-speech/{id} (FormData vacío) → 422 «Field required: audio»
```

Comprobado contra la cuenta real: las dos pueden. Sin crear una voz, sin consumir
un carácter de cuota, y sobre la operación que de verdad se va a usar — que es lo
que la regla de la casa pide y lo que los caminos baratos no dan.

### Cuatro workspaces con la misma key

Medido con `credWs` contra producción:

```
sk_9161f…734a  →  ws 1 (Mauricio) · ws 4 (Cliente de Diseño) · ws 9 (Martín)
sk_f17ba…de1d  →  ws 11 (Leila)
sk_437ba…d3c6  →  el .env local, que no usa nadie porque la fila de la base gana
```

`credWs(clave)` sin segundo argumento resuelve por el workspace del request, y su
última línea devuelve `process.env[clave]` cuando ese workspace es `OWNER_WS` —
que es **un cliente**. Por eso `elevenKey()` va siempre contra `wsSuperAdmin()`, y
hay un test que falla si esa llamada pierde el segundo argumento.

⚠️ **Y esconder la tarjeta con `soloPlataforma` no borra las filas que ya están.**
Las tres del mismo valor siguen ahí; sacarlas es una decisión de Martín, no del
código.

### Lo que decide la calidad de un clon es el MATERIAL

Está medido y es contraintuitivo: un clon hecho con material conversacional sale
~30 Hz por debajo del tono real y suena a lectura. El barrido de `stability` probó
0,00 · 0,35 · 0,60 · 0,85 y **ninguno bajó del doble del objetivo**.

⚠️ **Y ninguno de los dos valores que se pelean por ser «el de producción» estuvo
en ese barrido**: el script usa 0.45/0.85 y el documento 0.55/0.75. Los que viajan
en `lib/elevenlabs.ts` son los del documento, anotados como NO MEDIDOS.

Por eso el copy del paso pide **90 segundos en registro de anuncio, actuando y con
CTA**. Pedir «un audio tuyo» produce material conversacional, y eso ya no se
arregla después.

### Un ternario que marcaba el paso equivocado

`marcarPasoVideoAction(paso === 'cara' ? 'vg_cara' : 'vg_puente')`: cualquier
pantalla nueva marcaba el PUENTE como hecho. No falla, tipa bien —`vg_puente` es
un valor válido— y deja a alguien saltando el paso del navegador sin haberlo
conectado nunca. Ahora es un `Record` completo: agregar un paso sin decidir qué
cierra **no compila**.

### ⚠️ Un guard que lee el fuente también lee los comentarios

Los cuatro guards nuevos de `tests/elevenlabs-voz.test.ts` fallaron la primera vez
**contra las citas que explican por qué existen**: el comentario que documenta un
bug cita el código viejo textual, que es exactamente lo que el guard busca.

Y el mismo test tuvo el otro: `credWs\(([^)]*)\)` corta en el primer cierre —el de
`wsSuperAdmin(`— y deja afuera justo lo que hay que comprobar. **Con paréntesis
anidados se mira la línea, no una captura.**

### Lo que quedó SIN hacer, y por qué

- **El STS todavía no corre en ningún lado.** El pipeline de montaje ya CONSUME
  `sts-N.mp3` (`montar-anuncio-sin-silencios.sh:77`) y **nada en `worker/` los
  produce**: faltan las etapas acelerar → demux → STS → `words-N.json`. Y no puede
  correr en Vercel, que no trae ffmpeg. El worker sigue sin contenedor
  provisionado, así que esto no se puede probar de punta a punta todavía.
- ⚠️ **Dónde entra el STS ya lo decidió el CÓDIGO, y la evidencia respalda el otro
  camino.** El pipeline lo aplica POR TOMA; la única medición de desfase (0 ms
  sobre 100 s) se hizo sobre el montaje COMPLETO. No hay que volver a elegir, pero
  ese número no cubre esta ruta.
- ⚠️ **Y el desfase de labios no es determinista**: tres corridas idénticas sobre
  el mismo audio dieron dos con un tramo corrido 290-310 ms y una limpia. No es una
  propiedad del STS: es un dato por corrida. Se mide con correlación cruzada de la
  envolvente de energía, nunca con los timestamps de un transcriptor (dieron 840 ms
  de desfase falso).
- **No hay precio de STS ni de clonación en `modelo.ts`**, y sin precio no hay
  cupo. Con la key de plataforma, lo único que hoy contenía el gasto —que la
  llamada explota sin key propia— deja de contener.
- **Los slots de voz de la cuenta son un techo de clientes** (H5), y nadie midió
  cuántos entran en el plan actual.
- **`scripts/verificar-corte-anuncio.mjs` está en el Dockerfile y no lo invoca
  nadie**, así que `palabrasPerdidas` promete un dato que nadie escribe — y un
  campo siempre null se lee como «no se perdió ninguna palabra».
- **La única cita de contrato que existe sobre ElevenLabs es la del free tier no
  comercial.** La prohibición literal de compartir credenciales que el repo cita es
  de fal.ai y Replicate, no de ElevenLabs. La decisión de que la key sea de la
  plataforma se sostiene por la regla propia del repo, no por su ToS.

### La toma que Google rechazó 17 veces, y las tres pantallas que la ayudaron a insistir (02/09/2026)

**Vive en:** `lib/flow-fallo-texto.ts` · `app/video-generator/PasoTomas.tsx` ·
`app/video-generator/WizardAnuncio.tsx` · `app/video-generator/video-action.ts`

**Lo medido, que es lo que hace útil todo lo demás.** Un anuncio de 11 tomas con
**UNA sola imagen de escenario**:

```
OK   1..9    filmadas — con esa MISMA imagen
NO  10       «Descarga el diagnóstico del cuello de botella ahora, es gratis…»
NO  11       «Simplemente haz clic en el enlace que te voy a enviar por WhatsApp…»
```

17 consultas de estado consecutivas, **todas** con `IDENTIFIABLE_PERSON_SAFETY`, y
en toda esa hora **cero** generaciones de imagen. Créditos: 898 → 898 con 26
generaciones, o sea que **un rechazo no cobra**.

Y la clienta lo cerró desde afuera: lo intentó **a mano en su propio Google Flow**,
con la misma imagen, y Google contestó *«esta generación podría infringir nuestras
políticas · prueba con otra petición · no se te ha cobrado por esta generación»*.

#### ⚠️ Mandábamos a arreglar lo único que estaba probado

El mensaje decía «genera otra vez la imagen del escenario». Esa imagen había
producido **nueve tomas buenas**. Lo que cambia entre una toma que pasa y una que
no es **lo que DICE** — y las dos que fallan son las únicas dos que dan una
instrucción directa: *descarga esto ahora*, *haz clic en el enlace*.

No sabemos por qué, y el copy no lo afirma: dice adónde mirar. Lo que sí es un
dato es `imagenProbada` —cuántas tomas ya filmó esa misma imagen— y con ≥1 el
mensaje y el BOTÓN cambian de destino.

**La regla: antes de mandar a rehacer una entrada, contá cuántas salidas buenas
ya produjo.** Una entrada con nueve éxitos no es la variable sospechosa.

#### Tres pantallas que empujaban a insistir

1. **El mensaje declaraba la acción y no había botón.** Cada causa de `textoFlow`
   trae su `accion` desde que existe; `PasoTomas` dibujaba título y detalle y nada
   más. «Escribir la salida no es ofrecerla», otra vez.
2. **Y ofrecía «Volver a filmar» para cualquier fallo** — incluido el que ya
   sabemos que falla. ⚠️ **La regla estaba escrita en el paso `toma` de
   `WizardAnuncio`** («ofrecer Volver a filmar ahí es ofrecer un botón que ya
   sabemos que falla») **y la pantalla que se dibuja es la otra.** Una regla
   aplicada en un lugar de dos no está implementada: está documentada.
3. **Nada contaba los rechazos seguidos**, así que decía «suele pasar» en el
   intento 17 igual que en el primero. Un mensaje que consuela en el primer fallo
   **miente en el décimo**, y quien lo lee no tiene cómo saber que ya no aplica.

#### ⚠️ Y el título afirmaba cuál filtro había sido

Decía «Google no quiso animar esta **cara**». Es falso cuando la misma imagen ya
filmó otras tomas: ahí lo que Google rechaza no es la cara. Pasa a «Google no
quiso generar la toma N» — nombra al que se negó y no afirma cuál filtro fue. **El
título dice lo único que se sabe siempre; el detalle es el que precisa.**

#### La etiqueta viaja con la acción, y esto ya se pagó una vez

Con `imagenProbada ≥ 1` el botón deja de llevar a la imagen y lleva al prompt, así
que su rótulo cambia con él (`accionFiltroDeCara`). El repo ya tuvo un botón que
decía «Revisar el puente» y gastaba 15 créditos, porque el rótulo salía de la
causa y el `onClick` de otro lado. **Un botón se rotula por su EFECTO**, y si el
efecto depende de un dato, el rótulo también.

#### Lo que quedó SIN saber

- **Por qué esas dos tomas y no las otras nueve.** La hipótesis es la forma
  imperativa + pedir un clic o una descarga; no está medida y el copy no la
  afirma. Un A/B reescribiendo esas dos líneas lo contestaría en diez minutos.
- **Si el rechazo es estable por línea o intermitente.** 17 intentos idénticos
  dicen «estable para ESTA línea», pero la misma imagen pasó nueve veces: el
  filtro no es determinista por imagen. Nadie midió la otra punta.

### Partir una toma le borraba el idioma, y eran justo las dos que Google rechazaba (02/09/2026)

**Vive en:** `lib/prompts-video.ts` · `app/video-generator/plan-clips.ts` ·
`app/video-generator/video-action.ts` · `app/video-generator/video-pedido.ts`

**Cómo se encontró, que es la parte reusable:** sacando el prompt EXACTO de los 26
pedidos que salieron a Flow y agrupándolos. Los once prompts del anuncio son
idénticos salvo la línea entre comillas… menos en una cosa:

```
los 9 que PASARON   …Todo natural.
                    Spoken in Northern Mexican Spanish (Baja California, Sonora, Sinaloa).

los 2 que FALLAN    …Todo natural.
                    (nada)
```

**24 intentos, 0 con acento.** Nadie lo habría visto leyendo el código: el prompt
se ve completo, el texto sale en español igual, y lo único que cambia es que el
modelo no sabe en qué variedad hablarlo.

#### ⚠️ La causa: un dato que se RESCATA de otro campo desaparece para el que nació sin él

`promptDeClip` hace `acentoDe(clip.prompt)` — rescata el bloque de acento del
prompt que escribió el modelo. Y lo hace **a propósito y con su porqué escrito**:
el acento que vale es el que estaba elegido cuando se escribió el plan, no el del
perfil de hoy; leerlo del perfil haría que cambiarlo le cambiara la voz a un
anuncio ya filmado a medias.

El razonamiento es correcto y **no contempla al clip que nunca tuvo prompt**.
`agregarClip` los creaba con `prompt: ''`, y `acentoDe('')` devuelve vacío.

**La regla: cuando un valor se deriva de otro campo del mismo registro, preguntá
qué pasa con los registros que nacen sin ese campo.** Acá los que nacen así son
los que crea el botón «Partirla en N tomas» — o sea el camino normal para una
línea que no entra en el tope, no un caso raro.

#### Y el segundo hueco, en el mismo camino

`promptDeClip` devuelve el prompt editado A MANO **antes** de tocar el acento. La
precedencia es correcta —quien abrió el prompt y lo cambió sabe algo de esa toma—
pero el acento no es dirección: es una instrucción de idioma que el repo declara
obligatoria. Y esa persona **nunca la vio**, porque hasta el arreglo la pantalla
armaba el prompt sin ella.

Lo que quedó: si el texto a mano trae su propio `Spoken in …`, ése manda y no se
toca. Si no trae ninguno, se le agrega el del plan.

#### Lo que se refutó con datos, y vale anotarlo

La hipótesis del dueño era el «Gratis». **Falsa:** la toma 2 dice «Gratis.», la 8
«te lo estoy regalando» y la 9 «te lo doy gratis». Las tres pasaron. Tampoco es
«estrés y ansiedad», que aparece en la 2 y en la 8.

#### ⚠️ Lo que NO está probado

Que la falta del acento sea **la causa** del rechazo. La correlación es 9 de 9
contra 0 de 24, pero el mecanismo no se conoce — y `failureReasons` dice
`IDENTIFIABLE_PERSON_SAFETY`, que habla de la persona y no del idioma.

Lo contesta refilmar esas dos tomas con el arreglo puesto, **y no cuesta nada**:
los créditos quedaron en 898 después de 26 generaciones, y el propio Flow escribe
«no se te ha cobrado por esta generación». Si vuelve a fallar, el acento no era y
la siguiente variable es la línea (las dos que fallan son las únicas dos que dan
una instrucción directa: *descarga esto ahora*, *haz clic en el enlace*).

#### La técnica, para la próxima

Cuando un proveedor rechaza algunos ítems de un lote y otros no, **el diff no es
entre lo que pediste y lo que esperabas: es entre los que pasaron y los que no.**
Se saca el payload REAL de la base —no el que uno cree que se manda— y se agrupan
por texto idéntico. Acá esa agrupación puso el hallazgo a la vista en un comando:
catorce prompts distintos, y los tres últimos grupos sin la línea que todos los
demás tenían.

---

## Cuatro rechazos de la misma pantalla, y ninguno se veía leyendo el código

**Vive en:** `app/video-generator/OnboardingVideoGen.tsx` ·
`app/video-generator/WizardAnuncio.tsx` · `scripts/mirar-pantalla.mjs`

El paso «Tus fotos» del onboarding de /video-generator se rehízo **cuatro veces**.
Las tres primeras se entregaron sin haberlas mirado nunca, y el dueño las rechazó
sobre capturas que sacó él. La cuarta arrancó con su reclamo textual: *«¿Qué te
cuesta ir sacando capturas para ver si lo que estás haciendo está bien?»*.

Lo que apareció al mirar, y **ninguno de los cuatro se ve leyendo el archivo**:

### 1. `Estudio` mete a sus hijos en un flex ROW

Su contenedor es `<div style={{ width: "100%", display: "flex", justifyContent:
"center" }}>{children}</div>` — sin `flexDirection`, o sea **fila**. La generación
le pasa un único hijo, así que en cinco pantallas eso nunca se notó. El onboarding
le pasa varios, y **los fragmentos de React no crean DOM**: se aplanan y quedan de
lado a lado. En pantalla: la foto a la izquierda y el «¿Por qué la foto decide
todo?» flotando a la altura de su hombro.

**La regla: un contenedor que hoy recibe UN hijo tiene una dirección implícita que
nadie eligió.** El día que reciba dos, el layout que aparece no es el que alguien
diseñó — es el default. Y no hay diff que lo muestre: el cambio está en el
llamador, no en el contenedor.

### 2. Un recorte con margen negativo mostraba el BORDE de la foto

La primera versión de las fotos laterales recortaba con `marginLeft: -204` sobre
una imagen de 300 px. En un retrato, el borde derecho es **fondo**: la lateral
izquierda se veía vacía y la derecha se veía bien sólo porque esa foto era clara.
Una composición coja que se lee como rota. Con `objectFit: cover` centrado, cada
lateral muestra el medio de su foto —una cara— y las dos pesan igual.

### 3. Una captura tomada «cuando el texto se quedó quieto» no tiene las imágenes

Las fotos vienen de URLs firmadas de Supabase y cargan **mucho** después de que el
`innerText` deja de cambiar. La captura salió con los huecos vacíos y se leyó como
«los laterales no se dibujan» sobre una pantalla que los tenía, sólo que todavía
transparentes. Se estuvo a un paso de «arreglar» algo que funcionaba.

Son **dos** esperas distintas: que el texto se asiente, y que
`document.images` esté toda con `complete && naturalWidth > 0`.

### 4. Un `:hover` no se verifica leyendo el CSS ni forzando el estilo

Poner `opacity: 1` a mano prueba que el velo **se dibuja**, no que el hover lo
**dispare** — que es justamente lo que se quería saber. Va un
`Input.dispatchMouseEvent` de tipo `mouseMoved` sobre el centro del elemento, que
produce un `:hover` de verdad.

### La herramienta, y sus cinco trampas

`scripts/mirar-pantalla.mjs` levanta un Chrome dedicado por CDP y captura una ruta.
Cada línea de su cabecera costó una corrida:

1. **Un Chrome DEDICADO**, con su propio `--user-data-dir`. Una pestaña CDP nueva
   sobre el Chrome de todos los días puede no hidratar nunca.
2. **Se entra por `/api/auth/dev-login?ws=1`** — ws1 es el único exento del
   onboarding global, así que es el único donde una tab se puede ver.
3. **`Emulation.setDeviceMetricsOverride` ANTES de navegar**: sin viewport
   declarado `innerWidth` es 0 y toda medición devuelve cero, que se lee como «no
   hay nada».
4. **No se llama desde Git Bash.** MSYS convierte todo argumento que empiece con
   `/` en una ruta de Windows antes de que node lo vea: `/video-generator` llega
   como `C:/Program Files/Git/video-generator`. La primera corrida aterrizó en
   `/general` y **el diagnóstico obvio —«el `next=` del dev-login no manda»— era el
   equivocado**; la segunda murió con «Cannot navigate to invalid URL», que es la
   misma causa gritando más fuerte. Va por PowerShell, y el script se niega a
   arrancar si la ruta le llega con `:` adentro.
5. **Lo que se interpola en una expresión de `Runtime.evaluate` lo pone NODE.**
   Escribir `JSON.stringify(HOVER)` adentro del string lo manda tal cual al
   navegador, donde esa variable no existe: el selector viaja con la palabra HOVER
   adentro y contesta null. El síntoma es «no encontré», que se lee como que el
   elemento no está en la pantalla — y manda a depurar el componente.

⚠️ Y adentro de esa expresión —que es un template literal— **no va ningún**
**backtick**, ni en un comentario. Rompió dos veces seguidas, la segunda en el
comentario que advertía sobre los backticks.

### ⚠️ Recorrer el wizard ESCRIBE en el workspace del cliente

ws1 es **Mauricio**, un cliente real. Cada «Siguiente» marca su paso como hecho y
llegar al final le da el onboarding por cerrado — o sea que **mirar la pantalla la
haría desaparecer**. Antes de recorrerlo se guarda `app_settings` con
`key = onboarding.tab.video-generator` del ws1, y después se restaura. Vale para
cualquier pantalla con estado que se verifique a mano: la verificación no puede
dejar rastro en los datos de alguien.

### Lo que quedó SIN hacer

- La grilla de acentos del paso 2 desborda el `ancho={520}` de `Estudio` (mide ~900
  px) y su segunda fila queda desbalanceada a la izquierda. Se ve bien, pero no es
  una decisión de nadie. Vive en `app/video-generator/OnboardingVideoGen.tsx`.
- La dirección implícita de `Estudio` sigue ahí: se envolvió en el llamador para no
  cambiarle el layout a las cinco pantallas de la generación. El día que otra
  pantalla le pase dos hijos, vuelve a pasar. Vive en
  `app/video-generator/WizardAnuncio.tsx`.

*Corrida del 02/09/2026.*

---

## El onboarding de video-gen, segunda vuelta: seis cosas que sólo dijo la pantalla

**Vive en:** `app/video-generator/OnboardingVideoGen.tsx` · `lib/acento-workspace.ts` ·
`scripts/onboarding-vg-recorrer.mjs` · `scripts/onboarding-vg-respaldo.mts`

### 1. Un array escrito a mano al lado de un catálogo se queda viejo, y no falla

El catálogo de acentos pasó de 7 variedades a 32. Tres lugares lo repetían a mano:
dos mapas copiados en la pantalla «para no importar del server» —`lib/acento-workspace.ts`
no tiene `server-only` justamente para que la pantalla lo use— y el array `ORDEN`
que decide qué se puede elegir. **Una opción que existe y no está en ese array
simplemente no se puede elegir: sin error y sin síntoma.** Lo único que hizo ruido
fue que un `Record<AcentoId, string>` incompleto no tipa; el array, que es
`AcentoId[]`, habría pasado callado. Ahora sale de `Object.keys(ACENTOS_ES)`.

### 2. Mover un paso al principio no mueve su guarda

El paso del puente se mudó al arranque, con un motivo bueno: la extensión hay que
bajarla e instalarla, así que conviene que eso pase mientras la persona contesta lo
demás. Su guarda —«no avanzas hasta que el puente responda»— se quedó donde estaba y
era correcta cuando el paso era el ÚLTIMO. En el primero **convierte el recorrido
entero en una sola pantalla**, y con el botón de salir removido, en una tab sin
salida. El síntoma en la captura: los seis pasos dieron el mismo título seis veces.

**La regla: al mover un paso, la guarda se re-lee desde su nueva posición.** Una
guarda que pide algo con tiempo de espera propio no puede vivir antes de lo que
estaba esperando.

### 3. `undefined` y `null` no son lo mismo cuando uno de los dos significa «no pregunto»

`Estudio` tiene escrito al lado de su render que `puente === undefined` es «esta
pantalla no lo pasa» y `null` es «no hay puente», que sigue siendo un dato y sigue
dibujando el aviso. Pasar `null` para apagarlo no hizo nada — y el arreglo se veía
perfecto en el diff. Lo dijo la captura: «Falta la extensión de MaKo · Descargar»
seguía saliendo, y llegó a estar **tres veces en la misma vista** (el aviso de
arriba, el paso 1 y el `AvisoPuente` del cuerpo), porque los tres describen el mismo
hecho desde tres componentes distintos.

### 4. Un paso puede delegar TODO su contenido en algo que no se dibuja en el flujo

El paso del puente no tenía nada propio: mostraba `AvisoPuente`, cuya última rama es
un puntero `position: fixed` a la esquina del navegador. En el estado más común
—extensión sin instalar— la pantalla quedaba con el título, un plegable y el botón, y
su único contenido flotando fuera del flujo. Se reportó como «no tiene nada dentro».

### 5. `MediaRecorder` entrega webm, y el server decide por EXTENSIÓN

`familiaDeArchivo` mira la extensión antes que el mime, y `.webm` está en la familia
VIDEO. Una grabación subida en crudo se rechaza con «no es un audio» — un error que
culpa al archivo de la persona por una decisión nuestra. Se convierte a mp3 con
`blobToMp3`, que ya existía para el inbox de WhatsApp, y de paso entra en el tope de
4 MB del POST.

### 6. Un ícono inventado se dibuja como un punto

`<Icon name="microfono">` no existe (es `mic`) y **el typecheck no dice nada**. Es el
mismo modo de falla que un `var(--token)` inexistente. La lista real sale de
`app/_components/icons.tsx`.

### ⚠️ Lo que costó caro: verificar ESCRIBE

Recorrer el wizard para mirarlo le guardó al ws1 —Mauricio, Baja California— el
acento **argentino**, porque la detección por zona horaria lee la máquina del que
verifica. El respaldo cubría `onboarding.tab.video-generator` y no `video.voz`, que
es donde escribe la action de ese paso.

Se recuperó de los datos, no de la memoria: los **366 trabajos** ya mandados a Flow
traen el prompt con el bloque de acento pegado — 22 decían «Northern Mexican Spanish
(Baja California, Sonora, Sinaloa)» y ninguno traía bloque de muletillas. **Un valor
que quedó escrito dentro de algo ya emitido es un registro del valor que había.**

La regla completa quedó en `AGENTS.md` → «Verificar una pantalla ESCRIBE, y hay que
enumerar dónde».

### Lo que quedó SIN hacer

- Las muletillas propias (las que la persona escribe) viajan al prompt igual que las
  sugeridas, pero **nadie valida que sean muletillas**: se puede escribir una frase
  entera y termina entre comillas dentro del prompt de cada toma. Vive en
  `app/video-generator/OnboardingVideoGen.tsx` → `agregarMuletilla`.
- La detección por zona horaria cubre 45 zonas IANA. Una que no esté no cae a nada
  —correcto— pero tampoco se registra, así que no hay forma de saber qué zonas
  reales están quedando afuera. Vive en `lib/acento-workspace.ts` → `POR_ZONA`.

*Corrida del 02/09/2026.*

---

## La extensión y la Chrome Web Store: por qué «poné el flag en true» era el arreglo equivocado

**Vive en:** `lib/extension-tienda.ts` · `scripts/version-en-tienda.mjs` ·
`scripts/publicar-extension.mjs` · `app/video-generator/extension-instalada.tsx` ·
`app/privacidad/extension/page.tsx` · `extension/mako-puente.js`

El pedido era «que la extensión se pueda descargar de Google, y actualizá la
versión de Google». Parecía un booleano. Una corrida de 46 agentes sobre 5
frentes, con refutación adversarial de cada hallazgo, devolvió que ese booleano
era la parte chica.

### El dato que gobernaba la decisión estaba mal, escrito en un comentario

`lib/extension-tienda.ts` decía «la tienda tiene la 0.1.0, o sea la que fallaba
TODO». **Medido el 02/09/2026: tiene la 0.5.0, publicada el 28/08.** Un hecho
externo escrito en un comentario envejece sin avisar, y ese comentario era lo
único que alguien iba a leer antes de mover el flag.

**La regla: si una decisión cuelga de un hecho externo, el hecho se MIDE en el
momento de decidir.** Y si se puede medir con un comando, el comando va al repo —
`scripts/version-en-tienda.mjs`.

### Un booleano hay que DESHACERLO; una versión declarada se corrige sola

El flag no era manual por descuido: su comentario explicaba, con razón, que no hay
forma de preguntarle a Google si ya aprobó. Lo que no contemplaba es que el repo
avanza en cada push y la tienda sólo cuando alguien publica **y** Google aprueba —
así que «repo adelante de la tienda» no es una excepción, es el estado normal, y un
booleano en `true` se vuelve mentira en el push siguiente.

Ahora se declara el HECHO (`VERSION_EN_TIENDA`) y el permiso se DERIVA:

```ts
export const EXTENSION_EN_TIENDA = !esMasVieja(VERSION_EN_TIENDA, EXTENSION_VERSION);
```

**El modo de falla por olvido es SEGURO**, y eso es lo que lo hace adoptable: si
alguien publica y no actualiza la constante, queda en `false` y se sigue ofreciendo
el zip, que siempre está al día. Desactualizarla sólo puede APAGAR la tienda, nunca
prenderla de más.

⚠️ Y la comparación NO se reescribió: `esMasVieja` ya existe en
`lib/version-comparar.ts`, está testeada y tiene gemelas. Acá importaba especialmente,
porque el par real es **0.5.0 vs 0.38.7**: como número 0.5 es MAYOR que 0.38, como
texto también, y como versión es MENOR. Las tres formas de comparar dan resultados
distintos y dos de ellas prenden la tienda con la versión rota.

### `--estado` contesta otra pregunta, y creerle habría causado el daño exacto

`publicar-extension.mjs --estado` pega con `?projection=DRAFT`, así que su
`crxVersion` es la del BORRADOR: se pone al día apenas termina el PUT, **no cuando
Google aprueba**. Gatear el flag con ese número lo habría puesto en `true` mientras
la tienda pública seguía sirviendo la vieja — que es literalmente el daño que el
gate viene a evitar.

La única fuente que contesta «qué se lleva alguien que instala AHORA» es la ficha
pública. Y no necesita credenciales, que es la otra razón para preferirla.

⚠️ Al leer esa ficha, **dos trampas**: el HTML trae los manifests de las
extensiones RECOMENDADAS al pie, así que una regex floja se lleva la versión de
Adblock Plus con total naturalidad; y la descripción propia aparece DOS veces —
primero como texto visible, después dentro del manifest—, así que un `indexOf`
ancla en la visible, que no tiene ninguna versión delante, y la lectura da null
para siempre. Se leen las dos fuentes y se exige que coincidan.

### Prender la tienda rompía tres cosas, y una escondía el único aviso útil

El aviso de «tu extensión quedó vieja» compara contra la versión del ZIP y no podía
saber de dónde vino la instalación. Con un install de tienda eso da `true` **para
siempre** —la ventana repo>tienda es permanente por diseño— así que:

- se le muestra un aviso que no puede resolver (Chrome la actualiza sola), y
- `VideoGeneratorApp.tsx` usa esa misma condición para SUPRIMIR el aviso del puente
  («un aviso a la vez»), así que se le esconde permanentemente el único que sí
  puede resolver.

Arreglar sólo el componente dejaba vivo el segundo. **La pregunta «¿está vieja Y
puedo hacer algo?» pasó a vivir en un solo lugar** (`useExtensionVieja`) y la
extensión ahora dice de dónde vino (`data-mako-puente-tienda`, sacado de
`manifest.update_url`, que sólo existe si el paquete lo armó Google). El service
worker ya razonaba así; lo que faltaba era decírselo a la web.

⚠️ **Ausente no es «no».** Un atributo que no está es ambiguo —zip viejo, o tienda
vieja de antes de este cambio— así que el default es MOSTRAR el aviso. Y el arreglo
sólo llega a la gente dentro del paquete que se publique: por eso la versión subió
a 0.39.0, porque un arreglo en el content script sin número nuevo no le llega a
nadie.

### La política de privacidad afirmaba «solo dos cosas» y eran siete

Medido leyendo el `body` del latido en `extension/background.js`: van `token`,
`projectId`, `estado`, `detalle`, `resultados`, `version`, `accionesCaptcha`,
`clases`, y —según el caso— `respuestas` y `plantillas`. La política se escribió
cuando eran dos y nadie la volvió a mirar.

Lo que sí resultó CIERTO al verificarlo: `injected.js` saca el `authorization` sin
sensibilidad a mayúsculas antes de guardar una plantilla, así que «no envía tu token
de Google» se sostiene. **Verificar antes de reescribir importó en las dos
direcciones**: una afirmación era falsa y la de al lado era verdadera.

### La API con la que se publica se apaga en 43 días

Verificado en la documentación de Google: **la Chrome Web Store API v1 se soporta
hasta el 15 de octubre de 2026.** Todo `publicar-extension.mjs` habla v1. Publicar
hoy con eso es correcto; montar el OAuth de v1 creyendo que es para siempre, no.
Los tres endpoints de la v2 quedaron escritos en la cabecera del script — pide un
`PUBLISHER_ID` que no está en el repo y acepta service accounts.

### Lo que quedó SIN hacer

- **Migrar a la API v2.** No se escribió a ciegas a propósito: sin publisher id ni
  credenciales no se puede ejercitar una línea, y un publicador que no se puede
  probar es peor que uno viejo que funciona. Vive en `scripts/publicar-extension.mjs`.
- **`/extension/instalar` sigue siendo excluyente**: con la tienda prendida, la
  sección «Actualizar a una versión nueva» desaparece, y es justo a donde apunta el
  aviso para quien ya tiene la descomprimida. Tiene que ser aditiva.
- **Ningún test mira `EXTENSION_EN_TIENDA`.** El gate derivado cambia producción sin
  red. Vive en `tests/redirects-gate.test.ts`.
- **El salto 0.5.0 → 0.39.0 agrega permisos** (`scripting`, host `hola-mako.com`):
  Chrome DESHABILITA la extensión a los usuarios de tienda hasta que acepten. Antes
  de publicar conviene mirar cuántos hay en el panel de la CWS.

*Corrida del 02/09/2026 · 46 agentes, 5 frentes, refutación adversarial · 41
hallazgos, 31 sobrevivieron.*

---

## El clic que no dejaba marca, y cinco salidas escritas que no ofrecía nadie

*03/09/2026 · Video Generator · lo que quedó de acompañar a un cliente en vivo y
de dos corridas de agentes sobre el módulo.*

El reporte del dueño, con el cliente delante, fue: **«no le está dando click. No
le des doble click, dale un solo click».** Los seis defectos que salieron de ahí
comparten una forma, y es la que conviene llevarse: **la app SABÍA lo que había
que hacer y no lo mostraba.**

### 1. Seleccionar y avanzar eran una sola cosa, y el gate frenaba las dos

**Vive en:** `app/video-generator/VideoGeneratorApp.tsx` (`empezar`)

El gate del puente estaba ANTES del `setPuestaId`:

```ts
if (!puenteAnda) { resaltarAviso(); return; }
setPuestaId(id);
```

Con el puente caído, el clic no encendía **nada**: ni el marco azul de la
tarjeta, ni su tilde, ni el botón «Crear mi anuncio» — los tres cuelgan de
`puestaId`. La única respuesta era un pulso sobre un cartel que vive arriba de
todo, a media pantalla del cursor.

Desde afuera eso es un botón roto, y la persona lo repite.

**La regla:** cuando un gate frena una acción compuesta, partila. Lo que el gate
tiene derecho a frenar es el efecto caro (entrar al recorrido); el ACUSE de que
el clic llegó no se puede negociar, y tiene que ocurrir **donde está el cursor**.

### 2. Y la única respuesta que quedaba estaba colgada de un id que no se dibujaba

**Vive en:** `app/video-generator/VideoGeneratorApp.tsx` (`resaltarAviso`) ·
`app/video-generator/extension-instalada.tsx`

`resaltarAviso()` hacía `getElementById(ID_AVISO_PUENTE)` y ese id lo pone
`AvisoPuente`, que está detrás de `!extensionVieja`. **Con la extensión vieja
—que es exactamente el estado en el que estuvo el cliente toda la sesión— el que
se muestra es `AvisoExtensionVieja`, que no llevaba id.** El `getElementById`
devolvía null y la función salía por su `return`.

O sea que el clic quedaba **literalmente mudo**: ni marco, ni tilde, ni botón, ni
pulso, ni scroll. Cero.

Y la segunda rama tenía el mismo defecto: con `prefers-reduced-motion` —frecuente
en Windows con «Mostrar animaciones» apagado— era un `return` pelado. Ahora va el
foco, que sirve igual y además lo anuncia un lector de pantalla.

**La regla:** una respuesta colgada de un id que puede no estar renderizado no es
una respuesta. Si hay dos avisos posibles, se busca **el que esté**, no el que
suponemos.

⚠️ **Y el corolario de diagnóstico:** los dos defectos juntos explican un síntoma
que se reporta como «el botón no anda». Antes de buscar el handler, preguntá
**qué se dibuja cuando el handler corre y no pasa nada**.

### 3. La puerta al modal se cerraba con CERO fotos

**Vive en:** `app/video-generator/WizardAnuncio.tsx` (`FotoGrande`)

`puedeCambiar={(contexto?.fotos?.length ?? 0) > 0}`. Y `FotoGrande` con
`puedeCambiar` en false devuelve los hijos pelados: sin hover, sin ícono y sin
click. O sea que **la única entrada al modal se cerraba justo en el estado en el
que hay que subir una foto**. La pantalla quedaba en un ícono gris de perfil sin
nada que tocar.

**La regla:** una condición del tipo «habilitá esto cuando haya datos» hay que
leerla con el conjunto VACÍO en la mano. Si el control es el único camino a
crear el primer dato, la condición está al revés.

### 4. Tres salidas completas que no ofrecía nadie

Es «escribir la salida no es ofrecerla» —que este repo ya tiene escrita cuatro
veces— apareciendo otras tres:

| Qué estaba escrito | Por qué no lo alcanzaba nadie |
|---|---|
| `<input type=file>` + `subir()` + `subirImagenEscenaAction` entera | nada llamaba a `archivo.current.click()` |
| `textoEleven()`: siete motivos con título, detalle, culpa y link | las dos pantallas hacían `setError(j.error)` y **tiraban el `motivo`** que la ruta mandaba al lado |
| `puesta.tecnico` («Plano secuencia», «Voz en off») | sólo se dibujaba adentro del modal de detalle |

El de ElevenLabs es el que más duele: el catálogo existe **precisamente porque
«unauthorized» y «tu suscripción tiene un pago pendiente» son el MISMO 401** y se
ven iguales desde afuera. Sin llamarlo, a alguien con la factura impaga se le
decía que su key estaba mal.

El de `tecnico` es un problema de nombres: el catálogo se elige mirando una
grilla de apodos —«The Office», «Dualcast»— que se entienden **después** de ver
el ejemplo. Había que abrir las nueve tarjetas para saber qué ofrecía cada una.

### 5. El sondeo de la imagen se apagaba con la falla que él mismo tenía que curar

**Vive en:** `app/video-generator/variantes-imagen.ts` (`imagenEnCurso`) ·
`app/video-generator/video-action.ts` (`estadoImagenAction`)

`if (!m?.trabajoId || m.error) return false;` — cualquier error dejaba la imagen
fuera del sondeo para siempre. Y el sondeo es quien llama a `estadoImagenAction`,
que es **donde vive la cura** de un error de puente.

**Es el mismo defecto que ya se había curado en las tomas**, con su comentario
escrito y todo, vivo en su hermana. Un arreglo aplicado en un lugar de dos no
está implementado: está documentado.

### 6. El instructivo mandaba a tocar un ícono que todavía no existe

**Vive en:** `app/extension/instalar/page.tsx` · `FiguraAnclar.tsx`

Los TRES instructivos decían «toca el ícono de MaKo en la barra de Chrome». Recién
instalada **no hay tal ícono**: Chrome mete toda extensión nueva adentro del menú
de la pieza de rompecabezas y sólo aparece en la barra si alguien la ancla.

Falla en silencio, que es lo peor: la persona mira la barra, no ve nada, y
concluye que la instalación salió mal — cuando salió bien.

Y el paso nuevo **no se puede escribir, hay que dibujarlo**: nombra dos controles
de Chrome que la mayoría no miró nunca, y el segundo aparece recién al abrir el
primero. Va como SVG y no como captura por dos razones — una captura de Chrome
envejece con cada rediseño de Chrome y nadie se entera, y además trae las
extensiones y los marcadores de quien la sacó.

### 7. Re-clonar la voz abandonaba la anterior en la cuenta

**Vive en:** `app/api/onboarding/voz/route.ts`

`clonarVoz` siempre crea una voz NUEVA y `guardarClon` pisa el id anterior. **Cada
re-clonado dejaba una voz colgada sin nada que la nombrara: nueve huérfanas
medidas en la cuenta de la casa.** Importa porque las cuentas de ElevenLabs topean
la cantidad de voces personalizadas, y con BYOK esos slots son del cliente.

**El orden es lo único que separa «quedó una de más» de «se perdió la única»:** se
anota el id viejo, se crea el nuevo, se GUARDA, y recién ahí se borra el viejo.

### Lo que quedó SIN hacer

- **El projectId de Flow no se elige: se espía.** Sale de la URL de las llamadas
  de imagen o de una plantilla ya guardada (`app/api/flow/puente/route.ts`, la
  constante `proyecto`). Funciona, y significa que nadie eligió con qué proyecto
  de Flow trabaja su cuenta — que es la otra mitad del pendiente «la sesión de
  Flow parece estar en la cuenta equivocada».
- **Las 9 voces huérfanas que ya están** se limpian a mano desde el panel de
  ElevenLabs. El código ya no crea más.
- **Con la extensión vieja no se ve el aviso de que falta abrir Flow**
  (`VideoGeneratorApp.tsx`, `{!extensionVieja && !puenteAnda && …}`). Es
  deliberado —una rama a la vez, de lo más bloqueante a lo menos— y conviene
  saberlo: alguien con las dos cosas mal arregla una y recién ahí se entera de la
  otra.

### Y el guard que salió de todo esto

**Vive en:** `scripts/hooks-en-orden.sh` · `scripts/eslint-hooks.config.mjs`

El «Minified React error #300» del mismo día —`didRenderTooFewHooks`, un
`useExtensionVieja()` que había quedado detrás de un `return`— **no lo cazaba
nadie**: llamar un hook es una llamada a función perfectamente tipada, así que el
typecheck lo deja pasar, y el pre-push no corre los tests. `npm run lint` sí lo
caza y tarda 3 min 19 s, que es un costo que ningún hook puede pagar.

Dos cosas que costaron una corrida cada una al escribirlo:

- **La config hereda la del repo y le VACÍA las reglas**, en vez de declarar un
  solo plugin. Con un plugin solo, todo archivo que tenga un `eslint-disable` de
  otro plugin hace que eslint conteste «Definition for rule … was not found» y
  salga con error: el guard bloquearía el push por un comentario válido.
- **Y se le saca `parserOptions.project`.** Con análisis de tipos son 64 s en vez
  de 15, y `rules-of-hooks` mira la FORMA del código, no los tipos.

*Corrida del 03/09/2026 · dos tandas de agentes con refutación adversarial + una
sesión en vivo con un cliente · 8 hallazgos que bloqueaban, 7 arreglados.*

---

## Google mudó Flow a su propio dominio, y eso apagó la extensión entera

*04/09/2026 · reportado como «pasa muchísimo esto: abro Flow y la extensión no lo
detecta», con la captura de las dos pestañas al lado.*

**Vive en:** `extension/manifest.json` · `extension/background.js` (`PATRONES_FLOW`) ·
`extension/injected.js`

### El hecho, que estaba en la captura

| | |
|---|---|
| La pestaña de Flow del cliente | `https://flow.google.com/project/<uuid>` |
| Lo que buscaba la extensión | `https://labs.google/fx/*tools/flow*` |

No matchean. `chrome.tabs.query` devuelve vacío, `pestanaDeFlow()` tira
`NO_FLOW_TAB`, `hayFlow` queda en false y el popup dice **«Abre Google Flow»** con
Flow abierto y cargado en la pestaña de al lado.

### Y se mordía la cola

El botón «Abrir Google Flow» navegaba a `labs.google/fx/tools/flow`. Google deja a la
persona en el dominio nuevo — y la extensión **pierde de vista la pestaña que ella
misma acaba de abrir**.

Por eso no fallaba a veces: **fallaba siempre**, y el único control que la pantalla
ofrecía era exactamente el que garantizaba el fallo.

### ⚠️ Lo más caro: este mismo síntoma ya se había investigado, y se había arreglado bien

El 02/09 se reportó textual: *«ya abrimos Flow y no funcionó, no deja de salir el
botón de abrir Flow»*. Se encontró una causa **verdadera** —el filtro `discarded`
convertía «hay una durmiendo» en «no hay ninguna»— y se arregló. Ese arreglo sigue en
su lugar y sigue siendo correcto.

**Una causa verdadera puede no ser LA causa**, y ésta tapó a la otra durante dos días:
el síntoma volvía, y el comentario del código —bien escrito, con su caso medido— decía
que ya estaba explicado.

La señal para reconocerlo: cuando un arreglo correcto no hace desaparecer el síntoma,
la hipótesis por defecto no es «el arreglo no se desplegó» sino **«hay una segunda
causa, y la primera me está tapando la vista»**.

### El alcance: nueve sitios clavaban el dominio

`host_permissions`, los dos bloques de `content_scripts`, dos filtros de
`webRequest`, el patrón del `tabs.query`, la URL del botón, el prefijo tRPC del espejo
y dos mensajes de error. Ahora hay **una** lista (`PATRONES_FLOW`) y todo deriva de
ahí; el único lugar donde se repite es el `manifest.json`, que no puede importar nada.

Van **los dos dominios** y no sólo el nuevo: no sabemos si Google migró a todo el
mundo, y reconocer los dos anda en las dos direcciones.

### Las dos decisiones sobre lo que NO se sabe

La regla de la casa es que un pedido a una API privada de Google **se copia, no se
reconstruye**. Así que donde no había medición, no se adivinó una ruta:

- **El espejo de `injected.js` reconoce la API de la app por la RUTA (`/api/trpc/`),
  no por el host.** El script sólo corre DENTRO de una página de Flow, así que «mismo
  origen + `/api/trpc/`» dice exactamente lo que se quería decir —la API de la app que
  me hospeda— sin nombrar ningún dominio. La próxima mudanza no lo rompe.
- **El filtro de `webRequest` nombra el ENDPOINT (`getMediaUrlRedirect`), no el
  prefijo de ruta**, que en `flow.google.com` no está medido. El nombre del endpoint
  sale del código de la propia app y no cambió con la mudanza.

### La segunda tanda, con la extensión ya en el dominio nuevo

Con la 0.40.0 puesta, el popup dejó de decir «Abre Google Flow» —la pestaña ya se
detecta— y pasó a decir otra cosa. Lo que apareció detrás:

**«Inicia sesión en Google Flow» a alguien logueada.** Su pestaña era
`flow.google.com` con su avatar, su plan y su botón de «Salir» a la vista. El bearer
se ve al pasar, en el header `Authorization` de una llamada a la API de Flow, y en la
**portada** —la lista de proyectos— la app no hace ninguna: pide sus cosas con
cookies. O sea que estar perfectamente logueada y no producir ni un bearer **es el
estado normal ahí**.

Son dos estados distintos que se mostraban con el mismo cartel, y el que se mostraba
pedía lo único que ya estaba hecho. `flowEnProyecto` los separa: en la portada dice
«Abre un proyecto en Flow», que es la precondición real.

**«An unexpected response was received from the server.» en un popup en español.** No
era nuestro: lo tira el runtime de Next cuando una pestaña abierta desde antes de un
deploy llama a una server action cuyo id ya no existe. Llegaba CRUDO al popup, y el
botón que ofrecía era «Volver a intentar» — que sobre una pestaña vieja falla igual
las veces que se apriete. Ahora se clasifica (`pagina_vieja`) y el botón dice
«Recargar y conectar».

⚠️ La firma para reconocerlo: **un texto en inglés dentro de una interfaz en español
es un `e.message` crudo de una capa que no es nuestra.** Si además el remedio que
ofrece el botón no tiene nada que ver con esa capa, el mensaje no está clasificado.

**Y el décimo sitio que clavaba `labs.google`**: el listener que late apenas carga
Flow. No rompía nada — sólo hacía que la buena noticia tardara hasta 30 s. Los nueve
del barrido anterior eran los que rompían; el que no rompe es el que se queda.

### El nombre del archivo lleva la versión

`public/mako-puente-<versión>.zip`, y la URL se DERIVA de `EXTENSION_VERSION`.

Un nombre fijo tiene tres formas de servir bytes viejos, y las tres son silenciosas:
el caché del navegador, el del CDN, y —la que más muerde— **la carpeta de Descargas**.
Si ya existe `mako-puente.zip`, Chrome guarda la nueva como `mako-puente (1).zip` y la
carpeta descomprimida anterior sigue ahí con el mismo nombre. La persona carga la
vieja y no tiene forma de saberlo. Este repo ya pagó esa exacta: un cliente estuvo
horas corriendo una copia de dos horas antes.

⚠️ Y el detalle que lo hace valer el doble: **el zip trae los archivos SUELTOS en la
raíz**, así que la carpeta que queda al descomprimir hereda el nombre del archivo. El
paso de «elegí la carpeta» —donde más gente se perdió— deja de ser ambiguo solo.

Dos guardas alrededor: el generador **borra la anterior** en la misma corrida (dos
zips en `public/` son dos candidatos, que es el problema con otro nombre), y
`/mako-puente.zip` queda como **ruta que redirige** a la vigente y sin cachear, para
que un link viejo no dé 404 ni entregue algo viejo. El redirect es 307 y no 301 a
propósito: un permanente lo guarda el navegador para siempre y la próxima versión no
lo podría mover.

### Lo que quedó SIN medir

- **Si `flow.google.com` sirve su tRPC bajo `/fx/api/trpc/` o bajo otro prefijo.** La
  sonda de diagnóstico del medio arma esa URL con el prefijo viejo; está envuelta en
  `try/catch` y no es el camino del producto, y el comentario lo dice. Se contesta
  mirando la pestaña real: qué host y qué path piden las llamadas de la grilla.
- **Si el bearer y la `apiKey` se siguen viendo.** El filtro de `webRequest` que los
  captura ya incluía `aisandbox-pa.googleapis.com`, que es un host aparte, así que en
  principio sí — pero no está comprobado en el dominio nuevo.

### El costo operativo, que no tiene vuelta

**El arreglo vive en la extensión, no en el server: cada cliente TIENE que
actualizarla.** La 0.39.1 no reconoce el dominio nuevo y no hay nada que se pueda
hacer desde acá. Lo que sí avisa solo es `versionEsperada`, que viaja en cada latido:
la app le dice a la extensión que quedó vieja.

*Reportado con captura el 04/09/2026 · diagnosticado leyendo el manifest, sin corrida
de agentes: el `grep` del dominio dio el mapa completo en una llamada.*

---

## Google no mudó Flow: lo REESCRIBIÓ. El protocolo del puente ya no existe

*04/09/2026 · medido leyendo el tráfico de una cuenta real, dentro de un proyecto
cargado, en el navegador de la clienta.*

**Vive en:** todo `extension/` · el mecanismo entero, no un archivo

### La medición

```
POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute
     ?rpcids=<id>&source-path=/project/<uuid>
     &bl=boq_labs-ai-sandbox-frontend_20260903.13_p0
```

Eso es **BOQ / batchexecute**, el transporte RPC interno de Google. Dentro de un
proyecto cargado, con contenido, es lo ÚNICO que la app llama. `rpcids` vistos:
`xI9TVb`, `UpteDb`, `NfrxTb`, `ve2Lsc`, `DTaVef`.

Y lo que **no** hay, que es lo que importa:

| Lo que el puente captura | En el Flow nuevo |
|---|---|
| `Authorization: Bearer ya29.…` | **no existe** — BOQ autentica con cookies |
| `?key=AIza…` | **no existe** |
| `/v1/projects/<id>/…` | **no existe** |
| `aisandbox-pa.googleapis.com` | **cero llamadas** |

O sea que el protocolo entero —capturar el bearer y la apiKey al pasar, y repetir
después las llamadas REST desde el service worker— **no tiene contraparte**. No falta
un permiso ni un patrón de host: lo que capturamos ya no se emite.

**Y no hay a dónde volver:** `labs.google/fx/tools/flow` dejó de ser la app. Hoy es
una landing de marketing con un botón «Create with Google Flow».

### ⚠️ Dos veces en dos días, una causa verdadera tapó a la de abajo

El 03/09 el síntoma era «abro Flow y no lo detecta». Causa encontrada: el filtro
`discarded`. **Verdadera**, arreglada, y no era la causa.

El 04/09, con eso arreglado: «mudaron el dominio a flow.google.com». **Verdadera**,
arreglada, y tampoco era la causa — la mudanza vino con una reescritura.

El patrón: cada arreglo correcto destapaba el siguiente y el síntoma seguía igual. La
señal que había que leer antes es que **el síntoma no se movía**. Cuando un arreglo
correcto no cambia lo que la persona ve, la hipótesis por defecto no es «falta
desplegar» ni «falta otro detalle del mismo tipo»: es que **el modelo del problema es
de la generación anterior del sistema que estamos mirando**.

Lo que lo habría cortado el primer día es la pregunta que finalmente lo resolvió:
**qué llama la página, leído del tráfico real**. No estaba disponible antes por falta
de acceso al navegador de un cliente; en cuanto lo hubo, tardó cuatro llamadas.

### Lo que se pudo arreglar hoy: que el producto deje de mentir

Nada de esto arregla la generación. Arregla que la persona sepa qué pasa:

- El popup decía **«Inicia sesión en Google Flow»** a alguien logueada, dentro de su
  proyecto, con su avatar y su plan a la vista. Ahora dice que Google cambió Flow, que
  no es nada de su cuenta, y **no ofrece botón de reintentar**: un botón ahí manda a
  repetir algo que no puede salir bien, y eso es lo que hace que la próxima vez nadie
  lea el cartel.
- La pantalla de MaKo decía **«Falta abrir Google Flow»** — la misma mentira en la
  otra superficie. `estadoDelPuente` tiraba el `detalle` que el navegador manda en
  cada latido y ponía su frase fija. Ahora el detalle gana.

### El mapa del protocolo nuevo, medido generando de verdad

*04/09/2026 · se generó un clip real (`x1`, 720p, 8 s) en una cuenta con plan PRO y
se leyó el tráfico completo del ciclo.*

⚠️ **Por qué hizo falta repetir la medición.** La del día anterior fue navegando: abrir
la portada y entrar a un proyecto. De ahí se concluyó que el protocolo estaba muerto —
y la conclusión resultó correcta, pero **la evidencia no la sostenía**: «no hay bearer
mientras navego» no dice nada sobre lo que pasa al GENERAR, que es justo lo único que
importaba. El tutorial viejo, de hecho, pedía «generá uno a mano» precisamente porque
ahí aparecía el bearer.

Conclusión buena sobre evidencia insuficiente es una forma de tener razón que no sirve:
la próxima vez que el dato contradiga la corazonada, no hay con qué defenderla.

**Lo medido ahora, con la generación de por medio:**

| rpcid | Qué hace |
|---|---|
| `YhhmEf` | **dispara la generación** (una sola vez, al apretar) |
| `jwpduf` + `ngNC2` | el **sondeo**, alternados, cada ~2 s hasta que termina |
| `WuwhI` | una vez a mitad del ciclo |
| `as29s` | al final, cuando el medio ya está |
| `DTaVef`, `NfrxTb`, `ve2Lsc` | carga del proyecto |
| `xI9TVb`, `UpteDb` | portada / lista de proyectos |

```
POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute
     ?rpcids=<id>&source-path=/project/<uuid>
     &bl=boq_labs-ai-sandbox-frontend_20260903.13_p1
     &f.sid=<sesión>&hl=<idioma>&_reqid=<n>&rt=c
```

Y en el momento de generar, además:

```
POST https://www.google.com/recaptcha/enterprise/clr
     ?k=6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV
```

**Cero llamadas a `aisandbox-pa.googleapis.com` en todo el ciclo**, incluida la
generación. El analytics lo confirma desde el otro lado (`en=media_generation`,
`ep.media_generation_type=video`). Queda cerrado: el bearer no aparece nunca.

### La única buena noticia, y no es menor

⚠️ **El site key de reCAPTCHA es EL MISMO que ya tiene la extensión**
(`6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV`, verificado contra `background.js:25`).

Toda la maquinaria del captcha —acuñar el token desde la PÁGINA con
`grecaptcha.enterprise.execute`, que es la parte que más costó y la que no se puede
comprar— **sigue sirviendo tal cual**. Lo que hay que rehacer es el transporte, no la
autenticación.

Y el `rpcid` de generar es el dato más caro de encontrar de una reescritura contra BOQ.
Ya está.

### Lo que falta medir para poder reescribir

- **La forma del `f.req`** de `YhhmEf` (el cuerpo que lleva el prompt, la duración, la
  resolución y el `x1`). Se lee clonando el `Request` en el espejo de `injected.js`,
  que ya sabe hacerlo.
- **El token `at`** que BOQ manda en el cuerpo, y de dónde lo saca la página.
- **Cómo vuelve la URL del medio** en `as29s`.

Las tres salen de una sola generación más con el espejo puesto — no hace falta adivinar
ninguna.

⚠️ Y el riesgo que hay que declarar antes de empezar: **`rpcids` y `bl` rotan con cada
bundle de Google.** El `bl` medido cambió de `_p0` a `_p1` entre dos lecturas del mismo
día. Reescribir contra esto convierte «se rompió una vez» en mantenimiento continuo, y
eso es una decisión de producto, no técnica.

### Los caminos, con lo que cuesta cada uno

1. **Reimplementar contra `batchexecute`.** Hay que revertir los `rpcids`, la forma
   del `f.req` y el token `at`. Es el camino que conserva el modelo actual (el
   navegador del cliente genera con su cuenta). ⚠️ Frágil de una forma nueva: los
   `rpcids` y el `bl` rotan con cada bundle de Google —el medido es del 03/09—, así
   que lo que hoy es «se rompió una vez» pasaría a ser mantenimiento continuo.
2. **Manejar la UI de la página** en vez de la API: escribir el prompt, apretar
   generar, leer el resultado. Inmune a los cambios de protocolo, frágil a los de
   layout. Es lo que sobrevive a la próxima reescritura.
3. **Una API paga.** Ya está evaluado en este documento, con sus precios y sus
   términos de reventa.

*Medido el 04/09/2026 con acceso al navegador de la clienta · sin corrida de agentes:
cuatro llamadas al tráfico contestaron lo que dos días de lectura de código no
podían.*

## Un síntoma, CINCO causas: por qué el puente no aprendía a generar en el Flow nuevo

**Vive en:** `extension/injected.js` · `extension/background.js` · `lib/flow-plantillas.ts`

El 05/09/2026 el dueño reportó tres veces seguidas lo mismo: Flow abierto adentro del
proyecto, el clip de prueba generado —el cubo violeta a la vista en la grilla, dos
veces— y el popup diciendo **«Ayúdame a aprender»**. Se arregló dos veces, se
desplegó dos veces, y el síntoma no se movió ni un milímetro.

No era un bug con dos intentos fallidos. Eran **cinco causas independientes en la
misma cadena**, cada una suficiente por sí sola, y cada arreglo destrabó un eslabón
para que el siguiente lo volviera a trabar. Las encontró una auditoría de 191 agentes
que propuso 61 causas; 46 sobrevivieron a la refutación y 11 explicaban el síntoma
(cinco distintas, el resto solapadas).

**La lección de arriba de todo: cuando un arreglo correcto no mueve el síntoma, la
hipótesis por defecto no es que el arreglo esté mal — es que hay otro eslabón.** Se
perdieron dos rondas con el dueño mirando por contar UNA causa donde había cinco.

### ① El espejo del mundo MAIN sobrevive a que la extensión se actualice

`injected.js` corre en el mundo de la PÁGINA y se marca con `window.__makoEspejo`
para no envolver `fetch` dos veces. Esa marca **vive en la página**: sobrevive a que
la extensión se recargue o se actualice, y sólo muere con un **F5**.

O sea que en una pestaña de Flow que ya estaba abierta, **el `injected.js` nuevo entra
y se va en la línea 39**: sigue corriendo el viejo. El content script aislado sí queda
huérfano y se reinyecta, así que queda un `content.js` NUEVO hablando con los listeners
del `injected.js` VIEJO — y todo campo nuevo que el espejo aprenda a mandar
simplemente no llega.

Eso es exactamente por qué el arreglo del campo `sentinela` (v0.49.0) no cambió nada:
el código estaba bien y no se estaba ejecutando.

> **La regla: un archivo del mundo MAIN no se actualiza con la extensión.** Todo lo
> que dependa de una versión nueva de ese archivo hay que darlo por ausente. Si el
> dato se puede **derivar** en el service worker —que sí se actualiza—, se deriva ahí
> y se deja de depender de que un campo cruce una frontera de versiones.

Es lo que se hizo: `codificacionSentinela()` vive ahora en `background.js` y lee el
`cuerpo` que el espejo ya mandaba desde la v0.45. Anda con el espejo viejo, es
retroactivo sobre lo guardado, y no cuesta un crédito.

### ② Aprender estaba gateado detrás de PODER TRABAJAR (dos gates, no uno)

`guardarPlantillas` es la única línea que mueve lo capturado desde la memoria de la
pestaña —que se vacía con cada F5— hasta el storage. Vivía adentro de
`if (estado === 'listo')`. Y en `flow.google.com` **`estado` no es `listo` nunca**: no
hay bearer que capturar, así que la rama `if (!bearer)` escribe `sin_sesion` siempre.

El guardado era **estructuralmente inalcanzable justo en el único caso en que había
algo nuevo que aprender**. Y un gate más arriba, `if (!token) return` hace lo mismo
para cualquier extensión sin emparejar.

> **La regla, que este repo ya tenía escrita y volvió a pagar: ¿la condición que
> activa a mi arreglo puede ser falsa POR CULPA de lo que el arreglo viene a
> arreglar?** Acá la respuesta era sí y en el peor sentido, porque el aprendizaje
> existe *para* salir del estado que lo estaba bloqueando.

⚠️ **Y el comentario de ese mismo bloque ya decía la regla correcta** —«no poder MIRAR
no es no poder trabajar»— mientras el código hacía lo contrario, tres líneas más
abajo. Un comentario no es un control.

### ③ La sentinela no sobrevivía a cómo VIAJA el cuerpo

Se buscaba la frase entera —`un cubo violeta girando sobre arena mako7f3a9c`—
probando seis codificaciones. **Ninguna cubre un cuerpo `form-urlencoded`, que es
justo como BOQ manda `f.req`**: ahí el espacio se escribe `+`, no `%20`, y la frase
tiene seis espacios. Medido construyendo el cuerpo real: **cero de seis**.

```
...%5C%22un+cubo+violeta+girando+sobre+arena+mako7f3a9c%5...
```

> **La regla: no cuelgues una decisión de un carácter que cada capa escribe
> distinto.** La cura no es una séptima codificación —la próxima capa inventará una
> octava— sino elegir un ancla que ninguna pueda tocar. `mako7f3a9c` son diez
> alfanuméricos: sobreviven a url-encoding, form-encoding, el escapado de JSON y los
> tres anidados.

Misma familia que el `\s` del snippet del Pixel: el fuente y lo que viaja por el cable
no son el mismo texto.

### ④ Lo aprendido se DES-aprendía solo

El espejo reescribe la entrada de una clase en **cada** pedido, y `guardarPlantillas`
hacía `mapa[p.clase] = { ...p }` — reemplazo del objeto entero. La siguiente generación
no lleva la frase, así que trae `sentinela: null`, **y ese null pisaba el valor que
había costado un clip pagado.**

El comentario de arriba prometía justo lo contrario («una plantilla vieja NO se borra
porque hoy no se haya visto»), y era cierto — pero **a nivel de CLASE, no de campo**.

> **La regla: un dato que se descubre UNA vez y no cambia se funde, no se pisa.** Si
> un objeto se reemplaza entero en cada actualización, todo campo que se descubrió
> antes muere con el próximo evento.

### ⑤ Se preguntaba por un rpcid ADIVINADO

`aprendioGenerar` hacía `guardadas['boq:YhhmEf']`, con un rpcid medido contra el bundle
de Google de un día concreto. Dos formas de fallar con la captura perfecta al lado:
Google despliega un bundle nuevo y el id rota, o BOQ batchea (`rpcids=YhhmEf,ngNC2`) y
la clase pasa a ser otra. En los dos casos el lookup exacto contesta `undefined` — que
no se queja y **se lee igual que «no aprendió»**.

> **La regla: preguntá por la PROPIEDAD, no por la clave.** La sentinela sólo la puede
> tener el pedido que llevaba la frase; no hace falta saber su rpcid para reconocerlo.
> Es «un cruce que no encuentra nada no está diciendo que no esté», aplicado a un
> `Map`.

### Lo que quedó SIN hacer

**El respaldo al servidor sigue muerto para el Flow nuevo.** `sanearPlantillas()` de
`lib/flow-plantillas.ts` descarta toda plantilla del Flow nuevo por **dos** condiciones
independientes: exige `url.startsWith('https://aisandbox-pa.googleapis.com/')` —el
dominio VIEJO— y filtra por `CLASES_UTILES`, que se deriva de los endpoints viejos vía
`claseDePath`. Ninguna plantilla BOQ pasa.

No afecta a `aprendioGenerar` (que lee `chrome.storage.local`), pero sí a que lo
aprendido sobreviva al perfil del navegador y a que `sembrarPlantillas` pueda rellenar
huecos. **Vive en:** `lib/flow-plantillas.ts:182` y `:186`.

**Y no hay forma de medir el estado real del puente sin pedir una captura de
pantalla.** Todo lo que sube al servidor —el `detalle` con lo que el espía vio, las
plantillas— viaja adentro del mismo `if (estado === 'listo')` de la causa ②, así que en
el Flow nuevo el servidor no recibe **nada** con lo que diagnosticar. Se razonó a
ciegas durante tres rondas por eso. **Vive en:** `extension/background.js`, el bloque
del ciclo.

### Los guards que quedaron

Cuatro, y cada uno se verificó **rompiéndolo a propósito** antes de darlo por bueno:

| Test | Qué fija |
|---|---|
| `extension-plantilla-campos.test.ts` | todo campo que el espejo captura llega al storage, o está declarado descartado |
| `extension-aprender-sin-gate.test.ts` | `guardarPlantillas` no vuelve adentro de ningún gate de estado |
| `extension-sentinela-encoding.test.ts` | el ancla es alfanumérica y sobrevive a form-urlencoded |
| `extension-sentinela-persiste.test.ts` | la sentinela se funde y no se pisa; nadie vuelve a hardcodear un rpcid |

*Auditoría del 05/09/2026: 191 agentes, 61 causas propuestas, 46 confirmadas, 5 raíces
distintas.*

## El puente a BOQ: seis operaciones, y las trampas de reconstruirlo

**Vive en:** `lib/flow-operaciones.ts` · `lib/flow-plantillas.ts` · `lib/flow-boq-patch.ts`
· `lib/flow-diagnostico.ts` · `extension/background.js` · `extension/injected.js`
· `scripts/sync-operaciones.mjs` · `scripts/flow-diagnostico.ts` · `scripts/flow-viabilidad-replay.ts`

Sesión del 05/09/2026, después de las cinco causas del aprendizaje (entrada
anterior). Lo que sigue son las trampas de RECONSTRUIR el puente contra el
protocolo nuevo, no las de arreglarlo.

### El producto usa SEIS operaciones, y sólo DOS cuestan créditos

El dueño preguntó si había que enseñarle también la generación de imagen, subir
una foto y descargar. La respuesta no era una:

| | Operaciones | Cómo se aprende |
|---|---|---|
| **Gratis** | `creditos` · `estado_clips` · `subir_imagen` | espiando lo que Flow hace igual |
| **Pagas** | `generar_clip` · `generar_imagen` | una generación cada una |
| **No se enseña** | `enlace_clip` | no pasa por el espejo |

**La bajada no se enseña y no es una omisión.** El enlace firmado no vive en
ninguna respuesta: `getMediaUrlRedirect` REDIRIGE al archivo, y ese redirect no se
puede leer con `fetch` ni desde la página ni desde el service worker —CORS lo corta
en las dos—. Lo resuelve `webRequest`, que mira el tráfico desde afuera del modelo
de CORS. **Por eso sobrevivió a que Google reescribiera el protocolo: no depende de
él.** Cualquier pieza futura que se pueda resolver así hereda esa propiedad.

**Subir una foto es gratis** (está en `SIN_CAPTCHA`), así que se aprende la primera
vez que la persona sube una, sin pedirle nada extra.

### Un booleano no puede describir N operaciones

`aprendioGenerar` era true/false. Con cinco operaciones que enseñar eso no es una
simplificación: es una **afirmación falsa** que se descubre cuando el pedido sale y
Google contesta 400, con el trabajo ya encolado.

> **La regla: un estado que resume N cosas necesita decir CUÁLES.** Y el reemplazo
> no es una lista: es `siguiente` —la primera que falta, en el orden del catálogo—
> más el conteo. Un paso por pantalla.

Y el costo se dice ANTES de apretar. Las tres gratis también lo dicen: **saber que
algo NO cuesta es la mitad de la decisión.**

### Un ancla se elige por lo que ninguna capa puede cambiarle

La frase de aprendizaje tiene seis espacios, y el espacio es justo el carácter que
cada capa escribe distinto: `encodeURIComponent` lo manda `%20`, un cuerpo
`form-urlencoded` —como manda BOQ su `f.req`— lo manda `+`. Medido: **cero de seis
codificaciones** encontraban la frase en un cuerpo real.

`mako7f3a9c` son diez alfanuméricos y sobreviven a todas.

⚠️ **Y el corolario que apareció después, que es el que cuesta ver: esa misma
propiedad lo vuelve INÚTIL como etiqueta.** Al ser idéntico bajo todas las
codificaciones, «con qué codificación apareció el token» contesta siempre `crudo`
— cierto, y no dice nada. Para REPETIR el pedido hace falta saber cómo viajó la
**frase**, que sí cambia (`form`).

> **La regla: se DETECTA con lo que no cambia y se ETIQUETA con lo que sí.** Son dos
> preguntas y usar una sola respuesta para las dos deja la mitad muda.

### Cuando todos los pedidos comparten path, el allowlist se hace por ROL

En el protocolo viejo cada operación tenía su path y enumerarlos alcanzaba. En BOQ
**todos** van a `/data/batchexecute` y lo único que los distingue es un `rpcids`
que rota con cada bundle de Google.

«Todo lo que empiece con `boq:`» sería un allowlist por descarte —prohibido acá— y
además guardaría la telemetría de Google en nuestra base.

> **El criterio positivo que no envejece es el ROL:** útil es lo que el navegador
> pudo ATAR a una operación del catálogo. La telemetría no queda afuera por estar
> nombrada —imposible, comparte path— sino porque **nunca gana un rol**.

**Y ese rol es también la LLAVE.** Con la clase como llave, un respaldo guardado hoy
re-siembra mañana un rpcid MUERTO: el pedido sale, Google contesta 400, y el puente
parece roto cuando lo viejo es la copia. **Un respaldo que devuelve basura es peor
que no tenerlo, porque nadie sospecha de él.**

### Abrir un allowlist despierta guardas que estaban muertas

Dos aparecieron el mismo día, y las dos sólo importaban una vez abierto:

1. **La redacción del `at` era JSON-only.** Hacía `JSON.parse(cuerpo)` y el `catch`
   dejaba el cuerpo «como vino» — razonable cuando todo era JSON. El cuerpo de BOQ
   es `f.req=...&at=...`: caía en el catch y el token anti-CSRF de la sesión de
   Google del cliente pasaba intacto. **El camino de ERROR de una capa se volvió el
   camino NORMAL de la siguiente.**
2. **`proyectoDePlantilla` no leía el projectId de BOQ.** Buscaba `/projects/`
   (plural) en el path o un cuerpo JSON; en BOQ viaja en el query como
   `source-path=/project/<uuid>`, en singular. Devolvía `''` siempre, así que
   `soloDelProyecto` dejaba pasar por abstención — y el respaldo del navegador es
   UNA clave global: un navegador emparejado antes con otro cliente manda plantillas
   con el projectId de aquél.

> **La regla: antes de ampliar un allowlist, enumerá qué guardas colgaban de la
> condición vieja.** Una guarda que nunca disparaba porque su entrada no llegaba se
> ve idéntica a una que funciona.

### Un `startsWith` de origen no es un guard de origen

Medido con node, con el prefijo `https://flow.google.com`:

| url | `startsWith` | `origin` real |
|---|---|---|
| `https://flow.google.com.evil.tld/x` | true | `https://flow.google.com.evil.tld` |
| `https://flow.google.com@evil.tld/x` | true | **`https://evil.tld`** |
| `https://flow.google.comevil.tld/` | true | `https://flow.google.comevil.tld` |
| `https://flow.google.com:8443/x` | true | `https://flow.google.com:8443` |

El segundo es un pedido NUESTRO a un tercero con las credenciales del cliente, y la
url se lee bien en cualquier listado. **La línea que había (`aisandbox-pa…/`) no era
explotable de milagro: la salva la barra final** — suerte del formato, no del
método, y no sobrevive al día que alguien escriba la de al lado sin la barra.

> Se compara `new URL(u).origin` contra un `Set` congelado, y se exige `https:`.

### El mundo MAIN no se actualiza con la extensión

`injected.js` corre en el mundo de la PÁGINA y se marca con `window.__makoEspejo`.
Esa marca **sobrevive a que la extensión se actualice y sólo muere con un F5**. Una
pestaña abierta desde ayer sigue corriendo el espejo de ayer, con la extensión al
día y el código correcto.

Costó un día entero: un arreglo bueno, desplegado, que no se ejecutaba.

> **La regla: todo lo que se pueda DERIVAR en el service worker se deriva ahí.** Un
> dato que se puede leer del cuerpo no se le pide prestado a otra versión. Eso hizo
> que la sentinela funcionara con espejos viejos, sin recargar nada y sin gastar un
> crédito.

**Y NO se recarga la pestaña automáticamente al detectar el desfase:** un reload mata
generaciones en vuelo y tira el `at` vivo. Se reporta (`diagnostico.espejo`) y la
persona decide. Un espejo anterior al versionado **no contesta**, y esa ausencia es
también la respuesta.

### Un chequeo de sincronía que compara dos copias no ve que las dos se movieron

`scripts/sync-operaciones.mjs` genera `extension/operaciones.js` desde
`lib/flow-operaciones.ts` y el pre-push corre su `--check`. Los DATOS se derivan; las
FUNCIONES estaban escritas a mano en la plantilla del generador.

**Se desincronizó el mismo día en que se escribió**: se arregló `operacionDelCuerpo`
en el TS, el JS siguió viejo, y el `--check` decía «al día» — comparaba el archivo
contra una plantilla que también estaba vieja.

> **La regla: un guard textual y uno DIFERENCIAL cubren cosas distintas.** El textual
> caza «alguien editó el generado»; el diferencial —preguntarle lo mismo a las dos
> implementaciones— caza «la plantilla y la fuente se movieron juntas». Los dos, o el
> segundo agujero queda abierto. `tests/flow-operaciones-paridad.test.ts`.

### Antes de escribir un transporte, medí si se puede escribir

El replay contra BOQ depende de UNA condición: que el espejo vea a Google acuñar el
token de reCAPTCHA, porque reCAPTCHA Enterprise **ata el token a la acción** y con
una equivocada contesta 403 «reCAPTCHA evaluation failed» — el mismo cuerpo que
devuelve un token robado.

Se contesta gratis con datos que ya están en producción
(`flow_puentes.acciones_captcha`). Corrido: 5 puentes, 1 con acciones vistas.

⚠️ **Y el veredicto obvio era el equivocado.** Esa fila es de la extensión **v0.41.0**,
o sea del Flow VIEJO, donde acuñar el captcha estaba medido hace meses. El único
puente de la era BOQ no vio ninguna. Contarla daba **VIABLE** sobre una pregunta que
nadie contestó.

> Es «una observación verdadera que también vale para los casos buenos no explica
> nada», aplicada a una decisión de arquitectura. **El discriminador tiene que estar
> en el script**, o el próximo lo lee y arranca a construir.

`scripts/flow-viabilidad-replay.ts` discrimina por versión (≥ 0.45.0 = era BOQ).

### El patcher no parsea el árbol, y eso es la decisión

El cuerpo de BOQ es un array JSON **anidado y posicional**, sin nombres de campo.
Caminarlo para encontrar el prompt es adivinar su posición.

Lo que NO es adivinanza: **la frase de aprendizaje la escribió la persona, exacta.**
Se busca ese string con la codificación con la que viajó, y se reemplaza. No hace
falta saber en qué posición vive ni cómo se llama.

Dos fallas caras que el test cubre, y ninguna da un error que apunte al patcher:

- una comilla doble sin escapar cierra el string JSON un nivel antes → Google
  contesta **400** y el error apunta a nuestro cuerpo, no al carácter;
- el prompt viejo sin reemplazar → el pedido **funciona**, cuesta un crédito, y
  devuelve un cubo violeta girando sobre arena en vez del anuncio del cliente.

> **La prueba de fondo no es «reemplazó el texto» sino que el cuerpo resultante SIGA
> PARSEANDO** — se decodifica de vuelta hasta el prompt, que es lo que hace Google
> del otro lado.

Y el saneo **saca** las comillas en vez de escaparlas: escaparlas bien exige saber
cuántos niveles de anidado hay, que es justo lo que este módulo evita averiguar. Un
prompt sin comillas dice lo mismo; uno mal escapado no dice nada.

### Lo que quedó SIN hacer

1. **El transporte del replay.** Bloqueado por la medición de arriba: hace falta UNA
   generación en `flow.google.com` con la extensión ≥ 0.53.0 y volver a correr
   `scripts/flow-viabilidad-replay.ts`. **Vive en:** `extension/background.js`
   (la rama BOQ de `ejecutar`) y `extension/injected.js` (`MAKO_FETCH_PIDO`).
2. **De dónde sale el `at` fresco.** No medido. El diseño lo saca del tráfico vivo
   (el último `at=` que el espejo vio pasar), que es defendible porque es el que la
   app acaba de usar; la fuente canónica de una app BOQ suele ser
   `window.WIZ_global_data['SNlM0e']`, pero **eso no está medido acá y no se escribe
   como hecho**. **Vive en:** `lib/flow-boq-patch.ts` → `reponerAt`.
3. **Si una plantilla de BOQ sobrevive a la rotación del `bl`.** La url congela
   `bl=boq_labs-ai-sandbox-frontend_<fecha>`; no se sabe si repetir un pedido con un
   `bl` de hace una semana funciona, da 400, o marca la sesión. Si no sobrevive, el
   respaldo sirve para el mismo día y no para «entrar desde otra máquina».
4. **El tamaño real de un `f.req`.** No se sabe si pasa `TOPE_CUERPO` (20.000) ni si
   varios pasan `TOPE_TOTAL` (150.000). **Vive en:** `lib/flow-plantillas.ts`.
5. **La UI del diagnóstico.** El dato existe y es consultable con
   `scripts/flow-diagnostico.ts`, pero no lo pinta ninguna pantalla.

*Sesión del 05/09/2026. Dos corridas de agentes: 191 (las cinco causas) y 16 (el
diseño de los cuatro frentes).*

### Addenda del mismo dia: dos verdes que mentian

**Vive en:** `lib/flow-operaciones.ts` · `extension/popup.js` ·
`tests/extension-worker-carga.test.ts`

Los dos aparecieron al cablear el wizard, y los dos son de la familia «el sistema
contesta algo coherente sobre una pregunta que nadie hizo bien».

**① El wizard pedia algo imposible.** Ofrecia la lectura de creditos como paso
siguiente — se aprende sola, no hay accion que tomar — con un boton que solo cerraba.
Reportado textual: «le doy a Entendido y no hace nada». La regla completa quedo en
AGENTS.md; lo especifico de aca es que el catalogo ahora separa **`pide`** de
**`cuesta`**, porque `subir_imagen` es gratis y aun asi pide algo.

**② El test de «el worker carga» daba verde sobre un worker que no cargaba.** `tsx`
transpila a CJS y ahi el `import()` dinamico no exige exports nombrados. La regla
tambien quedo en AGENTS.md. Lo que conviene recordar de este caso concreto: el bug lo
introdujo el mismo commit que agrego `A_PEDIR`, o sea que **el intervalo entre
escribir un import y romper el worker es de segundos** — y nada lo dice hasta que
alguien instala la extension.

⚠️ **Y una consecuencia operativa del versionado del espejo:** `VERSION_ESPEJO` en
`injected.js` tiene que igualar la version del manifest, con test. O sea que **cada
release de la extension toca dos archivos**. Es a proposito: si se separan, el
diagnostico reporta «hace falta F5» sobre pestanas al dia, en todos los clientes a la
vez, y un aviso que sale siempre ensena a ignorar todos los demas.

## Le dije que había creado un video en Flow cuando no lo creó (06/09/2026)

**Vive en:** `lib/flow-boq-respuesta.ts` · `extension/boq-respuesta.js` ·
`extension/background.js` (`repetirEnBoq`, `ejecutar`) · `extension/popup.js` ·
`app/video-generator/puente-avisos.tsx` · `scripts/sync-boq-respuesta.mjs`

Reporte textual del dueño, tres cosas en un mensaje:

> «¿Qué es eso de pedir un video de prueba? … En el medio lo apreté una vez anterior
> y dijo "Listo, lo verás en tu Flow", ¿qué es eso de sacarlo de MaKo para
> redireccionarlos a Flow, si JUSTAMENTE estamos creando una herramienta para que no
> tengan que utilizar Flow a mano? Lo peor es que me dijo que ya creó algo en Flow
> cuando no lo creó.»

Las tres son verdad y **ninguna se veía leyendo el código**: el botón hacía lo que
decía, el pedido salía, y Google contestaba 200.

### ① El éxito falso: `res.ok` sobre BOQ (y era una regla YA escrita)

`repetirEnBoq` decidía con `res.ok`, que es HTTP 200. BOQ manda el fallo **adentro**
del cuerpo, en un frame `"er"`. La regla estaba en AGENTS.md desde que mordió con
Meta y con Evolution; éste es el **tercer proveedor**.

Y BOQ trajo dos variantes que las otras dos no tenían:

- **El error y el frame bueno pueden venir en la misma respuesta.** Buscar el primer
  `wrb.fr` que matchea es literalmente cómo se afirma un éxito que no pasó. El frame
  de error se busca **antes**.
- **Un `wrb.fr` con payload vacío (`''` / `null` / `[]`) no es un éxito**: es «te
  escuché y no hice nada», y se lee igual que un ok si sólo se mira que el frame
  exista.
- Se agregó una tercera: **un frame de OTRO `rpcid` tampoco es un éxito.** Significa
  que se repitió el pedido equivocado — y eso ya gastó un crédito.

⚠️ Y acá el éxito falso es peor que en los otros dos casos, porque **el crédito puede
haberse gastado igual**: no sólo miente, además tapa la única pregunta accionable
(«¿me cobraron?»). Por eso `salio` —que se pone JUSTO antes del `await` en el
espejo— es lo que decide si se reintenta: si el pedido llegó a salir, reintentar es
cobrarle dos veces el mismo video.

### ② El diagnóstico obvio era el equivocado: no faltaba «probar», sobraba el botón

Todo el diseño anterior era un **botón de probar** que pedía un video de prueba con
un crédito del cliente. Parecía prudencia y era el error: gastaba plata ajena para
producir algo que no le sirve a nadie, y encima —en un producto que existe para que
el cliente NO tenga que usar Flow a mano— lo sacaba de MaKo y lo mandaba a Flow.

El replay tenía que entrar por **la cola real de trabajos** (`ejecutar()`), que ya
existía y ya estaba conectada a la pantalla donde la persona espera su anuncio. El
primer anuncio de verdad ES la prueba. El botón, además, duplicaba el camino: el que
se probaba no era el que corre.

### ③ `datos` no es `data`: el éxito vacío, una capa más abajo

Al cablear el replay en la cola, el resultado se devolvió como `datos: r.payload`. El
route lee `r.data ?? null`. Con cualquier otro nombre el trabajo se marca **`listo`
con el resultado en NULL**: la misma familia de mentira que se acababa de sacar del
popup, sin nadie mirando y sin error en ningún lado.

Lo fija `tests/extension-cola-clave-data.test.ts`, que además lee la clave **del
consumidor** (`app/api/flow/puente/route.ts`) y no de una constante nuestra: el
contrato lo fija quien recibe.

### ④ El test que se mintió a sí mismo

Ese mismo test, en su primera versión, extraía las claves con `/^\s*(\w+):/gm` —ancla
de principio de línea— y el `return` que había que cazar estaba en UNA sola línea.
Cero claves, cero fallos, **verde sobre el bug que existía para cazar**. Lo delató
romperlo a propósito: con `datos:` seguía dando 2 de 2.

Es el segundo falso verde de esta misma corrida (el otro fue el de la carga del
worker, que pasaba porque `tsx` transpila a CJS). La regla quedó en AGENTS.md, y lo
concreto de acá: **en el comentario del test va el resultado de la rotura, con
números.**

### ⑤ El aviso de MaKo contaba NUESTRO problema

> «El aviso con la flecha dentro de MaKo, no entiendo por qué aparece… confunde
> enormemente a un nuevo usuario que NO sabe lo que nosotros estuvimos haciendo aquí.»

La causa no era la flecha: era que `estadoDelPuente` **relevaba `detalle`**, un campo
libre que escribe la extensión en cada latido. Pintarlo convierte en copy de producto
cualquier cosa que se escriba adentro. Salió dos veces a la pantalla del dueño —un
volcado de JSON del espía, y un párrafo nuestro sobre lo que Google nos rompió—.

Lo que quedó:

- La web deriva su rótulo de un **estado cerrado**. Los tres estados que no son
  «listo» colapsan en la misma frase a propósito: para la persona son el mismo hecho
  y tienen la misma salida.
- `detalle` sigue viajando y guardándose: es **diagnóstico**, y ahora se escribe
  como tal (`FLOW_NUEVO: sin bearer…`), para quien lea la base buscando por qué algo
  no filma.
- `AvisoPuente` devuelve `null` si el puente anda. Los tres call-sites lo gateaban
  por afuera y alcanzaba… hasta el cuarto. **Una flecha que señala un problema
  inexistente es lo que hace que se ignore la próxima.**
- Lo fija `tests/extension-copy-cliente.test.ts`: el aviso no puede volver a
  mencionar `detalle`, y ninguna pantalla de cliente puede traer jerga nuestra.
  ⚠️ Los **dominios no están en la lista de jerga**, a propósito: «borra las cookies
  de google.com, labs.google y flow.google.com» es jerga que la persona SÍ necesita,
  porque sin el nombre exacto no puede hacer lo que se le pide.

### ⑥ Reescribir el copy volvió a romper la condición que costó tres reportes

Al cambiar los textos del popup, el rótulo del botón volvió a depender de «¿hay
frase?» en vez de «¿dónde está la persona?». Es **exactamente** la condición del bug
reportado tres veces: `subir_imagen` no tiene frase, cae por el `else`, y le dice «Ir
a Google Flow» a alguien parado en Google Flow.

Lo cazó `tests/extension-boton-donde-estas.test.ts` en la misma corrida. La lección
no es «tené cuidado»: es que **el test que fija la condición es el permiso para tocar
el copy**. Con él, se reescribe todo el texto sin miedo.

### Lo que queda SIN medir (y qué lo destraba)

**La FORMA del payload de generación de BOQ.** Es un array posicional; `mediaDeFlow`
(`lib/flow-media.ts`) recorre el árbol buscando un nodo con `name` igual al id de la
operación y campos como `mediaGenerationStatus`. Sobre un array posicional eso
devuelve `null`. O sea: **el replay puede generar y aun así el trabajo no rendir un
video**, hasta que se escriba el mapeo.

No se escribió porque nadie vio todavía una respuesta real de generación, y escribir
el mapeo sin verla es adivinar. **Lo destraba solo:** el espejo ya cachea las
respuestas por clase (`respuestas` en `injected.js`) y el diagnóstico las trae, así
que la primera generación de aprendizaje —la que el cliente hace una vez y ya cuesta
su crédito— deja la forma medida sin gastar uno extra.

Sigue abierto de antes: el `rpcid` de `subir_imagen` no está medido (la operación es
estructuralmente no detectable, por eso el catálogo tiene `detectable`), y no se sabe
si el cuerpo de generación de BOQ lleva un token de reCAPTCHA — aparece en la primera
corrida real.

## Nueve definiciones de «el puente puede filmar», y ninguna alcanzable (06/09/2026)

**Vive en:** `lib/flow-puede-filmar.ts` · `extension/puede-filmar.js` ·
`extension/background.js` (el latido, el handler ESTADO, `repetirEnBoq`,
`pestanaDeFlow`) · `extension/injected.js` · `extension/content.js` ·
`app/api/flow/puente/route.ts` · `app/video-generator/video-action.ts` ·
`scripts/sync-puede-filmar.mjs`

El dueño mandó dos capturas del **mismo segundo**: el popup de la extensión decía
«MaKo ya puede hacer tus anuncios / Todo listo» y el aviso de al lado, dentro de
MaKo, decía «MaKo todavía no puede filmar tus anuncios».

### El diagnóstico obvio era el equivocado: no era un cartel, era el producto cerrado

La lectura fácil es «hay un texto desalineado». Lo que había abajo:

`estado === 'listo'` significaba **«hay un bearer guardado»**. En flow.google.com
Google no emite ninguno —la app habla sólo por BOQ, con cookies— y el propio latido
lo **borra a propósito** al ver el dominio nuevo, dos líneas antes de preguntar por
él. La condición se negaba a sí misma: `listo` era inalcanzable **por construcción**,
para siempre, para todos.

Y de ese booleano cuelgan **cuatro compuertas duras**, las cuatro verificadas
abriendo el archivo:

| dónde | qué corta |
|---|---|
| `app/video-generator/VideoGeneratorApp.tsx:1565` | `disabled={!puedeCrear \|\| !puenteAnda}` |
| `extension/background.js` (la cola) | `if (out.pausado \|\| estado !== 'listo') return;` |
| `app/api/flow/puente/route.ts` (el reparto) | `estado === 'sin_sesion' ? [] : tomarTrabajos()` |
| `app/video-generator/video-action.ts` | el guard server-side de filmar |

O sea: **nadie podía hacer un video, por cuatro caminos independientes**, y el
síntoma que se veía era un cartel contradictorio. Un barrido de 33 agentes contó
**nueve** definiciones distintas del mismo juicio, cada una armada con los insumos
que su superficie tenía a mano.

**Regla que queda:** cuando dos pantallas describen el mismo hecho y se contradicen,
el bug no es el texto — es que hay dos definiciones. Contalas antes de tocar el copy.

### La cura no es un campo más

Con nueve definiciones, la décima es el problema. Lo que cambia es **qué significa
`listo`**: de «tengo una credencial del protocolo muerto» a «si me dieran un anuncio
ahora mismo, el pedido saldría», medido con un **ensayo en seco** — el camino de
`repetirEnBoq` recorrido hasta un paso antes de mandar. No toca la red y no gasta un
crédito. Un verde no puede mentir porque es literalmente el mismo predicado que la
ejecución exige.

Eso además arregló las cuatro compuertas de una, sin migración y sin campo nuevo.

⚠️ **Deuda de nombre declarada:** el enum sigue siendo
`['sin_conectar','listo','sin_sesion','marcada']`, así que «no puede filmar todavía»
viaja como `sin_sesion`, que ya no describe nada. Cambiarlo es una migración con
CHECK y un deploy coordinado; se dejó, y se arreglaron los dos mensajes que mentían
por su culpa.

### Los tres modos en que una plantilla guardada MIENTE

El ensayo los cierra, y los tres estaban vivos:

1. **Sin `cuerpo`** — el popup la contaba como aprendida; el replay la rechaza.
2. **Sin `url`** — `repetirEnBoq` la exige y ningún gate la miraba.
3. **Con el cuerpo PISADO** — el guardado conserva el `op` y reemplaza el `cuerpo`.
   Si la persona generó otra cosa después de enseñarnos, la plantilla queda
   registrada, completa, y sin el ancla. Indistinguible de una sana si sólo se mira
   que exista.

### Y el cuarto, que sólo apareció revisando: DOS plantillas para el mismo `op`

Las plantillas se guardan por **clase**, así que un navegador que aprendió en
labs.google y después migró tiene dos entradas para `generar_clip`: la REST vieja y
la de BOQ. El ensayo y la ejecución hacían **cada uno su propio**
`find(p => p.op === op)`, que devuelve la primera por orden de inserción.

La REST tiene `cuerpo`, tiene `url`, y su JSON lleva la frase en texto plano —o sea
que `comoViajo` la encuentra con la codificación `crudo`—: pasaba los tres chequeos.
Lo único que no tiene es **dónde poner el `at`**, que es el último control del
espejo. Verde, cuatro compuertas abiertas, y el pedido muriendo cinco veces con la
plantilla buena a una clave de distancia.

**Regla:** «el mismo predicado que la ejecución» no alcanza si son **dos copias** del
predicado. La elección de la plantilla se mudó a `elegirPlantilla()`, que llaman los
dos — y ahí se le agregó el chequeo del `at`, que faltaba en los dos.

### Y el elector de pestaña no desempataba

`pestanaDeFlow()` consulta con `PATRONES_FLOW`, que cubre **los dos dominios**, y
elegía `find(status === 'complete') || sanas[0]`: sin preferencia de dominio, sin
preferencia por la activa. Con una pestaña de cada uno gana la que quede primera por
orden de ventana — y eso **cambia entre latidos**, porque una pestaña recargando deja
de ser `complete`.

De esa elección colgaba qué protocolo se juzga. Un navegador ya migrado con una
pestaña vieja de labs.google abierta caía al camino REST, **no se le borraba el
bearer fósil**, y reportaba `listo` sin preguntar ni una vez si podía filmar: el
«listo = hay un bearer» de vuelta, por la puerta de atrás. Ahora gana
flow.google.com, que es donde vive Flow.

### LA PLATA: tres caminos que cobraban el mismo video dos veces

El crédito se gasta **cuando el pedido viaja**. Lo que pase después no lo devuelve.
El default era `reintentable: !r.salio` — o sea que un `salio` **ausente** se leía
como «no salió». Y ausente es justo lo que mandaban los dos caminos donde sí había
salido:

- **El timeout de 120 s.** `content.js` contestaba `{ error: 'BOQ_TIMEOUT' }` pelado.
  El fetch ya había viajado.
- **El `catch` de afuera del espejo**, que no veía `salio` **por scope**: estaba
  declarado adentro del `try`. El caso concreto es `await res.text()` fallando con la
  conexión cortada a mitad del cuerpo — Google ya aceptó y ya cobró.

Cinco intentos = **cinco créditos por un video**, y el cliente con cinco clips
iguales en su Flow.

**Regla que queda: en cualquier cosa que gaste plata ajena, el default es NO
reintentar.** Se reintenta sólo con una afirmación explícita de que el pedido nunca
viajó (`salio === false`). Lo peor de este default es que alguien tenga que apretar
de nuevo; lo peor del otro era cobrarle.

⚠️ Y el corolario que costó encontrarlo: **un dato que decide plata no puede depender
del scope de un bloque.** El comentario de `injected.js` decía exactamente lo que
había que hacer —«se pone JUSTO antes del await»— y lo hacía; lo que no se vio es que
el `catch` de afuera no podía nombrarlo.

### La corrida de refutación murió y eso NO es «no hay hallazgos»

La revisión adversaria del cambio corrió con 38 agentes y **36 murieron por límite de
sesión**. Sobrevivieron dos revisores y **cero refutadores**, así que el
`refutantes: 0` de cada hallazgo significaba «nadie lo miró», no «sobrevivió». Los
cuatro se verificaron a mano leyendo el código, y los cuatro eran reales.

**Regla:** en una corrida multi-agente, un contador de refutaciones en cero se lee
igual venga de «lo refutaron y no pudieron» o de «los refutadores no corrieron». Hay
que mirar `agents_error` antes de leer los resultados.

### Once guardas, las once probadas rompiéndolas

Los 11 tests estructurales de este cambio se verificaron inyectando la regresión
concreta, una por vez: base en verde, cada rotura en rojo, restaurado en verde.
**Dos de ellos estaban mal escritos y sólo lo dijo la rotura**:

- el que caza `siguiente = null` en un `catch` usaba `[^}]*`, que se frena en la
  primera llave — la de `ops = {}`, justo antes de lo que buscaba;
- el que exige el ensayo en el latido buscaba `puedeFilmar(` en **todo el archivo**,
  y como el handler ESTADO también lo llama, sacarlo del latido dejaba el test verde.

Es el mismo aprendizaje de la corrida anterior, con dos casos nuevos: sin la rotura,
un test es una afirmación.

## El popup pedía enseñarle DE NUEVO, y el respaldo del server estaba vacío (06/09/2026, noche)

**Vive en:** `extension/injected.js` (los dos `plantillas.set`, `absoluta()`, `ANCLAS`) ·
`extension/background.js` (`guardarPlantillas`, `sembrarPlantillas`) ·
`lib/flow-plantillas.ts` (`tieneAncla`, `fundirPlantillas`, `sanearPlantillas`,
`KEY_PLANTILLAS_DESCARTES`) · `app/api/flow/puente/route.ts`

Con la fuente única desplegada, las dos pantallas por fin decían lo mismo: «todavía
no». Pero el popup pedía «Genera UN video con la frase exacta» a alguien que ya lo
había hecho —y generado decenas después—. Reporte textual: *«antes ya habíamos
generado un montón de videos e imágenes, realmente no entiendo qué haces»*.

### Medido en producción, antes de tocar nada

- `flow_puentes.estado_detalle = "FLOW_NUEVO SIN_ANCLA(generar_clip)"`. El ensayo en
  seco estaba en lo cierto: la plantilla del video **no lleva la frase**.
- El respaldo del server del ws 1 tiene **cinco plantillas, todas del protocolo
  viejo** (`aisandbox-pa`, sin `op`, sin sentinela) y **cero de BOQ** — mientras el
  diagnóstico del navegador lista 20 clases `boq:*` y cuatro operaciones sabidas.

### ① El sentinela sobrevivía; el cuerpo que lo justificaba, no

En las tres capas la regla era «la más nueva gana» **conservando `op` y
`sentinela`** —los campos que dicen que esta clase ALGUNA VEZ llevó la frase— y
**reemplazando el `cuerpo`**, que es el único que la lleva de verdad:

| capa | dónde pisaba |
|---|---|
| espejo (memoria de la pestaña) | `plantillas.set(clase, {…})` en cada pedido, XHR y fetch |
| worker (`chrome.storage.local`) | `guardarPlantillas`: `mapa[p.clase] = { ...p, op, sentinela }` |
| server (`flow.plantillas`) | `fundirPlantillas`: `conservar(n.cuando >= vieja.cuando ? n : vieja)` |

Y `sembrarPlantillas` «nunca pisa una local», así que un respaldo sano tampoco
reparaba una local rota.

El resultado es una plantilla que **declara saber generar y no se puede parchear**:
`reemplazarEnCuerpo` busca la frase para poner el prompt real, y la frase ya no está.
Antes de la fuente única esto se descubría con el botón ya apretado y el trabajo
tomado (`SIN_ANCLA` del replay); con la fuente única se descubre antes — que es lo
que Martín vio como «me pide enseñarle otra vez».

**Regla que queda:** un campo que dice «esto se aprendió» no protege el dato que se
aprendió. Lo caro es el **cuerpo con la frase** —se genera una vez y cuesta un
crédito— y se protege con la misma regla que ya tenía la sentinela: **un cuerpo con
ancla no lo pisa uno sin ancla, por nuevo que sea.** En las tres capas, y la siembra
repara.

⚠️ La entrada con ancla se conserva **entera** (url, headers y cuerpo). Mezclar la url
de hoy con el cuerpo de ayer arma un pedido que ninguna versión de Flow mandó.

### ② El espejo sólo conocía UNA de las dos anclas

`injected.js` tenía `SENTINELA`/`TOKEN_SENTINELA` (el video) y nada del imagen. La
plantilla de imagen **nunca llevaba `sentinela`**, así que ninguna regla de «no pisar»
la podía proteger. El worker sí la reconocía (`operacionDelCuerpo` usa el catálogo),
por eso el ESTADO decía «sabe generar_imagen» — y por eso nadie lo notó. Ahora hay
`ANCLAS = [[frase, token]…]`, las dos pineadas al catálogo por test.

### ③ El respaldo del server descartaba SIN RUIDO — y la hipótesis de por qué

`sanearPlantillas` tiraba por **cuatro motivos** distintos (`continue`) sin registrar
ninguno. `soloDelProyecto` sí registraba sus `ajenas` con un `console.warn`: la regla
estaba escrita al lado y el saneador no la cumplía.

**Hipótesis principal, todavía no confirmada:** BOQ abre sus XHR con la ruta
**relativa** (`/_/AiSandboxAngularFrontend/data/batchexecute?…`); el espejo guardaba
`this.__makoUrl = String(url)` tal cual; y `esOrigenDeFlow` hace `new URL(url)`, que
sobre una relativa **tira** y devuelve `false`. Al navegador le da igual —repite el
pedido contra su propio origen—; al respaldo no le llegó nunca ni una.

La alternativa es `soloDelProyecto`: el `project_id` guardado del ws 1 es el del
protocolo viejo (`9973383e-…`); si el `source-path` de las plantillas de BOQ trae
otro proyecto, van a `ajenas`.

Las dos se distinguen con el registro nuevo: `flow.plantillas_descartes` guarda, por
latido que descarte algo, `{cuando, llegaron, quedaron, motivos[]}` con el motivo y la
url de cada una. **Se lee con `getSetting` en el ws 1 después del primer latido con
plantillas.** Y el espejo ahora absolutiza (`new URL(u, location.href).href`) en los
dos caminos, así que la hipótesis principal queda cerrada sea o no la causa.

### Lo que Martín tiene que hacer UNA vez, y por qué no se puede evitar

El cuerpo con la frase **no existe en ningún lado**: pisado en la pestaña, pisado en
`chrome.storage.local`, y nunca llegado al server. No hay de dónde rescatarlo. Hace
falta **una** generación más del cubo. Con las cuatro capas protegiendo el cuerpo y
la url absoluta, esa queda para siempre — y llega al respaldo, así que sobrevive a un
cambio de perfil o de máquina.

### Las ocho guardas nuevas, probadas rompiéndolas

`fundir` no pisa · `sanear` registra el descarte · el espejo absolutiza · el espejo
no pisa (XHR) · el espejo mira el token de cada ancla · el worker no pisa · la
siembra repara · el route persiste los descartes. Base en verde, cada rotura en rojo,
restaurado en verde. Un test viejo (`extension-sentinela-encoding`) asertaba el
**nombre de una constante** en el cuerpo del detector y rompió con el cambio a
`ANCLAS` sin que nada estuviera mal: se cambió a fijar el invariante
(`cuerpo.includes(token)`), no la forma.

## Que Mauricio filme desde su PC sin tocar Flow: lo que lo impedía (06/09/2026, madrugada)

**Vive en:** `lib/flow-plantillas.ts` (`sanearPlantillas`, `queSembrar`, `opsSinRespaldo`,
`CLAVES_RESPUESTA`) · `lib/flow-cola.ts` (`marcarVisto`, `proyectoGuardado`) ·
`app/api/flow/puente/route.ts` · `extension/background.js` (latido, ESTADO,
`proyectoConocido`/`destinoDeFlow`) · `extension/popup.js`

Martín generó el cubo con la 0.64.0 y el popup pasó a «MaKo ya puede hacer tus
anuncios». Después: *«ahora lo hará Mauricio desde su PC, y no quiero que tenga que
hacer nada en flow»*. Lo que había que medir era si el aprendizaje llegaba al
respaldo del server —que es lo único que un Chrome nuevo puede recibir— y qué más
hacía falta para que ese Chrome arrancara solo.

### La hipótesis de la url relativa quedó CONFIRMADA por el registro

`flow.plantillas_descartes`, primer latido con plantillas tras el deploy:

    llegaron: 68 · quedaron: 5
    origen(boq:YhhmEf) /_/AiSandboxAngularFrontend/data/batchexecute?rpcids=YhhmEf&source-path=%2Fproject%2F99733…
    origen(boq:WuwhI)  /_/AiSandbox…   origen(boq:jwpduf) /_/AiSandbox…

BOQ abre sus XHR con la ruta relativa, `esOrigenDeFlow` hace `new URL(url)` y tira.
**Las cinco que quedaban eran las cinco del protocolo viejo.** Sin el registro esto
seguía siendo una hipótesis; con él es un hecho con la url adelante.

**Y la cura del espejo (absolutizar) no alcanzaba sola:** el espejo es MAIN world,
sobrevive a la actualización de la extensión y la guarda de idempotencia respeta al
viejo. Medido: `manifest: 0.64.0, espejo: 0.63.0` en la pestaña de Martín, o sea que
las plantillas siguen llegando relativas desde toda pestaña abierta antes de
actualizar. **El server las resuelve** (`/_/…` → `https://flow.google.com/_/…`, sólo
para clases de BOQ): una ruta que empieza en `/_/` no tiene origen propio, es del
mismo origen que la página que la mandó por construcción.

### Cinco cosas que impedían el «sin tocar Flow», y ninguna era la que parecía

1. **Un navegador nuevo no recibía NADA del respaldo.** `plantillasFaltantes =
   clasesQueTiene.length ? faltantes(…) : []` — pensado para la extensión vieja que
   no manda `clases`. Un Chrome recién instalado manda `clases: []`, y
   `[].length === 0` se lee igual. «No lo mandó» y «mandó vacío» son dos cosas:
   `queSembrar` las distingue con `Array.isArray`. **Era exactamente el caso para
   el que existe el respaldo, y era el único que no cubría.**
2. **El `projectId` sólo se aprendía del protocolo viejo** (`/v1/projects/<id>/` en
   el webRequest). En flow.google.com eso no existe: un Chrome que empieza ahí no
   sabía su proyecto nunca, «Empezar» abría la portada y el popup pedía «entra a un
   proyecto». Ahora se aprende de la url de la pestaña, el server lo devuelve
   (`flow_puentes.project_id`, que ya tenía) y los tres caminos que abren Flow van
   al proyecto (`destinoDeFlow`).
3. **El navegador que sí sabía no reenviaba.** Manda plantillas sólo cuando cambia
   su firma (`clase:len:metodo`), que no incluye la url: un respaldo que descartó por
   url relativa se quedaba vacío para siempre con el navegador convencido de haberlo
   mandado. El server ahora pide (`pedirPlantillas`) cuando el navegador reporta una
   operación que el respaldo no tiene **con ancla**, y el worker borra su firma.
4. **Nadie decía que el espejo estaba viejo.** El diagnóstico lo reportaba al server
   y ahí moría. El ESTADO ahora lo expone y el popup ofrece «Recargar» ANTES de la
   pantalla de «ya puede». Un espejo que no contesta NO cuenta como viejo (puede ser
   una pestaña dormida): sólo `espejo && espejo !== manifest`.
5. **Ninguna respuesta de BOQ se persistía.** `CLAVES_RESPUESTA` es un allowlist por
   clase y la clase de BOQ es `boq:<rpcid>`, que rota: no puede estar en ninguna
   lista. `flow.respuestas` sólo tenía `__fuentes/__sonda/__sondaSW/__redirect`. El
   worker re-etiqueta por la operación de su plantilla (`op:generar_clip`) y eso sí
   se guarda, con tope propio (12000: el medio entero no entra en 1400).

   ⚠️ **Es lo que permite medir la forma del payload sin gastar otro crédito:** la
   respuesta del cubo sigue en la memoria del espejo viejo de la pestaña de Martín
   hasta que la recargue. El worker nuevo la pide en su primer latido y la persiste;
   recién después conviene el F5. El orden importa.

### Y un `listo` con un `SIN_ANCLA` viejo al lado

`marcarVisto` no pisaba `estado_detalle` con vacío (correcto cuando el detalle era el
espía), así que con `listo` quedaba el motivo de hace una hora. Con `listo` ahora se
borra: el detalle es el POR QUÉ no puede filmar, y cuando puede no hay por qué.

### Lo que queda sin medir, y cómo se destraba

- La **forma del payload de generación** (para que `mediaDeFlow` lea un array
  posicional): se lee de `flow.respuestas['op:generar_clip']` después del primer
  latido de la 0.65.0 en la pestaña de Martín, **antes** del F5.
- Que Mauricio arranque de verdad sin tocar Flow: sembrado + proyecto + ensayo
  están cableados y probados por estructura; la primera corrida real en su Chrome
  es la medición.

Nueve guardas nuevas, las nueve probadas rompiéndolas.

## Dos errores en la pantalla del cliente, en una reunión (06/09/2026, noche)

**Vive en:** `lib/json-del-modelo.ts` · `lib/video-planner.ts` (`objetoDelPlan`) ·
`lib/campaign-structurer.ts` y `lib/landing-writer.ts` (delegan) ·
`app/video-generator/video-action.ts` (los dos `encolar`) ·
`extension/background.js` (`ejecutar`, rama BOQ)

El dueño los vio con Mauricio al lado, compartiendo pantalla.

### ① «Expected ',' or ']' after array element in JSON at position 631»

El modelo escribió las diez tomas bien y le faltó **una coma** entre dos elementos
del array. `JSON.parse` es binario —entra todo o nada— y el error que tira es para
un programador. Había **tres copias idénticas e ingenuas** de `parseJsonObject`
(sacar cercas, `slice` al `{…}`, `JSON.parse`), en tres archivos, y ninguna toleraba
nada.

Los modos de falla del JSON de un modelo son pocos y siempre los mismos, y se
reparan sin ambigüedad **si se camina el texto sabiendo si se está adentro o afuera
de un string**: coma que falta entre valores (`} {`, `" "`), coma que sobra antes de
cerrar, comilla de diálogo sin escapar (`"dijo "hola" y se fue"` — un guion está
lleno de eso), salto de línea crudo adentro de un string, cercas y prosa alrededor.

⚠️ **La comilla es la trampa.** Adentro de un string, una `"` cierra si lo que sigue
es lo que sigue a un valor (`,` `}` `]` `:`) o abre el siguiente (`"` `{` `[`). Con `,`
hay que mirar un paso más: `"hola", dijo` es diálogo (después de la coma viene una
palabra); `"hola", "otra"` es un array (viene otro valor). Sin ese paso extra, el
diálogo se parte.

**Regla que queda:** la reparación se aplica **sólo si el parse directo falla**. Una
heurística sobre JSON válido es una oportunidad de romperlo. Y hay tres escalones,
del más barato al más caro: reparar sin red (instantáneo) → pedirle a la cascada
barata que *copie* el mismo contenido como JSON válido (~2 s; no piensa, copia) →
tirar, **con la salida cruda en el log**, que es la única evidencia para el próximo
caso. Sin eso se diagnostica a ciegas otra vez.

### ② «El trabajo no trae texto para filmar.» — el texto era MÍO

La rama de BOQ de `ejecutar()` (extensión) reemplaza la frase de aprendizaje por
`pedido.prompt`. Los dos `encolar` del server llevaban el prompt **adentro** —en
`body` el clip, en `parches` la imagen— y al tope no había nada. Con plantilla de
BOQ, **video e imagen** morían con mi mensaje en la pantalla del cliente.

Es un defecto de contrato, no de lógica: el que encola y el que ejecuta se
escribieron por separado (el ejecutor esta misma semana) y nadie los cruzó. El
diagnóstico rápido —«la imagen falla»— era el equivocado: el video fallaba igual,
sólo que Mauricio probó la imagen primero.

**Regla que queda:** un productor y un consumidor de la misma cola comparten un
contrato, y **el test lo cruza**: lee el objeto que se encola y el campo que el
ejecutor exige, de los dos archivos, en el mismo test. El prompt FINAL viaja al tope
**y** adentro, calculado **una vez**: dos prompts para el mismo clip sería un anuncio
que cambia según el protocolo.

⚠️ Y una consecuencia que no se arregló hoy: el mensaje «El trabajo no trae texto
para filmar» es diagnóstico y llegó a una pantalla de cliente por el campo `error`
del trabajo. Ya no se dispara, pero la clase —un `error:` de la cola que la web pinta
tal cual— sigue existiendo para los demás motivos.

### Lo que NO cubre la rama de BOQ de la imagen (declarado)

El replay de imagen por BOQ **sólo cambia el texto** de la plantilla aprendida. La
cara elegida (`requests.0.imageInputs.0.name`, que el camino REST aplicaba por
parche) **no viaja**: sale la cara que había en la plantilla cuando se enseñó. Es
fidelidad, no un fallo visible, y se resuelve cuando se mida la forma del `f.req` de
imagen.
