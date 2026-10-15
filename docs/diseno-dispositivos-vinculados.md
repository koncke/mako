# Dispositivos vinculados y el aviso «¿No has sido tú?» (DISEÑO, 15/10/2026)

> Pedido de Martín (vía «Estrategia 3 cuentas», 14/10/2026 de noche): «Acabo de entrar a mi cuenta de SuperAdmin desde
> otro dispositivo y no me saltó el 2FA, es importante que en cada dispositivo salte eso... Y lo mismo que Google, que
> te manda un email de "¿No has sido tú?" cuando se ingresa desde otro dispositivo... Y que dentro de MaKo se puedan ver
> los dispositivos vinculados, el mismo diseño que Google, que te muestra la ubicación, el nombre del dispositivo, etc.»
>
> **Estado: DISEÑO, no hay nada construido.** El circuito del mail es del chat de Automations; la sesión, el registro y
> la pantalla, de Ciberseguridad. Las decisiones de Martín están en el §5.

## 1. Lo que se midió primero (la parte urgente)

**La cuenta de super admin NO entró sin segundo factor.** Medido en producción a las 02:37 UTC del 15/10:

| | |
|---|---|
| Último login de la cuenta de super admin (#1) | 22:19 UTC del 14/10, «Chrome en Android», **con el código** (un intento falló y el siguiente entró). Desde ahí, ninguno. |
| Sus dos dispositivos de confianza (Windows 22:09, Android 22:19) | `usado_at` vacío: el atajo de 30 días no se usó nunca. |
| El único login de las últimas 4 horas | 02:32 UTC, del usuario #8 (`tejadomartin@gmail.com`), que en MaKo es «Leandro Tejado», admin del ws10, capa completo. **No es super admin**: para esa cuenta el 2FA hoy es opcional (hasta el 21/10). |
| Puertas que emiten una sesión | El callback de Google, la ruta del segundo paso, la reemisión de Seguridad (exige una sesión previa) y `dev-login` (404 en cualquier deploy de Vercel). Un token de admin sin `mfa` se rechaza en el proxy y en `getUsuarioActual`. |

O entró con la otra cuenta de Google, o abrió un navegador donde ya había entrado: la sesión dura 30 días y ahí no hay
login nuevo que pida nada. **Lo que esto sí deja a la vista es lo que pidió después: hoy no hay forma de VER qué
sesiones tiene abierta una cuenta ni de cerrarlas**, y por eso la pregunta no se pudo contestar mirando una pantalla.

## 2. La pieza que falta: un registro de sesiones

La sesión es una cookie firmada SIN estado (`lib/auth-session.ts`: `exp` y `mfa`, sin `iat` ni id). No se puede listar
ni cerrar una. Hace falta:

- **`usuario_equipos`**: un aparato conocido de la persona. Lo identifica una cookie nueva, `mako_equipo` (aleatoria,
  httpOnly, 400 días), que se guarda por hash. Columnas: usuario, hash, nombre («Chrome en Windows», del user agent),
  ciudad y país (§5.1), primera y última vez.
- **`usuario_sesiones`**: cada sesión emitida, con su id (`sid`), su equipo, cómo pasó el segundo factor, creada,
  última actividad, cerrada. El `sid` viaja FIRMADO en el token.
- **`getUsuarioActual` rechaza un `sid` cerrado** (una consulta más, memoizada por pedido, sólo para sesiones con
  `sid`). La última actividad se escribe a lo sumo cada 10 minutos y fuera del camino del pedido (`after()`). El proxy no
  puede verlo, porque no tiene base; ya pasa lo mismo con la suspensión y el 2FA obligatorio. Una sesión que
  `getUsuarioActual` rechaza resuelve el workspace a null, no al ws1 (`lib/workspace.ts:265`).
- **Lo emiten las tres puertas** (callback, segundo paso, reemisión de Seguridad, que conserva el `sid`) por UNA función,
  `abrirSesion`, que crea la fila, pone el `sid` y la cookie del equipo. Ninguna puerta firma una sesión por su cuenta;
  un test lo exige barriendo `ponerSesion(`.
- **Cerrar un dispositivo** cierra todas sus sesiones Y le revoca la confianza de 30 días (§5.2). **«Cerrar sesión en
  todos los demás»** cierra todas menos la actual, y además corta las sesiones viejas sin `sid` con
  `usuarios.sesiones_desde`: el token no tiene `iat`, pero `exp − 30 días` lo es.

## 3. La pantalla: «Tus dispositivos», en /perfil/seguridad

El molde es el de Google («Tus dispositivos»): una fila por aparato, con su nombre, la ubicación aproximada, la última
actividad («Activo ahora» en el actual), la marca «Este dispositivo», y «Cerrar sesión». Al pie va «Cerrar sesión en
todos los demás». La lista de «Dispositivos recordados» de hoy se funde ahí: un aparato recordado dice «No pide el
código hasta el 13/11». Vale para todos los roles (cada uno ve los suyos), en escritorio y en /m/cuenta.
Link fijo para el mail: `/perfil/seguridad#dispositivos`.

## 4. El aviso «¿No has sido tú?» (acordado con Automations)

- **Qué es «nuevo»**: un login cuyo equipo no está entre los conocidos de esa persona, **y la persona ya tenía al menos
  uno**. Sin la segunda mitad, el día del deploy nadie tiene equipos y a todos les llegaría el aviso en su próximo login.
- **Cuándo**: al EMITIR la sesión (o sea, después del segundo factor, si lo tiene). Con `after()`: nunca frena el login.
- **El evento**: `EVENTOS_MAKO` (lib/disparadores.ts), subtipo `ingreso_nuevo`, con `ws` = el de la PLATAFORMA (la
  automatización es de SuperAdmin). Datos atómicos: `ingreso_usuario_id`, `ingreso_negocio_id`, `ingreso_at` (ISO; la
  hora la formatea el resolver en la zona del negocio), `ingreso_dispositivo` («Chrome en Windows»), `ingreso_ubicacion`
  (sólo si §5.1 = A; ausente si no se sabe, nunca vacía) e `ingreso_dispositivo_id` (el id del equipo, para el dedup
  `ingreso:<uid>:<equipo>`; no es citable).
- **El destino**: `destinoDeUsuario(uid, 'email', 'aviso')` (lib/mfa, Ciberseguridad): el correo de la persona, por el
  remitente de MaKo (`equipo@hola-mako.com`, la key de la plataforma). Al feed de SuperAdmin va sólo «se le avisó a X»,
  sin el aparato ni la ubicación.
- **El link no es una acción**: lleva a la pantalla, detrás del login con el 2FA. Nada de «cerrar esa sesión» por GET ni
  un link que inicie sesión: un mail de seguridad que actúa con un clic es exactamente lo que copia un phishing.

## 5. Lo que decide Martín

1. **De dónde sale la ubicación.** (A, recomendada) Aproximada a ciudad y país, de los encabezados que ya manda Vercel
   con cada pedido (`x-vercel-ip-city`, `x-vercel-ip-country`): sin ningún servicio externo y **sin guardar la IP**. (B)
   Sin ubicación: sólo el aparato y la hora.
2. **Cerrar un dispositivo también le saca el «recordar 30 días».** (A, recomendada) Sí: si no, al volver a entrar no
   le pide el código y cerrar no sirvió de nada. (B) No.
3. **Las sesiones abiertas ANTES de esto**, que no tienen registro. (A, recomendada) Siguen valiendo hasta vencer (como
   mucho 30 días), aparecen como «Sesión anterior, sin datos», y «Cerrar sesión en todos los demás» también las corta.
   (B) Se cierran todas una vez al desplegar: todos vuelven a entrar.
4. **A quién le llega «¿No has sido tú?».** (A, recomendada) A todos los usuarios, cada uno por lo suyo. (B) Sólo al
   super admin.
5. **¿Avisar también cuando alguien pasa Google y FALLA el código?** Es la señal de que alguien tiene la cuenta de
   Google. (A) Sí, a los 3 fallos seguidos, con otro evento (`ingreso_frenado`). (B) No por ahora.
