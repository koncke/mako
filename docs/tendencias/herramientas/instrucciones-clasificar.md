# Clasificar piezas por sector y tema (mapa de tendencias)

Cada pieza es una publicación de un referente del mercado de coaches, mentores e infoproductores (Instagram o YouTube):
`{k, quien, red, tipo, texto, voz?}` (texto = pie o título y descripción; voz = comienzo de la transcripción, si hay).

Para cada pieza decide:
- `s`: el sector. Uno de: "Orgánico de nicho", "Orgánico viral", "Anuncios", "Closing y ventas", "IA", "YouTube",
  "High ticket", "Low ticket", "Mentalidad y coaching", "Operaciones", "Lifestyle", o "fuera".
- `t`: el tema, una clave de `C:/dev/tendencias/temas.json` DENTRO de ese sector. Si ninguna calza bien, `"nuevo:<3 a 5
  palabras en español>"` (no fuerces un tema que no es).
- `s2`/`t2`: sólo si la pieza trata DE VERDAD dos sectores (p. ej. un agente de IA que agenda llamadas: IA/agentes-y-setters-ia
  y Closing/setting-y-agenda). Si no, omítelos.
- `cta`: la palabra que pide comentar o escribir («comenta SISTEMA» → "SISTEMA"), en mayúsculas. Si no hay, omítelo.

Reglas (son las que hicieron coincidir a dos lectores a ciegas en 47 de 48 piezas):
- El tema nombra DE QUÉ habla la pieza, no su forma ni la muletilla del creador. «Siempre hablo de los mismos temas» no es un tema.
- Si habla de dos cosas, manda lo que REGALA el CTA o la promesa del gancho.
- **"Lifestyle"** (desde el 21/11): la vida del emprendedor mostrada como resultado de su negocio (viajes, rutina, «un día en mi
  vida», lujo, libertad de tiempo, la oficina o el equipo por dentro). El tema es lo que PROMETE esa vida («trabajo 4 horas»,
  «vivo viajando»). Un viaje o un auto de un coach va acá aunque no diga nada más.
- **"Operaciones"** (desde el 21/11): la operación del negocio: equipo, contratar, liderar, procesos y SOP, delegar, números. La
  automatización CON IA va a "IA"; el equipo de VENTAS (closers, setters) va a "Closing y ventas".
- "fuera": lo que no es del emprendedor ni de su negocio (embarazo, familia sin relación con el negocio, deporte o humor sin tema,
  recetas, otro rubro como fitness o salud), sorteos, saludos, avisos de un en vivo o de un episodio sin decir de qué, y un texto
  vacío o que no dice nada.
- El inglés se clasifica igual que el español.
- Un anuncio de un curso o programa propio va al sector de lo que enseña ese curso.
- No inventes: si el texto es muy corto para saberlo, "fuera".

Salida: un JSON objeto `{ "<k>": {"s": "...", "t": "...", "s2"?: "...", "t2"?: "...", "cta"?: "..."} }` con TODAS las piezas del lote,
escrito en `C:/dev/tendencias/clasif/<mismo nombre del lote>`. Valida antes de terminar: que el JSON parsee con node, que tenga
tantas claves como piezas el lote y que cada `t` exista en temas.json para su sector (o empiece con "nuevo:", o s = "fuera").

**Lotes históricos (`hist-NN`):** cada pieza trae además `fecha`. Se clasifican igual; sirven para saber desde cuándo existe cada
tema. Usa los temas de temas.json (ya incluyen los que propusieron los lotes anteriores) antes de proponer un «nuevo:».

**Lotes de re-lectura (`refuera-NN`, 21/11):** son las piezas que antes quedaron "fuera". Con los dos sectores nuevos, muchas son
"Lifestyle" u "Operaciones"; las demás siguen "fuera".
