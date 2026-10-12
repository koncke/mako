# Relevo — la tab Offer

<sub>Escrito por el chat que la construyó (cuenta claude3), 12/10/2026 ~07:45 UTC. Primera mano.</sub>

## Dónde quedó

- **v1** (`18b48ced`): `/offer` = chat con IA → diagnóstico de 9 dimensiones → oferta nueva → PDF.
  Análisis es la 4ª tab de Experiments.
- **v2** (`7d9098cb`): cada conversación atada a un FUNNEL del CRM (fila de `funnels`; sus ofertas,
  `funnel_ofertas`), selector en árbol en el lugar del título, chat con las piezas de WhatsApp de la
  casa, avatar de MaKo (chispa sola, fondo negro), arranque pidiendo documento o link, y el diagnóstico
  de fase preguntado adentro del chat (sólo en el PDF). Migración **0256 aplicada** en prod antes del
  deploy. Revisión adversarial con 26 hallazgos reales, todos arreglados.
- **Offer Playbook** (`994461ab`, en prod): `/admin/offer-playbook`, el marco en tabs, lo que corre
  en el código, 19 autores con sus conclusiones y **13 cosas que el código todavía no aplica del
  marco** (`app/admin/offer-playbook/pendientes.ts`).
- **12/10 (madrugada):** el Playbook rediseñado (5 pestañas, «A definir» primero con 13 tarjetas de
  decisión; `e6b7bf8e`), «Tu oferta» a la altura del chat, el NUL de un PDF que tiraba el guardado
  (`fea8a6e1`, en el lector compartido) y **adjuntar como WhatsApp** (`93ee41e5`): elegir no sube ni lee
  nada, la vista previa compartida `app/whatsapp/_shared/VistaAdjuntos.tsx` en Offer y en ChatHilo, y Offer
  lee recién al enviar. **El chat de MaKo del teléfono queda para la sesión de MaKo Mobile**, que está
  reescribiendo app/m/** para su v2 (worktree C:/dev/wt-mobile): le pasé el contrato de VistaAdjuntos y lo
  enchufa en su composer nuevo después de su push. No tocar app/m desde acá.
- El renombre visible «Producto» → «Funnel» del CRM lo hizo el chat del CRM (`f5a98420`).
- **NO se vio en el navegador** (ni v1 ni v2): Martín dijo que lo visual lo revisa él.

## Las 13 decisiones de «A definir» (12/10/2026, 05:48 UTC)

Martín las contestó todas (textual en la bitácora de Products & Offers; resumen en la memoria
`offer-decisiones-a-definir`) y quedaron aplicadas en el commit «Offer: las 13 decisiones de Martín…»
(`c3b28bc2` en el clon; en el remoto con otro hash). La pestaña «A definir» queda vacía y las 13 pasan a
«Decididas». **Si ese commit no figura en `origin/main`, es lo primero que hay que subir**: el pre-push
choca con `html-to-image`/`pptxgenjs` (dependencias de Landing Generator que no están en el
`node_modules` del clon); se subió desde un worktree con el enlace apuntando al `node_modules` de
`wt-gamma`, que sí las tiene.

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
