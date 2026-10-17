// =============================================================================
// La galería de VOZ de AI Avatar: voces en español para escuchar antes de elegir
// =============================================================================
// Sale de la biblioteca pública de ElevenLabs (`/v1/shared-voices`), filtrada el
// 17/10/2026 por idioma español y acento (rioplatense, mexicano, latino neutro,
// colombiano, España), las más usadas, sin las de personajes, y sólo las que
// cualquier cuenta puede usar (`free_users_allowed`). Mitad mujeres, mitad hombres.
//
// ⚠️ ES UNA FOTO CON FECHA. La lista no se pide en vivo porque filtrar la
// biblioteca exige una clave, y la galería se tiene que poder escuchar aunque el
// cliente todavía no haya conectado ElevenLabs. La muestra (`muestra`) es un mp3
// público de ElevenLabs: se escucha sin cuenta y sin gastar cuota.
//
// `dueno` + `id` es lo que hace falta para sumar una voz compartida a la cuenta del
// cliente (`POST /v1/voices/add/{dueno}/{id}`), con SU clave.
//
// El `tono` lo escribió el autor de cada voz en inglés; acá va traducido corto.

export type VozGaleria = {
  id: string;
  /** El `public_owner_id` de la voz compartida. */
  dueno: string;
  nombre: string;
  tono: string;
  genero: 'mujer' | 'hombre';
  edad: string;
  acento: 'Rioplatense' | 'Mexicano' | 'Latino neutro' | 'Colombiano' | 'España';
  uso: string;
  /** mp3 público de ElevenLabs. */
  muestra: string;
};

export const ACENTOS_GALERIA = ['Rioplatense', 'Mexicano', 'Latino neutro', 'Colombiano', 'España'] as const;

