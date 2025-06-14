/**
 * Lemonade - Discord Encryption
 * Content Script - Handles message interception and encryption/decryption
 * 🍋 Sweet & Secure Discord Encryption
 */

// Simple console logging only
class Logger {
  static async log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    // Console log only
    // console.log(logMessage, data || '');
    
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
    this.encryptionKey = null;
    this.autoEncryptEnabled = false;
    this.isEnabled = true;
    this.isProcessingMessage = false;
    this.scanFrequency = 1000; // Default scan frequency in ms
    this.initialDelay = 500; // Default initial delay in ms
    this.minScanFrequency = 500;
    this.maxScanFrequency = 5000;
    
    // Network interception for tenor URLs
    this.tenorUrlMap = new Map(); // Maps media.tenor.com URLs to proper tenor.com/view URLs
    this.setupNetworkInterception();
    
    this.init();
  }

  // ==================== NETWORK INTERCEPTION FOR TENOR URLS ====================

  setupNetworkInterception() {
    // console.log('🔐 [GIF] 🌐 Setting up network interception for tenor URLs...');
    
    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      const url = args[0];
      if (typeof url === 'string' && url.includes('discord.com/api/v9/gifs/search')) {
        // console.log('🔐 [GIF] 🎯 Intercepted Discord GIF search API call:', url);
        
        // Let the request proceed and intercept the response
        return originalFetch(...args).then(response => {
          if (response.ok) {
            // Clone the response to read it without consuming the original
            const clonedResponse = response.clone();
            clonedResponse.json().then(data => {
              if (Array.isArray(data)) {
                this.mapTenorUrls(data);
              }
            }).catch(error => {
              //console.log('🔐 [GIF] ❌ Failed to parse GIF search response:', error);
            });
          }
          return response;
        });
      }
      return originalFetch(...args);
    };

    // Also intercept XMLHttpRequest as fallback
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      if (typeof url === 'string' && url.includes('discord.com/api/v9/gifs/search')) {
        // console.log('🔐 [GIF] 🎯 Intercepted XHR Discord GIF search API call:', url);
        
        // Store reference to track this request
        this._isGifSearch = true;
        
        // Intercept the response
        this.addEventListener('load', function() {
          if (this._isGifSearch && this.status === 200) {
            try {
              const data = JSON.parse(this.responseText);
              if (Array.isArray(data)) {
                window.discordCryptochat?.mapTenorUrls(data);
              }
            } catch (error) {
              //console.log('🔐 [GIF] ❌ Failed to parse XHR GIF search response:', error);
            }
          }
        });
      }
      return originalOpen.call(this, method, url, ...args);
    };
    
    // console.log('🔐 [GIF] ✅ Network interception setup complete');
  }

  mapTenorUrls(gifData) {
    // console.log('🔐 [GIF] 📊 Processing GIF search results:', gifData.length, 'items');
    
    gifData.forEach((gif, index) => {
      if (gif.src && gif.url) {
        // Map Discord's media URL to proper tenor URL
        this.tenorUrlMap.set(gif.src, gif.url);
        // console.log(`🔐 [GIF] 🗺️  Mapped [${index + 1}]:`, gif.src, '→', gif.url);
      }
    });
    
    // console.log('🔐 [GIF] ✅ Total URL mappings:', this.tenorUrlMap.size);
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
      
      // console.log('🔐 [CRYPTO] Settings loaded - Auto-encrypt:', this.autoEncryptEnabled, 'Asymmetric:', this.asymmetricEnabled);
      
      if (!this.encryptionKey) {
        this.showKeyWarning();
      }
    } catch (error) {
      //console.log('Failed to load encryption key:', error);
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
      //console.log('Failed to load speed settings:', error);
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
    // console.log('🔐 [CRYPTO] Attempting to initialize asymmetric encryption...');
    try {
      if (typeof this.initAsymmetricEncryption === 'function') {
        this.initAsymmetricEncryption();
        // console.log('🔐 [CRYPTO] initAsymmetricEncryption() called');
      } else {
        // console.log('🔐 [CRYPTO] ❌ initAsymmetricEncryption method not found!');
        // console.log('🔐 [CRYPTO] Available methods:', Object.getOwnPropertyNames(this.__proto__));
      }
    } catch (error) {
      //console.log('🔐 [CRYPTO] ❌ Asymmetric initialization error:', error);
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
      } else if (request.action === 'updateAutoEncrypt') {
        // Update auto-encrypt setting
        this.autoEncryptEnabled = request.enabled;
        // console.log('🔐 [GIF] 🔄 Auto-encrypt setting updated:', this.autoEncryptEnabled ? 'ENABLED' : 'DISABLED');
        sendResponse({ success: true });
        return true;
      } else if (request.action === 'updateCurrentUser') {
        // Update current user information
        if (this.ecCrypto) {
          await this.ecCrypto.setCurrentUser(request.userId, request.username);
          // console.log('🔐 [EC] 👤 Current user updated:', request.username, '(ID:', request.userId + ')');
        }
        sendResponse({ success: true });
        return true;
      } else if (request.action === 'detectCurrentUser') {
        // Auto-detect current Discord user from DOM
        try {
          const userInfo = this.detectDiscordUserFromDOM();
          sendResponse(userInfo);
        } catch (error) {
          sendResponse({ error: error.message });
        }
        return true;
      } else if (request.action === 'updateLanguageSettings') {
        // Language settings updated from options page
        console.log('🎭 [LANGUAGE] Language settings updated, clearing cache and reloading');
        
        // Clear any cached language settings if needed
        this.cachedStealthLanguage = null;
        
        sendResponse({ success: true });
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
    
    // Setup GIF picker interception
    this.setupGifPickerInterception();
    
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
    
    // Setup GIF picker interception
    this.setupGifPickerInterception();
  }

  async setupGifPickerInterception() {
    // console.log('🔐 [GIF] 🎬 Setting up GIF picker interception...');
    
    // Watch for GIF picker elements to be added to the DOM
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Clean up removed nodes first to prevent memory leaks
          mutation.removedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.cleanupGifPickerElement(node);
            }
          });
          
          // Look for GIF picker containers in added nodes
          const gifPickerContainers = [
            ...mutation.addedNodes
          ].filter(node => 
            node.nodeType === Node.ELEMENT_NODE && 
            (node.classList?.contains('content_fed6d3') || 
             node.querySelector?.('.result__2dc39') ||
             node.id === 'gif-picker-tab-panel')
          );
          
          // Also check existing elements that might have been updated
          if (mutation.target.classList?.contains('content_fed6d3') || 
              mutation.target.querySelector?.('.result__2dc39')) {
            gifPickerContainers.push(mutation.target);
          }
          
          gifPickerContainers.forEach(container => {
            // Add small delay to let Discord finish rendering
            setTimeout(() => {
              try {
                this.interceptGifPickerInContainer(container);
              } catch (error) {
                console.log('🔐 [GIF] ⚠️ Non-critical error during GIF interception:', error.message);
              }
            }, 50);
          });
        }
      }
    });
    
    // Start observing the document for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Store observer for cleanup
    this.gifPickerObserver = observer;
    
    // Also intercept any existing GIF pickers
    this.interceptExistingGifPickers();
    
    // Cleanup function for when extension is disabled/reloaded
    window.addEventListener('beforeunload', () => {
      this.cleanupAllGifInterception();
    });
    
    // Global error handler for DOM manipulation issues
    window.addEventListener('error', (event) => {
      if (event.error && event.error.message && 
          event.error.message.includes('removeChild') &&
          event.error.message.includes('not a child')) {
        console.log('🔐 [GIF] 🛡️ Caught DOM removeChild error - cleaning up overlays');
        // Clean up any leftover feedback overlays that might be causing issues
        try {
          const leftoverOverlays = document.querySelectorAll('.crypto-gif-feedback');
          leftoverOverlays.forEach(overlay => {
            try {
              if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
              }
            } catch (e) {
              // Ignore
            }
          });
        } catch (e) {
          // Ignore
        }
        event.preventDefault(); // Prevent the error from crashing Discord
        return true;
      }
    });
    
    // console.log('🔐 [GIF] ✅ GIF picker interception setup complete');
  }

  // Clean up function to safely remove our modifications
  cleanupGifPickerElement(element) {
    try {
      // Clean up debounce timers
      if (element._debounceTimer) {
        clearTimeout(element._debounceTimer);
        delete element._debounceTimer;
      }
      
      // Clean up observers
      if (element._cryptoObserver) {
        element._cryptoObserver.disconnect();
        delete element._cryptoObserver;
      }
      
      // Remove any crypto feedback overlays that might be children of this element
      const feedbackOverlays = element.querySelectorAll('.crypto-gif-feedback');
      feedbackOverlays.forEach(overlay => {
        try {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        } catch (error) {
          // Ignore - element may already be removed
        }
      });
      
      // Clean up event handlers from intercepted GIF results
      const interceptedElements = element.querySelectorAll('[data-crypto-intercepted="true"]');
      interceptedElements.forEach(el => {
        try {
          if (el._cryptoClickHandler) {
            el.removeEventListener('click', el._cryptoClickHandler, { capture: true });
            delete el._cryptoClickHandler;
          }
          
          // Also clean up child elements
          const childElements = el.querySelectorAll('video, img');
          childElements.forEach(child => {
            if (child._cryptoClickHandler) {
              child.removeEventListener('click', child._cryptoClickHandler, { capture: true });
              delete child._cryptoClickHandler;
            }
          });
          
          delete el.dataset.cryptoIntercepted;
        } catch (error) {
          // Ignore cleanup errors
        }
      });
      
      // Clean up container-level data
      delete element.dataset.cryptoGifIntercepted;
      
    } catch (error) {
      // Ignore cleanup errors - this is just preventive maintenance
    }
  }

  // Global cleanup function
  cleanupAllGifInterception() {
    try {
      // Remove all feedback overlays
      const allOverlays = document.querySelectorAll('.crypto-gif-feedback');
      allOverlays.forEach(overlay => {
        try {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        } catch (error) {
          // Ignore
        }
      });
      
      // Clean up all intercepted elements
      const allIntercepted = document.querySelectorAll('[data-crypto-intercepted="true"]');
      allIntercepted.forEach(el => {
        this.cleanupGifPickerElement(el.parentNode || el);
      });
      
      // Disconnect observers
      if (this.gifPickerObserver) {
        this.gifPickerObserver.disconnect();
        this.gifPickerObserver = null;
      }
      
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  interceptExistingGifPickers() {
    // Look for existing GIF picker containers
    const existingContainers = document.querySelectorAll('.content_fed6d3, #gif-picker-tab-panel');
    existingContainers.forEach(container => {
      this.interceptGifPickerInContainer(container);
    });
  }

  interceptGifPickerInContainer(container) {
    if (!container || container.dataset.cryptoGifIntercepted) {
      return; // Already intercepted
    }
    
    try {
      // console.log('🔐 [GIF] 🎯 Intercepting GIF picker container');
      container.dataset.cryptoGifIntercepted = 'true';
      
      // Find all GIF result elements
      const gifResults = container.querySelectorAll('.result__2dc39');
      
      gifResults.forEach((gifResult, index) => {
        try {
          this.interceptGifResult(gifResult, index);
        } catch (error) {
          console.log(`🔐 [GIF] ⚠️ Failed to intercept GIF result ${index}:`, error.message);
          // Continue with other results
        }
      });
      
      // Set up observer for new GIF results that might be added dynamically
      const resultObserver = new MutationObserver((mutations) => {
        // Debounce rapid mutations to prevent excessive processing
        clearTimeout(container._debounceTimer);
        container._debounceTimer = setTimeout(() => {
          try {
            for (const mutation of mutations) {
              if (mutation.type === 'childList') {
                const newGifResults = [...mutation.addedNodes].filter(node => 
                  node.nodeType === Node.ELEMENT_NODE && 
                  node.classList?.contains('result__2dc39')
                );
                
                newGifResults.forEach((gifResult, index) => {
                  try {
                    this.interceptGifResult(gifResult, index);
                  } catch (error) {
                    console.log(`🔐 [GIF] ⚠️ Failed to intercept dynamic GIF result ${index}:`, error.message);
                  }
                });
              }
            }
          } catch (error) {
            console.log('🔐 [GIF] ⚠️ Error processing GIF mutations:', error.message);
          }
        }, 100); // 100ms debounce
      });
      
      resultObserver.observe(container, {
        childList: true,
        subtree: true
      });
      
      // Store observer for cleanup
      container._cryptoObserver = resultObserver;
      
    } catch (error) {
      console.log('🔐 [GIF] ⚠️ Failed to intercept GIF picker container:', error.message);
      // Remove the flag so it can be retried
      delete container.dataset.cryptoGifIntercepted;
    }
  }

  interceptGifResult(gifResult, index) {
    if (!gifResult || gifResult.dataset.cryptoIntercepted) {
      return; // Already intercepted
    }
    
    // Check if auto-encrypt is enabled
    if (!this.autoEncryptEnabled) {
      // console.log('🔐 [GIF] ⏸️ Auto-encrypt disabled, skipping GIF interception');
      return;
    }
    
    // Check if this is a category result (should not be intercepted)
    const categoryElements = gifResult.querySelectorAll('[class*="category"]');
    if (categoryElements.length > 0) {
      // console.log('🔐 [GIF] 📂 Category result detected, skipping interception:', categoryElements.length, 'category elements found');
      return;
    }
    
    // console.log(`🔐 [GIF] 🎬 Intercepting GIF result ${index + 1}`);
    gifResult.dataset.cryptoIntercepted = 'true';
    
    // Extract the tenor URL from the GIF element
    let tenorUrl = null;
    
    // Method 1: Check for video source
    const video = gifResult.querySelector('video.gif__2dc39, video');
    if (video && video.src) {
      // Convert Discord's proxy URL back to tenor URL
      tenorUrl = this.extractTenorUrlFromVideo(video.src);
    }
    
    // Method 2: Check for data attributes
    if (!tenorUrl) {
      const dataUrl = gifResult.dataset.url || gifResult.dataset.gifUrl;
      if (dataUrl && !dataUrl.includes('/history')) {
        tenorUrl = dataUrl;
      }
    }
    
    // Method 3: Check for links (but avoid history links)
    if (!tenorUrl) {
      const link = gifResult.querySelector('a[href*="tenor.com"]');
      if (link && link.href && !link.href.includes('/history')) {
        tenorUrl = link.href;
      }
    }
    
    // VALIDATION: Ensure we have a valid tenor URL and it's not a history link
    if (!tenorUrl || tenorUrl.includes('/history') || !tenorUrl.includes('tenor.com')) {
      // console.log('🔐 [GIF] ❌ Invalid or history URL, not intercepting:', tenorUrl);
      return;
    }
    
    // console.log('🔐 [GIF] 🔗 Extracted valid tenor URL:', tenorUrl);
    
    // SAFER APPROACH: Add event listeners without cloning/replacing DOM elements
    // This avoids disrupting React's virtual DOM and prevents crashes
    try {
      // Create a wrapper function that safely handles the click
      const handleGifClick = async (event) => {
        // console.log('🔐 [GIF] 🎯 GIF clicked! Intercepting...');
        
        // Only prevent default if we successfully start the encryption process
        try {
          // Show visual feedback first
          this.showGifInterceptionFeedback(gifResult);
          
          // Prevent the default Discord behavior AFTER we confirm we can handle it
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          
          await this.handleGifSelection(tenorUrl);
        } catch (error) {
          //console.log('🔐 [GIF] ❌ Failed to handle GIF selection:', error);
          this.showError('Failed to send encrypted GIF');
          // Don't prevent default on error - let Discord handle it normally
        }
      };
      
      // Add the main click listener with passive: false to allow preventDefault
      gifResult.addEventListener('click', handleGifClick, { 
        capture: true, // Intercept early 
        once: false,   // Allow multiple clicks
        passive: false // Allow preventDefault
      });
      
      // Store the listener reference for cleanup if needed
      gifResult._cryptoClickHandler = handleGifClick;
      
      // Also add listeners to common clickable children, but less aggressively
      const clickableElements = gifResult.querySelectorAll('video, img');
      clickableElements.forEach(element => {
        // Only add if element doesn't already have our handler
        if (!element._cryptoClickHandler) {
          element.addEventListener('click', handleGifClick, { 
            capture: true, 
            once: false, 
            passive: false 
          });
          element._cryptoClickHandler = handleGifClick;
        }
      });
      
    } catch (error) {
      console.log('🔐 [GIF] ⚠️ Failed to add click listeners (non-critical):', error.message);
      // Don't throw - this is non-critical, GIF picker should still work normally
    }
  }

  extractTenorUrlFromVideo(videoSrc) {
    // Use Discord's media.tenor.com URLs directly - they work perfectly!
    // Example: https://media.tenor.com/bj7D0gpVJ4UAAAPo/waltergotme.mp4
    
    try {
      // console.log('🔐 [GIF] 🔍 Processing video URL:', videoSrc);
      
      // FIRST: Block any history URLs - these are not valid GIF URLs
      if (videoSrc.includes('/view/history') || videoSrc.includes('tenor.com/view/history')) {
        // console.log('🔐 [GIF] 🚫 Blocking tenor history URL (not a GIF)');
        return null;
      }
      
      // NEW APPROACH: Use media.tenor.com URLs directly! 
      // Discord handles these perfectly, no need to convert to tenor.com/view
      const normalizedSrc = videoSrc.startsWith('//') ? `https:${videoSrc}` : videoSrc;
      
      // Method 1: Check if it's a media.tenor.com URL (direct use)
      if (normalizedSrc.includes('media.tenor.com')) {
        // console.log('🔐 [GIF] ✅ Using Discord media URL directly:', normalizedSrc);
        return normalizedSrc;
      }
      
      // Method 2: Check for Discord proxy wrapping
      if (normalizedSrc.includes('discordapp.net/external/') && normalizedSrc.includes('media.tenor.com')) {
        // Extract the actual media.tenor.com URL from Discord's proxy
        const proxyMatch = normalizedSrc.match(/https?:\/\/media\.tenor\.com\/[^\/]+\/[^\/\?]+\.(mp4|gif|webm)/);
        if (proxyMatch) {
          // console.log('🔐 [GIF] ✅ Extracted media URL from Discord proxy:', proxyMatch[0]);
          return proxyMatch[0];
        }
      }
      
      // Method 3: Check network mappings for other formats
      if (this.tenorUrlMap && this.tenorUrlMap.has(normalizedSrc)) {
        const mappedUrl = this.tenorUrlMap.get(normalizedSrc);
        // console.log('🔐 [GIF] 🎯 Using network mapping:', normalizedSrc, '→', mappedUrl);
        // Prefer media URLs over view URLs if available
        if (mappedUrl.includes('media.tenor.com')) {
          return mappedUrl;
        }
        return mappedUrl;
      }
      
      // Method 2: Extract from Discord proxy URL patterns
      if (videoSrc.includes('discordapp.net/external/') && videoSrc.includes('tenor.com')) {
        const patterns = [
          /https?:\/\/media\.tenor\.com\/([^\/]+)\/([^\/\?]+)/,  // Standard pattern with hash
          /media\.tenor\.com\/([^\/]+)\/([^\/\?]+)/,           // Without protocol
          /tenor\.com\/view\/([^\/\?]+)-gif-(\d+)/,            // Direct tenor view URL with proper format
          /tenor\.com\/view\/([^\/\?]+)/                       // Tenor view URL without gif suffix
        ];
        
        for (const pattern of patterns) {
          const match = videoSrc.match(pattern);
          if (match) {
            // Check if this is already a proper tenor view URL
            if (pattern.source.includes('tenor\\.com\\/view')) {
              // console.log('🔐 [GIF] 🎯 Found existing tenor view URL:', match[0]);
              return match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
            } else {
              // Extract from media URL
              const videoId = match[2] ? match[2].replace(/\.(mp4|gif|webm).*$/, '') : match[1].replace(/\.(mp4|gif|webm).*$/, '');
              // console.log('🔐 [GIF] 🎯 Extracted video ID from proxy:', videoId);
              
              // Look for numeric ID in the full URL
              const numericMatch = videoSrc.match(/(\d{15,})/);
              if (numericMatch && videoId.length > 3) {
                return `https://tenor.com/view/${videoId}-gif-${numericMatch[1]}`;
              } else if (videoId.length > 3) {
                return `https://tenor.com/view/${videoId}`;
              }
            }
          }
        }
      }
      
      // Method 3: Handle existing tenor URLs (should already be correct format)
      if (videoSrc.includes('tenor.com/view/') && !videoSrc.includes('/history')) {
        // Extract the URL if it's already in the correct format
        const tenorMatch = videoSrc.match(/(https?:\/\/)?tenor\.com\/view\/([^\/\?\s]+)/);
        if (tenorMatch) {
          const fullUrl = tenorMatch[1] ? tenorMatch[0] : `https://${tenorMatch[0]}`;
          // console.log('🔐 [GIF] 🎯 Found existing tenor view URL:', fullUrl);
          return fullUrl;
        }
      }
      
      // Method 4: Try to extract any very long number that might be a tenor ID (18+ digits)
      const longNumberMatch = videoSrc.match(/(\d{18,})/);
      if (longNumberMatch) {
        // console.log('🔐 [GIF] 🎯 Extracted long number ID:', longNumberMatch[1]);
        // Try to find a descriptive name in the URL for better tenor URL
        const nameMatch = videoSrc.match(/\/([a-zA-Z][a-zA-Z0-9-]{2,})\.(mp4|gif|webm)/);
        if (nameMatch) {
          return `https://tenor.com/view/${nameMatch[1]}-gif-${longNumberMatch[1]}`;
        } else {
          return `https://tenor.com/view/gif-${longNumberMatch[1]}`;
        }
      }
      
      // console.log('🔐 [GIF] ❌ Could not extract valid tenor URL from video source');
      // console.log('🔐 [GIF] 💡 To get proper tenor URLs:');
      // console.log('🔐 [GIF] 💡 1. Open Discord\'s GIF picker and search for GIFs');
      // console.log('🔐 [GIF] 💡 2. This will populate network mappings for accurate URLs');
      // console.log('🔐 [GIF] 💡 3. Then try clicking GIFs from the picker');
      return null;
    } catch (error) {
      //console.log('🔐 [GIF] ❌ Failed to extract tenor URL:', error);
      return null;
    }
  }

  showGifInterceptionFeedback(gifElement) {
    // SAFER feedback method that doesn't disrupt Discord's DOM structure
    try {
      // Create a temporary visual effect without modifying the original element
      const rect = gifElement.getBoundingClientRect();
      const overlay = document.createElement('div');
      overlay.className = 'crypto-gif-feedback'; // Add class for easier cleanup
      overlay.style.cssText = `
        position: fixed;
        top: ${rect.top}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background: rgba(67, 181, 129, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        z-index: 10000;
        border-radius: 8px;
        font-size: 14px;
        pointer-events: none;
        transition: opacity 0.3s;
      `;
      overlay.textContent = '🔐 Encrypting...';
      
      // Append to body instead of modifying the GIF element
      document.body.appendChild(overlay);
      
      // Safely remove after delay with error handling
      setTimeout(() => {
        try {
          if (overlay && overlay.parentNode === document.body) {
            document.body.removeChild(overlay);
          }
        } catch (error) {
          // Ignore removal errors - overlay may have been cleaned up already
          console.log('🔐 [GIF] ℹ️ Overlay cleanup - element already removed');
        }
      }, 1500);
      
      // Also clean up any leftover overlays after 5 seconds (safety net)
      setTimeout(() => {
        try {
          const leftoverOverlays = document.querySelectorAll('.crypto-gif-feedback');
          leftoverOverlays.forEach(el => {
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          });
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 5000);
      
    } catch (error) {
      // If feedback fails, just log and continue - don't break the encryption
      console.log('🔐 [GIF] ⚠️ Feedback display failed (non-critical):', error.message);
    }
  }

  async handleGifSelection(tenorUrl) {
    // console.log('🔐 [GIF] 📤 Processing GIF selection:', tenorUrl);
    
    // Updated validation - accept both media.tenor.com and tenor.com/view URLs
    if (!tenorUrl || tenorUrl.includes('/history') || 
        (!tenorUrl.includes('media.tenor.com') && !tenorUrl.includes('tenor.com/view/'))) {
      // console.log('🔐 [GIF] ❌ Invalid tenor URL, not processing:', tenorUrl);
      return;
    }
    
    // Close the GIF picker first
    this.closeGifPicker();
    
    // Find the message input box
    const messageBox = this.findMessageInputBox();
    if (!messageBox) {
      //console.log('🔐 [GIF] ❌ Could not find message input box');
      return;
    }
    
    // KEEP MP4 URL - they load better than converted GIF URLs
    // console.log('🔐 [GIF] 🔐 Encrypting MP4 URL (will render as video):', tenorUrl);
    
    let encryptedMessage = null;
    let encryptionMethod = 'none';
    
    // Try asymmetric encryption first - BUT ONLY IF ENABLED
    const ecSettings = await chrome.storage.local.get(['ecEnabled']);
    if (ecSettings.ecEnabled && this.encryptAsymmetricMessage && typeof this.encryptAsymmetricMessage === 'function') {
      console.log('🔐 [GIF] 🔐 Asymmetric encryption enabled - trying asymmetric first...');
      try {
        const asymmetricResult = await this.encryptAsymmetricMessage(tenorUrl);
        if (asymmetricResult && asymmetricResult.success) {
          encryptedMessage = asymmetricResult.encryptedText;
          encryptionMethod = 'asymmetric';
          console.log('🔐 [GIF] ✅ Asymmetric encryption SUCCESS! Length:', encryptedMessage.length);
        } else {
          console.log('🔐 [GIF] ❌ Asymmetric encryption failed - falling back to symmetric...');
        }
      } catch (error) {
        console.log('🔐 [GIF] ❌ Asymmetric encryption error - falling back to symmetric:', error.message);
      }
    } else if (!ecSettings.ecEnabled) {
      console.log('🔐 [GIF] ⚠️ Asymmetric encryption disabled by user - using symmetric only');
    } else {
      console.log('🔐 [GIF] ⚠️ Asymmetric encryption not available - using symmetric only');
    }
    
    // Fallback to symmetric encryption if asymmetric failed or wasn't attempted
    if (!encryptedMessage) {
      if (!this.encryptionKey) {
        console.log('🔐 [GIF] ❌ No symmetric encryption key available - cannot encrypt');
        this.showError('No encryption key set! Please configure encryption key in options.');
        return;
      }
      
      console.log('🔐 [GIF] 🔑 Falling back to symmetric encryption...');
      try {
        const discordCrypto = new DiscordCrypto();
        const symmetricResult = await discordCrypto.encrypt(tenorUrl, this.encryptionKey);
        if (symmetricResult) {
          encryptedMessage = await this.encodeStealthMessage(symmetricResult);
          encryptionMethod = 'symmetric';
          console.log('🔐 [GIF] ✅ Symmetric encryption SUCCESS! Length:', encryptedMessage.length);
        } else {
          console.log('🔐 [GIF] ❌ Symmetric encryption returned null result');
        }
      } catch (error) {
        console.log('🔐 [GIF] ❌ Symmetric encryption error:', error.message);
      }
    }
    
    // Final check - if no encryption method worked, show error
    if (!encryptedMessage) {
      console.log('🔐 [GIF] ❌ All encryption methods failed - cannot encrypt GIF');
      this.showError('Failed to encrypt GIF - please check your encryption settings');
      return;
    }
    
    console.log('🔐 [GIF] ✅ GIF encrypted successfully using:', encryptionMethod);
    
    // Insert the encrypted message
    await this.insertMessageContent(messageBox, encryptedMessage);
    
    // Wait a bit longer to ensure content is properly inserted
    setTimeout(() => {
      this.sendMessage(messageBox);
    }, 250);
    
    // console.log('🔐 [GIF] ✅ Encrypted GIF sent successfully');
  }

  closeGifPicker() {
    // Try multiple methods to close the GIF picker
    
    // Method 1: Click the back button
    const backButton = document.querySelector('.backButton_fed6d3');
    if (backButton) {
      // console.log('🔐 [GIF] ⬅️ Closing GIF picker with back button');
      backButton.click();
      return;
    }
    
    // Method 2: Press Escape key
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(escapeEvent);
    
    // Method 3: Click outside the picker (find the overlay)
    const overlay = document.querySelector('[class*="layer"]');
    if (overlay) {
      overlay.click();
    }
    
    // console.log('🔐 [GIF] ❌ GIF picker close attempted');
  }

  findMessageInputBox() {
    const selectors = [
      '[data-slate-editor="true"]',
      '[role="textbox"]',
      'div[contenteditable="true"]',
      '.message-text-area textarea',
      '.message-text-area div[contenteditable]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // console.log('🔐 [GIF] 📝 Found message input with selector:', selector);
        return element;
      }
    }
    
    // console.log('🔐 [GIF] ❌ Could not find message input box');
    return null;
  }

  clearMessageBox(messageBox) {
    // Clear the message box content
    if (messageBox.hasAttribute('contenteditable')) {
      messageBox.innerHTML = '';
      messageBox.textContent = '';
    } else if (messageBox.value !== undefined) {
      messageBox.value = '';
    }
    
    // Trigger input events to notify Discord
    messageBox.dispatchEvent(new Event('input', { bubbles: true }));
    messageBox.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async insertMessageContent(messageBox, content) {
    // console.log('🔐 [GIF] 📝 Inserting content using EXACT SAME METHOD as text encryption:', content);
    
    // Use the EXACT SAME clipboard method as handleOutgoingMessage to prevent corruption
    try {
      // Focus the message box
      messageBox.focus();
      
      // Store original clipboard content to restore later
      let originalClipboard = '';
      try {
        originalClipboard = await navigator.clipboard.readText();
      } catch (e) {
        // Clipboard access might be denied, that's ok
      }
      
      // Copy content to clipboard
      await navigator.clipboard.writeText(content);
      
      // Select all current text
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(messageBox);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Paste the content (Ctrl+V simulation) - EXACT SAME as handleOutgoingMessage
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer()
      });
      
      // Add the content to clipboard data
      pasteEvent.clipboardData.setData('text/plain', content);
      
      messageBox.dispatchEvent(pasteEvent);
      
      // Also try execCommand as fallback
      document.execCommand('paste');
      
      // Restore original clipboard if we had one
      if (originalClipboard) {
        setTimeout(() => {
          navigator.clipboard.writeText(originalClipboard);
        }, 1000);
      }
      
      // console.log('🔐 [GIF] ✅ Content inserted via clipboard method (identical to text encryption)');
      
    } catch (error) {
      //console.log('🔐 [GIF] ❌ Failed to insert content:', error);
      throw error;
    }
  }

  sendMessage(messageBox) {
    // Try multiple methods to send the message
    
    // Method 1: Find and click the send button
    const sendSelectors = [
      'button[aria-label="Send Message"]:not([disabled])',
      'button[aria-label*="Send Message"]:not([disabled])',
      'button:has(.sendIcon_aa63ab):not([disabled])',
      '[data-list-item-id="send-message-button"]:not([disabled])'
    ];
    
    for (const selector of sendSelectors) {
      const sendButton = document.querySelector(selector);
      if (sendButton) {
        // console.log('🔐 [GIF] 📤 Sending message with button:', selector);
        sendButton.click();
        return;
      }
    }
    
    // Method 2: Simulate Enter key press
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      bubbles: true,
      cancelable: true
    });
    
    messageBox.dispatchEvent(enterEvent);
    
    // console.log('🔐 [GIF] 📤 Message send attempted with Enter key');
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
    
    // Get message text with proper emoji handling
    let messageText = '';
    
    // Method 1: Try to extract rich content including emojis
    messageText = this.extractRichMessageContent(messageBox);
    
    // Method 2: Fallback to textContent
    if (!messageText) {
    messageText = messageBox.textContent?.trim() || '';
    }
    
    // Method 3: Fallback to innerText
    if (!messageText) {
      messageText = messageBox.innerText?.trim() || '';
    }
    
    // Method 4: Look for slate string elements
    if (!messageText) {
      const slateStrings = messageBox.querySelectorAll('[data-slate-string="true"]');
      if (slateStrings.length > 0) {
        messageText = Array.from(slateStrings).map(el => el.textContent).join('').trim();
      }
    }
    
    // Determine if we should encrypt this message
    const isTenorUrl = messageText.includes('media.tenor.com') || messageText.includes('tenor.com/view/');
    const shouldEncrypt = this.autoEncryptEnabled || messageText.startsWith('!priv ') || isTenorUrl;
    
    // DEBUG: Log the detection logic
    // console.log('🔐 [DEBUG] Message text:', messageText);
    // console.log('🔐 [DEBUG] Auto-encrypt enabled:', this.autoEncryptEnabled);
    // console.log('🔐 [DEBUG] Starts with !priv:', messageText.startsWith('!priv '));
    // console.log('🔐 [DEBUG] Is tenor URL:', isTenorUrl);
    // console.log('🔐 [DEBUG] Should encrypt:', shouldEncrypt);
    
    if (!shouldEncrypt) {
      // console.log('🔐 [DEBUG] Not encrypting - letting Discord handle normally');
      return; // Not a message to encrypt, let Discord handle it normally
    }
    
    // console.log('🔐 [DEBUG] ✅ Proceeding with encryption...');

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

      // Try asymmetric encryption first if available - BUT ONLY IF ENABLED
      const ecSettings = await chrome.storage.local.get(['ecEnabled']);
      if (ecSettings.ecEnabled && this.encryptAsymmetricMessage && typeof this.encryptAsymmetricMessage === 'function') {
        console.log('🔐 [ENCRYPT] 🔐 Asymmetric encryption enabled - trying asymmetric first...');
        try {
          const asymmetricResult = await this.encryptAsymmetricMessage(actualMessage);
          if (asymmetricResult && asymmetricResult.success) {
            encryptedMessage = asymmetricResult.encryptedText;
            encryptionMethod = 'asymmetric';
            encryptionDetails = asymmetricResult.details || {};
            console.log('🔐 [ENCRYPT] ✅ Asymmetric encryption SUCCESS!');
            console.log('🔐 [ENCRYPT] Details:', encryptionDetails);
            console.log('🔐 [ENCRYPT] Encrypted length:', encryptedMessage.length);
          } else {
            console.log('🔐 [ENCRYPT] ❌ Asymmetric encryption failed - falling back to symmetric...');
          }
        } catch (asymmetricError) {
          console.log('🔐 [ENCRYPT] ❌ Asymmetric encryption error - falling back to symmetric:', asymmetricError.message);
        }
      } else if (!ecSettings.ecEnabled) {
        console.log('🔐 [ENCRYPT] ⚠️ Asymmetric encryption disabled by user - using symmetric only');
      } else {
        console.log('🔐 [ENCRYPT] ⚠️ Asymmetric encryption not available - using symmetric only');
      }

      // Fallback to symmetric encryption if asymmetric failed or wasn't attempted
      if (!encryptedMessage) {
        if (!this.encryptionKey) {
          console.log('🔐 [ENCRYPT] ❌ No symmetric encryption key available - cannot encrypt');
          event.preventDefault();
          event.stopPropagation();
          this.showKeyWarning();
          this.isProcessingMessage = false;
          return;
        }
        
        console.log('🔐 [ENCRYPT] 🔑 Falling back to symmetric encryption...');
        try {
          encryptedMessage = await discordCrypto.encrypt(actualMessage, this.encryptionKey);
          if (encryptedMessage) {
            encryptionMethod = 'symmetric';
            encryptionDetails = { keyType: 'shared_secret' };
            console.log('🔐 [ENCRYPT] ✅ Symmetric encryption SUCCESS!');
            console.log('🔐 [ENCRYPT] Encrypted length:', encryptedMessage.length);
          } else {
            console.log('🔐 [ENCRYPT] ❌ Symmetric encryption returned null result');
          }
        } catch (symmetricError) {
          console.log('🔐 [ENCRYPT] ❌ Symmetric encryption error:', symmetricError.message);
        }
      }

      // Final check - if no encryption method worked, show error
      if (!encryptedMessage) {
        console.log('🔐 [ENCRYPT] ❌ All encryption methods failed - cannot encrypt message');
        event.preventDefault();
        event.stopPropagation();
        this.showError('Failed to encrypt message - please check your encryption settings');
        this.isProcessingMessage = false;
        return;
      }

      console.log('🔐 [ENCRYPT] ✅ Message encrypted successfully using:', encryptionMethod);
      const finalMessage = encryptionMethod === 'asymmetric' ? encryptedMessage : await this.encodeStealthMessage(encryptedMessage);
      
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
      //console.log('🔐 [CRYPTO] ❌ Error during message scan:', error);
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
          const encryptedPayload = await this.decodeStealthMessage(messageText);
          // Decrypt the message using symmetric encryption
          decryptedMessage = await discordCrypto.decrypt(encryptedPayload, this.encryptionKey);
          decryptionMethod = 'symmetric';
          decryptionDetails = { keyType: 'shared_secret' };
        } catch (symmetricError) {
          // Symmetric decryption failed, will try asymmetric
        }
      }
      
      if (decryptedMessage) {
        // Enhanced message rendering with emoji, GIF, and link support
        await this.renderDecryptedMessage(messageContent, decryptedMessage);
        
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

  async renderDecryptedMessage(messageContent, decryptedText) {
    // 🎨 Enhanced message rendering with emoji, GIF, and link support
    try {
      // Clear existing content
      messageContent.innerHTML = '';
      
      // Process the decrypted text for various Discord elements
      let processedText = decryptedText;
      
      // The text should already contain proper emojis from encryption
      // Process URLs and create proper elements (async now)
      const messageElements = await this.processLinksAndGifs(processedText);
      
      // Add all processed elements to the message container
      messageElements.forEach(element => {
        messageContent.appendChild(element);
      });
      
      // Apply Discord message styling
      messageContent.style.whiteSpace = 'pre-wrap';
      messageContent.style.wordWrap = 'break-word';
      
    } catch (error) {
      //console.log('🎨 Message rendering failed, falling back to plain text:', error);
      messageContent.textContent = decryptedText;
    }
  }



  async processLinksAndGifs(text) {
    // First check if this is a large emoji message (1-3 emojis only)
    if (this.isLargeEmojiMessage(text)) {
      console.log('🎨 [RENDER] 😀 Large emoji message detected');
      return [this.createLargeEmojiElement(text)];
    }
    
    const elements = [];
    const parts = text.split(/(\s+)/); // Split by whitespace but keep the whitespace
    
    for (const part of parts) {
      if (this.isUrl(part)) {
        // console.log('🎨 [RENDER] Processing URL:', part);
        
        if (this.isDirectImageUrl(part)) {
          // Direct image URL - embed immediately
          // console.log('🎨 [RENDER] → Direct image URL, creating embed');
          const mediaContainer = this.createDirectImageEmbed(part);
          elements.push(mediaContainer);
        } else if (this.isSocialMediaUrl(part)) {
          // Social media URL - fetch metadata and create rich embed
          // console.log('🎨 [RENDER] → Social media URL, creating rich embed');
          const richEmbed = await this.createRichMediaEmbed(part);
          elements.push(richEmbed);
        } else {
          // Regular link
          // console.log('🎨 [RENDER] → Regular link');
          elements.push(this.createLink(part));
        }
      } else {
        // Regular text
        const textNode = document.createTextNode(part);
        elements.push(textNode);
      }
    }
    
    return elements;
  }

  isLargeEmojiMessage(text) {
    // Remove whitespace and check if message contains only emojis
    const trimmed = text.trim();
    
    // Regex to match emoji characters (including compound emojis)
    const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
    const emojiMatches = trimmed.match(emojiRegex);
    
    if (!emojiMatches) return false;
    
    // Check if the message contains only emojis (1-3 emojis)
    const emojiCount = emojiMatches.length;
    if (emojiCount > 3 || emojiCount === 0) return false;
    
    // Remove all emojis and check if anything substantial remains
    const withoutEmojis = trimmed.replace(emojiRegex, '').trim();
    
    // Allow for very minimal text like spaces or simple punctuation
    return withoutEmojis.length <= 2;
  }

  createLargeEmojiElement(text) {
    const container = document.createElement('div');
    container.style.cssText = `
      font-size: 48px;
      line-height: 1.2;
      margin: 8px 0;
      text-align: left;
    `;
    
    // Clean up the text but preserve emojis
    const cleanText = text.trim();
    container.textContent = cleanText;
    
    console.log('🎨 [RENDER] ✨ Created large emoji element:', cleanText);
    return container;
  }

  createDirectImageEmbed(url) {
    const container = document.createElement('div');
    container.style.cssText = `
      margin: 8px 0;
      border-radius: 8px;
      overflow: hidden;
      background: #2f3136;
      border: 1px solid #40444b;
      max-width: min(400px, 80vw);
      display: inline-block;
    `;

    // Check if this is a media.tenor.com MP4 video
    if (url.includes('media.tenor.com') && url.includes('.mp4')) {
      console.log('🎨 [RENDER] 🎬 Creating video element for Tenor MP4:', url);
      
      const video = document.createElement('video');
      video.src = url;
      video.style.cssText = `
        display: block;
        cursor: pointer;
        max-width: 100%;
        max-height: 300px;
        width: auto;
        height: auto;
      `;
      
      // Make it behave like a GIF
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      
      // Add click handler for popup modal
      video.addEventListener('click', () => {
        this.showGifModal(url, 'video');
      });
      
      video.onloadeddata = () => {
        console.log('🎨 [RENDER] ✅ Video loaded successfully:', url);
        // Resize container to fit video dimensions
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        
        if (videoWidth && videoHeight) {
          const aspectRatio = videoWidth / videoHeight;
          const maxWidth = Math.min(400, window.innerWidth * 0.8);
          const maxHeight = 300;
          
          let finalWidth = videoWidth;
          let finalHeight = videoHeight;
          
          // Scale down if too large
          if (finalWidth > maxWidth) {
            finalWidth = maxWidth;
            finalHeight = maxWidth / aspectRatio;
          }
          if (finalHeight > maxHeight) {
            finalHeight = maxHeight;
            finalWidth = maxHeight * aspectRatio;
          }
          
          video.style.width = finalWidth + 'px';
          video.style.height = finalHeight + 'px';
          container.style.width = finalWidth + 'px';
          container.style.height = finalHeight + 'px';
        }
      };
      
      video.onerror = (error) => {
        console.log('🎨 [RENDER] ❌ Video failed to load:', url, error);
        
        // Fallback to styled link
        const link = this.createTenorStyleLink(url);
        container.innerHTML = '';
        container.appendChild(link);
        container.style.padding = '8px';
      };
      
      container.appendChild(video);
      return container;
    }

    // For regular images
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = `
      display: block;
      cursor: pointer;
      max-width: 100%;
      max-height: 300px;
      width: auto;
      height: auto;
    `;
    
    // Add click handler for popup modal
    img.addEventListener('click', () => {
      this.showGifModal(url, 'image');
    });
    
    img.onload = () => {
      console.log('🎨 [RENDER] ✅ Image loaded successfully:', url);
      // Resize container to fit image dimensions  
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      
      if (imgWidth && imgHeight) {
        const aspectRatio = imgWidth / imgHeight;
        const maxWidth = Math.min(400, window.innerWidth * 0.8);
        const maxHeight = 300;
        
        let finalWidth = imgWidth;
        let finalHeight = imgHeight;
        
        // Scale down if too large
        if (finalWidth > maxWidth) {
          finalWidth = maxWidth;
          finalHeight = maxWidth / aspectRatio;
        }
        if (finalHeight > maxHeight) {
          finalHeight = maxHeight;
          finalWidth = maxHeight * aspectRatio;
        }
        
        img.style.width = finalWidth + 'px';
        img.style.height = finalHeight + 'px';
        container.style.width = finalWidth + 'px';
        container.style.height = finalHeight + 'px';
      }
    };
    
    img.onerror = (error) => {
      console.log('🎨 [RENDER] ❌ Image failed to load:', url, error);
      
      // Fallback to regular link
      const link = this.createLink(url);
      container.innerHTML = '';
      container.appendChild(link);
      container.style.padding = '8px';
    };
    
    container.appendChild(img);
    return container;
  }

  showGifModal(url, type = 'image') {
    // Create modal backdrop
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      cursor: pointer;
      animation: fadeIn 0.2s ease-out;
    `;

    // Add CSS animation
    if (!document.getElementById('gif-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'gif-modal-styles';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoomIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // Create media container
    const mediaContainer = document.createElement('div');
    mediaContainer.style.cssText = `
      max-width: 90vw;
      max-height: 90vh;
      position: relative;
      animation: zoomIn 0.3s ease-out;
      cursor: default;
    `;

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.style.cssText = `
      position: absolute;
      top: -40px;
      right: 0;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      font-size: 24px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.3)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
    });

    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.remove();
    });

    // Create the media element
    let mediaElement;
    if (type === 'video' || url.includes('.mp4')) {
      mediaElement = document.createElement('video');
      mediaElement.src = url;
      mediaElement.autoplay = true;
      mediaElement.loop = true;
      mediaElement.muted = true;
      mediaElement.controls = true; // Show controls in modal
      mediaElement.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      `;
    } else {
      mediaElement = document.createElement('img');
      mediaElement.src = url;
      mediaElement.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      `;
    }

    // Prevent media element from closing modal when clicked
    mediaElement.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Close modal when clicking backdrop
    modal.addEventListener('click', () => {
      modal.remove();
    });

    // Close modal with Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Assemble modal
    mediaContainer.appendChild(mediaElement);
    mediaContainer.appendChild(closeButton);
    modal.appendChild(mediaContainer);
    document.body.appendChild(modal);

    // Clean up event listener when modal is removed
    modal.addEventListener('remove', () => {
      document.removeEventListener('keydown', handleEscape);
    });

    // console.log('🎨 [MODAL] 🖼️ GIF modal opened for:', url);
  }

  createTenorStyleLink(url) {
    // Create a GIF-style preview for Tenor URLs that can't load directly
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: linear-gradient(135deg, #7289da, #5865f2);
      border-radius: 8px;
      color: white;
      cursor: pointer;
      margin: 4px 0;
      transition: all 0.2s ease;
      border: 2px solid #4f5660;
    `;
    
    container.innerHTML = `
      <div style="font-size: 24px; margin-right: 12px;">🎬</div>
      <div style="flex: 1;">
        <div style="font-weight: 600; margin-bottom: 2px;">Tenor GIF</div>
        <div style="font-size: 12px; opacity: 0.8;">Click to view animated GIF</div>
      </div>
      <div style="font-size: 18px;">▶️</div>
    `;
    
    container.addEventListener('click', () => {
      window.open(url, '_blank');
    });
    
    container.addEventListener('mouseenter', () => {
      container.style.transform = 'scale(2.42)';
      container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    });
    
    container.addEventListener('mouseleave', () => {
      container.style.transform = 'scale(1)';
      container.style.boxShadow = 'none';
    });
    
    return container;
  }

  async createRichMediaEmbed(url) {
    // Create loading placeholder
    const container = document.createElement('div');
    container.style.cssText = `
      margin: 8px 0;
      border-radius: 8px;
      overflow: hidden;
      background: #2f3136;
      border: 1px solid #40444b;
      max-width: 400px;
      min-height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    `;

    // Show loading indicator
    container.innerHTML = `
      <div style="color: #dcddde; font-size: 14px; padding: 20px;">
        🔄 Loading media...
      </div>
    `;

    // Fetch metadata in background
    this.fetchUrlMetadata(url).then(metadata => {
      if (metadata && (metadata.image || metadata.video)) {
        this.renderRichEmbed(container, url, metadata);
      } else {
        // Fallback to link
        container.innerHTML = '';
        container.style.padding = '8px';
        container.appendChild(this.createLink(url));
      }
    }).catch(error => {
      //console.log('Failed to fetch URL metadata:', error);
      // Fallback to link
      container.innerHTML = '';
      container.style.padding = '8px';
      container.appendChild(this.createLink(url));
    });

    return container;
  }

  async fetchUrlMetadata(url) {
    try {
      // Use a CORS proxy to fetch the URL content
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      return this.parseOpenGraphData(html, url);
      
    } catch (error) {
      //console.log('Failed to fetch URL metadata:', error);
      
      // Fallback: try direct URL patterns for known sites
      return this.getKnownSiteMetadata(url);
    }
  }

  parseOpenGraphData(html, originalUrl) {
    try {
      // Create a temporary DOM parser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const metadata = {
        title: '',
        description: '',
        image: '',
        video: '',
        url: originalUrl,
        siteName: ''
      };

      // Primary OpenGraph tags
      const ogImage = doc.querySelector('meta[property="og:image"]');
      const ogImageSecure = doc.querySelector('meta[property="og:image:secure_url"]');
      const ogTitle = doc.querySelector('meta[property="og:title"]');
      const ogDescription = doc.querySelector('meta[property="og:description"]');
      const ogSiteName = doc.querySelector('meta[property="og:site_name"]');
      const ogVideo = doc.querySelector('meta[property="og:video"]');
      const ogVideoUrl = doc.querySelector('meta[property="og:video:url"]');
      
      // Twitter Card tags as fallback
      const twitterImage = doc.querySelector('meta[name="twitter:image"]');
      const twitterImageSrc = doc.querySelector('meta[name="twitter:image:src"]');
      const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
      const twitterDescription = doc.querySelector('meta[name="twitter:description"]');
      const twitterSite = doc.querySelector('meta[name="twitter:site"]');
      
      // Additional image sources (many news sites use these)
      const articleImage = doc.querySelector('meta[property="article:image"]');
      const linkIcon = doc.querySelector('link[rel="apple-touch-icon"]');
      const favicon = doc.querySelector('link[rel="icon"]');
      
      // Standard meta tags as further fallback
      const title = doc.querySelector('title');
      const description = doc.querySelector('meta[name="description"]');
      
      // Try to find first actual content image if no OG image
      let contentImage = null;
      if (!ogImage?.content && !twitterImage?.content) {
        const images = doc.querySelectorAll('img[src]');
        for (const img of images) {
          const src = img.getAttribute('src');
          // Skip small images, icons, and ads - look for content images
          if (src && !src.includes('icon') && !src.includes('logo') && 
              !src.includes('pixel') && !src.includes('beacon') &&
              !src.includes('avatar') && !src.includes('profile') &&
              (img.getAttribute('width') > 100 || img.getAttribute('height') > 100 ||
               (!img.getAttribute('width') && !img.getAttribute('height')))) {
            contentImage = src;
            break;
          }
        }
      }
      
      // Build metadata object with comprehensive fallbacks
      metadata.image = (
        ogImageSecure?.content || 
        ogImage?.content || 
        twitterImageSrc?.content || 
        twitterImage?.content || 
        articleImage?.content ||
        contentImage ||
        linkIcon?.href ||
        favicon?.href ||
        ''
      ).trim();
      
      metadata.title = (
        ogTitle?.content || 
        twitterTitle?.content || 
        title?.textContent || 
        ''
      ).trim();
      
      metadata.description = (
        ogDescription?.content || 
        twitterDescription?.content || 
        description?.content || 
        ''
      ).trim();
      
      metadata.siteName = (
        ogSiteName?.content || 
        (twitterSite?.content ? twitterSite.content.replace('@', '') : '') || 
        ''
      ).trim();
      
      metadata.video = (
        ogVideoUrl?.content ||
        ogVideo?.content || 
        ''
      ).trim();
      
      // Clean up descriptions (remove HTML entities, trim whitespace)
      if (metadata.description) {
        metadata.description = metadata.description
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        
        // Limit description length for display
        if (metadata.description.length > 150) {
          metadata.description = metadata.description.substring(0, 150) + '...';
        }
      }
      
      // Clean up titles
      if (metadata.title) {
        metadata.title = metadata.title
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      // Ensure we have absolute URLs for images
      if (metadata.image && !metadata.image.startsWith('http')) {
        try {
          const baseUrl = originalUrl;
          metadata.image = new URL(metadata.image, baseUrl).href;
        } catch (e) {
          // If URL parsing fails, leave as is
        }
      }

      return metadata;
      
    } catch (error) {
      //console.log('Failed to parse OpenGraph data:', error);
      return null;
    }
  }

  getKnownSiteMetadata(url) {
    // Fallback patterns for known sites when CORS fails
    try {
      // Tenor patterns
      if (url.includes('tenor.com')) {
        // Pattern 1: media.tenor.com direct URLs (used by Discord)
        if (url.includes('media.tenor.com')) {
          // Extract the file ID from the URL
          const match = url.match(/media\.tenor\.com\/([^\/]+)/);
          if (match) {
            // Convert .mp4 to .gif for rendering, preserve the original URL structure
            const gifUrl = url.replace(/\.mp4(\?.*)?$/, '.gif$1');
            return {
              title: 'Tenor GIF',
              image: gifUrl, // Use the GIF version for display
              siteName: 'Tenor',
              url: url // Keep original URL for click-through
            };
          }
        }
        
        // Pattern 2: tenor.com/view/name-ID
        let match = url.match(/tenor\.com\/view\/([^\/]*)-(\d+)/);
        if (match) {
          return {
            title: match[1].replace(/-/g, ' '),
            image: `https://media.tenor.com/images/${match[2]}/tenor.gif`,
            siteName: 'Tenor',
            url: url
          };
        }
        
        // Pattern 3: Any long number in Tenor URL
        match = url.match(/(\d{10,})/);
        if (match) {
          return {
            title: 'Tenor GIF',
            image: `https://media.tenor.com/images/${match[1]}/tenor.gif`,
            siteName: 'Tenor',
            url: url
          };
        }
      }

      // Giphy patterns
      if (url.includes('giphy.com')) {
        const match = url.match(/giphy\.com\/gifs\/[^\/]*-([a-zA-Z0-9]+)$/);
        if (match) {
          return {
            title: 'Giphy GIF',
            image: `https://media.giphy.com/media/${match[1]}/giphy.gif`,
            siteName: 'Giphy',
            url: url
          };
        }
      }

      // YouTube patterns
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('youtube.com/watch?v=')) {
          videoId = new URL(url).searchParams.get('v');
        }
        
        if (videoId) {
          return {
            title: 'YouTube Video',
            image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            siteName: 'YouTube',
            url: url
          };
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  renderRichEmbed(container, originalUrl, metadata) {
    container.innerHTML = '';
    
    // Special handling for different site types
    if (originalUrl.includes('tenor.com')) {
      // Tenor: Only show the GIF, no metadata (handles both tenor.com and media.tenor.com)
      this.renderTenorGif(container, originalUrl, metadata);
    } else if (originalUrl.includes('youtube.com') || originalUrl.includes('youtu.be')) {
      // YouTube: Show thumbnail with play button
      this.renderYouTubeEmbed(container, originalUrl, metadata);
    } else {
      // Other sites: Show image + metadata (like Discord/WhatsApp)
      this.renderGeneralEmbed(container, originalUrl, metadata);
    }
  }

  renderTenorGif(container, originalUrl, metadata) {
    if (metadata.image) {
      const img = document.createElement('img');
      img.src = metadata.image;
      img.style.cssText = `
        width: 100%;
        height: auto;
        max-width: 400px;
        max-height: 300px;
        display: block;
        cursor: pointer;
        object-fit: contain;
        border-radius: 8px;
      `;
      
      img.addEventListener('click', () => {
        window.open(originalUrl, '_blank');
      });
      
      img.onerror = () => {
        // Fallback to simple link
        container.innerHTML = '';
        container.style.padding = '8px';
        container.appendChild(this.createLink(originalUrl));
      };
      
      container.appendChild(img);
    } else {
      // No image found, show as link
      container.innerHTML = '';
      container.style.padding = '8px';
      container.appendChild(this.createLink(originalUrl));
    }
  }

  renderYouTubeEmbed(container, originalUrl, metadata) {
    if (metadata.image) {
      const videoContainer = document.createElement('div');
      videoContainer.style.cssText = `
        position: relative;
        cursor: pointer;
        border-radius: 8px;
        overflow: hidden;
      `;
      
      const img = document.createElement('img');
      img.src = metadata.image;
      img.style.cssText = `
        width: 100%;
        height: auto;
        max-width: 400px;
        max-height: 300px;
        display: block;
        object-fit: contain;
      `;
      
      // Add play button overlay
      const playButton = document.createElement('div');
      playButton.innerHTML = '▶️';
      playButton.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 48px;
        background: rgba(0, 0, 0, 0.8);
        border-radius: 50%;
        width: 80px;
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.9;
        transition: opacity 0.3s;
      `;
      
      videoContainer.addEventListener('click', () => {
        window.open(originalUrl, '_blank');
      });
      
      videoContainer.addEventListener('mouseenter', () => {
        playButton.style.opacity = '1';
      });
      
      videoContainer.addEventListener('mouseleave', () => {
        playButton.style.opacity = '0.9';
      });
      
      img.onerror = () => {
        // Fallback to link with info
        this.renderGeneralEmbed(container, originalUrl, metadata);
      };
      
      videoContainer.appendChild(img);
      videoContainer.appendChild(playButton);
      container.appendChild(videoContainer);
    } else {
      // No thumbnail, show as general embed
      this.renderGeneralEmbed(container, originalUrl, metadata);
    }
  }

  renderGeneralEmbed(container, originalUrl, metadata) {
    // For news sites, social media, etc. - show image + metadata like Discord
    if (metadata.image) {
      const img = document.createElement('img');
      img.src = metadata.image;
      img.style.cssText = `
        width: 100%;
        height: auto;
        max-width: 400px;
        max-height: 300px;
        display: block;
        cursor: pointer;
        object-fit: contain;
        border-radius: 8px 8px 0 0;
      `;
      
      img.addEventListener('click', () => {
        window.open(originalUrl, '_blank');
      });
      
      img.onerror = () => {
        // If image fails, show just the link info
        this.renderLinkInfo(container, originalUrl, metadata);
      };
      
      container.appendChild(img);
    }

    // Add metadata below image (title, description, site name)
    if (metadata.title || metadata.description || metadata.siteName) {
      this.renderLinkInfo(container, originalUrl, metadata);
    }
  }

  renderLinkInfo(container, originalUrl, metadata) {
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
      padding: 12px;
      background: #36393f;
      border-top: 1px solid #40444b;
      cursor: pointer;
    `;
    
    infoDiv.addEventListener('click', () => {
      window.open(originalUrl, '_blank');
    });

    let infoHtml = '';
    
    if (metadata.siteName) {
      infoHtml += `<div style="color: #00b0f4; font-size: 12px; font-weight: 600; margin-bottom: 4px;">${metadata.siteName}</div>`;
    }
    
    if (metadata.title) {
      infoHtml += `<div style="color: #dcddde; font-size: 16px; font-weight: 600; margin-bottom: 4px; line-height: 1.2;">${metadata.title}</div>`;
    }
    
    if (metadata.description) {
      const truncatedDesc = metadata.description.length > 120 ? 
        metadata.description.substring(0, 120) + '...' : metadata.description;
      infoHtml += `<div style="color: #b9bbbe; font-size: 14px; line-height: 1.3;">${truncatedDesc}</div>`;
    }

    infoDiv.innerHTML = infoHtml;
    container.appendChild(infoDiv);
  }

  createLink(url) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    // Create a nicer display text
    let displayText = url;
    try {
      const urlObj = new URL(url);
      displayText = urlObj.hostname + urlObj.pathname;
      if (displayText.length > 50) {
        displayText = displayText.substring(0, 47) + '...';
      }
    } catch (e) {
      if (url.length > 50) {
        displayText = url.substring(0, 47) + '...';
      }
    }
    
    link.textContent = displayText;
    link.style.cssText = `
      color: #00aff4;
      text-decoration: none;
      cursor: pointer;
      font-size: 14px;
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      background: rgba(0, 175, 244, 0.1);
      border: 1px solid rgba(0, 175, 244, 0.3);
      word-break: break-all;
    `;
    
    link.addEventListener('mouseenter', () => {
      link.style.textDecoration = 'underline';
      link.style.background = 'rgba(0, 175, 244, 0.2)';
    });
    
    link.addEventListener('mouseleave', () => {
      link.style.textDecoration = 'none';
      link.style.background = 'rgba(0, 175, 244, 0.1)';
    });
    
    return link;
  }

  isUrl(text) {
    try {
      new URL(text);
      return true;
    } catch {
      return /^https?:\/\/\S+/.test(text);
    }
  }

  isDirectImageUrl(url) {
    // Check for direct image extensions
    const isImageExtension = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
    // Also treat media.tenor.com MP4s as direct media (will render as video)
    const isMediaTenorVideo = url.includes('media.tenor.com') && (url.includes('.mp4') || url.includes('.gif'));
    
    return isImageExtension || isMediaTenorVideo;
  }

  isSocialMediaUrl(url) {
    const socialDomains = [
      'tenor.com',
      'media.tenor.com',
      'giphy.com',
      'youtube.com',
      'youtu.be',
      'twitter.com',
      'x.com',
      'instagram.com',
      'tiktok.com',
      'imgur.com',
      'reddit.com',
      'twitch.tv',
      'facebook.com',
      'linkedin.com'
    ];
    
    return socialDomains.some(domain => url.includes(domain));
  }

  extractRichMessageContent(messageBox) {
    // Extract message content preserving emojis and other rich elements
    try {
      let content = '';
      
      // Walk through all child nodes and extract text/emojis
      const walker = document.createTreeWalker(
        messageBox,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            // Accept text nodes and emoji elements
            if (node.nodeType === Node.TEXT_NODE) {
              return NodeFilter.FILTER_ACCEPT;
            }
            
            // Accept emoji images and Discord emoji elements
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === 'IMG' && (
                node.classList.contains('emoji') || 
                node.src?.includes('discord.com/assets') ||
                node.src?.includes('cdn.discordapp.com')
              )) {
                return NodeFilter.FILTER_ACCEPT;
              }
              
              // Accept Discord's custom emoji spans
              if (node.tagName === 'SPAN' && (
                node.classList.contains('emoji') ||
                node.dataset?.emoji
              )) {
                return NodeFilter.FILTER_ACCEPT;
              }
            }
            
            return NodeFilter.FILTER_SKIP;
          }
        }
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE) {
          content += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Handle emoji elements
          if (node.tagName === 'IMG') {
            // Try to get emoji from alt text or data attributes
            const emoji = node.alt || node.dataset?.emoji || node.getAttribute('data-name');
            if (emoji) {
              // Convert :emoji_name: back to actual emoji if possible
              const actualEmoji = this.convertEmojiNameToUnicode(emoji);
              content += actualEmoji || emoji;
            } else {
              // Fallback to a generic emoji placeholder
              content += '😀';
            }
          } else if (node.tagName === 'SPAN') {
            // Handle Discord emoji spans
            const emoji = node.dataset?.emoji || node.textContent;
            content += emoji || '';
          }
        }
      }
      
      return content.trim();
      
    } catch (error) {
      //console.log('🎨 Failed to extract rich message content:', error);
      return '';
    }
  }

  convertEmojiNameToUnicode(emojiName) {
    // Comprehensive emoji mapping based on GitHub emoji cheat sheet
    const emojiMap = {
      // Smileys & Emotion
      'grinning': '😀', 'smiley': '😃', 'smile': '😄', 'grin': '😁', 'laughing': '😆', 'satisfied': '😆',
      'sweat_smile': '😅', 'rofl': '🤣', 'joy': '😂', 'slightly_smiling_face': '🙂', 'upside_down_face': '🙃',
      'melting_face': '🫠', 'wink': '😉', 'blush': '😊', 'innocent': '😇', 'smiling_face_with_3_hearts': '🥰',
      'heart_eyes': '😍', 'star_struck': '🤩', 'kissing_heart': '😘', 'kissing': '😗', 'relaxed': '☺️',
      'kissing_closed_eyes': '😚', 'kissing_smiling_eyes': '😙', 'smiling_face_with_tear': '🥲',
      'yum': '😋', 'stuck_out_tongue': '😛', 'stuck_out_tongue_winking_eye': '😜',
      'zany_face': '🤪', 'stuck_out_tongue_closed_eyes': '😝', 'money_mouth_face': '🤑',
      'hugs': '🤗', 'hand_over_mouth': '🤭', 'face_with_open_eyes_and_hand_over_mouth': '🫢',
      'face_with_peeking_eye': '🫣', 'shushing_face': '🤫', 'thinking': '🤔', 'saluting_face': '🫡',
      'zipper_mouth_face': '🤐', 'face_with_raised_eyebrow': '🤨', 'neutral_face': '😐',
      'expressionless': '😑', 'no_mouth': '😶', 'dotted_line_face': '🫥', 'face_in_clouds': '😶‍🌫️',
      'smirk': '😏', 'unamused': '😒', 'roll_eyes': '🙄', 'grimacing': '😬', 'face_exhaling': '😮‍💨',
      'lying_face': '🤥', 'relieved': '😌', 'pensive': '😔', 'sleepy': '😪', 'drooling_face': '🤤',
      'sleeping': '😴', 'mask': '😷', 'face_with_thermometer': '🤒', 'face_with_head_bandage': '🤕',
      'nauseated_face': '🤢', 'vomiting_face': '🤮', 'sneezing_face': '🤧', 'hot_face': '🥵',
      'cold_face': '🥶', 'woozy_face': '🥴', 'dizzy_face': '😵', 'face_with_spiral_eyes': '😵‍💫',
      'exploding_head': '🤯', 'cowboy_hat_face': '🤠', 'partying_face': '🥳', 'disguised_face': '🥸',
      'sunglasses': '😎', 'nerd_face': '🤓', 'face_with_monocle': '🧐', 'confused': '😕',
      'face_with_diagonal_mouth': '🫤', 'worried': '😟', 'slightly_frowning_face': '🙁',
      'frowning_face': '☹️', 'open_mouth': '😮', 'hushed': '😯', 'astonished': '😲', 'flushed': '😳',
      'pleading_face': '🥺', 'face_holding_back_tears': '🥹', 'frowning': '😦', 'anguished': '😧',
      'fearful': '😨', 'cold_sweat': '😰', 'disappointed_relieved': '😥', 'cry': '😢', 'sob': '😭',
      'scream': '😱', 'confounded': '😖', 'persevere': '😣', 'disappointed': '😞', 'sweat': '😓',
      'weary': '😩', 'tired_face': '😫', 'yawning_face': '🥱', 'triumph': '😤', 'rage': '😡',
      'angry': '😠', 'cursing_face': '🤬', 'smiling_imp': '😈', 'imp': '👿', 'skull': '💀',
      'skull_and_crossbones': '☠️', 'poop': '💩', 'clown_face': '🤡', 'japanese_ogre': '👹',
      'japanese_goblin': '👺', 'ghost': '👻', 'alien': '👽', 'space_invader': '👾', 'robot': '🤖',

      // People & Body
      'wave': '👋', 'raised_back_of_hand': '🤚', 'raised_hand_with_fingers_splayed': '🖐️',
      'hand': '✋', 'raised_hand': '✋', 'vulcan_salute': '🖖', 'rightwards_hand': '🫱',
      'leftwards_hand': '🫲', 'palm_down_hand': '🫳', 'palm_up_hand': '🫴', 'ok_hand': '👌',
      'pinched_fingers': '🤌', 'pinching_hand': '🤏', 'v': '✌️', 'crossed_fingers': '🤞',
      'hand_with_index_finger_and_thumb_crossed': '🫰', 'love_you_gesture': '🤟', 'metal': '🤘',
      'call_me_hand': '🤙', 'point_left': '👈', 'point_right': '👉', 'point_up_2': '👆',
      'middle_finger': '🖕', 'point_down': '👇', 'point_up': '☝️', 'index_pointing_at_the_viewer': '🫵',
      'thumbsup': '👍', '+1': '👍', 'thumbsdown': '👎', '-1': '👎', 'fist': '✊',
      'facepunch': '👊', 'punch': '👊', 'fist_oncoming': '👊', 'fist_left': '🤛', 'fist_right': '🤜',
      'clap': '👏', 'raised_hands': '🙌', 'heart_hands': '🫶', 'open_hands': '👐',
      'palms_up_together': '🤲', 'handshake': '🤝', 'pray': '🙏', 'writing_hand': '✍️',
      'nail_care': '💅', 'selfie': '🤳', 'muscle': '💪', 'mechanical_arm': '🦾', 'mechanical_leg': '🦿',
      'leg': '🦵', 'foot': '🦶', 'ear': '👂', 'ear_with_hearing_aid': '🦻', 'nose': '👃',
      'brain': '🧠', 'anatomical_heart': '🫀', 'lungs': '🫁', 'tooth': '🦷', 'bone': '🦴',
      'eyes': '👀', 'eye': '👁️', 'tongue': '👅', 'lips': '👄',

      // Animals & Nature
      'dog': '🐶', 'cat': '🐱', 'mouse': '🐭', 'hamster': '🐹', 'rabbit': '🐰', 'fox_face': '🦊',
      'bear': '🐻', 'panda_face': '🐼', 'polar_bear': '🐻‍❄️', 'koala': '🐨', 'tiger': '🐯',
      'lion': '🦁', 'cow': '🐮', 'pig': '🐷', 'pig_nose': '🐽', 'frog': '🐸', 'monkey_face': '🐵',
      'see_no_evil': '🙈', 'hear_no_evil': '🙉', 'speak_no_evil': '🙊', 'monkey': '🐒',
      'chicken': '🐔', 'penguin': '🐧', 'bird': '🐦', 'baby_chick': '🐤', 'hatching_chick': '🐣',
      'hatched_chick': '🐥', 'duck': '🦆', 'eagle': '🦅', 'owl': '🦉', 'bat': '🦇', 'wolf': '🐺',
      'boar': '🐗', 'horse': '🐴', 'unicorn': '🦄', 'bee': '🐝', 'honeybee': '🐝', 'bug': '🐛',
      'butterfly': '🦋', 'snail': '🐌', 'beetle': '🪲', 'ant': '🐜', 'mosquito': '🦟', 'fly': '🪰',
      'worm': '🪱', 'microbe': '🦠', 'snake': '🐍', 'lizard': '🦎', 'dragon': '🐉',
      'dragon_face': '🐲', 'fire': '🔥', 'zap': '⚡', 'boom': '💥', 'collision': '💥',

      // Food & Drink
      'apple': '🍎', 'green_apple': '🍏', 'pear': '🍐', 'tangerine': '🍊', 'orange': '🍊',
      'lemon': '🍋', 'banana': '🍌', 'watermelon': '🍉', 'grapes': '🍇', 'strawberry': '🍓',
      'melon': '🍈', 'cherries': '🍒', 'peach': '🍑', 'pineapple': '🍍', 'coconut': '🥥',
      'kiwi_fruit': '🥝', 'tomato': '🍅', 'eggplant': '🍆', 'avocado': '🥑', 'broccoli': '🥦',
      'pizza': '🍕', 'hamburger': '🍔', 'fries': '🍟', 'hotdog': '🌭', 'sandwich': '🥪',
      'taco': '🌮', 'burrito': '🌯', 'beer': '🍺', 'beers': '🍻', 'wine_glass': '🍷',
      'cocktail': '🍸', 'tropical_drink': '🍹', 'coffee': '☕', 'tea': '🍵',

      // Activities & Objects
      'soccer': '⚽', 'basketball': '🏀', 'football': '🏈', 'baseball': '⚾', 'tennis': '🎾',
      'volleyball': '🏐', 'rugby_football': '🏉', 'golf': '⛳', 'guitar': '🎸', 'violin': '🎻',
      'piano': '🎹', 'trumpet': '🎺', 'saxophone': '🎷', 'drum': '🥁', 'microphone': '🎤',
      'headphones': '🎧', 'radio': '📻', 'camera': '📷', 'video_camera': '📹', 'tv': '📺',
      'computer': '💻', 'keyboard': '⌨️', 'computer_mouse': '🖱️', 'trackball': '🖲️',
      'joystick': '🕹️', 'phone': '☎️', 'telephone': '☎️', 'iphone': '📱', 'calling': '📲',

      // Symbols
      'heart': '❤️', 'orange_heart': '🧡', 'yellow_heart': '💛', 'green_heart': '💚',
      'blue_heart': '💙', 'purple_heart': '💜', 'brown_heart': '🤎', 'black_heart': '🖤',
      'white_heart': '🤍', 'broken_heart': '💔', 'heart_exclamation': '❣️', 'two_hearts': '💕',
      'revolving_hearts': '💞', 'heartbeat': '💓', 'heartpulse': '💗', 'sparkling_heart': '💖',
      'cupid': '💘', 'gift_heart': '💝', 'kiss': '💋', 'ring': '💍', 'gem': '💎',
      'bouquet': '💐', 'cherry_blossom': '🌸', 'white_flower': '💮', 'rosette': '🏵️',
      'rose': '🌹', 'wilted_flower': '🥀', 'hibiscus': '🌺', 'sunflower': '🌻', 'blossom': '🌼',
      'tulip': '🌷', 'seedling': '🌱', 'evergreen_tree': '🌲', 'deciduous_tree': '🌳',
      'palm_tree': '🌴', 'cactus': '🌵', 'herb': '🌿', 'shamrock': '☘️', 'four_leaf_clover': '🍀',
      'bamboo': '🎍', 'tanabata_tree': '🎋', 'leaves': '🍃', 'fallen_leaf': '🍂',
      'maple_leaf': '🍁', 'mushroom': '🍄', 'ear_of_rice': '🌾', 'bouquet': '💐',

      // Numbers
      '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣', '5': '5️⃣',
      '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣', '10': '🔟', '100': '💯',

      // Common shortcuts
      'cool': '😎', 'money_mouth': '🤑', 'facepalm': '🤦', 'shrug': '🤷'
    };
    
    // Remove colons if present
    const cleanName = emojiName.replace(/:/g, '');
    return emojiMap[cleanName] || null;
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
    // console.log('🔐 [ASYMMETRIC] Initializing asymmetric encryption system...');
    
    const maxRetries = 10;
    let retryCount = 0;
    
    const attemptInit = async () => {
      try {
        retryCount++;
        // console.log(`🔐 [ASYMMETRIC] Attempt ${retryCount}/${maxRetries}...`);
        
        // Check if all required classes are available
        if (typeof AsymmetricContentIntegration === 'undefined') {
          // console.log('🔐 [ASYMMETRIC] ❌ AsymmetricContentIntegration class not found');
          if (retryCount < maxRetries) {
            setTimeout(attemptInit, 500);
            return;
          } else {
            // console.log('🔐 [ASYMMETRIC] ❌ Max retries reached - AsymmetricContentIntegration not available');
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
        // console.log('🔐 [ASYMMETRIC] 🚀 Creating AsymmetricContentIntegration...');
        this.asymmetric = new AsymmetricContentIntegration(this);
        
        // Wait for initialization
        // console.log('🔐 [ASYMMETRIC] ⏳ Initializing...');
        const success = await this.asymmetric.initialize();
        
        if (success && this.asymmetric.isInitialized) {
          // Bind methods to this context
          this.processAsymmetricMessage = this.asymmetric.processIncomingMessage.bind(this.asymmetric);
          this.encryptAsymmetricMessage = this.asymmetric.encryptOutgoingMessage.bind(this.asymmetric);
          
          // console.log('🔐 [ASYMMETRIC] ✅ Asymmetric encryption fully initialized!');
          // console.log('🔐 [ASYMMETRIC] processAsymmetricMessage available:', typeof this.processAsymmetricMessage);
          // console.log('🔐 [ASYMMETRIC] encryptAsymmetricMessage available:', typeof this.encryptAsymmetricMessage);
          
          // Show success notification
          Logger.showPageNotification('🔐 Asymmetric encryption ready!', 'success');
          
        } else {
          console.log('🔐 [ASYMMETRIC] ❌ Initialization failed - success:', success, 'initialized:', this.asymmetric?.isInitialized);
          if (retryCount < maxRetries) {
            setTimeout(attemptInit, 1000);
          }
        }
      } catch (error) {
        //console.log('🔐 [ASYMMETRIC] ❌ Initialization error:', error);
        if (retryCount < maxRetries) {
          setTimeout(attemptInit, 1000);
        }
      }
    };
    
    // Start the initialization process
    setTimeout(attemptInit, 500);
  }

  debugAsymmetricStatus() {
    // console.log('🔐 [DEBUG] === ASYMMETRIC STATUS DEBUG ===');
    // console.log('🔐 [DEBUG] Settings - Asymmetric enabled:', this.asymmetricEnabled);
    // console.log('🔐 [DEBUG] Has asymmetric object:', !!this.asymmetric);
    // console.log('🔐 [DEBUG] Extension version:', this.version);
    // console.log('🔐 [DEBUG] Has initAsymmetricEncryption method:', typeof this.initAsymmetricEncryption);
    
    if (this.asymmetric) {
      // console.log('🔐 [DEBUG] Asymmetric initialized:', this.asymmetric.isInitialized);
      // console.log('🔐 [DEBUG] Has processAsymmetricMessage:', typeof this.processAsymmetricMessage);
      // console.log('🔐 [DEBUG] Has encryptAsymmetricMessage:', typeof this.encryptAsymmetricMessage);
      
      if (this.asymmetric.isInitialized) {
        const status = this.asymmetric.getAsymmetricStatus();
        // console.log('🔐 [DEBUG] Asymmetric status:', status);
        
        // Try to get contact list
        try {
          const contacts = this.asymmetric.getContactList();
          // console.log('🔐 [DEBUG] Contact count:', contacts.length);
          if (contacts.length > 0) {
            // console.log('🔐 [DEBUG] First contact:', contacts[0]);
          }
        } catch (error) {
           // console.log('🔐 [DEBUG] Error getting contacts:', error);
        }
      }
    } else {
      // console.log('🔐 [DEBUG] Asymmetric object not created - trying to reinitialize...');
      
      // Try to force reinitialize if methods are available but object isn't created
      if (typeof this.initAsymmetricEncryption === 'function') {
        // console.log('🔐 [DEBUG] Retrying initAsymmetricEncryption...');
        try {
          this.initAsymmetricEncryption();
          
          // Check again after a delay
          setTimeout(() => {
            // console.log('🔐 [DEBUG] After retry - Has asymmetric object:', !!this.asymmetric);
            // console.log('🔐 [DEBUG] After retry - Has processAsymmetricMessage:', typeof this.processAsymmetricMessage);
            // console.log('🔐 [DEBUG] After retry - Has encryptAsymmetricMessage:', typeof this.encryptAsymmetricMessage);
          }, 1000);
        } catch (error) {
          // console.log('🔐 [DEBUG] Retry failed:', error);
        }
      }
    }
    
    // Check if global objects exist
    // console.log('🔐 [DEBUG] Global ecCrypto exists:', typeof window.ecCrypto);
    // console.log('🔐 [DEBUG] Global ecMessageProcessor exists:', typeof window.ecMessageProcessor);
    // console.log('🔐 [DEBUG] Global ECMessageProcessor exists:', typeof ECMessageProcessor);
    // console.log('🔐 [DEBUG] Global AsymmetricContentIntegration exists:', typeof AsymmetricContentIntegration);
    
    // console.log('🔐 [DEBUG] ================================');
  }

  // Manual test method - call from console: discordCryptochat.testAsymmetricEncryption()
  async testAsymmetricEncryption() {
    // console.log('🔐 [TEST] Testing asymmetric encryption...');
    
    if (!this.asymmetric || !this.asymmetric.isInitialized) {
      // console.log('🔐 [TEST] Asymmetric not initialized - calling init...');
      this.initAsymmetricEncryption();
      
      // Wait a moment for init
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    this.debugAsymmetricStatus();
    
    // Test encryption
    if (this.encryptAsymmetricMessage) {
      try {
        const testMessage = "Hello asymmetric world!";
        // console.log('🔐 [TEST] Encrypting test message:', testMessage);
        const result = await this.encryptAsymmetricMessage(testMessage);
        // console.log('🔐 [TEST] Encryption result:', result);
      } catch (error) {
        // console.log('🔐 [TEST] Encryption failed:', error);
      }
    }
  }

  // Stealth encoding methods
  async encodeStealthMessage(base64Data) {
    // Convert base64 to selected stealth language to make it look natural
    const stealthText = await this.base64ToStealthText(base64Data);
    // Add spaces for natural appearance
    return this.addSpacesToText(stealthText);
  }

  async decodeStealthMessage(stealthText) {
    // Remove spaces first, then convert stealth text back to base64
    const cleanText = this.removeSpacesFromText(stealthText);
    return await this.stealthTextToBase64(cleanText);
  }

  addSpacesToText(text) {
    // Add spaces every 4-6 characters with some randomness for natural look
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += text[i];
      // Add space every 4-6 characters (varying for natural appearance)
      const spaceInterval = 4 + (i % 3); // Creates pattern of 4,5,6,4,5,6...
      if ((i + 1) % spaceInterval === 0 && i < text.length - 1) {
        result += ' ';
      }
    }
    return result;
  }

  removeSpacesFromText(text) {
    // Simply remove all spaces
    return text.replace(/\s+/g, '');
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

  // ==================== MULTI-LANGUAGE STEALTH ENCODING ====================

  async getStealthLanguage() {
    try {
      const result = await chrome.storage.local.get(['stealthLanguage']);
      return result.stealthLanguage || 'chinese';
    } catch (error) {
      return 'chinese';
    }
  }

  getLanguageConfig(language) {
    const configs = {
      chinese: {
        name: '🇨🇳 Chinese',
        baseCharCode: 0x4E00,
        range: 94,
        detector: (char) => char >= 0x4E00 && char <= 0x7000
      },
      arabic: {
        name: '🇸🇦 Arabic',
        baseCharCode: 0x0600,
        range: 94,
        detector: (char) => char >= 0x0600 && char <= 0x06FF
      },
      japanese: {
        name: '🇯🇵 Japanese',
        baseCharCode: 0x3040,
        range: 94,
        detector: (char) => char >= 0x3040 && char <= 0x309F
      },
      korean: {
        name: '🇰🇷 Korean',
        baseCharCode: 0xAC00,
        range: 94,
        detector: (char) => char >= 0xAC00 && char <= 0xD7AF
      },
      russian: {
        name: '🇷🇺 Russian',
        baseCharCode: 0x0400,
        range: 94,
        detector: (char) => char >= 0x0400 && char <= 0x04FF
      },
      thai: {
        name: '🇹🇭 Thai',
        baseCharCode: 0x0E00,
        range: 94,
        detector: (char) => char >= 0x0E00 && char <= 0x0E7F
      },
     
      hindi: {
        name: '🇮🇳 Hindi',
        baseCharCode: 0x0900,
        range: 94,
        detector: (char) => char >= 0x0900 && char <= 0x097F
      },
      greek: {
        name: '🇬🇷 Greek',
        baseCharCode: 0x0370,
        range: 94,
        detector: (char) => char >= 0x0370 && char <= 0x03FF
      },
      georgian: {
        name: '🇬🇪 Georgian',
        baseCharCode: 0x10A0,
        range: 94,
        detector: (char) => char >= 0x10A0 && char <= 0x10FF
      },
      armenian: {
        name: '🇦🇲 Armenian',
        baseCharCode: 0x0530,
        range: 94,
        detector: (char) => char >= 0x0530 && char <= 0x058F
      },
      amharic: {
        name: '🇪🇹 Amharic',
        baseCharCode: 0x1200,
        range: 94,
        detector: (char) => char >= 0x1200 && char <= 0x137F
      }
    };
    
    return configs[language] || configs.chinese;
  }

  getSpecialEncodingConfig(encoding) {
    const configs = {
      morse: {
        name: '📡 Morse Code',
        encoder: this.encodeToMorse.bind(this),
        decoder: this.decodeFromMorse.bind(this),
        detector: (text) => /^[.\-\s]+$/.test(text.trim()) && text.length > 10
      },
      braille: {
        name: '👆 Braille',
        encoder: this.encodeToBraille.bind(this),
        decoder: this.decodeFromBraille.bind(this),
        detector: (text) => /^[⠀-⣿\s]+$/.test(text.trim()) && text.length > 5
      },
      binary: {
        name: '💻 Binary',
        encoder: this.encodeToBinary.bind(this),
        decoder: this.decodeFromBinary.bind(this),
        detector: (text) => /^[01\s]+$/.test(text.trim()) && text.length > 20
      },
      invisible: {
        name: '👻 Invisible',
        encoder: this.encodeToInvisible.bind(this),
        decoder: this.decodeFromInvisible.bind(this),
        detector: (text) => /^[\u200B\u200C\u200D\u2060\uFEFF\s]+$/.test(text)
      }
    };
    
    return configs[encoding];
  }

  async base64ToStealthText(base64) {
    const language = await this.getStealthLanguage();
    
    // Check for special encodings first
    const specialConfig = this.getSpecialEncodingConfig(language);
    if (specialConfig) {
      return specialConfig.encoder(base64);
    }
    
    // Regular unicode language encoding
    const config = this.getLanguageConfig(language);
    let result = '';
    
    for (let i = 0; i < base64.length; i++) {
      const charCode = base64.charCodeAt(i);
      const stealthCharCode = config.baseCharCode + (charCode - 32);
      result += String.fromCharCode(stealthCharCode);
    }
    
    return result;
  }

  async stealthTextToBase64(stealthText) {
    // Try to detect the encoding type
    const cleanText = stealthText.replace(/\s+/g, '');
    
    // Check special encodings
    const specialEncodings = ['morse', 'braille', 'binary', 'invisible'];
    for (const encoding of specialEncodings) {
      const config = this.getSpecialEncodingConfig(encoding);
      if (config && config.detector(stealthText)) {
        return config.decoder(stealthText);
      }
    }
    
    // Try regular unicode languages
    const languages = ['chinese', 'arabic', 'japanese', 'korean', 'russian', 'thai', 'hindi', 'greek', 'georgian', 'armenian', 'amharic'];
    
    for (const language of languages) {
      const config = this.getLanguageConfig(language);
      let matches = 0;
      
      for (let i = 0; i < Math.min(cleanText.length, 20); i++) {
        const charCode = cleanText.charCodeAt(i);
        if (config.detector(charCode)) {
          matches++;
        }
      }
      
      if (matches / Math.min(cleanText.length, 20) > 0.7) {
        // This looks like this language, decode it
        return this.decodeUnicodeLanguage(cleanText, config);
      }
    }
    
    // Fallback to Chinese if nothing matches
    return this.decodeUnicodeLanguage(cleanText, this.getLanguageConfig('chinese'));
  }

  decodeUnicodeLanguage(text, config) {
    let result = '';
    
    for (let i = 0; i < text.length; i++) {
      const stealthCharCode = text.charCodeAt(i);
      
      if (stealthCharCode < config.baseCharCode || stealthCharCode > config.baseCharCode + config.range) {
        result += '?';
        continue;
      }
      
      const originalCharCode = (stealthCharCode - config.baseCharCode) + 32;
      
      if (originalCharCode < 32 || originalCharCode > 126) {
        result += '?';
        continue;
      }
      
      result += String.fromCharCode(originalCharCode);
    }
    
    return result;
  }

  // MORSE CODE ENCODING
  encodeToMorse(base64) {
    const morseTable = {
      'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
      'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
      'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
      'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
      'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
      '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
      '8': '---..', '9': '----.', '+': '.-.-.', '/': '-..-.', '=': '-...-'
    };
    
    let result = '';
    for (let i = 0; i < base64.length; i++) {
      const char = base64[i].toUpperCase();
      if (morseTable[char]) {
        result += morseTable[char] + ' ';
      } else {
        // For unknown chars, use a pattern based on char code
        const code = base64.charCodeAt(i);
        result += '.'.repeat(code % 4 + 1) + '-'.repeat(code % 3 + 1) + ' ';
      }
    }
    
    return result.trim();
  }

  decodeFromMorse(morse) {
    const morseToChar = {
      '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
      '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
      '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
      '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
      '-.--': 'Y', '--..': 'Z', '-----': '0', '.----': '1', '..---': '2',
      '...--': '3', '....-': '4', '.....': '5', '-....': '6', '--...': '7',
      '---..': '8', '----.': '9', '.-.-.': '+', '-..-.': '/', '-...-': '='
    };
    
    const codes = morse.trim().split(/\s+/);
    let result = '';
    
    for (const code of codes) {
      if (morseToChar[code]) {
        result += morseToChar[code];
      } else {
        // Try to reverse engineer unknown patterns
        const dotCount = (code.match(/\./g) || []).length;
        const dashCount = (code.match(/-/g) || []).length;
        const charCode = 32 + ((dotCount * 16 + dashCount * 8) % 95);
        result += String.fromCharCode(charCode);
      }
    }
    
    return result;
  }

  // BRAILLE ENCODING
  encodeToBraille(base64) {
    // Braille patterns start at U+2800
    let result = '';
    
    for (let i = 0; i < base64.length; i++) {
      const charCode = base64.charCodeAt(i);
      // Map ASCII to braille patterns
      const brailleCode = 0x2800 + (charCode - 32);
      result += String.fromCharCode(brailleCode);
    }
    
    return result;
  }

  decodeFromBraille(braille) {
    let result = '';
    
    for (let i = 0; i < braille.length; i++) {
      const brailleCode = braille.charCodeAt(i);
      
      if (brailleCode >= 0x2800 && brailleCode <= 0x28FF) {
        const originalCode = (brailleCode - 0x2800) + 32;
        if (originalCode >= 32 && originalCode <= 126) {
          result += String.fromCharCode(originalCode);
        }
      }
    }
    
    return result;
  }

  // BINARY ENCODING
  encodeToBinary(base64) {
    let result = '';
    
    for (let i = 0; i < base64.length; i++) {
      const charCode = base64.charCodeAt(i);
      const binary = charCode.toString(2).padStart(8, '0');
      result += binary + ' ';
    }
    
    return result.trim();
  }

  decodeFromBinary(binary) {
    const binaryGroups = binary.trim().split(/\s+/);
    let result = '';
    
    for (const group of binaryGroups) {
      if (/^[01]+$/.test(group)) {
        const charCode = parseInt(group, 2);
        if (charCode >= 32 && charCode <= 126) {
          result += String.fromCharCode(charCode);
        }
      }
    }
    
    return result;
  }

  // INVISIBLE ENCODING (Zero-width characters)
  encodeToInvisible(base64) {
    const invisibleChars = ['\u200B', '\u200C', '\u200D', '\u2060'];
    let result = '';
    
    for (let i = 0; i < base64.length; i++) {
      const charCode = base64.charCodeAt(i);
      
      // Convert to base-4 using invisible characters
      let temp = charCode;
      let encoded = '';
      for (let j = 0; j < 4; j++) {
        encoded = invisibleChars[temp % 4] + encoded;
        temp = Math.floor(temp / 4);
      }
      result += encoded;
    }
    
    return result;
  }

  decodeFromInvisible(invisible) {
    const invisibleChars = ['\u200B', '\u200C', '\u200D', '\u2060'];
    let result = '';
    
    // Process in groups of 4 invisible characters
    for (let i = 0; i < invisible.length; i += 4) {
      let charCode = 0;
      
      for (let j = 0; j < 4 && i + j < invisible.length; j++) {
        const char = invisible[i + j];
        const index = invisibleChars.indexOf(char);
        if (index !== -1) {
          charCode = charCode * 4 + index;
        }
      }
      
      if (charCode >= 32 && charCode <= 126) {
        result += String.fromCharCode(charCode);
      }
    }
    
    return result;
  }

  // Legacy functions for compatibility
  base64ToChinese(base64) {
    return this.base64ToStealthText(base64);
  }

  chineseToBase64(chineseText) {
    return this.stealthTextToBase64(chineseText);
  }

  isAlreadyEncrypted(text) {
    // Check if text looks like our encoded content
    if (!text || text.length === 0) return false;
    
    const textWithoutSpaces = text.replace(/\s+/g, '');
    if (textWithoutSpaces.length < 5) return false;
    
    // Check for special encodings first
    if (/^[.\-\s]+$/.test(text.trim()) && text.length > 10) {
      return true; // Morse code
    }
    
    if (/^[⠀-⣿\s]+$/.test(text.trim()) && text.length > 5) {
      return true; // Braille
    }
    
    if (/^[01\s]+$/.test(text.trim()) && text.length > 20) {
      return true; // Binary
    }
    
    if (/^[\u200B\u200C\u200D\u2060\uFEFF\s]+$/.test(text)) {
      return true; // Invisible characters
    }
    
    // Check for various unicode language ranges
    const languageRanges = [
      { min: 0x4E00, max: 0x7000 }, // Chinese
      { min: 0x0600, max: 0x06FF }, // Arabic
      { min: 0x3040, max: 0x309F }, // Japanese Hiragana
      { min: 0xAC00, max: 0xD7AF }, // Korean
      { min: 0x0400, max: 0x04FF }, // Russian/Cyrillic
      { min: 0x0E00, max: 0x0E7F }, // Thai
      { min: 0x0900, max: 0x097F }, // Hindi/Devanagari
      { min: 0x0370, max: 0x03FF }, // Greek
      { min: 0x10A0, max: 0x10FF }, // Georgian
      { min: 0x0530, max: 0x058F }, // Armenian
      { min: 0x1200, max: 0x137F }, // Amharic/Ethiopic
      { min: 0x2800, max: 0x28FF }  // Braille patterns
    ];
    
    for (const range of languageRanges) {
      let count = 0;
      for (let i = 0; i < textWithoutSpaces.length; i++) {
        const charCode = textWithoutSpaces.charCodeAt(i);
        if (charCode >= range.min && charCode <= range.max) {
          count++;
        }
      }
      
      const ratio = count / textWithoutSpaces.length;
      if (ratio > 0.7) {
        return true;
      }
    }
    
    return false;
  }

  // ========== NEW HANDLER METHODS FOR OPTIONS PAGE ==========

  async handleGetCurrentKeyInfo(sendResponse) {
    try {
      // console.log('🔐 [HANDLER] Getting current key info...');
      
      if (!window.ecCrypto) {
        // console.log('🔐 [HANDLER] ❌ EC crypto not available');
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
      //  console.log('🔐 [HANDLER] ⚠️ Could not get storage info:', storageError);
      }
      
    //  console.log('🔐 [HANDLER] ✅ Key info retrieved:', {
      //   keyId: keyInfo.keyId,
      //   publicKeyLength: keyInfo.publicKey ? keyInfo.publicKey.length : 0,
      //   created: keyInfo.created ? new Date(keyInfo.created).toLocaleString() : 'Unknown',
      //   nextRotation: keyInfo.nextRotation ? new Date(keyInfo.nextRotation).toLocaleString() : 'N/A'
      // });
      
      sendResponse({
        success: true,
        keyInfo: keyInfo
      });
    } catch (error) {
      //console.log('🔐 [HANDLER] ❌ Failed to get current key info:', error);
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
      //console.log('Failed to get contact list:', error);
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
      //console.log('Failed to clear contacts:', error);
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
          const finalMessage = await this.encodeStealthMessage(encryptedMessage);
          
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
      //console.log('Failed to test encryption:', error);
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
          const encryptedPayload = await this.decodeStealthMessage(encryptedText);
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
      //console.log('Failed to test decryption:', error);
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
      //console.log('Failed to update EC rotation interval:', error);
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
      //console.log('Failed to rotate keys:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleRotateECKeys(source, sendResponse) {
    try {
      // console.log(`🔐 [CONTENT] 🔑 EC key rotation triggered by: ${source}`);
      
      if (!window.ecCrypto) {
        // console.log('🔐 [CONTENT] 🔑 EC crypto not available');
        sendResponse({ success: false, error: 'EC crypto not available' });
        return;
      }

      // Perform the rotation
      await window.ecCrypto.rotateKeysNow();
      
      // console.log('🔐 [CONTENT] 🔑 ✅ EC key rotation completed successfully');
      sendResponse({ success: true, source: source });
      
    } catch (error) {
      // //console.log('🔐 [CONTENT] 🔑 ❌ Failed to rotate EC keys:', error);
      sendResponse({ success: false, error: error.message, source: source });
    }
  }

  detectDiscordUserFromDOM() {
    try {
      // Look for the user area section - the structure you provided
      const userSection = document.querySelector('section[aria-label="User area"]');
      if (!userSection) {
        throw new Error('User area section not found');
      }

      // Extract user ID from avatar src
      const avatarImg = userSection.querySelector('img.avatar__44b0c');
      let userId = null;
      let username = 'Unknown';

      if (avatarImg && avatarImg.src) {
        // Extract user ID from Discord avatar URL
        // Format: https://cdn.discordapp.com/avatars/USER_ID/HASH.webp?size=48
        const match = avatarImg.src.match(/\/avatars\/(\d+)\//);
        if (match) {
          userId = match[1];
        }
      }

      // Extract username from the title section
      const titleElement = userSection.querySelector('.title_b6c092, .panelTitleContainer__37e49 .title_b6c092');
      if (titleElement) {
        username = titleElement.textContent.trim();
      }

      // Fallback: look for display name in the hovered section
      if (username === 'Unknown') {
        const hoveredElement = userSection.querySelector('.hovered__0263c');
        if (hoveredElement) {
          const displayName = hoveredElement.textContent.trim();
          if (displayName && displayName !== 'Idle' && displayName !== 'Online' && displayName !== 'Do Not Disturb' && displayName !== 'Invisible') {
            username = displayName;
          }
        }
      }

      // Alternative method: look for user info in different selectors
      if (!userId) {
        // Try alternative avatar selectors
        const altAvatar = document.querySelector('[role="img"][aria-label*=","] img[src*="/avatars/"]');
        if (altAvatar && altAvatar.src) {
          const match = altAvatar.src.match(/\/avatars\/(\d+)\//);
          if (match) {
            userId = match[1];
          }
        }
      }

      // Try another approach for username if still unknown
      if (username === 'Unknown') {
        const nameTag = userSection.querySelector('.nameTag__37e49, [class*="nameTag"]');
        if (nameTag) {
          const textContent = nameTag.textContent.trim();
          const lines = textContent.split('\n').filter(line => line.trim());
          if (lines.length > 0) {
            username = lines[0].trim();
          }
        }
      }

      if (!userId) {
        throw new Error('Could not find user ID in Discord DOM. Make sure you are logged in to Discord.');
      }

      return {
        userId: userId,
        username: username,
        success: true
      };

    } catch (error) {
      throw new Error(`Auto-detection failed: ${error.message}. Please ensure Discord is fully loaded and you are logged in.`);
    }
  }
}

// Initialize when the script loads
const discordCryptochat = new DiscordCryptochat();

// Global function for manual asymmetric initialization (for debugging)
window.forceAsymmetricInit = function() {
  // console.log('🔐 [MANUAL] Forcing asymmetric initialization...');
  // console.log('🔐 [MANUAL] DiscordCryptochat available:', typeof DiscordCryptochat);
  // console.log('🔐 [MANUAL] AsymmetricContentIntegration available:', typeof AsymmetricContentIntegration);
  // console.log('🔐 [MANUAL] ecCrypto available:', typeof ecCrypto);
  // console.log('🔐 [MANUAL] ecMessageProcessor available:', typeof ecMessageProcessor);
  
  if (discordCryptochat && typeof discordCryptochat.initAsymmetricEncryption === 'function') {
    discordCryptochat.initAsymmetricEncryption();
    // console.log('🔐 [MANUAL] Called initAsymmetricEncryption');
    
    setTimeout(() => {
      // console.log('🔐 [MANUAL] Results after 2s:');
      // console.log('🔐 [MANUAL] Has asymmetric object:', !!discordCryptochat.asymmetric);
      // console.log('🔐 [MANUAL] Has processAsymmetricMessage:', typeof discordCryptochat.processAsymmetricMessage);
      // console.log('🔐 [MANUAL] Has encryptAsymmetricMessage:', typeof discordCryptochat.encryptAsymmetricMessage);
    }, 2000);
  } else {
    // console.log('🔐 [MANUAL] ❌ initAsymmetricEncryption not available');
  }
};

// Global debug function to check key status after rotation
window.debugKeyStatus = function() {
  // console.log('🔐 [DEBUG] === KEY STATUS DEBUG ===');
  
  if (window.ecCrypto) {
    const myUser = window.ecCrypto.getCurrentUser();
    // console.log('🔐 [DEBUG] My User Info:', myUser);
    
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
      // console.log('🔐 [DEBUG] Stored Key Info:');
      // console.log('🔐 [DEBUG]   Key ID:', stored.ecMyKeyId);
      // console.log('🔐 [DEBUG]   Generated:', stored.ecKeyGenerated ? new Date(stored.ecKeyGenerated).toLocaleString() : 'Unknown');
      // console.log('🔐 [DEBUG]   Last Rotation:', stored.ecLastRotation ? new Date(stored.ecLastRotation).toLocaleString() : 'Never');
      // console.log('🔐 [DEBUG]   Rotation Count:', stored.ecRotationCount || 0);
      // console.log('🔐 [DEBUG]   Entropy Sample:', stored.ecKeyEntropy ? stored.ecKeyEntropy.substring(0, 50) + '...' : 'None');
      
      if (stored.ecStaticPublicKey) {
        // console.log('🔐 [DEBUG]   Public Key Sample:', stored.ecStaticPublicKey.substring(0, 50) + '...');
      }
    });
    
    const contacts = Array.from(window.ecCrypto.userKeys.entries());
    // console.log('🔐 [DEBUG] Contact Count:', contacts.length);
    
    contacts.forEach(([userId, userInfo]) => {
      // console.log(`🔐 [DEBUG] Contact: ${userInfo.username} (${userId})`);
      // console.log(`🔐 [DEBUG]   Key ID: ${userInfo.keyId}`);
      // console.log(`🔐 [DEBUG]   Last Seen: ${new Date(userInfo.lastSeen).toLocaleTimeString()}`);
      if (userInfo.rotatedAt) {
        // console.log(`🔐 [DEBUG]   Rotated: ${new Date(userInfo.rotatedAt).toLocaleTimeString()}`);
        // console.log(`🔐 [DEBUG]   Previous Key: ${userInfo.previousKeyId}`);
      }
    });
  } else {
    // console.log('🔐 [DEBUG] ECCrypto not available');
  }
  
  // console.log('🔐 [DEBUG] ========================');
};

// Force regenerate unique keys
window.forceUniqueKeys = async function() {
  console.log('🔐 [FORCE] === FORCING UNIQUE KEY GENERATION ===');
  
  if (!window.ecCrypto) {
    console.log('🔐 [FORCE] ECCrypto not available');
    return;
  }
  
  try {
    // NUCLEAR MEMORY WIPE - Complete secure destruction
    await window.ecCrypto.nuclearMemoryWipe();
    
    // Secure storage deletion
    await window.ecCrypto.secureStorageDelete([
      'ecStaticPrivateKey', 
      'ecStaticPublicKey', 
      'ecMyKeyId',
      'ecKeyGenerated',
      'ecKeyEntropy',
      'ecEntropyComponents'
    ]);
    
    console.log('🔐 [FORCE] ✅ NUCLEAR WIPE COMPLETED');
    
    // Force regeneration with unique timestamp and extra entropy
    const uniqueTimestamp = Date.now();
    const extraEntropy = crypto.getRandomValues(new Uint8Array(64));
    const userAgent = navigator.userAgent;
    const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
    
    // console.log('🔐 [FORCE] Unique Timestamp:', uniqueTimestamp);
    // console.log('🔐 [FORCE] Extra Entropy:', Array.from(extraEntropy.slice(0, 8)).join(','), '...');
    // console.log('🔐 [FORCE] Screen Info:', screenInfo);
    
    // Wait a moment to ensure timestamp differences
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Generate completely new keypair
    await window.ecCrypto.generateStaticKeypair();
    
    // console.log('🔐 [FORCE] New keypair generated!');
    // console.log('🔐 [FORCE] New Key ID:', window.ecCrypto.myKeyId);
    
    // Reload to ensure consistency
    await window.ecCrypto.loadOrGenerateStaticKeypair();
    
    // console.log('🔐 [FORCE] Reloaded and verified');
    // console.log('🔐 [FORCE] Final Key ID:', window.ecCrypto.myKeyId);
    
  } catch (error) {
    //console.log('🔐 [FORCE] Error during force regeneration:', error);
  }
  
  // console.log('🔐 [FORCE] =======================================');
};

// Quick fix after key rotation
window.fixAfterRotation = async function() {
  // console.log('🔐 [FIX] === FIXING COMMUNICATION AFTER ROTATION ===');
  
  if (!window.ecCrypto) {
    // console.log('🔐 [FIX] ECCrypto not available');
    return;
  }
  
  try {
    // Clear all contacts first
    await window.ecCrypto.clearAllContacts();
    // console.log('🔐 [FIX] ✅ Cleared all contacts');
    
    // Force key reload
    await window.ecCrypto.loadOrGenerateStaticKeypair();
    // console.log('🔐 [FIX] ✅ Reloaded keys');
    
    // console.log('🔐 [FIX] ✅ Ready for new contact discovery');
    // console.log('🔐 [FIX] 💡 Send a test message to rediscover contacts');
    
  } catch (error) {
    //console.log('🔐 [FIX] Error during fix:', error);
  }
  
  // console.log('🔐 [FIX] ==============================');
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
    // console.log(`🔐 [CLEANUP] ✅ Cleaned up ${removedCount} corrupted contacts`);
    
    if (removedCount > 0) {
      // console.log('🔐 [CLEANUP] 💡 Corruption should be resolved now');
    } else {
      // console.log('🔐 [CLEANUP] 💡 No corrupted contacts found');
    }
    
  } catch (error) {
    //console.log('🔐 [CLEANUP] Error during cleanup:', error);
  }
  
  // console.log('🔐 [CLEANUP] ================================');
};

// NUCLEAR OPTION - Complete secure memory wipe (call this if compromised)
window.emergencyNuclearWipe = async function() {
  console.log('🔐 [NUCLEAR] 💥💥💥 EMERGENCY NUCLEAR MEMORY WIPE 💥💥💥');
  console.log('🔐 [NUCLEAR] ⚠️  THIS WILL DESTROY ALL KEYS AND DATA ⚠️');
  
  try {
    // Wipe EC crypto system
    if (window.ecCrypto) {
      await window.ecCrypto.nuclearMemoryWipe();
      console.log('🔐 [NUCLEAR] ✅ EC crypto system wiped');
    }
    
    // Wipe symmetric crypto system
    if (window.discordCrypto) {
      await window.discordCrypto.secureWipeAllSensitiveData();
      console.log('🔐 [NUCLEAR] ✅ Symmetric crypto system wiped');
    }
    
    // Wipe all extension storage with extreme prejudice
    const allKeys = [
      'encryptionKey',
      'keyRotationBaseKey',
      'keyRotationEnabled',
      'keyRotationIntervalMs',
      'keyRotationStartTimestamp',
      'lastRotationTimestamp',
      'rotationCount',
      'ecStaticPrivateKey',
      'ecStaticPublicKey',
      'ecMyKeyId',
      'ecKeyGenerated',
      'ecKeyEntropy',
      'ecEntropyComponents',
      'ecUserKeys',
      'ecCurrentUserId',
      'ecCurrentUsername',
      'ecRotationInterval',
      'ecRotationEpoch',
      'ecLastRotation',
      'ecRotationCount',
      'ecKeyCreated'
    ];
    
    // Multiple secure deletion rounds
    for (let round = 0; round < 3; round++) {
      console.log(`🔐 [NUCLEAR] 🗑️ Secure deletion round ${round + 1}/3`);
      
      // Overwrite with massive random data
      const overwriteData = {};
      for (const key of allKeys) {
        const randomSize = 4096 + Math.floor(Math.random() * 4096); // 4-8KB
        const randomBytes = crypto.getRandomValues(new Uint8Array(randomSize));
        const randomString = Array.from(randomBytes).map(b => 
          String.fromCharCode(b)).join('');
        overwriteData[key] = randomString;
      }
      
      await new Promise((resolve) => {
        chrome.storage.local.set(overwriteData, resolve);
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Final deletion
    await new Promise((resolve) => {
      chrome.storage.local.remove(allKeys, resolve);
    });
    
    // Force multiple garbage collection cycles
    for (let i = 0; i < 20; i++) {
      const memoryPressure = [];
      for (let j = 0; j < 5000; j++) {
        memoryPressure.push(new Array(1000).fill(Math.random()));
      }
      memoryPressure.length = 0;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log('🔐 [NUCLEAR] ✅ EMERGENCY NUCLEAR WIPE COMPLETED');
    console.log('🔐 [NUCLEAR] 💡 All cryptographic material has been destroyed');
    console.log('🔐 [NUCLEAR] 💡 Refresh the page to restart with new keys');
    
  } catch (error) {
    console.error('🔐 [NUCLEAR] ❌ Nuclear wipe failed:', error);
  }
};  