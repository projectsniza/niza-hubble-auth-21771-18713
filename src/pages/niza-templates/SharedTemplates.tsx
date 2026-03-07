import SharedTemplatesPanel from '@/components/templates/SharedTemplatesPanel';

export default function SharedTemplates() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Shared Templates
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage templates shared with store accounts
        </p>
      </div>
      <SharedTemplatesPanel />
    </div>
  );
}
