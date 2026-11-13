# Hallazgos — Copywriter (app/copywriter, lib/copywriter)

Lo que costó o sorprendió armando el Copywriter (mila.gg + Notion, 28/10/2026). El diseño y sus decisiones están en
[diseno-copywriter.md](diseno-copywriter.md); acá va lo que no se deduce del código.

## Un rollback se dispara con «no dejó rastro», nunca con «falló»: `crear` borraba el guion que SÍ se había guardado (6/11/2026, B7)

El síntoma, de la verificación de la mudanza: la persona crea un guion, el texto se guarda bien, y la
pantalla dice «No existe» sobre una página que **sí** está en la lista.

La causa está en `lib/copywriter/server.ts` → `crear()`, y es el `catch` que venía a proteger:

1. Se escribe el documento (`mako.copywriter.doc.<id>`), después la fila del índice. El orden es a
   propósito y el encabezado del archivo lo explica: un documento sin fila no lo ve nadie y no rompe
   nada; **al revés quedaría una página que abre «no existe»**.
2. Si la fila falla, `crear` borra el documento para no dejar un huérfano.
3. Pero `cambiarIndice()` devuelve `!ok` por tres motivos que no se parecen: el árbol rechazó el cambio
   (422) y nadie ganó el compare-and-set en 4 intentos (409) — ahí la fila NO está —, **y también
   `falla(500, …)` cuando `cambiarSettingSi` TIRA**. Un timeout de red cuya escritura sí llegó al
   servidor cae en el tercero: la fila queda puesta y el documento se borra.

O sea que el rollback producía exactamente el estado que el diseño declaraba imposible.

**Why:** «la llamada falló» y «la llamada no tuvo efecto» no son lo mismo, y en una red son casi lo
contrario: el caso más común de un error de cliente es un efecto que sí ocurrió y una respuesta que no
volvió. Un `if (!ok) deshacer()` convierte cada timeout en una pérdida de datos. Y es peor que no tener
rollback: el huérfano era invisible y recuperable, el borrado no vuelve.

**How to apply:**

- **Antes de deshacer, volvé a leer.** `crear` ahora relee el índice: si la fila está, la creación salió
  y devuelve `ok` con el índice real; si no está, borra el huérfano como antes; y **si no se pudo releer,
  no borra nada**. Lo asimétrico se resuelve del lado que se puede arreglar después.
- La regla sirve para cualquier «escribo A, después B, y si B falla deshago A» de este repo. El tiro al
  pie no es el rollback: es la condición que lo dispara.
- Fijado en `tests/copywriter-guardar.test.ts` → «B7: si la escritura del índice LLEGA y el cliente ve un
  corte». El arnés (`tests/_copywriter-guardar-hijo.ts`) simula el caso real: deja pasar el PATCH del
  índice al PostgREST de mentira y **después** tira. Probado rompiéndolo: con el `borrar` incondicional
  da `404 No existe` y 1 de 5 rojo; el resto queda verde, así que mide esto y nada más.

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


**29/10/2026, plantillas reales: YouTube ya tiene fuente: `youtube-retencion` cierra la D6** (implementada el mismo día).
- **Hallazgo:** claude-youtube (MIT, «Copyright (c) 2025 Daniel Agrici», LICENSE leído) trae la estructura de
  retención: el gancho de 30 s en 3 tiempos, los bloques con interrupción, el CTA al 25 % y el regancho al 60 %. Sus
  metas numéricas (el 70 % de retención a los 30 s) no citan fuente y no entran.
- **Regla:** `conLasDeOrganicoNuevas` suma `youtube-retencion` aunque el super admin ya tenga la biblioteca guardada.
  `CON_TILDE` suma «CTA medio».

**Vive en:** lib/guion-estructuras.ts · lib/guion-estructuras-store.ts · lib/copywriter/doc.ts · docs/diseno-copywriter.md (D6)

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

## MaKo no puede escribir tablas: «adaptar» borraría las del Reel, las Stories, el Carrusel y los Ganchos (29/10/2026)

- **Causa:** `TIPOS_BLOQUE_IA` (lib/copywriter/operaciones.ts) no tiene `tabla`, y `escribir_seccion` reemplaza el
  cuerpo entero de la sección. La tabla se convierte en párrafos sin que nada falle.
- **Regla:** el bloque `tabla` (saneo, topes, `bloqueAJson`, truncado y `FORMATO_EDITAR`) va **antes** que «Adaptar a
  mi negocio».

**Vive en:** lib/copywriter/operaciones.ts · lib/copywriter/ia-editar.ts · tests/copywriter-operaciones.test.ts

## Un renglón en MAYÚSCULA abre una sección (29/10/2026)

- **Causa:** `bloquesDeTexto` toma como sección toda línea de 20 caracteres o menos en mayúscula que pase `esEtiqueta`,
  y antes le quita los dos puntos del final. `CTA`, `NEGOCIO:` o un texto en pantalla sin comillas como
  `43 DE 50 FALLAN` parten el documento.
- **Regla:** en los ejemplos el texto en pantalla va siempre entre «». `docDeEjemplo` usa la misma lectura, y
  `bloquesDeTexto` no cambia, porque lo usa la API de MaKo.

**Vive en:** lib/copywriter/texto.ts

## La API de MaKo le dejaría a un cliente el anuncio del negocio ficticio (29/10/2026)

- **Causa:** `crear_documento_copywriter` con `plantillaId` crea la página con `pl.contenido()`. Con el ejemplo
  adentro, un agente externo le crea al cliente el anuncio de Cierre Consultivo.
- **Regla:** cada plantilla tiene `esqueleto()` (las secciones vacías). La API y «Solo la estructura» usan el esqueleto;
  solo la galería abre el ejemplo.

**Vive en:** lib/api-mako/areas/copywriter.run.ts · lib/copywriter/plantillas.ts

## «Guion de anuncio» seguía la estructura del super admin (29/10/2026)

- **Causa:** usaba `estructuraPorDefecto(c, 'ad')`, la primera de la biblioteca editable. Un ejemplo escrito con las
  etiquetas de PAS se rompe si el override la cambia o la apaga.
- **Regla:** una plantilla con ejemplo fija su estructura (`'pas'`). Si el override la cambió o la apagó, la página
  nace con el ejemplo y sin estructura elegida.

**Vive en:** lib/copywriter/plantillas.ts · lib/guion-estructuras-store.ts

