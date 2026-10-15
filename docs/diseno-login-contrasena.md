# Entrar con correo y contraseña: diseño (14/10/2026)

> Pedido de Martín al enrolar el 2FA (14/10/2026, vía «Estrategia 3 cuentas»): «Falta login con correo y
> contraseña, con su recuperación». Diseño para aprobar ANTES de construir: cambia cómo entra todo el mundo.
> Las decisiones que esperan respuesta están al final.
>
> **Respuesta de Martín a la decisión 1 (15/10/2026), textual:** «Si, para mí también debería ser obligatorio
> tenerlo, como todos. Pero si inicio con Google no debería pedirme la contraseña también.» Es una opción que no
> estaba en la pregunta: **tener contraseña es OBLIGATORIO para todos** (él incluido), y es un camino de entrada
> ALTERNATIVO a Google, nunca un paso más. Lo que eso cambia está marcado «(15/10)» abajo.

## El problema que resuelve

Hoy el **primer factor es Google y nada más**. Los diez códigos de recuperación recuperan el SEGUNDO factor,
no la cuenta: si Martín pierde su cuenta de Google (se la suspenden, se la roban, olvida la clave), no hay por
dónde entrar a MaKo, y los códigos no sirven de nada. Hace falta un **camino de entrada propio**: correo +
contraseña, con su recuperación, que conviva con Google.

## Lo que NO cambia

- **Quien entra con Google sigue entrando con Google.** La contraseña es un segundo camino para la MISMA
  cuenta (la fila de `usuarios` es la del correo), no un usuario nuevo.
- **El segundo paso es el mismo para los dos caminos.** Después de Google o de la contraseña viene el mismo
  paso intermedio (`mako_preauth`) y la misma pantalla `/login/2fa`. Una contraseña no se saltea el 2FA.
- El alumno de un curso sigue con su propio acceso (`mako_alumno`): esto es para usuarios de MaKo.

## Los circuitos

1. **Crear la contraseña** (adentro, en Seguridad). Pide un segundo factor FRESCO (de los últimos 10 minutos;
   si no, se vuelve a pedir el código) para que una sesión robada no pueda ponerle una contraseña a la cuenta.
   Llega un aviso por correo: «Se creó una contraseña para tu cuenta».
2. **Entrar** (`/login`): «Continuar con Google» arriba, y «o con tu correo» abajo (correo + contraseña). Si la
   contraseña vale → la misma decisión que hoy toma el callback de Google (`decidirTrasGoogle`): sesión, segundo
   paso o bloqueo. El token guarda por dónde entró (`primer: 'google' | 'contrasena'`), para auditar.
3. **Olvidé mi contraseña**: se escribe el correo → la respuesta es SIEMPRE la misma («si hay una cuenta, te
   mandamos un link»), para no contar qué correos existen → llega un link de un solo uso que vence en 30 minutos
   → en `/login/restablecer` se pide **además el segundo factor** si la cuenta lo tiene (la app o un código de
   recuperación), como hace Google: quien robó el correo no alcanza a cambiar la contraseña con el link solo →
   contraseña nueva → **se cierran todas las sesiones abiertas** → aviso por correo.
4. **Cambiar la contraseña** (adentro): la actual, o un segundo factor fresco. Aviso por correo. **(15/10) Ya no
   se puede QUITAR**: es obligatoria. Lo que sí se hace es cambiarla, o restablecerla con el circuito 3.
6. **(15/10) Exigir que la cree.** Quien no tiene contraseña queda con un pendiente, igual que con el 2FA: el
   aviso en la app y, pasada la fecha (§decisión 5), **el login le pide crearla antes de dejarlo pasar**, en una
   pantalla propia DESPUÉS del segundo factor (que en ese momento es fresco, así que no se vuelve a pedir). Entra
   con Google como siempre; la contraseña se crea una vez y queda para el día que Google no esté. Es la misma
   forma que el 2FA obligatorio (una fecha que se calcula, no una acción a una hora), y la misma regla:
   `requiereContrasena(...)` pura, que leen el callback y la ruta del segundo paso.
