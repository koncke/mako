# Templates del Dashboard: la propuesta (1/11/2026)

Martín: *«Quiero que se parezcan a esos, que tengan el mismo diseño… Lo importante es que se rediseñe el
CONTENIDO de los bloques de nuestros templates a los nuevos de codeandchill. Porque ya no sería "foco de la
semana" solo sería "focus" con otras cosas»*.

Leí **nueve demos en vivo** de `demo.codeandchill.store` (Pane, Kestrel, Rapport, Coffer, Parley, Murmura,
Noria, Mender, Kairo, Halden, Fernly, Lumora) bloque por bloque. Esto es lo que encontré y lo que propongo.

---

## 1. Lo que ellos hacen y nosotros no

No es la paleta ni la grilla. Son ocho reglas de CONTENIDO, y las cumplen las doce sin excepción.

**1. Abren con una FRASE que dice qué pasa hoy, no con un gráfico.**
- Pane: «Good morning, Lin — Friday, October 30 · **4 meetings and 6 tasks left today**»
- Noria: «**117 runs since midnight. 8 failed runs need a look.** The flows have saved the desk 17 h today»
- Lumora: «**You have 3 lessons today and 87 pieces to mark.** Heron 9's register isn't taken yet»

Nosotros abrimos con un panel. Ésta es la diferencia más grande, y es gratis: es texto.

**2. Al lado de esa frase van una o dos acciones, no un menú.** «New task» + «Next: 11:00 AM». «Import leads»
+ «New deal». «Take register · Heron 9» — la acción NOMBRA lo que falta.

**3. Cada bloque tiene título Y un subtítulo en castellano llano.** «Close your rings». «The island keeps the
time». «Due today and late». «Money in above the line, money out below, tax left out». «Failed runs nobody has
handled yet». Los nuestros tienen título solo, y por eso parecen un reporte en vez de una pantalla que te habla.

**4. Ningún número va solo: lleva su comparación y su meta.**
Halden: «$150.1k · 18% up on last quarter · **75% of the $200k goal · $49.9k to go**».
Rapport: «47% of Q4 quota · **Needs $4.1K a day to land it**». Kairo: «**At this pace you reach it in March 2027**».

**5. TODAS tienen un bloque «esto te está esperando», con el botón al lado.**
«Needs chasing» (Coffer) · «Needs a look» (Noria) · «Needs you 6» (Murmura) · «Assist · 6 at risk» (Halden) ·
«Wren's watch list» (Lumora). Es el bloque que convierte un informe en una herramienta. **No tenemos ninguno.**

**6. Todas tienen una tira de actividad reciente.** «Latest», «Recent activity», «Just finished».

**7. Los recortes de tiempo viven DENTRO del bloque**, no en un filtro global: 6M/12M, 30d/7d, Today/7/30 días,
Day on day/Week on week, Scores/Attendance.

**8. Hay widgets que se usan, no que se miran.** El temporizador de foco (Pane, Fernly), los anillos, las barras
de etapa que se tocan.

---

## 2. El mapa: de qué referencia sale cada template nuestro

| Nuestro | Referencia | Por qué |
|---|---|---|
| **Focus** (hoy «Foco de la semana») | **Pane** | El temporizador en cápsula, los anillos del día, «lo que viene» |
| Comercial · CRM y pipeline | **Rapport** + **Halden** | Mezcla de etapas con plata, hot deals, cuota y «lo que se puede escapar» |
| Marketing · Ads Analyst | **Kestrel** | Seis KPI con su delta, tabla de leads con CALIDAD, bloque por red |
| Cobranza | **Coffer** | Tramos de vencimiento, «a quién perseguir», días promedio de cobro |
| Chat Analyst | **Parley** | Mensajes por mes contestados/sin contestar, mezcla de canales, top contactos |
| Contenido e IA · Instagram | **Murmura** | Cola de publicaciones, «necesita tu aprobación», top post, la semana |
| Automatizaciones | **Noria** | Corridas, las que fallaron sin atender, fiabilidad por flujo, **horas ahorradas** |
| CS Analyst | **Mender** | Casos por carril con el tiempo de espera, salud (primera respuesta, SLA) |
| Ventas · suscripción | **Kairo** | MRR con sus MOVIMIENTOS (nuevo, expansión, churn), meta con fecha estimada |
| Productividad | **Fernly** | Time tracker, progreso por proyecto, colaboración del equipo |
| Curso o comunidad | **Lumora** | El día como tira horaria, entregas, rendimiento por clase, lista de atención |

