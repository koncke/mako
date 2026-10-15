# El relevo entre cuentas

<sub>**Este documento se PISA en cada relevo.** Siempre describe el último traspaso; las
versiones anteriores viven en el historial (`git log -p -- docs/relevo.md`).</sub>

**Relevo del 2026-10-14, 15:20 hora AR: la cuenta 2 (claude2) cierra al 98% semanal.**
Lo escribió el chat orquestador («Estrategia 3 cuentas»), que integró y pusheó todo lo del 13 y el
14/10. Martín pidió: «Pausa todo y guarda contexto para la próxima cuenta… Solo pushea esto último y
luego pausa todo de todos los chats».

> ⚠️ Material de primera mano sobre los pushes; de **segunda mano** sobre el código de cada chat (sale
> de lo que cada chat reportó). Verificá antes de actuar.

---

## Los tres comandos del primer minuto

1. `cat docs/relevo/estrategia-3-cuentas.md`: **cómo se pushea hoy** (un solo push por vez desde un
   worktree, merge y nunca rebase, el vigía de RAM, heap de 5120, «no esperes RAM»), y lo pendiente.
2. `git status` y `git log --oneline origin/main..main`: en el main LOCAL del clon hay commits de
   docs **sin pushear** (el merge de los docs del CRM, `5fd7efd91`, y este relevo). Salen con el
   próximo push; no cambian producción.
3. `docs/relevo/<área>.md` del chat que vayas a continuar (tabla de abajo).

**Estado al cerrar:** `origin/main` = `ab2641963`, deploy de producción **Ready**. Los chats que
corrían (CRM y Landing Generator) quedaron **pausados** por el orquestador; ninguno estaba pusheando.

---

## Dónde quedó cada chat

| Chat | En producción | A medias (NO pushear sin su dueño) | Briefing |
|---|---|---|---|
| **CRM** | tanda A (reproductor de la grabación, etiquetas con «+N», «A revisar» por lead, clic derecho, MaKo al costado) | tanda B, la ficha por bloques: ramas `crm-bloques-b1..b5` (`C:/Users/marti/wtc-b1..b5`, 9-13 commits cada una). Tiene 2 commits WIP y Pagos 2 fallas altas de la revisión | `docs/relevo/crm.md`, `docs/relevo/crm-tanda-b1.md`, `docs/diseno-ficha-bloques.md` (las 7 decisiones de Martín) |
| **Landing Generator** | tandas 3-5 (hola-mako.site, botón de pago por la pasarela, VSL en los diseños, API) | tanda 6 en `landing-t6` (`C:/dev/wt-landing-t6`, +5 commits), pausada a mitad de un turno. Rojo en main: `tests/integracion-sin-salir.test.ts` por `DialogoPublicar.tsx` y `CobroBoton.tsx` | `docs/relevo/landing-generator.md` |
| **General** | sexta vuelta (bloques mirados en captura, tema «General» en las plantillas) y el arreglo del Dashboard sin hojas | nada | `docs/relevo/general-y-calendario.md` |
| **Image Editor** | tandas 1 y 2 (editor tipo Canva en Content Machine › Image, sólo super admin) | `opcion-image-en-clientes`: espera la decisión de Martín | `docs/relevo/image-editor.md` |
| **Automations** | «nada por detrás» completo: las 3 migraciones corridas (la 3ª, 8 automatizaciones, verificada) | nada | `docs/relevo/chatbot.md` |

**Pedido de Martín sin chat que lo tome (14/10 14:34, textual):** «Dale este mismo feedback al
dashboard... Que rediseñe bloque por bloque y que tenga en cuenta mobile. Que vaya viendo con datos
ficticios o con algun dato de algun workspace que todo se vea bien en diseño. Tanto bloques como las
plantillas.» El método está en `docs/hallazgos-objectives.md` → «General, sexta vuelta».

**Ramas que NUNCA se pushean sin su dueño:** `wip/api-acciones-0910`, `wip/api-acciones-1410`
(«A MEDIAS»), `api-acciones-1310`, `opcion-image-en-clientes`, `crm-bloques-b1..b5`.
Sin trabajo nuevo sobre origin: `chats-1410`, `graphics-1310`, `graphics-bloques-1310`,
`pagos-pasarela`, `video-editor`, `chatbot-v6`, `mobile-mismas-rutas` y **`pagos-automations`**
(decía «tiene 1 commit del 11/10 sin integrar» y es FALSO: `git cherry origin/main
pagos-automations` devuelve `-` para `b5843d84f`, o sea que el CRON «Pagos» y el evento «Entra un
pago» ya entraron a main por otro camino, y `lib/cobros.ts` llama a `enrolarPorPago`. Lo cazó el
chat de Automations el 14/10 16:00 y lo verifiqué).

