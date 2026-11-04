# Hallazgos — el Dashboard (el editor de informes)

La tab Dashboard es un editor de informes copiado de Looker Studio: hojas, 41 tipos de gráfico, estilo
por página, controles (filtros) y los conjuntos de datos de MaKo. **El editor es de Looker; los gráficos
son de MaKo** (Martín, 11/10: «que los graficos editables se parezcan más a esos» — los de las tabs
viejas). El informe inicial es la réplica de las tabs viejas de Marketing y Comercial; las tabs de
Analysts (Ads, Landing, Closing, Productividad) son plantillas de «Nueva hoja». Lo que se hizo está en
el commit; acá va lo que hay que saber **antes** de tocarlo.

## Cold Calling: un botón que ES la hoja, y un conjunto que cuenta lo que marcó la persona (4/11/2026, nube)

**Vive en:** `lib/graficos-plantillas-generales.ts` (la plantilla `cold-calling` y su campo `acciones`), `lib/graficos-fuentes-extra.ts`
y `lib/graficos-datos-extra.ts` (`llamadas_grabadas`), `lib/grabar-llamada-reglas.ts` (`filaDeLlamadaGrabada`), `lib/graficos-acciones.ts`
(`grabar_llamada`, `arriba`), `lib/graficos-portadas.ts` (`comoDenso`), `app/dashboard/ElementoAccion.tsx`, `app/_components/grabar/GrabarEnFrio.tsx`,
`tests/cold-calling.test.ts`.

Martín: «un dashboard template que sea "Call Calling"», con el mismo botón de grabar de la ficha del lead. Se leyó como Cold Calling.

- **La composición densa manda los botones AL PIE** (`sueltos` en `comoDenso`): está bien para «Sincronizar llamadas» de Closing y
  dejaba «Grabar llamada», que es para lo que existe la hoja, al final. Ahora la acción lo declara (`arriba: true` en
  `ACCIONES_ELEMENTO`) y entra PRIMERA en la fila de números; las demás siguen al pie (el test 4 lo fija con la de Closing).
  ⚠️ **No a lo ancho**: la primera versión la ponía en una franja de 12 columnas arriba, y `tests/graficos-corbel.test.ts` la frenó
  («abre con algo a lo ancho»): Martín rechazó el bloque gigante primero. Por eso el molde es Moorly, que abre con números.
- **Sugerirla por el canal «llamadas» le sacaba el lugar a Marketing** a quien vende por llamada con leads de anuncios (entrantes).
  Cold Calling es para quien sale a buscar: se sugiere sólo por la entrada «escribes tú primero».
- **Un botón no pasa por la puerta de la IA**, que es la vara de las piezas de una plantilla general (`deIAHoja` en
  tests/graficos-ia.test.ts). Por eso va en su propio campo, `acciones`, y el test que cuenta las piezas lo suma.
- **«Contestaron» sale de lo que marcó la PERSONA al cortar** (no contestó, habló, agendó, no le interesa). Una llamada sin marcar
  cuenta en «Sin marcar», nunca como «no contestó»: si no, la tasa de contacto baja sola cada vez que alguien se olvida de tocar.
- **La entidad es el LEAD, no la grabación**: el detalle de un número lista leads y cada uno abre su ficha, donde están sus
  grabaciones con la transcripción. La ficha de una llamada del Dashboard (`FichaLlamada`) se nombra por un `recording_id` positivo
  (`contextoDeClic` pide `^\d+$`) y la de una grabación es negativa.
- **Sin la migración 0390 el conjunto lo dice** («todavía no está lista»), con `SinConexionError`: un «0 llamadas» se lee como un dato.
- **El color es nuevo (Pizarra)**: los de la tabla ya nombran un tema (el último libre, Noche, lo tomó Inmobiliaria el mismo día) y el magenta es de Instagram.
- **El teléfono no dibuja los botones de una hoja**: ahí la grabación vive en la ficha del lead. Y una llamada hecha desde ese mismo
  teléfono no se graba igual (Android e iOS cortan el micrófono), así que Cold Calling se graba desde la computadora.

## El catálogo copia estructuras, no una sola (1/11/2026)

Martín: «Todos los templates son iguales, no uses siempre el mismo... no me gusta que no haya variedad, si copiamos muchos templates». Las medidas, los moldes y la asignación con su porqué: `docs/diseno/densidad-codeandchill.json`. El motor: `MOLDES` y `comoDenso`, en `lib/graficos-portadas.ts`.

- **⚠️ LA COHERENCIA NO ES LA FORMA.** La regla «lo que cambia entre hojas es qué mide, nunca el orden» se puso para evitar un muestrario de quince idiomas, y dio trece miniaturas idénticas. Lo que hace que sea una app son los tokens, la letra, el radio, la curva y lo que significan los colores. La forma sale de lo que la hoja mide.
- **Medir una sola referencia hace creer que es «la» referencia.** Corbel son 5 paneles; las demás, de 7 a 12. Y lo más común de lo medido es abrir con un gráfico a lo ancho (6 de 15): no se usa porque Martín rechazó «el bloque gigante primero», no porque la referencia no lo tenga. Está escrito para que nadie crea lo contrario.
- **La tienda no dibuja sus miniaturas: son videos** (`<video muted loop preload="none">` con póster, 16:9). Doce no cuestan nada. Acá la miniatura es la hoja de verdad en chico, así que se animan las piezas de Recharts ya dibujadas, sólo mientras se ve (`CSS_MINIATURA`). Son unas 190 animaciones de SVG con trece a la vista. **No se midió cuántos cuadros da**: si se arrastra, el camino es grabar los videos.
- **El acomodo según el ancho se calcula al dibujar y nunca se guarda** (`lib/graficos-acomodo.ts`). Es barato porque mirando la grilla no escribe (`alMoverGrilla`). Los cortes son del ancho de la grilla, no de la ventana: Corbel tiene 240 de barra y nosotros 68.
- **El título de la hoja se fue de la barra.** Con los chips del Dashboard unido no va: editando vuelve la fila, que es donde se cambia. Sin chips (el closer, un link compartido) se queda: sería lo único que dice en qué hoja estás. El subtítulo escrito sale al pasar por el chip y en el PDF.
- **⚠️ EL HOOK DE PUSH MIRA EL ÁRBOL DE TRABAJO, NO EL COMMIT.** Con plantillas borradas sin commitear, un push de un commit de sólo documentos da «`docs/api-mako.md` quedó viejo». Las plantillas salen en la referencia de la API. Se regenera con `node --import tsx scripts/generar-api-doc.mjs`, o se empuja desde un árbol limpio.

**Sin hacer:** una hoja GUARDADA conserva su acomodo y su título de datos: rearmarla pide el sí de Martín. Elegir en la galería una plantilla del otro informe abre su editor y la suma, pero no la ajusta a los datos del negocio como las del mismo informe. «KPIs», «Pendientes» y «El mes» no están en ninguna plantilla: se agregan desde «Bloques de General». «Buscar» y «Filtro» siguen a la vista: Martín los pidió el 17/10 y nadie lo revirtió.

## El estilo por defecto es Corbel, y sus valores no estaban en los JSON (31/10/2026)

**Vive en:** `lib/graficos-corbel.ts`, `lib/graficos-temas.ts`, `lib/graficos-portadas.ts` (`comoCorbel`), `docs/diseno/tokens-corbel.json`, `tests/graficos-corbel.test.ts`.

**Síntoma.** Martín: «Sigo viendo los templates viejos». Lo aplicado era el adentro del gráfico; las plantillas seguían con las tapas de color copiadas de Canva.

**El diagnóstico obvio estaba mal.** Parecía que alcanzaba con los cuatro JSON de `docs/diseno/` y que «el blanco y negro» era Pacely, por su acento casi negro. Pacely es piedra cálida con naranja. El que él describe es **Corbel con su paleta Mono**, y Corbel no está en esos JSON: se leyó el 31/10 con el navegador. Trae además las otras tres paletas (Pastel, Ocean, Sage), y su panel dice «Los colores de estado conservan su significado».

**Lo que hay que saber antes de tocarlo:**

- **El id `mako` ES el blanco y negro.** El id es lo que se guarda: redefinirlo pasa al estilo nuevo a toda hoja que nunca eligió otro, sin migrar nada. Lo que antes era «MaKo» sigue, elegible, como `vieja`.
- **El oscuro y las paletas salen de redefinir los tokens** adentro de `data-paleta`, como hace la portada. Las series son `var(--cb-c1, #hex)`: `aclarar` y los que hacen cuentas con hex tienen que aceptar una variable. El respaldo hace falta: el chat y la ficha del lead no tienen `data-paleta`, y por eso siguen con `vieja`.
- **Los tiles no se guardan: salen de la posición** (`tilesDeHoja`). Las hojas guardadas los traen solas; también la tarjeta negra, porque `acentoDePortada` pisa el color de su identidad. El color de cada plantilla (`COLOR_DASHBOARD`) sólo se ve con «Clásica».
- **El rayado NO se copió, a propósito.** En Corbel las columnas van rayadas de adorno; acá rayado es «Estimado» (`VOCABULARIO`), y una medición rayada diría lo contrario.
- **El número ya no llena la tarjeta:** 26 px, y 34 en la negra (`kpiMaximo`). Tampoco se pinta de verde o rojo: el significado lo dice el chip. Con los estilos de antes sigue como estaba.
- **El esqueleto de toda la app también es Corbel Mono** (`:root` y `[data-tema="oscuro"]` de `app/globals.css`). `varsDeTema` sólo escribe `--dash-*`: redefinir el estilo de la hoja, sin esto, no cambiaba las pastillas, el fondo ni los bloques de General, que dibujan con `--primary`, `--bg` y `--surface`. Martín, mirando una hoja: «no veo que haya cambiado absolutamente nada».
- **El tema `general` también lleva `escena: 'mono'`.** Las hojas de General guardan ese id, no `mako`: era el motivo de que la pantalla de la captura quedara afuera. Su acomodo sigue siendo el de `conPortada`, con la tapa a lo ancho.
- **`'Geist'` es Urbanist, por un `@font-face` en `globals.css`.** Hay 357 `'Geist'` a mano en 223 archivos y cambiarlos chocaría con todos los chats. La hoja de Google de `app/layout.tsx` ya no lo pide. `Geist Mono` sigue: Corbel no tiene mono y acá se usa para códigos.
- **Los radios son los de Corbel (8, 14, 22, 28), no los 10, 14, 18, 24 de las otras doce**, y la curva es `.2, .8, .2, 1`, no `.22, 1, .36, 1`: el estilo elegido es Corbel. El kanban usa los de Merrin, que es su referencia.
- **`--surface-2` es sólido a propósito** (`#f0f0ef`, `--well` sobre `--surface`): Corbel lo tiene con alfa, y acá hay encabezados de tabla pegados que dejarían ver lo que scrollea debajo.
- **Las series no son las cinco de la demo tal cual.** El `#c8c8c3` de Mono y el segundo de cada paleta con color no llegan a 2:1 sobre su superficie: se cambiaron por otro valor medido de la misma paleta. `tests/graficos-modelo.test.ts` mide cada color en su tema, y lee `--surface` del CSS. **El orden de Mono tampoco es el de la demo:** un anillo recorre la paleta por índice, y con cuatro canales usa los primeros cuatro. Medir sólo el orden completo daba 1,95 de peor vecino; el caso real con cinco series daba otro número. El test mide cada N de 2 a 6.
- **Los ids de los estilos y las letras pagan presupuesto de WhatsApp.** `PLANTILLAS_TEMA` y `TIPOGRAFIAS` van como `enum` en `cambiar_ficha_funnel`, que viaja en cada turno, y `tests/ficha-api.test.ts` le pone tope. Sumar un estilo al Dashboard puso rojo ese guardia. `--rapido` no lo corre: sólo sigue un salto de import.
- **Un tema candidato del taller le gana a todo esto** (`[data-tema-candidato]`, guardado en el navegador). Si alguien dice «no cambió», mirar primero `mako.tema-candidato` en su localStorage.
- **`docs/diseno-dashboards-codeandchill.md` todavía dice «no hay un solo valor suyo».** Eso es lo que `AGENTS.md` corrigió: los valores son el pedido.

**La composición es la de Corbel a 1440, y ahí no había portada.** Martín: «No es necesario tener esa barra negra gigante como encabezado… Y lo mismo con las cajas de abajo». Medido (`composicion_de_pagina` en `docs/diseno/tokens-corbel.json`): números en fila, negro 4 + gráfico 8, 7 + 5. Todo vive en `comoCorbel` (`lib/graficos-portadas.ts`).

- **⚠️ MEDIR EN UN PANEL ANGOSTO MIDE OTRA PÁGINA.** A menos de 1100 px Corbel colapsa a una columna, y esa medición («todo a 12 columnas, sin pares») se tomó por su diseño. Se reconoció reproduciéndola a 900. El viewport va en la medición.
- **La portada a lo ancho era invención nuestra**, y la revisión de las composiciones la conservó porque «hay que terminar el patrón que empezó el código». El patrón a terminar es el de la referencia.
- **El negro va sólo en un tercio** (`pintaPortada`). Lo que no entra va en vidrio, también la tapa de 12 × 11 de una hoja guardada: cambia cómo se dibuja, no se le mueve nada. Con «Clásica» sigue.
- **⚠️ UNA HOJA CREADA DESDE LA GALERÍA SALÍA DISTINTA DE SU MINIATURA.** `instanciarPlantilla` pone ids nuevos, que no terminan en el local, y `esLocal` no encontraba la pieza: la portada no se aplicaba, sin error. Lo mide `tests/graficos-corbel.test.ts` comparando las dos.
- **Nada se borra:** lo que no entra va en «Más detalle», plegado. Lo plegado sale de la grilla (`lib/graficos-secciones.ts`).
- **General usa lo mismo.** `conPortada` quedó sin uso en las plantillas. Dos bloques van de a par sólo si piden el mismo alto: estirar uno es espacio en blanco.
- **`cartera`, `proyectos` y lo de `actual` van como `numero`:** sin rango, la línea saldría plana en cero.

**Límite: los cortes de Corbel no están.** Tiene 5 + 7 a 1320 y todo a 12 a 1100; el editor es un solo `ReactGridLayout` de 12 columnas, con la pila debajo de 640. Entre 640 y 1320 se ve el acomodo de escritorio, más angosto. Tenerlos pide dibujar con otro acomodo por ancho sin tocar lo guardado.

**Una hoja guardada conserva su acomodo.** Rearmarla es escribir en sus datos, y necesita el sí de Martín.

**⚠️ UNA CAPTURA CON EL PANEL OCULTO INVENTA ROTURAS.** El recorrido de producción acusó tres cosas en la hoja General; dos no existían, y la tercera tenía otra causa que la sospechada.

- **La grilla cortada a la derecha era la transición congelada.** `useContainerWidth` arranca en 1280 y la grilla anima `left, top, width, height`. Con el panel del navegador oculto la página corre de fondo y la animación no avanza: a 900 de ancho, `style.width` decía 403 y el rectángulo 632. Para medir: leer `style.width` o apagar las transiciones. También `ResizeObserver` se atrasa: un cambio de tamaño sin recargar dejó la medida vieja.
- **La estrella encima de «El mes» era la copia que vuela** del loader a la barra (`.cm-vuelo`, `app/_ui/VueloDeCarga.tsx`, 420 ms). La de la barra estaba en su lugar. Deducido por el recorrido: la copia se vio en vuelo y 4 s después ya no estaba, pero no congelada sobre ese título.
- **⚠️ LA ACCIÓN DEL DÍA SÍ SE SALÍA, Y EL DIAGNÓSTICO OBVIO ERA FALSO.** Se sospechó de Urbanist «más ancha», y es al revés: un 8 % más angosta que Geist en esa frase. Con 6 × 7 y 90 letras, a 1440: Geist 5 líneas y 48 px afuera; Urbanist 4 líneas y 18. Ya estaba rota. La causa: `.gb-frase` toma el tamaño del ancho (`cqi`) y lo que no entra se decide en el alto.
- **Cambiar la composición no la arregla:** la hoja guardada conserva su acomodo. Por eso se mide lo que hay (`app/general/bloques/frase-que-entra.ts`). Con `cqh` no se puede: `container-type: size` deja sin alto a la pila del teléfono.

**Sin hacer:** el salto de la grilla al abrir. Sin `measureBeforeMount`, `useContainerWidth` dibuja a 1280 y después anima al ancho real (`app/dashboard/EditorInforme.tsx`, `useContainerWidth()`). Con esa opción la grilla ya no sale en el HTML del servidor, así que hay que mirarlo con el panel a la vista. A 673 × 180 la frase llega al piso de 23 px y el botón se corta 29 px: esa medida no está en ninguna hoja guardada de hoy.

**`gb-cabe` no dibuja la fila que no entra, y eso no se ve en ningún test de datos.** En «Tareas prioritarias» de cinco entran tres. Ahora la lista lo dice («y N más en el Plan»), sólo en tareas y deadlines; Agenda y Norte siguen sin decirlo.

**Sin hacer:** el medidor de arco de su tarjeta negra y el espaciado en CRM y Kanban. La aparición de las tabs no se vio con una navegación real: el arnés no tiene rutas.

## Una métrica de prueba A/B en el Dashboard: el formato la redondea a 0 y la dimensión «Variante» está vacía (25/10/2026)

**Vive en:** `lib/experimentos-formato.ts`, `app/dashboard/ElementoExperimento.tsx`, `lib/graficos-catalogo.ts`, `lib/graficos-datos.ts`.

- **`fmtVal` no conoce una métrica fuera del catálogo** (`ab:*`): cae en 'num' y `Math.round(0.09)` da 0. El elemento dice
  «antes / ahora», que no es lo que compara una prueba (A / B). Se formatea por el prefijo `ab:`, no sumándola a
  `lib/experimentos-catalogo.ts`: ese catálogo lo lee la IA que propone experimentos y empezaría a proponer pruebas A/B.
- **La dimensión «Variante» lee `prueba` del Pixel**, que es la marca del probador (`?mko_test`) y se descarta en todas las
  lecturas: por eso siempre queda vacía.

*25/10/2026, el Cerebro (claude5), con los relevamientos de pruebas A/B y de conexiones (docs/diseno-pruebas-ab.md, docs/conexiones-y-ayuda.md).*

## «Analizar con MaKo» sale de la barra; el AI Analyst queda en el ⋮ hasta que Martín decida (24/10/2026)

**La lección, que es más grande que el caso:** un pedido de «sacá esto, ya lo cubre aquello» se MIDE antes de borrar;
lo que un botón hace y lo que parece que hace no son lo mismo. Borrado a secas, Martín perdía el análisis programado, el
aviso de «nuevo» y la única forma de que MaKo mire una hoja entera con sus filtros, y aparecía una semana después como
«¿y dónde está el análisis que me llegaba los lunes?».

**El pedido** (Martín, 24/10): «El botón de "Analizar con MaKo" debería eliminarse completamente y también en el
dashboard, porque para eso ya tenemos el chat de la criatura de MaKo... Y justamente tenemos la opción de
"Discutir/editar"». El pedido da por hecho que la criatura ya hace lo mismo. **Medido en el código, no lo hace:**
- **La hoja entera, con la vista puesta.** El analista analiza la hoja entera, o los gráficos elegidos, con el período y
  los filtros que la persona tiene puestos. La criatura del Dashboard (`MakoEnLaTab`, EditorInforme.tsx) recibe la hoja
  sólo como un id en el system: los datos le llegan de UN gráfico cuando se toca su botón de MaKo
  (`contextoDeGrafico`), o si el modelo decide llamar `leer_hoja_dashboard`, que lee sin la vista.
- **Las cifras salen de los datos.** El analista toma las cifras de la entrada guardada y no del texto del modelo
  (`sanearSalida`), y cuenta lo que descartó. El chat es texto libre.
- **Se programa.** Cada día, semana o mes. Además tiene el punto de «análisis nuevo» (`useAnalisisNuevo`), avisa «la
  hoja cambió desde este análisis», y dispara a mano el evento `analisis_listo`, del que vive la plantilla de Automations
  «El AI Analyst Terminó».
- **En el Dashboard la criatura no tiene «Discutir/Editar».** Se monta sin `onModo`. Esos modos son del chat de
  Automations (`ChatMako`), que tampoco ve métricas.

**Lo que se hizo:** sale el BOTÓN de la barra (mirando estaba al lado de la estrella: un segundo MaKo), en el Dashboard,
en General y en las Métricas de una automatización. El AI Analyst queda en el ⋮, como ya decía su pedido del 18/10
(docs/feedback-diseno-pendiente.md). **Sacarlo también del ⋮ lo decide Martín**, con lo que se pierde dicho en palabras:
se le llevó por el Cerebro el 24/10. Si dice que sí, ANTES hay que darle a la criatura lo que hay en pantalla: una prop
con `loQueSeVeDe` o `contextoDeGrafico` y la vista, que la ruta sume al contexto del turno.

**Dos trampas encontradas al medir:**
- **La hoja abierta no le llega a la criatura.** La entidad «hoja» declara el parámetro `hojaId` (lib/chat-desde.ts),
  pero las herramientas del Dashboard lo llaman `hoja` (lib/api-mako/areas/dashboard.def.ts). Entonces
  `conEntidadPorDefecto` no mete la hoja abierta, y todo depende de que el modelo obedezca «usa ese id».
- **Los hilos guardados y el aplicar/deshacer son de «Editar con MaKo», no del analista.** `CLAVE_HILOS`
  (app/dashboard/hilo-guardado.ts) y `onAplicar`/`onDeshacer` son de `PanelEditarMako`: sacar el analista no los toca.
  `PanelAnalista.tsx` no se puede borrar entero: de ahí salen `CSS_PANEL_LATERAL`, `ChatMakoGrafico` y el tipo
  `LoQueSeVe`.

Test: tests/metricas-una-barra.test.ts y tests/dashboard-mako-vista.test.ts.

**Martín decidió (24/10/2026, trabajo 0786cbfe): «Sí, y que la criatura vea la hoja».** Hecho esa noche (claude5, rama
`aut-2510`), en el orden que pedía la lección de arriba: primero darle a la criatura lo que hay en pantalla, después
borrar. **Antes de borrar se midió lo que se perdía:** 0 filas en `dashboard_analisis` (base principal, la del ws1 y la del
ws13): nadie lo había programado ni usado nunca, así que el análisis programado y su punto de «nuevo» se fueron sin
dejarle nada a nadie.
- **Lo que ve la criatura:** `pantallaDeHoja` (app/dashboard/exportar.ts) arma cada gráfico de la hoja abierta con
  `contextoDeGrafico` (período, filtros y números, sin personas) y UN alias para toda la hoja: con un alias por gráfico,
  «Cliente 1» era una persona distinta en cada uno. Viaja en `Desde.pantalla` (lib/chat-desde.ts) con cada mensaje de la
  estrella, saneado y con tope (12.000), y `contextoDesde` lo pone en el system como DATOS. No se guarda en el mensaje.
