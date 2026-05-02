import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import MainLayout from '../../Components/Layouts/MainLayout'
import { Card, Button, FormInput, PageHeader } from '../../Components/UI'
import { resolveSidebarVariant } from '../../utils/helpers'
import { INVENTORY_REQUEST_TYPE } from '../../utils/constants'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{}')
  } catch {
    return {}
  }
}

const InventoryCreationRequest = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useParams()
  const [searchParams] = useSearchParams()
  const sidebarVariant = resolveSidebarVariant(location.pathname, role)
  const [currentUser, setCurrentUser] = useState(getStoredUser)
  const [users, setUsers] = useState([])
  const [requestError, setRequestError] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [optionsError, setOptionsError] = useState('')
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  
  // Determine request type from URL parameter or default to ADD_EXISTING
  const requestTypeParam = searchParams.get('type') || 'add'
  const activeRequestType = requestTypeParam === 'new' ? INVENTORY_REQUEST_TYPE.CREATE_NEW : INVENTORY_REQUEST_TYPE.ADD_EXISTING

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    department: currentUser.department || '',
    incharge: '',
    Hod: '',
    description: '',
  })

  useEffect(() => {
    const storedUser = getStoredUser()
    setCurrentUser(storedUser)
    setFormData(prev => ({
      ...prev,
      department: storedUser.department || '',
      incharge: String(storedUser.id || '') || '',
    }))
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadFormOptions = async () => {
      try {
        setOptionsError('')

        const usersResponse = await fetch(`${API_BASE_URL}/api/users`)

        const usersData = await usersResponse.json()

        if (!usersResponse.ok || !usersData.success) {
          throw new Error(usersData.error || usersData.message || 'Failed to load users.')
        }

        if (!isMounted) {
          return
        }

        setUsers(usersData.users || [])
      } catch (error) {
        if (isMounted) {
          setUsers([])
          setOptionsError(error.message || 'Failed to load account details for inventory request.')
        }
      }
    }

    loadFormOptions()

    return () => {
      isMounted = false
    }
  }, [])

  const currentUserRecord = useMemo(
    () =>
      users.find(
        (user) =>
          (currentUser.id && String(user.id) === String(currentUser.id)) ||
          (currentUser.email && String(user.email || '').toLowerCase() === String(currentUser.email).toLowerCase())
      ) || null,
    [currentUser.email, currentUser.id, users]
  )

  const accountDepartment = currentUser.department || currentUserRecord?.department || ''
  const accountHolderName = currentUser.name || currentUserRecord?.name || ''
  const accountInchargeId = Number(currentUser.id || currentUserRecord?.id || 0)

  const departmentHodLookup = useMemo(
    () =>
      users.reduce((lookup, user) => {
        if (user.role === 'head_of_department' && user.department) {
          lookup[user.department] = { id: user.id, name: user.name }
        }

        return lookup
      }, {}),
    [users]
  )

  const assignedHod = departmentHodLookup[accountDepartment]

  useEffect(() => {
    const nextDepartment = accountDepartment
    const nextHod = assignedHod?.name || ''

    if (formData.department !== nextDepartment || formData.Hod !== nextHod) {
      setFormData((prev) => ({
        ...prev,
        department: nextDepartment,
        Hod: nextHod,
      }))
    }
  }, [accountDepartment, assignedHod?.name, formData.Hod, formData.department])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setRequestError('')
    setRequestMessage('')

    try {
      setIsSubmittingRequest(true)

      const payload = {
        requestedById: currentUser.id,
        requestType: activeRequestType,
        name: formData.name.trim(),
        location: formData.location.trim(),
        department: accountDepartment,
        inchargeId: accountInchargeId,
        hodUserId: assignedHod?.id || null,
        description: formData.description.trim(),
      }

      // Basic client-side validation
      if (!payload.name) {
        setRequestError('Inventory name is required.')
        setIsSubmittingRequest(false)
        return
      }

      if (!payload.location) {
        setRequestError('Inventory location is required.')
        setIsSubmittingRequest(false)
        return
      }

      if (!payload.department) {
        setRequestError('Your account has no department assigned. Cannot submit request.')
        setIsSubmittingRequest(false)
        return
      }

      const response = await fetch(`${API_BASE_URL}/api/inventory-creation-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      let data = {}
      try {
        data = await response.json()
      } catch (jsonErr) {
        console.error('Non-JSON response from server', jsonErr)
      }

      if (!response.ok || !data.success) {
        const serverMessage = data.message || data.error || `Server responded ${response.status}`
        console.error('Inventory request failed:', response.status, serverMessage, data)
        setRequestError(serverMessage)
        setIsSubmittingRequest(false)
        return
      }

      setRequestMessage(
        data.message ||
          (activeRequestType === INVENTORY_REQUEST_TYPE.ADD_EXISTING
            ? 'Inventory addition request submitted to your Head of Department for approval.'
            : 'New inventory creation request submitted for approval.')
      )

      // Reset form after successful submission
      setTimeout(() => {
        navigate('/staff/dashboard')
      }, 2000)
    } catch (error) {
      setRequestError(error.message || 'Failed to submit inventory creation request.')
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  const handleCancel = () => {
    navigate('/staff/dashboard')
  }

  const requestTitle =
    activeRequestType === INVENTORY_REQUEST_TYPE.ADD_EXISTING
      ? 'Add Inventory Request'
      : 'New Inventory Creation Request'

  const requestDescription =
    activeRequestType === INVENTORY_REQUEST_TYPE.ADD_EXISTING
      ? 'Use this for inventories already used by the faculty. Only HOD approval is required.'
      : 'Use this for creating a brand new inventory. This request proceeds through HOD, registrar, and admin approval.'

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title={requestTitle}
        subtitle="Submit a new inventory creation request"
      />

      <div className="p-6 space-y-6">
        {/* Info Card */}
        <Card>
        <div className="rounded bg-blue-50 px-4 py-3 text-sm text-red-800 border border-blue-500 font-bold text-center">
            {requestDescription}
          </div>
        </Card>

        {/* Error Messages */}
        {requestError && (
          <div className="rounded bg-red-50 px-4 py-3 text-sm text-red-800 border border-red-500 font-bold text-center">
            {requestError}
          </div>
        )}

        {/* Success Message */}
        {requestMessage && (
          <div className="rounded bg-green-50 px-4 py-3 text-sm text-green-800 border border-green-500 font-bold text-center">
            {requestMessage}
          </div>
        )}

        {/* Options Error */}
        {optionsError && (
          <div className="rounded bg-yellow-50 px-4 py-3 text-sm text-yellow-800 border border-yellow-500 font-bold text-center">
            {optionsError}
          </div>
        )}

        {/* Form Card */}
        <Card title="Inventory Request Details" icon="playlist_add">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Name and Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput
                label="Inventory Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter inventory name"
                required
              />

              <FormInput
                label="Inventory Location (Office/Lab)"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Enter inventory location"
                required
              />
            </div>

            {/* Row 2: Department and HOD */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput
                label="Department"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                placeholder="Department"
                disabled
                required
              />

              <FormInput
                label="Head of Department"
                name="Hod"
                value={formData.Hod}
                onChange={handleInputChange}
                placeholder="Department HOD"
                disabled
              />
            </div>

            {/* Row 3: Inventory Officer */}
            <div className="grid grid-cols-1 gap-6">
              <FormInput
                label="Inventory Officer"
                name="incharge"
                value={accountHolderName}
                onChange={handleInputChange}
                placeholder="Inventory officer"
                disabled
                required
              />
            </div>

            {/* Row 4: Description */}
            <div className="grid grid-cols-1 gap-6">
              <FormInput
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Inventory request description (optional)"
                as="textarea"
                rows={5}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-border-lighter">
              <Button type="submit" variant="primary" disabled={isSubmittingRequest}>
                {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
              </Button>
              <Button type="button" variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </MainLayout>
  )
}

export default InventoryCreationRequest
