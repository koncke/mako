# Dashboard v5 — el contrato de la tanda (11-12/10/2026)

<sub>Lo escribió el chat «Graphics» (cuenta 3) después del relevo `wf_91399f25-c09` (7 lectores). Gobierna a los
agentes de las tres olas; lo mantiene el relevo [dashboard.md](dashboard.md). El pedido textual (24 puntos) está en
`app/admin/dev/dashboard/bitacora.ts`, último hito `prompt`.</sub>

Repo de trabajo: `C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/wt-v5` (worktree limpio en origin/main;
TODOS los agentes de la tanda escriben acá, cada uno sólo en SUS archivos). El relevo completo, por área y por punto,
con archivo:línea y mediciones: `SCRATCH/relevo-v5.json` (donde
`SCRATCH = C:/Users/marti/AppData/Local/Temp/claude/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/fad4ba8a-7ddc-4ef3-8022-8457eab88b6a/scratchpad`).
Antes de tocar tu parte, leé las entradas de tu área en ese JSON: este contrato fija NOMBRES y DUEÑOS; el detalle
(qué lee cada bloque, las trampas medidas, los tests que fijan lo de hoy) está allá.

## Reglas para todos los paquetes

- Tocás SÓLO los archivos de tu paquete (tabla de dueños). Si necesitás un cambio en un archivo ajeno, NO lo hagas:
  devolvelo en «PENDIENTE PARA OTRO PAQUETE» con el archivo, la línea y el código exacto.
- Nada de git que escriba (add, commit, checkout, stash, reset), nunca `--no-verify`, nunca levantar servidores
  (next dev/start) ni Chromium: la verificación en navegador la hace el integrador.
- Temporales sólo en SCRATCH. Respetá el fin de línea de cada archivo (Edit/Write lo conservan). La herramienta Bash
  se come las barras y ejecuta backticks en heredocs y `node -e`: para escribir código, Edit/Write.
- Tests: `npx tsx --test tests/<archivo>.test.ts`, sólo los tuyos. Todo test nuevo se PRUEBA ROMPIÉNDOLO (romper lo que
  persigue, ver que falle, restaurar DE MEMORIA, nunca con git) y el resultado va con números en el comentario del test.
  Un guard que lee fuente se pregunta sobre el texto SIN comentarios y sobre el BLOQUE, no sobre el archivo entero.
- Typecheck: UNA vez al final, `node scripts/typecheck-lock.mjs` (serializa y cuida la RAM). Los errores en archivos de
  OTROS paquetes no son tuyos: reportalos. Antes de un comando pesado, la guardia de RAM puede demorarte: esperá.
- Español neutro (tú) en todo lo que lee una persona. El texto que se DIBUJA es corto (AGENTS.md, «La pantalla dice
  QUÉ pasó»): sin párrafos de ayuda en el panel, sin explicar criterios en la UI. El porqué va al comentario del código.
- AGENTS.md rige todo (`?ws=` por las cinco formas, `use server` sólo async, sticky/overflow, `'use client'` como
  frontera de datos, un campo nuevo en un objeto que se guarda ENTERO se busca en TODOS los que lo escriben, etc.).
- Lo de personas (nombres de leads, closers, setters, lo que dijo un lead) NUNCA sale por HTTP ni por el link
  compartido, y a la IA del AI Analyst sólo va por la lista positiva `DIMENSIONES_PUBLICAS` (lib/graficos-analisis.ts).
- Al terminar devolvé: lo hecho por punto, los tests con su rotura, el typecheck, «PENDIENTE PARA OTRO PAQUETE» y
  «NO HICE» (en positivo: qué quedó sin hacer y en qué archivo). Nada de «hecho» sobre algo sin call site: si escribiste
  una prop o un componente que monta otro paquete, decí exactamente dónde se monta.

## Decisiones de Martín (no se re-preguntan)

