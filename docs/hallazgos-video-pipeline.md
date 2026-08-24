# Hallazgos — Pipeline de post-producción de video (audio, subtítulos, música, SFX)

> Relevamiento del **24/08/2026**, 31 agentes en paralelo con una pasada adversarial de
> verificación de licencias encima. La regla que se aplicó: **donde la verificación
> contradijo al relevamiento, gana la verificación** — pasó en 6 de los candidatos, y en dos
> casos el veredicto quedó INVERTIDO.
>
> Contexto: anuncios verticales con avatar de IA. Hoy se entregan como archivo a un cliente;
> la ambición es un SaaS que los genere para terceros. **Son dos preguntas distintas de
> licencia y casi ninguna fuente contesta sí a las dos.**

## La regla que gobierna todo lo nuevo de esta área

**La licencia de una HERRAMIENTA nunca licencia un ASSET, y el canal de obtención (API,
portal web) es un contrato distinto de la licencia del archivo.**

Los tres corolarios, cada uno pagado por un caso real de abajo:

1. Que ffmpeg sea LGPL no dice nada sobre la música que le metés. GPL v2 §0 lo dice al revés:
   *«The act of running the Program is not restricted, and the output from the Program is
   covered only if its contents constitute a work based on the Program»*. El MP4 no contiene
   código.
2. **Freesound es el caso de manual**: la licencia CC0 del archivo PERMITE el SaaS, y el
   contrato de la API lo PROHÍBE (§4(d), cláusula de *service bureau*). Son capas distintas.
   La salida es bajar el pack offline una vez y servir desde storage propio.
3. **«Gratis para uso comercial» sin la cláusula al lado no es un dato.** Los seis frentes
   devolvieron candidatos que parecían servir y no servían.

---

## 1. Lo que se puede usar HOY (licencia verificada con cláusula, cero ambigüedad)

Todo este bloque es **software**, no assets. Esa es la razón de fondo por la que no aplica la trampa que ya costó dinero: la licencia de una herramienta no gobierna su output. La cláusula que lo dice es LGPL 2.1 §0 / GPL v2 §0 / GPL v3 §2, verbatim: *"The act of running the Program is not restricted, and the output from the Program is covered only if its contents constitute a work based on the Program"*. El MP4 no contiene código, contiene los píxeles del cliente.

| Pieza | Licencia | Entregar archivo | SaaS |
|---|---|---|---|
| FFmpeg (filtros `ass`/`subtitles`, `loudnorm`, `afftdn`, `acompressor`, `alimiter`) | LGPL 2.1+ (binario local = GPLv3) | sí | sí |
| libass | ISC | sí | sí |
| pysubs2 | MIT | sí | sí |
| stable-ts (exportador ASS) | MIT (repo archivado) | sí | sí |
| clipify / `build_ass.py` | MIT verificado por API + archivo | sí | sí |
| faster-whisper + CTranslate2 + pesos | MIT en toda la cadena | sí | sí |
| Groq whisper-large-v3 | Services Agreement §3.1 y §8.1 | sí | sí |
| DeepFilterNet3 (código **y pesos**) | MIT / Apache-2.0 dual | sí | sí |
| Fuentes OFL (Anton, Montserrat, Bebas, Poppins) | SIL OFL 1.1 | sí | sí |

---

## 2. Subtítulos — la recomendación

**FFmpeg + libass con un `.ass` generado por script propio.** Una sola dependencia nueva (`pysubs2`), cero toolchain adicional, licencias ISC/MIT/LGPL, y ya tenés ffmpeg en el pipeline.

Por qué no las alternativas:
- **Remotion / claude-shorts / `@remotion/captions`**: la verificación lo tumbó. Remotion no es MIT. `LICENSE.md`: *"You are eligible to use Remotion for free if you are: an individual; a for-profit organization with up to 3 employees..."*. Entregar el render al cliente está OK (el cliente nunca corre Remotion), pero el SaaS con >3 empleados exige Company License paga ($25/asiento/mes, o $0.01/render con mínimo $100/mes). Es meter una toolchain React entera para comprarte un problema futuro.
- **ZapCap / JSON2Video / Creatomate**: JSON2Video free dice textual *"For personal, educational, and evaluation use — not for commercial use"* + watermark. ZapCap y Creatomate quedaron **no verificados** en licencia del render, y ZapCap además vende plantillas que imitan estilos de personas reales.
- **captacity / autocaption**: MoviePy, sin mantenimiento (2024), y autocaption no tiene archivo LICENSE (solo README).

