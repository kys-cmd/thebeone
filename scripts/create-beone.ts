import fs from 'fs';

let content = fs.readFileSync('src/pages/SpecialLectures.tsx', 'utf-8');

// Replace standard terms
content = content.replace(/SpecialLectures/g, 'BeOneExclusive');
content = content.replace(/'special'/g, "'beone_exclusive'");
content = content.replace(/'special_online'/g, "'beone_exclusive_online'");
content = content.replace(/'special_offline'/g, "'beone_exclusive_offline'");
content = content.replace(/특강/g, '비원회원전용 강의');
content = content.replace(/LIMITED SPECIAL/g, 'BEONE EXCLUSIVE');

fs.writeFileSync('src/pages/BeOneExclusive.tsx', content);
console.log('Created BeOneExclusive.tsx');
