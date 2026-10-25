# Hallazgos — Pruebas A/B (`lib/pruebas/`)

El motor de pruebas A/B de MaKo (asignar, juez, volumen, métricas) y todo lo que decide si una versión ganó. El diseño está en
[diseno-pruebas-ab.md](diseno-pruebas-ab.md).

## Mirar todos los días miente: 10 a 35 % de falsos ganadores con el volumen de MaKo (25/10/2026)

**Vive en:** `lib/pruebas/juez.ts` (todavía no existe: esto es lo que su test tiene que fijar).

- **El diseño obvio era el de VWO:** declarar ganador con P(mejor) ≥ 95 % en dos lecturas diarias seguidas, más pérdida esperada
  menor al 1 %, con un prior «escéptico» de peso 10. El crítico simuló 20.000 pruebas A/A (sin ninguna diferencia real) con ese
  calendario:
  - automatización, 25 por rama y por día, mínimo 20, 60 días: **17,4 % «gana B» falso y 16,9 % «gana el control» falso**;
  - con mínimo 300 por rama: 14,5 % y 16,6 %;
  - landing, 34 por rama y por día, mínimo 400, 28 días: 10,0 % y 12,1 %;
  - UNA sola mirada al llegar a 1.800 por rama: 4,7 % y 0 %.
  Un prior de peso 10 son 10 visitas inventadas: al lado de cientos de visitas reales no frena nada.
- **La regla:** el n por rama se calcula ANTES de arrancar (`volumen.ts`) y «gana» se decide sólo en ese horizonte. Las lecturas
  de antes sólo pueden cortar por DAÑO (99,5 %). El test del juez simula A/A con el calendario real de lecturas y exige ≤ 5 % de
  falsos ganadores, y es la puerta de todo lo demás.
- **Cortar temprano no es «no funciona».** Si el corte termina en «gana el control» y eso se guarda como `refutada`, MaKo lo
  repite en todo el dashboard como «probado que no funciona» (`resumenExperimentos`). Una prueba cortada queda `no_concluyente`.
- **«Da lo mismo» con ±10 % relativo nunca se cumple** con este volumen (con 10 % de tasa harían falta ~4.900 por rama): el
  umbral es el efecto mínimo detectable planificado, y el texto dice «no se vio una diferencia mayor a X».
- **El aprendizaje cita el INTERVALO, no el punto:** 2/20 contra 8/20 da P = 0,969 pero el lift va de +10 % a +523 %. Un «subió de
  10 % a 40 %» presenta como verdad un número que no se sabe.
- **«Agendó» y «respondió» son estados que se reescriben** (una reunión vieja cuenta apenas el lead entra; la inscripción se
  reusa al volver a entrar): se congelan en la asignación.

*25/10/2026, el Cerebro (claude5), con los relevamientos de pruebas A/B y de conexiones (docs/diseno-pruebas-ab.md, docs/conexiones-y-ayuda.md).*
