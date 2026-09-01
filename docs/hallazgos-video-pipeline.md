# Hallazgos — Pipeline de post-producción de video (audio, subtítulos, música, SFX)

> Relevamiento del **24/08/2026**, 31 agentes en paralelo con una pasada adversarial de
> verificación de licencias encima. La regla que se aplicó: **donde la verificación
> contradijo al relevamiento, gana la verificación** — pasó en 6 de los candidatos, y en dos
> casos el veredicto quedó INVERTIDO.
>
> Contexto: anuncios verticales con avatar de IA. Hoy se entregan como archivo a un cliente;
> la ambición es un SaaS que los genere para terceros. **Son dos preguntas distintas de
> licencia y casi ninguna fuente contesta sí a las dos.**

> **El pipeline completo, listo para implementar, está en `edicion-video-automatica.md`.**
> Este documento es el forense (por qué cada número es el que es); aquel es el qué se hace.

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

## 10. Los primeros montajes reales (01/09/2026) — dónde la receta de arriba falló

Se montaron **tres anuncios de Mauricio** de punta a punta con la receta de las §2–§4:
clips de Flow, voz de ElevenLabs, música de Pixabay y subtítulos quemados. Salieron, pero
**tres de los comandos escritos arriba no hacen lo que dicen que hacen**, y ninguno falla:
los tres pasan sin error y dejan el archivo mal. Corregidos abajo.

El pipeline entero quedó versionado en **`scripts/montar-anuncio-vertical.sh`** (+
`scripts/subs-anuncio.mjs`). Es el que corrió; no es pseudocódigo.

### 10.1 `alimiter=limit=0.891` NO limita a −1 dBFS. No limita a nada.

Es el peor de los tres porque es el que protege el entregable. `alimiter` tiene un
parámetro **`level` (auto level) que viene en `true` por default**, y su efecto es
renormalizar la salida a 0 dBFS **después** de limitar. El `limit` se aplica y se deshace.

Medido, mismo archivo:

| Cadena | Sample peak resultante |
|---|---|
| `alimiter=limit=0.7` (como está escrito arriba) | **0.000265 dB** — o sea 0 dBFS, sin tocar |
| `alimiter=limit=0.7:level=disabled` | **−3.098 dB** — correcto |

La doc de ffmpeg lo dice, en una línea fácil de saltear: *"level: Auto level output signal.
Default is enabled. This normalizes audio back to 0dB if enabled."*

**Siempre `alimiter=limit=<x>:level=disabled`.** Sin eso, toda la §4 termina entregando
audio a 0 dBFS, que es exactamente lo que la cadena decía evitar.

### 10.2 `acompressor:makeup` es un factor LINEAL, no decibeles

Arriba está escrito `makeup=2` con la intención de +2 dB. **`makeup=2` es ×2 = +6.02 dB.**
Medido sobre el mismo material: con `makeup=1` el true peak da −4.83 dBTP, con `makeup=2`
da +1.19 dBTP. La diferencia es exactamente 6.02 dB.

En material que ya viene caliente eso solo empuja todo por encima de 0 dBFS y dispara el
problema de 10.3.

### 10.3 `linear=true` cae a `dynamic` por TRUE PEAK, no solo por LRA

La §4 documenta una sola condición de caída (`measured_LRA > LRA` target). **Hay una
segunda, y es la que se activó acá.** `loudnorm` solo puede trabajar en modo lineal si la
ganancia que necesita no revienta el true peak:

```
measured_TP + (I_target − measured_I)  ≤  TP_target
```

Reordenado, es una condición sobre el **PLR** (peak-to-loudness ratio) de la entrada:

```
PLR = measured_TP − measured_I  ≤  TP_target − I_target
```

Con los targets de la casa (I=−14, TP=−1) el techo es **13 dB de PLR**. La voz del primer
video entraba con PLR de 15.6 dB → `dynamic`, silenciosamente, con `input_lra` en 4.80 y el
LRA target en 11. Leer solo el LRA para explicar la caída lleva a buscar el problema donde
no está.

**Y no es un margen teórico:** de los tres videos montados, uno entró con **PLR 12.84**, a
0.16 dB del techo. Por eso el script imprime el PLR en cada corrida y el
`normalization_type` de la pasada 2. Si alguna vez dice `dynamic`, el número que hay que
mirar es ese, no el LRA.

### 10.4 El audio de ElevenLabs sale clipeado

No es ruido de fondo ni un caso raro: la voz cruda concatenada midió **sample peak 0 dBFS y
true peak +0.19 dBTP**. Sale de la API ya en el techo. Cualquier cadena que asuma headroom
—y la §4 lo asume, fue escrita pensando en voz cruda de grabación— arranca ya en falta.

