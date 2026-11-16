'use server'
//The only backend client: axios with the session token, every result wrapped in ApiResponse.

import axios, {AxiosError} from 'axios'
import {cookies} from 'next/headers'
import sessionOpts from '@frontend/_util/sessionOpts'
import {backendUrl} from '@frontend/_util/backendUrl'
import {ApiResponse} from '@frontend/deps/types/internal/ApiResponse'

//HTTP Status Codes Cheat Sheet
// 2xx Success
// 200 OK - Standard success response for GET/PUT requests
// 201 Created - Successfully created a resource (POST)
// 202 Accepted - Request accepted but processing not complete
// 204 No Content - Success but no response body (common for DELETE)

// 4xx Client Errors
// 400 Bad Request - Generic client error (invalid data)
// 401 Unauthorized - Missing/invalid authentication
// 403 Forbidden - Authenticated but no permissions
// 404 Not Found - Resource doesn't exist
// 405 Method Not Allowed - Wrong HTTP method used
// 409 Conflict - Resource state conflict (e.g., duplicate)
// 422 Unprocessable Entity - Semantic errors (validation failed)
// 429 Too Many Requests - Rate limiting

// 5xx Server Errors
// 500 Internal Server Error - Generic server error
// 501 Not Implemented - Unsupported functionality
// 502 Bad Gateway - Upstream server issues
// 503 Service Unavailable - Server overload/maintenance
// 504 Gateway Timeout - Upstream timeout

const api = axios.create({
  baseURL: backendUrl()
})

api.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') {
    const cookieStore = await cookies()
    const token = cookieStore.get(sessionOpts().name)?.value

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }

  return config
})



type ApiMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export default async function <T>(
  method: ApiMethod,
  url: string,
  data?: any,
  config?: any
): Promise<ApiResponse<T>> {
  try {
    const response = await api[method]<T>(url, data, config);
    return {
      isSuccess: true,
      message: 'Request successful',
      data: response.data,
      statusCode: response.status,
    };
  } catch (error) {
    let statusCode = 500;
    if (axios.isAxiosError(error)) {
      statusCode = error.response?.status || 500;
    }

    return {
      isSuccess: false,
      message: `${axiosErrorHandler(error)}: (${method}) ${url}`,
      data: null,
      statusCode,
    };
  }
}

const axiosErrorHandler = (error: unknown) => {
  if (axios.isAxiosError<string>(error)) {
    const axiosError = error as AxiosError<string>

    if (axiosError.response) {
      return axiosError.response.data || axiosError.response.statusText || axiosError.response.status.toString()
    } else {
      return axiosError.request ? "Нет ответа от сервера" : "Ошибка создания запроса к серверу"
    }
  } else if (error instanceof Error) {
    return error.message
  } else {
    return "Неизвестная ошибка"
  }
}