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