---

## 3. Focus, bloque por bloque (el primero, el que nombró Martín)

Deja de llamarse «Foco de la semana». Se llama **Focus** y es el día, no la semana.

| # | Bloque | Subtítulo | Qué muestra | De dónde sale |
|---|---|---|---|---|
| 1 | **El saludo** | — | «Buen día, Martín · Hoy tenés 3 llamadas y 6 tareas» + botones «Nueva tarea» y «Próxima: 11:00» | Calendario + Plan |
| 2 | Tres tiles | — | Hecho hoy `2/8` · Foco hoy `1,1 h` · Vencidas `0` | Plan |
| 3 | **Hoy** | «Cerrá los anillos» | Tres anillos: tareas, foco, llamadas, cada uno contra su meta | Plan + Calendario |
| 4 | **Lo que viene** | «Tu día, de acá a la noche» | La próxima llamada con «en 20 min» y botón de entrar, después el resto | Calendario |
| 5 | **Foco** ⭐ | «La cápsula lleva el tiempo» | **Temporizador 15/25/50 min**, elegís sobre qué tarea, «Enfocado hoy: 1,1 h · 2 sesiones» | NUEVO |
| 6 | Mis tareas | «De hoy y atrasadas» | Lista con proyecto, vencimiento y prioridad | Plan |
| 7 | La semana | «Lo que cerró el equipo» | `25` cerradas · −4% vs la semana pasada + barras lun-dom | Plan |
| 8 | Proyectos | — | Estado, vencimiento, % y quiénes | Plan |
| 9 | **Ahora mismo** | «Quién está en qué» | Presencia del equipo: en foco hasta, en reunión, en línea | Equipo |

⭐ El bloque 5 **no existe hoy** y es el que pidió Martín. Es un widget con estado propio, no un gráfico.

---

## 4. Lo que hay que construir que hoy no existe

1. **El temporizador de foco.** Widget con estado: presets, tarea elegida, sesiones acumuladas del día.
2. **El bloque «te está esperando».** Un tipo de bloque nuevo: lista de cosas rotas + el botón que las arregla.
   Sirve para los once templates, no sólo para uno.
3. **El subtítulo de bloque.** Hoy el modelo no lo tiene. Es un campo de texto, pero cambia el tono de todo.
4. **La frase de apertura.** Un bloque de texto que se arma con los datos del día.
5. **Los recortes dentro del bloque** (6M/12M, 7d/30d) en vez del filtro global.

---

## 5. Lo que queda por decidir

- **Cuáles de los 13 actuales se matan.** VSL Analyst, Chat Analyst y Contenido e IA tienen los 9 bloques en la
  MISMA posición y tamaño; Curso comparte las tres primeras filas. Son cuatro tarjetas iguales en la galería.
- **Si se puede cambiar la plantilla de una hoja ya creada.** Hoy no se puede: el panel «Estilo de la hoja»
  escribe un solo campo (`hoja.tema`, que es color y tipografía). La feature existe en la ficha del CRM.

---

## 6. LAS DECISIONES DE MARTÍN (1/11/2026, eligiendo referencia por referencia)

**El criterio que ordenó todo, y lo trajo él:** las referencias son APLICACIONES de varias páginas, y
nuestro Dashboard es **para mirar datos, no para trabajar**. *«No sé qué tan bueno sea poner tabs dentro de
los templates del dashboard, y menos si son tabs funcionales, cuando dashboard dentro de MaKo está pensado
para data… no para usarse activamente como el CRM.»*

→ **De cada referencia se toman SÓLO las páginas que INFORMAN.** Las que dejan trabajar ya son tabs de MaKo
y duplicarlas sería tener dos CRMs. Medido: Halden tiene 5 páginas y sólo 2 informan (Dashboard y Reports);
Lintel tiene 6 y sólo informa Overview.

→ **Consecuencia práctica:** una referencia-aplicación da 1 hoja; una referencia-informe (Meridian, Fathom,
Orrery, Corvane, Prism, Kestrel) da 3 o 4. La variedad sale más barata de las segundas.

