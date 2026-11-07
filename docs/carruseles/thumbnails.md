# Thumbnails — miniaturas de YouTube que funcionan, para copiar su diseño (6/11/2026)

Martín, 6/11/2026: «También quisiera una tab que sea "Thumbnails", para traer de la misma manera miniaturas top en el mercado,
estoy seguro que debe haber una API o un repo o algo que traiga eso».

Es la tercera opción del explorador de Image («Carruseles · Anuncios · Thumbnails», `/image-editor?que=thumbnails`): la misma
pantalla, con su tarjeta 16:9, sus filtros (rubro, idioma, publicado, orden) y «Editar», que arma la versión del negocio en un
diseño de 1280 × 720 en el Image Editor, con la IA del negocio.

## De dónde salen: la YouTube Data API oficial

| Fuente | Qué da | Por qué sí o no |
|---|---|---|
| **YouTube Data API v3** (oficial) | Canales, videos, vistas, me gusta, comentarios, duración. La imagen, en `i.ytimg.com/vi/<id>/` | **La elegida.** La clave de YouTube de la plataforma ya existe (la usa Spy). Es la única fuente con permiso para mostrar el dato a un cliente que paga, con dos condiciones de sus Developer Policies (abajo). |
| Raspar youtube.com (yt-dlp, Apify `youtube-scraper`) | Lo mismo, sin cuota | **No.** Los Términos de YouTube prohíben el acceso automatizado fuera de la API (§ «Permisos y restricciones»), y comprar el dato raspado a un tercero es lo mismo (la regla de la casa: «copiar código y usar el dato son DOS permisos»). |
| 1of10, ViewStats, vidIQ, TubeBuddy | Justo esto: miniaturas «outlier» por nicho | **No.** Son productos pagos sin API pública de reventa; mostrar su catálogo dentro de MaKo sería revender su trabajo. Sirven de **referencia de diseño** (la tarjeta 16:9 con el múltiplo y la duración copia ese molde). |
| Repos abiertos («youtube outlier finder», «niche finder») | Scripts que hacen `search.list` + `videos.list` y calculan vistas ÷ mediana del canal | Sirven para confirmar la fórmula, que ya existe en MaKo (`multiplosDe`, lib/multiplo-rendimiento.ts, la de Spy). No se copió código: no hacía falta. |

### Las dos condiciones de YouTube

1. **El múltiplo espera un trámite.** Las Developer Policies (III.E.4.h) prohíben mostrar «a score that factors in likes, total
   views» calculado por nosotros salvo con la enmienda III.L. Es el mismo interruptor de Spy (`ENMIENDA_III_L`, lib/spy-reglas.ts),
   hoy apagado. **Mientras tanto:** la tarjeta muestra las VISTAS (dato de YouTube), el orden de entrada es «Más vistas», el
   deslizador del múltiplo no aparece (el modal dice por qué) y no se dibuja ningún «4,2×». El día que se firme, sale solo
   (`thumbnailsDe` ya lo calcula; `ordenesDisponibles` lo ofrece).
2. **Treinta días.** Sin la enmienda, lo que se guarda de la API (títulos, vistas) vence a los 30 días: la pantalla no muestra lo
   leído hace más (`vigente`) y el script lo borra (`podar`). Por eso hay que volver a leer cada mes.

La imagen **no se guarda ni se copia**: se dibuja la de `i.ytimg.com`, y cada tarjeta lleva «Ver en YouTube». «Editar» la baja
una vez (con `fetchSeguro`, sólo de `i.ytimg.com`) para que la IA del negocio la mire, y no la guarda.

### La cuota

- `search.list` (descubrir canales) tiene un **balde propio de 100 llamadas por día para toda la app** desde el 1/6/2026
  (docs/hallazgos-competitors-spy.md). Por eso se usa poco: una consulta por rubro e idioma (4 × 3 = 12 como mucho por corrida),
  con un tope en el script (`--max-busquedas`, 12 por defecto).
- Leer cada canal va por el camino barato de Spy (`traerVideosDelCanal`: channels → playlistItems → videos, ~3 unidades de las
  10.000 diarias por canal). 120 canales ≈ 360 unidades.

## Cómo está armado

- **Tablas globales** (mig `0409_thumbnails_biblioteca.sql`, sin `workspace_id`, como la biblioteca de carruseles):
  `thumbnails_canales` (canal, rubro, idioma, de dónde salió, activo/excluido) y `thumbnails_videos` (video, título, vistas,
  me gusta, comentarios, duración, `leido_en`, `oculto`). RLS prendido y sin políticas; las lee el servidor.
- **Lo puro:** `lib/thumbnails/explorar.ts` (qué se muestra, filtros, URL, orden y reparto por canal) y `lib/thumbnails/carga.ts`
  (la búsqueda y las filas). Tests: `tests/thumbnails-explorar.test.ts`, `tests/thumbnails-carga.test.ts`.
- **El servidor:** `lib/thumbnails/servidor.ts` (lee la biblioteca y los guardados del negocio, `thumbnails.guardados`).
- **La pantalla:** `app/image-editor/carruseles/Thumbnails.tsx`, montada por `ExplorarCarruseles.tsx`.
- **«Editar»:** `replicarEjemplo(ws, quien, { que: 'thumbnail', id })` (lib/carruseles/replica-servidor.ts), la misma función que
  los carruseles, con el prompt de miniatura (una lámina 16:9, gancho de 2 a 6 palabras).
