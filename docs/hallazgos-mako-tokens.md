# Hallazgos — MaKo Tokens (el medidor del gasto de IA)

Dónde vive el código: `lib/mako-tokens-reglas.ts` (la aritmética), `lib/mako-tokens-costos.ts` (qué cuesta cada
acción), `lib/mako-tokens-caja.ts` (la caja), `lib/mako-tokens-medidor.ts` (la puerta),
`supabase/migrations/0412` y `0416`, y el enganche en `lib/ai-cheap.ts`, `lib/anthropic.ts`,
`lib/anthropic-usage.ts` y `lib/video-desarmar-gemini.ts`.

La propiedad que el medidor existe para dar, y conviene tenerla a mano antes de tocar nada: **si una generación
sólo corre cuando hay saldo, y el saldo entra con el pago, no se puede gastar en IA antes de cobrar.** Todo lo de
abajo se lee contra eso.

---

## El medidor estaba «hecho» y no existía: era una lista de precios sin caja (15/11/2026)

**El síntoma:** `lib/mako-tokens-reglas.ts`, `lib/mako-tokens-paquetes.ts`, la migración `0412` con sus dos tablas,
`lib/uso-del-cupo.ts`, la calculadora de `/planes` y una tarifa operación por operación en
`app/admin/dev/pricing/modelo.ts`. Seis archivos, todos correctos, todos con sus comentarios. Parecía construido.

**La causa real:** ningún código escribía las tablas. `grep -rn mako_tokens_movimientos app/ lib/ supabase/ scripts/`
devolvía **sólo** la propia migración, dos listas de nombres de tablas (`lib/tablas-de-inquilino.ts`,
`lib/workspace.ts`), un script de prueba y un comentario. Nadie acreditaba un cupo y nadie restaba un gasto.

**La regla que queda:** para saber si un medidor mide, no se lee el archivo de reglas — se busca **quién escribe la
tabla**. Un `grep` del nombre de la tabla contra `app/ lib/ scripts/` contesta en dos segundos lo que leer seis
archivos de aritmética no contesta nunca. Vale para cualquier contador: el dato no es la fórmula, es la escritura.

---

## ⚠️ El diagnóstico obvio era el equivocado: copiar la columna `mt` de la tarifa cobra 2,4× de más

**El síntoma que habría tenido:** clientes viendo «te quedaste sin MaKo Tokens» con tres cuartos de su plan sin
usar, y ningún error en ningún log.

**Lo obvio:** ya existe una tabla de MaKo Tokens por operación, `TARIFA` en `app/admin/dev/pricing/modelo.ts`, con
una columna `mt` por operación. Está medida, está comentada, y la decisión que la creó es de Martín. Copiarla es lo
que cualquiera haría.

**La causa real: las dos tablas están en unidades distintas, y nada en ninguna de las dos lo dice.**

| | `TARIFA` (09/08/2026) | la regla vigente (07/11/2026) |
|---|---|---|
| 1 MT es | US$0,001 de **precio de lista** | US$0,001 de **costo real** |
| el markup (2,4×) vive | **adentro del token** (`MARKUP_MT`) | **en el cupo**: es el 25 % del precio del plan |
| analizar una llamada | 15 MT | 8 MT |

El `CUPO_MENSUAL` de hoy (11.750 MT en el plan de US$47) está dimensionado **en costo real**: son los US$11,75 que
deja el margen objetivo. Si además se cobra con markup, el markup se aplica dos veces: el cupo se agota con US$4,90
de costo gastado, o sea **al 40 % del mes**.

**La regla que queda, y está fijada por `tests/mako-tokens-costos.test.ts` caso 1:** en `lib/mako-tokens-costos.ts`
**no se escribe nunca un número de MT a mano**. Se escribe el `costoUsd` medido y el MT lo deriva `mtDeUsd`. La
columna que se copia de la `TARIFA` es `costoUsd`, nunca `mt`.

