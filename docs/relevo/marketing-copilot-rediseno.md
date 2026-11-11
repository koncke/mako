# Relevo: el rediseño de Marketing CoPilot (maquetas, 11/11/2026)

Lo que sigue es para retomar sin este chat. Las maquetas son HTML navegables. Nada se programa en la app hasta que Martín dé el OK.

## Dónde está todo

- **Esquema de los pasos:** `docs/marketing-copilot/rediseno/esquema-descubrimiento.md`.
- **Funnels y sus preguntas:** `docs/marketing-copilot/funnels-simples.md`, con el detalle por funnel en `funnels/`.
- **Maquetas en el repo** (`docs/marketing-copilot/rediseno/`), una por vuelta. No se pisan.

  | Maqueta | Artifact |
  |---|---|
  | `maqueta-dos-columnas.html` | PyGboJ5AsKL2wUiPe2Kssk |
  | `maqueta-descubrimiento.html` | XboRwCiqtwybpf4iPXQpqw |
  | `maqueta-arranque.html` | LUyer4k7kV1sokRuBYeX44 |
  | `maqueta-por-canal.html` (la vigente) | 97pKNFeiPV4U8asB9ejLwn |

  Todos los links son `claude.ai/artifact/<id>`.
- **Cómo se arman** (en el scratchpad de la sesión 3b078c27, carpeta `maqueta/`):
  - `cuerpo-canales.html` es el cuerpo vigente.
  - `armar.mjs <cuerpo> <salida-repo> <salida-artifact>` le pega el CSS de producción (`../css-prod/*.css`), el CSS del Spy y de Offer (`spy.css`, que arma `sacar-css-spy.mjs`), las piezas comunes de `cuerpo.html`, los estilos del wizard y el glifo de Instagram (`glifo-ig.txt`).
  - Para mirarla: una entrada en `.claude/launch.json` con un servidor estático, más el Chrome sin ventana con `--virtual-time-budget` y los enlaces por estado (`#canales`, `#cargar`, `#lectura`, `#negocio`, `#negocio-youtube`, `#negocio-instagram`, `#negocio-anuncios`, `#sin-nada`, `#sin-nada-armado`, `#telefono`). Ver `docs/hallazgos-infra.md`.
  - Si el scratchpad no está, el HTML del repo tiene todo adentro: se edita el segundo `<style>` y el `<script>` del final.
- **El negocio simulado:** Federico Cristofari, Competitor Spy del ws 9, `competidor=20`. Sus videos, reels, vistas y fechas son reales; sus anuncios son de ejemplo.

## Lo que pidió Martín sobre la maqueta por canal (11/11, cuarta vuelta): para hacer

1. **Paso 1:** las tarjetas Anuncios, Instagram y YouTube, sin subtítulo.
2. **Paso 4, «Tu negocio», más simple:** sin el chat de MaKo al costado, todavía. Más adelante sí.
3. **«Tu oferta»:**
   - un botón **«Mejorar oferta»** donde hoy está la tarjeta del perfil («Federico Cristofari»), que se va;
   - en lugar de «A dónde mandas», la **nota total (46/100) al costado**;
   - abajo, «Nota por nota», y en el desplegable de cada nota un botón para **mejorar o corregir** esa parte, porque puede estar mal;
   - sacar «Lo más fuerte».
4. **Anuncios:** sacar la sección del recorrido del funnel y «Lo que veo para este funnel».
5. **Las pestañas de canal NO son una réplica de la plataforma: son un ANÁLISIS**, con los puntos que hay que tocar según los cursos, y feedback en cada uno. Esa lista sirve también, más adelante, para relevar las secciones de MaKo donde se corrige cada cosa.
   - **Instagram:**
     - la bio, y si tiene un CTA bien puesto y ligado a la oferta (sin CTA o con muchos CTA está mal);
     - los reels, con sus transcripciones;
     - los carruseles, y lo que no publica (por ejemplo, sólo reels);
     - la frecuencia;
     - las historias: cuántas sube y si hace historias de venta.
   - **YouTube:** lo mismo, con lo de los cursos de YouTube.
   - **Anuncios**, el análisis de cada uno de los cuatro tipos:
     - **mensajes:** analizar sus conversaciones de WhatsApp (MaKo se conecta a WhatsApp) y aprovechar la plantilla del Dashboard que habla de mensajes;
     - **VSL con llamada:** feedback de su VSL, con la transcripción;
     - **formulario:** feedback de su formulario;
     - **compra directa:** feedback de su página.
6. **Una máquina de contenido por canal** (la estrategia de contenidos), sacada de los cursos:
   - cuántos anuncios y cuántos reels grabar;
   - cada cuánto publicar historias, reels, carruseles, videos de YouTube y anuncios;
   - cada cuánto renovar los creativos;
   - las razones de compra por avatar de Jan, de donde también sale la cantidad de anuncios.
7. **Una pestaña «Tu web»**, como «Tu oferta», que **dibuja la web de la persona** y le da feedback sobre ella.

## El plan

1. **Relevamiento, con agentes, de lo que hay que revisar por canal y de la máquina de contenido.** Sale de todos los cursos de Knowledge: el índice está en el scratchpad (`cursos-indice/`) y las transcripciones en `public/cono-tx/` y `C:/cursos/programa-meta-ads-the-net-lab/transcripciones/`. Va a `docs/marketing-copilot/analisis/` (`organico.md` y `anuncios.md`), con curso y clase en cada punto. Ojo: el texto de MaKo va en tú.
2. **La quinta maqueta**, `maqueta-analisis.html`:
   - sin chat en «Tu negocio»;
   - «Tu oferta» con «Mejorar oferta», la nota al costado y nota por nota con «Mejorar o corregir»;
   - una pestaña de análisis por canal, con los puntos de la lista y su feedback;
   - la máquina de contenido;
   - «Tu web» con la web dibujada (se puede usar la captura del Spy, «Copiar su sitio»).
3. **Lo de siempre:** fotografiarla en claro, oscuro y teléfono; publicarla como Artifact aparte; actualizar el esquema; dejar lo aprendido en `docs/hallazgos-marketing-copilot.md`; subir a `punta/marketing-copilot-agente`.

## Sigue abierto

- **Quién paga leer el propio negocio** (Apify más la IA). Se pregunta antes de programarlo.
- **Dónde se pliega el chat:** Martín lo deja para más adelante.
