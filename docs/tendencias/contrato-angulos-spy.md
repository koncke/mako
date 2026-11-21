# El filtro de ángulos en Content Machine: el contrato del campo `angulos`

21/11/2026. Martín: «sería muy bueno también poner el filtro de ángulos en Spy, en Reels, en Carruseles, en todos lados».

## En cada pieza de la colección `spy`

```json
"angulos": [
  { "id": "a-optimiza-evento-profundo", "nombre": "Optimiza al evento profundo, no al lead", "padre": "Anuncios|medicion-y-atribucion" }
]
```

- Lleva de 0 a 2 entradas por pieza. Una pieza sin ninguna idea defendida (vida personal, un chiste, un texto vacío) no lleva el
  campo, o lo lleva vacío.
- `id`: el sub-ángulo, estable. Empieza con `a-` (Anuncios, Closing, High ticket, Operaciones, IA, Low ticket, YouTube) o con `b-`
  (Orgánico de nicho, Orgánico viral, Mentalidad y coaching, Lifestyle).
- `nombre`: lo que se ve en el filtro y en la tarjeta. Es la afirmación en 3 a 7 palabras.
- `padre`: el ángulo general, `Sector|tema`. El sector es lo que va antes de la barra. Sirve para agrupar el filtro (Sector ›
  Ángulo) y para cruzar con la pestaña «Ángulos» (`docs/tendencias/angulos.json`, campo `id` de cada ángulo).
- El mapa completo (id de pieza → ángulos) está en `C:/dev/tendencias/sub/mapa-angulos.json`. Lo escribe el chat Spy.

## El catálogo (opcional, para mostrar la afirmación entera y los números)

Es la colección `angulos`, con un documento por sub-ángulo (doc id = `id`):

```json
{ "nombre": "…", "afirmacion": "una frase", "padre": "Sector|tema", "estado": "En crecimiento", "puntaje": 78,
  "piezas": 9, "contagio": 3, "comentariosPorMil": 4.2 }
```

Sale de `C:/dev/tendencias/sub/ranking.json`.

## Cómo se ve (propuesta)

- En el «Filtrar» combinado que ya existe va un renglón más, **«Ángulo ›»**, con el submenú en cascada: Sector → sub-ángulos.
  Cada uno lleva el número de piezas y está ordenado por puntaje.
- Las piezas propias («Hacer mi versión») heredan los ángulos de la referencia. Así el mismo filtro sirve en Reels y en Carruseles.
- En la tarjeta, un sello chico con el `nombre` del primer ángulo. Si se toca, filtra por ese ángulo.
