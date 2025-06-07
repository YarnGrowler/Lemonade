/**
 * Discord Cryptochat - Options Page Logic
 * Handles encryption key management and testing
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

    // Debug elements
    this.debugSyncButton = document.getElementById('debug-sync');
    this.debugOutput = document.getElementById('debug-output');
    
    this.init();
  }

  async init() {
    await this.loadStoredKey();
    await this.loadKeyRotationSettings();
    await this.loadSpeedSettings();
    this.setupEventListeners();
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
      console.error('Failed to load stored key:', error);
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

    // Key rotation event listeners
    this.enableRotationCheckbox.addEventListener('change', () => {
      this.toggleRotationSettings();
    });

    this.rotationIntervalSelect.addEventListener('change', () => {
      this.handleIntervalChange();
    });

    this.setupRotationButton.addEventListener('click', async () => {
      await this.setupKeyRotation();
    });

    // Sync event listeners
    this.generateSyncButton.addEventListener('click', async () => {
      await this.generateSyncCode();
    });

    this.copySyncButton.addEventListener('click', async () => {
      await this.copySyncCode();
    });

    this.applySyncButton.addEventListener('click', async () => {
      await this.applySyncCode();
    });

    // Speed settings event listeners
    this.saveSpeedButton.addEventListener('click', async () => {
      await this.saveSpeedSettings();
    });

    // Debug event listeners
    this.debugSyncButton.addEventListener('click', async () => {
      await this.debugSyncKeys();
    });
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
      console.error('Failed to save key:', error);
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
      console.error('Test failed:', error);
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
      console.error('Failed to generate key fingerprint:', error);
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
      console.error('Failed to load key rotation settings:', error);
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
      console.error('Failed to setup key rotation:', error);
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
    
    console.log(`🔐 [CRYPTO] 🔄 Key rotation setup: ${intervalMs}ms intervals, tracking reset`);
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
      console.error('Failed to update rotation status:', error);
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
      console.error('Failed to generate sync code:', error);
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
      console.error('Failed to copy sync code:', error);
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
      console.error('Failed to apply sync code:', error);
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
      console.error('Failed to load speed settings:', error);
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
        console.log('Tab messaging not available in options page context');
      }

      this.speedStatus.textContent = `✅ Saved: ${scanFrequency}ms scan, ${initialDelay}ms initial delay`;
      this.speedStatus.style.color = '#28a745';
      
      // Reset color after 3 seconds
      setTimeout(() => {
        this.speedStatus.style.color = '#666';
      }, 3000);

    } catch (error) {
      console.error('Failed to save speed settings:', error);
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
      console.error('Debug failed:', error);
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