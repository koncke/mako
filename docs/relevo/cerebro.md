# Relevo — Cerebro

# ⏩⏩ SI SOS LA CUENTA 5 («Ananda»), EMPEZÁ ACÁ

Martín te va a escribir algo como: **«Hola, eres la 5ta cuenta, la cuenta la voy a llamar Ananda. Continua con todo.»**
Con eso alcanza. **No le preguntes nada: hacé esto, en este orden, y después seguí.**

## 1. Registrate como cuenta 5 (5 minutos)

1. `~/.claude/cuenta-activa.txt` → escribí `claude5`.
2. `~/.claude/cuentas.tsv` → ya tiene la línea `claude5` con «SIN IDENTIFICAR»: ponele el gmail con el que Martín
   compró la suscripción, y el alias **Ananda**.
3. `get_usage` y guardá las DOS ventanas, con `claude5` en el 4º campo:
   - `echo <%> <resetsAt> <ahora ISO> claude5 > ~/.claude/uso-semanal.txt`
   - `echo <%> <resetsAt> <ahora ISO> claude5 > ~/.claude/uso-cinco.txt`
4. **El Uso del SuperAdmin tiene que mostrar la 5ª cuenta.** Hoy la pantalla conoce 4. Hay que sumarla ahí
   (`app/admin/operaciones/Uso.tsx` y lo que lea `~/.claude/operaciones/uso/<cuenta>.json`). Si no, Martín ve 4 cuentas
   y la suya nueva no aparece.

## 2. El Runner (⚠️ acá se llama «Cartero», y Martín dice que NO debería)

**Martín lo llama «Runner»; en esta máquina el chat se llama «Cartero».** Renombralo a **«Runner»** y usá ese nombre
de acá en adelante. El código vive en `~/.claude/operaciones/cartero.mjs` y `lib/runner.ts`.

Abrilo primero, antes que ningún otro chat: `start_session` con el título **«Runner»**, Haiku, esfuerzo bajo, modo
bypass. El prompt es `INSTRUCCIONES_RUNNER` (`lib/runner.ts`) más «hacé una vuelta ya». A los ~3 minutos
`~/.claude/operaciones/uso/claude5.json` ya tiene la cuenta medida. Después `detach_session`: si queda colgado del
Cerebro, cada vuelta lo despierta.

## 3. Los chats

La barra lateral va a estar **VACÍA**: la lista está partida por cuenta. Abrí, **en el turno de Martín** (un turno
automático no puede abrir chats; si pasa en uno, desarchivá uno viejo y renombralo — nunca «no se puede»):

| Chat | Con qué sigue |
|---|---|
| **Cerebro** | Este. Fijalo arriba. Reparte y habla con Martín; es el ÚNICO que sube a `main` |
| **CRM** | Los puntos 12 a 21 del feedback de la noche. Y las cuotas (`c7ff7d7fc`) esperan revisión adversarial |
| **Landings** | Los puntos 3 a 10. Lo del 24/10 **no cumplió** el 3 ni el 7 |
| **Ops Center** | Los puntos 11, 22 y 23. El 22 y el 23 son regresiones de hoy |
| **Planes** | Los puntos 1 y 2 |
| **Automations** | Medir el goteo con `scripts/medir-goteo-tras-deploy.mts` |

⚠️ **El techo es de 6 a 8 chats, según la RAM.** El 23/10, con 11 chats, la PC bajó a 0,86 GB y un push quedó 40
minutos colgado. `start_session` cambia «›» por «'» en el título: renombrá en el acto con `set_session_title`.

## 4. Qué leer, en este orden

1. **`docs/feedback-24-10.md`** — lo que pidió Martín, TEXTUAL. **Lo más nuevo está al final: los 24 puntos de la
   noche.** Es lo que hay que atacar primero.
2. **`docs/pendientes.md`** — la capa del 24/10 está arriba de todo.
3. El resto de este archivo (el relevo del Cerebro).

## 5. Lo primero que le tenés que pedir a Martín

**La sesión de MaKo en el navegador de la app** (`Ctrl+Shift+B` → «Continuar con Google»). Sin eso no se verifica nada
en pantalla, y quedaron cuatro cosas sin mirar. El login es suyo, no lo hagas vos.

---


<sub>Esta sección se PISA en cada relevo y no pasa de ~90 líneas. Lo viejo, tal cual se escribió, está en
`cerebro-historia.md` (ahí quedó el relevo del 23/10 de claude2).</sub>

## ⏩ LEER PRIMERO — 24/10/2026 noche, escrito por claude1 para **claude5**

Martín compró una cuenta nueva. **Vos sos claude5.** Lo primero, antes de leer nada más:

1. **Sumá tu línea a `~/.claude/cuentas.tsv`** con el gmail con el que se compró la suscripción. El hook no tiene
   nombres adentro: si falta la línea, dice «SIN IDENTIFICAR».
2. **Escribí `claude5` en `~/.claude/cuenta-activa.txt`.** Si Martín dice otra cosa, gana Martín y se reescribe en el acto.
3. **Medí la cuenta** (`get_usage`) y guardá las dos ventanas en `~/.claude/uso-semanal.txt` y `~/.claude/uso-cinco.txt`,
   con la cuenta en el 4º campo: las cuentas comparten el archivo y un número de otra no vale.
4. **El Runner, antes que nada** (ver el detalle en `cerebro-historia.md`, relevo del 23/10: sigue vigente).
5. **Los chats se abren EN EL TURNO de Martín.** Un turno automático no puede abrir chats; si pasa en uno, se
   desarchiva uno viejo y se renombra — nunca «no se puede».