### Camino concreto

Robar `build_ass.py` de clipify (MIT, no instalar la skill entera — trae face-tracking que no necesitás):
```
https://raw.githubusercontent.com/louisedesadeleer/clipify/main/scripts/build_ass.py
python3 build_ass.py WHISPER.json OUT.ass opus
```
El preset `opus` es literalmente el look pedido: size 100, `PrimaryColour &H00FFFFFF` (blanco), highlight `&H0000FFFF` (amarillo), `OutlineColour &H00000000` con `Outline 8`, `Shadow 3`, grupos de 3 palabras.

**Tres parches obligatorios antes de usarlo:**

1. **La fuente.** Hardcodea `Arial Black` (presets opus/karaoke) y `Helvetica` (minimal). Ninguna de las dos está en el repo ni cubierta por su MIT. Rasterizar glifos en el render no es redistribuir la fuente, así que entregar está bien — pero **bundlear el .ttf de Arial Black (EULA Microsoft/Monotype) dentro del contenedor del SaaS sí es redistribución y no está permitido**. Cambiar a **Anton** o **Montserrat ExtraBold** (OFL: el FAQ oficial 1.4 permite bundlear y vender con software; 1.12 permite embeber en documento). **Y la trampa silenciosa: en un render server Linux Arial Black no existe y libass NO falla — cae a otra fuente y sigue. Subtítulos rotos sin una sola línea en el log.**
2. **Mayúsculas.** ASS no tiene uppercase nativo. Agregar `.upper()` al texto — no verificado que el script lo haga.
3. **Schema.** Espera `segments[].words[]{start,end,word}` de whisper local. Groq con `verbose_json` según granularidad puede traer `words` a nivel raíz. Hay que mapear.

Quemado:
```bash
ffmpeg -i in.mp4 -vf "ass=subs.ass:fontsdir=./fonts:original_size=1080x1920" \
  -c:a copy out.mp4
```
`original_size` es obligatorio en 9:16 — la doc oficial lo dice: *"Due to a misdesign in ASS aspect ratio arithmetic, this is necessary to correctly scale the fonts if the aspect ratio has been changed."*

Nota técnica: **no usar los tags de karaoke `\k`/`\K`/`\kf`** para este look. Un `Dialogue` por palabra con `\1c` inline sobre la palabra activa da control total del amarillo y permite el pop de escala; `\k` rellena por sílaba dentro de una línea y no es lo que hace CapCut.

---

## 3. Transcripción — la recomendación

**Quedate con Groq, no cambies nada.** Es la mejor licencia de todo el relevamiento y el free tier alcanza de sobra.

Services Agreement §8.1, textual: *"As between the parties, Customer retains all Intellectual Property Rights in Customer Data (including in Inputs and Outputs)"*. Y §3.1 contempla el SaaS explícitamente: *"...including the right to use Groq's APIs to integrate the Cloud Services and AI Model Services into your Customer Application and to make the Cloud Services and AI Model Services available to End Users through your Customer Applications."*

Free tier: 20 RPM, 2.000 RPD, 7.200 audio-segundos/hora, 28.800/día = 8 h de audio diarias. Un anuncio de 60 s cuesta $0.00185 si algún día pagás.

```bash
curl https://api.groq.com/openai/v1/audio/transcriptions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F file=@voz_final.wav \
  -F model=whisper-large-v3 \
  -F response_format=verbose_json \
  -F "timestamp_granularities[]=word" \
  -F language=es
```
`response_format=verbose_json` es **requisito**: sin eso, `timestamp_granularities` no devuelve palabras.

**No pases a `whisper-large-v3-turbo`** aunque sea 2.8x más barato: WER 12% vs 10.3%. En subtítulos quemados palabra por palabra el error se ve en pantalla y lo pagás en revisión manual. La diferencia real es $0.0012 por anuncio.

Groq downsamplea a 16 kHz mono antes de transcribir, así que mandale el audio ya a 16k mono: ahorrás subida y no perdés nada.

