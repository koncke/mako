# Remotion para la tab Video: el relevamiento (11/11/2026)

**El pedido (Martín, 11/11/2026):** «que aplique al 100 % esto de Remotion… ya de por sí tienen un montón de templates…
que el usuario pueda editar en la nube gracias a Remotion, porque hoy al entrar a editar la pestaña de video se traba bastante
por la RAM… si cada usuario trae su propia API… aprovechar todos los efectos, transiciones».

Leído el 11/11/2026: remotion.dev (docs, licencia y sus preguntas frecuentes), remotion.pro (precios, Editor Starter) y el repo
`remotion-dev/remotion` (la lista de paquetes y de transiciones sale de ahí, versión 4.0.542). Lo que no se pudo confirmar va
marcado.

---

## 1. Lo que Remotion ES, y lo que NO es

- **Es** una forma de hacer videos con React: cada video es un componente (una «composition») que recibe sus datos
  (`inputProps`) y dibuja cada cuadro con HTML, CSS, SVG o WebGL.
- **Para verlo:** el `<Player>` (`@remotion/player`) lo reproduce en la página.
- **Para sacar el archivo** hay tres caminos:
  - en un servidor con Chrome;
  - en la nube de AWS, con Lambda (`@remotion/lambda`);
  - o en el navegador (`@remotion/web-renderer`, estable desde la 4.0.491).
- **NO edita en la nube.** Lo que va a la nube es el RENDER (la exportación). La vista previa mientras se edita corre siempre
  en el navegador de la persona, con el `<Player>`. Que «la pestaña se trabe por la RAM» es la VISTA PREVIA y la
  decodificación de los clips. Lambda saca de la PC el momento de exportar, que hoy también pesa (el editor exporta en el
  navegador), pero no la edición.
- **NO es un editor.** Es el motor. El editor que venden aparte (el Editor Starter, §5) es un punto de partida, y según sus
  propios docs no trae fotogramas clave, transiciones, manejo de proyectos ni teléfono.

## 2. La licencia y lo que cuesta (lo que decide Martín)

Del `LICENSE.md` del repo y de las preguntas frecuentes de la licencia (remotion.dev/docs/license/faq):

| Caso | Licencia | Precio |
|---|---|---|
| Una persona, o una empresa de **hasta 3 personas** (se suman los freelancers y agencias que trabajen en el proyecto) | **Free License**: todo, también comercial | **US$ 0** |
| Una empresa de **4 personas o más** que hace un editor de video, renderiza para sus clientes o usa el `<Player>` | **Remotion for Automators** | **US$ 0,01 por render, con un mínimo de US$ 100 por mes** (10.000 renders) |
| Uso manual en Remotion Studio (diseñar a mano, poco volumen) | Remotion for Creators | US$ 25 por mes por persona |
| Canal privado, consultoría y el Editor Starter incluido | Enterprise | desde US$ 500 por mes |

- **Permitido:** un SaaS donde cada cliente arma y renderiza SU video sobre plantillas nuestras. Su ejemplo: «permitir a los
  usuarios crear y renderizar su propio video personalizado con tu plantilla».
- **Prohibido:** vender Remotion como producto, o dejar que los usuarios suban su propio código de Remotion para renderizarlo.
- **Qué cuenta como un render:** cada video, audio, GIF, imagen o secuencia que se genera, en la nube O en el navegador. Las
  vistas previas en el Player no cuentan. En el render del navegador hay telemetría que no se puede apagar (cuentan por
  dominio).
- **Con la cuenta de AWS del cliente** (BYOK): sus preguntas frecuentes no lo dicen. El render igual se hace con código de
  MaKo, así que la obligación de la licencia es de MaKo, no del cliente.
- **El render en la nube cuesta aparte:** lo cobra AWS a la cuenta donde corre. Remotion dice «unos centavos por varios
  minutos», y cada render muestra antes su costo estimado.

## 3. El render en la nube con la cuenta de cada usuario (BYOK)

**Lambda (AWS)** es el camino vigente. **Cloud Run (Google)** está en alfa y, según su página, «no se está desarrollando
activamente»: no conviene.

- **Lo que Lambda necesita en la cuenta del cliente:**
  - un usuario IAM con permisos mínimos (Remotion da la lista);
  - una función Lambda con Chromium (la capa la aloja Remotion);
  - un bucket S3 donde va el proyecto como sitio web, los renders y sus datos.
