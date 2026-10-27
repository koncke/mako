# Cómo muestran otras apps a sus clientes y lo que entra (26/10/2026)

Referencias para rediseñar la vista «Customers» del dueño de MaKo, después de dos rechazos por exceso de texto y de botones: 16 capturas de 8 apps, bajadas sin iniciar sesión del demo público de Baremetrics, de centros de ayuda y documentación oficiales y de las fichas de App Store. Todas son de la app real (los demos y la documentación usan datos de ejemplo); las dos de teléfono traen el marco de marketing de la tienda.

1. **Lo que entra y su tendencia**
   - Archivo: `01-baremetrics-control-center.png`
   - App: Baremetrics (app real, demo público)
   - Qué muestra: el MRR de $210.193 «desde $183.045» con ↑14,8% en verde y la curva de 30 días; al lado, «Breakdown · Hoy»: 3 pruebas nuevas, 20 clientes nuevos +$462, 14 cancelaciones −$479,40 y el cambio total, +$1.536,20.
   - Qué le copiaríamos: arriba, un solo número grande con su «desde» y el % en color, y al lado lo que cambió hoy, cada renglón con su + o − en plata.

2. **Inicio con el feed de clientes**
   - Archivo: `02-profitwell-inicio-mrr-y-actividad.png`
   - App: ProfitWell Metrics de Paddle (app real, documentación oficial)
   - Qué muestra: tres tarjetas arriba (MRR $43,94M, 387.487 clientes, 72% activos), cada una con su % contra febrero; el crecimiento del mes contra la meta; y a la derecha «Customer Activity», un renglón por cliente con una etiqueta de color (CHURNED, NEW CUSTOMER, CHURNED DELINQUENT, DOWNGRADED) y el monto con signo.
   - Qué le copiaríamos: la columna de actividad, con una etiqueta de color y un monto por renglón, para ver quién entró, quién bajó de plan y quién dejó de pagar.

3. **La lista con grupos guardados**
   - Archivo: `03-chartmogul-clientes-con-listas-guardadas.png`
   - App: ChartMogul (app real, centro de ayuda)
   - Qué muestra: a la izquierda, las listas guardadas con un emoji cada una (leads nuevos, clientes de EE. UU., pruebas sin convertir); a la derecha, la tabla con MRR, plan y país, el estado en una palabra («Active» en azul, «Past-Due» en naranja) y arriba «8.519 clientes (728 suscriptores activos)».
   - Qué le copiaríamos: los tres grupos (Partners, Agencias, Clientes de agencias) como lista fija a la izquierda, y el estado de pago como una sola palabra de color en la fila.

4. **Grupos como chips con su número**
   - Archivo: `04-baremetrics-clientes-por-salud.png`
   - App: Baremetrics (app real, demo público)
   - Qué muestra: chips «Todos 1000 · Críticos 0 · En problemas 27 · Estables 545 · Prosperando 428» y, en cada fila, el puntaje, nombre y email, MRR, una pastilla de color con el nivel y el motivo en tres palabras («Upgraded recently»).
   - Qué le copiaríamos: los chips con el conteo adentro para cambiar de grupo con un toque, y el motivo corto al lado de cada cliente.

5. **Los que están en mora**
   - Archivo: `05-baremetrics-segmento-en-mora.png`
   - App: Baremetrics (app real, demo público)
   - Qué muestra: el grupo «Delinquent Customers (301)» con su filtro como pastilla y tres totales grandes: 301 clientes, $11.793,80 de MRR y $39,18 por cliente; debajo, la lista con la etiqueta «Delinquent» en amarillo.
   - Qué le copiaríamos: al abrir un grupo, tres números grandes (cuántos son, cuánto pagan, el promedio) antes de la lista.

6. **La ficha con tres números**
   - Archivo: `06-baremetrics-ficha-de-cliente.png`
   - App: Baremetrics (app real, demo público)
   - Qué muestra: una cabecera oscura con el nombre, la pastilla «Active» y solo tres datos: cliente desde marzo de 2022, MRR actual $7,20 y $118,60 cobrados en total. Debajo van el email con un botón «Email», las notas, los atributos y las suscripciones.
   - Qué le copiaríamos: la cabecera con tres números (desde cuándo, cuánto paga, cuánto pagó en total) y una sola acción; el resto, plegado debajo.

7. **La ficha en una fila**
   - Archivo: `07-linear-ficha-de-cliente.png`
   - App: Linear (app real, documentación oficial; no es de cobros, pero es la versión más limpia del patrón)
   - Qué muestra: el cliente «Acme» con una sola fila de datos (estado Active, plan Enterprise, $600K/año, tamaño 410, canal de Slack y «Managed by: Intercom») y debajo sus pedidos agrupados por estado.
   - Qué le copiaríamos: los datos del cliente en una fila de etiqueta y valor, incluido el «lo maneja»; en MaKo, la agencia o el partner que lo trajo.

