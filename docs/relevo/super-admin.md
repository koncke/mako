# Super admin: Strategy, runway y los registros de dev

> **Área:** `app/admin/**` · **Ventana:** 05/10/2026 12:33 (`6785dc16`) → 10/10/2026 18:59 (`9862c146`).
> Escrito el 10/10/2026 para una cuenta de Claude que arranca **sin una línea de historial**.
> Sirve a dos chats de `docs/relevo/chats.md`: **«Pricing MaKo»** (Strategy, runway, referidos) y
> **«Admin»** (clientes, agencia, links compartidos).

## ⏸ 13/10/2026 ~20:00 — EL 2FA DEL LOGIN, PAUSADO A MITAD (léelo primero)

> Escrito por la cuenta 2 (chat «Admin») en la pausa que pidió Martín para liberar RAM. Primera mano.

**El pedido** (Martín, 13/10, textual, vía «Estrategia 3 CUENTAS»; fuente
`C:UsersmartiDownloadsmako-feedback-y-tareas.md`, punto 2): «Activar 2FA en todos lados... Si me
llegan a entrar en la cuenta de email, toda la app está en riesgo. Activar 2FA de varias maneras... App de
Auth, mensaje de WhatsApp, codigo en correo, preguntas de verificación, 2FA rápido para dispositivos
seguros, como huella o face id, etc...». Validado «de punta a punta». Obligatorio para el super admin,
opcional para el resto; preguntas de verificación NO como factor; las cuentas externas las activa él con
un checklist.

**Dónde está el código: en `refs/wip/2fa-login-2026-10-13`, NO en `main` ni en el árbol.** Se sacó del
árbol compartido a propósito: sin el typecheck completo, un error de tipos ahí habría trabado el
pre-push de las otras sesiones (los 25 commits que esperaban). Para retomarlo:

```bash
git diff HEAD refs/wip/2fa-login-2026-10-13 --stat
git checkout refs/wip/2fa-login-2026-10-13 -- <las rutas de abajo>
```

⚠️ Ese checkout pisa `package.json`, `package-lock.json`, `lib/auth-session.ts`, `lib/auth.ts`,
`lib/usuarios.ts`, el callback de Google, `dev-login`, `LoginForm.tsx`, `PerfilTabs.tsx` y
`app/admin/dev/registros.ts`: si alguien los tocó después del 13/10, se reaplica por hunk, no en bloque.
Las dependencias (`@simplewebauthn/server`, `@simplewebauthn/browser`, `qrcode`, `@types/qrcode`) ya
están en `node_modules` del clon.

**En `main`:** sólo la migración `0266_segundo_factor.sql` (`64d5e604`), **ya aplicada en prod** (sólo
agrega: `usuarios.mfa_activo` default false y seis tablas con RLS). Sin el código, no cambia nada.

**Hecho (en la foto):**
- `lib/mfa-reglas.ts` (puro) y `lib/mfa.ts` (base): TOTP RFC 6238 con el secreto cifrado y anti-reuso;
  código por WhatsApp (línea de MaKo) y por un correo DISTINTO del de Google; passkeys (@simplewebauthn v14,
  RP fijo hola-mako.com/localhost); 10 códigos de recuperación; «recordar este dispositivo» 30 días; freno
  de 8 fallos/15 min contado en la base (fail-closed).
- `verificarToken` rechaza un token de admin sin `mfa` (proxy y server); `getUsuarioActual` agrega la capa
  con la base. Paso intermedio `p1.` (cookie `mako_preauth`, 15 min) que no sirve como sesión.
- Callback de Google: sesión / segundo paso / bloqueo (el admin de respaldo con la base caída ya NO entra).
- `app/api/auth/2fa/route.ts` + `app/login/2fa/` (entrar y activar el primero),
  `app/api/perfil/seguridad/route.ts` + `app/perfil/seguridad/` (administrar; activar reemite la sesión con
  `mfa`, si no echaba a la persona), link desde `/perfil`.
