import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AdminLayout from '../../Components/Layouts/AdminLayout'
import { Card, Button, FormInput, PageHeader } from '../../Components/UI'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

const normalizeStatus = (status) => String(status || '').toLowerCase()

const isHodAlreadyAssigned = (user, departments = []) => {
  const userId = Number(user?.id)
  if (!Number.isInteger(userId) || userId <= 0) return false

  if (departments.some((department) => Number(department.headId) === userId)) {
    return true
  }

  const userDepartment = String(user.department || '').trim().toLowerCase()
  if (!userDepartment || userDepartment === '-') {
    return false
  }

  return departments.some(
    (department) => String(department.name || '').trim().toLowerCase() === userDepartment
  )
}

const CreateDepartment = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    head: '',
    description: '',
  })
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [submitError, setSubmitError] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadOptions = async () => {
      try {
        setOptionsLoading(true)
        const [usersResponse, departmentsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users`),
          fetch(`${API_BASE_URL}/api/departments?includeInactive=true`),
        ])

        const [usersData, departmentsData] = await Promise.all([
          usersResponse.json().catch(() => ({})),
          departmentsResponse.json().catch(() => ({})),
        ])

        if (!isMounted) return

        if (usersResponse.ok && usersData.success) {
          setUsers(usersData.users || [])
        }

        if (departmentsResponse.ok && departmentsData.success) {
          setDepartments(departmentsData.departments || [])
        }
      } catch (error) {
        console.error('Failed to load department head options:', error)
      } finally {
        if (isMounted) {
          setOptionsLoading(false)
        }
      }
    }

    loadOptions()

    return () => {
      isMounted = false
    }
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const departmentHeadOptions = useMemo(
    () =>
      users
        .filter(
          (user) =>
            user.role === 'head_of_department' && normalizeStatus(user.status) === 'active'
        )
        .filter((user) => !isHodAlreadyAssigned(user, departments))
        .map((user) => ({
          value: user.name,
          label: user.name,
        })),
    [users, departments]
  )

  useEffect(() => {
    if (!formData.head) return
    const stillAvailable = departmentHeadOptions.some((option) => option.value === formData.head)
    if (!stillAvailable) {
      setFormData((prev) => ({ ...prev, head: '' }))
    }
  }, [departmentHeadOptions, formData.head])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setSubmitError('')
    setSubmitMessage('')

    try {
      setIsSubmitting(true)

      // Basic validation
      if (!formData.name.trim()) {
        setSubmitError('Department name is required.')
        setIsSubmitting(false)
        return
      }

      if (!formData.code.trim()) {
        setSubmitError('Department code is required.')
        setIsSubmitting(false)
        return
      }

      const response = await fetch(`${API_BASE_URL}/api/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim(),
          head: formData.head,
          description: formData.description.trim(),
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to create department.')
      }

      setSubmitMessage(data.message || 'Department created successfully.')

      // Reset form after successful submission
      setTimeout(() => {
        navigate('/admin/departments')
      }, 2000)
    } catch (error) {
      setSubmitError(error.message || 'Failed to create department.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/admin/departments')
  }

  return (
    <AdminLayout>
      <PageHeader
        title="Create Department"
        subtitle="Create a new department in the system"
      />

      <div className="p-6 space-y-6">
        {/* Info Card */}
        <Card>
          <div className="rounded bg-blue-50 px-4 py-3 text-sm text-blue-800 border border-blue-200">
            Create a new department that can be assigned to users and inventories.
          </div>
        </Card>

        {/* Error Messages */}
        {submitError && (
          <div className="rounded bg-red-50 px-4 py-3 text-sm text-red-800 border border-red-200 text-center font-bold">
            {submitError}
          </div>
        )}

        {/* Success Message */}
        {submitMessage && (
          <div className="rounded bg-green-50 px-4 py-3 text-sm text-green-800 border border-green-200">
            {submitMessage}
          </div>
        )}

        {/* Form Card */}
        <Card title="Department Details" icon="business">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Name and Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput
                label="Department Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter department name"
                required
              />

              <FormInput
                label="Department Code"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                placeholder="Enter department code (e.g., IT, CS)"
                required
              />
            </div>

            {/* Row 2: Department Head */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-dark mb-2">
                  Department Head
                </label>
                <select
                  name="head"
                  value={formData.head}
                  onChange={handleInputChange}
                  disabled={optionsLoading}
                  className="w-full px-3 py-2 border border-border-lighter rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">
                    {optionsLoading ? 'Loading department heads...' : 'Select department head'}
                  </option>
                  {departmentHeadOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {!optionsLoading && departmentHeadOptions.length === 0 ? (
                  <p className="mt-1 text-xs text-warning">
                    No available department heads. Create a staff account with the HOD role first, or free an existing HOD assignment.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Row 3: Description */}
            <div className="grid grid-cols-1 gap-6">
              <FormInput
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter department description (optional)"
                as="textarea"
                rows={4}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-border-lighter">
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Department'}
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

export default CreateDepartment
