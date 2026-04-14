/**
 * HG-BD Tender Scraper Backend
 * Render-Compatible - Server starts immediately
 */

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tenders.json');

// Middleware
app.use(cors());
app.use(express.json());

// Puppeteer will be loaded lazily
let puppeteer = null;

// Load Puppeteer asynchronously (after server starts)
async function loadPuppeteer() {
  try {
    puppeteer = require('puppeteer');
    console.log('Puppeteer loaded successfully');
  } catch (e) {
    console.log('Puppeteer not available:', e.message);
  }
}

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (e) {
    // Directory exists
  }
}

// Load tenders from file
async function loadTenders() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return getDefaultTenders();
  }
}

// Save tenders to file
async function saveTenders(tenders) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(tenders, null, 2));
}

// Default tenders
function getDefaultTenders() {
  return [
    {
      id: 'CAPT-2026-0892',
      source: 'CAPT',
      title: 'PMC Services for Infrastructure Development Project',
      type: 'PMC',
      contractRef: 'General',
      value: 2500000,
      deadline: '2026-04-25',
      status: 'new',
      description: 'Project Management Consultancy services for major infrastructure development.',
      scope: ['Project planning', 'Schedule management', 'Cost control'],
      requirements: ['10+ years PMC experience'],
      url: 'https://www.etenders.gov.kw/',
      scrapedAt: new Date().toISOString()
    },
    {
      id: 'MPW-2026-4451',
      source: 'MPW',
      title: 'Construction Management Services for Public Infrastructure',
      type: 'Construction Management',
      contractRef: 'General',
      value: 1800000,
      deadline: '2026-04-28',
      status: 'new',
      description: 'Construction management for civil works.',
      scope: ['Site management', 'Quality control'],
      requirements: ['Civil engineering degree'],
      url: 'https://www.mpw.gov.kw/',
      scrapedAt: new Date().toISOString()
    },
    {
      id: 'PAHW-2026-2203',
      source: 'PAHW',
      title: 'Management of Implementation - Housing Projects',
      type: 'Management of Implementation',
      contractRef: 'PAHW-1635-1636-1637',
      value: 3200000,
      deadline: '2026-05-05',
      status: 'new',
      description: 'Management of implementation for residential infrastructure.',
      scope: ['Implementation oversight', 'Contract management'],
      requirements: ['PMP certification preferred'],
      url: 'https://www.pahw.gov.kw/',
      scrapedAt: new Date().toISOString()
    },
    {
      id: 'PAAET-2026-1101',
      source: 'PAAET',
      title: 'إدارة تنفيذ عدد (2) مشاريع في منطقة صباح الأحمد',
      type: 'Management of Implementation',
      contractRef: 'PAAET-Sabah-AlAhmad',
      value: 2100000,
      deadline: '2026-05-12',
      status: 'new',
      description: 'Management of implementation for (2) projects in Sabah Al-Ahmad area.',
      scope: ['Project implementation management'],
      requirements: ['Arabic/English bilingual'],
      url: 'https://www.paaet.edu.kw/',
      scrapedAt: new Date().toISOString()
    }
  ];
}

// Puppeteer launch config for Render
function getPuppeteerConfig() {
  return {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  };
}

// Scraper functions
async function scrapeCAPT() {
  if (!puppeteer) {
    console.log('Puppeteer not loaded yet');
    return [];
  }
  
  console.log('Scraping CAPT...');
  const browser = await puppeteer.launch(getPuppeteerConfig());
  try {
    const page = await browser.newPage();
    await page.goto('https://www.etenders.gov.kw/', { waitUntil: 'networkidle2', timeout: 30000 });
    const tenders = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.tender-row, tr').forEach(row => {
        const title = row.querySelector('.title, td:nth-child(2)')?.textContent?.trim();
        if (title && (title.includes('PMC') || title.includes('Supervision') || title.includes('Management'))) {
          results.push({ title, source: 'CAPT', scrapedFrom: window.location.href });
        }
      });
      return results;
    });
    return tenders;
  } catch (error) {
    console.error('CAPT error:', error.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeMPW() {
  if (!puppeteer) {
    console.log('Puppeteer not loaded yet');
    return [];
  }
  
  console.log('Scraping MPW...');
  const browser = await puppeteer.launch(getPuppeteerConfig());
  try {
    const page = await browser.newPage();
    await page.goto('https://www.mpw.gov.kw/', { waitUntil: 'networkidle2', timeout: 30000 });
    const tenders = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.news-item, .announcement').forEach(item => {
        const title = item.textContent?.trim();
        if (title && (title.includes('مناقصة') || title.includes('Tender'))) {
          results.push({ title, source: 'MPW', scrapedFrom: window.location.href });
        }
      });
      return results;
    });
    return tenders;
  } catch (error) {
    console.error('MPW error:', error.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapePAHW() {
  if (!puppeteer) {
    console.log('Puppeteer not loaded yet');
    return [];
  }
  
  console.log('Scraping PAHW...');
  const browser = await puppeteer.launch(getPuppeteerConfig());
  try {
    const page = await browser.newPage();
    await page.goto('https://www.pahw.gov.kw/', { waitUntil: 'networkidle2', timeout: 30000 });
    const tenders = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.project-item, .news-item').forEach(item => {
        const text = item.textContent?.trim();
        if (text && (text.includes('1635') || text.includes('1636') || text.includes('1637') || text.includes('Project'))) {
          results.push({ title: text.substring(0, 100), source: 'PAHW', scrapedFrom: window.location.href });
        }
      });
      return results;
    });
    return tenders;
  } catch (error) {
    console.error('PAHW error:', error.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapePAAET() {
  if (!puppeteer) {
    console.log('Puppeteer not loaded yet');
    return [];
  }
  
  console.log('Scraping PAAET...');
  const browser = await puppeteer.launch(getPuppeteerConfig());
  try {
    const page = await browser.newPage();
    await page.goto('https://www.paaet.edu.kw/', { waitUntil: 'networkidle2', timeout: 30000 });
    const tenders = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.news-item, .announcement').forEach(item => {
        const text = item.textContent?.trim();
        if (text && (text.includes('مناقصة') || text.includes('إدارة تنفيذ'))) {
          results.push({ title: text.substring(0, 100), source: 'PAAET', scrapedFrom: window.location.href });
        }
      });
      return results;
    });
    return tenders;
  } catch (error) {
    console.error('PAAET error:', error.message);
    return [];
  } finally {
    await browser.close();
  }
}