**El mismo error con los medios, y por eso conviene mirar la fecha antes que el número:** la `TARIFA` dice US$0,05
por segundo de video, marcado «publicado». La medición del 07/11 contra ApiMart, con cuatro generaciones pagadas,
da **US$0,0384** (`USD_POR_SEGUNDO`). Un número «publicado» envejece y no avisa; un número medido tiene fecha. Los
medios salen de `lib/mako-tokens-reglas.ts`, que es donde se midieron.

---

## ⚠️ El bucle infinito de un wrapper que decide no hacer nada — y es la SEGUNDA vez

**El síntoma:** `tests/mako-tokens-medidor.test.ts` no terminaba. 240 s de timeout de `execFileSync`, `ETIMEDOUT`,
**cero errores** y cero salida del hijo. Nada que leer.

**La causa real:** el enganche del medidor en la capa de IA es una **re-entrada**, copiada de la puerta de D6b:

```ts
if (!medidorAbierto()) return conMedidorDeMt(opts.feature, () => chatCheap(opts));
```

La función se llama a sí misma. El wrapper tiene que dejar una marca para que la segunda pasada siga de largo — y
esa marca es el `AsyncLocalStorage`. Cuando `conMedidorDeMt` decidía que ese pedido **no descuenta** (el negocio
corre con su IA, es la plataforma, no hay workspace) devolvía `fn()` a secas, sin abrir el almacén: la re-entrada
volvía a ver `medidorAbierto() === false` y se llamaba otra vez. Para siempre.

**Y ya estaba pagado en este repo.** Está escrito con todas las letras en `lib/solo-su-ia.ts`, revisión adversarial
de IA6 (22/10/2026): *«sin workspace devolvía `fn()` SIN guardar la decisión, y `fn` es la misma función pública, que
volvía a entrar a la puerta: un bucle de microtareas que CONGELABA el proceso entero»*. Volvió porque se copió la
**forma** del enganche sin copiar su **invariante**.

**La regla que queda:** un wrapper que se engancha por re-entrada **abre su contexto SIEMPRE**, también —y sobre
todo— en la rama donde decide no hacer nada. Esa rama es la que nadie prueba, porque «no hace nada» suena a que no
puede fallar.

**Y cómo se prueba, que es la segunda mitad del hallazgo y lo obvio también estaba mal.** El modo de falla no es un
error: es no terminar. Un `assert` no lo ve — y un **`Promise.race` con un `setTimeout` tampoco**, aunque parezca la
cura y aunque esté escrito así en `tests/_d6b-puerta-hijo.ts`. Medido el 15/11/2026 reintroduciendo el bucle a
propósito: con un tope de 20 s, el caso **no volvió nunca**. El bucle es de **microtareas** (cada vuelta resuelve
promesas ya cumplidas y no cede a la cola de macrotareas), así que el `setTimeout` del tope ni se dispara. Es lo que
la revisión de IA6 ya había escrito: *«ni un `setTimeout` corría»*.

Lo único que lo caza es un **tope de proceso**: el caso corre en un hijo y lo que reporta el rojo es el `timeout` de
`execFileSync`, no un assert. Caso 9 de `tests/mako-tokens-medidor.test.ts` con
`tests/_mako-tokens-medidor-hijo.ts`; en el registro de roturas de abajo, la fila de ese bucle es la que **no imprime
ningún caso**, porque el archivo de test entero muere antes.

---

## El embudo del gasto de IA no son las ~30 rutas: es la PUERTA de la capa de IA

**Lo obvio:** las ~30 rutas que llaman `conSuIADelNegocio` (`grep -rln conSuIADelNegocio app/ lib/`) son el
inventario del gasto de IA. Envolver esa función parece ponerlo «en un solo lugar».

**Por qué no alcanza, y las dos razones se ven mirando UNA ruta:**

