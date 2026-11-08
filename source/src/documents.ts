import type { ArtRecipe, FolderFile } from '@/components/ui/glass-folder-cards'

export type DocumentGroup = { id: string; title: string; caption: string; source: string; art: ArtRecipe; files: FolderFile[] }
const official = 'https://lvc.ac.th/www2026/'

export const documentGroups: DocumentGroup[] = [
  {
    id: 'learning', title: 'คู่มือการเรียน', caption: 'หลักสูตรและแผนการเรียน ปี 2569', source: official + 'ita2569/ita-2569.html',
    art: { style: 'streak', colors: ['#fbf5e9','#d7c49b','#992234','#451822','#c79f79','#fff8ed'], scale: .65, warp: 1.4, angle: -.5, gloss: .2, veins: 0 },
    files: [
      { name: 'คู่มือนักเรียน นักศึกษา 2569', meta: 'PDF · 25.5 MB', href: './documents/student-handbook-2569.pdf' },
      { name: 'แผนการเรียน ปวช. 2569', meta: 'PDF · 4.6 MB', href: './documents/certificate-plan-2569.pdf' },
      { name: 'แผนการเรียน ปวส. 2569', meta: 'PDF · 6.8 MB', href: './documents/diploma-plan-2569.pdf' }
    ]
  },
  {
    id: 'transparency', title: 'ความโปร่งใส', caption: 'ข้อมูลสาธารณะและแนวทางปฏิบัติ', source: official + 'ita2569/ita-2569.html',
    art: { style: 'marble', colors: ['#271c1c','#7b2934','#c7a985','#f0e5cf','#b49659','#fff9e9'], scale: .65, warp: 2.5, angle: .7, gloss: .3, veins: .2 },
    files: [
      { name: 'ข้อมูลสาธารณะ ITA 2569', meta: 'เว็บไซต์วิทยาลัย', href: official + 'ita2569/ita-2569.html' },
      { name: 'นโยบาย No Gift Policy', meta: 'PDF · ประกาศวิทยาลัย', href: './documents/no-gift-policy-2569.pdf' },
      { name: 'ข้อควรทำและไม่ควรทำ', meta: 'PDF · แนวทางปฏิบัติ', href: './documents/dos-and-donts-2569.pdf' }
    ]
  },
  {
    id: 'support', title: 'รับฟังทุกเสียง', caption: 'ช่องทางร้องเรียนและร้องทุกข์', source: official + 'about.html',
    art: { style: 'streak', colors: ['#fff9ee','#e8decc','#b7a182','#7c6f60','#c5b69a','#f6efdf'], scale: .7, warp: 1.5, angle: .25, gloss: .22, veins: 0 },
    files: [
      { name: 'แจ้งร้องเรียน', meta: 'ระบบออนไลน์วิทยาลัย', href: official + 'complaints.html' },
      { name: 'แจ้งร้องทุกข์', meta: 'ระบบออนไลน์วิทยาลัย', href: official + 'grievance.html' },
      { name: 'ขั้นตอนการร้องเรียน', meta: 'ภาพคู่มือจากวิทยาลัย', href: './documents/complaints-guide-2569.png' }
    ]
  }
]
