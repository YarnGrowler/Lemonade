/**
 * Discord Cryptochat - Encryption Utilities
 * Provides AES-GCM encryption/decryption functions
 */

class DiscordCrypto {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
  }

  /**
   * Derives a crypto key from a password string
   */
  async deriveKey(password) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = encoder.encode('discord-cryptochat-salt'); // Static salt for simplicity
    
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

  /**
   * Encrypts plaintext using AES-GCM
   */
  async encrypt(plaintext, password) {
    try {
      const key = await this.deriveKey(password);
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);
      
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
      
      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        data
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Return base64 encoded result
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  /**
   * Decrypts base64 encoded ciphertext using AES-GCM
   */
  async decrypt(base64Ciphertext, password) {
    try {
      const key = await this.deriveKey(password);
      
      // Decode from base64
      const combined = new Uint8Array(
        atob(base64Ciphertext).split('').map(char => char.charCodeAt(0))
      );
      
      // Extract IV and encrypted data
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
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt message - check your key');
    }
  }

  /**
   * Gets the stored encryption key from Chrome storage
   */
  async getStoredKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['encryptionKey'], (result) => {
        resolve(result.encryptionKey || null);
      });
    });
  }

  /**
   * Stores the encryption key in Chrome storage
   */
  async storeKey(key) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ encryptionKey: key }, () => {
        resolve();
      });
    });
  }

  /**
   * Tests if encryption/decryption works with the current key
   */
  async testKey(key) {
    try {
      const testMessage = "Test encryption message";
      const encrypted = await this.encrypt(testMessage, key);
      const decrypted = await this.decrypt(encrypted, key);
      return decrypted === testMessage;
    } catch (error) {
      return false;
    }
  }
}

// Global instance
const discordCrypto = new DiscordCrypto(); 