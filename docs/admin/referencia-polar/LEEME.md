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

## La ficha de un cliente

Capturada con un cliente de prueba, sin pagos, en la misma cuenta (`ficha-1.jpg` a `ficha-3.jpg`, `ficha-usage.png`). La lista de clientes queda a la izquierda, con el elegido marcado. A la derecha, de arriba abajo:

1. Nombre y correo, y un «⋮» con las acciones.
2. Overview, Usage y Events. **Events no es una página de la ficha:** abre Analytics › Events filtrado por ese cliente. Members aparece sólo si el cliente es un equipo; en MaKo todo negocio lo es, así que va siempre.
3. «Metrics» con All Time, 12m, 3m, 30d y Today: Revenue grande, y debajo de a dos Costs, Profit, Profit Margin y Orders.
4. Details (ID, External ID, Email, Name, Type, Created) y Billing (Balance, Name, Tax ID, Country), en dos columnas de clave y valor.
5. Las tablas Subscriptions, Orders, Recent Payments y Benefit Grants, cada una con su título. Benefit Grants no va en MaKo.

`customers-overview.jpg` es Customers con un cliente: el gráfico «New Customers» con New y Total, y debajo Top Customers, At Risk y Cost Drivers, en tres columnas.

Las capturas con partes más oscuras son la entrada animada de la página, a medio camino: no es el diseño.
