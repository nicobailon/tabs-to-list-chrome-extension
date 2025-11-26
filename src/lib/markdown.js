export function generateMarkdownDocument(organizedContent, metadata) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const header = `# Browser Tabs Export

> **Exported:** ${dateStr} at ${timeStr}
> **Total Tabs:** ${metadata.tabCount}
> **Window:** Current Window

---

`;

  return header + organizedContent;
}

export function generateFilename() {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  return `tabs-export-${date}-${time}.md`;
}

export function generateFallbackMarkdown(tabsData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let markdown = `# Browser Tabs Export

> **Exported:** ${dateStr}
> **Total Tabs:** ${tabsData.length}

---

## All Tabs

`;

  const tabsByDomain = groupTabsByDomain(tabsData);

  for (const [domain, tabs] of Object.entries(tabsByDomain)) {
    markdown += `### ${domain}\n\n`;
    for (const tab of tabs) {
      const safeTitle = escapeMarkdownLinkText(tab.title || 'Untitled');
      const safeUrl = escapeMarkdownUrl(tab.url);
      markdown += `- [${safeTitle}](${safeUrl})\n`;
    }
    markdown += '\n';
  }

  return markdown;
}

function escapeMarkdownLinkText(text) {
  return text.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function escapeMarkdownUrl(url) {
  return url.replace(/\)/g, '%29').replace(/\s/g, '%20');
}

function groupTabsByDomain(tabsData) {
  const groups = {};

  for (const tab of tabsData) {
    let domain = 'Other';
    try {
      const url = new URL(tab.url);
      domain = url.hostname.replace('www.', '');
    } catch {
      domain = 'Other';
    }

    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(tab);
  }

  const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  return Object.fromEntries(sorted);
}
