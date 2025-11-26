const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20250929';
const MAX_TOKENS = 8192;

export async function organizeTabsWithClaude(tabsData, authToken) {
  const totalTabs = tabsData.length;

  if (totalTabs <= 30) {
    return await processSingleBatch(tabsData, authToken);
  }

  return await processInBatches(tabsData, authToken);
}

async function processSingleBatch(tabsData, authToken) {
  const prompt = buildOrganizationPrompt(tabsData);

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': authToken,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function processInBatches(tabsData, authToken) {
  const BATCH_SIZE = 25;
  const batches = [];

  for (let i = 0; i < tabsData.length; i += BATCH_SIZE) {
    batches.push(tabsData.slice(i, i + BATCH_SIZE));
  }

  const batchResults = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const prompt = buildBatchSummaryPrompt(batch, i + 1, batches.length);

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': authToken,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    batchResults.push(data.content?.[0]?.text || '');
  }

  const mergePrompt = buildMergePrompt(batchResults);
  const mergeResponse = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': authToken,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{
        role: 'user',
        content: mergePrompt
      }]
    })
  });

  if (!mergeResponse.ok) {
    return batchResults.join('\n\n---\n\n');
  }

  const mergeData = await mergeResponse.json();
  return mergeData.content?.[0]?.text || batchResults.join('\n\n---\n\n');
}

function buildOrganizationPrompt(tabsData) {
  const tabsList = tabsData.map((tab, i) => {
    const content = tab.content?.mainContent || tab.content?.description || '';
    const headings = tab.content?.headings?.map(h => h.text).join(', ') || '';

    return `[Tab ${i + 1}]
Title: ${tab.title || 'Untitled'}
URL: ${tab.url}
Description: ${tab.content?.description || 'N/A'}
Headings: ${headings || 'N/A'}
Content Preview: ${content.substring(0, 1200) || 'No content available'}`;
  }).join('\n\n');

  return `You are organizing browser tabs into a well-structured markdown document. Analyze these ${tabsData.length} tabs and:

1. Write a brief 1-2 sentence summary for each tab based on its content
2. Group related tabs under descriptive category headings (e.g., "Development Research", "Shopping", "News & Articles", etc.)
3. Order categories by relevance/importance
4. Output clean, well-formatted markdown

TABS TO ORGANIZE:
${tabsList}

OUTPUT FORMAT:
## [Category Name]
- [Tab Title](url) - Brief summary describing the page content and why it's useful

RULES:
- Create logical groupings based on content similarity and topic
- Each tab must appear exactly once
- Categories should have descriptive, meaningful names
- Summaries should be concise but informative (1-2 sentences)
- Output ONLY the markdown, no explanations or preamble`;
}

function buildBatchSummaryPrompt(tabsData, batchNum, totalBatches) {
  const tabsList = tabsData.map((tab, i) => {
    const content = tab.content?.mainContent || tab.content?.description || '';
    return `[Tab]
Title: ${tab.title || 'Untitled'}
URL: ${tab.url}
Content: ${content.substring(0, 800) || 'No content'}`;
  }).join('\n\n');

  return `Summarize and categorize these browser tabs (batch ${batchNum}/${totalBatches}).

For each tab, provide:
1. A category suggestion
2. A 1-2 sentence summary

TABS:
${tabsList}

Output format per tab:
CATEGORY: [suggested category]
TITLE: [tab title]
URL: [url]
SUMMARY: [your summary]
---`;
}

function buildMergePrompt(batchResults) {
  return `You have categorized browser tabs in batches. Now merge them into a single, well-organized markdown document.

BATCH RESULTS:
${batchResults.join('\n\n=== NEXT BATCH ===\n\n')}

INSTRUCTIONS:
1. Combine similar categories across batches
2. Create a cohesive document with clear category headings
3. Format as clean markdown with links and summaries

OUTPUT FORMAT:
## [Category Name]
- [Tab Title](url) - Summary

Output ONLY the final markdown document.`;
}
