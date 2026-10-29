# Hallazgos — Copywriter (app/copywriter, lib/copywriter)

Lo que costó o sorprendió armando el Copywriter (mila.gg + Notion, 28/10/2026). El diseño y sus decisiones están en
[diseno-copywriter.md](diseno-copywriter.md); acá va lo que no se deduce del código.

## `adminOnly` esconde la fila; la puerta es otra cosa (28/10/2026)

- **Síntoma posible:** una tab nueva «sólo para el super admin» con `adminOnly: true` en nav.ts y
  `requireRolWs([], { nav })` en la página **se abre para el admin de CUALQUIER negocio** que escriba la URL: esa puerta
  pregunta el rol del workspace y la capa, no si es la agencia.
- **Dónde vive la puerta:** `app/copywriter/acceso.ts` (`veCopywriter`, con `getSesionAdmin`), el molde de AI Avatar. La
  preguntan las dos páginas de escritorio, las dos del teléfono (`app/m/copywriter/puerta.ts`) y las dos rutas /api.
- **Y la API de MaKo también** (desde la tanda 2, 62a9b1b28; la tanda 1 no tenía operaciones): su `gating.tab` mira la
  CAPA del negocio, y las capas `completo` y `agencia` ven todas las tabs. Cada runner del Copywriter pregunta
  `veCopywriterEnApi` (lib/copywriter/puerta-api.ts: sólo el negocio de la plataforma). El día que Martín lo abra, se
  cambian LOS DOS archivos (lib/copywriter/puerta.ts y puerta-api.ts).
- **Y las CHARLAS con MaKo de cada guion** (verificación del Cerebro del 28/10/2026): `copywriter:<guion>` se guarda por
  /api/hilo-de-tab, y esa ruta, la lista del Ops Center, el hilo de «antes» y el doer sólo miraban el rol del workspace.
  El dueño de un negocio leía y escribía la charla del super admin sobre un guion de su negocio, y le salía en su Ops
  Center. La puerta (`veCopywriter`) se mudó a lib/copywriter/puerta.ts y las reglas comunes de las charlas
  (lib/chart-chats-reglas.ts, `pasaLaPuertaDeSuTab`) la piden, cerradas por defecto: quien arma `QuienChatea` sin decir
  que la pasa, no las ve. Una tab con puerta propia que guarda charlas tiene que cerrar TAMBIÉN ese camino.
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
- El índice se lee, se cambia con una función pura (lib/copywriter/arbol.ts) y se reescribe sólo si nadie lo cambió en el
  medio, hasta 4 veces. El documento exige la `version` que se abrió (409 → «Recargar», nunca pisa).
- ⚠️ **Un guion y su índice son valores LARGOS.** La tanda 1 usó `cambiarSettingSi`, que ponía el valor ENTERO en la URL
  del PATCH; la regla ya estaba escrita (docs/hallazgos-infra.md, 12/10: «sólo para valores cortos») y no la leí. La
  verificación del Cerebro lo midió: desde ~900 palabras el guion no se guardaba MÁS (cada reintento, y hasta borrar casi
  todo, comparaba contra el valor grande ya guardado) y desde ~40 guiones el árbol se congelaba, con un documento huérfano
  por cada «crear» fallido. El Cerebro lo arregló en la RAÍZ (f92b74992: `cambiarSettingSi` compara un valor largo en el
  server, para todos los que lo llaman); el Copywriter suma que `crear` borra el documento si el índice no entra.
  tests/copywriter-guardar.test.ts corre el `guardar` REAL contra el PostgREST de mentira con el límite de URL de prod.
- **Sin hacer:** `borrarSettingSi` no tiene ese desvío: un documento de más de ~6 KB cuyo índice no entra queda huérfano
  igual (lib/settings.ts).
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

## Cambiar el editor NO era reescribir el guardado (29/10/2026, «Copywriter = Notion»)

- El obvio era el equivocado: pasar de la TipTap propia a BlockNote parecía pedir otro formato de documento (el de
  BlockNote) y reescribir el saneo, las operaciones de MaKo, el texto exportado y la API. No hizo falta: lo guardado sigue
  siendo el JSON de doc.ts y `lib/copywriter/notion-bloques.ts` traduce en los dos sentidos. Lo que costó fue el conversor,
  no la casa: una lista son N ítems en BlockNote (vuelven a ser UNA con el `bid` del primero), un uuid tiene que dar
  SIEMPRE el mismo `bid` (si no, MaKo apunta a otro bloque en el turno siguiente), y BlockNote exige ids únicos en todo
  el documento (un `bid` repetido en un hijo rompe el editor; el segundo entra sin id).
