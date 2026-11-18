# Relevo — los 46 pendientes «De octubre» (nube, 18/11/2026)

> Lo escribe la sesión de la nube que los trabajó (cuenta `claude2`, sesión `cli_220069ef-c004-5c47-ae62-3770ea6e643f`).
> El encargo, textual: «Trabaja la sección "De octubre (46 abiertos)" de `docs/pendientes-verificados-17-11.md` (en main),
> incluido O9 (los 14 pedidos de Ads Manager y Marketing CoPilot, "disputado"). Para cada ítem, ANTES de tocar nada, refuta…
> Lo que siga abierto, constrúyelo con su test, en una punta por área. Si un ítem necesita una decisión de Martín o una
> escritura en producción, anótalo en el relevo con su explicación (qué es, para qué, qué pasa si sí y si no). No lo adivines…
> No toques el onboarding, el reto ni los tutoriales.» Y de Martín, el 18/11: «continúes con absolutamente todos los pendientes».
>
> El estado de cada ítem, con su evidencia, quedó también en el propio `docs/pendientes-verificados-17-11.md` (sección «De
> octubre»): lo cerrado va tachado con la fecha y el sha. Acá va lo que hace falta para seguir.

**En corto:** de los 46, 13 quedaron cerrados (tachados), 13 a medias con lo hecho y lo que falta, y 20 esperan una decisión de
Martín (§2), producción (§3) o son trabajo grande (§4). O11 quedó afuera por el encargo (§5). Se subieron 19 puntas (§7).

## 1. Cómo se trabajó

- Se refutó cada ítem contra `origin/main` del 18/11 (el documento era del 17/11: desde entonces sólo cambiaron tickets,
  `lib/mako-grupo.ts` y un test de cursos, y ninguno cerraba un ítem).
- 27 ítems se construyeron en 13 puntas, cada una con su agente en un worktree, su test que ejecuta el código y probado
  rompiéndolo. Después, dos puntas más con lo que salió de la tanda (el período de General y seis arreglos chicos del CRM).
- Un revisor independiente contrastó contra `origin/main` todo lo que se dio por hecho antes de tacharlo.
- **Para la próxima sesión de la nube:** el pre-push corre con el Node 22 de la máquina y su filtro da rojos de mentira
  (`invitarAlCurso is not a function`, `mock.module`; ya cosechado en docs/hallazgos-infra.md). Lo correcto es
  `export PATH="$(sh scripts/node24.sh):$PATH"` en el MISMO comando del `git push`. Los agentes no pudieron ponerlo (el
  permiso del entorno no dejó un `PATH` delante de git): con el filtro corrido a mano con Node 24 en verde, subieron con
  `MAKO_SIN_FILTRO=1 git push …`, el escape que documenta el propio hook; nunca con `--no-verify`. Y `tsc-acotado` necesita `--heap=5120` para los archivos grandes (con el tope de 2560 sale 99: no chequeó).
- No se sacó el veredicto de la nube (`scripts/veredicto.mjs sacar`): pide el tsc entero con 12 GB y había 13 agentes en una
  máquina de 15 GB. GitHub corrió todo en cada punta.

## 2. Lo que espera una decisión de Martín

Cada una con qué es, para qué y qué pasa con cada respuesta.

1. **O7 · Elegir «Recurrente» en un aviso agenda el envío en el acto** (`app/agencia/FlujoAviso.tsx:1158-1170`, decisión 5.1 de
   `docs/relevo/avisos-y-whatsapp.md`). Hoy un clic para mirar qué hace el botón deja un envío diario prendido (así le llegó
   cuatro días un mensaje al grupo de Leila).
   - **A:** que abra el horario y no guarde hasta confirmar. Se evita el envío por accidente; choca con «elegir uno apaga el
     otro», que se pidió así.
   - **B:** dejarlo como está. La única red sigue siendo que el texto de ejemplo de fábrica no se agenda.
2. **O30 · Seguir cuentas sólo para carruseles.** Hoy «+ Seguir cuentas» del explorador de carruseles lleva a Competitors Spy
   y las cuentas salen de los competidores de Spy (`lib/carruseles/explorar-servidor.ts:62`).
   - **Sí:** se arma una lista propia de cuentas de carruseles, aparte de los competidores.
   - **No:** se cierra el pendiente; los carruseles siguen mirando lo que trae Spy, y «Traer tu outlier» suma un post suelto.
