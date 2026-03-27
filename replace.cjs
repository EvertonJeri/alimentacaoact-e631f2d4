const fs = require('fs');
let code = fs.readFileSync('src/components/StatementTab.tsx', 'utf8');

const regex = /const list = personStatements\.map\(ps => `👤 \*\$\{getPersonName\(ps\.personId\)\}\*: R\$ \$\{ps\.totalUsed\.toFixed\(2\)\}`\)\.join\('\\n'\);\s*const msg = `🏗️ \*EXTRATO GERAL - JOB: \$\{jName\}\*\\n\\n\$\{list\}\\n\\n💰 \*TOTAL DA MONTAGEM:\* R\$ \$\{totalJob\.toFixed\(2\)\}\\n\\n_Enviado via Sistema ACT_`;/;

const replacement = `const list = personStatements.map(ps => {
                     const pName = getPersonName(ps.personId);
                     const discountLines = ps.details
                       .filter(d => d.type === 'desconto')
                       .map(d => {
                         const date = d.date.split("-").reverse().join("/").slice(0,5);
                         const retirado = d.isDiscountDone ? " ✅[retido]" : "";
                         return "  • " + date + ": " + d.reason + retirado + " [-R$ " + Math.abs(d.value).toFixed(2) + "]";
                       }).join("\\n");
                     const extraLines = ps.details
                       .filter(d => d.type === "extra")
                       .map(d => {
                         const date = d.date.split("-").reverse().join("/").slice(0,5);
                         return "  • " + date + ": " + d.reason + " [+R$ " + d.value.toFixed(2) + "]";
                       }).join("\\n");
                     
                     const adjustmentsStr = [
                       discountLines ? "❌ *DESC:*\\n" + discountLines : "",
                       extraLines ? "➕ *EXTRAS:*\\n" + extraLines : ""
                     ].filter(Boolean).join("\\n");

                     return \`👤 *\${pName}*\\n💰 Solicitado: R$ \${ps.totalRequested.toFixed(2)}\\n⚙️ Ajustes: R$ \${ps.balance.toFixed(2)}\\n💵 *FINAL: R$ \${ps.totalUsed.toFixed(2)}*\${adjustmentsStr ? "\\n" + adjustmentsStr : ""}\`;
                   }).join('\\n\\n-----------------\\n\\n');

                   const msg = \`🏗️ *EXTRATO GERAL E DETALHADO*\\n*JOB:* \${jName}\\n\\n\${list}\\n\\n=================\\n💰 *TOTAL DA MONTAGEM:* R$ \${totalJob.toFixed(2)}\\n\\n_Enviado via Sistema ACT_\`;`;

if (code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/StatementTab.tsx', code);
    console.log('Replaced');
} else {
    console.log('Regex Target not found');
}
