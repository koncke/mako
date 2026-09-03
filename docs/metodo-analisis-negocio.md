# El método de análisis de negocio

*Extraído de la reunión Mau <> Martín del 31/07/2026 (Fathom rec. 169318702, 2.572 turnos,
leídos enteros con 8 lectores + síntesis). Tres horas mirando los datos del negocio en
vivo. Cada paso de acá abajo se dijo en esa reunión; las citas están en el transcript.*

**Lo que implementa esto:** `lib/analisis-modelo.ts` (la aritmética, pura y testeada),
`lib/analisis-negocio.ts` (las lecturas), `/analisis` (la pantalla),
`analisis_negocio` (herramienta de MaKo) y `GET /api/agente/consultar?que=analisis_negocio`
(la skill).

---

## Por qué existe

Media reunión fue **aritmética hecha con la calculadora del celular**, en voz alta, tres
veces cada número. Los cuatro costos por escalón —por agenda, por asistencia, por
calificado, por cliente— no existían en ninguna pantalla. Y quedaron dos discrepancias sin
reconciliar: el mismo CAC dicho como 630 y como 741.

El análisis **no se cayó por falta de inteligencia: casi se cae dos veces por falta de
higiene de datos** — un «histórico» sin fecha de inicio y un gráfico que ignoraba el filtro
aplicado. Los dos se encontraron por accidente.

---

## El paso que salva el análisis, y va primero

**Sumá las partes y fijate si dan el total.**

El «histórico» del dashboard arrancaba en noviembre del año anterior sin decirlo. Al
partirlo mes a mes:

| | con el histórico sucio | corregido |
|---|---|---|
| Agendas | 76 | **57** |
| Cierres | 12 | **9** |
| Costo por agenda | 99,53 | **132** |
| CAC por cliente | 630 | **840** |

Todos los costos unitarios estaban **~33% abajo**, y siempre para abajo — la dirección que
no hace sospechar, porque hace que la inversión parezca haber rendido más.

**Eso no es una intuición: es una aserción, y un agente la puede correr siempre.** Vive en
`cuadratura()`. Se compara lo agregado contra un `count` exacto que pide la base por su
cuenta —no es circular— así que además caza el truncado silencioso de PostgREST en nuestras
propias lecturas.

> **La regla:** ninguna métrica puede existir como un «histórico» cuya fecha de inicio no se
> vea. Todo número declara su rango, arriba y a la vista.

---

## La secuencia

Es el orden en que se pregunta, y **el orden es el argumento**: un informe que arranca por
los creativos invita a optimizar el anuncio cuando el agujero está en el show rate.

### 1 · La cascada

`inversión → agendas → asistencias → calificados → cierres`, con el **costo de cada
escalón**, no solo el CAC final. Lo que muestra es *en qué eslabón se dispara el costo*.

En la reunión: 132 la agenda, 182 la asistencia, 840 el cliente. El salto de 132 a 840 es
el diagnóstico entero.

### 2 · Los que asistieron y no calificaban

**21 de 41.** Más de la mitad de las llamadas pagadas eran con gente que no podía comprar.
Fue la sorpresa de la tarde y **el dato ya estaba en la base sin que nadie lo mirara**
(`calificado` + las cinco respuestas del formulario de Calendly).

Es la fuga más barata de tapar del embudo entero: no requiere gastar más ni cerrar mejor,
solo dejar de traer a quien no califica.

⚠️ `calificado` es **tri-estado**. Medido en el ws1 al 03/09/2026: de 56 asistentes, 27
calificados, 3 no calificados y **26 sin marcar**. Contar los NULL como «no calificaba»
inventa una fuga que no existe; contarlos como calificado la esconde. Van los tres números
separados, siempre.

### 3 · Los creativos, en DOS rankings

**Y no es cosmético.** Dos creativos de abril trajeron **3 agendas cada uno**: uno a 22 USD
y otro a 100. Por cantidad empatan; por costo son 4,5x distintos. El ranking que ordena por
volumen y solo desempata por costo **esconde al ganador real** — y el de esa tanda nunca se
replicó (*«de ese no hice réplica»*), que era la acción más barata disponible.

Por eso hay un tercer bloque, `creativosEscondidos()`: baratos con poco volumen, que son
los candidatos a replicar. En la reunión ese hallazgo salió de recorrer anuncios uno por
uno durante 20 minutos.

El otro corte del mismo eje, que dio el mejor insight de la reunión: **abril, 6 creativos →
16 agendas; mayo-junio, 98 creativos → 26 agendas.** La palanca que estaban empujando (más
volumen de piezas) no era la palanca.