⚠️ **Lo de arriba no es un detalle: es el modo de falla de este documento.** Una rama dada por
«sin integrar» manda a alguien a integrar lo que ya está, y un pendiente dado por abierto manda a
resolver lo resuelto. El 14/10 pasó dos veces el mismo día: esto, y las tres decisiones de
Strategy (pauta, `/vsl/costos` privada, el 1 a 1 a US$10.000) que figuraban esperando a Martín
cuando la cuenta 3 las había cerrado el 10/10 a las 21:37 en `a5cf14074`. **Antes de actuar sobre
cualquier «abierto» o «sin integrar» de acá, medilo**: `git cherry origin/main <rama>` para una
rama, `git log --since=<la fecha del relevo> -- <archivos>` para un pendiente.

---

## Lo que decide Martín

- Si la tab Image se ve también mirando la cuenta de un cliente (`opcion-image-en-clientes`).
- Si la barra de selección en lote del Ads Manager va oscura o clara.
- Que el vigía de RAM se levante solo si se cae (hoy sólo arranca al iniciar sesión).
- Confirmar el borrador de 50 tareas del Perro: https://hola-mako.com/plan/revisar/propmv7rwo1dkj2i6

## Lo que se aprendió hoy (ya escrito en el repo)

- `docs/hallazgos-infra.md`: mergear en el worktree de un push mientras corre su pre-push da errores
  falsos; un paquete suelto en `node_modules` y no declarado pasa el typecheck y tira el deploy
  (`qrcode`).
- `scripts/typecheck-lock.mjs` y `AGENTS.md`: el heap del typecheck pasó a 5120 MB (con el Image Editor
  no entraba en 4096).
- Un hito `tipo: 'prompt'` de `app/admin/dev/*/bitacora.ts` lleva `puntos` igual: frenó tres pushes.

---

# Ventana del 15/10/2026 (tarde-noche), chat «Estrategia 3 cuentas», cuenta claude1 al 88%

Martin migra a otra cuenta. Esto es lo que la que entre necesita saber, en orden de urgencia.

## 1. LO PRIMERO: el Centro de Operaciones se rehace de punta a punta

Lo rechazo mirandolo, y el detalle completo —con sus frases textuales y lo que ya esta medido— esta en
**docs/relevo/centro-operaciones.md**. El resumen: la vista de Chats esta en produccion, es «horrible»
segun el, sobran titulos, subtitulos, avisos y pestañas, y **no se puede mandar un prompt a un chat
desde ahi**, que era el punto. Se rehace con referencias reales (el autorizo Pinterest, Dribbble y
similares en vez de esperar a Grok, que quedo trabado en un cuadro de confirmacion de edad).

## 2. LA TRAMPA QUE COSTO LA TARDE: el build se queda sin memoria

**Sintoma:** se pushea, los tests y los tipos dan verde, y el cambio no aparece en la pantalla. Se lee
como «no se hizo» y en realidad **no llego a produccion**.

**Causa:** `npm run build` en Vercel terminaba con `out_of_memory` (SIGKILL). El proyecto corre en
maquina `standard` (8 GB) y **no tenia ningun tope de heap**, asi que V8 crecia hasta que el kernel lo
mataba. Un build colgado 29 minutos bloqueaba la cola entera —los deploys salen de a uno— y tres
commits quedaron esperando.

**Cura, ya aplicada:** la variable de entorno **`NODE_OPTIONS=--max-old-space-size=4096`** en el
proyecto de Vercel (production y preview). Ojo con el numero: **7168 es PEOR que nada** —se probo— 
porque Next levanta workers ademas del proceso principal y entre todos se pasan de los 8 GB; con 7168
el build murio en 2 minutos en vez de 7.

⚠️ **Esa variable NO esta en el repo**: vive en la configuracion de Vercel. Si alguien la borra, vuelve
todo. Y si el repo sigue creciendo, el proximo paso es subir la maquina de build, que **cuesta plata y
lo decide Martin**.