Corolario para la §4 entera: **sobre audio de ElevenLabs no hace falta denoise** (no se usó
DeepFilterNet en ninguno de los tres y no hizo falta), pero **sí hace falta headroom**, que
es lo contrario de lo que la cadena hace con su `makeup`.

### 10.5 El orden correcto: normalizar la MEZCLA, no la voz

La §4 normaliza la voz a −14 LUFS y después alguien le suma música encima, lo que mueve el
resultado. **El entregable es la mezcla, así que el loudnorm de dos pasadas va sobre la
mezcla.** La voz solo recibe tratamiento tonal y control de picos.

Cadena que funcionó, entera:

```bash
# 1. voz: tonal + picos. Sin loudnorm todavía.
ffmpeg -i voz-cruda.wav -af "highpass=f=80:poles=2,deesser=i=0.35:m=0.5:f=0.5,\
acompressor=threshold=-18dB:ratio=3:attack=5:release=180:makeup=2,\
alimiter=limit=0.7:level=disabled" -ar 48000 -ac 1 voz-proc.wav

# 2. música: medir su I y calcular la ganancia, no tirar un "-20 dB" a ojo.
ffmpeg -t $TOTAL -i musica.mp3 -af "volume=${GAN}dB,\
afade=t=in:st=0:d=0.8,afade=t=out:st=$((TOTAL-2.5)):d=2.5" -ar 48000 -ac 2 musica.wav

# 3. mezcla. normalize=0 es obligatorio: sin eso amix divide por el nº de entradas.
ffmpeg -i voz-proc.wav -i musica.wav -filter_complex \
  "[0:a]aformat=channel_layouts=stereo[v];[v][1:a]amix=inputs=2:normalize=0:duration=longest[m]" \
  -map "[m]" -ar 48000 mezcla-cruda.wav

# 4. loudnorm de la MEZCLA, pasada 1 para medir, pasada 2 con los measured_*.
#    Verificar SIEMPRE que la pasada 2 diga "linear".
ffmpeg -i mezcla-cruda.wav -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=...:\
measured_TP=...:measured_LRA=...:measured_thresh=...:linear=true:print_format=json,\
alimiter=limit=0.891:level=disabled" -ar 48000 -ac 2 audio-final.wav
```

Música a **−33 LUFS** deja una separación de ~16 LU contra la voz, que es lo que se usó en
los tres. Dentro del rango usable (15–20); para moverla, tocar el `volume=` del paso 2.

Verificación que hay que hacer siempre, sobre el archivo escrito y no sobre lo que el
filtro dijo que iba a hacer: los tres videos midieron **−14.00 / −14.00 / −14.02 LUFS** con
true peak entre −1.22 y −2.49 dBTP.

### 10.6 Los mp3 de voz traen padding: anclar cada uno a su clip, no concatenar

Cada mp3 de voz dura entre 26 y 34 ms más que su clip de video. Ese sobrante es padding del
encoder MP3 y es **silencio digital** (medido: −91 a −94 dB en los últimos 40 ms), pero si
se concatenan los audios de corrido el error **acumula** y la voz se despega del video hacia
el final.

Lo correcto es anclar cada audio al offset de su clip y recortar/padear a la duración exacta
del clip (`-af apad -t <dur_del_clip>`). Con eso, video y voz dieron el mismo número al
milisegundo en los tres montajes.

### 10.7 GOTCHA: los tags de un MP3 mienten sobre su origen

**El diagnóstico obvio era el equivocado, y por poco cuesta regenerar toda la voz al pedo.**

Los `audio-clip*.mp3` del cuarto video traían en sus tags `major_brand=isom` y
`compatible_brands=isomiso2avc1mp41`, que es metadata de contenedor **MP4**. La lectura
natural —y la que se hizo primero— fue «esto es el audio extraído de los clips de Flow,
todavía sin pasar por ElevenLabs, hay que generarlo». Era falso: ffmpeg **arrastra el
metadata del contenedor de origen a través de toda la cadena**, y esos tags sobrevivieron a
un paso intermedio ya olvidado.

Lo que lo resolvió fue **medir, no leer los tags**:

| Archivo | RMS |
|---|---|
| `6.mp4` (clip de Flow) | **−46.3 dB** — prácticamente mudo |
| `audio-clip6.mp3` | **−17.2 dB** — voz plena |

