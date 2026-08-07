# Hallazgos de Landing / VSL

Lo que hay que saber antes de tocar `lib/landing-analyst.ts` y las lecturas de
`landing_visits` / `vsl_events`. **No es un changelog.**

Origen: corrida multi-agente de 08/2026. Regla de la cosecha en `AGENTS.md`.

---

## 1. El módulo tolera la falta de datos, así que traga cualquier error nuevo

**Síntoma:** el análisis de una landing con tráfico real decía **"sin datos de
comportamiento"**. No hay error en el log: es una respuesta válida del producto.

**Causa:** `getComportamiento` hace `catch { return vacio; }` **a propósito** —una landing
recién publicada no tiene historial y igual se puede analizar el copy—. Cuando el bucle
paginado privado de este módulo (que no tenía techo) se unificó en
`lib/supabase-paginado.ts`, heredó un tope que **sí** lanza. `landing_visits` es una fila
por visita: 100.000 es alcanzable en una landing viva. El `throw` cayó en ese `catch` y el
truncado silencioso que el paginado existe para matar reapareció **una capa más arriba**.

**El diagnóstico obvio era el equivocado:** no había nada roto en el analista ni en el
tracking. Lo que cambió fue el contrato de errores de una función tres niveles abajo.

**Dónde:** `lib/landing-analyst.ts:128` (`leerTabla`) y el `catch` de `getComportamiento`.
El tope vive en `lib/supabase-paginado.ts` — ver [hallazgos-infra.md](hallazgos-infra.md)
§1, "Un tope nuevo es un truncado nuevo".

**Regla:** antes de meter un `throw` nuevo en una lectura, mirá **qué `catch` lo está
esperando**. En un módulo que degrada por diseño, cada excepción nueva se convierte en un
"no hay nada" que nadie va a poder distinguir de la verdad.

## 2. Estas cuatro lecturas ya ordenaban bien, y por una razón

`landing_visits`, `vsl_events` y `landing_analyses` tienen `id` como PK, que es el orden
por defecto del helper y el único que garantiza páginas coherentes. Fueron las únicas del
barrido que no tenían el bug de `ORDER BY`. Si se agrega una tabla de tracking sin `id`
autoincremental, **hace falta elegirle un orden único explícito**.

---

## 3. Descartado a propósito (no volver a "arreglarlo")

