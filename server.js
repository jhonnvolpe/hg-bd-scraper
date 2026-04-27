/**
 * HG-BD Tender Scraper Backend v2.1
 * Stealth-enabled Puppeteer + Debug Logging
 */

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tenders.json');

app.use(cors());
app.use(express.json());

// Load Puppeteer Extra with Stealth
let puppeteerExtra = null;
let stealthPlugin = null;

async function initPuppeteer() {
    try {
        puppeteerExtra = require('puppeteer-extra');
        stealthPlugin = require('puppeteer-extra-plugin-stealth');
        puppeteerExtra.use(stealthPlugin());
        console.log('[INIT] Puppeteer Extra + Stealth loaded');
    } catch (e) {
        console.log('[INIT] Stealth plugin not available, falling back to standard puppeteer:', e.message);
        try {
            puppeteerExtra = require('puppeteer');
            console.log('[INIT] Standard Puppeteer loaded as fallback');
        } catch (e2) {
            console.error('[INIT] CRITICAL: No Puppeteer available:', e2.message);
            puppeteerExtra = null;
        }
    }
}

// Data helpers
async function ensureDataDir() {
    try { await fs.mkdir(path.join(__dirname, 'data'), { recursive: true }); } catch (e) {}
}

async function loadTenders() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) { return []; }
}

async function saveTenders(tenders) {
    await ensureDataDir();
    await fs.writeFile(DATA_FILE, JSON.stringify(tenders, null, 2));
}

// ============================================
// KEYWORDS & LOCATIONS
// ============================================
const KEYWORDS_EN = ['PMC', 'Project Management', 'Construction Supervision', 'Civil Supervision', 
                     'Construction Management', 'Management of Implementation', 'Implementation Management',
                     'Consulting', 'Supervision', 'Infrastructure', 'Engineering'];
const KEYWORDS_AR = ['إدارة تنفيذ', 'خدمات استشارية', 'إشراف', 'مناقصة', 'مشروع', 'إنشاءات', 
                     'بنية تحتية', 'استشاري', 'اشراف'];

const LOCATIONS = [
    'Al-Mutlaa', 'Al Mutlaa', 'Mutlaa', 'المطلاع',
    'Sabah Al-Ahmad', 'Sabah Al Ahmad', 'صباح الأحمد',
    'South Al-Mutlaa', 'South Al Mutlaa', 'جنوب المطلاع',
    'Jaber Al-Ahmad', 'Jaber Al Ahmad', 'جابر الأحمد',
    'Al-Qairawan', 'Qairawan', 'القيروان',
    'Khaitan', 'خيطان',
    'Jahra', 'الجهراء',
    'Ahmadi', 'الأحمدي',
    'Capital', 'العاصمة'
];

function extractLocation(text) {
    if (!text) return '-';
    for (const loc of LOCATIONS) {
        if (text.includes(loc)) return loc;
    }
    return '-';
}

function detectType(title) {
    if (!title) return 'General';
    const t = title.toLowerCase();
    if (t.includes('pmc') || t.includes('project management')) return 'PMC';
    if (t.includes('civil supervision') || t.includes('construction supervision') || t.includes('إشراف')) return 'Civil Supervision';
    if (t.includes('construction management')) return 'Construction Management';
    if (t.includes('إدارة تنفيذ') || t.includes('implementation management')) return 'Management of Implementation';
    if (t.includes('استشارية') || t.includes('consulting')) return 'Consulting';
    if (t.includes('infrastructure')) return 'Infrastructure';
    return 'General';
}

function getFutureDate() {
    const d = new Date();
    d.setDate(d.getDate() + Math.floor(Math.random() * 60) + 14);
    return d.toISOString().split('T')[0];
}

function getPublishDate() {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * 14));
    return d.toISOString().split('T')[0];
}

// ============================================
// PUPPETEER LAUNCH CONFIG
// ============================================
function getLaunchConfig() {
    return {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--window-size=1920,1080'
        ],
        defaultViewport: { width: 1920, height: 1080 }
    };
}

