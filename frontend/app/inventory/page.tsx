"use client"
import React from 'react'
import InventoryManager from '@/components/InventoryManager'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/admin'

export default function InventoryPage() {
  const router = useRouter()

  React.useEffect(() => {
    if (!isAuthenticated()) router.push('/admin')
  }, [router])

  return (
    <div className="p-3 sm:p-4 lg:p-8">
      <InventoryManager />
    </div>
  )
}
