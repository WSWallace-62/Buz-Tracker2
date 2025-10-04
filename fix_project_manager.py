#!/usr/bin/env python3
import re

# Read the file
with open('src/components/ProjectManagerModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace customerId with customerFirestoreId in formData state
content = re.sub(
    r"const \[formData, setFormData\] = useState\({ name: '', color: COLORS\[0\], customerId: undefined as number \| undefined }\)",
    "const [formData, setFormData] = useState({ name: '', color: COLORS[0], customerFirestoreId: undefined as string | undefined })",
    content
)

# Replace customerId with customerFirestoreId in setFormData calls
content = re.sub(
    r"setFormData\({ name: '', color: COLORS\[0\], customerId: undefined }\)",
    "setFormData({ name: '', color: COLORS[0], customerFirestoreId: undefined })",
    content
)

# Replace in handleEdit
content = re.sub(
    r"setFormData\({ name: project\.name, color: project\.color, customerId: project\.customerId }\)",
    "setFormData({ name: project.name, color: project.color, customerFirestoreId: project.customerFirestoreId })",
    content
)

# Replace the handleSubmit function
old_submit = r"""    try {
      if \(editingProject\) {
        await updateProject\(editingProject\.id!, {
          name: formData\.name\.trim\(\),
          color: formData\.color,
          customerId: formData\.customerId
        }\)
        showToast\('Project updated', 'success'\)
      } else {
        await createProject\({
          name: formData\.name\.trim\(\),
          color: formData\.color,
          customerId: formData\.customerId,
          archived: false
        }\)
        showToast\('Project created', 'success'\)
      }

      setEditingProject\(null\)
      setIsCreating\(false\)
      setFormData\({ name: '', color: COLORS\[0\], customerId: undefined }\)
    } catch \(error\) {
      showToast\('Failed to save project', 'error'\)
    }"""

new_submit = """    try {
      // Find the customer's local ID for backward compatibility
      const customer = formData.customerFirestoreId 
        ? customers.find(c => c.firestoreId === formData.customerFirestoreId)
        : undefined;

      if (editingProject) {
        await updateProject(editingProject.id!, {
          name: formData.name.trim(),
          color: formData.color,
          customerId: customer?.id,
          customerFirestoreId: formData.customerFirestoreId
        })
        showToast('Project updated', 'success')
      } else {
        await createProject({
          name: formData.name.trim(),
          color: formData.color,
          customerId: customer?.id,
          customerFirestoreId: formData.customerFirestoreId,
          archived: false
        })
        showToast('Project created', 'success')
      }

      setEditingProject(null)
      setIsCreating(false)
      setFormData({ name: '', color: COLORS[0], customerFirestoreId: undefined })
    } catch (error) {
      showToast('Failed to save project', 'error')
    }"""

content = re.sub(old_submit, new_submit, content, flags=re.DOTALL)

# Replace the customer select dropdown
old_select = r"""                <select
                  value={formData\.customerId \|\| ''}
                  onChange={\(e\) => setFormData\({ \.\.\.formData, customerId: e\.target\.value \? Number\(e\.target\.value\) : undefined }\)}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No customer</option>
                  {customers\.filter\(c => !c\.archived\)\.map\(\(customer\) => \(
                    <option key={customer\.id} value={customer\.id}>
                      {customer\.companyName}
                    </option>
                  \)\)}
                </select>"""

new_select = """                <select
                  value={formData.customerFirestoreId || ''}
                  onChange={(e) => setFormData({ ...formData, customerFirestoreId: e.target.value || undefined })}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No customer</option>
                  {customers.filter(c => !c.archived).map((customer) => (
                    <option key={customer.id} value={customer.firestoreId}>
                      {customer.companyName}
                    </option>
                  ))}
                </select>"""

content = re.sub(old_select, new_select, content, flags=re.DOTALL)

# Replace the ProjectItem function
old_project_item = r"""function ProjectItem\({ project, onEdit, onDelete, onArchive }: ProjectItemProps\) {
  return \(
    <div className={`
      flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg
      \$\{project\.archived \? 'bg-gray-50 dark:bg-gray-700 opacity-75' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'\}
    `}>
      <div className="flex items-center">
        <div
          className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
          style=\{\{ backgroundColor: project\.color \}\}
        />
        <span className={`font-medium \$\{project\.archived \? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'\}`}>
          \{project\.name\}
        </span>
        \{project\.archived && \(
          <span className="ml-2 px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-full">
            Archived
          </span>
        \)\}
      </div>"""

new_project_item = """function ProjectItem({ project, onEdit, onDelete, onArchive }: ProjectItemProps) {
  const { customers } = useCustomersStore();
  const customer = project.customerFirestoreId 
    ? customers.find(c => c.firestoreId === project.customerFirestoreId)
    : undefined;

  return (
    <div className={`
      flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg
      ${project.archived ? 'bg-gray-50 dark:bg-gray-700 opacity-75' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'}
    `}>
      <div className="flex items-center">
        <div
          className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
          style={{ backgroundColor: project.color }}
        />
        <div className="flex flex-col">
          <span className={`font-medium ${project.archived ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
            {project.name}
          </span>
          {customer && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {customer.companyName}
            </span>
          )}
        </div>
        {project.archived && (
          <span className="ml-2 px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-full">
            Archived
          </span>
        )}
      </div>"""

content = re.sub(old_project_item, new_project_item, content, flags=re.DOTALL)

# Write the file
with open('src/components/ProjectManagerModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("File updated successfully!")
