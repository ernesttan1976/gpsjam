console.log('=== CONTENT SCRIPT STARTING (CSP-SAFE) ===');
console.log('CONTENT: Current URL:', window.location.href);

// Since we can't inject inline scripts due to CSP, we'll use a different approach
// We'll monitor for network requests using the Performance API and Observer patterns

let interceptedData = new Map();

// Method 1: Monitor Performance Entries
function monitorPerformanceEntries() {
  console.log('CONTENT: Setting up performance monitoring...');
  
  // Monitor existing entries
  const entries = performance.getEntriesByType('resource');
  entries.forEach(entry => {
    if (entry.name.includes('/db-api/spoofing_2p') || entry.name.includes('/db-api/jammed_agg')) {
      console.log('CONTENT: Found existing target resource:', entry.name);
    }
  });
  
  // Monitor new entries
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name.includes('/db-api/spoofing_2p') || entry.name.includes('/db-api/jammed_agg')) {
        console.log('CONTENT: 🎯 Target resource detected via Performance API:', entry.name);
        console.log('CONTENT: Resource timing:', {
          duration: entry.duration,
          responseStart: entry.responseStart,
          responseEnd: entry.responseEnd,
          transferSize: entry.transferSize
        });
        
        // Try to fetch the same URL to get the response
        attemptDataFetch(entry.name);
      }
    }
  });
  
  try {
    observer.observe({ entryTypes: ['resource'] });
    console.log('CONTENT: ✅ Performance observer active');
  } catch (e) {
    console.error('CONTENT: ❌ Performance observer failed:', e);
  }
}

// Method 2: Direct fetch attempts
async function attemptDataFetch(url) {
  console.log('CONTENT: Attempting direct fetch of:', url);
  
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    console.log('CONTENT: Direct fetch response status:', response.status);
    
    if (response.ok) {
      const responseText = await response.text();
      console.log('CONTENT: Direct fetch response length:', responseText.length);
      
      try {
        const data = JSON.parse(responseText);
        console.log('CONTENT: ✅ Direct fetch JSON parsed successfully');
        console.log('CONTENT: Data type:', Array.isArray(data) ? 'Array' : 'Object');
        console.log('CONTENT: Data size:', Array.isArray(data) ? data.length : Object.keys(data).length);
        
        const messageType = url.includes('/db-api/spoofing_2p') ? 'SPOOFING_DATA' : 'JAMMING_DATA';
        
        // Send to background
        chrome.runtime.sendMessage({
          type: messageType,
          data: data,
          timestamp: new Date().toISOString(),
          url: url,
          method: 'direct_fetch'
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('CONTENT: Message error:', chrome.runtime.lastError);
          } else {
            console.log('CONTENT: ✅ Data sent to background via direct fetch');
          }
        });
        
      } catch (parseError) {
        console.error('CONTENT: JSON parse error in direct fetch:', parseError);
      }
    }
  } catch (fetchError) {
    console.log('CONTENT: Direct fetch failed (expected if auth required):', fetchError.message);
  }
}

// Method 3: Use Chrome's scripting API to inject into main world
async function injectIntoMainWorld() {
  console.log('CONTENT: Requesting main world injection...');
  
  try {
    // Send message to background to inject script into main world
    chrome.runtime.sendMessage({
      type: 'INJECT_MAIN_WORLD',
      tabId: 'current'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('CONTENT: Main world injection request failed:', chrome.runtime.lastError);
      } else {
        console.log('CONTENT: Main world injection requested');
      }
    });
  } catch (e) {
    console.error('CONTENT: Error requesting main world injection:', e);
  }
}

// Method 4: Monitor DOM for data containers
function monitorDOMForData() {
  console.log('CONTENT: Setting up DOM monitoring...');
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          // Look for JSON-like structures
          if (text.includes('"') && (text.includes('latitude') || text.includes('longitude') || text.includes('timestamp'))) {
            console.log('CONTENT: Potential data found in DOM:', text.substring(0, 100));
            
            try {
              const data = JSON.parse(text);
              if (Array.isArray(data) && data.length > 0) {
                console.log('CONTENT: ✅ Valid data array found in DOM');
                
                // Try to determine type based on structure
                const firstItem = data[0];
                let messageType = 'UNKNOWN_DATA';
                
                if (firstItem && typeof firstItem === 'object') {
                  if ('spoofing' in firstItem || 'spoof' in firstItem) {
                    messageType = 'SPOOFING_DATA';
                  } else if ('jamming' in firstItem || 'jammed' in firstItem) {
                    messageType = 'JAMMING_DATA';
                  }
                }
                
                chrome.runtime.sendMessage({
                  type: messageType,
                  data: data,
                  timestamp: new Date().toISOString(),
                  url: window.location.href,
                  method: 'dom_monitoring'
                });
              }
            } catch (e) {
              // Not JSON, ignore
            }
          }
        }
      });
    });
  });
  
  observer.observe(document, {
    childList: true,
    subtree: true,
    characterData: true
  });
  
  console.log('CONTENT: ✅ DOM observer active');
}

// Method 5: Try to access window variables that might contain data
function checkWindowVariables() {
  console.log('CONTENT: Checking window variables...');
  
  // Common variable names that might contain data
  const possibleVarNames = [
    'spoofingData',
    'jammingData',
    'apiData',
    'chartData',
    'mapData',
    'data',
    '__INITIAL_STATE__',
    '__DATA__'
  ];
  
  possibleVarNames.forEach(varName => {
    try {
      if (window[varName]) {
        console.log(`CONTENT: Found window.${varName}:`, typeof window[varName]);
        if (Array.isArray(window[varName]) && window[varName].length > 0) {
          console.log(`CONTENT: ✅ ${varName} contains array with ${window[varName].length} items`);
        }
      }
    } catch (e) {
      // Variable doesn't exist or can't access
    }
  });
}

// Initialize all monitoring methods
console.log('CONTENT: Initializing monitoring methods...');

monitorPerformanceEntries();
monitorDOMForData();
checkWindowVariables();
injectIntoMainWorld();

// Periodic checks
setInterval(() => {
  checkWindowVariables();
}, 5000);

console.log('=== CONTENT SCRIPT LOADED ===');