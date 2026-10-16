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
   tarjeta dice «Contenido a definir» y no entra en la proyección. **15/10 (Ticketera):** el
   contenido se arma con la tab Offer, nunca a mano («Para esto justamente está la
   funcionalidad de offer... Luego la voy a probar»). Ya no espera nada de este chat.
3. **`/vsl/costos` es privada** (sólo super admin; el guard en la página). El link de
   Mauricio dejó de abrir.
4. **La propuesta a Jan se reescribió** con el programa de referidos. Chocaba en cinco
   filas, no en tres: también «acceso de por vida» y «recurrencia sin mover un dedo».

## Partir Strategy en tabs: la propuesta (10/10, 22:39) — sin construir

Pidió sacar de Strategy las tabs que merecen la suya, «funcionales, reales». Está en
[`docs/propuesta-tabs-strategy.md`](../propuesta-tabs-strategy.md) (corrida `wf_01c22b1b-91a`).
No se construyó nada. Lo central: las pantallas ya existen (`/comercial`, `/analisis`,
`/general`) y lo que falta son los datos de MaKo en su propio workspace (ws9). Ahora van
**Números de MaKo**, **¿Qué es MaKo?** (sólo super admin) y el **Runway** en la barra; después,
Objetivos (en `/general`), Referidos, el selector de gráficos y el margen por oferta. Graphics
(con la revisión del proyecto «Feature: Dashboard» del Plan) se le pasó al chat «Graphics» el
10/10.

**Contestado el 15/10 (Ticketera, cuenta 1), y no se re-pregunta:**
- **¿Qué es MaKo?** con los precios en columnas es **también para los clientes**, no sólo para
  el super admin. Sigue sin construir.
- **No hay socio**, ni lo habrá nunca («Que socio? No tengo ni tendré nunca un socio, olvida
  esto»): la pregunta 6 de la propuesta se cae. Era una inferencia de la transcripción del
  audio de referidos, ya corregida (`docs/hallazgos-planes-y-cobro.md` → «El socio que no
  existe», y la regla en AGENTS.md: una voz que no se presenta es «otra persona»).
- **La prospección va sin Loom por lead** (la 06 está decidida; Strategy ya lo dice, `0feb0b65b`).

**Nota, no es una pregunta:** las tasas de la foto del runway (hoy `/admin/runway/foto`: US$100
por agenda y 50% de asistencia) siguen distintas de las de Strategy (US$125, 80% y 40%).
Strategy usa las que Martín aprobó, y la foto es del 03/10: no se le pregunta.

## Lo que espera a Martín

1. **El acuerdo de una página y los mensajes para los referidores del grupal** (Jan, Juanfran y
   su hermana). No se arrancaron: nada se le anunció a nadie y P68 sigue tachado en el Plan. El
   programa está en `docs/referidos.md` («EL PROGRAMA DECIDIDO»), y la propuesta a Jan ya está
   reescrita con él en la tab Strategy.
