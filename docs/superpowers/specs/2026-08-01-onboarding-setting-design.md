# Onboarding de la tab Setting — diseño

**Fecha**: 2026-08-01 · **Metodología**: `.claude/skills/tab-onboarding/SKILL.md` (regla: toda tab tiene onboarding).

Primera aplicación de la regla. Lo que salga acá es el molde para las demás tabs.

## Estado

`app_settings` → `onboarding.tab.setting`:

```json
{ "v": 1, "status": "pendiente|done",
  "steps": { "canales": {"done":true,"at":"…"}, "contexto": {…}, "voz": {…}, "ensayo": {…}, "aprobar": {…} },
  "updated_at": "…" }
```

`/setting` abre en el onboarding mientras `status !== 'done'`, con "ya lo configuro
después" disponible salvo en el primer paso (sin canal no hay nada que mostrar).
El estado entra al system prompt de MaKo.

## ① CONECTAR — con prueba de vida (paso `canales`)

Dos canales, cada uno con su evidencia:

- **WhatsApp**: QR de Evolution (ya existe, `EvolutionConnect`). Prueba: MaKo le
  manda un **código de 6 dígitos al teléfono del dueño** y él lo tipea. Reusa el
  OTP de `contacto-enviar-codigo` / `contacto-verificar-codigo`. Sin ese código,
  el paso no cierra: "conectado" sin mensaje que llegue no es conectado.
- **Email**: alta del dominio en Resend (ya existe `DominioSetup`, con polling
  DNS). Prueba: **email de prueba a su bandeja** con un código; lo tipea igual.

El aside muestra *facts* reales al conectar (su número, su dominio verificado).

## ② CONTEXTO — pedir artefactos, nunca redacción (paso `contexto`)

Lo que MaKo necesita para escribir el setting de ESTE negocio. Nada de "contanos
cómo hablás con tus clientes".

**Lo que ya se sabe NO se pregunta** — se muestra como "esto ya lo tengo": funnel,
avatares, personalidad, fase/Norte, brief del Archivero, lead magnets. Pantalla de
confirmación, no de carga.

**El hueco real es cómo conversa con clientes.** Se pide como artefacto, en este
orden de preferencia:

1. **"Conectá el WhatsApp donde ya atendés"** — si Evolution ya está conectado,
   MaKo lee las últimas N conversaciones reales de `wa_mensajes` y extrae solo:
   cómo abre, cómo cualifica, cómo maneja objeciones, cómo cierra. **Cero
   trabajo del usuario.**
2. **Capturas de pantalla** de chats con clientes (dropzone; visión ya lee
   imágenes vía `leerDocumentoIA`).
3. **Audios** de cómo le hablaría a un lead (se transcriben solos).
4. Si nada de eso: **forced-choice** — MaKo muestra 3 aperturas escritas con su
   negocio real y elige la que suena a él (patrón del quiz de personalidad).

Salida: la **guía de voz** (ya existe `destilarVoz`) + un resumen "así conversás"
que el usuario corrige inline si algo no es.

## ③ VOZ EN AUDIO (paso `voz`)

La reunión del 31/07 definió que el vehículo son notas de voz del dueño. Acá se
graban las 3 básicas (bienvenida post-agenda, formulario sin agendar,
reactivación) con la biblioteca ya construida (`AudiosPanel`).

Baja fricción: **MaKo le dicta el guion en bullets antes de grabar** ("decí esto:
①… ②… ③…", derivado de su voz y su oferta). No se graba en frío.
Se puede saltear: los pasos quedan en texto y se graban después.

## ④ ENSAYO — MaKo hace de cliente (paso `ensayo`)

El corazón. `ChatHilo` dentro del wizard, **con los roles invertidos respecto del
simulador actual**: MaKo es el LEAD y el usuario responde como el negocio.

Por cada una de las 3 jugadas, MaKo plantea escenarios reales derivados del funnel
y del criterio de calificación:

- el que vio el VSL y no agendó,
- el que pregunta el precio de entrada,
- el que dice "ahora no tengo tiempo",
- el que **no califica** (para capturar cómo despide sin quemar),
- el que pide el lead magnet.

El usuario contesta como contestaría de verdad. MaKo, mientras tanto:
- convierte esas respuestas en los **mensajes de la secuencia**,
- extrae las **preguntas de cualificación** que el usuario usó naturalmente,
- propone el **criterio** (ya lo deduce del CRM: `sugerir-criterio`) y lo confirma
  con lo que vio en el ensayo.

Cierre del paso: "con esto armé tus 3 jugadas" → preview.

## ⑤ APROBAR Y PRENDER (paso `aprobar`)

Muestra las 3 jugadas armadas (mensajes, audios, preguntas, criterio). Acciones:
**probar en vivo** (le llega a su teléfono — ya existe `probarSecuencia`), ajustar,
y **activar**. Al cerrar: `status: 'done'` y la tab abre normal.

## Fuera de alcance (v1)

Onboarding de las otras tabs (este es el molde), A/B de tono, y el Setter IA
automático — el modo asistido ya cubre el arranque.

## Orden de implementación

1. `lib/tab-onboarding-state.ts` genérico (molde de `onboarding-state.ts`) + estado en MaKo.
2. Shell del onboarding de /setting con `WizardShell` + gate en la page.
3. Paso ① canales con OTP de WhatsApp y email.
4. Paso ② contexto (lectura de conversaciones reales + capturas) y ③ voz.
5. Paso ④ ensayo con MaKo-cliente (invertir roles del simulador).
6. Paso ⑤ aprobar + prender.
