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

## La segunda vuelta de la tab (HECHA el 10/10, después del corte)

Martín (10/10, después de verla): «eliminaste cosas de la antigua tab de estrategia que
estaban buenas, como la intro, que decía el avatar» y «usa más desplegables, que se separen
bien las secciones, no se entiende, son muchas cosas todas juntas. Quiero tener claridad de
qué estoy leyendo en todo momento».

Lo que quedó: la intro y el cliente ideal de vuelta arriba; doce secciones numeradas, cada
una un desplegable con la pregunta que contesta, en tres grupos (La estrategia · Los
números · Lo que sigue); el renglón de la sección abierta queda pegado arriba al scrollear;
lo que estaba en un hover (los seis ejes, el Loom, el diagnóstico, los canales a futuro) se
ve; y la propuesta a Jan vuelve en su propio desplegable, con los tres puntos que chocan
con los referidos MARCADOS, no corregidos. El porqué, en `docs/hallazgos-planes-y-cobro.md`
→ «Y la segunda vuelta, el mismo día».

## Lo que espera a Martín

1. ¿El **1 a 1 de US$4.000** sigue existiendo? Sin él, 5 ventas son US$7.500 y el objetivo
   de 10.000 pide 7 ventas (~22 agendas).
2. ¿La pauta de noviembre es **US$1.000 o US$2.000**? (estrategia vs. runway)
3. ¿**`/vsl/costos`** se hace privada? Hoy es pública, con los costos de la empresa.
4. **La propuesta a Jan** choca en tres puntos con los referidos decididos (licencia de
   reventa, prueba gratuita extendida, % de ganancias): ¿se le ofrece lo de julio, o se
   reescribe con el programa del 10/10? La tab la muestra marcada (`datos.ts`, `JAN_GANA`).
5. Después: el acuerdo de una página y los mensajes para los referidores del grupal (Jan,
   Juanfran, su hermana).
