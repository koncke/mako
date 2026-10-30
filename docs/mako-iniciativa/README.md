# MaKo toma la iniciativa y enseña: el plan (29/10/2026)

Lo que pidió Martín el 29/10, textual en lo central:
- «En todos lados que haya un chat de MaKo, que MaKo te vaya guiando dependiendo del template que se eligió, o de la situación
  de la persona… en lugar de botones en la top bar… cuando el usuario llega por primera vez… que MaKo tome la iniciativa: "hola,
  bienvenido a MaKo… lo primero que te recomiendo es que cargues tu oferta"… "¿qué funnel te gustaría? ¿o quieres que te
  recomiende uno?"».
- «Que MaKo pueda guiar al usuario a través de tutoriales personalizados… que se siga viendo la barra lateral donde está el chat,
  y que MaKo le pueda ir señalizando diferentes lugares… cada vez que entra por primera vez a una tab, MaKo le pregunta "¿quieres
  que te ayude a aprender a utilizar esta pestaña?"… si tiene preguntas, que MaKo le señale, con la pestaña un poco opaca por detrás».

Dos documentos, que salen de dos relevamientos con diseño doble, juicio y crítica contra `origin/main` `4b8f8145d`:
- [plan.md](plan.md): **la apertura** (MaKo pregunta primero en cada chat) y **el primer ingreso** (oferta → funnel → escalera).
- [guia.md](guia.md): **la guía** (MaKo enseña cada pestaña señalando, con el velo y el chat a la vista).

## Decisiones del Cerebro sobre lo que quedó abierto (29/10, con las reglas de Martín)

1. **La pregunta de la guía es la de Martín**: «¿Quieres que te ayude a aprender a usar esta pestaña?», con [Sí, enséñame]
   [Ya sé usarla] (y los objetivos de la tab como botones). La crítica la había cambiado por «¿Qué vienes a hacer en <Tab>?»
   para cumplir la regla de «preguntar hechos», que es una regla de FORMULARIOS; acá gana el pedido posterior y explícito de
   Martín. El test `PREGUNTA_DE_ACCION` (tests/aperturas.test.ts) exceptúa esta pregunta por su id, con esta razón escrita.
2. **Las aperturas de los chats preguntan un hecho primero** (plan.md 2.8), como ya hace el Copywriter («¿Para qué es este
   guion?» → «¿Lo adapto a tu oferta? ¿A cuál?»). Ese orden es el de Martín y se respeta.
3. **D1 a D5 de plan.md quedan como están**: el arranque sigue en /onboarding; el funnel pregunta primero cómo le llegan los
   clientes y después recomienda, con «Ver los 12»; la estrella se abre sola una vez por tab; «Editar con IA» del Web Generator
   se queda; los textos de las aperturas viven en el código (editarlos desde /configuraciones queda para después).
4. **El chat de Image con Gemini por defecto** (lib/model-catalogo.ts) va en una tanda aparte: Martín decidió el 22/10 «sin
   Gemini». No se mezcla con la apertura.

## El orden del reparto

1. **La base, un solo chat** (Ops Center): T1 de plan.md + G1 de guia.md (la apertura, la memoria por persona, la guía, el velo,
   las anclas del Ops Center y la primera visita). Arregla de paso los botones de respuesta del Cerebro que no hacen nada sin la app.
2. **Onboarding** (T2 de plan.md, en paralelo con la base: no comparten archivos) y después **la escalera** (T3).
3. **Cada tab con su dueño**, una por vez según la RAM: Copywriter (ya empezó con `lib/copywriter/iniciativa.ts`, se muda al
   patrón), Offer, Create, CRM, Dashboard, Automations, Web Generator, Calendario, Video, Image, Classroom, AI Avatar y Mobile.
   Cada una suma sus aperturas (plan.md §5) y sus anclas (guia.md §6) en la misma tanda.
