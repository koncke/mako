# Hallazgos — Pruebas A/B (el motor compartido, `lib/pruebas/`)

El motor de las pruebas A/B de toda la app: el reparto (`asignar.ts`), las cuentas (`estadistica.ts`), el juez
(`juez.ts`), el volumen (`volumen.ts`) y las métricas (`metricas.ts`). Lo usan la tarjeta «A/B TEST» de Automations y
la landing (Landings). El diseño está en `docs/diseno-pruebas-ab.md`; donde chocan, manda la crítica (Anexo 2).

## El navegador de la app con el panel OCULTO congela la página: lo que no responde ahí no es una falla de la app (10/11/2026)

**Síntoma:** en la prueba de punta a punta de Image, en el navegador de la app de Claude (`mcp__Claude_Browser__*`), «Editar» no
abría el guiado: ni con un clic real, ni llamando a mano a `onReplicar`. El estado de React no cambiaba, no había errores en la
consola y el botón era el que estaba arriba (`elementFromPoint`). Antes, un script sin esperas tardó más de 45 s y una
navegación quedó colgada 300 s.

**Lo obvio era una falla del guiado en el ws 3, y no:** en el Chrome de Martín, a la vista, el mismo «Editar» abre el guiado.
Con la sesión de Claude sin ventana a la vista, el panel queda oculto y la página corre como pestaña de fondo; con poca RAM (1,9 GB
libres esa noche), además, se congela. Los filtros y el orden sí andaban ahí, así que «a veces anda» no prueba que la página esté
bien.

**La regla:** antes de anotar una falla de algo que no reacciona en el navegador de la app, `tabs_context` dice si el panel está
oculto. Si lo está, se repite en una ventana a la vista (el Chrome de Martín, en una pestaña propia) antes de creerle.

## Un `assert.equal` con un elemento de jsdom que falla agota la memoria (10/11/2026)

**Síntoma:** al verificar rompiéndolo `tests/carruseles-imagen-rota.test.ts`, el corredor contó «tests 1» y terminó: los casos
2 a 4 no aparecían, sin ningún error. Con `--test-reporter=tap` salió `RangeError: Array buffer allocation failed` en el 2.

**Lo obvio era la PC sin RAM, y no:** había 7,7 GB libres. Lo que pasaba es que `assert.equal(v.img(), null)`, al fallar, arma el
mensaje de diferencia inspeccionando `actual`, y `actual` era un `HTMLImageElement` de jsdom. Su grafo de objetos (la ventana,
el documento, todo) no entra en memoria. El reporte por defecto se come el error: cuenta sólo los tests que terminaron.

**La regla:** en un test con jsdom, se compara un DATO del elemento (`img?.getAttribute('src') ?? null`), nunca el elemento.
Y un «tests N» menor que la cantidad de `test(` del archivo es un proceso que se murió, no una pasada: se vuelve a correr con
`--test-reporter=tap`.

## El juez decide UNA vez, en el horizonte del plan: medido con pruebas A/A (25/10/2026)

**El síntoma (lo midió la crítica):** mirar todos los días y declarar ganador con «95 % dos días seguidos» daba entre 10 y
35 % de falsos ganadores con el volumen de MaKo. El diagnóstico obvio era «el umbral es bajo», y no alcanzaba: el
problema era MIRAR. Cada lectura es otra chance de que el azar cruce el umbral.

**La regla:** «gana» se decide una sola vez, en el horizonte: el día en que todas las ramas tienen el n del plan
(`volumen.ts`, calculado ANTES de arrancar) y pasaron 7 días. Ese día depende sólo de cuánta gente entró, nunca de los
resultados, y por eso vale como una sola mirada. Antes del horizonte sólo se corta por daño, con 99,5 % y con la mitad
del plan en cada rama. Cortar NO es «no funciona»: queda `no_concluyente`. Al tope no se registra ninguna verdad.