**Y la pregunta que desarmó cuatro hojas.** Martín: *«¿cuál sería la diferencia entre este template y el de
Comercial?»*. No la había: cuatro hojas prometen el funnel y tres prometen lo cobrado — Comercial y Ventas
del mes son casi la misma oración. Lo que las separa no es el diseño sino **la unidad y la pregunta**:
CRM mira una PERSONA (¿a quién llamo?), Comercial mira una TASA (¿convierte, y a qué costo?), Cobranza mira
una CUOTA. Donde no hay pregunta distinta, no hay hoja.

### Aprobado

| Hoja | Referencias | Notas |
|---|---|---|
| **Focus** | **Pane** + **Lumora** | Pane trae el temporizador en cápsula; Lumora la tira del día con la línea del «ahora» |
| **Comercial** | **Coffer · Corbel · Prism · Orvel · Pelago · Selvar** | Absorbe el pipeline. Kairo rechazado |

### Eliminadas

- **CRM y pipeline** — *«no tiene sentido si ya lo resuelve Comercial»*.
- **Ventas del mes** — su frase es casi idéntica a la de Comercial.

### Reglas que valen para todas

1. **Adaptar a los datos que tenemos, o sumarle mediciones nuevas a MaKo.** Una referencia no se copia con
   sus métricas: se copia con las nuestras.
2. **Un template tiene que servirle a CUALQUIER funnel.** Se resuelve hoja por hoja al final.
3. ⭐ **Idea nueva, de Martín: templates por RUBRO, no sólo por función.** Lintel (inmobiliaria) no lo cubre
   ningún template nuestro y ya tenemos ese cliente (ws 13). La mayoría por función, unas pocas por rubro.

---

# 7. LAS DECISIONES, TOMADAS (1/11/2026) — 27 demos leídos bloque por bloque

Martín: *«ya entendiste lo que quiero hacer… quisiera que avances tú, tomes todas las decisiones»*.

## 7.1 El hallazgo que resuelve lo de las tabs

Corbel hace algo que ninguna otra: **cada KPI termina en un link al lugar donde se trabaja ese número**
(`Ver órdenes`, `Ver analytics`, `Ver productos`, `Ver funnel`). El tablero informa y **manda**; no es un
callejón sin salida ni una copia del CRM.

**Esa es la respuesta a la pregunta de Martín.** El Dashboard no necesita tabs adentro: necesita que cada
bloque sepa a qué tab de MaKo te lleva. Un bloque, un destino. Va en TODAS las hojas.

## 7.2 Los doce gestos que se copian, y de dónde salen

Ninguna referencia es de un negocio de ticket alto —son retail, SaaS, finanzas personales, una cervecería—.
Lo que se copia no es el negocio: es el GESTO. Estos doce aparecen una y otra vez y son los que hacen que
esas pantallas se sientan vivas:

1. **La oración de apertura con los pendientes del día.** Orvel: «entraron €3.445 ayer, 9 facturas esperan tu
   aprobación y 14 pagos hay que archivar». Tres hechos, uno accionable.
2. **El número traducido a SU unidad.** Hearth: «faltan $5M — unos 12 préstamos promedio». Talvo: «2 nóminas
   en los próximos 30 días». Ledge: «me duran 2 días, la reposición llega en 8».
3. **El bloque «te está esperando»**, con el motivo al lado y el botón que lo resuelve. Orvel, Moorly,
   Murmura, Noria, Coffer. **Ninguna de nuestras 20 hojas lo tiene.**
4. **Un puntaje con veredicto en palabras y el porqué.** Corbel: «86 · Adelantado al plan — lo online hizo casi
   todo el trabajo», con botón «Mejorá tu puntaje». Sunrow: «Confianza de entrega 75/100» + un insight.
