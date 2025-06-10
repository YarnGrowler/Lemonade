/**
 * Lemonade - Discord Encryption
 * Popup Logic - Handles extension status display and quick actions
 * 🍋 Sweet & Secure Discord Encryption
 */

class PopupManager {
  constructor() {
    this.extensionStatusEl = document.getElementById('extension-status');
    this.extensionIndicatorEl = document.getElementById('extension-indicator');
    this.keyStatusEl = document.getElementById('key-status');
    this.keyIndicatorEl = document.getElementById('key-indicator');
    this.currentUserStatusEl = document.getElementById('current-user-status');
    this.userIndicatorEl = document.getElementById('user-indicator');
    this.autoEncryptStatusEl = document.getElementById('auto-encrypt-status');
    this.autoEncryptToggleEl = document.getElementById('auto-encrypt-toggle');
    this.openOptionsBtn = document.getElementById('open-options');
    this.setUserIdBtn = document.getElementById('set-user-id');
    this.testEncryptionBtn = document.getElementById('test-encryption');
    this.viewChangelogBtn = document.getElementById('view-changelog');
    
    this.init();
  }

  async init() {
    this.loadVersion();
    await this.checkStatus();
    this.setupEventListeners();
  }

  loadVersion() {
    // Get version from manifest
    const manifest = chrome.runtime.getManifest();
    const versionEl = document.getElementById('version');
    if (versionEl) {
      versionEl.textContent = manifest.version;
    }
  }

  async checkStatus() {
    try {
      // Check if extension is active
      this.extensionStatusEl.textContent = 'Active';
      this.extensionIndicatorEl.className = 'status-indicator active';

      // Check encryption key, current user, and auto-encrypt status
      const result = await chrome.storage.local.get(['encryptionKey', 'autoEncryptEnabled', 'currentUserId', 'currentUsername']);
      
      if (result.encryptionKey) {
        this.keyStatusEl.textContent = 'Set';
        this.keyIndicatorEl.className = 'status-indicator active';
      } else {
        this.keyStatusEl.textContent = 'Not Set';
        this.keyIndicatorEl.className = 'status-indicator inactive';
      }

      // Update current user status
      if (result.currentUserId && result.currentUsername) {
        this.currentUserStatusEl.textContent = result.currentUsername;
        this.userIndicatorEl.className = 'status-indicator active';
      } else {
        this.currentUserStatusEl.textContent = 'Not Set';
        this.userIndicatorEl.className = 'status-indicator inactive';
      }

      // Update auto-encrypt status
      const autoEncryptEnabled = result.autoEncryptEnabled || false;
      this.autoEncryptStatusEl.textContent = autoEncryptEnabled ? 'On' : 'Off';
      this.autoEncryptToggleEl.checked = autoEncryptEnabled;
      
    } catch (error) {
      //console.log('Failed to check status:', error);
      this.extensionStatusEl.textContent = 'Error';
      this.extensionIndicatorEl.className = 'status-indicator inactive';
      this.keyStatusEl.textContent = 'Error';
      this.keyIndicatorEl.className = 'status-indicator inactive';
      this.autoEncryptStatusEl.textContent = 'Error';
    }
  }

  setupEventListeners() {
    this.openOptionsBtn.addEventListener('click', () => {
      this.openOptions();
    });

    this.setUserIdBtn.addEventListener('click', async () => {
      await this.setUserId();
    });

    this.testEncryptionBtn.addEventListener('click', async () => {
      await this.testEncryption();
    });

    this.autoEncryptToggleEl.addEventListener('change', async () => {
      await this.toggleAutoEncrypt();
    });

    this.viewChangelogBtn.addEventListener('click', () => {
      this.showChangelog();
    });
  }

