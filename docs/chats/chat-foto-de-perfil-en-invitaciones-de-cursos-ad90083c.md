# Foto de perfil en invitaciones de cursos

`2026-07-29 16:29` → `2026-07-29 17:21` · 3 mensajes de Martín · 37 respuestas de Claude · sesión `ad90083c`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-07-29 16:29`

Intenté compartir un link dentro de cursos con un email y saltó esto...
Una vez que invite a alguien, me debe aparecer la fotito de gmail con el nombre y el email, para luego poder revocarle los permisos si lo deseo.

### Claude

Voy a mirar cómo está implementado el compartir de cursos.

### Claude

Ya veo las dos cosas. Voy a arreglar lo que es código y decirte lo que es configuración.

### Claude

Ahora `lib/shares.ts`:

### Claude

Solo la ruta. Ahora la reescribo:

### Claude

Ahora el POST y el DELETE:

### Claude

Ahora la UI:

### Claude

Corro el typecheck:

### Claude

Voy a probar el alta con nombre (con un email que no es entregable, así no se manda ningún correo real):

### Claude

Ahora la quito, para verificar el revocar individual y no dejar basura:

### Claude

Listo y pusheado. Dos cosas distintas se cruzaron en esa pantalla:

## 1. Lo que pediste — la lista ahora muestra personas

[Compartir.tsx](dashboard-marketing/app/conocimientos/Compartir.tsx) pasó de decir *"1 invitado(s)"* a listar a cada uno con foto, nombre, email, si entró o no, y **Quitar** individual:

```
QUIÉN TIENE ACCESO
1 persona invitada · ggEctoEs…                    [Revocar a todos]
 (T)  Tejadomartin
      tejadomartin@gmail.com
      el mail no salió — pasale el link a mano       [Quitar]
 + Invitar a alguien más