Del 11/10 (siguen valiendo): la IA del Dashboard siempre cae a la red de plataforma; «Marcar cobrada» la usa cualquiera
con acceso a la tab; los closers ven SÓLO la hoja Closing; TODO el Dashboard se consume por la API de MaKo sobre el
informe de la persona que se nombre.

De esta tanda (12/10, contestadas):
1. **Mapa de calor: la landing EN VIVO** dentro de un celular (o de una compu), con el calor encima. Martín aceptó el
   costo: cada apertura le cuenta un PageView al Pixel de Meta del cliente. Donde la página no se deja embeber (la de
   MaKo, XFO DENY) o no hay puente, el respaldo es la FOTO arreglada (con su CSS) y placeholders.
2. **Contenedor = «Sección» a lo ancho**: agrupa las filas que tiene debajo hasta la siguiente sección, con título,
   fondo y plegable. Es TAMBIÉN el «Desplegable» del punto 24. No hay grilla anidada.
3. **La IA del pop-up de una llamada PUEDE leer el transcript de Fathom** con la IA gratis (cascada + red). Sigue sin
   salir por HTTP ni por el link compartido.
4. **Se guarda país, región y ciudad de cada visita del Pixel** (de los headers `x-vercel-ip-*`, NUNCA la IP), y se
   suma al aviso de privacidad. El mapa dibuja cualquier país por región (Meta) y ciudades como burbujas (datos propios).

Las que tomé yo (se le reportan a Martín al cerrar; si dice otra cosa, se cambia):
- **Un solo botón «Filtro»** (embudo + número de filtros activos) en la topbar y en cada tarjeta, con desplegable de
  navegación como el del Plan. El PERÍODO entra adentro como primer renglón (con su resumen «Últimos 30 días»). La barra
  de búsqueda está SIEMPRE a la vista a su izquierda. Una hoja sin filtros muestra igual el botón; mirando dice «Esta
  hoja no tiene filtros». Ctrl/Cmd+F con el foco en el Dashboard enfoca la barra (si la barra ya tiene el foco, el
  segundo Ctrl+F es el del navegador).
- **El período de un gráfico deja de ser una sección**: es un filtro más. Un período propio guardado se migra en el
  saneo a un control `periodo` con `fijo: true` (definición del gráfico, no se dibuja para quien mira).
- **Filtros de definición** (`fijo: true`): lo que DEFINE una tarjeta (R1/R2, «Sin agendas», madurez=Madura) no se
  dibuja; se edita en la sección «Filtros» del panel.
- **Outstanding y «a quién cobrar» miran hacia adelante con un período explícito**: la fecha `vencimiento` de pagos
  es `futuro` (no se corta en hoy) y hay dos presets nuevos, «Este mes completo» y «Próximos 30 días». Las plantillas
  los usan a la vista. Revenue es un conjunto compuesto (`revenue`) para que la barra y las KPI salgan de una lectura.
- **Métrica percentil** genérica en el agregador (el P90 del ciclo de venta la usa).
- **Guiones y Anuncios vuelven a verse como tarjetas**: tipo nuevo «Tarjetas» (miniatura si el conjunto la trae).
- **El informe guardado de Mauricio (ws1) no se reescribe a mano**: los bloques se migran EN EL SANEO, para cualquiera,
  con ids determinísticos. Las hojas nuevas (VSL, CS, Chat) NO se le agregan: se ofrecen en «Nueva hoja» y por el link.
- **«Conclusiones de MaKo» = elemento de IA** (gratis, cascada + red). Corre al configurarlo, a mano (↻) y con horario
  opcional (día/semana/mes). NUNCA al abrir la hoja. Los «patrones» deterministas de antes pasan a ser INSTRUCCIONES
  de ejemplo del elemento.
- **El botón de MaKo de cada gráfico** se puede apagar por gráfico; ausente = prendido (lo guardado queda como hoy).
- **Pop-up = mini-hoja** guardada adentro del gráfico (`popup`), que se abre al hacer clic con el contexto de lo
  clickeado. Plantillas de pop-up: «Llamada» (la ficha de hoy partida en piezas) y «Anuncio» (AdDetailTabs).
