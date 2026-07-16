import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import MainLayout from '../../Components/Layouts/MainLayout'
import AdminLayout from '../../Components/Layouts/AdminLayout'
import { Button, Modal, PageHeader } from '../../Components/UI'
import { ROLE_HIERARCHY } from '../../utils/constants'
import { resolveSidebarVariant } from '../../utils/helpers'
import {
  getPasswordStrength,
  getPasswordStrengthLabel,
  isPasswordValid,
  PASSWORD_MAX_LENGTH,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '../../utils/passwordValidation'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const Profile = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { role } = useParams()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const sidebarVariant = resolveSidebarVariant(location.pathname, role)
  const Layout = isAdminRoute ? AdminLayout : MainLayout
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [designation, setDesignation] = useState('')
  const [roleLabel, setRoleLabel] = useState('')
  const [status, setStatus] = useState('')
  const [mobileNo, setMobileNo] = useState('')
  const [originalMobileNo, setOriginalMobileNo] = useState('')
  const [officeExtNo, setOfficeExtNo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [passwordOtp, setPasswordOtp] = useState('')
  const [passwordOtpSent, setPasswordOtpSent] = useState(false)
  const [passwordOtpLoading, setPasswordOtpLoading] = useState(false)
  const [showPasswordChangedModal, setShowPasswordChangedModal] = useState(false)

  const [loading, setLoading] = useState(false)
  const [deactivationLoading, setDeactivationLoading] = useState(false)
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
          setDesignation(profile.designation || storedUser.designation || '')
          setRoleLabel(ROLE_HIERARCHY[profile.role]?.label || profile.role || '')
          setStatus(profile.status || '')
          setMobileNo(profile.mobileNo ? String(profile.mobileNo) : '')
          setOriginalMobileNo(profile.mobileNo ? String(profile.mobileNo) : '')
          setOfficeExtNo(profile.officeExtNo ? String(profile.officeExtNo) : '')

          const updatedUser = { ...storedUser, ...profile }
          localStorage.setItem('currentUser', JSON.stringify(updatedUser))
          localStorage.setItem('userRole', profile.role || updatedUser.role || '')
          window.currentUser = updatedUser
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

  const strength = useMemo(() => getPasswordStrength(password), [password])

  const mobileNoChanged = mobileNo !== originalMobileNo
  const passwordAttempt = currentPassword.length > 0 || password.length > 0 || confirmPassword.length > 0
  const isNewPasswordValid = password.length > 0 ? isPasswordValid(password) : false
  const isConfirmMatch = password === confirmPassword && password.length > 0
  const isCurrentProvided = currentPassword.length > 0
  const passwordValid = !passwordAttempt || (isCurrentProvided && isNewPasswordValid && isConfirmMatch)

  const canSave = (mobileNoChanged || passwordAttempt) && passwordValid && !loading

  const handleSendPasswordOtp = async () => {
    setMessage(null)
    setError(null)

    if (!passwordAttempt) {
      setError('Enter your current password and new password first')
      return
    }

    if (!isCurrentProvided) {
      setError('Enter your current password')
      return
    }

    if (!isNewPasswordValid) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE)
      return
    }

    if (!isConfirmMatch) {
      setError('Passwords do not match')
      return
    }

    setPasswordOtpLoading(true)
    try {
      const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      const response = await fetch(`${API_BASE_URL}/api/profile/request-password-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: storedUser.id,
          email: storedUser.email || email,
          currentPassword,
          password,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to send verification code')
      }

      setPasswordOtpSent(true)
      setMessage(data.message || 'Verification code sent to your email.')
    } catch (err) {
      setError(err.message || 'Failed to send verification code')
    } finally {
      setPasswordOtpLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setMessage(null)
    setError(null)

    if (passwordAttempt) {
      if (!isCurrentProvided) return setError('Enter your current password')
      if (!isNewPasswordValid) return setError(PASSWORD_REQUIREMENTS_MESSAGE)
      if (!isConfirmMatch) return setError('Passwords do not match')
      if (!passwordOtpSent) return setError('Send the verification code to your email first')
      if (passwordOtp.length !== 6) return setError('Enter the 6-digit verification code sent to your email')
    }

    setLoading(true)
    try {
      const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      const payload = {
        userId: storedUser.id,
        email: storedUser.email || email,
        ...(mobileNoChanged ? { mobileNo } : {}),
      }

      const res = passwordAttempt
        ? await fetch(`${API_BASE_URL}/api/profile/confirm-password-reset-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            currentPassword,
            password,
            otp: passwordOtp,
          }),
        })
        : await fetch(`${API_BASE_URL}/api/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to save profile')
      }

      if (passwordAttempt) {
        setMessage('OTP matched successfully. Password changed successfully. Please login again.')
        setShowPasswordChangedModal(true)
      } else {
        setMessage('Profile updated successfully')
      }
      setOriginalMobileNo(mobileNo)
      setPassword('')
      setConfirmPassword('')
      setCurrentPassword('')
      setPasswordOtp('')
      setPasswordOtpSent(false)

    } catch (err) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivationRequest = async () => {
    setMessage(null)
    setError(null)

    const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}')

    if (!storedUser?.id && !storedUser?.email) {
      setError('No logged-in user found. Please sign in again.')
      return
    }

    const confirmed = window.confirm('Submit a deactivation request for your account? If you have any unreturned items or you are managing an inventory, you are not eligible for deactivation. This request will be sent to your Head of Department for review.')

    if (!confirmed) {
      return
    }

    setDeactivationLoading(true)
    try {
      const payload = {
        userId: storedUser.id,
        email: storedUser.email || email,
        name: storedUser.name || name,
        role: storedUser.role || roleLabel,
        department,
      }

      const response = await fetch(`${API_BASE_URL}/api/account-requests/deactivation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        if ((data.code === 'OUTSTANDING_ITEM_RETURNS' || data.code === 'MANAGED_INVENTORIES_EXIST') && data.message) {
          window.alert(data.message)
        }
        throw new Error(data.message || 'Failed to submit deactivation request')
      }

      setMessage(data.message || 'Deactivation request submitted successfully')
    } catch (err) {
      setError(err.message || 'Failed to submit deactivation request')
    } finally {
      setDeactivationLoading(false)
    }
  }

  return (
    <Layout {...(isAdminRoute ? {} : { variant: sidebarVariant })}>
      <PageHeader
        title="Profile Settings"
        subtitle="View your profile and update your mobile number or password. You can also submit a deactivation request from this page."
      />

      <div className="p-6">

        <form onSubmit={handleSave} className="bg-white p-6 rounded-md shadow-sm max-w-2xl">
          {message && <div className="mb-4 p-3 bg-green-50 text-green-800 rounded">{message}</div>}
          {error && <div className="mb-4 p-3 bg-red-50 text-red-800 rounded">{error}</div>}

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
              <label className="block text-sm font-medium text-gray-700">Designation</label>
              <input
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1 bg-gray-50"
                value={designation}
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
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1"
                value={mobileNo}
                onChange={(e) => setMobileNo(e.target.value)}
                placeholder="Enter mobile number"
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

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Current Password</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 border border-border rounded-lg mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={PASSWORD_MAX_LENGTH}
              />
              <div className="mt-2 flex items-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 rounded-full ${i < strength ? 'bg-primary-600' : 'bg-gray-200'}`}
                  />
                ))}
                <span className="text-xs text-gray-500 ml-2">
                  {password ? getPasswordStrengthLabel(strength) : 'No password'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
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

            {passwordAttempt ? (
              <div className="md:col-span-2 rounded-lg border border-border bg-gray-50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Email verification for password change</p>
                    <p className="text-xs text-gray-500 mt-1">Send a 6-digit OTP to your registered email, then enter it below to confirm the password update.</p>
                  </div>
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-md text-white ${passwordOtpLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600'}`}
                    onClick={handleSendPasswordOtp}
                    disabled={passwordOtpLoading}
                  >
                    {passwordOtpLoading ? 'Sending OTP...' : (passwordOtpSent ? 'Resend OTP' : 'Send OTP')}
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Verification Code</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-border rounded-lg mt-1"
                    value={passwordOtp}
                    onChange={(e) => setPasswordOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
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
                setMobileNo(originalMobileNo)
                setPassword('')
                setConfirmPassword('')
                setCurrentPassword('')
                setPasswordOtp('')
                setPasswordOtpSent(false)
                setMessage(null)
                setError(null)
              }}
            >
              Reset Fields
            </button>

            <button
              type="button"
              disabled={deactivationLoading || status.toLowerCase() === 'inactive'}
              className={`px-4 py-2 rounded-md text-white ${(deactivationLoading || status.toLowerCase() === 'inactive') ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
              onClick={handleDeactivationRequest}
            >
              {deactivationLoading ? 'Submitting Request...' : 'Request for Deactivation'}
            </button>

          </div>
        </form>
      </div>

      <Modal
        isOpen={showPasswordChangedModal}
        onClose={() => {
          setShowPasswordChangedModal(false)
          localStorage.removeItem('currentUser')
          localStorage.removeItem('userRole')
          localStorage.removeItem('username')
          window.currentUser = null
          navigate('/')
        }}
        title="Password Changed"
        size="sm"
        footer={(
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                setShowPasswordChangedModal(false)
                localStorage.removeItem('currentUser')
                localStorage.removeItem('userRole')
                localStorage.removeItem('username')
                window.currentUser = null
                navigate('/')
              }}
            >
              Login Again
            </Button>
          </div>
        )}
      >
        <p className="text-sm text-text-dark">OTP matched successfully.</p>
        <p className="mt-2 text-sm text-text-light">Password changed successfully. Please login again.</p>
      </Modal>
    </Layout>
  )
}

export default Profile
