# Retomar: Chatbot

**Dónde quedó:** 6/10/2026, ~21:45. Cuenta `claude2`. Todo commiteado, pusheado y
**desplegado** (`92932e5e` + `876e68d8`, Vercel en Ready); la cosecha va en el commit de
después.

## El hilo

El último pedido de Martín, literal (también en `app/admin/dev/chatbot/bitacora.ts`):

> «Termina absolutamente todo. Y revisa el proyecto de Chatbot para marcar como completo lo
> que ya esté y dejame todo en el apartado de chatbot aqui https://hola-mako.com/admin/runway»

Quedó así:

- **Calendly ya no se apaga solo y no pierde reservas** (`92932e5e`): 5xx sólo a lo que se
  arregla reintentando, y el ruteo lee estricto. La suscripción del ws1 está ACTIVA (la
  recreó la otra cuenta a las 15:41) y las reservas perdidas ya se recuperaron.
- **Los flujos de un cliente ya no corren en la cuenta de Mauricio** (`876e68d8`): eran ocho
  llamadas a `dispararEvento`, no una.
- **El tablero del Chatbot** (ws9): 15 tarjetas cerradas con su prueba. La #350 (el
  reproductor) quedó abierta a propósito: no se reproduce con el reproductor solo.
- **`/admin/runway#chatbot`** dice qué se hizo de cada tarjeta y qué le toca a Martín.

## Lo que espera a Martín

Está en `/admin/runway#chatbot` → «Te toca». Lo nuevo de esta ventana:

- si un evento de Calendly con datos incompletos se contesta bien y se anota (hoy 400; el
  script `arreglar-webhook-calendly.ts` usa ese 400 como señal de que la firma pasó);
