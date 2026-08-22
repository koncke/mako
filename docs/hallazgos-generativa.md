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

**Lo que no:**
- Son **3 meses, no 18**. El «18» existe pero es otra cosa: Google regaló 18 meses de
  AI Pro a usuarios de Jio en India, y ese stock es la fuente probable de la reventa.
- **No es una oferta de Google.** Es reventa de *activation links* en marketplaces de
  claves grises. Los términos dicen textual «This Offer is non-transferable, cannot be
  resold». Se apaga cualquier día, sin devolución.
- **«Ilimitado» no lo dice Google.** Los límites de Gemini son por cómputo, se reponen
  cada 5 horas, y la doc dice «Limits may change without notice».
- **La cuenta del curso está inflada 2x**: los US$0,06 que cita por «clip de 10s» son
  15 créditos, y 15 créditos compran **4 segundos** con Omni Flash. Diez segundos son
  30 créditos. Y manda al modelo 3x más caro por defecto: Veo 3.1 Lite cuesta 10
  créditos por clip de hasta 8s contra los 30 de Omni.

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
