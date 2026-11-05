# Relevo: «MaKo toma la iniciativa» en la nube (5/11/2026)

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

Cada punta salió con su veredicto de la nube (tests afectados + tsc entero en verde). «En producción» es recién con la corrida de
`punta.yml` verde y el deploy de Vercel en «Ready»: mirar Actions antes de decirlo.

## Lo que falta, en el orden del plan (plan.md §5 y guia.md §6)

| Tab | Apertura (plan.md §4) | Guía (guia.md §6) | Nota |
|---|---|---|---|
| **Escalera del Ops Center (T3)** | pasos 1, 2 y 4 a 8 (`lib/aperturas/ops.ts` sólo tiene el 3, «tu IA») | — | ya puede usar `recomendarFunnel`, `/crm?importar=1` y `EstadoArranque.planBorrador` |
| **CRM, funnel sin declarar** | falta (necesita el canal y el diagnóstico en la estrella, y `declararEntradasAction`) | la ficha del lead (`recorrido-ficha.ts`, `Senalar`) | `/crm?nuevo=1` («Ver los 12») tampoco está |
| **Offer (T6)** | tarjeta vacía y «sin funnels» (crear el funnel ahí, fuera «Ir al CRM») | falta | `sanearMensajes` es lista blanca |
| **Create (T4)** | `primerMensajeDeEjemplo` pregunta la oferta; `PantallaCrear` reenvía `apertura` | G5 (`data-mako-chat` en la tarjeta) | |
| **Copywriter (T5)** | las dos aperturas (con ejemplo y en blanco), `puedeSinIA` | falta | ya tiene `lib/copywriter/iniciativa.ts`: mudarlo al patrón |
| **Dashboard (T10)** | hoja en blanco en la estrella; fuera `BotonMako` | G3: reemplaza `recorridos-dashboard.ts` y sus dos `Recorrido` | |
| **Automations (T8)** | la estrella en la lista y las tres aperturas | falta (`au-qr`) | |
| **Web Generator (T13)** | las dos del editor (publicar, Pixel) | falta | otro chat de la nube toca sus bloques de venta: `git merge origin/main` antes |
| **Video (T11)** | subtítulos primero («¿Lo van a ver sin sonido?») | falta (`soloComputadora`) | se puede adelantar: no depende de nada |
| **Image (T12)** | en blanco | falta | otro chat toca la marca |
| **Classroom / Clients (T14)** | `cs_clientes` pendiente | falta | |
| **Plan (T17)** | borrador del plan sin revisar (ya se guarda `planBorrador`) | falta | comparte la clave `negocio:plan` con la escalera |
| **AI Avatar (T15)** | va último (no se vende) | falta | |
| **Mobile (T16)** | la escalera en `/m/second-brain` | G7 | |
| **Plantillas con «Ver ejemplo»** | — | — | hoy en Copywriter, `app/_crear` e Image; faltan las demás tabs de Create |

## Trampas que costaron en esta tanda

- **El veredicto corre sobre el árbol de trabajo**: mientras corre no se toca nada del repo. Se saca en un worktree aparte
  (`git worktree add --detach … HEAD`), que hace su propio `npm ci`.
- **El clon de la nube viene superficial**: el veredicto frena con «el clon es superficial»; `git fetch --unshallow origin main` una vez.
- **El pre-push con Node 22 da rojos de mentira**: `export PATH="$(sh scripts/node24.sh):$PATH"` también para el `git push`.
- **`tsc-acotado.mjs` muere con 2.560 MB de heap en la nube** («código undefined»): se arma su tsconfig y se corre `tsc` con
  `--max-old-space-size=5000`.
- **`git push origin HEAD:punta/x` desde un HEAD suelto** pide el nombre entero: `HEAD:refs/heads/punta/x`.
