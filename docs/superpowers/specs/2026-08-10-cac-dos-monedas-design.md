# El CAC en dos monedas, y la pantalla que se lee de una pasada

**Fecha:** 2026-08-10 · **Pantalla:** `/admin/dev/pricing` (tab «Análisis de costos»)
**Estado:** diseño aprobado en conversación, pendiente de plan de implementación.

---

## El problema

El dueño marcó tres cosas, y las tres son de fondo.

### 1. El CAC suma horas y dólares, y eso descarta canales enteros

`CAC_CANALES` en `app/admin/dev/pricing/modelo.ts` valúa las horas del dueño a
US$100 (`VALOR_HORA_DUENO`) y las suma a la plata. Con eso:

| Canal | «medios» | Free | Horas en US$ | Total publicado |
|---|---|---|---|---|
| referidos | 7,55 | 36,00 | 5,00 | 48,56 |
| carrito | 124,22 | 12,00 | 0 | 136,22 |
| ctwa | 100,00 | 76,00 | 25,00 | 201,00 |
| prospección | 929,66 | 76,00 | 25,00 | 1.030,67 |
| orgánico | 3.577,20 | 0 | 2.601,60 | 1.788,60 |

Y todos se comparan contra un límite que está en dólares (US$105,84 para el Pro
mensual). El resultado fue que **el único canal que «entra» es referidos**, que es
absurdo para alguien que tiene tiempo y no tiene capital.

Tres errores distintos, no uno:

- **Dos monedas sumadas.** Las horas y la plata no son intercambiables, y menos en
  su situación. Un canal que solo cuesta tiempo es *gratis* en caja.
- **La columna `medios` contiene cosas que no son medios.** En orgánico, los
  US$3.577,20 son horas de producción disfrazadas de plata — no hay pauta en el
  orgánico. Encima 3.577,20 + 0 + 2.601,60 = 6.178,80, y el total publicado dice
  1.788,60: **el total no reconcilia con sus partes.**
- **Prospección está cotizando otro canal.** Los US$929,66 son el costo de comprar
  opt-ins con pauta. El dueño se refería a escribirle a sus 1.000 contactos, y
  después a que MaKo prospecte sola.

### 2. Faltan las conclusiones

Hay un bloque «El veredicto, en tres números», pero está scopeado a *¿cuánto
cuesta?* — no es la conclusión del documento. Y ninguna de las 5 partes abre con
su conclusión: abren con una bajada que dice **de qué habla** la sección, no **qué
concluye**.

### 3. El lenguaje es jergoso

«El techo del Pro son US$105,84», «la llamada 1a1 regalada no compra techo: lo
baja». Se puede decir directo.

### Y un dato que el dueño confirmó

Los **30 usuarios del mes 1 son 30 PAGOS**, no registrados. Eso cierra la pregunta
abierta de la corrida anterior y confirma el hallazgo: salen 11,1, y las 19 que
faltan no se compran a ningún precio que respete ninguna regla.

---

## El enfoque elegido

De tres opciones evaluadas (dos monedas separadas · una sola moneda valuando la
hora a US$20 · sacar el CAC de la vista principal), se eligió **dos monedas que
nunca se suman**, tomando de la tercera la idea de que arriba va el plan del mes y
el detalle va plegado.

---

## Diseño

### A. El dato de un canal deja de ser un número

```ts
type CanalCac = {
  plataPorCliente: number;   // US$ que salen del bolsillo: pauta, premios, IA
  horasPorCliente: number;   // horas del dueño. NUNCA se convierten a dólares
  queLoLimita: 'presupuesto' | 'horas' | 'lista' | 'tiempo-hasta-señal';
  // …el resto del tipo se conserva
};
```

Desaparece `cacUsd` como número único. `VALOR_HORA_DUENO` **sigue existiendo** para
la economía del 1a1 —donde comparar la hora contra US$4.000 sí tiene sentido— pero
**no se usa en el CAC de canales**.

El límite de gasto (los US$105,84 del Pro mensual, y los US$155,39 / US$364,00 del
anual) se compara **solo contra `plataPorCliente`**. Eso estaba bien; el error era
meterle horas adentro.

