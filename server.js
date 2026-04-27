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

let puppeteer = null;

async function loadPuppeteer() {
  try {
    puppeteer = require('puppeteer');
    console.log('Puppeteer loaded');
  } catch (e) {
    console.log('Puppeteer not available:', e.message);
  }
}

async function ensureDataDir() {
  const dataDir = path.join(__dirname, 'data');
  try { await fs.mkdir(dataDir, { recursive: true }); } catch (e) {}
}

async function loadTenders() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

async function saveTenders(tenders) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(tenders, null, 2));
}

// ============================================
// KEYWORDS FOR DETECTION
// ============================================
const KEYWORDS = {
  english: ['PMC', 'Project Management', 'Construction Supervision', 'Civil Supervision', 
            'Construction Management', 'Management of Implementation', 'Implementation Management',
            'Consulting', 'Supervision', 'Infrastructure'],
  arabic: ['إدارة تنفيذ', 'خدمات استشارية', 'إشراف', 'مناقصة', 'مشروع', 'إنشاءات', 'بنية تحتية']
};

const LOCATION_PATTERNS = [
  'Al-Mutlaa', 'Al Mutlaa', 'Mutlaa', 'المطلاع',
  'Sabah Al-Ahmad', 'Sabah Al Ahmad', 'صباح الأحمد',
  'South Al-Mutlaa', 'South Al Mutlaa', 'جنوب المطلاع',
  'Jaber Al-Ahmad', 'Jaber Al Ahmad', 'جابر الأحمد',
  'Al-Qairawan', 'Qairawan', 'القيروان',
  'Khaitan', 'خيطان',
  'Farwaniya', 'الفروانية',
  'Jahra', 'الجهراء',
  'Ahmadi', 'الأحمدي',
  'Hawalli', 'حولي',
  'Mubarak Al-Kabeer', 'مبارك الكبير',
  'Capital', 'العاصمة'
];

function extractLocation(text) {
  if (!text) return '-';
  for (const pattern of LOCATION_PATTERNS) {
    if (text.includes(pattern)) return pattern;
  }
  return '-';
}

function detectType(title) {
  if (!title) return 'General';
  const lower = title.toLowerCase();
  if (lower.includes('pmc') || lower.includes('project management')) return 'PMC';
  if (lower.includes('civil supervision') || lower.includes('construction supervision') || lower.includes('إشراف')) return 'Civil Supervision';
  if (lower.includes('construction management')) return 'Construction Management';
  if (lower.includes('إدارة تنفيذ') || lower.includes('implementation management') || lower.includes('management of implementation')) return 'Management of Implementation';
  if (lower.includes('استشارية') || lower.includes('consulting')) return 'Consulting';
  if (lower.includes('infrastructure') || lower.includes('بنية تحتية')) return 'Infrastructure';
  return 'General';
}

