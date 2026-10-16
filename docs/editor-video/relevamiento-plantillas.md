# Plantillas propias del Video Editor — de dónde se copian

*15/10/2026, chat «Video Editor», cuenta claude1.*

**Lo que decidió Martín** (por «Estrategia 3 cuentas»), textual: «Si, plantillas propias e investiga SIEMPRE
investiga en la web para copiar o sacar de otros lugares.» Las de CapCut son su catálogo y no se copian. Lo que sí
se copia es cómo funcionan; y el contenido sale de fuentes que se pueden usar, investigadas antes de crear nada
(AGENTS.md → «NINGUNA pantalla se diseña de cero»).

## Qué es una plantilla en CapCut

En CapCut, «Plantillas» es una pestaña de la biblioteca (`relevamiento-capcut-funciones.md` §1.1). Cada plantilla
es un video ya editado: textos animados, transiciones, efectos y música. Tiene **huecos** donde va el material de
la persona: elegís una, ponés tus clips y tus textos, y queda armada.

## Lo que se investigó (15/10)

| Fuente | Qué tiene | Licencia, verificada | Qué se puede tomar |
|---|---|---|---|
| **CapCut** | El catálogo y la pestaña | Propiedad de ByteDance | **Cómo funciona**: elegir, ver la muestra, «Usar plantilla», reemplazar los huecos. Nada del contenido |
| **reactvideoeditor/remotion-templates** (GitHub) | **81 plantillas en 9 familias**: texto (máquina de escribir, glitch, rebote, resaltado), títulos y cierres (lower third, end card, quote card, cuenta regresiva, créditos), logos (9 revelados), transiciones, cinemáticas (Ken Burns, sacudida, letterbox), fondos, gráficos, imagen (split screen, comparador, carrusel) | El README dice «MIT», pero **no hay archivo `LICENSE`** (404 en `main/LICENSE`). Y el código es para Remotion, que es source-available, no abierto | **La idea y los tiempos** de cada plantilla (qué hace, cuánto dura cada parte). El código no: no corre en nuestro motor y su licencia no está en un archivo |
| **Shotstack** (Studio y API) | Una galería de plantillas en JSON (reseña de hotel, intro de noticias, inmobiliaria) y una colección pública de ~90 ejemplos JSON | Sin licencia publicada para las plantillas | **El formato**: una plantilla es el JSON de una edición con campos reemplazables («merge fields»). El contenido no |
| **Creatomate** (RenderScript) | Plantillas JSON; a una plantilla se le pasan `modifications` con el nombre de cada hueco | Documentación pública; las plantillas son suyas | **El mismo modelo**: huecos con nombre que se reemplazan. El contenido no |
| **LottieFiles** (animaciones gratis) | Miles de animaciones vectoriales | «Lottie Simple License»: uso comercial sí, pero **prohíbe juntarlas en un servicio que compita** y redistribuirlas sueltas | **NADA para el catálogo.** Una persona puede importar una en su proyecto; MaKo no puede traer una colección |
| **Formato del borrador de CapCut** (pyJianYingDraft, capcut-cli) | `draft_content.json` hecho por ingeniería inversa: tiempos en microsegundos, coordenadas desde el centro | Herramientas de terceros; el formato no tiene una especificación oficial | **Confirmar cómo se guarda un hueco**, si hace falta |

## La propuesta: qué se copia de cada lado

1. **La pantalla, de CapCut**: la pestaña «Plantillas» de la biblioteca, con una grilla de muestras en video; al
   pasar el mouse, se reproduce. «Usar plantilla» y los huecos marcados para reemplazar. Para eso hace falta
   «Reemplazar el clip», que hoy está apagado (`timeline-element.tsx`). Es una fila del inventario y sirve también
   fuera de las plantillas.
2. **El formato, de Shotstack y Creatomate**: una plantilla es un proyecto nuestro (la línea de tiempo en JSON)
   con huecos con nombre: «tu clip», «el gancho», «el llamado a la acción». Así la API de MaKo y el chat pueden
   decir «usá la plantilla Testimonio con este clip y este texto».
3. **El contenido, propio, con las ideas de las 81 de Remotion**: lo que se arma con las piezas que el editor ya
   tiene (textos con animación, formas, transiciones, plantillas de subtítulos). Las primeras cinco, pensadas
   para anuncios en 9:16:

| Plantilla propia | Arma | Idea tomada de |
|---|---|---|
| Anuncio con gancho | Texto gancho arriba (0–2 s), el clip, subtítulos automáticos y una tarjeta final con el llamado a la acción | Popping Scale Text · End Card |
| Testimonio | Cita en tarjeta, nombre en un lower third y subtítulos | Quote Card · Lower Third |
| Antes y después | Pantalla partida, o un comparador que se desliza | Split Screen · Image Comparison Slider |
| Beneficios | Lista que aparece punto por punto sobre el clip | Animated List · Text Highlight |
| Oferta con cuenta regresiva | Cuenta regresiva y llamado a la acción | Countdown Timer · End Card |

**Lo que falta en el motor para algunas**: ~~la máquina de escribir, el glitch y el comparador no existen~~ —
corregido el 15/10: la máquina de escribir (`animaciones/catalogo.ts`, entrada `maquina-escribir`) y el glitch
(transición y efecto) SÍ existen; sólo falta el comparador deslizante. Ninguna se hace con material de
LottieFiles.

## Lo que decidió Martín (vía «Estrategia 3 cuentas», 15/10)

- Arrancan estas cinco, con lo que el editor ya tiene; las que piden máquina de escribir, glitch o comparador
  esperan.
- Música: no hay biblioteca con licencia (`lib/musica-catalogo.ts`), así que las plantillas salen sin música o
  con la que ponga la persona.
- El plan de construcción: [plan-plantillas-anuncio.md](plan-plantillas-anuncio.md).

## Investigado el 15/10 (cuenta 3), para armarlas

- **La estructura de un anuncio vertical** ([influee, «raw UGC to ads»](https://influee.co/ie/blog/raw-ugc-to-ads);
  [Tiger Pistol, vertical video best practices](https://tigerpistol.com/vertical-video-ad-best-practices/)): gancho
  en 1–3 s (en Shorts se decide en 2 s), el problema en una línea, la solución mostrándola, un solo llamado a la
  acción. Cambio de escena cada 2–3 s. Texto en pantalla de 5 palabras o menos. Nada de logo ni zoom lento en el
  primer segundo.
- **Zonas seguras de Meta en 9:16** (1440x2560, cambio de marzo de 2026; verificarlo contra la documentación de
  Meta antes de fijarlo): lo importante fuera del 14 % de arriba, del 20–35 % de abajo y del 6 % de cada costado.
- **El formato con huecos** ([Creatomate, template modifications](https://creatomate.com/docs/fundamentals/getting-started/template-modifications)):
  la clave es `nombre-del-elemento.propiedad`; sin propiedad, la principal (el texto en un texto, la fuente en un
  archivo); y `{{nombre}}` adentro de un texto se reemplaza solo.
- **Cómo se ve el karaoke en las apps** (para las plantillas de subtítulos que acompañan): ver la sección del
  karaoke en `docs/hallazgos-video-editor.md`; los colores se eligieron a ojo.
