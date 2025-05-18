const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const HTML_DOWNLOAD_DIR = path.resolve(__dirname, ".cache", "htmls");

const createDirIfNotExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const deleteDirectoryIfItsNotEmpty = (dir) => {
  try {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach((file) => {
        const curPath = path.join(dir, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          deleteDirectoryIfItsNotEmpty(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(dir);
    }
  } catch (error) {}
};

const renderInBody = (html) => {
  return `
    <!DOCTYPE html>
    <html lang="en" style="height:100%;">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HTML Page</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/css/bootstrap.min.css" rel="stylesheet" crossorigin="anonymous">
    </head>
    <body class="bg-light h-100">
      ${html}
    </body>
    </html>
  `;
};

const saveHtmlContentInFiles = async (url, uniqueId) => {
  const axios = require("axios");
  const tempDirectory = path.join(HTML_DOWNLOAD_DIR, "temp");

  deleteDirectoryIfItsNotEmpty(tempDirectory);
  createDirIfNotExists(tempDirectory);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const htmlContent = await response.text();
    return htmlContent;
    console.log(`HTML content saved to ${filePath}`);
  } catch (error) {
    console.error("Error fetching or saving HTML content:", error);
  }
  return null;
};

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/htmls/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(HTML_DOWNLOAD_DIR, filename);

  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Content-Length", Buffer.byteLength(fileContent));
    return res.send(fileContent);
  } else {
    res.status(404).send("File not found");
  }
});

app.all("/html", async (req, res) => {
  const method = req.method.toLowerCase();

  if (method === "post") {
    const targetUrl = req.body.url;
    const uniqueId = Date.now() + Math.floor(Math.random() * 1000);

  const htmlText=  await saveHtmlContentInFiles(targetUrl, uniqueId);

  const jsDom = new JSDOM(htmlText);
    const { document } = jsDom.window;

    const scripts = document.querySelectorAll('script');
    const tableData = [];
  
    scripts.forEach((script, index) => {
      tableData.push({
        Index: index,
        Src: script.src || 'Inline',
        Type: script.type || 'text/javascript',
        Async: script.async,
        Defer: script.defer,
        ContentPreview: script.textContent || script.innerText || '[Empty]'
      });
    });
   
    if (targetUrl) {
      return res.send(
        renderInBody(` 
          <textarea style="width:100vw; height:100vh;" readonly>${JSON.stringify(tableData)}</textarea>
        `)
      );
    }
  }

  res.send(
    renderInBody(`
      <h2>🔧 JS Script Extractor</h2> 
      <form method="post" action="/html">
        <input type="url" name="url" placeholder="Enter webpage URL" style="width:300px;" required />
        <button type="submit">Extract &lt;script&gt; Tags</button>
      </form>
    `)
  );
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
