# MaKo onboarding strategy and tiered offering

`2026-07-16 05:11` → `2026-07-21 22:42` · 10 mensajes de Martín · 243 respuestas de Claude · sesión `9035e991`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-07-16 05:11`

Quiero que hagas un profundo análisis de toda la app para identificar cómo se debe plantear el ONBOARDING de un nuevo cliente.
No solamente te recomiendo leer el código, te recomiendo leer los otros chats, y todas las tareas de /plan en Super Admin, así tienes un contexto global.

Cuando tengas todo, quiero que me des tu veredicto de como debería ser el onboarding, aún no lo costruyas.
Ten en cuenta que quiero que el onboarding de un nuevo cliente sea lo más simple y rápido posible, quiero el efecto WOW lo antes posible. Por eso me imagino algo como que le pida los datos básicos de Meta, el resto de cosas necesarias y ya corra la primera RETRO del usuario.
Y que de ahí, el usuario AL ENTRAR en las otras tabs, como WhatsApp, Email, Closing Analyst, etc... Se vayan haciendo otros "mini onboarding" para configurar eso.
Y que justamente MaKo le vaya guiando en lo más prioritario.
Y al entrar a la app por primera vez, quedará pendiente el "Recorrido", que es típico en apps robustas, que tienes muchas cosas por configurar.

Aprovechando que estas haciendo este profundo análisis, quiero que también analices TODAS las funcionalidades de actuales, y las que tenemos proyectadas a futuro (úedes verlas en /plan de Super Admin), con el objetivo de ayudarme a armar la OFERTA CEBOLLA para vender MaKo por partes.
Por ejemplo, me imagino:

1. MaKo - Project Management App (La tab de /plan + avisos por WhatsApp)
2. MaKo no limitado a VSL Funnel, sacando las partes específicas de VSL Funnel y que le sirva incluso a quienes venden productos.
3. MaKo analizador de anuncios.
4. MaKo analizador de llamadas de ventas.
5. etc etc

### Claude

Voy a hacer un análisis profundo. Empiezo scouteando la estructura del repo y leyendo los archivos índice clave (nav, onboarding, los SEED de /plan y /martinkoncke) y las memorias más relevantes, para después lanzar un workflow multi-agente que barra todas las áreas de features y las sesiones pasadas.

### Claude

El glob de `page.tsx` no devolvió nada — déjame ver la estructura real del repo.

### Claude

El proyecto real vive en `dashboard-marketing/`. Ahora tengo el mapa de rutas. Déjame leer los archivos índice clave antes de lanzar el workflow.

### Claude

Glob usa el working dir primario; los archivos están un nivel adentro. Uso rutas absolutas. Leo los índices clave.

### Claude

Tengo el panorama de onboarding y nav. Ahora leo el SEED del backlog (roadmap futuro = clave para la oferta cebolla) y el índice del knowledge graph.

### Claude

Excelente — el SEED de PlanBoard es la mina de oro (34 proyectos + roadmap completo). Déjame leer el resto de las tareas del SEED y ver cuántas hay, y en paralelo empiezo a mapear las sesiones pasadas.

### Claude

Tengo el SEED completo (34 proyectos + 131 tareas = el roadmap entero) y toda la infra de onboarding. Ahora mapeo `lib/` y `api/` para dar anclas concretas a los agentes, y arranco la búsqueda en sesiones pasadas.

### Claude

Tengo el mapa completo del código, el roadmap (34 proyectos / 131 tareas) y la infra de onboarding. Ahora lanzo un workflow multi-agente que verifica en el código el estado REAL de cada área (para no fiarme de los %  auto-reportados del SEED) y su "superficie de configuración" por tab, y genera propuestas diversas. En paralelo, yo barro las sesiones pasadas.

Arranco el workflow en background:

### Claude

El workflow corre en background (10 lectores de inventario + 5 propuestas). Mientras tanto, hago yo el barrido de las sesiones pasadas — cargo la herramienta de búsqueda de transcripts.

### Claude

El hit clave: la "oferta cebolla" hoy es solo una tarea marcada como "futuro" en el board — nadie la bajó a tierra todavía (justo lo que Martín pide ahora). Hago unas búsquedas más finas para no perderme decisiones previas.

### Claude

Las sesiones confirman: la "oferta cebolla" nunca se bajó a tierra (es tarea "futuro") y la "vista simple" sigue pendiente — soy el primero en diseñar ambas. Mientras el workflow corre, verifico el punto más crítico de la visión de Martín: la primera Retro es el WOW, pero ¿cuánto tarda? Si son 13 min, choca con "WOW lo antes posible".

### Claude

Confirmado el punto crítico: la primera Retro es un run de **Opus de hasta 13 minutos** (`maxDuration = 800`, 8 fases), y corre *después* de la extracción histórica (varios minutos más). Eso choca de frente con "WOW lo antes posible" — es la tensión central que el veredicto tiene que resolver. Y los `FUNNEL_TEMPLATES` (highticket, webinar…) confirman que el onboarding hoy asume funnel VSL/webinar.

Dejo registrado el arranque y sigo cuando cierre el inventario.

### Claude

Voy bien encaminado. Resumen de dónde estoy antes de darte el veredicto completo:

**Ya mapeado (a mano):**
- **Onboarding actual** — wizard bloqueante de 4 pasos (`OnboardingWizard.tsx`): integraciones → datos de tabs (funnel por plantilla) → negocio → **primera Retro**. Meta y WhatsApp obligatorias y probadas. "Completar después" libera el dashboard. Estado en `app_settings/onboarding.state`.
- **El roadmap completo** — el SEED de [PlanBoard.tsx](dashboard-marketing/app/plan/PlanBoard.tsx): **34 proyectos + 131 tareas**, cada uno con impacto/esfuerzo/estado. Es tu inventario de la oferta cebolla.
- **Sesiones pasadas** — la "oferta cebolla" y "creativos estilo Claudio Conde" están como tareas *futuro*, nunca bajadas a tierra. La "vista simple" (3 tareas + experimentos) sigue pendiente. Nadie diseñó el mini-onboarding por tab: es terreno nuevo.

**La tensión que ya detecté y que el veredicto tiene que resolver:**
> Tu idea es "que ya corra la primera Retro" como WOW. Pero la Retro es un **Opus de hasta 13 minutos** que corre *después* de la extracción histórica (varios minutos más). "Primera Retro = WOW" y "WOW lo antes posible" se contradicen tal cual está. Hay que meter un **WOW instantáneo intermedio** (los primeros números de Meta apenas conecta) y dejar la Retro como el "segundo golpe" que llega solo.

**Corriendo ahora (background):** un workflow de 15 agentes — 10 verifican en código el estado REAL de cada área (para no fiarme de los % auto-reportados del SEED) y su "mini-onboarding" por tab, y 5 generan propuestas diversas de onboarding y de oferta cebolla + un crítico de completitud.

Te aviso apenas cierre y te entrego el veredicto de las dos cosas (onboarding + oferta cebolla) con todo aterrizado al código real.

### Claude

El workflow cerró — 15/15 agentes, 0 errores, 2M tokens de análisis. El resultado son 222K caracteres. Lo leo por partes, priorizando las propuestas y el crítico. Primero veo la estructura del journal.

### Claude

Estructura clara: 10 inventarios estructurados + 5 propuestas (texto). Extraigo las 5 propuestas y el crítico a archivos legibles y los leo.

### Claude

Ahora leo las propuestas y el inventario digest.

### Claude

Excelente material, todo verificado en código. Leo el resto del digest (CRM/funnel, analistas, plan/guardián) y las propuestas.

### Claude

Inventario completo y grounded. Ahora leo las 5 propuestas (onboarding ×2, oferta ×2, crítico).

### Claude

El orden del journal es por finalización, no por lanzamiento — las etiquetas quedaron cruzadas. El archivo de salida del workflow sí tiene las claves correctas (`parallel` preserva el orden de entrada). Re-extraigo desde ahí.

### Claude

Ahora sí están bien mapeadas. Ya leí la de "activación". Leo las otras cuatro: onboarding WOW, oferta por capas, oferta standalone y el crítico.

### Claude

El crítico es oro — encontró issues reales (el copiloto falso `/koncke`, que `/contexto` es super-admin y el conocimiento del cliente va en `/conocimiento`, el landmine del inbox '3', el flag GLOBAL de CRM auto, etc.). Ahora leo las dos propuestas de oferta.

### Claude

Tengo todo: inventario verificado en código (10 clusters), 5 propuestas y un crítico que encontró issues reales. Los agentes convergen fuerte. Acá va el veredicto de las dos cosas.

---

# Parte 1 — ONBOARDING: cómo debería ser

## El diagnóstico en una línea

El onboarding actual es un **wizard de "configurá todo antes de ver nada"** (4 pasos bloqueantes: integraciones → tabs → negocio → Retro). Es el anti-patrón clásico de activación. Y tu idea de "que ya corra la primera Retro" choca con "WOW lo antes posible" por un motivo concreto que verifiqué en el código:

> La primera Retro es un **Opus de hasta 13 minutos** (`maxDuration = 800`, 8 fases) que corre **después** de una extracción histórica que recorre 365 días de Meta a 1.5s por día — y esa extracción es **100% client-driven**: si el cliente cierra la pestaña, se congela y el WOW nunca llega ([lib/onboarding-extract.ts](dashboard-marketing/lib/onboarding-extract.ts), sin cron en `vercel.json`).

La Retro es el WOW **grande**, pero no puede ser el WOW **inmediato**. Necesitás un golpe instantáneo antes.

## El principio rector

**El onboarding no completa campos: lleva al cliente a un momento de valor demostrable con SUS datos, y encadena el siguiente.** Regla dura (la más importante de todo el diseño): **solo se expone lo que se puede demostrar HOY en el workspace del cliente.** Todo lo que está construido-pero-apagado (nutrición, CRM automático, "Hola MaKo", campanita) NO entra en el recorrido como promesa cumplida — se muestra como "en laboratorio" o como dry-run honesto. Prometer lo apagado mata la confianza más rápido que cualquier fricción.

## El flujo propuesto: 3 tiempos + recorrido

**Momento 0 → un solo paso obligatorio (1–2 min):** conectar **Meta** y probar. Nada más. Hoy el wizard exige también WhatsApp probado, y eso es la fricción más cara (inbox, WABA, provider_config) y **no aporta a la Retro** (ningún job de extracción depende de Chatwoot). WhatsApp sale del Momento 0 y pasa a su mini-onboarding just-in-time.

**El WOW, en tres capas de tiempo (de segundos a minutos):**

| Capa | Cuándo | Qué ve el cliente |
|---|---|---|
| **A — Preview instantáneo** | segundos, apenas Meta verifica | Llamada live a `/api/account-insights` (ya existe, alimenta "Audiencia y alcance") → gasto del mes, leads, CPL, alcance reales al costado, **antes** de que exista una fila ingestada. El primer "esto ya sabe de mi negocio". |
| **B — Retro de ventana corta** | 1–2 min | Extraer **primero los últimos 30 días** de Meta, habilitar la Retro contra esa ventana. El cliente ve su primera Retro real de un mes en minutos. |
| **C — Retro histórica completa** | background | El backfill de 365 días termina solo → "Re-generá tu Retro con todo tu histórico" (el botón ya existe). El segundo golpe, más rico, que lo trae de vuelta. |

**El Recorrido (checklist de activación persistente):** vive en [/general](dashboard-marketing/app/general/page.tsx) (card colapsable arriba) + un badge de progreso en el sidebar. Cada ítem:
- Se deriva del **estado REAL** de conexión (`integracionConectada(...)`, `credWs(...)`, flags de envío, conteos), no de un checkbox manual.
- **Deep-linkea a su mini-onboarding** de tab y se **auto-marca hecho** cuando la integración conecta de verdad (esto es exactamente lo que hoy NO pasa en el board `/plan`).
- **El Perro Guardián lo ordena.** Ya prioriza con Claude; solo hay que pasarle el brief del negocio (hoy `BoardShell.tsx:110` NO manda `contexto` → prioriza a ciegas del rubro). MaKo destaca **un solo** "tu próximo paso más valioso" arriba, no doce.

## El patrón de mini-onboarding por tab

**Ya existe el modelo:** `DominioSetup` en [/email](dashboard-marketing/app/email/EmailApp.tsx) (dominio → DNS → remitente → activar). Hay que **generalizarlo** en un componente `TabActivacion`: cada tab declara qué necesita para prenderse; al primer ingreso muestra un panel de activación **sobre el empty state** (no un modal bloqueante), reusa el motor de credenciales existente, y degrada a un banner fino descartable después. Tab por tab:

| Tab | Qué pide su mini-onboarding | Nota |
|---|---|---|
| **WhatsApp** | Elegir canal: Oficial (Chatwoot) o No oficial (QR Evolution) + prender envío | ⚠️ **Falta el toggle de UI** de `envio_whatsapp_enabled` (el setter existe, el botón no). Y forzar el `CHATWOOT_WA_INBOX_ID` — hoy cae a `'3'`, el inbox de Mauricio (leak cross-tenant). |
| **Closing Analyst** | Fathom API key + "Sincronizar" | Reusa `SERVICIOS_CLIENTE`. Necesita leads con email para matchear. |
| **Script Analyst** | Confirmar Meta + OpenAI (para `transcribe-ads`) | Se llena solo con los crons; el panel explica la espera. |
| **CRM / Leads** | Calendly + Meta Lead Ads (webhooks) | ⚠️ El webhook de Calendly **no rutea por workspace** → hasta cablearlo, ofrecer alta manual. |
| **Comercial** | Cargar el primer plan de cobranza (no es integración) | Sin `pagos`, Cash/Outstanding quedan en cero — el panel lo explica en vez de mostrar ceros mudos. |
| **Contexto de MaKo** | Completar el perfil del negocio | ⚠️ El conocimiento del cliente va en **[/conocimiento](dashboard-marketing/app/conocimiento/page.tsx)**, no en `/contexto` (que es **super-admin only** — el cliente no puede abrirlo). |
| **Reportes** (Perfil→Notif) | Número del dueño + plantilla `reporte_mako` aprobada | Es lo que prende el "latido" por WhatsApp. |

Las tabs coming-soon (Instagram, CS/Offer/Landing/VSL/Market Analyst, los Writers vacíos) **no llevan mini-onboarding** — no inflar el recorrido con cascarones.

## Reconciliación con el wizard actual

Se **conserva** el overlay bloqueante y el gate `guardOnboarding()` (la restricción multi-tenant no cambia), pero el wizard **se adelgaza a 1 paso** (Meta → Retro). Los pasos `tabs` (funnel + metas) y `negocio` se vuelven **campos opcionales inline** + ítems del Recorrido. `PASOS` pasa de `['integraciones','tabs','negocio','retro']` a `['integraciones','retro']`. El dueño y closer/setter siguen sin ver wizard (ya lo garantiza `onboardingPendiente()`).

## Los arreglos de plomería sin los cuales esto es humo

1. **Cron de extracción server-side** que continúe `tickExtraccion()` por workspace — sin esto el WOW es rehén de que el cliente no cierre la pestaña.
2. **Pase corto de Meta (30 días) primero**, antes del backfill de 365 — sin esto el WOW tarda 15+ min.
3. **Toggle de UI de `envio_whatsapp_enabled`** — no existe hoy.
4. **Arreglar el falso-verde del semáforo** de General: con cero fuentes dice "todo en orden" (peligroso — transmite "está todo bien" cuando no hay datos).
5. **Fix del `CHATWOOT_WA_INBOX_ID='3'`** (leak al inbox del dueño).
6. **Ramificar por tipo de funnel:** no todo es VSL. La plantilla de funnel debe derivar pipeline + seed + qué widgets ocultar; las vistas VSL condicionales a `funnel_config` (si no hay etapa VSL, se oculta, no muestra "—").
7. **Scopear el recorrido por rol:** admin ve la escalera de config; closer ve "analizá tu primera llamada"; setter ve sus leads del día.

---

# Parte 2 — OFERTA CEBOLLA: vender MaKo por partes

## El insight que une los dos pedidos

**La mecánica de vender por partes ES el mini-onboarding por tab.** Cada módulo que vendas = una tab que se auto-configura al entrar. Construir `TabActivacion` **una vez** habilita el onboarding progresivo Y la venta modular. No son dos proyectos: son el mismo.

## Semáforo de madurez (la regla de oro: no vender vaporware)

| Estado | Qué es | Módulos |
|---|---|---|
| 🟢 **VENDER YA** | Shippable, standalone, WOW inmediato con lo que el cliente ya trae | Retro + Tableros · Closing Analyst · Ads Writer · MaKo Foco (PM) |
| 🟡 **CONDICIONAL** | Shippable pero solo para un avatar con datos | Script Analyst (solo anunciante con volumen/historial) |
| 🟠 **GO-LIVE** | Construido, apagado por flag — vender tras prender | Nutrición · CRM automático · Bandejas de WhatsApp (lectura ya, envío gateado) |
| 🔴 **A FUTURO — no poner en vidriera** | Owner-only / vaporware / cascarón | Ads Manager **escritura** (owner-only + página hardcodeada `lib/config.ts:46`) · Agente de Ads autónomo (no existe) · recordatorios al lead (siguen en n8n) · "Hola MaKo" bidireccional (sin UI cliente) · CS/Offer/Landing/VSL/Market Analyst + VSL/Landing/DM Writer (7 cascarones) · campanita (sin UI que lea `/api/notificaciones`) |

## Tus 4 ejemplos, aterrizados

1. **MaKo Project Management** ✅ = **MaKo Foco** (board [/plan](dashboard-marketing/app/plan/PlanBoard.tsx) + Perro Guardián + avisos WA). Core **shippable, cero config del cliente** (solo la key de Anthropic de plataforma). **Es el de mercado más amplio: no requiere ni ads ni funnel.** Candidato ideal a freemium/lead-magnet always-on. Único pendiente: genericar el seed (hoy son 8 proyectos/34 tareas de un negocio VSL) y los avisos WA (go-live).

2. **MaKo no-limitado-a-VSL** ⚠️ = **no es un módulo, es un reposicionamiento horizontal.** Convierte MaKo de "software para coaches high-ticket" en "software para cualquiera que vende con un funnel" (incluido e-commerce/productos). Es **la palanca de mercado más grande**, pero requiere desacoplar tableros/funnel/seed de VSL (ver desacople).

3. **MaKo analizador de anuncios** = **Script Analyst** — pero es 🟡 condicional: en un cliente sin historial, "Patrones ganadores" arranca pobre y "valorar guion nuevo" es hipótesis floja (necesita `impressions>=8000`). **El "rayos-X de anuncios" que da WOW real el día 1 a un desconocido es en realidad la Retro**, no el Script Analyst. Vendé el Script segmentado al anunciante con volumen.

4. **MaKo analizador de llamadas** ✅ = **Closing Analyst**. **El candidato más limpio para vender suelto y caro:** dolor agudo, input que el cliente ya tiene (Fathom), análisis crudo funciona solo con Fathom. Reemplaza el ojo de un consultor de ventas.

**Descubiertos que faltaban en tu lista:** **Ads Writer** (tripwire barato, multi-tenant, cero config — la única feature de Ads que anda para cualquier workspace) y **Retro + Tableros** (el WOW/cerebro, el recurrente que justifica el ticket).

## El orden de la cebolla (entrada → upsell)

La lógica: **cada capa diagnostica una rebanada y al hacerlo expone el hueco que llena la siguiente.**

- **Semilla / lead-magnet (1 integración, WOW inmediato):** **Retro** (para quien corre ads) o **Closing** (para quien vende por llamada) — dos avatares distintos. Alternativa freemium always-on: **MaKo Foco**. *La Retro nombra sus propios huecos* ("no marcaste cierres", "no analizaste tus llamadas") → cada hueco vende el módulo siguiente sin que lo pitchees.
- **Tripwire barato:** **Ads Writer** — mete al desconocido en el ecosistema y lo califica.
- **Núcleo recurrente:** **Retro + Tableros completos** (el cerebro).
- **Operar:** **CRM**.
- **Automatizar comunicación:** **Bandejas → Nutrición** (máxima retención).
- **Enterprise (el último por madurez):** **Ads Manager writes** — hoy solo como servicio done-for-you del dueño hasta desacoplar.

**Regla de oro:** cada anuncio promete UNA cosa y se cumple el minuto 1 con lo que el cliente YA trae. Retro y Closing cumplen. Lo apagado/owner-only/vaporware se queda adentro — venderlo suelto "quema pólvora" (tus palabras, y el código las respalda).

## El trabajo de desacople, priorizado (compartido con el onboarding)

1. **`TabActivacion`** (mini-onboarding por tab) — la piedra angular: habilita onboarding progresivo **y** venta modular. *Empezar por acá.*
2. **Cron de extracción + Retro de 30 días** — hace el WOW real y confiable.
3. **Genericar el seed del board + pasar el brief al Guardián** — habilita vender MaKo Foco a negocios no-VSL. Bajo esfuerzo, mercado amplio.
4. **Tableros/funnel agnósticos de VSL** — habilita el reposicionamiento horizontal (#2 de tu lista). Esfuerzo medio, desbloqueo grande.
5. **Toggle de WhatsApp per-workspace + migrar `CRM_AUTO_ENABLED` de flag global a per-workspace** — habilita el go-live de nutrición y CRM.
6. **Ruteo de webhooks por workspace + fix inbox '3'** — cierra leaks, robustece el CRM en vivo.
7. **Escritura a Meta multi-tenant** (`credWs` + `META_PAGE_ID` por workspace) — el techo de la cebolla, lo más pesado, para el final.

---

## Lo que uniría todo

Si tuviera que darte **un solo movimiento** que desbloquea las dos cosas: **construir `TabActivacion` + el cron de extracción + la Retro de 30 días.** Con eso tenés (a) el onboarding WOW-first progresivo que querés y (b) la infraestructura para vender cada módulo suelto con su propio arranque asistido. Todo lo demás son capas encima de esa base.

No construí nada — esto es el veredicto, como pediste. Puedo, si querés: **(a)** dejarlo como doc en `docs/` (estilo los specs del board), **(b)** bajarlo a tareas priorizadas en `/plan` para que el Perro Guardián las ordene, o **(c)** profundizar cualquiera de las dos partes. ¿Cómo seguimos?


---

## Martín

`2026-07-16 12:42`

Vamos primero a concluir el onboarding y luego seguimos con la oferta.
Primero quisiera que me des como te imaginas el formulario, teniendo en cuenta como ya venimos haciendoló, simple y miniamlista, y pregunta por vez.
Por otro lado, no creo que conectar WhatsApp NO oficial sea una gran fricción en el onboarding principal, ya que solo es escanear el QR, como todos ya lo saben hacer. Lo que si es fricción es conectarle las API de Claude o de Groq para que MaKo responda, pero para ello, puedo tener una API de Groq como SuperAdmin y que MaKo utilice esa durante el onboarding. Y si el usuario le comienza a pedir cosas de más, que MaKo siempre lea primero si tiene las API conectadas correctamente, y en caso de no, le responda que las tiene que conecctar. Solo durante el onboarding podemos presetear una conversación de bienvenida, con algunos datos básicos extraidos de Meta para que el usuario tenga el efecto WOW me está diciendo por WhatsApp lo que pasa en mi funnel.

Por otro lado, me imagino el onboarding dividio en 2 pantallas.
La pantalla de la derecha el form simple, y en la izquierda que salgan "animaciones" con funcionalidades "wow" dentro de la app, como un carrusel.

También sería bueno preguntarnos que tipo de Retro podríamos hacer hoy con solamente los datos de Meta... Tal vez habría que hacer una prueba, ya que ¿Qué tipo de Experimentos y Tareas va a proponer la Retro?

Por otro lado, ¿Qué tabs va a poder ver el usuario solo con Meta?

Y en qué momento se le pide que complete el resto del onboarding, tanto para las otras tabs y funcionalidades, como para el histórico...

### Claude

Perfecto, cerramos onboarding primero. Tus tres correcciones son buenas y una es clave: **el QR no es fricción, la fricción son las APIs de IA** — y usar tu Groq de SuperAdmin durante el onboarding para que MaKo salude por WhatsApp con datos reales de Meta es, probablemente, el WOW más fuerte de todo el diseño.

Pero antes de diseñar necesito responder empíricamente tus preguntas (qué Retro sale solo con Meta, qué tabs se prenden). Lanzo investigación focalizada:

### Claude

Mientras corre, verifico yo mismo el punto que decide tu idea de Groq: si la key de IA hoy es de plataforma o por-workspace.

### Claude

Encontré algo que **reframea tu idea de Groq**, y es importante:

**Las keys de IA ya son de plataforma, no del cliente.** El código lee `process.env` directo:
- [lib/anthropic.ts:29](dashboard-marketing/lib/anthropic.ts:29) → `process.env.ANTHROPIC_API_KEY`
- [lib/ai-cheap.ts:21-27](dashboard-marketing/lib/ai-cheap.ts:21) → `process.env.GROQ_API_KEY`, con fallback a `OPENAI_API_KEY`

O sea: **MaKo ya usa tu Groq/Anthropic de SuperAdmin, siempre — no solo durante el onboarding.** El cliente nunca necesitó traer su propia key. Lo que imaginabas construir para el onboarding ya es el comportamiento por defecto de todo el producto.

Pero hay un detalle que huele a bug: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` y `GROQ_API_KEY` **sí están en el catálogo de credenciales del cliente** ([lib/metodo-catalogo.ts:131,150,169](dashboard-marketing/lib/metodo-catalogo.ts:131)) — o sea, la UI le ofrece al cliente cargar sus keys de IA, pero el código las ignora y usa la de plataforma. Eso es un *mismatch de key* silencioso (justo el patrón que ya te mordió antes).

