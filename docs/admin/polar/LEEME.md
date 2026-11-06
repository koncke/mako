# Admin, la copia de Polar: cómo quedó cada pantalla (6/11/2026)

Las 21 pantallas de la tab Admin, a **1440** y a **390** px de ancho, en **oscuro** y en **claro**: `<pantalla>-<ancho>-<modo>.jpg`.
Se comparan con las capturas del panel real de Polar, en [../referencia-polar/](../referencia-polar/LEEME.md).

## Cómo se sacaron

- **Con datos de ejemplo, ficticios** (`app/admin/_polar/datos/ejemplo/`): la nube no ve la base de producción. Ningún nombre,
  email ni monto es de un cliente.
- **Un banco de prueba**: el dev de Next con el layout raíz completo pasa los 12 GB y lo mata la falta de memoria, así que las
  capturas salen de un layout raíz mínimo (la columna de 68 px de la barra de MaKo, vacía) y de las lecturas de Admin
  cambiadas por los ejemplos. Nada de eso se commitea. Por eso la barra de MaKo, a la izquierda, se ve como una franja vacía.
- **Chromium (Playwright)**, sólo la ventana (1440×900 y 390×844), con el modo guardado en `mako.modo` como lo guarda la app.
- Ninguna pantalla vino con un error ni en blanco (se contó el texto visible adentro de `.pl` en cada una).

## Lo que se corrigió comparando (6/11/2026)

- **El documento entero scrolleaba**, en vez de la lista y el detalle por separado como en Polar: el contenedor de Admin tenía
  `flex-1`, que en una columna flex le gana al `height`. Ahora mide el alto de la ventana y adentro scrollea cada panel.
- **Cada renglón de la barra tenía un filete gris**: la regla de los bordes de `.pl` estaba fuera de una capa y le ganaba a las
  clases de Tailwind. Va en `@layer base`, como en Polar.
- **Customers › Overview cortaba Cost Drivers** a la derecha: la grilla de tres columnas iba con `1fr`, que no deja achicar.
- **La ficha:** en Orders el medio de pago y el estado se pisaban («TransferePagado»); la fila de una computadora empujaba el
  botón fuera de la tarjeta; Members medía 1.000 px en una columna de 744.
- **Sales:** el selector de fechas de Orders y Subscriptions salía vacío (el rótulo quedaba en un segundo renglón recortado);
  en Checkouts, a 390, el estado se leía «Cualquier e:».
- **Analytics › Events:** la hora de un pago llevaba el año y se cortaba («04 de nov de 20…»).
- **Customers a 390:** los cinco rangos al lado del título se salían por la derecha; van debajo.

Lo que se ve distinto de Polar a propósito (el orden de la barra, la ficha sin gráfico de ingresos, lo que MaKo no puede llenar)
está en [docs/relevo/nube-admin-polar.md](../../relevo/nube-admin-polar.md).
