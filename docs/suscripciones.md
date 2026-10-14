# Suscripciones: qué pagamos, para qué, y qué se puede dar de baja

**Medido el 13/10/2026.** Pedido de Martín, textual: *«Investigar qué otras apps estamos
pagando y si podemos deprecarlas»*. Una fila por servicio, con una recomendación en cada una.
**Las bajas las decide y las hace Martín** — acá no se da de baja nada.

Los montos de Vercel, Supabase y la IA salen de sus APIs de facturación consultadas hoy; los
demás están marcados como **sin medir** cuando no hay acceso a la cuenta. Un monto sin fuente
es una estimación y lo dice.

---

## El resumen

| | Por mes |
|---|---|
| **Medido hoy** (Vercel + Supabase + IA del producto) | **~US$104** |
| **Sin medir** (Railway, Fathom, Calendly, Panda, Zernio) | **falta acceso** |

Lo más importante de la foto de hoy, y es la noticia buena: **la IA del producto bajó a
US$0,00 en octubre** — 2.608 llamadas, todas en proveedores gratis. Y **el build de Vercel
quedó en cero**: la factura es solo la cuota del plan. Los dos arreglos de agosto se
sostuvieron dos meses.

| Mes | IA del producto |
|---|---|
| junio | US$2,00 |
| julio | US$30,09 |
| agosto | US$48,92 |
| septiembre | US$17,63 |
| **octubre (al 13)** | **US$0,00** |

---

## Infraestructura del producto

| Servicio | Para qué | US$/mes | Recomendación |
|---|---|---|---|
| **Vercel** | Donde vive MaKo | **~20** (medido: 4,26 en 13 días, todo cuota Pro) | **Dejar.** El Build CPU está en **cero**: lo que costaba US$115/mes en agosto ya no se cobra. |
| **Supabase** | La base de MaKo **y** los tableros de clientes de la agencia | **83,68** | **Revisar fila por fila** ↓ |
| **Railway** | **El WhatsApp no oficial** (Evolution API) | **sin medir** — US$21 en agosto, US$5 reportado por Mauricio | **Es el trabajo aparte.** Ver abajo. |
| **IA del producto** | Lo que consume MaKo trabajando | **0,00** | **Dejar como está.** No tocar los `fallback: []` que lo sostienen. |

### Supabase, desglosado

7 proyectos activos × Micro US$9,81 + Pro US$25 − US$10 de crédito = **US$83,68**.

| Proyecto | Qué es | US$/mes |
|---|---|---|
| **MaKo** | El producto, con **todos** sus clientes adentro (una sola base) | 9,81 |
| esquer-accountability | Tablero de un cliente de la agencia | 9,81 |
| baja-teriyaki | ídem | 9,81 |
| texx-accountability | ídem | 9,81 |
| aspro-tableros | ídem | 9,81 |
| **hmo-os** | ídem — **nuevo desde agosto** | 9,81 |
| **sibelco-v2** | ídem — **nuevo desde agosto** | 9,81 |
| CRM-Leads · viral-radar · GB Logistics | **Pausados**, en orgs del plan Free | 0 |

**De los US$83,68, US$9,81 son MaKo y US$58,86 son tableros de clientes de la agencia.** Eso
no es desperdicio de infraestructura: es costo de servicio, y la pregunta es comercial (si
cada cliente lo cubre), no técnica. **Un cliente nuevo de MaKo no suma nada acá** — la base es
una sola y compartida.

---

## Herramientas de la operación

| Servicio | Para qué | US$/mes | Recomendación |
|---|---|---|---|
| **Fathom** | Graba y transcribe reuniones; MaKo lee el texto | sin medir (~18) | **Bajar a gratuito.** Verificado en agosto: el plan free da transcripciones y API ilimitadas; lo único limitado son los resúmenes automáticos, y MaKo no depende de ellos. |
| **Calendly** | La agenda; su webhook dispara la medición del embudo | sin medir (~12) | **Dejar. No se puede bajar:** API y webhooks no existen en el plan gratuito, y sin ese webhook no hay cohortes ni embudo. |
| **Panda Video** | Aloja el VSL | sin medir (~17,90 Bronze) | **Revisar el plan contra el uso real.** Bronze incluye 200 GB y 500 GB de tráfico. |
| **Zernio** | Instagram/Messenger de Automations | sin medir | **Dejar:** está cableado y es BYOK por cliente (su key está en `BYOK_NUNCA_PLATAFORMA`). |
| **Resend** | Emails y reportes | **0** (free, 3.000/mes) | **Dejar.** |
| **Porkbun** | El dominio hola-mako.com | anual | **Dejar.** |

---

## ⚠️ Credenciales que NO usa nadie en el código

