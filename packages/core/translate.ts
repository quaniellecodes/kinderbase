/**
 * Translation interface (docs/DECISIONS.md §13). Provider TBD; the demo returns
 * a canned translation. Always store the original alongside. Never block a send
 * on this — on failure, show the original.
 */
export async function translate(text: string, to: string): Promise<string> {
  if (to === 'en' || !text.trim()) return text;
  // Demo: a few known childcare phrases translate to Spanish; anything else
  // returns the original (the UI still shows the "translated" badge). A real
  // provider (Google/DeepL) drops in here later.
  const es: Record<string, string> = {
    'He took 4oz at 8:05 — a bit less than usual. He may be teething. I will watch him at lunch.':
      'Tomó 4oz a las 8:05 — un poco menos de lo habitual. Puede que le estén saliendo los dientes. Lo vigilaré en el almuerzo.',
    'She napped well and ate all her fruit. Great day!': 'Durmió bien la siesta y se comió toda su fruta. ¡Buen día!',
    'Thank you so much!': '¡Muchas gracias!',
    'Got it — I will let you know.': 'Entendido — le aviso.',
  };
  return to === 'es' ? es[text.trim()] ?? text : text;
}
