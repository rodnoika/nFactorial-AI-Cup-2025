export interface EmailCategory {
  id: string
  name: string
  description: string
  color: string
  icon?: string
}

export interface EmailContact {
  email: string
  name?: string
  category: EmailCategory
  confidence: number
  lastUpdated: Date
  metadata?: {
    domain?: string
    frequency?: number
    lastInteraction?: Date
    reasoning?: string
  }
}

export const DEFAULT_CATEGORIES: EmailCategory[] = [
  {
    id: 'personal',
    name: 'Personal',
    description: 'Friends and family contacts',
    color: '#4CAF50',
    icon: 'users'
  },
  {
    id: 'work',
    name: 'Work',
    description: 'Business and professional contacts',
    color: '#2196F3',
    icon: 'briefcase'
  },
  {
    id: 'education',
    name: 'Education',
    description: 'Schools, universities, and educational institutions',
    color: '#9C27B0',
    icon: 'graduation-cap'
  },
  {
    id: 'shopping',
    name: 'Shopping',
    description: 'Retail and e-commerce contacts',
    color: '#FF9800',
    icon: 'shopping-cart'
  },
  {
    id: 'social',
    name: 'Social',
    description: 'Social media and networking contacts',
    color: '#E91E63',
    icon: 'share-2'
  },
  {
    id: 'other',
    name: 'Other',
    description: 'Miscellaneous contacts',
    color: '#607D8B',
    icon: 'more-horizontal'
  }
]

export type CategoryResponse = {
  category: string
  confidence: number
  reasoning: string
}

export type CategorizeRequest = {
  email: string
  name?: string
  context?: string
}

export type CategorizeResponse = {
  success: boolean
  data?: EmailContact
  error?: string
} 