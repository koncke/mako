# Relevo — las hojas del Dashboard (4/11/2026, chat en la nube)

## ⛔ LO PRIMERO: Martín rechazó las 20 hojas (4/11/2026, por el Cerebro)

Textual: *«Me dijiste que me dejaste los 20 dashboard ahí y son dashboard todos iguales, horribles, que no era la idea que yo
quiero. Recuerda lo que habíamos empezado a hacer en donde habíamos empezado a hacer el dashboard de Focus, hicimos de manera
muy personalizada sobre todo copiando lo que tiene la otra página, y ahora lo que hiciste fue agarrar un template y
estandarizarlo para todos. Eso no me gusta. Quiero hacerlo de manera muy personalizada, cada dashboard. Te pido por favor que
sea de esa manera y que te centres en que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después
la adaptación con Maco. Es decir, tienes que buscar entre todos los dashboards que vamos a copiar ver cuál se adapta más al
template que queremos crear, por ejemplo de Closing Analysis, agarrar ese y agarrar elementos, sacar otros, etcétera. Pero
copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic, copiarlo absolutamente
todo. Esa era la idea.»*

**Lo que cambia** (las instrucciones del Cerebro):
1. **Nada de una base común que se repite.** Cada hoja es su propio diseño: su maqueta, sus gráficos, sus proporciones, su
   ritmo. Se comparten utilidades de datos, no la apariencia.
2. **Primero la copia exacta, después la adaptación.** Para cada hoja se elige el demo que mejor calza y se replica tal cual
   (letra, espaciados, colores, sombras, radios, grilla, tamaños). Recién después se cambian datos y textos, y se sacan o se
   agregan piezas, con los datos reales de MaKo.
3. **Se copian las animaciones**: entrada, hover y clic, con sus tiempos y curvas, y el comportamiento (tooltips, filtros,
   transiciones entre estados). Se miden en el demo real, sin inventar.
4. **El molde es Focus**: la maqueta original (`docs/diseno/mockups-dashboard/focus-pane.html`, commit `ee224623`), no las
   hojas de la base.
5. **Una hoja por vez**, empezando por Closing, con la copia al lado del original captura contra captura. Nunca en cadena.
6. Las 20 actuales se quedan hasta que cada una tenga su reemplazo, y una hoja que alguien ya creó no cambia sola.

## Closing: la copia de Halden y su adaptación (4/11/2026, 11:45 UTC)

Las medidas las tomó la PC (`punta/dash-demos-closing`, `690eb4cdb`, ya en `main`): `docs/diseno/mockups-dashboard/demos/
<demo>/` con el INFORME de la entrada, las capturas a 1440 y 390, `valores.json` y los estados de cada control. **Sin código de
la tienda en el repo**: lo nuestro está escrito desde esos valores, esas capturas y esas recetas.

### La referencia: Halden (la raíz «Dashboard»)

Mirando las cuatro capturas lado a lado (`demos/<demo>/captura/pagina-1440.png`):
- **Halden** es un tablero de ventas y cada bloque tiene su par en Closing: lo ganado con su meta → la tasa de cierre; el
  pipeline en tramos → cómo terminaron las llamadas; las barras de la semana con lo que viene rayado → las llamadas hechas y las
  agendadas; los «hot deals» → las últimas llamadas; «Next up» → la próxima llamada; la cuota de cada vendedor → la tasa de cada
  closer; «Assist» → lo que ve MaKo en las que no cerraron; el reloj de la sesión → la duración promedio. **Es la elegida.**
- **Tandem** es la ficha de UN lead (su puntaje en anillo, su contacto, su secuencia): sirve para la ficha, no para un tablero.
- **Moorly** es un portal de seguros: su forma (cuatro números con gráfico chico, una curva grande, listas) no habla de llamadas.
- **Selvar** queda para Cobranza y las cuotas, como proponía el Cerebro: su barra de la cuota con «el ritmo de hoy» y su carrera
  de vendedores calzan ahí.

### Paso 1: la copia exacta, sin adaptar

`docs/diseno/mockups-dashboard/closing/copia.html` (con `closing.css` y `closing.js`), con los textos del demo a propósito, para
compararla. Para verla: servir `docs/diseno/mockups-dashboard` (`python -m http.server 4900`) y abrir `closing/copia.html`.

**La comparación, captura contra captura:**

| | El original | La copia |
|---|---|---|
| Computadora | `demos/halden/captura/pagina-1440.png` (1440×959) | `closing/captura/copia-1440.png` (1440×959) |
| Teléfono | `demos/halden/captura/pagina-390.png` (390×2627) | `closing/captura/copia-390.png` (390×2627) |

