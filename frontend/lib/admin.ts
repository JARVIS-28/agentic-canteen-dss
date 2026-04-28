import { API_BASE_URL } from "./api";
const API_BASE = API_BASE_URL;

export async function login(email: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(API_BASE + '/admin/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
    if (!res.ok) return false
    const data = await res.json()
    if (data?.token) {
      try { localStorage.setItem('admin_token', data.token) } catch (e) {}
      return true
    }
  } catch (e) {
    return false
  }
  return false
}

export async function logout(): Promise<void> {
  try {
    const token = localStorage.getItem('admin_token')
    if (token) await fetch(API_BASE + '/admin/logout', { 
      method: 'POST', 
      headers: { 'x-admin-token': token, 'authorization': `Bearer ${token}` } 
    })
  } catch (e) {}
  try { localStorage.removeItem('admin_token') } catch (e) {}
}

export async function deleteAccount(): Promise<boolean> {
  try {
    const token = localStorage.getItem('admin_token')
    if (!token) return false
    const res = await fetch(API_BASE + '/admin/delete-account', {
      method: 'POST',
      headers: { 'x-admin-token': token, 'authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      localStorage.removeItem('admin_token')
      return true
    }
  } catch (e) {}
  return false
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  try { return !!localStorage.getItem('admin_token') } catch (e) { return false }
}
