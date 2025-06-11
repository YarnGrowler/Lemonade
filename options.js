/**
 * Lemonade - Discord Encryption
 * Options Page Logic - Handles encryption key management and testing
 * 🍋 Sweet & Secure Discord Encryption
 */

class OptionsManager {
  constructor() {
    this.keyInput = document.getElementById('encryption-key');
    this.toggleButton = document.getElementById('toggle-password');
    this.saveButton = document.getElementById('save-button');
    this.testButton = document.getElementById('test-button');
    this.statusMessage = document.getElementById('status-message');
    this.keyForm = document.getElementById('key-form');
    this.keyInfo = document.getElementById('key-info');
    this.keyFingerprint = document.getElementById('key-fingerprint');
    
    // Key rotation elements
    this.enableRotationCheckbox = document.getElementById('enable-rotation');
    this.rotationSettings = document.getElementById('rotation-settings');
    this.baseKeyInput = document.getElementById('base-key');
    this.rotationIntervalSelect = document.getElementById('rotation-interval');
    this.customIntervalDiv = document.getElementById('custom-interval');
    this.customSecondsInput = document.getElementById('custom-seconds');
    this.setupRotationButton = document.getElementById('setup-rotation');
    this.rotationStatus = document.getElementById('rotation-status');

    // Sync elements
    this.generateSyncButton = document.getElementById('generate-sync');
    this.syncCodeOutput = document.getElementById('sync-code-output');
    this.copySyncButton = document.getElementById('copy-sync-code');
    this.syncCodeInput = document.getElementById('sync-code-input');
    this.applySyncButton = document.getElementById('apply-sync-code');
    this.syncStatus = document.getElementById('sync-status');

    // Speed settings elements
    this.scanFrequencySelect = document.getElementById('scan-frequency');
    this.initialDelaySelect = document.getElementById('initial-delay');
    this.saveSpeedButton = document.getElementById('save-speed-settings');
    this.speedStatus = document.getElementById('speed-status');

    // Language settings elements
    this.stealthLanguageSelect = document.getElementById('stealth-language');
    this.languagePreview = document.getElementById('language-preview');
    this.saveLanguageButton = document.getElementById('save-language-settings');
    this.languageStatus = document.getElementById('language-status');

    // Debug elements
    this.debugSyncButton = document.getElementById('debug-sync');
    this.debugOutput = document.getElementById('debug-output');

    // Asymmetric encryption elements
    this.enableAsymmetricCheckbox = document.getElementById('enable-asymmetric');
    this.asymmetricSettings = document.getElementById('asymmetric-settings');
    this.ecRotationIntervalSelect = document.getElementById('ec-rotation-interval');
    this.rotateKeysButton = document.getElementById('rotate-keys-now');
    this.viewContactsButton = document.getElementById('view-contacts');
    this.asymmetricStatus = document.getElementById('asymmetric-status');
    this.contactList = document.getElementById('contact-list');
    
    this.init();
  }

  async init() {
    await this.loadStoredKey();
    await this.loadKeyRotationSettings();
    await this.loadSpeedSettings();
    await this.loadLanguageSettings();
    await this.loadAsymmetricSettings();
    await this.updateCurrentUserDisplay(); // Load current user ID info
    this.setupEventListeners();
    
    // Always try to load key info if EC keys exist, regardless of enabled state
    setTimeout(async () => {
      const stored = await chrome.storage.local.get(['ecStaticPublicKey', 'ecMyKeyId']);
      if (stored.ecStaticPublicKey || stored.ecMyKeyId) {
        //console.log('EC keys detected, loading key information...');
        await this.updateCurrentKeyInfo();
        await this.refreshContactsList();
        
        // If keys exist but asymmetric mode isn't enabled, suggest enabling it
        const ecEnabled = await chrome.storage.local.get(['ecEnabled']);
        if (!ecEnabled.ecEnabled) {
          //console.log('EC keys exist but asymmetric mode is disabled');
        }
      }
      
      // Setup asymmetric button listeners in case they're visible
      this.setupAsymmetricButtonListeners();
    }, 500);
  }

  async loadStoredKey() {
    try {
      const result = await chrome.storage.local.get(['encryptionKey']);
      if (result.encryptionKey) {
        this.keyInput.value = result.encryptionKey;
        await this.updateKeyInfo(result.encryptionKey);
        this.showStatus('Encryption key loaded successfully', 'success');
      }
    } catch (error) {
      //console.log('Failed to load stored key:', error);
      this.showStatus('Failed to load stored key', 'error');
    }
  }

