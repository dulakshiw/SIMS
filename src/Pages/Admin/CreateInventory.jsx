import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AdminLayout from '../../Components/Layouts/AdminLayout'
import { Card, Button, FormInput, PageHeader } from '../../Components/UI'

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

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const departmentOptions = useMemo(
    () => departments.map((dept) => ({ value: dept.name, label: dept.name })),
    [departments]
  )

  const inchargeOptions = useMemo(
    () => users
      .filter((user) => user.role === 'inventory_incharge' || user.designation === 'Technical Officer' || user.designation === 'Management Assistant')
      .map((user) => ({ value: user.name, label: user.name })),
    [users]
  )

  const hodOptions = useMemo(
    () => users
      .filter((user) => user.role === 'head_of_department' || user.role === 'dean')
      .map((user) => ({ value: user.name, label: user.name })),
    [users]
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

      const response = await fetch(`${API_BASE_URL}/api/inventories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          location: formData.location.trim(),
          department: formData.department,
          incharge: formData.incharge,
          hod: formData.Hod,
          description: formData.description.trim(),
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to create inventory.')
      }

      setSubmitMessage(data.message || 'Inventory created successfully.')

      // Reset form after successful submission
      setTimeout(() => {
        navigate('/admin/inventory')
      }, 2000)
    } catch (error) {
      setSubmitError(error.message || 'Failed to create inventory.')
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
        title="Create Inventory"
        subtitle="Create a new inventory in the system"
      />

      <div className="p-6 space-y-6">
        {/* Info Card */}
        <Card>
          <div className="rounded bg-blue-50 px-4 py-3 text-sm text-red-800 border border-blue-500 font-bold text-center">
            Create a new inventory that can be managed by inventory officers and used to organize items.
          </div>
        </Card>

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
              <div>
                <label className="block text-sm font-medium text-text-dark mb-2">
                  Department Head
                </label>
                <select
                  name="Hod"
                  value={formData.Hod}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-border-lighter rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select department head</option>
                  {hodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
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
                {isSubmitting ? 'Creating...' : 'Create Inventory'}
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