1. `conSuIADelNegocio` envuelve el **handler entero**, no la llamada al modelo. En
   `app/api/onboarding/avatares/route.ts` el mismo callback atiende `siguiente`, `describir-archivo`, `afinar` y
   `guardar`: cobrarle al wrapper le cobra a `guardar`, que no llama a ninguna IA, y le cobra **una vez** a `afinar`,
   que llama varias.
2. Los caminos que gastan IA son muchos más que 30: 18 crons, 6 webhooks, WhatsApp, Automations, los Analyst, la API
   de MaKo. Y los que quedan afuera son justo **los más caros** (`docs/costos-ia-y-planes.md`: el webhook de Fathom
   proyecta US$52/mes para UN cliente, «más que el plan Pro entero»).

**Dónde está el embudo de verdad:** cada función pública de `lib/ai-cheap.ts`, `lib/anthropic.ts` y
`lib/video-desarmar-gemini.ts` que llama a un modelo arranca con las mismas dos líneas (`exigirPermisoIa()` y
`pasaPorLaPuerta(feature) → conD6bDelPedido(...)`). Son **diez** sitios, y por ahí pasa todo: las ~30 rutas, los
crons, los webhooks y lo que se escriba mañana.

**Y la trampa que esto esconde, que es la que importa:** `pasaPorLaPuerta()` devuelve **false** cuando alguien ya
decidió D6b — y las ~30 rutas lo deciden, porque `conSuIADelNegocio` llama a `conSoloSuIA`. O sea que meter el
medidor *dentro* de `conD6bDelPedido` lo habría dejado sin cobrarle **exactamente a las 30 rutas del encargo**, y en
verde: el enganche existe, simplemente no se ejecuta en ese camino. El medidor va en una línea **propia**, con su
propia condición (`!medidorAbierto()`), nunca colgada de la del vecino.

**La regla que queda:** antes de colgar una regla nueva de una condición que ya existe, leer qué la apaga. Dos
reglas que se aplican en el mismo lugar no comparten condición: comparten lugar.

---

## ⚠️ Hoy MaKo no le presta su IA a NINGÚN cliente: el medidor es el candado de una puerta soldada

**El síntoma:** el test del medidor afirmaba que, con saldo, la llamada tenía que llegar a algún proveedor. Daba rojo
con tres escenarios distintos, y el negocio tenía saldo de sobra.

**La causa real**, en `lib/ai-cheap.ts` → `provsGratisDePlataforma`:

```ts
if ((await getWorkspaceActual().catch(() => null)) !== ws) return [];
```

con esta nota al lado, del 22/10/2026: *«LA RED NO CORRE PARA NINGÚN NEGOCIO. Martín: "Cada usuario debe poder pagar su
token, su propia IA de gemini". MaKo no paga ni presta IA a los clientes: sin su IA (su Claude, su GPT o su Gemini),
"Conecta tu IA". Las claves de la plataforma son sólo para lo INTERNO de MaKo (el ws9)»*.

O sea: **un negocio que no conectó su clave hoy no puede generar texto en absoluto.** Es lo que
`docs/costos-ia-y-planes.md` ya decía desde otro ángulo — *«lo que hoy contiene el gasto es un accidente, no un techo: un
cliente sin key propia no gasta, la llamada EXPLOTA»*.

**La única excepción, y es todo lo que MaKo paga hoy de texto de un cliente:** el crédito de Claude del onboarding
(`CREDITO_HABILITADO_PARA`, `lib/veto-claude.ts`), habilitado para **tres** features —`El Archivero`,
`onboarding-extract`, `offer`— y **sólo durante el onboarding**. Más los medios (video, imagen, locución), que los paga
MaKo siempre.

**Lo que esto significa para el encargo del 15/11:** el medidor está completo y en el lugar correcto, y descuenta
exactamente donde la IA de MaKo puede pagar. Pero para que *«todo gasta MaKo Tokens»* sea cierto **hay que volver a
prestarle la IA de MaKo al negocio que no conectó la suya**, y ésa es la decisión que falta: es de plata (cuánto) y de
privacidad (D6b: los datos de los clientes de un negocio no van a una IA gratis que entrena con ellos). **No es un
cambio del medidor**: el día que ese `return []` se abra, lo que pase por ahí ya descuenta solo.

