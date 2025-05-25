import { DEFAULT_CATEGORIES, type EmailCategory, type EmailContact, type CategorizeRequest, type CategorizeResponse } from '@/types/email'

const logger = {
  info: (message: string, data?: any) => console.log(`[EmailCategories] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[EmailCategories] ${message}`, error || ''),
  warn: (message: string, data?: any) => console.warn(`[EmailCategories] ${message}`, data || '')
}

export class EmailCategoriesService {
  private static instance: EmailCategoriesService
  private categories: EmailCategory[] = DEFAULT_CATEGORIES
  private contacts: Map<string, EmailContact> = new Map()

  private constructor() {
    this.loadContacts()
  }

  static getInstance(): EmailCategoriesService {
    if (!EmailCategoriesService.instance) {
      EmailCategoriesService.instance = new EmailCategoriesService()
    }
    return EmailCategoriesService.instance
  }

  private loadContacts() {
    try {
      const stored = localStorage.getItem('email_contacts')
      if (stored) {
        const contacts = JSON.parse(stored)
        this.contacts = new Map(Object.entries(contacts))
        logger.info('Loaded contacts from storage', { count: this.contacts.size })
      }
    } catch (error) {
      logger.error('Failed to load contacts from storage', error)
    }
  }

  private saveContacts() {
    try {
      const contacts = Object.fromEntries(this.contacts)
      localStorage.setItem('email_contacts', JSON.stringify(contacts))
      logger.info('Saved contacts to storage', { count: this.contacts.size })
    } catch (error) {
      logger.error('Failed to save contacts to storage', error)
    }
  }

  async categorizeEmail(request: CategorizeRequest): Promise<CategorizeResponse> {
    logger.info('Categorizing email', request)

    try {
      const response = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const category = this.categories.find(c => c.id === data.category) || this.categories[this.categories.length - 1]

      const contact: EmailContact = {
        email: request.email,
        name: request.name,
        category,
        confidence: data.confidence,
        lastUpdated: new Date(),
        metadata: {
          domain: request.email.split('@')[1],
          reasoning: data.reasoning
        }
      }

      this.contacts.set(request.email, contact)
      this.saveContacts()

      logger.info('Email categorized successfully', contact)
      return { success: true, data: contact }
    } catch (error) {
      logger.error('Failed to categorize email', error)
      return { success: false, error: 'Failed to categorize email' }
    }
  }

  async categorizeEmails(emails: string[]): Promise<CategorizeResponse[]> {
    logger.info('Categorizing multiple emails', { count: emails.length })
    return Promise.all(emails.map(email => this.categorizeEmail({ email })))
  }

  getCategories(): EmailCategory[] {
    return this.categories
  }

  getContact(email: string): EmailContact | undefined {
    return this.contacts.get(email)
  }

  getAllContacts(): EmailContact[] {
    return Array.from(this.contacts.values())
  }

  updateCategory(email: string, categoryId: string): CategorizeResponse {
    logger.info('Updating category', { email, categoryId })

    const contact = this.contacts.get(email)
    if (!contact) {
      return { success: false, error: 'Contact not found' }
    }

    const category = this.categories.find(c => c.id === categoryId)
    if (!category) {
      return { success: false, error: 'Category not found' }
    }

    contact.category = category
    contact.lastUpdated = new Date()
    this.contacts.set(email, contact)
    this.saveContacts()

    logger.info('Category updated successfully', contact)
    return { success: true, data: contact }
  }

  getContactsByCategory(categoryId: string): EmailContact[] {
    return this.getAllContacts().filter(contact => contact.category.id === categoryId)
  }
} 