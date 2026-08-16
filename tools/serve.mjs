import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = normalize(new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
const port = Number(process.env.PORT || 4175);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = normalize(join(root, relative));
  if (!file.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if (!statSync(file).isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': `${types[extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Sudoku Learning Studio: http://127.0.0.1:${port}/`));
