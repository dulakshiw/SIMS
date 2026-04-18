import React, { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, FormInput, Select, PageHeader } from "../../../Components/UI";
import { REQUEST_PRIORITY } from "../../../utils/constants";
import { resolveSidebarVariant } from "../../../utils/helpers";

const CreateRequest = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [formData, setFormData] = useState({
    itemName: "",
    quantity: "",
    priority: "normal",
    specification: "",
    justification: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Request submitted:", formData);
  };

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Create Item Request"
        subtitle="Submit a new item request"
      />

      <div className="p-6 space-y-6">

        {/* Form Card */}
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Item Name/Description"
                name="itemName"
                placeholder="e.g., Office Chairs"
                value={formData.itemName}
                onChange={handleInputChange}
                required
              />
              <FormInput
                label="Quantity"
                name="quantity"
                type="number"
                placeholder="0"
                value={formData.quantity}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Priority"
                name="priority"
                options={REQUEST_PRIORITY}
                value={formData.priority}
                onChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}
              />
              <FormInput
                label="Expected Return Date"
                name="returnDate"
                type="date"
              />
            </div>

            <FormInput
              label="Specifications/Requirements"
              name="specification"
              type="textarea"
              placeholder="Add any specific requirements or specs..."
              value={formData.specification}
              onChange={handleInputChange}
            />

            <FormInput
              label="Justification"
              name="justification"
              type="textarea"
              placeholder="Explain why this item is needed..."
              value={formData.justification}
              onChange={handleInputChange}
              required
            />

            <div className="flex gap-4">
              <Button type="submit" variant="primary">
                Submit Request
              </Button>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </MainLayout>
  );
};

export default CreateRequest;
