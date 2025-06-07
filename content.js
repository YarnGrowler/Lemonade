/**
 * Discord Cryptochat - Content Script
 * Handles message interception and encryption/decryption
 */

// Simple console logging only
class Logger {
  static async log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    // Console log only
    console.log(logMessage, data || '');
    
    // Show in page if needed
    if (message.includes('❌') || message.includes('ERROR')) {
      Logger.showPageNotification(message, 'error');
    } else if (message.includes('✅')) {
      Logger.showPageNotification(message, 'success');
    }
  }
  
  static showPageNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 999999;
      background: ${type === 'error' ? '#ff6b6b' : type === 'success' ? '#48bb78' : '#667eea'};
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      max-width: 400px;
      word-wrap: break-word;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }
}

// Immediate load test
Logger.log('🔐 [CRYPTO] EXTENSION SCRIPT LOADED - Testing if this appears!');
Logger.log('🔐 [CRYPTO] Current URL: ' + window.location.href);
Logger.log('🔐 [CRYPTO] User Agent: ' + navigator.userAgent);

class DiscordCryptochat {
  constructor() {
    this.isEnabled = true;
    this.encryptionKey = null;
    this.messageObserver = null;
    this.lastProcessedMessage = null;
    
    this.init();
  }

  async init() {
    await Logger.log('🔐 [CRYPTO] ========================================');
    await Logger.log('🔐 [CRYPTO] Discord Cryptochat extension loaded');
    await Logger.log('🔐 [CRYPTO] URL: ' + window.location.href);
    await Logger.log('🔐 [CRYPTO] Document ready state: ' + document.readyState);
    await Logger.log('🔐 [CRYPTO] ========================================');
    
    // Load encryption key
    await this.loadKey();
    
    // Wait for Discord to load
    if (document.readyState === 'loading') {
      await Logger.log('🔐 [CRYPTO] Document still loading, waiting for DOMContentLoaded...');
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      await Logger.log('🔐 [CRYPTO] Document already loaded, setting up immediately...');
      this.setup();
    }
  }

  async loadKey() {
    console.log('🔐 [CRYPTO] Loading encryption key from storage...');
    try {
      this.encryptionKey = await discordCrypto.getStoredKey();
      if (!this.encryptionKey) {
        console.warn('🔐 [CRYPTO] ❌ No encryption key found. Please set one in the extension options.');
        this.showKeyWarning();
      } else {
        console.log('🔐 [CRYPTO] ✅ Encryption key loaded successfully');
        console.log(`🔐 [CRYPTO] Key length: ${this.encryptionKey.length} characters`);
      }
    } catch (error) {
      console.error('🔐 [CRYPTO] ❌ Failed to load encryption key:', error);
    }
  }

  async setup() {
    await Logger.log('🔐 [CRYPTO] Starting extension setup...');
    
    // Setup message interception
    await Logger.log('🔐 [CRYPTO] Setting up outgoing message interception...');
    await this.setupOutgoingMessageInterception();
    
    // Setup incoming message decryption
    await Logger.log('🔐 [CRYPTO] Setting up incoming message decryption...');
    await this.setupIncomingMessageDecryption();
    
    // Add extension indicator
    await Logger.log('🔐 [CRYPTO] Adding extension indicator...');
    this.addExtensionIndicator();
    
    await Logger.log('🔐 [CRYPTO] ✅ Extension setup complete!');
  }

  async setupOutgoingMessageInterception() {
    await Logger.log('🔐 [CRYPTO] Setting up outgoing message interception...');
    
    // Flag to prevent processing our own encrypted messages
    this.isProcessingMessage = false;
    
    // Listen for keydown events on the message input with capture
    document.addEventListener('keydown', async (event) => {
      // Only log important keypresses to reduce noise
      if (event.key === 'Enter' && !event.shiftKey && !this.isProcessingMessage) {
        await Logger.log('🔐 [CRYPTO] Enter key detected (no shift)');
        
        // Safely check if target has required methods
        if (!event.target || typeof event.target.closest !== 'function') {
          return;
        }
        
        // Find Discord message input
        const messageBox = event.target.closest('[data-slate-editor="true"]') || 
                          event.target.closest('[role="textbox"]') ||
                          event.target.closest('div[contenteditable="true"]');
        
        if (messageBox && messageBox.hasAttribute && messageBox.hasAttribute('data-slate-editor')) {
          await Logger.log('🔐 [CRYPTO] Found Discord message box');
          await this.handleOutgoingMessage(event, messageBox);
        }
      }
    }, true);
    
    await Logger.log('🔐 [CRYPTO] Outgoing message interception setup complete');
  }