**Orden del pipeline (importante):** procesá el audio primero y transcribí sobre el audio FINAL. Si transcribís antes del denoise, DeepFilterNet mete delay de STFT+lookahead y los timestamps dejan de alinear con el video. (Si por alguna razón tenés que transcribir antes, `deep-filter -D/--compensate-delay` compensa.)

**Dos cosas que NO hay que hacer acá:**
- Groq §6.3(c) prohíbe *"sell, resell, sublicense, transfer, or distribute any of the Cloud Services"*. Renderizar videos está bien; exponer un endpoint de transcripción pass-through en el SaaS es reventa y necesita aprobación.
- **WhisperX: NO correr `--language es` sin `--align_model` explícito.** `alignment.py` consulta `DEFAULT_ALIGN_MODELS_TORCH` primero, y para `es` mapea a `VOXPOPULI_ASR_BASE_10K_ES`, que torchaudio declara: *"Originally published by the authors of VoxPopuli under CC BY-NC 4.0 and redistributed with the same license."* **NonCommercial**, en un anuncio pago. Funciona perfecto, no da error, no avisa. Si igual querés WhisperX por precisión de alineación (es el mejor del lote), forzá siempre `--align_model jonatasgrosman/wav2vec2-large-xlsr-53-spanish` (apache-2.0).

---

## 4. Voz — la recomendación

**Cadena 100% local en ffmpeg + DeepFilterNet3 como denoiser.** Cero servicios externos, cero cuota, licencias MIT/Apache/LGPL.

Por qué DeepFilterNet y no `arnndn`: `arnndn` es mejor que `afftdn`, pero **los modelos `.rnnn` de GregorR no tienen licencia**. La API de GitHub devuelve 404 en `/license` y la única declaración es una línea del README: *"With the exception of the tools/ directory and this file, none of this work is creative and thus none of it is subject to copyright."* Eso es una **opinión legal unilateral**, no una concesión. Un repo sin LICENSE es "all rights reserved" por default. DeepFilterNet dice, textual: *"All code in this repository is dual-licensed under either: MIT License or Apache License, Version 2.0 at your option"*, y se verificó que el zip de pesos (`DeepFilterNet3.zip`) no trae ningún LICENSE aparte ni restricción. Para SaaS elegí Apache-2.0 por el patent grant de la §3.

### Comandos

Paso 1, denoise (requiere 48 kHz — *"Currently, only wav files with a sampling rate of 48kHz are supported"*):
```bash
deep-filter -m DeepFilterNet3 -D --pf -o ./tmp voz48k.wav
```

Paso 2, medir (**la pasada 1 tiene que medir CON la misma cadena previa aplicada**, si no los `measured_*` no corresponden):
```bash
ffmpeg -i ./tmp/voz48k.wav -af "highpass=f=80:poles=2,deesser=i=0.35:m=0.5:f=0.5,\
acompressor=threshold=-18dB:ratio=3:attack=15:release=180:makeup=2,\
loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null -
```

Paso 3, aplicar:
```bash
ffmpeg -i ./tmp/voz48k.wav -af "highpass=f=80:poles=2,deesser=i=0.35:m=0.5:f=0.5,\
acompressor=threshold=-18dB:ratio=3:attack=15:release=180:makeup=2,\
loudnorm=I=-14:TP=-1:LRA=11:measured_I=<input_i>:measured_TP=<input_tp>:\
measured_LRA=<input_lra>:measured_thresh=<input_thresh>:linear=true,\
alimiter=limit=0.891" -ar 48000 voz_final.wav
```

### Cinco gotchas medidos en máquina (no teoría)

1. **`-ar 48000` es obligatorio.** `loudnorm` resamplea la salida a **192000 Hz** en silencio si no lo forzás. Entró 48k, salió 192k.
2. **Una sola pasada no llega.** Se pidió I=-14 y midió -12.9 LUFS (1.1 LU de error). Con dos pasadas dio exactamente -14.0.
3. **`deesser` sin `i=` es un NO-OP bit a bit.** El default es `i=0`. MD5 idéntico entre bypass y `deesser` a secas (`4c0eb5ae...`); con `i=0.4` recién cambia (`46122cf7...`). Si lo metés sin parámetro, no hace nada y parece que funciona.
4. **`linear=true` es "si se puede".** Si `measured_LRA > LRA` target, cae a modo `dynamic` (comprime) y no llega al target. Comprobado: `input_lra=19.30` con `LRA=11` → `normalization_type: dynamic` y quedó en -12.9. **Leé el campo `normalization_type` del JSON de la pasada 2.**
5. **`loudnorm` y `ebur128` no coinciden**: mismo archivo, -28.96 vs -29.3 LUFS (~0.35 LU). No cruces validaciones esperando igualdad exacta.