Queda como tripwire en `tests/mako-tokens-medidor.test.ts` caso 2c: afirma que hoy la red NO se presta, con el control
de que el arnés sí puede ver la red (el negocio con su clave llega a su proveedor). El día que la puerta se abra, ese
caso se pone en rojo y manda a leer esto.

---

## El gasto de TEXTO no se sabe antes: se RESERVA el estimado y se LIQUIDA el real

Un segundo de video cuesta US$0,0384 y eso se sabe antes de generarlo. Una llamada de texto cuesta lo que salga de
sus tokens, y eso se sabe **después**. Las tres salidas, y por qué la tercera:

- **Cobrar un estimado fijo y no corregir.** Miente siempre: la distribución de tokens de salida es asimétrica a la
  derecha (media 1,9× a 3× la mediana), así que se cobra de más a la mayoría y de menos a la cola, que es la que duele.
- **No cobrar antes y cobrar el real después.** Deja de cumplirse la propiedad: con saldo cero se dispara una tanda
  entera y se paga después. Es justo lo que el medidor existe para impedir.
- **Reservar el estimado antes, liquidar el real después.** ← ésta.

**Y el enganche de la liquidación ya estaba escrito, en el único lugar del repo que sabe cuánto costó de verdad:**
`recordUsage` (`lib/anthropic-usage.ts`) calcula el `cost_usd` de cada llamada. Se le avisa al medidor desde ahí, y
al cerrar se devuelve lo que sobró o se cobra lo que faltó.

Tres propiedades que caen solas de ese diseño, y son el motivo de elegirlo:

- **una llamada que FALLA no se cobra**: nadie reportó costo, así que la reserva entera vuelve en el `finally`;
- **el estimado no tiene que ser exacto**: decide si la llamada arranca, no lo que se paga. Un `estimado` flojo en la
  tabla de costos no le cuesta plata a nadie;
- **una operación que hace cinco llamadas paga las cinco**, con el costo real de cada una.

⚠️ **Y la trampa fina, que es de orden de líneas:** siete call-sites llaman a `recordUsage` **sin `await`** (en
serverless la instancia se congela con el INSERT en vuelo). El aviso al medidor tiene que ser **sincrónico y estar
antes del primer `await`** de `recordUsage`: la parte sincrónica de una función async corre al invocarla, aunque
nadie la espere. Movido después del `insertUsage`, la liquidación cerraría en cero y **se cobraría siempre el
estimado** — sin error, sin log, y con la diferencia a favor o en contra según la feature. Por lo mismo el import es
estático: un `await import` lo volvería asíncrono y rompería la misma cosa.

---

## El «bloqueante #1 del medidor» no era un bloqueante

`docs/costos-ia-y-planes.md` lo pone primero de los cuatro: *«Hoy es imposible saber cuánto gastó cada cliente en
Claude. `wsDeProveedor()` escribe todas las filas de Anthropic en el workspace 1. Es el bloqueante #1 del medidor»*.

Es cierto para el **informe** de gasto y falso para el **medidor**. El MT se descuenta al workspace **en curso**
(`getWorkspaceActual`), que es el que pidió la llamada; en qué fila de `anthropic_usage` termine anotado el consumo
es otro problema, de atribución contable. El medidor no tenía que esperar a que se arregle, y no esperó.

**La regla que queda:** un «bloqueante» de un documento es una afirmación con fecha, y conviene preguntarle
*bloqueante de qué exactamente*. Dos cosas que usan el mismo dato no comparten su bloqueante si lo usan para
decidir cosas distintas.

---

## El cupo y lo comprado son dos baldes con reglas opuestas, y una sola columna los pisa