### 4 · El plan inverso, con su chequeo de consistencia

Desde la meta de cierres hacia atrás, **con las tasas medidas y no con las deseadas**:
cierres → asistencias → agendas → inversión.

⚠️ **Lo que faltó en la reunión:** se fijaron 1.500 USD/mes (derivado de «3 cierres × 500
de CAC objetivo») y **al mismo tiempo** 27 agendas/mes — pero 27 agendas al costo real de
~100 USD cuestan 2.700. Las dos mitades del mismo plan no podían ser ciertas a la vez y
**la contradicción se fue viva en el acuerdo**. Ahora se marca, y se ofrecen las tres
salidas: subir el presupuesto, bajar la meta, o abaratar la agenda primero. Son decisiones
distintas.

---

## Las dos fuentes de «agenda» no son la misma, y no se mezclan

| | Fuente | Para qué |
|---|---|---|
| **Cascada** | `leads.fecha_agenda` (CRM) | las reuniones que de verdad se pactaron |
| **Ranking de creativos** | `marketing_metrics_daily.agendas_meta` (píxel de Meta) | la única fuente que sabe **qué anuncio trajo qué** |

Medido en el ws1: **Meta se atribuye 152 agendas y el CRM tiene 114** — 33% de diferencia.
Usar el número de Meta en la cascada daría un costo por agenda 33% optimista.

Y al revés no se puede: **de 114 agendados, 9 traen `meta_ad_id`.** Los 933 leads que sí lo
traen son del formulario instantáneo, que es otro camino y no agenda. Los que agendan entran
por Calendly y pierden la atribución.

> **La regla:** cuando dos fuentes miden lo mismo con métodos distintos, cada mitad usa la
> suya y el reporte dice cuál usó. Fundirlas produce un número que no es de ninguna de las
> dos.

---

## Lo que NO se puede automatizar, y por qué

**Huecos de datos** (se arreglan cargando, no programando):

- **El benchmark.** *«¿45% de no-show es alto comparado con qué?»* no tiene respuesta en
  ninguna base. Se contestó con lo que Martín escucha de otros infoproductores. Hasta que no
  se guarde **la serie histórica de las propias mediciones**, cada reunión compara contra un
  recuerdo — y ya pasó: el CAC anterior se citó de memoria como «300 y tanto» y como 425.
- **El flag «ya le hice réplica»** de un creativo ganador. No existe como campo.
- **Los cierres excluidos** por ser «círculos rojos»: criterio manual sin campo que lo
  sostenga. El mes que viene nadie va a saber por qué el número era 12 y no 14.
- **Por qué compraron los que compraron**: vive en un formulario anónimo externo.

**Juicio humano de verdad** (no es un hueco: es lo que justifica que la reunión exista):

- **Declarar qué mes está fuera de patrón.** Mauricio sacó junio diciendo *«algo pasó mal
  ahí, estoy seguro»* — sabía algo que ningún dato mostraba. Un agente puede *proponer*
  candidatos (gasto a 2 desvíos con resultado bajo la mediana); firmar la exclusión es del
  dueño. Y la exclusión se aplica **al numerador y al denominador a la vez**: si se saca el
  gasto de un mes, se sacan sus agendas.
- **Elegir la meta.** Que sean 3 cierres y no 4, que el precio se mantenga, que el objetivo
  sea bajar el no-show y no subir el presupuesto.
- **Saber que mayo-junio mezcló dos cambios de metodología a la vez** — eso vuelve ilegible
  el 80% de los creativos producidos, y solo lo sabe quien los hizo.

---

## Lo que quedó sin hacer

- **Marcar cuándo cambió algo en la operación** (metodología, formato, presupuesto) para
  poder leer los períodos como experimentos y no como un continuo. Sin eso, un tramo con dos
  cambios simultáneos es dato inutilizable.
- **Guardar el objetivo del período** y contrastarlo contra lo ejecutado. El diagnóstico
  causal que Mauricio pide —*«si se hicieron los creativos y no hubo agendas, ¿el problema
  son los creativos?»*— es imposible de contestar el mes que viene porque no queda registro
  de qué se había comprometido. Cada reunión reconstruye el objetivo desde cero.
- **Guardar la serie de las propias mediciones** (CAC, costo por agenda, no-show, con
  fecha). Es el único benchmark honesto que el negocio puede tener.
- **Excluir un mes o un lead de forma que persista**, aplicándose a las dos puntas del
  cociente.
- **El paso 1 del método** («¿de dónde vienen las agendas de esta semana?») sigue sin poder
  contestarse: es la atribución lead→anuncio, y hoy llega al 8% de los agendados.
