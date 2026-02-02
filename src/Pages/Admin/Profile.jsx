import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import MainLayout from '../../Components/Layouts/MainLayout'
import AdminLayout from '../../Components/Layouts/AdminLayout'
import { MOCK_USER } from '../../utils/constants'
import { resolveSidebarVariant } from '../../utils/helpers'

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
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Prefill with mock user; replace with real user data source when available
    if (MOCK_USER) {
      setName(MOCK_USER.name || '')
      setEmail(MOCK_USER.email || '')
      setDepartment(MOCK_USER.department || '')
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
      const payload = {
        currentPassword,
        password,
      }

      const res = await fetch('/api/profile', {
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
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-4">Profile Settings</h2>

        <form onSubmit={handleSave} className="bg-white p-6 rounded-md shadow-sm max-w-2xl">
          {message && <div className="mb-4 p-3 bg-green-50 text-green-800 rounded">{message}</div>}
          {error && <div className="mb-4 p-3 bg-red-50 text-red-800 rounded">{error}</div>}

          <p className="text-sm text-gray-600 mb-4">Only password updates are allowed from this page. Other profile fields are view-only; contact an administrator to change them.</p>

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
