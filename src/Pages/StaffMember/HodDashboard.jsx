import React, { useEffect, useState } from 'react'
import MainLayout from '../../Components/Layouts/MainLayout'
import { Card, Button, PageHeader } from '../../Components/UI'

const getTimeOfDayGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
};

const getLastName = (fullName = 'User') => {
  const nameParts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return nameParts[nameParts.length - 1] || 'User';
};

const HodDashboard = () => {
  const [lastName, setLastName] = useState('User')
  const [departmentName, setDepartmentName] = useState('Department')

  useEffect(() => {
    const storedUsername = localStorage.getItem('username') || 'User'
    setLastName(getLastName(storedUsername))

    try {
      const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      setDepartmentName(storedUser.departmentName || storedUser.department || 'Department')
    } catch {
      setDepartmentName('Department')
    }
  }, [])

  const greeting = `${getTimeOfDayGreeting()} ${lastName}`

  const stats = [
    { title: 'Department Inventories', value: '12', icon: 'inventory_2' },
    { title: 'Pending Staff Requests', value: '8', icon: 'rule' },
    { title: 'Pending Account Approvals', value: '3', icon: 'person_add' },
  ]

  return (
    <MainLayout variant="hod">
      <PageHeader
        title={`Head Department of ${departmentName} Dashboard`}
        subtitle="Department-level oversight of inventories and requests"
        actions={
          <div className="text-right text-base font-medium text-white sm:text-lg">
            {greeting}
          </div>
        }
      />

      <div className="p-6 space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} icon={stat.icon} hover={true}>
              <p className="text-sm text-text-light">{stat.title}</p>
              <p className="text-3xl font-bold text-primary-800 mt-2">{stat.value}</p>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="primary" icon="rule">Review Requests</Button>
          <Button variant="secondary" icon="person_add">Approve Staff Accounts</Button>
        </div>
      </div>
    </MainLayout>
  )
}

export default HodDashboard
