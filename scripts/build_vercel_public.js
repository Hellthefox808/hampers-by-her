/**
 * Prepares `public/` for Vercel CDN static asset delivery from `website/` + `docs/diagrams/`.
 * Local development continues to work seamlessly directly from `website/`.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC_WEBSITE = path.join(ROOT, "website");
const DEST_PUBLIC = path.join(ROOT, "public");
const ARCH_HTML = path.join(ROOT, "docs", "diagrams", "hampers_by_her_architecture.html");

function buildVercelPublic() {
  if (!fs.existsSync(SRC_WEBSITE)) {
    throw new Error(`Missing source website directory: ${SRC_WEBSITE}`);
  }

  fs.rmSync(DEST_PUBLIC, { recursive: true, force: true });
  fs.mkdirSync(DEST_PUBLIC, { recursive: true });
  fs.cpSync(SRC_WEBSITE, DEST_PUBLIC, { recursive: true });

  if (fs.existsSync(ARCH_HTML)) {
    fs.copyFileSync(ARCH_HTML, path.join(DEST_PUBLIC, "architecture.html"));
  }

  return DEST_PUBLIC;
}

if (require.main === module) {
  const out = buildVercelPublic();
  const count = fs.readdirSync(out).length;
  console.log(`[vercel-build] Synced static storefront assets into ${out} (${count} top-level entries).`);
}

module.exports = { buildVercelPublic };
