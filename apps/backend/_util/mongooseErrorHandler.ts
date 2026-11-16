import {typedValues} from "@backend/deps/_util/translationMap"
import {Response} from "express"

export interface MongooseValidationError extends Error {
  name: 'ValidationError';
  errors: Record<string, { message: string }>;
}

export function isValidationError(error: unknown): error is MongooseValidationError {
  return error instanceof Error &&
    error.name === 'ValidationError' &&
    'errors' in error;
}

export function genericErrorHandler(error: unknown, res: Response) {
  if (isValidationError(error)) {
    const messages = typedValues(error.errors).map(err => err.message)
    return void res.status(400).send(messages.join(', '))
  } else {
    console.error('Server error:', error)
    return void res.sendStatus(500)
  }
}