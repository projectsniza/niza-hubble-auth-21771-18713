import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Type, List, Image, Video, FileText, Info, Quote, AlertCircle, Highlighter } from 'lucide-react';
import ImageUploadBlock from '@/components/elearning/ImageUploadBlock';

export interface ContentBlock {
  id: string;
  type: 'heading' | 'subheading' | 'paragraph' | 'bullet_points' | 'image' | 'video' | 'attachment' | 'note' | 'highlight' | 'quote' | 'infobox';
  content: string;
  items?: string[];
  url?: string;
}

const BLOCK_TYPES = [
  { value: 'heading', label: 'Heading', icon: Type },
  { value: 'subheading', label: 'Subheading', icon: Type },
  { value: 'paragraph', label: 'Paragraph', icon: FileText },
  { value: 'bullet_points', label: 'Bullet Points', icon: List },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'video', label: 'Video URL', icon: Video },
  { value: 'note', label: 'Note', icon: AlertCircle },
  { value: 'highlight', label: 'Highlight Box', icon: Highlighter },
  { value: 'quote', label: 'Quote', icon: Quote },
  { value: 'infobox', label: 'Info Box', icon: Info },
];

interface Props {
  content: ContentBlock[];
  onChange: (content: ContentBlock[]) => void;
}

export default function LessonContentEditor({ content, onChange }: Props) {
  const [addType, setAddType] = useState('paragraph');

  const addBlock = () => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: addType as ContentBlock['type'],
      content: '',
      items: addType === 'bullet_points' ? [''] : undefined,
    };
    onChange([...content, newBlock]);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    onChange(content.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id: string) => {
    onChange(content.filter(b => b.id !== id));
  };

  const addBulletItem = (blockId: string) => {
    const block = content.find(b => b.id === blockId);
    if (block && block.items) {
      updateBlock(blockId, { items: [...block.items, ''] });
    }
  };

  const updateBulletItem = (blockId: string, index: number, value: string) => {
    const block = content.find(b => b.id === blockId);
    if (block && block.items) {
      const newItems = [...block.items];
      newItems[index] = value;
      updateBlock(blockId, { items: newItems });
    }
  };

  const removeBulletItem = (blockId: string, index: number) => {
    const block = content.find(b => b.id === blockId);
    if (block && block.items && block.items.length > 1) {
      const newItems = block.items.filter((_, i) => i !== index);
      updateBlock(blockId, { items: newItems });
    }
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newContent = [...content];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newContent.length) return;
    [newContent[index], newContent[targetIndex]] = [newContent[targetIndex], newContent[index]];
    onChange(newContent);
  };

  const renderBlockEditor = (block: ContentBlock, index: number) => {
    const blockType = BLOCK_TYPES.find(t => t.value === block.type);
    const Icon = blockType?.icon || Type;

    return (
      <div key={block.id} className="border rounded-lg p-3 group hover:border-primary/30 transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex flex-col gap-0.5">
            <button 
              onClick={() => moveBlock(index, 'up')} 
              disabled={index === 0}
              className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-[10px] leading-none"
            >
              ▲
            </button>
            <button 
              onClick={() => moveBlock(index, 'down')} 
              disabled={index === content.length - 1}
              className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-[10px] leading-none"
            >
              ▼
            </button>
          </div>
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase">{blockType?.label}</span>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeBlock(block.id)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>

        {block.type === 'bullet_points' ? (
          <div className="space-y-1.5">
            {block.items?.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-mono">{i + 1}.</span>
                <Input value={item} onChange={(e) => updateBulletItem(block.id, i, e.target.value)} className="h-8 text-sm" placeholder="Bullet point..." />
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeBulletItem(block.id, i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => addBulletItem(block.id)}>
              <Plus className="h-3 w-3 mr-1" /> Add Item
            </Button>
          </div>
        ) : block.type === 'image' ? (
          <ImageUploadBlock
            currentUrl={block.url}
            caption={block.content}
            onUpload={(url) => updateBlock(block.id, { url })}
            onCaptionChange={(caption) => updateBlock(block.id, { content: caption })}
            compact
          />
        ) : block.type === 'video' ? (
          <div className="space-y-2">
            <Input value={block.url || ''} onChange={(e) => updateBlock(block.id, { url: e.target.value })} placeholder="Video embed URL (YouTube, Vimeo)..." className="text-sm" />
            <Input value={block.content} onChange={(e) => updateBlock(block.id, { content: e.target.value })} placeholder="Caption (optional)" className="text-sm" />
          </div>
        ) : block.type === 'heading' || block.type === 'subheading' ? (
          <Input value={block.content} onChange={(e) => updateBlock(block.id, { content: e.target.value })} placeholder={`${blockType?.label}...`} className={block.type === 'heading' ? 'text-lg font-bold' : 'text-base font-semibold'} />
        ) : (
          <Textarea value={block.content} onChange={(e) => updateBlock(block.id, { content: e.target.value })} placeholder={`${blockType?.label} content...`} rows={3} className="text-sm" />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {content.map((block, index) => renderBlockEditor(block, index))}

      <div className="flex items-center gap-2 pt-2 border-t">
        <Select value={addType} onValueChange={setAddType}>
          <SelectTrigger className="w-[180px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOCK_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={addBlock}>
          <Plus className="h-3 w-3 mr-1" /> Add Block
        </Button>
      </div>
    </div>
  );
}
