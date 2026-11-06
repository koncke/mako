# Polar, el panel real: la referencia de la tab Admin (6/11/2026)

Capturas del panel de Polar con la sesión de Martín, en su entorno de pruebas (`sandbox.polar.sh/dashboard/mako`), a 1440 de ancho y sin datos: la cuenta es nueva. Sirven para ver el reparto. Las medidas exactas salen del código del repo, `polarsource/polar`.

## Lo que se ve y se copia

- **Una sola barra a la izquierda y ninguna barra superior.** En Polar, el pie de la barra tiene el selector de organización (`overview-menu-cuenta.png`). En MaKo ese pie no va: perfil y modo oscuro son los de la barra de MaKo.
- **Overview** (`overview.png`): título y dos filas de tres tarjetas: Revenue (cinco meses, en barras finas), Activity, Available balance; Top customers, At risk, Gross margin. Cada tarjeta tiene «View all», que lleva a su página. Abajo, «Metrics» con All Time, 12m, 3m, 30d, Today y «Customize»: Revenue, Monthly Recurring Revenue, Active Subscriptions, Orders, Checkouts Conversion Rate.
- **Customers** (`customers-*.png`): maestro y detalle. A la izquierda, la lista de clientes con buscador, filtro, orden y «+». A la derecha, Overview, Top Customers, At Risk y Cost Drivers, con período arriba a la derecha. Elegir un cliente abre su ficha en el mismo lugar.
- **Analytics**: Metrics (`analytics-metrics.png`) con intervalo, fechas y producto, y por grupos (Revenue, Net Revenue, Cumulative Revenue…). Events (`analytics-events.png`) con filtros a la izquierda y línea de tiempo. Costs (`analytics-costs.png`).
- **Sales**: Orders (`sales-orders.png`), tres números y una tabla, con filtros y «Export». Subscriptions (`sales-subscriptions.png`).
- **Products** (`products-catalogue.png`), **Finance** (`finance-income.png`).
- **Settings** (`settings.png`): reemplaza la barra por la suya, con «← Settings».
- La subpágina se abre debajo de su sección en la misma barra: se despliega sólo la sección activa.

## Lo que NO se copia

El cartel de «sandbox», la tarjeta «Introducing Polar Plans», Support, Documentation, el selector de organización, y lo que MaKo no puede llenar (Payouts, Taxes, Benefits, Meters, Checkouts Conversion Rate si no hay dato).

## Adaptaciones ya decididas

- La tarjeta **Available balance** es **Por cobrar**: los próximos cobros, con «View all» a Sales › Subscriptions. MaKo no tiene saldo para retirar, y sin esa tarjeta la grilla queda con un hueco.
- La tipografía es **Inter**. «PP Neue Montreal», la primera de Polar, es comercial; Inter es la segunda que declara su propio CSS.

## Medido en el navegador

Fondo oscuro con bordes `rgb(33, 33, 33)`, título 24 px peso 500 en blanco, texto 16 px peso 450 en `rgb(117, 117, 117)`, barra de 208 px.

## Falta

La ficha de un cliente con datos: la cuenta no tiene clientes. Hasta tener su captura, sale del código (`components/Customer/CustomerPage/`).