**El síntoma que habría tenido:** un cliente compra un paquete de MaKo Tokens el 28 de noviembre y el 1 de diciembre
no está. Plata de alguien que pagó, desapareciendo sola, sin ningún error.

**La causa real:** la `0412` tiene UNA columna `saldo`, y sobre ella rigen dos decisiones contrarias:

- **el cupo del mes se reinicia** (Martín, 07/11: «esos tokens no deberían acumularse»; el porqué entero en
  `lib/uso-del-cupo.ts` — si se acumulara, un cliente que no usó nada en seis meses puede gastar seis cupos de una, y
  la plata de esos meses ya se gastó);
- **lo que compró aparte no se reinicia**: lo pagó («el cupo se reinicia, el saldo comprado no»,
  `docs/costos-ia-y-planes.md` → `compraDelMes`).

Con una sola columna gana el reinicio, porque acreditar el cupo del mes nuevo escribe `saldo = cupo`. Y **no hay
forma de reconstruir el reparto desde el ledger**: una vez gastado, los movimientos no dicen de qué balde salió cada
token.

**Lo que quedó (migración `0416`):** `saldo` pasa a ser *el cupo del mes que queda* y `comprado` es *lo que pagó
aparte*. El gasto sale **primero del cupo**, que es el que se vence. La devolución de una liquidación vuelve **en el
orden inverso** (primero `comprado`, después el cupo), y así la fila queda exactamente como estaba.

⚠️ **Y las dos restas tienen que ser UNA sentencia**, no dos:

```sql
set saldo    = greatest(0, saldo - :cuesta),
    comprado = comprado - greatest(0, :cuesta - saldo)
```

Las dos asignaciones ven el saldo **de antes** (en SQL todas las expresiones del `set` se evalúan contra la fila
vieja), así que `comprado` resta exactamente lo que al cupo le faltó. Escrito como dos `update`, el segundo ve el
cupo ya en cero y le resta todo a `comprado`: **se cobra dos veces**. Caso «las dos asignaciones ven el saldo viejo»
de `scripts/probar-0416-pglite.mjs`.

---

## El cupo se acredita solo, y la idempotencia es un índice, no un `if`

No hay cron que barra todos los workspaces el día 1: el cupo del mes se acredita **la primera vez que ese negocio
necesita saldo ese mes**, dentro de la misma llamada que va a gastar. Un barrido mensual tiene que acertar una fecha
para todos a la vez, y un reintento regala un mes entero de IA; la acreditación perezosa no tiene fecha que errar y
el reintento es gratis.

Lo que la hace segura ya estaba en la `0412`: el índice único **parcial**
`mako_tokens_movimientos_cupo_unico (workspace_id, referencia) where motivo = 'cupo'`, con la referencia siendo el
mes (`cupo:2026-11`).

⚠️ **Y la trampa de SQL que cuesta encontrar: el `on conflict` tiene que REPETIR el predicado del índice parcial.**

```sql
on conflict (workspace_id, referencia) where motivo = 'cupo' and referencia is not null do nothing
```

Sin el `where`, Postgres **no infiere** el índice parcial y el `insert` **tira** en vez de no hacer nada. Probado:
sacándole el predicado, cinco casos de `scripts/probar-0416-pglite.mjs` se van a rojo de una.

Y el orden dentro de la función importa: **primero el movimiento** (que es el candado), **después el saldo**, las dos
en la misma función y por lo tanto en la misma transacción. Si se cayera en el medio, las dos vuelven atrás y el mes
queda sin acreditar — nunca «marcado como acreditado y sin saldo», que sería un mes de IA perdido para el cliente.

---

## Un costo de 0 MT no es «gratis»: es «hoy esta feature rutea a un free tier»