**Los números (semillas fijas, `tests/pruebas-juez-aa.test.ts`):** en una automatización A/A (10 %, 12 por rama y por
día, ventana de 7), 1,3 % «gana B» y 0,7 % «gana el control». Con 3 ramas, 1 %. En una landing (5 %, 34 por día),
2 % + 1,3 %. Con el efecto del plan (10 % → 18 %), B gana 78 % de las veces. El test exige ≤ 5 % de falsos ganadores. Con
«mirar todos los días» da 2 / 3, y con un juez mudo, 4 / 1: un juez que nunca decide también pasa el A/A, por eso el test
mide la potencia.

## La regla doble de VWO (pérdida < 1 %) no ataba con 98 %: salió de «gana» (25/10/2026)

El diseño la pedía junto al 95 %. Con el umbral en 98 % no frenaba nunca: el caso más extremo, 0/6 contra 6/6, pierde
0,00115 con un techo de 0,0033, y su rotura quedaba verde. Una regla que nunca actúa es una regla mentirosa (el Cerebro):
salió de «gana» y quedó sólo al tope, donde SÍ decide (1/10 contra 4/10 da 85 % de ser la mejor, pero pierde 0,0102, y se
queda A). Si el umbral baja, se mide de nuevo antes de traerla.

## Integrar en vez de sortear, y la grilla que se agranda sola (25/10/2026)

El diseño pedía 20.000 sorteos de la Beta por lectura. El test A/A corre decenas de miles de lecturas: con sorteos
tardaba minutos. `estadistica.ts` integra sobre una grilla (1.500 puntos) y queda a ~1e-5 de la fórmula cerrada de Evan
Miller.

**⚠️ La trampa:** la primera rotura de «grilla gruesa» salió VERDE. Ningún caso del test tenía dos ramas angostas y
cercanas junto a una lejos. Con ese caso, 1.500 puntos daban un error de 7,5e-4. Por eso la grilla se agranda hasta 16
puntos por desvío de la rama más angosta (tope 20.000), y el test lleva el caso.

**El prior es Beta(1 + 10·p, 1 + 10·(1 − p)), no Beta(10·p, 10·(1 − p)):** con 0 éxitos y la tasa conjunta casi en 0, α
quedaba por debajo de 1 y la densidad era infinita en el 0. El «1 +» la deja acotada para la integral.

## «Da lo mismo» tiene que cruzar el cero (25/10/2026)

Con la regla de la crítica (el intervalo del 90 % dentro de ± el efecto del plan), una B 50 % PEOR salía «da lo mismo»
en 1 de cada 3 simulaciones: el intervalo [−70 %, −20 %] queda dentro de ±80 %. Ahora además tiene que cruzar el cero.
Si no lo cruza, es `no_concluyente`.

## Sólo cuentan las personas maduras (25/10/2026)

El diseño (2.5) contaba también a las que todavía no cumplieron la ventana pero ya lograron la métrica. Eso sube la tasa
de la rama que convierte más RÁPIDO aunque no convierta más. `metricas.ts` cuenta sólo a las que ya cumplieron la
ventana, y el éxito sólo dentro de ella. Si el medidor no devolvió a alguien maduro, la lectura falla: no cuenta como 0.

## Dónde se guardan, y cómo concluyen en Experimentos (A2, 25/10/2026)

**Las tablas** (`supabase/migrations/0335_pruebas_ab.sql`, aplicada en producción el 25/10/2026 19:27) llevan
`workspace_id` SIN default, porque las viejas tienen DEFAULT 1 y el 1 es un cliente. Tienen RLS sin políticas y las lee
`lib/pruebas/store.ts` con el cliente de servicio y el ws explícito, porque la página pública y el cron no tienen sesión.
Sin la migración: crear tira `PruebasSinTabla`, servir da el CONTROL sin escribir y el cron no decide. El reset del
Cliente de Prueba avisa «esa tabla no existe» y sigue (`lib/reset-workspace.ts`), así que la migración puede ir junto con
el deploy.

