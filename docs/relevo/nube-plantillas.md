# Relevo — Plantillas en toda la app (sesión en la nube, 6/11/2026)

Lo escribió la sesión de la nube que hizo el trabajo (rama `claude/pensive-hypatia-kdfa8o`, subida a `punta/plantillas-app`).
Lo que se aprendió está en [docs/hallazgos-plantillas.md](../hallazgos-plantillas.md).

## Lo pedido

1. **Plantillas reales** (Martín, 29/10/2026: «Los templates tienen que ser reales…»; y «Poné la estructura, la misma, y en
   algún lado un botón de "ver ejemplo"»): seguir [docs/plantillas-reales/README.md](../plantillas-reales/README.md) §6.
   Quedaban Offer, Video, Image y AI Avatar.
2. **Plantillas propias, privadas o públicas, en todas las tabs** (Leila, 30/10/2026), con compartir con la comunidad. Lo
   público nunca lleva datos del negocio de quien la comparte.
3. **Estrellas y ranking** de las plantillas públicas.
4. Administrarlas desde el super admin, **sin tocar `app/admin`** (lo rehace otro chat): lo que haga falta ahí, abajo.

## Lo hecho (commits en la rama)

| Qué | Commit |
|---|---|
| Plantillas propias (creación `privada`, mig 0407), compartir con limpieza de datos, enchufes de Copywriter (`guion`) e Image (`formato_imagen`), «Guardar como plantilla» en el «⋯» de cada proyecto, «Tus plantillas» y «De la comunidad» en «Nuevo …», pestañas «Ranking» y «Tus plantillas» en /creaciones, y en la API `guardar_como_plantilla`, `compartir_plantilla` y `ranking_creaciones` | `516196cef` |
| Offer: las 9 plantillas en «Nueva oferta» (la forma en la tarjeta, «Ver ejemplo» con la oferta llena), usar una arranca la conversación con la forma; API `ver_plantillas_oferta` | `45c4c5bf8` |
| AI Avatar: las 10 plantillas de venta y los 5 presets nuevos en la galería, «Ver ejemplo» con el guion por secciones; API `ver_plantillas_avatar` | `e6d2ae5f8` |
| Video: «Ver ejemplo» en las 5 plantillas que se quedan, sin tocar el catálogo del editor; `listar_plantillas_video` trae el ejemplo | `9d6d27e96` |
| Image: las 9 plantillas reales en «Nuevo diseño» (estructura dibujada en la tarjeta, «Ver ejemplo» aparte, en la computadora y el teléfono); las de Doory salen de ahí; API `listar_plantillas_imagen` con `reales` y `crear_diseno_imagen` con su id | `bebd4cde0` |

## Lo que tiene que hacer alguien con la base (la nube no puede)

- **Confirmar el número y aplicar la migración 0407** (`supabase/migrations/0407_plantillas_propias.sql`): ANTES o JUNTO
  con el deploy. Sin ella, «Sólo mi negocio» contesta «Falta la migración 0407» y compartir sigue andando. Es idempotente
  y no crea funciones. El número no se le pidió al Cerebro (la nube no llega): main tomó la 0404 y otras ramas la 0405 y la
  0406 mientras se trabajaba.

## Lo que falta, con dónde vive

- **Image:** ver la sección de abajo (las 10 de Doory sin borrar, las fotos de muestra y las preguntas al crear).
- **Plantillas propias en las demás tabs:** cada una es un enchufe en `lib/creaciones-enchufes.ts` (sacarla de
  `POR_ENCHUFAR` o sumar el tipo en `lib/creaciones-reglas.ts`), con su `paraPublico` (lo que no es texto y es del negocio),
  el `<ModalGuardarPlantilla>` en el «⋯» y `usePlantillasPropias(tipo)` en «Nuevo …», como Copywriter e Image.
  - **Video:** el proyecto vive en el navegador; el enchufe necesita que el editor arme la plantilla (dueño: chat de Video).
  - **Offer, AI Avatar, Web Generator y Dashboard:** sin empezar. Dashboard ya tiene `hojaParaCopiar` (hallazgos-graficos).
  - **El teléfono:** «Tus plantillas» sólo está en la computadora (`app/m/image-editor/InicioImagenM.tsx` usa la lista de MaKo).
