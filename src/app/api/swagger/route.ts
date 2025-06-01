import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

// Define a type for the error response
interface ErrorResponse {
  error: string;
}

export async function GET(): Promise<NextResponse<unknown | ErrorResponse>> {
  try {
    // Get the absolute path to the swagger.json file in the public directory
    const filePath = path.join(process.cwd(), 'public', 'swagger.json');
    
    // Read the file
    const fileContent = readFileSync(filePath, 'utf8');
    
    // Parse the JSON content
    const swaggerDocument = JSON.parse(fileContent);
    
    console.log('Swagger route called successfully');
    return NextResponse.json(swaggerDocument);
  } catch (error) {
    console.error('Error loading swagger document:', error);
    return NextResponse.json(
      { error: 'Failed to load API documentation' } as ErrorResponse,
      { status: 500 }
    );
  }
}