- **Sincronizar llamadas**: el cron de siempre + un elemento «Acción» en la hoja Closing.
- **El setter ve SÓLO la hoja Chat Analyst** (como el closer con Closing), con los números del equipo.
- **El desplegable «Analysts» sale de la sidebar**; /vsl-analyst, /cs-analyst y /chat-analyst redirigen a
  `/dashboard?hoja=<id>`.
- El vocabulario de Mauricio que el Dashboard tenía cableado (VSL_PRUEBA_VIDEO_ID en negocio.vistas_vsl, los ángulos
  y tags por default de los patrones) sale del Dashboard. Los defaults de Ads Writer (lib/script-angles.ts) son de
  otra área: se reportan, no se tocan.

## El MODELO (lo implementa P1; todos escriben contra estos nombres)

En `lib/graficos-catalogo.ts` (todo con su saneo campo por campo, topes y default; un campo nuevo que el saneo no
copie se pierde en el primer guardado):

```ts
// Fechas y períodos
Fuente.fechas[i].futuro?: true            // no se corta en hoy (pagos.vencimiento)
PRESETS += { id: 'este_mes_completo', nombre: 'Este mes completo' }, { id: 'prox30', nombre: 'Próximos 30 días' }

// Métricas y dimensiones
Metrica.mejor?: 'menos'                   // cpa, cpl, cpc, cpm, costo_*: la barra y el color lo respetan
Metrica.razon.minimo?: number             // con denominador < minimo, se muestra «X de Y» / «—»
Metrica.percentil?: { de: string; p: number }   // el agregador guarda la lista de valores (p. ej. p90 del ciclo)
Dimension.valores?: readonly string[]     // orden FIJO; las categorías sin filas salen en cero
Dimension.colores?: Readonly<Record<string, string>>   // valor → token css ('var(--bad)')

// Controles
ControlVista.fijo?: true                  // filtro de DEFINICIÓN: se aplica igual (efectivoDe), NO se dibuja
                                          // (ni chip ni Filtro), no cuenta para «Restablecer», no lo mueve un link

// Gráfico
Grafico.mako?: boolean                    // botón de MaKo; ausente = true
Grafico.alClic?: 'detalle' | 'nada' | 'popup'   // ausente = 'detalle'
Grafico.popup?: { titulo: string; componentes: Componente[] }   // sin pop-ups anidados; tope 24 componentes
Grafico.barra?: string                    // tabla_barras/tarjetas: la métrica con barra (ausente = la que ordena)
Grafico.secundaria?: string               // numero: métrica chica abajo («14 cierres»)
Grafico.ocultarSiCero?: boolean
Grafico.ejes?: { xMin?: number; xMax?: number; yMin?: number; yMax?: number }   // dispersión/burbujas
Grafico.referencias?: { x?: number; y?: number; rotulos?: [string, string, string, string] }  // cuadrantes
Grafico.colorPor?: string                 // dispersión/burbujas: dimensión que pinta
Grafico.tabla?: { sinVacios?: boolean; descendente?: boolean; columnas?: string[]; acciones?: boolean; buscar?: boolean }
                                          // columnas = dimensiones extra como columnas; buscar = barra de búsqueda en la tarjeta
Grafico.mapa?: { pais: 'auto' | string; nivel: 'pais' | 'region' | 'ciudad' }   // pais = ISO-2
// Grafico.periodo/desde/hasta QUEDAN en el tipo (compatibilidad) pero el saneo los migra a un control
// { id: <id recortado a 34> + '-fecha', tipo: 'periodo', fijo: true, preset, desde, hasta } y deja periodo:'auto'.

// Tipos nuevos (TIPOS)
'barra_proporcion'  «Barra de proporción»  grupo 'Cuadro de resultados', dimension 'ninguna', 2-4 métricas, soloSumas
'tramos'            «Línea de tiempo»      grupo 'Cuadro de resultados', dimension 'ninguna', 2-8 métricas
'tarjetas'          «Tarjetas»             grupo 'Tabla', dimension 'categoria', 1-4 métricas
'mapa_calor'        «Mapa de calor de página»  grupo 'Mapa', sólo fuente 'toques', dimension 'ninguna'
'mapa'              pasa a llamarse «Mapa» (soloDims region | pais | ciudad)

// Elementos
TipoElemento = 'texto' | 'enlace' | 'imagen' | 'video' | 'insertado' | 'linea' | 'flecha' | 'seccion' | 'ia' | 'entidad' | 'accion'
// 'rectangulo' y 'circulo' SE VAN (0 guardados, medido). Línea y flecha sueltas quedan como divisores.
Elemento.seccion?: { fondo: number | null; plegable: boolean; abierto: boolean }   // tipo 'seccion': x=0, w=12 siempre
Elemento.ia?: {
  pedido: string;                 // ≤ 600, lo escribe quien arma la hoja
  fuentes: string[] | null;       // ids de gráficos de la hoja que lee; null = todos
  vista: 'resumen' | 'hallazgos' | 'recomendaciones' | 'texto';
  largo: 'corto' | 'medio' | 'largo';
  formato: 'parrafo' | 'vinetas' | 'tarjetas';
  lee: 'hoja' | 'entidad';        // 'entidad' sólo adentro de un pop-up (lee la llamada/anuncio/lead abierto)
  cron: null | { unidad: 'dia' | 'semana' | 'mes'; hora: number };
}
Elemento.entidad?: { tipo: 'llamada' | 'anuncio' | 'lead'; pieza: string }   // sólo adentro de un pop-up
Elemento.accion?: { id: string; rotulo: string }   // id de ACCIONES_ELEMENTO (lib/graficos-acciones.ts)

// Hoja
Hoja.plantilla?: string                   // de qué plantilla nació (hojaDestino pregunta esto primero)
Hoja.conectores?: Conector[]              // tope 40
type Conector = { id: string; desde: string; hasta: string; punta: 'fin' | 'ambas' | 'ninguna';
                  trazo: 'curva' | 'recta' | 'codo'; color: number | null }
// sanearHoja descarta los conectores que apuntan a un id que no está.
```