- `tests/mfa.test.ts`: 11 tests en verde, cada uno probado rompiéndolo (los números en su cabecera).
- `app/admin/dev/auth-session/bitacora.ts` (con el pedido literal) y `docs/2fa-cuentas-externas.md`
  (el checklist de Martín: Google ×2, Porkbun, GitHub, Vercel, Supabase, Meta, Railway, Resend, Stripe/MP).

**Falta, en este orden:**
1. Typecheck completo (el último no corrió: la guardia de RAM lo tuvo esperando y se frenó por la pausa).
2. Mirarlo en el navegador en localhost con un usuario de prueba descartable, y borrarlo al terminar
   (local escribe en la base de prod): entrar → activar TOTP → códigos → salir → entrar con TOTP, con
   código de recuperación y con «recordar»; y `/perfil/seguridad`.
3. `npm test` después de `git add` (hay archivos nuevos que los guards sólo ven indexados).
4. Cosecha en `docs/hallazgos-seguridad.md` + índice `docs/hallazgos.md`, y sumar las rutas nuevas al
   `vive[]` de `auth-session` en `app/admin/dev/areas.ts` (ese archivo tiene un hunk AJENO sin commitear:
   va por hunk).
5. Commit por ruta y push sólo con el typecheck en verde.
6. **Apenas se despliegue, Martín entra y activa su método** (está en el checklist): hasta entonces quien
   tenga su Google puede enrolar el suyo. Queda en cola «pedir un código fresco para quitar un método».

**Otras cosas de esta ventana:** `f7755144` (runway: «hoy» en hora de acá) está commiteado y sin pushear.
Sigue sin respuesta la pregunta a Martín de si se actualiza la foto del runway (capital y calendario).

---

## Qué es esta parte del producto, para quien nunca la vio

`/admin/*` es **la app que usa Martín sobre su propio negocio**, no la que le vende a los
clientes. Ningún cliente puede entrar: el proxy cierra `/admin` por prefijo (`SOLO_ADMIN` en
`proxy.ts`) y cada página además pregunta `getSesionAdmin()`. Son dos cerrojos y hay que poner
los dos.

Adentro viven cuatro cosas distintas, y conviene no confundirlas:

| Ruta | Qué es |
|---|---|
| **`/admin/estrategia`** (nav: «Strategy») | **Nació el 10/10/2026.** La estrategia de MaKo en una pantalla: la oferta, a dónde va cada dólar, el CAC, la adquisición, la proyección del mes, los referidos y los canales a futuro. |
| **`/admin/runway`** | La **foto fechada** del lanzamiento: cuánta plata queda, qué deadlines hay y el veredicto de cada tarjeta del tablero. No tiene fila en el nav (se entra por URL, o por el link que ahora le puso Strategy). |
| **`/admin/dev`** y `/admin/dev/<área>` | El **mapa del producto**: 124 áreas, y por cada una un Roadmap (sale del tablero en vivo) y un Historial (mitad bitácora escrita a mano, mitad `git log`). Es el índice del trabajo. |
| Lo demás | `/admin/docs` (renderiza los `.md` del repo), `/admin/ui` (el sistema de diseño real), `/admin/copywriting`, `/admin/agente` (en qué trabajan los clientes en SU Claude Code), `/admin/friccion`. `/admin`, `/admin/rediseno` y `/admin/guiones` son **redirects**: la pantalla se mudó y el link se dejó vivo. |

**Lo que NO está acá:** el panel de Clientes se mudó a `/customer-success` el 28/09/2026
(`e2386510`, antes de esta ventana). `app/admin/AdminView.tsx` y `app/admin/FichaWorkspace.tsx`
siguen viviendo en esta carpeta pero los monta `/customer-success`. Si el pedido es sobre
clientes, agencias o aprobaciones, el briefing que manda es `customer-success.md`.

