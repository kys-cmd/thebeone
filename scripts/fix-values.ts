import fs from 'fs';

let cms = fs.readFileSync('src/pages/admin/CMS.tsx', 'utf-8');
cms = cms.replace('value={banner.title}', 'value={banner.title || \'\'}');
cms = cms.replace('value={banner.link}', 'value={banner.link || \'\'}');
cms = cms.replace('value={banner.order}', 'value={banner.order || 0}');
cms = cms.replace('value={cat.name}', 'value={cat.name || \'\'}');
cms = cms.replace('value={cat.icon}', 'value={cat.icon || \'\'}');
cms = cms.replace('value={cat.description}', 'value={cat.description || \'\'}');
cms = cms.replace('value={cat.color}', 'value={cat.color || \'\'}');
cms = cms.replace('value={cat.banner}', 'value={cat.banner || \'\'}');
cms = cms.replace('value={siteConfig.site_name}', 'value={siteConfig.site_name || \'\'}');
cms = cms.replace('value={siteConfig.primary_color}', 'value={siteConfig.primary_color || \'\'}');
cms = cms.replace('value={siteConfig.footer_info}', 'value={siteConfig.footer_info || \'\'}');

fs.writeFileSync('src/pages/admin/CMS.tsx', cms);
console.log('Fixed CMS.tsx');
