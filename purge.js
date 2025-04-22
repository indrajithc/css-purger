const express = require("express");
const axios = require("axios");
const { JSDOM } = require("jsdom");
const postcss = require("postcss");
const purgecss = require("@fullhuman/postcss-purgecss").default;
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Download a remote file
async function downloadFile(url) {
  try {
    const response = await axios.get(url, { responseType: "text" });
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to download: ${url}`, error.message);
    return "";
  }
}

// Extract external CSS links using jsdom
async function extractCSSLinks(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')];

  return links
    .map((link) => link.href)
    .filter(
      (href) =>
        href &&
        (href.startsWith("http://") ||
          href.startsWith("https://") ||
          href.startsWith("//"))
    )
    .map((href) => href.replace(/^\/\//, "https://")); // convert protocol-relative URLs
}

// Purge unused CSS
async function purgeCSS(html, cssList) {
  const combinedCSS = cssList.join("\n");

  const result = await postcss([
    purgecss({
      content: [{ raw: html, extension: "html" }],
      defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
    }),
  ]).process(combinedCSS, { from: undefined });

  return result.css;
}

// GET route for HTML form & processing
app.get("/", async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.send(`
      <h2>🔧 CSS Purger Service</h2>
      <form method="get">
          <input type="url" name="url" placeholder="Enter webpage URL" style="width:300px;" required />
          <button type="submit">Purge CSS</button>
      </form>
    `);
  }

  try {
    console.log(`🌐 Fetching HTML from: ${targetUrl}`);
    const htmlData = await downloadFile(targetUrl);

    const cssUrls = await extractCSSLinks(htmlData);
    console.log(`🔍 Found ${cssUrls.length} CSS files.`);

    if (!cssUrls.length) {
      return res.send("⚠️ No external CSS files found on the provided URL.");
    }

    const cssContents = await Promise.all(
      cssUrls.map(async (url) => {
        const css = await downloadFile(url);
        if (!css.trim().startsWith("@") && !css.includes("{")) {
          console.warn(`⚠️ Possibly invalid CSS from: ${url}`);
        }
        return css;
      })
    );

    const validCSS = cssContents.filter((css) => css.trim().length > 10);

    if (!validCSS.length) {
      return res.send("❌ No valid CSS to process. Check the target site.");
    }

    // Debug: Save original CSS for inspection
    const tempDir = path.join(__dirname, "temp_css");
    fs.mkdirSync(tempDir, { recursive: true });
    validCSS.forEach((css, index) => {
      fs.writeFileSync(path.join(tempDir, `original-${index}.css`), css);
    });

    const purgedCSS = await purgeCSS(htmlData, validCSS);

    res.setHeader("Content-Type", "text/css");
    res.setHeader("Content-Disposition", 'attachment; filename="purged.css"');
    return res.send(purgedCSS);
  } catch (error) {
    console.error("❌ Processing error:", error);
    res.status(500).send("Something went wrong. Check server logs.");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 CSS Purger Server running at: http://localhost:${PORT}`);
});
