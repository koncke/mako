# El onboarding de Madgicx, capturado por Martín (25/10/2026)

Martín, 25/10/2026: «Te voy adjuntando capturas del onboarding para que lo puedas copiar tambien» y «Guarda las capturas del
onboarding, porque tambien lo podemos copiar». Las sacó él mismo al conectar Madgicx con su cuenta, primero sobre «Cuenta 2» de
Elévate (Mauricio) y después sobre la cuenta publicitaria de MaKo (`act_1426493815659364`), que es con la que quedó conectado.
Se copia la estructura y el flujo; los colores son los de MaKo (memoria `media-buyer-ia-reemplaza-ads-manager`).

| # | Archivo | Qué es | En MaKo |
|---|---|---|---|
| 1 | `01-conectar-facebook.png` | «Connect Facebook»: modal centrado, el logo en círculos concéntricos, «Free trial, fast setup» y un solo botón | «Conectar con Facebook» por la ventana de Zernio |
| 2 | `02-facebook-acceso.png` | La ventana de Facebook: «Madgicx solicita acceso a: Nombre y foto del perfil», «Continuar como…» | La ventana de Zernio (la arma el chat «Zernio y CAPI») |
| 3 | `03-facebook-permisos.png` | Facebook pide catálogos, anuncios, estadísticas, empresa, Instagram, leads y páginas | Los permisos de la conexión `metaads` de Zernio |
| 4 | `04-tarjeta-prueba-7-dias.webp` | «One more thing»: tarjeta para la prueba de 7 días, con Stripe y Argentina | Lo resuelve la prueba gratis de MaKo (Planes): no va en este onboarding |
| 5 | `05-configurar-espacio.png` | «Set up your workspace»: nombre, Brand o Agency, teléfono y email | MaKo ya lo sabe del negocio: no se pregunta |
| 6 | `06-condiciones-meta-pendientes.webp` | «Review & Accept Meta Terms of Service»: audiencias por lista de clientes (Not accepted) y Business Tools (Accepted), cada una con «Open on Facebook» | Sí va: las condiciones que necesite el Media Buyer, con su estado leído de Meta |
| 7 | `07-condiciones-audiencias-facebook.webp` | La página de Facebook de las condiciones de audiencias personalizadas, «Aceptar» en nombre del negocio | El link que abre MaKo |
| 8 | `08-condiciones-meta-una-aceptada.webp` | Las condiciones con una pendiente y «Continue» apagado | Igual |
| 9 | `09-condiciones-meta-todas-aceptadas.webp` | «All set»: las dos aceptadas y «Continue» prendido | Igual |
| 10 | `10-metricas-principales.webp` | «What are your 2nd and 3rd Top Metrics?»: dos desplegables (Cost per Purchase, Cost per Add to Cart) «para mejorar el tablero» | El KPI y las métricas del Media Buyer (lead, agenda, venta del CRM) |
| 11 | `11-confirmar-activos.webp` | «Confirm Your Social Assets»: industria, subindustria, página, Instagram y píxel por defecto; «Finish» | Página, Instagram y píxel por defecto; la industria sale del negocio |

**La trampa que salió al capturarlo:** las condiciones de audiencias se aceptan EN NOMBRE DEL NEGOCIO dueño de la cuenta
publicitaria. Aceptarlas para el negocio MaKo no las acepta para «Cuenta 2» de Elévate, y Madgicx mira la cuenta que tiene
elegida. En «Cuenta 2» (frenada por saldo impago desde el 15/10), aceptarlas dio «Permisos no válidos», aun con la sesión de
Mauricio.

La primera versión del Media Buyer de MaKo, la que Martín rechazó («no creo que la interfaz de madgicx se vea así de fea, con
tantos botones, no se entiende»), está en `../../mako/v1-rechazada-por-martin.png`.
