'use client'

import dynamic from 'next/dynamic'

const CustomerStockMap = dynamic(() => import('./CustomerStockMap').then((module) => module.CustomerStockMap), { ssr: false })

export function CustomerStockMapClient({ publicOnly = false }: { publicOnly?: boolean }) {
	return <CustomerStockMap publicOnly={publicOnly} />
}
