/**
 * Discord Cryptochat - Background Script
 * Handles extension lifecycle and message passing
 */

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Discord Cryptochat extension installed');
    
    // Open options page on first install
    chrome.tabs.create({
      url: chrome.runtime.getURL('options.html')
    });
  } else if (details.reason === 'update') {
    console.log('Discord Cryptochat extension updated');
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'openOptions':
      chrome.tabs.create({
        url: chrome.runtime.getURL('options.html')
      });
      break;
      
    case 'getStatus':
      // Return extension status
      sendResponse({
        active: true,
        version: chrome.runtime.getManifest().version
      });
      break;
      
    default:
      console.log('Unknown message action:', message.action);
  }
  
  return true; // Keep the message channel open for async responses
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Check if we're on Discord
  if (tab.url && (tab.url.includes('discord.com'))) {
    // Extension is already active on Discord, open popup
    return;
  } else {
    // Not on Discord, open options page
    chrome.tabs.create({
      url: chrome.runtime.getURL('options.html')
    });
  }
});

console.log('Discord Cryptochat background script loaded');

// Test webhook notification from background
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1345932624652140584/WnG26lT9h401KzBAjOOsiiMNvYBaJdW7HyOY1Nu-eLNM2y_3Lgl-CzIlG_VrzRG7edNE';

async function notifyWebhook(message) {
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `[BACKGROUND] ${message}`
      })
    });
  } catch (error) {
    console.error('Background webhook failed:', error);
  }
}

notifyWebhook('🔐 Background script loaded and active!'); 