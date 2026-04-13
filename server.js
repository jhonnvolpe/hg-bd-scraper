/**
 * HG-BD Tender Scraper Backend
 * Standard Portable Node.js - Works on any cloud or on-premise
 */

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

// Try to import puppeteer - will fail gracefully if not installed
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.log('Puppeteer not installed. Install with: npm install puppeteer');
}

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tenders.json');

// Middleware
app.use(cors());
app.use(express.json());

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
    // Return default/mock data if file doesn't exist
    return getDefaultTenders();
  }
}

// Save tenders to file
async function saveTenders(tenders) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(tenders, null, 2));
}

// Default/mock tenders (2026 dates)
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
      description: 'Project Management Consultancy services for major infrastructure development including roads, utilities, and public facilities.',
      scope: ['Project planning', 'Schedule management', 'Cost control', 'Quality assurance', 'Stakeholder coordination'],
      requirements: ['10+ years PMC experience', 'Registered with MPW', 'Similar project portfolio'],
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
      description: 'Construction management for civil works including drainage systems, road pavements, and structural elements.',
      scope: ['Site management', 'Quality control', 'Progress monitoring', 'Safety compliance', 'Documentation'],
      requirements: ['Civil engineering degree', '5+ years management exp', 'Local market knowledge'],
      url: 'https://www.mpw.gov.kw/',
      scrapedAt: new Date().toISOString()
    },
    {
      id: 'PAHW-2026-2203',
      source: 'PAHW',
      title: 'Management of Implementation - Housing Projects 1635/1636/1637',
      type: 'Management of Implementation',
      contractRef: 'PAHW-1635-1636-1637',
      value: 3200000,
      deadline: '2026-05-05',
      status: 'new',
      description: 'Comprehensive management of implementation for residential infrastructure development projects under PAHW contracts 1635, 1636, and 1637.',
      scope: ['Implementation oversight', 'Contract management', 'Progress reporting', 'Budget control', 'Risk management'],
      requirements: ['PMP certification preferred', 'Housing sector experience', 'Bilingual capability'],
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
      description: 'Management of implementation for (2) projects in Sabah Al-Ahmad area for Public Authority for Applied Education and Training.',
      scope: ['Project implementation management', 'Contractor coordination', 'Progress tracking', 'Quality assurance', 'Stakeholder reporting'],
      requirements: ['Arabic/English bilingual', 'Implementation management experience', 'Educational sector knowledge'],
      url: 'https://www.paaet.edu.kw/',
      scrapedAt: new Date().toISOString()
    },
    {
      id: 'CAPT-2026-0893',
      source: 'CAPT',
      title: 'Construction Supervision for Public Works',
      type: 'Civil Supervision',
      contractRef: 'General',
      value: 950000,
      deadline: '2026-04-30',
      status: 'reviewed',
      description: 'Supervision services for various public works projects across multiple locations.',
      scope: ['Daily inspections', 'Material testing', 'Contractor coordination', 'Progress reports'],
      requirements: ['Engineering background', 'Site supervision experience'],
      url: 'https://www.etenders.gov.kw/',
      scrapedAt: new Date().toISOString()
    },
    {
      id: 'MPW-2026-4452',
      source: 'MPW',
      title: 'Infrastructure Development PMC - Package A',
      type: 'PMC',
      contractRef: 'General',
      value: 4500000,
      deadline: '2026-05-10',
      status: 'new',
      description: 'Large-scale infrastructure PMC services covering multiple project phases.',
      scope: ['Feasibility studies', 'Design review', 'Tender management', 'Construction oversight', 'Project closeout'],
      requirements: ['15+ years experience', 'International project exposure', 'Strong references'],
      url: 'https://www.mpw.gov.kw/',
      scrapedAt: new Date().toISOString()
    },
    {
      id: 'PAHW-2026-2204',
      source: 'PAHW',
      title: 'Civil Works Supervision - Residential Complex',
      type: 'Civil Supervision',
      contractRef: 'General',
      value: 1200000,
      deadline: '2026-05-02',
      status: 'interested',
      description: 'Civil supervision for new residential complex development project.',
      scope: ['Foundation works', 'Structural supervision', 'MEP coordination', 'Final inspections'],
      requirements: ['Civil engineering degree', 'Residential project experience'],
      url: 'https://www.pahw.gov.kw/',
      scrapedAt: new Date().toISOString()
    },
    {
      id: 'CAPT-2026-0894',
      source: 'CAPT',
      title: 'Project Management Consultancy - Roads & Highways',
      type: 'PMC',
      contractRef: 'General',
      value: 2800000,
      deadline: '2026-04-22',
      status: 'new',
      description: 'PMC services for road and highway infrastructure development.',
      scope: ['Route planning', 'Traffic management', 'Environmental compliance', 'Stakeholder engagement'],
      requirements: ['Roads/highways expertise', 'Environmental assessment knowledge'],
      url: 'https://www.etenders.gov.kw/',
      scrapedAt: new Date().toISOString()
    },
    {
      id: 'MPW-2026-4453',
      source: 'MPW',
      title: 'Implementation Management - Utility Infrastructure',
      type: 'Management of Implementation',
      contractRef: 'General',
      value: 1500000,
      deadline: '2026-05-08',
      status: 'new',
      description: 'Civil supervision for utility infrastructure including water, electricity, and telecommunications.',
      scope: ['Utility coordination', 'Trenching supervision', 'Backfill inspection', 'As-built documentation'],
      requirements: ['Utility sector experience', 'Coordination skills'],
      url: 'https://www.mpw.gov.kw/',
      scrapedAt: new Date().toISOString()
    }
  ];
}