  setupEventListeners() {
    // Toggle password visibility
    this.toggleButton.addEventListener('click', () => {
      const isPassword = this.keyInput.type === 'password';
      this.keyInput.type = isPassword ? 'text' : 'password';
      this.toggleButton.textContent = isPassword ? '🙈' : '👁️';
    });

    // Form submission
    this.keyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveKey();
    });

    // Test encryption
    this.testButton.addEventListener('click', async () => {
      await this.testEncryption();
    });

    // Real-time key validation
    this.keyInput.addEventListener('input', () => {
      this.validateKey();
    });

    // Key rotation event listeners (safer checks)
    if (this.enableRotationCheckbox) {
      this.enableRotationCheckbox.addEventListener('change', () => {
        this.toggleRotationSettings();
      });
    }

    if (this.rotationIntervalSelect) {
      this.rotationIntervalSelect.addEventListener('change', () => {
        this.handleIntervalChange();
      });
    }

    if (this.setupRotationButton) {
      this.setupRotationButton.addEventListener('click', async () => {
        await this.setupKeyRotation();
      });
    }

    // Sync event listeners (safer checks)
    if (this.generateSyncButton) {
      this.generateSyncButton.addEventListener('click', async () => {
        await this.generateSyncCode();
      });
    }

    if (this.copySyncButton) {
      this.copySyncButton.addEventListener('click', async () => {
        await this.copySyncCode();
      });
    }

    if (this.applySyncButton) {
      this.applySyncButton.addEventListener('click', async () => {
        await this.applySyncCode();
      });
    }

    // Speed settings event listeners
    if (this.saveSpeedButton) {
      this.saveSpeedButton.addEventListener('click', async () => {
        await this.saveSpeedSettings();
      });
    }

    // Debug event listeners (safer check)
    if (this.debugSyncButton) {
      this.debugSyncButton.addEventListener('click', async () => {
        await this.debugSyncKeys();
      });
    }

    // Asymmetric encryption event listeners
    if (this.enableAsymmetricCheckbox) {
      this.enableAsymmetricCheckbox.addEventListener('change', () => {
        this.toggleAsymmetricSettings();
      });
    }

    if (this.ecRotationIntervalSelect) {
      this.ecRotationIntervalSelect.addEventListener('change', async () => {
        await this.updateAsymmetricRotationInterval();
      });
    }

    // Use safer event listener setup for buttons that might not exist initially
    if (this.rotateKeysButton) {
      this.rotateKeysButton.addEventListener('click', async () => {
        await this.rotateKeysManually();
      });
    }

    if (this.viewContactsButton) {
      this.viewContactsButton.addEventListener('click', async () => {
        await this.refreshContactsList();
      });
    }

    // New asymmetric features
    document.getElementById('export-public-key')?.addEventListener('click', async () => {
      await this.exportPublicKey();
    });

    document.getElementById('clear-all-contacts')?.addEventListener('click', async () => {
      await this.clearAllContacts();
    });

    document.getElementById('test-encrypt')?.addEventListener('click', async () => {
      await this.testAsymmetricEncryption();
    });

    document.getElementById('test-decrypt')?.addEventListener('click', async () => {
      await this.testAsymmetricDecryption();
    });

    // Debug button event listeners
    document.getElementById('debug-key-status')?.addEventListener('click', async () => {
      await this.debugKeyStatus();
    });

    document.getElementById('force-unique-keys')?.addEventListener('click', async () => {
      await this.forceUniqueKeys();
    });

    document.getElementById('fix-after-rotation')?.addEventListener('click', async () => {
      await this.fixAfterRotation();
    });

    document.getElementById('cleanup-temp-contacts')?.addEventListener('click', async () => {
      await this.cleanupTempContacts();
    });

    document.getElementById('reset-timer')?.addEventListener('click', async () => {
      await this.resetRotationTimer();
    });

    // User ID Management
    document.getElementById('set-user-id')?.addEventListener('click', async () => {
      await this.setUserIdManually();
    });

    document.getElementById('auto-detect-user-id')?.addEventListener('click', async () => {
      await this.autoDetectUserId();
    });

    // Language settings event listeners
    console.log('🎭 Setting up language event listeners...');
    console.log('🎭 saveLanguageButton found:', !!this.saveLanguageButton);
    console.log('🎭 stealthLanguageSelect found:', !!this.stealthLanguageSelect);
    
    if (this.saveLanguageButton) {
      this.saveLanguageButton.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('🎭 Save language button clicked!');
        try {
          await this.saveLanguageSettings();
        } catch (error) {
          console.error('🎭 Error saving language settings:', error);
          this.showLanguageStatus('Error saving language settings: ' + error.message, 'error');
        }
      });
      console.log('🎭 ✅ Save language button listener attached');
    } else {
      console.error('🎭 ❌ Save language button not found!');
    }

    if (this.stealthLanguageSelect) {
      this.stealthLanguageSelect.addEventListener('change', () => {
        console.log('🎭 Language selection changed');
        this.updateLanguagePreview();
      });
      console.log('🎭 ✅ Language select listener attached');
    } else {
      console.error('🎭 ❌ Language select not found!');
    }

    // Memory Security event listeners
    console.log('🛡️ Setting up memory security event listeners...');
    
    document.getElementById('refresh-memory-status')?.addEventListener('click', async () => {
      await this.refreshMemoryStatus();
    });

    document.getElementById('secure-wipe-asymmetric')?.addEventListener('click', async () => {
      await this.secureWipeAsymmetric();
    });

    document.getElementById('secure-wipe-symmetric')?.addEventListener('click', async () => {
      await this.secureWipeSymmetric();
    });

    document.getElementById('nuclear-wipe-everything')?.addEventListener('click', async () => {
      await this.nuclearWipeEverything();
    });
  }

  // Setup asymmetric button listeners after the section is shown
  setupAsymmetricButtonListeners() {
    console.log('🔧 Setting up asymmetric button listeners...');
    
    // Re-setup rotate keys button if it wasn't available during initial setup
    const rotateKeysBtn = document.getElementById('rotate-keys-now');
    if (rotateKeysBtn) {
      if (!rotateKeysBtn.hasAttribute('data-listener-attached')) {
        rotateKeysBtn.addEventListener('click', async () => {
          await this.rotateKeysManually();
        });
        rotateKeysBtn.setAttribute('data-listener-attached', 'true');
        console.log('🔧 ✅ Rotate Keys button listener attached');
      } else {
        console.log('🔧 ⚠️ Rotate Keys button already has listener');
      }
    } else {
      console.log('🔧 ❌ Rotate Keys button not found');
    }

    // Re-setup view contacts button if it wasn't available during initial setup
    const viewContactsBtn = document.getElementById('view-contacts');
    if (viewContactsBtn) {
      if (!viewContactsBtn.hasAttribute('data-listener-attached')) {
        viewContactsBtn.addEventListener('click', async () => {
          await this.refreshContactsList();
        });
        viewContactsBtn.setAttribute('data-listener-attached', 'true');
        console.log('🔧 ✅ View Contacts button listener attached');
      } else {
        console.log('🔧 ⚠️ View Contacts button already has listener');
      }
    } else {
      console.log('🔧 ❌ View Contacts button not found');
    }

    // Make sure export and clear buttons have listeners
    const exportBtn = document.getElementById('export-public-key');
    if (exportBtn) {
      if (!exportBtn.hasAttribute('data-listener-attached')) {
        exportBtn.addEventListener('click', async () => {
          await this.exportPublicKey();
        });
        exportBtn.setAttribute('data-listener-attached', 'true');
        console.log('🔧 ✅ Export Public Key button listener attached');
      } else {
        console.log('🔧 ⚠️ Export Public Key button already has listener');
      }
    } else {
      console.log('🔧 ❌ Export Public Key button not found');
    }

    const clearBtn = document.getElementById('clear-all-contacts');
    if (clearBtn) {
      if (!clearBtn.hasAttribute('data-listener-attached')) {
        clearBtn.addEventListener('click', async () => {
          await this.clearAllContacts();
        });
        clearBtn.setAttribute('data-listener-attached', 'true');
        console.log('🔧 ✅ Clear Contacts button listener attached');
      } else {
        console.log('🔧 ⚠️ Clear Contacts button already has listener');
      }
    } else {
      console.log('🔧 ❌ Clear Contacts button not found');
    }
    
    console.log('🔧 Button setup complete');
  }

  validateKey() {
    const key = this.keyInput.value.trim();
    
    if (!key) {
      this.saveButton.textContent = 'Save Encryption Key';
      this.saveButton.disabled = false;
      return;
    }

    if (key.length < 8) {
      this.saveButton.textContent = 'Key too short (min 8 chars)';
      this.saveButton.disabled = true;
      return;
    }

    this.saveButton.textContent = 'Save Encryption Key';
    this.saveButton.disabled = false;
  }

  async saveKey() {
    const key = this.keyInput.value.trim();
    
    if (!key) {
      this.showStatus('Please enter an encryption key', 'error');
      return;
    }

    if (key.length < 8) {
      this.showStatus('Encryption key must be at least 8 characters long', 'error');
      return;
    }

    try {
      this.saveButton.textContent = 'Saving...';
      this.saveButton.disabled = true;

      // Test the key first
      const testResult = await this.performEncryptionTest(key);
      if (!testResult.success) {
        throw new Error(testResult.error);
      }

      // Save the key
      await chrome.storage.local.set({ encryptionKey: key });
      
      // Update key info
      await this.updateKeyInfo(key);
      
      this.showStatus('✅ Encryption key saved successfully!', 'success');
      
    } catch (error) {
      //console.log('Failed to save key:', error);
      this.showStatus(`Failed to save key: ${error.message}`, 'error');
    } finally {
      this.saveButton.textContent = 'Save Encryption Key';
      this.saveButton.disabled = false;
    }
  }

  async testEncryption() {
    const key = this.keyInput.value.trim();
    
    if (!key) {
      this.showStatus('Please enter an encryption key to test', 'error');
      return;
    }

    try {
      this.testButton.textContent = 'Testing...';
      this.testButton.disabled = true;

      const result = await this.performEncryptionTest(key);
      
      if (result.success) {
        this.showStatus('🎉 Encryption test successful! Your key works perfectly.', 'success');
      } else {
        this.showStatus(`❌ Encryption test failed: ${result.error}`, 'error');
      }
      
    } catch (error) {
      //console.log('Test failed:', error);
      this.showStatus('❌ Encryption test failed unexpectedly', 'error');
    } finally {
      this.testButton.textContent = 'Test Encryption';
      this.testButton.disabled = false;
    }
  }

  async performEncryptionTest(key) {
    try {
      // Create a temporary crypto instance for testing
      const testCrypto = new DiscordCrypto();
      const testMessage = `Test message ${Date.now()}`;
      
      // Test encryption
      const encrypted = await testCrypto.encrypt(testMessage, key);
      if (!encrypted || typeof encrypted !== 'string') {
        return { success: false, error: 'Encryption returned invalid result' };
      }

      // Test decryption
      const decrypted = await testCrypto.decrypt(encrypted, key);
      if (decrypted !== testMessage) {
        return { success: false, error: 'Decrypted message does not match original' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateKeyInfo(key) {
    try {
      const fingerprint = await this.generateKeyFingerprint(key);
      this.keyFingerprint.textContent = fingerprint;
      this.keyInfo.style.display = 'block';
    } catch (error) {
      //console.log('Failed to generate key fingerprint:', error);
      this.keyInfo.style.display = 'none';
    }
  }

  async generateKeyFingerprint(key) {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Format as groups of 4 characters for readability
    return hashHex.match(/.{1,4}/g).join(' ').toUpperCase();
  }

  showStatus(message, type) {
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status ${type}`;
    this.statusMessage.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        this.hideStatus();
      }, 5000);
    }
  }

  hideStatus() {
    this.statusMessage.style.display = 'none';
  }

  async loadKeyRotationSettings() {
    try {
      const result = await chrome.storage.local.get([
        'keyRotationEnabled',
        'keyRotationBaseKey',
        'keyRotationIntervalMs',
        'keyRotationStartTimestamp'
      ]);

      if (result.keyRotationEnabled) {
        this.enableRotationCheckbox.checked = true;
        this.rotationSettings.style.display = 'block';
        
        if (result.keyRotationBaseKey) {
          // Don't restore base key to UI for security - show placeholder instead
          this.baseKeyInput.placeholder = '🔒 Base key configured (hidden for security)';
        }

        if (result.keyRotationIntervalMs) {
          const intervalMs = result.keyRotationIntervalMs;
          const predefined = ['10000', '60000', '3600000', '86400000', '604800000', '2629746000'];
          if (predefined.includes(intervalMs.toString())) {
            this.rotationIntervalSelect.value = intervalMs.toString();
          } else {
            this.rotationIntervalSelect.value = 'custom';
            this.customIntervalDiv.style.display = 'block';
            this.customSecondsInput.value = Math.floor(intervalMs / 1000);
          }
        }

        await this.updateRotationStatus();
        
        // Start real-time status updates if rotation is already enabled
        this.startRotationStatusUpdates();
      }
    } catch (error) {
      //console.log('Failed to load key rotation settings:', error);
    }
  }

  toggleRotationSettings() {
    const isEnabled = this.enableRotationCheckbox.checked;
    this.rotationSettings.style.display = isEnabled ? 'block' : 'none';
    
    if (!isEnabled) {
      chrome.storage.local.set({ keyRotationEnabled: false });
      this.rotationStatus.textContent = 'Key rotation disabled';
      
      // Stop real-time status updates when rotation is disabled
      this.stopRotationStatusUpdates();
    }
  }

  handleIntervalChange() {
    const isCustom = this.rotationIntervalSelect.value === 'custom';
    this.customIntervalDiv.style.display = isCustom ? 'block' : 'none';
  }

  async setupKeyRotation() {
    const baseKey = this.baseKeyInput.value.trim();
    
    if (!baseKey) {
      this.showStatus('Please enter a base key for rotation', 'error');
      return;
    }

    if (baseKey.length < 16) {
      this.showStatus('❌ Base key must be at least 16 characters long for security', 'error');
      return;
    }

    if (baseKey.length > 256) {
      this.showStatus('❌ Base key too long (max 256 characters)', 'error');
      return;
    }

    let intervalMs;
    if (this.rotationIntervalSelect.value === 'custom') {
      const customSeconds = parseInt(this.customSecondsInput.value);
      if (!customSeconds || customSeconds < 10) {
        this.showStatus('Please enter a valid custom interval (minimum 10 seconds)', 'error');
        return;
      }
      intervalMs = customSeconds * 1000;
    } else {
      intervalMs = parseInt(this.rotationIntervalSelect.value);
    }

    try {
      this.setupRotationButton.textContent = 'Setting up...';
      this.setupRotationButton.disabled = true;

      const testResult = await this.performEncryptionTest(baseKey);
      if (!testResult.success) {
        throw new Error('Base key failed encryption test: ' + testResult.error);
      }

      // Setup key rotation
      await this.setupKeyRotationStorage(baseKey, intervalMs);
      await this.updateRotationStatus();
      
      // Start real-time status updates
      this.startRotationStatusUpdates();
      
      // Clear base key from UI for security
      this.baseKeyInput.value = '';
      
      this.showStatus(`✅ Key rotation setup successful! Rotating every ${this.formatInterval(intervalMs)}. Base key cleared from UI for security.`, 'success');
      
    } catch (error) {
      //console.log('Failed to setup key rotation:', error);
      this.showStatus(`Failed to setup key rotation: ${error.message}`, 'error');
    } finally {
      this.setupRotationButton.textContent = '🔄 Setup Key Rotation';
      this.setupRotationButton.disabled = false;
    }
  }

  async setupKeyRotationStorage(baseKey, intervalMs) {
    const startTimestamp = Date.now();
    
    await chrome.storage.local.set({
      keyRotationEnabled: true,
      keyRotationBaseKey: baseKey,
      keyRotationIntervalMs: intervalMs,
      keyRotationStartTimestamp: startTimestamp,
      encryptionKey: baseKey,
      // Reset rotation tracking
      rotationCount: 0,
      lastRotationTimestamp: 0
    });
    
    //console.log(`🔐 [CRYPTO] 🔄 Key rotation setup: ${intervalMs}ms intervals, tracking reset`);
  }

  async updateRotationStatus() {
    try {
      const result = await chrome.storage.local.get([
        'keyRotationEnabled',
        'keyRotationIntervalMs',
        'keyRotationStartTimestamp',
        'rotationCount',
        'lastRotationTimestamp'
      ]);

      if (!result.keyRotationEnabled) {
        this.rotationStatus.textContent = 'Key rotation disabled';
        return;
      }

      const intervalMs = result.keyRotationIntervalMs || 0;
      const actualRotationCount = result.rotationCount || 0;
      const lastRotationTime = result.lastRotationTimestamp || Date.now();
      const now = Date.now();
      const nextRotationIn = Math.max(0, intervalMs - (now - lastRotationTime));

      const intervalText = this.formatInterval(intervalMs);
      const nextRotationText = this.formatInterval(nextRotationIn);

      this.rotationStatus.innerHTML = `
        ✅ Active: Rotating every ${intervalText}<br>
        🔢 Actual rotations: ${actualRotationCount}<br>
        ⏰ Next rotation in: ${nextRotationText}
      `;
    } catch (error) {
      //console.log('Failed to update rotation status:', error);
      this.rotationStatus.textContent = 'Error loading rotation status';
    }
  }

  formatInterval(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    
    if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''}`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }

  startRotationStatusUpdates() {
    // Clear any existing interval to avoid duplicates
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
    }
    
    // Update the status every second to show real-time countdown
    this.statusUpdateInterval = setInterval(() => {
      this.updateRotationStatus();
    }, 1000);
  }

  stopRotationStatusUpdates() {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }

  // ==================== SYNC METHODS ====================

  async generateSyncCode() {
    try {
      this.generateSyncButton.textContent = 'Generating...';
      this.generateSyncButton.disabled = true;

      // Get current rotation settings
      const result = await chrome.storage.local.get([
        'keyRotationEnabled',
        'keyRotationBaseKey', 
        'keyRotationIntervalMs',
        'keyRotationStartTimestamp',
        'encryptionKey'
      ]);

      if (!result.keyRotationEnabled) {
        this.showSyncStatus('❌ Key rotation must be enabled first', 'error');
        return;
      }

      if (!result.keyRotationIntervalMs || !result.keyRotationStartTimestamp) {
        this.showSyncStatus('❌ Key rotation settings incomplete. Please setup rotation first.', 'error');
        return;
      }

      // Use base key if available, otherwise use current encryption key
      const keyForEncryption = result.keyRotationBaseKey || result.encryptionKey;
      
      if (!keyForEncryption) {
        this.showSyncStatus('❌ No encryption key available for sync generation', 'error');
        return;
      }

      // Get current rotation count
      const rotationData = await chrome.storage.local.get(['rotationCount']);
      const currentRotationCount = rotationData.rotationCount || 0;

      // Create simple sync data - just the rotation count and interval
      const syncData = {
        version: 2, // New simplified version
        baseKeyHash: await this.hashString(keyForEncryption), // Hash for verification
        intervalMs: result.keyRotationIntervalMs,
        rotationCount: currentRotationCount, // Just send current rotation count
        syncTimestamp: Date.now()
      };

      // Encrypt sync data with available key
      const crypto = new DiscordCrypto();
      const syncJson = JSON.stringify(syncData);
      const encryptedSync = await crypto.encrypt(syncJson, keyForEncryption);
      
      // Create final sync code with identifier
      const syncCode = `DSYNC1:${encryptedSync}`;
      
      this.syncCodeOutput.value = syncCode;
      this.copySyncButton.disabled = false;
      
      this.showSyncStatus(`✅ Sync code generated! Share this with your friend to synchronize rotations.`, 'success');
      
    } catch (error) {
      //console.log('Failed to generate sync code:', error);
      this.showSyncStatus(`❌ Failed to generate sync code: ${error.message}`, 'error');
    } finally {
      this.generateSyncButton.textContent = '📡 Generate Sync Code';
      this.generateSyncButton.disabled = false;
    }
  }

  async copySyncCode() {
    try {
      const syncCode = this.syncCodeOutput.value;
      if (!syncCode) {
        this.showSyncStatus('❌ No sync code to copy', 'error');
        return;
      }

      // Try multiple clipboard methods for better compatibility
      let copySuccess = false;
      
      // Method 1: Modern Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(syncCode);
          copySuccess = true;
        } catch (clipboardError) {
          console.warn('Clipboard API failed:', clipboardError);
        }
      }
      
      // Method 2: Fallback selection method
      if (!copySuccess) {
        this.syncCodeOutput.select();
        this.syncCodeOutput.setSelectionRange(0, 99999); // For mobile
        
        try {
          copySuccess = document.execCommand('copy');
        } catch (execError) {
          console.warn('ExecCommand failed:', execError);
        }
      }
      
      if (copySuccess) {
        // Temporary visual feedback
        const originalText = this.copySyncButton.textContent;
        const originalStyle = this.copySyncButton.style.background;
        
        this.copySyncButton.textContent = '✅ Copied!';
        this.copySyncButton.style.background = '#28a745';
        
        setTimeout(() => {
          this.copySyncButton.textContent = originalText;
          this.copySyncButton.style.background = originalStyle;
        }, 2000);
        
        this.showSyncStatus('📋 Sync code copied to clipboard!', 'success');
      } else {
        // Manual copy instruction
        this.syncCodeOutput.select();
        this.showSyncStatus('❌ Auto-copy failed. Please manually copy the selected text (Ctrl+C)', 'error');
      }
      
    } catch (error) {
      //console.log('Failed to copy sync code:', error);
      this.syncCodeOutput.select();
      this.showSyncStatus('❌ Copy failed. Please manually copy the selected text (Ctrl+C)', 'error');
    }
  }

  async applySyncCode() {
    try {
      const syncCode = this.syncCodeInput.value.trim();
      if (!syncCode) {
        this.showSyncStatus('❌ Please paste a sync code', 'error');
        return;
      }

      this.applySyncButton.textContent = 'Syncing...';
      this.applySyncButton.disabled = true;

      // Validate sync code format
      if (!syncCode.startsWith('DSYNC1:')) {
        this.showSyncStatus('❌ Invalid sync code format', 'error');
        return;
      }

      const encryptedData = syncCode.substring(7); // Remove "DSYNC1:" prefix
      
      // Get current encryption key to decrypt
      const currentSettings = await chrome.storage.local.get(['keyRotationBaseKey', 'encryptionKey']);
      const keyForDecryption = currentSettings.keyRotationBaseKey || currentSettings.encryptionKey;
      
      if (!keyForDecryption) {
        this.showSyncStatus('❌ You must set up encryption key first', 'error');
        return;
      }

      // Decrypt sync data
      const crypto = new DiscordCrypto();
      const decryptedJson = await crypto.decrypt(encryptedData, keyForDecryption);
      const syncData = JSON.parse(decryptedJson);

      // Support both version 1 (old) and version 2 (new simplified)
      if (syncData.version !== 1 && syncData.version !== 2) {
        this.showSyncStatus('❌ Unsupported sync code version', 'error');
        return;
      }

      // Verify encryption key matches (compare hashes)
      const currentKeyHash = await this.hashString(keyForDecryption);
      if (currentKeyHash !== syncData.baseKeyHash) {
        this.showSyncStatus('❌ Encryption key mismatch! You and your friend must use the same encryption key', 'error');
        return;
      }

      // For version 2, just sync to the exact rotation count
      if (syncData.version === 2) {
        // Calculate what the current key should be at this rotation count
        const targetKey = await this.calculateKeyForRotation(keyForDecryption, syncData.intervalMs, syncData.rotationCount);
        
        // Apply sync settings with simple rotation tracking
        await chrome.storage.local.set({
          keyRotationEnabled: true,
          keyRotationIntervalMs: syncData.intervalMs,
          keyRotationStartTimestamp: Date.now(), // Start from now
          encryptionKey: targetKey, // Set to the synced key
          rotationCount: syncData.rotationCount, // Sync rotation count
          lastRotationTimestamp: Date.now() // Reset last rotation time
        });
      } else {
        // Legacy version 1 support
        await chrome.storage.local.set({
          keyRotationEnabled: true,
          keyRotationIntervalMs: syncData.intervalMs,
          keyRotationStartTimestamp: syncData.startTimestamp
        });
      }

      // Update UI
      this.enableRotationCheckbox.checked = true;
      this.rotationSettings.style.display = 'block';
      
      // Update interval selector
      const predefined = ['10000', '60000', '3600000', '86400000', '604800000', '2629746000'];
      if (predefined.includes(syncData.intervalMs.toString())) {
        this.rotationIntervalSelect.value = syncData.intervalMs.toString();
        this.customIntervalDiv.style.display = 'none';
      } else {
        this.rotationIntervalSelect.value = 'custom';
        this.customIntervalDiv.style.display = 'block';
        this.customSecondsInput.value = Math.floor(syncData.intervalMs / 1000);
      }

      await this.updateRotationStatus();
      
      // Show sync success
      const timeDiff = Math.abs(Date.now() - syncData.syncTimestamp);
      const accuracy = timeDiff < 5000 ? 'Perfect' : timeDiff < 30000 ? 'Good' : 'Fair';
      
      this.showSyncStatus(`✅ Sync successful! Time accuracy: ${accuracy} (${timeDiff}ms difference)`, 'success');
      
      // Clear the input
      this.syncCodeInput.value = '';
      
    } catch (error) {
      //console.log('Failed to apply sync code:', error);
      if (error.message.includes('decrypt')) {
        this.showSyncStatus('❌ Invalid sync code or base key mismatch', 'error');
      } else {
        this.showSyncStatus(`❌ Failed to apply sync: ${error.message}`, 'error');
      }
    } finally {
      this.applySyncButton.textContent = '🔄 Apply';
      this.applySyncButton.disabled = false;
    }
  }

  async hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  showSyncStatus(message, type) {
    this.syncStatus.textContent = message;
    this.syncStatus.className = `sync-status ${type}`;
    this.syncStatus.style.display = 'block';
    this.syncStatus.style.color = type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#666';
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
      this.syncStatus.style.display = 'none';
    }, 8000);
  }

  // ==================== SPEED SETTINGS METHODS ====================

  async loadSpeedSettings() {
    try {
      const result = await chrome.storage.local.get(['scanFrequency', 'initialDelay']);
      
      // Set default values if not found
      const scanFrequency = result.scanFrequency || 1000; // 1 second default
      const initialDelay = result.initialDelay || 500; // 0.5 second default
      
      this.scanFrequencySelect.value = scanFrequency.toString();
      this.initialDelaySelect.value = initialDelay.toString();
      
      this.speedStatus.textContent = `Current: ${scanFrequency}ms scan, ${initialDelay}ms initial delay`;
      
    } catch (error) {
      //console.log('Failed to load speed settings:', error);
      this.speedStatus.textContent = 'Failed to load speed settings';
    }
  }

  async saveSpeedSettings() {
    try {
      this.saveSpeedButton.textContent = 'Saving...';
      this.saveSpeedButton.disabled = true;

      const scanFrequency = parseInt(this.scanFrequencySelect.value);
      const initialDelay = parseInt(this.initialDelaySelect.value);

      // Save to storage
      await chrome.storage.local.set({
        scanFrequency: scanFrequency,
        initialDelay: initialDelay
      });

      // Notify content scripts of the change
      try {
        const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
        const notifications = tabs.map(tab => 
          chrome.tabs.sendMessage(tab.id, {
            action: 'updateSpeedSettings',
            scanFrequency: scanFrequency,
            initialDelay: initialDelay
          }).catch(() => {}) // Ignore errors for tabs that don't have content script
        );
        
        await Promise.all(notifications);
      } catch (tabError) {
        //console.log('Tab messaging not available in options page context');
      }

      this.speedStatus.textContent = `✅ Saved: ${scanFrequency}ms scan, ${initialDelay}ms initial delay`;
      this.speedStatus.style.color = '#28a745';
      
      // Reset color after 3 seconds
      setTimeout(() => {
        this.speedStatus.style.color = '#666';
      }, 3000);

    } catch (error) {
      //console.log('Failed to save speed settings:', error);
      this.speedStatus.textContent = `❌ Failed to save speed settings: ${error.message}`;
      this.speedStatus.style.color = '#dc3545';
    } finally {
      this.saveSpeedButton.textContent = '⚡ Save Speed Settings';
      this.saveSpeedButton.disabled = false;
    }
  }

  // ==================== DEBUG METHODS ====================

  async debugSyncKeys() {
    try {
      this.debugSyncButton.textContent = 'Debugging...';
      this.debugSyncButton.disabled = true;

      const result = await chrome.storage.local.get([
        'keyRotationEnabled',
        'keyRotationBaseKey', 
        'keyRotationIntervalMs',
        'keyRotationStartTimestamp',
        'rotationCount',
        'lastRotationTimestamp',
        'encryptionKey'
      ]);

      let debugInfo = `=== DEBUG SYNC KEYS ===\n`;
      debugInfo += `Rotation Enabled: ${result.keyRotationEnabled || false}\n`;
      debugInfo += `Base Key: ${result.keyRotationBaseKey ? result.keyRotationBaseKey.substring(0, 8) + '...' : 'NOT SET'}\n`;
      debugInfo += `Current Key: ${result.encryptionKey ? result.encryptionKey.substring(0, 8) + '...' : 'NOT SET'}\n`;
      debugInfo += `Interval: ${result.keyRotationIntervalMs || 'NOT SET'}ms\n`;
      debugInfo += `Start Time: ${result.keyRotationStartTimestamp ? new Date(result.keyRotationStartTimestamp).toISOString() : 'NOT SET'}\n`;
      debugInfo += `Rotation Count: ${result.rotationCount || 0}\n`;
      debugInfo += `Last Rotation: ${result.lastRotationTimestamp ? new Date(result.lastRotationTimestamp).toISOString() : 'NEVER'}\n`;

      if (result.keyRotationBaseKey && result.keyRotationIntervalMs) {
        debugInfo += `\n=== EXPECTED KEYS ===\n`;
        
        // Calculate what keys should be for rotations 0-3
        for (let i = 0; i <= 3; i++) {
          const expectedKey = await this.calculateKeyForRotation(result.keyRotationBaseKey, result.keyRotationIntervalMs, i);
          debugInfo += `Rotation ${i}: ${expectedKey.substring(0, 12)}...\n`;
        }
      }

      this.debugOutput.style.display = 'block';
      this.debugOutput.textContent = debugInfo;

    } catch (error) {
      //console.log('Debug failed:', error);
      this.debugOutput.style.display = 'block';
      this.debugOutput.textContent = `DEBUG ERROR: ${error.message}`;
    } finally {
      this.debugSyncButton.textContent = '🔍 Debug Sync Keys';
      this.debugSyncButton.disabled = false;
    }
  }

  // Helper method to calculate expected key for any rotation number (matches background.js)
  async calculateKeyForRotation(baseKey, intervalMs, rotationNumber) {
    if (rotationNumber === 0) {
      return baseKey; // Rotation 0 is the base key itself
    }
    
    // Simple sequential hashing - no entropy needed
    let currentKey = baseKey;
    for (let i = 1; i <= rotationNumber; i++) {
      currentKey = await this.simpleHashKey(currentKey, i);
    }
    
    return currentKey;
  }

  async simpleHashKey(key, rotationNumber) {
    // Match the logic from background.js exactly
    const combinedString = `${key}::rotation::${rotationNumber}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(combinedString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ==================== ASYMMETRIC ENCRYPTION METHODS ====================

  async loadAsymmetricSettings() {
    try {
      const result = await chrome.storage.local.get(['ecEnabled', 'ecRotationInterval']);
      
      this.enableAsymmetricCheckbox.checked = result.ecEnabled || false;
      
      // Handle the interval selection including 'manual' option
      const rotationInterval = result.ecRotationInterval;
      if (rotationInterval === null || rotationInterval === undefined) {
        this.ecRotationIntervalSelect.value = 'manual';
      } else {
        this.ecRotationIntervalSelect.value = rotationInterval.toString();
      }
      
      this.toggleAsymmetricSettings();
      
      if (result.ecEnabled) {
        // Initial load of key info
        await this.updateCurrentKeyInfo();
        await this.refreshContactsList();
        
        // Start periodic updates
        this.startAsymmetricStatusUpdates();
      }
      
    } catch (error) {
      //console.log('Failed to load asymmetric settings:', error);
    }
  }

  toggleAsymmetricSettings() {
    const isEnabled = this.enableAsymmetricCheckbox.checked;
    this.asymmetricSettings.style.display = isEnabled ? 'block' : 'none';
    
    if (isEnabled) {
      this.enableAsymmetricMode();
      
      // Setup button listeners now that the section is visible
      setTimeout(() => {
        this.setupAsymmetricButtonListeners();
      }, 100);
      
      // Load current key info and contacts immediately, then again after delay
      this.updateCurrentKeyInfo();
      this.refreshContactsList();
      
      // Also check again after a brief delay to ensure everything is loaded
      setTimeout(async () => {
        await this.updateCurrentKeyInfo();
        await this.refreshContactsList();
      }, 1000);
    } else {
      this.disableAsymmetricMode();
    }
  }

  async enableAsymmetricMode() {
    try {
      const currentTime = Date.now();
      
      // Get current rotation interval to set proper timing
      const stored = await chrome.storage.local.get(['ecRotationInterval']);
      
      await chrome.storage.local.set({ 
        ecEnabled: true,
        ecLastRotation: currentTime // Reset rotation timer when enabling
      });
      
      // If there's a rotation interval set, make sure the timer is properly initialized
      if (stored.ecRotationInterval && stored.ecRotationInterval !== null) {
        //console.log(`Resetting rotation timer with ${stored.ecRotationInterval}ms interval`);
      }
      
      // Notify all Discord tabs
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      const notifications = tabs.map(tab => 
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleAsymmetricMode',
          enabled: true
        }).catch(() => {})
      );
      
      await Promise.all(notifications);
      
      this.startAsymmetricStatusUpdates();
      
      //console.log('Asymmetric encryption enabled');
      
    } catch (error) {
      //console.log('Failed to enable asymmetric mode:', error);
    }
  }

  async disableAsymmetricMode() {
    try {
      await chrome.storage.local.set({ ecEnabled: false });
      
      // Notify all Discord tabs
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      const notifications = tabs.map(tab => 
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleAsymmetricMode',
          enabled: false
        }).catch(() => {})
      );
      
      await Promise.all(notifications);
      
      this.stopAsymmetricStatusUpdates();
      
      // Update status display
      document.getElementById('ec-status-text').textContent = 'Disabled';
      
      //console.log('Asymmetric encryption disabled');
      
    } catch (error) {
      //console.log('Failed to disable asymmetric mode:', error);
    }
  }

  async updateAsymmetricRotationInterval() {
    try {
      const intervalMs = parseInt(this.ecRotationIntervalSelect.value);
      await chrome.storage.local.set({ ecRotationInterval: intervalMs });
      
      // Update the EC crypto instance if available
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      const notifications = tabs.map(tab => 
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateECRotationInterval',
          intervalMs: intervalMs
        }).catch(() => {})
      );
      
      await Promise.all(notifications);
      
      //console.log(`EC rotation interval updated to ${intervalMs}ms`);
      
    } catch (error) {
      //console.log('Failed to update EC rotation interval:', error);
    }
  }

  async rotateKeysManually() {
    console.log('🔄 Manual key rotation initiated');
    
    try {
      this.rotateKeysButton.textContent = 'Rotating...';
      this.rotateKeysButton.disabled = true;

      // Try to send rotation command to Discord tabs
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      console.log('🔄 Found', tabs.length, 'Discord tabs for manual rotation');
      
      let rotationSuccess = false;
      
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'rotateKeys' });
          console.log(`🔄 ✅ Sent rotation command to tab ${tab.id}`);
          rotationSuccess = true;
          break; // Only need one successful command
        } catch (error) {
          console.log(`🔄 ❌ Failed to send rotation command to tab ${tab.id}:`, error);
          // Try next tab
        }
      }
      
      if (!rotationSuccess) {
        // If no Discord tabs available, show message
        console.log('🔄 ❌ No Discord tabs responded to rotation command');
        this.showStatus('Please open Discord in a tab to rotate keys', 'error');
        return;
      }
      
      // Wait a moment for rotation to complete, then update display
      setTimeout(async () => {
        console.log('🔄 Refreshing UI after rotation...');
        
        // Check if keys actually changed
        const beforeKeyInfo = document.getElementById('current-key-id').textContent;
        console.log('🔄 Key ID before refresh:', beforeKeyInfo);
        
        await this.updateCurrentKeyInfo();
        await this.refreshContactsList();
        
        const afterKeyInfo = document.getElementById('current-key-id').textContent;
        console.log('🔄 Key ID after refresh:', afterKeyInfo);
        
        if (beforeKeyInfo !== afterKeyInfo) {
          this.showStatus('✅ Key rotation successful! New Key ID: ' + afterKeyInfo, 'success');
          console.log('🔄 ✅ Key rotation successful - ID changed from', beforeKeyInfo, 'to', afterKeyInfo);
        } else {
          this.showStatus('⚠️ Key rotation may have failed - Key ID unchanged', 'error');
          console.log('🔄 ⚠️ Key rotation may have failed - Key ID unchanged');
        }
        
        console.log('🔄 ✅ Manual rotation complete');
      }, 2000); // Give it more time
      
    } catch (error) {
      //console.log('Failed to rotate keys:', error);
      this.showStatus('Failed to rotate keys: ' + error.message, 'error');
    } finally {
      this.rotateKeysButton.textContent = '🔄 Rotate Keys Now';
      this.rotateKeysButton.disabled = false;
    }
  }

  async updateAsymmetricStatus() {
    try {
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      
      for (const tab of tabs) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getAsymmetricStatus' });
          
          if (response && response.enabled) {
            document.getElementById('ec-status-text').textContent = 'Active';
            document.getElementById('current-key-id').textContent = response.currentPublicKeyId || '-';
            document.getElementById('contact-count').textContent = response.contactCount || 0;
            
            if (response.rotationStatus && response.rotationStatus.timeUntilNext) {
              const timeUntil = Math.ceil(response.rotationStatus.timeUntilNext / 1000);
              document.getElementById('next-rotation').textContent = this.formatTime(response.rotationStatus.timeUntilNext);
            } else {
              document.getElementById('next-rotation').textContent = '-';
            }
            
            break; // Got status from one tab, that's enough
          }
        } catch (error) {
          // Try next tab
        }
      }
      
    } catch (error) {
      //console.log('Failed to update asymmetric status:', error);
      document.getElementById('ec-status-text').textContent = 'Error';
    }
  }

  startAsymmetricStatusUpdates() {
    if (this.asymmetricStatusInterval) {
      clearInterval(this.asymmetricStatusInterval);
    }
    
    this.asymmetricStatusInterval = setInterval(() => {
      this.updateAsymmetricStatus();
    }, 5000); // Update every 5 seconds
  }

  stopAsymmetricStatusUpdates() {
    if (this.asymmetricStatusInterval) {
      clearInterval(this.asymmetricStatusInterval);
      this.asymmetricStatusInterval = null;
    }
  }

  toggleContactList() {
    const isVisible = this.contactList.style.display !== 'none';
    
    if (isVisible) {
      this.contactList.style.display = 'none';
      this.viewContactsButton.textContent = '👥 View Contacts';
    } else {
      this.loadAndDisplayContacts();
      this.contactList.style.display = 'block';
      this.viewContactsButton.textContent = '👥 Hide Contacts';
    }
  }

  async loadAndDisplayContacts() {
    try {
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      
      for (const tab of tabs) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getContactList' });
          
          if (response && Array.isArray(response)) {
            this.displayContacts(response);
            break;
          }
        } catch (error) {
          // Try next tab
        }
      }
      
    } catch (error) {
      //console.log('Failed to load contacts:', error);
      document.getElementById('contact-list-content').textContent = 'Error loading contacts';
    }
  }

  displayContacts(contacts) {
    const content = document.getElementById('contact-list-content');
    
    if (contacts.length === 0) {
      content.textContent = 'No contacts discovered yet. Send or receive encrypted messages to discover contacts.';
      return;
    }
    
    let html = '';
    contacts.forEach(contact => {
      const discoveredDate = contact.discoveredAt ? new Date(contact.discoveredAt).toLocaleDateString() : 'Unknown';
      
      html += `<div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #00a8ff;">`;
      html += `<div style="font-weight: 600; color: #333;">👤 ${contact.username}</div>`;
      
      if (contact.discordUserId) {
        html += `<div style="font-size: 11px; color: #666;">Discord ID: ${contact.discordUserId}</div>`;
      }
      
      html += `<div style="font-size: 11px; color: #666;">Contact ID: ${contact.id}</div>`;
      html += `<div style="font-size: 11px; color: #666;">Key ID: ${contact.keyId}</div>`;
      html += `<div style="font-size: 10px; color: #999;">Discovered: ${discoveredDate}</div>`;
      html += `<div style="font-size: 9px; color: #ccc; word-break: break-all; margin-top: 4px;">PubKey: ${contact.publicKey.substring(0, 32)}...</div>`;
      html += `</div>`;
    });
    
    content.innerHTML = html;
  }

  formatTime(ms) {
    if (ms <= 0) return '0s';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // ========== NEW ENHANCED ASYMMETRIC METHODS ==========

  async refreshContactsList() {
    try {
      this.viewContactsButton.textContent = '🔄 Loading...';
      this.viewContactsButton.disabled = true;

      // Get contacts directly from storage
      const stored = await chrome.storage.local.get(['ecUserKeys']);
      const userKeys = stored.ecUserKeys || {};
      
      // Convert storage format to display format
      const contacts = [];
      for (const [userId, userInfo] of Object.entries(userKeys)) {
        contacts.push({
          id: userId,
          discordUserId: userId.startsWith('temp_') ? null : userId,
          username: userInfo.username || 'Unknown User',
          keyId: userInfo.keyId,
          publicKey: userInfo.publicKey,
          discoveredAt: userInfo.discoveredAt || userInfo.addedAt || Date.now()
        });
      }
      
      this.displayContactsInNewFormat(contacts);
      document.getElementById('contact-count').textContent = contacts.length;
      
      // Also update the key info
      await this.updateCurrentKeyInfo();
      
    } catch (error) {
      //console.log('Failed to refresh contacts:', error);
      document.getElementById('contact-list-content').innerHTML = '<div style="color: #dc3545; text-align: center; padding: 20px;">Error loading contacts</div>';
    } finally {
      this.viewContactsButton.textContent = '🔄 Refresh';
      this.viewContactsButton.disabled = false;
    }
  }

  displayContactsInNewFormat(contacts) {
    const content = document.getElementById('contact-list-content');
    
    if (contacts.length === 0) {
      content.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No contacts discovered yet. Send an encrypted message to discover contacts automatically.</div>';
      return;
    }
    
    let html = '';
    contacts.forEach((contact, index) => {
      const discoveredDate = contact.discoveredAt ? new Date(contact.discoveredAt).toLocaleDateString() : 'Unknown';
      
      html += `<div style="margin-bottom: 8px; padding: 10px; background: white; border-radius: 6px; border-left: 3px solid #007bff;">`;
      html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">`;
      html += `<div style="font-weight: 600; color: #333; font-size: 12px;">👤 ${contact.username || 'Unknown User'}</div>`;
      html += `<div style="font-size: 10px; color: #28a745; background: #e8f5e8; padding: 2px 6px; border-radius: 10px;">Contact ${index + 1}</div>`;
      html += `</div>`;
      
      if (contact.discordUserId) {
        html += `<div style="font-size: 10px; color: #666; margin-bottom: 2px;">🎮 Discord ID: ${contact.discordUserId}</div>`;
      }
      
      html += `<div style="font-size: 10px; color: #666; margin-bottom: 2px;">🔑 Key ID: ${contact.keyId}</div>`;
      html += `<div style="font-size: 10px; color: #999;">📅 Discovered: ${discoveredDate}</div>`;
      html += `</div>`;
    });
    
    content.innerHTML = html;
  }

  async updateCurrentKeyInfo() {
    try {
      // Get key information directly from storage
      const stored = await chrome.storage.local.get([
        'ecStaticPublicKey',
        'ecMyKeyId', 
        'ecKeyGenerated',
        'ecRotationInterval',
        'ecLastRotation',
        'ecUserKeys'
      ]);

      // Update key ID
      const keyId = stored.ecMyKeyId || 'Not generated';
      document.getElementById('current-key-id').textContent = keyId;
      
      // Update public key
      const publicKey = stored.ecStaticPublicKey || 'Not available';
      document.getElementById('my-public-key').value = publicKey;
      
      // Update key created time
      if (stored.ecKeyGenerated) {
        document.getElementById('key-created').textContent = new Date(stored.ecKeyGenerated).toLocaleString();
      } else {
        document.getElementById('key-created').textContent = 'Unknown';
      }
      
      // Update contact count
      const userKeys = stored.ecUserKeys || {};
      const contactCount = Object.keys(userKeys).length;
      document.getElementById('contact-count').textContent = contactCount;
      
      // Update next rotation
      await this.updateNextRotationTime(stored);
      
    } catch (error) {
      //console.log('Failed to update current key info:', error);
      document.getElementById('current-key-id').textContent = 'Error loading';
      document.getElementById('my-public-key').value = 'Error loading key info';
      document.getElementById('key-created').textContent = 'Error';
      document.getElementById('contact-count').textContent = '0';
    }
  }

  async updateNextRotationTime(stored) {
    try {
      const rotationInterval = stored.ecRotationInterval;
      
      if (!rotationInterval || rotationInterval === null || rotationInterval === 'manual') {
        document.getElementById('next-rotation').textContent = 'Manual only';
        return;
      }
      
      const intervalMs = parseInt(rotationInterval);
      if (isNaN(intervalMs) || intervalMs <= 0) {
        document.getElementById('next-rotation').textContent = 'Invalid interval';
        return;
      }
      
      // Simple time difference calculation - just show how long since key was created
      const keyCreatedTime = stored.ecKeyGenerated || stored.ecLastRotation;
      
      if (!keyCreatedTime) {
        document.getElementById('next-rotation').textContent = 'No key timing info';
        return;
      }
      
      const now = Date.now();
      const timeSinceCreated = now - keyCreatedTime;
      
      // Simply show time since key creation
      document.getElementById('next-rotation').textContent = this.formatTime(timeSinceCreated) + ' ago';
      
    } catch (error) {
      //console.log('Failed to update next rotation time:', error);
      document.getElementById('next-rotation').textContent = 'Error';
    }
  }

  async exportPublicKey() {
    try {
      const publicKey = document.getElementById('my-public-key').value;
      
      if (!publicKey || publicKey === 'Loading...') {
        this.showStatus('No public key available to export', 'error');
        return;
      }
      
      // Copy to clipboard
      await navigator.clipboard.writeText(publicKey);
      this.showStatus('Public key copied to clipboard!', 'success');
      
      // Temporarily change button text
      const button = document.getElementById('export-public-key');
      const originalText = button.textContent;
      button.textContent = '✅ Copied!';
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
      
    } catch (error) {
      //console.log('Failed to export public key:', error);
      this.showStatus('Failed to copy public key', 'error');
    }
  }

  async clearAllContacts() {
    console.log('🗑️ Clear Contacts button clicked!');
    
    const confirmed = confirm('Are you sure you want to clear all discovered contacts? This action cannot be undone.');
    
    if (!confirmed) {
      console.log('🗑️ User cancelled contact clearing');
      return;
    }
    
    try {
      console.log('🗑️ Clearing contacts from storage...');
      // Clear contacts directly in storage
      await chrome.storage.local.set({ ecUserKeys: {} });
      console.log('🗑️ Contacts cleared from storage');
      
      // Also try to notify Discord tabs to clear their in-memory cache
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      console.log('🗑️ Found', tabs.length, 'Discord tabs to notify');
      
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'clearAllContacts' });
          console.log('🗑️ Notified tab', tab.id);
        } catch (error) {
          console.log('🗑️ Could not notify tab', tab.id, '- this is OK');
        }
      }
      
      // Refresh the display immediately
      console.log('🗑️ Refreshing UI...');
      await this.refreshContactsList();
      await this.updateCurrentKeyInfo(); // This will update the contact count too
      
      this.showStatus('All contacts cleared successfully', 'success');
      console.log('🗑️ Contact clearing completed successfully');
      
    } catch (error) {
      //console.log('Failed to clear contacts:', error);
      this.showStatus('Failed to clear contacts: ' + error.message, 'error');
    }
  }

  async testAsymmetricEncryption() {
    try {
      const message = document.getElementById('demo-message').value.trim();
      
      if (!message) {
        this.showStatus('Please enter a test message', 'error');
        return;
      }
      
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      
      for (const tab of tabs) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { 
            action: 'testEncryption',
            message: message
          });
          
          if (response && response.success) {
            document.getElementById('encrypted-result').value = response.encryptedText;
            this.showStatus(`Encryption successful! Used ${response.method} with ${response.recipientInfo || 'static key'}`, 'success');
            break;
          } else {
            document.getElementById('encrypted-result').value = 'Encryption failed: ' + (response.error || 'Unknown error');
          }
        } catch (error) {
          document.getElementById('encrypted-result').value = 'Error: ' + error.message;
        }
      }
      
    } catch (error) {
      //console.log('Failed to test encryption:', error);
      document.getElementById('encrypted-result').value = 'Error: ' + error.message;
    }
  }

  async testAsymmetricDecryption() {
    try {
      const encryptedText = document.getElementById('encrypted-result').value.trim();
      
      if (!encryptedText || encryptedText.startsWith('Encryption failed') || encryptedText.startsWith('Error:')) {
        this.showStatus('Please encrypt a message first', 'error');
        return;
      }
      
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      
      for (const tab of tabs) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { 
            action: 'testDecryption',
            encryptedText: encryptedText
          });
          
          if (response && response.success) {
            document.getElementById('decrypted-result').value = response.decryptedText;
            this.showStatus(`Decryption successful! Used ${response.method}`, 'success');
            break;
          } else {
            document.getElementById('decrypted-result').value = 'Decryption failed: ' + (response.error || 'Cannot decrypt without proper keys');
            this.showStatus('Decryption failed - this demonstrates that without the correct keys, messages cannot be decrypted', 'info');
          }
        } catch (error) {
          document.getElementById('decrypted-result').value = 'Error: ' + error.message;
        }
      }
      
    } catch (error) {
      //console.log('Failed to test decryption:', error);
      document.getElementById('decrypted-result').value = 'Error: ' + error.message;
    }
  }

  // Override the updateAsymmetricRotationInterval to handle manual mode
  async updateAsymmetricRotationInterval() {
    const interval = this.ecRotationIntervalSelect.value;
    
    try {
      if (interval === 'manual') {
        // Disable automatic rotation
        await chrome.storage.local.set({
          ecRotationInterval: null,
          ecAutoRotation: false
        });
        this.showStatus('Switched to manual key rotation only', 'info');
      } else {
        // Enable automatic rotation with specified interval
        const intervalMs = parseInt(interval);
        const currentTime = Date.now();
        
        await chrome.storage.local.set({
          ecRotationInterval: intervalMs,
          ecAutoRotation: true,
          ecLastRotation: currentTime // Reset the rotation timer to now
        });
        
        this.showStatus(`Key rotation set to ${this.formatInterval(intervalMs)}`, 'success');
        
        // Update the EC crypto instance if available
        const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
        const notifications = tabs.map(tab => 
          chrome.tabs.sendMessage(tab.id, {
            action: 'updateECRotationInterval',
            intervalMs: intervalMs
          }).catch(() => {})
        );
        
        await Promise.all(notifications);
      }
      
      // Trigger refresh of status to show new next rotation time
      setTimeout(async () => {
        await this.updateCurrentKeyInfo();
      }, 100);
      
    } catch (error) {
      //console.log('Failed to update asymmetric rotation interval:', error);
      this.showStatus('Failed to update rotation interval', 'error');
    }
  }

  // Start auto-updating the key info display
  startAsymmetricStatusUpdates() {
    if (this.asymmetricStatusInterval) {
      clearInterval(this.asymmetricStatusInterval);
    }
    
    // Update every second for real-time countdown
    this.asymmetricStatusInterval = setInterval(async () => {
      await this.updateCurrentKeyInfo();
    }, 1000); // Update every second for live countdown
  }

  // Debug Methods
  async debugKeyStatus() {
    const debugLog = document.getElementById('debug-log');
    
    try {
      debugLog.value = 'Running key status debug...\n\n';
      
      // Get the active tabs to send message to content script
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      if (tabs.length === 0) {
        debugLog.value += 'No Discord tab found! Please open Discord.\n';
        return;
      }
      
      // Send message to content script to run debug
      try {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'debugKeyStatus'
        });
        
        debugLog.value += 'Debug command sent to Discord tab\n';
      } catch (error) {
        debugLog.value += 'Could not send debug command to Discord tab\n';
      }
      
      debugLog.value += 'Check browser console (F12) for detailed output\n\n';
      
      // Also get storage info for display
      const stored = await chrome.storage.local.get([
        'ecStaticPrivateKey', 
        'ecStaticPublicKey', 
        'ecMyKeyId',
        'ecKeyGenerated',
        'ecLastRotation',
        'ecRotationCount'
      ]);
      
      debugLog.value += '=== STORED KEY INFO ===\n';
      debugLog.value += `Key ID: ${stored.ecMyKeyId || 'Not set'}\n`;
      debugLog.value += `Generated: ${stored.ecKeyGenerated ? new Date(stored.ecKeyGenerated).toLocaleString() : 'Unknown'}\n`;
      debugLog.value += `Last Rotation: ${stored.ecLastRotation ? new Date(stored.ecLastRotation).toLocaleString() : 'Never'}\n`;
      debugLog.value += `Rotation Count: ${stored.ecRotationCount || 0}\n`;
      
      if (stored.ecStaticPublicKey) {
        debugLog.value += `Public Key: ${stored.ecStaticPublicKey.substring(0, 50)}...\n`;
      }
      
      debugLog.value += '\n✅ Debug complete! Check console for full details.\n';
      
    } catch (error) {
      debugLog.value += `❌ Debug failed: ${error.message}\n`;
      //console.log('Debug key status error:', error);
    }
  }

  async forceUniqueKeys() {
    const debugLog = document.getElementById('debug-log');
    
    try {
      debugLog.value = 'Forcing unique key regeneration...\n\n';
      
      // Get the active tabs to send message to content script
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      if (tabs.length === 0) {
        debugLog.value += 'No Discord tab found! Please open Discord.\n';
        return;
      }
      
      debugLog.value += 'Step 1: Clearing stored keys...\n';
      
      // Clear all stored EC keys
      await chrome.storage.local.remove([
        'ecStaticPrivateKey', 
        'ecStaticPublicKey', 
        'ecMyKeyId',
        'ecKeyGenerated',
        'ecKeyEntropy',
        'ecEntropyComponents'
      ]);
      
      debugLog.value += 'Step 2: Sending regeneration command...\n';
      
      // Send message to content script to regenerate
      try {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'forceUniqueKeys'
        });
        debugLog.value += 'Regeneration command sent successfully\n';
      } catch (error) {
        debugLog.value += 'Could not send command to Discord tab\n';
      }
      
      debugLog.value += 'Step 3: Waiting for regeneration...\n';
      
      // Wait a moment then check new keys
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newStored = await chrome.storage.local.get(['ecMyKeyId', 'ecKeyGenerated']);
      
      debugLog.value += `Step 4: New Key ID: ${newStored.ecMyKeyId || 'Still generating...'}\n`;
      debugLog.value += `Generated: ${newStored.ecKeyGenerated ? new Date(newStored.ecKeyGenerated).toLocaleString() : 'In progress...'}\n`;
      
      debugLog.value += '\n✅ Unique key regeneration complete!\n';
      debugLog.value += '💡 Send a test message to verify uniqueness\n';
      
      // Refresh the UI
      await this.updateCurrentKeyInfo();
      
    } catch (error) {
      debugLog.value += `❌ Force unique keys failed: ${error.message}\n`;
      //console.log('Force unique keys error:', error);
    }
  }

  async fixAfterRotation() {
    const debugLog = document.getElementById('debug-log');
    
    try {
      debugLog.value = 'Fixing communication after rotation...\n\n';
      
      // Get the active tabs to send message to content script
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      if (tabs.length === 0) {
        debugLog.value += 'No Discord tab found! Please open Discord.\n';
        return;
      }
      
      debugLog.value += 'Step 1: Clearing all contacts...\n';
      
      // Clear contacts via content script
      try {
        const clearResponse = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'clearAllContacts'
        });
        
        if (clearResponse && clearResponse.success) {
          debugLog.value += '✅ Contacts cleared successfully\n';
        } else {
          debugLog.value += '⚠️ Contact clearing may have failed\n';
        }
      } catch (error) {
        debugLog.value += '❌ Could not clear contacts via Discord tab\n';
      }
      
      debugLog.value += 'Step 2: Reloading keys...\n';
      
      // Send fix command to content script
      try {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'fixAfterRotation'
        });
        debugLog.value += 'Fix command sent successfully\n';
      } catch (error) {
        debugLog.value += 'Could not send fix command to Discord tab\n';
      }
      
      debugLog.value += 'Step 3: Refreshing UI...\n';
      
      // Refresh contact list and key info
      await this.refreshContactsList();
      await this.updateCurrentKeyInfo();
      
      debugLog.value += '\n✅ Fix complete!\n';
      debugLog.value += '💡 Now send a test message to rediscover contacts\n';
      debugLog.value += '🔄 Both users should do this after key rotation\n';
      
    } catch (error) {
      debugLog.value += `❌ Fix after rotation failed: ${error.message}\n`;
      //console.log('Fix after rotation error:', error);
    }
  }

  async cleanupTempContacts() {
    const debugLog = document.getElementById('debug-log');
    
    try {
      debugLog.value = 'Cleaning up temporary contacts...\n\n';
      
      // Get the active tabs to send message to content script
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      if (tabs.length === 0) {
        debugLog.value += 'No Discord tab found! Please open Discord.\n';
        return;
      }
      
      debugLog.value += 'Step 1: Getting current contact list...\n';
      
      // Get current contacts first
      const currentContacts = await this.refreshContactsList();
      const tempContacts = currentContacts.filter(contact => 
        contact.id && contact.id.startsWith('temp_'));
      
      debugLog.value += `Found ${tempContacts.length} temporary contacts\n`;
      
      if (tempContacts.length === 0) {
        debugLog.value += '✅ No temporary contacts to clean up!\n';
        return;
      }
      
      // Show which temp contacts we found
      tempContacts.forEach(contact => {
        debugLog.value += `📋 Temp: ${contact.id} (${contact.username})\n`;
      });
      
      debugLog.value += '\nStep 2: Calling cleanup function...\n';
      
      // Call cleanup via content script
      try {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'cleanupTempContacts'
        });
        
        if (response && response.success) {
          debugLog.value += `✅ Cleanup successful! Removed ${response.removedCount || 0} contacts\n`;
        } else {
          debugLog.value += '⚠️ Cleanup may have failed\n';
        }
      } catch (error) {
        debugLog.value += '❌ Could not send cleanup command to Discord tab\n';
      }
      
      debugLog.value += '\nStep 3: Refreshing contact list...\n';
      
      // Refresh contact list to show results
      await this.refreshContactsList();
      
      debugLog.value += '\n✅ Cleanup complete!\n';
      debugLog.value += '💡 Temp contacts are created when user IDs cannot be extracted\n';
      debugLog.value += '💡 If this keeps happening, the user ID extraction needs fixing\n';
      
    } catch (error) {
      debugLog.value += `❌ Cleanup temp contacts failed: ${error.message}\n`;
      //console.log('Cleanup temp contacts error:', error);
    }
  }

  async resetRotationTimer() {
    try {
      const currentTime = Date.now();
      
      // Get current settings
      const stored = await chrome.storage.local.get(['ecRotationInterval']);
      
      if (!stored.ecRotationInterval || stored.ecRotationInterval === null) {
        this.showStatus('No rotation interval set - timer is in manual mode', 'info');
        return;
      }
      
      // Reset the epoch to now - this is the proper way to reset an epoch-based timer
      await chrome.storage.local.set({
        ecRotationEpoch: currentTime,
        ecLastRotation: currentTime,
        ecKeyGenerated: currentTime // Also ensure key generation time is set
      });
      
      console.log('⏰ Rotation epoch reset to:', new Date(currentTime).toLocaleString());
      
      // Update display immediately
      await this.updateCurrentKeyInfo();
      
      this.showStatus(`Timer reset! Next rotation in ${this.formatInterval(stored.ecRotationInterval)}`, 'success');
      
    } catch (error) {
      //console.log('Failed to reset rotation timer:', error);
      this.showStatus('Failed to reset timer: ' + error.message, 'error');
    }
  }

  // ========== USER ID MANAGEMENT ==========

  async setUserIdManually() {
    const userIdInput = document.getElementById('manual-user-id');
    const usernameInput = document.getElementById('manual-username');
    
    const userId = userIdInput.value.trim();
    const username = usernameInput.value.trim() || 'Unknown';
    
    if (!userId) {
      this.showStatus('Please enter your Discord User ID', 'error');
      return;
    }
    
    // Validate user ID format (Discord user IDs are 17-19 digits)
    if (!/^\d{17,19}$/.test(userId)) {
      this.showStatus('Invalid Discord User ID format. Should be 17-19 digits.', 'error');
      return;
    }
    
    try {
      // Store the user ID and username
      await chrome.storage.local.set({
        currentUserId: userId,
        currentUsername: username
      });
      
      // Notify Discord tabs to update their user info
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'setCurrentUser',
            userId: userId,
            username: username
          });
        } catch (error) {
          // Ignore tab communication errors
        }
      }
      
      // Update the display
      await this.updateCurrentUserDisplay();
      
      // Clear the input fields
      userIdInput.value = '';
      usernameInput.value = '';
      
      this.showStatus('✅ User ID set successfully! This should fix message decryption issues.', 'success');
      
    } catch (error) {
      //console.log('Failed to set user ID:', error);
      this.showStatus('Failed to set user ID: ' + error.message, 'error');
    }
  }

  async autoDetectUserId() {
    try {
      this.showStatus('🔍 Trying to auto-detect your Discord User ID...', 'info');
      
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      if (tabs.length === 0) {
        this.showStatus('No Discord tab found. Please open Discord first.', 'error');
        return;
      }
      
      // Try to get user ID from Discord tab
      for (const tab of tabs) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'detectCurrentUser'
          });
          
          if (response && response.userId) {
            // Auto-fill the inputs
            document.getElementById('manual-user-id').value = response.userId;
            if (response.username && response.username !== 'Unknown') {
              document.getElementById('manual-username').value = response.username;
            }
            
            this.showStatus('✅ Auto-detected User ID: ' + response.userId + '. Click "Set User ID" to save.', 'success');
            return;
          }
        } catch (error) {
          //console.log('Failed to detect user ID from tab:', tab.id);
        }
      }
      
      this.showStatus('❌ Could not auto-detect User ID. Please set it manually.', 'error');
      
    } catch (error) {
      //console.log('Failed to auto-detect user ID:', error);
      this.showStatus('Failed to auto-detect user ID: ' + error.message, 'error');
    }
  }

  async updateCurrentUserDisplay() {
    try {
      const stored = await chrome.storage.local.get(['currentUserId', 'currentUsername']);
      
      const userIdDisplay = document.getElementById('current-user-id');
      const usernameDisplay = document.getElementById('current-username');
      
      if (userIdDisplay) {
        userIdDisplay.textContent = stored.currentUserId || 'Not set';
      }
      
      if (usernameDisplay) {
        usernameDisplay.textContent = stored.currentUsername || 'Not set';
      }
      
    } catch (error) {
      //console.log('Failed to update user display:', error);
    }
  }

  // ==================== LANGUAGE SETTINGS METHODS ====================

  async loadLanguageSettings() {
    console.log('🎭 Loading language settings...');
    
    try {
      const stored = await chrome.storage.local.get(['stealthLanguage']);
      const currentLanguage = stored.stealthLanguage || 'chinese';
      console.log('🎭 Loaded language from storage:', currentLanguage);
      
      if (this.stealthLanguageSelect) {
        this.stealthLanguageSelect.value = currentLanguage;
        console.log('🎭 Set select value to:', currentLanguage);
        this.updateLanguagePreview();
        console.log('🎭 ✅ Language settings loaded successfully');
      } else {
        console.error('🎭 ❌ Language select element not found during load');
      }
      
    } catch (error) {
      console.error('🎭 ❌ Failed to load language settings:', error);
    }
  }

  async saveLanguageSettings() {
    console.log('🎭 saveLanguageSettings function called!');
    
    try {
      if (!this.stealthLanguageSelect) {
        throw new Error('Language select element not found');
      }
      
      const selectedLanguage = this.stealthLanguageSelect.value;
      console.log('🎭 Selected language:', selectedLanguage);
      
      if (!selectedLanguage) {
        throw new Error('No language selected');
      }
      
      console.log('🎭 Saving to storage...');
      await chrome.storage.local.set({
        stealthLanguage: selectedLanguage
      });
      console.log('🎭 ✅ Saved to storage successfully');

      // Notify all Discord tabs about the language change
      try {
        console.log('🎭 Querying Discord tabs...');
        const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
        console.log('🎭 Found', tabs.length, 'Discord tabs');
        
        for (const tab of tabs) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'updateLanguageSettings',
              language: selectedLanguage
            });
            console.log('🎭 ✅ Notified tab', tab.id);
          } catch (tabError) {
            console.log('🎭 ⚠️ Could not notify tab', tab.id, ':', tabError.message);
          }
        }
      } catch (tabError) {
        // Tab messaging might fail, but settings are still saved
        console.log('🎭 ⚠️ Tab messaging failed:', tabError);
      }
      
      const languageName = this.getLanguageName(selectedLanguage);
      console.log('🎭 Language name:', languageName);
      
      this.showLanguageStatus('🎭 Language settings saved! Your encrypted messages will now appear in ' + languageName, 'success');
      console.log('🎭 ✅ Language settings save completed successfully!');
      
    } catch (error) {
      console.error('🎭 ❌ Failed to save language settings:', error);
      this.showLanguageStatus('Failed to save language settings: ' + error.message, 'error');
    }
  }

  updateLanguagePreview() {
    console.log('🎭 updateLanguagePreview called');
    console.log('🎭 languagePreview element:', !!this.languagePreview);
    console.log('🎭 stealthLanguageSelect element:', !!this.stealthLanguageSelect);
    
    if (!this.languagePreview || !this.stealthLanguageSelect) {
      console.error('🎭 ❌ Missing elements for preview update');
      return;
    }
    
    const selectedLanguage = this.stealthLanguageSelect.value;
    console.log('🎭 Selected language for preview:', selectedLanguage);
    const testMessage = "Hello World!";
    
    try {
      // Create a preview of how the message would look
      const encodedPreview = this.previewLanguageEncoding(testMessage, selectedLanguage);
      console.log('🎭 Generated preview:', encodedPreview);
      
      this.languagePreview.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="font-weight: bold; color: #00b894;">Original:</div>
          <div style="background: rgba(255, 255, 255, 0.5); padding: 8px; border-radius: 4px; font-family: monospace;">${testMessage}</div>
          <div style="font-weight: bold; color: #fd79a8;">Appears as:</div>
          <div style="background: rgba(255, 255, 255, 0.5); padding: 8px; border-radius: 4px; font-family: monospace; font-size: 16px; line-height: 1.4;">${encodedPreview}</div>
        </div>
      `;
      console.log('🎭 ✅ Preview updated successfully');
      
    } catch (error) {
      console.error('🎭 ❌ Error generating preview:', error);
      this.languagePreview.textContent = 'Error generating preview: ' + error.message;
    }
  }

  previewLanguageEncoding(text, language) {
    // Simple preview generation (not actual encryption, just demonstration)
    const base64Sample = btoa(text); // Simple base64 for preview
    
    switch (language) {
      case 'chinese':
        return this.sampleUnicodeEncoding(base64Sample, 0x4E00);
      case 'arabic':
        return this.sampleUnicodeEncoding(base64Sample, 0x0600);
      case 'japanese':
        return this.sampleUnicodeEncoding(base64Sample, 0x3040);
      case 'korean':
        return this.sampleUnicodeEncoding(base64Sample, 0xAC00);
      case 'russian':
        return this.sampleUnicodeEncoding(base64Sample, 0x0400);
      case 'thai':
        return this.sampleUnicodeEncoding(base64Sample, 0x0E00);

      case 'hindi':
        return this.sampleUnicodeEncoding(base64Sample, 0x0900);
      case 'greek':
        return this.sampleUnicodeEncoding(base64Sample, 0x0370);
      case 'georgian':
        return this.sampleUnicodeEncoding(base64Sample, 0x10A0);
      case 'armenian':
        return this.sampleUnicodeEncoding(base64Sample, 0x0530);
      case 'amharic':
        return this.sampleUnicodeEncoding(base64Sample, 0x1200);
      case 'morse':
        return this.sampleMorseEncoding(base64Sample);
      case 'braille':
        return this.sampleBrailleEncoding(base64Sample);
      case 'binary':
        return this.sampleBinaryEncoding(base64Sample);
      case 'invisible':
        return "👻 (This text would be invisible - uses zero-width characters)";
      default:
        return this.sampleUnicodeEncoding(base64Sample, 0x4E00);
    }
  }

  sampleUnicodeEncoding(base64, baseCharCode) {
    let result = '';
    for (let i = 0; i < Math.min(base64.length, 12); i++) {
      const charCode = base64.charCodeAt(i);
      const encodedCharCode = baseCharCode + (charCode - 32);
      result += String.fromCharCode(encodedCharCode);
    }
    return result + (base64.length > 12 ? '...' : '');
  }

  sampleMorseEncoding(base64) {
    const morseTable = {
      'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
      'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
      'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
      'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
      'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---'
    };
    
    let result = '';
    for (let i = 0; i < Math.min(base64.length, 8); i++) {
      const char = base64[i].toUpperCase();
      if (morseTable[char]) {
        result += morseTable[char] + ' ';
      }
    }
    return result.trim() + (base64.length > 8 ? ' ...' : '');
  }

  sampleBrailleEncoding(base64) {
    let result = '';
    for (let i = 0; i < Math.min(base64.length, 10); i++) {
      const charCode = base64.charCodeAt(i);
      const brailleCode = 0x2800 + (charCode - 32);
      result += String.fromCharCode(brailleCode);
    }
    return result + (base64.length > 10 ? '...' : '');
  }

  sampleBinaryEncoding(base64) {
    let result = '';
    for (let i = 0; i < Math.min(base64.length, 4); i++) {
      const charCode = base64.charCodeAt(i);
      const binary = charCode.toString(2).padStart(8, '0');
      result += binary + ' ';
    }
    return result.trim() + (base64.length > 4 ? ' ...' : '');
  }

  getLanguageName(languageCode) {
    const names = {
      chinese: '🇨🇳 Chinese',
      arabic: '🇸🇦 Arabic',
      japanese: '🇯🇵 Japanese',
      korean: '🇰🇷 Korean',
      russian: '🇷🇺 Russian',
      thai: '🇹🇭 Thai',
      hindi: '🇮🇳 Hindi',
      greek: '🇬🇷 Greek',
      georgian: '🇬🇪 Georgian',
      armenian: '🇦🇲 Armenian',
      amharic: '🇪🇹 Amharic',
      morse: '📡 Morse Code',
      braille: '👆 Braille',
      binary: '💻 Binary',
      invisible: '👻 Invisible Characters'
    };
    
    return names[languageCode] || names.chinese;
  }

  showLanguageStatus(message, type) {
    if (!this.languageStatus) return;
    
    this.languageStatus.textContent = message;
    this.languageStatus.className = `status ${type}`;
    this.languageStatus.style.display = 'block';
    
    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
      setTimeout(() => {
        if (this.languageStatus) {
          this.languageStatus.style.display = 'none';
        }
      }, 5000);
    }
  }

  // ==================== MEMORY SECURITY METHODS ====================

  async refreshMemoryStatus() {
    console.log('🛡️ Refreshing memory security status...');
    
    try {
      // Get Discord tabs to query memory status
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      
      if (tabs.length === 0) {
        this.showMemorySecurityStatus('No Discord tab found. Open Discord to see memory status.', 'info');
        return;
      }
      
      // Query the content script for memory status
      try {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'getMemoryStatus'
        });
        
        if (response && response.success) {
          document.getElementById('sensitive-count').textContent = response.sensitiveStrings || 0;
          document.getElementById('crypto-keys-count').textContent = response.cryptoKeys || 0;
          document.getElementById('private-keys-count').textContent = response.privateKeys || 0;
          
          this.showMemorySecurityStatus(`Memory status updated. Tracking ${response.sensitiveStrings || 0} sensitive items.`, 'success');
        } else {
          this.showMemorySecurityStatus('Unable to get memory status from Discord tab.', 'warning');
        }
        
      } catch (error) {
        this.showMemorySecurityStatus('Could not communicate with Discord tab.', 'error');
      }
      
    } catch (error) {
      console.error('🛡️ Error refreshing memory status:', error);
      this.showMemorySecurityStatus('Error refreshing memory status: ' + error.message, 'error');
    }
  }

  async secureWipeAsymmetric() {
    console.log('🛡️ Secure wipe asymmetric keys initiated...');
    
    if (!confirm('🔥 SECURE WIPE EC KEYS\n\nThis will securely destroy all EC (asymmetric) cryptographic keys from memory and storage.\n\nYour contacts will be cleared and you\'ll need to rediscover them.\n\nContinue?')) {
      return;
    }
    
    try {
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      
      if (tabs.length === 0) {
        this.showMemorySecurityStatus('No Discord tab found. Open Discord first.', 'error');
        return;
      }
      
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'secureWipeAsymmetric'
      });
      
      if (response && response.success) {
        this.showMemorySecurityStatus('✅ EC keys securely wiped from memory and storage.', 'success');
        
        // Refresh the UI after wipe
        setTimeout(async () => {
          await this.refreshMemoryStatus();
          await this.updateCurrentKeyInfo();
          await this.refreshContactsList();
        }, 1000);
      } else {
        this.showMemorySecurityStatus('❌ EC key wipe failed or incomplete.', 'error');
      }
      
    } catch (error) {
      console.error('🛡️ Error wiping EC keys:', error);
      this.showMemorySecurityStatus('Error during EC key wipe: ' + error.message, 'error');
    }
  }

  async secureWipeSymmetric() {
    console.log('🛡️ Secure wipe symmetric keys initiated...');
    
    if (!confirm('🔥 SECURE WIPE AES KEYS\n\nThis will securely destroy all AES (symmetric) cryptographic keys from memory and storage.\n\nYou\'ll need to re-enter your encryption key.\n\nContinue?')) {
      return;
    }
    
    try {
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      
      if (tabs.length === 0) {
        this.showMemorySecurityStatus('No Discord tab found. Open Discord first.', 'error');
        return;
      }
      
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'secureWipeSymmetric'
      });
      
      if (response && response.success) {
        // Also clear stored symmetric keys
        await chrome.storage.local.remove([
          'encryptionKey',
          'keyRotationBaseKey',
          'keyRotationEnabled',
          'keyRotationIntervalMs',
          'keyRotationStartTimestamp',
          'lastRotationTimestamp',
          'rotationCount'
        ]);
        
        this.showMemorySecurityStatus('✅ AES keys securely wiped from memory and storage.', 'success');
        
        // Clear the UI
        document.getElementById('encryption-key').value = '';
        document.getElementById('key-info').style.display = 'none';
        
        // Refresh status
        setTimeout(async () => {
          await this.refreshMemoryStatus();
        }, 1000);
      } else {
        this.showMemorySecurityStatus('❌ AES key wipe failed or incomplete.', 'error');
      }
      
    } catch (error) {
      console.error('🛡️ Error wiping AES keys:', error);
      this.showMemorySecurityStatus('Error during AES key wipe: ' + error.message, 'error');
    }
  }

  async nuclearWipeEverything() {
    console.log('🛡️ NUCLEAR WIPE EVERYTHING initiated...');
    
    const confirmText = '💥 NUCLEAR WIPE EVERYTHING 💥\n\n⚠️ EXTREME CAUTION REQUIRED ⚠️\n\nThis will PERMANENTLY DESTROY:\n• All encryption keys (AES + EC)\n• All contacts and user data\n• All stored settings\n• All cryptographic material\n\nTHIS ACTION CANNOT BE UNDONE!\n\nYou will need to:\n• Re-setup all encryption keys\n• Re-discover all contacts\n• Re-configure all settings\n\nOnly use this if your system is compromised.\n\nType "NUCLEAR WIPE" to confirm:';
    
    const userInput = prompt(confirmText);
    
    if (userInput !== 'NUCLEAR WIPE') {
      this.showMemorySecurityStatus('Nuclear wipe cancelled - invalid confirmation.', 'info');
      return;
    }
    
    try {
      this.showMemorySecurityStatus('💥 NUCLEAR WIPE IN PROGRESS... DO NOT CLOSE BROWSER', 'error');
      
      // Wipe via content script first
      const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
      
      if (tabs.length > 0) {
        try {
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'emergencyNuclearWipe'
          });
        } catch (error) {
          console.warn('Could not contact content script, proceeding with storage wipe...');
        }
      }
      
      // Nuclear storage wipe - everything
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
        'ecKeyCreated',
        'stealthLanguage',
        'scanFrequency',
        'initialDelay'
      ];
      
      // Multiple overwrite passes
      for (let pass = 0; pass < 5; pass++) {
        const overwriteData = {};
        for (const key of allKeys) {
          const randomSize = 4096 + Math.floor(Math.random() * 4096);
          const randomBytes = crypto.getRandomValues(new Uint8Array(randomSize));
          const randomString = Array.from(randomBytes).map(b => 
            String.fromCharCode(b)).join('');
          overwriteData[key] = randomString;
        }
        
        await chrome.storage.local.set(overwriteData);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Final deletion
      await chrome.storage.local.remove(allKeys);
      
      // Clear all UI fields
      document.getElementById('encryption-key').value = '';
      document.getElementById('key-info').style.display = 'none';
      document.getElementById('sensitive-count').textContent = '0';
      document.getElementById('crypto-keys-count').textContent = '0';
      document.getElementById('private-keys-count').textContent = '0';
      
      this.showMemorySecurityStatus('💥 NUCLEAR WIPE COMPLETED - All cryptographic material destroyed. Refresh Discord to restart.', 'success');
      
    } catch (error) {
      console.error('🛡️ Error during nuclear wipe:', error);
      this.showMemorySecurityStatus('❌ Nuclear wipe failed: ' + error.message, 'error');
    }
  }

  showMemorySecurityStatus(message, type) {
    const statusDiv = document.getElementById('memory-security-status');
    if (!statusDiv) return;
    
    statusDiv.style.display = 'block';
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    
    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 5000);
    }
  }
}

// Mini version of DiscordCrypto for testing (to avoid dependency issues)
class DiscordCrypto {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
  }

  async deriveKey(password) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = encoder.encode('discord-cryptochat-salt');
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(plaintext, password) {
    const key = await this.deriveKey(password);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.algorithm,
        iv: iv
      },
      key,
      data
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(base64Ciphertext, password) {
    const key = await this.deriveKey(password);
    
    const combined = new Uint8Array(
      atob(base64Ciphertext).split('').map(char => char.charCodeAt(0))
    );
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.algorithm,
        iv: iv
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});

// Debug function to test key rotation
window.testKeyRotation = async function() {
  console.log('🧪 Testing key rotation functionality...');
  
  try {
    // Get current key info from storage
    const before = await chrome.storage.local.get(['ecMyKeyId', 'ecStaticPublicKey', 'ecKeyGenerated']);
    console.log('🧪 Before rotation:');
    console.log('  Key ID:', before.ecMyKeyId);
    console.log('  Key Generated:', before.ecKeyGenerated ? new Date(before.ecKeyGenerated).toLocaleString() : 'Unknown');
    console.log('  Public Key:', before.ecStaticPublicKey ? before.ecStaticPublicKey.substring(0, 50) + '...' : 'None');
    
    // Try to send rotation command to Discord tabs
    const tabs = await chrome.tabs.query({url: "*://discord.com/*"});
    console.log('🧪 Found', tabs.length, 'Discord tabs');
    
    if (tabs.length === 0) {
      console.log('🧪 ❌ No Discord tabs found - please open Discord first');
      return;
    }
    
    // Send rotation command
    const tab = tabs[0];
    console.log('🧪 Sending rotation command to tab', tab.id);
    
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'rotateKeys' });
    console.log('🧪 Rotation response:', response);
    
    // Wait a moment then check if keys changed
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const after = await chrome.storage.local.get(['ecMyKeyId', 'ecStaticPublicKey', 'ecKeyGenerated']);
    console.log('🧪 After rotation:');
    console.log('  Key ID:', after.ecMyKeyId);
    console.log('  Key Generated:', after.ecKeyGenerated ? new Date(after.ecKeyGenerated).toLocaleString() : 'Unknown');
    console.log('  Public Key:', after.ecStaticPublicKey ? after.ecStaticPublicKey.substring(0, 50) + '...' : 'None');
    
    // Compare
    if (before.ecMyKeyId !== after.ecMyKeyId) {
      console.log('🧪 ✅ SUCCESS: Key ID changed from', before.ecMyKeyId, 'to', after.ecMyKeyId);
    } else {
      console.log('🧪 ❌ FAILED: Key ID unchanged -', before.ecMyKeyId);
    }
    
    if (before.ecStaticPublicKey !== after.ecStaticPublicKey) {
      console.log('🧪 ✅ SUCCESS: Public key changed');
    } else {
      console.log('🧪 ❌ FAILED: Public key unchanged');
    }
    
  } catch (error) {
    //console.log('🧪 Test failed:', error);
  }
}; 