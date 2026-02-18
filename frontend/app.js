const API_BASE = '/api';

// State
let catalog = {};
let currentContext = 'catalog'; // 'catalog' or 'product'
let lastRenderedPath = '';

async function init() {
    try {
        console.log('App initializing...');

        // Fetch Catalog from Backend
        const res = await fetch(`${API_BASE}/navigation`);
        if (!res.ok) throw new Error('Failed to load catalog');

        const data = await res.json();
        catalog = data;

        // Initial Route Handler
        await handleRouting();

        // Handle browser back/forward
        window.addEventListener('popstate', handleRouting);

        // Intercept clicks for client-side routing
        document.body.addEventListener('click', e => {
            if (e.target.matches('[data-link]')) {
                e.preventDefault();
                navigateTo(e.target.getAttribute('href'));

                // Close sidebar on mobile if open
                const sidebar = document.getElementById('sidebar');
                const backdrop = document.getElementById('sidebar-backdrop');
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    backdrop.classList.remove('open');
                }
            } else if (e.target.matches('[data-toc-link]')) {
                // Allow default behavior for anchor links (updating hash)
                // But popstate will fire, so handleRouting needs to know not to re-render
            }
        });

        // Mobile Menu Toggle
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');

        if (menuToggle && sidebar && backdrop) {
            const toggleMenu = () => {
                sidebar.classList.toggle('open');
                backdrop.classList.toggle('open');
            };

            menuToggle.addEventListener('click', toggleMenu);
            backdrop.addEventListener('click', toggleMenu);
        }

    } catch (e) {
        console.error('Init error:', e);
        const container = document.getElementById('content-area');
        if (container) container.innerHTML = `<h1>Error loading application</h1><p>${e.message}</p>`;
    }
}

function navigateTo(url) {
    history.pushState(null, null, url);
    handleRouting();
}

async function handleRouting() {
    const path = window.location.pathname;

    // If path hasn't changed (e.g. hash change), don't re-render
    if (path === lastRenderedPath) {
        // We might want to handle scroll if hash is present
        if (window.location.hash) {
            const id = window.location.hash.substring(1);
            const el = document.getElementById(id);
            if (el) el.scrollIntoView();
        }
        return;
    }

    lastRenderedPath = path;

    const contentDiv = document.getElementById('content-area');
    if (!contentDiv) return;

    if (path === '/' || path === '/index.html') {
        currentContext = 'catalog';
        const headerContext = document.getElementById('header-context');
        if (headerContext) headerContext.textContent = '';
        renderSidebar();
        renderLandingPage(contentDiv);
    }
    else if (path.startsWith('/docs/')) {
        currentContext = 'product';

        // URL: /docs/infrastructure/cloud/s3/intro
        const raw = path.replace('/docs/', '');

        // Parse product path
        const parts = raw.split('/');
        let productPath = '';

        if (parts.length >= 3) {
            productPath = parts.slice(0, 3).join('/');
        } else {
            productPath = raw;
        }

        renderSidebar();
        await renderDocPage(contentDiv, raw);
    } else {
        contentDiv.innerHTML = '<h1>404 Not Found</h1>';
    }
}

async function renderDocPage(container, apiPath) {
    try {
        container.innerHTML = '<div class="loading">Loading content...</div>';

        // Clear TOC
        const tocSidebar = document.getElementById('toc-sidebar');
        if (tocSidebar) {
            tocSidebar.innerHTML = '';
            tocSidebar.classList.remove('visible');
        }

        const res = await fetch(`${API_BASE}/page/${apiPath}`);
        if (!res.ok) throw new Error(`Document not found: ${apiPath}`);

        const data = await res.json();

        // Backend returns pre-rendered HTML
        container.innerHTML = `<div class="markdown-body">${data.html}</div>`;

        // Render TOC if available
        if (data.toc && data.toc.length > 0 && tocSidebar) {
            renderTOC(data.toc, tocSidebar);
        }

        // Custom mermaid initialization for the rendered content
        if (window.mermaid) {
            try {
                // Backend renderer outputs <pre><code class="language-mermaid">
                const mermaidBlocks = container.querySelectorAll('.language-mermaid');

                if (mermaidBlocks.length > 0) {
                    await mermaid.run({
                        nodes: mermaidBlocks,
                    });
                }
            } catch (e) {
                console.log('Mermaid run failed, trying init fallback', e);
                mermaid.init(undefined, container.querySelectorAll('.language-mermaid'));
            }
        }

    } catch (e) {
        container.innerHTML = `<h1>Error</h1><p>${e.message}</p>`;
    }
}

function renderTOC(toc, container) {
    container.classList.add('visible');

    let html = '<div class="toc-title">On this page</div><ul class="toc-list">';

    toc.forEach(item => {
        const indentClass = item.depth === 3 ? 'toc-depth-3' : '';
        html += `<li class="toc-item ${indentClass}">
    <a href="#${item.id}" class="toc-link" data-toc-link>${item.text}</a>
</li>`;
    });

    html += '</ul>';
    container.innerHTML = html;

    // Scroll Spy Implementation
    setupScrollSpy();
}

function setupScrollSpy() {
    const observerOptions = {
        root: document.getElementById('content-area'), // Watch scroll in content area
        rootMargin: '0px 0px -80% 0px', // Trigger when element is near top
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Activate link
                const id = entry.target.id;

                // Clear all active
                document.querySelectorAll('.toc-link').forEach(link => link.classList.remove('active'));

                // Set active
                const activeLink = document.querySelector(`.toc-link[href="#${id}"]`);
                if (activeLink) {
                    activeLink.classList.add('active');
                    // Ensure TOC scrolls to active item
                    activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }
        });
    }, observerOptions);

    // Observe all headings
    document.querySelectorAll('.markdown-body h2, .markdown-body h3').forEach(heading => {
        observer.observe(heading);
    });
}

