#!/usr/bin/env node
import fs from 'fs';

const [,, targetFile, startLineArg, endLineArg, focusArg] = process.argv;

if (!targetFile || !startLineArg || !endLineArg || !focusArg) {
  console.error('Usage: node scripts/multi_model_ui_audit.mjs <file> <startLine> <endLine> <focus>');
  process.exit(1);
}

const startLine = Number(startLineArg);
const endLine = Number(endLineArg);
const focus = focusArg;
const source = fs.readFileSync(targetFile, 'utf8').split('\n');
const snippet = source.slice(startLine - 1, endLine).join('\n');

const prompt = [
  'Eres un auditor senior de UI/UX para micro-rondas iterativas sin agregar funciones nuevas.',
  'Analiza el siguiente fragmento real de una app React/TypeScript.',
  'Objetivo: proponer solo 3 micro-optimizaciones de jerarquía visual/copy/layout de bajo riesgo.',
  'Restricciones: no agregar nuevas features, no rediseñar toda la pantalla, priorizar móvil y claridad inmediata.',
  `Foco específico: ${focus}.`,
  'Devuelve JSON estricto con esta forma:',
  '{"model_view":"nombre corto","top_issue":"texto","suggestions":[{"title":"...","change":"...","reason":"...","risk":"bajo|medio"}],"best_single_move":"texto"}',
  '',
  `Archivo: ${targetFile}:${startLine}-${endLine}`,
  '--- SNIPPET START ---',
  snippet,
  '--- SNIPPET END ---',
].join('\n');

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { provider: 'openai', error: 'missing OPENAI_API_KEY' };
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a precise UI/UX reviewer. Return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) return { provider: 'openai', error: JSON.stringify(data) };
  return { provider: 'openai', output: JSON.parse(data.choices[0].message.content) };
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { provider: 'grok', error: 'missing XAI_API_KEY' };
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a precise UI/UX reviewer. Return strict JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) return { provider: 'grok', error: JSON.stringify(data) };
  return { provider: 'grok', output: JSON.parse(data.choices[0].message.content) };
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { provider: 'gemini', error: 'missing GEMINI_API_KEY' };
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: `${prompt}\n\nResponde únicamente JSON válido.` }],
      }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });
  const data = await response.json();
  if (!response.ok) return { provider: 'gemini', error: JSON.stringify(data) };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '{}';
  return { provider: 'gemini', output: JSON.parse(text) };
}

const results = await Promise.allSettled([callOpenAI(), callGrok(), callGemini()]);
const normalized = results.map((result) => {
  if (result.status === 'fulfilled') return result.value;
  return { provider: 'unknown', error: String(result.reason) };
});

console.log(JSON.stringify({
  targetFile,
  startLine,
  endLine,
  focus,
  snippet,
  results: normalized,
}, null, 2));
