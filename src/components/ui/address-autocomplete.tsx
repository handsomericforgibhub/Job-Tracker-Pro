'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { MapPin, Loader2 } from 'lucide-react'
import { UI_CONFIG } from '@/config/timeouts'

interface AddressComponents {
  formatted: string
  street?: string
  house_number?: string
  city?: string
  state?: string
  postcode?: string
  country?: string
}

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string, components?: AddressComponents, coordinates?: { lat: number; lng: number }) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  required?: boolean
  id?: string
}

interface GeoapifyResult {
  properties: {
    formatted: string
    address_line1?: string
    address_line2?: string
    street?: string
    housenumber?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
  }
  geometry: {
    coordinates: [number, number] // [lng, lat]
  }
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter address...",
  disabled = false,
  className = "",
  required = false,
  id
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeoapifyResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchTerm, setSearchTerm] = useState(value)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update search term when value prop changes
  useEffect(() => {
    setSearchTerm(value)
  }, [value])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchAddresses = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([])
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY
    if (!apiKey) {
      console.error('Geoapify API key not found')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&limit=${UI_CONFIG.AUTOCOMPLETE_LIMIT}&apiKey=${apiKey}`
      )

      if (!response.ok) {
        throw new Error(`Geoapify API error: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.features && Array.isArray(data.features)) {
        setSuggestions(data.features)
        setShowSuggestions(true)
      } else {
        setSuggestions([])
      }
    } catch (error) {
      console.error('Address search error:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchTerm(newValue)
    onChange(newValue) // Update parent with raw input

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(() => {
      searchAddresses(newValue)
    }, 300) // 300ms debounce
  }

  const handleSuggestionClick = (suggestion: GeoapifyResult) => {
    const formatted = suggestion.properties.formatted
    const components: AddressComponents = {
      formatted,
      street: suggestion.properties.street,
      house_number: suggestion.properties.housenumber,
      city: suggestion.properties.city,
      state: suggestion.properties.state,
      postcode: suggestion.properties.postcode,
      country: suggestion.properties.country
    }
    
    const coordinates = {
      lat: suggestion.geometry.coordinates[1],
      lng: suggestion.geometry.coordinates[0]
    }

    setSearchTerm(formatted)
    setShowSuggestions(false)
    setSuggestions([])
    
    // Update parent with full address data
    onChange(formatted, components, coordinates)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`pl-10 ${className}`}
        />
        
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {suggestion.properties.formatted}
                  </p>
                  {(suggestion.properties.city || suggestion.properties.state) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {[suggestion.properties.city, suggestion.properties.state]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}