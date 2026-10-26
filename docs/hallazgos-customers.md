# Hallazgos — Customers (/customers, el super admin)

Lo que no se ve leyendo el código de Customers: la vista de los clientes de MaKo para el super admin, con Billing (era
/admin/cobros) y Agents (era /admin/agente) adentro. Los pedidos textuales, en
[feedback-25-10-tarde.md](feedback-25-10-tarde.md) puntos 10 y 12. Las referencias de diseño (Stripe Customers,
Baremetrics, ChartMogul, HighLevel, AgencyAnalytics) quedaron en la carpeta de notas del Cerebro, `agencias-referencias/`.

## El MRR NO es el precio del plan (25/10/2026)

- Lo obvio era sumar el precio de cada plan (Esencial 47, Pro 97) y daba un número inflado. Mauricio (ws 1), Leila y
  otros tienen el plan **dado a mano**: no hay cobro, MaKo no les factura nada. El MRR que se ve sale de los **cobros
  reales de la plataforma**: suscripciones con `suscripcion_estado = 'activa'`, en dólares (`monto_usd`), sin las pruebas
  gratis (Stripe no cuenta un trial) y sin lo anulado o devuelto. Una en mora sigue contando, porque la pasarela reintenta.
- **Un cobro sin `monto_usd` no se convierte con una tasa inventada:** cuenta como «sin dólares» y la pantalla lo dice.
  Es la misma regla que en lo demás de cobros (docs/hallazgos-planes-y-cobro.md, «La moneda depende de la PASARELA»).
- **El lugar de un cliente de agencia SÍ es MRR**: lo paga su agencia (o él) a MaKo. Por eso suma en el MRR aunque no
  cuente en «Clientes activos».
- **Vive en:** `lib/clientes-plataforma-reglas.ts` (puro, testeado) y `lib/clientes-plataforma.ts`.

## La grilla no se rehízo (25/10/2026)

- `AdminView` ya hacía todo lo que hace falta sobre un workspace: el alta, el plan, el equipo, la ficha con su tablero,
  las computadoras, entrar y borrar. Customers lo monta **incrustado**, filtrado por el segmento y con dos columnas más
  (segmento y MRR), en tabla por defecto. Si dos cosas tienen que verse igual, tienen que ser el mismo componente.
- **El segmento «Clientes de agencias» es el único que muestra a los clientes de una agencia.** La grilla los esconde a
  propósito (28/09: «no son un cliente más de MaKo»), y si se quitaba ese filtro se mezclaban en «Todos».
- **El /clients del super admin manda a /customers** (`pantalla.tsx`): era la misma grilla en dos puertas. En /clients
  queda lo de los cursos (el Classroom).

## Billing y Agents: las rutas viejas quedan como redirect, con su guard (25/10/2026)

- `/admin/cobros` y `/admin/agente` redirigen a `/customers?tab=billing` y `?tab=agents`. Antes del redirect preguntan
  `getSesionAdmin`: un redirect no se le ofrece a cualquiera. El contenido vive en `Contenido.tsx` de cada carpeta.
- **Sus entradas de `HERRAMIENTAS` (nav.ts) quedan**, aunque salieron del menú de la foto: el teléfono abre `/m/cobros` y
  `/m/agente` por su key (`lib/movil-rutas.ts`). Si se borran, el teléfono las pierde sin dar error.
- `/customers` está también en `SOLO_ADMIN` del proxy: dos cerrojos, y además el de cada action.

## Lo que quedó SIN hacer

- **Tendencias y sparklines como Baremetrics:** no hay historia del MRR (nadie guarda una foto por día). Haría falta un
  cron que la guarde antes de poder dibujar «from US$ X ↑ 14%».
- **Customers en el teléfono:** `/m/cobros` y `/m/agente` siguen andando, pero no hay `/m/customers` con los segmentos.
- **La ficha estilo Stripe** (cabecera con 3 números y bloques de suscripciones, pagos y facturas): hoy se abre la ficha
  de siempre de AdminView.
