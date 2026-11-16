//REST result as the frontend sees it: the backend sends plain JSON, the frontend api helper wraps it in this.
export interface ApiResponse<T> {
  isSuccess: boolean
  message: string
  data: T | null
  statusCode: number
}
