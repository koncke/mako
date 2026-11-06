# Los 103 pendientes dudosos, comprobados contra el código (6/11/2026)

**Por qué.** El barrido del 6/11 trajo 634 pendientes, y 103 venían de documentos de **octubre**:
nadie sabía si seguían pasando. Un pendiente fantasma hace perder más tiempo que uno olvidado, así
que antes de que alguien les dedicara trabajo, siete agentes los comprobaron **uno por uno contra el
código**, en tandas de 15. Cada veredicto lleva su prueba: el archivo y la línea, o el commit.

**La regla que se les dio:** no adivinar. El que no se pudiera comprobar iba como «no pude», con lo
que faltó. Un «ya está hecho» equivocado manda a borrar trabajo que hace falta.

## El resultado

| Veredicto | Cuántos | Qué significa |
|---|---:|---|
| **A medias** | **45** | parte ya está. **No se arrancan de cero: se corrige el alcance.** |
| Sigue | 32 | pendiente de verdad, como decía |
| **Ya está hecho** | **25** | se borran de la lista |
| No pude | 1 | hacía falta correr 23 archivos de tests, no alcanzaba con leer |

**Lo más valioso no son los 25 fantasmas: son los 45 a medias.** Ésos son los que se habrían
rehecho desde cero, tirando lo que ya estaba.

## Cinco ejemplos, para que se vea qué tipo de cosa aparece

- **La foto diaria de Spy** (#21, *sigue*): se dudaba si el cron `spy-todo` ya la cubría. **No la
  cubre**: `spy-todo` avanza competidor por competidor con la clave de Apify del negocio y tope de 6
  corridas por día; no saca la foto escalonada ni toca YouTube. Sigue haciendo falta.
- **Las capturas de Top Carousels** (#22, *hecho*): llegaron en el commit `87b2eb2b7` y la pantalla
  se ajustó contra ellas. ⚠️ Y el documento **se contradice solo**: `nube-carruseles-rediseno.md:95`
  todavía dice «las capturas no llegaron». Esa línea quedó vieja.
- **El registro de bajas de leads** (#57, *a medias*): la parte difícil **ya está** —la migración
  0356 aplicada, el trigger, y los dos caminos que no pasaban por la papelera ahora quedan
  anotados—. Lo que falta es chico: el botón «Eliminar» nunca se probó en pantalla, y lo borrado no
  se ve en ninguna. ⚠️ `docs/pendientes.md:139` lo sigue listando como «sin hacer»: esa fila quedó
  vieja.
- **El precio en dólares de Leila** (#60, *a medias*): el arreglo está en main (`d6501deac`) y tiene
  test. Lo que sigue abierto es más fino: un «pásalo a dólares» **sin la palabra «precio»** todavía
  no dispara la acción, porque el patrón exige esa palabra. Y la inconsistencia de datos —su perfil
  dice 800 MXN/mes y el producto «LíderMente» USD 49/mes— **no es código: se resuelve con ella**.
- **El eco de MaKo en los grupos** (#64, *a medias*): arreglado en main y con la migración 0372
  aplicada. Lo que falta son **las 7 pruebas en producción en el ws3**, que están escritas una por
  una en `docs/relevo/nube-grupos.md:45-68`.

## Lo que esto deja dicho, más allá de los 103

**Un documento de pendientes envejece y nadie lo nota.** Tres de los que se comprobaron seguían
listados como pendientes en un documento mientras otro, más nuevo, decía que estaban hechos. La
fecha de arriba de cada documento no alcanza: la línea suelta adentro es la que miente.

**Por eso los «dudosos» van marcados y aparte** en
[pendientes-todo-6-11.md](pendientes-todo-6-11.md) y en la página que los muestra. Mezclarlos con los
confirmados es lo que hace que una lista de pendientes deje de servir.

**El detalle completo, item por item con su prueba**, quedó en la corrida del barrido; el resumen de
arriba es lo que hay que leer para decidir. Si hace falta el crudo, está en el `journal.jsonl` de la
corrida `wf_8e7e14ea-d29`.
