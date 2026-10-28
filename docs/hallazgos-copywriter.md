# Hallazgos — Copywriter (app/copywriter, lib/copywriter)

Lo que costó o sorprendió armando el Copywriter (mila.gg + Notion, 28/10/2026). El diseño y sus decisiones están en
[diseno-copywriter.md](diseno-copywriter.md); acá va lo que no se deduce del código.

## `adminOnly` esconde la fila; la puerta es otra cosa (28/10/2026)

- **Síntoma posible:** una tab nueva «sólo para el super admin» con `adminOnly: true` en nav.ts y
  `requireRolWs([], { nav })` en la página **se abre para el admin de CUALQUIER negocio** que escriba la URL: esa puerta
  pregunta el rol del workspace y la capa, no si es la agencia.
- **Dónde vive la puerta:** `app/copywriter/acceso.ts` (`veCopywriter`, con `getSesionAdmin`), el molde de AI Avatar. La
  preguntan las dos páginas de escritorio, las dos del teléfono (`app/m/copywriter/puerta.ts`) y las dos rutas /api.
- **Y la API de MaKo también:** su `gating.tab` mira la CAPA del negocio, y las capas `completo` y `agencia` ven todas las
  tabs. Cada runner del Copywriter pregunta `veCopywriterEnApi` (lib/copywriter/puerta-api.ts: sólo el negocio de la
  plataforma). Va en lib y no en `acceso.ts` para que los runners no carguen `next/navigation`. El día que Martín lo
  abra, se cambian LOS DOS archivos.
- **La regla:** una tab que nace para el super admin lleva su `acceso.ts` desde el primer commit, y
  `tests/redirige-antes-del-loader.test.ts` (PUERTAS) tiene que conocer sus `require…`.

## El «/» del Web Generator era de Gamma por dentro (28/10/2026)

- **Lo que parecía:** un plugin genérico del menú «/» (app/web-generator/editor/extensiones/barra.ts) que cualquier editor
  podía montar.
- **Lo que era:** `consultaValida` le preguntaba al catálogo de GAMMA si lo escrito con espacios todavía era un comando,
  y el plugin traía los atajos de Gamma, donde «> » es una cita. En Notion «> » es una **lista desplegable** y la cita es
  «" ». Montado tal cual en el Copywriter, «/pedirle a» se cerraba solo y «> » armaba una cita.
- **Cómo quedó:** el plugin recibe `buscar` (el catálogo) y `atajos` (los de Gamma, que el Copywriter apaga). Sin opciones
  hace lo de siempre. Los atajos de Notion van en una EXTENSIÓN con prioridad 101 (`AtajosNotion`, app/copywriter/editor/
  extensiones.ts): las reglas se prueban en el orden de las extensiones y gana la primera.
- ⚠️ **No subirle la prioridad a un NODO para que su regla gane:** la prioridad de un nodo cambia el orden del esquema, y el
  primer nodo del grupo `block` es el que TipTap usa para rellenar un documento.

## Los guiones viven en `app_settings`, con compare-and-set (28/10/2026)

- Un índice (`mako.copywriter.indice`) y un documento por guion (`mako.copywriter.doc.<id>`), como los guiones del Ads
  Writer en `mako.razones`: sin migración, y testeable en local sin tocar el esquema de producción.
- `cambiarSettingSi` compara el VALOR ENTERO: el índice se lee, se cambia con una función pura (lib/copywriter/arbol.ts) y se
  reescribe sólo si nadie lo cambió en el medio, hasta 4 veces. El documento exige la `version` que se abrió (409 →
  «Recargar», nunca pisa).
- Si un negocio llega a cientos de guiones con versiones, se muda a una tabla con su migración (y sus tres registros: ver
  la cabecera de `supabase/migrations/0246_editor_landing.sql`).

## Lo que crees MIENTRAS corren los tests afectados lo ven las barredoras (28/10/2026)

- **Síntoma:** `tests/api-mako-registro.test.ts` rojo en la corrida de la tanda 1 («nadie mira estos runners:
  copywriter»), con un archivo que NO era de esa tanda.
- **Causa:** `tests-afectados` arma su lista al empezar, pero las barredoras que recorren carpetas con `readdir` leen el
  disco cuando les toca (a los 13 minutos, con poca RAM). `lib/api-mako/areas/copywriter.run.ts` se escribió en el medio.
- **La regla:** mientras corren los afectados, no se crean archivos en carpetas que barre un test (lib/api-mako/areas,
  app/m, app/api). Se escriben después, o en otro worktree.

## MaKo escribía y las marcas de la propuesta no aparecían (28/10/2026)

- **Síntoma (en la maqueta):** «Editar» construía el guion y la tarjeta decía «3 bloques nuevos, marcados», pero el
  documento no marcaba ninguno.