**Medido el 10/10/2026** (`git log 6785dc16..HEAD --no-merges --oneline -- app/admin | wc -l`):
**152 commits** sin merges. De esos, **147 tocan `app/admin/dev`** y **123 tocan un
`bitacora.ts`**. Fuera de `/admin/dev` hubo **10**, y nueve son barridos de toda la app
(íconos en los menús `06fc917c`, el tacho de borrar `71690b4b`, el renombre a Automations
`04f40af4`). O sea: **el área casi no cambió de código; lo que cambió fue el registro de lo
que se hizo en las otras áreas.** La excepción es el último commit de toda la ventana, que es
una tab nueva entera.

---

## 1. En qué quedó (hecho y desplegado)

**`9862c146` (10/10/2026 18:59) está en `origin/main`** — verificado con
`git merge-base --is-ancestor 9862c146 origin/main`. Es el último commit de la ventana.

### La tab Strategy (`/admin/estrategia`)

Pedido literal de Martín del 10/10/2026, que **sólo existe en comentarios de código y en el
mensaje del commit** (ver §4): *«tenemos runway, tenemos una de análisis de costos, y mucha
info desparramada»* → todo en una tab, sólo super admin, gráfico, con poco texto y con tortas.

- **Reemplaza a `/vsl/estrategia`**, que era el documento interno de oferta y estrategia
  (revisión del 28/07/2026) y era **público sin login** por caer bajo `/vsl`. Su
  `Estrategia.tsx` de 929 líneas se borró y `app/vsl/estrategia/page.tsx` quedó como
  `redirect('/admin/estrategia')` — no se borró la ruta porque el link circuló (se le mandó a
  un consultor) y un 404 es peor que un salto.
- **Ocho secciones** (`app/admin/estrategia/Estrategia.tsx:691-719`): Calendario · La oferta ·
  A dónde va cada dólar · Lo que cuesta conseguir un cliente · Estrategia de adquisición ·
  Proyección del mes · Referidos · Canales a futuro.
- **Server-rendered, sin un byte de JavaScript propio**, igual que `/admin/runway`. Gráficos
  en SVG a mano, claro y oscuro con los tokens de la casa.
- **Los números se IMPORTAN, no se copian** (`app/admin/estrategia/datos.ts:23-29`): el
  calendario, el capital y la ventana salen de `app/admin/runway/datos.ts`; los precios, las
  tortas, el CAC y el LTV se calculan desde `UNIT_V2`, `IA_POR_PRO`, `ASCENSO_PROGRAMAS`,
  `ASCENSO_NETO` y `CAC_CANALES` de `app/admin/dev/pricing/modelo.ts`. Lo único escrito acá es
  la estrategia de adquisición, porque sólo vivía en la página vieja.
- **Las tres tortas** (47, 97 y grupal de 1.500) **suman al centavo** y sus porcentajes dan
  100,0 exacto por mayor resto (`porcentajes()` en `datos.ts`).
- **Referidos con las decisiones del mismo 10/10**: 1er mes gratis en el 47, hasta 50% del 1er
  mes en el 97, el revendedor primero cubre su suscripción y lo que sobra se le paga, US$300
  por grupal (el 20% de cada cuota). Están escritas en `docs/referidos.md` → «EL PROGRAMA
  DECIDIDO» + «Dos cambios de Martín».
- **El runway dejó de decir «se acaba la plata» y dice «se acaba el capital»** (copy neutro).

**Tests, corridos por mí el 10/10/2026** (`npx tsx --test tests/estrategia-tab.test.ts
tests/dev-areas.test.ts`): **22 pass / 0 fail**. Los de la tab son 10 (tortas que suman, la
captación que sale del mismo techo que dibuja el gráfico de al lado, los referidos debajo de
su techo, «hoy» en hora de Buenos Aires, el guard de super admin, el redirect de
`/vsl/estrategia`, copy neutro, formato con punto de miles y coma decimal); los 12 restantes
son de `dev-areas`.

### El registro de `/admin/dev`

Medido por mí el 10/10/2026 leyendo `areas.ts`, `registros.ts` y los `bitacora.ts`:

| | Cuánto |
|---|---|
| Áreas declaradas (`AREAS`) | **124** |
| Áreas con bitácora escrita a mano (`REGISTROS_SLUGS`) | **45** · las otras 79 muestran sus estados vacíos |
| Hitos escritos en total | **669** (eran **469** el 05/10 → **+200 en la ventana**) |
| Bitácoras **nuevas** en la ventana | **5**: `ads-manager` (`60fc93b0`, 06/10), `plan` (`b8255314`, 06/10), `whatsapp-de-mako` (`f76d1934`, 07/10), `webhook-gateway` (`9d3056f7`, 07/10), `api-mako` (`71c04d25`, 08/10) |
| Bitácoras con hitos **dentro** de la ventana | **18 de 45** |
| Bitácoras cuyo último hito es de **junio a agosto** | **24 de 45** |

Las que más crecieron: `chatbot` 32→79 hitos, `integraciones` 14→48, `customer-success` 22→46,
`meta-platform` 3→23, `mako-doer` 7→17.

---

## 2. Lo que nació en la ventana y el 05/10 no existía

1. **`/admin/estrategia`** entera: `page.tsx`, `Estrategia.tsx` (735 líneas), `datos.ts` (460)
   y `estrategia.css` (556). Fila nueva en el nav (`admin-estrategia`, label «Strategy»,
   familia Admin) en `app/_components/nav.ts:395`.
2. **El redirect de `/vsl/estrategia`**, y con él **un documento interno que dejó de ser
   público**.
3. **Las 5 bitácoras nuevas** de arriba — entre ellas `api-mako`, que es el área de 49 rutas
   declaradas donde vive el registro de todo lo que un agente puede hacer en MaKo.
4. **Referidos pasó de «no existe nada» a «programa decidido»** en el registro:
   `app/admin/dev/areas.ts` → área `referrals`, cuya `nota` antes decía «cuatro líneas, costo
   cero» y ahora apunta a `docs/referidos.md` y a la sección de la tab. Sigue con **cero
   código** (sin atribución ni liquidación): lo decidido no está aplicado.
5. **Tres áreas de GTM dejaron de apuntar a un archivo borrado**: `gtm-ads`,
   `gtm-prospeccion` y `gtm-oferta-y-precios` tenían `app/vsl/estrategia/Estrategia.tsx` en su
   `vive[]`; ahora apuntan a `app/admin/estrategia/`.

---

## 3. Lo que quedó a medio hacer o sin verificar, con el archivo donde vive

> **Estado al 13/10/2026** (revisado por la cuenta 2 al retomar lo frenado de la cuenta 3):
>
> | Pendiente | Estado |
> |---|---|
> | Change History congelado el 07/09 | ✅ Regenerado el 11/10 (`b112e5b7`). `api-mako` y `legal-compliance` ya tienen entrada. Se sigue corriendo **a mano**: va a volver a envejecer. |
> | El pedido del 10/10 sin bitácora | ✅ Está en `gtm-oferta-y-precios/bitacora.ts` (`1ca807ef`). |
> | `docs/relevo/README.md` no listaba este archivo | ✅ Lo lista (`1e85eb62`). |
> | Comentarios «122 áreas» | ✅ Los que mentían ya no están; `areas.ts:15` queda porque es HISTÓRICO (el relevamiento dio 122). |
> | Runway: «hoy» a nivel módulo y en UTC (trampa ⑥) | ✅ 13/10: `hoy = hoyAR()` adentro del componente, el MISMO de Strategy. |
> | Runway: «Al primer deadline» en «0 días» para siempre | ✅ 13/10: `textoPlazo()` en `runway/datos.ts` dice «venció hace N días». Test en `tests/estrategia-tab.test.ts`, probado rompiéndolo (las dos regresiones dan 15/1). |
> | Runway: la FOTO del 03/10 (fechas de `HITOS`, capital, «45 días») | ⏸ **Espera a Martín**: hacen falta el capital de hoy y el calendario vigente. Hay dos fuentes que no coinciden (el audio del 04/10 → 18 y 19/10; las cinco etapas → tope 4/11) y no se elige una por él. |
> | Abrir Strategy y el runway en un navegador | ⏸ Visual: lo mira Martín (memoria «Revisión: sólo lo invisible»). |