  async handleOutgoingMessage(event, messageBox) {
    // Prevent infinite loop
    if (this.isProcessingMessage) {
      return;
    }
    
    await Logger.log('🔐 [CRYPTO] === HANDLING OUTGOING MESSAGE ===');
    
    // Get message text - try multiple methods for Discord's Slate editor
    let messageText = '';
    
    // Method 1: Try textContent
    messageText = messageBox.textContent?.trim() || '';
    
    // Method 2: Try innerText if textContent is empty
    if (!messageText) {
      messageText = messageBox.innerText?.trim() || '';
    }
    
    // Method 3: Look for slate string elements
    if (!messageText) {
      const slateStrings = messageBox.querySelectorAll('[data-slate-string="true"]');
      if (slateStrings.length > 0) {
        messageText = Array.from(slateStrings).map(el => el.textContent).join('').trim();
      }
    }
    
    await Logger.log(`🔐 [CRYPTO] Message text: "${messageText}"`);
    
    // Check if it's a !priv message (and not our own ENC: message)
    if (!messageText.startsWith('!priv ')) {
      return; // Not a private message, let Discord handle it normally
    }

    // Check if it's already encrypted (avoid double processing)
    if (messageText.includes('ENC:')) {
      await Logger.log('🔐 [CRYPTO] ⚠️ Message already contains ENC:, skipping to avoid double processing');
      return;
    }

    await Logger.log('🔐 [CRYPTO] ✅ Detected !priv message!');

    if (!this.encryptionKey) {
      await Logger.log('🔐 [CRYPTO] ❌ No encryption key available');
      event.preventDefault();
      event.stopPropagation();
      this.showKeyWarning();
      return;
    }

    // Extract the actual message (remove !priv prefix)
    const actualMessage = messageText.substring(6).trim();
    await Logger.log(`🔐 [CRYPTO] Actual message to encrypt: "${actualMessage}"`);
    
    if (!actualMessage) {
      await Logger.log('🔐 [CRYPTO] ❌ No actual message content after !priv');
      return;
    }

    try {
      // Set processing flag to prevent interference
      this.isProcessingMessage = true;
      
      await Logger.log('🔐 [CRYPTO] 🚫 Preventing default message send...');
      event.preventDefault();
      event.stopPropagation();

      await Logger.log('🔐 [CRYPTO] 🔒 Starting encryption...');
      const encryptedMessage = await discordCrypto.encrypt(actualMessage, this.encryptionKey);
      const finalMessage = `ENC:${encryptedMessage}`;
      await Logger.log(`🔐 [CRYPTO] ✅ Encryption complete: ${finalMessage}`);

      // HYBRID APPROACH: Use Clipboard API for reliable text replacement
      await Logger.log('🔐 [CRYPTO] ✨ Using clipboard-based text replacement...');
      
      // Focus the message box
      messageBox.focus();
      
      // Store original clipboard content to restore later
      let originalClipboard = '';
      try {
        originalClipboard = await navigator.clipboard.readText();
      } catch (e) {
        // Clipboard access might be denied, that's ok
      }
      
      // Copy encrypted message to clipboard
      await navigator.clipboard.writeText(finalMessage);
      
      // Select all current text
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(messageBox);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Paste the encrypted message (Ctrl+V simulation)
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer()
      });
      
      // Add the encrypted text to clipboard data
      pasteEvent.clipboardData.setData('text/plain', finalMessage);
      
      messageBox.dispatchEvent(pasteEvent);
      
      // Also try execCommand as fallback
      document.execCommand('paste');
      
      // Restore original clipboard if we had one
      if (originalClipboard) {
        setTimeout(() => {
          navigator.clipboard.writeText(originalClipboard);
        }, 1000);
      }
      
      // Wait for Discord to process
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await Logger.log(`🔐 [CRYPTO] ✅ Text replaced via clipboard: "${messageBox.textContent}"`);
      
