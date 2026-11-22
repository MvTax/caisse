// Vérifie qu'un fichier est en ASCII pur (le script de la passerelle est téléchargé par
// PowerShell 5.1 avec l'encodage Windows par défaut : un accent y serait corrompu).
import { readFileSync } from 'node:fs';

let bad = 0;
for (const file of process.argv.slice(2)) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const m = /[^\x00-\x7f]/.exec(line);
      if (m) {
        bad++;
        console.error(`${file}:${i + 1}: caractère non ASCII « ${m[0]} »`);
      }
    });
}
if (bad) process.exit(1);
console.log('ASCII OK');