8. **El riesgo como frase con nombre y plata**
   - Archivo: `08-baremetrics-alertas-de-riesgo.png`
   - App: Baremetrics (Revenue Pulse, en beta; app real, demo público)
   - Qué muestra: «16 señales abiertas · 15 críticas». La primera es grande: «Monty Kuvalis tiene una suscripción impaga», con $278 por mes en riesgo y un botón; las demás van en tarjetas chicas con nombre, monto y una línea.
   - Qué le copiaríamos: cada riesgo como frase con nombre propio y el monto grande («X dejó de pagar · $278/mes»), el más grave arriba y con un solo botón.

9. **Cobros fallidos y tarjetas por vencer**
   - Archivo: `09-baremetrics-cobros-fallidos.png`
   - App: Baremetrics (app real, demo público)
   - Qué muestra: dos listas lado a lado. «Cobros sin resolver ($17.198,50)» trae cada cobro con su estado (Unresolved en rojo, Resolved en verde), los intentos y el monto. «Ingresos en riesgo ($646,40)» trae la fecha en que vence la tarjeta de cada cliente.
   - Qué le copiaríamos: el total en el título de cada lista, el estado del cobro como pastilla roja o verde y la tarjeta por vencer como aviso antes de que el cobro falle.

10. **Pruebas gratis**
    - Archivo: `10-baremetrics-pruebas-gratis.png`
    - App: Baremetrics (app real, demo público)
    - Qué muestra: una fila de números (58,8% de conversión, 36 activas, 82 nuevas, 46 convertidas, 35 canceladas), la curva de conversión y debajo tres listas: activas (vacía, con un «No data available» gris), convertidas con el plan y el MRR ganado en verde, y canceladas.
    - Qué le copiaríamos: las pruebas en tres listas (en curso, pasaron a pagar, se fueron), con lo ganado en verde; si una lista está vacía, basta una línea gris.

11. **La agencia y sus sub-cuentas**
    - Archivo: `11-highlevel-agencia-subcuentas.png`
    - App: HighLevel (Agency Dashboard › Reselling; app real, centro de ayuda)
    - Qué muestra: «11 sub-cuentas», con una fila por cliente de la agencia: ingreso y costo, cada uno como barra con su monto, la ganancia con una flecha verde o roja (−$0,18 en rojo) y el margen.
    - Qué le copiaríamos: para cada agencia, una fila por cliente suyo con lo que deja y una barra para comparar sin leer números; en rojo solo el que da pérdida.

12. **Agencia con pocos datos**
    - Archivo: `12-highlevel-saas-pocos-datos.png`
    - App: HighLevel (Agency Dashboard › SaaS; app real, centro de ayuda)
    - Qué muestra: una agencia chica con MRR $579, nuevo $1, perdido −$1 y las otras tres tarjetas en $0. Dos gráficos sin datos muestran un dibujo gris con «No data available yet», y el del MRR estira el eje entre $577 y $581: un cambio de $2 parece una montaña.
    - Qué le copiaríamos: el aviso «todavía no hay datos» en vez de una curva inventada. Lo que no hay que copiar: las seis tarjetas, aunque estén en $0, y el eje que agranda cambios mínimos.

13. **La empresa con un solo usuario**
    - Archivo: `13-intercom-empresa-con-un-usuario.png`
    - App: Intercom (Companies; app real, centro de ayuda)
    - Qué muestra: la empresa «Blue Sun», con 1 persona y gasto mensual $0,00. A la izquierda, el nombre y un solo botón negro, «Message company»; a la derecha, la tarjeta del único usuario con cinco fechas: alta, sesiones, última vez visto, último contacto y última respuesta.
    - Qué le copiaríamos: la ficha de un cliente con casi nada no se ve vacía: muestra lo que sí hay (cuándo lo vimos y cuándo le escribimos) y una sola acción.

14. **Un solo cliente, con panel lateral**
    - Archivo: `14-polar-un-solo-cliente.png`
    - App: Polar (app real, documentación oficial)
    - Qué muestra: una lista con un único cliente y, al abrirlo, un panel a la derecha con email, nombre, fecha de primera visita, el botón «Send Email», sus suscripciones (cada una con un punto de color: Active, o «To Be Cancelled» en amarillo, y su $/mes) y sus compras.
    - Qué le copiaríamos: la ficha como panel lateral que no saca de la lista, con cada suscripción en un renglón: plan, punto de color con el estado y $/mes.

