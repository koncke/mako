# CRM — lo que sigue pendiente de la tanda B1 (traspaso del 17/10/2026)

> **Qué es esto.** El volcado `crm-tanda-b1.md` (14/10, 86 KB) tenía el contrato, los commits, los inventarios de tests, la
> revisión y los pendientes de los cinco frentes de la tanda B1 del CRM, mezclados. Se borró el 17/10 porque sus pendientes
> viejos confundían: la mitad ya estaba hecha. Su texto completo queda en la historia (`git show 86bc162be:docs/relevo/crm-tanda-b1.md`).
>
> **Adónde fue cada parte.** Contratos → cabecera de cada módulo (`lib/ficha/*`, `lib/pagos-campo.ts`, `lib/nuevo-crm.ts`,
> `lib/mako-ficha-lead.ts`). Commits → git. Tests → cada test. Hallazgos → `docs/hallazgos-crm.md`, «Lo que sobrevive del
> volcado de la tanda B1». Las fallas de la revisión de b2 (2 altas, 8 medias, 6 bajas) están **arregladas** (`c27eb4323`,
> `906c36467`, `fca716101`, `9df9e6817`, `05bc31391` y los tests `pagos-medias-b2` / `pagos-bajas-b2`). **Lo que sigue
> vigente está abajo**, medido contra el árbol el 17/10 (no recordado), con el archivo donde vive. Lo que cerró la API de MaKo ese
> día (`marcar_pago_cobrado` y `registrar_pago_suelto` con moneda, `cobranza_lead` y `ficha_lead` descritos, «cambiale el
> vencimiento a la cuota 3», el tope de `ficha_lead`) está en `docs/hallazgos-api-mako.md`, no acá.
>
> Los títulos conservan los nombres del volcado (`b1`, `b2`, `b3`, `b4`) para que los renglones de `docs/pendientes.md` que
> los citan sigan ubicándose.

## b1 · motor de la ficha por bloques

- **La ficha de un funnel no deja rastro de quién la cambió ni cómo deshacerla.** `cambiarFichaFunnelAction`
  (app/crm/ficha-actions.ts) sólo hace un `console.info` y devuelve `antes` para `{op:'restaurar'}`. Hace falta una tabla
  (por ejemplo `funnel_audit`, o el pedido «registro de TODAS las acciones de usuario») con migración. Medido: ningún
  `funnel_audit` en `lib/`, `app/` ni `supabase/`.
- **`pendientes_ignorados` todavía se escribe** en `app/crm/actions.ts` (`ignorarPendientesAction` ~1488, la de lote ~1506 y
  `reactivarPendientesAction` ~1520). Hay que pasarlas a `escribirDatosIgnorados(leadId, IGNORABLES, …)`
  (lib/datos-aviso-config.ts, como la API), convertir las filas viejas con una migración de datos
  (`datos_ignorados` = todos los ignorables, `pendientes_ignorados` = null) y recién entonces borrar la columna: hoy la leen
  `ignoradosDelLead` y el loop de «Ver más» de lib/queries.ts.
- `TAB_DE_DATO` sigue exportado en lib/datos-aviso.ts:198 aunque el armador nuevo (`app/crm/lead-view/ficha/armar.ts`) lo
  reemplaza con `dondeSeCompleta`: borrarlo si nadie lo importa.
- *Sin re-medir:* la cabecera de la ficha y el worklist calculan los faltantes con insumos distintos (`app/crm/[id]/page.tsx`
  no pasa `grabable` y usa `pagos.length > 0 ? true : undefined`; app/crm/actions.ts y el worklist usan `pagos.length > 0` y
  `grabable`): el plan y el Fathom pueden dar distinto. El armador nuevo pudo cerrarlo.

## b2 · Pagos campo por campo

- **`DealDetailsCard` (y la ficha de CS que la monta) todavía cuenta con la cuenta local, no con `cobradoDelLead`**
  (lib/cobrado-lead.ts): sigue diciendo «Pagada por completo» en una mensualidad activa y pintando en verde una renovación
  rechazada. Medido: ni `app/crm/[id]/DealDetailsCard.tsx` ni `app/customer-success/FichaPestanas.tsx` nombran `cobradoDelLead`.
  Cuando la tab Pagos de la ficha y la de CS pasen a bloques, se borra «Editar deal» y esto desaparece.
- **No hay pantalla para elegir la moneda del negocio** (`/configuraciones`): existen `monedaDelNegocioAction` y
  `guardarMonedaNegocioAction` (admin, app/crm/[id]/pagos-campo-actions.ts) y sólo se cambia pidiéndoselo a MaKo
  (`cambiar_moneda_negocio`). El valor inicial al cargar un pago a mano ya lo usa la tab Pagos (`ficha/pagos/datos.ts`).
- **`saveIdentidadFiscalAction` / `deleteIdentidadFiscalAction`** (app/crm/[id]/deal-actions.ts) sólo piden sesión: cualquiera del
  equipo puede borrar o cambiar la razón social con la que se factura. Falta decidir si, por ser config del negocio, son sólo
  del admin.
