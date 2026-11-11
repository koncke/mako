# Relevo — Admin › Costs: a dónde va una suscripción (nube, 11/11/2026)

Encargo 2 de [encargos-admin-10-11.md](encargos-admin-10-11.md). Martín, 10/11: «Si todavía no está dentro de SuperAdmin toda
la parte de costos con gráficos bien diseñada, eso debería estar».

## Lo hecho (rama `punta/costs-suscripcion`, commit `70611f4b` + el de este relevo)

En **Admin › Analytics › Costs** (`/admin/analytics/costs`), pestaña Overview, después de «What you keep», tres secciones:

- **Subscription breakdown.** El reparto del plan de 47 y del de 97: Ganancia, Captación, Servir la cuenta, Impuesto, Cobro.
  - Arriba, seis selectores: clientes (reparte el fijo), CAC, uso del cupo de video, pasarela, impuesto sí/no y fijo (lo tuyo o
    todo).
  - Viene elegido el escenario del modelo del 7/11 (50 clientes, CAC 97, 25% del cupo, Mercado Pago a 35 días, con impuesto,
    US$438,25 de fijo): el 97 da 67,94 · 4,37 · 14,83 · 8,11 · 1,75.
- **First month.** Por plan, el primer mes pagando el CAC entero y lo que deja desde el segundo mes: el 97 da −24,69 y 72,31,
  el 47 da −66,48 y 30,52. Debajo, el techo del CAC y cuánto pierde cada plan el primer mes con el CAC elegido.
- **AI quota.** El cupo de cada plan en MaKo Tokens (11.750 y 24.250), su techo en dólares y lo que cuesta con el uso elegido.

**Una sola fuente:** `loQueSeVaDeUnaSuscripcion` (lib/economia-unitaria.ts). La usan Costs y `TORTAS` de
`app/admin/estrategia/datos.ts`. Las tortas de /admin/estrategia dan los mismos números que antes: los tests de estrategia
siguen en verde sin tocarlos.

**De Polar (Apache-2.0), nada inventado:**

| Pieza en Costs | De dónde sale en polarsource/polar |
|---|---|
| El reparto | el «Breakdown» de las cancelaciones, `components/Metrics/CancellationsDistributionChart.tsx`. Copiado en `app/admin/_polar/web/Metrics/DistributionChart.tsx`, en la grilla de `CancellationsContent.tsx` y con sus colores (`cancellations/constants.ts`). Polar no tiene gráfico de anillo. |
| Los selectores | el Select de Orbit, en la fila de filtros de `MetricsHeader.tsx` |
| El primer mes y los cupos | las tarjetas de «Changes» de su `CostsPage.tsx`, como Unit economics y What you keep |
| El techo del CAC | un Alert |

**Arreglo de paso (estaba roto en producción):** Fixed costs, Unit economics y What you keep le pasaban DÓLARES al formateador
de Polar, que espera CENTAVOS. La página decía «US$ 4,38 al mes sale de tu bolsillo» con un fijo de US$438,25, y lo mismo en
cada número de esas secciones. Ahora van por `fmtUsd` (`app/admin/(polar)/analytics/costs/utils.ts`). Un negativo ya no se
parte en dos renglones.

**Probado:** `tests/costs-suscripcion.test.ts`, 7 casos, cada uno probado rompiéndolo. La tabla de roturas está en su
cabecera. Siguen en verde estrategia-tab, uso-del-cupo, lo-que-queda, economia-unitaria, admin-polar-arreglos,
admin-polar-zona, puente-panel-copy, progreso, el índice de hallazgos y `scripts/guardas-push.sh`. Los tipos dan 0 errores
en el `tsc` acotado de los archivos tocados.

**Capturas:** `docs/admin/polar/analytics-costs-suscripcion-{1440,390}-{claro,oscuro}.jpg`. Sólo las tres secciones nuevas,
con datos de ejemplo y sin desborde horizontal a 390 px.

## Lo que decide Martín

1. **El techo del CAC, ¿con o sin la parte del fijo?** Acá es **72,31** en el 97, lo que deja desde el segundo mes: precio −
   cobro − impuesto − (video + fijo ÷ clientes). El tablero local lo calculaba como precio − cobrar − IA, **sin** el fijo:
   81,08 contando el impuesto, 89,19 sin él. Se eligió con el fijo para que la página cierre: el primer mes (−24,69) es el techo
   menos el CAC, y el fijo ya era parte de «Servir la cuenta» en la torta que aprobó el 10/11. Si lo quiere sin el fijo, se
   cambia una línea en `loQueSeVaDeUnaSuscripcion`, y el primer mes pasa a decir otra cosa.
2. **Lo que quedó afuera del tablero:**
   - **«Altas nuevas este mes».** Es el gasto de adquisición del mes de toda la cartera, no de una suscripción. En Polar no
     hay una pieza que lo diga.
   - **«Llegar a 50 clientes: qué hay que invertir».** Es la tabla de canales con «se recupera en N meses». Es estrategia de
     adquisición y vive en /admin/estrategia §9.
   - **«Quién paga qué».** Ya está en Costs, en «Fixed costs» (quién paga cada partida y cuánto es lo tuyo).
   - **«Cuántos clientes hacen falta».** Ya está en Costs, en «What you keep» y su aviso del equilibrio.

   El HTML del tablero queda como estaba, con un aviso en `docs/tableros/LEEME.md`: los números que valen son los de Costs.
3. **Los cupos del tablero no son los del código.** El tablero muestra la propuesta del 7/11: el 47 con 1 clip y el 97 con 4
   minutos (24 clips, unos 11.500 MT). El código vigente dice 11.750 MT y 24.250 MT (`CUPO_MENSUAL`), y 6 y 36 clips
   (`CLIPS_POR_MES`). Costs muestra lo del código, que es lo que se cobra hoy. `docs/tableros/LEEME.md` ya decía que el cupo
   nuevo no está aplicado: si se aplica, Costs cambia solo.

## Notas para quien siga

- La pasarela «Creem / Paddle» sigue en los selectores porque estaba en el tablero, aunque Creem rechazó la tienda el 5/11.
  Si molesta, se saca de `PASARELAS` (lib/economia-unitaria.ts).
- `USO_SUPUESTO` y `techoDeIa` se mudaron de lib/uso-del-cupo.ts a lib/economia-unitaria.ts para no hacer un ciclo de
  imports. uso-del-cupo los re-exporta, así que nadie tuvo que cambiar de dónde los lee.
- El despliegue y la verificación en producción los hace el Cerebro. Cuando esté en «Ready», hay que mirar
  `/admin/analytics/costs`. Lo primero es que «Fixed costs» diga US$ 438,25 y no US$ 4,38.