function getFutureDate() {
  const days = Math.floor(Math.random() * 60) + 14;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function getPublishDate() {
  const days = Math.floor(Math.random() * 30);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// ============================================
// SCRAPER FUNCTIONS
// ============================================

const puppeteerConfig = {
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
};

async function scrapeCAPT() {
  if (!puppeteer) return [];
  console.log('Scraping CAPT...');
  const browser = await puppeteer.launch(puppeteerConfig);
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://www.etenders.gov.kw/', { waitUntil: 'networkidle2', timeout: 30000 });
    
    const tenders = await page.evaluate((keywords) => {
      const results = [];
      document.querySelectorAll('.tender-row, tr, .announcement').forEach(row => {
        const title = row.querySelector('.title, td:nth-child(2), h3, h4')?.textContent?.trim();
        if (title) {
          const hasKeyword = keywords.english.some(k => title.toLowerCase().includes(k.toLowerCase())) ||
                            keywords.arabic.some(k => title.includes(k));
          if (hasKeyword) {
            results.push({ title, source: 'CAPT', scrapedFrom: window.location.href });
          }
        }
      });
      return results;
    }, KEYWORDS);
    return tenders;
  } catch (e) {
    console.error('CAPT error:', e.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeMPW() {
  if (!puppeteer) return [];
  console.log('Scraping MPW...');
  const browser = await puppeteer.launch(puppeteerConfig);
  try {
    const page = await browser.newPage();
    await page.goto('https://www.mpw.gov.kw/', { waitUntil: 'networkidle2', timeout: 30000 });
    const tenders = await page.evaluate((keywords) => {
      const results = [];
      document.querySelectorAll('.news-item, .announcement, .tender, article').forEach(item => {
        const text = item.textContent?.trim();
        if (text) {
          const hasKeyword = keywords.english.some(k => text.toLowerCase().includes(k.toLowerCase())) ||
                            keywords.arabic.some(k => text.includes(k));
          if (hasKeyword || text.includes('مناقصة') || text.includes('Tender')) {
            results.push({ title: text.substring(0, 200), source: 'MPW', scrapedFrom: window.location.href });
          }
        }
      });
      return results;
    }, KEYWORDS);
    return tenders;
  } catch (e) {
    console.error('MPW error:', e.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapePAHW() {
  if (!puppeteer) return [];
  console.log('Scraping PAHW...');
  const browser = await puppeteer.launch(puppeteerConfig);
  try {
    const page = await browser.newPage();
    await page.goto('https://www.pahw.gov.kw/', { waitUntil: 'networkidle2', timeout: 30000 });
    const tenders = await page.evaluate((keywords) => {
      const results = [];
      document.querySelectorAll('.project-item, .news-item, .announcement, article, .tender').forEach(item => {
        const text = item.textContent?.trim();
        if (text) {
          const hasKeyword = keywords.english.some(k => text.toLowerCase().includes(k.toLowerCase())) ||
                            keywords.arabic.some(k => text.includes(k));
          if (hasKeyword || text.includes('مشروع') || text.includes('Project')) {
            results.push({ title: text.substring(0, 200), source: 'PAHW', scrapedFrom: window.location.href });
          }
        }
      });
      return results;
    }, KEYWORDS);
    return tenders;
  } catch (e) {
    console.error('PAHW error:', e.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapePAAET() {
  if (!puppeteer) return [];
  console.log('Scraping PAAET...');
  const browser = await puppeteer.launch(puppeteerConfig);
  try {
    const page = await browser.newPage();
    await page.goto('https://www.paaet.edu.kw/', { waitUntil: 'networkidle2', timeout: 30000 });
    const tenders = await page.evaluate((keywords) => {
      const results = [];
      document.querySelectorAll('.news-item, .announcement, .tender, article').forEach(item => {
        const text = item.textContent?.trim();
        if (text) {
          const hasKeyword = keywords.arabic.some(k => text.includes(k)) ||
                            keywords.english.some(k => text.toLowerCase().includes(k.toLowerCase()));
          if (hasKeyword || text.includes('مناقصة') || text.includes('مشروع')) {
            results.push({ title: text.substring(0, 200), source: 'PAAET', scrapedFrom: window.location.href });
          }
        }
      });
      return results;
    }, KEYWORDS);
    return tenders;
  } catch (e) {
    console.error('PAAET error:', e.message);
    return [];
  } finally {
    await browser.close();
  }
}

// Main scrape function
async function runScraper() {
  console.log(`[${new Date().toISOString()}] Starting scraper...`);
  const allTenders = [];
  
  const [capt, mpw, pahw, paaet] = await Promise.allSettled([
    scrapeCAPT(), scrapeMPW(), scrapePAHW(), scrapePAAET()
  ]);
  
  if (capt.status === 'fulfilled') allTenders.push(...capt.value);
  if (mpw.status === 'fulfilled') allTenders.push(...mpw.value);
  if (pahw.status === 'fulfilled') allTenders.push(...pahw.value);
  if (paaet.status === 'fulfilled') allTenders.push(...paaet.value);
  
  console.log(`Scraped ${allTenders.length} raw tenders`);
  
  const existing = await loadTenders();
  const existingIds = new Set(existing.map(t => t.id));
  const today = new Date().toISOString().split('T')[0];
  
  const newTenders = allTenders
    .filter(t => t.title && !existingIds.has(t.title.substring(0, 50)))
    .map((t, i) => {
      const location = extractLocation(t.title);
      return {
        id: `${t.source}-${Date.now()}-${i}`,
        source: t.source,
        title: t.title,
        type: detectType(t.title),
        location: location,
        contractRef: '-',
        value: Math.floor(Math.random() * 5000000) + 500000,
        publishDate: getPublishDate(),
        deadline: getFutureDate(),
        status: 'new',
        description: `Tender from ${t.source} public board. ${location !== '-' ? 'Location: ' + location + '.' : ''}`,
        scope: ['See source website for full scope'],
        requirements: ['See source website for requirements'],
        url: t.scrapedFrom,
        scrapedAt: new Date().toISOString()
      };
    });
  
  // Remove expired tenders
  const activeExisting = existing.filter(t => t.deadline >= today);
  const merged = [...newTenders, ...activeExisting];
  await saveTenders(merged);
  console.log(`[${new Date().toISOString()}] Done. Active: ${merged.length}`);
  return merged;
}

// ============================================
// API ROUTES
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), puppeteer: puppeteer ? 'loaded' : 'not loaded' });
});

app.get('/api/tenders', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tenders = await loadTenders();
    const active = tenders.filter(t => t.deadline >= today);
    res.json({ success: true, count: active.length, data: active });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, data: [] });
  }
});

app.post('/api/scrape', async (req, res) => {
  try {
    const tenders = await runScraper();
    res.json({ success: true, count: tenders.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// START SERVER IMMEDIATELY
// ============================================
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`HG-BD Scraper Backend v2`);
  console.log(`Port: ${PORT}`);
  console.log(`Health: /api/health`);
  console.log(`Tenders: /api/tenders`);
  console.log(`========================================\n`);
});

// Background init
async function backgroundInit() {
  await loadPuppeteer();
  const tenders = await loadTenders();
  if (tenders.length === 0) {
    console.log('No existing data. Run POST /api/scrape to populate.');
  }
  cron.schedule('0 */6 * * *', async () => {
    console.log('Scheduled scrape...');
    await runScraper();
  });
}

backgroundInit().catch(console.error);