⚠️ **Y la regla de proceso que se pago hoy tres veces:** pushear NO es desplegar. Nada se le reporta
como listo hasta haberlo visto EN PRODUCCION. El estado se mira con la API de Vercel
(`/v6/deployments?app=mako`) y el motivo de un fallo con `/v13/deployments/<id>` → `errorCode`.

## 3. Lo que quedo funcionando y verificado en produccion

- **El diagnostico de una landing ya se ve.** Una landing armada en un constructor manda un HTML enorme
  con el contenido vacio (medido: 132.704 caracteres y NUEVE de texto visible), asi que el documento
  aislado quedaba en blanco. Ahora el recuadro se cae a la **pagina real** cuando el aislado no pinta,
  con un giro mientras carga. Verificado abriendolo: se ve la landing entera.
- **El guard de la marca** ya no se confunde con el nombre del repo (`hola-mako/dashboard-marketing`).
- **Cuatro ramas del CRM integradas** en `C:/dev/wt-crm-int`, SIN PUSHEAR: ver el punto 4.

## 4. Lo que quedo A MEDIAS y NO se pusheo

**La integracion del CRM**, en el worktree `C:/dev/wt-crm-int` (punta `6045b8a05`). Entraron b4, b3, b1
(sin su commit WIP) y b2, con las migraciones renumeradas a **0290/0291**, tipos limpios y 756 tests
del area en verde. Lo que falta:

- **Tres rojos de `tests/seguridad-crm-pagos-doc.test.ts`** que NO son agujeros: ese guard se escribio
  antes de que la rama de Pagos agregara el corte por sesion y cambiara un insert por upsert, asi que
  corta con «tu sesion no esta activa» antes de llegar a lo que mide. Hay que actualizar el test sin
  aflojarlo.
- **Un cuarto rojo que es falso positivo:** el guard dice que `proteccionesDeCuotas()` escribe en
  `pagos` y esa funcion **solo lee** (select sobre `cobros` y `flujo_corridas`).
- **b5 no se integro a proposito:** toca `lib/flujo-ia.ts` y Automations tiene tres ramas sin mergear.

⚠️ **El hallazgo caro de esa integracion:** la rama de Pagos es ANTERIOR a la auditoria de seguridad
del 14/10 y **borra la guarda `asegurarLeadDelNegocio` en TRES funciones**. Integrarla tomando «la
version de la rama» reabre el agujero por el que una cuota podia escribirse en el CRM de otro cliente.
Las tres estan devueltas en ese worktree, y una quedo mejor que antes (en `ajustarPlanPagos`, que es el
choke point, asi que la verificacion corre siempre y no solo cuando el patch toca ciertos campos).

## 5. Lo que Martin consulto y quedo registrado

**Aguantar un ataque (DDoS, Cloudflare, captcha, balanceador): NO esta nada.** Medido, no supuesto, y
escrito con el orden sugerido en **docs/relevo/ciberseguridad.md**. El resumen: Cloudflare no, captcha
propio no (los nueve «recaptcha» del repo son del puente a Google Flow), balanceador propio no, y
limite de pedidos en 35 de 339 rutas. La trampa a no pisar: un captcha o un WAF delante de los
webhooks los rompe en silencio.

## 6. El reparto a los chats (todos estaban caidos; los mensajes quedaron encolados)

Se les escribio a catorce con su pendiente y con las reglas nuevas del dia. Lo que cada uno tiene que
retomar esta en su propio mensaje; lo que vale para todos:

- **Automations:** las doce cosas que reporto Martin mas las tres de antes (Joan, la flecha tipo
  ManyChat, mandar el mensaje cuando abra la oficina).
- **Landing Generator:** las animaciones y el video de fondo del hero siguen SIN construir, y el
  `window.opener` del Pixel sigue abierto. Ademas: la misma pantalla pide la pagina dos veces, una sin
  la barra final del dominio (403) y otra con ella (200) — hay dos `normalizarUrl` en el repo.
- **Ciberseguridad:** el 2FA obligatorio es el 21/10 y cambiar la contraseña todavia no echa las
  sesiones abiertas.
- **Plan:** la tarjeta `plan-50-tareas-cargar` se publico rota (sin destino) y por eso quedo sin
  contestar.