**El veredicto va a `experimentos` así:** `gana_variante` → validada; `gana_control` → refutada, y sólo porque el juez
la da con daño demostrado en el horizonte; `da_lo_mismo` y `no_concluyente` → no_concluyente. «No se vio una diferencia
mayor a X» no es «probado que no funciona». MaKo cita «PROBADO QUE NO FUNCIONA» sólo de las refutadas que traen
`config.prueba_id`: un antes/después refutado medía la cuenta contra sí misma (`lib/experimentos-verdades.ts`).

**⚠️ `fmtVal` dibujaba mal una métrica de prueba (lo había confirmado la crítica):** «ab:…» no estaba en `METRICA_FMT`, caía
en 'num', y `Math.round(0,09)` da 0. Ahora el prefijo `ab:` formatea en % y la tarjeta del Dashboard rotula «A» y la
letra de la rama (con 3 ramas, la que se cuenta puede no ser B: va en `config.variante`). El catálogo de
`lib/experimentos-catalogo.ts` NO se tocó: lo lee la IA que propone experimentos, y con «ab» adentro empezaría a proponerlos.

**El cron** (`/api/cron/pruebas`, 6:15 UTC) todavía no tiene medidores: los suman A3 (Automations) y Landings. Sin medidor,
la lectura de esa prueba queda fallida y no decide. Una lectura que falla nunca cuenta como «0 éxitos».

## La tarjeta de Automations y lo que mide (A3, 25/10/2026)

La tarjeta «A/B TEST» y sus puertas están en docs/hallazgos-chatbot.md («La tarjeta «A/B TEST»…»). Del motor de las pruebas:
- **Los medidores van por SUPERFICIE y por métrica** (`Medidores`, lib/pruebas/corrida.ts): «agendó» de una automatización
  no se mide como el de una landing. Los de Automations están en lib/pruebas/medidores-automatizacion.ts.
- **Al medidor le llegan TODAS las asignaciones**, no sólo las maduras. «Agendó» no tiene hora propia (`junta_1_at` es la de
  la reunión), así que su hora es la de la lectura que lo vio por primera vez. Si sólo se le pasan las maduras, no hay
  forma de saber si pasó dentro de la ventana. El primer resultado se congela (`resultado` y `resultado_at` en la
  asignación). Nunca se congela un «no»: puede volverse «sí» mañana.
- **⚠️ Lo congelado también va POR MÉTRICA** (`prueba_asignaciones.resultados`, jsonb `{respondio: {at}}`). Con una sola
  columna `resultado`, el «sí» de «respondió» (la que decide) se leía después como el «sí» de «agendó» (el guardrail): un
  guardrail que nunca frena. Lo encontró la relectura, no un test.
- **`previo` es un mapa por métrica** (`{agendo: true}`, jsonb): la que decide y un guardrail pueden ser las dos de estado.
  Sin previo, un estado no cuenta (no se sabe si ya estaba).
- **La rama se escribe cuando el lead LLEGA a la tarjeta** (`falta_rama_ab`, como `faltan_hechos`), no antes. Desde ahí
  corre su ventana. Sin prueba corriendo de ESA tarjeta, o ante un error, va a la A.
- **Editar mientras corre:** guardar el flujo compara la firma de cada rama (SÓLO sus tarjetas, no lo compartido después
  de que se juntan). Si cambió algo, abre una época nueva. Si se borró la tarjeta o cambiaron las ramas, la detiene
  (`revisarLaPruebaAlGuardar`, que nunca frena el guardado).

## Sin hacer

- **A3, lo que queda:** la dimensión «rama» en los gráficos del Dashboard (Métricas lo muestra en una franja fija), verla en
  pantalla, y la primera prueba real en el Cliente de Prueba (la migración ya está aplicada).
