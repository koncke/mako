# Relevo: «MaKo toma la iniciativa» en la nube (5/11/2026, actualizado al cierre)

Lo escribe la sesión de la nube que lo hizo (cuenta `nube`, sesión `cli_d5a9b850-5f45-5173-b8c4-5c551ce46310`). Esta sesión no le
puede escribir al Cerebro: todo lo que tiene que saber está acá.

**El pedido** (Martín, 29/10, y el 5/11 «continuar con todo lo pendiente»): que MaKo guíe en cada chat según la plantilla o la
situación, sin botones de barra; que en el primer ingreso dé la bienvenida, pida cargar la oferta y recomiende un funnel; y que la
primera vez en cada tab pregunte «¿Quieres que te ayude a aprender a usar esta pestaña?». El plan (decisiones tomadas):
[docs/mako-iniciativa/README.md](../mako-iniciativa/README.md), [plan.md](../mako-iniciativa/plan.md),
[guia.md](../mako-iniciativa/guia.md).

## Lo que quedó hecho, punta por punta

| Punta | Qué | Test (probado rompiéndolo) |
|---|---|---|
| `punta/iniciativa-onboarding` | **T2, el primer ingreso**: «Lo primero es tu oferta», «¿Cómo te llegan hoy los clientes?» por llamada o por chat, la recomendación de `recomendarFunnel` (lib/funnel-recomendado.ts: el código decide, la IA sólo nombra las etapas de UN candidato) con [Sí, ese] [Ver los 12], el cobro con «¿Es así?», la salida corta (el grupo sólo con el teléfono verificado), el link del borrador del plan en `EstadoArranque.planBorrador`, fuera `rutaDeEntrada` y el `?recorrido=sb-inicio` (G2) | tests/onboarding-funnel-recomendado.test.ts (5 roturas) |
| `punta/iniciativa-crm` | **CRM**: con cero leads en el negocio, la estrella pregunta «¿Dónde tienes hoy a tus clientes?» (sólo al admin) → importador (`/crm?importar=1`, nuevo) o el QR de WhatsApp; la guía del tablero (4 anclas en la barra) | tests/iniciativa-crm.test.ts (5 roturas) |
| `punta/iniciativa-calendario` | **Calendario** (apilada sobre la del CRM: comparten `lib/guia/catalogo.ts`): con Google y `cal_semana` pendiente, «¿Tienes alguna llamada esta semana?» → el alta de una llamada; la guía (4 anclas), que espera al onboarding de la tab | tests/iniciativa-calendario.test.ts (3 roturas) |
| `punta/iniciativa-video` | **Video Editor** (T11): con voz y sin subtítulos, «¿Lo van a ver sin sonido?» → «Sí, en el feed» corre el mismo motor del botón de Subtítulos (sin la app también); «No, con sonido» queda para ese proyecto; las píldoras se esconden mientras habla | tests/iniciativa-video.test.ts (3 roturas) |
| `punta/iniciativa-plan` | **Plan** (T17): con el borrador del onboarding pendiente, «¿Tu equipo ya sabe qué hacer esta semana?» → «Todavía no» → «Te dejé un borrador con N tareas.» [Ver el borrador]. La clave es del NEGOCIO (`negocio:plan`, la del paso 7 de la escalera): nace `PREFIJO_NEGOCIO` (lib/aperturas/reglas.ts) y `useApertura` suma esas respuestas | tests/iniciativa-plan.test.ts (3 roturas) |
| `punta/iniciativa-clients` | **Clients** (T14): con el servicio armado y la cartera vacía, «¿Ya tienes clientes en tu programa?» → la misma alta del checklist; sin servicio calla | tests/iniciativa-clients.test.ts (2 roturas) |
| `punta/iniciativa-dashboard` | **Dashboard** (T10): con el informe en blanco, «¿Qué número miras primero cada lunes?» → Comercial, Marketing o Closing con `instanciarPlantilla`, sin IA | tests/iniciativa-dashboard.test.ts (2 roturas) |
| `punta/iniciativa-image` | **Image** (T12): con el diseño en blanco, «¿Dónde lo vas a publicar?» → el lienzo a la medida de una historia, un carrusel o un anuncio (el resize del panel de tamaño) | tests/iniciativa-image.test.ts (2 roturas) |
| `punta/iniciativa-web` | **Web Generator** (T13): con la página sin publicar, «¿Ya está lista para que la vean?» → abre el diálogo de Publicar (no publica por fuera) | tests/iniciativa-web.test.ts (2 roturas) |
| `punta/iniciativa-create` | **Create** (T4): el primer mensaje del ejemplo pregunta «¿Para cuál de tus ofertas es?» (la de `pasoOferta`), no «¿Lo adapto a tu negocio?»; `PantallaCrear` reenvía `apertura` a la tarjeta del Cerebro | tests/iniciativa-create.test.ts (2 roturas) |

Cada punta salió con su veredicto de la nube (tests afectados + tsc entero en verde). «En producción» es recién con la corrida de
`punta.yml` verde y el deploy de Vercel en «Ready»: mirar Actions antes de decirlo.

## Lo que falta, en el orden del plan (plan.md §5 y guia.md §6)

Medido al cierre (5/11, ~18:30 UTC): en `main` onboarding, CRM, Calendario, Video, Plan, Clients y Dashboard; Image, Web y Create
subidas a su punta. Mirar Actions (o `ci-rojo/iniciativa-*`) antes de decir «en producción»: es recién con el deploy en «Ready».

