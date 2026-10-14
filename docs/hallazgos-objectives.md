# Hallazgos de Objectives y KPIs

La columna vertebral `Q → Objective → KPI` (`lib/objectives*.ts`), la pantalla `/general`
como FOCUS y la capa de tiempo del tablero (`app/plan/board/cuando.ts`). Lo que aprendimos
construyéndolo y **no se puede deducir leyendo el código**.

La regla que produce este documento está en [AGENTS.md](../AGENTS.md) → «La cosecha».
El diseño acordado, con las cinco decisiones del dueño, está en
[objectives-kpis-y-focus.md](objectives-kpis-y-focus.md).

## Lo que más muerde acá

- **El semáforo volvió a decir «tu negocio está sano» sobre un workspace vacío, con el
  arreglo de la #165 ya escrito.** La causa no era el arreglo: era en qué columna preguntaba
  → [Dos de las cinco fuentes dicen «stale» cuando nunca hubo un dato](#dos-de-las-cinco-fuentes-dicen-stale-cuando-nunca-hubo-un-dato).
- **Un KPI sin dato y un KPI en cero se ven igual si nadie los separa**, y la diferencia
  decide a qué se manda a trabajar a alguien →
  [Sin datos no es cero, y cero no es rojo por error](#sin-datos-no-es-cero-y-cero-no-es-rojo-por-error).
- **La paridad catálogo↔lector no se puede testear** porque el módulo tiene `server-only` →
  [Un guard que no se puede correr no es un guard](#un-guard-que-no-se-puede-correr-no-es-un-guard).
- **Editar un objetivo desde `/general` puede cambiar cuál es el principal**, porque el upsert
  resetea el `orden` de una fila que ya existe →
  [Editar un objetivo o un KPI pisa lo que no viaja](#editar-un-objetivo-o-un-kpi-pisa-lo-que-no-viaja-empezando-por-el-orden).

---

## Dos de las cinco fuentes dicen «stale» cuando nunca hubo un dato

**Vive en:** `app/general/page.tsx` (el cálculo de `sinFuentes`) · `lib/sources.ts:101` y `:129`

**El síntoma, medido el 06/09/2026** contra el workspace 9 sin una sola fila de datos: el
Semáforo de `/general` mostraba **«El negocio está sano · Sin focos activos. Buen momento
para empujar volumen.»** Que es exactamente la tarea #165, la que este trabajo venía a
cerrar — y el arreglo ya estaba escrito y desplegado en esa misma pantalla.

**El diagnóstico obvio era el equivocado.** No fallaba el estado nuevo ni el render: fallaba
la pregunta. El código decía

```ts
const conectadas = fuentes.filter((f) => f.status !== 'off');
const sinFuentes = fuentes.length > 0 && conectadas.length === 0;
```

y `getDataSources()` devuelve cinco fuentes, de las cuales **`calendly` y `vsl_beacon`
resuelven a `'stale'` cuando NUNCA hubo un dato**, no a `'off'`:

```ts
// lib/sources.ts:101  (calendly)
const status = d === null ? 'stale' : d <= 30 ? 'ok' : 'stale';
// lib/sources.ts:129  (vsl_beacon)
const status = d === null ? 'stale' : d <= 7  ? 'ok' : 'stale';
```

O sea que en dos de las cinco, **«conectada pero sin datos recientes» y «nunca entregó nada»
comparten valor**. Sobre un workspace vacío el filtro contaba 2 conectadas y el veredicto
caía al verde de siempre.

**La regla que queda: cuando preguntes «¿hay datos?», preguntale a la columna que sólo puede
contestar eso.** `status` es un juicio con tres valores y su significado depende de cada
fuente; `lastSync` es la fecha del último dato real, o `null` porque no hubo ninguno. No
tiene ambigüedad y no cambia si mañana alguien ajusta un umbral de frescura.

```ts
const conDatos = fuentes.filter((f) => f.lastSync !== null);
```

⚠️ **Y el corolario de cómo se encontró:** no lo cazó el typecheck, no lo cazaron los 2.086
tests y no lo cazó leer el código — lo cazó **abrir la pantalla**. Un veredicto es una frase,
y una frase equivocada compila igual que la correcta. Cuando lo que se arregla es *lo que
dice* una pantalla, la verificación es mirarla.

## Sin datos no es cero, y cero no es rojo por error

**Vive en:** `lib/objectives-modelo.ts` (`estadoKpi`) · `lib/objectives-fuentes.ts` · `lib/focus.ts`

Un KPI tiene cuatro estados y no tres. El cuarto —`sin-datos`— es el que sostiene todo lo
demás, porque el color de un KPI **elige la acción prioritaria del día**: el bloque AHORA de
`/general` toma el peor KPI en rojo y escribe una orden de trabajo con él.

Entonces un `null` mal traducido no produce un color feo: produce **una orden de trabajo
falsa, arriba de todo, con cara de dato**. Un timeout de Meta se convierte en «ve a Ads
Manager y sube la inversión US$55 hoy» sobre alguien que la tiene puesta.

Las tres reglas, y las tres están en tests:

1. **`valor === null` es `sin-datos`, nunca rojo.** Ninguna fuente de
   `objectives-fuentes.ts` hace `?? 0` sobre un error: el `catch` devuelve `null` con su
   motivo y el motivo viaja hasta la pantalla.
2. **`compromiso === 0` tampoco es verde.** Un KPI sin compromiso no está cumplido: está sin
   configurar. Devolverle verde es la #165 en chiquito.
3. **`elegirFoco` NUNCA elige un `sin-datos`.** Se muestran en el tablero con su motivo y
   ahí se quedan. No poder leer algo no es razón para mandar a nadie a trabajar.

⚠️ **Un `count` de PostgREST puede venir `null` sin que haya error.** Eso tampoco es cero:
`contar()` lo devuelve como fallo con el texto «la base no devolvió el conteo».

⚠️ **Y si la tabla de registros no se puede leer, TODOS los KPIs manuales quedan
`sin-datos` a la vez** — no en cero. Diez KPIs en rojo por un timeout es la forma más rápida
de que alguien deje de mirar esta pantalla.

## Un guard que no se puede correr no es un guard

**Vive en:** `lib/objectives-modelo.ts` (`FUENTES_DEF`, `FuenteId`) · `lib/objectives-fuentes.ts` (`LECTORES`)

El primer intento fue un test que cruzaba el catálogo de fuentes contra los lectores. Falló
al primer intento de correrlo, y no por el contenido:

```
Error: This module cannot be imported from a Client Component module.
   at lib/objectives-fuentes.ts:24  ← import 'server-only'
```

El módulo de los lectores habla con Supabase, así que lleva `server-only`, así que **ningún
test lo puede importar**. Es el mismo modo de falla que «una integración son TRES registros
y ninguno falla ruidoso»: escribir la entrada del catálogo y olvidarse del lector deja una
fuente elegible que después contesta «fuente desconocida».

**La salida no fue aflojar el test: fue mover el guard al compilador**, que sí corre ahí.

```ts
// modelo (sin server-only): el array es la fuente y el tipo se DERIVA de él
const FUENTES_DEF = [ { id: 'agendas', … }, … ] as const satisfies readonly FuenteDef[];
export type FuenteId = (typeof FUENTES_DEF)[number]['id'];

// fuentes (server-only): el Record exige la paridad EN LAS DOS DIRECCIONES
const LECTORES: Record<FuenteId, Lector> = { … };
```

Con eso, una fuente del catálogo sin lector no compila, y un lector que nadie puede elegir
tampoco. **La regla: cuando el guard natural es un test y el módulo no se puede importar,
buscá dónde SÍ corre —el compilador, el pre-push— antes de resignarlo.**

⚠️ **Y el id que llega de la BASE sigue siendo un `string` cualquiera.** El tipo protege lo
que se escribe en el código; el lookup en runtime va sobre `Record<string, Lector |
undefined>` y un id que no está devuelve «no pude leer», nunca un cero.

## `deadline` y `quarter` son dos hechos, y colapsarlos inventa una decisión

**Vive en:** `app/plan/board/cuando.ts` · migraciones 0155 y 0156

El cuerpo pide derivar el Quarter del deadline: ya está la fecha, ¿para qué otra columna? No
son lo mismo:

- **`deadline` dice cuándo VENCE.** Lo pone el Perro Guardián, una reunión o un import.
- **`quarter` dice cuándo se decidió HACERLO.** Lo pone siempre una persona.

Una tarea con fecha para marzo **no** es una tarea que alguien haya planificado para el Q1.
Derivarla es inventar una decisión que nadie tomó — y después nadie puede distinguir la
inventada de la real. Por eso ninguna de las dos migraciones backfillea nada.

Lo que sí se hace es contestar la pregunta del usuario con los dos datos: una tarea entra en
«este Quarter» si la planificaron para él **o** si vence adentro. La pregunta es «¿qué cae en
esta ventana?», no «¿qué columna tiene puesta?».

**Dos decisiones de la ventana que no son obvias y están en tests:**

- **Un deadline vencido es «hoy», no pasado.** Algo que venció ayer y sigue abierto es
  exactamente lo que hay que hacer ahora; mandarlo a otra ventana lo esconde justo cuando más
  importa. Lo mismo con un Quarter ya terminado sin deadline.
- **«Esta semana» son los próximos 7 días, no «hasta el domingo».** Un viernes, con el corte
  del domingo, «esta semana» son dos días — y la pregunta de quien mira el tablero un viernes
  es qué le toca en los próximos siete.

⚠️ **Y el selector no ofrece Quarters PASADOS.** Planificar algo para un trimestre que ya
terminó no es una intención posible: si aparece en la lista, alguien lo elige por error y la
tarea queda en una ventana que no existe.

## El progreso de un objetivo NO se guarda

**Vive en:** `lib/objectives.ts` (`avanceDeObjetivo`) · migración 0155

La tabla `objectives` no tiene columna de avance, y no es un olvido. El número se lee de los
datos cada vez. Una copia guardada sería un segundo productor del mismo número, y el segundo
se queda viejo — que es el antipatrón que este repo ya pagó con el score de proyectos.

La única excepción es `metrica = 'libre'`: ahí no hay de dónde derivarlo, así que lo mueve la
persona y vive en `avance_manual`. ⚠️ **Y si nadie lo movió todavía, vale `null` —«no lo
sé»— y no cero**, que afirmaría que no se avanzó nada.

⚠️ **Y `upsertKpi` LIMPIA el `fuente_id` cuando el KPI pasa a manual.** Si quedara escrito,
el día que alguien lo devuelva a automático volvería a leer solo una fuente vieja, y el
número que la persona venía cargando a mano se perdería sin aviso.

## La migración de los tres settings deja su propia marca

**Vive en:** `lib/objectives.ts` (`migrarSettingsAObjectives`) · `app/general/page.tsx`

Los tres settings viejos (`objetivo_cash_usd`, `objetivo_cierres`, `objetivo_desde`) se
convierten en los primeros objetivos del Q en el render de `/general`. Dos cosas que hacen
que eso no se rompa:

- **Deja su propia marca (`objectives.migrado_de_settings`) y sale temprano.** NO deduce «ya
  corrí» de que existan objetivos: eso es indistinguible de «alguien los creó a mano», y una
  migración que decide si le toca mirando un estado que otro puede cambiar es un bucle. Pasó
  exactamente eso con el onboarding de las tabs (03/09/2026).
- **NO borra los settings.** Siguen ahí, y encima siguen VIVOS: `lib/reportes.ts` los lee por
  `getObjetivoProgreso` para el reporte diario y el semanal. Borrar el origen el mismo día
  que se migra deja sin red al que descubra un error mañana.

## Restaurar un diseño no es restaurar el código: la forma vuelve, los bugs no

**Vive en:** `app/general/Cabecera.tsx` (desde el 14/10/2026, `app/general/bloques/Meta.tsx`) - `app/general/page.tsx` (`Semáforo`) - `lib/focus.ts`
(`sinFuentes`) - `lib/objectives-modelo.ts` (`elegirObjetivoPrincipal`)

Cuatro commits del 6 y 7/09/2026 (`30a37bdc`, `b3805511`, `ad608da3`, `86478448`) mezclaron
**la columna vertebral nueva** con **una reescritura visual**, y el dueño rechazó el
resultado tres veces seguidas. El pedido del 08/09 fue volver al diseño anterior. Restaurar
`294d8915:app/general/page.tsx` tal cual habría devuelto siete cosas que ese archivo tenía
adentro, y la peor es la que el rediseño había venido a arreglar.

**Lo que se restaura es la FORMA; el código se escribe de nuevo.** La lista de lo que NO
puede volver, para el próximo que restaure algo acá:

| Del archivo viejo | Por qué no vuelve |
|---|---|
| El `else` del veredicto del semáforo | Es la frase textual de la #165: «El negocio está sano» sobre un workspace sin un solo dato. Depende de que `alertas` esté vacío, no de que haya datos. |
| `<EditarMeta>` | Escribe los settings legacy. `migrarSettingsAObjectives` ya dejó su marca, así que **editar la meta desde ahí no cambiaría nada en pantalla y no daría error**. |
| El `actions.ts` viejo | `setObjetivoAction` no tenía guard de rol. |
| `hoyEnTijuana()` / `ayerEnTijuana()` | Le corre el día —y con él el período del KPI y los días del Q— a todo inquilino fuera de esa zona. |
| `const meta = objetivo?.cierres_meta ?? 20` | Un número inventado como el texto más grande: «Camino a los 20 cierres - 0/20» a quien nunca cargó una meta. |
| La `proyección` y «llegas en ~N semanas» | Extrapolación lineal con el mismo peso visual que un dato medido. |
| Las cuatro sub-tarjetas fijas de Pendientes | En la pantalla real tres decían 0. |

**La regla que queda:** antes de restaurar un archivo viejo, `git log` de los commits que lo
reemplazaron y hacer la lista de las GUARDAS que agregaron. Un diseño se restaura mirando la
captura; un archivo se restaura arrastrando todo lo que se arregló desde entonces.

## Una pantalla sin superficies deja de pertenecer al producto

**Vive en:** `app/general/page.tsx` (la constante `SECCION`) - `app/general/KpisCard.tsx`

La pasada del 7/09 sacó **todas** las cajas de `/general` apoyándose en un veto real de la
casa —*«cards are the lazy container»*— y el dueño lo reportó como «se ve mucho peor, no se
ve nada». Medido el 08/09 antes de tocar nada: `/comercial` arma **8** bloques con
`background: var(--surface) + border 1px + borderRadius 18 + var(--card-pad)`, `/marketing`
**1**, y `/general` **cero**. Era la única pantalla del producto sin una sola superficie.

**El veto es contra apilar sub-tarjetas iguales ADENTRO de una sección, no contra la
sección.** La caja de afuera es lo que hace que una pantalla se lea como hermana de la de al
lado; lo que el veto prohíbe es la pila de cajitas de `--surface-2` adentro (las cuatro
métricas del mes, las N filas del semáforo, las cuatro de pendientes). Adentro va una lista
con filete de 1 px o una grilla de números sin caja.

Corolario de proceso: **un veto citado sin su contexto se aplica de más.** El de
`impeccable` habla de «same-size cards of icon plus heading plus text **as the page
structure**», y se leyó como «ninguna caja nunca».

## Con el hero grande, el verde mentiroso sube al titular

**Vive en:** `lib/focus.ts` (`EntradaFoco.sinFuentes`) - `tests/general-cabecera.test.ts`

La guarda de la #165 —`fuentes.lastSync !== null`, nunca `status`— vivía **sólo adentro del
Semáforo**. `elegirFoco` no la conocía, así que un workspace con objetivos y KPIs cargados y
**cero fuentes con datos** caía por el último escalón: todos los KPIs en `sin-datos` (que no
es rojo ni ámbar), ninguna de las seis reglas empujando una alerta, y el titular diciendo
«Vas al día con todo lo que te comprometiste».

Con la pantalla vieja eso era un renglón. Con la cabecera restaurada es **el segundo texto
más grande de la pantalla**. Agrandar un bloque no es neutral: **le sube el precio a
cualquier mentira que ese bloque pueda decir**, así que un rediseño que agranda algo tiene
que auditar lo que ese algo afirma.

El escalón nuevo va DESPUÉS de las alertas, los KPIs y el plan: un negocio con una cuota
vencida tiene algo que hacer hoy, y cambiarle la orden de cobro por «conecta una fuente»
sería el mismo error al revés.

## La lámpara mira el negocio; la lista, lo que queda por leer

**Vive en:** `app/general/page.tsx` (`Semáforo`)

Al devolver las tres lámparas aparece una pregunta que el semáforo de una sola línea no
tenía: **¿sobre qué array se calcula el color?** Las dos respuestas obvias mienten:

- sobre `visibles` (las alertas menos la que ya es el titular): con **una sola** alerta roja
  —que por serlo se convierte en el titular— la lista queda vacía y la lámpara sale **verde**
  mientras la cabecera grita «3 cuotas VENCIDAS».
- sobre `alertas`, sin decir nada: la lámpara queda roja sobre una lista vacía, y no hay
  forma de saber por qué.

Lo que resuelve: la lámpara cuenta **todas** las alertas —es el estado del negocio— y la
lista, cuando se salteó una, lo dice en una línea («La más urgente está arriba, en la
cabecera»). Son dos preguntas distintas y por eso son dos conteos distintos.

**Y el caso hermano, medido en producción (ws13):** la cabecera decía «Vas $15.217 abajo de
lo esperado» y dos bloques más abajo la lámpara **verde** certificaba que estaba todo bien.
Las seis reglas del semáforo miran señales operativas y **ninguna mira el compromiso del
trimestre**, así que juntar los dos bloques en una pantalla los hace contradecirse. El
objetivo atrasado apaga el verde y enciende el ámbar, sin agregar una fila: el número ya está
arriba y repetirlo sería la duplicación que esta pantalla viene arrastrando.

## «El objetivo principal» no existía, y `objetivos[0]` podía ser el del AÑO

**Vive en:** `lib/objectives-modelo.ts` (`elegirObjetivoPrincipal`) - `lib/objectives.ts`
(`listObjectives`)

`listObjectives` devuelve **a propósito** los objetivos ANUALES mezclados con los del Q
(«esconderlo mientras se mira un trimestre haría que la meta de facturación del año
desaparezca nueve meses al año»), ordenados por `orden`. La pantalla tomaba `objetivos[0]`,
así que la cabecera podía mostrar el número del **año** arriba de una pantalla que dice «Q3
- quedan 22 días», sin decirlo en ningún lado.

Y «facturación» tampoco alcanza como criterio: `cash_usd` (lo que entró) y `sold_usd` (lo
firmado) son **dos objetivos distintos que pueden convivir en el mismo trimestre**. Por eso
la cabecera lleva una pastilla con el nombre de la métrica —«Cobrado» / «Firmado»— y nunca
dice «Facturación» a secas.

La regla vive en **una** función exportada, que consumen el hero y el `objetivoPrincipalId`
de los KPIs nuevos. Con dos copias, un día eligen distinto y el compromiso queda colgando de
otra cosa que la meta.

## El relleno de una isla oscura se deriva del TEXTO de esa isla

**Vive en:** `app/general/Cabecera.tsx` (`RELLENO`, `RELLENO_LINEA`; se borró el 14/10/2026: la isla oscura es la opción «Fondo» de cada bloque, `app/dashboard/ElementoGeneral.tsx`) - `app/globals.css:916`

Adentro de la isla oscura hacen falta un relleno y una línea elevados, y el repo los venía
escribiendo a mano como `rgba(255,255,255,.05)`. Eso se rompe donde nadie mira:
`[data-tema-candidato="true-north"]` redefine `--sidebar` a **#E5E9F0** —un gris casi
blanco—, y ahí un blanco al 5% desaparece sin dejar rastro.

La salida no es un token nuevo (que habría que redefinir en los dos bloques de tema
candidato, o sea el mismo problema con otro nombre): es **derivarlo del color del TEXTO de
esa superficie**, `color-mix(in srgb, var(--on-sidebar) 7%, transparent)`. Sobre fondo claro
`--on-sidebar` es oscuro, así que el relleno se da vuelta junto con la superficie.

Y la paleta de adentro del hero no se hereda: sobre `--sidebar`, `--ink` mide **1,01:1**,
`--dim` **2,09** y `--faint` **3,61**. Un solo gris del tema claro heredado ahí adentro deja
texto ilegible **y no se nota hasta que alguien prueba el otro tema**.

## Editar un objetivo o un KPI pisa lo que no viaja, empezando por el orden

**Vive en:** `lib/objectives.ts` (`upsertObjective` :192-210, `upsertKpi` :252-274) ·
`lib/objectives-modelo.ts:104` (`elegirObjetivoPrincipal`) · `app/general/actions.ts`
(`guardarObjectiveAction`, `guardarKpiAction`) · *2026-09-16 api-mako-areas*

**El síntoma:** después de editar un objetivo que no es de cobrado ni de firmado, cambia el
objetivo principal de la cabecera. Un KPI sembrado que se edita salta al final de la lista y deja
de figurar como `origen: 'seed'`.

**La causa:** `upsertObjective` y `upsertKpi` escriben la fila ENTERA, y lo que no viaja vuelve a
su default **también cuando la fila ya existe**: `orden: o.orden ?? Date.now()` y
`origen: o.origen ?? 'user'` (lib/objectives.ts:204-205 y :269-270). Las dos listas se ordenan por
`orden`, y `elegirObjetivoPrincipal`, si el grupo no tiene `cash_usd` ni `sold_usd`, se queda con
`grupo[0]`. **Pasa hoy desde la pantalla:** `guardarObjectiveAction` y `guardarKpiAction` no mandan
ni `orden` ni `origen`.

**El diagnóstico obvio es el equivocado:** «la lib valida lo que recibe». No valida: guarda lo que
recibe, y el saneo pone defaults. Las server actions no borran nada más porque el formulario
reenvía TODOS los valores actuales. Un canal que manda solo lo que cambió —un modelo, una API—
borra `avance_manual`, descuelga el KPI de su objetivo (`objective_id: null`) y resetea los
umbrales a 100/70 y la unidad.

**La regla: editar por estas dos funciones parte SIEMPRE de la fila actual.** La API de MaKo relee
la fila y completa lo que no vino, `orden` y `origen` incluidos (lib/api-mako/areas/general.run.ts).

⚠️ **Deuda:** la cura de fondo es que la lib no pise `orden` ni `origen` cuando la fila ya existe
(lib/objectives.ts:204-205 y :269-270). No se tocó porque es lib compartida, así que **cada edición
desde `/general` sigue reordenando**.

## Dos lectores de fuentes devuelven un número plausible y equivocado

**Vive en:** `lib/objectives-fuentes.ts` (`cashUsd` / `soldUsd` :103-137, `finDeDia` :36 y
`LECTORES`) · `lib/objectives.ts` (`avanceDeObjetivo` :124) · *2026-09-16 api-mako-areas*

«Sin datos no es cero» ataja el `null`. Estos dos no dan `null`: dan un número que se lee como
medido.

- **`cashUsd` y `soldUsd` no paginan.** PostgREST corta en 1000 filas sin error y la suma sale más
  chica. El comentario dice «`pagos` tiene una fila por cuota: no llega al tope», y vale para una
  semana o un trimestre — no para un año, y `avanceDeObjetivo` usa esos mismos lectores para los
  objetivos ANUALES, con el rango del año entero. La única de las sumas que pagina es
  `inversionUsd`.
- ⚠️ **Y `inversionUsd` paginaba MAL, que es peor que no paginar** (17/09/2026). Era un bucle
  `.range()` a mano **sin `.order()`**, con un comentario arriba que explicaba perfecto por qué
  había que paginar. Con 1.714 filas meta en ws1 el bucle ya entraba a la página 2, y sin
  orden el OFFSET se aplica sobre otro reparto: filas repetidas y filas salteadas. Como el
  resultado es una SUMA, el error va para los dos lados — es la única lectura de la caza que
  podía dar un número **mayor** al real, y ningún control de «da de menos» la iba a ver.
  ARREGLADO: `leerPorPaginas` por `id`, `maxPaginas: 50`; si se pasa, devuelve `null` con el
  motivo, no cero. `cashUsd` y `soldUsd` siguen sin paginar (13 cierres hoy).
- **Tres fuentes cortan el día en UTC.** `leads_nuevos`, `vsl_plays` y `contenido_publicado`
  comparan timestamps contra el `desde` pelado y contra `${hasta}T23:59:59.999Z`, aunque «hoy» sí
  salga de `hoyEnWorkspace`. En Tijuana (UTC-7) el KPI diario de leads cuenta de las 17:00 de ayer
  a las 17:00 de hoy.

⚠️ **Deuda:** paginar las dos sumas y armar los bordes del día con la zona del workspace, las dos
en `lib/objectives-fuentes.ts`. La API de MaKo lo esquiva desde afuera: topea esas dos fuentes a
92 días y avisa del borde UTC en la salida (lib/api-mako/areas/general.run.ts:127-132). La pantalla
no tiene ninguna de las dos defensas.

## `objetivosContextoTexto() === ''` no significa «no hay nada cargado»

**Vive en:** `lib/objectives.ts:582-633` (`objetivosContextoTexto`) · *2026-09-16 api-mako-areas*

Devuelve `''` a propósito cuando no hay nada: un bloque vacío en un prompt es ruido. Pero también
devuelve `''` —o un bloque sin KPIs, o sin capacidad— cuando **no pudo leer**: un `try/catch` que
envuelve todo y contesta `''`, `getTableroKpis(hoy).catch(() => [])`,
`getCapacidad(hoy).catch(() => null)`, y la capacidad que se calla si viene con `error`.

Para el prompt está bien: callarse no inventa nada. **Para afirmar «este negocio no tiene
objetivos, KPIs o cupo» no sirve:** hay que preguntarle a `listObjectives`, `listKpis` y
`getCapacidad` por separado, que sí distinguen el error (las dos primeras tiran, la tercera lo
devuelve en `error`).

⚠️ Y pesa sobre lo pendiente de abajo: mudar los reportes de WhatsApp a `objetivosContextoTexto()`
hereda esta ambigüedad. Un reporte que diga «sin objetivos» sobre una base caída es exactamente lo
que esa migración no puede permitirse.

## Retirar una tab deja vivas las FUENTES que contaban lo que esa tab escribía (06/10/2026)

**Vive en:** `lib/objectives-fuentes.ts` · `lib/objectives-modelo.ts` (`CANDIDATOS_KPI`) ·
`lib/focus.ts` · `lib/api-mako/areas/general.def.ts` y `.run.ts` · `tests/sin-instagram.test.ts`
· *2026-10-06 wf_fe0d104c-25c, revisor de #792*

**Síntoma (leído, no visto pasar):** al sacar Instagram del producto, la fuente
`contenido_publicado` quedó contando `contenido_posts` con estado `publicado` — filas que sólo
escribía el programador de /instagram, borrado en el mismo commit. Desde ahí da **0 para
siempre**. Y `CANDIDATOS_KPI` la proponía como KPI AUTOMÁTICO con 7 por semana a los negocios con
cuello `foco` o `delegacion` (en `delegacion`, primera): un KPI que nace en rojo por un problema
nuestro, que es exactamente lo que `leerFuente` dice que no hay que hacer. Medido: 0 KPIs la
usaban y la tabla tenía 0 filas, así que no le pasó a nadie.

**Por qué no lo vio la enumeración del retiro:** se buscó quién importaba la carpeta de la tab y
quién enlazaba la ruta. La fuente de un KPI no hace ninguna de las dos cosas: lee una TABLA. Y el
guard nuevo buscaba la tabla como `.from('contenido_posts')`, que no ve `contar('contenido_posts')`
— con el lector devuelto y el patrón viejo daba 7/0.

**La regla:** retirar una pantalla son TRES enumeraciones, no dos — quién la importa, quién la
enlaza, **y quién lee lo que ella escribía**. La tercera es la que en este repo cae en
Objectives, porque las fuentes de KPI son lectores de tablas de otras áreas. Y el guard busca el
nombre de la tabla como CADENA, no como argumento de `.from(`. Volverlo un KPI manual es una
línea en `CANDIDATOS_KPI` y es decisión de producto.
## La ventana de anuncios no entra en el esquema, y cargarla como Q4 dispara al vigilante (10/10/2026)

**Síntoma.** El objetivo de venta de MaKo es US$15.000 entre el 1/11 y el 15/12. `objectives`
guarda el período como `anio` + `quarter` (`supabase/migrations/0155_objectives_kpis.sql:39-57`):
un rango no se puede expresar, y como Q4 2026 se mediría del 1/10 al 31/12.

**Por qué no es un detalle.** El vigilante cuenta la gracia desde el inicio del trimestre: con un
objetivo Q4 diría «va atrasado» desde el 14/10 (esperado ≈ US$2.283 contra 0 cobrado, un desvío
del 100% contra el umbral del 20%) y se lo pasaría al Perro del tablero. La salida es una
columna desde/hasta: el cálculo por rango ya existe y es privado (`recalcularProgreso(desde,
hasta, hoy)` en `lib/objectives.ts`). Hasta entonces, una ventana se mide en `/comercial` o
`/analisis` con `?desde&hasta`, y **no se carga como objetivo**.

**Lo que se midió de paso.** `objectives` tiene 8 filas en toda la base, todas con origen
`migracion`: ningún cliente creó uno a mano. Las 4 de ws13 están duplicadas (dos «Facturación del
trimestre» y dos «Cierres del trimestre», creadas con 0,4 s de diferencia el 07/09). `kpis` y
`kpi_registros`: 0. En ws9, `/general` no está en la barra (falta `general` en
`lib/capas.ts:280`) y su acción del día lee `experimento_tareas` (0 filas) en vez de
`plan_tareas` (423) (`app/general/page.tsx:128`). Y los avisos del vigilante no dejan rastro:
escriben en `notificaciones`, que sigue sin existir en producción (la 0048 nunca se aplicó; ver
[hallazgos-comunicacion.md](hallazgos-comunicacion.md)).

**Vive en:** `supabase/migrations/0155_objectives_kpis.sql` · `lib/objectives.ts` ·
`app/general/page.tsx:128` · `lib/capas.ts:280`. *Corrida `wf_01c22b1b-91a`, 10/10/2026.*


## /general personalizable: cada persona elige sus VISTAS, y un bloque que no filtra no finge (13/10/2026)

> ⚠️ **Reemplazada el 14/10/2026** por [General es el editor del Dashboard con su propio informe](#general-es-el-editor-del-dashboard-con-su-propio-informe-14102026):
> las vistas, su IA y su ruta se retiraron. Queda por lo que enseñaron (el alcance que no matchea nada, el semáforo que
> dependía de la cabecera). Los archivos que nombra ya no existen, salvo `lib/general-alcance.ts` y `app/general/Bloques.tsx`.

**El pedido.** Martín: «Que los usuarios puedan elegir que ver, si quieren ver "Prioridades" del PLAN, como el
caso de Mauricio, las cuotas a cobrar... Otros querrán ver su objetivo», y en el mismo turno: «Que hayan templates
de tab general. Y que se puedan crear más de una, e incluso asignarles ofertas y/o funnels». Y Mauricio, en la
reunión del 13/10 (min. 54 a 72, leído en el transcript): «el cobranza yo lo veo más operativo... ¿a quién
cobrarle?» y «me genera mucho valor estar viendo quién sigue de cobranza». Martín le contestó «lo pongo ahí en el
general»: por eso **«A quién cobrarle» entra en la vista POR DEFECTO de todos**, después de los KPIs.

**Cómo quedó.** Una vista = qué bloques del catálogo (`BLOQUES_GENERAL`), en qué orden, y de qué funnels u ofertas
(`lib/general-vistas-modelo.ts`, puro y con test). Se guardan POR PERSONA y por workspace en `app_settings`
(`general.vistas.<sub>`, el molde del informe del Dashboard), con compare-and-set por `updated_at`. Se crean desde
plantillas (Operación diaria = el caso de Mauricio) o con «¿Qué vas a crear hoy?» (la caja de siempre; la IA elige
del mismo catálogo que lista «Personalizar» y `deIAVista` saca lo que no existe). Personalizar es ELEGIR bloques del
diseño restaurado, nunca redibujarlos (memoria general-diseno-restaurado).

**Tres trampas que salieron al escribirlo:**

- **El semáforo saltea la alerta que ya es el titular de la cabecera, y la cabecera ahora se puede SACAR.** Con
  una vista sin «Objetivo y acción del día», la alerta más urgente desaparecía de la pantalla y la lista decía «La
  más urgente está arriba» apuntando a nada. `BloqueSemaforo` recibe `conCabecera` y sólo saltea si la cabecera se
  dibuja. Es la regla de «dos bloques que antes vivían separados pueden contradecirse», del otro lado: dos bloques
  que vivían JUNTOS pueden depender uno del otro, y personalizar los separa.
- **Un alcance pedido que no matchea nada NO es «todo el negocio».** Una vista atada a una oferta que ningún funnel
  vende (`funnel_ofertas` vacío para ella) devolvía, con el obvio `funnels.length ? … : todo`, los datos del
  negocio entero bajo el rótulo de la oferta. `funnelsDelAlcance` distingue `{ todo: true }` de
  `{ todo: false, funnels: [] }`, y «Tu funnel hoy» dice «Ningún funnel vende lo que elegiste».
- **Sólo dos bloques saben filtrar por funnel** (`porFunnel`): «A quién cobrarle» (filtra los leads de los funnels
  del alcance: la casa y los agregados de `lead_funnel`) y «Tu funnel hoy». El objetivo, los KPIs, el semáforo, el
  mes y los pendientes miden el negocio entero: con un alcance puesto lo DICEN («Todo el negocio» a la derecha del
  título). Filtrarlos de verdad pide reescribir `leerVistaGeneral`; hasta entonces, honestos.

**En la API de MaKo** (la regla de Martín del 13/10: toda funcionalidad nueva se declara ahí): `listar_vistas_general`
y `crear_vista_general` (área general). Como las vistas son POR PERSONA, la API tiene que saber de quién: se nombra
(email o nombre) o, si la cuenta tiene una sola persona admin, es ésa (`elegirPersonaVista`). Un nombre repetido pide
el email; una plantilla que no existe es un error aunque vengan bloques (la primera versión del test no lo cazaba). La
lectura devuelve también los funnels y las ofertas con su id: ninguna otra operación los listaba.

**Y una que no es trampa pero ahorra:** `leerVistaGeneral` son trece lecturas y ESCRIBE en la primera visita
(`migrarSettingsAObjectives`). La página la llama sólo si la vista dibuja alguno de sus cinco bloques
(`VIENEN_DE_LA_VISTA`): «Operación diaria» no la necesita.

**Vive en:** `lib/general-vistas-modelo.ts` · `lib/general-vistas.ts` · `lib/general-alcance.ts` ·
`lib/general-vistas-ia.ts` · `app/general/page.tsx` · `app/general/BarraVistas.tsx` · `app/general/NuevaVista.tsx` ·
`app/general/EditarVista.tsx` · `app/general/Cobranza.tsx` · `app/general/Bloques.tsx` ·
`app/api/general/ia/route.ts` · `tests/general-vistas.test.ts`. *13/10/2026, claude2.*

**Y dos chats construyeron la MISMA cobranza el mismo día (14/10/2026).** Este y el de Graphics movieron «A quién
cobrarle» a General sin saberlo el uno del otro: dos componentes, dos lecturas (la mía con `getOutstandingDetalle(hoy)`,
la suya sin ventana) y el choque recién apareció en el merge. Quedó UNA: la `Cobranza` de Graphics (la lectura y el
renglón del teléfono, con su test) es el bloque `cobranza` de las vistas, recortada al alcance por
`cobranzaDeLaVista` y con el rótulo del alcance al lado del título. La regla de «vacía no se dibuja» quedó partida: la
vista de FÁBRICA la esconde (un negocio sin cuotas no ve ruido), una vista que la persona armó la muestra (la eligió, y
una vista de sólo cobranza quedaba en blanco). Lo fijan `tests/general-cobranza.test.ts` y `tests/general-vistas.test.ts`.

## «A quién cobrarle» en General: la tercera puerta de «Marcar cobrada» (13/10/2026)

**Vive en:** `app/general/Cobranza.tsx`, `app/general/page.tsx`, `leerAQuienCobrar` en `lib/datos-comercial-server.ts`,
`exigirAccesoAMarcarPago` en `app/crm/actions.ts`

Pedido al cerrar la reunión con Mauricio del 12/10 (86:17): «en la tab general, la cobranza». Él la ve como algo que se HACE,
no que se analiza. Es la lista del teléfono en escritorio, y lo que importa al tocarla:

- **Una lista, tres pantallas, una lectura.** General, el teléfono (`app/m/dashboard/CobranzaM.tsx`) y «Clientes por cobrar» del
  Dashboard leen `getOutstandingDetalle` + `armarCobranza`. General sin ventana (todo lo pendiente). El renglón («US$500 · vence el
  jue») está escrito en DOS lugares —el teléfono no puede importar del catálogo para no engordar su bundle— y lo ata
  `tests/general-cobranza.test.ts`, que compara los dos textos.
- **La guarda de `marcarPagoAction` es POR TAB**, y General era una tercera puerta: sin `porGeneral`, un negocio cuya capa no
  tenga CRM ni Dashboard vería el botón y le contestaría «No tienes acceso a la cobranza de esta cuenta». General es sólo del
  admin (`requireRolWs([])`), así que la puerta nueva también.
- **Un negocio que no cobra en cuotas no ve la sección**: sin filas y sin error es ruido en la pantalla de lo que se hace hoy. Si
  la lectura falla, la sección está y lo dice.

## General es el editor del Dashboard con su propio informe (14/10/2026)

**El pedido.** Martín, al ver las vistas del 13/10: «La personalización que hiciste en GENERAL es nula... Mirá que
tienes de donde inspirarte, pero no lo hiciste... Tenemos un constructor de landing y gráficos para poder personalizar
la tab general... intenta replicar lo que tenemos en dashboard, solo que claro, aquí no hace falta tantos gráficos y
tiene otro objetivo la tab... también crea templates... Me imagino una que diga "Bienvenido NOMBRE..." Los bloques
también deberían ser editables». Y después: «Piensa en todos los bloques que un usuario, con los diferentes funnels
que tenemos... podría llegar a querer ver».

**El diagnóstico obvio era el equivocado, y lo había elegido yo.** El 13/10 se leyó «que los usuarios puedan elegir
qué ver» como «elegir bloques de una lista y ordenarlos»: una máquina nueva (vistas, su IA, su ruta, su barra) al lado
de un editor que ya hacía todo eso y más. El pedido nombraba la fuente («tenemos de donde inspirarte») y la fuente era
el Dashboard. Antes de construir una personalización, la pregunta es **qué pantalla del producto ya la tiene**: si
existe, la segunda es la misma con otro dato, no otra máquina (AGENTS.md, «Antes de construir una máquina nueva…»).

**Cómo quedó.** `/general` monta `EditorInforme` con `informe="general"`. Lo único que cambia es el DATO y lo que el
editor sabe dibujar de más:

- **El informe es otro**: `general.informe.<sub>` (`claveDe`/`inicialDe` en lib/graficos-tablero.ts), con el mismo
  compare-and-set por versión. Quien nunca armó el suyo ve `informeGeneralInicial()` (ids fijos), y **mirar no lo
  guarda**. Un informe guardado sin hojas vuelve a la inicial: General nunca queda en blanco.
- **Los bloques de General son un ELEMENTO** (`tipo: 'general'`, lib/general-piezas.ts). El editor no aprende a leer
  el objetivo, los KPIs ni el Plan: el server de /general los arma con las lecturas de siempre (app/general/piezas.tsx)
  y viajan ya dibujados por contexto (`ContextoGeneral`, app/dashboard/ElementoGeneral.tsx). Un componente de cliente
  puede recibir JSX armado en el server como prop, y eso es lo que evita duplicar cinco lecturas en el cliente.
- **Se arman TODOS los bloques, no los de la hoja abierta**: se puede insertar cualquiera mientras se edita y cambiar de
  hoja no vuelve al server. Cada lectura falla sola y su bloque lo dice.
- **El funnel se elige por bloque** («Tu funnel hoy», «A quién cobrarle»: `piezaPorFunnel`). El server arma UNA
  variante por funnel (hasta 8) con `clavePieza(pieza, funnel)`, y el elemento la busca con la MISMA función: elegir en
  el panel cambia el bloque sin volver al server. Para la cobranza se pregunta de qué funnel es cada CLIENTE CON CUOTAS
  (`funnelsDeLeads`, la lista chica), nunca los ids de todos los leads del negocio.
- **Los textos entienden variables** (`{{saludo}}`, `{{nombre}}`, `{{negocio}}`, `{{fecha}}`, `{{trimestre}}`): se
  resuelven al DIBUJAR (`conVariables`), nunca se guardan resueltas, y la que no tiene valor queda cruda.

**Las trampas que salieron:**

- **Parametrizar el editor rompió SIETE tests anclados por regex** (la guía, el ⋮ Compartir, el AI Analyst, la lista de
  tipos de elemento). Ninguno era un bug: eran guards que leen el fuente del editor. Se actualizaron con su porqué; la
  lección es que **sumar una variante a un componente que tiene guards de fuente es tocar esos guards en el mismo
  commit**, y correr `tests/graficos*` y `tests/dashboard-*` antes de dar el editor por terminado.
- **Un tipo de elemento nuevo aparece SOLO en todas las listas que derivan de `TIPOS_ELEMENTO`**, incluidas las que no
  pueden dibujarlo: la API del Dashboard lo ofrecía en `insertar_elemento_dashboard` y fallaba con «No pude armar el
  elemento» (el saneo lo tira sin pieza). Se sacó de `ELEMENTOS_DE_LA_API` con un error que dice dónde va, y el
  catálogo lo marca `solo_en_general`. Lo mismo vale para los links compartidos (`ELEMENTOS_QUE_NO_SALEN`).
- **El análisis programado (cron) lee los informes guardados**, y el de General vive en otra clave:
  `leerInformeGuardado` (lib/graficos-analisis-server.ts) junta las hojas de los dos, o las cajas de Conclusiones de
  una hoja de General no correrían nunca.
- **Un pop-up no tiene General que dibujar**: el saneo tira un bloque de General con `enPopup`. Copiar una hoja de
  General al Dashboard deja los bloques diciendo «se ve en la tab General»: aceptado, no se migran.
- **El tsc del chequeo angosto murió sin imprimir nada con 2 GB libres** (el vigía de RAM). Con 2,9 GB y
  `--max-old-space-size=2560` pasó. No era el código: AGENTS.md, «si el pre-push falla sin imprimir una sola línea».
- **Y un chequeo angosto cubre los archivos de SU lista, a la hora en que corrió.** La bitácora de `/admin/dev` también
  tipa (`Hito` exige `puntos`), se escribió después del chequeo, y el hito de un pedido sin `puntos` llegó al pre-push
  del orquestador (lo arregló en `46958506`). Lo que se escribe en la cosecha entra a la lista y se vuelve a chequear.

**Segunda vuelta, el mismo día (04:47).** Martín: «Toda la topbar la deberías copiar de Dashboard menos la barra de
busqueda y el filtro que no sirven en general... Y lo mismo que en Dashboard, para un usuario nuevo, deberías proponerle un
template». Quedó así: la barra de General es la del Dashboard sin `BarraControles` (título, Editar, ⋮), y quien nunca armó
la suya arranca EN BLANCO como el Dashboard (`sinPaginas`), con la caja y las plantillas de General como páginas (la entrada
de docs/hallazgos-graficos.md, «La pantalla en blanco es "¿Qué vas a crear hoy?"»). Dos cosas que se mueven con eso:

- **La API de MaKo lee el informe como lo ve la pantalla** (`informeDe`, lib/api-mako/areas/general.run.ts): sin hojas para
  quien nunca armó el suyo. Leyendo el crudo, `crear_hoja_general` guardaba la General de siempre JUNTO con la nueva, una
  hoja que la persona nunca vio.
- **El análisis programado ya no mira la General de siempre** de quien no guardó nada (lib/graficos-analisis-server.ts): sin
  informe guardado, cero hojas de General.
- El modal «Personalizar vista» que Martín vio al apretar Editar era la versión de las VISTAS: la captura es de antes del
  deploy de 46958506.

**Vive en:** `app/general/page.tsx` · `app/general/datos.ts` (era `piezas.tsx`) · `app/dashboard/ElementoGeneral.tsx` ·
`app/dashboard/EditorInforme.tsx` · `app/dashboard/Elemento.tsx` · `lib/general-piezas.ts` · `lib/general-plantillas.ts` ·
`lib/general-alcance.ts` · `lib/graficos-tablero.ts` · `lib/graficos-catalogo.ts` · `lib/graficos-analisis-server.ts` ·
`lib/api-mako/areas/general.run.ts` · `lib/api-mako/areas/dashboard.helpers.ts` · `tests/general-editor.test.ts`.
*14/10/2026, claude2 (56efcbaa).*

**Tercera vuelta, el mismo día (con dos capturas de General editándose).** Martín: «Diseña nuevamente todos los "Bloque
general", la mayoría son solamente texto... Si no hay datos aún, se debería ver el placeholder siempre», «Todos los
desplegables de edición de un bloque y en general la edición del bloque hazlo mejor», «Tenemos un diseño de tarjetas para
las tareas y proyectos del plan e hiciste cualquier cosa», «Hay bloques que en la configuración se deben definir allí mismo
ciertas cosas... Como el objetivo del trimestre, que me gustaría que se llamen (OKRs)» y «Pon muchos menos gráficos
disponibles en General». Lo que no se ve en el código y gobierna lo que venga:

- **Un bloque que viaja YA DIBUJADO no puede tener opciones.** La primera versión mandaba cada bloque como JSX armado en el
  server (`armarPiezas`), y por eso el panel sólo podía cambiar de bloque o de funnel: «cuántas», «cuántos días» o «cómo se
  ve» habrían sido una variante más por combinación, o volver al server. Desde esta vuelta el server lee DATOS
  (app/general/datos.ts, tipos en datos-tipos.ts) y cada bloque se dibuja en el navegador con sus opciones (app/general/
  bloques/). El funnel elegido se resuelve igual: el server cuenta todos los funnels con su id y el bloque elige el suyo.
- **El Dashboard no carga el código de General**: el dibujo de un bloque lo pone quien monta el contexto
  (`ProveedorGeneral`, app/general/ProveedorGeneral.tsx), y el editor sólo llama a `dibujar`, `configurar` y `muestra`
  (app/dashboard/ElementoGeneral.tsx). Importar los bloques desde ElementoGeneral habría metido General —y el tablero del
  Plan que traen sus tarjetas— en el bundle del Dashboard.
- **Las opciones las declara el bloque** (`opciones` en lib/general-piezas.ts, de 2 a 4 valores con su default) y el saneo
  guarda sólo las que el bloque tiene, con un valor que existe y distinto del default (`sanearOpciones`). Un valor viejo
  que ya no existe vuelve al default al leer (`opcionDe`). En el panel van como botones a la vista; «Bloque» y «Funnel»,
  con el desplegable de la casa y el ícono de cada bloque.
- **Las tarjetas del Plan son las del Plan.** La de una tarea vivía en línea adentro de la vista Prioridades de BoardShell:
  se sacó a `TarjetaPrioridad` (exportada, mismo dibujo) y la usan las dos pantallas; la de proyecto ya era
  `ProyectoCardTile`. General las trae con `next/dynamic` (BoardShell es el tablero entero: un pedazo aparte, sólo si hay un
  bloque del Plan). «Completar» es la escritura del teléfono (`marcarHechaAction`, app/m/plan/acciones.ts), que ya sabe
  escribir en los dos tableros.
- **El placeholder es el bloque con datos de ejemplo** (app/general/bloques/muestras.ts, ficticios), apagado y con la
  acción que lo llena encima («＋ Nuevo OKR», «Abrir el Plan»…). Las mismas muestras son la vista previa del menú «Bloques de
  General» (tres por fila, sin títulos de grupo).
- ⚠️ **Lo que depende de la hora se dibuja después de montar.** Los bloques se dibujan también en el server: la raya de
  «Ahora» de Mi día, el «hace una hora» de las llamadas y las fechas de ejemplo (que salen de hoy y de la zona del navegador)
  darían un HTML distinto en el server y en el primer dibujo del navegador, que es romper la hidratación sin un error a la
  vista. Van con `useAhora` (null hasta montar) y el `Placeholder` dibuja la muestra recién montado.
- **Los OKRs se definen ahí mismo**: cada tarjeta abre `EditarObjetivo`, el placeholder trae «＋ Nuevo OKR» y el panel de
  «OKRs» (y del hero) lista los OKRs con «Editar» (`configurarBloque`). La entidad sigue siendo `objectives`: cambió cómo se
  nombra en pantalla.
- **General acota lo que trae del Dashboard** (`TIPOS_GENERAL`, `FUENTES_GENERAL`, `ELEMENTOS_FUERA_DE_GENERAL`): la
  galería, «Añadir datos», el panel de un gráfico (que igual ofrece el conjunto que ya tiene) y la barra de inserción (sin
  código, Conclusiones de MaKo ni Acción). Las plantillas de General sólo usan eso: un gráfico de afuera sería uno que
  nadie puede volver a elegir. Lo fija tests/general-bloques.test.ts.
- **La API de MaKo hace lo mismo que el panel**: `agregar_bloque_general` acepta `opciones` y `configurar_bloque_general`
  cambia las de un bloque que ya está (su título y su funnel también). Un parámetro `object` del registro declara sus
  `campos` (el test del registro lo exige): son la unión de las opciones de todos los bloques, y el runner rechaza la de
  otro bloque diciendo cuáles tiene.
- **«La tab que creé en el workspace de Leandro»** era la única General guardada en toda la base: `general.informe.1` del
  ws 9 (el de Martín), con la hoja de la captura (`gmv7upmz01jrm`, «Página 1»). En ws 10 no había ninguna. Se borró con
  respaldo y compare-and-set; General vuelve a arrancar en blanco.

**Vive en:** `app/general/datos.ts` · `app/general/datos-tipos.ts` · `app/general/ProveedorGeneral.tsx` ·
`app/general/bloques/` · `app/dashboard/ElementoGeneral.tsx` · `app/dashboard/Elemento.tsx` (`PropsGeneral`) ·
`lib/general-piezas.ts` · `app/plan/board/BoardShell.tsx` (`TarjetaPrioridad`) · `lib/plan-hoy.ts`
(`leerPlanHoyConTablero`) · `lib/api-mako/areas/general.*` · `tests/general-bloques.test.ts`.
*14/10/2026, claude2.*

## General, cuarta vuelta: un bloque es una tarjeta de la hoja, y una plantilla contesta una pregunta (14/10/2026)

**El pedido** (Martín, 11:54, con tres capturas de una hoja recién creada en el ws1): «Mucho espacio en blanco en el
template, bloques que no se ven, los gráficos no tienen sentido, mira como se rompe "Leads por producto y etapa"... Y
pusiste ese dato 2 veces en diferentes gráficos... elegiste mostrar "Leads por origen" y "Pendientes del CRM" cuando hay
datos mucho más interesantes... como datos de facturación, de Meta», «todos nacen con bloques que ocupan todo el ancho y
quedan feos... No tienen títulos, no tienen separaciones claras», «Rediseña completamente el grafico de "Objetivo" y "Acción
del día", deben ser 2 gráficos diferentes... que el primero se llame "Meta objetivo". Y que no tenga un diseño dark»,
«muchos bloques los copiaste de otros lados, como el de Prioridades, pero no están interactuando con el diseño de la
página», «Los templates deben ser simples» y «Faltan bloques... como el de "Tareas Prioritarias"... 1 tarea, 3 tareas, 5,
10... Piensa en cada bloque y como debería poder editarse».

**El diagnóstico obvio era el equivocado: no eran los bloques, era el MARCO.** Un elemento del editor va sin tarjeta
(`.lk-comp--elemento`: fondo y borde transparentes, sin aire), y los bloques de General heredaban eso: sobre el fondo de la
página, sin el marco que tienen los gráficos de al lado, se leían como algo pegado de otra app —y un placeholder apagado sin
marco directamente no se veía—. Cada bloque tenía, además, su propio título (22 o 25 px) contra los 19 px del tema. La cura
fue una línea de clase (`lk-comp--general`) y que el título de un bloque use las mismas variables que el de un gráfico
(`--dash-titulo-*`, `.gb-tit`), no rediseñar cada bloque otra vez.

**Lo que gobierna lo que venga:**

- **Adentro de la tarjeta no va otra tarjeta.** Lo que se agrupa (un OKR, una métrica del mes, un proyecto) es una LOSA
  (`gb-losa`: el color del texto al 4,5% sobre transparente, sin borde), y una lista es filas con su línea (`gb-fila`). La
  losa se da vuelta sola con el fondo oscuro porque sale de `--ink`. Las tarjetas que vienen del Plan van adentro de
  `gb-plan`, que les cambia `--surface` por la losa y les saca el borde.
- **El fondo oscuro es una OPCIÓN de cada bloque** (`fondo`, lib/general-piezas.ts) y la aplica el MARCO, no el bloque:
  `data-oscuro` redefine los tokens (tinta, grises, líneas, superficie) a los de la isla y la tarjeta se pinta con `:has`.
  Un bloque escrito con los tokens de la casa se da vuelta sin saberlo; uno con colores fijos, no.
- **La Meta objetivo y la Acción del día son dos bloques** (app/general/bloques/Meta.tsx), claros, con las decisiones del
  08/09 intactas (la barra con la marca del tiempo, «a esta altura» y no «vas a llegar», sin meta no hay número). El id
  `cabecera` no cambió: lo guardan los informes. ../Cabecera.tsx y ../Ahora.tsx se borraron.
- **El título propio de un bloque va por contexto** (`useTituloPropio`): antes se dibujaba aparte, arriba, y escondía el del
  bloque por CSS — dos títulos, y lo que el bloque decía al lado quedaba huérfano.
- **El tamaño de un bloque es el de su CONTENIDO**, y en una plantilla **los bloques van de a dos con el mismo alto**:
  `acomodar` estira la fila al más alto, y un bloque estirado es espacio en blanco. «Pendientes del CRM» medía 7 filas para
  dibujar 4. Lo fija el test de las plantillas (un bloque que la fila estira, falla).
- **«El mismo dato dos veces» es la misma métrica VISTA IGUAL** (conjunto + métricas + dimensión): un número y su serie por
  día son dos lecturas; «Leads por etapa» al lado de «Tu funnel hoy» es la misma. La captura mostraba «Leads por
  producto y etapa» rompiéndose: un desglose por etapa al lado del funnel, y ninguna plantilla de General lo trae ahora.
- **Una plantilla contesta UNA pregunta**, con pocas piezas, títulos de parte (una Sección sin fondo ni pliegue) y lo más
  importante en número: la plata (cobrado, vendido) y lo que cuesta conseguirla (la inversión, el costo por lead) le ganan a
  un desglose por origen. Entró «Anuncios» (Meta).
- **«Proyectos del Plan» dibuja la anatomía de la tarjeta del Plan** (portada, marca, título, avance, deadline) con las piezas
  del Plan (`fondoPortada`, `Marca`, `LineaDeadline`, `projProgress`): la tarjeta del tablero mide 360 px de alto, que en una
  hoja es un hueco. «Prioridades del Plan» sigue con las tarjetas del Plan tal cual.
- **Los bloques nuevos** («Tareas prioritarias», «Próximos deadlines») leen lo que ya lee el Plan, y su «hoy» es el del
  negocio que manda el server (`d.d.hoy`): el plazo de un deadline sale igual en los dos lados.
- ⚠️ **Adentro de una hoja de estilos en template literal no va ningún backtick, ni en un comentario**: el comentario del
  marco nombraba `--gb-fondo` entre backticks y partió `editor-css.ts` (lo cazó el typecheck: «',' expected»). Y en un
  heredoc de Bash los backticks se EJECUTAN: un script de reemplazo escrito así contestó «No such file or directory» con
  tres pedazos del texto.

**Sin verse en pantalla todavía**: los altos de cada bloque salen de medir lo que dibuja, no de mirarlo (no se levantó un
`next dev`). Va a ws3 después del deploy.

**Vive en:** `app/general/bloques/` (`comun.tsx`, `Meta.tsx`, `Plan.tsx`) · `app/dashboard/ElementoGeneral.tsx` ·
`app/dashboard/editor-css.ts` (`.lk-comp--general`) · `app/dashboard/EditorInforme.tsx` · `lib/general-piezas.ts` ·
`lib/general-plantillas.ts` · `app/general/datos.ts` · `app/general/KpisCard.tsx` · `app/general/Cobranza.tsx` ·
`tests/general-bloques.test.ts`.
*14/10/2026, claude2 (e6818ee0).*

## General, quinta vuelta: de un vistazo, en grande, y medido en pantalla (14/10/2026)

**El pedido** (Martín, 13:26, con dos capturas de «¿Qué vas a crear hoy?»): «Rediseña bloque por bloque, sacale una captura
o algo y date feedback a vos mismo para perfeccionarlo en diseño. Por ejemplo, el bloque del semáforo tiene un espacio en
blanco grande e innecesario... Haz esto también para mobile... las plantillas de GENERAL, no se parezcan tanto a un
dashboard... aquí en general todo tiene que ser más minimalista, textos enormes, cosas grandes, porque justamente es para ver
de una pasada lo que el usuario quiera ver... Ya si quiere profundizar entra a dashboard» y «El diseño mobile no se ve bien
de los bloques».

**Lo que se vio en las capturas (ws3, producción, con «Editar → Celular»)** y lo que salió:

- **La Acción del día tenía un hueco del alto de la tarjeta entre la razón y el botón**: el botón iba al pie con
  `marginTop: auto`. Va pegado a la razón.
- **El semáforo dejaba media tarjeta en blanco**: la columna de lámparas medía lo que la tarjeta y la lista tenía tres
  renglones. Ahora el titular manda («2 cosas para atender», en grande y del color del semáforo), las lámparas van en fila
  al lado, y el bloque pide 6 filas.
- **«Tu funnel hoy» mostraba diez etapas en cero y una barra de scroll**, con «2 leads» arriba: los dos estaban en etapas
  que el funnel ya no tiene. Con más de 6 etapas se dibujan sólo las que tienen leads, el total va en grande y lo que no
  tiene etapa se dice.
- **«El mes» tenía barra de scroll y dos barras por métrica** (un gráfico del Dashboard): cuatro números grandes y el
  anterior en texto.
- **«A quién cobrarle» vacío repetía su título**: la muestra del placeholder es el componente entero, con su cabecera.
  La muestra va `sinCabeza`.
- **En el celular, cuatro números del mes eran cuatro tarjetas a lo ancho**: la pila pone los números de a dos.

**La regla que queda: en General, cada bloque tiene UNA cosa en grande** (el número de la meta, la acción, cuántas cosas
para atender, cuántos por cobrar, la próxima llamada, los leads sin marcar, el total del funnel) **y su letra va en `cqi`**:
`.gen-pieza` lleva `container-type: inline-size`, así que la misma letra crece en una tarjeta ancha y baja en media hoja o
en el teléfono, sin media queries y sin tocar el estilo en línea. ⚠️ Un bloque que se dibuja FUERA de `.gen-pieza` (la
vista previa del menú) necesita su propio contenedor (`.lk-bloque-escala`): sin uno, `cqi` se mide contra la ventana.
Y las plantillas de General son bloques antes que gráficos: sin tablas ni series, y como mucho cuatro números.

**Vive en:** `app/general/bloques/` (`Meta.tsx`, `Norte.tsx`, `Negocio.tsx`, `Agenda.tsx`, `Plan.tsx`) ·
`app/general/Cobranza.tsx` · `app/dashboard/ElementoGeneral.tsx` · `app/dashboard/editor-css.ts` (`.lk-pila`) ·
`lib/general-plantillas.ts` · `tests/general-bloques.test.ts`.
*14/10/2026, claude2.*

## Lo que quedó sin hacer

- **«Fondo: Oscuro» no da vuelta los colores FIJOS de un bloque (14/10/2026).** Lo que usa los tokens de la casa se da
  vuelta solo; los tipos de «Pendientes del CRM» (`TIPOS_PENDIENTE`, app/general/bloques/Negocio.tsx), los formatos de las
  publicaciones (`COLOR_FORMATO`, Agenda.tsx) y la columna de las lámparas del semáforo (`var(--sidebar)` sobre una tarjeta
  que ya es `--sidebar`, Norte.tsx) se quedan como están. Se ve recién cuando alguien elige oscuro.
- **`.mk-cabecera` (app/_ui/ui.css) ya no lo usa nadie**: era la grilla de la cabecera oscura de ../Cabecera.tsx.

- **Los bloques de General no obedecen los filtros de la hoja (14/10/2026).** Un filtro de período o de campo en la
  barra de una hoja de General recorta los GRÁFICOS, no los bloques (y desde la tercera vuelta General ni siquiera muestra
  la barra de filtros). Sólo «Tu funnel hoy» y «A quién cobrarle» se atan a un funnel, desde su propio panel. El objetivo,
  los KPIs, el semáforo, el mes y los pendientes miden el negocio entero (salen de `leerVistaGeneral`, lib/vista-general.ts,
  sin alcance). Vive en `app/general/datos.ts`.
- **El «Conectar» del semáforo SIN FUENTES sigue yendo a /integraciones, a propósito.** No nombra UNA integración (una
  fuente puede ser Meta, el CRM, un pago…), y abrir la grilla entera es lo que hace la pieza de la regla nueva
  (`LinkIntegracion`, app/_components/ConectarIntegracion.tsx) con un link que no nombra ninguna. Las alertas del
  semáforo, la acción del día y «Conectar una IA» del AI Analyst sí abren su modal ahí mismo (abd91fdb).
- **El Today de MaKo Mobile no mira el informe de General**: dibuja lo de siempre. Para la misma personalización en el
  teléfono, lee `leerInformeGeneral()` y dibuja sus bloques. Vive en `app/m/hoy`.
- **Más de 8 funnels**: los bloques que se atan a uno se arman hasta 8 (`TOPE_FUNNELS`, app/general/datos.ts); el
  noveno dice «Ese funnel ya no está». Ningún workspace llega hoy.
- **El pop-up de un gráfico de General se busca en el tablero del DASHBOARD** (lo marcó el chat de Graphics al revisar
  56efcbaa). La acción `datos` con `popupDe` lee el dueño con `informeDeRol(rol) ?? leerTablero()` (app/api/graficos/route.ts,
  ~línea 114), que es el informe del Dashboard. Un admin cae a la definición que manda la pantalla y anda; un rol con
  «hoja única» (closer, setter) recibiría 403. Hoy General es sólo del admin y no muerde; si algún día otro rol ve
  General, esa lectura tiene que mirar `general.informe.<sub>` (`leerInformeGeneral`, lib/graficos-tablero.ts).
- **Una «Prioridades del Plan» por funnel no existe**: las tareas del tablero no tienen funnel, tienen proyecto.
- **«A quién cobrarle» sigue TAMBIÉN en el Dashboard** (la sección de la hoja Comercial): Martín pidió ponerla en General y no
  dijo si se saca de allá. Se le preguntó el 13/10.
- **`getObjetivoProgreso` y los tres settings siguen alimentando los reportes**
  (`lib/reportes.ts:66` y `:174`). Mientras existan, hay dos fuentes para «cuál es la meta»:
  la vieja manda en los reportes por WhatsApp y la nueva en la pantalla. Unificarlo es
  mover esos dos call-sites a `objetivosContextoTexto()`.
- **Quitar el cupo de capacidad no se puede desde MaKo, y no es de una línea.** Guardar el cupo
  vacío (`setCapacidad('')`) se relee como **0**: `getSettingNum` hace `Number('')`, que vale 0
  (lib/settings.ts:88-97). El camino normal lo tolera porque pasa por `capacidadDe`, que trata
  `!(cupo > 0)` como «sin cupo»; pero la rama de `getCapacidad` para cuando no se pudieron contar
  los clientes activos devuelve ese `cupo` crudo (lib/objectives.ts:497-499), y la lectura diría
  «cupo: 0». Por eso la API de MaKo no ofrece quitarlo y lo manda a `/general`. *(2026-09-16
  api-mako-areas)*
- **El umbral del 20% de `objetivo-en-riesgo` es un proxy sin medir.** Se eligió para que el
  ruido de un fin de semana no dispare nada; nadie lo corrió todavía contra el histórico de
  ningún workspace. Vive en `app/api/cron/objectives-vigilante/route.ts` (`DESVIO_RIESGO`).
- **El prorrateo del ritmo es LINEAL**, y un negocio con estacionalidad no factura parejo.
  Se eligió porque es el único que se explica en una línea; la alternativa necesita un
  histórico que la mayoría de los workspaces no tiene.
- **¿El Perro define los OKRs?** La tarea #633 dice que sí «según aclaración del dueño».
  Choca con lo que ya se pagó con el score de proyectos: un número que expresa una PRIORIDAD
  no se deriva con una cuenta, y si lo produce un modelo necesita una segunda capa
  determinista que verifique su propia metodología. Sin decidir.

- **ws13 tiene los objetivos DUPLICADOS**: dos «Facturación del trimestre» (cash_usd, meta
  20.000) y dos «Cierres del trimestre» (cierres, meta 10) para 2026-Q3, medido el 08/09 con
  una lectura directa a `objectives`. `elegirObjetivoPrincipal` elige uno y la pantalla no
  miente, pero nadie los creó a propósito: falta averiguar si los duplicó
  `migrarSettingsAObjectives`, `sembrarKpisAction` o una doble carga del formulario, y poner
  la restricción que lo impida. Vive en `lib/objectives.ts`.
- **`/general` sigue escribiendo su propio `<main style={{ padding: '34px 44px 60px' }}>`**
  en vez de `<Pagina>`, que es la regla de la casa. No se cambió en esta pasada a propósito:
  `Pagina` topea en `--pagina-max` (1280) y centra, y `/comercial` y `/marketing` —las dos
  pantallas con las que `/general` tiene que verse hermana— tampoco lo usan todavía. Migrar
  una sola la deja más angosta que sus vecinas, que es el problema opuesto al que esta pasada
  vino a arreglar. Va cuando vayan las tres.
- **El modal de `Desglose` rotula con monospace en versalitas** (`COBRADO DEL PERÍODO`), que
  es el «monospace as a costume» que la casa veta. Es del primitivo compartido
  (`app/_components/Desglose.tsx:59`), así que tocarlo mueve todas las pantallas que lo usan:
  no entra en un arreglo de `/general`.
