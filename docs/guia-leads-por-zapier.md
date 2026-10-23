# Leads de Meta por Make o Zapier

(El archivo conserva su nombre por los links; la tarjeta de Integraciones es **«Leads de Meta por Make o Zapier»**.)

Para un negocio que NO conectó Meta con una app propia: sus leads de formularios instantáneos no llegan a MaKo solos.
Con un escenario de **Make** (el camino principal, desde el plan Core) o un Zap de **Zapier** (desde el plan Professional), cada lead nuevo
se manda a MaKo y entra al CRM como uno que viene de Meta: mismo origen, sin duplicar si la persona ya estaba, y con sus
avisos y automatizaciones.

**Cada negocio usa SU PROPIA cuenta** de Make (o de Zapier), como con sus claves de IA. **Las dos son de pago** y las paga el negocio:
MaKo no paga ni comparte ninguna.

> ⚠️ Lo medido y lo que no. **NO medido con una cuenta de Make ni con un Zap real:** los nombres exactos de los campos que manda
> «Watch Leads» (MaKo los lee por significado y devuelve en `sin_usar` lo que no usó), si «Watch Leads» es instantáneo, y si
> una corrida vacía gasta créditos. **La pantalla no promete «al instante» ni cuántos leads aguanta cada plan, y no dice «gratis».** Antes de ofrecerlo a
> todos, probarlo con un negocio real (lo arma Martín: los clics de Facebook son suyos).

## Antes de empezar

- Ser administrador de la página de Facebook, tener su formulario instantáneo publicado, y una cuenta de **Facebook Business
  Manager**.
- Una cuenta de **Make** (plan Core o superior) o de **Zapier** (plan Professional o superior). Las dos son de pago: el negocio
  las paga, no MaKo.

## Los pasos con Make (15 a 30 minutos)

1. **En MaKo:** Integraciones → «Leads de Meta por Make o Zapier» → escribe en «Clave del aviso» una clave larga que inventes
   (12 caracteres o más). Guárdala. Es lo único que dice de quién es el aviso: no la compartas.
2. **En Meta:** entra a `business.facebook.com/settings/leads-accesses` (Settings → Integrations → Leads Access) y, en
   **CRMs → Assign CRMs**, marca la app **«Make»**. Es el paso que más falla. Fuente oficial:
   <https://apps.make.com/facebook-lead-ads>.
3. **En Make:** crea un escenario con el módulo «Facebook Lead Ads» → **«Watch Leads»** (tu página y tu formulario) y, a
   continuación, **«HTTP» → «Make a request»**.
4. **El módulo HTTP** (los nombres de las opciones de Make, de memoria y sin cuenta a mano: ajústalos a lo que ves):
   - **URL:** la que muestra el recuadro amarillo de la tarjeta (`…/api/webhooks/zapier`).
   - **Método:** POST. **Body type:** Raw, **Content type:** JSON.
   - **Headers:** `X-MaKo-Clave` = la clave del paso 1.
   - **Request content:** un JSON con los datos del lead (abajo).
5. **Ejecuta el escenario una vez** (con un lead de prueba de Meta) y mira la tarjeta: pasa a «Último lead hace…». Si el lead de
   prueba es falso, bórralo del CRM. Después **activa el escenario**.

Si editas el formulario en Meta, Facebook crea uno nuevo: elígelo otra vez en «Watch Leads».

### Los datos que MaKo entiende (qué mapear en el JSON de Make)

MaKo busca por significado, no por un nombre fijo. Lo único obligatorio es un **email o un teléfono válido**.

| Clave del JSON | Qué mapear |
|---|---|
| `email`, `phone_number`, `full_name` | el contacto (también `first_name` + `last_name`, `whatsapp`) |
| `lead_id` | el ID del lead de Meta (15 a 17 dígitos): evita duplicar si el lead entra después por Meta |
| `created_time` | la fecha del formulario (ISO). Si tiene más de 24 horas el lead entra callado, sin avisos |
| `campaign_name`, `ad_name`, `adset_name` (y `campaign_id`, `ad_id`, `adset_id`) | de dónde vino |
| cualquier otra clave | una pregunta del formulario: queda en la ficha del lead |

También acepta `field_data` tal cual la entrega Meta (`[{ "name": …, "values": […] }]`). Lo que MaKo lee y no usa (ids de página
o de formulario, la plataforma) vuelve en `sin_usar`.

## Con Zapier (alternativa, de pago)

1. **En Meta**, el paso 2 de arriba, pero con la app **«Zapier»** (no «Zapier Inc.»). Si cambias permisos después, crea una
   conexión nueva dentro del Zap y publícalo.
2. **En Zapier:** un Zap con el trigger «Facebook Lead Ads» → «New Lead» (tu página y tu formulario). **Un Zap por formulario**:
   cada uno manda los datos con otra estructura.
3. **Acción:** «Webhooks by Zapier» → «POST». **URL:** la de la tarjeta. **Payload Type:** JSON. **Data:** vacío (Zapier manda
   todos los campos del paso anterior). **Headers:** `X-MaKo-Clave` = la clave.
4. **Probar el paso** y **publicar el Zap**.

## Cuánto cuesta (leído el 23/10/2026)

