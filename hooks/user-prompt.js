const d = require('fs').readFileSync(0, 'utf8');
try {
  const p = JSON.parse(d).prompt || '';
  const len = p.length;
  const hasQ = p.includes('?') || p.match(/^(comment|pourquoi|quand|est-ce|peux-tu|montre|explique|fais|genere|ecris|aide)/i);
  const looksLikePaste = len > 800 && !hasQ && (p.includes('\n') && p.split('\n').length > 10);
  if (looksLikePaste) {
    console.log('WARNING: Message tres long sans question detectee (' + len + ' car). Si tu colles un fichier, prefere @nom-du-fichier pour economiser des tokens.');
  }
} catch(e) {}
