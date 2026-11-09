import { redirect } from 'next/navigation'
import { getDriverSession } from './actions'

export default async function DriverIndexPage() {
  const session = await getDriverSession()
  if (!session) {
    redirect('/driver/login')
  } else {
    redirect('/driver/dashboard')
  }
}