5. **La fórmula explicada en el subtítulo**, no en un tooltip. Ledge: «Sell-through = vendido ÷ (vendido + queda)».
6. **Barras con marca de meta y el veredicto escrito.** Prism: «6,0×, por encima de la meta».
7. **Cohortes de retención M0…M5** y **«por qué se van»** con los motivos contados. Vitrea.
8. **A/B con nivel de confianza y botón «Aplicar ganador».** Vitrea: «Confianza 99,9% · +21,3%».
9. **Cronómetro corriendo** sobre lo que se está haciendo. Torque (por bahía), Pane y Lumora (el foco).
10. **La tarjeta que avisa que NO obedece al filtro de fecha.** Prism: «Vista larga · no filtrada por rango».
    Honestidad del dato: dice cuándo el número no es del período que elegiste.
11. **El error escrito como instrucción.** Corvane: «£704,85 volvió — cuenta cerrada. Confirmá sus datos
    bancarios y reintentá», con el botón al lado.
12. **El feed de actividad con quién lo hizo**, incluidos los que no son personas (Wharf: `Sistema`, `Mensajería`).

## 7.3 El set final: 20 hojas, 4 nuevas, 3 muertas

| Hoja | Referencias | La pregunta que contesta |
|---|---|---|
| **Focus** | Pane · Lumora | ¿en qué estoy ahora y qué me queda hoy? |
| **General** | Orvel · Corbel | ¿cómo viene el negocio y qué me está esperando? |
| **Operación diaria** | Moorly · Torque | ¿qué está vencido y a quién llamo? |
| **Comercial** | Coffer · Corbel · Prism · Orvel · Pelago · Selvar | ¿convierte, y a qué costo? |
| **Cobranza** | Coffer · Corvane · Talvo | ¿qué plata está prometida y no entró? |
| **Marketing** | Kestrel · Ondra | ¿cuánto cuesta una agenda y de qué anuncio vino? |
| ⭐ **Anuncio ganador** (NUEVA) | Vitrea · Prism | ¿cuál creativo gana, y con cuánta confianza? |
| ⭐ **Hooks y retención** (NUEVA) | Vitrea · Murmura | ¿en qué segundo se van, y qué hook los retuvo? |
| **Landing** | Corbel · Kestrel | ¿hasta dónde bajan y dónde hacen clic? |
| ⭐ **VSL y YouTube** (NUEVA, unifica VSL Analyst) | misma forma que Hooks, otra fuente | ¿quién llega al final y ésos compran más? |
| **Instagram y redes** | Murmura · Kestrel | ¿qué publicación trajo gente de verdad? |
| **Chat Analyst** | Parley · Tend | ¿cuánto tardamos en contestar y eso cierra? |
| **Closing** | Halden · Moorly · Tandem | ¿por qué se cerró o no, y quién cierra mejor? |
| **Automatizaciones** | Noria | ¿qué corrió, qué falló y cuántas horas ahorró? |
| **CS Analyst** | Mender · Vitrea | ¿quién necesita atención y por qué se van? |
| **Agencia o servicio** | Sunrow · Torque | ¿cada cliente va en fecha? |
| **Curso o comunidad** | Lumora · Vitrea | ¿cuántos siguen ahí al mes 3? |
| **Productividad** | Fernly · Sunrow | ¿qué avanza y qué se estancó? |
| **Contenido e IA** | Orrery | ¿cuánta IA gastamos y en qué? |
| ⭐ **Inmobiliaria** (NUEVA, por RUBRO) | Lintel | — para el cliente de ws 13 |

**Muertas:** CRM y pipeline (lo resuelve Comercial) · Ventas del mes (misma frase que Comercial) ·
Ads Analyst (se parte en «Anuncio ganador» y «Hooks y retención», que es lo que de verdad hacía).

## 7.3.1 Lo que falta copiar (4/11/2026)

Martín, mirando producción: *«elimina todos los templates viejos y vamos de a poco cargando cuando ya estén… y claro, guarda los
que debemos hacer aún»*. **«Nueva hoja» ofrece sólo la plantilla que ya tiene su diseño propio copiado** (`esPlantillaOfrecida`,
lib/graficos-plantillas.ts): una hoja entra sola a la lista el día que su plantilla trae el diseño. Las de la base común siguen en el
código (las hojas que ya existen no cambian) y no se ofrecen. Esta tabla es la lista de lo que falta; la pantalla no la muestra.

Todas las referencias están medidas (capturas a 1440 y 390, `valores.json`, los estados de cada control y el INFORME de la entrada):
`docs/diseno/mockups-dashboard/demos/<demo>/`.

