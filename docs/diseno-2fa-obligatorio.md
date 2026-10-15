# El 2FA obligatorio para todos los usuarios, armado como automatizaciones de SuperAdmin (PLAN, 14/10/2026)

> Pedido de Martín (14/10/2026, por el chat «Estrategia 3 cuentas»): activar el 2FA para TODOS los usuarios. Al entrar a
> la app, un mensaje, y además un WhatsApp al grupo de los usuarios. Plazo: hasta el 21/10 a las 24:00. Dos recordatorios,
> el 15/10 y el 21/10 a las 12 del mediodía, **en la hora de cada workspace**. Pasado el plazo, al que no lo configuró se lo
> desloguea, y cada uno se lo configura al volver a entrar. Lo que él listó que falta en Automations: una acción de
> desloguear, la hora del workspace de cada usuario, y que el aviso salga UNA sola vez por usuario. Todo por Automations de
> SuperAdmin, con plantillas: nada de código que avise por detrás.
>
> **Estado: PLAN acordado entre Automations y Ciberseguridad (14/10 ~20:00); falta que Martín decida §7.** Nada construido.

## 1. Lo que hay hoy (medido sobre `main` y en prod el 14/10/2026)

| Pieza | Hoy | Dónde |
|---|---|---|
| El 2FA | Existe y **el super admin ya no tiene sesión sin segundo factor**; el resto, opcional. **Hoy el único método para enrolar es la app de autenticación**: los códigos por WhatsApp y por email no están disponibles (`canalDisponible` = ninguno, es la tanda 2 de Ciberseguridad) y la passkey no puede ser el primer factor (sólo en el celular y después del 2FA, `4a0fbe1a3`). | mig 0266, `lib/mfa.ts`, `lib/mfa-reglas.ts`, `app/api/auth/2fa` |
| La sesión | Cookie FIRMADA y sin estado (`exp`, `mfa`). `verificarToken` corre sin base (el proxy). **Activar un método desde Perfil ya reemite la sesión con `mfa`**, y `getUsuarioActual` ya rechaza una cookie sin `mfa` de quien tiene el 2FA activo: las sesiones viejas caen en el momento en que lo activa. | `lib/auth-session.ts`, `lib/auth.ts:53`, `app/api/perfil/seguridad/route.ts` |
| A quién le escribe el motor | **Sólo a leads.** Y `usuarios` NO tiene teléfono: el único es `usuario_mfa.whatsapp_tel`, de quien ya activó el código por WhatsApp. A quien le falta el 2FA, sólo se le puede escribir por email (el de Google) o al grupo. | `lib/nutricion.ts` |
| Los grupos | Cada negocio tiene UN grupo «MaKo <> {cliente}» (`mako.grupo_jid`). **No existe un grupo de «todos los usuarios»**, ni la tarjeta «MaKo a todos los grupos» (regla del 13/10, sin construir). | `lib/mako-grupo.ts` |
| La hora del negocio | `zonaDelNegocioEstricta`. **4 de los 13 workspaces no tienen zona guardada** (cae a la detectada, `zona-horaria-por-ubicacion`). El ws19 está en Europe/Madrid. | `lib/timezone.ts` |
| El censo (prod, 14/10) | 12 usuarios: 9 activos y 3 invitados que nunca entraron. **11 sin 2FA** (sólo Martín lo tiene). Cada negocio tiene UN usuario, su admin. 5 no entran hace más de 30 días. | — |

## 2. La forma acordada

**El corte es una FECHA del negocio que se calcula, no una acción que se dispara** (propuesta de Ciberseguridad):
`workspaces.mfa_obligatorio_desde timestamptz`. Una función pura, `requiereSegundoFactor(rol, mfaActivo, obligatorioDesde,
ahora)`, la leen el callback de Google y `getUsuarioActual`: desde esa fecha, un usuario del negocio sin 2FA no tiene sesión
y el login lo manda a `/login/2fa`, que ya permite enrolar sin sesión con 0 factores. `verificarToken` no cambia: una sesión
que `getUsuarioActual` rechaza resuelve el workspace a null y NO cae al ws1 (`lib/workspace.ts:265`).

- Alcanza también a los usuarios que se creen después (una marca por usuario no).
- Es idempotente y reversible (null, u otra fecha).
- Marca a TODOS los del negocio, también a quien ya cumplió: Seguridad no deja borrar el último método si el negocio lo exige.
- No hace falta un DELAY hasta el corte ni nada que corra a esa hora.

La automatización (una plantilla de SuperAdmin, «2FA obligatorio»), con el sujeto NEGOCIO:

