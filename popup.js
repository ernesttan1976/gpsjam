console.log('POPUP: Script loaded');

document.addEventListener('DOMContentLoaded', function() {
  console.log('POPUP: DOM ready');
  
  const downloadSpoofingBtn = document.getElementById('downloadSpoofing');
  const downloadJammingBtn = document.getElementById('downloadJamming');
  const downloadAllBtn = document.getElementById('downloadAll');
  const clearDataBtn = document.getElementById('clearData');
  
  const spoofingStatus = document.getElementById('spoofingStatus');
  const jammingStatus = document.getElementById('jammingStatus');
  const spoofingPreview = document.getElementById('spoofingPreview');
  const jammingPreview = document.getElementById('jammingPreview');
  
  let spoofingData = null;
  let jammingData = null;
  
  function updateUI() {
    console.log('POPUP: Updating UI...');
    
    chrome.storage.local.get([
      'spoofingData', 'jammingData', 
      'spoofingTimestamp', 'jammingTimestamp'
    ], function(result) {
      console.log('POPUP: Storage result:', result);
      
      // Update spoofing UI
      if (result.spoofingData && Array.isArray(result.spoofingData) && result.spoofingData.length > 0) {
        spoofingData = result.spoofingData;
        spoofingStatus.textContent = `${spoofingData.length} records captured`;
        if (result.spoofingTimestamp) {
          spoofingStatus.textContent += ` (${new Date(result.spoofingTimestamp).toLocaleTimeString()})`;
        }
        spoofingPreview.textContent = JSON.stringify(spoofingData.slice(0, 2), null, 2);
        downloadSpoofingBtn.disabled = false;
        console.log('POPUP: Spoofing data updated:', spoofingData.length, 'records');
      } else {
        spoofingStatus.textContent = 'No spoofing data captured yet';
        spoofingPreview.textContent = '';
        downloadSpoofingBtn.disabled = true;
      }
      
      // Update jamming UI
      if (result.jammingData && Array.isArray(result.jammingData) && result.jammingData.length > 0) {
        jammingData = result.jammingData;
        jammingStatus.textContent = `${jammingData.length} records captured`;
        if (result.jammingTimestamp) {
          jammingStatus.textContent += ` (${new Date(result.jammingTimestamp).toLocaleTimeString()})`;
        }
        jammingPreview.textContent = JSON.stringify(jammingData.slice(0, 2), null, 2);
        downloadJammingBtn.disabled = false;
        console.log('POPUP: Jamming data updated:', jammingData.length, 'records');
      } else {
        jammingStatus.textContent = 'No jamming data captured yet';
        jammingPreview.textContent = '';
        downloadJammingBtn.disabled = true;
      }
      
      // Enable download all if we have any data
      downloadAllBtn.disabled = !(spoofingData && spoofingData.length > 0) && !(jammingData && jammingData.length > 0);
    });
  }
  
  // Initial update
  updateUI();
  
  // Update every 2 seconds
  setInterval(updateUI, 2000);
  
  function downloadJSON(data, filename) {
    console.log('POPUP: Downloading:', filename);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  downloadSpoofingBtn.addEventListener('click', function() {
    if (spoofingData && spoofingData.length > 0) {
      const filename = `spoofing_data_${new Date().toISOString().split('T')[0]}.json`;
      downloadJSON(spoofingData, filename);
    }
  });
  
  downloadJammingBtn.addEventListener('click', function() {
    if (jammingData && jammingData.length > 0) {
      const filename = `jamming_data_${new Date().toISOString().split('T')[0]}.json`;
      downloadJSON(jammingData, filename);
    }
  });
  
  downloadAllBtn.addEventListener('click', function() {
    const combinedData = {
      spoofing: spoofingData || [],
      jamming: jammingData || [],
      exported_at: new Date().toISOString()
    };
    const filename = `aviation_data_${new Date().toISOString().split('T')[0]}.json`;
    downloadJSON(combinedData, filename);
  });
  
  clearDataBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all captured data?')) {
      chrome.storage.local.clear(() => {
        console.log('POPUP: Storage cleared');
        spoofingData = null;
        jammingData = null;
        updateUI();
      });
    }
  });
});