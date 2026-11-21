# Sacar la AFIRMACIÓN de cada pieza (sub-ángulos, 21/11/2026)

Martín quiere ángulos ESPECÍFICOS, no temas. «La venta se cae en el cierre» es un tema. Son ángulos «el "lo tengo que pensar" se
gana antes de la llamada», «el que agenda no es el que compra» o «el seguimiento de 48 h cierra más que la llamada»: una afirmación
concreta que alguien puede decir en una frase y que otro podría discutir.

Cada pieza (`sub/lotes/s-NN.json`) trae `id, cuenta, fecha, tipo, forma, idioma, gancho, guion (la transcripción o el texto),
cta, vistas, comentarios, nx`. Para cada una, leyendo el gancho y el guion, devuelve:

- `afirmacion`: la idea central que la pieza DEFIENDE, en una frase en español neutro con «tú» (traduce si está en inglés). Usa
  las palabras de la pieza cuando se pueda. Tiene que ser específica y discutible: «Los reels de prueba te dejan probar 5 ganchos
  sin quemar a tus seguidores», no «hablo de reels de prueba». Si la pieza sólo regala algo («comenta X y te mando la plantilla»),
  la afirmación es lo que promete ese regalo («Con este prompt Claude te escribe una semana de guiones»).
- `padre`: el ángulo general, como `Sector|tema`, con una de las claves de `C:/dev/tendencias/sub/padres.md`.
- `sub`: una etiqueta de 3 a 6 palabras para agrupar después las piezas que dicen lo mismo (p. ej. «pensar se gana antes»,
  «reels de prueba sin quemar seguidores»).
- `es_angulo`: false si la pieza no defiende ninguna idea (vida personal, chiste, aviso de un evento, un texto vacío o «Fe»). En
  ese caso `afirmacion`, `padre` y `sub` van null.

No inventes lo que la pieza no dice. Si el guion está cortado, decide con lo que hay.

Salida: `C:/dev/tendencias/sub/salida/s-NN.json` con la forma `{ "<id>": {"afirmacion": "...", "padre": "Sector|tema", "sub": "...",
"es_angulo": true} }`, una clave por pieza del lote. Valida con node que parsee y que tenga todas las claves.
