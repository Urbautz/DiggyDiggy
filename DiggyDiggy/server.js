const http = require('http');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, 'stats');
const WEB_ROOT = path.resolve(__dirname);

const PORT = 8000;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Stats collection endpoint
    if (req.method === 'POST' && req.url === '/api/stats') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const uuid = (payload.uuid || 'unknown').replace(/[^a-zA-Z0-9-]/g, '');
                fs.mkdirSync(STATS_DIR, { recursive: true });
                const file = path.join(STATS_DIR, `${uuid}_${Date.now()}.json`);
                fs.writeFileSync(file, body);
                console.log(`Stats saved: ${file}`);
                res.writeHead(204);
                res.end();
            } catch (e) {
                console.error('Stats error:', e);
                res.writeHead(400);
                res.end();
            }
        });
        return;
    }

    const urlPath = req.url.split('?')[0]; // strip query string
    const resolvedPath = path.resolve(WEB_ROOT, '.' + urlPath);

    if (!resolvedPath.startsWith(WEB_ROOT + path.sep) && resolvedPath !== WEB_ROOT) {
        res.writeHead(403, { 'Content-Type': 'text/html' });
        res.end('<h1>403 - Forbidden</h1>', 'utf-8');
        return;
    }

    const filePath = resolvedPath === WEB_ROOT ? path.join(WEB_ROOT, 'index.html') : resolvedPath;
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('Press Ctrl+C to stop');
});
