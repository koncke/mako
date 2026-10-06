-- =============================================================================
-- 0197_paso_ia — qué texto salió de verdad, cuando lo escribe la IA
-- =============================================================================
-- Pedido de Martín (05/10/2026): «haz el interruptor de IA» en la tarjeta de chat
-- del lienzo — que un paso de una secuencia pueda escribirlo MaKo en vez de salir
-- con el texto fijo.
--
-- ⚠️ ESTA COLUMNA ES LA CONDICIÓN DE QUE EL INTERRUPTOR EXISTA, no un extra. Sin
-- ella no hay forma de saber qué le llegó a un lead: el `cuerpo` del paso dice lo
-- que una persona escribió, y en modo IA eso es apenas el respaldo. Un mensaje que
-- salió y no quedó en ningún lado es indistinguible de uno que no salió, y encima
-- deja sin material al único juicio que importa después («¿lo que escribe está
-- bien?»). Ya estaba anotado como la deuda que bloqueaba esta feature en el relevo
-- del 5/10: «necesita primero una columna nutricion_envios.texto_enviado».
--
-- ⚠️ ORDEN DE DESPLIEGUE: **ANTES O JUNTO** con el deploy. El código nuevo escribe
-- esta columna en cada envío, y PostgREST rechaza la fila ENTERA si una columna del
-- payload no existe: sin la migración puesta primero, cada envío de nutrición
-- fallaría al registrarse (el mensaje sale y el registro no), que es el peor orden
-- posible de los dos.
--
-- Qué NO hace falta: ninguna columna nueva en `nutricion_secuencias`. El modo vive
-- en el `tipo` del paso, adentro del jsonb que ya existe (`tipo: 'ia'`), porque un
-- paso en modo IA sigue siendo «este nodo manda un mensaje» — y un tipo de nodo
-- nuevo son CINCO puertas mientras un campo del nodo es una rama. Ver AGENTS.md.
-- =============================================================================

begin;

-- El texto EXACTO que se despachó. Se escribe en los dos modos, no sólo en IA: con
-- el texto fijo también hay sorteo de variantes, así que «qué le llegó a esta
-- persona» tampoco se podía contestar antes sin adivinar cuál salió.
alter table nutricion_envios add column if not exists texto_enviado text;

-- Quién lo escribió. Es la otra mitad y no se deriva del texto: un paso en modo IA
-- cuyo modelo falló sale con el `cuerpo` que escribió una persona, y eso NO es un
-- envío de IA aunque el paso lo pidiera. Sin este campo, un fallback usado se lee
-- como un éxito de la IA — exactamente el silencio que la regla de la casa prohíbe.
--   'fijo'     → el cuerpo o una de sus variantes.
--   'ia'       → lo escribió el modelo en este envío.
--   'fallback' → el paso pedía IA, ningún proveedor contestó, salió el cuerpo.
alter table nutricion_envios add column if not exists texto_autor text;

alter table nutricion_envios drop constraint if exists nutricion_envios_texto_autor_check;
alter table nutricion_envios add constraint nutricion_envios_texto_autor_check
  check (texto_autor is null or texto_autor in ('fijo', 'ia', 'fallback'));

-- Para contestar «¿cuántas veces la IA no pudo y salió el respaldo?» sin barrer la
-- tabla. Es la consulta que decide si el interruptor está sirviendo o mintiendo.
create index if not exists idx_nutri_envios_autor
  on nutricion_envios (texto_autor, created_at desc) where texto_autor is not null;

comment on column nutricion_envios.texto_enviado is
  'El texto EXACTO que se despachó, en los dos modos (fijo e IA). Sin esto no se puede saber qué le llegó a un lead: el cuerpo del paso es lo que una persona escribió y el sorteo de variantes o la IA deciden lo que sale.';
comment on column nutricion_envios.texto_autor is
  'Quién escribió ese texto: fijo | ia | fallback. No se deriva del texto — un paso en modo IA cuyo modelo falló sale con el cuerpo de una persona, y eso no es un envío de IA.';

commit;