Si `audio-clip6` fuera el audio extraído de `6.mp4`, no podría tener voz donde el origen no
la tiene. **Para saber qué hay adentro de un audio se mide el audio; los tags describen por
dónde pasó el archivo, no qué contiene.**

De paso, el hallazgo que salió de esa medición: **un clip de Flow puede volver MUDO**
(`6.mp4`, −46 dB) y nada lo avisa. Por eso ese clip tiene 4 variantes de voz con nombres de
texto distinto (`opcion-A-pero-despues`, `opcion-C-entonces`): hubo que resolverlo por TTS
porque no había audio fuente que convertir. **Medir el RMS de cada clip apenas baja de Flow**
es 2 segundos y evita descubrirlo en el montaje. El script lo imprime.

### 10.8 El generador de subtítulos producía solapes, y su propio comentario decía que no

El `build_ass` propio (heredado de la corrida del 24/08) calculaba el fin de cada evento así:

```js
fin = Math.max(eventos[i+1].w.start, eventos[i].w.start + 0.02)   // MAL
```

El comentario al lado decía *"el fin de cada evento es el inicio del siguiente: por
construccion, cero solapes"*. **No es cierto.** Ese `Math.max` fuerza una duración mínima de
20 ms estirando el fin hacia adelante, y cuando Whisper devuelve dos palabras a menos de
20 ms de distancia el evento se mete adentro del siguiente. Se manifestó en **1 de 3
videos**: 5 solapes, el peor de 220 ms.

Que aparezca en uno de tres es lo peligroso: la verificación del propio script lo atrapó
(por eso existe), pero dos videos pasaron y el bug seguía ahí.

La duración mínima no se resuelve estirando el fin. Se resuelve saneando los inicios y
descartando los eventos degenerados:

```js
for (const e of eventos) e.ini = e.w.start;
for (let i = 1; i < eventos.length; i++)                 // inicios monótonos
  if (eventos[i].ini < eventos[i-1].ini) eventos[i].ini = eventos[i-1].ini;
eventos = eventos.filter((e,i) =>                        // tirar los < 40 ms
  i+1 >= eventos.length || eventos[i+1].ini - e.ini >= 0.04);
for (let i = 0; i < eventos.length; i++)                 // recién ahora, los fines
  eventos[i].fin = (i+1 < eventos.length) ? eventos[i+1].ini : eventos[i].w.end + 0.12;
```

La palabra descartada **sigue apareciendo en pantalla** dentro de su bloque de 3; lo único
que pierde es su turno de resalte amarillo, y a menos de 40 ms eso no se ve. En el video
afectado se fusionaron 8 de 146 eventos.

### 10.9 El voice_id de Mauricio que estaba anotado ya no existe

La memoria tenía `cw1FCBOoMtF4joFyHYy9`. La API responde **`voice_not_found`**. El vigente
es **`dKQBE4K2Lu9KFMvS8sgP`** — «Mauricio Bustos (anuncios 22-08)», que es la re-clonación
desde anuncios del 22/08 (la que la propia memoria dice que salió mejor que la de celular).

Regla que queda: **un voice_id anotado se verifica con `GET /v1/voices/{id}` antes de armar
un lote**, no se asume. Un id muerto no rompe en la primera llamada de un pipeline largo —
rompe después de que ya gastaste el resto. `GET /v1/voices` lista las clonadas con su nombre
y es la forma de encontrar el reemplazo.

Los parámetros que sí siguen valiendo: `eleven_multilingual_sts_v2`, `stability 0.45`,
`similarity_boost 0.85`, y **el STS conserva el texto exacto** (verificado transcribiendo
entrada y salida con Groq y comparando).

### 10.10 Lo que sí funcionó tal como está escrito

- **`ass=...:original_size=720x1280`** — los subtítulos salieron con el tamaño correcto.
- **`Segoe UI Black` en Windows**: verificado en frames extraídos de los tres renders, la
  fuente se aplicó de verdad (no cayó a una genérica). Sigue siendo **fuente propietaria de
  Microsoft y en Linux caería en silencio** — el aviso de §2 y §9.4 sigue vigente para el
  SaaS, donde hay que pasar a Anton o Montserrat ExtraBold. Para el archivo entregado no hay
  problema: rasterizar glifos no es redistribuir la fuente.
- **Groq `whisper-large-v3` con `verbose_json` + `timestamp_granularities[]=word`**. Se
  transcribe la **voz sola, no la mezcla**, para que la música no ensucie los timestamps —
  vale como regla.
- **Transcribir sobre el audio final** (§3). Se comparó contra unos subtítulos generados
  antes sobre una concatenación sin anclar: el desfase real fue de **80 ms máximo, +0.01 s
  de media** — menos de lo que se temía, pero en la dirección esperada. Regenerar cuesta una
  llamada de API; hacerlo siempre.