- **La trampa de `hojaId`, arreglada:** `ENTIDADES.hoja.param` pasó a `hoja`, el nombre que usan las herramientas.
- **Salió todo lo del analista:** el ⋮, el clic derecho del lienzo (`MenuContextual`, que también lo ofrecía), el panel,
  el «Analizar · Editar» de «Editar con MaKo» y la guía del ⋮ que lo nombraba. Un pedido de análisis en «Editar con MaKo»
  ahora manda a la estrella (`GUIA_ANALIZAR` y la respuesta de `aplicarEdicion`): antes decía «lo hace el modo Analizar»,
  que ya no existe. El evento `analisis_listo` y la plantilla «El AI Analyst Terminó» siguen en el catálogo, sin nadie que
  los dispare desde la pantalla. **Sin hacer:** sacarlos del catálogo de Automations, y ver en pantalla la respuesta de la
  estrella con una hoja de verdad (no se levantó `next dev`: la PC tenía 2 GB libres).
Test: tests/estrella-ve-la-hoja.test.ts.

**Dos defectos que salieron de la misma medición (arreglados el 24/10, tests/metricas-analisis-programado.test.ts):**
- **El análisis programado de una hoja de Métricas se borraba solo.** La hoja de Métricas era `am-hoja` en TODAS las
  automatizaciones, y el AI Analyst guarda lo suyo por persona y hoja (`dashboard_analisis.hoja_id`). El cron la buscaba
  sólo en el Dashboard y en General (`leerInformeGuardado`): no la encontraba, cerraba con «La hoja ya no existe» y le
  sacaba el horario. Quien programaba un informe semanal nunca lo recibía, y la programación desaparecía. Es la peor
  clase de falla: silenciosa, y borra la evidencia. Además, el análisis de una automatización salía en las Métricas de
  otra. **Arreglo:** la hoja es `am-<id>` (`hojaDeMetricas`). El cron la busca en el informe de ESA automatización para
  ESA persona, o en la que arma MaKo si nunca la tocó (`hojaDeMetricasGuardada`). Lo guardado con `am-hoja` se renombra
  al leer, y el aviso «Terminó» lleva a la automatización. Medido el 24/10: no había ningún análisis ni informe de
  Métricas guardado, así que no hubo nada que migrar.
- **«Compartir» en las Métricas entregaba el Dashboard ENTERO.** El server (app/api/compartir/route.ts) comparte el informe
  del Dashboard de quien mira, con todas sus hojas, y el `?hoja=` de la automatización ahí no existe. Quien creía
  compartir las métricas de una automatización mandaba su Dashboard. Era peor que un link roto. Se sacó de ahí, y
  también del clic derecho («Copiar dashboard» tampoco aplica: `fueraDelDashboard`). Compartir las Métricas de verdad
  pediría un recurso de share propio, con su vista pública: no se hizo.

## «Pídeselo a MaKo» en General arma una hoja con tipos del Dashboard (16/10/2026, leído, no probado en el navegador)

- «Pídeselo a MaKo» manda sólo `{pedido}` (`app/dashboard/NuevaHoja.tsx`), `lib/graficos-ia-generar.ts` no conoce General
  y ni `sanearHoja` (`lib/graficos-catalogo.ts`) ni `guardarTableroSi` miran `TIPOS_GENERAL`, que sólo usa el editor. O
  sea: General guarda una hoja con tipos del Dashboard, contra «General ofrece poco del Dashboard».
- **Ejecutar una operación del Dashboard por la API escribe en el servidor y deja afuera la pila de deshacer**: con el editor
  abierto hay dos escritores y el autoguardado da 409 o pisa. Por eso `app/api/graficos/ia/route.ts` NO escribe. **Regla
  para un chat que edita la hoja abierta:** la acción confirmada devuelve el informe cambiado y el editor lo aplica con
  `mutar` (un solo escritor, el Ctrl+Z vivo). Por WhatsApp y HTTP sigue escribiendo. Ver `docs/diseno-mako-ai-native.md`, (b).

## Cómo está armado, en una tabla

| Pieza | Vive en | Qué decide |
|---|---|---|
| El modelo | `lib/graficos-catalogo.ts` | Conjuntos, tipos, hojas (emoji, subtítulo, tema, controles), `efectivoDe` (la precedencia de filtros), los campos COMPARTIDOS. Sin `server-only` |
| Las plantillas | `lib/graficos-plantillas.ts` (+ `-analysts`, `-generales`) | El informe inicial con ids FIJOS y la galería de «Nueva hoja» |
| El estilo de la página | `lib/graficos-temas.ts`, `app/dashboard/PanelEstilo.tsx` | 6 plantillas de estilo; las tarjetas leen `--dash-*` |
| El agregador | `lib/graficos-agregar.ts` | De filas a lo que se dibuja; también `tramosDeDias` |
| Los lectores | `lib/graficos-datos.ts`, `lib/graficos-datos-extra.ts`, `lib/graficos-lectura.ts` | Uno por conjunto, con el workspace explícito; `leer` trae un instante en tramos a la vez |
| Lo que quedó de los bloques | `lib/datos-comercial.ts` (puro), `lib/datos-comercial-server.ts` | Revenue y «A quién cobrarle» con las lecturas de siempre: los lee el teléfono. Los bloques se borraron el 13/10 (los migra el saneo, v5) |
| La audiencia y el mapa | `lib/graficos-audiencia.ts`, `lib/meta-desgloses.ts`, `app/dashboard/MapaMexico.tsx` | Meta EN VIVO; el mapa también lo usa el Ads Manager |
| Los controles | `app/dashboard/BarraControles.tsx`, `valores.ts`, `lib/graficos-controles-texto.ts` | La fila de filtros de la topbar y los chips de cada gráfico |
| La topbar | `app/dashboard/Cabecera.tsx` | Título, emoji y subtítulo editables en el lugar, el desplegable de hojas, los filtros, Compartir, Editar y el ⋮ |
| La pantalla | `app/dashboard/EditorInforme.tsx` (+ `Grafico`, `Detalle`, `Elemento`, `NuevaHoja`, `Propiedades`) | El editor; `editor-css.ts` es su hoja de estilos (sólo tokens) |
| Compartir por link | `app/dashboard/CompartirInforme.tsx` (el modal es el de `app/conocimientos/Compartir.tsx`), `app/compartido/[token]/informe-*.ts`, `app/api/compartido/graficos` | Qué ve quien abre el link, sin sesión y en sólo lectura |
| Exportar | `app/dashboard/exportar.ts` | El CSV de la hoja, el PDF (`window.print`), y lo que viaja a MaKo sin nombres |
| AI Analyst | `lib/graficos-analisis*.ts`, `app/dashboard/PanelAnalista.tsx`, mig 0247, `/api/cron/dashboard-analisis` | El análisis a mano o programado |
| El informe de cada persona | `lib/graficos-tablero.ts` | `graficos.tablero.<usuario>` en el workspace de la pestaña |

## El informe se guarda por PERSONA y por workspace, no por workspace

**Vive en:** `lib/graficos-tablero.ts`

El super admin mira a cada cliente con `?ws=N`: guardado por workspace, armar un gráfico mirando a otro
le cambiaba la vista al dueño de esa cuenta. La clave lleva el `sub` de la sesión.

⚠️ **«No pude leer» no es «no armó ninguno».** Con la lectura caída se dibuja el inicial y NO se deja
guardar: el primer cambio pisaría el informe real.

⚠️ **Verificar la pantalla ESCRIBE, y la limpieza se acota al usuario de PRUEBA, nunca al prefijo.**
El 11/10 una limpieza por `graficos.tablero.%` se llevó `graficos.tablero.2`, el de Mauricio. La
limpieza borra sólo `graficos.tablero.dev` y las filas de `dashboard_analisis` con `usuario = 'dev'`.

## Mirar el Dashboard lo GUARDABA, y una copia guardada no recibe las mejoras del inicial

**Vive en:** `alMoverGrilla` en `app/dashboard/EditorInforme.tsx`

react-grid-layout avisa `onLayoutChange` también al MONTAR: abrir la tab congelaba una copia del inicial.
La grilla sólo escribe editando (`if (!editando) return`, con guard). ⚠️ **Al cambiar el informe inicial,
mirá quién ya tiene uno guardado** (`key like 'graficos.tablero.%'`): a esa gente no le llega. Y un
informe NUEVO se le escribe a alguien **después** del deploy: la versión anterior desplegada lo leería
con su propio saneo.

## La barra de filtros «pegada» no pegaba, y los tests estaban en verde

**Vive en:** `app/dashboard/page.tsx` (el `<Pagina>`), `.lk-lienzo` en `app/dashboard/editor-css.ts`

⚠️ **Desde la topbar (11/10, a la tarde) la fila de filtros ya no es sticky:** vive en `.lk-top`, que está
fuera de lo que scrollea, y `.lk-controles` no existe más (`tests/dashboard-pantalla.test.ts` frena que
vuelva adentro del lienzo). Lo de abajo sigue valiendo para `.lk-lienzo`, que es lo único que scrollea.

La barra era `position: sticky` contra `.lk-lienzo` (`overflow-y: auto`), y tres aserciones lo fijaban.
Medido en Chrome el 11/10: tras la rueda la barra quedaba en **y = −1079**. El sticky estaba bien; lo que
fallaba es que `.lk-lienzo` **nunca scrolleaba**: `Pagina` trae `flex: 1` (base 0%), que en la columna
del layout ANULA el `height: 100vh`, así que el `<main>` crecía a su contenido (2405 px) y el que
scrolleaba era el documento. Va `flex: 'none'` + `height: '100dvh'` + `overflow: 'hidden'` (las
Automations ya lo tenían escrito en `ChatAgentApp.tsx`), y el `@media print` lo desarma para el PDF.
**Un sticky se verifica scrolleando; un `overflow: auto` sólo scrollea si alguien le da ALTO.**

## Los filtros: el control del gráfico REEMPLAZA al de la hoja

**Vive en:** `efectivoDe` en `lib/graficos-catalogo.ts`; `nuevoControlPara` en `lib/graficos-controles-texto.ts`

- El período: control del gráfico > período propio > control de la hoja > 30 días. En el MISMO campo, el
  control del gráfico reemplaza al de la hoja aunque esté en «todos»; campos distintos se suman (AND).
- ⚠️ **Diagnóstico obvio equivocado:** «un control nuevo arranca en sus defaults». Agregar una lista
  vacía a un gráfico le SACABA el filtro de la página. El control nuevo copia lo que el gráfico ya mostraba.
- Lo elegido MIRANDO es estado de la vista: no pasa por `mutar`, no se guarda. Cambiar lo de ENTRADA de
  un control (barra o panel del gráfico) olvida lo elegido mirando en él (`olvidarVista`).
- **Los campos COMPARTIDOS son una lista POSITIVA y no avisan:** un conjunto nuevo con «Página» o
  «Closer» no lo filtra el control de la hoja hasta sumarlo al `en` del campo. Sin eso, la hoja Closing
  con su control «Closer» no filtraba ningún gráfico y cada tarjeta decía «no filtra por Closer».
- Una lista y una búsqueda sobre el mismo campo comparten clave: el saneo tira la segunda (`claveControl`).
- Con 300 valores, «todos menos uno» pasa `MAX_VALORES` (50) y el saneo lo recortaría: tildar desde
  «todos» deja SÓLO ese valor.
- `valoresDeCampo` traga el error de cada lector y contesta `[]`: la lista dice «No llegó ningún valor»,
  no «No hay valores». SIN HACER: que la ruta distinga los dos.

## Todo pop-up desde una tarjeta va por portal, y el portal no aísla

**Vive en:** `Capa` en `app/dashboard/piezas.tsx` (hasta el 13/10, `app/dashboard/bloques/piezas.tsx`); `Elemento.tsx`

- La grilla ubica las tarjetas con `transform` y `.lk-comp` lleva `overflow: hidden`: un `position:
  fixed` de adentro (un modal, un toast) queda pegado a la tarjeta y recortado, sin error. Va con
  `createPortal`, y la grilla usa `absoluteStrategy`.
- Un portal de React sigue burbujeando por el árbol de REACT: un clic seleccionaba la tarjeta y un
  mousedown la arrastraba. La envoltura frena mousedown, pointerdown, touchstart y click, y lleva
  `lk-no-arrastrar`. Las teclas se frenan con `stopImmediatePropagation` sobre el evento nativo.
- Un texto editable adentro de la grilla necesita tres cosas o se rompe callado: el `cancel` de la grilla,
  frenar el keydown (si no, Retroceso borra la TARJETA) y una marca `abierto` (un blur tardío guardaría lo
  descartado con Escape). Un `<img>` adentro lleva `draggable={false}`.
- Las formas se dibujan en píxeles midiendo la celda (`clientWidth`, no `getBoundingClientRect`, que trae
  el zoom), y el color va con `currentColor` + `color` en el style: un `var()` en un atributo SVG no está
  garantizado.

## La audiencia de Meta: lo que Meta da y lo que no

**Vive en:** `lib/graficos-audiencia.ts`, `lib/meta-desgloses.ts`, `app/dashboard/MapaMexico.tsx`

Medido el 11/10/2026 (Graph v25.0, cuenta del ws1):
- **Con `breakdowns=region` Meta no manda ninguna conversión de afuera** (ni la agenda ni
  `landing_page_view`): 0 de 33 filas. Las filas de región van SIN la clave `agendas`, no en 0. Por eso un
  cuadro de resultados de la audiencia (sin dimensión) lee **edad y género**, no la región: el KPI de
  agendas salía en 0.
- **Los nombres:** «Distrito Federal», «State of Mexico», «Coahuila de Zaragoza», «Michoacán de Ocampo»,
  «Querétaro Arteaga», «San Luis Potosi», «Unknown». Diccionario explícito → código ISO; corrige
  [hallazgos-ads.md](hallazgos-ads.md) («Mexico City» no apareció).
- **El mapa no se recorta al límite** (10 por defecto): pintaba 10 estados y 22 «Sin datos» teniendo
  datos. El diagnóstico obvio (los nombres) no era la causa de ESE síntoma.
- **La edad se ordena por tramo**, no por la métrica (`ordenEtiqueta` en la dimensión): salía 45-54,
  55-64, 18-24.