`alimiter=limit=0.891` es lineal = -1 dBFS.

### Sobre el target de -14 LUFS: NO VERIFICADO

**Ninguna plataforma publica un spec oficial de loudness que se haya podido verificar.** Se buscó en `ads.tiktok.com/help` (los specs de video ads cubren formato, duración, tamaño y bitrate ≥516 kbps, pero **no** loudness), el Meta Business Help Center (la página "About managing ad volume" está detrás de login) y support.google.com. Todas las cifras de "-14 LUFS para Reels/TikTok" que circulan salen de blogs SEO. Lo único oficial son AES TD1008 / AES77 (streaming on-demand) y EBU R128 (broadcast). Usá -14 como default operativo, pero no lo escribas en la doc como si fuera un requisito de Meta.

### Lo que se descarta en este frente

- **Auphonic free**: *"Productions of free users come with a jingle."* Inyecta un jingle de marca en el audio. No es un tema de licencia, el archivo sale contaminado. Muerto para un entregable.
- **Adobe Podcast Enhance Speech**: **no hay API pública** (confirmado por un miembro del equipo de Adobe en los foros oficiales). No se puede automatizar. Además los ToS quedaron no verificados.
- **ElevenLabs Voice Isolator**: *"The free plan does not include a commercial license and cannot be used for any commercial purpose."* Con plan pago sirve para (a) y (b); para SaaS los ToU prohíben *"Resell, repackage, redistribute, sublicense, or otherwise make API access available"* sin autorización escrita. Además consume del mismo pool de créditos que el STS (1000 caracteres por minuto de audio).

---

## 5. Música — las dos preguntas por separado

**Nada de esto es "gratis o no". Es: ¿puedo entregar el MP4? y ¿puedo meterlo en el SaaS?** Son preguntas distintas y casi ninguna fuente contesta sí a las dos.

### (b) ¿Puedo entregar el archivo renderizado al cliente?

| Fuente | Veredicto | La cláusula |
|---|---|---|
| **Pixabay Music** | **SÍ** | La prohibición es solo "Standalone", y los ToS definen a nuestro favor: *"using the Content with a combination of images, videos, audio files, other media, text... is not Standalone use, so long as the combined effect is to make a 'new' creative work"*. Un anuncio con avatar + voz + subtítulos no es Standalone. |
| **Artlist Pro** | **SÍ** | Punto 3, "Your clients are covered": *"you can transfer this Project to your clients and to anyone else"*. Punto 2: los proyectos publicados durante la suscripción se pueden seguir usando "FOREVER". |
| **Uppbeat Pro** | **SÍ** | 4.6: *"you may use the Content in material that will be published by a third party client"*. |
| **Epidemic (suscripción normal)** | **SÍ** | Licencia por Producción. Cortar, loopear y hacer fade está permitido; editar más allá de eso no. |
| **Stable Audio Open** | **SÍ** | *"You own outputs generated from the Core Models"*. |
| **SOUNDRAW** | ⚠️ **NO** — la verificación invirtió el relevamiento | License Agreement §3.c.ii: *"User will not synchronize... in time relation to any audiovisual works without SOUNDRAW's prior written approval in each instance, including on third party commercials"*. §3.a.vi limita la sincro a obras *"owned or controlled by User"*. La página de licencia dice "client work" OK **y** "Video content not owned by the user (Movies, TV, ads, etc.)" Not OK, en la misma pantalla. §15.a resuelve el conflicto a favor del contrato. **Con plan Creator/Artist no podés entregar un anuncio a un cliente.** |
| **Beatoven.ai** | ⚠️ **NO** — la verificación invirtió el relevamiento | §6.3(c) prohíbe *"sell copies of, or files embodying, Your AI Music"* y limita la explotación a *"Your Content in Your Project"*. §20.0: *"You may not assign, sub-license or transfer this Agreement, the License or any part hereof, to any person or entity."* §6.6: el copyright es de Beatoven. El cliente queda sin licencia y no hay forma contractual de dársela. |
| **Openverse** | ⚠️ **NO VERIFICADO** — la verificación invirtió el relevamiento | ToS §3: *"Openverse does not own or control the content... and does not verify its licensing status or make any representations or warranties about the content or data whatsoever."* El campo `license` de la API es metadato no verificado. Un "sí" derivado de ahí es un sí sin emisor. |

