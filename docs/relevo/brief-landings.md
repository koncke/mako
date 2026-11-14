BRIEF COMÚN DE LAS LANDINGS (14/11/2026, noche). Tu pedido te dio NOMBRE, SLUG, ARCHIVO, REF y URL: reemplázalos abajo.

Trabajas en el worktree C:/dev/wt-landings-vsl. Es el repo de MaKo, en Next.js + TypeScript: un software en español para vender servicios high ticket.
- No hagas commit, stash ni reset, y no cambies de rama: los commits los hago yo.
- Escribe en español neutro, con «tú» y nunca «vos». Martín, el dueño, lee la landing.

TU TAREA: que la landing de NOMBRE de MaKo (`/vsl/SLUG`) quede como una copia FIEL de su referencia, REF (URL).
- Hay que copiar la estructura, el orden de las secciones, la tipografía y los tamaños, las animaciones, los hovers, los botones, los videos y los efectos de scroll.
- El contenido y las pantallas son los de MaKo.
- Martín, textual: «quiero que te concentres en que la copia salga muy fiel a todas las animaciones y cosas que tiene la landing original… que te fijes muy al detalle todo, pero absolutamente todo. Tanto los videos que tienen, las animaciones, los hover, todo, absolutamente todo… Quiero que te asegures al 100% de que lo estás replicando bien».

DÓNDE ESTÁ NUESTRA LANDING:
- Datos y textos: `app/vsl/_competencia/ARCHIVO.ts`. Lee el comentario de arriba: qué se cambió de la referencia y por qué.
- Diseño propio: `app/vsl/_competencia/disenos/ARCHIVO.tsx`. Los valores medidos están en `docs/diseno/landings-competencia/ARCHIVO.md`.
- Registro: `app/vsl/_competencia/registro.ts`.
- Ya hechas fieles esta noche, como modelo (todas con scripts `data-visor=""`, los únicos `<script>` que el visor no borra):
  - `disenos/competitor-spy.tsx` (pestañas con video, lluvia, órbita);
  - `video.tsx` (vitrina, comparador);
  - `ai-avatar.tsx` (reproductor, cinta);
  - `image.tsx`, `ads.tsx`, `copywriting.tsx`;
  - `offer.tsx` (video que flota al bajar).
- ANTES DE EMPEZAR lee en `docs/hallazgos-landing.md` las entradas del 14/11 noche (de «Competitor Spy como Foreplay» en adelante). Las trampas que ya costaron:
  - Una referencia que parece animada puede ser quieta, y una que parece quieta puede tener un video que flota: mide qué se mueve con `getAnimations()` en cada paso del scroll.
  - Un hover que está en el CSS puede no verse: mide el estilo calculado antes y después.
  - La referencia cambia de versión (`?ver=`, secciones `hidden`, cambios en días): mide hoy y mira el DOM.
  - El sol y la luna lee los colores una sola vez: lo que debe quedar igual en los dos modos va con `data-tema-fijo`, y su oscuro se escribe con `html[data-sitio-modo="oscuro"]`. Los bordes al 10 % desaparecen: van opacos.
  - `pulir.mjs` congela lo que hace el script: el script limpia su estado y no corre dos veces.
  - Un `margin-top` arriba de una sección se escapa: va `padding`.
  - Un botón sin JavaScript es una casilla o un `<details>`; un `<button>` sin `onClick` lo marca `tests/ningun-boton-muerto.test.ts`.
  - Las marcas del grabador no tienen desfase fijo con el video: el corte se mide en el video. Una toma con cámara arranca con `g.camara(null, 0)`.
  - Con `isMobile: true`, una página sin `<meta viewport>` sale como escritorio achicado: para el teléfono, ventana chica sin `isMobile`.
- Notas: la carpeta C:\Users\marti\AppData\Roaming\Claude\side-session-notes\local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8\. Mira `referencias-landings/offer/` como ejemplo de relevo.

DATOS Y CONTENIDO:
- Ejemplos de Alex Hormozi (`C:/dev/bancos-portada/banco-spy-gurus/hormozi.json`) o negocios y contactos inventados (como «Cierre Consultivo», el de las plantillas). NUNCA datos de un cliente.
- NO generes imágenes ni videos con IA (Flow, ApiMart ni ningún otro).
- No dispares la IA de producción ni leas la base de producción. Si una pantalla necesita una respuesta de la IA, se escribe a mano en el banco y dice lo que MaKo de verdad contesta.
- No uses las imágenes de `public/formatos/presets/` (la cara puede ser de un cliente) ni fotos de Martín.
- El caso de Mauricio (testimonio) ya está aprobado donde la landing lo tenía; no lo sumes en lugares nuevos.
- Lo que es sólo de MaKo Pro (`FUNCIONES_SOLO_PRO` y `TABS_SOLO_PRO` en `lib/topes-plan.ts`) se dice «Con MaKo Pro».

