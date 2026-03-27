const fs = require('fs');
const filepath = 'src/components/StatementTab.tsx';
let code = fs.readFileSync(filepath, 'utf8');

const target = '\\n\\n=================\\n💰 *TOTAL DA MONTAGEM:* R$ ${totalJob.toFixed(2)}';

if (code.includes(target)) {
    code = code.replace(target, '');
    fs.writeFileSync(filepath, code);
    console.log('Successfully removed total module.');
} else {
    console.log('Target string exact match not found.');
}
