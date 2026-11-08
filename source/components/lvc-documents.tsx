import * as React from 'react'
import { BookOpen, FileText, HandHeart, MousePointer2 } from 'lucide-react'
import GlassFolder from '@/components/ui/glass-folder-cards'
import { documentGroups, type DocumentGroup } from '@/src/documents'

function useTone() {
  const [tone, setTone] = React.useState<'light' | 'dark'>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  React.useEffect(() => {
    const observer = new MutationObserver(() => setTone(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return tone
}

function Folder({ group, index, open, onOpen }: { group: DocumentGroup; index: number; open: boolean; onOpen: (open: boolean) => void }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(270)
  const tone = useTone()
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const resize = () => setWidth(Math.max(200, Math.min(320, el.clientWidth - 24)))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const Icon = [BookOpen, FileText, HandHeart][index]
  return <article className="document-folder-column" aria-label={group.title}>
    <div className="document-folder-object" ref={ref}>
      <GlassFolder label={group.title} files={group.files} art={group.art} seed={index * 7 + 3}
        tone={tone} width={width} action="more" open={open} onOpenChange={onOpen}
        appearDelay={index * 90} showFileList
        menu={[{ label: 'ดูข้อมูลจากวิทยาลัย', onSelect: () => window.location.assign(group.source) }]}
      />
    </div>
    <p className="document-folder-caption"><Icon size={17} aria-hidden="true" />{group.caption}</p>
  </article>
}

export default function LVCDocuments({ onReady }: { onReady?: () => void }) {
  const [open, setOpen] = React.useState<string | null>(null)
  React.useLayoutEffect(() => { onReady?.() }, [onReady])
  return <div className="lvc-documents">
    <p className="document-instruction"><span><MousePointer2 size={16} aria-hidden="true" />แตะหรือคลิกเพื่อเปิดแฟ้ม</span><span>เลือกเอกสารเพื่ออ่านข้อมูลฉบับเต็ม</span></p>
    <div className="document-folders-grid">
      {documentGroups.map((group, index) => <Folder key={group.id} group={group} index={index} open={open === group.id} onOpen={value => setOpen(value ? group.id : null)} />)}
    </div>
    <div className="document-library-note"><FileText size={19} aria-hidden="true" /><p>เอกสาร PDF บางไฟล์มีขนาดหลาย MB แนะนำให้เปิดผ่าน Wi-Fi<br />ระบบร้องเรียนและข้อมูล ITA เปิดที่เว็บไซต์ของวิทยาลัย · <a href="./contact.html">ติดต่อวิทยาลัย</a></p></div>
  </div>
}