Esto convierte tu pregunta técnica en una **decisión de negocio**: no es "¿cómo hago que MaKo use mi Groq?", es "**¿la agencia paga la IA de todos los clientes para siempre, o en algún momento el cliente trae su propia key?**". El "MaKo lee primero si tenés las APIs conectadas" solo hace falta si vas a BYOK.

Espero los resultados empíricos (qué Retro sale solo con Meta, qué tabs se prenden, el patrón de form) y te armo el veredicto completo con el diseño del formulario.

### Claude

El agente **se conectó a producción y leyó una Retro real** para responder tu pregunta empíricamente. El resultado cambia el diseño por completo. Extraigo todo.

### Claude

El verificador encontró algo grande que **sube el techo honesto**: Meta ya reporta **agendas por anuncio** (pixel custom conversions), ya está ingestado, y lo verificó en prod (72 `agendas_meta` vs 73 agendas del CRM — coinciden). Leo el resto.

### Claude

Hallazgo central que cambia el diseño: **para el WOW el cliente no necesita escanear ningún QR.** El grupo de MaKo se crea desde la línea de la agencia y el cliente entra solo como participante — solo hace falta su **teléfono**, y eso ya ocurre hoy en el paso 2. Leo las dos piezas que faltan.

### Claude

Ya tengo todo. El workflow contestó tus preguntas con datos reales de producción (el agente leyó una Retro guardada y verificó los workspaces). Antes del veredicto escrito, te muestro cómo me imagino el formulario.

### Claude

Arriba está el Momento 0. Ahora el veredicto, ordenado por tus preguntas.

## 1. El formulario: ya existe, y el onboarding es el único que no lo usa

