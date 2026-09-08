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

**Vive en:** `app/general/Cabecera.tsx` - `app/general/page.tsx` (`Semáforo`) - `lib/focus.ts`
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

**Vive en:** `app/general/Cabecera.tsx` (`RELLENO`, `RELLENO_LINEA`) - `app/globals.css:916`

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

## Lo que quedó sin hacer

- **`getObjetivoProgreso` y los tres settings siguen alimentando los reportes**
  (`lib/reportes.ts:66` y `:174`). Mientras existan, hay dos fuentes para «cuál es la meta»:
  la vieja manda en los reportes por WhatsApp y la nueva en la pantalla. Unificarlo es
  mover esos dos call-sites a `objetivosContextoTexto()`.
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
