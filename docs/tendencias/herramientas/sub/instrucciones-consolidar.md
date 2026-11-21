# Consolidar las afirmaciones en SUB-ÁNGULOS (21/11/2026)

`C:/dev/tendencias/sub/afirmaciones.md` trae, agrupadas por ángulo padre (`Sector|tema`), las afirmaciones de cada pieza de Spy:
`- [id] (cuenta, fecha) etiqueta — afirmación`. Tu trabajo es juntar las que DICEN LO MISMO en un sub-ángulo.

Un **sub-ángulo** es una afirmación concreta y discutible, que se puede decir en una frase:
- Sí: «El "lo tengo que pensar" se gana antes de la llamada», «Los reels de prueba te dejan testear ganchos sin quemar a tus
  seguidores», «Un equipo de 5 factura más que uno de 30».
- No (es un TEMA): «Ventas», «Cómo cerrar más», «Tips de reels». Si un grupo sólo comparte el tema, no es un sub-ángulo: déjalo con
  `es_tema: true`, o mejor, pártelo en las afirmaciones distintas que tiene adentro.

Reglas:
- Junta dos piezas sólo si un espectador diría que defienden LA MISMA idea, aunque usen otras palabras o ejemplos.
- No fuerces: una afirmación que no se repite queda sola (un sub-ángulo de 1 pieza está bien).
- Puedes mover una pieza a otro padre si el que tiene está mal.
- La `afirmacion` del sub-ángulo se escribe en español neutro con «tú», corta y sin jerga, con las palabras que más usan las piezas.
- El `nombre` es la misma idea en 3 a 7 palabras, para un filtro («Lo tengo que pensar se gana antes»).
- Ojo con los cinco que Martín pidió partir en concreto: «la IA hace el trabajo del editor, del setter…», «los reels de prueba»,
  «el problema es tu ángulo», «menos es más / equipo chico» y «la venta se cae en el cierre». Ahí sé especialmente fino.

Salida: `C:/dev/tendencias/sub/subangulos.json`, un arreglo de
`{ "id": "slug-corto-unico", "nombre": "...", "afirmacion": "...", "padre": "Sector|tema", "piezas": ["id", ...], "es_tema": false }`.
Cada pieza de `afirmaciones.md` va en UN sub-ángulo (como mucho en dos si de verdad defiende dos ideas). Valida con node: que
parsee, que los `id` sean únicos y que estén todas las piezas.
