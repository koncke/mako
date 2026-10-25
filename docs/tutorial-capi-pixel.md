# Que tus conversiones lleguen a tu píxel de Meta (Conversions API)

*Para el cliente de MaKo. Escrito el 25/10/2026. En la app, los mismos pasos están en Integraciones → Meta Ads → «Token del
píxel» → «?».*

MaKo le avisa a tu píxel de Meta lo que pasa **fuera de tu página**: un contacto que entra por un formulario, uno que
calificas en el CRM y una reunión que alguien agenda. Con eso Meta aprende a buscar gente que califica y que agenda, no
sólo gente que deja sus datos.

## 1. Lo normal: no tienes que pegar nada

Si conectaste Meta con **«Conectar con Facebook»** (Integraciones → Meta Ads), MaKo manda los eventos por esa misma
conexión. Sólo revisa dos cosas:

1. Que en Integraciones → Meta Ads diga **«Conectada»** con tu cuenta publicitaria.
2. Que esté elegido **tu píxel** (si tienes varios, MaKo te pregunta cuál).

Listo. No hace falta el token de Meta ni crear una app.

## 2. Cuándo hace falta el «Token del píxel»

Sólo si MaKo te avisa que tus eventos **no llegan al píxel** (la ficha del contacto lo dice en su historial, y el
«Probar» de Meta Ads lo marca). Pasa cuando el píxel vive en otro negocio de Meta, o cuando la conexión no tiene permiso
sobre él. Entonces generas un token que sirve sólo para ese píxel:

1. Entra a **business.facebook.com/events_manager2** (el «Administrador de eventos»).
2. Elige **tu píxel** en la lista de la izquierda y abre la pestaña **«Configuración»**.
3. Baja hasta **«API de conversiones»** y toca **«Generar token de acceso»**. Sigue la ventana que se abre (sólo la ve un
   administrador del negocio).
4. Copia el token: empieza con **EAA** y **se ve una sola vez**.
5. En MaKo, Integraciones → Meta Ads → **«Token del píxel»**, pégalo y guarda. El «Probar» te dice si llega a tu píxel.

No hace falta pasar por la revisión de apps de Meta ni pedir permisos: el token lo crea Meta para ese píxel.

## 3. Tu página también tiene el píxel: cómo no contar dos veces

El píxel de **tu página** lo pegas tú (en Lovable, Webflow, WordPress…). Si tu página **y** MaKo le mandan a Meta el mismo
evento (por ejemplo, «Schedule» cuando alguien agenda), Meta lo cuenta **dos veces**, salvo que los dos lleven **el mismo
identificador del evento**:

- En tu página, el identificador va como cuarto dato del `fbq`:
  `fbq('track', 'Schedule', {}, { eventID: 'el-mismo-id' });`
- MaKo manda el suyo como `event_id`. Meta junta los dos si tienen **el mismo nombre de evento y el mismo id**, y llegan
  dentro de **48 horas**.

Lo que hace MaKo para que no te pase:

- **Las páginas de MaKo** ya mandan el id correcto: no tienes que hacer nada.
- **Si tu página manda «Schedule» sin id** al mismo píxel, MaKo **no lo repite**: lo deja anotado en el historial del
  contacto y Meta lo cuenta una vez, el de tu página.
- **Si vas a agregar un evento a tu página** (Lead, Schedule), pregúntale primero a MaKo si ya lo manda: dos emisores sin
  el mismo id cuentan doble.

> Caso real (24/10/2026): una página disparaba `fbq('track','Schedule')` sin id al reservar en Calendly y MaKo mandaba
> Schedule al mismo píxel con su propio id. Meta contó 3 de 8 reservas dos veces. Se arregló con un id común
> (`schedule:<id de la reserva de Calendly>`) y con MaKo callándose cuando la página ya lo manda.

## 4. Qué le manda MaKo a tu píxel

| Evento | Cuándo | Identificador |
|---|---|---|
| `Lead` | entra un contacto por un formulario de Meta | `lead:<id del formulario>` |
| `SubmitApplication` y `QualifiedLead` | marcas «calificado» en el CRM | `calif:<contacto>` |
| `Schedule` | alguien agenda en Calendly | `schedule:<id de la reserva>` |

MaKo **no** manda hoy la venta (`Purchase`), ni el contacto de una página de opt-in, ni las reservas de Cal.com.

## 5. Probar que llega, sin ensuciar el píxel

En el Administrador de eventos → tu píxel → **«Probar eventos»** Meta te da un código (`TEST…`). Los eventos que llegan con
ese código se ven ahí y **no cuentan** en tus datos. MaKo lo usa para la prueba de su propia cuenta.

---

*Para el equipo:* el camino en el código es `lib/meta-capi.ts` (Zernio primero, `POST /v1/ads/conversions`; si Zernio no
tiene permiso sobre el píxel, la Graph API con `META_CAPI_TOKEN`; el `META_ACCESS_TOKEN` de antes, de respaldo). Lo
medido y lo que falta medir: `docs/hallazgos-integraciones.md` → «Meta entero por la Zernio del negocio». Fuentes:
developers.facebook.com/docs/marketing-api/conversions-api/get-started y …/deduplicate-pixel-and-server-events (leídas
el 25/10/2026); docs.zernio.com/platforms/meta-ads/conversions.
