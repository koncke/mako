# El relevo entre cuentas

<sub>**Este documento se PISA en cada relevo.** Siempre describe el último traspaso; las
versiones anteriores viven en el historial (`git log -p -- docs/relevo.md`).</sub>

**Relevo del 2026-10-10 — la ventana del 05/10 12:33 al 10/10 18:59.**
670 commits, 39 migraciones nuevas (0193 → 0245). De `6785dc16` a `9862c146`.
Escrito por 9 lectores, uno por área, cada uno midiendo contra el código y la base.

> ⚠️ **Está escrito para una cuenta NUEVA, sin una línea de historial.** Si algo te suena a
> que falta contexto, no falta: preguntá. Lo que sí es material de **segunda mano** es todo
> lo que dice de código: sale de leerlo, no de ejecutarlo. **Verificá antes de actuar.**

---

## Los tres comandos del primer minuto

1. `cat docs/relevo/chats.md` — **en qué chats se estuvo trabajando**, con su última
   actividad y qué briefing le toca a cada uno. La barra lateral de una cuenta nueva está
   vacía: los chats están indexados por cuenta. Ese archivo es el índice que la barra no da.
2. `git log --oneline -20` y `git status` — qué entró después de este relevo, y **si hay otra
   sesión escribiendo ahora mismo** (pasa seguido: son varias sobre el mismo clon).
3. `docs/relevo/<tu-área>.md` — el briefing de lo que vayas a tocar. Están todos al día
   al 10/10.

Estado al cerrar: **todo pusheado** (`origin/main` = `9862c146`) y el último deploy de
producción figura `Ready`.

---

## Lo urgente, por fecha

**1. El lunes 12/10/2026 a las 14:20 UTC sale el primer reporte semanal multi-cliente de la
historia, y nunca corrió ni una vez.** El cron está en `"20 14 * * 1"` (`vercel.json`) y el
código que itera inquilinos se desplegó el 06/10 — después del lunes anterior, así que su
primera corrida real es ésa. Sale **por email a todo workspace activo con destinatario**
(el default de `notification_prefs.semanal` es activo+email, `lib/perfil.ts:233`). El
`?dry=1` **nunca se pudo correr**. Es lo único de todo el relevo con fecha de vencimiento:
`app/api/cron/reporte-semanal/route.ts`.

**2. El Change History de `/admin/dev` está congelado desde el 07/09/2026, con 989 commits de
atraso.** Son las 124 áreas que contestan «¿qué se hizo acá?» — el índice del trabajo. No se
ve como un hueco: se ve como un área que nadie tocó, que es la forma más cara de equivocarse.
Se arregla con un comando: `node scripts/gen-dev-historial.mjs` y después `npm test`.

**3. Nada de Automations se vio con clics en producción.** Entraron **ocho tandas** de
feedback en la ventana y están desplegadas para los 10 clientes; lo único que se miró fue dev
local sobre el ws9, sin guardar nada. Entrar a `hola-mako.com/automations` y mirar el lienzo.

**4. Customer Success y el curso: dos tandas enteras en `main` que nunca se vieron
funcionando** (los 20 ajustes del 08/10 y el acceso por producto del 09/10, migs 0223 y 0232).
1.067 tests en verde no prueban una pantalla.

**5. La rama `wip/api-acciones-0910`** (worktree `C:/dev/mako-api`): 343 operaciones de la API
aprobadas y sin terminar, incluida el área `comunidad` entera (41 ops) que el producto ya
tiene y la API no. Lleva 670 commits de atraso contra `main` y envejece sola.

---

## Qué es cada cosa, para quien nunca la vio

MaKo es una app multi-inquilino de marketing: cada cliente es un **workspace** (`ws1` es
Mauricio Bustos, un cliente, y la constante `OWNER_WS` vale 1 por razones históricas — **no
es el dueño**; el dueño es Martín). El código vive en `dashboard-marketing/`, es Next.js 16
con App Router, y la base es Supabase.

| Área | Qué es | Su briefing |
|---|---|---|
| **Automations** (ex `/chatbot`) | Flujos con ramas que le hablan al lead por WhatsApp. Lo más movido del repo | `relevo/chatbot.md` |
| **CRM** | Leads, embudos, la ficha del lead | `relevo/crm.md` |
| **Customer Success** | La ENTREGA de un servicio: kanban por producto, el curso y la comunidad | `relevo/customer-success.md` |
| **API de MaKo** | La API pública con tokens estilo GitHub: 526 operaciones en 19 áreas | `relevo/api-mako.md` |
| **Super admin** | Strategy, runway, costos, y los registros de dev | `relevo/super-admin.md` |
| **Ads Manager** | Campañas de Meta, y los canales de Instagram y Messenger | `relevo/ads-manager.md` |
| **Seguridad** | Aislamiento entre clientes, cifrado, credenciales | `relevo/seguridad-aislamiento.md` |
| **Avisos y WhatsApp** | Reportes, notificaciones y las líneas de WhatsApp | `relevo/avisos-y-whatsapp.md` |
| **Infra** | Build, tests, el pre-push, y el oficio de trabajar acá | `relevo/infra-y-build.md` |

---

## Lo que NACIÓ en estos cinco días

