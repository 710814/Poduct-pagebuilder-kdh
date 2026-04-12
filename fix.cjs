const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

// Replace standard gasUrl checks with true
code = code.replace(/if\s*\(gasUrl[^\{]+\{/g, "if (true) {");

// Remove everything related to normalizeUrlForComparison, gasUrl, DEFAULT_GAS_URL, isDefaultUrl
code = code.replace(/.*normalizedGasUrl.*\n/g, "");
code = code.replace(/.*normalizedDefaultUrl.*\n/g, "");
code = code.replace(/.*isDefaultUrl.*\n/g, "");
code = code.replace(/.*gasUrl.*\n/g, "");
code = code.replace(/.*DEFAULT_GAS_URL.*\n/g, "");

// Fix the actual normalizeUrlForComparison function declaration and body, since we just removed lines.
// It might be broken if we only removed lines containing the words.
// Let's just remove the function if it still exists.
code = code.replace(/function normalizeUrlForComparison.*?\}\n/s, "");

fs.writeFileSync('services/geminiService.ts', code);
console.log("Success");
