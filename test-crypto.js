/**
 * Simple test script for the simplified crypto system
 */

console.log('🔐 [TEST] Starting crypto system test...');

// Test the simplified encryption flow
async function testSimplifiedCrypto() {
  try {
    console.log('🔐 [TEST] 1. Testing ECCrypto initialization...');
    
    // Wait for ECCrypto to be ready
    await new Promise(resolve => {
      const checkReady = () => {
        if (window.ecCrypto && window.ecCrypto.staticPublicKey) {
          console.log('🔐 [TEST] ✅ ECCrypto is ready');
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
    
    console.log('🔐 [TEST] 2. Testing message encryption...');
    const testMessage = 'Hello simplified crypto world!';
    
    // Test encryption
    const encryptResult = await window.ecCrypto.encrypt(testMessage);
    console.log('🔐 [TEST] ✅ Encryption result:', {
      encrypted: encryptResult.encrypted.substring(0, 50) + '...',
      keyUsed: encryptResult.keyUsed,
      keyId: encryptResult.keyId
    });
    
    console.log('🔐 [TEST] 3. Testing message decryption...');
    
    // Test decryption
    const decryptResult = await window.ecCrypto.decrypt(
      encryptResult.encrypted,
      encryptResult.senderPublicKey
    );
    
    console.log('🔐 [TEST] ✅ Decryption result:', decryptResult);
    
    if (decryptResult === testMessage) {
      console.log('🔐 [TEST] ✅ ROUND-TRIP ENCRYPTION/DECRYPTION SUCCESS!');
    } else {
      console.log('🔐 [TEST] ❌ Round-trip failed - messages don\'t match');
    }
    
    console.log('🔐 [TEST] 4. Testing ECMessageProcessor...');
    
    // Wait for ECMessageProcessor
    await new Promise(resolve => {
      const checkProcessor = () => {
        if (window.ecMessageProcessor && window.ecMessageProcessor.isEnabled) {
          console.log('🔐 [TEST] ✅ ECMessageProcessor is ready');
          resolve();
        } else {
          setTimeout(checkProcessor, 100);
        }
      };
      checkProcessor();
    });
    
    console.log('🔐 [TEST] 5. Testing message encoding/decoding...');
    
    // Test full message processing
    const chineseMessage = await window.ecMessageProcessor.encryptMessage(testMessage);
    console.log('🔐 [TEST] ✅ Chinese encoded message length:', chineseMessage.length);
    
    const decodedMessage = await window.ecMessageProcessor.decryptMessage(chineseMessage);
    console.log('🔐 [TEST] ✅ Decoded message:', decodedMessage);
    
    if (decodedMessage === testMessage) {
      console.log('🔐 [TEST] ✅ FULL MESSAGE PROCESSING SUCCESS!');
    } else {
      console.log('🔐 [TEST] ❌ Full processing failed');
    }
    
    console.log('🔐 [TEST] 6. Testing user key storage...');
    
    // Test user key addition
    const testUserId = 'test_user_123';
    const testUsername = 'TestUser';
    
    window.ecCrypto.addUserKey(testUserId, encryptResult.senderPublicKey, testUsername);
    
    const storedKey = window.ecCrypto.getUserKey(testUserId);
    if (storedKey === encryptResult.senderPublicKey) {
      console.log('🔐 [TEST] ✅ User key storage SUCCESS!');
    } else {
      console.log('🔐 [TEST] ❌ User key storage failed');
    }
    
    console.log('🔐 [TEST] 7. Testing encryption with stored user key...');
    
    // Test encryption for specific user
    const userEncryptResult = await window.ecCrypto.encrypt('Message for specific user', testUserId);
    console.log('🔐 [TEST] ✅ User-specific encryption success, strategy:', userEncryptResult.keyUsed);
    
    console.log('🔐 [TEST] 8. Getting system status...');
    
    const ecStatus = window.ecCrypto.getStatus();
    const processorStatus = window.ecMessageProcessor.getStatus();
    
    console.log('🔐 [TEST] 📊 ECCrypto status:', ecStatus);
    console.log('🔐 [TEST] 📊 Processor status:', processorStatus);
    
    console.log('🔐 [TEST] ✅ ALL TESTS COMPLETED SUCCESSFULLY!');
    
    // Show summary
    const userList = window.ecCrypto.getUserList();
    console.log('🔐 [TEST] 📋 Final user count:', userList.length);
    userList.forEach(user => {
      console.log('🔐 [TEST] 👤 User:', user.userId, '-', user.username, '- Key ID:', user.keyId);
    });
    
  } catch (error) {
    console.error('🔐 [TEST] ❌ Test failed:', error);
  }
}

// Run test when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(testSimplifiedCrypto, 2000);
  });
} else {
  setTimeout(testSimplifiedCrypto, 2000);
}

// Global test function for manual testing
window.testCrypto = testSimplifiedCrypto; 