- **Cómo funciona:** `deployFunction` y `deploySite` dejan todo armado una vez. Después `renderMediaOnLambda` reparte el
  video en muchas Lambdas en paralelo (hasta 1.000 por región, por defecto), junta las partes y deja el MP4 en S3.
  `getRenderProgress` dice cómo va.
- **Límites:**
  - 15 minutos por render;
  - hasta ~2 h 40 min de Full HD con 10 GB de disco (el defecto desde Remotion 5.0);
  - sin AV1.
- **⚠️ Credenciales por cliente:**
  - Remotion lee las claves de AWS de variables de entorno (`REMOTION_AWS_ACCESS_KEY_ID` y
    `REMOTION_AWS_SECRET_ACCESS_KEY`, que ganan sobre las `AWS_*`).
  - `renderMediaOnLambda` no tiene una opción para pasar credenciales por llamada (revisada su lista de opciones entera).
  - Con varios clientes a la vez en el mismo proceso del servidor, cambiar el entorno por pedido se pisa. Hay que correr cada
    render en un proceso aparte con el entorno de ESE cliente, o asumir un rol con STS por cliente.
  - Hay que medirlo con una cuenta de prueba antes de diseñar la pantalla.
- **Integraciones (como todo BYOK de MaKo):** la clave de acceso y el secreto de AWS del cliente, cifrados igual que las
  otras, más la región. Con la primera clave, MaKo deja la función y el sitio armados en SU cuenta.
- **Sin cuenta de AWS:** queda el render en el navegador (`renderMediaOnWeb`, WebCodecs), que no necesita servidor pero usa la
  PC del cliente, o sea, no resuelve la queja de la RAM.

## 4. Lo que trae, y dónde iría en MaKo

### Transiciones (`@remotion/transitions`, 21 en el repo)

`blur-slide`, `book-flip`, `clock-wipe`, `cross-zoom`, `crosswarp`, `cube`, `dissolve`, `dreamy-zoom`, `fade`, `film-burn`,
`flip`, `iris`, `linear-blur`, `none`, `push-cut`, `ripple`, `slide`, `swap`, `wipe`, `zoom-blur`, `zoom-in-out`. Se combinan
con un tiempo (resorte o lineal) dentro de un `<TransitionSeries>`.

**Dónde:** la pestaña Transiciones del editor ya tiene las de CapCut. Las de Remotion son componentes de React que dibujan
con CSS, SVG o WebGL. El motor del editor (OpenCut, sobre canvas y WebGPU) no las puede dibujar tal cual: o se reescriben en
el motor (copiar su cuenta, que la licencia permite mientras no se venda Remotion como producto), o el video se arma con
Remotion (§6).

### Efectos (paquetes del repo, todos 4.0.542)

| Paquete | Qué hace | Dónde iría |
|---|---|---|
| `@remotion/effects` | Efectos para componentes de canvas | Efectos del editor |
| `@remotion/light-leaks` | Destellos de luz | Efectos / Transiciones |
| `@remotion/motion-blur` | Desenfoque de movimiento | Animaciones, motion |
| `@remotion/noise` | Ruido para mover cosas «orgánicamente» | Motion |
| `@remotion/starburst` | Rayos de fondo | Fondos, motion |
| `@remotion/shapes` y `@remotion/paths` | Formas y trazos SVG animados | Motion graphics |
| `@remotion/rough-notation` | Subrayados y círculos «a mano» | Resaltar palabras |
| `@remotion/rounded-text-box` | La caja de texto redondeada de TikTok | Subtítulos y textos |
| `@remotion/animated-emoji` | Los emojis animados de Google | Stickers, emojis de subtítulos |
| `@remotion/sfx` | Biblioteca de efectos de sonido | Audio › Efectos de sonido |
| `@remotion/lottie`, `@remotion/rive`, `@remotion/gif`, `@remotion/three`, `@remotion/gsap` | Animaciones de terceros y 3D | Stickers y motion |
| `@remotion/captions` | Primitivas de subtítulos (páginas a lo TikTok) | Subtítulos |
| `@remotion/whisper-webgpu`, `@remotion/whisper-web` | Transcribir en el navegador | Ya lo hace el editor (Whisper) |
| `@remotion/video-matting` | Separar a la persona del fondo, en el navegador | «Eliminar fondo» |
| `@remotion/google-fonts` | Las fuentes de Google | Ya está en el editor |

