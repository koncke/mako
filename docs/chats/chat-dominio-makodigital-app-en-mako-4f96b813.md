# Dominio makodigital.app en MaKo

`2026-08-01 05:42` → `2026-08-06 04:41` · 24 mensajes de Martín · 241 respuestas de Claude · sesión `4f96b813`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-08-01 05:42`

Acabo de comprar el dominio https://makodigital.app/ en porkbun... Dime como lo instalamos a MaKo

### Claude

Voy a revisar cómo está configurado el dominio actual en el repo antes de darte los pasos.

### Claude

Revisé cómo está cableado el dominio en el repo. La buena noticia: casi todo sale de una sola variable (`APP_BASE_URL`), y el `.vercel.app` sigue funcionando en paralelo, así que se puede migrar sin cortar nada.

## 1. Vercel: agregar el dominio

En el proyecto → Settings → Domains → Add:
- `makodigital.app`
- `www.makodigital.app` (redirect al apex)

Vercel te muestra los registros exactos a crear. **Copiá los que te muestra a vos**, no valores de memoria (Vercel cambió sus IPs de apex el año pasado).

## 2. Porkbun: DNS

Primero **borrá los registros de parking** que Porkbun crea solo (un `ALIAS @ → pixie.porkbun.com` y un `CNAME *`). Si los dejás, pisan lo de Vercel.

Después, dos opciones:

- **Recomendada — DNS en Porkbun:** crear `ALIAS @ → cname.vercel-dns.com` (Porkbun soporta ALIAS en el apex, que es más limpio que el A record) y `CNAME www → cname.vercel-dns.com`. Te deja los registros de email y verificaciones en un solo lugar.
- Nameservers de Vercel: más simple pero te lleva TODO el DNS del dominio a Vercel.

Propagación: minutos, normalmente. Vercel emite el certificado solo.

## 3. Env vars en Vercel (el paso que de verdad importa)

Esto es lo que hace que la app se "mude". Settings → Environment Variables (Production):

```bash
APP_BASE_URL=https://makodigital.app
NEXT_PUBLIC_APP_URL=https://makodigital.app
```

De ahí cuelgan: los links de WhatsApp del doer, los links de `/plan/revisar`, el unsubscribe de los emails, el beacon del VSL y **las URLs de webhook que la app le registra sola a Chatwoot y Evolution**. Redeploy después de cambiarlas (las `NEXT_PUBLIC_` se hornean en el build).

## 4. Re-registrar webhooks

- **Chatwoot y Evolution:** se autoregistran desde `APP_BASE_URL` y ya tienen detección de drift + "reparar" en la UI ([lib/chatwoot.ts:685](dashboard-marketing/lib/chatwoot.ts:685), [lib/evolution.ts:27](dashboard-marketing/lib/evolution.ts:27)). Después del deploy, entrá a Integraciones y dale reparar.
- **A mano, en el panel de cada servicio:** Calendly, Fathom, Resend y Meta Lead Ads. Las 4 rutas son `https://makodigital.app/api/webhooks/{calendly,fathom,resend,meta-leads}`.

## 5. Google OAuth (si no, el login se rompe)

En Google Cloud Console → Credenciales → tu cliente OAuth, agregá como URIs de redirección autorizadas:

```
https://makodigital.app/api/auth/callback/google
https://makodigital.app/api/integraciones/google-calendar/callback
```

Y `https://makodigital.app` como origen JS autorizado. **Agregá, no reemplaces** — dejá las del `.vercel.app` hasta terminar la migración.

## 6. Meta

Verificá `makodigital.app` en Business Manager (Brand Safety → Dominios) con el meta-tag o el registro TXT en Porkbun. Sin eso, la landing `/vsl` con el píxel y el CAPI quedan degradados para iOS.

## 7. Email (Resend) — decisión aparte

Si querés que la nutrición salga desde `@makodigital.app`, hay que verificar el dominio en Resend y cargar SPF/DKIM/DMARC en Porkbun. Recomiendo un subdominio dedicado (`mail.makodigital.app`) para no quemar la reputación del dominio raíz con el correo transaccional. Ojo con [la nota de `RESEND_FROM`](dashboard-marketing/lib/resend.ts:72) — el `.env.local` apunta a la base de prod.

---

**Una cosa del código:** hay 13 archivos con `https://dashboard-marketing-six.vercel.app` hardcodeado como fallback (chatwoot, evolution, resend, mako-doer, landing-token, etc.). Con las env vars puestas no se usan nunca, pero si alguna falta el fallback te manda silenciosamente al dominio viejo. Puedo centralizarlos en una constante única y apuntarla al dominio nuevo — decime y lo hago.

**Sobre la estrategia de dominio:** hoy una sola app sirve la landing (`/vsl`) y el dashboard, así que el apex para todo funciona. Si más adelante querés separar marketing de producto, `app.makodigital.app` para el dashboard es el corte natural, pero no lo haría ahora.

¿Arranco por el punto 1-2 (te acompaño con los registros que te muestre Vercel) o preferís que primero limpie los fallbacks del código?


---

## Martín

`2026-08-01 05:51`

Te comparto la API de Pork:
APIKey:=pk1_d0c2e2eafba6d5c82352804ebee0d0c6b78f15c77e67c628e10e9ed5900f1ac8
SecretKey=sk1_55eea753043f969d1bf0ab3d7e25998ad371260deb6d398f57af1a8eba26b6dd

Guardalo en el env local...

También tienes la API de VERCEL, y la de todas las apps
Haz todo tu

### Claude

Voy a hacerlo. Empiezo guardando las llaves y verificando qué tengo disponible.

### Claude

Porkbun necesita que actives el acceso por API al dominio (es un toggle manual). Mientras tanto avanzo con todo lo de Vercel.

### Claude

El dominio ya estaba agregado al proyecto en Vercel. Sigo con el resto.

### Claude

Ahora centralizo los fallbacks hardcodeados del código (13 archivos apuntan al dominio viejo).

### Claude

Ahora los imports y las sustituciones restantes:

### Claude

Typecheck limpio. Veo el estado de git para pushear el refactor:

### Claude

Hecho todo lo que no depende de vos. Falta un toggle manual en Porkbun.

## Lo que ya está

**Vercel** (proyecto `dashboard-marketing`)
- `makodigital.app` ya estaba agregado y verificado (ownership OK).
- Agregué `www.makodigital.app` con redirect 308 al apex.
- El certificado se emite solo en cuanto el DNS apunte bien.