- **Regla:** el esquema del editor es EXACTAMENTE lo que el formato guarda. BlockNote ofrece colores, alineación,
  imágenes, código y encabezados 4-6: si el esquema los deja, la persona los usa y desaparecen al recargar, sin un error.
  Lo que el formato no anida (un párrafo con hijos, Tab) sale a continuación, nunca se tira. El saneo tiraba un desplegable
  dentro de otro con lo escrito: ahora lo acepta (la profundidad tiene su tope).

## BlockNote en la casa: tres trampas (29/10/2026)

- **Los íconos del «/» salían en blanco:** el cuadrito de cada bloque usa los colores del TOOLTIP del tema de BlockNote
  (texto `var(--surface)` sobre `var(--ink)`); al pintarle el fondo claro de Notion, el ícono quedó blanco sobre blanco.
  Se le da `color` explícito (notion.css).
- **`@blocknote/react/style.css` sólo existe con la condición «style»** de `exports`: esbuild (la maqueta) no lo encuentra
  sin `conditions: ['style', …]`. Next la resuelve sola.
- **El asa ⋮⋮ no aparece con un `mousemove` de JavaScript:** BlockNote la ubica con el ratón de verdad. En las capturas
  por CDP va `Input.dispatchMouseEvent` (el plan de la maqueta tiene `raton` y `clic`).

## Las capturas de esta tanda (29/10/2026)

- Claude in Chrome no estaba conectado y producción pide sesión (entrar con una contraseña no lo hace Claude): no hay
  «antes» de producción de la tab vieja. El «antes» es el Copywriter de la tanda del 28/10 (C:/dev/revisiones/copywriter-2810/)
  y el «después», la maqueta con los componentes reales en Chrome sin ventana (C:/dev/revisiones/copywriter-notion-2910/:
  d* escritorio, t* teléfono). Los scripts, en el scratchpad de la sesión y copiados a side-session-notes del Cerebro.
- El test del tope de la mudanza daba verde con el padre sin contar: con 10 lugares y una sola matriz da lo mismo. Hizo
  falta el caso de 5 (tres guiones + su padre, y no entra el Reel con el suyo) para que la rotura se viera.
- `lib/razones.ts` es `server-only`: lo puro que necesita leer un guion de la matriz (la mudanza, con su test) copia la
  normalización mínima en vez de importarla.

## Dos ramas que tocan nav.ts: la que crea la ruta hace la fila (29/10/2026)

- El chat de Create y éste editaban el MISMO bloque de nav.ts (la familia Create). Lo que destrabó fue repartir por
  dependencia, no por archivo: la fila de Copywriting apunta a `/copywriter`, que existe sólo en esta rama, así que la hizo
  esta rama ENCIMA del merge de la otra. Si la hubiera hecho la rama del shell, sus clientes iban a una ruta que todavía no
  estaba en main. Por lo mismo, las dos ramas suben juntas (o la del Copywriter primero).

## Los tests del Copywriter daban verde y la barra estaba rota (29/10/2026)

- Correr «los tests del Copywriter» (los 12 que nombran copywriter, crear, m-creacion…) dio verde; `tests-afectados` dio
  10 rojos en 8 archivos que NO se llaman copywriter: la barra (`barra-sin-dev`: «lo que se editaba sólo ahí tiene casa»),
  la API REST (`api-mako-rest`: cada operación HTTP necesita su fila en `RUTAS_REST`, y generar-api-doc NO lo avisa), el
  catálogo de MaKo (`funciones-mako`: una key del nav que deja de ser `comingSoon` pasa a necesitar una función) y el
  teléfono (`movil-mas-secciones`: una query de `QUERY_DE_SECCION` tiene que volver por `RUTAS_CREACION`).
- **Regla:** sacar pestañas o abrir una key toca lo que la barra prometía. Antes del VERDE va `tests-afectados`, no la
  lista de tests con el nombre de la tab.
- Las herramientas del super admin que eran pestañas: Offer (rama de Create) ya las había mudado al pie de su lista
  (`pieLista={superAdmin ? (…Link…) : undefined}`), y `tests/sidebar-nueva` busca ese pie por texto. El Copywriter copia
  la MISMA forma (`{deLaPlataforma && (<span …><Link href=…>`), y el test mira los dos pies. Una pantalla hermana que
  resolvió lo mismo distinto es una tercera forma que el test no conoce.
- `ideas` se había caído del nav al sacar las secciones, y `app/ideas/page.tsx` la pide (`requireRolWs({ nav: 'ideas' })`):
  la vio `movil-rutas` (`/ideas` → «pronto»), no un test del Copywriter. Antes de borrar una sección, `grep` de su key.
