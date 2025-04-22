# 🧹 CSS Purger

A simple Node.js utility to remove unused CSS based on your HTML content.

---

## 🚀 Overview

This project reads your HTML files and CSS files, analyzes which selectors are actually used, and outputs a new, clean CSS file containing only the styles that are needed.

This helps reduce your final CSS size and improves page performance.

---

## 💡 Features

- ⚡ Removes unused CSS rules.
- 📄 Supports raw HTML or multiple HTML files.
- 🔥 Easy to integrate into build scripts.
- 🧱 Based on `@fullhuman/postcss-purgecss`.

---

## 📦 Installation

1. Clone this repository:

```bash
git clone https://github.com/indrajithc/css-purger.git
cd css-purger
```

2. Install dependencies:

```bash
npm install
```

---

## 🛠 Usage

1. Place your **HTML content** in `index.html`.
2. Place your **CSS file** in `styles.css`.

3. Run the purger:

```bash
node purge.js
```

4. The cleaned CSS will be saved as:

```
./purged.css
```

---

## ⚙️ Configuration

By default, the script looks for:

| Input File         | Description              |
|---------------------|--------------------------|
| `index.html`        | Your HTML content file   |
| `styles.css`        | The full CSS stylesheet  |
| `purged.css`        | Output file with only used CSS |

You can modify `purge.js` to match your folder structure or add multiple files.

---

## 💡 Example

**HTML:**

```html
<div class="button active">Click Me</div>
```

**CSS:**

```css
.button { padding: 10px; }
.active { background: blue; }
.unused { display: none; }
```

After running the script, the `purged.css` will only contain:

```css
.button { padding: 10px; }
.active { background: blue; }
```

---

## 📜 License

MIT License.

---

## 🙌 Contributing

Pull requests are welcome! If you have ideas for improvements or new features, feel free to open an issue or submit a PR.

---

## 💬 Contact

Made with ❤️ by [Indrajith C](https://github.com/indrajithc).

 