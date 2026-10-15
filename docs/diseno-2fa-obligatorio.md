# El 2FA obligatorio para todos los usuarios, armado como automatizaciones de SuperAdmin (PLAN, 14/10/2026)

> Pedido de Martín (14/10/2026, por el chat «Estrategia 3 cuentas»): activar el 2FA para TODOS los usuarios. Al entrar a
> la app, un mensaje, y además un WhatsApp al grupo de los usuarios. Plazo: hasta el 21/10 a las 24:00. Dos recordatorios,
> el 15/10 y el 21/10 a las 12 del mediodía, **en la hora de cada workspace**. Pasado el plazo, al que no lo configuró se lo
> desloguea, y cada uno se lo configura al volver a entrar. Lo que él listó que falta en Automations: una acción de
> desloguear, la hora del workspace de cada usuario, y que el aviso salga UNA sola vez por usuario. Todo por Automations de
> SuperAdmin, con plantillas: nada de código que avise por detrás.
>
> **Estado: PLAN, no hay nada construido.** Se arma junto con el chat «Ciberseguridad», que es el dueño del 2FA.

## 1. Lo que hay hoy (medido sobre `main` el 14/10/2026)

| Pieza | Hoy | Dónde |
|---|---|---|
| El 2FA | Existe: app de autenticación, códigos por WhatsApp y email, passkeys, códigos de recuperación, dispositivos de confianza. **El super admin ya no tiene sesión sin segundo factor**; el resto, opcional. | mig 0266, `lib/mfa.ts`, `lib/mfa-reglas.ts`, `app/api/auth/2fa` |
| La sesión | Una cookie FIRMADA y sin estado (`exp`, y `mfa` = cómo se probó el segundo factor). **No hay forma de cerrarle la sesión a UN usuario**: no hay `iat` ni una marca por usuario contra la que comparar. `verificarToken` corre sin base (lo usa el proxy). | `lib/auth-session.ts` |
| A quién le escribe el motor | **Sólo a leads** (`nutricion_inscripciones.lead_id not null`). A una persona de `usuarios`, no. Ciberseguridad chocó con lo mismo para mandar los códigos. | `lib/nutricion.ts` |
| Los grupos | Cada negocio tiene UN grupo «MaKo <> {cliente}» (`app_settings` `mako.grupo_jid`); el del super admin aparte (`mako.superadmin.grupo_jid`). **No existe un grupo de «todos los usuarios»**, ni la tarjeta «MaKo a todos los grupos» (regla del 13/10, sin construir). | `lib/mako-grupo.ts` |
| La hora del negocio | Una función: `zonaDelNegocioEstricta` (con la zona por ubicación). Un usuario es de UN workspace (`usuarios.workspace_id`). | `lib/timezone.ts` |
| Un CRON «una fecha a una hora» | El CRON por tiempo existe por automatización, en la zona del negocio de ESA automatización. Uno de SuperAdmin que dé «las 12 de CADA negocio» no existe. | `lib/cron-aviso.ts`, `lib/disparadores.ts` |
| Un aviso en la app, una vez por persona | La esquina de avisos existe; un aviso a una PERSONA que se ve una vez y se marca visto, no. | `app/_components/EsquinaAvisos.tsx` |

## 2. La forma que propongo

**El sujeto es el NEGOCIO, no el usuario.** Lo que Martín pidió pasa por negocio: el grupo es del negocio, las 12 del
mediodía son las del negocio, y el corte es a las 24:00 del negocio. Lo que es por persona (el aviso que se ve una vez,
quién no lo configuró) lo resuelve la acción adentro. Así no hace falta un motor que inscriba usuarios: sale una
automatización de SuperAdmin que corre UNA vez por negocio.

La automatización (una plantilla de SuperAdmin, «2FA obligatorio»):

```
CRON «El 14/10 a las 18:00, en la hora de cada negocio»
  → ⚡ Aviso en la app a los usuarios del negocio («Activá tu 2FA antes del 21/10»), UNA vez por usuario
  → MaKo al grupo del negocio («Tienen hasta el 21/10 a las 24:00 para activar el 2FA»)
  → DELAY hasta el 15/10 a las 12:00 (hora del negocio) → MaKo al grupo (recordatorio 1)
  → DELAY hasta el 21/10 a las 12:00 → MaKo al grupo (recordatorio 2)
  → DELAY hasta el 22/10 a las 00:00 → ⚡ Exigir el 2FA a los usuarios del negocio que no lo tienen
```

## 3. Las piezas nuevas

1. **El sujeto «negocio» para las automatizaciones de SuperAdmin.** Una automatización de SuperAdmin se inscribe por
   workspace (una fila por negocio y automatización), con la hora de ESE negocio para sus esperas. Tabla nueva
   (`automatizacion_negocios`: secuencia, workspace, estado, nodo, próximo envío, hilos) o generalizar
   `nutricion_inscripciones` con `workspace_sujeto` y `lead_id` nullable. Me inclino por la tabla nueva: no le cambia una
   columna a la tabla de los leads, que la lee medio repo.
