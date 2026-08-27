import { Sidebar } from '@/components/sidebar'
export default function AppLayout({children}:{children:React.ReactNode}){return <div className="flex"><Sidebar/><main className="flex-1 p-6 md:p-8">{children}</main></div>}