- **Cambiar el `catch { return vacio; }` de `getComportamiento` por propagar el error.** La
  tolerancia es intencional y está escrita en el JSDoc: el analista tiene que poder correr
  sobre una landing sin historial. Con el tope del helper ya corregido, el falso vacío deja
  de ser alcanzable en la práctica. Cambiar la semántica de error de este módulo es otra
  pasada, con la decisión de producto de por medio ("¿qué ve el usuario si el tracking
  falla y el copy sí se puede analizar?").

---

## Cosecha retroactiva (2026-08-07)

Rescatado de los journals de las 261 corridas multi-agente de junio a agosto de 2026:
**134 de 260 nunca habían escrito nada en el repo**. El registro completo de las corridas
está en [corridas-multiagente.md](corridas-multiagente.md).

⚠️ **Es material de segunda mano.** Sale de lo que devolvieron los subagentes en su
momento, no de una relectura del código de hoy. Cada entrada dice de qué corrida y de qué
fecha viene. **Antes de actuar sobre una, verificá contra el código**: varias ya están
arregladas, y donde el rescate lo sabía, lo dice.

### Trampas: el diagnóstico obvio era el equivocado

#### El semáforo de la landing pregunta «¿hubo alguna vez?», así que nunca se pone en rojo

`landingRecibioEventos` es un `select id … limit 1` SIN ventana de tiempo: con 1955 filas históricas, el ws1 queda VERDE para siempre aunque el tracking esté muerto. Y estuvo muerto 18 días sin que nadie se enterara, porque el otro extremo tampoco avisa: `/api/track/vsl` con `ws == null` hace `console.warn` y devuelve 200 `{ok:true, ignored:'sin workspace'}` — el beacon del cliente ve un 200 y sigue feliz. Encima no existe ningún cron vigilante (grep de landing_visits/vsl_events sobre app/api/cron: cero) y los dos avisos del catálogo que uno esperaría, `leads-caida` y `cron-ingesta-fallo`, no tienen un solo call-site en el repo. Regla: un chequeo de salud sin ventana temporal no es un chequeo de salud.

**Vive en:** lib/integraciones.ts:77 (landingRecibioEventos); app/api/track/vsl/route.ts:150-159; lib/avisos-catalogo.ts (leads-caida, cron-ingesta-fallo sin cablear) · *2026-08-05 · ~auditoria-mudanza-dominio*

#### El matiz honesto de cada feature vive en un campo que nadie renderiza

Las páginas de detalle de /vsl declaran los campos `nota` (estado honesto: «en activación / en construcción») y `quote` por feature, pero ningún componente de app/vsl los pinta. Verificado el 2026-08-07: 19 features llevan `nota` y el grep de `.nota`/`.quote` sobre los .tsx de /vsl no devuelve un solo render. Caso concreto: los bullets visibles del CRM prometen automatización total y desatendida, y la única aclaración («la automatización 100% desatendida se enciende por cuenta, con vos mirando el primer tramo») está en `nota` — o sea, invisible. La página se lee como 100% autónoma mientras el matiz es dato muerto. La regla: si una salvedad es parte de la promesa, va en un campo que la página renderice; un campo del tipo que no se pinta es una salvedad que no existe.

**Vive en:** app/vsl/_detalle/features.ts (campos `nota` y `quote`) · los .tsx de app/vsl/_detalle · *2026-07-24 · auditar-copy-crm*

#### Un tercero elige qué páginas baja y analiza el Landing Analyst, con solo mirar el HTML de la landing

`landing_visits.landing_url` se escribe desde `/api/track/vsl`, que es público (CORS `*`, sin sesión) y se autentica con el token `mko_…` que viaja a la vista en el snippet de la landing del cliente. El único saneo es `texto(payload.landing_url, 500)`: texto arbitrario, sin parsear como URL ni comparar contra ningún dominio del workspace. `urlsDescubiertas()` lo lee crudo, lo ordena por cantidad de visitas y lo convierte en (a) la cola del botón «Buscar mis páginas» y (b) los chips «sin analizar» que se ofrecen a un clic en cada render de la tab. Resultado: alguien sin credenciales controla el destino de un fetch server-side con la IP de egreso de la app, quema una llamada Opus con thinking por URL y deja el resultado persistido en el workspace ajeno. La baranda SSRF de `landing-fetch.ts` solo bloquea IPs privadas: un host público del atacante pasa entero. Regla: que el token sea público por diseño (docs/lovable-tracking.md) no significa que lo que escribe sea confiable — todo lo que entre por el beacon es entrada de un desconocido, y no puede decidir sola qué baja el server ni qué se paga en IA. Fix natural: parsear `landing_url` en el beacon y exigir que el host coincida con un dominio ya declarado del workspace.

**Vive en:** app/api/track/vsl/route.ts:203 · lib/landing-analyst.ts:227-238 (urlsDescubiertas), :745 y :790 · lib/landing-token.ts (landingSnippet) · *2026-08-05 review-landing-tabs*


### Reglas que quedan

#### Card o bloque: si cambia la PROMESA es card; si solo la hace creíble, es bloque

El dilema «recortamos las features de /vsl o las mantenemos» es falso: catálogo, landing y video están pegados 1:1:1 sin motivo. Una landing nueva cuesta 1-2 horas porque la infraestructura ya existe (features.ts + feature-visuals.ts + Visual.tsx), un mini-VSL cuesta 6-10 — recortar el catálogo para ahorrar video es cortar habitaciones de la casa porque el trailer sale caro. Regla permanente para que la discusión no vuelva cada mes: una capacidad merece card solo si pasa los tres filtros (el dueño pagaría por eso solo · alguien lo googlearía sin conocer la app · se cuenta con UN concepto en 90 segundos); lo que responde una OBJECIÓN va como bloque dentro de otra landing. Y la sensación de «disperso» se cura con jerarquía (secciones con encabezado de resultado), no amputando features que la app sí tiene.

**Vive en:** app/vsl/_detalle/features.ts + showcase.ts + Landing.tsx · *2026-07-26 · ~catalogo-de-features-de-la-landing*


### Lo que quedó sin hacer

#### El beacon del VSL manda datos que el INSERT descarta

El beacon recibe `video_id` en el payload y el insert a `vsl_events` no lo incluye: como `PANDA_VSL_VIDEO_IDS` es una lista (multi-VSL / A-B de VSL), hoy no hay forma de atribuir la retención por persona a una versión del video. Migración de una columna y una línea en el insert. Al revés pasa lo mismo: el evento `tipo_evento='exit'` SÍ se guarda con el porcentaje exacto de abandono y ningún query del repo lo consume — el dato que le diría al closer «abandonó al 62%, antes de la oferta» está en la base desde el día uno y nadie lo lee.

**Vive en:** app/api/track/vsl/route.ts:105 (payload), :152-186 (insert) · *2026-07-02 audit-automatizaciones-lead*

#### Un video publicado congela el nombre de la feature y el destino de su «ver más»

Al consolidar el catálogo salió una restricción que no es de código pero gobierna el código: lo que ya se dijo en voz alta en un video producido no se puede renombrar (por eso «Closing Analyst» queda fijo: los videos de crm y semaforo la nombran así), y los `verMas` de esos videos apuntan a rutas cuyo significado va a cambiar. Concreto y sin hacer: `features.ts:981` (semáforo, «MaKo por WhatsApp») y `features.ts:462` (crm, «Descubrí cómo MaKo trabaja tu WhatsApp») caen hoy en `/vsl/whatsapp`, que pasa a ser la bandeja de ventas — deberían ir a `/vsl/asistente`. Se arregla sin retocar un solo video, pero cambia a dónde manda material ya publicado. El criterio que quedó para el catálogo: sobrevive con video propio lo que el comprador puede repetir en UNA frase de resultado; se funde lo que es el mismo momento de compra contado dos veces; y lo que responde un MIEDO o un REQUISITO (BYOK, roles de equipo) sale de la grilla, porque eso se compra después, no antes.

**Vive en:** app/vsl/features.ts (líneas 462 y 981) + app/vsl/content.ts · *2026-07-26 ~consolidar-catalogo-features-landing*

#### vsl_events.video_id se guarda desde hace meses y no lo lee nadie: el segundo VSL contamina todas las métricas

La mig 0061 agregó `video_id` y `vsl_titulo` a `vsl_events` justamente para poder comparar VSLs, y el beacon los persiste. Pero los tres consumidores (`getVslEngagement`, `getVslEngagementMap` y `getComportamiento` del Landing Analyst) no filtran ni agrupan por video: mezclan todos los videos en un solo número. Hoy no se nota porque en producción hay un solo VSL, pero el día que se suba el segundo, plays, max_pct y los cortes de retención pasan a mezclar dos videos sin que nada avise. Falta además el índice: `vsl_events` solo tiene índices por visitor_id (duplicado) y workspace_id, así que toda consulta por ventana temporal o por video es un seq scan.

**Vive en:** supabase/migrations/0061_tracking_granular.sql:12-13 · lib/leads.ts:1143-1146,1178-1181 · lib/landing-analyst.ts:156 · *2026-08-05 ~alta-tab-vsl-analyst*

