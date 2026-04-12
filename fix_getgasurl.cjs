const fs = require('fs');

// Fix SettingsModal.tsx
let settingsPath = 'components/SettingsModal.tsx';
let settingsContent = fs.readFileSync(settingsPath, 'utf8');
settingsContent = settingsContent.replace(/import \{ getGasUrl.*\} from '\.\.\/services\/googleSheetService';/, "import { isFirebaseConnected } from '../services/firebaseService';");
fs.writeFileSync(settingsPath, settingsContent);

// Fix StepResult.tsx
let stepPath = 'components/StepResult.tsx';
let stepContent = fs.readFileSync(stepPath, 'utf8');
stepContent = stepContent.replace(/\{getGasUrl\(\) === DEFAULT_GAS_URL && \(/g, "{!isFirebaseConnected() && (");
fs.writeFileSync(stepPath, stepContent);

// Fix geminiService.ts
let geminiPath = 'services/geminiService.ts';
let geminiContent = fs.readFileSync(geminiPath, 'utf8');
// remove the getGasUrl block from extractTemplateFromImage
geminiContent = geminiContent.replace(/const gasUrl = getGasUrl\(true\);\s*const normalizedGasUrl .*?if \([^\{]+\{\s*\/\/\s*GAS 프록시 사용/sg, `if (true) {\n      // Firebase 프록시 사용`);
// Replace simple const gasUrl = getGasUrl(true); with just removing them
geminiContent = geminiContent.replace(/const gasUrl = getGasUrl\(true\);[^\n]*\n/g, "");
// Remove error checks
geminiContent = geminiContent.replace(/if \(!gasUrl\).*?URL_NOT_SET.*?\}\n/sg, "");
fs.writeFileSync(geminiPath, geminiContent);
console.log("Fixes applied.");