- `tsc-acotado` con BlockNote se queda sin heap con 30 archivos y el heap por defecto (código 134, que NO es el vigía):
  van tandas de ~15 con `--heap=3000`. Y una tanda que arrastra `app/video-editor/_opencut` o `<style jsx>` da rojos que no
  son de nadie: se suman `app/video-editor/_opencut/types/opencut-wasm-bg.d.ts` y `node_modules/styled-jsx/global.d.ts`
  a la lista (declaran módulos para todo el repo y el acotado no los ve solo).

## La mudanza se duplicaba al reintentar, y la marca «una vez» no lo evitaba (29/10/2026)

Verificación del Cerebro de 544991179: C:/dev/revisiones/2910-verificacion-mudanza-copywriter.md (arnés en
C:/dev/revisiones/scratch-cw/). Arreglado en ac588e955 y fijado en tests/copywriter-mudanza.test.ts.
- **Síntoma:** si la última escritura (la marca «hecha») no llegaba, a los 10 minutos se mudaba todo otra vez: 7 → 14
  páginas, con dos «Guiones del Ads Writer». En ws1 eran ~150 duplicados.
- **El diagnóstico obvio era el equivocado:** «la marca por compare-and-set la hace idempotente». La marca protege de
  DOS PESTAÑAS A LA VEZ, no de un CORTE A LA MITAD. Con ids al azar nada recuerda qué ya se mudó.
- **Regla (AGENTS.md):** lo que se puede cortar y reintentar crea con ids que salen de su origen y saltea lo que ya está.
- **Una compensación que borra después de un error AMBIGUO** rompe lo que sí llegó. La escritura del índice llegó y se
  perdió la respuesta, `crearVarias` creyó que falló y borró los documentos: 6 de 7 páginas abrían «No existe». Con id
  estable no hace falta borrar: el reintento adopta el documento (`cambiarSettingSi(…, null, …)` da `false` = «ya
  existía», y tira ante un error, así que `false` nunca es «no sé»). `crear` (una página) sigue borrando: abajo.
- **«Lo que no entró queda donde estaba» deja de ser cierto si la mudanza es la única salida del dato.** La tab Reels se
  retiró, así que un Reel que fallaba una vez (la marca quedaba «hecha» con menos) ya no lo veía nadie. Por eso: «hecha»
  sólo si no faltó nada, y los Reels primero en el tope.
- El lugar del tope se cuenta SIN lo ya mudado. Si no, el reintento (con el índice más lleno) elige otras páginas y las
  que faltaron quedan afuera.

## Qué quedó sin hacer

- La búsqueda web con fuentes de mila.gg (MaKo no tiene una para los chats): docs/diseno-copywriter.md → «Qué queda».
- Versiones guardadas del documento (hoy: deshacer, y la foto de antes mientras hay una propuesta de MaKo).
- La estructura de YouTube (falta la fuente): docs/diseno-copywriter.md, D6. (Stories y YouTube Writer ya dejaron la barra el
  29/10, D13.)
- El arrastre del árbol de Notion (reordenar y anidar páginas) se perdió al entrar al shell único de Create (su lista es
  plana): docs/diseno-copywriter.md, D15. Retirar `/m/stories`, `/ideas` y el «pronto» de YouTube Writer del teléfono (sin
  fila, todavía vivos; lib/movil-rutas.ts, lib/movil-creacion.ts y sus tests).
- Borrar StoriesApp/OnboardingStories (sin entrada desde el 29/10) y decidir qué pasa con la matriz y «Analizar guion» del
  Ads Writer (siguen por su ruta).
- `grafoParaChat` (rama mako-inteligente-2710-c4): el enganche es `const GRAFO` en lib/copywriter/contexto.ts.
- Las bajas de la verificación de la mudanza (C:/dev/revisiones/2910-verificacion-mudanza-copywriter.md):
  - `crear` (lib/copywriter/server.ts) borra el documento si el índice «falla», aunque haya llegado: abre «No existe» (B7);
  - el link compartido de una página cuya madre está en la Papelera sigue editando: app/api/compartido/guion/route.ts
    mira sólo `pagina.papelera`; falta `escondida(paginas, id)` (B6);
  - después de mudar, /copywriter abre una página mudada y no la última del usuario: nacen con `actualizado = ahora` (B3);
  - con el índice casi lleno no entra nada y la marca queda «hecha» con 0 (B4);
  - un `reels.historial` con JSON roto se toma como «no hay» (B5).
- «Compartir para editar» desde el teléfono del dueño (la vista del guion del teléfono no tiene el menú ⋯): D9.
