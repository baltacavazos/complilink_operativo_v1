# Landing clarity review packet

## Role requested from model

Act as a **Mexican worker with no legal or payroll expertise** who just landed on this homepage for the first time.

## Asset

Landing first-screen screenshot:
https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/VKMrchzdLZuAgwEk.webp

## First-screen copy to evaluate

- Eyebrow: "Sube una foto o PDF y revisa tu pago"
- Main headline: "Tu recibo puede revelar señales raras."
- Support line: "Revísalo gratis y entiende si hay algo que revisar en tu pago, deducciones o CFDI."
- Extra line: "Empieza con una foto o PDF. No necesitas reunir todo."
- Primary CTA: "Empezar auditoría gratis"
- Right-side example card: "Señal encontrada: posible diferencia entre recibo y CFDI"

## Main evaluation question

Does a normal worker understand within 3 to 5 seconds what this product is for?

More specifically:
1. Is it clear that the product reviews payroll/work documents for the worker?
2. Is it clear what practical outcome the worker gets?
3. Is any tiny product description missing?
4. Should we leave it as-is, or add a short product descriptor under the headline/support line?

## Desired output format

Return strict JSON with this schema:

```json
{
  "clarity_score": 0,
  "understands_purpose_quickly": false,
  "current_clarity_verdict": "one short paragraph",
  "microdescription_needed": false,
  "why": "one short paragraph",
  "confusing_terms": ["term1", "term2"],
  "best_action": "keep_as_is|add_microdescription",
  "proposed_microdescription": "max 18 words, or empty string if not needed",
  "confidence": "high|medium|low"
}
```
