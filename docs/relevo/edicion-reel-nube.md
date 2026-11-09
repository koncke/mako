# Relevo — Edición automática del Video Editor, copiada del reel (nube, 9/11/2026)

*Chat de la nube «Video Editor: edición del reel», sesión `cli_cae9a776-2d98-55b4-aef5-3102e4b201b5`, cuenta `nube`.
Rama `punta/edicion-reel-0911` (también `claude/exciting-mccarthy-9rqrau`).*

## El pedido, textual

> «PARA LA EDICIÓN EN MAKO, ESTO QUIERO: https://www.instagram.com/reel/DffGz6yu565/»

El reel quedó bajado en la rama `referencias/reels-0911` (`edicion-mako.mp4`, 12,5 s, 1080×1920, 60 cuadros por segundo).

## Qué muestra el reel, toma por toma

Es UNA toma en mano de un monitor con el editor «Higgsfield Shorts» (proyecto «genjutsu_reels_v1»). Lo que se edita encima es poco;
lo que importa es el editor que se filma.

| Tiempo | Qué se ve |
|---|---|
| 0,0–9,5 s | El monitor. Encima, fijos: dos logos (Claude y Higgsfield) y la placa «Fable 5.2 + Higgsfield MCP = 🔥» (blanco sobre negro, redondeada). En el editor: «editing live · autosaved», una fila de puntos de colores y «16 agents live». Cursores de colores con nombre («broll-01», «caps-02», «mix-01», «razor-02», «grade-01», «gfx-01») se mueven por el reproductor, la línea de tiempo y los controles. |
| 0,5–2,5 s | En el reproductor, un subtítulo se escribe letra por letra mientras el cursor de «caps-01» lo tipea: «screen r…» → «screen recordings» → «screen recordings appear», en minúsculas, letra gruesa, la última palabra en lima. |
| 3,0–4,5 s | «A/B testing caption fonts…»: el mismo subtítulo cambia a «SCREEN RECORDINGS APPEAR» en marcador, después en Bebas Neue sobre una caja oscura con «APPEAR» en amarillo, con el recuadro de selección («340 × 182»). Arriba aparece una tarjeta flotante con una grabación de pantalla, borde lima («masked card»). |
| 5,0–7,5 s | Cortes a otras tomas (un primer plano de perfil, un collage de papel rasgado con fotos). El registro «SWARM ACTIVITY» corre: «02:18 razor-02 removed breath», «grade-02 exposure +0.3», «mix-01 whoosh_01.wav @ 03:00», «caps-02 karaoke highlight», «broll-01 placed b-roll @ 10:17», con «52 ops/s» en lima. A la derecha, «SWARM» con una barra por tipo de agente, y «LOUDNESS · VOICE · MUSIC · INTEGRATED −14.1 LUFS». |
| 8,0–9,5 s | «playing final cut»: los agentes pasan «QA ✓ 02:07», «QA ✓ 01:20», «playback · final review». El subtítulo final: «screen / recordings / appear», en minúsculas y escalonado. |
| 9,5–12,5 s | Corte a la misma toma más abierta; placa lima «Comment "Shorts" and I'll DM you link!». |

**Sonido:** música con golpes, sin voz (no hay Whisper en la nube; el espectro muestra golpes rítmicos y el cambio de bajo en el
corte de 9,5 s, no formantes de voz).

## Qué existía, qué faltaba, qué se copió