### (c) ¿Puedo meterlo en un SaaS multi-usuario?

**Solo dos caminos limpios:**

1. **Epidemic Sound Connect (Partner API)** — el único de las bibliotecas grandes que **vende** este caso. Plan Scale incluye *"Sub-licensing for your end-users"*. Free tier de 50 descargas para prototipar antes de negociar. Restricción dura: *"Partners are not permitted to cache collections or track metadata locally."* → developers.epidemicsound.com
2. **Stable Audio Open self-hosted** — Community License: *"You own outputs generated from the Core Models... and therefore can use those outputs at your discretion"*, gratis mientras la organización facture <USD 1M/año. Como sos dueño del output, se rompe toda la cadena: sin cláusula de standalone, sin sublicencia, sin vencimiento, sin nada que explicarle al cliente. **NO VERIFICADO: la calidad musical de la 1.0 para pistas completas** — rinde mejor en loops y SFX que en música de fondo terminada. Vale una prueba antes de apostar.

Y un tercero condicionado: **SOUNDRAW vía contrato de API** (no la suscripción). §2.2 del API Agreement concede *"the right and license... to develop, implement and distribute Applications solely for use by its users and subscribers (for both personal and commercial use)"* y §3.4 licencia a los usuarios finales sin regalías sobre UGC monetizado. **Pero** §3.6 obliga a negociar por escrito antes de monetizar y §3.8.3 exige **70% del revenue** si el usuario final puede descargar el track suelto sin alteración significativa. Si la música va pegada dentro del video, caés en §3.4 (sin regalías); si ofrecés bajar el audio solo, caés en el 70%. Starter $29,99/mes (solo empresas ≤3 empleados), Pro $300/mes con compromiso de 180 días.

**Los que dicen NO al SaaS, con cláusula:**
- **Epidemic (suscripción normal)**: *"...in any way that is intended to allow third parties to download, reproduce, stream... on a standalone basis, INCLUDING WITHOUT LIMITATION IN ANY DIGITAL TEMPLATES OR OTHER APPLICATIONS ENABLING END USERS TO SYNCHRONIZE OR OTHERWISE COMBINE THE LICENSED WORK(S) WITH OTHER CONTENT"*. Describe el producto palabra por palabra.
- **Artlist Pro**: punto 5 prohíbe *"ALLOW ANYONE TO USE the Assets... USE AS A TEMPLATE"*.
- **Uppbeat Pro**: 7.1.3: *"You may not resell any Content (or otherwise make it available) as your 'product'... EVEN IF IT HAS BEEN TRANSFORMED OR EDITED"*.
- **Beatoven**: §20.0, prohibido sublicenciar a cualquier persona o entidad.
- **Pixabay Music**: **no verificado, pero apunta a no**. La licencia que Pixabay te da omite deliberadamente `with the right to sub-license` (que sí aparece en la licencia que el uploader le da a Pixabay). Sabían redactar el derecho y eligieron no dártelo.

### Contradicciones abiertas que hay que resolver ANTES de pagar

- **Mubert**: la página de precios de la API lista "Sub-licensing available" en los cuatro planes; el blog oficial dice que el sublicenciamiento para que el usuario final exporte contenido *"is only available on the Startup+ plan and above"* ($499/mes). Una de las dos páginas oficiales miente. Como en el SaaS el usuario **exporta**, aplica la versión restrictiva. Pedir por escrito en qué plan entra el export.
- **Loudly**: la página de producto promete "Perpetual license"; el License Agreement dice que la cesión vale *"for the term of this Agreement"*. Si el render entregado deja de estar cubierto al cancelar, es exactamente la trampa que ya costó dinero. No avanzar sin PERPETUAL por escrito.

### Dos gotchas de suscripción que matan renders viejos