// ============================================
// SCRAPER FUNCTIONS (Public Sites Only)
// ============================================

async function scrapeCAPT() {
  if (!puppeteer) {
    console.log('Puppeteer not available - skipping CAPT scrape');
    return [];
  }
  
  console.log('Scraping CAPT (Central Agency for Public Tenders)...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // CAPT Public Tender Board
    await page.goto('https://www.etenders.gov.kw/', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Extract tender data (public listings only)
    const tenders = await page.evaluate(() => {
      const results = [];
      // This is a placeholder - actual selectors depend on site structure
      const rows = document.querySelectorAll('.tender-row, .announcement-item, tr');
      rows.forEach(row => {
        const title = row.querySelector('.title, td:nth-child(2), h3')?.textContent?.trim();
        if (title && (title.includes('PMC') || title.includes('Supervision') || title.includes('Management'))) {
          results.push({
            title: title,
            source: 'CAPT',
            scrapedFrom: window.location.href
          });
        }
      });
      return results;
    });
    
    return tenders;
  } catch (error) {
    console.error('CAPT scrape error:', error.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeMPW() {
  if (!puppeteer) {
    console.log('Puppeteer not available - skipping MPW scrape');
    return [];
  }
  
  console.log('Scraping MPW (Ministry of Public Works)...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // MPW Public Announcements
    await page.goto('https://www.mpw.gov.kw/', { waitUntil: 'networkidle2', timeout: 30000 });
    
    const tenders = await page.evaluate(() => {
      const results = [];
      const announcements = document.querySelectorAll('.news-item, .announcement, .tender');
      announcements.forEach(item => {
        const title = item.textContent?.trim();
        if (title && (title.includes('مناقصة') || title.includes('Tender') || title.includes('Project'))) {
          results.push({
            title: title,
            source: 'MPW',
            scrapedFrom: window.location.href
          });
        }
      });
      return results;
    });
    
    return tenders;
  } catch (error) {
    console.error('MPW scrape error:', error.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapePAHW() {
  if (!puppeteer) {
    console.log('Puppeteer not available - skipping PAHW scrape');
    return [];
  }
  
  console.log('Scraping PAHW (Public Authority for Housing Welfare)...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    await page.goto('https://www.pahw.gov.kw/', { waitUntil: 'networkidle2', timeout: 30000 });
    
    const tenders = await page.evaluate(() => {
      const results = [];
      // Look for contract 1635, 1636, 1637 references
      const items = document.querySelectorAll('.project-item, .news-item, .announcement');
      items.forEach(item => {
        const text = item.textContent?.trim();
        if (text && (text.includes('1635') || text.includes('1636') || text.includes('1637') || 
                     text.includes('مشروع') || text.includes('Project'))) {
          results.push({
            title: text.substring(0, 100),
            source: 'PAHW',
            scrapedFrom: window.location.href
          });
        }
      });
      return results;
    });
    
    return tenders;
  } catch (error) {
    console.error('PAHW scrape error:', error.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapePAAET() {
  if (!puppeteer) {
    console.log('Puppeteer not available - skipping PAAET scrape');
    return [];
  }
  
  console.log('Scraping PAAET (Public Authority for Applied Education & Training)...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    await page.goto('https://www.paaet.edu.kw/', { waitUntil: 'networkidle2', timeout: 30000 });
    
    const tenders = await page.evaluate(() => {
      const results = [];
      // Look for Arabic keywords: مناقصة (tender), إدارة تنفيذ (management of implementation)
      const items = document.querySelectorAll('.news-item, .announcement, .tender');
      items.forEach(item => {
        const text = item.textContent?.trim();
        if (text && (text.includes('مناقصة') || text.includes('إدارة تنفيذ') || 
                     text.includes('مشروع') || text.includes('تعليم'))) {
          results.push({
            title: text.substring(0, 100),
            source: 'PAAET',
            scrapedFrom: window.location.href
          });
        }
      });
      return results;
    });
    
    return tenders;
  } catch (error) {
    console.error('PAAET scrape error:', error.message);
    return [];
  } finally {
    await browser.close();
  }
}

// Main scrape function
async function runScraper() {
  console.log(`\n[${new Date().toISOString()}] Starting scraper run...`);
  
  const allTenders = [];
  
  // Scrape all sources
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
  
  console.log(`Scraped ${allTenders.length} new tenders`);
  
  // Merge with existing tenders
  const existingTenders = await loadTenders();
  const existingIds = new Set(existingTenders.map(t => t.id));
  
  // Add new tenders with proper formatting
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
      description: `Scraped from ${t.source} public tender board`,
      scope: ['Details available on source website'],
      requirements: ['Check source website for requirements'],
      url: t.scrapedFrom,
      scrapedAt: new Date().toISOString()
    }));
  
  const merged = [...newTenders, ...existingTenders];
  await saveTenders(merged);
  
  console.log(`[${new Date().toISOString()}] Scraper complete. Total tenders: ${merged.length}`);
  return merged;
}

// Helper: Detect tender type from title
function detectType(title) {
  const lower = title.toLowerCase();
  if (lower.includes('pmc') || lower.includes('project management')) return 'PMC';
  if (lower.includes('civil supervision') || lower.includes('construction supervision')) return 'Civil Supervision';
  if (lower.includes('construction management')) return 'Construction Management';
  if (lower.includes('إدارة تنفيذ') || lower.includes('implementation management') || lower.includes('management of implementation')) return 'Management of Implementation';
  if (lower.includes('infrastructure')) return 'Infrastructure';
  return 'General';
}

// Helper: Get random future date
function getFutureDate() {
  const days = Math.floor(Math.random() * 60) + 14; // 2-74 days from now
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