  async toggleAutoEncrypt() {
    try {
      const isEnabled = this.autoEncryptToggleEl.checked;
      await chrome.storage.local.set({ autoEncryptEnabled: isEnabled });
      
      this.autoEncryptStatusEl.textContent = isEnabled ? 'On' : 'Off';
      
      // Notify content script of the change
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.includes('discord.com')) {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'updateAutoEncrypt', 
            enabled: isEnabled 
          });
        }
      } catch (error) {
        //console.log('Could not notify content script:', error);
      }
      
      this.showNotification(`Auto-encrypt ${isEnabled ? 'enabled' : 'disabled'}`, 'success');
      
    } catch (error) {
      //console.log('Failed to toggle auto-encrypt:', error);
      this.showNotification('Failed to update setting', 'error');
    }
  }

  async setUserId() {
    try {
      // Simple prompt for user ID
      const userId = prompt('Enter your Discord User ID:\n(You can find this in your avatar URL or Discord settings)');
      
      if (!userId || !userId.trim()) {
        return; // User cancelled or entered empty string
      }
      
      const trimmedUserId = userId.trim();
      
      // Validate that it looks like a Discord user ID (numeric, reasonable length)
      if (!/^\d{17,19}$/.test(trimmedUserId)) {
        this.showNotification('Invalid user ID format. Should be 17-19 digits.', 'error');
        return;
      }
      
      // Get username prompt
      const username = prompt('Enter your Discord username (for display):') || 'User';
      
      // Save to storage
      await chrome.storage.local.set({
        currentUserId: trimmedUserId,
        currentUsername: username.trim()
      });
      
      // Update UI
      this.currentUserStatusEl.textContent = username.trim();
      this.userIndicatorEl.className = 'status-indicator active';
      
      // Notify content script to update current user
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.includes('discord.com')) {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'updateCurrentUser', 
            userId: trimmedUserId,
            username: username.trim()
          });
        }
      } catch (error) {
        //console.log('Could not notify content script:', error);
      }
      
      this.showNotification(`User set: ${username.trim()}`, 'success');
      
    } catch (error) {
      //console.log('Failed to set user ID:', error);
      this.showNotification('Failed to set user ID', 'error');
    }
  }

  openOptions() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options.html')
    });
    window.close();
  }

  async testEncryption() {
    try {
      this.testEncryptionBtn.textContent = '🧪 Testing...';
      this.testEncryptionBtn.disabled = true;

      // Get the stored key
      const result = await chrome.storage.local.get(['encryptionKey']);
      if (!result.encryptionKey) {
        this.showNotification('No encryption key set! Please configure it first.', 'error');
        return;
      }

      // Perform encryption test
      const testResult = await this.performEncryptionTest(result.encryptionKey);
      
      if (testResult.success) {
        this.showNotification('✅ Encryption test successful!', 'success');
      } else {
        this.showNotification(`❌ Test failed: ${testResult.error}`, 'error');
      }

    } catch (error) {
      //console.log('Test failed:', error);
      this.showNotification('❌ Test failed unexpectedly', 'error');
    } finally {
      this.testEncryptionBtn.textContent = '🧪 Test Encryption';
      this.testEncryptionBtn.disabled = false;
    }
  }

  async performEncryptionTest(key) {
    try {
      const testCrypto = new DiscordCrypto();
      const testMessage = `Test message ${Date.now()}`;
      
      const encrypted = await testCrypto.encrypt(testMessage, key);
      if (!encrypted || typeof encrypted !== 'string') {
        return { success: false, error: 'Encryption returned invalid result' };
      }

      const decrypted = await testCrypto.decrypt(encrypted, key);
      if (decrypted !== testMessage) {
        return { success: false, error: 'Decrypted message does not match original' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#48bb78' : '#ff6b6b'};
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      max-width: 280px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  showChangelog() {
    const changelogModal = document.createElement('div');
    changelogModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
    `;

    const changelogContent = document.createElement('div');
    changelogContent.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      position: relative;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    `;

    changelogContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 style="margin: 0; font-size: 20px;">🎉 What's New in v2.1.0</h2>
        <button id="close-changelog" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
        ">✕</button>
      </div>
      
      <div style="line-height: 1.6;">
        <h3 style="color: #48bb78; margin: 16px 0 8px 0;">🎬 GIF Encryption Revolution</h3>
        <ul style="margin: 0; padding-left: 20px;">
          <li><strong>GIF Picker Integration:</strong> Encrypt GIFs directly from Discord's picker!</li>
          <li><strong>Smart Detection:</strong> Only encrypts actual GIFs, skips categories</li>
          <li><strong>Interactive Modals:</strong> Click any GIF to view in beautiful popup</li>
          <li><strong>Large Emojis:</strong> Single emojis render extra large automatically</li>
        </ul>

        <h3 style="color: #667eea; margin: 16px 0 8px 0;">⚡ Performance & Experience</h3>
        <ul style="margin: 0; padding-left: 20px;">
          <li><strong>Massive Optimization:</strong> Commented out 200+ debug logs</li>
          <li><strong>Responsive Sizing:</strong> GIFs now fit their actual dimensions</li>
          <li><strong>Better Rendering:</strong> MP4 videos play seamlessly as GIFs</li>
          <li><strong>Enhanced UI:</strong> Smooth animations and improved feedback</li>
        </ul>

        <h3 style="color: #ff6b6b; margin: 16px 0 8px 0;">🛠️ Technical Advances</h3>
        <ul style="margin: 0; padding-left: 20px;">
          <li><strong>Network Interception:</strong> Captures Discord's GIF API calls</li>
          <li><strong>Asymmetric Encryption:</strong> Advanced EC P-256 with key rotation</li>
          <li><strong>Contact Discovery:</strong> Automatic user detection and management</li>
          <li><strong>Memory Optimization:</strong> Reduced CPU usage and responsiveness</li>
        </ul>

        <div style="
          background: rgba(255,255,255,0.1);
          padding: 12px;
          border-radius: 8px;
          margin-top: 16px;
          text-align: center;
        ">
          🎯 <strong>Try GIF encryption!</strong><br>
          Open Discord's GIF picker and click any GIF<br>
          It gets encrypted and sent automatically! 🎉
        </div>
      </div>
    `;

    changelogModal.appendChild(changelogContent);
    document.body.appendChild(changelogModal);

    // Close functionality
    document.getElementById('close-changelog').addEventListener('click', () => {
      changelogModal.remove();
    });

    changelogModal.addEventListener('click', (e) => {
      if (e.target === changelogModal) {
        changelogModal.remove();
      }
    });
  }
}

// Mini version of DiscordCrypto for testing
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
  new PopupManager();
}); 