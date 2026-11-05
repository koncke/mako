# Relevo — las hojas del Dashboard (4/11/2026, chat en la nube)

## 📬 Para el Cerebro (5/11/2026, ~04:20 UTC)

- **Anuncio ganador está en producción.** Entró a main (`30430f5e4`, la punta `dash-anuncio` tal cual, con su veredicto: 7.111 tests y
  el tsc entero); el humo de producción de ese deploy dio verde a las 03:51. Es la decimoctava hoja copiada (Prism).
- **Hooks y retención (la copia de Ondra) está en `punta/dash-hooks`**: la sección de abajo. Es la decimonovena hoja copiada, del
  Dashboard (la plantilla `hooks-retencion`, que pasa a ofrecerse: el test de las ofrecidas usa ahora `vsl-analyst` como la vieja).
  **⚠️ La referencia es ONDRA, no las de la propuesta** (Vitrea · Murmura): esas dos ya son las copias de Curso o comunidad y de
  Instagram y redes, y repetirlas dejaba dos hojas iguales. Ondra es un panel de marketing (sus cuatro números con su curva, el embudo de
  checkout, los canales, el medidor del presupuesto) y cada parte tiene su par en la pregunta de Hooks. La plantilla no suma paneles
  (sigue en 12): los cuatro números pasan a compararse con el período anterior, el gancho trae también lo que llega al llamado, el
  ThruPlay y los guiones, y el avatar lo que llega al llamado y los guiones.
- **⚠️ La retención es por CUARTILES** (lo que manda Meta), no segundo a segundo (§7.4 de la propuesta).

### Lo de las ~03:30 UTC

- **Instagram y redes está en producción.** Entró a main (`cfbb92ecc`, la punta `dash-instagram` tal cual, con su veredicto: 7.102 tests y
  el tsc entero); el humo de producción de ese deploy dio verde a las 02:53. Es la decimoséptima hoja copiada (Murmura).
- **Anuncio ganador (la copia de Prism) está en `punta/dash-anuncio`**: la sección de abajo. Es la decimoctava hoja copiada, del
  Dashboard (la plantilla `ads-analyst`). Suma cinco piezas a la plantilla (las agendas y los cierres por día, qué guion rinde más entre
  los que tienen muestra, los doce meses, el gancho día por día y lo invertido en cada veredicto) y pone a comparar con el período anterior
  los tres costos. **⚠️ Para entrar en el tope de 14 paneles** (el primer veredicto dio rojo por eso: la hoja tenía 18), los listos para
  escalar salen de la fila «Escalar» del veredicto y las semanas de los días, y **la grilla perdió las agendas por US$1.000 por ángulo y
  por formato** (el ángulo sigue en el color del cuadrante y en su filtro; el formato vive en «Hooks y retención»). **La plantilla pasa a ofrecerse** (trae su diseño): `tests/dashboard-plantillas-ofrecidas.test.ts` usaba
  `ads-analyst` como la vieja que no se ofrece, y ahora usa `hooks-retencion`.
- **⚠️ La «confianza» de la hoja es la de la MUESTRA** (impresiones: alta desde 25 mil, media desde 8 mil), no la de una prueba A/B entre
  dos creativos: ésa sigue sin medirse (§7.4 de la propuesta).
- **Sigo con la siguiente que tenga lo medido completo**, de a una. Lintel sigue frenada (abajo).

### Lo de las ~02:35 UTC

- **Agencia o servicio está en producción.** Entró a main (`98403e8e5`, la punta `dash-servicio` tal cual, con su veredicto: 7.092 tests
  y el tsc entero); el deploy de ese commit se promovió a las 01:59. Es la decimosexta hoja copiada (Sunrow).
- **Instagram y redes (la copia de Murmura) está en `punta/dash-instagram`**: la sección de abajo. Es la decimoséptima hoja copiada y
  la cuarta de General que lee los datos de General (las publicaciones del Calendario).
- **⚠️ Dos piezas de la plantilla nunca pudieron tener datos, y las cambié para las hojas nuevas:** «Alcance en Instagram» (Meta da el
  alcance por fila y no se suma: el número sin desglose da null siempre, medido con `agregar`) y «Agendan por región» (con el desglose por
  región Meta no manda ninguna conversión). El alcance pasa a viajar en «Instagram contra Facebook» y la región pasa a vistas, «Dónde te
  ven». Las hojas de Instagram que ya existen no cambian solas (regla 6): ésas siguen mostrando esos dos vacíos.
- **De paso, un test que daba rojo media hora cada noche (en `main` también):** `tests/grupos-ops-avisos.test.ts` le ponía a un invitado
  un «No molestar» de 0 a 23,5 h en Buenos Aires, y entre las 02:30 y las 03:00 UTC el aviso salía y el test fallaba. Ahora la ventana se
  arma alrededor de la hora de ahora (probado rompiéndolo: corrida una hora, rojo). Es del chat de los grupos de la app: sólo cambié el
  test, no el código.
- **Sigo con la siguiente que tenga lo medido completo**, de a una. Lintel sigue frenada (abajo).

### Lo de las ~01:55 UTC

- **Curso o comunidad está en producción.** Entró a main (`f6a6e8def`, la punta `dash-curso` tal cual, con su veredicto: 7.080 tests y
  el tsc entero); el deploy de ese commit se promovió a las 01:20. Es la decimoquinta hoja copiada (Vitrea).
- **Agencia o servicio (la copia de Sunrow) está en `punta/dash-servicio`**: la sección de abajo. Es la decimosexta hoja copiada y la
  tercera de General que lee los datos de General (el Calendario, el Plan y el Semáforo). Suma dos piezas a la plantilla (lo que te deben
  por atraso y los que más deben, de los pagos) y cambia dos: «Quién te necesita hoy» trae seis clientes y «Avanzaron, por semana» mira
  los últimos 90 días.
- **Sigo con la siguiente que tenga lo medido completo**, de a una. Lintel sigue frenada (abajo).

### Lo de las ~01:10 UTC

- **Curso o comunidad (la copia de Vitrea) estaba en `punta/dash-curso`** (hoy en producción): la sección de abajo. Es la decimoquinta hoja copiada y la
  primera de General desde Operación. Suma dos piezas a la plantilla («Hace cuánto no hablan» y «Quién te necesita hoy», las mismas de
  «Agencia o servicio») y lee el Calendario de los datos de General.
- **De paso, en Contenido e IA (en producción):** el subtítulo de «Lo gastado por día» decía «US$52.00 en últimos 30 días»; ahora dice
  «en los últimos 30 días» (§28 de los hallazgos).
- **Sigo con la siguiente que tenga lo medido completo**, de a una. Lintel sigue frenada (abajo).

### Lo de las ~00:10 UTC

- **Contenido e IA está en producción.** Entró a main (`01e26099a`, la punta `dash-contenido` tal cual, con su veredicto: 7.053 tests y
  el tsc entero); el deploy de ese commit se promovió a las 23:56 del 4/11. Es la decimocuarta hoja copiada (Orrery).
- **⛔ Inmobiliaria (Lintel) queda FRENADA: la captura del demo está incompleta y no se puede volver a medir desde la nube.** En
  `demos/lintel/captura/` la página está entera de alto pero cuatro tarjetas salen VACÍAS («Today's agenda», «Portfolio map», «Top
  agents» y «Activity»; en el teléfono también «Pipeline by stage», en $0): el medidor sacó la foto antes de que se dibujaran. Son justo
  las que la plantilla necesita (quién vende y el mapa), y `demo.codeandchill.store` está bloqueado por la red de esta sesión (el proxy
  contesta 403), así que no la pude volver a fotografiar. No se inventa lo que no se ve (AGENTS.md, «NINGUNA pantalla se diseña de
  cero», punto 2). **Hace falta volver a medir Lintel desde un lugar con acceso al demo**, bajando por la página hasta que cada tarjeta
  se dibuje, antes de copiarla. La foto del inmueble destacado es de la tienda: va un recuadro propio.
- **Sigo con la siguiente que tenga lo medido completo**, de a una.

### Lo de las ~23:45 UTC

- **Contenido e IA (la copia de Orrery) estaba en `punta/dash-contenido`** (hoy en producción): la sección de abajo. Es la decimocuarta hoja copiada. No suma
  piezas a la plantilla: el diseño dibuja las diez. De paso se arregló el `<style>` de cinco adaptaciones guardadas en `docs/` (Fernly,
  Noria, Parley, Mender y Corbel): arrancaba con el texto de la cabecera del archivo de estilos y perdía su primera letra (§27 de los
  hallazgos). No toca la app.

### Lo de las ~23:20 UTC

- **Productividad está en producción.** Entró a main (`54b2922fc`, la punta `dash-productividad` tal cual, con su veredicto:
  7.044 tests y el tsc entero); el deploy de ese commit se promovió a las 23:09. Es la decimotercera hoja copiada (Fernly).
- **Sigo con Contenido e IA (la copia de Orrery)**: la copia de la página ya calza con la captura en 1440 y en 390; falta la adaptación.

### Lo de las ~22:40 UTC

- **CS Analyst está en producción.** Entró a main a las 22:21 (`b42c446d9`, la mezcla de `punta/dash-cs` con `923d70e8b`, su veredicto:
  7.034 tests y el tsc entero); el deploy de ese mismo commit quedó listo a las 22:33. El primer veredicto dio un rojo de verdad: la hoja
  enlazaba `/customer-success`, la ruta vieja, y ahora usa `RUTA_CLIENTES` (lib/clients-rutas.ts).
- **Productividad (la copia de Fernly) estaba en `punta/dash-productividad`** (hoy en producción): la sección de abajo. Es la decimotercera hoja copiada. No suma
  piezas a la plantilla: el diseño dibuja nueve de las once; la matriz de impacto × esfuerzo y lo que queda en cada proyecto siguen en la
  grilla.

### Lo de las ~22:10 UTC

- **Automatizaciones está en producción.** Entró a main a las 21:41 (`a866b40be`, la punta `dash-auto` tal cual, con su veredicto: 7.026 tests
  y el tsc entero); el deploy promovido de las 22:01 (`50a2c9f52`) la contiene. El primer veredicto dio un rojo de verdad: la hoja de Noria
  declaraba sus propios `--fs-base`, `--fs-lg` y `--fs-xs` adentro de `.nor`, y la guarda de tests/puente-panel-copy.test.ts exige que todo
  `var(--fs-*)` del repo exista en app/globals.css. El armador ahora los llama `--nor-fs-*` (§25 de los hallazgos).
- **CS Analyst (la copia de Mender) va en `punta/dash-cs`**: la sección de abajo. Es la duodécima hoja copiada. Suma una pieza a la plantilla
  (cada cliente con su etapa de la entrega, en el cruce) y el producto como columna de la tabla de la cartera; la página lee aparte el orden de
  las etapas de cada servicio.

### Lo de las ~21:30 UTC


- **Chat Analyst está en producción.** Entró a main a las 21:05 (`d8c7ca164`, la mezcla de `punta/dash-chat` con `be54b7222`, su veredicto:
  7.018 tests y el tsc entero); el deploy promovido de las 21:08 la contiene.
- **Automatizaciones (la copia de Noria) va en `punta/dash-auto`**: la sección de abajo. Es la undécima hoja copiada. No suma métricas ni
  dimensiones: sale entera de `envios` e `inscripciones` (dos piezas nuevas en la plantilla: los envíos y los fallos por día y por
  automatización).

### Lo de las ~20:50 UTC

- **Chat Analyst (la copia de Parley) va en `punta/dash-chat`**: la sección de abajo. Es la décima hoja copiada y la hoja del SETTER
  (`HOJA_DE_ROL`): todo lo que dibuja sale de sus conjuntos (los chats, los mensajes, los envíos y las automatizaciones).

### Lo de las ~20:25 UTC


- **Landing está en producción.** Entró a main a las 20:11 (`cbe8c2f6d`, la punta `dash-landing` tal cual, con su veredicto: 7.035 tests y
  el tsc entero); el deploy promovido de las 20:11 la contiene. El primer veredicto dio un rojo de verdad: la guarda del voseo encontró
  «acá» en los tres vacíos de la hoja, y se cambió por «aquí» antes de subir.
- **Lo próximo es Chat Analyst (la copia de Parley).** «Instagram y redes», que va antes en la tabla, no tiene plantilla en el código: queda
  para cuando la tenga.

### Lo de las ~20:00 UTC

- **Landing (la copia de Corbel) va en `punta/dash-landing`**: la sección de abajo. Es la novena hoja copiada. Suma dos dimensiones a la
  fuente `visitas` (el día de la semana y la franja horaria, con la zona del negocio) para el «Cuándo entran» de Corbel.
- **De paso, un arreglo en Comercial (en producción):** tres reglas de su hoja de estilos no aplicaban nunca (las llamadas que ya pasaron
  no se apagaban y las filas que se tocan perdían su margen). Las armaba mal el mismo armador que se usa para cada copia: una clase pegada a
  otra (`.fila.is-past`) no llevaba el prefijo. Está en `docs/hallazgos-templates-dashboard.md` §22.
- **La nota de que Marketing está en producción** entró a main a las 19:31 (`a8ac06e62`).

### Lo de las ~19:15 UTC

- **Marketing está en producción.** Entró a main a las 19:02 (`445a59f64`, la mezcla de `punta/dash-marketing` con `f9b806acc`); el deploy
  promovido de las 19:06 (`445a59f64`) la contiene. El primer veredicto dio tres rojos de tests que usaban de EJEMPLO piezas que la
  plantilla de Marketing ya no trae (el costo por cierre, el mapa y la edad): ningún código las buscaba, y los tests se reescribieron para
  probar lo mismo sin ellas (`15fb1f969`). El segundo, verde: 7.001 tests y el tsc entero.
- **Lo próximo es Landing (la copia de Corbel).** Anuncio ganador y Hooks, que van antes en la tabla, piden lo que MaKo no mide (la
  confianza de un A/B entre creativos y la retención por segundo, §7.4): quedan para cuando se mida.

### Lo de las ~18:45 UTC

- **Comercial está en producción.** Entró a main a las 18:11 (`21df3c66a`, la mezcla de `punta/dash-comercial` con `f2806d53e`); el deploy
  promovido de las 18:25 (`5747639cb`) la contiene. La primera corrida del veredicto dio un rojo de verdad: `tests/plantillas-sugeridas.test.ts`
  esperaba a Closing primera para quien vende por llamada, y con Comercial ofrecida (también para «llamadas», y antes en la galería) la
  primera es Comercial. El test ahora compara contra el orden que calcula la galería (`ordenarConSugeridas`), probado rompiéndolo.
- **Marketing (la copia de Kestrel) va en `punta/dash-marketing`**: la sección de abajo. Es la octava hoja copiada.

### Lo de las ~18:00 UTC

- **«Operación diaria» está en producción.** Entró a main a las 17:44 (`5330cfb37`, la mezcla de `punta/dash-operacion`); el deploy
  promovido de las 17:40 (`b73d4bc5b`) la contiene. El veredicto de la nube: 6.994 tests y el tsc entero en verde (`a70024a14`).
- **Comercial (la copia de Selvar) va en `punta/dash-comercial`**: la sección de abajo. Es la séptima hoja copiada, y la primera del
  Dashboard desde Cobranza.

### Lo de las ~17:30 UTC

- **General está en producción.** Entró a main a las 16:58 (`30e5586f5`); el deploy promovido de las 17:05 (`5bd386108`) la contiene.
- **«Operación diaria» (la copia de Moorly) va en `punta/dash-operacion`**: la sección de abajo. Es la sexta hoja copiada.

### Lo de las ~16:45 UTC

- **«Mi día» está en producción.** Entró a main a las 16:20 (`c1d8e89e4`); el deploy promovido de las 16:30 (`ddfc71d20`) la contiene. El
  veredicto de la nube la dejó pasar sin repetir los tests (6.949 tests y el tsc entero en verde, `8edcd95da`).
- **General (la copia de Orvel) va en `punta/dash-general`**: la sección de abajo. Es la quinta hoja copiada.

### Lo de las ~16:00 UTC

- **Cobranza y Focus están en producción.** Cobranza entró a main a las 15:28 (`4bd93e83`, deploy promovido 15:32); Focus a las 15:37
  (`071ced42`, deploy promovido 15:40). La marca `ci-rojo/dash-cobranza` quedó vieja: su commit ya está en main.
- **«Mi día» (la copia de Lumora, la otra referencia de Focus) va en `punta/dash-mi-dia`**: la sección de abajo. Es la cuarta hoja copiada.

### Lo de antes (~15:00 UTC)

Desde esta sesión de la nube no le puedo escribir al Cerebro: el mensaje entre sesiones está cerrado para una sesión que no puede llegar a las
otras sesiones de Martín, y no pido ese permiso por mi cuenta. Lo dejo acá:
- **«Nueva hoja» (`punta/dash-seleccion`) está en producción** desde las ~14:12 UTC (deploy `2de03f8e`, corrida 41845201367).
- **Cobranza (`punta/dash-cobranza`)**: la corrida 171 dio rojo por una palabra, un «acá» en el vacío de los planes de pago
  (`tests/puente-panel-copy.test.ts`). Está corregido en `5936606b` y subido de nuevo. El otro rojo de esa corrida, `coaches-ops-center`, fue FLAKY:
  pasó aislado y no es de esta punta. Revisé el resto de los textos de la hoja.
- **Cobranza, segunda corrida (180, `5936606b`): los tests en VERDE** (6.940 de 705 archivos), y el paso «Tipos» cortado por tiempo a los 18
  minutos (en la 171 tardó 10). No es un error de tipos, pero son dos rojos seguidos: antes de la tercera corrí el `tsc` entero en la nube
  sobre `dash-focus`, que contiene Cobranza y Focus (resultado abajo, en «Focus»).
