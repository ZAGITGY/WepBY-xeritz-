import * as React from 'react'
import { createRoot } from 'react-dom/client'
import LVCDocuments from '@/components/lvc-documents'
import '@/styles/globals.css'

declare global { interface Window { __LVC?: { ScrollTrigger?: { refresh: () => void } } } }

class FolderBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error) {
    document.getElementById('public-info')?.classList.remove('has-document-folders')
    console.error('Document folders unavailable; original document links remain available.', error)
  }
  render() { return this.state.failed ? null : this.props.children }
}

function mount() {
  const section = document.getElementById('public-info')
  const layout = section?.querySelector('.public-layout')
  if (!section || !layout || layout.querySelector('#lvc-document-folders')) return
  const host = document.createElement('div')
  host.id = 'lvc-document-folders'
  layout.appendChild(host)
  const ready = () => {
    section.classList.add('has-document-folders')
    requestAnimationFrame(() => window.__LVC?.ScrollTrigger?.refresh())
  }
  createRoot(host).render(<FolderBoundary><LVCDocuments onReady={ready} /></FolderBoundary>)
  let refreshTimer: ReturnType<typeof setTimeout>
  let lastHeight = 0
  const observer = new ResizeObserver(() => {
    const height = host.offsetHeight
    if (Math.abs(height - lastHeight) < 2) return
    lastHeight = height
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => window.__LVC?.ScrollTrigger?.refresh(), 100)
  })
  observer.observe(host)
}

function scheduleMount() {
  const section = document.getElementById('public-info')
  if (!section) return
  if (!('IntersectionObserver' in window)) { mount(); return }
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return
    observer.disconnect()
    mount()
  }, { rootMargin: '500px' })
  observer.observe(section)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleMount, { once: true })
else scheduleMount()
