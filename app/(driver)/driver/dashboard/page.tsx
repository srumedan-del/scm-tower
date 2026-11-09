import { redirect } from 'next/navigation'
import { getDriverSession } from '../actions'
import { DriverApp } from './DriverApp'

export default async function DriverDashboardPage() {
  const session = await getDriverSession()
  if (!session) redirect('/driver/login')
  return <DriverApp driver={session} />
}
