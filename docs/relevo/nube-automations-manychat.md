# Automations sin trabas, paridad con ManyChat y todo en la API — relevo (nube, 10/11/2026)

> **El pedido, textual (Martín, 9/11/2026):** «soluciones al 100 % y preveas todo lo que pueda llegar a pasar en relación a
> Automations, porque Leandro lo estuvo intentando utilizar y no lo pudo… que revises que todo lo que se hace en ManyChat se
> pueda hacer y que nosotros tengamos todo eso… y todo lo anterior documentado en la API: todo tiene que estar documentado en
> la API. Por ejemplo, hoy en día en la API ni siquiera se pueden levantar tickets, y sí se debería».

**Rama:** `punta/automations-manychat` (la misma historia está en `claude/focused-clarke-6ck5fp`). **Sin escritura en
producción y sin migraciones**: ninguna de las partes necesitó una.

## Qué quedó hecho (un commit por parte, todos con su test probado rompiéndolo)

| Commit | Qué cambia para el usuario |
|---|---|
| `ff852479` | **La Ticketera por la API** (`/api/v1`): levantar un ticket (`POST /mako/tickets`), listar (`GET /mako/tickets`), ver uno con su conversación (`GET /mako/tickets/{numero}`) y contestarlo (`POST /mako/tickets/{numero}/comentarios`). Con un token detallado firma la persona que creó el token y entra por la vía libre de su negocio («Aprobado por regla: Leandro»); el nombre del token nunca firma. Con un token clásico queda propuesta y firma quien la confirma en `/mako/pendientes`. |
| `2f96d2fc` | **Palabras clave en un DM y en la respuesta a una historia** de Instagram (antes, sólo en un comentario), y el CRON nuevo **«El usuario te menciona en su historia»**. |
| `a97af785` | **Automations por la API** (HTTP): ver las plantillas, crear desde una, duplicar, renombrar (y el emoji), «volver a probar» a un lead, y quién está esperando en cada tarjeta (`espera_por_tarjeta`). |
| `e12cd19c` | **Activar con emails prende el «Envío real» del email** (la misma decisión #851 de Martín para WhatsApp, extendida). Antes cada email quedaba «canal email apagado», reintentado cada 24 h, sin un aviso. Por la API, la respuesta dice qué se prendió; el lead y la tarjeta dicen «Email apagado» si sigue apagado. |
| `d763297d` | **Publicar frena un texto entre corchetes**: «Hola [nombre]» no salía NUNCA (el motor lo saltea) y «[tu link …]» le llegaba literal al lead. La tarjeta queda en rojo con el motivo. |
| `c9071fc0` | **Un AI Step nuevo nace con el medio del CRON** (Instagram o Messenger) cuando todos los CRON llegan por ese medio. Antes nacía en WhatsApp: no le contestaba a nadie y Activar pedía conectar un WhatsApp. |
| `023a226b` | **No se activa una automatización vacía ni una sin disparador**: quedaba «Activa» sin hacer nada. |

⚠️ **Una decisión que extendí y Martín puede revertir en una línea:** prender el «Envío real» del email al activar (commit
`e12cd19c`). Es la misma regla que él eligió para WhatsApp el 17/10 («activar ya es el consentimiento de mandar»), y un email
sólo sale con el dominio y el remitente propios del negocio. Si no lo quiere para el email: `enviosQuePrender` con
`email: false` (lib/envio-al-activar.ts).

## Paridad con ManyChat (medida contra el código, 10/11/2026)

ManyChat en 2025-2026, función por función. «MaKo hoy» sale de leer el código (`lib/disparadores.ts`, `lib/condiciones-catalogo.ts`,
`lib/api-mako/areas/*.def.ts`, `app/automations/`), no de la documentación.

### Disparadores (lo que en ManyChat son los «Triggers» y las «Growth tools»)

| ManyChat | MaKo hoy | Qué falta |
|---|---|---|
| Instagram: comentario con palabras clave | ✅ «comenta tu publicación o Reel», con palabras | — |
| Instagram: respuesta a una historia | ✅, y desde hoy con palabras clave | — |
| Instagram: mención en una historia | ✅ desde hoy | — |
| Instagram: DM con palabra clave | ✅ desde hoy | — |
| Instagram: comentario en un En vivo | ✅ con palabras | — |
| Instagram: clic en un anuncio (Click-to-DM) | ✅ (prendido el 28/10, nunca probado con un anuncio de verdad) | Probarlo con un anuncio real |
| Instagram: link de referencia (ig.me) | ✅ | — |
| Instagram: código QR | ❌ (Messenger sí lo tiene) | El subtipo `qr` en `EVENTOS_INSTAGRAM` |
| Messenger: comentario, DM, anuncio, ref, QR | ✅ | La tienda de Facebook está «Todavía no» |
| **WhatsApp: mensaje con palabra clave** | ❌ **No hay clase WhatsApp en el CRON.** Un número nuevo entra al CRM y dispara «Funnel»; uno que ya está sólo puede disparar «Un lead contesta y MaKo no le respondió», sin palabras | **El hueco más grande.** Ver «Lo que sigue», punto 1 |
| WhatsApp: link wa.me con texto y QR | ❌ | Va con el punto 1 |
| WhatsApp: respuesta por defecto / bienvenida | ❌ como CRON (lo cubre «Funnel» para un número nuevo) | Va con el punto 1 |
| TikTok, Telegram, SMS | ❌ | Fuera de alcance hoy |
| Etiqueta puesta | ✅ | — |
| Campo personalizado cambiado | ❌ (no hay campos personalizados) | Va con el punto 2 |
| Fecha (cumpleaños, aniversario) | ✅ parcial: «Recurrente» con horario | Fecha de cada lead: no |
| Entró a una etapa del CRM | ✅ (no existe en ManyChat) | — |
| Pagos (aprobado, rechazado, devuelto, suscripción cancelada, comprobante) | ✅ (no existe en ManyChat sin integración) | — |
| Email recibido | ✅ | — |
| Disparar por API | ✅ `inscribir_lead_secuencia` (en la app y en flujos; por HTTP no, a propósito: le escribe a una persona real) | Decidir si un token detallado puede inscribir |

### Constructor del flujo

| ManyChat | MaKo hoy | Qué falta |
|---|---|---|
| Mensaje: texto, imagen, video, audio, archivo | ✅ (audio y archivo por WhatsApp; texto e imagen por Instagram/Messenger) | — |
| Botones y respuestas rápidas | ✅ Instagram y Messenger (`botones-social`); WhatsApp no oficial no tiene botones | Límite de WhatsApp no oficial |
| Tarjeta / galería (carrusel) | ❌ | Bajo impacto |
| **Guardar la respuesta del lead en un campo** (User Input con validación) | ❌ | **Punto 2** |
| Condición | ✅ catálogo de condiciones, varias por tarjeta | Condición sobre el texto del último mensaje: no |
| Randomizer (A/B) | ✅ «A/B TEST», con juez estadístico | — |
| Smart delay | ✅ tiempo, y «antes de la reunión» | — |
| Ir a otro flujo / suscribir a una secuencia | ✅ «Ir a» y la ⚡ Acción «Meter un lead en una secuencia» | — |
| Acciones: etiqueta, mover de etapa, avisar al equipo | ✅ (⚡ Acción, todo el registro de la API) | — |
| **Llamar a un webhook / External request** (Leandro lo pidió) | ❌ | **Punto 3** |
| Google Sheets, HubSpot, Mailchimp, Klaviyo | ❌ | Lo cubriría el webhook (punto 3) |
| AI Step / AI Intents | ✅ AI Step, uno por medio, con escenarios | — |
| Hilos en paralelo | ✅ (no existe en ManyChat) | — |
| Email en el mismo flujo | ✅ | — |

### Lo demás

| ManyChat | MaKo hoy | Qué falta |
|---|---|---|
| Difusión (broadcast) a un segmento | ✅ difusión a una columna del CRM (sólo desde la app) y newsletter por email | Por la API, sólo desde la app (decisión vigente) |
| Contactos, etiquetas, segmentos, CSV | ✅ CRM, etiquetas, importar y exportar | Campos personalizados (punto 2) |
| Bandeja / live chat, asignar, notas | ✅ /chats (WhatsApp, Instagram, Messenger); una respuesta humana pausa la automatización | — |
| **Respuestas guardadas (canned replies)** | ❌ | **Punto 4** |
| Plantillas de flujos | ✅ galería («Sin automatizaciones, sólo plantillas») | — |
| Analíticas por flujo y por tarjeta | ✅ «Métricas» de cada automatización, y cuántos esperan en cada tarjeta | Enviados/leídos/clics por tarjeta en el lienzo |
| Palabra de baja (STOP) por WhatsApp | ❌ medido: no hay | **Punto 5** |
| Horario de envío, ritmo (anti-ban) | ✅ (no existe en ManyChat así) | — |
| API pública | ✅ `/api/v1`, Automations y desde hoy la Ticketera | Lo de «Parte 5», abajo |

## Lo que sigue, por impacto (nada de esto se empezó)

1. **WhatsApp en el CRON, con palabras clave, wa.me y QR.** Es lo que más usa la gente que viene de ManyChat. Cómo: una clase
   `whatsapp` en `CLASES_DISPARADOR` (⚠️ Martín decidió la grilla «4+3, nunca 3+3+1»: con ocho clases queda 4+4) con
   `EVENTOS_WHATSAPP` = mensaje con palabras / link wa.me con texto / QR; el webhook de Evolution
   (`app/api/webhooks/evolution`) llama a la misma puerta que Zernio (`dispararEventoSocial` → `disparaPorEvento` con
   `conPalabras`). Las palabras ya comparan contra el texto del mensaje (`queSeComparaConPalabras`).
2. **Campos personalizados + «Guardar la respuesta»** (el User Input de ManyChat). Pide una migración (`lead_campos`), el
   tablero de seis lugares (AGENTS.md, «un campo nuevo son SEIS lugares») y una condición «Campo … es …».
3. **⚡ Acción «Llamar a un webhook».** Por `fetchSeguro` (validar el destino en cada salto, sin IPs internas), con tope de
   tamaño y de tiempo, sin credenciales del negocio en la URL, y fuera de `NO_EN_FLUJOS` sólo si el destino es el que el
   negocio declaró (lista de destinos por negocio). Lo pidió Leandro.
4. **Respuestas guardadas en /chats**, con su CRUD en la API.
5. **La palabra de baja por WhatsApp** («STOP», «baja»): cerrar las inscripciones del lead y marcarlo para que ninguna
   automatización le vuelva a escribir. Es lo que protege la línea no oficial de un baneo por denuncias.
6. QR de Instagram, tarjeta/galería, condición sobre el texto del último mensaje, métricas por tarjeta en el lienzo.

## Trabas que encontré y NO arreglé (por qué)

- **Probar pide los canales conectados.** No lo toqué: la decimotercera tanda tiene una decisión sobre «Probar sin conexión»
  (docs/hallazgos-chatbot.md) que hay que leer antes.
- **Una plantilla que mezcla WhatsApp y email** frena Activar con «Conecta tu email» sin ofrecer sacar las tarjetas de email.
  Arreglarlo es una decisión de producto (¿se ofrece borrar tarjetas?), no una línea.
- **El horario de fábrica** (9 a 21, lib/ritmo-al-activar.ts) se pone solo al activar y el aviso de ritmo no sale con 0 leads.
- **Los motivos del lead sin link a donde se arregla** («Email apagado» no lleva a /email).
- **El tope del plan** («hasta 3 activas» del Esencial) no ofrece «Pasar a Pro» en el error.

## Parte 5 — lo que todavía no está en la API (Automations y la Ticketera)

Ya salen por HTTP, desde hoy: la Ticketera entera (levantar, listar, ver, contestar) y en Automations las plantillas, crear desde
una, duplicar, renombrar, «volver a probar» y quién espera en cada tarjeta. Lo que falta, en orden:

1. **Inscribir y sacar a un lead por HTTP** (`inscribir_lead_secuencia`, `sacar_lead_secuencia`): cerrado a propósito porque le
   escribe a una persona real. Decidir si un token detallado con escritura en `chatbot` puede.
2. **Difundir por HTTP** (`difundir_*`): sólo en la app (decisión vigente).
3. **Las posiciones del lienzo** (`guardarPosicionesSecuencia`): sin operación. Bajo impacto (es el dibujo).
4. **Las métricas de una automatización** (el informe `automatizacion:<id>`): sin lectura propia en la API.
5. **Cerrar un ticket desde la API**: no se ofrece a propósito (un ticket se cierra con el deploy, AGENTS.md).

## Cómo verificar

```bash
export PATH="$(sh scripts/node24.sh):$PATH"
```

```bash
node --import tsx --test tests/tickets-api.test.ts tests/instagram-dm-palabras-mencion.test.ts tests/automations-api.test.ts tests/envio-al-activar.test.ts tests/flujo-relleno.test.ts tests/ai-step-medio-del-cron.test.ts tests/activar-vacia.test.ts
```

## Autocrítica

- **Cambié** el «prender el email al activar» de silencioso a dicho por la API: por HTTP no hay otra pantalla que lo muestre.
- **Cambié** el freno del CRON sin elegir: primero lo puse en el server y vi que rompía la difusión (nace `manual` y se activa
  por código). Quedó en la pantalla; el server frena sólo la vacía.
- **Descarté** meter el corchete en `validarGrafo`: esa vara rechaza un guardado, y las semillas nacen con corchetes a propósito.
- **No pude mirar la pantalla en un navegador** (la sesión de la nube no tiene datos de un negocio): los cambios de UI son un
  `setErr` y un parámetro, y están cubiertos por los tests que ejecutan las funciones puras. Falta que alguien lo mire en el ws3.
