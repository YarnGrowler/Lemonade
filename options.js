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
    
    this.init();
  }

  async init() {
    await this.loadStoredKey();
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