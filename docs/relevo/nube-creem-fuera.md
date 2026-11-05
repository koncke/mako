# Creem fuera de MaKo: el rechazo de la tienda (nube, 5/11/2026)

> Lo escribió la sesión de la nube que hizo el trabajo (cuenta `nube`, sesión `cli_ddaacca1-208e-53dc-99ff-46bc4a848a7e`), en la
> rama `claude/sweet-franklin-lblq62`, subida a `punta/creem-fuera`. Es de primera mano: lo que digo que medí, lo medí acá. Esta
> sesión no ve producción ni puede escribirle al Cerebro: lo que le toca, está abajo.

## Lo pedido (el encargo, textual)

> Creem rechazó de forma definitiva, el 5/11/2026, la tienda de MaKo. La plataforma ya no tiene sus claves, y se va a pasar a otro
> proveedor todavía sin elegir. El sitio y el código siguen diciendo que Creem procesa los pagos y modera los pedidos, y eso ya no
> es verdad.
>
> Sacá a Creem de lo que MaKo dice y hace hoy, sin borrar el código de la pasarela, que puede servir para otro proveedor. Primero
> `git fetch origin` y mirá `origin/punta/creem-legales`, que puede no haber entrado: partí de main con eso adentro.
> 1. **Legales:** `/terminos`, `/privacidad`, `/reembolsos`, `/soporte` y `/aup` no pueden nombrar a Creem como quien procesa
>    pagos, vende o modera. Lo demás de `/aup`, la cláusula de contenido sexual, la de producto independiente y lo de las
>    grabaciones se queda. Actualizá las fechas. Si algún test fija esos textos, corregilo.
> 2. **Moderación:** `encolar` en `lib/flow-cola.ts` no puede frenar ni abrir tickets porque falte la clave de Creem: sin clave,
>    la moderación no corre, en silencio, y se genera. Dejá el módulo listo para otro proveedor, sin llamar a Creem.
> 3. **Checkout:** que `pasarelasDelPais` y `/planes` queden bien para LATAM fuera de Argentina sin Creem: si no hay pasarela para
>    ese país, sale el pedido de datos que ya existe (`TEXTO_SIN_PASARELA`), nunca un error. Probalo con un test.
> 4. **Vigía:** el ítem `creem-tienda` de `lib/vigia-aprobaciones.ts` pasa a decir rechazada el 5/11/2026 y definitivo, o se saca
>    si `punta/approvals` ya lo cambió: mirá esa rama.
> 5. **Cosecha:** en `docs/hallazgos-planes-y-cobro.md` y `docs/creem-retiros.md`, con el índice: rechazada a las pocas horas de
>    enviarla; el mail no da el motivo; su documentación dice que se decide por categoría o por señales de riesgo y que otra tienda
>    del mismo negocio llega a lo mismo; y sus términos, §20.6, no reabren a personas conectadas si Creem cerró la cuenta.

## Lo hecho

| Commit | Qué |
|---|---|
| `b667753e2` | **Legales sin Creem.** Términos, privacidad, reembolsos y soporte nombran sólo a Stripe y Mercado Pago. /aup y los términos ya no dicen que «el pedido se revisa solo»: dicen que Google Flow tiene sus propios filtros (es lo único que pasa). /soporte no enlaza /reembolsos (es ruta de venta en la app de iPhone). La cláusula de contenido sexual, la de producto independiente y la de las grabaciones, intactas. Fechas: «5 de noviembre de 2026» (ya decían eso: lo de Creem se había escrito hoy). |
| `43a936e50` | **Moderación sin proveedor.** `PROVEEDOR_DE_MODERACION = null` (lib/creem-moderacion-reglas.ts): `encolar` genera sin leer el workspace ni una clave, sin red, sin fila de uso y sin ticket. Antes, sin la clave, cada imagen o video abría un error de la app «ModeracionCreem». El motor es de cualquier proveedor (`ProveedorModeracion`); el de Creem queda de molde (`CREEM`) y un test da rojo si alguien lo vuelve a poner. Sin clave de un proveedor elegido: en silencio. Con la clave RECHAZADA: sí registra el error (eso es nuestro). |
| `3f8f17c53` | **Planes desde LatAm sin Creem.** `pasarelasDelPais` elige en LatAm por capacidad (`merchantOfRecord`), no por el nombre: sin un merchant of record, Stripe si está; si no, ninguna, y la página del plan pide los datos. Una compra de una pestaña de antes (con `pasarela: 'creem'`) ya no contesta 503 con el texto como error: `iniciarCompraDePlan` la toma como pedido (`pedirPlanSinPasarela`) y el formulario dice «¡Listo! Recibimos tu pedido». |
| merge de `origin/punta/vigia-creem` + `dfe23614a` | **Vigía.** El ítem `creem-tienda` sólo existía en `punta/vigia-creem` (sin mergear; `punta/approvals` no existe, y `punta/vigia-aprobaciones` no lo toca): lo traje y lo cambié. Nombre y nota dicen rechazada el 5/11/2026 y definitiva; el «qué hacer» apunta a docs/creem-retiros.md y no manda a contestarle a Creem. Sigue «a mano»: probé devolver «rechazado» fijo y dio 2 rojos en `tests/vigia-aprobaciones-fuentes.test.ts` (un lector sin red no inventa un estado, regla 3). |
| (este commit) | Cosecha: `docs/hallazgos-planes-y-cobro.md` («Creem rechazó la tienda de MaKo, y es definitivo»), `docs/creem-retiros.md` (el cartel arriba y «El rechazo» al final), el índice, `docs/pendientes.md` (la sección de Creem cerrada, la fila y M3), el aviso en `docs/relevo/nube-creem-revision.md`, la bitácora de /admin/dev (payment-gateway) y este relevo. |