CÓMO TRABAJAR:
1. **Mira el original DE VERDAD.**
   - Chromium headless con Playwright: `file:///C:/dev/playwright-medidor/node_modules/playwright-core/index.mjs`.
   - Ábrelo a 1440×900 y a 390×844 y recorre la página entera con scroll lento.
   - Saca capturas por sección y graba en video lo que se mueve; mira cada video cuadro a cuadro antes de decidir qué va en su lugar.
   - Lee los estilos calculados de botones, tarjetas y hovers. Su CSS se puede bajar con `curl` si no lo frena Cloudflare.
   - Escribe el relevo en `referencias-landings/SLUG/`, en la carpeta de notas: un `relevo.md` y las capturas.
   - NO copies sus imágenes ni sus videos a nuestro sitio.
2. **Compara con la nuestra.**
   - Arma la página como el visor: `bash C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/9a7853cb-6cac-4c84-a5da-bf1668acb93f/scratchpad/mirar/armar-v2.sh "C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/9a7853cb-6cac-4c84-a5da-bf1668acb93f/scratchpad"`.
   - Queda en `…/scratchpad/visor-v2/paginas/SLUG.html` y `SLUG-tel.html`. Si falla porque otra tarea arma al mismo tiempo, reintenta.
   - Haz la lista de diferencias.
3. **Implementa hasta que se parezca.**
   - Script chico con `data-visor=""`; respeta `prefers-reduced-motion`.
   - Las pantallas son las REALES, grabadas en un banco de `C:/dev/bancos-portada/` (componentes reales con esbuild; cámara y cursor en `grabador.mjs`), con la cámara acercándose a lo que pasa.
   - El bucle se arma con `codificar-bucle.sh` (`TAM=960:540` para 16:9). El póster es el PRIMER cuadro, y dos videos no arrancan en el mismo cuadro.
4. **Mira y critica** a 1440 y a 375, en claro y en oscuro, antes de entregar.

REGLAS:
- **RAM:** la PC tiene 16 GB y muchos chats abiertos.
  - Antes de CADA navegador, 3 GB libres o más: `powershell -NoProfile -Command "[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,1)"`.
  - Un navegador a la vez, headless, con `--mute-audio`; ciérralo apenas termines.
  - Nunca mates procesos por nombre.
- **Candado** C:/dev/bancos-portada/.grabando:
  - Tómalo sin pisar: `(set -o noclobber; echo "landing-SLUG $(date +%H:%M)" > C:/dev/bancos-portada/.grabando)`. Si falla, espera con un chequeo cada 30 s y avanza con lo que no necesita navegador.
  - Bórralo SÓLO si empieza con `landing-SLUG`.
- **Sin inventar:** el texto no promete lo que MaKo no hace. Si la referencia muestra algo que MaKo no tiene, no lo dibujes: dilo en el reporte.
- **Texto corto**, sin subtítulos chicos de relleno. Las preguntas frecuentes son las de la portada (`LandingCompetencia.tsx` ya las fuerza).
- **Tests:**
  - Corre de a uno los que nombran tus archivos (`tests/vsl-landings-competencia.test.ts`, `tests/ningun-boton-muerto.test.ts`; búscalos con grep): `cd C:/dev/wt-landings-vsl && node --import tsx --test tests/<x>.test.ts`.
  - Nunca la suite entera ni el `tsc` del proyecto.
  - Antes de cambiar una línea que un test lee como texto, busca ese pedazo literal en tests/.
  - Un template literal de CSS no lleva comillas invertidas en sus comentarios.
  - Otras tareas tocan `tests/vsl-landings-competencia.test.ts`, `LandingCompetencia.tsx`, `docs/hallazgos-landing.md` y `docs/hallazgos.md`: ediciones chicas, sin pisar lo suyo.
  - Tu test nuevo va en `tests/vsl-landings-competencia.test.ts` RECIÉN AL FINAL, cuando todos tus archivos ya existen en disco. El filtro de la subida corre los tests sobre el disco: un test tuyo que pide un video que todavía no grabaste frena las subidas de todas las demás landings.
- **Cosecha:**
  - UNA entrada al final de `docs/hallazgos-landing.md`, que empiece con `## NOMBRE como REF`.
  - Su línea al principio de la fila «Landing / VSL» de `docs/hallazgos.md`, que empiece con `**NOMBRE como REF`.
  - Si un hallazgo vive en el código de otra área, dilo en el reporte con su archivo.

AL TERMINAR, devuelve:
(a) los archivos que cambiaste y los videos nuevos;
(b) sección por sección: qué quedó igual, qué no y por qué;
(c) los tests que corriste, con su resultado;
(d) los HALLAZGOS en 5 líneas;
(e) lo que queda para que decida Martín.