- **La API de MaKo:** `buscar_thumbnails`, `guardar_thumbnail` y `editar_ejemplo_thumbnail` (área imagen, sólo app y WhatsApp).

## Cargarla, desde la PC (el Cerebro)

Con el `.env.local` de producción, desde la raíz del clon. **En seco por defecto**: sin `--de-verdad` no escribe nada.

1. La migración (sólo agrega dos tablas; el orden de despliegue da igual: sin ellas la pestaña dice que la biblioteca todavía
   no está cargada):

   ```bash
   node scripts/apply-migration.mjs supabase/migrations/0409_thumbnails_biblioteca.sql
   ```

2. Descubrir canales por rubro e idioma (usa del balde de 100 búsquedas por día):

   ```bash
   node --env-file=.env.local --conditions=react-server --import tsx scripts/thumbnails-biblioteca.mts descubrir --por-par 8 --dias 180
   node --env-file=.env.local --conditions=react-server --import tsx scripts/thumbnails-biblioteca.mts descubrir --por-par 8 --dias 180 --de-verdad
   ```

3. Leer sus videos:

   ```bash
   node --env-file=.env.local --conditions=react-server --import tsx scripts/thumbnails-biblioteca.mts leer --max 120 --de-verdad
   ```

4. Mirar y curar (como la biblioteca de carruseles: se esconde lo que no le sirve a un dueño de negocio):

   ```bash
   node --env-file=.env.local --conditions=react-server --import tsx scripts/thumbnails-biblioteca.mts estado
   node --env-file=.env.local --conditions=react-server --import tsx scripts/thumbnails-biblioteca.mts excluir @canal --motivo "No sirve a dueños de negocio" --de-verdad
   node --env-file=.env.local --conditions=react-server --import tsx scripts/thumbnails-biblioteca.mts ocultar <idDelVideo> --de-verdad
   node --env-file=.env.local --conditions=react-server --import tsx scripts/thumbnails-biblioteca.mts sumar @canal --nicho ventas --idioma es --de-verdad
   ```

5. **La renovación ya no es a mano:** la hace `/api/cron/thumbnails-renovar` (`lib/thumbnails/renovar.ts`), los **domingos 06:55 UTC**.
   Relee los canales activos y después poda lo vencido, con la clave de la plataforma. Los comandos de abajo siguen sirviendo para
   forzarla desde la PC — llaman la misma función que el cron:

   ```bash
   node --env-file=.env.local --conditions=react-server --import tsx scripts/thumbnails-biblioteca.mts leer --max 120 --de-verdad
   node --env-file=.env.local --conditions=react-server --import tsx scripts/thumbnails-biblioteca.mts podar --de-verdad
   ```

   ⚠️ **Semanal, no mensual, aunque el vencimiento sea de 30 días.** Un cron mensual el día 1 deja 31 días entre enero y febrero: lo
   leído el 1 de enero vence el 31 y la galería queda vacía un día antes de que el cron la salve; y con una sola oportunidad por
   vencimiento, cualquier corrida fallida la vacía igual. Lo fija `tests/thumbnails-renovar.test.ts` contra `vercel.json`.
   ⚠️ **El cron NO descubre canales nuevos** (`search.list` y su balde de 100 por día lo comparte toda la app, Spy incluido): el paso 2
   sigue siendo a mano.

## ✅ Cargada el 6/11/2026: 79 canales activos, 1.520 miniaturas (14 canales excluidos)

> Medido con `estado` contra producción el 6/11 a la noche. Los números de más abajo (85 y 1.643, 8 excluidos) son del momento de la
> carga: la curaduría siguió después. Antes de repetir un número de este documento, corré `estado`.

Corrido desde la PC con los pasos de abajo: `descubrir --por-par 8 --dias 180 --de-verdad` (12 búsquedas,
93 canales) y `leer --max 120 --de-verdad` (1.784 videos). La 0409 ya estaba aplicada.

**Curado: 8 canales excluidos, con su motivo.** Cinco de **mercado indio** (`@dhavalkataria1211`,
`@wintwealthyt`, `@growthstorystudio`, `@navan.jaiswal`, `@adityaarorathefaadguy`): son el 6% de la
biblioteca y se quedaban con **4 de los 12 primeros** del orden de entrada, porque las vistas crudas no
son comparables entre mercados. Y tres sin servir a un dueño de negocio o sin señal: música para
manifestar (`@musicaexpansiva`), un canal con un solo video de 6 vistas y otro con tope de 306.

⚠️ **Excluir a mano no escala**: cada `leer` mensual trae videos nuevos del mismo tipo. El arreglo de
fondo es ordenar por el **múltiplo**, que es lo que normaliza mercados distintos — y es lo que espera la
enmienda III.L. El porqué, con los números, en
[hallazgos-carruseles.md](../hallazgos-carruseles.md) → «el 6% de los canales se quedaba con un tercio
de la vidriera».

## Lo que no se hizo

- **El múltiplo**: espera la enmienda III.L (el mismo trámite que Spy). Hasta entonces, vistas.
- **Las miniaturas de los canales que sigue el negocio en Spy** no entran a esta pestaña: Spy ya guarda las suyas
  (`spy_piezas.miniatura`), pero mezclar las dos bibliotecas cambia de quién es cada tarjeta. Se puede sumar como «De tus cuentas»,
  igual que en carruseles.
- **El rubro lo pone la búsqueda**, no un clasificador: un canal de ventas que hace un video de marketing queda en ventas.
