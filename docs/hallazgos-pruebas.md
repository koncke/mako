# Hallazgos — Pruebas A/B (el motor compartido, `lib/pruebas/`)

El motor de las pruebas A/B de toda la app: el reparto (`asignar.ts`), las cuentas (`estadistica.ts`), el juez
(`juez.ts`), el volumen (`volumen.ts`) y las métricas (`metricas.ts`). Lo usan la tarjeta «A/B TEST» de Automations y
la landing (Landings). El diseño está en `docs/diseno-pruebas-ab.md`; donde chocan, manda la crítica (Anexo 2).

## El juez decide UNA vez, en el horizonte del plan: medido con pruebas A/A (25/10/2026)

**El síntoma (lo midió la crítica):** mirar todos los días y declarar ganador con «95 % dos días seguidos» daba entre 10 y
35 % de falsos ganadores con el volumen de MaKo. El diagnóstico obvio era «el umbral es bajo», y no alcanzaba: el
problema era MIRAR. Cada lectura es otra chance de que el azar cruce el umbral.

**La regla:** «gana» se decide una sola vez, en el horizonte: el día en que todas las ramas tienen el n del plan
(`volumen.ts`, calculado ANTES de arrancar) y pasaron 7 días. Ese día depende sólo de cuánta gente entró, nunca de los
resultados, y por eso vale como una sola mirada. Antes del horizonte sólo se corta por daño, con 99,5 % y con la mitad
del plan en cada rama. Cortar NO es «no funciona»: queda `no_concluyente`. Al tope no se registra ninguna verdad.

**Los números (semillas fijas, `tests/pruebas-juez-aa.test.ts`):** en una automatización A/A (10 %, 12 por rama y por
día, ventana de 7), 1,3 % «gana B» y 0,7 % «gana el control». Con 3 ramas, 1 %. En una landing (5 %, 34 por día),
2 % + 1,3 %. Con el efecto del plan (10 % → 18 %), B gana 78 % de las veces. El test exige ≤ 5 % de falsos ganadores. Con
«mirar todos los días» da 2 / 3, y con un juez mudo, 4 / 1: un juez que nunca decide también pasa el A/A, por eso el test
mide la potencia.

## La regla doble de VWO (pérdida < 1 %) no ata con 98 % (25/10/2026)

El diseño la pedía junto al 95 %. Con el umbral en 98 % no frena nunca: el caso más extremo, 0/6 contra 6/6, pierde
0,00115 con un techo de 0,0033. Su rotura queda verde a propósito, y el test lo dice. Se queda como guarda por si el
umbral baja. Donde SÍ decide es al tope: 1/10 contra 4/10 da 85 % de ser la mejor, pero pierde 0,0102, y se queda A.

## Integrar en vez de sortear, y la grilla que se agranda sola (25/10/2026)

El diseño pedía 20.000 sorteos de la Beta por lectura. El test A/A corre decenas de miles de lecturas: con sorteos
tardaba minutos. `estadistica.ts` integra sobre una grilla (1.500 puntos) y queda a ~1e-5 de la fórmula cerrada de Evan
Miller.

**⚠️ La trampa:** la primera rotura de «grilla gruesa» salió VERDE. Ningún caso del test tenía dos ramas angostas y
cercanas junto a una lejos. Con ese caso, 1.500 puntos daban un error de 7,5e-4. Por eso la grilla se agranda hasta 16
puntos por desvío de la rama más angosta (tope 20.000), y el test lleva el caso.

**El prior es Beta(1 + 10·p, 1 + 10·(1 − p)), no Beta(10·p, 10·(1 − p)):** con 0 éxitos y la tasa conjunta casi en 0, α
quedaba por debajo de 1 y la densidad era infinita en el 0. El «1 +» la deja acotada para la integral.

## «Da lo mismo» tiene que cruzar el cero (25/10/2026)

Con la regla de la crítica (el intervalo del 90 % dentro de ± el efecto del plan), una B 50 % PEOR salía «da lo mismo»
en 1 de cada 3 simulaciones: el intervalo [−70 %, −20 %] queda dentro de ±80 %. Ahora además tiene que cruzar el cero.
Si no lo cruza, es `no_concluyente`.

## Sólo cuentan las personas maduras (25/10/2026)

El diseño (2.5) contaba también a las que todavía no cumplieron la ventana pero ya lograron la métrica. Eso sube la tasa
de la rama que convierte más RÁPIDO aunque no convierta más. `metricas.ts` cuenta sólo a las que ya cumplieron la
ventana, y el éxito sólo dentro de ella. Si el medidor no devolvió a alguien maduro, la lectura falla: no cuenta como 0.

## Sin hacer

- **A2:** las tablas (`pruebas`, `prueba_variantes`, `prueba_asignaciones`, `prueba_lecturas`, `prueba_historial`), el
  store, un cron diario, `concluir` hacia `experimentos` y el formato `ab:` en `fmtVal`. Falta decidir a qué estado de
  `experimentos` va `da_lo_mismo`: la crítica dice «refutada sólo con daño demostrado», así que no va como refutada.
- **A3:** la clase `ab` con todas sus puertas, la tarjeta, Probar, Métricas, Crear/Editar con IA y la API.
- **Landings** espera las firmas de `asignar` y del store para servir la landing. `ramaParaServir` ya está.