Cuatro features están **medidas en cero**: `mako-guardian` (n=333), `checklist-coach` (n=132), `ads-analyst` (n=18),
`validador` (n=21). El cero es correcto hoy y es una medición del **ruteo**, no de la operación: son free tiers con
límites **por key y por día** que no escalan con la cantidad de clientes (`docs/costos-ia-y-planes.md`: «el free tier
tapa la mitad del costo»; si se agota, el mismo consumo pasa de US$67 a US$99/mes).

Esas features corren con saldo cero, a propósito: no cuestan nada, así que frenarlas no protege ninguna caja. Y se
auto-corrigen: el medidor cobra lo que `recordUsage` midió de verdad, así que el día que una caiga a un modelo pago
empieza a descontar sola, sin que nadie toque la tabla.

**La regla que queda:** una fila con costo 0 lleva escrito POR QUÉ es 0. «Medido en cero» y «gratis» se escriben
igual y se envejecen distinto.

---

## El vocabulario de `feature` no está normalizado, y el costo se busca por igualdad exacta

Medido el 15/11/2026: el código usa **117** valores distintos de `feature`, en cuatro formas que conviven —
`mako-doer-in` (kebab), `second_brain_buscar` (snake), `El Archivero` e `Importar leads` (rótulos con espacios),
`MaKo · nota de voz` (rótulo con separador) — y hay pares que son lo mismo con dos nombres
(`extract-deal-fiscal` / `extract_fiscal`).

`costoDeFeature` busca por **igualdad exacta de string**. Una fila escrita «como debería llamarse» no matchea nada y
esa feature cae al default **sin que nada avise**. Antes de agregar una fila:
`grep -rn "feature: '<lo que sea>'" app/ lib/`.

**Y de paso, medido:** `CATALOGO_MODELOS` (`lib/model-catalogo.ts`) declara **68** de esas 117. Las otras 49 llaman a
un modelo sin declarar cuál usan, así que el override por feature de `/admin` no las alcanza. Queda sin hacer; lo
expone `costosFueraDelCatalogo()` para que el número no haya que volver a medirlo a mano.

---

## Lo automático: la regla de agosto se dio vuelta a medias, y a propósito

La `TARIFA` del 09/08 le puso **0 MT a todo lo automático**, con un argumento que sigue siendo bueno: *«el usuario no
lo dispara ni lo puede parar: cobrarle cuota por un cron es que abra la app y la encuentre vaciada por algo que no
hizo»*.

Pero cobrar 0 por lo automático deja **sin medidor al que más gasta** (el mismo documento proyecta el webhook de
Fathom en US$52/mes para un cliente, y cinco de esos caminos iteran todos los workspaces activos). Un medidor que no
mira al mayor gastador no protege la caja.

Lo que quedó separa **cobrar** de **avisar**: lo automático **descuenta igual** y queda en el ledger; y si no alcanza,
**no se le muestra un error a nadie** — el camino automático saltea a ese negocio esta vuelta
(`SalteadoSinSaldo`) y lo anota. Las dos cosas que la regla de agosto quería, sin el agujero.

**Es una decisión de plata: la decide Martín.** Está marcada así en `lib/mako-tokens-costos.ts` → `fallaBlanda`.

---

## Enganchar el medidor puso en rojo dos tests de D6b que no lo mencionan, y eso avisó de algo peor

**El síntoma:** `tests/d6b-puerta.test.ts`, casos 3 y 4, en rojo. Ninguno habla de MaKo Tokens: prueban que un negocio
sin su IA escucha sus notas de voz con su Groq, y que sin workspace la puerta vuelve.

**La causa real:** esos tests corren **las entradas de verdad** de la capa de IA contra un PostgREST de mentira. Desde
que el medidor vive ahí adentro, toda llamada a un modelo pide saldo antes de salir — y una RPC que nadie mockeó
contesta `[]`, con lo cual el medidor **falla cerrado, como está diseñado**, y frena todo. El arreglo va en
`tests/_postgrest-de-mentira.ts`: la caja contesta «alcanzó» por defecto, para que cada test siga probando lo suyo (la
caja tiene su propia prueba contra un Postgres real).

