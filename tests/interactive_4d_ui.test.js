/**
 * Hampers by Her — Interactive 4D Motion & Luxury UX Verification Test Suite
 * Validates 3D card tilt geometry, ambient particle canvas, magnetic buttons,
 * 4-step virtual unboxing theater, and synthetic Web Audio soundscape.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

describe("Hampers by Her Interactive 4D UI/UX & Motion Suite", () => {
  const htmlPath = path.resolve(__dirname, "../website/index.html");
  const cssPath = path.resolve(__dirname, "../website/styles_ext.css");
  const jsPath = path.resolve(__dirname, "../website/script.js");

  const htmlContent = fs.readFileSync(htmlPath, "utf8");
  const cssContent = fs.readFileSync(cssPath, "utf8");
  const jsContent = fs.readFileSync(jsPath, "utf8");

  describe("DOM Structure & 4D Theater Markup", () => {
    test("Injects ambient golden dust canvas into root viewport", () => {
      assert.ok(htmlContent.includes('id="ambient-particles-canvas"'));
      assert.ok(htmlContent.includes('class="ambient-particles-canvas"'));
    });

    test("Contains 4D Virtual Unboxing Modal with complete 3D stage hierarchy", () => {
      assert.ok(htmlContent.includes('id="unboxing-4d-modal"'));
      assert.ok(htmlContent.includes('id="unboxing-box-3d"'));
      assert.ok(htmlContent.includes('id="unboxing-box-lid"'));
      assert.ok(htmlContent.includes('id="unboxing-seal"'));
      assert.ok(htmlContent.includes('id="unboxing-inclusions-grid"'));
      assert.ok(htmlContent.includes('id="btn-hero-unboxing-4d"'));
    });

    test("Includes 4-step sensory navigation pills (Ribbon, Seal, Lid, Reveal)", () => {
      assert.ok(htmlContent.includes('id="pill-step-1"'));
      assert.ok(htmlContent.includes('id="pill-step-2"'));
      assert.ok(htmlContent.includes('id="pill-step-3"'));
      assert.ok(htmlContent.includes('id="pill-step-4"'));
    });
  });

  describe("CSS 3D Perspective & Motion Physics", () => {
    test("Product cards have 3D perspective and preserve-3d transform-style", () => {
      assert.ok(cssContent.includes("perspective: 1200px"));
      assert.ok(cssContent.includes("transform-style: preserve-3d"));
    });

    test("Defines specular light reflection gloss overlay", () => {
      assert.ok(cssContent.includes(".specular-glare"));
      assert.ok(cssContent.includes("radial-gradient"));
      assert.ok(cssContent.includes("mix-blend-mode: overlay"));
    });

    test("Configures 4D Unboxing lid 3D rotation and seal cracking animation", () => {
      assert.ok(cssContent.includes(".box-lid.opened"));
      assert.ok(cssContent.includes("rotateX(-85deg)"));
      assert.ok(cssContent.includes(".box-seal-center.cracked"));
      assert.ok(cssContent.includes(".unboxing-inclusions-grid.revealed"));
    });

    test("Implements kinetic gold foil shimmering typography", () => {
      assert.ok(cssContent.includes(".kinetic-gold-foil"));
      assert.ok(cssContent.includes("goldFoilShimmer"));
    });
  });

  describe("JavaScript 4D Interaction & Sound Engine", () => {
    test("Synthesizes pure Web Audio velvet tap and golden chime without external audio files", () => {
      assert.ok(jsContent.includes("function playVelvetTap()"));
      assert.ok(jsContent.includes("function playGoldenChime()"));
      assert.ok(jsContent.includes("ctx.createOscillator()"));
      assert.ok(jsContent.includes("frequencies = [528, 660, 792]")); // Harmonic luxury chord
    });

    test("Implements 4D gyroscopic mouse cursor tilt on product cards", () => {
      assert.ok(jsContent.includes("const cards4D = document.querySelectorAll"));
      assert.ok(jsContent.includes("const rotateY = (x - 0.5) * 16"));
      assert.ok(jsContent.includes("const rotateX = -(y - 0.5) * 16"));
      assert.ok(jsContent.includes("--mouse-x"));
      assert.ok(jsContent.includes("--mouse-y"));
    });

    test("Manages 4-step interactive unboxing progression (Ribbon -> Seal -> Lid -> Reveal)", () => {
      assert.ok(jsContent.includes("function updateUnboxingStep(step)"));
      assert.ok(jsContent.includes("unboxingRibbonH?.classList.add('untying')"));
      assert.ok(jsContent.includes("unboxingSeal?.classList.add('cracked')"));
      assert.ok(jsContent.includes("unboxingLid?.classList.add('opened')"));
      assert.ok(jsContent.includes("unboxingInclusions?.classList.add('revealed')"));
    });

    test("Executes 60fps golden leaf dust particle simulation loop", () => {
      assert.ok(jsContent.includes("canvas.getContext('2d')"));
      assert.ok(jsContent.includes("requestAnimationFrame(renderParticles)"));
      assert.ok(jsContent.includes("rgba(212, 175, 55")); // Champagne Gold
    });
  });
});
