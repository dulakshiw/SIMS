import React, { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, FormInput, Select, Tabs } from "../../../Components/UI";
import { DISPOSAL_REASONS, CONDITION_ASSESSMENT } from "../../../utils/constants";
import { resolveSidebarVariant } from "../../../utils/helpers";

const CreateDisposal = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [formData, setFormData] = useState({
    itemName: "",
    category: "",
    reason: "",
    condition: "",
    value: "",
    salvageValue: "",
    description: "",
  });

  const [attachments, setAttachments] = useState([]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setAttachments([...e.target.files]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted", formData, attachments);
  };

  const tabs = [
    {
      label: "Details",
      icon: "description",
      content: (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Item Name"
              name="itemName"
              placeholder="Enter item name"
              value={formData.itemName}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="Item Category"
              name="category"
              placeholder="e.g., Electronics"
              value={formData.category}
              onChange={handleInputChange}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Reason for Disposal"
              name="reason"
              options={DISPOSAL_REASONS}
              value={formData.reason}
              onChange={(value) => setFormData((prev) => ({ ...prev, reason: value }))}
              required
            />
            <Select
              label="Condition Assessment"
              name="condition"
              options={CONDITION_ASSESSMENT}
              value={formData.condition}
              onChange={(value) => setFormData((prev) => ({ ...prev, condition: value }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Original Item Value"
              name="value"
              type="number"
              placeholder="0.00"
              value={formData.value}
              onChange={handleInputChange}
            />
            <FormInput
              label="Salvage Value"
              name="salvageValue"
              type="number"
              placeholder="0.00"
              value={formData.salvageValue}
              onChange={handleInputChange}
            />
          </div>

          <FormInput
            label="Description"
            name="description"
            type="textarea"
            placeholder="Additional details about the disposal..."
            value={formData.description}
            onChange={handleInputChange}
          />

          <div className="flex gap-4">
            <Button type="submit" variant="primary">
              Save Disposal
            </Button>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </div>
        </form>
      ),
    },
    {
      label: "Attachments",
      icon: "attach_file",
      content: (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-border-light rounded-lg p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-text-light block mb-2">
              cloud_upload
            </span>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="fileInput"
            />
            <label htmlFor="fileInput" className="cursor-pointer">
              <p className="text-base font-medium text-text-dark">Drop files here or click</p>
              <p className="text-sm text-text-light">Supported formats: PDF, JPG, PNG (Max 5MB)</p>
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-text-dark">Attached Files:</h3>
              {Array.from(attachments).map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-background-light rounded-md">
                  <span className="text-sm text-text-dark">{file.name}</span>
                  <Button variant="ghost" size="sm" icon="close" />
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout variant={sidebarVariant}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-dark">Create Disposal Request</h1>
          <p className="text-text-light mt-2">Submit a new item for disposal</p>
        </div>

        {/* Form Card */}
        <Card>
          <Tabs tabs={tabs} />
        </Card>
      </div>
    </MainLayout>
  );
};

export default CreateDisposal;