      await Logger.log('🔐 [CRYPTO] 📤 Attempting to send...');
      
      // Try to find enabled send button
      let sendButton = null;
      const sendSelectors = [
        'button[aria-label="Send Message"]:not([disabled])', // Exact match, not disabled
        'button[aria-label*="Send Message"]:not([disabled])', // Partial match, not disabled
        'button:has(.sendIcon_aa63ab):not([disabled])', // Button with send icon, not disabled
      ];
      
      for (const selector of sendSelectors) {
        sendButton = document.querySelector(selector);
        if (sendButton) {
          await Logger.log(`🔐 [CRYPTO] 🖱️ Found enabled send button: ${selector}`);
          break;
        }
      }
      
      if (sendButton) {
        sendButton.click();
        await Logger.log('🔐 [CRYPTO] ✅ Send button clicked');
      } else {
        await Logger.log('🔐 [CRYPTO] ⌨️ No enabled send button found, using Enter...');
        
        // Simulate Enter key
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true,
          cancelable: true
        });
        
        messageBox.dispatchEvent(enterEvent);
      }
      
      await Logger.log('🔐 [CRYPTO] ✅ Send attempt completed');
      
      // Clear the processing flag after a delay
      setTimeout(async () => {
        this.isProcessingMessage = false;
        await Logger.log('🔐 [CRYPTO] ✅ Processing complete, ready for next message');
      }, 2000);
      
    } catch (error) {
      this.isProcessingMessage = false;
      await Logger.log('🔐 [CRYPTO] ❌ Failed to encrypt message: ' + error.message);
      this.showError('Failed to encrypt message. Please check your encryption key.');
    }
  }

  async setupIncomingMessageDecryption() {
    await Logger.log('🔐 [CRYPTO] Setting up comprehensive decryption system...');
    
    // Start periodic scanning immediately
    await this.startPeriodicDecryption();
    
    // Also setup mutation observer for real-time detection
    this.setupMutationObserver();
  }

  async startPeriodicDecryption() {
    // Scan immediately on load
    setTimeout(() => this.scanAllMessages(), 1000);
    
    // Then scan every 3 seconds
    this.decryptionInterval = setInterval(() => {
      this.scanAllMessages();
    }, 3000);
    
    await Logger.log('🔐 [CRYPTO] ✅ Periodic message scanning started (every 3 seconds)');
  }

  async scanAllMessages() {
    try {
      // Find all message containers
      const messageContainers = document.querySelectorAll('.messageContent_c19a55, div[class*="messageContent"]');
      
      if (messageContainers.length === 0) {
        return; // No messages found
      }
      
      let processedCount = 0;
      let decryptedCount = 0;
      
      for (const messageContent of messageContainers) {
        const result = await this.processMessageContent(messageContent);
        if (result.processed) processedCount++;
        if (result.decrypted) decryptedCount++;
      }
      
      if (decryptedCount > 0) {
        await Logger.log(`🔐 [CRYPTO] 🔓 Scan complete: ${decryptedCount} messages decrypted out of ${processedCount} encrypted messages found`);
      }
      
    } catch (error) {
      console.error('🔐 [CRYPTO] ❌ Error during message scan:', error);
    }
  }

  setupMutationObserver() {
    const findMessagesContainer = () => {
      return document.querySelector('ol[class*="scrollerInner"], .scrollerInner__36d07');
    };

    const setupObserver = async () => {
      const messagesContainer = findMessagesContainer();
      if (!messagesContainer) {
        setTimeout(setupObserver, 1000);
        return;
      }

      this.messageObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Look for message content in the new node
              const messageContents = node.querySelectorAll ? 
                node.querySelectorAll('.messageContent_c19a55, div[class*="messageContent"]') : [];
              
              // Also check if the node itself is a message content
              if (node.classList && (node.classList.contains('messageContent_c19a55') || 
                  Array.from(node.classList).some(cls => cls.includes('messageContent')))) {
                this.processMessageContent(node);
              }
              
              // Process any message contents found within
              messageContents.forEach(messageContent => {
                this.processMessageContent(messageContent);
              });
            }
          });
        });
      });

      this.messageObserver.observe(messagesContainer, {
        childList: true,
        subtree: true
      });

      await Logger.log('🔐 [CRYPTO] ✅ Real-time message observer setup complete');
    };

    setupObserver();
  }

  async processMessageContent(messageContent) {
    // Return early if no encryption key or already processed
    if (!this.encryptionKey || !messageContent) {
      return { processed: false, decrypted: false };
    }

    // Avoid processing the same message multiple times
    if (messageContent.dataset.cryptoProcessed) {
      return { processed: false, decrypted: false };
    }

    const messageText = messageContent.textContent?.trim() || '';
    
    // Only process encrypted messages
    if (!messageText.startsWith('ENC:')) {
      return { processed: false, decrypted: false };
    }

    try {
      // Extract the encrypted payload
      const encryptedPayload = messageText.substring(4);
      
      // Decrypt the message
      const decryptedMessage = await discordCrypto.decrypt(encryptedPayload, this.encryptionKey);
      
      // Replace the message content
      messageContent.textContent = decryptedMessage;
      
      // Add visual indicator
      this.addDecryptionIndicator(messageContent);
      
      // Mark as processed
      messageContent.dataset.cryptoProcessed = 'true';
      
      return { processed: true, decrypted: true };
      
    } catch (error) {
      // Add error indicator for failed decryption
      messageContent.textContent = '🔒 [Encrypted message - decryption failed]';
      messageContent.style.color = '#ff6b6b';
      messageContent.style.fontStyle = 'italic';
      messageContent.dataset.cryptoProcessed = 'true';
      
      return { processed: true, decrypted: false };
    }
  }

  addDecryptionIndicator(messageContent) {
    // Add a small lock icon to indicate decrypted message
    if (!messageContent.querySelector('.crypto-indicator')) {
      const indicator = document.createElement('span');
      indicator.className = 'crypto-indicator';
      indicator.innerHTML = '🔓';
      indicator.style.cssText = `
        font-size: 12px;
        margin-left: 5px;
        opacity: 0.7;
        vertical-align: super;
      `;
      indicator.title = 'Decrypted message';
      messageContent.appendChild(indicator);
    }
  }

  addExtensionIndicator() {
    // Add a small indicator to show the extension is active
    const indicator = document.createElement('div');
    indicator.id = 'discord-crypto-indicator';
    indicator.innerHTML = '🔐';
    indicator.title = 'Discord Cryptochat is active';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 5px 8px;
      border-radius: 15px;
      font-size: 14px;
      cursor: pointer;
      transition: opacity 0.3s;
    `;
    
    indicator.addEventListener('click', () => {
      this.openOptions();
    });
    
    document.body.appendChild(indicator);
    
    // Fade out after 3 seconds
    setTimeout(() => {
      indicator.style.opacity = '0.3';
    }, 3000);
  }

  showKeyWarning() {
    const warning = document.createElement('div');
    warning.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff6b6b;
      color: white;
      padding: 20px;
      border-radius: 10px;
      z-index: 10000;
      text-align: center;
      font-family: Arial, sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    warning.innerHTML = `
      <h3>🔐 Discord Cryptochat</h3>
      <p>No encryption key set!</p>
      <p>Please set your encryption key in the extension options.</p>
      <button id="crypto-set-key" style="
        background: white;
        color: #ff6b6b;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        margin-top: 10px;
      ">Set Key</button>
      <button id="crypto-close-warning" style="
        background: transparent;
        color: white;
        border: 1px solid white;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        margin-left: 10px;
        margin-top: 10px;
      ">Close</button>
    `;
    
    document.body.appendChild(warning);
    
    document.getElementById('crypto-set-key').addEventListener('click', () => {
      this.openOptions();
      warning.remove();
    });
    
    document.getElementById('crypto-close-warning').addEventListener('click', () => {
      warning.remove();
    });
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (warning.parentNode) {
        warning.remove();
      }
    }, 10000);
  }

  showError(message) {
    const error = document.createElement('div');
    error.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff6b6b;
      color: white;
      padding: 15px;
      border-radius: 5px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      max-width: 300px;
    `;
    
    error.textContent = message;
    document.body.appendChild(error);
    
    setTimeout(() => {
      error.remove();
    }, 5000);
  }

  openOptions() {
    chrome.runtime.sendMessage({ action: 'openOptions' });
  }
}

// Initialize when the script loads
const discordCryptochat = new DiscordCryptochat(); 