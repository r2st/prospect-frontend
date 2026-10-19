import { useState, useMemo } from 'react';
import { Search, FileText } from 'lucide-react';
import EmptyState from '../EmptyState';
import TemplateEditor from './TemplateEditor';
import TemplateCard from './TemplateCard';
import PreviewModal from './PreviewModal';
import { Plus } from 'lucide-react';
import { useEmailTemplates, usePreviewTemplate } from '../../hooks/useEmailTemplates';
import { cn } from '../../lib/utils';

function getTemplateCategory(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('follow')) return 'Follow-up';
  if (lower.includes('intro')) return 'Introduction';
  if (lower.includes('demo')) return 'Product Demo';
  return 'General';
}

export default function TemplatesTab() {
  const { data: templates, isLoading } = useEmailTemplates();
  const [editing, setEditing] = useState(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const preview = usePreviewTemplate();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const handlePreview = (template) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
    preview.mutate({ template_id: template.id });
  };

  const handleDuplicate = (template) => {
    setEditing({
      name: `${template.name} (Copy)`,
      subject: template.subject,
      body: template.body,
      _duplicate: true,
    });
  };

  const filteredTemplates = useMemo(() => {
    let result = templates || [];
    if (categoryFilter) {
      result = result.filter((t) => getTemplateCategory(t.name) === categoryFilter);
    }
    const q = templateSearch.trim().toLowerCase();
    if (q) {
      result = result.filter((t) =>
        [t.name, t.subject].filter(Boolean).some((v) => v.toLowerCase().includes(q))
      );
    }
    return result;
  }, [templates, templateSearch, categoryFilter]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!editing && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder="Search templates by name or subject..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
        </div>
      )}

      {!editing && templates?.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Filter:</span>
          {['All', 'Introduction', 'Follow-up', 'Product Demo', 'General'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat === 'All' ? '' : cat)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                (cat === 'All' && !categoryFilter) || categoryFilter === cat
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {!editing && templates?.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg bg-gray-50 px-4 py-2.5 text-xs text-gray-500">
          <span className="font-medium text-gray-700">{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
          <span>{templates.filter(t => t.is_default).length > 0 ? '1 default set' : 'No default set'}</span>
          <span>{filteredTemplates.length} shown</span>
        </div>
      )}

      {editing && (
        <TemplateEditor
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {!editing && (filteredTemplates.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredTemplates.map((t) => (
            <div key={t.id} title={`Subject: ${t.subject || 'No subject'}\n\nClick Preview for full view`}>
              <TemplateCard template={t} onEdit={setEditing} onPreview={handlePreview} onDuplicate={handleDuplicate} />
            </div>
          ))}
        </div>
      ) : templates?.length ? (
        <EmptyState
          title="No matching templates"
          description="Try a different search term."
          icon={Search}
        />
      ) : (
        <EmptyState
          title="No templates yet"
          description="Create your first email template to start composing outreach."
          icon={FileText}
          action={{ label: 'New Template', onClick: () => setEditing('new') }}
        />
      ))}

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        loading={preview.isPending}
        subject={preview.data?.subject}
        body={preview.data?.body}
        templateId={previewTemplate?.id}
        templateName={previewTemplate?.name}
        contextLabel="sample contact"
      />
    </div>
  );
}