5. **Perdí Google**: entra con correo + contraseña + segundo factor. Si además perdió el segundo factor, un
   código de recuperación. Si además perdió los códigos: el reset lo hace el super admin (tanda 3), y si el que
   lo perdió todo ES el super admin, es un trámite a mano en la base (queda escrito en el runbook).

## Las piezas

- **El hash**: `scrypt` de `node:crypto` (sin dependencia nueva), con sal por usuario y parámetros guardados
  junto al hash (`scrypt$N$r$p$sal$hash`), para poder subirlos después sin romper las viejas. Nunca se compara
  sin tiempo constante.
- **La política**: 12 caracteres o más; distinta del correo; y, si se aprueba, que no esté en filtraciones
  conocidas (Have I Been Pwned por k-anonimato: sale sólo el comienzo del hash, nunca la contraseña; si el
  servicio no contesta, no frena).
- **El freno**: el mismo molde que el del 2FA (anotar el intento ANTES de contar, en la base, fail-closed),
  por cuenta y por IP. Para un correo que no existe, la respuesta tarda lo mismo que para uno que sí (se calcula
  un hash igual), así no se distinguen.
- **Las tablas** (una migración, con el número que esté libre al commitear):
  - `usuario_contrasena` (`usuario_id` PK → usuarios, `hash`, `creada_at`, `cambiada_at`). **Aparte de
    `usuarios` a propósito**: `usuarios` se lee en CADA pedido y su fila viaja a la sesión; el hash no.
  - `contrasena_restablecer` (`usuario_id`, `token_hash`, `expira_at`, `usado_at`, `created_at`): el link
    guarda sólo su HMAC, como los códigos.
  - `usuarios.sesiones_desde` (timestamptz): todo token emitido antes no vale. Es el «cerrar sesión en todos
    lados» que ya estaba en la cola de la tanda 3, y lo usan el restablecer y el «perdí el teléfono».
  - RLS prendido, sin políticas, y `revoke` a anon y authenticated explícito (la regla de la 0280).
- **Los correos** (el link para restablecer y los avisos) salen por el mismo destino nuevo de Automations que
  los códigos de la tanda 2 («a la persona del evento», plantilla del SuperAdmin), con las mismas guardas: el
  workspace explícito, sin pasar por `emitirAviso` y nada del secreto copiado en el feed.
- **La API de MaKo NO** administra contraseñas (la regla: ninguna operación administra credenciales).

## Lo que decide Martín

1. ~~¿La contraseña es opcional u obligatoria para el super admin?~~ **CONTESTADA (15/10): obligatoria para todos,
   como camino alternativo a Google.**
2. Recuperar la contraseña:
   a) pide además el segundo factor si la cuenta lo tiene, como Google (recomendado);
   b) sólo el link del correo.
3. El orden:
   a) primero la tanda 2 (el destino «a la persona» en Automations, más WhatsApp y correo), y después la
      contraseña, porque su link de recuperación sale por ahí (recomendado);
   b) la contraseña primero, con su correo saliendo por un emisor propio que después se muda.
4. Chequear las contraseñas filtradas con Have I Been Pwned (sólo sale el comienzo del hash):
   a) sí (recomendado);
   b) no.
5. **(15/10, nueva) Desde cuándo se le pide crearla** sin trabarle la entrada a nadie el primer día:
   a) con una fecha PROPIA, posterior al corte del 2FA (por ejemplo una semana después), con los mismos avisos:
      el día del corte del 2FA nadie tiene que hacer dos cosas nuevas a la vez (recomendado);
   b) la misma fecha que el 2FA (21/10): ese día el login pide las dos cosas, una pantalla cada una;
   c) que no bloquee nunca: un pendiente visible hasta que la cree. Es lo más suave, y deja la obligación de
      adorno: quien no la crea queda igual que hoy el día que pierde Google.

> **Para que salga a tiempo, el orden importa más que antes** (decisión 3): el link de «Olvidé mi contraseña» sale
> por el destino «a la persona» de Automations (tanda 2). Con la contraseña obligatoria, ese destino tiene que
> estar ANTES de la fecha de la decisión 5: una contraseña obligatoria sin forma de recuperarla es peor que no
> tenerla.
