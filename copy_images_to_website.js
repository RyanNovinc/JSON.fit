const fs = require('fs');
const path = require('path');

// Exact slugifyImage transform from the website
function slugifyImage(f) {
  if (!f) return '';
  var ext = (f.match(/\.(png|jpe?g|webp)$/i) || ['', 'png'])[1].toLowerCase();
  var base = f.replace(/\.(png|jpe?g|webp)$/i, '');
  var slug = base.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-').toLowerCase();
  return slug + '.' + ext;
}

console.log('=== COPYING IMAGES TO WEBSITE FORMAT ===\n');

// 1. Parse meals.json to get all image_filename values
const mealsData = JSON.parse(fs.readFileSync('meals.json', 'utf8'));
const allImageFilenames = new Set();

Object.values(mealsData).forEach(meal => {
  if (meal.image_filename) {
    allImageFilenames.add(meal.image_filename);
  }
  
  if (meal.plates) {
    meal.plates.forEach(plate => {
      if (plate.image_filename) {
        allImageFilenames.add(plate.image_filename);
      }
    });
  }
});

console.log(`Found ${allImageFilenames.size} unique image_filename values to process\n`);

// 2. Check source directory
const sourceDir = 'src/assets/meals';
const targetDir = 'images/meals';

if (!fs.existsSync(sourceDir)) {
  console.error(`Source directory ${sourceDir} does not exist!`);
  process.exit(1);
}

const sourceFiles = new Set(fs.readdirSync(sourceDir));
console.log(`Found ${sourceFiles.size} files in ${sourceDir}/\n`);

// 3. Process each image_filename
const results = [];
let copied = 0;
let alreadyExists = 0;
let notFound = 0;

console.log('Processing images...\n');
console.log('| Original Filename | Expected Slug | Source File | Status |');
console.log('|-------------------|---------------|-------------|--------|');

allImageFilenames.forEach(originalFilename => {
  const expectedSlug = slugifyImage(originalFilename);
  const targetPath = path.join(targetDir, expectedSlug);
  
  // Try to find matching source file
  let sourceFile = null;
  let status = '';
  
  // First, try exact match
  if (sourceFiles.has(originalFilename)) {
    sourceFile = originalFilename;
  }
  
  // If not found, try to find a close match based on the app's naming patterns
  if (!sourceFile) {
    // The app uses snake_case versions, so try converting the original
    const snakeCaseVersion = originalFilename
      .replace(/\s+/g, '_')
      .replace(/[()]/g, '')
      .replace(/&/g, 'and')
      .replace(/⚡/g, '')
      .replace(/[^\w.-]/g, '')
      .toLowerCase();
    
    if (sourceFiles.has(snakeCaseVersion)) {
      sourceFile = snakeCaseVersion;
    }
  }
  
  // If still not found, try some common patterns from what we know about the app
  if (!sourceFile) {
    // Try matching patterns from the registry we saw earlier
    const patterns = [
      originalFilename.replace('Butter Chicken with Basmati Rice.png', 'butter_chicken_with_rice.png'),
      originalFilename.replace('Massaman Beef Curry with Rice.png', 'massaman_rice.png'),
      originalFilename.replace('Chicken Schnitzel.png', 'chicken_schnitzel.png'),
      originalFilename.replace('Chicken Parma (parma).png', 'chicken_parma_parma.png'),
      originalFilename.replace('cevapi_with_flatbread.png', 'cevapi_flatbread.png'),
      // Add more patterns based on the app registry
    ];
    
    for (const pattern of patterns) {
      if (sourceFiles.has(pattern)) {
        sourceFile = pattern;
        break;
      }
    }
  }
  
  if (sourceFile) {
    const sourcePath = path.join(sourceDir, sourceFile);
    
    if (fs.existsSync(targetPath)) {
      status = '✓ Already exists';
      alreadyExists++;
    } else {
      try {
        fs.copyFileSync(sourcePath, targetPath);
        status = '✓ Copied';
        copied++;
      } catch (err) {
        status = `❌ Copy failed: ${err.message}`;
        notFound++;
      }
    }
    
    console.log(`| ${originalFilename} | ${expectedSlug} | ${sourceFile} | ${status} |`);
  } else {
    status = '❌ Source not found';
    notFound++;
    console.log(`| ${originalFilename} | ${expectedSlug} | - | ${status} |`);
  }
  
  results.push({
    original: originalFilename,
    slug: expectedSlug,
    sourceFile: sourceFile,
    status: status
  });
});

console.log(`\nSUMMARY:`);
console.log(`- ${copied} files copied`);
console.log(`- ${alreadyExists} files already existed`);
console.log(`- ${notFound} files not found in source`);

if (notFound > 0) {
  console.log(`\nMISSING SOURCE FILES:`);
  results.filter(r => r.status.includes('not found')).forEach(r => {
    console.log(`  ${r.original} -> ${r.slug}`);
  });
}

// Generate WebP variants for any PNG lacking a .webp sibling
console.log('\n=== GENERATING WEBP VARIANTS ===');
let webpGenerated = 0;
let webpExisted = 0;

if (fs.existsSync(targetDir)) {
  const existingFiles = fs.readdirSync(targetDir);
  const pngFiles = existingFiles.filter(f => f.endsWith('.png'));
  
  console.log(`Found ${pngFiles.length} PNG files to check for WebP variants\n`);
  
  pngFiles.forEach(pngFile => {
    const webpFile = pngFile.replace('.png', '.webp');
    const pngPath = path.join(targetDir, pngFile);
    const webpPath = path.join(targetDir, webpFile);
    
    if (fs.existsSync(webpPath)) {
      webpExisted++;
    } else {
      try {
        // Check if cwebp is available
        const { execSync } = require('child_process');
        
        // Generate WebP using sips to first resize, then cwebp to convert
        const tempResized = `/tmp/resized_${pngFile}`;
        
        // Resize to max 1600px keeping aspect ratio
        execSync(`sips -Z 1600 "${pngPath}" --out "${tempResized}"`, { stdio: 'pipe' });
        
        // Convert to WebP at quality ~80
        execSync(`cwebp -q 80 "${tempResized}" -o "${webpPath}"`, { stdio: 'pipe' });
        
        // Clean up temp file
        if (fs.existsSync(tempResized)) {
          fs.unlinkSync(tempResized);
        }
        
        webpGenerated++;
        console.log(`  ✅ Generated: ${webpFile}`);
        
      } catch (error) {
        console.log(`  ❌ Failed to generate WebP for ${pngFile}: ${error.message}`);
      }
    }
  });
  
  console.log(`\nWEBP SUMMARY:`);
  console.log(`- ${webpGenerated} WebP files generated`);
  console.log(`- ${webpExisted} WebP files already existed`);
} else {
  console.log(`Target directory ${targetDir} does not exist - skipping WebP generation`);
}