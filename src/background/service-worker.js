import { getAuthToken, saveApiKey, logout, initiateOAuth, isAuthenticated } from '../lib/auth.js';
import { organizeTabsWithClaude } from '../lib/anthropic.js';
import { generateMarkdownDocument, generateFilename, generateFallbackMarkdown } from '../lib/markdown.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender).then(sendResponse).catch(error => {
    sendResponse({ success: false, error: error.message });
  });
  return true;
});

async function handleMessage(request) {
  switch (request.action) {
    case 'checkAuth':
      return { success: true, authenticated: await isAuthenticated() };

    case 'saveApiKey':
      await saveApiKey(request.apiKey);
      return { success: true };

    case 'initiateOAuth':
      try {
        await initiateOAuth();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message, oauthFailed: true };
      }

    case 'logout':
      await logout();
      return { success: true };

    case 'exportTabs':
      return await exportTabs();

    case 'getTabCount':
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return { success: true, count: tabs.length };

    default:
      throw new Error(`Unknown action: ${request.action}`);
  }
}

async function exportTabs() {
  const authToken = await getAuthToken();
  if (!authToken) {
    throw new Error('Not authenticated');
  }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const tabsData = [];

  for (const tab of tabs) {
    const tabData = {
      title: tab.title || 'Untitled',
      url: tab.url || '',
      content: null
    };

    if (tab.url?.startsWith('http')) {
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractPageContent
        });
        tabData.content = result?.result || null;
      } catch {
        tabData.content = null;
      }
    }

    tabsData.push(tabData);
  }

  let organizedContent;
  try {
    organizedContent = await organizeTabsWithClaude(tabsData, authToken);
  } catch (error) {
    console.error('Claude API error, using fallback:', error);
    organizedContent = generateFallbackMarkdown(tabsData);
    const markdown = organizedContent;
    await downloadMarkdown(markdown);
    return { success: true, tabCount: tabsData.length, fallback: true };
  }

  const markdown = generateMarkdownDocument(organizedContent, {
    tabCount: tabsData.length
  });

  await downloadMarkdown(markdown);

  return { success: true, tabCount: tabsData.length };
}

function extractPageContent() {
  function getMetaDescription() {
    const selectors = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]'
    ];
    for (const selector of selectors) {
      const meta = document.querySelector(selector);
      if (meta?.content) return meta.content;
    }
    return '';
  }

  function extractHeadings() {
    const headings = [];
    document.querySelectorAll('h1, h2').forEach(h => {
      const text = h.innerText?.trim();
      if (text && text.length < 200) {
        headings.push({ level: h.tagName === 'H1' ? 1 : 2, text });
      }
    });
    return headings.slice(0, 10);
  }

  function extractMainContent() {
    const selectors = [
      'article', 'main', '[role="main"]', '.post-content',
      '.article-content', '.entry-content', '.content', '#content',
      '.markdown-body', '.post-body'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.innerText?.replace(/\s+/g, ' ').trim();
        if (text?.length > 100) {
          return text.substring(0, 2000);
        }
      }
    }
    const body = document.body;
    if (body) {
      const clone = body.cloneNode(true);
      clone.querySelectorAll('script, style, nav, header, footer, aside, [hidden]').forEach(el => el.remove());
      const text = clone.innerText?.replace(/\s+/g, ' ').trim();
      return text?.substring(0, 2000) || '';
    }
    return '';
  }

  return {
    title: document.title || '',
    url: window.location.href,
    description: getMetaDescription(),
    mainContent: extractMainContent(),
    headings: extractHeadings()
  };
}

async function downloadMarkdown(content) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const filename = generateFilename();

  try {
    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
