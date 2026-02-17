const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DEFAULT_PRODUCTS_DIR = path.resolve(__dirname, '../../products');

function getCatalog(rootDir = DEFAULT_PRODUCTS_DIR) {
    const products = [];

    // Recursive search for docs.yaml
    function scanDir(dir) {
        if (!fs.existsSync(dir)) return;

        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                scanDir(fullPath);
            } else if (entry.name === 'docs.yaml') {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const parsed = yaml.load(content);

                    // Add path relative to the SCANNED ROOT (rootDir)
                    // This ensures that valid URLs are generated relative to the preview context
                    const relPath = path.relative(rootDir, dir);

                    products.push({
                        ...parsed,
                        path: relPath || '.', // Handle case where docs.yaml is in rootDir
                        fullPath: dir
                    });
                } catch (e) {
                    console.error(`Error parsing ${fullPath}:`, e);
                }
            }
        }
    }

    if (fs.existsSync(rootDir)) {
        scanDir(rootDir);
    }

    return { products };
}

module.exports = { getCatalog, DEFAULT_PRODUCTS_DIR };
