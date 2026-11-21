# Clasificar piezas por sector y tema (mapa de tendencias)

Cada pieza es una publicación de un referente del mercado de coaches, mentores e infoproductores (Instagram o YouTube):
`{k, quien, red, tipo, texto, voz?}` (texto = pie o título y descripción; voz = comienzo de la transcripción, si hay).

Para cada pieza decide:
- `s`: el sector. Uno de: "Orgánico de nicho", "Orgánico viral", "Anuncios", "Closing y ventas", "IA", "YouTube",
  "High ticket", "Low ticket", "Mentalidad y coaching", o "fuera".
- `t`: el tema, una clave de `C:/dev/tendencias/temas.json` DENTRO de ese sector. Si ninguna calza bien, `"nuevo:<3 a 5
  palabras en español>"` (no fuerces un tema que no es).
- `s2`/`t2`: sólo si la pieza trata DE VERDAD dos sectores (p. ej. un agente de IA que agenda llamadas: IA/agentes-y-setters-ia
  y Closing/setting-y-agenda). Si no, omítelos.
- `cta`: la palabra que pide comentar o escribir («comenta SISTEMA» → "SISTEMA"), en mayúsculas. Si no hay, omítelo.

Reglas (son las que hicieron coincidir a dos lectores a ciegas en 47 de 48 piezas):
- El tema nombra DE QUÉ habla la pieza, no su forma ni la muletilla del creador. «Siempre hablo de los mismos temas» no es un tema.
- Si habla de dos cosas, manda lo que REGALA el CTA o la promesa del gancho.
- "fuera": vida personal, viajes, sorteos, saludos, eventos sin tema, otro rubro (fitness, salud, recetas), avisos de un en vivo
  sin decir de qué. También un texto vacío o que no dice nada.
- El inglés se clasifica igual que el español.
- Un anuncio de un curso o programa propio va al sector de lo que enseña ese curso.
- No inventes: si el texto es muy corto para saberlo, "fuera".

Salida: un JSON objeto `{ "<k>": {"s": "...", "t": "...", "s2"?: "...", "t2"?: "...", "cta"?: "..."} }` con TODAS las piezas del lote,
escrito en `C:/dev/tendencias/clasif/<mismo nombre del lote>`. Valida antes de terminar: que el JSON parsee con node, que tenga
tantas claves como piezas el lote y que cada `t` exista en temas.json para su sector (o empiece con "nuevo:", o s = "fuera").