**Probado:** `tests/creem-revision-sitio.test.ts` (7, roto 4 veces), `tests/creem-moderacion.test.ts` (10, roto 8 veces, con la
cola real), `tests/planes-latam-sin-creem.test.ts` (3, nuevo, con la ruta real; roto 3 veces), `tests/vigia-aprobaciones.test.ts`
(14, roto 2 veces) y los vecinos del checkout en verde (creem-pasarela, planes-stripe-afuera, planes-sin-pasarela, agencia-cobro,
agencia-plan-y-pais, cobro-lanzamiento, prueba-plan, compra-plan, primer-mes, partners-codigo-editable, revision-plata-agency-2910).
El veredicto (`scripts/veredicto.mjs`) va en el último commit.

## ⚠️ Lo que NO pude leer

**docs.creem.io y creem.io no resuelven desde esta sesión** (la red de la nube no los deja). Lo de la cosecha sobre cómo decide
Creem y el §20.6 sale del encargo, que los leyó: no lo releí. Está dicho así en los dos documentos.

## Lo que le toca al Cerebro

1. **AGENTS.md quedó viejo en una sección:** «Lo que genera imagen o video pasa por `encolar`, que lo modera con Creem (5/11/2026)».
   Dice que Creem exige la moderación y que cada llamada queda medida como `creem`. La regla operativa sigue valiendo (lo que genera
   pasa por `encolar` con el prompt final en `pedido.prompt`, y muestra el `RechazoDeModeracion`), pero la premisa no. No lo toqué:
   es la configuración que leen todos los chats y llegó por otra sesión. Propuesta de texto:
   > **Lo que genera imagen o video pasa por `encolar`, con el prompt FINAL en `pedido.prompt` (5/11/2026).** Ahí corre la
   > moderación (lib/creem-moderacion-reglas.ts) y el permiso de IA de la app de iPhone. Hoy no modera nadie: Creem cerró la
   > tienda y `PROVEEDOR_DE_MODERACION` vale null. Un camino nuevo que genere desde un texto pasa por ahí y muestra el
   > `RechazoDeModeracion` tal cual; uno por fuera de la cola lleva `moderarPrompt` antes. Un proveedor nuevo se enchufa como
   > `ProveedorModeracion`, nunca `CREEM`, y vuelve a nombrarse en /terminos, /aup y /privacidad.
2. **Los términos y la privacidad nombran a Stripe** como quien cobra fuera de Argentina, como ya lo hacían. Pero `docs/pendientes.md`
   (M3, 30/10) dice que Stripe no es opción para la cuenta de MaKo («Argentina no es país habilitado»). Si la plataforma no tiene
   Stripe conectado, esas dos frases nombran a Stripe de más: hoy sólo cobra Mercado Pago, desde Argentina. Medirlo (credenciales
   del negocio 9) y, si no hay Stripe, dejar «Mercado Pago» solo hasta el próximo proveedor.
3. **Las claves de Creem del negocio 9** (`CREEM_API_KEY`, `CREEM_WEBHOOK_ID`, `CREEM_WEBHOOK_SECRET`, guardadas el 31/10): el
   encargo dice que ya no están, y todo lo de arriba se apoya en eso. **Verificarlo es lo primero:** si siguen, desconectarlas
   desde /integraciones de la plataforma. Con ellas puestas, Creem vuelve a estar «conectada» para `pasarelasConectadas(9)`, y la
   ofrecerían `/planes` en LatAm (`monedasDeLaPlataforma`), el cobro de las agencias (lib/agencia-cobro.ts), la venta a mano
   (lib/vender-plan.ts, /admin/cobros) y la API: un cobro contra una tienda cerrada falla. No lo filtré por nombre en el código a
   propósito: `pasarelasConectadas` es la de todos los negocios, y un negocio puede tener su propia cuenta de Creem. El aviso
   registrado a hola-mako.com/api/webhooks/creem queda sin uso.
4. **El próximo proveedor lo elige Martín** (las alternativas medidas: docs/estrategia-financiera-mako.md, Paddle, Dodo, Polar,
   dLocal Go). Si pide moderación, se enchufa con el molde de `CREEM` y las legales lo vuelven a nombrar. Si es merchant of record,
   entra en LatAm solo, por su capacidad.
5. **Lo que quedó de Creem para los NEGOCIOS** (un negocio que cobra a sus clientes con su propia cuenta de Creem): la tarjeta de
   /integraciones, el webhook, `lib/creem-api.ts` y los cobros. No lo toqué: el rechazo es de la tienda de MaKo, no de la
   integración de un cliente, y el encargo pidió no borrar el código de la pasarela. Si Martín quiere sacar también esa opción a
   los negocios, es otra decisión.
6. **`punta/vigia-creem` va adentro de esta punta** (el merge): cuando su propia corrida la vea, ya va a estar en main.
