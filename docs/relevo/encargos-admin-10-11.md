# Dos encargos de Admin para la nube (10/11/2026, el Cerebro)

Martín, 10/11: «Todo eso debería estar en admin, y por ejemplo, recibimos un pago de Código por el cliente de Patricia y no se
cargó automáticamente en admin eso». La app no dejó abrir los chats de la nube desde la conversación del Cerebro. Cada encargo
se pega tal cual en New session → Cloud, repositorio `koncke/mako`. Los dos tocan archivos distintos y pueden correr a la vez.

---

## Encargo 1 — Admin › Revenue: los pagos de agencia aparecen solos

Hacé que Admin › Revenue (y Customers, que usa la misma lectura) muestre SOLO los pagos que entran por el libro de la mensualidad
de las agencias, sin que nadie los cargue a mano.

**Lo medido en producción** (el Cerebro, sólo lectura, 10/11):
- `lib/admin-ingresos.ts` (Revenue) lee dos fuentes y ninguna más:
  - `pagos` del CRM de la plataforma (`wsSuperAdmin()`, el ws 9) con `pagado = true`;
  - `cobros` pagados que ningún pago nombra.
- Los pagos anteriores de Código (ws 13) se cargaron A MANO como `pagos` del ws 9, con lead «Juanfran Marquez», `cliente_ws` 13 y
  `es_mensualidad` true: #115 (20/10, US$146), #135 (3/11, US$94) y #136 (4/11, US$144).
- La entrada de Patricia entró por el libro de la agencia (`lib/agencia-mes.ts`: `marcarEntradaPagada` → `aplicarPagoDeAgencia`):
  ws 22, 9/11, 40 USDT por Binance, orden `464765031875870720`. Quedó en `app_settings` del ws 9:
  - `agencia.mensualidad.13.orden.464765031875870720`, con `montoUsd 40` y `aplicado [{clave:'entrada:22', montoUsd:40.73}]`;
  - `agencia.mensualidad.13.entrada.22`.
  Salió el recibo 0003, pero NO hay fila en `pagos`, así que Revenue no la ve.
- La mensualidad de Código está prendida desde 2026-12: desde ese mes todo lo que pague una agencia entra por ese libro.

**El diseño preferido.** Que `lib/admin-ingresos.ts` lea el libro como TERCERA fuente, al leer y sin escribir en `pagos`. Así cubre
lo pasado y lo que viene, y Patricia aparece sola con el despliegue.
- Cada orden es un ingreso, con la fecha y el `montoUsd` RECIBIDO (40, no 40,73).
- Se atribuye a la AGENCIA (su lead del ws 9 con `cliente_ws` = la agencia), como `cobros.agencia_ws`.
- MRR y cash: lo aplicado a `mes:*` es recurrente; lo aplicado a `entrada:*` es cash, nunca MRR. Una orden repartida se parte según
  `aplicado`.
- Una orden que ya está en un `pagos` del ws 9 no se cuenta dos veces: buscar en `supabase/migrations/` qué columna la guarda.
- Si el libro no se puede leer, sale un aviso y no un cero.

La alternativa, si leer el libro no se sostiene: `aplicarPagoDeAgencia` escribe el `pagos`, idempotente por orden, y Patricia la
carga el Cerebro con el sí de Martín. Decir en el relevo cuál y por qué.

**Tests, probados rompiéndolos:**
- una orden del libro aparece en Revenue;
- Patricia es US$40 de cash de la agencia 13, sin MRR;
- un mes pagado suma al MRR;
- una orden que ya está en `pagos` no se cuenta dos veces;
- si el libro no se lee, sale un aviso;
- Customers muestra el total de Código.

**Entrega:**
- rama `punta/ingresos-agencia`;
- relevo en `docs/relevo/nube-ingresos-agencia.md`;
- lo aprendido en `docs/hallazgos-planes-y-cobro.md`, con su línea en el índice `docs/hallazgos.md`.
No se escribe en producción.

---

## Encargo 2 — Admin › Costs: a dónde va una suscripción, y lo del tablero

Martín quiere el análisis de costos en Admin. Hoy está repartido:
- **Admin › Analytics › Costs** (`app/admin/(polar)/analytics/costs/CostsPage.tsx`, copia de Polar) ya tiene «Unit economics» y
  «What you keep», calculados con `lib/economia-unitaria.ts`.
- **La torta de lo que se va de una suscripción** está en otra página: `/admin/estrategia` §8. Se rehizo el 10/11 en la rama
  `punta/torta-97`, commit `1f986ff22`. Ahí viven `PASARELA`, `IMPUESTO`, `META_CLIENTES` y `USO_SUPUESTO`, y el 97 queda en 67,94 de
  ganancia, 4,37 de captación, 14,83 de servir, 8,11 de impuesto y 1,75 de cobro.
- **El tablero local** `docs/tableros/numeros-mako.html` tiene los selectores (clientes, CAC, uso del cupo, pasarela, impuesto,
  fijo), la cuenta del primer mes, el techo del CAC (precio − cobrar − IA) y los cupos por plan.

**Qué hacer:**
1. Una sola función para lo que se va de una suscripción, por plan, en `lib/economia-unitaria.ts`. La usan Costs y
   `app/admin/estrategia/datos.ts` (`TORTAS`).
2. En Costs, una sección con ese reparto para el 47 y el 97, armada con los componentes que la página YA copió de Polar
   (`MetricGroup`, las listas de Breakdown, los gráficos).
   - ⚠️ **PROHIBIDO INVENTAR** (AGENTS.md, arriba de todo): nada que Polar no tenga.
   - Si una parte del tablero no tiene equivalente en Polar, queda afuera y se anota en el relevo, y decide Martín.
3. Del tablero, lo que entre con esas piezas: la cuenta del primer mes, el techo del CAC y los cupos por plan.
4. `docs/tableros/LEEME.md` dice que «Los números» pasaron a Admin › Costs.

**Base:** partir de `punta/torta-97` si todavía no está en main.

**Verificación:** la vista es pura por props. Capturas con datos de ejemplo, en escritorio y en celular, en claro y en oscuro, más
los tests.

**Entrega:**
- rama `punta/costs-suscripcion`;
- relevo en `docs/relevo/nube-costs-suscripcion.md`;
- lo aprendido, con su línea en el índice.

---

**Para los dos:**
- Autor `Claude <martinkoncke@gmail.com>`, con `git config user.email martinkoncke@gmail.com && git config user.name Claude`.
- Trailers `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` y `Claude-Cuenta: nube`, pegados.
- Commits por ruta explícita.
- La verificación en producción y el despliegue los hace el Cerebro.
