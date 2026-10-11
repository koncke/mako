# Relevo — la tab Offer

<sub>Escrito por el chat que la construyó (cuenta claude3), 11/10/2026 ~20:30 UTC. Primera mano.</sub>

## Dónde quedó

- **v1** (`18b48ced`): `/offer` = chat con IA → diagnóstico de 9 dimensiones → oferta nueva → PDF.
  Análisis es la 4ª tab de Experiments.
- **v2** (este commit): cada conversación atada a un FUNNEL del CRM (fila de `funnels`; sus ofertas,
  `funnel_ofertas`), selector en árbol en el lugar del título, chat con las piezas de WhatsApp de la
  casa, avatar de MaKo (chispa sola, fondo negro), arranque pidiendo documento o link, y el diagnóstico
  de fase preguntado adentro del chat (sólo en el PDF). Migración **0256 aplicada** en prod antes del
  deploy. Revisión adversarial con 26 hallazgos reales, todos arreglados.
- **Offer Playbook** (`994461ab`, en prod): `/admin/offer-playbook`, el marco en tabs, lo que corre
  en el código, 19 autores con sus conclusiones y **13 cosas que el código todavía no aplica del
  marco** (`app/admin/offer-playbook/pendientes.ts`).
- El renombre visible «Producto» → «Funnel» del CRM lo hizo el chat del CRM (`f5a98420`).
- **NO se vio en el navegador** (ni v1 ni v2): Martín dijo que lo visual lo revisa él.

## Lo que espera una decisión de Martín

Las 4 marcadas «Decides tú» en la pestaña Criterio del Playbook: si Prueba pasa a pieza mínima; si
con Cliente o Promesa en 3 o menos MaKo rehace la oferta o sólo avisa; si el PDF separa lo que propuso
MaKo de lo que dijo el dueño; y si las reglas que hoy sólo viven en el prompt merecen control en código.
Las otras 9 son «cambiar el código» con la regla ya decidida en el marco (la más seria: el filtro de
cifras deja pasar números inventados en el PDF).

## Lo que quedó sin hacer

Está en `docs/hallazgos-offer.md` → «Lo que quedó SIN hacer» (Archivero y Avatares desde el chat, la
liga a `oferta_productos`, el binario suelto de un audio que se re-sube, la variante de
`extraerLanding` que baje la URL tal cual, «guardar si no hay» en `lib/fase-store.ts`).

## Ojo con el clon

El `main` local quedó **separado de `origin/main`**: otra sesión subió versiones rebasadas de varios
commits, y además `a7f42966` + `1bc5c2af` (el Playbook, local) son los mismos cambios que
`43b9c17c` + `994461ab` (remoto). Offer se subió desde un worktree limpio con cherry-pick. Quien
reconcilie el clon: `git rebase origin/main` saltea los duplicados solo, pero el árbol de trabajo tiene
cambios sin commitear de varias sesiones.