3. **O54 · La ruta `/offer`.** Pediste que no exista, pero hoy la usan 23 archivos: el CoPilot del 11-13/11, el CRM, las
   aperturas, la API y el teléfono.
   - **Borrarla:** primero hay que decidir a dónde va la conversación de la oferta (¿el Ops Center?) y redirigir `/offer` ahí,
     o todos esos links dan 404.
   - **Dejarla:** se cierra el pendiente. De esto depende también O13 en Offer (que la oferta se vea armándose).
4. **O51 · El tope de espacio por plan del Video Editor.** El número lo eliges tú con Planes: es promesa a Teo. Sin el número
   no se puede poner el candado. Además, guardar los proyectos en el servidor es trabajo grande (abajo, §4).
5. **O40 (1) · Corregir CUALQUIER dominio inventado en lo que MaKo manda a un grupo.** Hoy se corrige un dominio a 1-2 letras
   de hola-mako.com en todas las salidas al grupo (hecho hoy). Uno inventado del todo («tu-dashboard.com/integraciones») sale
   tal cual.
   - **Endurecerlo** rompería los links al sitio propio de cada negocio.
   - **Propuesta, sin implementar:** decidir por el camino y no por el host. Si un link del texto del modelo tiene una ruta de
     MaKo (/crm, /integraciones…) y un host que no es de MaKo ni un dominio declarado por el negocio, se reescribe a
     hola-mako.com.
6. **O1 · «N personas están viendo esta página».** El Pixel no registra quién sigue en la página.
   - **Frase honesta, sale ya:** «N personas la abrieron en los últimos 5 minutos», sin tocar el Pixel.
   - **Mantener «están viendo»:** primero hay que agregarle al Pixel un latido, con versión nueva del snippet que cada cliente
     tiene que volver a pegar.
   En los dos casos falta después la ruta pública con su tope.
7. **O9 · Los anuncios.**
   - **Transcribir al SUBIR cada creativo:** hoy se transcribe (una sola vez por video, desde hoy) cuando el anuncio corre.
     Transcribir al subir paga una escucha por cada creativo, también los que nunca salen al aire.
   - **La parte descriptiva del nombre:** el código NNN.SS.x ya sale solo. Que el resto del nombre lo escriba la IA cuesta
     tokens en cada anuncio.
   - **Renombrar lo ya publicado:** escribe en campañas reales de clientes en Meta.
8. **O21 · Quién puede pisar un dato del perfil que ya tiene valor.** La pantalla sólo se lo deja al super admin, y cuando
   rechaza no avisa (el valor viejo vuelve sin explicación). Desde hoy el chat se lo deja al admin del negocio, con su «sí».
   - **Si sólo el super admin:** se le pone el mismo candado al chat.
   - **Si el admin del negocio:** la pantalla tiene un bug y se arregla para que lo deje.
9. **O10 · Las ventas de los CRM extra (renovaciones) en la fuente Leads del Dashboard.** Sumarlas metería las renovaciones en
   los totales y en la tasa de cierre. Hoy no se suman. Y «A quién cobrarle» de General sigue mostrando todo lo pendiente aunque
   la hoja tenga período (lo decidido con Mauricio el 12/10): cortarlo por el período escondería las cuotas vencidas de antes.
10. **O18 · La primera prueba A/B en una landing pública.** La landing ya sabe servir y contar una prueba; nadie la puede crear
    todavía (ni pantalla ni API) y la primera espera tu sí.
11. **O32 · Dónde alojar las fuentes del Image Editor.** Hoy salen de jsDelivr (un CDN ajeno): 70 familias, 997 archivos,
    unos 17 MB. Se pueden alojar en `public/` de Vercel o en Storage.
12. **O34 · Los tamaños en blanco del Image Editor** (6 tamaños y «Carrusel de Instagram») siguen como un marco con su rótulo.
    Si quieres que también lleven un dibujo, es una decisión de diseño.