No hay que inventar nada. **`WizardShell`** ([app/leads/WizardShell.tsx:19](dashboard-marketing/app/leads/WizardShell.tsx:19)) ya es exactamente "simple, minimalista, una pregunta por vez": header `✦ MAKO` + dots, una pregunta grande por pantalla, footer Atrás/Siguiente. Lo consumen **11 archivos** (CrearTareaModal, PriorizarWizard, DebateModal, MakoChecklist…) y **ya tiene la prop `bloqueante`** — que es literalmente la semántica del onboarding.

El `OnboardingWizard` actual es el **outlier**: es el único flujo multi-paso de la app que no lo usa, y por eso arrastra su propio `Overlay`, sus propios dots y su propio `btnDark`… que además existe en **dos tonos distintos** (`#171511` cálido vs `#14161B` frío). No falta un componente: **sobra una implementación paralela.**

El plan concreto:
- Mover `WizardShell` a `app/_components/` (11 imports, mecánico).
- Agregar **una sola prop: `fullscreen`** — es el único gap real (hoy es modal de 560px; el onboarding necesita overlay). Con `fullscreen + bloqueante` tenés el onboarding y el resto de la app no se entera.
- Multiple-choice con opción custom (tu "tipo AskUserQuestion") **ya existe**: `ChoiceBody` en [guardian-form.tsx:39](dashboard-marketing/app/plan/board/guardian-form.tsx:39). Subirlo a `_components/wizard-bodies.tsx`.
- **Muere `btnDark`**, el CTA pasa a azul `var(--primary)` — es lo que manda la regla de color de `globals.css:11-13` (azul = acción, dorado = marca).
- Persistencia: la que ya tenés (`POST /api/onboarding {action:'paso'}` + retomar en el primer paso incompleto). Sobrevive a cerrar el navegador.

**Las preguntas del Momento 0** (~2 min): (1) intro → (2) **Meta** ← única que no es 1-pregunta, es la card de credencial con "probar conexión" → (3) **tu teléfono** ← el WOW → (4) ¿cómo vendés? (`ChoiceBody`: VSL / Webinar / Llamada directa / *otro*) → (5) meta del mes (opcional) → (6) tu primera auditoría.

**Sobre las 2 pantallas:** de acuerdo, pero con una corrección. El panel izquierdo **no debería ser un carrusel de marketing** — debería *convertirse* en los datos reales del cliente apenas Meta verifica. Un carrusel de features compite con tu propio producto; ver **tu** CPL apareciendo en vivo gana siempre. Carrusel solo en la pantalla 1, mientras todavía no hay nada que mostrar.

## 2. Tus tres correcciones

**Groq: ya está construido, no hay nada que hacer.** Las keys son de plataforma y el propio código lo dice: `SERVICIOS_CLIENTE` excluye anthropic/openai/groq con el comentario *"Infra de la agencia — NO se le pide al cliente"* ([api/onboarding/route.ts:28-32](dashboard-marketing/app/api/onboarding/route.ts:28)). El cliente **nunca** trajo su key, ni en el onboarding ni después. Lo que ibas a construir es el estado actual, permanente. Y "MaKo avisa si te falta la API" no aplica a la IA: **si MaKo está respondiendo, la IA ya funciona por definición.** Ese chequeo sirve para las integraciones de *datos* (Meta/Fathom/Chatwoot), no para Claude.

**El QR: tenés razón en que es fácil, pero es más fuerte que eso — no hace falta en absoluto.** El grupo de MaKo se crea desde la **línea de la agencia** (`instanciaVoz()`), y el cliente entra solo como participante ([mako-grupo.ts:203-204](dashboard-marketing/lib/mako-grupo.ts:203)). Para que MaKo le escriba solo hace falta **su teléfono**. Y ya pasa hoy: la acción `contacto` del paso 2 llama `setNumeroDuenoYSync` → crea el grupo, le pone la estrella y **manda la bienvenida**. El QR del cliente es otra cosa: es su inbox con *sus leads* (`groupsIgnore: true` por default). Valor mañana, fricción hoy. Va después del WOW.

**Lo que falta para tu WOW son dos cosas chicas y una grande:**
- La bienvenida hoy es **un string estático** (`mensajeBienvenidaMaKo`). Para que lleve datos reales: `fetchMetaInsights(fecha)` es live contra Graph (no la tabla ingestada, que al minuto 0 está en cero) + la maquinaria de `emitirDelCatalogo` que ya redacta con IA → falta una entrada `onboarding.bienvenida` en el catálogo de 49 avisos.
- **MaKo manda la bienvenida pero NO contesta si le responden**: `mako-doer-in.ts:215` corta si el grupo no está en la allowlist, que hoy solo se toca por admin API. Fix: read-modify-write donde ya nace el grupo.
- 🔴 **La grande: la voz de MaKo es tu número personal** (`INSTANCIA_VOZ_DEFAULT = 'mako_ws1'`). Con N clientes, todos los grupos salen de tu celular. Riesgo de ban y, si cae, se cae el WOW de todos a la vez. **Conectar `mako_superadmin` es prerequisito, no mejora.**

## 3. La Retro con solo Meta: no sale flaca, sale **mentirosa**