| Hoja | Referencia | Estado |
|---|---|---|
| **Closing** | Halden | **Se ofrece.** En producción desde el 4/11 (copia: `docs/diseno/mockups-dashboard/closing/`) |
| **Cobranza** | Coffer | **Se ofrece** desde el 4/11 (copia: `docs/diseno/mockups-dashboard/cobranza/`; el componente, `app/dashboard/disenos/HojaCobranza.tsx`) |
| **Focus** | Pane · Lumora | **Pane: se ofrece en General** desde el 4/11 (copia: `docs/diseno/mockups-dashboard/focus-pane/`; el componente, `app/dashboard/disenos/HojaFocus.tsx`). **Lumora: se ofrece en General como «Mi día»** (`mi-dia`) desde el 4/11, en producción (copia y adaptación: `docs/diseno/mockups-dashboard/focus-lumora/`; el componente, `app/dashboard/disenos/HojaMiDia.tsx`) |
| **General** | Orvel · Corbel | **Orvel: se ofrece en General como «General»** desde el 4/11, en producción (copia y adaptación: `docs/diseno/mockups-dashboard/general-orvel/`; el componente, `app/dashboard/disenos/HojaGeneral.tsx`). Corbel: por copiar |
| **Operación diaria** | Moorly · Torque | **Moorly: se ofrece en General como «Operación diaria»** (`operacion`) desde el 4/11, en producción (copia y adaptación: `docs/diseno/mockups-dashboard/operacion-moorly/`; el componente, `app/dashboard/disenos/HojaOperacion.tsx`). Torque: por copiar |
| **Comercial** | Coffer · Corbel · Prism · Orvel · Pelago · Selvar | **Selvar: se ofrece** desde el 4/11, en producción (copia y adaptación: `docs/diseno/mockups-dashboard/comercial-selvar/`; el componente, `app/dashboard/disenos/HojaComercial.tsx`). Las demás referencias: por copiar |
| **Marketing** | Kestrel · Ondra | **Kestrel: se ofrece** desde el 4/11, en producción (copia y adaptación: `docs/diseno/mockups-dashboard/marketing-kestrel/`; el componente, `app/dashboard/disenos/HojaMarketing.tsx`). Ondra: por copiar |
| **Anuncio ganador** | Vitrea · Prism | Por copiar (pide la confianza de un A/B, §7.4) |
| **Hooks y retención** | Vitrea · Murmura | Por copiar (pide la retención por segundo, §7.4) |
| **Landing** | Corbel · Kestrel | **Corbel: se ofrece** desde el 4/11, en `punta/dash-landing` (copia y adaptación: `docs/diseno/mockups-dashboard/landing-corbel/`; el componente, `app/dashboard/disenos/HojaLanding.tsx`). Kestrel: por copiar |
| **VSL y YouTube** | la forma de Hooks, otra fuente | Por copiar (sin referencia propia: la de Hooks) |
| **Instagram y redes** | Murmura · Kestrel | Por copiar |
| **Chat Analyst** | Parley · Tend | Por copiar |
| **Automatizaciones** | Noria | Por copiar |
| **CS Analyst** | Mender · Vitrea | Por copiar (pide las cohortes y los motivos de baja, §7.4) |
| **Agencia o servicio** | Sunrow · Torque | Por copiar |
| **Curso o comunidad** | Lumora · Vitrea | Por copiar (pide las cohortes, §7.4) |
| **Productividad** | Fernly · Sunrow | Por copiar |
| **Contenido e IA** | Orrery | Por copiar |
| **Inmobiliaria** | Lintel | Por copiar |

## 7.4 Lo que hay que MEDIR y hoy MaKo no mide

Sin esto, las hojas nuevas nacen vacías:
1. **Retención por segundo del video** (hook rate y curva de abandono) — para Hooks y para VSL/YouTube.
2. **Confianza estadística de una prueba A/B** entre dos creativos — para Anuncio ganador.
3. **Cohortes de permanencia M0…M5** — para Curso y para CS.
4. **Motivos de baja contados** («por qué se van») — para CS.
5. **Alcance y CTR antes del clic** — Marketing hoy arranca en el gasto.
6. **Tiempo de foco por tarea** — para el temporizador de Focus.
