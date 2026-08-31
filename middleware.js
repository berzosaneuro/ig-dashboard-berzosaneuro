// Acceso privado al dashboard SIN pedir usuario/contraseña.
//
// Un único token secreto. La página HTML solo se sirve si la URL lleva
// ?t=TOKEN (así funciona igual en un enlace directo, en un marcador o dentro
// de un iframe del panel admin). Los archivos estáticos (js, css, imágenes…)
// quedan fuera del filtro para que la SPA cargue entera.
//
// Sin base de datos y sin criptografía del runtime (eso fue lo que tiró la web
// antes). Para cambiar o revocar el token: se edita esta constante, se
// redespliega, y se actualiza también en webfinalneuro (src/app/admin/page.tsx
// y app/redes/route.ts del estudio).

export const config = {
  matcher:
    '/((?!api/|\\.well-known/|.*\\.(?:js|mjs|css|json|webmanifest|png|jpe?g|gif|svg|ico|webp|avif|mp3|mp4|woff2?|ttf|txt|xml)).*)',
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
<div><h1>Dashboard privado</h1><p>Ábrelo desde tu enlace de acceso personal.</p></div></html>`;

export default function middleware(request) {
  const url = new URL(request.url);
  const ok =
    url.searchParams.get('t') === ACCESS_TOKEN ||
    getCookie(request, 'dash_t') === ACCESS_TOKEN;

  if (ok) {
    // deja también una cookie de 1 año para el marcador (URL limpia después)
    if (url.searchParams.get('t') === ACCESS_TOKEN && !url.searchParams.has('embed')) {
      const clean = new URL(url);
      clean.searchParams.delete('t');
      return new Response(null, {
        status: 302,
        headers: {
          Location: clean.toString(),
          'Set-Cookie': `dash_t=${ACCESS_TOKEN}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
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