### ⛔ El Change History de las 124 áreas está congelado el 07/09/2026

`app/admin/dev/_historial.generado.ts` es el Historial automático de cada área: lo escribe
`scripts/gen-dev-historial.mjs` corriendo `git log` sobre las rutas del `vive[]`. **Se corre a
mano**: no está en `package.json` ni en las trece guardas del pre-push.

Medido el 10/10/2026:

- último commit que lo tocó: **`3b075c96`, 07/09/2026 13:15**;
- el commit más reciente que contiene adentro: **2026-09-07**;
- **989 commits sin merges** entre ese punto y HEAD (`git log 3b075c96..HEAD --no-merges`).

Y hay dos consecuencias que no se ven mirando la pantalla:

- **`api-mako` y `legal-compliance` muestran el estado vacío «Todavía no hay commits sobre
  esta área»**, con el detalle «si el área no tiene código todavía, es lo esperable». `api-mako`
  declara **49 rutas** (`areas.ts:1122`) y `legal-compliance` **7** (`areas.ts:870`): las dos
  entraron al mapa después del 07/09, así que el generado ni las nombra. Son las únicas dos con
  rutas declaradas y sin entrada — el resto de las 13 que faltan tienen `vive: []` legítimamente.
- **El área `admin` tope en el 2026-09-03**, así que todo el trabajo de agencia del 28/09 y los
  barridos de esta ventana no se ven ahí.

**El arreglo es un comando** (`node scripts/gen-dev-historial.mjs`), y tiene una trampa
documentada: la vez anterior, regenerarlo puso **rojo** a `tests/ia-mensajes.test.ts`, porque el
generado guarda la primera línea del cuerpo de cada commit y un commit citaba textual una frase
que un guard reserva a un solo archivo. El caso completo, en `docs/hallazgos-infra.md` → «Un
generado que se corre a mano se pone viejo, y su vejez ESCONDE un rojo». O sea: **el generado
viejo puede estar tapando un rojo**, y hay que correr `npm test` después de regenerarlo.

### El pedido del 10/10 no quedó en ninguna bitácora

`AGENTS.md` pide un tercer destino para la cosecha: un hito `tipo: 'prompt'` con el campo
`pedido` llevando **el texto literal de Martín**. Verificado con `git grep -l "info
desparramada" -- app lib docs tests`: la frase aparece en `app/_components/nav.ts`,
`app/admin/estrategia/datos.ts` y `app/admin/estrategia/page.tsx` — **en ningún
`bitacora.ts`**. El commit `9862c146` tocó `app/admin/dev/gtm-oferta-y-precios/bitacora.ts`
**sólo para arreglarle una línea del encabezado** (`Vive en:`); ese archivo sigue con **11
hitos y el último del 04/10**. Así que en `/admin/dev` la tab Strategy no existe como hito de
nadie.

### El runway es una foto del 03/10 que ya se movió

`app/admin/runway/datos.ts` lo dice de sí mismo: *«es una FOTO con fecha, no un estado
vivo… el día que entre una venta o se mueva un deadline, la pantalla miente»*. Al 10/10:

- `MEDIDO = '3 de octubre de 2026'`, y Strategy lo importa y lo dibuja en su cabecera como
  chip «Runway al 3 de octubre de 2026» — honesto, pero es el único aviso.
- La cifra «Al primer deadline» cuenta contra `2026-10-07`, que **ya pasó**. No sale en
  negativo porque `page.tsx:61` tiene `Math.max(0, …)`: **dice «0 días» en rojo, y lo va a decir
  para siempre.**