- **Concat demuxer con `-c:v copy`**: los clips de Flow salen todos con los mismos
  parámetros (h264 High, 720x1280, yuv420p, 24 fps), así que el video final no se recomprime
  hasta el paso de quemar subtítulos.

### 10.11 Licencia de la música usada

`leberch-corporate-509707.mp3` = **«Corporate» de leberch**, Pixabay id 509707
(https://pixabay.com/music/corporate-corporate-509707/). Duración publicada 3:28 = 208.039 s
medidos, coincide. **Sí para entregarle el archivo a Mauricio**, por la §5(b): la concesión
es *"irrevocable, worldwide, perpetual... right to download, use, copy, modify or adapt the
Content for commercial or non-commercial purposes"*, y un anuncio con avatar, voz y
subtítulos no es Standalone. **No para el SaaS**: esa enumeración no incluye `distribute` ni
`sub-license`, y la licencia completa prohíbe *"bulk, large-scale or systematic copying"*.

**Corrección al §5**: el *resumen* de la licencia de Pixabay trae suelta la frase *"You
cannot use that Content for commercial purposes in relation to goods and services"*, que
leída sola mataría el caso. En la licencia completa está condicionada: *"**If Content
depicts any trademarks, logos or brands**..."*. Una pista instrumental no depicta ninguna
marca, así que no aplica — **pero hay que leer `/service/terms/`, no
`/service/license-summary/`**, porque el resumen omite la condición y por sí solo lleva a la
conclusión contraria.

La ficha de evidencia (id, uploader, fecha de descarga, cláusulas) quedó junto al archivo,
en `Escritorio/Mauricio/CUARTO VIDEO DE IA/RECURSOS/AUDIOS/LICENCIA-musica-leberch-corporate.md`,
como pide la §6.

**Sin verificar, y no hay que darlo por bueno:** si esta pista está registrada en el Content
ID de YouTube o en el sistema de derechos de Meta. No se comprobó.

### 10.12 Lo que quedó SIN hacer

- **La separación voz/música (16 LU) no se validó de oído**, solo por medición. Si suena
  tapada o demasiado presente, el número a mover es el `-33` del paso 2 en
  `scripts/montar-anuncio-vertical.sh`.
- **El cuarto video se remontó sin necesidad** (ya estaba terminado). Quedó como
  `CUARTO VIDEO DE IA/Video 4 - FINAL musica Pixabay.mp4`, al lado del original, sin
  pisarlo. Si no sirve, se borra; no hay nada que dependa de él.
- **Ducking (sidechain) de la música bajo la voz**: no se probó. Con música plana a −33 LUFS
  no hizo falta, pero para pistas con más dinámica va a hacer falta.
- **El script asume 7 tomas de 10.005 s** (`NTOMAS`/`DURTOMA` arriba de todo). Para un video
  con otra estructura hay que tocar esas dos variables, no está autodetectado.

---

## 11. El montaje de un anuncio es decidir qué se TIRA (01/09/2026)

La §10 dejó un pipeline que sincroniza bien y suena bien. Martín lo miró y dijo lo único
que importaba: **«que no queden silencios, es un anuncio, eso mata la retención»**. Tenía
razón, y el número era peor de lo que parecía a ojo.

Medido sobre los dos anuncios de 70,04 s:

| | Aire en cabeza y cola | Huecos internos | Total muerto |
|---|---|---|---|
| Video 5 | 5,22 s | 10,44 s | **15,7 s = 22%** |
| Video 6 | 5,49 s | 11,95 s | **17,4 s = 25%** |

**Un cuarto del anuncio era silencio.** Después de cortar: 70,04 → 57,75 s y 70,04 →
59,52 s, sin tocar una sola palabra.

### 11.1 El anclaje de la §10.6 resuelve la sincronía y NO resuelve el ritmo

Son dos problemas distintos y es fácil confundirlos porque el primero se ve arreglado.
Anclar cada voz a la ventana de 10,005 s de su clip garantiza que la voz no se despegue del
video — y **conserva íntegro todo el silencio que la toma traía**. Flow entrega clips de
duración fija; el locutor no llena esos 10 s. Lo que sobra queda adentro.

**La regla:** en un anuncio, el corte no es la operación de pegar la voz al video. Es
decidir qué tramos NO van. El pipeline correcto se queda solo con los tramos donde hay voz y
tira el resto, cabeza, cola y huecos internos por igual.

El corte cae dentro de una toma, así que produce **jump cuts**. En vertical publicitario eso
es el estilo, no un defecto: la cámara está fija y el encuadre no cambia, así que el salto
se lee como ritmo. Verificado en frames a ambos lados de los cortes.

### 11.2 Un corte que ahorra dos décimas no paga su jump cut

La primera versión del planificador cortaba todo silencio de más de 0,20 s. Resultado: 21 y
23 tramos, algunos de **0,25 s** — un parpadeo entre dos saltos, que gana nada.

Dos umbrales, y hacen falta los dos:

- **`MINHUECO`**: si al sacar el silencio los dos tramos quedarían separados por menos
  que esto, no se corta — se fusionan. El ahorro no justifica el salto visual.
- **`MINSEG`**: un tramo más corto que esto se descarta; sería un flash.

> ⚠️ Los valores que se usaron acá (0,30 y 0,35, con `AIRE` 0,11 y umbral fijo de −38 dB)
> **quedaron cortos y hubo que rehacer la entrega**. Los buenos están en 11.8, junto con
> la razón de fondo: el umbral de silencio no puede ser una constante.

Con eso los tramos bajaron de 21→16 y de 23→15, y el ahorro casi no se movió (10,61→10,35 s
y 12,14→10,51 s). **Se perdieron 2 décimas de ahorro y se ganó que se pueda mirar.**

Y la respiración: cada tramo de voz se queda con **0,11 s de aire de cada lado**, así que
entre frase y frase quedan ~0,22 s. Sacar el silencio entero suena atropellado; el silencio
corto es parte del habla, el largo es el que mata.

### 11.3 GOTCHA: `silencedetect` escribe en STDERR

**Esto produjo un informe que decía «0,00 s de aire muerto» en las 14 tomas**, justo cuando
el problema a resolver era el aire muerto. El script parseaba con `execFileSync`, que
devuelve **stdout**, y ffmpeg manda `silence_start`/`silence_end` a **stderr**. Como ffmpeg
sale con código 0, tampoco entra por el `catch`: el parseo encuentra cero coincidencias y
reporta cero silencios. No hay error en ninguna parte.

La firma de este bug es un informe **perfectamente uniforme**: todas las tomas con
exactamente 0,00 y ningún hueco. Un análisis real nunca da tan parejo. **Cuando una
medición devuelve el mismo valor limpio para todas las entradas, el sospechoso número uno
es el parseo, no el material.**

Se resuelve con `spawnSync` leyendo `stdout + stderr`.

### 11.4 `-filter_complex_script` ya no existe (ffmpeg 7+)

En ffmpeg 9.0 la opción fue removida y devuelve `Unrecognized option
'filter_complex_script'`. El reemplazo es la sintaxis genérica de leer el valor de una
opción desde archivo:

```bash
ffmpeg ... -/filter_complex "$T/filtro-video.txt" ...
```

Vale la pena usarla en vez de pasar el filtro inline: con 15–16 tramos el grafo pasa el
millar de caracteres y se vuelve ilegible en la línea de comando.

### 11.5 En un `filter_complex` no se puede usar dos veces el mismo pad de entrada

Una toma con K tramos necesita `split=K` (video) / `asplit=K` (audio) antes de los `trim`.
Escribir `[0:v]trim=...` dos veces sobre el mismo input no funciona. Es obvio una vez que se
sabe y no lo es antes.

### 11.6 Cortar video por frames y audio por muestras NO acumula desfase apreciable

La preocupación razonable: `trim` de video cae en el frame más cercano (41,7 ms a 24 fps) y
`atrim` corta la muestra exacta, así que cada tramo puede quedar hasta medio frame corrido y
16 tramos podrían acumular ~300 ms.

**Medido: 23 ms en 15 tramos** (video 1428 frames / 24 = 59,500 s contra audio 59,523 s).
Muy por debajo del umbral de percepción de desincronía labial. No hace falta compensar nada,
pero sí conviene medirlo cuando cambie el número de tramos o los fps.

### 11.7 Sobre la voz robótica: qué se cambió y qué NO está verificado

Martín escuchó el primer video 5 y marcó que la voz sonaba robótica en algunos puntos. Lo
que se cambió en el STS:

| | stability | similarity_boost |
|---|---|---|
| Antes | 0.45 | 0.85 |
| Ahora | **0.55** | **0.75** |

El razonamiento: un `similarity_boost` alto fuerza el timbre del clon y, cuando el modelo no
puede reconciliar el audio fuente con el objetivo, mete artefactos metálicos. Bajarlo suele
limpiarlos a costa de un poco de parecido.

**NO VERIFICADO: que esta sea la causa real.** Es una hipótesis razonable, no una medición —
no hay forma de medir «robótico» desde acá y quien decide es el oído de Martín. Se le
mandaron 4 variantes de la misma toma (A=0.45/0.85 original, B=0.55/0.75, C=B más
`remove_background_noise=true`, D=0.70/0.65) para que elija.

Un dato que sí quedó medido: **`remove_background_noise=true` cambia la duración de salida**
(9,985 s contra 10,031 s de las otras tres). Con el pipeline de la §10 eso rompía el
anclaje; con el de esta sección da igual, porque los tramos se derivan del audio real.

Y lo que no cambia: el STS **conserva el texto exacto** con cualquiera de los cuatro
ajustes, verificado transcribiendo entrada y salida con Groq.

### 11.8 GOTCHA: un umbral FIJO de silencio no sirve, y verificar el PLAN no es verificar el RESULTADO

**Esto costó una entrega entera.** Con los umbrales de 11.2 el informe decía «se van 10,5 s,
15%» y era verdad. Martín miró el video y dijo *«sigue teniendo muchos silencios»*. Tenía
razón: al medir el archivo entregado con un umbral realista, **quedaban 12,6 s de silencio
en 57,75 s — el 22%, exactamente lo mismo que antes de cortar**.

Dos errores encadenados, y el segundo es el que dejó pasar al primero.

**(a) El umbral fijo de −38 dB medía silencio DIGITAL, no silencio PERCEPTUAL.**

El locutor va manejando. El piso de ruido no es el mismo en todas las tomas — medido en el
mismo anuncio:

| toma | RMS | piso de ruido | separación |
|---|---|---|---|
| 1 | −16,1 dB | **−39,2 dB** | 23,1 dB |
| 2 | −16,4 dB | **−44,3 dB** | 28,0 dB |
| 3 | −18,0 dB | −76,6 dB | 58,7 dB |
| 4 | −25,1 dB | −84,5 dB | 59,4 dB |
| 6 | −17,3 dB | **−47,1 dB** | 29,8 dB |

Con umbral fijo en −38 dB, las pausas de las tomas 1, 2 y 6 **están por encima del umbral**:
tienen ruido de motor, no silencio. `silencedetect` no las ve. Se corta el silencio digital,
queda intacto el perceptual, y el anuncio sigue igual de lento. El barrido lo muestra sin
lugar a dudas: mismo material, solo cambiando el umbral a adaptativo, 65,7 s → 41,1 s.

**La regla: el umbral sale del nivel de CADA toma, no de una constante.**
`umbral = RMS_de_la_toma − 13 dB`, acotado a [−45, −26]. Con eso la toma ruidosa se mide con
−29 dB y la limpia con −38, que es lo que cada una necesita.

**(b) Se verificó el plan, no el producto.** El informe del planificador es una predicción
sobre sus propias reglas: si las reglas están mal, el informe confirma con entusiasmo que se
aplicaron mal. **La única verificación que vale es medir el archivo final** con un umbral
derivado de ese archivo. Está en el pipeline ahora y es lo que hay que mirar:

```bash
RMS=$(ffmpeg -i voz-proc.wav -af astats -f null - 2>&1 | grep -m1 "RMS level dB" | sed 's/.*: //')
U=$(awk -v r="$RMS" 'BEGIN{u=r-13; if(u<-45)u=-45; if(u>-26)u=-26; printf "%.1f",u}')
ffmpeg -i voz-proc.wav -af "silencedetect=n=${U}dB:d=0.12" -f null -
```

**El test de que el corte no se comió voz: transcribir el resultado y contar palabras.**
Es lo que permite ser agresivo sin miedo. En el barrido, las cuatro configuraciones —desde
la conservadora hasta la más brutal— devolvieron **124 palabras, las mismas**. Ninguna tocó
habla. Sin esa verificación no hay forma de saber si un corte agresivo mutiló una sílaba, y
uno se queda corto por las dudas, que es justo lo que había pasado.

Barrido completo sobre el mismo material (70,04 s de origen):

| config | tramos | duración | silencio que QUEDA | palabras |
|---|---|---|---|---|
| umbral fijo (11.2) | 10 | 65,72 s | **28,54 s** | 124 |
| moderado | 22 | 43,84 s | 7,69 s | 124 |
| **agresivo (elegido)** | **27** | **41,09 s** | **3,38 s** | **124** |
| muy agresivo | 29 | 41,38 s | 4,14 s | 124 |

Los valores que quedaron, y que **reemplazan a los de 11.2**:

```
AIRE=0.05   MINHUECO=0.14   MINSEG=0.25   MINSIL=0.10   DELTA=13
```

Resultado final medido sobre los archivos entregados: video 5 **70,04 → 41,09 s con 0,95 s
de silencio (2%)**, video 6 **70,04 → 50,67 s con 0,49 s (1%)**. Contra el 22% y 24% de la
entrega anterior. Un anuncio de respuesta directa termina con **un corte cada ~1,5 s**; eso
no es un defecto del método, es el formato.

### 11.9 Lo que quedó SIN hacer

- **Cuál de las 4 variantes de voz es la buena.** Los videos entregados usan la B por
  apuesta, no por veredicto. Cambiarla son 7 llamadas de API (~1.650 caracteres, nada).
- **Los umbrales están validados por medición, no de oído.** Viven arriba de
  `scripts/plan-cortes-anuncio.mjs` y son lo primero que hay que mover si el resultado suena
  atropellado (subirlos) o todavía lento (bajarlos).
- **Los huecos internos se cortan todos por igual**, sin distinguir una pausa retórica
  (la que hace el locutor antes del giro, que vende) de una pausa muerta. Hoy las trata
  igual. Si alguna vez se come un silencio dramático que hacía falta, ese es el motivo.
- **Nada de esto se aplicó al video 4**, que ya estaba terminado antes y quedó con su
  montaje original.

---

## 12. Lo que arruina un anuncio no es el silencio: es el no-habla CON energía

Martín señaló dos defectos concretos en los videos de la §11, y los dos tenían la misma
causa de fondo, que invalidaba el detector entero:

- *«hay un silencio muy largo previo a "Nadie la vio venir"»* — **no era silencio.** Medido:
  1,36 s con RMS −23 dB y **pico −6,3 dB**. La voz de ese anuncio tiene RMS −17 dB. Era una
  respiración, tan fuerte como el habla.
- *«la IA se traba y dice "eh", muy corto, como un espasmo, y eso hace que el video se vea
  de IA»* — una isla de ~0,2 s a −23 dB entre tramos a −33 dB.

**Un detector de un solo umbral distingue SONIDO de SILENCIO. No distingue HABLA de
NO-HABLA.** Y el no-habla con energía —respiraciones, muletillas, los espasmos del
speech-to-speech— es exactamente lo que delata que un video está hecho con IA. Recortar
silencio digital no lo toca.

### 12.1 GOTCHA grande: los timestamps de palabra de Whisper NO sirven para POSICIONAR

Parecía la solución obvia: si Whisper dice dónde están las palabras, conservar eso y tirar
el resto. **Falla por dos motivos independientes, los dos medidos, y ninguno es evidente.**

**(a) `word.end` está estirado.** Whisper nunca deja huecos entre palabras: alarga la última
palabra antes de una pausa hasta donde arranca la siguiente. En la toma 4 del video 5,
`"apriete,"` figura durando **2,44 s** cuando deja de sonar a los 0,5 s; los otros 2 s son
silencio metido dentro del timestamp de la palabra. Un plan hecho con `word.end` no corta
ni un hueco interno.

**(b) `word.start` está CORRIDO, hasta ~0,6 s en este material.** Whisper ubica `"apagando"`
en 3.24. La energía dice que en 3.24 todavía suena `"terminar"`, que entre 3.42 y 3.82 hay
**silencio real** (−39 a −49 dB) y que `"apagando"` arranca recién en 3.90.

Cortar por esos números parte palabras al medio. Las salidas fueron `"pagando"` por
`"apagando"`, `"quiere"` por `"requiere"`, `"ser"` por `"hacer"`, y `"compromisos"`
directamente desaparecida.

**La regla: la energía POSICIONA (es exacta), Whisper VERIFICA (después).** Al revés no
funciona.

### 12.2 La solución: detector de doble umbral

Dos umbrales derivados del RMS de cada toma, no uno:

| | umbral | para qué |
|---|---|---|
| **bajo** | `RMS − 13 dB` | marca los **bordes** del tramo. Generoso a propósito: una vocal final decae despacio y sigue siendo parte de la palabra |
| **alto** | `RMS − 6 dB` | marca el **núcleo de habla**. Una respiración o una muletilla no llegan; una sílaba sí |

Un tramo del umbral bajo se conserva **solo si contiene algún núcleo del alto**. Y se le
recorta la cabeza hasta poco antes del primer núcleo y la cola hasta poco después del
último, porque **la respiración viaja pegada DENTRO del mismo tramo de energía** que la
palabra: descartar tramos enteros no la saca.

La cola lleva más margen que la cabeza (0,22 s contra 0,07 s) justamente por el decaimiento
de las vocales finales.

### 12.3 Y un caso que ningún umbral resuelve

Al inicio de una toma había un ruido a **−15,7 dB** contra un RMS de voz de −16,4: **más
fuerte que el habla**. Ninguna regla de energía lo separa.

Ese es el único lugar donde Whisper interviene en posicionar, y como **tope grueso**: si el
tramo arranca más de 0,5 s antes del primer `word.start` que contiene, se lo recorta hasta
`word.start − 0,45 s`. El margen de 0,45 existe para absorber el error de Whisper de 12.1(b).
Actúa solo en el caso patológico y no toca el resto.

### 12.4 Contar palabras NO es verificar. Hay que comparar el TEXTO.

**Este error dejó pasar la entrega anterior.** El verificador contaba palabras y decía «124
de 124, intacto». Comparando el texto aparecía esto:

| original | resultado |
|---|---|
| Cambiar eso **requiere** algo | Cambiar eso **quiere** algo |
| que **hacer** responsable | que **ser** responsable |
| estructurar **compromisos** que | estructurar que |

Un corte que se come el ataque de una palabra **mantiene el conteo intacto**. Hay que
diffear las dos transcripciones palabra por palabra. Está en
`scripts/verificar-corte-anuncio.mjs` y devuelve exit≠0 si algo falta o se mutiló.

**Falso positivo conocido, para no perseguirlo:** `"pregunta si"` se transcribe como
`"preguntas i"`. Es coarticulación del reconocedor, no daño. Se distingue mirando si hay un
corte dentro del intervalo: en este caso el tramo `[3.03, 5.96]` contiene las dos palabras
enteras. **Si una diferencia aparece con TODAS las configuraciones, incluidas las que casi
no cortan, es del reconocedor y no del corte.**

### 12.5 Los silencios de 50 ms son oclusivas, no pausas

Buscando el final de cada palabra con `silencedetect ... d=0.05` se detectan las oclusivas
internas: `/p/`, `/t/`, `/g/` dejan 50–80 ms de silencio **dentro** de la palabra. Cortar
ahí parte `"apagando"` en la `/g/` y sale `"dando"`. Una pausa de verdad entre palabras dura
más. El detector de bordes va con `d=0.10` o más.

### 12.6 Resultado

| | origen | §11 (entregado y rechazado) | ahora |
|---|---|---|---|
| Video 5 | 70,04 s | 41,09 s, hueco de 1,36 s | **38,65 s, 0 huecos** |
| Video 6 | 70,04 s | 50,67 s, el "eh" adentro | **48,63 s, 0 huecos, texto intacto** |

«0 huecos» = ningún espacio ≥ 0,30 s entre palabras consecutivas de la transcripción del
resultado. Los dos midieron −14,05 y −14,03 LUFS.

### 12.7 Lo que quedó SIN hacer

- **Nada de esto se validó de oído**, solo por medición. Los umbrales viven arriba de
  `scripts/plan-cortes-anuncio.mjs` y `DELTA_HI` es el primero que hay que mover: bajarlo
  hace el detector más exigente con qué considera habla.
- **El detector no distingue una pausa retórica de una muerta.** Si alguna vez se come un
  silencio dramático que hacía falta antes de un giro, ese es el motivo.
- **Las muletillas que Whisper SÍ transcribe** (un "eh" que llega a texto) no se filtran hoy:
  el filtro por lista de interjecciones se sacó junto con el enfoque por palabras. Si
  aparece una, hay que volver a meterlo.
- **Martín pidió borrar las versiones viejas** de cada video y se hizo. Eso matiza la regla
  de no pisar renders comparables: vale mientras se está comparando, no después de elegir.

---

## Nota de cosecha

Esto tiene que quedar escrito en el repo o se pierde. Sugerencia: `docs/hallazgos-video-pipeline.md`, con entrada en `docs/hallazgos.md` en el mismo commit. Los tres hallazgos que más tiempo van a ahorrar después son: (1) el diagnóstico obvio equivocado — SOUNDRAW y Beatoven parecían resolver el caso "entrega a cliente" y son justo al revés; (2) las tres fallas silenciosas (libass cayendo a otra fuente, `deesser` con `i=0` como no-op, `loudnorm` resampleando a 192 kHz); y (3) la regla que gobierna todo lo nuevo: **la licencia de una herramienta nunca licencia un asset, y el canal de obtención (API/portal) es un contrato distinto de la licencia del archivo**.