- **Focus (`punta/dash-focus`)**: la sección de abajo. **Esta punta lleva también los commits de Cobranza**: una sola corrida chequea las dos y,
  con verde, las dos llegan a main. La marca `ci-rojo/dash-cobranza` queda vieja ese día (es de `5936606b`, que ya iría adentro de main).

## Hooks y retención: la decimonovena hoja copiada (la de Ondra), con «¿en qué parte del video se van, y qué gancho los retiene?» (punta `dash-hooks`, 5/11/2026)

La referencia es Ondra (`docs/diseno/mockups-dashboard/demos/ondra/`): la página «Overview» de un panel de marketing claro, con la barra de
la izquierda oscura, la cabecera con el saludo, «Performance» (cuatro números con su pastilla que corre y la curva del período contra el
de antes, con los lanzamientos de campaña marcados), «Where it came from» (los canales con su barra apilada y un selector Revenue · Orders
· Spend), «Running now» (las campañas con su presupuesto y su interruptor), «Checkout funnel» (las barras centradas con la caída más
grande), «Hottest leads» (con su anillo de puntaje), «October budget» (un medidor con su aguja) y «Team activity».

**Por qué Ondra y no las de la propuesta:** la propuesta (§7.3) le da a Hooks «Vitrea · Murmura», y las dos ya son copias de otras hojas
(Curso o comunidad e Instagram y redes). Ondra estaba sin usar y cada parte tiene su par en la pregunta de Hooks.

**Qué cambia para Martín:**
- **«Nueva hoja» del Dashboard ofrece «Hooks y retención» con el diseño de Ondra**, con su miniatura de verdad (la plantilla no se ofrecía).
- **La cabecera** dice cuántos vieron los 3 primeros segundos, cuántos llegaron a la mitad y cuántos lo vieron entero, con «Ver la grilla»
  y «Escribir un guion». **Cuánto ven tus anuncios** («Performance»): el hook rate, los que llegan al llamado, el ThruPlay y los guiones
  analizados, cada uno con su cambio contra el período anterior; tocar uno cambia la curva de abajo (día por día, con el promedio del
  período anterior punteado).
- **Qué gancho retiene** («Where it came from»): cada tipo de gancho con sus guiones, su parte y su hook rate (o lo que llega al llamado, o
  el ThruPlay: el selector), y cuántos pasan el buen gancho (28%). **Cada guion** («Running now»): los seis que más retienen, con su gancho
  y su formato, el hook rate en la barra, lo que llega al llamado y el ThruPlay; tocar uno abre su pop-up.
- **En qué parte se van** («Checkout funnel»): 3 segundos, un cuarto, la mitad, tres cuartos y el video entero, con lo que retiene cada paso
  y la caída más grande. **Hook rate por avatar** («Hottest leads»): los cinco de mejor gancho, con lo que llega al llamado y su anillo.
- **Tu gancho** («October budget»): el medidor con la aguja en tu hook rate y la marca en el bueno (28%, arriba en el medio), y el gancho,
  el llamado (contra el 10% del veredicto) y el ThruPlay. **Qué gancho funciona** («Team activity»): lo que escribió MaKo en la caja de IA
  de la hoja (nunca corre al abrir; compartida o en la miniatura no se lee).

**Lo que se copió de Ondra, y cómo se midió:**
- La copia (`docs/diseno/mockups-dashboard/hooks-ondra/copia.html` con `ondra.css` y `ondra.js`) sale de lo medido del demo: `valores.json`,
  las capturas a 1440 y a 390, los estados y el INFORME. **Nada del código de la tienda, ni el cartel «BUY THIS TEMPLATE», ni el logo de
  Ondra** (la marca de la copia es un trazo propio). Los íconos son trazos propios.
- **A 1440 las siete tarjetas de la copia caen en las de la captura a 2 px o menos** (las cajas: 213/508 contra 213/506, 754/476 contra
  754/475, 1247/570 contra 1246/570), y las curvas de «Performance» se leyeron de la captura día por día (la altura de cada línea).
  **En el teléfono, las siete a 3 px o menos** (246/614 contra 246/615 … 3052/562 contra 3050/562).
- **El quinto filtro del embudo** lo tapa el cartel de la tienda a 1440; a 390 se lee «Orga…» con el punto verde: es Organic.
- **En el teléfono, los rótulos de abajo de la curva pisan la leyenda** (la caja de la curva mide 224 y los rótulos salen de ella): es así
  en el demo, y la copia lo deja. La adaptación no lo repite.
- **El movimiento, de las RECETAS del INFORME:** la barra de la izquierda entra desde x −40 con escala .97 (.9 s, power3.out) y sus
  renglones desde −12 px cada .035 s; la barra de la meta crece desde 0 (1,2 s); el embudo mide cada barra como max(.035, (el paso / el
  primero) ^ .42) y marca la caída más grande; el medidor es un arco de radio 86 con 21 marcas; la pastilla del selector y la de los
  números corren .35 s con la curva (.2, .8, .2, 1).
- **⚠️ Lo SUPUESTO** (el INFORME corta la receta de la página): la barra de arriba baja desde −8 px; las tarjetas suben desde 18 px (.7 s,
  desde .3 s, cada .06 s); la curva se dibuja en 1,2 s; las barras crecen en .9 s; los anillos en 1 s; la aguja gira en 1,1 s; los números
  cuentan .9 s. Y en el teléfono, el cuarto rótulo de la curva (los otros tres se leen cada 8 días; el cuarto lo tapa el cartel).

**Lo que Ondra tiene y MaKo no mide, y no está:** el rango de 7, 30 y 90 días (el período es el de la hoja), los lanzamientos de campaña
sobre la curva, la curva día por día del período anterior (va su promedio, punteado), el filtro por canal del embudo, el interruptor que
pausa una campaña, el presupuesto del mes y la actividad del equipo (va lo que escribió MaKo). La barra de la izquierda, la de arriba y la
de abajo del teléfono son el armazón de Ondra: en MaKo las pone la app. **Y la retención es por cuartiles**, no segundo a segundo.

**Dónde vive:**
- El modelo: `lib/hooks-diseno.ts`, puro. Los datos de ejemplo: `lib/hooks-diseno-muestra.ts` (cuadran entre tarjetas: los guiones de cada
  gancho y de cada avatar suman los analizados, y la cabecera dice lo mismo que el embudo). El buen gancho (`HOOK_MID`) y el buen llamado
  (`HOLD_MID`) salen de `lib/ads-analyst-patrones.ts`, los mismos del veredicto.
- El dibujo: `app/dashboard/disenos/HojaHooks.tsx`; lo vivo, `HooksVivo.tsx`; la hoja de estilos, `hooks-css.ts` (la arma
  `scratchpad/ond/armar-ond.py` desde `ondra.css`, con la cola de la adaptación). El test: `tests/dashboard-diseno-hooks.test.ts` (10, con
  13 roturas).

## Anuncio ganador: la decimoctava hoja copiada (la de Prism), con «¿cuál creativo gana, y con cuánta confianza?» (punta `dash-anuncio`, 5/11/2026)

La referencia de Anuncio ganador es Prism (`docs/templates-dashboard-propuesta.md` §7.3): un panel oscuro de comercio en vivo con la barra
de arriba (el logo, el rango Live/24H/7D/30D, el reloj y «Live»), y cuatro filas de tarjetas con esquinas de mira: «Revenue» (el número
grande, barras cada 15 s y el pronóstico), «Traffic sources» y «Revenue by region» (dos anillos), «Campaign ROAS» (barras contra la meta),
«Key metrics» (tres números con su curva), «Platform health» (un medidor), «Quarterly revenue» (columnas con su flecha), «Signups &
activations», «Active customers», «Checkout latency» (tres líneas contra el SLO) y «Feed» (el último pedido y seis botones).

**Qué cambia para Martín:**
- **«Nueva hoja» del Dashboard ofrece «Anuncio ganador» con el diseño de Prism**, con su miniatura de verdad (la plantilla no se ofrecía).
- **Arriba:** «Agendas de tus anuncios» («Revenue»): las agendas del período con su cambio, y las de cada día (los últimos 42) con el
  promedio de 7 días en la línea y el último día marcado. **Qué hacer con cada uno** («Traffic sources»): cuántos guiones hay en cada
  veredicto (escalar, mejorar el gancho, reescribir el cuerpo, repensar, validar, imagen). **Con cuánta muestra** («Revenue by region»):
  qué parte de los guiones juntó impresiones para juzgarlos, con la regla de cada confianza.
- **Qué guion rinde más** («Campaign ROAS»): los seis de más agendas por cada US$1.000 entre los que tienen muestra, contra su promedio
  (en color los que están arriba). **Cuánto cuesta** («Key metrics»): el costo por agenda, el costo por cierre y lo gastado sin agendas,
  con su cambio (bajar es verde) y su curva. **Listos para escalar** («Platform health»): cuántos guiones conviene escalar y qué parte de
  lo invertido va a ellos, con lo invertido, las agendas por US$1.000 y los cierres.
- **Agendas por mes** y **Lo invertido por mes** («Quarterly revenue» y «Active customers»): los seis meses cerrados, que no obedecen al
  período, con la flecha del cambio de las agendas y el cambio de lo invertido mes a mes. **Agendas y cierres** («Signups & activations»):
  por semana, con cuántas agendas cerraron.
- **El gancho en el tiempo** («Checkout latency»): el hook rate, los que llegan al llamado y el ThruPlay, día por día, contra el buen
  gancho (28%, el mismo del veredicto). **El que más agendó** («Feed»): el guion con más agendas y lo que costó cada una, y los atajos
  (Ads Manager, Ads Writer, Hooks y la grilla).
- Tocar un guion abre su pop-up; un veredicto o una confianza, lo de siempre de su pieza. «Ver la grilla» va arriba.

**Lo que se copió de Prism, y cómo se midió:**
- La copia (`docs/diseno/mockups-dashboard/anuncio-prism/copia.html` con `prism.css` y `prism.js`) sale de lo medido del demo:
  `valores.json`, las capturas a 1440 y a 390, los estados y el INFORME. **Nada del código de la tienda, ni el cartel «BUY THIS
  TEMPLATE», ni el logo de Prism** (es su dibujo: la adaptación lleva un trofeo propio). Los íconos son trazos propios.
- **A 1440 las doce tarjetas de la copia caen EXACTAS en las de la captura** (la última fila, a 1 px), y la adaptación cae en las mismas
  cajas. **En el teléfono, a ≤3 px hasta los números de «Key metrics»**: de ahí para abajo la captura de Prism está en negro (se sacó antes
  de que se dibujaran), así que el teléfono de abajo es un supuesto (las campañas con el nombre arriba y la barra debajo; los números con su
  curva a lo ancho; el medidor con los tres datos debajo).
- **Dos pasos que Prism no tiene:** hasta 1320 px (el ancho del Dashboard con la barra lateral es ~1200) «Revenue» va a lo ancho y los dos
  anillos debajo, «Key metrics» a lo ancho arriba de las campañas y el medidor, y la última fila de a una; hasta 1000, la fila de los meses
  de a dos con las semanas a lo ancho.
- **El movimiento, de las RECETAS del INFORME:** la cabecera baja desde −10 px (.6 s, power3.out); cada tarjeta sube desde 16 px (.75 s) y
  sus esquinas aparecen desde escala 1.08 (.7 s, power2.out, +.05 s); las barras de las agendas crecen de izquierda a derecha (1,5 s) y su
  línea se dibuja .35 s después (1,3 s, power2.inOut); el gancho se revela de izquierda a derecha (1,3 s); los números cuentan .9 s; el
  guion que más agendó entra desde abajo (.45 s). Al pasar, los botones y el guion ganador toman el borde del acento (.2 s).
- **⚠️ Lo SUPUESTO:** el tiempo de cada tarjeta (desde .35 s, cada .06 s), cómo crecen los anillos, las campañas, el medidor y las columnas
  (.9 s, power3.out, cada .06 s), cómo se ve la línea que barre la página al entrar, y los rótulos de los dos últimos botones del «Feed»
  (los tapa el cartel de la tienda: la copia los deja sin rótulo).

**Lo que Prism tiene y MaKo no mide, y no está:** el «Live» y los cubos de 15 s (los datos de Meta son por día), el pronóstico (la línea es
un promedio de lo medido), las regiones, la salud de la plataforma, la latencia, el reloj y el rango (el período es el de la hoja), y una
**prueba A/B entre dos creativos** (la confianza es la de la muestra).
**La plantilla suma cinco piezas** (las agendas y los cierres por día, qué guion rinde más entre los que tienen muestra, los últimos doce
meses, el gancho día por día y lo invertido en cada veredicto) **y cambia dos cosas:** la frase de arriba trae lo invertido, y los tres
costos se comparan con el período anterior. **Y queda en 14 paneles** (`tests/graficos-corbel.test.ts`): el número «Listos para escalar»
se va (lo dice la fila «Escalar» del veredicto, y el diseño lo calcula de ahí), las semanas son la suma de los días, y la grilla pierde las
agendas por US$1.000 por ángulo y por formato. El cuadrante, los patrones de MaKo y las tarjetas de los guiones quedan en la grilla.

**Dónde vive:**
- El modelo: `lib/anuncio-diseno.ts`, puro. Los datos de ejemplo: `lib/anuncio-diseno-muestra.ts` (cuadran entre tarjetas: las semanas
  suman los días, y los guiones de los dos anillos son los mismos). Los umbrales de la muestra (`IMPR_ALTA`, `IMPR_MEDIA`) y el buen gancho
  (`HOOK_MID`) salen de `lib/ads-analyst-patrones.ts`, los mismos del veredicto.
- El dibujo: `app/dashboard/disenos/HojaAnuncio.tsx`; lo vivo, `AnuncioVivo.tsx`; la hoja de estilos, `anuncio-css.ts` (la arma
  `scratchpad/prs/armar-prs.py` desde `anuncio-prism/prism.css`: todo con el prefijo `prs-`).
- La plantilla: `lib/graficos-plantillas-analysts.ts` (ADS, catorce piezas en el diseño, `diseno.id = 'anuncio'`); `DISENOS_HOJA` en
  `lib/graficos-catalogo.ts`.
- Los tests: `tests/dashboard-diseno-anuncio.test.ts` (13, probado rompiéndolo de diecisiete maneras: cada rotura sola da rojo).

## Instagram y redes: la decimoséptima hoja copiada (la de Murmura), con «¿qué publicación trajo gente de verdad?» (en producción desde el 5/11/2026, 02:53)

La referencia de Instagram y redes es Murmura (`docs/templates-dashboard-propuesta.md` §7.3): la página «Overview» de Murmura (un panel
para manejar redes, claro y de vidrio): la barra de arriba y la de la izquierda, el saludo con tres números, «Up next» (la próxima
publicación con su cuenta regresiva y la cola), «Needs you» (las aprobaciones), «Audience growth» (un área de seguidores por día), «Top
post this month», «The week ahead» (siete días con sus turnos), «Network pulse», «Inbox pulse» y «Team activity». En el teléfono, una
barra de abajo con cinco pestañas.

**Qué cambia para Martín:**
- **«Nueva hoja» de General ofrece «Instagram y redes» con el diseño de Murmura**, con su miniatura de verdad.
- **Arriba:** «Buenos días, Ana» y una frase con lo que Instagram te mostró, cuántos tocaron tu anuncio y cuántos agendaron. Tres
  números: el alcance en Instagram, cuántos tocan el anuncio y lo invertido en Instagram con lo que cuesta cada mil vistas. El botón
  «Agendar una publicación» abre el Calendario.
- **Próxima publicación** («Up next»): la que sigue en tu Calendario, con su formato, lo que falta para que salga («1 h 30 min») y
  cuándo; abajo, las seis que vienen después.
- **Más anuncios que trajeron clientes** («Needs you») y **El que más clientes trajo** («Top post this month»): los anuncios ordenados
  por los clientes que salieron de sus leads; el primero va en la tarjeta grande (con su miniatura de Meta si la tiene) y los demás en la
  lista, con «Ver sus leads» y «Ads Manager». Ningún anuncio sale dos veces.
- **Leads de tus anuncios** («Audience growth»): los leads de tus anuncios de Meta cada día, con cuántos agendaron y el mejor día.
- **Esta semana** («The week ahead»): los siete días desde hoy con las publicaciones del Calendario (la hora y el formato), las que
  sobran y cuántas hay cada día.
- **Cada red** («Network pulse»): Instagram, Facebook, Messenger y el resto, con lo que te vieron, la barra contra la que más, cuántos
  agendaron y cuántos tocan.
- **Quién te ve en Instagram** («Inbox pulse»): las tres edades que más te ven, el reparto por género y las tres regiones donde más te ven.
- **De dónde llegan tus leads** («Team activity»): cada origen con sus leads y su parte.
- Tocar un anuncio, una red, una edad, una región o un origen abre el detalle de siempre de su pieza. «Ver la grilla» va al pie.

**Lo que se copió de Murmura, y cómo se midió:**
- La copia (`docs/diseno/mockups-dashboard/instagram-murmura/copia.html` con `murmura.css` y `murmura.js`) sale de lo medido del demo:
  `valores.json`, las capturas a 1440 y a 390, los estados y el INFORME. **Nada del código de la tienda, ni el cartel «BUY THIS
  TEMPLATE», ni sus fotos** (las miniaturas son colores propios). Los íconos son trazos propios.
- **A 1440 la copia mide 2.342 contra 2.334 de la captura**, con cada tarjeta a menos de 5 px; **en el teléfono, 5.393 contra 5.383**
  (la captura a 390 tiene la barra de desplazamiento de 15 px: se compara a 375). La copia trae también la barra de abajo del teléfono.
