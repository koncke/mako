# Hallazgos: Closing Analyst y las llamadas de Fathom

Lo que se aprendió leyendo llamadas grabadas con Fathom y sus análisis en `closing_analyses`.
Una entrada por tema; lo que quedó sin hacer dice dónde vive.

## Buscar una llamada por el número que da Martín (26/10/2026)

- **Síntoma:** Martín pide «la llamada 847861420» y no aparece buscando por `recording_id`.
- **Causa:** ese número es el de la URL de Fathom (`fathom.video/calls/<número>`). En la base vive en
  `closing_analyses.call_url`. La grabación de esa llamada tenía otro id (`recording_id` 189761032).
- **Regla:** se busca con `call_url LIKE '%/calls/<número>%'`, nunca por `recording_id`.

## El texto de la llamada no está en la base

- `closing_analyses` guarda sólo `has_transcript` y `transcript_items`, no el texto.
- El texto se baja de Fathom con `GET /recordings/{recording_id}/transcript`, usando la clave del
  workspace dueño de la grabación (para el ws9, la de Martín).

## Cada llamada con un cliente está dos veces

- Una llamada entre Martín y un cliente queda en el ws de Martín (9) y en el del cliente (la de Leila,
  en el 11), con `recording_id` distintos. Contar o analizar llamadas sin sacar duplicados las cuenta dos veces.

## Fathom puede cruzar quién habla

- En la llamada con Leila del 05/10 las etiquetas de quién habla venían cruzadas: frases de ella
  firmadas por Martín y al revés. Una cita se atribuye por lo que dice, no por la etiqueta.
- Todo lo que dependa de «qué dijo el cliente» (objeciones, puntajes del Closing) hereda ese error.

## El análisis falla en silencio cuando la IA del cliente se queda sin crédito (26/10/2026)

- **Síntoma:** en el ws11 (Leila) hay 168 análisis de llamadas en error: 165 hasta el 08/10 y 3 más
  hasta el 19/10. Nadie se enteró en tres semanas.
- **Causa:** su clave de Claude se quedó sin crédito. Cada vuelta del cron (`syncClosingCalls`) volvía a
  intentar las llamadas (las filas en `error` no se saltan: se reintentan) y cada intento guardaba el texto
  de Anthropic en su fila. El error quedaba ahí y no le llegaba ni al dueño ni a nosotros.
- **Lo obvio que no alcanza:** mostrar las filas en error, o avisar por cada una. Nadie abre el Closing si no
  hay análisis nuevos, y 168 filas serían 168 avisos. El aviso es por **incidente** (desde que su cuenta
  falla hasta que vuelve a analizar), no por llamada.
- **Qué es «de su cuenta»:** sin crédito, clave inválida (borrada, rotada) o sin permiso: la misma vara que
  la tarjeta de «Tus cuentas de IA» (`motivoCorto`, `lib/su-clave-reglas.ts`). Un 429, un 5xx, un timeout o
  la pausa de MaKo **no**: se arreglan solos y avisarle al dueño sería ruido.
- **Regla (`lib/closing-ia-caida-reglas.ts`, `lib/closing-ia-caida.ts`):** lo de su cuenta no deja fila en
  error (la llamada queda sin procesar), corta la vuelta (las demás fallarían igual) y anota el incidente en
  `app_settings` (`mako.closing.ia_caida`), que conserva su `desde` y su `avisadoAt`. Mientras está anotado,
  cada vuelta prueba **una** llamada; la primera que se analiza cierra el incidente. El drenaje de insights
  no corre con su Claude caído. La API (`panorama_closing`) lo dice en `ia_del_negocio`.
- **El aviso:** evento de la plataforma `closing_ia_caida` → automatización de SuperAdmin
  `mako-closing-ia-caida` (un texto literal por motivo, con el link a Integraciones → Tus cuentas de IA).
  **Trampa:** sin la fila de esa automatización en el ws9, `emitirEventoDePlataforma` devuelve `filas: 0` y
  no sale nada. Por eso `avisadoAt` se pone sólo si `filas > 0`: si no, quedaba «avisado» sin haber avisado.
  Y el aviso del catálogo nace `porDefecto: 'on'`: con `'off'` la mudanza crea la fila **pausada**.
- **Sin hacer:**
  1. Crear la fila de la plataforma después del deploy, con el sí de Martín:
     `node --conditions react-server --import tsx scripts/mudanza-avisos-plataforma.mts --aplicar --eventos=closing_ia_caida`.
     Hasta entonces no avisa.
  2. Las 168 filas del ws11 no se tocan a mano (es el ws de un cliente, va con el sí de Martín): como las filas
     en `error` se reintentan solas, cuando Leila cargue crédito se analizan en las vueltas siguientes.
  3. Lo mismo le pasa a cualquier otra lectura con la IA del negocio (Plan, Chat Agent…): esto cubre sólo el
     Closing.
