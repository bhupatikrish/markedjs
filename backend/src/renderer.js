const marked = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Simple Slugger implementation since marked.Slugger is not exposed
class Slugger {
    constructor() {
        this.seen = {};
    }

    slug(value) {
        if (typeof value !== 'string') {
            return '';
        }
        let slug = value
            .toLowerCase()
            .trim()
            .replace(/[^\w]+/g, '-')
            .replace(/^-+|-+$/g, '');

        if (this.seen.hasOwnProperty(slug)) {
            const originalSlug = slug;
            do {
                this.seen[originalSlug]++;
                slug = `${originalSlug}-${this.seen[originalSlug]}`;
            } while (this.seen.hasOwnProperty(slug));
        }

        this.seen[slug] = 0;
        return slug;
    }
}

// Configure marked with custom renderer
const renderer = {
    code(token) {
        if (token.lang === 'mermaid') {
            return `<div class="mermaid">${token.text}</div>`;
        }
        // Default handling for other code blocks
        return false;
    }
};

marked.use({ renderer });

marked.setOptions({
    gfm: true,
    breaks: true
});

function renderMarkdown(markdown) {
    const toc = [];
    // Use our local Slugger
    const slugger = new Slugger();

    // Custom walker to extract TOC
    const walker = (token) => {
        if (token.type === 'heading' && (token.depth === 2 || token.depth === 3)) {
            const text = token.text;
            const id = slugger.slug(text);
            toc.push({
                id,
                text,
                depth: token.depth
            });
            // We need to ensure the ID is actually in the rendered HTML. 
            // Marked adds ids by default but we want to be sure they match our slugger.
        }
    };

    // Parse to tokens first
    const tokens = marked.lexer(markdown);

    // Walk tokens to build TOC
    tokens.forEach(walker);

    // Render HTML using the tokens
    // We need to ensure headings have the correct IDs. 
    // The easiest way is to let Marked handle it but use the same Slugger instance if possible.
    // However, marked.parse(tokens) doesn't easily expose the slugger.
    // A better approach for TOC + content sync is to use a custom renderer for headings too.



    // But wait, we need to extract IDs *exactly* as marked renders them or enforce them.
    // Let's do this: 
    // 1. We already have the tokens.
    // 2. We can modify the tokens to inject the ID we want?
    // 3. Or just trust the slugify logic.

    // Simpler approach for POC:
    // Parsing again is inefficient but safe. 
    // Let's just walk the tokens we extracted.

    // Corrections for the actual implementation:
    // We need to use `slugger` inside the renderer to ensure uniqueness (e.g. Intro vs Intro 2).

    const tocSlugger = new Slugger();
    const renderSlugger = new Slugger();
    const finalToc = [];

    // Traverse tokens to build TOC
    tokens.forEach(token => {
        if (token.type === 'heading' && (token.depth === 2 || token.depth === 3)) {
            const id = tocSlugger.slug(token.text);
            finalToc.push({ id, text: token.text, depth: token.depth });
        }
    });

    // Use a renderer that uses the SAME slugger logic
    const safeRenderer = {
        heading(text, level, raw, slugger) {
            // Check if first arg is object (new signature) or string (old signature)
            // In marked v12, strict mode renderer receives object { tokens, depth, text }
            // But plain renderer receives string text, number level...

            if (typeof text === 'object' && text !== null && !Array.isArray(text)) {
                const token = text;
                level = token.depth;
                text = token.text;
                // raw = token.raw;
            }

            // Now text is string, level is number.
            const id = renderSlugger.slug(text);
            return `<h${level} id="${id}">${text}</h${level}>\n`;
        }
    };

    marked.use({ renderer: safeRenderer });

    const rawHtml = marked.parser(tokens);
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['div', 'pre', 'code'],
        ADD_ATTR: ['class', 'id'] // Allow IDs for anchor links
    });

    return { html: cleanHtml, toc: finalToc };
}

module.exports = { renderMarkdown };