- **El plan de una prueba de «Agendó» usa la tasa de «Respondió»** (`historiaDe`, lib/pruebas/automatizacion.ts): el n del
  plan queda corto, y la prueba llega antes a su horizonte con menos potencia. El juez sigue mirando una sola vez (no
  inventa ganadores), pero ve menos. Falta leer la tasa de agenda de la automatización.
- **Landings** tiene las firmas y el store (25/10): sus medidores van en `MEDIDORES.landing` del cron.

## Mirar todos los días miente: 10 a 35 % de falsos ganadores con el volumen de MaKo (25/10/2026)

**Vive en:** `lib/pruebas/juez.ts` (todavía no existe: esto es lo que su test tiene que fijar).

- **El diseño obvio era el de VWO:** declarar ganador con P(mejor) ≥ 95 % en dos lecturas diarias seguidas, más pérdida esperada
  menor al 1 %, con un prior «escéptico» de peso 10. El crítico simuló 20.000 pruebas A/A (sin ninguna diferencia real) con ese
  calendario:
  - automatización, 25 por rama y por día, mínimo 20, 60 días: **17,4 % «gana B» falso y 16,9 % «gana el control» falso**;
  - con mínimo 300 por rama: 14,5 % y 16,6 %;
  - landing, 34 por rama y por día, mínimo 400, 28 días: 10,0 % y 12,1 %;
  - UNA sola mirada al llegar a 1.800 por rama: 4,7 % y 0 %.
  Un prior de peso 10 son 10 visitas inventadas: al lado de cientos de visitas reales no frena nada.
- **La regla:** el n por rama se calcula ANTES de arrancar (`volumen.ts`) y «gana» se decide sólo en ese horizonte. Las lecturas
  de antes sólo pueden cortar por DAÑO (99,5 %). El test del juez simula A/A con el calendario real de lecturas y exige ≤ 5 % de
  falsos ganadores, y es la puerta de todo lo demás.
- **Cortar temprano no es «no funciona».** Si el corte termina en «gana el control» y eso se guarda como `refutada`, MaKo lo
  repite en todo el dashboard como «probado que no funciona» (`resumenExperimentos`). Una prueba cortada queda `no_concluyente`.
- **«Da lo mismo» con ±10 % relativo nunca se cumple** con este volumen (con 10 % de tasa harían falta ~4.900 por rama): el
  umbral es el efecto mínimo detectable planificado, y el texto dice «no se vio una diferencia mayor a X».
- **El aprendizaje cita el INTERVALO, no el punto:** 2/20 contra 8/20 da P = 0,969 pero el lift va de +10 % a +523 %. Un «subió de
  10 % a 40 %» presenta como verdad un número que no se sabe.
- **«Agendó» y «respondió» son estados que se reescriben** (una reunión vieja cuenta apenas el lead entra; la inscripción se
  reusa al volver a entrar): se congelan en la asignación.

*25/10/2026, el Cerebro (claude5), con los relevamientos de pruebas A/B y de conexiones (docs/diseno-pruebas-ab.md, docs/conexiones-y-ayuda.md).*

## El listado del repo pasó de 1 MiB y las guardas cayeron con ENOBUFS (5/11/2026)

**Síntoma:** dos ramas sin relación (recibos y Admin) quedaron en rojo en la misma guarda, `tests/resend-clave-admin.test.ts`, sin tocar nada de Resend. **Lo obvio era que el código de la rama nombraba la clave, y no era eso.** El error real es `spawnSync git ENOBUFS`: `git ls-files` da 1.048.981 bytes, y `execFileSync` corta en 1 MiB si no se le da otro tope. Falla cualquier test que liste el repo entero, y sólo cuando entra en los afectados, por eso parecía de esas ramas.

**La regla:** un `execFileSync('git', …)` que lista todo el repo lleva `maxBuffer`. Con ruta (`ls-files app lib`) todavía entra, pero el repo crece y un día deja de entrar.
