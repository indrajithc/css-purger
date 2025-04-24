const postcss = require("postcss");

async function splitCSSByMedia(cssInput) {
  const root = postcss.parse(cssInput);

  const baseCSS = postcss.root();
  const mediaGroups = {}; // mediaQuery -> postcss.root()

  root.nodes.forEach((node) => {
    if (node.type === "atrule" && node.name === "media") {
      const media = node.params.trim();
      if (!mediaGroups[media]) {
        mediaGroups[media] = postcss.root();
      }
      mediaGroups[media].append(node.clone());
    } else {
      baseCSS.append(node.clone());
    }
  });

  const results = {
    base: baseCSS.toString(),
  };

  for (const media in mediaGroups) {
    const sanitized = media
      .replace(/[^\w-]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase();
    results[`media-${sanitized}`] = mediaGroups[media].toString();
  }

  return results;
}
module.exports = splitCSSByMedia;
