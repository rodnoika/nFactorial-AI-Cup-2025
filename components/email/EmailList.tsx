import React, { useState } from 'react'
import { useEmailCategories } from '@/hooks/useEmailCategories'
import { type EmailCategory } from '@/types/email'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Loader2, Users, Briefcase, GraduationCap, ShoppingCart, Share2, MoreHorizontal, Tag, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const categoryIcons = {
  personal: Users,
  work: Briefcase,
  education: GraduationCap,
  shopping: ShoppingCart,
  social: Share2,
  other: MoreHorizontal
}

interface EmailListProps {
  emails: Array<{
    id: string
    from: string
    subject: string
    date: string
    snippet: string
  }>
  onEmailSelect?: (email: any) => void
  selectedEmailId?: string
}

export function EmailList({ emails, onEmailSelect, selectedEmailId }: EmailListProps) {
  const {
    isLoading,
    error,
    contacts,
    categories,
    categorizeEmail,
    updateCategory
  } = useEmailCategories()

  const [searchQuery, setSearchQuery] = useState('')
  const [categorizingEmails, setCategorizingEmails] = useState<Set<string>>(new Set())

  const filteredEmails = emails.filter(email => 
    email.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.snippet.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCategorize = async (email: string) => {
    if (categorizingEmails.has(email)) return

    const newSet = new Set(categorizingEmails)
    newSet.add(email)
    setCategorizingEmails(newSet)
    try {
      await categorizeEmail({ email })
    } finally {
      const nextSet = new Set(categorizingEmails)
      nextSet.delete(email)
      setCategorizingEmails(nextSet)
    }
  }

  const handleUpdateCategory = async (email: string, categoryId: string) => {
    await updateCategory(email, categoryId)
  }

  const getContactCategory = (email: string) => {
    return contacts.find(c => c.email === email)?.category
  }

  return (
    <Card className="flex flex-col h-full">
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Emails</h2>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        </div>

        {error && (
          <div 
            className="rounded-md bg-destructive/15 p-3 text-sm text-destructive mb-4"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        <Input
          placeholder="Search emails..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full"
          aria-label="Search emails by sender, subject, or content"
        />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="divide-y">
          {filteredEmails.map(email => {
            const category = getContactCategory(email.from)
            const isCategorizing = categorizingEmails.has(email.from)
            const isSelected = email.id === selectedEmailId

            return (
              <button
                key={email.id}
                className={cn(
                  'w-full text-left p-4 hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  isSelected && 'bg-accent'
                )}
                onClick={() => onEmailSelect?.(email)}
                aria-label={`Email from ${email.from} with subject ${email.subject}`}
                aria-selected={isSelected}
                role="option"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate min-w-0">{email.from}</span>
                      <div className="flex items-center shrink-0">
                        {category ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 ml-1"
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                aria-label={`Change category for ${email.from}`}
                              >
                                {categoryIcons[category.id as keyof typeof categoryIcons] && 
                                  React.createElement(categoryIcons[category.id as keyof typeof categoryIcons], {
                                    className: 'h-4 w-4',
                                    style: { color: category.color }
                                  })}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {categories.map(cat => (
                                <DropdownMenuItem
                                  key={cat.id}
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    handleUpdateCategory(email.from, cat.id)
                                  }}
                                  aria-label={`Set category to ${cat.name} for ${email.from}`}
                                >
                                  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                                  <div className="flex items-center gap-2">
                                    {categoryIcons[cat.id as keyof typeof categoryIcons] && 
                                      React.createElement(categoryIcons[cat.id as keyof typeof categoryIcons], {
                                        className: 'h-4 w-4',
                                        style: { color: cat.color }
                                      })}
                                    {cat.name}
                                  </div>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-1"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation()
                              handleCategorize(email.from)
                            }}
                            disabled={isCategorizing}
                            aria-label={`Categorize email from ${email.from}`}
                          >
                            {isCategorizing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Tag className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-medium mb-1 truncate">{email.subject}</div>
                    <div className="text-sm text-muted-foreground line-clamp-2">{email.snippet}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(email.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </Card>
  )
} 