- **Uppbeat 9.4**: *"All Content downloaded whilst holding a Paid Subscription must be synchronised... whilst still holding that Paid Subscription. It is NOT PERMITTED to use previously downloaded Content once a subscription has ended."* No podés bajar 200 tracks, cancelar y seguir usándolos en renders nuevos.
- **Artlist punto 4**: *"We consider downloading Assets by any automatic means, such as software, bots, etc., as not reasonable, and therefore it is PROHIBITED."* Máximo 40 canciones/día, a mano. No hay API. Sirve como pack curado manual, nunca como fuente de un pipeline.

---

## 6. Efectos de sonido — las dos preguntas por separado

### (b) Entregar el archivo

- **Freesound CC0**: **SÍ**, y es el único con cláusula de hierro. CC0 §2: *"waives, abandons, and surrenders all of Affirmer's Copyright and Related Rights... for any purpose whatsoever, including without limitation commercial, advertising or promotional purposes"*. Es una **renuncia**, no una licencia con condiciones: estructuralmente no puede haber cláusula de "end product". 204.454 SFX; "coffee machine" + CC0 da 442 resultados.
- **Pixabay SFX**: **SÍ**, misma excepción de "new creative work".
- **ZapSplat**: **SÍ**. EULA §4: *"You may use our sound effects and music, embedded or synchronized within a production, in any project including... Commercials and advertising."* En Basic (gratis) la atribución a "ZapSplat" es obligatoria; Premium la quita (£2.99/asiento/mes en Teams; el precio individual **no verificado**, la página se renderiza por JS).
- **Freesound CC-BY**: **NO VERIFICADO**. CC BY 4.0 §2(a)(1) dice literal *"non-sublicensable"*: no le podés ceder derechos limpios al cliente. La atribución de §3(a)(1) viaja con el archivo hasta el anuncio publicado. Un entregable publicitario normal, sin créditos, **incumple** y dispara la terminación automática del §6(a).
- **BBC Sound Effects**: **NO**. Modal de descarga, textual: *"Commercial use of this content is not allowed under the RemArc license."*
- **SoundBible**: **NO VERIFICADO**. La licencia cambia archivo por archivo y no hay página de licencia (404). Muestreo del 24/08: en `/tags-coffee.html` **5 de 10 eran "Sampling Plus"**, la licencia que prohíbe publicidad. Justo en la búsqueda que necesita este proyecto.

### (c) SaaS

- **Freesound**: la **licencia CC0 permite** el SaaS. El **contrato de la API lo prohíbe**, y son capas distintas. API ToS §4(d), textual: *"Use, copy, distribute or modify the API or Content in any 'service bureau' or 'timesharing' business to end users that are not logged on to the Platform with valid user credentials and live session."* Eso es literalmente un SaaS que genera videos para terceros. Más §3: *"Terms for commercial use of the API will be negotiated on a case by case basis with UPF."*

  **La salida limpia**: bajar el pack CC0 **una sola vez, offline**, guardarlo en storage propio y versionarlo, y que el runtime del SaaS sirva **siempre** desde ahí. El §4(d) no aplica porque no hay uso de la API en producción, y CC0 es irrevocable sobre el archivo ya bajado. **Reserva honesta**: los ToS del sitio dicen *"you may not use the Freesound website portal for commercial purposes"*, lo que roza incluso la descarga manual. Es riesgo de cuenta cancelada, no de demanda por el video, pero está ahí y hay que saberlo.
- **Pixabay SFX**: **NO**. Tres cláusulas: *"Bulk, large-scale or systematic copying of Content is strictly prohibited"*, *"Data mining, extraction, scraping and the use of programs or robots for automatic data collection... is strictly prohibited"*, y *"use or compile any Content to replicate a similar or competing service"*. Escape hatch real pero minúsculo: solo los archivos con **Published date anterior al 9-ene-2019** son CC0; casi toda la sección de sound effects es posterior.
- **ZapSplat**: **NO**. §5: *"Share, transfer, loan, rent, sublicense, or sell our sound effects or music to any third party"* y *"Redistribute our sounds in any form (e.g., sound libraries, file sharing, apps...)"*. Además §7 prohíbe acceso automatizado y no hay API.

### Riesgo que aplica incluso donde el veredicto es sí