- **Las páginas miden lo mismo**, y cada bloque cae a 0-2 px del original. Se midió por franjas de tinta dentro de cada
  tarjeta (dónde empieza y termina cada renglón), no a ojo: el título, las cifras, la barra de la meta, los tres números de
  la derecha, el embudo y su leyenda, las barras con su etiqueta, cada fila de las listas, la cuota, el asistente y el reloj.
- **La grilla es la de Halden:** 12 columnas con gap 14 (7+5 arriba, 5+4+3 abajo) y margen 22; tarjetas de radio 18 con un
  filete de 1 px por dentro; Manrope.
- **El bloque oscuro**, medido pixel a pixel: el resplandor arriba a la derecha (un óvalo de 420×205 que va de `#156d77` a
  `#0a3338`) y la cuadrícula de 28 px, que se ve más hacia la derecha.
- **En el teléfono**, el orden de Halden (lo ganado, el embudo, la próxima, las barras, la lista, el asistente, la cuota, el
  reloj), la lista con 5 filas y el asistente con 3 (en la computadora no entran) y la barra de abajo.

**El movimiento, de la receta del INFORME** (en `closing.js`, con sus tiempos y curvas): las tarjetas entran juntas
escalonadas, las cifras cuentan desde cero, la meta y el embudo crecen, las barras suben una por una y su etiqueta aparece
después con un rebote, la leyenda, las filas y el asistente entran escalonados. Al pasar el cursor: la flecha del bloque oscuro
gira 45° y se llena, las barras se aclaran, los botones cambian de fondo; la etiqueta sigue a la barra que se señala; el reloj
rueda sus dígitos.

**Lo que NO se pudo copiar, y no se inventó:**
- **Cómo entra el título:** la función que lo hace (`bo`) no está en el INFORME. Entra letra por letra con `io`, el único
  helper de título de la librería de Halden. Es una inferencia hasta medir `bo`.
- **Lo que pasa después de los 0,75 s:** el INFORME corta la línea de tiempo ahí. La cuota y el reloj no tienen una entrada
  medida (el reloj arranca en 00:00:00 y rueda al primer segundo, como el demo).
- **A qué se le aplica el hover que sube 4 px** (`[data-lift]`): está la receta, no los elementos. No se aplicó a nada.
- **El cambio de tema y los menús** de la barra de arriba: no son de la hoja.
- La entrada de la barra de arriba (`yd`) también está cortada en el INFORME.

### Paso 2: la adaptación a MaKo

`docs/diseno/mockups-dashboard/closing/closing.html`, con la MISMA hoja y el mismo movimiento. Capturas:
`closing/captura/mako-1440.png` y `mako-390.png`. Los números y los nombres son de ejemplo. Sin la barra de arriba: en MaKo la
pone el Dashboard.

| Halden | Closing | De dónde sale en MaKo |
|---|---|---|
| Revenue won + meta + win rate, avg deal, deals won | **Tasa de cierre este mes** (el ancla), su diferencia con el mes anterior, «11 de 29 llamadas terminaron en venta» y a la derecha analizadas, score y duración | `llamadas_venta`: `tasa_cierre` (comparada), `ganadas`, `llamadas`, `puntaje`, `duracion` |
| Open pipeline en tramos | **Cómo terminaron:** cerró en la 1.ª, cerró en la 2.ª, sin decisión, perdida | `ganadas − ganadas_r2`, `ganadas_r2`, el resto, `perdidas` |
| Revenue this week (cerrado y rayado lo que viene) | **Llamadas de esta semana:** hechas por día y, rayadas, las agendadas | `llamadas_venta` por día · `leads`: agendas por fecha de agenda |
| Hot deals | **Últimas llamadas:** el lead, 1.ª o 2.ª, cómo terminó, el closer, el score y cuánto duró | `llamadas_venta` por llamada |
| Next up + Join call | **Próxima llamada** con «Entrar a la llamada» | la agenda (el link de la reunión) |
| Quota this quarter (con «You») | **Tasa de cierre por closer**, «5 de 11» y «Tú» para quien mira | `llamadas_venta` por closer |
| Assist | **Qué decide tus cierres:** lo que se repite en las que no cerraron | la caja de IA `cl-factores-ia` (el closer la lee por ese id) |
| Call session (el reloj y tres botones) | **Duración promedio** con el mismo reloj; los botones se cambian por la duración de las ganadas contra la de las perdidas | `duracion`, partida por desenlace |

