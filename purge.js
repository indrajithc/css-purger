const express = require("express");
const axios = require("axios");
const { JSDOM } = require("jsdom");
const postcss = require("postcss");
// const purgecss = require("@fullhuman/postcss-purgecss");
const purgecss = require("@fullhuman/postcss-purgecss").default;


const app = express();
const PORT = 3000;

// Download a remote file
async function downloadFile(url) {
  const response = await axios.get(url, { responseType: "text" });
  return response.data;
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
    .map(
      (href) => href?.replace(new RegExp("^//"), "https://") // convert protocol-relative URLs to absolute
    ); // only absolute URLs
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

// Route: GET /
app.get("/", async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.send(`
            <h2>CSS Purger Service</h2>
            <form method="get">
                <input type="url" name="url" placeholder="Enter your webpage URL" style="width:300px;" required />
                <button type="submit">Purge CSS</button>
            </form>
        `);
  }

  try {
    console.log(`🌐 Fetching HTML from: ${targetUrl}`);
    const htmlData = await downloadFile(targetUrl);

    const cssUrls = await extractCSSLinks(htmlData);

    if (!cssUrls.length) {
      return res.send("⚠️ No external CSS files found on the provided URL.");
    }

    const cssContents = await Promise.all(
      cssUrls.map(async (url) => {
        try {
          return await downloadFile(url);
        } catch (e) {
          console.warn(`⚠️ Failed to download CSS: ${url}`);
          return "";
        }
      })
    );

    const purgedCSS = await purgeCSS(htmlData, cssContents);

    res.setHeader("Content-Type", "text/css");
    res.setHeader("Content-Disposition", 'attachment; filename="purged.css"');
    return res.send(purgedCSS);
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).send("Something went wrong. Check server logs.");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 CSS Purger Server running at http://localhost:${PORT}`);
});
