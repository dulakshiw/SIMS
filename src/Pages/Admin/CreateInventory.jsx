import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AdminLayout from '../../Components/Layouts/AdminLayout'
import { Card, Button, FormInput, PageHeader, Select } from '../../Components/UI'
import { INVENTORY_REQUEST_TYPE } from '../../utils/constants'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

const CreateInventory = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    department: '',
    incharge: '',
    Hod: '',
    description: '',
  })
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [submitError, setSubmitError] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeRequestType, setActiveRequestType] = useState(INVENTORY_REQUEST_TYPE.ADD_EXISTING)

  const requestTypeOptions = [
    {
      value: INVENTORY_REQUEST_TYPE.ADD_EXISTING,
      label: 'Add existing inventory to system',
      note: 'Add inventory that is already maintained by the faculty.',
    },
    {
      value: INVENTORY_REQUEST_TYPE.CREATE_NEW,
      label: 'Create new Inventory',
      note: 'Create a new inventory item that is not yet maintained by the faculty.',
    },
  ]

  const activeRequestTypeOption = requestTypeOptions.find((option) => option.value === activeRequestType)
  const requestTypeNote = activeRequestTypeOption?.note || ''


  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const [departmentsResponse, usersResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/departments`),
          fetch(`${API_BASE_URL}/api/users`),
        ])

        const [departmentsData, usersData] = await Promise.all([
          departmentsResponse.json(),
          usersResponse.json(),
        ])

        if (!isMounted) return

        if (departmentsResponse.ok && departmentsData.success) {
          setDepartments(departmentsData.departments || [])
        }

        if (usersResponse.ok && usersData.success) {
          setUsers(usersData.users || [])
        }
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

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
    setFormData(prev => ({
      ...prev,
      Hod: selectedDepartmentHod?.name || '',
    }))
  }, [selectedDepartmentHod])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const departmentOptions = useMemo(
    () => departments.map((dept) => ({ value: dept.name, label: dept.name })),
    [departments]
  )

  const selectedDepartment = useMemo(
    () => departments.find((dept) => dept.name === formData.department) || null,
    [departments, formData.department]
  )

  const inchargeOptions = useMemo(
    () => users
      .filter((user) => {
        if (!formData.department) return false

        const userDepartmentName = String(user.department || '').trim().toLowerCase()
        const selectedDepartmentName = String(formData.department || '').trim().toLowerCase()
        const isSameDepartmentByName = userDepartmentName && userDepartmentName === selectedDepartmentName

        const isSameDepartmentById =
          selectedDepartment?.id != null &&
          user.departmentId != null &&
          String(user.departmentId) === String(selectedDepartment.id)

        const designation = String(user.designation || '').trim().toLowerCase()
        const isAllowedDesignation =
          designation === 'technical officer' || designation === 'management assistant'

        return (isSameDepartmentByName || isSameDepartmentById) && isAllowedDesignation
      })
      .map((user) => ({ value: String(user.id), label: user.name })),
    [users, formData.department, selectedDepartment]
  )

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setSubmitError('')
    setSubmitMessage('')

    try {
      setIsSubmitting(true)

      // Basic validation
      if (!formData.name.trim()) {
        setSubmitError('Inventory name is required.')
        setIsSubmitting(false)
        return
      }

      if (!formData.location.trim()) {
        setSubmitError('Inventory location is required.')
        setIsSubmitting(false)
        return
      }

      if (!formData.department) {
        setSubmitError('Department is required.')
        setIsSubmitting(false)
        return
      }

      if (!formData.incharge) {
        setSubmitError('In-charge person is required.')
        setIsSubmitting(false)
        return
      }

      const approvalStatus = activeRequestType === INVENTORY_REQUEST_TYPE.ADD_EXISTING ? 'approved_by_hod' : 'approved_by_registrar'

      const payload = {
        requestedById: currentUser.id,
        requestType: activeRequestType,
        name: formData.name.trim(),
        location: formData.location.trim(),
        department: formData.department,
        inchargeId: formData.incharge,
        hodUserId: selectedDepartmentHod?.id || null,
        description: formData.description.trim(),
        approval_status: approvalStatus,
      }

      const response = await fetch(`${API_BASE_URL}/api/inventory-creation-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to submit inventory creation request.')
      }

      setSubmitMessage(data.message || 'Inventory creation request submitted successfully.')

      // Reset form after successful submission
      setTimeout(() => {
        navigate('/admin/inventory')
      }, 2000)
    } catch (error) {
      setSubmitError(error.message || 'Failed to submit inventory creation request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/admin/inventory')
  }

  return (
    <AdminLayout>
      <PageHeader
        title="Create New Inventory"
        subtitle="Create a new inventory in the system"
      />

      <div className="p-6 space-y-6">
        {/* Error Messages */}
        {submitError && (
          <div className="rounded bg-red-50 px-4 py-3 text-sm text-red-800 border border-red-200 font-bold text-center">
            {submitError}
          </div>
        )}

        {/* Success Message */}
        {submitMessage && (
          <div className="rounded bg-green-50 px-4 py-3 text-sm text-green-800 border border-green-200 font-bold text-center">
            {submitMessage}
          </div>
        )}

        {/* Form Card */}
        <Card title="Inventory Details" icon="inventory_2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Inventory Type and note */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <Select
                label="Inventory Type"
                name="requestType"
                options={requestTypeOptions.map(({ value, label }) => ({ value, label }))}
                value={activeRequestType}
                onChange={(value) => setActiveRequestType(value)}
                placeholder="Select inventory type"
                required
              />
              {requestTypeNote && (
               <div className="rounded bg-yellow-100 px-4 py-3 text-sm text-text-dark border border-red-200 text-justify"> 
                  {requestTypeNote}
                </div>
              )}
            </div>

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
                label="Location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Enter inventory location"
                required
              />
            </div>

            {/* Row 2: Department and Incharge */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-dark mb-2">
                  Department
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-border-lighter rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">Select department</option>
                  {departmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-dark mb-2">
                  Inventory Officer
                </label>
                <select
                  name="incharge"
                  value={formData.incharge}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-border-lighter rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">Select inventory officer</option>
                  {inchargeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Department Head */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput
                label="Department Head"
                name="Hod"
                value={formData.Hod}
                readOnly
                placeholder="Auto-selected based on department"
              />
            </div>

            {/* Row 4: Description */}
            <div className="grid grid-cols-1 gap-6">
              <FormInput
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter inventory description (optional)"
                as="textarea"
                rows={4}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-border-lighter">
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
              <Button type="button" variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default CreateInventory