## Las variantes no van en la página, y las llaves de las variables muerden (29/10/2026)

- **Variantes:** «3 ganchos y 2 CTA» debajo del guion se leen como guion en el teleprompter y al copiar. Van en la
  respuesta del chat, como una oferta («¿Te armo 2 aperturas más?»).
- **Llaves:** Email Marketing usa `{nombre}`, con una llave (lib/template-vars.ts). Con `{{nombre}}`, el ejemplo pasa
  por `renderPrompt` como si fuera un slot.
- **Links:** el ejemplo usa `example.com` (RFC 2606); un dominio inventado puede existir.

**Vive en:** lib/copywriter/plantillas-ejemplos.ts · lib/template-vars.ts

## Los ejemplos tampoco pueden tener las muletillas que el prompt prohíbe, ni durar otra cosa que su estructura (29/10/2026)

- **Síntoma:** el primer borrador traía «no son presentaciones: son diagnósticos» y «no fue el anuncio, fue…», y un
  Reel de 35 s dentro de `reel-viral`, que pide de 50 a 60 s (`gancho-valor-cta` es solo de anuncios).
- **El diagnóstico obvio era el equivocado:** después de reescribir esos dos, el plan dio por hecho que solo quedaba el
  contraste del ángulo contrarian. La revisión encontró seis más fuera del gancho (el texto del anuncio de la 1, la
  moraleja y el caption de la 5, «No son nervios» en la 6, el email 2 de la 9, «el problema nunca fue el anuncio» y
  «no alcance» en la 10), una cifra sin fuente («la persona habla el 70 % del tiempo») y una clase de 45 min con una
  estructura que llega a 42. AI Avatar repetía el error de duración: un guion de ~26 s en `reel-viral`.
- **Regla:** cada ejemplo pasa la misma revisión que le pide el experto a la IA: sin muletillas, sin voseo
  («Guárdalo», «aquí»), sin cifras sin fuente y con la duración y las etiquetas de su estructura. Un test fija las
  etiquetas de cada ejemplo **y cuenta los contrastes** («no es… es», «no… sino»): como mucho uno por pieza, y solo en
  el gancho. Una lista revisada a ojo no alcanza.

**Vive en:** lib/copywriter/plantillas-ejemplos.ts · tests/copywriter-plantillas.test.ts (el contraste cuenta también
«no son X: son Y» y «no fue X, fue Y», las dos formas que el borrador tuvo que reescribir)

## Implementar las plantillas reales: lo que no estaba en el plan (29/10/2026)

- **Lo que queda del ejemplo no es todo lo que se parece al ejemplo.** El ✂️ del caption y «Una sola idea en todo el
  día» están en el ejemplo Y en el esqueleto: son la forma. Contados como «restos», una página que dejó solo la
  estructura seguía diciendo «quedan bloques del ejemplo». `restosDelEjemplo` descuenta lo que también está en el
  esqueleto, y el test exige 0 sobre cada esqueleto.
- **«Solo la estructura» vive en la página, no en el chat.** Lo que pone el chat en el editor (`DocVivo.poner`) no pasa
  por `alCambiar` (CuerpoNotion lo saltea a propósito), así que no se guardaba. Va donde vive `marcar` (EditorGuion), y el
  chat lo pide por `ApiPagina.soloLaEstructura`.
- **La respuesta de la persona a la pregunta de «adaptar» viaja en la charla.** `copywriter.adaptar.user` no tiene un slot
  para la instrucción y no se le agrega uno (la misma regla de los overrides): `charla` lleva lo último, con «LA PERSONA,
  AHORA: …» al final.
- **`bloquesDeTexto` y `docDeEjemplo` son la misma lectura con un interruptor** (`leer(texto, ejemplo)`): copiar la
  función habría dejado dos lecturas de «MAYÚSCULA abre sección» que se desfasan; el test fija que la de la API no lee
  destacados, tablas ni negritas.
- **`PropsGuion.plantilla` es opcional en el tipo** (el saneo y `propsNuevas` la devuelven siempre): obligatoria, cada
  objeto de propiedades armado a mano en el código y en los tests dejaba de compilar sin aportar nada.
- **Los avisos de licencia son el texto literal** de cada LICENSE (leído de raw.githubusercontent.com), en
  `lib/avisos/`. Create arma la misma carpeta en su tanda 0: los dos con el mismo archivo byte a byte, o uno solo.

**Vive en:** lib/copywriter/plantillas.ts · app/copywriter/editor/EditorGuion.tsx · lib/copywriter/ia.ts ·
lib/copywriter/texto.ts · lib/copywriter/tipos.ts · lib/avisos/

## Hay dos `contextoDelNegocio` (29/10/2026)

- **Síntoma posible:** al mover el contexto del negocio a un `lib/` común, para que lo lean Video, Image y AI Avatar,
  un import automático trae el equivocado.
- **Causa:** `lib/copywriter/contexto.ts` exporta `contextoDelNegocio(pedido): Promise<string>` (el Second Brain, con
  1,800 tokens), y `lib/plan-senales.ts` exporta `contextoDelNegocio(): Promise<ContextoNegocio>`, otra cosa.
- **Regla:** el común se mueve con un nombre que no choque, o se importa siempre con su ruta explícita.

**Vive en:** lib/copywriter/contexto.ts · lib/plan-senales.ts

## Un comentario viejo daba por pendiente lo que ya estaba en main: `grafoParaChat` (29/10/2026)

- **Síntoma:** el plan decía «`grafoParaChat` sigue sin llegar a main» y dejaba al Copywriter leyendo
  `construirCerebro()`.
- **Causa:** la frase salió de la cabecera de lib/copywriter/contexto.ts (líneas 12 a 15), que dice que vive en otra
  rama. `grafoParaChat` está en main desde el 28/10 (`c272b97dd`, lib/cerebro-para-chat.ts:33), y
  lib/api-mako/areas/negocio.run.ts ya lo usa.
- **El diagnóstico obvio era el equivocado:** un comentario del código no es el estado del código. Se verifica con
  `git grep -n <nombre> origin/main` antes de escribir «falta».
- **Lo que queda:** cambiar `const GRAFO = () => construirCerebro()` (contexto.ts:24) y su comentario. El `lib/` común
  de la tanda 0 nace leyendo `grafoParaChat`.

**Vive en:** lib/copywriter/contexto.ts · lib/cerebro-para-chat.ts

