import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import MainLayout from '../../Components/Layouts/MainLayout'
import { Card, Button, FormInput, PageHeader, Select } from '../../Components/UI'
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
  const isAdminView = String(role || '').toLowerCase() === 'admin'
  const sidebarVariant = resolveSidebarVariant(location.pathname, role)
  const [currentUser, setCurrentUser] = useState(getStoredUser)
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [requestError, setRequestError] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [optionsError, setOptionsError] = useState('')
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  
  const requestTypeParam = searchParams.get('type') || 'add'
  const [activeRequestType, setActiveRequestType] = useState(
    requestTypeParam === 'new' ? INVENTORY_REQUEST_TYPE.CREATE_NEW : INVENTORY_REQUEST_TYPE.ADD_EXISTING
  )

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
    setFormData((prev) => ({
      ...prev,
      department: isAdminView ? '' : storedUser.department || '',
      incharge: isAdminView ? '' : String(storedUser.id || '') || '',
    }))
  }, [isAdminView])

  useEffect(() => {
    let isMounted = true

    const loadFormOptions = async () => {
      try {
        setOptionsError('')

        const [departmentsResponse, usersResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/departments`),
          fetch(`${API_BASE_URL}/api/users`),
        ])

        const [departmentsData, usersData] = await Promise.all([
          departmentsResponse.json(),
          usersResponse.json(),
        ])

        if (!departmentsResponse.ok || !departmentsData.success) {
          throw new Error(departmentsData.error || departmentsData.message || 'Failed to load departments.')
        }

        if (!usersResponse.ok || !usersData.success) {
          throw new Error(usersData.error || usersData.message || 'Failed to load users.')
        }

        if (!isMounted) {
          return
        }

        setDepartments(departmentsData.departments || [])
        setUsers(usersData.users || [])
      } catch (error) {
        if (isMounted) {
          setUsers([])
          setDepartments([])
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

  const departmentOptions = useMemo(
    () => departments.map((dept) => ({ value: dept.name, label: dept.name })),
    [departments]
  )

  const inventoryOfficerOptions = useMemo(() => {
    const normalizedDepartment = String(formData.department || '').trim().toLowerCase()
    if (!normalizedDepartment) return []

    const departmentUsers = users.filter(
      (user) => String(user.department || '').trim().toLowerCase() === normalizedDepartment
    )

    const normalize = (value) => String(value || '').trim().toLowerCase()
    const officerDesignation = (value) => {
      const normalized = normalize(value)
      return [
        /\bto\b/i,
        /\bma\b/i,
        /technical officer/i,
        /maintenance assistant/i,
      ].some((regex) => regex.test(normalized))
    }

    return departmentUsers
      .filter((user) => officerDesignation(user.designation) || normalize(user.role) === 'inventory_incharge')
      .map((user) => ({
        value: String(user.id),
        label: `${user.name}${user.designation ? ` (${user.designation})` : ''}`,
      }))
  }, [formData.department, users])

  const accountHolderName = currentUser.name || currentUserRecord?.name || ''
  const accountInchargeId = Number(currentUser.id || currentUserRecord?.id || 0)

  const selectedDepartmentHod = useMemo(() => {
    const normalizedDepartment = String(formData.department || '').trim().toLowerCase()
    if (!normalizedDepartment) return null

    const usersInDepartment = users.filter(
      (user) => String(user.department || '').trim().toLowerCase() === normalizedDepartment
    )

    if (usersInDepartment.length === 0) return null

    const normalize = (value) => String(value || '').trim().toLowerCase()

    if (normalizedDepartment === 'information technology') {
      const itHead = usersInDepartment.find(
        (user) => normalize(user.designation) === 'head/dept. of it'
      )
      if (itHead) return { id: itHead.id, name: itHead.name }
    }

    if (normalizedDepartment === "dean's office") {
      const assistantRegistrar = usersInDepartment.find(
        (user) => normalize(user.designation) === 'assistant registrar'
      )
      if (assistantRegistrar) return { id: assistantRegistrar.id, name: assistantRegistrar.name }
    }

    const roleBasedHod = usersInDepartment.find(
      (user) => normalize(user.role) === 'head_of_department'
    )
    if (roleBasedHod) return { id: roleBasedHod.id, name: roleBasedHod.name }

    return null
  }, [formData.department, users])

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      Hod: selectedDepartmentHod?.name || '',
    }))
  }, [selectedDepartmentHod])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const requestTypeOptions = [
    {
      value: INVENTORY_REQUEST_TYPE.ADD_EXISTING,
      label: 'Add existing inventory to system',
      note: 'Add inventory that is already maintained by the faculty. This request is forwarded to the Head of Department for approval.',
    },
    {
      value: INVENTORY_REQUEST_TYPE.CREATE_NEW,
      label: 'Create new Inventory',
      note: 'Create a new inventory item that is not yet maintained by the faculty. This request is forwarded to the Head of Department for recommendation and then to Registrar for approval.',
    },
  ]

  const activeRequestTypeOption = requestTypeOptions.find((option) => option.value === activeRequestType)
  const requestTypeNote = activeRequestTypeOption?.note || ''
  const accountDepartment = String(formData.department || currentUser.department || '').trim()
  const assignedHod = selectedDepartmentHod

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
        inchargeId: isAdminView ? Number(formData.incharge) : accountInchargeId,
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
        setRequestError('Please select a department to submit the request.')
        setIsSubmittingRequest(false)
        return
      }

      if (isAdminView && !payload.inchargeId) {
        setRequestError('Please select an inventory officer for the selected department.')
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
            : 'New inventory creation request submitted for HOD recommendation and registrar approval.')
      )

      // Reset form after successful submission
      setTimeout(() => {
        navigate(successRedirectPath)
      }, 2000)
    } catch (error) {
      setRequestError(error.message || 'Failed to submit inventory creation request.')
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  const dashboardPath = isAdminView ? '/admin/dashboard' : '/staff/dashboard'
  const successRedirectPath = isAdminView ? dashboardPath : '/inventory/list/incharge'

  const handleCancel = () => {
    navigate(dashboardPath)
  }

  const requestTitle = 'Create New Inventory'

  const requestDescription =
    activeRequestType === INVENTORY_REQUEST_TYPE.ADD_EXISTING
      ? 'This request is forwarded to the Head of Department for approval.'
      : 'This request is forwarded to the Head of Department for recommendation and then to Registrar for approval.'

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title={requestTitle}
        subtitle="Submit an inventory creation request for your department"
      />

      <div className="p-6 space-y-6">
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
            {/* Row 1: Request Type and note */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <Select
                label="Request Type"
                name="requestType"
                options={requestTypeOptions.map(({ value, label }) => ({ value, label }))}
                value={activeRequestType}
                onChange={(value) => setActiveRequestType(value)}
                placeholder="Select request type"
                required
              />
              {requestTypeNote && (
                <div className="rounded bg-yellow-100 px-4 py-3 text-sm text-text-dark border border-red-200 text-justify"> 
                  {requestTypeNote}
                </div>
              )}
            </div>

            {/* Row 2: Name and Location */}
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
              {isAdminView ? (
                <Select
                  label="Department"
                  name="department"
                  options={departmentOptions}
                  value={formData.department}
                  onChange={(value) => {
                    setFormData((prev) => ({ ...prev, department: value, incharge: '' }))
                  }}
                  placeholder="Select department"
                  required
                />
              ) : (
                <FormInput
                  label="Department"
                  name="department"
                  value={formData.department}
                  placeholder="Department"
                  disabled
                  required
                />
              )}

              <FormInput
                label="Head of Department"
                name="Hod"
                value={formData.Hod}
                placeholder="Department HOD"
                disabled
              />
            </div>

            {/* Row 3: Inventory Officer */}
            <div className="grid grid-cols-1 gap-6">
              {isAdminView ? (
                <Select
                  label="Inventory Officer"
                  name="incharge"
                  options={inventoryOfficerOptions}
                  value={formData.incharge}
                  onChange={(value) => setFormData((prev) => ({ ...prev, incharge: value }))}
                  placeholder="Select inventory officer"
                  required
                />
              ) : (
                <FormInput
                  label="Inventory Officer"
                  name="incharge"
                  value={accountHolderName}
                  placeholder="Inventory officer"
                  disabled
                  required
                />
              )}
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
