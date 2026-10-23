# Leads de Meta por Zapier o Make

Para un negocio que NO conectó Meta con una app propia: sus leads de formularios instantáneos no llegan a MaKo solos.
Con un Zap (o un escenario de Make), cada lead nuevo se manda a MaKo y entra al CRM como uno que viene de Meta: mismo
origen, sin duplicar si la persona ya estaba, y con sus avisos y automatizaciones. Lo paga el negocio (la cuenta de Zapier
o de Make). La tarjeta es **«Leads de Meta por Zapier»**, en Integraciones.

> ⚠️ Lo medido y lo que no. Medido en la ayuda de Zapier el 23/10/2026, **no con un Zap real**: con «Data» vacío manda todos
> los campos del paso anterior; el CRM se asigna en Leads Access; si se edita el formulario, Facebook crea uno nuevo con
> otro id. **NO medido:** los nombres exactos de los campos del trigger (por eso MaKo los lee por significado y devuelve en
> `sin_usar` lo que no usó), la salida de Make, y si la app de Zapier alcanza para páginas de terceros. **Antes de ofrecerlo
> a todos, probarlo con un negocio real** (lo arma Martín: los clics de Facebook son suyos).

## Antes de empezar

- Ser administrador de la página de Facebook, y tener su formulario instantáneo publicado.
- Una cuenta de **Make** (tiene plan gratis) o de **Zapier de pago**. Lo que cuesta lo paga el negocio, no MaKo.

## Cuánto cuesta (leído el 23/10/2026)

**Zapier: el plan gratis NO alcanza. El mínimo es Professional.**

- «Facebook Lead Ads is a premium app on Zapier.» Está en Professional, Team y Enterprise; el plan Free figura como no
  incluido, y entre los requisitos: «A paid Zapier account». Ayuda oficial, actualizada el 01/10/2026:
  <https://help.zapier.com/hc/en-us/articles/8496061306253>
- El paso «Webhooks by Zapier» (el POST a MaKo) tampoco está en Free: «Connections via webhooks» figura solo en Professional,
  Team y Enterprise. Precios oficiales, actualizados el 23/10/2026: <https://zapier.com/pricing>
- **Plan mínimo: Professional, desde US$19,99 al mes con facturación anual (US$29,99 si se paga mes a mes), con 750 tareas
  al mes.** Los precios son en dólares; Zapier cobra en 19 monedas locales al cambio del día. Cada lead gasta tareas del plan.
- Es el MISMO plan para cualquier negocio: no hay un camino gratis en Zapier. Antes de prometerlo, el negocio tiene que saber
  que paga Zapier aparte.

**Make: puede arrancar gratis, con dos cosas sin medir.**

- Precios leídos por el Cerebro en un navegador el 23/10/2026 (la página los dibuja JavaScript; yo no la pude leer sin él):
  <https://www.make.com/pricing>. **Free: US$0, 1.000 créditos al mes, 3.500+ apps, routers y filtros, y 15 minutos de
  intervalo mínimo entre corridas.** Core: US$9 al mes (el precio que muestra es con el descuento anual del 15%), con
  escenarios activos ilimitados y programación al minuto. Pro: US$16. Teams: US$29. Las únicas apps fuera de los planes comunes
  son las «Enterprise apps» (Workday, Coupa, ServiceNow…): Facebook Lead Ads no es una de ellas.
