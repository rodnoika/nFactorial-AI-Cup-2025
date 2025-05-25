"use client";
import React, { useState } from 'react'
import { useEmailCategories } from '@/hooks/useEmailCategories'
import { type EmailCategory, type EmailContact } from '@/types/email'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Users, Briefcase, GraduationCap, ShoppingCart, Share2, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const categoryIcons = {
  personal: Users,
  work: Briefcase,
  education: GraduationCap,
  shopping: ShoppingCart,
  social: Share2,
  other: MoreHorizontal
}

// Badge component
function Badge({ 
  variant = 'default', 
  className, 
  style, 
  children 
}: { 
  variant?: 'default' | 'secondary' | 'outline'
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode 
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        {
          'bg-primary text-primary-foreground hover:bg-primary/80': variant === 'default',
          'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground': variant === 'outline'
        },
        className
      )}
      style={style}
    >
      {children}
    </span>
  )
}

export function EmailCategories() {
  const {
    isLoading,
    error,
    contacts,
    categories,
    updateCategory
  } = useEmailCategories()

  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredContacts = contacts.filter(contact => {
    const matchesCategory = selectedCategory === 'all' || contact.category.id === selectedCategory
    const matchesSearch = contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    return matchesCategory && matchesSearch
  })

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId)
  }

  const handleUpdateCategory = async (email: string, categoryId: string) => {
    await updateCategory(email, categoryId)
  }

  return (
    <Card className="flex flex-col h-full">
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Email Categories</h2>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Search emails..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[180px] shrink-0">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  <div className="flex items-center gap-2">
                    {categoryIcons[category.id as keyof typeof categoryIcons] && 
                      React.createElement(categoryIcons[category.id as keyof typeof categoryIcons], {
                        className: 'h-4 w-4 shrink-0'
                      })}
                    {category.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-2">
          {filteredContacts.map(contact => (
            <div
              key={contact.email}
              className="flex flex-wrap items-start gap-2 rounded-lg border p-3"
            >
              <div className="flex-1 min-w-[200px]">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium break-words">
                    {contact.name || contact.email}
                  </span>
                  {categoryIcons[contact.category.id as keyof typeof categoryIcons] && 
                    React.createElement(categoryIcons[contact.category.id as keyof typeof categoryIcons], {
                      className: 'h-4 w-4 shrink-0',
                      style: { color: contact.category.color }
                    })}
                </div>
                {contact.name && (
                  <div className="text-sm text-muted-foreground break-words">
                    {contact.email}
                  </div>
                )}
              </div>
              <Select
                value={contact.category.id}
                onValueChange={categoryId => handleUpdateCategory(contact.email, categoryId)}
              >
                <SelectTrigger className="w-[140px] shrink-0">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {categoryIcons[contact.category.id as keyof typeof categoryIcons] && 
                        React.createElement(categoryIcons[contact.category.id as keyof typeof categoryIcons], {
                          className: 'h-4 w-4 shrink-0'
                        })}
                      {contact.category.name}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        {categoryIcons[category.id as keyof typeof categoryIcons] && 
                          React.createElement(categoryIcons[category.id as keyof typeof categoryIcons], {
                            className: 'h-4 w-4 shrink-0'
                          })}
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
} 