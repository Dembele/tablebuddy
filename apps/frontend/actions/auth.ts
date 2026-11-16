'use server'
//Auth server actions: login / register set the session cookie, logout clears it, identifyUser asks the backend.

import 'server-only'
import {cookies} from "next/headers"
import api from "@frontend/_util/api"
import {UserSafe} from "@frontend/deps/interfaces/DB/User"
import sessionOpts from "@frontend/_util/sessionOpts"
import {redirect} from "next/navigation"
import {ApiResponse} from "@frontend/deps/types/internal/ApiResponse"
import {typedValues} from "@frontend/deps/_util/translationMap"

// Shared Types
export interface AuthErrors {
  username?: string;
  password?: string;
  global?: string;
}

interface AuthResponse<T = null> {
  errors: AuthErrors;
  success: boolean;
  user: UserSafe | T;
}

interface AuthTokenResponse {
  user: UserSafe;
  token: string;
}

// Helper Functions
async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  const options = sessionOpts()

  cookieStore.set({
    name: options.name,
    value: token,
    path: options.path,
    secure: options.secure,
    sameSite: options.sameSite,
    httpOnly: options.httpOnly
  })
}

async function validateCredentials(username?: string, password?: string): Promise<AuthErrors> {
  const errors: AuthErrors = {}

  if (!username) {
    errors.username = "Ошибка имени пользователя адреса"
  }
  if (!password || password.length < 6 || password.length > 20) {
    errors.password = "Ошибка пароля"
  }

  return errors
}

// Auth Actions
export async function login(
  _state: unknown,
  formData: FormData
): Promise<AuthResponse> {
  const username = formData.get("username")?.toString().trim()
  const password = formData.get("password")?.toString().trim()

  const errors = await validateCredentials(username, password)
  const hasErrors = typedValues(errors).some(Boolean)

  if (hasErrors) {
    return {errors, success: false, user: null}
  }

  const {data, isSuccess, statusCode, message} = await api<AuthTokenResponse>(
    'post',
    '/auth/login',
    {username, password}
  )

  if (isSuccess && data?.user && data?.token) {
    await setAuthCookie(data.token)
    return {errors, success: true, user: data.user}
  }

  return {
    errors: {global: `${statusCode || 'UNKNOWN'}: ${message || 'Ошибка API'}`},
    success: false,
    user: null
  }
}

export async function register(
  _state: unknown,
  formData: FormData
): Promise<AuthResponse> {
  const username = formData.get("username")?.toString().trim()
  const password = formData.get("password")?.toString().trim()
  const password2 = formData.get("password2")?.toString().trim()
  const code = formData.get("code")?.toString().trim()                                                                  //invite code; the backend checks it when REGISTRATION_CODE is set

  const errors = await validateCredentials(username, password)

  if (password !== password2) {
    errors.password = "Пароли не совпадают"
  }

  const hasErrors = typedValues(errors).some(Boolean)

  if (hasErrors) {
    return {errors, success: false, user: null}
  }

  const {data, isSuccess, statusCode, message} = await api<AuthTokenResponse>(
    'post',
    '/auth/register',
    {username, password, code}
  )

  if (isSuccess && data?.user && data?.token) {
    await setAuthCookie(data.token)
    return {errors, success: true, user: data.user}
  }

  return {
    errors: {global: `${statusCode || 'UNKNOWN'}: ${message || 'Ошибка API'}`},
    success: false,
    user: null
  }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(sessionOpts().name)
  return redirect('/auth/login')
}

export async function identifyUser(): Promise<ApiResponse<UserSafe>> {
  return await api<UserSafe>('get', '/auth/')
}
//own password change; other sessions of this user end
export async function changePassword(current: string, next: string) {
  const result = await api<void>('patch', '/auth/password', {current, next})
  return {isSuccess: result.isSuccess, message: result.message}
}
