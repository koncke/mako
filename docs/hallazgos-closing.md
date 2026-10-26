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

## El análisis falla en silencio cuando la IA del cliente se queda sin crédito (SIN HACER)

- **Síntoma:** en el ws11 (Leila) hay 168 análisis de llamadas en error: 165 hasta el 08/10 y 3 más
  hasta el 19/10. Nadie se enteró en tres semanas.
- **Causa:** su clave de Claude se quedó sin crédito. El error queda guardado en la fila de
  `closing_analyses` y no le llega ni al dueño ni a nosotros.
- **Lo que falta:** que una falla de la IA del cliente (sin crédito, clave vencida) se le diga al dueño
  del negocio, con el paso para arreglarla, en vez de acumular filas en error. Lo tiene el chat
  Grabadores, que está pasando el Closing a todos los grabadores.
