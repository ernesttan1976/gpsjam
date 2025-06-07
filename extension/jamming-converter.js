// GPS Jamming Data to KMZ Converter - NO MOCK VERSION
class JammingDataConverter {
  constructor() {
    this.h3 = null;
    this.checkRequiredLibraries();
    this.initH3();
  }

  checkRequiredLibraries() {
    if (typeof JSZip === "undefined") {
      console.error("JSZip library NOT FOUND!");
      console.error(
        "Download: curl -o jszip.min.js https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
      );
      throw new Error("JSZip library is required but not loaded");
    }
    console.log("JSZip library loaded successfully");
  }

  // Remove ALL mock implementations - this might be causing the precision loss
  initH3() {
    if (typeof window !== "undefined" && window.h3) {
      this.h3 = window.h3;
      console.log("H3 library loaded from window.h3");
    } else if (typeof h3 !== "undefined") {
      this.h3 = h3;
      console.log("H3 library loaded globally");
    } else {
      console.error("H3 library NOT FOUND!");
      console.error("You MUST download and include h3-js.umd.js locally");
      throw new Error("H3 library is required - no mock fallback");
    }

    // Test with your actual H3 index
    try {
      const testBoundary = this.h3.cellToBoundary("830028fffffffff");
      console.log("Real H3 boundary test:", testBoundary);

      // Check if we're getting proper precision
      testBoundary.forEach((vertex, i) => {
        console.log(`Vertex ${i}: lat=${vertex[0]}, lng=${vertex[1]}`);
      });
    } catch (e) {
      console.error("H3 test failed:", e);
      throw new Error("H3 library is not working properly");
    }
  }
  // Convert H3 index to KML coordinates with variable vertex count handling
  h3ToPolygonCoordinates(h3Index) {
    if (!this.h3) {
      throw new Error(
        "H3 library not initialized - cannot convert coordinates"
      );
    }

    try {
      console.log("Converting H3 index:", h3Index);

      const boundary = this.h3.cellToBoundary(h3Index);
      console.log("H3 boundary vertices:", boundary);

      if (!boundary || boundary.length < 3) {
        throw new Error(
          `Invalid boundary - expected at least 3 vertices, got: ${
            boundary ? boundary.length : "null"
          }`
        );
      }

      // Log the actual vertex count for debugging
      console.log(
        `H3 cell has ${boundary.length} vertices (expected: usually 6, but can vary)`
      );

      // Check for longitude wrap-around (crossing 180° meridian)
      const longitudes = boundary.map(([lat, lng]) => lng);
      const minLng = Math.min(...longitudes);
      const maxLng = Math.max(...longitudes);
      const lngSpan = maxLng - minLng;

      // If longitude span > 180°, we're crossing the date line
      const crossesDateLine = lngSpan > 180;

      console.log(
        `Longitude range: ${minLng} to ${maxLng}, span: ${lngSpan}°, crosses date line: ${crossesDateLine}`
      );

      let adjustedBoundary;
      if (crossesDateLine) {
        // Adjust negative longitudes by adding 360° to normalize them
        adjustedBoundary = boundary.map(([lat, lng]) => {
          const adjustedLng = lng < 0 ? lng + 360 : lng;
          console.log(`Adjusting longitude: ${lng} -> ${adjustedLng}`);
          return [lat, adjustedLng];
        });
      } else {
        adjustedBoundary = boundary;
      }

      // Convert to KML format: lng,lat,alt with SPACES between coordinate triplets
      const coordinates = adjustedBoundary
        .map(([lat, lng]) => `${lng},${lat},0.0`)
        .join(" ");

      // Close the polygon by adding the first vertex at the end
      const [firstLat, firstLng] = adjustedBoundary[0];
      const result = `${coordinates} ${firstLng},${firstLat},0.0`;

      console.log(
        `Final KML coordinates (${boundary.length} vertices):`,
        result
      );
      return result;
    } catch (error) {
      console.error("Error converting H3 index:", h3Index, error.stack);
      throw error;
    }
  }

  // Calculate total jamming intensity
  calculateJammingIntensity(data) {
    const nicKeys = Object.keys(data).filter((key) => key.startsWith("n_nic"));
    const total = nicKeys.reduce((sum, key) => sum + (data[key] || 0), 0);
    console.log("Calculated intensity for", data.h3_index, ":", total);
    return total;
  }