Se sacó: la barra de arriba de Halden, el buscador, las pestañas y los tres botones de la sesión. Se agregó: el tramo rosa de
«Perdida» (Halden no tiene uno: sus tramos son todos abiertos).

### Lo que falta para que esté en producción

La copia y la adaptación son maquetas: **producción todavía muestra la hoja Closing de antes** (la del rechazo). Falta llevar
este diseño al Dashboard con los datos reales: que una hoja nacida de la plantilla Closing se dibuje con su propio diseño (su
CSS y su movimiento, sólo de ella) leyendo los mismos componentes de siempre, y sumar las dos lecturas que hoy no existen en
la hoja (las agendadas de la semana y la próxima llamada). Va en su propia punta.

---

## Lo que se hizo antes del rechazo (sigue en producción hasta que cada hoja tenga su reemplazo)

Martín, textual: *«Haz todo lo de los dashboards, habiamos quedado que lo haces tu y luego me envias todo para yo
aprobarlas, pero subelas a producción directo y los reviso allí. Y no solo 4, haz todo...»*.

Cada hoja es UNA punta, `punta/dash-<hoja>`, encima de `origin/main`, y llega sola a `main` si da verde. Se subieron
**en cadena** (cada punta lleva a las anteriores): todas tocan las mismas listas (`PORTADAS_GENERAL`, `portadasDashboard`,
los colores) en líneas vecinas, y en paralelo chocaban al mezclar main. La base de todas fue `punta/dash-base` (en `main`
desde el 4/11, 07:39 UTC). Lo aprendido, en [hallazgos-templates-dashboard.md](../hallazgos-templates-dashboard.md) §10.

## Dónde mirarlas

**`/dashboard` → «Nueva hoja»**: la galería muestra las 20 juntas (las de General primero). Elegir una arma la hoja en
tu informe; borrarla no toca nada más. Una hoja que ya habías creado antes desde una plantilla **no cambia**: la plantilla
sólo arma hojas nuevas. Para ver la versión nueva de una que ya tienes, se crea otra vez desde «Nueva hoja».

Lo que comparten todas:

- **Abren con una frase** que dice lo que pasa en una línea, con los números del negocio resaltados. Un tramo cuyo número
  no se pudo leer no se dibuja (nunca «falta»).
- **Al pie de un bloque, «Ver … →»** lleva a la pantalla donde eso se trabaja (CRM, Clients, Ads Manager…).
- **Un número oscuro por fila, el ancla**: el que contesta la pregunta de la hoja.
- **Los paneles conservan su subtítulo** en castellano llano; los números no (les come el alto).
- **En el teléfono** la frase va arriba, como texto.

## Las 20 hojas

