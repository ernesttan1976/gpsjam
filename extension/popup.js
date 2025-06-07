console.log("POPUP: Script loaded");

document.addEventListener("DOMContentLoaded", function () {
  console.log("POPUP: DOM ready");

  const downloadSpoofingBtn = document.getElementById("downloadSpoofing");
  const downloadJammingBtn = document.getElementById("downloadJamming");
  const downloadJammingKMZBtn = document.getElementById("downloadJammingKMZ");
  const downloadAllBtn = document.getElementById("downloadAll");
  const clearDataBtn = document.getElementById("clearData");

  const spoofingStatus = document.getElementById("spoofingStatus");
  const jammingStatus = document.getElementById("jammingStatus");
  const spoofingPreview = document.getElementById("spoofingPreview");
  const jammingPreview = document.getElementById("jammingPreview");

  let spoofingData = null;
  let jammingData = null;

  function updateUI() {
    chrome.storage.local.get(
      ["spoofingData", "jammingData", "spoofingTimestamp", "jammingTimestamp"],
      function (result) {
        // Update spoofing UI
        if (
          result.spoofingData &&
          Array.isArray(result.spoofingData) &&
          result.spoofingData.length > 0
        ) {
          spoofingData = result.spoofingData;
          spoofingStatus.textContent = `${spoofingData.length} records captured`;
          if (result.spoofingTimestamp) {
            spoofingStatus.textContent += ` (${new Date(
              result.spoofingTimestamp
            ).toLocaleTimeString()})`;
          }
          spoofingPreview.textContent = JSON.stringify(
            spoofingData.slice(0, 2),
            null,
            2
          );
          downloadSpoofingBtn.disabled = false;
        } else {
          spoofingStatus.textContent = "No spoofing data captured yet";
          spoofingPreview.textContent = "";
          downloadSpoofingBtn.disabled = true;
        }

        // Update jamming UI
        if (
          result.jammingData &&
          Array.isArray(result.jammingData) &&
          result.jammingData.length > 0
        ) {
          jammingData = result.jammingData;
          jammingStatus.textContent = `${jammingData.length} records captured`;
          if (result.jammingTimestamp) {
            jammingStatus.textContent += ` (${new Date(
              result.jammingTimestamp
            ).toLocaleTimeString()})`;
          }
          jammingPreview.textContent = JSON.stringify(
            jammingData.slice(0, 2),
            null,
            2
          );
          downloadJammingBtn.disabled = false;
          downloadJammingKMZBtn.disabled = false;
        } else {
          jammingStatus.textContent = "No jamming data captured yet";
          jammingPreview.textContent = "";
          downloadJammingBtn.disabled = true;
          downloadJammingKMZBtn.disabled = true;
        }

        // Enable download all if we have any data
        downloadAllBtn.disabled =
          !(spoofingData && spoofingData.length > 0) &&
          !(jammingData && jammingData.length > 0);
      }
    );
  }

  // Initial update
  updateUI();

  // Update every 2 seconds
  setInterval(updateUI, 2000);

  function downloadJSON(data, filename) {
    console.log("POPUP: Downloading:", filename);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Proper ZIP implementation for KMZ files
  class ProperZIP {
    constructor() {
      this.files = [];
    }

    addFile(filename, content) {
      let data;
      if (typeof content === "string") {
        data = new TextEncoder().encode(content);
      } else if (content instanceof ArrayBuffer) {
        data = new Uint8Array(content);
      } else if (content instanceof Uint8Array) {
        data = content;
      } else {
        throw new Error("Invalid content type");
      }

      this.files.push({
        name: filename,
        data: data,
        crc32: this.calculateCRC32(data),
        size: data.length,
      });
    }

    generate() {
      const encoder = new TextEncoder();
      let localFilesData = [];
      let centralDirectory = [];
      let offset = 0;

      // Process each file
      for (let i = 0; i < this.files.length; i++) {
        const file = this.files[i];
        const filename = encoder.encode(file.name);

        // Create local file header
        const localHeader = new ArrayBuffer(30);
        const localView = new DataView(localHeader);

        localView.setUint32(0, 0x04034b50, true); // Local file header signature
        localView.setUint16(4, 20, true); // Version needed to extract
        localView.setUint16(6, 0, true); // General purpose bit flag
        localView.setUint16(8, 0, true); // Compression method (0 = stored)
        localView.setUint16(10, 0, true); // Last mod file time
        localView.setUint16(12, 0, true); // Last mod file date
        localView.setUint32(14, file.crc32, true); // CRC-32
        localView.setUint32(18, file.size, true); // Compressed size
        localView.setUint32(22, file.size, true); // Uncompressed size
        localView.setUint16(26, filename.length, true); // File name length
        localView.setUint16(28, 0, true); // Extra field length

        // Combine local header + filename + file data
        const localEntry = new Uint8Array(30 + filename.length + file.size);
        localEntry.set(new Uint8Array(localHeader), 0);
        localEntry.set(filename, 30);
        localEntry.set(file.data, 30 + filename.length);

        localFilesData.push(localEntry);

        // Create central directory entry
        const centralHeader = new ArrayBuffer(46);
        const centralView = new DataView(centralHeader);

        centralView.setUint32(0, 0x02014b50, true); // Central file header signature
        centralView.setUint16(4, 20, true); // Version made by
        centralView.setUint16(6, 20, true); // Version needed to extract
        centralView.setUint16(8, 0, true); // General purpose bit flag
        centralView.setUint16(10, 0, true); // Compression method
        centralView.setUint16(12, 0, true); // Last mod file time
        centralView.setUint16(14, 0, true); // Last mod file date
        centralView.setUint32(16, file.crc32, true); // CRC-32
        centralView.setUint32(20, file.size, true); // Compressed size
        centralView.setUint32(24, file.size, true); // Uncompressed size
        centralView.setUint16(28, filename.length, true); // File name length
        centralView.setUint16(30, 0, true); // Extra field length
        centralView.setUint16(32, 0, true); // File comment length
        centralView.setUint16(34, 0, true); // Disk number start
        centralView.setUint16(36, 0, true); // Internal file attributes
        centralView.setUint32(38, 0, true); // External file attributes
        centralView.setUint32(42, offset, true); // Relative offset of local header

        const centralEntry = new Uint8Array(46 + filename.length);
        centralEntry.set(new Uint8Array(centralHeader), 0);
        centralEntry.set(filename, 46);

        centralDirectory.push(centralEntry);
        offset += localEntry.length;
      }

      // Calculate central directory size
      let centralDirSize = 0;
      centralDirectory.forEach((entry) => {
        centralDirSize += entry.length;
      });

      // Create end of central directory record
      const endRecord = new ArrayBuffer(22);
      const endView = new DataView(endRecord);

      endView.setUint32(0, 0x06054b50, true); // End of central dir signature
      endView.setUint16(4, 0, true); // Number of this disk
      endView.setUint16(6, 0, true); // Disk where central directory starts
      endView.setUint16(8, this.files.length, true); // Number of central directory records on this disk
      endView.setUint16(10, this.files.length, true); // Total number of central directory records
      endView.setUint32(12, centralDirSize, true); // Size of central directory
      endView.setUint32(16, offset, true); // Offset of start of central directory
      endView.setUint16(20, 0, true); // ZIP file comment length

      // Calculate total size and create final ZIP data
      const totalSize = offset + centralDirSize + 22;
      const zipData = new Uint8Array(totalSize);
      let pos = 0;

      // Add local file data
      localFilesData.forEach((data) => {
        zipData.set(data, pos);
        pos += data.length;
      });

      // Add central directory
      centralDirectory.forEach((data) => {
        zipData.set(data, pos);
        pos += data.length;
      });

      // Add end record
      zipData.set(new Uint8Array(endRecord), pos);

      return zipData;
    }

    calculateCRC32(data) {
      const crcTable = this.makeCRCTable();
      let crc = 0 ^ -1;

      for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
      }

      return (crc ^ -1) >>> 0;
    }

    makeCRCTable() {
      if (this._crcTable) return this._crcTable;

      const table = [];
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c;
      }
      this._crcTable = table;
      return table;
    }
  }

  // KMZ converter
  class KMZConverter {
    constructor() {
      try {
        this.h3Converter = new JammingDataConverter();
      } catch (error) {
        console.error("Failed to initialize H3 converter:", error);
        throw new Error("H3 library not available - cannot create KMZ files");
      }
    }

    calculateJammingIntensity(data) {
      const count = {};
      count.bad =
        data["n_nic0"] +
        data["n_nic1"] +
        data["n_nic2"] +
        data["n_nic3"] +
        data["n_nic4"];
      count.average = data["n_nic5"] + data["n_nic6"] + data["n_nic7"];
      count.good =
        data["n_nic8"] + data["n_nic9"] + data["n_nic10"] + data["n_nic11"];
      const intensity =
        count.bad + count.good > 0
          ? parseInt((count.bad / (count.bad + count.good)) * 100)
          : 0;
      return {
        intensity,
        count_good: count.good,
        count_average: count.average,
        count_bad: count.bad,
      };
    }

    generateKML(jammingData, title = "GPS Jamming Data") {
      const timestamp = new Date().toISOString().split("T")[0];

      let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${this.escapeXML(title)} - ${timestamp}</name>
    <description>GPS Jamming data from SKAI</description>
    
    <Style id="no-jamming">
      <PolyStyle>
        <color>07000000</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
      <LineStyle>
        <color>1f000000</color>
        <width>2</width>
      </LineStyle>
    </Style>
    <Style id="low-jamming">
      <PolyStyle>
        <color>3f00ffff</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
      <LineStyle>
        <color>7f00ffff</color>
        <width>2</width>
      </LineStyle>
    </Style>
    <Style id="moderate-jamming">
      <PolyStyle>
        <color>3f007fff</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
      <LineStyle>
        <color>7f007fff</color>
        <width>2</width>
      </LineStyle>
    </Style>
    <Style id="high-jamming">
      <PolyStyle>
        <color>3f0000ff</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
      <LineStyle>
        <color>7f0000ff</color>
        <width>3</width>
      </LineStyle>
    </Style>
`;

      let processedCount = 0;
      jammingData.forEach((data, index) => {
        const { intensity, count_good, count_average, count_bad } =
          this.calculateJammingIntensity(data);

        try {
          const coordinates = this.h3Converter.h3ToPolygonCoordinates(
            data.h3_index
          );

          let styleId;
          if (intensity <= 5) styleId = "no-jamming"; // green
          else if (intensity <= 20) styleId = "low-jamming"; //yellow
          else if (intensity <= 50) styleId = "moderate-jamming"; //orange
          else styleId = "high-jamming"; // red

          const nicDetails = `n_nic1:${data["n_nic1"]},n_nic2:${data["n_nic2"]},n_nic3:${data["n_nic3"]},n_nic4:${data["n_nic4"]},n_nic5:${data["n_nic5"]},n_nic6:${data["n_nic6"]},n_nic7:${data["n_nic7"]},n_nic8:${data["n_nic8"]},n_nic9:${data["n_nic9"]},n_nic10:${data["n_nic10"]},n_nic11:${data["n_nic11"]}`;

          kml += `
        <Placemark>
          <name>Jamming Zone ${processedCount + 1}</name>
          <description><![CDATA[
            <b>GPS Jamming Detection</b><br/>
            <b>H3 Index:</b> ${this.escapeXML(data.h3_index)}<br/>
            <b>Timestamp:</b> ${this.escapeXML(data.timestamp)}<br/>
            <b>Risk Classification:</b> ${this.escapeXML(
              styleId.toUpperCase()
            )}<br/>
            <b>Total Intensity (% BAD vs GOOD):</b> ${intensity}<br/>
            <b>Bad Count:</b> ${this.escapeXML(
              count_bad
            )} <b>Average Count:</b> ${this.escapeXML(
            count_average
          )} <b>Good Count:</b> ${this.escapeXML(count_good)} <br/>
            <b>NIC Levels:</b> ${this.escapeXML(nicDetails)}<br/>
          ]]></description>
          <styleUrl>#${styleId}</styleUrl>
          <Polygon>
            <extrude>1</extrude>
            <altitudeMode>relativeToGround</altitudeMode>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>${coordinates}</coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
        </Placemark>`;

          processedCount++;
        } catch (error) {
          console.error(`Failed to convert H3 index ${data.h3_index}:`, error);
          return; // Skip this data point
        }
      });

      kml += `
      </Document>
    </kml>`;

      console.log(`Generated KML with ${processedCount} placemarks`);
      return kml;
    }

    escapeXML(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    async createKMZ(jammingData, filename = null) {
      if (!filename) {
        const timestamp = new Date().toISOString().split("T")[0];
        filename = `jamming_data_${timestamp}.kmz`;
      }

      const kmlContent = this.generateKML(jammingData);

      const zip = new ProperZIP();
      zip.addFile("doc.kml", kmlContent);

      const zipData = zip.generate();
      const kmzBlob = new Blob([zipData], {
        type: "application/vnd.google-earth.kmz",
      });

      console.log(`Created KMZ file: ${filename}, size: ${kmzBlob.size} bytes`);
      return { blob: kmzBlob, filename };
    }

    downloadFile(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 100);
      console.log(`Download triggered for ${filename}`);
    }

    async convertAndDownload(jammingData, filename = null) {
      try {
        if (!Array.isArray(jammingData) || jammingData.length === 0) {
          throw new Error("No valid jamming data provided");
        }

        const validData = jammingData.filter((item) => item.h3_index);
        if (validData.length === 0) {
          throw new Error("No data points with h3_index found");
        }

        console.log(`Converting ${validData.length} valid data points to KMZ`);

        const { blob, filename: outputFilename } = await this.createKMZ(
          validData,
          filename
        );
        this.downloadFile(blob, outputFilename);

        return true;
      } catch (error) {
        console.error("KMZ conversion error:", error);
        throw error;
      }
    }
  }

  // Function to convert jamming data to KMZ and download
  async function downloadJammingAsKMZ() {
    if (!jammingData || jammingData.length === 0) {
      alert("No jamming data available to convert to KMZ");
      return;
    }

    console.log("POPUP: Converting jamming data to KMZ...");
    downloadJammingKMZBtn.textContent = "Converting...";
    downloadJammingKMZBtn.disabled = true;

    try {
      const converter = new KMZConverter();
      const success = await converter.convertAndDownload(jammingData);

      if (success) {
        console.log("POPUP: KMZ conversion successful");
      } else {
        throw new Error("Conversion failed");
      }
    } catch (error) {
      console.error("POPUP: KMZ conversion error:", error);
      alert(`Failed to convert to KMZ: ${error.message}`);
    } finally {
      downloadJammingKMZBtn.textContent = "Download KMZ";
      downloadJammingKMZBtn.disabled = jammingData ? false : true;
    }
  }

  downloadSpoofingBtn.addEventListener("click", function () {
    if (spoofingData && spoofingData.length > 0) {
      const filename = `spoofing_data_${
        new Date().toISOString().split("T")[0]
      }.json`;
      downloadJSON(spoofingData, filename);
    }
  });

  downloadJammingBtn.addEventListener("click", function () {
    if (jammingData && jammingData.length > 0) {
      const filename = `jamming_data_${
        new Date().toISOString().split("T")[0]
      }.json`;
      downloadJSON(jammingData, filename);
    }
  });

  downloadJammingKMZBtn.addEventListener("click", downloadJammingAsKMZ);

  downloadAllBtn.addEventListener("click", function () {
    const combinedData = {
      spoofing: spoofingData || [],
      jamming: jammingData || [],
      exported_at: new Date().toISOString(),
    };
    const filename = `aviation_data_${
      new Date().toISOString().split("T")[0]
    }.json`;
    downloadJSON(combinedData, filename);
  });

  clearDataBtn.addEventListener("click", function () {
    if (confirm("Are you sure you want to clear all captured data?")) {
      chrome.storage.local.clear(() => {
        console.log("POPUP: Storage cleared");
        spoofingData = null;
        jammingData = null;
        updateUI();
      });
    }
  });
});