- **La adaptación cae en las MISMAS cajas que la copia** (a 1360 sin la barra de la izquierda de Murmura, que en MaKo pone la app). Hay
  dos pasos intermedios que Murmura no tiene: hasta 1320 px el saludo va en su renglón y los tres números se reparten el ancho (el ancho
  del Dashboard con la barra lateral es ~1200); hasta 1000, la fila de abajo pasa a dos columnas, «Después» a una y el eje del gráfico usa
  las fechas del teléfono.
- **El movimiento, de las RECETAS del INFORME:** el saludo sube por palabra con un giro de 6° (.85 s, power4.out, 22 ms); la frase, los
  números y el botón entran desde 14 px (.55 s, 80 ms, a los .12 s); las tarjetas suben desde 34 px y .985 (.9 s, 70 ms, a los .2 s); las
  filas entran desde 12 px (.55 s, 45 ms, a los .45 s); los días se levantan desde 40 px girados ±3° y .94 (.8 s, back.out(1.4), 60 ms, a
  los .5 s); las barras crecen (1 s, 60 ms, a los .6 s); los números cuentan 1,2 s. Al pasar, los días y la tarjeta grande suben 4 px (.45 s;
  bajan en .5 s).
- **⚠️ Lo SUPUESTO:** el INFORME de Murmura trae la librería de recetas y el armazón, no la línea de tiempo de la página: qué pieza usa
  cuál receta, a qué demora, y qué lleva `data-lift`, es mío (lo anotado arriba).

**Lo que Murmura tiene y MaKo no mide, y no está:** los **seguidores** y su crecimiento (la curva es de leads de anuncios), la
**interacción** y los **guardados** de cada publicación, las **aprobaciones** del equipo, la **bandeja** de mensajes con su sentimiento,
la **actividad del equipo**, las cuentas de cada cliente (la insignia de un turno es su formato), y las redes que no son de Meta (TikTok,
YouTube, Pinterest, X, Threads, LinkedIn). El 30D/90D del gráfico tampoco: el período es el de la hoja. Meta no da las **agendas por región**
ni el **alcance sumado** entre filas.
**La plantilla suma una pieza** («Leads de tus anuncios, día por día», de los anuncios de Meta) **y cambia tres**: «Instagram contra
Facebook» trae el alcance, «Agendan por región» pasa a «Dónde te ven» (vistas) y «Qué anuncio trajo clientes» trae cinco (eran cuatro);
el número «Alcance en Instagram» se va (nunca tuvo valor). «Costo por mil» y lo demás quedan en la grilla.

**Dónde vive:**
- El modelo: `lib/instagram-diseno.ts`, puro. Los datos de ejemplo: `lib/instagram-diseno-muestra.ts` (cuadran entre bloques: la frase es
  la fila de Instagram de cada red, y el CTR y el costo por mil salen de sus clics, sus vistas y lo invertido).
- El dibujo: `app/dashboard/disenos/HojaInstagram.tsx`; lo vivo, `InstagramVivo.tsx` (con `useGeneral`); la hoja de estilos,
  `instagram-css.ts` (la arma `scratchpad/ig/armar-ig.py` desde `instagram-murmura/murmura.css`: todo con el prefijo `mur-`).
- La plantilla: `lib/general-plantillas.ts` («instagram», once piezas en el diseño, `diseno.id = 'instagram'`); `DISENOS_HOJA` en
  `lib/graficos-catalogo.ts`.
- Los tests: `tests/dashboard-diseno-instagram.test.ts` (10, probado rompiéndolo de veintidós maneras: cada rotura sola da rojo).

## Agencia o servicio: la decimosexta hoja copiada (la de Sunrow), con «¿cada cliente va en fecha?» (en producción desde el 5/11/2026, 01:59)

La referencia de Agencia o servicio es Sunrow (`docs/templates-dashboard-propuesta.md` §7.3): la página «Overview» de Sunrow (un ERP de
obras solares, claro y de vidrio): la barra de arriba y la de la izquierda, el saludo con el clima y el arco de la luz del día, la tarjeta
oscura de la IA, seis números de colores, «Timeline progress» (la curva del plan contra lo real), «Budget utilization», «Site-wise
performance», los atajos, «Recent project updates», «Critical issue alerts», «Upcoming deadlines», y a la derecha el Calendario, «My
tasks» y «Notifications».

**Qué cambia para Martín:**
- **«Nueva hoja» de General ofrece «Agencia o servicio» con el diseño de Sunrow**, con su miniatura de verdad.
- **Arriba:** «Buenos días, Ana» con la fecha, y una frase con lo que hay: cuántos clientes, en cuántas etapas, cuántos te necesitan
  hoy y cuántas cuotas están vencidas. Tres píldoras: las reuniones de hoy, las sesiones dadas y en cuántos funnels hay clientes.
- **Lo que le queda a tu agenda** (el arco de «Daylight left on site»): de lo primero a lo último que tienes hoy con hora en el
  Calendario, el punto donde está el reloj, cuánto falta y a qué hora termina lo último. Sin nada con hora hoy, lo dice.
- **Tu cartera hoy** (la tarjeta oscura): qué parte de tus clientes no pide atención (el medidor «de cada 100»), el primero que te
  necesita y hace cuánto no hablan, y «Ver tus clientes».
- **Los seis números:** clientes (con en cuántas etapas), avanzaron de etapa y lo cobrado (contra el período anterior), piden atención,
  sesiones dadas (con cuántas por cliente) y deuda vencida (con las cuotas vencidas).
- **Avanzaron de etapa** («Timeline progress»): los clientes que llegaron a una etapa, sumados semana a semana en los últimos 90 días, con
  la marca de hoy al final; abajo, los de esta semana, los de los 90 días y el promedio por semana.
- **Lo que te deben** («Budget utilization»): el anillo con lo vencido sobre todo lo que falta cobrar, el total, lo vencido de 1 a 30
  días, lo de más de 30 y lo que sigue al día, cuántas cuotas están vencidas y los cuatro que más te deben.
- **Quién te necesita** («Site-wise performance»): seis clientes con su señal, hace cuánto no hablan, sus sesiones y lo que deben.
- **Atajos** («Quick links»): «Ver la grilla» y las pantallas de MaKo donde se trabaja esto.
- **Clientes por etapa** («Recent project updates»), **Salud del negocio** («Critical issue alerts»: el Semáforo de General, con Urgente o
  Atención), **Lo que vence** («Upcoming deadlines»: las tareas del Plan con fecha), el **Calendario** del mes con lo de hoy,
  **Prioridades** («My tasks»: las del Plan, para tildar con «Deshacer») y **Lo que viene** («Notifications»: lo de los próximos días).
- Tocar un cliente, una etapa o uno de los que más deben abre el detalle de siempre de su pieza.

**Lo que se copió de Sunrow, y cómo se midió:**
- La copia (`docs/diseno/mockups-dashboard/servicio-sunrow/copia.html` con `sunrow.css` y `sunrow.js`) sale de lo medido del demo:
  `valores.json`, las capturas a 1440 y a 390 y el INFORME. **Nada del código de la tienda, ni el cartel «BUY THIS TEMPLATE».** Los íconos
  son trazos propios.
- **A 1440 la copia mide 2.657 contra 2.656 de la captura**; a 390, 5.789 contra 5.777.
- **La adaptación cae en las MISMAS cajas que la copia**: el saludo de 983 de ancho con la tarjeta oscura de 337, los números de tres en
  fila, las dos tarjetas de 484 lado a lado y la columna de 315 a la derecha (a 1360). Hay dos pasos intermedios que Sunrow no tiene: hasta
  1280 px el arco baja debajo del saludo, y hasta 1000 la columna de la derecha pasa abajo, de a dos.
- **El movimiento, de la línea de tiempo del INFORME:** la tarjeta de arriba sube desde 24 px (.9 s, power3.out); el saludo sube por
  palabra con un giro de 6° (.85 s, power4.out, 22 ms, a los .05 s); la fecha, la frase y las píldoras entran desde 10 px (.55 s, 60 ms, a
  los .15 s); la tarjeta oscura entra desde 30 px a la derecha y .97 (.8 s, a los .2 s); los números suben desde 22 px (.9 s, 60 ms, a los
  .25 s); las tarjetas desde 30 px (.9 s, 70 ms, a los .4 s); las barras crecen (1 s, 80 ms, a los .7 s); las filas entran desde 10 px
  (.55 s, 25 ms, a los .75 s); los días del mes crecen desde .4 de hoy hacia afuera (.6 s, back.out(3), 12 ms, a los .8 s); los números
  cuentan 1,2 s. Al pasar, un número sube 4 px (.45 s; baja en .5 s). Medido en el arnés: 106 animaciones, ningún error.
- **⚠️ Lo SUPUESTO:** cómo entran la curva y el anillo no está en lo medido: la curva se dibuja de izquierda a derecha y el anillo crece
  desde cero, a los .7 s.

**Lo que Sunrow tiene y MaKo no mide, y no está:** el **clima** y el **viento**, la **luz del día** (el arco es lo que queda de tu agenda),
el **plan contra lo real** de cada obra (las líneas «Planned», «Forecast» y «Baseline»), el **presupuesto comprometido** y el **pronóstico
de la IA** («Delivery confidence» y su «Key insight»: la tarjeta oscura dice lo que la cartera ya sabe). El botón «Ask Sunrow AI» no está:
en MaKo está la estrella de cada tab. Las flechas del mes del Calendario tampoco: el Calendario de General trae dos semanas, y el botón de
al lado abre el Calendario. **⚠️ «En fecha» sigue sin una fecha comprometida por etapa**: la entrega no la guarda, y lo que se mide es
cuándo llegó cada cliente a su etapa.
**La plantilla suma dos piezas** («Te deben», por días de atraso, y «Los que más te deben», de los pagos, con los mismos filtros) **y cambia
dos**: «Quién te necesita hoy» trae seis clientes (eran tres) y «Avanzaron, por semana» mira los últimos 90 días (las semanas del mes eran
dos o tres puntos). Los bloques de cobranza y de agenda quedan en la grilla.

**Dónde vive:**
- El modelo: `lib/servicio-diseno.ts`, puro. Los datos de ejemplo: `lib/servicio-diseno-muestra.ts` (cuadran entre bloques: las etapas
  suman la cartera, lo que te deben por atraso suma el total y los que piden atención son los de la lista con la señal «Atención»).
- El dibujo: `app/dashboard/disenos/HojaServicio.tsx`; lo vivo, `ServicioVivo.tsx` (con `useGeneral` y `useCompletar`); la hoja de
  estilos, `servicio-css.ts` (la arma `scratchpad/srv/armar-srv.py` desde `servicio-sunrow/sunrow.css`: todo con el prefijo `srw-`).
- La plantilla: `lib/general-plantillas.ts` («servicio», once piezas en el diseño, `diseno.id = 'servicio'`); `DISENOS_HOJA` en
  `lib/graficos-catalogo.ts`.
- Los tests: `tests/dashboard-diseno-servicio.test.ts` (12, probado rompiéndolo de veintiuna maneras: cada rotura sola da rojo).

## Curso o comunidad: la decimoquinta hoja copiada (la de Vitrea), con «¿cuántos siguen ahí?» (en producción desde el 5/11/2026, 01:20)

La referencia de Curso o comunidad es Vitrea (`docs/templates-dashboard-propuesta.md` §7.3): la página «Overview» de Vitrea (un panel de
un estudio de apps, oscuro y de vidrio): la barra de arriba y la de la izquierda, el título con tres números, «Proceeds» (un área grande),
«Ratings», «Your apps» (seis tarjetas de color), «Release train», «Waiting for a reply», «Today» y «Recent activity».

**Qué cambia para Martín:**
- **«Nueva hoja» de General ofrece «Curso o comunidad» con el diseño de Vitrea**, con su miniatura de verdad.
- **Arriba:** «Tus alumnos» (el título de la frase de apertura de la hoja) y tres números: los **alumnos activos**, las **ventas** y lo
  **cobrado**, cada uno con su cambio contra el período anterior, y «Ver la grilla» a la derecha.
- **Alumnos que vieron clases** («Proceeds»): el área de los alumnos de cada día, el total y el mejor día; con «Clases», las clases de
  cada semana y la mejor semana. El eje lleva los rótulos a la misma distancia, desde hoy.
- **Cuánto avanzan** («Ratings»): el avance promedio con su barra (en lugar de las estrellas), cuántos alumnos van en cada estado y, al pie,
  cuántos clientes piden atención hoy.
- **Por área** («Your apps»): una tarjeta de color por área, con sus alumnos y su parte.
- **Quién te necesita** («Release train»): cuántos clientes hay en cada tramo de hace cuánto no hablan (en lugar de las etapas del tren) y
  los cuatro que piden atención primero, cada uno con «Abrir».
- **Lo que vas a publicar** («Waiting for a reply») y **Hoy** («Today»): el Calendario de General, con lo de hoy tildado y tachado cuando
  ya pasó. «Agendar» lleva al Calendario.
- Tocar un área, un estado, un tramo o un cliente abre el detalle de siempre de su pieza.

**Lo que se copió de Vitrea, y cómo se midió:**
- La copia (`docs/diseno/mockups-dashboard/curso-vitrea/copia.html` con `vitrea.css` y `vitrea.js`) sale de lo medido del demo:
  `valores.json`, las capturas a 1440 y a 390 y el INFORME. **Nada del código de la tienda, ni el cartel «BUY THIS TEMPLATE».** Los
  planetas y los arcos del fondo son una ilustración del demo: va un fondo propio con la misma luz.
- **A 1440 la página mide 1.653, igual que la captura**; a 390, 3.603 contra 3.605.
- **La adaptación cae en las MISMAS cajas** a 1360 (la grilla de 1.314 de la copia): 871×396 y 427×396 arriba, 1314×266 las áreas, y
  tres de 427×534 abajo. Entre 701 y 1000 px hay un paso intermedio que Vitrea no tiene (de a dos columnas).
- **El movimiento, de la línea de tiempo del INFORME:** el título sube por palabra con un giro de 6° (.85 s, power4.out, 22 ms); los
  números de arriba entran desde 14 px (.55 s, 80 ms, a los .12 s); cada tarjeta se descubre desde 22 px, .975 y un recorte de abajo
  (.75 s, expo.out, 60 ms, desde los .2 s) y su contenido entra desde 8 px (.4 s, 30 ms); los números cuentan desde cero (1,2 s, a los
  .25 s). Los hover son los del CSS de la copia (los botones redondos, el selector y las pestañas).
- **⚠️ Lo SUPUESTO:** el recorte con que entra cada tarjeta lo arma una función del INFORME que no se ve entera; acá sale de abajo hacia
  arriba desde el 30 %. Al pasar sobre un área, la tarjeta se aclara un poco (Vitrea no dice nada de eso: es lo único que se suma).

**Lo que Vitrea tiene y MaKo no mide, y no está:** la **línea del año anterior**, las **estrellas** y las **reseñas**, el **tren de
versiones con sus pasos** y la **actividad del equipo** («Recent activity», que no se dibuja). La **permanencia por cohorte** (cuántos
siguen al mes 3) tampoco se mide todavía (§7.4 de la propuesta). La barra de arriba y la de la izquierda las pone la app.
**La plantilla suma dos piezas** («Hace cuánto no hablan» y «Quién te necesita hoy», de la cartera); el bloque de publicaciones queda en la
grilla, y el diseño lee el Calendario directo.

**Dónde vive:**
- El modelo: `lib/curso-diseno.ts`, puro. Los datos de ejemplo: `lib/curso-diseno-muestra.ts` (cuadran entre bloques: los estados y las
  áreas suman los alumnos activos, las clases de cada semana suman las del período y los tramos suman la cartera).
- El dibujo: `app/dashboard/disenos/HojaCurso.tsx`; lo vivo, `CursoVivo.tsx` (con `useGeneral`); la hoja de estilos, `curso-css.ts` (la
  arma `scratchpad/vcu/armar-vcu.py` desde `curso-vitrea/vitrea.css`: todo con el prefijo `vit-`).
- La plantilla: `lib/general-plantillas.ts` («curso», doce piezas en el diseño, `diseno.id = 'curso'`); `DISENOS_HOJA` en
  `lib/graficos-catalogo.ts`.
- Los tests: `tests/dashboard-diseno-curso.test.ts` (9, probado rompiéndolo de quince maneras: cada rotura sola da rojo).

## Contenido e IA: la decimocuarta hoja copiada (la de Orrery), con «¿cuánta IA gastamos y en qué?» (en producción desde el 4/11/2026, 23:56)

La referencia de Contenido e IA es Orrery (`docs/templates-dashboard-propuesta.md` §7.3): la página «Overview» de Orrery (un panel de una
API de IA): la barra lateral y la de arriba, cuatro tarjetas de números, «Requests per hour» (un área grande), «Model status» (el tiempo en
línea de cada modelo en una franja de 30 celdas), «Spend by model», «Recent requests» y «Quickstart» (el código para empezar, en un recuadro
gris).

**Qué cambia para Martín:**
- **«Nueva hoja» del Dashboard ofrece «Contenido e IA» con el diseño de Orrery**, con su miniatura de verdad.
- **Arriba:** el período de la hoja, el saludo y la frase del uso («Usaste la IA 8,570 veces · 12% más que el período anterior.»), y «Ver la
  grilla» y «Tus cuentas de IA».
- **Las cuatro tarjetas:** el **costo de la IA** y el **costo por llamada** (con su línea de cada día y el cambio contra el período anterior:
  gastar más va en rojo), **qué parte de lo pedido a Flow salió bien** (con su barra, «130 de 134 pedidos» y cuántos fallaron) y los
  **pedidos a Flow** con los que fallaron.
- **Lo gastado por día** («Requests per hour»): el área del costo de cada día del período, con el eje en dólares redondos; la pastilla dice
  si va por día, por semana o por mes (en lugar del verde de «Live»).