  // Generate KML content with proper structure and polygon type info
  generateKML(jammingData, title = "GPS Jamming Data") {
    const timestamp = new Date().toISOString().split("T")[0];

    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${title} - ${timestamp}</name>
  <description>GPS Jamming polygons from H3 indices (variable vertex count)</description>
  
  <Style id="low-jamming">
    <PolyStyle>
      <color>7f00ff00</color>
      <fill>1</fill>
      <outline>1</outline>
    </PolyStyle>
    <LineStyle>
      <color>ff00ff00</color>
      <width>2</width>
    </LineStyle>
  </Style>
  
  <Style id="moderate-jamming">
    <PolyStyle>
      <color>7f00ffff</color>
      <fill>1</fill>
      <outline>1</outline>
    </PolyStyle>
    <LineStyle>
      <color>ff00ffff</color>
      <width>2</width>
    </LineStyle>
  </Style>
  
  <Style id="high-jamming">
    <PolyStyle>
      <color>7f0080ff</color>
      <fill>1</fill>
      <outline>1</outline>
    </PolyStyle>
    <LineStyle>
      <color>ff0080ff</color>
      <width>2</width>
    </LineStyle>
  </Style>
  
  <Style id="very-high-jamming">
    <PolyStyle>
      <color>7f0000ff</color>
      <fill>1</fill>
      <outline>1</outline>
    </PolyStyle>
    <LineStyle>
      <color>ff0000ff</color>
      <width>3</width>
    </LineStyle>
  </Style>`;

    let processedCount = 0;
    let polygonStats = {}; // Track polygon vertex counts

    jammingData.forEach((data, index) => {
      const intensity = this.calculateJammingIntensity(data);

      if (intensity === 0) {
        console.log("Skipping zero intensity for", data.h3_index);
        return;
      }

      try {
        // Get vertex count for statistics
        const boundary = this.h3.cellToBoundary(data.h3_index);
        const vertexCount = boundary.length;
        polygonStats[vertexCount] = (polygonStats[vertexCount] || 0) + 1;

        const coordinates = this.h3ToPolygonCoordinates(data.h3_index);
        if (!coordinates) {
          throw new Error(`Failed to get coordinates for ${data.h3_index}`);
        }

        let styleId;
        if (intensity <= 5) styleId = "low-jamming";
        else if (intensity <= 20) styleId = "moderate-jamming";
        else if (intensity <= 50) styleId = "high-jamming";
        else styleId = "very-high-jamming";

        const placemarkId = 100 + processedCount;
        const polygonId = 200 + processedCount;
        const ringId = 300 + processedCount;

        kmlContent += `
        <Placemark id="${placemarkId}">
            <name>H3: ${data.h3_index}</name>
            <description>Jamming Intensity: ${intensity}, Vertices: ${vertexCount}</description>
            <styleUrl>#${styleId}</styleUrl>
            <Polygon id="${polygonId}">
                <outerBoundaryIs>
                    <LinearRing id="${ringId}">
                        <coordinates>${coordinates}</coordinates>
                    </LinearRing>
                </outerBoundaryIs>
            </Polygon>
        </Placemark>`;

        processedCount++;
      } catch (error) {
        console.error(`Error processing H3 index ${data.h3_index}:`, error);
        // Continue processing other indices
      }
    });

    kmlContent += `
</Document>
</kml>`;

    console.log(`Generated KML with ${processedCount} polygonal placemarks`);
    console.log("Polygon vertex count statistics:", polygonStats);
    return kmlContent;
  }

  // Create KMZ file
  async createKMZ(jammingData, filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().split("T")[0];
      filename = `jamming_hexagons_${timestamp}.kmz`;
    }

    if (typeof JSZip === "undefined") {
      throw new Error("JSZip library not loaded");
    }

    const kmlContent = this.generateKML(jammingData);

    const zip = new JSZip();
    zip.file("doc.kml", kmlContent);

    const kmzBlob = await zip.generateAsync({ type: "blob" });
    console.log(`KMZ created: ${filename}, size: ${kmzBlob.size} bytes`);
    return { blob: kmzBlob, filename };
  }

  // Download KMZ file
  downloadKMZ(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 100);
    console.log(`Download started: ${filename}`);
  }

  // Main conversion function
  async convertAndDownload(jammingData, filename = null) {
    try {
      console.log(
        `Converting ${jammingData.length} jamming data points to hexagonal KMZ...`
      );

      if (!Array.isArray(jammingData) || jammingData.length === 0) {
        throw new Error("No valid jamming data provided");
      }

      const validData = jammingData.filter((item) => item.h3_index);
      if (validData.length === 0) {
        throw new Error("No data points with h3_index found");
      }

      console.log(`Processing ${validData.length} valid H3 indices`);

      const { blob, filename: kmzFilename } = await this.createKMZ(
        validData,
        filename
      );
      this.downloadKMZ(blob, kmzFilename);

      console.log("Hexagonal KMZ conversion completed successfully!");
      return true;
    } catch (error) {
      console.error("Error converting to hexagonal KMZ:", error);
      throw error;
    }
  }
}

// Global availability
window.JammingDataConverter = JammingDataConverter;
console.log("JammingConverter: Real H3 only - script loaded and ready");