**Make: el mínimo que se ofrece es Core.**

- Precios leídos por el Cerebro en un navegador el 23/10/2026 (la página los dibuja JavaScript; yo no la pude leer sin él):
  <https://www.make.com/pricing>. **Core: US$9 al mes** (el precio que muestra es con el descuento anual del 15%), con
  escenarios activos ilimitados y programación al minuto. Pro: US$16. Teams: US$29. Las únicas apps fuera de los planes comunes
  son las «Enterprise apps» (Workday, Coupa, ServiceNow…): Facebook Lead Ads no es una de ellas.
- **El plan Free de Make no se ofrece.** Es US$0, con 1.000 créditos al mes y 15 minutos de intervalo mínimo entre corridas.
  Martín (23/10/2026): no trae la integración API y no sirve. Lo que dice Make: «Most Make API endpoints are reserved for our
  paid subscription plans and may not be accessible on the free tier» (<https://developers.make.com/api-documentation>; es su
  API de gestión, no el módulo HTTP). La página del módulo HTTP (<https://apps.make.com/http>) no nombra ningún plan: si «Make a
  request» manda el POST en Free queda SIN confirmar, ni a favor ni en contra, y no se ofrece.
- La página oficial del módulo (<https://apps.make.com/facebook-lead-ads>) no pide un plan determinado, pero sí una cuenta de
  Facebook Business Manager.
- **Sin medir (1): ¿el lead llega al instante o por intervalo?** En la página del módulo, «Watch Leads» aparece SIN la etiqueta
  de instantáneo; si corre por intervalo, el lead llega con el retraso que fije el plan (Core permite programarlo al minuto). Para
  un negocio que llama al lead en el momento, eso importa.
- **Sin medir (2): ¿una corrida vacía gasta crédito?** La ayuda oficial de Make no lo dice (<https://help.make.com/credits>); una
  fuente de su comunidad dice que cada corrida gasta al menos uno. Si es así, programarlo al minuto son ~43.000 corridas al mes
  (a 15 minutos, ~2.900) contra los créditos del plan (10.000 en Core según terceros, NO verificado). Hasta medirlo con una
  cuenta, no se recomienda un intervalo corto.
**Zapier: el mínimo es Professional.**

- «Facebook Lead Ads is a premium app on Zapier.» Está en Professional, Team y Enterprise; el plan Free figura como no
  incluido, y entre los requisitos: «A paid Zapier account». Ayuda oficial, actualizada el 01/10/2026:
  <https://help.zapier.com/hc/en-us/articles/8496061306253>
- El paso «Webhooks by Zapier» (el POST a MaKo) tampoco está en Free: «Connections via webhooks» figura solo en Professional,
  Team y Enterprise. Precios oficiales, actualizados el 23/10/2026: <https://zapier.com/pricing>
- **Plan mínimo: Professional, desde US$19,99 al mes con facturación anual (US$29,99 si se paga mes a mes), con 750 tareas
  al mes.** Los precios son en dólares; Zapier cobra en 19 monedas locales al cambio del día. Cada lead gasta tareas del plan.

**Para el domingo:** los DOS caminos son de pago y los paga el negocio con su propia cuenta: Make desde Core (US$9 al mes) y
Zapier desde Professional (US$19,99 al mes con facturación anual, US$29,99 mes a mes). Make es el principal. No se promete que
el lead llegue «al instante» ni cuántos leads aguanta un plan.

## Qué contesta MaKo (se ve en el historial de Make o de Zapier)

| Respuesta | Qué es |
|---|---|
| 200 `creado` / `actualizado` | Entró. `actualizado` es la misma persona (o un reintento): no se duplica. `sin_usar` lista lo que MaKo leyó y no usó. |
| 401 `clave` | La clave del header no es la de MaKo (o no hay). |
| 422 `sin_contacto` | El lead no trae email ni teléfono válidos: el escenario está mal mapeado. Make y Zapier lo marcan como error a propósito. |
| 400 `bad_json` | El cuerpo no es JSON ni un formulario. Revisa el «Content type» (Make) o el «Payload Type» (Zapier). |
| 503 `reintentar` | La base no contestó: se reintenta solo. |

## Cómo se entera MaKo de que se cortó

El puente vive en la cuenta de un tercero: si el negocio deja de pagar el plan o apaga el escenario, no llega nada y nada lo
dice. La tarjeta muestra «Último lead hace…» y se pone ámbar a las **72 horas** sin leads («Revisa tu escenario de Make o tu
Zap»), y la grilla la deja en «Requiere tu atención». Un negocio con pocos leads por semana puede cruzar el umbral sin que pase
nada; uno que nunca recibió un lead aparece «Esperando tu primer lead», no caído. **Falta el aviso por WhatsApp** (ver
hallazgos).

Dónde vive: `lib/zapier-lead.ts` (el lector), `lib/zapier-leads.ts` (la puerta), `lib/zapier-estado.ts` (la tarjeta),
`app/api/webhooks/zapier/route.ts`, `tests/zapier-leads.test.ts`. El porqué de cada decisión:
`docs/hallazgos-integraciones.md` → «El puente de leads de Meta por Zapier o Make».
