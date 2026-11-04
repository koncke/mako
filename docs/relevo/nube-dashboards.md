# Relevo — las hojas del Dashboard (4/11/2026, chat en la nube)

## 📬 Para el Cerebro (4/11/2026, ~20:00 UTC)

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