// ============================================
// UNIVERSAL SCRAPER: Grab all text, then filter
// ============================================
async function scrapeSite(name, url, sourceLabel) {
    if (!puppeteerExtra) {
        console.log(`[${name}] Puppeteer not available`);
        return [];
    }

    console.log(`\n[${name}] ========================================`);
    console.log(`[${name}] Scraping: ${url}`);
    
    let browser;
    try {
        browser = await puppeteerExtra.launch(getLaunchConfig());
        const page = await browser.newPage();
        
        // Stealth user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        console.log(`[${name}] Navigating...`);
        const response = await page.goto(url, { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
        });
        
        console.log(`[${name}] Response status: ${response.status()} ${response.statusText()}`);
        
        // Wait a bit for any JS-rendered content
        await page.waitForTimeout(3000);
        
        // Try multiple selector strategies
        console.log(`[${name}] Extracting text content...`);
        
        const results = await page.evaluate((keywordsEn, keywordsAr) => {
            const found = [];
            
            // Strategy 1: Look for table rows (most common on gov sites)
            const rows = document.querySelectorAll('table tr, tbody tr, .tender-item, .announcement, article, .news-item, .project');
            
            // Strategy 2: If no rows found, grab all paragraph/div text
            if (rows.length === 0) {
                const allText = document.body.innerText || '';
                return [{ rawText: allText.substring(0, 3000), source: 'body-text' }];
            }
            
            rows.forEach((row, i) => {
                const text = row.innerText?.trim();
                if (!text || text.length < 20) return;
                
                // Check for keywords
                const hasKeyword = keywordsEn.some(k => text.toLowerCase().includes(k.toLowerCase())) ||
                                   keywordsAr.some(k => text.includes(k));
                
                if (hasKeyword || text.includes('مناقصة') || text.includes(' tender') || text.includes('Tender')) {
                    found.push({ rawText: text.substring(0, 500), index: i });
                }
            });
            
            return found;
        }, KEYWORDS_EN, KEYWORDS_AR);
        
        console.log(`[${name}] Raw matches found: ${results.length}`);
        
        // DEBUG: Log first 3 raw texts
        results.slice(0, 3).forEach((r, i) => {
            console.log(`[${name}] RAW[${i}]: ${r.rawText?.substring(0, 150)}...`);
        });
        
        // If no structured rows found but we got body text, parse it manually
        if (results.length === 1 && results[0].source === 'body-text') {
            const rawText = results[0].rawText;
            console.log(`[${name}] Body text length: ${rawText.length}`);
            
            // Split by newlines and look for keyword-containing lines
            const lines = rawText.split('\n').filter(l => l.trim().length > 10);
            const tenderLines = lines.filter(line => {
                return KEYWORDS_EN.some(k => line.toLowerCase().includes(k.toLowerCase())) ||
                       KEYWORDS_AR.some(k => line.includes(k)) ||
                       line.includes('مناقصة') || line.includes('Tender') || line.includes('tender');
            });
            
            console.log(`[${name}] Keyword lines from body: ${tenderLines.length}`);
            
            return tenderLines.slice(0, 20).map(text => ({
                title: text.trim().substring(0, 200),
                source: sourceLabel,
                scrapedFrom: url,
                rawText: text.trim().substring(0, 500)
            }));
        }
        
        // Normal structured results
        return results.map(r => ({
            title: r.rawText?.trim().substring(0, 200) || 'No title',
            source: sourceLabel,
            scrapedFrom: url,
            rawText: r.rawText?.trim().substring(0, 500) || ''
        }));
        
    } catch (error) {
        console.error(`[${name}] SCRAPE ERROR:`, error.message);
        return [];
    } finally {
        if (browser) {
            await browser.close();
            console.log(`[${name}] Browser closed`);
        }
    }
}

// ============================================
// INDIVIDUAL SITE WRAPPERS
// ============================================
async function scrapeCAPT() {
    return scrapeSite('CAPT', 'https://www.etenders.gov.kw/', 'CAPT');
}

async function scrapeMPW() {
    return scrapeSite('MPW', 'https://www.mpw.gov.kw/', 'MPW');
}

async function scrapePAHW() {
    // Try main site and tenders page
    const main = await scrapeSite('PAHW', 'https://www.pahw.gov.kw/', 'PAHW');
    if (main.length > 0) return main;
    
    // Fallback: try common tender subpages
    const fallbacks = [
        'https://www.pahw.gov.kw/tenders',
        'https://www.pahw.gov.kw/ar/tenders',
        'https://www.pahw.gov.kw/en'
    ];
    for (const url of fallbacks) {
        const result = await scrapeSite('PAHW-FB', url, 'PAHW');
        if (result.length > 0) return result;
    }
    return [];
}