| Tab | Apertura (plan.md §4) | Guía (guia.md §6) | Nota |
|---|---|---|---|
| **Escalera del Ops Center (T3)** | pasos 1, 2 y 4 a 8 (`lib/aperturas/ops.ts` sólo tiene el 3, «tu IA», con hechos del navegador; no existe `ops-server.ts`: la escalera necesita su lector de servidor y «un paso por día») | — | ya tiene `recomendarFunnel`, `/crm?importar=1`, `EstadoArranque.planBorrador` y el paso 7 hecho como `negocio:plan` (`ID_PLAN` de lib/aperturas/plan.ts: importarlo, no copiarlo) |
| **CRM, funnel sin declarar** | falta (necesita el canal y el diagnóstico en la estrella, y `declararEntradasAction`) | la ficha del lead (`recorrido-ficha.ts`, `Senalar`) | `/crm?nuevo=1` («Ver los 12») tampoco está |
| **Offer (T6)** | tarjeta vacía y «sin funnels» (crear el funnel ahí con `recomendarFunnel` y `crearCrmAction`, fuera «Ir al CRM»: hoy en OfferApp.tsx en dos lugares, la tarjeta y la vista ancha) | falta | `sanearMensajes` es lista blanca |
| **Create (T4)** | hecha; `primerMensajeDeEjemplo` todavía no la llama nadie en app/ (la usarán Copywriter y AI Avatar) | G5 (`data-mako-chat` en la tarjeta) | |
| **Copywriter (T5)** | ya guía con su propio patrón (`lib/copywriter/iniciativa.ts`): mudarlo a `lib/aperturas/copywriter.ts`, la franja sin «Adaptar con MaKo» | falta | |
| **Dashboard (T10)** | hecha la hoja en blanco; falta la de **General** (la hoja Focus: sus plantillas no calzan con las respuestas) y sacar `BotonMako` («Editar con MaKo»: lo miran ocho tests) | G3: reemplaza `recorridos-dashboard.ts` y sus dos `Recorrido` | |
| **Automations (T8)** | la estrella nueva en la lista y las tres aperturas | falta (`au-qr`) | |
| **Web Generator (T13)** | hecha «¿Ya está lista?»; falta la del Pixel («¿Vas a pautar esta página en Meta?») | falta | otro chat de la nube toca sus bloques de venta |
| **Video (T11)** | hecha la de subtítulos; falta «¿Ya grabaste tu video?» (línea de tiempo vacía) y guardar `plantillaId` | falta (`soloComputadora`) | |
| **Image (T12)** | hecha la del diseño en blanco (sin la miniatura: cuatro botones con el de callar); falta la sugerida de cada familia y guardar el slug | falta (anclas por `donde` sobre `data-testid`) | otro chat toca la marca |
| **Classroom / Clients (T14)** | hecha | falta (curso, comunidad y clientes juntos; `recorridos-curso.ts` se va) | |
| **Plan (T17)** | hecha | falta (`plan-nueva-tarea`, `plan-vistas`, `plan-filtrar`; la bienvenida pide el turno antes) | |
| **AI Avatar (T15)** | va último (no se vende) | falta | ya tiene el reenvío de T4 |
| **Mobile (T16)** | la escalera en `/m/second-brain` | G7 | necesita T3 |
| **Plantillas con «Ver ejemplo»** | — | — | medido con grep: «Ver ejemplo» está en Copywriter, Image y `app/_crear`; Video, AI Avatar y Offer montan `PantallaCrear` y no lo tienen. Sin hacer en esta ventana |

## Trampas que costaron en esta tanda

- **El veredicto corre sobre el árbol de trabajo**: mientras corre no se toca nada del repo. Se saca en un worktree aparte
  (`git worktree add --detach … HEAD`), que hace su propio `npm ci`.
- **El clon de la nube viene superficial**: el veredicto frena con «el clon es superficial»; `git fetch --unshallow origin main` una vez.
- **El pre-push con Node 22 da rojos de mentira**: `export PATH="$(sh scripts/node24.sh):$PATH"` también para el `git push`.
- **`tsc-acotado.mjs` muere con 2.560 MB de heap en la nube** («código undefined»): se arma su tsconfig y se corre `tsc` con
  `--max-old-space-size=5000`.
- **`git push origin HEAD:punta/x` desde un HEAD suelto** pide el nombre entero: `HEAD:refs/heads/punta/x`.
- **Una guarda que copia la línea de la estrella se pone roja al sumar `apertura=`**: `tests/crm-estrella-cr3-cr4.test.ts` (Plan y
  Clientes), `tests/dashboard-estrella-grafico.test.ts` y `tests/plan-tarjeta-plantillas.test.ts` se ampliaron a lo que cuidan.
  La próxima tab: `grep -rn 'MakoEnLaTab tab="<Tab>"' tests` antes de tocar la línea.
- **`AperturaMako` trae el CSS del hilo** (`app/_chat/chat.css`): en un panel que algún test carga en node (el del Web Generator),
  va en el módulo que ya entra con `next/dynamic`, con un `onHabla` para que el panel esconda lo suyo.
- **Una apertura lleva su botón de callar y como mucho cuatro botones**: donde el plan nombra cuatro respuestas, una no entra
  (Dashboard dejó «Lo invertido en anuncios», Image la miniatura). Está dicho en cada `lib/aperturas/*.ts`.
- **Una sustitución por ancla con `s.index(a):s.index(b)` da vacío si `b` aparece ANTES que `a`** (la cabecera del test repite
  «PROBADO ROMPIÉNDOLO»), y `replace('', x)` mete `x` entre cada carácter: el test quedó de 44.756 líneas. Se reescribió entero.
