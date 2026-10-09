import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The wiki pages are plain markdown with relative `.md` links and a leading `# Title`.
// Starlight renders the title itself and serves pages at clean URLs, so:
//   1. drop the first H1 (it duplicates the frontmatter title),
//   2. rewrite relative `.md` links to absolute clean URLs.
const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/wiki');

function toUrl(filePath) {
  let rel = path.relative(docsRoot, filePath).split(path.sep).join('/');
  rel = rel.replace(/\.md$/, '').replace(/(^|\/)index$/, '');
  return '/' + rel + (rel ? '/' : '');
}

function walk(node, fn) {
  fn(node);
  if (node.children) for (const child of node.children) walk(child, fn);
}

export default function remarkWikiLinks() {
  return (tree, file) => {
    const sourcePath = file.path;
    if (!sourcePath || !path.resolve(sourcePath).startsWith(docsRoot)) return;

    const h1 = tree.children.findIndex((n) => n.type === 'heading' && n.depth === 1);
    if (h1 !== -1) tree.children.splice(h1, 1);

    const fromDir = path.dirname(sourcePath);
    walk(tree, (node) => {
      if (node.type !== 'link' || !node.url) return;
      const match = node.url.match(/^([^#?]+\.md)(#.*)?$/);
      if (!match || /^[a-z]+:/i.test(match[1])) return;
      node.url = toUrl(path.resolve(fromDir, match[1])) + (match[2] ?? '');
    });
  };
}
