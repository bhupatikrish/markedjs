const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getCatalog } = require('./catalog');
const { renderMarkdown } = require('./renderer');

const app = express();
const DEFAULT_PORT = process.env.PORT || 3000;

app.use(cors());

// Serve static files from frontend (will be populated in Phase 2)
// Serve static files from frontend
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
if (fs.existsSync(FRONTEND_DIR)) {
    app.use(express.static(FRONTEND_DIR));
}

const GLOBAL_DEFAULT_PORT = process.env.PORT || 3000;

function startServer(port = GLOBAL_DEFAULT_PORT, contentDir) {
    // If we're called from CLI with a new port, we need a new app instance 
    // OR we just use the global app if we only support one instance.
    // For simplicity in this POC, we'll just use the global 'app' but ideally 
    // we should create a new express() instance inside here to be clean.
    // However, the previous code used the global 'app', so let's stick to that 
    // but ensure we don't duplicate middleware if called multiple times (unlikely for CLI).

    // Better approach: Let's create a new app instance if we want to be clean, 
    // but the CLI uses this script. Let's just use the global `app` defined at the top.

    // If no contentDir provided, use default
    const { DEFAULT_PRODUCTS_DIR } = require('./catalog');
    const targetDir = contentDir ? path.resolve(contentDir) : DEFAULT_PRODUCTS_DIR;

    // API: Navigation / Catalog
    app.get('/api/navigation', (req, res) => {
        try {
            const catalog = getCatalog(targetDir);
            res.json(catalog);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to load catalog' });
        }
    });

    // API: Content
    app.get('/api/page/*', async (req, res) => {
        try {
            const rawPath = req.params[0];
            // Sanitize
            const safePath = path.normalize(rawPath).replace(/^(\.\.(\/|\\|$))+/, '');

            let filePath = path.join(targetDir, safePath);
            if (!fs.existsSync(filePath)) {
                filePath = path.join(targetDir, safePath + '.md');
            }

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Page not found' });
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const html = renderMarkdown(content);

            res.json({ html });

        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to render page' });
        }
    });

    // Fallback for SPA routing
    if (fs.existsSync(FRONTEND_DIR)) {
        app.get('*', (req, res) => {
            if (!req.path.startsWith('/api')) {
                res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
            } else {
                res.status(404).json({ error: 'Not found' });
            }
        });
    }

    return app.listen(port, () => {
        console.log(`Backend running at http://localhost:${port}`);
        console.log(`Serving API for content in: ${targetDir}`);
    });
}

// Auto-start if run directly
if (require.main === module) {
    startServer(GLOBAL_DEFAULT_PORT);
}

module.exports = { startServer };