13. **O20 · Instalar el Runner 1.28.0 en la PC** (`cartero.mjs instalar`). Con eso, un chat en «Automático» lee y planea con
    Sonnet y pasa a Opus para hacer cambios. Ese día hay que mirar si la app te pide permiso cada vez que el Runner le cambia
    el modelo a un chat (puede ser dos veces por trabajo).
14. **O19 · El botón «Generar» del onboarding** sigue reemplazando la grilla de anuncios entera y pierde los guiones. No se
    tocó porque el onboarding quedó afuera de este encargo; la API ya funde sin borrar.

## 3. Lo que necesita producción (medir o escribir)

Desde la nube no se lee ni se escribe producción. Lo hace el Cerebro desde la PC.

| Ítem | Qué hay que hacer | Por qué |
|---|---|---|
| O6 | Mirar en pantalla, con una línea vinculada, «Tu forma de escribir» desde el lienzo de Automations: cada fila con el nombre de la agenda o de WhatsApp y su foto | El código está desde el 2/8; nadie lo vio con datos reales |
| O24 | Mirar si multiplicatusresultados.com (y www) lo sirve Vercel o Lovable (`x-vercel-id` / `server: Vercel`) | La red de la nube bloquea ese dominio (403 del proxy). Si sigue en Lovable, faltan la Fase B y C de `docs/migracion-landing-vercel.md`, en el repo y el DNS de Mauricio |
| O29 | Mirar en Spy: «Agregar un canal», los anuncios dentro de Contenido, «Usar @herasmedia», los 45 s de Google y la velocidad con Den Borg | Necesita una clave de Apify válida: la cargada da 401 desde el 13/11 |
| O33 | Descargar en /image-editor un diseño de 2+ páginas y abrir el ZIP | El test de hoy prueba el ZIP en Node; falta un navegador de verdad |
| O34 | Mirar /image-editor › «Crear desde cero» | Confirmar que sólo los tamaños quedan en blanco |
| O38 | Correr en el ws3 las pruebas 3 a 7 de `docs/relevo/nube-grupos.md` y el push en un Android | Sólo consta la prueba 2, y en el ws9 |
| O41 | `npx vercel env ls production \| grep VIGIA_GRUPOS` (tiene que dar `on`), la marca de `mako.vigia.grupos` de la plataforma (menos de 30 min) y tickets `vigia:%` | El vigía está detrás de un interruptor apagado por default |
| O50 | Medir la cabecera del Video Editor a 688-1312 px con el chat abierto | El arreglo está desde el 12/11; lo trabado era el banco de pruebas |
| O53 | Mirar en la base el ticket #15 (pudo cerrarse solo) y, si sigue abierto, pedirle a Leila que reimporte el mp4 | El arreglo está desde el 27-28/10 |
| O57 | Mirar en el ws11 si el perfil y el producto «LíderMente» siguen desfasados (precio y horario) | Si siguen, se lo dices a Leila: son datos de ella |
| O60 | `select id, estado, resuelto_at from tickets where id in (11,12,21,22)` y sus eventos | Si alguno no está cerrado, `scripts/tickets-cerrar-resueltos.mjs` |
| O3 | Volver a replicar #68-#72 en el ws9 sin pisar las viejas, y mirar lo fijo/pegajoso de holo | Escribe en producción |
| O12 (b) | Contar los sacados de antes del 24/10 con el curso abierto (`comunidad_baneos` con `levantado_at` null × `curso_accesos` sin `revocado_at`) y re-sacarlos desde Members | Desde hoy no se los puede re-invitar, pero los viejos siguen con el curso abierto |
| O44 | Cruzar las fichas que perdieron la visita (`visitor_id`) por un opt-in duplicado entre el 14/11 y hoy | Desde hoy ya no se pierde; las de antes no se arreglan solas |
| O25 | Las 2 animaciones crudas que faltan (de 14) y miniaturas de los 3 PNG pesados de la marca (9,8 / 8,6 / 5,7 MB) | Son filas de `branding_assets` y archivos de la PC de Martín |
| O27 | Medir /dashboard y /plan después del cambio a pdx1 (logs de Vercel, `requestDurationMs`) y correr `scripts/prueba-de-carga.mjs` con una sesión real | El script ya está y se niega a correr contra producción sin `--contra-produccion`; necesita tu OK |
| O49 (3) | Contar en el ws11 los leads con `origen_lead='migracion'` y `migrado_de='GoHighLevel'` | Si da 0, la migración de Leila no se hizo |

