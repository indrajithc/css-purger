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
  const fs = require("fs");
  const axios = require("axios");

  const tempDirectory = path.join(HTML_DOWNLOAD_DIR, "temp");

  deleteDirectoryIfItsNotEmpty(tempDirectory);
  await createDirIfNotExists(tempDirectory);

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

    console.log("HTML content fetched successfully.");

    // Save the HTML content to a file
    const filePath = path.join(HTML_DOWNLOAD_DIR, `${uniqueId}.html`);
    fs.writeFileSync(filePath, htmlContent);
    console.log(`HTML content saved to ${filePath}`);
  } catch (error) {
    console.error("Error fetching or saving HTML content:", error);
  }
};

app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/htmls/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(HTML_DOWNLOAD_DIR, filename);
  console.log("File path:", filePath);

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

    await saveHtmlContentInFiles(targetUrl, uniqueId);

    if (targetUrl) {
      return res.send(
        renderInBody(`
       <div class="w-100 h-100">
        <table class="table table-bordered h-100">

        <tbody>
          <tr>
            <td width="50%" style="max-width:50vw;">
            <div id="info-container"></div>
            </td>
            <td> 
            <iframe id="iframe-target" src="/htmls/${uniqueId}.html" style="width:100%; height:100%;" frameborder="0" scrolling="yes"></iframe>
            </td>
          </tr>
        </tbody>
        </table>
       </div>
       <script type="text/javascript">
        (()=>{
          
          const iframe = document.getElementById("iframe-target");
          const infoContainer = document.getElementById("info-container");

          const updateInfo = () => {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const styles = iframeDoc.querySelectorAll("style");
            let cssLinks = [];

            styles.forEach(style => {
              if (style?.innerHTML?.trim()) {
                cssLinks.push(style.innerHTML);
              }
            });
            
            infoContainer.innerHTML = "<h3>CSS Links:</h3><ol class='nav-list'>" + cssLinks.map(link => 
             "<li class='list-item'>"+
             "<div class='card mb-2'><div class='card-body'><pre>" + link + "</pre></div></div>" +
             
             "</li>"
              ).join("") + "</ol>";
          };
          iframe.onload = () => {
            updateInfo();
            setInterval(updateInfo, 5000); // Update every 5 seconds
          };

          })()

       </script>
      `)
      );
    }
  }

  res.send(
    renderInBody(`
       <h2>🔧 CSS Purger Service</h2> 
          <form method="post" action="/html">
              <input type="url" name="url" placeholder="Enter webpage URL" style="width:300px;" required />
              <button type="submit">Purge CSS</button>
          </form>
    `)
  );
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