**Los bloques se van.** `BLOQUES`, `Bloque` y `clase: 'bloque'` dejan de ofrecerse. `lib/graficos-migrar-v5.ts` (nuevo,
puro, con test) convierte en el saneo cada bloque viejo en sus componentes de reemplazo, ADENTRO del rectángulo del
bloque (x, y, w, h), con ids determinísticos `<idDelBloque>-<parte>`, conservando título, subtítulo y período (como
control fijo). Va en el MISMO deploy que saca los ids (si no, `sanearBloque` los descarta y el próximo autoguardado
los borra). Los reemplazos, por bloque (los ids de conjuntos/métricas son los de la tabla de DATOS):

| Bloque | Reemplazo |
|---|---|
| revenue | `barra_proporcion` revenue [cobrado, pendiente] + 3 `numero` revenue: vendido (secundaria cierres), cobrado, pendiente + `numero` suscripciones.mrr (ocultarSiCero) |
| cobranza | `seccion` plegable cerrada «A quién cobrarle» + `tabla` cobranza por cliente [vendido, cobrado_total, pendiente, proxima_monto, dias], orden dias asc, tabla.acciones, tabla.columnas ['urgencia'] |
| funnel_maduro | `embudo_vertical` leads, fecha agenda, [agendas, asistencias, limpias, cierres], control fijo madurez_semana=Madura + 3 `numero` (tasa_cierre_calificadas, tasa_no_show, cierres) |
| scl | `numero` leads.ciclo (razon minimo 3) + `numero` leads.p90_ciclo + `tramos` leads [tramo_1..tramo_5] |
| cohortes_mes / cohortes_semana | `tabla` leads, fecha agenda, dimensión mes/semana, [agendas, asistencias, tasa_no_show, limpias, cierres, tasa_cierre_calificadas, ciclo_cierre, vendido], tabla.columnas ['madurez_mes'/'madurez_semana'], sinVacios, descendente, límite 6/8, período fijo 'todo' |
| matriz_proyectos | `burbujas` proyectos por proyecto [esfuerzo, impacto, tareas], colorPor cuadrante, ejes 0-100, referencias 50/50 con rótulos |
| piramide_prioridad | `barras` ejecucion por prioridad [activas] (valores fijos Alta/Media/Baja/A futuro) + `numero` ejecucion.pct_alta (objetivo 18, mejor 'menos') |
| tareas_atencion | 3 `tabla` ejecucion por tarea: [dias_quieta] fijo estancada=Sí; [activas] fijo prioridad=Alta y con_deadline=No; [movidas_deadline] fijo deadline_corrido=Sí |
| patrones_guiones | elemento `ia` (vista hallazgos, instrucción «Qué patrones separan a los guiones que agendan de los que no») |
| cuadrante_retencion | `dispersion` guiones por anuncio [hook, ret_cta], colorPor angulo, ejes 0-55/0-30, referencias 28/10 con los 4 rótulos de hoy, alClic popup «Anuncio» |
| mapa_calor | `mapa_calor` sobre toques |
| curva_vsl | `area` retencion_vsl por corte [siguen] |
| embudo_cierre | `embudo_vertical` llamadas_venta [r1, r2, ganadas_r2] |
| factores_cierre | `barras` llamadas_dimensiones por dimension [puntaje] desglose tono + elemento `ia` (vista hallazgos, «Qué decide los cierres») |
| closers_cierre | `tabla` llamadas_venta por closer [llamadas, puntaje, ganadas, tasa_cierre] |
| llamadas_cierre | `tabla` llamadas_venta por llamada [puntaje, duracion] con tabla.buscar, tabla.columnas ['closer','reunion','fecha'], alClic popup «Llamada» + elemento `accion` «Sincronizar llamadas» |

