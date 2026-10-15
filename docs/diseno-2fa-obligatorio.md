# El 2FA obligatorio para todos los usuarios, armado como automatizaciones de SuperAdmin (PLAN, 14/10/2026)

> Pedido de Martín (14/10/2026, por el chat «Estrategia 3 cuentas»): activar el 2FA para TODOS los usuarios. Al entrar a
> la app, un mensaje, y además un WhatsApp al grupo de los usuarios. Plazo: hasta el 21/10 a las 24:00. Dos recordatorios,
> el 15/10 y el 21/10 a las 12 del mediodía, **en la hora de cada workspace**. Pasado el plazo, al que no lo configuró se lo
> desloguea, y cada uno se lo configura al volver a entrar. Lo que él listó que falta en Automations: una acción de
> desloguear, la hora del workspace de cada usuario, y que el aviso salga UNA sola vez por usuario. Todo por Automations de
> SuperAdmin, con plantillas: nada de código que avise por detrás.
>
> **Estado: PLAN acordado entre Automations y Ciberseguridad (14/10 ~20:00); falta que Martín decida §7.** De Automations,
> nada construido. La ⚡ de Seguridad está escrita (14/10 ~22:00, rama local `2fa-obligatorio`, sin commitear): §3.

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
  → ⚡ exigir_2fa_desde(fecha 2026-10-21, hora 24:00, negocio_id del sujeto)   (escribe la fecha; el corte es la fecha)
  → ⚡ Aviso en la app a los usuarios del negocio, UNA vez por usuario
  → MaKo al grupo del negocio
  → DELAY hasta el 15/10 a las 12:00 (hora del negocio) → MaKo al grupo (recordatorio 1)
  → DELAY hasta el 21/10 a las 12:00 → MaKo al grupo (recordatorio 2)
```

## 3. Las piezas y de quién son

| Pieza | Dueño |
|---|---|
| `workspaces.mfa_obligatorio_desde`, `requiereSegundoFactor`, el callback y `getUsuarioActual`, que no se pueda borrar el último método | Ciberseguridad |
| ⚡ «Exigir el 2FA desde una fecha»: **escrita** (abajo) | Ciberseguridad |
| Sumar `exigir_2fa_desde` a `ACCIONES_DEL_FLUJO` (`lib/editor-acciones.ts`), para que el lienzo la ofrezca curada | Automations |
| `destinoDeUsuario(usuarioId, canal, propósito)` (puro): 'aviso' → el email o el WhatsApp verificado; 'codigo' → sólo lo verificado, con el JID canonizado | Ciberseguridad |
| «Abrir en la app de autenticación» (`otpauth://`) para quien entra sólo desde el teléfono | Ciberseguridad |
| El sujeto «negocio» para las automatizaciones de SuperAdmin (tabla `automatizacion_negocios`, con la hora de ESE negocio para sus esperas). ⚠️ **El negocio es un DATO de la corrida, no el ws donde corre**: todos los pasos corren con `ctxDeFlujo(<ws de SuperAdmin>, …)` y le pasan el negocio como blanco («MaKo al grupo del negocio» busca el grupo de ESE negocio, sin `runWithWorkspace`). Si un paso corriera con `ctx.ws` = el negocio, la ⚡ se rechazaría siempre, y con razón. | Automations |
| El CRON «una fecha y hora en la hora de cada negocio» y el DELAY «hasta una fecha y hora» | Automations (⚠️ el DELAY lo toca `crm-bloques-b5`: se coordina con el CRM) |
| La tarjeta «MaKo al grupo del negocio» (la «MaKo a todos los grupos» del 13/10) | Automations |
| ⚡ «Aviso en la app, una vez por usuario» (`avisos_app` + `avisos_app_vistos`; para su condición, `tieneSegundoFactor(uid)` de Seguridad) | Automations |
| El sujeto «usuario» en el motor y la tarjeta que le manda (sólo si Martín quiere recordatorios por persona, §7-4) | Automations |

**La ⚡ como la dejó Seguridad (14/10).** Va en el área `equipo`, no en una nueva: un área nueva eran seis lugares de
cañería para tres operaciones.
- `exigir_2fa_desde`: `fecha` (AAAA-MM-DD, obligatoria), `hora` (HH:MM de 00:00 a 24:00; sin hora, 24:00) y `negocio_id`
  (sin él, TODOS los negocios). Recibe el DÍA y no el instante porque MaKo la usa por chat («exigí el 2FA desde el 21 a
  las 24») y ahí nadie le pasa un instante. La zona de cada negocio la resuelve ella (`zonaDelNegocioEstricta` + las dos
  pasadas de `instanteDe`). Si ya lo exigen desde esa fecha, contesta `yaEstaba` (éxito sin hacer nada); si la fecha ya
  pasó, el resumen dice «se exige YA».
- `dejar_de_exigir_2fa` (`negocio_id` opcional) y `ver_exigencia_2fa`: la lectura del «Probar». Devuelve, por negocio, la
  fecha en su hora, cuántos usuarios tiene y cuántos están sin 2FA.
- **`soloPlataforma`**: gating por capa (`vistaDe`/`gatingOk`). Un negocio no la ve, y preparar y ejecutar vuelven a
  preguntar. Sin eso, un admin de cliente podía «dejar de exigir» en el suyo. Mira el ws donde CORRE el paso
  (`ctx.ws`), nunca el `negocio_id`, que es sólo el blanco. Una plantilla copiada a un negocio corre con `ctx.ws` = ese
  negocio: ahí la ⚡ no aparece en el lienzo, y un paso ya guardado con ella se rechaza al preparar («Sólo la plataforma
  decide el 2FA de los negocios.»).
