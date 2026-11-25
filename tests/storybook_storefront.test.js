const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { app } = require("../server/index");

const WEBSITE_DIR = path.join(__dirname, "..", "website");

describe("Storybook Storefront Multi-Page UX & Stationery Inquiry Suite", () => {
  let server;
  let baseUrl;
  let rootUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        rootUrl = `http://127.0.0.1:${port}`;
        baseUrl = `${rootUrl}/api/v1`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test("All 8 storybook HTML views exist and load storybook.css, storybook-ui.js, themes.css, and theme-switcher.js", () => {
    const pages = [
      "index.html",
      "catalog.html",
      "hamper.html",
      "moments.html",
      "how-it-works.html",
      "faq.html",
      "contact.html",
      "delivered.html"
    ];
    for (const file of pages) {
      const html = fs.readFileSync(path.join(WEBSITE_DIR, file), "utf8");
      assert.ok(html.includes('href="storybook.css"'), `${file} must load storybook.css`);
      assert.ok(html.includes('href="themes.css"'), `${file} must load themes.css`);
      assert.ok(html.includes('src="theme-switcher.js"'), `${file} must load theme-switcher.js`);
      assert.ok(html.includes('src="storybook-ui.js"'), `${file} must load storybook-ui.js`);
      assert.ok(html.includes('class="nav sb-nav"'), `${file} must render scalloped storybook navbar`);
      if (file !== "index.html") {
        assert.ok(html.includes('href="index.html?openTracking=1"'), `${file} must expose Track nav link`);
        assert.ok(html.includes('class="mobile-bar"'), `${file} must include bottom mobile dock bar`);
      }
    }
  });

  test("Subpage scripts, builder wiring, recommendations, and Studio OS inquiries queue are present", () => {
    const storybookUi = fs.readFileSync(path.join(WEBSITE_DIR, "storybook-ui.js"), "utf8");
    const mainScript = fs.readFileSync(path.join(WEBSITE_DIR, "script.js"), "utf8");
    const adminHtml = fs.readFileSync(path.join(WEBSITE_DIR, "admin.html"), "utf8");
    const hamperHtml = fs.readFileSync(path.join(WEBSITE_DIR, "hamper.html"), "utf8");

    assert.ok(storybookUi.includes("initScrollProgressAndBackTop"));
    assert.ok(storybookUi.includes("sb-scroll-progress"));
    assert.ok(storybookUi.includes("initWhatsAppPhoneReveal"));
    assert.ok(storybookUi.includes("detail-recommendations-grid"));
    assert.ok(hamperHtml.includes('id="detail-recommendations-grid"'));

    assert.ok(mainScript.includes("function addItemToCart("));
    assert.ok(mainScript.includes('data-step="2"'));
    assert.ok(mainScript.includes("dataset.ribbonId"));
    assert.ok(mainScript.includes("dataset.waxId"));
    assert.ok(mainScript.includes("polaroid-upload-input"));

    assert.ok(adminHtml.includes("Stationery Letters"));
    assert.ok(adminHtml.includes('id="inquiries-grid"'));
    assert.ok(adminHtml.includes("/api/v1/inquiries"));
  });

  test("Craft Storybook theme preset is registered in themes.css and theme-switcher.js", () => {
    const css = fs.readFileSync(path.join(WEBSITE_DIR, "themes.css"), "utf8");
    const js = fs.readFileSync(path.join(WEBSITE_DIR, "theme-switcher.js"), "utf8");
    assert.ok(css.includes('[data-theme="craft-storybook"]'));
    assert.ok(js.includes('id: "craft-storybook"'));
  });

  test("Homepage includes all 8 storybook scenes and Polaroid lightbox", () => {
    const html = fs.readFileSync(path.join(WEBSITE_DIR, "index.html"), "utf8");
    assert.ok(html.includes("sb-hero"));
    assert.ok(html.includes("sb-door-card"));
    assert.ok(html.includes("sb-paths"));
    assert.ok(html.includes("sb-phone-mockup"));
    assert.ok(html.includes("sb-passport-book"));
    assert.ok(html.includes("sb-polaroid-wall"));
    assert.ok(html.includes("polaroid-lightbox"));
    assert.ok(html.includes("sb-night"));
    assert.ok(html.includes("sb-footer"));
  });

  test("Clean extensionless page routes serve HTTP 200 HTML across all storefront subpages", async () => {
    for (const route of ["/", "/catalog", "/hamper", "/moments", "/how-it-works", "/faq", "/contact", "/delivered"]) {
      const res = await fetch(`${rootUrl}${route}`);
      assert.equal(res.status, 200, `${route} should return 200`);
      const text = await res.text();
      assert.ok(text.includes("Hampers by Her"), `${route} should render Hampers by Her page`);
    }
  });

  test("GET /api/v1/catalog/archives returns archived edition ticket cards", async () => {
    const res = await fetch(`${baseUrl}/catalog/archives`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.count >= 4);
    assert.ok(json.data.items[0].deliveredTag.includes("ATELIER"));
  });

  test("POST /api/v1/inquiries validates input, scores lead, and persists stationery letter", async () => {
    const badRes = await fetch(`${baseUrl}/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A", phone: "12" })
    });
    assert.equal(badRes.status, 400);

    const okRes = await fetch(`${baseUrl}/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Anaya Mehta",
        phone: "+91 9876543210",
        email: "anaya@example.com",
        city: "Pune",
        hamperId: "prod_wedding_vows",
        message: "Need 50 wedding hampers for bridesmaid favors!"
      })
    });
    assert.equal(okRes.status, 201);
    const json = await okRes.json();
    assert.equal(json.success, true);
    assert.ok(json.data.inquiry.id.startsWith("INQ-"));
    assert.equal(json.data.inquiry.priorityTier, "P1");
    assert.ok(json.data.waMeUrl.includes("wa.me"));

    // Tampered token rejected on GET /inquiries
    const unauthRes = await fetch(`${baseUrl}/inquiries`, {
      headers: { Authorization: "Bearer invalid.jwt.token" }
    });
    assert.equal(unauthRes.status, 401);

    // Valid retrieval in dev mode
    const listRes = await fetch(`${baseUrl}/inquiries`);
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    assert.ok(listJson.data.items.some((inq) => inq.id === json.data.inquiry.id));
  });
});
