import { Sidebar } from '@/components/sidebar'
import { PageTransition } from '@/components/ui/page-transition'

export default function AppLayout({children}:{children:React.ReactNode}){
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar/>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 pt-16 md:p-8">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </div>
  )
}