- **Una automatización dejó de ser una lista y pasó a ser un GRAFO** (mig `0223_flujo_grafo`).
  Cada paso es un nodo con id estable y su `siguiente`: **el orden del array NO es el orden del
  flujo**, y la entrada se pide con `raizSalida(pasos)`, nunca `pasos[0]`. Con hilos en
  paralelo (`0228`), varios CRON por automatización (`0241`), borrador vs publicado (`0240`) y
  las posiciones del lienzo guardadas (`0233`).
- **Un lead dejó de tener UN solo embudo** (mig `0207`, `lead_funnel`). Antes, ponerlo en un
  segundo producto obligaba a MOVERLO y eso le reseteaba la etapa y le limpiaba la venta. Hoy
  la «casa» sigue en `leads.funnel_id` y cada producto extra es una fila aparte.
- **El curso vive adentro de MaKo** (Whop salió del producto) y nació la **comunidad** tipo
  Skool por producto.
- **La API de MaKo**, entera y desplegada: 526 operaciones, 398 rutas REST, tokens con nombre,
  permisos por área y expiración. Las cuatro decisiones de «copiá GitHub tal cual» (08/10)
  están hechas.
- **Ads Manager quedó operable por CADA cliente**: hasta el 07/10 15:47 todo botón de escritura
  daba 403 fuera del ws1; `db7b7682` lo cerró.
- **Chatwoot (el WhatsApp oficial) se borró entero** el 09/10. El código vive en la etiqueta
  `archivo/chatwoot-2026-10-09`; `lib/chatwoot.ts` quedó de cascarón porque lo importa la rama
  `wip`. **Código nuevo no lo importa.**
- **La tab Strategy** del super admin (`9862c146`, el último commit de la ventana): la
  estrategia, el runway, los costos y los referidos en una sola pantalla.

---

## Lo que espera una DECISIÓN de Martín

Son 71 repartidas entre los nueve briefings. Las que ordenan el resto:

1. **La foto de los leads vive en un bucket PÚBLICO** (`avatars/leads/<ws>/<lead>.jpg`, dos
   enteros chicos de adivinar). Dejarlo · pasar el prefijo a privado con URL firmada, como ya
   hace el portal del curso · o un nombre no adivinable, que es lo barato y cierra la
   enumeración.
2. **Los reportes diario y horario siguen siendo sólo del ws1**, así que las preferencias de
   notificación de los demás clientes son decorativas para esos dos caminos. Abrirlos ·
   dejarlos del dueño y sacarlos de la lista que el cliente ve.
3. **Qué se hace con `wip/api-acciones-0910`** (343 operaciones): retomarla entera · tomar sólo
   `comunidad` · o darla de baja.
4. **El delay de minutos entre dos mensajes parte la tarjeta** con una espera, porque el motor
   no puede dormir minutos adentro de una corrida (tope 10 s). Es un default que eligió Claude,
   no él.
5. **Ganar en un producto AGREGADO no marca al lead como ganado** (la v1 manda la casa, a
   propósito). Si alguien compra el segundo producto, esa venta no entra.
6. **¿Entra `npm test` al pre-push?** El argumento escrito para dejarlo afuera es que «son ~9
   segundos»; medido el 10/10, son **134-155 s**. El número que sostenía la decisión es falso.

---

## Las trampas que más tiempo ahorran

- **Hay varias sesiones sobre el MISMO clon.** `git status` antes de tocar nada; commiteá por
  **ruta explícita** y nunca `git add -A`. Al cerrar este relevo había otra sesión escribiendo
  en cinco archivos del CRM sin commitear.
- **El `.git/hooks/pre-push` es el único control automático que hay.** No hay CI, y
  `next build` tiene `typescript.ignoreBuildErrors: true`. Si reclonás, el hook **desaparece en
  silencio**: hay que recrearlo (está en `AGENTS.md`).
- **El typecheck corre de a UNO por máquina** (hay un lock): con cuatro sesiones se comían la
  RAM.
- **La cuenta activa se DECLARA, no se deduce.** `head -1 ~/.claude/cuenta-activa.txt` antes de
  firmar un commit, y el titular sale de `~/.claude/cuentas.tsv`. Si dice `SIN IDENTIFICAR`,
  hay que sumarle una línea a esa tabla.
- **Todo `~/.claude` lo comparten las cuentas, incluidos los números.** Un `98%` de cuota
  medido por otra cuenta hizo cerrar una sesión que estaba al 18%. Ver `docs/dos-cuentas.md`.

---

## Lo que este relevo CORRIGIÓ, y por qué importa

Los nueve lectores encontraron **afirmaciones falsas en los briefings anteriores**, varias de
ellas escritas pocas horas antes. Algunas muestras:

- «Falta aplicar la migración 0215» — está aplicada; medido contra producción.
- «Producto múltiple por campaña choca con que un lead tiene un solo `funnel_id`» — dejó de ser
  cierto el 06/10 con la mig 0207.
- «La octava tanda no está pusheada ni vista» — las dos mitades están en `origin/main`.
- «Quedan archivos sin commitear» — se habían commiteado 45 archivos una hora antes.
- «`npm test` son ~9 segundos» — son 134-155 s, y ese número era el argumento de una decisión.

**La regla que sale de ahí: una medición tiene FECHA.** Acá entran más de 100 commits por día;
un dato de hace unas horas puede estar vencido. Antes de repetir una afirmación de este
documento —o de cualquier briefing— mirá cuándo se midió y, si pasó tiempo,
`git log --since=<esa fecha> -- <los archivos>`. Si devuelve algo, tu dato está vencido hasta
que lo revises.
