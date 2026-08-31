// Acceso privado al dashboard SIN pedir usuario/contraseña.
//
// Hay UN enlace secreto con un token en la URL (…/?t=TOKEN). La primera vez
// que lo abres en un dispositivo (móvil, PC), el token se guarda en una cookie
// de 1 año y la URL se limpia sola. A partir de ahí ese dispositivo entra
// directo, sin pedir nada. Quien no tenga el enlace, ve una página de "acceso
// privado" y no puede entrar.
//
// El token está aquí escrito a mano a propósito: sin base de datos y sin
// criptografía del runtime (eso fue lo que tiró la web antes). Para cambiarlo
// o revocarlo, se edita esta constante y se vuelve a desplegar.

export const config = {
  matcher: '/((?!api/|\\.well-known/).*)',
};

const ACCESS_TOKEN = 'OlSxJ48XX1DXXKwM8tZs-qm9';

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

const DENIED = `<!doctype html><html lang=es><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Acceso privado</title>
<style>body{background:#0B0B12;color:#E5E7EB;font:16px/1.6 system-ui,-apple-system,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}div{max-width:340px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#9AA0AE;margin:0}</style>
<div><h1>Dashboard privado</h1><p>Ábrelo desde tu enlace de acceso personal. Si lo has perdido, pídelo de nuevo.</p></div></html>`;

export default function middleware(request) {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('t');
  const token = queryToken || getCookie(request, 'dash_t');

  if (token === ACCESS_TOKEN) {
    if (queryToken) {
      // set the 1-year cookie and bounce to the same URL without ?t=
      const clean = new URL(url);
      clean.searchParams.delete('t');
      // build the redirect by hand — Response.redirect()'s headers are immutable
      return new Response(null, {
        status: 302,
        headers: {
          Location: clean.toString(),
          'Set-Cookie': `dash_t=${encodeURIComponent(queryToken)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
    return;
  }

  return new Response(DENIED, {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
