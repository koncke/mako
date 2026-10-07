# Relevo — Ads Manager

**Escrito el 06/10/2026 a las 16:50 por la sesión `claude1` (Ads Manager), antes del pase a la
cuenta 2.** Lo lee la sesión de la otra cuenta: es el único canal entre las dos.

---

## Lo primero que hay que mirar

1. **El punto ⚠️ de abajo («operar desde un cliente da 403»).** Es lo único de esta área que
   rompe algo para un cliente hoy, y el rediseño de esta sesión lo agrandó.
2. `git log --oneline -12 -- app/ads-manager/` y después `docs/hallazgos-ads.md` — es largo:
   se busca con `Grep` de la ruta que vas a tocar, nunca abriéndolo entero.
3. La bitácora del área: `app/admin/dev/ads-manager/bitacora.ts` (en `/admin/dev/ads-manager`),
   con los dos pedidos textuales de Martín del 05 y 06/10.

## En qué quedó: hecho y DESPLEGADO

Todo lo de abajo está en `origin/main` y en producción (último deploy de esta sesión, `d46b0eca`,
quedó *Ready* el 06/10 ~03:05; los deploys posteriores lo contienen).

| Commit | Fecha | Qué |
|---|---|---|
| `2ae26f80` | 11/09 | Los rechazos de Meta al publicar dicen de QUIÉN son (Código Inmobiliario) |
| `885f2f07` | 16/09 | El rechazo 1885183 ya no le pide al cliente que publique su app |
| `aea8dea1` | 16/09 | Publicar reusando un anuncio de la propia página pasa el bloqueo, y ahora se ve |
| `07073522` | 05/10 | Elegir el producto al crear la campaña, y asignarla desde la tabla |
| `0b48181e` | 06/10 | Rediseño: «Nueva campaña» arriba a la derecha, el resto en un ⋯, UN filtro |
| `f36651e3` | 06/10 | Selección múltiple, tabla densa, el conjunto que hereda el producto de su campaña |
| `60fc93b0` | 06/10 | «Filtrar» con embudo, ⋯ con íconos, renombrar/agregar en la barra de lote, cero emoji |
| `dc5c162d` | 06/10 | El rango de «no hay emoji» vive en UN lugar: `tests/_emoji.ts` |
| `cad249b3` | 06/10 | Regla de triage en `AGENTS.md`: un guard que lee fuente nombra al guard |
| `d46b0eca` | 06/10 | Botones cuadrados como el CRM (radio 10) y la barra de lote centrada de verdad |

(`721ad387` del 06/10 tocó `app/ads-manager/ProductoCelda.tsx` pero es del chat del **CRM**: un
prop opcional `buttonStyle`, aditivo. Verificado que no rompe nada de acá.)

**Cómo quedó la pantalla**, para no volver a poner algo donde ya se decidió que no va:

| Acción | Dónde |
|---|---|
| Nueva campaña | botón primario, arriba a la derecha |
| Subir creativos · Agregar conjunto a una campaña · Analizar con Meta | el ⋯, con ícono y sin subtítulo |
| Filtrar (fechas + estado + columnas) | a la altura de las tabs; radio 10, copiado del CRM |
| Actualizar estado | su propio botón cuadrado, a la derecha del filtro |
| Presupuesto · Producto · Renombrar · Agregar conjunto/anuncio | centro de la barra de selección |
| Activar/pausar (UN interruptor) + Eliminar | juntos, a la derecha de la barra |
| Editar textos (anuncio) · Editar público (conjunto) | la fila |

Agregar conjunto/anuncio desde la barra sólo aparece con **una** fila tildada. Renombrar actúa
sobre **lo elegido**, no sobre la tab entera.

## ⚠️ Lo más urgente: operar desde un cliente da 403