### B. El modelo de tiempo

El dueño trabaja ~12 h de lunes a sábado y ~6 el domingo: **~338 h/mes, constante**.
Las fases no cambian el total, **reparten**.

La regla que ordena el reparto, textual del dueño:

> «la parte de adquisición es la importante, no debo sacrificar nunca ese tiempo.
> Entonces puedo tener un tope de clientes high ticket y un tope de tiempo dedicado
> a debugear e implementar»

De ahí salen tres cajones y una jerarquía:

| Cajón | Agosto — Desarrollo | Septiembre — Adquisición | Octubre en adelante |
|---|---|---|---|
| **Adquisición** | ~0 | **piso protegido** | **piso protegido** |
| Desarrollo | todo | tope | tope |
| Debug e implementación | — | tope | tope |
| Entrega de high ticket | — | — | tope (= tope de clientes 1a1) |
| Agencia (ws1, ws10, ws11) | declarado | declarado | declarado |

**Los topes son salida, no entrada.** El dueño fija el piso de adquisición; el resto
se acomoda. Cuando el objetivo sube de 30 a 60 a 120 clientes, el piso sube y los
topes se aprietan solos.

⚠️ **Supuesto grande y declarado:** 12 h sentado no son 12 h efectivas, y hoy nadie
lo mide. Todo el modelo de horas se apoya en un factor de efectividad desconocido.
Se declara como `supuesto` en pantalla, y se carga al plan el trabajo que lo
cerraría (ver «Trabajo que este diseño genera»).

### C. El veredicto de un canal es una matriz, no un sí/no

```
Orgánico     US$0 de plata · <h> horas por cliente
             agosto (desarrollo)   ✗ no entra: no tenés las horas
             septiembre            ✓ entra: <n> clientes con las horas del piso
             lo limita             tus horas, y tarda 6-12 meses en dar señal
```

⚠️ Es el FORMATO, no los números. `<h>` y `<n>` salen del recálculo del punto D.
Las 26 h/cliente que circulaban vienen del modelo roto (los US$2.601,60 de horas
divididos por US$100) y **no se pueden reusar**: hay que derivarlas de las horas
reales de guionar, grabar y editar.

### D. Tres canales se recalculan desde cero

No se ajustan: se rehacen.

- **Orgánico** — plata ≈ US$0 (edición, música, herramientas). Horas = las reales
  de guionar, grabar y editar. Se elimina la columna `medios` de US$3.577,20.
- **Prospección** — el dueño definió que **MaKo prospecta sola**: plata = centavos
  de IA, horas ≈ 0, y **lo que lo limita es de dónde salen contactos con permiso**.
  Ese pasa a ser el número del canal.
- **Los 1.000 contactos** — se separan de prospección. Son un **evento de arranque**
  (mes 1-2), no un canal que se repite. Ya están modelados en `BASE_PROPIA`; deja de
  contarse dos veces.

### E. Las conclusiones

**Cada parte abre con su conclusión**: 2-3 líneas antes de la primera card, en el
lugar de la bajada actual. La bajada de hoy dice de qué habla la sección; la nueva
dice qué concluye. Ejemplo, parte 3:

> Hoy: «El CAC de cada uno de los cinco canales, contra el techo que tolera cada plan.»
> Nuevo: «Tus 1.000 contactos son lo más barato que tenés y se acaban en dos meses.
> La pauta se banca hasta US$1.940 por mes. El orgánico no cuesta plata pero te come
> <h> horas por cliente, así que entra o no según el mes.»

(Mismo `<h>` del punto C: sale del recálculo, no del número viejo.)

**El bloque de conclusión general va arriba de todo, y se escribe ÚLTIMO.**
Decisión del dueño, y es un orden de trabajo, no de lectura: se deriva de las
conclusiones de las 5 partes una vez que existen. Si se escribe antes, sale de lo
que uno cree y después se fuerza a los datos.

Reemplaza al actual «El veredicto, en tres números», que está scopeado a costos.

