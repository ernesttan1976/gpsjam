console.log('Aviation Data Scraper: Background script loaded');

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('BACKGROUND: Message received:', message.type);
  
  if (message.type === 'INJECT_MAIN_WORLD') {
    // Inject script into main world to bypass CSP
    console.log('BACKGROUND: Injecting script into main world...');
    
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      func: () => {
        console.log('MAIN WORLD: Script injected successfully');
        console.log('MAIN WORLD: fetch type:', typeof window.fetch);
        
        // Store original fetch
        const originalFetch = window.fetch;
        
        // Override fetch
        window.fetch = async function(...args) {
          const [resource, config] = args;
          const url = typeof resource === 'string' ? resource : resource.url;
          
          console.log('MAIN WORLD: Fetch intercepted:', url);
          
          try {
            const response = await originalFetch.apply(this, args);
            
            if (url.includes('/db-api/spoofing_2p') || url.includes('/db-api/jammed_agg')) {
              console.log('MAIN WORLD: 🎯 Target URL intercepted:', url);
              
              try {
                const clonedResponse = response.clone();
                const responseText = await clonedResponse.text();
                const data = JSON.parse(responseText);
                
                console.log('MAIN WORLD: ✅ Data intercepted:', Array.isArray(data) ? data.length : 'object');
                
                // Store in window for content script to access
                window.__INTERCEPTED_DATA__ = {
                  type: url.includes('/db-api/spoofing_2p') ? 'SPOOFING_DATA' : 'JAMMING_DATA',
                  data: data,
                  url: url,
                  timestamp: new Date().toISOString()
                };
                
                // Dispatch custom event
                window.dispatchEvent(new CustomEvent('dataIntercepted', {
                  detail: window.__INTERCEPTED_DATA__
                }));
                
              } catch (e) {
                console.error('MAIN WORLD: Error processing response:', e);
              }
            }
            
            return response;
          } catch (e) {
            console.error('MAIN WORLD: Fetch error:', e);
            throw e;
          }
        };
        
        console.log('MAIN WORLD: ✅ Fetch interceptor installed');
      }
    }, (result) => {
      if (chrome.runtime.lastError) {
        console.error('BACKGROUND: Main world injection failed:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('BACKGROUND: ✅ Main world injection successful');
        sendResponse({ success: true });
      }
    });
    
    return true; // Keep message channel open
  }
  
  // Handle data messages
  if (message.type === 'SPOOFING_DATA' || message.type === 'JAMMING_DATA') {
    console.log('BACKGROUND: Processing data:', message.type, 'via', message.method);
    console.log('BACKGROUND: Data size:', Array.isArray(message.data) ? message.data.length : typeof message.data);
    
    const storageKey = message.type === 'SPOOFING_DATA' ? 'spoofingData' : 'jammingData';
    const timestampKey = message.type === 'SPOOFING_DATA' ? 'spoofingTimestamp' : 'jammingTimestamp';
    const urlKey = message.type === 'SPOOFING_DATA' ? 'spoofingUrl' : 'jammingUrl';
    
    chrome.storage.local.set({
      [storageKey]: message.data,
      [timestampKey]: message.timestamp,
      [urlKey]: message.url,
      [`${storageKey}Method`]: message.method
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('BACKGROUND: Storage error:', chrome.runtime.lastError);
      } else {
        console.log('BACKGROUND: ✅ Data stored successfully');
      }
    });
    
    sendResponse({ success: true });
  }
  
  return true;
});

console.log('BACKGROUND: Script initialization complete');