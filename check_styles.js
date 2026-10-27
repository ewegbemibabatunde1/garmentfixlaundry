const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');

// Find all matches for .gfl-hero-title in CSS
const regex = /\.gfl-hero-title[^{]*\{([^}]+)\}/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log('Rule:', match[0]);
}

// Find all occurrences of color: in .gfl-hero
const heroBlock = content.match(/\/\* =+ *\r?\n *3\. Homepage Hero[\s\S]*?\/\* =+ *\r?\n *4\./);
if (heroBlock) {
  console.log('Hero block styles:\n', heroBlock[0]);
}