- **Videos e imágenes** («Model status»): cada tipo de pedido a Flow con una franja de 30 celdas donde las ámbar son la PARTE que falló (no
  días: lo dice el subtítulo), «Bien» desde el 90 % y «Con fallas» debajo. Tocar un tipo abre su detalle.
- **Qué modelo cuesta más** («Spend by model»): el costo de cada modelo, su barra y su parte del total.
- **Para qué se usa** («Recent requests»): las llamadas de cada función de MaKo, con su parte en la pastilla verde.
- **Quién le escribe a MaKo** («Quickstart»): los mensajes de cada persona, en el recuadro gris de la copia.

**Lo que se copió de Orrery, y cómo se midió:**
- La copia (`docs/diseno/mockups-dashboard/contenido-orrery/copia.html` con `orrery.css` y `orrery.js`) sale de lo medido del demo:
  `valores.json`, las capturas a 1440 y a 390 y el INFORME. **Nada del código de la tienda, ni el cartel «BUY THIS TEMPLATE».**
- **A 1440 la página mide 1.364, igual que la captura:** las tarjetas de números en 284, 569, 854 y 1139 (269×208, desde 200); el área y
  el estado en 744 y 364 (475 de alto); la fila de abajo en tres de 364 (393 de alto).
- **A 390 la página mide 2.600 contra 2.601** de la captura: dos tarjetas de números por fila (174×157 y 174×160), y el resto en una
  columna. El eje de abajo pasa de nueve rótulos a cuatro.
- **La adaptación cae en las MISMAS cajas** a 1188 (el ancho del lienzo del Dashboard: Orrery tiene la misma barra de 252 px). Entre 701 y
  1000 px hay un paso intermedio que Orrery no tiene: dos tarjetas de números por fila, el área a lo ancho y la fila de abajo de a dos.
- **El movimiento, de la línea de tiempo del INFORME:** los títulos suben desde abajo (115 % → 0, .8 s, power4.out, 22 ms); a los .1 s las
  tarjetas aparecen desde 32 px más abajo y .985 (.8 s, power3.out, 65 ms); a los .25 s los números cuentan desde cero (1,3 s; los del costo
  de cada modelo, 1,2 s), con sus decimales; a los .45 s las líneas chicas se descubren de izquierda a derecha (1,1 s, power3.inOut); a los
  .55 s las filas de las listas entran desde 10 px (.5 s, 40 ms). Al pasar, una fila que se abre toma el fondo gris de «Recent requests» y
  un link se subraya, como en Orrery.
- **⚠️ Lo SUPUESTO:** cómo entra el área grande (el INFORME sólo dice que entra a los .4 s: la línea se dibuja de izquierda a derecha en
  1,1 s) y las barras del costo de cada modelo (crecen desde la izquierda con su número, 1,2 s). Qué tarjetas «suben» al pasar en Orrery no
  está en lo medido: la adaptación no sube ninguna.

**Lo que Orrery tiene y MaKo no mide, y no está:** el **estado de cada modelo y su tiempo en línea** (MaKo no mide la disponibilidad de un
proveedor), la **latencia**, el **tope de gasto del mes y su pronóstico**, los **pedidos uno por uno en vivo** y el **código para empezar**.
La barra lateral y la de arriba las pone la app.
**La plantilla no perdió nada:** dibuja sus diez piezas.

**Dónde vive:**
- El modelo: `lib/contenido-diseno.ts`, puro. Los datos de ejemplo: `lib/contenido-diseno-muestra.ts` (cuadran entre bloques: el costo de
  cada día suma el del período, los modelos suman lo gastado, las funciones suman las llamadas y los pedidos de cada día suman los de Flow).
- El dibujo: `app/dashboard/disenos/HojaContenido.tsx`; lo vivo, `ContenidoVivo.tsx`; la hoja de estilos, `contenido-css.ts` (la arma
  `scratchpad/orr/armar-orr.py` desde `contenido-orrery/orrery.css`: todo con el prefijo `orr-`).
- La plantilla: `lib/graficos-plantillas-generales.ts` («ia-contenido», diez piezas, `diseno.id = 'contenido'`); `DISENOS_HOJA` en
  `lib/graficos-catalogo.ts`.
- Los tests: `tests/dashboard-diseno-contenido.test.ts` (9, probado rompiéndolo de trece maneras: cada rotura sola da rojo).

## Productividad: la decimotercera hoja copiada (la de Fernly), con «¿qué avanza y qué se estancó?» (en producción desde el 4/11/2026, 23:09)

La referencia de Productividad es Fernly (`docs/templates-dashboard-propuesta.md` §7.3; Sunrow, la otra, queda por copiar): la página
«Dashboard» de Fernly (un gestor de proyectos): la barra lateral y la de arriba, cuatro tarjetas de números, «Project Analytics» (siete
columnas, una por día), «Reminders», «Project» (una lista con su fecha), «Team Collaboration» (personas con su estado), «Project Progress»
(un medio arco) y «Time Tracker» (un cronómetro en una tarjeta oscura).

**Qué cambia para Martín:**
- **«Nueva hoja» del Dashboard ofrece «Productividad» con el diseño de Fernly**, con su miniatura de verdad.
- **Arriba:** el saludo y la frase del tablero («Tienes 34 tareas activas: 8 en curso. Ya hiciste 23.»), y «Ver el Plan» y «Ver la grilla».
- **Las cuatro tarjetas:** el **avance global** de los proyectos (la verde), las **estancadas** (más de 7 días sin moverse), las de **Alta sin
  deadline** y cuántas se cerraron **a tiempo**. Sin «↑ desde el mes pasado»: la hoja es la foto de hoy del tablero y no tiene con qué
  compararse. Un % que no se puede medir dice «—», nunca 0 %.
- **Lo que vence, por semana** («Project Analytics»): una columna por semana de los próximos 30 días; **esta semana oscura**, las que tienen
  algo verdes y las vacías rayadas (como los días que faltan en Fernly). La más alta lleva su número encima. Tocar una semana abre su detalle.
- **Lo más quieto** («Reminders»): la tarea activa que más tiempo lleva sin tocarse, cuántos días y si su deadline se corrió, con «Abrir en
  el Plan».
- **Lo que huele mal** («Team Collaboration»): las cuatro que siguen, con iniciales en lugar de caras, cuántos días llevan quietas, cuántas
  veces se movió su fecha y una pastilla: **Quieta** (más de 7 días), **Se corre** (dos o más cambios de fecha) o **Al día**. Son tareas, no
  personas: las tareas de esta fuente no tienen responsable.
- **Proyectos** («Project»): los cinco primeros proyectos activos con un aro de su avance y «N% de avance»; «N más» lleva al Plan.
- **Tus tareas** («Project Progress»): el medio arco de las **hechas** (verde), las **en curso** (oscuro) y las que **no empezaron**
  (rayado), con el % de hechas en el centro.
- **Activas por prioridad** («Time Tracker»): cuántas activas hay en **Alta, Media y Baja**, en la tarjeta oscura, y «y N a futuro» si hay.

**Lo que se copió de Fernly, y cómo se midió:**
- La copia (`docs/diseno/mockups-dashboard/productividad-fernly/copia.html`) sale de lo medido del demo: `valores.json`, las capturas a 1440
  y a 390 y el INFORME. **Nada del código de la tienda, ni el cartel «BUY THIS TEMPLATE», ni las caras del demo** (van iniciales).
- **A 1440 cae a ±1 px:** las tarjetas de números en 296, 578, 860 y 1142 (266×158, desde 197); la fila de abajo en 371 y 679 (292 de
  alto); «Project» de 371 a 759 y el cronómetro de 775 a 971; las columnas, los renglones de las listas, el medio arco y la leyenda a ±1.
- **A 390 las diez tarjetas caen a ±1 px y la página mide 2.415, igual que la captura.** El orden del teléfono no es el de la computadora:
  números, columnas, recordatorio, proyectos, equipo, progreso y cronómetro. La barra de arriba lleva el menú (tres rayas de 16, 16 y 11 px).
- **Tres trampas medidas, las tres en la hoja de la copia:** la pastilla del estado heredaba el tamaño y el gris de `.tlist span` (más
  específica que `.pill`), el círculo de las iniciales heredaba `display: block` de `.me span`, y una lista en `display: grid` sin
  `minmax(0, 1fr)` se ensancha con un texto que no se corta y corre todo 4 px afuera (§26 de los hallazgos).
- **El movimiento, del INFORME:** los títulos suben desde abajo (115 % → 0, .85 s, power4.out, 24 ms de escalera); las tarjetas aparecen desde
  36 px más abajo y .985 (.85 s, power3.out, 70 ms); las filas de las listas entran desde 12 px (.55 s, power3.out, 50 ms); los números
  cuentan 1,3 s con power3.out; las columnas crecen desde abajo y los tramos del medio arco se dibujan (1,3 s, power3.out). Una tarjeta de
  números sube 4 px al pasar el mouse (.45 s, power3.out).
- **⚠️ Lo SUPUESTO:** el reloj del cronómetro tiene un rodillo de dígitos (el INFORME nombra `.tracker__time`) que deja ver apenas el número
  de abajo; la copia dibuja los dígitos quietos. Y las rayas del fondo de la tarjeta oscura en Fernly son arcos de un círculo mucho más grande:
  la copia los dibuja con el centro abajo a la izquierda.

**Lo que Fernly tiene y MaKo no mide, y no está:** el **cronómetro** (el tiempo trabajado), **quién del equipo trabaja en qué** (las tareas de
esta fuente no tienen responsable) y **la comparación con el mes pasado** (la hoja no tiene período). La barra lateral y la de arriba las
pone la app.
**La plantilla no perdió nada:** la matriz de impacto × esfuerzo y lo que queda en cada proyecto siguen en la grilla («Ver la grilla»).

**Dónde vive:**
- El modelo: `lib/productividad-diseno.ts`, puro. Los datos de ejemplo: `lib/productividad-diseno-muestra.ts` (cuadran entre tarjetas).
- El dibujo: `app/dashboard/disenos/HojaProductividad.tsx`; lo vivo, `ProductividadVivo.tsx`; la hoja de estilos, `productividad-css.ts`
  (la arma `scratchpad/frn/armar-frn.py` desde `productividad-fernly/fernly.css`: todo con el prefijo `frn-`).
- La plantilla: `lib/graficos-plantillas-analysts.ts` («productividad», once piezas, `diseno.id = 'productividad'`); `DISENOS_HOJA` en
  `lib/graficos-catalogo.ts`.
- Los tests: `tests/dashboard-diseno-productividad.test.ts` (10, probado rompiéndolo de diez maneras: cada rotura sola da rojo).

## CS Analyst: la duodécima hoja copiada (la de Mender), con «¿quién necesita atención?» (en producción desde el 4/11/2026, 22:33)

La referencia de CS Analyst es Mender (`docs/templates-dashboard-propuesta.md` §7.3; Vitrea, la otra, queda por copiar): la página «Cases
overview» de Mender (una app de soporte): la barra de arriba y un riel, el tablero «Case pipeline» con cuatro carriles (New, Working, Waiting
on client, Resolved) y sus pestañas, «Top case drivers» (un anillo con su leyenda y 30/90 días) y «Case health» (tres medidores).

**Qué cambia para Martín:**
- **«Nueva hoja» del Dashboard ofrece «CS Analyst»** con su miniatura de verdad.
- **Arriba:** el saludo y la frase de la cartera («4 de tus 14 clientes piden atención. Deben US$1,350 vencidos. Tuvieron 33 sesiones en el
  período.»).
- **Tu cartera por etapa** («Case pipeline»): **un carril por etapa de la entrega**, en el orden del servicio (el mismo de Clients), con
  cuántos clientes tiene. Cada cliente con sus iniciales, el **aro coral si pide atención**, cuándo habló por última vez («habló hace 8-14
  días», «nunca habló»), **«Debe»** si tiene cuotas vencidas, el reloj si hace más de dos semanas que no hablan y el doble tilde si está al
  día. Arriba en cada carril, los que piden atención. Hasta cinco por carril y «y N más» (lleva a Clients). **Las pestañas filtran**: Todos,
  Piden atención, Al día y Sin hablar. Tocar un cliente abre su detalle. A la derecha, «Ver clientes» y la grilla. Más de cuatro etapas: los
  carriles se corren de costado.
- **Por qué piden atención** («Top case drivers»): el anillo de los **motivos de la señal** (cuota vencida, nunca hablaron, silencio…: los
  tres con más clientes y «Lo demás»), o con «Señal», **cómo está toda la cartera** (atención, bien, sin datos). La barra de cada renglón es
  contra el más grande, como Mender. Tocar un motivo abre su detalle.
- **Cómo está tu cartera** («Case health»): tres medidores: **hablaron hace poco** (los de los últimos 14 días), **sin pedir atención** y
  **siguen contigo** (los que no se dieron de baja). Verde desde el 80 %, ámbar desde el 60 %, coral debajo.

**Lo que se copió de Mender, y cómo se midió:**
- La copia (`docs/diseno/mockups-dashboard/cs-mender/copia.html`) sale de lo medido del demo: `valores.json`, las capturas, los estados de los
  controles y el INFORME. **Nada del código de la tienda, ni el cartel «BUY THIS TEMPLATE», ni las caras dibujadas del demo** (van iniciales).
- **A 1440 cae a ±1 px:** el tablero 1306×568 en 106,147; las pestañas de 548 a 971 (y 168 a 216); los encabezados de los carriles en 234 y
  las tarjetas cada 82 px desde 298; la fila de abajo en 733; el anillo de 141 a 312 y de 823 a 994; las barras de la leyenda de 565 a 660 y
  los porcentajes hasta 714; los medidores desde 828 y 1031, de 824 a 933. **A 390** el tablero va de 193 a 799 (contra 798), las pestañas de
  270 a 317 y las tarjetas cada 78 px desde 400 (60 de alto). **El anillo y los medidores del demo a 390 se fotografiaron en cero** (su entrada
  no había corrido): ahí no hay con qué comparar los valores, sólo las cajas.
- **El fondo:** el halo esmeralda de arriba a la izquierda (el `--glow-a` de Mender, medido en la captura: una elipse de 600×450 que se apaga
  hacia el centro). El `--glow-b` coral existe como variable y no se ve en la captura: no se dibujó.
- **El movimiento, del INFORME (trae las funciones de la página):** los números cuentan 1,1 s con power3.out; los medidores se dibujan desde su
  valor (1,1 s, power3.out, 30 ms de escalera); el anillo reparte sus tramos en 1,1 s con power3.inOut y 60 ms de escalera, y al cambiar de
  pestaña va del reparto viejo al nuevo; las tarjetas entran desde .92 con back.out(1.5) en .45 s, también al filtrar; la pastilla de las
  pestañas se corre .5 s con expo.out. El hover, el del INFORME: la tarjeta y la fila de la leyenda se aclaran (.2 s).
- **⚠️ Lo SUPUESTO** (no está en el INFORME): la cabecera y los paneles suben al entrar (.6 y .7 s, power3.out).
- **⚠️ Lo que Mender hace y la copia no:** sus otras pestañas (In progress, Resolved, Expired) cambian a una grilla de tarjetas que no se midió;
  en la copia sólo se corre la pastilla, y en la adaptación las pestañas filtran los carriles (como su búsqueda, que sí está en el INFORME).

**Lo que Mender tiene y MaKo no mide, y no está:** la **primera respuesta** de un caso, la **satisfacción** de 1 a 5, el **SLA**, el **avance**
de cada caso («56% through») y **por qué se van** (el motivo de baja no se guarda: §7.4 de la propuesta; por eso el anillo dice por qué PIDEN
ATENCIÓN). La barra de arriba y el riel los pone la app.
**La plantilla no perdió nada que se viera:** las pausas, las cuotas vencidas, las sesiones por semana y la caja de MaKo siguen en la grilla;
la tabla de la cartera suma la columna del producto y hay una pieza nueva, «Cada cliente, por etapa» (13 piezas).

**⚠️ Para la próxima hoja:** la etapa de cada cliente sale del CRUCE de la pieza (cliente × etapa), no de una columna de la tabla: un cliente
de dos servicios está en dos etapas, y la columna las junta en un texto («Arranque, Entrega») que no se puede partir. Y el orden de las etapas
lo lee la página aparte (`lib/cs-diseno-server.ts`): la pieza las ordena por cuántos clientes tienen (§25 de los hallazgos).

**Dónde vive:**
- El modelo: `lib/cs-diseno.ts`, puro. Los datos de ejemplo: `lib/cs-diseno-muestra.ts` (cuadran entre tarjetas). El orden de las etapas:
  `lib/cs-diseno-server.ts`.
- El dibujo: `app/dashboard/disenos/HojaCs.tsx`; lo vivo, `CsVivo.tsx`; la hoja de estilos, `cs-css.ts` (la arma `scratchpad/csm/armar-mnd.py`
  desde `cs-mender/mender.css`: todo con el prefijo `mnd-`).
- La plantilla: `lib/graficos-plantillas-analysts.ts` («cs-analyst», trece piezas, `diseno.id = 'cs'`); `DISENOS_HOJA` en
  `lib/graficos-catalogo.ts`.
- Los tests: `tests/dashboard-diseno-cs.test.ts` (8, probado rompiéndolo de diez maneras: cada rotura sola da rojo).

## Automatizaciones: la undécima hoja copiada (la de Noria), con «¿qué corrió y qué falló?» (en producción desde el 4/11/2026, 22:01 UTC)

La referencia de Automatizaciones es una sola (Noria, `docs/templates-dashboard-propuesta.md` §7.3): la página «Overview» de Noria (una app
de automatizaciones): una barra lateral oscura, el saludo con su frase, «Run pulse» (cuatro números y el pulso por hora con la línea de una
semana antes), «Live now» (la corrida en curso paso por paso), «Needs a look», «Reliability» (14 días en casillas), «Ask Copilot», la tabla
«Busiest flows» con sus 14 días y «Team activity».

