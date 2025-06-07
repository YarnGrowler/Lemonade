/**
 * Discord Cryptochat - Popup Logic
 * Handles extension status display and quick actions
 */

class PopupManager {
  constructor() {
    this.extensionStatusEl = document.getElementById('extension-status');
    this.extensionIndicatorEl = document.getElementById('extension-indicator');
    this.keyStatusEl = document.getElementById('key-status');
    this.keyIndicatorEl = document.getElementById('key-indicator');
    this.openOptionsBtn = document.getElementById('open-options');
    this.testEncryptionBtn = document.getElementById('test-encryption');
    
    this.init();
  }

  async init() {
    await this.checkStatus();
    this.setupEventListeners();
  }

  async checkStatus() {
    try {
      // Check if extension is active
      this.extensionStatusEl.textContent = 'Active';
      this.extensionIndicatorEl.className = 'status-indicator active';

      // Check encryption key status
      const result = await chrome.storage.local.get(['encryptionKey']);
      if (result.encryptionKey) {
        this.keyStatusEl.textContent = 'Set';
        this.keyIndicatorEl.className = 'status-indicator active';
      } else {
        this.keyStatusEl.textContent = 'Not Set';
        this.keyIndicatorEl.className = 'status-indicator inactive';
      }
    } catch (error) {
      console.error('Failed to check status:', error);
      this.extensionStatusEl.textContent = 'Error';
      this.extensionIndicatorEl.className = 'status-indicator inactive';
      this.keyStatusEl.textContent = 'Error';
      this.keyIndicatorEl.className = 'status-indicator inactive';
    }
  }

  setupEventListeners() {
    this.openOptionsBtn.addEventListener('click', () => {
      this.openOptions();
    });

    this.testEncryptionBtn.addEventListener('click', async () => {
      await this.testEncryption();
    });
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
      console.error('Test failed:', error);
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