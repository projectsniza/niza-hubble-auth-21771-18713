import MessagingPanel from '@/components/messaging/MessagingPanel';

export default function Messages() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Messages</h1>
        <p className="text-muted-foreground mt-1">
          Chat with your colleagues in real-time
        </p>
      </div>
      <MessagingPanel />
    </div>
  );
}
