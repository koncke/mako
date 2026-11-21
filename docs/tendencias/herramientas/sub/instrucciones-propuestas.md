# Propuestas para PRODUCIR desde los sub-ángulos ganadores (21/11/2026)

Martín: «vayamos creando algunos reels y carruseles que tengan que ver con los ángulos que ya identificamos… sé más específico…
busquemos referencia de todo lo que ya tenemos en Spy… y plantéame cuáles podríamos tomar para hacer reels y carruseles».

## Lo que lees primero
- `C:/dev/tendencias/sub/ranking.json`: los sub-ángulos con sus señales (contagio, insistencia, interacción, nx, estado, puntaje)
  y hasta 6 piezas de referencia cada uno (`referencias`, con su id de Spy).
- El guion completo de una referencia está en `C:/dev/tendencias/spy-cm/spy/<id>.json` (campos `gancho`, `guion`, `forma`,
  `escena`, `cta`, `vistas`, `comentarios`, `nx`). Léelo antes de elegirla.
- Las cuentas y series de Martín: `C:/dev/wt-tendencias/docs/hallazgos-contenido.md`, sección «Cuentas y series (21/11/2026)».
  - **Personal:** Gancho IA (gancho exagerado con avatar, estilo Ramiro), Educación (sin venta) y Ventas (CTA «comenta X»,
    incluye carruseles).
  - **MaKo:** Animados (el personaje de Martín en cubos, por código), A o B (historias del nicho con continuación) y Comentarios
    (el personaje reacciona a comentarios).
- Lo que ya se sabe de los ángulos: `C:/dev/wt-tendencias/docs/series/angulos-de-comunicacion.md`, sobre todo los territorios A, B
  y C y lo descartado.
- La voz de Martín: `C:/dev/wt-tendencias/docs/vsl/voz-de-martin.md`, si existe.

## Las reglas de Martín (no se negocian)
- Martín NO se graba. Todo lo que tiene una persona hablando se hace con su **Avatar IA**. Lo demás es **Animación** (su personaje
  en cubos, por código) o **Carrusel**.
- Ganchos simples, calcados de la forma de la referencia y sin jerga. Se copia lo que hizo funcionar a la pieza (el regalo, la
  cifra, la escena, la contradicción), no su texto.
- En Ventas se habla del lado del partner: «encontré una aplicación que…», NUNCA «dentro de MaKo vas a poder». El CTA siempre es
  «comenta PALABRA», y la palabra nombra lo que la persona se lleva (EDITAR junta 12 comentarios cada 1.000 vistas; YO, de 1 a 3).
- Español neutro con «tú» en lo que dice el personaje. Lo de Martín a cámara (avatar) puede ir con «vos».
- Nunca nombrar a un referente ni burlarse de él.

## Qué hacer
1. Elige entre 6 y 10 sub-ángulos de buen puntaje, priorizando los cinco que nombró Martín y sus partes concretas:
   - la IA hace el trabajo del editor, del setter…;
   - los reels de prueba;
   - el problema es tu ángulo;
   - menos es más, equipo chico;
   - la venta se cae en el cierre.
   Descarta los que son temas y no afirmaciones, y los que chocan con lo descartado en angulos-de-comunicacion.md. En cada uno di
   por qué lo eliges, con sus números.
2. Para cada sub-ángulo, elige de 2 a 4 piezas de Spy como REFERENCIA, mezclando reels y carruseles si hay. Para cada una:
   - `id` (el de Spy) y `quien`;
   - `porQueEsa`: lo que la hizo funcionar, en una línea y con su número (nx, comentarios, comentarios cada 1.000 vistas);
   - `nuestraVersion`: el gancho adaptado a Martín, en una línea, listo para decir;
   - `formato`: "Avatar IA" | "Animación" | "Carrusel";
   - `cuenta` y `serie` (Personal: Gancho IA | Educación | Ventas; MaKo: Animados | A o B | Comentarios);
   - `cta`: la PALABRA, o null si la serie no lleva CTA (Educación y A o B no venden).

## Salida
- `C:/dev/tendencias/sub/propuestas.json`: `{ "fecha": "2026-11-21", "subangulos": [ { "id", "nombre", "afirmacion", "porQue", "senales": {…del ranking…}, "referencias": [ {…} ] } ] }`. Valida con node.
- `C:/dev/tendencias/sub/resumen-propuestas.md`: el resumen para Martín.
  - Corto: una sección por sub-ángulo con la afirmación, una línea de por qué y sus 2 a 4 piezas («nuestra versión», formato,
    cuenta y serie, CTA).
  - Sin jerga, y con el link de Instagram de cada referencia.
