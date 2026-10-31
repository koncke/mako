-- Lo que vino con un mensaje de Instagram o Messenger (ticket #33 de Leandro, 30/10/2026).
-- El botón de un DM viejo no anduvo y no se pudo saber qué mandó Zernio: el cuerpo del webhook no se guardaba.
-- Sólo agrega una columna. La escribe lib/zernio-entrante.ts aparte del mensaje: sin la columna, el webhook sigue andando.
alter table ig_mensajes add column if not exists metadata_zernio jsonb;

comment on column ig_mensajes.metadata_zernio is
  'Lo que vino con el mensaje y no se lee en otro lado (metadata.postbackPayload, postbackTitle, etc.), hasta 4000 caracteres. null = nada más que el texto.';