| Hoja | Id | Referencias | La pregunta | El ancla | Punta |
|---|---|---|---|---|---|
| General | `general` | Orvel · Corbel | ¿cómo viene el negocio y qué me está esperando? | Cobrado | `punta/dash-general` |
| Focus | `foco` | Pane · Lumora | ¿en qué estoy ahora y qué me queda hoy? | — (la frase de lo que te queda) | `punta/dash-focus` |
| Operación diaria | `operacion` | Moorly · Torque | ¿qué está vencido y a quién llamo? | Por cobrar | `punta/dash-operacion` |
| Agencia o servicio | `servicio` | Sunrow · Torque | ¿cada cliente va en fecha? | Avanzaron de etapa | `punta/dash-servicio` |
| Curso o comunidad | `curso` | Lumora · Vitrea | ¿cuántos siguen ahí? | Alumnos activos | `punta/dash-curso` |
| Instagram y redes | `instagram` | Murmura · Kestrel | ¿qué publicación trajo gente de verdad? | Tocan el anuncio | `punta/dash-instagram` |
| Marketing | `marketing` | Kestrel · Ondra | ¿cuánto cuesta una agenda y de qué anuncio vino? | Costo por agenda | `punta/dash-marketing` |
| Comercial | `comercial` | Coffer · Corbel · Prism · Orvel · Pelago · Selvar | ¿convierte, y a qué costo? | Tasa de cierre | `punta/dash-comercial` |
| Cobranza | `cobranza` | Coffer · Corvane · Talvo | ¿qué plata está prometida y no entró? | Cobrado | `punta/dash-cobranza` |
| Anuncio ganador | `ads-analyst` | Vitrea · Prism | ¿cuál creativo gana, y con cuánta confianza? | Listos para escalar | `punta/dash-anuncio-ganador` |
| Hooks y retención (nueva) | `hooks-retencion` | Vitrea · Murmura | ¿en qué parte se van, y qué hook los retuvo? | Hook rate | `punta/dash-hooks` |
| Landing | `landing` | Corbel · Kestrel | ¿hasta dónde bajan y dónde hacen clic? | Llegan a la mitad | `punta/dash-landing` |
| VSL y YouTube | `vsl-analyst` | la forma de Hooks, otra fuente | ¿quién llega al final y ésos compran más? | Llegan al final | `punta/dash-vsl` |
| Chat Analyst | `chat-analyst` | Parley · Tend | ¿cuánto tardamos en contestar? | Tiempo de respuesta | `punta/dash-chat` |
| Closing | `closing` | Halden · Moorly · Tandem | ¿por qué se cerró o no, y quién cierra mejor? | Tasa de cierre | `punta/dash-closing` |
| CS Analyst | `cs-analyst` | Mender · Vitrea | ¿quién necesita atención, y cuántos se van? | Se dieron de baja | `punta/dash-cs` |
| Productividad | `productividad` | Fernly · Sunrow | ¿qué avanza y qué se estancó? | Avance global | `punta/dash-productividad` |
| Automatizaciones | `automatizaciones` | Noria | ¿qué salió, qué falló y en cuánto responden? | Fallaron | `punta/dash-automatizaciones` |
| Contenido e IA | `ia-contenido` | Orrery | ¿cuánta IA gastamos y en qué? | Costo de la IA | `punta/dash-ia-contenido` |
| Inmobiliaria (nueva, por rubro) | `inmobiliaria` | Lintel (sólo su Overview) | ¿cuántos visitan, cuántos compran y en qué proyecto? | Compran, de los que visitan | `punta/dash-inmobiliaria` |

**Las que se fueron** (las absorbe otra; un link o un agente que las nombre llega a la nueva): **CRM y pipeline** y
**Ventas del mes** → Comercial. **Ads Analyst** se partió en Anuncio ganador (que se queda su id: `/ads-analyst` llega
ahí) y Hooks y retención.

**Las que cambiaron de nombre y no de id** (las hojas guardadas y los links siguen andando): Ads Analyst → Anuncio
ganador, Instagram → Instagram y redes, VSL Analyst → VSL y YouTube, Foco de la semana → Focus. Se encuentran por el
nombre de antes en el buscador de «Nueva hoja».

## Lo que NO se pudo ver

- **Ninguna hoja se vio dibujada con datos reales.** Esta sesión no tiene producción ni base. Se verificó la composición
  (qué pieza va dónde, con un script sobre `componentesDe`), los tests de las plantillas (más de 700) y los tipos enteros.
  Lo primero que hay que mirar en producción: que ninguna frase quede vacía en un negocio con datos, y que los «Ver … →»
  lleven a la pantalla correcta.
- **La miniatura de cada plantilla en «Nueva hoja»** se arma con los mismos datos de ejemplo de siempre; no se miró.

## Lo que las hojas NO prometen, porque MaKo no lo mide

- **Retención por SEGUNDO del video**: Hooks y VSL van por cuartiles (25/50/75/100 %, lo que manda Meta).
- **Confianza estadística de un A/B**: Anuncio ganador usa la confianza por muestra (impresiones: alta desde 25.000).
- **Cohortes de permanencia M0…M5**: Curso mide quién vio clases en el período.
- **Motivos de baja**: el `motivo` de la cartera es el de la SEÑAL. CS dice «Por qué piden atención», no «por qué se van».
- **Tiempo de foco por tarea**: Focus no tiene el temporizador de Pane.
- **Horas ahorradas** por una automatización: Automatizaciones dice en cuántas horas responden.
- **«En fecha» por cliente**: la entrega no guarda una fecha comprometida por etapa; Agencia mide cuándo llegó cada uno.
- **Vistas de YouTube**: hoy las tiene un solo cliente; para los demás, Vistas del VSL y Costo por vista quedan sin dato.

## Lo que no se tocó

- **Ninguna migración.** Todo sale de conjuntos que ya existían.
- **Las hojas guardadas** de cada persona no cambian.
- **La API de MaKo** ya podía armar cada hoja (`crear_hoja_dashboard` con su plantilla) y desde la base cada gráfico
  acepta `frase` e `ir` (`agregar_grafico_dashboard`, `editar_grafico_dashboard`); `docs/api-mako.md` está regenerado.
