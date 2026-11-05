"use client"

import * as React from "react"
import GlassFolder, { LVC_ART, type FolderFile, type GlassFolderProps } from "@/components/ui/glass-folder-cards"

const BASE = "https://lvc.ac.th/www2026/"
const collections: { label: string; files: FolderFile[] }[] = [
  {
    label: "คู่มือและแผนการเรียน",
    files: [
      { name: "คู่มือนักเรียน นักศึกษา 2569", meta: "PDF", href: BASE + "ita2569/oit-13/Student_Handbook_2569.pdf", target: "_blank" },
      { name: "แผนการเรียน ปวช. 2569", meta: "PDF", href: BASE + "ita2569/oit-22/Vocational_Certificate_Curriculum_Plan_2569.pdf", target: "_blank" },
      { name: "แผนการเรียน ปวส. 2569", meta: "PDF", href: BASE + "ita2569/oit-22/Vocational_Diploma_Curriculum_Plan_2569.pdf", target: "_blank" },
    ],
  },
  {
    label: "ความโปร่งใส",
    files: [
      { name: "ข้อมูลสาธารณะ ITA 2569", meta: "เว็บไซต์", href: BASE + "ita2569/ita-2569.html", target: "_blank" },
      { name: "นโยบาย No Gift", meta: "PDF", href: BASE + "ita2569/oit-20/No_Gift_Policy.pdf", target: "_blank" },
      { name: "ข้อควรทำและไม่ควรทำ", meta: "PDF", href: BASE + "ita2569/oit-17/Do's_and_Don't.pdf", target: "_blank" },
    ],
  },
  {
    label: "รับฟังความคิดเห็น",
    files: [
      { name: "แจ้งร้องเรียน", meta: "เว็บไซต์", href: BASE + "complaints.html", target: "_blank" },
      { name: "แจ้งร้องทุกข์", meta: "เว็บไซต์", href: BASE + "grievance.html", target: "_blank" },
      { name: "ขั้นตอนการร้องเรียน", meta: "ภาพคู่มือ", href: BASE + "ita2569/oit-18/Complaints_step.png", target: "_blank" },
    ],
  },
]

function ResponsiveFolder({ label, files, tone, index }: { label: string; files: FolderFile[]; tone: GlassFolderProps["tone"]; index: number }) {
  const container = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(280)
  React.useEffect(() => {
    const el = container.current
    if (!el) return
    const measure = () => setWidth(Math.min(340, Math.floor(el.clientWidth)))
    measure()
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure)
      return () => window.removeEventListener("resize", measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return <div ref={container} className="w-full min-w-0 text-center">
    <GlassFolder label={label} files={files} art={LVC_ART} seed={index * 7 + 3} width={width}
      tone={tone} action="more" appearDelay={index * 100} showFileList />
  </div>
}

/** A reusable preview with real college documents. Production data is supplied by the documents page. */
export default function GlassFolderCardsDemo({ tone = "light" }: { tone?: GlassFolderProps["tone"] }) {
  return <section className="relative w-full bg-background px-5 py-12 text-foreground sm:px-8" aria-label="แฟ้มเอกสารวิทยาลัยอาชีวศึกษาเลย">
    <div className="mx-auto max-w-[1180px]">
      <p className="text-xs tracking-widest text-muted-foreground">LVC · DOCUMENT COLLECTION</p>
      <h2 className="mt-3 text-3xl font-medium">เอกสารที่คุณกำลังมองหา</h2>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">แตะเปิดแฟ้มเพื่อดูรายการเอกสารจากวิทยาลัยอาชีวศึกษาเลย</p>
      <div className="mt-5 grid grid-cols-1 items-start gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((collection, index) => <ResponsiveFolder key={collection.label} {...collection} index={index} tone={tone} />)}
      </div>
    </div>
  </section>
}