### F. El lenguaje

Regla: **la primera vez se dice en palabras; el nombre técnico va entre paréntesis
o adentro del plegable.**

| Hoy | Nuevo |
|---|---|
| «El techo del Pro son US$105,84» | «Por un cliente de US$47/mes podés pagar hasta US$105 y que siga conviniendo» |
| «La llamada 1a1 regalada no compra techo: lo baja» | «La llamada gratis te cuesta más de lo que te trae: US$150 de tu tiempo contra US$143 de ventas esperadas» |
| «bajo payback ≤3 meses» | «si querés recuperar la plata en 3 meses» |
| «contribución mensual» | «lo que te queda de cada cliente por mes» |

**`CAC` se puede usar tal cual** — el dueño lo dijo explícito: «se entiende».
La palabra que se va es **«techo»**.

Y el plegable «Los cinco canales, con la cadena y el veredicto de cada uno» —el que
el dueño marcó como ilegible— pasa de cinco párrafos de ~400 caracteres a **una
tabla de una línea por canal** (plata · horas · qué lo limita · entra o no), con la
prosa de cada canal en su propio plegable.

---

## Lo que este diseño NO hace

- No toca las partes 1, 2 y 4 más allá de sus conclusiones y del vocabulario.
- No rehace la proyección de 24 meses ni el programa de high ticket: sus números
  quedan como están, salvo los que dependan del CAC recalculado.
- No implementa el Focus Tracker. Solo declara que su ausencia es un supuesto.

---

## Las decisiones del dueño, ya tomadas

### El piso de adquisición

- **Mes 1 (septiembre): cerca del 100%.** Textual: «debo enfocarme en conseguir
  clientes». O sea prácticamente las 338 h.
- **De ahí en adelante: 50%** (~169 h/mes).

Con eso la matriz de canales del punto C se puede llenar, y el orgánico —que en el
modelo viejo no entraba nunca— pasa a tener un mes donde sí entra.

### El tope de high ticket: se DERIVA, no se fija

El dueño: «la cantidad de clientes lo puedes sacar de la promesa de horas que les
doy, si es una reu de 1 hora a la semana ya puedes analizarlo».

Entonces: `clientes 1a1 simultáneos = (338 h − adquisición − debug − agencia) ÷ horas
por cliente por mes`. Las horas por cliente salen de `HIGH_TICKET.entrega` (19 h en
12 semanas ≈ 6,3 h/mes). El tope es la salida.

### Qué entra en agosto: el criterio es del dueño

Sus tres niveles, textuales:

1. **«Que la app se venda sola»** — que la experiencia haga decir «WOW, necesito
   esta app». Onboarding épico, rediseño. Es lo que vuelve rentable al plan Free.
2. **Las funcionalidades DESEADAS** — generación de imágenes y video, Second Brain,
   chatbot, Competitor Spy, Landing y VSL Generator. «Lo que hace que la app sea
   vista como muy IA, no solamente un dashboard».
3. **Las NECESARIAS** — pasarela de pagos, ciberseguridad.

⚠️ **El nivel 3 no es un nivel: es una COMPUERTA.** Sin pasarela no hay 30 clientes
pagos — hay 30 personas que quisieron pagar y no pudieron. Son ~12 h de 338, así que
no compite con los niveles 1 y 2: los habilita. Va primero por dependencia, no por
importancia.

Y dos cosas que el board contradice y hay que resolver antes de implementar:

- **RESUELTO — `Feature: WhatsApp de MaKo` ENTRA en agosto.** El dueño: «Si MaKo en
  WhatsApp está bueno, quiero incluirlo». Y refuerza el punto G: es la superficie por
  la que él mismo va a operar mientras vende.
- **RESUELTO — las deseadas NO están hechas ni planificadas.** El dueño: «eso es algo
  que debería hacer». Entonces el plan de implementación **arranca por desglosarlas**,
  antes de estimar nada: hoy el alcance de agosto está subestimado justo en lo que más
  quiere mostrar.
