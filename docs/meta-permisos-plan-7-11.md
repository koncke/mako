# Meta: qué permisos faltan y cómo se piden en UNA sola revisión (7/11/2026)

**Pedido de Martín, 7/11:** «manda a revisión cuanto antes el tema de Meta, y de paso pensá en
absolutamente todas las cosas que vamos a necesitar de permisos, para no tener que volver a pasar
por esta revisión».

Todo lo de acá está **medido en la consola el 7/11**, no deducido.

## 1. Lo que el tablero decía y es falso

`docs/pendientes-martin.md` y la memoria `meta-oauth-app-review` dicen «Revisión de la app: **Sin
enviar**. Nunca se mandó» y «Martín decidió el 26/10 NO mandarla». **Las dos quedaron viejas.**

| | Estado real, 7/11 |
|---|---|
| Negocio MaKo (`493711571134922`) | **Verificado** |
| App (`2586146911825340`) | **Publicada**, en producción desde el 7/10 |
| Revisión de la app | **Enviada el 21/10, APROBADA el 4/11** |
| Permisos aprobados | `pages_show_list`, `pages_read_engagement`, `public_profile`, `leads_retrieval` |
| Renovación del acceso a los datos | **Completada el 4/11** |
| Verificación de acceso (proveedor de tecnología) | Enviada el 8/10, sin alerta de cierre |

## 2. Lo que NO está, y es exactamente lo que hace Zernio

En el caso de uso «Crea y administra anuncios con la API de marketing»:

| Permiso | Estado hoy | Qué significa |
|---|---|---|
| `ads_management` | **Listo para prueba** (16 llamadas) | acceso ESTÁNDAR: anda para quien tiene un rol en la app, **no para el negocio de un cliente** |
| `ads_read` | **Listo para prueba** (13) | ídem |
| `business_management` | **Listo para prueba** (6) | ídem |
| `pages_manage_ads` | **Listo para prueba** | ídem |
| `catalog_management` | Añadir a la revisión | sin usar hoy |
| **Marketing API Access Tier** | **Acceso limitado (462)** | **el techo real**: sin subirlo, no hay cuentas publicitarias ilimitadas ni límites de frecuencia de producción |

Y **no están en NINGÚN caso de uso configurado** —hay que agregar el caso de uso primero—:
`instagram_basic`, `instagram_manage_messages` (los DM de Instagram), `pages_messaging` (Messenger),
`pages_manage_metadata` (suscribir webhooks), `whatsapp_business_management` y
`whatsapp_business_messaging`.

## 3. ⚠️ El mecanismo de Meta CAMBIÓ, y esto es lo que más tiempo ahorra

**«Listo para prueba» no es un estado pasivo: es una prueba que hay que pasar.** Meta ya no toma una
solicitud de acceso avanzado sin **llamadas reales y exitosas con ese permiso**. Los contadores
(16, 13, 6) son esas llamadas, que MaKo ya hace en producción.

De la propia pantalla de Tests:
- «Si el test se lleva a cabo correctamente, los datos pueden tardar hasta **24 horas** en mostrarse».
- «**Los tests tienen una validez de 30 días**».

**La consecuencia práctica:** un permiso que MaKo todavía no llama no se puede pedir, por más que se
escriba la justificación. Primero el código lo usa, después se pide. Los dos casos de uso figuran
hoy como «Test en curso».

## 4. Qué permiso necesita cada parte del producto (sacado del código)

| Módulo | Qué hace | Permiso |
|---|---|---|
| `lib/meta-ads.ts` | lee `/insights` de campañas, conjuntos y anuncios | `ads_read` |
| `lib/meta-write.ts` | cambia nombre, presupuesto y estado; borra | `ads_management` |
| `lib/meta-ads-create.ts` | crea campañas, conjuntos, anuncios y creativos | `ads_management` |
| `lib/meta-health.ts` | estado de entrega en vivo, `issues_info` | `ads_read` |
| `lib/meta-descubrir.ts` | con UN token completa cuenta, página, píxel y WABA | `business_management` |
| `lib/meta-leads.ts` | los leads de los formularios | `leads_retrieval` ✅ + `pages_manage_ads` |
| `lib/meta-capi.ts` | eventos al píxel (Conversions API) | `ads_management` |
| `lib/meta-templates.ts` | plantillas de WhatsApp en la WABA | `whatsapp_business_management` |
| `lib/instagram-perfil-server.ts` | lee un perfil de Instagram por su @ | `instagram_basic` |
| `lib/mako-salida-drivers.ts` | mensajes salientes | hoy **Evolution**, no la API oficial |

## 5. ⚠️ Por qué «pedir absolutamente todo» es lo que haría FALLAR la revisión

Es lo contrario de lo que suena. **Meta revisa permiso por permiso, y uno que no se puede demostrar
hunde el lote entero.** Dos casos concretos acá:

1. **`whatsapp_business_messaging`.** MaKo manda por **Evolution, que no es la API oficial**
   (`lib/mako-salida-drivers.ts` lo dice en su cabecera). Pedir ese permiso sería declarar algo que
   el producto no hace. Es exactamente el tipo de cosa por la que Creem cerró la tienda.
2. **`instagram_manage_messages`.** Hoy no hay una sola llamada: el contador de prueba sería 0 y
   Meta no lo toma (§3).

**La regla que queda: en Meta no se pide lo que se va a usar, se pide lo que ya se está usando.**
Primero el código hace la llamada, la prueba se registra en 24 h, y recién ahí entra a la revisión.

## 6. El plan, en orden

**Tanda 1 — ahora, y es la que suelta a Zernio para anuncios.** Todo esto ya tiene llamadas hechas:
`ads_management`, `ads_read`, `business_management`, `pages_manage_ads`, y la subida del
**Marketing API Access Tier**. Es lo que permite crear y leer anuncios de la cuenta de un cliente.

**Tanda 2 — cuando el código las llame.** `instagram_basic` primero (el lector de perfiles ya existe
y sólo falta que pase por la app, no por el raspado), y después los DM de Instagram y Messenger:
hay que agregar el caso de uso, escribir el código que los llame, dejar que la prueba se registre, y
recién ahí pedirlos.

**Lo que NO se pide nunca mientras MaKo use Evolution:** `whatsapp_business_messaging`.