- La cosecha del propio 10/10 (`docs/hallazgos-planes-y-cobro.md`) deja escrito que **el audio
  del 04/10 movió el cierre técnico y la prospección al 18 y 19/10**, y que la «ventana de 45
  días» son 29-30 días con plata. `HITOS` sigue con las fechas del 03/10. Se corrige en
  `app/admin/runway/datos.ts` **una sola vez** y se arregla en las dos pantallas.

### Sin verificar

- **Nada de esto se abrió en un navegador en esta ventana.** `/admin/estrategia`,
  `/admin/runway` y `/admin/dev/<área>` están verificados por tests que leen el fuente y por
  el typecheck del pre-push, no por una pantalla. Para esta área eso alcanza menos que para
  otras: son **gráficos SVG escritos a mano** y un test no ve una barra mal dibujada.
- **`docs/relevo/README.md` no lista este briefing.** Su tabla («Chat → pegar») tiene nueve
  filas y ninguna es `super-admin.md`, aunque `docs/relevo/chats.md` manda dos chats acá. No lo
  toqué a propósito: esa tabla la editan varias sesiones a la vez y choca en rebase (pasó el
  09/10 entre `integraciones` y `api-mako`); la resolución es siempre **quedarse con las dos
  filas**. Quien junte las filas al final de la tanda tiene que agregar la de este archivo.
- **Los comentarios dicen «122 áreas» y son 124.** `areas.ts:15`, `:36` y
  `nav-dev.ts:2`. El número que se DIBUJA sale de `AREAS.length` y está bien; lo que miente es
  la prosa. Ya pasó antes (quedó en 121 por contar con `grep -c`, que cuenta líneas).

---

## 4. Las trampas del área

**① Las bitácoras usan DOS estilos de comilla para el mismo campo, y eso rompe cualquier
conteo.** Medido el 10/10/2026: de los 669 hitos, **536 escriben `fecha: '…'` y 133
`fecha: "…"`**. Mi primer conteo buscaba sólo la comilla simple y me devolvió **«chatbot: 0
hitos nuevos en la ventana»** cuando la verdad es **+47** (32 → 79). No dio error: dio un cero
plausible sobre la bitácora más grande del repo. Todo barrido sobre un `bitacora.ts` va con
`fecha: ['"]`.

**② Un `vive[]` corto no da un área con poca historia: da un área INVISIBLE.** El Historial se
deriva de las rutas que el área declara, así que una ruta que falta no produce un hueco
visible — produce un panel vacío que se lee como «acá no se trabajó». El precedente medido es
Conocimientos, que veía **11 de 68** commits. Y arreglar el `vive[]` **no alcanza**:
`legal-compliance` recuperó sus 7 rutas el 06/10 (`a2e29f55`) y su panel sigue vacío porque el
generado no se volvió a correr. **Son dos pasos y el segundo se olvida.**

**③ Mover un archivo rompe punteros que ningún compilador mira.** Al borrar
`app/vsl/estrategia/Estrategia.tsx` hubo que buscarlo en los `vive[]` y en las `nota` de
`areas.ts` (aparecía en cuatro áreas) y en los encabezados `Vive en:` de los `bitacora.ts`.
Nada de eso lo ve `tsc`; lo único que lo caza es `tests/dev-areas.test.ts`, que comprueba
contra el disco **que cada ruta exista** — pero no puede ver la **omisión**.

**④ `/admin/runway` no tiene fila en el nav.** Verificado: `grep -c "admin/runway"
app/_components/nav.ts` → **0**. Martín entra pegando `hola-mako.com/admin/runway` en el chat
(está así en dos `pedido` de bitácora). Desde el 10/10 el único link de la app es el que le
puso Strategy (`app/admin/estrategia/Estrategia.tsx:723`). Si se toca el runway, el camino
para que él lo vea pasa por Strategy.

**⑤ El guard es `getSesionAdmin()`, nunca `rol_ws`.** `rol_ws` vale `'admin'` para el dueño de
CADA workspace: usarlo acá abriría estas pantallas a todos los clientes. Está escrito en
`app/admin/estrategia/page.tsx:9-12` y es el mismo criterio del runway.

