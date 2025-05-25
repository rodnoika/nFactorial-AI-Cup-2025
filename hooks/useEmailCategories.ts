"use client";
import { useState, useCallback, useEffect } from 'react'
import { EmailCategoriesService } from '@/services/email-categories'
import { type EmailCategory, type EmailContact, type CategorizeRequest } from '@/types/email'

export function useEmailCategories() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contacts, setContacts] = useState<EmailContact[]>([])
  const [categories, setCategories] = useState<EmailCategory[]>([])

  const service = EmailCategoriesService.getInstance()

  useEffect(() => {
    setCategories(service.getCategories())
    setContacts(service.getAllContacts())
  }, [])

  const categorizeEmail = useCallback(async (request: CategorizeRequest) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await service.categorizeEmail(request)
      if (!result.success) {
        throw new Error(result.error)
      }

      setContacts(service.getAllContacts())
      return result.data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to categorize email')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const categorizeEmails = useCallback(async (emails: string[]) => {
    setIsLoading(true)
    setError(null)

    try {
      const results = await service.categorizeEmails(emails)
      const errors = results.filter(r => !r.success).map(r => r.error)
      
      if (errors.length > 0) {
        setError(errors.join(', '))
      }

      setContacts(service.getAllContacts())
      return results.map(r => r.data).filter(Boolean) as EmailContact[]
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to categorize emails')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateCategory = useCallback((email: string, categoryId: string) => {
    setError(null)

    try {
      const result = service.updateCategory(email, categoryId)
      if (!result.success) {
        throw new Error(result.error)
      }

      setContacts(service.getAllContacts())
      return result.data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category')
      return null
    }
  }, [])

  const getContactsByCategory = useCallback((categoryId: string) => {
    return service.getContactsByCategory(categoryId)
  }, [])

  return {
    isLoading,
    error,
    contacts,
    categories,
    categorizeEmail,
    categorizeEmails,
    updateCategory,
    getContactsByCategory
  }
} 