### Plantillas (remotion.dev/templates: 23, 20 gratis)

| Plantilla | Qué es | Sirve para MaKo |
|---|---|---|
| TikTok | Subtítulos palabra por palabra | La galería de subtítulos (ya hay «Hormozi», «Lima»…) |
| Audiogram / Music Visualization | Texto y la onda del audio | Clips de podcast: una plantilla nueva de «Nuevo video» |
| Prompt to Video | Historia con imágenes y voz desde un pedido | «Generar con IA» |
| Prompt to Motion Graphics | Animaciones desde un pedido | Motion por chat |
| 3D, Skia, Code Hike, Stills, Overlay, Stargazer | Demostraciones | Poco |
| Next.js, React Router, Render Server, Electron | Arranques de app | Referencia para el render |
| Editor Starter (US$ 600) y `<Timeline />` (pagas) | Un editor y una línea de tiempo | Ver §5 |

Son proyectos de código, no «plantillas» como las de CapCut. Cada una es un componente que recibe datos. Para usarlas en MaKo
hay que correr Remotion (el `<Player>` para verla y un render para sacarla).

## 5. El Editor Starter, contra el editor de hoy

| | Editor de MaKo hoy (CapCut sobre OpenCut) | Editor Starter |
|---|---|---|
| Línea de tiempo, pistas, recortar, dividir, imán | Sí | Sí |
| Fotogramas clave | Sí | **No** («las propiedades no se animan») |
| Transiciones | Sí (las de CapCut) | **No** |
| Subtítulos automáticos | Sí (Whisper, en el navegador) | Sí (Whisper) |
| Varios proyectos, guardado automático | Sí | **No** (uno, guardado a mano) |
| Teléfono | Sí (`/m/video-editor`) | **No** |
| fps distintos | Sí | **No** (30 fijos) |
| Chat de MaKo, edición automática, B-roll, motion | Sí | No |
| Render en la nube | No | Sí (Lambda) |
| Precio | — | US$ 600, o incluido en Enterprise |

**Conclusión:** cambiar el editor por el Editor Starter es ir para atrás en casi todo, para ganar una sola cosa: el render en
la nube. Conviene sumar Remotion a lo que hay, no reemplazarlo.

## 6. La recomendación: tres partes, de menos a más

1. **Las plantillas de Remotion como plantillas de «Nuevo video» que se arman SOLAS** (Audiogram, la de subtítulos de TikTok,
   Prompt to Video). Cada una es un componente de Remotion con sus datos. Se ve con el `<Player>` y se exporta con el render
   (§3). Es lo más corto: no toca el editor y abre el camino del render.
2. **El render en la nube con la cuenta de AWS de cada cliente**, en Integraciones: primero para esas plantillas, y después
   para exportar los proyectos del editor. Esto último pide traducir un proyecto del editor (pistas, clips, textos, efectos) a
   una composition de Remotion. Es el trabajo grueso y le toca al chat de la nube «Video Editor: todos los pendientes».
3. **Las transiciones y los efectos de Remotion en el editor**: una vez que los proyectos se exportan con Remotion, sus 21
   transiciones y los efectos de §4 entran como opciones de las pestañas, porque ya se dibujan con Remotion.

**Lo que hace falta medir antes de la parte 2:**
- cuánta RAM usa hoy el editor abierto con un proyecto real, y cuánta el `<Player>` con el mismo proyecto;
- un render real con una cuenta de AWS de prueba: tiempo, costo y cómo se pasan las claves por cliente.

## 7. DECIDIDO (Martín, 11/11/2026): MaKo son 3 personas o menos → Remotion es GRATIS (Free License)

**La regla:** si MaKo pasa a 4 personas o más trabajando en el producto (contando freelancers y agencias), corresponde
«Remotion for Automators»: US$ 100 por mes como mínimo. **Se le avisa a Martín ANTES** de llegar a 4, no después. Adelante con
las tres partes de §6, en ese orden.

## 7b. La pregunta que se le hizo

**¿MaKo son 3 personas o menos trabajando en el producto, contando freelancers?**
- Si sí, Remotion es gratis para todo esto.
- Si son 4 o más, son **US$ 100 por mes** (cubre 10.000 videos; después, un centavo cada uno), más lo que AWS le cobre a cada
  cliente en su cuenta.
- El Editor Starter (US$ 600) no hace falta (§5).