## «Ninguna mención en todo MaKo»: un nombre vivía en ocho lugares (29/10/2026)

Martín: «Elimina esto "Copy Method · Angles & Structures", no quiero ninguna mención en todo MaKo».
- **Dónde estaba el nombre:** el pie de la lista del Copywriter, las dos `HERRAMIENTAS` de nav.ts (y el `match` de la fila
  de Copywriting), el `metadata.title` de /admin/guiones, la fila oculta del teléfono (lib/movil-creacion.ts, también en
  `IdCreacion` y en `RUTAS_CREACION`), la razón de «en la computadora» (`SOLO_ESCRITORIO['admin-guiones']`), los títulos
  que fijaban dos tests y los comentarios. Sacar «la fila» dejaba seis.
- **Regla:** un pedido de «que no aparezca» se fija con un BARRIDO (tests/barra-sin-dev.test.ts, el 5: `git ls-files`
  de app/, lib/ y components/), no con un test por archivo: el próximo lugar donde alguien lo escriba no tiene test.
- **Lo que no se tocó, a propósito:** lo que la IA lee (lib/copywriting-metodo.ts, los stores de ángulos y estructuras,
  sus rutas de datos y los overrides guardados). La pantalla y el dato son cosas distintas: borrar la pantalla no cambia
  cómo escribe MaKo.
- **Consecuencia que hay que saber:** esas bibliotecas y el método ya no tienen dónde editarse desde la app (sólo sus
  rutas de datos). Si Martín quiere cambiarlas, es código o un pedido a un chat.
- **Una página del teléfono que sólo redirige no pasa los barridos del teléfono** (movil-mismas-rutas: toda /m tiene su URL
  de escritorio; movil-refrescar: toda /m dibuja PantallaM). Se borra, como /m/reels: el link de escritorio redirige solo.

**Vive en:** app/_components/nav.ts · app/copywriter/Copywriter.tsx · app/admin/{copywriting,guiones}/page.tsx ·
lib/movil-creacion.ts · lib/movil-rutas.ts · tests/barra-sin-dev.test.ts

## Sacar el ejemplo de la página apagaba a MaKo y dejaba a la IA sin modelo (29/10/2026)

- **Crear con el esqueleto parecía un cambio de una línea, y no lo era.** El primer mensaje de MaKo («¿Lo adapto?») salía
  sólo si `restosDelEjemplo(página) > 0`, o sea, si la página todavía era el ejemplo. Con la página naciendo vacía, esa
  condición da 0 siempre: el mensaje no volvía a salir, y sin un error. Las preguntas nuevas dependen de que la página
  recuerde su plantilla (`props.plantilla`) y de que el chat esté vacío, no de lo que tenga escrito.
- **La IA de «adaptar» leía el ejemplo de la página.** Con el esqueleto, el modelo recibía secciones vacías y nada que
  imitar. El ejemplo va ahora dentro del slot `estructura` de `copywriter.adaptar.user`, marcado como forma y no como
  dato. No se agrega un slot: un override guardado desde /configuraciones-prompts no lo tendría.
- **Una guía con la etiqueta mal escrita no se ve nunca.** `GUIAS` se busca por la etiqueta de la sección
  (`attrs.seccion`). Si la clave no coincide (un acento, un plural), esa sección queda sin guía y sin error. El test exige
  una guía debajo de cada sección y que cada clave sea una sección real.
- **`ofertas = []` como default de una prop rehace los `useMemo` en cada render**: es un arreglo nuevo cada vez. Va una
  constante fija (`SIN_OFERTAS`).
- **En el teléfono se ve una vista por vez**: las preguntas en la vista de MaKo quedaban detrás de «Página». La página
  recién creada desde una plantilla abre en MaKo (`?mako`).