**Código** — pusheado a main ([782ebe1](https://github.com/mbustos-digital/dashboard-marketing/commit/782ebe1))
- Nuevo [lib/app-url.ts](dashboard-marketing/lib/app-url.ts): única fuente de la URL base, con fallback ya en `makodigital.app`.
- Los 13 archivos que repetían `dashboard-marketing-six.vercel.app` ahora importan de ahí (chatwoot, evolution, resend, landing-token, mako-doer, mako-tools, reunion-*, /integraciones, agente/plan) + la skill `plan-tareas`.
- Typecheck limpio. Sin cambio de comportamiento: `APP_BASE_URL` en Vercel sigue apuntando al dominio viejo, así que **nada se movió todavía**.
- Toqué solo mis archivos — los cambios sueltos del otro Claude (`plan/page.tsx`, `todo-seeds*`, `plan-senales.ts`) quedaron sin commitear.

**Credenciales**: las llaves de Porkbun quedaron en `.env.local` como `PORKBUN_API_KEY` / `PORKBUN_SECRET_KEY`.

## Lo que te toca a vos (2 minutos)

La API de Porkbun contesta y las llaves son válidas, pero el dominio rebota con:

> Domain is not opted in to API access.

Es un switch por dominio que no se puede activar por API. Entrá a **porkbun.com → Domain Management → makodigital.app → toggle "API ACCESS"** (o el global en Account → API Access) y avisame. Ahí sigo solo con el resto.

## Lo que hago apenas actives el toggle

1. Borro los registros de parking (`ALIAS @ → pixie.porkbun.com` y el `CNAME *`) — hoy el apex resuelve a `207.207.210.229`, que es el parking.
2. Creo los registros que pide Vercel para este proyecto:
   - `A @ → 216.150.1.1` y `A @ → 216.150.16.1`
   - `CNAME www → 2db067c06ef29ee8.vercel-dns-016.com`
3. Espero a que Vercel marque el dominio como configurado y emita el cert.
4. Recién ahí cambio `APP_BASE_URL` y agrego `NEXT_PUBLIC_APP_URL` en Vercel, y disparo el redeploy. Ese es el momento en que la app se muda.
5. Reparo los webhooks de Chatwoot y Evolution (se autoregistran desde `APP_BASE_URL`).

## Lo que queda para vos aunque yo haga todo lo demás

- **Google OAuth**: agregar `https://makodigital.app/api/auth/callback/google` y `.../api/integraciones/google-calendar/callback` en Cloud Console. Si esto no está antes del redeploy, **se rompe el login**. Es lo único con riesgo de corte.
- **Webhooks manuales**: Calendly, Fathom, Resend y Meta Lead Ads apuntan a la URL vieja y hay que editarlos en cada panel. El `.vercel.app` sigue vivo, así que no se cae nada mientras tanto.
- **Meta**: verificar el dominio en Business Manager (te dejo el TXT en Porkbun cuando me pases el código).

**Email (Resend)**: no lo toqué a propósito. Mover el remitente a `@makodigital.app` es una decisión aparte con impacto en entregabilidad — decime si querés y lo armo con subdominio dedicado.


---

## Martín

`2026-08-01 06:00`

Ya activé el API access, seguí

### Claude

Confirmado, solo hay registros de parking. Los reemplazo:

### Claude

DNS listo. Verifico propagación y que Vercel lo dé por configurado:

### Claude

La app ya responde por HTTP en el dominio nuevo. Falta que Vercel emita el certificado; lo espero mientras dejo listo el resto.

### Claude

Mientras se emite el cert, dejo las variables de entorno listas en Vercel:

### Claude

Certificado emitido, HTTPS responde 200. Reviso el deploy que está corriendo:

### Claude

El deploy de producción ya tiene las envs nuevas y los alias correctos — no hace falta un build extra. Verifico el dominio end-to-end:

### Claude

Todo verde. Ahora los webhooks de Chatwoot y Evolution, que siguen registrados contra el dominio viejo:

### Claude

Los endpoints de reparación exigen sesión de admin. Antes de pedirte que los toques, verifico read-only cómo están registrados hoy:

### Claude

Confirmo el punto de login antes de reportar — es el único riesgo real:

### Claude

Confirmado: **el login por el dominio nuevo está roto ahora mismo** (`redirect_uri_mismatch`). Es lo único que requiere tu mano. Guardo el estado en memoria:

### Claude

El índice de memoria pasó el umbral; lo compacto (mismas entradas, ganchos más cortos):

### Claude

Listo. **https://makodigital.app está sirviendo MaKo.**

## Lo que hice

**DNS (Porkbun, por API)**
- Borré los dos registros de parking (`ALIAS @` y `CNAME *` → `pixie.porkbun.com`).
- Creé `A @ → 216.150.1.1`, `A @ → 216.150.16.1` y `CNAME www → 2db067c06ef29ee8.vercel-dns-016.com`.

**Vercel**
- `www.makodigital.app` con redirect 308 al apex.
- Vercel da el dominio por bien configurado (`misconfigured: false`) y emitió el certificado.
- `APP_BASE_URL` → `https://makodigital.app` y agregué `NEXT_PUBLIC_APP_URL` (production + preview).
- El deploy de producción actual ya tomó las envs nuevas, así que **no hizo falta un build extra**.

**Verificado en vivo**

| | |
|---|---|
| `https://makodigital.app/vsl` | 200, título correcto, 187 KB de HTML |
| `https://makodigital.app/` | 307 → `/login` (el gate funciona) |
| `https://www.makodigital.app` | 308 → apex |
| `/api/webhooks/chatwoot` y `/evolution` | 401 sin secret (la ruta existe y valida bien) |

**Código** — [782ebe1](https://github.com/mbustos-digital/dashboard-marketing/commit/782ebe1) en main, typecheck limpio.

## Lo urgente: el login por el dominio nuevo está roto

Lo probé contra Google y devuelve `Error 400: redirect_uri_mismatch`. Por el `.vercel.app` seguís entrando normal, pero por `makodigital.app` no. No se puede arreglar por API — es la consola.

En **Google Cloud Console → Credenciales → cliente OAuth `118392241323-j98eq…`**, agregá a "URIs de redireccionamiento autorizadas":

```
https://makodigital.app/api/auth/callback/google
https://makodigital.app/api/integraciones/google-calendar/callback
```

Y `https://makodigital.app` como origen JavaScript autorizado.

## Webhooks: verifiqué cuáles quedaron viejos

Los leí read-only. Los tres siguen apuntando al `.vercel.app` — funcionan porque el alias sigue vivo, así que **no hay nada caído**, pero conviene moverlos:

- Chatwoot: webhook id 2
- Evolution: instancias `mako_ws1` y `mako_superadmin`

Los endpoints de reparación exigen sesión de admin, que desde afuera no tengo. Es un clic en el botón **"Reparar"** de la tab de WhatsApp (uno por integración) — no los reescribí a mano contra la API de Evolution a propósito: un payload mal armado ahí te silencia el espejo de mensajes, y el botón de la app ya hace exactamente eso con validación posterior.

Quedan también, cuando quieras: Calendly, Fathom, Resend y Meta Lead Ads (editar la URL en cada panel), y la verificación del dominio en Meta Business — pasame el código TXT y te lo cargo en Porkbun.

**Resend**: no lo toqué. Mover el remitente a `@makodigital.app` sigue siendo decisión tuya; si me decís que sí, lo armo con subdominio dedicado y te cargo SPF/DKIM/DMARC por API.


---

## Martín

`2026-08-01 06:20`

1. ya agregué las URIs en Google, probá el login
2. No quiero que se pueda acceder nunca más por "https://dashboard-marketing-six.vercel.app/" a MaKo, pon en cualquierda de esas direcciones un mensaje que diga "Nos mudamos" o algo así, y que se redireccione al correcto.
3. Quiero que la ruta principal sea justamente la landing, la que hoy en /vsl...

### Claude

Login OK — Google ya acepta las dos URIs. Ahora leo el routing para los otros dos puntos:

### Claude

Todo claro. Miro la paleta para que el "Nos mudamos" quede on-brand:

### Claude

Ahora implemento los dos cambios:

### Claude

Falta un detalle importante: la landing no tiene link de login, así que la raíz dejaría a la app sin puerta de entrada. Lo agrego al header:

### Claude

Build limpio, `/` queda dinámica. Pusheo:

### Claude

Deploy listo. Verifico los tres puntos en producción:

### Claude

Verifico visualmente que la landing renderiza bien en la raíz y que aparece el login:

### Claude

Todo verificado. Actualizo la memoria con lo nuevo:

### Claude

Los tres, hechos y verificados en producción ([0a8bfd5](https://github.com/mbustos-digital/dashboard-marketing/commit/0a8bfd5)).

## 1. Login

Google ya acepta las dos URIs — probé el flujo real y devuelve la pantalla de "Sign in" en vez de `redirect_uri_mismatch`. Verificado tanto el login como el callback de Google Calendar.

## 2. "Nos mudamos" en el dominio viejo

Los `*.vercel.app` devuelven **410 Gone** con un cartel on-brand que muestra el mensaje, el link nuevo y salta solo a los 4 segundos. **Preserva el path**: probé `six.vercel.app/leads` en el browser y terminó en `makodigital.app/login?next=/leads`.

Las APIs internas cortan con 410 JSON.

**Dejé tres rutas exentas a propósito**, y esto es importante:

- `/api/cron` — Vercel invoca los crons contra la URL del **deployment**, no contra el dominio. Bloquearlas te apagaba los 12 crons.
- `/api/webhooks` y `/api/track` — Chatwoot y Evolution todavía tienen registrada la URL vieja. Bloquearlas te silenciaba WhatsApp.

Las tres validan por firma/secret propio, así que abrirlas por host no afloja nada. **Cuando le des "Reparar" a los webhooks, avisame y saco las dos últimas de la lista** — ahí el dominio viejo queda muerto del todo.

## 3. La landing es la raíz

- `makodigital.app/` → landing, 200, sin sidebar ni chrome, 25 cards, 7 secciones, sin errores de consola ni imágenes rotas.
- Con sesión, `/` sigue siendo el repartidor por rol de siempre (admin → `/admin`, closer/setter → `/leads`, etc.).
- `/vsl` → 308 permanente a `/` (hay anuncios apuntando ahí). Los detalles siguen en `/vsl/<slug>`, intactos.
- `/general` y el resto siguen pidiendo login.

**Un cambio que no pediste pero hacía falta**: la landing no tenía link de login, así que al pasarla a la raíz la app se quedaba sin puerta de entrada visible. Le agregué un **"Iniciar sesión"** discreto en el header, a la izquierda de "Solo 5 cupos". Si preferís que no esté a la vista, lo saco y entrás por `/login` directo.

Verifiqué el build local antes de pushear (un solo build en Vercel, ~$0.09).


---

## Martín

`2026-08-01 06:38`

Sigue diciendo "Mauricio Bustos - Marketing Digital" al lado del logo, eso no debe estar así

### Claude

Dos cosas. Primero la del redirect — tenés razón, ese fue un error mío de diseño. Reviso ambas:

### Claude

Confirmado que no es la pantalla de Google (dice "continue to makodigital.app"). Es el título de la pestaña. Arreglo las dos cosas:

### Claude

Los dos, arreglados y verificados en producción ([c7ec23f](https://github.com/mbustos-digital/dashboard-marketing/commit/c7ec23f)).

## El redirect — tenías razón, estaba mal planteado

Puse el repartidor por rol en la raíz, y eso hacía imposible ver el VSL con sesión abierta. Lo separé:

- **`/` es la landing para todos**, con sesión o sin ella. Ya no lee sesión, así que además quedó estática (se sirve del edge, más rápida y sin costo de función).
- **`/inicio` es el repartidor**: admin → `/admin`, closer/setter → `/leads`, onboarding pendiente → `/onboarding`, resto → `/general`.

Ahí caen ahora el login (por defecto, tanto en `destinoSeguro` como en `destinoInterno`), el botón del header y **todos los rebotes "a tu casa"** que antes iban a `/` — el `denegarRol` del proxy, `/admin`, `/metodo`, `/contexto`, `/modelos-ia`, `/conocimientos`. Esos nueve rebotes eran el mismo bug que vos encontraste: con la landing en la raíz, te echaban de la app.

El link del header dice **"Entrar"** y apunta a `/inicio`, no a `/login`: sirve para los dos casos sin tener que saber si hay sesión. Con sesión entrás derecho; sin sesión el gate te manda a `/login?next=/inicio` y volvés solo.

## El texto al lado del logo

Era el **título de la pestaña del navegador**, que se lee al lado del favicon: decía `Marketing OS — Mauricio Bustos`, branding de cuando esto era el dashboard interno de una sola cuenta. Ahora dice **`MaKo`**.

De paso descarté que fuera la pantalla de Google: la abrí y dice "to continue to makodigital.app", correcto.

Si el texto que viste era otra cosa —y no el título de la pestaña— decime en qué pantalla estabas y lo cazo.

**Verificado en vivo**: `/` devuelve la landing (200, título de venta, sin sidebar, header con "Entrar" → `/inicio`), `/inicio` redirige a `/login?next=/inicio`, `/login` ya titula "MaKo", y `/vsl` sigue con su 308 a la raíz.

Sigue pendiente lo tuyo: el botón **"Reparar"** de los webhooks en la tab de WhatsApp. Cuando lo hagas, saco `/api/webhooks` y `/api/track` de las rutas exentas y el dominio viejo queda muerto del todo.


---

## Martín

`2026-08-01 14:04`

Que tengo que hacer para reparar los weebhoks?

### Claude

Te muestro las dos opciones — la de clics y la de que lo haga yo. Déjame ver primero cómo lo hace la app por dentro:

### Claude

Lo verifiqué en el código. Son tres webhooks, no dos, y cada uno se arregla distinto:

## 1. Chatwoot — no tenés que hacer nada

Solo **abrí `/whatsapp`**. El chip "API Oficial" verifica al montar y, si el webhook no está registrado con la URL correcta, **se repara solo** ([ChatwootWebhookChip.tsx:74](dashboard-marketing/app/whatsapp/ChatwootWebhookChip.tsx:74) — `no_registrado` está en `AUTO_REPARABLE`).

Y ese es exactamente el estado en el que va a caer: la salud compara la URL registrada contra la esperada, y como ahora la esperada es `makodigital.app`, la vieja no matchea → `no_registrado` → auto-repara.

## 2. WhatsApp no oficial (`mako_ws1`) — un clic

En `/whatsapp`, al lado del chip "API Oficial" está el chip del WhatsApp no oficial. **Abrilo** (el modal solo chequea la salud del espejo cuando lo abrís) y ahí aparece el botón **"Reparar espejo"**.

## 3. El canal de voz de MaKo (`mako_superadmin`) — este no tiene botón

Este es el que te iba a pasar por alto. Confirmé en la base que la voz activa de MaKo es `mako_superadmin`:

```
mako.voz.instancia = mako_superadmin
```

Pero el botón "Reparar espejo" repara `mako_ws1` — usa `instanceNameDeWs(ws)`, que nunca devuelve la instancia de voz. La única forma de arreglar esa es `POST /api/admin/mako-doer {action:'preparar-voz'}`, que **no está expuesto en ninguna pantalla**: es API pura.

O sea: si hacés 1 y 2 y yo saco la exención del dominio viejo, **"Hola MaKo" por voz se rompe**.

---

**Mi propuesta**: hacé 1 y 2 (30 segundos, y la app verifica sola que quedó bien), y **el 3 lo hago yo ahora** — tengo las credenciales de Evolution y el payload exacto que usa `setWebhook`, así que es la misma llamada que haría la app, sin adivinar nada. ¿Le doy?

Aparte, vale la pena anotar como deuda que la instancia de voz no tenga botón de reparación en ningún lado — es un punto ciego que se va a repetir la próxima vez que cambie algo de infraestructura.


---

## Martín

`2026-08-05 11:07`

Acabo de cambiar el dominio y compre otro, ya le puse access API. Ya sabes que hacer

### Claude

Encontré el dominio nuevo en tu cuenta de Porkbun: **`hola-mako.com`** (con API access ya activado, confirmado). Antes de tocar nada en producción necesito saber qué querés hacer con él — la última vez esto tocó login, webhooks y el dominio en vivo, así que prefiero confirmar en vez de asumir.

### Claude

Entendido: **`hola-mako.com` pasa a ser el dominio de producción**, reemplazando a `makodigital.app` (que a su vez ya había reemplazado al `.vercel.app`). Repito el mismo playbook. Primero generalizo el script para manejar cualquier dominio:

### Claude

Ahora lo generalizo para que las llamadas a Porkbun tomen el dominio como parámetro (necesito operar sobre `hola-mako.com` sin perder la capacidad de tocar `makodigital.app`):

### Claude

Ahora agrego el dominio al proyecto de Vercel y reviso el DNS actual:

### Claude

DNS listo, con MX y SPF de mail intactos. Ahora reviso config, y en paralelo actualizo el código:

### Claude

Correcto: DNS de la app + MX/SPF de mail forwarding intactos. Ahora los cambios de código:

### Claude

Ahora el comment del webhook de Chatwoot y otras menciones puntuales:

### Claude

Ahora actualizo las envs en Vercel:

### Claude

Ahora typecheck/build local y push:

### Claude

Limpio — solo mis archivos. Build local rápido para confirmar rutas antes de pushear:

### Claude

Build limpio. Pusheo:

### Claude

Deploy listo. Verifico DNS, certificado y comportamiento en vivo:

### Claude

DNS bien configurado, certificado emitido (http-01 aceptado). Verifico HTTPS y comportamiento:

### Claude

Todo verificado: `hola-mako.com` sirve la app, `makodigital.app` ya tiene el cartel de mudanza, y los webhooks siguen respondiendo (exentos) hasta que se re-registren. Verifico el mail forwarding no se rompió:

### Claude

Confirmado, el email forwarding sigue vivo. Actualizo la memoria:

### Claude

Actualizo el índice y avisamos el pendiente de Google, que es urgente:

### Claude

Listo. `hola-mako.com` ya sirve MaKo en producción, verificado en vivo:

| | |
|---|---|
| `https://hola-mako.com/` | 200, landing, título correcto |
| `https://hola-mako.com/inicio` | 307 → login (protegida) |
| `https://www.hola-mako.com` | 308 → apex |
| `https://makodigital.app/` | **410, cartel "Nos mudamos" → hola-mako.com** |
| Webhooks en el dominio viejo | siguen respondiendo (exentos a propósito) |
| MX/SPF de mail forwarding | intactos, no los toqué |

**Lo que hice**: agregué el dominio en Vercel, armé el DNS en Porkbun (cuidando no tocar los registros de mail que ya tenía este dominio), cambié `APP_BASE_URL`/`NEXT_PUBLIC_APP_URL`, y en el código solo hicieron falta dos líneas — el fallback de [lib/app-url.ts](dashboard-marketing/lib/app-url.ts) y `HOST_CANONICO` en [proxy.ts](dashboard-marketing/proxy.ts:60) — porque la centralización de la vez pasada rindió: no había más literales del dominio dando vueltas. Pusheado y deployado ([18187ad](https://github.com/mbustos-digital/dashboard-marketing/commit/18187ad)).

## Lo urgente, igual que la vez pasada: Google OAuth

No lo probé todavía a propósito — sé que va a fallar. En **Google Cloud Console → Credenciales → cliente OAuth**, agregá:

```
https://hola-mako.com/api/auth/callback/google
https://hola-mako.com/api/integraciones/google-calendar/callback
```

Y `https://hola-mako.com` como origen JS autorizado. Las de `makodigital.app` no hacen falta que las borres, pero ya no alcanzan para loguearte en el dominio nuevo. Avisame cuando lo agregues y pruebo el login.

## Deuda que arrastramos (no es nueva, ya estaba con makodigital.app)

Los webhooks de Chatwoot, Evolution (`mako_ws1` y el canal de voz `mako_superadmin`) y los paneles de Calendly/Fathom/Resend/Meta siguen apuntando al dominio anterior. No urge — siguen respondiendo porque `/api/webhooks` está exento de la mudanza — pero si querés los recorremos ahora que estamos en esto, en vez de acumular otra ronda de deuda.

### Claude

Ese grep en segundo plano era el que ya había revisado con la herramienta Grep — confirma lo mismo, sin nada nuevo. Los 4 archivos que aparecen son:

- `chatwoot/route.ts` y `page.tsx` — ya los corregí (eran el literal viejo en comentarios).
- `lib/app-url.ts` y `proxy.ts` — mencionan `makodigital.app` solo en comentarios históricos (explicando que fue el dominio anterior), no como fallback activo. El fallback real en ambos ya es `hola-mako.com`.

Nada pendiente ahí. Sigo esperando que agregues las URIs de Google OAuth para poder probar el login en `hola-mako.com`.


---

## Martín

`2026-08-05 11:33`

Ya agregué las URIs en Google. Si quedan pendientes, continua

### Claude

Perfecto. Pruebo el login y en paralelo leo los payloads exactos que usa la app para registrar los webhooks:

### Claude

Login funcionando en el dominio nuevo. Ahora los detalles exactos de las URLs de webhook:

### Claude

Login verificado en `hola-mako.com`. Ahora, antes de tocar los webhooks, quiero un barrido exhaustivo de **todo** lo que siga apuntando a un dominio viejo — es la segunda mudanza y ya sabemos que estas cosas dejan deuda silenciosa (el tracking del VSL lleva muerto desde julio por algo así). Lanzo el barrido en paralelo:

### Claude

Login confirmado funcionando en el dominio nuevo:

```
redirect_uri: https://hola-mako.com/api/auth/callback/google  →  Google devuelve "Sign in"
```

Sin `redirect_uri_mismatch`. Ya podés entrar por `hola-mako.com`.

Lancé un barrido en paralelo de 6 frentes (código, base de datos, Chatwoot+Evolution, Vercel, servicios externos, y el tracking del VSL), cada hallazgo verificado por un escéptico independiente que intenta refutarlo. Todo en **solo lectura** — no toca nada, solo me dice qué queda apuntando a un dominio viejo.

Lo hago así en vez de ir directo a reparar los 3 webhooks que ya conozco porque esta es la segunda mudanza y la primera dejó deuda que nadie vio durante semanas (el tracking del VSL). Prefiero arreglar todo de una pasada informada que descubrir en septiembre que algo venía fallando en silencio.

Te aviso apenas termine con la lista completa y arranco por lo que puedo arreglar yo mismo con las credenciales que ya tengo.

### Claude

El barrido encontró bastante más de lo que esperaba. Leo el informe completo:

### Claude

El barrido encontró bastante más de lo que sabíamos. **Hay daño activo ahora mismo**, así que arranco por lo urgente. Primero verifico con mis propios ojos antes de tocar nada:

### Claude

Confirmado exactamente lo que reportó el barrido. El **id 3 lo creó la auto-reparación** cuando abriste `/whatsapp` después de la mudanza anterior — y el id 2 nunca se limpió porque `webhooksPropios()` compara el host completo. Por eso hay entrega doble.

Arreglo Chatwoot y Evolution con el mismo payload exacto que usaría la app:

### Claude

El simulacro coincide exactamente con lo verificado. Aplico:

### Claude

Todo aplicado. Verifico leyendo el estado real:

### Claude

Los 5 webhooks ahora apuntan al dominio nuevo, el duplicado eliminado y el de n8n intacto. Ahora la causa raíz de ese duplicado, que sigue viva en el código:

### Claude

El fix es seguro: la comprobación de salud usa igualdad exacta aparte (`h.url === esperada`), así que cambiar solo el criterio de "cuáles son nuestros" arregla el PATCH/dedup sin alterar el diagnóstico.

### Claude

Ahora corrijo el comentario de `proxy.ts` que invita a un cambio peligroso, y el de `app-url.ts` que lista los pasos de una mudanza sin incluir el snippet de la landing:

### Claude

Y el doc que documenta una variable que ya no existe:

### Claude

Ahora verifico end-to-end que los receptores aceptan el secret en la URL nueva — el mismo ping benigno que usa la app para su chequeo de salud:

### Claude

Verificación end-to-end limpia, con control negativo. Antes de tocar Calendly quiero confirmar una trampa que marcó el barrido:

### Claude

Confirmado el landmine: la línea guarda un **JWT de 908 chars** (un PAT de Calendly) bajo el nombre de la *signing key*, y `CALENDLY_API_TOKEN` no existe. Verifico el riesgo real de que eso envenene producción:

### Claude

Verificado y es real: `migrarEnvACredenciales()` escribe a la base cualquier clave de `ENVS_METODO` que falte, tomándola de `process.env`. Y `.env.local` apunta a la Supabase de **producción**. O sea: el día que se rote la signing key de Calendly (borrando esa fila), el próximo `npm run dev` escribiría el **PAT** a producción como si fuera la firma → todos los webhooks de Calendly a 401.

Eso está justo en el camino del arreglo de Calendly. Lo desactivo primero:

### Claude

Landmine desactivado y el PAT verificado bajo el nombre correcto. Confirmo el estado de Calendly antes de decidir:

### Claude

Confirmado. Actualizo la memoria con lo aprendido y lo que queda:

### Claude

Hecho lo que se podía hacer sin riesgo. Resumen:

## Arreglado y verificado

**Los 5 webhooks de mensajería ya apuntan a `hola-mako.com`** — y encontré más de los que sabíamos: eran **4 instancias de Evolution**, no 2 (`mako_ws1`, `mako_ws3`, `mako_ws11`, `mako_superadmin`). Verifiqué con lectura posterior y con un ping usando control negativo (secret correcto → 200, secret basura → 401).

**Dos cosas que estaban rotas *hoy*, sin que se vieran:**

1. **Aviso duplicado al dueño.** Había *dos* webhooks de Chatwoot entregando el mismo `message_created`. El segundo lo creó la auto-reparación cuando abriste `/whatsapp` tras la mudanza anterior. Cada mensaje entrante te llegaba dos veces y ensuciaba la memoria conversacional del doer. Borrado.

2. **Cartel falso a clientes que pagan.** Leila (ws11) y vos (ws1) veían *"El webhook no está activado en este número"* mientras los mensajes entraban perfecto — porque el chequeo compara contra `APP_BASE_URL` y no matcheaba. Ya no.

**La causa raíz, arreglada** ([4446f4c](https://github.com/mbustos-digital/dashboard-marketing/commit/4446f4c)): `webhooksPropios()` comparaba la URL entera con host, así que al mudar de dominio los webhooks viejos dejaban de "ser nuestros" y la reparación **creaba uno nuevo** en vez de actualizar. Ahora compara por path. Sin esto, la próxima mudanza volvía a duplicar.

**Un landmine desactivado**: el PAT de Calendly estaba guardado en `.env.local` bajo el nombre `CALENDLY_WEBHOOK_SIGNING_KEY` (son cosas distintas). Verifiqué que `migrarEnvACredenciales()` copia a la base lo que falte tomándolo de `process.env`, y tu `.env.local` apunta a **producción**: el día que rotaras la signing key, un `npm run dev` habría escrito el PAT a prod y Calendly habría empezado a rechazar todo. Lo separé en `CALENDLY_API_TOKEN` (backup en `.env.local.bak-dominio`, ambos gitignored).

## Lo que necesita tu mano

**1. Lovable — es lo más importante.** El beacon de `multiplicatusresultados.com` tiene todavía `ENDPOINT = 'https://makodigital.app/api/track/vsl'`. Solo sobrevive por la exención del proxy. En `/integraciones` → **Landing / VSL** → **Copiar código**, y reemplazá el `<script>`. El `TOKEN` no cambia.

**2. Google Cloud** (dev): falta `http://localhost:3000/api/integraciones/google-calendar/callback` — sin eso no podés conectar Calendar desde local.

**3. Meta, Fathom, Resend**: ninguno tiene API de lectura de webhooks con las credenciales que hay. Meta está mitigado (el cron recrea el lead en ≤24h); Resend tiene impacto cero (nunca salió un email).

## Calendly: no lo toqué a propósito

Es el único que *podría* hacer por API, pero es el más delicado y **hoy no está roto**. Calendly no permite editar la `callback_url`: hay que borrar y recrear, y eso **emite una signing key nueva** que debe quedar guardada en dos workspaces *antes* de servir — si falla, `verifyCalendlySignature` es fail-closed y el alta de leads por agenda cae a cero, sin poller ni backfill que la salve.

¿Lo hago ahora con vos mirando, o lo dejamos para cuando no haya reuniones agendándose?


---

## Martín

`2026-08-05 12:43`

Hacelo ahora y dame el prompt para lovable

### Claude

Voy con Calendly. Primero entiendo exactamente cómo se valida la firma y quién necesita la key:

### Claude

Detalle clave: la signing key se lee de `process.env` (línea 61), **antes** de resolver el workspace — o sea es una sola key global, no por-workspace. Necesito entender cómo se hidrata antes de rotarla:

### Claude

La signing key se hidrata **una vez por cold start**, así que rotarla tiene una ventana de instancias mixtas. Necesito medir el riesgo real antes de ejecutar:

### Claude

Riesgo acotado: ~1-6 agendas por día, o sea una ventana de minutos es de bajo riesgo. Y confirmo que la key global sale de la fila de ws1. Leo el dispatch del webhook para poder verificar la rotación sin esperar una reunión real:

### Claude

`cripto-credenciales.ts` no tiene el guard de `server-only`, así que puedo cifrar con la función real de la app. Verifico y armo el script:

### Claude

Todo claro. Armo el script de rotación con fases separadas y verificación real:

### Claude

El script necesita resolver `@supabase/supabase-js` desde el repo, así que lo ubico ahí y lo borro al terminar:

### Claude

Necesita un `main()` — tsx compila a CJS acá. Lo reescribo:

### Claude

Funciona. **Paso 1** — creo la suscripción nueva (la vieja sigue viva y entregando, así que no hay ventana sin cobertura):

### Claude

La suscripción se creó, pero **sin `signing_key`**. Eso cambia todo: Calendly acepta que vos le pases la key al crear — la vieja usa una que generamos nosotros. Verifico:

### Claude

Ahí está: **Calendly no genera la key, se la pasás vos al crear.** La suscripción que acabo de crear quedó sin firma (y nuestro receptor es fail-closed, así que la rechazaría). Eso simplifica todo: si recreo pasándole la key que YA tenemos, no hay rotación, ni redeploy, ni ventana de riesgo.

### Claude

Listado eventualmente consistente de Calendly. Verifico el estado real y pruebo la firma end-to-end:

### Claude

La firma valida (200, sin tocar datos) y el control negativo da 401. Pero el listado sigue mostrando un UUID que borré — confirmo el estado real consultando cada uno:

### Claude

Estado real confirmado: la nueva (`d3547087`) está activa **con la key correcta**, y la que creé sin firma quedó borrada. Antes de borrar la vieja, verifico si es seguro dejar las dos conviviendo un rato:

### Claude

El upsert es idempotente (busca por teléfono normalizado y luego por email, y actualiza). Busco evidencia decisiva de que Calendly respeta la `signing_key` que le pasás:

### Claude

Evidencia decisiva: las instrucciones de setup del propio repo ([lib/metodo-catalogo.ts:713](dashboard-marketing/lib/metodo-catalogo.ts:713)) dicen textualmente *"Mandá en el body el campo `signing_key` con un secreto largo elegido por vos"*. Es exactamente el flujo que usé, y la key es la misma que ya estaba. Borro la vieja:

### Claude

El verificador ahora da **401 con "CALENDLY_WEBHOOK_SIGNING_KEY no configurada"** — antes daba 200. Eso significa que hay instancias de producción **sin la key hidratada**. No lo causé yo (no toqué la fila), pero hay que entenderlo:

### Claude

Encontré un bug real y **preexistente**, no causado por la mudanza: `CALENDLY_WEBHOOK_SIGNING_KEY` **no existe como env var en Vercel** — su única fuente es la hidratación desde la base en cada cold start. Y esa hidratación tiene timeout de 4s y falla en silencio:

**3 de cada 10 requests caen en una instancia sin la key → 401.** Calendly reintenta, así que probablemente no perdiste leads, pero es frágil. Lo hago determinístico:

### Claude

Ahora un redeploy para que todas las instancias arranquen con la key desde el entorno:

### Claude

De 7/10 a **12/12**. Limpio los temporales y armo el snippet real para Lovable:

### Claude

Confirmado: línea 222 con el dominio viejo, y el token en la 223 (que **no** se toca). Actualizo la memoria y te dejo el prompt:

### Claude

Calendly migrado. Y en el camino apareció algo más grande.

## Calendly: hecho

`d3547087…` → `hola-mako.com`, la vieja borrada, la de n8n intacta. Verificado con firma real (200 + control negativo 401).

**Resultó mucho más simple de lo que preveíamos, y por una razón que vale la pena saber**: Calendly **no genera** la signing key — se la pasás vos al crear la suscripción. Lo confirmé en las instrucciones del propio repo ([metodo-catalogo.ts:713](dashboard-marketing/lib/metodo-catalogo.ts:713)). Así que recreé la suscripción **pasándole la key que ya estaba guardada**: sin rotación, sin redeploy, sin ventana de riesgo. Todo el plan de "rotar la key en dos workspaces" era innecesario.

De paso descubrí el modo de falla contrario: creé una primero **sin** `signing_key` y Calendly la manda sin firmar → nuestro receptor fail-closed la habría rechazado siempre. Esa la borré.

## El hallazgo grande: no era de la mudanza

Al verificar noté que el mismo ping firmado daba 200 unas veces y **401 "CALENDLY_WEBHOOK_SIGNING_KEY no configurada"** otras. Medí: **3 de cada 10**.

La causa: esa key **no estaba en las env de Vercel**. Su única fuente era `hidratarCredenciales()` en cada cold start, que tiene timeout de 4 segundos y **falla en silencio**. Las instancias donde la hidratación no llegó atendían webhooks sin la key.

Calendly reintenta, así que probablemente no perdiste leads — pero venía siendo una ruleta desde siempre. La cargué también como env var (la base sigue mandando cuando la hidratación funciona; el env es el piso cuando falla) y redeployé. **Ahora 12/12.**

Lo importante: **esto no es exclusivo de Calendly**. Cualquier credencial que viva solo en la base y se lea por `process.env` tiene la misma ruleta. Vale auditar el resto de `ENVS_METODO` — te lo dejo anotado.

## El prompt para Lovable

Verifiqué el HTML en vivo: línea 222 tiene el dominio viejo, línea 223 el token (que **no** se toca).

```
En el archivo index.html, en el bloque <script> de tracking que está antes de </body>,
hay una línea que define la URL a la que se envían los eventos:

      var ENDPOINT = 'https://makodigital.app/api/track/vsl';

Cambiá ÚNICAMENTE esa línea por:

      var ENDPOINT = 'https://hola-mako.com/api/track/vsl';

Es lo único que hay que modificar en todo el proyecto. Cambió el dominio del sistema
que recibe la analítica.

NO modifiques nada más:
- NO toques la línea de abajo, var TOKEN = 'mko_...'. Ese valor identifica la cuenta
  y debe quedar exactamente igual.
- NO reescribas, reordenes ni "mejores" el resto del script de tracking.
- NO cambies ningún otro archivo, estilo ni componente.

Después publicá los cambios.
```

Cuando lo publiques avisame y verifico que entren eventos nuevos (`landing_visits` de ws1). **Ojo con esto**: el beacon hace `fetch(...).catch(){}` y el receptor devuelve 200 aunque descarte — o sea que si sale mal, no vas a ver ni un error. Por eso conviene confirmarlo con datos, no de vista.

## Estado

| | |
|---|---|
| Chatwoot + 4 Evolution | ✅ en `hola-mako.com`, duplicado eliminado |
| Calendly | ✅ migrado, firma verificada |
| Google OAuth | ✅ login funcionando |
| Lovable | ⏳ el prompt de arriba |
| Meta / Fathom / Resend | ⏳ consola web, sin API de lectura |

Todavía **no saqué** `/api/webhooks` ni `/api/track` de las exenciones del proxy — recién cuando Lovable, Meta y Fathom estén confirmados. Mientras tanto no hay apuro: todo sigue funcionando.


---

## Martín

`2026-08-05 14:52`

Ya lo publiqué en Lovable, verificá
Y, quedó algo pendiente?

### Claude

El HTML ya está actualizado y entran eventos. Pero eso solo no prueba que lleguen **por el dominio nuevo** — el viejo sigue exento. Busco cómo distinguirlos:

### Claude

**Decisivo**: la landing se sirve con `Cache-Control: no-cache, must-revalidate, max-age=0`. No hay caché — cada visita revalida y recibe el snippet nuevo. Solo quedan las pestañas ya abiertas, que se drenan solas.

Chequeo final consolidado de todo:

### Claude

Verificado. La línea 222 ya dice `hola-mako.com`, el `TOKEN` intacto, y entran eventos: **26 visitas y 28 eventos de VSL en las últimas 2 horas**, el último hace 4 minutos.

Y encontré la prueba de que no quedan clientes viejos: la landing se sirve con `Cache-Control: no-cache, must-revalidate, max-age=0`, así que **cada visita revalida y recibe el snippet nuevo**. Solo se drenan las pestañas ya abiertas.

## Estado: todo lo automatizable, cerrado

| | |
|---|---|
| Chatwoot | ✅ `hola-mako.com` (+ el de n8n intacto) |
| Evolution ×4 | ✅ `mako_ws1`, `ws3`, `ws11`, `superadmin` |
| Calendly | ✅ una sola suscripción, firma verificada |
| Google OAuth | ✅ login funcionando |
| Landing / tracking | ✅ eventos entrando |

## Sí, queda pendiente

**Tuyo, y ninguno urge:**

1. **Meta Lead Ads** — no pude leer la Callback URL: necesita `META_APP_SECRET`, que está como `sensitive` en Vercel. En `developers.facebook.com` → app *"Leads - Dashboard MKT (Martin)"* → Webhooks → Page → `leadgen`. Si dice un dominio viejo, editala. **Mitigado**: el cron `meta-leads-poll` recrea el lead en ≤24h; solo se pierden los efectos de tiempo real.

2. **Fathom (3 cuentas)** — no existe API de lectura de webhooks (404 en las 4 variantes). Hay que mirar cada consola. Ojo: los de ws9 y ws11 **nunca funcionaron y no es por el dominio** — `FATHOM_WEBHOOK_SECRET` es una clave global única que solo se hidrata de ws1, así que mueren en 401 apunten a donde apunten. Bug aparte.

3. **Google Cloud** (solo dev) — falta `http://localhost:3000/api/integraciones/google-calendar/callback`, sin eso no conectás Calendar desde local.

4. **Resend** — la key es send-only. Impacto cero: nunca salió un email.

**Mío, cuando me digas:**

5. **Sacar `/api/webhooks` y `/api/track` de las exenciones del proxy.** Los webhooks propios ya están todos migrados; falta confirmar Meta y Fathom. `/api/cron` **nunca** se saca: es estructural de Vercel.

6. **Un vigilante del tracking.** Hoy no existe ninguno, y el semáforo de la app **no puede detectar** un apagón porque `landingRecibioEventos` hace un `select … limit 1` sin ventana temporal: con 1955 filas históricas queda verde para siempre. Eso es exactamente por qué el apagón de julio duró 18 días. El motor de avisos ya existe — es cablear un detector, no construir infra.

7. **Auditar el resto de `ENVS_METODO` por el bug de hidratación.** El de Calendly lo arreglé, pero cualquier credencial que viva solo en la base y se lea por `process.env` tiene la misma ruleta del 30%. Es la deuda más importante que dejó esta sesión, y **no tiene nada que ver con la mudanza** — estaba desde antes.

Mi recomendación de orden: **7 primero** (es el que puede estar rompiendo cosas hoy sin que se vea), después 6, y 5 al final.


---

## Martín

`2026-08-05 15:00`

Dale, arrancá por el 7

### Claude

Vamos. Primero junto los datos duros: qué claves están en el catálogo, cuáles tienen piso en Vercel y cuáles viven solo en la base.

### Claude

`tsx -e` sale en silencio; uso un archivo. Junto el catálogo y las filas de la base de una vez:

### Claude

**33 credenciales viven solo en la base, sin piso en Vercel.** Pero eso solo importa si el código las lee por `process.env` (vulnerable) en vez de `credWs()` (lee la base por request, inmune). Eso es lo que hay que trazar. Lanzo el análisis:

### Claude

Anotaciones de TypeScript en el script — va JS plano:

### Claude

Barrido lanzado. El inventario ya dio el primer dato duro:

**33 de las 61 credenciales viven solo en la base, sin piso en Vercel.** Entre ellas todas las de IA (Anthropic, OpenAI, Gemini, Groq…), todo Meta, todo Chatwoot, Fathom, Panda, YouTube y Resend.

Pero eso por sí solo no significa que estén rotas. Lo que decide es **cómo las lee el código**:

- `process.env.X` → vulnerable a la ruleta (depende de que la hidratación haya corrido)
- `credWs('X', ws)` → inmune, lee la fila cifrada en cada request

Eso es lo que están trazando ahora 5 agentes en paralelo, uno por familia (IA, Meta, mensajería, reuniones, media), con un escéptico por hallazgo que intenta refutarlo.

En paralelo puse un agente **solo sobre el mecanismo**, que es donde está la decisión real. Tres preguntas que quiero contestadas antes de tocar nada:

1. **¿Next 16 garantiza que `register()` de instrumentation termina antes del primer request?** Si no lo garantiza, el 30% se explica solo y el fix "agregar env vars" es un parche, no una solución. Le pedí que lo verifique contra la doc en `node_modules`, no de memoria.

2. **¿Cuál es el fix correcto?** Cargar 33 secretos en Vercel duplica cada uno en dos lugares y se van a desincronizar al rotar. Hay alternativas mejores (hidratación bloqueante, lectura perezosa con caché, migrar a `credWs`). Le pedí que tome partido con costos honestos, no que me liste opciones.

3. **¿Hay un bug de multi-tenancy escondido acá?** Si una lib lee `process.env.X` para atender a un **cliente**, no solo sufre la ruleta: estaría usando la credencial del **dueño**. Eso sería más grave que el problema original. La pista más fuerte es `FATHOM_WEBHOOK_SECRET` — una clave global única que solo se hidrata de ws1, lo que explicaría por qué los webhooks de Fathom de Leila y ws9 nunca funcionaron.

Te aviso cuando termine con el diagnóstico y la recomendación.

### Claude

El barrido encontró **daño medido en producción**, no teórico. Leo el informe completo:

### Claude

Informe completo. Antes de actuar, verifico yo mismo la afirmación central — que hay **daño real y permanente** en la base:

### Claude

Confirmado con mis propios ojos. El comentario del cron lo dice literal: `// Ya transcritos (cualquier status) → no reprocesar`. **Esos 9 anuncios no se reintentan nunca.**

Aplico el piso en Vercel, tomando los valores de la base (que es la fuente autoritativa):

### Claude

Las 6 descifran bien desde la fila de ws1. Aplico:

### Claude

Ahora el fix que hace que ese piso **recupere** los 9 anuncios envenenados — sin esto quedan marcados como hechos para siempre:

### Claude

El #7 dio mucho más de lo que buscábamos. Encontré la causa raíz, **daño real en producción**, y un problema de seguridad al lado.

## La causa raíz (verificada en el código compilado, no en la doc)

Next 16 llama `ensureInstrumentationRegistered(...)` **sin `await`** dentro de `prepare()`. La doc de esa misma versión dice que `register` *"must complete before the server is ready to handle requests"* — **la doc dice que sí, el código dice que no**. En `next start` no se nota; **solo muerde en el despliegue por función de Vercel**, que es el nuestro.

Corolario que importa: cualquier arreglo basado en "hacer que la hidratación termine antes" está construido sobre arena. Por eso descarté hacerla bloqueante.

## Daño medido, no teórico

Verifiqué en la base con mis propios ojos: **9 filas de `ad_transcripts` con el error literal `Env var OPENAI_API_KEY no definida`** — 6 de ws1 y 3 de ws3, dos de ellas en la *misma* invocación del cron (la firma de la carrera).

Lo peor no era el fallo, era que **el cron los marcaba como hechos para siempre**. El comentario lo decía literal: `// Ya transcritos (cualquier status) → no reprocesar`. Anuncios con hasta 3.023 de gasto, sin transcript, sin reintento posible, sin una señal.

## Lo que hice

**Piso en Vercel para 6 claves** (`OPENAI_API_KEY`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `FATHOM_WEBHOOK_SECRET`, `PANDA_VSL_VIDEO_IDS`, `YOUTUBE_VSL_VIDEO_ID`), tomando los valores de la base. Verificado que el deploy las lleva.

**Solo 6, no las 33 a propósito**: `migrarEnvACredenciales` hace `if (yaEnBase) continue` y **nunca pisa la base**. Duplicar un secreto se desincroniza en silencio — rotar solo en Vercel no hace nada, y rotar solo en el panel deja el valor viejo activo en cada cold start. Para una signing key revocada eso es justo lo que no querés.

**El cron vuelve a reintentar los `error`** ([7fd8643](https://github.com/mbustos-digital/dashboard-marketing/commit/7fd8643)). Sin esto el piso no recuperaba un solo anuncio. `muy_grande` sigue excluido: ese sí es definitivo.

## Lo que encontré al lado, y es más grave

**Los 5 receptores de webhook verifican la firma con un secreto global, antes de resolver el workspace.** Dos consecuencias:

1. El webhook propio de un cliente da **401 siempre** — no hay un solo call site de `credWs('FATHOM_WEBHOOK_SECRET')` en el repo. Y la UI se lo pinta verde: "Probar conexión" solo pinguea la API key y le confirma que anda.

2. **Vía de escritura cross-tenant en Calendly.** La signing key la elige quien crea la suscripción, y el texto de ayuda de `/integraciones` le dice al cliente que la comparta. Con esa key se pueden **forjar eventos de otro inquilino**: `wsPorIdentificador` acepta el *nombre* del event type, que es público en la página de reservas. Un POST firmado entra en `runWithWorkspace(wsVíctima)` y escribe leads, fechas de junta, dispara CAPI al píxel de la víctima y arranca su nutrición.

No lo probé — la auditoría fue estrictamente de lectura — pero el camino está en el código.

**Mitigación operativa que podés aplicar hoy sin código**: dejá de pedirle a los clientes que creen su propio webhook de Calendly con su propia key. Que las cree la agencia reusando la del dueño; el ruteo por event type ya manda cada evento al workspace correcto.

## Lo que sigue

| Etapa | Qué | Costo |
|---|---|---|
| 1 | Barrera `credencialesListas()` + resolver `envCred()` con fallback a la base | ~4-5 h |
| 2 | **Firma por workspace en los 5 receptores** — cierra la forja cross-tenant | ~3-4 h |
| 3 | `configWs` → `credWs`, y tres silencios más (pausa en lote de Meta, `panda-daily` con `ok:true` mintiendo) | ~2-3 h |

La superficie de la Etapa 1 es chica: ~15 lecturas directas y 2 helpers (`getEnv()` de `meta-ads-create.ts` con 54 usos, y `env()` de `transcribe.ts`) — una función cada uno.

Yo arrancaría por la **2**, no por la 1: la ruleta ya está tapada donde dolía, pero la forja cross-tenant sigue abierta. ¿La hago?


---

## Martín

`2026-08-05 16:23`

Haz absolutamente todo lo que puedas hacer solo, y al final pideme y dime exactamente que debo hacer yo

### Claude

Voy a hacer las tres etapas. Empiezo leyendo los 5 receptores para no romper nada que hoy funciona:

### Claude

Dato clave que acota el trabajo: solo importan los receptores cuyo secreto **lo carga el cliente**. Verifico cuáles:

### Claude

Confirmado, y **acota el trabajo a 2 receptores**: solo Fathom y Calendly usan un secreto que carga el cliente. Los otros tres usan secretos de plataforma que el cliente nunca ve — ahí no hay vector de forja.

Empiezo por la Etapa 1, la barrera:

### Claude

Ahora implemento la barrera y el resolver:

### Claude

Ahora los call-sites. Localizo las lecturas directas de credenciales de plataforma:

### Claude

Y los dos helpers que concentran la mayoría de los usos:

### Claude

Los dos helpers son **síncronos** — volverlos async propagaría `await` por 59 call-sites. Hay una vía mucho más barata: esperar la barrera **una vez** en la entrada de cada flujo, y ahí los helpers síncronos ya encuentran el valor.

### Claude

`meta-ads-create.ts` tiene 30 entradas. Busco si todas pasan por un helper central de fetch, para poner la barrera en un solo lugar:

### Claude

`getEnv()` se llama al armar la URL, antes del fetch — así que la barrera adentro de `graphGet` llegaría tarde. Pero esas dos claves **ya tienen piso en Vercel**, así que ese archivo ya está cubierto. Pongo la barrera donde sí agrega valor:

### Claude

Ahora `transcribe.ts`, que es donde hubo el daño medido:

### Claude

`transcribe.ts` no tiene imports a propósito — el comentario dice que queda **sin `server-only`** para que los scripts lo usen. Importar `credenciales` lo rompería. Uso import dinámico:

### Claude

Ahora la Etapa 2, el fix de seguridad. Empiezo por Fathom:

### Claude

Ahora Calendly, que es donde está el vector de forja:

### Claude

`app/api/plan-fathom/route.ts` tiene errores pero **no lo toqué yo** — es trabajo en curso de otra sesión. Como el hook de pre-push chequea todo el árbol, eso me bloquearía. Verifico si mis archivos están limpios:

### Claude

Los errores de `plan-fathom` ya se resolvieron; ahora hay otro en `SimuladorWhatsApp.tsx`, tampoco mío — la otra sesión está editando en vivo. **Mis archivos están limpios.** Sigo con la Etapa 3:

### Claude

Ahora los dos silencios restantes — la pausa en lote de Meta y el cron que miente:

### Claude

Mis archivos están limpios; los errores restantes (`app/crm/actions.ts`, `lib/leads.ts`) son de la otra sesión. Commiteo lo mío y mando el cambio de seguridad a revisión adversarial antes de pushear:

### Claude

Mientras corre la review, verifico por mi cuenta el riesgo #1 del cambio — que el secreto guardado coincida con el del entorno. Si difieren, esto rompe producción:

### Claude

Datos decisivos:

- **Fathom**: `ws1` coincide exactamente con el entorno → **no rompe nada**. Y ws9 y ws11 tienen secretos **propios y distintos** (`whse…gkm9`, `whse…+TlO`) que hasta ahora no se leían nunca. El fix les activa el webhook por primera vez.
- **Calendly**: ws1 y ws3 **comparten la misma key** → entre esos dos la forja sigue abierta hasta que tengan keys distintas.

### Claude

Typecheck limpio — la otra sesión terminó. Pusheo:

### Claude

Deploy listo. Verifico en vivo que los webhooks siguen funcionando y que la firma por workspace opera:

### Claude

El request basura ahora devuelve **200 en vez de 401**. Eso es un oráculo de enumeración que introduje yo. Lo confirmo con un email que sí existe:

### Claude

Confirmado: **401 = ese email está dado de alta, 200 = no**. Es un oráculo para enumerar qué clientes existen, y lo introduje yo al mover la resolución antes de la firma. Lo cierro verificando la firma también en el camino "sin workspace":

### Claude

Oráculo cerrado — ambos dan 401. Ahora la verificación crítica: que un evento **legítimo** de Calendly siga entrando:

### Claude

La review adversarial sigue corriendo. Mientras tanto actualizo la memoria con todo lo hecho:

### Claude

Todo verificado en vivo. La review adversarial del cambio de seguridad sigue corriendo; te aviso si encuentra algo.

## Lo que hice (todo pusheado y verificado en producción)

**El bug de raíz, confirmado en el código compilado.** Next 16 llama `ensureInstrumentationRegistered()` **sin `await`**. La doc de esa misma versión dice lo contrario — gana el código. Por eso la hidratación de credenciales no está garantizada cuando entra un request.

**Etapa 1 — la barrera.** `credencialesListas()` memoiza la promesa de hidratación; `envCred()` la espera y, si igual no quedó el valor, lo resuelve contra la base y deja un warn con el nombre de la clave. En el camino feliz es una promesa ya resuelta: cero latencia. Enchufada donde hubo daño.

**Etapa 2 — firma por workspace.** Acoté el trabajo verificando cuáles secretos los carga el cliente: **solo Fathom y Calendly**. Los otros tres usan secretos de plataforma que el cliente nunca ve, así que ahí no había vector de forja.

Antes de tocar nada verifiqué el riesgo #1 — que el valor guardado coincidiera con el del entorno:

```
ws1: whse…vSlT   entorno: whse…vSlT   →  idénticos, no rompe
ws9: whse…gkm9   ws11: whse…+TlO      →  secretos PROPIOS que nunca se leían
```

Ese segundo dato confirma el bug: Leila (ws11) y ws9 tenían su `whsec_` cargado y su webhook devolvía 401 **siempre**, con la UI en verde. Ahora funciona por primera vez.

**Me equivoqué en el primer intento y lo cacé al verificar.** Mover la resolución de workspace antes de la firma hizo que el código de respuesta delatara quién está dado de alta: `hola@leilafittipaldi.com` → 401, un email inventado → 200. Un oráculo para enumerar tu cartera de clientes sin credencial ninguna. Lo cerré en un segundo commit: ahora la firma se verifica siempre y ambos dan 401.

**Etapa 3.** `configWs` ahora consulta los dos almacenes (era el bug determinista de ws3: verde en `/metodo`, cero ingesta todos los días). Más el toast de la pausa en lote de campañas y `panda-daily` que ya no responde `ok:true` cuando no ingestó nada.

**Los 9 anuncios envenenados** se recuperan solos mañana a las 14:00 UTC, cuando corra el cron con el fix de reintento.

---

# Lo que tenés que hacer vos

**1. Meta Lead Ads** — lo único que no pude ni leer (necesita `META_APP_SECRET`, que está como `sensitive` en Vercel).

`developers.facebook.com` → app **"Leads - Dashboard MKT (Martin)"** (`954456647632371`) → **Webhooks** → objeto **Page** → campo `leadgen` → verificá la Callback URL. Si dice un dominio viejo, cambiala a:
```
https://hola-mako.com/api/webhooks/meta-leads
```
El Verify Token no se toca.

**2. Fathom — las 3 cuentas.** No hay API de lectura de webhooks (404 en las 4 variantes que probé). En la consola de cada una (`mbustos@elevate.com.mx`, `martinkoncke@gmail.com`, `hola@leilafittipaldi.com`), la URL debe ser:
```
https://hola-mako.com/api/webhooks/fathom
```

**3. Google Cloud** — solo afecta desarrollo local. Agregá:
```
http://localhost:3000/api/integraciones/google-calendar/callback
```

**4. Calendly: dale a cada cliente su propia signing key.** Hoy ws1 y ws3 **comparten la misma**, así que entre esos dos la forja sigue abierta. Con el código nuevo, en cuanto un workspace tenga la suya, queda cerrado para él.

Y cambiá la instrucción operativa: **dejá de pedirle al cliente que comparta su signing key**. Que la agencia cree las suscripciones; el ruteo por event type ya manda cada evento al workspace correcto.

**5. Opcionales, impacto cero hoy**: Resend (nunca salió un email) y verificar `multiplicatusresultados.com` en Meta Business (preexistente, no lo trajo la mudanza).

---

**Decisión que te dejo a vos**: sacar `/api/webhooks` y `/api/track` de las exenciones del proxy. No lo hice porque depende de que confirmes los puntos 1 y 2 — sacarlas antes silencia Meta y Fathom sin un solo error visible. `/api/cron` **nunca** se saca: es estructural de Vercel.

**Para confirmar que Fathom quedó bien** una vez que revises las consolas, decime y verifico con datos si entran eventos de ws9 y ws11 por primera vez.

### Claude

La review encontró 3 defectos reales — uno lo introduje yo y dispara mañana. Verifico cada uno antes de arreglar:

### Claude

Los tres confirmados. El más grave lo introduje yo: `PANDA_VSL_VIDEO_IDS` es **opcional**, así que ws9 hace que el cron responda 500 todos los días — la alarma nacería sonando. Y el cron hermano usa `todoFallo ? 500 : 200`:

### Claude

Ahora el `JSON.parse('null')` y la memo que no deduplica entre capas de Turbopack:

### Claude

El 401 es porque mi `CRON_SECRET` local difiere del de producción. Lo traigo de Vercel para probar el fix del cron:

### Claude

No se puede leer (`sensitive`), así que el cron no lo puedo invocar a mano — corre solo a las 13:45 UTC. Pero el dato que importa ya lo tengo: ws9 tiene `PANDA_API_KEY` pero **no** `PANDA_VSL_VIDEO_IDS`, que es exactamente la rama `omitido`.

Verifico el punto que la review corrigió sobre Calendly, porque cambia lo que te dije:

### Claude

Esto corrige lo que te dije antes, y es importante:

### Claude

Listo todo lo que podía hacer solo. La review adversarial encontró **3 defectos reales** en mi propio cambio — los arreglé y verifiqué en producción.

## Lo que la review cazó

**Uno lo introduje yo y disparaba mañana.** `panda-daily` iba a responder **500 todos los días**: `PANDA_VSL_VIDEO_IDS` está marcado `opcional` en el catálogo, pero `integracionConectada('panda')` solo exige la API key — así que ws9 entra legítimamente sin videos y mi código lo contaba como error. La alarma que puse para recuperar una señal habría nacido sonando, saturando justo lo que venía a arreglar. Ahora ese caso es `omitido` y el 500 sigue la convención de los crons hermanos.

**`curl -d 'null'`** tiraba 500 sin autenticar en los dos webhooks: `JSON.parse('null')` no lanza, devuelve `null`, y el optional chaining protege el segundo nivel pero no el primero. Antes era inalcanzable porque la firma mataba el request; al mover el parseo adelante quedó expuesto. Verificado: ahora da 400.

**La memo de la barrera se duplicaba siempre.** Turbopack emite una copia de `lib/credenciales.ts` por capa, así que una variable de módulo daba una memo por capa: el primer `envCred()` de cada route arrancaba una **segunda hidratación completa dentro del request** — exactamente el trabajo que la barrera venía a evitar, y mi comentario que decía "cero latencia" era falso. Va en `globalThis`, igual que `hidratadas` tres líneas más arriba, que ya usaba ese patrón por el mismo motivo.

## Una corrección a lo que te dije antes

Te dije que la forja de Calendly seguía abierta *entre ws1 y ws3*. Lo verifiqué mejor y es más matizado, en el buen sentido:

- `webhook_routing` **solo tiene filas de Calendly para ws1**. Hoy no hay superficie cross-tenant: un evento de Calendly solo puede llegar a ws1.
- La key "propia" de ws1 la escribió `migracion-env` — o sea, **es** el valor de plataforma.

Traducido: **el vector es latente, no vivo.** Se vuelve real el día que conectes un segundo cliente a Calendly. El refactor lo deja listo para cerrarse; no cierra nada por sí solo.

**Fathom sí quedó cerrado de verdad**: ws9 y ws11 tienen ruteo propio *y* secretos propios distintos.

---

# Lo que tenés que hacer vos

**1. Meta Lead Ads** — no lo puedo ni leer (`META_APP_SECRET` es `sensitive` en Vercel).
`developers.facebook.com` → app **"Leads - Dashboard MKT (Martin)"** (`954456647632371`) → **Webhooks** → objeto **Page** → campo `leadgen`. Si la Callback URL dice un dominio viejo:
```
https://hola-mako.com/api/webhooks/meta-leads
```

**2. Fathom, las 3 cuentas** — no hay API de lectura (404 en las 4 variantes). En cada consola (`mbustos@elevate.com.mx`, `martinkoncke@gmail.com`, `hola@leilafittipaldi.com`):
```
https://hola-mako.com/api/webhooks/fathom
```
Esta es la que más rinde: ws9 y ws11 tienen su secreto propio cargado y **nunca les funcionó el webhook**. Con el fix desplegado, en cuanto la URL apunte bien, empiezan a entrar por primera vez.

**3. Google Cloud** (solo dev local):
```
http://localhost:3000/api/integraciones/google-calendar/callback
```

**4. Cuando conectes un segundo cliente a Calendly** — dale su **propia** signing key, no la de la agencia. Y cambiá el texto de ayuda de `/integraciones`, que hoy le pide al cliente que la comparta.

---

**Dos cosas que no pude verificar y te las digo en vez de maquillarlas:**

- **El cron de Panda no lo pude invocar**: `CRON_SECRET` es `sensitive` en Vercel y no se puede leer. La lógica está verificada por tipos y por datos (ws9 tiene API key sin video ids = la rama `omitido`), pero la prueba real es la corrida de mañana 13:45 UTC. Si querés, mañana lo chequeo.
- **Los 9 anuncios envenenados** se recuperan solos en la corrida de las 14:00 UTC.

**Decisión tuya**: sacar `/api/webhooks` y `/api/track` de las exenciones del proxy. Depende de los puntos 1 y 2 — sacarlas antes silencia Meta y Fathom sin un solo error visible. `/api/cron` nunca se saca.


---

## Martín

`2026-08-05 18:47`

1. Para lo primero tienes las variables en el env local.
2. No entiendo que necesitas de la 2 de fathom, no está en el env local?
3. Donde agrego eso de google claude?
4. No entiendo lo de Calednly, que queres que haga?
5. Lo de Resend deberíamos cambiar el email para super admin al correo de MaKo, pero no entiendo lo que vos me pediste.
6. Hoy si ya estoy logeado y me voy a la ruta de login, me debería avisar y redirigir automáticamente dentro del workspace en la tab general para los usuarios, en la tab admin para super admin.

### Claude

Voy uno por uno. Primero verifico lo que decís del env, porque cambia lo que hace falta:

### Claude

Confirmado — y esto cambia dos de tus puntos:

### Claude

Ambos confirmados, y **te ahorran trabajo**:

### Claude

Ahora implemento tu punto 6. La lógica de "a dónde va cada rol" ya existe en `/inicio`, así que no la duplico:

### Claude

Ahora lo implemento:

### Claude

Necesito verificar cómo responde el logout antes de dejar ese form — si devuelve JSON, un POST de formulario dejaría al usuario mirando texto plano:

### Claude

Confirmado: devuelve JSON. Un form nativo dejaría al usuario mirando `{"ok":true}`. Lo hago como el sidebar:

### Claude

`/login` ahora es dinámica, como debe ser para leer la cookie. Pusheo:

### Claude

Verifiqué todo lo que preguntaste. **Dos de las cosas que te pedí, te las pedí de más** — te las saco.

## 1. Meta — no, no está en el env

Chequeé: en `.env.local` están `META_ACCESS_TOKEN` y `META_PAGE_ID`, pero **`META_APP_SECRET` no**. Y en Vercel está como `sensitive`, que no se puede leer de vuelta ni con `?decrypt=true`. Ese es justo el que pide la Graph API para listar los webhooks de la app.

Dos caminos, elegí:
- **Pegámelo** (Configuración → Básica en developers.facebook.com) y lo leo yo por API — y de paso queda auditable para siempre.
- O lo mirás vos: app **"Leads - Dashboard MKT (Martin)"** → **Webhooks** → objeto **Page** → campo `leadgen`.

## 2. Fathom — no necesitás hacer nada. Me equivoqué al pedírtelo

Dos cosas que verifiqué:

- Las credenciales **sí están**, tenías razón. El problema nunca fue ese: **Fathom no tiene endpoint para leer webhooks**. Probé 5 variantes, todas 404, mientras `/meetings` da 200 — o sea la key es válida y el endpoint no existe.
- Y lo más importante: probé los tres dominios y **los tres responden igual**. Como `/api/webhooks` está exenta del 410 de mudanza, un webhook de Fathom apuntando al dominio viejo **igual llega**.

Traducido: la URL de Fathom no está bloqueando nada. Lo que tenía roto a ws9 y ws11 era el secreto global, y eso **ya está arreglado y desplegado**. La URL solo importa el día que saquemos las exenciones.

## 3. Google — dónde exactamente

`console.cloud.google.com` → **APIs y servicios** → **Credenciales** → clic en el cliente OAuth `118392241323-j98eq…` → sección **"URIs de redireccionamiento autorizadas"** → **+ Agregar URI**:

```
http://localhost:3000/api/integraciones/google-calendar/callback
```

Guardar. Solo afecta a conectar Google Calendar desde `npm run dev`; producción ya funciona.

## 4. Calendly — tampoco. Otra que te pedí de más

Lo verifiqué mejor después de escribirte: `webhook_routing` **solo tiene filas de Calendly para ws1**. No hay ningún cliente recibiendo eventos de Calendly, así que **no hay superficie cross-tenant hoy**. El vector es latente.

Es una nota para el futuro: el día que conectes un segundo cliente a Calendly, dale **su propia** signing key en vez de la de la agencia. Nada que hacer ahora.

## 5. Resend — no te pedí nada, estaba en la lista solo por completitud

Su impacto es cero: nunca salió un email. Perdón por la confusión.

**Tu pedido sí es real y es otra cosa.** Miré cómo está hoy:

```
app_settings.resend_from (ws1) = MaKo <hola@multiplicatusresultados.com>
```

O sea el remitente ya dice MaKo, pero está en el **dominio viejo de la landing**. Para moverlo a `@hola-mako.com` hace falta verificar ese dominio en Resend (DKIM + SPF).

Ahí hay una traba que no puedo saltar solo: **tu key de Resend es send-only** (401 en `/domains`, `/api-keys` y `/emails`), así que no puedo dar de alta el dominio por API. Necesito una de estas dos:
- Agregás `hola-mako.com` en el panel de Resend, me pasás los registros DNS que te da, y **yo los cargo en Porkbun**.
- O me das una key con permisos de dominio y hago todo.

⚠️ **Ojo con un detalle**: `hola-mako.com` ya tiene SPF para el reenvío de correo de Porkbun. **No se pueden tener dos registros SPF** — hay que fusionarlos en uno solo, no agregar el de Resend aparte. Si lo hacés vos sin eso, se rompe el mail del dominio. Cuando llegue el momento lo armo yo.

## 6. Hecho y desplegado

Abrir `/login` con la sesión abierta ahora te dice **"Ya tenés la sesión abierta como \<vos\>"** y te lleva solo a los 1.2 segundos, con un botón para ir ya.

El destino es `/inicio`, no una ruta fija: ahí vive el repartidor por rol que ya teníamos (super admin sin impersonar → `/admin`, closer/setter → `/crm`, onboarding pendiente → `/onboarding`, el resto → `/general`). Duplicar esa lógica en el login la habría dejado desincronizada al primer cambio.

Le dejé salida **"Entrar con otra cuenta"** — sin eso, alguien logueado no tenía forma de llegar al botón de Google. Es un botón con `fetch` y no un formulario, porque `/api/auth/logout` devuelve JSON y no redirige: un form nativo te dejaba mirando `{"ok":true}`. Y el temporizador se cancela si tocás esa salida, para no arrastrarte al tablero justo cuando pediste cambiar de cuenta.

Verificado en producción que sin sesión sigue mostrando el botón de Google normal.

---

**Neto: de los 5 puntos que te había pedido, quedan 2** — el App Secret de Meta (si querés que lo verifique yo) y la URI de Google para desarrollo local.


---

## Martín

`2026-08-05 20:22`

1. Aquí te paso la clave de la app, guardala en el env y dime si sirve: 81fd08db85eead45c6ebaac951477588
2. Listo lo de Google.
3. Te dejo la API de Resend, guardalo en el env local y haz todo: [CREDENCIAL REDACTADA · Resend]

### Claude

Guardo las dos y las pruebo.

### Claude

**Sirve.** Y respondió la pregunta que llevábamos abierta: la Callback URL de Lead Ads apunta al **dominio original**. Intento cambiarla por API:

### Claude

El `verify_token` también es `sensitive`. Pero no necesito el viejo: puedo poner uno nuevo yo mismo. Primero resuelvo Resend para hacer un solo redeploy:

### Claude

La key nueva tiene permisos completos. Guardo ambas y doy de alta el dominio:

### Claude

Tope del plan: **Resend incluye 1 dominio** y ya está ocupado por `multiplicatusresultados.com`. Antes de proponerte nada, verifico si ese dominio se usa de verdad:

### Claude

Cero emails enviados jamás. Ahora resuelvo Meta, que no tiene ambigüedad: genero un `verify_token` nuevo (no necesito el viejo) y lo dejo en Vercel:

### Claude

El token quedó en Vercel. Lo leo de vuelta (ahora es `encrypted`, no `sensitive`) y lo guardo local:

### Claude

Ahora el redeploy para que producción conozca el token nuevo, y recién después doy de alta la suscripción en Meta:

### Claude

El handshake responde correcto. Ahora doy de alta la suscripción en Meta:

### Claude

**Meta Lead Ads migrado y confirmado.** Verifico que la página siga suscrita a la app:

### Claude

La cadena completa de Lead Ads quedó verificada punta a punta. Actualizo memoria y te pregunto lo de Resend, que sí tiene una decisión que no me corresponde:

### Claude

Dale. Borro el viejo, doy de alta `hola-mako.com` y cargo los DNS en Porkbun:

### Claude

Dato importante: **Resend usa el subdominio `send`, no el apex** — así que no hay conflicto de SPF con el reenvío que ya tenés. Mi advertencia anterior no aplica. Cargo los tres registros:

### Claude

Confirmado: el SPF y los MX de Porkbun están en el **apex**, y Resend pide todo bajo `send`. No se pisan. Cargo:

### Claude

**Dominio verificado.** Ahora dejo el remitente apuntando ahí:

### Claude

El remitente apunta al dominio que acabo de dar de baja — si lo dejo así, el email queda roto. Lo actualizo:

### Claude

Falta un detalle: producción lee `RESEND_API_KEY` de la base, no del `.env.local`. Verifico si la key vieja sigue viva:

### Claude

Dos keys distintas: la de producción es **`Onboarding`, send-only**; la que me diste es **`MaKo`, con permisos completos**. Dejo producción en la send-only a propósito — menor privilegio, la app solo necesita enviar. Verifico el estado final:

### Claude

Los tres, hechos.

## 1. Meta — la clave sirve, y resolvió el punto que llevábamos abierto

Guardada en `.env.local`. Con ella pude leer por fin la config de webhooks, y confirmó la sospecha:

```
callback_url: https://dashboard-marketing-six.vercel.app/api/webhooks/meta-leads
```

El dominio **original**, dos mudanzas atrás.

**Ya lo cambié, sin entrar a la consola.** El `verify_token` también era `sensitive` e ilegible, pero no hacía falta el viejo: generé uno nuevo, lo puse en Vercel, redeployé, probé el handshake (`hub.challenge` → 200 devolviendo el challenge; token inválido → 403 de control) y recién ahí hice el POST. Verificado releyendo:

```
callback_url: https://hola-mako.com/api/webhooks/meta-leads  ·  activo: True  ·  campos: [leadgen]
página 282881742134130 → suscrita a la app
```

Rotar ese token no afecta nada en curso: solo se usa en el alta, la entrega va firmada con el App Secret.

## 2. Google — anotado, gracias

## 3. Resend — hecho, con una decisión que te consulté y dos hallazgos

**Tu key nueva tiene permisos completos** (la vieja daba 401 en todo lo que no fuera enviar). Con eso pude hacer el resto.

Cambié el dominio como elegiste: borré `multiplicatusresultados.com`, di de alta `hola-mako.com`, cargué los 3 registros en Porkbun y **quedó `verified`** en menos de un minuto.

**Me equivoqué en la advertencia que te di antes**: te dije que había que fusionar el SPF con el del reenvío de Porkbun. No hace falta — **Resend pide todo bajo el subdominio `send`**, y el SPF y los MX de Porkbun viven en el apex. No se pisan.

**Dejé producción en la key vieja a propósito.** Hay dos:
- `Onboarding` — send-only, es la que usa producción. La verifiqué: sigue autenticando.
- `MaKo` — la que me diste, permisos completos, solo en `.env.local` para tareas de administración.

Menor privilegio: la app solo necesita enviar, no administrar la cuenta.

Y moví el remitente, que si no quedaba roto (apuntaba al dominio que acababa de dar de baja):

```
MaKo <hola@multiplicatusresultados.com>  →  MaKo <hola@hola-mako.com>
```

Si preferís otra dirección (`mako@`, `no-reply@`), es cambiar una línea.

---

## Lo que queda pendiente, y ahora es corto

**`EMAIL_SEND_ENABLED = 'false'` en Vercel.** La cadena de email está completa y verificada, pero no sale ni un mail hasta que lo prendas. No es un olvido mío: es tu decisión de go-live. Decime y lo prendo.

**No mandé un email de prueba** — enviar correo en tu nombre es algo que prefiero no hacer sin que me lo pidas. Si querés, mando uno a `mbustos@elevate.com.mx` y confirmamos la entrega real.

**Fathom (3 consolas)** sigue siendo lo único que necesita tu mano, y no urge: probé los tres dominios y todos llegan al receptor, porque `/api/webhooks` está exenta. Solo importa antes de sacar esa exención.

**Dejé dos backups del env** por si algo salió mal: `.env.local.bak-dominio` y `.env.local.bak2` (ambos gitignored). Si en unos días todo anda, se pueden borrar.


---

## Martín

`2026-08-05 20:38`

Listo, ya está en true email send en vercel, pruebalo y enviame a mi correo de martinkoncke@gmail.com las pruebas. Y también termina todo lo pendiente y dime exactamente las cosas que aún necesitas de mi, con el paso de como hacerlo

### Claude

Verifico el flag y si el deploy actual ya lo tiene:

### Claude

Ya lo tiene (el deploy es 20 segundos posterior al cambio). Busco si la app tiene un camino propio de prueba, para probar la cadena real y no solo la API:

### Claude

`server-only` bloquea el import en un script. Lo neutralizo con un shim de módulo:

### Claude

**Enviado.** Verifico que Resend lo haya entregado de verdad, no solo aceptado:

### Claude

Entregado en Gmail. Mando una segunda que prueba lo que la primera no: el **link de baja**, que se arma con `APP_BASE_URL` y es donde se vería si quedó un dominio viejo:

### Claude

Las dos entregadas y el link de baja responde. Ahora termino los pendientes de código. El primero: `youtube-daily` tiene exactamente la misma mentira que `panda-daily`:

### Claude

Ahora el vigilante del tracking. Primero el semáforo que queda verde para siempre:

### Claude

Ahora el detalle que muestra el semáforo, para que no diga "conectada" con datos viejos:

### Claude

Ahora el vigilante que avisa. Miro cómo se emite un aviso y si ya existe uno en el catálogo:

### Claude

El repo tiene una skill específica para crear crons con el auth y la iteración multi-tenant correctos. La uso:


---

## Martín

`2026-08-05 20:44`

Base directory for this skill: C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\.claude\skills\add-cron-job

# Agregar un cron job

Un cron son DOS cosas: un route handler bajo `app/api/cron/<nombre>/route.ts` y una
entrada en `vercel.json`. Vercel pega el endpoint según el schedule, firmado con
`Authorization: Bearer ${CRON_SECRET}`.

## El route handler

```ts
import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrPorWorkspace } from '@/lib/cron-workspaces';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // rutas pesadas (ingesta/IA). Default 60 si es liviano.

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);   // NO redeclarar un checkAuth local
  if (denied) return denied;

  const resultados = await correrPorWorkspace('meta', async (ws) => {
    // … el trabajo. Adentro, getTenantDb()/credWs()/getSetting() ya scopean a `ws`.
    return { procesados: 0 };
  });

  const algunoOk = resultados.some((r) => r.ok);
  return Response.json({ ok: algunoOk, resultados }, { status: algunoOk ? 200 : 500 });
}
```

## Reglas

- **Usá `checkCronAuth` de `lib/cron-auth.ts`** — NO copies un `checkAuth` local (hay
  9 rutas que lo duplican byte a byte; no sumes la 10ª). Fail-closed: sin
  `CRON_SECRET` en env → 500; Bearer que no matchea → 401.
- **Ingesta por-cliente → envolvé en `correrPorWorkspace('<servicio>', fn)`**
  (`lib/cron-workspaces.ts`): itera los workspaces ACTIVOS con la integración
  `<servicio>` conectada, cada uno dentro de `runWithWorkspace(ws)`. El string
  `<servicio>` debe ser una key de `metodo-catalogo`/`integraciones` (ej. `'meta'`,
  `'fathom'`, `'panda'`). Un workspace que falla NO corta a los demás.
- **Config por-workspace** con `configWs('clave', process.env.FALLBACK)`: cae al env
  global SOLO para el dueño; para un cliente sin la setting devuelve `null`
  (fail-closed — jamás ingesta el video/página de Mauricio en otro negocio).
- **Devolvé 500 si TODOS los workspaces fallan** (que el monitoreo del cron lo vea);
  200 si al menos uno anduvo.
- **Timeout de fetch externos**: `AbortSignal.timeout(ms)` para no colgar la función
  hasta `maxDuration` si una API remota no responde.

## Registrar en vercel.json

Agregá `{ "path": "/api/cron/<nombre>", "schedule": "<cron UTC>" }` al array `crons`.
Los schedules son **UTC** (local Tijuana ≈ UTC-7, o sea 13:00 UTC ≈ 6am). **Escaloná
el minuto** contra los jobs existentes para no dispararlos todos juntos (mirá los
minutos ya usados: :00, :10, :15, :20, :30, :45). Rango horario ej.
`"0 15-23 * * *"` (cada hora en ventana), semanal `"20 14 * * 1"` (lunes).

## Verificar

`npx tsc --noEmit` para tipos. En local no hay claves de Supabase (no corre data),
así que el chequeo práctico es el typecheck + revisar que el `<servicio>` sea una
key real. Relacionado: `lib/cron-auth.ts`, `lib/cron-workspaces.ts`
(correrPorWorkspace/configWs), skill `tenant-safe-query`, `vercel.json`.


ARGUMENTS: Vigilante del tracking de la landing: por cada workspace con landing_token acuñado, chequear si hay filas nuevas en landing_visits en las últimas 24-48h; si no, emitir un aviso. Antecedente: hubo un apagón de 18 días que nadie detectó.

### Claude

Ojo con una trampa acá: `correrPorWorkspace` filtra por integración conectada, y acabo de hacer que "landing conectada" dependa de que haya eventos recientes. Sería circular — el workspace con el tracking muerto quedaría excluido y nunca se avisaría. Verifico:

### Claude

Confirmado: `integracionConectada('landing')` sería circular **y** además 'landing' no está en `metodo-catalogo`, así que devolvería false para todos. Itero por `landing_token`, que es la señal durable. Primero el aviso en el catálogo:

### Claude

Uso `:50` de la hora 13, que está libre (los ocupados son :00, :15, :30, :40, :45):

### Claude

Error transitorio: la otra sesión borró un archivo suyo en medio del chequeo. Reintento:

### Claude

El build pasó y la ruta existe (`ƒ /api/cron/tracking-vigilante`). El error de typecheck es de `landing-writer.ts`, de la otra sesión. Verifico el estado actual:

### Claude

El otro chat avanzó fuerte sobre el tracking en paralelo. Mi constante quedó insertada **entre el JSDoc y la función**, rompiendo la asociación. Lo acomodo:

### Claude

El typecheck se está haciendo lento porque la otra sesión corre builds en paralelo. Mientras termina, preparo el commit:

### Claude

El único error que bloquea es de `lib/landing-writer.ts`, **archivo de la otra sesión**. Mi commit ya está hecho; solo el push está frenado. Miro qué es:

### Claude

Las líneas se están moviendo entre corridas — la otra sesión está editando ese archivo **ahora mismo**. No lo toco: arreglarlo le pisaría el trabajo en curso. Reintento el push:

### Claude

Pasó — arreglaron su archivo entre medio. Espero el deploy y verifico el cron nuevo:

### Claude

Listo todo. Te llegaron **dos emails a martinkoncke@gmail.com**, ambos con estado `delivered` confirmado por la API de Resend:

| | |
|---|---|
| *MaKo — prueba de envío desde hola-mako.com* | remitente, DKIM y SPF |
| *MaKo — prueba 2: formato de nutrición y link de baja* | el link de baja, que se arma con `APP_BASE_URL` |

Las mandé por el camino real de la app (`sendEmail`), no con un curl a Resend — eso habría probado Resend, no MaKo. El remitente resolvió `MaKo <hola@hola-mako.com>`, `emailConectado: true`, sandbox `false`.

La segunda prueba algo que la primera no: el **link de baja** salió `https://hola-mako.com/api/email/unsubscribe?...` y responde 200. Ese link es donde se habría visto si quedaba un dominio viejo escondido en la cadena. Usa un lead inexistente a propósito: podés tocarlo sin dar de baja a nadie.

## Lo que terminé además

**El vigilante del tracking** — cron nuevo (`50 13 * * *`), registrado en Vercel y protegido (401 sin auth). Por cada workspace con tracking configurado, avisa si no entran visitas hace más de 48h.

Encontré una trampa al construirlo: la forma "natural" (`correrPorWorkspace('landing', …)`) era **circular** — ese helper filtra por integración conectada, y "landing conectada" se define justamente como "hay eventos recientes". El workspace con el tracking muerto habría quedado excluido y **jamás se habría avisado**. Itera por `landing_token`, que es la señal durable.

**El semáforo dejó de mentir.** `landingRecibioEventos()` preguntaba *"¿llegó algo alguna vez?"* sobre toda la historia. Con 1955 filas viejas, ws1 quedaba en verde para siempre: **no podía detectar el apagón de 18 días por construcción**. Ahora mira una ventana de 3 días y el texto distingue "nunca pegaste el código" de "dejó de llegar".

**`youtube-daily`** dejó de responder `ok:true` sin haber ingestado nada, igual que `panda-daily`.

---

# Lo que necesito de vos

Queda **una sola cosa**, y no urge:

## Fathom — revisar 3 consolas

**Por qué**: Fathom no tiene API para leer la config de webhooks (probé 5 endpoints, todos 404). Es lo único que no pude verificar solo.

**Por qué no urge**: probé los tres dominios y **todos llegan al receptor**, porque `/api/webhooks` está exenta del cartel de mudanza. Así que aunque apunten al dominio viejo, funcionan.

**Los pasos**: en `fathom.video`, con cada una de estas cuentas:
- `mbustos@elevate.com.mx`
- `martinkoncke@gmail.com`
- `hola@leilafittipaldi.com`

Settings → Integrations/Webhooks → que la URL diga:
```
https://hola-mako.com/api/webhooks/fathom
```

**Decime cuál de las tres tenía qué URL** y con eso cierro el último paso: sacar `/api/webhooks` y `/api/track` de las exenciones del proxy, que es lo que mata de verdad los dominios viejos. Sin ese dato no lo hago, porque sacarlas antes silenciaría Fathom sin un solo error visible.

*(`/api/cron` no se saca nunca: Vercel invoca los crons contra la URL del deploy, no contra el dominio. Es estructural.)*

---

**Dos notas menores:**

Dejé la key `MaKo` de Resend (permisos completos) solo en `.env.local`; producción sigue con la `Onboarding`, send-only. Es a propósito: la app solo necesita enviar.

Y los backups `.env.local.bak-dominio` y `.env.local.bak2` se pueden borrar cuando estés tranquilo de que todo anda.

### Claude

Ese chequeo en segundo plano confirma lo que ya sabíamos: **cero errores de tipos en mis archivos** (`landing-token`, `integraciones`, `tracking-vigilante`, `avisos-catalogo`, `youtube-daily`). Quedó pendiente solo porque la otra sesión corría builds en paralelo y lo hizo lento; el push ya pasó el hook completo igual.

No cambia nada de lo anterior. Todo sigue en pie:

- Los dos emails de prueba, entregados en tu Gmail.
- El vigilante del tracking desplegado y registrado.
- El semáforo de la landing con ventana real.

Lo único que espero de vos sigue siendo **las 3 consolas de Fathom** — decime qué URL tenía cada cuenta y con eso saco `/api/webhooks` y `/api/track` de las exenciones, que es el paso que mata de verdad los dominios viejos.


---

## Martín

`2026-08-05 22:22`

No me gusta que el dominio sea "hola@hola" no queda bien, revisa otras opciones...

1. Webhook Secret de Martin: whsec_uA6YFktGKVMVMnBRPVLdrohhSGlbgkm9
2. Te paso screenshot de lo que hizo... Dime si de última le pedimos el Webhook Secret a la hora de conectar Fathom en integraciones a todos los usuarios... Pero me parece poco intuitivo tener que estar pidiendoles que pongan la url de MaKo allí, es 100% necesario?

### Claude

Dos cosas distintas. Primero verifico lo técnico, que cambia la respuesta a tu pregunta:

### Claude

El secreto que pasaste es el de **ws9 (`martinkoncke@gmail.com`), tu cuenta**, y ya estaba guardado correcto. La captura muestra que esa cuenta ya apunta a `hola-mako.com`. Nada que guardar.

Ahora tu pregunta de fondo — verifico qué pasa realmente sin webhook:

### Claude

Datos concretos para tu pregunta. Reviso cómo se le pide hoy al cliente:

### Claude

Ahí está la fricción concreta: el tutorial dice `https://<tu-dominio>/api/webhooks/fathom` — **un placeholder**. El cliente tiene que adivinar el dominio. Veo cómo se renderiza para poder poner la URL real con botón de copiar:

### Claude

Solo el de Fathom expone una URL nuestra. Lo hago concreto y honesto:

### Claude

Ahora hago que `{{APP_URL}}` se reemplace por el dominio real:

### Claude

Ojo: este módulo lo importa también la UI cliente. `lib/app-url.ts` es seguro ahí porque cae a `NEXT_PUBLIC_APP_URL`, que Next inlinea en el bundle:

### Claude

Ahora lo del correo. Antes de proponerte opciones, un dato que cambia el criterio:

### Claude

Dato que importa para elegir: **un solo remitente sirve para todo** — la nutrición y los broadcasts a *leads*, y también los avisos internos, el reparto de tareas de reuniones y los links compartidos. Así que la dirección la ve tanto un prospecto frío como tu equipo.

### Claude

Un aclarado técnico que te ahorra trabajo: **en Resend no se "crean" direcciones**. Verificás el *dominio* y ya podés enviar desde cualquier dirección de ese dominio — `equipo@`, `noreply@` y `martin@` **ya funcionan para enviar**, sin configurar nada.

Lo que sí hace falta configurar es **recibir** las respuestas. Veo cómo está:

### Claude

Porkbun **no expone el reenvío por API** (404 en las 3 variantes) — eso sí es panel. Pero primero te lo demuestro: pongo `equipo@` como remitente y mando una prueba desde **las tres direcciones**, sin crear ninguna:

### Claude

Listo. Te respondo las dos cosas.

## Los correos: no hay nada que "crear"

`equipo@hola-mako.com` ya quedó como remitente por defecto.

Y te mandé **tres emails** a tu Gmail, uno desde cada dirección, los tres `delivered`:

```
DELIVERED | MaKo <equipo@hola-mako.com>
DELIVERED | MaKo <noreply@hola-mako.com>
DELIVERED | Martín de MaKo <martin@hola-mako.com>
```

**Sin dar de alta ninguna.** En Resend verificás el *dominio*, no direcciones: con `hola-mako.com` verificado, cualquier `algo@hola-mako.com` envía. Para usar otra en un envío puntual alcanza con el parámetro `from`.

**Lo que sí falta es recibir.** Si alguien responde uno de esos mails hoy, escribe a un buzón que no existe. Eso son reglas de reenvío en Porkbun, y **la API no las expone** (404 en las tres variantes) — es panel.

**Un detalle que conviene decidir antes de separar direcciones**: hoy un solo remitente sirve para *todo* — la nutrición a leads y también los avisos internos, el reparto de tareas de reuniones y los links compartidos. Si querés que `noreply@` cubra los avisos automáticos y `martin@` el marketing, hay que elegir qué contexto usa cuál. Es media hora de trabajo, pero es tu decisión de marca, no la hago solo.

## Fathom: no, no es 100% necesario

Lo verifiqué en el código en vez de opinar:

**Sin webhook igual funciona.** `adjuntarFathomAuto` trae las grabaciones con la *API key* (que el cliente ya carga) y llama al mismo `applyFathomRecording`. Corre por cron y por evento. La reunión se adjunta y la asistencia se marca igual.

**Lo que se pierde es el tiempo real**, y son tres cosas que solo viven en el webhook: el aviso por WhatsApp de "ocurrió la reunión", el disparo de flujos, y el borrador de seguimiento post-llamada. O sea: pasa igual, pero en la pasada siguiente en vez de al instante.

**Automatizarlo es imposible**: Fathom no tiene API de webhooks. Probé cinco endpoints, los cinco 404, mientras `/meetings` da 200 — la key es válida, el endpoint no existe. No hay forma de registrarlo por nosotros.

**Pero sí arreglé la fricción real**, que no era pedirlo sino *cómo* se pedía. El instructivo decía:

> `Poné como destino la URL de tu app: https://<tu-dominio>/api/webhooks/fathom`

Un placeholder. El cliente tenía que deducir cuál es su dominio — justo lo que no tiene por qué saber. Ahora escribe la URL real (`https://hola-mako.com/api/webhooks/fathom`), y lo hace con un `{{APP_URL}}` que se resuelve solo, así una mudanza futura no deja el instructivo mintiendo.

Y cambié el orden del copy: ahora el primer paso dice que **es opcional y qué cambia**. Antes decía *"para que la asistencia se marque sola"*, que daba a entender que sin webhook no se marcaba — y sí se marca.

---

# Lo que necesito de vos

**1. Reenvío de correo en Porkbun** (para poder recibir respuestas)

`porkbun.com` → Domain Management → `hola-mako.com` → **Email Forwarding** → Add. Una regla por dirección:

| Alias | Sugerencia de destino |
|---|---|
| `equipo` | tu Gmail o el de Mauricio |
| `martin` | `martinkoncke@gmail.com` |
| `noreply` | ninguno (es el punto: que nadie responda) |

**2. Fathom: falta confirmar 2 cuentas**

Tu cuenta (`martinkoncke@gmail.com` → ws9) ya la vi en la captura, apuntando bien. Faltan:
- `mbustos@elevate.com.mx` (ws1)
- `hola@leilafittipaldi.com` (ws11)

Mismo lugar: Settings → API Access → Manage. La URL debe ser `https://hola-mako.com/api/webhooks/fathom`.

Cuando me confirmes esas dos, saco `/api/webhooks` y `/api/track` de las exenciones del proxy y ahí sí mueren de verdad los dominios viejos.

**Nada de esto es urgente**: todo funciona hoy. Son los últimos cabos.


---

## Martín

`2026-08-06 03:30`

Entonces si vale la pena pedirle al usuario que lo haga, no solo por la tab plan y las tareas... Si no por algo más importante, las llamadas de ventas... Que sea instantaneo nos habilita a que luego implementemos, por ejemplo, envío automático de email y whatsapp al lead con el resumen, o con lo que sea que querramos enviarle...
Sería bueno pedirle como obligatorio entonces, y claro, explicar en el apartado de contexto porque se lo pedimos y en que le beneficia.
Y con respecto a las cuentas de Mauricio y Leila, solo modifica el tutorial en integraciones y ellos lo harán.

Luego, te adjunto la captura de lo que me sale en Porkbun, dime que hacer exactamente

### Claude

Tu argumento cambia la respuesta: si habilita mandarle al lead el resumen de la llamada al instante, dejar de tenerlo cuesta mucho más que la molestia de pedirlo. Lo hago obligatorio.

Antes verifico que no rompa a nadie que ya esté conectado:

### Claude

Todos tienen el secret, así que hacerlo obligatorio no rompe a nadie. `FATHOM_HOST_EMAIL` le falta solo a ws3 (Cliente de Prueba) — y sin él el webhook no puede rutear, así que también debe ser obligatorio:

### Claude

El tutorial del servicio también usa ahora `{{APP_URL}}`, pero la sustitución que agregué solo cubre la ayuda por campo. Reviso cómo se consume:

### Claude

Ahora la ayuda del campo, alineada con que ya no es opcional:

### Claude

Los tres campos obligatorios y la URL real resuelta en ambos lados. Pusheo:

### Claude

Otro temporal de la sesión paralela (`scripts/_esc-mp2.ts`). Verifico que no sea mío antes de esperar:

### Claude

Son archivos de trabajo de la sesión paralela (creados hace minutos, sin trackear). No los borro. Mi commit está hecho; reintento el push en un momento.

Mientras, **lo de Porkbun** — la captura muestra dos cosas distintas y solo necesitás una:

## Usá la columna derecha: **Email Forwarding**

Es **gratis** (hasta 20 direcciones) y es todo lo que hace falta. En "Add Forwarding Address":

| Paso | Qué poner |
|---|---|
| *When someone sends an email to:* | `equipo` |
| *Deliver it to:* | tu Gmail (o el de Mauricio, el que quieras que atienda) |
| | **Create Email Forward** |

Repetí para `martin` → `martinkoncke@gmail.com`.

**`noreply` no lo crees.** Ese es justamente el punto: que si alguien responde, rebote.

## Lo que **NO** tenés que hacer

**Ignorá "You have inboxes pending setup!"** y el botón verde "Setup Now". Eso es Porkbun **Email Hosting** — un buzón propio con login, $3/mes por inbox. Vos no lo necesitás: MaKo envía por Resend, y para recibir alcanza el reenvío gratis.

Tenés un *Free Trial* que expira el **2026-08-19**, y el mismo panel aclara que las cuentas pendientes de setup **se eliminan solas al expirar y no se renuevan**. O sea: no hagas nada y desaparece. No te va a cobrar.

**Tampoco toques "Fix DNS"** — ese botón reescribe los registros de email hosting, y ahí están los de Resend que acabo de cargar.

## Un detalle del propio panel que confirma que vamos bien

Dice: *"Porkbun's email service is not intended for the sending of bulk or automated transactional email"*. Correcto — y no es nuestro caso: **enviamos por Resend**, Porkbun solo recibe las respuestas. Su recomendación de Mailchimp no aplica.

*(El aviso de "Gmail no soporta POP3" tampoco: solo afecta a traer un buzón de Porkbun hacia Gmail, que es justo lo que no vas a usar.)*

---

## Lo que ya quedó hecho del lado del código

**Fathom pasa a obligatorio**, con los tres campos: API key, email de la cuenta y secret del webhook. Y el tutorial ahora:

- **Arranca por el beneficio**, no por la instrucción: *"cuando cortás una llamada, MaKo la escucha, la resume, marca la asistencia y actualiza el CRM"*. Ese campo pide salir de MaKo, entrar a otra herramienta y volver — sin decir para qué, se lee como burocracia nuestra.
- Muestra **la URL real** (`https://hola-mako.com/api/webhooks/fathom`), no un placeholder.
- Agrega un paso que faltaba y que vi en tu captura: **marcar "External Recordings"** además de "My Recordings". Sin eso no llegan las llamadas que grabe otra persona del equipo.

También hice obligatorio el **email de la cuenta**: sin él el webhook llega y **se descarta en silencio**, que es el peor caso — el cliente lo configuró y cree que quedó andando. Verifiqué antes de tocarlo: el secret lo tienen los 4 workspaces (no rompe a nadie) y el email le falta solo a ws3, Cliente de Prueba.

Con eso Mauricio y Leila lo hacen solos desde `/integraciones`, sin que les dictes la URL.


---

## Martín

`2026-08-06 03:39`

En integraciones, entré con la cuenta de Mauricio y aún no lo veo actualizado...

Por otro lado, no quisiera que me lleguen a martinkoncke@gmail.com, es mi email personal y si son muchos usuarios se me llenará de cosas. ¿Que hago, me abro un nuevo email?

### Claude

Lo primero explica lo segundo: **mi cambio nunca llegó a producción**. El push quedó bloqueado por un archivo de trabajo de la sesión paralela. Reviso:

### Claude

El typecheck está limpio y no hay commits sin pushear — o sea que **sí llegó**. Verifico si está desplegado:

### Claude

Mi cambio **sí está en producción** — lo verifiqué: el deploy actual (`1544a67`) incluye mi commit `b6f9083`.

Lo que pasa es otra cosa: **para la cuenta de Mauricio la tarjeta se ve igual que antes**, porque él ya tiene los tres campos cargados. Lo que cambió es lo de adentro. Para verlo: `/integraciones` → tarjeta **Fathom** → abrila → vas a ver los tres campos sin el "(opcional)" y el botón **?** de cada uno con el texto nuevo, con la URL real. Si seguís viendo lo viejo, recargá con Ctrl+Shift+R (el bundle del cliente queda cacheado).

Ahora lo del correo. Antes de recomendarte, verifico algo que define la mejor opción:

### Claude

Resend tiene SMTP en los dos puertos. Eso importa por algo que no habíamos hablado: **si reenviás a un Gmail y respondés desde ahí, el cliente ve tu `@gmail.com`**, no `equipo@hola-mako.com`. Verifico que se pueda arreglar:

### Claude

Confirmado con una sesión SMTP real: **usuario `resend` + la API key, aceptado** (`235`). Eso cierra el problema.

### Claude

## Lo de `/integraciones`: ya está, pero se ve igual

Verifiqué que el deploy en producción incluye mi cambio. Lo que pasa es que **la cuenta de Mauricio ya tiene los tres campos cargados**, así que la tarjeta sigue verde igual que antes. El cambio está adentro:

`/integraciones` → tarjeta **Fathom** → abrila. Vas a ver los tres campos **sin el "(opcional)"**, y el botón **?** de cada uno con el texto nuevo y la URL real. Si seguís viendo lo viejo, **Ctrl+Shift+R** — el bundle del cliente queda cacheado.

## Lo del correo: tenías razón, y hay un problema que no habíamos visto

No es solo "dónde caen". Es que **si reenviás a un Gmail y respondés desde ahí, el cliente ve tu `@gmail.com`**. La dirección linda solo sirve para salir, no para volver. Eso arruinaría el punto.

Se arregla, y lo verifiqué con una sesión SMTP de verdad contra Resend:

```
smtp.resend.com  ·  puerto 465 (SSL) o 587 (TLS)
usuario: resend
contraseña: una API key de Resend
→ respondió 235, autenticación aceptada
```

Con eso, Gmail puede **"Enviar como" `equipo@hola-mako.com`** y las respuestas salen con la dirección correcta.

## Mi recomendación: sí, un Gmail nuevo — pero gratis

**No Google Workspace todavía.** Hoy el volumen es cero: acabás de prender el envío y nunca salió un email. Pagar $7/mes por usuario para un buzón vacío es adelantarse.

**Tampoco el Email Hosting de Porkbun** ($3/mes), aunque tengas el trial ahí. Su propio panel avisa que **Gmail dejó de poder traer esos buzones por POP3 desde enero 2026** — o sea, otro webmail más para entrar aparte. Peor experiencia que un Gmail común.

El plan que te dejaría, **costo $0**:

1. **Creá un Gmail dedicado** (algo como `hola.mako@gmail.com`). Esto lo tenés que hacer vos: no creo cuentas ni manejo contraseñas.
2. **En Porkbun**, los dos reenvíos apuntan ahí:
   - `equipo` → el Gmail nuevo
   - `martin` → el Gmail nuevo
   - `noreply` → no lo crees
3. **En ese Gmail**: Configuración → Cuentas → *Enviar mensaje como* → Agregar `equipo@hola-mako.com` con los datos SMTP de arriba.

Resultado: tu inbox personal queda limpio, las respuestas de leads caen en un solo lugar, y cuando contestás el cliente ve `equipo@hola-mako.com`.

**Cuándo migrar a Workspace**: cuando ese buzón te moleste — cuando necesites que Mauricio y vos lo atiendan a la vez, o cuando el volumen justifique etiquetas y filtros en serio. La migración es indolora: solo cambiás el destino de los reenvíos en Porkbun, la dirección pública no se toca.

Si preferís evitar la cuenta nueva, la alternativa es apuntar los reenvíos a `mbustos@elevate.com.mx` — pero le llenás el inbox a Mauricio, que es el mismo problema corrido de lugar.

---

Cuando tengas el Gmail creado y los reenvíos puestos, decime y te mando un email de prueba a `equipo@hola-mako.com` para confirmar que el circuito completo funciona: entra, reenvía, y podés responder con la dirección correcta.


---

## Martín

`2026-08-06 04:05`

Aún no me aparece el tutorial de ponerle el link de mako dentro de Fathom... No se que hiciste.

Por otro lado, en lugar de crear un gmail nuevo, no podemos simplemente implementar una bandeja replicando la app de gmail dentro de MaKo? Y que lleguen allí todos los mail y que desde allí yo pueda escribir, seleccionar con que email quiero que se envie y gestionar todo?

### Claude

Dos cosas. La primera es un bug mío: el tutorial **existe en los datos pero la UI no lo está mostrando**. Miro por qué:

### Claude

Ahí está, y es un problema de diseño real: cuando la credencial **ya está guardada**, la UI oculta el botón de ayuda a propósito (*"con la credencial ya guardada sobra"*).

Pero eso es falso justamente acá: **tener el secret guardado no dice nada sobre si la URL dentro de Fathom es la correcta.** Es exactamente tu caso.

### Claude

Ahora el `PasosAyuda`, que también estaba gateado por `!cerrada`:


---

## Martín

`2026-08-06 04:07`

No, no tienes que mostrar el paso ayuda, tienes que crear un 4to paso, porque que peguen el webhook secret no es lo mismo a que ellos deban pegar algo dentro de Fathom.

### Claude

Tenés razón, es otra cosa. Pegar el secret **en MaKo** y pegar la URL de MaKo **dentro de Fathom** son dos acciones en direcciones opuestas — meterlo en la ayuda de un campo lo esconde. Revierto lo que hice:

### Claude

Ahora sí, un **cuarto paso propio**. Lo modelo en el catálogo como algo distinto de una credencial:

### Claude

Ahora que `{{APP_URL}}` se resuelva también ahí, y que la ruta lo devuelva:

### Claude

Ahora el bloque en la UI. Veo dónde termina la lista de campos para ponerlo después:

### Claude

Ahora escribo el bloque del paso:

### Claude

Y lo monto justo después de los campos, que es donde el usuario lo necesita:

### Claude

Limpio. Verifico que el paso salga bien armado antes de pushear:

### Claude

Mi código **sí quedó** — pero lo commiteó la sesión paralela junto con lo suyo (el árbol de trabajo es compartido). Verifico que esté en producción:

### Claude

Confirmado: el deploy `64f3c497` está en producción con el paso nuevo. **Recargá `/integraciones` con Ctrl+Shift+R** y vas a ver, debajo de los tres campos, un bloque ámbar con la URL y botón de **Copiar**.

Ahora tu idea de la bandeja. Antes de opinar, verifico si es posible recibir emails por API:

### Claude

`GET /emails/inbound` devuelve **200** — Resend tiene inbound. Veo qué expone:

### Claude

Sí se puede, y con el proveedor que ya usamos: **Resend tiene inbound**, el endpoint responde (lista vacía, sin error de plan).

Pero antes de que lo tomes como un sí, dos cosas que cambian la decisión.

## La restricción técnica: el MX es exclusivo

Hoy tu dominio tiene:
```
MX hola-mako.com → fwd1/fwd2.porkbun.com   (reenvío)
```

Para que MaKo reciba, ese MX tiene que apuntar a Resend. **No podés tener los dos**: o reenvía Porkbun, o recibe la app. Es todo o nada, y el día que la bandeja tenga un bug, el correo no está "en otro lado" — no está.

## El riesgo de producto: "replicar Gmail" es una trampa

Gmail es una década de trabajo: hilos, adjuntos, búsqueda, borradores, spam, citado en las respuestas, múltiples destinatarios. Una bandeja genérica a medias es peor que Gmail, porque hace lo mismo pero mal.

**Pero creo que no es eso lo que querés.** Lo valioso no es tener un cliente de correo — es que el email del lead esté **donde ya está su conversación de WhatsApp y su ficha del CRM**. Eso no lo hace Gmail, y es la clase de cosa que sí diferencia a MaKo.

Así que la versión que sí vale:

> **No una bandeja. Los emails como un canal más en la ficha del lead**, al lado del chat de WhatsApp: ves el hilo, respondés desde ahí, elegís con qué dirección sale, y queda registrado en el historial del lead.

Eso es acotado, encaja con lo que ya existe, y resuelve el problema real (que las respuestas de leads no se pierdan en un inbox personal) sin competir con Gmail.

Lo que quede fuera de un lead —proveedores, avisos sueltos— sigue yendo a un buzón normal, que es donde tiene que estar.

## Mi recomendación

**Ahora**: el Gmail dedicado. 15 minutos, $0, y te desbloquea hoy. No es tirar trabajo: cuando exista la bandeja, ese buzón sigue siendo el destino de lo que no es de un lead.

**Después, como feature**: el canal de email en la ficha del lead. Es una semana o dos de trabajo real, y merece pasar por el tablero con su detalle y que el Perro lo puntúe contra el resto de tu plan — no que lo arranquemos porque salió en esta charla.

Si querés, te dejo la propuesta cargada en `/plan/revisar` con el alcance, lo que verifiqué del inbound de Resend y la restricción del MX, para que decidas ahí contra todo lo demás.

---

**Lo que sí quedó listo recién:** el cuarto paso en `/integraciones`. Bloque propio debajo de los campos, con la URL en grande y botón de **Copiar**, dónde pegarla con el camino exacto en Fathom, y las tres aclaraciones que rompen el paso en silencio — entre ellas marcar *External Recordings*, sin lo cual no llegan las llamadas que grabe otro del equipo.

Y se muestra **siempre**, aunque las credenciales estén guardadas. Ese era el fondo del problema: tener el secret cargado no prueba nada sobre la URL del otro lado. Tu caso exacto — tres campos en verde y el webhook apuntando al dominio viejo.


---

## Martín

`2026-08-06 04:30`

No es necesario hacer todo eso, podemos COPIAR codigo de proyectos open source como este: https://github.com/TryGhost/Ghost

Copiar el diseño y las features...
Eso nos ahorrará muuucho trabajo.

Desconozco si el que te envie es la mejor opción, investigalo y hagamoslo.

### Claude

Antes de copiar nada, dos cosas que hay que verificar sí o sí: **qué hace realmente Ghost** y **con qué licencia**. Copiar código open source no es gratis — según la licencia, puede obligarte a abrir MaKo entero.

### Claude

Dato decisivo: **Ghost no recibe email**. Es un CMS de publicación y newsletters — envía, no tiene bandeja. Es MIT (copiar sería legal), pero no resuelve lo que querés.

Verifico las licencias de los candidatos que sí son bandejas, porque ahí está el riesgo real:

### Claude

Se está dibujando algo importante. Confirmo las licencias exactas, que es lo que no se puede suponer:

### Claude

Investigado, y hay tres hallazgos que cambian el plan. El instinto de no construir desde cero es correcto, pero ninguno de estos sirve para copiar.

## 1. Ghost no recibe email

Es un CMS de publicación y newsletters: **envía**. No tiene bandeja de entrada. Es MIT (copiarlo sería legal) pero no resuelve nada de lo que querés.

## 2. El que mejor encaja está legalmente vetado

**Inbox Zero** es lo más parecido a lo que imaginás y encima comparte stack casi exacto con MaKo (Next.js, Prisma, shadcn, Postgres). Pero leí su licencia:

> **AGPL v3.0** + *"You may not use this Program... for commercial purposes that involve monetizing the software itself, including... offering it as a paid service"*
>
> *"If you are an organization with five (5) or more... users... you must obtain an enterprise license"*

Copiar ese código a MaKo haría dos cosas: te obligaría a **publicar el código de MaKo entero** (la AGPL es viral y cubre el SaaS), y además viola explícitamente la cláusula comercial. Es exactamente el riesgo que quería descartar antes de tocar nada.

*(No soy abogado, pero el texto es inequívoco.)*

**Zero (Mail-0)** sí es MIT — ese se podría copiar sin problema legal.

## 3. El hallazgo que invalida la estrategia entera

**Ninguno de estos es una bandeja: son clientes de Gmail.**

Inbox Zero y Zero se conectan a Gmail/Outlook **por su API**. No reciben correo, no tienen servidor de mail. Necesitás igual una cuenta de Gmail detrás; ellos solo ponen una UI mejor encima.

O sea: **copiarlos no te ahorra la parte difícil.** Lo difícil no es la pantalla —eso MaKo ya lo sabe hacer, tiene su propio lenguaje visual— sino recibir en `hola-mako.com`, armar los hilos y atarlos al lead. Todo eso ellos se lo delegan a Gmail.

Y el camino "conectamos Gmail por API como hacen ellos" tiene su propia trampa: los scopes de lectura de Gmail son *restricted* y Google exige una auditoría de seguridad para apps multi-inquilino. Semanas y plata.

## Lo que sí haría

**Ahora**: el Gmail dedicado + "enviar como". 15 minutos, $0, y te desbloquea hoy. No es trabajo tirado — ese buzón después recibe lo que no es de un lead.

**Después, como feature**: Resend inbound → guardar → mostrar el hilo **en la ficha del lead**, al lado de su WhatsApp. Ya verifiqué que el endpoint de inbound de Resend responde en tu cuenta. Eso es una o dos semanas, no un mes, precisamente porque no construimos un cliente de correo general: solo el hilo de ese lead.

De Zero (MIT) podemos tomar ideas de UI y hasta código puntual si algo encaja. Pero como referencia, no como base.

---

¿Te cargo la propuesta en `/plan/revisar` con esto —el alcance, el hallazgo del inbound de Resend, la restricción del MX exclusivo y por qué Inbox Zero queda descartado— para que la puntúe el Perro contra el resto? Así decidís con el tablero adelante y no porque salió en esta charla.

**Sources:** [TryGhost/Ghost](https://github.com/TryGhost/Ghost) · [elie222/inbox-zero](https://github.com/elie222/inbox-zero) · [Licencia de Inbox Zero](https://raw.githubusercontent.com/elie222/inbox-zero/main/LICENSE) · [Mail-0/Zero](https://github.com/Mail-0/Zero) · [Licencia de Zero](https://github.com/Mail-0/Zero/blob/staging/LICENSE) · [nylas/nylas-mail](https://github.com/nylas/nylas-mail) (archivado desde 2017)


---

## Martín

`2026-08-06 04:37`

Cargalo como propuesta en el plan el resto, porque lo vamos a tener que copiar para hacer un buen servicio de email marketing dentro de MaKo...

Y con lo nuestro, revisa esto: https://github.com/John-Weeks-Dev/gmail-clone
Podríamos copiar la interfaz... Lo que no quiero es que se parezca a WhatsApp cuando estamos enviando un email, eso haría todo muy confuso

### Claude

Miro el repo que me pasás, y tu punto sobre no parecerse a WhatsApp es importante — lo tengo en cuenta para la propuesta:

### Claude

Ese repo no sirve, pero tu principio sí. Tres razones concretas:

- **No tiene LICENSE.** Sin licencia, por defecto es "todos los derechos reservados" — copiarlo no está permitido.
- **Vue 3 + Firebase + Pinia.** Stack incompatible con MaKo (Next.js + React + Supabase).
- 33 estrellas, 10 commits, es el proyecto de una serie de YouTube. Y es solo maqueta: no envía ni recibe.

Pero **"que no se parezca a WhatsApp" es la decisión de diseño más importante de esta feature** y me la llevo a la propuesta. Un email tiene asunto, hilo, formato, CC y adjuntos; un chat no. Si lo dibujamos con burbujas, el usuario escribe como si chateara y manda emails de una línea sin asunto.

Cargo la propuesta:


---

## Martín

`2026-08-06 04:37`

Base directory for this skill: C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\.claude\skills\plan-tareas

# Plan de tareas de MaKo (board /plan)

El board del super-admin vive en **Supabase** (`plan_tareas` / `plan_proyectos`, mig 0093),
en **su propio workspace** (el que tiene `capa='superadmin'`; Mauricio/ws1 usa otro board,
`experimento_tareas`, y NO es este). El viejo puente localStorage + `mako.plan.inbox/ops/
snapshot` **está muerto**: no lo uses.

## LA REGLA (no negociable)

**Todo origen que carga tareas pasa por el MISMO proceso**: se resuelve lo deducible →
se preguntan los HECHOS que faltan → **el Perro Guardián puntúa**. Da igual si viene de
WhatsApp, de Fathom, de un archivo o de Claude Code.

⛔ **NUNCA hagas `insert into plan_tareas`.** Saltea las preguntas, el Perro, la checklist
y la descripción del proyecto — y deja una tarea con prioridad inventada por vos.
✅ **Creá una PROPUESTA** (`plan_propuestas`) y pasale el link. La app corre el wizard y el
Perro con las credenciales del dueño (que vos no tenés: se descifran con
`CREDENCIALES_SECRET`, que solo vive en Vercel).

## 1. Revisá el plan ANTES de trabajar

Leé directo de la base (read-only). Resolvé el workspace por capa, no lo hardcodees:

```js
// node --experimental-strip-types, con dotenv sobre .env.local (apunta a PROD)
const [{ id: ws }] = await sql`select id from workspaces where capa = 'superadmin' limit 1`;
const tareas = await sql`select num, title, score, priority, progress, deadline
                         from plan_tareas where workspace_id = ${ws} and progress < 100
                         order by score desc limit 60`;
const proys  = await sql`select pid, name, score from plan_proyectos
                         where workspace_id = ${ws} order by score desc`;
```

⚠️ En este entorno **`db.<ref>.supabase.co` NO resuelve**: si el postgres directo falla,
usá el cliente de la app (`runWithWorkspace` + `getTenantDb`, como
`scripts/probe-plan-superadmin.ts`), que va por HTTPS.

- Si lo que vas a hacer **ya está** en la lista → NO dupliques: continuá esa tarea.
- Si hay **ALTA** (score ≥ 75) o **vencidas** relacionadas con tu trabajo, mencionáselas.

## 2. Proponé tareas nuevas (borrador + link)

Insertá UNA fila en `plan_propuestas` y entregá el link `/plan/revisar/<id>`:

```js
await sql`insert into plan_propuestas (id, workspace_id, estado, origen, resumen, tareas, notas, eliminar)
          values (${id}, ${ws}, 'pendiente', 'claude-code', ${resumen},
                  ${sql.json(tareas)}, ${sql.json(preguntas)}, ${sql.json([])})`;
```

- `tareas`: `[{ titulo, proyecto, detalle }]`. **No mandes `prioridad` ni `deadline`**: las
  decide el Perro (ver abajo).
- `proyecto` = un nombre del **CATÁLOGO CERRADO** (`lib/plan-proyectos-catalogo.ts`). NO
  inventes nombres. Los proyectos son GRANDES —del tamaño del nombre de una tab— y hay dos
  familias: los de producto se llaman como la tab (`CRM`, `Dashboard`, `Onboarding`,
  `WhatsApp`, `MaKo Doer`…) y el trabajo comercial va en `Vender MaKo: <canal>`. Más unos
  pocos transversales (`Seguridad y multi-inquilino`, `Diseño de la app`, `Infraestructura
  y versionado`, `Avisos y reportes`).

  ⚠️ No es una convención suelta: en dos semanas la IA creó 24 proyectos basura (TRES de
  Instagram, DOS "Ads Content Machine", varios con una sola tarea) y hubo que fundir 64 en
  34 a mano. Si de verdad ninguno encaja, **decilo en el `resumen`** en vez de inventar uno.
- `detalle`: **es el campo más importante y va LARGO** (4 a 8 frases). Contá el porqué, de
  dónde salió, los nombres y números concretos, y qué sería "listo". Si sale de un documento
  o de una reunión, **citá la frase textual entre comillas y decí quién lo dijo**. Una tarea
  con detalle pobre es una que en tres semanas nadie sabe hacer — y el Perro estima el
  ESFUERZO con lo que le des, así que escribir corto la hace parecer barata.
- `notas` = las **preguntas** `[{ pregunta, tipo, opciones }]`. **Mandá al menos una**:
  sin preguntas el wizard aplica con `contexto=''` y el Perro puntúa a ciegas.
- `eliminar`: `[{ id, motivo }]` si esta carga deja tareas viejas obsoletas o duplicadas.

### Antes de mandar: ¿ya existe?

El tablero tiene ~400 tareas y el dedup automático solo ve el parecido léxico (atrapa 5 de
17 duplicados reales). **Buscá vos**: leé `plan_tareas` y compará por objetivo, no por
palabras ("Modo Simple" y "vista simple por default" son la misma). Si ya existe, NO la
mandes de nuevo: ponela en `eliminar` si la vieja quedó obsoleta, o mencionala en el
`resumen` para que el dueño la amplíe. La misma tarea cargada dos veces con scores
distintos destruye la confianza en todos los demás puntajes.

### Qué decide el Perro con lo que le mandás (no lo decidas vos)

Corre server-side al aplicar, en **Gemini Flash** (`mako-guardian` + `checklist-coach` en
`lib/model-registry.ts`), y en una sola pasada define:

| Decide | Cómo |
|---|---|
| **score 1-100** | contra la pirámide del plan y el diagnóstico de fase del negocio |
| **deadline + su razón** | sale del score y del esfuerzo; vacío es respuesta válida. NUNCA pisa una fecha que ya venía |
| **descripción + checklist** | AMPLÍA la tuya, no la reemplaza (`fusionarDetalle`) |
| **el proyecto** | rutea contra el catálogo cerrado; ya no puede devolver "es trabajo nuevo" |
| **`haceloEn`** | si la tarea se resuelve en una tab de MaKo (`lib/mako-capacidades.ts`) |

Las **notas** de una tarjeta son del dueño: la IA no las toca nunca.

### Las preguntas (mismas reglas que MaKo)

Son para **sacarle CONTEXTO al dueño y que EL PERRO decida**, nunca para que él elija la
prioridad (exagera, se encariña, no sabe priorizar).

- ⛔ Prohibido: "¿qué prioridad le das?", "¿cuál te urge primero?", "¿alta/media/baja?".
- ✅ Preguntá HECHOS: deadlines duros, qué BLOQUEA o de qué DEPENDE, qué mueve en plata y
  en cuánto, qué sería "listo", si es 1 tarea o varias.
- Si la respuesta es obvia o se contradice con lo que ya sabés, **no la preguntes**.
- **CUÁNTAS: escalá con el tamaño del lote**, ~1 cada 3 tareas (`topePreguntas` en
  `lib/plan-propuesta.ts`). Con 20 tareas y 4 preguntas, 16 entran a ciegas.
- **Variá el formato** eligiendo el mejor para cada una:
  `multi` (varias válidas a la vez — sin opción "Ambas/Todas", que tilde varias) ·
  `opcion` (excluyente) · `escala` (1-5) · `comparacion` (A vs B) · `texto` (último recurso).
  **Nada de preguntas abiertas por descuido**: siempre con opciones para tocar.
- ⚠️ **El tipo y las opciones tienen que ser coherentes**: una `opcion` sin `opciones` se
  dibuja sin un solo botón y no se puede contestar. Una `escala` NO lleva opciones y la
  pregunta tiene que explicar los extremos ("1 = es una idea, 5 = ya está comprometido").
  Una `comparacion` lleva EXACTAMENTE dos.

## 3. Entregá el link ENTERO (o abrilo) y pará

⚠️ **Nunca pases un path suelto** (`/plan/revisar/<id>`): no es clickeable y obliga a
armarlo a mano. Pasá **la URL COMPLETA**, y si podés, abrila directamente.

```js
import { APP_BASE_URL } from '@/lib/app-url';
const link = `${APP_BASE_URL}/plan/revisar/${id}`;   // ← esto es lo que se entrega
```

(`lib/app-url.ts` es la ÚNICA fuente de la URL base — la misma que usa
`lib/mako-doer-acciones.ts` para los links de WhatsApp. Nunca la rearmes a mano.)

Él contesta de a una, aplica, y recién ahí el Perro puntúa, describe los proyectos nuevos
y arma las checklists. **No insertes nada más.**

## Cuidados

- **Escribe en PROD** (`.env.local` apunta a prod). No lo uses para pruebas; si probás,
  borrá la propuesta después (`delete from plan_propuestas where id = ...`).
- El **historial** es obligatorio para lo que toca la IA/el agente: la propuesta ya entra con
  `origen: 'claude-code'` y `aplicarPropuesta` estampa la fuente en cada tarjeta.
- **Un lote grande NO se manda de a partes.** Una propuesta con las 20 tareas juntas, no
  cinco propuestas de cuatro: cada corrida del Perro compara solo contra lo que ve, y en
  lotes separados el mismo trabajo termina con scores distintos.
- Para el board de un **cliente** (no el super-admin) el camino es `lib/todo`
  (`experimento_tareas`). Se aplica solo: `aplicarPropuesta` detecta el workspace y manda
  al board que corresponde, y desde jul-2026 el cliente TAMBIÉN recibe al Perro
  (`priorizarNuevasCliente`, lib/todo-guardian.ts).
- Esta skill es la versión "de adentro" (habla con la base porque corre en la máquina del
  dev). La que instala un **cliente** en SU Claude Code sale de /integraciones → "Tu agente"
  y habla por `/api/agente/plan` con un token; el texto vive en `lib/agente-skill.ts`.
  Si cambiás las reglas de acá, cambialas también allá.


ARGUMENTS: Cargar propuesta: email marketing dentro de MaKo (copiar de OSS lo que se pueda) + canal de email en la ficha del lead con inbound de Resend. Incluye hallazgos de licencias (Inbox Zero AGPL descartado, Zero MIT, Ghost no recibe) y la restricción del MX exclusivo.

### Claude

Primero reviso el tablero, para no duplicar algo que ya esté anotado:

### Claude

**#531 ya existe y es exactamente eso.** Antes de proponer nada, miro qué hay bajo el proyecto Email:

### Claude

Freno acá: **ya existen dos tareas que cubren esto** — #531 *"Email a la par de WhatsApp: bandeja, envío y contexto compartido"* y #115 *"un buzón de mail por lead… ver la conversación y el historial dentro de la ficha"*. Cargar lo mismo de nuevo rompería los scores de todo el tablero.

Así que propongo **una sola tarea nueva** —la decisión que las bloquea y que nadie tenía identificada— y el resto va como ampliación de las que ya están:

### Claude

Cargada. Revisala acá:

**https://hola-mako.com/plan/revisar/c6e1e442-cbf5-45db-a744-92faf6337a32**

## Por qué va una sola tarea y no cinco

Leí el tablero antes de escribir y **ya existían dos tareas que cubren tu idea**:

- **#531** *"Email a la par de WhatsApp: bandeja, envío y contexto compartido"* [score 50]
- **#115** *"un buzón de mail por lead… ver la conversación y el historial dentro de la ficha"* [score 3]

Cargar lo mismo otra vez le habría puesto dos scores distintos al mismo trabajo, que es lo que destruye la confianza en todos los demás puntajes del tablero. Así que todo lo investigado va en el **resumen**, para que vos amplíes esas dos, y la única tarea nueva es **la decisión que las bloquea a ambas** y que no estaba anotada.

## La decisión que faltaba

El registro MX de un dominio **apunta a un solo lugar**. O reenvía Porkbun a un buzón, o recibe MaKo. No hay punto medio. Y si MaKo recibe y un día la bandeja falla, ese correo no está en otro lado — no está.

Eso hay que decidirlo *antes* de escribir código, porque condiciona la arquitectura entera y es caro de revertir. Por eso es una tarea y no una nota.

## Lo que quedó cerrado y ya no hay que volver a investigar

**Sobre copiar**: Inbox Zero es el que mejor encajaba y está **vetado** (AGPL + prohibición explícita de uso comercial pago). Zero es MIT y es el único del que se puede tomar código. Ghost no recibe email. El `gmail-clone` no tiene licencia — todos los derechos reservados.

**Y el hallazgo que invalida la estrategia de copiar**: ninguno de esos es una bandeja. Son clientes montados sobre la API de Gmail. La parte difícil —recibir, armar hilos, atarlos al lead— se la delegan a Google. Copiarlos no la ahorra.

**Tu observación del diseño quedó registrada como tensión a resolver**, con tu frase textual. Porque #531 pide *"evitar duplicar componentes con estilos diferentes"* y vos pedís que el email *no* se parezca a WhatsApp. No se contradicen, pero hay que reconciliarlas a propósito: compartir las primitivas sin dibujar el email con burbujas. Si se dibuja como chat, el usuario escribe como si chateara y manda correos de una línea sin asunto.

## Las 3 preguntas

Ninguna te pregunta la prioridad — eso lo decide el Perro. Te preguntan hechos: si hay alguien esperando, qué te duele hoy, y cuánto te pesa el riesgo de que el correo no tenga red de contención.

Contestalas y aplicá; ahí el Perro la puntúa contra las 12 tareas de score 90+ que tenés abiertas.

**Un apunte honesto**: mirando ese contexto, esto probablemente no salga alto — competís contra *"Salvar los datos de Meta antes de que los borre (URGENTE)"* [90] y *"BYOK de verdad"* [89]. Y el problema inmediato —que las respuestas de leads no se pierdan— lo resuelve el buzón dedicado en 15 minutos y $0.