- Canales: whatsapp y app, sin http. Corre en el ws de la plataforma. La plantilla la llama una vez POR NEGOCIO, con el
  `negocio_id` del sujeto: el resto del flujo (los recordatorios a las 12 de cada uno) ya es por negocio.
- Para el aviso en la app: `tieneSegundoFactor(uid)` (lib/mfa.ts) TIRA si no puede leer, y así a quien ya cumplió no se
  le avisa por un error de lectura. La fecha del negocio sale de `obligatorioDesdeDe(ws)` (lib/mfa-obligatorio.ts).
  `/api/perfil/seguridad` ya devuelve `obligatorioDesde`, y Seguridad lo muestra: «Obligatorio desde el 22/10, 00:00».

⚠️ **Un `codigo` es SECRETO** (para la tanda 2 de Seguridad, no para el 21/10): no se guarda en el ctx de la corrida
(`flujo_corridas`), no va al feed, al push ni a la conversación del doer (`emitirAviso` los copia), no se loguea; Publicar
exige `{{codigo}}` y ningún DELAY antes.

## 4. La migración

- Ciberseguridad: `workspaces.mfa_obligatorio_desde` (`0283_mfa_obligatorio.sql`, número sin confirmar). La lectura
  tolera que la columna no exista, así que el orden de despliegue da igual. Lo único: aplicarla ANTES de correr la ⚡.
- Automations: `avisos_app`, `avisos_app_vistos` y `automatizacion_negocios`, con `revoke` y en `TENANT_TABLES` donde
  corresponda. Los números, los que toquen al commitear.

## 5. Cómo se frena si sale mal

- **Nunca saca a quien cumplió**: al activar el 2FA la sesión se reemite con `mfa`, y la regla mira el factor de cada usuario
  en cada request.
- **Reversible**: la fecha en null (o una más adelante) por negocio. Nadie queda afuera para siempre por un error.
- **Una vez por negocio**: la inscripción es única por (automatización, negocio); un CRON de fecha fija no reinscribe.
- **«Probar»** dice, por negocio, cuántos usuarios quedarían sin entrar, antes de prenderla (`ver_exigencia_2fa`).
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
5. **Un negocio que se crea DESPUÉS de correr la ⚡ nace sin la fecha.** La salida simple es volver a correrla (es
   idempotente). ¿O que el alta del negocio la herede sola? Es una línea en el alta, de Seguridad.

## 8. El aviso «¿No has sido tú?» (pedido del 14/10, acordado con Ciberseguridad)

> Pedido de Martín: «es importante que en cada dispositivo salte [el 2FA]... Y lo mismo que google, que te manda un email
> de "¿No has sido tú?" cuando se ingresa desde otro dispositivo... Y que dentro de MaKo se puedan ver los dispositivos
> vinculados». Lo de Seguridad (los equipos, las sesiones, la pantalla) está en docs/diseno-dispositivos-vinculados.md.
> Acá va lo de Automations. **No se construye hasta que Martín conteste las decisiones de ese documento (§5).**

⚠️ **Lo medido primero (Seguridad, 14/10): el 2FA de la cuenta de super admin NO se salteó.** El login de ese momento fue
de OTRA cuenta, admin de un negocio y sin 2FA porque hoy es opcional. La de super admin no entraba desde antes, y ese
login sí pidió el código. El diagnóstico obvio («el 2FA no pide código en un dispositivo nuevo») era el equivocado.

El mail no es un `sendEmail` en el camino del login: es una automatización de SuperAdmin, con su evento.
- **El evento:** `ingreso_nuevo` en `EVENTOS_MAKO` (aviso `seguridad-ingreso-nuevo`, «Alguien entra desde un dispositivo
  nuevo», `trae: ['ingreso']`).
  - Lo emite Seguridad al EMITIR la sesión (después del 2FA), con `after()` y en el ws de la plataforma.
  - «Nuevo» = el equipo no es de los conocidos de esa persona Y ya tenía al menos uno. Sin la segunda mitad, el día del
    deploy le llega a todos.
  - Una vez por aparato: `dedupKey = ingreso:<uid>:<equipo>`.
- **Los datos** (`datos:`, atómicos; las claves son las del «{ }»):

  | Clave | Rótulo | Citable |
  |---|---|---|
  | `ingreso_dispositivo` | Dispositivo | sí |
  | `ingreso_at` | Cuándo entró. El ISO lo formatea el resolver en la hora del negocio. | sí |
  | `ingreso_ubicacion` | Ubicación aproximada. Opcional: ausente si falta, en su renglón. Sólo si Martín elige guardarla. | sí |
  | `link_dispositivos` | Tus dispositivos: appUrl + `/perfil/seguridad#dispositivos`. Lo arma Automations; NO es un dato del evento. | sí |
  | `ingreso_usuario_id`, `ingreso_negocio_id`, `ingreso_dispositivo_id` | El destino, la zona y el dedup | no (ocultas) |

- **El destino:** a QUIEN ENTRÓ.
  - `DestinoMensaje` suma `'usuario'`.
  - La dirección la da `destinoDeUsuario(ingreso_usuario_id, 'email', 'aviso')` (de Seguridad), nunca un dato del evento.
  - Sale por el remitente de la plataforma (`equipo@hola-mako.com`), nunca por el del negocio.
- **El link no es una acción**: lleva a la pantalla detrás del login con el 2FA. Nunca un «cerrar esa sesión» por GET, ni
  nada que inicie sesión: un mail de seguridad que entra con un clic es lo que copia un phishing.
- **El contenido no va al feed ni al doer** (`emitirAviso` copia el texto ahí). Al feed de SuperAdmin va sólo «se le avisó
  a X de un ingreso nuevo».
- **«Pasó Google y falló el código»** sería otro evento (`ingreso_frenado`, a los 3 fallos). Es una decisión de Martín: no
  se arma hasta que conteste.
