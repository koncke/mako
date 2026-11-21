# «Cómo usarla»: el gancho y el CTA de cada tendencia

Lees `C:/dev/tendencias/uso/<sector>.json`. Cada tendencia trae su estado, sus señales y sus mejores piezas (texto, voz si hay, CTA,
comentarios de la gente). Para cada una escribes, en español neutro con «tú», corto y accionable:

- `gancho`: la FORMA del gancho que conviene, en una frase con un ejemplo entre comillas. No copies el gancho de una pieza: saca lo
  que la hizo funcionar (el regalo, la cifra, la contradicción, la escena). Elige según el estado (Schwartz, en
  `docs/series/angulos-de-comunicacion.md`):
  - **Nuevo:** promesa directa y demostración («Así se hace X en 3 pasos»). Todavía nadie la quemó.
  - **En crecimiento:** el mecanismo: por qué funciona o el paso que nadie cuenta.
  - **Saturado:** no repitas la promesa. Abre con una historia, una contradicción o un dato propio que sólo tú tienes.
  - **En baja:** dale la vuelta (proclamación en contra) o no lo uses; dilo.
- `cta`: la PALABRA para comentar, en mayúsculas. Tiene que nombrar lo que la persona se lleva (en Rama, EDITAR junta 12 comentarios
  cada 1.000 vistas; YO, entre 1 y 3). Mira las palabras que ya rinden en `ctas` y en las piezas. Si la tendencia no da para un
  regalo, pon null.
- `porque`: una línea con el dato que lo respalda (una pieza, una cifra de las señales).
- `piden`: 2 o 3 cosas que la gente pide o pregunta en los comentarios (de `comentariosDeLaGente`), con sus palabras. Si no hay
  comentarios de conversación, deja la lista vacía. No inventes.

Salida: `C:/dev/tendencias/uso/<sector>.salida.json` con la forma `{ "<id>": {"gancho": "...", "cta": "..."|null, "porque": "...",
"piden": ["..."]} }`, una entrada por tendencia del archivo. Valida que parsee con node.
