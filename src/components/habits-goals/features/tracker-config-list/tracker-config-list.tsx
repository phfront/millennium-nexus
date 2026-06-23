'use client';

import Link from 'next/link';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Switch } from '@phfront/millennium-ui';
import type { Tracker } from '@/types/habits-goals';

function SortableTrackerRow({
  tracker,
  onToggleActive,
  onRemove,
}: {
  tracker: Tracker;
  onToggleActive: (id: string, current: boolean) => void;
  onRemove: (id: string, label: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tracker.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-3 sm:gap-3 sm:p-4',
        isDragging ? 'z-10 border-brand-primary/40 shadow-lg ring-1 ring-brand-primary/20' : '',
      ].join(' ')}
    >
      <button
        type="button"
        className="inline-flex shrink-0 cursor-grab touch-none rounded-md p-2 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary active:cursor-grabbing"
        aria-label={`Reordenar ${tracker.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{tracker.label}</p>
        <p className="text-xs capitalize text-text-muted">
          {tracker.type}
          {tracker.unit ? ` · ${tracker.unit}` : ''}
          {tracker.goal_value ? ` · meta: ${tracker.goal_value}` : ''}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Switch checked={tracker.active} onChange={() => onToggleActive(tracker.id, tracker.active)} />
        <Link
          href={`/habits-goals/config/${tracker.id}`}
          className="inline-flex rounded-md p-2 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          aria-label="Editar meta"
        >
          <Pencil size={15} />
        </Link>
        <button
          type="button"
          onClick={() => onRemove(tracker.id, tracker.label)}
          className="inline-flex rounded-md p-2 text-text-muted transition-colors hover:bg-surface-3 hover:text-red-400"
          aria-label="Remover meta"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}

interface TrackerConfigListProps {
  trackers: Tracker[];
  onReorder: (orderedIds: string[]) => Promise<void>;
  onToggleActive: (id: string, current: boolean) => void;
  onRemove: (id: string, label: string) => void;
}

export function TrackerConfigList({
  trackers,
  onReorder,
  onToggleActive,
  onRemove,
}: TrackerConfigListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = trackers.findIndex((tracker) => tracker.id === active.id);
    const newIndex = trackers.findIndex((tracker) => tracker.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(trackers, oldIndex, newIndex);
    await onReorder(next.map((tracker) => tracker.id));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-text-muted">Arraste pelo ícone para definir a ordem no dashboard.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
        <SortableContext items={trackers.map((tracker) => tracker.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {trackers.map((tracker) => (
              <SortableTrackerRow
                key={tracker.id}
                tracker={tracker}
                onToggleActive={onToggleActive}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
