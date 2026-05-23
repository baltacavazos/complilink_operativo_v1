import { readFileSync } from 'node:fs';
import { extractDocxPlainText } from './server/docxSupport';
import { classifyMexicanLaborDocument } from './server/caseContracts';

const fileName = 'CONTRATOINDETERMINADO-UICABPALOMODIDIERANTONIO.docx';
const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const binary = readFileSync('/home/ubuntu/upload/CONTRATOINDETERMINADO-UICABPALOMODIDIERANTONIO.docx');
const textHint = await extractDocxPlainText(binary);
const classification = classifyMexicanLaborDocument({ fileName, mimeType, textHint });
console.log(JSON.stringify({ textHint: textHint.slice(0, 1500), classification }, null, 2));