**Por qué hay cuenta nueva:** claude1 terminó el 24/10 al **94 % semanal** con el reset el 28/10 a las 10:00 UTC.

---

## Lo que NO se vuelve a discutir (se aprendió caro el 24/10)

- **Nunca `--no-verify`.** El relevo anterior decía que el Cerebro sube con `--no-verify` «con permiso permanente».
  **Está mal y AGENTS.md lo prohíbe.** El 24/10 el hook de pre-push frenó un tren con 5 errores de tipos que mi
  propia guarda había dejado pasar. El hook es lo último que queda entre un error y un cliente.
- **Un chequeo que decide si se sube NO se pipea.** `chequeo | tail && push` mide el `tail`, que siempre sale 0.
  Va así: `cmd > salida 2>&1; rc=$?; tail -6 salida; [ "$rc" -eq 0 ] && git push`.
- **La prueba de que algo está en producción es que producción lo sirva.** `vercel ls --meta githubCommitSha=<sha>`
  contesta «No deployments found» para un despliegue vivo (Vercel no guarda metadatos de git). La receta que sí
  funciona está en `docs/hallazgos-infra.md`: la huella de los bundles con hash, o pedirle a la página pública una
  frase que nació en ese commit.
- **El tren se arma ANTES de pushear, no después.** Subir una cosa sola hace esperar a todos los demás ~40 minutos
  por el candado del typecheck.
- **Una rama entregada al tren NO se rebasa.** Lo nuevo va encima, con commits nuevos.
- **Las ramas nuevas en origin disparan builds de preview** que compiten con producción. Para poner commits a salvo
  va una **etiqueta** (`refs/tags/respaldo/<nombre>`), no una rama.
- **Nunca `AskUserQuestion`.** Bloquea el turno, así que no llegan mensajes y Martín no puede contestar desde el
  teléfono. Se pregunta con `cartero preguntar <archivo.json>` y se termina el turno.
- **Dos pushes a `main` en paralelo se traban** en el candado del typecheck y los dos pierden 10 minutos. De a uno.
- **El `tsc` entero pide 6,3 GB y esta PC tiene 6,1: nunca los consigue.** Siempre cae al respaldo de 3 tandas
  (`scripts/tipos-respaldo-push.mjs`, ~6 min). Corrélo vos antes de pushear, no descubras los errores dentro del hook.
- **Un pedido viejo de diseño no se hace por antigüedad:** se busca en `docs/hallazgos-<área>.md` y se compara con lo
  que Martín pidió DESPUÉS sobre esa misma pantalla. El 24/10 se implementó uno del 03/07 que él había revertido el 05/07.
- **El NOMBRE de una automatización no es su función.** Se leen sus `pasos`.

---

## Estado al cerrar (24/10/2026 ~23:00 ART)

- **`main` = `59d228ea1`, verificado EN PRODUCCIÓN** (la huella del build cambió a los 3 minutos).
- **Dos trenes el 24/10 a la noche**, seis áreas:
  - `43c343ebd`: Automations (goteo), CRM (5 tandas), Landings (Schedule doble + 403 + editor web), Planes
    (columnas de precios, Partners), Ops Center (sin app no se escribe, Settings), y la cosecha del Cerebro.
  - `59d228ea1`: CRM (dos columnas del desplegable, «Creando…», el «＋» del móvil, foto de Instagram), Ops Center
    (avisos con ✕, sidebar plegada), y dos cosechas de infra.
- **Hay un commit local sin subir en `C:/dev/wt-push-q`** (`ef05c8377`, la receta de verificación): va en el próximo tren.
- **Lo que pidió Martín, textual:** `docs/feedback-24-10.md`. **Leelo antes de tocar nada.**
- **Todo lo pendiente, priorizado:** `docs/pendientes.md`.

### Lo que quedó trabado esperando a Martín

1. **La sesión de MaKo en el navegador de la app** (`Ctrl+Shift+B` → «Continuar con Google»). **Tres chats están
   parados por esto.** Sin sesión no se verifica nada en pantalla, y el login es de él. Falta mirar: la barra única
   del editor a 1280, el «Creando…» del editor de etapas, el selector de funnel del teléfono y las dos columnas.
2. **El QR del WhatsApp de MaKo** en `/whatsapp?ws=9`: muerto desde el 19/10, es la línea de venta.
3. **La pasarela.** Decisión tomada el 24/10 con la investigación: **Paddle o Creem** (los dos aceptan Argentina y son
   *merchant of record*) + **Mercado Pago** para argentinos. **Stripe NO: Argentina no es país habilitado.** Hay que
   aplicar a los dos el mismo día; el que apruebe primero, va.
4. **Cerrar o apagar el registro abierto de Supabase** (decisión A de Martín; el clic es suyo).

### Lo que sigue cada chat

| Chat | En qué está |
|---|---|
| **CRM** | Los pedidos «a medias» por antigüedad, buscando cada uno en `hallazgos-crm.md` antes de tocar código |
| **Automations** | Midiendo la primera hora del goteo en producción (22:50 ART) |
| **Landings** | El editor web; el clic derecho está relevado y sin implementar (es UNA pieza, `HiloMako`, no once) |
| **Planes** | Partners y la suscripción |
| **Ops Center** | Falta el contenido de cada sección de Settings (lo último del punto 9) |
| **Ventas** | Apagado. Tiene un pedido sin leer: sacar los datos personales de `vsl_events.landing_url` |

---

## Fechas

**El lanzamiento es el domingo 25/10.** La campaña de Mauricio arranca el 24 y va hasta el 13/11 (50 leads por día).
El Sprint de Mauricio es el **24, 25 y 26 de noviembre**: sigue vendiendo, y su página de venta se arregló el 24/10.