**Qué cambia para Martín:**
- **«Nueva hoja» del Dashboard ofrece «Automatizaciones»** con su miniatura de verdad.
- **Arriba:** la fecha y el período en las migas, el saludo y la frase («Salieron 1,779 mensajes. 52 no salieron y esperan que los mires.
  Te respondieron 355 veces.»); a la derecha, «Ver la grilla» y «Nueva automatización» (lleva a Automations).
- **El pulso** («Run pulse»): cuatro números con su cambio contra el período anterior: los **mensajes** que salieron, **qué parte salió
  bien** (lo que salió sobre lo que se intentó: salió o falló; en puntos), **te respondieron** (la tasa de respuesta) y las **personas que
  entraron**, con cuántas **siguen en el flujo**. Debajo, **día por día** lo que salió (verde) y lo que falló (rojo, arriba), con la **línea
  dorada del mismo día una semana antes** (lo que se intentó) y «Hoy» marcado; «7 días · 30 días»; al pasar sobre un día, un globo con lo
  que salió, lo que falló y lo de antes. Tocar un día abre su detalle.
- **El recorrido** («Live now»): de entrar a responder en cuatro pasos (**entraron**, **les escribió MaKo**, **respondieron**, **siguen en el
  flujo**, cada uno con su parte), **en cuánto responden** en promedio y **cómo terminaron** (respondió, pasó a una persona, terminó la
  secuencia…).
- **Dónde falló** («Needs a look»): las automatizaciones con mensajes que no salieron, cuántos y qué parte de sus envíos, con «Revisar» (lleva
  a Automations; MaKo no reintenta desde el tablero). Sin fallas, lo dice en verde.
- **Qué tan bien salen** («Reliability»): los **últimos 14 días** de cada automatización, las que más mandan primero, en casillas (99.5 %+,
  98 %+, 95 %+, menos; gris = ese día no mandó nada) y su porcentaje.
- **Pregúntale a MaKo** («Ask Copilot»): la caja abre el chat de MaKo; debajo, tres atajos (revisar la que más falló, contestar a quien
  respondió, crear una nueva).
- **Las que más mandan** («Busiest flows»): la tabla por automatización: si falló (o «Sin fallas»), sus 14 días, sus envíos, qué parte salió
  bien y cuántas respuestas. **En cuántas horas responden** («Team activity»): cada automatización con lo que tardan en contestarle.

**Lo que se copió de Noria, y cómo se midió:**
- La copia (`docs/diseno/mockups-dashboard/automatizaciones-noria/copia.html`) sale de lo medido del demo: `valores.json`, las capturas, los
  estados de los controles y el INFORME. **Nada del código de la tienda, ni el cartel «BUY THIS TEMPLATE».** El subtítulo de «Ask Copilot»
  que el cartel tapa a 1440 se leyó de la captura a 390.
- **Las cajas de la copia caen a ±1 px a 1440** (el pulso 749×604 en 282,191 y sus números 707×119 en 303,266; «Live now» 367×604; la fila de
  abajo en 811 contra 812, de 495 contra 496; la tabla y el feed en 1323, de 501 contra 502). Los renglones de adentro a 1-3 px (la tabla: las
  columnas en 586, 660, 791, 859 y 940 contra 586, 660, 790, 858 y 938; el feed, cada 59 px). **A 390** el pulso da 662 contra 661 y la caja
  del pulso, la de Copilot y la tabla calzan; «Live now» no se compara: el demo estaba en otra corrida (seis pasos, «Running»).
- **La letra es Urbanist**, la misma de MaKo: la hoja la carga como «Noria Urbanist» con las mismas URL (el navegador no la baja dos veces).
- **El movimiento, del INFORME (trae la línea de tiempo del armazón, no la de la página):** la barra lateral entra desde la izquierda (x −40,
  .9 s, power3.out) y sus filas en escalera de 35 ms; la barra de arriba baja 12 px cada 50 ms; la página entra a los 120 ms. La pastilla
  del período se desliza (.35 s, su `--ease`), la fila de la tabla se pinta al pasar, una sugerencia se tiñe.
- **⚠️ Lo que el INFORME no dice y está SUPUESTO** (el código de la página «Overview» no está en el INFORME): las tarjetas suben 18 px cada
  60 ms, las columnas crecen desde abajo (.7 s, cada 24 ms), la línea dorada se destapa de izquierda a derecha (1,1 s), los números cuentan
  (1,1 s), los pasos entran desde la izquierda, las casillas aparecen de a una con rebote y las líneas de la tabla se destapan.

**Lo que Noria tiene y MaKo no mide, y no está:** las **horas de trabajo ahorradas** («Desk time saved»: pediría cuánto tardaría una persona),
la **corrida en vivo** paso por paso con sus milisegundos, el pulso **por hora** de hoy (las automatizaciones se leen por día), **quién cambió
qué** en cada flujo, el **«Live»** de cada uno y el **reintento** («Retry»). La barra lateral, el buscador y la de arriba los pone la app.
**La plantilla no perdió nada que se viera:** los fallos y la tasa de apertura siguen en la grilla; el día a día pasó de envíos y respuestas a
lo que salió y lo que falló, la tabla suma los leads distintos, «Cómo terminaron» suma los que respondieron y los que siguen, y se sumaron las
dos piezas de los 14 días (12 piezas, más la portada).

**Lo del medio (701 a 980, que Noria no mide):** de a dos columnas (el pulso y la tabla a lo ancho).

**Dónde vive:**
- El modelo: `lib/automatizaciones-diseno.ts`, puro. Los datos de ejemplo: `lib/automatizaciones-diseno-muestra.ts` (cuadran entre tarjetas).
- El dibujo: `app/dashboard/disenos/HojaAutomatizaciones.tsx`; lo vivo, `AutomatizacionesVivo.tsx`; la hoja de estilos,
  `automatizaciones-css.ts` (la arma `scratchpad/noria/armar-nor.py` desde `automatizaciones-noria/noria.css`: todo con el prefijo `nor-`).
- La plantilla: `lib/graficos-plantillas-generales.ts` («automatizaciones», doce piezas, `diseno.id = 'automatizaciones'`); `DISENOS_HOJA` en
  `lib/graficos-catalogo.ts`.
- Los tests: `tests/dashboard-diseno-automatizaciones.test.ts` (8, probado rompiéndolo de ocho maneras: cada rotura sola da rojo).

**⚠️ Para la próxima hoja:** las casillas de los 14 días salen de DOS cruces (los envíos y los fallos por día y por automatización). El de los
fallos se ordena por los fallos: una automatización que no está entre sus columnas no falló NADA si el cruce no tiene «Otros»; si lo tiene,
no se sabe y la casilla queda gris (§24 de los hallazgos).

## Chat Analyst: la décima hoja copiada (la de Parley), con «¿cuánto tardamos en contestar?» (en producción desde el 4/11/2026, 21:08 UTC)

Las referencias de Chat Analyst eran dos (Parley · Tend, `docs/templates-dashboard-propuesta.md` §7.3); ésta es **Parley**, la página
«Overview» de Parley (mensajería): una tarjeta naranja con columnas, dos de casillas, una de presupuesto, una oscura con un área, columnas
apiladas por mes, un anillo y una lista de contactos.

**Qué cambia para Martín:**
- **«Nueva hoja» del Dashboard ofrece «Chat Analyst»** con su miniatura de verdad. Es la hoja que ve el setter: también la ve así.
- **Arriba:** el saludo (con la letra de Parley) y la frase («Te escribieron 1,558 veces y respondiste el 82.3%, 1.4 pt más que el período
  anterior»); a la derecha, el período, «Ver la grilla» y un botón violeta que abre tus chats.
- **La tarjeta naranja** («Audience»): los **mensajes recibidos** del período, cuántos chats y su cambio; las columnas son los últimos ocho
  días (o semanas), la más alta con su número. Donde Parley dice «LIVE», **los recibidos de hoy**.
- **Respondidos** («Delivery rate»): qué parte de las veces que te escribieron tuvo respuesta, en 40 casillas, y cuántos esperan hoy (lleva
  a tus chats).
- **En menos de 15 min** («Active campaigns»): cuántas veces se respondió en menos de 15 minutos, de cuántas (el «18 / 40» de Parley), en
  casillas violetas.
- **Tiempo de respuesta** («Credits»): la **mediana**, su barra contra los **15 minutos** (la meta es la de MaKo: su «Respondidos en 15
  min») y el **10 % más lento** (el p90). Si la mediana pasa la meta, la barra se pone naranja.
- **Mensajes enviados** (la tarjeta oscura): lo que mandaste día por día, con el de hoy punteado (va por la mitad), y «Todo · 7 días».
- **Por día** («Messages by month»): cada día, lo respondido y, rayado, lo que quedó sin respuesta; «Días · Semanas» junta por semana (de
  lunes), y el globo sigue al mouse.
- **Por tipo** («Channel mix»): el reparto entre texto, audio, imagen… de lo **recibido** o de lo **enviado** (los dos primeros y «Otros»,
  que siempre suman el total). Nunca se lee un mensaje.
- **Por setter** («Top contacts»): los cinco con más mensajes, su parte del total y cuánto respondió en 15 minutos («Mensajes · En 15 min»).
  Tocar uno, o un tipo, abre lo de siempre de su pieza.

**Lo que se copió de Parley, y cómo se midió:**
- La copia (`docs/diseno/mockups-dashboard/chat-parley/copia.html`) sale de lo medido del demo: `valores.json`, las capturas, los estados de
  los controles y el INFORME. **Nada del código de la tienda, ni el cartel «BUY THIS TEMPLATE».**
- **Las cajas de la copia caen EXACTAS a 1440** (la naranja 424×499 en 116,112; las de casillas 424×174; Credits y la oscura 424×309 en y
  302; el mes 864×732, el anillo 424×344 y los contactos 424×373) y los renglones de adentro a ±1 px (el saludo en 31, la frase en 79, las
  herramientas en 38, el globo del mes en 728..859 × 829..906, la grilla del mes cada 139 px). **A 390, a 1-2 px** (la naranja 358, las de
  casillas 152, la oscura 291, Credits 171, el mes 343, el anillo 336 y los contactos 365), con la barra de abajo del teléfono.
- **La letra de Parley es Bricolage Grotesque (los títulos) y Geist de verdad**; en MaKo «Geist» es Urbanist, así que el componente las carga
  con otro nombre («Parley Bricolage», «Parley Geist»), como Kestrel.
- **El movimiento, del INFORME (trae la entrada de la página):** el saludo entra palabra por palabra (y 70 %, .6 s, cada .06 s) y la frase
  después; las herramientas bajan (y −8, .5 s, cada .06 s, desde .2 s); las tarjetas suben (y 28, escala .985, .8 s, power3.out, cada .08
  s) y cada una arranca lo suyo a los .25 s de su entrada: los números cuentan (1,4 s; los recibidos 1,6 s, los enviados 1,8 s), las
  columnas naranjas suben desde abajo (1,1 s, power4.out, cada .06 s), las casillas se llenan de a una (.35 s, back.out(2.2), cada .018 s),
  la barra del tiempo crece (1,2 s). Al cambiar de día el globo rebota (.85 → 1, .4 s, back.out(2)). Con el mouse, una tarjeta oscurece su
  borde y su sombra (.25 s); una columna naranja se pone blanca y muestra su número.
- **⚠️ Lo que el INFORME no dice y está SUPUESTO:** cómo se dibuja el área de los enviados (se destapa de izquierda a derecha, 1,2 s), cómo
  crecen las columnas del mes y el anillo (1 s, power3.out) y que al pasar sobre un día los otros se apagan a la mitad.

**Lo que Parley tiene y MaKo no hace, y no está:** la barra lateral (la pone la app), el buscador, el «live», la proyección rayada del mes
en curso, los créditos y su recarga (el «+»), y el cambio de cada canal contra el mes pasado (el gráfico no compara fila por fila: el chip
dice cuántos son). **La plantilla no perdió nada que se viera:** las líneas, las automatizaciones y la caja de MaKo siguen en la grilla. Se
sumaron dos piezas (la respuesta más lenta y el reparto por tipo) y el porcentaje de rápidos por día pasó a ser «te escribieron y
respondiste, por día» (14 de 14).

**Lo del medio (701 a 980, que Parley no mide):** de a dos columnas (la naranja a la izquierda de las dos de casillas); la cabecera baja de
renglón si no entra.

**Dónde vive:**
- El modelo: `lib/chat-diseno.ts`, puro. Los datos de ejemplo: `lib/chat-diseno-muestra.ts` (las ocho columnas de Parley).
- El dibujo: `app/dashboard/disenos/HojaChat.tsx`; lo vivo, `ChatVivo.tsx`; la hoja de estilos, `chat-css.ts` (la arma
  `scratchpad/parley/armar-parl.py` desde `chat-parley/parley.css`: todo con el prefijo `parl-`).
- La plantilla: `lib/graficos-plantillas-analysts.ts` (CHAT, catorce piezas, `diseno.id = 'chat'`); `DISENOS_HOJA` en
  `lib/graficos-catalogo.ts`.
- Los tests: `tests/dashboard-diseno-chat.test.ts` (9, probado rompiéndolo de ocho maneras: cada rotura sola da rojo).

## Landing: la novena hoja copiada (la de Corbel), con «¿hasta dónde bajan y dónde hacen clic?» (punta `dash-landing`, 4/11/2026)

Las referencias de Landing eran dos (Corbel · Kestrel, `docs/templates-dashboard-propuesta.md` §7.3); ésta es **Corbel**, la página
«Dashboard» de Corbel Supply Co.: cuatro números de colores, un medidor, columnas por mes, una grilla de horarios y un anillo.

**Qué cambia para Martín:**
- **«Nueva hoja» del Dashboard ofrece «Landing»** con su miniatura de verdad (la plantilla vieja no se ofrecía desde el mediodía).
- **Arriba:** el saludo y, donde Corbel dice «1,290 live now», **las visitas de hoy** (el Pixel no cuenta presencia: no se inventa un «en
  vivo»). Debajo, el período, una frase de un renglón («Entraron 1,341 visitas de 1,059 personas, 12% más que el período anterior»),
  «Ver la grilla» y «Abrir tus páginas».
- **Los cuatro números de Corbel**, con su cambio y su dibujo chico: **Visitas** (las últimas tres columnas), **Llegan a la mitad** (su
  línea; el cambio en puntos), **Llegan al final** (el anillo: de los que llegan a la mitad, cuántos siguen hasta el final) y **Tocan un
  botón** (sus barras de los últimos diez días). Cada uno con su link: tus páginas, la grilla (el embudo y los clics) o el diagnóstico.
- **El medidor** («Sales performance»): el **puntaje del diagnóstico** de tus páginas, su veredicto en palabras (Bien armada · Se puede
  mejorar · Hay que arreglarla) y el porqué («La más floja es /vsl (64 de 100); la mejor, /clase-gratis (81)»). Sin diagnóstico, lo dice y
  lleva a analizar la página.
- **Las columnas** («Revenue»): las visitas (o las personas: el selector cambia de verdad) de los últimos doce días del período, la de hoy
  en negro, el promedio punteado y la burbuja de hoy (con «en curso» en lugar del cambio: un día a medias contra uno entero mentiría).
- **«Cuándo entran»** («Visits by time»): las visitas por franja (0 a 8, 8 a 12, 12 a 16 y 16 a 24 h) y día de la semana, en cinco tonos,
  **con la hora del negocio**.
- **«De dónde llegan»** («Total visits»): las visitas con su cambio y el reparto entre orígenes (los dos primeros y «Otros», que siempre
  suman el total), con el anillo del primero. Tocar un origen abre lo de siempre de su pieza.

**Lo que se copió de Corbel, y cómo se midió:**
- La copia (`docs/diseno/mockups-dashboard/landing-corbel/copia.html`) sale de lo medido del demo: `valores.json`, las capturas, los
  estados de los controles y el INFORME. **Nada del código de la tienda, ni el cartel «BUY THIS TEMPLATE».**
- **Las cajas de la copia caen EXACTAS a 1440** (los cuatro números 316×162 en y 218; el medidor 427×354 y las columnas 871×354 en y 395; la
  burbuja 164×105 en 1217,453; la grilla 760×258 y el anillo 538×258 en y 765) **y a 1 px a 390** (los números 176×141; el medidor 362×333;
  las columnas 362×346; la grilla 362×218; el anillo 362×414 contra 413). También los controles: las pestañas (391 a 1105), el botón
  «Dashboard» (395, 99 de ancho), las celdas de la grilla (82×31 desde 228).
- **La letra de Corbel es Urbanist, la misma que en MaKo se llama «Geist»**: el componente usa la de la app y no carga nada.
- **El movimiento, del INFORME (trae la entrada de la página):** la barra sube (y 8, .6 s, cada .05 s, desde .15 s), las tarjetas suben
  (y 26, escala .985, .9 s, expo.out, cada .07 s, desde .2 s) y los números de arriba después (y 14, .6 s, cada .08 s, desde .27 s); los
  números cuentan desde 0 (1,3 s, power3.out, desde .45 s); las barritas suben (1 s, cada .08 s), la línea se dibuja (1,3 s), su área
  aparece (.8 s, desde 1,05 s) y su punto crece (.5 s, back.out(3), desde 1,6 s); el anillo se llena (1,4 s) y el medidor corre hasta su
  puntaje (1,7 s, power3.inOut); las líneas guía se dibujan (1,1 s, cada .06 s, desde .55 s), sus rótulos entran (x −6), los días suben (y
  6, cada .03 s), el promedio aparece a 1,45 s y la burbuja a 2,05 s (escala .9, back.out(2)); los gajos del anillo corren de a uno (1,1 s,
  cada .18 s, desde .85 s); el fondo (tres manchas) se mueve 14, 18 y 22 s ida y vuelta. Con el mouse, una tarjeta sube 3 px (.45 s).
