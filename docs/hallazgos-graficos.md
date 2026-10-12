# Hallazgos — el Dashboard (el editor de informes)

La tab Dashboard es un editor de informes copiado de Looker Studio: hojas, 41 tipos de gráfico, estilo
por página, controles (filtros) y los conjuntos de datos de MaKo. **El editor es de Looker; los gráficos
son de MaKo** (Martín, 11/10: «que los graficos editables se parezcan más a esos» — los de las tabs
viejas). El informe inicial es la réplica de las tabs viejas de Marketing y Comercial; las tabs de
Analysts (Ads, Landing, Closing, Productividad) son plantillas de «Nueva hoja». Lo que se hizo está en
el commit; acá va lo que hay que saber **antes** de tocarlo.

## Cómo está armado, en una tabla

| Pieza | Vive en | Qué decide |
|---|---|---|
| El modelo | `lib/graficos-catalogo.ts` | Conjuntos, tipos, hojas (emoji, subtítulo, tema, controles), `efectivoDe` (la precedencia de filtros), los campos COMPARTIDOS. Sin `server-only` |
| Las plantillas | `lib/graficos-plantillas.ts` (+ `-analysts`, `-generales`) | El informe inicial con ids FIJOS y la galería de «Nueva hoja» |
| El estilo de la página | `lib/graficos-temas.ts`, `app/dashboard/PanelEstilo.tsx` | 6 plantillas de estilo; las tarjetas leen `--dash-*` |
| El agregador | `lib/graficos-agregar.ts` | De filas a lo que se dibuja; también `tramosDeDias` |
| Los lectores | `lib/graficos-datos.ts`, `lib/graficos-datos-extra.ts`, `lib/graficos-lectura.ts` | Uno por conjunto, con el workspace explícito; `leer` trae un instante en tramos a la vez |
| Los bloques | `lib/graficos-bloques*.ts`, `app/dashboard/bloques/` | Lo que no es un gráfico del catálogo: Revenue, A quién cobrarle, cohortes, los de Analysts |
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

**Vive en:** `Capa` en `app/dashboard/bloques/piezas.tsx`; `Elemento.tsx`

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

**Vive en:** `lib/graficos-bloques.ts`, `app/dashboard/bloques/`

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

**Vive en:** `app/dashboard/bloques/extra/BloquesClosing.tsx`, `FichaLlamada.tsx`, `app/api/closing/puerta-regla.ts`

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
4. **Un bloque sale sólo si está en `BLOQUES_COMPARTIBLES`:** los que muestran personas o tienen una
   acción («Marcar cobrada», «Editar lead») dicen «No se comparte en un link».

El detalle de un número contesta 403. Medido en Chrome (ws9): 15 componentes sin Editar ni Compartir,
detalle 403, revocar 200 y el link revocado 404. Las puertas (por qué POST, los topes, el 404 que no
distingue) están en [hallazgos-seguridad.md](hallazgos-seguridad.md).

## Lo que quedó sin hacer

- **Un link abierto CON sesión de MaKo** lee el tablero de Tareas según la sesión de quien lo abre
  (`queTableroLeer`, `lib/graficos-lectura.ts`), no según la capa del share: no trae datos de otro
  negocio, pero puede leer la tabla vacía. Lo anota `app/compartido/[token]/informe-compartido.ts`.
- **Los bloques no saben que están en un link** (no hay `soloLectura` en `CuerpoBloque` ni en
  `BloqueCobranza`). Hoy no hace falta: los que tienen una acción no se sirven. Un bloque compartible que
  sume un botón lo dibujaría en el link.
- **`useValoresCompartidos` vive en `app/dashboard/BarraControles.tsx`** porque `valores.ts` no aceptaba
  otra ruta; va a `valores.ts`. Y `controlParaHttp` (API de MaKo) y `controlParaLink` (el link) hacen lo
  mismo dos veces.
- **Dos escritores del mismo tablero**: el autoguardado del editor hace un upsert sin versión y la API
  usa compare-and-set (`guardarTableroSi`). Gana el último que escribe. Que el editor mande la versión.
- **El control «Closer» de la hoja Closing no filtra los bloques** (`PedidoBloque` no recibe filtros); la
  lista de llamadas tiene su propio filtro de closer.
- **Lecturas de Comercial sin paginar** (`lib/pagos.ts`, `lib/queries.ts`): la primera que va a cortar en
  1000 filas sin avisar es `getOutstandingDetalle` (lee TODA la tabla pagos; el ws1 tiene 34).
- **El GeoJSON del mapa** se baja de `raw.githubusercontent.com` en el navegador del cliente.
- **`sniffImagen` tiene tres copias** (`app/api/perfil/avatar`, `app/api/portadas`,
  `app/api/graficos/imagen`): va a un módulo de `lib/`.
- **`useEjemplo` de `app/dashboard/NuevaHoja.tsx`** es una copia del de `app/automations/CrearConIA.tsx`
  (no exportado todavía).
- **El AI Analyst no analiza los bloques** y no dice qué modelo contestó (falta `respondioOut` en
  `chatCheapCascade`, [hallazgos-ia.md](hallazgos-ia.md)).
- **El onboarding de la tab**, mapas de otros países, velas y campos calculados: no se hicieron.

*10-11/10/2026, chat «Graphics». El v3 (feedback de veinte puntos, Exportar, Analysts, AI Analyst):
corrida de 9 agentes `wf_57bc1bc0-b52` + integración, commit `623ff3cd`. El v4 (las seis decisiones y la
API): seis agentes en paralelo (P1 elementos, P2a Closing, P2b modo closer, P3 Ads, P4 Landing, P5 API) +
integración, commit `6e85d8d7`. Las cohortes en «Todo» y la guarda de «Marcar cobrada» se cerraron ahí
(decisiones 3 y 2). La topbar de Looker y Compartir (feedback de nueve puntos, 11/10 a la tarde): dos
agentes en paralelo (TOPBAR y COMPARTIR) + integración en un worktree limpio.*