export const VOCES_GALERIA: readonly VozGaleria[] = Object.freeze([
  { id: '9oPKasc15pfAbMr7N6Gs', dueno: '55cba8705b825a016bff97f66791aa0700e2e07e12b7bbfe17aedc068776c0c1', nombre: "Valeria", tono: "Alegre y pegadiza", genero: 'mujer', edad: 'Adulta', acento: 'Rioplatense', uso: 'Redes', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/74218f2ac8c845e09511f93dea3ce3dd/voices/9oPKasc15pfAbMr7N6Gs/MP7B0Mq8wUSWAbA8lZ5X.mp3' },
  { id: 'p7AwDmKvTdoHTBuueGvP', dueno: '5d2a986bb6c2b56f988d9cb4c66826fdad903b3df5e941abaa032e8b40579b12', nombre: "Malena", tono: "Cálida y segura", genero: 'mujer', edad: 'Joven', acento: 'Rioplatense', uso: 'Redes', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/user/gkFSLrd1S7Tejj8VJeufmv1AhIa2/voices/p7AwDmKvTdoHTBuueGvP/UrhVDNheUgtbkyKfM34s.mp3' },
  { id: 'bN1bDXgDIGX5lw0rtY2B', dueno: '5c4f24a8c67b848ad8bbb8841f35e8496ec0e8ff477b7c9f5c599b565ef78906', nombre: "Melanie", tono: "Cálida y profesional", genero: 'mujer', edad: 'Adulta', acento: 'Rioplatense', uso: 'Explicar', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/43695948437e4361a2c19a30c2cc683d/voices/bN1bDXgDIGX5lw0rtY2B/FJ1Y4CpyLteHcuZfnh1z.mp3' },
  { id: 'ByVRQtaK1WDOvTmP1PKO', dueno: '34acdd659e0d36f9c59bffd96581aca44cec0e70fd0ab67d69adbdca056ae460', nombre: "Agustín", tono: "Relajado y cercano", genero: 'hombre', edad: 'Adulto', acento: 'Rioplatense', uso: 'Conversación', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/user/OoUbVaZDhHRXnydQUjPhTA6PrkH3/voices/ByVRQtaK1WDOvTmP1PKO/VQdRLzsWp3iInOpSD38S.mp3' },
  { id: 'QK4xDwo9ESPHA4JNUpX3', dueno: 'c6f68092886bf0a8789a060049e645ea8b1fedd862cc9bc81a674a717a91eb92', nombre: "Tomas", tono: "Rioplatense natural", genero: 'hombre', edad: 'Joven', acento: 'Rioplatense', uso: 'Conversación', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/user/vJtTMMvU5CQG2SY5r4VxTvat2Rx2/voices/QK4xDwo9ESPHA4JNUpX3/Cre2oN0Rp6hskV93Wzjs.mp3' },
  { id: 'gBTPbHzRd0ZmV75Z5Zk4', dueno: 'cdf0ffe42d05f082a904f71714248f84a2a8acaff462135e47259bac37a87024', nombre: "Carlos Pro", tono: "De radio y documental", genero: 'hombre', edad: 'Adulto', acento: 'Rioplatense', uso: 'Narrar', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/987bfb8d7c144d958725ed3bf6dc9129/voices/gBTPbHzRd0ZmV75Z5Zk4/aJ208uEuqwVx3I5Lyl43.mp3' },
  { id: 'JYyJjNPfmNJdaby8LdZs', dueno: '058cd97fa3064ea75008a2a674a70f440e9e1149f3d5fe068f9a61a0a181e6b4', nombre: "Marlene", tono: "Melódica y luminosa", genero: 'mujer', edad: 'Joven', acento: 'Mexicano', uso: 'Narrar', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/user/2inDbEyJlEMs6jwhBRCFuuPHhp22/voices/JYyJjNPfmNJdaby8LdZs/5ee74841-5c03-4ee8-af34-d74d7915a79e.mp3' },
  { id: 'm7yTemJqdIqrcNleANfX', dueno: 'd79bf41c4fd48f91a62ec20ab4f63c5f01aed4d708b6913131c477da6f6555fb', nombre: "Ana María", tono: "Calma y clara", genero: 'mujer', edad: 'Joven', acento: 'Mexicano', uso: 'Conversación', muestra: 'https://api.us.elevenlabs.io/v1/voices/m7yTemJqdIqrcNleANfX/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ1c2VyX2lkIjoib0tGZ3REYjB5N1Y5YkRTb3pSVFFwZGoxdzFQMiIsImZpbGVuYW1lIjoiNjg1NTVkMDYtNWU0ZS00MzFmLWIwMDAtMDEzN2M3OGYxYTIxLm1wMyIsInRpbWVzdGFtcCI6MTc5MjIyNDAwMDAwMDAwMH0%3D' },
  { id: '9Godp7dNohUvXk6qp0gS', dueno: '1fb4ad9258694fff54fb0184433c88ec10a5ab94ee1f042eb55bba3fb025ebe5', nombre: "Regina", tono: "Atenta y clara", genero: 'mujer', edad: 'Joven', acento: 'Mexicano', uso: 'Conversación', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/3ec0f756a64949d7971677b1e7afc31e/voices/9Godp7dNohUvXk6qp0gS/Hf7tJYFXFnoObQhDBgPM.mp3' },
  { id: 'iDEmt5MnqUotdwCIVplo', dueno: 'e9a6840c69b79812b77ea81fa11d55aaf80dcf1938fa0137bf7f514f67f75c99', nombre: "Enrique Mondragón", tono: "Elegante y dinámico", genero: 'hombre', edad: 'Adulto', acento: 'Mexicano', uso: 'Narrar', muestra: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/iDEmt5MnqUotdwCIVplo/rS1k8yAe8MGIMeC7Uq4V.mp3' },
  { id: 'gbTn1bmCvNgk0QEAVyfM', dueno: 'e9a6840c69b79812b77ea81fa11d55aaf80dcf1938fa0137bf7f514f67f75c99', nombre: "Enrique M. Nieto", tono: "Creíble y profundo", genero: 'hombre', edad: 'Adulto', acento: 'Mexicano', uso: 'Explicar', muestra: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/gbTn1bmCvNgk0QEAVyfM/VzDkkwZdN7zNxcnMeEsc.mp3' },
  { id: 'htFfPSZGJwjBv1CL0aMD', dueno: 'b8cf26021a2ac6dc9844a696dd285d45cf08a600b354a29300f25de0ee898f4d', nombre: "Antonio", tono: "Seguro y amable", genero: 'hombre', edad: 'Joven', acento: 'Mexicano', uso: 'Conversación', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/06c63e017f47462b814df82e5e4bd95e/voices/htFfPSZGJwjBv1CL0aMD/XejtLxBuA9F2DLhkzdWq.mp3' },
  { id: 'CaJslL1xziwefCeTNzHv', dueno: '5d0a801649832bdc90fc6b58ac890a1e97cce61eba920e8a5313f08f4dcdfde2', nombre: "Cristina Campos", tono: "Amable y suave", genero: 'mujer', edad: 'Joven', acento: 'Latino neutro', uso: 'Conversación', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/c093a158b7da4dadb8f9a5fae10b7211/voices/CaJslL1xziwefCeTNzHv/piQKkajjFXnelvIxcX33.mp3' },
  { id: 'kcQkGnn0HAT2JRDQ4Ljp', dueno: 'b8cf26021a2ac6dc9844a696dd285d45cf08a600b354a29300f25de0ee898f4d', nombre: "Norah", tono: "Cálida y amable", genero: 'mujer', edad: 'Joven', acento: 'Latino neutro', uso: 'Conversación', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/06c63e017f47462b814df82e5e4bd95e/voices/kcQkGnn0HAT2JRDQ4Ljp/ahsfnWSIKEI3UbM2BaEE.mp3' },
  { id: 'qHkrJuifPpn95wK3rm2A', dueno: 'a5457557280d83c0c3d591443bb3e47c4d7010eeedcbbc03b9e8b2f34e4bc9dc', nombre: "Andrea", tono: "Alegre y serena", genero: 'mujer', edad: 'Joven', acento: 'Latino neutro', uso: 'Conversación', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/user/AUiOudcyrBgldqnAJhuGI9X0Ktn2/voices/qHkrJuifPpn95wK3rm2A/C0HIbK1Fqc9zwzlyvuTI.mp3' },
  { id: 'dlGxemPxFMTY7iXagmOj', dueno: '615d2b8bda021af8e423fe2ac2467be802ba8efda45b0afe6d49c32e299ee9c3', nombre: "Fernando Martínez", tono: "Rápido y persuasivo", genero: 'hombre', edad: 'Adulto', acento: 'Latino neutro', uso: 'Narrar', muestra: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/dlGxemPxFMTY7iXagmOj/lQty6bCYbkLtTgnwqvDs.mp3' },
  { id: 'l1zE9xgNpUTaQCZzpNJa', dueno: '7bc0a029a3367b325b55ae78d5d1ac6c17c73d4db23797822acb4a2ba5c4a6a0', nombre: "Alberto Rodríguez", tono: "Serio, de narración", genero: 'hombre', edad: 'Adulto', acento: 'Latino neutro', uso: 'Narrar', muestra: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/l1zE9xgNpUTaQCZzpNJa/sF0SJSVjERJtMSqfZLPN.mp3' },
  { id: 'x5IDPSl4ZUbhosMmVFTk', dueno: '3ed9c95fe4d7df1c1a2905fa50f907fd5a4cb32b17815fe43a66e21e12432a61', nombre: "Lumina", tono: "Neutra y clara", genero: 'mujer', edad: 'Joven', acento: 'Colombiano', uso: 'Explicar', muestra: 'https://api.us.elevenlabs.io/v1/voices/x5IDPSl4ZUbhosMmVFTk/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ1c2VyX2lkIjoiQTl1VE52dWh1Q2NjTTdZajl5Nml4aUVqenNpMiIsImZpbGVuYW1lIjoiUVBsWlN6cW93S0NVTW1KTTE5dE8ubXAzIiwidGltZXN0YW1wIjoxNzkyMjI0MDAwMDAwMDAwfQ%3D%3D' },
  { id: 'b2htR0pMe28pYwCY9gnP', dueno: '33822640db169fffd2b45009a79f882bbfbb04b7e59077c8c5cd8c1926a6b61a', nombre: "Sofía", tono: "Natural, de charla", genero: 'mujer', edad: 'Joven', acento: 'Colombiano', uso: 'Conversación', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/user/fHOiFx8lXIazL4fNHvmcoBi71SK2/voices/b2htR0pMe28pYwCY9gnP/YqHhQtUxgVpJ7rXY5dmz.mp3' },
  { id: 'W1hAcdh0RNsPYUA7fkJh', dueno: 'a26c95162e2374617775625d01f167b1b69a6d9014b20327d699beddb312c5b6', nombre: "El Faraon", tono: "Grave y potente", genero: 'hombre', edad: 'Adulto', acento: 'Colombiano', uso: 'Narrar', muestra: 'https://api.us.elevenlabs.io/v1/voices/W1hAcdh0RNsPYUA7fkJh/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiIxNWJhYTU3YjBmZDg0ZGJjOTA4MWUzZDdlZjE0Y2Q2MCIsImZpbGVuYW1lIjoiWU9KM0RnekxoeFN3czhHMm5HaUgubXAzIiwidGltZXN0YW1wIjoxNzkyMjI0MDAwMDAwMDAwfQ%3D%3D' },
  { id: 'bnes5tb6xZ5GxqUjhUSq', dueno: '627c5b88d31676850ccff012b5cea743eae63fee6e6f62823b243368422928ee', nombre: "Sebastian", tono: "Suelto y conversador", genero: 'hombre', edad: 'Joven', acento: 'Colombiano', uso: 'Redes', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/user/JBk20Zwg01SwN4nqRQaOCDKsg3r1/voices/bnes5tb6xZ5GxqUjhUSq/rkq53X6kJwBf6G43iuZn.mp3' },
  { id: 'UOIqAnmS11Reiei1Ytkc', dueno: '836e36b4a946917f0368eef4eadefd17794aaf18c4bbe50650cd81e94008559a', nombre: "Carolina", tono: "Natural y neutra", genero: 'mujer', edad: 'Adulta', acento: 'España', uso: 'Conversación', muestra: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/UOIqAnmS11Reiei1Ytkc/iD8yOai01ygsrjOUknQ3.mp3' },
  { id: '1eHrpOW5l98cxiSRjbzJ', dueno: '8005ecb7e09304a696e5bd13cef3b170ee24f7988d7312352f842d7e07411e49', nombre: "Raquel", tono: "Joven y alegre", genero: 'mujer', edad: 'Joven', acento: 'España', uso: 'Conversación', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/user/yrpXax6FKwZveVMFcgOsJ03gxlr1/voices/1eHrpOW5l98cxiSRjbzJ/gCIet3OxcKuJhQlwkECR.mp3' },
  { id: 'Nh2zY9kknu6z4pZy6FhD', dueno: 'e9a6840c69b79812b77ea81fa11d55aaf80dcf1938fa0137bf7f514f67f75c99', nombre: "David Martin", tono: "Seguro y equilibrado", genero: 'hombre', edad: 'Joven', acento: 'España', uso: 'Narrar', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/user/8RYUsFHsalUXjwVG0LjhNwH1j022/voices/Nh2zY9kknu6z4pZy6FhD/5VD3I67SoLbajJEbw7rH.mp3' },
  { id: '5egO01tkUjEzu7xSSE8M', dueno: 'c992b28e122c401105a38e2e660aec31bb209a9960f811c02447dd3aee542ef1', nombre: "Carmelo", tono: "Maduro y envolvente", genero: 'hombre', edad: 'Adulto', acento: 'España', uso: 'Narrar', muestra: 'https://storage.googleapis.com/eleven-public-prod/database/user/0DpohMMjjdS9EL1e1JomEmnZraP2/voices/5egO01tkUjEzu7xSSE8M/uSWwZMtApWBuaSW2cKXR.mp3' },
]);