## 4. Lo que es trabajo grande y quedó sin hacer

- **O52 · Editar un video pedido por chat, renderizando afuera del navegador.** La vía decidida el 11/11 es Remotion en Lambda
  con la cuenta de AWS de cada cliente: antes hay que pasar el proyecto del Video Editor a una composition de Remotion
  (`docs/editor-video/relevamiento-remotion.md`). `@remotion` no está en el repo.
- **O51 · Guardar los proyectos del Video Editor en el servidor** (hoy viven en el navegador: `services/storage/opfs-adapter.ts`
  e `indexeddb-adapter.ts`). De esto depende O35 (1), las plantillas propias de Video.
- **O32 · Las 8 funciones de Canva que faltan** (`docs/editor-imagen/relevamiento-canva-funciones.md:112-129`).
- **O31 · Generar con IA la persona de un carrusel** (la orquestación con Flow, parte 7 de `lib/carruseles/plancha.ts:22`) y el
  filtro de videos en los anuncios guardados, que necesita otro recorrido con la extensión.
- **O49 · Importar las automatizaciones de GoHighLevel** (no hay forma de probarlo sin una cuenta de GHL) y la comunidad de
  Andrea en Skool como curso (necesita el acceso a Skool).
- **O18 · L3**, el agente que propone versiones de una landing; y la vista previa `?variante=B`, seguir mostrando la ganadora
  al cerrar y «agendó/pagó» por visitante.
- **O1 · Las animaciones de la etapa 4** del Web Generator (scroll, cinta, contador, transiciones).
- **O2 (1)-(4) · El teléfono:** conectar una integración (portar el modal y el OAuth a una hoja), las pistas del Video Editor,
  crear y analizar una landing, y cobrar con link desde la ficha (toca plata: necesita su revisión adversarial).
- **O37 · El chat de Image y Video:** agrupar, degradados, animaciones, quitar el fondo (IA paga), plantillas y redimensionar
  una página; que la API cambie más que los textos de un diseño (pide la tabla `image_editor_propuestas`, una migración); que
  abrir un proyecto no cambie de ruta; y en Video, música, voz, avatar, fotogramas clave, máscaras y chroma.
- **O8 · Zernio:** crear públicos de interacción, el alcance y los eventos del píxel siguen con el token de Meta: no hay en el
  repo una forma conocida de pedirlos a Zernio.
- **O10 (5) · Plantillas de Instagram orgánico** en el Dashboard: hay que medir qué da Zernio orgánico en producción y elegir el
  demo de `demo.codeandchill.store` que se copia.
- **O47 · Los 38 pedidos de diseño del CRM que siguen abiertos**, con su archivo, en la columna «Re-medido 18/11/2026» de
  `docs/feedback-diseno-pendiente.md`.

## 5. Excluido por el encargo

- **O11 · Tutoriales y recorridos por tab:** no se tocó («No toques el onboarding, el reto ni los tutoriales»). La lista viva de
  las pestañas sin guía es `SIN_GUIA_TODAVIA` en `tests/guia-catalogo.test.ts`.

## 6. Lo que salió de la tanda y no era de los 46

- **El «hoy» de todo el Dashboard sale de Tijuana** (`app/dashboard/page.tsx:106` y el corte de los gráficos), no del día del
  negocio: contradice la regla de AGENTS.md («"Hoy" es el día del NEGOCIO»). Arreglarlo cambia todo el Dashboard; no se tocó.
- **Agrupar por funnel en el Dashboard** (O10, b3980c1f5): una tasa por funnel que mezcla la venta con otra cosa (cierres ÷
  asistencias) puede dejar el cierre en un funnel y la asistencia en el otro cuando el lead se vendió en un funnel agregado.
- **La galería de la ficha abre sola en un negocio nuevo** (crm-pedidos-chicos, 21dcec74b): «nuevo» quedó como «sin ningún lead
  anterior al 16/10/2026». Es una interpretación de «los workspace que ya tienen leads»; si Martín lo quería de otra forma, es un
  cambio de una función (`negocioNuevoParaLaFicha`, lib/ficha/config-server.ts).