## Los DATOS (lo implementa P2; P1 sólo DECLARA en el catálogo los ids de conjuntos base)

Corte en hoy en UN lugar: adentro de `datosDeGraficos` y `detalleDeGrafico`, junto a `hastaDeFuente`, respetando
`futuro`; se saca de las 6 puertas que hoy lo hacen a mano (route.ts:76 y :116, page.tsx:82, informe-compartido.ts:70,
dashboard.run.ts:405/416/521, graficos-analisis-server.ts:257).

| Conjunto | Qué se suma (ids exactos) |
|---|---|
| pagos (base) | fecha `vencimiento` futuro; estado 'Vencido' con la zona del NEGOCIO |
| leads (base) | dims `madurez_semana`, `madurez_mes`; métricas `limpias`, razón `tasa_cierre_calificadas` (cierres÷limpias, minimo 3), `ciclo_cierre` + `con_ciclo_cierre`, `tramo_1`..`tramo_5` (razones de días por tramo con sus `dias_tN`/`con_tN`), `p90_ciclo` (percentil 90 de ciclo); `ciclo` con razon.minimo 3 |
| ejecucion (base) | dims `tarea` (persona: fuera de PUBLICAS), `estancada`, `deadline_corrido`, `prioridad` con valores fijos y colores; métricas `dias_quieta`, `movidas_deadline`, `activas_alta`, razón `pct_alta` (mejor 'menos') |
| proyectos (base) | impacto y esfuerzo null en vez de 0; dim `cuadrante` |
| guiones | entidad (ref anuncio), `r.anuncio`, miniatura para Tarjetas, métricas `llegaron_cta` y razón `ret_cta`; nada de ángulos/tags por default de Mauricio |
| `revenue` (nuevo) | vendido (fecha_cierre), cobrado (fecha_pago), pendiente (fecha_esperada, no pagadas; futuro), cierres; DETALLE_REVENUE |
| `cobranza` (nuevo) | una fila por cliente con pendiente: dims cliente (persona), urgencia, proxima; métricas vendido, cobrado_total, pendiente, proxima_monto, dias, clientes; ENTIDADES (cuota + lead) |
| `suscripciones` (nuevo) | fecha actual sinRango; mrr (usd), activas |
| retencion_vsl | dim `corte` (5…100, orden fijo) + métrica `siguen` (razón pasaron÷medidos); se lee de un RESUMEN SQL (`retencion_vsl_resumen`, migración) en vez de 48 mil eventos; una sola lectura por hoja |
| vsl | `espectadores` (distintos con play), `play_rate`, `agendaron`; excluir `prueba` |
| visitas, replays | excluir `prueba` y la vista previa del constructor |
| `vsl_leads` (nuevo) | por lead con visitor_id: dim `tramo_visto`; leads, agendas, cierres, tasa_agenda |
| entrega | el universo de la cartera de CS (carteraEnEntrega), no las filas de cliente_entrega |
| `cartera` (nuevo) | dims cliente (persona), producto, estado, senal, motivo, tramo_contacto; clientes, atencion, cuotas_vencidas, deuda_vencida_usd, sesiones; ENTIDADES lead |
| `conversaciones` (nuevo) | sobre wa_mensajes 1-a-1: dims linea, setter, etapa, con_lead; turnos, respondidos, rapidos_15, rapidos_60, pct_respondidos, pct_rapidos, sin_responder (fecha actual) |
| inscripciones | `respondieron`, `tasa_respuesta`; envios.respuestas se arregla o se quita |
| `ubicacion` (nuevo) | visitas por pais/region/ciudad con lat/lon (columnas nuevas en landing_visits, migración) |
| toques | sin los selectores del sello del constructor (#lovable-badge-*) en el ranking |
| negocio | sin VSL_PRUEBA_VIDEO_ID |

Campos COMPARTIDOS nuevos (P1, en el catálogo): `video` = {vsl, retencion_vsl}; `linea` = {whatsapp, conversaciones};
`setter` = {leads, whatsapp, conversaciones}; `cliente` = {entrega, pagos, cartera, cobranza}; `producto` += cartera.
`DIMENSIONES_PUBLICAS` (P1 la edita en lib/graficos-analisis.ts) suma las dimensiones no personales de los conjuntos
nuevos y de los de Analysts (corte, tramo_visto, cuadrante, estado, urgencia, linea…).

## Dueños de archivos (UN paquete por archivo)

### Ola 1 (en paralelo)

| Paquete | Archivos |
|---|---|
| **P1 Modelo** | lib/graficos-catalogo.ts, lib/graficos-migrar-v5.ts (nuevo), lib/graficos-analisis.ts (SÓLO DIMENSIONES_PUBLICAS), lib/graficos-tablero.ts (el editor manda la VERSIÓN: compare-and-set también para el autoguardado), lib/graficos-controles-texto.ts (`campoDeDimension` público), tests/graficos-modelo*.test.ts, tests/graficos-migrar-v5.test.ts (nuevo) |
| **P2 Datos** | lib/graficos-datos.ts, lib/graficos-datos-extra.ts, lib/graficos-fuentes-extra.ts, lib/graficos-agregar.ts, lib/graficos-lectura.ts, lib/graficos-bloques.ts + lib/graficos-bloques-extra*.ts (se vacían/borran cuando nadie los lee), lib/vsl-retencion.ts, app/api/graficos/route.ts, app/dashboard/page.tsx (SÓLO el corte en hoy), app/compartido/[token]/informe-compartido.ts (SÓLO el corte), lib/api-mako/areas/dashboard.run.ts (SÓLO las 3 líneas del corte), lib/graficos-analisis-server.ts (SÓLO la línea del corte), app/api/track/vsl/route.ts (la ubicación de la visita), supabase/migrations (las nuevas: `retencion_vsl_resumen`, columnas de ubicación; numerar con `ls supabase/migrations | tail`), app/privacidad (la línea de la ubicación), tests/graficos-datos*.test.ts y nuevos |
| **P3 Dibujo** | app/dashboard/Grafico.tsx, lib/graficos-gordo.ts (nuevo), lib/graficos-temas.ts, app/dashboard/MapaMexico.tsx → MapaGeo (nuevo), lib/geo-regiones.ts (nuevo), scripts/geo-paises.mjs + public/geo/** (nuevos), app/dashboard/graficos/** (nuevos: Tarjetas, BarraProporcion, Tramos, Paneles), app/marketing/ad-charts.tsx (SÓLO el import del mapa), tests/graficos-gordo.test.ts, tests/geo-*.test.ts |

### Ola 2 (en paralelo, sobre la ola 1 ya integrada)

| Paquete | Archivos |
|---|---|
| **P4 Cromo** | app/dashboard/Cabecera.tsx, app/dashboard/BarraControles.tsx, app/dashboard/MenuFiltro.tsx + BuscarEnHoja.tsx (nuevos), lib/graficos-buscar.ts (nuevo, puro), app/dashboard/valores.ts, app/dashboard/Galeria.tsx, app/dashboard/editor-css.ts, app/dashboard/CompartirInforme.tsx, app/conocimientos/Compartir.tsx (variante 'app' + modo controlado; Conocimientos no cambia), tests/dashboard-topbar.test.ts, tests/conocimientos-compartir.test.ts |
| **P5 Edición** | app/dashboard/EditorInforme.tsx, app/dashboard/Propiedades.tsx, app/dashboard/PanelEstilo.tsx, app/dashboard/Elemento.tsx, app/dashboard/edicion-css.ts (nuevo; el CSS de lo de P5), app/dashboard/Seccion.tsx + Conectores.tsx + Popup.tsx (nuevos), lib/graficos-conectores.ts + lib/graficos-secciones.ts (nuevos, puros), app/_ui (la rueda de color compartida), app/dashboard/recorridos-dashboard.ts, tests/dashboard-pantalla.test.ts, tests/dashboard-recorridos.test.ts, tests nuevos de lo suyo |
| **P6 IA y entidades** | lib/graficos-ia-elemento.ts + -server.ts (nuevos), migración `dashboard_ia_elementos` (molde 0247), app/api/graficos/ia-elemento/route.ts (nuevo), app/api/cron/dashboard-analisis (drenar también las cajas), lib/graficos-analisis-server.ts, app/dashboard/ElementoIA.tsx + ElementoAccion.tsx (nuevos), app/dashboard/entidades/** (nuevos: las piezas de la llamada partidas de FichaLlamada, y del anuncio sobre AdDetailTabs), app/dashboard/bloques/extra/FichaLlamada.tsx, lib/graficos-acciones.ts (ACCIONES_ELEMENTO), app/dashboard/PanelAnalista.tsx (superpuesto, como el panel), lib/prompt-registry.ts (SÓLO la clave nueva `dashboard.elemento_ia.system`), lib/workspace.ts (SÓLO TENANT_TABLES), tests nuevos |
| **P7 Landing** | app/dashboard/MapaCalor*.tsx (nuevos, desde app/landing-analyst/MapaDeCalor.tsx), app/landing-analyst/**, lib/landing-mapa-*.ts, lib/replay-reproductor.ts (la limpieza de hojas pasa a una función compartida), public/replay/** + scripts/replay-libs.mjs (el puente del mapa en vivo; el pre-push chequea los artefactos), lib/landing-token.ts (verificarPagina sin leer 7 mil visitas; el snippet NO), app/api/landing-analyst/**, app/api/track/vsl/route.ts (SÓLO el modo `prueba='mapa-…'`, después de P2), tests/landing-mapa*.test.ts |

### Ola 3

| Paquete | Archivos |
|---|---|
| **P8 Plantillas, Analysts y roles** | lib/graficos-plantillas.ts, lib/graficos-plantillas-analysts.ts, lib/graficos-plantillas-generales.ts (sin bloques; VSL/CS/Chat Analyst; plantillas de pop-up «Llamada» y «Anuncio»; `plantilla` en cada hoja; FIRMAS → `plantilla`; HOJA_DE_ROL closer/setter), app/_components/nav.ts (sale el grupo Analysts), app/vsl-analyst, app/cs-analyst, app/chat-analyst (redirects), app/dashboard/page.tsx (rol), app/api/graficos/route.ts (rol), lib/retro-reporte.ts, app/admin/dev/areas.ts, app/equipo/page.tsx, app/configuraciones/page.tsx (la frase del setter), tests/graficos-analysts.test.ts, tests/tabs-retiradas.test.ts, tests/graficos-ia.test.ts |
| **P9 API y link** | lib/api-mako/areas/dashboard.def.ts/.run.ts/.helpers.ts (sin bloques; elementos nuevos; `mako`; filtros fijos; período como control; conectores), docs/api-mako.md + tests/api-mako-http.snapshot.txt (regenerados), app/compartido/[token]/informe-reglas.ts + informe-compartido.ts + InformeCompartido.tsx, app/api/compartido/graficos/route.ts, tests/api-mako-dashboard.test.ts, tests/dashboard-compartir*.test.ts |

Nadie toca: next.config.ts, lib/ai-cheap.ts, app/automations/**, lib/flujo*, lib/script-angles.ts, lo que no esté en
la tabla.

## Interfaces entre paquetes

- **I1 · MenuFiltro (P4 lo crea, P5 lo monta en la tarjeta):** `<MenuFiltro modo="hoja" | "tarjeta" … />` exportado
  de app/dashboard/MenuFiltro.tsx. En la tarjeta reemplaza a `ChipsControles` y va en `.lk-comp-acciones`.
- **I2 · Búsqueda en tabla (P4):** `<BuscarEnTabla grafico onVista />`; P5 la monta en la cabecera de una tarjeta de
  tabla con `g.tabla?.buscar`.
- **I3 · Elementos nuevos (P6 crea ElementoIA/ElementoAccion y las piezas de entidad; P5 los monta)** desde
  `Elemento.tsx` según `tipo` ('ia' → `<ElementoIA />`, 'accion' → `<ElementoAccion />`, 'entidad' → la pieza).
- **I4 · Pop-up (P5):** `Popup.tsx` abre la mini-hoja con el contexto `{ fuente, dimension, valor, ref, metrica }`
  (SelDetalle + `ref`), le inyecta el filtro {campo del clic = valor} a cada gráfico de adentro y a las piezas de
  entidad el `ref`. Editar un pop-up pone al editor sobre `g.popup.componentes` con una miga «Hoja › Pop-up».
- **I5 · Datos de un pop-up:** se piden con el mismo POST /api/graficos (P2), con los componentes del pop-up y el
  filtro inyectado; el server los busca EN el gráfico dueño del pop-up (P2 acepta `popupDe: idGrafico`).
- **I6 · Tipos nuevos (P3 los dibuja):** `Grafico.tsx` recibe el mismo `Resultado`; los tipos nuevos no cambian la
  forma de los datos salvo `tarjetas` (FilaResultado puede traer `imagen?: string`, P2 la pone en guiones/meta).

## Verificación (el integrador, después de cada ola)

Typecheck y `npm test` en el worktree; build con la raíz temporal (AGENTS.md); `next start` + Chrome sobre ws9 y,
SÓLO LEYENDO, ws1 (el informe de Mauricio, para ver la migración de los bloques sin guardar). Los informes de prueba
se escriben con el usuario `dev` y se borran (`graficos.tablero.dev`). Migraciones: se aplican ANTES del deploy si el
código nuevo las lee.