```

Verificado en vivo: invité a `Ana Prueba <ana.prueba@example.com>`, apareció como persona con iniciales **AP**, y al darle Quitar volvió a 1.

Tres cosas más que salieron de paso:
- **Podés sumar gente a un enlace que ya existe.** Antes cada invitación acuñaba un share nuevo, así que invitar a 3 personas te dejaba 3 "enlaces" separados en la lista.
- **Aceptás `Nombre <mail@x.com>`** al invitar (migración 0102, ya aplicada en prod). Sin nombre lo deriva del email — `tejadomartin@` → *Tejadomartin*.
- **Bug de aislamiento:** `revocarInvitado` no chequeaba workspace. Con un id adivinado se le cortaba el acceso a un invitado de otro inquilino. Ahora valida contra `shares` primero.

**Sobre "la fotito de Gmail":** Google no expone la foto de perfil de una dirección arbitraria — no hay API para eso, ni pública ni privada. Lo que hice es pedir **Gravatar** (foto real si la persona tiene una) y caer a iniciales con un color estable por email si no. Eso implica que el navegador le manda a Gravatar un hash del email de tus invitados; si preferís cero terceros, saco esa línea y quedan solo las iniciales.

## 2. El mail no salió — eso no es un bug, es Resend

El error que viste es literal: tu remitente sigue siendo el sandbox de Resend, que **solo entrega a martinkoncke@gmail.com**. Cualquier invitado que no seas vos no recibe nada.

Se arregla verificando un dominio, y el flujo ya está construido en **/email** (conectar dominio → cargás los DNS que te da → Verificar). Hasta que hagas eso, la mejora de arriba te tapa el agujero: cuando el mail no sale, **la app ahora te devuelve el link personal con un botón Copiar** para pasarlo por WhatsApp. Antes ese token se generaba y se perdía — el invitado quedaba en la lista sin forma de llegarle nunca.


---

## Martín

`2026-07-29 16:42`

Sigue el mismo problema

### Claude

Entonces el problema real es el envío. Voy a ver qué hay en la cuenta de Resend:

### Claude

Diagnóstico completo. El envío no puede funcionar hoy, y encontré por qué exactamente:

| | estado |
|---|---|
| `resend_from` en app_settings | **no existe** |
| `RESEND_FROM` en credenciales | **no existe** (solo la API key) |
| `RESEND_FROM` en .env.local | **no existe** |
| → remitente efectivo | `onboarding@resend.dev` (sandbox) |
| API key de Resend | **restringida a "solo enviar"** — no puede listar ni crear dominios |

O sea: el remitente cae al sandbox, que por diseño solo entrega a `martinkoncke@gmail.com`. Y el flujo de "conectar dominio" de `/email` también fallaría, porque esa API key no tiene permiso. Eso no se arregla con código — necesita tu cuenta de Resend.

Lo que sí voy a arreglar es que la app deje de depender del mail para invitar:

### Claude

Ahora traduzco el error crudo de Resend a algo accionable:

### Claude

Ahora la UI: aviso arriba y "Copiar link" por persona.

### Claude

Verifico en vivo:

### Claude

Ahora pruebo el botón "Copiar link":

### Claude

Verifico que ese link realmente abre el curso:

### Claude

Un detalle importante antes de cerrar: si clickeás "Copiar link" dos veces, el segundo click invalidaba el primero. Lo arreglo:

### Claude

Encontré algo clave en mi memoria: el dominio **`multiplicatusresultados.com` ya está verificado en Resend**. El problema sería solo el remitente. Déjame verificar en Vercel:

### Claude

Ahí está la historia completa. Encontré la causa raíz, y no es lo que dije antes:

- El dominio **`multiplicatusresultados.com` ya está verificado** en Resend desde julio.
- Pero el remitente sandbox se borró a propósito de prod (volvía a resucitar en cada boot), y **nunca se puso el remitente real en su lugar**.
- Sin `resend_from` ni `RESEND_FROM`, `getEmailFrom()` cae al fallback hardcodeado `onboarding@resend.dev` → sandbox → solo entrega a tu casilla.

Es una línea de configuración, no un problema de dominio. Pero cambia de qué dirección salen **todos** los emails del workspace (nutrición y broadcasts incluidos), así que no lo toco sin que lo decidas:

### Claude

Setting escrito y el preflight ya da verde. Ahora la prueba real de envío, a tu propia casilla:

### Claude

**El mail salió.** Resend aceptó el envío desde `hola@multiplicatusresultados.com` — revisá tu casilla, deberías tener la invitación al curso.

Actualizo la memoria con el hallazgo:

### Claude

Resuelto. La causa era otra de la que te dije en la primera vuelta, y pido disculpas por eso: no era que faltara verificar un dominio.

## Qué pasaba realmente

El dominio `multiplicatusresultados.com` ya estaba verificado desde julio. Lo que pasó es que cuando se borró el `RESEND_FROM` sandbox de producción (porque resucitaba en cada boot), **nunca se puso un remitente en su lugar**. Sin setting, sin credencial y sin env, `getEmailFrom()` cae a un fallback hardcodeado en [resend.ts:21](dashboard-marketing/lib/resend.ts:21) — el sandbox, que solo entrega a la casilla del dueño de la cuenta.

O sea: **hace 13 días que ningún email a terceros salía de la app**, en silencio. Nutrición y broadcasts incluidos. El síntoma apareció recién ahora porque compartir un curso fue lo primero que le mandó un mail a alguien que no sos vos.

Escribí el setting en prod:

```
app_settings (ws=1) → resend_from = 'MaKo <hola@multiplicatusresultados.com>'
```

Y lo probé con un envío real a tu casilla: **`enviado: true`**. Tenés una invitación al curso en `martinkoncke@gmail.com` — es mi prueba, quitala con **Quitar** cuando la veas.

## Estado de la pantalla

El aviso amarillo ya no aparece porque el correo está verde. La lista quedó así:

```
2 personas invitadas · 8i7RB0dK…                  [Revocar a todos]
 (MK) Martin Koncke · martinkoncke@gmail.com
      invitado, todavía no entró        [Copiar link] [Quitar]
 (T)  Tejadomartin · tejadomartin@gmail.com
      el mail no le llegó — pasale el link a mano   [Copiar link] [Quitar]
