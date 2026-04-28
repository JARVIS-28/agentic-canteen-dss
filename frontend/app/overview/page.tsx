"use client"
import React from 'react'
import Overview from '@/components/Overview'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/admin'

export default function OverviewPage() {
  const router = useRouter()

  React.useEffect(() => {
    if (!isAuthenticated()) router.push('/admin')
  }, [router])

  return (
    <div className="p-0">
      <Overview setPage={(p) => router.push(`/${p}`)} />
    </div>
  )
}
