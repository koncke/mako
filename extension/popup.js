// El token se pega una vez. Lo demás lo dice el estado, que tiene que ser
// honesto: «conectado» acá no significa que se pueda generar — significa que hay
// token. Lo que habilita a generar es la sesión de Flow abierta.

const $ = (id) => document.getElementById(id);

chrome.storage.local.get('token', ({ token }) => { if (token) $('token').value = token; });

$('guardar').addEventListener('click', () => {
  const token = $('token').value.trim();
  chrome.storage.local.set({ token }, pintar);
});

function pintar() {
  chrome.storage.local.get('token', ({ token }) => {
    chrome.runtime.sendMessage({ tipo: 'ESTADO' }, (r) => {
      const partes = [];
      partes.push(token
        ? '<div class="ok">✓ Conectado a MaKo</div>'
        : '<div class="falta">Falta el código de conexión, lo copias de MaKo.</div>');
      partes.push(r?.conectado
        ? '<div class="ok">✓ Sesión de Flow detectada</div>'
        : '<div class="falta">Abre labs.google/fx/tools/flow e inicia sesión.</div>');
      $('estado').innerHTML = partes.join('');
    });
  });
}
pintar();
