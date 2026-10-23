# Leads de Meta por Zapier o Make

Para un negocio que NO conectó Meta con una app propia: sus leads de formularios instantáneos no llegan a MaKo solos.
Con un Zap (o un escenario de Make), cada lead nuevo se manda a MaKo y entra al CRM como uno que viene de Meta: mismo
origen, sin duplicar si la persona ya estaba, y con sus avisos y automatizaciones. Lo paga el negocio (la cuenta de Zapier
o de Make). La tarjeta es **«Leads de Meta por Zapier»**, en Integraciones.

> ⚠️ Lo medido y lo que no. Medido en la ayuda de Zapier el 23/10/2026, **no con un Zap real**: con «Data» vacío manda todos
> los campos del paso anterior; el CRM se asigna en Leads Access; si se edita el formulario, Facebook crea uno nuevo con
> otro id. **NO medido:** los nombres exactos de los campos del trigger (por eso MaKo los lee por significado y devuelve en
> `sin_usar` lo que no usó), la salida de Make, y si la app de Zapier alcanza para páginas de terceros. **Antes de ofrecerlo
> a todos, probarlo con un negocio real.**

## Antes de empezar

- Ser administrador de la página de Facebook, y tener su formulario instantáneo publicado.
- Una cuenta de Zapier o de Make. Según guías de terceros el trigger de Facebook Lead Ads pide un plan de pago de Zapier:
  verifícalo en su precio antes de prometerlo.

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
