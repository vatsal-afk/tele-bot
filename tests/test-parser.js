import { parseMessMenuFromText } from '../dist/services/groq.js';

async function runTests() {
  console.log("=== Testing Strict Format ===");
  const strictText = `
Mon: Poha, Tea | Rajma Chawal | Paneer, Roti
Tue: Idli, Sambhar | Chole Bhature | Dal Makhani
  `;
  const strictResult = await parseMessMenuFromText(strictText);
  console.log(JSON.stringify(strictResult, null, 2));

  console.log("\n=== Testing Tesseract OCR Format ===");
  // Tesseract usually separates columns with multiple spaces
  const ocrText = `
Monday   Poha, Jalebi   Rajma Rice, Salad   Dal Tadka, Roti
Tuesday  Plain Idli     Dal Moong Masoor    Chole Stuffed Poori
  `;
  const ocrResult = await parseMessMenuFromText(ocrText);
  console.log(JSON.stringify(ocrResult, null, 2));
}

runTests();