- La página oficial del módulo (<https://apps.make.com/facebook-lead-ads>) no pide un plan determinado, pero sí una cuenta de
  Facebook Business Manager.
- **Sin medir (1): ¿el lead llega al instante o hasta 15 minutos tarde?** En la página del módulo, «Watch Leads» aparece SIN la
  etiqueta de instantáneo; si corre por intervalo, en el plan Free el lead llega hasta 15 minutos tarde. Para un negocio que
  llama al lead en el momento, eso importa: el Core (programación al minuto) lo resuelve.
- **Sin medir (2): ¿cuántos leads alcanzan en Free?** El Cerebro estimó unos 2 créditos por lead (el disparador y el POST a
  MaKo), o sea unos 500 leads al mes. Pero un disparador por intervalo puede gastar un crédito en CADA corrida aunque no haya
  leads (la ayuda oficial de Make no lo dice; una fuente de su comunidad sí): a 15 minutos son unas 2.900 corridas al mes, más
  que los 1.000 créditos del Free. Hasta medirlo con una cuenta, «gratis» es «gratis para probar».

**Para el domingo:** con Zapier se puede prometer, diciendo que cuesta unos US$20 a US$30 al mes y lo paga el negocio. Con
Make se puede ofrecer «arrancar gratis y probar», sin prometer cuántos leads aguanta el plan gratis ni que lleguen al
instante, y diciendo que el plan Core (US$9) es el que lo asegura.

## Los pasos (15 a 30 minutos)

1. **En MaKo:** Integraciones → «Leads de Meta por Zapier» → escribe en «Clave del aviso» una clave larga que inventes
   (12 caracteres o más). Guárdala. Es lo único que dice de quién es el aviso: no la compartas.
2. **En Meta:** entra a `business.facebook.com/settings/leads-accesses` y, en los CRM, asigna la app **«Zapier»** (no «Zapier
   Inc.»). Es el paso que más falla. Si cambias permisos después, crea una conexión nueva dentro del Zap y publícalo.
3. **En Zapier:** crea un Zap con el trigger «Facebook Lead Ads» → «New Lead» (tu página y tu formulario). **Un Zap por
   formulario**: cada uno manda los datos con otra estructura.
4. **Acción:** «Webhooks by Zapier» → «POST».
   - **URL:** la que muestra el recuadro amarillo de la tarjeta (`…/api/webhooks/zapier`).
   - **Payload Type:** JSON.
   - **Data:** vacío (Zapier manda todos los campos del lead).
   - **Headers:** `X-MaKo-Clave` = la clave del paso 1.
5. **Probar el paso.** Zapier manda un lead de muestra o el último real de tu formulario. Si tiene más de 24 horas entra al CRM **callado**
   (sin avisos ni automatizaciones, como un lead rescatado), y la tarjeta pasa a «Último lead hace…». Si el lead de prueba
   es falso, bórralo del CRM.
6. **Publicar el Zap.** Desde ahora cada lead nuevo dispara el aviso, los flujos y las automatizaciones de un lead de Meta.

Si editas el formulario en Meta, Facebook crea uno nuevo: elígelo otra vez en el trigger del Zap, o los leads nuevos no llegan.

## Make

El mismo recorrido: módulo «Facebook Lead Ads» → «Watch Leads», y un módulo **HTTP → «Make a request»**: método POST, URL de la
tarjeta, header `X-MaKo-Clave`, cuerpo JSON con los campos del lead. Make los llama como los mapees; MaKo los lee por
significado (email, teléfono, nombre, campaña, anuncio…). No medido con una cuenta de Make.

**Una diferencia en el paso 2:** en Meta se asigna la app **«Make»** (no «Zapier»), por la misma ruta (Business Manager →
Settings → Integrations → Leads Access → CRMs → Assign CRMs), y hace falta una cuenta de Facebook Business Manager. Fuente
oficial: <https://apps.make.com/facebook-lead-ads>.

## Qué contesta MaKo (se ve en el historial de tareas de Zapier)

| Respuesta | Qué es |
|---|---|
| 200 `creado` / `actualizado` | Entró. `actualizado` es la misma persona (o un reintento): no se duplica. `sin_usar` lista lo que MaKo leyó y no usó. |
| 401 `clave` | La clave del header no es la de MaKo (o no hay). |
| 422 `sin_contacto` | El lead no trae email ni teléfono válidos: el Zap está mal mapeado. Zapier lo marca como error a propósito. |
| 400 `bad_json` | El cuerpo no es JSON ni un formulario. Revisa «Payload Type». |
| 503 `reintentar` | La base no contestó: Zapier lo reintenta solo. |

## Cómo se entera MaKo de que se cortó

El puente vive en la cuenta de un tercero: si el negocio deja de pagar el plan o apaga el Zap, no llega nada y nada lo dice.
La tarjeta muestra «Último lead hace…» y se pone ámbar a las **72 horas** sin leads («Revisa tu Zap»), y la grilla la deja en
«Requiere tu atención». Un negocio con pocos leads por semana puede cruzar el umbral sin que pase nada; uno que nunca
recibió un lead aparece «Esperando tu primer lead», no caído. **Falta el aviso por WhatsApp** (ver hallazgos).

Dónde vive: `lib/zapier-lead.ts` (el lector), `lib/zapier-leads.ts` (la puerta), `lib/zapier-estado.ts` (la tarjeta),
`app/api/webhooks/zapier/route.ts`, `tests/zapier-leads.test.ts`. El porqué de cada decisión:
`docs/hallazgos-integraciones.md` → «El puente de leads de Meta por Zapier o Make».
