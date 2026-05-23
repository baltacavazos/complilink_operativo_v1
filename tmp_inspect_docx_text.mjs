import fs from 'node:fs';
import mammoth from 'mammoth';

const filePath = '/home/ubuntu/upload/CONTRATOINDETERMINADO-UICABPALOMODIDIERANTONIO.docx';
const buffer = fs.readFileSync(filePath);
const result = await mammoth.extractRawText({ buffer });
const text = result.value.replace(/\s+/g, ' ').trim();
console.log(text.slice(0, 4000));
