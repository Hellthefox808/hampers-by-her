/**
 * HAMPERS BY HER — ANDROID APK BUILD & PACKAGING PIPELINE
 * 
 * Uses local Android SDK toolchain:
 * - AAPT2: Compiles Android XML & binary resources
 * - AAPT2 Link: Generates R.java and initial APK package
 * - Javac (JDK 25): Compiles Java sources against android-36.1 android.jar
 * - D8: Converts Java bytecode into Dalvik/ART classes.dex
 * - Jar / Zip: Injects classes.dex into APK
 * - Zipalign: 4-byte optimizes uncompressed resource alignment
 * - Apksigner: Cryptographically signs APK with Android debug keystore
 * - Apksigner Verify: Ensures V1/V2/V3 APK signature integrity
 * 
 * Outputs: dist/HampersByHer-VoiceAI.apk
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const ANDROID_DIR = path.join(ROOT_DIR, "android");
const APP_DIR = path.join(ANDROID_DIR, "app", "src", "main");
const BUILD_DIR = path.join(ANDROID_DIR, "build");
const DIST_DIR = path.join(ROOT_DIR, "dist");

// Locate Android SDK & JDK
const LOCAL_APP_DATA = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, "AppData", "Local");
const SDK_DIR = path.join(LOCAL_APP_DATA, "Android", "Sdk");
const BUILD_TOOLS_DIR = path.join(SDK_DIR, "build-tools", "36.0.0");
const PLATFORM_DIR = path.join(SDK_DIR, "platforms", "android-36.1");
const ANDROID_JAR = path.join(PLATFORM_DIR, "android.jar");

const AAPT2 = path.join(BUILD_TOOLS_DIR, "aapt2.exe");
const D8 = path.join(BUILD_TOOLS_DIR, "d8.bat");
const ZIPALIGN = path.join(BUILD_TOOLS_DIR, "zipalign.exe");
const APKSIGNER = path.join(BUILD_TOOLS_DIR, "apksigner.bat");

const JDK_BIN = "C:\\Program Files\\Java\\jdk-25\\bin";
const JAVAC = path.join(JDK_BIN, "javac.exe");
const JAR = path.join(JDK_BIN, "jar.exe");
const KEYTOOL = path.join(JDK_BIN, "keytool.exe");

function checkPrerequisites() {
  console.log("--> Verifying build toolchain prerequisites...");
  const tools = [
    { name: "Android JAR", path: ANDROID_JAR },
    { name: "AAPT2", path: AAPT2 },
    { name: "D8", path: D8 },
    { name: "Zipalign", path: ZIPALIGN },
    { name: "Apksigner", path: APKSIGNER },
    { name: "Javac", path: JAVAC },
    { name: "Jar", path: JAR },
    { name: "Keytool", path: KEYTOOL }
  ];

  for (const tool of tools) {
    if (!fs.existsSync(tool.path)) {
      throw new Error(`Required tool not found: ${tool.name} at ${tool.path}`);
    }
    console.log(`  ✔ Found ${tool.name}`);
  }
}

function prepareDirs() {
  console.log("--> Cleaning and creating build output directories...");
  if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.mkdirSync(path.join(BUILD_DIR, "gen"), { recursive: true });
  fs.mkdirSync(path.join(BUILD_DIR, "classes"), { recursive: true });
  fs.mkdirSync(path.join(BUILD_DIR, "dex"), { recursive: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

function runCmd(cmd, desc) {
  console.log(`\n--> [${desc}]`);
  console.log(`$ ${cmd}`);
  const out = execSync(cmd, { cwd: ROOT_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (out.trim()) {
    console.log(out.trim());
  }
  return out;
}

function compileResources() {
  const resDir = path.join(APP_DIR, "res");
  const compiledResZip = path.join(BUILD_DIR, "compiled_res.zip");
  runCmd(`"${AAPT2}" compile --dir "${resDir}" -o "${compiledResZip}"`, "1. AAPT2 Compile Resources");
  return compiledResZip;
}

function linkResources(compiledResZip) {
  const manifest = path.join(APP_DIR, "AndroidManifest.xml");
  const genDir = path.join(BUILD_DIR, "gen");
  const unalignedApk = path.join(BUILD_DIR, "unaligned_unsigned.apk");

  runCmd(
    `"${AAPT2}" link -I "${ANDROID_JAR}" --manifest "${manifest}" --java "${genDir}" --min-sdk-version 26 --target-sdk-version 36 --version-code 1 --version-name "1.0.0" -o "${unalignedApk}" "${compiledResZip}" --auto-add-overlay`,
    "2. AAPT2 Link Resources & Generate R.java"
  );
  return unalignedApk;
}

function getAllFiles(dir, ext) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

function compileJavaSources() {
  const javaSrcDir = path.join(APP_DIR, "java");
  const genDir = path.join(BUILD_DIR, "gen");
  const classesDir = path.join(BUILD_DIR, "classes");

  const appJavaFiles = getAllFiles(javaSrcDir, ".java");
  const rJavaFiles = getAllFiles(genDir, ".java");
  const allJavaFiles = [...appJavaFiles, ...rJavaFiles];

  console.log(`Found ${allJavaFiles.length} Java source files to compile.`);

  // Write sources list file to prevent command line length overflow
  const sourcesListPath = path.join(BUILD_DIR, "sources.txt");
  fs.writeFileSync(sourcesListPath, allJavaFiles.map(f => `"${f.replace(/\\/g, "/")}"`).join("\n"), "utf8");

  runCmd(
    `"${JAVAC}" -encoding UTF-8 -source 17 -target 17 -cp "${ANDROID_JAR}" -d "${classesDir}" @"${sourcesListPath}"`,
    "3. Javac Compile Java Sources (Java 17 target)"
  );

  return classesDir;
}

function dexClasses(classesDir) {
  const classFiles = getAllFiles(classesDir, ".class");
  console.log(`Found ${classFiles.length} compiled class files for D8.`);

  const dexDir = path.join(BUILD_DIR, "dex");
  const classListPath = path.join(BUILD_DIR, "classes.txt");
  fs.writeFileSync(classListPath, classFiles.map(f => `"${f.replace(/\\/g, "/")}"`).join(" "), "utf8");

  // Run D8
  const classFilesArg = fs.readFileSync(classListPath, "utf8");
  runCmd(
    `"${D8}" --min-api 26 --output "${dexDir}" ${classFilesArg}`,
    "4. D8 Convert Bytecode to Dalvik/ART classes.dex"
  );

  const classesDex = path.join(dexDir, "classes.dex");
  if (!fs.existsSync(classesDex)) {
    throw new Error("D8 failed to generate classes.dex");
  }
  return classesDex;
}

function injectDexIntoApk(unalignedApk, classesDex) {
  console.log("\n--> [5. Inject classes.dex into APK Archive]");
  const dexDir = path.dirname(classesDex);
  runCmd(
    `"${JAR}" uf "${unalignedApk}" -C "${dexDir}" classes.dex`,
    "Add classes.dex to APK via jar"
  );
}

function zipalignApk(unalignedApk) {
  const alignedApk = path.join(BUILD_DIR, "aligned_unsigned.apk");
  runCmd(
    `"${ZIPALIGN}" -p -f 4 "${unalignedApk}" "${alignedApk}"`,
    "6. Zipalign 4-byte optimize APK"
  );
  return alignedApk;
}

function getOrCreateKeystore() {
  const keystorePath = path.join(ANDROID_DIR, "debug.keystore");
  if (!fs.existsSync(keystorePath)) {
    console.log("Generating development debug keystore...");
    runCmd(
      `"${KEYTOOL}" -genkeypair -validity 10000 -dname "CN=Android Debug,O=Android,C=US" -keystore "${keystorePath}" -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048`,
      "Generate debug keystore"
    );
  }
  return keystorePath;
}

function signApk(alignedApk, keystorePath) {
  const finalApk = path.join(DIST_DIR, "HampersByHer-VoiceAI.apk");
  runCmd(
    `"${APKSIGNER}" sign --ks "${keystorePath}" --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out "${finalApk}" "${alignedApk}"`,
    "7. Apksigner Sign APK with debug key"
  );
  return finalApk;
}

function verifyApk(finalApk) {
  const out = runCmd(`"${APKSIGNER}" verify --verbose "${finalApk}"`, "8. Apksigner Verify APK Integrity");
  console.log("\nAPK Details via AAPT2 Dump Badging:");
  const badging = runCmd(`"${AAPT2}" dump badging "${finalApk}"`, "9. Inspect APK Package Metadata");
  
  const stats = fs.statSync(finalApk);
  console.log("\n==================================================================");
  console.log("  SUCCESSFULLY BUILT AND SIGNED ANDROID APK!");
  console.log(`  Output APK:    ${finalApk}`);
  console.log(`  File Size:     ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`  Package:       com.hampersbyher.voiceai`);
  console.log(`  Target SDK:    36 (Android 16 / 15 / 14 / 8.0+)`);
  console.log("==================================================================\n");
}

function main() {
  console.log("==================================================================");
  console.log("  HAMPERS BY HER — ATELIER VOICE AI ANDROID APK BUILDER");
  console.log("==================================================================");

  const startTime = Date.now();
  checkPrerequisites();
  prepareDirs();

  const compiledResZip = compileResources();
  const unalignedApk = linkResources(compiledResZip);
  const classesDir = compileJavaSources();
  const classesDex = dexClasses(classesDir);
  injectDexIntoApk(unalignedApk, classesDex);
  const alignedApk = zipalignApk(unalignedApk);
  const keystorePath = getOrCreateKeystore();
  const finalApk = signApk(alignedApk, keystorePath);
  verifyApk(finalApk);

  console.log(`Build completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("\n❌ Build failed:", err.message);
    process.exit(1);
  }
}

module.exports = { main };