**Y lo que ese rojo destapó, que era lo importante: el medidor rompía el alta de todo cliente nuevo.** Un negocio que
todavía no paga un plan **no tiene cupo** (`cupoDeCapa` devuelve null para cualquier capa que no sea `completo` o
`agencia`). Pero MaKo sí le paga la IA de tres cosas en su primer ingreso, por decisión de Martín: el crédito de Claude
del onboarding, habilitado para `El Archivero`, `onboarding-extract` y `offer` («Por ahora solo en onboarding»). Con el
medidor cobrando parejo, el primer ingreso de cada cliente nuevo se quedaba sin leer sus documentos ni armar su oferta,
con un «te quedaste sin MaKo Tokens» **antes de haber usado nada**.

**Lo que quedó:** esas tres features no se cobran **cuando el negocio no tiene cupo todavía**. Es el único lugar del
medidor que falla ABIERTO, y se justifica porque ese gasto **ya tiene su propio techo, y más angosto que un cupo**:
tres features, sólo durante el onboarding, con una clave que no sirve para nada más y con fecha de vencimiento. El
corte es `cupo == null` y no la feature sola, así la excepción **se cierra sola** el día que el negocio pasa a pagar un
plan.

**La regla que queda:** un medidor nuevo en un camino compartido se prueba contra los tests que YA existen de ese
camino, no sólo contra los propios. Los ajenos son los que conocen los casos que uno no pensó — acá, que hay un negocio
al que MaKo le paga la IA a propósito y que todavía no es cliente.

---

## Dos trampas del arnés de pruebas, que costaron un rojo cada una

Para probar que el medidor le cobra a alguien hace falta un negocio al que la IA se la pague MaKo. Dos elecciones
razonables que no sirven:

- **Darle una clave de Claude, OpenAI o Gemini**: pasa a ser «su IA» (`CLAVES_SU_IA`, `lib/ia-del-negocio.ts`) y queda
  exento. El test no ve nada.
- **Darle una clave de GROQ**: no es «su IA», así que el medidor sí actúa… pero **Groq no contesta texto**
  (`PROVS_SOLO_AUDIO`, IA16, Martín 22/10: «Groq sólo para las notas de voz»), así que la cascada de texto se queda sin
  candidatos y la llamada no sale a ningún proveedor — que es **exactamente** lo que el test afirma cuando NO hay saldo.
  El verde del caso que importa y el rojo del que no se vuelven indistinguibles.

**La regla que queda:** un test que afirma «no salió a ningún proveedor» necesita, al lado, un control que demuestre que
el arnés **sí puede ver** la red. Sin ese control, una lista vacía prueba lo mismo que un arnés roto.

---

## Qué quedó sin hacer

- ⚠️ **Lo más importante: volver a prestarle la IA de MaKo al negocio que no conectó la suya.** Sin eso, «todo gasta MaKo
  Tokens» no se puede cumplir, porque hoy no hay nada que gastar (ver más arriba). Es decisión de Martín: plata y
  privacidad. El medidor ya está listo para cuando se abra.
- **Dos caminos de IA que no pasan por la capa de IA** y por lo tanto no descuentan: `lib/embeddings.ts` (corre en
  CADA búsqueda del RAG y no llama a `recordUsage`) y `lib/transcribe-plataforma.ts` (el audio de las clases de los
  cursos, con `envCred`, que siempre cae al workspace dueño). Son los dos «puntos ciegos» que
  `app/admin/dev/pricing/modelo.ts` → `BLOQUEANTES` ya listaba.