> ✅ **RESUELTO el 07/10/2026 (claude2).** `/api/meta-write` pasa por `wsDeAdsManager()` (el mismo
> guard que `/api/ads-manager/*`) y `lib/meta-write.ts` saca el token con
> `credWs('META_ACCESS_TOKEN', ws)`. El doer de MaKo también: `soloWs1` → `G_META_ADMIN` (sigue
> exigiendo admin) y sin el `OWNER_WS` de los runners. Lo de abajo queda como historia. El detalle
> —incluidos los dos lugares que no se veían leyendo la ruta— en `docs/hallazgos-ads.md` →
> «Pausar, represupuestar, renombrar y borrar: ahora con la cuenta de cada cliente».

**Verificado leyendo el código el 06/10/2026, NO en el navegador.**

- `app/api/meta-write/route.ts` corta con `esDuenoAdmin()` y contesta **403 «Esta acción solo está
  disponible en el workspace principal por ahora»**. Por ahí pasan pausar/activar, presupuesto,
  renombrar y eliminar (`CampanasBrowser.tsx:410`, `:433`, `:539`, `:557`).
- Y `lib/meta-write.ts` saca el token con `envCred('META_ACCESS_TOKEN')`, que **resuelve siempre
  contra el workspace dueño** (`lib/credenciales.ts:204`): el de Mauricio (ws1).
- La pantalla **no sabe nada de esto**: no hay ningún `esDueno`/`soloLectura` en `app/ads-manager/`.
  Dibuja los controles para todos.

Consecuencia: para el admin de un cliente (ws11, ws13, ws14…), **cada botón de escritura de la
barra de lote y de la fila contesta 403**. El rediseño de esta sesión sumó botones que escriben,
así que agrandó la superficie rota.

**Y no es una limitación pareja del área: es UNA ruta que quedó atrás.** Las 15 rutas de
`app/api/ads-manager/` ya cortan con `guardAdsWs()` (`lib/ads-guard.ts`), que pregunta si sos
admin **de ese** workspace — crear, sugerir y leer andan para un cliente, y `lib/meta-ads-create.ts`
usa `credWs`. Sólo `/api/meta-write`, que vive afuera de esa carpeta, quedó con el corte del dueño
y el token del dueño.

⚠️ **El peor caso es Renombrar**: la PROPUESTA (`/api/ads-manager/rename-suggest`) pasa
`guardAdsWs` y gasta IA contra la key de la plataforma, y recién al APLICAR (`op: 'name'` por
`/api/meta-write`) el cliente recibe el 403. O sea: se paga el modelo y después falla.

Y el caso raro: `esDuenoAdmin()` deja pasar al **super admin en cualquier workspace**, así que
Martín mirando un cliente pasa el corte pero escribe **con el token de Mauricio** sobre ids de
otra cuenta. Lo esperable es el error 100 de Meta («Object … does not exist… missing
permissions») — **sin verificar**.

**Toda la verificación en navegador de esta sesión se hizo en ws1**, el único workspace donde
esto anda. Por eso no apareció.

Dos salidas, y es la primera decisión de abajo: o se pasa `meta-write` a lo mismo que sus
hermanas (`guardAdsWs()` en la ruta + `credWs(ws, …)` en `lib/meta-write.ts`, con el `ws` que
devuelve `wsQuePuedeOperar()`), o se esconden los controles de escritura fuera del dueño hasta que
esté. ⚠️ Ojo al cambiar `lib/meta-write.ts`: **también lo usa el doer de MaKo**, así que hay que
mirar con qué workspace lo llama ese camino antes de tocar de dónde sale el token.

## Lo que espera una DECISIÓN DE MARTÍN