**⑥ «Hoy» se calcula ADENTRO del componente y en hora de Argentina.** Strategy usa `hoyAR()`
(`datos.ts:66`). El runway lo hace al revés —`const HOY = new Date().toISOString()` a nivel
módulo, `page.tsx:60`— y eso tiene dos fallas: `force-dynamic` vuelve a correr la función, no
el módulo, así que una instancia caliente se queda con la fecha de su primera carga; y la
fecha UTC ya es «mañana» después de las 21 h de Buenos Aires. **Arreglado en el runway el
13/10**: usa el mismo `hoyAR()`.

**⑦ Los hex de las tortas son a propósito y no son un descuido.** `estrategia.css` tiene 22
colores literales y 140 `var(--token)`. Los literales son **sólo** la paleta categórica de las
porciones, documentada en el encabezado del archivo con sus valores para claro y oscuro: los
tokens de la casa no pasan como paleta categórica (rojo↔verde da ΔE 2,5 en deuteranopía). No
los «arregles» pasándolos a tokens.

**⑧ El renombre a Automations no renombró el slug.** El nav dice label «Automations» y el href
sigue siendo `/admin/dev/chatbot` (`nav.ts:472`), y la carpeta es
`app/admin/dev/chatbot/bitacora.ts`. Es correcto: el slug está escrito en la base y en el
catálogo de proyectos; lo que cambia es lo que se LEE.

---

## 5. Qué espera una decisión de Martín

**① ¿Se muda `/vsl/costos` también?** Él nombró «una de análisis de costos» en el pedido, y
esa página **sigue pública sin login** con los costos de la empresa: cae bajo `/vsl`, que está
en `PUBLICOS`. Su cabecera decía «igual que /vsl/estrategia», que ya no es cierto, y el 10/10
se le dejó el aviso escrito (`app/vsl/costos/page.tsx:8-11`).
**A)** Mudarla a Strategy y dejar un redirect, como se hizo con estrategia — pierde la
capacidad de mandársela a Mauricio por link. **B)** Dejarla pública tal cual. **C)** Mudarla y
que el link para afuera sea un share con token.

**② ¿La pauta de noviembre es US$1.000 o US$2.000?** Las dos pantallas proyectan meses
distintos y la contradicción **no se dibuja** a propósito
(`app/admin/estrategia/datos.ts:356-363`). Runway:
US$2.000 ÷ US$100 por agenda × 50% de show = 10 clientes = US$15.000. Strategy: US$1.000,
US$125 por agenda, 80% asiste, 40% cierra = 5 ventas = US$7.500. La tab usa la de Strategy
porque es la que él revisó tasa por tasa, y toma el capital y el calendario del runway.
**Mientras no se decida, hay dos proyecciones vivas del mismo mes.**

**③ El objetivo de US$10.000 no sale de la oferta vigente.** Llegaba ahí con un «1 a 1 de
4.000» que no aparece en ninguna decisión posterior al 20/09. Con sólo grupales, 5 ventas son
US$7.500 y el objetivo pide **7 ventas y ~22 agendas**. La tab dibuja lo proyectado y la
brecha, separados. **A)** Bajar el objetivo a lo que la oferta puede producir. **B)** Subir las
agendas. **C)** Volver a tener un escalón de alto ticket.

**④ Dos renglones de la torta del grupal.** Hoy la comisión del referido va entera (US$300) y
el cobro es el de UN pago (US$66,30). Si se decide **«sin comisión si hay reembolso»** (valor
esperado US$270) y **el cobro en 3 cuotas** (US$66,90), «Ganancia» sube unos US$29
(`app/admin/estrategia/datos.ts:198-200`, el comentario de la torta `grupal`).