2. **El CRON «una fecha y hora, en la hora de cada negocio»** y el DELAY «hasta una fecha y hora» (hoy el DELAY es «N
   minutos/horas/días» o «antes de la reunión»).
3. **La tarjeta «MaKo al grupo del negocio»** (la versión SuperAdmin de «MaKo en WhatsApp»): manda por la voz de MaKo al
   `mako.grupo_jid` del negocio que corre. Es la «MaKo a todos los grupos» de la regla del 13/10: una automatización de
   SuperAdmin inscribe a todos los negocios, y cada inscripción le escribe a su grupo. Un negocio sin grupo: se anota y
   sigue (no se inventa un destino).
4. **⚡ «Aviso en la app»** (registro de la API, área nueva o de Ciberseguridad): crea un aviso para los usuarios del
   negocio que se ve UNA vez por persona (tabla `avisos_app` + `avisos_app_vistos (usuario, aviso)`, la esquina lo muestra y
   lo marca). «Una sola vez» queda en la base, no en el navegador.
5. **⚡ «Exigir el 2FA»** en lugar de «Desloguear» (ver §5): marca `usuarios.mfa_exigido_at` en los usuarios del negocio que
   NO tienen ningún factor. Desde esa marca, una sesión sin `mfa` de ese usuario no vale (como hoy la de un admin), y al
   volver a entrar el login le pide enrolar un factor antes de dejarlo pasar. Es de Ciberseguridad (sesión y login).
6. **El destino «usuario»** que Ciberseguridad necesita para los códigos (mandarle a una persona de `usuarios` por WhatsApp o
   email): UNA función, de ellos, que también usa el aviso por persona si Martín lo quiere por WhatsApp individual.

## 4. La migración

- `usuarios.mfa_exigido_at timestamptz` (null = no se le exige).
- `avisos_app` y `avisos_app_vistos`.
- `automatizacion_negocios` (el sujeto negocio).
- Con `revoke` y en `TENANT_TABLES` donde corresponda. Número: el que toque al commitear (hoy va por la 0279).

## 5. Cómo se frena si sale mal

- **«Exigir» y no «Desloguear».** «Desloguear» a secas cierra la sesión de quien SÍ lo configuró (su cookie de hoy puede no
  traer `mfa` si lo activó desde Perfil) y, disparado de más, deja a todos los clientes afuera. «Exigir el 2FA» sólo
  alcanza al que no tiene ningún factor, se pregunta POR USUARIO al ejecutar (no al programar), y es idempotente: correrlo
  dos veces es lo mismo.
- **Reversible**: «Dejar de exigir» (la misma marca en null, por negocio o por usuario) desde el panel de SuperAdmin. Nadie
  queda afuera para siempre por un error.
- **El que lo configuró entre el aviso y el corte** no recibe la marca. Si su sesión de hoy no trae `mfa`, al configurarlo
  desde Perfil se le reemite con `mfa` (a confirmar con Ciberseguridad), así el corte no lo saca.
- **Una vez por negocio**: la inscripción es única por (automatización, negocio); un CRON de fecha fija no reinscribe.
- **«Probar»** dice, por negocio, cuántos usuarios quedarían exigidos, antes de prenderla.
- **Pausar congela** (la regla de la casa): si algo se ve mal, se pausa y nada sigue.
- **El riesgo de quedar afuera porque el enrolamiento falla** (el WhatsApp de los códigos caído): el login le ofrece la app
  de autenticación y la passkey, que no dependen de nada externo, y el email.

## 6. «El 21 a las 24:00 en la hora de cada negocio» es una VENTANA, no un instante

El corte corre a las 00:00 del 22/10 de CADA negocio: con los de hoy (Argentina, México, EE.UU.), entre las 03:00 UTC
(Argentina, UTC−3) y las 07:00 UTC (Tijuana, UTC−7) del 22/10. Un usuario sin workspace (el super admin) ya tiene el 2FA
obligatorio. Se escribe así en la plantilla y en el aviso: «hasta el 21/10 a las 24:00 (tu hora)».

## 7. Lo que decide Martín

1. **«Exigir el 2FA» en vez de «Desloguear»**: hace lo que pidió (al que no lo tiene lo saca y le pide configurarlo al
   volver) y no puede sacar a quien lo tiene. ¿Va?
2. **El «grupo de todos los usuarios»**: no existe uno. ¿Es el grupo «MaKo <> cliente» de cada negocio? Un usuario que no
   está en ese grupo se entera por el aviso en la app.
3. **El aviso en la app**: ¿UNA vez por persona (lo que pidió), o hasta que lo configure?
4. **Los recordatorios**: ¿sólo al grupo, o también a cada usuario (por WhatsApp o email, con el destino «usuario»)?
