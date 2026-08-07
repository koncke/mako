# Hallazgos de comunicación (WhatsApp, nutrición, email)

Lo que hay que saber antes de tocar el espejo de Evolution (`lib/evolution-*.ts`), el
onboarding del Chat Agent (`app/api/chat-agent/onboarding/*`) o el desenlace de las
nutriciones (`lib/nutricion-desenlace.ts`). **No es un changelog.**

Origen: corrida multi-agente de 08/2026. Regla de la cosecha en `AGENTS.md`.

---

## 1. El comentario del código juraba que el bug ya estaba arreglado

**Síntoma:** la mitad de la agenda de WhatsApp aparecía con el número crudo, como si esos
contactos no tuvieran nombre guardado.

**Causa:** `getNombresContacto` paginaba con `.range()` **sin ORDER BY**, así que la página
2 repetía contactos de la 1 y salteaba otros — y los salteados son exactamente los que
salen con el número crudo. El comentario que había arriba del bucle atribuía el arreglo de
**ese mismo síntoma** al `.range()` que se había agregado antes.

**El diagnóstico obvio era el equivocado** dos veces: primero se creyó "falta paginar"
(era la mitad), y después el comentario hizo creer que ya estaba resuelto. Ver la trampa
completa en [hallazgos-infra.md](hallazgos-infra.md) §1.

**Regla:** un comentario que declara un síntoma resuelto **no es evidencia**. Si el
síntoma sigue, el comentario es parte del bug.

## 2. `wa_timestamp` se repite en ráfagas

Es la misma trampa, y por eso vuelve: 16 mensajes en 4 segundos comparten timestamp, y los
volcados del importador entran de a cientos con el mismo valor. Los dos bucles del
onboarding (`contexto/route.ts`, `conversaciones/route.ts`) paginaban por `wa_timestamp` a
secas. Hoy desempatan por `id` (`bigint identity primary key` de `wa_mensajes`).

**Regla:** en `wa_mensajes` el orden **siempre** lleva `id` de desempate, en cualquier
sentido.

## 3. Los topes del espejo son de producto: se escriben

Los dos barridos de `lib/evolution-mensajes.ts` tenían un tope mudo de 20.000 filas
escondido en el `for`. Se preservó tal cual (`TOPE_PAGINAS_ESPEJO = 20`) porque bajarlo
dejaría sin inbox a un workspace grande — pero ahora vive en el call-site
(`return nro < TOPE_PAGINAS_ESPEJO`) y, con el orden `desc`, dice lo que hace: **los 20.000
mensajes más recientes**. Lo mismo en los dos routes del onboarding (8.000 / 20.000).

## 4. Qué degrada y qué rompe se decide por dato, no por módulo

En el mismo lote, dos decisiones opuestas y las dos correctas:

- **`getNombresContacto` degrada** a `Map` vacío (`.catch(() => new Map())`): la agenda es
  un adorno del inbox. Sin ella se ve el número; una agenda ilegible **no puede** dejar al
  dueño sin inbox.
- **Los routes del onboarding propagan** el error (500 con mensaje). Antes un fallo en la
  página 1 daba `filas = []` → "no tenés conversaciones", que es el falso all-clear.

**Regla:** la pregunta no es "¿este módulo tolera errores?" sino "**¿qué le decimos al
usuario si esta lectura falla?**". Si la respuesta es una frase que también significa "no
hay nada", tiene que romper.

## 5. "Viene de un formulario" no es excusa cuando no hay formulario

`lib/nutricion-desenlace.ts` movía leads con `setPipelineStage` **sin validar** los
requisitos de la etapa. La justificación general —los callers que vienen de un formulario
ya validaron con lo que la persona acaba de tipear— no aplica: acá es el **cron** del
desenlace, y `logradoEtapa` / `falloEtapa` son **configurables por workspace**. Un cliente
que apunte `logradoEtapa: 'ganado'` escribe la etapa de venta sin monto.

Agravante: el `catch` era un `console.error`, así que el movimiento fallido no dejaba
rastro **ni en `lead_audit` ni en la respuesta**.

**Dónde:** los dos call-sites usan `moverLeadAuto()` (`lib/leads.ts:1725`), el mismo helper
que el motor del CRM: valida, y si falta algo no mueve y escribe el porqué en el historial.

**Regla:** un caller automático que escribe una etapa **que configura el cliente** valida
siempre. Hoy no rechaza nada porque esas etapas no tienen requisitos; la validación es la
garantía para el día que un funnel de cliente se los ponga.
