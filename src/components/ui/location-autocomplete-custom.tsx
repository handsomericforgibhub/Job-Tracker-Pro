'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from './input'

export interface AddressComponents {
  formatted: string
  street?: string
  house_number?: string
  city?: string
  state?: string
  postcode?: string
  country?: string
  latitude?: number
  longitude?: number
}

interface LocationAutocompleteProps {
  value: string
  onChange: (value: string, addressComponents?: AddressComponents) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

interface GeoapifyResult {
  properties: {
    formatted: string
    street?: string
    housenumber?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
  }
  geometry: {
    coordinates: [number, number] // [longitude, latitude]
  }
}

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = "Enter address...",
  className = "",
  disabled = false
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeoapifyResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY
    if (!apiKey) {
      setError('API key not configured')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 Searching addresses for:', query)
      
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&limit=5&apiKey=${apiKey}`
      )

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      console.log('📋 Search results:', data)

      if (data.features && Array.isArray(data.features)) {
        setSuggestions(data.features)
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    } catch (err) {
      console.error('❌ Address search error:', err)
      setError('Failed to search addresses')
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (value.trim()) {
        searchAddresses(value.trim())
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [value, searchAddresses])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
  }

  const handleSuggestionClick = (suggestion: GeoapifyResult) => {
    const properties = suggestion.properties
    const geometry = suggestion.geometry

    const addressComponents: AddressComponents = {
      formatted: properties.formatted || '',
      street: properties.street,
      house_number: properties.housenumber,
      city: properties.city,
      state: properties.state,
      postcode: properties.postcode,
      country: properties.country,
      latitude: geometry?.coordinates?.[1],
      longitude: geometry?.coordinates?.[0]
    }

    console.log('📍 Address selected:', addressComponents)
    onChange(properties.formatted || '', addressComponents)
    setShowSuggestions(false)
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        inputRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true)
            }
          }}
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
          </div>
        )}
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
              <div className="text-sm font-medium text-gray-900">
                {suggestion.properties.formatted}
              </div>
              {suggestion.properties.country && (
                <div className="text-xs text-gray-500 mt-1">
                  {suggestion.properties.country}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  )
}