function extractPageContent() {
  const content = {
    title: document.title || '',
    url: window.location.href,
    description: getMetaDescription(),
    mainContent: extractMainContent(),
    headings: extractHeadings()
  };
  return content;
}

function getMetaDescription() {
  const selectors = [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]'
  ];

  for (const selector of selectors) {
    const meta = document.querySelector(selector);
    if (meta?.content) {
      return meta.content;
    }
  }
  return '';
}

function extractHeadings() {
  const headings = [];
  const h1s = document.querySelectorAll('h1');
  const h2s = document.querySelectorAll('h2');

  h1s.forEach(h => {
    const text = h.innerText?.trim();
    if (text && text.length < 200) {
      headings.push({ level: 1, text });
    }
  });

  h2s.forEach(h => {
    const text = h.innerText?.trim();
    if (text && text.length < 200) {
      headings.push({ level: 2, text });
    }
  });

  return headings.slice(0, 10);
}

function extractMainContent() {
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
    '.markdown-body',
    '.post-body'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = cleanText(el.innerText);
      if (text.length > 100) {
        return truncateText(text, 2000);
      }
    }
  }

  const body = document.body;
  if (body) {
    const scripts = body.querySelectorAll('script, style, nav, header, footer, aside');
    const clone = body.cloneNode(true);
    clone.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());
    const text = cleanText(clone.innerText);
    return truncateText(text, 2000);
  }

  return '';
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    try {
      const content = extractPageContent();
      sendResponse({ success: true, content });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});
