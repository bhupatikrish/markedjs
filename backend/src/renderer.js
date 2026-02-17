const marked = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

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
    const rawHtml = marked.parse(markdown);
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['div', 'pre', 'code'], // Ensure div is allowed (usually is)
        ADD_ATTR: ['class']
    });
    return cleanHtml;
}

module.exports = { renderMarkdown };
