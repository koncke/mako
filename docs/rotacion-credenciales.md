# Rotación de credenciales filtradas (14/10/2026)

> **Decisión de Martín (15/10/2026, `rotar-credenciales-docs-chats`): B, «Sólo sacarlas del repo».** No se
> rotan. `docs/chats/` salió del árbol ese día y quedó en `.gitignore`; el historial NO se reescribió, así que
> siguen en `541184cce` y en cada commit hasta el del 15/10. La lista de abajo queda como lo que hay que rotar
> el día que se decida. **Medido el 15/10** (comparando valores, sin imprimirlos): 27 variables del
> `.env.local` del clon tienen el MISMO valor que en `docs/chats/`, y 15 de esas son secretos en uso:
> `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_SECRET`, `META_APP_SECRET`, `PORKBUN_API_KEY`, `PORKBUN_SECRET_KEY`,
> `TELEGRAM_MB_BOT_TOKEN`, `FATHOM_API_KEY`, `FATHOM_API_KEY_MARTIN`, `FATHOM_WEBHOOK_SECRET`, `GEMINI_API_KEY`,
> `PANDA_API_KEY`, `ELEVENLABS_API_KEY_MAURICIO_IMPAGA`, `YOUTUBE_OAUTH_REFRESH_TOKEN`, y las dos de la limpieza
> (`AUTH_COOKIE_VALUE`, `CHATWOOT_WEBHOOK_SECRET`). Las otras 12 son identificadores que no abren nada (ids de
> Meta, Calendly, Panda, la URL de Supabase…). En Vercel no se pudo mirar desde acá.

> **Por qué existe este documento.** El 07/09/2026 se detectó que las transcripciones de `docs/chats/`
> tenían credenciales de producción, se **redactaron**, y la parte de **rotarlas** quedó en una
> conversación. Nunca se hizo. La auditoría del 14/10 las encontró de nuevo, **vivas**: el redactor tapó
> unas líneas y se le escaparon otras, y lo que tapó seguía valiendo igual. **Redactar no es rotar.**
> Este archivo es la lista: una casilla y una fecha por credencial, para que se vea qué falta sin releer
> nada. El detalle de la auditoría, en `docs/hallazgos-seguridad.md` → «Auditoría end-to-end del 14/10».

## Qué pasa si NO se rota

- **Con la key global de Evolution** se lee y se manda WhatsApp como **cualquiera de los clientes
  conectados** (el servidor tiene 11 líneas: las de ws1, ws9, ws10, ws11, ws13, ws15, ws19 y las de MaKo).
  Con su secreto de webhook se meten mensajes falsos en el CRM de cualquiera.
- **Con el token de Vercel**, si sigue vivo, se leen **todas las variables de producción**: la service role
  de Supabase (la base entera, sin RLS) y `CREDENCIALES_SECRET` (todas las claves que conectó cada cliente).
- **Con el secreto de la app vieja de Meta** se firman leads falsos que el server acepta.
- **Con las keys de Porkbun** se cambia el DNS de hola-mako.com: el correo, la verificación de Resend, todo.

Las lee cualquiera con acceso de lectura al repo privado `mbustos-digital/dashboard-marketing`: sus
miembros, cualquier clon o máquina con el repo, o un token de GitHub filtrado. Están en `origin/main` desde
el 08/08 (`541184cce`).

## La lista, en orden de gravedad

Una variable de Vercel se cambia en vercel.com → el proyecto → Settings → Environment Variables, y **no
vale hasta el próximo deploy**. Después de cambiar una, se redespliega.