- **⚠️ Lo que el INFORME no dice y está SUPUESTO:** cómo suben las columnas del gráfico (como las barritas: .9 s, expo.out, cada .04 s,
  desde .7 s) y cómo entran las celdas de la grilla (crecen de .6 a 1, .6 s, back.out(2.6), como el «pop» de la casa). Las funciones de esos
  dos bloques no están en el extracto del INFORME.

**Lo que Corbel tiene y MaKo no hace, y no está:** la marca, las pestañas y el dock (los pone la app), el selector de canal (Online / In
store: en su lugar, el período), el pronóstico del mes que viene (la columna punteada), la meta del anillo (el anillo es una proporción
medida) y el «live now». **La plantilla no perdió nada:** el mapa de calor de los toques, los clics por botón y las grabaciones siguen en
la grilla («Ver la grilla»); Corbel no tiene dónde dibujarlos. Se sumó una pieza («Cuándo entran»: 13 de 14).

**Lo del medio (761 a 1240, que Corbel no mide):** de 1041 a 1240 —el lienzo de MaKo al lado de la barra lateral— los cuatro números siguen
en fila y «vs. el anterior» se va (como en el teléfono de Corbel); de 761 a 1040, los números van de a dos y la grilla y el anillo a lo ancho.

**Dónde vive:**
- El modelo: `lib/landing-diseno.ts`, puro. Los datos de ejemplo: `lib/landing-diseno-muestra.ts`. El día y la franja de una visita:
  `lib/visitas-momento.ts` (los usa `filasVisitas` con `tzActual()`, la zona del negocio).
- El dibujo: `app/dashboard/disenos/HojaLanding.tsx`; lo vivo, `LandingVivo.tsx`; la hoja de estilos, `landing-css.ts` (la arma
  `scratchpad/corbel/armar-cb.py` desde `landing-corbel/corbel.css`: todo con el prefijo `cb-`).
- La plantilla: `lib/graficos-plantillas-analysts.ts` (LANDING, trece piezas, `diseno.id = 'landing'`); `DISENOS_HOJA` en
  `lib/graficos-catalogo.ts`, y las dos dimensiones nuevas de `visitas`, ahí mismo.
- Los tests: `tests/dashboard-diseno-landing.test.ts` (8, probado rompiéndolo de siete maneras: cada rotura sola da rojo).

## Marketing: la octava hoja copiada (la de Kestrel), con «¿cuánto cuesta una agenda y de qué anuncio vino?» (en producción desde el 4/11/2026, 19:06 UTC)

Las referencias de Marketing eran dos (Kestrel · Ondra, `docs/templates-dashboard-propuesta.md` §7.3); ésta es **Kestrel**, la de la página
«Realtime overview»: seis números arriba, las tendencias, una tabla con pestañas y dos bloques por red. Ondra queda para otra hoja.

**Qué cambia para Martín:**
- **«Nueva hoja» del Dashboard ofrece «Marketing»** con su miniatura de verdad (la plantilla vieja de Marketing no se ofrecía desde el
  mediodía; ahora vuelve, copiada). **Y la hoja Marketing del tablero inicial de un negocio nuevo nace con este diseño.**
- **Arriba:** el saludo, la fecha (donde Kestrel dice «Live»: los datos de Meta no son en vivo) y una frase de un renglón: «Gastaste
  US$2,460 en anuncios, trajeron 27 agendas y cada una costó US$91.11», con «Últimos 30 días» y «Ver la grilla».
- **Los seis números de Kestrel**, cada uno con su cambio contra el período anterior y en su unidad: costo por agenda (el resaltado, que es
  la pregunta), ROAS cobrado, agendas, gasto, CTR y costo por lead. El verde y el rojo dicen si el cambio es bueno: el costo que baja es
  verde, el CTR que baja es rojo, y gastar más o menos no se pinta (no es, solo, ni bueno ni malo).
- **«Tendencias»:** cómo se movieron el gasto, los leads y las agendas contra la primera semana del período, de a 7 días, con el número del
  final de cada línea, el cruce al pasar el mouse y «Tabla» (los días con sus números).
- **La tabla con pestañas** (la «Lead quality» de Kestrel): **Por anuncio** (con su campaña), **Por campaña** (con cuántos anuncios) y
  **Día por día**, con el gasto, los leads, las agendas y el **costo por agenda marcado contra el promedio**: verde si es 20% más barato,
  ámbar cerca, rojo si es 25% más caro, y «Sin agendas» en rojo si gastó y no trajo ninguna. Tocar un anuncio abre su pop-up de siempre.
- **«Lo que trae la pauta»** (el bloque de Instagram): impresiones y clics con su cambio, el anillo con cuántos de cada 100 clics llegan a
  la página, las vistas de la landing y del VSL, los leads y las agendas, y **«Los que más agendas trajeron»**: los cuatro anuncios con su
  miniatura de Meta (o sus iniciales) y cuántas agendas trajo cada uno.
- **«Qué red trae agendas»** (el bloque de X.com): las agendas según Meta, una columna por red (Instagram, Facebook, Messenger…) y las
  impresiones, el CTR y el costo por mil. Esto es EN VIVO de Meta, y lo dice.

**Lo que se copió de Kestrel, y cómo se midió:**
- La copia (`docs/diseno/mockups-dashboard/marketing-kestrel/copia.html`) sale de lo medido del demo: `valores.json` (las variables, la
  tipografía, las cajas de cada panel a 1440 y a 390), las capturas, los estados de cada control y el INFORME. **Nada del código de la
  tienda, ni el cartel «BUY THIS TEMPLATE», ni sus fotos** (avatares con iniciales; las publicaciones, en un color liso).
- **Las cajas de la copia caen a 1-2 px de las de Kestrel**, a 1440 y a 390 (kpis 268,169 836×110; trends 836×352; la tabla 836×656 contra
  655; Instagram 300×612 contra 611; X.com 300×421). Lo que lo delató: las tarjetas de Kestrel llevan un borde de 1 px (los recuadros de
  adentro miden 258 y no 260).
- **La adaptación tiene EXACTAMENTE las mismas cajas que la copia a 1440**; el componente, los mismos altos (110, 352, 656, 612 y 421),
  corrido sólo por la barra lateral y la de arriba, que en MaKo pone la app. Las capturas: `marketing-kestrel/captura/`.
- **La letra es Geist, y en MaKo «Geist» es Urbanist** (`app/globals.css`): la hoja declara «Kestrel Geist» con los archivos de Google. Cargar
  la hoja de Google de Geist le habría cambiado la letra a toda la app mientras el Dashboard está abierto.
- **El movimiento, del INFORME (que esta vez trae la entrada de la página):** el encabezado y las tarjetas suben (y 22, escala .985 → 1,
  .85 s, cada .07 s, curva (.22, 1, .36, 1)); los números cuentan desde cero (1,1 s, power3.out); las líneas se dibujan (1,4 s, desde .1 s +
  .12 s por línea, power2.inOut) y su punto y su número aparecen (1 s, desde .6 s + .12 s); la tinta de las pestañas corre (.45 s) y al
  cambiar, lo de adentro sale (.18 s) y las filas entran de a una (y 6, .4 s, cada .02 s); la tabla de Trends reemplaza al gráfico igual.
  Los hover son los del CSS de Kestrel (las filas, las pastillas, las miniaturas que suben 3 px y se agrandan 6%).
- **⚠️ Lo que el INFORME no dice y está SUPUESTO** (no inventado en otro lado, pero tampoco medido): la demora de cada número al contar (usa
  la de su tarjeta) y la del anillo (usa la del medidor de Kestrel: 1,1 s desde .2 s). El «3M» de Trends y el filtro de la tabla no se
  copiaron en la adaptación: un control que no hace nada se lee como roto.

**Lo que Kestrel tiene y MaKo no hace, y no está:** el «Live» (Meta no es en vivo), la CALIDAD del lead (MaKo no la puntúa: se marca el COSTO,
que sí se mide), las búsquedas y las palabras clave, los seguidores, y el menú «···» de cada tarjeta (en su lugar, un link al Ads Manager).
**Salieron de la plantilla** el costo por cierre (vive en Comercial), la edad y el mapa (Kestrel no los tiene). Una hoja de antes no cambia.

**Dónde vive:**
- El modelo (qué dibuja cada parte, con los datos reales): `lib/marketing-diseno.ts`, puro. Los datos de ejemplo de la miniatura:
  `lib/marketing-diseno-muestra.ts`, con la forma de las piezas, así la miniatura pasa por el MISMO `vistaMarketing`.
- El dibujo: `app/dashboard/disenos/HojaMarketing.tsx`; lo vivo, `MarketingVivo.tsx`; la hoja de estilos, `marketing-css.ts` (la arma
  `scratchpad/kestrel/armar-kt.py` desde `marketing-kestrel/kestrel.css`: todo con el prefijo `kt-`, con el medio de 761 a 1040 y el
  teléfono por `@container`).
- La plantilla: `lib/graficos-plantillas.ts` (MARKETING, doce piezas, `diseno.id = 'marketing'`); `DISENOS_HOJA` en `lib/graficos-catalogo.ts`.
- Los tests: `tests/dashboard-diseno-marketing.test.ts` (9, probado rompiéndolo de seis maneras: cada rotura sola da rojo), y los de la
  plantilla vieja actualizados (`tests/graficos.test.ts`, `tests/dashboard-plantillas-ofrecidas.test.ts`).

## Comercial: la séptima hoja copiada (la de Selvar), con «¿convierte, y a qué costo?» (en producción desde el 4/11/2026, 18:25 UTC)

El pedido es el mismo: primero la copia exacta y después la adaptación, *«de a una»*. Las referencias de Comercial eran seis (Coffer ·
Corbel · Prism · Orvel · Pelago · Selvar, `docs/templates-dashboard-propuesta.md` §7.3); ésta es **Selvar**, la que es un tablero de
ventas (el pipeline, la tasa de cierre, las ventas por semana y el ranking del equipo). Coffer y Orvel ya están copiadas en Cobranza y
General; las otras quedan para otra hoja.

**Qué cambia para Martín:**
- **«Nueva hoja» del Dashboard ofrece «Comercial»**, con su miniatura de verdad: gris claro, tarjetas blancas y el azul cobalto de Selvar.
- **Arriba:** la fecha con el período, el saludo y una frase: «De 27 agendas salieron 6 cierres, vendiste US$96,000 y cada cierre te
  costó US$410 en anuncios», con «Ver la grilla» y «Abrir el CRM».
- **«Vendido»:** lo vendido contra el período anterior (con su chip «Más que el período anterior»), a la derecha lo invertido en anuncios y
  lo que costó cada agenda, y la barra de Selvar con lo que pasó con las agendas: cerraron, vinieron y no cerraron, no vinieron y sin
  marcar. Abajo, las agendas, las que vinieron y el retorno de los anuncios.
- **Los cuatro números** (con su cambio y su línea): la tasa de cierre (el azul), el ticket promedio, los días hasta el cierre y el costo
  por cierre. Lo que baja en días y en costo se pinta verde.
- **«Por qué no se cerró»** (el «Copilot» de Selvar): los tres motivos de pérdida más repetidos, cada uno con «Ver los leads», que abre el
  detalle de siempre de esa pieza.
- **«Lo vendido»:** por semana (los últimos 90 días, apilado por funnel) o por mes (los últimos 12, lo vendido entero), con el promedio
  punteado.
- **«De agenda a cierre»:** las cohortes maduras paso por paso (agendaron, vinieron, calificados, cerraron) con cuántos pasan al siguiente,
  y el motivo de pérdida más común al pie.
- **«Hoy»:** las llamadas de venta de hoy del CRM, con la línea de «Ahora». Cada una abre la ficha del lead.
- **«De dónde vienen los que cierran»:** cada origen con su tasa de cierre (verde si está arriba de la del período), lo vendido y los
  cierres. **«Quién cierra»:** la tasa de cierre de cada closer, con la copa para el primero.

**Lo que Selvar tiene y no está, a propósito:** el «Pace today», el «Forecast» y la bandera de la cuota (MaKo no tiene una cuota ni un
pronóstico de ventas), los botones de IA de cada señal, su cruz y la caja para preguntarle (a MaKo se le pregunta desde su chat).

**El movimiento:** el INFORME de Selvar trae la entrada del armazón (la barra lateral y la de arriba) y los hover del CSS; **la entrada de
la página «Overview» no está** (vive en un chunk que el INFORME no muestra), igual que en Orvel y en Moorly. No se inventó.

**La comparación:**
- **La copia contra el demo, a 1440:** cada caja a 2 px o menos de la medida (la tarjeta grande 746 × 383 contra 385, los cuatro números
  de 174 × 199, «Lo vendido» 746 × 383, las tres de abajo de 365, 460 y 270 de ancho) y el alto total 1686 contra 1688.
- **A 390:** las mismas cajas en el mismo orden. Los dos números de arriba del demo miden 145 de alto y no se pudo ver por qué: la barra de
  abajo del demo los tapa en la captura. En la copia miden 178.
- **La adaptación contra el componente, en un arnés con los datos pasando por el modelo de verdad:** a 1440 y a 390, las once cajas en el
  mismo píxel. Lo único que cambia son las barras de «Lo vendido», que tienen otros datos de ejemplo. A 900 (el medio, que Selvar no
  mide) los números van de a cuatro, «Por qué no se cerró» y «De agenda a cierre» de a dos, y «Quién cierra» a lo ancho.
- Capturas en `comercial-selvar/captura/`: `copia-*`, `mako-*` y `producto-*`.

**Cómo está hecho:**
- `app/dashboard/disenos/HojaComercial.tsx` dibuja y `comercial-css.ts` es `comercial-selvar/selvar.css` sin el armazón, con todo
  adentro de `.cm` y cada clase con `cm-`. `ComercialVivo.tsx` le pone los datos (los de las piezas de la hoja y las llamadas de hoy) y
  lo carga `EditorInforme` con `next/dynamic`.
- **La página lee las llamadas de venta de hoy** (`lib/comercial-diseno-server.ts`, la misma lectura que el Calendario y que Closing),
  sólo si hay una hoja con este diseño y nunca para el closer ni el setter: nombran leads.
- **La plantilla `comercial` cambia:** la frase de arriba pasa a ser lo que pasó con las agendas (una frase lleva hasta cuatro métricas) y
  suma dos piezas: «Lo vendido y lo invertido» (columnas por semana, que dan los totales y el período anterior) y «Lo vendido por semana»
  (apilado por funnel). El ticket y los días hasta el cierre se comparan con el período anterior, y «De dónde vienen» suma lo vendido.
  ⚠️ Una hoja lleva hasta 14 paneles y una sola frase (`tests/graficos-corbel.test.ts`): por eso no hay una pieza de «por mes» aparte (es
  la Tendencia) y el costo por agenda y el retorno se calculan en el modelo. Una hoja Comercial que ya existe no cambia.
- El modelo es `lib/comercial-diseno.ts`; el test, `tests/dashboard-diseno-comercial.test.ts` (10 casos): ejecuta el modelo y está probado
  rompiéndolo (6 de 6 roturas en rojo). `tests/graficos.test.ts` y `tests/dashboard-plantillas-ofrecidas.test.ts` cambiaron lo que
  afirmaban de Comercial: 14 paneles en vez de 12, y que ahora se ofrece.
- **En la API de MaKo:** `crear_hoja_dashboard` y el catálogo de plantillas leen `PLANTILLAS_OFRECIDAS`, así que Comercial entra sola
  (`docs/api-mako.md` no nombra las plantillas: no cambió).

**Falta:** verlo con los datos de un cliente (la nube no tiene la base) y que Martín lo compare en el Dashboard. La que sigue es la
próxima de §7.3.1 (Marketing, con Kestrel · Ondra), de a una.

## «Operación diaria»: la sexta hoja copiada (la de Moorly), con lo de hoy (punta `dash-operacion`, 4/11/2026)

El pedido es el mismo: primero la copia exacta y después la adaptación, *«de a una»*. La referencia de «Operación diaria» era Moorly · Torque
(`docs/templates-dashboard-propuesta.md` §7.3); ésta es **Moorly**. Torque queda para otra hoja.

**Qué cambia para Martín:**
- **«Nueva hoja» de General ofrece «Operación diaria»**, con su miniatura de verdad: el cielo celeste con el sol arriba a la derecha y el mar de
  Moorly detrás de la cabecera.
- **Arriba:** el saludo, la fecha y una frase con lo de hoy: «3 llamadas hoy, 2 cuotas vencidas y 4 tareas que vencen esta semana. **Laura
  Méndez** es tu próxima llamada, a las 12:30.» A la derecha, el botón de la grilla (los bloques de siempre), «Abrir el Plan» y «Abrir el CRM».
- **Los cuatro números de Moorly**, con su línea: las agendas, lo que falta cobrar, los cierres y lo cobrado (con el cambio contra el período
  anterior). Abajo de cada uno, lo de hoy: las llamadas de hoy, las cuotas vencidas, de cuántas agendas salieron los cierres.
- **«Mes a mes»:** lo cobrado, las agendas o los cierres de los últimos 12 meses (las tres pestañas de Moorly), con el total, el promedio y el
  mejor mes.
- **«Te está esperando»:** las cuotas vencidas, las tareas vencidas, los leads por marcar, lo que vence pronto y las tareas de esta semana, en
  ese orden y hasta seis. Cada renglón lleva a su lugar (la ficha del lead, la tarea del Plan, el CRM).
- **«Tu funnel hoy»**, **«Las llamadas que vienen»** (las llamadas de cada día de las próximas dos semanas, como la marea de Moorly, y las tres
  que siguen), **«Te deben»** (por tramo de atraso, con las cuentas de la hoja Cobranza), **«Para tildar hoy»** (las tareas de hoy y las
  vencidas, que se tildan ahí mismo), **«Salud del negocio»** (el semáforo) y **«La meta del trimestre»**.