- **Trampa del entorno:** un heredoc de Bash con un script de Node que lleva comillas simples y backticks se cortó
  («unexpected EOF while looking for matching `''»). Los scripts de edición van a un archivo con Write y se corren con
  `node archivo.cjs`.

**Vive en:** lib/copywriter/iniciativa.ts · lib/copywriter/plantillas-guias.ts · lib/copywriter/plantillas.ts
(`conGuias`) · lib/copywriter/ia.ts · app/copywriter/PanelMaKo.tsx · app/copywriter/editor/EditorGuion.tsx ·
app/m/copywriter/GuionM.tsx

## Arrastrar un título dejaba su contenido atrás (6/11/2026, Recorrido visual, nube, `punta/recorrido-visual`)

- **Síntoma** (llamada con Leila del 5/11, pendientes 1.8): arrastrar «Gancho» por el asa ⋮⋮ movía sólo el título; los
  párrafos de abajo se quedaban donde estaban.
- **Causa:** en BlockNote un título y lo que tiene debajo son bloques HERMANOS (los títulos desplegables están apagados en
  `esquema.tsx`). El `dragStart` de BlockNote mueve la SELECCIÓN entera cuando abarca varios bloques; si no, sólo el del asa.
- **El arreglo:** `seccionDe` (lib/copywriter/seccion-arrastre.ts, puro) da la sección del título —hasta el próximo título del
  mismo nivel o más alto— y `MenuLateral` (CuerpoNotion.tsx) la selecciona en `onDragStartCapture`, ANTES del arrastre de
  BlockNote. En burbuja llega tarde: BlockNote ya tomó la selección de un solo bloque.
- **Trampa:** `editor.setSelection(a, b)` tira si un extremo no tiene texto propio. Por eso `hasta` es el ÚLTIMO bloque con
  texto: un divisor o una tabla al final de la sección se quedan donde estaban (raro, y dicho en el módulo).
- **Se vio arrastrando** en Chromium con el editor de verdad (docs/recorrido-visual/copywriter-arrastre-*.png). El test fija
  la sección y el enganche; el gesto en sí sólo lo prueba un navegador.

**Vive en:** lib/copywriter/seccion-arrastre.ts, app/copywriter/editor/CuerpoNotion.tsx, tests/copywriter-arrastrar-seccion.test.ts

## «Tenemos la transcripción de un montón de cosas»: medido, casi no hay (11/11/2026, outliers de copy)

- **Lo que se creía** (Martín, al pedir los outliers de copy): que había transcripciones de anuncios, carruseles, reels y videos
  de YouTube, listas para mostrar como outliers.
- **Lo que se midió en producción** (sólo lectura, el 11/11):
  - **Guiones de Spy:** 11 en toda la base, todos de un mismo negocio; 0 en el ws 3. Viven en `app_settings`
    (`spy.transcripcion.<competidor>.<pieza>`), no en `spy_piezas`, y se hacen SÓLO al abrir el detalle de una pieza en Spy
    (Apify + Whisper, o Gemini para YouTube). Vencen a los 30 días.
  - **Carruseles:** las láminas no tienen su texto guardado, sólo las imágenes. Lo único es el pie.
  - **YouTube (Thumbnails):** ni descripción ni transcripción; sólo títulos y números.
  - **Anuncios:** los de la competencia guardan su copy, no la transcripción del video. Los PROPIOS sí
    (`ad_transcripts.secciones` + `script_analyses`, con su veredicto): 133 en un negocio, 87 en otro, 0 en el ws 3.
- **Lo que hay de verdad, y es lo que usa la portada** (lib/copywriter/outliers.ts):
  - el pie de los reels y las publicaciones de Spy;
  - la descripción y el título de YouTube;
  - el copy de los anuncios;
  - el pie de los 1.574 carruseles de la biblioteca;
  - el guion, cuando ya existe.
  La tarjeta y MaKo dicen qué texto es; nunca «la transcripción» cuando es el pie.
- ⚠️ **El texto de Spy vence a los 30 días** (`podarVencido`, la regla de datos de terceros): una pieza vieja de Spy llega sin pie y
  no es un outlier de copy. Una portada que no sale «vacía» depende de que Spy siga leyendo.
- ⚠️ **El copy de un anuncio puede no ser copy, y repetirse** (simulado con los datos del ws 9, 11/11): los anuncios de catálogo
  traen «{{product.name}}» de texto y, como llevan meses al aire, quedaban entre los diez primeros. Y el mismo texto corre en
  varios anuncios: de 258 anuncios quedaban 24 distintos. Una variable de plantilla no cuenta como palabra (`esCopy`), y el
  mismo copy del mismo creador sale una vez (`juntarOutliersCopy`).
- **Sin hacer:** los anuncios propios como fuente (`ad_transcripts` + el veredicto del Script Analyst), y transcribir al replicar
  (asegurarGuion de Spy tiene tope de 20 por día y cuesta). Los anuncios propios con transcripción están sólo en negocios de
  clientes (ws 1, 13, 19, 4, 14…), ninguno en el ws 3 ni en el 9; y para saber cuál es «ganador» faltan sus métricas de Meta.

## En el negocio de prueba MaKo no escribe guiones: no es una falla del Copywriter (11/11/2026, prueba en producción)

- **Síntoma:** en el ws 3, al contestar las preguntas de una plantilla, MaKo responde «No hay ninguna IA conectada, así que MaKo
  no puede escribir…». A 1440, además, la caja dice «Instala MaKo para escribir» con el botón «Instalar MaKo».
- **Son dos reglas de producto, no fallas:**
  - el ws 3 no tiene Claude ni GPT conectado (cada negocio paga SU IA);
  - en la computadora, sin la app de escritorio conectada, NINGÚN chat de MaKo deja escribir (Martín, 23 y 25/10: «Bloqueá
    igual»; lib/chat-mako-reglas.ts → `appDeEscritorio`). En el teléfono no se traba: avisa y deja seguir.
- **Lo que sí se prueba en el ws 3:** la plantilla, las preguntas de MaKo y las ofertas, escribir a mano, guardar y reabrir, «Ver
  ejemplo», la portada de outliers, Replicar y «Ver el original». Que MaKo ESCRIBA se prueba en un negocio con IA (el encargo de
  imágenes del 6/11 usa el ws 9), con el sí del Cerebro.
- **Lo que esa prueba encontró y se arregló:** en el teléfono, la barra decía «Sin título» con el título ya escrito; «Ver ejemplo»
  cortaba el texto a la derecha (el documento tomaba el ancho de su tabla); después de las preguntas aparecía una burbuja de más
  que repetía las respuestas; y en la caja trabada la frase quedaba cortada a la mitad (app/_chat/CajaChat.tsx, compartida).
- **Visto y NO arreglado (no es de esta tab):** en el teléfono, el super admin que mira un negocio ve el chip «Cliente de Prueba»
  encima del título de la barra (app/m/_ui, la cabecera compartida). El cliente no lo ve.
- **Dos caminos al mismo lugar:** Spy tiene «Copiar estructura» (lib/spy-detalle.ts → `textoParaCopiar`: la página nace con el
  original citado adentro) y la portada de Copywriting tiene «Replicar» (la página nace vacía, atada al original, y MaKo la
  escribe). **Sin hacer:** que Spy use «Replicar» y quede uno solo.

## Lo que la prueba en producción encontró en los outliers (11/11/2026, después del despliegue)

- **«Todos» era una sola fila de carruseles:** las 24 primeras tarjetas eran carruseles en inglés de la biblioteca (de 1.219× a
  29×), porque su «×» está en otra escala que el de los reels del nicho. Ahora cada vuelta trae el mejor de cada formato
  (`intercalarFormatos`); dentro de un formato el orden no cambia.
- **La réplica copiaba la frase del original:** «Cobrar mejor no es suerte, es sistema.» se replicó como «Cobrar más caro no es
  suerte, es sistema.», con la regla «nunca copies sus frases» en el prompt. Segunda capa: `frasesDelOriginal` (5 palabras
  seguidas) avisa en la propuesta con la frase. ⚠️ Una vez MaKo también «arregló» una línea editada a mano que no se le pidió
  tocar; repetido con una edición limpia, la respetó: la primera vez, la frase que dejó la prueba estaba rota.
- **El visor del modal era una caja blanca casi vacía** con un pie de dos renglones: ahora la pieza va arriba y el texto abajo.
- **⚠️ El intercalado se deshacía solo** (desplegado y medido): carrusel, reel y YouTube en la primera vuelta y después nueve
  carruseles. La variedad de creadores («2 del mismo cada 12») corría DESPUÉS de intercalar y empujaba abajo los reels y
  videos, que son de pocas cuentas. Va dentro de cada formato, antes de intercalar (`intercalarFormatos(xs, porFormato)`).
- **El aviso de frases copiadas anduvo, pero no miraba el título** (desplegado y medido): avisó «es lo peor que puedes hacer» del
  cuerpo y dejó pasar el título «Cobrar más no es suerte, es sistema». Ahora mira los dos por separado.
- **Sin hacer:** el aviso ve frases iguales, no paráfrasis. La historia de la réplica todavía sigue de cerca la del original
  («qué rabia cuando cobras poco y el cliente te exige el triple»).

## «Lo único que me replica es el título»: probar no es mirar que anda, es usarlo como Martín (11/11/2026)

- **Síntoma** (Martín, con capturas): Replicar dejaba una página con título, Ángulo y Estructura «Vacío» y el cuerpo VACÍO; MaKo
  preguntaba «¿Lo replico para tu oferta? ¿Para cuál?» y no escribía. Además: no había cómo volver a los outliers, la portada no
  tenía el chat de MaKo, las tarjetas parecían carruseles y la pestaña andaba «increíblemente lenta».
- **⚠️ El diagnóstico obvio era el equivocado: «anda, lo probé».** Las pruebas de la tarde pasaron porque YO contestaba la
  pregunta de la oferta y tocaba «Aceptar». Una persona que toca «Replicar» espera el guion escrito: la pregunta y el «Aceptar»
  eran dos pasos que nadie le pidió. La prueba tiene que ser el recorrido de quien la usa, de punta a punta, sin conocer la app.
- **Lo que quedó:** al abrir la réplica vacía MaKo la escribe SOLA con la oferta principal y queda en la página (no había nada
  que pisar); las otras ofertas, como botones debajo; el pedido pide el guion ENTERO y el ángulo y la estructura. La portada va
  en el centro de la pantalla de Create (`nueva` de PantallaCrear, como Image), con el chat a la izquierda, y «Nueva página»
  vuelve a ella. La tarjeta es de copy (el gancho grande y el texto; YouTube en 16:9), y las plantillas van en una fila al lado.
- **La lentitud, medida** (producción, ws 9, 1440): 7,5 MB de página, 3,8 s al primer byte, 5,3 s hasta poder usarla, 2.291
  tarjetas con 46.030 elementos, y de 1 a 7 s por cambio de filtro. Era traer y dibujar TODO: de a 48 tarjetas, 300 por formato,
  280 letras por tarjeta (el texto entero se pide al abrir) y la portada guardada 5 min por negocio. El intercalado NO era (se
  calcula una vez en el server).
- **La regla:** una portada de outliers no manda ni dibuja todo lo que hay: tope por formato, texto corto en la tarjeta y tandas.
- **Sin hacer:** un video de YouTube sin transcripción se replica con su título y su descripción (no sigue su estructura real);
  transcribirlo al replicar (`asegurarGuion`, tope de 20 por día). Sin la app de escritorio, la réplica no se escribe sola (la
  regla de todo chat de MaKo).

## Probar Create como Martín: lo que «escribió todo» no dice (12/11/2026, prueba en producción, chat «probar-copy»)

Se replicó un outlier de cada tipo y se usó una plantilla, comparando CADA resultado con su original (capturas en
side-session-notes/…/probar-copy-1211/). El recorrido andaba: Replicar escribía solo, sin preguntas. Lo que estaba mal sólo se ve
leyendo el resultado al lado del original:

- **El largo:** un anuncio de ~40 palabras salió de ~200, con una «Historia» que el original no tiene. El pedido decía «su
  estructura, su gancho y su ritmo» y nunca el largo. Ahora el original que manda el server dice cuántas palabras tiene y el
  rango (±25 %) (`reglasDeLaReplica`, lib/copywriter/outliers.ts).
- **El formato:** un carrusel de 7 láminas salió como un post en prosa. Ahora se pide lámina por lámina, en tabla, con el pie aparte.
- **Las pruebas:** la réplica de un video de YouTube inventó porcentajes, casos de clientes y «3 a 5 clientes garantizados o
  devolvemos lo que pagaste», con «nunca inventes cifras ni garantías» en el prompt. Capa 2: `cifrasSinFuente`
  (lib/copywriter/ia-reglas.ts) avisa los porcentajes, los «N veces» y la garantía que no están en lo que MaKo leyó.
- **⚠️ Los avisos no se veían donde más hacían falta:** la tarjeta sólo los dibujaba con «Aceptar», y la réplica se acepta sola.
  El aviso de frases copiadas (11/11) nunca salió en una réplica. Ahora se ven también en lo aceptado.
- **El título** quedaba con el gancho del competidor («Como @den.borgg: Cobrar mejor no es suerte, es sistema.») cuando MaKo no
  lo cambiaba, y un video salió «Método Probado 2025». Se pide un título propio y el año en curso.
- **La voz:** en un negocio rioplatense salía «Mandás un anuncio… esperas» en el mismo párrafo. La regla decía «de "tú" salvo
  que esa variedad use otra forma» y el modelo quedaba a mitad de camino. Ahora dice UNA forma (`bloqueIdiomaCopy(…, vosea)`).
  ⚠️ El guard de voseo marca la palabra «vos» suelta aun en un prompt: se escribe «voseo» / «tuteo».
- **⚠️ El pedido técnico aparecía como mensaje de Martín:** `oculto` vive en la memoria del panel y no se guarda; al reabrir la
  réplica, «Escribe el guion ENTERO como el original… Pon en propiedades el ángulo…» era una burbuja suya. **Regla:** lo que es
  para el modelo y no para la persona va en el server (la referencia del original, en cada pedido), no en el texto del mensaje.
- **La plantilla preguntaba tres datos más y no escribía** (después de sus dos preguntas): `copywriter.adaptar.user` decía «si
  falta el precio, a quién le habla o qué tiene que hacer, todavía no escribes». Ahora escribe con [DATO: …] y pregunta después.
  Y lo escrito sobre la plantilla SIN TOCAR (sus guías) queda en la página sin «Aceptar», como la réplica.
- **El negocio de prueba (ws 3) no sirve para esto:** no tiene IA ni computadora conectada («Instala MaKo para escribir») ni
  anuncios de competencia (no hay filtro Anuncios). La escritura se midió en el negocio de MaKo, que corre primero con el
  crédito de Claude (Haiku). Los errores de redacción («estás improviso», «sin handle qué responde») son del modelo.

- **⚠️ «Adapté el carrusel completo» con la página vacía:** en la plantilla Carrusel, las tres secciones (láminas, CTA y pie) se
  descartaron por «La sección no tiene una etiqueta válida» y sólo entró el destacado. La respuesta del servidor no trae lo que
  escribió el modelo (sólo el motivo), así que no se pudo ver qué nombre puso; el GUION se le muestra como
  «[bid] ## SECCIÓN SLIDES: Slides» y un modelo chico copia el renglón. Ahora `etiquetaDeSeccion` (lib/copywriter/operaciones.ts)
  lo lee con tolerancia, y con algo descartado la plantilla no se acepta sola: queda la propuesta con el motivo a la vista.
  **Regla:** lo que dice MaKo («hice todo») se contrasta con lo que entró en la página, no con su mensaje.
- **El título y el ángulo de la plantilla:** quedaba «Sin título» y «Ángulo: Vacío». Adaptar no recibía la biblioteca (sin ids no
  puede poner un ángulo); ahora la recibe y el método lo pide. Capa 2 del título: una pieza escrita entera sobre una página sin
  título propio (o con el «Como @…» de la réplica) sale con lo primero que se dice (`tituloDeRespaldo` + `extractoDelDoc`).
- **La página vacía:** escribir por chat sobre «Página en blanco» pedía «Aceptar» (no había nada que pisar), y las sugerencias
  eran «Acortar» y «Mejorar la escritura». Ahora se acepta sola y sugiere pedidos para escribirla.
- **El orden de «Mis guiones»** (teléfono y la «←»): de la más vieja a la más nueva, porque es el orden del árbol y el arrastre se
  perdió en el shell de Create. Ahora la última editada arriba (`enOrdenReciente`, lib/copywriter/arbol.ts).

**La regla:** probar una pieza generada es ponerla al lado del original y medir largo, formato, partes, pruebas y título. Que
MaKo diga «repliqué la estructura y el ritmo» no es una medición: lo dijo las cuatro veces, y en dos no era cierto.

## El título dos veces en la tarjeta: el gancho era el texto CORTADO (13/11/2026, captura de producción)

**Síntoma:** en 14 de las 34 tarjetas de outliers con texto debajo de la portada, el texto gris volvía a empezar por el mismo título
en negrita («@janacraig_ is stepping into…» arriba y otra vez abajo). El banco no lo mostraba: sus ganchos son frases cortas.

**Causa:** sin un gancho analizado, el gancho es `primeraLinea(texto)`, que corta el primer renglón a 140 letras y le suma «…».
`restoDelTexto` sacaba el gancho del principio del texto con `t.startsWith(g)`, y un gancho cortado nunca es el principio del
texto (el texto no tiene el «…»): devolvía el texto entero. Pasa con los pies largos de un solo renglón, sobre todo en inglés
y en los anuncios.

**La regla (`textoDeTarjeta` en lib/copywriter/outliers.ts):** si el gancho termina en «…» y el texto empieza con lo mismo sin el
«…», en negrita va la primera oración y debajo el resto; si la primera oración es más larga que el gancho, sólo el gancho. Un texto
recortado para mostrar no se compara contra el original sin sacarle el recorte.
## Segunda vuelta: las 12 plantillas, el teléfono entero y el negocio sin IA (13/11/2026, chat «probar-copy»)

Tabla con cada paso y su captura: side-session-notes/local_3f1a66d3-…/probar-copy-1311/notas.md (fuera del repo).

- **⚠️ Las plantillas largas salían cortas, y no por el modelo:** la VSL de 10 minutos salió de 587 palabras, el YouTube de 12
  de 793 y la Clase de 42 de 617. El diagnóstico obvio (un modelo chico que se cansa, el tope de tokens) era el equivocado:
  seguían el largo del EJEMPLO, que es un resumen. **Regla:** el largo lo da la duración (unas 150 palabras por minuto, hasta
  2.000), y si queda debajo de 0,6 de eso se avisa con los números (`avisoDeDuracion`, lib/copywriter/ia-reglas.ts).
- **⚠️ El título de una sección se perdía:** el método pedía «un destacado arriba» y el modelo lo hacía con `reemplazar_bloque`
  sobre el título GANCHO (o LEAD): el texto quedaba sin su sección y `escribir_seccion` la volvía a crear al final. **Regla:**
  un título de sección no se reemplaza ni se borra; el saneo lo convierte (lib/copywriter/operaciones.ts). Además «SECCIÓN
  ASUNTO» y los títulos repetidos adentro de su sección se sacan, y `**negrita**` se vuelve negrita.
- **⚠️ «No cambié nada.» no era MaKo negándose:** la IA devolvió un objeto sin respuesta ni operaciones, y el texto de respaldo
  lo disfrazaba. El mismo pedido, otra vez, escribió el reel entero. **Trampa:** una salida vacía que parsea bien no tira error.
  **Regla:** se pide una vez más si queda plazo, sus claves van al log y, si vuelve vacía, se dice (`salidaVacia`).
- **El tipo no viajaba:** un reel escrito en una «Página en blanco» quedaba «Página» (también en la lista), porque
  `propiedades` no aceptaba el tipo. Ahora lo acepta y, si la IA no lo pone, se toma del pedido (`tipoDelPedido`: gana el que
  aparece primero, y «Ads» no cuenta porque es parte de nombres de ofertas como «WhatsApp Ads Funnel»).
- **Lo que MaKo dice que hizo, contra la página:** con un archivo adjunto contestó «Completé… precio (US$ 497), garantía (14
  días)…» y en la página no estaban. **Regla (la de ayer, con capa 2):** la plata, los porcentajes y los plazos que nombra la
  respuesta se buscan en la página; lo que falta se avisa (`dichoQueNoQuedo`).
- **La mezcla de voseo y tuteo sale en casi todas las piezas** de un negocio rioplatense, con la regla en el prompt. La lista
  corta del tuteo (`marcasDeTuteo`) se queda corta: sumó «tú», «ti», «abres», «llevas», «controlas» y «trabajas» en un día.
- **⚠️ Teléfono: «Aceptar» escondido a propósito.** El comentario de GuionM decía «su Aceptar queda en MaKo, con el número
  arriba»; usado, la vista salta a la Página con el cambio marcado y nadie vuelve a MaKo a aceptarlo. **Regla:** la decisión va
  donde se ve el cambio (pie fijo «Descartar · Aceptar» en la Página, `onPendiente` de PanelMaKo).
- **Teléfono: la caja con un adjunto** lleva micrófono y flecha (ticket #51): a 375 el campo queda en 115 px y «Escribe a MaKo»
  se partía en dos renglones cortados. En ese estado, un renglón con «…» (centro.css).
- **Teléfono: `?abrir=ia` no abre nada** (sólo lo entiende la computadora). En el teléfono la casa de la IA es /perfil/ia, que dice
  «Todavía no conectaste ninguna cuenta · en la computadora»: ahí redirige ahora.
- **El negocio sin IA:** en el teléfono se entiende («No hay ninguna IA conectada… Conectar mi IA»). En la computadora, sin la
  app (la regla del 23/10), las ofertas de la plantilla salían grises sin decir por qué: ahora una línea lo dice bajo los botones.
- **Las sugerencias genéricas parpadeaban** («Mejorar la escritura · Acortar…», de uno a cinco segundos) antes de la pregunta de
  una plantilla: salían antes de leer el hilo.
- **⚠️ Avisar no era el arreglo (el Cerebro, el mismo día):** «Martín quiere que la réplica SALGA bien, no que le avisen que salió
  mal». Los avisos del largo, la voz y los capítulos (9e5a80238) pasaron a ser el ÚLTIMO recurso. **Regla:** lo que se puede medir
  se corrige antes de mostrar. Una réplica fuera del ±25 % del largo, o que no sigue los capítulos, tiene una SEGUNDA PASADA
  automática con los números (`pedidoDeCorreccion`, lib/copywriter/outliers.ts) y gana la que mejor cumple. La respuesta dice el
  largo contado, no el que dijo el modelo («unas 38» sobre 83: `conElLargoReal`). Lo mismo una plantilla corta para su duración
  (debajo del 75 % de 150 palabras por minuto, `cortaParaSuDuracion`): se completa sola, y el aviso queda para debajo del 60 %.
- **⚠️ La voz «configurada» es la DECLARADA, no la de la zona horaria:** el negocio de MaKo escribía con voseo porque
  `resolverAcento` lo deducía de su zona (Argentina), y la regla del producto es «tú» en español neutro. Ahora vosea sólo un
  acento declarado (`seguro`); si no, lo escrito pasa solo a «tú» con `alTuteo` (lib/al-tuteo.ts, la misma de WhatsApp), también
  lo citado (`citas: true`: en un guion, «…» lo escribió MaKo, no la persona), y la respuesta del chat siempre va en «tú».
- **Lo que nadie pidió se saca solo:** «un reel de 30 segundos» salía con «Notas de producción» y «Variantes rápidas». Una sección
  nueva de notas o variantes que el pedido no nombra no entra (`sinExtrasNoPedidos`), sin descartada (frenaría el «se acepta sola»).

## La llamada con Leila: lo lento, enlazar con otras funciones y el YouTube sin transcribir (13/11/2026)

- **⚠️ «Tarda mucho en abrir» era la portada, y su caché no funcionaba nunca.** Medido en producción: la portada daba 4,9 s
  hasta el primer byte en CADA apertura, con 1,18 MB, contra 0,5–1,1 s de abrir una página o de «Nuevo copy». El 11/11 se le
  había puesto una caché de 5 minutos, pero era un `Map` en memoria y en Vercel casi nunca se cae en la misma instancia: el
  diagnóstico «ya está cacheada» era el equivocado. Ahora usa `cachedRead` (compartida entre instancias, por negocio).
  Regla en AGENTS.md («Y en Vercel, esa caché casi nunca acierta»).
- **«Nuevo copy» no era lento: lo lento era ELEGIR la plantilla** (2 s hasta la pregunta de MaKo). Se reparte así: crear la
  página 0,76 s, pedir la página nueva al server 0,6 s, el código 0,3 s y 0,4 s de leer un chat que todavía no existe. Lo
  último se saca: una página recién creada en la pestaña no espera su chat (`marcarRecienCreada`, app/copywriter/pedido-guardado.ts).
- **Enlazar, no rehacer:** después de replicar, «Hacerlo con tu avatar IA» y «Hacerlo carrusel». Ninguna de las dos funciones
  recibía un guion. El avatar lo toma de `sessionStorage` (lib/guion-pasado.ts, no por la URL) cuando abre un proyecto, y abre
  tu último avatar listo. Image arma las láminas con `crearCarruselDesdeGuionAction` (la tabla de un carrusel, o una lámina por
  sección: lib/copywriter/hacia-otras.ts). **Trampa:** `app/image-editor/ruta.ts` no se importa fuera del editor
  (tests/image-editor-integracion 4: «carga el motor»), aunque es una función de una línea; la ruta va escrita.
- **El YouTube que no se transcribía:** la transcripción EXISTE (Competitors Spy, con el Gemini del negocio, 20 por día), pero
  Copywriting nunca la pedía. Ahora, al replicar un video sin transcribir, la pide y la espera hasta 4 minutos
  (app/copywriter/transcribir-original.ts). Después queda en «Ver el original». Si no se puede, MaKo lo dice y escribe con el
  título y la descripción. Un tema que no tiene que ver con el negocio (los «7 ejercicios de bíceps») se escribe sin preguntar,
  con sólo el gancho y la estructura, y se dice.

## El relevo: «escribe casi cualquier cosa» era la OFERTA VACÍA (13/11/2026, relevamiento en producción antes de tocar código)

Martín: «no me hace las preguntas… no está transcribiendo… al hacer la transformación del copy a la oferta, tampoco me pregunta
sobre qué oferta, incluso escribe casi que cualquier cosa». Recorrido como alguien nuevo, con capturas (side-session-notes/…/
probar-copy-relevo/relevamiento.md y la maqueta del flujo nuevo, que Martín revisa antes de programar).

- **⚠️ El diagnóstico obvio (el modelo, el prompt) era el equivocado.** Las dos ofertas del negocio de Martín tienen sólo el NOMBRE
  (sin promesa, qué incluye, para quién, precio ni pruebas), ninguna es principal y el negocio no tiene contexto cargado. Y aunque
  lo tuvieran, a MaKo le llega el nombre de la oferta en el pedido; lo demás sale de una BÚSQUEDA en el Second Brain
  (lib/negocio-para-crear.ts), no de la oferta elegida. Con un nombre solo inventa: un dominio, «Soy MaKo, el copywriter de MaKo»,
  «un checklist gratis». **Regla:** la oferta elegida va ENTERA al pedido; si está vacía, se pregunta antes de escribir.
- **Replicar no preguntaba nada** (decisión del 11/11, «sin preguntas»), y con un tema ajeno copiaba el canto: la «Maratón 2026»
  salió «¡Dale! ¡Dale! ¡Dale!». Martín lo corrigió el 13/11: antes de escribir, la oferta y, si el tema no tiene que ver, cómo
  adaptarlo (memoria `replicar-deja-todo-escrito`).
- **La transcripción casi no existe donde se replica:** 2 de 48 reels, 0 de 48 YouTube, ningún anuncio en video. MaKo replicó un
  video de 8 capítulos leyendo su descripción y dijo «Repliqué la estructura entera».
- **La portada no es del negocio:** para uno de marketing, fitness y autoayuda arriba, y 35 de 48 carruseles en inglés.

## Qué quedó sin hacer

- (13/11/2026) Si MaKo PREGUNTA cuando el tema del original no tiene que ver con el negocio lo decide Martín; hoy no pregunta
  (lib/copywriter/outliers.ts, `reglasDeLaReplica`).
- (13/11/2026) La portada sigue mandando 1,18 MB (300 por formato, en la grilla del chat de los outliers). Y la página nueva todavía
  se pide al server después de crearla (0,6 s): el `crear` ya devuelve la página y se podría mostrar sin esa vuelta
  (app/copywriter/Copywriter.tsx).
- (13/11/2026) «Hacerlo carrusel» arma siempre con el estilo «Lista o tips»; sin un avatar listo, el guion espera en silencio a
  que haya uno (app/ai-avatar/Estudio.tsx).
- (13/11/2026) La transcripción pide el acceso de Competitors Spy (`soloAdminDeTab('market-an')`): sin él, la réplica dice
  «no autorizado» y escribe con la descripción.

- (13/11/2026) Un negocio que declaró un acento que vosea sigue con el aviso de la mezcla: `alTuteo` va hacia el «tú», no hacia
  el «vos». Y la segunda pasada pide hasta 2.000 palabras: una clase de 42 minutos (6.300 dichas) sigue siendo un resumen de sí misma.
- (13/11/2026) Los imperativos de voseo en -í («escribí», «compartí») no se pasan solos (también son pretérito); quedan con aviso.
- (13/11/2026) Una vez, en el teléfono, la Página quedó corrida a la derecha justo después de escribir la plantilla; no se repitió
  y la medición después daba `scrollX = 0` (captura 28b de la segunda vuelta).
- (13/11/2026) La Clase escribió «un funnel que vende sin anuncios pagos» para una oferta llamada «WhatsApp Ads Funnel»: lo que
  la oferta del negocio dice no alcanza para que no se contradiga.
- (12/11/2026) ~~La mezcla de «vos» y «tú» no tiene capa 2~~: la tiene desde el 13/11 (9e5a80238), con la lista corta de arriba.
- (12/11/2026) Los reels con «su pie» (46 de cada 48 en la portada del negocio de MaKo), todos los carruseles y todos los
  YouTube se replican sin lo que se DICE en la pieza: la estructura real no está. Transcribir al replicar sigue pendiente.
- (12/11/2026) Un pedido puntual («usa el testimonio en la Solución») a veces toca otra sección que no se pidió.
- (12/11/2026) La respuesta de «Editar» no guarda lo que escribió el modelo antes del saneo: cuando algo se descarta, no hay cómo
  ver qué mandó (lib/copywriter/ia.ts).

- La búsqueda web con fuentes de mila.gg (MaKo no tiene una para los chats): docs/diseno-copywriter.md → «Qué queda».
- Versiones guardadas del documento (hoy: deshacer, y la foto de antes mientras hay una propuesta de MaKo).
- Mudar las preguntas de MaKo al patrón común «MaKo toma la iniciativa» cuando el Cerebro lo arme: hoy los pasos salen de
  lib/copywriter/iniciativa.ts y PanelMaKo los dibuja. Y app/_crear/ejemplo.ts (de Create) todavía dice que el
  Copywriter abre con «Adaptar a mi negocio» y «Solo la estructura»: el Copywriter ya no lo usa.
- La calidad de las guías de cada sección (lib/copywriter/plantillas-guias.ts) se revisó a ojo: el test fija que estén,
  que sean cortas y sin voseo, no que digan lo correcto.
- Los `evals` del experto (un pedido, la salida esperada y sus verificaciones): la calidad de «adaptar» no tiene prueba
  automática. Y los ejemplos de las VSL ocultas (`vsl-anti-solucion`, `vsl-diagnostico`, `vsl-historia-fundador`).
- Las cifras de los ejemplos contra la tabla del elenco (docs/plantillas-reales/README.md, 2.2) se revisaron a ojo: no
  hay test.
- El arrastre del árbol de Notion (reordenar y anidar páginas) se perdió al entrar al shell único de Create (su lista es
  plana): docs/diseno-copywriter.md, D15. Retirar `/m/stories`, `/ideas` y el «pronto» de YouTube Writer del teléfono (sin
  fila, todavía vivos; lib/movil-rutas.ts, lib/movil-creacion.ts y sus tests).
- Borrar StoriesApp/OnboardingStories (sin entrada desde el 29/10) y decidir qué pasa con la matriz y «Analizar guion» del
  Ads Writer (siguen por su ruta).
- `grafoParaChat` ya está en main (lib/cerebro-para-chat.ts, c272b97dd): falta cambiar `const GRAFO` en lib/copywriter/contexto.ts (docs/plantillas-reales/README.md, tanda 0).
- Las bajas de la verificación de la mudanza (C:/dev/revisiones/2910-verificacion-mudanza-copywriter.md):
  - `crear` (lib/copywriter/server.ts) borra el documento si el índice «falla», aunque haya llegado: abre «No existe» (B7);
  - el link compartido de una página cuya madre está en la Papelera sigue editando: app/api/compartido/guion/route.ts
    mira sólo `pagina.papelera`; falta `escondida(paginas, id)` (B6);
  - después de mudar, /copywriter abre una página mudada y no la última del usuario: nacen con `actualizado = ahora` (B3);
  - con el índice casi lleno no entra nada y la marca queda «hecha» con 0 (B4);
  - un `reels.historial` con JSON roto se toma como «no hay» (B5).
- «Compartir para editar» desde el teléfono del dueño (la vista del guion del teléfono no tiene el menú ⋯): D9.