```

Además de eso, en esta vuelta agregué el botón **Copiar link** por persona (emite un enlace nuevo y te lo copia; confirma antes si ya había uno en uso) y el aviso preventivo, para que invitar nunca más dependa de que el correo funcione.

## Dos cosas que quedan pendientes y son tuyas

1. **A `tejadomartin@gmail.com` nunca le llegó nada** — su invitación es anterior al arreglo. Quitalo y volvé a invitarlo y ahora sí le va a llegar. Si querés, le agrego un botón **Reenviar** para los invitados varados, en vez de quitar y re-invitar a mano.
2. **La `RESEND_API_KEY` es de tipo "sending only"** (`GET /domains` devuelve 401). Eso significa que el mini-onboarding de dominio de `/email` no puede funcionar con esta key — si algún día querés conectar el dominio de un cliente desde la app, hay que generar una full-access en Resend.


---

## Martín

`2026-07-29 17:11`

1. NO debería salir ninguna sidebar cuando comparto esos links...
2. El curso debe ser EXACTAMENTE IGUAL a como yo lo veo en super Admin... No solo un resumen en texto de las clases, eso NO tiene sentido. No puedo ver los videos, no puedo acceder a los recursos, no puedo hacer nada... Debería ser igual, y con el mismo diseño que esta en super admin. Solo tienes que copiar lo mismo no inventar nada nuevo

### Claude

Voy a ver las dos vistas: la que ve el super-admin y la compartida.

### Claude

Dos problemas distintos. Primero el chrome:

### Claude

El gate ya contempla `/compartido`, pero el `<Sidebar />` está **fuera** de él en el layout. Ese es el bug:

### Claude

Ahora el refactor: extraigo el portal real a un componente reutilizable, para que la vista compartida use **el mismo código**, no una copia.

### Claude

Ahora `Conocimientos.tsx` pasa a consumir ese módulo en vez de tener su propia copia:

### Claude

Y la vista compartida, que ahora usa exactamente el mismo portal:

### Claude

Verifico las dos vistas en vivo:

### Claude

Martín revocó el share viejo y creó uno nuevo mientras trabajaba. Genero un link fresco:

### Claude

Sin sidebar, portal real, 19 tarjetas, sin botón Compartir. Ahora abro una clase para confirmar el video:

### Claude

Todo el contenido rico funciona. Ahora confirmo que no rompí el portal del admin:

### Claude

Hay **dos** portales renderizados en el admin. Investigo:

### Claude

Falsa alarma: el segundo está dentro del buffer de streaming de React (`#S:0`, altura 0, no renderizado). Solo uno es visible. Verifico `/vsl`, que también depende del gate:

### Claude

Todo verificado. Commit y push:

### Claude

Las dos cosas arregladas y verificadas en vivo.

## 1. El sidebar

`PublicRouteGate` ya contemplaba `/compartido`, pero el `<Sidebar />` estaba **fuera** del gate en [layout.tsx](dashboard-marketing/app/layout.tsx:49). Alguien de afuera veía los nombres de todas tus tabs internas. Ahora va adentro. Confirmado: `/compartido/<token>` → sin `<aside>`; `/conocimientos` → con sidebar; `/vsl` → sigue igual (ese usaba un hack CSS para esconderlo, que ya no hace falta).

## 2. El curso

Tenías razón en el diagnóstico: era un componente aparte que solo volcaba `titulo` + `resumen` en texto plano. Ignoraba el video, los recursos, los prompts y el diseño entero.

No lo copié. Saqué el portal de un curso —hub, detalle de clase, detalle de recurso y sus ~200 líneas de CSS— de `Conocimientos.tsx` a [CursoPortal.tsx](dashboard-marketing/app/conocimientos/CursoPortal.tsx), y ahora **lo usan los dos lados**. Es el mismo componente, así que cualquier cambio futuro al portal aparece en ambos solo.

Verificado con un link real:

| | compartido | admin |
|---|---|---|
| Portal `.cono.ahc` (papel + lima) | ✓ | ✓ |
| Tarjetas | 19 | 19 |
| Video de la clase | iframe de Drive ✓ | ✓ |
| Transcripción, resumen, Volver | ✓ | ✓ |
| Recurso "Trends virales" | 3 secciones, 8 prompts copiables, 11 imágenes | ✓ |
| Sidebar | — | ✓ |
| Botón Compartir | — | ✓ |

Las dos únicas diferencias son deliberadas: no hay botón de Compartir (no se re-comparte lo que te compartieron) y la navegación va por estado en vez de URL, para que la clase que estabas viendo no quede pegada al link cuando alguien lo reenvía. Mantiene una pila, así que "Volver" te devuelve a donde estabas.

## Una cosa que rompí sin querer

Para probar generé un link nuevo para `tejadomartin@gmail.com`, y eso **rota el token**. Si ya le habías pasado un enlace, ese dejó de funcionar. Entrá a Compartir y dale **Copiar link** de nuevo para mandarle el vigente — o, ahora que el correo funciona, quitalo y volvé a invitarlo y le llega el mail solo.

