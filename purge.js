const express = require("express");
const axios = require("axios");
const { JSDOM } = require("jsdom");
const postcss = require("postcss");
const purgecss = require("@fullhuman/postcss-purgecss").default;
const fs = require("fs");
const path = require("path");
const cssnano = require("cssnano");
const autoprefixer = require("autoprefixer");
const flexbugs = require("postcss-flexbugs-fixes");
const presetEnv = require("postcss-preset-env");
const splitCSSByMedia = require("./splitCSSByMedia");

const app = express();
const PORT = 3000;

const cssOverrides = [
  {
    original: "screen-desktop.css",
    override: path.resolve(__dirname, "./overrides/screen-desktop.css"),
  },
  {
    original: "fonts.css",
    override: path.resolve(__dirname, "./overrides/fonts.css"),
  },
];

const safelistSelectors = [
  "is-navbar-expanded",
  "mm_t84search",
  "background-set-menu",
  "border-bottom-adjust",
  "is-expanded",
  "m-navbar-has-subnav",
  "is-subnav-expanded",
];

const breakpoints = [961];

async function downloadFile(url) {
  try {
    const response = await axios.get(url, { responseType: "text" });
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to download: ${url}`, error.message);
    return "";
  }
}

async function extractCSSLinksWithMedia(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')];

  return links
    .filter(
      (link) =>
        link.href &&
        (link.href.startsWith("http://") ||
          link.href.startsWith("https://") ||
          link.href.startsWith("//"))
    )
    .map((link) => ({
      href: link.href.replace(/^\/\//, "https://"),
      media: link.media || null,
    }));
}

async function purgeCSS(html, cssList) {
  const combinedCSS = cssList.map((entry) => entry.css).join("\n");

  try {
    const result = await postcss([
      flexbugs,
      presetEnv({ stage: 3, features: { "nesting-rules": true } }),
      autoprefixer,
      purgecss({
        content: [{ raw: html, extension: "html" }],
        safelist: safelistSelectors,
        defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
      }),
      cssnano(),
    ]).process(combinedCSS, { from: undefined });

    return result.css;
  } catch (err) {
    console.error("❌ Error while purging/minifying CSS:", err.message);
    return "";
  }
}

function isValidCSS(css) {
  return css && css.includes("{") && css.includes("}");
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/", async (req, res) => {
  const targetUrl = req.query.url;
  const doSlitCSS = req.query.split === "true";

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

    const cssLinks = await extractCSSLinksWithMedia(htmlData);
    console.log(`🔍 Found ${cssLinks.length} CSS files.`);

    if (!cssLinks.length) {
      return res
        .status(400)
        .send("⚠️ No external CSS files found on the provided URL.");
    }

    const cssContents = [];

    for (let i = 0; i < cssLinks.length; i++) {
      const { href: url, media } = cssLinks[i];
      const fileName = path.basename(new URL(url).pathname);
      const overrideEntry = cssOverrides.find((o) => o.original === fileName);
      let css;
      try {
        if (overrideEntry) {
          console.log(
            `📁 Using local override for ${fileName}: ${overrideEntry.override}`
          );
          css = fs.readFileSync(overrideEntry.override, "utf-8");
        } else {
          console.log(`🌐 Downloading remote CSS: ${url}`);
          css = await downloadFile(url);

          const baseUrl =
            new URL(url).origin + path.dirname(new URL(url).pathname) + "/";
          css = css.replace(
            /url\((['"]?)(\.{1,2}\/[^'")]+)\1\)/g,
            (match, quote, relativePath) => {
              const absoluteUrl = new URL(relativePath, baseUrl).href;
              return `url(${quote}${absoluteUrl}${quote})`;
            }
          );
        }

        if (!isValidCSS(css)) {
          throw new Error(
            `❌ Invalid CSS from ${
              overrideEntry ? overrideEntry.override : url
            }`
          );
        }

        // 👇 Wrap in media query if link tag has a media attribute
        if (media && media.trim()) {
          console.log(`🎯 Wrapping ${fileName} with media: ${media}`);
          css = `@media ${media} {\n${css}\n}`;
        }

        cssContents.push({
          fileName,
          css,
          source: overrideEntry ? "local" : "remote",
        });
      } catch (err) {
        console.error(err.message);
        return res.status(400).send(err.message);
      }
    }

    const tempDir = path.join(__dirname, "temp_css");
    fs.mkdirSync(tempDir, { recursive: true });

    cssContents.forEach((entry, index) => {
      const baseName = entry.fileName || `cssfile-${index}.css`;
      const safeName = baseName.replace(/[^a-z0-9_.-]/gi, "_");
      const finalName = `original-${index}-${safeName}`;
      fs.writeFileSync(path.join(tempDir, finalName), entry.css);
      console.log(`💾 Saved: ${finalName} (${entry.source})`);
    });

    const purgedCSS = await purgeCSS(htmlData, cssContents);

    if (doSlitCSS) {
      // Split into media-specific files
      const splitCSS = await splitCSSByMedia(purgedCSS);

      const outputDir = path.join(__dirname, "public/css-split");
      fs.mkdirSync(outputDir, { recursive: true });

      const linkTags = [];

      for (const [key, css] of Object.entries(splitCSS)) {
        const fileName = `${key}.css`;
        const filePath = path.join(outputDir, fileName);
        fs.writeFileSync(filePath, css, "utf-8");

        const mediaAttr = key.startsWith("media-")
          ? ` media="${key.replace("media-", "").replace(/-/g, " ")}"`
          : "";

        linkTags.push(
          `<a  href="/css-split/${fileName}"${mediaAttr} target="_blank">${fileName}</a>`
        );
      }

      // Serve HTML preview
      res.send(`
        <h3>✅ Purged and Split CSS</h3>
        ${linkTags.join("<br/>")}
      `);
    }

    res.setHeader("Content-Type", "text/css");
    res.setHeader("Content-Disposition", 'filename="purged.css"');
    return res.send(purgedCSS);
  } catch (error) {
    console.error("❌ Server Error:", error);
    return res.status(500).send("Internal server error: " + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 CSS Purger Server running at: http://localhost:${PORT}`);
});
