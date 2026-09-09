import { Sidebar } from '@/components/sidebar'
import { PageTransition } from '@/components/ui/page-transition'

export default function AppLayout({children}:{children:React.ReactNode}){
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar/>
      <main className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </div>
  )
}