15. **El celular: hoy en tres números**
    - Archivo: `15-stripe-celular-inicio.png`
    - App: Stripe Dashboard (iOS; ficha de App Store, la app real dentro del marco de la tienda)
    - Qué muestra: «Hoy», con volumen $7,8K, 215 pagos y 213 clientes en una tarjeta; debajo, el volumen del período ($178,02K, +8,3%), con la curva actual sobre la del período anterior en gris y los chips 1S · 4S · 1A · MTD.
    - Qué le copiaríamos: en el teléfono, los tres números de hoy arriba y una sola curva comparada con el período anterior en gris.

16. **El celular: MRR mes a mes**
    - Archivo: `16-chartmogul-celular-metricas.png`
    - App: ChartMogul (iOS; ficha de App Store, la app real dentro del marco de la tienda)
    - Qué muestra: una columna de tarjetas. Primero, el MRR de $612.450 con +1,5% «vs hace 30 días» y barras de 12 meses; después, ARR y clientes. Abajo, fija, la caja «Ask anything about your business».
    - Qué le copiaríamos: el MRR en el teléfono como una barra por mes, más fácil de leer que una línea, y la caja para preguntarle a MaKo fija abajo.

**Lo que se repite en las mejores:**
- **Un número grande y, pegada, su comparación:** «$210.193 desde $183.045 ↑14,8%» o «+1,5% vs hace 30 días». El número nunca va solo (Baremetrics, ChartMogul, Stripe, ProfitWell).
- **Lo que cambió va en renglones de una línea con signo y color:** + en verde y − en rojo. Así lo hacen el «Breakdown» de hoy en Baremetrics, el feed de ProfitWell y la ganancia por sub-cuenta en HighLevel.
- **Los grupos son chips o una lista fija con el número adentro,** como «Estables 545 · En problemas 27», «Delinquent (301)» o las listas guardadas de ChartMogul. Cambiar de grupo es un toque, no un formulario de filtros.
- **El estado de pago es una sola palabra de color en la fila:** Active en azul o verde, Past-Due en naranja, Delinquent en amarillo, Unresolved en rojo. No hay una columna extra que lo explique.
- **El riesgo se escribe como frase con nombre y monto:** «X tiene una suscripción impaga · $278/mes». La más grave va arriba, más grande y con un solo botón.
- **La ficha abre con tres a cinco datos en una fila:** desde cuándo, cuánto paga y cuánto pagó (Baremetrics), o estado, plan, ingresos y quién lo maneja (Linear). Lo demás va debajo o plegado, y muchas veces en un panel lateral que no saca de la lista (Polar).
- **Al abrir un grupo, tres totales antes de la lista:** cuántos son, cuánto suman y el promedio (el grupo en mora de Baremetrics, «11 sub-cuentas» en HighLevel).
- **Sin datos, una línea gris en vez de una tabla vacía:** «No data available», «todavía no hay datos». El ejemplo de lo que no hay que hacer es HighLevel, con seis tarjetas aunque estén en $0 y un eje que convierte $2 en una montaña.
- **En el teléfono, tres números de hoy y una sola curva o barras por mes,** con el período anterior en gris y la caja para preguntar fija abajo (Stripe, ChartMogul).

Descarté el gráfico de MRR de ChartMogul con los números rojos de tutorial, la ficha de Intercom con el recuadro dibujado a mano, la vista «Non-Paying Customers» de Baremetrics (vacía: dos ceros, un gráfico sin barras y una tabla con encabezados y sin filas, el estado vacío que no hay que copiar), las tarjetas de sub-cuentas de HighLevel (doce métricas por cliente, la mayoría en 0%), el formulario de precios de Lemon Squeezy (no es una vista de clientes) y las páginas de marketing de Stripe Billing (dibujos chicos, no la app).

**Lo que se copió:** la 02 (arriba: lo que entra y «Para mirar»), la 04 (los chips con su número y la tabla), la 14 (la ficha en un panel lateral) y la 13 (sin plata, manda la actividad); en el teléfono, la 15. Martín vio todo en una página con pestañas: claude.ai/artifact/Xi1LFpEHTY9ZscqLinqiVc.

**Cómo se bajaron (para la próxima):** Playwright con `chromium_headless_shell-1248` (el `chrome.exe` de `chromium-1243` lo bloquea Windows), sin ventana y muteado. En el demo de Baremetrics, el aviso amarillo «Live Demo» vuelve después de cada clic que cambia de página: hay que ocultarlo después de navegar. Las capturas de App Store se piden más grandes cambiando el sufijo de la URL (`1290x2796bb.png`); en Google Play, con `=w2600-h2600`.
