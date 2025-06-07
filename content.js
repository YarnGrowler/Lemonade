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

// Extension loaded

class DiscordCryptochat {
  constructor() {
    this.isEnabled = true;
    this.encryptionKey = null;
    this.messageObserver = null;
    this.lastProcessedMessage = null;
    this.autoEncryptEnabled = false;
    this.version = "1.3.0";
    
    // Add method binding to ensure 'this' context
    this.isAlreadyEncrypted = this.isAlreadyEncrypted.bind(this);
    
    this.init();
  }

  async init() {
    // Load encryption key and speed settings
    await this.loadKey();
    await this.loadSpeedSettings();
    
    // Wait for Discord to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async loadKey() {
    try {
      this.encryptionKey = await discordCrypto.getStoredKey();
      
      // Load auto-encrypt setting
      const result = await chrome.storage.local.get(['autoEncryptEnabled']);
      this.autoEncryptEnabled = result.autoEncryptEnabled || false;
      
      if (!this.encryptionKey) {
        this.showKeyWarning();
      }
    } catch (error) {
      console.error('Failed to load encryption key:', error);
    }
  }

  async loadSpeedSettings() {
    try {
      const result = await chrome.storage.local.get(['scanFrequency', 'initialDelay']);
      
      // Set configurable speed settings with defaults
      this.scanFrequency = result.scanFrequency || 1000; // 1 second default
      this.initialDelay = result.initialDelay || 500; // 0.5 second default
      this.minScanFrequency = Math.max(500, this.scanFrequency - 500); // Adaptive min
      this.maxScanFrequency = this.scanFrequency * 3; // Adaptive max
      
    } catch (error) {
      console.error('Failed to load speed settings:', error);
      // Fallback to defaults
      this.scanFrequency = 1000;
      this.initialDelay = 500;
      this.minScanFrequency = 500;
      this.maxScanFrequency = 3000;
    }
  }

  async forceRefreshKey() {
    // Force refresh key from storage (backup method)
    const oldKey = this.encryptionKey ? this.encryptionKey.substring(0, 8) + '...' : 'null';
    this.encryptionKey = await discordCrypto.getStoredKey();
    const newKey = this.encryptionKey ? this.encryptionKey.substring(0, 8) + '...' : 'null';
    
    if (oldKey !== newKey) {
      this.clearAllProcessedFlags();
      this.scanAllMessages();
    }
  }

  clearAllProcessedFlags() {
    // Smart cleanup: only restore successfully decrypted messages, leave failed ones as failed
    const processedMessages = document.querySelectorAll('[data-crypto-processed]');
    
    processedMessages.forEach(msg => {
      // Check if this was a successfully decrypted message (has 🔓 indicator)
      const wasSuccessfullyDecrypted = msg.querySelector('.crypto-indicator');
      const isFailedMessage = msg.textContent.includes('🔒 [Encrypted message - decryption failed]');
      
      if (wasSuccessfullyDecrypted && !isFailedMessage && msg.dataset.originalEncrypted) {
        // Restore only successfully decrypted messages to encrypted form
        msg.textContent = msg.dataset.originalEncrypted;
        msg.style.color = '';
        msg.style.fontStyle = '';
      }
      // Leave failed messages as they are - don't restore them
      
      // Remove crypto-related attributes to allow re-processing
      msg.removeAttribute('data-crypto-processed');
      msg.removeAttribute('data-decrypted-with-key');
      
      // Remove crypto indicators
      const indicator = msg.querySelector('.crypto-indicator');
      if (indicator) {
        indicator.remove();
      }
    });
  }

