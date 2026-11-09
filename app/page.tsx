import { Sidebar } from '@/components/sidebar'
import { ScmTaskHub } from '@/components/kanban/ScmTaskHub'

export default function LandingPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main id="tasks" className="app-main flex min-h-0 flex-1 flex-col overflow-hidden p-3 pt-16 md:p-5">
        <ScmTaskHub />
      </main>
    </div>
  )
}