CC0 §4: *"Affirmer offers the Work as-is and makes no representations or warranties of any kind... including without limitation warranties of title... Affirmer disclaims responsibility for clearing rights of other persons."* Y el propio FAQ de Freesound admite: *"there might be cases where the users of our site are (un)knowingly uploading illegal content."* **Cero indemnización de nadie.** Si un uploader marcó CC0 sobre audio robado, el reclamo llega al render facturado. Por cada sonido usado, guardá **id + uploader + screenshot de la licencia + fecha de descarga** junto al render. Eso vale para música también, y no es burocracia: es la única defensa que existe.

---

## 7. Dónde la verificación tumbó al relevamiento (resumen)

| Ítem | Relevamiento dijo | Verificación dice | Por qué |
|---|---|---|---|
| SOUNDRAW | entregar=sí, SaaS=no_verificado | **entregar=NO, SaaS=SÍ (vía API)** | Está invertido. §3.c.ii prohíbe "third party commercials" con plan consumidor; el contrato de API sí licencia end users (§2.2/§3.4). |
| Beatoven.ai | entregar=sí | **entregar=NO, SaaS=NO** | §6.3(c) + §20.0. Dos cláusulas explícitas, no una ausencia. |
| Openverse | sí / sí | **no_verificado / no_verificado** | Openverse se declara por escrito incompetente para licenciar. Además su filtro "commercial" devuelve Sampling+, que prohíbe publicidad. |
| Pixabay SFX | sí / sí | **sí / NO** | Tres prohibiciones explícitas de copia sistemática y sin derecho de sublicencia. |
| claude-shorts | entregar=sí, SaaS=no_verificado | **entregar=sí, SaaS=NO sin comprar** | La cláusula no está en su repo (MIT real), está en Remotion, que es dependencia dura. |
| anthropics/skills | sí / sí | **el enunciado global es falso** | No hay licencia a nivel repo (`license: null`, `/license` = 404). Es por carpeta: 14 Apache-2.0, 4 propietarias que prohíben textual *"Distribute, sublicense, or transfer these materials to any third party"*, y `doc-coauthoring` sin licencia alguna. Igual es irrelevante: cero archivos de audio en todo el árbol. |

---

## 8. Lo que quedó SIN verificar (no lo completes con lo que suena razonable)

- **Los targets de LUFS de Meta / TikTok / Instagram.** No hay documentación oficial. Todo lo que circula es blog.
- **ElevenLabs Music**: el texto de la cesión vive en "Eleven Music v1 Terms" y **esa URL devuelve 404**. Verificado solo: uso comercial amplio en planes pagos, y prohibición de sublicenciar el *acceso* a la API. Si el output también cae bajo esa prohibición es ambiguo. Además §4.A exige **co-branding**: mostrar el logo de ElevenLabs en tu producto.
- **Beatoven pricing**, **Artlist pricing**, **ZapSplat individual**, **Incompetech Standard License**, **Creatomate**: no verificados en fuente oficial.
- **ZapCap, Creatomate, hyperframes, adobe-for-creativity**: licencia del render no verificada en ninguno.
- **AssemblyAI SaaS**: el opt-out de entrenamiento es condicional — *"to the extent applicable to Customer's pricing plan"*. En free/PAYG puede no existir. Sin confirmar.
- **Deepgram**: los precios publicados **asumen opt-in al Model Improvement Program**. Se sale con `mip_opt_out=true` por request, pero **la tarifa opted-out no está publicada**.
- **Gladia**: los ToS definen "Content" (input + output) y **nunca asignan la propiedad al cliente**. Bandera roja, y además es el más caro del lote ($0.61/h, 15x Groq). No hay razón para pelear esa ambigüedad.
- **Suno**: sin API pública self-serve, licencia post-acuerdo con Warner no verificada, litigio abierto. Todas las "Suno APIs" de Google son wrappers no oficiales que violan los términos y se rompen sin aviso.
- **Stable Audio Open**: calidad musical para pistas completas.
- **Modelos `.rnnn`**: la mitad de *ruido* del training data (`cough/`, `laugh/`) no tiene procedencia documentada en ninguna parte del repo.
- **PyAV** (dependencia de faster-whisper) empaqueta binarios de FFmpeg y su LICENSE.txt no dice bajo qué build están compilados. Irrelevante server-side; hay que verificarlo antes de empaquetar algo descargable.

---

## 9. Lo que NO hay que hacer, y por qué

