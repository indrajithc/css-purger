const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");



const fileContent = fs.readFileSync(path.join(__dirname, "offline/em.html"), "utf-8");


const jsDom = new JSDOM(fileContent);


const scripts = jsDom.window.document.querySelectorAll('script');


const scriptContents = Array.from(scripts).map((script) => {
  return script.textContent || script.innerText || '[Empty]';
});



const scriptContentsToFile = scriptContents.join("\n\n========================================================\n\n");

fs.writeFileSync(path.join(__dirname, "offline/scriptContents.txt"), scriptContentsToFile, "utf-8");
