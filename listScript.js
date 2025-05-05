const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");

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
                    <div class="d-flex justify-content-between align-items-center">
                      <button class="btn btn-primary" id="load-scripts">Load script tags</button>
                      <div>
                        <input type='radio' name='show-type' value='pre' checked>
                        <label for='show-type'>Pre</label>
                        <input type='radio' name='show-type' value='textarea'>
                        <label for='show-type'>Textarea</label>
                      </div>
                      <h3 id="item-count"></h3>
                    </div>
                    <div id="info-container" style="overflow-y:auto; max-height:95vh;">
                      <h3>Loading...</h3>
                    </div>
                    <div>
                      <textarea readonly class="form-control w-100" id="complete-script" ></textarea>
                    </div>
                  </td>
                  <td> 
                    <iframe id="iframe-target" src="/htmls/${uniqueId}.html" style="width:100%; height:100%;" frameborder="0" scrolling="yes"></iframe>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <script type="text/javascript">
            (() => {
              const iframe = document.getElementById("iframe-target");
              const infoContainer = document.getElementById("info-container");
              const itemCount = document.getElementById("item-count");

              const updateInfo = () => {
                infoContainer.innerHTML = "<h3>Loading...</h3>";
                itemCount.innerHTML = "<h3>0</h3>";

                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                const scripts = iframeDoc.querySelectorAll("script");
                let scriptContents = [];

                const completeScripts = [];
                const showType = document.querySelector('input[name="show-type"]:checked').value;

                scripts.forEach(script => {
                  if (script?.innerHTML?.trim()) {
                    const content = script.innerHTML.trim();
                    scriptContents.push(showType === "pre" ? content : script.outerHTML);
                    completeScripts.push(content);
                  }
                });

                document.getElementById("complete-script").value = completeScripts.join("\\n\\n");
                itemCount.innerHTML = "<h3>Found " + scriptContents.length + " <script> tags</h3>";

                infoContainer.innerHTML = "<h3>&lt;script&gt; tags:</h3><ol class='nav-list'>" + scriptContents.map(content =>
                  "<li class='list-item'>" +
                  (showType === "pre"
                    ? "<div class='card mb-2'><div class='card-body'><pre>" + content + "</pre></div></div>"
                    : "<div class='card mb-2'><div class='card-body'><textarea class='form-control w-100'>" + content + "</textarea></div></div>") +
                  "</li>"
                ).join("") + "</ol>";
              };

              iframe.onload = () => {
                updateInfo();
                const loadButton = document.getElementById("load-scripts");
                loadButton.addEventListener("click", () => {
                  updateInfo();
                });
              };
            })()
          </script>
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