1. ~~**Operar desde un cliente**~~ **Resuelto el 07/10: por workspace.** (Era: ¿`meta-write` por workspace ya, o esconder
   los controles hasta entonces? Vive en `app/api/meta-write/route.ts` y `lib/meta-write.ts`.
2. **Producto MÚLTIPLE por campaña** (punto 7 de su pedido del 05/10). Choca con que un lead
   tiene UN solo `funnel_id` (`lib/campana-config.ts`, `funnelIdDeCampana`). Las tres salidas:
   - partir por conjunto: cada conjunto a un producto — **ya funciona hoy**;
   - múltiple con prioridad: la campaña en varios, y el lead cae en el primero — es un
     desempate silencioso;
   - un lead por producto — cambia el modelo del CRM.
3. **La barra de lote oscura o clara.** La del Ads Manager es oscura (`var(--ink)`); la genérica
   del plan y del CRM (`app/plan/board/AccionesLote.tsx:1143`) es clara (`--primary-bg`). Él sólo
   pidió radio y orden, así que no la toqué. Es una línea en `BarraLoteAds`
   (`app/ads-manager/BarraAcciones.tsx`).
4. **El `ⓘ` del chip «Con problemas» pasó a un ícono de ojo** y eso NO estaba en su lista: se
   cambió por consistencia con la regla de «no emoji». Si no le gusta, se revierte en una línea.
5. ~~**La app de Meta**~~ **Decisión REVERTIDA el 28/09**: Martín creó una app propia, «MaKo»
   (2586146911825340, portafolio MaKo), para que ningún cliente tenga que crear ni compartir la
   suya. Al 07/10 la verificación del negocio está en revisión y falta el App Review. Lo de abajo
   es historia. (Era: decidido el 11/09: se queda en la cuenta de Mauricio, #185 diferido.) Lo
   que sigue abierto ahí, en `docs/hallazgos-ads.md` → «Cómo llegó una app ajena a MaKo»: mirar
   en el panel de la app (Revisión → Permisos y funciones) si `ads_management`, `ads_read` y
   `leads_retrieval` están en acceso **avanzado** o **estándar** — decide si alcanza con que el
   cliente comparta como socio o hace falta App Review. Eso lo ve quien tenga el panel.

## Lo que quedó SIN verificar (y cómo medirlo)

- **Ninguna acción de ESCRITURA de la barra de lote se apretó en el navegador**: presupuesto en
  lote, producto en lote, aplicar un renombrado, eliminar, agregar conjunto/anuncio desde la
  barra. Escriben en Meta o en el CRM, y el único workspace donde andan es la cuenta real de
  Mauricio. Cómo: en ws1, sobre una campaña PAUSADA de prueba; o, cuando `meta-write` sea por
  workspace, en el Cliente de Prueba (ws3).
- **Lo que ve un cliente**: entrar a `/ads-manager` con un usuario admin de un cliente (no el
  super admin) y apretar el interruptor de una fila. Lo esperable, leyendo el código, es un toast
  con el 403. Y abrir Renombrar → «Proponer» → «Aplicar»: lo esperable es que la propuesta salga
  (y se pague) y el aplicar falle.
- **El super admin escribiendo sobre un cliente** (el caso raro de arriba): lo esperable es el
  error 100 de Meta. Sin medir.
- **«Si la cuenta tiene un solo producto, todo a ese»**: con un producto, la columna no se dibuja
  y el lote no la ofrece (`asig.productos.length > 1`). Que los leads caigan en ese producto sale
  del ruteo por defecto (una campaña sin asignar → `asignada: false` → el embudo principal).
  **Leído en el código, no medido con un lead real.**
- **Joan / Código Inmobiliario (ws13)**: el 16/09 su conexión de Meta era de una app propia en
  modo desarrollo, y por eso Meta rechazaba los creativos nuevos (1885183). No sé si reconectó
  con la app de MaKo después. Cómo: `debug_token` del token guardado de ws13 y comparar `app_id`.
- **El centrado de la barra en anchos chicos**: a 1280 px entra en un renglón y queda centrado
  exacto (medido: 722/722). A 1024 y 820 baja a dos renglones sin desbordar (medido), pero ahí
  el grupo del medio ya no queda centrado — se corre a la derecha. No lo pidió; anotado.

## Trampas de esta área que ahorran tiempo

- **El 1885183 juzga qué app PARIÓ el post, no quién llama.** Reusar un post o un `creative_id`
  existente de la página propia PASA aunque la app esté en desarrollo; un `object_story_spec`
  nuevo da 1885183. Medido el 16/09 con corridas en seco.
- **La conexión de Meta de un cliente son DOS tokens** (regla en `AGENTS.md`): cambiar sólo
  `META_ACCESS_TOKEN` deja la ingesta de leads con la app vieja, y **borrar** la fila del token de
  página corta la entrada de leads.
- **`vercel ls` escribe en stderr.** Con `2>/dev/null` no ves nada y parece que no hubo deploy.
- **Un solo `next dev` por carpeta**, en cualquier puerto: Next 16 rechaza el segundo. Un worktree
  con `node_modules` por junction **sirve para pushear y NO para `next dev`** (Turbopack: «Symlink
  … points out of the filesystem root»). Se levanta con `ZERNIO_API_KEY= ELEVENLABS_API_KEY= npx
  next dev -p <puerto>` o el boot escribe credenciales en la base de prod; el log tiene que decir
  «hidratadas» y ninguna «migradas». Después de borrar `.next`, la primera página tarda más de
  30 s en compilar: calentala con `curl` antes del Playwright. Hoy el dev server de :3010 es del
  chat de Customer Success: avisale antes de usarlo o bajarlo.
- **Un guard que lee fuente pone en el error SU nombre, no el del archivo que mira.** Antes de
  culpar a un commit, `grep` de qué lee el test y `git show HEAD:<ese archivo>`. Lo pagué el
  06/10 acusando al commit equivocado de otra sesión; quedó en `AGENTS.md`.
- **`space-between` no centra el medio si las dos puntas miden distinto.** Con eso la barra quedó
  74 px corrida; lo que centra son las dos puntas en `flex: '1 1 0'`. La barra genérica del plan
  tiene el mismo sesgo.
- **`aria-expanded={abierto}` aparece DOS veces en `BarraAcciones.tsx`** (el ⋯ y el filtro). Un
  guard que anclaba ahí medía el ⋯ creyendo medir el filtro. Anclá en un texto único.
- **El rango de emoji es uno solo**: `tests/_emoji.ts` (`PICTOGRAFICOS`, `emojiDe`). Lo importan
  el guard de Ads Manager y el de la ficha del lead. `2700–27BF` queda afuera a propósito (`✓ ✕
  ✦` son tipografía).

## Archivos que son de Ads Manager

`app/ads-manager/**` (el 90% vive en `CampanasBrowser.tsx` y `BarraAcciones.tsx`),
`lib/meta-publicar-errores.ts`, `lib/ganadores-reuso.ts`, `lib/campana-asignar.ts`,
`app/admin/dev/ads-manager/bitacora.ts`, `tests/ads-barra.test.ts`, `tests/campana-asignar.test.ts`,
`tests/_emoji.ts`.

**Compartidos con el CRM** (hablar antes de cambiar firmas): `app/crm/campanas-actions.ts` (las
acciones de asignar, que desde `721ad387` delegan en las de lote) y `lib/campana-config.ts`.

**NO son de acá**, aunque estén cerca: `app/api/meta-write/route.ts` y `lib/meta-write.ts`
(también los usa el doer de MaKo), `lib/meta-descubrir.ts`, `app/components/Dropdown.tsx`.

## Dónde quedó cosechado

`docs/hallazgos-ads.md` (las secciones del 11/09, 16/09 y 06/10: la app ajena, el 1885183, el
guard de emoji que buscaba donde uno adivinaba, el mapa de dónde vive cada acción, los rangos que
habían divergido), `AGENTS.md` (el triage de un rojo) y la bitácora de `/admin/dev/ads-manager`.