- **La próxima renovación de una suscripción se proyecta desde `fecha_cierre`**, no desde la fecha que manda Stripe o Mercado
  Pago (`cobradoDelLead`). Hay que guardar la que manda la pasarela (§5 del diseño de la ficha).
- *Sin re-medir:* `getOutstandingTotal` (lib/pagos.ts ~1070) y `getOutstandingPeriodo` pueden no coincidir con las cuotas
  devueltas (`esCuotaDevuelta`); la nueva sí las excluye.
- `Lead` (lib/leads.ts) no declara `suscripcion_cancelada_at`: hoy se lee con un cast.

## b3 · «Nuevo CRM»

- **`crearProductoAction` (app/crm/actions.ts ~886) sigue sin ningún llamador y sin `haySesion` ni corte de rol:** sin cookie,
  `getTenantDb` cae al ws1 (Mauricio) y crearía un producto en su CRM. Borrarla, o ponerle el corte.
- **«Nuevo CRM» se le ofrece a quien no es admin** y recién al final le dice «Solo el administrador puede crear un CRM»
  (app/crm/CrmToolbar.tsx ~761, `opciones.unshift({ value: NUEVA, … })`): hay que pasarle el rol a `SelectorFunnel` y esconderla.
- **Crear un CRM escribe dos veces** (`crearProductoConFunnel` + `saveFunnelDe`, lib/nuevo-crm.ts): si falla la segunda queda sin
  etapas (el alta ya devuelve `etapasDelTipo: false` en vez de tirar). Que `crearProductoConFunnel` reciba
  `{ pipeline, suppressed, extra }` y lo escriba en un solo insert. Y `crearFunnel` (lib/funnels.ts ~622) repite la fórmula de
  `apagadasAlCrear` (lib/pipeline.ts).
- **Medir en producción** `select id, workspace_id from funnels where plantilla = 'vsl'`: esos funnels conservan las claves viejas
  (registro/webinar/checkout) y sus leads con fecha de webinar siguen cayendo en la primera columna.
- *Sin re-medir:* `docs/diseno-ficha-bloques.md` §2 («la falla de la plantilla vsl») y la última fila de la §5 quedaron viejas
  para los funnels nuevos; el modal de «Nuevo CRM» nunca se vio en un navegador (13 opciones en dos columnas, alto fijo
  `min(85vh, 680px)`, una columna en el celular).

## b4 · captura de datos

- **El lead que nace de confirmar una propuesta de la landing queda sin `pagina_registro`:** `Atribucion` y
  `atribucionDePropuesta` (app/crm/revisar/[id]/propuesta-lead.ts) no la copian, aunque `app/api/track/optin/route.ts` la deja
  en la propuesta y su comentario dice «la escribe quien confirma». Copiarla (volver a pasarla por `normalizarUrl`: se lee de
  la base) y que el test **ejecute** la función en vez de buscar la cadena en la ruta. Ojo: el update de
  app/crm/revisar/[id]/acciones.ts nombra las columnas que recibe.
- **Meta manda primero el mensaje del anuncio SIN referral y el referral en el siguiente** (lib/zernio-entrante.ts,
  `procesarEventoSocial`, rama `yaEraLead`): si escucha «Te envía un mensaje» el lead nace con `como: 'mensaje'` y el anuncio se
  pierde. Y el lead que pierde el compare-and-set queda huérfano **con** `meta_ad_id` y el @, así que entra en las métricas por
  anuncio. Arreglo posible: reclamar la fila de la persona antes de crear el lead, o un update compare-and-set de
  `meta_ad_id` / `entrada_social.anuncio_id` con `.is(null)`. Es una escritura más por evento y una decisión de atribución.
- **La etapa «efectiva» de MaKo contradice al tablero para un lead de un producto secundario** (`getFunnelDeLead` devuelve el
  default, lib/funnels.ts ~188): `ficha_lead` y `buscar_leads` dan la derivada del funnel del negocio y `productos_del_lead`
  la del producto. Usar las etapas del funnel del lead (`lead.funnel_id` → `getFunnelDe`), y en `buscar_leads` leerlas una vez
  por cada `funnel_id` distinto. Test: un lead con `funnel_id` secundario y un override que sólo existe ahí tiene que dar ese
  override. Mientras no se haga, las dos descripciones de crm.def.ts no deberían decir «la etapa en la que lo ve el equipo»
  sin matiz.
- *Sin re-medir:* si la persona comentó sin que ninguna automatización escuchara y después escribió por DM, `entrada_social`
  dice «mensaje» y el comentario sobrevive en `ig_conversaciones.comentario_*` sólo hasta el próximo comentario (el bloque
  `publicacion-de-entrada` puede caer a esa fila). Los leads viejos sin `pagina_registro` NO tienen backfill, a propósito
  (por dónde pasó no es dónde se registró). Messenger no tiene columna para el usuario de Facebook.