- **Offer:** el experto `offer.experto` (docs/plantillas-reales/offer.md §3.3, con la skill `add-editable-prompt`), «Ver
  ejemplo» adentro de la conversación y el teléfono (`app/m/offer/HojasOfferM.tsx`). Y el bug de `precioDe` con «al mes».
- **Video (chat de Video):** los 6 templates nuevos, retirar `gancho-escrito` y `oferta-glitch`, los clips de Pexels y la
  miniatura dibujada (`MiniaturaPlantilla`). Lo que no entró en los huecos de hoy está en la cabecera de
  `lib/editor-video/plantillas-ejemplos.ts`.
- **AI Avatar:** el Director (AV-3), los retratos, pósters y loops (esperan al motor), y la guarda de `crearVideoAction`.
  Usar una plantilla hoy pone el preset y la escena; el guion con su estructura todavía no llega al proyecto.

## Para el chat del super admin (app/admin)

- **Moderar lo publicado:** una lista de `creaciones` con estado `publicada` de todos los negocios, con «Retirar». El
  server ya lo deja (`retirarCreacion`: la plataforma retira cualquiera; una PRIVADA ajena no existe para nadie, tampoco
  para la plataforma). Leer con `listarCreaciones` (el ws de la plataforma) o una lectura nueva que traiga el negocio de
  origen SÓLO para el super admin (lo que sale a otro negocio nunca trae `workspace_origen`).
- **Las «de MaKo»:** lo que publica el workspace de la plataforma sale con `de_mako: true` y el autor «MaKo». Sembrar las
  plantillas de MaKo es publicarlas desde ese workspace con «Guardar como plantilla» → «Toda la comunidad».
- **El hito de `/admin/dev`:** no se escribió porque no se toca `app/admin`. El pedido literal para la bitácora (área
  `creaciones` o la de cada tab): «Terminá las plantillas en toda la app: plantillas reales…, plantillas propias, privadas o
  públicas, en todas las tabs…, estrellas y ranking de plantillas públicas…» (6/11/2026), con los commits de arriba.

## Image

- **Lo hecho:** las 9 plantillas reales que no son carrusel (`lib/image-editor/plantillas-reales.ts`, generadas por
  código: la estructura y el ejemplo salen de la misma función) están en «Nuevo diseño», después de los carruseles por tipo
  y antes de los tamaños en blanco. La tarjeta dibuja la estructura (`app/image-editor/MiniaturaDiseno.tsx`, SVG sin el
  motor, con las fuentes del catálogo del editor) y «Ver ejemplo» abre la composición llena
  (`app/image-editor/EjemploPlantillaImagen.tsx`). Crear una abre la ESTRUCTURA. El teléfono la dibuja igual. En la API,
  `listar_plantillas_imagen` trae `reales` con los textos de su ejemplo y `crear_diseno_imagen` acepta su id.
- **Las 10 de Doory salieron de «Nuevo diseño» pero NO se borraron:** siguen en el panel «Diseño» del editor y en la API
  (`plantillas`). El plan (docs/plantillas-reales/image.md §5, punto 3) dice borrarlas con sus JSON y WebP: queda para el
  chat de Image, porque tocan el panel del editor, la API y tres tests (`api-mako-imagen`, `plantillas-sugeridas-editores`,
  `_bloques-tarjeta-hijo`).
- **Falta:** las fotos de muestra del ejemplo (hoy son marcos vacíos «Tu foto»: image.md, trampa 6), «toca la foto y pon
  la tuya» con `slot` (el marco hoy es un `rect` con `isPlaceholder`), y que MaKo pregunte los hechos de `pide` al crearla
  (hoy el diseño abre con la estructura y el chat del editor la llena a pedido).
