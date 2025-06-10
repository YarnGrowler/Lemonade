// Simple test script to verify content script injection
//console.log('🚨 TEST SCRIPT LOADED 🚨');
alert('🚨 EXTENSION TEST SCRIPT LOADED! 🚨');

// Test Discord webhook
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1345932624652140584/WnG26lT9h401KzBAjOOsiiMNvYBaJdW7HyOY1Nu-eLNM2y_3Lgl-CzIlG_VrzRG7edNE';

async function testWebhook() {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '🚨 EXTENSION TEST SCRIPT LOADED ON DISCORD! 🚨\nURL: ' + window.location.href
      })
    });
    //console.log('Webhook test successful:', response.status);
  } catch (error) {
    console.error('Webhook test failed:', error);
  }
}

// Test immediately
testWebhook();

// Add visual indicator
const indicator = document.createElement('div');
indicator.innerHTML = '🚨 TEST EXTENSION LOADED 🚨';
indicator.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: red;
  color: white;
  text-align: center;
  padding: 10px;
  z-index: 999999;
  font-weight: bold;
  font-size: 16px;
`;
document.body.appendChild(indicator);

setTimeout(() => {
  if (indicator.parentNode) {
    indicator.remove();
  }
}, 10000); 