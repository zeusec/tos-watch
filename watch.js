const { chromium } = require('playwright');
const fs = require('fs');
const Diff = require('diff');
const path = require('path');
const https = require('https');

function sendDiscordNotification(siteName, changes) {
    const config = require('./secret.json');
    const webhookURL = new URL(config.webhookURL);
    const data = JSON.stringify({
      content: `${siteName}'s Sweepsteaks Terms of Service have changed!`,
      embeds: [
        {
          title: 'Changes',
          description: changes.substring(0, 2048) // Discord's embed description limit is 2048 characters
        }
      ]
    });
  
    const options = {
      hostname: webhookURL.hostname,
      path: webhookURL.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
  
    const req = https.request(options, (res) => {
      let response_data = '';
      res.on('data', (chunk) => {
        response_data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 204) {
          console.log('Notification sent successfully.');
        } else {
          console.log(`Failed to send notification: ${res.statusCode}`);
          console.log(`Response: ${response_data}`);
        }
      });
    });
  
    req.on('error', (error) => {
      console.error(`Error sending notification: ${error}`);
    });
  
    req.write(data);
    req.end();
  }  

  async function fetchSection(url, startSection, endSection) {
    console.log('Navigating to URL...');
    let content = '';
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    const page = await context.newPage();
    
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    console.log('Page loaded.');
    
    // Scrape the text content of the specific section
    content = await page.evaluate(({ startSection, endSection }) => {
      const bodyText = document.body.innerText;
      const startIndex = bodyText.indexOf(startSection);
      const endIndex = bodyText.indexOf(endSection);
      return bodyText.substring(startIndex, endIndex + endSection.length).trim();
    }, { startSection, endSection });
    
    if (!content) {
      console.log('Sections not found, taking screenshot...');
      await page.screenshot({ path: 'debug_screenshot.png' });
      throw new Error('Sections not found');
    }
    
    await browser.close();
    return content;
  }  

function compareTexts(oldText, newText) {
  const diff = Diff.diffLines(oldText, newText);
  const changes = [];
  for (const part of diff) {
    const symbol = part.added ? '+ ' : part.removed ? '- ' : '';
    if (symbol) {
      changes.push(symbol + part.value.trim());
    }
  }
  return changes.join('\n');
}

const sites = [
    {
      name: 'stake',
      url: 'https://stake.us/policies/terms',
      startSection: '8.3. Stake Cash through Post Card',
      endSection: '8.4. Stake Cash Balance'
    },
    {
      name: 'chumba',
      url: 'https://www.chumbacasino.com/sweeps-rules',
      startSection: 'HOW TO COLLECT SWEEPS COINS',
      endSection: 'USING SWEEPS COINS TO PLAY GAMES'
    },
    {
      name: 'luckyland',
      url: 'https://luckylandcasino.zendesk.com/hc/en-us/articles/360000868688-Official-Sweeps-Rules-',
      startSection: '3. HOW TO COLLECT SWEEPS COINS',
      endSection: '4. USING SWEEPS COINS TO PLAY GAMES'
    }
  ];
  
  async function monitorSite(site) {
    let oldText = '';
  
    try {
      oldText = fs.readFileSync(path.join('tos', `${site.name}.txt`), 'utf-8');
    } catch (err) {
      oldText = '';
    }
  
    const newText = await fetchSection(site.url, site.startSection, site.endSection);
  
    console.log(`Debug: Fetching text for ${site.name}: ${newText.substring(0, 50)}...`);
  
    if (oldText !== newText) {
      const changes = compareTexts(oldText, newText);
  
      if (changes) {
        console.log(`Debug: New text to be written to file for ${site.name}: ${newText.substring(0, 50)}...`);
        fs.writeFileSync(path.join('tos', `${site.name}.txt`), newText);
        const readText = fs.readFileSync(path.join('tos', `${site.name}.txt`), 'utf-8');
        console.log(`Debug: Text read back from file for ${site.name}: ${readText.substring(0, 50)}...`);
        fs.appendFileSync('changes.txt', `Changes at ${new Date().toLocaleString()} for ${site.name}:\n${changes}\n\n`);
        console.log(`Changes at ${new Date().toLocaleString()} for ${site.name}:\n${changes}`);
        console.log('Terms of Service have changed.');
        sendDiscordNotification(site.name, changes);
        }
    }
  }
  
  function getRandomInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min) * 60 * 1000; // Convert to milliseconds
  }
  
  async function monitorSiteWithRandomInterval(site) {
    await monitorSite(site);
    const randomInterval = getRandomInterval(45, 120); // Checks every 45-120 minutes at random for each site
    console.log(`Next check for ${site.name} in ${randomInterval / 60000} minutes`);
    setTimeout(() => monitorSiteWithRandomInterval(site), randomInterval);
  }
  
  function main() {
    for (const site of sites) {
      monitorSiteWithRandomInterval(site);
    }
  }
  
  main();