**Lo que Moorly tiene y no está, a propósito:** la caja para agregar un pendiente (una tarea nueva del Plan se crea en el Plan) y la plata de
cada etapa del funnel (MaKo cuenta leads por etapa, no montos).

**El movimiento:** el INFORME de Moorly trae la entrada del armazón y los hover del CSS; **la entrada de la página no está**, igual que en Orvel.
No se inventó: las tarjetas quedan quietas y los hover son los del CSS.

**La comparación con la maqueta aprobada** (`docs/diseno/mockups-dashboard/operacion-moorly/mako.html` contra el componente, en un arnés con los
datos pasando por el modelo de verdad): **a 1440, las once cajas caen en el mismo píxel** (la cabecera, los cuatro números de 332 × 126, el
gráfico 912 × 426, «Te está esperando» 448 × 426 y las dos filas de tres de 448 × 406) y el alto total es el mismo, 1592. **A 390, las mismas
cajas en el mismo lugar**, salvo «Para tildar hoy», que tiene un renglón menos porque el arnés trae tres tareas y la maqueta cuatro. A 900 (el
medio, que Moorly no mide) los números van de a dos, el gráfico y la espera a todo el ancho, y las de abajo de a dos. Capturas en
`operacion-moorly/captura/`: `copia-*`, `mako-*` y `producto-*`.

**Cómo está hecho:**
- `app/dashboard/disenos/HojaOperacion.tsx` dibuja; `operacion-css.ts` es `operacion-moorly/moorly.css` sin el armazón, con todo adentro de
  `.mo` y cada clase con `mo-`. `OperacionVivo.tsx` le pone las dos fuentes (los datos de General y los de seis componentes de la hoja) y lo
  carga `EditorInforme` con `next/dynamic`.
- **La plantilla `operacion` cambia:** suma «Mes a mes» (lo cobrado, las agendas y los cierres de los últimos 12 meses) y «Te deben» (lo que
  falta cobrar por tramo de atraso), y trae su `diseno`. Una hoja «Operación diaria» que ya existe no cambia.
- El modelo es `lib/operacion-diseno.ts`; el test, `tests/dashboard-diseno-operacion.test.ts` (10 casos): ejecuta el modelo y está probado
  rompiéndolo (6 de 6 roturas en rojo).
- **En la API de MaKo:** `agregar_hoja_general` ofrece `operacion` (sale solo de `PLANTILLAS_GENERAL_OFRECIDAS`; `docs/api-mako.md` regenerado).

**Falta:** verlo con los datos de un cliente y que Martín lo compare en el Dashboard. La que sigue es Torque o la próxima de §7.3.1, de a una.

## General: la quinta hoja copiada (la de Orvel), con lo que MaKo sabe del negocio (punta `dash-general`, 4/11/2026)

El pedido sigue siendo el de Martín (por el Cerebro): primero la copia exacta, después la adaptación, y *«Después seguí con la segunda hoja,
de a una»*. La referencia de la plantilla General era Orvel · Corbel (`docs/templates-dashboard-propuesta.md` §7.3); ésta es **Orvel**.
Corbel queda para otra hoja.

**Qué cambia para Martín:**
- **«Nueva hoja» de General ofrece «General»**, con su miniatura de verdad. Es una hoja crema, con un brillo dorado arriba, como Orvel.
- **Arriba:** la fecha, el saludo y una frase: «Entraron US$12,480 este mes, 2 cuotas están vencidas y 5 leads esperan que los marques» (las
  cuotas y los leads llevan al CRM), con «Abrir el Plan» y «Abrir el CRM». El botón del ícono de la grilla muestra los bloques de siempre.
- **«Este mes»:** lo cobrado en grande contra el mismo período del mes pasado, la barra de lo cobrado contra la proyección al cierre, cuatro
  renglones (lo cobrado, la inversión en anuncios, las agendas y los cierres, cada uno con su proyección y su cambio) y la meta del trimestre:
  cuánto va, cuánto tendría que ir a esta altura y cuántos días faltan.
- **«Lo que entró y lo que invertiste»:** lo cobrado, la inversión y lo que quedó, y las dos líneas mes a mes (6M · 12M).
- **«Te necesita»:** las cuotas vencidas, los leads por marcar, las tareas vencidas y las alertas en rojo, sólo lo que tiene algo.
- **«Lo que vence»** en las próximas 3 semanas (tareas y proyectos del Plan, lo vencido primero), **«Te deben»** (todo lo que falta cobrar,
  por tramo de atraso, y las tres cuotas más urgentes), **«Tu funnel hoy»** (cada etapa del funnel principal con su barra), **«Próximas
  llamadas»** (las del CRM: «en 1 h» si es hoy, la fecha si es otro día) y **«Salud del negocio»** (el semáforo).

**Lo que Orvel tiene y no está, a propósito:** el sobre para recordarle a un cliente que pague (un mensaje a un tercero sale por sus puertas),
«Move money» y la barra de «lo mismo el mes pasado» de cada etapa (MaKo no guarda el funnel de cada día).

**El movimiento:** el INFORME de Orvel trae la entrada del armazón (la barra lateral y la de arriba, que en MaKo pone la app) y los hover del
CSS; **la entrada de la página «Overview» no está** (vive en un chunk que el INFORME no muestra). No se inventó: las tarjetas quedan quietas y
los hover son los del CSS. Si Martín quiere movimiento de entrada acá, hace falta mirar el demo andando y medirlo.

**La comparación con la maqueta aprobada** (`docs/diseno/mockups-dashboard/general-orvel/mako.html` contra el componente, en un arnés con los
datos pasando por el modelo de verdad): **a 1440, las nueve cajas caen en el mismo píxel** (la cabecera 1136 × 100, «Este mes» 464 × 606, el
gráfico 656 × 606, las dos filas de tres a 368 de ancho y 550 y 449 de alto) y el alto total es el mismo, 1833. **A 390, los mismos tamaños
en el mismo orden**, 10 px más arriba (el margen del teléfono de Orvel). Capturas en `general-orvel/captura/`: `copia-*` (la copia del demo),
`mako-*` (la adaptación) y `producto-*` (el componente). Lo que difiere, a propósito: la «k» del eje y de la leyenda sale de la plata de
verdad, el primer punto del gráfico cae a la derecha de la etiqueta más ancha del eje, y «Te deben» va en los cuatro tramos de atraso de
Cobranza (Orvel tiene tres).

**Cómo está hecho:**
- `app/dashboard/disenos/HojaGeneral.tsx` dibuja; `general-css.ts` es `general-orvel/orvel.css` sin el armazón, con todo adentro de `.gv` y cada
  clase con `gv-`. El medio (761 a 1040) no está medido en Orvel: la primera fila baja a una columna y las de tres, a dos.
- `app/dashboard/disenos/GeneralVivo.tsx` le pone DOS fuentes: los datos de los bloques de General y los de dos componentes de la hoja. Lo carga
  `EditorInforme` con `next/dynamic`.
- **La plantilla `general` cambia:** el gráfico por mes pasa a ser «Lo que entró y lo que invertiste» (lo cobrado y la inversión), y suma
  «Te deben» (lo que falta cobrar por tramo de atraso, con las mismas cuentas que la hoja Cobranza: `debenDe`). Trae
  `diseno: { id: 'general', piezas: { meses: 'por-mes', deben: 'deben' } }`. Una hoja General que ya existe no cambia.
- El modelo es `lib/general-diseno.ts`; el test, `tests/dashboard-diseno-general.test.ts` (13 casos): ejecuta el modelo y está probado
  rompiéndolo (6 de 6 roturas en rojo).
- **En la API de MaKo:** `agregar_hoja_general` ofrece `general` (sale solo de `PLANTILLAS_GENERAL_OFRECIDAS`; `docs/api-mako.md` regenerado).

**Falta:** verlo con los datos de un cliente (la nube no tiene la base) y que Martín lo compare en el Dashboard. La que sigue es Corbel o la
próxima de §7.3.1 («Operación diaria», Moorly · Torque), de a una.

## «Mi día»: la cuarta hoja copiada (la de Lumora, la otra referencia de Focus) (punta `dash-mi-dia`, 4/11/2026)

El pedido es el mismo de Focus (Martín, por el Cerebro): *«Carga los de FOCUS que ya teníamos»*, primero la copia exacta y después la
adaptación. Focus tenía dos referencias: Pane (la hoja Focus, ya en producción) y Lumora, que es ésta. Va como una plantilla aparte de
**GENERAL**, «Mi día» (id `mi-dia`), al lado de Focus.

**Qué cambia para Martín:**
- **«Nueva hoja» de General ofrece «Mi día»**, con su miniatura de verdad. Es una hoja clara, verde agua, como Lumora.
- **Arriba:** la fecha y la semana del trimestre, el saludo con su nombre, «Tienes 3 llamadas hoy y 2 tareas que vencen» (las tareas llevan
  al Plan) y las cuotas vencidas sin cobrar. Abajo, la **cinta del día**: lo de hoy en el Calendario en bloques, los huecos de una hora o más
  como «Libre» y la línea roja del ahora encima de lo que está corriendo. Si un día tiene más bloques de los que entran, la cinta se corre de costado.
- **Dos tarjetas:** «Prepara tu próxima llamada» (abre la ficha del lead de la próxima llamada que todavía no empezó) y «Pregúntale a MaKo» (su chat).
- **Cuatro números:** las llamadas de hoy (con la próxima), las tareas de hoy (las hechas y las vencidas), las cuotas por cobrar (de cuántos
  clientes, y las vencidas) y los KPIs del día en verde. La barrita de cada uno muestra la proporción.
- **Accesos** a CRM, Plan, Calendario, Classroom, Offer, Ads Manager y Automations.
- **Lo que vence** del Plan (tareas y proyectos, por fecha), **tu funnel hoy** (la dona por etapa del funnel principal), **cómo vas con tus OKRs**
  (el avance contra lo esperado a hoy), **los que te deben** (lo más urgente primero) y **el semáforo**.
- **Al costado:** el mes con lo que tiene el Calendario en puntos, **tu día** en lista (con «Ahora») y **recordatorios**: la próxima llamada,
  las tareas vencidas, el próximo hueco libre y las tareas de hoy, que se tildan ahí mismo (con «Deshacer»).

**Lo que Lumora tiene y no está, a propósito:** la línea de cada número (MaKo no guarda esa serie: va la barrita, que es del mismo demo), el
selector «Scores · Attendance» (cada OKR tiene una sola vara), el «Customise» de los accesos, el sobre de la lista de vigilancia (un mensaje a un
tercero sale por sus puertas) y la flecha del selector del funnel (no cambia nada).

**La comparación con la maqueta aprobada** (`docs/diseno/mockups-dashboard/focus-lumora/mako.html` contra el componente, en un arnés con los
datos pasando por el modelo de verdad): a 1440, 1942 px de alto contra 1967 de la maqueta (la maqueta tiene una alerta más en el semáforo y un
recordatorio más); las cajas caen en las mismas columnas (952 + 320). A 390, los mismos bloques en el mismo orden. Capturas:
`docs/diseno/mockups-dashboard/focus-lumora/captura/producto-1440.png` y `producto-390.png`.

**El movimiento es el de Lumora** (su entrada `xt`, que el INFORME sí trae): el hero sube, el título letra por letra, la cinta crece desde abajo y
la marca del ahora baja, las tarjetas de la IA giran al entrar, los números suben y sus barritas se llenan, las filas, las pastillas, el riel,
las cifras que cuentan y la tarjeta que sube con el mouse. Medido en el arnés: 123 animaciones corriendo a los 450 ms y el hover responde.
No se copió: el helper `Oe(.kpis)` (el INFORME no lo muestra; la barrita va a los .4, donde la entrada lo llama) y las curvas back.out de GSAP (aproximadas).

**Cómo está hecho:**
- `app/dashboard/disenos/HojaMiDia.tsx` dibuja; `mi-dia-css.ts` es `focus-lumora/lumora.css` con todo adentro de `.ld` y cada clase con
  `ld-` (también las compuestas: `.ld-ribbon__it.ld-is-now`). El medio (761 a 1040) no está medido en Lumora: el riel baja en dos columnas.
- `app/dashboard/disenos/MiDiaVivo.tsx` le pone los datos de General. Lo carga `EditorInforme` con `next/dynamic`, como a Focus.
- El modelo es `lib/mi-dia-diseno.ts`; el test, `tests/dashboard-diseno-mi-dia.test.ts`: ejecuta el modelo y está probado rompiéndolo (7 de 7
  roturas en rojo). Encontró un error real del mes: noviembre de 2026 toca seis semanas.
- La plantilla `mi-dia` trae `diseno: { id: 'mi-dia', piezas: {} }`; editando, quedan sus bloques (Tu día, Lo que vence, Tu funnel hoy, Los que
  te deben, OKRs, Para tildar hoy y el Semáforo). Su color es el durazno.
- **En la API de MaKo:** `agregar_hoja_general` ofrece `mi-dia` (sale solo de `PLANTILLAS_GENERAL_OFRECIDAS`; `docs/api-mako.md` regenerado).

**Falta:** verlo con los datos de un cliente (la nube no tiene la base) y que Martín lo compare en el Dashboard.

## Focus: la tercera hoja copiada (la de Pane), con lo que MaKo sabe del día (punta `dash-focus`, 4/11/2026)

El pedido (Martín, por el Cerebro): *«Carga los de FOCUS que ya teníamos»*, con la regla de las otras: *«que sea primero la copia, es decir,
que se vea exactamente igual que la copia, y después la adaptación con Maco»*. Focus es una plantilla de **GENERAL** (`lib/general-plantillas.ts`,
id `foco`), no del Dashboard.

**Qué cambia para Martín:**
- **«Nueva hoja» de General ofrece Focus** (era la única de General con maqueta). Es una hoja oscura, de vidrio, como Pane.
- **Arriba:** el saludo con su nombre, la fecha y cuántas llamadas y tareas tiene hoy, y tres cifras: las tareas hechas hoy, las llamadas
  que ya pasaron y las vencidas. A la derecha, «Ver todo en la grilla» y «Próxima: 11:30», que abre lo que viene.
- **Hoy (los anillos):** las tareas de hoy, las llamadas de hoy y los KPIs del día en verde.
- **Lo que viene:** lo próximo del Calendario en grande («en 20 min») y hasta tres más.
- **La meta:** cuánto lleva la meta objetivo, cuánto debería llevar a hoy y cuántos días faltan. El botón la edita o la carga, con el editor de siempre.
- **Mis tareas:** las de hoy y las atrasadas (atrasada = «Urgente», prioridad alta = «Alta»); si no hay, las que más mueven la aguja. El
  círculo la completa, con «Deshacer», con la misma escritura que los bloques de General.
- **La semana:** cuántas tareas y proyectos vencen cada día, con hoy más claro.
- **Proyectos:** los abiertos del Plan, con su avance y sus tareas abiertas.
- **Te está esperando:** los cobros por hacer (abren la tab Pagos del cliente) y los leads por marcar en el CRM, con el selector Cobros · Leads.

**Lo que Pane tiene y MaKo no mide, y no se inventó:**
- el temporizador de foco: en su lugar va «La meta»;
- «Right now» (en qué está cada persona del equipo): en su lugar va «Te está esperando»;
- las tareas cerradas por día: en su lugar, lo que vence cada día;
- el selector «Trimestre · Año» de la maqueta en «La meta»: la meta es una sola, y un selector que no cambia nada es un control muerto.

**Comparación**, captura contra captura (`docs/diseno/mockups-dashboard/focus-pane/captura/`):
- **La copia contra Pane:** `copia-1440.png` / `copia-390.png` contra las capturas del demo. A 1440 mide 1646 px de alto contra 1647, y el título
  lo mismo, porque la letra es Inter 4 con su tamaño óptico, como la captura. Lo que no se copió es el armazón (la barra lateral y la de arriba:
  en MaKo las pone la app) y la foto borrosa del fondo (va su degradé medido).
- **El componente contra la maqueta de la adaptación:** `producto-1440.png` / `mako-1440.png` y `producto-390.png` / `mako-390.png`. Las
  tarjetas, los anillos, las barras y las filas coinciden: 1649 px de alto contra 1647. Diferencias, todas a propósito:
  - «Ver todo en la grilla» en lugar de «Nueva tarea»: el Plan no abre una tarea nueva por link, y un botón que promete algo que no hace no va;
  - sin los avatares de «Lo que viene» (el Calendario no trae a los invitados);
  - el título de la meta, cortado con «…» si no entra.
- **El medio** (641 a 1040 de lienzo) no está en Pane y es nuestro (`producto-800.png`): dos tarjetas por fila arriba, y las de abajo a lo ancho.

**El movimiento** (el INFORME de Pane, con Element.animate; `producto-entrada-420ms.png` es un cuadro a mitad de la entrada, medido con 52
animaciones):
- el título, letra por letra;
- la bajada y los botones;
- las tres cifras y las tarjetas, que suben con su recorte;
- las filas;
- las cifras que cuentan;
- la pastilla del selector, que viaja con el resorte (medido: de 3 px a 71 px, con sus dos animaciones);
- la tarjeta, que sube 4 px con el mouse.

Lo que el INFORME no trae y queda quieto: cómo crecen los anillos y las barras.

**Cómo está hecho:**
- `app/dashboard/disenos/HojaFocus.tsx` dibuja, y su hoja de estilos `focus-css.ts` va dentro de `.fp`, con cada clase con el prefijo `fp-`,
  porque la casa también tiene `.card`, `.btn`, `.grid` y `.chip`.
- `app/dashboard/disenos/FocusVivo.tsx` le pone los datos de verdad. Lo carga `EditorInforme` con `next/dynamic`, sólo si la hoja es un Focus
  y está en General.