1. **No linkear OpenMontage al producto.** 50k estrellas y cubre todo el frente de una, pero es **AGPL-3.0** sin licencia comercial alternativa. §13: *"if you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network... an opportunity to receive the Corresponding Source"*. Un SaaS real lo va a modificar → tenés que ofrecerle el código fuente completo a cada usuario, gratis. Entregar el MP4 no se ve afectado. **Usalo como fuente de recetas de ffmpeg, no como dependencia.**

2. **No confiar en el filtro `license_type=commercial` de Openverse.** Clasifica como "uso comercial permitido" la licencia CC Sampling Plus, cuyo texto dice: *"Prohibition on advertising. All advertising and promotional uses are excluded from the above rights"*. El único uso de este pipeline es publicidad. Además, en una consulta real 14 de los 20 primeros resultados eran NC o ND.

3. **No llamar a la API de Freesound desde el runtime del SaaS.** §4(d), "service bureau". Pack local curado offline.

4. **No dejar `Arial Black` ni `Helvetica` en el `.ass`.** Dos razones: bundlear el .ttf en el contenedor es redistribución de fuente prohibida por EULA, y en Linux libass no falla — cae a otra fuente en silencio y el render sale mal sin un error en el log.

5. **No correr `whisperx --language es` sin `--align_model`.** Te bajás un modelo CC BY-NC en un anuncio pago, sin aviso, sin error.

6. **No usar Auphonic free** (jingle en el output) **ni ElevenLabs free** (sin licencia comercial + atribución obligatoria "elevenlabs.io" en el título).

7. **No usar SOUNDRAW con plan Creator para trabajo de cliente**, aunque la página diga "client work". El contrato pisa a la página (§15.a).

8. **No usar Beatoven** para nada de este pipeline.

9. **No adoptar Remotion** sin decidir antes si el equipo va a pasar de 3 empleados. Es la única dependencia de la lista con licencia propietaria y el costo aparece después, cuando ya reescribiste el render.

10. **No asumir que un pack descargado sobrevive a la cancelación.** Uppbeat 9.4 lo prohíbe explícitamente; Loudly cede derechos solo *"for the term of this Agreement"*.

11. **No mezclar unidades de timestamp entre proveedores.** AssemblyAI devuelve **milisegundos**; Groq, Deepgram y Gladia devuelven **segundos**. Cambiar de proveedor sin tocar el código deja los subtítulos 1000x corridos.

12. **No confiar en "MIT según el README"** cuando no hay archivo LICENSE. `wilwaldon/Claude-Code-Video-Toolkit` dice MIT en el README y la API de GitHub devuelve `license: null`. Sin archivo, la afirmación es legalmente débil para meterla en un producto. Mismo caso en `fictions-ai/autocaption`.

13. **No transcribir antes del denoise** sin `-D`. El delay de STFT desalinea los timestamps y los subtítulos van corridos contra la voz.

14. **No esperar una solución oficial de Anthropic.** Se verificaron los dos marketplaces: en el oficial el único plugin de video es `hyperframes` (generación de video-como-código, paradigma opuesto a montar clips existentes); en el community (~400 plugins) el único que roza el tema es `adobe-for-creativity`, que no hace ni subtítulos ni audio. Y el README del marketplace es explícito: *"License — Please see each linked plugin for the relevant LICENSE file"* + *"Anthropic does not control what MCP servers, files, or other software are included in plugins and cannot verify that they will work as intended or that they won't change."* El Apache-2.0 del índice **no se propaga** a los plugins listados.

---

## Nota de cosecha

Esto tiene que quedar escrito en el repo o se pierde. Sugerencia: `docs/hallazgos-video-pipeline.md`, con entrada en `docs/hallazgos.md` en el mismo commit. Los tres hallazgos que más tiempo van a ahorrar después son: (1) el diagnóstico obvio equivocado — SOUNDRAW y Beatoven parecían resolver el caso "entrega a cliente" y son justo al revés; (2) las tres fallas silenciosas (libass cayendo a otra fuente, `deesser` con `i=0` como no-op, `loudnorm` resampleando a 192 kHz); y (3) la regla que gobierna todo lo nuevo: **la licencia de una herramienta nunca licencia un asset, y el canal de obtención (API/portal) es un contrato distinto de la licencia del archivo**.