| Del reel | En MaKo antes | Ahora |
|---|---|---|
| Un equipo de agentes que edita todo de una | Cada cosa por separado (botones y chat) | **«Edición automática»**: diez agentes en orden |
| «removed breath», «ripple delete» (razor) | «Borrar silencios» | corte-01 quita las pausas de la principal |
| Subtítulos que se escriben solos (caps) | Subtítulos automáticos (Whisper en el navegador) | subs-01, si no hay subtítulos |
| «A/B testing caption fonts…» | Plantillas de subtítulos, a mano | subs-03 prueba «Lima», «Recuadro Bebas» y «Marcador», mide renglones y se queda con la primera que entra |
| Las tres letras del reel | No estaban | Plantillas «Lima» (minúsculas, sin caja), «Recuadro Bebas», «Marcador» |
| «karaoke highlight», la palabra en lima | Palabras clave con color | subs-02 las resalta en el lima del reel |
| Sacar muletillas (retimed word, trimmed frames) | «Eliminar las muletillas» | corte-02 |
| «placed b-roll @ 10:17» | «B-roll de MaKo» (Pexels) | broll-01 lo propone (punteado, se deja o se saca) |
| «pop-in», acercamientos (gfx) | Cambios de plano («Acercar») | gfx-01 los propone |
| «de-essed voice», «compressor 3:1» (mix) | «Reducir el ruido» | mezcla-01 |
| «INTEGRATED −14.1 LUFS» | «Normalizar» con objetivo YouTube (−14) | mezcla-02 |
| «QA ✓», «playing final cut» | No estaba | qa-01 mide huecos, subtítulos que se pisan y volumen; «Reproducir el corte final» |
| Cursores con nombre que van a donde trabajan | No estaba | Un cursor por agente, al segundo del video o a su panel |
| «SWARM ACTIVITY» con la hora y «52 ops/s» | No estaba | Panel «Edición automática» en Multimedia: agentes con barras y registro |
| «editing live · autosaved» · «16 agents live» | «Guardado automático» | Pastilla «N agentes en vivo» arriba mientras trabajan |
| Deshacer | Ctrl+Z, de a un paso | «Deshacer todo» (si nadie tocó el editor mientras trabajaban ni después; desde el chat, «Restaurar») |

Por chat: «edítalo todo» → `edicion_automatica`. Por la API de MaKo: `editar_video_automatico` (propone; se acepta en el editor).

## Tandas

1. **Hecha — el motor y el panel.** `app/video-editor/_opencut/enjambre/{plan,estado,correr,registro}.ts`, el panel
   (`components/enjambre-view.tsx`), la pastilla (`components/en-vivo.tsx`), la operación del chat y de la API, `profundidad()` en el
   historial de comandos.
2. **Hecha — los cursores.** `enjambre/cursores.ts` (puro) y `components/cursores.tsx`; los paneles marcados con `data-ce-zona` y la
   línea de tiempo con `data-ce-pps`.
3. **Hecha — los estilos del reel y la prueba de estilos.** Tres plantillas en `subtitles/estilos.ts`, «minúsculas» en los presets,
   el agente subs-03.
4. **Hecha — la revisión adversarial.** Un lector que no escribió el código encontró doce cosas; las arreglé con su test (detalle en
   `docs/hallazgos-video-editor.md`, «Lo que encontró la revisión adversarial»): no cortar pausas debajo de subtítulos que ya estaban,
   no renormalizar a −14 lo que la persona puso en otro objetivo, distinguir «no había nada» de una falla, marcar lo propuesto sin
   decidir, no ofrecer «Deshacer todo» si la persona tocó el editor en el medio (ni cuando la corrió el chat), vaciar «Rehacer» después
   de cada prueba de estilos, no guardar el estilo elegido como la plantilla de la persona, el `try` del chat y el panel.
5. **Sin hacer** (lo del reel que todavía no está, en orden de cuánto se ve):
   - el medio del B-roll que se bajó queda en Multimedia después de «Deshacer todo» (sin usar; no rompe nada);
   - el subtítulo ESCALONADO («Stagger Stack»: cada renglón corrido): pide medir y dibujar renglón por renglón en `text/dibujar.ts`;
   - el agente de color (exposición, grano, sombras): hace falta MEDIR la luz de un cuadro antes de tocar nada;
   - el «whoosh» en los cortes: no hay una biblioteca de efectos de sonido con licencia elegida;
   - la tarjeta flotante con una grabación de pantalla («masked card») y el collage de papel rasgado;
   - los monitores (forma de onda, vectorscopio) y la lectura de LUFS integrados en pantalla;
   - los agentes en PARALELO: acá van de a uno, porque dos comandos sobre la misma línea de tiempo a la vez se pisan.

## Lo que falta verificar

**Nada se miró en un navegador** (la nube no corre el editor) **ni se corrió con la IA real** (el B-roll usa la IA del negocio). Lo
primero, en el Chrome de Martín, en el ws9 o el Cliente de Prueba (ws3), nunca el ws1: un video vertical con voz, «Edición
automática», mirar que el registro y los cursores acompañen a cada paso, que la prueba de estilos se vea en el reproductor y no
quede en el historial, «Deshacer todo», y por el chat «edítalo todo» → Aceptar → «Restaurar».

## Tests

`tests/video-editor-enjambre.test.ts`: 14 casos, 33 roturas (la tabla está al final del archivo). Se tocaron por «foto»:
`tests/video-editor-clips.test.ts` (la última operación de la API) y `tests/doer-recetas-video-imagen.test.ts` (40 escrituras).

## El VERDE

(se completa al subir)