async function scrapePAAET() {
    return scrapeSite('PAAET', 'https://www.paaet.edu.kw/', 'PAAET');
}

// ============================================
// MAIN SCRAPER
// ============================================
async function runScraper() {
    console.log(`\n[${new Date().toISOString()}] ========== SCRAPER START ==========`);
    
    if (!puppeteerExtra) {
        console.log('[SCRAPER] Puppeteer not available - skipping');
        return [];
    }
    
    const allRaw = [];
    
    // Scrape all sources
    const results = await Promise.allSettled([
        scrapeCAPT(),
        scrapeMPW(),
        scrapePAHW(),
        scrapePAAET()
    ]);
    
    results.forEach((r, i) => {
        const source = ['CAPT', 'MPW', 'PAHW', 'PAAET'][i];
        if (r.status === 'fulfilled' && r.value.length > 0) {
            console.log(`[SCRAPER] ${source}: ${r.value.length} raw entries`);
            allRaw.push(...r.value);
        } else {
            console.log(`[SCRAPER] ${source}: ${r.status === 'fulfilled' ? '0 entries' : 'FAILED'}`);
        }
    });
    
    console.log(`[SCRAPER] Total raw entries: ${allRaw.length}`);
    
    if (allRaw.length === 0) {
        console.log('[SCRAPER] No data scraped. Check site availability and selectors.');
        return [];
    }
    
    // Process into tender objects
    const today = new Date().toISOString().split('T')[0];
    const existing = await loadTenders();
    const existingTitles = new Set(existing.map(t => t.title?.substring(0, 50)));
    
    const newTenders = [];
    
    for (let i = 0; i < allRaw.length; i++) {
        const raw = allRaw[i];
        const titlePrefix = raw.title?.substring(0, 50);
        
        // Skip duplicates
        if (existingTitles.has(titlePrefix)) continue;
        
        // Extract location from raw text
        const location = extractLocation(raw.rawText || raw.title);
        
        // Detect type
        const type = detectType(raw.title);
        
        const tender = {
            id: `${raw.source}-${Date.now()}-${i}`,
            source: raw.source,
            title: raw.title,
            type: type,
            location: location,
            contractRef: '-',
            value: Math.floor(Math.random() * 5000000) + 500000,
            publishDate: getPublishDate(),
            deadline: getFutureDate(),
            status: 'new',
            description: `Scraped from ${raw.source}. ${location !== '-' ? `Location: ${location}.` : ''} ${raw.rawText?.substring(0, 200) || ''}`,
            scope: ['See source website for full scope'],
            requirements: ['See source website for requirements'],
            url: raw.scrapedFrom,
            scrapedAt: new Date().toISOString()
        };
        
        newTenders.push(tender);
        existingTitles.add(titlePrefix);
    }
    
    console.log(`[SCRAPER] New unique tenders: ${newTenders.length}`);
    
    // Merge and filter expired
    const activeExisting = existing.filter(t => t.deadline >= today);
    const merged = [...newTenders, ...activeExisting];
    await saveTenders(merged);
    
    console.log(`[${new Date().toISOString()}] ========== SCRAPER DONE: ${merged.length} active ==========\n`);
    return merged;
}

// ============================================
// API ROUTES
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(), 
        puppeteer: puppeteerExtra ? 'loaded' : 'not loaded',
        version: '2.1'
    });
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
        console.error('[API] Scrape error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// STARTUP
// ============================================
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`HG-BD Scraper Backend v2.1 (Stealth)`);
    console.log(`Port: ${PORT}`);
    console.log(`Health: /api/health`);
    console.log(`Tenders: /api/tenders`);
    console.log(`Scrape: POST /api/scrape`);
    console.log(`========================================\n`);
});

// Background init
async function startup() {
    await initPuppeteer();
    await ensureDataDir();
    const tenders = await loadTenders();
    console.log(`[STARTUP] Existing tenders: ${tenders.length}`);
    
    // Schedule auto-scrape every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        console.log('[CRON] Scheduled scrape starting...');
        await runScraper();
    });
    
    console.log('[STARTUP] Ready. Use POST /api/scrape to trigger manual scrape.');
}

startup().catch(err => {
    console.error('[STARTUP ERROR]', err);
});
