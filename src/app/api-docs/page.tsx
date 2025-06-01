"use client"

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import 'swagger-ui-react/swagger-ui.css'

// Dynamic import with SSR disabled
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })

export default function ApiDocs() {
  // Use state to store the swagger spec
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch the swagger spec instead of using the url prop (which causes warnings)
  useEffect(() => {
    async function fetchSpec() {
      try {
        const response = await fetch('/api/swagger')
        if (!response.ok) {
          throw new Error(`Failed to load API spec: ${response.statusText}`)
        }
        const data = await response.json()
        setSpec(data)
      } catch (err) {
        setError((err as Error).message || 'Failed to load API documentation')
        console.error('Error loading swagger spec:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSpec()
  }, [])

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Dev Connect API Documentation</h1>
      
      {isLoading && <p>Loading API documentation...</p>}
      {error && <div className="p-4 bg-red-100 text-red-700 rounded">{error}</div>}
      
      {/* Pass the spec directly instead of using url prop */}
      {spec && <SwaggerUI spec={spec} />}
    </div>
  )
}