# Relevo — Vender MaKo: la tab Strategy y los referidos (10/10/2026)

Chat: «Estrategia de ventas MaKo» (sesión `76363c1b`, cuenta 2). Se cortó al 86% del uso
semanal.

## Lo que está hecho y en producción

- **La tab Strategy** — `/admin/estrategia` (`app/admin/estrategia/`: `page.tsx`,
  `Estrategia.tsx`, `datos.ts`, `estrategia.css`), sólo super admin (`getSesionAdmin`).
  Junta la estrategia, el runway, los costos (tres tortas: 47, 97 y grupal 1.500) y los
  referidos. Los números se IMPORTAN de `app/admin/runway/datos.ts` y de
  `app/admin/dev/pricing/modelo.ts`. `/vsl/estrategia` redirige ahí (comprobado en
  producción: sin sesión → login). Commit `9862c146`.
- **El programa de referidos DECIDIDO** — `docs/referidos.md`, sección «EL PROGRAMA
  DECIDIDO» y «Dos cambios de Martín». No está anunciado a nadie ni cargado al Plan (P68
  sigue tachado).
- **La cosecha** — `docs/hallazgos-planes-y-cobro.md`: «Referidos (10/10)» y «La tab
  /admin/estrategia (10/10/2026)».

## Lo que estaba EN CURSO cuando se cortó

Martín (10/10, después de verla): «eliminaste cosas de la antigua tab de estrategia que
estaban buenas, como la intro, que decía el avatar» y «usa más desplegables, que se separen
bien las secciones, no se entiende, son muchas cosas todas juntas. Quiero tener claridad de
qué estoy leyendo en todo momento».

Lo que hay que hacer en `app/admin/estrategia/Estrategia.tsx`:
1. **Devolver la intro**: «Cómo vamos a vender MaKo» + el párrafo, y «El producto y a quién
   se le vende» (el link a la landing y el cliente ideal: corre o quiere correr un VSL Funnel
   pago; ya no se exige facturar US$10-20k; puede invertir desde ~US$20/día). La versión
   vieja está en git: `git show 9862c146^:app/vsl/estrategia/Estrategia.tsx`.
2. **Cada sección en un desplegable** (`<details>` nativo, la página es server-rendered),
   numerada, con un renglón que diga qué contesta. Un índice arriba.
3. **Devolver lo que se escondió en hover**: las descripciones de los 6 puntos que se
   analizan en la llamada, la propuesta a Jan (dentro de «Canales a futuro», en un
   desplegable).

## Lo que espera a Martín

1. ¿El **1 a 1 de US$4.000** sigue existiendo? Sin él, 5 ventas son US$7.500 y el objetivo
   de 10.000 pide 7 ventas (~22 agendas).
2. ¿La pauta de noviembre es **US$1.000 o US$2.000**? (estrategia vs. runway)
3. ¿**`/vsl/costos`** se hace privada? Hoy es pública, con los costos de la empresa.
4. Después: el acuerdo de una página y los mensajes para los referidores del grupal (Jan,
   Juanfran, su hermana).
