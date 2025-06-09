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
    this.version = "2.0.0";
    
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
      
      // Load auto-encrypt and asymmetric settings
      const result = await chrome.storage.local.get(['autoEncryptEnabled', 'asymmetricEnabled']);
      this.autoEncryptEnabled = result.autoEncryptEnabled || false;
      this.asymmetricEnabled = result.asymmetricEnabled || false;
      
      console.log('🔐 [CRYPTO] Settings loaded - Auto-encrypt:', this.autoEncryptEnabled, 'Asymmetric:', this.asymmetricEnabled);
      
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
    
    // Initialize asymmetric encryption
    console.log('🔐 [CRYPTO] Attempting to initialize asymmetric encryption...');
    try {
      if (typeof this.initAsymmetricEncryption === 'function') {
        this.initAsymmetricEncryption();
        console.log('🔐 [CRYPTO] initAsymmetricEncryption() called');
      } else {
        console.log('🔐 [CRYPTO] ❌ initAsymmetricEncryption method not found!');
        console.log('🔐 [CRYPTO] Available methods:', Object.getOwnPropertyNames(this.__proto__));
      }
    } catch (error) {
      console.error('🔐 [CRYPTO] ❌ Asymmetric initialization error:', error);
    }
    
    // Debug: Check asymmetric status after a delay
    setTimeout(() => {
      this.debugAsymmetricStatus();
    }, 2000);
    
    // Add extension indicator
    this.addExtensionIndicator();
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
      if (request.action === 'updateAutoEncrypt') {
        this.autoEncryptEnabled = request.enabled;
        
        // Also update storage to ensure consistency
        chrome.storage.local.set({ autoEncryptEnabled: this.autoEncryptEnabled });
        
        // Send confirmation back
        sendResponse({ success: true, autoEncryptEnabled: this.autoEncryptEnabled });
      } else if (request.action === 'updateCurrentUser') {
        // Update current user info for asymmetric encryption
        if (window.ecCrypto) {
          window.ecCrypto.setCurrentUser(request.userId, request.username);
          // console.log('🔐 [CRYPTO] 👤 Current user updated:', request.username, '(ID:', request.userId + ')');
        }
        
        sendResponse({ success: true });
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
      } else if (request.action === 'getCurrentKeyInfo') {
        // Return current key information for options page
        this.handleGetCurrentKeyInfo(sendResponse);
        return true; // Keep channel open for async response
      } else if (request.action === 'getContactList') {
        // Return contact list for options page
        this.handleGetContactList(sendResponse);
        return true; // Keep channel open for async response
      } else if (request.action === 'clearAllContacts') {
        // Clear all contacts
        this.handleClearAllContacts(sendResponse);
        return true; // Keep channel open for async response
      } else if (request.action === 'testEncryption') {
        // Test encryption with given message
        this.handleTestEncryption(request.message, sendResponse);
        return true; // Keep channel open for async response
      } else if (request.action === 'testDecryption') {
        // Test decryption with given encrypted text
        this.handleTestDecryption(request.encryptedText, sendResponse);
        return true; // Keep channel open for async response
      } else if (request.action === 'updateECRotationInterval') {
        // Update EC rotation interval
        this.handleUpdateECRotationInterval(request.intervalMs, sendResponse);
        return true; // Keep channel open for async response
      } else if (request.action === 'rotateKeys') {
        // Manually rotate keys
        this.handleRotateKeys(sendResponse);
        return true; // Keep channel open for async response
      } else if (request.action === 'rotateECKeys') {
        // Background timer triggered EC key rotation
        this.handleRotateECKeys(request.source, sendResponse);
        return true; // Keep channel open for async response
      } else if (request.action === 'debugKeyStatus') {
        // Debug key status
        try {
          if (typeof window.debugKeyStatus === 'function') {
            window.debugKeyStatus();
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'debugKeyStatus function not available' });
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        return true;
      } else if (request.action === 'forceUniqueKeys') {
        // Force unique key generation
        try {
          if (typeof window.forceUniqueKeys === 'function') {
            await window.forceUniqueKeys();
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'forceUniqueKeys function not available' });
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        return true;
      } else if (request.action === 'fixAfterRotation') {
        // Fix after rotation
        try {
          if (typeof window.fixAfterRotation === 'function') {
            await window.fixAfterRotation();
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'fixAfterRotation function not available' });
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        return true;
      } else if (request.action === 'cleanupTempContacts') {
        // Cleanup temp contacts
        try {
          if (window.ecCrypto && typeof window.ecCrypto.cleanupTempContacts === 'function') {
            const removedCount = await window.ecCrypto.cleanupTempContacts();
            sendResponse({ success: true, removedCount: removedCount });
          } else {
            sendResponse({ success: false, error: 'cleanupTempContacts function not available' });
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        return true;
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

      let encryptedMessage = null;
      let encryptionMethod = 'unknown';
      let encryptionDetails = {};

      // console.log('🔐 [ENCRYPT] 📤 Encrypting outgoing message...');
      // console.log('🔐 [ENCRYPT] Original message:', actualMessage);

      // Try asymmetric encryption first if available
      if (this.encryptAsymmetricMessage && typeof this.encryptAsymmetricMessage === 'function') {
        // console.log('🔐 [ENCRYPT] 🔐 Trying asymmetric encryption...');
        try {
          const asymmetricResult = await this.encryptAsymmetricMessage(actualMessage);
          if (asymmetricResult && asymmetricResult.success) {
            encryptedMessage = asymmetricResult.encryptedText;
            encryptionMethod = 'asymmetric';
            encryptionDetails = asymmetricResult.details || {};
            // console.log('🔐 [ENCRYPT] ✅ Asymmetric encryption SUCCESS!');
            // console.log('🔐 [ENCRYPT] Details:', encryptionDetails);
            // console.log('🔐 [ENCRYPT] Encrypted length:', encryptedMessage.length);
          } else {
            // console.log('🔐 [ENCRYPT] ❌ Asymmetric encryption failed, trying symmetric...');
          }
        } catch (asymmetricError) {
          // console.log('🔐 [ENCRYPT] ❌ Asymmetric encryption error:', asymmetricError.message);
        }
      } else {
        // console.log('🔐 [ENCRYPT] ⚠️ Asymmetric encryption not available');
      }

      // Fallback to symmetric encryption if asymmetric failed or unavailable
      if (!encryptedMessage) {
        if (!this.encryptionKey) {
          // console.log('🔐 [ENCRYPT] ❌ No symmetric encryption key available');
          event.preventDefault();
          event.stopPropagation();
          this.showKeyWarning();
          this.isProcessingMessage = false;
          return;
        }
        
        // console.log('🔐 [ENCRYPT] 🔑 Using symmetric encryption...');
        encryptedMessage = await discordCrypto.encrypt(actualMessage, this.encryptionKey);
        encryptionMethod = 'symmetric';
        encryptionDetails = { keyType: 'shared_secret' };
        // console.log('🔐 [ENCRYPT] ✅ Symmetric encryption SUCCESS!');
        // console.log('🔐 [ENCRYPT] Encrypted length:', encryptedMessage.length);
      }

      const finalMessage = encryptionMethod === 'asymmetric' ? encryptedMessage : this.encodeStealthMessage(encryptedMessage);
      
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
    // Return early if already processed
    if (!messageContent) {
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
      let decryptedMessage = null;
      let decryptionMethod = 'unknown';
      let decryptionDetails = {};
      
      // console.log('🔐 [DECRYPT] 📨 Processing encrypted message...');
      // console.log('🔐 [DECRYPT] Message preview:', messageText.substring(0, 100) + '...');
      
      // Try asymmetric decryption first if available
      if (this.processAsymmetricMessage && typeof this.processAsymmetricMessage === 'function') {
        // console.log('🔐 [DECRYPT] 🔐 Trying asymmetric decryption...');
        try {
          const asymmetricResult = await this.processAsymmetricMessage(messageText, messageContent);
          if (asymmetricResult && asymmetricResult.success) {
            decryptedMessage = asymmetricResult.decryptedText;
            decryptionMethod = 'asymmetric';
            decryptionDetails = asymmetricResult.details || {};
            // console.log('🔐 [DECRYPT] ✅ Asymmetric decryption SUCCESS!');
            // console.log('🔐 [DECRYPT] Decrypted:', decryptedMessage);
            // console.log('🔐 [DECRYPT] Details:', decryptionDetails);
          } else {
            // console.log('🔐 [DECRYPT] ❌ Asymmetric decryption failed, trying symmetric...');
          }
        } catch (asymmetricError) {
          // console.log('🔐 [DECRYPT] ❌ Asymmetric decryption error:', asymmetricError.message);
        }
      } else {
        // console.log('🔐 [DECRYPT] ⚠️ Asymmetric decryption not available');
      }
      
      // Fallback to symmetric decryption if asymmetric failed or unavailable
      if (!decryptedMessage && this.encryptionKey) {
        // console.log('🔐 [DECRYPT] 🔑 Trying symmetric decryption...');
        try {
          // Decode the stealth message to get base64
          const encryptedPayload = this.decodeStealthMessage(messageText);
          // console.log('🔐 [DECRYPT] Decoded payload length:', encryptedPayload.length);
          
          // Decrypt the message using symmetric encryption
          decryptedMessage = await discordCrypto.decrypt(encryptedPayload, this.encryptionKey);
          decryptionMethod = 'symmetric';
          decryptionDetails = { keyType: 'shared_secret' };
          // console.log('🔐 [DECRYPT] ✅ Symmetric decryption SUCCESS!');
          // console.log('🔐 [DECRYPT] Decrypted:', decryptedMessage);
        } catch (symmetricError) {
          // console.log('🔐 [DECRYPT] ❌ Symmetric decryption failed:', symmetricError.message);
        }
      } else if (!this.encryptionKey) {
        // console.log('🔐 [DECRYPT] ⚠️ No symmetric encryption key available');
      }
      
      if (decryptedMessage) {
        // Replace the message content
        messageContent.textContent = decryptedMessage;
        
        // Add visual indicator with method info
        this.addDecryptionIndicator(messageContent, decryptionMethod);
        
        // Mark as processed
        messageContent.dataset.cryptoProcessed = 'true';
        messageContent.dataset.decryptionMethod = decryptionMethod;
        messageContent.dataset.decryptedWithKey = this.encryptionKey ? this.encryptionKey.substring(0, 16) : '';
        
        return { processed: true, decrypted: true, skipped: false };
      } else {
        throw new Error('Both asymmetric and symmetric decryption failed');
      }
      
    } catch (error) {
      // Show decryption failure
      messageContent.textContent = '🔒 [Encrypted message - decryption failed]';
      messageContent.style.color = '#ff6b6b';
      messageContent.style.fontStyle = 'italic';
      messageContent.dataset.cryptoProcessed = 'true';
      
      return { processed: true, decrypted: false, skipped: false };
    }
  }

  addDecryptionIndicator(messageContent, method = 'unknown') {
    // Add a small lock icon to indicate decrypted message
    if (!messageContent.querySelector('.crypto-indicator')) {
      const indicator = document.createElement('span');
      indicator.className = 'crypto-indicator';
      
      // Different icons for different methods
      if (method === 'asymmetric') {
        indicator.innerHTML = '🔐'; // Key icon for asymmetric
        indicator.title = 'Decrypted with asymmetric encryption (EC)';
      } else if (method === 'symmetric') {
        indicator.innerHTML = '🔓'; // Unlock icon for symmetric
        indicator.title = 'Decrypted with symmetric encryption';
      } else {
        indicator.innerHTML = '🔓';
        indicator.title = 'Decrypted message';
      }
      
      indicator.style.cssText = `
        font-size: 12px;
        margin-left: 5px;
        opacity: 0.7;
        vertical-align: super;
      `;
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

  // Initialize asymmetric encryption system
  async initAsymmetricEncryption() {
    console.log('🔐 [ASYMMETRIC] Initializing asymmetric encryption system...');
    
    const maxRetries = 10;
    let retryCount = 0;
    
    const attemptInit = async () => {
      try {
        retryCount++;
        console.log(`🔐 [ASYMMETRIC] Attempt ${retryCount}/${maxRetries}...`);
        
        // Check if all required classes are available
        if (typeof AsymmetricContentIntegration === 'undefined') {
          console.log('🔐 [ASYMMETRIC] ❌ AsymmetricContentIntegration class not found');
          if (retryCount < maxRetries) {
            setTimeout(attemptInit, 500);
            return;
          } else {
            console.log('🔐 [ASYMMETRIC] ❌ Max retries reached - AsymmetricContentIntegration not available');
            return;
          }
        }
        
        // Check if global objects are ready
        if (!window.ecCrypto || !window.ecMessageProcessor) {
          console.log('🔐 [ASYMMETRIC] ⏳ Waiting for global objects...', {
            ecCrypto: !!window.ecCrypto,
            ecMessageProcessor: !!window.ecMessageProcessor
          });
          if (retryCount < maxRetries) {
            setTimeout(attemptInit, 500);
            return;
          }
        }
        
        // Initialize asymmetric content integration
        console.log('🔐 [ASYMMETRIC] 🚀 Creating AsymmetricContentIntegration...');
        this.asymmetric = new AsymmetricContentIntegration(this);
        
        // Wait for initialization
        console.log('🔐 [ASYMMETRIC] ⏳ Initializing...');
        const success = await this.asymmetric.initialize();
        
        if (success && this.asymmetric.isInitialized) {
          // Bind methods to this context
          this.processAsymmetricMessage = this.asymmetric.processIncomingMessage.bind(this.asymmetric);
          this.encryptAsymmetricMessage = this.asymmetric.encryptOutgoingMessage.bind(this.asymmetric);
          
          console.log('🔐 [ASYMMETRIC] ✅ Asymmetric encryption fully initialized!');
          console.log('🔐 [ASYMMETRIC] processAsymmetricMessage available:', typeof this.processAsymmetricMessage);
          console.log('🔐 [ASYMMETRIC] encryptAsymmetricMessage available:', typeof this.encryptAsymmetricMessage);
          
          // Show success notification
          Logger.showPageNotification('🔐 Asymmetric encryption ready!', 'success');
          
        } else {
          console.log('🔐 [ASYMMETRIC] ❌ Initialization failed - success:', success, 'initialized:', this.asymmetric?.isInitialized);
          if (retryCount < maxRetries) {
            setTimeout(attemptInit, 1000);
          }
        }
      } catch (error) {
        console.error('🔐 [ASYMMETRIC] ❌ Initialization error:', error);
        if (retryCount < maxRetries) {
          setTimeout(attemptInit, 1000);
        }
      }
    };
    
    // Start the initialization process
    setTimeout(attemptInit, 500);
  }

  debugAsymmetricStatus() {
    console.log('🔐 [DEBUG] === ASYMMETRIC STATUS DEBUG ===');
    console.log('🔐 [DEBUG] Settings - Asymmetric enabled:', this.asymmetricEnabled);
    console.log('🔐 [DEBUG] Has asymmetric object:', !!this.asymmetric);
    console.log('🔐 [DEBUG] Extension version:', this.version);
    console.log('🔐 [DEBUG] Has initAsymmetricEncryption method:', typeof this.initAsymmetricEncryption);
    
    if (this.asymmetric) {
      console.log('🔐 [DEBUG] Asymmetric initialized:', this.asymmetric.isInitialized);
      console.log('🔐 [DEBUG] Has processAsymmetricMessage:', typeof this.processAsymmetricMessage);
      console.log('🔐 [DEBUG] Has encryptAsymmetricMessage:', typeof this.encryptAsymmetricMessage);
      
      if (this.asymmetric.isInitialized) {
        const status = this.asymmetric.getAsymmetricStatus();
        console.log('🔐 [DEBUG] Asymmetric status:', status);
        
        // Try to get contact list
        try {
          const contacts = this.asymmetric.getContactList();
          console.log('🔐 [DEBUG] Contact count:', contacts.length);
          if (contacts.length > 0) {
            console.log('🔐 [DEBUG] First contact:', contacts[0]);
          }
        } catch (error) {
          console.log('🔐 [DEBUG] Error getting contacts:', error);
        }
      }
    } else {
      console.log('🔐 [DEBUG] Asymmetric object not created - trying to reinitialize...');
      
      // Try to force reinitialize if methods are available but object isn't created
      if (typeof this.initAsymmetricEncryption === 'function') {
        console.log('🔐 [DEBUG] Retrying initAsymmetricEncryption...');
        try {
          this.initAsymmetricEncryption();
          
          // Check again after a delay
          setTimeout(() => {
            console.log('🔐 [DEBUG] After retry - Has asymmetric object:', !!this.asymmetric);
            console.log('🔐 [DEBUG] After retry - Has processAsymmetricMessage:', typeof this.processAsymmetricMessage);
            console.log('🔐 [DEBUG] After retry - Has encryptAsymmetricMessage:', typeof this.encryptAsymmetricMessage);
          }, 1000);
        } catch (error) {
          console.log('🔐 [DEBUG] Retry failed:', error);
        }
      }
    }
    
    // Check if global objects exist
    console.log('🔐 [DEBUG] Global ecCrypto exists:', typeof window.ecCrypto);
    console.log('🔐 [DEBUG] Global ecMessageProcessor exists:', typeof window.ecMessageProcessor);
    console.log('🔐 [DEBUG] Global ECMessageProcessor exists:', typeof ECMessageProcessor);
    console.log('🔐 [DEBUG] Global AsymmetricContentIntegration exists:', typeof AsymmetricContentIntegration);
    
    console.log('🔐 [DEBUG] ================================');
  }

  // Manual test method - call from console: discordCryptochat.testAsymmetricEncryption()
  async testAsymmetricEncryption() {
    console.log('🔐 [TEST] Testing asymmetric encryption...');
    
    if (!this.asymmetric || !this.asymmetric.isInitialized) {
      console.log('🔐 [TEST] Asymmetric not initialized - calling init...');
      this.initAsymmetricEncryption();
      
      // Wait a moment for init
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    this.debugAsymmetricStatus();
    
    // Test encryption
    if (this.encryptAsymmetricMessage) {
      try {
        const testMessage = "Hello asymmetric world!";
        console.log('🔐 [TEST] Encrypting test message:', testMessage);
        const result = await this.encryptAsymmetricMessage(testMessage);
        console.log('🔐 [TEST] Encryption result:', result);
      } catch (error) {
        console.log('🔐 [TEST] Encryption failed:', error);
      }
    }
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
    // Take base64 string and convert each character to a Chinese character using simple, reversible mapping
    let result = '';
    const baseCharCode = 0x4E00; // Start of CJK unified ideographs
    
    for (let i = 0; i < base64.length; i++) {
      const charCode = base64.charCodeAt(i);
      // Simple direct mapping - just add the char code to base
      const chineseCharCode = baseCharCode + (charCode - 32); // Shift printable ASCII range (32-126) to Chinese range
      result += String.fromCharCode(chineseCharCode);
    }
    
    return result;
  }

  chineseToBase64(chineseText) {
    // Convert Chinese characters back to base64 using simple, reversible mapping
    let result = '';
    const baseCharCode = 0x4E00;
    
    for (let i = 0; i < chineseText.length; i++) {
      const chineseCharCode = chineseText.charCodeAt(i);
      
             // Check if it's in our expected range
       if (chineseCharCode < baseCharCode || chineseCharCode > baseCharCode + 94) {
         // console.warn('🔐 [DECODE] Character out of expected range:', chineseCharCode, 'at position', i);
         // Try to handle gracefully
         result += '?';
         continue;
       }
       
       // Simple reverse mapping
       const originalCharCode = (chineseCharCode - baseCharCode) + 32;
       
       // Validate the result is in printable ASCII range
       if (originalCharCode < 32 || originalCharCode > 126) {
         // console.warn('🔐 [DECODE] Invalid ASCII char code:', originalCharCode);
         result += '?';
         continue;
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
    if (textWithoutSpaces.length < 10) return false;
    
    // Check if most non-space characters are in the CJK range we use
    let chineseCount = 0;
    for (let i = 0; i < textWithoutSpaces.length; i++) {
      const charCode = textWithoutSpaces.charCodeAt(i);
      if (charCode >= 0x4E00 && charCode <= 0x7000) {
        chineseCount++;
      }
    }
    
    // If more than 70% are in our Chinese range, consider it encrypted
    const ratio = chineseCount / textWithoutSpaces.length;
    const isEncrypted = ratio > 0.7;
    
    // console.log('🔐 [CRYPTO] 🔍 Checking if encrypted:', {
    //   textLength: text.length,
    //   cleanLength: textWithoutSpaces.length,
    //   chineseCount: chineseCount,
    //   ratio: ratio.toFixed(2),
    //   isEncrypted: isEncrypted
    // });
    
    return isEncrypted;
  }

  // ========== NEW HANDLER METHODS FOR OPTIONS PAGE ==========

  async handleGetCurrentKeyInfo(sendResponse) {
    try {
      console.log('🔐 [HANDLER] Getting current key info...');
      
      if (!window.ecCrypto) {
        console.log('🔐 [HANDLER] ❌ EC crypto not available');
        sendResponse({ success: false, error: 'EC crypto not available' });
        return;
      }

      // Get key information from ECCrypto - try multiple ways to get the public key
      let publicKey = null;
      
      // Try to get public key from the ECCrypto instance
      if (window.ecCrypto.staticPublicKey) {
        publicKey = await window.ecCrypto.exportPublicKey(window.ecCrypto.staticPublicKey);
      } else {
        // Try to get from storage if not in memory
        const stored = await chrome.storage.local.get(['ecStaticPublicKey']);
        if (stored.ecStaticPublicKey) {
          publicKey = stored.ecStaticPublicKey;
        }
      }
      
      const keyInfo = {
        keyId: window.ecCrypto.myKeyId || 'Unknown',
        publicKey: publicKey || 'Loading...',
        created: null,
        nextRotation: null
      };

      // Try to get stored key generation timestamp
      try {
        const stored = await chrome.storage.local.get(['ecKeyGenerated', 'ecRotationInterval', 'ecLastRotation']);
        
        if (stored.ecKeyGenerated) {
          keyInfo.created = stored.ecKeyGenerated;
        }
        
        // Calculate next rotation if applicable
        if (stored.ecRotationInterval && stored.ecLastRotation) {
          keyInfo.nextRotation = stored.ecLastRotation + stored.ecRotationInterval;
        } else if (stored.ecRotationInterval && stored.ecKeyGenerated) {
          keyInfo.nextRotation = stored.ecKeyGenerated + stored.ecRotationInterval;
        }
        
      } catch (storageError) {
        console.log('🔐 [HANDLER] ⚠️ Could not get storage info:', storageError);
      }
      
      console.log('🔐 [HANDLER] ✅ Key info retrieved:', {
        keyId: keyInfo.keyId,
        publicKeyLength: keyInfo.publicKey ? keyInfo.publicKey.length : 0,
        created: keyInfo.created ? new Date(keyInfo.created).toLocaleString() : 'Unknown',
        nextRotation: keyInfo.nextRotation ? new Date(keyInfo.nextRotation).toLocaleString() : 'N/A'
      });
      
      sendResponse({
        success: true,
        keyInfo: keyInfo
      });
    } catch (error) {
      console.error('🔐 [HANDLER] ❌ Failed to get current key info:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetContactList(sendResponse) {
    try {
      if (!window.ecCrypto) {
        sendResponse([]);
        return;
      }

      const contacts = await window.ecCrypto.getContactList();
      sendResponse(contacts);
    } catch (error) {
      console.error('Failed to get contact list:', error);
      sendResponse([]);
    }
  }

  async handleClearAllContacts(sendResponse) {
    try {
      if (!window.ecCrypto) {
        sendResponse({ success: false, error: 'EC crypto not available' });
        return;
      }

      await window.ecCrypto.clearAllContacts();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to clear contacts:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleTestEncryption(message, sendResponse) {
    try {
      let result = { success: false };

      // Try asymmetric encryption first
      if (this.encryptAsymmetricMessage && typeof this.encryptAsymmetricMessage === 'function') {
        try {
          const asymmetricResult = await this.encryptAsymmetricMessage(message);
          if (asymmetricResult && asymmetricResult.success) {
            result = {
              success: true,
              encryptedText: asymmetricResult.encryptedText,
              method: 'asymmetric',
              recipientInfo: asymmetricResult.details?.recipientUserId || 'contact key'
            };
          }
        } catch (asymmetricError) {
          // Fall back to symmetric
        }
      }

      // Fallback to symmetric encryption
      if (!result.success && this.encryptionKey) {
        try {
          const encryptedMessage = await discordCrypto.encrypt(message, this.encryptionKey);
          const finalMessage = this.encodeStealthMessage(encryptedMessage);
          
          result = {
            success: true,
            encryptedText: finalMessage,
            method: 'symmetric',
            recipientInfo: 'shared key'
          };
        } catch (symmetricError) {
          result.error = symmetricError.message;
        }
      }

      if (!result.success && !result.error) {
        result.error = 'No encryption method available';
      }

      sendResponse(result);
    } catch (error) {
      console.error('Failed to test encryption:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleTestDecryption(encryptedText, sendResponse) {
    try {
      let result = { success: false };

      // Try asymmetric decryption first
      if (this.processAsymmetricMessage && typeof this.processAsymmetricMessage === 'function') {
        try {
          const asymmetricResult = await this.processAsymmetricMessage(encryptedText, null);
          if (asymmetricResult && asymmetricResult.success) {
            result = {
              success: true,
              decryptedText: asymmetricResult.decryptedText,
              method: 'asymmetric'
            };
          }
        } catch (asymmetricError) {
          // Fall back to symmetric
        }
      }

      // Fallback to symmetric decryption
      if (!result.success && this.encryptionKey) {
        try {
          const encryptedPayload = this.decodeStealthMessage(encryptedText);
          const decryptedMessage = await discordCrypto.decrypt(encryptedPayload, this.encryptionKey);
          
          result = {
            success: true,
            decryptedText: decryptedMessage,
            method: 'symmetric'
          };
        } catch (symmetricError) {
          result.error = symmetricError.message;
        }
      }

      if (!result.success && !result.error) {
        result.error = 'Cannot decrypt - missing keys or invalid format';
      }

      sendResponse(result);
    } catch (error) {
      console.error('Failed to test decryption:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleUpdateECRotationInterval(intervalMs, sendResponse) {
    try {
      if (!window.ecCrypto) {
        sendResponse({ success: false, error: 'EC crypto not available' });
        return;
      }

      await window.ecCrypto.updateRotationInterval(intervalMs);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to update EC rotation interval:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleRotateKeys(sendResponse) {
    try {
      if (!window.ecCrypto) {
        sendResponse({ success: false, error: 'EC crypto not available' });
        return;
      }

      await window.ecCrypto.rotateKeysNow();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to rotate keys:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleRotateECKeys(source, sendResponse) {
    try {
      console.log(`🔐 [CONTENT] 🔑 EC key rotation triggered by: ${source}`);
      
      if (!window.ecCrypto) {
        console.log('🔐 [CONTENT] 🔑 EC crypto not available');
        sendResponse({ success: false, error: 'EC crypto not available' });
        return;
      }

      // Perform the rotation
      await window.ecCrypto.rotateKeysNow();
      
      console.log('🔐 [CONTENT] 🔑 ✅ EC key rotation completed successfully');
      sendResponse({ success: true, source: source });
      
    } catch (error) {
      console.error('🔐 [CONTENT] 🔑 ❌ Failed to rotate EC keys:', error);
      sendResponse({ success: false, error: error.message, source: source });
    }
  }
}

// Initialize when the script loads
const discordCryptochat = new DiscordCryptochat();

// Global function for manual asymmetric initialization (for debugging)
window.forceAsymmetricInit = function() {
  console.log('🔐 [MANUAL] Forcing asymmetric initialization...');
  console.log('🔐 [MANUAL] DiscordCryptochat available:', typeof DiscordCryptochat);
  console.log('🔐 [MANUAL] AsymmetricContentIntegration available:', typeof AsymmetricContentIntegration);
  console.log('🔐 [MANUAL] ecCrypto available:', typeof ecCrypto);
  console.log('🔐 [MANUAL] ecMessageProcessor available:', typeof ecMessageProcessor);
  
  if (discordCryptochat && typeof discordCryptochat.initAsymmetricEncryption === 'function') {
    discordCryptochat.initAsymmetricEncryption();
    console.log('🔐 [MANUAL] Called initAsymmetricEncryption');
    
    setTimeout(() => {
      console.log('🔐 [MANUAL] Results after 2s:');
      console.log('🔐 [MANUAL] Has asymmetric object:', !!discordCryptochat.asymmetric);
      console.log('🔐 [MANUAL] Has processAsymmetricMessage:', typeof discordCryptochat.processAsymmetricMessage);
      console.log('🔐 [MANUAL] Has encryptAsymmetricMessage:', typeof discordCryptochat.encryptAsymmetricMessage);
    }, 2000);
  } else {
    console.log('🔐 [MANUAL] ❌ initAsymmetricEncryption not available');
  }
};

// Global debug function to check key status after rotation
window.debugKeyStatus = function() {
  console.log('🔐 [DEBUG] === KEY STATUS DEBUG ===');
  
  if (window.ecCrypto) {
    const myUser = window.ecCrypto.getCurrentUser();
    console.log('🔐 [DEBUG] My User Info:', myUser);
    
    // Check stored key info
    chrome.storage.local.get([
      'ecStaticPrivateKey', 
      'ecStaticPublicKey', 
      'ecMyKeyId',
      'ecKeyGenerated',
      'ecKeyEntropy',
      'ecLastRotation',
      'ecRotationCount'
    ]).then(stored => {
      console.log('🔐 [DEBUG] Stored Key Info:');
      console.log('🔐 [DEBUG]   Key ID:', stored.ecMyKeyId);
      console.log('🔐 [DEBUG]   Generated:', stored.ecKeyGenerated ? new Date(stored.ecKeyGenerated).toLocaleString() : 'Unknown');
      console.log('🔐 [DEBUG]   Last Rotation:', stored.ecLastRotation ? new Date(stored.ecLastRotation).toLocaleString() : 'Never');
      console.log('🔐 [DEBUG]   Rotation Count:', stored.ecRotationCount || 0);
      console.log('🔐 [DEBUG]   Entropy Sample:', stored.ecKeyEntropy ? stored.ecKeyEntropy.substring(0, 50) + '...' : 'None');
      
      if (stored.ecStaticPublicKey) {
        console.log('🔐 [DEBUG]   Public Key Sample:', stored.ecStaticPublicKey.substring(0, 50) + '...');
      }
    });
    
    const contacts = Array.from(window.ecCrypto.userKeys.entries());
    console.log('🔐 [DEBUG] Contact Count:', contacts.length);
    
    contacts.forEach(([userId, userInfo]) => {
      console.log(`🔐 [DEBUG] Contact: ${userInfo.username} (${userId})`);
      console.log(`🔐 [DEBUG]   Key ID: ${userInfo.keyId}`);
      console.log(`🔐 [DEBUG]   Last Seen: ${new Date(userInfo.lastSeen).toLocaleTimeString()}`);
      if (userInfo.rotatedAt) {
        console.log(`🔐 [DEBUG]   Rotated: ${new Date(userInfo.rotatedAt).toLocaleTimeString()}`);
        console.log(`🔐 [DEBUG]   Previous Key: ${userInfo.previousKeyId}`);
      }
    });
  } else {
    console.log('🔐 [DEBUG] ECCrypto not available');
  }
  
  console.log('🔐 [DEBUG] ========================');
};

// Force regenerate unique keys
window.forceUniqueKeys = async function() {
  console.log('🔐 [FORCE] === FORCING UNIQUE KEY GENERATION ===');
  
  if (!window.ecCrypto) {
    console.log('🔐 [FORCE] ECCrypto not available');
    return;
  }
  
  try {
    // Clear all storage first
    await chrome.storage.local.remove([
      'ecStaticPrivateKey', 
      'ecStaticPublicKey', 
      'ecMyKeyId',
      'ecKeyGenerated',
      'ecKeyEntropy',
      'ecEntropyComponents'
    ]);
    
    console.log('🔐 [FORCE] Cleared all stored keys');
    
    // Clear in-memory keys
    window.ecCrypto.staticPrivateKey = null;
    window.ecCrypto.staticPublicKey = null;
    window.ecCrypto.myKeyId = null;
    
    console.log('🔐 [FORCE] Cleared in-memory keys');
    
    // Force regeneration with unique timestamp and extra entropy
    const uniqueTimestamp = Date.now();
    const extraEntropy = crypto.getRandomValues(new Uint8Array(64));
    const userAgent = navigator.userAgent;
    const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
    
    console.log('🔐 [FORCE] Unique Timestamp:', uniqueTimestamp);
    console.log('🔐 [FORCE] Extra Entropy:', Array.from(extraEntropy.slice(0, 8)).join(','), '...');
    console.log('🔐 [FORCE] Screen Info:', screenInfo);
    
    // Wait a moment to ensure timestamp differences
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Generate completely new keypair
    await window.ecCrypto.generateStaticKeypair();
    
    console.log('🔐 [FORCE] New keypair generated!');
    console.log('🔐 [FORCE] New Key ID:', window.ecCrypto.myKeyId);
    
    // Reload to ensure consistency
    await window.ecCrypto.loadOrGenerateStaticKeypair();
    
    console.log('🔐 [FORCE] Reloaded and verified');
    console.log('🔐 [FORCE] Final Key ID:', window.ecCrypto.myKeyId);
    
  } catch (error) {
    console.error('🔐 [FORCE] Error during force regeneration:', error);
  }
  
  console.log('🔐 [FORCE] =======================================');
};

// Quick fix after key rotation
window.fixAfterRotation = async function() {
  console.log('🔐 [FIX] === FIXING COMMUNICATION AFTER ROTATION ===');
  
  if (!window.ecCrypto) {
    console.log('🔐 [FIX] ECCrypto not available');
    return;
  }
  
  try {
    // Clear all contacts first
    await window.ecCrypto.clearAllContacts();
    console.log('🔐 [FIX] ✅ Cleared all contacts');
    
    // Force key reload
    await window.ecCrypto.loadOrGenerateStaticKeypair();
    console.log('🔐 [FIX] ✅ Reloaded keys');
    
    console.log('🔐 [FIX] ✅ Ready for new contact discovery');
    console.log('🔐 [FIX] 💡 Send a test message to rediscover contacts');
    
  } catch (error) {
    console.error('🔐 [FIX] Error during fix:', error);
  }
  
  console.log('🔐 [FIX] ==============================');
};

// Clean up corrupted contacts (contacts with same Key ID as ours)
window.cleanupCorruptedContacts = async function() {
  console.log('🔐 [CLEANUP] === CLEANING CORRUPTED CONTACTS ===');
  
  if (!window.ecCrypto) {
    console.log('🔐 [CLEANUP] ECCrypto not available');
    return;
  }
  
  try {
    const removedCount = await window.ecCrypto.cleanupCorruptedContacts();
    console.log(`🔐 [CLEANUP] ✅ Cleaned up ${removedCount} corrupted contacts`);
    
    if (removedCount > 0) {
      console.log('🔐 [CLEANUP] 💡 Corruption should be resolved now');
    } else {
      console.log('🔐 [CLEANUP] 💡 No corrupted contacts found');
    }
    
  } catch (error) {
    console.error('🔐 [CLEANUP] Error during cleanup:', error);
  }
  
  console.log('🔐 [CLEANUP] ================================');
}; 