- **Las seis chicas de O47** ya están hechas (`punta/crm-pedidos-chicos`): el «anuncio de origen» sale de las plantillas (no hay
  pieza que lo dibuje), las etiquetas junto al nombre ceden en el teléfono (falta mirarlo en un iPhone), el aviso de qué le falta
  a «Insights», los rótulos «Sin…» del teléfono y «Asignar fuentes» fuera de Prospección. Quedan 32 abiertas.
- **En los anuncios** (ads-nomenclatura): «Usar en un anuncio» y `proponer_crear_campana` todavía no proponen el código de
  campaña; una letra de un anuncio borrado puede volver (Graph no lista los borrados); y `proponer_anuncio_desde_archivo` con
  origen «mensaje» no se puede confirmar en /mako/revisar (está apagado).
- **En el Copywriter** (anotado en su cosecha): `cifrasSinFuente` no mira precios ni «quedan N lugares», `alTuteo` no corrige
  «andá», «vení», «pedime», «ponete» ni «sentite», y `primerMensajeDeEjemplo` es código muerto (se borra con T15).
- **En infra:** `scripts/typecheck-lock.mjs:117-220` (el tsc entero antes del respaldo) todavía espera RAM con el lock tomado, a
  propósito según su comentario del 11/10, pero contra la misma regla de O26.
- **En Ops Center:** el margen del CRON en la batería de la API quedó en 310-311 (el piso es 300): la próxima operación de
  Automations que puntúe por encima del CRON lo cruza.

## 7. Las puntas

Todas con su test que ejecuta el código y probadas rompiéndolas. «En main» = la corrida de `punta.yml` dio verde y la llevó; en
producción es recién con el despliegue diario de Vercel en «Ready», que esta sesión no ve.

| Punta | Ítems | Último sha | Estado |
|---|---|---|---|
| `punta/crm-diseno-remedido` | O47 | a30c5b905 | en main |
| `punta/curso-sacado` | O12 (a) | 7556c1c1e | en main |
| `punta/grupo-dominio-real` | O40 (2) | b9162f72b | en main |
| `punta/movil-octubre` | O48, O14, O35 (2), O2 (5)(6) | 7c086f0a8 | en main |
| `punta/movil-chats-linea` | O48 (las 150 por línea) | c026f4223 | en main |
| `punta/dashboard-octubre` | O10 (1)(2)(3 funnel), O13 Dashboard | 0e8e3a6d5 | en main |
| `punta/dashboard-funnel-agrupado` | O10 (1) al agrupar | b3980c1f5 | en main |
| `punta/general-periodo` | O10 (3) período | 629531ccc | en main |
| `punta/tickets-24h` | O59 | d21bcb74a | en main |
| `punta/imagen-octubre` | O34, O33, O37 (a), O32 medido | d908f010d | en main |
| `punta/ops-modelo-por-fase` | O20 | ed9a8bcca | en main (primero rojo por un test que copiaba una línea; se hizo prueba real) |
| `punta/landing-octubre` | O13 landing, O18 L2 | bcf7b54fe | en main |
| `punta/copywriter-octubre` | O23 | 0a6fac1e6 | en main |
| `punta/infra-octubre` | O26, O27 | f1587b2e3 | en main |
| `punta/ads-octubre` | O9, O22, O8 | 1a471006c | en main |
| `punta/ads-nomenclatura` | O9 (el código en la API y en «Nueva campaña») | 2ab404cbf | en main |
| `punta/api-acciones-octubre` | O19 | 50dd5728c | en main (primero choque de mezcla con main, unido) |
| `punta/octubre-crm-perfil` | O21, O44, O45 | c06b5d14a | en main |
| `punta/crm-pedidos-chicos` | seis de O47 | 0a64e2439 | en main |

Un revisor independiente contrastó contra `origin/main` todo lo que se dio por hecho; tres faltas que encontró se arreglaron en
las puntas de segunda vuelta (`movil-chats-linea`, `dashboard-funnel-agrupado`, `ads-nomenclatura`).