- El modelo es `lib/focus-diseno.ts`: de dónde sale cada número, a partir de los datos de los bloques de General (`DatosGeneral`, que General
  ahora presta en su contexto: `useGeneral().datos`). Al Plan de General se le sumaron `deHoy` y `vencidas`.
- El test es `tests/dashboard-diseno-focus.test.ts`: ejecuta el modelo y está probado rompiéndolo (5 de 5 roturas en rojo).
- La plantilla `foco` trae `diseno: { id: 'foco', piezas: {} }`: no lee piezas de la hoja; editando, quedan los bloques de siempre.
- La miniatura de «Nueva hoja» usa el mismo componente, quieto, con un día de ejemplo (`DisenoEnMiniatura.tsx`).

**Falta:**
- verificar contra la base de un cliente (la nube no tiene la base): crear la hoja en ws3 y completar una tarea desde ahí;
- ~~Lumora~~: hecha como su propia hoja, «Mi día» (arriba). **La copia exacta ya está** (`docs/diseno/mockups-dashboard/focus-lumora/`: `lumora.css`,
  `copia.html` y `lumora.js`), comparada contra el demo:
  - a 1440 mide 2042 px de alto contra 2040, y las cajas caen a 1-4 px;
  - a 390, los mismos bloques y el mismo orden.

  A diferencia de Pane, el INFORME de Lumora trae la entrada de su página (`xt`), así que el orden y las demoras son los suyos.
  Lo que no se copió: el helper `Oe(.kpis)`, que el INFORME no muestra, y las curvas back.out de GSAP, que van aproximadas.
  Falta la adaptación a MaKo y su componente.

## Cobranza: la segunda hoja copiada (la de Coffer), con los datos de MaKo (punta `dash-cobranza`, 4/11/2026)

El pedido (Martín, por el Cerebro): *«que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
con Maco»*, y *«seguí con la segunda hoja, una por vez»*. Cobranza es la segunda, con Coffer de referencia.

**Qué cambia para Martín:**
- **«Nueva hoja» ofrece Cobranza** al lado de Closing, con su miniatura de verdad (`docs/diseno/mockups-dashboard/cobranza/captura/miniatura-nueva-hoja.png`).
- **La hoja se ve como Coffer:** arriba, lo que te deben (con lo vencido y la barra por días de atraso: al día, 1-30, 31-60, 60+), y cuatro números
  (cobrado, lo que vence, lo que falta y cuántos días tardan en pagar, cada uno contra el mes pasado). En el medio, lo que vencía cada mes
  (lo que entró arriba de la línea y lo que sigue sin pagar abajo, con el selector 6M / 12M) y a quién perseguir. Abajo, lo último que entró,
  los que más pagaron en el año y lo pendiente por funnel (el anillo).
- **Tocar una fila abre lo de siempre:** «Ver cuota» y cada nombre de «A quién perseguir» abren el detalle de la tabla de cobranza, con
  «Marcar cobrada». Lo último que entró, los que más pagaron y el funnel abren el detalle de su pieza. «Ver todo en la grilla» muestra todas las piezas.
- **Lo que no está, a propósito:** el «Remind» de Coffer (manda un aviso al cliente). Un mensaje a un tercero sale por sus puertas, no por un
  botón de una hoja; en su lugar va «Ver cuota».

**Comparación con la maqueta**, captura contra captura (`producto-1440.png` / `mako-1440.png`, `producto-390.png` / `mako-390.png` en
`docs/diseno/mockups-dashboard/cobranza/captura/`): las cajas, los gráficos y las barras coinciden. Cambian sólo textos que son nuestros:
- «67 días tarde» en vez de «67 días de atraso», que en la maqueta partía el renglón;
- «Falta cobrar este mes» en vez de «del mes»;
- el rótulo del funnel dice el período de la hoja, porque esa pieza lo sigue (la maqueta decía «Todo»).

El ancho intermedio (641 a 1040 de lienzo) no está en Coffer y es nuestro (`producto-800.png`): la deuda a lo ancho, los cuatro números en una
fila, el flujo y «A quién perseguir» a lo ancho, y abajo dos columnas con el anillo a lo ancho. Sin desbordes medidos.

**El movimiento** (el INFORME de Coffer, con Element.animate; `producto-entrada-420ms.png` es un cuadro a mitad de la entrada):
- el título, letra por letra;
- las tarjetas, escalonadas;
- las cifras que cuentan;
- la barra del atraso, tramo por tramo;
- la pastilla del 6M / 12M, que viaja y se estira.

**Lo que NO se copió porque el INFORME no lo trae**, y queda quieto: la entrada de las listas, del flujo y del anillo, y a qué se le pone el hover que sube 3 px.

**«Nueva hoja» con dos miniaturas**, medido igual que antes (arnés con Chromium):

| | Con la CPU normal | Con la CPU 4 veces más lenta |
|---|---|---|
| Primer cuadro | 127–158 ms | 476–496 ms |
| Bloqueo | 4–27 ms | 340–387 ms, después del primer cuadro |

Con una sola miniatura era 92–107 ms y 392–396 ms. Antes del arreglo, con 21, era 410–540 ms y 1.890–1.950 ms.

**Cómo está hecho:**
- `app/dashboard/disenos/HojaCobranza.tsx` y su hoja de estilos `cobranza-css.ts`, todo dentro de `.cbz`.
- El modelo, `lib/cobranza-diseno.ts`: qué dibuja cada bloque a partir de las piezas, con test en `tests/dashboard-diseno-cobranza.test.ts`, probado rompiéndolo.
- Las piezas y los tramos de atraso en `pagos` vienen del commit de la copia.
- Se monta en `EditorInforme` con `onFila` → `alClicDe`, como cualquier gráfico.
- El saludo lo pasa `app/dashboard/page.tsx`.
- ⚠️ **Cobranza es una plantilla del DASHBOARD.** Vive en `lib/graficos-plantillas-generales.ts`, cuyo nombre engaña: no es General.

**Falta verificar:** abrirla contra la base de un cliente (la nube no tiene la base): crear la hoja en ws3 y mirar que «Ver cuota» abra la cuota.

## «Nueva hoja»: sólo lo copiado, la miniatura de verdad y el modal que no se traba (punta `dash-seleccion`, 4/11/2026)

El pedido de Martín (por el Cerebro, después de revisar producción), textual: *«En dashboards, mejora la eficiencia al "crear nueva
hoja", al abrir ese modal se traba todo... Y en "Closing" la minuatura no es para nada igual... Te pido que elimines todos los templetas
viejos y vamos de a poco cargando cuando ya estén... Carga los de FOCUS que ya teniamos, y no se si ya teniamos otros más... Y claro,
guarda los que debemos hacer aún...»*. El Cerebro: primero los puntos 1 (sólo lo copiado), 4 (la miniatura) y 5 (el modal), en una subida.

**Qué cambia para Martín:**
- **«Nueva hoja» ofrece sólo lo copiado de verdad:** hoy Closing (la copia de Halden). Las plantillas de antes salen de la lista; las hojas
  que ya se crearon con ellas no cambian. Lo que falta copiar está en una tabla (`docs/templates-dashboard-propuesta.md` §7.3.1), no en la pantalla.
- **La miniatura de Closing es la hoja:** se dibuja con el MISMO componente de Halden que se ve al abrirla, con números de ejemplo
  (`docs/diseno/mockups-dashboard/closing/captura/miniatura-vs-producto.png`: la miniatura a la izquierda, la hoja a la derecha).
- **El modal abre al instante.**
- **La API de MaKo** ofrece y crea las mismas: `ver_catalogo_dashboard` lista sólo las ofrecidas, `crear_hoja_dashboard` con una plantilla
  vieja contesta «no se ofrece» con las que sí, y `listar_hojas_general` / `crear_hoja_general` igual (hoy General no ofrece ninguna:
  se crea con un pedido). Sin operaciones nuevas.

**El modal, medido** (el componente de verdad, `NuevaHoja`, montado en un arnés con Chromium; del clic al primer cuadro, y las tareas largas
del hilo principal). La causa era montar las 21 miniaturas con sus gráficos de una (≈241 tarjetas y 33 gráficos a la vista); armar las hojas
de muestra cuesta 15 ms y no era:

| | Antes | Después |
|---|---|---|
| Plantillas en la galería | 21 | 1 (Closing) |
| Primer cuadro | 410–540 ms | 92–107 ms |
| Tareas largas al abrir | 1, de 200–300 ms | ninguna |
| Con la CPU 4 veces más lenta: primer cuadro | 1.890–1.950 ms | 392–396 ms |
| Con la CPU 4 veces más lenta: bloqueo | 1.237 ms (la mayor, 1.178) | 163–222 ms, después del primer cuadro |

Lo que queda al 4× es la miniatura de Closing montándose cuando se ve, con el modal ya dibujado. **No se midió en la app con datos**: la nube
no tiene la base. Lo primero en producción es abrir «Nueva hoja» y mirarlo.

**Cómo está hecho:**
- **Qué se ofrece se DERIVA:** `esPlantillaOfrecida` (lib/graficos-plantillas.ts) = la plantilla trae `diseno`. `PLANTILLAS_OFRECIDAS` y
  `PLANTILLAS_GENERAL_OFRECIDAS` las leen el modal y la API. Una hoja copiada nueva entra sola.
- **La miniatura con diseño** es `app/dashboard/disenos/DisenoEnMiniatura.tsx`: el componente del diseño, `quieta` (sin la entrada, sin cifras que
  cuentan, sin leer la caja de IA) y con números de ejemplo con la forma que lee el diseño (los genéricos de la grilla se leían raros: un
  puntaje de 50). La tabla `MINIATURAS` es total sobre `DISENOS_HOJA`: el diseño de Cobranza no compila sin su miniatura.
- **De paso, un bug de Closing en producción:** «Últimas llamadas» ordenaba la columna del día como TEXTO, y el agregador la escribe «dd/mm»
  (sin año): el 28/10 quedaba después del 03/11. `diaDeEtiqueta` (lib/closing-diseno.ts) le pone el año. El test le pasaba fechas ISO, que la
  tabla no da: por eso pasaba.

**Lo que sigue (del Cerebro):** el punto 2 (cargar las de Focus: las maquetas de Pane y Lumora del 1/11 se hacen copia exacta y componente,
como Closing) y la segunda hoja, Cobranza, de a una.

**Cobranza:** terminada y subida en `punta/dash-cobranza` (la sección de arriba).

## 📬 Para el Cerebro: Closing está en producción (4/11/2026, 12:49 UTC)

El mensaje no salió: la sesión de la nube no puede escribirle a una sesión de la PC (`elevated_session_untrusted_device`).
Por eso va acá.

Closing está en main (`a32e3687`, que trae `c43425fb`), el deploy de Vercel se promovió a las 12:49 UTC y la prueba de
después del deploy dio verde (run 41832629302).

**Para Martín:**
- **Dónde se ve:** Dashboard → «Nueva hoja» → Closing, con el diseño de Halden y los números del negocio. Arriba la tasa
  de cierre; después cómo terminaron las llamadas (ganadas en R1, ganadas en R2, sin decisión, perdidas) y las llamadas de
  la semana, con las agendadas rayadas. Siguen las últimas llamadas, la próxima, la tasa de cada closer, lo que ve MaKo y
  la duración promedio.
- **«Editar» y «Ver todo en la grilla»** muestran la grilla de siempre. Una hoja Closing que ya existía no cambia sola:
  para ver el diseño nuevo, hay que crear la hoja de nuevo.
- **Diferencias con Halden, a propósito:**
  - «Ver en el calendario» en vez de «Unirse», porque las llamadas del CRM no traen el link de la reunión.
  - La duración es el total en horas, no ganadas contra perdidas.
  - Entre 641 y 1040 px el diseño va a dos columnas: Halden sólo se midió a 1440 y a 390.
- **Sin código de la tienda:** todo escrito nuestro, a partir de los valores, las capturas y las recetas.

**API de MaKo:** `leer_hoja_dashboard` dice que la hoja tiene su diseño propio, y que editando se ve la grilla. No hay
operación nueva: el diseño lee los mismos gráficos que la API ya lee y edita.

**Falta verificar:** no se pudo abrir contra la base de un cliente desde la nube. Lo primero es crear la hoja en ws3 y en
ws1 y mirarla.

**Lo que sigue:** la segunda hoja, cuando lleguen las demos a `punta/dash-demos-resto`. A las 12:55 UTC esa rama no
existía en origin.

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

### Paso 3: el diseño en el Dashboard, con los datos reales (punta `dash-closing-producto`)

**Qué cambia para Martín:** una hoja nueva desde **«Nueva hoja» → Closing** se ve con el diseño de Halden (el de la maqueta),
con los números de su negocio. Mirando la hoja se ve el diseño; **«Editar»** o **«Ver todo en la grilla»** muestran la grilla de
siempre, con los mismos gráficos. **Una hoja Closing que ya tenía no cambia sola**: para verla hay que crearla otra vez.

Capturas del componente real (el mismo que monta el Dashboard, con datos de ejemplo), al lado de la maqueta:

| | Maqueta | El componente |
|---|---|---|
| Computadora | `closing/captura/mako-1440.png` | `closing/captura/producto-1440.png` |
| Teléfono | `closing/captura/mako-390.png` | `closing/captura/producto-390.png` |
| Lienzo de 760 (una ventana de 1024 con la barra) | — | `closing/captura/producto-760.png` |

Cómo está hecho (para el que siga con la próxima hoja):

- **La hoja guarda qué diseño usa y de qué gráfico lee cada bloque**: `Hoja.diseno = { id: 'closing', piezas: { tasa: <id>, … } }`
  (`lib/graficos-catalogo.ts`, catálogo cerrado `DISENOS_HOJA`). Lo pone la plantilla (`lib/graficos-plantillas-analysts.ts`), el
  saneo saca las piezas cuyo gráfico se borró, y duplicar o copiar la hoja lleva las piezas a los ids nuevos
  (`lib/graficos-copia.ts`). Una hoja sin `diseno` se dibuja como siempre.
- **El dibujo** es `app/dashboard/disenos/HojaClosing.tsx` con su hoja de estilos `closing-css.ts` (todo adentro de `.hc`, con
  `@container` y no `@media`: el lienzo del Dashboard no es la ventana). Lo que el bloque dice lo arma `lib/closing-diseno.ts`
  (puro, con test). Lo monta `app/dashboard/EditorInforme.tsx` cuando la hoja tiene ese diseño y no se está editando.
- **Lo que cambia en la plantilla (la grilla)**: dos gráficos más (las llamadas de los últimos 7 días por día y las de los últimos
  14), y la tabla del equipo suma «ganadas en la R2» y «perdidas», que es de donde «Cómo terminaron» saca sus tramos. **Sale el
  anillo «Cómo terminaron»** de la grilla: contaba lo mismo y una plantilla no pasa de 14 paneles (`tests/graficos-corbel.test.ts`).
- **Lo que la hoja de antes no tenía**: la (las agendadas de los días que vienen y la próxima llamada), que lee el server con `leerLlamadasDeVenta`
  (`lib/closing-diseno-server.ts`) y **sólo para quien ve el Calendario**: un closer o un setter ven el diseño sin la agenda.
- **«Nueva hoja» no le poda al diseño un bloque sin datos de hoy** (`podarSinDatos`, `lib/graficos-con-datos.ts`): el bloque
  queda con su vacío y se llena cuando haya. Los gráficos que no son del diseño se podan como siempre.
- **Tocar una llamada** de «Últimas llamadas» abre el mismo pop-up de la llamada que la grilla.
- **El medio (641 a 1040 de lienzo) es nuestro**: Halden sólo se midió a 1440 y 390. Ahí va a dos columnas, en el orden del teléfono.
- **API de MaKo**: nada nuevo que declarar. `crear_hoja_dashboard` con `plantilla: closing` arma la hoja con el diseño (sale de la
  misma plantilla) y `leer_hoja_dashboard` lee los mismos gráficos de los que sale cada bloque, y dice que la hoja tiene su diseño
  (`hoja.diseno`). La pantalla no tiene un control nuevo que cambiar: el diseño no se prende ni se apaga.

Diferencias con la maqueta, porque MaKo no tiene el dato:

- **«Próxima llamada» lleva «Ver en el calendario»**, no «Entrar a la llamada»: la llamada de venta del CRM no trae el link de la
  reunión.
- **«Duración promedio» dice el total de horas**, no la duración de las ganadas contra las perdidas: la hoja no tiene la duración
  partida por desenlace.

Verificado: el componente dibujado en un navegador a 1440, 1180, 1040, 960, 760, 660, 520 y 390, sin errores en la consola y
sin texto fuera de su tarjeta. **No** se probó con la base de un cliente (la nube no tiene acceso): lo primero al estar en
producción es crear la hoja en el ws3 y en el ws1 y mirarla.

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
| Agencia o servicio | `servicio` | Sunrow · Torque | ¿cada cliente va en fecha? | Avanzaron de etapa | en producción (`98403e8e5`) |
| Curso o comunidad | `curso` | Lumora · Vitrea | ¿cuántos siguen ahí? | Alumnos activos | en producción (`f6a6e8def`) |
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
| CS Analyst | `cs-analyst` | Mender · Vitrea | ¿quién necesita atención, y cuántos se van? | Se dieron de baja | en producción (`b42c446d9`) |
| Productividad | `productividad` | Fernly · Sunrow | ¿qué avanza y qué se estancó? | Avance global | en producción (`54b2922fc`) |
| Automatizaciones | `automatizaciones` | Noria | ¿qué salió, qué falló y en cuánto responden? | Fallaron | `punta/dash-automatizaciones` |
| Contenido e IA | `ia-contenido` | Orrery | ¿cuánta IA gastamos y en qué? | Costo de la IA | en producción (`01e26099a`) |
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