- si los fallos anotados de Calendly (`calendly.fallos_proceso`) se ven en alguna pantalla;
- en qué navegador vio que un audio grabado no se volvía a reproducir (#350).

## Lo que quedó SIN hacer, con su archivo

- **Los otros webhooks rutean con la lectura que traga el error** (Cal.com, Chatwoot, Meta,
  Fathom): con la base caída leen «no es de nadie». `docs/hallazgos-infra.md` → «Y el
  clasificador en verde…».
- **El cierre de una tarjeta corta la prueba a los 219 caracteres** y el borrador acepta
  400. `docs/hallazgos-plan.md` → «Cerrar desde un script…».
- **#350**: la medición y las dos trampas del navegador, en `docs/hallazgos-comunicacion.md`
  → «Al cerrar el proyecto…».

## Antes de tocar nada

⚠️ **Medir el estado vivo.** Lo que dice este relevo es de las 21:45 del 6/10.

⚠️ **Leer el final de `docs/hallazgos-comunicacion.md` y la sección «Webhooks» de
`docs/hallazgos-infra.md`**: las dos tienen el caso en que el diagnóstico obvio era el
equivocado.

---

## La ventana anterior (5/10, ~11:30)

**Dónde quedó:** 5/10/2026, ~11:30. Cuenta `claude2` (se agota la cuota: sigue `claude1`).
Todo commiteado y **desplegado**: `53ad4ad0`, Vercel en Ready.

### El hilo

El editor de `/chatbot`. El último pedido de Martín fue una corrección de NUEVE puntos con
tres capturas de `/mensajes` al lado, y lo que significa es una sola cosa:

> **`/chatbot` y `/mensajes` tienen que ser la MISMA pieza, no dos pantallas parecidas.**

Cada vez que mandó capturas fue del editor de `/mensajes`. El texto literal del pedido está
en `app/admin/dev/chatbot/bitacora.ts` (hito del 5 oct 09:20), sin resumir.

Los nueve están hechos y verificados en el navegador (30/30 con el arnés, más el Ctrl+Z,
el ida y vuelta del horario contra la base y que `/mensajes` siguiera entero):

1. la lista FLOTA sobre el lienzo con su buscador y su filtro, y la cuadrícula pasa por
   detrás · 2. se fue el título y la topbar · 3. «Publicar» abajo, ningún «Guardar» ·
4. nombre editable tocándolo + «Activar» al lado · 5. deshacer/rehacer con Ctrl+Z ·
6. el menú «⋯» se fue · 7. el ＋ volvió a la tarjeta · 8. el nodo «Si contesta» salió del
   grafo · 9. el CRON con sus dos opciones, por tiempo o por una acción.

### Lo primero que hay que hacer

⚠️ **Medir el estado vivo antes de escribir una línea.** Lo de siempre en esta área sigue
igual y **no es código**: según `seguimiento-agendados-prendido`, el chatbot nunca mandó un
mensaje porque falta que Mauricio escanee el QR. Si eso no cambió, nada de lo nuevo se puede
ver funcionando de punta a punta.

⚠️ **Y leer `docs/hallazgos-ui.md` y `docs/hallazgos-comunicacion.md` antes de tocar el
lienzo o el motor.** Las dos entradas del 5/10 están al final de cada documento y las dos
tienen el caso en que el diagnóstico obvio era el equivocado.

### La migración: APLICADA, y renumerada

**`supabase/migrations/0192_secuencia_cron.sql` — APLICADA en producción.** Agrega a
`nutricion_secuencias` las columnas `cron` (jsonb) y `cron_proxima_at` (timestamptz).

Verificado contra PostgREST con el nombre REAL, no el intuitivo (5/10, 11:25):

```
EXISTE     cron               HTTP 200  [{"id":209,"cron":null}]
EXISTE     cron_proxima_at    HTTP 200  [{"id":209,"cron_proxima_at":null}]
NO EXISTE  cron_proximo_at    HTTP 400  42703
```

⚠️ **Nació como 0190 y la renumeró el chat del CRM**, que ya tenía una 0190 commiteada y
aplicada (`0190_clic_con_su_punto`). Si en algún clon quedó un `0190_secuencia_cron.sql`,
es basura: el archivo vivo es el 0192. `apply-migration.mjs` toma la RUTA por argumento y
no resuelve por número, así que las dos se aplicaron bien — el riesgo era el próximo que
las leyera en orden.

### Lo que decidí YO y falta que Martín confirme

El pedido decía «el CRON con las 2 opciones por tiempo o por acción» y **no decía qué
significa «por tiempo» para una SECUENCIA** (en `/mensajes` es un horario, porque un aviso
es de una sola vez). Elegí esto:

> El horario es una **puerta sobre la inscripción**. El `trigger_tipo` sigue diciendo A
> QUIÉN y el horario dice CUÁNDO: con horario puesto, el cron horario sólo inscribe en la
> ocurrencia agendada; sin horario (`cron = null`, las 62 filas de hoy) inscribe como
> siempre. El selector de cohorte NO se esconde en modo tiempo: se re-rotula «A quién»,
> porque un horario sin cohorte no inscribiría a nadie.

La otra lectura posible era **«por tiempo = cuánto espera el primer mensaje»**, que ya
existe como `delay_horas` del paso 1. Si Martín quería ésa, **el control cambia y el motor
no**: se saca el `EditorCron` del nodo de entrada y se pone el delay del paso 0.

### Lo que quedó SIN hacer, con el archivo

| Qué | Dónde vive | Por qué quedó |
|---|---|---|
| **¿`/mensajes` se absorbe en `/chatbot`?** | `app/mensajes/` vs `app/chatbot/` | Preguntado DOS veces, sin respuesta. Hoy son dos pantallas con la misma pieza adentro (`app/_components/EditorCron.tsx`) |
| **El nombre «Chat Analyst»** | `app/chat-analyst/` | Ese nombre estaba pensado para analizar CONVERSACIONES, y ahí vive el dashboard de secuencias. Se revierte en una línea |
| **Primer paso con `delay_horas: 0`** | `lib/nutricion.ts` → `enrolarPorEvento` | Sale antes de que un deshacer pueda llegar, y el cron corre una vez por hora: demorarlo convierte «al instante» en «en algún momento de la próxima hora». Decisión de producto |
| **Plantillas desde cero** | `app/chatbot/SecuenciaWizard.tsx` | Punto 1 de los diez originales, nunca se llegó |
| **Fijo vs IA en el nodo del mensaje** | `app/chatbot/FlujoLienzo.tsx` → `EditorDeNodo` | Necesita primero una columna `nutricion_envios.texto_enviado`: sin eso no hay forma de saber qué mandó la IA |
| **Audio / archivo / imagen / link** | `lib/nutricion.ts` (`PasoSecuencia`) | Va como `tipo: 'media'` + `media_id` POR REFERENCIA a una biblioteca, nunca embebido: `setSecuenciaPasos` reconstruye cada paso campo por campo y un base64 en el jsonb se pierde en el primer guardado hecho desde otra pantalla. Molde: `audio_id` |

### Qué archivos son míos

Commiteados en `53ad4ad0`:

```
app/chatbot/{ChatAgentApp,FlujoLienzo,SecuenciaPerfil,SimuladorWhatsApp}.tsx
app/_components/Lienzo.tsx          ← insetIzq (lo comparten /chatbot y /mensajes)
app/_components/EditorCron.tsx      ← NUEVO: la pieza extraída de /mensajes
app/agencia/FlujoAviso.tsx          ← sólo para EXTRAERLE esa pieza
app/api/chat-agent/secuencias/route.ts
lib/{nutricion,setting-secuencias,flujo-conversacion}.ts
lib/nutricion-agenda.ts             ← NUEVO: la decisión del horario, pura y con test
scripts/respaldo-disparadores.ts    ← ahora SEIS columnas, no cuatro
supabase/migrations/0192_secuencia_cron.sql
tests/{nutricion-agenda,flujo-conversacion}.test.ts
docs/hallazgos-{ui,comunicacion}.md · AGENTS.md · app/admin/dev/chatbot/bitacora.ts
```

**NO son míos** (estaban sin commitear de las otras dos sesiones): todo
`app/customer-success/`, `lib/{entrega-servicio,servicio-etapas,workspace}.ts`,
`tests/{cs-kanban-fases,servicio-etapas}.test.ts` y la feature de `replay`.

### Las dos trampas que más tiempo ahorran

1. **Apoyar algo sobre el borde de un lienzo son CUATRO lugares, no uno**: el chrome, la
   fila del zoom, el panel del nodo y **el ENCUADRE** (que centra el grafo sobre el ancho
   total y mete la primera tarjeta en la zona tapada). Ninguno da error —el control se ve,
   está habilitado y el clic no llega— y los cuatro los encontró el arnés con «intercepts
   pointer events», no leer el código. Ya está en `AGENTS.md`.
2. **El test del ancla del cron daba 11/11 EN VERDE con el bug puesto.**
   `proximaOcurrencia` reconstruye la hora de pared desde el cron para día/semana/mes/año,
   así que la deriva no sobrevive: el único lado donde el ancla decide es `unidad: 'hora'`,
   y era justo el que el test no miraba. Si tocás `lib/cron-aviso.ts`, ése es el caso.

### Cómo se verifica esta tab

El arnés vive en el scratchpad de la sesión (`v9.mjs` los nueve puntos, `v12.mjs` el
horario y `/mensajes`), así que se reescribe. Lo que hay que saber para rehacerlo:

- `npx tsx scripts/respaldo-disparadores.ts guardar 1` **ANTES** de tocar nada: el entorno
  local apunta a la base de PRODUCCIÓN y el ws1 es un cliente real.
- `http://localhost:3000/api/auth/dev-login?ws=1&next=/chatbot`.
- **`waitUntil: 'domcontentloaded'`, nunca `networkidle`**: `/mensajes` sondea y no lo
  alcanza nunca — esperar eso dejó el arnés colgado diez minutos y se leyó como «la
  pantalla no carga».
- ⚠️ **`innerText` APLICA `text-transform`**: los rótulos van en uppercase, así que buscar
  «Cuándo se dispara» como se escribió devuelve «no aparece» sobre una pantalla perfecta.
  Tercera vez que pasa en esta casa.
- ⚠️ Y la cuadrícula del lienzo son **dos `linear-gradient`**, no `repeating-linear-gradient`:
  buscar el otro dio dos rojos sobre código correcto.
