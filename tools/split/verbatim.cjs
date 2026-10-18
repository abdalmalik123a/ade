/**
 * فحص الحرفيّة بعد نقل تصريحاتٍ من ملفٍّ إلى ملفّاتٍ جديدة (A11، D75): أسطر الأصل في إيداعٍ قبل النقل تُقابَل بأسطره الآن وأسطر الجديدة —
 * بعد قصّ المسافات وحذف `export ` من أوّل التصريح، وبلا الفارغة وأسطر الاستيراد وإعادة التصدير.
 *
 *   node tools/split/verbatim.cjs <الإيداع قبل النقل> <الأصل> <الجديد…>        (من جذر المستودع)
 *
 * المخرج: «ضاع <ع> · جديد <ع>» ثم أوّل خمسة عشر منها — «ضاع» (-) سطرٌ خرج من الأصل ولم يظهر في جديد، و«جديد» (+) سطرٌ ليس من الأصل
 * (غير التعليقات وأسماء الاستيراد الممتدّة على أسطر). والنقل الحرفيّ «ضاع 0 · جديد 0».
 * نصّه «فحص الحرفيّة» في ARCHITECTURE §٢ كما هو، إلا أنّ الوسائط من `process.argv.slice(2)` (ملفٌّ لا `node -e`، D77).
 */
const fs=require('fs'),cp=require('child_process');
const[r,o,...n]=process.argv.slice(2);
const L=t=>t.replace(/\r/g,'').split('\n').map(s=>s.trim().replace(/^export (?=(async )?(function|const|let|type|interface|class|enum) )/,'')).filter(s=>s&&!/^(import |\} from |export (\{|\*|type \*|type \{))/.test(s));
const B=a=>a.reduce((m,s)=>m.set(s,(m.get(s)||0)+1),new Map());
const O=B(L(cp.execSync('git show '+r+':'+o).toString())),N=B(L(fs.readFileSync(o,'utf8'))),A=B(n.flatMap(p=>L(fs.readFileSync(p,'utf8'))));
const x=[],y=[];
for(const[s,c]of O)if(c-(N.get(s)||0)>(A.get(s)||0))x.push('- '+s);
for(const[s,c]of A)if(c>(O.get(s)||0)-(N.get(s)||0)&&!/^(\/\*\*|\*|\/\/)/.test(s)&&!/^(type )?\w+( as \w+)?,?$/.test(s))y.push('+ '+s);
console.log('ضاع',x.length,'· جديد',y.length);
x.concat(y).slice(0,15).forEach(s=>console.log(' ',s))
