import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import MainLayout from '../../Components/Layouts/MainLayout'
import AdminLayout from '../../Components/Layouts/AdminLayout'
import { ROLE_HIERARCHY } from '../../utils/constants'
import { resolveSidebarVariant } from '../../utils/helpers'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const passwordStrength = (pwd = '') => {
  let score = 0
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  return score // 0..4
}

const Profile = () => {
  const location = useLocation()
  const { role } = useParams()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const sidebarVariant = resolveSidebarVariant(location.pathname, role)
  const Layout = isAdminRoute ? AdminLayout : MainLayout
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [roleLabel, setRoleLabel] = useState('')
  const [status, setStatus] = useState('')
  const [mobileNo, setMobileNo] = useState('')
  const [officeExtNo, setOfficeExtNo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      const storedUserRaw = localStorage.getItem('currentUser')

      if (!storedUserRaw) {
        if (isMounted) {
          setProfileLoading(false)
          setError('No logged-in user found. Please sign in again.')
        }
        return
      }

      try {
        const storedUser = JSON.parse(storedUserRaw)
        const searchParams = new URLSearchParams()

        if (storedUser?.email) {
          searchParams.set('email', storedUser.email)
        } else if (storedUser?.id) {
          searchParams.set('userId', storedUser.id)
        }

        const response = await fetch(`${API_BASE_URL}/api/profile?${searchParams.toString()}`)
        const responseText = await response.text()
        let data = {}

        if (responseText) {
          data = JSON.parse(responseText)
        }

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to load profile details.')
        }

        const profile = data.profile || {}

        if (isMounted) {
          setName(profile.name || '')
          setEmail(profile.email || '')
          setDepartment(profile.department || '')
          setRoleLabel(ROLE_HIERARCHY[profile.role]?.label || profile.role || '')
          setStatus(profile.status || '')
          setMobileNo(profile.mobileNo ? String(profile.mobileNo) : '')
          setOfficeExtNo(profile.officeExtNo ? String(profile.officeExtNo) : '')

          const updatedUser = { ...storedUser, ...profile }
          localStorage.setItem('currentUser', JSON.stringify(updatedUser))
          if (profile.name) {
            localStorage.setItem('username', profile.name)
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load profile details.')
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const strength = useMemo(() => passwordStrength(password), [password])

  const isPasswordValid = password.length > 0 ? password.length >= 8 && strength >= 3 : false
  const isConfirmMatch = password === confirmPassword && password.length > 0
  const isCurrentProvided = currentPassword.length > 0

  // Users may only update password; require current password, new password and confirm to enable save
  const canSave = isCurrentProvided && isPasswordValid && isConfirmMatch && !loading

  const handleSave = async (e) => {
    e.preventDefault()
    setMessage(null)
    setError(null)

    if (!isCurrentProvided) return setError('Enter your current password')
    if (!isPasswordValid) return setError('Password must be at least 8 characters and include uppercase, number and special char')
    if (!isConfirmMatch) return setError('Passwords do not match')

    setLoading(true)
    try {
      // Send currentPassword + new password for verification/update
      const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      const payload = {
        userId: storedUser.id,
        email: storedUser.email || email,
        currentPassword,
        password,
      }

      const res = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to save profile')
      }

      setMessage('Profile updated successfully')
      setPassword('')
      setConfirmPassword('')
      setCurrentPassword('')
    } catch (err) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout {...(isAdminRoute ? {} : { variant: sidebarVariant })}>
      <div className="gradient-primary py-6 rounded-t">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
          <p className="text-sm text-primary-50 mt-1">View your profile and update your password</p>
        </div>
      </div>

      <div className="p-6">

        <form onSubmit={handleSave} className="bg-white p-6 rounded-md shadow-sm max-w-2xl">
          {message && <div className="mb-4 p-3 bg-green-50 text-green-800 rounded">{message}</div>}
          {error && <div className="mb-4 p-3 bg-red-50 text-red-800 rounded">{error}</div>}

          <p className="text-sm text-gray-600 mb-4">Profile details below are loaded from the database. Only password updates are allowed from this page.</p>

          {profileLoading && <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded">Loading profile details...</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1 bg-gray-50"
                value={name}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1 bg-gray-50"
                value={email}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Department</label>
              <input
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1 bg-gray-50"
                value={department}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <input
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1 bg-gray-50"
                value={roleLabel}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <input
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1 bg-gray-50"
                value={status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : ''}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Mobile No</label>
              <input
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1 bg-gray-50"
                value={mobileNo}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Office Extension</label>
              <input
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1 bg-gray-50"
                value={officeExtNo}
                readOnly
              />
            </div>

            <div></div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Current Password</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div></div>

            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="mt-2 flex items-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 rounded-full ${i < strength ? 'bg-primary-600' : 'bg-gray-200'}`}
                  />
                ))}
                <span className="text-xs text-gray-500 ml-2">{password ? ['Very weak', 'Weak', 'Good', 'Strong'][Math.max(0, strength - 1)] : 'No password'}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword.length > 0 && !isConfirmMatch && (
                <p className="text-sm text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={!canSave}
              className={`px-4 py-2 rounded-md text-white ${canSave ? 'bg-primary-600' : 'bg-gray-300 cursor-not-allowed'}`}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>

            <button
              type="button"
              className="px-4 py-2 rounded-md border"
              onClick={() => {
                setPassword('')
                setConfirmPassword('')
                setCurrentPassword('')
                setMessage(null)
                setError(null)
              }}
            >
              Reset Password Fields
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}

export default Profile
