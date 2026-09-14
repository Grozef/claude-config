// Commande Bash ou PowerShell qui PRODUIT un effet (ecriture, git, installation, requete mutante).
// Extrait de stop-verify.js le 2026-09-11 pour etre partage avec pre-guard-outward.js.
const patterns = [
  /\bgit\s+(commit|push|reset|checkout\s+--|rm\b|mv\b|merge|rebase|branch\s+-D|tag\s+-d)/,
  /(^|[\s;&|])rm\s+/,
  /(^|[\s;&|])mv\s+/,
  /(^|[\s;&|])cp\s+/,
  /(^|[\s;&|])mkdir\s+/,
  /(^|[\s;&|])touch\s+/,
  /(^|[\s;&|])chmod\s+/,
  /(^|[\s;&|])chown\s+/,
  /\bnpm\s+(install|i\b|update|uninstall|remove|run\s+build|run\s+deploy)/,
  /\bcomposer\s+(install|require|remove|update)/,
  /\bpip\s+(install|uninstall)/,
  /\byarn\s+(add|remove|install)/,
  /\bsed\s+-i\b/,
  /(^|[\s;&|])tee\s+/,
  /\bcurl\s+.*-X\s+(POST|PUT|DELETE|PATCH)/i,
  /\bgh\s+(pr\s+(create|merge|close)|issue\s+(create|close))/,
  // Cmdlets PowerShell d'ecriture, deplaces de pre-guard-outward.js le 2026-09-13 : stop-verify.js
  // classe desormais PowerShell comme Bash et doit reconnaitre ses productions.
  /\b(Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Move-Item|Copy-Item|Rename-Item)\b/i,
];

// Redirection vers un fichier reel ; exclut 2>/dev/null & co (suppression stderr, pas une prod).
// Testee HORS chaines entre quotes (2026-09-14) : un motif grep '^[<>]' ou le => d'un node -e
// passait pour une redirection. Angle mort assume : bash -c "echo x > f" n'est plus vu.
const redirection = />\s*(?!\/dev\/null)[^|&\s]/;

module.exports.isBashProducer = (cmd) => !!cmd && (patterns.some(p => p.test(cmd))
  || redirection.test(cmd.replace(/'[^']*'|"[^"]*"/g, "''")));
