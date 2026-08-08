# Alinear stats de email secuencias por id en lugar de posición

`2026-06-30 04:40` → `2026-06-30 04:43` · 1 mensajes de Martín · 8 respuestas de Claude · sesión `bffd3251`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-06-30 04:40`

En el dashboard de marketing (dashboard-marketing/), las stats por paso de las secuencias de email se alinean por POSICIÓN, no por identidad estable. En `lib/email-marketing.ts` getEmailSecuencias hace `statsPorPaso[i] = statsMap.get(seqId).get(i+1)`, y `nutricion_envios.paso` se escribe como `insc.paso_actual + 1` (posición al momento del envío, ver lib/nutricion.ts procesarEnvios). Si el usuario reordena los pasos en /email (movePaso en app/email/page.tsx) y guarda, las filas históricas de nutricion_envios siguen apuntando a la posición vieja → las métricas Enviados/Apertura/Clic que la UI muestra junto a cada email quedan atribuidas al paso equivocado.

Fix propuesto: dar a cada paso un id estable (uuid) guardado en el JSON del paso (PasoSecuencia) y en una columna nueva `nutricion_envios.paso_id`, y alinear las stats por ese id en vez de por posición. Requiere: migración (columna paso_id), escribir paso_id al enviar (procesarEnvios), generar/persistir el id al crear/editar pasos (setSecuenciaPasos + UI), y alinear en getEmailSecuencias. Es severidad baja (solo display de analítica, no afecta envíos). Alternativa mínima: documentar/advertir en la UI que reordenar reasigna el histórico.

### Claude

Let me verify the bug against the actual code before deciding what to do.

### Claude

The bug is confirmed exactly as described. Let me check the remaining pieces — the `PasoSecuencia` type and the reorder/save path in the UI — to scope the fix accurately.

### Claude

Confirmado: el bug es real y está exactamente donde dice la nota. Lo verifiqué en el código actual:

- **Escritura por posición** — [lib/nutricion.ts:639](dashboard-marketing/lib/nutricion.ts:639): `procesarEnvios` inserta `paso: insc.paso_actual + 1`, la posición del paso al momento del envío.
- **Lectura por posición** — [lib/email-marketing.ts:144](dashboard-marketing/lib/email-marketing.ts:144): `statsPorPaso: s.pasosArr.map((_, i) => statsMap.get(s.id)?.get(i + 1) …)`, alinea por índice.
- **El reorden rompe el vínculo** — [app/email/page.tsx:216](dashboard-marketing/app/email/page.tsx:216) `movePaso` permuta el array y al guardar [setSecuenciaPasos](dashboard-marketing/lib/nutricion.ts:146) re-normaliza `orden: 1..n`. Las filas viejas de `nutricion_envios` siguen apuntando a la posición anterior → métricas mal atribuidas.
- `PasoSecuencia` ([lib/nutricion.ts:22](dashboard-marketing/lib/nutricion.ts:22)) hoy no tiene id estable (solo `orden`, `canal`, `delay_horas`, `asunto`…), y la UI ya keya por índice (`key={i}`).

**Un matiz importante sobre el fix completo:** agregar `paso_id` solo protege los envíos *futuros*. Las filas históricas quedan con `paso_id` null y tendrían que caer al alineado por posición de siempre — así que no "repara" la analítica ya corrupta de secuencias que ya se reordenaron; evita que se siga corrompiendo de acá en adelante.

La nota no trae una instrucción explícita, así que antes de tocar nada quiero confirmar qué querés que haga.

### Claude

El usuario eligió el **fix completo con `paso_id` estable**. Voy a mapear todo el alcance antes de tocar nada.

### Claude

Skipping the formal task tracker — not worth the overhead here. Let me read the full files to implement precisely.

### Claude

Now let me read the email-marketing.ts create/edit functions and the page.tsx save flow.

### Claude

Now the save flow and the API route. Let me find them.

### Claude

Let me read the secuencias API route to confirm the PATCH path into `setSecuenciaPasos`.

