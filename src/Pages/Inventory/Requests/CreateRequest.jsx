import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, FormInput, Select, PageHeader } from "../../../Components/UI";
import { REQUEST_PRIORITY } from "../../../utils/constants";
import { resolveSidebarVariant } from "../../../utils/helpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const CreateRequest = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [inventories, setInventories] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    itemName: "",
    quantity: "",
    priority: "normal",
    requestedInventoryId: "",
    specification: "",
    justification: "",
    requiredByDate: "",
  });

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInventories = async () => {
      try {
        setIsLoadingOptions(true);
        setLoadError("");

        const response = await fetch(`${API_BASE_URL}/api/inventories`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to load inventories.");
        }

        if (isMounted) {
          setInventories(data.inventories || data.data || []);
        }
      } catch (error) {
        if (isMounted) {
          setInventories([]);
          setLoadError(error.message || "Failed to load inventories.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingOptions(false);
        }
      }
    };

    loadInventories();

    return () => {
      isMounted = false;
    };
  }, []);

  const inventoryOptions = useMemo(() => {
    const withLocation = inventories
      .map((inventory) => {
        const id = String(inventory.id ?? inventory.inventoryId ?? "");
        const locationName = String(inventory.location ?? "").trim();
        const inventoryName = String(inventory.name ?? inventory.inventoryName ?? "").trim();

        if (!id || !locationName) {
          return null;
        }

        const label = inventoryName && inventoryName.toLowerCase() !== locationName.toLowerCase()
          ? `${locationName} (${inventoryName})`
          : locationName;

        return { value: id, label };
      })
      .filter(Boolean);

    return withLocation.sort((a, b) => a.label.localeCompare(b.label));
  }, [inventories]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitMessage("");

    const requestedById = Number(currentUser.id ?? 0);

    if (!Number.isInteger(requestedById) || requestedById <= 0) {
      setSubmitError("Your session is missing a user id. Please sign in again.");
      return;
    }

    if (!formData.requestedInventoryId) {
      setSubmitError("Please select an inventory location.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${API_BASE_URL}/api/item-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedById,
          requestedInventoryId: Number(formData.requestedInventoryId),
          itemName: formData.itemName.trim(),
          quantity: Number(formData.quantity),
          priority: formData.priority,
          specification: formData.specification.trim(),
          reason: formData.justification.trim(),
          requiredByDate: formData.requiredByDate || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to submit item request.");
      }

      setSubmitMessage(data.message || "Item request submitted and forwarded to your Head of Department.");

      setTimeout(() => {
        navigate(`/requests/my/${role || "staff"}`);
      }, 1200);
    } catch (error) {
      setSubmitError(error.message || "Failed to submit item request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Create Item Request"
        subtitle="Submit a new item request. It will be forwarded to your Head of Department for recommendation, then to the lab Head of Department."
      />

      <div className="p-6 space-y-6">
        {loadError ? <p className="text-sm text-error">{loadError}</p> : null}
        {submitError ? <p className="text-sm text-error">{submitError}</p> : null}
        {submitMessage ? <p className="text-sm text-success">{submitMessage}</p> : null}

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Select
              label="Requested Inventory"
              name="requestedInventoryId"
              options={inventoryOptions}
              value={formData.requestedInventoryId}
              onChange={(value) => setFormData((prev) => ({ ...prev, requestedInventoryId: value }))}
              placeholder={isLoadingOptions ? "Loading locations..." : "Select inventory by location"}
              required
              disabled={isLoadingOptions || inventoryOptions.length === 0}
            />

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
                min="1"
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
                label="Required By Date"
                name="requiredByDate"
                type="date"
                value={formData.requiredByDate}
                onChange={handleInputChange}
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
              <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
                Submit Request
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
              >
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