Esto es lo que el pedido vino a buscar. **Siete claves viven en `.env.local` y cero archivos de
`lib/`, `app/` o `scripts/` las leen.** Verificado con grep sobre el nombre exacto de cada una.

| Clave | Servicio | Qué hacer |
|---|---|---|
| `SCREENAPP_TOKEN` · `SCREENAPP_TEAM_ID` | ScreenApp | **Verificar si cobra y dar de baja.** Cero referencias. |
| `REPLICATE_API_TOKEN` | Replicate | **Verificar.** Era para imagen/video, que hoy va por el puente a Google Flow. |
| `FAL_KEY` | fal.ai | **Verificar.** Misma razón. |
| `N8N_API_KEY` | n8n | **Verificar.** La nutrición se construyó adentro de MaKo; el n8n viejo quedó afuera. |
| `TELEGRAM_MB_BOT_TOKEN` | Telegram | **Dar de baja.** Decisión ya tomada: *«saquemos de todos lados telegram, no lo quiero»*. |
| `WHOP_API_KEY` · `WHOP_WEBHOOK_SECRET` | Whop | **Verificar.** Cero referencias. |
| `PORKBUN_API_KEY` · `PORKBUN_SECRET_KEY` | Porkbun (su API) | El **dominio se queda**; lo que no se usa es su API. Sin costo propio. |

⚠️ **Una credencial sin uso no siempre es una suscripción paga** — puede ser una cuenta
gratuita olvidada. Por eso la columna dice «verificar» y no «dar de baja»: hay que abrir cada
cuenta y mirar si hay un cobro, y eso lo hace Martín. Lo que esta tabla prueba es que **el
código no las necesita**, así que ninguna baja rompe nada.

---

## Railway: el trabajo aparte

**Lo primero, porque cambia el trabajo entero.** El pedido dice *«construir un sistema de base
de datos para que no tengamos que depender más de Railway»*. **En Railway no hay ninguna base
de datos.** La base es Supabase y no se toca. Lo que corre en Railway es **Evolution API: el
WhatsApp no oficial**, el que se conecta escaneando un QR.

**Y Chatwoot ya no está ahí:** se borró del código el 09/10 (etiqueta
`archivo/chatwoot-2026-10-09`). Si el servicio sigue prendido en Railway, **es gasto puro**, y
es lo primero a chequear al entrar al panel.

### Qué hay vivo hoy

Medido contra el servidor el 13/10: **10 instancias, 6 conectadas**.

| Instancia | Estado | Quién |
|---|---|---|
| `mako_ws1` | conectada | Mauricio Bustos |
| `mako_ws10` | conectada | Leandro Tejado |
| `mako_ws11` | conectada | Leila Fittipaldi |
| `mako_ws13` | conectada | Joan Dowd |
| `mako_superadmin` | conectada | Martín |
| `mako_superadmin_muylqv8r` | conectada | el número propio de MaKo |
| `mako_superadmin_mtxclf3x` | **cerrada** | duplicado del número de Martín |
| `mako_ws9` · `mako_ws13_7ny3qw` · `mako_ws15` | **sin vincular** | basura de pruebas |

**Sacar Railway es mudar el WhatsApp de 6 números, 4 de ellos de clientes.** No es un cambio
de proveedor de base de datos: es infraestructura de clientes en producción, y por eso va con
plan, prueba y vuelta atrás.

**Lo que ata, y es lo único que ata:** el servidor guarda las **sesiones** de WhatsApp (el
resultado de cada QR escaneado). El código le habla por **una línea** (`EVOLUTION_BASE_URL`,
`lib/evolution.ts:41`), así que cambiar de host es cambiar esa variable. Mudar sin migrar el
volumen de sesiones obliga a **todos a re-escanear el QR**.

### Pendiente para avanzar, y necesita a Martín

1. **Acceso a Railway** (un token o una captura del panel): no hay credencial en `.env.local`,
   así que hoy **no se puede medir cuánto cobra ni qué servicios tiene prendidos**.
2. **El cargo de US$5** que Mauricio reportó (Fathom 858473424 @12:28) — hay que ver si es un
   servicio aparte, un excedente o el prorrateo de otra cosa.

---

## Lo que se puede hacer sin esperar a nadie

1. **Borrar las 4 instancias muertas de Evolution.** Liberan memoria y, sobre todo, **el
   duplicado del número de Martín es de los patrones que más rápido hacen que Meta banee un
   número**.
2. **Verificar las 7 credenciales huérfanas** y dar de baja lo que esté pagando.
3. **Fathom a plan gratuito.**

*Documento fechado al 13/10/2026. Los montos marcados «sin medir» necesitan acceso a esas cuentas.*