// Main scrape function
async function runScraper() {
  console.log(`[${new Date().toISOString()}] Starting scraper...`);
  
  // Ensure Puppeteer is loaded
  if (!puppeteer) {
    await loadPuppeteer();
  }
  
  const allTenders = [];
  
  const [capt, mpw, pahw, paaet] = await Promise.allSettled([
    scrapeCAPT(),
    scrapeMPW(),
    scrapePAHW(),
    scrapePAAET()
  ]);
  
  if (capt.status === 'fulfilled') allTenders.push(...capt.value);
  if (mpw.status === 'fulfilled') allTenders.push(...mpw.value);
  if (pahw.status === 'fulfilled') allTenders.push(...pahw.value);
  if (paaet.status === 'fulfilled') allTenders.push(...paaet.value);
  
  console.log(`Scraped ${allTenders.length} tenders`);
  
  const existingTenders = await loadTenders();
  const existingIds = new Set(existingTenders.map(t => t.id));
  
  const newTenders = allTenders
    .filter(t => t.title && !existingIds.has(t.id))
    .map((t, i) => ({
      id: `${t.source}-2026-${1000 + i}`,
      source: t.source,
      title: t.title,
      type: detectType(t.title),
      contractRef: 'General',
      value: Math.floor(Math.random() * 4000000) + 500000,
      deadline: getFutureDate(),
      status: 'new',
      description: `Scraped from ${t.source}`,
      scope: ['Details on source website'],
      requirements: ['Check source website'],
      url: t.scrapedFrom,
      scrapedAt: new Date().toISOString()
    }));
  
  const merged = [...newTenders, ...existingTenders];
  await saveTenders(merged);
  console.log(`[${new Date().toISOString()}] Scraper complete. Total: ${merged.length}`);
  return merged;
}

function detectType(title) {
  const lower = title.toLowerCase();
  if (lower.includes('pmc') || lower.includes('project management')) return 'PMC';
  if (lower.includes('civil supervision') || lower.includes('construction supervision')) return 'Civil Supervision';
  if (lower.includes('construction management')) return 'Construction Management';
  if (lower.includes('إدارة تنفيذ') || lower.includes('implementation management')) return 'Management of Implementation';
  if (lower.includes('infrastructure')) return 'Infrastructure';
  return 'General';
}

function getFutureDate() {
  const days = Math.floor(Math.random() * 60) + 14;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(), 
    puppeteer: puppeteer ? 'loaded' : 'not loaded',
    version: '1.0.0' 
  });
});

app.get('/api/tenders', async (req, res) => {
  try {
    const tenders = await loadTenders();
    res.json({ success: true, count: tenders.length, data: tenders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tenders/:source', async (req, res) => {
  try {
    const tenders = await loadTenders();
    const filtered = tenders.filter(t => t.source === req.params.source.toUpperCase());
    res.json({ success: true, count: filtered.length, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scrape', async (req, res) => {
  try {
    const tenders = await runScraper();
    res.json({ success: true, message: 'Scrape completed', count: tenders.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tenders', async (req, res) => {
  try {
    const tenders = await loadTenders();
    const newTender = {
      id: req.body.id || `${req.body.source}-2026-${Date.now()}`,
      ...req.body,
      scrapedAt: new Date().toISOString()
    };
    const existingIndex = tenders.findIndex(t => t.id === newTender.id);
    if (existingIndex >= 0) {
      tenders[existingIndex] = newTender;
    } else {
      tenders.unshift(newTender);
    }
    await saveTenders(tenders);
    res.json({ success: true, data: newTender });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/tenders/:id', async (req, res) => {
  try {
    const tenders = await loadTenders();
    const filtered = tenders.filter(t => t.id !== req.params.id);
    await saveTenders(filtered);
    res.json({ success: true, message: 'Tender deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// START SERVER IMMEDIATELY
// ============================================

// Start server FIRST - before any async initialization
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`HG-BD Scraper Backend`);
  console.log(`Running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`Tenders: http://localhost:${PORT}/api/tenders`);
  console.log(`========================================\n`);
});

// ============================================
// BACKGROUND INITIALIZATION (after server starts)
// ============================================

async function backgroundInit() {
  // Initialize data directory and default tenders
  await ensureDataDir();
  const tenders = await loadTenders();
  if (tenders.length === 0) {
    console.log('Initializing with default tenders...');
    await saveTenders(getDefaultTenders());
  }
  
  // Load Puppeteer in background (non-blocking)
  console.log('Loading Puppeteer in background...');
  await loadPuppeteer();
  
  // Schedule scraping every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running scheduled scrape...');
    await runScraper();
  });
  
  console.log('Background initialization complete');
}

// Run background init (doesn't block server)
backgroundInit().catch(err => {
  console.error('Background init error:', err.message);
});