function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const path = window.location.pathname;
    const isDocPage = path.startsWith('/docs/');
    let html = '';

    if (isDocPage) {
        // --- Product Context ---

        // Find current product
        // path: /docs/infrastructure/cloud/s3/intro
        // product path: infrastructure/cloud/s3

        let currentProduct = null;
        if (catalog.products) {
            currentProduct = catalog.products.find(p => path.startsWith(`/docs/${p.path}`));
        }

        html += '<div class="nav-tree">';

        // Back Link
        html += '<div class="nav-back"><a href="/" data-link class="nav-item">← Back to Catalog</a></div>';

        if (currentProduct) {
            // Product Title
            html += `<div class="nav-product-title">${currentProduct.title}</div>`;

            // Product Navigation
            if (currentProduct.navigation) {
                html += '<ul class="nav-product-pages">';

                // Always include Intro/Home of product if not explicitly in nav? 
                // Usually docs.yaml includes all pages. We'll stick to what's defined.

                currentProduct.navigation.forEach(item => {
                    // item: { url: '/intro', Label: 'Introduction' }
                    const cleanItemUrl = item.url.startsWith('/') ? item.url.substring(1) : item.url;
                    const fullItemPath = `/docs/${currentProduct.path}/${cleanItemUrl}`;

                    // Check active state
                    const isActive = path === fullItemPath;
                    const activeClass = isActive ? 'active' : '';

                    html += `<li>
                <a href="${fullItemPath}" data-link class="nav-page-link ${activeClass}">
                    ${item.Label}
                </a>
            </li>`;
                });
                html += '</ul>';
            } else {
                html += '<div style="padding: 10px; color: #666;">No navigation defined.</div>';
            }
        } else {
            html += '<div style="padding: 10px; color: red;">Product not found in catalog.</div>';
        }

        html += '</div>';

    } else {
        // --- Catalog Context (Landing Page) ---
        html += '<div class="nav-tree">';
        html += '<div class="nav-home"><a href="/" data-link class="nav-item active">Home</a></div>';

        if (catalog.products) {
            // Group by Domain -> System
            const hierarchy = {};

            catalog.products.forEach(p => {
                const parts = p.path.split('/');
                if (parts.length >= 3) {
                    const domain = parts[0];
                    const system = parts[1];

                    if (!hierarchy[domain]) hierarchy[domain] = {};
                    if (!hierarchy[domain][system]) hierarchy[domain][system] = [];
                    hierarchy[domain][system].push(p);
                } else {
                    // Fallback for non-standard paths
                    if (!hierarchy['Other']) hierarchy['Other'] = {};
                    if (!hierarchy['Other']['Misc']) hierarchy['Other']['Misc'] = [];
                    hierarchy['Other']['Misc'].push(p);
                }
            });

            // Render Hierarchy
            for (const [domain, systems] of Object.entries(hierarchy)) {
                html += `<div class="nav-domain">${domain}</div>`;

                for (const [system, products] of Object.entries(systems)) {
                    html += `<details open>
                <summary class="nav-system">${system}</summary>
                <ul class="nav-products">`;

                    products.forEach(p => {
                        html += `<li>
                    <a href="/docs/${p.path}/intro" data-link class="nav-product-link">${p.title}</a>
                </li>`;
                    });

                    html += `</ul></details>`;
                }
            }
        }
        html += '</div>';
    }

    sidebar.innerHTML = html;
}

function renderLandingPage(container) {
    let html = `
    <div class="hero-section">
        <div class="hero-title">Documentation Portal</div>
        <div class="hero-subtitle">Explore guides, references, and resources for our platform.</div>
    </div>`;

    if (catalog.products && catalog.products.length > 0) {
        const hierarchy = {};

        catalog.products.forEach(p => {
            const parts = p.path.split('/');
            if (parts.length >= 3) {
                const domain = parts[0];
                const system = parts[1];

                if (!hierarchy[domain]) hierarchy[domain] = {};
                if (!hierarchy[domain][system]) hierarchy[domain][system] = [];
                hierarchy[domain][system].push(p);
            } else {
                if (!hierarchy['Other']) hierarchy['Other'] = {};
                if (!hierarchy['Other']['Misc']) hierarchy['Other']['Misc'] = [];
                hierarchy['Other']['Misc'].push(p);
            }
        });

        html += '<div class="catalog-grid">';

        for (const [domain, systems] of Object.entries(hierarchy)) {
            html += `<div class="domain-section">
        <div class="domain-title">${domain}</div>`;

            for (const [system, products] of Object.entries(systems)) {
                html += `<div class="system-group">
            <div class="system-title">${system}</div>
            <div class="product-grid">`;

                products.forEach(p => {
                    html += `
            <div class="product-card">
                <h3>${p.title}</h3>
                <p class="meta">/docs/${p.path}</p>
                <p>${p.description || 'Comprehensive guides and API references.'}</p>
                <a href="/docs/${p.path}/intro" data-link class="btn">View Documentation</a>
            </div>`;
                });

                html += `</div></div>`;
            }
            html += `</div>`;
        }
        html += '</div>';

    } else {
        html += '<p style="text-align:center; color: #666; margin-top: 50px;">No products found in the catalog.</p>';
    }

    container.innerHTML = html;
}

// Start App
init();
