const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const postcss = require('postcss');
const purgecss = require('@fullhuman/postcss-purgecss');

const TEMP_DIR = path.join(__dirname, 'temp');

async function downloadFile(url, outputPath) {
  const { data } = await axios.get(url, { responseType: 'arraybuffer' });
  await fs.outputFile(outputPath, data);
  console.log(`✅ Downloaded: ${url}`);
}

async function extractAndDownloadCSS(htmlPath) {
  const htmlContent = await fs.readFile(htmlPath, 'utf-8');
  const $ = cheerio.load(htmlContent);
  const cssUrls = [];

  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('http')) {
      cssUrls.push(href);
    }
  });

  const cssPaths = [];
  for (const url of cssUrls) {
    const fileName = path.basename(url.split('?')[0]);
    const savePath = path.join(TEMP_DIR, fileName);
    await downloadFile(url, savePath);
    cssPaths.push(savePath);
  }

  return cssPaths;
}

async function purgeAndSave(htmlPath, cssPaths) {
  const htmlContent = await fs.readFile(htmlPath, 'utf-8');
  let combinedCSS = '';

  for (const cssPath of cssPaths) {
    combinedCSS += await fs.readFile(cssPath, 'utf-8') + '\n';
  }

  const result = await postcss([
    purgecss({
      content: [{ raw: htmlContent, extension: 'html' }],
      defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || []
    })
  ]).process(combinedCSS, { from: undefined });

  const output = path.join(__dirname, 'purged.css');
  await fs.outputFile(output, result.css);
  console.log(`🎉 Purged CSS saved to: ${output}`);
}

async function main() {
  const url = process.argv[2];

  if (!url || !/^https?:\/\//i.test(url)) {
    console.error(`❌ Please provide a valid URL! Example:
node purge.js https://example.com/page.html`);
    process.exit(1);
  }

  await fs.ensureDir(TEMP_DIR);

  const htmlPath = path.join(TEMP_DIR, 'downloaded.html');
  await downloadFile(url, htmlPath);

  const cssPaths = await extractAndDownloadCSS(htmlPath);
  if (cssPaths.length === 0) {
    console.warn('⚠️ No CSS files found in the HTML.');
    return;
  }

  await purgeAndSave(htmlPath, cssPaths);

  // Optionally clean temp files:
  // await fs.remove(TEMP_DIR);
}

main().catch(err => {
  console.error('❌ Error:', err);
});
