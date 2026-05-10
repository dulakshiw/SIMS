import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AdminLayout from '../../Components/Layouts/AdminLayout'
import { Card, Button, FormInput, Select, PageHeader } from '../../Components/UI'
import { ROLE_HIERARCHY, ACCOUNT_REQUEST_STATUS } from '../../utils/constants'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

const CreateUser = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [otherDesignation, setOtherDesignation] = useState('')
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobileNo: '',
    officeExtNo: '',
    department: '',
    designation: '',
    password: '',
    confirmPassword: '',
  })
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [designations, setDesignations] = useState([])
  const [submitError, setSubmitError] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const [usersResponse, departmentsResponse, designationsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/users`),
          fetch(`${API_BASE_URL}/api/departments`),
          fetch(`${API_BASE_URL}/api/designations`),
        ])

        const [usersData, departmentsData, designationsData] = await Promise.all([
          usersResponse.json(),
          departmentsResponse.json(),
          designationsResponse.json(),
        ])

        if (!isMounted) return

        if (usersResponse.ok && usersData.success) {
          setUsers(usersData.users || [])
        }

        if (departmentsResponse.ok) {
          setDepartments(departmentsData.departments ?? departmentsData ?? [])
        }

        if (designationsResponse.ok) {
          setDesignations(designationsData.designations ?? designationsData ?? [])
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

    // Calculate password strength
    if (name === 'password') {
      let strength = 0
      if (value.length >= 8) strength++
      if (/[A-Z]/.test(value)) strength++
      if (/[0-9]/.test(value)) strength++
      if (/[^A-Za-z0-9]/.test(value)) strength++
      setPasswordStrength(strength)
    }
  }

  const handleSelectChange = (name) => (value) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 1) return 'bg-danger'
    if (passwordStrength <= 2) return 'bg-warning'
    return 'bg-success'
  }

  const departmentOptions = useMemo(
    () => departments
      .map((dept) => ({
        value: dept.id ?? dept.name ?? dept.code ?? '',
        label: dept.name || dept.code || String(dept.id || ''),
      }))
      .filter((option) => option.value),
    [departments]
  )

  const designationOptions = React.useMemo(() => {
    const baseOptions = [
      { value: 'Lecturer', label: 'Lecturer' },
      { value: 'Senior Lecturer', label: 'Senior Lecturer' },
      { value: 'Assistant Professor', label: 'Assistant Professor' },
      { value: 'Associate Professor', label: 'Associate Professor' },
      { value: 'Professor', label: 'Professor' },
      { value: 'Technical Officer', label: 'Technical Officer' },
      { value: 'Management Assistant', label: 'Management Assistant' },
      { value: 'Lab Assistant', label: 'Lab Assistant' },
    ]

    const combined = new Map()
    baseOptions.forEach((option) => combined.set(option.value, option))

    designations.forEach((designation) => {
      const name = String(designation.name || designation).trim()
      if (name && name.toLowerCase() !== 'other') {
        combined.set(name, { value: name, label: name })
      }
    })

    combined.set('Other', { value: 'Other', label: 'Other' })
    return [...combined.values()]
  }, [designations])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setSubmitError('')
    setSubmitMessage('')

    try {
      setIsSubmitting(true)

      // Validate passwords
      if (formData.password !== formData.confirmPassword) {
        setSubmitError('Passwords do not match!')
        setIsSubmitting(false)
        return
      }

      if (passwordStrength < 2) {
        setSubmitError('Password is too weak. Please use a stronger password.')
        setIsSubmitting(false)
        return
      }

      // If "Other" is selected, use the custom designation
      const finalDesignation = formData.designation === 'Other' ? otherDesignation : formData.designation

      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.name,
          email: formData.email,
          mobileNo: formData.mobileNo,
          officeExtNo: formData.officeExtNo,
          password: formData.password,
          role: 'staff',
          createdByRole: 'admin',
          department: formData.department,
          designation: finalDesignation,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to submit account request.')
      }

      setSubmitMessage(
        data.message ||
          (data.user ? 'User account created successfully.' : 'Account request submitted successfully.')
      )

      // Reset form after successful submission
      setTimeout(() => {
        navigate('/admin/users')
      }, 2000)
    } catch (error) {
      setSubmitError(error.message || 'Failed to submit account request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/admin/users')
  }

  return (
    <AdminLayout>
      <PageHeader
        title="Create User"
        subtitle="Create a new user account or submit an account request"
      />

      <div className="p-6 space-y-6">
        {/* Info Card */}
        <Card>
          <div className="rounded bg-blue-50 px-4 py-3 text-sm text-blue-800 border border-blue-200">
            This will create an account request that requires approval from department head and admin.
          </div>
        </Card>

        {/* Error Messages */}
        {submitError && (
          <div className="rounded bg-red-50 px-4 py-3 text-sm text-red-800 border border-red-200">
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
        <Card title="User Account Details" icon="person_add">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Name and Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter full name"
                required
              />

              <FormInput
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter email address"
                required
              />
            </div>

            {/* Row 2: Mobile and Office Extension */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput
                label="Mobile Number"
                name="mobileNo"
                value={formData.mobileNo}
                onChange={handleInputChange}
                placeholder="Enter mobile number"
              />

              <FormInput
                label="Office Extension"
                name="officeExtNo"
                value={formData.officeExtNo}
                onChange={handleInputChange}
                placeholder="Enter office extension"
              />
            </div>

            {/* Row 3: Department and Designation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Select
                label="Department"
                name="department"
                options={departmentOptions}
                value={formData.department}
                onChange={handleSelectChange('department')}
                placeholder="Select department"
                required
              />

              <Select
                label="Designation"
                name="designation"
                options={designationOptions}
                value={formData.designation}
                onChange={handleSelectChange('designation')}
                placeholder="Select designation"
                required
              />
            </div>

            {formData.designation === 'Other' && (
              <div className="grid grid-cols-1 gap-6">
                <FormInput
                  label="Other Designation"
                  name="otherDesignation"
                  value={otherDesignation}
                  onChange={(e) => setOtherDesignation(e.target.value)}
                  placeholder="Enter designation"
                  required
                />
              </div>
            )}

            {/* Row 5: Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormInput
                  label="Password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter password"
                  required
                />
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getPasswordStrengthColor()}`}
                          style={{ width: `${(passwordStrength / 4) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600">
                        {passwordStrength <= 1 ? 'Weak' : passwordStrength <= 2 ? 'Fair' : 'Strong'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <FormInput
                label="Confirm Password"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm password"
                required
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-border-lighter">
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Submit Request'}
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

export default CreateUser
