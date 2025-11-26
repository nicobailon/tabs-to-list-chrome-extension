document.addEventListener('DOMContentLoaded', init);

async function init() {
  await updateAuthState();
  await updateTabCount();
  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById('oauth-btn').addEventListener('click', handleOAuth);
  document.getElementById('save-key-btn').addEventListener('click', handleSaveApiKey);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('export-btn').addEventListener('click', handleExport);
}

async function updateAuthState() {
  const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });
  const isAuthenticated = response.success && response.authenticated;

  document.getElementById('logged-out').classList.toggle('hidden', isAuthenticated);
  document.getElementById('logged-in').classList.toggle('hidden', !isAuthenticated);
  document.getElementById('export-btn').disabled = !isAuthenticated;
}

async function updateTabCount() {
  const response = await chrome.runtime.sendMessage({ action: 'getTabCount' });
  if (response.success) {
    document.getElementById('tab-count').textContent = `${response.count} tabs in current window`;
  }
}

async function handleOAuth() {
  const btn = document.getElementById('oauth-btn');
  const originalContent = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = '<span class="loading">Connecting...</span>';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'initiateOAuth' });

    if (response.success) {
      showMessage('Connected successfully!', 'success');
      await updateAuthState();
    } else if (response.oauthFailed) {
      showMessage('OAuth not available. Please use an API key instead.', 'info');
    } else {
      showMessage(response.error || 'Connection failed', 'error');
    }
  } catch (error) {
    showMessage('Connection failed: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalContent;
  }
}

async function handleSaveApiKey() {
  const input = document.getElementById('api-key-input');
  const apiKey = input.value.trim();

  if (!apiKey) {
    showMessage('Please enter an API key', 'error');
    return;
  }

  const btn = document.getElementById('save-key-btn');
  btn.disabled = true;
  btn.textContent = 'Validating...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveApiKey',
      apiKey: apiKey
    });

    if (response.success) {
      input.value = '';
      showMessage('API key saved!', 'success');
      await updateAuthState();
    } else {
      showMessage(response.error || 'Invalid API key', 'error');
    }
  } catch (error) {
    showMessage('Failed to save: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

async function handleLogout() {
  await chrome.runtime.sendMessage({ action: 'logout' });
  showMessage('Disconnected', 'info');
  await updateAuthState();
}

async function handleExport() {
  const btn = document.getElementById('export-btn');
  const progress = document.getElementById('progress');
  const progressFill = progress.querySelector('.fill');
  const statusText = progress.querySelector('.status-text');

  btn.disabled = true;
  progress.classList.remove('hidden');
  progressFill.classList.add('indeterminate');

  const steps = [
    'Collecting tabs...',
    'Extracting content...',
    'Analyzing with Claude...',
    'Generating markdown...',
    'Downloading...'
  ];

  let stepIndex = 0;
  statusText.textContent = steps[stepIndex];

  const stepInterval = setInterval(() => {
    stepIndex = (stepIndex + 1) % (steps.length - 1);
    statusText.textContent = steps[stepIndex];
  }, 2000);

  try {
    const response = await chrome.runtime.sendMessage({ action: 'exportTabs' });

    clearInterval(stepInterval);

    if (response.success) {
      progressFill.classList.remove('indeterminate');
      progressFill.style.width = '100%';
      statusText.textContent = 'Complete!';

      const message = response.fallback
        ? `Exported ${response.tabCount} tabs (basic format)`
        : `Exported ${response.tabCount} tabs with AI organization`;

      showMessage(message, 'success');

      setTimeout(() => {
        progress.classList.add('hidden');
        progressFill.style.width = '0%';
      }, 2000);
    } else {
      throw new Error(response.error || 'Export failed');
    }
  } catch (error) {
    clearInterval(stepInterval);
    progress.classList.add('hidden');
    progressFill.classList.remove('indeterminate');
    progressFill.style.width = '0%';
    showMessage('Export failed: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function showMessage(text, type = 'info') {
  const messageEl = document.getElementById('status-message');
  messageEl.textContent = text;
  messageEl.className = type;
  messageEl.classList.remove('hidden');

  setTimeout(() => {
    messageEl.classList.add('hidden');
  }, 5000);
}
