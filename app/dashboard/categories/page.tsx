import { Suspense } from 'react'
import { EmailCategories } from '@/components/email/EmailCategories'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Email Categories</h1>
      </div>
      
      <div className="grid gap-6">
        <Suspense 
          fallback={
            <Card className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </Card>
          }
        >
          <EmailCategories />
        </Suspense>
      </div>
    </div>
  )
} 