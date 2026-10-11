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

## Las cuatro decisiones, contestadas (10/10, chat «MaKo Pricing», cuenta 3) — HECHO

En producción con `a5cf1407`. El pedido textual, en la bitácora de `gtm-oferta-y-precios`.

1. **La proyección se mide en la ventana de los anuncios (1/11 al 15/12), no por mes**, con
   **US$2.000 de pauta en total** y un **objetivo de US$15.000** («10 tickets de 1500 o
   muchos de 47 o 97»). La prospección se estira proporcional (1.500 conversaciones). Da 26
   agendas → 8 grupales → US$12.000; faltan 32 agendas.
2. **El 1 a 1 vuelve a US$10.000.** El contenido lo define Martín («La defino yo»): la
   tarjeta dice «Contenido a definir» y no entra en la proyección.
3. **`/vsl/costos` es privada** (sólo super admin; el guard en la página). El link de
   Mauricio dejó de abrir.
4. **La propuesta a Jan se reescribió** con el programa de referidos. Chocaba en cinco
   filas, no en tres: también «acceso de por vida» y «recurrencia sin mover un dedo».

## Lo que espera a Martín

1. **Qué incluye el 1 a 1 de US$10.000** («que realmente valga mucho la pena»). Lo define él.
2. **Las tasas del runway y de la tab siguen sin coincidir**: US$100 por agenda y 50% de
   asistencia (runway) contra US$125, 80% y 40% (tab). La tab usa las que él aprobó.
3. Después: el acuerdo de una página y los mensajes para los referidores del grupal (Jan,
   Juanfran, su hermana). Nada se le anunció a nadie y P68 sigue tachado en el Plan.
