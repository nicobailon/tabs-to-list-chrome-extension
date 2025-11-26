# Tabs to List

A Chrome/Brave extension that exports all open tabs to an organized markdown document using Claude Haiku 4.5 for intelligent summarization and categorization.

## Features

- Extracts content from all tabs in the current window
- AI-powered organization groups related tabs under logical categories
- Brief summary generated for each tab
- Automatic download to ~/Downloads as markdown
- Handles large tab counts (50+) with batched processing

## Installation

1. Clone or download this repository
2. Open Chrome/Brave and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select the project folder

## Authentication

The extension requires Anthropic API access to use Claude Haiku 4.5.

### Option 1: OAuth (Experimental)

Click **"Connect Anthropic Account"** to attempt OAuth login with your Claude Pro/Max account.

> **Note:** Anthropic does not offer public OAuth registration, so this may not work. Use API key authentication as a fallback.

### Option 2: API Key (Recommended)

1. Get your API key from [console.anthropic.com](https://console.anthropic.com)
2. Paste it into the input field in the extension popup
3. Click **Save**

## Usage

1. Click the extension icon in your browser toolbar
2. Authenticate using one of the methods above
3. Click **"Export Tabs to Markdown"**
4. A markdown file will download to your Downloads folder

## Output Example

```markdown
# Browser Tabs Export

> **Exported:** Wednesday, November 26, 2024 at 10:30 AM
> **Total Tabs:** 15

---

## Development Research
- [React Documentation](https://react.dev) - Official React docs covering hooks, components, and best practices
- [TypeScript Handbook](https://typescriptlang.org/docs) - Comprehensive guide to TypeScript features and patterns

## Shopping
- [Amazon - Mechanical Keyboards](https://amazon.com/...) - Search results for mechanical keyboards with Cherry MX switches
```

## Tech Stack

- Manifest V3 Chrome Extension
- Claude Haiku 4.5 (claude-haiku-4-5-20250929)
- Vanilla JavaScript (ES Modules)

## License

MIT
