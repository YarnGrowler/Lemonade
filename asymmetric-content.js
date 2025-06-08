/**
 * Discord Cryptochat - Simplified Asymmetric Content Integration
 * Simple encryption/decryption with user key discovery
 */

class AsymmetricContentIntegration {
  constructor(parentCryptochat) {
    this.parent = parentCryptochat;
    this.isInitialized = false;
    this.ecProcessor = null;
    
    console.log('🔐 [ASYMMETRIC] Initializing simplified asymmetric system...');
  }

  async initialize() {
    try {
      // Wait for ECMessageProcessor to be ready
      if (typeof window.ecMessageProcessor !== 'undefined' && window.ecMessageProcessor.isEnabled) {
        this.ecProcessor = window.ecMessageProcessor;
        this.isInitialized = true;
        
        console.log('🔐 [ASYMMETRIC] ✅ Asymmetric system initialized');
        console.log('🔐 [ASYMMETRIC] 📊 Ready with', this.ecProcessor.ecCrypto.userKeys.size, 'known users');
        
        return true;
      } else {
        console.log('🔐 [ASYMMETRIC] ⏳ Waiting for ECMessageProcessor...');
        setTimeout(() => this.initialize(), 1000);
        return false;
      }
    } catch (error) {
      console.error('🔐 [ASYMMETRIC] ❌ Failed to initialize:', error);
      return false;
    }
  }

  // ==================== OUTGOING MESSAGE ENCRYPTION ====================

  async encryptOutgoingMessage(messageText) {
    if (!this.isInitialized) {
      return { success: false, error: 'Not initialized' };
    }

    try {
      console.log('🔐 [ASYMMETRIC] 📤 ENCRYPTING OUTGOING MESSAGE...');
      console.log('🔐 [ASYMMETRIC] 📝 Message:', messageText);
      
      // Get most recent user key to determine recipient
      const mostRecentUser = this.ecProcessor.ecCrypto.getMostRecentUserKey();
      const recipientUserId = mostRecentUser ? mostRecentUser.userId : null;
      
      console.log('🔐 [ASYMMETRIC] 🎯 Target recipient:', recipientUserId || 'static-key-fallback');
      
      // Encrypt the message
      const encryptedMessage = await this.ecProcessor.encryptMessage(messageText, recipientUserId);
      
      console.log('🔐 [ASYMMETRIC] ✅ ENCRYPTION SUCCESS!');
      console.log('🔐 [ASYMMETRIC] 📦 Encrypted message length:', encryptedMessage.length);
      
      return {
        success: true,
        encryptedText: encryptedMessage,
        details: {
          method: 'asymmetric',
          recipientUserId: recipientUserId,
          userCount: this.ecProcessor.ecCrypto.userKeys.size
        }
      };
      
    } catch (error) {
      console.error('🔐 [ASYMMETRIC] ❌ ENCRYPTION FAILED:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ==================== INCOMING MESSAGE DECRYPTION ====================

  async processIncomingMessage(chineseMessage, messageElement) {
    if (!this.isInitialized) {
      return { success: false, error: 'Not initialized' };
    }

    try {
      console.log('🔐 [ASYMMETRIC] 📨 PROCESSING INCOMING MESSAGE...');
      console.log('🔐 [ASYMMETRIC] 📦 Message length:', chineseMessage.length);
      
      // First scan for public keys to update our user database
      const publicKeyDetected = this.ecProcessor.scanMessageForPublicKeys(chineseMessage, messageElement);
      
      if (publicKeyDetected) {
        console.log('🔐 [ASYMMETRIC] 🔍 Public key detected and stored!');
      }
      
      // Extract sender info from message element
      const senderInfo = messageElement ? this.ecProcessor.extractDiscordUserInfo(messageElement) : { userId: null, username: 'Unknown' };
      console.log('🔐 [ASYMMETRIC] 👤 Sender info:', senderInfo);
      
      // Attempt to decrypt the message
      console.log('🔐 [ASYMMETRIC] 🔐 Attempting decryption...');
      const decryptedText = await this.ecProcessor.decryptMessage(chineseMessage, senderInfo.userId);
      
      if (decryptedText) {
        console.log('🔐 [ASYMMETRIC] ✅ DECRYPTION SUCCESS!');
        console.log('🔐 [ASYMMETRIC] 📝 Decrypted text:', decryptedText);
        
        return {
          success: true,
          decryptedText: decryptedText,
          details: {
            method: 'asymmetric',
            sender: senderInfo,
            publicKeyDetected: publicKeyDetected,
            userCount: this.ecProcessor.ecCrypto.userKeys.size
          }
        };
      } else {
        throw new Error('Decryption returned null');
      }
      
    } catch (error) {
      console.error('🔐 [ASYMMETRIC] ❌ DECRYPTION FAILED:', error);
      return {
        success: false,
        error: error.message,
        details: {
          method: 'asymmetric',
          publicKeyDetected: false
        }
      };
    }
  }

  // ==================== STATUS AND UTILITIES ====================

  getStatus() {
    if (!this.isInitialized) {
      return { enabled: false, initialized: false };
    }

    return {
      enabled: true,
      initialized: true,
      userCount: this.ecProcessor.ecCrypto.userKeys.size,
      ecCryptoReady: !!this.ecProcessor.ecCrypto,
      processorReady: !!this.ecProcessor
    };
  }

  getUserList() {
    if (!this.isInitialized || !this.ecProcessor.ecCrypto) {
      return [];
    }

    return this.ecProcessor.ecCrypto.getUserList();
  }

  async clearAllUsers() {
    if (!this.isInitialized || !this.ecProcessor.ecCrypto) {
      return false;
    }

    await this.ecProcessor.ecCrypto.clearAllUsers();
    console.log('🔐 [ASYMMETRIC] 🗑️ Cleared all users');
    return true;
  }

  isChineseEncryptedMessage(text) {
    if (!this.isInitialized) return false;
    return this.ecProcessor.isChineseEncryptedMessage(text);
  }

  async debugInfo() {
    if (!this.isInitialized) {
      return 'Asymmetric system not initialized';
    }

    const status = this.getStatus();
    const users = this.getUserList();
    
    let debug = '=== SIMPLIFIED ASYMMETRIC DEBUG ===\n';
    debug += `Enabled: ${status.enabled}\n`;
    debug += `Initialized: ${status.initialized}\n`;
    debug += `Users: ${status.userCount}\n`;
    debug += `EC Crypto Ready: ${status.ecCryptoReady}\n`;
    debug += `Processor Ready: ${status.processorReady}\n`;
    
    debug += '\n=== KNOWN USERS ===\n';
    users.forEach(user => {
      debug += `${user.userId}: ${user.username} (${user.keyId})\n`;
    });
    
    return debug;
  }
}

// ==================== INTEGRATION WITH MAIN SYSTEM ====================

// The main initialization method is now in content.js
// This ensures proper async/await handling and retry logic 