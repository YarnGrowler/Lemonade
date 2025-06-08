/**
 * Debug script for testing asymmetric encryption
 * Run in Discord console to test the asymmetric system
 */

window.debugAsymmetric = {
  
  // Check system status
  checkStatus() {
    console.log('🔐 [DEBUG] === ASYMMETRIC SYSTEM STATUS ===');
    console.log('🔐 [DEBUG] Main extension available:', !!window.discordCryptochat);
    console.log('🔐 [DEBUG] ECCrypto available:', !!window.ecCrypto);
    console.log('🔐 [DEBUG] ECMessageProcessor available:', !!window.ecMessageProcessor);
    console.log('🔐 [DEBUG] AsymmetricContentIntegration class available:', !!window.AsymmetricContentIntegration);
    
    if (window.discordCryptochat) {
      console.log('🔐 [DEBUG] Main extension asymmetric object:', !!window.discordCryptochat.asymmetric);
      console.log('🔐 [DEBUG] encryptAsymmetricMessage method:', typeof window.discordCryptochat.encryptAsymmetricMessage);
      console.log('🔐 [DEBUG] processAsymmetricMessage method:', typeof window.discordCryptochat.processAsymmetricMessage);
      
      if (window.discordCryptochat.asymmetric) {
        const status = window.discordCryptochat.asymmetric.getStatus();
        console.log('🔐 [DEBUG] Asymmetric status:', status);
      }
    }
    
    if (window.ecCrypto) {
      const ecStatus = window.ecCrypto.getStatus();
      console.log('🔐 [DEBUG] ECCrypto status:', ecStatus);
      
      const userList = window.ecCrypto.getUserList();
      console.log('🔐 [DEBUG] Known users:', userList);
    }
    
    console.log('🔐 [DEBUG] =============================');
  },
  
  // Force reinitialize asymmetric system
  async reinitialize() {
    console.log('🔐 [DEBUG] 🔄 Force reinitializing asymmetric system...');
    
    if (window.discordCryptochat && typeof window.discordCryptochat.initAsymmetricEncryption === 'function') {
      await window.discordCryptochat.initAsymmetricEncryption();
      
      // Check status after 3 seconds
      setTimeout(() => {
        this.checkStatus();
      }, 3000);
    } else {
      console.log('🔐 [DEBUG] ❌ Main extension not available');
    }
  },
  
  // Test encryption/decryption
  async testEncryption() {
    console.log('🔐 [DEBUG] 🧪 Testing asymmetric encryption...');
    
    if (!window.discordCryptochat || !window.discordCryptochat.asymmetric) {
      console.log('🔐 [DEBUG] ❌ Asymmetric system not available');
      return;
    }
    
    const testMessage = "Hello asymmetric world! " + Date.now();
    console.log('🔐 [DEBUG] 📝 Test message:', testMessage);
    
    try {
      // Test encryption
      const encryptResult = await window.discordCryptochat.encryptAsymmetricMessage(testMessage);
      console.log('🔐 [DEBUG] 📤 Encrypt result:', encryptResult);
      
      if (encryptResult.success) {
        console.log('🔐 [DEBUG] ✅ Encryption successful!');
        console.log('🔐 [DEBUG] 📦 Encrypted text length:', encryptResult.encryptedText.length);
        
        // Test decryption
        const decryptResult = await window.discordCryptochat.processAsymmetricMessage(encryptResult.encryptedText, null);
        console.log('🔐 [DEBUG] 📨 Decrypt result:', decryptResult);
        
        if (decryptResult.success) {
          console.log('🔐 [DEBUG] ✅ Decryption successful!');
          console.log('🔐 [DEBUG] 📝 Decrypted text:', decryptResult.decryptedText);
          console.log('🔐 [DEBUG] 🎯 Match:', decryptResult.decryptedText === testMessage);
        } else {
          console.log('🔐 [DEBUG] ❌ Decryption failed:', decryptResult.error);
        }
      } else {
        console.log('🔐 [DEBUG] ❌ Encryption failed:', encryptResult.error);
      }
    } catch (error) {
      console.log('🔐 [DEBUG] ❌ Test failed:', error);
    }
  },
  
  // Quick commands
  help() {
    console.log('🔐 [DEBUG] Available commands:');
    console.log('debugAsymmetric.checkStatus() - Check system status');
    console.log('debugAsymmetric.reinitialize() - Force reinitialize');
    console.log('debugAsymmetric.testEncryption() - Test encrypt/decrypt');
    console.log('debugAsymmetric.help() - Show this help');
  },

  // Check current status
  checkCurrentStatus() {
    console.log('🔐 [DEBUG] === ASYMMETRIC DEBUG STATUS ===');
    
    if (window.ecCrypto) {
      console.log('🔐 [DEBUG] ECCrypto available:', true);
      console.log('🔐 [DEBUG] Current user:', window.ecCrypto.getCurrentUser());
      console.log('🔐 [DEBUG] User keys count:', window.ecCrypto.userKeys?.size || 0);
      console.log('🔐 [DEBUG] My Key ID:', window.ecCrypto.myKeyId);
      
      if (window.ecCrypto.userKeys && window.ecCrypto.userKeys.size > 0) {
        console.log('🔐 [DEBUG] Stored user keys:');
        for (const [userId, userInfo] of window.ecCrypto.userKeys) {
          console.log(`  - ${userId}: ${userInfo.username} (Key ID: ${userInfo.keyId})`);
        }
      }
    } else {
      console.log('🔐 [DEBUG] ECCrypto not available');
    }
    
    if (window.ecMessageProcessor) {
      console.log('🔐 [DEBUG] ECMessageProcessor available:', true);
    } else {
      console.log('🔐 [DEBUG] ECMessageProcessor not available');
    }
    
    if (discordCryptochat?.asymmetric) {
      console.log('🔐 [DEBUG] AsymmetricContentIntegration available:', true);
      console.log('🔐 [DEBUG] Asymmetric initialized:', discordCryptochat.asymmetric.isInitialized);
    } else {
      console.log('🔐 [DEBUG] AsymmetricContentIntegration not available');
    }
  },

  // Force regenerate unique keys
  async regenerateKeys() {
    console.log('🔐 [DEBUG] 🔄 Regenerating unique keypair...');
    
    if (!window.ecCrypto) {
      console.log('🔐 [DEBUG] ❌ ECCrypto not available');
      return;
    }
    
    try {
      // Clear existing keys
      await chrome.storage.local.remove(['ecStaticPrivateKey', 'ecStaticPublicKey', 'ecMyKeyId']);
      
      // Generate new unique keypair
      await window.ecCrypto.generateStaticKeypair();
      
      console.log('🔐 [DEBUG] ✅ New unique keypair generated!');
      console.log('🔐 [DEBUG] New Key ID:', window.ecCrypto.myKeyId);
      
      // Clear stored user keys to force re-discovery
      await window.ecCrypto.clearAllUsers();
      
      console.log('🔐 [DEBUG] 🧹 Cleared all stored user keys for fresh start');
      
    } catch (error) {
      console.log('🔐 [DEBUG] ❌ Failed to regenerate keys:', error);
    }
  },

  // Reinitialize the system
  async reinitializeSystem() {
    console.log('🔐 [DEBUG] 🔄 Reinitializing asymmetric system...');
    
    if (discordCryptochat && typeof discordCryptochat.initAsymmetricEncryption === 'function') {
      discordCryptochat.initAsymmetricEncryption();
      console.log('🔐 [DEBUG] ✅ Reinitialization triggered');
      
      setTimeout(() => {
        this.checkCurrentStatus();
      }, 2000);
    } else {
      console.log('🔐 [DEBUG] ❌ Cannot reinitialize - discordCryptochat not available');
    }
  },

  // Test encryption with current setup
  async testEncryptionWithCurrentSetup() {
    console.log('🔐 [DEBUG] 🧪 Testing encryption...');
    
    if (!discordCryptochat) {
      console.log('🔐 [DEBUG] ❌ discordCryptochat not available');
      return;
    }
    
    try {
      const testMessage = "Debug test message " + Date.now();
      console.log('🔐 [DEBUG] Original message:', testMessage);
      
      if (discordCryptochat.encryptAsymmetricMessage) {
        const result = await discordCryptochat.encryptAsymmetricMessage(testMessage);
        console.log('🔐 [DEBUG] Encryption result:', result);
        
        if (result.success) {
          console.log('🔐 [DEBUG] ✅ Encryption successful!');
          console.log('🔐 [DEBUG] Encrypted length:', result.encryptedText.length);
        } else {
          console.log('🔐 [DEBUG] ❌ Encryption failed');
        }
      } else {
        console.log('🔐 [DEBUG] ❌ encryptAsymmetricMessage not available');
      }
      
    } catch (error) {
      console.log('🔐 [DEBUG] ❌ Test encryption failed:', error);
    }
  },

  // Set current user manually for testing
  async setUser(userId, username) {
    console.log('🔐 [DEBUG] 👤 Setting current user:', username, '(ID:', userId + ')');
    
    if (!window.ecCrypto) {
      console.log('🔐 [DEBUG] ❌ ECCrypto not available');
      return;
    }
    
    try {
      await window.ecCrypto.setCurrentUser(userId, username);
      console.log('🔐 [DEBUG] ✅ Current user set successfully');
      
      // Also update in content script
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updateCurrentUser',
            userId: userId,
            username: username
          });
        });
      }
      
    } catch (error) {
      console.log('🔐 [DEBUG] ❌ Failed to set user:', error);
    }
  }
};

// Show help on load
console.log('🔐 [DEBUG] Asymmetric debug tool loaded!');
console.log('🔐 [DEBUG] Type debugAsymmetric.help() for commands'); 