'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { GeocoderAutocomplete } from '@geoapify/geocoder-autocomplete'

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

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = "Enter address...",
  className = "",
  disabled = false
}: LocationAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const autocompleteRef = useRef<GeocoderAutocomplete | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY
    console.log('🔑 API Key check:', apiKey ? `Found (${apiKey.substring(0, 8)}...)` : 'NOT FOUND')
    
    if (!apiKey) {
      setError('Geoapify API key is not configured')
      console.error('❌ NEXT_PUBLIC_GEOAPIFY_API_KEY is not set in environment variables')
      return
    }

    try {
      console.log('🔄 Initializing Geoapify Autocomplete...')
      
      // Initialize Geoapify Autocomplete - use minimal config to avoid 400 errors
      const autocomplete = new GeocoderAutocomplete(containerRef.current, apiKey, {
        placeholder: placeholder,
        limit: 5,
        debounceDelay: 300,
        minLength: 3
      })
      
      console.log('✅ Autocomplete initialized:', autocomplete)

      // Style the input to match our design system
      const input = containerRef.current.querySelector('input')
      if (input) {
        input.className = `flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`
        input.disabled = disabled
        
        // Set initial value
        if (value) {
          input.value = value
        }
      }

      // Handle address selection
      autocomplete.on('select', (location) => {
        console.log('📍 Address selected:', location)
        setIsLoading(false)
        setError(null)
        
        const properties = location.properties
        const geometry = location.geometry
        
        const addressComponents: AddressComponents = {
          formatted: properties.formatted || '',
          street: properties.street,
          house_number: properties.housenumber,
          city: properties.city || properties.town || properties.village,
          state: properties.state || properties.province,
          postcode: properties.postcode,
          country: properties.country,
          latitude: geometry?.coordinates?.[1],
          longitude: geometry?.coordinates?.[0]
        }
        
        onChange(properties.formatted || '', addressComponents)
      })

      // Handle input changes
      autocomplete.on('input', (query) => {
        console.log('⌨️ Input changed:', query)
        if (query.length >= 3) {
          setIsLoading(true)
          setError(null)
          console.log('🔍 Searching for:', query)
        } else {
          setIsLoading(false)
        }
        onChange(query)
      })

      // Handle suggestions loaded
      autocomplete.on('suggestions', (suggestions) => {
        console.log('📋 Suggestions loaded:', suggestions)
        setIsLoading(false)
      })

      // Handle errors
      autocomplete.on('error', (error) => {
        console.error('❌ Geocoder error:', error)
        setIsLoading(false)
        setError('Unable to load address suggestions')
      })

      autocompleteRef.current = autocomplete

    } catch (err) {
      console.error('❌ Failed to initialize autocomplete:', err)
      setError('Failed to initialize address autocomplete')
    }

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        autocompleteRef.current.off('select')
        autocompleteRef.current.off('input')
        autocompleteRef.current.off('suggestions')
        autocompleteRef.current.off('error')
      }
    }
  }, [placeholder, disabled, onChange])

  // Update input value when prop changes
  useEffect(() => {
    if (containerRef.current) {
      const input = containerRef.current.querySelector('input')
      if (input && input.value !== value) {
        input.value = value
      }
    }
  }, [value])

  if (error && !process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY) {
    // Fallback to regular input if API key is missing
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        disabled={disabled}
      />
    )
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full" />
      
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
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