- **El diagnóstico obvio era el equivocado:** parecía la decoración de ProseMirror (el plugin, el CSS). La causa era que
  cada pasada de las herramientas (`aplicarTodo` para el resultado, `cuadrosDeConstruccion` para la animación) llamaba a
  `bloqueAJson`, que inventaba ids NUEVOS: los cuadros y el resultado no compartían un solo id, y las marcas buscaban
  ids que no estaban.
- **Cómo quedó:** el id de cada bloque lo pone `sanearOperaciones`, UNA vez; aplicar después es determinista.
  `tests/copywriter-operaciones.test.ts` compara el último cuadro con el resultado con `deepEqual` (ids incluidos).
- **La regla:** si dos caminos aplican la misma propuesta (mostrar y aceptar), lo que se inventa (ids, fechas) se fija
  antes, no adentro de cada camino.

## Capturas sin build: la maqueta con los componentes reales (28/10/2026)

- `next build --debug-build-paths` de un editor TipTap pide ~4 GB (la sesión de replicar-landings lo vio morir a 3,1), y
  con 9 chats abiertos no entra. Lo que anduvo: esbuild (el de node_modules del repo) sobre los componentes REALES, con
  stubs para `next/navigation`, `next/dynamic`, `next/link`, `server-only`, lo de Node, y cada archivo `'use server'`
  reemplazado por funciones que contestan «maqueta» (en Next son llamadas remotas; empaquetados, arrastran el server
  entero). `globals.css` sin su `@import "tailwindcss"`. Un servidor FALSO en memoria con las funciones puras de
  lib/copywriter. Capturas con Chrome sin ventana por CDP al tamaño real (el panel del navegador de Claude es de 800×500 y
  recorta la emulación). Los scripts: side-session-notes/…/copywriter-maqueta/.
- Lo que encontró que los tests no veían: el árbol se comía el documento a 800 px, el título del teléfono en 16 px, un
  valor largo que empujaba la fila, el texto de la caja en dos renglones y las marcas de la propuesta.
- ⚠️ **El `:is()` de app/m/m.css pesa (0,4,1)** (`[data-m] :is(input:not(…):not(…):not(…), textarea, select)`: un
  `:is()` vale lo que su argumento MÁS fuerte). Una regla de pantalla sobre un campo del teléfono necesita más que eso.

## YouTube no tiene estructura, y no se inventa (28/10/2026)

- Reel y Story salieron de `METODOLOGIA_REEL` / `METODOLOGIA_STORY` (lib/ig-formatos.ts, los cursos que ya usa MaKo).
  Para YouTube no hay fuente en el repo (YouTube Writer era un «pronto» vacío): el guion de YouTube ofrece las de anuncios
  y lo dice. Cuando Martín diga de qué curso sale, va a lib/guion-estructuras.ts con `tipos: ['youtube']`.
- Que el selector «caiga» a otras estructuras es a propósito: un selector vacío deja el documento sin secciones, y MaKo
  escribe peor sin ellas (`estructurasDelTipo`, `propias: false`).
- La biblioteca de estructuras dejó de ser sólo de anuncios: lo que eso rompía está en
  [hallazgos-ads.md](hallazgos-ads.md) («La biblioteca de estructuras era de anuncios sin decirlo»).

## Compartir para editar: lo de seguridad está en su documento (28/10/2026)

- El link que EDITA un guion es la primera ruta pública que escribe en los datos de un negocio. Lo que costó (la puerta
  que nadie usaba, el índice entero que devolvía renombrar, la sesión de quien abre el link) está en
  [hallazgos-seguridad.md](hallazgos-seguridad.md), «Un guion del Copywriter se EDITA por link».
- ⚠️ **Fines de línea mezclados:** varios archivos del Copywriter quedaron con renglones LF adentro de un archivo CRLF
  (ediciones de tandas anteriores). Un reemplazo que arma el texto con un solo tipo de salto no encuentra nada y no avisa
  por qué: se normaliza a `\n`, se reemplaza y se vuelve a escribir con el salto del archivo.

## Qué quedó sin hacer

- La búsqueda web con fuentes de mila.gg (MaKo no tiene una para los chats): docs/diseno-copywriter.md → «Qué queda».
- Versiones guardadas del documento (hoy: deshacer, y la foto de antes mientras hay una propuesta de MaKo).
- La estructura de YouTube (falta la fuente) y sacar de la barra Stories y YouTube Writer el día que Martín valide el
  Copywriter (nav.ts es del jefe Sidebar): docs/diseno-copywriter.md, D6 y D7.
- `grafoParaChat` (rama mako-inteligente-2710-c4): el enganche es `const GRAFO` en lib/copywriter/contexto.ts.
- «Compartir para editar» desde el teléfono del dueño (la vista del guion del teléfono no tiene el menú ⋯): D9.