```
CRON «el 14/10 a las 18:00, en la hora de cada negocio»
  → ⚡ Exigir el 2FA desde «22/10 00:00 en la hora del negocio»   (escribe la fecha; el corte es la fecha)
  → ⚡ Aviso en la app a los usuarios del negocio, UNA vez por usuario
  → MaKo al grupo del negocio
  → DELAY hasta el 15/10 a las 12:00 (hora del negocio) → MaKo al grupo (recordatorio 1)
  → DELAY hasta el 21/10 a las 12:00 → MaKo al grupo (recordatorio 2)
```

## 3. Las piezas y de quién son

| Pieza | Dueño |
|---|---|
| `workspaces.mfa_obligatorio_desde`, `requiereSegundoFactor`, el callback y `getUsuarioActual`, que no se pueda borrar el último método | Ciberseguridad |
| ⚡ «Exigir el 2FA desde una fecha» (área nueva `seguridad`, `rolMinimo: 'admin'`) | Ciberseguridad |
| `destinoDeUsuario(usuarioId, canal, propósito)` (puro): 'aviso' → el email o el WhatsApp verificado; 'codigo' → sólo lo verificado, con el JID canonizado | Ciberseguridad |
| «Abrir en la app de autenticación» (`otpauth://`) para quien entra sólo desde el teléfono | Ciberseguridad |
| El sujeto «negocio» para las automatizaciones de SuperAdmin (tabla `automatizacion_negocios`, con la hora de ESE negocio para sus esperas) | Automations |
| El CRON «una fecha y hora en la hora de cada negocio» y el DELAY «hasta una fecha y hora» | Automations (⚠️ el DELAY lo toca `crm-bloques-b5`: se coordina con el CRM) |
| La tarjeta «MaKo al grupo del negocio» (la «MaKo a todos los grupos» del 13/10) | Automations |
| ⚡ «Aviso en la app, una vez por usuario» (`avisos_app` + `avisos_app_vistos`; para su condición, `tieneSegundoFactor(uid)` de Seguridad) | Automations |
| El sujeto «usuario» en el motor y la tarjeta que le manda (sólo si Martín quiere recordatorios por persona, §7-4) | Automations |

⚠️ **Un `codigo` es SECRETO** (para la tanda 2 de Seguridad, no para el 21/10): no se guarda en el ctx de la corrida
(`flujo_corridas`), no va al feed, al push ni a la conversación del doer (`emitirAviso` los copia), no se loguea; Publicar
exige `{{codigo}}` y ningún DELAY antes.

## 4. La migración

- Ciberseguridad: `workspaces.mfa_obligatorio_desde`.
- Automations: `avisos_app`, `avisos_app_vistos` y `automatizacion_negocios`, con `revoke` y en `TENANT_TABLES` donde
  corresponda. Los números, los que toquen al commitear.

## 5. Cómo se frena si sale mal

- **Nunca saca a quien cumplió**: al activar el 2FA la sesión se reemite con `mfa`, y la regla mira el factor de cada usuario
  en cada request.
- **Reversible**: la fecha en null (o una más adelante) por negocio. Nadie queda afuera para siempre por un error.
- **Una vez por negocio**: la inscripción es única por (automatización, negocio); un CRON de fecha fija no reinscribe.
- **«Probar»** dice, por negocio, cuántos usuarios quedarían sin entrar, antes de prenderla.
- **Pausar congela**: si algo se ve mal, se pausa y nada sigue. La fecha ya escrita se corre a mano (o con la ⚡ otra vez).
- **El riesgo de quedar afuera porque el enrolamiento falla**: hoy el único método es la app de autenticación, que no
  depende de nada externo. Si esa pantalla se rompe, la fecha se corre.

## 6. «El 21 a las 24:00 en la hora de cada negocio» es una VENTANA, no un instante

El corte es las 00:00 del 22/10 de CADA negocio: con las zonas de hoy, desde el **21/10 a las 22:00 UTC** (Madrid, el ws19,
UTC+2) hasta el **22/10 a las 07:00 UTC** (Tijuana, UTC−7). Los 4 negocios sin zona guardada usan la detectada. El aviso
lo dice así: «hasta el 21/10 a las 24:00 (tu hora)».

## 7. Lo que decide Martín

1. **«Exigir el 2FA desde una fecha» en vez de «Desloguear»**: hace lo que pidió (al que no lo tiene no lo deja entrar y le
   pide configurarlo al volver) y no puede sacar a quien lo tiene. ¿Va?
2. **El «grupo de todos los usuarios»**: no existe uno. ¿Es el grupo «MaKo <> cliente» de cada negocio? Hoy cada negocio
   tiene un solo usuario, su admin.
3. **El aviso en la app**: ¿UNA vez por persona (lo que pidió), o hasta que lo configure?
4. **Los recordatorios**: ¿sólo al grupo, o también a cada usuario? Por persona hoy sólo puede ser por email (`usuarios` no
   tiene teléfono).