- **Un `since` a más de 37 meses es un ERROR** (#3018), no un recorte: «Todo» pide desde hoy −37 meses.
- **Sin `limit`, /insights devuelve 25 filas y un `paging.next` sin avisar** (limit 500 + paginado).
- **`credWs` sin workspace cae al ws1**, un cliente: un lector en vivo va con workspace explícito y
  `credWsEstricta` (la ruta vieja `/api/account-insights` tenía esa fuga; se cerró).

## «Marcar cobrada» y Comercial: la fecha y tres cuentas que estaban mal

**Vive en:** `lib/datos-comercial-server.ts` y `lib/datos-comercial.ts` (hasta el 13/10, `lib/graficos-bloques.ts` y `app/dashboard/bloques/`)

- **La fecha de cobro era distinta en cada camino** (CobrarTable el vencimiento, la API de MaKo y
  PayModal hoy). Con el vencimiento, marcar una cuota atrasada no movía el Cash del período mirado. Va
  HOY en la zona del negocio.
- Tres cuentas de la vieja Comercial que estaban mal sin error: «todo el pipeline» con `desde <= 2025-11-01`
  (choca con «Últimos 12 meses»); las cohortes con `limit` ANTES de filtrar (un período pasado salía
  vacío); las semanas desde el día 1 del mes. Y la barra cobrado/pendiente con 0 y 0 pintaba 100% rojo.
- **El Outstanding es el total de `getOutstandingDetalle` con la MISMA ventana**, no
  `getRevenuePeriod().outstanding_usd` (otro número). Una cuota vencida antes del período no aparece:
  igual que la tab vieja; para ver toda la deuda, «Todo».
- Deshacer «Marcar cobrada» devuelve el dato pero NO reabre los recordatorios que `marcarPago` cerró
  (`lib/pagos.ts`). Ver [hallazgos-crm.md](hallazgos-crm.md).

## Lo que se manda a un modelo: una lista POSITIVA, y la anonimización en el borde

**Vive en:** `dimensionPublica` / `etiquetaSegura` en `lib/graficos-analisis.ts`

- ⚠️ **Diagnóstico obvio equivocado: «el chat de MaKo ya oculta las personas».** Había una lista
  NEGATIVA en `exportar.ts`, y las dimensiones con nombres que sumaron después (`leads.lead`,
  `entrega.cliente`, `llamadas.llamada`, `tareas.tarea`, un «Cliente: …») viajaban al modelo. Una sola
  lista, POSITIVA: un conjunto nuevo viaja anónimo hasta que alguien declara pública una dimensión.
- Anonimizar ANTES de calcular una firma que se compara con la del dato real da un «cambió» para
  siempre. Los alias se aplican sólo en el borde hacia el modelo.
- `sanearGrafico` corrige EN SILENCIO (un tipo que no existe pasa a barras). Sobre salida de IA eso dibuja
  un gráfico que nadie pidió: `lib/graficos-ia.ts` descarta lo que no tiene arreglo y compara lo pedido
  con lo saneado. Los ids de lo que entra de afuera salen de `nuevoId`, nunca del dato.
- **El catálogo que lee el modelo creció en vivo** (8,9k → 11k caracteres) y dejaba a Groq fuera de la
  cascada sin error. Va en niveles que se aprietan solos, con un test que mide el techo.
- El AI Analyst no entra en `/api/graficos` (tope 60 s con las esperas de la cascada): ruta propia con
  `after()`. En un cron no hay sesión: la fila congela `que_tablero` al programar.

## La hoja Landing tardaba 51 s en abrir (el tope de la ruta es 60)

**Vive en:** `leer` en `lib/graficos-lectura.ts`, `tramosDeDias` en `lib/graficos-agregar.ts`

Medido el 11/10 desde la máquina local (ws1, 30 días): `vsl` 34 s (45.122 eventos) y `retencion_vsl`
47 s; el resto ≤ 8 s. ⚠️ **No era la base**: la consulta tarda 14 ms (`explain analyze`); es
`leerTodo`, que pagina EN SERIE (46 páginas de ~466 KB, ~21 MB). Desde Vercel, al lado de Supabase, es
menos, pero igual se paga en serie. `leer` ahora parte el período en 6 tramos de días contiguos que van a
la vez: mismas filas exactas (comparadas fuente por fuente), la mitad del tiempo. La tabla VSL se lee dos
veces por hoja (`vsl` y `retencion_vsl`) y otra para el bloque de la curva. SIN HACER: una vista
agregada por día.

## Productivity Analyst salió de la sidebar: lo que eso deja colgado

**Vive en:** `app/_components/nav.ts`, `lib/capas.ts`, `app/productivity-analyst/page.tsx`

- Sacar una tab deja CAPAS sin pantalla en silencio: `pm` y `superadmin` no tenían `graphics`, así que
  el redirect al Dashboard los rebotaba. Se sumó.
- `?hoja=<id>` sólo resuelve ids FIJOS: una hoja de «Nueva hoja» lleva ids nuevos. Las hojas de Analysts
  del informe de Mauricio se escribieron con los ids de la plantilla.
- Ads, Landing y Closing salieron el mismo día, a la tarde (decisiones 4, 5 y 6): ver «Closing al
  Dashboard» abajo.

## Cómo se verifica cuando el `next dev` no sobrevive

El 11/10 el vigía de RAM mató el `next dev` (6 GB con 320 MB libres) y dos builds (5,4 GB). Lo que sí
anduvo: `npm run build` cuando hubo lugar, `next start -p 3100` (mucho más liviano) y la cookie de sesión
firmada con `crearToken` de `lib/auth-session.ts` (`/api/auth/dev-login` es inerte en producción). Dos
trampas de la verificación: una sesión `admin` sin impersonar ve el tablero del DUEÑO (Productividad
del ws1 en 0 sin ser un bug: Mauricio ve el suyo), y el ws3 no tiene key de Gemini (el AI Analyst se
probó en el ws9).

## La pauta de Meta (y el resumen del negocio) terminan AYER

**Vive en:** `hastaDeFuente` en `lib/graficos-datos.ts`

La pauta llega por cron y el día en curso no está. ⚠️ El Resultado agregado no trae el `hasta` efectivo:
cualquier consumidor fuera de la pantalla (el CSV, la IA) recalcula con `hastaDeFuente`, o lee «hoy
hubo gasto cero».

## Una razón se calcula sobre lo SUMADO; los distintos se cuentan en el grupo

**Vive en:** `lib/graficos-agregar.ts`

- El CTR de una campaña es sus clics ÷ sus impresiones, no el promedio de los CTR diarios.
- Las personas de una semana no son la suma de las de cada día (`Fila.u`, métrica `distinto`).
- Lo que sólo se suma (circular, embudos, al 100%) no acepta razones. El tiempo se RELLENA.

## «Cerraron» es una cuarta definición de cierre, y excluye los «sin cobro»

**Vive en:** `gano` en `lib/graficos-datos.ts`

El Dashboard cuenta `cerro || estado_lead === 'ganado'`, menos `venta_tipo = 'sin_cobro'`. Antes de
«arreglar» un número que no coincide con otra pantalla, mirá cuál de las cuatro definiciones es.

## La réplica de las tabs viejas: cómo se calcula cada número de antes

**Vive en:** `lib/graficos-plantillas.ts`; el dibujo, en `app/dashboard/Grafico.tsx`

- **Vistas del VSL = YouTube + los plays de Panda**, de `marketing_metrics_daily`, como `lib/queries.ts`.
- **El SCL va de `fecha_agenda` a `fecha_primer_pago`**, promediado sobre los que tienen las dos.
- **El chip «↑ 1,3×»** lee el período ANTERIOR del mismo largo (`periodoAnterior`).
- Una tarjeta de número lleva SIEMPRE su filete; el número toma su color sólo si es mayor que cero.

## Por qué react-grid-layout y no otro

No hay un constructor de tableros embebible en Next con licencia libre (Metabase y Grafana son AGPL,
Superset es Python). `react-grid-layout` 2.2.4 (MIT) + `recharts`.

## Closing al Dashboard: lo que la tab hacía mal y el port obvio habría copiado (11/10/2026)

**Vive en:** `app/dashboard/entidades/FichaLlamada.tsx`, `lib/llamadas-modelo.ts`, `app/api/closing/puerta-regla.ts` (`BloquesClosing.tsx` se borró el 13/10: la hoja Closing son gráficos desde v5)

- **El KPI «Analizadas» de la tab contaba ventas pendientes y con error** (`counts.ventas`). La hoja cuenta
  sólo las analizadas (`llamadas_venta.llamadas`): 71 en el ws1.
- **`lastSync` es el `updated_at` de CUALQUIER fila**, incluida una revisión a mano: el bloque dice
  «Actualizado», no «Sincronizado».
- **`/api/closing/analyze` contesta `ok: true` con el fallo adentro** (`status: 'error'`). La tab no lo
  miraba; la ficha sí.
- **Las cinco rutas de `/api/closing/*` no tenían control de rol** (un setter gastaba IA o leía
  transcripts con un `fetch`), y `revise` tomaba el `autor` del cuerpo. Ahora hay una puerta en positivo
  (admin y closer) y el autor sale de la sesión.
- ⚠️ **El diagnóstico obvio era el equivocado en `destinoDetalle`**: la entidad `llamadas_venta` estaba
  declarada y su número no abría nunca, sin error. Buscaba sólo en `FUENTES_BASE`, y el test pasaba porque
  `LECTORES` sí incluía los conjuntos extra. Una tabla de capacidades se valida contra la MISMA lista que
  usa quien la consume.
- **El closer ve un informe EN MEMORIA** (sólo la hoja Closing, sin editar) y `/api/graficos` le contesta
  403 a cualquier otra hoja (`closerPuedePedir`). Esconder las hojas no alcanzaba: el pedido de datos es
  otra puerta. Medido en Chrome con un closer ficticio: 403 «Sólo la hoja Closing».
- **`?hoja=<plantilla>` caía en Marketing** para toda hoja de plantilla (ids al azar): `hojaDestino` la
  busca por FIRMA y, si no está, la agrega con ids fijos.
- **Un `Confirm` encima de un `Modal`**: los dos escuchan Escape en `document` y el `Confirm` no está en la
  pila de modales (deducido, no medido). Por eso «Re-analizar» confirma adentro del pie de la ficha.

## Enlace, Video e Insertar: el href se sanea también en las ramas de respaldo (11/10/2026)

**Vive en:** `lib/embeds.ts` (`videoDe`, `insertableDe`), `app/dashboard/ElementoInsertado.tsx`

- El test encontró un bug en su primera corrida: el «Ver el video ↗» de un link NO reconocido pintaba
  `e.url` crudo, así que un `javascript:` llegaba al href. El camino feliz estaba saneado.
- Lo que se GUARDA tiene una vara floja (https) y lo que se VE una estricta: si la lista de proveedores
  cambia, un link guardado no se borra en el próximo guardado. La API de MaKo valida con la estricta
  (`armarElemento`), y un `<iframe>` pegado guarda sólo su `src`.
- Sumar Fathom a la lista de embeds también lo habilita en las clases de los cursos (el sanitizador lo deja
  como `fathom.video/embed/<t>`). `/calls/` no se inserta.
- React 19 precarga toda `<img>` no perezosa: la miniatura que sólo existe para el PDF va con
  `fetchPriority="low"` (perezosa adentro de algo escondido no se baja nunca).
- Por HTTP, la dirección de un elemento que sea una grabación de Fathom no sale (`urlParaCanal`).

## Dos puertas para la misma decisión: arreglar la lib no arregla la ruta (11/10/2026)

**Vive en:** `app/api/graficos/analisis/route.ts`, `lib/graficos-analisis-server.ts`

La red de plataforma del AI Analyst (decisión 1) se escribió y se desplegó en la lib (`e51f01a8`) y el
botón seguía apagado para un negocio sin IA propia: la RUTA preguntaba `docsIADisponible()` antes de
llamar a la lib, en el POST y en el GET que habilita el botón. Al cambiar quién puede algo, se buscan
TODAS las preguntas por esa capacidad, no la función que la ejecuta.

## La topbar de Looker: lo que no se ve en el diff (11/10/2026)

**Vive en:** `app/dashboard/Cabecera.tsx`, `app/dashboard/EditorInforme.tsx`, `app/dashboard/editor-css.ts`

- **El desplegable de hojas son DOS botones.** Editando, el título es un `contentEditable` y el ▾ va
  aparte (`.lk-top-hojas`); mirando, el título entero es el botón (`.lk-top-tit-btn`). La verificación
  buscó el segundo con permiso de edición y dio «no abre» sobre un desplegable sano. Los dos llevan
  `data-recorrido="dash-hojas"`: se apunta a eso.
- **Un placeholder dibujado con `::before` se IMPRIME.** El subtítulo vacío dice «Agrega un subtítulo»
  por CSS (`.edin[data-vacio]::before`) y el PDF (`window.print`) lo habría sacado en la hoja. El
  `@media print` lo vacía, y `tests/dashboard-pantalla.test.ts` lo fija.
- **Reusar un componente de otra área trae SUS tests.** «Compartir» es el modal de Conocimientos; darle
  el azul de Looker puso rojo `tests/conocimientos-compartir.test.ts`, que fija la clase del disparador
  con un regex exacto — y un barrido de los tests `dashboard-*` no lo ve. Va una prop opcional
  (`claseBoton`) con el default de siempre, y el test sigue exigiendo ese default.
- **Los filtros se usan mirando y se agregan sólo editando.** Lo elegido mirando va a la vista y no se
  guarda; «＋ Filtro» y «Quitar», sólo con Editar. El período volvió al diseño de `FechaFiltro`, y el
  botón dice sólo el período: con el rango al lado se leía como dos filtros.
- **«Restablecer el informe» salió de la pantalla, no del producto:** queda en la API de MaKo
  (`restablecer_informe_dashboard`), que propone y confirma una persona.

## Compartir un informe: el link no confía en lo que pide (11/10/2026)

**Vive en:** `app/compartido/[token]/informe-reglas.ts` (puro, con test), `informe-compartido.ts`,
`app/api/compartido/graficos/route.ts`

Quien abre el link no tiene sesión y ve el informe de OTRA persona. Las cuatro decisiones, en positivo:

1. **Cada consulta se rearma desde el componente GUARDADO** (hoja + id). Del cuerpo sólo vale lo que la
   vista puede mover: el período, el «agrupar por» y filtros sobre controles que la hoja ya tiene. El
   `grafico` que viaja en el cuerpo no se lee: si no, un link consultaba cualquier conjunto del negocio.
2. **Las personas no salen:** las etiquetas pasan por `sinPersonas`, la misma lista positiva del AI
   Analyst.
3. **Un filtro sobre un campo no público no se mueve:** sus valores serían nombres, y una búsqueda por
   texto, un oráculo letra por letra. Lo que el dueño dejó elegido filtra igual y viaja como alias.
4. **Sale lo decidido EN POSITIVO (`seComparte`, v5):** un gráfico sale salvo los tipos de `TIPOS_QUE_NO_SALEN`
   (el mapa de calor: es la página de un cliente en vivo); un elemento, sólo si está en `ELEMENTOS_QUE_SALEN`. Las
   cajas de IA, las acciones, las fichas, los pop-ups y una grabación de Fathom llegan como una tarjeta «No se
   comparte en un link» en su lugar, y el server ni los lee.

El detalle de un número contesta 403. Medido en Chrome (ws9): 15 componentes sin Editar ni Compartir,
detalle 403, revocar 200 y el link revocado 404. Las puertas (por qué POST, los topes, el 404 que no
distingue) están en [hallazgos-seguridad.md](hallazgos-seguridad.md).

## La v5: sin bloques fijos, todo editable (12/10/2026)

El feedback de 24 puntos del 11/10 a la noche (textual en `app/admin/dev/dashboard/bitacora.ts`): un solo
«Filtro» y la búsqueda tipo Ctrl+F, pop-ups configurables, «Conclusiones de MaKo» como elemento de IA, sección
y desplegable, conectores, gráficos gordos, mapa de cualquier país, hojas VSL/CS/Chat Analyst y el mapa de calor
en vivo. Lo que costó, por tema:

**El modelo y la migración de los bloques** (`lib/graficos-catalogo.ts`, `lib/graficos-migrar-v5.ts`)
- **Los 17 bloques del informe de Mauricio se migran en el SANEO, no a mano**, con ids determinísticos: el saneo
  corre en cada recarga, así que lo que agrega con `nuevoId()` sería otro componente cada vez. Ante una colisión,
  el siguiente id libre. Y una hoja no puede perder componentes por migrarse: el tope se corre en lo que la
  migración agrega.
- **Una firma por bloques muere con los bloques.** `hojaDestino` encontraba la hoja Closing por los bloques que
  tenía; con ids nuevos, `?hoja=closing` agregaba OTRA. La migración guarda `Hoja.plantilla` y la búsqueda mira
  eso primero.
- **Desde v5 el período propio de un gráfico vive en `controles`** (`fijo: true`). Un `{...comp, controles: [nuevo]}`
  lo borra y cambia el número sin un error: agregar un control es sumarlo a la lista. Y con un control `periodo`
  en el gráfico, el saneo descarta el campo `periodo` viejo **sin avisar**: la API de MaKo lo escribía ahí y no
  hacía nada (ver [hallazgos-api-mako.md](hallazgos-api-mako.md)).
- **El diagnóstico obvio era el equivocado (dos veces).** De 8 controles quedaban 7 y parecía el tope: era
  `leads.setter`, que dejó de existir al volverse compartido, y el saneo tiraba el control (lo traduce
  `campoVigente`). Y un `pedidosDeHoja` que daba `6 !== 1` no duplicaba nada: el fixture tenía `clase: 'bloque'`
  y el saneo lo migró a 5 gráficos. Un test que pasa por el saneo no usa clases deprecadas.
- **Una sección plegable en el medio esconde el resto de la hoja** (agrupa todo hasta la siguiente). Toda
  sección que se inserte (migración, plantilla, IA) lleva su sección de cierre al pie del grupo.

**Los datos** (`lib/graficos-agregar.ts`, `lib/graficos-datos*.ts`)
- **La Landing tardaba y terminaba en «No pude leer los datos»** porque leía dos veces las ~48k filas de
  `vsl_events`. La salida fue un resumen en SQL (`retencion_vsl_resumen`, mig 0261), y el primero tardaba 3,1 s:
  un join `is not distinct from` sobre CTEs hizo que el planificador descartara 9.093.240 filas. **«Faltan
  índices» era el diagnóstico equivocado**: agrupar en dos niveles sin join bajó a 756 ms, con 0 diferencias
  sobre 3.010 personas.
- **PostgREST corta en 1000 filas también una función `returns setof`, sin avisar.** La función devuelve un jsonb.
- **`Number(null)` da 0**: una visita sin header de longitud caía en el golfo de Guinea. El null se mira antes de
  convertir (`ubicacionDeHeaders`).
- **La entrega contaba filas de `cliente_entrega`, no clientes**: se lee el universo (`carteraEnEntrega`) y se
  reparte con `repartirEnEtapas`, igual que Customer Success. Y `envios.respondio_at` no lo escribe nadie:
  «respondió» se deriva de la inscripción.
- **Una métrica percentil no es una base**: el guard «el lector llena cada métrica» la excluye y exige su `de`.
- **El sello de Lovable era lo más tocado del ws1** en el mapa de calor (`#lovable-badge-close` ×6): se reconoce
  por el selector, no por la palabra.

**El dibujo y el mapa** (`app/dashboard/graficos/`, `public/geo/v1`, `scripts/geo-paises.mjs`)
- **Las etiquetas que se chocaban no eran un bug de recharts** (3.8 ya dibuja `LabelList` arriba de las líneas):
  eran hasta 120 etiquetas sin halo. Van las que entran sin pisarse, en tinta y con halo.
- **Natural Earth nombra mal regiones vecinas**: el `name_es` de la Ciudad de México es «México» (el estado de al
  lado), el de la Ciudad de Buenos Aires es «Buenos Aires» (la provincia), Bogotá trae el código de Cundinamarca y
  `MX-DIF` es viejo. Un nombre que tienen dos regiones no ubica ninguna; las correcciones van escritas en
  `scripts/geo-paises.mjs`.
- **Un `.json` de `public/` pasa por el control de sesión** (el matcher del proxy excluye png/js/css, no json): la
  geometría andaba con sesión y fallaba en el link. Va `'/geo'` en `PUBLICOS`.
- **Un dibujo propio recibe el resultado pero no lo que mira el gráfico**: todo componente que pide sus datos
  necesita `efectivo` (lo que resolvió la hoja), o mira sólo su período propio.

**La edición** (`app/dashboard/EditorInforme.tsx`, `edicion-css.ts`, `guardado.ts`)
- **react-grid-layout 2.x llama a `onLayoutChange` en un efecto pasivo, después del commit**: un ref que esa
  callback lee va en `useLayoutEffect`. Y plegar sin la vuelta pierde el orden (la grilla escribe las `y`
  compactadas): `aGuardado` devuelve las filas guardadas.
- **Una cola de guardado compara con lo que VIAJA, no con lo último confirmado**: si no, un Ctrl+Z hecho con otro
  guardado en vuelo no se manda nunca. El guardado lleva versión (409 «el informe cambió en otra pestaña»).
- **`scrollIntoView` corre una tarjeta para siempre**: también scrollea los contenedores con `overflow: hidden`
  (`.lk-comp` lo tiene). La búsqueda scrollea a mano sólo lo que tiene auto/scroll (`llevarALaVista`). Y el
  `MutationObserver` de la búsqueda no escucha `style`: el tooltip de recharts lo reescribe en cada movimiento.

**La IA y las entidades** (`lib/graficos-ia-elemento*.ts`, `app/dashboard/entidades/`)
- **Una caja de pop-up es por lo que se abrió**: con la clave sin el `ref`, las conclusiones de una llamada salían
  en el pop-up de otra. El estado de algo que vive en un pop-up lleva el `ref` de lo abierto.
- **`nuevoElemento(...)!` sobre un saneo que devuelve null**: insertar «Acción» o «Ficha» rompía sin error de tipos.
  Un elemento con configuración obligatoria nace con la configuración de quien lo inserta.
- **Una ficha del CRM queda debajo de la pila de Modals** (LeadEditModal en z 80, la pila arranca en 130) y
  `window.open` pierde el `?ws=`: adentro de un pop-up, la ficha es un `ButtonLink newTab`.
- **Romper una guarda que coincide con el default no prueba nada**: sacar `diaSemana: 1` dio verde porque
  `sanearCron` ya pone 1. La rotura que prueba es cambiar el valor.

**Roles: la regla vive en TRES puertas** (`HOJA_DE_ROL`, `lib/graficos-plantillas.ts`)
- El setter pasó a ver SÓLO la hoja Chat Analyst. `app/api/graficos/route.ts` ya preguntaba por `HOJA_DE_ROL`;
  **`/api/graficos/ia-elemento` tenía su propia copia del chequeo del closer** (el setter recibía 403 en su caja), y
  **`/m/dashboard` también**: un setter en el teléfono caía en la rama del ADMIN y veía Marketing, Comercial y las
  hojas del informe. Al ampliar un rol se busca `'closer'` en `app/api/graficos/**` y en `app/m/dashboard/**`;
  todas pasan por `hojaDeRol`/`informeDeRol`. La capa de cada rol vive en `lib/graficos-roles.ts`, porque
  `lib/movil-rutas.ts` viaja al navegador en cada página y no puede importar las plantillas. Lo fija
  `tests/movil-dashboard-rol.test.ts`.
- **Escribir la capacidad no es enchufarla**: `AccionesFilaProvider` (las acciones en la fila: «Marcar cobrada»)
  quedó con cero call sites entre dos paquetes; sin él la tabla no dibuja la columna. Lo monta `tarjeta()` de
  `EditorInforme.tsx` mirando y con sesión.

**El link compartido** (`app/compartido/[token]/informe-reglas.ts`)
- **Lo que no sale se REEMPLAZA en su lugar, no se saca**: misma id y misma caja, así los conectores siguen valiendo
  y el lienzo no salta. La tarjeta nombra el TIPO del elemento, porque el título de un video puede ser «Llamada con
  Ana».
- **Riesgo latente**: `BuscarEnHoja.tsx` calcula `campoCompartible` sobre la hoja ya limpia para el link y el server
  sobre la real. Hoy coinciden (lo único que no sale es el mapa de calor, sobre campos públicos); si se suma a
  `TIPOS_QUE_NO_SALEN` un tipo con campos de personas, la pantalla dibujaría una búsqueda que el server ignora.

**El catálogo que lee «Pídeselo a MaKo»** ya viaja en el nivel más apretado (sin nombres): 9.539 de 10.500
caracteres. El próximo conjunto grande pasa el tope y el modelo ve sólo ids (`lib/graficos-ia.ts`).

*12/10/2026, chat «Graphics»: relevo (3 lectores) + tres olas de agentes (`wf_…` ola 1: modelo, datos, dibujo;
ola 2: topbar/filtros, edición, IA y entidades, mapa de calor; ola 3: plantillas/roles y API/link) + integración en
`wt-v5`. Migraciones 0260-0262 aplicadas antes del deploy.*

## Copiar un dashboard con un token, y «¿Qué vas a crear hoy?» en «Nueva hoja» (13/10/2026)

**Vive en:** `lib/graficos-copia.ts` (puro, con test), `lib/graficos-copia-server.ts`, `app/api/graficos/copia/route.ts`,
`app/dashboard/copia-dash-cliente.ts`, `app/dashboard/NuevaHoja.tsx`, mig 0268 (`dashboard_copias`; se escribió 0266 y se renumeró: otra sesión la había tomado), `lib/token-copia.ts`

Es «Copiar flujo» de Automations (mig 0265) para una hoja: el ⋮ de la hoja guarda la copia y el portapapeles lleva
`MAKO-DASH-…`; pegarlo en la caja de «Nueva hoja» la agrega con ids nuevos. Lo que costó:

- **«Duplicar» dejaba la caja de MaKo de la copia sin leer NINGÚN gráfico, sin un error.** `duplicarHoja` re-acuñaba
  los ids de los gráficos y no seguía `ia.fuentes`; el saneo (`podarFuentesIA`) filtraba los ids que ya no estaban y
  quedaba `[]`, que en `ConfigIA` significa «se borraron». Lo encontró escribir el pegado, no un reporte. Ahora las dos
  cosas pasan por `hojaConIdsNuevos`, que acuña en DOS pasadas (primero todos los ids, después lo que apunta a ellos:
  una caja puede leer un gráfico que está después en la lista). Regla: **al re-acuñar ids, todo lo que APUNTA a un id
  se sigue en la misma función** (conectores, `ia.fuentes`); un `podar` en el saneo convierte el olvido en un vacío
  plausible.
- **Qué viaja, en positivo.** Al copiar se vacía todo filtro sobre un campo que no es público en TODOS sus conjuntos
  (`dimensionPublica`, la lista del AI Analyst y del link): sus valores son personas y el token lo lee cualquiera. Al
  pegar en OTRO negocio, un filtro PARA MIRAR se queda sólo con el vocabulario fijo (`Dimension.valores`); una campaña
  de otro negocio deja el gráfico en cero sin decir nada. ⚠️ **Los de definición (`fijo`) NO se vacían**, y ése era el
  diagnóstico obvio y equivocado: vaciarlos convierte «la KPI de R1» en «todas las llamadas» con el mismo título. Lo
  que se vacía se cuenta y va en el toast («2 filtros vaciados»). Costo conocido: hay pocos vocabularios declarados
  (~15 dimensiones), así que un filtro para mirar sobre un enum sin `valores` (`pagos.estado`) también se vacía al
  cruzar de negocio — se avisa, y se elige de nuevo de la lista del negocio que pega.
- **La caja de la casa no lleva foco al abrir.** `CajaPedido` mueve el ejemplo sólo mientras NO tiene el foco
  (`seMueveElEjemplo`); con el `useFocoInicial` que tenía «Nueva hoja», el ejemplo no se habría movido nunca.
- **La tabla no es de un inquilino**: `workspace_origen`, no `workspace_id`, fuera de `TENANT_TABLES`, con el cliente
  crudo y sólo para el admin con la tab (como `flujo_copias`). Medido en prod después de aplicarla: la ven `postgres`
  y `service_role`, nadie más, con RLS.

*13/10/2026, chat «Graphics» (cuenta 2), a mano en `C:/dev/wt-graphics`; un agente en paralelo borró el código muerto
de los bloques en su propio worktree. Verificado con tests (9 en `tests/graficos-copia.test.ts`, cada pieza rota y
cazada) y una ida y vuelta real contra la base (ws 3, fila borrada). NO se verificó en el navegador: la RAM estuvo en
zona roja toda la tarde (el vigía mataba hasta los `tsc`), y un `next dev` no tenía dónde entrar.*

## Las plantillas se arman con los datos del negocio (13/10/2026)

**Vive en:** `lib/graficos-con-datos.ts` (puro, con test), `lib/graficos-con-datos-server.ts`, `app/api/graficos/plantilla/route.ts`,
`sinDatos` en `lib/graficos-agregar.ts`

Pedido en la reunión del 12/10 (103:41): «elegir qué gráficos quitar o qué gráficos agregar, pero que tengan datos». Lo que
gobierna lo que se toque acá:

- **«Vacío» es UNA regla: la de la tarjeta** (`sinDatos`, la que dibuja «Sin datos en este período»). La medición pide cada gráfico
  con `efectivoDe` sin nada elegido mirando y por el mismo `datosDeGraficos`: con otra regla o con otro período, la plantilla
  quitaría lo que la tarjeta dibuja. ⚠️ Un número en cero cuenta como vacío (la tarjeta dibuja «0», pero para el negocio que no
  tiene el dato es lo mismo); es la decisión, no un descuido.
- **«No pude leer» no es «vacío»**, y la primera versión del test no lo podía distinguir: sólo tenía el caso todo-'nose', que cae
  en «ninguno tiene datos» y deja la hoja entera por OTRA razón. La rotura (contar 'nose' como vacío) pasó en verde; lo cazó el caso
  mezclado (uno con datos, el resto sin leer).
- **Si ninguno tiene datos, la plantilla entra entera** («Todavía sin datos»): una hoja sin gráficos no sirve, y la plantilla dice
  qué va a medir.
- **Lo que suma MaKo se pide con el catálogo RECORTADO** a los conjuntos que tienen datos (`catalogoParaIA(fuentes)`), y se mide
  igual antes de entrar: el recorte orienta, la medición decide. Si MaKo no contesta, la hoja sale podada (sumar es lo opcional).

## El clic derecho, y el botón de MaKo selectivo y editable en el lugar (13/10/2026)

**Vive en:** `makoPorDefecto` / `conMako` / `makoIA` en `lib/graficos-catalogo.ts`, `app/dashboard/MenuContextual.tsx`,
`app/dashboard/EditorMako.tsx`, `alClicDerecho` y `elegirContextual` en `app/dashboard/EditorInforme.tsx`

Pedido de Martín: clic derecho en toda la tab, el botón de MaKo editable en modo edición (no abre el chat), y «borra ese botón de
la mayoría de gráficos… Se selectivo». Lo que gobierna lo que se toque acá:

- **La AUSENCIA de `mako` cambió de significado.** Antes se guardaba sólo `false` («prenderlo es sacar la marca»), así que ausente
  era PRENDIDO. Ahora ausente es lo del tipo (`makoPorDefecto`: tendencias por día, semana o mes, embudos y dispersión) y se guardan
  los dos valores. Con eso el botón se fue de golpe de los informes ya guardados, que es lo pedido: en las 13 plantillas lo llevan
  21 de 157 gráficos. ⚠️ El caso que pierde: alguien que lo apagó y lo volvió a prender antes del 13/10 quedó con la marca ausente
  y ahora sigue al tipo. No se puede distinguir de «nadie lo tocó»: el camino viejo no lo escribía.
- **`conMako` es la ÚNICA lectura** (pantalla, Propiedades, la API y la hoja en palabras). Un `g.mako !== false` suelto vuelve a la
  regla vieja sin un error; el test lo busca en `dashboard.run.ts`.
- **Un evento de React SUBE POR LOS PORTALES.** El clic derecho en una fila del desplegable de hojas (que tiene su propio menú), en
  un `Flotante` o en un modal llega al `onContextMenu` de la raíz aunque en el DOM viva en el `body`. La guarda es
  `defaultPrevented` + `closest('[role="menu"], [role="dialog"], [role="listbox"], .lk-flotante')`, y escribiendo sale el menú del
  navegador (copiar, pegar, el corrector).
- **Cada opción del menú llama a una acción que YA existía** (duplicar, cambiar el tipo, conectar, exportar, el chat de MaKo):
  nada se implementa dos veces. El test cruza las claves de `OPCION` contra los `case` de `elegirContextual`, así una opción nueva no
  se puede dibujar muerta.
- **Lo que MaKo «responde» viaja como texto del contexto**, no como un prompt aparte: `contextoDeGrafico` le agrega «quien armó este
  gráfico pide que respondas, antes que nada: …». Las sugerencias reemplazan las preguntas por defecto del chat del gráfico.

## La pantalla en blanco es «¿Qué vas a crear hoy?», y las plantillas se ven como páginas (14/10/2026)

**El pedido** (Martín, desde la tab General, «para General y para el Dashboard»): «en lugar del botón de "nuevo dashboard"
te pido que pongas ahí el "¿Qué vas a crear hoy?"... Y los templates, la preview debería ser como los de landing generator,
porque justamente se deberían ver como una pagina... y el botón de EDITAR no debería saltarme ningún modal..., debería, al
igual que dashboard, habilitar el menú de edición de la página». Y al toque: «Hazlo bien, mira como está construido el
dashboard...».

**Cómo quedó.** La pantalla en blanco de `EditorInforme` (quien nunca armó una hoja: `sinPaginas`) monta `CrearHoja`, el
cuerpo del modal «Nueva hoja» sacado a una pieza: la caja y, abajo, las plantillas, como la portada del Landing Generator
(`CajaCrear.tsx`). El modal es `CrearHoja` adentro del Modal de la casa. Cada plantilla es la tarjeta de esa portada
(miniatura, «Usar plantilla» al pasar el mouse, nombre y línea), y la miniatura es `MiniaturaHoja`. «Editar» en blanco
arrancaba una hoja en blanco ya editándose (`empezarEnBlanco`; desde la vuelta siguiente, en blanco no hay «Editar»): la caja ya está en la pantalla, abrir el mismo contenido en un
modal era repetirlo.

**Lo que no se ve y gobierna lo que venga:**

- ⚠️ **CAMBIÓ EL MISMO DÍA (e6818ee0): la miniatura ya no es un boceto, es la hoja** (la entrada de abajo, «La miniatura
  es LA HOJA»). Martín: «no inventes esas imagenes, que se vea tal cual». Lo que sigue describe la primera versión.
- **La miniatura dibuja la FORMA, nunca los datos.** Cada componente en su x, y, w, h de la grilla, con su título real y un
  boceto según el GRUPO de su tipo (`TIPOS`): barras, línea, número, tabla, anillo, embudo, y la cabecera oscura de General.
  Medir cada plantilla para la miniatura serían ~157 gráficos por apertura (lo advirtió Graphics); eso lo hace
  /api/graficos/plantilla sólo para la que se elige.
- **Determinista, porque la pantalla en blanco se dibuja también en el server.** La hoja de muestra sale de los ids FIJOS de
  la plantilla (`hojaDeMuestra`, nunca `instanciarPlantilla`, que acuña ids al azar) y las alturas de los bocetos de un hash
  del id. Un `Math.random()` ahí rompe la hidratación sin un error visible.
- **La escala va en `cqw`** (container-type en `.mh`), como la miniatura del Landing Generator, nunca con `transform: scale`.
  Y la hoja de estilos (`CSS_MINIATURA`) la pone quien monta las miniaturas, UNA vez: con un `<style>` por tarjeta eran trece.
- **La lógica de `CrearHoja` se quedó en `NuevaHoja.tsx` a propósito**: cinco tests la leen del fuente por regex
  (graficos-con-datos, graficos-copia, graficos-ia, dashboard-topbar); mudarla a otro archivo era mudar sus asserts.
- ⚠️ **Un `[^>]*` en un regex sobre JSX corta en el `=>` de un handler.** El test de la pantalla en blanco daba rojo sobre el
  código correcto: `<div className="…" onClick={(e) => e.stopPropagation()}>` tiene un `>` adentro del atributo. Se escribe
  el atributo entero en el regex.

Cómo se vio: las miniaturas de las 24 plantillas (11 de General y 13 del Dashboard) se dibujaron en una página estática con
`renderToStaticMarkup` y se miraron en Chrome; la pantalla en blanco dentro del editor, todavía no (falta en ws3 después del
deploy). Lo fijan `tests/dashboard-en-blanco.test.ts` y `tests/dashboard-miniatura-hoja.test.ts` (que DIBUJA todas las
plantillas), probados rompiéndolos.

**Vive en:** `app/dashboard/NuevaHoja.tsx` · `app/dashboard/MiniaturaHoja.tsx` · `app/dashboard/EditorInforme.tsx` ·
`app/dashboard/editor-css.ts` · `tests/dashboard-en-blanco.test.ts` · `tests/dashboard-miniatura-hoja.test.ts`.
*14/10/2026, claude2 (a98ab025), desde el chat de General.*

## En blanco no hay barra, se agranda desde los ocho lados, y el editor se puede acotar (14/10/2026)

**El pedido** (Martín, desde la tab General, para las dos): «Si no tengo tabs no debería salir el botón de editar ni los 3
puntos. Lo mismo para dashboard... Y en el caso de dashboard tampoco el filtro ni la barra de busqueda» y «Debería poder
editar el tamaño de un bloque desde cualquiera de sus costados, no solo de abajo a la derecha. Y elimina la flecha que
aparece detrás del contorno azul... Esto también para dashboard».

**Lo que no se ve en el código:**

- **En blanco, la topbar es el título y nada más.** Editar, el ⋮ y la barra de filtros (con la búsqueda) cuelgan de
  `!enBlanco`; lo único que se hace en blanco es elegir con qué arrancar, y eso está en el medio. Con eso se fue
  `empezarEnBlanco` (el «Editar» que arrancaba una hoja vacía, de la vuelta anterior). Lo fija
  tests/dashboard-en-blanco.test.ts; ojo que `tests/dashboard-topbar.test.ts` y `tests/graficos-analysts.test.ts` también
  anclan el botón «Editar» por regex y hubo que moverlos.
- **La «flecha» era el `::after` de react-grid-layout**: un ángulo de dos bordes que su CSS GIRA según el lado (315° en
  `e`, 45° en `s`), o sea una flecha que asoma detrás del contorno de la tarjeta elegida. Con ocho tiradores (`TIRADORES`,
  app/dashboard/EditorInforme.tsx) el `::after` se apaga y el `transform` se pisa (si no, los lados heredan el giro).
- **Los tiradores van ADENTRO del borde.** La tarjeta (`.lk-comp`) recorta con `overflow: hidden`: un tirador corrido hacia
  afuera no se ve ni se agarra. Los lados son franjas de 8 px a lo largo del borde (no el cuadradito de 20 px del medio que
  trae la librería), las esquinas 14 px, y elegida la tarjeta muestra un cuadradito blanco en cada uno de los ocho, como
  Looker (editor-css.ts). Sin elegir no se dibuja nada: el cursor avisa.
- **El editor se puede ACOTAR sin copiarlo**: la galería recibe `tipos`, «Añadir datos» `soloFuentes`, el panel de un
  gráfico mira `useEnGeneral()` y `lugaresInsertar(enPopup, enGeneral)` saca lo que General no inserta (un menú que se queda
  sin opciones no se dibuja). Las listas viven en lib/general-piezas.ts; el Dashboard no cambia (el test lo compara contra
  `BARRA_INSERTAR`).

**Vive en:** `app/dashboard/EditorInforme.tsx` · `app/dashboard/editor-css.ts` · `app/dashboard/Galeria.tsx` ·
`app/dashboard/Propiedades.tsx` · `tests/dashboard-en-blanco.test.ts` · `tests/general-bloques.test.ts`.
*14/10/2026, claude2, desde el chat de General.*

## La miniatura es LA HOJA, la edición se mira en celular, y crear una hoja no se deshace (14/10/2026)

**El pedido** (Martín, desde la tab General, para las dos): «los templates tienen que ser fieles a lo que se va a ver, no
inventes esas imagenes, que se vea tal cual... Y elimina los subtitulos de cada template, solo el título», «En la edición,
tal como lo tenemos en la edición de Landing Generator, tienes que poder visualizar en la versión mobile, etc... Eso es
importante que se diseñe todo siempre pensado para ambos dispositivos... Dile esto también a dashboard» y «Si creo una hoja
no debería aparecer el deshacer si no hago ninguna acción».

**Lo que no se ve en el código:**

- **El boceto era «la forma sin los datos», y eso es justo lo que se rechazó**: rectángulos grises y una línea inventada no
  se parecen a la hoja que nace. Ahora `MiniaturaHoja` dibuja cada componente con LOS componentes del editor
  (`CuerpoGrafico`, el bloque de General con `PiezaGeneralDeMuestra`, `CuerpoSeccion`, el texto con sus tamaños) en el
  lugar de la grilla (`lugarEnMiniatura`, la cuenta de react-grid-layout). Lo único de ejemplo es el NÚMERO: un `Resultado`
  con la forma del suyo (`resultadoDeMuestra`, lib/graficos-muestra.ts: sus métricas con su formato, su dimensión con
  etiquetas ficticias, la comparación y la tendencia si las pide). Medir cada plantilla al abrir siguen siendo ~150 gráficos.
- **La escala pasó a `transform: scale(k)`**, con k medido del contenedor. La regla contra medir adentro de una capa escalada
  es para lo que se APUNTA, y la miniatura no recibe el mouse; los gráficos miden su caja con ResizeObserver, que da el
  tamaño sin escala. Con `cqw` no se puede escalar un componente que mide en px.
- **El primer dibujo es el del server**: la página con cada tarjeta y su título. Los cuerpos entran después de montar y
  cuando la miniatura se ve (IntersectionObserver): son ~150 gráficos en una galería que se scrollea.
- ⚠️ **La miniatura ya no se puede dibujar en un test**: importa el editor, que importa server actions, y fuera de Next
  eso tira «This module cannot be imported from a Client Component module». El test prueba lo que decide ejecutándolo
  (el resultado de ejemplo de los ~150 gráficos de las plantillas, el lugar) y el cableado leyendo el fuente.
- **La vista por dispositivo no es una simulación**: la página se angosta al ancho del dispositivo (820 la tablet, 390 el
  celular) y el editor hace lo que haría en uno (por debajo de 640, la pila). Sólo editando; no se guarda. En la pila, un
  bloque de General mide lo que dibuja (`height: auto`): el alto de la grilla es del escritorio.
- **Crear una hoja no es un gesto que se deshace.** Pasaba por `mutar` (que apila), así que el Deshacer de la barra borraba
  la hoja recién creada y volvía a la de antes. Ahora se escribe con `setTablero` (el guardado mira el tablero, no la pila) y
  la pila se VACÍA (`vaciar`, app/_ui/usePilaDeshacer.ts): un paso viejo deshecho después restauraría un tablero sin la hoja.

**Vive en:** `app/dashboard/MiniaturaHoja.tsx` · `lib/graficos-muestra.ts` · `app/dashboard/NuevaHoja.tsx` ·
`app/dashboard/EditorInforme.tsx` (`DISPOSITIVOS`, `crearHoja`) · `app/dashboard/editor-css.ts` · `app/_ui/usePilaDeshacer.ts` ·
`tests/dashboard-miniatura-hoja.test.ts` · `tests/general-bloques.test.ts`.
*14/10/2026, claude2 (e6818ee0), desde el chat de General.*

## Eliminar una hoja la archiva, se pueden eliminar todas, y la marca de MaKo no navega (14/10/2026)

**El pedido** (Martín, 13:26): «Me debería dejar eliminar todas las hojas, también para dashboard. Y en el desplegable de las
hojas, un texto que diga "Archivados" y ahí la opción de eliminar permanentemente... como un texto sutil abajo de todas las
opciones», «Las miniaturas y el título de abajo, deberían estar englobadas en un contendor... con una sombra... Lo mismo
para dashboard» y «Cuando clickeo en MaKo en la sidebar, me redirecciona a general, que no pase eso».

**Lo que no se ve en el código:**

- **«Sin hojas» no se puede guardar como `hojas: []`**: `sanearTablero` devuelve siempre una («Página 1» vacía) y media
  app lee `hojas[0]`. Eliminar la última guarda esa vacía con la marca `enBlanco`, y la pantalla vuelve a «¿Qué vas a crear
  hoy?» (`sinPaginas` en las dos páginas). Crear o restaurar una hoja saca la marca (`sinBlanco`).
- **Los que leen el informe por fuera no tienen que ver esa vacía**: `leerTableroVisible` (la API de MaKo y los links
  compartidos) la devuelve como un informe SIN hojas. Lo que escriba la API después sale sin la marca.
  ⚠️ **Y la PANTALLA lee crudo (`leerTableroVersionado`).** La primera versión normalizaba en la lectura de TODOS, y el
  Dashboard de quien eliminó todas sus hojas leía `hojas[0]` de una lista vacía. Lo cazó mirar la pantalla, no un test: la
  normalización vive sólo en la lectura de afuera, y `tests/dashboard-archivadas.test.ts` fija los dos lados.
- **Las archivadas comparten el espacio de ids con las hojas**: el saneo las desduplica entre las dos listas, o restaurar una
  chocaría con otra. Van con tope (`MAX_ARCHIVADAS`, 20): entra una y se va la más vieja.
- **Borrar de Archivados es un segundo clic sobre el mismo botón**, que pasa a decir «Eliminar para siempre» (la consecuencia
  pegada al botón). Y la API de MaKo (`borrar_hoja_dashboard`) archiva igual que la pantalla.
- **La marca de la barra lateral es un `<span>`**: el link a /general se fue; la geometría (el aire hasta OPERATE como
  margen) se quedó, con su test.

**Vive en:** `lib/graficos-catalogo.ts` (`Tablero`, `sanearTablero`, `hojasVisibles`) · `lib/graficos-tablero.ts` ·
`app/dashboard/EditorInforme.tsx` (`eliminarHoja`, `restaurarHoja`, `borrarArchivada`) · `app/dashboard/Cabecera.tsx`
(`MenuHojas`) · `app/dashboard/NuevaHoja.tsx` · `app/_components/Sidebar.tsx` · `lib/api-mako/areas/dashboard.helpers.ts` ·
`tests/dashboard-archivadas.test.ts` · `tests/barra-clic-operate.test.ts`.
*14/10/2026, claude2.*

## Rediseño por tipo con capturas (14/10/2026), mitad General

**El pedido** (Martín, 14/10, 14:34): «Dale este mismo feedback al dashboard... Que rediseñe bloque por bloque y que tenga
en cuenta mobile. Que vaya viendo con datos ficticios o con algun dato de algun workspace que todo se vea bien en diseño.
Tanto bloques como las plantillas.» Lo hicieron dos chats en paralelo, repartidos por ARCHIVO para no editar nunca el mismo:
Dashboard, todo lo que dibuja `app/dashboard/Grafico.tsx`; General, los tipos con archivo propio en `app/dashboard/graficos/`
(tabla, tarjetas, dispersión, barra de proporción, tramos, paneles, barras gordas), los mapas y las 13 plantillas. Para eso
el CSS de esos tipos se mudó, sin cambiar una regla, a `graficos/estilos-html.ts`, que `estilos.tsx` incluye con
`${CSS_HTML}` adentro de su MISMO template literal (el minificador no se come nada). La tabla comparte `.gr-tabla` con las
dinámicas de Grafico.tsx: lo que cambia ahí lo ven las dos.

**Cómo se miró:** el arnés de Dashboard (`C:/Users/marti/arnes-dashboard/`: esbuild empaqueta los componentes REALES con
stubs y Chromium los fotografía, porque recharts mide con ResizeObserver y no sale en un render estático), cada caso en
escritorio, angosto y celular (364 px), con `resultadoDeMuestra`. Para las plantillas, una página aparte que dibuja cada una
ENTERA: el escritorio con `MiniaturaHoja` en un contenedor de 1180 px (escala 1) y la pila del celular. ⚠️ Dos chats no
comparten la carpeta del arnés: `build.mjs` escribe `bundle.js` y `raiz.txt`, y el último build gana. Cada uno, su copia.

**Lo que no se ve leyendo el código:**

- **Un `@container` no estila al mismo elemento que declara `container-type`**: la consulta mira al ANCESTRO. `.gr-paneles`
  y `.gr-tramos` declaraban el container y sus `@container` los cambiaban a ellos mismos, así que nunca aplicaba: en el
  celular los paneles seguían en dos columnas y los tramos quedaban en fila con el adentro de un renglón. El container va en
  un envoltorio (`.gr-paneles-caja`, `.gr-tramos-caja`, `.gr-barras-caja`). Estilar a los HIJOS sí anda (la tabla lo hacía
  bien), por eso el bug no se ve leyendo el CSS.
- **`justify-content: center` en una columna que puede desbordar esconde lo de arriba.** Con más filas de las que entran, las
  primeras quedan fuera del scroll; y en una tarjeta de alto fijo (la barra de proporción en el celular) lo que sobra SUBE
  encima del título de la tarjeta. Va `margin-top: auto` en el primer hijo y `margin-bottom: auto` en el último: centra si
  entra y, si no, corta abajo.
- **Correr el dominio de un eje numérico a mano apaga el redondeo de recharts.** Abrir las puntas para que una burbuja no se
  cortara dio marcas «14%, 19%, 24%, 29%, 32%» y «2,6 · 6,6 · 9,1». Las marcas se calculan (`ejeLindo`, paso de 1, 2, 2,5 o 5
  por una potencia de 10) y viajan en `ticks`; un eje fijo (`g.ejes`) manda igual que antes.
- **Un mapa de ciudades no se ubica por los nombres.** El país se adivinaba contra el índice de REGIONES, y «Guadalajara» no
  es una región: todo mapa de ciudades preguntaba «¿De qué país es el mapa?» con las coordenadas en la mano. Se ubica por
  dónde caen los puntos (`geoContains` sobre `paises.json`). Y el encuadre deja de borde el radio de la burbuja más grande
  (Tijuana, en la esquina de México, quedaba cortada).
- **Una cabecera de tabla en un renglón se corta siempre** con 7-9 métricas («Tasa de ci…», «Madurez del m…»). Va en dos,
  con un `span` (`.gr-th`): `line-clamp` sobre el `th` mismo rompe la tabla.
- **En el celular, la barra de una «Tabla con barras» no baja de 140 px**: con las medidas de escritorio, a 364 px el nombre
  quedaba en «Campaña …»; con 96, la barra era un punto al lado de su número.
- **Una métrica sin nombre al lado de su barra no dice de qué es**: las tarjetas mostraban «US$395» y una barra, y las otras
  métricas sí tenían rótulo. La principal lleva su nombre arriba y el número en grande.

**Vive en:** `app/dashboard/graficos/` (`estilos-html.ts`, `Tabla.tsx`, `Tarjetas.tsx`, `Dispersion.tsx`, `eje-lindo.ts`,
`Tramos.tsx`, `Paneles.tsx`, `BarrasGordas.tsx`) · `app/dashboard/MapaGeo.tsx` · `tests/graficos-eje-lindo.test.ts`.
*14/10/2026, claude1, chat General.*

## El rediseño por tipo, mitad Dashboard: cada gráfico mirado en escritorio, angosto y celular (14/10/2026)

**El pedido** (Martín, 14:34, para el Dashboard después de la sexta vuelta de General): «Que rediseñe bloque por bloque y que
tenga en cuenta mobile. Que vaya viendo con datos ficticios o con algún dato de algún workspace que todo se vea bien en
diseño. Tanto bloques como las plantillas.» Se repartió por ARCHIVO con el chat General (su mitad, arriba): acá lo que se
dibuja en `Grafico.tsx` (números, ejes, torta, sankey, embudos, la tabla dinámica), los datos de ejemplo y la pila del
celular.

**Cómo se miró, y sirve para la próxima: un arnés en un navegador de verdad, no un render estático.** El de General
(`renderToStaticMarkup`) no sirve para el Dashboard: todo gráfico con ejes se mide con `ResizeObserver`
(`graficos/medida.tsx`) y en el server no dibuja nada. El arnés vive FUERA del repo (`C:/Users/marti/arnes-dashboard/`):
`build.mjs` empaqueta con el esbuild del repo los componentes reales (`CuerpoGrafico`, `CuerpoElemento`) con cuatro stubs
(`server-only`, `next/navigation`, `next/dynamic` como `React.lazy`, el `Link` de la casa, y todo módulo `'use server'`
como un módulo CJS que acepta cualquier nombre), y `capturar.cjs` saca una captura por caso con Playwright. Cada caso
sale en tres tamaños: el de escritorio (su w × h en la grilla de 12), angosto, y la pila del celular (364 px; 176 si es
un número). Los casos están en `casos.ts` y estresan lo que rompe: nombres largos, 12 categorías, números grandes. ⚠️ El
bundle y `raiz.txt` son UNO: dos chats que buildean a la vez se pisan (cada uno copia la carpeta).

**Lo que mostraron las capturas, y lo que salió:**

- **El minigráfico no dibujaba la línea en ningún tamaño** y **la tendencia la perdía en el celular**: el número y su
  chip ocupaban todo el alto. El minigráfico va en una fila (número a la izquierda, línea a la derecha, desde 240 px) y la
  tendencia guarda 36 px para su línea. El chip va AL LADO del número si entra sin achicarlo más de un 20 %, y eso se
  decide MIDIENDO (`NumeroGrande`): con `flex-wrap` bajaba siempre en el celular.
- **La bala salía cortada a su propio tamaño de nacimiento (6 × 3)**: 28 + 12 + 24 px apilados no entran en 48. Con
  lugar va en una fila; si no, apilada y más chica.
- **La aguja del indicador con rangos cruzaba el número**: es un tramo que apunta al arco, no una línea desde el centro.
- **El «0» del eje Y se encimaba con la primera fecha**, en todos los gráficos de ejes: `tickMargin`.
- **Las etiquetas del eje X**: una columna de 12 categorías nombraba una de cada tres (barras que no se sabe qué son) y el
  histograma encimaba «US$59–US$97US$135–US$174». `intervaloPorAncho` (lib/graficos-gordo.ts) deja las que ENTRAN: en el
  tiempo como mucho cinco (seis o menos, todas), en categorías todas, inclinadas si no entran derechas. El histograma
  escribe «US$59–97».
- **Las leyendas de recharts salen en orden ALFABÉTICO** (`itemSorter` vale `'value'` por default en recharts 3): en
  unas columnas apiladas la leyenda decía «Curso, Mentoría, Programa principal» sobre una pila que arranca por Programa
  principal. Todo `<Legend>` lleva `itemSorter={null}`, y un test lo exige.
- **El anillo con nombres largos**: la leyenda de recharts vive ADENTRO del SVG, se comía la mitad del alto, el anillo
  quedaba del tamaño de una moneda y el total del centro (que la daba por una línea) se dibujaba encima de ella. La torta
  y el anillo llevan leyenda HTML (`Torta`): un renglón por porción con «…» y su %, al costado si hay lugar, debajo si no;
  el total sale del ancho del HUECO.
- **El sankey**: todos los flujos del mismo azul y los nombres de la izquierda escritos encima de los flujos. Los nombres
  van afuera de cada columna y cada flujo lleva el color de donde sale.
- **El embudo**: los nombres se salían de la tarjeta («Impresi») y el número del último escalón quedaba sobre un
  triángulo de 10 px. Margen derecho para los nombres, y el número afuera cuando el escalón es angosto.
- **La tabla dinámica en el celular** decía «Nu…» y «Mento ría»: la esquina nombra las filas (antes decía la métrica),
  la columna de nombres es más ancha, la cabecera va en dos renglones, y en el celular no hay barras ni total y la plata
  va corta.
- **En la pila del celular, el alto de la grilla es del escritorio**: un CPM de 3 × 6 eran 276 px para un número, un
  título de 2 filas tenía una barra de scroll adentro y la barra de proporción cortaba su leyenda. Los números, la barra
  de proporción, el texto, el enlace, la sección y la acción miden lo que dibujan (`ALTO_LIBRE_EN_PILA` y
  `ELEMENTOS_ALTO_LIBRE_EN_PILA`, EditorInforme.tsx). Un gráfico con ejes NO: necesita un alto para dibujar.

**Los datos de ejemplo eran parte del problema, y se ven también en la galería de plantillas.** `resultadoDeMuestra`
(lib/graficos-muestra.ts) dibuja cada miniatura de «¿Qué vas a crear hoy?». Daba conteos con decimales («4,8 leads»),
sumaba una razón en plata (un «Costo por lead US$6.403»), un embudo al revés («92 de 58»), una dinámica que no sumaba, y
amontonaba en el origen la matriz de Productividad (ejes 0-100 con valores de 1 a 15). Ahora: conteos enteros, una
razón promedia (mira `metrica.razon`, no sólo el formato), el embudo baja, el total de una fila es la suma de sus celdas,
los puntos se reparten adentro de los ejes fijos, y hay ejemplos de guiones, proyectos, regiones, países, ciudades (con
su `geo`), edad, género y plataforma.

**El diagnóstico obvio que era el equivocado: «el gráfico está mal» era, varias veces, «el dato de ejemplo está mal».**
Un embudo que se ensancha o un CPL de seis mil dólares se leen como un gráfico roto, y la primera reacción es tocar el
dibujo. Antes de arreglar un gráfico en la galería, mirá si el número que dibuja es creíble.

**Vive en:** `app/dashboard/Grafico.tsx` (`NumeroGrande`, `KpiConLinea`, `Bala`, `Indicador`, `Torta`, `NodoSankey`,
`EnlaceSankey`, `Dinamica`) · `app/dashboard/graficos/estilos.tsx` (`.gr-leyenda`, `.gr-dinamica`) · `lib/graficos-gordo.ts`
(`intervaloPorAncho`) · `lib/graficos-muestra.ts` · `app/dashboard/EditorInforme.tsx` (la pila) ·
`tests/graficos-dibujo-celular.test.ts`.
*14/10/2026, claude1 (chat Dashboard).*

## El Dashboard épico: un titular por hoja y el número que crece con su tarjeta (14/10/2026)

**El pedido** (Martín, minutos después del rediseño por tipo): «Y lo mismo para Dashboard... Quiero el mismo criterio de
EPICIDAD en los dashboards... Solo que ahí hay más graficos... Que se rediseñe todo». Lo mismo le pidió a General para su
tab («como lo tenemos en mobile, epicos, pocas cosas, textos gigantes, bloques grandes»).

**Lo que «épico» NO era: sacar gráficos. Era la JERARQUÍA.** Cada plantilla arrancaba con una fila de cuatro números del
mismo peso (3 × 4 cada uno): nada dominaba. Ahora cada hoja tiene un TITULAR —su número principal a media hoja, 6 × 6— y
los demás a su lado en una grilla de 2 × 2, sin subtítulos (lo primero que sacó el teléfono aprobado). Es UNA regla para
las 13 plantillas (`conTitular` + `TITULARES`, lib/graficos-plantillas.ts), no 13 diseños a mano: el resto de la hoja baja
lo que creció esa fila.

**La escala es UNA para el Dashboard y para General** (`ESCALA_EPICA`, lib/graficos-gordo.ts), acordada con ese chat ANTES de
escribir: con dos sistemas de tamaños, una hoja de General con un número del catálogo al lado de un bloque se vería de dos
productos. El número protagonista crece con su tarjeta: clamp(40, 22 % del ancho, 128 px), que entren sus letras y que no
pase del alto que le queda; peso 800 y tracking −0,04em, como el teléfono (el prototipo no tiene la escala escrita: la pasó
el chat MaKo Mobile como proporciones, protagonista ≈ 3× el rótulo).

**Lo que costó:**

- **El tope de alto achicaba las KPI chicas.** Una de 3 filas tiene ~54 px de cuerpo; con el chip abajo, el tope dejaba el
  número en 13 px. El piso es el tamaño del tema si entra a lo ancho: lo épico es que CREZCA en las grandes, no que las
  chicas cambien.
- **El alto libre sale de las FILAS de la tarjeta, no de medirla.** En la pila del celular un número mide lo que dibuja
  (`ALTO_LIBRE_EN_PILA`): medir su alto para decidir su tamaño sería un bucle.
- **Una cifra en 800 es más ancha que en 600**: el tope por letras usa 0,62 em (`letraGruesa`).
- **La regla se aplicó dos veces sobre Comercial**, que se armó a mano (Cash Collected de titular y Sold Revenue al lado):
  la regla vio una fila de dos números, estiró el segundo a 6 × 6 y lo dibujó encima de Outstanding y MRR. Lo cazó la
  captura. La regla no toca una hoja que ya trae su titular, y quedó un test que exige que NINGUNA plantilla tenga dos
  tarjetas en la misma celda.
- **En la pila del celular el titular iba de a dos** como cualquier número (`.lk-pila > .lk-comp--kpi`): un número de 6 × 5
  o más lleva `.lk-comp--titular` y va a lo ancho.
- ⚠️ **Llegó un rojo a main que mis corridas no veían**: corrí `tests/graficos-*.test.ts` y el test que fijaba la fila de
  Marketing es `tests/graficos.test.ts`, SIN guion. Lo cazó el chat General. **Los tests a correr se eligen por quién
  IMPORTA el módulo que cambiaste** (`grep -l "graficos-plantillas" tests/*.test.ts` dio 17), nunca por un glob del nombre.
- ⚠️ **Y la cosecha misma se rompió por la shell**: escrita con `node -e` en Bash, las comillas invertidas del texto se
  EJECUTARON y salieron vacías. Lo que tenga comillas invertidas se escribe con la herramienta de escritura, nunca por una
  shell (AGENTS.md ya lo dice para el código; vale igual para un .md).

**Decisiones de producto tomadas acá (cambiables en `TITULARES`)**: Marketing → CAC real; Comercial → Cash Collected; Ads →
Costo por agenda; Landing → Visitas; VSL → Llegan al final; Chat → Respondidos en 15 min; Closing → Tasa de cierre; CS →
Necesitan atención; Productividad → Avance global; CRM → Leads nuevos; Cobranza → Cobrado; Automatizaciones → Tasa de
respuesta; Contenido e IA → Costo de la IA.

**Vive en:** `lib/graficos-gordo.ts` (`ESCALA_EPICA`, `tamProtagonista`) · `app/dashboard/Grafico.tsx` (`NumeroGrande`) ·
`lib/graficos-plantillas.ts` (`conTitular`, `TITULARES`, Comercial) · `app/dashboard/EditorInforme.tsx` y `editor-css.ts`
(`.lk-comp--titular`) · `lib/graficos-temas.ts` · `tests/graficos-epico.test.ts`.
*14/10/2026, claude1 (chat Dashboard).*

## Las portadas: cada plantilla abre con UNA pieza de su color y con la forma de su objetivo (15/10/2026)

**El pedido** (Martín, 14/10, mirando las dos galerías): «todos parecen muy iguales porque tienen el mismo diseño de color»,
«A simple vista se tienen que diferenciar MUY bien de qué es cada template… evita que al principio tenga muchos textos,
muchos números… También puedes jugar con los COLORES», y «muchos gráficos juntos parece dashboard». El 15/10, al ver la
galería sin cambios: «No está en producción lo último si pedí que se rediseñaran...». El titular 6 × 6 del 14/10 no
alcanzaba: arriba seguían compitiendo cuatro piezas y las trece miniaturas eran la misma imagen con otro título.

**Copiado de la galería de plantillas de Canva** (búsquedas «dashboard» y «report cover», abiertas el 15/10; capturas en
`C:/Users/marti/arnes-dashboard/referencias/`). Lo que separa una plantilla de otra en Canva no es el título: es la
PORTADA —el color a sangre que ocupa casi todo el cuadro, UN titular gigante y UNA imagen—. Las de Canva que se confunden
entre sí son justo las de muchos gráficos chicos sobre blanco. Se copió la estructura; los colores son de una tabla nuestra.

**Lo que es:** la primera pieza de cada hoja, 12 × 11, con `portada: <identidad>` (un campo opcional de `Grafico` y
`Elemento`; el saneo lo guarda sólo si la identidad existe y nunca en un pop-up). Es un gráfico o un bloque que YA existe,
con sus datos de siempre: la tarjeta se pinta y adentro se redefinen los tokens (`--ink`, `--dim`, `--border`…) con la tinta
del color, como el fondo «Oscuro» de un bloque de General, así lo de adentro se da vuelta solo. Detrás va UNA forma grande
(círculo, diagonal, arco, el ▶ del video, la burbuja del chat). Cada portada tiene OTRA forma (un número, una barra partida,
pósters de anuncios, la página con el calor, una curva, un reloj, columnas, personas, una matriz, trapecios, un anillo):
el color nunca es lo único que distingue, y el test no deja que más de dos de una galería compartan forma.

**Los colores viven en UNA tabla para las dos galerías** (`lib/graficos-identidad.ts`): el mismo tema, el mismo color en las
dos (WhatsApp verde, Meta azul, cobranza ámbar…), ninguno repetido adentro de una galería, y la tinta medida contra su
fondo (4,5 la letra, 3 los grises). Se apartó de `docs/portadas-propuesta.md` en cuatro: Comercial va en dorado MaKo (el
verde es de WhatsApp), Ads Analyst en coral (el magenta es de Instagram), Productividad en lima y Contenido e IA en durazno
(la tabla acordada con General el 15/10). «General» va en Noche: es el único color libre que no nombra otro tema.

**Lo que costó, y lo que el diagnóstico obvio dejaba mal:**

- ⚠️ **No hay leads «de Instagram».** La propuesta prometía abrir la plantilla Instagram con «los leads que llegaron por
  Instagram (1.062 en un negocio, 277 en otro)». Medido en la base (sólo lectura): el origen de un lead es
  `origen_lead ?? utm_source`, y `origen_lead` no tiene ningún «instagram»; el 1.062 era `instant_form`, los formularios de
  Meta, que son de Facebook O de Instagram. Sólo 53 leads dicen `utm_source = ig`, y quedan tapados por `origen_lead`. La
  portada de Instagram salió de lo que SÍ hay: la audiencia de Meta por plataforma (`publisher_platform`), que trae agendas,
  clics e impresiones de Instagram contra Facebook. **Una portada se promete después de leer el dato con el MISMO lector
  que la va a dibujar**, no contando filas con un `ilike`.
- ⚠️ **Una plantilla puede traer dos piezas con el mismo id local antes del saneo** («Funnel de llamadas»: la sección «cierre»
  y el número «cierre»). La compactación que cierra el hueco de la portada las indexaba por id y les daba el mismo lugar: lo
  cazó el test de «ninguna se pisa». Todo lo que recorre piezas crudas de una plantilla va por POSICIÓN.
- ⚠️ **El mapa de calor de la galería pedía los datos DEL NEGOCIO.** La miniatura dibuja la hoja con datos de ejemplo, pero
  `MapaCalor` ignoraba el resultado y pedía los toques reales: con el mapa arriba, la galería habría mostrado la landing de
  un cliente (o un «cargando» eterno). Ahora un resultado de ejemplo lleva `muestra: true` y el mapa dibuja una landing
  inventada con el calor en el botón y el título.
- **El hueco que deja la pieza que sube** tiene dos formas: en una fila pareja (los números) los que quedan se reparten el
  ancho; al lado de un gráfico de media hoja, el vecino se estira. La compactación vertical (la de react-grid-layout) NO
  llena un hueco horizontal: sin estirar al vecino quedaba media hoja vacía.
- **Los bloques de General tienen dibujo de tamaño fijo** (los anillos de los OKRs, la tarjeta del Plan): en una portada de
  11 filas quedaban chicos arriba y el resto vacío. Se agrandan con `zoom` SÓLO en el escritorio (en la pila del celular se
  cortaban), como «Prioridades del Plan» se escala desde afuera.
- **Sobre un color, todo lo que tenía un color fijo se pierde**: el número blanco adentro de una barra de embudo (sobre una
  barra blanca), el aclarado del embudo vertical, los colores fijos de los cuadrantes de la matriz. Sobre una portada las
  series van en tonos de la tinta (`paletaDePortada`), los trapecios en papel blanco y los cuadrantes sin sus colores.
- **Las miniaturas de anuncios de la galería son pósters INVENTADOS** (un SVG en base64, `posterDeMuestra`): la de un anuncio
  de verdad sería la de un cliente. `Tarjetas` acepta un SVG en base64 además de https (en un `<img>` un SVG no corre nada).

**Lo que el arnés no podía ver y se vio en PRODUCCIÓN** (15/10, con la sesión de Mauricio, ws1, después del deploy):

- ⚠️ **El conjunto de anuncios de Meta no traía la miniatura.** La tabla (`marketing_metrics_daily.ad_thumbnail_url`) la
  tiene para casi todos los anuncios, pero sólo la leía el conjunto de GUIONES: las tarjetas de `meta` salían sin foto (la
  portada de Ads, la de Anuncios de General y los anuncios de Marketing). En el arnés se veían porque los pósters de
  ejemplo son inventados. Ahora `filasMeta` la lee, y la portada de Ads lee los guiones de su hoja (respeta sus filtros).
  Las URLs `www.facebook.com/ads/image/…` redirigen a fbcdn con `Cross-Origin-Resource-Policy: cross-origin`: cargan en
  otra web; las `scontent…fbcdn.net` directas vencen (`oe=`) y dan 403.
- ⚠️ **La matriz impacto × esfuerzo era una portada VACÍA**: sólo dibuja proyectos EVALUADOS, y los de Mauricio no tienen
  ninguno («Sin datos en este período», que además miente: no es el período). La portada de Productividad pasó a ser el
  avance de cada proyecto activo; la matriz sigue abajo. **Una portada se elige con el dato que tiene el cliente, no con
  el que debería tener.**
- **El tema puede abreviar la cifra de la portada** («US$1 k» con «Contraste», el que eligió Mauricio): sobre una portada
  el número va entero.
- **El «+N más» de las tarjetas era una SEGUNDA FILA de la grilla** (`grid-column: 1 / -1`) y con filas de `1fr` le comía
  la mitad del alto a las tarjetas (medido en la página: dos filas de 170 px y las tarjetas cortadas). En una portada no
  va, y las filas miden lo que su tarjeta.

**Las hojas viejas (la cola, 15/10 ~07:25):** «eliminar» se hizo con lo que hace el producto, ARCHIVAR (quedan en
«Archivados», de donde la persona las restaura), con un respaldo de las filas enteras y compare-and-set por `updated_at`
(`scripts/rehacer-hojas-dashboard.ts`, con `--restaurar`). Qué hoja se tocaba lo decidió una comparación pieza por pieza
contra las OCHO versiones que tuvo cada plantilla (git archive de `lib/` en cada commit, saneadas con el saneo de hoy):
igual a alguna versión = nadie la tocó. Resultado: 10 de 11 iguales (el Comercial de Mauricio, a una v5 con «Tendencia» de
10 filas); **la Cobranza de Leila (ws11) no coincide con ninguna y se dejó como estaba**. Los informes de GENERAL (ws1 y
ws10) ya estaban vacíos: alguien había eliminado sus hojas, y no se tocaron. Mauricio tiene sus 6 hojas rehechas con las
plantillas de hoy (los ids FIJOS de siempre: el closer y la caja de IA los buscan así) y su tema «Contraste» en Marketing.
⚠️ **Un «eliminar» masivo sin comparar con la HISTORIA de la plantilla habría pisado la hoja que Leila armó**: contra la
versión de hoy, las 11 «diferían» (todas nacieron de versiones viejas).

**Lo que se sacó:** el titular 6 × 6 + la grilla de 2 × 2 (`conTitular`, `TITULARES`). Con la portada arriba, un segundo
protagonista abajo le compite; la fila de números vuelve a ser una fila (Comercial también).

**Vive en:** `lib/graficos-identidad.ts` (la tabla, `marcoDePortada`, `paletaDePortada`) · `lib/graficos-portadas.ts`
(`conPortada`, `cerrarHueco`, `compactar`, las 13 del Dashboard) · `lib/general-plantillas.ts` (`PORTADAS_GENERAL` y la
plantilla Instagram) · `app/dashboard/editor-css.ts` (`.lk-comp--portada`) · `app/dashboard/Grafico.tsx`,
`graficos/Tarjetas.tsx`, `Tabla.tsx`, `Dispersion.tsx`, `MapaCalor.tsx` (dibujar sobre el color) · `Propiedades.tsx` (la fila
«Portada» del panel) · `tests/graficos-portadas.test.ts` (probado rompiéndolo: ver su cabecera).
*15/10/2026, claude1 (chat Dashboard).*

## Bloque por bloque, segunda pasada: la pila mide lo que dibuja y las barras llenan su tarjeta (15/10/2026)

**El pedido** (Martín, 14/10, 14:34, por el orquestador): «Que rediseñe bloque por bloque y que tenga en cuenta mobile. Que
vaya viendo con datos ficticios o con algun dato de algun workspace que todo se vea bien en diseño. Tanto bloques como las
plantillas.» Las portadas (arriba) contestaron la galería; esto es lo que quedaba ADENTRO de las 13 hojas. Se miró con el
arnés, las 13 plantillas en el escritorio y en la pila del celular, y cada tipo con el tema Contraste (el de Mauricio).

**Lo que mostraron las capturas, y la causa de cada cosa:**

- ⚠️ **En la pila del celular, toda pieza que no fuera un número conservaba el alto del escritorio.** Una tabla de 4 filas
  («Estancadas», «Las llamadas», «Cohortes») dejaba media pantalla en blanco abajo. La causa no estaba en ningún gráfico:
  `ALTO_LIBRE_EN_PILA` tenía tres tipos. Las tablas, las dinámicas, las tarjetas, los tramos y las barras horizontales son
  HTML que se mide solo, y la caja de IA también. Lo que es de recharts necesita un alto para dibujar y lo conserva. Las
  barras horizontales son HTML sólo con la condición con la que `Grafico.tsx` elige `BarrasGordas` (`esBarrasGordas`: sin
  apilar, sin desglose, hasta dos métricas). La regla vive en `app/dashboard/pila.ts`.
- ⚠️ **El arnés tenía su COPIA de esa regla**, escrita a mano (`entrada.tsx`). Arreglar el editor no movía las capturas, y
  el arnés seguía dando por buena la regla vieja. Ahora importa `pila.ts`.
- **Las barras horizontales se amontonaban en el medio de una tarjeta alta** (centradas con `margin: auto`). Ahora las
  filas se reparten el alto, como las bandas de un gráfico de barras de Looker Studio, con un tope de 72 px por fila para
  que dos filas no queden lejísimos. Con siete filas o menos la barra engorda a 32 px. En una tarjeta angosta (el celular)
  pasa de 18 a 24 px.
- **Las columnas AGRUPADAS eran agujas** (seis edades × tres series en un tercio de hoja). Entre grupos va 12 % de aire y
  no 22 % (`BARRA.separacionGrupo`).
- **La portada de Cobranza cortaba los totales** («US$1.…»): la letra de una portada llega a 22 px y la columna de números
  tenía el ancho de siempre. Sobre una portada, `Tabla` los hace 1,35× más anchos (`portada`).
- **La fecha del último dato se cortaba a la derecha** («oct 2» en «Tendencia del score»): cuando el último punto lleva su
  marca en el eje, el margen derecho deja lugar para la mitad de la etiqueta.
- **El carrusel de tarjetas en la portada del celular NO es un defecto**: va a 64 % de ancho con `scroll-snap`, y la
  tarjeta que asoma es la pista de que hay más.

**Las dos decisiones que quedaban** (el orquestador: «resolvelas vos copiando de una app que ya lo resolvió»):

- **El titular de cada hoja** ya lo resolvió la portada: el titular 6 × 6 se sacó el 15/10.
- **Menos piezas.** Copiado de las plantillas de informe de Looker Studio: debajo de la portada va UNA fila de números, y
  ninguno repite lo que la portada ya dice. Las plantillas de Looker tienen entre 10 y 15 piezas por página; las nuestras,
  de 8 a 19. Sólo Productividad se pasaba (19, con 10 números): perdió «Proyectos» y «Completados» (la portada es el avance
  de cada proyecto) y «Terminadas con deadline» (el denominador de «A tiempo», que ya lo dice en su línea). Queda en 16.
  Closing tiene cinco números en su fila y se quedan: R1 y R2 son el PUNTAJE por tipo de reunión, no repiten el embudo de
  la portada, que cuenta llamadas.

**Lo que costó medir, y sirve para la próxima:**

- ⚠️ **El arnés armado con `timeout 300` sobre una máquina sin RAM no se armó, y las capturas salieron IDÉNTICAS a las de
  antes**: se tomaron del bundle viejo y parecía que los arreglos no hacían nada. Antes de mirar una captura se mira la
  hora de `bundle.js`, o se busca en el bundle un texto del cambio. Con la RAM justa se arma sin `timeout` y en segundo
  plano.
- **El tema de una plantilla manda sobre el del arnés**: `capturar.cjs "" <tema> plantillas` saca las 13 cada una en su
  propio tema. Los temas se miran en el modo por tipo (`capturar.cjs "" <tema>`, y `lamina-grilla.cjs` junta los casos).

**Lo que se vio en PRODUCCIÓN después del deploy** (`24c0ad441`, la sesión de super admin de Martín en su Chrome, ws9):

- La pila funciona como en el arnés: «SCL P90», que quedaba sola, va a lo ancho, y ninguna pieza deja más de 44 px de aire
  abajo (antes, media pantalla).
- ⚠️ **Un defecto que el arnés no mostraba:** el rótulo de un número de media fila se cortaba en un renglón («RATIO DE …»,
  «TASA DE ASIST…»), y así no se sabe qué número es. En la pila va en dos renglones.
- ⚠️ **Cómo se mira el celular en producción, y lo que NO sirve:** la ventana de la extensión no se deja angostar (sigue en
  1536 px); un iframe del mismo sitio lo bloquea la política de encuadre (bien); y la sesión firmada a mano con
  `token-dev.mts` producción la manda a `/login`. Lo que anda es la **«Vista de celular» del editor** (Editar → el ícono
  del teléfono), que dibuja la misma pila a 364 px. En un teléfono de verdad, MaKo Mobile lleva `/dashboard` a
  `/m/dashboard`, que es OTRA pantalla.
- **El informe es por persona**: el super admin mirando el ws1 ve SU informe en ese workspace (la galería, si no tiene), no
  el de Mauricio. Para probar sin escribir en un cliente, las hojas se arman en el ws9 y se borran al final.

**Vive en:** `app/dashboard/pila.ts` · `app/dashboard/EditorInforme.tsx` (`tarjeta`) · `app/dashboard/graficos/estilos-html.ts`
(`.gr-barras`) · `app/dashboard/graficos/Tabla.tsx` (`portada`) · `app/dashboard/Grafico.tsx` (`separacion`, el margen del eje
X) · `lib/graficos-gordo.ts` (`BARRA.separacionGrupo`) · `lib/graficos-plantillas-analysts.ts` (Productividad).
*15/10/2026, claude3 (chat Dashboard).*

## La IA del Dashboard tiene su PROPIA red, y el corte por datos de clientes no la cubría (16/10/2026)

**Vive en:** `lib/graficos-ia-red.ts` (`porLaRedDePlataforma`, `llevaDatosDeClientes`) · `lib/graficos-analisis-server.ts`
(`pedirIAGratis`) · `lib/graficos-ia-elemento.ts` (`CAJAS_SIN_DATOS_DE_CLIENTES`, `avisoSinIA`) · `lib/graficos-ia-generar.ts` ·
`tests/graficos-ia-red.test.ts`

La regla del 16/10 (los datos de los clientes de un cliente nunca van a un proveedor que entrena; AGENTS.md, la red de
plataforma) se puso en `chatCheapCascade`. El AI Analyst, las «Conclusiones de MaKo» y «Pídeselo a MaKo» no pasan por
ahí: su red es un bucle propio sobre `provsGratisDePlataforma`. Ahora sigue el mismo orden: el crédito de Claude de la
plataforma, después el corte si la feature lleva `pii` en el catálogo, y recién ahí las keys gratis. Sin nada que
cumpla, devuelve `null` y quien llama dice lo de siempre: que el negocio conecte su IA.

- ⚠️ **Un test viejo fijaba lo contrario.** `tests/graficos-analisis.test.ts` exigía que la red no nombrara `anthropic`
  («gratis por construcción»): con la regla nueva, el crédito de Claude es lo que va PRIMERO. Ahora admite sólo esa
  importación (`conCreditoDeLaPlataforma`) y sigue prohibiendo todo lo demás que cobra por pedido.
- ⚠️ **La marca `pii` del catálogo es de la feature ENTERA, y corta de más.** «dashboard-conclusiones» la lleva porque
  la caja del pop-up de una llamada lee el transcript; con eso solo, también las cajas que leen números agregados se
  quedaban sin keys gratis (y, sin el crédito de Claude activo, sin IA en un negocio sin key propia). Ahora cada caja
  dice lo suyo, EN POSITIVO como `DIMENSIONES_PUBLICAS`: van sin la marca las que leen GRÁFICOS (mandan lo mismo que el
  AI Analyst, con las personas y los filtros sobre ellas como «Closer 1») y un ANUNCIO (números de Meta y lo que
  escribió quien armó la campaña). Una llamada, un lead, y todo lo que se sume mañana, la llevan. El catálogo sigue con
  `pii: true`: es el default cerrado y el que muestra el sello PII en /modelos-ia.
- **El test fija también el PORQUÉ:** que la caja de gráficos mande `paraModelo(e)` y que los campos del anuncio sean
  los revisados. Un campo nuevo en `entradaDeAnuncio` (los comentarios, por ejemplo) lo hace fallar: se revisa antes.
- ⚠️ **Sin crédito, el aviso de siempre mandaba a conectar una IA que entrena.** El mismo 16/10 Martín dejó el crédito
  de Claude de la plataforma SÓLO para el onboarding, así que una caja con datos de clientes queda con las keys del
  negocio y nada más. Sin ninguna, `errorDeCascada` decía «conecta una IA gratis, con Gemini alcanza». Ahora dice
  «Conecta tu Claude en Integraciones» (`avisoSinIA`), sólo si no se probó ninguna key del negocio: la cascada sin
  keys no deja errores. Si una key suya falló, su error es el que sirve.
- ⚠️ **Y ese aviso era falso, por una pregunta antes de la cascada.** `pedirIAGratis` llamaba a `chatCheapCascade`
  sólo si `docsIADisponible()`, que cuenta Gemini, Groq, OpenRouter, Mistral y OpenAI pero NO la clave de Claude del
  negocio, que es el primer intento de la cascada (la segunda puerta del veto). Un negocio que conectara su Claude
  seguía sin IA en el Dashboard. Es la trampa de AGENTS.md («y nada la corta antes»), y no se veía leyendo la red.

**Lo que quedó SIN hacer:** nada se probó contra la red de verdad (sin `next dev` por la RAM). Si Claude está pausado
para todos (`claudePausado`), un negocio con su Claude conectado igual ve «Conecta tu Claude»: la pausa no deja error.
*16/10/2026, claude3 (chat Dashboard).*

## Las plantillas sugeridas: los ejes suman por separado, y el arnés dibujaba una copia de la galería (16/10/2026)

**Vive en:** `lib/plantillas-sugeridas.ts` (la regla) · `lib/plantillas-sugeridas-server.ts` (las señales) ·
`lib/graficos-plantillas-etiquetas.ts` (las dos tablas) · `app/dashboard/NuevaHoja.tsx` · `tests/plantillas-sugeridas.test.ts`.
Cómo se enchufa otra galería: [plantillas-sugeridas.md](plantillas-sugeridas.md).

- ⚠️ **Los ejes suman por separado, y una plantilla de UN canal con un eje genérico se le sugiere a quien vende por otro.**
  Con `cuello: ['conversion']` en «Ventas por WhatsApp», a un negocio que vende por llamada le salía sugerida (el cuello
  coincidía). Lo mismo Closing a quien vende por chat. Los tests de la regla daban verde: lo mostró el arnés, mirando la
  galería. Las de un canal se etiquetan sólo con su canal y sus entradas, y un test lo fija.
- ⚠️ **El modo `galeria` del arnés era una COPIA del marcado de la tarjeta**, no el componente: un cambio en
  `CrearHoja` no se veía ahí. El modo `crear` (`node capturar.cjs "" mako crear`) monta `CrearHoja` de verdad, con
  señales de ejemplo, en escritorio, celular, General y sin señales.
- **Se ordena la galería ENTERA y después se filtra lo buscado.** Al revés, buscar algo que deja afuera a las tres
  sugeridas le pasaría el «Sugerido» a la cuarta.
- **Las señales llegan desde la página del server**, en paralelo con el informe, y no por un fetch de la galería: la
  pantalla en blanco muestra la galería al cargar, y un orden que llega después haría saltar las tarjetas.

**Visto en producción** (16/10/2026, después del run 32, la sesión de Martín en el ws9, sin crear nada): las señales del
ws9 son vender por chat, con entradas por chat saliente y entrante (`GET /api/plantillas/senales`). El Dashboard en blanco
ofrece Chat Analyst, Comercial y Automatizaciones con «Sugerido», y General, «Ventas por WhatsApp» (la única de General
para quien vende por chat): lo mismo que da la regla.

**Lo que quedó SIN hacer:** mirarlo en un negocio que venda por llamada o cobre una suscripción (el ws9 sólo prueba el
chat). Y enchufar las otras galerías (Automations, Web Generator, Video Editor, Image Editor, CRM): las reparte Cerebro.
*16/10/2026, claude3 (chat Dashboard).*

## «Editar con MaKo»: operaciones sobre la hoja abierta, y lo de General que la IA no sabía (16/10/2026)

**Vive en:** `lib/graficos-ia-edicion.ts` (lo puro: el system, `hojaParaIA`, `aplicarEdicion`, `firmaDeHoja`) ·
`lib/graficos-ia-editar.ts` (la cascada) · `app/api/graficos/editar/route.ts` · `app/dashboard/PanelEditarMako.tsx` · el
`ALCANCE_GENERAL` de `lib/graficos-ia.ts` · `editar_hoja_con_ia_dashboard` y `editar_hoja_general_con_ia` en la API ·
`tests/graficos-ia-edicion.test.ts`. Es la etapa 1 de docs/diseno-mako-ai-native.md (rama `centro-chat`).

Martín, 16/10: «en dashboard y general no está la edición con IA, y debería... quiero que la app sea AI NATIVE». Un panel
a la derecha de la hoja (copiado del de Gemini en Google Workspace) donde una frase agrega, quita o cambia gráficos,
títulos y bloques, con su Deshacer. Lo que no se ve en el código:

- **El modelo devuelve OPERACIONES, no la hoja.** Una hoja reescrita entera perdería todo lo que el modelo no ve: el
  lugar, el estilo, los filtros, los pop-ups. Lo que el pedido no nombra queda idéntico, y lo nuevo va abajo de todo (o
  arriba) sin mover lo demás.
- **No es `turnoApp`**, aunque el diseño del Centro lo proponía. A esta IA le llega la ESTRUCTURA de la hoja y el catálogo,
  nunca un valor del negocio: corre por la feature de «Pídeselo» (`dashboard-hoja-ia`, sin la marca `pii`) y por la IA
  gratis. `turnoApp` lee leads, y el diseño dejó abierto si esos datos llegan a una key gratis que entrena.
- **Un solo escritor.** La ruta no guarda: el editor aplica con `mutar`, así hay Ctrl+Z y el autoguardado no recibe un
  409 por un cambio que no hizo él. El panel aplica sólo si la hoja sigue siendo la que mandó (por referencia), y el
  Deshacer sólo vale mientras la hoja sigue siendo la que dejó MaKo. Por la API, la misma idea con `firmaDeHoja`: si
  alguien tocó la hoja entre la propuesta y el «sí», no se aplica.
- ⚠️ **«Pídeselo a MaKo» en General armaba hojas con tipos del Dashboard, y por DOS caminos.** El diseño del Centro
  encontró uno: la galería mandaba sólo `{pedido}` y `generarHojaIA` no sabía de General. El otro estaba al lado: una
  PLANTILLA de General pasa por `hojaConDatos`, y ahí MaKo le «suma» gráficos con el catálogo entero. Ahora el
  `ALCANCE_GENERAL` (sus tipos, sus conjuntos y sus bloques) va en las dos capas: el catálogo que lee el modelo y
  `piezaDeIA`, que descarta lo de afuera. Y la ruta de plantillas pide la tab de General para una plantilla de General
  (pedía la del Dashboard).
- ⚠️ **Los tests que leen el código no ven un import duplicado.** El system nuevo se llamaba `EDITAR_IA_SYSTEM_TEMPLATE`,
  igual que el de Automations (`lib/flujo-ia.ts`), y `lib/prompt-registry.ts` importaba los dos. Los 253 tests que leen
  el registro dieron verde; lo cazó el tsc acotado del registro. Al registrar un prompt, ese archivo va en el tsc.
- **El CSS del panel lateral (`.an`) vivía adentro del render del AI Analyst**: un segundo panel en el mismo lugar no lo
  tenía. Se exporta (`CSS_PANEL_LATERAL`), y abrir un panel cierra el otro.
- **Los pedidos sueltos (16/10, después):** el panel le pregunta a `/api/mako/pedidos` ANTES de editar
  (`app/dashboard/pedidos-hoja.ts`, el contrato en docs/diseno-mako-pedidos.md). Lo que no se ve:
  - **«Sí» a «¿Terminamos esto y después…?» crea en el acto**, al revés que en el Web Generator: cuando aparece la
    burbuja, el cambio de la hoja abierta ya está aplicado (con su Deshacer), así que no hay nada a medias que esperar.
  - **La lista de hojas de General va por la puerta del GUARDADO, no por la de la página.** `/general` deja entrar a todo
    rol con la tab (`requireRolWs([], { nav: 'general' })`), pero guardar pide admin (`app/api/graficos/route.ts`). Si un
    día un no-admin edita su General, `objetosDeTab` de `general` se abre junto con ese guardado.
  - ⚠️ **El `tema` del arnés es el de la HOJA, no el claro/oscuro de la app.** Una captura con `nord-oscuro` salió
    idéntica a la clara, y eso se lee como «el oscuro está mirado». El panel sigue al oscuro de la app por sus tokens
    (`--surface`, `--ink`, `--border-strong`, `--primary`), y eso se comprueba leyendo el CSS, no con ese parámetro.

**Probado con la IA de verdad** (16/10/2026, después del run 36, la sesión de Martín en el ws9, sin escribir nada: la hoja
la dio `/api/graficos/plantilla` y se la mandó a `/api/graficos/editar`, que no guardan):
- Dashboard, «Agrega los leads por semana y quita el CAC real»: agregó «Leads por semana» (una serie de `negocio.leads`
  por semana, abajo de todo) en 11 s, y contestó que no quitaba nada porque la hoja no tenía el CAC real. Era cierto: en
  el ws9 la plantilla Marketing sale sin él (`hojaConDatos` saca los gráficos que quedarían vacíos).
- General, «Agrega mis tareas prioritarias y un gráfico de sankey de los leads»: agregó el bloque «Tareas prioritarias»
  en 6 s y dijo que el sankey no está entre lo que ofrece. El alcance de General funcionó en la capa del modelo, antes
  que en la del código.

**Lo que quedó SIN hacer:**
- **Mirar el panel en la pantalla de producción** (lo de arriba probó la ruta y el modelo; el panel, sólo el arnés).
- **El hilo no se guarda**: es de la sesión, por hoja. Guardarlo es la etapa 2 del diseño (la pieza única de chat).
- **Groq queda afuera casi siempre**: catálogo, hoja y pedido pasan los ~12.000 caracteres, y la cascada lo saltea sola.
  Contestan Gemini y OpenRouter.
- **No edita lo de adentro de un pop-up** ni las opciones de un bloque de General (eso sigue en su panel). Y el teléfono
  (`/m/dashboard`) no tiene el panel.
- **Los pedidos sueltos no se probaron contra la ruta de verdad**: las reglas reales con hojas de prueba en el test, y
  las burbujas en el arnés (modo `editar`, caso `editar-pedidos`). La ruta sale en el run 43, y después hay que probarla
  en el ws9.
*16/10/2026, claude3 (chat Dashboard).*

## Los pagos tienen funnel: el de donde estaba el lead ese día, no su casa (17/10/2026)

La fuente «Pagos» no tenía de qué funnel es cada cuota, así que «Cobrado por funnel» o una hoja filtrada por funnel no
contaban la plata. Ahora tiene la dimensión `producto` (y entra en el campo compartido «Producto», así que el filtro de
la hoja también la recorta). **Con la regla de los OKR, no con la casa del lead**: en el ws1 el funnel «Renovación»
tiene sólo leads agregados, y por la casa su plata sería siempre cero. La explicación entera, en
[hallazgos-objectives.md](hallazgos-objectives.md) → «Un OKR que suma varios funnels». Si la ubicación de los leads no se
puede leer, la cuota queda sin funnel (dimensión vacía) en vez de caerse cada gráfico de pagos.
**Vive en:** `filasPagos` (lib/graficos-datos.ts) · `ubicarLeads` (lib/funnels-elegidos-server.ts).
*17/10/2026, claude4 (chat Dashboard).*

## «Estilo de la hoja»: ajustes encima de la plantilla, y una pieza que la ficha del CRM sólo puede prender después (17/10/2026)

Martín, desde el feedback del CRM del 16/10: «deberías mejorar ese desplegable de estilos, ya que quedó limitado». Era
limitado de verdad: la hoja guardaba plantilla, color y letra, y TODO lo demás lo fijaba la plantilla. Ahora el tema
lleva también ajustes (`AJUSTES_TEMA`, lib/graficos-temas.ts): el fondo, las esquinas, el borde, la sombra y los títulos
de las tarjetas, y los valores, la leyenda y la cuadrícula de los gráficos. Cada uno se elige de un conjunto cerrado y,
sin tocar, es el de la plantilla.

- **Todo lo que dibuja pasa por `plantillaEfectiva`** (las variables de la tarjeta, el estilo del gráfico, el halo de las
  etiquetas y la muestra del panel): un ajuste no puede verse en la tarjeta y no en el gráfico. Test probado rompiéndolo.
- **El saneo sólo guarda lo distinto de la plantilla.** Elegir el valor de la plantilla vuelve a ella, y una hoja de
  antes no gana ni una clave (se lee y se compara igual que siempre). Elegir otra plantilla vuelve los ajustes a los
  suyos, en el panel y en la API (`editar_hoja_dashboard` con `ajustes`).
- ⚠️ **La ficha del CRM usa el MISMO panel, pero los ajustes van apagados ahí** (`PanelEstilo` con `ajustes`, sólo el
  editor del Dashboard lo prende). Si se prendieran sin más, serían un control que no guarda: el op `tema` de
  lib/ficha/config.ts copia sólo `plantilla`, `acento` y `fuente`, y `estiloDeFicha` (app/crm/lead-view/ficha/armar.ts)
  decide si hay tema con esas tres (usar `temaPropio`). Se le avisó al jefe del CRM.
- ⚠️ **Tocar app/dashboard/EditorInforme.tsx mete en el tsc acotado a app/conocimientos/Compartir.tsx**, que da rojo por
  `<style jsx>` (el tipo de styled-jsx no entra en el chequeo acotado). No es del cambio: el tsc completo de la CI lo lee.

**«Editar con MaKo» con la cara del Second Brain.** Donde iba el logo va el muñeco de la tab («Dashboard» o «General»,
el del Centro de Operaciones), trabajando mientras piensa, y la caja dicta con su micrófono. El hilo NO pasó a `HiloMako`
(app/_chat/): lo de MaKo acá es «lo que cambió» con su Deshacer y los pedidos de otra hoja, que el modelo de mensajes del
teléfono no tiene. Test: tests/dashboard-editar-mako-muneco.test.ts. **Nadie lo miró en pantalla** (sin RAM para un
`next dev`, y Claude in Chrome desconectado).
**Vive en:** app/dashboard/PanelEstilo.tsx · lib/graficos-temas.ts · app/dashboard/PanelEditarMako.tsx.
*17/10/2026, claude4 (chat Dashboard).*

## Experiments se retiró: un experimento es un ELEMENTO de la hoja que propone «Editar con MaKo» (17/10/2026)

Martín: «Quiero que "Experiments" la simplifiques completamente: la funcionalidad, o lo que pretendía, puede vivir dentro
del chat de MaKo de "Dashboard"». Lo que pretendía la tab: una hipótesis que se vuelve medible (una métrica del catálogo,
dirección, ventana, baseline comparable) y un veredicto con su aprendizaje al cerrar. Eso quedó; las cuatro sub-tabs, la
Retro, el Análisis y la pantalla del teléfono se borraron. Ahora «probemos X» en «Editar con MaKo» agrega un elemento
«Experimento» a la hoja, que se arranca, se mide en vivo y se concluye ahí mismo.

- **El experimento se ata al elemento por `config.elemento` (la fila guarda el id del elemento), no al revés.** Arrancar
  pasa en modo VISTA y no escribe la hoja: no hay guardado que pise a otra pestaña con el editor abierto, y el elemento
  encuentra su experimento con `GET /api/experimentos?elemento=E`. Arrancar dos veces (dos pestañas, doble clic) devuelve
  el mismo (`experimentoDeElemento` ANTES de `crearExperimento`). Consecuencia: duplicar o copiar la hoja da ids nuevos
  (`hojaConIdsNuevos`), y la copia vuelve a mostrar la PROPUESTA, no el experimento — en otro negocio es lo correcto.
- **Una métrica que no está en el catálogo NO se adivina** (`sanearPropuesta` devuelve null, lib/experimentos-catalogo.ts):
  un experimento con la métrica cambiada da un veredicto sobre otra cosa, y nadie lo nota. La ruta re-sanea lo que
  manda el navegador con la misma función. El catálogo se partió en un módulo PURO para que la hoja y la IA lo lean sin
  `server-only`; `lib/experimentos.ts` le pega el `extraer` de cada métrica.
- **La guía de experimentos va en el mensaje del USUARIO, no en el system** (`GUIA_EXPERIMENTOS`, lib/graficos-ia-edicion.ts):
  el system se puede reemplazar desde /configuraciones (prompts editables) y la guía se perdería con él. Y sólo en el
  Dashboard: General no es un banco de pruebas (`conExperimentos`).
- **La puerta pasó a la del Dashboard**: `soloAdminDeTab('graphics')` en la ruta y `gating.tab: 'graphics'` en el área
  `experimentos` de la API de MaKo (era `experimentos`, la key de la tab que el chat «Sidebar» saca de la barra).
- **Lo que se borró y lo que NO:** se fueron la UI de la Retro y `app/api/retro` (su único llamador era la tab), las
  ideas/sugerencias por HTTP y el informe de Análisis. Se quedan `lib/retro-*` (la API de MaKo lee las retros viejas),
  `lib/analisis-negocio.ts` (lo usan mako-tools, la API de métricas y Offer), el informe congelado de /analisis/trimestre,
  y `experimento_tareas`/`tarea_categorias`, que son del Plan (su demo se mudó a app/plan/_demo.ts). /vsl/experimentos es
  una página de la landing y no tiene nada que ver.
- **El «Probarlo» de Offer** lleva a `/dashboard?probar=<hipótesis>`, que abre el panel con «Probemos: …» escrito. En el
  TELÉFONO se sacó: /m/dashboard no tiene «Editar con MaKo» y el link aterrizaba en una hoja sin nada de la hipótesis.
- ⚠️ **Un link viejo a /experimentos?tab=experiments&hipotesis=… conserva la hipótesis** (`destinoDeExperimentos`): los
  mensajes de WhatsApp y los PDF de Offer que ya salieron la llevan.

Tests: tests/experimentos-en-la-hoja.test.ts y tests/analisis-mudada.test.ts, probados rompiéndolos (números en su encabezado).
**Nadie lo miró en pantalla** (sin RAM para un `next dev`).
**Vive en:** lib/experimentos-catalogo.ts · lib/experimentos.ts · app/dashboard/ElementoExperimento.tsx ·
app/api/experimentos/route.ts · lib/graficos-ia-edicion.ts.
*17/10/2026, claude4 (chat Dashboard).*

## Una plantilla entra al instante y se ajusta por detrás: lo que gana si la persona la tocó (17/10/2026)

Martín (#857, revisión del 16/10, 1:08:13): el «Revisando… N s · hasta 2 min» al elegir una plantilla «confunde al
usuario». Ahora la hoja entra YA con la plantilla tal cual —cada gráfico con su cargando, como cualquier hoja— y
/api/graficos/plantilla la ajusta a los datos del negocio en el fondo (saca los vacíos, MaKo suma otros).

- **La ruta ajusta la hoja que la pantalla YA creó** (manda `hoja` con sus ids): los gráficos que se quedan conservan su
  id y lo que ya leyeron. Si la ruta instanciara la suya, la hoja entera se volvería a leer al reemplazarse.
- **La ajustada reemplaza sólo si nadie la tocó** (`sigueComoSeCreo`, lib/graficos-plantilla-relleno.ts). ⚠️ Comparar
  la hoja ENTERA no sirve: la grilla compacta lo que vino al montar (en edición escribe posiciones sin que nadie toque
  nada), y con eso el ajuste no llegaba nunca. Se comparan sin las posiciones; un título, un filtro o una pieza de más o
  de menos sí cuentan, y entonces lo de la persona gana sin aviso.
- ⚠️ **El ajuste NO va con el controlador del modal:** el modal se cierra apenas se crea la hoja y su desmontaje aborta
  `ctrl` (así cortaba antes el pedido al cerrarlo). Va con su propio `AbortSignal.timeout`.
- Reemplazar no se deshace (como crear) y vacía la pila de deshacer.

Test: tests/dashboard-plantilla-al-instante.test.ts (probado rompiéndolo). **Nadie lo miró en pantalla.**
**Vive en:** app/dashboard/NuevaHoja.tsx · app/dashboard/EditorInforme.tsx (`rellenarHoja`) ·
lib/graficos-plantilla-relleno.ts · app/api/graficos/plantilla/route.ts.
*17/10/2026, claude4 (chat Dashboard).*

## General vuelve a tener la búsqueda y el filtro de fecha (17/10/2026)

Martín (#858, revisión del 16/10, 1:10:12): en General «el filtro… de fecha y… la barra de búsqueda… siempre deberían
aparecer por defecto», y editando falta cómo agregarlos. Revierte el 14/10, cuando los sacó porque «no sirven en general».

- **Las plantillas de General YA traían su control de período** (`plantilla()`, lib/graficos-plantillas-generales.ts):
  lo único que faltaba era dibujar la barra, que el editor escondía con `!esGeneral`. Ahora va en las dos pantallas, salvo
  en blanco.
- ⚠️ **El período mueve los GRÁFICOS de la hoja, no los bloques de General**: los bloques leen `armarDatosGeneral` con su
  propio rango («del mes», «hoy», el trimestre del OKR). Por eso el 14/10 «no servía»: en una General hecha sólo de
  bloques, el filtro no cambia nada. Si Martín lo quiere en los bloques, es otro trabajo (cada bloque con su período).

Test: tests/general-filtros-por-defecto.test.ts (probado rompiéndolo). **Nadie lo miró en pantalla.**
*17/10/2026, claude4 (chat Dashboard).*

## Los bloques épicos siguen el color de la hoja: la portada, y lo relleno de los bloques de General (17/10/2026)

Martín (#859, revisión del 16/10, 1:12:30): «los bloques… épicos… no están reaccionando con la edición del estilo de la
hoja como el cambio de color». La portada se pintaba con la identidad de su plantilla (lib/graficos-identidad.ts) y los
bloques de General con `--primary`, el azul de la app: ninguno leía el acento de «Estilo de la hoja».

- **Con un acento elegido, la portada es de ese color** (`identidadEfectiva`); la forma sigue siendo la de su identidad.
  Sin acento, la de la plantilla (cada plantilla se distingue por su color). ⚠️ Son TRES los que dibujan una tarjeta —el
  editor (el marco), el gráfico de adentro (su paleta y su halo, Grafico.tsx) y la miniatura de la galería— y los tres
  reciben el acento: con uno solo, la tarjeta sale de un color y sus series de otro.
- ⚠️ **La tinta sobre un color que eligió la persona se CALCULA** (`tintaSobre`): la tabla de identidades trae sus tintas
  curadas, un acento libre no. La primera versión (92 % de negro) la tiró el propio test: 4,47 sobre #338833. Con 96 %, el
  peor fondo de la grilla del test da 4,53 (#3377CC): queda poco margen, así que no se aclara la tinta oscura.
- **Los bloques de General pintan con el acento sólo lo RELLENO** (barras, botones, los números del Plan: `--gb-acento`,
  app/general/bloques/comun.tsx), también en el teléfono (app/m/hoy/GeneralM.tsx). Los links de texto siguen en
  `--primary`: un acento claro (el lima) sobre la tarjeta blanca no se lee.
- En Propiedades, con un acento en la hoja, el color de portada dice «Usa el color de la hoja» (elegir uno cambia la forma).

Test: tests/graficos-identidad-acento.test.ts (probado rompiéndolo). **Nadie lo miró en pantalla.**
**Vive en:** lib/graficos-identidad.ts · app/dashboard/EditorInforme.tsx · app/dashboard/Grafico.tsx ·
app/dashboard/MiniaturaHoja.tsx · app/general/bloques/comun.tsx.
*17/10/2026, claude4 (chat Dashboard).*

## Un MaKo con dos modos: un análisis pedido en «Editar» no toca la hoja (17/10/2026)

Martín (#862, revisión del 16/10, 1:24:47): Joan le pidió al panel «Editar con MaKo» un análisis del funnel y MaKo le
EDITÓ la hoja: «Una cosa es MaKo analiza y otra cosa es MaKo Edita». El AI Analyst (⋮) y «Editar con MaKo» eran dos
paneles sin relación, y el de editar convertía cualquier pedido en cambios.

- **La regla no depende de que el modelo la cumpla:** la guía le pide `"analizar":true` para un análisis, y
  `aplicarEdicion` DESCARTA los cambios que vengan con esa marca (el modelo a veces manda las dos cosas). La guía va en el
  mensaje del usuario, como la de experimentos: el system se reemplaza desde /configuraciones.
- **Los dos paneles son el mismo MaKo en dos modos** («Analizar · Editar» en la cabecera, app/dashboard/ModosMako.tsx), y
  un análisis pedido en Editar ofrece «Analizar la hoja», que pasa al otro modo sin cerrar el panel. Los modos aparecen
  sólo si la persona tiene los dos: el AI Analyst no es del que sólo mira y editar es del que guarda.
- La API de MaKo (`editar_hoja_con_ia_*`) ya contestaba «sin cambios» con la respuesta: un análisis tampoco cambia nada ahí.

Test: tests/dashboard-mako-modos.test.ts (probado rompiéndolo). **Nadie lo miró en pantalla.**
**Vive en:** lib/graficos-ia-edicion.ts · app/api/graficos/editar/route.ts · app/dashboard/PanelEditarMako.tsx ·
app/dashboard/PanelAnalista.tsx · app/dashboard/ModosMako.tsx · app/dashboard/EditorInforme.tsx.
*17/10/2026, claude4 (chat Dashboard).*

## Mirando, MaKo cambiaba la hoja: el botón de la topbar abría «Editar», y el «analizar» lo decidía el modelo (17/10/2026)

Martín, 17/10 19:31: «ya falló con Mauricio, al estar en VISTA del dashboard debería asesorar, no modificar».

- ⚠️ **El diagnóstico obvio era el equivocado.** Por «Un MaKo con dos modos» (arriba) parecía cubierto, porque el
  CÓDIGO descarta los cambios de un análisis. Pero sólo los descarta si el MODELO marca el pedido con `"analizar":true`.
  Y «muéstrame…» o «compárame…» los puede leer como «agrega un gráfico». El agujero era el camino: el botón de MaKo de la
  topbar abría «Editar con MaKo» también MIRANDO (`guardable && !enBlanco && !compartido`, sin `editando`). Lo que
  devolvía entraba por `mutar` y lo escribía el autoguardado, que guarda igual en vista. Ni la ruta ni el panel
  preguntaban si la persona estaba editando.
- **Ahora lo decide el server:** `/api/graficos/editar` contesta 409, sin gastar un token, si el pedido no trae
  `modo: 'editar'`, `editando: true` y el id de ESA hoja (`permisoEdicionMako`). Mirando, el botón abre el AI Analyst.
  El panel que cambia la hoja sólo se monta editando, y la cabecera ofrece «Editar» sólo editando. Al tocar «Ver» con
  el panel abierto, pasa a Analizar. Y `ponerHojaDeMako` no aplica nada fuera de la edición, por si una respuesta
  llega tarde. `?probar=` (la hipótesis de Offer) es un pedido de cambiar, así que entra editando.
- **Los otros caminos, revisados:** el chat por gráfico (`ChatMakoGrafico`) y el AI Analyst no tienen cómo escribir la
  hoja. La API de MaKo (`editar_hoja_con_ia_*`) es una herramienta de EDITAR, propone y la persona confirma: no hay un
  «en vista» ahí. Las burbujas «archivar otra hoja» de los pedidos piden un clic, y desde ahora sólo existen editando.
- **Lo medido en la base** (sólo lectura, ws1, informe `graficos.tablero.2` de Mauricio):
  - Hubo UNA sola llamada a «Editar con MaKo» en el ws1, el 17/10 a las 00:10:05 UTC (16/10, 21:10 en Argentina), por
    la red de plataforma (Gemini). El último guardado del informe es de las 00:08:30, ANTES. Ninguna pieza de la hoja
    activa tiene un id de esa hora (el id lleva `Date.now()` en base 36). Esa llamada no dejó nada guardado.
  - Hoy le queda UNA hoja activa, «Ads Analyst». Se creó de la plantilla a las 00:03:53, y a las 00:04:14 MaKo le sumó
    4 gráficos: es el ajuste de la plantilla, no «Editar con MaKo». Tiene 13 hojas archivadas. 7 se archivaron entre
    las 23:58 y las 00:08:30 UTC: las 6 rehechas del 15/10 y una «Landing» creada a las 23:58:56.
  - La base no dice QUIÉN las archivó: el informe no tiene historial, y un clic de la persona y una burbuja de MaKo
    escriben lo mismo. Están archivadas, no borradas, y se recuperan desde Archivados.
  - ⚠️ `anthropic_usage` registra sólo lo que cae a la red de plataforma o a un respaldo. Una llamada que contestó una
    key del negocio no deja fila. Antes de esa llamada hubo un 429 a las 00:08:11 y un guardado a las 00:08:30: no se
    puede descartar que haya sido una edición contestada por otra key del negocio.

Test: tests/dashboard-mako-vista.test.ts (probado rompiéndolo, cinco roturas, 4 / 1 cada una).
**Nadie lo miró en pantalla.**
**Vive en:** lib/graficos-ia-edicion.ts (`permisoEdicionMako`) · app/api/graficos/editar/route.ts ·
app/dashboard/EditorInforme.tsx · app/dashboard/PanelEditarMako.tsx. El plan para el resto de los chats está en
docs/diseno-chats-de-mako.md.
**Lo que quedó SIN hacer:** el autoguardado (`/api/graficos`, guardar) sigue aceptando cualquier tablero, también en
vista. La vista escribe legítimamente (crear o archivar una hoja, el ajuste de una plantilla), así que no se le puede
poner la misma puerta sin separar esas escrituras. El resto de los chats de MaKo sigue sin la regla: el plan.
*17/10/2026, claude4 (agente del Cerebro).*

## Del mapa de calor al diagnóstico de estructura del Web Generator (17/10/2026, la mitad del Dashboard)

Martín (#886, revisión del 16/10, 1:29:51): «que lo que recién vimos en dashboard del template de landing se combine
con esta funcionalidad del feedback de la estructura que te da Web Generator, que vivan ambos lugares». La hoja Landing
dice qué HACE la gente en una página; el Web Generator, qué le FALTA.

- El mapa de calor lleva «Analizar la estructura →» a `/web-generator?analizar=<url>`, de la MISMA página que se está
  mirando. Es el contrato que el Web Generator ya entiende (app/web-generator/page.tsx): no se inventó uno con otra tab.
- La URL se valida (sólo http/https, `hrefAnalizarEstructura`): sale de lo que el Pixel guardó, que viene de afuera.
- Sólo con sesión y mirando: el gráfico le pasa `conEnlaces` al dibujo propio (app/dashboard/graficos/registro.ts), lo
  mismo que decide el ▶ de los anuncios.

Test: tests/landing-estructura-enlace.test.ts (probado rompiéndolo). **Nadie lo miró en pantalla.**
**Vive en:** lib/landing-estructura-enlace.ts · app/dashboard/MapaCalor.tsx.
*17/10/2026, claude4 (chat Dashboard).*

## Una tarjeta rota ya no se lleva la hoja: la red por bloque (17/10/2026)

**Síntoma:** Martín, en el celular: «Cannot read properties of undefined (reading 'length')» y la portada de General
entera en blanco. Era UN bloque (el ejemplo de «Meta objetivo» sin `funnelIds`, lo arregló el Cerebro en 6b922f7e3).

**Causa:** React desmonta hasta el error boundary más cercano, y el único era el de la app (app/error.tsx). No había
ninguno por bloque ni por gráfico: cualquier tarjeta que tirara tumbaba la pantalla, en General y en el Dashboard.

**Lo que quedó:** `RedDeBloque` (app/dashboard/RedDeBloque.tsx) envuelve cada tarjeta. Si su dibujo tira, ESA dice «Este
bloque no cargó» y el resto sigue. Va en los bloques de General (ElementoGeneral, que es también lo que dibuja el
teléfono), en sus miniaturas, y en cada elemento y cada gráfico del editor. En un gráfico, el título y el filtro quedan
arriba.

- **Lo obvio no alcanzaba:** envolver lo que devuelve `dibujar(e)` no atrapa nada si `dibujar` corre en el render del
  PADRE. El error sale de quien llama, por encima de la red. Por eso `dibujar` (y `muestra`) corren en un hijo de la red
  (`DibujoDeBloque`, `MuestraDeBloque`). La regla: lo que puede tirar se llama ADENTRO, no se le pasa ya armado.
- **Volver a intentar sin remontar:** una tarjeta rota reintenta cuando cambia algo de `reiniciarCon` (el gráfico, sus
  datos), comparado de a uno como las dependencias de un efecto. Una `key` con la configuración remontaría la tarjeta
  sana en cada arrastre y perdería lo de adentro (el scroll de una tabla). Al gráfico se le pasa `datos[c.id]` y no
  `est`: sin datos, `est` es un objeto nuevo en cada render y la tarjeta rota reintentaría (y se rompería) en cada uno.
- **No se puede montar en un test:** el jsdom de node_modules no arranca (docs/hallazgos-infra.md), y un render en el
  server no corre error boundaries. El test llama a los métodos de la red y lee el montaje en el código.

Test: tests/general-red-por-bloque.test.ts (probado rompiéndolo, cinco roturas). **Nadie lo miró en pantalla.**
**Vive en:** app/dashboard/RedDeBloque.tsx · app/dashboard/ElementoGeneral.tsx · app/dashboard/EditorInforme.tsx.
*17/10/2026, claude4 (chat Dashboard).*

## Un lead agregado a otro funnel lo encuentra el FILTRO, no el agrupado (17/10/2026)

**Síntoma:** una hoja filtrada por «Renovación» (ws1) salía vacía: ese funnel tiene sólo leads AGREGADOS, y el filtro de
los leads miraba la casa (`leads.funnel_id`). Y la dimensión se seguía llamando «Producto» (Martín decidió «Funnel» el 11/10).

**La decisión (con criterio, sin Martín):** la fila del lead lleva dónde MÁS está (`Fila.m.producto`, de `lead_funnel`,
`funnelsAgregados` en lib/graficos-lectura.ts) y eso lo mira SÓLO `filtrarFilas`. Filtrar trae a los agregados; agrupar
por funnel cuenta a cada lead UNA vez, en su casa. Así ningún total se duplica (era el «sin decidir») y ninguna hoja
filtrada queda vacía. Lo mismo en la cartera. Los pagos ya iban por el funnel del día. El id de la dimensión sigue siendo
`producto` (hojas guardadas); cambió el nombre que se ve.

⚠️ **La revisión del Cerebro (17/10, plata):** así, la venta y lo cobrado de la CASA (el VSL) se sumaban en «Renovación».
Ahora, por un funnel agregado, la fila cuenta pero sus métricas de la casa van en 0 (`Fila.soloCasa`: cierres, vendido,
cobrado, el ciclo hasta el pago; en la cartera, la deuda), y el lead cuenta ahí sólo desde el día en que se lo agregó
(`lead_funnel.created_at` contra la fecha de la fila). Es la regla de los pagos y los OKR: cada cosa en el funnel donde
estaba ESE día. Consecuencia medida en el ws1: los 5 de «Renovación» se agregaron el 13/10 con todo lo anterior, así que
una hoja de Leads por alta o por cierre filtrada por «Renovación» da 0 hasta que pase algo ahí (la fuente Pagos dice lo mismo).

**Trampa:** `sed -i` en Git Bash pasa el archivo entero a LF en el working copy (el diff igual sale chico, porque el
índice ya es LF). **Sin hacer:** un gráfico agrupado por funnel DENTRO de una hoja filtrada por «Renovación» muestra a
esos leads bajo su casa (p. ej. «Ventas»), no bajo «Renovación». Si molesta, que el agrupado use el valor del filtro.
**Vive en:** lib/graficos-agregar.ts (`Fila.m`, `filtrarFilas`) · lib/graficos-lectura.ts (`funnelsAgregados`) ·
lib/graficos-datos.ts (`filasLeads`) · lib/graficos-datos-extra.ts (`filasCartera`) · lib/graficos-catalogo.ts ·
tests/graficos-funnel-agregados.test.ts · *17/10/2026, B5 (claude4)*

## Los experimentos que ya existen: «Editar con MaKo» los conoce (17/10/2026)

Los de antes de la mudanza y los que crea la API no tenían elemento: no se veían en ninguna pantalla. `editarHojaIA`
(lib/graficos-ia-editar.ts) le pasa al modelo los del negocio (id, título, estado; hasta 20, los títulos como dato no
confiable) y `aplicarEdicion` pone `{"experimento":{"id":N}}` validado contra ESA lista y una vez por hoja. Lo que la
API y la ruta comparten está en `editarHojaIA`, así que los dos caminos lo tienen. **Vive en:** lib/graficos-ia.ts
(`AlcanceIA.experimentos`) · lib/graficos-ia-edicion.ts · lib/graficos-ia-editar.ts ·
tests/experimentos-existentes-en-la-hoja.test.ts · *17/10/2026, B5 (claude4)*

## «Editar con MaKo»: el hilo sobrevive a recargar, y Claude en pausa no dice «Conecta tu Claude» (17/10/2026)

- **El hilo** se guarda en el navegador por informe y por hoja (app/dashboard/hilo-guardado.ts), LIVIANO: sin las hojas de
  antes y de después de cada cambio (después de recargar no se ofrece un Deshacer viejo: la hoja ya se guardó). Se lee
  después de montar y no se guarda el `{}` del primer render encima (`hilosListos`). Test: tests/dashboard-hilo-guardado.test.ts.
- **Claude en pausa** (`claudePausado`): `conClaveDelNegocio` devolvía null y el negocio que conectó SU Claude leía «Conecta
  tu Claude». Ahora la pausa deja su error (`CLAUDE_EN_PAUSA`, lib/anthropic.ts). Test: tests/claude-pausado-aviso.test.ts.
*17/10/2026, B5 (claude4)*

## El Dashboard unido: Focus es la General, y siguen siendo dos informes (17/10/2026)

Martín (17/10, ~22:40, prototipo docs/prototipos/coherencia-1710.md, pedido 3): «Home» sale de la sidebar, el Dashboard
abre en la hoja fija «Focus» (lo que era /general), las otras pestañas son las hojas de siempre y las plantillas van a
«Templates». La barra, el menú del teléfono y Ctrl K son del chat Sidebar; lo de adentro, de acá.

- **Lo obvio era mudar General al informe del Dashboard, y no:** son dos informes con dos claves
  (`general.informe.<sub>` y `graficos.tablero.<sub>`), y los bloques de General sólo se dibujan dentro de
  `ProveedorGeneral`. Mudar habría sido una migración de datos de cada persona por una cuestión de navegación. No se
  mudó nada: /dashboard elige QUÉ EDITOR monta según `?hoja=` (`informeDePedida`, lib/dashboard-focus.ts) y cada
  editor recibe las hojas del otro para la tira.
- **Medido antes de decidir (prod, 17/10):** hay 3 General guardadas y una (ws1) tiene dos hojas, «Foco de la semana» y
  «Cobros». Por eso Focus es la PRIMERA hoja de General y las otras van como pestañas después de Focus. Si Focus fuera una
  sola hoja, «Cobros» quedaba sin camino.
- **La `key` por informe, no por hoja:** pasar de Focus a una hoja es una navegación a la MISMA ruta, y React reusaría el
  editor montado con el estado del otro informe. Pero una `key` con la hoja remontaría el editor en cada `router.refresh()`
  (lo hacen los bloques al cambiar datos), porque la URL ya trae la hoja nueva. Las pestañas del editor montado cambian
  en el lugar (`irAHoja`); las del otro son links.
- **`?hoja=` de una hoja de General abre Focus:** es lo que el editor escribe en la URL al cambiar de hoja, así que
  recargar tiene que volver ahí. Una plantilla pedida por URL (`foco`, `comercial`, las rutas viejas de los Analysts)
  sigue siendo del Dashboard. Ojo: `foco` es una plantilla del Dashboard y `focus` es la hoja fija.
- **«Templates» desde Focus** lleva a `/dashboard?plantillas=1`, que abre la galería UNA vez: el parámetro se borra de la
  URL al entrar, o recargar la volvería a abrir.
- **Los `revalidatePath('/general')` del CRM se quedaron** (16 en app/crm/actions.ts y 6 más en app/crm/, que son del chat
  CRM). No hace falta tocarlos: next.config no define `staleTimes`, así que una página dinámica no se guarda en la caché
  del cliente (y 8 de esos 22 lugares ya revalidan también `/dashboard`). Los de General (app/general/actions.ts,
  general.run.ts) pasaron a `/dashboard`.
- **El teléfono:** la «Hoja» de /m/hoy (#872) suma las hojas del Dashboard que entran en el teléfono, cada una a su
  pantalla de siempre (/m/dashboard/<id>), y `/dashboard?hoja=focus` cae en la portada. /m/dashboard no se tocó.

Test: tests/dashboard-focus.test.ts (probado rompiéndolo, ocho roturas). **Nadie lo miró en pantalla.**
**Vive en:** lib/dashboard-focus.ts · app/dashboard/page.tsx · app/dashboard/FocusDeGeneral.tsx ·
app/dashboard/PestanasDashboard.tsx · app/dashboard/EditorInforme.tsx · app/general/page.tsx · app/m/hoy/page.tsx.
*17/10/2026, claude4 (chat Dashboard).*

## Lo que quedó sin hacer

- **El Dashboard unido (17/10/2026):**
  - En /m/dashboard el segmentado no tiene Focus (la barra de abajo lleva a la portada).
  - Una hoja de General pedida como `/dashboard?hoja=<id>` en el teléfono cae en /m/dashboard/<id>, que vuelve a
    /m/dashboard. El mapa de rutas no lee datos, así que no sabe que esa hoja es de General. Sólo pasa con una segunda
    hoja de General (hoy, la del ws1).
  - El desplegable de hojas de la barra sigue en los dos editores. Repite la tira, pero tiene lo que la tira no tiene:
    renombrar, archivar y lo archivado.

- **La red por bloque (17/10/2026):** las miniaturas de la galería dibujan los gráficos de ejemplo sin red
  (app/dashboard/MiniaturaHoja.tsx; sólo los bloques de General la tienen ahí). Los datos de ejemplo son fijos, así que
  el riesgo es bajo. Y lo que falla al LEER los datos de /general (app/general/datos.ts) no es un dibujo: eso sigue en
  la página.

- **#886, la otra mitad:** que el diagnóstico del Web Generator muestre las métricas de la página (visitas, hasta dónde
  bajan, qué tocan) es del chat Web Generator (app/web-generator/diagnostico/PanelDiagnostico.tsx). Avisado al Cerebro.

- **Una plantilla que se ajusta por detrás (17/10/2026):** mientras llega el ajuste, la hoja muestra los gráficos que
  después se van (los vacíos dicen «Sin datos» unos segundos). Si se quisiera, marcarlos como «midiendo» hasta que llegue.

- **Experiments en la hoja (17/10/2026):**
  - ~~Un experimento creado por la API o uno de antes del 17/10 no se ve en ninguna pantalla~~ **Arreglado el
    17/10/2026**: «Editar con MaKo» los conoce y los pone en la hoja (ver «Los experimentos que ya existen», más arriba).
    Sigue sin pasar SOLO: hay que pedírselo («traeme mis experimentos»).
  - El teléfono no muestra ni pide experimentos: /m/dashboard destila la hoja en sus números y su serie
    (`piezasDeHoja`, app/m/dashboard/datos.ts, sólo gráficos) y no tiene el panel de «Editar con MaKo».
  - Una Retro nueva ya no se genera en ningún lado. Si vuelve, que sea otro elemento de la hoja.
  - ⚠️ **Las dos redirecciones conservan la puerta de la tab** (`requireRolWs([], { nav: 'experimentos' })` y
    `requireMovil({ navKey: 'experimentos' })`): el chat «Sidebar» dejó la key viva (ítem sin fila, sección oculta del
    teléfono) y tests/movil-mas-secciones.test.ts exige esa puerta en las dos páginas. Cuando la key se vaya de
    app/_components/nav.ts, lib/movil-rutas.ts y lib/capas.ts (la capa superadmin), se van esas dos líneas y el
    `experimentos` de `conRol`, y /experimentos y /m/experimentos entran en `RETIRADAS` de tests/tabs-retiradas.test.ts.

- ~~**El filtro «Producto» de los LEADS mira sólo la casa**~~ **Arreglado el 17/10/2026**: ver «Un lead agregado a otro
  funnel lo encuentra el FILTRO, no el agrupado», más arriba.

- **Las portadas (15/10/2026):** mirado en producción en el ESCRITORIO con las 6 hojas de Mauricio; el celular, sólo en el
  arnés (la ventana de la extensión no se dejó angostar). Falta decidir con Leila (o con Martín) su Cobranza, que es una
  hoja propia y quedó como estaba. La fila «Portada» del panel está para los GRÁFICOS; un bloque de General todavía no se puede
  pintar ni despintar desde su panel (sí borrarlo). La plantilla Instagram no tiene los DM: ningún negocio los tiene
  conectados (cuando lo haya, un bloque que ofrezca conectarlo ahí mismo). Un negocio sin el dato de su portada (sin Meta,
  sin cartera) la pierde al crear la hoja: la ruta de plantillas saca los gráficos vacíos.

- **El Dashboard épico (14/10/2026):** el titular 6 × 6 lo reemplazó la PORTADA el 15/10 (ver arriba). Lo de abajo de la
  portada sigue como estaba: si Martín quiere menos piezas por hoja, es elegir qué se va (decisión suya).
- **Rediseño por tipo, mitad Dashboard (14/10/2026):** NADA de esto se vio todavía en producción ni con datos reales: el
  arnés dibuja datos de ejemplo. El 15/10 se miró además Contraste en el modo por tipo (bien); Minimal, Suave, Elevada,
  General y Editorial siguen sin mirar por tipo. Después del deploy, ws3 en el
  editor con «Celular». Sin mirar en el arnés: «Conclusiones de MaKo», la Ficha y el mapa de calor de página (piden datos
  del server). Un número alto (3 × 6) va centrado pero no crece con el alto. La leyenda HTML de la torta no prende ni
  apaga porciones (la de recharts tampoco lo hacía en la torta). Y sigue esperando a Martín si se borran
  `PulsoPaginas.tsx` y `ScriptsBrowser`/`GuionesFull`.
- **Rediseño por tipo, mitad General (14/10/2026):** la etiqueta del último punto de un panel (`graficos/Etiquetas.tsx`) pisa
  un poco el final de su línea; las tarjetas con pocas filas dejan media tarjeta vacía en las plantillas de Marketing y Ads
  (12×12 y 12×16: con 10-50 anuncios reales se llenan); y el mapa por país es una franja en una tarjeta alta (Equal Earth es
  ancho y no se recorta al continente de los datos). Y un gráfico mapa con dimensión «país» o «ciudad» y sin `g.mapa` cae a
  nivel «región» en Grafico.tsx (`g.mapa?.nivel ?? 'region'`) y pregunta el país: **arreglado** en cdaebefa1 (el nivel sale de
  la dimensión).

- **Las miniaturas de «¿Qué vas a crear hoy?» muestran datos de EJEMPLO** (lib/graficos-muestra.ts), no los del negocio:
  medir todas al abrir serían ~150 gráficos. Si se quisiera el número real, pedirlo sólo para la miniatura que se VE
  (el IntersectionObserver de app/dashboard/MiniaturaHoja.tsx ya dice cuál) contra /api/graficos/plantilla.

- **El tipo `Bloque` y `clase: 'bloque'` siguen en `lib/graficos-catalogo.ts`** (y `esBloque`, `sanearBloque`): los necesita
  la migración v5 para leer un informe viejo. El código que los DIBUJABA se borró el 13/10 (merge de `graphics-bloques-1310`;
  lo vivo se mudó a `lib/datos-comercial*.ts`, `lib/llamadas-modelo.ts`, `app/dashboard/entidades/FichaLlamada.tsx` y
  `app/dashboard/piezas.tsx`).
- **`controlParaHttp` (API) y `controlParaLink` (link) siguen siendo dos funciones** (miden contra universos
  distintos). Y `useValoresCompartidos` vive en `BarraControles.tsx`, no en `valores.ts`.
- **El tipo de control `texto` se llama «Búsqueda» en `TIPOS_CONTROL`** y la pantalla lo muestra «Contiene…»
  (lo traduce `MenuFiltro`): la API dice otra cosa que la pantalla.
- **Un link abierto CON sesión de MaKo** lee el tablero de Tareas según la sesión de quien lo abre
  (`queTableroLeer`), no según la capa del share.
- **Lecturas de Comercial sin paginar** (`lib/pagos.ts`, `lib/queries.ts`): la primera que va a cortar en 1000
  filas es `getOutstandingDetalle`.
- **`sniffImagen` tiene tres copias** (`app/api/perfil/avatar`, `app/api/portadas`, `app/api/graficos/imagen`).
- **Copiar un dashboard no está en la API de MaKo** (la decisión 7 del 11/10: todo el Dashboard por la API). Faltan
  `copiar_dashboard` y `pegar_dashboard` en `lib/api-mako/areas/dashboard.def.ts`; la ruta de la pantalla es
  `app/api/graficos/copia/route.ts`.
- **`lib/flujo-copia.ts` tiene su propia copia de la mecánica del token** (alfabeto, largo y regex con `MAKO-FLUJO-`):
  cuando se toque, que delegue en `lib/token-copia.ts`. No se tocó para no pisar al chat de Automations.
- **Publicar una hoja en «Creaciones» (las estrellas)**: el chat API de MaKo armó el mecanismo (mig 0273,
  `lib/creaciones.ts`, rama `api-acciones-1310`) y el Dashboard está en `POR_ENCHUFAR`. Cuando llegue a main: pasarlo a
  `ENCHUFADOS` (`lib/creaciones-reglas.ts`), su enchufe en `lib/creaciones-enchufes.ts` reusando `hojaParaOtroNegocio` y
  `hojaConIdsNuevos` (`lib/graficos-copia.ts`), y `<BotonPublicar tipo="dashboard" …>` en el ⋮ de la hoja.
  ⚠️ (17/10, B5) `hojaParaOtroNegocio` SOLA no alcanza: deja intactos los filtros fijos, y uno sobre un closer manda su
  nombre a la galería. Va `hojaParaCopiar` primero. Y quien nunca guardó su informe trae el INICIAL (`estado: 'inicial'`):
  no se le suman esas hojas. HECHO y sin subir en la rama `pend-b5-publicar-dash` (`cc07af5ea`), para después del 20/10.
- **El teléfono (`/m/dashboard`)** le sigue mostrando Marketing y Comercial fijos a quien no tiene informe (en
  escritorio arranca en blanco con «＋ Nuevo Dashboard»).
- **El AI Analyst no dice qué modelo contestó** (falta `respondioOut` en `chatCheapCascade`,
  [hallazgos-ia.md](hallazgos-ia.md)).
- **El onboarding de la tab**, velas y campos calculados: no se hicieron.

*10-11/10/2026, chat «Graphics». El v3 (feedback de veinte puntos, Exportar, Analysts, AI Analyst):
corrida de 9 agentes `wf_57bc1bc0-b52` + integración, commit `623ff3cd`. El v4 (las seis decisiones y la
API): seis agentes en paralelo (P1 elementos, P2a Closing, P2b modo closer, P3 Ads, P4 Landing, P5 API) +
integración, commit `6e85d8d7`. Las cohortes en «Todo» y la guarda de «Marcar cobrada» se cerraron ahí
(decisiones 3 y 2). La topbar de Looker y Compartir (feedback de nueve puntos, 11/10 a la tarde): dos
agentes en paralelo (TOPBAR y COMPARTIR) + integración en un worktree limpio.*
---

## La tabla de cuotas no dice «Pendiente» de una cuota devuelta o de baja (17/10/2026)

Con «Todo», `filasPagos` pintaba «Pendiente» la cuota de un cliente dado de baja (#871) o devuelta por un reembolso, y la
sumaba en `pendiente`. Ahora dice «De baja» o «Devuelta» y no suma: la regla de toda suma de lo impago (`noEsDeuda`,
lib/cobrado-lead.ts). Se lee con `*` porque `baja_at` es de la mig 0307 y una lista explícita rompe la tabla sin ella.
**Vive en:** lib/graficos-datos.ts (`filasPagos`) · tests/graficos-cuota-baja.test.ts · *17/10/2026, agente B4.*

## «Editar con MaKo» guarda su charla en la base y llega al Ops Center (22/10/2026, TB1)

Martín, 22/10: «¿Todos esos chats regresan y se quedan registrados en Ops Center?». «Editar con MaKo» guardaba el hilo en
el NAVEGADOR (localStorage `mako.editar-con-mako.hilos.<informe>`): otra computadora no lo veía y el Ops Center tampoco.
Ahora cada turno va a `chart_sessions` con la clave `dashboard:<hoja>` por `/api/hilo-de-tab`, y una hoja sin hilo en el
editor trae el suyo al abrir el panel. Los chats de cada gráfico siguen siendo `dashboard:<hoja>:<gráfico>`: no chocan.

- **Lo que quedó en el navegador se sube UNA vez y se borra** (EditorInforme.tsx, `siVacia`): si esa hoja ya tiene charla
  en la base no se duplica, y sin sesión (un link compartido) o sin red queda en el navegador para la próxima.
- **En la base un mensaje de MaKo es UN texto** (lo que sabe dibujar el Ops Center): lo que cambió va en renglones «• …»
  y los avisos en «Ojo: …», y `hiloDeFilas` los separa al volver. Un aviso guardado sin su marca vuelve como texto.
- **Después de recargar no vuelven el «Deshacer» ni las burbujas de pedido**, a propósito: la hoja ya se guardó con el
  cambio y las burbujas navegan desde ESA sesión.
- **Medido en producción el 22/10, en el ws3:** «Agrega un número con los leads de esta semana» agregó la tarjeta, recargar
  trajo la charla y el Ops Center la muestra como «Dashboard › Editar con MaKo · Página 1» con sus dos mensajes. Se abría
  VACÍA hasta 9fb5bace3, por un bug del GET de /api/mako/chat que tapaba a todo chat de antes
  (docs/hallazgos-second-brain.md).
- **Sin hacer:** la caja y el hilo únicos (TB3).

**Vive en:** app/dashboard/hilo-guardado.ts, PanelEditarMako.tsx, EditorInforme.tsx · lib/hilo-de-tab-reglas.ts ·
tests/dashboard-hilo-guardado.test.ts, tests/hilo-de-tab.test.ts · *22/10/2026, chat «Chats de las tabs».*

## El MaKo de los gráficos va a la estrella, y «Editar con MaKo» con las piezas del Ops Center (22/10/2026, TB3)

Martín, 22/10: «quiero que todos los chats de MaKo en las tabs sean el del Ops Center». El botón de MaKo de cada gráfico y
el «Preguntarle a MaKo» del clic derecho abrían un modal con su chat propio (`MakoChat`); ahora le mandan el gráfico a la
estrella de la tab (`MakoEnLaTab`, que monta EditorInforme.tsx) con la hoja como entidad y en «analizar», así que en vista
MaKo asesora y no toca la hoja. «Editar con MaKo» sigue con su motor (el único escritor de la hoja abierta), pero su hilo
es `HiloMako` y su caja `CajaChat`; lo que cambió con su Deshacer va en el hueco `enMensaje`. Y el marco `.an` (el AI
Analyst y «Editar con MaKo») pasó a la IZQUIERDA; el editor le deja el lugar a la estrella con `--ancho-panel-mako`.

- **`CajaChat` y `HiloMako` NO cargan en node** (AdjuntosCaja trae `chat.css`): un módulo que un test importa por valor no
  los puede importar. PanelAnalista.tsx lo importa tests/dashboard-topbar.test.ts (dibuja `ChatMakoGrafico`), así que el
  botón le habla a la estrella por un EVENTO de la ventana (app/dashboard/pregunta-grafico.ts) y no importa la estrella.
  Antes de sumar la caja a un archivo, se mira si algún test lo trae por el grafo (`node scripts/tests-afectados.mjs
  --listar --explicar` con un cambio de sonda en ese archivo).
- **El texto que sale es `contextoDeGrafico`** (las personas ya cambiadas por alias), el mismo que leía el modelo antes;
  ahora además se ve en el mensaje de la persona.
- **Medido en producción (tren 8, ws3):** el botón de «Salud del Funnel» abrió la estrella con el chip «desde Dashboard ›
  Marketing» y lo que muestra el gráfico; el Cerebro del ws3 no tiene IA, así que la respuesta pide conectarla.
- **El panel no es un `<aside>`**: con el super admin mirando un cliente, `[data-barra-agencia] aside` (app/globals.css) le
  fuerza a todo `<aside>` el `top` y el alto de la ventana con !important. «Editar con MaKo» medía 761 px en un lienzo de
  612 y su caja quedaba fuera de la vista (sin el atributo, 588). Ya pasaba a la derecha; ahora los dos son un `<section>`.
- **El panel arranca a 84 px**: a 12 px, el botón de la estrella (56 px, fijo a 16 px del borde de la barra) le tapaba el
  emoji de la caja. Abierta la estrella, el editor se corre (`--ancho-panel-mako`) y el panel queda a su derecha.
- **Sin hacer:** las sugerencias propias de cada gráfico (`makoIA.sugerencias`) no viajan a la estrella; los chats de los
  gráficos de antes siguen en el Ops Center como «de antes» (`dashboard:<hoja>:<gráfico>`). Y el «Deshacer» de MaKo no
  aparece cuando lo que agregó es un GRÁFICO: la grilla le reescribe las posiciones al montarlo, y la comparación por
  referencia (`leerHoja(id) === m.aplicada`) lo da por tocado. Con un cambio que no suma nada (el nombre) sí aparece. Ya
  pasaba antes de TB3; queda el Ctrl+Z del editor.

**Vive en:** app/dashboard/pregunta-grafico.ts, items-edicion.ts, PanelAnalista.tsx (`ChatMakoGrafico`, `.an`),
PanelEditarMako.tsx, EditorInforme.tsx, editor-css.ts · tests/dashboard-estrella-grafico.test.ts,
tests/dashboard-editar-mako-muneco.test.ts · *22/10/2026, chat «Chats de las tabs».*

## La hoja Closing dice «Conecta tu Claude» sólo con un «no» seguro (22/10/2026)

- **El aviso lee la MISMA pregunta que el cron** (`conQueAnalizaElClosing`, lib/closing.ts): 'no' = no hay su Claude ni el
  permiso de la plataforma. Con 'no-se' (la base no contestó) se calla: un «conecta tu Claude» a quien ya lo tiene es
  mentira, y lo manda a pegar una clave que ya pegó (app/dashboard/aviso-closing.ts).
- **Se reconoce la hoja por su plantilla, no por su nombre** (`Hoja.plantilla === 'closing'`): una hoja renombrada sigue
  siendo la Closing, y una copia a mano llamada «Closing» no lo es. Sólo se pregunta si el informe tiene una.
- **Conectar es con EL modal de /integraciones, sin salir de la hoja** (`BotonIntegracion servicio="anthropic"`). La primera
  versión tenía un link a /integraciones y la frenó tests/integracion-sin-salir.test.ts: un aviso que conecta algo no
  manda a otra pantalla. Al conectarlo, el aviso se va sin recargar la hoja.
- El closer mira su hoja en sólo lectura y no conecta: lee el aviso sin botón. Un link compartido no lo muestra.

## Aplicar el diseño de los 114 tableros: lo que la medición desmintió del propio documento (31/10/2026)

**Vive en:** `lib/graficos-temas.ts` (el vocabulario), `app/dashboard/Grafico.tsx` (el morfeo),
`app/dashboard/graficos/Vocabulario.tsx`, `lib/graficos-plantillas.ts`, `app/dashboard/PanelEstilo.tsx`.
El análisis es [diseno-dashboards-codeandchill.md](diseno-dashboards-codeandchill.md).

**Tres cosas que el documento daba por ciertas y no lo eran.** Se escribió mirando demos ajenas y
leyendo nuestro código por encima, y en tres puntos acusa al archivo equivocado. Antes de aplicar una
de sus fichas, **abrí el archivo**:

- **«El delta no sigue al filtro» (A3) no es un bug nuestro.** Es el defecto de Corbel, y la ficha
  pedía *verificar* que nosotros lo leyéramos con los filtros efectivos. Lo hacemos:
  `datosDeGraficos` filtra las DOS lecturas con los mismos `filtros`, y `firmaDe` los lleva, así que
  un cambio de filtro vuelve a pedir los datos. No había nada que arreglar; quedó un test que lo
  bloquea, porque la línea que lo cumple es una sola y sacarla no rompe ninguna otra cosa.
- **«La muestra de cada plantilla es un cuadradito de acento» (A6) es falso.** `Muestra` de
  `PanelEstilo.tsx` ya dibuja CUATRO barras con la paleta de esa plantilla, más su fondo, su borde, su
  radio, su sombra y su letra — o sea, ya es más informativa que la rueda de cuatro cuartos que el
  documento propone copiar. No se tocó. Lo que sí faltaba de A6 era la FRASE.
- **«La pieza ya existe: Fondo: Oscuro» (A4) es de otra cosa.** Esa opción es de los bloques de
  `/general` (`lib/general-piezas.ts`, `ElementoGeneral.tsx`), no de un bloque del Dashboard: una KPI
  del Dashboard no tenía con qué invertirse. Hubo que agregar `Grafico.invertida` y su CSS.

**Por qué `isAnimationActive` estaba en `false` en los 13 lugares, y el diagnóstico obvio era el
equivocado.** Parece «nadie se tomó el trabajo de animar». No: la animación de recharts, **al montar,
hace crecer las marcas desde CERO**, y eso dibuja un cero que parece medido — justo lo que nuestra
regla prohíbe. Prenderla a lo bruto reintroduce el defecto que el mismo documento pone entre lo que NO
hay que copiar. La forma correcta es animar **sólo cuando el dato cambió entre dos dibujos que YA
tenían datos** (`useMorfeo`): en el montaje y en la primera llegada de datos, nada.

**El morfeo tiene dos modos y el segundo necesita REMONTAR.** Mismas categorías y otros valores →
recharts deforma las marcas en el lugar solo. Otro conjunto de categorías u otra marca → hay que
cambiarle la `key` al gráfico: recharts recalcula el dominio, el eje sale ya nuevo y las marcas entran
desde su base. Sin la `key`, morfear entre dos conjuntos distintos manda un punto a un lugar que no
significa lo mismo, y con distinta cantidad de puntos lo hace mal. La `forma` que decide es
`grupo del tipo | tipo | dimensión | desglose | claves de las filas`.

⚠️ **recharts NO toma una `cubic-bezier`**: sólo las curvas con nombre (`ease-out`, `linear`…). Nuestro
`--ease-out` (`cubic-bezier(.23,1,.32,1)`) no se le puede pasar; lo que sí usa el token es el CSS.

**`agregar` NO recorta por período: eso lo hace el lector.** A `agregar(g, filas, desde, hasta)` le
llegan las filas ya leídas para ese rango, y el `desde`/`hasta` le sirven para armar los casilleros del
tiempo. Por eso `datosDeGraficos` hace DOS lecturas con dos claves de caché. Un test que arma un
período y el anterior con el MISMO arreglo de filas suma todo dos veces y da el doble, sin error.

**Un período filtrado que queda vacío da 0, no `null`** (en una métrica de suma; el `null` es de las
razones y los atributos). Lo que salva al chip de comparación no es el total: es `chipComparar`, que no
divide por cero.

**La paleta de series PISA el semáforo, y quedó SIN hacer a propósito.** Medido el 31/10: en `mako`,
`minimal`, `elevada` y `general`, la serie 4 es `#D0504A` —exactamente `--bad`— y la serie 5 es
`#1E9E57` —exactamente `--good`—. El ACENTO no colisiona (los primeros colores son todos azules) y eso
sí quedó blindado en `tests/graficos-temas-semaforo.test.ts`. Lo de las series no se cambió porque
repinta todas las hojas que ya existen: es una decisión de producto, no una corrección que un test deba
forzar. Si se toca, se toca en `PALETA_MAKO` y en las tres paletas propias de `lib/graficos-temas.ts`.

**Un backtick adentro de `editor-css.ts` rompe TODA la hoja de estilos.** El archivo es CSS dentro de un
template literal de TypeScript: escribir `` `Grafico.invertida` `` en un comentario de CSS cierra el
string y el archivo deja de compilar. Los comentarios de ese archivo van con «comillas angulares», no
con backticks. `tsc` lo caza (TS1005), pero el mensaje apunta a la línea de abajo, no al backtick.

**Dónde va un hook en `CuerpoGrafico`.** Su cuerpo es una IIFE con varios `return` tempranos (sin
resultado, con error…). Cualquier cosa que necesite un hook va ARRIBA de la IIFE, con los `useState`:
el propio archivo ya lo avisa, y es la pantalla en blanco de `AGENTS.md`.

**Lo que quedó SIN hacer de la §9, y dónde vive:**

- **A5, el chip de filtro desde el gesto** (`app/dashboard/BarraControles.tsx`, `MenuFiltro.tsx`): entero.
  Es el que el documento pone último porque depende de los otros siete.
- **El cross-fade de 160 ms del texto** (`app/dashboard/EditorInforme.tsx`): no se hizo porque **hoy no
  tiene disparador** — ningún control cambia la métrica de un bloque en vivo, así que el título y el
  subtítulo no cambian cuando cambia el filtro. El token (`MORFEO.texto`) está puesto.
- **El eje que interpola sus marcas numéricamente** (el detalle de Kairo): no se hizo. recharts
  re-etiqueta de golpe. El documento dice que la variante de Talvo (blanquear las marcas durante el
  tránsito) también sirve y es más barata.
- **El contador de una KPI** (`NumeroGrande`, `app/dashboard/Grafico.tsx`): el número sigue saltando.
  Cuando se haga, la regla de `AGENTS.md` ya está escrita (entre dos valores reales, nunca desde cero).
- **La torta no morfea** (`Torta`, el único `isAnimationActive={false}` que quedó): no tiene eje, así
  que los dos modos de A2 no la gobiernan.
- **El rayado está cableado en barras y áreas**, no en torta, treemap ni sankey. Y la única procedencia
  que el dato sabe hoy es `Resultado.muestra`: **no hay métrica proyectada en el catálogo**, así que
  marcar algo más como estimado sería inventarlo.