Pediste una prueba. El agente se conectó a producción y leyó una Retro real (#6). El resultado:

**De 6 áreas, solo 1 (Adquisición) tiene datos. De los 10 findings de la Retro real, sobrevive 1.** Pero el problema no es que sea corta — es que **Conversión y Revenue no se saltean**: sus queries no fallan, devuelven **ceros estructurales**, y el texto entra igual al prompt. Resultado garantizado para tu cliente nuevo, en su primera pantalla del producto:

- *"ROAS cash 0.00x — gastaste $7,565 y facturaste $0"* ← es la ausencia de `pagos`
- *"CUELLO del funnel: Formulario → Agenda 0.0% (rojo)"* ← es la ausencia del CRM, y **gana el cuello siempre** (severidad 1.0, la máxima)
- *"5 secuencias activas con 0 inscriptos"* ← **te lo autoinfligís**: el paso anterior del mismo wizard llama `seedNutricionTemplates()`. La Retro real #6 generó ese finding textual con 13 secuencias.

Y la **fase de Cruces** —el WOW de verdad, "lo que ninguna pestaña muestra sola"— queda muerta: necesita 2+ áreas con números reales. Peor: la fase de Verificación **no lo atrapa**, porque el 0 *sí* está en los datos. El verificador aprueba la mentira.

Un consultor que le entrega a un cliente nuevo un informe que dice "tu negocio factura $0" el día 1 no queda flojo: **queda incompetente. Es peor que no entregar nada.**

**Pero la respuesta no es sacar la Retro — es acotarla.** Y el techo honesto es más alto de lo que pensábamos: **Meta ya reporta agendas por anuncio** (pixel custom conversions, ya ingestado — verificado en prod: 72 `agendas_meta` vs 73 del CRM, coinciden). Así que con Meta sola llegás hasta **impresión → clic → formulario → agenda, con costo por agenda real**.

La **"Auditoría de Adquisición"** honesta: *"de tus 18 anuncios, 3 se comieron $1,150 sin traer un lead, 2 tienen el público quemado (frecuencia 5.2, CPL duplicado), tu mejor anuncio trae agendas a $47, y solo 1 de cada 83 impresiones llega a tu landing."* Todo cierto, específico, accionable.

Y acá está lo mejor: **la banda de cobertura deja de ser una disculpa y se convierte en tu pitch de venta** — *"conectá tu CRM y te digo cuál de estas agendas se convierte en cliente."* Que es exactamente lo que querés que haga después.

⚠️ Ojo: `areas:['adquisicion']` **sola no alcanza** — `recolectarDatos` no recibe `areas`, así que el cerebro sigue viendo `revenue:{roas:0}`. Hay que pasárselo también ahí, filtrar los charts, y cambiar el default de `RetroReport.tsx:362` (hoy **abre en Closing Analyst**, un embudo comercial en cero).

## 4. Qué tabs se prenden con solo Meta

Primero, una corrección de premisa importante: **"solo Meta" no es un caso borde — es el estado por el que pasa TODO cliente** entre que verifica Meta y conecta Chatwoot (la extracción arranca al verificar, antes de "Continuar"), y es **lo que todo closer/setter ve desde el día cero** (nunca ven el wizard).

| Estado | Tabs |
|---|---|
| 🟢 **Útil día 1** | **`/marketing`** (la estrella: un año de Meta bien presentado) · **`/ads-manager`** (funciona en vivo, antes de terminar la extracción) · `/integraciones` · `/plan` · `/conocimiento` · `/funnel` · `/ads-writer` |
| 🟢 **Sorpresa** | **`/script-analyst`** — la extracción **sí** transcribe y analiza **todos** los video ads con solo Meta. El cliente tiene análisis cualitativo real el día 1, y está enterrado en un grupo colapsado. |
| 🟡 **Parcial** | `/experimentos` (la Retro acotada) · `/mako` · `/mako-doer` |
| 🔴 **Miente** | **`/general`** — con cero fuentes el semáforo cae al verde: *"El negocio está sano · Buen momento para empujar volumen"* y Pendientes dice *"datos al día — el tablero es confiable"*. Certifica la salud de un negocio del que no sabe nada. |
| 🔴 **Da vergüenza** | **`/comercial`** — 6 secciones densas todas en $0/"—", gráfico plano, timeline vacío. Se lee inequívocamente como roto. |
| 🔴 **Falla en silencio** | `/whatsapp` — dice "Sin conversaciones" cuando en realidad no está conectado. Un error de config disfrazado de dato vacío. |

Buenas noticias sobre el timing: **la extracción escribe la misma tabla que el cron** y el cursor **camina hacia atrás desde ayer** → a los ~2 segundos `/marketing` y `/ads-manager` ya tienen datos. No hay que esperar a las 13:00. (Dos detalles: nada ingesta *hoy* —siempre ~1 día de lag— y la caché es de 600s.)

**La causa raíz del desierto tiene nombre:** `META_PAGE_ACCESS_TOKEN` está como **"(opcional)"** en la card de Meta ([metodo-catalogo.ts:61](dashboard-marketing/lib/metodo-catalogo.ts:61)), y sin él el job `meta_leads` queda `skipped` → **0 leads** → se apagan en cascada CRM, Comercial y el hero de General. El cliente cree que conectó Meta entero y se queda sin leads sin enterarse. **Des-opcionalizarlo convierte "solo Meta" de desierto en producto usable, sin tocar ninguna otra integración.**

## 5. Cuándo se pide el resto

Tres momentos, y el primero es el que te faltaba:

**MaKo lo pide por WhatsApp, cuando el dato lo justifica.** El grupo ya existe desde el minuto 0. Es infinitamente mejor que un checklist in-app porque lo alcanza donde está: *"Ya tenés 544 formularios este mes pero no veo tu CRM — ¿lo enchufamos y te digo cuáles agendaron?"*. La infra existe (catálogo de avisos + `emitirDelCatalogo`). Este es tu "latido", concreto y honesto.

**Just-in-time al entrar a la tab** (el `TabActivacion` que te propuse, modelado sobre el `DominioSetup` de `/email`, que es el único mini-onboarding bien hecho que ya tenés).

**El Recorrido** como checklist persistente, derivado del estado real de conexión, ordenado por el Perro Guardián.

**Y el histórico se pide solo**: ya corre en background; el gancho para volver es MaKo escribiendo *"terminé de leer tu último año — mirá esto"*. (Con el cron server-side, si no, se congela al cerrar la pestaña.)

## 6. Dos cosas antes de cualquier cliente

🔴 **Borrar `app/koncke/`.** Es un copiloto con respuestas **hardcodeadas falsas**, sin ningún guard, que dice "Hola Mauricio", muestra chips verdes de "Funnel en vivo · 286 leads" y **cita leads de otro inquilino por nombre** ("Salvador Loza") jurando *"Koncke usa tu data en vivo"*. Es huérfana (no está en nav) pero cualquier usuario logueado la abre tecleando la URL. Una línea de trabajo, elimina el riesgo entero.

🔴 **Bloquear las escrituras de Meta.** `META_PAGE_ID = '282881742134130'` está **hardcodeado a tu página de Facebook** ([lib/config.ts:46](dashboard-marketing/lib/config.ts:46)) y `meta-ads-create.ts` lo usa **sin scopear por workspace** en 10 rutas. Un cliente que crea una campaña **publica en tu página**. Esto es peor que el falso-verde: el falso-verde miente, esto escribe en la cuenta equivocada. Lectura ON, creación OFF hasta scopearlo.

---

¿Querés que lo baje a un spec en `docs/` con el detalle de implementación, o preferís que sigamos con la oferta cebolla y dejamos el onboarding acá cerrado?


---

## Martín

`2026-07-17 01:28`

1. Me gusta el formato que me propusiste. De hecho, hoy en integraciones, en cada servicio construí un modal similar. Puedes inspirarte. Por ahora solo tiene textos de marketing de funcionalidades... Pero me gusta que a medida que vamos conectando vaya apareciendo la data así en pantalla.
2. No creo que sea necesario limitarnos a los últimos 30 días. Si construimos un dashboard que se carga con datos de Meta eso es automático, se trae todo... Lo que tarda es en la Retro y analizar todos esos datos, pero no tarda nada en visualizarlos.
3. Yo creo que podríamos igualmente ir dejando algunos insigths de esos datos, tal vez no toda la Retro, pero para ir generando el efecto WOW.
4. No, Groq lo tiene que cargar cada usuario, tal vez te quedaste de una versión vieja. Y si no está así en el código, debería. Pero pensé en utilizar Groq de SuperAdmin solo para esta excepción.
5. En realidad MaKo SI debería de contestar, pero pidiendo al usuario que complete con sus API...
6. Si, tengo que comprarme un nuevo chip... Pero por ahora no. Subelo como tarea al /plan de superadmin y que el perro se encargue de definir su prioridad.
7. No, Meta no necesariamente registra agendas... Cada funnel es diferente... Pueden tener una campaña de mensajes y agendar desde allí, y como no tienen configurado CAPI, Meta nunca se entera... No lo tomes por hecho con el ejemplo de Mauricio, nada. Pero claro que si encontramos ese dato, buenísimo, lo podemos presentar.
8. Coincido que al principio si no pedimos todo, no podemos hacer una verdadera Retro...
9. Eso de /conocimiento SOLO debería existir en SUperAdmin, un cliente jamás debería poder acceder a esa ruta... Sería nbueno que también investigues que otras rutas se nos están escaándo como esa. Sobre todo porque no tenía ningún botón sobre como acceder, pero si ponía la url, si.
10. Hay tabs que hoy están MUY precarias, como mako-doer o ads-writer... Sería bueno que lo subas a plan para trabajarlo después.
11. Entonces podríamos aclarar en el semáforo tal vez como amarillo que faltan conectar datos...
12. Con respecto a Comercial. WhatsApp. Closing y Script Analyst y todas las que SI o SI dependen de que el usuario haya conectado algo o hecho cierto onboarding, al entrar NO debería mostrar nada, debería salir la misma pantalla dividida del onboarding y pedirle esos datos.
13. Si, borrar completamente app koncke.
14. Revisa lo de META_PAGE_ID yo estuve trabajando con el otro chat. Pero JAMÁS nada se debe pasar de un workspace a otro, eso es un fallo muy grave de ciberseguridad.

### Claude

Anotadas las 14. Tres correcciones tuyas son importantes y una es mía: en el punto 4 tenés razón y además **ya lo teníamos registrado** — hay una memoria mía que dice literal *"BYOK de IA: la key del cliente no se usa — se guarda y se pinta verde pero paga la agencia; explota con el 2do cliente"*. O sea que no es "ya funciona", es un **bug conocido**. Me quedé con el comportamiento actual en vez de con el deseado.

Lanzo la investigación de lo que pediste (rutas que se escapan, META_PAGE_ID, BYOK de IA) y leo el modal de integraciones:

### Claude

La memoria confirma tu punto 4 palabra por palabra. Mientras corre la auditoría, subo las tareas que pediste al `/plan` de SuperAdmin (puntos 6 y 10). Veo el SEED y el mecanismo de merge:

### Claude

**Alto — el board cambió desde que lo leí.** Hay tareas nuevas (132-155+) con una **fecha dura: Leila y Leandro entran como clientes el viernes 17/7 — o sea mañana.** Y varias tocan exactamente lo que estamos discutiendo. Necesito ver el SEED completo antes de agregar nada duplicado.

### Claude

Contexto crítico que cambia la urgencia: el board se actualizó (commit `a2b78a3`) y ahora tiene **30 tareas nuevas con fecha dura — Leila y Leandro entran mañana, viernes 17/7.** Y el Perro Guardián puso **#132 "Definir qué capa de la CEBOLLA se vende YA" en score 99: el primer dominó**, del que depende #133 (que ellos entren). O sea: el guardián dice que la oferta **no** va después del onboarding — la bloquea.

Mientras corre la auditoría, ejecuto lo que aprobaste (punto 13). Leo antes de borrar:

### Claude

Confirmado: el propio archivo lo admite en su encabezado — *"Es intencionalmente un PREVIEW: no hay LLM en vivo"*. Es huérfana (los otros hits de "koncke" son `/martinkoncke`, que redirige a `/todo`, y la URL de Calendly de la landing). Borro.

### Claude

`app/koncke` eliminado, `martinkoncke` intacto (es otra ruta), typecheck en verde. Lo commiteo y pusheo a main:

### Claude

Hecho y pusheado a main (`112ea28`). Espero la auditoría para agregar las tareas al `/plan` en una sola pasada (así bumpeo `MERGE_VERSION` una vez sola) y te traigo lo de META_PAGE_ID, BYOK y las rutas que se escapan.

**Mientras tanto, lo más importante que encontré no es técnico — es de plan:**

El board que cargaste ayer (`a2b78a3`) ya tiene las respuestas a varias de mis preguntas, y **contradice el orden que elegimos**. Vos dijiste "primero onboarding, después la oferta". El Perro Guardián dice lo contrario, y te doy la razón a él:

- **#132 "Definir qué capa de la CEBOLLA se vende YA" → score 99.** Su propia razón lo dice: *"el primer dominó de todo el tablero, y no es código: son 30 minutos de decisión tuya. De acá sale si el trabajo del viernes son 4 horas o 4 días."*
- **#133 "Que Leila y Leandro entren antes del viernes" → score 98**, la única fecha dura. **Es mañana.**
- **#136 "Onboarding simple y modular" → 92** y **#135 "Pensar el onboarding de cada tipo de cliente" → 88** — ambas *dependen* de #132.

O sea: **el onboarding que estamos diseñando no se puede cerrar sin la decisión de la cebolla**, porque #135 dice literal *"cada capa necesita un arranque distinto: pedirle a un cliente de la capa básica que conecte Meta es perderlo en el primer paso"*.

Y tres tareas del board chocan de frente con el WOW de WhatsApp que te propuse:
- **#144 "No funciona al crear un grupo de cliente (probado con Mauricio)"** — el grupo, que es el vehículo del WOW, **está roto justo en el caso real**.
- **#143 "MaKo no guarda contexto en WhatsApp"** — score 82.
- **#145 "Crear el grupo solo al escanear el QR"** — ya tenías pensado atarlo al QR.

Sumado a que la voz sale de tu número personal (el chip que todavía no compraste), **el WOW de WhatsApp no está listo para el viernes.** Para Leila y Leandro el arranque honesto es el de pantalla: Meta → datos apareciendo → insights. WhatsApp entra cuando #143/#144 estén cerradas y tengas el chip.

Una pregunta que te va a desbloquear el viernes, y que solo podés contestar vos:

**¿Leila y Leandro compran la misma capa que Mauricio (Meta + funnel VSL completo), o una capa más chica?** De eso depende si el viernes les pedís Meta (y esperás la extracción) o si entran a algo que funciona sin conectar nada — que, según el inventario, sería el board `/plan` + el Perro Guardián + Ads Writer, las tres únicas cosas que dan valor con **cero** configuración.

### Claude

La auditoría encontró algo que no esperaba y que es exactamente lo que te preocupa. Extraigo todo.

### Claude

Encontré algo grave y con timing pésimo. Leo las dos piezas que faltan y te sintetizo todo.

### Claude

Todo verificado. Antes de escribirte el veredicto, subo los hallazgos al `/plan` como pediste. Veo dónde termina el SEED:

### Claude

Perfecto. Agrego los hallazgos + tus dos pedidos al SEED y bumpeo `MERGE_VERSION` para que aparezcan sin pisar tus ediciones:

### Claude

El otro chat está commiteando en vivo, pero mi edit aplicó limpio. Ahora bumpeo `MERGE_VERSION` para que las tareas aparezcan sin pisar tus ediciones:

### Claude

Typecheck en verde, 12 tareas nuevas cargadas (173 en total). Commit y push:

### Claude

Pusheado (`690180b`). Ahora el veredicto de la auditoría.

---

## 🔴 Lo grave, y con el peor timing posible

**Cualquier cliente puede secuestrarle los webhooks a otro cliente. Está vivo hoy.**

`upsertRouting` reasigna un identificador a otro workspace **con un `console.warn` y sigue de largo** — nunca verifica que quien lo reclama sea el dueño. Un admin de cliente manda esto:

```
POST /api/onboarding {action:'config', settings:{meta_page_id:'<página ajena>'}}
```

…y desde ahí los webhooks le entregan **a su propio CRM** los leads (nombre, teléfono, email), los chats de Chatwoot, los transcripts de Fathom y las reuniones de Calendly **de la víctima**. Hay un segundo camino por `/api/integraciones/credencial` (el "tilde valida antes de guardar" es solo UI; la API no valida nada).

Lo que lo hace realmente explotable: **ninguno de esos identificadores es secreto.** Un page ID de Facebook es público, el event type de Calendly sale del link de agenda, el mail de Fathom es adivinable — y tu página está literalmente hardcodeada en `lib/config.ts:46`. Bonus: borrando la credencial se borra el mapeo, así que además se puede dejar a otro cliente sin ingesta.

**Es exactamente tu frase — "jamás nada se debe pasar de un workspace a otro" — y el viernes pasás de 1 cliente a 3, que es justo el día en que deja de ser teórico.** Lo cargué como #162 con score 99.

## Donde me equivoqué: META_PAGE_ID

Te lo sobrevendí. Verifiqué los 10 call-sites uno por uno: **los 10 están gateados owner-only. Un cliente NO puede publicar en tu página hoy.** El riesgo es *latente*, no activo — la mina se pisa el día que abras Ads Manager a clientes.

El hardcode **sigue** (`config.ts:46`, el otro chat no lo tocó), pero lo que sí hizo hoy es construir el andamiaje: `webhook_routing` (mig 0090), cifrado v2, y `META_PAGE_ID` en el catálogo BYOK como credencial por-workspace. Falta recablear `meta-ads-create.ts`, que sigue importando la constante. Es #170.

## Las rutas que se escapaban

Tu instinto sobre `/conocimiento` era correcto, pero **el fix que imaginabas es teatro**: el contenido de la página SÍ está tenant-scopeado (el cliente ve su propio conocimiento). **La fuga real es la API**: `/api/mako/knowledge` **no tiene ningún guard** — cualquier logueado, incluido un closer al que la página le rebota, hace `POST {action:'seed_curso'}` y **se importa la metodología curada completa y la lee en texto plano**. Cambiar el guard de la página no toca eso. (#168)

Y apareció una que no buscábamos y es peor: **el roadmap entero de la agencia viaja en el bundle de `/plan`**. `PlanBoard.tsx` es `'use client'` e importado estático, así que Next manda su chunk a **todos** — proyectos, scoring, fechas, razonamiento crudo. No hace falta teclear ninguna URL rara (`/plan` está en el nav de todos) y **el chunk ni siquiera está detrás del login** (el matcher del proxy excluye los `.js`). Peor: el detalle del proyecto de auditoría **describe por escrito los agujeros abiertos** — es un mapa de ataque. (#163)

**El patrón que las une**, y es la frase que me llevo de todo esto:

> El repo trata la **página** como unidad de autorización, cuando las unidades reales son el **bundle**, la **API** y la **fila**.

Por eso `requireRolWs([])` no protege nada de la agencia: significa "solo admin-**cliente**", y el admin de *cada* workspace lo pasa. El único que separa agencia de cliente es `getSesionAdmin()`. (Y además es fail-open: un usuario suspendido con cookie viva sigue entrando — #169.)

## BYOK de IA: tu memoria estaba exacta

Son **dos bugs apilados**, y conviene no confundirlos:
1. **El verde mentiroso**: `integraciones.ts` marca las 3 IA como `global: true`, así que la tarjeta da verde leyendo *tu* env — aunque el cliente no haya pegado nada.
2. **La key muerta**: `anthropic.ts` y `ai-cheap.ts` leen `process.env` y nunca importan `credenciales.ts`. La fila cifrada del cliente es un cementerio.

**Tienen que salir juntos, en el mismo deploy.** Si arreglás solo el verde, el cliente ve "falta" mientras la IA le sigue andando con tu saldo: nadie carga nada. Si arreglás solo el resolver, la IA se les corta antes de que la UI pueda explicar por qué.

La buena noticia: **ninguno de los 50 call-sites tiene que cambiar.** `credWs('ANTHROPIC_API_KEY')` ya resuelve el workspace solo vía el `AsyncLocalStorage` que ya existe. Es cambiar dos líneas + un resolver único. ~4-5 días con los topes y los ~11 evasores que hablan con OpenAI a pelo.

Y sobre tu idea: **la cortesía del onboarding ya existe por omisión** (`SERVICIOS_CLIENTE` no incluye las IA). El problema no es crearla — **es que nunca termina**. Dos decisiones que son tuyas, no técnicas:

- **`skipped` no puede ser cortesía.** Si lo tratás como pendiente, cualquiera que saltee el wizard tiene barra libre para siempre. Y `in_progress` no vence: quien abandone el wizard a mitad queda con tu saldo abierto indefinidamente. ¿Cuántos días de cortesía?
- **Groq y Anthropic no son el mismo pedido.** Groq es gratis y la key sale en dos minutos — pedirla el día 1 es razonable. Anthropic es prepago con tarjeta: pedirle a un cliente que cargue saldo es fricción real de onboarding, y puede ser justo el motivo por el que quieras que Opus siga siendo tuyo (facturado dentro de tu fee) y el BYOK obligatorio arranque solo por Groq. El diseño soporta las dos políticas sin cambios.

---

**Lo que subí al `/plan`** (12 tareas, scores provisorios — el perro las re-prioriza): las 6 de seguridad, la Retro que miente (#164), el semáforo falso-verde (#165), la pantalla dividida en tabs desconectadas (#166), los dos homónimos de page id (#171), tu chip (#172) y las tabs precarias (#173).

Tengo también documentado el modal de 2 columnas de Integraciones que hiciste (commit `07a5993`) para reusar su lenguaje cuando diseñemos el form — no lo leí todavía, lo dejo para ese momento.

**Sigue abierta la pregunta que te desbloquea el viernes:** ¿Leila y Leandro compran la misma capa que Mauricio (Meta + funnel VSL), o una capa más chica? Es #132, score 99, y el guardián dice que todo lo demás espera esa decisión.


---

## Martín

`2026-07-17 02:55`

Leila y Leandro utilizarán el modo de Projetc Manager... Tal vez deberíamos ver diferentes onboarding para esos casos. Y que SuperAdmin claro, pueda agregar "clientes" de diferentes tipos...

Bueno, ya tienes suficientes datos de todo el contexto. Comienza a crear todo.

### Claude

Decisión tomada y con eso alcanza. **Leila y Leandro en modo Project Manager es la mejor noticia posible para el viernes**: es la única capa que da valor con **cero integraciones** — o sea, cero Meta, cero extracción, cero Retro, cero espera. Y de paso no toca ninguna de las fugas que encontramos.

Arranco. Primero el mapa exacto de lo que tengo que tocar:

### Claude

Migración 0091 ya está tomada por el otro chat → la mía es 0092. Leo las piezas exactas que tengo que tocar:

### Claude

Tengo todo lo que necesito. El plan de build, en orden de dependencia:

### Claude

Empiezo por la base: la migración y el catálogo de capas.

### Claude

Migración aplicada en prod (verificó `leads=531` antes de tocar nada). Ahora el catálogo de capas — la fuente de verdad única.

### Claude

Ahora cableo la capa en `workspace.ts`.

### Claude

Ahora el gating por capa. Antes de tocar el guard, verifico un detalle que puede romper tu dev-login:

### Claude

Confirmado: `rol` es `null` solo cuando **no hay sesión** (las legacy devuelven `'admin'`), así que hacerlo fail-closed no rompe tu dev-login. Reescribo el guard con capa + el fix del hallazgo #169:

### Claude

Ahora le doy a cada página su key de nav. Las mapeo:

### Claude

Necesito unificar: hay keys de nav y de user-nav. Ajusto el catálogo y después mapeo cada página.

### Claude

Ahora aplico la key de nav a cada página. Es mecánico, lo hago en una pasada:

### Claude

Ahora las que usan `guardOnboarding()` (el whitelist de closer/setter) y `/conocimiento`, que pediste que sea solo SuperAdmin:

### Claude

Ahora `/conocimiento` a solo-SuperAdmin (tu punto 9) — copiando el patrón de `/contexto`:

### Claude

Typecheck verde. Ahora el Sidebar tiene que filtrar por capa. Veo cómo obtiene hoy el rol:

### Claude

`/api/auth/me` es el lugar natural: le agrego la capa y el Sidebar filtra con ella.

### Claude

Falta el `useState` de capa, el import, y filtrar también el menú de la foto (que usa otro filtro):

### Claude

El menú de la foto ya usa `puedeVer`, así que uso `tabEnCapa` (que une los dos menús) y queda cubierto todo con un solo filtro:

### Claude

El Sidebar ya esconde grupos sin items visibles (`filter((g) => g.items.some(puedeVer))`), así que para un cliente `pm` los grupos Analytics/Tools/Chats/CS desaparecen solos. Gating listo.

Ahora el alta de clientes por tipo en SuperAdmin:

### Claude

Ahora la UI del alta. Veo el formulario actual:

### Claude

Ya tengo la API del `Dropdown`. Agrego el selector de tipo al alta y la capa a la lista:

### Claude

Ahora el estado, el envío, el chip en la lista y la acción de cambiar de capa:

### Claude

Typecheck verde. Ahora el seed del board por capa — un cliente PM no debe recibir los 8 proyectos de un negocio VSL:

### Claude

El otro chat pisó mi cambio en `/api/auth/me` — sin eso el Sidebar no recibe la capa. Lo re-aplico:

### Claude

Ahora el onboarding modular por capa — el último bloque:

### Claude

El onboarding modular. Primero el estado, que hoy tiene los 4 pasos clavados:

### Claude

Ahora la API del onboarding: los requeridos y los pasos salen de la capa, no de constantes.

### Claude

`serviciosParaWizard` necesita recibir los requeridos. Lo cierro:

### Claude

La API ya deriva todo de la capa. Ahora el wizard, que tiene los 4 pasos clavados en una constante:

### Claude

Ahora los dots del header, el body y el paso `plan` (el cierre del onboarding PM):

### Claude

Ahora el componente `PasoPlan` — el cierre del onboarding de Project Manager:

### Claude

El wizard duplica el tipo del estado. Le agrego el paso:

### Claude

Typecheck y eslint verdes. Falta un detalle que rompería el flujo: "Completar después" manda a `/general`, que un cliente PM **no puede ver** — quedaría en un rebote.

### Claude

Ahora lo verifico en vivo. Levanto mi propio server y creo un cliente de prueba tipo Project Manager:

### Claude

Server arriba. Me auto-logueo como super-admin y voy al panel de clientes:

### Claude

La ruta es `/api/auth/dev-login`. Voy por ahí:

### Claude

El server se cayó. Lo levanto de nuevo y miro los logs:

### Claude

Next 16 bloquea un segundo dev server en la misma carpeta (el del otro chat corre en el 3000, PID 19892). No lo voy a matar. Pruebo si alcanzo el suyo — sirve mi mismo código:

### Claude

Alcanzo el server del otro chat (sirve el mismo código). Voy al panel de clientes:

### Claude

Funciona: `/api/auth/me` ya devuelve la capa y los workspaces existentes quedaron en `completo` (el default los preservó). Ahora creo un cliente **Project Manager** de prueba y verifico el gating:

### Claude

Cliente PM creado (ws 4) y la capa inventada se rechazó. Ahora la prueba de fuego: **entro como él** y verifico que el gating server-side lo rebote de las tabs que no compró.

### Claude

El onboarding de un PM son **2 pasos y cero integraciones requeridas**. Ahora lo que más importa: que el gating server-side lo rebote de verdad al tipear la URL.

### Claude

Demasiadas rutas a la vez (Turbopack compila cada una on-demand sobre OneDrive). Lo hago en tandas chicas:

### Claude

Los tres rebotan, pero por el gate del **onboarding pendiente**, no por la capa — eso enmascara la prueba. Marco su onboarding como saltado y así aíslo el gate de capa:

### Claude

Exactamente lo buscado: **`/general` rebota a `/plan`** (la casa de su capa), mientras `/plan` y `/mako` — lo que sí compró — se sirven. Verifico el resto de las tabs:

### Claude

Todo pasa. Dos notas:
- **El board del cliente PM quedó limpio** (0 proyectos, 0 tareas) — el seed VSL no corrió, como debe ser.
- `/conocimiento` me sirve **porque estoy impersonando siendo super-admin**: su guard es `getSesionAdmin()`, que mira el rol **global** (no el del workspace). Para un cliente real rebota. Es el comportamiento correcto.

Verifico el sidebar, que es lo que va a ver Leila:

### Claude

**El sidebar de un cliente PM tiene exactamente dos links: `/plan` y `/mako`.** Todo el resto desapareció, y el gate server-side lo respalda. Limpio la prueba y commiteo:

### Claude

Prueba limpia. Commiteo y pusheo:

### Claude

Hay un error de eslint en `Sidebar.tsx:169` (`react-hooks/immutability`) en una línea que no toqué. Verifico si es preexistente antes de commitear:

### Claude

El error de eslint es **preexistente** (aparece igual en HEAD, línea 161 → 169 por mis 2 líneas nuevas). No lo introduje yo. Commiteo:

### Claude

Listo y pusheado a main (`dedc0c0`). Está construido y **verificado en vivo**, no solo compilando.

## Lo que quedó armado

**La capa es ahora un atributo del cliente, no una rama del código.** Migración 0092 aplicada en prod (`workspaces.capa`, con CHECK constraint para que una capa inválida la rechace la base). De ella se derivan tres cosas: qué tabs ve, qué le pide el onboarding y qué se le siembra.

[lib/capas.ts](dashboard-marketing/lib/capas.ts) es la fuente de verdad única. Agregar "MaKo analizador de llamadas" mañana es **agregar una entrada al catálogo**, no tocar ifs por el código:

| | **Project Manager** | **Completo** |
|---|---|---|
| Tabs | `/plan` + `/mako` | todas |
| Onboarding | 2 pasos (negocio → plan) | 4 pasos (los de hoy) |
| Integraciones | **ninguna** | Meta + WhatsApp |
| Board | limpio | seed VSL |

**Verificado en vivo** con un workspace PM de prueba (creado, probado y borrado):
- El wizard le pide **2 pasos y 0 integraciones** — sin Meta, sin extracción, sin Retro.
- El sidebar le queda con **exactamente 2 links**: `/plan` y `/mako`.
- `/general`, `/leads`, `/marketing`, `/whatsapp`, `/closing`, `/integraciones` → **rebotan a `/plan`** server-side. Tecleando la URL, no solo escondiendo el link.
- El board arranca **limpio**: 0 proyectos, 0 tareas. No le caen los 8 proyectos de un negocio VSL que no tiene.
- Una capa inventada se rechaza en la API y en la base.

De paso caché dos cosas de la auditoría: **`requireRolWs` ahora es fail-closed** cuando el rol es null (antes un usuario suspendido con la cookie viva llegaba y la página renderizaba), y **`/conocimiento` pasó a `getSesionAdmin()`**.

## Lo que tenés que saber antes de mañana

**1. Para Leila y Leandro solo falta darlos de alta.** Vas a `/admin`, ponés el nombre, elegís **Project Manager** en el selector nuevo, y su email. Entran con Google y caen al wizard de 2 pasos. **Recomiendo que pases vos primero por el flujo completo con un workspace descartable** — es la tarea #138 del board y es media hora contra el papelón de estrenarlo en vivo.

**2. `/conocimiento` no está cerrado del todo, y no quiero que creas que sí.** El guard de la página está bien, pero la fuga real es `/api/mako/knowledge`, que **no tiene ningún guard**: cualquier logueado hace `seed_curso` y se copia tu metodología en texto plano. Es la tarea #168. Para clientes PM el riesgo es bajo (no es su interés), pero está abierta.

**3. Lo que sigue sin tocar y es lo más grave:** el secuestro de webhooks (#162). Con Leila y Leandro en modo PM el riesgo real baja bastante — no conectan Meta ni Calendly, así que no tienen motivo para tocar esas APIs — pero la vulnerabilidad sigue viva y **cualquiera con una cuenta puede llamar el endpoint igual**. Sigue siendo lo primero del board.

¿Querés que siga con #162, o preferís pasar vos primero por el onboarding PM y me traés lo que se rompa?


---

## Martín

`2026-07-17 04:12`

No, aquí solo vamos con el onboarding. Continua con eso.

### Claude

Perfecto, sigo con el onboarding. Lo que falta es justo lo que pediste primero y todavía no está: **el formulario de a una pregunta por vez, en dos pantallas.** Hoy el paso "negocio" del cliente PM le tira los 15 campos del `OnboardingForm` de una — que es exactamente lo contrario.

Leo el `WizardShell` que ya existe para extenderlo, no reinventarlo:

### Claude

El `WizardShell` es exactamente lo que pediste y ya tiene `bloqueante`. Le falta una sola cosa: ser pantalla completa con panel izquierdo. Lo muevo a `_components` (hoy vive en `app/leads/`, raro para que lo importe el onboarding) y actualizo los 11 imports:

### Claude

Ahora le agrego la única prop que falta — `fullscreen` con panel izquierdo:

### Claude

Ahora el brief por capa. Un cliente PM no tiene "oferta VSL ni avatar" — necesita otras preguntas:

### Claude

Ahora la API tiene que mandar el brief filtrado por capa:

### Claude

Falta el import y la acción para guardar el brief:

### Claude

La API ya sirve el brief filtrado. Ahora el paso `negocio` del wizard, de a una pregunta por vez:

### Claude

Me estoy complicando. Paro y lo pienso mejor: el paso de **integraciones no entra** en el molde de una-pregunta-por-vez (es una lista de credenciales con panel de extracción en vivo). Forzarlo rompería lo mejor que tiene el onboarding actual.

La arquitectura honesta: **la capa PM tiene su propio flujo** (es otro producto), y el de `completo` queda intacto. Saco el placeholder:

### Claude

Ahora sí, el flujo de la capa PM: una pregunta por vez, dos pantallas, con el escenario que se va llenando a la izquierda.

### Claude

Ahora conecto: si la capa es PM, el wizard delega en este flujo.

### Claude

Typecheck verde. Lo pruebo en vivo con un cliente PM real:

### Claude

El brief llega con las 3 preguntas y solo el grupo base. Ahora lo veo con mis ojos:

### Claude

La pantalla dividida funciona: izquierda "todavía no sé nada de tu negocio", derecha la bienvenida. Recorro el flujo completo como si fuera Leila:

### Claude

El flujo anda: 3 preguntas de a una y el cierre del Guardián. Pero mi chequeo del escenario dio `false` — verifico si es un bug real o mi test (el texto va en mayúsculas por CSS):

### Claude

Era mi test (el `innerText` devuelve el texto transformado por CSS). **El panel izquierdo muestra las 3 respuestas** y ya están **guardadas en la base**. Cierro el flujo:

### Claude

Se quedó en `/onboarding` — no navegó. Sospecho que marcar los pasos como hechos no pone el onboarding en `done`, así que `/plan` lo rebota de vuelta al wizard. Verifico:

### Claude

**Bug real encontrado, y de los que rompen todo:** el `status = 'done'` está clavado a `body.step === 'retro'`. Un cliente PM termina en el paso `plan`, así que su onboarding **nunca** pasaba a `done` → `/plan` lo rebotaba al wizard **en loop infinito**. Lo arreglo derivándolo de la capa:

### Claude

Verifico que el fix cierre el loop, con un cliente PM limpio:

### Claude

Loop cerrado: `negocio` → `in_progress`, `plan` (último paso de su capa) → **`done`**, y `/plan` ya se sirve. Y para `completo` el último paso sigue siendo `retro`, así que ese flujo no cambia.

Limpio las pruebas y commiteo:

### Claude

Ojo: quedó un workspace **"Prueba" (id 5, capa `pm`)** que **no es mío** — mis dos se llamaban "Prueba Capa PM" y "Prueba Form PM" y ya los borré. Como la capa `pm` no existía hasta hace un rato, alguien lo creó con el selector nuevo (¿vos probando?). **No lo toco.**

Commiteo:

### Claude

Pusheado (`4317f6c`). Guardo la decisión arquitectónica en memoria, que es lo que va a hacer falta en la próxima sesión:

### Claude

El onboarding está terminado para lo que necesitás hoy. Todo en main (`dedc0c0` + `4317f6c`).

## Lo que ve Leila cuando entre

Le das de alta en `/admin` eligiendo **Project Manager**. Entra con Google y cae a **tres preguntas, de a una por pantalla**, con el escenario a la izquierda llenándose con sus propias palabras:

1. ¿A qué se dedica tu negocio?
2. ¿Cuál es tu objetivo para los próximos 90 días?
3. ¿Qué es lo que más te está frenando hoy?

Cierra con la presentación del Perro Guardián y el botón **"Crear mi primer proyecto →"** que la deja en `/plan`. **Cero integraciones, cero espera, cero Retro.** Su sidebar tiene dos links: Plan y MaKo.

Verificado recorriendo el flujo completo en vivo: las respuestas quedan en la base, el escenario se llena, y `/plan` pasa a servir.

## El bug que te habría arruinado el día

El `status = 'done'` estaba **clavado a `body.step === 'retro'`**. Un cliente PM cierra en el paso `plan`, así que su onboarding **nunca** pasaba a `done` → `guardOnboarding` lo rebotaba al wizard **en loop infinito**. Leila habría quedado encerrada sin poder entrar nunca. Ahora el último paso sale de la capa; para `completo` sigue siendo `retro`, así que ese flujo no se tocó.

## Tres cosas que quiero que sepas

**1. Hay un workspace "Prueba" (id 5, capa `pm`) que no es mío.** Mis dos de prueba los borré. Como la capa `pm` no existía hasta hace un rato, salió del selector nuevo — asumo que lo creaste vos. No lo toqué.

**2. `WizardShell` se mudó de `app/leads/` a `app/_components/`** y toca 11 archivos (CrmBoard y todo el board `/plan`). Es un rename de import, typecheck y eslint verdes, pero **el otro chat está commiteando en vivo sobre esos mismos archivos** — de hecho ya me pisó un cambio en `/api/auth/me` que tuve que re-aplicar. Si ves un conflicto raro en el board, viene de ahí.

**3. El wizard de `completo` sigue con el `OnboardingForm` viejo** (15 campos de una) en su paso "negocio". No lo migré a propósito: el paso de integraciones no entra en el molde de una-pregunta-por-vez, y tocarlo hoy era riesgo sin beneficio para Leila y Leandro. Cuando quieras, ese paso puede reusar el mismo brief.

Lo que queda del onboarding (todo en el `/plan`, y **nada bloquea hoy**): la Retro que miente con solo Meta (#164), el semáforo en falso-verde (#165), la pantalla dividida en tabs desconectadas (#166) y el `META_PAGE_ACCESS_TOKEN` "(opcional)" (#171) — esos cuatro son de la capa `completo`.

**Mi recomendación para ahora:** pasá vos por el flujo con un workspace descartable antes de mandarles el link. Es la tarea #138 de tu propio board y es media hora contra estrenar el arranque en vivo con una clienta de verdad.


---

## Martín

`2026-07-17 04:31`

Avanza en una tanda GRANDE ya que me iré por un tiempo, ya tienes toda la info.

Mejor si avanzas creando el onboarding general, el de toda la app. Y mucho mejor creas el onboarding de allí y replicas ese diseño para los onboarding de las tabs.
Recuerda el lado izquierdo en negro, con preview luego de poner una API, y antes o cuando no haya la preview, carrusel de Marketing, como el que está en integraciones.

Quiero TODOS los onboarding creados, y mucho mejor si te esfuerzas en armar los mensajes de marketing del lado izquiedo. Para eso también tienes los copy de /vsl aunque con lo que avanzó la app se queda corto.

Te encargo todo.

### Claude

Entendido. Me encargo de todo. Empiezo leyendo las dos fuentes que me faltan: el informe del modal de Integraciones (que extraje pero nunca leí) y el copy de `/vsl`.

### Claude

Este informe es clave y **contradice parte de lo que construí** — con razón: para **credenciales** el lenguaje correcto es el modal de Integraciones (2 columnas, aside negro, todas las keys juntas), no un wizard de a un paso. El `WizardShell` sirve para las **preguntas de negocio**. Los dos conviven.

Y hay un hallazgo que es justo lo que pedís: **los pings de verificación YA traen datos reales del servicio y los tiran a la basura** en un mensajito verde. Fathom ya pide la última reunión y la descarta. Ahí está tu preview.

Lanzo el copy de marketing en paralelo mientras extraigo los componentes:

### Claude

El catálogo `SLIDES` ya existe con 12 servicios y una **regla dura documentada**: *"cada slide describe algo que la app HACE HOY... si mañana se borra ese código, se borra la slide"*. Respeto esa regla. Lanzo el copy de las tabs y el diseño de los previews:

### Claude

Mientras el copy se escribe, extraigo los componentes compartidos. Armo las tareas de esta tanda:

### Claude

Ahora extraigo el panel. Leo las piezas exactas a mover:

### Claude

Necesito ver los iconos de servicio antes de mover nada — y medir el riesgo de conflicto con el otro chat, que está trabajando justo en este archivo:

### Claude

El otro chat no está en Integraciones ahora mismo (su último toque fue `338a54d`). Extraigo con cuidado. Leo los iconos:

### Claude

El `BrandDefs` es un bloque enorme de SVG oficiales. Lo muevo mecánicamente con un script para no transcribir mal ni un path:

### Claude

Extraído limpio (39 slides, los logos oficiales intactos). Ahora el panel de marketing compartido — el aside negro que hace carrusel → preview:

### Claude

Ahora IntegracionesBoard tiene que importar lo movido en vez de duplicarlo:

### Claude

Los 2 errores de `IntegracionesBoard` son **preexistentes** (misma línea, corrida 192→112). Limpio los imports que quedaron sin usar:

### Claude

Extracción limpia: typecheck verde, cero warnings nuevos. Veo si el copy ya llegó:

### Claude

El copy sigue corriendo (archivo en 0 bytes). Sigo construyendo. Veo la firma de `ServicioConfigForm` para reusarlo tal cual en el panel de las tabs:

### Claude

`ServicioConfigForm` es reusable tal cual (`servicioKey` + `onEstado`). Armo el catálogo de activación por tab y el panel:

### Claude

Sigo. Ahora el preview en vivo — que los pings devuelvan los datos que ya traen en vez de tirarlos:

### Claude

Confirmado: cada ping ya tiene los datos en la mano y los tira. Los devuelvo estructurados — cambio **aditivo**, nada existente se rompe:

### Claude

Facts cableados en 6 servicios. Veo si el copy ya cerró:

### Claude

Copy sigue corriendo. Falta que el form emita los facts hacia arriba cuando el cliente aprieta el tilde — si no, el panel negro nunca se entera. Veo cómo maneja hoy la respuesta:

### Claude

Hay dos puntos donde llega el ping (probar suelto y guardar-y-probar). Los engancho con un callback:

### Claude

El otro chat está editando `workspace.ts` **en este mismo momento** — está agregando `esDuenoAdmin()`, que es justo el hallazgo #167 que reporté. El error de tsc es una carrera entre su escritura y mi lectura. Re-chequeo:

### Claude

Excelente contexto: el otro chat **ya arregló la tarea #162** (el secuestro de webhooks, `ef29469`) y ahora está cerrando el #167 (`esDuenoAdmin`). El board está funcionando. tsc verde de nuevo. Commiteo lo mío antes de que crezca el churn:

### Claude

Sigo mientras espero. Cableo las tabs — cada una chequea su integración y muestra el panel en vez de vacío. Veo el patrón en Closing:

### Claude

El copy sigue corriendo y no voy a bloquearme: escribo yo las slides — tengo el inventario verificado de toda la sesión. Cuando llegue el workflow, lo uso para contrastar.

Primero, el catálogo necesita un caso más: **Comercial no se prende con una credencial**, se prende cargando un cobro. Ajusto el tipo:

### Claude

Ahora el catálogo con las slides. Cada una anota el código que la respalda, y ninguna promete lo que está apagado:

### Claude

El panel tiene que soportar el caso sin credencial (Comercial). Lo ajusto:

### Claude

Ahora cableo las tabs. Cada page chequea su integración antes de renderizar:

### Claude

Ahora las otras cinco, de una pasada:

### Claude

Falta Comercial, que es el caso distinto: no se prende con una credencial sino con datos cargados.

### Claude

Para Comercial el gate es de datos, no de credencial. Uso un conteo barato:

### Claude

El copy llegó y es **mucho mejor que el mío** — el agente leyó el código y encontró cosas que yo no (el deshacer de 5 segundos al cobrar, el `guion_voz` del advisor, el `reviseWithMako` del Closing). Lo extraigo con su verificación:

### Claude

El verificador encontró **otro bug del mismo patrón que el de las keys de IA, y es grave**: la signing key de Calendly que el cliente pega **se guarda, se pinta verde y nunca se lee** (el webhook la toma solo del env) → 401 para siempre. Y sin los event types, el webhook **descarta el evento con 200 OK en silencio**.

Aplico el copy verificado con las correcciones honestas:

### Claude

El heredoc rompió por las comillas. Lo escribo directo:

### Claude

Las 6 tabs cableadas con 23 slides verificadas. Lo pruebo en vivo antes de commitear:

### Claude

El onboarding pendiente de ws3 lo rebota al wizard (correcto, pero tapa la prueba). Lo salteo para aislar el panel de las tabs:

### Claude

**Funciona exactamente como lo pediste.** En `/closing` sin Fathom:
- Grid de 2 columnas (336px + 602px), aside en **negro** (`rgb(20,22,27)`)
- Izquierda: `✦ CON FATHOM CONECTADO` + el carrusel rotando
- Derecha: "Falta un paso · Closing Analyst se prende con esto" + el form de la key

Commiteo la tanda:

### Claude

Restauro el estado de prueba de ws3 (le salteé el onboarding para poder probar) y subo el bug de Calendly al `/plan`:

### Claude

Ahora subo el bug de Calendly al board y cierro:

### Claude

Todo pusheado. Cierro con el balance de la tanda.

## Lo que quedó construido

**El panel negro compartido** — una sola pantalla que el cliente aprende una vez y reconoce en cuatro lugares. La regla que le da el efecto: **sin conexión muestra el carrusel de marketing; con conexión muestra los datos reales de su cuenta.** La promesa se reemplaza por la prueba en el momento en que aprieta el tilde.

**El preview salió de donde ya estaba.** Los pings de verificación *ya* llamaban al servicio y tiraban la respuesta en un string de una línea: Fathom pedía tu última reunión y la descartaba; Chatwoot traía los inboxes y solo contaba cuántos. Ahora devuelven `facts` — y elegí los que hacen que **reconozcas tu cuenta**: *"Tu última llamada grabada: Discovery con Juan · hace 2 días"*. Un `ok ✓` no prueba nada; eso prueba todo. Van 6 servicios.

**Seis tabs dejaron de mentir.** Comercial renderizaba seis secciones en `$0` con un gráfico plano (se leía como **roto**), y WhatsApp decía *"Sin conversaciones"* cuando Chatwoot nunca se había conectado — un error de config disfrazado de dato vacío. Ahora las dos muestran la pantalla partida pidiendo lo suyo. Verificado en vivo: aside en negro, carrusel rotando, form a la derecha.

**23 slides de marketing**, cada una con el archivo que la respalda.

## Dos cosas que tenés que leer

🔴 **La revisión del copy encontró un bug que rompe el producto en silencio (tarea #174).** Es el mismo patrón que la key de IA: **la signing key de Calendly que el cliente pega se guarda, se pinta verde y nunca se lee** — el webhook usa solo la de plataforma. Y los event types de R1/R2 figuran como *opcionales* pero sin ellos el webhook **descarta el evento con 200 OK**. O sea: el cliente sigue tu tutorial al pie de la letra, ve "Calendly conectado", y tiene cero agendas y **ningún error**. Sin agendas no hay cohortes, ni funnel, ni SCL, ni revenue.

🟡 **El copy que había escrito yo prometía cosas falsas.** El verificador volteó seis: los rebotes de email no se cuentan en ningún lado, y el "segundo donde arranca cada bloque" del Script Analyst **lo estima Claude por ritmo de lectura** (el transcript no trae timestamps). Las reescribí honestas. Menciono esto porque es la prueba de que la regla dura del repo funciona — pero solo si alguien la audita.

## Lo que NO hice, y por qué

**El onboarding general de la capa `completo` sigue con su wizard de 4 pasos.** Lo dejé a propósito: es el que usa Mauricio hoy y funciona, y el paso de integraciones (lista de credenciales + panel de extracción en vivo) **no entra en el molde de una-pregunta-por-vez** — forzarlo rompería lo mejor que tiene. Ahora que el panel partido existe y está probado, migrarlo es mecánico: es la tarea que dejaría para tu vuelta, con vos mirando.

Mientras tanto el otro chat cerró **#162 (secuestro de webhooks), #163 (el roadmap en el bundle), #167 y #168** — o sea que de mi auditoría del 16/7 ya quedan pocas abiertas.


---

## Martín

`2026-07-17 14:14`

1. Veo que no tocaste el onboarding de PROJECT MANAGER. Eso también es importante que esté.
2. Indicame como pruebo este onboarding con el cliente de prueba.
3. El onboarding general ese como está, justamente ya no debería existir. Esto lo reemplazará. Y de última esas preguntas pueden ir a este nuevo onboarding. Hazlo.

### Claude

Tres cosas claras. Tenés razón en la 1: construí el PM pero con panel claro, no con el negro — quedó fuera del lenguaje nuevo. Y la 3 es la decisión correcta: **un solo onboarding para todos, y el viejo se muere.**

Primero ajusto el `WizardShell` para que en fullscreen sea la misma tarjeta partida del panel (hoy son dos cajas sueltas):

### Claude

Ahora el onboarding unificado. **Uno solo para todas las capas**, con el panel negro en todas las pantallas y las preguntas del viejo migradas. Escribo el reemplazo:

### Claude

Ahora borro los dos componentes que este reemplaza (`OnboardingPM` y el `OnboardingForm` de 15 campos) y verifico:

### Claude

`OnboardingForm` lo usa `/configuraciones` como editor del perfil — **ese se queda** (es otro uso legítimo). `OnboardingPM` sí queda huérfano: lo borro. Y arreglo el prop faltante:

### Claude

Todo verde. Lo pruebo con las dos capas — primero un Project Manager:

### Claude

**El PM ya tiene el panel negro.** 4 pantallas (3 preguntas + cierre), aside `rgb(20,22,27)` con el carrusel de MaKo rotando. Ahora la capa completa, que es la que se rehizo entera:

### Claude

El panel izquierdo hace exactamente lo diseñado: **el carrusel se va y aparecen sus respuestas**. Pero la tercera pregunta no avanzó. Investigo:

### Claude

Sí había avanzado — era timing de mi lectura. Está en el cierre del Guardián con "Crear mi primer proyecto →". Lo cierro:

### Claude

**Flujo PM completo end-to-end**: las 3 respuestas guardadas, `status: done`, y aterrizó en `/plan`. Ahora la capa completa, que es la que rehice entera:

### Claude

El `completo` arranca con **"Conectá Meta Ads"** — un servicio por pantalla, con su carrusel a la izquierda. El wizard viejo murió.

Pero detecté un problema de diseño: `completo` pide **18 preguntas de brief** (el esquema entero: oferta + avatar + marca). Una-por-pantalla × 18 = tortura, lo contrario de lo que pediste. Lo corto al brief esencial:

### Claude

De 24 pantallas a **9**. Limpio las pruebas y commiteo:

### Claude

El script en `/tmp` no resuelve `postgres`. Lo pongo en el repo (donde están los `node_modules`) y lo borro después:

### Claude

Los borro desde el browser, que ya tiene sesión:

### Claude

`ws7` ya se borró; queda `ws8` ("Prueba Unificado Full"). El panel de admin no tiene borrado de workspaces, así que **lo dejo** — de hecho te sirve: es un cliente `completo` limpio para probar. `ws5 "Prueba"` es tuyo, no lo toqué.

Commiteo la unificación:

### Claude

Listo, los tres puntos. Todo en main (`9788027`).

## 1. El PM ya tiene el panel negro

Tenías razón: lo había construido con un panel claro, fuera del lenguaje nuevo. Ahora **los dos flujos son el mismo componente** — el PM arranca directo en el brief con el aside negro y el carrusel de MaKo, y a medida que contesta **el carrusel se va y aparecen sus respuestas** a la izquierda. Verificado end-to-end: 3 respuestas guardadas, `status: done`, aterriza en `/plan`.

## 2. Cómo lo probás

Ya tenés dos clientes de prueba listos:

| Workspace | Capa | Estado |
|---|---|---|
| **Cliente de Prueba** (ws3) | Completo | onboarding **pendiente** (lo restauré) |
| **Prueba Unificado Full** (ws8) | Completo | pendiente — lo dejé de mi prueba |

**Los pasos:**
1. Entrá a **`/admin`**.
2. Botón **"Entrar como →"** en el cliente que quieras.
3. Andá a **`/onboarding`** (o a cualquier tab: el gate te manda solo).
4. Para probar un **Project Manager**, creá uno nuevo en `/admin`: nombre + elegí **"Project Manager"** en el selector Tipo → Entrar como → `/onboarding`.
5. Para volver a probar desde cero el mismo cliente, en `/admin` usá **Acciones → Pasar a Project Manager / Completo** (cambiar de capa cambia las pantallas), o creá uno nuevo.
6. Para salir: el banner de arriba, **"Salir de la vista"**.

**Para probar las tabs** (el panel partido pidiendo la conexión): entrá como ws3 → tocá "Completar después" en el onboarding → abrí `/closing`, `/whatsapp`, `/email` o `/comercial`. Vas a ver el mismo panel negro pidiendo su credencial.

⚠️ El panel de admin **no tiene botón de borrar workspaces**, solo pausar. Si te llenás de pruebas, se limpian por SQL.

## 3. El onboarding general murió y lo reemplazó este

Ahora hay **uno solo** para todas las capas. Las pantallas salen de la capa:

- **PM** → 4 pantallas (3 preguntas + el Guardián)
- **Completo** → 9: **Meta**, **WhatsApp** (una por pantalla, así el preview aparece al conectar cada una), funnel, metas, contacto, 3 del brief, Retro

El paso de integraciones dejó de ser una lista de cards: es **un servicio por pantalla**, reusando el `ServicioConfigForm` de `/integraciones` tal cual — con su semáforo por key y su probar-antes-de-guardar.

**Una decisión que tomé y quiero que sepas:** el brief de `completo` lo corté al grupo base (3 preguntas). El esquema entero son **18 campos** (oferta + avatar + personaje de marca) y a una pregunta por pantalla eso daba **24 pantallas** para entrar al producto — justo lo que estábamos matando. El perfil largo se completa después, sin bloquear, en **Configuraciones → Onboarding**, que ya tiene ese formulario bien resuelto y hasta lo extrae de un documento con IA. Si preferís que el `completo` pregunte más en el arranque, es una línea en `lib/capas.ts` (`briefGrupos`).

**Lo que quedó pendiente y no toqué:** el `PanelActivacion` de las tabs y el onboarding comparten el aside pero el de las tabs no muestra el progreso de la extracción — para el `completo`, cuando Meta conecta, la extracción arranca pero el panel izquierdo muestra los facts, no el avance job por job. Es la única pieza del diseño viejo que no migré.


---

## Martín

`2026-07-17 15:25`

1. Solo quiero 2 clientes de prueba. Uno del servicio completo y otro de project manager.
2. En los clientes de prueba, debería poder ADELANTAR el onboarding sin completar las Key por ejemplo. Y mejor si puedes utilizar las Key de Mauricio para simular el onboarding de ese.
3. Durante el onboarding con vista desde SuperAdmin, no me aparece el cartel para salir de la vista.

Haz estos cambios rápido así comienzo a darte feedback de todo el onboarding.
Cuando termines los anteriores 3, continua directo por el panel de activación con el onboarding de cada tab. Mientras tanto yo iré redactando el feedback, pero primero lo anterior.

### Claude

Entendido. Voy rápido con los 3 y sigo con el panel de activación. Primero limpio a 2 clientes de prueba y veo qué hay:

### Claude

Contexto claro: hay 3 no-dueño (ws3 completo, ws5 pm "Prueba real - Ananda" que es tuyo, ws8 completo que es mío). Para quedar en 2, borro el mío (ws8). Primero armo los cambios del wizard —que es lo que te desbloquea— y de paso veo la API:

### Claude

Ahora el diseño de las 3. La clave del punto 2 es de dónde salen las creds de Mauricio. Leo `credWs`:

### Claude

`credWs(env, OWNER_WS)` lee las creds de Mauricio (base o env). Con eso puedo copiarlas al workspace de prueba. Implemento los 3 cambios en la API:

### Claude

Ahora la acción `simular` — copia las llaves de Mauricio al workspace de prueba. La inserto antes del `default` del switch:

### Claude

La API está. Ahora el `WizardShell` necesita una barra de admin arriba (para "Salir de la vista"). Reestructuro el fullscreen:

### Claude

Ahora conecto los tres atajos en el wizard. Leo el WizardData type y el render para insertar:

### Claude

Ahora el `puedeAvanzar` (admin puede saltar), la barra de admin, y el botón "usar llaves de Mauricio". Modifico el bloque de render:

### Claude

Ahora la barra de admin en el `WizardShell` y el botón de simular en la pantalla de servicio:

### Claude

Falta destructurar `adminBar` en la firma:

### Claude

Verde. Lo pruebo en vivo — entro como el cliente completo de prueba y verifico los 3:

### Claude

`esAdmin: true` confirmado. Ahora lo veo en pantalla y pruebo el botón de simular:

### Claude

Los tres atajos están: **"✦ Usar las llaves de Mauricio"** + **"Salir de la vista"** (el de mi barra) + **"Siguiente →"** ya avanzable sin conectar. Pruebo simular:

### Claude

El error es de entorno: `falta CREDENCIALES_SECRET`. El guardado de credenciales cifra, y este dev server (el del otro chat) no tiene el secreto — así que **ni simular ni cargar una key a mano funcionan localmente**, solo en prod. Confirmo:

### Claude

`.env.local` no tiene `CREDENCIALES_SECRET` (el otro chat migró al cifrado v2 que lo exige). Veo si hay fallback:

### Claude

Es un gap de entorno (el `.env.local` local no tiene `CREDENCIALES_SECRET`): **ni simular ni cargar una key a mano funcionan en este dev server, solo en Vercel/prod** donde el secreto está. Mi código de simular es correcto — necesita el secreto para cifrar. Verifico que el **salto** (avanzar sin conectar) sí funcione, que es lo que te desbloquea igual:

### Claude

El salto funciona (Meta → WhatsApp), y la barra de admin queda fija arriba. Commiteo los 3 y borro el workspace de más:

### Claude

Ahora borro el workspace de más (ws8, mío). Uso un script con el patrón correcto:

### Claude

Listo el punto 1: quedan exactamente **2 clientes de prueba** — "Cliente de Prueba" (completo) y "Prueba real - Ananda" (pm) — más el dueño. Los tres puntos cerrados.

Ahora sigo con el panel de activación. Faltan las tabs de Meta (Marketing y Ads Manager) para completar la cobertura. Veo cómo fallan hoy sin Meta:

### Claude

`/ads-manager` está sin guard de página y es territorio activo del otro chat (está en meta-write) — no lo toco para no chocar. Agrego **Marketing** y **Experimentos** (las otras dos que dependen de Meta). Primero el catálogo:

### Claude

Ahora cableo las dos pages. Veo el guard de experimentos y el punto de retorno de marketing:

### Claude

Los 3 warnings son preexistentes (variables de marketing sin relación con mis 2 líneas). Smoke test rápido de las dos nuevas y commiteo:

### Claude

Ambas sirven el panel. Restauro ws3 a pending limpio y commiteo:

### Claude

Actualizo la memoria con lo nuevo y cierro:

### Claude

Todo hecho y en main. Balance:

## Los 3 que pediste

**1. Solo 2 clientes de prueba** ✓ — quedaron **Cliente de Prueba** (completo) y **Prueba real - Ananda** (pm). Borré el mío de más.

**2. Adelantar sin completar keys + usar las llaves de Mauricio** ✓ — cuando entrás como super-admin al onboarding de un cliente de prueba, ahora hay una barra **"Modo agencia"** arriba con:
- **Saltar sin conectar** — el botón "Siguiente" ya avanza las pantallas de integración sin cargar nada (un cliente real sigue bloqueado).
- **"✦ Usar las llaves de Mauricio"** — copia sus credenciales al workspace de prueba y arranca la extracción, para ver el WOW real (facts + histórico) sin pegar una key.

**3. El cartel para salir de la vista** ✓ — el overlay del onboarding tapaba el banner de impersonación; ahora la barra de arriba tiene **"Salir de la vista"** que te saca sin terminar el wizard.

⚠️ **Un aviso importante sobre el punto 2:** "Usar las llaves de Mauricio" y cargar cualquier key **exigen `CREDENCIALES_SECRET`** (el cifrado v2 que metió el otro chat), y **el `.env.local` local no lo tiene**. O sea: en este dev server no se puede conectar nada (ni a mano ni simulando) — se prueba **en Vercel/prod**, donde el secreto está. Localmente sí podés recorrer todo el flujo con "Saltar" y darme feedback de layout, copy y navegación. Si querés que funcione local, agregá `CREDENCIALES_SECRET` a `.env.local` con **el mismo valor que tenés en Vercel** (si ponés otro, las creds ya guardadas dejan de descifrarse).

## Y seguí con el panel de activación

Completé la cobertura: sumé **Marketing** y **Experiments** (las dos que dependen de Meta). Ahora **8 tabs** muestran el panel partido pidiendo su conexión en vez de vacío o roto: closing, whatsapp, email, script, crm, comercial, marketing, experiments. Verificado en vivo que las dos nuevas sirven el panel.

**Ads Manager quedó afuera a propósito:** no tiene guard de página y el otro chat está trabajando justo en `meta-write` y sus rutas ahora mismo — no lo pisé para evitar conflictos.

Quedo esperando tu feedback del onboarding — dale que voy tomando nota y ajustando.


---

## Martín

`2026-07-17 17:01`

@"C:\Users\marti\Downloads\Análisis de Negocio - Andrea Estratega.pdf"
Te paso un "Análisis de Negocio" que lo vi del programa de Andra Estratega.
Esto realmente va a impactar en todo lo que estamos haciendo.

Quiero que lo implementes para nuestro caso. No quiero que me hagas preguntas, quiero que lo implementes en el onboarding como te parezca y luego yo doy feedback...
Ten en cuenta:

1. Andrea es experta en ORGÁNICO POR INSTAGRAM. MaKo es una app de VSL Funnel.
2. Obvio que hay cosas que no son necesarias agregar, como el EXAMEN. Pero yo te adjunté todo para que tengas el contexto global.
3. Por ahora quiero que lo implementes en el onboarding. Luego vemos el tema de llevarlo a la Retro y al Perro Guardian.

### Claude

Leo el PDF para entender el marco. Empiezo por las primeras páginas para ver la estructura.

### Claude

El render de PDF no está disponible. Extraigo el texto con Python:

### Claude

El PDF es casi todo **capturas de pantalla** (sin capa de texto). Extraigo las imágenes embebidas para leerlas visualmente. La estructura ya se ve: tab `/guia` con secciones "Tu Fase / Las 5 Fases / 5 Dimensiones / Cómo llenar TAB 2", más `/flashcards` y `/examen`.

### Claude

40 imágenes extraídas. Las leo por bloques temáticos. Empiezo por la sección clave — "Tu Fase" y "Las 5 Fases" (páginas 2-8):

### Claude

Ya entiendo el marco: es un **quiz de diagnóstico** ("¿En qué fase está tu negocio?", 6 preguntas) que determina la **FASE** + el **cuello de botella** y presetea el "Norte". Leo las preguntas restantes (3-6) y las secciones "5 Fases" y "5 Dimensiones":

### Claude

Tengo las 6 preguntas. Ahora las definiciones: "Las 5 Fases" y las "5 Dimensiones":

### Claude

Tengo las 5 Fases (0-4) con su cuello, objetivo, síntomas, acciones y meta. Leo las "5 Dimensiones" y "Cómo llenar TAB 2" para cerrar la lógica del diagnóstico:

### Claude

Ya tengo el marco completo. El diagnóstico (p05) es claro: **Fase + Cuello de botella + "Consistencia %" + Diagnóstico MIXTO + Qué priorizar**. Y las 5 dimensiones. Leo la última pieza — "Cómo llenar TAB 2" — y arranco el diseño:

### Claude

Ya tengo el marco completo. Es un sistema de **diagnóstico de fase**: 6 preguntas → **Fase (0-4) + Cuello de botella + Consistencia %** → presetea el "Norte" (objetivo + qué priorizar). Descifré la lógica exacta del screenshot: la fase es la **mediana de los votos** (ej. `[0,1,1,2,2,2]` → Fase 1) y la consistencia = votos de esa fase / 6 (33%).

Lo adapto de **orgánico-IG → VSL Funnel** (seguidores → leads/mes; captación → funnel VSL) y lo implemento. Empiezo por el corazón — el framework como datos:

### Claude

Verifico que la lógica del diagnóstico reproduce el ejemplo del screenshot (`[0,1,1,2,2,2]` → Fase 1, 33%):

### Claude

La lógica reproduce el screenshot exacto. Ahora lo cableo. Primero el store (persistencia) y la capa:

### Claude

Ahora agrego el paso `fase` a la capa y al estado:

### Claude

Ahora la API: GET devuelve las preguntas + el diagnóstico, y una acción `fase` que guarda:

### Claude

Typo — corrijo:

### Claude

Ahora la acción `fase` en el POST y el tipo:

### Claude

La lógica y la API andan. Ahora el wizard. Leo su estructura actual para insertar el paso `fase` limpio:

### Claude

Ahora cableo el paso `fase` en el wizard. Imports, tipos y estado:

### Claude

Ahora en `cargar()` inicializo el estado de fase, y agrego el branch `fase` al builder de pantallas:

### Claude

Ahora `puedeAvanzar`, el escenario custom para fase, y el manejo de avance. Primero `puedeAvanzar`:

### Claude

Ahora el render: el escenario custom para fase y el body con el quiz y el resultado. Veo el bloque del `WizardShell`:

### Claude

Cablé el diagnóstico. Ahora conecto el render — escenario custom, avance y body:

### Claude

Ahora el body — el quiz y el resultado. Los inserto junto a las otras pantallas:

### Claude

Ahora los tres componentes de fase, junto al `CierreGuardian`:

### Claude

El tipo `Paso` local del wizard no incluye `'fase'`. Lo agrego:

### Claude

Todo verde. Ahora conecto el diagnóstico al contexto de MaKo (que sepa la fase). Veo dónde se inyecta el perfil:

### Claude

Hay una colisión de nombre (`fase` ya se usa para otra cosa). Inyecto el diagnóstico de negocio como bloque aparte, junto al perfil:

### Claude

Todo verde. Lo pruebo en vivo — recorro el diagnóstico entrando como el cliente PM:

### Claude

Los pasos de PM ahora incluyen `fase` y las 6 preguntas llegan. Pruebo la acción de diagnóstico end-to-end:

### Claude

El diagnóstico se computa (Fase 1 · Conversión · 67%) y **persiste**. Ahora lo veo en pantalla — reseteo el diagnóstico de ws5 y recorro el quiz visualmente:

### Claude

El brief no avanzó en mi loop (timing). Voy directo: marco `negocio` hecho por API y recargo para caer en el quiz de fase, y saco screenshot:

### Claude

Cayó en el brief (el wizard unificado no retoma en el paso pendiente — lo anoto para arreglar). Avanzo a mano los 3 del brief para llegar al quiz:

### Claude

Estoy en la 3ª del brief. Una más y llego al quiz:

### Claude

El quiz renderiza con la escalera de fases a la izquierda. Recorro hasta el resultado seleccionando opciones y saco screenshot del diagnóstico:

### Claude

Llegó a "Tu diagnóstico de fase". Veo la pantalla del resultado:

### Claude

**Funciona end-to-end y clava el diseño de Andrea:**
- **Izquierda (aside negro):** `✦ TU DIAGNÓSTICO` · 🌱 · **FASE 1 · Crecimiento** · rango · **Cuello: Conversión** · Consistencia 50%
- **Derecha:** el aviso **DIAGNÓSTICO MIXTO (F0:1 · F1:3 · F2:2)** + **TU NORTE: ENFOCÁ TODO EN CONVERSIÓN** + las acciones (CLAVE marcadas) + el "no hacer ahora"

Antes de commitear, arreglo el detalle que noté: **el wizard unificado no retoma en el paso pendiente** (un cliente que reabre reempieza del brief). Lo restauro con un efecto que salta al primer paso incompleto:

### Claude

Agrego el "retomar en el primer paso incompleto":

### Claude

Verde. Restauro los 2 clientes de prueba a un estado limpio (los toqué al probar) y commiteo:

### Claude

Guardo la memoria y cierro:

### Claude

Listo, todo en main (`e4c2e1e`) y verificado en vivo. Implementé el marco de Andrea en el onboarding.

## Lo que hice

**Descifré el marco del PDF** (que eran capturas, sin texto — lo extraje con OCR de imágenes): es un **diagnóstico de fase**. Seis preguntas sobre la situación real → una **FASE (0-4) + el CUELLO DE BOTELLA + qué priorizar**. Y reconstruí la lógica exacta del original:
- La fase = **la mediana de los 6 votos, con sesgo hacia abajo** ("trabajá primero el cuello de tu fase más baja").
- La consistencia = votos de esa fase / 6.
- Lo verifiqué contra el ejemplo del propio PDF: `[0,1,1,2,2,2]` → **Fase 1, 33%, mixto**. Clava.

**Lo adapté de orgánico-IG → VSL Funnel**, como pediste:
- "seguidores" → **leads/mes**
- "sistema de captación" → el **funnel** (VSL / landing / nutrición)
- Los cuellos en lenguaje de embudo: Visibilidad → Conversión → Sistemas → Delegación → Foco
- Descarté lo específico de IG orgánico (la mezcla de contenido Viral/Autoridad/Ventas) y el examen, como dijiste.

**Dónde vive:** un paso `fase` nuevo en el onboarding de **las dos capas** (va después del brief de negocio). Respeta el patrón que ya te gusta: **una pregunta por pantalla**, con la escalera de las 5 fases en el aside negro. Al terminar, la pantalla de diagnóstico calca la del original: la fase diagnosticada a la izquierda, y a la derecha **"Tu Norte: enfocá todo en [cuello]"** + las acciones (las CLAVE marcadas) + el "no hacer ahora" + el aviso de diagnóstico mixto.

**Y ya alimenta a MaKo:** el diagnóstico se persiste y entra en el contexto de MaKo, así que **prioriza y aconseja según la etapa real** — no le propone escalar a quien todavía no convierte.

**De regalo:** el wizard ahora **retoma en el primer paso incompleto** (un cliente que reabre no reempieza del brief) — lo noté probando y lo arreglé.

Verificado end-to-end en vivo: las 6 preguntas, el diagnóstico (me salió *Fase 1 · Conversión · mixto F0:1·F1:3·F2:2*) y la persistencia. Los dos clientes de prueba quedaron reseteados a pending limpio para que puedas recorrer todo.

## Lo que quedó para después (como pediste)

La **Retro** y el **Perro Guardián** todavía no leen la fase — dijiste "por ahora solo el onboarding, luego vemos". Cuando quieras, el gancho ya está: `faseNegocioTexto()` da el Norte listo para inyectar, y el Perro puede usar la fase para que su priorización empuje el cuello de botella de la etapa (que es, textual, la idea del PDF: "esto es lo que le da el norte a TODO el sistema").

Una decisión que tomé sin preguntarte (avísame si no): puse el diagnóstico **también para la capa Project Manager**, no solo VSL. Las fases son de madurez de negocio y aplican igual, aunque un par de preguntas (funnel, leads) están en lenguaje de embudo. Si para PM preferís una versión más neutra, lo veo en tu feedback.


---

## Martín

`2026-07-21 22:35`

Cuando intenté hacer el onboarding del lead de prueba, pude darle para "atrás" en la primera pregunta y me sacó del onboarding, me derivó al dashboard general, eso NO debería pasar bajo ningún motivo. Un usuario que no completó su onboarding no debería poder entrar al dashboard

### Claude

El bug está claro y tenés toda la razón. Miro exactamente qué pasó:

### Claude

Confirmado — son **dos bugs encadenados**, y tenés toda la razón:

1. **La trampa visual:** en `WizardShell`, cuando se oculta "Atrás" (primera pregunta), el "Completar después" se renderiza **en el lugar exacto donde va el botón Atrás** (abajo a la izquierda). Le diste a lo que parecía "atrás" y era en realidad "saltar el onboarding".
2. **El agujero de fondo:** `onboardingPendiente()` solo bloquea `pending`/`in_progress`, así que `skipped` **deja entrar al dashboard**.

El fix correcto: **solo un onboarding COMPLETO (`done`) da acceso**, y saco el "Completar después" — el onboarding es obligatorio.

### Claude

Ahora saco el "Completar después" del wizard (era la trampa en la posición del botón Atrás):

### Claude

Verde y `home` sigue usándose (solo al completar). Ahora lo verifico en vivo — levanto mi propio server y confirmo los dos casos: el wizard sin salida, y que `skipped` rebota al onboarding.

### Claude

Mi server corre en el 3000. Me logueo y pruebo los dos casos:

### Claude

La página está en `/onboarding` con status `skipped` — ya es buena señal. Verifico los redirects con `redirect: manual` (uno por uno para no navegar la página):

### Claude

**El fix funciona:** con status `skipped` (el agujero viejo), `/plan`, `/general` y `/leads` **todos rebotan** — ya no dejan entrar al dashboard. Ahora confirmo que el "Completar después" desapareció del wizard:

### Claude

Está en el paso de fase (retomó). Reseteo ws5 a pending limpio, recargo y confirmo el footer de la primera pantalla:

### Claude

Confirmado — la primera pantalla ahora tiene **solo "Siguiente →"**: sin "Completar después", sin "Atrás". Un cliente real no tiene ninguna salida al dashboard. (Los dos "Salir de la vista" son del banner de impersonación + mi barra de agencia — solo los ve el super-admin, y van a `/admin`, no al dashboard.)

Los dos bugs cerrados y verificados en vivo. Commiteo:

### Claude

Arreglado y en main (`d6af690`). Tenías toda la razón — y resultó ser un agujero real, no solo el botón.

## Qué pasó (dos bugs encadenados)

1. **La trampa visual:** en la primera pregunta se oculta el botón "Atrás", y ahí el `WizardShell` metía el **"Completar después" en el mismo lugar donde va el botón Atrás** (abajo a la izquierda). Le diste a lo que parecía "atrás" y era en realidad el escape que salteaba el onboarding.

2. **El agujero de fondo (el grave):** el guard solo bloqueaba `pending`/`in_progress`, así que un onboarding en estado `skipped` **dejaba entrar al dashboard**. O sea que cualquiera que saltara quedaba adentro.

## El fix

- **`onboardingPendiente()` ahora exige `status === 'done'`.** Solo un onboarding **completo** libera el dashboard; `pending`, `in_progress` y `skipped` **rebotan al wizard**. Esto es lo que pediste, textual: un usuario que no completó su onboarding no entra al dashboard bajo ningún motivo.
- **Saqué el "Completar después".** El onboarding es obligatorio, sin escape para el cliente. (El super-admin conserva "Salir de la vista", que va a `/admin` — no al dashboard — para no quedar atrapado probando.)

## Verificado en vivo

- Con status `skipped` (el agujero viejo): **`/plan`, `/general` y `/leads` rebotan** al onboarding. ✓
- La primera pantalla del wizard queda **solo con "Siguiente →"** — sin "Completar después", sin "Atrás". ✓

Dejé el cliente PM de prueba (**Prueba real - Ananda**) en pending limpio para que puedas recorrerlo de nuevo desde cero. Mi server quedó corriendo en `localhost:3000` por si querés probar ahí mismo.

Un detalle consciente: ahora la capa **completo** exige conectar Meta + WhatsApp para salir del paso 1 (es parte de "obligatorio"). Si en algún cliente querés que WhatsApp sea diferible y no bloquee, es sacar `'whatsapp'` de `integracionesRequeridas` en la capa — decime y lo hago. Sigo con tu feedback.