- **Lo mejor puntuado NO está en la lista.** `Feature: WhatsApp de MaKo` tiene score
  medio **76,4**, el más alto de los proyectos que quedaron afuera, y encaja de lleno
  en el nivel 2: hablarle a MaKo por WhatsApp es lo más IA-nativo del producto.
  Detrás: `Agente: CRM automático` (71,0) y `Feature: Integraciones` (62,5 con 15
  tareas abiertas). Sin integraciones conectadas, el «WOW» del nivel 1 no tiene datos
  que mostrar.
- **Las deseadas casi no tienen trabajo desglosado.** Landing Generator 1 tarea
  abierta (score 11), VSL Generator 2 (14), Video Generator 1 (20), Image Generator 4
  (49) — contra Onboarding 31 y Diseño de la app 24. O están hechas, o no están
  planificadas. Si es lo segundo, el alcance de agosto está subestimado justo en lo
  que el dueño más quiere mostrar.

Referencia de la compuerta: el «mes 0» ya modelado son las 3 páginas legales
(términos, privacidad, reembolsos), el checkout, y la aprobación del *merchant of
record* — quién figura como vendedor en la factura. Paddle le vende al cliente en
nombre de MaKo y se hace cargo del IVA de cada país; hasta que no aprueban la cuenta,
no se puede cobrar. ≈ 12 h en total.

### G. Las horas de un canal dependen de qué esté construido

Decisión del dueño, y es la que más cambia el modelo:

> «pretendo utilizar MaKo para mi propio negocio, para vender MaKo… no es lo mismo el
> tiempo que le voy a dedicar a la prospección cuando literal hay un chatbot. O a
> crear guiones, cuando literal hay un ads writer»

Entonces `horasPorCliente` **no es un número: son dos**, y cuál aplica depende de qué
features estén vivas.

```ts
horasPorCliente: { aMano: number; conMaKo: number; loHabilita: string };
// loHabilita = la feature que baja el costo. Si no está construida, rige `aMano`.
```

Ejemplos que ya están medidos o modelados:

| Canal | A mano | Con MaKo | Lo habilita |
|---|---|---|---|
| Los 1.000 contactos | 30 h (mes 1) | ≈ 0 | `Agente: Chatbot` |
| Creativos para pauta | por derivar | por derivar | `Feature: Ads Writer` |
| Orgánico | por derivar | por derivar | Landing/VSL Generator, Image/Video |

**Esto cierra un lazo que el modelo no tenía:** cuánto se termine en agosto decide
cuántas horas cuesta cada cliente en septiembre, y por lo tanto cuántos clientes
entran en el piso de adquisición. Terminar una feature no es solo producto — **es
capacidad de venta del mes siguiente**, y el modelo tiene que mostrarlo así.

⚠️ Corolario para el alcance de agosto: una feature que MaKo usa para venderse a sí
misma tiene un retorno que las otras no tienen, y hoy no se está contando. El plan de
implementación tiene que marcar cuáles son.

## Trabajo que este diseño genera (va al board por el canal de `plan-tareas`)

- **Focus Tracker** — BYOK a Toggl para medir horas efectivas contra horas sentado,
  personalizado a MaKo. Cierra el supuesto de efectividad del que depende todo el
  modelo de tiempo.
- **Productivity Analyst** — cruza cómo se planifica (Q, OKR), cómo se cumple el
  Plan y cómo se ejecuta según el Focus Tracker.

Van cerca de `Feature: Foco`, que ya existe pero es otra cosa: el módulo de foco
diario y semanal, no medición de tiempo. Son trabajo nuevo, no un enriquecimiento.

---

## Cómo se verifica

- `npm run typecheck` y `npm test` en verde.
- Playwright a 1440 / 1100 / 820 px: **0 elementos con `scrollWidth > clientWidth`**.
- La parte 3 cerrada tiene que seguir entrando en el orden de magnitud de 1.400 px,
  como quedó con el patrón `Titular`.
- **Chequeo propio del rediseño:** ningún canal puede tener un número que mezcle
  horas con dólares. Se verifica leyendo `CAC_CANALES` y confirmando que no existe
  un campo que sume ambas.