  async setup() {
    // Setup message listeners for popup communication
    this.setupMessageListeners();
    
    // Setup message interception
    await this.setupOutgoingMessageInterception();
    
    // Setup incoming message decryption
    await this.setupIncomingMessageDecryption();
    
    // Add extension indicator
    this.addExtensionIndicator();
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateAutoEncrypt') {
        this.autoEncryptEnabled = request.enabled;
        
        // Also update storage to ensure consistency
        chrome.storage.local.set({ autoEncryptEnabled: this.autoEncryptEnabled });
        
        // Send confirmation back
        sendResponse({ success: true, autoEncryptEnabled: this.autoEncryptEnabled });
      } else if (request.action === 'keyRotated') {
        // Update the encryption key in real-time
        this.encryptionKey = request.newKey;
        
        // Force re-scan all messages with new key - clear processed flags first
        setTimeout(() => {
          this.clearAllProcessedFlags();
          this.scanAllMessages();
        }, 500);
        
        sendResponse({ success: true });
      } else if (request.action === 'updateSpeedSettings') {
        // Update speed settings in real-time
        this.scanFrequency = request.scanFrequency;
        this.initialDelay = request.initialDelay;
        this.minScanFrequency = Math.max(500, this.scanFrequency - 500);
        this.maxScanFrequency = this.scanFrequency * 3;
        
        // Restart decryption with new settings
        this.restartDecryptionWithNewSpeed();
        
        sendResponse({ success: true });
      }
    });
  }

  async setupOutgoingMessageInterception() {
    await Logger.log('🔐 [CRYPTO] Setting up outgoing message interception...');
    
    // Flag to prevent processing our own encrypted messages
    this.isProcessingMessage = false;
    
    // Setup hotkeys
    this.setupHotkeys();
    
    // Listen for keydown events on the message input with capture - very aggressive
    document.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        // Safely check if target has required methods
        if (!event.target || typeof event.target.closest !== 'function') {
          return;
        }
        
        // Find Discord message input
        const messageBox = event.target.closest('[data-slate-editor="true"]') || 
                          event.target.closest('[role="textbox"]') ||
                          event.target.closest('div[contenteditable="true"]');
        
        if (messageBox && messageBox.hasAttribute && messageBox.hasAttribute('data-slate-editor')) {
          await this.handleOutgoingMessage(event, messageBox);
        }
      }
    }, true);
    
    // Additional event listeners for more robust capture
    document.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && this.isProcessingMessage) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }, true);
    
    document.addEventListener('keyup', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && this.isProcessingMessage) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }, true);
    

  }

  setupHotkeys() {
    // Global hotkey listener for Ctrl+Shift+E to toggle auto-encrypt
    document.addEventListener('keydown', async (event) => {
      // Ctrl+Shift+E to toggle auto-encrypt
      if (event.ctrlKey && event.shiftKey && event.key === 'E') {
        event.preventDefault();
        await this.toggleAutoEncryptHotkey();
      }
      
      // Ctrl+Shift+D to toggle extension on/off
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        await this.toggleExtensionHotkey();
      }
    }, true);
    
    Logger.log('🔐 [CRYPTO] ✅ Hotkeys setup: Ctrl+Shift+E (toggle auto-encrypt), Ctrl+Shift+D (toggle extension)');
  }

  async toggleAutoEncryptHotkey() {
    this.autoEncryptEnabled = !this.autoEncryptEnabled;
    await chrome.storage.local.set({ autoEncryptEnabled: this.autoEncryptEnabled });
    
    const status = this.autoEncryptEnabled ? 'enabled' : 'disabled';
    const message = `🔐 Auto-encrypt ${status} (Ctrl+Shift+E)`;
    
    await Logger.log(`🔐 [CRYPTO] 🔄 Auto-encrypt toggled via hotkey: ${this.autoEncryptEnabled}`);
    this.showHotkeyNotification(message, this.autoEncryptEnabled ? 'success' : 'info');
    
    // Force reload from storage to ensure consistency
    setTimeout(async () => {
      const result = await chrome.storage.local.get(['autoEncryptEnabled']);
      this.autoEncryptEnabled = result.autoEncryptEnabled || false;
      await Logger.log(`🔐 [CRYPTO] 🔄 Auto-encrypt reloaded after hotkey: ${this.autoEncryptEnabled}`);
    }, 100);
  }

  async toggleExtensionHotkey() {
    this.isEnabled = !this.isEnabled;
    
    const status = this.isEnabled ? 'enabled' : 'disabled';
    const message = `🔐 Extension ${status} (Ctrl+Shift+D)`;
    
    await Logger.log(message);
    this.showHotkeyNotification(message, this.isEnabled ? 'success' : 'error');
  }

  showHotkeyNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      background: ${type === 'error' ? '#ff6b6b' : type === 'success' ? '#48bb78' : '#667eea'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      animation: slideInDown 0.3s ease-out;
      backdrop-filter: blur(10px);
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOutUp 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
      }
    }, 3000);
  }

  async handleOutgoingMessage(event, messageBox) {
    // Prevent infinite loop and fast typing bypass
    if (this.isProcessingMessage) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Check if extension is enabled
    if (!this.isEnabled) {
      return; // Extension is disabled
    }
    
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
    
    // Determine if we should encrypt this message
    const shouldEncrypt = this.autoEncryptEnabled || messageText.startsWith('!priv ');
    
    if (!shouldEncrypt) {
      return; // Not a message to encrypt, let Discord handle it normally
    }

    // Check if it's already encrypted (avoid double processing)
    try {
      if (typeof this.isAlreadyEncrypted === 'function' && this.isAlreadyEncrypted(messageText)) {
        return;
      }
    } catch (error) {
      // Continue anyway - better to attempt encryption than fail completely
    }

    if (!this.encryptionKey) {
      event.preventDefault();
      event.stopPropagation();
      this.showKeyWarning();
      return;
    }

    // Extract the actual message (remove !priv prefix if present)
    const actualMessage = messageText.startsWith('!priv ') ? 
      messageText.substring(6).trim() : messageText.trim();
    
    if (!actualMessage) {
      return;
    }

    try {
      // Set processing flag IMMEDIATELY to prevent interference
      this.isProcessingMessage = true;
      
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation(); // Prevent other listeners

      const encryptedMessage = await discordCrypto.encrypt(actualMessage, this.encryptionKey);
      const finalMessage = this.encodeStealthMessage(encryptedMessage);
      
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
          break;
        }
      }
      
      if (sendButton) {
        sendButton.click();
      } else {
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
      
      // Clear the processing flag after a shorter delay to allow faster typing
      setTimeout(() => {
        this.isProcessingMessage = false;
      }, 1000);
      
      // Immediately trigger decryption scan to show the user their decrypted message
      this.triggerImmediateDecryption();
      
    } catch (error) {
      this.isProcessingMessage = false;
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
    // Scan immediately on load with configurable delay
    setTimeout(() => this.scanAllMessages(), this.initialDelay);
    
    // Use configurable scanning frequency with adaptive behavior
    this.lastScanTime = Date.now();
    
    this.decryptionInterval = setInterval(() => {
      this.adaptiveScanAllMessages();
    }, this.scanFrequency);
    
    // Also periodically refresh key from storage (backup method)
    this.keyRefreshInterval = setInterval(() => {
      this.forceRefreshKey();
    }, 15000); // Every 15 seconds
  }

  async adaptiveScanAllMessages() {
    const now = Date.now();
    const timeSinceLastScan = now - this.lastScanTime;
    
    const result = await this.scanAllMessages();
    
    // Adjust scan frequency based on activity
    if (result.decryptedCount > 0) {
      // Found encrypted messages - scan more frequently
      this.scanFrequency = Math.max(this.minScanFrequency, this.scanFrequency - 500);
    } else {
      // No encrypted messages - can scan less frequently
      this.scanFrequency = Math.min(this.maxScanFrequency, this.scanFrequency + 500);
    }
    
    // Update interval if frequency changed significantly
    const frequencyChange = Math.abs(this.scanFrequency - 3000);
    if (frequencyChange > 1000) {
      clearInterval(this.decryptionInterval);
      this.decryptionInterval = setInterval(() => {
        this.adaptiveScanAllMessages();
      }, this.scanFrequency);
    }
    
    this.lastScanTime = now;
  }

  restartDecryptionWithNewSpeed() {
    // Clear existing intervals
    if (this.decryptionInterval) {
      clearInterval(this.decryptionInterval);
    }
    
    // Restart with new speed settings
    this.decryptionInterval = setInterval(() => {
      this.adaptiveScanAllMessages();
    }, this.scanFrequency);
  }

  triggerImmediateDecryption() {
    // Multiple scan attempts to catch the newly sent message
    // Discord may take a moment to render the message in the DOM
    
    // Immediate scan
    setTimeout(() => this.scanAllMessages(), 100);
    
    // Quick follow-up scans to catch the message as it appears
    setTimeout(() => this.scanAllMessages(), 300);
    setTimeout(() => this.scanAllMessages(), 600);
    setTimeout(() => this.scanAllMessages(), 1000);
    
    // Final scan to ensure we got it
    setTimeout(() => this.scanAllMessages(), 2000);
  }

  async scanAllMessages() {
    try {
      // Find all message containers with more specific selectors
      const messageContainers = document.querySelectorAll('.messageContent_c19a55, div[class*="messageContent"]:not([data-crypto-processed])');
      
      if (messageContainers.length === 0) {
        return { processedCount: 0, decryptedCount: 0 }; // No messages found
      }
      
      let processedCount = 0;
      let decryptedCount = 0;
      let skippedCount = 0;
      
      // Process in batches to avoid blocking the main thread
      const batchSize = 10;
      for (let i = 0; i < messageContainers.length; i += batchSize) {
        const batch = Array.from(messageContainers).slice(i, i + batchSize);
        
        // Process batch
        const batchPromises = batch.map(messageContent => this.processMessageContent(messageContent));
        const batchResults = await Promise.all(batchPromises);
        
        // Count results
        for (const result of batchResults) {
          if (result.processed) processedCount++;
          if (result.decrypted) decryptedCount++;
          if (result.skipped) skippedCount++;
        }
        
        // Yield control to the main thread between batches
        if (i + batchSize < messageContainers.length) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      

      
      return { processedCount, decryptedCount, skippedCount, totalMessages: messageContainers.length };
      
    } catch (error) {
      console.error('🔐 [CRYPTO] ❌ Error during message scan:', error);
      return { processedCount: 0, decryptedCount: 0, skippedCount: 0, totalMessages: 0 };
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


    };

    setupObserver();
  }

  async processMessageContent(messageContent) {
    // Return early if no encryption key or already processed
    if (!this.encryptionKey || !messageContent) {
      return { processed: false, decrypted: false, skipped: false };
    }

    // Avoid processing the same message multiple times
    if (messageContent.dataset.cryptoProcessed) {
      return { processed: false, decrypted: false, skipped: true };
    }

    const messageText = messageContent.textContent?.trim() || '';
    
    // Only process encrypted messages (now in stealth Chinese format)
    if (!this.isAlreadyEncrypted || !this.isAlreadyEncrypted(messageText)) {
      return { processed: false, decrypted: false, skipped: false };
    }

    // Store original encrypted content before processing
    if (!messageContent.dataset.originalEncrypted) {
      messageContent.dataset.originalEncrypted = messageText;
    }

    try {
      // Decode the stealth message to get base64
      const encryptedPayload = this.decodeStealthMessage(messageText);
      
      // Decrypt the message
      const decryptedMessage = await discordCrypto.decrypt(encryptedPayload, this.encryptionKey);
      
      // Replace the message content
      messageContent.textContent = decryptedMessage;
      
      // Add visual indicator
      this.addDecryptionIndicator(messageContent);
      
      // Mark as processed and store the decrypted key hash for validation
      messageContent.dataset.cryptoProcessed = 'true';
      messageContent.dataset.decryptedWithKey = this.encryptionKey ? this.encryptionKey.substring(0, 16) : '';
      
      return { processed: true, decrypted: true, skipped: false };
      
    } catch (error) {
      // Restore original encrypted content and show error
      messageContent.textContent = '🔒 [Encrypted message - decryption failed]';
      messageContent.style.color = '#ff6b6b';
      messageContent.style.fontStyle = 'italic';
      messageContent.dataset.cryptoProcessed = 'true';
      
      return { processed: true, decrypted: false, skipped: false };
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

  // Stealth encoding methods
  encodeStealthMessage(base64Data) {
    // Convert base64 to Chinese characters to make it look natural
    const chineseChars = this.base64ToChinese(base64Data);
    // Add spaces every 4-6 characters for natural appearance
    return this.addSpacesToChinese(chineseChars);
  }

  decodeStealthMessage(chineseText) {
    // Remove spaces first, then convert Chinese characters back to base64
    const cleanChinese = this.removeSpacesFromChinese(chineseText);
    return this.chineseToBase64(cleanChinese);
  }

  addSpacesToChinese(chineseText) {
    // Add spaces every 4-6 characters with some randomness for natural look
    let result = '';
    for (let i = 0; i < chineseText.length; i++) {
      result += chineseText[i];
      // Add space every 4-6 characters (varying for natural appearance)
      const spaceInterval = 4 + (i % 3); // Creates pattern of 4,5,6,4,5,6...
      if ((i + 1) % spaceInterval === 0 && i < chineseText.length - 1) {
        result += ' ';
      }
    }
    return result;
  }

  removeSpacesFromChinese(chineseText) {
    // Simply remove all spaces
    return chineseText.replace(/\s+/g, '');
  }

  base64ToChinese(base64) {
    // Take base64 string and convert each character to a Chinese character
    let result = '';
    const baseCharCode = 0x4E00; // Start of CJK unified ideographs
    
    for (let i = 0; i < base64.length; i++) {
      const charCode = base64.charCodeAt(i);
      // Map ASCII range to Chinese characters
      const chineseCharCode = baseCharCode + (charCode * 13 + i * 7) % 3000;
      result += String.fromCharCode(chineseCharCode);
    }
    
    return result;
  }

  chineseToBase64(chineseText) {
    // Convert Chinese characters back to base64
    let result = '';
    const baseCharCode = 0x4E00;
    
    for (let i = 0; i < chineseText.length; i++) {
      const chineseCharCode = chineseText.charCodeAt(i);
      const offset = chineseCharCode - baseCharCode;
      
      // Reverse the mapping
      let originalCharCode = 33; // Start searching from '!'
      for (let j = 33; j <= 126; j++) {
        if ((j * 13 + i * 7) % 3000 === offset) {
          originalCharCode = j;
          break;
        }
      }
      
      result += String.fromCharCode(originalCharCode);
    }
    
    return result;
  }

  isAlreadyEncrypted(text) {
    // Check if text looks like our encoded Chinese characters
    if (!text || text.length === 0) return false;
    
    // Remove spaces to count only Chinese characters
    const textWithoutSpaces = text.replace(/\s+/g, '');
    if (textWithoutSpaces.length === 0) return false;
    
    // Check if most non-space characters are in the CJK range we use
    let chineseCount = 0;
    for (let i = 0; i < textWithoutSpaces.length; i++) {
      const charCode = textWithoutSpaces.charCodeAt(i);
      if (charCode >= 0x4E00 && charCode <= 0x7000) {
        chineseCount++;
      }
    }
    
    // If more than 70% are in our Chinese range, consider it encrypted
    // Lowered threshold to account for potential compression artifacts
    const ratio = chineseCount / textWithoutSpaces.length;
    
    // Also add minimum length check to avoid false positives
    const isEncrypted = ratio > 0.7 && textWithoutSpaces.length >= 10;
    

    
    return isEncrypted;
  }
}

// Initialize when the script loads
const discordCryptochat = new DiscordCryptochat(); 