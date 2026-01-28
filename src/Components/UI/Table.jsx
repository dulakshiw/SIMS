import React, { useState } from "react";
import Badge from "./Badge";
import Button from "./Button";

const Table = ({
  columns,
  data,
  actions,
  searchable = true,
  sortable = true,
  paginated = true,
  itemsPerPage = 10,
  onRowClick,
  loading = false,
  className = "",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data
  let filteredData = data;
  if (searchable && searchTerm) {
    filteredData = data.filter((row) =>
      columns.some((col) =>
        String(row[col.field])
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      )
    );
  }

  // Sort data
  if (sortable && sortField) {
    filteredData = [...filteredData].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }

  // Paginate data
  let displayedData = filteredData;
  let totalPages = 1;
  if (paginated) {
    totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    displayedData = filteredData.slice(startIndex, startIndex + itemsPerPage);
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {searchable && (
        <div className="mb-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-light material-symbols-outlined">
              search
            </span>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-12 pr-4 py-2.5 border border-border-light rounded-md focus:ring-2 focus:ring-primary-800 focus:outline-none"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <span className="animate-spin material-symbols-outlined text-primary-800">
            refresh
          </span>
        </div>
      ) : displayedData.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-4xl text-border-light mb-4 block">
            folder_open
          </span>
          <p className="text-text-light">No data available</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-background-light border-b border-border-light">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.field}
                      className={`px-6 py-4 text-left text-sm font-semibold text-text-dark ${
                        sortable && col.sortable !== false ? "cursor-pointer hover:bg-border-lighter" : ""
                      }`}
                      onClick={() => sortable && col.sortable !== false && handleSort(col.field)}
                    >
                      <div className="flex items-center gap-2">
                        {col.label}
                        {sortable && col.sortable !== false && sortField === col.field && (
                          <span className="material-symbols-outlined text-sm">
                            {sortOrder === "asc" ? "arrow_upward" : "arrow_downward"}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  {actions && <th className="px-6 py-4 text-left text-sm font-semibold text-text-dark">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayedData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-b border-border-lighter hover:bg-background-light cursor-pointer transition-colors"
                    onClick={() => onRowClick && onRowClick(row)}
                  >
                    {columns.map((col) => (
                      <td key={col.field} className="px-6 py-4 text-sm text-text-dark">
                        {col.render ? col.render(row[col.field], row) : row[col.field]}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          {actions.map((action, actionIndex) => (
                            <Button
                              key={actionIndex}
                              variant="ghost"
                              size="sm"
                              icon={action.icon}
                              onClick={() => action.onClick && action.onClick(row)}
                              title={action.label}
                            />
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paginated && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-text-light">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  icon="chevron_left"
                />
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-md text-sm font-medium transition-smooth ${
                        currentPage === page
                          ? "bg-primary-800 text-white"
                          : "bg-background-light text-text-dark hover:bg-border-lighter"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  icon="chevron_right"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Table;