- **Los MEDIOS: la pieza está escrita (`cobrarMediosMt` / `devolverMediosMt`) y no hay a qué engancharla todavía**, y
  conviene saber por qué antes de buscarle el lugar. Medido el 15/11/2026:
  - **el video y las imágenes salen por el Google Flow DEL CLIENTE** (`lib/flow-cola.ts` y compañía), así que MaKo no
    paga nada;
  - **la locución sale por el ElevenLabs DEL CLIENTE**: `lib/elevenlabs.ts` resuelve con `credDelCliente`, no con
    `credWs` («ES `credDelCliente` Y NO `credWs`, Y LA DIFERENCIA ES UNA SOLA LÍNEA SUYA»);
  - **ApiMart sí la paga MaKo** (Martín, 7/11: «para que nosotros costeemos eso») pero `generarVideo`
    (`lib/apimart.ts`) **no lo llama nadie**: `grep -rn "generarVideo(" app/ lib/` devuelve su propia definición y un
    comentario de `lib/flow.ts`. Está escrito de punta a punta y sin conectar.

  O sea que **hoy no existe ningún camino de medios en el que MaKo pague**, y por eso la pieza queda esperando. El día
  que se enganche `generarVideo`, el cobro va ahí y en el mismo commit — un generador que MaKo paga y que no descuenta
  es el agujero más caro que puede abrirse, porque un reel son 412 MT contra los 8 de un análisis de llamada.
- **Nadie acredita una COMPRA todavía.** `acreditarCompra` existe y exige una `referencia` del pago (es lo único que
  impide que un reintento del webhook de la pasarela acredite el paquete dos veces), pero el webhook no la llama: no
  hay pantalla para comprar MaKo Tokens. El mensaje de «te quedaste sin saldo» ofrece sumar más y todavía no hay
  dónde.
- **El Acelerador no tiene cupo**, a propósito: `cupoDeCapa` devuelve null para cualquier capa que no sea `completo`
  o `agencia`. Un negocio en el Acelerador va a poder gastar sólo lo que haya comprado. Nadie decidió el número y el
  código no lo inventa.
- **La concurrencia de verdad no está probada contra la `0416`.** `scripts/probar-0416-pglite.mjs` corre contra un
  Postgres real pero de **una sola conexión**, así que la carrera —que es el motivo de que el chequeo y el descuento
  sean la misma sentencia— no se puede ejercitar ahí. Lo que la prueba es
  `scripts/probar-concurrencia-saldo.mjs` (30 conexiones, 200 pedidos a la vez), y hay que correrlo **después de
  aplicar la migración**; hoy sólo ejercita el `update` de la `0412`, no las funciones nuevas.
- **Los `estimado` de la tabla de costos son 80 de 104 filas.** No le cuestan plata a nadie (el medidor liquida con
  el costo real), pero deciden si una llamada arranca: son lo primero a recalibrar con `anthropic_usage` cuando haya
  meses suficientes.

---

## Probado rompiéndolo

`scripts/probar-0416-pglite.mjs` (18 casos contra un Postgres de verdad), una rotura por vez, restaurada:

| rotura | casos en rojo |
|---|---|
| el cupo del mes se SUMA en vez de reemplazar | 2 (no se acumula · no borra lo comprado) |
| el gasto sale primero de lo comprado | 2 (el orden de los baldes · la devolución) |
| el chequeo mira sólo el cupo y se olvida de lo comprado | 4 |
| el `on conflict` sin el predicado del índice parcial | 5 (la migración ni aplica) |

`tests/mako-tokens-medidor.test.ts` (13 casos, con el hijo corriendo las entradas REALES de la capa de IA contra un
PostgREST de mentira), una rotura por vez, restaurada:

| rotura | casos en rojo |
|---|---|
| el medidor loguea en vez de frenar | 3 (sin saldo sale a la red · la feature sin mapear · lo automático) |
| la exención de «su IA» sacada | 2 (le cobra al que paga su clave · y el control de la red) |
| el bucle de vuelta (`return fn()` sin abrir el almacén) | **ninguno: el archivo de test entero muere por timeout** |
| el enganche sacado de `chatCheapCascade` | 6 |

`tests/mako-tokens-costos.test.ts`: 10 casos, puros.