| ✓ | Credencial | Qué compromete | Dónde se rota | Qué hay que actualizar después | Rotada el |
|---|---|---|---|---|---|
| ☐ | **Token de Vercel `vcp_…`** (el filtrado NO es el `VERCEL_API_TOKEN` actual) | Todo, si sigue vivo | vercel.com/account/tokens: revocar todo token que no se reconozca | nada | |
| ☐ | **Key global de Evolution** (`AUTHENTICATION_API_KEY` del servidor) | El WhatsApp de todos los clientes | railway.app → el servicio de Evolution → Variables | `EVOLUTION_API_KEY` en Vercel, **en el mismo momento**, y redesplegar; y en el `.env.local` del clon | |
| ☐ | **Secreto del webhook de Evolution** (`EVOLUTION_WEBHOOK_SECRET`) | Mensajes falsos en cualquier CRM | se inventa uno nuevo (largo, al azar) | Vercel + `.env.local` del clon, redesplegar, y **re-registrar el webhook de las 11 líneas** (lo corre Claude con un script; mientras tanto los mensajes entrantes rebotan) | |
| ☐ | **`META_APP_SECRET`** (la app VIEJA de leads; NO `MAKO_META_APP_SECRET`) | Leads falsos firmados | developers.facebook.com/apps → la app de leads vieja → Configuración → Básica → Clave secreta → Restablecer | `META_APP_SECRET` en Vercel **en el acto** y redesplegar: si no, se rechazan los leads de verdad | |
| ☐ | **Keys de API de Porkbun** | El DNS de hola-mako.com | porkbun.com/account/api: borrar y crear | la env que las use | |
| ☐ | **Token del bot de Telegram** (`TELEGRAM_MB_BOT_TOKEN`) | El bot | Telegram → @BotFather → /revoke | la env | |
| ☐ | **ElevenLabs** del ws9 | Gasto de voz a costa de MaKo | elevenlabs.io → Settings → API Keys | /integraciones del ws9 | |
| ☐ | **Gemini** del ws9 y del ws10 | Gasto de IA | aistudio.google.com/app/apikey: borrar y crear | /integraciones de cada uno | |
| ☐ | **Fathom del ws9** (API key + `whsec_` del webhook) | Las grabaciones de Martín | Fathom → Settings → API; volver a crear el webhook para un `whsec_` nuevo | /integraciones del ws9 | |
| ☐ | **Panda del ws9** | Los videos | Panda → regenerar la key | /integraciones del ws9 | |
| ☐ | **Fathom del ws1** (key + `whsec_`; el ws4 es la copia de prueba) | Las grabaciones de las llamadas de Mauricio con SUS clientes | lo rota el cliente, o Martín con su permiso | /integraciones del ws1 y del ws4 | |
| ☐ | **Gemini, Panda y YouTube del ws1** | Gasto y cuentas del cliente | ídem; YouTube se revoca en myaccount.google.com/permissions con la cuenta que lo autorizó | /integraciones del ws1 (YouTube: reconectar) | |
| ☐ | **Limpieza**: `AUTH_COOKIE_VALUE`, `DASHBOARD_PASSWORD`, `CHATWOOT_WEBHOOK_SECRET` | Ya no abren nada, pero están filtradas | si siguen en Vercel, se borran | nada | |

⚠️ **Antes de cambiar la variable en Railway**: comprobar que Evolution guarda las sesiones de WhatsApp en su
base o en un volumen. Cambiar una variable reinicia el servicio, y si las sesiones viven sólo en memoria, las
líneas se desconectan y hay que volver a escanear el QR de cada una.

## Después de rotar: qué se hace con `docs/chats`

- ☐ **Decisión de Martín**:
  - **a) Sacarlo del repo y purgar el historial** con `git filter-repo` (recomendado). Va coordinado: es un
    force push, y los ~25 worktrees y clones tienen que volver a sincronizarse.
  - **b) Sólo sacarlo del árbol.** Queda en el historial, aunque ya rotado no sirve para nada.
- ☐ Si se vuelven a exportar transcripciones al repo: con un redactor que tape `whsec_`, `pk1_`/`sk1_`,
  `vcp_`, tokens de bot, keys de Fathom, hex de 32 o más y toda asignación `CLAVE=valor` dentro de una línea.
  Y aun así, **lo que se redacta se rota**.