**⑤ ¿Se reabre el proyecto «Vender MaKo: Referidos» (P68)?** Está **tachado** en el Plan desde
el 20/09 y el programa quedó **decidido y sin aplicar** el 10/10 (`docs/referidos.md`, estado
al tope). Reabrirlo es parte de la decisión; sin pasarela de pago no hay con qué liquidar un
incentivo.

**⑥ ¿Se reescribe el runway al 10/10 o se lo deja como foto del 03/10?** Las fechas ya se
movieron (18 y 19/10 por el audio del 04/10) y la pantalla cuenta «0 días» al primer deadline
desde el 07/10. **A)** Reescribir `datos.ts` con la foto de hoy. **B)** Dejarla y que Strategy
sea la pantalla viva. **C)** Borrar la ruta, que es lo que el propio archivo dice que
corresponde «el día que deje de ser la foto vigente».

---

## Dónde se lee el resto

- **Lo que costó la tab Strategy, con lo que no coincidía entre las fuentes al juntarlas:**
  `docs/hallazgos-planes-y-cobro.md` → «La tab /admin/estrategia (10/10/2026)».
- **El registro de `/admin/dev` y sus modos de falla:** `docs/hallazgos-infra.md` → las tres
  entradas sobre `gen-dev-historial` y el parser que cortaba en `[id]`.
- **El programa de referidos, con las cuentas:** `docs/referidos.md`.
- **El runway como documento:** `docs/panorama-03oct.md` (se lee en `/admin/docs`).
- **No existe `docs/hallazgos-super-admin.md`** y no hace falta crearlo: los hallazgos de esta
  área viven donde vive el código que explican (pricing → `planes-y-cobro`, el registro →
  `infra`).

## Dos cosas que un briefing anterior afirmaba y hoy son falsas

Las dos salen de `docs/relevo.md` punto 21, escrito el **05/10/2026** en `6785dc16` (el commit
que abre esta ventana):

1. **«`app/admin/dev/areas.ts:797` afirma que no hay `/terminos` ni `/privacidad` y los dos
   existen desde el 5/09.»** Era cierto el 05/10 y dejó de serlo el **06/10/2026 con
   `a2e29f55`**: hoy `areas.ts:869` dice que las dos EXISTEN, el `vive[]` del área
   `legal-compliance` declara sus 7 rutas y la `nota` explica que la ficha mintió durante un
   mes. ⚠️ **Pero el panel de historial de esa área sigue vacío**, porque el generado no se
   volvió a correr (ver §3).
2. **«`app/admin/copywriting/` no está en ningún `vive[]`.»** Falsa ya cuando se escribió: se
   había agregado el **28/09/2026 en `21a192bf`** y hoy está en el `vive[]` del área `admin`
   (`areas.ts:956`). La segunda mitad de esa frase —«su Change History nace vacío»— sigue
   siendo **cierta en la pantalla**, por el generado viejo. Es el mismo caso que el anterior:
   la ruta se arregló y el panel no cambió.

## Nota sobre el estado del clon, leída a las 19:20 del 10/10/2026

Es una **ventana**, no un hecho: hay varias sesiones escribiendo su relevo sobre este mismo
clon al mismo tiempo y esto cambia de minuto a minuto.

- Modificado sin commitear y **ajeno a esta área**: `app/crm/CrmBoard.tsx`,
  `app/crm/CrmToolbar.tsx`, `lib/campana-atribucion.ts`, `tests/crm-filtro-ads.test.ts` y
  `app/crm/arbol-seleccion.ts` (ya stageado por otra sesión). No se tocaron.
- Varios briefings vecinos se están reescribiendo ahora mismo (`ads-manager.md`,
  `api-mako.md`, `chatbot.md`, `crm.md`, `customer-success.md`, `avisos-y-whatsapp.md`,
  `seguridad-aislamiento.md`, y `infra-y-build.md` que nació en estos minutos).
- Dos commits locales **sin pushear** por encima de `9862c146`: `a6481b4d` (el hook
  `SessionEnd` commiteando un relevo) y `bf40ad44` («Entra una TERCERA cuenta»). Ninguno toca
  `app/admin`.
